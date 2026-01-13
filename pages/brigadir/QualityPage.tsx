
import React, { useState, useMemo, useRef } from 'react';
import { AlertTriangle, Lock, Camera, Upload, X, CheckCircle, Search, Calendar, Filter, Plus, User, Eye, Loader2, Image as ImageIcon } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { SkillStatus, QualityIncident } from '../../types';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';

export const BrigadirQualityPage = () => {
    const { state, addQualityIncident } = useAppContext();
    const { currentUser, users, userSkills, skills, qualityIncidents } = state;
    
    // View State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [isUploading, setIsUploading] = useState(false);

    // Modal State for viewing details
    const [selectedIncident, setSelectedIncident] = useState<QualityIncident | null>(null);
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // Form State
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedSkillId, setSelectedSkillId] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [successMsg, setSuccessMsg] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // --- DATA PREPARATION ---

    const myTeam = useMemo(() => {
        if (!currentUser) return [];
        return users.filter(u => u.assigned_brigadir_id === currentUser.id);
    }, [currentUser, users]);

    const myTeamIds = useMemo(() => myTeam.map(u => u.id), [myTeam]);

    const filteredIncidents = useMemo(() => {
        return qualityIncidents
            .filter(inc => {
                const incDate = new Date(inc.date);
                const incMonth = incDate.toISOString().slice(0, 7);
                const matchesTeam = myTeamIds.includes(inc.user_id);
                const matchesMonth = monthFilter === 'all' || incMonth === monthFilter;
                
                const user = users.find(u => u.id === inc.user_id);
                const matchesSearch = search === '' || 
                    (user && (user.first_name.toLowerCase().includes(search.toLowerCase()) || user.last_name.toLowerCase().includes(search.toLowerCase())));

                return matchesTeam && matchesMonth && matchesSearch;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [qualityIncidents, myTeamIds, monthFilter, search, users]);

    const availableSkillsForForm = useMemo(() => {
        if (!selectedUserId) return [];
        return userSkills
            .filter(us => us.user_id === selectedUserId && us.status === SkillStatus.CONFIRMED)
            .map(us => skills.find(s => s.id === us.skill_id))
            .filter(Boolean);
    }, [selectedUserId, userSkills, skills]);

    const incidentPrediction = useMemo(() => {
        if (!selectedUserId || !selectedSkillId) return null;
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const existingCount = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === selectedUserId && 
                   inc.skill_id === selectedSkillId &&
                   d.getMonth() === currentMonth &&
                   d.getFullYear() === currentYear;
        }).length;

        const nextNumber = existingCount + 1;
        const isBlock = nextNumber >= 2;

        return {
            number: nextNumber,
            isBlock,
            label: isBlock ? 'ANULOWANIE DODATKU' : 'OSTRZEŻENIE USTNE',
            description: isBlock 
                ? 'Drugi błąd w miesiącu. Dodatek za tę umiejętność zostanie odjęty z wypłaty w tym miesiącu.' 
                : 'Pierwszy błąd w miesiącu. Upomnienie, dodatek zostaje zachowany.'
        };
    }, [selectedUserId, selectedSkillId, qualityIncidents]);

    // --- ACTIONS ---

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0 && selectedUserId) {
            setIsUploading(true);
            try {
                const uploadedUrls: string[] = [];
                for (let i = 0; i < files.length; i++) {
                    const url = await uploadDocument(files[i], selectedUserId);
                    if (url) uploadedUrls.push(url);
                }
                setImageUrls(prev => [...prev, ...uploadedUrls]);
            } catch (error) {
                console.error("Quality upload error", error);
                alert("Nie udało się przesłać zdjęć.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const removeImageFromForm = (urlToRemove: string) => {
        setImageUrls(prev => prev.filter(url => url !== urlToRemove));
    };

    const handleSubmit = () => {
        if (!selectedUserId || !selectedSkillId || !description || !incidentPrediction || !currentUser || imageUrls.length === 0) return;

        addQualityIncident({
            user_id: selectedUserId,
            skill_id: selectedSkillId,
            date: new Date().toISOString(),
            incident_number: incidentPrediction.number,
            description: description,
            reported_by: `${currentUser.first_name} ${currentUser.last_name}`,
            image_urls: imageUrls,
            image_url: imageUrls[0] || undefined
        });

        setSelectedUserId('');
        setSelectedSkillId('');
        setDescription('');
        setImageUrls([]);
        setIsFormOpen(false);
        setSuccessMsg('Zgłoszenie zostało dodane pomyślnie.');
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const openIncidentDetail = (inc: QualityIncident) => {
        setSelectedIncident(inc);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Jakość i Błędy</h1>
                    <p className="text-slate-500">Rejestr zgłoszeń jakościowych (Zasada 1/2).</p>
                </div>
                <Button onClick={() => setIsFormOpen(true)}>
                    <Plus size={18} className="mr-2"/> Zgłoś Błąd
                </Button>
            </div>

            {successMsg && (
                <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle size={20}/> {successMsg}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Pracownik</th>
                            <th className="px-6 py-4">Umiejętność</th>
                            <th className="px-6 py-4">Foto</th>
                            <th className="px-6 py-4">Skutek</th>
                            <th className="px-6 py-4 text-right">Akcja</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredIncidents.map(inc => {
                            const user = users.find(u => u.id === inc.user_id);
                            const skill = skills.find(s => s.id === inc.skill_id);
                            const isBlock = inc.incident_number >= 2;
                            const urls = inc.image_urls || (inc.image_url ? [inc.image_url] : []);

                            return (
                                <tr key={inc.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openIncidentDetail(inc)}>
                                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{new Date(inc.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900">{user ? `${user.first_name} ${user.last_name}` : 'Nieznany'}</td>
                                    <td className="px-6 py-4 text-slate-700">{skill?.name_pl}</td>
                                    <td className="px-6 py-4 text-blue-600 font-bold">
                                        {urls.length > 0 ? (
                                            <span className="flex items-center gap-1"><ImageIcon size={14}/> {urls.length}</span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isBlock ? (
                                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">
                                                <Lock size={12}/> Anulowanie dodatku
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold border border-yellow-200">
                                                <AlertTriangle size={12}/> Ostrzeżenie (1/2)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button size="sm" variant="ghost"><Eye size={16}/></Button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredIncidents.length === 0 && (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400">Brak zgłoszeń w wybranym okresie.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6 border-b pb-4"><h2 className="text-xl font-bold text-slate-900">Nowe Zgłoszenie</h2><button onClick={() => setIsFormOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button></div>
                        <div className="space-y-6 overflow-y-auto flex-1 pr-1">
                            {isUploading && (
                                <div className="p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2 text-sm font-medium animate-pulse">
                                    <Loader2 size={16} className="animate-spin"/> Przesyłanie zdjęć...
                                </div>
                            )}

                            <div><label className="block text-sm font-bold text-slate-700 mb-2">Pracownik</label><select className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={selectedUserId} onChange={e => { setSelectedUserId(e.target.value); setSelectedSkillId(''); }}><option value="">Wybierz pracownika...</option>{myTeam.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-2">Umiejętność (tylko potwierdzone)</label><select className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50" value={selectedSkillId} onChange={e => setSelectedSkillId(e.target.value)} disabled={!selectedUserId}><option value="">Wybierz umiejętność...</option>{availableSkillsForForm.map((s: any) => <option key={s.id} value={s.id}>{s.name_pl} (+{s.hourly_bonus} zł)</option>)}</select></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-2">Opis błędu</label><textarea className="w-full border border-slate-300 rounded-lg p-3 h-24 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Opisz dokładnie błąd..." value={description} onChange={e => setDescription(e.target.value)}/></div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Zdjęcia (Dowody) *</label>
                                <div className="flex flex-wrap gap-3 mb-3">
                                    {imageUrls.map((url, idx) => (
                                        <div key={idx} className="relative w-20 h-20 group">
                                            <img src={url} alt="Dowód" className="w-full h-full object-cover rounded-lg border border-slate-200" />
                                            <button 
                                                onClick={() => removeImageFromForm(url)}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12}/>
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => cameraInputRef.current?.click()}
                                        disabled={isUploading || !selectedUserId}
                                        className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-all bg-slate-50 disabled:opacity-50"
                                    >
                                        <Camera size={24}/>
                                        <span className="text-[8px] font-bold mt-1 uppercase">Zrób zdjęcie</span>
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                    <input type="file" multiple ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                                    <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || !selectedUserId}><Upload size={14} className="mr-1"/> Wybierz z galerii</Button>
                                </div>
                            </div>

                            {incidentPrediction && (
                                <div className={`p-4 rounded-xl border ${incidentPrediction.isBlock ? 'bg-red-50 border-red-100 text-red-800' : 'bg-yellow-50 border-yellow-100 text-yellow-800'}`}>
                                    <h4 className="font-bold text-sm mb-1">{incidentPrediction.label}</h4>
                                    <p className="text-xs opacity-90 leading-relaxed">{incidentPrediction.description}</p>
                                </div>
                            )}
                        </div>
                        <div className="pt-6 flex justify-end gap-3 border-t mt-4"><Button variant="ghost" onClick={() => setIsFormOpen(false)}>Anuluj</Button><Button variant={incidentPrediction?.isBlock ? 'danger' : 'primary'} onClick={handleSubmit} disabled={!selectedUserId || !selectedSkillId || !description || isUploading || imageUrls.length === 0}>Zatwierdź Zgłoszenie</Button></div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {selectedIncident && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedIncident(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h3 className="text-xl font-bold text-slate-900">Szczegóły Incydentu</h3>
                            <button onClick={() => setSelectedIncident(null)}><X size={24} className="text-slate-400 hover:text-slate-600 transition-colors"/></button>
                        </div>
                        <div className="space-y-4 overflow-y-auto pr-2">
                            <div><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Umiejętność</span><div className="font-black text-slate-900 text-lg leading-tight mt-1">{skills.find(s => s.id === selectedIncident.skill_id)?.name_pl || 'Nieznana'}</div></div>
                            <div className="flex gap-8">
                                <div><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Data Zdarzenia</span><div className="text-sm text-slate-700 font-bold mt-1">{new Date(selectedIncident.date).toLocaleDateString()}</div></div>
                                <div><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Osoba Zgłaszająca</span><div className="text-sm text-slate-700 font-bold mt-1">{selectedIncident.reported_by}</div></div>
                            </div>
                            <div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Opis</span>
                                <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-2 font-medium leading-relaxed">{selectedIncident.description}</p>
                            </div>
                            
                            {(() => {
                                const urls = selectedIncident.image_urls || (selectedIncident.image_url ? [selectedIncident.image_url] : []);
                                if (urls.length === 0) return null;
                                return (
                                    <div>
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Dokumentacja fotograficzna ({urls.length})</span>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            {urls.map((url, i) => (
                                                <div 
                                                    key={i} 
                                                    className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:opacity-90 transition-opacity shadow-sm h-32"
                                                    onClick={() => setFileViewer({isOpen: true, urls, title: 'Dowód Jakości', index: i})}
                                                >
                                                    <img src={url} alt="Dowód" className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end"><Button onClick={() => setSelectedIncident(null)}>Zamknij</Button></div>
                    </div>
                </div>
            )}

            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} initialIndex={fileViewer.index} title={fileViewer.title} />
        </div>
    );
};
