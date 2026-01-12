
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
    Clock, CheckCircle, TrendingUp, AlertTriangle, ChevronRight, User, 
    Play, BookOpen, Video, FileText, ChevronDown, ChevronUp, Lock, AlertCircle, Info, X, HelpCircle, ClipboardList, Briefcase, Phone, Mail, Plus, Upload, Calendar, Camera, Eye, ChevronLeft, RotateCcw
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { SkillStatus, VerificationType, LibraryResource, Role, ContractType } from '../../types';
import { CHECKLIST_TEMPLATES, SKILL_STATUS_LABELS, BONUS_DOCUMENT_TYPES, CONTRACT_TYPE_LABELS } from '../../constants';
import { useNavigate } from 'react-router-dom';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';

export const TrialDashboard = () => {
    const { state, startTest, submitTest, triggerNotification, addCandidateDocument } = useAppContext();
    const { currentUser, userSkills, skills, tests, libraryResources, testAttempts } = state;
    const navigate = useNavigate();

    // --- State for Modals/Expansions ---
    const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
    const [breakdownType, setBreakdownType] = useState<'current' | 'potential' | null>(null);
    
    // Contact Modals
    const [showBrigadirModal, setShowBrigadirModal] = useState(false);
    const [showHrModal, setShowHrModal] = useState(false);

    // Document Modal
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [newDocData, setNewDocData] = useState({ 
        typeId: '',
        customName: '', 
        issue_date: new Date().toISOString().split('T')[0], 
        expires_at: '', 
        indefinite: false,
        files: [] as File[] // Array of files
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // File Viewer State
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // --- State for Collapsible Sections ---
    const [sectionsOpen, setSectionsOpen] = useState({
        summary: false,
        verification: false,
        development: true,
        documents: false
    });

    // Force re-render for timer every minute
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const toggleSection = (section: keyof typeof sectionsOpen) => {
        setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // --- 1. TIME CALCULATIONS (ROBUST) ---
    const trialTimeData = useMemo(() => {
        if (!currentUser?.trial_end_date || !currentUser?.hired_date) return null;
        
        const start = new Date(currentUser.hired_date).getTime();
        const end = new Date(currentUser.trial_end_date).getTime();
        const currentTime = now.getTime();
        
        // Prevent negative values
        const totalDuration = Math.max(0, end - start);
        const elapsed = Math.max(0, currentTime - start);
        const remaining = end - currentTime;
        
        const isEnded = remaining <= 0;
        const daysLeft = isEnded ? 0 : Math.ceil(remaining / (1000 * 3600 * 24));
        const percent = isEnded ? 100 : Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        
        return { 
            daysLeft, 
            percent, 
            endDate: currentUser.trial_end_date,
            isEnded 
        };
    }, [currentUser, now]);

    // --- HR EVENT TRIGGER ---
    useEffect(() => {
        if (trialTimeData?.isEnded && currentUser) {
            const title = "Okres próbny zakończony";
            const message = `Okres próbny dla pracownika ${currentUser.first_name} ${currentUser.last_name} zakończony – wymagane działanie: decyzja + przygotowanie umowy`;
            
            const alreadyNotified = state.appNotifications.some(n => n.message === message);
            
            if (!alreadyNotified) {
                triggerNotification('trial_ending', title, message, '/hr/trial');
            }
        }
    }, [trialTimeData?.isEnded, currentUser, state.appNotifications, triggerNotification]);

    // --- 2. SALARY LOGIC (CATEGORIZED) ---
    const salaryData = useMemo(() => {
        if (!currentUser) return { 
            current: 0, 
            potential: 0, 
            groups: { base: [], contract: [], skills: [], documents: [] } 
        };
        
        const isTrialEnded = trialTimeData?.isEnded || false;
        const trialStartDate = currentUser.hired_date ? new Date(currentUser.hired_date) : new Date(0);

        // --- 1. BASE ---
        const baseRate = currentUser.base_rate || 24;
        const baseGroup = [{ name: 'Stawka Bazowa', value: baseRate, status: 'Umowa', included: true, color: 'text-slate-900', includedInCurrent: true, includedInPotential: true }];

        // --- 2. CONTRACT ---
        const contractType = currentUser.contract_type || ContractType.UOP;
        const cBonus = state.systemConfig.contractBonuses[contractType] || 0;
        const sBonus = (contractType === ContractType.UZ && currentUser.is_student) ? 3 : 0;
        const totalContractBonus = cBonus + sBonus;
        
        const contractGroup = [];
        if (totalContractBonus > 0) {
            contractGroup.push({
                name: `${CONTRACT_TYPE_LABELS[contractType]}${currentUser.is_student ? ' (Student)' : ''}`,
                value: totalContractBonus,
                status: 'Aktywny',
                included: true,
                color: 'text-blue-600',
                includedInCurrent: true,
                includedInPotential: true
            });
        }

        let currentTotal = baseRate + totalContractBonus;
        let potentialTotal = baseRate + totalContractBonus;

        const skillsGroup: any[] = [];
        const documentsGroup: any[] = [];

        const mySkills = userSkills.filter(us => us.user_id === currentUser.id);
        
        mySkills.forEach(us => {
            const skill = skills.find(s => s.id === us.skill_id);
            const isDoc = (skill?.verification_type === VerificationType.DOCUMENT) || (us.skill_id && typeof us.skill_id === 'string' && (us.skill_id.startsWith('doc_') || us.custom_type === 'doc_generic'));
            
            let bonusAmount = skill ? skill.hourly_bonus : (us.bonus_value || 0);
            const docName = us.custom_name || (skill ? skill.name_pl : 'Dokument');

            const isConfirmed = us.status === SkillStatus.CONFIRMED;
            const isFailed = us.status === SkillStatus.FAILED;
            
            let statusLabel = '';
            let statusColor = '';
            let isIncludedInCurrent = false;
            let isIncludedInPotential = false;

            // STATUS LOGIC
            if (isConfirmed) {
                statusLabel = 'Zaliczone';
                statusColor = 'text-green-600';
                
                // CHECK IF PRE-EXISTING (Before Trial Start)
                // If confirmed_at is present and before trial start date, it is included in current.
                const confirmedAt = us.confirmed_at ? new Date(us.confirmed_at) : null;
                const isPreExisting = confirmedAt && confirmedAt < trialStartDate;

                if (isPreExisting) {
                    isIncludedInCurrent = true;
                } else {
                    // Acquired during trial -> ONLY in potential
                    isIncludedInCurrent = false;
                }
                isIncludedInPotential = true;

            } else if (isFailed) {
                statusLabel = 'Odrzucone';
                statusColor = 'text-red-600';
                isIncludedInCurrent = false;
                isIncludedInPotential = false; // Failed doesn't count for potential anymore (unless retry possible, but simplified here)
            } else {
                // Pending
                if (isDoc) {
                    statusLabel = 'Oczekuje na weryfikację';
                    statusColor = 'text-blue-500';
                } else {
                    statusLabel = 'Oczekuje na praktykę';
                    statusColor = 'text-yellow-600';
                }

                isIncludedInCurrent = false;

                if (!isTrialEnded) {
                    isIncludedInPotential = true;
                } else {
                    statusLabel += ' (Brak czasu)';
                    statusColor = 'text-red-400';
                    isIncludedInPotential = false;
                }
            }

            if (bonusAmount > 0) {
                const item = {
                    name: docName,
                    value: bonusAmount,
                    status: statusLabel,
                    statusColor,
                    includedInCurrent: isIncludedInCurrent,
                    includedInPotential: isIncludedInPotential
                };

                if (isDoc) documentsGroup.push(item);
                else skillsGroup.push(item);

                if (isIncludedInCurrent) currentTotal += bonusAmount;
                if (isIncludedInPotential) potentialTotal += bonusAmount;
            }
        });

        return {
            current: parseFloat(currentTotal.toFixed(2)),
            potential: parseFloat(potentialTotal.toFixed(2)),
            groups: {
                base: baseGroup,
                contract: contractGroup,
                skills: skillsGroup,
                documents: documentsGroup
            }
        };
    }, [currentUser, userSkills, skills, trialTimeData, state.systemConfig]);

    // --- 3. SUMMARY DATA (For Ended State) ---
    const summaryData = useMemo(() => {
        if (!currentUser) return { confirmed: [], unconfirmed: [] };
        const mySkills = userSkills.filter(us => us.user_id === currentUser.id);
        
        const confirmed: any[] = [];
        const unconfirmed: any[] = [];

        mySkills.forEach(us => {
            const skill = skills.find(s => s.id === us.skill_id);
            const bonus = skill ? skill.hourly_bonus : (us.bonus_value || 0);
            const name = us.custom_name || (skill ? skill.name_pl : 'Dokument');

            if (bonus === 0 && !skill) return; // Skip if no value and not a skill

            if (us.status === SkillStatus.CONFIRMED) {
                confirmed.push({ name: name, bonus: bonus });
            } else {
                unconfirmed.push({ 
                    name: name, 
                    status: us.status,
                    bonus: bonus 
                });
            }
        });
        return { confirmed, unconfirmed };
    }, [currentUser, userSkills, skills]);

    // --- 4. LISTS ---
    const pendingSkills = useMemo(() => {
        if (!currentUser) return [];
        return userSkills
            .filter(us => us.user_id === currentUser.id)
            .map(us => {
                const skill = skills.find(s => s.id === us.skill_id);
                if (!skill) return null;
                
                // Show in Verification ONLY if Theory Passed or Practice Pending or Confirmed
                // EXCLUDE FAILED - Failed stays in Development list for retry
                if (skill.verification_type === VerificationType.THEORY_PRACTICE && 
                   (us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING || us.status === SkillStatus.CONFIRMED)) {
                    return { ...us, skill };
                }
                return null;
            })
            .filter(Boolean) as any[];
    }, [currentUser, userSkills, skills]);

    const availableDevelopment = useMemo(() => {
        if (!currentUser) return [];
        const myUserSkills = userSkills.filter(us => us.user_id === currentUser.id);
        
        const filtered = skills.filter(s => {
            // Find if user has this skill assigned
            const userSkill = myUserSkills.find(us => us.skill_id === s.id);
            
            // Skill is available in "Development" list if:
            // 1. User doesn't have it yet (isNew)
            // 2. OR User has it but status is PENDING (Reset or Not Started)
            // 3. OR User has FAILED (Needs retry)
            // 4. OR User has THEORY_PASSED (To show success state in list)
            const isAvailable = !userSkill || 
                                userSkill.status === SkillStatus.PENDING || 
                                userSkill.status === SkillStatus.FAILED ||
                                userSkill.status === SkillStatus.THEORY_PASSED;

            return (
                isAvailable &&
                s.is_active && 
                !s.is_archived &&
                s.verification_type !== VerificationType.DOCUMENT &&
                tests.some(t => t.skill_ids.includes(s.id) && t.is_active && !t.is_archived)
            );
        });

        // SORTING: 1. Available/New, 2. Passed, 3. Failed
        return filtered.sort((a, b) => {
            const usA = myUserSkills.find(us => us.skill_id === a.id);
            const usB = myUserSkills.find(us => us.skill_id === b.id);

            const getRank = (us: any) => {
                // If user doesn't have the skill or it's PENDING -> Rank 1 (Top)
                if (!us || us.status === SkillStatus.PENDING) return 1;
                // If passed -> Rank 2
                if (us.status === SkillStatus.THEORY_PASSED) return 2;
                // If failed -> Rank 3
                if (us.status === SkillStatus.FAILED) return 3;
                return 4;
            };

            return getRank(usA) - getRank(usB);
        });
    }, [currentUser, userSkills, skills, tests]);

    // --- 5. DOCUMENTS LIST ---
    const myDocuments = useMemo(() => {
        if (!currentUser) return [];
        return userSkills
            .filter(us => us.user_id === currentUser.id)
            .map(us => {
                // Check if linked to a system skill (e.g. SEP) or generic doc
                const skill = skills.find(s => s.id === us.skill_id);
                const isDoc = (skill?.verification_type === VerificationType.DOCUMENT) || (us.skill_id && typeof us.skill_id === 'string' && (us.skill_id.startsWith('doc_') || us.custom_type === 'doc_generic')) || !us.skill_id;
                
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
    const getBrigadir = () => {
        return state.users.find(u => u.id === currentUser?.assigned_brigadir_id);
    };

    const getHrContact = () => {
        return state.users.find(u => u.role === Role.HR);
    };

    const getChecklist = (skillId: string) => {
        const template = CHECKLIST_TEMPLATES.find(t => t.skill_id === skillId);
        if (template) return template.items;
        
        const skill = skills.find(s => s.id === skillId);
        if (skill?.criteria) {
            return skill.criteria.map((c, i) => ({ id: i, text_pl: c, required: true }));
        }
        return [];
    };

    const getLibraryResources = (skillId: string) => {
        return libraryResources.filter(r => r.skill_ids.includes(skillId) && !r.is_archived);
    };

    const handleTakeTest = (skillId: string) => {
        const test = tests.find(t => t.skill_ids.includes(skillId));
        if (test) {
            // Direct navigation
            navigate('/trial/tests', { state: { selectedTestIds: [test.id] } });
        } else {
            alert("Brak testu dla tej umiejętności w systemie.");
        }
    };

    // Calculate Cooldown for FAILED tests (24h)
    const getCooldownInfo = (skillId: string) => {
        if (!currentUser) return { isLocked: false, hours: 0, minutes: 0 };
        
        const test = tests.find(t => t.skill_ids.includes(skillId));
        if (!test) return { isLocked: false, hours: 0, minutes: 0 };

        const attempts = testAttempts
            .filter(ta => ta.user_id === currentUser.id && ta.test_id === test.id)
            .sort((a,b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
        
        const lastAttempt = attempts[0];

        if (lastAttempt && !lastAttempt.passed) {
            const currentTime = now.getTime();
            const attemptDate = new Date(lastAttempt.completed_at);
            const unlockDate = new Date(attemptDate.getTime() + 24 * 60 * 60 * 1000); // 24h lockout
            
            if (currentTime < unlockDate.getTime()) {
                const diffMs = unlockDate.getTime() - currentTime;
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                return { isLocked: true, hours, minutes };
            }
        }
        
        return { isLocked: false, hours: 0, minutes: 0 };
    };

    // --- DOCUMENT HANDLERS ---
    const handleAddDocument = () => {
        if (trialTimeData?.isEnded) return;
        setNewDocData({ typeId: '', customName: '', issue_date: new Date().toISOString().split('T')[0], expires_at: '', indefinite: false, files: [] });
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

    const handleSaveDocument = async () => {
        if(!currentUser) return;
        
        const employeeId = currentUser.id;
        console.log('Employee ID for trial upload:', employeeId);

        if (!employeeId || employeeId.includes('virtual')) {
            alert('Błąd identyfikacji użytkownika.');
            return;
        }

        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;

        if (!docName) return alert("Podaj nazwę dokumentu.");
        if (newDocData.files.length === 0) return alert("Załącz przynajmniej jeden plik.");

        const uploadedUrls: string[] = [];
        for (const file of newDocData.files) {
            console.log('Uploading file for trial:', employeeId);
            const url = await uploadDocument(file, employeeId);
            if (url) {
                console.log('Upload success:', url);
                uploadedUrls.push(url);
            }
        }

        if (uploadedUrls.length === 0) return alert("Błąd przesyłania plików.");

        const docPayload = {
            custom_type: 'doc_generic',
            status: SkillStatus.PENDING,
            custom_name: docName,
            document_urls: uploadedUrls,
            document_url: uploadedUrls[0],
            bonus_value: bonus,
            issue_date: newDocData.issue_date,
            expires_at: newDocData.indefinite ? null : (newDocData.expires_at || null),
            is_indefinite: newDocData.indefinite,
        };

        try {
            console.log('Calling addCandidateDocument with:', employeeId, docPayload);
            await addCandidateDocument(employeeId, docPayload);
            console.log('Document successfully added to user_skills');
            setIsDocModalOpen(false);
            triggerNotification('doc_uploaded', 'Nowy Dokument', `${currentUser.first_name} ${currentUser.last_name} dodał dokument: ${docName}`, '/hr/documents');
        } catch (error: any) {
            console.error('Error saving document to DB:', error);
            alert('Błąd zapisu dokumentu w bazie: ' + error.message);
        }
    };

    const openFileViewer = (doc: any) => {
        const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
        setFileViewer({ isOpen: true, urls, title: doc.docName, index: 0 });
    };

    // --- RENDER MODALS ---
    const renderBreakdownModal = () => {
        if (!breakdownType) return null;
        
        const title = breakdownType === 'current' ? 'Skład Stawki (Okres Próbny)' : 'Skład Stawki (Po Okresie Próbnym)';
        const total = breakdownType === 'current' ? salaryData.current : salaryData.potential;
        const groups = salaryData.groups;

        const renderGroup = (label: string, items: any[]) => {
            // FILTER: Only show items relevant to the selected breakdown type
            const visibleItems = items.filter(item => {
                if (breakdownType === 'current') return item.includedInCurrent;
                return item.includedInPotential !== false; // For potential, show everything not explicitly excluded (e.g. failed & expired)
            });

            if (visibleItems.length === 0) return null;

            return (
                <div className="mb-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">{label}</h4>
                    <div className="space-y-2">
                        {visibleItems.map((item: any, idx: number) => {
                            const isIncluded = breakdownType === 'current' ? item.includedInCurrent !== false : item.includedInPotential !== false;
                            
                            return (
                                <div key={idx} className={`flex justify-between items-center p-2 rounded ${!isIncluded ? 'bg-slate-50 opacity-60' : 'bg-white border border-slate-100'}`}>
                                    <div>
                                        <div className={`font-medium text-sm ${!isIncluded ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                            {item.name}
                                        </div>
                                        <div className={`text-xs font-bold ${item.statusColor}`}>
                                            {item.status}
                                        </div>
                                    </div>
                                    <div className={`font-bold ${!isIncluded ? 'text-slate-400 line-through' : (item.color || 'text-slate-900')}`}>
                                        +{item.value.toFixed(2)} zł
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        };

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setBreakdownType(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                        <h3 className="font-bold text-slate-900">{title}</h3>
                        <button onClick={() => setBreakdownType(null)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {renderGroup('Baza', groups.base)}
                        {renderGroup('Forma Współpracy', groups.contract)}
                        {renderGroup('Umiejętności (Test + Praktyka)', groups.skills)}
                        {renderGroup('Uprawnienia / Dokumenty', groups.documents)}
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-slate-500 text-sm font-medium">Razem:</span>
                        <span className="text-2xl font-bold text-blue-600">{total.toFixed(2)} zł</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
            <h1 className="text-2xl font-bold">Panel Pracownika</h1>
            <div className="bg-white p-20 text-center rounded-xl border text-slate-400">
                Pulpit Okresu Próbnego
            </div>
            {renderBreakdownModal()}
            {isDocModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-900">Dodaj Dokument</h2>
                            <button onClick={() => setIsDocModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Typ Dokumentu</label>
                                <select className="w-full border p-2 rounded bg-white" value={newDocData.typeId} onChange={e => setNewDocData({...newDocData, typeId: e.target.value})}>
                                    <option value="">Wybierz dokument...</option>
                                    {BONUS_DOCUMENT_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                                </select>
                            </div>
                            {newDocData.typeId === 'other' && (
                                <input className="w-full border p-2 rounded" placeholder="Nazwa dokumentu..." value={newDocData.customName} onChange={e => setNewDocData({...newDocData, customName: e.target.value})} />
                            )}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Załącz Pliki</label>
                                <input type="file" multiple onChange={handleFileSelect} className="w-full border p-2 rounded bg-slate-50 text-sm" />
                                <div className="mt-2 space-y-1">
                                    {newDocData.files.map((f, i) => (
                                        <div key={i} className="flex justify-between items-center bg-slate-100 p-1.5 rounded text-xs">
                                            <span className="truncate">{f.name}</span>
                                            <button onClick={() => removeFile(i)} className="text-red-500"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded">
                                <input type="checkbox" id="indef_trial" checked={newDocData.indefinite} onChange={e => setNewDocData({...newDocData, indefinite: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                                <label htmlFor="indef_trial" className="text-sm text-slate-700 font-medium">Bezterminowy</label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="ghost" onClick={() => setIsDocModalOpen(false)}>Anuluj</Button>
                            <Button onClick={handleSaveDocument}>Zapisz Dokument</Button>
                        </div>
                    </div>
                </div>
            )}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
        </div>
    );
};
