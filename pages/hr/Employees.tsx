import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, AlertTriangle, Archive, RotateCcw, UserMinus, Edit, X, Plus, Upload, ChevronRight, ChevronDown, CheckCircle, Clock, Trash2, Camera, Eye, ChevronLeft, MessageSquare, StickyNote, Award, UserPlus, Wallet, Lock, Shield, XCircle, MapPin, Mail, Phone, Calendar, Save, User as UserIcon } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { User, Role, UserStatus, ContractType, SkillStatus, VerificationType, NoteCategory, EmployeeNote, UserSkill } from '../../types';
import { calculateSalary } from '../../services/salaryService';
import { USER_STATUS_LABELS, SKILL_STATUS_LABELS, CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES, TERMINATION_REASONS, REFERRAL_BONUSES, REFERRAL_STATUS_LABELS } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';

export const HREmployeesPage = () => {
    const { state, updateUser, logCandidateAction, addCandidateDocument, updateCandidateDocumentDetails, archiveCandidateDocument, restoreCandidateDocument, updateUserSkillStatus, resetSkillProgress, assignBrigadir, triggerNotification, addEmployeeNote, deleteEmployeeNote, payReferralBonus } = useAppContext();
    const { systemConfig, currentUser, users, skills, userSkills, monthlyBonuses, qualityIncidents, employeeNotes, employeeBadges } = state;
    const navigate = useNavigate();

    const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [positionFilter, setPositionFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<'info'|'personal'|'rate'|'skills'|'docs'|'history'|'notes'|'badges'|'referrals'>('info');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<User>>({});

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'fire' | 'restore' | 'pay_referral' | null;
        user: User | null;
    }>({ isOpen: false, type: null, user: null });

    const [fireConfig, setFireConfig] = useState<{
        initiator: 'company' | 'employee' | '';
        reason: string;
    }>({ initiator: '', reason: '' });

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
    const [resetModal, setResetModal] = useState<{isOpen: boolean, skillId: string | null}>({isOpen: false, skillId: null});
    const [isContractPopoverOpen, setIsContractPopoverOpen] = useState(false);
    const [statusPopoverSkillId, setStatusPopoverSkillId] = useState<string | null>(null);
    const [statusPopoverDocId, setStatusPopoverDocId] = useState<string | null>(null);

    const [noteText, setNoteText] = useState('');
    const [noteCategory, setNoteCategory] = useState<NoteCategory>(NoteCategory.GENERAL);

    // State for Personal Data form
    const [localPersonalData, setLocalPersonalData] = useState<Partial<User>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);

    const allEmployees = state.users.filter(u => u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR);
    const brigadirsList = state.users.filter(u => u.role === Role.BRIGADIR || u.target_position === 'Brygadzista');

    const filteredEmployees = allEmployees.filter(e => {
        if (viewMode === 'active') {
            if (e.status !== UserStatus.ACTIVE) return false;
        } else {
            if (e.status !== UserStatus.INACTIVE) return false;
        }
        const matchesSearch = e.first_name.toLowerCase().includes(search.toLowerCase()) || 
                              e.last_name.toLowerCase().includes(search.toLowerCase());
        const matchesPosition = positionFilter === 'all' || e.target_position === positionFilter;
        return matchesSearch && matchesPosition;
    });

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
        if(!selectedEmployee) return;
        
        const employeeId = selectedEmployee.id;

        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' || editingDocId ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;

        if (!docName) return alert("Podaj nazwę dokumentu.");

        const uploadedUrls: string[] = [];
        if (newDocData.files.length > 0) {
             for (const file of newDocData.files) {
                 const url = await uploadDocument(file, employeeId);
                 if (url) uploadedUrls.push(url);
             }
        }

        const docPayload: any = {
            custom_name: docName,
            custom_type: newDocData.typeId || 'doc_generic',
            issue_date: newDocData.issue_date || null,
            expires_at: newDocData.indefinite ? null : (newDocData.expires_at || null),
            is_indefinite: newDocData.indefinite,
            document_url: uploadedUrls[0] || null,
            document_urls: uploadedUrls.length > 0 ? uploadedUrls : null
        };

        if (!editingDocId) docPayload.bonus_value = bonus;

        try {
            if (editingDocId) {
                await updateCandidateDocumentDetails(editingDocId, docPayload);
            } else {
                await addCandidateDocument(employeeId, {
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

    const handleDocStatusChange = (docId: string, newStatus: SkillStatus) => {
        updateUserSkillStatus(docId, newStatus);
        setStatusPopoverDocId(null);
    };

    const openFileViewer = (doc: any) => {
        const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
        setFileViewer({ isOpen: true, urls, title: doc.custom_name || 'Dokument', index: 0 });
    };

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

    const updateContractType = async (type: ContractType) => {
        if (selectedEmployee) {
            await updateUser(selectedEmployee.id, { contract_type: type });
            await logCandidateAction(selectedEmployee.id, `Zmieniono formę zatrudnienia na: ${CONTRACT_TYPE_LABELS[type]}`);
            setSelectedEmployee({ ...selectedEmployee, contract_type: type } as User);
            setIsContractPopoverOpen(false);
        }
    };

    const toggleStudentStatus = async (isStudent: boolean) => {
        if (selectedEmployee) {
            await updateUser(selectedEmployee.id, { is_student: isStudent });
            await logCandidateAction(selectedEmployee.id, `Zmiana statusu studenta: ${isStudent ? 'Tak' : 'Nie'}`);
            setSelectedEmployee({ ...selectedEmployee, is_student: isStudent } as User);
        }
    };

    const formatContractType = (type?: ContractType) => {
        return type ? CONTRACT_TYPE_LABELS[type] : '-';
    };

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

    const handleSavePersonalData = async () => {
        if (selectedEmployee) {
            await updateUser(selectedEmployee.id, localPersonalData);
            setSelectedEmployee({ ...selectedEmployee, ...localPersonalData } as User);
            alert("Dane osobowe zostały zapisane.");
        }
    };

    const handleOpenDetail = (employee: User) => {
        setSelectedEmployee(employee);
        setLocalPersonalData({
            pesel: employee.pesel || '',
            birth_date: employee.birth_date || '',
            citizenship: employee.citizenship || '',
            document_type: employee.document_type || 'Dowód osobisty',
            document_number: employee.document_number || '',
            zip_code: employee.zip_code || '',
            city: employee.city || '',
            street: employee.street || '',
            house_number: employee.house_number || '',
            apartment_number: employee.apartment_number || '',
            bank_account: employee.bank_account || '',
            nip: employee.nip || ''
        });
        setActiveTab('info');
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

    const renderDetail = () => {
        if (!selectedEmployee) return null;
        const salaryInfo = calculateSalary(
            selectedEmployee.base_rate || systemConfig.baseRate, 
            state.skills, 
            state.userSkills.filter(us => us.user_id === selectedEmployee.id), 
            state.monthlyBonuses[selectedEmployee.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
            new Date(),
            qualityIncidents
        );

        const confirmedUserSkills = state.userSkills.filter(us => us.user_id === selectedEmployee.id && us.status === SkillStatus.CONFIRMED && !us.is_archived);
        
        const matrycaBonus = confirmedUserSkills.reduce((acc, us) => {
            const skill = state.skills.find(s => s.id === us.skill_id);
            if (skill && skill.verification_type !== VerificationType.DOCUMENT && !us.custom_type) {
                return acc + skill.hourly_bonus;
            }
            return acc;
        }, 0);

        const uprawnieniaBonus = confirmedUserSkills.reduce((acc, us) => {
            const skill = state.skills.find(s => s.id === us.skill_id);
            const isDoc = (skill?.verification_type === VerificationType.DOCUMENT) || (us.skill_id && typeof us.skill_id === 'string' && (us.skill_id.startsWith('doc_') || !!us.custom_type)) || !us.skill_id;
            if (isDoc) {
                return acc + (skill ? skill.hourly_bonus : (us.bonus_value || 0));
            }
            return acc;
        }, 0);

        const contractBonus = systemConfig.contractBonuses[selectedEmployee.contract_type || ContractType.UOP] || 0;
        const studentBonus = (selectedEmployee.contract_type === ContractType.UZ && selectedEmployee.is_student) ? 3 : 0;
        const totalRate = salaryInfo.total + contractBonus + studentBonus;

        const employeeDocuments = state.userSkills.filter(us => {
            if (us.user_id !== selectedEmployee.id) return false;
            const linkedSkill = skills.find(s => s.id === us.skill_id);
            const isSystemDoc = linkedSkill?.verification_type === VerificationType.DOCUMENT;
            const isGenericDoc = !!us.custom_type || !us.skill_id || (typeof us.skill_id === 'string' && us.skill_id.startsWith('doc_'));
            return isSystemDoc || isGenericDoc;
        });

        const relevantUserSkills = state.userSkills.filter(us => us.user_id === selectedEmployee.id && us.skill_id && !us.skill_id.startsWith('doc_') && !us.custom_type);
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
        const brigadirName = state.users.find(u => u.id === selectedEmployee.assigned_brigadir_id);

        return (
            <div onClick={() => { setStatusPopoverSkillId(null); setIsContractPopoverOpen(false); setStatusPopoverDocId(null); }}>
                <Button variant="ghost" onClick={() => setSelectedEmployee(null)} className="mb-4"><ArrowRight className="transform rotate-180 mr-2" size={18} /> Wróć do listy</Button>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">{selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}</div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{selectedEmployee.first_name} {selectedEmployee.last_name}</h1>
                                <div className="text-sm text-slate-500 flex gap-4 mt-1"><span>{selectedEmployee.email}</span><span>{selectedEmployee.phone}</span></div>
                                <div className="text-sm font-bold text-slate-700 mt-2">Stanowisko: <span className="font-normal text-slate-600">{selectedEmployee.target_position || '-'}</span></div>
                                <div className="text-sm font-bold text-slate-700 mt-1">Brygadzista: <span className="font-normal text-slate-600">{brigadirName ? `${brigadirName.first_name} ${brigadirName.last_name}` : '-'}</span></div>
                                <div className="text-sm font-bold text-slate-700 mt-1">Okres umowy: <span className="font-normal text-slate-600">{selectedEmployee.hired_date?.split('T')[0] || '-'} — {selectedEmployee.contract_end_date?.split('T')[0] || 'nieokreślony'}</span></div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2"><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${selectedEmployee.status === UserStatus.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{USER_STATUS_LABELS[selectedEmployee.status]}</span><Button size="sm" variant="outline" onClick={handleEditEmployee}><Edit size={16} className="mr-2"/> Edytuj</Button></div>
                            {selectedEmployee.status === UserStatus.ACTIVE ? (<Button size="sm" variant="danger" onClick={() => handleFireEmployee(selectedEmployee)}><UserMinus size={16} className="mr-2"/> Rozwiąż Umowę</Button>) : (<Button size="sm" variant="secondary" onClick={() => handleRestoreEmployee(selectedEmployee)}><RotateCcw size={16} className="mr-2"/> Przywróć</Button>)}
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
                                { id: 'notes', label: 'Notatki' }, 
                                { id: 'badges', label: 'Odznaki' }, 
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
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">NOTATKI REKRUTACYJNE</h3>
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner">
                                    <textarea 
                                        className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder:text-slate-400 font-medium min-h-[200px] resize-none outline-none text-base" 
                                        placeholder="Wpisz notatki..."
                                        value={selectedEmployee.notes || ''} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            updateUser(selectedEmployee.id, { notes: val });
                                            setSelectedEmployee({ ...selectedEmployee, notes: val });
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
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-6">Stawka Pracownika</h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
                                    <div className="bg-white p-4 rounded-lg shadow-sm"><div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Baza</div><div className="text-2xl font-black text-slate-900">{salaryInfo.breakdown.base} zł</div></div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100"><div className="text-[10px] text-green-600 uppercase font-black tracking-widest mb-1">Umiejętności</div><div className="text-2xl font-black text-green-600">+{matrycaBonus.toFixed(2)} zł</div></div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-100"><div className="text-[10px] text-purple-600 uppercase font-black tracking-widest mb-1">Uprawnienia</div><div className="text-2xl font-black text-purple-600">+{uprawnieniaBonus.toFixed(2)} zł</div></div>
                                    <div className="relative z-[200]"><div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 cursor-pointer hover:bg-blue-50 transition-colors h-full flex flex-col justify-center" onClick={(e) => { e.stopPropagation(); setIsContractPopoverOpen(!isContractPopoverOpen); }}><div className="text-[10px] text-blue-600 uppercase font-black tracking-widest mb-1">Forma Zatrudnienia</div><div className="text-lg font-black text-blue-600 flex items-center justify-center gap-1">{formatContractType(selectedEmployee.contract_type)}<ChevronDown size={14} /></div><div className="text-[10px] text-blue-400 font-bold mt-1">{contractBonus + studentBonus > 0 ? `+${(contractBonus + studentBonus).toFixed(2)} zł/h` : 'Bez dodatku'}</div></div>{isContractPopoverOpen && (<div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-lg z-[300] flex flex-col py-1 animate-in zoom-in-95 duration-150">{(Object.values(ContractType) as ContractType[]).map((type) => (<button key={type} className="px-4 py-2 text-sm text-left hover:bg-slate-50 text-slate-700 font-medium" onClick={() => updateContractType(type)}>{CONTRACT_TYPE_LABELS[type]}</button>))}<div className="border-t border-slate-100 my-1"></div><div className="px-4 py-2 flex items-center justify-between"><span className="text-[10px] font-black text-slate-500 uppercase">Student &lt; 26 lat</span><input type="checkbox" checked={selectedEmployee.is_student} onChange={(e) => toggleStudentStatus(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" /></div></div>)}</div>
                                    <div className="bg-slate-900 p-4 rounded-lg shadow-sm text-white flex flex-col justify-center"><div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Stawka Total</div><div className="text-2xl font-black leading-tight">{totalRate.toFixed(2)} zł<span className="text-xs font-medium ml-1">/h netto</span></div></div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'skills' && (<table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Umiejętność</th><th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Stawka</th><th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Teoria</th><th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Praktyka</th><th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Status</th><th className="px-4 py-3 text-right"></th></tr></thead><tbody className="divide-y divide-slate-100">{skillList.map((skill: any) => (<tr key={skill.id}><td className="px-4 py-3 font-medium">{skill.skillName}</td><td className="px-4 py-3 font-bold text-green-600">+{skill.hourlyBonus} zł</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[11px] font-bold ${skill.theoryStatus === 'Zaliczona' ? 'bg-green-100 text-green-700' : skill.theoryStatus === 'Niezaliczona' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{skill.theoryStatus}</span></td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[11px] font-bold ${skill.practiceStatus === 'Zaliczona' ? 'bg-green-100 text-green-700' : skill.practiceStatus === 'Oczekuje' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{skill.practiceStatus}</span></td><td className="px-4 py-3 relative" onClick={(e) => { e.stopPropagation(); setStatusPopoverSkillId(skill.skillId); }}><span className={`px-2 py-1 rounded text-[10px] uppercase font-black tracking-tighter cursor-pointer hover:opacity-80 border ${skill.statusColor}`}>{skill.statusText}</span>{statusPopoverSkillId === skill.skillId && (<div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 shadow-xl rounded-lg z-[210] flex flex-col py-1"><button className="text-left px-3 py-2 text-xs hover:bg-yellow-50 text-yellow-700" onClick={() => changeSkillStatus(skill.skillId, SkillStatus.PRACTICE_PENDING)}>{SKILL_STATUS_LABELS[SkillStatus.PRACTICE_PENDING]}</button><button className="text-left px-3 py-2 text-xs hover:bg-green-50 text-green-700" onClick={() => changeSkillStatus(skill.skillId, SkillStatus.CONFIRMED)}>{SKILL_STATUS_LABELS[SkillStatus.CONFIRMED]}</button></div>)}</td><td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setResetModal({ isOpen: true, skillId: skill.skillId })}>Reset</Button></td></tr>))}{skillList.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">Brak rozpoczętych umiejętności.</td></tr>}</tbody></table>)}
                        {activeTab === 'docs' && (<div onClick={() => setStatusPopoverDocId(null)}><div className="flex justify-between items-center mb-6"><div className="relative w-64"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Szukaj dokumentu..." className="w-full pl-9 pr-2 py-1.5 border rounded text-xs bg-slate-50" value={docSearch} onChange={(e) => setDocSearch(e.target.value)} /></div><div className="flex gap-2"><Button size="sm" variant="secondary" className="bg-white text-slate-700 border-slate-300 font-bold" onClick={() => setDocsViewMode(prev => prev === 'active' ? 'archived' : 'active')}><Archive size={16} className="mr-2"/> Archiwum</Button><Button size="sm" className="bg-blue-600 font-bold" onClick={handleAddDocument}><Upload size={16} className="mr-2"/> Dodaj Dokument</Button></div></div><table className="w-full text-left text-sm border-separate border-spacing-0"><thead className="bg-slate-50 text-slate-500 font-bold"><tr><th className="px-4 py-3 border-b border-slate-100 text-[10px] uppercase tracking-wider">Dokument</th><th className="px-4 py-3 border-b border-slate-100 text-[10px] uppercase tracking-wider">Status</th><th className="px-4 py-3 border-b border-slate-100 text-[10px] uppercase tracking-wider">Stawka</th><th className="px-4 py-3 border-b border-slate-100 text-[10px] uppercase tracking-wider">Ważność</th><th className="px-4 py-3 border-b border-slate-100 text-right"></th></tr></thead><tbody className="divide-y divide-slate-100">{employeeDocuments.filter(d => docsViewMode === 'active' ? !d.is_archived : d.is_archived).map(d => { const bonus = d.bonus_value || state.skills.find(s => s.id === d.skill_id)?.hourly_bonus || 0; return (<tr key={d.id} className="hover:bg-slate-50 cursor-pointer transition-colors group"><td className="px-4 py-4 font-bold text-slate-700" onClick={() => handleEditDocument(d.id)}>{d.custom_name || 'Dokument'}</td><td className="px-4 py-4 relative" onClick={(e) => { e.stopPropagation(); setStatusPopoverDocId(d.id); }}><span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-tighter cursor-pointer hover:scale-105 transition-transform ${d.status === SkillStatus.CONFIRMED ? 'bg-green-100 text-green-700 border-green-200' : d.status === SkillStatus.FAILED ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'} border`}>{SKILL_STATUS_LABELS[d.status] || d.status}</span>{statusPopoverDocId === d.id && (<div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-lg z-[210] flex flex-col py-1"><button className="text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700" onClick={() => handleDocStatusChange(d.id, SkillStatus.PENDING)}>{SKILL_STATUS_LABELS[SkillStatus.PENDING]}</button><button className="text-left px-3 py-2 text-xs hover:bg-green-50 text-green-700 font-medium" onClick={() => handleDocStatusChange(d.id, SkillStatus.CONFIRMED)}>{SKILL_STATUS_LABELS[SkillStatus.CONFIRMED]}</button><button className="text-left px-3 py-2 text-xs hover:bg-red-50 text-red-700 font-medium" onClick={() => handleDocStatusChange(d.id, SkillStatus.FAILED)}>{SKILL_STATUS_LABELS[SkillStatus.FAILED]}</button></div>)}</td><td className={`px-4 py-4 font-bold ${d.status === SkillStatus.CONFIRMED ? 'text-green-600' : 'text-slate-400'}`}>{bonus > 0 ? `+${bonus.toFixed(2)} zł` : '-'}</td><td className="px-4 py-4 text-slate-600 text-xs">{d.issue_date && <span>{d.issue_date} – </span>}{d.is_indefinite ? 'Bezterminowy' : (d.expires_at || '-')}</td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); openFileViewer(d); }} className="p-1.5 border border-blue-400 rounded-md text-blue-500 hover:bg-blue-50 transition-colors shadow-sm" title="Podgląd"><Eye size={18} /></button></div></td></tr>); })}{employeeDocuments.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-medium italic">Brak dokumentów do wyświetlenia.</td></tr>}</tbody></table></div>)}
                        {activeTab === 'notes' && (<div className="space-y-6"><div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm"><MessageSquare size={16}/> Dodaj Notatkę</h4><div className="space-y-3"><select className="w-full border p-2 rounded bg-white text-xs" value={noteCategory} onChange={e => setNoteCategory(e.target.value as NoteCategory)}>{Object.values(NoteCategory).map(c => <option key={c} value={c}>{c}</option>)}</select><textarea className="w-full border p-2 rounded bg-white text-sm h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Wpisz treść notatki..." value={noteText} onChange={e => setNoteText(e.target.value)}/><div className="flex justify-end"><Button size="sm" onClick={handleAddNote} disabled={!noteText}>Zapisz Notatkę</Button></div></div></div><div className="space-y-4">{employeeNotes.filter(n => n.employee_id === selectedEmployee.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(note => { const author = users.find(u => u.id === note.author_id); return (<div key={note.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group"><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-[10px]">{author ? author.first_name[0] : '?'}</div><div><div className="text-xs font-bold text-slate-800">{author ? `${author.first_name} ${author.last_name}` : 'Nieznany'}</div><div className="text-[10px] text-slate-500">{new Date(note.created_at).toLocaleString()}</div></div></div><span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 uppercase tracking-tighter">{note.category}</span></div><p className="text-sm text-slate-700 whitespace-pre-wrap">{note.text}</p>{note.author_id === currentUser?.id && (<button className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" onClick={() => deleteEmployeeNote(note.id)}><Trash2 size={16} /></button>)}</div>); })}</div></div>)}
                        {activeTab === 'badges' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{employeeBadges.filter(b => b.employee_id === selectedEmployee.id).map(badge => (<div key={badge.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><div className="bg-yellow-100 text-yellow-600 p-1.5 rounded-full"><Award size={16} /></div><div><div className="text-sm font-bold text-slate-800">{badge.type}</div><div className="text-xs text-slate-500">{badge.month}</div></div></div></div><p className="text-sm text-slate-700 mt-2 italic font-medium">"{badge.description}"</p></div>))}{employeeBadges.filter(b => b.employee_id === selectedEmployee.id).length === 0 && <p className="col-span-2 text-slate-400 italic text-center text-sm py-8">Brak odznak.</p>}</div>)}
                        {activeTab === 'referrals' && (
                             <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                                        <tr><th className="px-6 py-3">Znajomy</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Bonus</th><th className="px-6 py-3 text-right"></th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.filter(u => u.referred_by_id === selectedEmployee.id).map((ref) => (
                                            <tr key={ref.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-900">{ref.first_name} {ref.last_name}</td>
                                                <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border bg-blue-50 text-blue-700 border-blue-200`}>{ref.status}</span></td>
                                                <td className="px-6 py-4 font-bold text-slate-900">
                                                    {REFERRAL_BONUSES[ref.target_position || 'Pomocnik'] || 200} zł
                                                </td>
                                                <td className="px-6 py-4 text-right"></td>
                                            </tr>
                                        ))}
                                        {users.filter(u => u.referred_by_id === selectedEmployee.id).length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">Brak poleceń.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {activeTab === 'history' && (<div className="space-y-4">{state.candidateHistory.filter(h => h.candidate_id === selectedEmployee.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(h => (<div key={h.id} className="flex gap-4 p-3 border-b border-slate-100 last:border-0"><div className="text-slate-400 text-[10px] w-24 flex-shrink-0 font-bold"><div>{new Date(h.created_at).toLocaleDateString()}</div><div>{new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div><div><div className="text-sm font-medium text-slate-900">{h.action}</div><div className="text-[10px] text-slate-500 uppercase font-bold">Użytkownik: {h.performed_by}</div></div></div>))}{state.candidateHistory.filter(h => h.candidate_id === selectedEmployee.id).length === 0 && <p className="text-slate-400 text-sm">Brak historii działań.</p>}</div>)}
                    </div>
                </div>
            </div>
        );
    };

    const renderList = () => (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Zarządzanie Pracownikami</h1>
                    <p className="text-slate-500">Baza aktywnych i byłych pracowników.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg flex p-1 shadow-sm">
                    <button 
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'active' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setViewMode('active')}
                    >
                        Aktywni
                    </button>
                    <button 
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'archived' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setViewMode('archived')}
                    >
                        Zwolnieni
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Szukaj pracownika (imię, nazwisko)..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={search} onChange={e => setSearch(e.target.value)}/></div>
                <div className="relative min-w-[200px] w-full md:w-auto"><select className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-10 rounded-lg text-sm font-medium cursor-pointer" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}><option value="all">Wszystkie stanowiska</option>{systemConfig.positions.map(pos => (<option key={pos} value={pos}>{pos}</option>))}</select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/></div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Pracownik</th>
                            <th className="px-6 py-4">Dane Kontaktowe</th>
                            <th className="px-6 py-4">Stanowisko</th>
                            <th className="px-6 py-4">Stawka</th>
                            <th className="px-6 py-4">Okres Umowy</th>
                            <th className="px-6 py-4 text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredEmployees.map(employee => {
                            const employeeSkills = userSkills.filter(us => us.user_id === employee.id);
                            const salaryInfo = calculateSalary(
                                employee.base_rate || systemConfig.baseRate,
                                skills,
                                employeeSkills,
                                monthlyBonuses[employee.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
                                new Date(),
                                qualityIncidents
                            );
                            const contractBonus = systemConfig.contractBonuses[employee.contract_type || ContractType.UOP] || 0;
                            const studentBonus = (employee.contract_type === ContractType.UZ && employee.is_student) ? 3 : 0;
                            const totalRate = salaryInfo.total + contractBonus + studentBonus;

                            return (
                                <tr key={employee.id} className="hover:bg-slate-50 cursor-pointer transition-colors group" onClick={() => handleOpenDetail(employee)}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">{employee.first_name[0]}{employee.last_name[0]}</div>
                                            <div>
                                                <div className="font-bold text-slate-900">{employee.first_name} {employee.last_name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-700 font-medium">{employee.email}</div>
                                        <div className="text-[10px] text-slate-400 font-bold">{employee.phone || 'Brak telefonu'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">{employee.target_position || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-black text-slate-900">{totalRate.toFixed(2)} zł/h</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <div className="text-xs font-bold text-slate-900">{employee.hired_date?.split('T')[0] || '-'}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">do: {employee.contract_end_date?.split('T')[0] || 'nieustalony'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 inline transition-all transform group-hover:translate-x-1"/>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredEmployees.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic font-medium">Brak pracowników spełniających kryteria.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {selectedEmployee ? renderDetail() : renderList()}
            {isDocModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[210] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
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
                                    disabled={!!editingDocId}
                                >
                                    <option value="">Wybierz typ...</option>
                                    {BONUS_DOCUMENT_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                                    <option value="other">Inny...</option>
                                </select>
                            </div>

                            {(newDocData.typeId === 'other' || editingDocId) && (
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
                                {newDocData.files.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {newDocData.files.map((f, i) => (
                                            <div key={i} className="flex justify-between items-center bg-slate-100/50 p-2 rounded-lg text-[10px] font-bold">
                                                <span className="truncate max-w-[200px]">{f.name}</span>
                                                <button onClick={() => removeFile(i)} className="text-red-500"><X size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-700">Data Wydania</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" 
                                        value={newDocData.issue_date} 
                                        onChange={e => setNewDocData({...newDocData, issue_date: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-700">Data Ważności</label>
                                    <input 
                                        type="date" 
                                        className={`w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 ${newDocData.indefinite ? 'opacity-30 cursor-not-allowed' : ''}`} 
                                        value={newDocData.expires_at} 
                                        onChange={e => setNewDocData({...newDocData, expires_at: e.target.value})}
                                        disabled={newDocData.indefinite} 
                                    />
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
            )}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Edytuj Dane Pracownika</h2>
                            <button onClick={() => setIsEditModalOpen(false)}><X size={24} className="text-slate-400"/></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-700 mb-1">Imię</label><input className="w-full border p-2 rounded text-sm font-bold text-slate-800" value={editFormData.first_name || ''} onChange={e => setEditFormData({...editFormData, first_name: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-slate-700 mb-1">Nazwisko</label><input className="w-full border p-2 rounded text-sm font-bold text-slate-800" value={editFormData.last_name || ''} onChange={e => setEditFormData({...editFormData, last_name: e.target.value})} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-700 mb-1">Email</label><input className="w-full border p-2 rounded text-sm font-bold text-slate-800" value={editFormData.email || ''} onChange={e => setEditFormData({...editFormData, email: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-slate-700 mb-1">Telefon</label><input className="w-full border p-2 rounded text-sm font-bold text-slate-800" value={editFormData.phone || ''} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} /></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(false)}>Anuluj</Button>
                            <Button size="sm" onClick={saveEditEmployee}>Zapisz Zmiany</Button>
                        </div>
                    </div>
                </div>
            )}
            {resetModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-90 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4"><RotateCcw size={24} /></div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Resetuj Postęp</h3>
                            <p className="text-sm text-slate-500 mb-6">Wybierz, który element chcesz zresetować. Operacja jest nieodwracalna.</p>
                            <div className="space-y-2 w-full">
                                <Button fullWidth variant="outline" size="sm" onClick={() => { if(selectedEmployee && resetModal.skillId) { resetSkillProgress(selectedEmployee.id, resetModal.skillId, 'theory'); setResetModal({isOpen: false, skillId: null}); }}}>Tylko Teoria</Button>
                                <Button fullWidth variant="outline" size="sm" onClick={() => { if(selectedEmployee && resetModal.skillId) { resetSkillProgress(selectedEmployee.id, resetModal.skillId, 'practice'); setResetModal({isOpen: false, skillId: null}); }}}>Tylko Praktyka</Button>
                                <Button fullWidth variant="danger" size="sm" onClick={() => { if(selectedEmployee && resetModal.skillId) { resetSkillProgress(selectedEmployee.id, resetModal.skillId, 'both'); setResetModal({isOpen: false, skillId: null}); }}}>Zresetuj Całość</Button>
                                <Button fullWidth variant="ghost" size="sm" onClick={() => setResetModal({ isOpen: false, skillId: null })}>Anuluj</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {confirmModal.isOpen && confirmModal.user && (
                <div className="fixed inset-0 bg-black/50 z-120 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                         <div className="flex flex-col text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto ${confirmModal.type === 'fire' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}><AlertTriangle size={32} /></div>
                            <h3 className="text-xl font-bold text-slate-900 mb-4">{confirmModal.type === 'fire' ? 'Rozwiązanie Umowy' : 'Przywróć Pracownika'}</h3>
                            <p className="text-sm text-slate-500 mb-6">Czy potwierdzasz tę operację dla <strong>{confirmModal.user.first_name} {confirmModal.user.last_name}</strong>?</p>
                            <div className="flex gap-3 w-full">
                                <Button fullWidth variant="ghost" size="sm" onClick={() => setConfirmModal({isOpen: false, type: null, user: null})}>Anuluj</Button>
                                <Button fullWidth variant={confirmModal.type === 'fire' ? 'danger' : 'primary'} size="sm" onClick={executeConfirmation}>Potwierdź</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};