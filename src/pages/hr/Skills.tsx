
import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Archive, RotateCcw, ChevronDown, ChevronUp, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Skill, SkillCategory, VerificationType, SkillStatus } from '../../types';

export const HRSkillsPage = () => {
    const { state, addSkill, updateSkill, deleteSkill } = useAppContext();
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<Partial<Skill>>({});
    
    // Confirmation Modal
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        actionLabel: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', actionLabel: '', onConfirm: () => {} });

    // Group skills by category
    const categorizedSkills = useMemo(() => {
        const groups: Record<string, Skill[]> = {};
        const skillsToProcess = state.skills.filter(s => viewMode === 'archived' ? s.is_archived : !s.is_archived);

        (Object.values(SkillCategory) as string[]).forEach((cat) => {
            groups[cat] = [];
        });

        skillsToProcess.forEach(skill => {
            if (!groups[skill.category]) groups[skill.category] = [];
            groups[skill.category].push(skill);
        });

        return groups;
    }, [state.skills, viewMode]);

    const handleOpenModal = (skill?: Skill) => {
        if (skill) {
            setSelectedSkill({ ...skill });
        } else {
            setSelectedSkill({
                name_pl: '',
                description_pl: '',
                category: SkillCategory.INNE,
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
        const currentCriteria = (selectedSkill.criteria || []) as string[];
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
                            <Button variant="secondary" onClick={() => setViewMode('archived')}>
                                <Archive size={18} className="mr-2"/> Archiwum
                            </Button>
                            <Button onClick={() => handleOpenModal()}>
                                <Plus size={18} className="mr-2"/> Dodaj Umiejętność
                            </Button>
                        </>
                    ) : (
                        <Button variant="secondary" onClick={() => setViewMode('active')}>
                            <RotateCcw size={18} className="mr-2"/> Wróć do Aktywnych
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {Object.entries(categorizedSkills).map(([cat, skillsList]: [string, Skill[]]) => {
                    if (viewMode === 'active' && skillsList.length === 0) return null; 
                    if (skillsList.length === 0) return null;

                    return (
                        <div key={cat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <button 
                                className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors"
                                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                            >
                                <span className="font-bold text-slate-800">{cat}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-white border px-2 py-1 rounded text-slate-500">{skillsList.length}</span>
                                    {activeCategory === cat ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                                </div>
                            </button>
                            
                            {activeCategory === cat && (
                                <div className="divide-y divide-slate-100 border-t border-slate-100">
                                    {skillsList.map((skill: Skill) => {
                                        // Resolved 'unknown' type error by using a local typed constant for criteria.
                                        const criteria: string[] = skill.criteria || [];
                                        
                                        return (
                                            <div key={skill.id} className={`p-6 hover:bg-slate-50 transition-colors ${!skill.is_active ? 'opacity-70 bg-slate-50' : ''}`}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                            {skill.name_pl}
                                                            {!skill.is_active && <span className="text-xs border border-slate-400 text-slate-500 px-1.5 rounded bg-white">Nieaktywna</span>}
                                                        </h3>
                                                        <p className="text-sm text-slate-600 mt-1">{skill.description_pl}</p>
                                                        
                                                        <div className="flex gap-4 mt-3 text-sm">
                                                            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-bold border border-green-100">
                                                                +{skill.hourly_bonus} zł/h
                                                            </div>
                                                            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold border border-blue-100">
                                                                {skill.verification_type === VerificationType.THEORY_ONLY && 'Teoria'}
                                                                {skill.verification_type === VerificationType.THEORY_PRACTICE && 'Teoria + Praktyka'}
                                                                {skill.verification_type === VerificationType.DOCUMENT && 'Dokument'}
                                                            </div>
                                                        </div>

                                                        {criteria.length > 0 && (
                                                            <div className="mt-4 pl-4 border-l-2 border-slate-200">
                                                                <p className="text-xs text-slate-400 uppercase font-bold mb-2">Kryteria weryfikacji:</p>
                                                                <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4">
                                                                    {criteria.map((c: string, i: number) => (
                                                                        <li key={`skill-crit-${i}`}>{c}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {viewMode === 'active' ? (
                                                            <>
                                                                <Button size="sm" variant="ghost" onClick={() => handleOpenModal(skill)}>
                                                                    <Edit size={18}/>
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleArchiveSkill(skill)}>
                                                                    <Archive size={18}/>
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Button size="sm" variant="ghost" className="text-blue-500 hover:bg-blue-50" onClick={() => handleRestoreSkill(skill)}>
                                                                <RotateCcw size={18}/>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-bold">{selectedSkill.id ? 'Edytuj Umiejętność' : 'Nowa Umiejętność'}</h2>
                            <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700">Nazwa (PL)</label>
                                <input className="w-full border p-2 rounded mt-1" value={selectedSkill.name_pl || ''} onChange={e => setSelectedSkill({...selectedSkill, name_pl: e.target.value})} placeholder="np. Montaż gniazd 230V" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700">Kategoria</label>
                                <select className="w-full border p-2 rounded mt-1" value={selectedSkill.category || SkillCategory.INNE} onChange={e => setSelectedSkill({...selectedSkill, category: e.target.value as SkillCategory})}>
                                    {(Object.values(SkillCategory) as string[]).map((c: string) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700">Opis</label>
                                <textarea className="w-full border p-2 rounded mt-1" rows={2} value={selectedSkill.description_pl || ''} onChange={e => setSelectedSkill({...selectedSkill, description_pl: e.target.value})} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                   <label className="block text-sm font-bold text-slate-700">Stawka Bonus (zł/h)</label>
                                   <input type="number" step="0.5" className="w-full border p-2 rounded mt-1" value={selectedSkill.hourly_bonus || 0} onChange={e => setSelectedSkill({...selectedSkill, hourly_bonus: Number(e.target.value)})} />
                                </div>
                                <div>
                                   <label className="block text-sm font-bold text-slate-700">Typ Weryfikacji</label>
                                   <select className="w-full border p-2 rounded mt-1" value={selectedSkill.verification_type || VerificationType.THEORY_PRACTICE} onChange={e => setSelectedSkill({...selectedSkill, verification_type: e.target.value as VerificationType})}>
                                       <option value={VerificationType.THEORY_ONLY}>Teoria</option>
                                       <option value={VerificationType.THEORY_PRACTICE}>Teoria + Praktyka</option>
                                       <option value={VerificationType.DOCUMENT}>Dokument</option>
                                   </select>
                                </div>
                            </div>
                            
                            <div>
                               <label className="block text-sm font-bold text-slate-700">Status</label>
                               <button 
                                   className={`w-full mt-1 py-2 rounded font-bold border ${selectedSkill.is_active !== false ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                                   onClick={() => setSelectedSkill({...selectedSkill, is_active: !selectedSkill.is_active})}
                               >
                                   {selectedSkill.is_active !== false ? 'Aktywna' : 'Nieaktywna'}
                               </button>
                            </div>

                            <div className="border-t border-slate-100 pt-4 mt-4">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Kryteria Oceny (Checklista)</label>
                                <div className="space-y-2">
                                    {(selectedSkill.criteria as string[] || []).map((c: string, idx: number) => (
                                        <div key={`crit-${idx}`} className="flex gap-2">
                                            <input 
                                                className="flex-1 border p-2 rounded text-sm" 
                                                value={c} 
                                                onChange={e => updateCriterion(idx, e.target.value)} 
                                                placeholder="Opis kryterium..." 
                                            />
                                            <button onClick={() => removeCriterion(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    ))}
                                    <Button size="sm" variant="outline" onClick={addCriterion} className="w-full border-dashed"><Plus size={16} className="mr-2"/> Dodaj Kryterium</Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6 border-t border-slate-100 pt-4">
                            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Anuluj</Button>
                            <Button onClick={handleSaveSkill}>Zapisz</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmation.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{confirmation.title}</h3>
                            <p className="text-sm text-slate-500 mb-6">{confirmation.message}</p>
                            <div className="flex gap-3 w-full">
                                <Button fullWidth variant="ghost" onClick={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}>
                                    Anuluj
                                </Button>
                                <Button fullWidth variant="danger" onClick={() => {
                                    confirmation.onConfirm();
                                    setConfirmation(prev => ({ ...prev, isOpen: false }));
                                }}>
                                    {confirmation.actionLabel}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
