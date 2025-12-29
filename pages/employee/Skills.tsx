
import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Award, CheckCircle, Wallet, Clock, Lock, ChevronDown, ChevronUp, 
    BookOpen, Video, FileText, AlertTriangle, TrendingUp, Calendar, Layers, ChevronRight,
    X, ExternalLink, Play, Plus, Upload, Eye, RotateCcw, Camera, List
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { SkillStatus, VerificationType, SkillCategory, LibraryResource } from '../../types';
import { Button } from '../../components/Button';
import { CHECKLIST_TEMPLATES, SKILL_STATUS_LABELS, BONUS_DOCUMENT_TYPES } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

export const EmployeeSkills = () => {
    const { state, addCandidateDocument, updateCandidateDocumentDetails, archiveCandidateDocument, restoreCandidateDocument, updateUserSkillStatus } = useAppContext();
    const { currentUser, userSkills, skills, tests, libraryResources, testAttempts, qualityIncidents } = state;
    const navigate = useNavigate();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    
    // Collapsible Sections State (Main Sections)
    const [openSections, setOpenSections] = useState({
        confirmed: true,
        verification: true,
        development: true,
        documents: false
    });

    // Collapsible Categories State (Sub-sections)
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

    // Materials Modal State
    const [resourceModal, setResourceModal] = useState<{
        isOpen: boolean;
        skillTitle: string;
        resources: LibraryResource[];
    }>({ isOpen: false, skillTitle: '', resources: [] });

    // History Modal State
    const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; testId: string | null }>({ isOpen: false, testId: null });

    // --- DOCUMENT STATE ---
    const [docsViewMode, setDocsViewMode] = useState<'active' | 'archived'>('active');
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [newDocData, setNewDocData] = useState({ 
        typeId: '',
        customName: '', 
        issue_date: new Date().toISOString().split('T')[0], 
        expires_at: '', 
        indefinite: false,
        files: [] as File[]
    });
    // File Viewer
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    if (!currentUser) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const toggleSection = (key: keyof typeof openSections) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleCategory = (sectionKey: string, category: string) => {
        const key = `${sectionKey}-${category}`;
        setOpenCategories(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // --- LOGIC: Categorize Skills ---
    const categorizedSkills = useMemo(() => {
        const confirmed: any[] = [];
        const verification: any[] = [];
        const development: any[] = [];

        skills.forEach(skill => {
            if (!skill.is_active || skill.is_archived) return;

            const userSkill = userSkills.find(us => us.user_id === currentUser.id && us.skill_id === skill.id);
            let status = userSkill?.status;

            // Extra Check: If test passed in history but status not updated (safety net)
            // This ensures skills with passed tests are NOT shown in Development list
            // FIX: We DO NOT override if status is FAILED. FAILED means rejected by brigadir and needs retry.
            const test = tests.find(t => t.skill_ids.includes(skill.id));
            if (test) {
                const hasPassed = testAttempts.some(ta => ta.user_id === currentUser.id && ta.test_id === test.id && ta.passed);
                if (hasPassed && (!status || status === SkillStatus.PENDING)) {
                    // Override status for display categorization logic
                    status = (skill.verification_type === VerificationType.THEORY_ONLY) 
                        ? SkillStatus.CONFIRMED 
                        : SkillStatus.THEORY_PASSED;
                }
            }

            const skillData = { ...skill, userSkill: userSkill || { status, user_id: currentUser.id, skill_id: skill.id, id: 'virtual' } };

            if (status === SkillStatus.CONFIRMED) {
                // If confirmed, show in Confirmed section
                confirmed.push(skillData);
            } else if (status === SkillStatus.THEORY_PASSED || status === SkillStatus.PRACTICE_PENDING) {
                // Only for practical skills that need verification
                verification.push(skillData);
            } else {
                // Development Section Logic:
                // Exclude "UPRAWNIENIA" category and "DOCUMENT" verification type from "Available to get"
                // because they live in the "Documents" section now.
                if (skill.category !== SkillCategory.UPRAWNIENIA && skill.verification_type !== VerificationType.DOCUMENT) {
                    development.push(skillData);
                }
            }
        });

        // Sort Confirmed by most recent
        confirmed.sort((a, b) => {
            const dateA = a.userSkill.confirmed_at ? new Date(a.userSkill.confirmed_at).getTime() : 0;
            const dateB = b.userSkill.confirmed_at ? new Date(b.userSkill.confirmed_at).getTime() : 0;
            return dateB - dateA;
        });

        return { confirmed, verification, development };
    }, [skills, userSkills, currentUser.id, testAttempts, tests]);

    // --- LOGIC: Documents List ---
    const myDocuments = useMemo(() => {
        return userSkills
            .filter(us => us.user_id === currentUser.id)
            .map(us => {
                // Check if linked to a system skill (e.g. SEP) or generic doc
                const skill = skills.find(s => s.id === us.skill_id);
                const isDoc = (skill?.verification_type === VerificationType.DOCUMENT) || us.skill_id.startsWith('doc_');
                
                if (isDoc) {
                    return {
                        ...us,
                        docName: us.custom_name || (skill ? skill.name_pl : 'Dokument'),
                        bonus: skill ? skill.hourly_bonus : (us.bonus_value || 0),
                        fileCount: us.document_urls ? us.document_urls.length : (us.document_url ? 1 : 0)
                    };
                }
                return null;
            })
            .filter(Boolean) as any[];
    }, [currentUser, userSkills, skills]);

    // --- HELPERS ---

    const groupByCategory = (items: any[]) => {
        const groups: Record<string, any[]> = {};
        items.forEach(item => {
            const cat = item.category || SkillCategory.INNE;
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return groups;
    };

    const getEffectiveDate = (us: any) => {
        if (us.effective_from) return new Date(us.effective_from);
        if (us.confirmed_at) {
            const d = new Date(us.confirmed_at);
            return new Date(d.getFullYear(), d.getMonth() + 1, 1);
        }
        return new Date(0);
    };

    const getQualityStatus = (us: any) => {
        const incidents = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === currentUser.id && 
                   inc.skill_id === us.skill_id && 
                   d.getMonth() === currentMonth && 
                   d.getFullYear() === currentYear;
        });

        if (incidents.length >= 2) {
            return { status: 'blocked', label: 'Zablokowane do końca miesiąca', color: 'bg-red-100 text-red-700 border-red-200' };
        } else if (incidents.length === 1) {
            return { status: 'warning', label: '1. Ostrzeżenie', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
        }

        const effectiveDate = getEffectiveDate(us);
        if (effectiveDate > now) {
            return { 
                status: 'pending_month', 
                label: `Wchodzi od ${effectiveDate.toLocaleDateString()}`, 
                color: 'bg-blue-100 text-blue-700 border-blue-200' 
            };
        }

        return { status: 'active', label: 'Aktywne', color: 'bg-green-100 text-green-700 border-green-200' };
    };

    const getChecklist = (skillId: string) => {
        const template = CHECKLIST_TEMPLATES.find(t => t.skill_id === skillId);
        if (template) return template.items;
        const skill = skills.find(s => s.id === skillId);
        return skill?.criteria?.map((c, i) => ({ id: i, text_pl: c })) || [];
    };

    const getResources = (skillId: string) => {
        return libraryResources.filter(r => r.skill_ids.includes(skillId) && !r.is_archived);
    };

    const handleStartTest = (skillId: string) => {
        const test = tests.find(t => t.skill_ids.includes(skillId));
        if (test) {
            navigate('/dashboard/run-test', { state: { selectedTestIds: [test.id] } });
        } else {
            alert('Brak aktywnego testu dla tej umiejętności.');
        }
    };

    const handleOpenResources = (skill: any) => {
        const res = getResources(skill.id);
        setResourceModal({
            isOpen: true,
            skillTitle: skill.name_pl,
            resources: res
        });
    };

    const isLocked = (skillId: string) => {
        const test = tests.find(t => t.skill_ids.includes(skillId));
        if (!test) return { locked: false, cooldown: 0 };
        
        const lastAttempt = testAttempts
            .filter(ta => ta.user_id === currentUser.id && ta.test_id === test.id)
            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];

        if (lastAttempt && !lastAttempt.passed) {
            const attemptTime = new Date(lastAttempt.completed_at).getTime();
            const cooldownTime = 24 * 60 * 60 * 1000;
            const diff = now.getTime() - attemptTime;
            if (diff < cooldownTime) {
                const remainingHours = Math.ceil((cooldownTime - diff) / (1000 * 60 * 60));
                return { locked: true, cooldown: remainingHours };
            }
        }
        return { locked: false, cooldown: 0 };
    };

    const getVerificationLabel = (type: VerificationType) => {
        switch (type) {
            case VerificationType.THEORY_ONLY: return 'Tylko Teoria';
            case VerificationType.THEORY_PRACTICE: return 'Teoria + Praktyka';
            case VerificationType.DOCUMENT: return 'Dokument';
            default: return type;
        }
    };

    // Calculate totals for header
    const activeTotal = categorizedSkills.confirmed.reduce((acc, s) => {
        const qs = getQualityStatus(s.userSkill);
        return (qs.status === 'active' || qs.status === 'warning') ? acc + s.hourly_bonus : acc;
    }, 0);

    const blockedTotal = categorizedSkills.confirmed.reduce((acc, s) => {
        const qs = getQualityStatus(s.userSkill);
        return qs.status === 'blocked' ? acc + s.hourly_bonus : acc;
    }, 0);

    // --- DOCUMENT HANDLERS ---
    const handleAddDocument = () => {
        setEditingDocId(null);
        setNewDocData({ 
            typeId: '',
            customName: '', 
            issue_date: new Date().toISOString().split('T')[0], 
            expires_at: '', 
            indefinite: false,
            files: [] 
        });
        setIsDocModalOpen(true);
    };

    const handleEditDocument = (docId: string) => {
        const doc = userSkills.find(us => us.id === docId);
        if(!doc) return;
        setEditingDocId(docId);
        setNewDocData({
            typeId: 'other',
            customName: doc.custom_name || doc.document_url || '',
            issue_date: doc.issue_date || new Date().toISOString().split('T')[0],
            expires_at: doc.expires_at || '',
            indefinite: doc.is_indefinite || false,
            files: []
        });
        setIsDocModalOpen(true);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            setNewDocData(prev => ({ ...prev, files: [...prev.files, ...selectedFiles] }));
        }
    };

    const removeFile = (index: number) => {
        setNewDocData(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
    };

    const handleSaveDocument = () => {
        if(!currentUser) return;
        
        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' || editingDocId ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;

        if (!docName) {
            alert("Podaj nazwę dokumentu.");
            return;
        }

        const urls = newDocData.files.map(f => {
            const url = URL.createObjectURL(f);
            return f.type === 'application/pdf' ? `${url}#pdf` : url;
        });

        const docPayload: any = {
            custom_name: docName,
            issue_date: newDocData.issue_date,
            expires_at: newDocData.indefinite ? undefined : newDocData.expires_at,
            is_indefinite: newDocData.indefinite,
        };

        if(urls.length > 0) {
            docPayload.document_urls = urls;
            docPayload.document_url = urls[0];
        }

        if (editingDocId) {
            updateCandidateDocumentDetails(editingDocId, docPayload);
        } else {
            addCandidateDocument(currentUser.id, {
                skill_id: 'doc_generic',
                status: SkillStatus.PENDING,
                bonus_value: bonus,
                ...docPayload
            });
        }
        setIsDocModalOpen(false);
    };

    const openFileViewer = (doc: any) => {
        const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
        setFileViewer({ isOpen: true, urls, title: doc.docName, index: 0 });
    };

    // --- HISTORY MODAL LOGIC (UPDATED) ---
    const getHistoryData = (testId: string) => {
        const test = tests.find(t => t.id === testId);
        if (!test) return [];

        // 1. Get Theory Attempts (Automated Tests)
        const attempts = testAttempts
            .filter(ta => ta.user_id === currentUser.id && ta.test_id === testId)
            .map(a => ({
                id: a.id,
                date: a.completed_at,
                score: `${a.score}%`,
                duration: a.duration_seconds,
                status: a.passed ? 'Zaliczony' : 'Niezaliczony',
                type: 'Test'
            }));

        // 2. Get All Relevant History Logs
        // This includes: "Odrzucono praktykę", "Zaliczono praktykę", "Zmiana statusu...failed", etc.
        const skill = skills.find(s => test.skill_ids.includes(s.id));
        let practicalHistory: any[] = [];
        
        if (skill) {
            const skillNameLower = skill.name_pl.toLowerCase();
            practicalHistory = state.candidateHistory
                .filter(h => {
                    if (h.candidate_id !== currentUser.id) return false;
                    const actionLower = h.action.toLowerCase();
                    
                    // Filter Logic:
                    // 1. Must contain skill name
                    // 2. EXCLUDE logs that are clearly "Test" logs (because we have attempts for that), 
                    //    UNLESS it's a generic status change that might be relevant.
                    //    Test logs usually look like "Zaliczono test: [SkillName]" or "Rozpoczęto test".
                    
                    if (!actionLower.includes(skillNameLower)) return false;

                    // Exclude duplicative test logs
                    if (actionLower.includes('zaliczono test') || actionLower.includes('rozpoczęto test')) {
                        return false; 
                    }

                    return true;
                })
                .map(h => {
                    const actionLower = h.action.toLowerCase();
                    const isRejected = actionLower.includes('odrzuco') || actionLower.includes('failed') || actionLower.includes('niezaliczon') || (actionLower.includes('status') && actionLower.includes('failed'));
                    
                    let statusLabel = 'INFO';
                    if (isRejected) statusLabel = 'ODRZUCONY';
                    else if (actionLower.includes('zaliczono') || actionLower.includes('confirmed')) statusLabel = 'ZALICZONY';
                    
                    return {
                        id: h.id,
                        date: h.date,
                        score: 'Weryfikacja/Status',
                        duration: null,
                        status: statusLabel,
                        type: 'Log'
                    };
                });
        }

        // Merge and Sort
        return [...attempts, ...practicalHistory].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    // --- MODAL RENDERERS ---

    const renderHistoryModal = () => {
        if (!historyModal.isOpen || !historyModal.testId) return null;
        const history = getHistoryData(historyModal.testId);
        const testTitle = tests.find(t => t.id === historyModal.testId)?.title || 'Test';

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setHistoryModal({isOpen: false, testId: null})}>
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-900">Historia podejść: {testTitle}</h3>
                        <button onClick={() => setHistoryModal({isOpen: false, testId: null})} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="p-3 rounded-l-lg">Data</th>
                                    <th className="p-3">Wynik / Typ</th>
                                    <th className="p-3">Czas trwania</th>
                                    <th className="p-3 rounded-r-lg text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {history.map(attempt => {
                                    const mins = attempt.duration ? Math.floor(attempt.duration / 60) : 0;
                                    const secs = attempt.duration ? attempt.duration % 60 : 0;
                                    
                                    const isPassed = attempt.status === 'Zaliczony' || attempt.status === 'ZALICZONY';
                                    const isRejected = attempt.status === 'ODRZUCONY' || attempt.status === 'Niezaliczony';
                                    const isPractice = attempt.type === 'Log';

                                    return (
                                        <tr key={attempt.id} className={isPractice ? 'bg-slate-50/50' : ''}>
                                            <td className="p-3 text-slate-700">
                                                {new Date(attempt.date).toLocaleDateString()} {new Date(attempt.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </td>
                                            <td className="p-3 font-bold">
                                                {isPractice ? (
                                                    <span className="text-slate-500 text-xs uppercase font-semibold">Weryfikacja</span>
                                                ) : (
                                                    <span className={isPassed ? 'text-green-600' : 'text-red-600'}>
                                                        {attempt.score}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-slate-500 font-mono">
                                                {attempt.duration ? `${mins}m ${secs}s` : '-'}
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${isPassed ? 'bg-green-100 text-green-700' : (isRejected ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')}`}>
                                                    {attempt.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {history.length === 0 && (
                                    <tr><td colSpan={4} className="p-6 text-center text-slate-400">Brak historii podejść.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button variant="ghost" onClick={() => setHistoryModal({isOpen: false, testId: null})}>Zamknij</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderDocumentModal = () => {
        if (!isDocModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-900">{editingDocId ? 'Edytuj Dokument' : 'Dodaj Dokument'}</h2>
                        <button onClick={() => setIsDocModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Typ Dokumentu</label>
                            <select 
                                className="w-full border p-2 rounded bg-white"
                                value={newDocData.typeId}
                                onChange={e => setNewDocData({...newDocData, typeId: e.target.value})}
                                disabled={!!editingDocId}
                            >
                                <option value="">Wybierz dokument...</option>
                                {BONUS_DOCUMENT_TYPES.map(type => (
                                    <option key={type.id} value={type.id}>
                                        {type.label} {type.bonus > 0 ? `(+${type.bonus} zł)` : '(Brak bonusu)'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {(newDocData.typeId === 'other' || editingDocId) && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nazwa Dokumentu</label>
                                <input 
                                    className="w-full border p-2 rounded" 
                                    placeholder="Wpisz nazwę..." 
                                    value={newDocData.customName}
                                    onChange={e => setNewDocData({...newDocData, customName: e.target.value})}
                                />
                                <span className="text-xs text-slate-400">Za niestandardowe dokumenty bonus nie jest przyznawany automatycznie.</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Załącz Pliki</label>
                            <div className="flex gap-2 mb-2">
                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
                                <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileSelect} />
                                
                                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                    <Upload size={16} className="mr-2"/> Pliki
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                                    <Camera size={16} className="mr-2"/> Zdjęcie
                                </Button>
                            </div>
                            
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {newDocData.files.map((file, index) => (
                                    <div key={index} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs border border-slate-100">
                                        <span className="truncate max-w-[200px]">{file.name}</span>
                                        <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Data Wydania</label>
                            <input type="date" className="w-full border p-2 rounded" value={newDocData.issue_date} onChange={e => setNewDocData({...newDocData, issue_date: e.target.value})} />
                        </div>
                        <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded">
                            <input type="checkbox" id="indefinite" checked={newDocData.indefinite} onChange={e => setNewDocData({...newDocData, indefinite: e.target.checked})} className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
                            <label htmlFor="indefinite" className="text-sm text-slate-700 cursor-pointer font-medium">Dokument bezterminowy</label>
                        </div>
                        {!newDocData.indefinite && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Data Ważności</label>
                                <input type="date" className="w-full border p-2 rounded" value={newDocData.expires_at} onChange={e => setNewDocData({...newDocData, expires_at: e.target.value})} />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="ghost" onClick={() => setIsDocModalOpen(false)}>Anuluj</Button>
                        <Button onClick={handleSaveDocument} disabled={(!newDocData.customName && !newDocData.typeId)}>Zapisz</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderResourceModal = () => {
        if (!resourceModal.isOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setResourceModal({ ...resourceModal, isOpen: false })}>
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-900">Materiały: {resourceModal.skillTitle}</h3>
                        <button onClick={() => setResourceModal({ ...resourceModal, isOpen: false })}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {resourceModal.resources.length > 0 ? (
                            resourceModal.resources.map(res => (
                                <a 
                                    key={res.id} 
                                    href={res.url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all group"
                                >
                                    <div className="bg-white p-2 rounded shadow-sm text-blue-600">
                                        {res.type === 'video' ? <Video size={20}/> : res.type === 'pdf' ? <FileText size={20}/> : <BookOpen size={20}/>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700">{res.title}</div>
                                        <div className="text-xs text-slate-500">{res.description || 'Brak opisu'}</div>
                                    </div>
                                    <ExternalLink size={16} className="text-slate-400 group-hover:text-blue-500"/>
                                </a>
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                Brak materiałów szkoleniowych dla tej umiejętności.
                            </div>
                        )}
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => setResourceModal({ ...resourceModal, isOpen: false })}>Zamknij</Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
            
            {/* Header */}
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Umiejętności i Uprawnienia</h1>
                    <p className="text-slate-500">Zarządzaj swoim rozwojem i zwiększaj stawkę.</p>
                </div>
                <div className="flex gap-3">
                    {blockedTotal > 0 && (
                        <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-red-200 text-right hidden sm:block">
                            <div className="text-xs text-red-500 uppercase font-bold">Dodatki zablokowane (tymczasowo)</div>
                            <div className="text-xl font-bold text-red-600">
                                -{blockedTotal.toFixed(2)} zł/h
                            </div>
                        </div>
                    )}
                    <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-right hidden sm:block">
                        <div className="text-xs text-slate-500 uppercase font-bold">Suma dodatków (Aktywne)</div>
                        <div className="text-xl font-bold text-green-600">
                            +{activeTotal.toFixed(2)} zł/h
                        </div>
                    </div>
                </div>
            </div>

            {/* SEKCJA 1: ZALICZONE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                    onClick={() => toggleSection('confirmed')}
                    className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <CheckCircle className="text-green-600" size={24}/>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-slate-800">Zaliczone Kompetencje</h2>
                            <p className="text-xs text-slate-500">Twoje potwierdzone umiejętności</p>
                        </div>
                    </div>
                    {openSections.confirmed ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>

                {openSections.confirmed && (
                    <div className="p-6 border-t border-slate-100">
                        {categorizedSkills.confirmed.length === 0 ? (
                            <div className="text-center text-slate-400 py-2">
                                Nie posiadasz jeszcze zatwierdzonych umiejętności.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(groupByCategory(categorizedSkills.confirmed)).map(([category, items]) => {
                                    const isCatOpen = openCategories[`confirmed-${category}`];

                                    return (
                                        <div key={category} className="rounded-lg border border-slate-200 overflow-hidden">
                                            <button 
                                                onClick={() => toggleCategory('confirmed', category)}
                                                className="w-full px-4 py-3 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Layers size={16} className="text-slate-400"/>
                                                    <span className="font-bold text-slate-700 text-sm">{category}</span>
                                                    <span className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">{items.length}</span>
                                                </div>
                                                {isCatOpen ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                                            </button>
                                            
                                            {isCatOpen && (
                                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border-t border-slate-100">
                                                    {items.map((item: any) => {
                                                        const qualityInfo = getQualityStatus(item.userSkill);
                                                        const verifiedDate = item.userSkill.confirmed_at ? new Date(item.userSkill.confirmed_at).toLocaleDateString() : 'Historycznie';

                                                        return (
                                                            <div key={item.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 relative overflow-hidden group hover:border-blue-300 transition-colors">
                                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${qualityInfo.status === 'blocked' ? 'bg-red-500' : (qualityInfo.status === 'pending_month' ? 'bg-blue-500' : (qualityInfo.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'))}`}></div>
                                                                
                                                                <div className="pl-3 flex justify-between items-start">
                                                                    <div>
                                                                        <h3 className="font-bold text-slate-900 text-base">{item.name_pl}</h3>
                                                                        <div className="text-xs text-slate-500 mt-1 flex gap-3">
                                                                            <span className="flex items-center gap-1"><Calendar size={12}/> {verifiedDate}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className={`text-lg font-bold ${qualityInfo.status === 'blocked' ? 'text-slate-300 line-through' : 'text-green-600'}`}>
                                                                            +{item.hourly_bonus} zł
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-4 pl-3 flex items-center justify-between">
                                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${qualityInfo.color} flex items-center gap-1 uppercase tracking-wide`}>
                                                                        {qualityInfo.status === 'blocked' && <Lock size={10}/>}
                                                                        {qualityInfo.status === 'warning' && <AlertTriangle size={10}/>}
                                                                        {qualityInfo.status === 'pending_month' && <Clock size={10}/>}
                                                                        {qualityInfo.label}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* SEKCJA 2: WERYFIKACJA PRAKTYCZNA */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                    onClick={() => toggleSection('verification')}
                    className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <Clock className="text-orange-500" size={24}/>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-slate-800">Weryfikacja Praktyczna (W toku)</h2>
                            <p className="text-xs text-slate-500">Oczekujące na potwierdzenie</p>
                        </div>
                    </div>
                    {openSections.verification ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>

                {openSections.verification && (
                    <div className="border-t border-slate-100 p-6">
                        {categorizedSkills.verification.length === 0 ? (
                            <div className="text-center text-slate-400 text-sm">
                                Brak umiejętności oczekujących na weryfikację praktyczną.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(groupByCategory(categorizedSkills.verification)).map(([category, items]) => {
                                    const isCatOpen = openCategories[`verif-${category}`];
                                    return (
                                        <div key={category} className="rounded-lg border border-slate-200 overflow-hidden">
                                            <button 
                                                onClick={() => toggleCategory('verif', category)}
                                                className="w-full px-4 py-3 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Layers size={16} className="text-slate-400"/>
                                                    <span className="font-bold text-slate-700 text-sm">{category}</span>
                                                    <span className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">{items.length}</span>
                                                </div>
                                                {isCatOpen ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                                            </button>

                                            {isCatOpen && (
                                                <div className="divide-y divide-slate-100 border-t border-slate-100 bg-white">
                                                    {items.map((item: any) => {
                                                        const isExpanded = expandedId === item.id;
                                                        const checklist = getChecklist(item.id);
                                                        const resources = getResources(item.id);

                                                        return (
                                                            <div key={item.id} className="transition-colors hover:bg-slate-50">
                                                                <div 
                                                                    className="p-5 flex items-center justify-between cursor-pointer"
                                                                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                                                >
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                                                                            <Clock size={20}/>
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="font-bold text-slate-900">{item.name_pl}</h3>
                                                                            <div className="flex gap-2 mt-1">
                                                                                <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded font-medium border border-orange-100">
                                                                                    OCZEKUJE NA PRAKTYKĘ
                                                                                </span>
                                                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                                                    <Wallet size={12}/> Potencjał: +{item.hourly_bonus} zł
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                                                                </div>

                                                                {isExpanded && (
                                                                    <div className="px-5 pb-6 pt-2 pl-[4.5rem]">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                            <div>
                                                                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wide">Kryteria Weryfikacji</h4>
                                                                                <ul className="space-y-2">
                                                                                    {checklist.map((c: any, idx: number) => (
                                                                                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 group">
                                                                                            <div className="mt-0.5 w-4 h-4 border-2 border-slate-300 rounded bg-white flex-shrink-0 group-hover:border-slate-400"></div>
                                                                                            <span className="leading-tight">{c.text_pl}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                    {checklist.length === 0 && <li className="text-slate-400 italic text-sm">Brak zdefiniowanych kryteriów.</li>}
                                                                                </ul>
                                                                            </div>
                                                                            <div>
                                                                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wide">Materiały Pomocnicze</h4>
                                                                                <div className="space-y-2">
                                                                                    {resources.map(res => (
                                                                                        <a 
                                                                                            key={res.id} 
                                                                                            href={res.url} 
                                                                                            target="_blank" 
                                                                                            rel="noreferrer"
                                                                                            className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group"
                                                                                        >
                                                                                            <div className="bg-blue-50 text-blue-600 p-2 rounded">
                                                                                                {res.type === 'video' ? <Video size={16}/> : res.type === 'pdf' ? <FileText size={16}/> : <BookOpen size={16}/>}
                                                                                            </div>
                                                                                            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{res.title}</span>
                                                                                        </a>
                                                                                    ))}
                                                                                    {resources.length === 0 && <div className="text-sm text-slate-400 italic">Brak materiałów w bibliotece.</div>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* SEKCJA 3: DOSTĘPNE DO ZDOBYCIA (Nowe Umiejętności) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                    onClick={() => toggleSection('development')}
                    className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <TrendingUp className="text-blue-600" size={24}/>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-slate-800">Dostępne do zdobycia (Rozwój)</h2>
                            <p className="text-xs text-slate-500">Nowe umiejętności, testy i egzaminy</p>
                        </div>
                    </div>
                    {openSections.development ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>

                {openSections.development && (
                    <div className="p-6 border-t border-slate-100">
                        {categorizedSkills.development.length === 0 ? (
                            <div className="text-center text-slate-400 py-2">
                                Brak nowych umiejętności do zdobycia. Świetna robota!
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(groupByCategory(categorizedSkills.development)).map(([category, items]) => {
                                    const isCatOpen = openCategories[`dev-${category}`];
                                    return (
                                        <div key={category} className="rounded-lg border border-slate-200 overflow-hidden">
                                            <button 
                                                onClick={() => toggleCategory('dev', category)}
                                                className="w-full px-4 py-3 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Layers size={16} className="text-slate-400"/>
                                                    <span className="font-bold text-slate-700 text-sm">{category}</span>
                                                    <span className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">{items.length}</span>
                                                </div>
                                                {isCatOpen ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                                            </button>

                                            {isCatOpen && (
                                                <div className="p-4 bg-white border-t border-slate-100 space-y-2">
                                                    {items.map((item: any) => {
                                                        const { locked, cooldown } = isLocked(item.id);
                                                        const isRetry = item.userSkill?.status === SkillStatus.FAILED;
                                                        const resCount = getResources(item.id).length;
                                                        const test = tests.find(t => t.skill_ids.includes(item.id));
                                                        const hasAttempts = test && testAttempts.some(ta => ta.user_id === currentUser.id && ta.test_id === test.id);

                                                        return (
                                                            <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-300 transition-colors shadow-sm">
                                                                <div className="flex-1">
                                                                    <h3 className="font-bold text-slate-900 text-base">{item.name_pl}</h3>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                            {getVerificationLabel(item.verification_type)}
                                                                        </span>
                                                                        {isRetry && <span className="text-[10px] text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={10}/> Do poprawy</span>}
                                                                    </div>
                                                                </div>

                                                                <div className="md:text-right px-2">
                                                                    <div className="text-[10px] text-slate-400 uppercase font-bold">Dodatek</div>
                                                                    <div className="font-bold text-green-600 text-lg">+{item.hourly_bonus} zł/h</div>
                                                                </div>

                                                                <div className="flex gap-2 w-full md:w-auto">
                                                                    <Button 
                                                                        size="sm" 
                                                                        variant="secondary"
                                                                        className="flex-1 md:flex-none border-slate-200 text-slate-600 hover:bg-slate-50"
                                                                        onClick={() => handleOpenResources(item)}
                                                                        disabled={resCount === 0}
                                                                    >
                                                                        <BookOpen size={16} className="mr-2"/> Materiały ({resCount})
                                                                    </Button>

                                                                    {hasAttempts && (
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="secondary"
                                                                            className="flex-1 md:flex-none border-slate-200 text-slate-600 hover:bg-slate-50"
                                                                            onClick={() => test && setHistoryModal({ isOpen: true, testId: test.id })}
                                                                        >
                                                                            <List size={16} className="mr-2"/> Historia
                                                                        </Button>
                                                                    )}

                                                                    {locked ? (
                                                                        <Button size="sm" disabled className="flex-1 md:flex-none bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed">
                                                                            <Lock size={16} className="mr-2"/> {cooldown}h
                                                                        </Button>
                                                                    ) : (
                                                                        <Button 
                                                                            size="sm" 
                                                                            onClick={() => handleStartTest(item.id)}
                                                                            className={`flex-1 md:flex-none ${isRetry ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                                                        >
                                                                            {isRetry ? 'Popraw' : <><Play size={16} className="mr-2"/> Test</>}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* SEKCJA 4: DOKUMENTY (Nowa) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                    onClick={() => toggleSection('documents')}
                    className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <FileText className="text-purple-600" size={24}/>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-slate-800">Dokumenty i Uprawnienia</h2>
                            <p className="text-xs text-slate-500">Certyfikaty, SEP, UDT i inne dokumenty</p>
                        </div>
                    </div>
                    {openSections.documents ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>

                {openSections.documents && (
                    <div className="p-6 border-t border-slate-100 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 gap-4 mb-6">
                            {myDocuments.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                                            <FileText size={20}/>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">{doc.docName}</h4>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                                                    doc.status === SkillStatus.CONFIRMED ? 'bg-green-100 text-green-700' :
                                                    doc.status === SkillStatus.FAILED ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {SKILL_STATUS_LABELS[doc.status] || doc.status}
                                                </span>
                                                {(doc.bonus > 0) && (
                                                    <span className={`text-xs px-2 py-0.5 rounded border font-bold ${
                                                        doc.status === SkillStatus.CONFIRMED ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                                                    }`}>
                                                        +{doc.bonus} zł/h
                                                    </span>
                                                )}
                                                {doc.expires_at && (
                                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                                        <Calendar size={12}/> Ważny do: {doc.expires_at}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                                            onClick={() => {
                                                const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
                                                setFileViewer({ isOpen: true, urls, title: doc.docName, index: 0 });
                                            }}
                                        >
                                            <Eye size={14}/> Zobacz {doc.fileCount > 1 ? `(${doc.fileCount})` : ''}
                                        </button>
                                        <button
                                            className="text-slate-500 hover:text-slate-700 text-xs font-bold flex items-center gap-1 bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                                            onClick={() => {
                                                setEditingDocId(doc.id);
                                                setNewDocData({
                                                    typeId: 'other',
                                                    customName: doc.docName,
                                                    issue_date: doc.issue_date || new Date().toISOString().split('T')[0],
                                                    expires_at: doc.expires_at || '',
                                                    indefinite: doc.is_indefinite || false,
                                                    files: []
                                                });
                                                setIsDocModalOpen(true);
                                            }}
                                        >
                                            <RotateCcw size={14}/> Edytuj
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {myDocuments.length === 0 && (
                                <div className="text-center text-slate-400 py-4 italic">Brak dodanych dokumentów.</div>
                            )}
                        </div>
                        
                        <Button fullWidth variant="outline" onClick={() => {
                            setEditingDocId(null);
                            setNewDocData({ typeId: '', customName: '', issue_date: new Date().toISOString().split('T')[0], expires_at: '', indefinite: false, files: [] });
                            setIsDocModalOpen(true);
                        }} className="border-dashed border-2">
                            <Plus size={18} className="mr-2"/> Dodaj Nowy Dokument
                        </Button>
                    </div>
                )}
            </div>

            {renderResourceModal()}
            {renderHistoryModal()}
            {isDocModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-900">{editingDocId ? 'Edytuj Dokument' : 'Dodaj Dokument'}</h2>
                            <button onClick={() => setIsDocModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Typ Dokumentu</label>
                                <select 
                                    className="w-full border p-2 rounded bg-white"
                                    value={newDocData.typeId}
                                    onChange={e => setNewDocData({...newDocData, typeId: e.target.value})}
                                    disabled={!!editingDocId}
                                >
                                    <option value="">Wybierz dokument...</option>
                                    {BONUS_DOCUMENT_TYPES.map(type => (
                                        <option key={type.id} value={type.id}>
                                            {type.label} {type.bonus > 0 ? `(+${type.bonus} zł)` : '(Brak bonusu)'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {(newDocData.typeId === 'other' || editingDocId) && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nazwa Dokumentu</label>
                                    <input 
                                        className="w-full border p-2 rounded" 
                                        placeholder="Wpisz nazwę..." 
                                        value={newDocData.customName}
                                        onChange={e => setNewDocData({...newDocData, customName: e.target.value})}
                                    />
                                    <span className="text-xs text-slate-400">Za niestandardowe dokumenty bonus nie jest przyznawany automatycznie.</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Załącz Pliki</label>
                                <div className="flex gap-2 mb-2">
                                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
                                    <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileSelect} />
                                    
                                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                        <Upload size={16} className="mr-2"/> Pliki
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                                        <Camera size={16} className="mr-2"/> Zdjęcie
                                    </Button>
                                </div>
                                
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {newDocData.files.map((file, index) => (
                                        <div key={index} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs border border-slate-100">
                                            <span className="truncate max-w-[200px]">{file.name}</span>
                                            <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Data Wydania</label>
                                <input type="date" className="w-full border p-2 rounded" value={newDocData.issue_date} onChange={e => setNewDocData({...newDocData, issue_date: e.target.value})} />
                            </div>
                            <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded">
                                <input type="checkbox" id="indefinite" checked={newDocData.indefinite} onChange={e => setNewDocData({...newDocData, indefinite: e.target.checked})} className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
                                <label htmlFor="indefinite" className="text-sm text-slate-700 cursor-pointer font-medium">Dokument bezterminowy</label>
                            </div>
                            {!newDocData.indefinite && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Data Ważności</label>
                                    <input type="date" className="w-full border p-2 rounded" value={newDocData.expires_at} onChange={e => setNewDocData({...newDocData, expires_at: e.target.value})} />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="ghost" onClick={() => setIsDocModalOpen(false)}>Anuluj</Button>
                            <Button onClick={handleSaveDocument} disabled={(!newDocData.customName && !newDocData.typeId)}>Zapisz</Button>
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
