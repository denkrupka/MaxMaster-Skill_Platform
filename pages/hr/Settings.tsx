
import React, { useState, useEffect, useMemo } from 'react';
import {
    User as UserIcon, Bell, Settings as SettingsIcon, Save, Mail, Phone,
    Plus, Trash2, Briefcase, DollarSign, List,
    ChevronUp, ChevronDown, Award, HardHat, X, TrendingUp,
    Layers, FileJson, MessageSquare, Tag, GraduationCap, AlertTriangle,
    ChevronRight, ShieldCheck, Info, ShieldAlert as ShieldAlertIcon, Star, Gift, Check, CheckCircle2, Zap, Calendar, MapPin,
    Users, Search, ToggleLeft, ToggleRight, Loader2, Package, UserPlus,
    ClipboardList, CalendarOff, CalendarRange, FolderKanban, BarChart3
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Role, ContractType, Position, Skill, SkillCategory, SystemConfig, UserStatus } from '../../types';
import { CONTRACT_TYPE_LABELS, MODULE_LABELS } from '../../constants';

type TabType = 'general' | 'positions' | 'system' | 'access';

const MODULE_INFO: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  recruitment: {
    name: 'Rekrutacja',
    description: 'Zarządzanie kandydatami, procesem rekrutacji i dokumentami HR',
    icon: <UserPlus className="w-5 h-5" />
  },
  skills: {
    name: 'Umiejętności',
    description: 'Zarządzanie kompetencjami, szkoleniami i certyfikatami pracowników',
    icon: <Award className="w-5 h-5" />
  },
  time_attendance: {
    name: 'Czas pracy',
    description: 'Rejestracja czasu pracy, obecność, nadgodziny, wnioski o korekty',
    icon: <ClipboardList className="w-5 h-5" />
  },
  time_off: {
    name: 'Urlopy i nieobecności',
    description: 'Zarządzanie urlopami, zwolnieniami, limitami dni wolnych',
    icon: <CalendarOff className="w-5 h-5" />
  },
  work_schedule: {
    name: 'Grafik pracy',
    description: 'Planowanie zmian, szablony grafików, przypisania pracowników',
    icon: <CalendarRange className="w-5 h-5" />
  },
  tasks_projects: {
    name: 'Zadania i projekty',
    description: 'Zarządzanie zadaniami, projektami, klientami, logowanie czasu',
    icon: <FolderKanban className="w-5 h-5" />
  },
  reports_payroll: {
    name: 'Raporty i rozliczenia',
    description: 'Tabele czasu pracy, raporty obecności, rozliczenia wynagrodzeń',
    icon: <BarChart3 className="w-5 h-5" />
  }
};

// Fix: Added optional children to AccordionItem props to avoid missing children error
const AccordionItem = ({ id, icon: Icon, title, description, children, isOpen, onToggle }: { id: string, icon: any, title: string, description: string, children?: React.ReactNode, isOpen: boolean, onToggle: (id: string) => void }) => {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4 transition-all">
            <button 
                type="button"
                onClick={() => onToggle(id)}
                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors text-left"
            >
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isOpen ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-500'} transition-all`}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">{title}</h3>
                        <p className="text-xs text-slate-400 font-medium">{description}</p>
                    </div>
                </div>
                {isOpen ? <ChevronUp className="text-slate-300" /> : <ChevronDown className="text-slate-300" />}
            </button>
            {isOpen && (
                <div className="p-6 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </div>
    );
};

export const HRSettingsPage = () => {
    const { state, updateUser, updateSystemConfig, addPosition, updatePosition, deletePosition, reorderPositions, triggerNotification, grantModuleAccess, revokeModuleAccess } = useAppContext();
    const { currentUser, systemConfig, positions, skills, users, companyModules, modules, moduleUserAccess } = state;
    const currentCompany = state.currentCompany;
    const [activeTab, setActiveTab] = useState<TabType>('system');
    const [successMsg, setSuccessMsg] = useState('');

    const [openAccordion, setOpenAccordion] = useState<string | null>(null);

    // Module access management state
    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [accessSearch, setAccessSearch] = useState('');
    const [accessLoading, setAccessLoading] = useState<string | null>(null);

    const [profileData, setProfileData] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', confirmPassword: '' });
    useEffect(() => { if (currentUser) setProfileData({ first_name: currentUser.first_name, last_name: currentUser.last_name, email: currentUser.email, phone: currentUser.phone || '', password: '', confirmPassword: '' }); }, [currentUser]);

    const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<Partial<Position> | null>(null);
    const [newResp, setNewResp] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [collapsedModalSections, setCollapsedModalSections] = useState<Set<string>>(new Set());

    const sortedPositions = useMemo(() => [...positions].sort((a, b) => a.order - b.order), [positions]);

    // Group skills by category
    const skillsByCategory = useMemo(() => {
        const grouped: Record<string, Skill[]> = {};
        skills.filter(s => !s.is_archived).forEach(skill => {
            if (!grouped[skill.category]) {
                grouped[skill.category] = [];
            }
            grouped[skill.category].push(skill);
        });
        return grouped;
    }, [skills]);

    const [localSystemConfig, setLocalSystemConfig] = useState<SystemConfig>(systemConfig);
    const [newReason, setNewReason] = useState('');
    const [newDocLabel, setNewDocLabel] = useState('');
    const [newDocBonus, setNewDocBonus] = useState(0);
    const [tempNoteCategory, setTempNoteCategory] = useState('');
    const [tempBadgeType, setTempBadgeType] = useState('');

    useEffect(() => { setLocalSystemConfig(systemConfig); }, [systemConfig]);

    const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };
    
    const handleSaveGeneral = () => { 
        if (currentUser) { 
            if (profileData.password && profileData.password !== profileData.confirmPassword) return alert("Hasła nie są identyczne!"); 
            updateUser(currentUser.id, profileData); 
            showSuccess('Zaktualizowano profil.'); 
        } 
    };
    
    const handleSaveSystem = () => { 
        updateSystemConfig(localSystemConfig); 
        showSuccess('Konfiguracja systemowa zapisana.'); 
    };

    const calculateSalaryRange = (pos: Partial<Position>) => {
        if (pos.salary_type === 'monthly') {
            return { min: pos.min_monthly_rate || 0, max: pos.max_monthly_rate || 0, unit: 'zł/mc' };
        }

        const base = localSystemConfig.baseRate;
        const reqSkills = skills.filter(s => pos.required_skill_ids?.includes(s.id));
        const reqSkillsSum = reqSkills.reduce((acc, s) => acc + s.hourly_bonus, 0);

        // Calculate required documents bonus
        const reqDocs = localSystemConfig.bonusDocumentTypes.filter(d => pos.required_document_ids?.includes(d.id));
        const reqDocsSum = reqDocs.reduce((acc, d) => acc + d.bonus, 0);

        // Get hourly positions only, sorted by order
        const hourlyPositions = sortedPositions.filter(p => p.salary_type === 'hourly');
        const currentIndex = pos.id ? hourlyPositions.findIndex(p => p.id === pos.id) : hourlyPositions.length;

        let min: number;
        let max: number;

        if (currentIndex === 0 || currentIndex === -1) {
            // First position (or new position)
            min = base;
            max = base + reqSkillsSum + reqDocsSum;
        } else if (currentIndex === hourlyPositions.length - 1) {
            // Last position
            min = base + reqSkillsSum + reqDocsSum;

            // Max = all available skills + all documents + base
            const allSkillsSum = skills.filter(s => !s.is_archived).reduce((acc, s) => acc + s.hourly_bonus, 0);
            const allDocsSum = localSystemConfig.bonusDocumentTypes.reduce((acc, d) => acc + d.bonus, 0);
            max = base + allSkillsSum + allDocsSum;
        } else {
            // Middle position
            min = base + reqSkillsSum + reqDocsSum;

            // Max = min of next hourly position
            const nextPosition = hourlyPositions[currentIndex + 1];
            if (nextPosition) {
                const nextReqSkills = skills.filter(s => nextPosition.required_skill_ids?.includes(s.id));
                const nextReqSkillsSum = nextReqSkills.reduce((acc, s) => acc + s.hourly_bonus, 0);
                const nextReqDocs = localSystemConfig.bonusDocumentTypes.filter(d => nextPosition.required_document_ids?.includes(d.id));
                const nextReqDocsSum = nextReqDocs.reduce((acc, d) => acc + d.bonus, 0);
                max = base + nextReqSkillsSum + nextReqDocsSum;
            } else {
                max = base + reqSkillsSum + reqDocsSum;
            }
        }

        return { min, max, unit: 'zł/h' };
    };

    const handleOpenPositionModal = (pos?: Position) => {
        setEditingPosition(pos ? { ...pos } : {
            name: '',
            responsibilities: [],
            required_skill_ids: [],
            required_document_ids: [],
            order: positions.length + 1,
            salary_type: 'hourly',
            min_monthly_rate: 4500,
            max_monthly_rate: 6500,
            referral_bonus: 0
        });
        setNewResp('');
        // Start with all sections collapsed
        setCollapsedModalSections(new Set(['skills', 'documents', 'responsibilities']));
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

    const toggleAccordion = (id: string) => { setOpenAccordion(openAccordion === id ? null : id); };

    // --- Module Access (Dostępy) logic ---
    const myModules = useMemo(() => {
        if (!currentCompany) return [];
        return companyModules
            .filter(cm => cm.company_id === currentCompany.id)
            .map(cm => {
                const mod = modules.find(m => m.code === cm.module_code);
                const usersInModule = moduleUserAccess.filter(
                    mua => mua.company_id === currentCompany.id && mua.module_code === cm.module_code && mua.is_enabled
                ).length;
                return { ...cm, module: mod, activeUsers: usersInModule };
            });
    }, [companyModules, modules, moduleUserAccess, currentCompany]);

    const accessibleUsers = useMemo(() => {
        if (!currentCompany) return [];
        return users.filter(u =>
            u.company_id === currentCompany.id &&
            !u.is_global_user &&
            u.status !== UserStatus.INACTIVE
        );
    }, [users, currentCompany]);

    const filteredAccessUsers = useMemo(() => {
        return accessibleUsers.filter(u =>
            u.first_name.toLowerCase().includes(accessSearch.toLowerCase()) ||
            u.last_name.toLowerCase().includes(accessSearch.toLowerCase()) ||
            u.email?.toLowerCase().includes(accessSearch.toLowerCase())
        );
    }, [accessibleUsers, accessSearch]);

    const hasModuleAccess = (userId: string, moduleCode: string): boolean => {
        return moduleUserAccess.some(
            mua => mua.user_id === userId && mua.module_code === moduleCode && mua.is_enabled
        );
    };

    const usersWithAccess = useMemo(() => {
        if (!selectedModule) return [];
        return filteredAccessUsers.filter(u => hasModuleAccess(u.id, selectedModule));
    }, [filteredAccessUsers, selectedModule, moduleUserAccess]);

    const usersWithoutAccess = useMemo(() => {
        if (!selectedModule) return [];
        return filteredAccessUsers.filter(u => !hasModuleAccess(u.id, selectedModule));
    }, [filteredAccessUsers, selectedModule, moduleUserAccess]);

    const toggleAccess = async (userId: string, moduleCode: string, currentAccess: boolean) => {
        setAccessLoading(userId);
        try {
            if (currentAccess) {
                await revokeModuleAccess(userId, moduleCode);
            } else {
                await grantModuleAccess(userId, moduleCode);
            }
        } catch (err) {
            console.error('Error toggling access:', err);
        } finally {
            setAccessLoading(null);
        }
    };

    const handleRemoveContractType = (type: string) => {
        if (['uop', 'uz', 'b2b'].includes(type.toLowerCase())) {
            return triggerNotification('error', 'Odmowa', 'Nie można usunąć podstawowych form zatrudnienia.');
        }
        const newContracts = { ...localSystemConfig.contractBonuses };
        delete newContracts[type];
        setLocalSystemConfig({ ...localSystemConfig, contractBonuses: newContracts });
    };

    const renderGeneral = () => (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-4xl animate-in fade-in duration-300">
            <div className="flex items-center gap-5 mb-8">
                <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-600/20">{profileData.first_name[0]}{profileData.last_name[0]}</div>
                <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">Twój Profil</h2><p className="text-sm text-slate-500 font-medium">Zarządzaj swoimi danymi kontaktowymi.</p></div>
            </div>
            <div className="w-full h-px bg-slate-100 mb-8"></div>
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">IMIĘ</label><input className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.first_name} onChange={e => setProfileData({...profileData, first_name: e.target.value})}/></div>
                    <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">NAZWISKO</label><input className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.last_name} onChange={e => setProfileData({...profileData, last_name: e.target.value})}/></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">ADRES EMAIL</label><div className="relative"><Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" /><input type="email" className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})}/></div></div>
                    <div className="space-y-1.5"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">NUMER TELEFONU</label><div className="relative"><Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" /><input type="tel" className="w-full bg-slate-50/50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})}/></div></div>
                </div>
            </div>
            <div className="flex justify-end mt-10"><Button onClick={handleSaveGeneral} className="px-10 h-12 rounded-xl font-black shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-95"><Save size={20} className="mr-2"/> Zapisz Profil</Button></div>
        </div>
    );

    const renderPositions = () => (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div><h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase"><Briefcase size={24} className="text-blue-600"/> Lista Stanowisk</h2><p className="text-sm text-slate-500 mt-1 font-medium italic">Zarządzaj dostępnymi stanowiskami i wymaganiami w Twojej firmie.</p></div>
                <Button onClick={() => handleOpenPositionModal()} className="rounded-xl h-11 px-6 font-black shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 transition-all active:scale-95"><Plus size={20} className="mr-2"/> Dodaj Stanowisko</Button>
            </div>
            <div className="relative pl-20 space-y-4">
                <div className="absolute left-[40px] top-4 bottom-4 w-1 bg-slate-100 rounded-full"></div>
                {sortedPositions.map((pos, idx) => {
                    const range = calculateSalaryRange(pos);
                    return (
                        <div key={pos.id} className="relative group">
                            <div className="absolute -left-[64px] top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full border-4 border-slate-50 shadow-sm flex items-center justify-center text-slate-400 font-black text-lg z-10 group-hover:border-blue-100 group-hover:text-blue-500 transition-all">{idx + 1}</div>
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all p-6 flex flex-col md:flex-row items-center gap-6 cursor-pointer" onClick={() => handleOpenPositionModal(pos)}>
                                <div className="flex-1"><div className="flex items-center gap-3 mb-2"><h3 className="text-xl font-black text-slate-900 tracking-tight uppercase group-hover:text-blue-600 transition-colors">{pos.name}</h3><span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase border border-blue-100">Aktywne</span></div><div className="flex items-center gap-4 text-xs font-bold text-slate-400"><div className="flex items-center gap-1.5"><Layers size={14}/> {pos.required_skill_ids?.length || 0} wymagań</div><div className="flex items-center gap-1.5"><List size={14}/> {pos.responsibilities?.length || 0} obowiązków</div></div></div>
                                <div className="flex items-center gap-8"><div className="text-right"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">WYNAGRODZENIE</div><div className="text-2xl font-black text-green-600 leading-none">{range.min.toFixed(0)}-{range.max.toFixed(0)} <span className="text-xs font-bold text-slate-400">{range.unit}</span></div></div><div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}><button onClick={() => movePosition(idx, 'up')} disabled={idx === 0} className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-20 transition-colors"><ChevronUp size={20}/></button><button onClick={() => movePosition(idx, 'down')} disabled={idx === sortedPositions.length - 1} className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-20 transition-colors"><ChevronDown size={20}/></button></div><ChevronRight className="text-slate-200 group-hover:text-blue-400 transition-colors" size={24} /></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderSystem = () => (
        <div className="max-w-5xl animate-in fade-in duration-300">
            <AccordionItem 
                id="base-rate" 
                icon={DollarSign} 
                title="Stawka Bazowa & Bonusy" 
                description="Zarządzaj globalną stawką bazową oraz dodatkami za nadgodziny i staż." 
                isOpen={openAccordion === 'base-rate'} 
                onToggle={toggleAccordion}
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">STAWKA BAZOWA PLN/H</label>
                            <div className="relative">
                                <input type="number" step="0.5" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-black text-xl text-slate-800 focus:bg-white outline-none transition-all shadow-inner" value={localSystemConfig.baseRate} onChange={(e) => setLocalSystemConfig({...localSystemConfig, baseRate: Number(e.target.value)})}/>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300 uppercase text-xs">PLN / H</span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1.5"><Zap size={10} className="text-blue-500"/> BONUS ZA NADGODZINY</label>
                            <div className="relative">
                                <input type="number" step="0.5" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-black text-xl text-blue-600 focus:bg-white outline-none transition-all shadow-inner" value={localSystemConfig.overtimeBonus} onChange={(e) => setLocalSystemConfig({...localSystemConfig, overtimeBonus: Number(e.target.value)})}/>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300 uppercase text-xs">PLN / H</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1.5"><Calendar size={10} className="text-orange-500"/> PRACA W DNI WOLNE</label>
                            <div className="relative">
                                <input type="number" step="0.5" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-black text-xl text-orange-600 focus:bg-white outline-none transition-all shadow-inner" value={localSystemConfig.holidayBonus} onChange={(e) => setLocalSystemConfig({...localSystemConfig, holidayBonus: Number(e.target.value)})}/>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300 uppercase text-xs">PLN / H</span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1.5"><TrendingUp size={10} className="text-green-500"/> BONUS ZA STAŻ (CO 1 ROK)</label>
                            <div className="relative">
                                <input type="number" step="0.1" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-black text-xl text-green-600 focus:bg-white outline-none transition-all shadow-inner" value={localSystemConfig.seniorityBonus} onChange={(e) => setLocalSystemConfig({...localSystemConfig, seniorityBonus: Number(e.target.value)})}/>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300 uppercase text-xs">PLN / H</span>
                            </div>
                        </div>
                    </div>
                    {/* Delegation Bonus Input */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1.5"><MapPin size={10} className="text-purple-500"/> STAWKA ZA DELEGACJĘ</label>
                            <div className="relative">
                                <input type="number" step="0.5" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-black text-xl text-purple-600 focus:bg-white outline-none transition-all shadow-inner" value={localSystemConfig.delegationBonus} onChange={(e) => setLocalSystemConfig({...localSystemConfig, delegationBonus: Number(e.target.value)})}/>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300 uppercase text-xs">PLN / H</span>
                            </div>
                        </div>
                    </div>
                </div>
            </AccordionItem>
            
            <AccordionItem
                id="doc-permissions"
                icon={ShieldCheck}
                title="Dokumenty i Uprawnienia"
                description="Zarządzaj typami dokumentów (SEP, UDT) i stawkami bonusowymi za nie."
                isOpen={openAccordion === 'doc-permissions'}
                onToggle={toggleAccordion}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(localSystemConfig.bonusDocumentTypes || []).map((doc, idx) => (
                            <div key={doc.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between group">
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">NAZWA DOKUMENTU</p>
                                    <input
                                        className="w-full bg-transparent border-none p-0 font-bold text-slate-800 text-sm focus:ring-0"
                                        value={doc.label}
                                        onChange={e => {
                                            const newDocs = [...localSystemConfig.bonusDocumentTypes];
                                            newDocs[idx].label = e.target.value;
                                            setLocalSystemConfig({...localSystemConfig, bonusDocumentTypes: newDocs});
                                        }}
                                    />
                                </div>
                                <div className="w-24 px-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right">PLN/H</p>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-right font-black text-blue-600 outline-none"
                                        value={doc.bonus}
                                        onChange={e => {
                                            const newDocs = [...localSystemConfig.bonusDocumentTypes];
                                            newDocs[idx].bonus = Number(e.target.value);
                                            setLocalSystemConfig({...localSystemConfig, bonusDocumentTypes: newDocs});
                                        }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newDocs = localSystemConfig.bonusDocumentTypes.filter((_, i) => i !== idx);
                                        const updated = {...localSystemConfig, bonusDocumentTypes: newDocs};
                                        setLocalSystemConfig(updated);
                                        updateSystemConfig(updated);
                                        showSuccess('Dokument usunięty.');
                                    }}
                                    className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="bg-blue-50 p-5 rounded-[24px] border border-blue-100 flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5 ml-1">NOWY TYP DOKUMENTU</label>
                            <input
                                className="w-full bg-white border border-blue-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                placeholder="np. SEP G1 Eksploatacja"
                                value={newDocLabel}
                                onChange={e => setNewDocLabel(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-32">
                            <label className="block text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5 ml-1">BONUS PLN/H</label>
                            <input
                                type="number"
                                step="0.1"
                                className="w-full bg-white border border-blue-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                value={newDocBonus}
                                onChange={e => setNewDocBonus(Number(e.target.value))}
                            />
                        </div>
                        <Button
                            type="button"
                            onClick={() => {
                                if (newDocLabel) {
                                    const newDoc = { id: 'doc_' + Date.now(), label: newDocLabel, bonus: newDocBonus };
                                    const updated = {
                                        ...localSystemConfig,
                                        bonusDocumentTypes: [...(localSystemConfig.bonusDocumentTypes || []), newDoc]
                                    };
                                    setLocalSystemConfig(updated);
                                    updateSystemConfig(updated);
                                    setNewDocLabel('');
                                    setNewDocBonus(0);
                                    showSuccess('Dokument dodany!');
                                }
                            }}
                            disabled={!newDocLabel}
                            className="h-12 px-8 rounded-xl font-black shadow-lg shadow-blue-600/20"
                        >
                            <Plus size={20} className="mr-2" /> Dodaj Dokument
                        </Button>
                    </div>
                </div>
            </AccordionItem>
            <AccordionItem id="contracts" icon={FileJson} title="Formy Zatrudnienia" description="Zarządzaj typami umów i bonusami za formę współpracy." isOpen={openAccordion === 'contracts'} onToggle={toggleAccordion}>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(localSystemConfig.contractBonuses).map(([type, bonus]) => {
                            const isUZ = type.toLowerCase() === 'uz';
                            const isCore = ['uop', 'uz', 'b2b'].includes(type.toLowerCase());
                            return (
                                <div key={type} className={`bg-slate-50 p-5 rounded-[24px] border border-slate-100 flex flex-col group transition-all hover:border-blue-200 relative overflow-hidden ${isUZ ? 'bg-indigo-50/50 border-indigo-100' : ''}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TYP UMOWY</p>
                                            <p className="font-bold text-slate-800 text-sm uppercase">{CONTRACT_TYPE_LABELS[type as ContractType] || type}</p>
                                        </div>
                                        <div className="w-28 flex items-center gap-2">
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right">BONUS PLN/H</p>
                                                <div className="relative">
                                                    <input type="number" className="w-full bg-white border border-slate-200 p-2 rounded-xl text-right font-black text-blue-600 outline-none focus:ring-4 focus:ring-blue-500/10" value={bonus} onChange={(e) => setLocalSystemConfig({ ...localSystemConfig, contractBonuses: { ...localSystemConfig.contractBonuses, [type]: Number(e.target.value) } })}/>
                                                </div>
                                            </div>
                                            {!isCore && (
                                                <button onClick={() => handleRemoveContractType(type)} className="mt-5 p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100" title="Usuń formę zatrudnienia">
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {isUZ && (<div className="mt-2 pt-4 border-t border-indigo-100 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-300"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100"><GraduationCap size={16}/></div><div><p className="text-[10px] font-black text-indigo-900 uppercase tracking-tight">Status Studenta</p><p className="text-[8px] font-medium text-indigo-400 uppercase tracking-wider">Dodatkowy bonus dla osób &lt; 26 lat</p></div></div><div className="w-24"><div className="relative"><input type="number" className="w-full bg-white border border-indigo-200 p-1.5 rounded-lg text-center font-black text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-500/10" value={localSystemConfig.studentBonus} onChange={(e) => setLocalSystemConfig({...localSystemConfig, studentBonus: Number(e.target.value)})}/><span className="absolute -right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-indigo-300 uppercase">PLN</span></div></div></div>)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </AccordionItem>
            <AccordionItem id="reasons" icon={ShieldAlertIcon} title="Powody Zwolnień" description="Lista przyczyn dostępna przy rozwiązywaniu umów." isOpen={openAccordion === 'reasons'} onToggle={toggleAccordion}><div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{localSystemConfig.terminationReasons.map((reason, idx) => (<div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center group"><span className="text-sm font-medium text-slate-700">{reason}</span><button type="button" onClick={() => setLocalSystemConfig({...localSystemConfig, terminationReasons: localSystemConfig.terminationReasons.filter((_, i) => i !== idx)})} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button></div>))}</div><div className="flex gap-2"><input className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold focus:bg-white outline-none transition-all" placeholder="Wpisz nowy powód..." value={newReason} onChange={e => setNewReason(e.target.value)}/><Button type="button" onClick={() => { if (newReason) { setLocalSystemConfig({...localSystemConfig, terminationReasons: [...localSystemConfig.terminationReasons, newReason]}); setNewReason(''); } }} disabled={!newReason} className="rounded-xl px-6"><Plus size={20} className="mr-2" /> Dodaj</Button></div></div></AccordionItem>
            <AccordionItem id="categories" icon={Tag} title="Kategorie Notatek i Odznak" description="Zarządzaj słownikami kategorii dla ocen i wyróżnień." isOpen={openAccordion === 'categories'} onToggle={toggleAccordion}><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-4"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><MessageSquare size={14} className="text-blue-500"/> Kategorie Notatek</h4><div className="space-y-2">{localSystemConfig.noteCategories.map((cat, idx) => (<div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex justify-between items-center group"><span className="text-xs font-bold text-slate-700">{cat}</span><button type="button" onClick={() => setLocalSystemConfig({...localSystemConfig, noteCategories: localSystemConfig.noteCategories.filter((_, i) => i !== idx)})} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button></div>))}</div><div className="flex gap-2"><input className="flex-1 bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold outline-none" placeholder="Nowa kategoria..." value={tempNoteCategory} onChange={e => setTempNoteCategory(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && tempNoteCategory.trim()) { setLocalSystemConfig({...localSystemConfig, noteCategories: [...localSystemConfig.noteCategories, tempNoteCategory.trim()]}); setTempNoteCategory(''); } }}/><Button type="button" size="sm" onClick={() => { if(tempNoteCategory.trim()) { setLocalSystemConfig({...localSystemConfig, noteCategories: [...localSystemConfig.noteCategories, tempNoteCategory.trim()]}); setTempNoteCategory(''); } }} disabled={!tempNoteCategory.trim()} className="rounded-xl px-4"><Plus size={16}/></Button></div></div><div className="space-y-4"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Star size={14} className="text-yellow-500"/> Typy Odznak</h4><div className="space-y-2">{localSystemConfig.badgeTypes.map((type, idx) => (<div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex justify-between items-center group"><span className="text-xs font-bold text-slate-700">{type}</span><button type="button" onClick={() => setLocalSystemConfig({...localSystemConfig, badgeTypes: localSystemConfig.badgeTypes.filter((_, i) => i !== idx)})} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button></div>))}</div><div className="flex gap-2"><input className="flex-1 bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold outline-none" placeholder="Nowy typ..." value={tempBadgeType} onChange={e => setTempBadgeType(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && tempBadgeType.trim()) { setLocalSystemConfig({...localSystemConfig, badgeTypes: [...localSystemConfig.badgeTypes, tempBadgeType.trim()]}); setTempBadgeType(''); } }}/><Button type="button" size="sm" onClick={() => { if(tempBadgeType.trim()) { setLocalSystemConfig({...localSystemConfig, badgeTypes: [...localSystemConfig.badgeTypes, tempBadgeType.trim()]}); setTempBadgeType(''); } }} disabled={!tempBadgeType.trim()} className="rounded-xl px-4"><Plus size={16}/></Button></div></div></div></AccordionItem>
            <div className="flex justify-end mt-10"><Button className="px-12 h-14 rounded-2xl font-black shadow-xl shadow-blue-600/20 text-base" onClick={handleSaveSystem}><Save size={24} className="mr-3"/> ZAPISZ KONFIGURACJĘ</Button></div>
        </div>
    );

    const renderAccess = () => (
        <div className="space-y-6">
          {/* Active Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myModules.filter(m => m.is_active).map(cm => {
              const moduleInfo = MODULE_INFO[cm.module_code];
              const isSelected = selectedModule === cm.module_code;

              return (
                <div
                  key={cm.id}
                  onClick={() => setSelectedModule(isSelected ? null : cm.module_code)}
                  className={`bg-white border rounded-xl p-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600">
                      {moduleInfo?.icon || <Package className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{cm.module?.name_pl || MODULE_LABELS[cm.module_code]}</h3>
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">Aktywny</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{moduleInfo?.description || ''}</p>
                      <p className="text-sm text-blue-600 mt-2">
                        <Users className="w-4 h-4 inline mr-1" />
                        {cm.activeUsers} / {cm.max_users} użytkowników
                      </p>
                      {cm.scheduled_max_users && cm.scheduled_max_users !== cm.max_users && (
                        <p className={`text-xs mt-1 ${cm.scheduled_max_users > cm.max_users ? 'text-blue-600' : 'text-red-600'}`}>
                          Od następnego okresu: {cm.scheduled_max_users} użytkowników
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {myModules.filter(m => m.is_active).length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Brak aktywnych modułów</p>
            </div>
          )}

          {/* User Access Management */}
          {selectedModule && (
            <div className="bg-white border border-slate-200 rounded-xl">
              <div className="p-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      {MODULE_INFO[selectedModule]?.icon || <Package className="w-4 h-4" />}
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Dostęp do: {MODULE_INFO[selectedModule]?.name || MODULE_LABELS[selectedModule]}
                    </h2>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Szukaj użytkownika..."
                      value={accessSearch}
                      onChange={(e) => setAccessSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full sm:w-64 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Users with Access */}
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Z dostępem ({usersWithAccess.length})
                </h3>
                {usersWithAccess.length > 0 ? (
                  <div className="space-y-2">
                    {usersWithAccess.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-700 font-medium text-sm">
                              {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                              {user.role === Role.COMPANY_ADMIN && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">Admin</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAccess(user.id, selectedModule, true)}
                          disabled={accessLoading === user.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                        >
                          {accessLoading === user.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <ToggleRight className="w-5 h-5" />
                          )}
                          <span className="text-sm hidden sm:inline">Usuń dostęp</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-2">Brak użytkowników z dostępem</p>
                )}
              </div>

              {/* Users without Access */}
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <X className="w-4 h-4 text-slate-400" />
                  Bez dostępu ({usersWithoutAccess.length})
                </h3>
                {usersWithoutAccess.length > 0 ? (
                  <div className="space-y-2">
                    {usersWithoutAccess.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                            <span className="text-slate-600 font-medium text-sm">
                              {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                              {user.role === Role.COMPANY_ADMIN && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">Admin</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAccess(user.id, selectedModule, false)}
                          disabled={accessLoading === user.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-green-600 hover:bg-green-100 rounded-lg transition disabled:opacity-50"
                        >
                          {accessLoading === user.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                          <span className="text-sm hidden sm:inline">Nadaj dostęp</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-2">Wszyscy użytkownicy mają dostęp</p>
                )}
              </div>
            </div>
          )}

          {/* Info Banner when no module selected */}
          {!selectedModule && myModules.filter(m => m.is_active).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Wybierz moduł powyżej</p>
                <p className="text-sm text-blue-700 mt-1">Kliknij na kartę modułu, aby zarządzać dostępem użytkowników.</p>
              </div>
            </div>
          )}
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <h1 className="text-2xl font-bold text-slate-900 mb-6 tracking-tight">Ustawienia Systemu</h1>
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-8 w-fit overflow-x-auto">
                {[
                    { id: 'general', label: 'MÓJ PROFIL', icon: UserIcon },
                    { id: 'positions', label: 'STANOWISKA', icon: Briefcase },
                    { id: 'system', label: 'KONFIGURACJA', icon: SettingsIcon },
                    { id: 'access', label: 'DOSTĘPY', icon: Users }
                ].map(t => (
                    <button key={t.id} type="button" onClick={() => setActiveTab(t.id as TabType)} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2.5 transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}><t.icon size={14} /> {t.label}</button>
                ))}
            </div>
            <div className="relative min-h-[400px]">
                {activeTab === 'general' && renderGeneral()}
                {activeTab === 'positions' && renderPositions()}
                {activeTab === 'system' && renderSystem()}
                {activeTab === 'access' && renderAccess()}
            </div>
            {isPositionModalOpen && editingPosition && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in duration-300 flex flex-col">
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">{editingPosition.id ? 'Edytuj Stanowisko' : 'Nowe Stanowisko'}</h3>
                            <button onClick={() => setIsPositionModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-white rounded-full"><X size={18} /></button>
                        </div>

                        {/* Content - Scrollable */}
                        <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-hide">
                            {/* Name */}
                            <div className="space-y-1">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nazwa stanowiska</label>
                                <input className="w-full bg-[#2D2E32] border-none rounded-xl p-2.5 text-white font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-inner" value={editingPosition.name} onChange={e => setEditingPosition({...editingPosition, name: e.target.value})} placeholder="Wpisz nazwę..."/>
                            </div>

                            {/* Salary Type */}
                            <div className="space-y-2">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Rodzaj wynagrodzenia</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                                    <button type="button" onClick={() => setEditingPosition({...editingPosition, salary_type: 'hourly'})} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${editingPosition.salary_type === 'hourly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Godzinowa</button>
                                    <button type="button" onClick={() => setEditingPosition({...editingPosition, salary_type: 'monthly'})} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${editingPosition.salary_type === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Miesięczna</button>
                                </div>
                                {editingPosition.salary_type === 'monthly' ? (
                                    <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="space-y-1"><label className="block text-[7px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Min (PLN)</label><input type="number" className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl font-black text-slate-800 text-sm focus:bg-white outline-none" value={editingPosition.min_monthly_rate} onChange={e => setEditingPosition({...editingPosition, min_monthly_rate: Number(e.target.value)})}/></div>
                                        <div className="space-y-1"><label className="block text-[7px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Max (PLN)</label><input type="number" className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl font-black text-slate-800 text-sm focus:bg-white outline-none" value={editingPosition.max_monthly_rate} onChange={e => setEditingPosition({...editingPosition, max_monthly_rate: Number(e.target.value)})}/></div>
                                    </div>
                                ) : (
                                    <div className="bg-blue-50 border border-blue-100 p-2.5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200"><div className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Wyliczona prognoza</div><div className="text-lg font-black text-blue-700">{calculateSalaryRange(editingPosition).min.toFixed(2)}-{calculateSalaryRange(editingPosition).max.toFixed(2)} <span className="text-xs font-bold text-blue-400">zł/h</span></div><p className="text-[8px] text-blue-400 font-medium leading-tight mt-0.5">Baza + umiejętności + uprawnienia</p></div>
                                )}
                            </div>

                            {/* Referral Bonus */}
                            <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Gift size={10} className="text-purple-500"/> Bonus za polecenie</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" className="w-full bg-white border border-slate-200 p-2 rounded-lg font-black text-slate-800 text-sm focus:ring-2 focus:ring-purple-500/10 outline-none transition-all" value={editingPosition.referral_bonus || 0} onChange={e => setEditingPosition({...editingPosition, referral_bonus: Number(e.target.value)})} placeholder="0.00"/>
                                    <span className="text-slate-400 font-black text-[10px]">PLN</span>
                                </div>
                            </div>

                            {/* Section 1: Required Skills */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newCollapsed = new Set(collapsedModalSections);
                                        if (newCollapsed.has('skills')) newCollapsed.delete('skills');
                                        else newCollapsed.add('skills');
                                        setCollapsedModalSections(newCollapsed);
                                    }}
                                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {collapsedModalSections.has('skills') ? <ChevronRight size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Wymagane umiejętności</span>
                                        <span className="text-[8px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{editingPosition.required_skill_ids?.length || 0}</span>
                                    </div>
                                </button>
                                {!collapsedModalSections.has('skills') && (
                                    <div className="p-3 bg-white">
                                        <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden shadow-inner max-h-[220px] overflow-y-auto scrollbar-hide">
                                            {Object.entries(skillsByCategory).map(([category, categorySkills]) => {
                                                const isCollapsed = collapsedCategories.has(category);
                                                const selectedCount = categorySkills.filter(s => editingPosition.required_skill_ids?.includes(s.id)).length;
                                                return (
                                                    <div key={category} className="border-b border-slate-100 last:border-b-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newCollapsed = new Set(collapsedCategories);
                                                                if (isCollapsed) newCollapsed.delete(category);
                                                                else newCollapsed.add(category);
                                                                setCollapsedCategories(newCollapsed);
                                                            }}
                                                            className="w-full flex items-center justify-between p-2 bg-slate-100 hover:bg-slate-200 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {isCollapsed ? <ChevronRight size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>}
                                                                <span className="text-[9px] font-black text-slate-700 uppercase tracking-wide">{category}</span>
                                                                {selectedCount > 0 && <span className="text-[8px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">{selectedCount}</span>}
                                                            </div>
                                                            <span className="text-[8px] font-medium text-slate-400">{categorySkills.length} umiejętności</span>
                                                        </button>
                                                        {!isCollapsed && (
                                                            <div className="divide-y divide-slate-100">
                                                                {categorySkills.map(skill => {
                                                                    const isSelected = editingPosition.required_skill_ids?.includes(skill.id);
                                                                    return (
                                                                        <label key={skill.id} className={`flex items-center justify-between p-2 cursor-pointer transition-all ${isSelected ? 'bg-blue-50/50' : 'hover:bg-white'}`}>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                                                                                    {isSelected && <Check size={10} />}
                                                                                </div>
                                                                                <input type="checkbox" className="hidden" checked={isSelected} onChange={() => {
                                                                                    const current = editingPosition.required_skill_ids || [];
                                                                                    const updated = isSelected ? current.filter(id => id !== skill.id) : [...current, skill.id];
                                                                                    setEditingPosition({...editingPosition, required_skill_ids: updated});
                                                                                }}/>
                                                                                <span className="text-[11px] font-bold text-slate-800 leading-tight">{skill.name_pl}</span>
                                                                            </div>
                                                                            <span className="text-[9px] font-black text-green-600">+{skill.hourly_bonus.toFixed(2)} zł</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Required Documents */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newCollapsed = new Set(collapsedModalSections);
                                        if (newCollapsed.has('documents')) newCollapsed.delete('documents');
                                        else newCollapsed.add('documents');
                                        setCollapsedModalSections(newCollapsed);
                                    }}
                                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {collapsedModalSections.has('documents') ? <ChevronRight size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Wymagane uprawnienia / dokumenty</span>
                                        <span className="text-[8px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">{editingPosition.required_document_ids?.length || 0}</span>
                                    </div>
                                </button>
                                {!collapsedModalSections.has('documents') && (
                                    <div className="p-3 bg-white">
                                        <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden shadow-inner max-h-[180px] overflow-y-auto scrollbar-hide divide-y divide-slate-100">
                                            {localSystemConfig.bonusDocumentTypes.map(doc => {
                                                const isSelected = editingPosition.required_document_ids?.includes(doc.id);
                                                return (
                                                    <label key={doc.id} className={`flex items-center justify-between p-2 cursor-pointer transition-all ${isSelected ? 'bg-purple-50/50' : 'hover:bg-white'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-300'}`}>
                                                                {isSelected && <Check size={10} />}
                                                            </div>
                                                            <input type="checkbox" className="hidden" checked={isSelected} onChange={() => {
                                                                const current = editingPosition.required_document_ids || [];
                                                                const updated = isSelected ? current.filter(id => id !== doc.id) : [...current, doc.id];
                                                                setEditingPosition({...editingPosition, required_document_ids: updated});
                                                            }}/>
                                                            <span className="text-[11px] font-bold text-slate-800 leading-tight">{doc.label}</span>
                                                        </div>
                                                        <span className="text-[9px] font-black text-purple-600">+{doc.bonus.toFixed(2)} zł/h</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 3: Responsibilities */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newCollapsed = new Set(collapsedModalSections);
                                        if (newCollapsed.has('responsibilities')) newCollapsed.delete('responsibilities');
                                        else newCollapsed.add('responsibilities');
                                        setCollapsedModalSections(newCollapsed);
                                    }}
                                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {collapsedModalSections.has('responsibilities') ? <ChevronRight size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Obowiązki</span>
                                        <span className="text-[8px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">{editingPosition.responsibilities?.length || 0}</span>
                                    </div>
                                </button>
                                {!collapsedModalSections.has('responsibilities') && (
                                    <div className="p-3 bg-white space-y-2">
                                        <div className="flex gap-2">
                                            <input className="flex-1 bg-slate-100 border-none rounded-lg p-2 text-slate-700 font-medium text-xs focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Dodaj obowiązek..." value={newResp} onChange={e => setNewResp(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(newResp) { setEditingPosition({...editingPosition, responsibilities: [...(editingPosition.responsibilities || []), newResp]}); setNewResp(''); } } }} />
                                            <button type="button" onClick={() => { if(newResp) { setEditingPosition({...editingPosition, responsibilities: [...(editingPosition.responsibilities || []), newResp]}); setNewResp(''); } }} className="bg-blue-600 text-white p-2 rounded-lg shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"><Plus size={14}/></button>
                                        </div>
                                        <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-hide">
                                            {(editingPosition.responsibilities || []).map((resp, i) => (
                                                <div key={i} className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-100 rounded-lg group hover:bg-white hover:border-blue-200 transition-all">
                                                    <div className="flex items-center gap-1.5 truncate flex-1">
                                                        <Check size={10} className="text-green-500 shrink-0" />
                                                        <span className="text-[11px] font-bold text-slate-700 truncate">{resp}</span>
                                                    </div>
                                                    <button type="button" onClick={() => setEditingPosition({...editingPosition, responsibilities: (editingPosition.responsibilities || []).filter((_, idx) => idx !== i)})} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center bg-slate-50/30 shrink-0">
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsPositionModalOpen(false)} className="px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors">Anuluj</button>
                                {editingPosition.id && (
                                    <button type="button" onClick={() => { if(confirm('Czy na pewno chcesz usunąć to stanowisko?')) { deletePosition(editingPosition.id!); setIsPositionModalOpen(false); } }} className="px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition-all">Usuń</button>
                                )}
                            </div>
                            <Button onClick={handleSavePosition} className="px-6 h-9 rounded-lg font-black shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 text-xs">
                                <Save size={14} className="mr-1.5"/> {editingPosition.id ? 'Zapisz' : 'Dodaj'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {successMsg && <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 flex items-center gap-3 z-[100]"><CheckCircle2 size={20}/><span className="font-bold">{successMsg}</span></div>}
        </div>
    );
};
