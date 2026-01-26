
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, AlertTriangle, Building2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/Button';

export const SubscriptionExpiredUserPage = () => {
    const { state, logout } = useAppContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const userName = state.currentUser?.first_name || 'Pracowniku';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
            <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
                <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-slate-500/20 rounded-full blur-xl"></div>

                    <div className="relative">
                        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 backdrop-blur-md border border-white/10">
                            <Building2 size={40} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Subskrypcja Wygasła</h1>
                    </div>
                </div>

                <div className="p-8 text-center space-y-6">
                    <div>
                        <p className="text-xl font-bold text-slate-900 mb-2">
                            {userName}, subskrypcja Twojej firmy dobiegła końca
                        </p>
                        <p className="text-slate-600 font-medium leading-relaxed">
                            Aby ponownie uzyskać dostęp do swojego konta, skontaktuj się z Administratorem Twojej firmy w celu wznowienia subskrypcji.
                        </p>
                    </div>

                    <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 flex items-start gap-3 text-left">
                        <div className="mt-0.5 bg-white p-1.5 rounded-lg text-slate-600 shadow-sm shrink-0">
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800 mb-1">
                                Dostęp tymczasowo zablokowany
                            </p>
                            <p className="text-xs text-slate-600 leading-tight">
                                Twoje dane są bezpieczne. Po wznowieniu subskrypcji przez Administratora, automatycznie odzyskasz dostęp do wszystkich funkcji.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleLogout}
                            className="bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-900/10 h-14 text-base font-black uppercase tracking-widest rounded-2xl"
                        >
                            <LogOut size={20} className="mr-2" />
                            Wyloguj
                        </Button>
                    </div>
                </div>
            </div>

            <p className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                MaxMaster Sp. z o.o.
            </p>
        </div>
    );
};
