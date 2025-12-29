
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, ChevronUp, ChevronDown, ChevronRight, Edit, Trash2, X, Archive, RotateCcw, Image as ImageIcon, AlertTriangle, Clock } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Test, SkillCategory, Question, GradingStrategy, Skill } from '../../types';

export const HRTestsPage = () => {
    const { state, addTest, updateTest, updateSkill } = useAppContext();
    const [activeCategory, setActiveCategory] = useState<SkillCategory | null>(null);
    const [isTestDetailOpen, setIsTestDetailOpen] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Rate editing state (Detail view)
    const [isEditingRate, setIsEditingRate] = useState(false);
    const [tempRate, setTempRate] = useState<number>(0);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createTitle, setCreateTitle] = useState('');
    const [createSkillIds, setCreateSkillIds] = useState<string[]>([]);
    
    // Create Modal - Temporary selections for adding a skill
    const [tempCategory, setTempCategory] = useState<SkillCategory | ''>('');
    const [tempSkillId, setTempSkillId] = useState('');

    // Confirmation Modal State
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        actionLabel: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', actionLabel: '', onConfirm: () => {} });

    // Group tests by category.
    const categorizedTests = useMemo(() => {
        const groups: Record<string, {test: Test, relevantSkill: Skill}[]> = {};
        
        const testsToProcess = state.tests.filter(t => viewMode === 'archived' ? t.is_archived : !t.is_archived);

        testsToProcess.forEach(test => {
            if (!test.skill_ids || test.skill_ids.length === 0) {
                 // Fallback if no skills linked
                 const cat = SkillCategory.INNE;
                 if (!groups[cat]) groups[cat] = [];
                 groups[cat].push({ test, relevantSkill: { name_pl: 'Brak powiązania', hourly_bonus: 0 } as Skill });
            } else {
                test.skill_ids.forEach(skillId => {
                    const skill = state.skills.find(s => s.id === skillId);
                    if (skill) {
                        const cat = skill.category;
                        if (!groups[cat]) groups[cat] = [];
                        const exists = groups[cat].find(item => item.test.id === test.id);
                        if (!exists) {
                            groups[cat].push({ test, relevantSkill: skill });
                        }
                    }
                });
            }
        });
        return groups;
    }, [state.tests, state.skills, viewMode]);

    // --- Actions ---

    const handleOpenCreateModal = () => {
        setCreateTitle('');
        setCreateSkillIds([]);
        setTempCategory('');
        setTempSkillId('');
        setIsCreateModalOpen(true);
    };

    const addSkillToCreate = () => {
        if (tempSkillId && !createSkillIds.includes(tempSkillId)) {
            setCreateSkillIds([...createSkillIds, tempSkillId]);
            setTempSkillId('');
            setTempCategory('');
        }
    };

    const removeSkillFromCreate = (id: string) => {
        setCreateSkillIds(createSkillIds.filter(sid => sid !== id));
    };

    const submitCreateTest = () => {
        if (!createTitle || createSkillIds.length === 0) {
            alert("Proszę podać nazwę testu i wybrać przynajmniej jedną umiejętność.");
            return;
        }
        
        addTest({
            title: createTitle,
            skill_ids: createSkillIds,
            questions: [],
            time_limit_minutes: 30,
            is_active: true,
            is_archived: false
        });
        setIsCreateModalOpen(false);
    };

    const handleOpenTest = (test: Test) => {
        setSelectedTest(test);
        setIsTestDetailOpen(true);
        setIsEditingRate(false);
        setTempCategory('');
        setTempSkillId('');
        // For rate editing, we default to the first skill's rate if available
        if (test.skill_ids.length > 0) {
            const skill = state.skills.find(s => s.id === test.skill_ids[0]);
            setTempRate(skill?.hourly_bonus || 0);
        }
    };

    const handleAddSkillToTest = () => {
        if (selectedTest && tempSkillId && !selectedTest.skill_ids.includes(tempSkillId)) {
            const updatedIds = [...selectedTest.skill_ids, tempSkillId];
            updateTest(selectedTest.id, { skill_ids: updatedIds });
            setSelectedTest({ ...selectedTest, skill_ids: updatedIds });
            setTempSkillId('');
            setTempCategory('');
        }
    };

    const handleRemoveSkillFromTest = (skillId: string) => {
        if (selectedTest) {
            const updatedIds = selectedTest.skill_ids.filter(id => id !== skillId);
            updateTest(selectedTest.id, { skill_ids: updatedIds });
            setSelectedTest({ ...selectedTest, skill_ids: updatedIds });
        }
    };

    const handleEditTest = () => {
        setIsTestDetailOpen(false);
        setIsEditorOpen(true);
    };

    // Trigger Archive Confirmation
    const handleArchiveTestClick = () => {
        if (!selectedTest) return;
        setConfirmation({
            isOpen: true,
            title: "Archiwizacja Testu",
            message: "Czy na pewno chcesz zarchiwizować ten test? Zostanie on przeniesiony do archiwum i dezaktywowany.",
            actionLabel: "Archiwizuj",
            onConfirm: () => {
                if (selectedTest) {
                    updateTest(selectedTest.id, { is_archived: true, is_active: false });
                    setIsTestDetailOpen(false);
                    setSelectedTest(null);
                }
            }
        });
    };

    // Trigger Restore Confirmation
    const handleRestoreTestClick = (test: Test) => {
        setConfirmation({
            isOpen: true,
            title: "Przywracanie Testu",
            message: `Czy na pewno chcesz przywrócić test "${test.title}" z archiwum?`,
            actionLabel: "Przywróć",
            onConfirm: () => {
                updateTest(test.id, { is_archived: false });
            }
        });
    };

    const handleSaveEditor = () => {
        if (selectedTest) {
            // Recalc total time limit
            const totalSeconds = selectedTest.questions.reduce((acc, q) => acc + (q.timeLimit || 30), 0);
            const time_limit_minutes = Math.ceil(totalSeconds / 60) || 1;

            updateTest(selectedTest.id, { ...selectedTest, time_limit_minutes });
            setIsEditorOpen(false);
            setSelectedTest(null);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && selectedTest) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newQs = [...selectedTest.questions];
                if (newQs[currentQuestionIndex]) {
                    newQs[currentQuestionIndex].imageUrl = reader.result as string;
                    setSelectedTest({...selectedTest, questions: newQs});
                }
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {viewMode === 'active' ? 'Testy Kwalifikacyjne' : 'Archiwum Testów'}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {viewMode === 'active' ? 'Zarządzaj aktywnymi testami' : 'Przeglądaj usunięte testy'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {viewMode === 'active' ? (
                        <>
                            <Button variant="secondary" onClick={() => setViewMode('archived')}>
                                <Archive size={18} className="mr-2"/> Archiwum
                            </Button>
                            <Button onClick={handleOpenCreateModal}>
                                <Plus size={18} className="mr-2"/> Dodaj Nowy Test
                            </Button>
                        </>
                    ) : (
                        <Button variant="secondary" onClick={() => setViewMode('active')}>
                            <RotateCcw size={18} className="mr-2"/> Wróć do Testów
                        </Button>
                    )}
                </div>
            </div>

            {/* Test List */}
            <div className="space-y-4">
                {Object.keys(categorizedTests).length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400">
                        {viewMode === 'active' ? 'Brak aktywnych testów.' : 'Archiwum jest puste.'}
                    </div>
                )}

                {Object.keys(categorizedTests).map(cat => (
                    <div key={cat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <button 
                            className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors"
                            onClick={() => setActiveCategory(activeCategory === cat ? null : cat as SkillCategory)}
                        >
                            <span className="font-bold text-slate-800">{cat}</span>
                            <div className="flex items-center gap-3">
                                <span className="text-xs bg-white border px-2 py-1 rounded text-slate-500">{categorizedTests[cat].length} testów</span>
                                {activeCategory === cat ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                            </div>
                        </button>
                        
                        {activeCategory === cat && (
                            <div className="divide-y divide-slate-100">
                                {categorizedTests[cat].map(({ test, relevantSkill }) => {
                                    return (
                                        <div 
                                            key={`${cat}-${test.id}`} 
                                            className={`px-6 py-4 flex justify-between items-center transition-colors ${
                                                viewMode === 'active' ? 'cursor-pointer hover:bg-blue-50' : 'bg-slate-50 opacity-75'
                                            }`} 
                                            onClick={() => viewMode === 'active' && handleOpenTest(test)}
                                        >
                                            <div className={!test.is_active ? 'opacity-60' : ''}>
                                                <h3 className="font-medium text-slate-900 flex items-center gap-2">
                                                    {test.title}
                                                    {!test.is_active && <span className="text-xs border border-slate-400 text-slate-500 px-1.5 rounded">Nieaktywny</span>}
                                                </h3>
                                                <p className="text-xs text-slate-500">Dotyczy: {relevantSkill.name_pl}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className={`text-right ${!test.is_active ? 'opacity-60' : ''}`}>
                                                    <span className="block text-xs text-slate-400">Stawka Umiejętności</span>
                                                    <span className={`font-bold text-green-600 ${!test.is_active ? 'line-through text-slate-500' : ''}`}>
                                                        {relevantSkill.hourly_bonus} zł/h
                                                    </span>
                                                </div>
                                                {viewMode === 'active' ? (
                                                    <ChevronRight size={18} className="text-slate-300"/>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRestoreTestClick(test);
                                                        }}
                                                        className="p-2 hover:bg-blue-100 text-blue-600 rounded-full transition-colors group z-10 relative"
                                                        title="Przywróć test"
                                                    >
                                                        <RotateCcw size={20} className="transform group-hover:-rotate-90 transition-transform"/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* --- Modals --- */}

            {/* Test Detail Modal */}
            {isTestDetailOpen && selectedTest && viewMode === 'active' && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-xl font-bold pr-8">{selectedTest.title}</h2>
                            <button onClick={() => setIsTestDetailOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="mb-6">
                            <h3 className="text-sm font-bold text-slate-700 mb-2">Powiązane Umiejętności (Kategorie)</h3>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {selectedTest.skill_ids.map(sid => {
                                    const s = state.skills.find(sk => sk.id === sid);
                                    if(!s) return null;
                                    return (
                                        <div key={sid} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-blue-100">
                                            <span>{s.category}: {s.name_pl}</span>
                                            <button onClick={() => handleRemoveSkillFromTest(sid)} className="hover:text-red-500"><X size={14}/></button>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Add new skill to test */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <label className="block text-xs font-bold text-slate-500 mb-2">Dodaj kolejne powiązanie</label>
                                <div className="flex gap-2">
                                    <select 
                                        className="border p-1 rounded text-sm w-1/3"
                                        value={tempCategory}
                                        onChange={e => { setTempCategory(e.target.value as SkillCategory); setTempSkillId(''); }}
                                    >
                                        <option value="">Kategoria...</option>
                                        {Object.values(SkillCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select 
                                        className="border p-1 rounded text-sm flex-1"
                                        value={tempSkillId}
                                        disabled={!tempCategory}
                                        onChange={e => setTempSkillId(e.target.value)}
                                    >
                                        <option value="">Wybierz umiejętność...</option>
                                        {state.skills
                                            .filter(s => s.category === tempCategory)
                                            .filter(s => !selectedTest.skill_ids.includes(s.id))
                                            .map(s => <option key={s.id} value={s.id}>{s.name_pl}</option>)}
                                    </select>
                                    <Button size="sm" onClick={handleAddSkillToTest} disabled={!tempSkillId}>+</Button>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                             <div className="flex justify-between items-center mb-1">
                                 <span className="text-sm font-bold text-slate-700">Stawka (bonus za umiejętność)</span>
                                 <span className="text-xs text-slate-400">Zależna od wybranej umiejętności</span>
                             </div>
                             <div className="flex items-center gap-2">
                                 <span className="text-2xl font-bold text-green-600">
                                     {selectedTest.skill_ids.length > 0 
                                        ? state.skills.find(s => s.id === selectedTest.skill_ids[0])?.hourly_bonus + ' zł'
                                        : '0 zł'
                                     }
                                 </span>
                             </div>
                        </div>

                        <div className="space-y-3">
                            <Button fullWidth onClick={handleEditTest}>
                                <Edit size={18} className="mr-2"/> Redaguj Test (Pytania)
                            </Button>
                            <Button fullWidth variant="outline" onClick={() => {
                                updateTest(selectedTest.id, { is_active: !selectedTest.is_active });
                                setIsTestDetailOpen(false);
                            }}>
                                {selectedTest.is_active ? 'Dezaktywuj Test' : 'Aktywuj Test'}
                            </Button>
                            <Button fullWidth variant="danger" onClick={handleArchiveTestClick}>
                                <Archive size={18} className="mr-2"/> Archiwizuj Test
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Dodaj Nowy Test</h2>
                            <button onClick={() => setIsCreateModalOpen(false)}><X size={24} className="text-slate-400"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nazwa Testu</label>
                                <input className="w-full border p-2 rounded" placeholder="np. Test wiedzy: Instalacje" value={createTitle} onChange={e => setCreateTitle(e.target.value)} />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Powiązane Umiejętności</label>
                                
                                <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] border border-dashed border-slate-300 rounded p-2 bg-slate-50">
                                    {createSkillIds.map(sid => {
                                        const s = state.skills.find(sk => sk.id === sid);
                                        return (
                                            <div key={sid} className="bg-white border border-slate-200 shadow-sm px-2 py-1 rounded text-xs flex items-center gap-2">
                                                <span>{s?.name_pl}</span>
                                                <button onClick={() => removeSkillFromCreate(sid)} className="text-red-500 hover:bg-red-50 rounded"><X size={14}/></button>
                                            </div>
                                        )
                                    })}
                                    {createSkillIds.length === 0 && <span className="text-xs text-slate-400 italic self-center">Brak wybranych umiejętności</span>}
                                </div>

                                <div className="flex gap-2">
                                    <select className="w-1/3 border p-2 rounded bg-white text-sm" value={tempCategory} onChange={e => {
                                        setTempCategory(e.target.value as SkillCategory);
                                        setTempSkillId('');
                                    }}>
                                        <option value="">Kategoria...</option>
                                        {Object.values(SkillCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                    
                                    <select className="flex-1 border p-2 rounded bg-white text-sm disabled:bg-slate-50 disabled:text-slate-400" value={tempSkillId} disabled={!tempCategory} onChange={e => setTempSkillId(e.target.value)}>
                                        <option value="">Wybierz umiejętność...</option>
                                        {state.skills.filter(s => s.category === tempCategory).filter(s => !createSkillIds.includes(s.id)).map(skill => <option key={skill.id} value={skill.id}>{skill.name_pl}</option>)}
                                    </select>
                                    
                                    <Button onClick={addSkillToCreate} disabled={!tempSkillId}>+</Button>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Anuluj</Button>
                            <Button onClick={submitCreateTest} disabled={!createTitle || createSkillIds.length === 0}>Utwórz Test</Button>
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

            {/* Test Editor */}
            {isEditorOpen && selectedTest && (
                 <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col">
                     <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                         <div>
                             <h2 className="font-bold text-lg">Redaktor Testu: {selectedTest.title}</h2>
                             {(() => {
                                const totalSeconds = selectedTest.questions.reduce((acc, q) => acc + (q.timeLimit || 30), 0);
                                const mins = Math.floor(totalSeconds / 60);
                                const secs = totalSeconds % 60;
                                return (
                                    <p className="text-xs text-slate-500">
                                        {selectedTest.questions.length} pytań • Czas łączny: {mins}m {secs}s (ok. {Math.ceil(totalSeconds/60)} min)
                                    </p>
                                );
                             })()}
                         </div>
                         <div className="flex gap-2">
                             <Button variant="ghost" onClick={() => setIsEditorOpen(false)}>Anuluj</Button>
                             <Button onClick={handleSaveEditor}>Zapisz Zmiany</Button>
                         </div>
                     </div>
                     <div className="flex flex-1 overflow-hidden">
                         <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto p-4">
                             <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase">Mapa Pytań</h3>
                             <div className="space-y-2">
                                 {selectedTest.questions.map((q, idx) => (
                                     <button 
                                        key={q.id}
                                        onClick={() => setCurrentQuestionIndex(idx)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${
                                            currentQuestionIndex === idx ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                     >
                                         {idx + 1}. {q.text || '(Puste pytanie)'}
                                     </button>
                                 ))}
                                 <Button 
                                    fullWidth variant="outline" size="sm" className="mt-4 border-dashed"
                                    onClick={() => {
                                        const newQ: Question = { 
                                            id: `q_${Date.now()}`, 
                                            text: 'Nowe pytanie', 
                                            options: ['Odp A', 'Odp B'], 
                                            correctOptionIndices: [0],
                                            gradingStrategy: GradingStrategy.ALL_CORRECT,
                                            timeLimit: 30
                                        };
                                        setSelectedTest({...selectedTest, questions: [...selectedTest.questions, newQ]});
                                        setCurrentQuestionIndex(selectedTest.questions.length);
                                    }}
                                 >
                                     <Plus size={16} className="mr-2"/> Dodaj Pytanie
                                 </Button>
                             </div>
                         </div>
                         <div className="flex-1 p-8 overflow-y-auto">
                             {selectedTest.questions[currentQuestionIndex] ? (
                                 <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                                     <div className="flex justify-between items-center mb-6">
                                         <h3 className="text-xl font-bold text-slate-800">Pytanie {currentQuestionIndex + 1}</h3>
                                         
                                         <div className="flex items-center gap-4">
                                             <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200" title="Czas na odpowiedź">
                                                 <Clock size={16} className="text-slate-400"/>
                                                 <input 
                                                     type="number" 
                                                     className="w-12 bg-transparent text-sm font-bold text-slate-700 text-center focus:outline-none"
                                                     min="5"
                                                     step="5"
                                                     value={selectedTest.questions[currentQuestionIndex].timeLimit || 30}
                                                     onChange={(e) => {
                                                         const val = parseInt(e.target.value) || 0;
                                                         const newQs = [...selectedTest.questions];
                                                         newQs[currentQuestionIndex].timeLimit = val;
                                                         setSelectedTest({...selectedTest, questions: newQs});
                                                     }}
                                                 />
                                                 <span className="text-xs text-slate-400 font-medium">sek</span>
                                             </div>

                                             <button 
                                                className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                                                onClick={() => {
                                                    const newQs = selectedTest.questions.filter((_, i) => i !== currentQuestionIndex);
                                                    setSelectedTest({...selectedTest, questions: newQs});
                                                    if (currentQuestionIndex >= newQs.length) setCurrentQuestionIndex(Math.max(0, newQs.length - 1));
                                                }}
                                             >
                                                 <Trash2 size={20}/>
                                             </button>
                                         </div>
                                     </div>
                                     <div className="mb-6 flex justify-center">
                                         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                         {selectedTest.questions[currentQuestionIndex].imageUrl ? (
                                             <div className="relative group w-full flex justify-center bg-slate-50 rounded-lg p-4 border border-dashed border-slate-300">
                                                 <img src={selectedTest.questions[currentQuestionIndex].imageUrl} alt="Pytanie" className="max-h-64 object-contain rounded" />
                                                 <div className="absolute top-2 right-2 flex gap-2">
                                                      <button className="bg-white p-2 rounded-full shadow hover:bg-slate-100 text-slate-700" onClick={() => fileInputRef.current?.click()}><Edit size={16}/></button>
                                                      <button className="bg-white p-2 rounded-full shadow hover:bg-red-50 text-red-500" onClick={() => {
                                                            const newQs = [...selectedTest.questions];
                                                            newQs[currentQuestionIndex].imageUrl = undefined;
                                                            setSelectedTest({...selectedTest, questions: newQs});
                                                        }}><Trash2 size={16}/></button>
                                                 </div>
                                             </div>
                                         ) : (
                                             <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                                                 <ImageIcon size={16} className="mr-2"/> Dodaj Obraz
                                             </Button>
                                         )}
                                     </div>
                                     <div className="mb-6">
                                         <label className="block text-sm font-bold text-slate-700 mb-2">Treść Pytania</label>
                                         <textarea 
                                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            rows={3}
                                            value={selectedTest.questions[currentQuestionIndex].text}
                                            onChange={(e) => {
                                                const newQs = [...selectedTest.questions];
                                                newQs[currentQuestionIndex].text = e.target.value;
                                                setSelectedTest({...selectedTest, questions: newQs});
                                            }}
                                         />
                                     </div>
                                     <div>
                                         <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-slate-700">Warianty Odpowiedzi</label>
                                            <span className="text-xs text-slate-500">Zaznacz wszystkie poprawne (Checkbox)</span>
                                         </div>
                                         {selectedTest.questions[currentQuestionIndex].correctOptionIndices.length > 1 && (
                                             <div className="mb-3 bg-blue-50 text-blue-700 px-3 py-2 rounded text-xs font-medium flex items-start gap-2">
                                                 <span>ℹ️</span>
                                                 <span>Uczestnik zobaczy informację o wielu poprawnych odpowiedziach.</span>
                                             </div>
                                         )}
                                         <div className="space-y-3">
                                             {selectedTest.questions[currentQuestionIndex].options.map((opt, optIdx) => {
                                                 const isChecked = selectedTest.questions[currentQuestionIndex].correctOptionIndices.includes(optIdx);
                                                 return (
                                                     <div key={optIdx} className="flex items-center gap-3">
                                                         <input 
                                                            type="checkbox" 
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                const newQs = [...selectedTest.questions];
                                                                const currentIndices = newQs[currentQuestionIndex].correctOptionIndices;
                                                                if (isChecked) {
                                                                    newQs[currentQuestionIndex].correctOptionIndices = currentIndices.filter(i => i !== optIdx);
                                                                } else {
                                                                    newQs[currentQuestionIndex].correctOptionIndices = [...currentIndices, optIdx];
                                                                }
                                                                setSelectedTest({...selectedTest, questions: newQs});
                                                            }}
                                                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                         />
                                                         <input 
                                                            type="text"
                                                            className="flex-1 border border-slate-300 rounded-lg p-2 text-sm"
                                                            value={opt}
                                                            onChange={(e) => {
                                                                const newQs = [...selectedTest.questions];
                                                                newQs[currentQuestionIndex].options[optIdx] = e.target.value;
                                                                setSelectedTest({...selectedTest, questions: newQs});
                                                            }}
                                                         />
                                                         <button className="text-slate-400 hover:text-red-500" onClick={() => {
                                                                const newQs = [...selectedTest.questions];
                                                                newQs[currentQuestionIndex].options = newQs[currentQuestionIndex].options.filter((_, i) => i !== optIdx);
                                                                newQs[currentQuestionIndex].correctOptionIndices = newQs[currentQuestionIndex].correctOptionIndices.filter(i => i !== optIdx).map(i => i > optIdx ? i - 1 : i);
                                                                setSelectedTest({...selectedTest, questions: newQs});
                                                            }}><X size={18}/></button>
                                                     </div>
                                                 );
                                             })}
                                             <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => {
                                                    const newQs = [...selectedTest.questions];
                                                    newQs[currentQuestionIndex].options.push(`Opcja ${newQs[currentQuestionIndex].options.length + 1}`);
                                                    setSelectedTest({...selectedTest, questions: newQs});
                                                }}>+ Dodaj odpowiedź</Button>
                                         </div>
                                         {selectedTest.questions[currentQuestionIndex].correctOptionIndices.length > 1 && (
                                             <div className="mt-6 pt-4 border-t border-slate-100">
                                                 <label className="block text-sm font-bold text-slate-700 mb-2">Kryterium Zaliczania (dla wielu odpowiedzi)</label>
                                                 <select className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white" value={selectedTest.questions[currentQuestionIndex].gradingStrategy || GradingStrategy.ALL_CORRECT} onChange={(e) => {
                                                        const newQs = [...selectedTest.questions];
                                                        newQs[currentQuestionIndex].gradingStrategy = e.target.value as GradingStrategy;
                                                        setSelectedTest({...selectedTest, questions: newQs});
                                                    }}>
                                                     <option value={GradingStrategy.ALL_CORRECT}>Wymagane wszystkie zaznaczone poprawne (100% poprawności)</option>
                                                     <option value={GradingStrategy.MIN_2_CORRECT}>Wymagane minimum 2 poprawne trafienia</option>
                                                     <option value={GradingStrategy.ANY_CORRECT}>Wystarczy jedna z poprawnych odpowiedzi</option>
                                                 </select>
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             ) : (
                                 <div className="flex items-center justify-center h-full text-slate-400">Wybierz pytanie z listy lub dodaj nowe.</div>
                             )}
                         </div>
                     </div>
                 </div>
            )}
        </div>
    );
};
