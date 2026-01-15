
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    ArrowRight, Search, Clock, CheckCircle, XCircle, AlertTriangle, Send, Edit, ChevronRight, ChevronDown, Upload, X, Archive, RotateCcw, Calendar, Eye, Camera, Plus, ChevronLeft, UserPlus, Wallet, Shield, Save, Loader2,
    Mail, Phone, User as UserIcon, MapPin, Calculator, Award, Sparkles
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { User, Role, UserStatus, ContractType, SkillStatus, VerificationType } from '../../types';
import { calculateSalary } from '../../services/salaryService';
import { USER_STATUS_LABELS, SKILL_STATUS_LABELS, CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES, REFERRAL_BONUSES, REFERRAL_STATUS_LABELS } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';

const QUALIFICATIONS_LIST = [
    { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
    { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
    { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
];

export const HRTrialPage = () => {
    const { state, updateUser, logCandidateAction, hireCandidate, addCandidateDocument, updateCandidateDocumentDetails, archiveCandidateDocument, restoreCandidateDocument, updateUserSkillStatus, resetSkillProgress, assignBrigadir, triggerNotification, payReferralBonus } = useAppContext();
    const { systemConfig, users, skills, userSkills, monthlyBonuses, currentUser, qualityIncidents, positions } = state;

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'info'|'personal'|'rate'|'skills'|'docs'|'history'|'referrals'>('info');
    
    const [docsViewMode, setDocsViewMode] = useState<'active' | 'archived'>('active');
    const [docSearch, setDocSearch] = useState('');
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

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'fire' | 'reminder' | 'pay_referral' | null;
        user: User | null;
    }>({ isOpen: false, type: null, user: null });

    const [successModal, setSuccessModal] = useState<{isOpen: boolean, title: string, message: string}>({isOpen: false, title: '', message: ''});

    const [isHireModalOpen, setIsHireModalOpen] = useState(false);
    const [hireConfig, setHireConfig] = useState<{
        hiredDate: string;
        contractEndDate: string;
        isIndefinite: boolean;
        user: User | null;
    }>({ hiredDate: '', contractEndDate: '', isIndefinite: true, user: null });

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<User>>({});

    const [resetModal, setResetModal] = useState<{isOpen: boolean, skillId: string | null}>({isOpen: false, skillId: null});

    const [isContractPopoverOpen, setIsContractPopoverOpen] = useState(false);

    const [statusPopoverSkillId, setStatusPopoverSkillId] = useState<string | null>(null);
    const [statusPopoverDocId, setStatusPopoverDocId] = useState<string | null>(null);

    // State for Personal Data form
    const [localPersonalData, setLocalPersonalData] = useState<Partial<User>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const trialUsers = state.users.filter(u => u.status === UserStatus.TRIAL);
    
    const brigadirsList = useMemo(() => {
        return state.users.filter(u => u.role === Role.BRIGADIR);
    }, [state.users]);

    const filteredUsers = trialUsers.filter(u => {
        const matchesSearch = u.first_name.toLowerCase().includes(search.toLowerCase()) || 
                              u.last_name.toLowerCase().includes(search.toLowerCase());
        
        const endDate = u.trial_end_date ? new Date(u.trial_end_date) : new Date();
        const now = new Date();
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        (u as any).daysLeft = daysLeft;
        
        return matchesSearch;
    });

    const handleOpenDetail = (user: User) => {
        setSelectedUser(user);
        setLocalPersonalData({
            pesel: user.pesel || '',
            birth_date: user.birth_date || '',
            citizenship: user.citizenship || '',
            document_type: user.document_type || 'Dowód osobisty',
            document_number: user.document_number || '',
            zip_code: user.zip_code || '',
            city: user.city || '',
            street: user.street || '',
            house_number: user.house_number || '',
            apartment_number: user.apartment_number || '',
            bank_account: user.bank_account || '',
            nip: user.nip || ''
        });
        setActiveTab('info');
    };

    const handleHireClick = (user: User) => {
        setHireConfig({
            hiredDate: new Date().toISOString().split('T')[0],
            contractEndDate: '',
            isIndefinite: true,
            user: user
        });
        setIsHireModalOpen(true);
    };

    const confirmHire = async () => {
        if (!hireConfig.user) return;
        
        try {
            await hireCandidate(
                hireConfig.user.id, 
                hireConfig.hiredDate, 
                hireConfig.isIndefinite ? undefined : hireConfig.contractEndDate
            );

            setIsHireModalOpen(false);
            setSuccessModal({
                isOpen: true,
                title: 'Pracownik Zatrudniony',
                message: `Pracownik ${hireConfig.user.first_name} ${hireConfig.user.last_name} został zatrudniony na stałe.`
            });
            setSelectedUser(null);
        } catch (error) {
            console.error("Error hiring employee:", error);
            alert("Wystąpił błąd podczas zatrudniania pracownika.");
        }
    };

    const handleFireClick = (user: User) => {
        setConfirmModal({ isOpen: true, type: 'fire', user });
    };

    const handlePayReferral = (referralUser: User) => {
        setConfirmModal({ isOpen: true, type: 'pay_referral', user: referralUser });
    };

    const executeConfirmation = async () => {
        const { type, user } = confirmModal;
        if (!user || !type) return;

        try {
            if (type === 'fire') {
                await updateUser(user.id, { 
                    status: UserStatus.INACTIVE, 
                    role: Role.CANDIDATE 
                });
                await logCandidateAction(user.id, 'Rozwiązano umowę w trakcie okresu próbnego (Archiwizacja)');
                triggerNotification('termination', 'Rozwiązanie Umowy (Trial)', `Rozwiązano umowę z pracownikiem ${user.first_name} ${user.last_name} w trakcie okresu próbnego.`, '/hr/trial');
                setSuccessModal({ isOpen: true, title: 'Umowa Rozwiązana', message: `Pracownik ${user.first_name} ${user.last_name} został przeniesiony do archiwum kandydatów.` });
                setSelectedUser(null);
            } else if (type === 'pay_referral') {
                await payReferralBonus(user.id);
                setSuccessModal({ isOpen: true, title: 'Bonus Wypłacony', message: `Pomyślnie zarejestrowano wypłatę bonusu za polecenie.` });
            }
        } catch (error) {
            console.error("Action error:", error);
            alert("Wystąpił błąd podczas wykonywania akcji.");
        }
        setConfirmModal({ isOpen: false, type: null, user: null });
    };

    const handleEditUser = () => {
        if (selectedUser) {
            setEditFormData({
                first_name: selectedUser.first_name,
                last_name: selectedUser.last_name,
                email: selectedUser.email,
                phone: selectedUser.phone,
                target_position: selectedUser.target_position,
                hired_date: selectedUser.hired_date, 
                trial_end_date: selectedUser.trial_end_date, 
                assigned_brigadir_id: selectedUser.assigned_brigadir_id
            });
            setIsEditModalOpen(true);
        }
    };

    const saveEditUser = async () => {
        if (selectedUser) {
            try {
                await updateUser(selectedUser.id, editFormData);
                if (editFormData.assigned_brigadir_id !== selectedUser.assigned_brigadir_id && editFormData.assigned_brigadir_id) {
                    assignBrigadir(selectedUser.id, editFormData.assigned_brigadir_id);
                }
                setSelectedUser({ ...selectedUser, ...editFormData } as User);
                setIsEditModalOpen(false);
            } catch (error) {
                alert("Błąd podczas zapisywania zmian.");
            }
        }
    };

    const updateContractType = async (type: string) => {
        if (selectedUser) {
            await updateUser(selectedUser.id, { contract_type: type as any });
            await logCandidateAction(selectedUser.id, `Zmieniono formę zatrudnienia na: ${CONTRACT_TYPE_LABELS[type as ContractType] || type.toUpperCase()}`);
            setSelectedUser({ ...selectedUser, contract_type: type as any } as User);
            setIsContractPopoverOpen(false);
        }
    };

    const toggleStudentStatus = async (isStudent: boolean) => {
        if (selectedUser) {
            await updateUser(selectedUser.id, { is_student: isStudent });
            await logCandidateAction(selectedUser.id, `Zmiana statusu studenta: ${isStudent ? 'Tak' : 'Nie'}`);
            setSelectedUser({ ...selectedUser, is_student: isStudent } as User);
        }
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
        if(!selectedUser) return;
        
        const employeeId = selectedUser.id;

        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' || editingDocId ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;

        if (!docName) return alert("Podaj nazwę dokumentu.");

        const uploadedUrls: string[] = [];
        if (newDocData.files.length > 0) {
             for (const file of newDocData.files) {
                 const url = await uploadDocument(file, selectedUser.id);
                 if (url) uploadedUrls.push(url);
             }
        }

        const docPayload: any = {
            custom_name: docName,
            issue_date: newDocData.issue_date || undefined,
            expires_at: (newDocData.indefinite || !newDocData.expires_at) ? undefined : newDocData.expires_at,
            is_indefinite: newDocData.indefinite,
            document_url: uploadedUrls[0] || undefined,
            document_urls: uploadedUrls.length > 0 ? uploadedUrls : undefined
        };

        if (!editingDocId) docPayload.bonus_value = bonus;

        try {
            if (editingDocId) {
                await updateCandidateDocumentDetails(editingDocId, docPayload);
            } else {
                await addCandidateDocument(selectedUser.id, {
                    status: SkillStatus.PENDING,
                    ...docPayload
                });
            }
            setIsDocModalOpen(false);
        } catch (error) {
            console.error("Error saving document:", error);
            alert("Błąd podczas zapisywania dokumentu.");
        }
    };

    const handleDocStatusChange = async (docId: string, newStatus: SkillStatus) => {
        await updateUserSkillStatus(docId, newStatus);
        setStatusPopoverDocId(null);
    };

    const openFileViewer = (doc: any) => {
        const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
        setFileViewer({ isOpen: true, urls, title: doc.docName, index: 0 });
    };

    const handleResetSkill = (skillId: string, mode: 'theory'|'practice'|'both') => {
        if (selectedUser) {
            resetSkillProgress(selectedUser.id, skillId, mode);
            setResetModal({ isOpen: false, skillId: null });
        }
    };

    const changeSkillStatus = async (skillId: string, newStatus: SkillStatus, reason?: string) => {
        if (selectedUser) {
            const us = state.userSkills.find(us => us.user_id === selectedUser.id && us.skill_id === skillId);
            if (us) {
                await updateUserSkillStatus(us.id, newStatus, reason);
            }
        }
        setStatusPopoverSkillId(null);
    };

    const formatContractType = (type?: string) => {
        if (!type) return 'Wybierz...';
        return CONTRACT_TYPE_LABELS[type as ContractType] || type.toUpperCase();
    };

    const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) val = val.slice(0, 5);
        if (val.length > 2) val = val.slice(0, 2) + '-' + val.slice(2);
        setLocalPersonalData({ ...localPersonalData, zip_code: val });
    };

    const handleBankAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 26) val = val.slice(0, 26);
        val = val.replace(/(.{4})/g, '$1 ').trim();
        setLocalPersonalData({ ...localPersonalData, bank_account: val });
    };

    const handleSavePersonalData = async () => {
        if (selectedUser) {
            await updateUser(selectedUser.id, localPersonalData);
            setSelectedUser({ ...selectedUser, ...localPersonalData } as User);
            alert("Dane osobowе zostały zapisane.");
        }
    };

    const handleAddDocument = () => {
        setEditingDocId(null);
        setNewDocData({ 
            typeId: '',
            customName: '', 
            issue_date: new Date().toISOString().split('T')[0], 
            expires_at: '', 
            indefinite: false,
            files: [] as File[]
        });
        setIsDocModalOpen(true);
    };

    const handleEditDocument = (docId: string) => {
        const doc = state.userSkills.find(us => us.id === docId);
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

    const renderReferralsTab = () => {
        if (!selectedUser) return null;
        const myReferrals = users
            .filter(u => u.referred_by_id === selectedUser.id)
            .map(u => {
                const now = new Date();
                const hiredDate = new Date(u.hired_date);
                const diffTime = Math.abs(now.getTime() - hiredDate.getTime());
                const daysWorking = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                let refStatus: 'invited' | 'offered' | 'working' | 'dismissed' = 'invited';
                if (u.status === UserStatus.INVITED || u.status === UserStatus.STARTED || u.status === UserStatus.TESTS_IN_PROGRESS) refStatus = 'invited';
                else if (u.status === UserStatus.TESTS_COMPLETED || u.status === UserStatus.OFFER_SENT || u.status === UserStatus.DATA_REQUESTED) refStatus = 'offered';
                else if (u.status === UserStatus.ACTIVE || u.status === UserStatus.TRIAL) refStatus = 'working';
                else if (u.status === UserStatus.INACTIVE || u.status === UserStatus.REJECTED) refStatus = 'dismissed';
                const bonusAmount = REFERRAL_BONUSES[u.target_position || 'Pomocnik'] || 200;
                const progress = Math.min(100, Math.round((daysWorking / 90) * 100));
                const isReadyToPay = refStatus === 'working' && daysWorking >= 90 && !u.referral_bonus_paid;
                return { ...u, refStatus, bonusAmount, daysWorking, progress, isReadyToPay };
            });

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><UserPlus size={18} className="text-blue-600"/> Zaproszeni pracownicy ({myReferrals.length})</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                            <tr><th className="px-6 py-4">Znajomy</th><th>Stanowisko</th><th>Status</th><th>Postęp (90 dni)</th><th>Bonus</th><th className="text-right">Akcja</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {myReferrals.map((ref) => (
                                <tr key={ref.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{ref.first_name} {ref.last_name}</td>
                                    <td className="px-6 py-4 text-slate-600">{ref.target_position || '-'}</td>
                                    <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${ref.refStatus === 'working' ? 'bg-green-50 text-green-700 border-green-200' : ref.refStatus === 'dismissed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{REFERRAL_STATUS_LABELS[ref.refStatus]}</span></td>
                                    <td className="px-6 py-4"><div className="flex items-center gap-2"><div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden max-w-[100px]"><div className="bg-blue-500 h-full" style={{ width: `${ref.progress}%` }}></div></div><span className="text-[10px] font-bold text-slate-500">{ref.daysWorking}d</span></div></td>
                                    <td className="px-6 py-4"><div className="font-bold text-slate-900">{ref.bonusAmount} zł</div><div className={`text-[10px] uppercase tracking-tighter mt-1 ${ref.referral_bonus_paid ? 'text-green-600' : 'text-slate-400'}`}>{ref.referral_bonus_paid ? 'Wypłacono' : 'Do wypłaty'}</div></td>
                                    <td className="px-6 py-4 text-right">{ref.referral_bonus_paid ? <span className="text-xs text-slate-400 italic">Zapłacono</span> : <Button size="sm" disabled={!ref.isReadyToPay} onClick={() => handlePayReferral(ref)} className={ref.isReadyToPay ? 'bg-green-600 hover:bg-green-700 text-white' : ''}>Wypłać</Button>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderDetails = () => {
        if (!selectedUser) return null;

        const salaryData = calculateSalary(
            systemConfig.baseRate, 
            state.skills, 
            state.userSkills.filter(us => us.user_id === selectedUser.id), 
            state.monthlyBonuses[selectedUser.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
            new Date(),
            qualityIncidents
        );

        const confirmedUserSkills = state.userSkills.filter(us => us.user_id === selectedUser.id && us.status === SkillStatus.CONFIRMED && !us.is_archived);
        
        const matrycaBonus = confirmedUserSkills.reduce((acc, us) => {
            const skill = state.skills.find(s => s.id === us.skill_id);
            if (skill && skill.verification_type !== VerificationType.DOCUMENT && !us.custom_type) {
                return acc + skill.hourly_bonus;
            }
            return acc;
        }, 0);

        const uprawnieniaBonus = confirmedUserSkills.reduce((acc, us) => {
            const skill = state.skills.find(s => s.id === us.skill_id);
            const isDoc = (skill?.verification_type === VerificationType.DOCUMENT) || (us.skill_id && typeof us.skill_id === 'string' && (us.skill_id.startsWith('doc_') || us.custom_type === 'doc_generic')) || !us.skill_id;
            if (isDoc) {
                return acc + (skill ? skill.hourly_bonus : (us.bonus_value || 0));
            }
            return acc;
        }, 0);

        const contractType = selectedUser.contract_type || 'uop';
        const contractBonus = systemConfig.contractBonuses[contractType] || 0;
        const studentBonus = (contractType === 'uz' && selectedUser.is_student) ? systemConfig.studentBonus : 0;
        const totalExtras = contractBonus + studentBonus;
        const totalRate = salaryData.total + totalExtras;

        const employeeDocuments = state.userSkills.filter(us => {
            if (us.user_id !== selectedUser.id) return false;
            const skill = skills.find(s => s.id === us.skill_id);
            const isSystemDoc = skill?.verification_type === VerificationType.DOCUMENT;
            const isGenericDoc = us.custom_type === 'doc_generic' || !us.skill_id || (typeof us.skill_id === 'string' && us.skill_id.startsWith('doc_'));
            return isSystemDoc || isGenericDoc;
        });

        const history = state.candidateHistory.filter(h => h.candidate_id === selectedUser.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const relevantUserSkills = state.userSkills.filter(us => us.user_id === selectedUser.id && us.skill_id && !us.skill_id.startsWith('doc_') && us.custom_type !== 'doc_generic');
        
        const skillList = relevantUserSkills.map(us => {
            const skill = state.skills.find(s => s.id === us.skill_id);
            if (!skill) return null;
            const isTheoryPassed = us.theory_score !== undefined && us.theory_score >= (skill.required_pass_rate || 80);
            const theoryStatus = us.theory_score !== undefined ? (isTheoryPassed ? 'Zaliczona' : 'Niezaliczona') : 'Brak';
            let practiceStatus = 'Brak';
            if (skill.verification_type === VerificationType.THEORY_PRACTICE) {
                if (us.status === SkillStatus.CONFIRMED) practiceStatus = 'Zaliczona';
                else if (us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING) practiceStatus = 'Oczekuje';
            }
            if (theoryStatus === 'Brak' && practiceStatus === 'Brak') return null;
            let statusText = 'Oczekuje'; let statusColor = 'bg-yellow-100 text-yellow-700';
            if (us.status === SkillStatus.CONFIRMED) { statusText = us.rejection_reason === 'MANUAL_NO_PRACTICE' ? 'Zaliczony (bez praktyki)' : 'Zaliczony'; statusColor = 'bg-green-100 text-green-700'; }
            else if (us.status === SkillStatus.FAILED) { statusText = 'Niezaliczony'; statusColor = 'bg-red-100 text-red-700'; }
            else if (us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING) { statusText = 'Oczekuje na praktykę'; }
            return { ...us, skillName: skill.name_pl, hourlyBonus: skill.hourly_bonus, theoryStatus, practiceStatus, statusText, statusColor, skillId: skill.id };
        }).filter(Boolean);

        const brigadirName = state.users.find(u => u.id === selectedUser.assigned_brigadir_id);
        const endDate = selectedUser.trial_end_date ? new Date(selectedUser.trial_end_date) : new Date();
        const now = new Date();
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        const isExpired = daysLeft <= 0;

        return (
            <div className="animate-in fade-in duration-500 pb-20" onClick={() => { setStatusPopoverSkillId(null); setIsContractPopoverOpen(false); setStatusPopoverDocId(null); }}>
                <Button variant="ghost" onClick={() => setSelectedUser(null)} className="mb-4"><ArrowRight className="transform rotate-180 mr-2" size={18} /> Wróć do listy</Button>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">{selectedUser.first_name[0]}{selectedUser.last_name[0]}</div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{selectedUser.first_name} {selectedUser.last_name}</h1>
                                <div className="text-sm text-slate-500 flex gap-4 mt-1"><span>{selectedUser.email}</span><span>{selectedUser.phone}</span></div>
                                <div className="text-sm font-bold text-slate-700 mt-2">Stanowisko: <span className="font-normal text-slate-600">{selectedUser.target_position || '-'}</span></div>
                                <div className="text-sm font-bold text-slate-700 mt-1">Brygadzista: <span className="font-normal text-slate-600">{brigadirName ? `${brigadirName.first_name} ${brigadirName.last_name}` : '-'}</span></div>
                                <div className="text-sm font-bold text-slate-700 mt-1">Okres próbny: <span className="font-normal text-slate-600">{selectedUser.hired_date?.split('T')[0] || '-'} — {selectedUser.trial_end_date?.split('T')[0] || 'nieoreślony'}</span></div>
                                <div className={`mt-2 font-bold text-sm ${isExpired ? 'text-red-600' : 'text-slate-500'}`}>{isExpired ? `Po terminie (${Math.abs(daysLeft)} dni)` : `Pozostało: ${daysLeft} dni`}</div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2"><span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">{USER_STATUS_LABELS[UserStatus.TRIAL]}</span><Button size="sm" variant="outline" onClick={handleEditUser}><Edit size={16} className="mr-2"/> Edytuj</Button></div>
                            <div className="flex gap-2 mt-2">
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleHireClick(selectedUser)}><CheckCircle size={16} className="mr-2"/> Zatrudnij na stałe</Button>
                                <Button size="sm" variant="danger" onClick={() => handleFireClick(selectedUser)}><XCircle size={16} className="mr-2"/> Zwolnij</Button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
                    <div className="flex border-b border-slate-200 px-6 overflow-x-auto min-h-[56px]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        <div className="flex items-stretch h-full">
                            {[
                                { id: 'info', label: 'Info' }, 
                                { id: 'personal', label: 'Dane Osobowe' },
                                { id: 'rate', label: 'Stawka' }, 
                                { id: 'skills', label: 'Umiejętności' }, 
                                { id: 'docs', label: 'Uprawnienia' }, 
                                { id: 'referrals', label: 'Polecenia' }, 
                                { id: 'history', label: 'Historia' }
                            ].map(t => (
                                <button 
                                    key={t.id} 
                                    onClick={() => setActiveTab(t.id as any)} 
                                    className={`py-3 px-5 font-bold text-sm border-b-4 transition-all whitespace-nowrap flex items-center ${activeTab === t.id ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-8">
                        {activeTab === 'info' && (
                            <div className="animate-in fade-in duration-300">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">NOTATKI REKRUTACYJNE</h3>
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner">
                                    <textarea 
                                        className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder:text-slate-400 font-medium min-h-[200px] resize-none outline-none text-base" 
                                        placeholder="Wpisz notatki..."
                                        value={selectedUser.notes || ''} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            updateUser(selectedUser.id, { notes: val });
                                            setSelectedUser({ ...selectedUser, notes: val });
                                        }} 
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'personal' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    {/* Column 1: DANE PODSTAWOWE */}
                                    <div className="space-y-6">
                                        <h3 className="font-bold text-blue-600 mb-6 flex items-center gap-2 uppercase tracking-tighter text-sm">
                                            <UserIcon size={18}/> DANE PODSTAWOWE
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">PESEL</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                    value={localPersonalData.pesel} 
                                                    onChange={e => setLocalPersonalData({...localPersonalData, pesel: e.target.value})}
                                                    placeholder="00000000000"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">DATA URODZENIA</label>
                                                <input 
                                                    type="date"
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                    value={localPersonalData.birth_date} 
                                                    onChange={e => setLocalPersonalData({...localPersonalData, birth_date: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">OBYWATELSTWO</label>
                                                <select 
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none appearance-none text-sm"
                                                    value={localPersonalData.citizenship} 
                                                    onChange={e => setLocalPersonalData({...localPersonalData, citizenship: e.target.value})}
                                                >
                                                    <option value="">Wybierz...</option>
                                                    <option value="Polskie">Polskie</option>
                                                    <option value="Ukraińskie">Ukraińskie</option>
                                                    <option value="Białoruskie">Białoruskie</option>
                                                    <option value="Inne">Inne</option>
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">TYP DOKUMENTU</label>
                                                    <select 
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none appearance-none text-sm"
                                                        value={localPersonalData.document_type} 
                                                        onChange={e => setLocalPersonalData({...localPersonalData, document_type: e.target.value})}
                                                    >
                                                        <option value="Dowód osobisty">Dowód osobisty</option>
                                                        <option value="Paszport">Paszport</option>
                                                        <option value="Karta pobytu">Karta pobytu</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">NR DOKUMENTU</label>
                                                    <input 
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                        value={localPersonalData.document_number} 
                                                        onChange={e => setLocalPersonalData({...localPersonalData, document_number: e.target.value})}
                                                        placeholder="ABC 123456"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: ADRES I FINANSE */}
                                    <div className="space-y-6">
                                        <h3 className="font-bold text-blue-600 mb-6 flex items-center gap-2 uppercase tracking-tighter text-sm">
                                            <MapPin size={18}/> ADRES I FINANSE
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">ULICA</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                    value={localPersonalData.street} 
                                                    onChange={e => setLocalPersonalData({...localPersonalData, street: e.target.value})}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">NR DOMU</label>
                                                    <input 
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                        value={localPersonalData.house_number} 
                                                        onChange={e => setLocalPersonalData({...localPersonalData, house_number: e.target.value})}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">NR LOKALU</label>
                                                    <input 
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                        value={localPersonalData.apartment_number} 
                                                        onChange={e => setLocalPersonalData({...localPersonalData, apartment_number: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">KOD POCZTOWY</label>
                                                    <input 
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                        value={localPersonalData.zip_code} 
                                                        onChange={handleZipCodeChange}
                                                        placeholder="00-000"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">MIASTO</label>
                                                    <input 
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                        value={localPersonalData.city} 
                                                        onChange={e => setLocalPersonalData({...localPersonalData, city: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">KONTO BANKOWE</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                    value={localPersonalData.bank_account} 
                                                    onChange={handleBankAccountChange}
                                                    placeholder="00 0000 0000..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">NIP (OPCJONALNIE)</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-bold text-slate-700 focus:bg-white transition-all outline-none text-sm" 
                                                    value={localPersonalData.nip} 
                                                    onChange={e => setLocalPersonalData({...localPersonalData, nip: e.target.value})}
                                                    placeholder="0000000000"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-8">
                                    <Button onClick={handleSavePersonalData} className="px-8 h-11 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-600/20">
                                        <Save size={18} className="mr-2"/> ZAPISZ DANE
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rate' && (
                             <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">BAZA</div>
                                        <div className="text-2xl font-black text-slate-900">{systemConfig.baseRate} zł</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
                                        <div className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">UMIEJĘTNOŚCI</div>
                                        <div className="text-2xl font-black text-green-600">+{salaryData.breakdown.skills.toFixed(2)} zł</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
                                        <div className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">UPRAWNIENIA</div>
                                        <div className="text-2xl font-black text-purple-600">+{uprawnieniaBonus.toFixed(2)} zł</div>
                                    </div>
                                    <div className="relative">
                                        <div 
                                            className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm text-center flex flex-col justify-center min-h-[110px] cursor-pointer hover:bg-blue-50 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); setIsContractPopoverOpen(!isContractPopoverOpen); }}
                                        >
                                            <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">FORMA UMOWY</div>
                                            <div className="text-sm font-black text-blue-700 flex items-center justify-center gap-1 uppercase">
                                                {formatContractType(selectedUser.contract_type)}
                                                <ChevronDown size={14} />
                                            </div>
                                            <div className="text-[9px] text-blue-400 font-bold mt-1">{totalExtras > 0 ? `+${totalExtras.toFixed(2)} zł` : 'Bez dodatku'}</div>
                                        </div>
                                        {isContractPopoverOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl z-[200] py-1 flex flex-col animate-in slide-in-from-top-2 duration-200 overflow-hidden">
                                                {Object.entries(systemConfig.contractBonuses).map(([type, bonus]) => (
                                                    <button 
                                                        key={type} 
                                                        className="px-4 py-2.5 text-[11px] font-bold text-left hover:bg-blue-50 text-slate-700 transition-colors flex justify-between items-center" 
                                                        onClick={() => updateContractType(type)}
                                                    >
                                                        <span className="uppercase">{CONTRACT_TYPE_LABELS[type as ContractType] || type}</span>
                                                        <span className="text-blue-500 font-black">+{bonus} zł</span>
                                                    </button>
                                                ))}
                                                <div className="border-t border-slate-100 my-1"></div>
                                                <div className="px-4 py-2 flex items-center justify-between bg-slate-50/50">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Student &lt; 26 lat</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-bold text-indigo-600">+{systemConfig.studentBonus} zł</span>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedUser.is_student} 
                                                            onChange={(e) => toggleStudentStatus(e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 rounded" 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-slate-900 p-4 rounded-xl text-center text-white flex flex-col justify-center min-h-[110px] shadow-lg shadow-slate-900/20">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">STAWKA TOTAL</div>
                                        <div className="text-2xl font-black leading-tight">{totalRate.toFixed(2)} zł<span className="text-[10px] font-medium ml-1">/h netto</span></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'skills' && (
                             <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Umiejętność</th><th className="px-4 py-3">Stawka</th><th className="px-4 py-3">Teoria</th><th className="px-4 py-3">Praktyka</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Akcje</th></tr></thead><tbody className="divide-y divide-slate-100">{skillList.map((skill: any) => (<tr key={skill.id}><td className="px-4 py-3 font-medium">{skill.skillName}</td><td className="px-4 py-3 font-bold text-green-600">+{skill.hourlyBonus} zł</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${skill.theoryStatus === 'Zaliczona' ? 'bg-green-100 text-green-700' : skill.theoryStatus === 'Niezaliczona' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-50'}`}>{skill.theoryStatus}</span></td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${skill.practiceStatus === 'Zaliczona' ? 'bg-green-100 text-green-700' : skill.practiceStatus === 'Oczekuje' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-50'}`}>{skill.practiceStatus}</span></td><td className="px-4 py-3 relative" onClick={(e) => { e.stopPropagation(); setStatusPopoverSkillId(skill.skillId); }}><span className={`px-2 py-1 rounded text-xs uppercase font-bold cursor-pointer hover:opacity-80 ${skill.statusColor}`}>{skill.statusText}</span>{statusPopoverSkillId === skill.skillId && (<div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 shadow-xl rounded-lg z-[9999] flex flex-col py-1"><button className="text-left px-3 py-2 text-xs hover:bg-yellow-50 text-yellow-700" onClick={() => changeSkillStatus(skill.skillId, SkillStatus.PRACTICE_PENDING)}>{SKILL_STATUS_LABELS[SkillStatus.PRACTICE_PENDING]}</button><button className="text-left px-3 py-2 text-xs hover:bg-green-50 text-green-700" onClick={() => changeSkillStatus(skill.skillId, SkillStatus.CONFIRMED)}>{SKILL_STATUS_LABELS[SkillStatus.CONFIRMED]}</button></div>)}</td><td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setResetModal({ isOpen: true, skillId: skill.skillId })}>Reset</Button></td></tr>))}</tbody></table>
                        )}
                        {activeTab === 'docs' && (
                             <div onClick={() => setStatusPopoverDocId(null)}><div className="flex justify-between mb-4"><div className="relative w-64"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Szukaj dokumentu..." className="w-full pl-9 pr-2 py-1.5 border rounded text-sm" value={docSearch} onChange={(e) => setDocSearch(e.target.value)} /></div><div className="flex gap-2"><Button size="sm" variant={docsViewMode === 'active' ? 'secondary' : 'primary'} onClick={() => setDocsViewMode(prev => prev === 'active' ? 'archived' : 'active')}>{docsViewMode === 'active' ? <><Archive size={16} className="mr-2"/> Archiwum</> : <><RotateCcw size={16} className="mr-2"/> Aktywne</>}</Button><Button size="sm" onClick={handleAddDocument}><Upload size={16} className="mr-2"/> Dodaj Dokument</Button></div></div><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500 font-bold"><tr><th className="px-4 py-3">Dokument</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">Stawka</th><th className="px-4 py-3">Data Wydania</th><th className="px-4 py-3">Ważność</th><th className="px-4 py-3 text-right">Akcje</th></tr></thead><tbody className="divide-y divide-slate-100">{employeeDocuments.filter(d => docsViewMode === 'active' ? !d.is_archived : d.is_archived).map(d => { const bonus = d.bonus_value || state.skills.find(s => s.id === d.skill_id)?.hourly_bonus || 0; return (<tr key={d.id} className="hover:bg-slate-50 transition-colors group"><td className="px-4 py-4 font-bold text-slate-700" onClick={() => handleEditDocument(d.id)}>{d.custom_name || 'Dokument'}</td><td className="px-4 py-4 relative" onClick={(e) => { e.stopPropagation(); setStatusPopoverDocId(d.id); }}><span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-tighter cursor-pointer hover:scale-105 transition-transform ${d.status === SkillStatus.CONFIRMED ? 'bg-green-100 text-green-700' : d.status === SkillStatus.FAILED ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{SKILL_STATUS_LABELS[d.status]}</span>{statusPopoverDocId === d.id && (<div className="absolute top-full left-0 mt-1 w-48 bg-white border shadow-xl rounded-lg z-[9999] py-1"><button className="text-left px-3 py-2 text-xs hover:bg-slate-700 text-slate-50" onClick={() => handleDocStatusChange(d.id, SkillStatus.PENDING)}>{SKILL_STATUS_LABELS[SkillStatus.PENDING]}</button><button className="text-left px-3 py-2 text-xs hover:bg-green-50 text-green-700 font-medium" onClick={() => handleDocStatusChange(d.id, SkillStatus.CONFIRMED)}>{SKILL_STATUS_LABELS[SkillStatus.CONFIRMED]}</button><button className="text-left px-3 py-2 text-xs hover:bg-red-50 text-red-700 font-medium" onClick={() => handleDocStatusChange(d.id, SkillStatus.FAILED)}>{SKILL_STATUS_LABELS[SkillStatus.FAILED]}</button></div>)}</td><td className={`px-4 py-4 text-center font-bold ${d.status === SkillStatus.CONFIRMED ? 'text-green-600' : 'text-slate-300'}`}>{bonus > 0 ? `+${bonus.toFixed(2)} zł` : '-'}</td><td className="px-4 py-4">{d.issue_date || '-'}</td><td className="px-4 py-4">{d.is_indefinite ? 'Bezterminowy' : (d.expires_at || '-')}</td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); openFileViewer(d); }} className="p-1.5 border border-blue-400 rounded text-blue-500 hover:bg-blue-50" title="Podgląd"><Eye size={18} /></button>{docsViewMode === 'active' ? (<button onClick={(e) => { e.stopPropagation(); archiveCandidateDocument(d.id); }} className="p-1.5 border border-red-400 rounded text-red-500" title="Archiwizuj"><Archive size={18} /></button>) : (<button onClick={(e) => { e.stopPropagation(); restoreCandidateDocument(d.id); }} className="p-1.5 border border-green-400 rounded text-green-500" title="Przywróć"><RotateCcw size={18} /></button>)}</div></td></tr>); })}</tbody></table></div>
                        )}
                        {activeTab === 'referrals' && renderReferralsTab()}
                        {activeTab === 'history' && (<div className="space-y-4">{history.map(h => (<div key={h.id} className="flex gap-4 p-3 border-b border-slate-100 last:border-0"><div className="text-slate-400 text-xs w-24 flex-shrink-0"><div>{new Date(h.created_at).toLocaleDateString()}</div><div>{new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div><div><div className="text-sm font-medium text-slate-900">{h.action}</div><div className="text-xs text-slate-500">Użytkownik: {h.performed_by}</div></div></div>))}{history.length === 0 && <p className="text-slate-400 text-sm">Brak historii działań.</p>}</div>)}
                    </div>
                </div>
            </div>
        );
    };

    const renderList = () => (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Okres Próbny</h1>
                    <p className="text-slate-500">Zarządzanie pracownikami na okresie próbnym.</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Szukaj pracownika..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Pracownik</th>
                            <th className="px-6 py-4">Kontakt</th>
                            <th className="px-6 py-4">Stanowisko</th>
                            <th className="px-6 py-4">Brygadzista</th>
                            <th className="px-6 py-4">Stawka</th>
                            <th className="px-6 py-4">Pozostało</th>
                            <th className="px-6 py-4 text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map(user => {
                            const userSkillsForTrial = userSkills.filter(us => us.user_id === user.id);
                            const salaryInfo = calculateSalary(
                                user.base_rate || systemConfig.baseRate,
                                skills,
                                userSkillsForTrial,
                                state.monthlyBonuses[user.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
                                new Date(),
                                qualityIncidents
                            );
                            const contractBonus = systemConfig.contractBonuses[user.contract_type || ContractType.UOP] || 0;
                            const studentBonus = (user.contract_type === ContractType.UZ && user.is_student) ? 3 : 0;
                            const totalRate = salaryInfo.total + contractBonus + studentBonus;

                            const brigadir = users.find(u => u.id === user.assigned_brigadir_id);

                            return (
                                <tr key={user.id} className="hover:bg-slate-50 cursor-pointer transition-colors group" onClick={() => handleOpenDetail(user)}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">{user.first_name[0]}{user.last_name[0]}</div>
                                            <div className="font-bold text-slate-900">{user.first_name} {user.last_name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-700 font-medium">{user.email}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{user.phone || 'Brak numeru'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">{user.target_position || '-'}</td>
                                    <td className="px-6 py-4 text-slate-600">{brigadir ? `${brigadir.first_name} ${brigadir.last_name}` : '-'}</td>
                                    <td className="px-6 py-4 font-black text-slate-900">{totalRate.toFixed(2)} zł/h</td>
                                    <td className="px-6 py-4">
                                        <span className={`font-bold ${(user as any).daysLeft <= 7 ? 'text-red-600' : 'text-slate-600'}`}>
                                            {(user as any).daysLeft} dni
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right"><ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 inline transition-all transform group-hover:translate-x-1"/></td>
                                </tr>
                            );
                        })}
                        {filteredUsers.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic font-medium">Brak pracowników na okresie próbnym.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderHireModal = () => {
        if (!isHireModalOpen || !hireConfig.user) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Zatrudnij Pracownika</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data zatrudnienia</label>
                            <input type="date" className="w-full border p-2 rounded" value={hireConfig.hiredDate} onChange={e => setHireConfig({...hireConfig, hiredDate: e.target.value})} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="indefinite_hire" checked={hireConfig.isIndefinite} onChange={e => setHireConfig({...hireConfig, isIndefinite: e.target.checked})} />
                            <label htmlFor="indefinite_hire" className="text-sm">Umowa na czas nieokreślony</label>
                        </div>
                        {!hireConfig.isIndefinite && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Koniec umowy</label>
                                <input type="date" className="w-full border p-2 rounded" value={hireConfig.contractEndDate} onChange={e => setHireConfig({...hireConfig, contractEndDate: e.target.value})} />
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 mt-6">
                        <Button fullWidth variant="ghost" onClick={() => setIsHireModalOpen(false)}>Anuluj</Button>
                        <Button fullWidth onClick={confirmHire}>Potwierdź</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderEditModal = () => {
        if (!isEditModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in duration-200">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">EDYTUJ DANE PRACOWNIKA</h2>
                        <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IMIĘ</label>
                                <input 
                                    className="w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                    value={editFormData.first_name || ''} 
                                    onChange={e => setEditFormData({...editFormData, first_name: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NAZWISKO</label>
                                <input 
                                    className="w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                    value={editFormData.last_name || ''} 
                                    onChange={e => setEditFormData({...editFormData, last_name: e.target.value})} 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">EMAIL</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input 
                                        className="w-full bg-slate-50/50 border border-slate-200 p-2.5 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                        value={editFormData.email || ''} 
                                        onChange={e => setEditFormData({...editFormData, email: e.target.value})} 
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TELEFON</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input 
                                        className="w-full bg-slate-50/50 border border-slate-200 p-2.5 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                        value={editFormData.phone || ''} 
                                        onChange={e => setEditFormData({...editFormData, phone: e.target.value})} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">STANOWISKO</label>
                            <select 
                                className="w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner appearance-none" 
                                value={editFormData.target_position || ''} 
                                onChange={e => setEditFormData({...editFormData, target_position: e.target.value})} 
                            >
                                <option value="">Wybierz stanowisko...</option>
                                {positions.map(pos => <option key={pos.id} value={pos.name}>{pos.name}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DATA ROZPOCZĘCIA</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                    value={editFormData.hired_date || ''} 
                                    onChange={e => setEditFormData({...editFormData, hired_date: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">KONIEC OKRESU PRÓBNEGO</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                    value={editFormData.trial_end_date || ''} 
                                    onChange={e => setEditFormData({...editFormData, trial_end_date: e.target.value})} 
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PRZYPISANY BRYGADZISTA</label>
                            <select 
                                className="w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner appearance-none" 
                                value={editFormData.assigned_brigadir_id || ''} 
                                onChange={e => setEditFormData({...editFormData, assigned_brigadir_id: e.target.value})} 
                            >
                                <option value="">Wybierz brygadzistę...</option>
                                {brigadirsList.map(b => (
                                    <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                        <button onClick={() => setIsEditModalOpen(false)} className="font-bold text-slate-500 px-6 hover:text-slate-700 transition-colors">Anuluj</button>
                        <Button onClick={saveEditUser} className="font-black uppercase text-xs tracking-widest rounded-xl px-8 h-11 shadow-lg shadow-blue-600/20">
                            ZAPISZ ZMIANY
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderDocumentModal = () => {
        if (!isDocModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[210] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 animate-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Dodaj Dokument</h2>
                        <button onClick={() => setIsDocModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X size={24}/></button>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-700">Typ Dokumentu</label>
                            <select 
                                className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" 
                                value={newDocData.typeId} 
                                onChange={e => setNewDocData({...newDocData, typeId: e.target.value})}
                            >
                                <option value="">Wybierz typ...</option>
                                {BONUS_DOCUMENT_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                                <option value="other">Inny...</option>
                            </select>
                        </div>

                        {newDocData.typeId === 'other' && (
                             <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-700">Nazwa dokumentu</label>
                                <input 
                                    className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" 
                                    placeholder="Wpisz nazwę..." 
                                    value={newDocData.customName} 
                                    onChange={e => setNewDocData({...newDocData, customName: e.target.value})} 
                                />
                             </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-700">Załącz Pliki</label>
                            <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-slate-500 hover:bg-slate-600 text-white border-0 text-xs py-1.5"
                                >
                                    Wybrać pliki
                                </Button>
                                <span className="text-xs font-bold text-slate-800">
                                    {newDocData.files.length > 0 ? `${newDocData.files.length} wybranych plików` : 'Plik nie wybrany'}
                                </span>
                                <input type="file" ref={fileInputRef} multiple className="hidden" onChange={handleFileSelect} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-700">Data Wydania</label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" 
                                        value={newDocData.issue_date} 
                                        onChange={e => setNewDocData({...newDocData, issue_date: e.target.value})} 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-700">Data Ważności</label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        className={`w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 ${newDocData.indefinite ? 'opacity-30 cursor-not-allowed' : ''}`} 
                                        value={newDocData.expires_at} 
                                        onChange={e => setNewDocData({...newDocData, expires_at: e.target.value})}
                                        disabled={newDocData.indefinite} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div 
                            className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 cursor-pointer select-none"
                            onClick={() => setNewDocData({...newDocData, indefinite: !newDocData.indefinite})}
                        >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${newDocData.indefinite ? 'bg-slate-700 border-slate-700' : 'bg-white border-slate-300'}`}>
                                {newDocData.indefinite && <CheckCircle size={14} className="text-white fill-white"/>}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BEZTERMINOWY</span>
                        </div>

                        <button 
                            onClick={handleSaveDocument}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-14 flex items-center justify-center gap-3 font-black uppercase text-sm tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95 mt-4"
                        >
                            <Save size={20}/>
                            ZAPISZ DOKUMENT
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderConfirmModal = () => {
        if (!confirmModal.isOpen || !confirmModal.user) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6 text-center">
                    <h3 className="text-xl font-bold mb-4">{confirmModal.type === 'fire' ? 'Rozwiązanie Umowy' : 'Akcja Potwierdzenia'}</h3>
                    <p className="text-sm text-slate-500 mb-6">Czy na pewno chcesz wykonać tę akcję dla <strong>{confirmModal.user.first_name} {confirmModal.user.last_name}</strong>?</p>
                    <div className="flex gap-3">
                        <Button fullWidth variant="ghost" onClick={() => setConfirmModal({isOpen: false, type: null, user: null})}>Anuluj</Button>
                        <Button fullWidth variant={confirmModal.type === 'fire' ? 'danger' : 'primary'} onClick={executeConfirmation}>Potwierdź</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSuccessModal = () => {
        if (!successModal.isOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[130] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6 text-center">
                    <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">{successModal.title}</h3>
                    <p className="text-sm text-slate-500 mb-6">{successModal.message}</p>
                    <Button fullWidth onClick={() => setSuccessModal({isOpen: false, title: '', message: ''})}>Zamknij</Button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {selectedUser ? renderDetails() : renderList()}
            {renderHireModal()}
            {renderEditModal()}
            {renderDocumentModal()}
            {renderConfirmModal()}
            {renderSuccessModal()}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
        </div>
    );
};
