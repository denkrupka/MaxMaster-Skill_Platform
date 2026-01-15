
import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Archive, RotateCcw, ChevronDown, ChevronUp, X, CheckCircle, AlertTriangle, Folder, Save, Search, FileText, LayoutList } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Skill, VerificationType, SkillStatus } from '../../types';

export const HRSkillsPage = () => {
    const { state, addSkill, updateSkill, updateSystemConfig, triggerNotification } = useAppContext();
    const { systemConfig, skills } = state;

    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<Partial<Skill>>({});
    
    // Categories Management State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);
    const [editCategoryName, setEditCategoryName] = useState('');

    // Confirmation Modal for skills
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        actionLabel: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', actionLabel: '', onConfirm: () => {} });

    // Group skills by category using the dynamic list from config
    const categorizedSkills = useMemo(() => {
        const groups: Record<string, Skill[]> = {};
        const skillsToProcess = skills.filter(s => viewMode === 'archived' ? s.is_archived : !s.is_archived);

        (systemConfig.skillCategories || []).forEach((cat) => {
            groups[cat] = [];
        });

        skillsToProcess.forEach(skill => {
            if (!groups[skill.category]) groups[skill.category] = [];
            groups[skill.category].push(skill);
        });

        return groups;
    }, [skills, systemConfig.skillCategories, viewMode]);

    const handleOpenModal = (skill?: Skill) => {
        if (skill) {
            setSelectedSkill({ ...skill });
        } else {
            setSelectedSkill({
                name_pl: '',
                description_pl: '',
                category: systemConfig.skillCategories[0] || '',
                verification_type: VerificationType.THEORY_PRACTICE,
                hourly_bonus: 0,
                required_pass_rate: 80,
                criteria: [],
                is_active: true,
                is_archived: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveSkill = () => {
        if (!selectedSkill.name_pl || !selectedSkill.category) return;
        
        if (selectedSkill.id) {
            updateSkill(selectedSkill.id, selectedSkill);
        } else {
            addSkill(selectedSkill as Omit<Skill, 'id'>);
        }
        setIsModalOpen(false);
    };

    const handleArchiveSkill = (skill: Skill) => {
        setConfirmation({
            isOpen: true,
            title: "Archiwizacja Umiejętności",
            message: "Czy na pewno chcesz zarchiwizować tę umiejętność? Zostanie ona ukryta, ale historia użytkowników zostanie zachowana.",
            actionLabel: "Archiwizuj",
            onConfirm: () => {
                updateSkill(skill.id, { is_archived: true, is_active: false });
            }
        });
    };

    const handleRestoreSkill = (skill: Skill) => {
        setConfirmation({
            isOpen: true,
            title: "Przywracanie Umiejętności",
            message: "Czy przywrócić tę umiejętność z archiwum?",
            actionLabel: "Przywróć",
            onConfirm: () => {
                updateSkill(skill.id, { is_archived: false });
            }
        });
    };

    const addCriterion = () => {
        const currentCriteria = (selectedSkill.criteria as string[] || []) as string[];
        setSelectedSkill({ ...selectedSkill, criteria: [...currentCriteria, ''] });
    };

    const updateCriterion = (index: number, val: string) => {
        const currentCriteria = [...((selectedSkill.criteria || []) as string[])];
        currentCriteria[index] = val;
        setSelectedSkill({ ...selectedSkill, criteria: currentCriteria });
    };

    const removeCriterion = (index: number) => {
        const currentCriteria = [...((selectedSkill.criteria || []) as string[])];
        currentCriteria.splice(index, 1);
        setSelectedSkill({ ...selectedSkill, criteria: currentCriteria });
    };

    // --- Category CRUD Logic ---

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        const updatedCategories = [...(systemConfig.skillCategories || []), newCategoryName.trim()];
        await updateSystemConfig({ ...systemConfig, skillCategories: updatedCategories });
        setNewCategoryName('');
        triggerNotification('success', 'Dodano kategorię', `Pomyślnie dodano kategorię: ${newCategoryName}`);
    };

    const handleUpdateCategory = async (index: number) => {
        if (!editCategoryName.trim()) return;
        const newName = editCategoryName.trim();
        const updatedCategories = [...systemConfig.skillCategories];
        updatedCategories[index] = newName;

        await updateSystemConfig({ ...systemConfig, skillCategories: updatedCategories });
        
        setEditingCategoryIdx(null);
        setEditCategoryName('');
        triggerNotification('success', 'Zaktualizowano kategorię', 'Nazwa kategorii została zmieniona.');
    };

    const handleDeleteCategory = async (index: number) => {
        const categoryName = systemConfig.skillCategories[index];
        
        // Block deletion if used in ANY skill (active or archived)
        const isUsed = skills.some(s => s.category === categoryName);
        
        if (isUsed) {
            triggerNotification(
                'error', 
                'Nie można usunąć kategorii', 
                `Nie można usunąć kategorii "${categoryName.toUpperCase()}", ponieważ są do niej przypisane umiejętności. Najpierw przenieś lub usuń te umiejętności.`
            );
            return;
        }

        const updatedCategories = systemConfig.skillCategories.filter((_, i) => i !== index);
        await updateSystemConfig({ ...systemConfig, skillCategories: updatedCategories });
        triggerNotification('success', 'Usunięto kategorię', `Kategoria "${categoryName}" została usunięta.`);
    };

    const renderCategoryManagerModal = () => (
        <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">KATEGORIE MATRYCY</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Zarządzaj strukturą umiejętności</p>
                    </div>
                    <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white rounded-full transition-all shadow-sm">
                        <X size={20}/>
                    </button>
                </div>
                
                <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-hide bg-white">
                    {systemConfig.skillCategories.map((cat, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:border-blue-200">
                            {editingCategoryIdx === idx ? (
                                <div className="flex gap-2 w-full">
                                    <input 
                                        className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10" 
                                        value={editCategoryName}
                                        onChange={e => setEditCategoryName(e.target.value)}
                                        autoFocus
                                        onKeyDown={e => e.key === 'Enter' && handleUpdateCategory(idx)}
                                    />
                                    <button onClick={() => handleUpdateCategory(idx)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                        <Save size={16}/>
                                    </button>
                                    <button onClick={() => setEditingCategoryIdx(null)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">
                                        <X size={16}/>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        <span className="text-sm font-black text-slate-700 uppercase tracking-tight">{cat}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                        <button 
                                            onClick={() => { setEditingCategoryIdx(idx); setEditCategoryName(cat); }}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm transition-all"
                                            title="Edytuj"
                                        >
                                            <Edit size={14}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteCategory(idx)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-sm transition-all"
                                            title="Usuń"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Folder size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input 
                                className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" 
                                placeholder="Nowa kategoria..."
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                            />
                        </div>
                        <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="h-12 w-12 p-0 rounded-2xl shadow-lg shadow-blue-600/20">
                            <Plus size={24}/>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {viewMode === 'active' ? 'Matryca Umiejętności' : 'Archiwum Umiejętności'}
                    </h1>
                    <p className="text-sm text-slate-500">
                        Zarządzaj definicjami umiejętności, stawkami i kryteriami.
                    </p>
                </div>
                <div className="flex gap-2">
                    {viewMode === 'active' ? (
                        <>
                            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(true)} className="rounded-xl h-11 px-5 border-slate-200 text-slate-600 hover:bg-slate-50">
                                <Folder size={18} className="mr-2 text-blue-500"/> Kategorie
                            </Button>
                            <Button variant="secondary" onClick={() => setViewMode('archived')} className="rounded-xl h-11 px-5 border-slate-200 text-slate-600">
                                <Archive size={18} className="mr-2"/> Archiwum
                            </Button>
                            <Button onClick={() => handleOpenModal()} className="rounded-xl h-11 px-6 font-black shadow-lg shadow-blue-600/20"><Plus size={18} className="mr-2"/> Dodaj Umiejętność</Button>
                        </>
                    ) : (
                        <Button variant="secondary" onClick={() => setViewMode('active')} className="rounded-xl h-11 px-6">
                            <RotateCcw size={18} className="mr-2"/> Wróć do Aktywnych
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {/* Fix: Explicitly cast skillsList to any[] or Skill[] to resolve unknown type error */}
                {Object.entries(categorizedSkills).map(([cat, skillsList]) => {
                    if (viewMode === 'active' && (skillsList as Skill[]).length === 0) return null; 
                    if ((skillsList as Skill[]).length === 0) return null;

                    return (
                        <div key={cat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <button 
                                className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors"
                                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                            >
                                <span className="font-bold text-slate-800 uppercase text-xs tracking-widest">{cat}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-white border px-2 py-1 rounded text-slate-500 font-bold">{(skillsList as Skill[]).length}</span>
                                    {activeCategory === cat ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                                </div>
                            </button>
                            
                            {activeCategory === cat && (
                                <div className="divide-y divide-slate-100 border-t border-slate-100">
                                    {(skillsList as Skill[]).map((skill: Skill) => (
                                        <div 
                                            key={skill.id} 
                                            className={`p-4 px-6 hover:bg-slate-50 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group ${!skill.is_active ? 'opacity-70 bg-slate-50' : ''}`}
                                            onClick={() => handleOpenModal(skill)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
                                                        {skill.name_pl}
                                                    </h3>
                                                    {!skill.is_active && (
                                                        <span className="text-[8px] border border-slate-300 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest bg-white">
                                                            Nieaktywna
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">{skill.description_pl}</p>
                                            </div>

                                            <div className="flex items-center gap-4 flex-shrink-0">
                                                <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-black border border-green-100 text-[10px] shadow-sm min-w-[80px] text-center">
                                                    +{skill.hourly_bonus.toFixed(2)} zł/h
                                                </div>
                                                
                                                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-black border border-blue-100 text-[9px] uppercase tracking-tighter shadow-sm min-w-[120px] text-center">
                                                    {skill.verification_type === VerificationType.THEORY_ONLY && 'Teoria'}
                                                    {skill.verification_type === VerificationType.THEORY_PRACTICE && 'Teoria + Praktyka'}
                                                    {skill.verification_type === VerificationType.DOCUMENT && 'Dokument'}
                                                </div>

                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(skill); }}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm transition-all"
                                                    >
                                                        <Edit size={16}/>
                                                    </button>
                                                    {viewMode === 'active' ? (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleArchiveSkill(skill); }}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl shadow-sm transition-all"
                                                        >
                                                            <Archive size={16}/>
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRestoreSkill(skill); }}
                                                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-white rounded-xl shadow-sm transition-all"
                                                        >
                                                            <RotateCcw size={16}/>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Skill Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto scrollbar-hide animate-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                    <LayoutList size={20}/>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight uppercase text-slate-900">{selectedSkill.id ? 'Szczegóły Umiejętności' : 'Nowa Umiejętność'}</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Konfiguracja i kryteria weryfikacji</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all"><X size={24}/></button>
                        </div>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">NAZWA (PL)</label>
                                <input className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" value={selectedSkill.name_pl || ''} onChange={e => setSelectedSkill({...selectedSkill, name_pl: e.target.value})} placeholder="np. Montaż gniazd 230V" />
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">KATEGORIA</label>
                                <div className="relative">
                                    <select className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl font-bold text-slate-800 outline-none appearance-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" value={selectedSkill.category || ''} onChange={e => setSelectedSkill({...selectedSkill, category: e.target.value})}>
                                        {systemConfig.skillCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">OPIS</label>
                                <textarea className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-medium text-slate-700 text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none min-h-[80px] shadow-inner" value={selectedSkill.description_pl || ''} onChange={e => setSelectedSkill({...selectedSkill, description_pl: e.target.value})} />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">BONUS PLN/H</label>
                                   <div className="relative">
                                       <input type="number" step="0.5" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl font-black text-xl text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" value={selectedSkill.hourly_bonus || 0} onChange={e => setSelectedSkill({...selectedSkill, hourly_bonus: Number(e.target.value)})} />
                                       <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xs">PLN/H</span>
                                   </div>
                                </div>
                                <div>
                                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">WERYFIKACJA</label>
                                   <div className="relative">
                                       <select className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl font-bold text-slate-800 outline-none appearance-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" value={selectedSkill.verification_type || VerificationType.THEORY_PRACTICE} onChange={e => setSelectedSkill({...selectedSkill, verification_type: e.target.value as VerificationType})}>
                                           <option value={VerificationType.THEORY_ONLY}>Teoria</option>
                                           <option value={VerificationType.THEORY_PRACTICE}>Teoria + Praktyka</option>
                                           <option value={VerificationType.DOCUMENT}>Dokument</option>
                                       </select>
                                       <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                   </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex-1">STATUS AKTYWNOŚCI</label>
                                <button 
                                   className={`px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${selectedSkill.is_active !== false ? 'bg-green-600 text-white shadow-green-600/20' : 'bg-slate-200 text-slate-500 shadow-slate-200'}`}
                                   onClick={() => setSelectedSkill({...selectedSkill, is_active: !selectedSkill.is_active})}
                                >
                                   {selectedSkill.is_active !== false ? 'Aktywna' : 'Nieaktywna'}
                                </button>
                            </div>

                            <div className="pt-6 border-t border-slate-100">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><CheckCircle size={14} className="text-blue-600"/> Kryteria Oceny (Checklista)</span>
                                    <Button size="sm" variant="outline" onClick={addCriterion} className="rounded-xl h-8 px-4 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 transition-all">
                                        <Plus size={14} className="mr-1.5"/> Dodaj kryterium
                                    </Button>
                                </label>
                                <div className="space-y-3">
                                    {/* Fix: Explicitly cast criteria to any[] and map to resolve 'unknown' type error */}
                                    {((selectedSkill.criteria as any[]) || []).map((c: string, idx: number) => (
                                        <div key={`crit-${idx}`} className="flex gap-2 group animate-in slide-in-from-left-1 duration-200">
                                            <input 
                                                className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all shadow-sm" 
                                                value={c} 
                                                onChange={e => updateCriterion(idx, e.target.value)} 
                                                placeholder="Opis kryterium..." 
                                            />
                                            <button onClick={() => removeCriterion(idx)} className="text-slate-300 hover:text-red-500 p-2.5 hover:bg-red-50 rounded-xl transition-all">
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    ))}
                                    {/* Fix: Explicitly cast criteria to any[] and check length to resolve 'unknown' type error */}
                                    {(!selectedSkill.criteria || (selectedSkill.criteria as any[]).length === 0) && (
                                        <p className="text-xs text-slate-400 italic text-center py-4">Brak kryteriów. Dodaj pierwsze kryterium za pomocą przycisku powyżej.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-slate-100">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Anuluj</button>
                            <Button onClick={handleSaveSkill} className="px-12 h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95">
                                ZAPISZ UMIEJĘTNOŚĆ
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isCategoryModalOpen && renderCategoryManagerModal()}

            {/* Confirmation Modal for skills */}
            {confirmation.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] shadow-2xl max-sm w-full p-8 text-center animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-100 rounded-[20px] flex items-center justify-center text-red-600 mb-6 mx-auto shadow-inner">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight leading-tight">{confirmation.title}</h3>
                        <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">{confirmation.message}</p>
                        <div className="flex gap-3 w-full">
                            <Button fullWidth variant="ghost" className="font-black uppercase text-[10px] tracking-widest text-slate-400 h-12 rounded-xl" onClick={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}>Anuluj</Button>
                            <Button fullWidth variant="danger" className="font-black uppercase text-[10px] tracking-widest h-12 rounded-xl shadow-lg shadow-red-200 bg-red-600 hover:bg-red-700" onClick={() => {
                                confirmation.onConfirm();
                                setConfirmation(prev => ({ ...prev, isOpen: false }));
                            }}>{confirmation.actionLabel}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
