
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, Upload, ArrowRight, CheckCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { UserStatus } from '../../types';
import { uploadDocument, supabase } from '../../lib/supabase';

export const CandidateRegisterPage = () => {
    const { addCandidate, loginAsUser, state, updateUser } = useAppContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        resumeFile: null as File | null,
        resumeUrl: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const referrerId = searchParams.get('ref');

    const validateDetails = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.firstName.trim()) newErrors.firstName = 'Imię jest wymagane';
        if (!formData.lastName.trim()) newErrors.lastName = 'Nazwisko jest wymagane';
        if (!formData.email.trim()) newErrors.email = 'Email jest wymagany';
        else if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) newErrors.email = 'Nieprawidłowy format email';
        if (!formData.phone.trim()) newErrors.phone = 'Numer telefonu jest wymagany';
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
        if (!validateDetails()) return;
        
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
                    emailRedirectTo: `${window.location.origin}/#/setup-password`,
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
                        hired_date: existingUser.hired_date || new Date().toISOString()
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
                        hired_date: new Date().toISOString()
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
            navigate('/candidate/dashboard');
            
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

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
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
                        {referrerId && (
                            <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3 text-xs text-green-700 font-bold mb-4">
                                <CheckCircle size={16}/> Rejestrujesz się z polecenia znajomego!
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                                <input type="text" className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-500' : 'border-slate-300'}`} placeholder="Jan" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                                <input type="text" className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-500' : 'border-slate-300'}`} placeholder="Kowalski" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Adres Email *</label>
                            <input type="email" className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : 'border-slate-300'}`} placeholder="jan.kowalski@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Numer Telefonu *</label>
                            <input type="tel" className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-500' : 'border-slate-300'}`} placeholder="+48 000 000 000" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
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
