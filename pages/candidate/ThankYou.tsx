
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, Award } from 'lucide-react';
import { Button } from '../../components/Button';

export const CandidateThankYouPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
                <div className="bg-green-600 p-8 text-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-green-600 mx-auto mb-4 shadow-lg animate-bounce">
                        <CheckCircle size={40} strokeWidth={3} />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Gratulacje!</h1>
                    <p className="text-green-100 font-medium">Proces weryfikacji zakończony.</p>
                </div>

                <div className="p-8 text-center space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-slate-900">Dziękujemy za poświęcony czas!</h2>
                        <p className="text-slate-500 leading-relaxed">
                            Twoje odpowiedzi zostały zapisane w systemie. <br/>
                            Dzięki temu mogliśmy precyzyjnie oszacować Twój potencjał oraz proponowaną stawkę godzinową.
                        </p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3 text-left">
                        <div className="mt-1 bg-blue-100 p-1.5 rounded-full text-blue-600 shrink-0">
                            <Award size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Co dalej?</h3>
                            <p className="text-xs text-slate-600 mt-1">
                                Przejdź do panelu głównego, aby zobaczyć podsumowanie swoich wyników i zaktualizowaną symulację wynagrodzenia.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button 
                            fullWidth 
                            size="lg" 
                            onClick={() => navigate('/candidate/dashboard')}
                            className="bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-900/10 h-14 text-base"
                        >
                            Zobacz wyniki i symulację swojej stawki
                            <ArrowRight size={20} className="ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
            
            <p className="mt-8 text-xs text-slate-400">
                MaxMaster Sp. z o.o.
            </p>
        </div>
    );
};
