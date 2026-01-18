import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Send, Clock, XCircle, Search, ChevronRight, Download, FileText,
    Plus, Archive, RotateCcw, AlertTriangle, User as UserIcon, Calendar,
    Check, CheckCircle, Edit, Trash2, UserPlus, Briefcase, UserCheck, Eye, X,
    Upload, ChevronDown, Bot, Loader2, Share2, Copy, FileInput, Save,
    Shield, Wallet, Award, Calculator, ChevronLeft, Globe, Mail, Phone, ExternalLink, Activity, Info as InfoIcon, MapPin, Sparkles, Link2, MessageCircle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { User, Role, UserStatus, SkillStatus, VerificationType, CandidateHistoryEntry, ContractType } from '../../types';
import { USER_STATUS_LABELS, SKILL_STATUS_LABELS, CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument, supabase } from '../../lib/supabase';
import { calculateSalary } from '../../services/salaryService';
import { sendTemplatedSMS } from '../../lib/smsService';

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
    const navigate = useNavigate();
    
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
        brigadirId: '',
        frozenRate: 0
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Validation state
    const [validationErrors, setValidationErrors] = useState<{email?: string, phone?: string}>({});

    // Invitation link modal
    const [isInvitationModalOpen, setIsInvitationModalOpen] = useState(false);
    const [invitationLink, setInvitationLink] = useState('');

    // SMS Invitation modal
    const [isSMSInvitationModalOpen, setIsSMSInvitationModalOpen] = useState(false);
    const [smsInvitationData, setSmsInvitationData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        position: '',
        message: ''
    });
    const [isSendingSMS, setIsSendingSMS] = useState(false);

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
                // Read file as base64
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                });
                reader.readAsDataURL(file);
                const base64Data = await base64Promise;

                const posNames = positions.map(p => p.name);

                // Call Supabase Edge Function instead of direct Gemini API
                const { data, error } = await supabase.functions.invoke('parse-cv', {
                    body: {
                        pdfBase64: base64Data,
                        positions: posNames
                    }
                });

                if (error) {
                    console.error('Edge function error:', error);
                    throw error;
                }

                if (!data?.success) {
                    throw new Error(data?.error || 'Failed to parse CV');
                }

                const result = data.data;
                setNewCandidateData({
                    first_name: result.first_name || '',
                    last_name: result.last_name || '',
                    email: result.email || '',
                    phone: result.phone ? formatPhone(result.phone) : '',
                    target_position: positions.some(p => p.name === result.target_position) ? result.target_position : '',
                    source: 'Import z CV (AI)',
                    cvFile: file
                });
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

    const generateInvitationLink = () => {
        const origin = window.location.origin;
        const registrationPath = '/#/candidate/welcome';
        const link = `${origin}${registrationPath}`;
        setInvitationLink(link);
        setIsInvitationModalOpen(true);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(invitationLink);
        triggerNotification('success', 'Skopiowano', 'Link został skopiowany do schowka');
    };

    const shareViaWhatsApp = () => {
        const message = encodeURIComponent(`Zaproszenie do MaxMaster: ${invitationLink}`);
        window.open(`https://wa.me/?text=${message}`, '_blank');
    };

    const shareViaTelegram = () => {
        const message = encodeURIComponent(`Zaproszenie do MaxMaster: ${invitationLink}`);
        window.open(`https://t.me/share/url?url=${invitationLink}&text=${message}`, '_blank');
    };

    const shareViaEmail = () => {
        const subject = encodeURIComponent('Zaproszenie do MaxMaster');
        const body = encodeURIComponent(`Witaj!\n\nZapraszam Cię do zarejestrowania się w systemie MaxMaster.\n\nLink do rejestracji: ${invitationLink}\n\nPozdrawiam`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    const shareViaSMS = () => {
        // Initialize SMS invitation data with template
        const portalUrl = window.location.origin + '/#/candidate/welcome';
        const defaultMessage = `Cześć {imię}, chcemy zaprosić Cię do nas na pracę na stanowisko {stanowisko}. Rekrutacja u nas przebiega zdalnie, przez nasz portal - aby rozpocząć proces rekrutacji, przejdź pod link: ${portalUrl}`;

        setSmsInvitationData({
            firstName: '',
            lastName: '',
            phone: '',
            position: '',
            message: defaultMessage
        });
        setIsInvitationModalOpen(false);
        setIsSMSInvitationModalOpen(true);
    };

    const handleSendSMSInvitation = async () => {
        // Validate fields
        if (!smsInvitationData.firstName || !smsInvitationData.lastName || !smsInvitationData.phone || !smsInvitationData.position) {
            triggerNotification('error', 'Błąd', 'Wypełnij wszystkie pola');
            return;
        }

        setIsSendingSMS(true);
        try {
            // Replace placeholders in message
            const finalMessage = smsInvitationData.message
                .replace(/\{imię\}/g, smsInvitationData.firstName)
                .replace(/\{stanowisko\}/g, smsInvitationData.position);

            // Send SMS
            const result = await sendTemplatedSMS(
                'CAND_INVITE_LINK',
                smsInvitationData.phone,
                {
                    firstName: smsInvitationData.firstName,
                    portalUrl: window.location.origin + '/#/candidate/welcome'
                },
                undefined
            );

            if (result.success) {
                triggerNotification('success', 'SMS wysłany', `Zaproszenie SMS wysłane do ${smsInvitationData.firstName} ${smsInvitationData.lastName}`);
                setIsSMSInvitationModalOpen(false);

                // Log the action
                if (state.currentUser) {
                    await logCandidateAction(
                        state.currentUser.id,
                        `Wysłano SMS zaproszenie do: ${smsInvitationData.firstName} ${smsInvitationData.lastName} (${smsInvitationData.phone})`
                    );
                }
            } else {
                triggerNotification('error', 'Błąd wysyłania SMS', result.error || 'Nie udało się wysłać SMS');
            }
        } catch (error) {
            console.error('Failed to send SMS invitation:', error);
            triggerNotification('error', 'Błąd', 'Nie udało się wysłać zaproszenia SMS');
        } finally {
            setIsSendingSMS(false);
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

        if (!isDataComplete(selectedCandidate)) {
            return triggerNotification('error', 'Błąd Zatrudnienia', 'Nie można zatrudnić kandydata bez kompletnych danych osobowych.');
        }

        // Calculate current rate to freeze it during trial period
        const candidateTestAttempts = testAttempts.filter(ta => ta.user_id === selectedCandidate.id);
        let skillsBonus = 0;
        const countedSkillIds = new Set<string>();

        candidateTestAttempts.forEach(ta => {
            if (ta.passed) {
                const test = tests.find(t => t.id === ta.test_id);
                if (test) {
                    test.skill_ids.forEach(sid => {
                        if (!countedSkillIds.has(sid)) {
                            const skill = skills.find(s => s.id === sid);
                            if (skill) {
                                skillsBonus += skill.hourly_bonus;
                                countedSkillIds.add(sid);
                            }
                        }
                    });
                }
            }
        });

        const QUALIFICATIONS_LIST = [
            { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
            { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
            { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
        ];

        const userQuals = selectedCandidate.qualifications || [];
        let qualBonus = 0;
        const candidateSkills = userSkills.filter(us => us.user_id === selectedCandidate.id);

        QUALIFICATIONS_LIST
            .filter(q => userQuals.includes(q.id))
            .forEach(q => {
                const expectedDocName = `Certyfikat ${q.label}`;
                const doc = candidateSkills.find(d => d.custom_name === expectedDocName);
                if (!doc || doc.status !== SkillStatus.FAILED) {
                    qualBonus += q.value;
                }
            });

        const contractType = selectedCandidate.contract_type || 'uop';
        const contractBonus = systemConfig.contractBonuses[contractType] || 0;
        const studentBonus = (contractType === 'uz' && selectedCandidate.is_student) ? systemConfig.studentBonus : 0;
        const totalExtras = contractBonus + studentBonus;
        const frozenRate = systemConfig.baseRate + skillsBonus + qualBonus + totalExtras;

        setTrialDates({
            start: new Date().toISOString().split('T')[0],
            end: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
            brigadirId: selectedCandidate.assigned_brigadir_id || '',
            frozenRate
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
                assigned_brigadir_id: trialDates.brigadirId,
                base_rate: trialDates.frozenRate
            });
            await logCandidateAction(selectedCandidate.id, `Zatrudniono na okres próbny: ${trialDates.start} - ${trialDates.end}. Zamrożona stawka: ${trialDates.frozenRate.toFixed(2)} zł/h. Brygadzista: ${users.find(u => u.id === trialDates.brigadirId)?.last_name}`);
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

        // Send SMS notification based on status change
        console.log('🔍 SMS Debug:', {
            hasPhone: !!selectedCandidate.phone,
            phone: selectedCandidate.phone,
            newStatus: newStatus,
            firstName: selectedCandidate.first_name
        });

        if (selectedCandidate.phone) {
            try {
                if (newStatus === UserStatus.REJECTED) {
                    console.log('📱 Sending rejection SMS to:', selectedCandidate.phone);
                    // Send rejection SMS
                    const result = await sendTemplatedSMS(
                        'CAND_REJECTED',
                        selectedCandidate.phone,
                        { firstName: selectedCandidate.first_name, companyName: 'MaxMaster' },
                        selectedCandidate.id
                    );
                    console.log('✅ SMS sent result:', result);
                } else if (newStatus === UserStatus.DATA_REQUESTED) {
                    console.log('📱 Sending data request SMS to:', selectedCandidate.phone);
                    // Send data request SMS
                    const actionUrl = `${window.location.origin}/#/candidate/profile`;
                    const result = await sendTemplatedSMS(
                        'CAND_DOCS_REQUEST',
                        selectedCandidate.phone,
                        { firstName: selectedCandidate.first_name, actionUrl },
                        selectedCandidate.id
                    );
                    console.log('✅ SMS sent result:', result);
                }
            } catch (error) {
                console.error('❌ Failed to send status change SMS:', error);
            }
        } else {
            console.warn('⚠️ No phone number for candidate, SMS not sent');
        }
    };

    const handleContractChange = async (type: string) => {
        if (!selectedCandidate) return;
        
        // Zapisz do bazy - bez względu na to czy jest to typ "core" czy "custom"
        // Jeśli DB ma ENUM, a typ jest spoza, rzuci błędem, ale przynajmniej Frontend spróbuje zapisać.
        try {
            await updateUser(selectedCandidate.id, { contract_type: type as any });
            setSelectedCandidate({ ...selectedCandidate, contract_type: type as any });
            setIsContractPopoverOpen(false);
            triggerNotification('success', 'Zapisano', `Zmieniono formę zatrudnienia na ${type.toUpperCase()}`);
        } catch (err: any) {
            console.error('Błąd zapisu ContractType:', err);
            triggerNotification('error', 'Błąd zapisu', 'Wybrany typ umowy nie jest wspierany przez bazę danych (ENUM limitation). Skontaktuj się z adminem.');
        }
    };

    const handleStudentToggle = async (val: boolean) => {
        if (!selectedCandidate) return;
        await updateUser(selectedCandidate.id, { is_student: val });
        setSelectedCandidate({ ...selectedCandidate, is_student: val });
    };

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

    const renderDetail = () => {
        if (!selectedCandidate) return null;

        const candidateSkills = userSkills.filter(us => us.user_id === selectedCandidate.id);

        // Calculate skills bonus from test attempts (like in candidate dashboard)
        const candidateTestAttempts = testAttempts.filter(ta => ta.user_id === selectedCandidate.id);
        let skillsBonus = 0;
        const countedSkillIds = new Set<string>();

        candidateTestAttempts.forEach(ta => {
            if (ta.passed) {
                const test = tests.find(t => t.id === ta.test_id);
                if (test) {
                    test.skill_ids.forEach(sid => {
                        if (!countedSkillIds.has(sid)) {
                            const skill = skills.find(s => s.id === sid);
                            if (skill) {
                                skillsBonus += skill.hourly_bonus;
                                countedSkillIds.add(sid);
                            }
                        }
                    });
                }
            }
        });

        // Calculate qualifications bonus (like in candidate dashboard)
        const QUALIFICATIONS_LIST = [
            { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
            { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
            { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
        ];

        const userQuals = selectedCandidate.qualifications || [];
        let qualBonus = 0;

        QUALIFICATIONS_LIST
            .filter(q => userQuals.includes(q.id))
            .forEach(q => {
                const expectedDocName = `Certyfikat ${q.label}`;
                const doc = candidateSkills.find(d => d.custom_name === expectedDocName);
                if (!doc || doc.status !== SkillStatus.FAILED) {
                    qualBonus += q.value;
                }
            });

        const contractType = selectedCandidate.contract_type || 'uop';
        const contractBonus = systemConfig.contractBonuses[contractType] || 0;
        const studentBonus = (contractType === 'uz' && selectedCandidate.is_student) ? systemConfig.studentBonus : 0;
        const totalExtras = contractBonus + studentBonus;
        const totalRate = systemConfig.baseRate + skillsBonus + qualBonus + totalExtras;

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
                            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`py-3.5 px-4 font-bold text-sm border-b-4 transition-all whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600 bg-blue-50/20' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="p-6">
                        {activeTab === 'info' && (
                            <div className="space-y-6">
                                <div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Notatki Rekrutacyjne</h3><textarea className="w-full border border-slate-200 rounded-xl p-4 bg-slate-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-blue-500/10 shadow-inner min-h-[150px] text-sm" placeholder="Wpisz notatki..." value={selectedCandidate.notes || ''} onChange={(e) => { const val = e.target.value; updateUser(selectedCandidate.id, { notes: val }); setSelectedCandidate({...selectedCandidate, notes: val}); }} /></div>
                            </div>
                        )}
                        {activeTab === 'personal' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 animate-in fade-in duration-300">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-800 text-sm border-b pb-2 uppercase tracking-tighter">Dane Kontaktowe</h4>
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase">PESEL</label><input className="w-full border-b p-1 text-sm font-bold" value={editPersonalData.pesel || ''} onChange={e => { let v = e.target.value.replace(/\D/g, '').slice(0, 11); setEditPersonalData({...editPersonalData, pesel: v}); }}/></div>
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Data Urodzenia</label><input type="date" className="w-full border-b p-1 text-sm font-bold" value={editPersonalData.birth_date || ''} onChange={e => setEditPersonalData({...editPersonalData, birth_date: e.target.value})}/></div>
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Obywatelstwo</label><input className="w-full border-b p-1 text-sm font-bold" value={editPersonalData.citizenship || ''} onChange={e => setEditPersonalData({...editPersonalData, citizenship: e.target.value})}/></div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-800 text-sm border-b pb-2 uppercase tracking-tighter">Adres</h4>
                                    <div className="grid grid-cols-3 gap-2"><div className="col-span-2"><label className="text-[9px] font-black text-slate-400 uppercase">Miasto</label><input className="w-full border-b p-1 text-sm font-bold" value={editPersonalData.city || ''} onChange={e => setEditPersonalData({...editPersonalData, city: e.target.value})}/></div><div><label className="text-[9px] font-black text-slate-400 uppercase">Kod Pocztowy</label><input className="w-full border-b p-1 text-sm font-bold" value={editPersonalData.zip_code || ''} onChange={handleZipCodeChange}/></div></div>
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Ulica</label><input className="w-full border-b p-1 text-sm font-bold" value={editPersonalData.street || ''} onChange={e => editPersonalData.street = e.target.value}/></div>
                                    <div className="flex gap-2"><div><label className="text-[9px] font-black text-slate-400 uppercase">Nr Domu</label><input className="w-full border-b p-1 text-sm font-bold w-16" value={editPersonalData.house_number || ''} onChange={e => setEditPersonalData({...editPersonalData, house_number: e.target.value})}/></div><div><label className="text-[9px] font-black text-slate-400 uppercase">Nr Lokalu</label><input className="w-full border-b p-1 text-sm font-bold w-16" value={editPersonalData.apartment_number || ''} onChange={e => setEditPersonalData({...editPersonalData, apartment_number: e.target.value})}/></div></div>
                                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Bank Account</label><input className="w-full border-b p-1 text-sm font-bold" value={editPersonalData.bank_account || ''} onChange={handleBankAccountChange}/></div>
                                </div>
                                <div className="md:col-span-2 flex justify-end gap-2 mt-4">
                                    <Button onClick={handleSavePersonalData} disabled={isSubmitting}><Save size={16} className="mr-2"/> Zapisz Dane</Button>
                                </div>
                            </div>
                        )}
                        {activeTab === 'salary' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">BAZA</div>
                                        <div className="text-2xl font-black text-slate-900">{systemConfig.baseRate} zł</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
                                        <div className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">UMIEJĘTNOŚCI</div>
                                        <div className="text-2xl font-black text-green-600">+{skillsBonus.toFixed(2)} zł</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
                                        <div className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">UPRAWNIENIA</div>
                                        <div className="text-2xl font-black text-purple-600">+{qualBonus.toFixed(2)} zł</div>
                                    </div>
                                    <div className="relative">
                                        <div 
                                            className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm text-center flex flex-col justify-center min-h-[110px] cursor-pointer hover:bg-blue-50 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); setIsContractPopoverOpen(!isContractPopoverOpen); }}
                                        >
                                            <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">FORMA UMOWY</div>
                                            <div className="text-sm font-black text-blue-700 flex items-center justify-center gap-1 uppercase">
                                                {CONTRACT_TYPE_LABELS[selectedCandidate.contract_type as ContractType] || selectedCandidate.contract_type || 'Wybierz'}
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
                                                        onClick={() => handleContractChange(type)}
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
                                                            checked={selectedCandidate.is_student} 
                                                            onChange={(e) => handleStudentToggle(e.target.checked)}
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
                        {activeTab === 'tests' && (
                            <div className="space-y-4">
                                {candidateAttempts.map(attempt => {
                                    const test = tests.find(t => t.id === attempt.test_id);
                                    return (
                                        <div key={attempt.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border">
                                            <div><p className="font-bold text-slate-800">{test?.title}</p><p className="text-xs text-slate-500">{new Date(attempt.completed_at).toLocaleString()}</p></div>
                                            <div className="text-right"><p className={`font-black ${attempt.passed ? 'text-green-600' : 'text-red-600'}`}>{attempt.score}%</p><button onClick={() => resetTestAttempt(attempt.test_id, selectedCandidate.id)} className="text-[10px] text-blue-600 hover:underline font-bold uppercase">Resetuj podejście</button></div>
                                        </div>
                                    );
                                })}
                                {candidateAttempts.length === 0 && <p className="text-center text-slate-400 py-8 italic">Brak rozwiązanych testów.</p>}
                            </div>
                        )}
                        {activeTab === 'docs' && (
                            <div className="space-y-4">
                                <div className="flex justify-end"><Button size="sm" onClick={handleAddDocument}><Plus size={16} className="mr-2"/> Dodaj dokument</Button></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {candidateSkills.filter(us => us.custom_type === 'doc_generic' || !us.skill_id || (typeof us.skill_id === 'string' && us.skill_id.startsWith('doc_'))).map(doc => (
                                        <div key={doc.id} className="p-4 border rounded-xl bg-white shadow-sm flex justify-between items-center group relative">
                                            <div>
                                                <p className="font-bold text-slate-800">{doc.custom_name}</p>
                                                <div className="flex gap-2 mt-1">
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${doc.status === SkillStatus.CONFIRMED ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>{SKILL_STATUS_LABELS[doc.status]}</span>
                                                    {doc.bonus_value > 0 && <span className="text-[9px] font-bold text-green-600">+{doc.bonus_value} zł</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 relative z-10">
                                                <button onClick={() => setFileViewer({ isOpen: true, urls: doc.document_urls || [doc.document_url!], title: doc.custom_name || 'Dokument', index: 0 })} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"><Eye size={18}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); setStatusPopoverDocId(doc.id); }} className="p-1.5 hover:bg-slate-50 text-slate-400 rounded"><Edit size={18}/></button>
                                            </div>
                                            {statusPopoverDocId === doc.id && (
                                                <div className="absolute right-4 top-full mt-1 w-40 bg-white border shadow-xl rounded-lg z-[150] py-1">
                                                    <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-green-50 text-green-700" onClick={() => handleDocStatusChange(doc.id, SkillStatus.CONFIRMED)}>Zatwierdź</button>
                                                    <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 text-red-700" onClick={() => handleDocStatusChange(doc.id, SkillStatus.FAILED)}>Odrzuć</button>
                                                    <div className="border-t my-1"></div>
                                                    <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-red-500" onClick={() => archiveCandidateDocument(doc.id)}>Usuń</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeTab === 'history' && (
                            <div className="space-y-2">
                                {state.candidateHistory.filter(h => h.candidate_id === selectedCandidate.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(h => (
                                    <div key={h.id} className="text-xs p-2 border-b last:border-0 flex justify-between"><span className="text-slate-600">[{new Date(h.created_at).toLocaleString()}] {h.action}</span><span className="font-bold text-slate-400">{h.performed_by}</span></div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderList = () => (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Zarządzanie Kandydatami</h1>
                    <p className="text-slate-500">Przegląd i procesowanie nowych aplikacji.</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white border border-slate-200 rounded-lg flex p-1 shadow-sm mr-2">
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
                            Odrzuceni
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={generateInvitationLink}>
                            <Link2 size={18} className="mr-2"/> Wyślij zaproszenie
                        </Button>
                        <Button onClick={() => setIsSelectionModalOpen(true)}>
                            <UserPlus size={18} className="mr-2"/> Dodaj Kandydata
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Szukaj kandydata..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="relative min-w-[200px] w-full md:w-auto">
                    <select 
                        className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-700 py-2 pl-3 pr-10 rounded-lg text-sm font-medium cursor-pointer"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Wszystkie statusy</option>
                        {Object.entries(CANDIDATE_DISPLAY_LABELS).map(([status, label]) => (
                            <option key={status} value={status}>{label}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Kandydat</th>
                            <th className="px-6 py-4">Stanowisko</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Źródło</th>
                            <th className="px-6 py-4 text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredCandidates.map(candidate => {
                            // Calculate skills bonus from test attempts
                            const candTestAttempts = testAttempts.filter(ta => ta.user_id === candidate.id);
                            let candSkillsBonus = 0;
                            const candCountedSkillIds = new Set<string>();

                            candTestAttempts.forEach(ta => {
                                if (ta.passed) {
                                    const test = tests.find(t => t.id === ta.test_id);
                                    if (test) {
                                        test.skill_ids.forEach(sid => {
                                            if (!candCountedSkillIds.has(sid)) {
                                                const skill = skills.find(s => s.id === sid);
                                                if (skill) {
                                                    candSkillsBonus += skill.hourly_bonus;
                                                    candCountedSkillIds.add(sid);
                                                }
                                            }
                                        });
                                    }
                                }
                            });

                            // Calculate qualifications bonus
                            const QUALIFICATIONS_LIST = [
                                { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
                                { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
                                { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
                            ];

                            const candUserQuals = candidate.qualifications || [];
                            let candQualBonus = 0;
                            const candUserSkills = userSkills.filter(us => us.user_id === candidate.id);

                            QUALIFICATIONS_LIST
                                .filter(q => candUserQuals.includes(q.id))
                                .forEach(q => {
                                    const expectedDocName = `Certyfikat ${q.label}`;
                                    const doc = candUserSkills.find(d => d.custom_name === expectedDocName);
                                    if (!doc || doc.status !== SkillStatus.FAILED) {
                                        candQualBonus += q.value;
                                    }
                                });

                            const ct = candidate.contract_type || ContractType.UOP;
                            const cb = systemConfig.contractBonuses[ct] || 0;
                            const sb = (ct === ContractType.UZ && candidate.is_student) ? systemConfig.studentBonus : 0;
                            const total = (systemConfig.baseRate + candSkillsBonus + candQualBonus + cb + sb).toFixed(2);

                            return (
                                <tr key={candidate.id} className="hover:bg-slate-50 cursor-pointer transition-colors group" onClick={() => setSelectedCandidate(candidate)}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                {candidate.first_name[0]}{candidate.last_name[0]}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{candidate.first_name} {candidate.last_name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">{candidate.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">{candidate.target_position || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${CANDIDATE_DISPLAY_COLORS[candidate.status] || 'bg-slate-100 text-slate-600'}`}>
                                            {CANDIDATE_DISPLAY_LABELS[candidate.status] || candidate.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{candidate.source || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <span className="font-black text-slate-900 text-xs">{total} zł/h</span>
                                            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 inline transition-all transform group-hover:translate-x-1"/>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredCandidates.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-slate-400 italic font-medium">Brak kandydatów spełniających kryteria.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderSelectionModal = () => {
        if (!isSelectionModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSelectionModalOpen(false)}>
                <div className="bg-white rounded-[32px] shadow-2xl max-w-xl w-full p-10 animate-in zoom-in duration-300 text-center" onClick={e => e.stopPropagation()}>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2 uppercase">DODAJ KANDYDATA</h2>
                    <p className="text-slate-500 font-medium mb-10">Wybierz sposób wprowadzenia danych do systemu.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button 
                            onClick={() => { setIsSelectionModalOpen(false); setIsAddModalOpen(true); }}
                            className="flex flex-col items-center gap-4 p-8 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-[32px] border border-slate-100 transition-all group shadow-sm hover:shadow-xl hover:shadow-blue-200"
                        >
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform"><UserPlus size={32}/></div>
                            <span className="font-black uppercase tracking-widest text-xs">WPISZ RĘCZNIE</span>
                        </button>
                        
                        <div className="relative">
                            <input type="file" ref={aiFileInputRef} className="hidden" accept=".pdf" onChange={handleAIImport}/>
                            <button 
                                onClick={() => aiFileInputRef.current?.click()}
                                disabled={isAILoading}
                                className="w-full flex flex-col items-center gap-4 p-8 bg-slate-900 hover:bg-indigo-600 text-white rounded-[32px] border border-slate-800 transition-all group shadow-sm hover:shadow-xl hover:shadow-indigo-200 disabled:opacity-50"
                            >
                                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:text-white shadow-sm group-hover:scale-110 transition-transform">
                                    {isAILoading ? <Loader2 size={32} className="animate-spin"/> : <Sparkles size={32}/>}
                                </div>
                                <span className="font-black uppercase tracking-widest text-xs">{isAILoading ? 'ANALIZA CV...' : 'IMPORT CV (AI)'}</span>
                            </button>
                            <div className="absolute -top-3 -right-3 bg-indigo-500 text-white text-[8px] font-black px-2 py-1 rounded-full shadow-lg border-2 border-white uppercase tracking-widest">Polecane</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderAddModal = () => {
        if (!isAddModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">NOWY KANDYDAT</h2>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white rounded-full"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleAddCandidateSubmit} className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IMIĘ</label><input required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner" value={newCandidateData.first_name} onChange={e => setNewCandidateData({...newCandidateData, first_name: e.target.value})}/></div>
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NAZWISKO</label><input required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner" value={newCandidateData.last_name} onChange={e => setNewCandidateData({...newCandidateData, last_name: e.target.value})}/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">EMAIL</label><input type="email" required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner" value={newCandidateData.email} onChange={e => setNewCandidateData({...newCandidateData, email: e.target.value.toLowerCase()})}/></div>
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TELEFON</label><input required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner" value={newCandidateData.phone} onChange={e => setNewCandidateData({...newCandidateData, phone: formatPhone(e.target.value)})}/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">STANOWISKO</label><select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 appearance-none shadow-inner" value={newCandidateData.target_position} onChange={e => setNewCandidateData({...newCandidateData, target_position: e.target.value})}><option value="">Wybierz...</option>{positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ŹRÓDŁO</label><select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 appearance-none shadow-inner" value={newCandidateData.source} onChange={e => setNewCandidateData({...newCandidateData, source: e.target.value})}>{SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        </div>
                        <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PLIK CV (PDF/DOC)</label><div className="border-2 border-dashed border-slate-200 p-4 rounded-xl flex items-center justify-center bg-slate-50 cursor-pointer hover:bg-white hover:border-blue-400 transition-all" onClick={() => fileInputRef.current?.click()}><input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={e => setNewCandidateData({...newCandidateData, cvFile: e.target.files?.[0] || null})}/><span className="text-xs font-bold text-slate-400">{newCandidateData.cvFile ? newCandidateData.cvFile.name : 'WYBIERZ PLIK...'}</span></div></div>
                        <div className="pt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsAddModalOpen(false)} className="px-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Anuluj</button><Button type="submit" disabled={isSubmitting} className="px-10 h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20">UTWÓRZ KANDYDATA</Button></div>
                    </form>
                </div>
            </div>
        );
    };

    const renderEditBasicModal = () => {
        if (!isEditBasicModalOpen || !selectedCandidate) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full p-8 animate-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4"><h2 className="text-xl font-black uppercase tracking-tight">Edytuj dane kandydata</h2><button onClick={() => setIsEditBasicModalOpen(false)} className="p-1 hover:bg-slate-50 rounded-full text-slate-300"><X size={24}/></button></div>
                    <form onSubmit={handleEditBasicSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Imię</label><input required className="w-full bg-slate-50 border p-3 rounded-xl font-bold" value={editBasicData.first_name} onChange={e => setEditBasicData({...editBasicData, first_name: e.target.value})}/></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Nazwisko</label><input required className="w-full bg-slate-50 border p-3 rounded-xl font-bold" value={editBasicData.last_name} onChange={e => setEditBasicData({...editBasicData, last_name: e.target.value})}/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Email</label><input type="email" required className="w-full bg-slate-50 border p-3 rounded-xl font-bold" value={editBasicData.email} onChange={e => setEditBasicData({...editBasicData, email: e.target.value.toLowerCase()})}/></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Telefon</label><input required className="w-full bg-slate-50 border p-3 rounded-xl font-bold" value={editBasicData.phone} onChange={e => setEditBasicData({...editBasicData, phone: formatPhone(e.target.value)})}/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Stanowisko</label><select className="w-full bg-slate-50 border p-3 rounded-xl font-bold" value={editBasicData.target_position} onChange={e => setEditBasicData({...editBasicData, target_position: e.target.value})}><option value="">Wybierz...</option>{positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Źródło</label><select className="w-full bg-slate-50 border p-3 rounded-xl font-bold" value={editBasicData.source} onChange={e => setEditBasicData({...editBasicData, source: e.target.value})}>{SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        </div>
                        <div className="pt-6 border-t flex justify-end gap-3"><button type="button" onClick={() => setIsEditBasicModalOpen(false)} className="px-6 text-[10px] font-black uppercase text-slate-400">Anuluj</button><Button type="submit" disabled={isSubmitting}>ZAPISZ ZMIANY</Button></div>
                    </form>
                </div>
            </div>
        );
    };

    const renderTrialModal = () => {
        if (!isTrialModalOpen || !selectedCandidate) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[32px] shadow-2xl max-md w-full p-8 animate-in zoom-in duration-300">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">ZATRUDNIENIE (OKRES PRÓBNY)</h3>
                    <p className="text-sm text-slate-500 mb-8">Rozpoczęcie okresu próbnego dla kandydata <strong>{selectedCandidate.first_name} {selectedCandidate.last_name}</strong>.</p>
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">START PRACY</label><input type="date" className="w-full border p-2 rounded-xl text-sm" value={trialDates.start} onChange={e => setTrialDates({...trialDates, start: e.target.value})}/></div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">KONIEC PRÓBY</label><input type="date" className="w-full border p-2 rounded-xl text-sm" value={trialDates.end} onChange={e => setTrialDates({...trialDates, end: e.target.value})}/></div>
                        </div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">BRYGADZISTA PROWADZĄCY *</label><select required className="w-full border p-2 rounded-xl text-sm appearance-none bg-slate-50" value={trialDates.brigadirId} onChange={e => setTrialDates({...trialDates, brigadirId: e.target.value})}><option value="">Wybierz brygadzistę...</option>{brigadirsList.map(b => <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>)}</select></div>
                    </div>
                    <div className="pt-8 flex gap-3"><button onClick={() => setIsTrialModalOpen(false)} className="flex-1 text-[10px] font-black uppercase text-slate-400">Anuluj</button><Button onClick={confirmTrialHiring} className="flex-[2] h-12 rounded-xl shadow-lg bg-green-600 hover:bg-green-700 text-white font-black">ROZPOCZNIJ OKRES PRÓBNY</Button></div>
                </div>
            </div>
        );
    };

    const renderDocModal = () => {
        if (!isDocModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[32px] shadow-2xl max-md w-full p-8 animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-6">DODAJ DOKUMENT KANDYDATA</h3>
                    <div className="space-y-4">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">TYP DOKUMENTU</label><select className="w-full border p-2 rounded-xl text-sm" value={newDocData.typeId} onChange={e => setNewDocData({...newDocData, typeId: e.target.value})}><option value="">Wybierz...</option>{BONUS_DOCUMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}<option value="other">Inny...</option></select></div>
                        {newDocData.typeId === 'other' && <input className="w-full border p-2 rounded-xl text-sm" placeholder="Nazwa dokumentu..." value={newDocData.customName} onChange={e => setNewDocData({...newDocData, customName: e.target.value})}/>}
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">ZAŁĄCZ PLIKI</label><input type="file" multiple className="w-full text-xs" onChange={handleFileSelect}/></div>
                    </div>
                    <div className="pt-8 flex gap-3"><button onClick={() => setIsDocModalOpen(false)} className="flex-1 text-[10px] font-black uppercase text-slate-400">Anuluj</button><Button onClick={handleSaveDocument} className="flex-[2] font-black uppercase text-xs tracking-widest h-12 rounded-xl">PRZEŚLIJ DOKUMENT</Button></div>
                </div>
            </div>
        );
    };

    const renderInvitationModal = () => {
        if (!isInvitationModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600">
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Link Zaproszenia</h2>
                            <p className="text-xs text-blue-100 font-medium mt-1">Udostępnij ten link kandydatowi do rejestracji</p>
                        </div>
                        <button onClick={() => setIsInvitationModalOpen(false)} className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all">
                            <X size={24}/>
                        </button>
                    </div>

                    <div className="p-8 space-y-6">
                        {/* Link Display */}
                        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                            <div className="flex-1 overflow-hidden">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Link Rejestracyjny</p>
                                <p className="text-sm font-bold text-slate-800 truncate">{invitationLink}</p>
                            </div>
                            <button
                                onClick={copyToClipboard}
                                className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-all shadow-md hover:shadow-lg"
                                title="Kopiuj do schowka"
                            >
                                <Copy size={20}/>
                            </button>
                        </div>

                        {/* Quick Actions */}
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Szybkie Udostępnianie</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={shareViaWhatsApp}
                                    className="flex items-center justify-center gap-3 p-4 bg-green-50 hover:bg-green-600 hover:text-white rounded-2xl border-2 border-green-200 hover:border-green-600 transition-all group shadow-sm hover:shadow-lg"
                                >
                                    <MessageCircle size={24} className="text-green-600 group-hover:text-white" />
                                    <div className="text-left">
                                        <p className="text-xs font-black uppercase tracking-wide">WhatsApp</p>
                                        <p className="text-[10px] text-green-600 group-hover:text-green-100">Wyślij wiadomość</p>
                                    </div>
                                </button>

                                <button
                                    onClick={shareViaTelegram}
                                    className="flex items-center justify-center gap-3 p-4 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-2xl border-2 border-blue-200 hover:border-blue-600 transition-all group shadow-sm hover:shadow-lg"
                                >
                                    <Send size={24} className="text-blue-600 group-hover:text-white" />
                                    <div className="text-left">
                                        <p className="text-xs font-black uppercase tracking-wide">Telegram</p>
                                        <p className="text-[10px] text-blue-600 group-hover:text-blue-100">Wyślij wiadomość</p>
                                    </div>
                                </button>

                                <button
                                    onClick={shareViaEmail}
                                    className="flex items-center justify-center gap-3 p-4 bg-purple-50 hover:bg-purple-600 hover:text-white rounded-2xl border-2 border-purple-200 hover:border-purple-600 transition-all group shadow-sm hover:shadow-lg"
                                >
                                    <Mail size={24} className="text-purple-600 group-hover:text-white" />
                                    <div className="text-left">
                                        <p className="text-xs font-black uppercase tracking-wide">Email</p>
                                        <p className="text-[10px] text-purple-600 group-hover:text-purple-100">Otwórz program email</p>
                                    </div>
                                </button>

                                <button
                                    onClick={shareViaSMS}
                                    className="flex items-center justify-center gap-3 p-4 bg-orange-50 hover:bg-orange-600 hover:text-white rounded-2xl border-2 border-orange-200 hover:border-orange-600 transition-all group shadow-sm hover:shadow-lg"
                                >
                                    <Phone size={24} className="text-orange-600 group-hover:text-white" />
                                    <div className="text-left">
                                        <p className="text-xs font-black uppercase tracking-wide">SMS</p>
                                        <p className="text-[10px] text-orange-600 group-hover:text-orange-100">Wyślij SMS</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                            <InfoIcon size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-blue-800 leading-relaxed">
                                <p className="font-bold mb-1">Jak to działa?</p>
                                <p>Kandydat otrzyma link do strony rejestracji. Po wypełnieniu formularza i przesłaniu danych, będziesz mógł przeglądać jego profil i rozpocząć proces rekrutacji.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                        <Button onClick={() => setIsInvitationModalOpen(false)} className="font-black uppercase text-xs tracking-widest px-8">
                            Zamknij
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSMSInvitationModal = () => {
        if (!isSMSInvitationModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-orange-600 to-orange-500">
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Wyślij SMS Zaproszenie</h2>
                            <p className="text-xs text-orange-100 font-medium mt-1">Wypełnij dane i wyślij zaproszenie SMS</p>
                        </div>
                        <button onClick={() => setIsSMSInvitationModalOpen(false)} className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all">
                            <X size={24}/>
                        </button>
                    </div>

                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                        {/* Personal Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Imię</label>
                                <input
                                    type="text"
                                    className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-orange-500 focus:outline-none transition-colors"
                                    placeholder="np. Jan"
                                    value={smsInvitationData.firstName}
                                    onChange={(e) => setSmsInvitationData({...smsInvitationData, firstName: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nazwisko</label>
                                <input
                                    type="text"
                                    className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-orange-500 focus:outline-none transition-colors"
                                    placeholder="np. Kowalski"
                                    value={smsInvitationData.lastName}
                                    onChange={(e) => setSmsInvitationData({...smsInvitationData, lastName: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Numer Telefonu</label>
                                <input
                                    type="tel"
                                    className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-orange-500 focus:outline-none transition-colors"
                                    placeholder="+48 500 123 456"
                                    value={smsInvitationData.phone}
                                    onChange={(e) => setSmsInvitationData({...smsInvitationData, phone: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Stanowisko</label>
                                <select
                                    className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-orange-500 focus:outline-none transition-colors"
                                    value={smsInvitationData.position}
                                    onChange={(e) => setSmsInvitationData({...smsInvitationData, position: e.target.value})}
                                >
                                    <option value="">Wybierz stanowisko...</option>
                                    {positions.map(pos => (
                                        <option key={pos.id} value={pos.title_pl}>{pos.title_pl}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* SMS Message */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Treść SMS</label>
                            <p className="text-xs text-slate-500 mb-2">Możesz edytować treść wiadomości. Użyj {'{imię}'} i {'{stanowisko}'} dla automatycznego podstawienia.</p>
                            <textarea
                                className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-orange-500 focus:outline-none transition-colors resize-none"
                                rows={6}
                                placeholder="Treść SMS..."
                                value={smsInvitationData.message}
                                onChange={(e) => setSmsInvitationData({...smsInvitationData, message: e.target.value})}
                            />
                            <div className="mt-2 text-xs text-slate-500">
                                Liczba znaków: {smsInvitationData.message.length} / 160
                            </div>
                        </div>

                        {/* Preview */}
                        {smsInvitationData.firstName && smsInvitationData.position && (
                            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">Podgląd wiadomości</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                    {smsInvitationData.message
                                        .replace(/\{imię\}/g, smsInvitationData.firstName)
                                        .replace(/\{stanowisko\}/g, smsInvitationData.position)}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
                        <button
                            onClick={() => setIsSMSInvitationModalOpen(false)}
                            className="flex-1 text-sm font-black uppercase text-slate-500 hover:text-slate-700 transition-colors"
                            disabled={isSendingSMS}
                        >
                            Wróć
                        </button>
                        <Button
                            onClick={handleSendSMSInvitation}
                            className="flex-[2] font-black uppercase text-sm tracking-widest bg-orange-600 hover:bg-orange-700"
                            disabled={isSendingSMS}
                        >
                            {isSendingSMS ? (
                                <>
                                    <Loader2 size={16} className="mr-2 animate-spin" />
                                    Wysyłanie...
                                </>
                            ) : (
                                <>
                                    <Phone size={16} className="mr-2" />
                                    Wyślij SMS
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {selectedCandidate ? renderDetail() : renderList()}
            {renderSelectionModal()}
            {renderInvitationModal()}
            {renderSMSInvitationModal()}
            {renderAddModal()}
            {renderEditBasicModal()}
            {renderDocModal()}
            {renderTrialModal()}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
            <input type="file" ref={aiFileInputRef} className="hidden" accept=".pdf" onChange={handleAIImport}/>
        </div>
    );
};
