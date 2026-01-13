
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Send, Clock, XCircle, Search, ChevronRight, Download, FileText, 
    Plus, Archive, RotateCcw, AlertTriangle, User as UserIcon, Calendar, 
    CheckCircle, Edit, Trash2, UserPlus, Briefcase, UserCheck, Eye, X, 
    Upload, ChevronDown, Bot, Loader2, Share2, Copy, FileInput, Save, 
    Shield, Wallet, Award, Calculator, ChevronLeft, Globe, Mail, Phone, ExternalLink, Activity, Info as InfoIcon, MapPin, Sparkles
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { User, Role, UserStatus, SkillStatus, VerificationType, CandidateHistoryEntry, ContractType } from '../../types';
import { USER_STATUS_LABELS, SKILL_STATUS_LABELS, CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';
import { calculateSalary } from '../../services/salaryService';
import { GoogleGenAI, Type } from "@google/genai";

const SOURCE_OPTIONS = ["OLX", "Pracuj.pl", "Facebook / Social Media", "Polecenie pracownika", "Strona WWW", "Inne"];

const CANDIDATE_DISPLAY_LABELS: Record<string, string> = {
    [UserStatus.INVITED]: 'ZAPROSZONY',
    [UserStatus.STARTED]: 'NOWY',
    [UserStatus.TESTS_IN_PROGRESS]: 'W TRAKCIE',
    [UserStatus.TESTS_COMPLETED]: 'TESTY OK',
    [UserStatus.DATA_REQUESTED]: 'PROŚBA O DANE',
    [UserStatus.DATA_SUBMITTED]: 'DANE PRZESŁANE',
    [UserStatus.REJECTED]: 'ODRZUCONY'
};

const CANDIDATE_DISPLAY_COLORS: Record<string, string> = {
    [UserStatus.INVITED]: 'bg-indigo-100 text-indigo-700',
    [UserStatus.STARTED]: 'bg-blue-100 text-blue-700',
    [UserStatus.TESTS_IN_PROGRESS]: 'bg-blue-100 text-blue-700',
    [UserStatus.TESTS_COMPLETED]: 'bg-blue-100 text-blue-700',
    [UserStatus.DATA_REQUESTED]: 'bg-purple-100 text-purple-700',
    [UserStatus.DATA_SUBMITTED]: 'bg-emerald-100 text-emerald-700',
    [UserStatus.REJECTED]: 'bg-red-100 text-red-700'
};

export const HRCandidatesPage = () => {
    const { state, updateUser, addCandidate, logCandidateAction, triggerNotification, archiveCandidateDocument, restoreCandidateDocument, addCandidateDocument, updateCandidateDocumentDetails, updateUserSkillStatus, resetTestAttempt, moveCandidateToTrial } = useAppContext();
    const { systemConfig, skills, userSkills, testAttempts, users, tests, positions } = state;
    const location = useLocation();
    
    const inviteLink = `${window.location.origin}/#/candidate/welcome`;

    const [selectedCandidate, setSelectedCandidate] = useState<User | null>(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'info'|'personal'|'salary'|'tests'|'docs'|'history'>('info');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    
    // Modals & Popovers State
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false); 
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditBasicModalOpen, setIsEditBasicModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
    const [isContractPopoverOpen, setIsContractPopoverOpen] = useState(false);
    const [statusPopoverDocId, setStatusPopoverDocId] = useState<string | null>(null);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    
    // Trial Period Modal
    const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
    const [trialDates, setTrialDates] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        brigadirId: ''
    });

    // Form for adding new candidate
    const [newCandidateData, setNewCandidateData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        target_position: '',
        source: 'OLX',
        cvFile: null as File | null
    });

    // Form for editing candidate basic data
    const [editBasicData, setEditBasicData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        target_position: '',
        source: ''
    });
    const [editCVFile, setEditCVFile] = useState<File | null>(null);

    // AI Parsing State
    const [isAILoading, setIsAILoading] = useState(false);
    const aiFileInputRef = useRef<HTMLInputElement>(null);

    // Validation state
    const [validationErrors, setValidationErrors] = useState<{email?: string, phone?: string}>({});

    const brigadirsList = useMemo(() => {
        return users.filter(u => u.role === Role.BRIGADIR);
    }, [users]);

    // Phone masking helper
    const formatPhone = (val: string) => {
        let cleaned = val.replace(/\D/g, '');
        if (cleaned.startsWith('48')) cleaned = cleaned.substring(2);
        let limited = cleaned.substring(0, 9);
        let result = '+48 ';
        if (limited.length > 0) result += limited.substring(0, 3);
        if (limited.length > 3) result += ' ' + limited.substring(3, 6);
        if (limited.length > 6) result += ' ' + limited.substring(6, 9);
        return result.trim();
    };

    // Duplicate check
    useEffect(() => {
        if (!isAddModalOpen && !isEditBasicModalOpen) return;
        const newErrors: {email?: string, phone?: string} = {};
        
        const emailToCheck = isAddModalOpen ? newCandidateData.email : editBasicData.email;
        const phoneToCheck = isAddModalOpen ? newCandidateData.phone : editBasicData.phone;

        if (emailToCheck.length > 3) {
            const exists = users.some(u => 
                u.id !== selectedCandidate?.id && 
                u.email.toLowerCase() === emailToCheck.toLowerCase()
            );
            if (exists) newErrors.email = 'Ten adres email jest już w bazie.';
        }

        if (phoneToCheck.length > 10) {
            const exists = users.some(u => 
                u.id !== selectedCandidate?.id && 
                u.phone === phoneToCheck
            );
            if (exists) newErrors.phone = 'Ten numer telefonu jest już w bazie.';
        }

        setValidationErrors(newErrors);
    }, [newCandidateData.email, newCandidateData.phone, editBasicData.email, editBasicData.phone, users, isAddModalOpen, isEditBasicModalOpen, selectedCandidate]);

    // Personal Data Edit State
    const [editPersonalData, setEditPersonalData] = useState<Partial<User>>({});

    const [newDocData, setNewDocData] = useState({ 
        typeId: '', customName: '', issue_date: new Date().toISOString().split('T')[0], expires_at: '', indefinite: false, files: [] as File[] 
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });
    const [docsViewMode, setDocsViewMode] = useState<'active' | 'archived'>('active');
    const [docSearch, setDocSearch] = useState('');

    useEffect(() => {
        if (location.state && (location.state as any).openAddCandidate) {
             setIsSelectionModalOpen(true);
             window.history.replaceState({}, document.title);
        }
    }, [location]);

    useEffect(() => {
        if (selectedCandidate) {
            setEditPersonalData({
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
                bank_account: selectedCandidate.bank_account || '',
                nip: selectedCandidate.nip || ''
            });

            setEditBasicData({
                first_name: selectedCandidate.first_name || '',
                last_name: selectedCandidate.last_name || '',
                email: selectedCandidate.email || '',
                phone: selectedCandidate.phone || '',
                target_position: selectedCandidate.target_position || '',
                source: selectedCandidate.source || ''
            });
            setEditCVFile(null);
        }
    }, [selectedCandidate]);

    const filteredCandidates = useMemo(() => {
        return users.filter(u => {
            if (u.role !== Role.CANDIDATE) return false;
            if (u.status === UserStatus.TRIAL || u.status === UserStatus.ACTIVE || u.status === UserStatus.INACTIVE) return false;
            if (viewMode === 'active' && u.status === UserStatus.REJECTED) return false;
            if (viewMode === 'archived' && u.status !== UserStatus.REJECTED) return false;
            const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
            const matchesSearch = (u.first_name + ' ' + u.last_name).toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [users, statusFilter, search, viewMode]);

    const isDataComplete = (data: Partial<User>) => {
        const required = ['pesel', 'birth_date', 'citizenship', 'document_number', 'zip_code', 'city', 'street', 'house_number', 'bank_account'];
        return required.every(field => !!(data as any)[field] && (data as any)[field].toString().trim().length > 0);
    };

    const handleAddCandidateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (validationErrors.email || validationErrors.phone) return;
        
        setIsSubmitting(true);
        try {
            const addedCandidate = await addCandidate({
                first_name: newCandidateData.first_name,
                last_name: newCandidateData.last_name,
                email: newCandidateData.email,
                phone: newCandidateData.phone,
                target_position: newCandidateData.target_position,
                source: newCandidateData.source,
                role: Role.CANDIDATE,
                status: UserStatus.STARTED,
                hired_date: new Date().toISOString()
            });

            if (newCandidateData.cvFile) {
                const cvUrl = await uploadDocument(newCandidateData.cvFile, addedCandidate.id);
                if (cvUrl) {
                    await updateUser(addedCandidate.id, { resume_url: cvUrl });
                }
            }

            setIsAddModalOpen(false);
            setNewCandidateData({ first_name: '', last_name: '', email: '', phone: '', target_position: '', source: 'OLX', cvFile: null });
            triggerNotification('success', 'Dodano kandydata', `Pomyślnie dodano kandydata ${addedCandidate.first_name} ${addedCandidate.last_name}.`);
        } catch (err: any) {
            alert('Błąd podczas dodawania kandydata: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditBasicSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate || validationErrors.email || validationErrors.phone) return;

        setIsSubmitting(true);
        try {
            const updates: any = { ...editBasicData };
            
            if (editCVFile) {
                const cvUrl = await uploadDocument(editCVFile, selectedCandidate.id);
                if (cvUrl) {
                    updates.resume_url = cvUrl;
                }
            }

            await updateUser(selectedCandidate.id, updates);
            setSelectedCandidate({ ...selectedCandidate, ...updates });
            await logCandidateAction(selectedCandidate.id, 'Zaktualizowano podstawowe dane kandydata');
            setIsEditBasicModalOpen(false);
            setEditCVFile(null);
            triggerNotification('success', 'Zapisano zmiany', 'Dane podstawowe kandydata zostały zaktualizowane.');
        } catch (err: any) {
            alert('Błąd podczas zapisywania danych: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAIImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPdf) {
                setIsSelectionModalOpen(false);
                setNewCandidateData({ first_name: '', last_name: '', email: '', phone: '', target_position: '', source: 'Import z CV (Ręczny)', cvFile: file });
                setIsAddModalOpen(true);
                triggerNotification('info', 'Format dokumentu', 'Dokumenty Word nie są wspierane przez analizę AI. Proszę uzupełnić dane ręcznie.');
                return;
            }
            setIsAILoading(true);
            try {
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                });
                reader.readAsDataURL(file);
                const base64Data = await base64Promise;
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                const posNames = positions.map(p => p.name).join(', ');
                
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: 'application/pdf', data: base64Data } },
                            { text: `Extract candidate details from this resume. Return a JSON object with fields: first_name, last_name, email, phone (formatted with +48), target_position (must be one of: ${posNames}). If a field is not found, use an empty string.` }
                        ]
                    },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                first_name: { type: Type.STRING },
                                last_name: { type: Type.STRING },
                                email: { type: Type.STRING },
                                phone: { type: Type.STRING },
                                target_position: { type: Type.STRING }
                            },
                            required: ["first_name", "last_name", "email", "phone", "target_position"]
                        }
                    }
                });
                const result = JSON.parse(response.text || '{}');
                setNewCandidateData({ first_name: result.first_name || '', last_name: result.last_name || '', email: result.email || '', phone: result.phone ? formatPhone(result.phone) : '', target_position: positions.some(p => p.name === result.target_position) ? result.target_position : '', source: 'Import z CV (AI)', cvFile: file });
                setIsSelectionModalOpen(false);
                setIsAddModalOpen(true);
                triggerNotification('success', 'AI Przetworzyło CV', 'Dane zostały wyodrębnione i uzupełnione w formularzu.');
            } catch (err) {
                console.error('AI Import error:', err);
                setIsSelectionModalOpen(false);
                setNewCandidateData(prev => ({ ...prev, cvFile: file, source: 'Import z CV (Błąd AI)' }));
                setIsAddModalOpen(true); 
                triggerNotification('info', 'Problem z AI', 'Nie udało się przeanalizować CV automatycznie. Proszę uzupełnić dane ręcznie.');
            } finally {
                setIsAILoading(false);
                if (aiFileInputRef.current) aiFileInputRef.current.value = '';
            }
        }
    };

    const handleSavePersonalData = async () => {
        if (!selectedCandidate) return;
        setIsSubmitting(true);
        try {
            const dataToSave = { ...editPersonalData };
            if (isDataComplete(dataToSave) && [UserStatus.DATA_REQUESTED, UserStatus.STARTED, UserStatus.TESTS_COMPLETED, UserStatus.TESTS_IN_PROGRESS].includes(selectedCandidate.status)) {
                (dataToSave as any).status = UserStatus.DATA_SUBMITTED;
                await logCandidateAction(selectedCandidate.id, 'HR uzupełnił komplet danych (Status -> Dane OK)');
            }
            await updateUser(selectedCandidate.id, dataToSave);
            triggerNotification('success', 'Zapisano', 'Dane osobowе zostały zaktualizowane.');
            setSelectedCandidate({ ...selectedCandidate, ...dataToSave });
        } catch (err) {
            alert('Błąd podczas zapisu danych.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleHireToTrial = async () => {
        if (!selectedCandidate) return;
        
        // Walidacja czy dane osobowe są kompletne - teraz z powiadomieniem toast
        if (!isDataComplete(selectedCandidate)) {
            return triggerNotification('error', 'Błąd Zatrudnienia', 'Nie można zatrudnić kandydata bez kompletnych danych osobowych.');
        }
        
        setTrialDates({
            start: new Date().toISOString().split('T')[0],
            end: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
            brigadirId: selectedCandidate.assigned_brigadir_id || ''
        });
        setIsTrialModalOpen(true);
    };

    const confirmTrialHiring = async () => {
        if (!selectedCandidate) return;
        if (!trialDates.brigadirId) {
            return triggerNotification('info', 'Wymagane Przypisanie', 'Wybierz brygadzistę, do którego ma zostać przypisany pracownik.');
        }

        setIsSubmitting(true);
        try {
            await updateUser(selectedCandidate.id, { 
                status: UserStatus.TRIAL, 
                role: Role.EMPLOYEE, 
                hired_date: trialDates.start, 
                trial_end_date: trialDates.end,
                assigned_brigadir_id: trialDates.brigadirId
            });
            await logCandidateAction(selectedCandidate.id, `Zatrudniono na okres próbny: ${trialDates.start} - ${trialDates.end}. Brygadzista: ${users.find(u => u.id === trialDates.brigadirId)?.last_name}`);
            triggerNotification('success', 'Zatrudniono', `Pracownik ${selectedCandidate.first_name} ${selectedCandidate.last_name} rozpoczął okres próbny.`);
            setIsTrialModalOpen(false);
            setSelectedCandidate(null); 
        } catch (err) {
            alert("Błąd podczas zatrudniania.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDocStatusChange = async (docId: string, newStatus: SkillStatus) => {
        await updateUserSkillStatus(docId, newStatus);
        setStatusPopoverDocId(null);
    };

    const handleAddDocument = () => {
        setNewDocData({ typeId: '', customName: '', issue_date: new Date().toISOString().split('T')[0], expires_at: '', indefinite: false, files: [] as File[] });
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
        if(!selectedCandidate) return;
        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;
        if (!docName) return alert("Podaj nazwę dokumentu.");
        if (newDocData.files.length === 0) return alert("Załącz przynajmniej jeden plik.");
        setIsSubmitting(true);
        try {
            const uploadedUrls: string[] = [];
            for (const file of newDocData.files) {
                const url = await uploadDocument(file, selectedCandidate.id);
                if (url) uploadedUrls.push(url);
            }
            await addCandidateDocument(selectedCandidate.id, { custom_name: docName, custom_type: 'doc_generic', issue_date: newDocData.issue_date, expires_at: newDocData.indefinite ? null : (newDocData.expires_at || null), is_indefinite: newDocData.indefinite, document_urls: uploadedUrls, document_url: uploadedUrls[0], bonus_value: bonus, status: SkillStatus.PENDING });
            setIsDocModalOpen(false);
            triggerNotification('success', 'Dokument dodany', 'Pomyślnie przesłano dokument kandydata.');
        } catch (err) {
            alert('Błąd podczas dodawania dokumentu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusChange = async (newStatus: UserStatus) => {
        if (!selectedCandidate) return;
        await updateUser(selectedCandidate.id, { status: newStatus });
        await logCandidateAction(selectedCandidate.id, `Zmieniono status na: ${CANDIDATE_DISPLAY_LABELS[newStatus]}`);
        setSelectedCandidate({ ...selectedCandidate, status: newStatus });
        setIsStatusPopoverOpen(false);
    };

    const handleContractChange = async (type: ContractType) => {
        if (!selectedCandidate) return;
        await updateUser(selectedCandidate.id, { contract_type: type });
        setSelectedCandidate({ ...selectedCandidate, contract_type: type });
        setIsContractPopoverOpen(false);
    };

    const handleStudentToggle = async (val: boolean) => {
        if (!selectedCandidate) return;
        await updateUser(selectedCandidate.id, { is_student: val });
        setSelectedCandidate({ ...selectedCandidate, is_student: val });
    };

    const renderDetail = () => {
        if (!selectedCandidate) return null;

        const candidateSkills = userSkills.filter(us => us.user_id === selectedCandidate.id);
        const salaryInfo = calculateSalary(
            selectedCandidate.base_rate || systemConfig.baseRate,
            skills,
            candidateSkills.filter(us => !us.is_archived),
            { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
            new Date(),
            []
        );

        const contractType = selectedCandidate.contract_type || ContractType.UOP;
        const contractBonus = systemConfig.contractBonuses[contractType] || 0;
        const studentBonus = (contractType === ContractType.UZ && selectedCandidate.is_student) ? 3 : 0;
        const totalExtras = contractBonus + studentBonus;
        const totalRate = salaryInfo.total + totalExtras;

        const candidateAttempts = testAttempts.filter(ta => ta.user_id === selectedCandidate.id);
        const dataReady = isDataComplete(selectedCandidate);
        const canHire = (dataReady || selectedCandidate.status === UserStatus.DATA_SUBMITTED) && selectedCandidate.status !== UserStatus.REJECTED;
        const isRejected = selectedCandidate.status === UserStatus.REJECTED;

        return (
            <div className="animate-in fade-in duration-500 pb-20" onClick={() => { setIsStatusPopoverOpen(false); setIsContractPopoverOpen(false); setStatusPopoverDocId(null); }}>
                <button onClick={() => setSelectedCandidate(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-4 transition-colors group">
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform"/> Wróć do listy
                </button>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6 relative">
                    <button 
                        onClick={() => setIsEditBasicModalOpen(true)}
                        className="absolute top-5 right-5 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edytuj dane podstawowe"
                    >
                        <Edit size={20} />
                    </button>

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="flex gap-4 items-center">
                            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-black shadow-inner">
                                {selectedCandidate.first_name?.[0]}{selectedCandidate.last_name?.[0]}
                            </div>
                            <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-lg font-black text-slate-900 tracking-tight">{selectedCandidate.first_name} {selectedCandidate.last_name}</h1>
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setIsStatusPopoverOpen(!isStatusPopoverOpen); }}
                                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1 transition-all hover:brightness-95 ${CANDIDATE_DISPLAY_COLORS[selectedCandidate.status] || 'bg-slate-100 text-slate-600'}`}
                                        >
                                            {CANDIDATE_DISPLAY_LABELS[selectedCandidate.status] || selectedCandidate.status.toUpperCase()}
                                            <ChevronDown size={10} />
                                        </button>
                                        {isStatusPopoverOpen && (
                                            <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-200 shadow-xl rounded-lg z-[110] py-1 animate-in zoom-in-95 duration-150">
                                                {Object.entries(CANDIDATE_DISPLAY_LABELS).map(([status, label]) => (
                                                    <button 
                                                        key={status} 
                                                        className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition-colors uppercase"
                                                        onClick={() => handleStatusChange(status as UserStatus)}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 items-center font-medium">
                                    <span>{selectedCandidate.email}</span>
                                    <span>{selectedCandidate.phone || '+48 000 000 000'}</span>
                                    <span className="text-slate-400 font-bold">({selectedCandidate.source || 'Pracuj.pl'})</span>
                                </div>
                                
                                <div className="mt-1">
                                    <button 
                                        onClick={() => selectedCandidate.resume_url && setFileViewer({ isOpen: true, urls: [selectedCandidate.resume_url], title: 'CV - ' + selectedCandidate.first_name, index: 0 })}
                                        disabled={!selectedCandidate.resume_url}
                                        className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${selectedCandidate.resume_url ? 'text-blue-600 hover:text-blue-800' : 'text-slate-300 cursor-not-allowed'}`}
                                    >
                                        <FileText size={14}/>
                                        CV {selectedCandidate.resume_url ? '' : '(Brak)'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 ml-auto lg:ml-0 pr-10">
                            {!isRejected && ![UserStatus.DATA_SUBMITTED, UserStatus.TRIAL, UserStatus.ACTIVE].includes(selectedCandidate.status) && (
                                selectedCandidate.status === UserStatus.DATA_REQUESTED ? (
                                    <Button variant="outline" className="h-9 px-3 text-xs font-bold border-blue-600 text-blue-600 hover:bg-blue-50" onClick={() => triggerNotification('info', 'Przypomnienie', 'Wysłano przypomnienie o uzupełnieniu danych.')}>
                                        <Clock size={14} className="mr-2"/> Oczekiwanie na dane (Przypomnij)
                                    </Button>
                                ) : (
                                    <Button variant="primary" className="h-9 px-3 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleStatusChange(UserStatus.DATA_REQUESTED)}>
                                        <FileText size={14} className="mr-2"/> Poproś o dane
                                    </Button>
                                )
                            )}

                            {canHire && selectedCandidate.status !== UserStatus.TRIAL && selectedCandidate.status !== UserStatus.ACTIVE && (
                                <Button className="h-9 px-3 text-xs font-black uppercase tracking-tighter bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 rounded-lg" onClick={handleHireToTrial}>
                                    <UserCheck size={14} className="mr-1.5"/> Zatrudnij na okres próbny
                                </Button>
                            )}

                            {isRejected ? (
                                <Button 
                                    variant="primary" 
                                    className="h-9 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10" 
                                    onClick={() => {
                                        const nextStatus = candidateAttempts.length > 0 ? UserStatus.TESTS_COMPLETED : UserStatus.STARTED;
                                        handleStatusChange(nextStatus);
                                    }}
                                >
                                    <RotateCcw size={14} className="mr-2"/> Przywróć
                                </Button>
                            ) : (
                                <Button 
                                    variant="danger" 
                                    className="h-9 px-3 text-xs font-bold shadow-md shadow-red-600/10" 
                                    onClick={() => handleStatusChange(UserStatus.REJECTED)}
                                >
                                    <XCircle size={14} className="mr-2"/> Odrzuć
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="flex border-b border-slate-200 bg-white px-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        {[
                            { id: 'info', label: 'Info' },
                            { id: 'personal', label: 'Dane Osobowe' },
                            { id: 'salary', label: 'Symulacja Wynagrodzenia' },
                            { id: 'tests', label: 'Historia Testów' },
                            { id: 'docs', label: 'Dokumenty' },
                            { id: 'history', label: 'Historia Działań' }
                        ].map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`py-3.5 px-4 font-bold text-xs border-b-4 transition-all whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600 bg-blue-50/20' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="p-6">
                        {activeTab === 'info' && (
                            <div className="space-y-6">
                                <div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Notatki Rekrutacyjne</h3><textarea className="w-full border border-slate-200 rounded-xl p-4 bg-slate-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-blue-500/10 shadow-inner min-h-[150px] text-sm" placeholder="Wpisz notatki..." value={selectedCandidate.notes || ''} onChange={(e) => updateUser(selectedCandidate.id, { notes: e.target.value })} /></div>
                            </div>
                        )}
                        {activeTab === 'personal' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <h3 className="font-black text-slate-800 flex items-center gap-2 border-b pb-2 uppercase text-[10px] tracking-widest"><UserIcon size={16} className="text-blue-600"/> Dane podstawowe</h3>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">PESEL</label>
                                                <input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.pesel} onChange={e => { let v = e.target.value.replace(/\D/g, '').slice(0, 11); setEditPersonalData({...editPersonalData, pesel: v}); }} placeholder="00000000000" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Data urodzenia</label>
                                                <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.birth_date} onChange={e => setEditPersonalData({...editPersonalData, birth_date: e.target.value})} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Obywatelstwo</label>
                                                <select className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.citizenship} onChange={e => setEditPersonalData({...editPersonalData, citizenship: e.target.value})}>
                                                    <option value="">Wybierz...</option>
                                                    <option value="Polskie">Polskie</option>
                                                    <option value="Ukraińskie">Ukraińskie</option>
                                                    <option value="Białoruskie">Białoruskie</option>
                                                    <option value="Inne">Inne</option>
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-black text-slate-400 uppercase">Typ Dokumentu</label>
                                                    <select className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.document_type} onChange={e => setEditPersonalData({...editPersonalData, document_type: e.target.value})}>
                                                        <option value="Dowód osobisty">Dowód osobisty</option>
                                                        <option value="Paszport">Paszport</option>
                                                        <option value="Karta Pobytu">Karta Pobytu</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-black text-slate-400 uppercase">Nr Dokumentu</label>
                                                    <input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.document_number} onChange={e => setEditPersonalData({...editPersonalData, document_number: e.target.value})} placeholder="ABC 123456" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="font-black text-slate-800 flex items-center gap-2 border-b pb-2 uppercase text-[10px] tracking-widest"><MapPin size={16} className="text-blue-600"/> Adres i Finanse</h3>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">ULICA</label>
                                                <input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.street} onChange={e => setEditPersonalData({...editPersonalData, street: e.target.value})} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase">Nr Domu</label>
                                                    <input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.house_number} onChange={e => setEditPersonalData({...editPersonalData, house_number: e.target.value})} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase">Nr Lokalu</label>
                                                    <input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.apartment_number} onChange={e => setEditPersonalData({...editPersonalData, apartment_number: e.target.value})} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="col-span-1 space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Kod Pocztowy</label><input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.zip_code} onChange={handleZipCodeChange} placeholder="00-000" /></div>
                                                <div className="col-span-2 space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Miasto</label><input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.city} onChange={e => setEditPersonalData({...editPersonalData, city: e.target.value})} /></div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">KONTO BANKOWE</label>
                                                <input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold font-mono bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.bank_account} onChange={handleBankAccountChange} placeholder="00 0000 0000..." />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">NIP (Opcjonalnie)</label>
                                                <input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-all outline-none shadow-inner" value={editPersonalData.nip} onChange={e => setEditPersonalData({...editPersonalData, nip: e.target.value.replace(/\D/g, '').slice(0, 10)})} placeholder="0000000000" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 pt-4 border-t flex justify-end">
                                    <Button onClick={handleSavePersonalData} disabled={isSubmitting} className="px-8 font-black uppercase text-xs tracking-widest rounded-xl h-11">
                                        {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                                        Zapisz dane
                                    </Button>
                                </div>
                            </div>
                        )}
                        {activeTab === 'salary' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">BAZA</div>
                                        <div className="text-2xl font-black text-slate-900">{salaryInfo.breakdown.base} zł</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
                                        <div className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">UMIEJĘTNOŚCI</div>
                                        <div className="text-2xl font-black text-green-600">+{salaryInfo.breakdown.skills.toFixed(2)} zł</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
                                        <div className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">UPRAWNIENIA</div>
                                        <div className="text-2xl font-black text-purple-600">+{salaryInfo.breakdown.monthly.toFixed(2)} zł</div>
                                    </div>
                                    <div className="relative">
                                        <div 
                                            className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm text-center flex flex-col justify-center min-h-[110px] cursor-pointer hover:bg-blue-50 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); setIsContractPopoverOpen(!isContractPopoverOpen); }}
                                        >
                                            <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">FORMA UMOWY</div>
                                            <div className="text-sm font-black text-blue-700 flex items-center justify-center gap-1">
                                                {CONTRACT_TYPE_LABELS[selectedCandidate.contract_type || ContractType.UOP]}
                                                <ChevronDown size={14} />
                                            </div>
                                            <div className="text-[9px] text-blue-400 font-bold mt-1">{totalExtras > 0 ? `+${totalExtras.toFixed(2)} zł` : 'Bez dodatku'}</div>
                                        </div>
                                        {isContractPopoverOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl z-[200] py-1 flex flex-col animate-in slide-in-from-top-2 duration-200 overflow-hidden">
                                                {Object.values(ContractType).map((type) => (
                                                    <button key={type} className="px-4 py-2.5 text-[11px] font-bold text-left hover:bg-blue-50 text-slate-700 transition-colors" onClick={() => handleContractChange(type)}>
                                                        {CONTRACT_TYPE_LABELS[type]}
                                                    </button>
                                                ))}
                                                <div className="border-t border-slate-100 my-1"></div>
                                                <div className="px-4 py-2 flex items-center justify-between bg-slate-50/50">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Student &lt; 26 lat</span>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedCandidate.is_student} 
                                                        onChange={(e) => handleStudentToggle(e.target.checked)}
                                                        className="w-4 h-4 text-blue-600 rounded" 
                                                    />
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
                        {activeTab === 'tests' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[9px] tracking-widest border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-3.5">Test</th>
                                                <th className="px-6 py-3.5 text-center">Wynik</th>
                                                <th className="px-6 py-3.5 text-center">Status</th>
                                                <th className="px-6 py-3.5 text-center">Data</th>
                                                <th className="px-6 py-3.5 text-right">Akcje</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {candidateAttempts.map(ta => {
                                                const test = tests.find(t => t.id === ta.test_id);
                                                return (
                                                    <tr key={ta.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-800">{test?.title || 'Nieznany test'}</td>
                                                        <td className="px-6 py-4 text-center font-black text-sm">{ta.score}%</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${ta.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {ta.passed ? 'ZALICZONY' : 'NIEZALICZONY'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-slate-500 font-medium">{new Date(ta.completed_at).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button 
                                                                onClick={() => { if(confirm('Zresetować to podejście?')) resetTestAttempt(ta.test_id, selectedCandidate.id); }}
                                                                className="text-slate-400 hover:text-red-500 font-bold text-[10px] uppercase tracking-widest hover:underline"
                                                            >
                                                                Resetuj
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {candidateAttempts.length === 0 && (
                                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold italic text-sm">Brak rozwiązanych testów.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {activeTab === 'docs' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="relative w-56">
                                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={14} />
                                        <input type="text" placeholder="Szukaj..." className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-xs outline-none shadow-inner" value={docSearch} onChange={e => setDocSearch(e.target.value)} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" className="h-8 px-3 text-xs font-bold border-slate-300" onClick={() => setDocsViewMode(prev => prev === 'active' ? 'archived' : 'active')}>
                                            {docsViewMode === 'active' ? <><Archive size={14} className="mr-1.5"/> Archiwum</> : <><RotateCcw size={14} className="mr-1.5"/> Aktywne</>}
                                        </Button>
                                        <Button className="bg-blue-600 h-8 px-3 text-xs font-bold shadow-md shadow-blue-600/10" onClick={handleAddDocument}>
                                            <Plus size={14} className="mr-1.5"/> Dodaj Dokument
                                        </Button>
                                    </div>
                                </div>
                                <div className="border border-slate-100 rounded-xl shadow-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[9px] tracking-widest border-b border-slate-100">
                                            <tr><th className="px-6 py-3.5">Dokument</th><th className="px-6 py-3.5">Status</th><th className="px-6 py-3.5 text-center">Bonus</th><th className="px-6 py-3.5">Ważność</th><th className="px-6 py-3.5 text-right">Akcje</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {candidateSkills.filter(us => {
                                                if (docsViewMode === 'active' ? us.is_archived : !us.is_archived) return false;
                                                const s = skills.find(sk => sk.id === us.skill_id);
                                                const isDoc = s?.verification_type === VerificationType.DOCUMENT || !!us.custom_type || (typeof us.skill_id === 'string' && us.skill_id.startsWith('doc_')) || !us.skill_id;
                                                if (!isDoc) return false;
                                                if (docSearch && !((us.custom_name || s?.name_pl || '').toLowerCase().includes(docSearch.toLowerCase()))) return false;
                                                return true;
                                            }).map(doc => {
                                                const skill = skills.find(sk => sk.id === doc.skill_id);
                                                const bonus = skill ? skill.hourly_bonus : (doc.bonus_value || 0);
                                                return (
                                                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-6 py-4 font-bold text-slate-700">{doc.custom_name || skill?.name_pl || 'Dokument'}</td>
                                                        <td className={`px-6 py-4 relative ${statusPopoverDocId === doc.id ? 'z-[500]' : ''}`} onClick={(e) => { e.stopPropagation(); setStatusPopoverDocId(doc.id); }}>
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border cursor-pointer hover:scale-105 transition-transform ${doc.status === SkillStatus.CONFIRMED ? 'bg-green-50 text-green-700 border-green-100' : doc.status === SkillStatus.FAILED ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'}`}>
                                                                {SKILL_STATUS_LABELS[doc.status]}
                                                            </span>
                                                            {statusPopoverDocId === doc.id && (
                                                                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-200 shadow-2xl rounded-lg z-[9999] py-1 animate-in zoom-in-95 duration-150">
                                                                    <button className="w-full px-3 py-2 text-[10px] font-bold text-left hover:bg-slate-50 text-slate-700 uppercase" onClick={() => handleDocStatusChange(doc.id, SkillStatus.PENDING)}>Oczekuje</button>
                                                                    <button className="w-full px-3 py-2 text-[10px] font-bold text-left hover:bg-green-50 text-green-700 uppercase" onClick={() => handleDocStatusChange(doc.id, SkillStatus.CONFIRMED)}>Zatwierdź</button>
                                                                    <button className="w-full px-3 py-2 text-[10px] font-bold text-left hover:bg-red-50 text-red-700 uppercase" onClick={() => handleDocStatusChange(doc.id, SkillStatus.FAILED)}>Odrzuć</button>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-black text-green-600">+{bonus.toFixed(2)} zł</td>
                                                        <td className="px-6 py-4 text-slate-500 font-medium">{doc.is_indefinite ? 'Bezterminowy' : (doc.expires_at || '-')}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-1.5">
                                                                <button onClick={() => setFileViewer({ isOpen: true, urls: doc.document_urls || [doc.document_url!], title: doc.custom_name || 'Dokument', index: 0 })} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Eye size={16}/></button>
                                                                {docsViewMode === 'active' ? (
                                                                    <button onClick={() => archiveCandidateDocument(doc.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                                                                ) : (
                                                                    <button onClick={() => restoreCandidateDocument(doc.id)} className="p-1.5 text-slate-400 hover:text-green-600 transition-colors"><RotateCcw size={16}/></button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }).length === 0 && (
                                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold italic text-sm">Brak dokumentów.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {activeTab === 'history' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Historia Działań</h3>
                                <div className="space-y-4">
                                    {state.candidateHistory.filter(h => h.candidate_id === selectedCandidate.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(h => (
                                        <div key={h.id} className="flex gap-4 p-3 border-b border-slate-100 last:border-0 rounded-lg transition-colors">
                                            <div className="text-slate-400 text-xs w-24 flex-shrink-0 pt-1">
                                                <div className="font-mono">{new Date(h.created_at).toLocaleDateString()}</div>
                                                <div className="font-mono">{new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">{h.action}</div>
                                                <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Wykonawca: {h.performed_by}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {state.candidateHistory.filter(h => h.candidate_id === selectedCandidate.id).length === 0 && (
                                        <p className="text-slate-400 text-sm italic py-8 text-center">Brak wpisów w historii.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Helper functions for mask inputs
    const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) val = val.slice(0, 5);
        if (val.length > 2) val = val.slice(0, 2) + '-' + val.slice(2);
        setEditPersonalData({ ...editPersonalData, zip_code: val });
    };

    const handleBankAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 26) val = val.slice(0, 26);
        val = val.replace(/(.{4})/g, '$1 ').trim();
        setEditPersonalData({ ...editPersonalData, bank_account: val });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
             {selectedCandidate ? renderDetail() : (
                <>
                    <div className="flex justify-between items-start mb-8">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kandydaci</h1>
                        <div className="flex gap-2">
                            <button className="h-10 px-4 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-bold rounded-lg shadow-sm flex items-center" onClick={() => setViewMode(viewMode === 'active' ? 'archived' : 'active')}>
                                <Archive size={18} className="mr-2" /> {viewMode === 'active' ? 'Archiwum' : 'Aktywni'}
                            </button>
                            <button className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md flex items-center gap-2" onClick={() => setIsSelectionModalOpen(true)}>
                                <UserPlus size={18} /> Dodaj Kandydata
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-8">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                type="text" 
                                placeholder="Szukaj kandydata..." 
                                className="w-full pl-12 pr-4 py-3 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium placeholder:text-slate-400 shadow-inner" 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                            />
                        </div>
                        <div className="relative min-w-[200px]">
                            <select 
                                className="w-full h-full appearance-none bg-white border border-slate-200 px-4 py-2 rounded-lg text-slate-700 font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer pr-10 shadow-sm"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                            >
                                <option value="all">Wszystkie Statusy</option>
                                {Object.values(UserStatus).filter(s => !s.includes('active') && !s.includes('trial')).map(s => <option key={s} value={s}>{CANDIDATE_DISPLAY_LABELS[s] || s.toUpperCase()}</option>)}
                            </select>
                            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-5">Imię i Nazwisko</th>
                                    <th className="px-6 py-5">Stanowisko</th>
                                    <th className="px-6 py-5">Kontakt</th>
                                    <th className="px-6 py-5">Status</th>
                                    <th className="px-6 py-5">Stawka</th>
                                    <th className="px-6 py-5">Źródło</th>
                                    <th className="px-6 py-4 text-right">Akcje</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredCandidates.map(candidate => (
                                    <tr key={candidate.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors group" onClick={() => setSelectedCandidate(candidate)}>
                                        <td className="px-6 py-6 font-bold text-slate-900">{candidate.first_name} {candidate.last_name}</td>
                                        <td className="px-6 py-6 text-slate-400 font-medium">{candidate.target_position || '-'}</td>
                                        <td className="px-6 py-6">
                                            <div className="text-slate-700 font-medium text-xs">{candidate.email}</div>
                                            <div className="text-slate-400 text-[10px] mt-0.5">{candidate.phone || 'Brak telefonu'}</div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter shadow-sm border border-transparent ${CANDIDATE_DISPLAY_COLORS[candidate.status] || 'bg-slate-100 text-slate-600'}`}>
                                                {CANDIDATE_DISPLAY_LABELS[candidate.status] || candidate.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 font-black text-slate-900 text-sm">
                                            {(() => {
                                                const cs = userSkills.filter(us => us.user_id === candidate.id && !us.is_archived);
                                                const s = calculateSalary(candidate.base_rate || systemConfig.baseRate, skills, cs, { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 });
                                                const ct = candidate.contract_type || ContractType.UOP;
                                                const cb = systemConfig.contractBonuses[ct] || 0;
                                                const sb = (ct === ContractType.UZ && candidate.is_student) ? 3 : 0;
                                                return (s.total + cb + sb).toFixed(0);
                                            })()} zł/h
                                        </td>
                                        <td className="px-6 py-6 text-slate-400 font-bold text-xs">{candidate.source || 'Pracuj.pl'}</td>
                                        <td className="px-6 py-6 text-right">
                                            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all inline" />
                                        </td>
                                    </tr>
                                ))}
                                {filteredCandidates.length === 0 && <tr><td colSpan={7} className="p-20 text-center text-slate-400 font-black italic">Brak kandydatów pasujących do filtrów.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
             )}
            
            {/* Selection Modal */}
            {isSelectionModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-200 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !isAILoading && setIsSelectionModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-lg w-full overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Dodaj Nowego Kandydata</h3>
                            <button onClick={() => !isAILoading && setIsSelectionModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 space-y-4 relative">
                            {isAILoading && (
                                <div className="absolute inset-0 bg-white/80 z-[201] flex flex-col items-center justify-center animate-in fade-in">
                                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="font-bold text-slate-800">AI analizuje dokument...</p>
                                </div>
                            )}

                            {/* Button: Manual */}
                            <button 
                                onClick={() => { setIsSelectionModalOpen(false); setIsAddModalOpen(true); }} 
                                className="w-full flex items-center gap-5 p-6 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all text-left group shadow-sm"
                            >
                                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform shadow-inner flex-shrink-0">
                                    <Edit size={28} />
                                </div>
                                <div>
                                    <div className="font-black text-slate-900 text-lg uppercase tracking-tight">DODAJ RĘCZNIE</div>
                                    <div className="text-sm text-slate-500 font-medium mt-0.5">Wypełnij formularz z danymi kandydata.</div>
                                </div>
                            </button>

                            {/* Button: AI Import */}
                            <button 
                                onClick={() => aiFileInputRef.current?.click()} 
                                className="w-full flex items-center gap-5 p-6 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all text-left group shadow-sm bg-blue-50/20"
                            >
                                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white group-hover:scale-105 transition-transform shadow-lg flex-shrink-0">
                                    <Sparkles size={28} />
                                </div>
                                <div>
                                    <div className="font-black text-slate-900 text-lg uppercase tracking-tight">IMPORTUJ Z CV (AI)</div>
                                    <div className="text-sm text-slate-500 font-medium mt-0.5">
                                        Automatyczne uzupełnienie danych.
                                        <div className="text-blue-600 font-bold">(tylko pliki PDF)</div>
                                    </div>
                                </div>
                                <input type="file" ref={aiFileInputRef} className="hidden" accept=".pdf,.doc,.docx" onChange={handleAIImport} />
                            </button>

                            {/* Button: Invite */}
                            <button 
                                onClick={() => { setIsSelectionModalOpen(false); setIsInviteModalOpen(true); }} 
                                className="w-full flex items-center gap-5 p-6 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all text-left group shadow-sm"
                            >
                                <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform shadow-inner flex-shrink-0">
                                    <Send size={28} />
                                </div>
                                <div>
                                    <div className="font-black text-slate-900 text-lg uppercase tracking-tight">GENERUJ LINK ZAPROSZENIA</div>
                                    <div className="text-sm text-slate-500 font-medium mt-0.5">Wyślij link do samodzielnej rejestracji.</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Basic Data Modal */}
            {isEditBasicModalOpen && selectedCandidate && (
                <div className="fixed inset-0 bg-black/60 z-[210] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsEditBasicModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-md w-full overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Edytuj Kandydata</h3>
                            <button onClick={() => setIsEditBasicModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-all"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleEditBasicSubmit} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">IMIĘ</label>
                                    <input 
                                        required
                                        className="w-full border border-slate-200 p-2 rounded-lg font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-inner text-sm" 
                                        value={editBasicData.first_name} 
                                        onChange={e => setEditBasicData({...editBasicData, first_name: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">NAZWISKO</label>
                                    <input 
                                        required
                                        className="w-full border border-slate-200 p-2 rounded-lg font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-inner text-sm" 
                                        value={editBasicData.last_name} 
                                        onChange={e => setEditBasicData({...editBasicData, last_name: e.target.value})} 
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">EMAIL</label>
                                <div className="relative">
                                    <input 
                                        type="email"
                                        required
                                        className={`w-full border p-2 rounded-lg font-bold transition-all shadow-inner outline-none text-sm ${validationErrors.email ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'}`} 
                                        value={editBasicData.email} 
                                        onChange={e => setEditBasicData({...editBasicData, email: e.target.value.toLowerCase()})} 
                                    />
                                    {validationErrors.email && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500">
                                            <AlertTriangle size={14} />
                                        </div>
                                    )}
                                </div>
                                {validationErrors.email && <p className="text-[9px] text-red-500 font-bold ml-1">{validationErrors.email}</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">TELEFON</label>
                                <div className="relative">
                                    <input 
                                        required
                                        className={`w-full border p-2 rounded-lg font-bold transition-all shadow-inner outline-none text-sm ${validationErrors.phone ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'}`} 
                                        value={editBasicData.phone} 
                                        onChange={e => setEditBasicData({...editBasicData, phone: formatPhone(e.target.value)})} 
                                        placeholder="+48 000 000 000"
                                    />
                                    {validationErrors.phone && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500">
                                            <AlertTriangle size={14} />
                                        </div>
                                    )}
                                </div>
                                {validationErrors.phone && <p className="text-[9px] text-red-500 font-bold ml-1">{validationErrors.phone}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">STANOWISKO</label>
                                    <select 
                                        className="w-full border border-slate-200 p-2 rounded-lg font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-inner appearance-none text-sm"
                                        value={editBasicData.target_position}
                                        onChange={e => setEditBasicData({...editBasicData, target_position: e.target.value})}
                                    >
                                        <option value="">Wybierz...</option>
                                        {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ŹRÓDŁO</label>
                                    <select 
                                        className="w-full border border-slate-200 p-2 rounded-lg font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-inner appearance-none text-sm"
                                        value={editBasicData.source}
                                        onChange={e => setEditBasicData({...editBasicData, source: e.target.value})}
                                    >
                                        {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CV / Dokument</label>
                                <div 
                                    className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col items-center justify-center hover:bg-white hover:border-blue-400 transition-all cursor-pointer group"
                                    onClick={() => document.getElementById('cv-edit-upload')?.click()}
                                >
                                    <input 
                                        id="cv-edit-upload"
                                        type="file" 
                                        className="hidden" 
                                        accept=".pdf,.doc,.docx"
                                        onChange={(e) => setEditCVFile(e.target.files?.[0] || null)}
                                    />
                                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 group-hover:text-blue-600 transition-colors mb-1">
                                        {editCVFile || selectedCandidate.resume_url ? <CheckCircle size={18} className="text-green-600"/> : <Upload size={18}/>}
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-600 truncate max-w-full">
                                        {editCVFile ? editCVFile.name : (selectedCandidate.resume_url ? 'CV już wgrane (kliknij by zmienić)' : 'Załącz CV (PDF/DOC)')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="ghost" onClick={() => setIsEditBasicModalOpen(false)} className="px-4 text-sm font-bold text-slate-400">Anuluj</Button>
                                <Button type="submit" disabled={isSubmitting || Object.keys(validationErrors).length > 0} className="px-6 h-10 rounded-lg font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20">
                                    {isSubmitting ? <Loader2 size={14} className="animate-spin mr-2"/> : <Save size={14} className="mr-2"/>}
                                    Zapisz
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Invite Link Modal */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsInviteModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-md w-full p-8 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900">Zaproszenie Kandydata</h3>
                            <button onClick={() => setIsInviteModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">Skopiuj poniższy link i wyślij go do kandydata. Po kliknięciu trafi on na stronę powitalną procesu rekrutacji.</p>
                        <div className="flex gap-2 mb-8">
                            <input readOnly className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-medium text-slate-600 outline-none" value={inviteLink} />
                            <button onClick={() => { navigator.clipboard.writeText(inviteLink); triggerNotification('success', 'Skopiowano', 'Link został zapisany w schowku.'); }} className="h-10 px-4 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                                <Copy size={18} />
                            </button>
                        </div>
                        <Button fullWidth onClick={() => setIsInviteModalOpen(false)}>Zamknij</Button>
                    </div>
                </div>
            )}

            {/* Manual Add Candidate Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[210] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-md w-full overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Nowy Kandydat</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-all"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleAddCandidateSubmit} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">IMIĘ</label>
                                    <input 
                                        required
                                        className="w-full border border-slate-200 p-3 rounded-xl font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-inner text-sm" 
                                        value={newCandidateData.first_name} 
                                        onChange={e => setNewCandidateData({...newCandidateData, first_name: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">NAZWISKO</label>
                                    <input 
                                        required
                                        className="w-full border border-slate-200 p-3 rounded-xl font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-inner text-sm" 
                                        value={newCandidateData.last_name} 
                                        onChange={e => setNewCandidateData({...newCandidateData, last_name: e.target.value})} 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">EMAIL</label>
                                    <div className="relative">
                                        <input 
                                            type="email"
                                            required
                                            className={`w-full border p-3 rounded-xl font-bold transition-all shadow-inner outline-none text-sm ${validationErrors.email ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'}`} 
                                            value={newCandidateData.email} 
                                            onChange={e => setNewCandidateData({...newCandidateData, email: e.target.value.toLowerCase()})} 
                                        />
                                        {validationErrors.email && (
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500">
                                                <AlertTriangle size={14} />
                                            </div>
                                        )}
                                    </div>
                                    {validationErrors.email && <p className="text-[9px] text-red-500 font-bold ml-1">{validationErrors.email}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">TELEFON</label>
                                    <div className="relative">
                                        <input 
                                            required
                                            className={`w-full border p-2 rounded-lg font-bold transition-all shadow-inner outline-none text-sm ${validationErrors.phone ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'}`} 
                                            value={newCandidateData.phone} 
                                            onChange={e => setNewCandidateData({...newCandidateData, phone: formatPhone(e.target.value)})} 
                                            placeholder="+48 000 000 000"
                                        />
                                        {validationErrors.phone && (
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500">
                                                <AlertTriangle size={14} />
                                            </div>
                                        )}
                                    </div>
                                    {validationErrors.phone && <p className="text-[9px] text-red-500 font-bold ml-1">{validationErrors.phone}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">STANOWISKO</label>
                                    <select 
                                        className="w-full border border-slate-200 p-2 rounded-lg font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-inner appearance-none text-sm"
                                        value={newCandidateData.target_position}
                                        onChange={e => setNewCandidateData({...newCandidateData, target_position: e.target.value})}
                                    >
                                        <option value="">Wybierz...</option>
                                        {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ŹRÓDŁO</label>
                                    <select 
                                        className="w-full border border-slate-200 p-2 rounded-lg font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-inner appearance-none text-sm"
                                        value={newCandidateData.source}
                                        onChange={e => setNewCandidateData({...newCandidateData, source: e.target.value})}
                                    >
                                        {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CV</label>
                                <div 
                                    className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col items-center justify-center hover:bg-white hover:border-blue-400 transition-all cursor-pointer group"
                                    onClick={() => document.getElementById('cv-manual-upload')?.click()}
                                >
                                    <input 
                                        id="cv-manual-upload"
                                        type="file" 
                                        className="hidden" 
                                        accept=".pdf,.doc,.docx"
                                        onChange={(e) => setNewCandidateData({...newCandidateData, cvFile: e.target.files?.[0] || null})}
                                    />
                                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 group-hover:text-blue-600 transition-colors mb-1">
                                        {newCandidateData.cvFile ? <CheckCircle size={18} className="text-green-600"/> : <Upload size={18}/>}
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-600 truncate max-w-full">
                                        {newCandidateData.cvFile ? newCandidateData.cvFile.name : 'Załącz CV'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="px-4 text-sm font-bold text-slate-400">Anuluj</Button>
                                <Button type="submit" disabled={isSubmitting || Object.keys(validationErrors).length > 0} className="px-6 h-10 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-600/20">
                                    {isSubmitting ? <Loader2 size={14} className="animate-spin mr-2"/> : <Save size={14} className="mr-2"/>}
                                    Dodaj
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Trial Period Confirmation Modal */}
            {isTrialModalOpen && selectedCandidate && (
                <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-md w-full overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                                <Calendar size={24} className="text-orange-600"/> Okres Próbny
                            </h3>
                            <button onClick={() => setIsTrialModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                Ustal ramy czasowe okresu próbnego dla pracownika <strong className="text-slate-900 font-black">{selectedCandidate.first_name} {selectedCandidate.last_name}</strong>. 
                                Standardowo okres próbny trwa 1 miesiąc.
                            </p>
                            
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">DATA ROZPOCZĘCIA</label>
                                        <div className="relative">
                                            <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                            <input 
                                                type="date"
                                                className="w-full bg-slate-50 border border-slate-200 p-3 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm"
                                                value={trialDates.start}
                                                onChange={(e) => setTrialDates({...trialDates, start: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">DATA ZAKOŃCZENIA</label>
                                        <div className="relative">
                                            <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                            <input 
                                                type="date"
                                                className="w-full bg-slate-50 border border-slate-200 p-3 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm"
                                                value={trialDates.end}
                                                onChange={(e) => setTrialDates({...trialDates, end: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PRZYPISANY BRYGADZISTA</label>
                                    <select 
                                        className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm appearance-none" 
                                        value={trialDates.brigadirId} 
                                        onChange={e => setTrialDates({...trialDates, brigadirId: e.target.value})} 
                                    >
                                        <option value="">Wybierz brygadzistę...</option>
                                        {brigadirsList.map(b => (
                                            <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <Button variant="ghost" fullWidth onClick={() => setIsTrialModalOpen(false)} className="font-bold text-slate-400">Anuluj</Button>
                            <Button fullWidth onClick={confirmTrialHiring} disabled={isSubmitting || !trialDates.brigadirId} className="font-black uppercase text-[11px] tracking-widest h-12 shadow-lg shadow-blue-600/20">
                                {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2"/> : <UserCheck size={16} className="mr-2"/>}
                                Potwierdź zatrudnienie
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Modal */}
            {isDocModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[210] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-md w-full p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Dodaj Dokument</h2>
                            <button onClick={() => setIsDocModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={24}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Typ Dokumentu</label>
                                <select className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 text-sm font-bold text-slate-700 outline-none shadow-inner" value={newDocData.typeId} onChange={e => setNewDocData({...newDocData, typeId: e.target.value})}>
                                    <option value="">Wybierz typ...</option>
                                    {BONUS_DOCUMENT_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                                    <option value="other">Inny Dokument</option>
                                </select>
                            </div>
                            {newDocData.typeId === 'other' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nazwa</label>
                                    <input className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 font-bold text-slate-700 outline-none shadow-inner" placeholder="np. Uprawnienia SEP E" value={newDocData.customName} onChange={e => setNewDocData({...newDocData, customName: e.target.value})} />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Załącz Pliki</label>
                                <input type="file" multiple onChange={handleFileSelect} className="w-full border border-slate-200 p-2 rounded-xl bg-slate-50 text-xs font-bold shadow-inner" />
                                <div className="mt-2 space-y-1">
                                    {newDocData.files.map((f, i) => (
                                        <div key={i} className="flex justify-between items-center bg-slate-100 p-1.5 rounded-lg text-[10px] font-bold">
                                            <span className="truncate">{f.name}</span>
                                            <button onClick={() => removeFile(i)} className="text-red-500"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Data Wydania</label>
                                    <input type="date" className="w-full border border-slate-200 p-2 rounded-xl bg-slate-50 text-xs font-bold shadow-inner" value={newDocData.issue_date} onChange={e => setNewDocData({...newDocData, issue_date: e.target.value})} />
                                </div>
                                {!newDocData.indefinite && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Data Ważności</label>
                                        <input type="date" className="w-full border border-slate-200 p-2 rounded-xl bg-slate-50 text-xs font-bold shadow-inner" value={newDocData.expires_at} onChange={e => setNewDocData({...newDocData, expires_at: e.target.value})} />
                                    </div>
                                )}
                            </div>
                            <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer shadow-inner">
                                <input type="checkbox" checked={newDocData.indefinite} onChange={e => setNewDocData({...newDocData, indefinite: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                                <span className="text-[10px] font-black text-slate-500 uppercase">Bezterminowy</span>
                            </label>
                            <Button fullWidth onClick={handleSaveDocument} disabled={!newDocData.typeId || newDocData.files.length === 0 || isSubmitting} className="h-12 font-black text-sm shadow-xl shadow-blue-600/20 rounded-2xl mt-4">
                                {isSubmitting ? <Loader2 size={18} className="animate-spin mr-3"/> : <Save size={18} className="mr-3"/>}
                                ZAPISZ DOKUMENT
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
        </div>
    );
};
