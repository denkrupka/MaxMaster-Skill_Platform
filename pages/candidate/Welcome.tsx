
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, TrendingUp, X, ChevronRight, Award } from 'lucide-react';
import { Button } from '../../components/Button';
import { useAppContext } from '../../context/AppContext';
import { Role } from '../../types';

export const CandidateWelcomePage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { state } = useAppContext();
    const [hasResigned, setHasResigned] = useState(false);

    // If user is already logged in as a candidate, redirect to dashboard
    React.useEffect(() => {
        if (state.currentUser && state.currentUser.role === Role.CANDIDATE) {
            navigate('/candidate/dashboard');
        }
    }, [state.currentUser, navigate]);

    const handleInterested = () => {
        const refId = searchParams.get('ref');
        const queryStr = refId ? `?ref=${refId}` : '';

        if (state.currentUser) {
            navigate('/candidate/dashboard');
        } else {
            // Proceed to Step 2 (Registration) and preserve referral ID
            navigate(`/candidate/register${queryStr}`);
        }
    };

    const handleResign = () => {
        setHasResigned(true);
    };

    if (hasResigned) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center animate-in fade-in duration-300">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-6">
                        <X size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Dziękujemy za decyzję</h2>
                    <p className="text-slate-500 mb-6">
                        Szanujemy Twój czas i decyzję. Twój status rekrutacji został zaktualizowany. 
                        W razie zmiany zdania zapraszamy ponownie w przyszłości.
                    </p>
                    <div className="text-sm text-slate-400">Możesz zamknąć to okno.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                {/* Header / Brand */}
                <div className="bg-blue-600 p-8 text-center">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 backdrop-blur-sm">
                        M
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">MaxMaster</h1>
                    <p className="text-blue-100 text-sm">Profesjonalne Usługi Techniczne</p>
                </div>

                <div className="p-8">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Witaj w procesie rekrutacji!</h2>
                    
                    <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                        Jesteśmy firmą, która stawia na jasne zasady. W MaxMaster wdrożyliśmy w pełni 
                        przejrzysty system wynagrodzeń oparty na realnych umiejętnościach.
                    </p>

                    <div className="space-y-4 mb-8">
                        <div className="flex gap-3 items-start">
                            <div className="mt-1 bg-green-100 p-1.5 rounded-full text-green-600">
                                <CheckCircle size={16} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Sprawdź swoje kompetencje</h3>
                                <p className="text-xs text-slate-500">Rozwiąż proste testy online bez wychodzenia z domu.</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 items-start">
                            <div className="mt-1 bg-blue-100 p-1.5 rounded-full text-blue-600">
                                <TrendingUp size={16} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Poznaj swoją stawkę</h3>
                                <p className="text-xs text-slate-500">System automatycznie wyliczy Twoje wynagrodzenie godzinowe.</p>
                            </div>
                        </div>

                        <div className="flex gap-3 items-start">
                            <div className="mt-1 bg-purple-100 p-1.5 rounded-full text-purple-600">
                                <Award size={16} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Rozwój i Premie</h3>
                                <p className="text-xs text-slate-500">Jasna ścieżka awansu i bonusy za jakość pracy.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100">
                        <Button 
                            fullWidth 
                            size="lg" 
                            onClick={handleInterested}
                            className="bg-blue-600 hover:bg-blue-700 shadow-md group"
                        >
                            Jestem zainteresowany współpracą
                            <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform"/>
                        </Button>
                        
                        <Button 
                            fullWidth 
                            variant="ghost" 
                            onClick={handleResign}
                            className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                        >
                            Rezygnuję z rekrutacji
                        </Button>
                    </div>
                </div>
            </div>
            
            <p className="mt-6 text-xs text-slate-400">
                &copy; {new Date().getFullYear()} MaxMaster Sp. z o.o. Wszelkie prawa zastrzeżone.
            </p>
        </div>
    );
};
