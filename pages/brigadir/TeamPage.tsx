
import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Users, Phone, Mail, Award, CheckSquare, Clock, AlertTriangle, 
    Lock, CheckCircle, TrendingUp, Calendar, ChevronRight, User as UserIcon,
    /* Added StickyNote and Info to fix find name errors */
    X, MessageSquare, Trash2, Star, Shield, Eye, MapPin, Plus, Upload, Camera, Loader2, Image as ImageIcon,
    Briefcase, HardHat, Wallet, Cake, ShieldAlert as ShieldAlertIcon, Save, FileText, StickyNote, Info
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { UserStatus, SkillStatus, VerificationType, User, QualityIncident, ContractType, Role } from '../../types';
import { USER_STATUS_LABELS, CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES, SKILL_STATUS_LABELS } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';
import { calculateSalary } from '../../services/salaryService';

export const BrigadirTeamPage = () => {
    const { state, addEmployeeNote, deleteEmployeeNote, addEmployeeBadge, deleteEmployeeBadge, addQualityIncident, triggerNotification } = useAppContext();
    const { currentUser, users, userSkills, skills, qualityIncidents, employeeNotes, employeeBadges, systemConfig, monthlyBonuses } = state;
    const navigate = useNavigate();

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'rate' | 'skills' | 'docs' | 'quality' | 'notes' | 'badges'>('info');

    // Modals
    const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
    const [isQualityAddModalOpen, setIsQualityAddModalOpen] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<QualityIncident | null>(null);

    // Form states
    const [isUploading, setIsUploading] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [noteCategory, setNoteCategory] = useState<string>(systemConfig.noteCategories[0] || 'Ogólna');
    const [badgeType, setBadgeType] = useState<string>(systemConfig.badgeTypes[0] || 'Jakość');
    const [badgeDesc, setBadgeDesc] = useState('');
    const [badgeDate, setBadgeDate] = useState(new Date().toISOString().split('T')[0]);

    // Quality Add Form states
    const [newIncidentSkillId, setNewIncidentSkillId] = useState('');
    const [newIncidentDesc, setNewIncidentDesc] = useState('');
    const [newIncidentImages, setNewIncidentImages] = useState<string[]>([]);
    
    // File Viewer
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    const incidentCameraRef = useRef<HTMLInputElement>(null);

    const myTeamData = useMemo(() => {
        if (!currentUser) return [];
        const team = users.filter(u => u.assigned_brigadir_id === currentUser.id && u.status !== UserStatus.INACTIVE && ![Role.ADMIN, Role.COMPANY_ADMIN].includes(u.role));
        
        return team.map(u => {
            const memberSkills = userSkills.filter(us => us.user_id === u.id);
            const practicalSkills = memberSkills.filter(us => {
                const s = skills.find(sk => sk.id === us.skill_id);
                return s?.verification_type === VerificationType.THEORY_PRACTICE;
            });
            const total = practicalSkills.length;
            const confirmed = practicalSkills.filter(us => us.status === SkillStatus.CONFIRMED).length;
            return {
                user: u,
                progress: { confirmed, total }
            };
        });
    }, [currentUser, users, userSkills, skills]);

    const handleGoToVerifications = (user: User) => {
        navigate('/brigadir/checks', { state: { filterUser: user.id, filterName: user.last_name } });
    };

    const getBossLabel = (user: User) => user.role === Role.BRIGADIR ? 'Koordynator:' : 'Brygadzista:';
    const getBossName = (id?: string) => { const b = users.find(u => u.id === id); return b ? `${b.first_name} ${b.last_name}` : '-'; };
    const getAuthorName = (id: string) => { const u = users.find(x => x.id === id); return u ? `${u.first_name} ${u.last_name}` : 'System'; };

    const handleSaveNote = () => {
        if (!selectedUser || !noteText || !currentUser) return;
        addEmployeeNote({ employee_id: selectedUser.id, author_id: currentUser.id, category: noteCategory, text: noteText });
        setNoteText('');
    };

    const handleSaveBadge = () => {
        if (!selectedUser || !badgeDesc || !currentUser) return;
        addEmployeeBadge({ employee_id: selectedUser.id, author_id: currentUser.id, month: badgeDate, type: badgeType, description: badgeDesc, visible_to_employee: true });
        setBadgeDesc('');
    };

    const handleSaveIncident = () => {
        if (!selectedUser || !newIncidentSkillId || !newIncidentDesc || !currentUser) return;
        const now = new Date();
        const existingCount = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === selectedUser.id && inc.skill_id === newIncidentSkillId && d.getMonth() === now.getMonth();
        }).length;

        addQualityIncident({
            user_id: selectedUser.id,
            skill_id: newIncidentSkillId,
            date: new Date().toISOString(),
            incident_number: existingCount + 1,
            description: newIncidentDesc,
            reported_by: `${currentUser.first_name} ${currentUser.last_name}`,
            image_urls: newIncidentImages,
            image_url: newIncidentImages[0] || undefined
        });

        setIsQualityAddModalOpen(false);
        setNewIncidentSkillId('');
        setNewIncidentDesc('');
        setNewIncidentImages([]);
    };

    const handleIncidentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0 && selectedUser) {
            setIsUploading(true);
            try {
                const uploadedUrls: string[] = [];
                for (let i = 0; i < files.length; i++) {
                    const url = await uploadDocument(files[i], selectedUser.id);
                    if (url) uploadedUrls.push(url);
                }
                setNewIncidentImages(prev => [...prev, ...uploadedUrls]);
            } finally { setIsUploading(false); }
        }
    };

    const renderModalContent = () => {
        if (!selectedUser) return null;
        
        const employeeSkillsList = userSkills.filter(us => us.user_id === selectedUser.id && !us.skill_id?.startsWith('doc_') && skills.find(s => s.id === us.skill_id)?.verification_type !== VerificationType.DOCUMENT);
        const employeeConfirmedSkills = employeeSkillsList.filter(es => es.status === SkillStatus.CONFIRMED);
        const employeeIncidents = qualityIncidents.filter(qi => qi.user_id === selectedUser.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const employeeNotesList = employeeNotes.filter(en => en.employee_id === selectedUser.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const employeeBadgesList = employeeBadges.filter(eb => eb.employee_id === selectedUser.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const salaryInfo = calculateSalary(
            selectedUser.base_rate || systemConfig.baseRate,
            skills,
            userSkills.filter(us => us.user_id === selectedUser.id),
            monthlyBonuses[selectedUser.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
            new Date(),
            qualityIncidents
        );

        const contractBonus = systemConfig.contractBonuses[selectedUser.contract_type || ContractType.UOP] || 0;
        const studentBonus = (selectedUser.contract_type === ContractType.UZ && selectedUser.is_student) ? 3 : 0;
        const currentTotalRate = salaryInfo.total + contractBonus + studentBonus;
        const nextMonthTotalRate = salaryInfo.nextMonthTotal + contractBonus + studentBonus;

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedUser(null)}>
                <div className="bg-white rounded-[32px] shadow-2xl max-w-4xl w-full flex flex-col max-h-[95vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white relative">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-100 ring-4 ring-blue-50">
                                {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{selectedUser.first_name} {selectedUser.last_name}</h2>
                                    <span className={`px-2 py-0.5 text-[9px] rounded-full font-black uppercase tracking-widest border ${selectedUser.status === UserStatus.TRIAL ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                        {USER_STATUS_LABELS[selectedUser.status]}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                                    <span className="flex items-center gap-1"><Briefcase size={12}/> {selectedUser.target_position || 'Monter'}</span>
                                    <span className="text-slate-200">|</span>
                                    <span className="flex items-center gap-1"><HardHat size={12}/> {getBossLabel(selectedUser)} {getBossName(selectedUser.assigned_brigadir_id)}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedUser(null)} className="text-slate-300 hover:text-slate-500 transition-colors p-2 hover:bg-slate-50 rounded-full">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Navigation */}
                    <div className="px-4 bg-white border-b border-slate-50 py-2 flex gap-0.5 overflow-x-auto scrollbar-hide justify-start">
                        {[
                            { id: 'info', label: 'DANE', icon: UserIcon },
                            { id: 'rate', label: 'STAWKA', icon: Wallet },
                            { id: 'skills', label: 'MATRYCA', icon: Award },
                            { id: 'docs', label: 'UPRAWNIENIA', icon: FileText },
                            { id: 'quality', label: 'JAKOŚĆ', icon: AlertTriangle, badge: employeeIncidents.length || null },
                            /* Added StickyNote icon fixed import above */
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
                                {tab.badge && <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${activeTab === tab.id ? 'bg-white text-blue-600' : 'bg-red-50 text-white'}`}>{tab.badge}</span>}
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
                                            <div><p className="text-[9px] font-black text-slate-400 uppercase">TELEFON</p><p className="font-bold text-slate-800 text-sm">{selectedUser.phone || '-'}</p></div>
                                        </div>
                                        <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><Mail size={18}/></div>
                                            <div className="truncate flex-1"><p className="text-[9px] font-black text-slate-400 uppercase">EMAIL</p><p className="font-bold text-slate-800 text-sm truncate">{selectedUser.email}</p></div>
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
                                            <div><p className="text-[9px] font-black text-slate-400 uppercase">URODZONY</p><p className="font-bold text-slate-800 text-sm">{selectedUser.birth_date || 'Nie podano'}</p></div>
                                        </div>
                                        <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><MapPin size={18}/></div>
                                            <div className="truncate flex-1"><p className="text-[9px] font-black text-slate-400 uppercase">ADRES</p><p className="font-bold text-slate-800 text-xs truncate">{selectedUser.city}, {selectedUser.street} {selectedUser.house_number}</p></div>
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
                                        {/* Added Info icon fixed import above */}
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
                                        {/* Added Info icon fixed import above */}
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
                                            {systemConfig.noteCategories.map(c => (
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
                                            <select className="bg-white border border-yellow-100 p-2 rounded-xl text-xs font-bold appearance-none" value={badgeType} onChange={e => setBadgeType(e.target.value)}>
                                                {systemConfig.badgeTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
                                {userSkills.filter(us => us.user_id === selectedUser.id && (us.skill_id?.startsWith('doc_') || !!us.custom_type || skills.find(s => s.id === us.skill_id)?.verification_type === VerificationType.DOCUMENT)).map(us => {
                                    const skill = skills.find(s => s.id === us.skill_id);
                                    return (
                                        <div key={us.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm"><Shield size={20}/></div>
                                                <div><p className="font-bold text-slate-800 text-xs uppercase">{us.custom_name || skill?.name_pl || 'Uprawnienie'}</p><p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{us.is_indefinite ? 'Bezterminowo' : `Do: ${us.expires_at || '-'}`}</p></div>
                                            </div>
                                            <button onClick={() => setFileViewer({ isOpen: true, urls: us.document_urls || [us.document_url!], title: us.custom_name || 'Uprawnienie', index: 0 })} className="p-2 text-slate-400 hover:text-blue-600"><Eye size={20}/></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <Button onClick={() => setSelectedUser(null)} className="px-10 rounded-2xl font-black uppercase tracking-widest h-11 shadow-xl shadow-slate-200">Zamknij Profil</Button>
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

                {/* Quality Add Modal - Compact */}
                {isQualityAddModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsQualityAddModalOpen(false)}>
                        <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                            <div className="bg-red-600 p-6 flex justify-between items-center text-white"><div className="flex items-center gap-3"><div className="p-2 bg-white/20 rounded-xl"><ShieldAlertIcon size={24}/></div><div><h2 className="text-xl font-black uppercase tracking-tight">Zgłoś błąd</h2><p className="text-[10px] font-black text-red-100 uppercase tracking-widest mt-0.5">{selectedUser.first_name} {selectedUser.last_name}</p></div></div><button onClick={() => setIsQualityAddModalOpen(false)} className="text-red-100 hover:text-white"><X size={24}/></button></div>
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

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Mój Zespół</h1>
                    <p className="text-slate-500">Zarządzanie pracownikami, postępem i jakością.</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                    <Users size={18} className="text-blue-600"/>
                    <span className="font-bold text-slate-700">{myTeamData.length}</span>
                    <span className="text-slate-500 text-sm">osób</span>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Pracownik</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Postęp Praktyki</th>
                            <th className="px-6 py-4 text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {myTeamData.map((item) => (
                            <tr key={item.user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                            {item.user.first_name[0]}{item.user.last_name[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{item.user.first_name} {item.user.last_name}</div>
                                            <div className="text-xs text-slate-500">{item.user.target_position || 'Pracownik'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {item.user.status === UserStatus.TRIAL ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                            Okres Próbny
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                            Pracownik
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Award size={16} className="text-blue-500"/>
                                        <span className="font-medium text-slate-700">{item.progress.confirmed} / {item.progress.total}</span>
                                    </div>
                                    <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-blue-500 h-full" 
                                            style={{ width: `${item.progress.total > 0 ? (item.progress.confirmed / item.progress.total) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            className="text-xs h-8 px-3"
                                            onClick={() => { setSelectedUser(item.user); setActiveTab('info'); }}
                                        >
                                            Profil
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            className="text-xs h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={() => handleGoToVerifications(item.user)}
                                        >
                                            Weryfikacje
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {renderModalContent()}
            {renderIncidentDetailModal()}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
            <input type="file" multiple className="hidden" ref={incidentCameraRef} accept="image/*" onChange={handleIncidentImageUpload}/>
        </div>
    );
};
