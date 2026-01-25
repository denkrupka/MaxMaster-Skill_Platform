
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Award, CheckCircle, Wallet, Clock, Lock, ChevronDown, ChevronUp, 
    BookOpen, Video, FileText, AlertTriangle, TrendingUp, Calendar, Layers, ChevronRight,
    X, ExternalLink, Play, Plus, Upload, Eye, RotateCcw, Camera, List, Sparkles, Target,
    Shield, Save, Search, History, CheckSquare, Paperclip, Loader2, FileCheck
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { SkillStatus, VerificationType, SkillCategory, LibraryResource, Skill, Test, Role } from '../../types';
import { Button } from '../../components/Button';
import { BONUS_DOCUMENT_TYPES, SKILL_STATUS_LABELS } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';

interface DocData {
    typeId: string;
    customName: string;
    issue_date: string;
    expires_at: string;
    indefinite: boolean;
    files: File[];
}

export const EmployeeSkills = () => {
    const { state, addCandidateDocument, updateCandidateDocumentDetails, updateUserSkillStatus } = useAppContext();
    const { currentUser, userSkills, skills, tests, testAttempts, qualityIncidents } = state;
    const navigate = useNavigate();
    
    const [openSections, setOpenSections] = useState({
        confirmed: true,
        verification: true,
        toAcquire: true,
        documents: true
    });

    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [newDocData, setNewDocData] = useState<DocData>({ 
        typeId: '',
        customName: '', 
        issue_date: new Date().toISOString().split('T')[0], 
        expires_at: '', 
        indefinite: false,
        files: []
    });
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });
    
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!currentUser) return null;

    const isCoordinator = currentUser.role === Role.COORDINATOR;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const toggleSection = (key: keyof typeof openSections) => { 
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] })); 
    };

    const toggleCategory = (category: string) => { 
        setOpenCategories(prev => ({ ...prev, [category]: !prev[category] })); 
    };

    const getTestData = (skillId: string) => {
        const test = tests.find(t => t.skill_ids.includes(skillId) && t.is_active && !t.is_archived);
        if (!test) return null;

        const summedBonus = test.skill_ids.reduce((acc, sid) => {
            const s = skills.find(sk => sk.id === sid);
            return acc + (s?.hourly_bonus || 0);
        }, 0);

        const attempts = testAttempts
            .filter(ta => ta.user_id === currentUser.id && ta.test_id === test.id)
            .sort((a,b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
        
        const lastAttempt = attempts[0];
        let isLocked = false;
        let cooldownText = '';

        if (lastAttempt && !lastAttempt.passed) {
            const unlockTime = new Date(new Date(lastAttempt.completed_at).getTime() + 24 * 60 * 60 * 1000);
            if (now < unlockTime) {
                const diffMs = unlockTime.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                isLocked = true;
                cooldownText = `${hours}h ${minutes}m`;
            }
        }

        return { test, summedBonus, isLocked, cooldownText };
    };

    const { confirmedSkills, pendingPracticeSkills, toAcquireSkillsByCategory } = useMemo(() => {
        const confirmed: any[] = []; 
        const pending: any[] = [];
        const toAcquireGroups: Record<string, any[]> = {};

        const skillsWithActiveTests = new Set<string>();
        tests.forEach(test => {
            if (test.is_active && !test.is_archived && Array.isArray(test.skill_ids)) {
                test.skill_ids.forEach(sid => skillsWithActiveTests.add(sid));
            }
        });

        skills.forEach(skill => {
            if (!skill.is_active || skill.is_archived) return;
            
            const userSkill = userSkills.find(us => us.user_id === currentUser.id && us.skill_id === skill.id);
            const status = userSkill?.status;

            if (status === SkillStatus.CONFIRMED) {
                confirmed.push({ ...skill, userSkill });
            } else if (status === SkillStatus.THEORY_PASSED || status === SkillStatus.PRACTICE_PENDING) {
                pending.push({ ...skill, userSkill });
            } else {
                if (
                    skill.verification_type !== VerificationType.DOCUMENT && 
                    skill.category !== SkillCategory.UPRAWNIENIA &&
                    skillsWithActiveTests.has(skill.id)
                ) {
                    const testData = getTestData(skill.id);
                    if (testData) {
                        if (!toAcquireGroups[skill.category]) toAcquireGroups[skill.category] = [];
                        if (!toAcquireGroups[skill.category].find(s => s.id === skill.id)) {
                            toAcquireGroups[skill.category].push({ ...skill, testData });
                        }
                    }
                }
            }
        });

        const sortedToAcquire: Record<string, any[]> = {};
        Object.keys(toAcquireGroups).sort().forEach(key => {
            sortedToAcquire[key] = toAcquireGroups[key];
        });

        return { 
            confirmedSkills: confirmed, 
            pendingPracticeSkills: pending,
            toAcquireSkillsByCategory: sortedToAcquire 
        };
    }, [skills, userSkills, tests, testAttempts, currentUser.id, now]);

    const myDocuments = useMemo(() => {
        return userSkills.filter(us => us.user_id === currentUser.id).map(us => {
                const skill = skills.find(s => s.id === us.skill_id);
                const isDoc = (skill?.verification_type === VerificationType.DOCUMENT) || (us.skill_id && typeof us.skill_id === 'string' && (us.skill_id.startsWith('doc_') || us.custom_type === 'doc_generic')) || !us.skill_id;
                
                if (isDoc) return { ...us, docName: us.custom_name || (skill ? skill.name_pl : 'Dokument'), bonus: skill ? skill.hourly_bonus : (us.bonus_value || 0), fileCount: ((us.document_urls as string[])?.length || 0) > 0 ? (us.document_urls as string[]).length : (us.document_url ? 1 : 0) };
                return null;
            }).filter(Boolean) as any[];
    }, [currentUser, userSkills, skills]);

    const handleTakeTest = (skillId: string) => {
        const testData = getTestData(skillId);
        if (testData?.isLocked) return;
        if (testData?.test) {
            navigate('/dashboard/run-test', { state: { selectedTestIds: [testData.test.id] } });
        } else {
            alert("Brak przypisanego testu.");
        }
    };

    const handleAddDocument = () => {
        setEditingDocId(null);
        setNewDocData({ typeId: '', customName: '', issue_date: new Date().toISOString().split('T')[0], expires_at: '', indefinite: false, files: [] });
        setIsDocModalOpen(true);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            setNewDocData((prev: DocData) => ({ ...prev, files: [...prev.files, ...selectedFiles] }));
        }
    };

    const removeFile = (index: number) => { 
        setNewDocData((prev: DocData) => ({ ...prev, files: prev.files.filter((_, i) => i !== index) })); 
    };

    const handleSaveDocument = async () => {
        if(!currentUser) return;
        setIsSaving(true);
        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' || editingDocId ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;
        
        const docPayload: any = { custom_name: docName, issue_date: newDocData.issue_date || null, expires_at: newDocData.indefinite ? null : (newDocData.expires_at || null), is_indefinite: newDocData.indefinite };
        
        const filesToUpload: File[] = (newDocData.files as File[]) || [];
        if (filesToUpload.length > 0) {
             const uploadedUrls: string[] = [];
             for (const file of filesToUpload) {
                 const url = await uploadDocument(file, currentUser.id);
                 if (url) uploadedUrls.push(url);
             }
             if (uploadedUrls.length > 0) { docPayload.document_urls = uploadedUrls; docPayload.document_url = uploadedUrls[0]; }
        }
        try {
            if (editingDocId) await updateCandidateDocumentDetails(editingDocId, docPayload);
            else await addCandidateDocument(currentUser.id, { skill_id: crypto.randomUUID(), custom_type: 'doc_generic', status: SkillStatus.PENDING, bonus_value: bonus, ...docPayload });
            setIsDocModalOpen(false);
        } catch (error) { console.error("Error saving document:", error); alert("Błąd podczas zapisywania dokumentu."); }
        finally { setIsSaving(false); }
    };

    const openFileViewer = (doc: any) => {
        const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
        setFileViewer({ isOpen: true, urls, title: doc.docName, index: 0 });
    };

    const getQualityStatus = (us: any) => {
        const incidents = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === currentUser.id && inc.skill_id === us.skill_id && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        if (incidents.length >= 2) return { status: 'blocked', label: 'Zablokowane', color: 'bg-red-100 text-red-700' };
        if (incidents.length === 1) return { status: 'warning', label: 'Ostrzeżenie', color: 'bg-yellow-100 text-yellow-700' };
        return { status: 'active', label: 'Aktywne', color: 'bg-green-100 text-green-700' };
    };

    // Explicitly cast files to any[] for TS compatibility
    const uploadedFiles: any[] = (newDocData.files as any[]) || [];

    return (
        <div className="p-3 sm:p-4 md:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 pb-24">
            <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">Umiejętności i Uprawnienia</h1>
                <p className="text-sm sm:text-base text-slate-500 font-medium">Zarządzaj swoją ścieżką rozwoju i stawką godzinową.</p>
            </div>

            {/* SECTION 1: CONFIRMED SKILLS */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <button onClick={() => toggleSection('confirmed')} className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-xl sm:rounded-2xl flex items-center justify-center text-green-600 shadow-inner">
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6"/>
                        </div>
                        <div className="text-left">
                            <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-800 uppercase tracking-tight">Zaliczone umiejętności</h2>
                            <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
                                {isCoordinator ? 'Twoje potwierdzone kompetencje' : 'Bonusy doliczone do Twojej stawki'}
                            </p>
                        </div>
                    </div>
                    {openSections.confirmed ? <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400"/> : <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400"/>}
                </button>
                {openSections.confirmed && (
                    <div className="p-3 sm:p-4 md:p-6">
                        {confirmedSkills.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {confirmedSkills.map(item => (
                                    <div key={item.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center shadow-sm group hover:border-green-300 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                                                <Award size={20}/>
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{item.name_pl}</div>
                                                <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border w-fit mt-1.5 ${getQualityStatus(item.userSkill).color}`}>
                                                    {getQualityStatus(item.userSkill).label}
                                                </div>
                                            </div>
                                        </div>
                                        {!isCoordinator && (
                                            <div className="text-right">
                                                <div className="text-lg font-black text-green-600 leading-none">+{item.hourly_bonus.toFixed(2)}</div>
                                                <div className="text-[8px] font-bold text-slate-400 uppercase">zł/h</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-400 font-bold italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">Nie posiadasz jeszcze potwierdzonych umiejętności.</div>
                        )}
                    </div>
                )}
            </div>

            {/* SECTION 2: PRACTICES TO VERIFY */}
            {pendingPracticeSkills.length > 0 && (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <button onClick={() => toggleSection('verification')} className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-xl sm:rounded-2xl flex items-center justify-center text-orange-600 shadow-inner">
                                <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6"/>
                            </div>
                            <div className="text-left">
                                <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-800 uppercase tracking-tight">Praktyki do Weryfikacji</h2>
                                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Oczekują na potwierdzenie przez przełożonego</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-[10px] sm:text-[11px] bg-white border border-slate-200 text-orange-600 px-1.5 sm:px-2 py-0.5 rounded-lg font-black">{pendingPracticeSkills.length}</span>
                            {openSections.verification ? <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400"/> : <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400"/>}
                        </div>
                    </button>
                    {openSections.verification && (
                        <div className="p-3 sm:p-4 md:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingPracticeSkills.map(item => (
                                    <button 
                                        key={item.id} 
                                        onClick={() => navigate('/dashboard/practice')}
                                        className="p-4 bg-orange-50/30 border border-orange-100 rounded-2xl flex justify-between items-center shadow-sm hover:border-orange-300 hover:bg-orange-50 transition-all text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm border border-orange-50">
                                                <Clock size={20}/>
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{item.name_pl}</div>
                                                <div className="text-[9px] font-black text-orange-600 uppercase mt-1 flex items-center gap-1">
                                                    Pokaż checklistę <ChevronRight size={10}/>
                                                </div>
                                            </div>
                                        </div>
                                        {!isCoordinator && (
                                            <div className="text-right">
                                                <div className="text-lg font-black text-orange-600 leading-none">+{item.hourly_bonus.toFixed(2)}</div>
                                                <div className="text-[8px] font-bold text-slate-400 uppercase">zł/h</div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* SECTION 3: SKILLS TO ACQUIRE */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 bg-slate-50 border-b border-slate-100">
                    <button onClick={() => toggleSection('toAcquire')} className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 text-left">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-xl sm:rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6"/>
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-lg md:text-xl font-bold text-slate-900 tracking-tight uppercase">Umiejętności do zdobycia</h2>
                            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 hidden sm:block">Wybierz kategorię i rozwiąż test</p>
                        </div>
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <button onClick={() => navigate('/dashboard/tests')} className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm uppercase tracking-wider flex-1 sm:flex-none">
                            <History className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" /> <span className="hidden xs:inline">Historia</span> Testów
                        </button>
                        <button onClick={() => toggleSection('toAcquire')} className="p-1.5 sm:p-2 text-slate-400">
                            {openSections.toAcquire ? <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6"/> : <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6"/>}
                        </button>
                    </div>
                </div>

                {openSections.toAcquire && (
                    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                        {Object.keys(toAcquireSkillsByCategory).length > 0 ? (
                            Object.entries(toAcquireSkillsByCategory).map(([category, skillList]) => (
                                <div key={category} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <button onClick={() => toggleCategory(category)} className="w-full px-5 py-4 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100 transition-colors border-b border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-blue-500 shadow-sm"><Target size={18}/></div>
                                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.15em]">{category}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-lg font-black">{skillList.length}</span>
                                            {openCategories[category] ? <ChevronUp size={18} className="text-slate-300"/> : <ChevronDown size={18} className="text-slate-300"/>}
                                        </div>
                                    </button>
                                    
                                    {openCategories[category] && (
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200 bg-white">
                                            {skillList.map(skill => {
                                                const testData = getTestData(skill.id);
                                                const isLocked = testData?.isLocked;
                                                const bonus = testData?.summedBonus || skill.hourly_bonus;
                                                return (
                                                    <button key={skill.id} onClick={() => handleTakeTest(skill.id)} disabled={isLocked} className={`p-4 bg-white border rounded-2xl flex justify-between items-center group transition-all text-left relative overflow-hidden ${isLocked ? 'border-slate-100 opacity-60 cursor-not-allowed' : 'border-slate-100 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/5'}`}>
                                                        {!isLocked && <div className="absolute inset-y-0 left-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-inner ${isLocked ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                                                {isLocked ? <Lock size={18}/> : <Play size={18} fill="currentColor" className="ml-1"/>}
                                                            </div>
                                                            <div>
                                                                <span className={`text-sm font-bold block ${isLocked ? 'text-slate-500' : 'text-slate-700 group-hover:text-slate-900'}`}>{skill.name_pl}</span>
                                                                {isLocked ? (
                                                                    <div className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-tighter mt-0.5"><Clock size={10}/> Dostępny za: {testData?.cooldownText}</div>
                                                                ) : testData?.test?.skill_ids.length > 1 ? (
                                                                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter mt-0.5 flex items-center gap-1"><Layers size={10}/> Pakiet: {testData.test.skill_ids.length} umiejętności</div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        {!isCoordinator && (
                                                            <div className="text-right">
                                                                <div className={`text-[13px] font-black ${isLocked ? 'text-slate-300' : 'text-blue-600'}`}>+{bonus.toFixed(2)}</div>
                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">zł/h</div>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-16 text-slate-400 font-bold italic bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <Search size={32} className="mx-auto mb-3 opacity-30"/>
                                Gratulacje! Zdobyłeś już wszystkie dostępne umiejętności z aktualnymi testami.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* SECTION 4: DOCUMENTS */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <button onClick={() => toggleSection('documents')} className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 text-left">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-xl sm:rounded-2xl flex items-center justify-center text-purple-600 shadow-inner"><FileText className="w-5 h-5 sm:w-6 sm:h-6"/></div>
                        <div className="text-left">
                            <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-800 uppercase tracking-tight">Dokumenty i Uprawnienia</h2>
                            <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">SEP, UDT, BHP i orzeczenia lekarskie</p>
                        </div>
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleAddDocument(); }}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 shadow-lg shadow-purple-600/20 transition-all active:scale-95 flex-1 sm:flex-none"
                        >
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4"/> Dodaj Dokument
                        </button>
                        <button onClick={() => toggleSection('documents')} className="p-1.5 sm:p-2 text-slate-400">
                            {openSections.documents ? <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6"/> : <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6"/>}
                        </button>
                    </div>
                </div>
                {openSections.documents && (
                    <div className="p-3 sm:p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {myDocuments.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-purple-300 transition-colors shadow-sm group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-inner"><Shield size={20}/></div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{doc.docName}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${doc.status === SkillStatus.CONFIRMED ? 'bg-green-50 text-green-700 border-green-100' : doc.status === SkillStatus.FAILED ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                    {SKILL_STATUS_LABELS[doc.status]}
                                                </span>
                                                {!isCoordinator && doc.bonus > 0 && <span className="text-[10px] font-bold text-green-600">+{doc.bonus} zł/h</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => openFileViewer(doc)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                                            title="Podgląd dokumentu"
                                        >
                                            <Eye size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {myDocuments.length === 0 && (
                                <div className="col-span-full text-center py-12 text-slate-400 font-bold italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    Brak dodanych dokumentów. Kliknij przycisk powyżej, aby przesłać swój pierwszy certyfikat lub uprawnienie.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* --- REDESIGNED BEAUTIFUL COMPACT DOCUMENT MODAL --- */}
            {isDocModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl sm:rounded-[24px] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
                        {/* Header */}
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                                    <FileText className="text-blue-600 w-4 h-4 sm:w-5 sm:h-5"/> Dodaj Dokument
                                </h3>
                                <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 hidden sm:block">Certyfikaty, uprawnienia i orzeczenia</p>
                            </div>
                            <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-white rounded-full shadow-sm">
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                            {/* Typ dokumentu */}
                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5 flex items-center gap-1.5">
                                    <Shield size={10} className="text-blue-500"/> WYBIERZ TYP
                                </label>
                                <select 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-inner appearance-none" 
                                    value={newDocData.typeId} 
                                    onChange={e => setNewDocData({...newDocData, typeId: e.target.value})}
                                >
                                    <option value="">Wybierz dokument...</option>
                                    {BONUS_DOCUMENT_TYPES.map(type => (
                                        <option key={type.id} value={type.id}>
                                            {type.label} {!isCoordinator && type.bonus > 0 ? `(+${type.bonus.toFixed(2)} zł)` : ''}
                                        </option>
                                    ))}
                                    <option value="other">Inny (własna nazwa)</option>
                                </select>
                            </div>

                            {/* Własna nazwa (warunkowo) */}
                            {(newDocData.typeId === 'other' || editingDocId) && (
                                <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">NAZWA NIESTANDARDOWA</label>
                                    <input 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                        placeholder="Wpisz nazwę dokumentu..." 
                                        value={newDocData.customName} 
                                        onChange={e => setNewDocData({...newDocData, customName: e.target.value})} 
                                    />
                                </div>
                            )}

                            {/* Załączniki - Slimmer Dropzone */}
                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5 flex items-center gap-1.5">
                                    <Paperclip size={10} className="text-blue-500"/> ZAŁĄCZNIKI
                                </label>
                                <div 
                                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center hover:bg-white hover:border-blue-400 transition-all cursor-pointer group"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors shadow-sm mb-1.5">
                                        <Upload size={18}/>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 group-hover:text-blue-600 uppercase">Wybierz pliki</p>
                                </div>

                                {/* Fixed: Explicitly cast files to any[] and map to resolve 'unknown' type error */}
                                {(uploadedFiles as any[]).length > 0 && (
                                    <div className="mt-2 space-y-1 max-h-24 overflow-y-auto pr-1 scrollbar-hide">
                                        {(uploadedFiles as any[]).map((f, i) => (
                                            <div key={i} className="flex justify-between items-center bg-blue-50/50 border border-blue-100 p-1.5 rounded-lg text-[9px] font-black text-blue-700 animate-in slide-in-from-left-1">
                                                <span className="truncate max-w-[200px]">{f.name}</span>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-red-400 hover:text-red-600 p-0.5">
                                                    <X size={12}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Daty Grid - Native click triggered by type="date" */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5 flex items-center gap-1.5">
                                        <Calendar size={10} className="text-blue-500"/> WYDANO
                                    </label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold text-xs focus:bg-white outline-none shadow-inner" 
                                        value={newDocData.issue_date} 
                                        onChange={e => setNewDocData({...newDocData, issue_date: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5 flex items-center gap-1.5">
                                        <Calendar size={10} className="text-blue-500"/> WAŻNY DO
                                    </label>
                                    <input 
                                        type="date" 
                                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold text-xs focus:bg-white outline-none shadow-inner transition-opacity ${newDocData.indefinite ? 'opacity-30 pointer-events-none' : ''}`} 
                                        value={newDocData.expires_at} 
                                        onChange={e => setNewDocData({...newDocData, expires_at: e.target.value})}
                                        disabled={newDocData.indefinite} 
                                    />
                                </div>
                            </div>

                            {/* Panel Bezterminowy - Compact */}
                            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${newDocData.indefinite ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${newDocData.indefinite ? 'bg-white border-white text-blue-600' : 'bg-white border-slate-300'}`}>
                                    {newDocData.indefinite && <CheckCircle size={14} />}
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest">Dokument Bezterminowy</span>
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={newDocData.indefinite} 
                                    onChange={e => setNewDocData({...newDocData, indefinite: e.target.checked})} 
                                />
                            </label>
                        </div>

                        {/* Footer - Compressed */}
                        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                            <button onClick={() => setIsDocModalOpen(false)} className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors py-2 sm:py-0">
                                Anuluj
                            </button>
                            <Button
                                onClick={handleSaveDocument}
                                /* Fixed: cast files to any[] for length check to resolve 'unknown' type error */
                                disabled={!newDocData.typeId || ((uploadedFiles as any[]).length === 0 && !editingDocId) || isSaving}
                                className="flex-[2] h-10 sm:h-11 rounded-lg sm:rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 text-[10px] sm:text-xs"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4"/>}
                                {editingDocId ? 'ZAKTUALIZUJ' : 'ZAPISZ'}
                            </Button>
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
