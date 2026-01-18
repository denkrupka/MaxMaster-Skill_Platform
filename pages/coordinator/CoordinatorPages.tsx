import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Users, CheckSquare, AlertTriangle, Award, BookOpen, User as UserIcon,
    Search, Filter, ChevronDown, Eye, MessageSquare, ArrowRight,
    MapPin, Calendar, HardHat, CheckCircle, Clock, XCircle, Shield,
    FileText, Paperclip, Camera, Plus, Save, Trash2, Lock, ShieldAlert,
    Video, Layers, ChevronUp, Play, List, X, Link as LinkIcon, Folder, Briefcase, Star, Lightbulb, ImageIcon, Type, Wallet, TrendingUp, Info,
    ChevronRight,
    StickyNote,
    Upload,
    Loader2,
    Mail,
    Phone,
    UserCheck,
    Cake,
    ShieldCheck,
    ShieldAlert as ShieldAlertIcon,
    Gift,
    Circle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Role, UserStatus, User, SkillStatus, VerificationType, ChecklistItemState, NoteCategory, QualityIncident, BadgeType, ContractType } from '../../types';
import { USER_STATUS_LABELS, SKILL_STATUS_LABELS, CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES, CHECKLIST_TEMPLATES } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';
import { calculateSalary } from '../../services/salaryService';
import { Button } from '../../components/Button';
import { EmployeeSkills } from '../employee/Skills';
import { EmployeeLibrary } from '../employee/Library';
import { CandidateProfilePage } from '../candidate/Profile';

// --- EMPLOYEES PAGE ---
export const CoordinatorEmployees = () => {
    const { state, addEmployeeNote, addQualityIncident, deleteEmployeeNote, addEmployeeBadge, deleteEmployeeBadge } = useAppContext();
    const navigate = useNavigate();
    const location = useLocation();
    const { users, userSkills, skills, qualityIncidents, employeeNotes, systemConfig, monthlyBonuses, employeeBadges, currentUser } = state;
    
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'trial' | 'employee'>('all');
    const [brigadirFilter, setBrigadirFilter] = useState('all');
    const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'rate' | 'skills' | 'docs' | 'quality' | 'notes' | 'badges'>('info');
    const [selectedIncident, setSelectedIncident] = useState<QualityIncident | null>(null);
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // Secondary modals
    const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
    const [isQualityAddModalOpen, setIsQualityAddModalOpen] = useState(false);

    // Local form states
    const [noteText, setNoteText] = useState('');
    const [noteCategory, setNoteCategory] = useState<NoteCategory>(NoteCategory.GENERAL);
    
    const [badgeType, setBadgeType] = useState<BadgeType>(BadgeType.QUALITY);
    const [badgeDesc, setBadgeDesc] = useState('');
    const [badgeDate, setBadgeDate] = useState(new Date().toISOString().split('T')[0]);

    const [newIncidentSkillId, setNewIncidentSkillId] = useState('');
    const [newIncidentDesc, setNewIncidentDesc] = useState('');
    const [newIncidentImages, setNewIncidentImages] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const incidentCameraRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (location.state && location.state.brigadirId) {
            setBrigadirFilter(location.state.brigadirId);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const brigadirs = users.filter(u => u.role === Role.BRIGADIR && u.status === UserStatus.ACTIVE);
    
    const filteredEmployees = useMemo(() => {
        return users.filter(u => {
            // Exclude internal roles, candidates and INACTIVE (fired) employees
            if (u.role === Role.CANDIDATE || [Role.ADMIN, Role.HR, Role.COORDINATOR].includes(u.role)) return false;
            if (u.status === UserStatus.INACTIVE) return false;

            const searchLower = search.toLowerCase();
            const matchesSearch = (u.first_name + ' ' + u.last_name).toLowerCase().includes(searchLower);
            let matchesStatus = true;
            if (statusFilter === 'trial') matchesStatus = u.status === UserStatus.TRIAL;
            if (statusFilter === 'employee') matchesStatus = u.status === UserStatus.ACTIVE;
            let matchesBrigadir = true;
            if (brigadirFilter !== 'all') matchesBrigadir = u.assigned_brigadir_id === brigadirFilter;
            return matchesSearch && matchesStatus && matchesBrigadir;
        });
    }, [users, search, statusFilter, brigadirFilter]);

    const getBossLabel = (user: User) => user.role === Role.BRIGADIR ? 'Koordynator:' : 'Brygadzista:';
    const getBossName = (id?: string) => { const b = users.find(u => u.id === id); return b ? `${b.first_name} ${b.last_name}` : '-'; };
    const getAuthorName = (id: string) => { const u = users.find(x => x.id === id); return u ? `${u.first_name} ${u.last_name}` : 'System'; };
    
    const handleOpenDetail = (user: User, tab: 'info' | 'rate' | 'skills' | 'docs' | 'quality' | 'notes' | 'badges' = 'info') => { 
        setSelectedEmployee(user); 
        setActiveTab(tab); 
        setIsQualityAddModalOpen(false); 
    };

    const handleSaveNote = () => {
        if (!selectedEmployee || !noteText || !currentUser) return;
        addEmployeeNote({ employee_id: selectedEmployee.id, author_id: currentUser.id, category: noteCategory, text: noteText });
        setNoteText('');
    };

    const handleSaveBadge = () => {
        if (!selectedEmployee || !badgeDesc || !currentUser) return;
        // Re-using 'month' field for specific date as string
        addEmployeeBadge({ employee_id: selectedEmployee.id, author_id: currentUser.id, month: badgeDate, type: badgeType, description: badgeDesc, visible_to_employee: true });
        setBadgeDesc('');
    };

    const handleSaveIncident = () => {
        if (!selectedEmployee || !newIncidentSkillId || !newIncidentDesc || !currentUser) return;
        const now = new Date();
        const existingCount = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === selectedEmployee.id && inc.skill_id === newIncidentSkillId && d.getMonth() === now.getMonth();
        }).length;

        addQualityIncident({
            user_id: selectedEmployee.id,
            skill_id: newIncidentSkillId,
            date: new Date().toISOString(),
            incident_number: existingCount + 1,
            description: newIncidentDesc,
            reported_by: `${currentUser.first_name} ${currentUser.last_name}`,
            image_urls: newIncidentImages
        });

        setIsQualityAddModalOpen(false);
        setNewIncidentSkillId('');
        setNewIncidentDesc('');
        setNewIncidentImages([]);
    };

    const handleIncidentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0 && selectedEmployee) {
            setIsUploading(true);
            try {
                const uploadedUrls: string[] = [];
                for (let i = 0; i < files.length; i++) {
                    const url = await uploadDocument(files[i], selectedEmployee.id);
                    if (url) uploadedUrls.push(url);
                }
                setNewIncidentImages(prev => [...prev, ...uploadedUrls]);
            } finally { setIsUploading(false); }
        }
    };

    const renderModalContent = () => {
        if (!selectedEmployee) return null;
        
        const employeeSkillsList = userSkills.filter(us => us.user_id === selectedEmployee.id && !us.skill_id?.startsWith('doc_') && skills.find(s => s.id === us.skill_id)?.verification_type !== VerificationType.DOCUMENT);
        const employeeConfirmedSkills = employeeSkillsList.filter(es => es.status === SkillStatus.CONFIRMED);
        const employeeIncidents = qualityIncidents.filter(qi => qi.user_id === selectedEmployee.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const employeeNotesList = employeeNotes.filter(en => en.employee_id === selectedEmployee.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const employeeBadgesList = employeeBadges.filter(eb => eb.employee_id === selectedEmployee.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const salaryInfo = calculateSalary(
            selectedEmployee.base_rate || systemConfig.baseRate,
            skills,
            userSkills.filter(us => us.user_id === selectedEmployee.id),
            monthlyBonuses[selectedEmployee.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
            new Date(),
            qualityIncidents
        );

        const contractBonus = systemConfig.contractBonuses[selectedEmployee.contract_type || ContractType.UOP] || 0;
        const studentBonus = (selectedEmployee.contract_type === ContractType.UZ && selectedEmployee.is_student) ? 3 : 0;
        const currentTotalRate = salaryInfo.total + contractBonus + studentBonus;
        const nextMonthTotalRate = salaryInfo.nextMonthTotal + contractBonus + studentBonus;

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedEmployee(null)}>
                <div className="bg-white rounded-[32px] shadow-2xl max-w-4xl w-full flex flex-col max-h-[95vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white relative">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-100 ring-4 ring-blue-50">
                                {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
                                    <span className={`px-2 py-0.5 text-[9px] rounded-full font-black uppercase tracking-widest border ${selectedEmployee.status === UserStatus.TRIAL ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                        {USER_STATUS_LABELS[selectedEmployee.status]}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                                    <span className="flex items-center gap-1"><Briefcase size={12}/> {selectedEmployee.target_position || 'Monter'}</span>
                                    <span className="text-slate-200">|</span>
                                    <span className="flex items-center gap-1"><HardHat size={12}/> {getBossLabel(selectedEmployee)} {getBossName(selectedEmployee.assigned_brigadir_id)}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedEmployee(null)} className="text-slate-300 hover:text-slate-500 transition-colors p-2 hover:bg-slate-50 rounded-full">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Navigation - Compact Version */}
                    <div className="px-4 bg-white border-b border-slate-50 py-2 flex gap-0.5 overflow-x-auto scrollbar-hide justify-start">
                        {[
                            { id: 'info', label: 'DANE', icon: UserIcon },
                            { id: 'rate', label: 'STAWKA', icon: Wallet },
                            { id: 'skills', label: 'MATRYCA', icon: Award },
                            { id: 'docs', label: 'UPRAWNIENIA', icon: FileText },
                            { id: 'quality', label: 'JAKOŚĆ', icon: AlertTriangle, badge: employeeIncidents.length || null },
                            { id: 'notes', label: 'NOTATKI', icon: StickyNote, badge: employeeNotesList.length || null },
                            { id: 'badges', label: 'ODZNAKI', icon: Star, badge: employeeBadgesList.length || null }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)} 
                                className={`px-2.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                <tab.icon size={13} />
                                {tab.label}
                                {tab.badge && <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${activeTab === tab.id ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>{tab.badge}</span>}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1 bg-white scrollbar-hide">
                        {activeTab === 'info' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Mail size={14} className="text-blue-500"/> Kontakt
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><Phone size={18}/></div>
                                            <div><p className="text-[9px] font-black text-slate-400 uppercase">TELEFON</p><p className="font-bold text-slate-800 text-sm">{selectedEmployee.phone || '-'}</p></div>
                                        </div>
                                        <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><Mail size={18}/></div>
                                            <div className="truncate flex-1"><p className="text-[9px] font-black text-slate-400 uppercase">EMAIL</p><p className="font-bold text-slate-800 text-sm truncate">{selectedEmployee.email}</p></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <UserIcon size={14} className="text-blue-500"/> Personalne
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><Cake size={18}/></div>
                                            <div><p className="text-[9px] font-black text-slate-400 uppercase">URODZONY</p><p className="font-bold text-slate-800 text-sm">{selectedEmployee.birth_date || 'Nie podano'}</p></div>
                                        </div>
                                        <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><MapPin size={18}/></div>
                                            <div className="truncate flex-1"><p className="text-[9px] font-black text-slate-400 uppercase">ADRES</p><p className="font-bold text-slate-800 text-xs truncate">{selectedEmployee.city}, {selectedEmployee.street} {selectedEmployee.house_number}</p></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rate' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OBECNIE (NETTO)</h3>
                                            <span className="text-[9px] font-black uppercase bg-green-600 text-white px-2 py-0.5 rounded-full">BIEŻĄCY MC</span>
                                        </div>
                                        <div className="text-4xl font-black text-slate-900">{currentTotalRate.toFixed(2)}<span className="text-sm font-medium text-slate-400 ml-1">zł/h</span></div>
                                        <button onClick={() => setIsBreakdownModalOpen(true)} className="mt-4 text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5 hover:translate-x-1 transition-transform">
                                            <Info size={14}/> Pokaż składniki stawki
                                        </button>
                                    </div>
                                    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 text-white">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">PROGNOZA (NETTO)</h3>
                                            <span className="text-[9px] font-black uppercase bg-blue-600 text-white px-2 py-0.5 rounded-full">PRZYSZŁY MC</span>
                                        </div>
                                        <div className="text-4xl font-black text-green-400">{nextMonthTotalRate.toFixed(2)}<span className="text-sm font-medium text-slate-500 ml-1">zł/h</span></div>
                                        <button onClick={() => setIsBreakdownModalOpen(true)} className="mt-4 text-[10px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5 hover:translate-x-1 transition-transform">
                                            <Info size={14}/> Pokaż składniki stawki
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'quality' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="flex justify-between items-center bg-red-50/50 p-4 rounded-2xl border border-red-100">
                                    <div><h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest">HISTORIA JAKOŚCI</h3><p className="text-[9px] text-red-400 font-bold uppercase mt-0.5">Zgłoszenia błędów i wstrzymane dodatki</p></div>
                                    <Button onClick={() => setIsQualityAddModalOpen(true)} className="bg-red-600 text-white rounded-xl h-9 px-4 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-200"><Plus size={14} className="mr-1"/> Zgłoś błąd</Button>
                                </div>
                                <div className="space-y-3">
                                    {employeeIncidents.map(inc => (
                                        <div key={inc.id} className="p-4 border border-slate-100 rounded-2xl hover:border-red-200 transition-all cursor-pointer group bg-white shadow-sm flex justify-between items-center" onClick={() => setSelectedIncident(inc)}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${inc.incident_number === 1 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}><AlertTriangle size={18}/></div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm uppercase tracking-tight">{skills.find(s => s.id === inc.skill_id)?.name_pl}</div>
                                                    <div className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{new Date(inc.date).toLocaleDateString()} • {inc.incident_number === 1 ? 'OSTRZEŻENIE' : 'BLOKADA DODATKU'}</div>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-slate-300 group-hover:text-red-500 transition-colors"/>
                                        </div>
                                    ))}
                                    {employeeIncidents.length === 0 && <div className="text-center py-12 text-slate-300 italic font-bold text-xs uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-3xl">Brak zgłoszeń jakościowych</div>}
                                </div>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">DODAJ NOWĄ NOTATKĘ</h4>
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            {Object.values(NoteCategory).map(c => (
                                                <button key={c} onClick={() => setNoteCategory(c)} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${noteCategory === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'}`}>{c}</button>
                                            ))}
                                        </div>
                                        <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none h-24" placeholder="Wpisz treść..." value={noteText} onChange={e => setNoteText(e.target.value)}/>
                                        <div className="flex justify-end"><Button size="sm" onClick={handleSaveNote} disabled={!noteText} className="rounded-xl h-10 px-6">Dodaj notatkę</Button></div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {employeeNotesList.map(note => (
                                        <div key={note.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm relative group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-widest w-fit">{note.category}</span>
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-1">Zgłosił: {getAuthorName(note.author_id)}</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{new Date(note.created_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-700 font-medium leading-relaxed italic">"{note.text}"</p>
                                            {note.author_id === currentUser?.id && <button onClick={() => deleteEmployeeNote(note.id)} className="absolute -top-2 -right-2 bg-red-50 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'badges' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="bg-yellow-50/50 p-5 rounded-3xl border border-yellow-100">
                                    <h4 className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-3 ml-1">PRZYZNAJ WYRÓŻNIENIE</h4>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <input type="date" className="bg-white border border-yellow-100 p-2 rounded-xl text-xs font-bold" value={badgeDate} onChange={e => setBadgeDate(e.target.value)}/>
                                            <select className="bg-white border border-yellow-100 p-2 rounded-xl text-xs font-bold appearance-none" value={badgeType} onChange={e => setBadgeType(e.target.value as BadgeType)}>
                                                {Object.values(BadgeType).map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <textarea className="w-full bg-white border border-yellow-100 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-yellow-500/10 outline-none h-20" placeholder="Uzasadnienie..." value={badgeDesc} onChange={e => setBadgeDesc(e.target.value)}/>
                                        <div className="flex justify-end"><Button onClick={handleSaveBadge} disabled={!badgeDesc} className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl h-10 px-8 shadow-lg shadow-yellow-200">Przyznaj odznakę</Button></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {employeeBadgesList.map(badge => (
                                        <div key={badge.id} className="bg-white border border-yellow-100 rounded-2xl p-4 shadow-sm relative group">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center"><Star size={16} fill="currentColor"/></div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{badge.type}</p>
                                                    <p className="text-[9px] font-bold text-slate-400">{badge.month}</p>
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mt-0.5">Zgłosił: {getAuthorName(badge.author_id)}</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 italic font-medium leading-relaxed">"{badge.description}"</p>
                                            {badge.author_id === currentUser?.id && <button onClick={() => deleteEmployeeBadge(badge.id)} className="absolute -top-2 -right-2 bg-red-50 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'skills' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-300">
                                {employeeSkillsList.map(us => {
                                    const skill = skills.find(s => s.id === us.skill_id);
                                    if (!skill) return null;
                                    return (
                                        <div key={us.id} className={`p-4 rounded-2xl border transition-all flex justify-between items-center bg-white shadow-sm ${us.status === SkillStatus.CONFIRMED ? 'border-green-100' : 'border-slate-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${us.status === SkillStatus.CONFIRMED ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-300'}`}><Award size={20}/></div>
                                                <div><div className="font-bold text-slate-800 text-xs uppercase tracking-tight">{skill.name_pl}</div><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{skill.category}</div></div>
                                            </div>
                                            <div className="text-right"><div className="font-black text-green-600 text-xs">+{skill.hourly_bonus.toFixed(2)} zł</div><span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter border ${us.status === SkillStatus.CONFIRMED ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>{SKILL_STATUS_LABELS[us.status]}</span></div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {activeTab === 'docs' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-300">
                                {userSkills.filter(us => us.user_id === selectedEmployee.id && (us.skill_id?.startsWith('doc_') || !!us.custom_type || skills.find(s => s.id === us.skill_id)?.verification_type === VerificationType.DOCUMENT)).map(us => {
                                    const skill = skills.find(s => s.id === us.skill_id);
                                    return (
                                        <div key={us.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm"><Shield size={20}/></div>
                                                <div><p className="font-bold text-slate-800 text-xs uppercase">{us.custom_name || skill?.name_pl || 'Uprawnienie'}</p><p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{us.is_indefinite ? 'Bezterminowo' : `Do: ${us.expires_at || '-'}`}</p></div>
                                            </div>
                                            <button onClick={() => openFileViewer(us)} className="p-2 text-slate-400 hover:text-blue-600"><Eye size={20}/></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <Button onClick={() => setSelectedEmployee(null)} className="px-10 rounded-2xl font-black uppercase tracking-widest h-11 shadow-xl shadow-slate-200">Zamknij Profil</Button>
                    </div>
                </div>

                {/* Breakdown Modal */}
                {isBreakdownModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsBreakdownModalOpen(false)}>
                        <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <div><h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">SKŁAD STAWKI</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Szczegółowe wyliczenie wynagrodzenia</p></div>
                                <button onClick={() => setIsBreakdownModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                            </div>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100"><div className="text-xs font-black text-slate-500 uppercase tracking-widest">Baza</div><div className="text-lg font-black text-slate-900">{salaryInfo.breakdown.base.toFixed(2)} zł</div></div>
                                {contractBonus + studentBonus > 0 && <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-2xl border border-blue-100"><div className="text-xs font-black text-blue-600 uppercase tracking-widest">Bonus Umowa</div><div className="text-lg font-black text-blue-700">+{(contractBonus + studentBonus).toFixed(2)} zł</div></div>}
                                <div className="pt-2"><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">AKTYWNE UMIEJĘTNOŚCI</h4><div className="space-y-2">{salaryInfo.breakdown.details.activeSkills.map((s, i) => (<div key={i} className={`flex justify-between items-center p-3 rounded-2xl border ${s.isBlocked ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}><div><p className={`text-xs font-bold ${s.isBlocked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{s.name}</p>{s.isBlocked && <p className="text-[8px] font-black text-red-600 uppercase">Blokada jakościowa</p>}</div><div className={`text-sm font-black ${s.isBlocked ? 'text-slate-300' : 'text-green-600'}`}>+{s.amount.toFixed(2)} zł</div></div>))}</div></div>
                                <div className="pt-2"><h4 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3 ml-1">UMIEJĘTNOŚCI W TOKU (PROGNOZA)</h4><div className="space-y-2">{salaryInfo.breakdown.details.pendingSkills.map((s, i) => (<div key={i} className="flex justify-between items-center p-3 rounded-2xl border bg-blue-50/30 border-blue-100"><div><p className="text-xs font-bold text-blue-700">{s.name}</p><p className="text-[8px] font-black text-blue-400 uppercase">Wchodzi od: {new Date(s.effectiveFrom || '').toLocaleDateString()}</p></div><div className="text-sm font-black text-blue-600">+{s.amount.toFixed(2)} zł</div></div>))}</div></div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Suma Godzinowa:</span><span className="text-2xl font-black text-blue-600">{currentTotalRate.toFixed(2)} zł/h</span></div>
                        </div>
                    </div>
                )}

                {/* Quality Add Modal - Smaller as requested */}
                {isQualityAddModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsQualityAddModalOpen(false)}>
                        <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                            <div className="bg-red-600 p-6 flex justify-between items-center text-white"><div className="flex items-center gap-3"><div className="p-2 bg-white/20 rounded-xl"><ShieldAlertIcon size={24}/></div><div><h2 className="text-xl font-black uppercase tracking-tight">Zgłoś błąd</h2><p className="text-[10px] font-black text-red-100 uppercase tracking-widest mt-0.5">{selectedEmployee.first_name} {selectedEmployee.last_name}</p></div></div><button onClick={() => setIsQualityAddModalOpen(false)} className="text-red-100 hover:text-white"><X size={24}/></button></div>
                            <div className="p-8 space-y-6">
                                <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WYBIERZ UMIEJĘTNOŚĆ</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-slate-800 font-bold text-sm focus:ring-4 focus:ring-red-500/10 outline-none appearance-none shadow-inner" value={newIncidentSkillId} onChange={e => setNewIncidentSkillId(e.target.value)}><option value="">Wybierz z listy...</option>{employeeConfirmedSkills.map(es => { const skill = skills.find(s => s.id === es.skill_id); return skill ? <option key={skill.id} value={skill.id}>{skill.name_pl}</option> : null; })}</select></div>
                                <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">OPIS BŁĘDU / UWAGI</label><textarea className="w-full bg-slate-50 border border-slate-200 rounded-[24px] p-4 text-slate-800 font-medium text-sm focus:ring-4 focus:ring-red-500/10 outline-none h-32 shadow-inner" placeholder="Opisz dokładnie błąd..." value={newIncidentDesc} onChange={e => setNewIncidentDesc(e.target.value)}/></div>
                                <div className="space-y-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DOKUMENTACJA ZDJĘCIOWA</label><div className="flex flex-wrap gap-3">{newIncidentImages.map((url, idx) => (<div key={idx} className="relative w-20 h-20 group shadow-lg"><img src={url} alt="Proof" className="w-full h-full object-cover rounded-xl border border-slate-200"/><button onClick={() => setNewIncidentImages(prev => prev.filter(u => u !== url))} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1"><X size={12}/></button></div>))}<button onClick={() => incidentCameraRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-red-500 hover:text-red-500 transition-all bg-slate-50"><Camera size={24}/><span className="text-[9px] font-black uppercase mt-1">DODAJ</span></button></div><input type="file" multiple className="hidden" ref={incidentCameraRef} accept="image/*" onChange={handleIncidentImageUpload}/></div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4"><button onClick={() => setIsQualityAddModalOpen(false)} className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Anuluj</button><Button onClick={handleSaveIncident} disabled={!newIncidentSkillId || !newIncidentDesc || isUploading || newIncidentImages.length === 0} className="flex-[2] h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-900/30 bg-red-600 hover:bg-red-700">{isUploading ? <Loader2 className="animate-spin" size={20}/> : <ShieldAlertIcon size={20} className="mr-2"/>} ZATWIERDŹ BŁĄD</Button></div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderIncidentDetailModal = () => {
        if (!selectedIncident) return null;
        const skill = skills.find(s => s.id === selectedIncident.skill_id);
        const isWarning = selectedIncident.incident_number === 1;
        const urls = selectedIncident.image_urls || (selectedIncident.image_url ? [selectedIncident.image_url] : []);

        return (
            <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedIncident(null)}>
                <div className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full p-8 animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-6">
                        <div className={`p-3 rounded-2xl shadow-lg ${isWarning ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}><AlertTriangle size={32}/></div>
                        <button onClick={() => setSelectedIncident(null)} className="text-slate-300 hover:text-slate-500"><X size={28}/></button>
                    </div>
                    <div className="space-y-6">
                        <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BŁĄD W UMIEJĘTNOŚCI</span><h3 className="font-black text-2xl text-slate-900 tracking-tighter uppercase">{skill?.name_pl || 'Nieznana'}</h3></div>
                        
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DATA I GODZINA</p>
                                <p className="font-bold text-slate-900 text-xs">{new Date(selectedIncident.date).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ZGŁOSIŁ</p>
                                <p className="font-bold text-slate-900 text-xs">{selectedIncident.reported_by}</p>
                            </div>
                        </div>

                        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">OPIS INCYDENTU</p><p className="text-sm text-slate-700 bg-blue-50/30 p-5 rounded-2xl border border-blue-100/50 italic leading-relaxed shadow-inner">"{selectedIncident.description}"</p></div>
                        {urls.length > 0 && (<div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">DOKUMENTACJA ({urls.length})</p><div className="grid grid-cols-2 gap-3">{urls.map((url, i) => (<div key={i} className="rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-200 cursor-pointer hover:border-blue-500 transition-all shadow-sm h-32" onClick={() => setFileViewer({isOpen: true, urls, title: 'Dowód Jakości', index: i})}><img src={url} alt="Proof" className="w-full h-full object-cover"/></div>))}</div></div>)}
                    </div>
                </div>
            </div>
        );
    };

    const openFileViewer = (doc: any) => {
        const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
        setFileViewer({ isOpen: true, urls, title: doc.custom_name || 'Uprawnienie', index: 0 });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Lista Pracowników</h1>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" placeholder="Szukaj pracownika..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={search} onChange={e => setSearch(e.target.value)}/></div>
                <select className="border rounded-lg p-2 bg-slate-50 text-sm font-bold" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}><option value="all">Wszystkie statusy</option><option value="trial">Okres próbny</option><option value="employee">Pracownik</option></select>
                <select className="border rounded-lg p-2 bg-slate-50 text-sm font-bold" value={brigadirFilter} onChange={e => setBrigadirFilter(e.target.value)}><option value="all">Wszyscy Brygadziści</option>{brigadirs.map(b => <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>)}</select>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr><th className="p-4">Pracownik</th><th className="p-4">Stanowisko</th><th className="p-4">Stawka</th><th className="p-4">Okres Umowy</th><th className="p-4 text-right"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredEmployees.map(u => {
                            // Calculate current rate for the table row
                            const employeeSkills = userSkills.filter(us => us.user_id === u.id);
                            const salaryInfo = calculateSalary(
                                u.base_rate || systemConfig.baseRate,
                                skills,
                                employeeSkills,
                                monthlyBonuses[u.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
                                new Date(),
                                qualityIncidents
                            );
                            const contractBonus = systemConfig.contractBonuses[u.contract_type || ContractType.UOP] || 0;
                            const studentBonus = (u.contract_type === ContractType.UZ && u.is_student) ? 3 : 0;
                            const totalRate = salaryInfo.total + contractBonus + studentBonus;

                            return (
                                <tr key={u.id} className="hover:bg-slate-50 cursor-pointer group" onClick={() => handleOpenDetail(u)}>
                                    <td className="p-4 flex items-center gap-3"><div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">{u.first_name[0]}{u.last_name[0]}</div><div className="font-bold text-slate-900">{u.first_name} {u.last_name}</div></td>
                                    <td className="p-4 text-slate-600 font-medium">{u.target_position || '-'}</td>
                                    <td className="p-4 font-black text-slate-900">{totalRate.toFixed(2)} zł/h</td>
                                    <td className="p-4 text-slate-500 text-xs font-bold">
                                        {u.hired_date?.split('T')[0] || '-'} — {u.contract_end_date?.split('T')[0] || 'brak'}
                                    </td>
                                    <td className="p-4 text-right"><ChevronRight size={18} className="text-slate-300 group-hover:text-blue-600 inline transition-all transform group-hover:translate-x-1"/></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {renderModalContent()}
            {renderIncidentDetailModal()}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
        </div>
    );
};

// --- COORDINATOR VERIFICATIONS PAGE (1:1 LIKE BRIGADIR VIEW) ---
export const CoordinatorVerifications = () => {
    const { state, confirmSkillPractice, saveSkillChecklistProgress, updateUserSkillStatus, triggerNotification } = useAppContext();
    const { userSkills, users, skills, libraryResources, currentUser } = state;
    const location = useLocation();
    
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('pending');
    const [periodFilter, setPeriodFilter] = useState<'all' | 'trial' | 'regular'>('all');
    const [skillFilter, setSkillFilter] = useState('all');

    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [checklistState, setChecklistState] = useState<Record<number, ChecklistItemState>>({});
    const [rejectReason, setRejectReason] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [activeChecklistId, setActiveChecklistId] = useState<number | null>(null);

    useEffect(() => {
        if (location.state && location.state.search) {
            setSearch(location.state.search);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const getBrigadirName = (brigadirId?: string) => {
        const b = users.find(u => u.id === brigadirId);
        return b ? `${b.first_name} ${b.last_name}` : '-';
    };

    const verificationTasks = useMemo(() => {
        let items = userSkills.filter(us => {
            const skill = skills.find(s => s.id === us.skill_id);
            if (!skill || skill.verification_type !== VerificationType.THEORY_PRACTICE) return false;
            
            const user = users.find(u => u.id === us.user_id);
            if (!user || user.role === Role.CANDIDATE) return false;

            // Status Filter Logic
            const isPending = us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING;
            if (statusFilter === 'pending' && !isPending) return false;
            if (statusFilter === 'confirmed' && us.status !== SkillStatus.CONFIRMED) return false;
            if (statusFilter === 'rejected' && us.status !== SkillStatus.FAILED) return false;

            return true;
        });

        return items.map(us => {
            const user = users.find(u => u.id === us.user_id);
            const skill = skills.find(s => s.id === us.skill_id);
            const isTrial = user?.status === UserStatus.TRIAL;

            const template = CHECKLIST_TEMPLATES.find(t => t.skill_id === skill?.id);
            const totalCount = template ? template.items.length : (skill?.criteria?.length || 0);
            const completedCount = us.status === SkillStatus.CONFIRMED ? totalCount : (us.checklist_progress ? Object.values(us.checklist_progress).filter((i: any) => i.checked).length : 0);

            let displayStatus = 'Oczekuje';
            if (us.status === SkillStatus.CONFIRMED) displayStatus = 'Zatwierdzony';
            else if (us.status === SkillStatus.FAILED) displayStatus = 'Odrzucony';
            else if (completedCount > 0) displayStatus = 'W toku';

            return {
                ...us,
                user,
                skill,
                isTrial,
                stage: isTrial ? 'Okres Próbny' : 'Pracownik',
                displayStatus,
                progressLabel: `${completedCount}/${totalCount}`,
                completedCount,
                totalCount,
                brigadirName: getBrigadirName(user?.assigned_brigadir_id)
            };
        }).filter(item => {
            if (periodFilter === 'trial' && !item.isTrial) return false;
            if (periodFilter === 'regular' && item.isTrial) return false;
            if (skillFilter !== 'all' && item.skill?.id !== skillFilter) return false;

            const term = search.toLowerCase();
            return item.user?.first_name.toLowerCase().includes(term) || 
                   item.user?.last_name.toLowerCase().includes(term) ||
                   item.skill?.name_pl.toLowerCase().includes(term);
        });
    }, [userSkills, users, skills, statusFilter, periodFilter, skillFilter, search]);

    const getChecklist = (skillId: string) => {
        const template = CHECKLIST_TEMPLATES.find(t => t.skill_id === skillId);
        if (template) return template.items;
        const skill = skills.find(s => s.id === skillId);
        return skill?.criteria?.map((c, i) => ({ id: i, text_pl: c, required: true })) || [];
    };

    const handleOpenCheck = (item: any) => {
        setSelectedItem(item);
        setChecklistState(item.checklist_progress || {});
        setRejectReason('');
    };

    const toggleCheck = (id: number) => {
        if (selectedItem?.status === SkillStatus.CONFIRMED) return;
        setChecklistState(prev => {
            const current = prev[id] || { checked: false };
            return { ...prev, [id]: { ...current, checked: !current.checked } };
        });
    };

    const handleCameraClick = (itemId: number) => {
        if (selectedItem?.status === SkillStatus.CONFIRMED) return;
        setActiveChecklistId(itemId);
        cameraInputRef.current?.click();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeChecklistId !== null && selectedItem) {
            setIsUploading(true);
            try {
                const url = await uploadDocument(file, selectedItem.user_id);
                if (url) {
                    setChecklistState(prev => ({
                        ...prev,
                        [activeChecklistId]: { ...prev[activeChecklistId], image_url: url, checked: true }
                    }));
                }
            } catch (error) {
                console.error("Verification upload error", error);
                alert("Błąd przesłania zdjęcia.");
            } finally {
                setIsUploading(false);
            }
        }
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleSaveProgress = () => {
        if (!selectedItem) return;
        saveSkillChecklistProgress(selectedItem.id, checklistState);
        setSelectedItem(null);
    };

    const handleApprove = () => {
        if (!selectedItem || !currentUser) return;
        saveSkillChecklistProgress(selectedItem.id, checklistState);
        confirmSkillPractice(selectedItem.id, currentUser.id);
        triggerNotification('status_change', 'Umiejętność Zaliczona', `Koordynator ${currentUser.first_name} potwierdził umiejętność ${selectedItem.skill?.name_pl} dla ${selectedItem.user?.first_name}.`, '/dashboard/skills');
        setSelectedItem(null);
    };

    const handleReject = () => {
        if (!selectedItem || !rejectReason) {
            alert('Wymagany jest komentarz przy odrzuceniu.');
            return;
        }
        updateUserSkillStatus(selectedItem.id, SkillStatus.FAILED, rejectReason);
        triggerNotification('status_change', 'Umiejętność Odrzucona', `Koordynator odrzucił weryfikację ${selectedItem.skill?.name_pl}. Powód: ${rejectReason}`, '/dashboard/skills');
        setSelectedItem(null);
    };

    const currentChecklist = selectedItem ? getChecklist(selectedItem.skill_id) : [];
    const isReadyToApprove = currentChecklist.length > 0 && currentChecklist.every((c: any) => checklistState[c.id]?.checked);

    const uniqueSkills = useMemo(() => {
        const ids = new Set(userSkills.map(us => us.skill_id));
        return skills.filter(s => ids.has(s.id));
    }, [userSkills, skills]);

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Weryfikacje Praktyczne</h1>
                    <p className="text-slate-500">Kolejka zadań do potwierdzenia na budowie.</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                    <CheckSquare size={18} className="text-blue-600"/>
                    <span className="font-bold text-slate-700">{verificationTasks.filter(t => t.displayStatus !== 'Zatwierdzony').length}</span>
                    <span className="text-slate-500 text-sm">oczekujących</span>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative w-full lg:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Szukaj pracownika..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2 w-full lg:w-auto flex-1">
                    <div className="relative"><select className="appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}><option value="pending">Oczekujące</option><option value="confirmed">Zatwierdzone</option><option value="rejected">Odrzucone</option><option value="all">Wszystkie</option></select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/></div>
                    <div className="relative"><select className="appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as any)}><option value="all">Etap: Wszystkie</option><option value="trial">Okres Próbny</option><option value="regular">Pracownik</option></select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/></div>
                    <div className="relative"><select className="appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}><option value="all">Umiejętność: Wszystkie</option>{uniqueSkills.map(s => (<option key={s.id} value={s.id}>{s.name_pl}</option>))}</select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/></div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Pracownik</th>
                            <th className="px-6 py-4">Kategoria</th>
                            <th className="px-6 py-4">Umiejętność</th>
                            <th className="px-6 py-4">Etap</th>
                            <th className="px-6 py-4">Brygadzista</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 font-bold">Postęp</th>
                            <th className="px-6 py-4 text-right">Akcja</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {verificationTasks.map(task => (
                            <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{task.user?.first_name[0]}{task.user?.last_name[0]}</div><div><div className="font-medium text-slate-900">{task.user?.first_name} {task.user?.last_name}</div><div className="text-xs text-slate-500">{task.user?.target_position || 'Pracownik'}</div></div></div></td>
                                <td className="px-6 py-4 text-slate-600 font-medium uppercase text-xs tracking-tight">{task.skill?.category}</td>
                                <td className="px-6 py-4 font-bold text-slate-700">{task.skill?.name_pl}</td>
                                <td className="px-6 py-4">{task.isTrial ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">Okres Próbny</span> : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-50 text-blue-700 border border-blue-200">Pracownik</span>}</td>
                                <td className="px-6 py-4 text-slate-700 font-medium">{task.brigadirName}</td>
                                <td className="px-6 py-4">{task.displayStatus === 'Zatwierdzony' && <span className="flex items-center gap-1 text-green-600 font-bold text-xs uppercase bg-green-50 px-2 py-1 rounded border border-green-100 w-fit"><CheckCircle size={12}/> Zatwierdzony</span>}{task.displayStatus === 'Odrzucony' && <span className="flex items-center gap-1 text-red-600 font-bold text-xs uppercase bg-red-50 px-2 py-1 rounded border border-red-100 w-fit"><XCircle size={12}/> Odrzucony</span>}{task.displayStatus === 'W toku' && <span className="flex items-center gap-1 text-blue-600 font-bold text-xs uppercase bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit"><Clock size={12}/> W toku</span>}{task.displayStatus === 'Oczekuje' && <span className="flex items-center gap-1 text-slate-500 font-bold text-xs uppercase bg-slate-100 px-2 py-1 rounded border border-slate-200 w-fit"><Clock size={12}/> Oczekuje</span>}</td>
                                <td className="px-6 py-4 font-bold text-slate-700">{task.progressLabel}</td>
                                <td className="px-6 py-4 text-right"><Button size="sm" onClick={() => handleOpenCheck(task)}>{task.displayStatus === 'Zatwierdzony' ? 'Szczegóły' : 'Weryfikuj'}</Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedItem && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">{selectedItem.skill?.name_pl}</h2>
                                    <p className="text-sm text-slate-500">{selectedItem.skill?.description_pl || 'Weryfikacja kompetencji praktycznych'}</p>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">{selectedItem.user?.first_name[0]}{selectedItem.user?.last_name[0]}</div>
                                    <span className="font-bold text-slate-800">{selectedItem.user?.first_name} {selectedItem.user?.last_name}</span>
                                </div>
                                <div className="flex items-center gap-2 border-l pl-6">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Bonus</span>
                                    <span className="text-lg font-black text-green-600 bg-green-50 px-3 py-0.5 rounded border border-green-100">+{selectedItem.skill?.hourly_bonus} zł/h</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
                            {isUploading && (
                                <div className="p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2 text-sm font-medium animate-pulse mb-4">
                                    <Loader2 size={16} className="animate-spin"/> Przesyłanie zdjęcia...
                                </div>
                            )}

                            <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-4">Postęp weryfikacji i dokumentacja</h4>
                            <div className="space-y-2 bg-white border rounded-xl overflow-hidden shadow-sm">
                                {getChecklist(selectedItem.skill_id).map((c: any) => {
                                    const state = checklistState[c.id];
                                    return (
                                        <div key={c.id} className={`flex items-center justify-between p-4 border-b last:border-0 hover:bg-slate-50 transition-colors ${state?.checked ? 'bg-blue-50/10' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <input type="checkbox" checked={!!state?.checked} onChange={() => toggleCheck(c.id)} className="w-5 h-5 rounded text-blue-600 cursor-pointer" disabled={selectedItem.status === SkillStatus.CONFIRMED} />
                                                <span className={`text-sm ${state?.checked ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>{c.text_pl}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {state?.image_url ? (
                                                    <div className="relative group cursor-pointer" onClick={() => setFileViewer({isOpen: true, urls: [state.image_url!], title: 'Dowód', index: 0})}>
                                                        <img src={state.image_url} alt="Foto" className="w-10 h-10 object-cover rounded border border-slate-200 shadow-sm" />
                                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded"><Eye size={14} className="text-white"/></div>
                                                    </div>
                                                ) : (
                                                    <Button size="sm" variant="secondary" className="h-9 text-xs" onClick={() => handleCameraClick(c.id)} disabled={selectedItem.status === SkillStatus.CONFIRMED || isUploading}>
                                                        <Camera size={14} className="mr-2"/> Foto
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-6">
                                <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-2">Komentarz</h4>
                                <textarea className="w-full border p-3 rounded-xl text-sm h-24 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white" placeholder="Opcjonalne uwagi..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} disabled={selectedItem.status === SkillStatus.CONFIRMED}/>
                            </div>
                            <input type="file" min-h-0 ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} />
                        </div>
                        <div className="p-6 border-t bg-white flex justify-between gap-4">
                            <Button variant="danger" onClick={handleReject} disabled={!rejectReason || selectedItem.status === SkillStatus.CONFIRMED}>Odrzuć</Button>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={handleSaveProgress} disabled={selectedItem.status === SkillStatus.CONFIRMED}>
                                    <Save size={18} className="mr-2"/> Zapisz postęp
                                </Button>
                                <Button onClick={handleApprove} className="bg-blue-600 hover:bg-blue-700 px-8" disabled={!isReadyToApprove || selectedItem.status === SkillStatus.CONFIRMED || isUploading}>
                                    <CheckCircle size={18} className="mr-2"/> Zatwierdź
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
        </div>
    );
};

// --- COORDINATOR QUALITY PAGE ---
export const CoordinatorQuality = () => {
    const { state } = useAppContext();
    const { qualityIncidents, users, skills } = state;
    const [search, setSearch] = useState('');
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });
    const location = useLocation();

    // Read/Unread tracking
    const [readIncidents, setReadIncidents] = useState<Set<string>>(() => {
        const stored = localStorage.getItem('coordinator_read_incidents');
        return stored ? new Set(JSON.parse(stored)) : new Set();
    });

    useEffect(() => {
        localStorage.setItem('coordinator_read_incidents', JSON.stringify(Array.from(readIncidents)));
    }, [readIncidents]);

    // Handle incoming navigation state (from Dashboard)
    useEffect(() => {
        if (location.state && location.state.search) {
            setSearch(location.state.search);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const filteredIncidents = useMemo(() => {
        return qualityIncidents.filter(inc => {
            const user = users.find(u => u.id === inc.user_id);
            const skill = skills.find(s => s.id === inc.skill_id);
            const term = search.toLowerCase();
            return (user?.first_name.toLowerCase().includes(term) || 
                    user?.last_name.toLowerCase().includes(term) ||
                    skill?.name_pl.toLowerCase().includes(term));
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [qualityIncidents, users, skills, search]);

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Historia Jakości - Wszystkie Zespoły</h1>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex items-center">
                <Search className="text-slate-400 mr-2" size={20}/>
                <input 
                    type="text" 
                    placeholder="Szukaj po pracowniku lub umiejętności..." 
                    className="flex-1 bg-transparent outline-none text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4"></th>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Pracownik</th>
                            <th className="px-6 py-4">Umiejętność</th>
                            <th className="px-6 py-4">Zgłosił</th>
                            <th className="px-6 py-4">Foto</th>
                            <th className="px-6 py-4 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredIncidents.map(inc => {
                            const user = users.find(u => u.id === inc.user_id);
                            const skill = skills.find(s => s.id === inc.skill_id);
                            const urls = inc.image_urls || (inc.image_url ? [inc.image_url] : []);
                            const isUnread = inc.id && !readIncidents.has(inc.id);

                            const handleRowClick = () => {
                                if (inc.id && !readIncidents.has(inc.id)) {
                                    setReadIncidents(prev => new Set([...prev, inc.id!]));
                                }
                            };

                            return (
                                <tr key={inc.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${isUnread ? 'bg-blue-50' : ''}`} onClick={handleRowClick}>
                                    <td className="px-6 py-4">
                                        {isUnread && (
                                            <Circle size={10} className="fill-blue-600 text-blue-600" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{new Date(inc.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900">{user?.first_name} {user?.last_name}</td>
                                    <td className="px-6 py-4 text-slate-700">{skill?.name_pl}</td>
                                    <td className="px-6 py-4 text-slate-500">{inc.reported_by}</td>
                                    <td className="px-6 py-4">
                                        {urls.length > 0 ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFileViewer({isOpen: true, urls, title: `Dowód - ${skill?.name_pl}`, index: 0});
                                                }}
                                                className="flex items-center gap-1 text-blue-600 hover:underline font-bold"
                                            >
                                                <ImageIcon size={16}/> {urls.length}
                                            </button>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {inc.incident_number >= 2 ?
                                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200 uppercase">Blokada</span> :
                                            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200 uppercase">Ostrzeżenie</span>
                                        }
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredIncidents.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-slate-400 italic">
                                    Brak zgłoszeń jakościowych.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
        </div>
    );
};

// --- COORDINATOR SKILLS PAGE ---
export const CoordinatorSkills = () => <EmployeeSkills />;

// --- COORDINATOR LIBRARY PAGE ---
export const CoordinatorLibrary = () => <EmployeeLibrary />;

// --- COORDINATOR PROFILE PAGE ---
export const CoordinatorProfile = () => <CandidateProfilePage />;
