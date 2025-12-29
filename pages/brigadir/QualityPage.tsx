
import React, { useState, useMemo, useRef } from 'react';
import { AlertTriangle, Lock, Camera, Upload, X, CheckCircle, Search, Calendar, Filter, Plus, User, Eye } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { SkillStatus, QualityIncident } from '../../types';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

export const BrigadirQualityPage = () => {
    const { state, addQualityIncident } = useAppContext();
    const { currentUser, users, userSkills, skills, qualityIncidents } = state;
    
    // View State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Modal State for viewing details
    const [selectedIncident, setSelectedIncident] = useState<QualityIncident | null>(null);
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // Form State
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedSkillId, setSelectedSkillId] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string>('');
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImageUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = () => {
        if (!selectedUserId || !selectedSkillId || !description || !incidentPrediction) return;
        if (!currentUser) return;

        addQualityIncident({
            user_id: selectedUserId,
            skill_id: selectedSkillId,
            date: new Date().toISOString(),
            incident_number: incidentPrediction.number,
            description: description,
            reported_by: `${currentUser.first_name} ${currentUser.last_name}`,
            image_url: imageUrl
        });

        setSelectedUserId('');
        setSelectedSkillId('');
        setDescription('');
        setImageFile(null);
        setImageUrl('');
        setIsFormOpen(false);
        setSuccessMsg('Zgłoszenie zostało dodane pomyślnie.');
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const stats = useMemo(() => {
        let warnings = 0;
        let blocks = 0;
        filteredIncidents.forEach(inc => {
            if (inc.incident_number === 1) warnings++;
            else blocks++;
        });
        return { warnings, blocks };
    }, [filteredIncidents]);

    const openImagePreview = (url: string) => {
        setFileViewer({
            isOpen: true,
            urls: [url],
            title: 'Dowód Zgłoszenia',
            index: 0
        });
    };

    // --- Detail Modal Renderer ---
    const renderDetailModal = () => {
        if (!selectedIncident) return null;
        const user = users.find(u => u.id === selectedIncident.user_id);
        const skill = skills.find(s => s.id === selectedIncident.skill_id);

        return (
            <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedIncident(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-900">Szczegóły Incydentu</h3>
                        <button onClick={() => setSelectedIncident(null)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    
                    <div className="space-y-4 overflow-y-auto pr-2">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Pracownik</span>
                            <div className="font-bold text-slate-900 text-lg">{user ? `${user.first_name} ${user.last_name}` : 'Nieznany'}</div>
                        </div>
                        
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Umiejętność</span>
                            <div className="font-medium text-slate-800">{skill?.name_pl || 'Nieznana'}</div>
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
                                    className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:opacity-90 transition-opacity relative group"
                                    onClick={() => openImagePreview(selectedIncident.image_url!)}
                                >
                                    <img src={selectedIncident.image_url} alt="Dowód" className="w-full object-contain max-h-[300px]" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-white/90 p-2 rounded-full shadow-lg">
                                            <Eye size={24} className="text-slate-700"/>
                                        </div>
                                    </div>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-1">Wszystkie zgłoszenia</div>
                    <div className="text-3xl font-bold text-slate-900">{filteredIncidents.length}</div>
                    <div className="text-xs text-slate-400 mt-2">W wybranym miesiącu</div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-yellow-200">
                    <div className="text-sm font-bold text-yellow-600 uppercase tracking-wide mb-1">Ostrzeżenia (1. błąd)</div>
                    <div className="text-3xl font-bold text-slate-900">{stats.warnings}</div>
                    <div className="text-xs text-slate-400 mt-2">Brak wpływu na stawkę</div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-red-200">
                    <div className="text-sm font-bold text-red-600 uppercase tracking-wide mb-1">Blokady (2.+ błąd)</div>
                    <div className="text-3xl font-bold text-slate-900">{stats.blocks}</div>
                    <div className="text-xs text-slate-400 mt-2">Anulowane dodatki</div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Szukaj pracownika..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Calendar size={18} className="text-slate-400"/>
                    <input 
                        type="month" 
                        className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm w-full md:w-auto"
                        value={monthFilter}
                        onChange={e => setMonthFilter(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Pracownik</th>
                            <th className="px-6 py-4">Umiejętność</th>
                            <th className="px-6 py-4">Skutek</th>
                            <th className="px-6 py-4">Opis</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredIncidents.map(inc => {
                            const user = users.find(u => u.id === inc.user_id);
                            const skill = skills.find(s => s.id === inc.skill_id);
                            const isBlock = inc.incident_number >= 2;

                            return (
                                <tr 
                                    key={inc.id} 
                                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                                    onClick={() => setSelectedIncident(inc)}
                                >
                                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                        {new Date(inc.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {user ? `${user.first_name} ${user.last_name}` : 'Nieznany'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-700">
                                        {skill?.name_pl}
                                        {skill && <div className="text-xs text-slate-400">Bonus: {skill.hourly_bonus} zł/h</div>}
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
                                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={inc.description}>
                                        {inc.description}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredIncidents.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400">
                                    Brak zgłoszeń w wybranym okresie.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ADD INCIDENT MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-bold text-slate-900">Nowe Zgłoszenie</h2>
                            <button onClick={() => setIsFormOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        
                        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Pracownik</label>
                                <select 
                                    className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedUserId}
                                    onChange={e => { setSelectedUserId(e.target.value); setSelectedSkillId(''); }}
                                >
                                    <option value="">Wybierz pracownika...</option>
                                    {myTeam.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Umiejętność (tylko potwierdzone)</label>
                                <select 
                                    className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                                    value={selectedSkillId}
                                    onChange={e => setSelectedSkillId(e.target.value)}
                                    disabled={!selectedUserId}
                                >
                                    <option value="">Wybierz umiejętność...</option>
                                    {availableSkillsForForm.map((s: any) => <option key={s.id} value={s.id}>{s.name_pl} (+{s.hourly_bonus} zł)</option>)}
                                </select>
                                {!selectedSkillId && selectedUserId && availableSkillsForForm.length === 0 && (
                                    <p className="text-xs text-slate-400 mt-1 italic">Ten pracownik nie ma jeszcze płatnych umiejętności.</p>
                                )}
                            </div>

                            {incidentPrediction && (
                                <div className={`p-4 rounded-lg border flex items-center gap-3 ${incidentPrediction.isBlock ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                    {incidentPrediction.isBlock ? <Lock size={24}/> : <AlertTriangle size={24}/>}
                                    <div>
                                        <div className="font-bold uppercase text-xs tracking-wider">
                                            Zgłoszenie nr {incidentPrediction.number} w tym miesiącu
                                        </div>
                                        <div className="font-bold text-sm mt-1">{incidentPrediction.label}</div>
                                        <div className="text-xs opacity-90 mt-1">{incidentPrediction.description}</div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Opis błędu</label>
                                <textarea 
                                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={3}
                                    placeholder="Opisz dokładnie na czym polegał błąd..."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Zdjęcie (Opcjonalne)</label>
                                <div className="flex gap-3">
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                    <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                                    
                                    <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} type="button">
                                        <Upload size={16} className="mr-2"/> Wybierz
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => cameraInputRef.current?.click()} type="button">
                                        <Camera size={16} className="mr-2"/> Zdjęcie
                                    </Button>
                                </div>
                                {imageUrl && (
                                    <div className="mt-4 relative w-fit group">
                                        <img src={imageUrl} alt="Dowód" className="h-24 w-auto rounded-lg border border-slate-200" />
                                        <button 
                                            onClick={() => { setImageUrl(''); setImageFile(null); }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                                        >
                                            <X size={12}/>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-4">
                            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Anuluj</Button>
                            <Button 
                                variant={incidentPrediction?.isBlock ? 'danger' : 'primary'}
                                onClick={handleSubmit} 
                                disabled={!selectedUserId || !selectedSkillId || !description}
                            >
                                Zatwierdź Zgłoszenie
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
