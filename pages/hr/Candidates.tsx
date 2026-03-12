import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Send, Clock, XCircle, Search, ChevronRight, Download, FileText,
    Plus, Archive, RotateCcw, AlertTriangle, User as UserIcon, Calendar,
    Check, CheckCircle, Edit, Trash2, UserPlus, Briefcase, UserCheck, Eye, X,
    Upload, ChevronDown, Bot, Loader2, Share2, Copy, FileInput, Save,
    Shield, Wallet, Award, Calculator, ChevronLeft, Globe, Mail, Phone, ExternalLink, Activity, Info as InfoIcon, MapPin, Sparkles, Link2, MessageCircle,
    LayoutGrid, List, BrainCircuit, ThumbsUp, ThumbsDown, Star, AlertCircle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { User, Role, UserStatus, SkillStatus, VerificationType, CandidateHistoryEntry, ContractType } from '../../types';
import { USER_STATUS_LABELS, SKILL_STATUS_LABELS, CONTRACT_TYPE_LABELS, BONUS_DOCUMENT_TYPES } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument, supabase } from '../../lib/supabase';
import { calculateSalary } from '../../services/salaryService';
import { sendTemplatedSMS, sendSMS } from '../../lib/smsService';
import { createShortLink } from '../../lib/shortLinks';

// --- PESEL Validation ---
const validatePesel = (pesel: string): { valid: boolean; error?: string } => {
    if (!pesel || pesel.length === 0) return { valid: true };
    if (pesel.length < 11) return { valid: false, error: 'PESEL musi mieć 11 cyfr' };
    if (!/^\d{11}$/.test(pesel)) return { valid: false, error: 'PESEL może zawierać tylko cyfry' };
    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    const digits = pesel.split('').map(Number);
    const checksum = weights.reduce((sum, w, i) => sum + w * digits[i], 0);
    const controlDigit = (10 - (checksum % 10)) % 10;
    if (controlDigit !== digits[10]) {
        return { valid: false, error: 'Nieprawidłowy numer PESEL (błędna suma kontrolna)' };
    }
    return { valid: true };
};

// --- Bank Account Formatting (Polish: XX XXXX XXXX XXXX XXXX XXXX XXXX) ---
const formatBankAccount = (digits: string): string => {
    if (digits.length <= 2) return digits;
    const prefix = digits.slice(0, 2);
    const rest = digits.slice(2);
    const groups = rest.match(/.{1,4}/g) || [];
    return (prefix + ' ' + groups.join(' ')).trim();
};

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
    const { systemConfig, skills, userSkills, testAttempts, users: allUsers, tests, positions, currentCompany } = state;

    // Filter users by company_id for multi-tenant isolation
    const users = useMemo(() => allUsers.filter(u => u.company_id === currentCompany?.id), [allUsers, currentCompany]);
    const location = useLocation();
    const navigate = useNavigate();
    
    const companyIdForLinks = currentCompany?.id || state.currentUser?.company_id;

    const [selectedCandidate, setSelectedCandidate] = useState<User | null>(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'info'|'personal'|'salary'|'tests'|'docs'|'history'|'ai'>('info');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [listView, setListView] = useState<'list' | 'kanban'>('list');
    const [moveCardModal, setMoveCardModal] = useState<{ candidate: any; fromStatus: string } | null>(null);

    // AI Analysis state
    const [aiAnalysis, setAiAnalysis] = useState<null | {
        recommendation: 'hire' | 'reject' | 'maybe';
        score: number;
        strengths: string[];
        risks: string[];
        summary: string;
    }>(null);
    const [isAiAnalysisLoading, setIsAiAnalysisLoading] = useState(false);
    const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

    // Questionnaire state
    const [isSendingQuestionnaire, setIsSendingQuestionnaire] = useState(false);
    const [questionnaireStatus, setQuestionnaireStatus] = useState<'idle' | 'sent' | 'error'>('idle');
    
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
        phone: '',
        position: '',
        message: ''
    });
    const [isSendingSMS, setIsSendingSMS] = useState(false);

    // Welcome SMS modal
    const [isWelcomeSMSModalOpen, setIsWelcomeSMSModalOpen] = useState(false);
    const [welcomeSMSData, setWelcomeSMSData] = useState({
        message: ''
    });

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
    const [hrPeselError, setHrPeselError] = useState('');

    // Address autocomplete state (HR)
    const [hrAddressSuggestions, setHrAddressSuggestions] = useState<Array<{ display: string; street: string; city: string; zip: string }>>([]);
    const [hrShowAddressSuggestions, setHrShowAddressSuggestions] = useState(false);
    const [hrAddressLoading, setHrAddressLoading] = useState(false);
    const hrAddressRef = useRef<HTMLDivElement>(null);
    const hrAddressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Close address suggestions on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (hrAddressRef.current && !hrAddressRef.current.contains(e.target as Node)) {
                setHrShowAddressSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchHrAddressSuggestions = useCallback((query: string) => {
        if (hrAddressTimerRef.current) clearTimeout(hrAddressTimerRef.current);
        if (query.length < 3) {
            setHrAddressSuggestions([]);
            setHrShowAddressSuggestions(false);
            return;
        }
        hrAddressTimerRef.current = setTimeout(async () => {
            setHrAddressLoading(true);
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=pl&limit=5&accept-language=pl`,
                    { headers: { 'User-Agent': 'MaxMaster-SkillPlatform/1.0' } }
                );
                const data = await res.json();
                const suggestions = data
                    .filter((item: any) => item.address)
                    .map((item: any) => {
                        const a = item.address;
                        const street = a.road || a.pedestrian || a.neighbourhood || '';
                        const city = a.city || a.town || a.village || a.municipality || '';
                        const zip = a.postcode || '';
                        return { display: item.display_name, street, city, zip };
                    });
                setHrAddressSuggestions(suggestions);
                setHrShowAddressSuggestions(suggestions.length > 0);
            } catch {
                setHrAddressSuggestions([]);
            } finally {
                setHrAddressLoading(false);
            }
        }, 400);
    }, []);

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

    // Reset AI analysis and questionnaire status when candidate changes
    useEffect(() => {
        if (selectedCandidate) {
            setAiAnalysis(null);
            setAiAnalysisError(null);
            setQuestionnaireStatus('idle');
        }
    }, [selectedCandidate?.id]);

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

    const generateInvitationLink = async () => {
        const origin = window.location.origin;
        const registrationPath = '/#/candidate/welcome';
        const companyId = currentCompany?.id || state.currentUser?.company_id;
        if (!companyId) {
            console.warn('No company_id found for current HR user - invitation link will not contain company param');
        }
        const companyParam = companyId ? `?company=${companyId}` : '';
        const fullLink = `${origin}${registrationPath}${companyParam}`;
        const shortUrl = await createShortLink(fullLink, state.currentUser?.id);
        setInvitationLink(shortUrl || fullLink);
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

    // Format phone number as user types
    const formatPhoneNumber = (value: string) => {
        // Remove all non-digit characters
        const digits = value.replace(/\D/g, '');

        // Handle Polish phone numbers (9 digits without country code)
        // Format: +48 XXX XXX XXX or XXX XXX XXX
        if (digits.startsWith('48')) {
            // Has country code
            const withoutCode = digits.slice(2);
            if (withoutCode.length <= 3) return `+48 ${withoutCode}`;
            if (withoutCode.length <= 6) return `+48 ${withoutCode.slice(0, 3)} ${withoutCode.slice(3)}`;
            return `+48 ${withoutCode.slice(0, 3)} ${withoutCode.slice(3, 6)} ${withoutCode.slice(6, 9)}`;
        } else {
            // No country code
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
        }
    };

    const shareViaSMS = () => {
        // Link will be built with position param and shortened when sending
        const defaultMessage = `Cześć {imię}! Zapraszamy do rekrutacji na stanowisko {stanowisko}. Zarejestruj się: {link}`;

        setSmsInvitationData({
            firstName: '',
            phone: '',
            position: '',
            message: defaultMessage
        });
        setIsInvitationModalOpen(false);
        setIsSMSInvitationModalOpen(true);
    };

    const openWelcomeSMSModal = async () => {
        if (!selectedCandidate) return;

        // Check if candidate has phone number
        if (!selectedCandidate.phone) {
            triggerNotification('error', 'Błąd', 'Kandydat nie ma przypisanego numeru telefonu');
            return;
        }

        // Generate short link for the welcome URL
        const companyParam = currentCompany?.id ? `?company=${currentCompany.id}` : '';
        const fullUrl = `${window.location.origin}/#/candidate/welcome${companyParam}`;

        const shortUrl = await createShortLink(fullUrl, state.currentUser?.id);
        const linkUrl = shortUrl || fullUrl;
        const defaultMessage = `Cześć ${selectedCandidate.first_name}, zapraszamy do portalu MaxMaster! Tutaj sprawdzisz swoją stawkę: ${linkUrl}`;

        setWelcomeSMSData({
            message: defaultMessage
        });
        setIsWelcomeSMSModalOpen(true);
    };

    const handleSendWelcomeSMS = async () => {
        if (!selectedCandidate || !selectedCandidate.phone) return;

        setIsSendingSMS(true);
        try {
            // Generate short link for template-based sending
            const companyParam = currentCompany?.id ? `?company=${currentCompany.id}` : '';
            const fullUrl = `${window.location.origin}/#/candidate/welcome${companyParam}`;
            const shortUrl = await createShortLink(fullUrl, state.currentUser?.id);

            const result = await sendTemplatedSMS(
                'CAND_INVITE_LINK',
                selectedCandidate.phone,
                {
                    firstName: selectedCandidate.first_name,
                    portalUrl: shortUrl || fullUrl
                },
                selectedCandidate.id
            );

            if (result.success) {
                triggerNotification('success', 'SMS wysłany', `Link wysłany do ${selectedCandidate.first_name}`);
                setIsWelcomeSMSModalOpen(false);

                // Log the action
                if (state.currentUser) {
                    await logCandidateAction(
                        state.currentUser.id,
                        `Wysłano link powitalny SMS do: ${selectedCandidate.first_name} ${selectedCandidate.last_name} (${selectedCandidate.phone})`
                    );
                }
            } else {
                triggerNotification('error', 'Błąd wysyłania SMS', result.error || 'Nie udało się wysłać SMS');
            }
        } catch (error) {
            console.error('Error sending welcome SMS:', error);
            triggerNotification('error', 'Błąd', 'Wystąpił błąd podczas wysyłania SMS');
        } finally {
            setIsSendingSMS(false);
        }
    };

    const handleSendSMSInvitation = async () => {
        // Validate fields
        if (!smsInvitationData.firstName || !smsInvitationData.phone || !smsInvitationData.position) {
            triggerNotification('error', 'Błąd', 'Wypełnij wszystkie pola');
            return;
        }

        setIsSendingSMS(true);
        try {
            // Build full invitation link with company and position params
            const linkParams = new URLSearchParams();
            const companyId = currentCompany?.id || state.currentUser?.company_id;
            if (companyId) linkParams.append('company', companyId);
            linkParams.append('position', smsInvitationData.position);
            const fullUrl = `${window.location.origin}/#/candidate/welcome?${linkParams.toString()}`;
            const shortUrl = await createShortLink(fullUrl, state.currentUser?.id);
            const smsLink = shortUrl || fullUrl;

            // Replace placeholders in message
            const finalMessage = smsInvitationData.message
                .replace(/\{imię\}/g, smsInvitationData.firstName)
                .replace(/\{stanowisko\}/g, smsInvitationData.position)
                .replace(/\{link\}/g, smsLink);

            // Send SMS with custom message (INVITE message)
            const result = await sendSMS({
                phoneNumber: smsInvitationData.phone,
                message: finalMessage,
                templateCode: 'SMS_INVITE'
            });

            if (result.success) {
                triggerNotification('success', 'SMS wysłany', `Zaproszenie SMS wysłane do ${smsInvitationData.firstName}`);
                setIsSMSInvitationModalOpen(false);

                // Log the action
                if (state.currentUser) {
                    await logCandidateAction(
                        state.currentUser.id,
                        `Wysłano SMS zaproszenie do: ${smsInvitationData.firstName} (${smsInvitationData.phone}) - stanowisko: ${smsInvitationData.position}`
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
        // Validate PESEL before saving
        if (editPersonalData.pesel && editPersonalData.pesel.length > 0) {
            const peselResult = validatePesel(editPersonalData.pesel);
            if (!peselResult.valid) {
                setHrPeselError(peselResult.error || '');
                alert("Nieprawidłowy numer PESEL. Popraw dane przed zapisaniem.");
                return;
            }
        }
        setIsSubmitting(true);
        try {
            const dataToSave = { ...editPersonalData };
            if (isDataComplete(dataToSave) && [UserStatus.DATA_REQUESTED, UserStatus.STARTED, UserStatus.TESTS_COMPLETED, UserStatus.TESTS_IN_PROGRESS].includes(selectedCandidate.status)) {
                (dataToSave as any).status = UserStatus.DATA_SUBMITTED;
                await logCandidateAction(selectedCandidate.id, 'HR uzupełnił komplet danych (Status -> Dane OK)');
            }
            await updateUser(selectedCandidate.id, dataToSave);
            triggerNotification('success', 'Zapisano', 'Dane osobowe zostały zaktualizowane.');
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

    // --- AI Candidate Analysis ---
    const handleAiAnalysis = useCallback(async () => {
        if (!selectedCandidate) return;
        setIsAiAnalysisLoading(true);
        setAiAnalysisError(null);
        setAiAnalysis(null);

        try {
            const candidateData = {
                name: `${selectedCandidate.first_name} ${selectedCandidate.last_name}`,
                position: selectedCandidate.target_position || 'nieznane stanowisko',
                source: selectedCandidate.source || 'nieznane źródło',
                notes: selectedCandidate.notes || '',
                status: selectedCandidate.status,
                hasCV: !!selectedCandidate.resume_url,
                testAttempts: testAttempts.filter(ta => ta.user_id === selectedCandidate.id).map(ta => ({
                    passed: ta.passed,
                    score: ta.score,
                    date: ta.created_at
                }))
            };

            const prompt = `Jesteś doświadczonym rekruterem w firmie budowlanej MaxMaster.
Przeanalizuj poniższe dane kandydata i daj rekomendację.

DANE KANDYDATA:
- Imię i nazwisko: ${candidateData.name}
- Stanowisko: ${candidateData.position}
- Źródło: ${candidateData.source}
- CV załączone: ${candidateData.hasCV ? 'Tak' : 'Nie'}
- Status: ${candidateData.status}
- Notatki rekrutera: ${candidateData.notes || 'Brak'}
- Wyniki testów: ${candidateData.testAttempts.length > 0 ? candidateData.testAttempts.map(t => `Wynik: ${t.score}%, ${t.passed ? 'zaliczony' : 'niezaliczony'}`).join('; ') : 'Brak testów'}

Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "recommendation": "hire" | "reject" | "maybe",
  "score": <liczba 1-10>,
  "strengths": ["<mocna strona 1>", "<mocna strona 2>", "<mocna strona 3>"],
  "risks": ["<ryzyko 1>", "<ryzyko 2>", "<ryzyko 3>"],
  "summary": "<krótkie podsumowanie 2-3 zdania po polsku>"
}`;

            const geminiApiKey = 'AIzaSyC2eB-eTn0lxJc2-0iFLFkLxN9Wq5mXE_s';
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
                    })
                }
            );

            if (!response.ok) {
                // Try via Supabase edge function as fallback
                const { data: fnData, error: fnError } = await supabase.functions.invoke('parse-cv', {
                    body: { analysisMode: true, candidateData }
                });
                if (fnError) throw new Error('Nie można połączyć z AI');
                setAiAnalysis(fnData);
                return;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleaned = text.replace(/```json\n?|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            setAiAnalysis(parsed);
            await logCandidateAction(selectedCandidate.id, `Przeprowadzono analizę AI kandydata (ocena: ${parsed.score}/10)`);
        } catch (err: any) {
            console.error('AI Analysis error:', err);
            setAiAnalysisError(err.message || 'Błąd podczas analizy AI');
        } finally {
            setIsAiAnalysisLoading(false);
        }
    }, [selectedCandidate, testAttempts, logCandidateAction]);

    // --- Send Questionnaire ---
    const handleSendQuestionnaire = useCallback(async () => {
        if (!selectedCandidate) return;
        setIsSendingQuestionnaire(true);
        setQuestionnaireStatus('idle');

        try {
            // Generate unique token
            const token = `${selectedCandidate.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const questionnaireUrl = `${window.location.origin}/candidate/register?token=${encodeURIComponent(token)}&id=${selectedCandidate.id}`;

            // Save token to candidate record
            await updateUser(selectedCandidate.id, {
                questionnaire_token: token,
                questionnaire_sent_at: new Date().toISOString()
            } as any);

            // Send email via edge function
            if (selectedCandidate.email) {
                await supabase.functions.invoke('send-email', {
                    body: {
                        to: selectedCandidate.email,
                        subject: 'MaxMaster - Wypełnij ankietę rekrutacyjną',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                <h2 style="color: #1e40af;">Witaj, ${selectedCandidate.first_name}!</h2>
                                <p>Dziękujemy za zainteresowanie pracą w MaxMaster.</p>
                                <p>Aby kontynuować proces rekrutacji, prosimy o wypełnienie ankiety rekrutacyjnej.</p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${questionnaireUrl}" style="background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                                        Wypełnij ankietę →
                                    </a>
                                </div>
                                <p style="color: #6b7280; font-size: 14px;">Link jest ważny przez 7 dni.</p>
                                <p style="color: #6b7280; font-size: 14px;">Jeśli masz pytania, skontaktuj się z nami.</p>
                                <hr style="border-color: #e5e7eb; margin: 20px 0;">
                                <p style="color: #9ca3af; font-size: 12px;">MaxMaster - Portal Pracowniczy</p>
                            </div>
                        `
                    }
                });
            }

            await logCandidateAction(selectedCandidate.id, `Wysłano ankietę rekrutacyjną na ${selectedCandidate.email || 'brak emaila'}`);
            triggerNotification('success', 'Ankieta wysłana', `Wysłano link do ankiety do ${selectedCandidate.first_name}`);
            setQuestionnaireStatus('sent');
        } catch (err: any) {
            console.error('Send questionnaire error:', err);
            setQuestionnaireStatus('error');
            triggerNotification('error', 'Błąd', 'Nie udało się wysłać ankiety');
        } finally {
            setIsSendingQuestionnaire(false);
        }
    }, [selectedCandidate, updateUser, logCandidateAction, triggerNotification]);

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
        val = formatBankAccount(val);
        setEditPersonalData({ ...editPersonalData, bank_account: val });
    };

    const handleHrPeselChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.slice(0, 11);
        setEditPersonalData({ ...editPersonalData, pesel: val });
        if (val.length === 11) {
            const result = validatePesel(val);
            setHrPeselError(result.error || '');
        } else if (val.length > 0) {
            setHrPeselError('PESEL musi mieć 11 cyfr');
        } else {
            setHrPeselError('');
        }
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
                        onClick={() => { setValidationErrors({}); setIsEditBasicModalOpen(true); }}
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

                        <div className="flex flex-wrap items-center justify-end gap-2 ml-auto lg:ml-0 pr-12">

                            {/* Send Link button - always visible for candidates with phone */}
                            {selectedCandidate.phone && (
                                <Button
                                    variant="outline"
                                    className="h-9 px-3 text-xs font-bold border-orange-500 text-orange-600 hover:bg-orange-50 whitespace-nowrap"
                                    onClick={openWelcomeSMSModal}
                                >
                                    <MessageCircle size={14} className="mr-2"/> Wyślij link
                                </Button>
                            )}

                            {/* Questionnaire button */}
                            <Button
                                variant="outline"
                                className={`h-9 px-3 text-xs font-bold whitespace-nowrap ${questionnaireStatus === 'sent' ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50' : 'border-purple-500 text-purple-600 hover:bg-purple-50'}`}
                                onClick={handleSendQuestionnaire}
                                disabled={isSendingQuestionnaire}
                            >
                                {isSendingQuestionnaire ? <Loader2 size={14} className="mr-2 animate-spin"/> :
                                 questionnaireStatus === 'sent' ? <CheckCircle size={14} className="mr-2"/> :
                                 <Send size={14} className="mr-2"/>}
                                {questionnaireStatus === 'sent' ? 'Ankieta wysłana' : 'Wyślij ankietę'}
                            </Button>

                            {!isRejected && ![UserStatus.DATA_SUBMITTED, UserStatus.TRIAL, UserStatus.ACTIVE].includes(selectedCandidate.status) && (
                                selectedCandidate.status === UserStatus.DATA_REQUESTED ? (
                                    <Button variant="outline" className="h-9 px-3 text-xs font-bold border-blue-600 text-blue-600 hover:bg-blue-50 whitespace-nowrap" onClick={() => triggerNotification('info', 'Przypomnienie', 'Wysłano przypomnienie o uzupełnieniu danych.')}>
                                        <Clock size={14} className="mr-2"/> Oczekiwanie na dane (Przypomnij)
                                    </Button>
                                ) : (
                                    <Button variant="primary" className="h-9 px-3 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap" onClick={() => handleStatusChange(UserStatus.DATA_REQUESTED)}>
                                        <FileText size={14} className="mr-2"/> Poproś o dane
                                    </Button>
                                )
                            )}

                            {canHire && selectedCandidate.status !== UserStatus.TRIAL && selectedCandidate.status !== UserStatus.ACTIVE && (
                                <Button className="h-9 px-3 text-xs font-black uppercase tracking-tighter bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 rounded-lg whitespace-nowrap" onClick={handleHireToTrial}>
                                    <UserCheck size={14} className="mr-1.5"/> Zatrudnij na okres próbny
                                </Button>
                            )}

                            {isRejected ? (
                                <Button
                                    variant="primary"
                                    className="h-9 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10 whitespace-nowrap"
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
                                    className="h-9 px-3 text-xs font-bold shadow-md shadow-red-600/10 whitespace-nowrap"
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
                            { id: 'history', label: 'Historia Działań' },
                            { id: 'ai', label: '🤖 Analiza AI' }
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
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-lg">Dane osobowe</h3>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">STANOWISKO</label>
                                            <input className="w-full border p-2 rounded bg-slate-50 text-slate-600 font-medium" value={selectedCandidate.target_position || '-'} disabled />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">PESEL</label>
                                            <input
                                                className={`w-full border-b-2 bg-white p-2 focus:outline-none transition-colors ${hrPeselError ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'}`}
                                                value={editPersonalData.pesel || ''}
                                                onChange={handleHrPeselChange}
                                                maxLength={11}
                                                placeholder="XXXXXXXXXXX"
                                            />
                                            {hrPeselError && <span className="text-[10px] text-red-500 font-medium">{hrPeselError}</span>}
                                            {!hrPeselError && editPersonalData.pesel && editPersonalData.pesel.length === 11 && <span className="text-[10px] text-green-500 font-medium">PESEL prawidłowy</span>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">DATA URODZENIA</label>
                                            <input type="date" className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" value={editPersonalData.birth_date || ''} onChange={e => setEditPersonalData({...editPersonalData, birth_date: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">OBYWATELSTWO</label>
                                            <select className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-medium" value={editPersonalData.citizenship || ''} onChange={e => setEditPersonalData({...editPersonalData, citizenship: e.target.value})}>
                                                <option value="">Wybierz...</option>
                                                <option value="Polskie">Polskie</option>
                                                <option value="Ukraińskie">Ukraińskie</option>
                                                <option value="Białoruskie">Białoruskie</option>
                                                <option value="Inne">Inne</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RODZAJ DOKUMENTU</label>
                                            <select className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-medium" value={editPersonalData.document_type || 'Dowód osobisty'} onChange={e => setEditPersonalData({...editPersonalData, document_type: e.target.value})}>
                                                <option value="Dowód osobisty">Dowód osobisty</option>
                                                <option value="Paszport">Paszport</option>
                                                <option value="Karta Pobytu">Karta Pobytu</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NR DOKUMENTU</label>
                                            <input className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-medium" value={editPersonalData.document_number || ''} onChange={e => setEditPersonalData({...editPersonalData, document_number: e.target.value})} />
                                        </div>
                                    </div>

                                    <div className="pt-4 pb-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">Adres Zamieszkania</div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2 relative" ref={hrAddressRef}>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ULICA</label>
                                            <div className="relative">
                                                <input
                                                    className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-medium pr-8"
                                                    value={editPersonalData.street || ''}
                                                    onChange={e => {
                                                        setEditPersonalData({...editPersonalData, street: e.target.value});
                                                        fetchHrAddressSuggestions(e.target.value);
                                                    }}
                                                    placeholder="Zacznij wpisywać ulicę..."
                                                    autoComplete="off"
                                                />
                                                {hrAddressLoading && (
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                                    </div>
                                                )}
                                                {!hrAddressLoading && editPersonalData.street && editPersonalData.street.length >= 3 && (
                                                    <MapPin size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                )}
                                            </div>
                                            {hrShowAddressSuggestions && hrAddressSuggestions.length > 0 && (
                                                <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                                                    {hrAddressSuggestions.map((s, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                                                            onClick={() => {
                                                                setEditPersonalData(prev => ({
                                                                    ...prev,
                                                                    street: s.street,
                                                                    city: s.city,
                                                                    zip_code: s.zip
                                                                }));
                                                                setHrShowAddressSuggestions(false);
                                                            }}
                                                        >
                                                            <div className="flex items-start gap-2">
                                                                <MapPin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                                                <div>
                                                                    <div className="text-sm font-medium text-slate-800">{s.street || 'Brak nazwy ulicy'}</div>
                                                                    <div className="text-xs text-slate-500">{[s.zip, s.city].filter(Boolean).join(' ')}</div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NR DOMU</label>
                                            <input className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-medium" value={editPersonalData.house_number || ''} onChange={e => setEditPersonalData({...editPersonalData, house_number: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NR LOKALU</label>
                                            <input className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-medium" value={editPersonalData.apartment_number || ''} onChange={e => setEditPersonalData({...editPersonalData, apartment_number: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">KOD POCZTOWY</label>
                                            <input className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-medium" value={editPersonalData.zip_code || ''} onChange={handleZipCodeChange} placeholder="XX-XXX" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MIASTO</label>
                                            <input className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-medium" value={editPersonalData.city || ''} onChange={e => setEditPersonalData({...editPersonalData, city: e.target.value})} />
                                        </div>
                                    </div>

                                    <div className="pt-4 pb-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">Bankowość</div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NR KONTA BANKOWEGO</label>
                                        <input className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-mono tracking-wide font-bold" value={editPersonalData.bank_account || ''} onChange={handleBankAccountChange} placeholder="00 0000 0000 0000 0000 0000 0000" />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
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
                        {activeTab === 'ai' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><BrainCircuit size={22} className="text-indigo-600"/> Analiza AI Kandydata</h3>
                                        <p className="text-sm text-slate-500 mt-0.5">AI oceni kandydata na podstawie dostępnych danych i testów</p>
                                    </div>
                                    <button
                                        onClick={handleAiAnalysis}
                                        disabled={isAiAnalysisLoading}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all"
                                    >
                                        {isAiAnalysisLoading ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                                        {isAiAnalysisLoading ? 'Analizuję...' : 'Uruchom analizę AI'}
                                    </button>
                                </div>

                                {aiAnalysisError && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
                                        <AlertCircle size={20}/>
                                        <span className="text-sm font-medium">{aiAnalysisError}</span>
                                    </div>
                                )}

                                {!aiAnalysis && !isAiAnalysisLoading && !aiAnalysisError && (
                                    <div className="text-center py-16 text-slate-400">
                                        <BrainCircuit size={48} className="mx-auto mb-4 opacity-30"/>
                                        <p className="font-medium">Kliknij "Uruchom analizę AI" aby ocenić kandydata</p>
                                        <p className="text-sm mt-1">AI przeanalizuje dane, wyniki testów i notatki</p>
                                    </div>
                                )}

                                {aiAnalysis && (
                                    <div className="space-y-4 animate-in fade-in duration-500">
                                        {/* Recommendation banner */}
                                        <div className={`rounded-2xl p-6 flex items-center gap-5 ${
                                            aiAnalysis.recommendation === 'hire' ? 'bg-emerald-50 border-2 border-emerald-200' :
                                            aiAnalysis.recommendation === 'reject' ? 'bg-red-50 border-2 border-red-200' :
                                            'bg-amber-50 border-2 border-amber-200'
                                        }`}>
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                                                aiAnalysis.recommendation === 'hire' ? 'bg-emerald-100 text-emerald-600' :
                                                aiAnalysis.recommendation === 'reject' ? 'bg-red-100 text-red-600' :
                                                'bg-amber-100 text-amber-600'
                                            }`}>
                                                {aiAnalysis.recommendation === 'hire' ? <ThumbsUp size={28}/> :
                                                 aiAnalysis.recommendation === 'reject' ? <ThumbsDown size={28}/> :
                                                 <AlertCircle size={28}/>}
                                            </div>
                                            <div className="flex-1">
                                                <div className={`text-xl font-black uppercase tracking-widest ${
                                                    aiAnalysis.recommendation === 'hire' ? 'text-emerald-700' :
                                                    aiAnalysis.recommendation === 'reject' ? 'text-red-700' :
                                                    'text-amber-700'
                                                }`}>
                                                    {aiAnalysis.recommendation === 'hire' ? '✅ REKOMENDACJA: ZATRUDNIĆ' :
                                                     aiAnalysis.recommendation === 'reject' ? '❌ REKOMENDACJA: ODRZUCIĆ' :
                                                     '⚠️ REKOMENDACJA: DO ROZWAŻENIA'}
                                                </div>
                                                <p className="text-sm text-slate-600 mt-1">{aiAnalysis.summary}</p>
                                            </div>
                                            <div className="text-center flex-shrink-0">
                                                <div className="text-4xl font-black text-slate-900">{aiAnalysis.score}</div>
                                                <div className="text-xs text-slate-500 font-medium">/ 10</div>
                                                <div className="flex gap-0.5 mt-1 justify-center">
                                                    {[1,2,3,4,5,6,7,8,9,10].map(i => (
                                                        <div key={i} className={`w-2 h-2 rounded-full ${i <= aiAnalysis.score ? 'bg-indigo-500' : 'bg-slate-200'}`}/>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Strengths */}
                                            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
                                                <h4 className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <ThumbsUp size={14}/> Mocne strony
                                                </h4>
                                                <ul className="space-y-2">
                                                    {aiAnalysis.strengths.map((s, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                                                            <Check size={14} className="mt-0.5 flex-shrink-0 text-emerald-500"/>
                                                            {s}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Risks */}
                                            <div className="bg-red-50 rounded-xl p-5 border border-red-100">
                                                <h4 className="text-xs font-black text-red-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <AlertCircle size={14}/> Ryzyka
                                                </h4>
                                                <ul className="space-y-2">
                                                    {aiAnalysis.risks.map((r, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                                                            <XCircle size={14} className="mt-0.5 flex-shrink-0 text-red-400"/>
                                                            {r}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderList = () => (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 sm:mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Zarządzanie Kandydatami</h1>
                    <p className="text-sm text-slate-500">Przegląd i procesowanie nowych aplikacji.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                    <div className="bg-white border border-slate-200 rounded-lg flex p-1 shadow-sm">
                        <button
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'active' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setViewMode('active')}
                        >
                            Aktywni
                        </button>
                        <button
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'archived' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setViewMode('archived')}
                        >
                            Odrzuceni
                        </button>
                    </div>
                    <div className="flex gap-2">
                        {/* List/Kanban toggle */}
                        <div className="bg-white border border-slate-200 rounded-lg flex p-1 shadow-sm">
                            <button
                                onClick={() => setListView('list')}
                                className={`p-1.5 rounded transition-all ${listView === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Widok listy"
                            >
                                <List size={16}/>
                            </button>
                            <button
                                onClick={() => setListView('kanban')}
                                className={`p-1.5 rounded transition-all ${listView === 'kanban' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Widok Kanban"
                            >
                                <LayoutGrid size={16}/>
                            </button>
                        </div>
                        <Button variant="outline" onClick={generateInvitationLink} className="flex-1 sm:flex-none">
                            <Link2 size={18} className="mr-1 sm:mr-2"/> <span className="hidden sm:inline">Wyślij zaproszenie</span><span className="sm:hidden">Zaproś</span>
                        </Button>
                        <Button onClick={() => setIsSelectionModalOpen(true)} className="flex-1 sm:flex-none">
                            <UserPlus size={18} className="mr-1 sm:mr-2"/> <span className="hidden sm:inline">Dodaj Kandydata</span><span className="sm:hidden">Dodaj</span>
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

            {listView === 'list' ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-3 sm:px-4 md:px-6 py-3 md:py-4">Kandydat</th>
                            <th className="px-3 sm:px-4 md:px-6 py-3 md:py-4">Stanowisko</th>
                            <th className="px-3 sm:px-4 md:px-6 py-3 md:py-4">Status</th>
                            <th className="px-3 sm:px-4 md:px-6 py-3 md:py-4 hidden sm:table-cell">Źródło</th>
                            <th className="px-3 sm:px-4 md:px-6 py-3 md:py-4 text-right">Akcje</th>
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
                                    <td className="px-3 sm:px-4 md:px-6 py-3 md:py-4">
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors flex-shrink-0">
                                                {candidate.first_name[0]}{candidate.last_name[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-900 truncate">{candidate.first_name} {candidate.last_name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{candidate.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-4 md:px-6 py-3 md:py-4 text-slate-600 font-medium text-xs sm:text-sm">{candidate.target_position || '-'}</td>
                                    <td className="px-3 sm:px-4 md:px-6 py-3 md:py-4">
                                        <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border shadow-sm ${CANDIDATE_DISPLAY_COLORS[candidate.status] || 'bg-slate-100 text-slate-600'}`}>
                                            {CANDIDATE_DISPLAY_LABELS[candidate.status] || candidate.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-3 sm:px-4 md:px-6 py-3 md:py-4 text-slate-500 hidden sm:table-cell text-sm">{candidate.source || '-'}</td>
                                    <td className="px-3 sm:px-4 md:px-6 py-3 md:py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 sm:gap-3">
                                            <span className="font-black text-slate-900 text-xs">{total} zł/h</span>
                                            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 inline transition-all transform group-hover:translate-x-1"/>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredCandidates.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-6 sm:p-12 text-center text-slate-400 italic font-medium">Brak kandydatów spełniających kryteria.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>
            ) : (
            /* Kanban Board View — Rekrutacja */
            <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                    {([
                        { statuses: [UserStatus.INVITED, UserStatus.STARTED], targetStatus: UserStatus.STARTED, label: 'Nowy', color: 'bg-indigo-50 border-indigo-200', headerColor: 'bg-indigo-500' },
                        { statuses: [UserStatus.TESTS_IN_PROGRESS], targetStatus: UserStatus.TESTS_IN_PROGRESS, label: 'Screening', color: 'bg-blue-50 border-blue-200', headerColor: 'bg-blue-500' },
                        { statuses: [UserStatus.TESTS_COMPLETED], targetStatus: UserStatus.TESTS_COMPLETED, label: 'Rozmowa', color: 'bg-cyan-50 border-cyan-200', headerColor: 'bg-cyan-500' },
                        { statuses: [UserStatus.DATA_REQUESTED, UserStatus.DATA_SUBMITTED], targetStatus: UserStatus.DATA_REQUESTED, label: 'Oferta', color: 'bg-amber-50 border-amber-200', headerColor: 'bg-amber-500' },
                        { statuses: [UserStatus.ACTIVE, UserStatus.TRIAL], targetStatus: UserStatus.ACTIVE, label: 'Zatrudniony', color: 'bg-emerald-50 border-emerald-200', headerColor: 'bg-emerald-500' },
                        { statuses: [UserStatus.REJECTED], targetStatus: UserStatus.REJECTED, label: 'Odrzucony', color: 'bg-red-50 border-red-200', headerColor: 'bg-red-400' },
                    ] as Array<{ statuses: string[]; targetStatus: string; label: string; color: string; headerColor: string }>).map(col => {
                        const colCandidates = users.filter(u => {
                            if (u.role !== Role.CANDIDATE) return false;
                            if (search && !`${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())) return false;
                            return col.statuses.includes(u.status as string);
                        });
                        return (
                            <div key={col.label} className={`w-64 rounded-xl border ${col.color} flex flex-col min-h-[400px] flex-shrink-0`}>
                                <div className={`${col.headerColor} text-white px-3 py-2.5 rounded-t-xl flex items-center justify-between`}>
                                    <span className="font-black text-xs uppercase tracking-widest">{col.label}</span>
                                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{colCandidates.length}</span>
                                </div>
                                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
                                    {colCandidates.map(candidate => {
                                        const bestScore = testAttempts.filter(ta => ta.user_id === candidate.id).reduce((max, ta) => Math.max(max, ta.score || 0), 0);
                                        // Compute a simple AI score heuristic: based on test score, CV presence, data completeness
                                        const hasCV = !!candidate.resume_url;
                                        const dataComplete = isDataComplete(candidate);
                                        const aiScore = Math.min(10, Math.round(
                                            (bestScore > 0 ? bestScore / 10 : 0) * 0.5
                                            + (hasCV ? 2 : 0)
                                            + (dataComplete ? 2 : 0)
                                            + (candidate.source === 'Polecenie pracownika' ? 1 : 0)
                                        ));
                                        return (
                                            <div
                                                key={candidate.id}
                                                className="bg-white rounded-lg shadow-sm border border-white hover:shadow-md hover:border-slate-200 cursor-pointer transition-all p-3 group"
                                                onClick={() => setSelectedCandidate(candidate)}
                                            >
                                                {/* Avatar + name + position */}
                                                <div className="flex items-start gap-2 mb-2">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0 shadow-sm">
                                                        {candidate.first_name?.[0]}{candidate.last_name?.[0]}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-slate-900 text-xs truncate">{candidate.first_name} {candidate.last_name}</div>
                                                        <div className="text-[9px] text-slate-500 truncate flex items-center gap-1">
                                                            <Briefcase size={9} className="flex-shrink-0"/>
                                                            {candidate.target_position || 'brak stanowiska'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Date + AI score */}
                                                <div className="flex items-center justify-between mt-1.5">
                                                    <span className="text-[9px] text-slate-400 flex items-center gap-1">
                                                        <Calendar size={9}/>
                                                        {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString('pl-PL') : '-'}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {bestScore > 0 && (
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${bestScore >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {bestScore}%
                                                            </span>
                                                        )}
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${aiScore >= 7 ? 'bg-indigo-100 text-indigo-700' : aiScore >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            <BrainCircuit size={9}/>{aiScore}/10
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* AI summary snippet */}
                                                {candidate.notes && (
                                                    <div className="text-[9px] text-slate-400 mt-1.5 line-clamp-2 italic">{candidate.notes.slice(0, 60)}{candidate.notes.length > 60 ? '...' : ''}</div>
                                                )}
                                                {/* Actions on hover */}
                                                <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="flex-1 text-[9px] font-bold py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors flex items-center justify-center gap-0.5"
                                                        onClick={(e) => { e.stopPropagation(); setMoveCardModal({ candidate, fromStatus: candidate.status }); }}
                                                    >
                                                        <ArrowLeft size={9} className="rotate-180"/> Przenieś
                                                    </button>
                                                    <button
                                                        className="flex-1 text-[9px] font-bold py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedCandidate(candidate); }}
                                                    >
                                                        Otwórz
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {colCandidates.length === 0 && (
                                        <div className="text-center py-8 text-slate-300">
                                            <UserIcon size={24} className="mx-auto mb-1 opacity-40"/>
                                            <p className="text-[10px] font-medium">Brak kandydatów</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            )}
        </div>
    );


    // --- Move Card Modal ---
    const renderMoveCardModal = () => {
        if (!moveCardModal) return null;
        const kanbanCols = [
            { label: 'Nowy', targetStatus: UserStatus.STARTED },
            { label: 'Screening', targetStatus: UserStatus.TESTS_IN_PROGRESS },
            { label: 'Rozmowa', targetStatus: UserStatus.TESTS_COMPLETED },
            { label: 'Oferta', targetStatus: UserStatus.DATA_REQUESTED },
            { label: 'Zatrudniony', targetStatus: UserStatus.ACTIVE },
            { label: 'Odrzucony', targetStatus: UserStatus.REJECTED },
        ].filter(c => c.targetStatus !== moveCardModal.fromStatus);

        return (
            <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Przenieś kandydata</h3>
                        <button onClick={() => setMoveCardModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                    </div>
                    <div className="flex items-center gap-3 mb-5 p-3 bg-slate-50 rounded-xl">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {moveCardModal.candidate.first_name?.[0]}{moveCardModal.candidate.last_name?.[0]}
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 text-sm">{moveCardModal.candidate.first_name} {moveCardModal.candidate.last_name}</div>
                            <div className="text-[10px] text-slate-400">{moveCardModal.candidate.target_position || 'brak stanowiska'}</div>
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Wybierz kolumnę docelową</p>
                    <div className="space-y-2">
                        {kanbanCols.map(col => (
                            <button
                                key={col.label}
                                className="w-full text-left px-4 py-2.5 rounded-xl border-2 border-slate-100 hover:border-blue-400 hover:bg-blue-50 transition-all font-bold text-sm text-slate-700 hover:text-blue-700 flex items-center justify-between"
                                onClick={async () => {
                                    await updateUser(moveCardModal.candidate.id, { status: col.targetStatus });
                                    await logCandidateAction(moveCardModal.candidate.id, `Przeniesiono na tablicy Kanban: ${col.label}`);
                                    setMoveCardModal(null);
                                    triggerNotification('success', 'Przeniesiono', `${moveCardModal.candidate.first_name} przeniesiony do kolumny "${col.label}"`);
                                }}
                            >
                                <span>{col.label}</span>
                                <ArrowLeft size={14} className="rotate-180 text-slate-400"/>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderSelectionModal = () => {
        if (!isSelectionModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSelectionModalOpen(false)}>
                <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-2xl max-w-xl w-full p-6 sm:p-10 animate-in zoom-in duration-300 text-center max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2 uppercase">DODAJ KANDYDATA</h2>
                    <p className="text-sm sm:text-base text-slate-500 font-medium mb-6 sm:mb-10">Wybierz sposób wprowadzenia danych do systemu.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in duration-300 max-h-[95vh]">
                    <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">NOWY KANDYDAT</h2>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white rounded-full"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleAddCandidateSubmit} className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IMIĘ</label><input required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner" value={newCandidateData.first_name} onChange={e => setNewCandidateData({...newCandidateData, first_name: e.target.value})}/></div>
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NAZWISKO</label><input required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner" value={newCandidateData.last_name} onChange={e => setNewCandidateData({...newCandidateData, last_name: e.target.value})}/></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">EMAIL</label><input type="email" required className={`w-full bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner ${validationErrors.email ? 'border-red-400' : ''}`} value={newCandidateData.email} onChange={e => setNewCandidateData({...newCandidateData, email: e.target.value.toLowerCase()})}/>{validationErrors.email && <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.email}</p>}</div>
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TELEFON</label><input required className={`w-full bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner ${validationErrors.phone ? 'border-red-400' : ''}`} value={newCandidateData.phone} onChange={e => setNewCandidateData({...newCandidateData, phone: formatPhone(e.target.value)})}/>{validationErrors.phone && <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.phone}</p>}</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">STANOWISKO</label><select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 appearance-none shadow-inner" value={newCandidateData.target_position} onChange={e => setNewCandidateData({...newCandidateData, target_position: e.target.value})}><option value="">Wybierz...</option>{positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
                            <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ŹRÓDŁO</label><select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 appearance-none shadow-inner" value={newCandidateData.source} onChange={e => setNewCandidateData({...newCandidateData, source: e.target.value})}>{SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        </div>
                        <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PLIK CV (PDF/DOC)</label><div className="border-2 border-dashed border-slate-200 p-4 rounded-xl flex items-center justify-center bg-slate-50 cursor-pointer hover:bg-white hover:border-blue-400 transition-all" onClick={() => fileInputRef.current?.click()}><input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={e => setNewCandidateData({...newCandidateData, cvFile: e.target.files?.[0] || null})}/><span className="text-xs font-bold text-slate-400">{newCandidateData.cvFile ? newCandidateData.cvFile.name : 'WYBIERZ PLIK...'}</span></div></div>
                        <div className="pt-4 sm:pt-6 flex flex-col-reverse sm:flex-row justify-end gap-3"><button type="button" onClick={() => setIsAddModalOpen(false)} className="px-6 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">Anuluj</button><Button type="submit" disabled={isSubmitting || !!validationErrors.email || !!validationErrors.phone} className="w-full sm:w-auto px-6 sm:px-10 h-11 sm:h-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20">UTWÓRZ KANDYDATA</Button></div>
                    </form>
                </div>
            </div>
        );
    };

    const renderEditBasicModal = () => {
        if (!isEditBasicModalOpen || !selectedCandidate) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-2xl max-w-2xl w-full p-4 sm:p-6 md:p-8 animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6 sm:mb-8 border-b border-slate-100 pb-4"><h2 className="text-lg sm:text-xl font-black uppercase tracking-tight">Edytuj dane kandydata</h2><button onClick={() => setIsEditBasicModalOpen(false)} className="p-1 hover:bg-slate-50 rounded-full text-slate-300"><X size={24}/></button></div>
                    <form onSubmit={handleEditBasicSubmit} className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Imię</label><input required className="w-full bg-slate-50 border p-3 rounded-xl font-bold" value={editBasicData.first_name} onChange={e => setEditBasicData({...editBasicData, first_name: e.target.value})}/></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Nazwisko</label><input required className="w-full bg-slate-50 border p-3 rounded-xl font-bold" value={editBasicData.last_name} onChange={e => setEditBasicData({...editBasicData, last_name: e.target.value})}/></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Email</label><input type="email" required className={`w-full bg-slate-50 border p-2.5 sm:p-3 rounded-xl font-bold ${validationErrors.email ? 'border-red-400' : ''}`} value={editBasicData.email} onChange={e => setEditBasicData({...editBasicData, email: e.target.value.toLowerCase()})}/>{validationErrors.email && <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.email}</p>}</div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Telefon</label><input required className={`w-full bg-slate-50 border p-2.5 sm:p-3 rounded-xl font-bold ${validationErrors.phone ? 'border-red-400' : ''}`} value={editBasicData.phone} onChange={e => setEditBasicData({...editBasicData, phone: formatPhone(e.target.value)})}/>{validationErrors.phone && <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.phone}</p>}</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Stanowisko</label><select className="w-full bg-slate-50 border p-2.5 sm:p-3 rounded-xl font-bold" value={editBasicData.target_position} onChange={e => setEditBasicData({...editBasicData, target_position: e.target.value})}><option value="">Wybierz...</option>{positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block">Źródło</label><select className="w-full bg-slate-50 border p-2.5 sm:p-3 rounded-xl font-bold" value={editBasicData.source} onChange={e => setEditBasicData({...editBasicData, source: e.target.value})}>{SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        </div>
                        <div className="pt-4 sm:pt-6 border-t flex flex-col-reverse sm:flex-row justify-end gap-3"><button type="button" onClick={() => setIsEditBasicModalOpen(false)} className="px-6 py-2 text-[10px] font-black uppercase text-slate-400">Anuluj</button><Button type="submit" disabled={isSubmitting || !!validationErrors.email || !!validationErrors.phone} className="w-full sm:w-auto">ZAPISZ ZMIANY</Button></div>
                    </form>
                </div>
            </div>
        );
    };

    const renderTrialModal = () => {
        if (!isTrialModalOpen || !selectedCandidate) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-2xl max-w-md w-full p-4 sm:p-6 md:p-8 animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
                    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight mb-2">ZATRUDNIENIE (OKRES PRÓBNY)</h3>
                    <p className="text-sm text-slate-500 mb-6 sm:mb-8">Rozpoczęcie okresu próbnego dla kandydata <strong>{selectedCandidate.first_name} {selectedCandidate.last_name}</strong>.</p>
                    <div className="space-y-4 sm:space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">START PRACY</label><input type="date" className="w-full border p-2 rounded-xl text-sm" value={trialDates.start} onChange={e => setTrialDates({...trialDates, start: e.target.value})}/></div>
                            <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">KONIEC PRÓBY</label><input type="date" className="w-full border p-2 rounded-xl text-sm" value={trialDates.end} onChange={e => setTrialDates({...trialDates, end: e.target.value})}/></div>
                        </div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">BRYGADZISTA PROWADZĄCY *</label><select required className="w-full border p-2 rounded-xl text-sm appearance-none bg-slate-50" value={trialDates.brigadirId} onChange={e => setTrialDates({...trialDates, brigadirId: e.target.value})}><option value="">Wybierz brygadzistę...</option>{brigadirsList.map(b => <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>)}</select></div>
                    </div>
                    <div className="pt-6 sm:pt-8 flex flex-col-reverse sm:flex-row gap-3"><button onClick={() => setIsTrialModalOpen(false)} className="flex-1 text-[10px] font-black uppercase text-slate-400 py-2">Anuluj</button><Button onClick={confirmTrialHiring} className="flex-[2] h-11 sm:h-12 rounded-xl shadow-lg bg-green-600 hover:bg-green-700 text-white font-black">ROZPOCZNIJ OKRES PRÓBNY</Button></div>
                </div>
            </div>
        );
    };

    const renderDocModal = () => {
        if (!isDocModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-2xl max-w-md w-full p-4 sm:p-6 md:p-8 animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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

    const renderWelcomeSMSModal = () => {
        if (!isWelcomeSMSModalOpen || !selectedCandidate) return null;

        return (
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-500">
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Wyślij Link Powitalny</h2>
                            <p className="text-xs text-blue-100 font-medium mt-1">Wyślij link do portalu kandydatowi {selectedCandidate.first_name}</p>
                        </div>
                        <button onClick={() => setIsWelcomeSMSModalOpen(false)} className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all">
                            <X size={24}/>
                        </button>
                    </div>

                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                        {/* Candidate Info */}
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Odbiorca</p>
                            <p className="text-sm font-bold text-slate-800">{selectedCandidate.first_name} {selectedCandidate.last_name}</p>
                            <p className="text-sm text-slate-600">{selectedCandidate.phone}</p>
                        </div>

                        {/* SMS Message */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Treść SMS (max 160 znaków)</label>
                            <details className="rounded-xl border-2 border-slate-200 bg-white">
                                <summary className="cursor-pointer select-none px-4 py-3 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center justify-between">
                                    <span>Edytuj treść wiadomości</span>
                                    <span className={welcomeSMSData.message.length > 160 ? 'text-red-600 font-bold' : 'text-slate-400'}>
                                        {welcomeSMSData.message.length} / 160
                                    </span>
                                </summary>
                                <div className="px-4 pb-4 pt-2 space-y-2">
                                    <p className="text-xs text-slate-500">Edytuj treść wiadomości, aby dostosować ją do swoich potrzeb.</p>
                                    <textarea
                                        className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors resize-none"
                                        rows={5}
                                        placeholder="Treść SMS..."
                                        value={welcomeSMSData.message}
                                        onChange={(e) => setWelcomeSMSData({...welcomeSMSData, message: e.target.value})}
                                    />
                                    <div className="flex justify-between text-xs">
                                        <span className={welcomeSMSData.message.length > 160 ? 'text-red-600 font-bold' : 'text-slate-500'}>
                                            Długość: {welcomeSMSData.message.length} / 160 znaków
                                        </span>
                                        {welcomeSMSData.message.length > 160 && (
                                            <span className="text-red-600 font-bold">
                                                ⚠️ Wiadomość za długa!
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </details>
                        </div>

                        {/* Preview */}
                        <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Podgląd wiadomości</p>
                            <div className="bg-white rounded-lg p-3 border border-slate-300 shadow-sm">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                    {welcomeSMSData.message}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
                        <button
                            onClick={() => setIsWelcomeSMSModalOpen(false)}
                            className="flex-1 text-sm font-black uppercase text-slate-500 hover:text-slate-700 transition-colors"
                            disabled={isSendingSMS}
                        >
                            Anuluj
                        </button>
                        <Button
                            onClick={handleSendWelcomeSMS}
                            className="flex-[2] font-black uppercase text-sm tracking-widest bg-blue-600 hover:bg-blue-700"
                            disabled={isSendingSMS || welcomeSMSData.message.length > 160}
                        >
                            {isSendingSMS ? (
                                <>
                                    <Loader2 size={16} className="mr-2 animate-spin" />
                                    Wysyłanie...
                                </>
                            ) : (
                                <>
                                    <MessageCircle size={16} className="mr-2" />
                                    Wyślij SMS
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSMSInvitationModal = () => {
        if (!isSMSInvitationModalOpen) return null;
        const previewLink = `${window.location.host}/r.html?c=...`;
        const resolvedInvitationMessage = smsInvitationData.message
            .replace(/\{imię\}/g, smsInvitationData.firstName || '{imię}')
            .replace(/\{stanowisko\}/g, smsInvitationData.position || '{stanowisko}')
            .replace(/\{link\}/g, previewLink);
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
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Numer Telefonu</label>
                                <input
                                    type="tel"
                                    className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-orange-500 focus:outline-none transition-colors"
                                    placeholder="+48 500 123 456"
                                    value={smsInvitationData.phone}
                                    onChange={(e) => setSmsInvitationData({...smsInvitationData, phone: formatPhoneNumber(e.target.value)})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Stanowisko</label>
                            <select
                                className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-orange-500 focus:outline-none transition-colors"
                                value={smsInvitationData.position}
                                onChange={(e) => setSmsInvitationData({...smsInvitationData, position: e.target.value})}
                            >
                                <option value="">Wybierz stanowisko...</option>
                                {positions && positions.length > 0 ? (
                                    positions.map(pos => (
                                        <option key={pos.id} value={pos.name}>{pos.name}</option>
                                    ))
                                ) : (
                                    <option value="" disabled>Brak stanowisk (dodaj w Ustawieniach → Stanowiska)</option>
                                )}
                            </select>
                        </div>

                        {/* SMS Message */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Treść SMS (max 160 znaków)</label>
                            <details className="rounded-xl border-2 border-slate-200 bg-white">
                                <summary className="cursor-pointer select-none px-4 py-3 text-xs font-bold text-orange-600 hover:text-orange-800 flex items-center justify-between">
                                    <span>Edytuj treść wiadomości</span>
                                    <span className={smsInvitationData.message.length > 160 ? 'text-red-600 font-bold' : 'text-slate-400'}>
                                        {smsInvitationData.message.length} / 160
                                    </span>
                                </summary>
                                <div className="px-4 pb-4 pt-2 space-y-2">
                                    <p className="text-xs text-slate-500">Użyj {'{imię}'}, {'{stanowisko}'} i {'{link}'} - zostaną automatycznie zastąpione danymi kandydata.</p>
                                    <textarea
                                        className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-orange-500 focus:outline-none transition-colors resize-none"
                                        rows={4}
                                        placeholder="Treść SMS..."
                                        value={smsInvitationData.message}
                                        onChange={(e) => setSmsInvitationData({...smsInvitationData, message: e.target.value})}
                                    />
                                    <div className="flex justify-between text-xs">
                                        <span className={smsInvitationData.message.length > 160 ? 'text-red-600 font-bold' : 'text-slate-500'}>
                                            Szablon: {smsInvitationData.message.length} znaków
                                        </span>
                                        <span className={
                                            resolvedInvitationMessage.length > 160
                                                ? 'text-red-600 font-bold'
                                                : 'text-green-600'
                                        }>
                                            Po podstawieniu: {resolvedInvitationMessage.length} / 160
                                        </span>
                                    </div>
                                </div>
                            </details>
                        </div>

                        {/* Preview */}
                        <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">Podgląd wiadomości</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                {resolvedInvitationMessage}
                            </p>
                        </div>
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
            {renderWelcomeSMSModal()}
            {renderAddModal()}
            {renderEditBasicModal()}
            {renderDocModal()}
            {renderTrialModal()}
            {renderMoveCardModal()}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
            <input type="file" ref={aiFileInputRef} className="hidden" accept=".pdf" onChange={handleAIImport}/>
        </div>
    );
};
