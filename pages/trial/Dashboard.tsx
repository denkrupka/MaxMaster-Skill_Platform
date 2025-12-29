
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
        const baseRate = currentUser.base_rate;
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
            const isDoc = (skill?.verification_type === VerificationType.DOCUMENT) || us.skill_id.startsWith('doc_');
            
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

    const handleSaveDocument = () => {
        if(!currentUser) return;
        
        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;

        if (!docName) {
            alert("Podaj nazwę dokumentu.");
            return;
        }

        if (newDocData.files.length === 0) {
            alert("Załącz przynajmniej jeden plik.");
            return;
        }

        // Convert to Object URLs and tag PDFs
        const urls = newDocData.files.map(f => {
            const url = URL.createObjectURL(f);
            return f.type === 'application/pdf' ? `${url}#pdf` : url;
        });

        addCandidateDocument(currentUser.id, {
            skill_id: 'doc_generic',
            status: SkillStatus.PENDING,
            custom_name: docName,
            document_urls: urls,
            document_url: urls[0], // fallback
            bonus_value: bonus,
            issue_date: newDocData.issue_date,
            expires_at: newDocData.indefinite ? undefined : newDocData.expires_at,
            is_indefinite: newDocData.indefinite,
        });
        setIsDocModalOpen(false);
        triggerNotification('doc_uploaded', 'Nowy Dokument', `${currentUser.first_name} ${currentUser.last_name} dodał dokument: ${docName}`, '/hr/documents');
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

    // ... (rest of modals unchanged) ...
    const renderContactModal = (title: string, user: any, onClose: () => void) => (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
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
                    <Button fullWidth onClick={onClose}>Zamknij</Button>
                </div>
            </div>
        </div>
    );

    const renderDocModal = () => {
        if (!isDocModalOpen) return null;
        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        
        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-900">Dodaj Dokument</h2>
                        <button onClick={() => setIsDocModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Typ Dokumentu</label>
                            <select 
                                className="w-full border p-2 rounded bg-white"
                                value={newDocData.typeId}
                                onChange={e => setNewDocData({...newDocData, typeId: e.target.value})}
                            >
                                <option value="">Wybierz dokument...</option>
                                {BONUS_DOCUMENT_TYPES.map(type => (
                                    <option key={type.id} value={type.id}>
                                        {type.label} {type.bonus > 0 ? `(+${type.bonus} zł)` : '(Brak bonusu)'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {newDocData.typeId === 'other' && (
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
                                    <Upload size={16} className="mr-2"/> Wybierz pliki
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                                    <Camera size={16} className="mr-2"/> Zrób zdjęcie
                                </Button>
                            </div>
                            
                            {/* File List */}
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {newDocData.files.map((file, index) => (
                                    <div key={index} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs border border-slate-100">
                                        <span className="truncate max-w-[200px]">{file.name}</span>
                                        <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                    </div>
                                ))}
                                {newDocData.files.length === 0 && <span className="text-xs text-slate-400 italic">Brak załączonych plików</span>}
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
                        <Button onClick={handleSaveDocument} disabled={!newDocData.typeId || newDocData.files.length === 0}>Zapisz</Button>
                    </div>
                </div>
            </div>
        );
    }

    const brigadir = getBrigadir();
    const hrContact = getHrContact();

    if (!currentUser) return null;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Cześć, {currentUser.first_name}!</h1>
                    <p className="text-slate-500">Twój panel pracownika na okresie próbnym.</p>
                </div>
                
                {/* Contact Buttons */}
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowBrigadirModal(true)}
                        className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                            <User size={18} />
                        </div>
                        <div className="text-left">
                            <span className="block text-slate-500 text-[10px] uppercase font-bold">Twój Brygadzista</span>
                            <span className="font-bold text-slate-800 text-sm leading-tight">{brigadir ? `${brigadir.first_name} ${brigadir.last_name}` : 'Brak'}</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => setShowHrModal(true)}
                        className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                        <div className="bg-purple-100 p-2 rounded-full text-purple-600">
                            <Briefcase size={18} />
                        </div>
                        <div className="text-left">
                            <span className="block text-slate-500 text-[10px] uppercase font-bold">Twój HR</span>
                            <span className="font-bold text-slate-800 text-sm leading-tight">{hrContact ? `${hrContact.first_name} ${hrContact.last_name}` : 'HR Team'}</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* ENDED MESSAGE - BANNER ONLY */}
            {trialTimeData?.isEnded && (
                <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg border border-slate-700 flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-top-4">
                    <div className="bg-white/10 p-4 rounded-full">
                        <Clock size={32} className="text-white"/>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-xl font-bold mb-2">Okres próbny zakończony.</h2>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Dziękujemy za Twoją pracę. HR analizuje wyniki i przygotuje decyzję oraz warunki umowy.
                            Otrzymasz informację wkrótce. Moduł rozwoju został zablokowany.
                        </p>
                    </div>
                </div>
            )}

            {/* TIME BLOCK (Only if NOT Ended) */}
            {trialTimeData && !trialTimeData.isEnded && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                    <div className="flex justify-between items-end mb-2">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Clock size={20} className="text-orange-500"/> Czas do końca okresu próbnego
                        </h3>
                        <div className="text-right">
                            <span className={`text-2xl font-bold ${trialTimeData.daysLeft <= 7 ? 'text-red-600' : 'text-slate-900'}`}>
                                {trialTimeData.daysLeft} dni
                            </span>
                            <span className="text-xs text-slate-400 block">
                                do {trialTimeData.endDate}
                            </span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-1000 ${trialTimeData.percent > 80 ? 'bg-orange-500' : 'bg-green-500'}`} 
                            style={{ width: `${trialTimeData.percent}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* SALARY BLOCK */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rate A: Current Trial Rate */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 relative overflow-hidden group hover:border-blue-300 transition-colors">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-slate-500 font-medium mb-1">
                            <Clock size={16} className="text-blue-500"/> Stawka Okresu Próbnego
                        </div>
                        <h2 className="text-4xl font-bold mb-2 text-slate-900">{salaryData.current} zł<span className="text-lg text-slate-400 font-normal">/h</span></h2>
                        <button 
                            onClick={() => setBreakdownType('current')}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 mb-4"
                        >
                            <Info size={12}/> Pokaż skład stawki
                        </button>
                        <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 leading-relaxed border border-slate-100">
                            <strong>Obowiązuje teraz.</strong> Wynika z Twojej umowy i kwalifikacji wstępnych. Nie zmienia się w trakcie trwania okresu próbnego.
                        </div>
                    </div>
                </div>

                {/* Rate B: Post-Trial Rate */}
                <div className={`rounded-xl p-6 shadow-lg text-white relative overflow-hidden ${trialTimeData?.isEnded ? 'bg-slate-800 border border-slate-700' : 'bg-green-600'}`}>
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <TrendingUp size={100} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 font-medium mb-1 text-white/90">
                            <CheckCircle size={16}/> {trialTimeData?.isEnded ? 'Stawka Końcowa (Rekomendowana)' : 'Prognozowana Stawka Po Okresie Próbnym'}
                        </div>
                        <h2 className="text-4xl font-bold mb-2">{salaryData.potential} zł<span className="text-lg opacity-70 font-normal">/h</span></h2>
                        <button 
                            onClick={() => setBreakdownType('potential')}
                            className="text-xs font-bold text-white/90 hover:text-white hover:underline flex items-center gap-1 mb-4"
                        >
                            <Info size={12}/> Pokaż skład stawki
                        </button>
                        <div className="bg-black/20 p-3 rounded-lg text-xs text-white/90 leading-relaxed flex items-start gap-2 backdrop-blur-sm">
                            <Info size={14} className="mt-0.5 shrink-0"/>
                            <span>
                                {trialTimeData?.isEnded 
                                    ? 'To jest Twój wynik końcowy. Umiejętności niezaliczone zostały odjęte. HR podejmie ostateczną decyzję.'
                                    : 'Ta stawka rośnie z każdą umiejętnością, którą zaliczysz w praktyce. Umiejętności niezaliczone przed końcem okresu próbnego nie będą uwzględnione.'
                                }
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TRIAL SUMMARY BLOCK (Collapsible, Only if Ended) */}
            {trialTimeData?.isEnded && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <button 
                        onClick={() => toggleSection('summary')}
                        className="w-full p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <ClipboardList size={20} className="text-blue-600"/>
                            <h3 className="font-bold text-slate-800">Podsumowanie Okresu Próbnego</h3>
                        </div>
                        {sectionsOpen.summary ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                    </button>
                    
                    {sectionsOpen.summary && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2">
                            {/* Confirmed Column */}
                            <div>
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-green-100">
                                    <h4 className="font-bold text-green-700 flex items-center gap-2">
                                        <CheckCircle size={18}/> Potwierdzone ({summaryData.confirmed.length})
                                    </h4>
                                    <span className="text-xs text-green-600 font-medium">Liczone do stawki</span>
                                </div>
                                <div className="space-y-2">
                                    {summaryData.confirmed.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center p-2 bg-green-50 rounded text-sm">
                                            <span className="text-green-900 font-medium">✅ {item.name}</span>
                                            <span className="font-bold text-green-700">+{item.bonus} zł</span>
                                        </div>
                                    ))}
                                    {summaryData.confirmed.length === 0 && <p className="text-slate-400 italic text-sm">Brak potwierdzonych umiejętności.</p>}
                                </div>
                            </div>

                            {/* Unconfirmed Column */}
                            <div>
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-red-100">
                                    <h4 className="font-bold text-slate-500 flex items-center gap-2">
                                        <X size={18} className="text-red-500"/> Niepotwierdzone ({summaryData.unconfirmed.length})
                                    </h4>
                                    <span className="text-xs text-slate-400">Nie liczone</span>
                                </div>
                                <div className="space-y-2">
                                    {summaryData.unconfirmed.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded text-sm opacity-70">
                                            <span className="text-slate-600">❌ {item.name}</span>
                                            <span className="font-bold text-slate-400 line-through">+{item.bonus} zł</span>
                                        </div>
                                    ))}
                                    {summaryData.unconfirmed.length === 0 && <p className="text-slate-400 italic text-sm">Wszystkie umiejętności zaliczone!</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* VERIFICATION BLOCK (Collapsible) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button 
                    onClick={() => toggleSection('verification')}
                    className="w-full p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors text-left"
                >
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <CheckCircle size={20} className="text-blue-600"/> Weryfikacja Praktyczna
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Lista umiejętności wymagających potwierdzenia na budowie przez Brygadzistę.</p>
                    </div>
                    {sectionsOpen.verification ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>
                
                {sectionsOpen.verification && (
                    <div className="divide-y divide-slate-100 animate-in slide-in-from-top-2">
                        {pendingSkills.map((item) => {
                            const isExpanded = expandedSkillId === item.skill_id;
                            const checklist = getChecklist(item.skill_id);
                            const resources = getLibraryResources(item.skill_id);
                            
                            let statusColor = "bg-yellow-100 text-yellow-700";
                            let statusText = "Oczekuje na praktykę";
                            const isExpired = trialTimeData?.isEnded && item.status !== SkillStatus.CONFIRMED;

                            if (isExpired) {
                                statusColor = "bg-red-100 text-red-700";
                                statusText = "Niepotwierdzone (Po terminie)";
                            } else if (item.status === SkillStatus.CONFIRMED) {
                                statusColor = "bg-green-100 text-green-700";
                                statusText = "Zaliczone";
                            } 
                            // Removed FAILED condition here because FAILED skills shouldn't be in Verification block

                            return (
                                <div key={item.id} className={`group ${isExpired ? 'opacity-70 bg-slate-50' : ''}`}>
                                    <div 
                                        className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => setExpandedSkillId(isExpanded ? null : item.skill_id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${statusColor}`}>
                                                {item.status === SkillStatus.CONFIRMED ? <CheckCircle size={20}/> : (isExpired ? <X size={20}/> : <Clock size={20}/>)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900">{item.skill.name_pl}</h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${statusColor}`}>{statusText}</span>
                                                    <span className="text-xs text-slate-500">
                                                        Wartość: <span className="font-bold text-green-600">+{item.skill.hourly_bonus} zł</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                                    </div>

                                    {isExpanded && (
                                        <div className="bg-slate-50 p-6 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-2 duration-200">
                                            {/* Left: Checklist (Read Only) */}
                                            <div>
                                                <div className="flex justify-between items-center mb-3">
                                                    <h5 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Kryteria Oceny</h5>
                                                    <span className="text-xs font-bold text-slate-400">
                                                        Liczba kryteriów: {checklist.length}
                                                    </span>
                                                </div>
                                                <div className="space-y-2 bg-white p-4 rounded-lg border border-slate-200">
                                                    {checklist.map((c: any, idx: number) => (
                                                        <div key={idx} className="flex items-start gap-3 opacity-60">
                                                            <div className="mt-0.5 w-4 h-4 border-2 border-slate-300 rounded flex-shrink-0"></div>
                                                            <span className="text-sm text-slate-600">{c.text_pl || c}</span>
                                                        </div>
                                                    ))}
                                                    {checklist.length === 0 && <span className="text-slate-400 italic text-sm">Brak zdefiniowanych kryteriów.</span>}
                                                    
                                                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center text-xs text-orange-600 bg-orange-50 p-2 rounded">
                                                        <Lock size={12} className="inline mr-1"/> Decyzję o zaliczeniu podejmuje Brygadzista
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Materials */}
                                            <div>
                                                <h5 className="font-bold text-slate-700 text-sm mb-3 uppercase tracking-wide">Materiały Pomocnicze</h5>
                                                {resources.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {resources.map(res => (
                                                            <a 
                                                                key={res.id} 
                                                                href={res.url || '#'} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group"
                                                            >
                                                                <div className="bg-blue-50 text-blue-600 p-2 rounded">
                                                                    {res.type === 'video' ? <Video size={16}/> : res.type === 'pdf' ? <FileText size={16}/> : <BookOpen size={16}/>}
                                                                </div>
                                                                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{res.title}</span>
                                                                <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-blue-400"/>
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-400 italic bg-white p-4 rounded-lg border border-slate-200">
                                                        Brak materiałów w bibliotece dla tej umiejętności.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {pendingSkills.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                Nie masz obecnie żadnych umiejętności oczekujących na weryfikację.
                                <br/>
                                {trialTimeData?.isEnded ? 'Wszystkie podjęte próby zostały zakończone.' : 'Rozwiąż testy w sekcji poniżej, aby dodać nowe pozycje.'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* DEVELOPMENT BLOCK (Collapsible) */}
            <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${trialTimeData?.isEnded ? 'opacity-80' : ''}`}>
                <button
                    onClick={() => toggleSection('development')} 
                    className="w-full p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors text-left"
                >
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={20} className="text-green-600"/> Rozwijaj swoje umiejętności
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Zdobądź nowe uprawnienia. Test -> Praktyka -> Wpływ na stawkę po okresie próbnym.</p>
                    </div>
                    {sectionsOpen.development ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>
                
                {sectionsOpen.development && (
                    <div className="animate-in slide-in-from-top-2">
                        {trialTimeData?.isEnded ? (
                            <div className="p-12 text-center bg-white">
                                <Lock size={48} className="mx-auto text-slate-300 mb-4"/>
                                <h3 className="text-lg font-bold text-slate-700">Moduł Zablokowany</h3>
                                <p className="text-slate-500">Okres próbny zakończony. Nie możesz rozpoczynać nowych testów.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {availableDevelopment.map(skill => {
                                    // Check status from UserSkill
                                    const userSkill = userSkills.find(us => us.user_id === currentUser.id && us.skill_id === skill.id);
                                    const status = userSkill?.status;
                                    
                                    // Cooldown Check
                                    const { isLocked, hours, minutes } = getCooldownInfo(skill.id);

                                    // Passed State (Green)
                                    if (status === SkillStatus.THEORY_PASSED) {
                                        return (
                                            <div key={skill.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-green-50/50 border-l-4 border-green-500">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                                        {skill.name_pl}
                                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-200">Zaliczone</span>
                                                    </h4>
                                                    <p className="text-xs text-slate-500 mt-1">Teoria zaliczona. Przejdź do sekcji "Weryfikacja Praktyczna".</p>
                                                </div>
                                                {/* Only checkmark icon as requested */}
                                                <div className="flex items-center justify-center text-green-600 bg-white w-10 h-10 rounded-full shadow-sm border border-green-100">
                                                    <CheckCircle size={24} />
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Failed/Locked State (Red) - NEW REQUEST: Distinct Red Card with Countdown
                                    if (status === SkillStatus.FAILED && isLocked) {
                                        return (
                                            <div key={skill.id} className="p-6 bg-red-50 border-l-4 border-red-500 rounded-r-xl mb-3 flex flex-col sm:flex-row justify-between gap-4 items-center animate-in fade-in">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h4 className="font-bold text-slate-900">{skill.name_pl}</h4>
                                                        <span className="bg-red-200 text-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border border-red-300">Niezaliczone</span>
                                                    </div>
                                                    <p className="text-sm text-slate-700 mb-3">
                                                        Wynik negatywny. Kolejne podejście zostało zablokowane na 24h.
                                                    </p>
                                                    <div className="flex items-center gap-2 text-red-700 font-bold bg-white/80 p-2 rounded-lg border border-red-200 w-fit text-sm shadow-sm">
                                                        <Clock size={16} />
                                                        <span>Blokada: {hours}h {minutes}m</span>
                                                    </div>
                                                </div>
                                                <Button size="sm" disabled className="bg-white text-slate-400 border border-slate-200 shadow-none hover:bg-white cursor-not-allowed">
                                                    <Lock size={16} className="mr-2"/> Zablokowane
                                                </Button>
                                            </div>
                                        );
                                    }

                                    // Standard State
                                    return (
                                        <div key={skill.id} className={`p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors ${status === SkillStatus.FAILED ? 'border-l-4 border-orange-400 pl-5' : ''}`}>
                                            <div>
                                                <h4 className="font-bold text-slate-900">{skill.name_pl}</h4>
                                                <p className="text-xs text-slate-500 mt-1 max-w-xl">{skill.description_pl}</p>
                                                <div className="mt-2 inline-flex items-center gap-2 bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-100">
                                                    <TrendingUp size={12}/> Potencjał po trialu: +{skill.hourly_bonus} zł/h
                                                </div>
                                            </div>
                                            <Button size="sm" onClick={() => handleTakeTest(skill.id)} className={status === SkillStatus.FAILED ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}>
                                                {status === SkillStatus.FAILED ? <><RotateCcw size={16} className="mr-2"/> Spróbuj ponownie</> : <><Play size={16} className="mr-2"/> Rozpocznij Test</>}
                                            </Button>
                                        </div>
                                    );
                                })}
                                {availableDevelopment.length === 0 && (
                                    <div className="p-8 text-center text-slate-500">
                                        Brak dostępnych nowych umiejętności do zdobycia w tym momencie.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* DOCUMENTS BLOCK (Collapsible) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                    onClick={() => toggleSection('documents')} 
                    className="w-full p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors text-left"
                >
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <FileText size={20} className="text-purple-600"/> Uprawnienia / Dokumenty
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Certyfikaty (SEP, UDT) i dokumenty BHP. Dodaj, aby uzyskać dodatkowe bonusy.</p>
                    </div>
                    {sectionsOpen.documents ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>
                
                {sectionsOpen.documents && (
                    <div className="animate-in slide-in-from-top-2 p-6">
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
                                                {/* Bonus Display Logic */}
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
                                    <button 
                                        className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1"
                                        onClick={() => openFileViewer(doc)}
                                    >
                                        <Eye size={14}/> Zobacz {doc.fileCount > 1 ? `(${doc.fileCount})` : ''}
                                    </button>
                                </div>
                            ))}
                            {myDocuments.length === 0 && (
                                <div className="text-center text-slate-400 py-4 italic">Brak dodanych dokumentów.</div>
                            )}
                        </div>
                        
                        {!trialTimeData?.isEnded && (
                            <Button fullWidth variant="outline" onClick={handleAddDocument} className="border-dashed border-2">
                                <Plus size={18} className="mr-2"/> Dodaj Nowy Dokument
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {renderBreakdownModal()}
            {showBrigadirModal && renderContactModal('Twój Brygadzista', brigadir, () => setShowBrigadirModal(false))}
            {showHrModal && renderContactModal('Twój Opiekun HR', hrContact, () => setShowHrModal(false))}
            {renderDocModal()}
            
            {/* New Document Viewer Modal usage */}
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
