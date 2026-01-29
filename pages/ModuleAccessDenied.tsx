
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, Lock, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/Button';
import { MODULE_LABELS } from '../constants';
import { Role } from '../types';

export const ModuleAccessDeniedPage = () => {
    const { state, logout } = useAppContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const moduleCode = searchParams.get('module') || 'unknown';
    const moduleName = MODULE_LABELS[moduleCode] || moduleCode;

    const userName = state.currentUser?.first_name || 'Użytkowniku';

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleGoBack = () => {
        // Navigate to appropriate dashboard based on role
        const role = state.currentUser?.role;
        switch (role) {
            case Role.HR:
                navigate('/hr/dashboard');
                break;
            case Role.COORDINATOR:
                navigate('/coordinator/dashboard');
                break;
            case Role.BRIGADIR:
                navigate('/brigadir/dashboard');
                break;
            case Role.EMPLOYEE:
                navigate('/dashboard');
                break;
            case Role.CANDIDATE:
                navigate('/candidate/dashboard');
                break;
            default:
                navigate(-1);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
                <div className="bg-gradient-to-br from-amber-500 to-amber-700 px-6 py-5 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-amber-400/20 rounded-full blur-xl"></div>

                    <div className="relative flex items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white backdrop-blur-md border border-white/10">
                            <Lock size={24} className="text-white" />
                        </div>
                        <h1 className="text-xl font-black text-white uppercase tracking-tight">Brak Dostępu</h1>
                    </div>
                </div>

                <div className="px-5 py-4 text-center space-y-3">
                    <div>
                        <p className="text-base font-bold text-slate-900 mb-1.5">
                            {userName}, nie masz dostępu do modułu
                        </p>
                        <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg mb-2">
                            <ShieldAlert size={16} className="text-amber-600" />
                            <span className="text-sm font-bold text-amber-700">{moduleName}</span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-snug">
                            Aby uzyskać dostęp, skontaktuj się z Administratorem Twojej firmy.
                        </p>
                    </div>

                    <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex items-start gap-2.5 text-left">
                        <div className="mt-0.5 bg-white p-1 rounded-md text-slate-600 shadow-sm shrink-0">
                            <ShieldAlert size={14} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-800 mb-0.5">
                                Dostęp ograniczony
                            </p>
                            <p className="text-[11px] text-slate-600 leading-tight">
                                Twoje konto nie ma przypisanego dostępu do tego modułu. Administrator firmy może przyznać Ci dostęp w panelu zarządzania użytkownikami.
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 space-y-2">
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleGoBack}
                            className="bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-900/10 h-11 text-sm font-black uppercase tracking-widest rounded-xl"
                        >
                            <ArrowLeft size={18} className="mr-2" />
                            Wróć do Panelu
                        </Button>
                        <Button
                            fullWidth
                            size="lg"
                            variant="outline"
                            onClick={handleLogout}
                            className="h-11 text-sm font-bold rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                        >
                            <LogOut size={18} className="mr-2" />
                            Wyloguj
                        </Button>
                    </div>
                </div>
            </div>

            <p className="mt-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                MaxMaster Sp. z o.o.
            </p>
        </div>
    );
};
