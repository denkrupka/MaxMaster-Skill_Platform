
import React, { useState } from 'react';
import { AlertTriangle, Lock, ShieldCheck, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { QualityIncident } from '../../types';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

export const EmployeeQualityHistory = () => {
    const { state } = useAppContext();
    const { currentUser, qualityIncidents, skills } = state;
    const [selectedIncident, setSelectedIncident] = useState<QualityIncident | null>(null);
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    if (!currentUser) return null;

    const myIncidents = qualityIncidents
        .filter(inc => inc.user_id === currentUser.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const openImagePreview = (url: string) => {
        setFileViewer({
            isOpen: true,
            urls: [url],
            title: 'Dowód Zgłoszenia',
            index: 0
        });
    };

    const renderDetailModal = () => {
        if (!selectedIncident) return null;
        const skill = skills.find(s => s.id === selectedIncident.skill_id);

        return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedIncident(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-900">Szczegóły Incydentu</h3>
                        <button onClick={() => setSelectedIncident(null)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    
                    <div className="space-y-4 overflow-y-auto pr-2">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Umiejętność</span>
                            <div className="font-bold text-slate-900 text-lg">{skill?.name_pl || 'Nieznana'}</div>
                        </div>

                        <div className="flex gap-4">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase">Data</span>
                                <div className="text-sm text-slate-700">{new Date(selectedIncident.date).toLocaleDateString()} {new Date(selectedIncident.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase">Zgłosił</span>
                                <div className="text-sm text-slate-700">{selectedIncident.reported_by}</div>
                            </div>
                        </div>

                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Typ Zdarzenia</span>
                            <div className="mt-1">
                                {selectedIncident.incident_number === 1 ? (
                                    <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded border border-yellow-200 flex items-center w-fit gap-1">
                                        <AlertTriangle size={12}/> 1. Ostrzeżenie
                                    </span>
                                ) : (
                                    <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded border border-red-200 flex items-center w-fit gap-1">
                                        <Lock size={12}/> Blokada Miesiąca
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Opis</span>
                            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-100 mt-1">
                                {selectedIncident.description}
                            </p>
                        </div>

                        {selectedIncident.image_url && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase">Zdjęcie / Dowód</span>
                                <div 
                                    className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => openImagePreview(selectedIncident.image_url!)}
                                >
                                    <img src={selectedIncident.image_url} alt="Dowód" className="w-full object-contain max-h-[300px]" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                        <Button onClick={() => setSelectedIncident(null)}>Zamknij</Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-5xl mx-auto pb-24">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Historia Jakości</h1>
            <p className="text-slate-500 mb-8">
                Przegląd zgłoszonych incydentów jakościowych i ich wpływ na Twoje dodatki.
            </p>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Umiejętność</th>
                            <th className="px-6 py-4">Zdarzenie</th>
                            <th className="px-6 py-4">Opis</th>
                            <th className="px-6 py-4">Zgłosił</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {myIncidents.map(inc => {
                            const skill = skills.find(s => s.id === inc.skill_id);
                            return (
                                <tr 
                                    key={inc.id} 
                                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                                    onClick={() => setSelectedIncident(inc)}
                                >
                                    <td className="px-6 py-4 text-slate-500">
                                        {new Date(inc.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {skill?.name_pl || 'Nieznana'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {inc.incident_number === 1 ? (
                                            <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded border border-yellow-200 flex items-center w-fit gap-1">
                                                <AlertTriangle size={12}/> 1. Ostrzeżenie
                                            </span>
                                        ) : (
                                            <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded border border-red-200 flex items-center w-fit gap-1">
                                                <Lock size={12}/> Blokada Miesiąca
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                                        {inc.description}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">
                                        {inc.reported_by}
                                    </td>
                                </tr>
                            );
                        })}
                        {myIncidents.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <ShieldCheck size={48} className="mb-4 text-green-500 opacity-50"/>
                                        <p className="font-medium text-slate-600">Brak incydentów!</p>
                                        <p className="text-sm">Twoja praca jest wzorowa. Tak trzymaj!</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {renderDetailModal()}

            <DocumentViewerModal 
                isOpen={fileViewer.isOpen}
                onClose={() => setFileViewer({ ...fileViewer, isOpen: false })}
                urls={fileViewer.urls}
                initialIndex={fileViewer.index}
                title={fileViewer.title}
            />
        </div>
    );
};
