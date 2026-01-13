
import React, { useState, useEffect, useMemo } from 'react';
import { 
    User as UserIcon, Bell, Settings as SettingsIcon, Save, Lock, Mail, Phone,
    Shield, Check, Plus, Trash2, Briefcase, DollarSign, List, 
    ChevronUp, ChevronDown, Award, HardHat, TrendingUp, X, CheckCircle2, 
    ShieldCheck, Zap, ChevronRight, Star, Info, ShieldAlert, FileText,
    UserPlus, CheckSquare, AlertTriangle, Network, Clock, Cloud, RefreshCw,
    GripVertical, ArrowUp, ArrowDown, Layers
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Role, ContractType, NotificationSetting, Position, Skill, SkillCategory, VerificationType, BonusDocumentType } from '../../types';

type TabType = 'general' | 'positions' | 'system';

export const HRSettingsPage = () => {
    const { state, updateUser, updateSystemConfig, addPosition, updatePosition, deletePosition, reorderPositions } = useAppContext();
    const { currentUser, systemConfig, positions, skills } = state;
    const [activeTab, setActiveTab] = useState<TabType>('positions');
    const [successMsg, setSuccessMsg] = useState('');

    const roundToHalf = (num: number) => Math.round(num * 2) / 2;

    const [profileData, setProfileData] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', confirmPassword: '' });
    useEffect(() => { if (currentUser) setProfileData({ first_name: currentUser.first_name, last_name: currentUser.last_name, email: currentUser.email, phone: currentUser.phone || '', password: '', confirmPassword: '' }); }, [currentUser]);

    const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<Partial<Position> | null>(null);
    const [newResp, setNewResp] = useState('');

    const sortedPositions = useMemo(() => [...positions].sort((a, b) => a.order - b.order), [positions]);

    const [localSystemConfig, setLocalSystemConfig] = useState(systemConfig);
    const [newReason, setNewReason] = useState('');
    useEffect(() => { setLocalSystemConfig(systemConfig); }, [systemConfig]);

    const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };
    
    const handleSaveGeneral = () => { 
        if (currentUser) { 
            if (profileData.password && profileData.password !== profileData.confirmPassword) return alert("Hasła nie są identyczne!"); 
            updateUser(currentUser.id, profileData); 
            showSuccess('Zaktualizowano profil.'); 
        } 
    };
    
    const handleSaveSystem = () => { updateSystemConfig(localSystemConfig); showSuccess('Konfiguracja systemowa zapisana.'); };

    const calculateSalaryRange = (pos: Partial<Position>) => {
        if (pos.salary_type === 'monthly') {
            return { min: pos.min_monthly_rate || 0, max: pos.max_monthly_rate || 0, unit: 'zł/mc' };
        }
        const base = localSystemConfig.baseRate;
        const reqSkills = skills.filter(s => pos.required_skill_ids?.includes(s.id));
        const reqBonusSum = reqSkills.reduce((acc, s) => acc + s.hourly_bonus, 0);
        return { min: base, max: base + reqBonusSum, unit: 'zł/h' };
    };

    const handleOpenPositionModal = (pos?: Position) => { 
        setEditingPosition(pos ? { ...pos } : { 
            name: '', 
            responsibilities: [], 
            required_skill_ids: [], 
            order: positions.length + 1,
            salary_type: 'hourly',
            min_monthly_rate: 4500,
            max_monthly_rate: 6500
        }); 
        setNewResp('');
        setIsPositionModalOpen(true); 
    };

    const handleSavePosition = () => { 
        if (!editingPosition?.name) return; 
        if (editingPosition.id) updatePosition(editingPosition.id, editingPosition); 
        else addPosition(editingPosition as any); 
        setIsPositionModalOpen(false); 
    };

    const movePosition = (index: number, direction: 'up' | 'down') => {
        const newPositions = [...sortedPositions];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newPositions.length) return;
        
        const temp = newPositions[index];
        newPositions[index] = newPositions[targetIndex];
        newPositions[targetIndex] = temp;

        const updated = newPositions.map((p, idx) => ({ ...p, order: idx + 1 }));
        reorderPositions(updated);
    };

    const renderGeneral = () => (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-4xl animate-in fade-in duration-300">
            <div className="flex items-center gap-5 mb-8">
                <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-600/20">
                    {profileData.first_name[0]}{profileData.last_name[0]}
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Twój Profil</h2>
                    <p className="text-sm text-slate-500 font-medium">Zarządzaj swoimi danymi kontaktowymi.</p>
                </div>
            </div>
            <div className="w-full h-px bg-slate-100 mb-8"></div>
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IMIĘ</label>
                        <input className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.first_name} onChange={e => setProfileData({...profileData, first_name: e.target.value})}/>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NAZWISKO</label>
                        <input className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.last_name} onChange={e => setProfileData({...profileData, last_name: e.target.value})}/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ADRES EMAIL</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input type="email" className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})}/>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NUMER TELEFONU</label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input type="tel" className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})}/>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-end mt-10">
                <Button onClick={handleSaveGeneral} className="px-10 h-12 rounded-xl font-black shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-95"><Save size={20} className="mr-2"/> Zapisz Profil</Button>
            </div>
        </div>
    );

    const renderPositions = () => (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
            {/* Header section updated according to request */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase">
                        <Briefcase size={24} className="text-blue-600"/> Lista Stanowisk
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 font-medium italic">Zarządzaj dostępnymi stanowiskami i wymaganiami w Twojej firmie.</p>
                </div>
                <Button onClick={() => handleOpenPositionModal()} className="rounded-xl h-11 px-6 font-black shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 transition-all active:scale-95">
                    <Plus size={20} className="mr-2"/> Dodaj Stanowisko
                </Button>
            </div>

            {/* List from DB (state.positions) */}
            <div className="relative pl-20 space-y-4">
                {/* Vertical Line */}
                <div className="absolute left-[40px] top-4 bottom-4 w-1 bg-slate-100 rounded-full"></div>

                {sortedPositions.map((pos, idx) => {
                    const range = calculateSalaryRange(pos);
                    return (
                        <div key={pos.id} className="relative group">
                            {/* Circle with Index */}
                            <div className="absolute -left-[64px] top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full border-4 border-slate-50 shadow-sm flex items-center justify-center text-slate-400 font-black text-lg z-10 group-hover:border-blue-100 group-hover:text-blue-500 transition-all">
                                {idx + 1}
                            </div>

                            {/* Card */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all p-6 flex flex-col md:flex-row items-center gap-6 cursor-pointer" onClick={() => handleOpenPositionModal(pos)}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase group-hover:text-blue-600 transition-colors">
                                            {pos.name}
                                        </h3>
                                        <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase border border-blue-100">Aktywne</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                                        <div className="flex items-center gap-1.5"><Layers size={14}/> {pos.required_skill_ids?.length || 0} wymagań</div>
                                        <div className="flex items-center gap-1.5"><List size={14}/> {pos.responsibilities?.length || 0} obowiązków</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="text-right">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">WYNAGRODZENIE</div>
                                        <div className="text-2xl font-black text-green-600 leading-none">
                                            {range.min.toFixed(0)}-{range.max.toFixed(0)} <span className="text-xs font-bold text-slate-400">{range.unit}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Reorder actions */}
                                    <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                                        <button 
                                            onClick={() => movePosition(idx, 'up')}
                                            disabled={idx === 0}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-20 transition-colors"
                                        >
                                            <ChevronUp size={20}/>
                                        </button>
                                        <button 
                                            onClick={() => movePosition(idx, 'down')}
                                            disabled={idx === sortedPositions.length - 1}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-20 transition-colors"
                                        >
                                            <ChevronDown size={20}/>
                                        </button>
                                    </div>
                                    
                                    <ChevronRight className="text-slate-200 group-hover:text-blue-400 transition-colors" size={24} />
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {sortedPositions.length === 0 && (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center ml-[-20px]">
                        <Briefcase size={48} className="text-slate-300 mx-auto mb-4"/>
                        <p className="text-slate-500 font-bold">Brak dodanych stanowisk. Kliknij przycisk powyżej, aby utworzyć pierwsze stanowisko.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderSystem = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl animate-in fade-in duration-300">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-fit">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tighter text-sm"><DollarSign size={20} className="text-green-600"/> Stawki & Bonusy</h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Globalna Stawka Bazowa (PLN/h)</label>
                        <div className="flex items-center gap-3">
                            <input type="number" step="0.5" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg font-bold text-xl focus:bg-white outline-none transition-all shadow-inner" value={localSystemConfig.baseRate} onChange={(e) => setLocalSystemConfig({...localSystemConfig, baseRate: Number(e.target.value)})}/>
                            <span className="text-slate-400 font-bold text-xs">PLN/H</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-fit">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tighter text-sm"><ShieldAlert size={20} className="text-orange-600"/> Powody Zwolnień</h3>
                <div className="flex gap-2 mb-4">
                    <input className="flex-1 bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm font-medium focus:bg-white outline-none" placeholder="Nowy powód..." value={newReason} onChange={(e) => setNewReason(e.target.value)}/>
                    <Button size="sm" className="rounded-lg w-10 px-0 h-9" onClick={() => { if(newReason) { setLocalSystemConfig(prev => ({ ...prev, terminationReasons: [...prev.terminationReasons, newReason] })); setNewReason(''); }}} disabled={!newReason}><Plus size={18}/></Button>
                </div>
            </div>
            <div className="lg:col-span-2 flex justify-end pt-4"><Button className="px-10 h-12 rounded-xl shadow-lg shadow-blue-600/10 font-bold" onClick={handleSaveSystem}><Save size={20} className="mr-2"/> Zapisz Konfigurację</Button></div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <h1 className="text-2xl font-bold text-slate-900 mb-6 tracking-tight">Ustawienia Systemu</h1>
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-8 w-fit overflow-x-auto">
                {[
                    { id: 'general', label: 'MÓJ PROFIL', icon: UserIcon },
                    { id: 'positions', label: 'STANOWISKA', icon: Briefcase },
                    { id: 'system', label: 'KONFIGURACJA', icon: SettingsIcon }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as TabType)}
                        className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2.5 transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                        <t.icon size={14} /> {t.label}
                    </button>
                ))}
            </div>
            <div className="relative min-h-[400px]">
                {activeTab === 'general' && renderGeneral()}
                {activeTab === 'positions' && renderPositions()}
                {activeTab === 'system' && renderSystem()}
            </div>
            
            {/* --- COMPACT POSITION MODAL --- */}
            {isPositionModalOpen && editingPosition && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden animate-in zoom-in duration-300">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">{editingPosition.id ? 'Edytuj Stanowisko' : 'Nowe Stanowisko'}</h3>
                            <button onClick={() => setIsPositionModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-white rounded-full"><X size={20} /></button>
                        </div>
                        
                        <div className="p-6 space-y-6 scrollbar-hide overflow-y-auto max-h-[85vh]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column: Info & Salary */}
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">NAZWA STANOWISKA</label>
                                        <input 
                                            className="w-full bg-[#2D2E32] border-none rounded-xl p-3 text-white font-bold text-base focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-inner" 
                                            value={editingPosition.name} 
                                            onChange={e => setEditingPosition({...editingPosition, name: e.target.value})} 
                                            placeholder="Wpisz nazwę..."
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">RODZAJ WYNAGRODZENIA</label>
                                        <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                                            <button 
                                                onClick={() => setEditingPosition({...editingPosition, salary_type: 'hourly'})}
                                                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${editingPosition.salary_type === 'hourly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Stawka Godzinowa
                                            </button>
                                            <button 
                                                onClick={() => setEditingPosition({...editingPosition, salary_type: 'monthly'})}
                                                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${editingPosition.salary_type === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Stawka Miesięczna
                                            </button>
                                        </div>

                                        {editingPosition.salary_type === 'monthly' ? (
                                            <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <div className="space-y-1">
                                                    <label className="block text-[8px] font-bold text-slate-400 uppercase ml-1 tracking-wider">MIN (PLN)</label>
                                                    <input 
                                                        type="number"
                                                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-black text-slate-800 text-sm focus:bg-white outline-none"
                                                        value={editingPosition.min_monthly_rate}
                                                        onChange={e => setEditingPosition({...editingPosition, min_monthly_rate: Number(e.target.value)})}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[8px] font-bold text-slate-400 uppercase ml-1 tracking-wider">MAX (PLN)</label>
                                                    <input 
                                                        type="number"
                                                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-black text-slate-800 text-sm focus:bg-white outline-none"
                                                        value={editingPosition.max_monthly_rate}
                                                        onChange={e => setEditingPosition({...editingPosition, max_monthly_rate: Number(e.target.value)})}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-200">
                                                <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Wyliczona prognoza</div>
                                                <div className="text-xl font-black text-blue-700">
                                                    {calculateSalaryRange(editingPosition).min}-{calculateSalaryRange(editingPosition).max} <span className="text-xs font-bold text-blue-400">zł/h</span>
                                                </div>
                                                <p className="text-[10px] text-blue-400 font-medium leading-tight mt-1">Stawka bazowa ({localSystemConfig.baseRate} zł) + wybrane umiejętności.</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Responsibilities */}
                                    <div className="space-y-3">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">OBOWIĄZKI</label>
                                        <div className="flex gap-2">
                                            <input 
                                                className="flex-1 bg-slate-100 border-none rounded-xl p-2.5 text-slate-700 font-medium text-xs focus:ring-4 focus:ring-blue-500/20 outline-none" 
                                                placeholder="Dodaj obowiązek..."
                                                value={newResp}
                                                onChange={e => setNewResp(e.target.value)}
                                                onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(newResp) { setEditingPosition({...editingPosition, responsibilities: [...(editingPosition.responsibilities || []), newResp]}); setNewResp(''); } } }}
                                            />
                                            <button 
                                                onClick={() => { if(newResp) { setEditingPosition({...editingPosition, responsibilities: [...(editingPosition.responsibilities || []), newResp]}); setNewResp(''); } }}
                                                className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
                                            >
                                                <Plus size={16}/>
                                            </button>
                                        </div>
                                        <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-hide pr-1">
                                            {(editingPosition.responsibilities || []).map((resp, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg group hover:bg-white hover:border-blue-200 transition-all">
                                                    <span className="text-xs font-bold text-slate-700 truncate mr-2">{resp}</span>
                                                    <button 
                                                        onClick={() => setEditingPosition({...editingPosition, responsibilities: (editingPosition.responsibilities || []).filter((_, idx) => idx !== i)})}
                                                        className="text-red-300 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Skills */}
                                <div className="space-y-3 h-full">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">WYMAGANE UMIEJĘTNOŚCI (WIDŁY)</label>
                                    <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden shadow-inner h-[calc(100%-1.5rem)] flex flex-col">
                                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-hide max-h-[380px]">
                                            {skills.filter(s => !s.is_archived).map(skill => {
                                                const isSelected = editingPosition.required_skill_ids?.includes(skill.id);
                                                return (
                                                    <label key={skill.id} className={`flex items-center justify-between p-3 cursor-pointer transition-all ${isSelected ? 'bg-blue-50/50' : 'hover:bg-white'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                                                                {isSelected && <Check size={12} />}
                                                            </div>
                                                            <input 
                                                                type="checkbox" 
                                                                className="hidden" 
                                                                checked={isSelected} 
                                                                onChange={() => {
                                                                    const current = editingPosition.required_skill_ids || [];
                                                                    const updated = isSelected ? current.filter(id => id !== skill.id) : [...current, skill.id];
                                                                    setEditingPosition({...editingPosition, required_skill_ids: updated});
                                                                }}
                                                            />
                                                            <div>
                                                                <div className="text-xs font-black text-slate-800 leading-tight">{skill.name_pl}</div>
                                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{skill.category}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] font-black text-green-600">+{skill.hourly_bonus} zł</div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/30">
                            <div className="flex gap-3">
                                <button onClick={() => setIsPositionModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">Anuluj</button>
                                {editingPosition.id && (
                                    <button 
                                        onClick={() => { if(confirm('Czy na pewno chcesz usunąć to stanowisko?')) { deletePosition(editingPosition.id!); setIsPositionModalOpen(false); } }}
                                        className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        Usuń
                                    </button>
                                )}
                            </div>
                            <Button onClick={handleSavePosition} className="px-8 h-10 rounded-xl font-black shadow-xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 transition-all active:scale-95">
                                <Save size={18} className="mr-2"/> {editingPosition.id ? 'Zapisz Stanowisko' : 'Dodaj Stanowisko'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {successMsg && <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 flex items-center gap-3 z-[100]"><CheckCircle2 size={20}/><span className="font-bold">{successMsg}</span></div>}
        </div>
    );
};
