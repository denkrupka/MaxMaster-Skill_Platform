
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, Upload, ArrowRight, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { UserStatus } from '../../types';

export const CandidateRegisterPage = () => {
    const { addCandidate, loginAsUser, state, updateUser } = useAppContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<'details' | 'password'>('details');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form Data
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        resumeUrl: ''
    });

    // Password Data
    const [passData, setPassData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Check for referral ID
    const referrerId = searchParams.get('ref');

    // --- Validators ---

    const validateDetails = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.firstName.trim()) newErrors.firstName = 'Imię jest wymagane';
        if (!formData.lastName.trim()) newErrors.lastName = 'Nazwisko jest wymagane';
        if (!formData.email.trim()) newErrors.email = 'Email jest wymagany';
        else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = 'Nieprawidłowy format email';
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

    // --- Handlers ---

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
        
        setIsSubmitting(true);

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Check if user exists (mock "linking" if HR already added them via Invite)
        const existingUser = state.users.find(u => u.email.toLowerCase() === formData.email.toLowerCase());
        
        let userToLogin: any = null;
        if (existingUser) {
            userToLogin = existingUser;
            // Update status to STARTED if they were INVITED
            const updates: any = { status: UserStatus.STARTED };
            // If they registered via a ref link and didn't have a referrer, add it
            if (referrerId && !existingUser.referred_by_id) {
                updates.referred_by_id = referrerId;
                const refUser = state.users.find(u => u.id === referrerId);
                if (refUser) {
                    updates.source = `Polecenie (Link): ${refUser.first_name} ${refUser.last_name}`;
                }
            }
            updateUser(existingUser.id, updates);
        } else {
            const referrer = referrerId ? state.users.find(u => u.id === referrerId) : null;
            userToLogin = addCandidate({
                first_name: formData.firstName,
                last_name: formData.lastName,
                email: formData.email,
                phone: formData.phone,
                resume_url: formData.resumeUrl,
                referred_by_id: referrerId || undefined,
                source: referrer ? `Polecenie (Link): ${referrer.first_name} ${referrer.last_name}` : 'Strona WWW (Rejestracja)',
                notes: 'Zarejestrowany przez formularz www.'
            });
        }

        loginAsUser(userToLogin);
        navigate('/candidate/dashboard');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, resumeUrl: url }));
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="bg-blue-600 p-6 text-center">
                    <h1 className="text-2xl font-bold text-white mb-2">
                        {step === 'details' ? 'Rejestracja Kandydata' : 'Utwórz Hasło'}
                    </h1>
                    <p className="text-blue-100 text-sm">
                        {step === 'details' ? 'Wprowadź swoje dane, aby rozpocząć.' : 'Zabezpiecz swoje konto, aby mieć dostęp do wyników.'}
                    </p>
                </div>

                {step === 'details' ? (
                    <form onSubmit={handleDetailsSubmit} className="p-8 space-y-5">
                        {referrerId && (
                            <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3 text-xs text-green-700 font-bold mb-4">
                                <CheckCircle size={16}/> Rejestrujesz się z polecenia znajomego!
                            </div>
                        )}
                        
                        <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800 mb-6">
                            Dane te są nam potrzebne do kontaktu w sprawie wyników testów oraz przygotowania ewentualnej umowy.
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-500' : 'border-slate-300'}`}
                                        placeholder="Jan"
                                        value={formData.firstName}
                                        onChange={e => setFormData({...formData, firstName: e.target.value})}
                                    />
                                </div>
                                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                                <input 
                                    type="text" 
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-500' : 'border-slate-300'}`}
                                    placeholder="Kowalski"
                                    value={formData.lastName}
                                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                                />
                                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Adres Email *</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="email" 
                                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : 'border-slate-300'}`}
                                    placeholder="jan.kowalski@example.com"
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Numer Telefonu *</label>
                            <div className="relative">
                                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="tel" 
                                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-500' : 'border-slate-300'}`}
                                    placeholder="+48 000 000 000"
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                />
                            </div>
                            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">CV / Załącznik (Opcjonalnie)</label>
                            <div 
                                className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept=".pdf,.doc,.docx,image/*" 
                                    onChange={handleFileChange}
                                />
                                {formData.resumeUrl ? (
                                    <div className="text-center text-green-600">
                                        <CheckCircle size={24} className="mx-auto mb-1" />
                                        <span className="text-sm font-medium">Plik załączony</span>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400">
                                        <Upload size={24} className="mx-auto mb-1" />
                                        <span className="text-sm">Kliknij, aby dodać plik</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button type="submit" fullWidth size="lg" className="mt-4 bg-blue-600 hover:bg-blue-700">
                            Dalej
                            <ArrowRight size={18} className="ml-2" />
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleFinalSubmit} className="p-8 space-y-6 animate-in slide-in-from-right duration-300">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-4">
                                <Lock size={32} />
                            </div>
                            <h3 className="font-bold text-slate-900">Ustaw hasło dostępu</h3>
                            <p className="text-slate-500 text-sm mt-1">
                                {formData.firstName}, ostatni krok. Utwórz hasło, aby zalogować się do swojego profilu.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Hasło</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-red-500' : 'border-slate-300'}`}
                                        placeholder="Min. 6 znaków"
                                        value={passData.password}
                                        onChange={e => setPassData({...passData, password: e.target.value})}
                                    />
                                    <button 
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Powtórz Hasło</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.confirmPassword ? 'border-red-500' : 'border-slate-300'}`}
                                        placeholder="Powtórz hasło"
                                        value={passData.confirmPassword}
                                        onChange={e => setPassData({...passData, confirmPassword: e.target.value})}
                                    />
                                </div>
                                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button variant="ghost" onClick={() => setStep('details')} className="w-1/3">
                                Wróć
                            </Button>
                            <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={isSubmitting}>
                                {isSubmitting ? 'Tworzenie konta...' : 'Zakończ i Przejdź do Profilu'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
            
            <p className="mt-6 text-xs text-slate-400">
                &copy; {new Date().getFullYear()} MaxMaster Sp. z o.o.
            </p>
        </div>
    );
};
