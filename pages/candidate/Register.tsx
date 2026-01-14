
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, Upload, ArrowRight, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { UserStatus } from '../../types';
import { uploadDocument, supabase } from '../../lib/supabase';

export const CandidateRegisterPage = () => {
    const { addCandidate, loginAsUser, state, updateUser } = useAppContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<'details' | 'password'>('details');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        resumeFile: null as File | null,
        resumeUrl: ''
    });

    const [passData, setPassData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);

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

    const validatePassword = () => {
        const newErrors: Record<string, string> = {};
        if (!passData.password) newErrors.password = 'Hasło jest wymagane';
        if (passData.password.length < 6) newErrors.password = 'Hasło musi mieć min. 6 znaków';
        if (passData.password !== passData.confirmPassword) newErrors.confirmPassword = 'Hasła nie są identyczne';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleDetailsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateDetails()) {
            setStep('password');
            setErrors({});
        }
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validatePassword()) return;
        
        console.log('=== CANDIDATE REGISTRATION START ===');
        setIsSubmitting(true);

        const cleanEmail = formData.email.trim().toLowerCase();

        try {
            console.log('Attempting Supabase Auth signUp for:', cleanEmail);
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: cleanEmail,
                password: passData.password,
                options: {
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

            console.log('Checking for existing public profile...');
            const { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('email', cleanEmail)
                .maybeSingle();

            let finalUser: any = null;

            if (existingUser) {
                console.log('Profile exists. Syncing ID and status...');
                const updates: any = {
                    id: authId,
                    status: UserStatus.STARTED,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    phone: formData.phone
                };
                if (referrerId) updates.referred_by_id = referrerId;

                const { data: updated, error: updateError } = await supabase
                    .from('users')
                    .update(updates)
                    .eq('email', cleanEmail)
                    .select()
                    .single();

                if (updateError) {
                    console.error('Update existing user error:', updateError);
                    throw updateError;
                }
                finalUser = updated;
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
                        referred_by_id: referrerId || null,
                        source: referrerId ? 'Polecenie (Link)' : 'Strona WWW (Rejestracja)',
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
                        {step === 'details' ? 'Rejestracja Kandydata' : 'Utwórz Hasło'}
                    </h1>
                    <p className="text-blue-100 text-sm">
                        {step === 'details' ? 'Wprowadź swoje dane, aby rozpocząć.' : 'Zabezpiecz swoje konto.'}
                    </p>
                </div>

                {step === 'details' ? (
                    <form onSubmit={handleDetailsSubmit} className="p-8 space-y-5">
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

                        <Button type="submit" fullWidth size="lg" className="mt-4 bg-blue-600 hover:bg-blue-700">Dalej <ArrowRight size={18} className="ml-2" /></Button>
                    </form>
                ) : (
                    <form onSubmit={handleFinalSubmit} className="p-8 space-y-6">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-4"><Lock size={32} /></div>
                            <h3 className="font-bold text-slate-900">Ustaw hasło</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Hasło</label>
                                <input type={showPassword ? "text" : "password"} className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-red-500' : 'border-slate-300'}`} placeholder="Min. 6 znaków" value={passData.password} onChange={e => setPassData({...passData, password: e.target.value})} />
                                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Powtórz Hasło</label>
                                <input type={showPassword ? "text" : "password"} className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.confirmPassword ? 'border-red-500' : 'border-slate-300'}`} placeholder="Powtórz hasło" value={passData.confirmPassword} onChange={e => setPassData({...passData, confirmPassword: e.target.value})} />
                                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button variant="ghost" onClick={() => setStep('details')} className="w-1/3">Wróć</Button>
                            <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={isSubmitting}>{isSubmitting ? 'Tworzenie...' : 'Zakończ rejestrację'}</Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
