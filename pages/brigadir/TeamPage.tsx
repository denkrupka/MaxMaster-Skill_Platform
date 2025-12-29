
import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Users, Phone, Mail, Award, CheckSquare, Clock, AlertTriangle, 
    Lock, CheckCircle, TrendingUp, Calendar, ChevronRight, User as UserIcon,
    StickyNote, X, MessageSquare, Trash2, Star, Shield, Eye, MapPin, Plus, Upload, Camera
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { UserStatus, SkillStatus, VerificationType, NoteCategory, User, BadgeType, QualityIncident } from '../../types';
import { USER_STATUS_LABELS } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

export const BrigadirTeamPage = () => {
    const { state, addEmployeeNote, deleteEmployeeNote, addEmployeeBadge, deleteEmployeeBadge, addQualityIncident } = useAppContext();
    const { currentUser, users, userSkills, skills, qualityIncidents, employeeNotes, employeeBadges } = state;
    const navigate = useNavigate();

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [modalTab, setModalTab] = useState<'notes' | 'badges' | 'details' | 'quality'>('details');

    // Note State
    const [noteText, setNoteText] = useState('');
    const [noteCategory, setNoteCategory] = useState<NoteCategory>(NoteCategory.GENERAL);

    // Badge State
    const [badgeType, setBadgeType] = useState<BadgeType>(BadgeType.QUALITY);
    const [badgeDesc, setBadgeDesc] = useState('');
    const [badgeVisible, setBadgeVisible] = useState(true);
    const [badgeMonth, setBadgeMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Quality Form State
    const [isQualityFormOpen, setIsQualityFormOpen] = useState(false);
    const [selectedSkillIdForIncident, setSelectedSkillIdForIncident] = useState<string | null>(null);
    const [incidentDescription, setIncidentDescription] = useState('');
    const [incidentImage, setIncidentImage] = useState<string>('');
    
    // Incident History State
    const [viewIncidentSkillId, setViewIncidentSkillId] = useState<string | null>(null);

    // File Viewer State
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const myTeamData = useMemo(() => {
        if (!currentUser) return [];
        const teamMembers = users.filter(u => u.assigned_brigadir_id === currentUser.id && u.status !== UserStatus.INACTIVE);

        return teamMembers.map(user => {
            const mySkills = userSkills.filter(us => us.user_id === user.id);
            const practicalSkills = mySkills.filter(us => {
                const s = skills.find(sk => sk.id === us.skill_id);
                return s?.verification_type === VerificationType.THEORY_PRACTICE;
            });
            const confirmedCount = practicalSkills.filter(us => us.status === SkillStatus.CONFIRMED).length;
            const totalAssigned = practicalSkills.length;

            return {
                user,
                progress: { confirmed: confirmedCount, total: totalAssigned },
            };
        });
    }, [currentUser, users, userSkills, skills]);

    const handleGoToVerifications = (user: any) => {
        navigate('/brigadir/checks', { state: { filterUser: user.id, filterName: user.last_name } });
    };

    // --- NOTES HANDLERS ---
    const handleAddNote = () => {
        if (!selectedUser || !noteText || !currentUser) return;
        addEmployeeNote({
            employee_id: selectedUser.id,
            author_id: currentUser.id,
            category: noteCategory,
            text: noteText
        });
        setNoteText('');
        setNoteCategory(NoteCategory.GENERAL);
    };

    // --- BADGES HANDLERS ---
    const handleAddBadge = () => {
        if (!selectedUser || !badgeDesc || !currentUser) return;
        addEmployeeBadge({
            employee_id: selectedUser.id,
            author_id: currentUser.id,
            month: badgeMonth,
            type: badgeType,
            description: badgeDesc,
            visible_to_employee: badgeVisible
        });
        setBadgeDesc('');
    };

    // --- QUALITY HANDLERS ---
    const handleOpenQualityForm = (skillId: string) => {
        setSelectedSkillIdForIncident(skillId);
        setIncidentDescription('');
        setIncidentImage('');
        setIsQualityFormOpen(true);
    };

    const handleSubmitIncident = () => {
        if (!selectedUser || !selectedSkillIdForIncident || !incidentDescription || !incidentImage || !currentUser) return;

        const existingIncidents = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === selectedUser.id && 
                   inc.skill_id === selectedSkillIdForIncident &&
                   d.getMonth() === currentMonth &&
                   d.getFullYear() === currentYear;
        });

        addQualityIncident({
            user_id: selectedUser.id,
            skill_id: selectedSkillIdForIncident,
            date: new Date().toISOString(),
            incident_number: existingIncidents.length + 1,
            description: incidentDescription,
            reported_by: `${currentUser.first_name} ${currentUser.last_name}`,
            image_url: incidentImage
        });

        setIsQualityFormOpen(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIncidentImage(URL.createObjectURL(file));
        }
    };

    const openImagePreview = (url: string) => {
        setFileViewer({
            isOpen: true,
            urls: [url],
            title: 'Podgląd Zdjęcia',
            index: 0
        });
    };

    // --- DERIVED DATA ---
    const userNotes = useMemo(() => {
        if (!selectedUser) return [];
        return employeeNotes.filter(n => n.employee_id === selectedUser.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [employeeNotes, selectedUser]);

    const userBadges = useMemo(() => {
        if (!selectedUser) return [];
        return employeeBadges.filter(b => b.employee_id === selectedUser.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [employeeBadges, selectedUser]);

    const canAddBadge = useMemo(() => {
        if (!selectedUser || !currentUser) return false;
        const existing = userBadges.find(b => b.month === badgeMonth && b.author_id === currentUser.id);
        return !existing;
    }, [userBadges, badgeMonth, selectedUser, currentUser]);

    const userConfirmedSkills = useMemo(() => {
        if (!selectedUser) return [];
        return userSkills
            .filter(us => us.user_id === selectedUser.id && us.status === SkillStatus.CONFIRMED)
            .map(us => {
                const skill = skills.find(s => s.id === us.skill_id);
                const incidents = qualityIncidents.filter(inc => {
                    const d = new Date(inc.date);
                    return inc.user_id === selectedUser.id && 
                           inc.skill_id === us.skill_id && 
                           d.getMonth() === currentMonth && 
                           d.getFullYear() === currentYear;
                });
                
                let qualityStatus = 'active';
                if (incidents.length >= 2) qualityStatus = 'blocked';
                else if (incidents.length === 1) qualityStatus = 'warning';

                return { ...us, skill, incidents, qualityStatus };
            })
            .filter(item => item.skill);
    }, [selectedUser, userSkills, skills, qualityIncidents, currentMonth, currentYear]);

    const incidentPrediction = useMemo(() => {
        if (!selectedUser || !selectedSkillIdForIncident) return null;
        
        const existingCount = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === selectedUser.id && 
                   inc.skill_id === selectedSkillIdForIncident &&
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
    }, [selectedUser, selectedSkillIdForIncident, qualityIncidents, currentMonth, currentYear]);

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
                            <th className="px-6 py-4">Stanowisko</th>
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
                                            onClick={() => { setSelectedUser(item.user); setModalTab('details'); }}
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

            {/* PROFILE MODAL */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedUser(null)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                    {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">{selectedUser.first_name} {selectedUser.last_name}</h2>
                                    <p className="text-sm text-slate-500">{selectedUser.target_position || 'Pracownik'}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedUser(null)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>

                        <div className="flex space-x-1 bg-slate-50 p-1 rounded-lg mb-6 w-full md:w-fit overflow-x-auto">
                            <button onClick={() => setModalTab('details')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${modalTab === 'details' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Dane pracownika</button>
                            <button onClick={() => setModalTab('notes')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${modalTab === 'notes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Notatki</button>
                            <button onClick={() => setModalTab('badges')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${modalTab === 'badges' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Odznaki</button>
                            <button onClick={() => setModalTab('quality')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${modalTab === 'quality' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Zgłoszenia Jakości</button>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-6 pr-2">
                            {modalTab === 'details' && (
                                <div className="space-y-4">
                                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Kontakt</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 p-2 rounded text-blue-600"><Phone size={18}/></div>
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase font-bold">Telefon</div>
                                                    <div className="text-slate-900 font-medium">{selectedUser.phone || 'Brak'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 p-2 rounded text-blue-600"><Mail size={18}/></div>
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase font-bold">Email</div>
                                                    <div className="text-slate-900 font-medium">{selectedUser.email}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Adres Zamieszkania</h3>
                                        <div className="flex items-center gap-3">
                                            <div className="bg-slate-50 p-2 rounded text-slate-600"><MapPin size={18}/></div>
                                            <div>
                                                <div className="text-slate-900 font-medium">
                                                    {selectedUser.street} {selectedUser.house_number}{selectedUser.apartment_number ? `/${selectedUser.apartment_number}` : ''}
                                                </div>
                                                <div className="text-slate-500 text-sm">
                                                    {selectedUser.zip_code} {selectedUser.city}
                                                </div>
                                                {!selectedUser.street && <div className="text-slate-400 italic">Brak danych adresowych</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {modalTab === 'notes' && (
                                <>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><MessageSquare size={18}/> Dodaj Notatkę</h4>
                                        <div className="space-y-3">
                                            <select className="w-full border p-2 rounded bg-white text-sm" value={noteCategory} onChange={e => setNoteCategory(e.target.value as NoteCategory)}>{Object.values(NoteCategory).map(c => <option key={c} value={c}>{c}</option>)}</select>
                                            <textarea className="w-full border p-2 rounded bg-white text-sm h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Wpisz treść notatki..." value={noteText} onChange={e => setNoteText(e.target.value)}/>
                                            <div className="flex justify-end"><Button onClick={handleAddNote} disabled={!noteText}>Zapisz Notatkę</Button></div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {userNotes.length === 0 && <p className="text-slate-400 italic text-center">Brak notatek.</p>}
                                        {userNotes.map(note => {
                                            const author = users.find(u => u.id === note.author_id);
                                            return (
                                                <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{author ? author.first_name[0] : '?'}</div>
                                                            <div><div className="text-xs font-bold text-slate-800">{author ? `${author.first_name} ${author.last_name}` : 'Nieznany'}</div><div className="text-[10px] text-slate-500">{new Date(note.created_at).toLocaleString()}</div></div>
                                                        </div>
                                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{note.category}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.text}</p>
                                                    {note.author_id === currentUser?.id && (<button className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" onClick={() => deleteEmployeeNote(note.id)}><Trash2 size={16} /></button>)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {modalTab === 'badges' && (
                                <>
                                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-6">
                                        <h4 className="font-bold text-yellow-800 mb-3 flex items-center gap-2"><Star size={18}/> Przyznaj Odznakę</h4>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3"><input type="month" className="border p-2 rounded bg-white text-sm" value={badgeMonth} onChange={e => setBadgeMonth(e.target.value)} /><select className="border p-2 rounded bg-white text-sm" value={badgeType} onChange={e => setBadgeType(e.target.value as BadgeType)}>{Object.values(BadgeType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                            <textarea className="w-full border p-2 rounded bg-white text-sm h-20 focus:outline-none focus:ring-2 focus:ring-yellow-500" placeholder="Uzasadnienie..." value={badgeDesc} onChange={e => setBadgeDesc(e.target.value)}/>
                                            <div className="flex justify-between items-center">
                                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" checked={badgeVisible} onChange={e => setBadgeVisible(e.target.checked)} className="rounded text-yellow-600 focus:ring-yellow-500"/> Widoczne dla pracownika</label>
                                                <Button onClick={handleAddBadge} disabled={!badgeDesc || !canAddBadge} className={!canAddBadge ? 'bg-slate-300 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}>{canAddBadge ? 'Przyznaj' : 'Limit 1/mc'}</Button>
                                            </div>
                                            {!canAddBadge && <p className="text-xs text-red-500 text-right mt-1">Przyznałeś już odznakę w tym miesiącu.</p>}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {userBadges.length === 0 && <p className="text-slate-400 italic text-center">Brak odznak.</p>}
                                        {userBadges.map(badge => (
                                            <div key={badge.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2"><div className="bg-yellow-100 text-yellow-600 p-1.5 rounded-full"><Award size={16} /></div><div><div className="text-sm font-bold text-slate-800">{badge.type}</div><div className="text-xs text-slate-500">{badge.month}</div></div></div>
                                                    {badge.visible_to_employee ? <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded border border-green-200 flex items-center gap-1"><Eye size={10}/> Widoczna</span> : <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><Shield size={10}/> Ukryta</span>}
                                                </div>
                                                <p className="text-sm text-slate-700 mt-2 italic">"{badge.description}"</p>
                                                {badge.author_id === currentUser?.id && (<button className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" onClick={() => deleteEmployeeBadge(badge.id)}><Trash2 size={16} /></button>)}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {modalTab === 'quality' && (
                                <div>
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 text-sm text-blue-800 flex items-start gap-3">
                                        <AlertTriangle size={20} className="shrink-0 mt-0.5"/>
                                        <div>
                                            <p className="font-bold">Zarządzanie jakością (Zasada 1/2)</p>
                                            <p className="opacity-90 mt-1">Kliknij na umiejętność, aby zgłosić błąd lub zobaczyć historię. 1. błąd = ostrzeżenie, 2. błąd = utrata dodatku.</p>
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase">Potwierdzone Umiejętności</h4>
                                    <div className="space-y-3">
                                        {userConfirmedSkills.map((item: any) => (
                                            <div 
                                                key={item.id} 
                                                className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:border-blue-400 hover:shadow-md ${item.qualityStatus === 'blocked' ? 'border-red-200 bg-red-50/20' : 'border-slate-200'}`}
                                                onClick={() => handleOpenQualityForm(item.skill_id)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-900 text-base">{item.skill?.name_pl}</div>
                                                        <div className="text-xs text-slate-500 mt-1">Bonus: +{item.skill?.hourly_bonus} zł/h</div>
                                                    </div>
                                                    {item.qualityStatus === 'active' && <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><CheckCircle size={12}/> Aktywne</span>}
                                                    {item.qualityStatus === 'warning' && <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><AlertTriangle size={12}/> Ostrzeżenie (1/2)</span>}
                                                    {item.qualityStatus === 'blocked' && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><Lock size={12}/> Zablokowane</span>}
                                                </div>

                                                {item.incidents.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex gap-1">
                                                                {item.incidents.map((inc: any, idx: number) => (
                                                                    <div key={inc.id} className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-yellow-400' : 'bg-red-500'}`} title={inc.description}></div>
                                                                ))}
                                                            </div>
                                                            <button 
                                                                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                                                                onClick={(e) => { e.stopPropagation(); setViewIncidentSkillId(item.skill_id); }}
                                                            >
                                                                <Eye size={12}/> Zobacz szczegóły ({item.incidents.length})
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {userConfirmedSkills.length === 0 && (
                                            <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                                                Pracownik nie posiada jeszcze potwierdzonych umiejętności płatnych.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <Button variant="ghost" onClick={() => setSelectedUser(null)}>Zamknij</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* QUALITY FORM MODAL */}
            {isQualityFormOpen && selectedUser && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">Zgłoś Błąd Jakościowy</h2>
                            <button onClick={() => setIsQualityFormOpen(false)}><X size={24} className="text-slate-400"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                                Zgłaszasz błąd dla: <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
                                <br/>
                                Umiejętność: <strong>{skills.find(s => s.id === selectedSkillIdForIncident)?.name_pl}</strong>
                            </p>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Opis błędu</label>
                                <textarea 
                                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={3}
                                    placeholder="Opisz dokładnie na czym polegał błąd..."
                                    value={incidentDescription}
                                    onChange={e => setIncidentDescription(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Zdjęcie (Wymagane) *</label>
                                <div className="flex gap-3">
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                    <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                                    <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} type="button">
                                        <Upload size={16} className="mr-2"/> Wybierz
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => cameraInputRef.current?.click()} type="button">
                                        <Camera size={16} className="mr-2"/> Zdjęcie
                                    </Button>
                                </div>
                                {incidentImage && (
                                    <div className="mt-2 relative w-fit">
                                        <img src={incidentImage} alt="Preview" className="h-20 w-auto rounded border border-slate-200" />
                                        <button onClick={() => setIncidentImage('')} className="absolute -top-2 -right-2 bg-red-500 text-white p-0.5 rounded-full"><X size={12}/></button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="ghost" onClick={() => setIsQualityFormOpen(false)}>Anuluj</Button>
                            <Button 
                                variant={incidentPrediction?.isBlock ? 'danger' : 'primary'}
                                onClick={handleSubmitIncident} 
                                disabled={!incidentDescription || !incidentImage}
                            >
                                Zatwierdź Zgłoszenie
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* INCIDENT HISTORY MODAL */}
            {viewIncidentSkillId && selectedUser && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setViewIncidentSkillId(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-bold text-slate-900">Historia Zgłoszeń</h2>
                            <button onClick={() => setViewIncidentSkillId(null)}><X size={24} className="text-slate-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4">
                            {qualityIncidents
                                .filter(inc => inc.user_id === selectedUser.id && inc.skill_id === viewIncidentSkillId)
                                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map(inc => (
                                    <div key={inc.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-500">{new Date(inc.date).toLocaleDateString()}</span>
                                            {inc.incident_number >= 2 
                                                ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">Blokada</span> 
                                                : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold">Ostrzeżenie</span>
                                            }
                                        </div>
                                        <p className="text-sm text-slate-800">{inc.description}</p>
                                        <div className="text-xs text-slate-400 mt-2">Zgłosił: {inc.reported_by}</div>
                                        {inc.image_url && (
                                            <img 
                                                src={inc.image_url} 
                                                alt="Dowód" 
                                                className="mt-2 h-20 rounded border border-slate-200 cursor-pointer hover:opacity-80" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openImagePreview(inc.image_url!);
                                                }}
                                            />
                                        )}
                                    </div>
                                ))
                            }
                        </div>
                        <div className="pt-4 mt-2 border-t border-slate-100 text-right">
                            <Button onClick={() => setViewIncidentSkillId(null)}>Zamknij</Button>
                        </div>
                    </div>
                </div>
            )}

            <DocumentViewerModal 
                isOpen={fileViewer.isOpen}
                onClose={() => setFileViewer({ ...fileViewer, isOpen: false })}
                urls={fileViewer.urls}
                initialIndex={fileViewer.index}
                title={fileViewer.title}
            />
        </div>
    );
};
