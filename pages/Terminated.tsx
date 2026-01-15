
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, LogOut, ShieldAlert } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/Button';

export const TerminatedPage = () => {
    const { logout } = useAppContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
            <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
                <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-blue-600/10 rounded-full blur-2xl"></div>
                    <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 backdrop-blur-md">
                        <Heart size={40} className="text-red-400 fill-red-400/20" />
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight">Koniec Współpracy</h1>
                </div>

                <div className="p-8 text-center space-y-6">
                    <p className="text-slate-600 font-medium leading-relaxed">
                        Dziękujemy za współpracę. Miło nam było z Tobą pracować, ale ponieważ zakończyliśmy naszą współpracę, nie masz już dostępu do portalu.
                    </p>
                    
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3 text-left">
                        <div className="mt-0.5 bg-white p-1.5 rounded-lg text-blue-600 shadow-sm shrink-0">
                            <ShieldAlert size={18} />
                        </div>
                        <p className="text-xs text-blue-800 font-bold leading-tight">
                            Twój dostęp do materiałów szkoleniowych oraz Matrycy Umiejętności wygasł.
                        </p>
                    </div>

                    <div className="pt-4">
                        <Button 
                            fullWidth 
                            size="lg" 
                            onClick={handleLogout}
                            className="bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-900/10 h-14 text-base font-black uppercase tracking-widest rounded-2xl"
                        >
                            <LogOut size={20} className="mr-2" />
                            Wróć do logowania
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
