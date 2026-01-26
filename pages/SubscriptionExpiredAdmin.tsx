
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/Button';

export const SubscriptionExpiredAdminPage = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();

    const handleGoToSubscription = () => {
        navigate('/company/subscription');
    };

    const userName = state.currentUser?.first_name || 'Administratorze';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
            <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-blue-400/20 rounded-full blur-xl"></div>

                    <div className="relative">
                        <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 backdrop-blur-md border border-white/10">
                            <CreditCard size={40} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Subskrypcja Wygasła</h1>
                    </div>
                </div>

                <div className="p-8 text-center space-y-6">
                    <div>
                        <p className="text-xl font-bold text-slate-900 mb-2">
                            {userName}, Twoja subskrypcja dobiegła końca
                        </p>
                        <p className="text-slate-600 font-medium leading-relaxed">
                            Aby kontynuować korzystanie z portalu i odblokować dostęp do wszystkich funkcji, odnów swoją subskrypcję.
                        </p>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex items-start gap-3 text-left">
                        <div className="mt-0.5 bg-white p-1.5 rounded-lg text-amber-600 shadow-sm shrink-0">
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-800 mb-1">
                                Dostęp ograniczony
                            </p>
                            <p className="text-xs text-amber-700 leading-tight">
                                Wszystkie dane Twojej firmy i pracowników są bezpieczne. Po odnowieniu subskrypcji odzyskasz pełny dostęp.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleGoToSubscription}
                            className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20 h-14 text-base font-black uppercase tracking-widest rounded-2xl"
                        >
                            <CreditCard size={20} className="mr-2" />
                            Subskrypcja
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
