
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, Upload, ArrowRight, CheckCircle, AlertCircle, Loader2, X, Building2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { UserStatus } from '../../types';
import { uploadDocument, supabase } from '../../lib/supabase';
import { EMAIL_REDIRECT_URLS } from '../../config/app.config';

export const CandidateRegisterPage = () => {
    const { addCandidate, loginAsUser, state, updateUser } = useAppContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [isCheckingPhone, setIsCheckingPhone] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '+48',
        resumeFile: null as File | null,
        resumeUrl: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [companyName, setCompanyName] = useState<string | null>(null);

    const referrerId = searchParams.get('ref');
    const companyIdParam = searchParams.get('company');
    const positionParam = searchParams.get('position');

    // Load company name if companyIdParam is provided
    useEffect(() => {
        const loadCompanyName = async () => {
            if (companyIdParam) {
                const { data: company } = await supabase
                    .from('companies')
                    .select('name')
                    .eq('id', companyIdParam)
                    .maybeSingle();

                if (company) {
                    setCompanyName(company.name);
                }
            }
        };
        loadCompanyName();
    }, [companyIdParam]);

    // Format phone number as +48 XXX XXX XXX
    const formatPhoneNumber = (value: string) => {
        // Remove all non-digits
        const digits = value.replace(/\D/g, '');

        // Start with +48
        let formatted = '+48';

        // Add remaining digits with spaces
        if (digits.length > 2) {
            const remaining = digits.slice(2);
            if (remaining.length <= 3) {
                formatted += ' ' + remaining;
            } else if (remaining.length <= 6) {
                formatted += ' ' + remaining.slice(0, 3) + ' ' + remaining.slice(3);
            } else {
                formatted += ' ' + remaining.slice(0, 3) + ' ' + remaining.slice(3, 6) + ' ' + remaining.slice(6, 9);
            }
        }

        return formatted;
    };

    // Validate phone number (Polish format)
    const validatePhone = (phone: string) => {
        const digits = phone.replace(/\D/g, '');
        return digits.length === 11 && digits.startsWith('48');
    };

    // Validate email format
    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    };

    // Check if email already exists in database
    const checkEmailExists = async (email: string): Promise<boolean> => {
        if (!email.trim() || !validateEmail(email)) return false;

        try {
            const { data, error } = await supabase
                .from('users')
                .select('id')
                .eq('email', email.trim().toLowerCase())
                .maybeSingle();

            if (error) {
                console.error('Error checking email:', error);
                return false;
            }

            return !!data;
        } catch (err) {
            console.error('Exception checking email:', err);
            return false;
        }
    };

    // Check if phone already exists in database
    const checkPhoneExists = async (phone: string): Promise<boolean> => {
        if (!phone.trim() || phone === '+48' || !validatePhone(phone)) return false;

        try {
            const { data, error } = await supabase
                .from('users')
                .select('id')
                .eq('phone', phone.trim())
                .maybeSingle();

            if (error) {
                console.error('Error checking phone:', error);
                return false;
            }

            return !!data;
        } catch (err) {
            console.error('Exception checking phone:', err);
            return false;
        }
    };

    const validateDetails = async () => {
        const newErrors: Record<string, string> = {};

        // Validate basic fields
        if (!formData.firstName.trim()) newErrors.firstName = 'Imię jest wymagane';
        if (!formData.lastName.trim()) newErrors.lastName = 'Nazwisko jest wymagane';

        // Validate email
        if (!formData.email.trim()) {
            newErrors.email = 'Email jest wymagany';
        } else if (!validateEmail(formData.email)) {
            newErrors.email = 'Nieprawidłowy format email';
        } else {
            // Check if email already exists
            const emailExists = await checkEmailExists(formData.email);
            if (emailExists) {
                newErrors.email = 'Ten adres email jest już zarejestrowany';
            }
        }

        // Validate phone
        if (!formData.phone.trim() || formData.phone === '+48') {
            newErrors.phone = 'Numer telefonu jest wymagany';
        } else if (!validatePhone(formData.phone)) {
            newErrors.phone = 'Numer telefonu musi mieć format +48 XXX XXX XXX';
        } else {
            // Check if phone already exists
            const phoneExists = await checkPhoneExists(formData.phone);
            if (phoneExists) {
                newErrors.phone = 'Ten numer telefonu jest już zarejestrowany';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Generate a secure random password for temporary use
    const generateTemporaryPassword = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        for (let i = 0; i < 16; i++) {
            password += chars[array[i] % chars.length];
        }
        return password;
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const isValid = await validateDetails();
        if (!isValid) return;
        
        console.log('=== CANDIDATE REGISTRATION START ===');
        setIsSubmitting(true);

        const cleanEmail = formData.email.trim().toLowerCase();
        const temporaryPassword = generateTemporaryPassword();

        try {
            console.log('Attempting Supabase Auth signUp for:', cleanEmail);
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: cleanEmail,
                password: temporaryPassword,
                options: {
                    emailRedirectTo: EMAIL_REDIRECT_URLS.SETUP_PASSWORD,
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        phone: formData.phone
                    }
                }
            });

            if (authError) {
                console.error('Auth signUp Error:', authError);
                throw authError;
            }

            const authId = authData.user?.id;
            console.log('Auth signUp success. User ID:', authId);

            // Validate referrer ID if provided
            let validReferrerId: string | null = null;
            if (referrerId) {
                console.log('Validating referrer ID:', referrerId);
                const { data: referrer } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', referrerId)
                    .maybeSingle();

                if (referrer) {
                    validReferrerId = referrerId;
                    console.log('Referrer ID valid');
                } else {
                    console.warn('Referrer ID not found in database, ignoring');
                }
            }

            // Validate company ID if provided
            let validCompanyId: string | null = null;
            if (companyIdParam) {
                console.log('Validating company ID:', companyIdParam);
                const { data: company } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('id', companyIdParam)
                    .maybeSingle();

                if (company) {
                    validCompanyId = companyIdParam;
                    console.log('Company ID valid');
                } else {
                    console.warn('Company ID not found in database, ignoring');
                }
            }

            console.log('Checking for existing public profile...');
            const { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('email', cleanEmail)
                .maybeSingle();

            let finalUser: any = null;

            if (existingUser) {
                console.log('Profile exists. Recreating with auth ID...');

                // Delete old record (can't update primary key)
                const { error: deleteError } = await supabase
                    .from('users')
                    .delete()
                    .eq('email', cleanEmail);

                if (deleteError) {
                    console.error('Delete existing user error:', deleteError);
                    throw deleteError;
                }

                // Create new record with correct auth ID
                const { data: inserted, error: insertError } = await supabase
                    .from('users')
                    .insert([{
                        id: authId,
                        email: cleanEmail,
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        phone: formData.phone,
                        role: 'candidate',
                        status: UserStatus.STARTED,
                        referred_by_id: validReferrerId || existingUser.referred_by_id || null,
                        source: validReferrerId ? 'Polecenie (Link)' : existingUser.source || 'Strona WWW (Rejestracja)',
                        hired_date: existingUser.hired_date || new Date().toISOString(),
                        company_id: validCompanyId || existingUser.company_id || null,
                        target_position: positionParam || existingUser.target_position || null
                    }])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Insert user after delete error:', insertError);
                    throw insertError;
                }
                finalUser = inserted;
            } else {
                console.log('No existing profile. Creating new one...');
                const { data: inserted, error: insertError } = await supabase
                    .from('users')
                    .insert([{
                        id: authId,
                        email: cleanEmail,
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        phone: formData.phone,
                        role: 'candidate',
                        status: UserStatus.STARTED,
                        referred_by_id: validReferrerId || null,
                        source: validReferrerId ? 'Polecenie (Link)' : 'Strona WWW (Rejestracja)',
                        hired_date: new Date().toISOString(),
                        company_id: validCompanyId || null,
                        target_position: positionParam || null
                    }])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Insert public user error:', insertError);
                    throw insertError;
                }
                finalUser = inserted;
            }

            if (formData.resumeFile && finalUser) {
                console.log('Uploading resume...');
                const uploadedUrl = await uploadDocument(formData.resumeFile, finalUser.id);
                if (uploadedUrl) {
                    await supabase.from('users').update({ resume_url: uploadedUrl }).eq('id', finalUser.id);
                    finalUser.resume_url = uploadedUrl;
                    console.log('Resume upload success.');
                }
            }

            console.log('Registration flow SUCCESS.');
            loginAsUser(finalUser);
            setRegisteredEmail(cleanEmail);
            setShowSuccessModal(true);
            
        } catch (error: any) {
            console.error('=== CANDIDATE REGISTRATION FAILED ===');
            console.error(error);
            alert("Błąd rejestracji: " + (error.message || "Nieznany błąd serwera."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setFormData(prev => ({ ...prev, resumeFile: file, resumeUrl: 'pending' }));
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData({ ...formData, phone: formatted });

        // Real-time validation
        if (touched.phone) {
            const newErrors = { ...errors };
            if (!formatted.trim() || formatted === '+48') {
                newErrors.phone = 'Numer telefonu jest wymagany';
            } else if (!validatePhone(formatted)) {
                newErrors.phone = 'Numer telefonu musi mieć format +48 XXX XXX XXX';
            } else {
                delete newErrors.phone;
            }
            setErrors(newErrors);
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const email = e.target.value;
        setFormData({ ...formData, email });

        // Real-time validation
        if (touched.email) {
            const newErrors = { ...errors };
            if (!email.trim()) {
                newErrors.email = 'Email jest wymagany';
            } else if (!validateEmail(email)) {
                newErrors.email = 'Nieprawidłowy format email';
            } else {
                delete newErrors.email;
            }
            setErrors(newErrors);
        }
    };

    const handleBlur = async (field: string) => {
        setTouched({ ...touched, [field]: true });

        // Trigger validation on blur
        const newErrors = { ...errors };

        if (field === 'email') {
            if (!formData.email.trim()) {
                newErrors.email = 'Email jest wymagany';
                setErrors(newErrors);
            } else if (!validateEmail(formData.email)) {
                newErrors.email = 'Nieprawidłowy format email';
                setErrors(newErrors);
            } else {
                // Check if email exists in database
                setIsCheckingEmail(true);
                const exists = await checkEmailExists(formData.email);
                setIsCheckingEmail(false);

                if (exists) {
                    newErrors.email = 'Ten adres email jest już zarejestrowany';
                } else {
                    delete newErrors.email;
                }
                setErrors(newErrors);
            }
        }

        if (field === 'phone') {
            if (!formData.phone.trim() || formData.phone === '+48') {
                newErrors.phone = 'Numer telefonu jest wymagany';
                setErrors(newErrors);
            } else if (!validatePhone(formData.phone)) {
                newErrors.phone = 'Numer telefonu musi mieć format +48 XXX XXX XXX';
                setErrors(newErrors);
            } else {
                // Check if phone exists in database
                setIsCheckingPhone(true);
                const exists = await checkPhoneExists(formData.phone);
                setIsCheckingPhone(false);

                if (exists) {
                    newErrors.phone = 'Ten numer telefonu jest już zarejestrowany';
                } else {
                    delete newErrors.phone;
                }
                setErrors(newErrors);
            }
        }
    };

    const handleCloseModal = () => {
        setShowSuccessModal(false);
        navigate('/candidate/dashboard');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-green-600 p-6 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={40} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">
                                Dziękujemy za rejestrację!
                            </h2>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-slate-600 mb-4">
                                Wysłaliśmy wiadomość e-mail na adres:
                            </p>
                            <p className="font-semibold text-slate-800 bg-slate-100 py-2 px-4 rounded-lg mb-4">
                                {registeredEmail}
                            </p>
                            <p className="text-slate-600 mb-6">
                                Proszę sprawdź swoją skrzynkę pocztową i potwierdź adres e-mail, klikając w link w wiadomości.
                            </p>
                            <button
                                onClick={handleCloseModal}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                Rozumiem, przejdź dalej
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="bg-blue-600 p-6 text-center">
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Rejestracja Kandydata
                    </h1>
                    <p className="text-blue-100 text-sm">
                        Wprowadź swoje dane, aby rozpocząć. Hasło ustalisz po potwierdzeniu email.
                    </p>
                </div>

                <form onSubmit={handleFinalSubmit} className="p-8 space-y-5">
                        {companyName && (
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3 text-xs text-blue-700 font-bold mb-4">
                                <Building2 size={16}/> Rejestracja do firmy: {companyName}
                            </div>
                        )}
                        {referrerId && (
                            <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3 text-xs text-green-700 font-bold mb-4">
                                <CheckCircle size={16}/> Rejestrujesz się z polecenia znajomego!
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        className={`w-full pl-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-500' : 'border-slate-300'}`}
                                        placeholder="Jan"
                                        value={formData.firstName}
                                        onChange={e => setFormData({...formData, firstName: e.target.value})}
                                    />
                                </div>
                                {errors.firstName && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.firstName}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        className={`w-full pl-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-500' : 'border-slate-300'}`}
                                        placeholder="Kowalski"
                                        value={formData.lastName}
                                        onChange={e => setFormData({...formData, lastName: e.target.value})}
                                    />
                                </div>
                                {errors.lastName && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.lastName}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Adres Email *</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                        errors.email
                                            ? 'border-red-500'
                                            : touched.email && !isCheckingEmail && validateEmail(formData.email)
                                            ? 'border-green-500'
                                            : 'border-slate-300'
                                    }`}
                                    placeholder="jan.kowalski@example.com"
                                    value={formData.email}
                                    onChange={handleEmailChange}
                                    onBlur={() => handleBlur('email')}
                                    disabled={isCheckingEmail}
                                />
                                {isCheckingEmail && (
                                    <Loader2 size={18} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 animate-spin" />
                                )}
                                {!isCheckingEmail && touched.email && !errors.email && validateEmail(formData.email) && (
                                    <CheckCircle size={18} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500" />
                                )}
                                {!isCheckingEmail && errors.email && (
                                    <AlertCircle size={18} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500" />
                                )}
                            </div>
                            {errors.email && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.email}</p>}
                            {!isCheckingEmail && touched.email && !errors.email && validateEmail(formData.email) && (
                                <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle size={12} />Email jest dostępny</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Numer Telefonu *</label>
                            <div className="relative">
                                <Phone size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                                <input
                                    type="tel"
                                    className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                        errors.phone
                                            ? 'border-red-500'
                                            : touched.phone && !isCheckingPhone && validatePhone(formData.phone)
                                            ? 'border-green-500'
                                            : 'border-slate-300'
                                    }`}
                                    placeholder="+48 XXX XXX XXX"
                                    value={formData.phone}
                                    onChange={handlePhoneChange}
                                    onBlur={() => handleBlur('phone')}
                                    maxLength={15}
                                    disabled={isCheckingPhone}
                                />
                                {isCheckingPhone && (
                                    <Loader2 size={18} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 animate-spin" />
                                )}
                                {!isCheckingPhone && touched.phone && !errors.phone && validatePhone(formData.phone) && (
                                    <CheckCircle size={18} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500" />
                                )}
                                {!isCheckingPhone && errors.phone && (
                                    <AlertCircle size={18} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500" />
                                )}
                            </div>
                            {errors.phone && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.phone}</p>}
                            {!isCheckingPhone && touched.phone && !errors.phone && validatePhone(formData.phone) && (
                                <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle size={12} />Numer telefonu jest dostępny</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">CV / Załącznik (Opcjonalnie)</label>
                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                                {formData.resumeUrl ? <CheckCircle size={24} className="text-green-600"/> : <Upload size={24} className="text-slate-400"/>}
                                <span className="text-xs mt-1 text-slate-500">{formData.resumeFile ? formData.resumeFile.name : 'Kliknij, aby dodać plik'}</span>
                            </div>
                        </div>

                        <Button type="submit" fullWidth size="lg" className="mt-4 bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                            {isSubmitting ? 'Tworzenie konta...' : 'Zarejestruj się'}
                            {!isSubmitting && <ArrowRight size={18} className="ml-2" />}
                        </Button>
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-xs text-blue-700">
                                <CheckCircle size={14} className="inline mr-1" />
                                Po rejestracji otrzymasz email z linkiem do ustawienia hasła.
                            </p>
                        </div>
                    </form>
            </div>
        </div>
    );
};
