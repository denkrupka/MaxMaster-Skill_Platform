import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    CheckSquare, Search, User, Clock, CheckCircle, XCircle, 
    AlertTriangle, Filter, ChevronDown, Calendar, ArrowRight, X,
    Phone, FileText, Video, BookOpen, ExternalLink, Camera, Save, Eye, Loader2
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { SkillStatus, VerificationType, UserStatus, Skill, LibraryResource, ChecklistItemState } from '../../types';
import { CHECKLIST_TEMPLATES, SKILL_STATUS_LABELS } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';

export const BrigadirChecksPage = () => {
    const { state, confirmSkillPractice, saveSkillChecklistProgress, updateUserSkillStatus, triggerNotification } = useAppContext();
    const { currentUser, userSkills, users, skills, libraryResources } = state;
    const location = useLocation();

    // Filters State
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('pending');
    const [periodFilter, setPeriodFilter] = useState<'all' | 'trial' | 'regular'>('all');
    const [skillFilter, setSkillFilter] = useState('all');

    // Modal State
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [checklistState, setChecklistState] = useState<Record<number, ChecklistItemState>>({});
    const [rejectReason, setRejectReason] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    
    // Confirmation Modal
    const [confirmRejectModal, setConfirmRejectModal] = useState(false);

    // Viewer State
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // File Input Ref for Camera
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [activeChecklistId, setActiveChecklistId] = useState<number | null>(null);

    // Handle incoming navigation state (from Team Page)
    useEffect(() => {
        if (location.state && (location.state as any).filterName) {
            setSearch((location.state as any).filterName);
            setStatusFilter('pending');
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    // --- DATA PREPARATION ---

    // 1. Get My Team
    const myTeam = useMemo(() => {
        if (!currentUser) return [];
        return users.filter(u => u.assigned_brigadir_id === currentUser.id && u.status !== UserStatus.INACTIVE);
    }, [currentUser, users]);

    const myTeamIds = useMemo(() => myTeam.map(u => u.id), [myTeam]);

    // 2. Prepare & Filter Tasks
    const tasks = useMemo(() => {
        let items = userSkills.filter(us => {
            // Must belong to team
            if (!myTeamIds.includes(us.user_id)) return false;
            
            const skill = skills.find(s => s.id === us.skill_id);
            if (!skill) return false;

            // Only consider skills that REQUIRE practice verification
            if (skill.verification_type !== VerificationType.THEORY_PRACTICE) return false;

            // Define "Pending" as either explicitly waiting for practice OR having passed theory (which implies next step is practice)
            const isPending = us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING;

            // Status Filter Logic
            if (statusFilter === 'pending') {
                return isPending;
            }
            if (statusFilter === 'confirmed') return us.status === SkillStatus.CONFIRMED;
            if (statusFilter === 'rejected') return us.status === SkillStatus.FAILED;
            
            return isPending || us.status === SkillStatus.CONFIRMED || us.status === SkillStatus.FAILED;
        });

        // Map to enriched object
        let enriched = items.map(us => {
            const user = users.find(u => u.id === us.user_id);
            const skill = skills.find(s => s.id === us.skill_id);
            
            const isTrial = user?.status === UserStatus.TRIAL;
            
            // Calculate Progress Label (e.g., "3/5")
            let completedCount = 0;
            let totalCount = 0;
            
            // Determine template items count
            const template = CHECKLIST_TEMPLATES.find(t => t.skill_id === skill?.id);
            if (template) {
                totalCount = template.items.length;
            } else if (skill?.criteria) {
                totalCount = skill.criteria.length;
            }

            if (us.status === SkillStatus.CONFIRMED) {
                completedCount = totalCount;
            } else if (us.checklist_progress) {
                completedCount = Object.values(us.checklist_progress).filter((i: ChecklistItemState) => i.checked).length;
            }

            // Determine specific sub-status for display
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
                totalCount
            };
        });

        // Apply Filters
        return enriched.filter(item => {
            if (periodFilter === 'trial' && !item.isTrial) return false;
            if (periodFilter === 'regular' && item.isTrial) return false;
            if (skillFilter !== 'all' && item.skill?.id !== skillFilter) return false;

            const term = search.toLowerCase();
            return item.user?.first_name.toLowerCase().includes(term) || 
                   item.user?.last_name.toLowerCase().includes(term) ||
                   item.skill?.name_pl.toLowerCase().includes(term);
        }).sort((a, b) => {
            // Sort priority: Pending > Started > Confirmed/Failed
            const getPriority = (status: string) => {
                if (status === 'W toku') return 1;
                if (status === 'Oczekuje') return 2;
                return 3;
            }
            return getPriority(a.displayStatus) - getPriority(b.displayStatus);
        });

    }, [userSkills, myTeamIds, users, skills, statusFilter, periodFilter, skillFilter, search]);

    // --- ACTIONS ---

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
        setChecklistState(prev => {
            const current = prev[id] || { checked: false };
            return { ...prev, [id]: { ...current, checked: !current.checked } };
        });
    };

    const handleCameraClick = (itemId: number) => {
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
                console.error("Upload failed", error);
                alert("Nie udało się przesłać zdjęcia.");
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
        
        triggerNotification(
            'status_change',
            'Umiejętność Zaliczona',
            `Brygadzista ${currentUser.first_name} potwierdził umiejętność ${selectedItem.skill?.name_pl}.`,
            '/dashboard/skills'
        );

        setSelectedItem(null);
    };

    const confirmReject = () => {
        if (!selectedItem) return;
        updateUserSkillStatus(selectedItem.id, SkillStatus.FAILED, rejectReason);
        
        triggerNotification(
            'status_change',
            'Umiejętność Odrzucona',
            `Weryfikacja ${selectedItem.skill?.name_pl} negatywna. Powód: ${rejectReason}`,
            '/dashboard/skills'
        );

        setConfirmRejectModal(false);
        setSelectedItem(null);
    };

    const currentChecklist = selectedItem ? getChecklist(selectedItem.skill_id) : [];
    const isReadyToApprove = currentChecklist.length > 0 && currentChecklist.every((c: any) => {
        const itemState = checklistState[c.id];
        return itemState?.checked && itemState?.image_url;
    });

    const uniqueSkills = useMemo(() => {
        const ids = new Set(userSkills.filter(us => myTeamIds.includes(us.user_id)).map(us => us.skill_id));
        return skills.filter(s => ids.has(s.id));
    }, [userSkills, myTeamIds, skills]);

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Weryfikacje Praktyczne</h1>
                    <p className="text-slate-500">Kolejka zadań do potwierdzenia na budowie.</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                    <CheckSquare size={18} className="text-blue-600"/>
                    <span className="font-bold text-slate-700">{tasks.filter(t => t.status === SkillStatus.THEORY_PASSED || t.status === SkillStatus.PRACTICE_PENDING).length}</span>
                    <span className="text-slate-500 text-sm">oczekujących</span>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative w-full lg:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Szukaj pracownika..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="h-8 w-px bg-slate-200 hidden lg:block"></div>
                <div className="flex flex-wrap gap-2 w-full lg:w-auto flex-1">
                    <div className="relative">
                        <select 
                            className="appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                        >
                            <option value="pending">Oczekujące</option>
                            <option value="confirmed">Zatwierdzone</option>
                            <option value="rejected">Odrzucone</option>
                            <option value="all">Wszystkie</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                    </div>
                    <div className="relative">
                        <select 
                            className="appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium cursor-pointer"
                            value={periodFilter}
                            onChange={(e) => setPeriodFilter(e.target.value as any)}
                        >
                            <option value="all">Etap: Wszystkie</option>
                            <option value="trial">Okres Próbny</option>
                            <option value="regular">Pracownik</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                    </div>
                    <div className="relative">
                        <select 
                            className="appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium cursor-pointer max-w-[200px]"
                            value={skillFilter}
                            onChange={(e) => setSkillFilter(e.target.value)}
                        >
                            <option value="all">Umiejętność: Wszystkie</option>
                            {uniqueSkills.map(s => (
                                <option key={s.id} value={s.id}>{s.name_pl}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                    </div>
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
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Postęp</th>
                            <th className="px-6 py-4 text-right">Akcja</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tasks.map(task => {
                            const isPending = task.status === SkillStatus.THEORY_PASSED || task.status === SkillStatus.PRACTICE_PENDING;
                            
                            return (
                                <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                                                {task.user?.first_name[0]}{task.user?.last_name[0]}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900">{task.user?.first_name} {task.user?.last_name}</div>
                                                <div className="text-xs text-slate-500">{task.user?.target_position || 'Pracownik'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{task.skill?.category}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{task.skill?.name_pl}</td>
                                    <td className="px-6 py-4">
                                        {task.isTrial ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                                <Clock size={10}/> {task.stage}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                <User size={10}/> {task.stage}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {task.displayStatus === 'Zatwierdzony' && <span className="flex items-center gap-1 text-green-600 font-bold text-xs uppercase bg-green-50 px-2 py-1 rounded border border-green-100 w-fit"><CheckCircle size={12}/> Zatwierdzony</span>}
                                        {task.displayStatus === 'Odrzucony' && <span className="flex items-center gap-1 text-red-600 font-bold text-xs uppercase bg-red-50 px-2 py-1 rounded border border-red-100 w-fit"><XCircle size={12}/> Odrzucony</span>}
                                        {task.displayStatus === 'W toku' && <span className="flex items-center gap-1 text-blue-600 font-bold text-xs uppercase bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit"><Clock size={12}/> W toku</span>}
                                        {task.displayStatus === 'Oczekuje' && <span className="flex items-center gap-1 text-slate-500 font-bold text-xs uppercase bg-slate-100 px-2 py-1 rounded border border-slate-200 w-fit"><Clock size={12}/> Oczekuje</span>}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-700">
                                        {task.progressLabel}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button 
                                            size="sm" 
                                            variant={isPending ? 'primary' : 'secondary'}
                                            onClick={() => handleOpenCheck(task)}
                                            className={!isPending ? 'text-slate-500 border-slate-200' : ''}
                                        >
                                            {isPending ? 'Weryfikuj' : 'Szczegóły'}
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                        {tasks.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center">
                                        <CheckSquare size={48} className="mb-4 opacity-50"/>
                                        <p>Brak zadań spełniających kryteria.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedItem && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[95vh] overflow-hidden">
                        
                        <div className="bg-white border-b border-slate-200 p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 mb-1">{selectedItem.skill?.name_pl}</h2>
                                    <p className="text-sm text-slate-500">{selectedItem.skill?.description_pl}</p>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full">
                                    <X size={24}/>
                                </button>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                        {selectedItem.user?.first_name[0]}{selectedItem.user?.last_name[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">{selectedItem.user?.first_name} {selectedItem.user?.last_name}</div>
                                        <div className="text-xs text-slate-500">{selectedItem.user?.target_position}</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Bonus</div>
                                        <div className="text-lg font-bold text-green-600">+{selectedItem.skill?.hourly_bonus} zł/h</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="overflow-y-auto p-6 flex-1 space-y-8 bg-slate-50/50">
                            {isUploading && (
                                <div className="p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2 text-sm font-medium animate-pulse">
                                    <Loader2 size={16} className="animate-spin"/> Przesyłanie zdjęcia do bazy...
                                </div>
                            )}

                            <div>
                                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-3 flex items-center justify-between">
                                    <span>Lista Zadań (Wymagane zdjęcia)</span>
                                </h3>
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-sm">
                                    {currentChecklist.map((c: any) => {
                                        const itemState = checklistState[c.id] || { checked: false };
                                        
                                        return (
                                            <div key={c.id} className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${itemState.checked ? 'bg-blue-50/30' : ''}`}>
                                                <label className="flex items-start gap-3 cursor-pointer flex-1">
                                                    <input 
                                                        type="checkbox" 
                                                        className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                                                        checked={itemState.checked}
                                                        onChange={() => toggleCheck(c.id)}
                                                        disabled={selectedItem.status === SkillStatus.CONFIRMED}
                                                    />
                                                    <span className={`text-sm ${itemState.checked ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                                                        {c.text_pl}
                                                    </span>
                                                </label>
                                                
                                                <div className="flex items-center gap-2">
                                                    {itemState.image_url ? (
                                                        <div className="relative group cursor-pointer" onClick={() => setFileViewer({isOpen: true, urls: [itemState.image_url!], title: 'Dowód', index: 0})}>
                                                            <img src={itemState.image_url} alt="Evidence" className="w-10 h-10 object-cover rounded border border-slate-200" />
                                                            {!selectedItem.status.includes('confirmed') && (
                                                                <button 
                                                                    className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow border hover:text-blue-600"
                                                                    onClick={(e) => { e.stopPropagation(); handleCameraClick(c.id); }}
                                                                >
                                                                    <Camera size={12}/>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Button 
                                                            size="sm" 
                                                            variant="secondary" 
                                                            className="text-slate-500"
                                                            onClick={() => handleCameraClick(c.id)}
                                                            disabled={selectedItem.status === SkillStatus.CONFIRMED || isUploading}
                                                        >
                                                            <Camera size={16} className="mr-1"/> Foto
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <input 
                                type="file" 
                                ref={cameraInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                capture="environment"
                                onChange={handleImageUpload} 
                            />

                            <div>
                                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-2">
                                    Komentarz {selectedItem.status === SkillStatus.FAILED && <span className="text-red-500">*</span>}
                                </h3>
                                <textarea 
                                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                    rows={3}
                                    placeholder={selectedItem.status === SkillStatus.FAILED ? selectedItem.rejectionReason : "Opcjonalne uwagi..."}
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    disabled={selectedItem.status !== SkillStatus.THEORY_PASSED && selectedItem.status !== SkillStatus.PRACTICE_PENDING}
                                />
                            </div>
                        </div>

                        {(selectedItem.status === SkillStatus.THEORY_PASSED || selectedItem.status === SkillStatus.PRACTICE_PENDING) ? (
                            <div className="p-6 bg-white border-t border-slate-200 flex gap-4 items-center">
                                <Button 
                                    variant="danger" 
                                    onClick={() => setConfirmRejectModal(true)}
                                    className="px-6"
                                >
                                    <XCircle size={18} className="mr-2"/> Odrzuć
                                </Button>
                                <div className="flex-1 flex gap-2 justify-end">
                                    <Button 
                                        variant="secondary"
                                        onClick={handleSaveProgress}
                                    >
                                        <Save size={18} className="mr-2"/> Zapisz postęp
                                    </Button>
                                    <Button 
                                        onClick={handleApprove}
                                        disabled={!isReadyToApprove || isUploading}
                                        className={!isReadyToApprove ? 'bg-slate-300 cursor-not-allowed text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
                                        title={!isReadyToApprove ? "Zaznacz wszystkie punkty i dodaj zdjęcia" : ""}
                                    >
                                        <CheckCircle size={18} className="mr-2"/> Zatwierdź
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-slate-50 border-t border-slate-200 text-center">
                                <span className={`font-bold uppercase text-sm px-3 py-1 rounded-full ${selectedItem.status === SkillStatus.CONFIRMED ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    Status: {SKILL_STATUS_LABELS[selectedItem.status]}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {confirmRejectModal && (
                <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6 text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <AlertTriangle size={24}/>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Potwierdź odrzucenie</h3>
                        <p className="text-sm text-slate-500 mb-6">Czy na pewno chcesz odrzucić ten nawyk? Wymaga to podania powodu w komentarzu.</p>
                        <div className="flex gap-3">
                            <Button fullWidth variant="ghost" onClick={() => setConfirmRejectModal(false)}>Anuluj</Button>
                            <Button fullWidth variant="danger" onClick={confirmReject}>Tak, odrzuć</Button>
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