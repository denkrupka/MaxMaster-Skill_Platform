
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Award, CheckCircle, Wallet, Clock, Lock, ChevronDown, ChevronUp, 
    BookOpen, Video, FileText, AlertTriangle, TrendingUp, Calendar, Layers, ChevronRight,
    X, ExternalLink, Play, Plus, Upload, Eye, RotateCcw, Camera, List, Sparkles, Target,
    Shield, Save, Search, History, CheckSquare
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { SkillStatus, VerificationType, SkillCategory, LibraryResource, Skill, Test } from '../../types';
import { Button } from '../../components/Button';
import { BONUS_DOCUMENT_TYPES, SKILL_STATUS_LABELS } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';

export const EmployeeSkills = () => {
    const { state, addCandidateDocument, updateCandidateDocumentDetails, updateUserSkillStatus } = useAppContext();
    const { currentUser, userSkills, skills, tests, testAttempts, qualityIncidents } = state;
    const navigate = useNavigate();
    
    const [openSections, setOpenSections] = useState({
        confirmed: true,
        verification: true,
        toAcquire: true,
        documents: false
    });

    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
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
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });
    
    // Force re-render for timers
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!currentUser) return null;

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const toggleSection = (key: keyof typeof openSections) => { 
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] })); 
    };

    const toggleCategory = (category: string) => { 
        setOpenCategories(prev => ({ ...prev, [category]: !prev[category] })); 
    };

    // --- LOGIC: DB-DRIVEN COOLDOWN & SUMMED RATE ---
    const getTestData = (skillId: string) => {
        const test = tests.find(t => t.skill_ids.includes(skillId) && t.is_active && !t.is_archived);
        if (!test) return null;

        // Calculate Summed Bonus for the entire test package
        const summedBonus = test.skill_ids.reduce((acc, sid) => {
            const s = skills.find(sk => sk.id === sid);
            return acc + (s?.hourly_bonus || 0);
        }, 0);

        // Check Cooldown from DB attempts
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

    // --- DATA CALCULATIONS ---

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
                if (isDoc) return { ...us, docName: us.custom_name || (skill ? skill.name_pl : 'Dokument'), bonus: skill ? skill.hourly_bonus : (us.bonus_value || 0), fileCount: us.document_urls ? us.document_urls.length : (us.document_url ? 1 : 0) };
                return null;
            }).filter(Boolean) as any[];
    }, [currentUser, userSkills, skills]);

    // --- ACTIONS ---

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
        if (selectedFiles.length > 0) setNewDocData(prev => ({ ...prev, files: [...prev.files, ...selectedFiles] }));
    };

    const removeFile = (index: number) => { 
        setNewDocData(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) })); 
    };

    const handleSaveDocument = async () => {
        if(!currentUser) return;
        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' || editingDocId ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;
        if (!docName) return alert("Podaj nazwę dokumentu.");
        const docPayload: any = { custom_name: docName, issue_date: newDocData.issue_date || null, expires_at: newDocData.indefinite ? null : (newDocData.expires_at || null), is_indefinite: newDocData.indefinite };
        if (newDocData.files.length > 0) {
             const uploadedUrls: string[] = [];
             for (const file of newDocData.files) {
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

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 pb-24">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Umiejętności i Uprawnienia</h1>
                <p className="text-slate-500 font-medium">Zarządzaj swoją ścieżką rozwoju i stawką godzinową.</p>
            </div>

            {/* SECTION 1: CONFIRMED SKILLS */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <button onClick={() => toggleSection('confirmed')} className="w-full px-6 py-5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 shadow-inner">
                            <CheckCircle size={24}/>
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Zaliczone umiejętności</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bonusy doliczone do Twojej stawki</p>
                        </div>
                    </div>
                    {openSections.confirmed ? <ChevronUp size={24} className="text-slate-400"/> : <ChevronDown size={24} className="text-slate-400"/>}
                </button>
                {openSections.confirmed && (
                    <div className="p-6">
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
                                        <div className="text-right">
                                            <div className="text-lg font-black text-green-600 leading-none">+{item.hourly_bonus.toFixed(2)}</div>
                                            <div className="text-[8px] font-bold text-slate-400 uppercase">zł/h</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-400 font-bold italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">Nie posiadasz jeszcze potwierdzonych umiejętności.</div>
                        )}
                    </div>
                )}
            </div>

            {/* SECTION 2: PRACTICES TO VERIFY (ONLY IF PENDING) */}
            {pendingPracticeSkills.length > 0 && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <button onClick={() => toggleSection('verification')} className="w-full px-6 py-5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shadow-inner">
                                <CheckSquare size={24}/>
                            </div>
                            <div className="text-left">
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Praktyki do Weryfikacji</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Oczekują na potwierdzenie przez Brygadzistę</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] bg-white border border-slate-200 text-orange-600 px-2 py-0.5 rounded-lg font-black">{pendingPracticeSkills.length}</span>
                            {openSections.verification ? <ChevronUp size={24} className="text-slate-400"/> : <ChevronDown size={24} className="text-slate-400"/>}
                        </div>
                    </button>
                    {openSections.verification && (
                        <div className="p-6">
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
                                        <div className="text-right">
                                            <div className="text-lg font-black text-orange-600 leading-none">+{item.hourly_bonus.toFixed(2)}</div>
                                            <div className="text-[8px] font-bold text-slate-400 uppercase">zł/h</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* SECTION 3: SKILLS TO ACQUIRE */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="w-full px-6 py-5 flex items-center justify-between bg-slate-50 border-b border-slate-100">
                    <button onClick={() => toggleSection('toAcquire')} className="flex items-center gap-4 flex-1 text-left">
                        <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                            <Sparkles size={24}/>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight uppercase">Umiejętności do zdobycia</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Wybierz kategorię i rozwiąż test</p>
                        </div>
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/dashboard/tests')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm uppercase tracking-wider">
                            <History size={16} className="text-blue-500" /> Historia Testów
                        </button>
                        <button onClick={() => toggleSection('toAcquire')} className="p-2 text-slate-400 hover:text-slate-600">
                            {openSections.toAcquire ? <ChevronUp size={24}/> : <ChevronDown size={24}/>}
                        </button>
                    </div>
                </div>

                {openSections.toAcquire && (
                    <div className="p-6 space-y-4">
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
                                                const isLocked = skill.testData?.isLocked;
                                                const bonus = skill.testData?.summedBonus || skill.hourly_bonus;
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
                                                                    <div className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-tighter mt-0.5"><Clock size={10}/> Dostępny za: {skill.testData.cooldownText}</div>
                                                                ) : skill.testData?.test?.skill_ids.length > 1 ? (
                                                                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter mt-0.5 flex items-center gap-1"><Layers size={10}/> Pakiet: {skill.testData.test.skill_ids.length} umiejętności</div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className={`text-[13px] font-black ${isLocked ? 'text-slate-300' : 'text-blue-600'}`}>+{bonus.toFixed(2)}</div>
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">zł/h</div>
                                                        </div>
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
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <button onClick={() => toggleSection('documents')} className="w-full px-6 py-5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 shadow-inner"><FileText size={24}/></div>
                        <div className="text-left">
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Dokumenty i Uprawnienia</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SEP, UDT, BHP i orzeczenia lekarskie</p>
                        </div>
                    </div>
                    {openSections.documents ? <ChevronUp size={24} className="text-slate-400"/> : <ChevronDown size={24} className="text-slate-400"/>}
                </button>
                {openSections.documents && (
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {myDocuments.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-purple-300 transition-colors shadow-sm group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors"><Shield size={20}/></div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{doc.docName}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${doc.status === SkillStatus.CONFIRMED ? 'bg-green-50 text-green-700 border-green-200' : doc.status === SkillStatus.FAILED ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{SKILL_STATUS_LABELS[doc.status]}</span>
                                                {doc.bonus > 0 && <span className={`text-[10px] font-black ${doc.status === SkillStatus.CONFIRMED ? 'text-green-600' : 'text-slate-300'}`}>• +{doc.bonus.toFixed(2)} zł/h</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" onClick={() => openFileViewer(doc)}><Eye size={18}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button fullWidth variant="outline" onClick={handleAddDocument} className="h-12 rounded-2xl border-dashed border-2 font-black uppercase text-xs tracking-widest border-slate-300 text-slate-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all"><Plus size={18} className="mr-2"/> Dodaj Nowy Dokument</Button>
                    </div>
                )}
            </div>

            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} title={fileViewer.title} />
        </div>
    );
};
