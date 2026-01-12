
import React, { useState, useEffect, useMemo } from 'react';
import { 
    User as UserIcon, Bell, Settings as SettingsIcon, Save, Lock, Mail, Phone,
    Shield, Check, Plus, Trash2, Briefcase, DollarSign, List, 
    ChevronUp, ChevronDown, Award, HardHat, TrendingUp, X, CheckCircle2, 
    ShieldCheck, Zap, ChevronRight, Star, Info, ShieldAlert, FileText,
    UserPlus, CheckSquare, AlertTriangle, Network, Clock, Cloud, RefreshCw
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Role, ContractType, NotificationSetting, Position, Skill, SkillCategory, VerificationType, BonusDocumentType } from '../../types';

type TabType = 'general' | 'notifications' | 'positions' | 'system';
type NotifRoleTab = Role.HR | Role.CANDIDATE | Role.EMPLOYEE | Role.BRIGADIR | Role.COORDINATOR | 'work_manager';

export const HRSettingsPage = () => {
    const { state, updateUser, updateSystemConfig, updateNotificationSettings, addPosition, updatePosition, deletePosition, reorderPositions } = useAppContext();
    const { currentUser, systemConfig, notificationSettings, positions, skills } = state;
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [activeNotifRoleTab, setActiveNotifRoleTab] = useState<NotifRoleTab>(Role.HR);
    const [isSyncing, setIsSyncing] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const roundToHalf = (num: number) => Math.round(num * 2) / 2;

    // --- 1. GENERAL TAB STATE ---
    const [profileData, setProfileData] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', confirmPassword: '' });
    useEffect(() => { if (currentUser) setProfileData({ first_name: currentUser.first_name, last_name: currentUser.last_name, email: currentUser.email, phone: currentUser.phone || '', password: '', confirmPassword: '' }); }, [currentUser]);

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
    
    // AUTOMATIC NOTIFICATION UPDATE
    const handleToggleNotif = async (id: string, channel: 'system' | 'email' | 'sms') => {
        setIsSyncing(true);
        const updatedSettings = notificationSettings.map(n => 
            n.id === id ? { ...n, [channel]: !n[channel] } : n
        );
        try {
            await updateNotificationSettings(updatedSettings);
        } catch (e) {
            console.error(e);
        } finally {
            setTimeout(() => setIsSyncing(false), 500);
        }
    };
    
    const handleSaveSystem = () => { updateSystemConfig(localSystemConfig); showSuccess('Konfiguracja systemowa zapisana.'); };

    const calculateSalaryRange = (pos: Partial<Position>) => {
        const base = localSystemConfig.baseRate;
        const reqSkills = skills.filter(s => pos.required_skill_ids?.includes(s.id));
        const reqBonusSum = reqSkills.reduce((acc, s) => acc + s.hourly_bonus, 0);
        return { min: roundToHalf(base), max: roundToHalf(base + reqBonusSum), unit: 'zł/h' };
    };

    const handleOpenPositionModal = (pos?: Position) => { setEditingPosition(pos ? { ...pos } : { name: '', responsibilities: [], required_skill_ids: [], order: 0 }); setIsPositionModalOpen(true); };
    const handleSavePosition = () => { if (!editingPosition?.name) return; if (editingPosition.id) updatePosition(editingPosition.id, editingPosition); else addPosition(editingPosition as any); setIsPositionModalOpen(false); };

    // --- NOTIFICATION GROUPING HELPER ---
    const groupedNotifsByRole = useMemo(() => {
        const roleItems = notificationSettings.filter(n => n.target_role === activeNotifRoleTab);
        
        const categories = {
            'rekrutacja': { label: 'Rekrutacja i Kandydaci', icon: UserPlus, color: 'text-purple-600', bg: 'bg-purple-50' },
            'trial': { label: 'Umowy i Okres Próbny', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
            'skills': { label: 'Umiejętności i Testy', icon: CheckSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
            'quality': { label: 'Jakość i Finanse', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            'referrals': { label: 'Program Poleceń', icon: Network, color: 'text-green-600', bg: 'bg-green-50' },
            'system': { label: 'Administracja i Zespół', icon: Shield, color: 'text-slate-600', bg: 'bg-slate-50' }
        };
        
        return Object.entries(categories).map(([key, config]) => ({
            ...config,
            items: roleItems.filter(n => n.category === key)
        })).filter(group => group.items.length > 0);
    }, [notificationSettings, activeNotifRoleTab]);

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
                            <input type="email" className="w-full bg-slate-50/50 border border-slate-200 p-3 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})}/>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NUMER TELEFONU</label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input type="tel" className="w-full bg-slate-50/50 border border-slate-200 p-3 pl-11 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})}/>
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
        <div className="max-w-6xl animate-in fade-in duration-300 space-y-6">
            <div className="bg-blue-600 p-6 rounded-2xl shadow-lg text-white flex justify-between items-center relative overflow-hidden">
                <div className="absolute right-0 top-0 p-6 opacity-10"><Bell size={120}/></div>
                <div className="relative z-10">
                    <h2 className="text-2xl font-black tracking-tight mb-1">Konfiguracja Powiadomień</h2>
                    <p className="text-blue-100 text-sm opacity-80">Wybierz kanały komunikacji dla każdej roli. Zmiany zapisywane są automatycznie.</p>
                </div>
                <div className="relative z-10 flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
                    {isSyncing ? (
                        <><RefreshCw size={16} className="animate-spin text-blue-200"/><span className="text-[10px] font-black uppercase">Synchronizacja...</span></>
                    ) : (
                        <><Cloud size={16} className="text-green-300"/><span className="text-[10px] font-black uppercase">Zapisano w chmurze</span></>
                    )}
                </div>
            </div>

            {/* NOTIFICATION ROLE SUB-TABS */}
            <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                {[
                    { id: Role.HR, label: 'DLA HR' },
                    { id: Role.CANDIDATE, label: 'DLA KANDYDATA' },
                    { id: Role.EMPLOYEE, label: 'DLA PRACOWNIKA' },
                    { id: Role.BRIGADIR, label: 'DLA BRYGADZISTY' },
                    { id: Role.COORDINATOR, label: 'DLA KOORDYNATORA' },
                    { id: 'work_manager', label: 'DLA WORK MANAGERA' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveNotifRoleTab(tab.id as NotifRoleTab)}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeNotifRoleTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="space-y-6">
                {groupedNotifsByRole.map((group, gIdx) => (
                    <div key={gIdx} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className={`p-4 ${group.bg} border-b border-slate-100 flex items-center gap-3`}>
                            <div className={`p-2 rounded-lg bg-white shadow-sm ${group.color}`}>
                                <group.icon size={20}/>
                            </div>
                            <h3 className={`font-black uppercase tracking-widest text-[11px] ${group.color}`}>{group.label}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 w-1/2">Zdarzenie / Zmiana w systemie</th>
                                        <th className="px-4 py-4 text-center">Wiadomość w Portalu</th>
                                        <th className="px-4 py-4 text-center">Email</th>
                                        <th className="px-4 py-4 text-center">SMS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {group.items.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-700 text-sm">{s.label}</div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <input type="checkbox" checked={s.system} onChange={() => handleToggleNotif(s.id, 'system')} className="w-5 h-5 rounded text-blue-600 cursor-pointer border-slate-300 focus:ring-blue-500 transition-all active:scale-90"/>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <input type="checkbox" checked={s.email} onChange={() => handleToggleNotif(s.id, 'email')} className="w-5 h-5 rounded text-blue-600 cursor-pointer border-slate-300 focus:ring-blue-500 transition-all active:scale-90"/>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <input type="checkbox" checked={s.sms} onChange={() => handleToggleNotif(s.id, 'sms')} className="w-5 h-5 rounded text-blue-600 cursor-pointer border-slate-300 focus:ring-blue-500 transition-all active:scale-90"/>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            {successMsg && (
                <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 flex items-center gap-3">
                    <CheckCircle2 size={20}/>
                    <span className="font-bold">{successMsg}</span>
                </div>
            )}
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
                    { id: 'notifications', label: 'POWIADOMIENIA', icon: Bell },
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
                {activeTab === 'notifications' && renderNotifications()}
                {activeTab === 'positions' && renderPositions()}
                {activeTab === 'system' && renderSystem()}
            </div>
        </div>
    );
};
