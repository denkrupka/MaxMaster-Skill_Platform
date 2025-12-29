
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Users, CheckSquare, AlertTriangle, Award, BookOpen, User as UserIcon, 
    Search, Filter, ChevronDown, Eye, MessageSquare, ArrowRight,
    MapPin, Calendar, HardHat, CheckCircle, Clock, XCircle, Shield,
    FileText, Paperclip, Camera, Plus, Save, Trash2, Lock, ShieldAlert,
    Video, Layers, ChevronUp, Play, List, X, Link as LinkIcon, Folder, Briefcase, Star, Lightbulb, Image as ImageIcon, Type, Wallet, TrendingUp, Info,
    ChevronRight,
    StickyNote,
    Upload
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Role, UserStatus, User, SkillStatus, VerificationType, ChecklistItemState, VerificationAttachment, VerificationNote, VerificationLog, NoteCategory, NoteSeverity, QualityIncident, LibraryResource, SkillCategory, ContractType, BadgeType } from '../../types';
import { USER_STATUS_LABELS, USER_STATUS_COLORS, SKILL_STATUS_LABELS, CHECKLIST_TEMPLATES } from '../../constants';
import { Button } from '../../components/Button';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { CandidateProfilePage } from '../candidate/Profile';
import { EmployeeSkills } from '../employee/Skills';
import { EmployeeLibrary } from '../employee/Library';
import { calculateSalary } from '../../services/salaryService';

// --- EMPLOYEES PAGE ---
export const CoordinatorEmployees = () => {
    const { state, addEmployeeNote, addQualityIncident } = useAppContext();
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

    // Local state for new note
    const [noteText, setNoteText] = useState('');
    const [noteCategory, setNoteCategory] = useState<NoteCategory>(NoteCategory.GENERAL);

    // Local state for new quality incident
    const [isAddingIncident, setIsAddingIncident] = useState(false);
    const [newIncidentSkillId, setNewIncidentSkillId] = useState('');
    const [newIncidentDesc, setNewIncidentDesc] = useState('');
    const [newIncidentImage, setNewIncidentImage] = useState('');
    const incidentCameraRef = useRef<HTMLInputElement>(null);

    // Handle deep links from dashboard
    useEffect(() => {
        if (location.state && location.state.brigadirId) {
            setBrigadirFilter(location.state.brigadirId);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const brigadirs = users.filter(u => u.role === Role.BRIGADIR && u.status === UserStatus.ACTIVE);
    const filteredEmployees = useMemo(() => {
        return users.filter(u => {
            if (u.role === Role.CANDIDATE) return false;
            if ([Role.ADMIN, Role.HR, Role.COORDINATOR].includes(u.role)) return false;
            const searchLower = search.toLowerCase();
            const matchesSearch = u.first_name.toLowerCase().includes(searchLower) || u.last_name.toLowerCase().includes(searchLower);
            let matchesStatus = true;
            if (statusFilter === 'trial') matchesStatus = u.status === UserStatus.TRIAL;
            if (statusFilter === 'employee') matchesStatus = u.status !== UserStatus.TRIAL && u.status !== UserStatus.INACTIVE;
            let matchesBrigadir = true;
            if (brigadirFilter !== 'all') matchesBrigadir = u.assigned_brigadir_id === brigadirFilter;
            return matchesSearch && matchesStatus && matchesBrigadir;
        });
    }, [users, search, statusFilter, brigadirFilter]);

    const getBrigadirName = (id?: string) => { const b = users.find(u => u.id === id); return b ? `${b.first_name} ${b.last_name}` : '-'; };
    const handleOpenDetail = (user: User, tab: 'info' | 'rate' | 'skills' | 'docs' | 'quality' | 'notes' | 'badges' = 'info') => { setSelectedEmployee(user); setActiveTab(tab); setIsAddingIncident(false); };

    const handleSaveNote = () => {
        if (!selectedEmployee || !noteText || !currentUser) return;
        addEmployeeNote({
            employee_id: selectedEmployee.id,
            author_id: currentUser.id,
            category: noteCategory,
            text: noteText
        });
        setNoteText('');
        setNoteCategory(NoteCategory.GENERAL);
    };

    const handleSaveIncident = () => {
        if (!selectedEmployee || !newIncidentSkillId || !newIncidentDesc || !currentUser) return;
        
        const now = new Date();
        const existingCount = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === selectedEmployee.id && 
                   inc.skill_id === newIncidentSkillId &&
                   d.getMonth() === now.getMonth() &&
                   d.getFullYear() === now.getFullYear();
        }).length;

        addQualityIncident({
            user_id: selectedEmployee.id,
            skill_id: newIncidentSkillId,
            date: new Date().toISOString(),
            incident_number: existingCount + 1,
            description: newIncidentDesc,
            reported_by: `${currentUser.first_name} ${currentUser.last_name}`,
            image_url: newIncidentImage || undefined
        });

        setIsAddingIncident(false);
        setNewIncidentSkillId('');
        setNewIncidentDesc('');
        setNewIncidentImage('');
    };

    const renderModalContent = () => {
        if (!selectedEmployee) return null;
        
        const employeeSkills = userSkills.filter(us => us.user_id === selectedEmployee.id && !us.skill_id.startsWith('doc_') && skills.find(s => s.id === us.skill_id)?.verification_type !== VerificationType.DOCUMENT);
        const employeeConfirmedSkills = employeeSkills.filter(es => es.status === SkillStatus.CONFIRMED);
        const employeeDocs = userSkills.filter(us => us.user_id === selectedEmployee.id && (us.skill_id.startsWith('doc_') || skills.find(s => s.id === us.skill_id)?.verification_type === VerificationType.DOCUMENT));
        const employeeIncidents = qualityIncidents.filter(qi => qi.user_id === selectedEmployee.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const employeeNotesList = employeeNotes.filter(en => en.employee_id === selectedEmployee.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const employeeBadgesList = employeeBadges.filter(eb => eb.employee_id === selectedEmployee.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const now = new Date();
        const currentMonthName = now.toLocaleString('pl-PL', { month: 'long' });
        const nextMonthName = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleString('pl-PL', { month: 'long' });

        const salaryInfo = calculateSalary(
            selectedEmployee.base_rate || systemConfig.baseRate,
            skills,
            userSkills.filter(us => us.user_id === selectedEmployee.id),
            monthlyBonuses[selectedEmployee.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
            now,
            qualityIncidents
        );

        const contractBonus = systemConfig.contractBonuses[selectedEmployee.contract_type || ContractType.UOP] || 0;
        const studentBonus = (selectedEmployee.contract_type === ContractType.UZ && selectedEmployee.is_student) ? 3 : 0;
        const currentTotalRate = salaryInfo.total + contractBonus + studentBonus;
        const nextMonthTotalRate = salaryInfo.nextMonthTotal + contractBonus + studentBonus;

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedEmployee(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">{selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}</div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
                                <div className="flex gap-2 mt-1">
                                    <span className={`px-2 py-0.5 text-xs rounded border uppercase font-bold ${selectedEmployee.status === UserStatus.TRIAL ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                        {selectedEmployee.status === UserStatus.TRIAL ? 'OKRES PRÓBNY' : 'PRACOWNIK'}
                                    </span>
                                    <span className="px-2 py-0.5 text-xs rounded border bg-white border-slate-200 text-slate-600 uppercase font-bold">{selectedEmployee.target_position || selectedEmployee.role}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedEmployee(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><XCircle size={28} /></button>
                    </div>

                    {/* Tabs bar */}
                    <div className="flex border-b border-slate-200 bg-white overflow-x-auto min-h-[64px]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
                        <div className="flex px-6 h-full items-stretch">
                            {[
                                { id: 'info', label: 'Info' },
                                { id: 'rate', label: 'Stawka' },
                                { id: 'skills', label: 'Umiejętności' },
                                { id: 'docs', label: 'Uprawnienia' },
                                { id: 'quality', label: `Jakość (${employeeIncidents.length})` },
                                { id: 'notes', label: `Notatki (${employeeNotesList.length})` },
                                { id: 'badges', label: `Odznaki (${employeeBadgesList.length})` }
                            ].map(tab => (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)} 
                                    className={`px-5 text-sm font-bold border-b-4 transition-all whitespace-nowrap flex-shrink-0 flex items-center ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-8 overflow-y-auto flex-1 bg-white">
                        {activeTab === 'info' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2"><UserIcon size={18} className="text-blue-500"/> Dane Podstawowe</h3>
                                    <div className="space-y-4 text-sm">
                                        <div className="grid grid-cols-3 gap-2"><span className="text-slate-500">Email:</span><span className="col-span-2 font-medium text-slate-900">{selectedEmployee.email}</span></div>
                                        <div className="grid grid-cols-3 gap-2"><span className="text-slate-500">Telefon:</span><span className="col-span-2 font-medium text-slate-900">{selectedEmployee.phone || '-'}</span></div>
                                        <div className="grid grid-cols-3 gap-2"><span className="text-slate-500">Data zatrud.:</span><span className="col-span-2 font-medium text-slate-900">{selectedEmployee.hired_date}</span></div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2"><HardHat size={18} className="text-orange-500"/> Przypisania</h3>
                                    <div className="space-y-4 text-sm">
                                        <div className="grid grid-cols-3 gap-2"><span className="text-slate-500">Brygadzista:</span><span className="col-span-2 font-medium text-slate-900">{getBrigadirName(selectedEmployee.assigned_brigadir_id)}</span></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rate' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-slate-700 flex items-center gap-2 uppercase tracking-tighter">
                                                <Wallet size={20} className="text-green-600"/> STAWKA OBECNA
                                            </h3>
                                            <span className="text-xs font-bold uppercase bg-green-100 text-green-700 px-2 py-1 rounded">{currentMonthName}</span>
                                        </div>
                                        <div className="text-5xl font-extrabold text-slate-900 mb-2">{currentTotalRate.toFixed(2)}<span className="text-xl font-normal text-slate-400 ml-1">zł/h</span></div>
                                        <p className="text-xs text-slate-500">Stawka netto uwzględniająca aktywne bonusy i ewentualne blokady jakościowe.</p>
                                    </div>

                                    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 text-white relative overflow-hidden shadow-lg">
                                        <div className="absolute top-0 right-0 p-6 opacity-10"><TrendingUp size={100} /></div>
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-bold text-blue-300 flex items-center gap-2 uppercase tracking-tighter"><TrendingUp size={20}/> PROGNOZA</h3>
                                                <span className="text-xs font-bold uppercase bg-white/10 text-white px-2 py-1 rounded">OD 1. {nextMonthName.toUpperCase()}</span>
                                            </div>
                                            <div className="text-5xl font-extrabold mb-2">{nextMonthTotalRate.toFixed(2)}<span className="text-xl font-normal text-slate-400 ml-1">zł/h</span></div>
                                            <p className="text-xs text-slate-400">Prognoza zakłada odblokowanie incydentów i doliczenie nowo nabytych uprawnień.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs uppercase tracking-widest">Szczegóły składników wynagrodzenia</div>
                                    <div className="divide-y divide-slate-100">
                                        {salaryInfo.breakdown.details.activeSkills.map((s, i) => (
                                            <div key={i} className="px-5 py-4 flex justify-between items-center text-sm group hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    {s.isBlocked ? <Lock size={16} className="text-red-500"/> : <CheckCircle size={16} className="text-green-500"/>}
                                                    <span className={s.isBlocked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}>{s.name}</span>
                                                    {s.isBlocked && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold ml-2">BLOKADA JAKOŚCI</span>}
                                                </div>
                                                <span className={`font-bold tabular-nums ${s.isBlocked ? 'text-slate-300' : 'text-green-600'}`}>+{s.amount.toFixed(2)} zł</span>
                                            </div>
                                        ))}
                                        {salaryInfo.breakdown.details.pendingSkills.map((s, i) => (
                                            <div key={`p-${i}`} className="px-5 py-4 flex justify-between items-center text-sm bg-blue-50/40">
                                                <div className="flex items-center gap-3 text-blue-700">
                                                    <Clock size={16}/>
                                                    <span className="font-bold">{s.name}</span>
                                                    <span className="text-[10px] uppercase font-black tracking-tighter bg-blue-600 text-white px-1.5 py-0.5 rounded">NOWOŚĆ</span>
                                                </div>
                                                <span className="font-bold text-blue-600 tabular-nums">+{s.amount.toFixed(2)} zł</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'skills' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-tighter text-sm"><Award size={18} className="text-blue-500"/> Matryca Umiejętności Systemowych</h3>
                                <div className="border rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-3">Nazwa Umiejętności</th>
                                                <th className="px-6 py-3">Kategoria</th>
                                                <th className="px-6 py-3 text-right">Status Weryfikacji</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {employeeSkills.map(us => {
                                                const skill = skills.find(s => s.id === us.skill_id);
                                                if (!skill) return null;
                                                const isPending = us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING;
                                                return (
                                                    <tr key={us.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-900">{skill.name_pl}</td>
                                                        <td className="px-6 py-4 text-slate-500 font-medium text-xs">{skill.category}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button 
                                                                className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter transition-all border ${us.status === SkillStatus.CONFIRMED ? 'bg-green-100 text-green-700 border-green-200' : us.status === SkillStatus.FAILED ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'} ${isPending ? 'hover:scale-105 cursor-pointer shadow-sm' : ''}`}
                                                                onClick={() => isPending && navigate('/coordinator/verifications', { state: { search: skill.name_pl } })}
                                                            >
                                                                {SKILL_STATUS_LABELS[us.status]}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {employeeSkills.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">Brak przypisanych umiejętności technicznych.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'docs' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-tighter text-sm"><FileText size={18} className="text-purple-500"/> Dokumenty i Uprawnienia Formalne</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {employeeDocs.map(doc => (
                                        <div key={doc.id} className="p-5 border border-slate-200 rounded-2xl flex justify-between items-center shadow-sm hover:border-purple-200 transition-colors group bg-white">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-inner"><FileText size={22}/></div>
                                                <div>
                                                    <div className="font-black text-slate-800 text-sm tracking-tight">{doc.custom_name || skills.find(s => s.id === doc.skill_id)?.name_pl || 'Dokument'}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-black mt-0.5 tracking-widest">{SKILL_STATUS_LABELS[doc.status]}</div>
                                                </div>
                                            </div>
                                            <Button size="sm" variant="secondary" className="h-9 px-4 text-xs font-bold shadow-none" onClick={() => {
                                                const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
                                                setFileViewer({ isOpen: true, urls, title: doc.custom_name || 'Dokument', index: 0 });
                                            }}><Eye size={16} className="mr-2"/> Podgląd</Button>
                                        </div>
                                    ))}
                                    {employeeDocs.length === 0 && <div className="md:col-span-2 text-center py-12 text-slate-400 border-2 border-dashed rounded-2xl italic text-sm">Brak dodanych uprawnień formalnych.</div>}
                                </div>
                            </div>
                        )}

                        {activeTab === 'quality' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tighter text-sm"><AlertTriangle size={18} className="text-red-500"/> Historia Incydentów</h3>
                                    <Button size="sm" onClick={() => setIsAddingIncident(!isAddingIncident)} variant={isAddingIncident ? 'secondary' : 'primary'}>
                                        {isAddingIncident ? <><X size={16} className="mr-2"/> Anuluj</> : <><Plus size={16} className="mr-2"/> Dodaj Zgłoszenie</>}
                                    </Button>
                                </div>

                                {isAddingIncident && (
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner animate-in slide-in-from-top-2">
                                        <h4 className="font-black text-slate-700 mb-4 text-xs uppercase tracking-widest flex items-center gap-2"><Plus size={14}/> Nowe zgłoszenie błędu</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">Umiejętność (tylko potwierdzone)</label>
                                                <select 
                                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={newIncidentSkillId}
                                                    onChange={e => setNewIncidentSkillId(e.target.value)}
                                                >
                                                    <option value="">Wybierz umiejętność...</option>
                                                    {employeeConfirmedSkills.map(es => {
                                                        const skill = skills.find(s => s.id === es.skill_id);
                                                        return skill ? <option key={skill.id} value={skill.id}>{skill.name_pl}</option> : null;
                                                    })}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">Opis błędu</label>
                                                <textarea 
                                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white h-20 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="Opisz dokładnie co zostało wykonane błędnie..."
                                                    value={newIncidentDesc}
                                                    onChange={e => setNewIncidentDesc(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <input type="file" className="hidden" ref={incidentCameraRef} accept="image/*" onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if(file) setNewIncidentImage(URL.createObjectURL(file));
                                                }} />
                                                <Button size="sm" variant="secondary" onClick={() => incidentCameraRef.current?.click()} className="text-xs">
                                                    <Camera size={14} className="mr-2"/> {newIncidentImage ? 'Zmień zdjęcie' : 'Załącz zdjęcie'}
                                                </Button>
                                                {newIncidentImage && <div className="text-[10px] text-green-600 font-bold flex items-center gap-1"><CheckCircle size={10}/> Zdjęcie dodane</div>}
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <Button onClick={handleSaveIncident} disabled={!newIncidentSkillId || !newIncidentDesc}>Zatwierdź Zgłoszenie</Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {employeeIncidents.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-2xl italic text-sm">Pracownik nie posiada żadnych zgłoszonych błędów.</div>
                                    ) : (
                                        employeeIncidents.map(inc => {
                                            const skill = skills.find(s => s.id === inc.skill_id);
                                            const isWarning = inc.incident_number === 1;
                                            return (
                                                <div 
                                                    key={inc.id} 
                                                    className={`p-4 border rounded-2xl transition-all cursor-pointer group shadow-sm ${isWarning ? 'bg-amber-50 border-amber-200 hover:border-amber-400' : 'bg-red-50 border-red-200 hover:border-red-400'}`}
                                                    onClick={() => setSelectedIncident(inc)}
                                                >
                                                    <div className={`flex justify-between text-xs font-black mb-2 uppercase tracking-widest ${isWarning ? 'text-amber-700' : 'text-red-700'}`}>
                                                        <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(inc.date).toLocaleDateString()}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`${isWarning ? 'bg-amber-600' : 'bg-red-600'} text-white px-2 py-0.5 rounded`}>
                                                                {isWarning ? 'Ostrzeżenie (1/2)' : 'Blokada dodatku (2/2)'}
                                                            </span>
                                                            <span className="group-hover:translate-x-1 transition-transform">Szczegóły <ChevronRight size={12} className="inline ml-0.5"/></span>
                                                        </div>
                                                    </div>
                                                    <div className="font-black text-slate-900 text-base mb-1">{skill?.name_pl}</div>
                                                    <p className="text-sm text-slate-700 truncate opacity-80">{inc.description}</p>
                                                    <div className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Zgłosił: {inc.reported_by}</div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                {/* Form to add new note */}
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                                    <h4 className="font-black text-slate-700 mb-4 flex items-center gap-2 text-xs uppercase tracking-widest"><MessageSquare size={16}/> Dodaj Nową Notatkę Służbową</h4>
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="w-1/3">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">Kategoria</label>
                                                <select 
                                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={noteCategory}
                                                    onChange={e => setNoteCategory(e.target.value as NoteCategory)}
                                                >
                                                    {Object.values(NoteCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">Treść Notatki</label>
                                                <textarea 
                                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white h-20 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                                                    placeholder="Wpisz istotne informacje dotyczące pracownika..."
                                                    value={noteText}
                                                    onChange={e => setNoteText(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <Button onClick={handleSaveNote} disabled={!noteText} className="shadow-lg shadow-blue-500/20">
                                                <Save size={16} className="mr-2"/> Zapisz Notatkę
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-black text-slate-400 mb-2 text-[10px] uppercase tracking-widest">Zarejestrowane Notatki</h4>
                                    {employeeNotesList.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic text-center py-8">Brak zapisanych notatek dla tego pracownika.</p>
                                    ) : (
                                        employeeNotesList.map(note => {
                                            const author = users.find(u => u.id === note.author_id);
                                            return (
                                                <div key={note.id} className="p-5 border rounded-2xl bg-white border-slate-200 shadow-sm flex gap-4 hover:border-blue-200 transition-colors">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold shrink-0 shadow-inner">
                                                        {author ? author.first_name[0] : '?'}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between text-[10px] text-slate-400 mb-2 font-black uppercase tracking-widest">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-800">{author ? `${author.first_name} ${author.last_name}` : 'System'}</span>
                                                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{note.category}</span>
                                                            </div>
                                                            <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-800 leading-relaxed font-medium">{note.text}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'badges' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-tighter text-sm"><Star size={18} className="text-yellow-500 fill-yellow-500"/> Odznaki i Wyróżnienia</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {employeeBadgesList.length === 0 ? (
                                        <div className="md:col-span-2 text-center py-12 text-slate-400 border-2 border-dashed rounded-2xl italic text-sm">Pracownik nie posiada jeszcze żadnych przyznanych odznak.</div>
                                    ) : (
                                        employeeBadgesList.map(badge => {
                                            const author = users.find(u => u.id === badge.author_id);
                                            return (
                                                <div key={badge.id} className="bg-gradient-to-br from-white to-yellow-50/50 p-5 rounded-2xl border border-yellow-200 shadow-sm relative group overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><Award size={64} className="text-yellow-600"/></div>
                                                    <div className="relative z-10 flex gap-4">
                                                        <div className="bg-yellow-500 text-white p-3 rounded-xl h-fit shadow-md"><Star size={24}/></div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-black text-slate-900 text-lg tracking-tighter">{badge.type}</h4>
                                                                <span className="text-[10px] font-black uppercase text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded tracking-widest">{badge.month}</span>
                                                            </div>
                                                            <p className="text-sm text-slate-700 italic font-medium leading-relaxed">"{badge.description}"</p>
                                                            <div className="text-[10px] text-slate-400 mt-4 font-black uppercase tracking-widest border-t pt-2 border-yellow-100 flex justify-between">
                                                                <span>Przyznał: {author ? `${author.first_name} ${author.last_name}` : 'Nieznany'}</span>
                                                                <span>{new Date(badge.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setSelectedEmployee(null)}>Zamknij</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderIncidentModal = () => {
        if (!selectedIncident) return null;
        const skill = skills.find(s => s.id === selectedIncident.skill_id);
        const isWarning = selectedIncident.incident_number === 1;
        return (
            <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedIncident(null)}>
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-900">Szczegóły Incydentu</h3>
                        <button onClick={() => setSelectedIncident(null)}><X size={24} className="text-slate-400 hover:text-slate-600 transition-colors"/></button>
                    </div>
                    <div className="space-y-4 overflow-y-auto pr-2">
                        <div><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Umiejętność</span><div className="font-black text-slate-900 text-lg leading-tight mt-1">{skill?.name_pl || 'Nieznana'}</div></div>
                        <div className="flex gap-8">
                            <div><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Data Zdarzenia</span><div className="text-sm text-slate-700 font-bold mt-1">{new Date(selectedIncident.date).toLocaleDateString()}</div></div>
                            <div><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Osoba Zgłaszająca</span><div className="text-sm text-slate-700 font-bold mt-1">{selectedIncident.reported_by}</div></div>
                        </div>
                        <div><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Kwalifikacja kary</span><div className="mt-1.5">{isWarning ? (<span className="bg-amber-100 text-amber-800 text-[10px] font-black px-3 py-1 rounded-full border border-amber-200 flex items-center w-fit gap-2 uppercase"><AlertTriangle size={14}/> 1. Ostrzeżenie</span>) : (<span className="bg-red-100 text-red-800 text-[10px] font-black px-3 py-1 rounded-full border border-red-200 flex items-center w-fit gap-2 uppercase"><Lock size={14}/> Blokada Miesięczna</span>)}</div></div>
                        <div><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Szczegółowy Opis</span><p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-2 font-medium leading-relaxed">{selectedIncident.description}</p></div>
                        {selectedIncident.image_url && (
                            <div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Dokumentacja fotograficzna</span>
                                <div className="mt-3 rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50 cursor-pointer hover:opacity-90 transition-opacity shadow-inner" onClick={() => setFileViewer({isOpen: true, urls: [selectedIncident.image_url!], title: 'Dowód Jakości', index: 0})}>
                                    <img src={selectedIncident.image_url} alt="Dowód" className="w-full object-contain max-h-[300px]" />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end"><Button onClick={() => setSelectedIncident(null)}>Zamknij</Button></div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <div className="flex justify-between items-center mb-6">
                <div><h1 className="text-2xl font-bold text-slate-900">Lista Pracowników</h1><p className="text-slate-500">Przegląd personelu, statusów i przydziałów.</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Szukaj pracownika..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative min-w-[140px]"><select className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium cursor-pointer" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}><option value="all">Wszystkie statusy</option><option value="trial">Okres Próbny</option><option value="employee">Pracownik</option></select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/></div>
                    <div className="relative min-w-[160px]"><select className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium cursor-pointer" value={brigadirFilter} onChange={(e) => setBrigadirFilter(e.target.value)}><option value="all">Wszyscy Brygadziści</option>{brigadirs.map(b => (<option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>))}</select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/></div>
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr><th className="px-6 py-4">Pracownik</th><th className="px-6 py-4">Stanowisko</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Brygadzista</th><th className="px-6 py-4 text-right"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredEmployees.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => handleOpenDetail(user)}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">{user.first_name[0]}{user.last_name[0]}</div>
                                        <div>
                                            <div className="font-medium text-slate-900">{user.first_name} {user.last_name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {user.role === Role.BRIGADIR || user.target_position === 'Brygadzista' ? (
                                        <span className="bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold uppercase tracking-tight">Brygadzista</span>
                                    ) : (
                                        <span className="text-slate-600">{user.target_position || 'Pracownik'}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {user.status === UserStatus.TRIAL ? (<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">Okres Próbny</span>) : (<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Pracownik</span>)}
                                </td>
                                <td className="px-6 py-4 text-slate-600">{getBrigadirName(user.assigned_brigadir_id)}</td>
                                <td className="px-6 py-4 text-right"><ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 inline"/></td>
                            </tr>
                        ))} 
                        {filteredEmployees.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Brak pracowników spełniających kryteria.</td></tr>}
                    </tbody>
                </table>
            </div>
            {renderModalContent()}
            {renderIncidentModal()}
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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeChecklistId !== null) {
            const url = URL.createObjectURL(file);
            setChecklistState(prev => ({
                ...prev,
                [activeChecklistId]: { ...prev[activeChecklistId], image_url: url, checked: true }
            }));
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
                            <th className="px-6 py-4">Postęp</th>
                            <th className="px-6 py-4 text-right">Akcja</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {verificationTasks.map(task => (
                            <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{task.user?.first_name[0]}{task.user?.last_name[0]}</div><div><div className="font-medium text-slate-900">{task.user?.first_name} {task.user?.last_name}</div><div className="text-xs text-slate-500">{task.user?.target_position || 'Pracownik'}</div></div></div></td>
                                <td className="px-6 py-4 text-slate-600 font-medium uppercase text-xs tracking-tight">{task.skill?.category}</td>
                                <td className="px-6 py-4 font-bold text-slate-700">{task.skill?.name_pl}</td>
                                <td className="px-6 py-4">{task.isTrial ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">Okres Próbny</span> : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">Pracownik</span>}</td>
                                <td className="px-6 py-4 text-slate-700 font-medium">{task.brigadirName}</td>
                                <td className="px-6 py-4">{task.displayStatus === 'Zatwierdzony' && <span className="flex items-center gap-1 text-green-600 font-bold text-xs uppercase bg-green-50 px-2 py-1 rounded border border-green-100 w-fit"><CheckCircle size={12}/> Zatwierdzony</span>}{task.displayStatus === 'Odrzucony' && <span className="flex items-center gap-1 text-red-600 font-bold text-xs uppercase bg-red-50 px-2 py-1 rounded border border-red-100 w-fit"><XCircle size={12}/> Odrzucony</span>}{task.displayStatus === 'W toku' && <span className="flex items-center gap-1 text-blue-600 font-bold text-xs uppercase bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit"><Clock size={12}/> W toku</span>}{task.displayStatus === 'Oczekuje' && <span className="flex items-center gap-1 text-slate-500 font-bold text-xs uppercase bg-slate-100 px-2 py-1 rounded border border-slate-200 w-fit"><Clock size={12}/> Oczekuje</span>}</td>
                                <td className="px-6 py-4 font-bold text-slate-700">{task.progressLabel}</td>
                                <td className="px-6 py-4 text-right"><Button size="sm" onClick={() => handleOpenCheck(task)}>{task.displayStatus === 'Zatwierdzony' ? 'Szczegóły' : 'Weryfikuj'}</Button></td>
                            </tr>
                        ))}
                        {verificationTasks.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-slate-400">Brak weryfikacji spełniających kryteria.</td></tr>}
                    </tbody>
                </table>
            </div>

            {selectedItem && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
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
                            <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-4">Postęp weryfikacji i dokumentacja</h4>
                            <div className="space-y-2 bg-white border rounded-xl overflow-hidden shadow-sm">
                                {getChecklist(selectedItem.skill_id).map((c: any) => {
                                    const state = checklistState[c.id];
                                    return (
                                        <div key={c.id} className={`flex items-center justify-between p-4 border-b last:border-0 hover:bg-slate-50 transition-colors ${state?.checked ? 'bg-blue-50/10' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <input type="checkbox" checked={!!state?.checked} onChange={() => toggleCheck(c.id)} className="w-5 h-5 rounded text-blue-600 cursor-pointer" />
                                                <span className={`text-sm ${state?.checked ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>{c.text_pl}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {state?.image_url ? (
                                                    <div className="relative group cursor-pointer" onClick={() => setFileViewer({isOpen: true, urls: [state.image_url!], title: 'Dowód', index: 0})}>
                                                        <img src={state.image_url} alt="Foto" className="w-10 h-10 object-cover rounded border border-slate-200 shadow-sm" />
                                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded"><Eye size={14} className="text-white"/></div>
                                                    </div>
                                                ) : (
                                                    <Button size="sm" variant="secondary" className="h-9 text-xs" onClick={() => handleCameraClick(c.id)}>
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
                                <textarea className="w-full border p-3 rounded-xl text-sm h-24 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white" placeholder="Opcjonalne uwagi..." value={rejectReason} onChange={e => setRejectReason(e.target.value)}/>
                            </div>
                            <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} />
                        </div>
                        <div className="p-6 border-t bg-white flex justify-between gap-4">
                            <Button variant="danger" onClick={handleReject} disabled={!rejectReason}>Odrzuć</Button>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={handleSaveProgress}>
                                    <Save size={18} className="mr-2"/> Zapisz postęp
                                </Button>
                                <Button onClick={handleApprove} className="bg-blue-600 hover:bg-blue-700 px-8" disabled={!isReadyToApprove}>
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

// --- COORDINATOR QUALITY PAGE (Identical to Brigadir View) ---
export const CoordinatorQuality = () => {
    const { state, addQualityIncident } = useAppContext();
    const location = useLocation();
    const { qualityIncidents, users, skills, userSkills, currentUser } = state;
    
    // View State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Modal State for viewing details
    const [selectedIncident, setSelectedIncident] = useState<QualityIncident | null>(null);
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // Form State
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedSkillId, setSelectedSkillId] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState<string>('');
    const [successMsg, setSuccessMsg] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (location.state && location.state.search) {
            setSearch(location.state.search);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const filteredIncidents = useMemo(() => {
        return qualityIncidents
            .filter(inc => {
                const incDate = new Date(inc.date);
                const incMonth = incDate.toISOString().slice(0, 7);
                const matchesMonth = monthFilter === 'all' || incMonth === monthFilter;
                
                const user = users.find(u => u.id === inc.user_id);
                const matchesSearch = search === '' || 
                    (user && (user.first_name.toLowerCase().includes(search.toLowerCase()) || user.last_name.toLowerCase().includes(search.toLowerCase())));

                return matchesMonth && matchesSearch;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [qualityIncidents, monthFilter, search, users]);

    const availableSkillsForForm = useMemo(() => {
        if (!selectedUserId) return [];
        return userSkills
            .filter(us => us.user_id === selectedUserId && us.status === SkillStatus.CONFIRMED)
            .map(us => skills.find(s => s.id === us.skill_id))
            .filter(Boolean);
    }, [selectedUserId, userSkills, skills]);

    const incidentPrediction = useMemo(() => {
        if (!selectedUserId || !selectedSkillId) return null;
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const existingCount = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === selectedUserId && 
                   inc.skill_id === selectedSkillId &&
                   d.getMonth() === currentMonth &&
                   d.getFullYear() === currentYear;
        }).length;

        const nextNumber = existingCount + 1;
        const isBlock = nextNumber >= 2;

        return {
            number: nextNumber,
            isBlock,
            label: isBlock ? 'ANULOWANIE DODATKU' : 'OSTRZEŻENIE USTNE',
            description: isBlock 
                ? 'Drugi błąd w miesiącu. Dodatek za tę umiejętność zostanie odjęty z wypłaty w tym miesiącu.' 
                : 'Pierwszy błąd w miesiącu. Upomnienie, dodatek zostaje zachowany.'
        };
    }, [selectedUserId, selectedSkillId, qualityIncidents]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setImageUrl(URL.createObjectURL(file));
    };

    const handleSubmit = () => {
        if (!selectedUserId || !selectedSkillId || !description || !incidentPrediction || !currentUser) return;

        addQualityIncident({
            user_id: selectedUserId,
            skill_id: selectedSkillId,
            date: new Date().toISOString(),
            incident_number: incidentPrediction.number,
            description: description,
            reported_by: `${currentUser.first_name} ${currentUser.last_name}`,
            image_url: imageUrl
        });

        setSelectedUserId('');
        setSelectedSkillId('');
        setDescription('');
        setImageUrl('');
        setIsFormOpen(false);
        setSuccessMsg('Zgłoszenie zostało dodane pomyślnie.');
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const stats = useMemo(() => {
        let warnings = 0;
        let blocks = 0;
        filteredIncidents.forEach(inc => {
            if (inc.incident_number === 1) warnings++;
            else blocks++;
        });
        return { warnings, blocks };
    }, [filteredIncidents]);

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Jakość i Błędy</h1>
                    <p className="text-slate-500">Rejestr zgłoszeń jakościowych (Zasada 1/2).</p>
                </div>
                <Button onClick={() => setIsFormOpen(true)}>
                    <Plus size={18} className="mr-2"/> Zgłoś Błąd
                </Button>
            </div>

            {successMsg && (
                <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle size={20}/> {successMsg}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-1">WSZYSTKIE ZGŁOSZENIA</div>
                    <div className="text-3xl font-bold text-slate-900">{filteredIncidents.length}</div>
                    <div className="text-xs text-slate-400 mt-2">W wybranym miesiącu</div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-yellow-200">
                    <div className="text-sm font-bold text-yellow-600 uppercase tracking-wide mb-1">OSTRZEŻENIA (1. BŁĄD)</div>
                    <div className="text-3xl font-bold text-slate-900">{stats.warnings}</div>
                    <div className="text-xs text-slate-400 mt-2">Brak wpływu na stawkę</div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-red-200">
                    <div className="text-sm font-bold text-red-600 uppercase tracking-wide mb-1">BLOKADY (2.+ BŁĄD)</div>
                    <div className="text-3xl font-bold text-slate-900">{stats.blocks}</div>
                    <div className="text-xs text-slate-400 mt-2">Anulowane dodatki</div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Szukaj pracownika..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div className="flex items-center gap-2 w-full md:w-auto"><Calendar size={18} className="text-slate-400"/><input type="month" className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm w-full md:w-auto font-medium" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}/></div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Pracownik</th><th className="px-6 py-4">Umiejętność</th><th className="px-6 py-4">Skutek</th><th className="px-6 py-4">Opis</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredIncidents.map(inc => {
                            const user = users.find(u => u.id === inc.user_id);
                            const skill = skills.find(s => s.id === inc.skill_id);
                            const isBlock = inc.incident_number >= 2;
                            return (
                                <tr key={inc.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedIncident(inc)}>
                                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{new Date(inc.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900">{user ? `${user.first_name} ${user.last_name}` : 'Nieznany'}</td>
                                    <td className="px-6 py-4 text-slate-700"><div>{skill?.name_pl}</div><div className="text-[10px] text-slate-400 font-bold">Bonus: {skill?.hourly_bonus} zł/h</div></td>
                                    <td className="px-6 py-4">{isBlock ? (<span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-black border border-red-200 uppercase tracking-tighter"><Lock size={10}/> Anulowanie dodatku</span>) : (<span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-black border border-yellow-200 uppercase tracking-tighter"><AlertTriangle size={10}/> Ostrzeżenie (1/2)</span>)}</td>
                                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{inc.description}</td>
                                </tr>
                            );
                        })}
                        {filteredIncidents.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-slate-400">Brak zgłoszeń w wybranym okresie.</td></tr>}
                    </tbody>
                </table>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-6 border-b pb-4"><h2 className="text-xl font-bold text-slate-900">Nowe Zgłoszenie</h2><button onClick={() => setIsFormOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-bold text-slate-700 mb-2 tracking-tight">Wybierz pracownika...</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={selectedUserId} onChange={e => { setSelectedUserId(e.target.value); setSelectedSkillId(''); }}><option value="">Wybierz pracownika...</option>{users.filter(u => u.role !== Role.CANDIDATE && u.status !== UserStatus.INACTIVE).map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-2 tracking-tight">Umiejętność (tylko potwierdzone)</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50" value={selectedSkillId} onChange={e => setSelectedSkillId(e.target.value)} disabled={!selectedUserId}><option value="">Wybierz umiejętność...</option>{availableSkillsForForm.map((s: any) => <option key={s.id} value={s.id}>{s.name_pl} (+{s.hourly_bonus} zł)</option>)}</select></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-2 tracking-tight">Opis błędu</label><textarea className="w-full border border-slate-300 rounded-lg p-2.5 text-sm h-24 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Opisz dokładnie na czym polegał błąd..." value={description} onChange={e => setDescription(e.target.value)}/></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-2 tracking-tight">Zdjęcie (Opcjonalne)</label><div className="flex gap-2"><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} /><input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} /><Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs"><Upload size={14} className="mr-1"/> Wybierz</Button><Button variant="secondary" size="sm" onClick={() => cameraInputRef.current?.click()} className="text-xs"><Camera size={14} className="mr-1"/> Zdjęcie</Button></div>{imageUrl && <div className="mt-2 relative w-fit group"><img src={imageUrl} alt="Dowód" className="h-20 w-auto rounded border border-slate-200" /><button onClick={() => setImageUrl('')} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"><X size={12}/></button></div>}</div>
                        </div>
                        <div className="pt-6 flex justify-end gap-3"><Button variant="ghost" onClick={() => setIsFormOpen(false)}>Anuluj</Button><Button variant={incidentPrediction?.isBlock ? 'danger' : 'primary'} onClick={handleSubmit} disabled={!selectedUserId || !selectedSkillId || !description}>Zatwierdź Zgłoszenie</Button></div>
                    </div>
                </div>
            )}

            {selectedIncident && (
                <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedIncident(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6 border-b pb-4"><h3 className="text-xl font-bold text-slate-900">Szczegóły błędu</h3><button onClick={() => setSelectedIncident(null)}><X size={24} className="text-slate-400"/></button></div>
                        <div className="space-y-4">
                            <div><span className="text-xs font-bold text-slate-400 uppercase">Opis</span><p className="text-sm text-slate-800 bg-slate-50 p-4 rounded-lg mt-1">{selectedIncident.description}</p></div>
                            {selectedIncident.image_url && <div><span className="text-xs font-bold text-slate-400 uppercase">Dokumentacja</span><img src={selectedIncident.image_url} alt="Evidence" className="mt-2 rounded-lg border w-full h-48 object-cover cursor-pointer" onClick={() => setFileViewer({isOpen: true, urls: [selectedIncident.image_url!], title: 'Dowód', index: 0})}/></div>}
                            <div className="text-xs text-slate-400 pt-4 border-t uppercase font-bold">Zgłosił: {selectedIncident.reported_by}</div>
                        </div>
                        <div className="mt-8 flex justify-end"><Button onClick={() => setSelectedIncident(null)}>Zamknij</Button></div>
                    </div>
                </div>
            )}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
        </div>
    );
};

// --- WRAPPERS FOR SHARED COMPONENTS ---
export const CoordinatorSkills = () => <EmployeeSkills />;
export const CoordinatorLibrary = () => <EmployeeLibrary />;
export const CoordinatorProfile = () => <CandidateProfilePage />;
