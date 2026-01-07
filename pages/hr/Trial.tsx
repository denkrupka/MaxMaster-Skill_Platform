
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    ArrowRight, Search, Clock, CheckCircle, XCircle, AlertTriangle, Send, Edit, ChevronRight, ChevronDown, Upload, X, Archive, RotateCcw, Calendar, Eye, Camera, Plus, ChevronLeft, UserPlus, Wallet
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { User, Role, UserStatus, ContractType, SkillStatus, VerificationType } from '../../types';
import { calculateSalary } from '../../services/salaryService';
import { USER_STATUS_LABELS, SKILL_STATUS_LABELS, CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES, REFERRAL_BONUSES, REFERRAL_STATUS_LABELS } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

export const HRTrialPage = () => {
    const { state, updateUser, logCandidateAction, hireCandidate, addCandidateDocument, updateCandidateDocumentDetails, archiveCandidateDocument, restoreCandidateDocument, updateUserSkillStatus, resetSkillProgress, assignBrigadir, triggerNotification, payReferralBonus } = useAppContext();
    const { systemConfig, users, skills, userSkills, monthlyBonuses, currentUser } = state;

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'info'|'rate'|'skills'|'docs'|'history'|'referrals'>('info');
    
    // Document State
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

    // File Viewer
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // Modals
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'fire' | 'reminder' | 'pay_referral' | null;
        user: User | null;
    }>({ isOpen: false, type: null, user: null });

    const [successModal, setSuccessModal] = useState<{isOpen: boolean, title: string, message: string}>({isOpen: false, title: '', message: ''});

    // Hire Modal State
    const [isHireModalOpen, setIsHireModalOpen] = useState(false);
    const [hireConfig, setHireConfig] = useState<{
        hiredDate: string;
        contractEndDate: string;
        isIndefinite: boolean;
        user: User | null;
    }>({ hiredDate: '', contractEndDate: '', isIndefinite: true, user: null });

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<User>>({});

    // Reset Skill Modal
    const [resetModal, setResetModal] = useState<{isOpen: boolean, skillId: string | null}>({isOpen: false, skillId: null});

    // Contract Type Popover
    const [isContractPopoverOpen, setIsContractPopoverOpen] = useState(false);

    // Status Popover State
    const [statusPopoverSkillId, setStatusPopoverSkillId] = useState<string | null>(null);
    const [statusPopoverDocId, setStatusPopoverDocId] = useState<string | null>(null);

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const trialUsers = state.users.filter(u => u.status === UserStatus.TRIAL);
    // Filter brigadirs
    const brigadirsList = state.users.filter(u => u.role === Role.BRIGADIR || u.target_position === 'Brygadzista');

    const filteredUsers = trialUsers.filter(u => {
        const matchesSearch = u.first_name.toLowerCase().includes(search.toLowerCase()) || 
                              u.last_name.toLowerCase().includes(search.toLowerCase());
        
        // Calculate days left for display logic
        const endDate = u.trial_end_date ? new Date(u.trial_end_date) : new Date();
        const now = new Date();
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        // Attach daysLeft for rendering (conceptual, not actual prop mutation on state object)
        (u as any).daysLeft = daysLeft;
        
        return matchesSearch;
    });

    // --- Actions ---

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

    const handleReminderClick = (user: User) => {
        setConfirmModal({ isOpen: true, type: 'reminder', user });
    };

    const handlePayReferral = (referralUser: User) => {
        setConfirmModal({ isOpen: true, type: 'pay_referral', user: referralUser });
    };

    const executeConfirmation = async () => {
        const { type, user } = confirmModal;
        if (!user || !type) return;

        try {
            if (type === 'fire') {
                // Move to Candidate Archive or Inactive
                await updateUser(user.id, { 
                    status: UserStatus.INACTIVE, 
                    role: Role.CANDIDATE 
                });
                await logCandidateAction(user.id, 'Rozwiązano umowę w trakcie okresu próbnego (Archiwizacja)');
                
                // Trigger Notification
                triggerNotification('termination', 'Rozwiązanie Umowy (Trial)', `Rozwiązano umowę z pracownikiem ${user.first_name} ${user.last_name} w trakcie okresu próbnego.`, '/hr/trial');

                setSuccessModal({
                    isOpen: true,
                    title: 'Umowa Rozwiązana',
                    message: `Pracownik ${user.first_name} ${user.last_name} został przeniesiony do archiwum kandydatów.`
                });
                setSelectedUser(null);
            } else if (type === 'reminder') {
                // Simulate sending reminder
                await logCandidateAction(user.id, `Wysłano przypomnienie o końcu okresu próbnego (Email: ${user.email})`);
                setSuccessModal({
                    isOpen: true,
                    title: 'Przypomnienie Wysłane',
                    message: `Wysłano powiadomienie do ${user.email}.`
                });
            } else if (type === 'pay_referral') {
                await payReferralBonus(user.id);
                setSuccessModal({
                    isOpen: true,
                    title: 'Bonus Wypłacony',
                    message: `Pomyślnie zarejestrowano wypłatę bonusu za polecenie.`
                });
            }
        } catch (error) {
            console.error("Action error:", error);
            alert("Wystąpił błąd podczas wykonywania akcji.");
        }
        setConfirmModal({ isOpen: false, type: null, user: null });
    };

    // --- Edit User Logic ---
    const handleEditUser = () => {
        if (selectedUser) {
            setEditFormData({
                first_name: selectedUser.first_name,
                last_name: selectedUser.last_name,
                email: selectedUser.email,
                phone: selectedUser.phone,
                target_position: selectedUser.target_position,
                hired_date: selectedUser.hired_date, // Trial Start
                trial_end_date: selectedUser.trial_end_date, // Trial End
                assigned_brigadir_id: selectedUser.assigned_brigadir_id
            });
            setIsEditModalOpen(true);
        }
    };

    const saveEditUser = async () => {
        if (selectedUser) {
            const changes = [];
            if(selectedUser.first_name !== editFormData.first_name) changes.push(`Imię: ${selectedUser.first_name} -> ${editFormData.first_name}`);
            if(selectedUser.last_name !== editFormData.last_name) changes.push(`Nazwisko: ${selectedUser.last_name} -> ${editFormData.last_name}`);
            if(selectedUser.email !== editFormData.email) changes.push(`Email: ${selectedUser.email} -> ${editFormData.email}`);
            if(selectedUser.phone !== editFormData.phone) changes.push(`Telefon: ${selectedUser.phone} -> ${editFormData.phone}`);
            if(selectedUser.target_position !== editFormData.target_position) changes.push(`Stanowisko: ${selectedUser.target_position} -> ${editFormData.target_position}`);
            
            if(selectedUser.assigned_brigadir_id !== editFormData.assigned_brigadir_id) {
                 const oldBrig = state.users.find(u => u.id === selectedUser.assigned_brigadir_id);
                 const newBrig = state.users.find(u => u.id === editFormData.assigned_brigadir_id);
                 changes.push(`Brygadzista: ${oldBrig ? oldBrig.first_name + ' ' + oldBrig.last_name : 'Brak'} -> ${newBrig ? newBrig.first_name + ' ' + newBrig.last_name : 'Brak'}`);
            }

            try {
                await updateUser(selectedUser.id, editFormData);
                
                // If brigadir changed
                if (editFormData.assigned_brigadir_id !== selectedUser.assigned_brigadir_id && editFormData.assigned_brigadir_id) {
                    assignBrigadir(selectedUser.id, editFormData.assigned_brigadir_id);
                }

                setSelectedUser({ ...selectedUser, ...editFormData } as User);
                setIsEditModalOpen(false);
                
                if(changes.length > 0) {
                     await logCandidateAction(selectedUser.id, `Zaktualizowano dane pracownika (Trial): ${changes.join(', ')}`);
                }
            } catch (error) {
                alert("Błąd podczas zapisywania zmian.");
            }
        }
    };

    const updateContractType = async (type: ContractType) => {
        if (selectedUser) {
            await updateUser(selectedUser.id, { contract_type: type });
            await logCandidateAction(selectedUser.id, `Zmieniono formę zatrudnienia na: ${CONTRACT_TYPE_LABELS[type]}`);
            setSelectedUser({ ...selectedUser, contract_type: type } as User);
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

    // --- Document Logic ---
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
        const doc = state.userSkills.find(us => us.id === docId);
        if(!doc) return;
        setEditingDocId(docId);
        setNewDocData({
            typeId: 'other', // Default for edit unless mapped
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

    const handleSaveDocument = async () => {
        if(!selectedUser) return;
        
        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' || editingDocId ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;

        if (!docName) return alert("Podaj nazwę dokumentu.");

        const docPayload: any = {
            custom_name: docName,
            issue_date: newDocData.issue_date,
            expires_at: newDocData.indefinite ? undefined : newDocData.expires_at,
            is_indefinite: newDocData.indefinite,
        };

        if (newDocData.files.length > 0) {
             const urls = newDocData.files.map(f => {
                 const url = URL.createObjectURL(f);
                 return f.type === 'application/pdf' ? `${url}#pdf` : url;
             });
             docPayload.document_urls = urls;
             docPayload.document_url = urls[0];
        }

        if (!editingDocId) docPayload.bonus_value = bonus;

        try {
            if (editingDocId) {
                await updateCandidateDocumentDetails(editingDocId, docPayload);
            } else {
                await addCandidateDocument(selectedUser.id, {
                    skill_id: 'doc_generic',
                    status: SkillStatus.PENDING,
                    ...docPayload
                });
            }
            setIsDocModalOpen(false);
        } catch (error) {
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

    // --- Skills Logic ---
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

    const formatContractType = (type?: ContractType) => {
        return type ? CONTRACT_TYPE_LABELS[type] : '-';
    };

    // --- Views ---

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
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <UserPlus size={18} className="text-blue-600"/> Zaproszeni pracownicy ({myReferrals.length})
                    </h3>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Znajomy</th>
                                <th className="px-6 py-4">Stanowisko</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Postęp (90 dni)</th>
                                <th className="px-6 py-4">Bonus</th>
                                <th className="px-6 py-4 text-right">Akcja</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {myReferrals.map((ref) => (
                                <tr key={ref.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{ref.first_name} {ref.last_name}</td>
                                    <td className="px-6 py-4 text-slate-600">{ref.target_position || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${
                                            ref.refStatus === 'working' ? 'bg-green-50 text-green-700 border-green-200' :
                                            ref.refStatus === 'dismissed' ? 'bg-red-50 text-red-700 border-red-200' :
                                            'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                            {REFERRAL_STATUS_LABELS[ref.refStatus]}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden max-w-[100px]">
                                                <div className="bg-blue-500 h-full" style={{ width: `${ref.progress}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500">{ref.daysWorking}d</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{ref.bonusAmount} zł</div>
                                        <div className={`text-[10px] font-black uppercase ${ref.referral_bonus_paid ? 'text-green-600' : 'text-slate-400'}`}>
                                            {ref.referral_bonus_paid ? 'Wypłacono' : 'Do wypłaty'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {ref.referral_bonus_paid ? (
                                            <span className="text-xs text-slate-400 italic">Wypłacono</span>
                                        ) : (
                                            <Button 
                                                size="sm" 
                                                disabled={!ref.isReadyToPay}
                                                onClick={() => handlePayReferral(ref)}
                                                className={ref.isReadyToPay ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                                            >
                                                Wypłać
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {myReferrals.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                                        Brak zaproszonych osób.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderList = () => (
        <>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Okres Próbny</h1>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Szukaj pracownika..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            <th className="px-6 py-4">Stanowisko</th>
                            <th className="px-6 py-4">Kontakt</th>
                            <th className="px-6 py-4">Koniec Próby</th>
                            <th className="px-6 py-4 text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map(user => {
                            // daysLeft is attached in filter logic in the component
                            const daysLeft = (user as any).daysLeft;
                            const isExpired = daysLeft <= 0;

                            return (
                                <tr key={user.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleOpenDetail(user)}>
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                                                {user.first_name[0]}{user.last_name[0]}
                                            </div>
                                            <div>
                                                <div>{user.first_name} {user.last_name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{user.target_position || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-900">{user.email}</div>
                                        <div className="text-slate-500 text-xs">{user.phone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={isExpired ? 'text-red-600 font-bold' : 'text-slate-700'}>
                                            {user.trial_end_date}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {isExpired ? `Po terminie (${Math.abs(daysLeft)} dni)` : `${daysLeft} dni do końca`}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button size="sm" variant="ghost"><ChevronRight size={18}/></Button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredUsers.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Brak pracowników w okresie próbnym.</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );

    const renderHireModal = () => {
        if (!isHireModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Zatrudnij Pracownika</h2>
                        <button onClick={() => setIsHireModalOpen(false)}><X size={24} className="text-slate-400"/></button>
                    </div>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">
                            Zakończ okres próbny i zatrudnij pracownika <strong>{hireConfig.user?.first_name} {hireConfig.user?.last_name}</strong> na stałe.
                        </p>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Data Zatrudnienia (Start)</label>
                            <input 
                                type="date" 
                                className="w-full border p-2 rounded" 
                                value={hireConfig.hiredDate} 
                                onChange={e => setHireConfig({...hireConfig, hiredDate: e.target.value})} 
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                            <input 
                                type="checkbox" 
                                id="indefiniteCheck" 
                                checked={hireConfig.isIndefinite}
                                onChange={e => setHireConfig({...hireConfig, isIndefinite: e.target.checked})}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <label htmlFor="indefiniteCheck" className="text-sm text-slate-700 font-medium">Umowa na czas nieokreślony</label>
                        </div>

                        {!hireConfig.isIndefinite && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Data Końca Umowy</label>
                                <input 
                                    type="date" 
                                    className="w-full border p-2 rounded" 
                                    value={hireConfig.contractEndDate} 
                                    onChange={e => setHireConfig({...hireConfig, contractEndDate: e.target.value})} 
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="ghost" onClick={() => setIsHireModalOpen(false)}>Anuluj</Button>
                        <Button onClick={confirmHire}>Zatwierdź Zatrudnienie</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderEditModal = () => {
        if (!isEditModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Edytuj Dane (Okres Próbny)</h2>
                        <button onClick={() => setIsEditModalOpen(false)}><X size={24} className="text-slate-400"/></button>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Imię</label><input className="w-full border p-2 rounded" value={editFormData.first_name || ''} onChange={e => setEditFormData({...editFormData, first_name: e.target.value})} /></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Nazwisko</label><input className="w-full border p-2 rounded" value={editFormData.last_name || ''} onChange={e => setEditFormData({...editFormData, last_name: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Email</label><input className="w-full border p-2 rounded" value={editFormData.email || ''} onChange={e => setEditFormData({...editFormData, email: e.target.value})} /></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Telefon</label><input className="w-full border p-2 rounded" value={editFormData.phone || ''} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} /></div>
                        </div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Stanowisko</label><select className="w-full border p-2 rounded bg-white" value={editFormData.target_position || ''} onChange={e => setEditFormData({...editFormData, target_position: e.target.value})}><option value="">Wybierz...</option>{systemConfig.positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}</select></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Start Okresu Próbnego</label><input type="date" className="w-full border p-2 rounded" value={editFormData.hired_date || ''} onChange={e => setEditFormData({...editFormData, hired_date: e.target.value})} /></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Koniec Okresu Próbnego</label><input type="date" className="w-full border p-2 rounded" value={editFormData.trial_end_date || ''} onChange={e => setEditFormData({...editFormData, trial_end_date: e.target.value})} /></div>
                        </div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Przypisany Brygadzista</label><select className="w-full border p-2 rounded bg-white" value={editFormData.assigned_brigadir_id || ''} onChange={e => setEditFormData({...editFormData, assigned_brigadir_id: e.target.value})}><option value="">Wybierz...</option>{brigadirsList.map(b => <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>)}</select></div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Anuluj</Button>
                        <Button onClick={saveEditUser}>Zapisz Zmiany</Button>
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
                        <Button onClick={handleSaveDocument} disabled={!newDocData.customName && !newDocData.typeId}>Zapisz</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderConfirmModal = () => {
        if (!confirmModal.isOpen || !confirmModal.user) return null;
        let title = '';
        let btnText = 'Potwierdź';
        let btnVariant = 'primary';
        let content = null;

        if (confirmModal.type === 'fire') {
            title = 'Rozwiąż Umowę';
            btnText = 'Rozwiąż Umowę';
            btnVariant = 'danger';
            content = (
                <p className="text-sm text-slate-500 mb-4">
                    Czy na pewno chcesz rozwiązać umowę w trakcie okresu próbnego z pracownikiem <strong>{confirmModal.user.first_name} {confirmModal.user.last_name}</strong>? 
                    <br/><br/>
                    Pracownik zostanie przeniesiony do archiwum kandydatów (status: Odrzucony).
                </p>
            );
        } else if (confirmModal.type === 'reminder') {
            title = 'Wyślij Przypomnienie';
            btnText = 'Wyślij';
            content = (
                <p className="text-slate-500 mb-6">
                    Czy wysłać przypomnienie o końcu okresu próbnego do pracownika?
                </p>
            );
        } else if (confirmModal.type === 'pay_referral') {
            title = 'Potwierdź Wypłatę Bonusu';
            btnText = 'Zatwierdź';
            content = (
                <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                        <Wallet size={32}/>
                    </div>
                    <p className="text-sm text-slate-500">
                        Czy potwierdzasz wypłatę bonusu za polecenie kandydata: <br/>
                        <strong>{confirmModal.user.first_name} {confirmModal.user.last_name}</strong>?
                    </p>
                </div>
            );
        }

        return (
            <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                     <div className="flex flex-col text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto ${btnVariant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'} ${confirmModal.type === 'pay_referral' ? 'hidden' : ''}`}>
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">{title}</h3>
                        {content}
                        <div className="flex gap-3 w-full mt-6">
                            <Button fullWidth variant="ghost" onClick={() => setConfirmModal({isOpen: false, type: null, user: null})}>Anuluj</Button>
                            <Button fullWidth variant={btnVariant as any} onClick={executeConfirmation}>{btnText}</Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderSuccessModal = () => {
        if (!successModal.isOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                    <div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4"><CheckCircle size={32} /></div><h3 className="text-xl font-bold text-slate-900 mb-2">{successModal.title}</h3><p className="text-slate-500 mb-6">{successModal.message}</p><Button fullWidth onClick={() => setSuccessModal({ ...successModal, isOpen: false })}>OK</Button></div>
                </div>
            </div>
        );
    };

    const renderResetModal = () => {
        if (!resetModal.isOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4"><RotateCcw size={24} /></div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Resetuj Postęp</h3>
                        <p className="text-sm text-slate-500 mb-6">Wybierz, który element chcesz zresetować. Operacja jest nieodwracalna.</p>
                        <div className="space-y-2 w-full">
                            <Button fullWidth variant="outline" onClick={() => { if(selectedUser && resetModal.skillId) { resetSkillProgress(selectedUser.id, resetModal.skillId, 'theory'); setResetModal({isOpen: false, skillId: null}); }}}>Tylko Teoria</Button>
                            <Button fullWidth variant="outline" onClick={() => { if(selectedUser && resetModal.skillId) { resetSkillProgress(selectedUser.id, resetModal.skillId, 'practice'); setResetModal({isOpen: false, skillId: null}); }}}>Tylko Praktyka</Button>
                            <Button fullWidth variant="danger" onClick={() => { if(selectedUser && resetModal.skillId) { resetSkillProgress(selectedUser.id, resetModal.skillId, 'both'); setResetModal({isOpen: false, skillId: null}); }}}>Zresetuj Całość</Button>
                            <Button fullWidth variant="ghost" onClick={() => setResetModal({ isOpen: false, skillId: null })}>Anuluj</Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const handleOpenDetail = (user: User) => {
        setSelectedUser(user);
        setActiveTab('info');
    };

    const renderDetail = () => {
        if (!selectedUser) return null;

        const salaryData = calculateSalary(
            selectedUser.base_rate || systemConfig.baseRate, 
            state.skills, 
            state.userSkills.filter(us => us.user_id === selectedUser.id), 
            state.monthlyBonuses[selectedUser.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 }
        );

        const contractBonus = systemConfig.contractBonuses[selectedUser.contract_type || ContractType.UOP] || 0;
        const studentBonus = (selectedUser.contract_type === ContractType.UZ && selectedUser.is_student) ? 3 : 0;
        const totalRateWithContract = salaryData.total + contractBonus + studentBonus;

        const docs = state.userSkills.filter(us => us.user_id === selectedUser.id && (state.skills.find(s => s.id === us.skill_id)?.verification_type === VerificationType.DOCUMENT || us.skill_id.startsWith('doc_')));
        const history = state.candidateHistory.filter(h => h.candidate_id === selectedUser.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        const relevantUserSkills = state.userSkills.filter(us => us.user_id === selectedUser.id && us.skill_id && !us.skill_id.startsWith('doc_'));
        
        const skillList = relevantUserSkills.map(us => {
            const skill = state.skills.find(s => s.id === us.skill_id);
            if (!skill) return null;
            
            const isTheoryPassed = us.theory_score !== undefined && us.theory_score >= (skill.required_pass_rate || 80);
            const theoryStatus = us.theory_score !== undefined 
                ? (isTheoryPassed ? 'Zaliczona' : 'Niezaliczona') 
                : 'Brak';

            let practiceStatus = 'Brak';
            if (skill.verification_type === VerificationType.THEORY_PRACTICE) {
                if (us.status === SkillStatus.CONFIRMED) practiceStatus = 'Zaliczona';
                else if (us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING) practiceStatus = 'Oczekuje';
            }

            if (theoryStatus === 'Brak' && practiceStatus === 'Brak') return null;

            let statusText = 'Oczekuje';
            let statusColor = 'bg-yellow-100 text-yellow-700';
            
            if (us.status === SkillStatus.CONFIRMED) {
                statusText = us.rejection_reason === 'MANUAL_NO_PRACTICE' ? 'Zaliczony (bez praktyki)' : 'Zaliczony';
                statusColor = 'bg-green-100 text-green-700';
            } else if (us.status === SkillStatus.FAILED) {
                statusText = 'Niezaliczony';
                statusColor = 'bg-red-100 text-red-700';
            } else if (us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING) {
                statusText = 'Oczekuje na praktykę';
            }

            return {
                ...us,
                skillName: skill.name_pl,
                hourlyBonus: skill.hourly_bonus,
                theoryStatus,
                practiceStatus,
                statusText,
                statusColor,
                skillId: skill.id
            };
        }).filter(Boolean);

        const brigadirName = state.users.find(u => u.id === selectedUser.assigned_brigadir_id);
        
        const endDate = selectedUser.trial_end_date ? new Date(selectedUser.trial_end_date) : new Date();
        const now = new Date();
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        const isExpired = daysLeft <= 0;

        return (
            <div onClick={() => { setStatusPopoverSkillId(null); setIsContractPopoverOpen(false); setStatusPopoverDocId(null); }}>
                <Button variant="ghost" onClick={() => setSelectedUser(null)} className="mb-4">
                    <ArrowRight className="transform rotate-180 mr-2" size={18} /> Wróć do listy
                </Button>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">
                                {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{selectedUser.first_name} {selectedUser.last_name}</h1>
                                <div className="text-sm text-slate-500 flex gap-4 mt-1">
                                    <span>{selectedUser.email}</span>
                                    <span>{selectedUser.phone}</span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 mt-2">
                                    Stanowisko: <span className="font-normal text-slate-600">{selectedUser.target_position || '-'}</span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 mt-1">
                                    Forma Zatrudnienia: <span className="font-normal text-slate-600">
                                        {formatContractType(selectedUser.contract_type)}
                                    </span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 mt-1">
                                    Okres Próbny: <span className="font-normal text-slate-600">
                                        {new Date(selectedUser.hired_date).toLocaleDateString()} - {selectedUser.trial_end_date ? new Date(selectedUser.trial_end_date).toLocaleDateString() : '-'}
                                    </span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 mt-1">
                                    Brygadzista: <span className="font-normal text-slate-600">
                                        {brigadirName ? `${brigadirName.first_name} ${brigadirName.last_name}` : '-'}
                                    </span>
                                </div>
                                <div className={`mt-2 font-bold text-sm ${isExpired ? 'text-red-600' : 'text-slate-500'}`}>
                                    {isExpired ? `Po terminie (${Math.abs(daysLeft)} dni)` : `Pozostało: ${daysLeft} dni`}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2">
                                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">{USER_STATUS_LABELS[UserStatus.TRIAL]}</span>
                                <Button size="sm" variant="outline" onClick={handleEditUser}>
                                    <Edit size={16} className="mr-2"/> Edytuj
                                </Button>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Button size="sm" variant="secondary" onClick={() => handleReminderClick(selectedUser)}>
                                    <Send size={16} className="mr-2"/> Przypomnienie
                                </Button>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleHireClick(selectedUser)}>
                                    <CheckCircle size={16} className="mr-2"/> Zatrudnij na Stałe
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => handleFireClick(selectedUser)}>
                                    <XCircle size={16} className="mr-2"/> Rozwiąż Umowę
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="flex border-b border-slate-200 px-6 overflow-x-auto">
                        <button onClick={() => setActiveTab('info')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Info</button>
                        <button onClick={() => setActiveTab('rate')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'rate' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Stawka</button>
                        <button onClick={() => setActiveTab('skills')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'skills' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Umiejętności</button>
                        <button onClick={() => setActiveTab('docs')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'docs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Dokumenty</button>
                        <button onClick={() => setActiveTab('referrals')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'referrals' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Polecenia</button>
                        <button onClick={() => setActiveTab('history')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Historia</button>
                    </div>

                    <div className="p-6">
                        {activeTab === 'info' && (
                             <div>
                                <h3 className="font-bold text-slate-900 mb-4">Notatki</h3>
                                <textarea 
                                    className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50" 
                                    rows={6} 
                                    value={selectedUser.notes || ''}
                                    onChange={(e) => updateUser(selectedUser.id, { notes: e.target.value })}
                                />
                                <div className="mt-2 text-right">
                                    <Button size="sm" onClick={() => alert("Notatka zapisana")}>Zapisz</Button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rate' && (
                             <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-6">Stawka Pracownika</h3>
                                <div className="grid grid-cols-4 gap-6 text-center">
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Baza</div>
                                        <div className="text-2xl font-bold text-slate-900">{salaryData.breakdown.base} zł</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100">
                                        <div className="text-xs text-green-600 uppercase tracking-wider mb-1">Umiejętności</div>
                                        <div className="text-2xl font-bold text-green-600">+{salaryData.breakdown.skills} zł</div>
                                    </div>

                                    <div className="relative">
                                        <div 
                                            className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 cursor-pointer hover:bg-blue-50 transition-colors h-full flex flex-col justify-center"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsContractPopoverOpen(!isContractPopoverOpen);
                                            }}
                                        >
                                            <div className="text-xs text-blue-600 uppercase tracking-wider mb-1">Forma Zatrudnienia</div>
                                            <div className="text-lg font-bold text-blue-600 flex items-center justify-center gap-1">
                                                {formatContractType(selectedUser.contract_type)}
                                                 <ChevronDown size={14} />
                                            </div>
                                            <div className="text-xs text-blue-400 font-medium mt-1">
                                                {contractBonus + studentBonus > 0 ? `+${contractBonus + studentBonus} zł/h` : 'Bez dodatku'}
                                            </div>
                                        </div>
                                        
                                        {isContractPopoverOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-lg z-10 flex flex-col py-1">
                                                <button className="px-4 py-2 text-sm text-left hover:bg-slate-50 text-slate-700" onClick={() => updateContractType(ContractType.UOP)}>Umowa o Pracę</button>
                                                <div className="border-t border-slate-100 my-1"></div>
                                                <button className="px-4 py-2 text-sm text-left hover:bg-slate-50 text-slate-700" onClick={() => updateContractType(ContractType.UZ)}>Umowa Zlecenie</button>
                                                {selectedUser.contract_type === ContractType.UZ && (
                                                    <div className="px-4 py-2 flex items-center gap-2 bg-blue-50">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedUser.is_student}
                                                            onChange={(e) => toggleStudentStatus(e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                        />
                                                        <span className="text-xs text-slate-700 font-medium">Student &lt; 26 lat (+3 zł)</span>
                                                    </div>
                                                )}
                                                <div className="border-t border-slate-100 my-1"></div>
                                                <button className="px-4 py-2 text-sm text-left hover:bg-slate-50 text-slate-700" onClick={() => updateContractType(ContractType.B2B)}>B2B</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-slate-900 p-4 rounded-lg shadow-sm text-white">
                                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Stawka Total</div>
                                        <div className="text-2xl font-bold">{totalRateWithContract.toFixed(2)} zł/h netto</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'skills' && (
                             <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Umiejętność</th>
                                        <th className="px-4 py-3">Stawka</th>
                                        <th className="px-4 py-3">Teoria</th>
                                        <th className="px-4 py-3">Praktyka</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Akcje</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {skillList.map((skill: any) => (
                                        <tr key={skill.id}>
                                            <td className="px-4 py-3 font-medium">{skill.skillName}</td>
                                            <td className="px-4 py-3 font-bold text-green-600">+{skill.hourlyBonus} zł</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    skill.theoryStatus === 'Zaliczona' ? 'bg-green-100 text-green-700' : 
                                                    skill.theoryStatus === 'Niezaliczona' ? 'bg-red-100 text-red-700' :
                                                    'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {skill.theoryStatus}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${skill.practiceStatus === 'Zaliczona' ? 'bg-green-100 text-green-700' : skill.practiceStatus === 'Oczekuje' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {skill.practiceStatus}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 relative" onClick={(e) => { e.stopPropagation(); setStatusPopoverSkillId(skill.skillId); }}>
                                                 <span className={`px-2 py-1 rounded text-xs uppercase font-bold cursor-pointer hover:opacity-80 ${skill.statusColor}`}>
                                                    {skill.statusText}
                                                </span>
                                                
                                                {statusPopoverSkillId === skill.skillId && (
                                                    <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 shadow-xl rounded-lg z-[9999] flex flex-col py-1">
                                                        <button className="text-left px-3 py-2 text-xs hover:bg-yellow-50 text-yellow-700" onClick={() => changeSkillStatus(skill.skillId, SkillStatus.PRACTICE_PENDING)}>{SKILL_STATUS_LABELS[SkillStatus.PRACTICE_PENDING]}</button>
                                                        <button className="text-left px-3 py-2 text-xs hover:bg-green-50 text-green-700" onClick={() => changeSkillStatus(skill.skillId, SkillStatus.CONFIRMED)}>{SKILL_STATUS_LABELS[SkillStatus.CONFIRMED]}</button>
                                                        <button className="text-left px-3 py-2 text-xs hover:bg-blue-50 text-blue-700" onClick={() => changeSkillStatus(skill.skillId, SkillStatus.CONFIRMED, 'MANUAL_NO_PRACTICE')}>Nawyk zaliczony bez praktyki</button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button size="sm" variant="ghost" onClick={() => setResetModal({ isOpen: true, skillId: skill.skillId })}>
                                                    Reset
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {skillList.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">Brak rozpoczętych umiejętności.</td></tr>}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'docs' && (
                             <div onClick={() => setStatusPopoverDocId(null)}>
                                <div className="flex justify-between mb-4">
                                     <div className="relative w-64">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                                        <input type="text" placeholder="Szukaj dokumentu..." className="w-full pl-9 pr-2 py-1.5 border rounded text-sm" value={docSearch} onChange={(e) => setDocSearch(e.target.value)} />
                                     </div>
                                     <div className="flex gap-2">
                                         <Button size="sm" variant={docsViewMode === 'active' ? 'secondary' : 'primary'} onClick={() => setDocsViewMode(prev => prev === 'active' ? 'archived' : 'active')}>
                                            {docsViewMode === 'active' ? <><Archive size={16} className="mr-2"/> Archiwum</> : <><RotateCcw size={16} className="mr-2"/> Aktywne</>}
                                         </Button>
                                         <Button size="sm" onClick={handleAddDocument}><Upload size={16} className="mr-2"/> Dodaj Dokument</Button>
                                     </div>
                                </div>
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Dokument</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Data Wydania</th>
                                            <th className="px-4 py-3">Ważność</th>
                                            <th className="px-4 py-3">Plik</th>
                                            <th className="px-4 py-3 text-right">Akcje</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {docs.filter(d => docsViewMode === 'active' ? !d.is_archived : d.is_archived).map(d => {
                                            const skill = state.skills.find(s => s.id === d.skill_id);
                                            // Expiry Check
                                            let expiryClass = '';
                                            if (d.expires_at) {
                                                const days = Math.ceil((new Date(d.expires_at).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                                if (days < 0) expiryClass = 'bg-red-50 text-red-600 font-bold';
                                                else if (days < 30) expiryClass = 'bg-yellow-50 text-yellow-700 font-bold';
                                            }
                                            return (
                                                <tr key={d.id} className={`${expiryClass} hover:bg-slate-50 cursor-pointer`} onClick={() => handleEditDocument(d.id)}>
                                                    <td className="px-4 py-3 font-medium">{d.custom_name || skill?.name_pl || 'Dokument'}</td>
                                                    <td className="px-4 py-3 relative" onClick={(e) => { e.stopPropagation(); setStatusPopoverDocId(d.id); }}>
                                                         <span className={`px-2 py-1 rounded text-xs uppercase font-bold cursor-pointer hover:opacity-80 ${
                                                            d.status === SkillStatus.CONFIRMED ? 'bg-green-100 text-green-700' : 
                                                            d.status === SkillStatus.FAILED ? 'bg-red-100 text-red-700' : 
                                                            d.status === SkillStatus.SUSPENDED ? 'bg-orange-100 text-orange-700' : 
                                                            'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                            {SKILL_STATUS_LABELS[d.status] || d.status}
                                                        </span>
                                                        {statusPopoverDocId === d.id && (
                                                            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-lg z-[9999] flex flex-col py-1">
                                                                <button className="text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700" onClick={() => handleDocStatusChange(d.id, SkillStatus.PENDING)}>{SKILL_STATUS_LABELS[SkillStatus.PENDING]}</button>
                                                                <button className="text-left px-3 py-2 text-xs hover:bg-green-50 text-green-700 font-medium" onClick={() => handleDocStatusChange(d.id, SkillStatus.CONFIRMED)}>{SKILL_STATUS_LABELS[SkillStatus.CONFIRMED]}</button>
                                                                <button className="text-left px-3 py-2 text-xs hover:bg-orange-50 text-orange-700 font-medium" onClick={() => handleDocStatusChange(d.id, SkillStatus.SUSPENDED)}>{SKILL_STATUS_LABELS[SkillStatus.SUSPENDED]}</button>
                                                                <button className="text-left px-3 py-2 text-xs hover:bg-red-50 text-red-700 font-medium" onClick={() => handleDocStatusChange(d.id, SkillStatus.FAILED)}>{SKILL_STATUS_LABELS[SkillStatus.FAILED]}</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">{d.issue_date || '-'}</td>
                                                    <td className="px-4 py-3">{d.is_indefinite ? 'Bezterminowy' : (d.expires_at || '-')}</td>
                                                    <td className="px-4 py-3">
                                                        {d.document_url && <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); openFileViewer(d); }}>Otwórz</Button>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                         {docsViewMode === 'active' ? (
                                                            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); archiveCandidateDocument(d.id); }}><Archive size={16}/></Button>
                                                        ) : (
                                                            <Button size="sm" variant="ghost" className="text-blue-500 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); restoreCandidateDocument(d.id); }}><RotateCcw size={16}/></Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {docs.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">Brak dokumentów.</td></tr>}
                                    </tbody>
                                </table>
                             </div>
                        )}

                        {activeTab === 'referrals' && renderReferralsTab()}

                         {activeTab === 'history' && (
                            <div className="space-y-4">
                                {history.map(h => (
                                    <div key={h.id} className="flex gap-4 p-3 border-b border-slate-100 last:border-0">
                                        <div className="text-slate-400 text-xs w-24 flex-shrink-0">
                                            <div>{new Date(h.created_at).toLocaleDateString()}</div>
                                            <div>{new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900">{h.action}</div>
                                            <div className="text-xs text-slate-500">Użytkownik: {h.performed_by}</div>
                                        </div>
                                    </div>
                                ))}
                                {history.length === 0 && <p className="text-slate-400 text-sm">Brak historii działań.</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Main render
    return (
        <div className="p-6 max-w-7xl mx-auto">
            {selectedUser ? renderDetail() : renderList()}
            {renderHireModal()}
            {renderEditModal()}
            {renderDocumentModal()}
            {renderConfirmModal()}
            {renderSuccessModal()}
            {renderResetModal()}
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
