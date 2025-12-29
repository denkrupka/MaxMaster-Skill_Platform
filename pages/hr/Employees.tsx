
import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, AlertTriangle, Archive, RotateCcw, UserMinus, Edit, X, Plus, Upload, ChevronRight, ChevronDown, CheckCircle, Clock, Trash2, Camera, Eye, ChevronLeft, MessageSquare, StickyNote, Award, UserPlus, Wallet } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { User, Role, UserStatus, ContractType, SkillStatus, VerificationType, NoteCategory, EmployeeNote } from '../../types';
import { calculateSalary } from '../../services/salaryService';
import { USER_STATUS_LABELS, SKILL_STATUS_LABELS, CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES, TERMINATION_REASONS, REFERRAL_BONUSES, REFERRAL_STATUS_LABELS } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

export const HREmployeesPage = () => {
    const { state, updateUser, logCandidateAction, addCandidateDocument, updateCandidateDocumentDetails, archiveCandidateDocument, restoreCandidateDocument, updateUserSkillStatus, resetSkillProgress, assignBrigadir, triggerNotification, addEmployeeNote, deleteEmployeeNote, payReferralBonus } = useAppContext();
    const { systemConfig, currentUser, users, skills, userSkills, monthlyBonuses, qualityIncidents, employeeNotes, employeeBadges } = state;
    const navigate = useNavigate();

    const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
    const [search, setSearch] = useState('');
    
    // View States
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [positionFilter, setPositionFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<'info'|'rate'|'skills'|'docs'|'history'|'notes'|'badges'|'referrals'>('info');

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<User>>({});

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'fire' | 'restore' | 'pay_referral' | null;
        user: User | null;
    }>({ isOpen: false, type: null, user: null });

    // Fire Config State
    const [fireConfig, setFireConfig] = useState<{
        initiator: 'company' | 'employee' | '';
        reason: string;
    }>({ initiator: '', reason: '' });

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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // File Viewer
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // Reset Skill Modal
    const [resetModal, setResetModal] = useState<{isOpen: boolean, skillId: string | null}>({isOpen: false, skillId: null});

    // Popover States
    const [isContractPopoverOpen, setIsContractPopoverOpen] = useState(false);
    const [statusPopoverSkillId, setStatusPopoverSkillId] = useState<string | null>(null);
    const [statusPopoverDocId, setStatusPopoverDocId] = useState<string | null>(null);

    // Note State
    const [noteText, setNoteText] = useState('');
    const [noteCategory, setNoteCategory] = useState<NoteCategory>(NoteCategory.GENERAL);

    // Get all relevant users (Employees & Brigadirs)
    const allEmployees = state.users.filter(u => u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR);
    // Updated brigadirs list filter
    const brigadirsList = state.users.filter(u => u.role === Role.BRIGADIR || u.target_position === 'Brygadzista');

    // Filter Logic
    const filteredEmployees = allEmployees.filter(e => {
        // 1. View Mode Filter
        if (viewMode === 'active') {
            // Show only active employees (Exclude Trial)
            if (e.status !== UserStatus.ACTIVE) return false;
        } else {
            // Show only inactive (archived) employees
            if (e.status !== UserStatus.INACTIVE) return false;
        }

        // 2. Search Filter
        const matchesSearch = e.first_name.toLowerCase().includes(search.toLowerCase()) || 
                              e.last_name.toLowerCase().includes(search.toLowerCase());
        
        // 3. Position Filter
        const matchesPosition = positionFilter === 'all' || e.target_position === positionFilter;

        return matchesSearch && matchesPosition;
    });

    // --- Actions ---

    const handleEditEmployee = () => {
        if (selectedEmployee) {
            setEditFormData({
                first_name: selectedEmployee.first_name,
                last_name: selectedEmployee.last_name,
                email: selectedEmployee.email,
                phone: selectedEmployee.phone,
                target_position: selectedEmployee.target_position,
                hired_date: selectedEmployee.hired_date,
                contract_end_date: selectedEmployee.contract_end_date,
                assigned_brigadir_id: selectedEmployee.assigned_brigadir_id,
                role: selectedEmployee.role
            });
            setIsEditModalOpen(true);
        }
    };

    const saveEditEmployee = () => {
        if (selectedEmployee) {
            updateUser(selectedEmployee.id, editFormData);
            
            if (editFormData.assigned_brigadir_id !== selectedEmployee.assigned_brigadir_id && editFormData.assigned_brigadir_id) {
                assignBrigadir(selectedEmployee.id, editFormData.assigned_brigadir_id);
            }

            setSelectedEmployee({ ...selectedEmployee, ...editFormData } as User);
            setIsEditModalOpen(false);
        }
    };

    const handleFireEmployee = (user: User) => {
        setFireConfig({ initiator: '', reason: '' });
        setConfirmModal({ isOpen: true, type: 'fire', user });
    };

    const handleRestoreEmployee = (user: User) => {
        setConfirmModal({ isOpen: true, type: 'restore', user });
    };

    const handlePayReferral = (referralUser: User) => {
        setConfirmModal({ isOpen: true, type: 'pay_referral', user: referralUser });
    };

    const executeConfirmation = () => {
        const { type, user } = confirmModal;
        if (!user || !type) return;

        if (type === 'fire') {
            const initiatorLabel = fireConfig.initiator === 'company' ? 'Pracodawca' : 'Pracownik';
            updateUser(user.id, { 
                status: UserStatus.INACTIVE,
                termination_date: new Date().toISOString().split('T')[0],
                termination_initiator: fireConfig.initiator as any,
                termination_reason: fireConfig.reason
            });
            logCandidateAction(user.id, `Rozwiązano umowę. Inicjator: ${initiatorLabel}, Powód: ${fireConfig.reason}`);
            triggerNotification('termination', 'Zwolnienie Pracownika', `Rozwiązano umowę z pracownikiem ${user.first_name} ${user.last_name}.`, '/hr/employees');
            setSelectedEmployee(null);
        } else if (type === 'restore') {
            updateUser(user.id, { 
                status: UserStatus.ACTIVE,
                termination_date: undefined,
                termination_initiator: undefined,
                termination_reason: undefined
            });
            logCandidateAction(user.id, 'Przywrócono pracownika z archiwum');
            setSelectedEmployee(null);
        } else if (type === 'pay_referral') {
            payReferralBonus(user.id);
            triggerNotification('status_change', 'Bonus Wypłacony', `Wypłacono bonus za polecenie kandydata: ${user.first_name} ${user.last_name}.`);
        }
        setConfirmModal({ isOpen: false, type: null, user: null });
    };

    const updateContractType = (type: ContractType) => {
        if (selectedEmployee) {
            updateUser(selectedEmployee.id, { contract_type: type });
            logCandidateAction(selectedEmployee.id, `Zmieniono formę zatrudnienia na: ${CONTRACT_TYPE_LABELS[type]}`);
            setSelectedEmployee({ ...selectedEmployee, contract_type: type } as User);
            setIsContractPopoverOpen(false);
        }
    };

    const toggleStudentStatus = (isStudent: boolean) => {
        if (selectedEmployee) {
            updateUser(selectedEmployee.id, { is_student: isStudent });
            logCandidateAction(selectedEmployee.id, `Zmiana statusu studenta: ${isStudent ? 'Tak' : 'Nie'}`);
            setSelectedEmployee({ ...selectedEmployee, is_student: isStudent } as User);
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

    const handleSaveDocument = () => {
        if(!selectedEmployee) return;
        
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

        if (editingDocId) {
            updateCandidateDocumentDetails(editingDocId, docPayload);
        } else {
            addCandidateDocument(selectedEmployee.id, {
                skill_id: 'doc_generic',
                status: SkillStatus.PENDING,
                ...docPayload
            });
        }
        setIsDocModalOpen(false);
    };

    const handleDocStatusChange = (docId: string, newStatus: SkillStatus) => {
        updateUserSkillStatus(docId, newStatus);
        setStatusPopoverDocId(null);
    };

    const openFileViewer = (doc: any) => {
        const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
        setFileViewer({ isOpen: true, urls, title: doc.custom_name || 'Dokument', index: 0 });
    };

    // --- Skills Logic ---
    const handleResetSkill = (skillId: string, mode: 'theory'|'practice'|'both') => {
        if (selectedEmployee) {
            resetSkillProgress(selectedEmployee.id, skillId, mode);
            setResetModal({ isOpen: false, skillId: null });
        }
    };

    const changeSkillStatus = (skillId: string, newStatus: SkillStatus, reason?: string) => {
        if (selectedEmployee) {
            const us = state.userSkills.find(us => us.user_id === selectedEmployee.id && us.skill_id === skillId);
            if (us) {
                updateUserSkillStatus(us.id, newStatus, reason);
            }
        }
        setStatusPopoverSkillId(null);
    };

    const formatContractType = (type?: ContractType) => {
        return type ? CONTRACT_TYPE_LABELS[type] : '-';
    };

    // --- Note Logic ---
    const handleAddNote = () => {
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

    // --- RENDERERS ---

    const renderReferralsTab = () => {
        if (!selectedEmployee) return null;

        const myReferrals = users
            .filter(u => u.referred_by_id === selectedEmployee.id)
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
                                            <span className="text-xs text-slate-400 italic">Zapłacono {new Date(ref.referral_bonus_paid_date!).toLocaleDateString()}</span>
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
                                        Ten pracownik nie zaprosił jeszcze żadnych osób.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
                            <input className="w-full border p-2 rounded" placeholder="Nazwa..." value={newDocData.customName} onChange={e => setNewDocData({...newDocData, customName: e.target.value})} />
                        )}
                        <input type="file" onChange={handleFileSelect} />
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="ghost" onClick={() => setIsDocModalOpen(false)}>Anuluj</Button>
                        <Button onClick={handleSaveDocument}>Zapisz</Button>
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
                        <h2 className="text-xl font-bold">Edytuj Dane Pracownika</h2>
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
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Data Zatrudnienia</label><input type="date" className="w-full border p-2 rounded" value={editFormData.hired_date || ''} onChange={e => setEditFormData({...editFormData, hired_date: e.target.value})} /></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Koniec Umowy</label><input type="date" className="w-full border p-2 rounded" value={editFormData.contract_end_date || ''} onChange={e => setEditFormData({...editFormData, contract_end_date: e.target.value})} /></div>
                        </div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Przypisany Brygadzista</label><select className="w-full border p-2 rounded bg-white" value={editFormData.assigned_brigadir_id || ''} onChange={e => setEditFormData({...editFormData, assigned_brigadir_id: e.target.value})}><option value="">Wybierz...</option>{brigadirsList.map(b => <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>)}</select></div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Anuluj</Button>
                        <Button onClick={saveEditEmployee}>Zapisz Zmiany</Button>
                    </div>
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
                            <Button fullWidth variant="outline" onClick={() => { if(selectedEmployee && resetModal.skillId) { resetSkillProgress(selectedEmployee.id, resetModal.skillId, 'theory'); setResetModal({isOpen: false, skillId: null}); }}}>Tylko Teoria</Button>
                            <Button fullWidth variant="outline" onClick={() => { if(selectedEmployee && resetModal.skillId) { resetSkillProgress(selectedEmployee.id, resetModal.skillId, 'practice'); setResetModal({isOpen: false, skillId: null}); }}}>Tylko Praktyka</Button>
                            <Button fullWidth variant="danger" onClick={() => { if(selectedEmployee && resetModal.skillId) { resetSkillProgress(selectedEmployee.id, resetModal.skillId, 'both'); setResetModal({isOpen: false, skillId: null}); }}}>Zresetuj Całość</Button>
                            <Button fullWidth variant="ghost" onClick={() => setResetModal({ isOpen: false, skillId: null })}>Anuluj</Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderConfirmModal = () => {
        if (!confirmModal.isOpen || !confirmModal.user) return null;
        
        let title = '';
        let content = null;
        let btnText = 'Potwierdź';
        let btnVariant = 'primary';

        if (confirmModal.type === 'fire') {
            title = 'Rozwiązanie Umowy';
            btnText = 'Rozwiąż Umowę';
            btnVariant = 'danger';
            content = (
                <div className="space-y-4 text-left">
                    <p className="text-sm text-slate-500">
                        Czy na pewno chcesz rozwiązać umowę z pracownikiem <strong>{confirmModal.user.first_name} {confirmModal.user.last_name}</strong>?
                    </p>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Inicjator</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" name="initiator" value="company" checked={fireConfig.initiator === 'company'} onChange={() => setFireConfig({...fireConfig, initiator: 'company'})} /> Pracodawca
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" name="initiator" value="employee" checked={fireConfig.initiator === 'employee'} onChange={() => setFireConfig({...fireConfig, initiator: 'employee'})} /> Pracownik
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Powód</label>
                        <select className="w-full border p-2 rounded text-sm bg-white" value={fireConfig.reason} onChange={e => setFireConfig({...fireConfig, reason: e.target.value})}>
                            <option value="">Wybierz powód...</option>
                            {TERMINATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>
            );
        } else if (confirmModal.type === 'restore') {
            title = 'Przywróć Pracownika';
            btnText = 'Przywróć';
            content = <p className="text-sm text-slate-500">Czy na pewno chcesz przywrócić pracownika <strong>{confirmModal.user.first_name} {confirmModal.user.last_name}</strong> z archiwum?</p>;
        } else if (confirmModal.type === 'pay_referral') {
            title = 'Potwierdź Wypłatę Bonusu';
            btnText = 'Potwierdź Wypłatę';
            btnVariant = 'primary';
            content = (
                <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                        <Wallet size={32}/>
                    </div>
                    <p className="text-sm text-slate-500">
                        Czy potwierdzasz wypłatę bonusu dla polecającego za pracownika: <br/>
                        <strong>{confirmModal.user.first_name} {confirmModal.user.last_name}</strong>?
                    </p>
                </div>
            );
        }

        return (
            <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                     <div className="flex flex-col text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto ${btnVariant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'} ${confirmModal.type === 'pay_referral' ? 'hidden' : ''}`}>
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">{title}</h3>
                        {content}
                        <div className="flex gap-3 w-full mt-6">
                            <Button fullWidth variant="ghost" onClick={() => setConfirmModal({isOpen: false, type: null, user: null})}>Anuluj</Button>
                            <Button 
                                fullWidth 
                                variant={btnVariant as any} 
                                onClick={executeConfirmation}
                                disabled={confirmModal.type === 'fire' && (!fireConfig.initiator || !fireConfig.reason)}
                            >
                                {btnText}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderList = () => (
        <>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Pracownicy</h1>
                <div className="flex gap-2">
                     <Button 
                        variant={viewMode === 'active' ? 'secondary' : 'primary'}
                        onClick={() => {
                            setViewMode(prev => prev === 'active' ? 'archived' : 'active');
                        }}
                    >
                        {viewMode === 'active' ? (
                            <><Archive size={18} className="mr-2"/> Archiwum</>
                        ) : (
                            <><RotateCcw size={18} className="mr-2"/> Aktywni</>
                        )}
                    </Button>
                    <Button onClick={() => console.log('Add employee manually')}>
                        <Plus size={18} className="mr-2"/> Dodaj Pracownika
                    </Button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Szukaj pracownika..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select 
                    className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    value={positionFilter}
                    onChange={e => setPositionFilter(e.target.value)}
                >
                    <option value="all">Wszystkie Stanowiska</option>
                    {systemConfig.positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Pracownik</th>
                            <th className="px-6 py-4">Stanowisko</th>
                            <th className="px-6 py-4">Kontakt</th>
                            <th className="px-6 py-4">Stawka Total</th>
                            <th className="px-6 py-4 text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredEmployees.map(employee => {
                            const salaryInfo = calculateSalary(
                                employee.base_rate || systemConfig.baseRate, 
                                state.skills, 
                                state.userSkills.filter(us => us.user_id === employee.id), 
                                state.monthlyBonuses[employee.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 }
                            );
                            const contractBonus = systemConfig.contractBonuses[employee.contract_type || ContractType.UOP] || 0;
                            
                            return (
                                <tr key={employee.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleOpenDetail(employee)}>
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                                                {employee.first_name[0]}{employee.last_name[0]}
                                            </div>
                                            <div>{employee.first_name} {employee.last_name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{employee.target_position || employee.role}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-900">{employee.email}</div>
                                        <div className="text-slate-500 text-xs">{employee.phone}</div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-900">
                                        {(salaryInfo.total + contractBonus).toFixed(2)} zł
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button size="sm" variant="ghost"><ChevronRight size={18}/></Button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredEmployees.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Brak pracowników spełniających kryteria.</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );

    const handleOpenDetail = (employee: User) => {
        setSelectedEmployee(employee);
        setActiveTab('info');
    };

    const renderDetail = () => {
        if (!selectedEmployee) return null;

        const salaryData = calculateSalary(
            selectedEmployee.base_rate || systemConfig.baseRate, 
            state.skills, 
            state.userSkills.filter(us => us.user_id === selectedEmployee.id), 
            state.monthlyBonuses[selectedEmployee.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 }
        );

        const contractBonus = systemConfig.contractBonuses[selectedEmployee.contract_type || ContractType.UOP] || 0;
        const studentBonus = (selectedEmployee.contract_type === ContractType.UZ && selectedEmployee.is_student) ? 3 : 0;
        const totalRateWithContract = salaryData.total + contractBonus + studentBonus;

        const history = state.candidateHistory.filter(h => h.candidate_id === selectedEmployee.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const relevantUserSkills = state.userSkills.filter(us => us.user_id === selectedEmployee.id && us.skill_id && !us.skill_id.startsWith('doc_'));
        
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

        const docs = state.userSkills.filter(us => us.user_id === selectedEmployee.id && (state.skills.find(s => s.id === us.skill_id)?.verification_type === VerificationType.DOCUMENT || us.skill_id.startsWith('doc_')));
        const brigadirName = state.users.find(u => u.id === selectedEmployee.assigned_brigadir_id);
        const employeeNotes = state.employeeNotes.filter(n => n.employee_id === selectedEmployee.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const employeeBadges = state.employeeBadges.filter(b => b.employee_id === selectedEmployee.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return (
            <div onClick={() => { setStatusPopoverSkillId(null); setIsContractPopoverOpen(false); setStatusPopoverDocId(null); }}>
                <Button variant="ghost" onClick={() => setSelectedEmployee(null)} className="mb-4">
                    <ArrowRight className="transform rotate-180 mr-2" size={18} /> Wróć do listy
                </Button>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">
                                {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{selectedEmployee.first_name} {selectedEmployee.last_name}</h1>
                                <div className="text-sm text-slate-500 flex gap-4 mt-1">
                                    <span>{selectedEmployee.email}</span>
                                    <span>{selectedEmployee.phone}</span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 mt-2">
                                    Stanowisko: <span className="font-normal text-slate-600">{selectedEmployee.target_position || selectedEmployee.role}</span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 mt-1">
                                    Forma Zatrudnienia: <span className="font-normal text-slate-600">
                                        {formatContractType(selectedEmployee.contract_type)}
                                    </span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 mt-1">
                                    Brygadzista: <span className="font-normal text-slate-600">
                                        {brigadirName ? `${brigadirName.first_name} ${brigadirName.last_name}` : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${selectedEmployee.status === UserStatus.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {USER_STATUS_LABELS[selectedEmployee.status]}
                                </span>
                                <Button size="sm" variant="outline" onClick={handleEditEmployee}>
                                    <Edit size={16} className="mr-2"/> Edytuj
                                </Button>
                            </div>
                            <div className="flex gap-2 mt-2">
                                {selectedEmployee.status === UserStatus.INACTIVE ? (
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleRestoreEmployee(selectedEmployee)}>
                                        <RotateCcw size={16} className="mr-2"/> Przywróć
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="danger" onClick={() => handleFireEmployee(selectedEmployee)}>
                                        <UserMinus size={16} className="mr-2"/> Zwolnij
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="flex border-b border-slate-200 px-6 overflow-x-auto">
                        {[
                            { id: 'info', label: 'Info' },
                            { id: 'rate', label: 'Stawka' },
                            { id: 'skills', label: 'Umiejętności' },
                            { id: 'docs', label: 'Uprawnienia' },
                            { id: 'referrals', label: 'Polecenia' },
                            { id: 'badges', label: 'Odznaki' },
                            { id: 'notes', label: 'Notatki' },
                            { id: 'history', label: 'Historia' }
                        ].map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {activeTab === 'info' && (
                             <div>
                                <h3 className="font-bold text-slate-900 mb-4">Notatki HR (Poufne)</h3>
                                <textarea 
                                    className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50" 
                                    rows={6} 
                                    value={selectedEmployee.notes || ''}
                                    onChange={(e) => updateUser(selectedEmployee.id, { notes: e.target.value })}
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
                                                {formatContractType(selectedEmployee.contract_type)}
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
                                                {selectedEmployee.contract_type === ContractType.UZ && (
                                                    <div className="px-4 py-2 flex items-center gap-2 bg-blue-50">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedEmployee.is_student}
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

                        {activeTab === 'badges' && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-700 mb-3">Odznaki i Wyróżnienia</h3>
                                {state.employeeBadges.filter(b => b.employee_id === selectedEmployee.id).length === 0 ? (
                                    <p className="text-slate-400 text-sm italic">Brak przyznanych odznak.</p>
                                ) : (
                                    state.employeeBadges
                                        .filter(b => b.employee_id === selectedEmployee.id)
                                        .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                        .map(badge => {
                                            const author = state.users.find(u => u.id === badge.author_id);
                                            return (
                                                <div key={badge.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-4">
                                                    <div className="bg-yellow-100 text-yellow-600 p-2 rounded-full h-fit">
                                                        <Award size={24}/>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between items-start w-full">
                                                            <h4 className="font-bold text-slate-900">{badge.type}</h4>
                                                            <span className="text-xs text-slate-500">{badge.month}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-700 mt-1 italic">"{badge.description}"</p>
                                                        <div className="text-xs text-slate-400 mt-2">
                                                            Przyznał: {author ? `${author.first_name} ${author.last_name}` : 'Nieznany'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div className="space-y-6">
                                {/* Add Note Form */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><MessageSquare size={18}/> Dodaj Notatkę</h4>
                                    <div className="space-y-3">
                                        <select 
                                            className="w-full border p-2 rounded bg-white text-sm"
                                            value={noteCategory}
                                            onChange={e => setNoteCategory(e.target.value as NoteCategory)}
                                        >
                                            {Object.values(NoteCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <textarea 
                                            className="w-full border p-2 rounded bg-white text-sm h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                            placeholder="Wpisz treść notatki..."
                                            value={noteText}
                                            onChange={e => setNoteText(e.target.value)}
                                        />
                                        <div className="flex justify-end">
                                            <Button onClick={handleAddNote} disabled={!noteText}>Dodaj Notatkę</Button>
                                        </div>
                                    </div>
                                </div>

                                {/* List Notes */}
                                <div className="space-y-3">
                                    {employeeNotes.length === 0 && <p className="text-slate-400 italic text-center">Brak notatek dla tego pracownika.</p>}
                                    {employeeNotes.map(note => {
                                        const author = state.users.find(u => u.id === note.author_id);
                                        return (
                                            <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group hover:border-blue-300 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                                                            {author ? `${author.first_name[0]}${author.last_name[0]}` : '?'}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">{author ? `${author.first_name} ${author.last_name}` : 'Nieznany'}</div>
                                                            <div className="text-xs text-slate-500">{new Date(note.created_at).toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{note.category}</span>
                                                </div>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.text}</p>
                                                <button 
                                                    className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                    onClick={() => deleteEmployeeNote(note.id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                         {activeTab === 'history' && (
                            <div className="space-y-4">
                                {history.map(h => (
                                    <div key={h.id} className="flex gap-4 p-3 border-b border-slate-100 last:border-0">
                                        <div className="text-slate-400 text-xs w-24 flex-shrink-0">
                                            <div>{new Date(h.date).toLocaleDateString()}</div>
                                            <div>{new Date(h.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
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
            {selectedEmployee ? renderDetail() : renderList()}
            {renderDocumentModal()}
            <DocumentViewerModal 
                isOpen={fileViewer.isOpen}
                onClose={() => setFileViewer({ ...fileViewer, isOpen: false })}
                urls={fileViewer.urls}
                initialIndex={fileViewer.index}
                title={fileViewer.title}
            />
            {renderEditModal()}
            {renderResetModal()}
            {renderConfirmModal()}
        </div>
    );
};
