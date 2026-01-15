
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
    Clock, CheckCircle, TrendingUp, AlertTriangle, ChevronRight, User, 
    Play, BookOpen, Video, FileText, ChevronDown, ChevronUp, Lock, AlertCircle, Info, X, 
    ClipboardList, Briefcase, Phone, Mail, Plus, Upload, Calendar, Camera, Eye, ChevronLeft, 
    RotateCcw, Wallet, Award, Shield, Calculator, Sparkles, Target, Zap,
    // Fix: Added missing CheckSquare and Users icons from lucide-react
    CheckSquare, Users
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { SkillStatus, VerificationType, LibraryResource, Role, ContractType, UserStatus } from '../../types';
// Fix: Added missing SKILL_STATUS_LABELS import from constants
import { CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES, SKILL_STATUS_LABELS } from '../../constants';
import { useNavigate } from 'react-router-dom';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';
import { calculateSalary } from '../../services/salaryService';

const QUALIFICATIONS_LIST = [
    { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
    { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
    { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
];

export const TrialDashboard = () => {
    const { state, updateUser, logCandidateAction, triggerNotification, addCandidateDocument } = useAppContext();
    // Fix: Added missing 'users' to state destructuring from useAppContext
    const { currentUser, userSkills, skills, tests, testAttempts, systemConfig, qualityIncidents, users } = state;
    const navigate = useNavigate();

    // --- State for Modals/UI ---
    const [isQualModalOpen, setIsQualModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
    // Fix: Added missing contact modal state used for brigadir and HR support
    const [showContactModal, setShowContactModal] = useState<{type: 'brigadir' | 'hr' | 'coordinator', user: any} | null>(null);
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });
    
    // Form for new doc
    const [newDocData, setNewDocData] = useState({ 
        typeId: '', customName: '', issue_date: new Date().toISOString().split('T')[0], expires_at: '', indefinite: false, files: [] as File[] 
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    if (!currentUser) return null;

    // --- 1. TIME CALCULATIONS ---
    const trialTimeData = useMemo(() => {
        if (!currentUser?.trial_end_date || !currentUser?.hired_date) return null;
        const start = new Date(currentUser.hired_date).getTime();
        const end = new Date(currentUser.trial_end_date).getTime();
        const currentTime = now.getTime();
        const remaining = end - currentTime;
        const isEnded = remaining <= 0;
        const daysLeft = isEnded ? 0 : Math.ceil(remaining / (1000 * 3600 * 24));
        const total = end - start;
        const elapsed = currentTime - start;
        const percent = isEnded ? 100 : Math.min(100, Math.max(0, (elapsed / total) * 100));
        return { daysLeft, percent, isEnded };
    }, [currentUser, now]);

    // --- 2. ROBUST SALARY CALCULATIONS ---
    const salaryInfo = useMemo(() => {
        const defaultBonus = { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 };
        return calculateSalary(
            currentUser.base_rate || systemConfig.baseRate,
            skills,
            userSkills.filter(us => us.user_id === currentUser.id),
            state.monthlyBonuses[currentUser.id] || defaultBonus,
            now,
            qualityIncidents
        );
    }, [currentUser, skills, userSkills, systemConfig, now, qualityIncidents]);

    // Sub-totals for Tiles
    const skillsBonus = salaryInfo.breakdown.skills;
    
    const qualBonus = useMemo(() => {
        const userQuals = currentUser.qualifications || [];
        return QUALIFICATIONS_LIST
            .filter(q => userQuals.includes(q.id))
            .reduce((acc, q) => acc + q.value, 0);
    }, [currentUser.qualifications]);

    const contractType = currentUser.contract_type || ContractType.UOP;
    const contractBonus = systemConfig.contractBonuses[contractType] || 0;
    const studentBonus = (contractType === 'uz' && currentUser.is_student) ? systemConfig.studentBonus : 0;
    const totalContractBonus = contractBonus + studentBonus;

    const totalRate = salaryInfo.total + totalContractBonus;

    // --- 3. ACTIONS ---
    const handleContractChange = async (type: string) => {
        await updateUser(currentUser.id, { contract_type: type as any });
        logCandidateAction(currentUser.id, `Zmiana preferowanej umowy na: ${CONTRACT_TYPE_LABELS[type as ContractType] || type}`);
    };

    const handleStudentToggle = async (val: boolean) => {
        await updateUser(currentUser.id, { is_student: val });
    };

    const toggleQual = (id: string) => {
        const currentQuals = currentUser.qualifications || [];
        const newQuals = currentQuals.includes(id) ? currentQuals.filter(q => q !== id) : [...currentQuals, id];
        updateUser(currentUser.id, { qualifications: newQuals });
    };

    // --- 4. LISTS ---
    const tasks = useMemo(() => {
        const practice = userSkills
            .filter(us => us.user_id === currentUser.id && (us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING))
            .map(us => ({ type: 'practice', title: skills.find(s => s.id === us.skill_id)?.name_pl, id: us.skill_id }));
        
        return [...practice].slice(0, 3);
    }, [userSkills, skills, currentUser.id]);

    // Fix: Added missing brigadir and HR contact helper variables for the contact modal
    const brigadir = users.find(u => u.id === currentUser.assigned_brigadir_id);
    const hrContact = users.find(u => u.role === Role.HR);

    // Fix: Added unified render function for the contact modal
    const renderContactModal = () => {
        if (!showContactModal) return null;
        const { type, user } = showContactModal;
        const title = type === 'brigadir' ? 'Twój Brygadzista' : type === 'coordinator' ? 'Twój Koordynator' : 'Twój Opiekun HR';

        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowContactModal(null)}>
                <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold mx-auto mb-4">
                        {user ? `${user.first_name[0]}${user.last_name[0]}` : <User size={32}/>}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1">{title}</h3>
                    {user ? (
                        <>
                            <p className="text-slate-600 font-medium mb-4">{user.first_name} {user.last_name}</p>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-center gap-2 p-2 bg-slate-50 rounded">
                                    <Phone size={16} className="text-blue-500"/>
                                    <a href={`tel:${user.phone}`} className="font-bold text-slate-800 hover:text-blue-600">{user.phone || 'Brak numeru'}</a>
                                </div>
                                <div className="flex items-center justify-center gap-2 p-2 bg-slate-50 rounded">
                                    <Mail size={16} className="text-blue-500"/>
                                    <a href={`mailto:${user.email}`} className="font-medium text-slate-800 hover:text-blue-600">{user.email}</a>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-slate-500">Brak przypisanej osoby.</p>
                    )}
                    <div className="mt-6">
                        <Button fullWidth onClick={() => setShowContactModal(null)}>Zamknij</Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
            {/* Header: Trial Progress */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                        <Clock size={28}/>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Twój Okres Próbny</h1>
                        <p className="text-sm text-slate-500 font-medium">Status: {trialTimeData?.isEnded ? 'Zakończony' : 'W trakcie'}</p>
                    </div>
                </div>

                <div className="flex-1 max-w-md w-full">
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                        <span>Postęp czasu</span>
                        <span className={trialTimeData?.daysLeft && trialTimeData.daysLeft <= 7 ? 'text-red-500' : 'text-orange-600'}>
                            Zostało: {trialTimeData?.daysLeft} dni
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                        <div 
                            className="bg-gradient-to-r from-orange-400 to-orange-600 h-full transition-all duration-1000 shadow-sm" 
                            style={{ width: `${trialTimeData?.percent}%` }}
                        ></div>
                    </div>
                </div>

                <div className="hidden md:block border-l border-slate-100 pl-6">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Koniec okresu</div>
                    <div className="font-bold text-slate-700">{currentUser.trial_end_date?.split('T')[0]}</div>
                </div>
            </div>

            {/* SALARY CALCULATOR: 5 TILES (Identical to Candidate Simulation) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                {/* BAZA */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:border-blue-200 transition-colors group">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400 mb-3 font-black uppercase text-[10px] tracking-widest">
                            <Wallet size={14} className="group-hover:text-blue-500 transition-colors"/> Baza
                        </div>
                        <div className="text-3xl font-black text-slate-900">{systemConfig.baseRate}<span className="text-sm font-bold text-slate-400 ml-1">zł</span></div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-3">Stawka wejściowa</p>
                </div>

                {/* UMIEJĘTNOŚCI */}
                <div className={`p-5 rounded-2xl shadow-sm border flex flex-col justify-between transition-all hover:shadow-md ${skillsBonus > 0 ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                    <div>
                        <div className="flex items-center gap-2 text-slate-400 mb-3 font-black uppercase text-[10px] tracking-widest">
                            <Award size={14} className="text-green-500"/> Matryca
                        </div>
                        <div className="text-3xl font-black text-green-600">+{skillsBonus.toFixed(2)}<span className="text-sm font-bold ml-1">zł</span></div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-3">Za potwierdzone skille</p>
                </div>

                {/* UPRAWNIENIA */}
                <div 
                    className={`p-5 rounded-2xl shadow-sm border flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${qualBonus > 0 ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200 hover:border-purple-300'}`}
                    onClick={() => setIsQualModalOpen(true)}
                >
                    <div>
                        <div className="flex items-center gap-2 text-slate-400 mb-3 font-black uppercase text-[10px] tracking-widest">
                            <Shield size={14} className="text-purple-500"/> Uprawnienia
                        </div>
                        <div className={`text-3xl font-black flex items-center justify-between ${qualBonus > 0 ? 'text-purple-600' : 'text-slate-300'}`}>
                            +{qualBonus.toFixed(1)} <ChevronRight size={20} className="text-slate-300" />
                        </div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-3">SEP / UDT / BHP</p>
                </div>

                {/* FORMA ZATRUDNIENIA */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative group hover:border-blue-300 transition-colors">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400 mb-3 font-black uppercase text-[10px] tracking-widest">
                            <FileText size={14} className="text-blue-500"/> Umowa
                        </div>
                        <div className="relative">
                            <select 
                                className="w-full appearance-none bg-transparent text-lg font-black text-blue-600 focus:outline-none cursor-pointer py-1 pr-6"
                                value={contractType}
                                onChange={(e) => handleContractChange(e.target.value)}
                            >
                                {Object.entries(systemConfig.contractBonuses).map(([key, bonus]) => (
                                    <option key={key} value={key}>{CONTRACT_TYPE_LABELS[key as ContractType] || key}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none"/>
                        </div>
                        <div className="text-[10px] font-black text-blue-400 mt-1 uppercase tracking-tighter">
                            Bonus: +{totalContractBonus.toFixed(2)} zł
                        </div>
                        {contractType === 'uz' && (
                            <label className="mt-2 flex items-center gap-2 bg-blue-50 p-1.5 rounded-lg cursor-pointer border border-blue-100">
                                <input 
                                    type="checkbox" 
                                    checked={currentUser.is_student} 
                                    onChange={(e) => handleStudentToggle(e.target.checked)}
                                    className="w-3.5 h-3.5 text-blue-600 rounded"
                                />
                                <span className="text-[9px] text-blue-700 font-black uppercase tracking-tighter">Student &lt; 26 lat</span>
                            </label>
                        )}
                    </div>
                </div>

                {/* TOTAL RATE - The Black Tile */}
                <div className="bg-[#1A1C1E] p-5 rounded-2xl shadow-xl border border-slate-800 flex flex-col justify-between text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Calculator size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-slate-500 mb-3 font-black uppercase text-[10px] tracking-widest">
                            <Sparkles size={14} className="text-blue-400"/> STAWKA TOTAL
                        </div>
                        <div className="text-3xl font-black text-white">{totalRate.toFixed(2)}<span className="text-sm font-bold text-slate-500 ml-1">zł/h</span></div>
                    </div>
                    <button 
                        onClick={() => setIsBreakdownOpen(true)}
                        className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-4 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                        Szczegóły wyliczenia <ChevronRight size={10}/>
                    </button>
                </div>
            </div>

            {/* Motivational Banner */}
            <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8 group">
                <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-700">
                    <TrendingUp size={200} />
                </div>
                <div className="relative z-10 space-y-4 flex-1">
                    <div className="bg-white/20 w-fit px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md">TWOJA SZANSA</div>
                    <h2 className="text-3xl font-black tracking-tight leading-none uppercase">Zarabiaj więcej już od zaraz!</h2>
                    <p className="text-blue-100 font-medium max-w-xl">
                        Każdy zaliczony test i potwierdzona praktyka to realny wzrost Twojej stawki. Nie czekaj do końca okresu próbnego – buduj swój profil kompetencji już teraz.
                    </p>
                    <div className="flex gap-4 pt-2">
                        <Button onClick={() => navigate('/trial/library')} className="bg-white text-blue-600 hover:bg-blue-50 border-0 rounded-xl h-11 px-8 font-black uppercase text-xs tracking-widest shadow-lg">
                            Otwórz Bibliotekę
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/dashboard/skills')} className="border-white/30 text-white hover:bg-white/10 rounded-xl h-11 px-8 font-bold uppercase text-xs">
                            Lista Umiejętności
                        </Button>
                    </div>
                </div>
                <div className="relative z-10 bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20 w-full md:w-72">
                    <div className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-4">Twoje zadania:</div>
                    <div className="space-y-3">
                        {tasks.length > 0 ? tasks.map(t => (
                            <div key={t.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                                    <CheckSquare size={16}/>
                                </div>
                                <span className="text-xs font-bold truncate">{t.title}</span>
                            </div>
                        )) : (
                            <p className="text-xs text-blue-200 italic font-medium">Brak pilnych zadań. Rozpocznij naukę!</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Secondary Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Column 1: Verification & Progress */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm flex items-center gap-2">
                                <Target size={18} className="text-blue-600"/> Twoje Umiejętności (Weryfikacja)
                            </h3>
                            <button onClick={() => navigate('/dashboard/skills')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Zobacz wszystkie</button>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {userSkills.filter(us => us.user_id === currentUser.id && us.status !== SkillStatus.CONFIRMED && !us.custom_type).slice(0, 4).map(us => {
                                    const skill = skills.find(s => s.id === us.skill_id);
                                    if (!skill) return null;
                                    return (
                                        <div key={us.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:border-blue-200 transition-all">
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{skill.name_pl}</div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase mt-1">{SKILL_STATUS_LABELS[us.status]}</div>
                                            </div>
                                            <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard/skills')} className="group-hover:bg-blue-600 group-hover:text-white transition-all rounded-xl h-8 w-8 px-0">
                                                <ChevronRight size={18}/>
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Contacts & Support */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm mb-6 flex items-center gap-2">
                            {/* Fix: Replaced missing Users import reference */}
                            <Users size={18} className="text-blue-600"/> Wsparcie i kontakt
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shadow-sm"><User size={20}/></div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Brygadzista</p>
                                        <p className="font-bold text-slate-800 text-sm">
                                            {/* Fix: Added missing 'users' array from state to perform lookup */}
                                            {users.find(u => u.id === currentUser.assigned_brigadir_id)?.last_name || 'Brak przypisania'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {/* Fix: Unified contact handling by using the showContactModal state */}
                                    <Button fullWidth variant="secondary" className="h-9 text-[10px] font-black rounded-xl" onClick={() => setShowContactModal({type: 'brigadir', user: brigadir})}>KONTAKT</Button>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 shadow-sm"><Briefcase size={20}/></div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase">HR Manager</p>
                                        <p className="font-bold text-slate-800 text-sm">Opiekun procesu</p>
                                    </div>
                                </div>
                                {/* Fix: Unified contact handling by using the showContactModal state */}
                                <Button fullWidth variant="secondary" className="h-9 text-[10px] font-black rounded-xl" onClick={() => setShowContactModal({type: 'hr', user: hrContact})}>POMOC</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Breakdown Modal */}
            {isBreakdownOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsBreakdownOpen(false)}>
                    <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Skład Twojej Stawki</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Szczegółowe wyliczenie wynagrodzenia</p>
                            </div>
                            <button onClick={() => setIsBreakdownOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Baza systemowa</div>
                                <div className="text-lg font-black text-slate-900">{systemConfig.baseRate.toFixed(2)} zł</div>
                            </div>
                            {totalContractBonus > 0 && (
                                <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <div className="text-xs font-black text-blue-600 uppercase tracking-widest">Bonus za umowę ({contractType.toUpperCase()})</div>
                                    <div className="text-lg font-black text-blue-700">+{totalContractBonus.toFixed(2)} zł</div>
                                </div>
                            )}
                            <div className="pt-2">
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">POTWIERDZONE UMIEJĘTNOŚCI</h4>
                                <div className="space-y-2">
                                    {salaryInfo.breakdown.details.activeSkills.map((s, i) => (
                                        <div key={i} className={`flex justify-between items-center p-3 rounded-2xl border ${s.isBlocked ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                                            <div>
                                                <p className={`text-xs font-bold ${s.isBlocked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{s.name}</p>
                                                {s.isBlocked && <p className="text-[8px] font-black text-red-600 uppercase">Blokada jakościowa</p>}
                                            </div>
                                            <div className={`text-sm font-black ${s.isBlocked ? 'text-slate-300' : 'text-green-600'}`}>+{s.amount.toFixed(2)} zł</div>
                                        </div>
                                    ))}
                                    {salaryInfo.breakdown.details.activeSkills.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">Brak naliczonych dodatków.</p>}
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Suma Godzinowa:</span>
                            <span className="text-2xl font-black text-blue-600">{totalRate.toFixed(2)} zł/h</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Qualifications Selection Modal */}
            {isQualModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[260] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsQualModalOpen(false)}>
                    <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                                <Shield size={24} className="text-purple-600"/> Posiadane Uprawnienia
                            </h3>
                            <button onClick={() => setIsQualModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-white rounded-full"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-3">
                            <p className="text-sm text-slate-500 font-medium mb-4 leading-relaxed">Zaznacz posiadane uprawnienia. System doliczy je do Twojej stawki po dostarczeniu skanów dokumentów.</p>
                            {QUALIFICATIONS_LIST.map(q => {
                                const isSelected = (currentUser.qualifications || []).includes(q.id);
                                return (
                                    <div 
                                        key={q.id}
                                        onClick={() => toggleQual(q.id)}
                                        className={`flex justify-between items-center p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                            isSelected ? 'bg-purple-50 border-purple-200 shadow-md' : 'bg-white border-slate-100 hover:border-purple-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-purple-600 border-purple-600' : 'bg-white border-slate-200'}`}>
                                                {isSelected && <CheckCircle size={14} className="text-white"/>}
                                            </div>
                                            <span className={`font-black uppercase text-xs tracking-tight ${isSelected ? 'text-purple-800' : 'text-slate-600'}`}>{q.label}</span>
                                        </div>
                                        <span className={`font-black ${isSelected ? 'text-purple-600' : 'text-slate-300'}`}>+{q.value.toFixed(1)} zł</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button onClick={() => setIsQualModalOpen(false)} className="px-10 h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-purple-200 bg-purple-600 hover:bg-purple-700">Potwierdź</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document upload modal and file viewer */}
            {renderContactModal()}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
        </div>
    );
};
