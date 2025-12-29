
import React, { useState, useEffect, useMemo } from 'react';
import { 
    User as UserIcon, Bell, Settings as SettingsIcon, Save, Lock, Mail, Phone,
    Shield, Check, Plus, Trash2, Briefcase, DollarSign, List, 
    ChevronUp, ChevronDown, Award, HardHat, TrendingUp, X, CheckCircle2, 
    ShieldCheck, Zap, ChevronRight, Star, Info, ShieldAlert, FileText
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Role, ContractType, NotificationSetting, Position, Skill, SkillCategory, VerificationType, BonusDocumentType } from '../../types';

type TabType = 'general' | 'notifications' | 'positions' | 'system';

export const HRSettingsPage = () => {
    const { state, updateUser, updateSystemConfig, updateNotificationSettings, addPosition, updatePosition, deletePosition, reorderPositions } = useAppContext();
    const { currentUser, systemConfig, notificationSettings, positions, skills } = state;
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [successMsg, setSuccessMsg] = useState('');

    const roundToHalf = (num: number) => Math.round(num * 2) / 2;

    // --- 1. GENERAL TAB STATE ---
    const [profileData, setProfileData] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', confirmPassword: '' });
    useEffect(() => { if (currentUser) setProfileData({ first_name: currentUser.first_name, last_name: currentUser.last_name, email: currentUser.email, phone: currentUser.phone || '', password: '', confirmPassword: '' }); }, [currentUser]);

    // --- 2. NOTIFICATIONS TAB STATE ---
    const [localNotifSettings, setLocalNotifSettings] = useState<NotificationSetting[]>(notificationSettings);
    useEffect(() => { setLocalNotifSettings(notificationSettings); }, [notificationSettings]);

    // --- 3. POSITIONS TAB STATE ---
    const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<Partial<Position> | null>(null);
    const sortedPositions = useMemo(() => [...positions].sort((a, b) => a.order - b.order), [positions]);

    // --- 4. SYSTEM TAB STATE ---
    const [localSystemConfig, setLocalSystemConfig] = useState(systemConfig);
    const [newReason, setNewReason] = useState('');
    useEffect(() => { setLocalSystemConfig(systemConfig); }, [systemConfig]);

    // --- HANDLERS ---
    const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };
    const handleSaveGeneral = () => { if (currentUser) { if (profileData.password && profileData.password !== profileData.confirmPassword) return alert("Hasła nie są identyczne!"); updateUser(currentUser.id, profileData); showSuccess('Zaktualizowano profil.'); } };
    const handleSaveNotifications = () => { updateNotificationSettings(localNotifSettings); showSuccess('Zaktualizowano preferencje powiadomień.'); };
    const toggleNotif = (id: string, channel: 'system' | 'email' | 'sms') => { setLocalNotifSettings(prev => prev.map(n => n.id === id ? { ...n, [channel]: !n[channel] } : n)); };
    
    const handleSaveSystem = () => { updateSystemConfig(localSystemConfig); showSuccess('Konfiguracja systemowa zapisana.'); };

    const addDictItem = (type: 'docs' | 'perms') => {
        const newItem = { id: `item_${Date.now()}`, label: 'Nowa pozycja', bonus: 0 };
        const key = type === 'docs' ? 'bonusDocumentTypes' : 'bonusPermissionTypes';
        setLocalSystemConfig(prev => ({ ...prev, [key]: [...prev[key], newItem] }));
    };

    const updateDictItem = (type: 'docs' | 'perms', id: string, data: Partial<BonusDocumentType>) => {
        const key = type === 'docs' ? 'bonusDocumentTypes' : 'bonusPermissionTypes';
        setLocalSystemConfig(prev => ({ ...prev, [key]: prev[key].map(i => i.id === id ? { ...i, ...data } : i) }));
    };

    const removeDictItem = (type: 'docs' | 'perms', id: string) => {
        const key = type === 'docs' ? 'bonusDocumentTypes' : 'bonusPermissionTypes';
        setLocalSystemConfig(prev => ({ ...prev, [key]: prev[key].filter(i => i.id !== id) }));
    };

    const calculateSalaryRange = (pos: Partial<Position>) => {
        const base = localSystemConfig.baseRate;
        const reqSkills = skills.filter(s => pos.required_skill_ids?.includes(s.id));
        const reqBonusSum = reqSkills.reduce((acc, s) => acc + s.hourly_bonus, 0);
        return { min: roundToHalf(base), max: roundToHalf(base + reqBonusSum), unit: 'zł/h' };
    };

    const handleOpenPositionModal = (pos?: Position) => { setEditingPosition(pos ? { ...pos } : { name: '', responsibilities: [], required_skill_ids: [], order: 0 }); setIsPositionModalOpen(true); };
    const handleSavePosition = () => { if (!editingPosition?.name) return; if (editingPosition.id) updatePosition(editingPosition.id, editingPosition); else addPosition(editingPosition as any); setIsPositionModalOpen(false); };

    // --- RENDERERS ---

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
                {/* Row 1: Imię i Nazwisko */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IMIĘ</label>
                        <input 
                            className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" 
                            value={profileData.first_name} 
                            onChange={e => setProfileData({...profileData, first_name: e.target.value})}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NAZWISKO</label>
                        <input 
                            className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" 
                            value={profileData.last_name} 
                            onChange={e => setProfileData({...profileData, last_name: e.target.value})}
                        />
                    </div>
                </div>

                {/* Row 2: Email i Telefon */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ADRES EMAIL</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input 
                                type="email"
                                className="w-full bg-slate-50/50 border border-slate-200 p-3 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" 
                                value={profileData.email} 
                                onChange={e => setProfileData({...profileData, email: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NUMER TELEFONU</label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input 
                                type="tel"
                                className="w-full bg-slate-50/50 border border-slate-200 p-3 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" 
                                value={profileData.phone} 
                                onChange={e => setProfileData({...profileData, phone: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                {/* Row 3: Hasło */}
                <div className="pt-4">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-50 pb-2">Zmiana Hasła (opcjonalnie)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NOWE HASŁO</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input 
                                    type="password"
                                    placeholder="Pozostaw puste, aby nie zmieniać"
                                    className="w-full bg-slate-50/50 border border-slate-200 p-3 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" 
                                    value={profileData.password} 
                                    onChange={e => setProfileData({...profileData, password: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">POTWIERDŹ HASŁO</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input 
                                    type="password"
                                    placeholder="Powtórz nowe hasło"
                                    className="w-full bg-slate-50/50 border border-slate-200 p-3 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" 
                                    value={profileData.confirmPassword} 
                                    onChange={e => setProfileData({...profileData, confirmPassword: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end mt-10">
                <Button onClick={handleSaveGeneral} className="px-10 h-12 rounded-xl font-black shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-95">
                    <Save size={20} className="mr-2"/> Zapisz Profil
                </Button>
            </div>
        </div>
    );

    const renderNotifications = () => (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl animate-in fade-in duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Kanały Powiadomień</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <tr><th className="px-6 py-4">Zdarzenie</th><th className="px-6 py-4 text-center">System</th><th className="px-6 py-4 text-center">Email</th><th className="px-6 py-4 text-center">SMS</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {localNotifSettings.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-700">{s.label}</td>
                                <td className="px-6 py-4 text-center"><input type="checkbox" checked={s.system} onChange={() => toggleNotif(s.id, 'system')} className="w-5 h-5 rounded text-blue-600 cursor-pointer"/></td>
                                <td className="px-6 py-4 text-center"><input type="checkbox" checked={s.email} onChange={() => toggleNotif(s.id, 'email')} className="w-5 h-5 rounded text-blue-600 cursor-pointer"/></td>
                                <td className="px-6 py-4 text-center"><input type="checkbox" checked={s.sms} onChange={() => toggleNotif(s.id, 'sms')} className="w-5 h-5 rounded text-blue-600 cursor-pointer"/></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-6 bg-slate-50/50 flex justify-end border-t border-slate-100">
                <Button onClick={handleSaveNotifications} className="px-6 h-11 rounded-xl font-bold"><Save size={18} className="mr-2"/> Zapisz Preferencje</Button>
            </div>
        </div>
    );

    const renderPositions = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div><h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2"><Briefcase size={20} className="text-blue-600"/> Stanowiska</h2><p className="text-xs text-slate-500 mt-0.5">Definiuj wymagania i drabinkę płacową.</p></div>
                <Button onClick={() => handleOpenPositionModal()} size="sm" className="rounded-lg h-9"><Plus size={16} className="mr-1.5"/> Nowe Stanowisko</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedPositions.map(pos => { const r = calculateSalaryRange(pos); return (<div key={pos.id} onClick={() => handleOpenPositionModal(pos)} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 p-5 cursor-pointer group flex flex-col transition-all"><div className="flex justify-between mb-4"><div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg"><HardHat size={20}/></div><div className="text-right"><div className="text-[9px] font-bold text-slate-400 uppercase">Prognoza Netto</div><div className="text-lg font-bold text-green-600 leading-none">{r.min}-{r.max} <span className="text-xs font-medium opacity-60">zł/h</span></div></div></div><h3 className="font-bold text-slate-900 text-base mb-3 group-hover:text-blue-600">{pos.name}</h3><div className="mt-auto text-xs text-slate-400 flex items-center gap-1"><ChevronRight size={14}/> Szczegóły stanowiska</div></div>); })}
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
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Dodatki Umowne (PLN/h)</h4>
                        <div className="space-y-2">
                            {Object.entries(ContractType).map(([key, type]) => (
                                <div key={type} className="space-y-2">
                                    <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                                        <span className="text-xs font-bold text-slate-600 uppercase">{key}</span>
                                        <input type="number" step="0.5" className="w-16 bg-slate-50 border border-slate-200 p-1.5 rounded text-right font-bold text-blue-600 text-sm" value={localSystemConfig.contractBonuses[type] || 0} onChange={(e) => setLocalSystemConfig({...localSystemConfig, contractBonuses: { ...localSystemConfig.contractBonuses, [type]: Number(e.target.value) }})}/>
                                    </div>
                                    {type === ContractType.UZ && (
                                        <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg border border-blue-100 ml-4">
                                            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-tight">Dodatek za status studenta &lt; 26 lat</span>
                                            <div className="flex items-center gap-2">
                                                <input type="number" step="0.5" className="w-14 bg-white border border-blue-200 p-1 rounded text-right font-bold text-blue-700 text-xs" value={localSystemConfig.studentBonus} onChange={(e) => setLocalSystemConfig({...localSystemConfig, studentBonus: Number(e.target.value)})}/>
                                                <span className="text-[10px] text-blue-400 font-bold">PLN</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
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
                <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/50 p-2 rounded-xl border border-slate-100 custom-scrollbar">
                    {localSystemConfig.terminationReasons.map(reason => (
                        <div key={reason} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg text-[11px] font-bold text-slate-700 shadow-sm border border-slate-100 group">
                            <span>{reason}</span>
                            <button onClick={() => setLocalSystemConfig(prev => ({ ...prev, terminationReasons: prev.terminationReasons.filter(r => r !== reason) }))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 uppercase tracking-tighter text-sm">
                        <FileText size={20} className="text-blue-600"/> Słownik Dokumentów
                    </h3>
                    <Button size="sm" variant="outline" onClick={() => addDictItem('docs')} className="h-8 text-[10px] font-bold border-blue-200 text-blue-600 hover:bg-blue-50">
                        <Plus size={14} className="mr-1"/> Dodaj Typ
                    </Button>
                </div>
                <div className="space-y-2">
                    {localSystemConfig.bonusDocumentTypes.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 group transition-all hover:border-blue-300">
                            <input className="flex-1 bg-transparent border-none p-1 text-xs font-bold text-slate-700 focus:ring-0 focus:bg-white focus:rounded" value={doc.label} onChange={(e) => updateDictItem('docs', doc.id, { label: e.target.value })}/>
                            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Bonus:</span>
                                <input type="number" step="0.1" className="w-12 bg-transparent border-none p-0 text-right text-xs font-black text-blue-600 focus:ring-0" value={doc.bonus} onChange={(e) => updateDictItem('docs', doc.id, { bonus: Number(e.target.value) })}/>
                                <span className="text-[10px] font-bold text-slate-400">zł</span>
                            </div>
                            <button onClick={() => removeDictItem('docs', doc.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 uppercase tracking-tighter text-sm">
                        <Shield size={20} className="text-purple-600"/> Słownik Uprawnień
                    </h3>
                    <Button size="sm" variant="outline" onClick={() => addDictItem('perms')} className="h-8 text-[10px] font-bold border-purple-200 text-purple-600 hover:bg-purple-50">
                        <Plus size={14} className="mr-1"/> Dodaj Typ
                    </Button>
                </div>
                <div className="space-y-2">
                    {localSystemConfig.bonusPermissionTypes.map(perm => (
                        <div key={perm.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 group transition-all hover:border-purple-300">
                            <input className="flex-1 bg-transparent border-none p-1 text-xs font-bold text-slate-700 focus:ring-0 focus:bg-white focus:rounded" value={perm.label} onChange={(e) => updateDictItem('perms', perm.id, { label: e.target.value })}/>
                            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Bonus:</span>
                                <input type="number" step="0.1" className="w-12 bg-transparent border-none p-0 text-right text-xs font-black text-purple-600 focus:ring-0" value={perm.bonus} onChange={(e) => updateDictItem('perms', perm.id, { bonus: Number(e.target.value) })}/>
                                <span className="text-[10px] font-bold text-slate-400">zł</span>
                            </div>
                            <button onClick={() => removeDictItem('perms', perm.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-2 flex justify-end pt-4"><Button className="px-10 h-12 rounded-xl shadow-lg shadow-blue-600/10 font-bold" onClick={handleSaveSystem}><Save size={20} className="mr-2"/> Zapisz Konfigurację Systemową</Button></div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto pb-20">
            <h1 className="text-2xl font-bold text-slate-900 mb-6 tracking-tight">Ustawienia</h1>
            
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-8 w-fit overflow-x-auto">
                {[
                    { id: 'general', label: 'PROFIL', icon: UserIcon },
                    { id: 'notifications', label: 'POWIADOMIENIA', icon: Bell },
                    { id: 'positions', label: 'STANOWISKA', icon: Briefcase },
                    { id: 'system', label: 'SYSTEM', icon: SettingsIcon }
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
                {activeTab === 'notifications' && renderNotifications()}
                {activeTab === 'positions' && renderPositions()}
                {activeTab === 'system' && renderSystem()}
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};
