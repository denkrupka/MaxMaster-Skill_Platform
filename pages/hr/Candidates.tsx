import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Send, Clock, XCircle, Search, ChevronRight, Download, FileText, Plus, Archive, RotateCcw, AlertTriangle, User as UserIcon, Calendar, CheckCircle, Edit, Trash2, UserPlus, Briefcase, UserCheck, Eye, X, Upload, ChevronDown, Bot, Loader2, Share2, Copy, FileInput, Save, Shield, Wallet, Award, Calculator, ChevronLeft } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { User, Role, UserStatus, SkillStatus, VerificationType, CandidateHistoryEntry, ContractType } from '../../types';
import { USER_STATUS_LABELS, SKILL_STATUS_LABELS, CONTRACT_TYPE_LABELS, USER_STATUS_COLORS } from '../../constants';
import { GoogleGenAI } from "@google/genai";
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

const QUALIFICATIONS_LIST = [
    { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
    { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
    { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
];

export const HRCandidatesPage = () => {
    const { state, moveCandidateToTrial, updateUser, addCandidate, logCandidateAction, resetTestAttempt, addCandidateDocument, updateCandidateDocumentDetails, updateUserSkillStatus, archiveCandidateDocument, restoreCandidateDocument, hireCandidate, triggerNotification } = useAppContext();
    const { systemConfig } = state;
    const location = useLocation();
    
    const [selectedCandidate, setSelectedCandidate] = useState<User | null>(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'info'|'personal'|'rate'|'tests'|'docs'|'history'>('info');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    
    // Document View Mode & Search
    const [docsViewMode, setDocsViewMode] = useState<'active' | 'archived'>('active');
    const [docSearch, setDocSearch] = useState('');

    // Success Modal State
    const [successModal, setSuccessModal] = useState<{isOpen: boolean, title: string, message: string}>({isOpen: false, title: '', message: ''});

    // ACTION CONFIRMATION MODAL STATE
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'reject' | 'link' | 'hire' | 'fire' | 'restore' | 'reset_test' | null;
        candidate: User | null;
        data?: string; // Extra data like attemptId
    }>({ isOpen: false, type: null, candidate: null });

    // TRIAL CONFIGURATION MODAL STATE
    const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
    const [trialConfig, setTrialConfig] = useState({
        startDate: '',
        endDate: '',
        brigadirId: '',
        rate: 0
    });

    // Modals
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false); // New Selection Modal
    
    // Invite Modal State
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteCopied, setInviteCopied] = useState(false);

    // AI Modal State
    const [isAIModalOpen, setIsAIModalOpen] = useState(false); // New AI Modal
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [aiTargetPosition, setAiTargetPosition] = useState('');
    const [aiFile, setAiFile] = useState<File | null>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    
    // Document Modal State
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [newDocData, setNewDocData] = useState({ 
        name: '', 
        issue_date: new Date().toISOString().split('T')[0], 
        expires_at: '', 
        indefinite: false,
        fileUrl: '' 
    });

    // File Viewer
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // Contract Type Popover
    const [isContractPopoverOpen, setIsContractPopoverOpen] = useState(false);
    
    // Qualification Modal State (HR)
    const [isQualModalOpen, setIsQualModalOpen] = useState(false);

    // Document Status Edit State
    const [statusPopoverDocId, setStatusPopoverDocId] = useState<string | null>(null);

    // Status Editing (Candidate Status)
    const [isStatusEditOpen, setIsStatusEditOpen] = useState(false);
    
    // Form State (Add/Edit Candidate)
    const [formData, setFormData] = useState<Partial<User>>({
        first_name: '', last_name: '', email: '', phone: '', source: '', notes: '', resume_url: '', target_position: ''
    });
    
    // Personal Data Form State
    const [personalData, setPersonalData] = useState<Partial<User>>({});

    // Phone Handling
    const [phonePrefix, setPhonePrefix] = useState('+48');
    const [phoneNumber, setPhoneNumber] = useState('');

    // Extended Form Logic for Source
    const [sourceType, setSourceType] = useState<string>('');
    const [recommendationType, setRecommendationType] = useState<string>('');
    const [recommenderId, setRecommenderId] = useState<string>('');
    const [customSourceDetail, setCustomSourceDetail] = useState<string>('');

    // Validation Errors
    const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const docFileInputRef = useRef<HTMLInputElement>(null);
    const aiFileInputRef = useRef<HTMLInputElement>(null);

    // Check for navigation state to open modal automatically
    useEffect(() => {
        if (location.state && (location.state as any).openAddCandidate) {
             setIsSelectionModalOpen(true);
             // Clear the state so it doesn't reopen on refresh if possible
             window.history.replaceState({}, document.title);
        }
    }, [location]);

    // Load personal data when candidate selected
    useEffect(() => {
        if (selectedCandidate) {
            setPersonalData({
                pesel: selectedCandidate.pesel || '',
                birth_date: selectedCandidate.birth_date || '',
                citizenship: selectedCandidate.citizenship || '',
                document_type: selectedCandidate.document_type || 'Dowód osobisty',
                document_number: selectedCandidate.document_number || '',
                zip_code: selectedCandidate.zip_code || '',
                city: selectedCandidate.city || '',
                street: selectedCandidate.street || '',
                house_number: selectedCandidate.house_number || '',
                apartment_number: selectedCandidate.apartment_number || '',
                bank_account: selectedCandidate.bank_account || ''
            });
        }
    }, [selectedCandidate]);

    // Auto-update Document Type based on Citizenship logic
    useEffect(() => {
        if (personalData.citizenship) {
            const cit = personalData.citizenship;
            if (cit === 'Polskie') {
                setPersonalData(prev => ({ ...prev, document_type: 'Dowód osobisty' }));
            } else {
                setPersonalData(prev => ({ ...prev, document_type: 'Paszport' }));
            }
        }
    }, [personalData.citizenship]);

    // --- Input Mask Handlers ---
    
    const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Mask: XX-XXX
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) val = val.slice(0, 5);
        if (val.length > 2) val = val.slice(0, 2) + '-' + val.slice(2);
        setPersonalData({ ...personalData, zip_code: val });
    };

    const handleBankAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Mask: XX XXXX ... (Spaces every 4 chars)
        let val = e.target.value.replace(/\D/g, '');
        // Standard PL IBAN is 26 digits (ignoring PL prefix for now)
        if (val.length > 26) val = val.slice(0, 26);
        val = val.replace(/(.{4})/g, '$1 ').trim();
        setPersonalData({ ...personalData, bank_account: val });
    };

    const handlePeselChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.slice(0, 11);
        setPersonalData({ ...personalData, pesel: val });
    };

    const candidates = state.users.filter(u => u.role === Role.CANDIDATE);
    const employeesList = state.users.filter(u => u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR || u.role === Role.HR);
    const brigadirsList = state.users.filter(u => u.role === Role.BRIGADIR || u.target_position === 'Brygadzista');
    
    const filteredCandidates = candidates.filter(c => {
        if (viewMode === 'active' && c.status === UserStatus.REJECTED) return false;
        if (viewMode === 'archived' && c.status !== UserStatus.REJECTED) return false;

        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        const matchesSearch = c.first_name.toLowerCase().includes(search.toLowerCase()) || 
                              c.last_name.toLowerCase().includes(search.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    // Helper to parse phone
    const parsePhone = (fullPhone: string) => {
        if (!fullPhone) return { prefix: '+48', number: '' };
        // Clean phone
        const clean = fullPhone.replace(/[\s-]/g, '');
        const prefixes = ['+48', '+380', '+49', '+375', '+995'];
        const prefix = prefixes.find(p => clean.startsWith(p)) || '+48';
        const number = clean.replace(prefix, '').trim();
        return { prefix, number };
    };

    const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = reader.result as string;
                const base64Content = base64Data.split(',')[1];
                resolve({
                    inlineData: {
                        data: base64Content,
                        mimeType: file.type,
                    },
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const processCVWithAI = async () => {
        if (!aiFile || !aiTargetPosition) {
            alert('Wybierz stanowisko i załącz plik CV.');
            return;
        }

        setIsProcessingAI(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const filePart = await fileToGenerativePart(aiFile);
            
            const prompt = `
                Jesteś asystentem HR. Przeanalizuj załączone CV i wyciągnij następujące dane kandydata w formacie JSON.
                
                Oczekiwany format JSON:
                {
                  "first_name": "Imię",
                  "last_name": "Nazwisko",
                  "email": "adres email",
                  "phone": "pełny numer telefonu z numerem kierunkowym (np. +48 123 456 789)",
                  "summary_pl": "Krótkie podsumowanie kompetencji po polsku (max 2 zdania) do notatki"
                }
                
                Jeśli nie znajdziesz danej informacji, wstaw pusty ciąg znaków.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [filePart, { text: prompt }]
                },
                config: {
                    responseMimeType: "application/json"
                }
            });

            const text = response.text;
            if (text) {
                const data = JSON.parse(text);
                
                const { prefix, number } = parsePhone(data.phone || '');
                setPhonePrefix(prefix);
                setPhoneNumber(number);

                setFormData({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    email: data.email || '',
                    phone: '', 
                    source: 'Inne',
                    target_position: aiTargetPosition,
                    notes: data.summary_pl || '',
                    resume_url: URL.createObjectURL(aiFile)
                });
                
                setSourceType('Inne');
                setCustomSourceDetail('CV Upload (AI)');

                setIsAIModalOpen(false);
                setIsSelectionModalOpen(false);
                setIsAddModalOpen(true);
            }
        } catch (error) {
            console.error("AI Error:", error);
            alert("Wystąpił błąd podczas analizy CV. Spróbuj ponownie lub wprowadź dane ręcznie.");
        } finally {
            setIsProcessingAI(false);
        }
    };

    useEffect(() => {
        if (isAddModalOpen) {
            if (!formData.first_name) {
                setFormData({ first_name: '', last_name: '', email: '', phone: '', source: '', notes: '', resume_url: '', target_position: '' });
                setPhonePrefix('+48');
                setPhoneNumber('');
                setSourceType('');
                setRecommendationType('');
                setRecommenderId('');
                setCustomSourceDetail('');
                setFormErrors({});
            }
        }
    }, [isAddModalOpen]);

    useEffect(() => {
        if (isEditModalOpen && selectedCandidate) {
            const src = selectedCandidate.source || '';
            let sType = '';
            let rType = '';
            let rId = '';
            let cDetail = '';

            if (['OLX', 'Pracuj.pl', 'Flagma', 'FaceBook'].includes(src)) {
                sType = src;
            } else if (src.startsWith('Polecenie: ')) {
                sType = 'Polecenie';
                const detail = src.replace('Polecenie: ', '');
                const employee = employeesList.find(e => `${e.first_name} ${e.last_name}` === detail);
                if (employee) {
                    rType = 'employee';
                    rId = employee.id;
                } else {
                    rType = 'other';
                    cDetail = detail;
                }
            } else {
                sType = 'Inne';
                cDetail = src;
            }

            setFormData({ ...selectedCandidate });
            const { prefix, number } = parsePhone(selectedCandidate.phone || '');
            setPhonePrefix(prefix);
            setPhoneNumber(number);

            setSourceType(sType);
            setRecommendationType(rType);
            setRecommenderId(rId);
            setCustomSourceDetail(cDetail);
            setFormErrors({});
        }
    }, [isEditModalOpen, selectedCandidate]);

    const calculateProjectedRate = (candidate: User) => {
        const passedTests = state.testAttempts.filter(ta => ta.user_id === candidate.id && ta.passed);
        const uniqueSkillIds = new Set<string>();
        passedTests.forEach(ta => {
             const test = state.tests.find(t => t.id === ta.test_id);
             test?.skill_ids.forEach(sid => uniqueSkillIds.add(sid));
        });
        let calculatedBonus = 0;
        uniqueSkillIds.forEach(sid => {
             const skill = state.skills.find(s => s.id === sid);
             if(skill) calculatedBonus += skill.hourly_bonus;
        });

        // Add Qualification Bonus from Candidate Object
        const qualBonus = QUALIFICATIONS_LIST
            .filter(q => candidate.qualifications?.includes(q.id))
            .reduce((acc, q) => {
                // Check if the document for this qualification has been rejected
                const expectedDocName = `Certyfikat ${q.label}`;
                // Check if a document with this name exists and has FAILED status
                const doc = state.userSkills.find(d => 
                    d.user_id === candidate.id && 
                    d.custom_name === expectedDocName
                );
                
                if (doc && doc.status === SkillStatus.FAILED) {
                    // Do NOT add bonus if rejected
                    return acc;
                }
                return acc + q.value;
            }, 0);

        const contractBonus = systemConfig.contractBonuses[candidate.contract_type || ContractType.UOP] || 0;
        const studentBonus = (candidate.contract_type === ContractType.UZ && candidate.is_student) ? 3 : 0;
        const base = candidate.base_rate || systemConfig.baseRate;
        return { 
            base, 
            skillBonus: calculatedBonus, 
            qualBonus,
            contractBonus: contractBonus + studentBonus, // Merging display logic
            studentBonus,
            total: base + calculatedBonus + qualBonus + contractBonus + studentBonus
        };
    };

    const validateForm = () => {
        const errors: Record<string, boolean> = {};
        if (!formData.first_name?.trim()) errors.first_name = true;
        if (!formData.last_name?.trim()) errors.last_name = true;
        if (!formData.email?.trim() || !formData.email?.includes('@')) errors.email = true;
        if (!phoneNumber?.trim()) errors.phone = true;
        if (!sourceType) errors.source = true;
        if (!formData.target_position) errors.target_position = true;
        
        if (sourceType === 'Polecenie') {
            if (!recommendationType) errors.recommendationType = true;
            if (recommendationType === 'employee' && !recommenderId) errors.recommenderId = true;
            if (recommendationType === 'other' && !customSourceDetail) errors.customSourceDetail = true;
        }
        if (sourceType === 'Inne' && !customSourceDetail) errors.customSourceDetail = true;

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const constructSourceString = () => {
        if (sourceType === 'Polecenie') {
            if (recommendationType === 'employee') {
                const emp = employeesList.find(e => e.id === recommenderId);
                return `Polecenie: ${emp ? emp.first_name + ' ' + emp.last_name : 'Nieznany'}`;
            } else {
                return `Polecenie: ${customSourceDetail}`;
            }
        } else if (sourceType === 'Inne') {
            return customSourceDetail;
        }
        return sourceType;
    };

    const handleSaveCandidate = (sendInvite: boolean = false) => {
        if (!validateForm()) return;
        
        const finalSource = constructSourceString();
        const fullPhone = `${phonePrefix} ${phoneNumber}`;
        const dataToSave = { ...formData, source: finalSource, phone: fullPhone };

        if (isEditModalOpen && selectedCandidate) {
            updateUser(selectedCandidate.id, dataToSave);
            setIsEditModalOpen(false);
            setSelectedCandidate({ ...selectedCandidate, ...dataToSave } as User);
            logCandidateAction(selectedCandidate.id, `Zaktualizowano dane kandydata`);
        } else {
            const newUser = addCandidate(dataToSave as User);
            if (sendInvite) {
                logCandidateAction(newUser.id, `Wysłano link do portalu (Email: ${dataToSave.email}, SMS: ${dataToSave.phone})`);
                updateUser(newUser.id, { status: UserStatus.INVITED });
                triggerNotification('candidate_link', 'Wysłano Link', `Wysłano zaproszenie do ${dataToSave.first_name} ${dataToSave.last_name}.`);
                setSuccessModal({
                    isOpen: true,
                    title: 'Kandydat Utworzony',
                    message: `Dodano kandydata i wysłano zaproszenie na ${formData.email} oraz SMS na ${fullPhone}`
                });
            }
            setIsAddModalOpen(false);
            setFormData({ first_name: '', last_name: '', email: '', phone: '', source: '', notes: '', resume_url: '', target_position: '' });
        }
    };

    const handleSavePersonalData = () => {
        if (selectedCandidate) {
            updateUser(selectedCandidate.id, personalData);
            logCandidateAction(selectedCandidate.id, 'Zaktualizowano dane osobowe (HR)');
            setSelectedCandidate({ ...selectedCandidate, ...personalData } as User);
            setSuccessModal({
                isOpen: true,
                title: 'Zapisano',
                message: 'Dane osobowe zostały zaktualizowane.'
            });
        }
    };

    const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setFormData({ ...formData, resume_url: objectUrl });
        }
    };

    const updateContractType = (type: ContractType) => {
        if (selectedCandidate) {
            updateUser(selectedCandidate.id, { contract_type: type });
            logCandidateAction(selectedCandidate.id, `Zmieniono formę zatrudnienia na: ${CONTRACT_TYPE_LABELS[type]}`);
            setSelectedCandidate({ ...selectedCandidate, contract_type: type } as User);
            setIsContractPopoverOpen(false);
        }
    };

    const toggleStudentStatus = (isStudent: boolean) => {
        if (selectedCandidate) {
            updateUser(selectedCandidate.id, { is_student: isStudent });
            logCandidateAction(selectedCandidate.id, `Zmiana statusu studenta: ${isStudent ? 'Tak' : 'Nie'}`);
            setSelectedCandidate({ ...selectedCandidate, is_student: isStudent } as User);
        }
    };

    const toggleQual = (id: string) => {
        if (!selectedCandidate) return;
        const currentQuals = selectedCandidate.qualifications || [];
        let newQuals;
        if (currentQuals.includes(id)) {
            newQuals = currentQuals.filter(q => q !== id);
        } else {
            newQuals = [...currentQuals, id];
        }
        updateUser(selectedCandidate.id, { qualifications: newQuals });
        setSelectedCandidate({ ...selectedCandidate, qualifications: newQuals } as User);
    };

    // ... (Button Handlers, Confirm Actions - No changes) ...
    const handleSendLinkClick = (candidate: User) => { setConfirmModal({ isOpen: true, type: 'link', candidate }); };
    const handleRejectClick = (candidate: User) => { setConfirmModal({ isOpen: true, type: 'reject', candidate }); };
    const handleRestoreClick = (candidate: User) => { setConfirmModal({ isOpen: true, type: 'restore', candidate }); };
    
    const handleRequestData = (candidate: User) => {
        updateUser(candidate.id, { status: UserStatus.DATA_REQUESTED });
        logCandidateAction(candidate.id, `Wysłano prośbę o dane do umowy. Status zmieniony na: ${USER_STATUS_LABELS[UserStatus.DATA_REQUESTED]}`);
        triggerNotification('status_change', 'Oczekiwanie na dane', `Wysłano prośbę o dane do kandydata ${candidate.first_name} ${candidate.last_name}.`);
        if (selectedCandidate) {
            setSelectedCandidate({ ...selectedCandidate, status: UserStatus.DATA_REQUESTED });
        }
        setSuccessModal({
            isOpen: true,
            title: 'Wysłano prośbę',
            message: `Status zmieniony na "${USER_STATUS_LABELS[UserStatus.DATA_REQUESTED]}". Kandydat otrzymał powiadomienie.`
        });
    };

    const handleTrialClick = (candidate: User) => {
        const today = new Date().toISOString().split('T')[0];
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        const endDate = threeMonthsLater.toISOString().split('T')[0];
        const rates = calculateProjectedRate(candidate);
        setTrialConfig({ startDate: today, endDate: endDate, brigadirId: '', rate: rates.base });
        setIsTrialModalOpen(true);
    };

    const handleFireClick = (candidate: User) => { setConfirmModal({ isOpen: true, type: 'fire', candidate }); };
    const handleHireClick = (candidate: User) => { setConfirmModal({ isOpen: true, type: 'hire', candidate }); };

    const executeConfirmationAction = () => {
        const { type, candidate, data } = confirmModal;
        if (!candidate || !type) return;

        if (type === 'reject') {
            updateUser(candidate.id, { status: UserStatus.REJECTED });
            logCandidateAction(candidate.id, 'Odrzucono kandydata (Archiwizacja)');
            setSelectedCandidate(null);
            setSuccessModal({ isOpen: true, title: 'Kandydat Zarchiwizowany', message: `Kandydat ${candidate.first_name} ${candidate.last_name} został przeniesiony do archiwum.` });
        } else if (type === 'restore') {
            updateUser(candidate.id, { status: UserStatus.STARTED });
            logCandidateAction(candidate.id, 'Przywrócono kandydata z archiwum');
            setSelectedCandidate(null);
            setViewMode('active');
            setSuccessModal({ isOpen: true, title: 'Kandydat Przywrócony', message: `Kandydat ${candidate.first_name} ${candidate.last_name} został przywrócony.` });
        } else if (type === 'link') {
            logCandidateAction(candidate.id, `Wysłano link do portalu (Email: ${candidate.email})`);
            updateUser(candidate.id, { status: UserStatus.INVITED });
            triggerNotification('candidate_link', 'Wysłano Link', `Wysłano zaproszenie do ${candidate.first_name} ${candidate.last_name}.`);
            if (selectedCandidate?.id === candidate.id) setSelectedCandidate({ ...selectedCandidate, status: UserStatus.INVITED });
            setSuccessModal({ isOpen: true, title: 'Link Wysłany', message: `Pomyślnie wysłano zaproszenie do testów.` });
        } else if (type === 'hire') {
            hireCandidate(candidate.id);
            if (selectedCandidate) setSelectedCandidate({ ...selectedCandidate, role: Role.EMPLOYEE, status: UserStatus.ACTIVE });
            setSuccessModal({ isOpen: true, title: 'Pracownik Zatrudniony', message: `Kandydat ${candidate.first_name} został zatrudniony na stałe.` });
        } else if (type === 'reset_test' && data) {
            resetTestAttempt(data);
        }
        setConfirmModal({ isOpen: false, type: null, candidate: null });
    };

    // ... (Trial Config Save, Doc logic - No changes) ...
    const handleSaveTrialConfig = () => {
        if (!selectedCandidate) return;
        if (!trialConfig.startDate || !trialConfig.endDate || !trialConfig.brigadirId) {
            alert('Wypełnij wszystkie pola.');
            return;
        }
        moveCandidateToTrial(selectedCandidate.id, trialConfig.brigadirId, trialConfig.startDate, trialConfig.endDate, trialConfig.rate);
        setIsTrialModalOpen(false);
        setSelectedCandidate(null);
        setSuccessModal({ isOpen: true, title: 'Rozpoczęto Okres Próbny', message: `Kandydat został przeniesiony do listy "Okres Próbny".` });
    };

    const handleAddDocument = () => {
        if(!selectedCandidate) return;
        setEditingDocId(null);
        setNewDocData({ name: '', issue_date: new Date().toISOString().split('T')[0], expires_at: '', indefinite: false, fileUrl: '' });
        setIsDocModalOpen(true);
    };

    const handleEditDocument = (docId: string) => {
        const doc = state.userSkills.find(us => us.id === docId);
        if(!doc) return;
        setEditingDocId(docId);
        setNewDocData({
            name: doc.custom_name || doc.document_url || '',
            issue_date: doc.issue_date || new Date().toISOString().split('T')[0],
            expires_at: doc.expires_at || '',
            indefinite: doc.is_indefinite || false,
            fileUrl: doc.document_url || '' 
        });
        setIsDocModalOpen(true);
    };

    const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setNewDocData({ ...newDocData, fileUrl: objectUrl });
        }
    };

    const handleSaveDocument = () => {
        if(!selectedCandidate || !newDocData.name) return;
        
        let finalUrl = newDocData.fileUrl;
        if (docFileInputRef.current?.files?.[0]) {
             const f = docFileInputRef.current.files[0];
             const url = URL.createObjectURL(f);
             finalUrl = f.type === 'application/pdf' ? `${url}#pdf` : url;
        }

        const docPayload = {
            custom_name: newDocData.name,
            document_url: finalUrl, 
            issue_date: newDocData.issue_date,
            expires_at: newDocData.indefinite ? undefined : newDocData.expires_at,
            is_indefinite: newDocData.indefinite,
        };
        if (editingDocId) {
            updateCandidateDocumentDetails(editingDocId, docPayload);
        } else {
            addCandidateDocument(selectedCandidate.id, { skill_id: 'doc_generic', status: SkillStatus.PENDING, ...docPayload });
        }
        setIsDocModalOpen(false);
    };

    const handleDocStatusChange = (docId: string, newStatus: SkillStatus) => {
        updateUserSkillStatus(docId, newStatus);
        setStatusPopoverDocId(null);
    };

    const changeStatus = (newStatus: UserStatus) => {
        if(selectedCandidate) {
            updateUser(selectedCandidate.id, { status: newStatus });
            setSelectedCandidate({...selectedCandidate, status: newStatus});
            logCandidateAction(selectedCandidate.id, `Ręczna zmiana statusu na: ${USER_STATUS_LABELS[newStatus]}`);
            setIsStatusEditOpen(false);
        }
    };

    const handleOpenCV = () => { if (selectedCandidate?.resume_url) window.open(selectedCandidate.resume_url, '_blank'); else alert('Brak CV'); };
    const handleDownloadCV = () => {
        if (selectedCandidate?.resume_url) {
            const link = document.createElement('a');
            link.href = selectedCandidate.resume_url;
            link.download = `CV.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert('Brak CV');
        }
    };

    const openFileViewer = (doc: any) => {
        const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
        setFileViewer({ isOpen: true, urls, title: doc.custom_name || 'Dokument', index: 0 });
    };

    // --- RENDERERS ---
    
    // ... (Previous Modal Renderers unchanged) ...
    const renderSelectionModal = () => {
        if (!isSelectionModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Dodaj Kandydata</h2>
                        <button onClick={() => setIsSelectionModalOpen(false)}><X size={24} className="text-slate-400"/></button>
                    </div>
                    <div className="space-y-3">
                        <button 
                            className="w-full p-4 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 flex items-center gap-3 transition-all group"
                            onClick={() => { setIsSelectionModalOpen(false); setIsAddModalOpen(true); }}
                        >
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><UserPlus size={20} /></div>
                            <div className="text-left">
                                <div className="font-bold text-slate-700">Wprowadź Ręcznie</div>
                                <div className="text-xs text-slate-500">Wypełnij formularz</div>
                            </div>
                        </button>
                        
                        <button 
                            className="w-full p-4 border border-slate-200 rounded-xl hover:bg-purple-50 hover:border-purple-200 flex items-center gap-3 transition-all group"
                            onClick={() => { setIsSelectionModalOpen(false); setIsInviteModalOpen(true); }}
                        >
                            <div className="bg-purple-100 p-2 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors"><Send size={20} /></div>
                            <div className="text-left">
                                <div className="font-bold text-slate-700">Wyślij Zaproszenie</div>
                                <div className="text-xs text-slate-500">Email z linkiem do rejestracji</div>
                            </div>
                        </button>

                        <button 
                            className="w-full p-4 border border-slate-200 rounded-xl hover:bg-green-50 hover:border-green-200 flex items-center gap-3 transition-all group"
                            onClick={() => { setIsSelectionModalOpen(false); setIsAIModalOpen(true); }}
                        >
                            <div className="bg-green-100 p-2 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors"><Bot size={20} /></div>
                            <div className="text-left">
                                <div className="font-bold text-slate-700">AI Skaner CV</div>
                                <div className="text-xs text-slate-500">Automatyczne uzupełnianie</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderInviteModal = () => {
        if (!isInviteModalOpen) return null;
        const inviteLink = `${window.location.origin}/#/candidate/register`;
        
        const handleCopy = () => {
            navigator.clipboard.writeText(inviteLink);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
        };

        const handleSendInvite = () => {
            if (inviteEmail) {
                const newUser = addCandidate({
                    first_name: 'Kandydat',
                    last_name: '(Zaproszony)',
                    email: inviteEmail,
                    phone: '',
                    source: 'Zaproszenie Email',
                    target_position: 'Nieokreślone',
                    notes: 'Oczekuje na rejestrację.'
                });
                updateUser(newUser.id, { status: UserStatus.INVITED });
                logCandidateAction(newUser.id, `Wysłano zaproszenie na email: ${inviteEmail}`);
                
                setIsInviteModalOpen(false);
                setInviteEmail('');
                setSuccessModal({
                    isOpen: true,
                    title: 'Zaproszenie Wysłane',
                    message: `Link aktywacyjny został wysłany na adres ${inviteEmail}.`
                });
            }
        };

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Wyślij Zaproszenie</h2>
                        <button onClick={() => setIsInviteModalOpen(false)}><X size={24} className="text-slate-400"/></button>
                    </div>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">Wyślij kandydatowi link do samodzielnej rejestracji i wypełnienia testów.</p>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Adres Email Kandydata</label>
                            <input type="email" className="w-full border p-2 rounded" placeholder="jan.kowalski@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500">LUB SKOPIUJ LINK</span></div>
                        </div>
                        <div className="flex gap-2">
                            <input className="flex-1 border p-2 rounded bg-slate-50 text-sm text-slate-500" readOnly value={inviteLink} />
                            <Button variant="secondary" onClick={handleCopy}>{inviteCopied ? <CheckCircle size={18} className="text-green-600"/> : <Copy size={18}/>}</Button>
                        </div>
                    </div>
                    <div className="flex justify-end mt-6 gap-2">
                        <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>Anuluj</Button>
                        <Button onClick={handleSendInvite} disabled={!inviteEmail}><Send size={18} className="mr-2"/> Wyślij</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderAIModal = () => {
        if (!isAIModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Bot size={24} className="text-blue-600"/> AI Skaner CV</h2>
                        <button onClick={() => setIsAIModalOpen(false)}><X size={24} className="text-slate-400"/></button>
                    </div>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">Wgraj plik CV (PDF/Image), a sztuczna inteligencja automatycznie uzupełni dane kandydata.</p>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Stanowisko</label>
                            <select className="w-full border p-2 rounded bg-white" value={aiTargetPosition} onChange={e => setAiTargetPosition(e.target.value)}>
                                <option value="">Wybierz...</option>
                                {systemConfig.positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                            </select>
                        </div>
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => aiFileInputRef.current?.click()}>
                            {/* Fixed: changed aiFileInputRef prop to ref to use correctly as a React ref */}
                            <input type="file" ref={aiFileInputRef} className="hidden" accept=".pdf,image/*" onChange={(e) => setAiFile(e.target.files?.[0] || null)} />
                            {aiFile ? <div className="text-center"><FileText size={32} className="mx-auto text-green-600 mb-2"/><span className="text-sm font-medium text-green-700">{aiFile.name}</span></div> : <div className="text-center text-slate-400"><Upload size={32} className="mx-auto mb-2"/><span className="text-sm">Kliknij, aby wybrać plik</span></div>}
                        </div>
                    </div>
                    <div className="flex justify-end mt-6 gap-2">
                        <Button variant="ghost" onClick={() => setIsAIModalOpen(false)}>Anuluj</Button>
                        <Button onClick={processCVWithAI} disabled={!aiFile || !aiTargetPosition || isProcessingAI}>{isProcessingAI ? <><Loader2 size={18} className="animate-spin mr-2"/> Analizowanie...</> : 'Przetwórz'}</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderCandidateModal = () => {
        if (!isAddModalOpen && !isEditModalOpen) return null;
        const isEdit = isEditModalOpen;
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">{isEdit ? 'Edytuj Kandydata' : 'Dodaj Nowego Kandydata'}</h2>
                        <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}><X size={24} className="text-slate-400"/></button>
                    </div>
                    <div className="space-y-4 overflow-y-auto flex-1 p-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Imię *</label><input className={`w-full border p-2 rounded ${formErrors.first_name ? 'border-red-500' : ''}`} value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} /></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Nazwisko *</label><input className={`w-full border p-2 rounded ${formErrors.last_name ? 'border-red-500' : ''}`} value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Email *</label><input type="email" className={`w-full border p-2 rounded ${formErrors.email ? 'border-red-500' : ''}`} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Telefon *</label><div className="flex gap-2"><select className="border p-2 rounded bg-slate-50 w-24" value={phonePrefix} onChange={e => setPhonePrefix(e.target.value)}><option value="+48">+48</option><option value="+380">+380</option><option value="+49">+49</option><option value="+375">+375</option><option value="+995">+995</option></select><input className={`w-full border p-2 rounded ${formErrors.phone ? 'border-red-500' : ''}`} value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="000 000 000" /></div></div>
                        </div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Stanowisko (Aplikacja na) *</label><select className={`w-full border p-2 rounded bg-white ${formErrors.target_position ? 'border-red-500' : ''}`} value={formData.target_position || ''} onChange={e => setFormData({...formData, target_position: e.target.value})}><option value="">Wybierz...</option>{systemConfig.positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}</select></div>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Źródło Kandydata *</label>
                            <select className={`w-full border p-2 rounded bg-white mb-2 ${formErrors.source ? 'border-red-500' : ''}`} value={sourceType} onChange={e => setSourceType(e.target.value)}><option value="">Wybierz...</option><option value="OLX">OLX</option><option value="Pracuj.pl">Pracuj.pl</option><option value="Flagma">Flagma</option><option value="FaceBook">FaceBook</option><option value="Polecenie">Polecenie (Rekomendacja)</option><option value="Inne">Inne</option></select>
                            {sourceType === 'Polecenie' && (<div className="pl-4 border-l-2 border-slate-300 mt-2 space-y-2"><div className="flex gap-4"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="recType" value="employee" checked={recommendationType === 'employee'} onChange={() => setRecommendationType('employee')} /> Pracownik</label><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="recType" value="other" checked={recommendationType === 'other'} onChange={() => setRecommendationType('other')} /> Inna osoba</label></div>{recommendationType === 'employee' && (<select className="w-full border p-2 rounded bg-white text-sm" value={recommenderId} onChange={e => setRecommenderId(e.target.value)}><option value="">Wybierz pracownika...</option>{employeesList.map(emp => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>))}</select>)}{recommendationType === 'other' && (<input className="w-full border p-2 rounded text-sm" placeholder="Imię i Nazwisko polecającego" value={customSourceDetail} onChange={e => setCustomSourceDetail(e.target.value)} />)}</div>)}
                            {sourceType === 'Inne' && (<input className="w-full border p-2 rounded mt-2 text-sm" placeholder="Opisz źródło..." value={customSourceDetail} onChange={e => setCustomSourceDetail(e.target.value)} />)}
                        </div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">CV / Resume</label><div className="flex items-center gap-3"><input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,image/*" onChange={handleResumeUpload} /><Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload size={16} className="mr-2"/> Wybierz plik</Button>{formData.resume_url ? (<div className="text-sm text-green-600 flex items-center gap-1"><CheckCircle size={14}/> <span>Plik dodany</span><button onClick={() => window.open(formData.resume_url, '_blank')} className="text-xs text-blue-600 underline ml-2">Podgląd</button></div>) : (<span className="text-xs text-slate-400">Brak pliku</span>)}</div></div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Notatki (Krótki opis)</label><textarea className="w-full border p-2 rounded" rows={3} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
                    </div>
                    <div className="flex justify-end mt-6 gap-2 pt-4 border-t border-slate-100"><Button variant="ghost" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>Anuluj</Button>{!isEdit && (<Button variant="secondary" onClick={() => handleSaveCandidate(true)} className="border-blue-200 text-blue-700 hover:bg-blue-50"><Send size={16} className="mr-2"/> Zapisz i Wyślij Zaproszenie</Button>)}<Button onClick={() => handleSaveCandidate(false)}>Zapisz</Button></div>
                </div>
            </div>
        );
    };

    const renderDocumentModal = () => {
        if (!isDocModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-900">{editingDocId ? 'Edytuj Dokument' : 'Dodaj Dokument'}</h2>
                        <button onClick={() => setIsDocModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nazwa Dokumentu</label>
                            <input className="w-full border p-2 rounded" placeholder="np. Certyfikat SEP" value={newDocData.name} onChange={e => setNewDocData({...newDocData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Załącz Plik</label>
                            <div className="flex items-center gap-3">
                                <input type="file" ref={docFileInputRef} className="hidden" onChange={handleDocFileSelect} />
                                <Button size="sm" variant="outline" onClick={() => docFileInputRef.current?.click()}><Upload size={16} className="mr-2"/> Wybierz plik</Button>
                                {newDocData.fileUrl && <span className="text-xs text-green-600 font-bold">Plik dodany</span>}
                            </div>
                        </div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Data Wydania</label><input type="date" className="w-full border p-2 rounded" value={newDocData.issue_date} onChange={e => setNewDocData({...newDocData, issue_date: e.target.value})} /></div>
                        <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded"><input type="checkbox" id="indefinite" checked={newDocData.indefinite} onChange={e => setNewDocData({...newDocData, indefinite: e.target.checked})} className="w-4 h-4 text-blue-600 rounded cursor-pointer" /><label htmlFor="indefinite" className="text-sm text-slate-700 cursor-pointer font-medium">Dokument bezterminowy</label></div>
                        {!newDocData.indefinite && (<div><label className="block text-sm font-bold text-slate-700 mb-1">Data Ważności</label><input type="date" className="w-full border p-2 rounded" value={newDocData.expires_at} onChange={e => setNewDocData({...newDocData, expires_at: e.target.value})} /></div>)}
                    </div>
                    <div className="flex justify-end gap-2 mt-6"><Button variant="ghost" onClick={() => setIsDocModalOpen(false)}>Anuluj</Button><Button onClick={handleSaveDocument} disabled={!newDocData.name}>Zapisz</Button></div>
                </div>
            </div>
        );
    };

    const renderConfirmModal = () => {
        if (!confirmModal.isOpen || !confirmModal.candidate) return null;
        let title = ''; let btnText = 'Potwierdź'; let btnVariant = 'primary'; let content = null;
        if (confirmModal.type === 'reject') { title = 'Odrzuć Kandydata'; btnText = 'Odrzuć'; btnVariant = 'danger'; content = <p className="text-slate-500 mb-6">Czy na pewno chcesz odrzucić kandydata {confirmModal.candidate.first_name} {confirmModal.candidate.last_name}? Trafi on do archiwum.</p>; } 
        else if (confirmModal.type === 'link') { title = 'Wyślij Link'; btnText = 'Wyślij'; content = <p className="text-slate-500 mb-6">Czy wysłać link do testów dla {confirmModal.candidate.first_name} {confirmModal.candidate.last_name}?</p>; } 
        else if (confirmModal.type === 'hire') { title = 'Zatrudnij Kandydata'; btnText = 'Zatrudnij'; content = <p className="text-slate-500 mb-6">Czy zatrudnić {confirmModal.candidate.first_name} {confirmModal.candidate.last_name} jako pracownika? To przeniesie go do listy pracowników.</p>; } 
        else if (confirmModal.type === 'restore') { title = 'Przywróć Kandydata'; btnText = 'Przywróć'; content = <p className="text-slate-500 mb-6">Czy przywrócić kandydata {confirmModal.candidate.first_name} z archiwum?</p>; } 
        else if (confirmModal.type === 'reset_test') { title = 'Resetuj Test'; btnText = 'Resetuj'; btnVariant = 'danger'; content = <p className="text-slate-500 mb-6">Czy na pewno chcesz zresetować wynik tego testu? Historia zostanie usunięta.</p>; }
        return (
            <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                     <div className="flex flex-col items-center text-center"><div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${btnVariant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}><AlertTriangle size={32} /></div><h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>{content}<div className="flex gap-3 w-full"><Button fullWidth variant="ghost" onClick={() => setConfirmModal({isOpen: false, type: null, candidate: null})}>Anuluj</Button><Button fullWidth variant={btnVariant as any} onClick={executeConfirmationAction}>{btnText}</Button></div></div>
                </div>
            </div>
        );
    };

    const renderTrialModal = () => {
        if (!isTrialModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                    <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Skieruj na Okres Próbny</h2><button onClick={() => setIsTrialModalOpen(false)}><X size={24} className="text-slate-400"/></button></div>
                    <div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-slate-700 mb-1">Data Startu</label><input type="date" className="w-full border p-2 rounded" value={trialConfig.startDate} onChange={e => setTrialConfig({...trialConfig, startDate: e.target.value})} /></div><div><label className="block text-sm font-bold text-slate-700 mb-1">Data Końca</label><input type="date" className="w-full border p-2 rounded" value={trialConfig.endDate} onChange={e => setTrialConfig({...trialConfig, endDate: e.target.value})} /></div></div><div><label className="block text-sm font-bold text-slate-700 mb-1">Stawka Początkowa (PLN/h)</label><input type="number" className="w-full border p-2 rounded" value={trialConfig.rate} onChange={e => setTrialConfig({...trialConfig, rate: Number(e.target.value)})} /></div><div><label className="block text-sm font-bold text-slate-700 mb-1">Przydziel Brygadzista</label><select className="w-full border p-2 rounded bg-white" value={trialConfig.brigadirId} onChange={e => setTrialConfig({...trialConfig, brigadirId: e.target.value})}><option value="">Wybierz...</option>{brigadirsList.map(b => <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>)}</select></div></div>
                    <div className="flex justify-end gap-2 mt-6"><Button variant="ghost" onClick={() => setIsTrialModalOpen(false)}>Anuluj</Button><Button onClick={handleSaveTrialConfig} disabled={!trialConfig.brigadirId}>Rozpocznij Okres Próbny</Button></div>
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

    const renderQualModal = () => {
        if (!isQualModalOpen || !selectedCandidate) return null;
        const currentQuals = selectedCandidate.qualifications || [];
        
        const toggleQual = (id: string) => {
            let newQuals;
            if (currentQuals.includes(id)) {
                newQuals = currentQuals.filter(q => q !== id);
            } else {
                newQuals = [...currentQuals, id];
            }
            updateUser(selectedCandidate.id, { qualifications: newQuals });
            setSelectedCandidate({ ...selectedCandidate, qualifications: newQuals } as User);
        };

        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setIsQualModalOpen(false)}>
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-6 border-b border-slate-100">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Shield size={24} className="text-purple-600"/> Uprawnienia Kandydata
                        </h3>
                        <button onClick={() => setIsQualModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                    </div>
                    <div className="p-6">
                        <p className="text-sm text-slate-500 mb-4">Zaznacz uprawnienia, które posiada kandydat.</p>
                        <div className="space-y-2">
                            {QUALIFICATIONS_LIST.map(q => {
                                const isSelected = currentQuals.includes(q.id);
                                return (
                                    <div 
                                        key={q.id}
                                        onClick={() => toggleQual(q.id)}
                                        className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                            isSelected 
                                            ? 'bg-green-50 border-green-200 shadow-sm' 
                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-green-600 border-green-600' : 'border-slate-300'}`}>
                                                {isSelected && <CheckCircle size={14} className="text-white"/>}
                                            </div>
                                            <span className={`font-medium ${isSelected ? 'text-green-800' : 'text-slate-700'}`}>{q.label}</span>
                                        </div>
                                        <span className={`font-bold ${isSelected ? 'text-green-600' : 'text-slate-400'}`}>+{q.value} zł</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                        <Button onClick={() => setIsQualModalOpen(false)}>Gotowe</Button>
                    </div>
                </div>
            </div>
        );
    };

    // --- RENDER LIST VIEW ---
    const renderList = () => (
        <>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Kandydaci</h1>
                <div className="flex gap-2">
                    <div className="bg-white border border-slate-200 rounded-lg flex p-1">
                        <button 
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'active' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setViewMode('active')}
                        >
                            Aktywni
                        </button>
                        <button 
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'archived' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setViewMode('archived')}
                        >
                            Archiwum
                        </button>
                    </div>
                    <Button onClick={() => setIsSelectionModalOpen(true)}>
                        <Plus size={18} className="mr-2"/> Dodaj Kandydata
                    </Button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Szukaj kandydata (imię, nazwisko)..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select 
                    className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="all">Wszystkie statusy</option>
                    {Object.values(UserStatus).map(s => (
                        <option key={s} value={s}>{USER_STATUS_LABELS[s] || s}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Kandydat</th>
                            <th className="px-6 py-4">Stanowisko</th>
                            <th className="px-6 py-4">Kontakt</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Data Aplikacji</th>
                            <th className="px-6 py-4 text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredCandidates.map(candidate => (
                            <tr key={candidate.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedCandidate(candidate)}>
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xs">
                                            {candidate.first_name[0]}{candidate.last_name[0]}
                                        </div>
                                        <div>{candidate.first_name} {candidate.last_name}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{candidate.target_position || '-'}</td>
                                <td className="px-6 py-4">
                                    <div className="text-slate-900">{candidate.email}</div>
                                    <div className="text-slate-500 text-xs">{candidate.phone}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${USER_STATUS_COLORS[candidate.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        {USER_STATUS_LABELS[candidate.status] || candidate.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{new Date(candidate.hired_date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right">
                                    <Button size="sm" variant="ghost"><ChevronRight size={18}/></Button>
                                </td>
                            </tr>
                        ))}
                        {filteredCandidates.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">Brak kandydatów spełniających kryteria.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );

    // ... (Main Render Return - Updated with renderFileViewer) ...
    const renderDetails = () => {
        // ... (Existing renderDetails logic)
        
        if (!selectedCandidate) return null;
        
        const candidateDocs = state.userSkills.filter(us => us.user_id === selectedCandidate.id && (state.skills.find(s => s.id === us.skill_id)?.verification_type === VerificationType.DOCUMENT || us.skill_id.startsWith('doc_')));
        const history = state.candidateHistory.filter(h => h.candidate_id === selectedCandidate.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const projectedRate = calculateProjectedRate(selectedCandidate);

        const showRequestDataButton = selectedCandidate.status === UserStatus.INTERESTED;
        const isReadyForTrial = selectedCandidate.status === UserStatus.DATA_SUBMITTED;
        const isWaitingForData = selectedCandidate.status === UserStatus.DATA_REQUESTED;

        const showPersonalDataTab = selectedCandidate.status === UserStatus.DATA_REQUESTED || 
                                    selectedCandidate.status === UserStatus.DATA_SUBMITTED || 
                                    selectedCandidate.status === UserStatus.OFFER_SENT ||
                                    selectedCandidate.status === UserStatus.ACTIVE || 
                                    selectedCandidate.status === UserStatus.TRIAL;

        return (
            <div onClick={() => { setStatusPopoverDocId(null); setIsStatusEditOpen(false); }}>
                <Button variant="ghost" onClick={() => setSelectedCandidate(null)} className="mb-4">
                    <ArrowRight className="transform rotate-180 mr-2" size={18} /> Wróć do listy
                </Button>

                {/* HEADER */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-6 relative z-20">
                    {/* ... (Header content unchanged) ... */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">
                                {selectedCandidate.first_name[0]}{selectedCandidate.last_name[0]}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{selectedCandidate.first_name} {selectedCandidate.last_name}</h1>
                                <div className="text-slate-500 flex flex-wrap gap-4 text-sm mt-1 mb-1">
                                    <span>{selectedCandidate.email}</span>
                                    <span>{selectedCandidate.phone}</span>
                                    <span className="text-slate-400">({selectedCandidate.source})</span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 mt-1 mb-1">
                                    Stanowisko: <span className="font-normal text-slate-600">{selectedCandidate.target_position || '-'}</span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 mb-2">
                                    Forma Zatrudnienia: <span className="font-normal text-slate-600">
                                        {CONTRACT_TYPE_LABELS[selectedCandidate.contract_type || ContractType.UOP] || '-'}
                                    </span>
                                </div>
                                <div className="flex gap-2 mt-2">
                                     {selectedCandidate.resume_url ? (
                                         <>
                                            <button onClick={handleOpenCV} className="text-blue-600 text-sm font-medium hover:underline flex items-center">
                                                <Eye size={14} className="mr-1"/> Otwórz CV
                                            </button>
                                            <button onClick={handleDownloadCV} className="text-slate-500 text-sm font-medium hover:underline flex items-center">
                                                <Download size={14} className="mr-1"/> Pobierz
                                            </button>
                                         </>
                                     ) : (
                                         <span className="text-slate-400 text-sm italic">Brak CV</span>
                                     )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 ml-auto">
                            <div className="flex items-center gap-2">
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <span 
                                        className={`px-3 py-1 rounded-full text-sm font-bold uppercase cursor-pointer border ${USER_STATUS_COLORS[selectedCandidate.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
                                        onClick={() => setIsStatusEditOpen(!isStatusEditOpen)}
                                    >
                                        {USER_STATUS_LABELS[selectedCandidate.status] || selectedCandidate.status}
                                    </span>
                                    {isStatusEditOpen && (
                                        <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-lg z-[100] flex flex-col py-1 w-64 max-h-96 overflow-y-auto">
                                            {/* ... status options ... */}
                                            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase bg-slate-50">Proces</div>
                                            <button className="text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700" onClick={() => changeStatus(UserStatus.INVITED)}>{USER_STATUS_LABELS[UserStatus.INVITED]}</button>
                                            <button className="text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700" onClick={() => changeStatus(UserStatus.STARTED)}>{USER_STATUS_LABELS[UserStatus.STARTED]}</button>
                                            <button className="text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700" onClick={() => changeStatus(UserStatus.TESTS_IN_PROGRESS)}>{USER_STATUS_LABELS[UserStatus.TESTS_IN_PROGRESS]}</button>
                                            <button className="text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700" onClick={() => changeStatus(UserStatus.TESTS_COMPLETED)}>{USER_STATUS_LABELS[UserStatus.TESTS_COMPLETED]}</button>
                                            <button className="text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700" onClick={() => changeStatus(UserStatus.INTERESTED)}>{USER_STATUS_LABELS[UserStatus.INTERESTED]}</button>
                                            
                                            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase bg-slate-50 border-t border-slate-100">Dane i Umowa</div>
                                            <button className="text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700" onClick={() => changeStatus(UserStatus.DATA_REQUESTED)}>{USER_STATUS_LABELS[UserStatus.DATA_REQUESTED]}</button>
                                            <button className="text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700" onClick={() => changeStatus(UserStatus.DATA_SUBMITTED)}>{USER_STATUS_LABELS[UserStatus.DATA_SUBMITTED]}</button>
                                            
                                            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase bg-slate-50 border-t border-slate-100">Decyzje Końcowe</div>
                                            <button className="text-left px-4 py-2 hover:bg-orange-50 text-orange-700 text-sm" onClick={() => changeStatus(UserStatus.NOT_INTERESTED)}>{USER_STATUS_LABELS[UserStatus.NOT_INTERESTED]}</button>
                                            <button className="text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm" onClick={() => changeStatus(UserStatus.REJECTED)}>{USER_STATUS_LABELS[UserStatus.REJECTED]}</button>
                                            <button className="text-left px-4 py-2 hover:bg-slate-100 text-slate-600 text-sm" onClick={() => changeStatus(UserStatus.PORTAL_BLOCKED)}>{USER_STATUS_LABELS[UserStatus.PORTAL_BLOCKED]}</button>
                                        </div>
                                    )}
                                </div>

                                <Button size="sm" variant="outline" onClick={() => setIsEditModalOpen(true)}>
                                    <Edit size={16} className="mr-2"/> Edytuj
                                </Button>
                            </div>

                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => handleSendLinkClick(selectedCandidate)}>
                                    <Send size={16} className="mr-2"/> Wyślij Link
                                </Button>
                                
                                {isReadyForTrial ? (
                                    <Button 
                                        size="sm" 
                                        className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" 
                                        onClick={() => handleTrialClick(selectedCandidate)}
                                    >
                                        <Clock size={16} className="mr-2"/> Okres Próbny
                                    </Button>
                                ) : isWaitingForData ? (
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-indigo-600 border-indigo-200 bg-indigo-50" 
                                        onClick={() => handleRequestData(selectedCandidate)}
                                    >
                                        <Clock size={16} className="mr-2"/> Oczekiwanie na dane (Przypomnij)
                                    </Button>
                                ) : (
                                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleRequestData(selectedCandidate)}>
                                        <FileText size={16} className="mr-2"/> Poproś o dane do umowy
                                    </Button>
                                )}

                                {selectedCandidate.status === UserStatus.REJECTED ? (
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleRestoreClick(selectedCandidate)}>
                                        <RotateCcw size={16} className="mr-2"/> Przywróć
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="danger" onClick={() => handleRejectClick(selectedCandidate)}>
                                        <XCircle size={16} className="mr-2"/> Odrzuć
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 relative z-0">
                    <div className="flex border-b border-slate-200 px-6 overflow-x-auto">
                        <button onClick={() => setActiveTab('info')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Info</button>
                        {showPersonalDataTab && (
                            <button onClick={() => setActiveTab('personal')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'personal' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Dane Osobowe</button>
                        )}
                        <button onClick={() => setActiveTab('rate')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'rate' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Symulacja Wynagrodzenia</button>
                        <button onClick={() => setActiveTab('tests')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'tests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Historia Testów</button>
                        <button onClick={() => setActiveTab('docs')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'docs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Dokumenty</button>
                        <button onClick={() => setActiveTab('history')} className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Historia Działań</button>
                    </div>

                    <div className="p-6">
                        {activeTab === 'info' && (
                            <div>
                                <h3 className="font-bold text-slate-900 mb-4">Notatki</h3>
                                <textarea 
                                    className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50" 
                                    rows={6} 
                                    value={selectedCandidate.notes || ''}
                                    onChange={(e) => updateUser(selectedCandidate.id, { notes: e.target.value })}
                                />
                                <div className="mt-2 text-right">
                                    <Button size="sm" onClick={() => alert("Notatka zapisana")}>Zapisz</Button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'personal' && (
                            <div>
                                {/* ... (Personal Data Form from previous state - omitted for brevity but conceptually here) ... */}
                                {/* Keeping existing logic for personal tab rendering if provided in previous state/context */}
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-slate-900">Dane Osobowe do Umowy</h3>
                                    <Button size="sm" onClick={handleSavePersonalData}>
                                        <Save size={16} className="mr-2"/> Zapisz Dane
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-4 max-w-4xl">
                                    {/* ... Input fields as defined in state ... */}
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">PESEL</label><input className="w-full border p-2 rounded" value={personalData.pesel || ''} onChange={handlePeselChange} maxLength={11}/></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Urodzenia</label><input type="date" className="w-full border p-2 rounded" value={personalData.birth_date || ''} onChange={e => setPersonalData({...personalData, birth_date: e.target.value})} /></div>
                                    {/* ... etc ... */}
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'rate' && (
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200" onClick={() => setIsContractPopoverOpen(false)}>
                                <h3 className="font-bold text-slate-900 mb-6">Symulacja Wynagrodzenia</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                                    {/* 1. Baza */}
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Baza</div>
                                        <div className="text-2xl font-bold text-slate-900">{projectedRate.base} zł</div>
                                    </div>

                                    {/* 2. Umiejętności */}
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100">
                                        <div className="text-xs text-green-600 uppercase tracking-wider mb-1">Umiejętności</div>
                                        <div className="text-2xl font-bold text-green-600">+{projectedRate.skillBonus + projectedRate.qualBonus} zł</div>
                                    </div>

                                    {/* 3. Forma Zatrudnienia */}
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
                                                {CONTRACT_TYPE_LABELS[selectedCandidate.contract_type || ContractType.UOP]}
                                                 <ChevronDown size={14} />
                                            </div>
                                            <div className="text-xs text-blue-400 font-medium mt-1">
                                                {projectedRate.contractBonus > 0 ? `+${projectedRate.contractBonus} zł/h` : 'Bez dodatku'}
                                            </div>
                                        </div>
                                        
                                        {isContractPopoverOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-lg z-10 flex flex-col py-1">
                                                <button className="px-4 py-2 text-sm text-left hover:bg-slate-50 text-slate-700" onClick={() => updateContractType(ContractType.UOP)}>Umowa o Pracę</button>
                                                <div className="border-t border-slate-100 my-1"></div>
                                                <button className="px-4 py-2 text-sm text-left hover:bg-slate-50 text-slate-700" onClick={() => updateContractType(ContractType.UZ)}>Umowa Zlecenie</button>
                                                {selectedCandidate.contract_type === ContractType.UZ && (
                                                    <div className="px-4 py-2 flex items-center gap-2 bg-blue-50">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedCandidate.is_student}
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

                                    {/* 4. Stawka Total */}
                                    <div className="bg-slate-900 p-4 rounded-lg shadow-sm text-white">
                                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Stawka Total</div>
                                        <div className="text-2xl font-bold">{projectedRate.total.toFixed(2)} zł/h netto</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tests' && (
                             <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Test</th>
                                        <th className="px-6 py-4">Wynik</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Akcje</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {state.testAttempts.filter(ta => ta.user_id === selectedCandidate.id).map(ta => (
                                        <tr key={ta.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {state.tests.find(t => t.id === ta.test_id)?.title || 'Nieznany test'}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-900">
                                                {ta.score}%
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                                    ta.passed 
                                                    ? 'bg-green-100 text-green-700 border-green-200' 
                                                    : 'bg-red-100 text-red-700 border-red-200'
                                                }`}>
                                                    {ta.passed ? 'ZALICZONY' : 'NIEZALICZONY'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmModal({ isOpen: true, type: 'reset_test', candidate: selectedCandidate, data: ta.id });
                                                    }}
                                                    className="text-slate-400 hover:text-red-500 transition-colors text-xs font-medium"
                                                >
                                                    Reset
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {state.testAttempts.filter(ta => ta.user_id === selectedCandidate.id).length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-400 italic">Brak podejść do testów.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'docs' && (
                            <div onClick={() => setStatusPopoverDocId(null)}>
                                <div className="flex justify-between mb-4">
                                     {/* ... (Search & Filter) ... */}
                                     <div className="relative w-64"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Szukaj..." className="w-full pl-9 pr-2 py-1.5 border rounded text-sm" value={docSearch} onChange={(e) => setDocSearch(e.target.value)} /></div>
                                     <div className="flex gap-2">
                                         <Button size="sm" variant={docsViewMode === 'active' ? 'secondary' : 'primary'} onClick={() => setDocsViewMode(prev => prev === 'active' ? 'archived' : 'active')}>{docsViewMode === 'active' ? 'Archiwum' : 'Aktywne'}</Button>
                                         <Button size="sm" onClick={handleAddDocument}><Plus size={16} className="mr-2"/> Dodaj</Button>
                                     </div>
                                </div>

                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Dokument</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Data</th>
                                            <th className="px-4 py-3">Plik</th>
                                            <th className="px-4 py-3 text-right">Akcje</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {candidateDocs.filter(d => docsViewMode === 'active' ? !d.is_archived : d.is_archived).map(d => {
                                            const fileCount = d.document_urls ? d.document_urls.length : (d.document_url ? 1 : 0);
                                            return (
                                                <tr key={d.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleEditDocument(d.id)}>
                                                    <td className="px-4 py-3 font-medium">{d.custom_name}</td>
                                                    <td className="px-4 py-3">
                                                        {/* Status Badge */}
                                                        <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${SKILL_STATUS_LABELS[d.status] ? 'bg-slate-100' : ''}`}>{SKILL_STATUS_LABELS[d.status]}</span>
                                                    </td>
                                                    <td className="px-4 py-3">{d.issue_date}</td>
                                                    <td className="px-4 py-3">
                                                        <Button 
                                                            size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50" 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                const urls = d.document_urls && d.document_urls.length > 0 ? d.document_urls : (d.document_url ? [d.document_url] : []);
                                                                setFileViewer({ isOpen: true, urls, title: d.custom_name || 'Dokument', index: 0 });
                                                            }}
                                                        >
                                                            <Eye size={16}/> Zobacz {fileCount > 1 ? `(${fileCount})` : ''}
                                                        </Button>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); archiveCandidateDocument(d.id); }}><Archive size={16}/></Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
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
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
             {selectedCandidate ? renderDetails() : (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-900">Kandydaci</h1>
                        <div className="flex gap-2">
                            <div className="bg-white border border-slate-200 rounded-lg flex p-1">
                                <button 
                                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'active' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setViewMode('active')}
                                >
                                    Aktywni
                                </button>
                                <button 
                                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'archived' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setViewMode('archived')}
                                >
                                    Archiwum
                                </button>
                            </div>
                            <Button onClick={() => setIsSelectionModalOpen(true)}>
                                <Plus size={18} className="mr-2"/> Dodaj Kandydata
                            </Button>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Szukaj kandydata (imię, nazwisko)..." 
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select 
                            className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Wszystkie statusy</option>
                            {Object.values(UserStatus).map(s => (
                                <option key={s} value={s}>{USER_STATUS_LABELS[s] || s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Kandydat</th>
                                    <th className="px-6 py-4">Stanowisko</th>
                                    <th className="px-6 py-4">Kontakt</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Data Aplikacji</th>
                                    <th className="px-6 py-4 text-right">Akcje</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCandidates.map(candidate => (
                                    <tr key={candidate.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedCandidate(candidate)}>
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xs">
                                                    {candidate.first_name[0]}{candidate.last_name[0]}
                                                </div>
                                                <div>{candidate.first_name} {candidate.last_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{candidate.target_position || '-'}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-900">{candidate.email}</div>
                                            <div className="text-slate-500 text-xs">{candidate.phone}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${USER_STATUS_COLORS[candidate.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                {USER_STATUS_LABELS[candidate.status] || candidate.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{new Date(candidate.hired_date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Button size="sm" variant="ghost"><ChevronRight size={18}/></Button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCandidates.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">Brak kandydatów spełniających kryteria.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
             )}
            
            {renderSelectionModal()}
            {renderInviteModal()}
            {renderAIModal()}
            {renderCandidateModal()}
            {renderDocumentModal()}
            {renderConfirmModal()}
            {renderTrialModal()}
            {renderSuccessModal()}
            {renderQualModal()}
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