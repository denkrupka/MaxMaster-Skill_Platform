
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, ChevronUp, ChevronDown, ChevronRight, Edit, Trash2, X, Archive, RotateCcw, Image as ImageIcon, AlertTriangle, Clock, Layers, Award, Target, Sparkles, FilePlus, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Test, SkillCategory, Question, GradingStrategy, Skill } from '../../types';
import * as XLSX from 'xlsx';

export const HRTestsPage = () => {
    const { state, addTest, updateTest, updateSkill, addSkill } = useAppContext();
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
    const [createQuestionsToDisplay, setCreateQuestionsToDisplay] = useState<number | undefined>(undefined);

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

    // Import Modal State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFiles, setImportFiles] = useState<File[]>([]);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // Group tests by category.
    const categorizedTests = useMemo(() => {
        const groups: Record<string, {test: Test, relevantSkill: Skill}[]> = {};
        
        const testsToProcess = state.tests.filter(t => viewMode === 'archived' ? t.is_archived : !t.is_archived);

        testsToProcess.forEach(test => {
            const skillIds = test.skill_ids || [];
            if (skillIds.length === 0) {
                 const cat = SkillCategory.INNE;
                 if (!groups[cat]) groups[cat] = [];
                 groups[cat].push({ test, relevantSkill: { name_pl: 'Brak powiązania', hourly_bonus: 0 } as Skill });
            } else {
                skillIds.forEach(skillId => {
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
            is_archived: false,
            questions_to_display: createQuestionsToDisplay
        });
        setIsCreateModalOpen(false);
        setCreateTitle('');
        setCreateSkillIds([]);
        setCreateQuestionsToDisplay(undefined);
    };

    const handleOpenTest = (test: Test) => {
        setSelectedTest(test);
        setIsTestDetailOpen(true);
        setIsEditingRate(false);
        setTempCategory('');
        setTempSkillId('');
    };

    const handleAddSkillToTest = () => {
        if (selectedTest && tempSkillId) {
            const currentIds = selectedTest.skill_ids || [];
            if (!currentIds.includes(tempSkillId)) {
                const updatedIds = [...currentIds, tempSkillId];
                updateTest(selectedTest.id, { skill_ids: updatedIds });
                setSelectedTest({ ...selectedTest, skill_ids: updatedIds });
                setTempSkillId('');
                setTempCategory('');
            }
        }
    };

    const handleRemoveSkillFromTest = (skillId: string) => {
        if (selectedTest && selectedTest.skill_ids) {
            const updatedIds = selectedTest.skill_ids.filter(id => id !== skillId);
            updateTest(selectedTest.id, { skill_ids: updatedIds });
            setSelectedTest({ ...selectedTest, skill_ids: updatedIds });
        }
    };

    const handleEditTest = () => {
        setIsTestDetailOpen(false);
        setIsEditorOpen(true);
    };

    const handleArchiveTestClick = () => {
        if (!selectedTest) return;
        setConfirmation({
            isOpen: true,
            title: "Archiwizacja Testu",
            message: "Czy na pewno chcesz zarchiwizować ten test?",
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

    const handleRestoreTestClick = (test: Test) => {
        setConfirmation({
            isOpen: true,
            title: "Przywracanie Testu",
            message: `Czy na pewno chcesz przywrócić test "${test.title}"?`,
            actionLabel: "Przywróć",
            onConfirm: () => {
                updateTest(test.id, { is_archived: false });
            }
        });
    };

    const handleSaveEditor = () => {
        if (selectedTest) {
            const questions = selectedTest.questions || [];
            const totalSeconds = questions.reduce((acc, q) => acc + (q.timeLimit || 30), 0);
            const time_limit_minutes = Math.ceil(totalSeconds / 60) || 1;

            updateTest(selectedTest.id, { ...selectedTest, time_limit_minutes, questions });
            setIsEditorOpen(false);
            setSelectedTest(null);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && selectedTest) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newQs = [...(selectedTest.questions || [])];
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

    // Import Functions
    const generateExcelTemplate = () => {
        // Get all categories and skills for the template
        const categories = state.systemConfig?.skillCategories || [];
        const skillsList = state.skills.map(s => `${s.name_pl} (${s.category})`).join('\n');

        const templateData = [
            ['INSTRUKCJA:', 'Wypełnij poniższe pola według szablonu. Nie usuwaj nagłówków!'],
            [],
            ['NAZWA TESTU', 'np. Test wiedzy: Instalacje elektryczne'],
            ['KATEGORIA UMIEJĘTNOŚCI', categories.join(' LUB ')],
            ['NAZWA UMIEJĘTNOŚCI', 'Wpisz istniejącą lub nową (jeśli nowa, wypełnij pola poniżej)'],
            ['STAWKA ZŁ/H (dla nowej umiejętności)', 'np. 5'],
            ['WYMAGANY % ZALICZENIA (dla nowej)', 'np. 80'],
            ['LICZBA PYTAŃ DO WYŚWIETLENIA', 'Pozostaw puste = wszystkie pytania, lub np. 20'],
            [],
            ['ISTNIEJĄCE UMIEJĘTNOŚCI W SYSTEMIE:'],
            [skillsList],
            [],
            ['PYTANIA - zaczynaj od wiersza poniżej:', '', '', '', '', '', ''],
            ['Nr', 'Treść pytania', 'Czas (sekundy)', 'Opcja A', 'Opcja B', 'Opcja C', 'Opcja D', 'Opcja E', 'Poprawne odpowiedzi (np. A,C)', 'Kryterium (ALL_CORRECT/ANY_CORRECT/MIN_2_CORRECT)', 'URL obrazu (opcjonalnie)'],
            ['1', 'Przykładowe pytanie testowe?', '30', 'Odpowiedź A', 'Odpowiedź B', 'Odpowiedź C', 'Odpowiedź D', '', 'A,C', 'ALL_CORRECT', ''],
            ['2', 'Kolejne pytanie...', '45', 'Tak', 'Nie', '', '', '', 'A', 'ALL_CORRECT', ''],
        ];

        const ws = XLSX.utils.aoa_to_sheet(templateData);

        // Set column widths
        ws['!cols'] = [
            { wch: 5 },   // Nr
            { wch: 50 },  // Treść pytania
            { wch: 15 },  // Czas
            { wch: 20 },  // Opcja A
            { wch: 20 },  // Opcja B
            { wch: 20 },  // Opcja C
            { wch: 20 },  // Opcja D
            { wch: 20 },  // Opcja E
            { wch: 25 },  // Poprawne
            { wch: 30 },  // Kryterium
            { wch: 30 },  // URL obrazu
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Szablon Testu');
        XLSX.writeFile(wb, 'szablon_testu.xlsx');
    };

    const handleImportFiles = async () => {
        if (importFiles.length === 0) {
            alert('Wybierz przynajmniej jeden plik do importu');
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const file of importFiles) {
            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                // Parse test metadata
                const testName = jsonData[2]?.[1] || '';
                const categoryName = jsonData[3]?.[1] || '';
                const skillName = jsonData[4]?.[1] || '';
                const hourlyBonus = parseFloat(jsonData[5]?.[1] || '0');
                const requiredPassRate = parseFloat(jsonData[6]?.[1] || '80');
                const questionsToDisplay = jsonData[7]?.[1] ? parseInt(jsonData[7]?.[1]) : undefined;

                if (!testName || !categoryName || !skillName) {
                    errors.push(`${file.name}: Brak wymaganych danych (nazwa, kategoria lub umiejętność)`);
                    errorCount++;
                    continue;
                }

                // Find or create skill
                let skill = state.skills.find(s => s.name_pl.toLowerCase() === skillName.toLowerCase());

                if (!skill) {
                    // Create new skill automatically
                    try {
                        const newSkill: Omit<Skill, 'id'> = {
                            name: skillName,
                            name_pl: skillName,
                            category: categoryName as SkillCategory,
                            description_pl: `Automatycznie utworzona z importu: ${skillName}`,
                            verification_type: 'theory_practice' as any,
                            hourly_bonus: hourlyBonus || 0,
                            required_pass_rate: requiredPassRate || 80,
                            is_active: true,
                            is_archived: false
                        };

                        // Use the returned skill directly instead of searching state
                        skill = await addSkill(newSkill);
                    } catch (err) {
                        console.error(`Error creating skill:`, err);
                        errors.push(`${file.name}: Błąd podczas tworzenia umiejętności "${skillName}"`);
                        errorCount++;
                        continue;
                    }
                }

                // Parse questions (starting from row 13, index 13 in 0-based)
                const questions: Question[] = [];
                const questionErrors: string[] = [];

                for (let i = 14; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || !row[1]) continue; // Skip empty rows

                    const questionText = row[1];
                    const timeLimit = parseInt(row[2]) || 30;
                    const options = [row[3], row[4], row[5], row[6], row[7]].filter(Boolean);
                    const correctAnswersStr = row[8] || '';
                    const gradingStrategy = (row[9] || 'ALL_CORRECT') as GradingStrategy;
                    const imageUrl = row[10] || undefined;

                    // Validate minimum 2 options
                    if (options.length < 2) {
                        questionErrors.push(`Pytanie ${i - 13}: minimum 2 opcje odpowiedzi są wymagane (znaleziono: ${options.length})`);
                        continue;
                    }

                    // Parse correct answers (e.g., "A,C" -> [0, 2])
                    const correctOptionIndices: number[] = [];
                    if (correctAnswersStr) {
                        const letters = correctAnswersStr.split(',').map((s: string) => s.trim().toUpperCase());
                        letters.forEach((letter: string) => {
                            const index = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
                            if (index >= 0 && index < options.length) {
                                correctOptionIndices.push(index);
                            }
                        });
                    }

                    if (correctOptionIndices.length === 0) {
                        correctOptionIndices.push(0); // Default to first option
                    }

                    questions.push({
                        id: `q_${Date.now()}_${i}`,
                        text: questionText,
                        options,
                        correctOptionIndices,
                        gradingStrategy,
                        timeLimit,
                        imageUrl
                    });
                }

                // Check for question errors
                if (questionErrors.length > 0) {
                    errors.push(`${file.name}:\n  ${questionErrors.join('\n  ')}`);
                    errorCount++;
                    continue;
                }

                if (questions.length === 0) {
                    errors.push(`${file.name}: Brak pytań w pliku`);
                    errorCount++;
                    continue;
                }

                // Calculate total time
                const totalSeconds = questions.reduce((acc, q) => acc + (q.timeLimit || 30), 0);
                const timeLimitMinutes = Math.ceil(totalSeconds / 60);

                // Create test
                addTest({
                    title: testName,
                    skill_ids: [skill.id],
                    questions,
                    time_limit_minutes: timeLimitMinutes,
                    is_active: true,
                    is_archived: false,
                    questions_to_display: questionsToDisplay
                });

                successCount++;
            } catch (error) {
                console.error(`Error importing ${file.name}:`, error);
                errors.push(`${file.name}: Błąd podczas przetwarzania pliku`);
                errorCount++;
            }
        }

        // Show results
        let message = `Zaimportowano: ${successCount} testów`;
        if (errorCount > 0) {
            message += `\nBłędy: ${errorCount}\n\n${errors.join('\n')}`;
        }
        alert(message);

        // Close modal and reset
        setIsImportModalOpen(false);
        setImportFiles([]);
        if (importFileInputRef.current) importFileInputRef.current.value = '';
    };

    const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setImportFiles(files);
    };

    return (
        <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                        {viewMode === 'active' ? 'Testy Kwalifikacyjne' : 'Archiwum Testów'}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500">
                        {viewMode === 'active' ? 'Zarządzaj aktywnymi testami' : 'Przeglądaj usunięte testy'}
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {viewMode === 'active' ? (
                        <>
                            <Button variant="secondary" onClick={() => setViewMode('archived')} className="flex-1 sm:flex-none">
                                <Archive size={18} className="mr-1 sm:mr-2"/> <span className="hidden sm:inline">Archiwum</span><span className="sm:hidden">Arch.</span>
                            </Button>
                            <Button onClick={handleOpenCreateModal} className="flex-1 sm:flex-none">
                                <Plus size={18} className="mr-1 sm:mr-2"/> <span className="hidden sm:inline">Dodaj Nowy Test</span><span className="sm:hidden">Dodaj</span>
                            </Button>
                        </>
                    ) : (
                        <Button variant="secondary" onClick={() => setViewMode('active')} className="w-full sm:w-auto">
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

            {/* REDESIGNED COMPACT Test Detail Modal */}
            {isTestDetailOpen && selectedTest && viewMode === 'active' && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
                        {/* Modal Header - Dark & Professional */}
                        <div className="bg-[#1A1C1E] px-6 py-4 flex justify-between items-center text-white">
                            <div>
                                <h2 className="text-lg font-black tracking-tight leading-tight">{selectedTest.title}</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Zarządzanie testem</p>
                            </div>
                            <button 
                                onClick={() => setIsTestDetailOpen(false)} 
                                className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-full transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-5 space-y-4">
                            {/* Skills Section */}
                            <div>
                                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <Layers size={12}/> Powiązane Umiejętności
                                </h3>
                                <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
                                    {(selectedTest.skill_ids || []).map(sid => {
                                        const s = state.skills.find(sk => sk.id === sid);
                                        if(!s) return null;
                                        return (
                                            <div 
                                                key={sid} 
                                                className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5 border border-blue-100 shadow-sm"
                                            >
                                                <span>{s.category}: {s.name_pl}</span>
                                                <button 
                                                    onClick={() => handleRemoveSkillFromTest(sid)} 
                                                    className="p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                                                >
                                                    <X size={10}/>
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Compact Form for adding skills */}
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                                    <div className="flex gap-2">
                                        <select
                                            className="bg-white px-2 py-2 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm flex-1 border border-slate-200"
                                            value={tempCategory}
                                            onChange={e => { setTempCategory(e.target.value as SkillCategory); setTempSkillId(''); }}
                                        >
                                            <option value="">Kategoria...</option>
                                            {(state.systemConfig?.skillCategories || []).map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <select 
                                            className="bg-white px-2 py-2 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm flex-[1.5] border border-slate-200 disabled:opacity-50"
                                            value={tempSkillId}
                                            disabled={!tempCategory}
                                            onChange={e => setTempSkillId(e.target.value)}
                                        >
                                            <option value="">Wybierz umiejętność...</option>
                                            {state.skills
                                                .filter(s => s.category === tempCategory)
                                                .filter(s => !(selectedTest.skill_ids || []).includes(s.id))
                                                .map(s => <option key={s.id} value={s.id}>{s.name_pl}</option>)}
                                        </select>
                                        <Button 
                                            size="sm" 
                                            onClick={handleAddSkillToTest} 
                                            disabled={!tempSkillId}
                                            className="rounded-xl h-9 w-9 px-0"
                                        >
                                            <Plus size={18}/>
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* COMPACT Summed Rate Section */}
                            <div className="bg-[#1A1C1E] rounded-2xl p-4 text-white relative overflow-hidden shadow-lg border border-slate-800">
                                <div className="absolute top-0 right-0 p-4 opacity-5"><Award size={60} /></div>
                                <div className="relative z-10 flex justify-between items-center">
                                    <div>
                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-0.5">Stawka Sumaryczna</span>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-3xl font-black text-green-400">
                                                {(() => {
                                                    const sum = (selectedTest.skill_ids || []).reduce((acc, sid) => {
                                                        const s = state.skills.find(sk => sk.id === sid);
                                                        return acc + (s?.hourly_bonus || 0);
                                                    }, 0);
                                                    return sum;
                                                })()}
                                            </span>
                                            <span className="text-base font-bold text-green-400/60">zł/h</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 font-medium leading-tight max-w-[120px]">
                                            Bonus doliczany do bazy po zaliczeniu testu.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer / Actions - Slimmer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                            <Button fullWidth onClick={handleEditTest} className="h-10 rounded-xl shadow-lg shadow-blue-600/10 font-black uppercase text-[10px] tracking-widest">
                                <Edit size={16} className="mr-2"/> Redaguj Pytania
                            </Button>
                            
                            <div className="flex gap-2">
                                <Button 
                                    fullWidth 
                                    variant="outline" 
                                    className="h-9 rounded-xl font-bold border-slate-200 text-slate-600 bg-white hover:bg-slate-50 text-[10px] uppercase"
                                    onClick={() => {
                                        updateTest(selectedTest.id, { is_active: !selectedTest.is_active });
                                        setIsTestDetailOpen(false);
                                    }}
                                >
                                    {selectedTest.is_active ? 'Dezaktywuj' : 'Aktywuj'}
                                </Button>
                                <Button 
                                    fullWidth 
                                    variant="danger" 
                                    className="h-9 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-[10px] uppercase"
                                    onClick={handleArchiveTestClick}
                                >
                                    <Archive size={16} className="mr-1.5"/> Archiwizuj
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* COMPACT CREATE MODAL - Styled like Detail Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
                        {/* Header - Dark & Professional */}
                        <div className="bg-[#1A1C1E] px-6 py-4 flex justify-between items-center text-white">
                            <div>
                                <h2 className="text-lg font-black tracking-tight leading-tight">Nowy Test</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tworzenie weryfikacji</p>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-full transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">NAZWA TESTU</label>
                                <input 
                                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner" 
                                    placeholder="np. Test wiedzy: Instalacje elektryczne" 
                                    value={createTitle} 
                                    onChange={e => setCreateTitle(e.target.value)} 
                                />
                            </div>
                            
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">POWIĄZANE UMIEJĘTNOŚCI</label>
                                
                                <div className="flex flex-wrap gap-1.5 mb-3 min-h-[40px] border border-dashed border-slate-300 rounded-2xl p-2.5 bg-slate-50 shadow-inner">
                                    {createSkillIds.map(sid => {
                                        const s = state.skills.find(sk => sk.id === sid);
                                        return (
                                            <div key={sid} className="bg-white border border-slate-200 shadow-sm px-2 py-1 rounded-lg text-[10px] font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-tighter">
                                                <span>{s?.name_pl}</span>
                                                <button onClick={() => removeSkillFromCreate(sid)} className="text-red-400 hover:text-red-600 transition-colors"><X size={12}/></button>
                                            </div>
                                        )
                                    })}
                                    {createSkillIds.length === 0 && <span className="text-[10px] text-slate-400 italic self-center ml-2">Nie wybrano jeszcze umiejętności</span>}
                                </div>

                                <div className="flex gap-2">
                                    <select
                                        className="w-1/3 bg-white border border-slate-200 p-2 rounded-xl text-[11px] font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={tempCategory}
                                        onChange={e => { setTempCategory(e.target.value as SkillCategory); setTempSkillId(''); }}
                                    >
                                        <option value="">Kategoria...</option>
                                        {(state.systemConfig?.skillCategories || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                    
                                    <select 
                                        className="flex-1 bg-white border border-slate-200 p-2 rounded-xl text-[11px] font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" 
                                        value={tempSkillId} 
                                        disabled={!tempCategory} 
                                        onChange={e => setTempSkillId(e.target.value)}
                                    >
                                        <option value="">Wybierz umiejętność...</option>
                                        {state.skills.filter(s => s.category === tempCategory).filter(s => !createSkillIds.includes(s.id)).map(skill => <option key={skill.id} value={skill.id}>{skill.name_pl}</option>)}
                                    </select>
                                    
                                    <Button onClick={addSkillToCreate} disabled={!tempSkillId} className="h-9 w-9 p-0 rounded-xl">
                                        <Plus size={18}/>
                                    </Button>
                                </div>
                            </div>

                            {/* Questions to Display Field */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">
                                    Liczba Pytań Do Wyświetlenia (opcjonalne)
                                </label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                                    placeholder="Pozostaw puste = wszystkie pytania"
                                    min="1"
                                    value={createQuestionsToDisplay || ''}
                                    onChange={e => setCreateQuestionsToDisplay(e.target.value ? parseInt(e.target.value) : undefined)}
                                />
                                <p className="text-[9px] text-slate-500 mt-1.5 ml-1">
                                    Jeśli ustawisz np. 20, system losowo wybierze 20 pytań z całej puli przy każdym teście. Pytania będą zawsze w losowej kolejności.
                                </p>
                            </div>

                            {/* COMPACT Summed Rate Prediction Card (Create Modal) */}
                            <div className="bg-[#1A1C1E] rounded-2xl p-4 text-white relative overflow-hidden shadow-lg border border-slate-800">
                                <div className="absolute top-0 right-0 p-4 opacity-5"><Award size={60} /></div>
                                <div className="relative z-10 flex justify-between items-center">
                                    <div>
                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-0.5">Prognozowana Stawka</span>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-3xl font-black text-green-400">
                                                {(() => {
                                                    const sum = createSkillIds.reduce((acc, sid) => {
                                                        const s = state.skills.find(sk => sk.id === sid);
                                                        return acc + (s?.hourly_bonus || 0);
                                                    }, 0);
                                                    return sum;
                                                })()}
                                            </span>
                                            <span className="text-base font-bold text-green-400/60">zł/h</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 font-medium leading-tight max-w-[120px]">
                                            Suma bonusów za wybrane powyżej umiejętności.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsCreateModalOpen(false);
                                    setIsImportModalOpen(true);
                                }}
                                className="h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest"
                            >
                                <FileSpreadsheet size={16} className="mr-2"/> Import Testów
                            </Button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    Anuluj
                                </button>
                                <Button
                                    onClick={submitCreateTest}
                                    disabled={!createTitle || createSkillIds.length === 0}
                                    className="h-10 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/10"
                                >
                                    <Sparkles size={16} className="mr-2"/> Utwórz Test
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmation.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
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

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
                        {/* Header */}
                        <div className="bg-[#1A1C1E] px-6 py-4 flex justify-between items-center text-white">
                            <div>
                                <h2 className="text-lg font-black tracking-tight leading-tight">Import Testów</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Masowe dodawanie testów z plików Excel</p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportFiles([]);
                                }}
                                className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-full transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Instructions */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={16} />
                                    Jak przeprowadzić import?
                                </h3>
                                <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside">
                                    <li>Pobierz szablon Excel klikając "Pobierz szablon"</li>
                                    <li>Wypełnij szablon danymi testowymi (1 test = 1 plik)</li>
                                    <li>Upewnij się, że nazwy umiejętności są identyczne z istniejącymi</li>
                                    <li>Możesz wgrać wiele plików jednocześnie</li>
                                    <li>Kliknij "Wgraj plik" i wybierz pliki do importu</li>
                                </ol>
                            </div>

                            {/* Download Template Button */}
                            <div className="space-y-3">
                                <Button
                                    fullWidth
                                    variant="outline"
                                    onClick={generateExcelTemplate}
                                    className="h-12 rounded-xl font-bold text-sm border-2 border-green-500 text-green-700 hover:bg-green-50"
                                >
                                    <Download size={18} className="mr-2" />
                                    Pobierz szablon Excel
                                </Button>

                                {/* Upload Files Button */}
                                <div>
                                    <input
                                        type="file"
                                        ref={importFileInputRef}
                                        className="hidden"
                                        accept=".xlsx,.xls"
                                        multiple
                                        onChange={handleImportFileSelect}
                                    />
                                    <Button
                                        fullWidth
                                        variant="outline"
                                        onClick={() => importFileInputRef.current?.click()}
                                        className="h-12 rounded-xl font-bold text-sm border-2 border-blue-500 text-blue-700 hover:bg-blue-50"
                                    >
                                        <Upload size={18} className="mr-2" />
                                        Wybierz pliki do importu
                                    </Button>
                                </div>

                                {/* Selected Files List */}
                                {importFiles.length > 0 && (
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                                            Wybrane pliki ({importFiles.length}):
                                        </h4>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {importFiles.map((file, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100">
                                                    <FileSpreadsheet size={14} className="text-green-600" />
                                                    <span className="flex-1 truncate">{file.name}</span>
                                                    <button
                                                        onClick={() => setImportFiles(importFiles.filter((_, i) => i !== idx))}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Import Button */}
                                {importFiles.length > 0 && (
                                    <Button
                                        fullWidth
                                        onClick={handleImportFiles}
                                        className="h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/10"
                                    >
                                        <Sparkles size={16} className="mr-2" />
                                        Importuj {importFiles.length} {importFiles.length === 1 ? 'test' : 'testów'}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportFiles([]);
                                }}
                                className="px-5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Zamknij
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Test Editor */}
            {isEditorOpen && selectedTest && (
                 <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col">
                     <div className="bg-white border-b border-slate-200 px-6 py-4">
                         <div className="flex justify-between items-start mb-3">
                             <div>
                                 <h2 className="font-bold text-lg">Redaktor Testu: {selectedTest.title}</h2>
                                 {(() => {
                                    const questions = selectedTest.questions || [];
                                    const totalSeconds = questions.reduce((acc, q) => acc + (q.timeLimit || 30), 0);
                                    const mins = Math.floor(totalSeconds / 60);
                                    const secs = totalSeconds % 60;
                                    return (
                                        <p className="text-xs text-slate-500">
                                            {questions.length} pytań • Czas łączny: {mins}m {secs}s (ok. {Math.ceil(totalSeconds/60)} min)
                                        </p>
                                    );
                                 })()}
                             </div>
                             <div className="flex gap-2">
                                 <Button variant="ghost" onClick={() => setIsEditorOpen(false)}>Anuluj</Button>
                                 <Button onClick={handleSaveEditor}>Zapisz Zmiany</Button>
                             </div>
                         </div>
                         <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                             <Target size={18} className="text-blue-600 flex-shrink-0" />
                             <div className="flex-1">
                                 <label className="text-[10px] font-bold text-blue-900 uppercase tracking-wide block mb-1">
                                     Liczba pytań do wyświetlenia
                                 </label>
                                 <input
                                     type="number"
                                     className="w-32 bg-white border border-blue-300 px-2 py-1 rounded text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                     placeholder="Wszystkie"
                                     min="1"
                                     max={selectedTest.questions?.length || 0}
                                     value={selectedTest.questions_to_display || ''}
                                     onChange={e => setSelectedTest({
                                         ...selectedTest,
                                         questions_to_display: e.target.value ? parseInt(e.target.value) : undefined
                                     })}
                                 />
                             </div>
                             <p className="text-[10px] text-blue-700 leading-tight max-w-md">
                                 System losowo wybierze tę liczbę pytań z całej puli. Jeśli puste, pokazane będą wszystkie pytania (w losowej kolejności).
                             </p>
                         </div>
                     </div>
                     <div className="flex flex-1 overflow-hidden">
                         <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto p-4">
                             <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase">Mapa Pytań</h3>
                             <div className="space-y-2">
                                 {(selectedTest.questions || []).map((q, idx) => (
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
                                        const currentQs = selectedTest.questions || [];
                                        setSelectedTest({...selectedTest, questions: [...currentQs, newQ]});
                                        setCurrentQuestionIndex(currentQs.length);
                                    }}
                                 >
                                     <Plus size={16} className="mr-2"/> Dodaj Pytanie
                                 </Button>
                             </div>
                         </div>
                         <div className="flex-1 p-8 overflow-y-auto">
                             {selectedTest.questions && selectedTest.questions[currentQuestionIndex] ? (
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
                                                     value={selectedTest.questions[currentQuestionIndex]?.timeLimit || 30}
                                                     onChange={(e) => {
                                                         const val = parseInt(e.target.value) || 0;
                                                         const newQs = [...selectedTest.questions!];
                                                         if (newQs[currentQuestionIndex]) {
                                                             newQs[currentQuestionIndex].timeLimit = val;
                                                             setSelectedTest({...selectedTest, questions: newQs});
                                                         }
                                                     }}
                                                 />
                                                 <span className="text-xs text-slate-400 font-medium">sek</span>
                                             </div>

                                             <button 
                                                className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                                                onClick={() => {
                                                    const newQs = selectedTest.questions!.filter((_, i) => i !== currentQuestionIndex);
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
                                         {selectedTest.questions[currentQuestionIndex]?.imageUrl ? (
                                             <div className="relative group w-full flex justify-center bg-slate-50 rounded-lg p-4 border border-dashed border-slate-300">
                                                 <img src={selectedTest.questions[currentQuestionIndex]?.imageUrl} alt="Pytanie" className="max-h-64 object-contain rounded" />
                                                 <div className="absolute top-2 right-2 flex gap-2">
                                                      <button className="bg-white p-2 rounded-full shadow hover:bg-slate-100 text-slate-700" onClick={() => fileInputRef.current?.click()}><Edit size={16}/></button>
                                                      <button className="bg-white p-2 rounded-full shadow hover:bg-red-50 text-red-500" onClick={() => {
                                                            const newQs = [...selectedTest.questions!];
                                                            if (newQs[currentQuestionIndex]) {
                                                                newQs[currentQuestionIndex].imageUrl = undefined;
                                                                setSelectedTest({...selectedTest, questions: newQs});
                                                            }
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
                                            value={selectedTest.questions[currentQuestionIndex]?.text || ''}
                                            onChange={(e) => {
                                                const newQs = [...selectedTest.questions!];
                                                if (newQs[currentQuestionIndex]) {
                                                    newQs[currentQuestionIndex].text = e.target.value;
                                                    setSelectedTest({...selectedTest, questions: newQs});
                                                }
                                            }}
                                         />
                                     </div>
                                     <div>
                                         <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-slate-700">Warianty Odpowiedzi</label>
                                            <span className="text-xs text-slate-500">Zaznacz wszystkie poprawne (Checkbox)</span>
                                         </div>
                                         {selectedTest.questions[currentQuestionIndex]?.correctOptionIndices?.length > 1 && (
                                             <div className="mb-3 bg-blue-50 text-blue-700 px-3 py-2 rounded text-xs font-medium flex items-start gap-2">
                                                 <span>ℹ️</span>
                                                 <span>Uczestnik zobaczy informację o wielu poprawnych odpowiedziach.</span>
                                             </div>
                                         )}
                                         <div className="space-y-3">
                                             {selectedTest.questions[currentQuestionIndex]?.options.map((opt, optIdx) => {
                                                 const isChecked = selectedTest.questions![currentQuestionIndex]?.correctOptionIndices.includes(optIdx);
                                                 
                                                 return (
                                                     <div key={optIdx} className="flex items-center gap-3">
                                                         <input 
                                                            type="checkbox" 
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                const newQs = [...selectedTest.questions!];
                                                                if (newQs[currentQuestionIndex]) {
                                                                    const currentIndices = newQs[currentQuestionIndex].correctOptionIndices;
                                                                    if (isChecked) {
                                                                        newQs[currentQuestionIndex].correctOptionIndices = currentIndices.filter(i => i !== optIdx);
                                                                    } else {
                                                                        newQs[currentQuestionIndex].correctOptionIndices = [...currentIndices, optIdx];
                                                                    }
                                                                    setSelectedTest({...selectedTest, questions: newQs});
                                                                }
                                                            }}
                                                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                         />
                                                         <input 
                                                            type="text"
                                                            className="flex-1 border border-slate-300 rounded-lg p-2 text-sm"
                                                            value={opt}
                                                            onChange={(e) => {
                                                                const newQs = [...selectedTest.questions!];
                                                                if (newQs[currentQuestionIndex]) {
                                                                    newQs[currentQuestionIndex].options[optIdx] = e.target.value;
                                                                    setSelectedTest({...selectedTest, questions: newQs});
                                                                }
                                                            }}
                                                         />
                                                         <button className="text-slate-400 hover:text-red-500" onClick={() => {
                                                                const newQs = [...selectedTest.questions!];
                                                                if (newQs[currentQuestionIndex]) {
                                                                    newQs[currentQuestionIndex].options = newQs[currentQuestionIndex].options.filter((_, i) => i !== optIdx);
                                                                    newQs[currentQuestionIndex].correctOptionIndices = newQs[currentQuestionIndex].correctOptionIndices.filter(i => i !== optIdx).map(i => i > optIdx ? i - 1 : i);
                                                                    setSelectedTest({...selectedTest, questions: newQs});
                                                                }
                                                            }}><X size={18}/></button>
                                                     </div>
                                                 );
                                             })}
                                             <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => {
                                                    const newQs = [...selectedTest.questions!];
                                                    if (newQs[currentQuestionIndex]) {
                                                        newQs[currentQuestionIndex].options.push(`Opcja ${newQs[currentQuestionIndex].options.length + 1}`);
                                                        setSelectedTest({...selectedTest, questions: newQs});
                                                    }
                                                }}>+ Dodaj odpowiedź</Button>
                                         </div>
                                         {selectedTest.questions[currentQuestionIndex]?.correctOptionIndices?.length > 1 && (
                                             <div className="mt-6 pt-4 border-t border-slate-100">
                                                 <label className="block text-sm font-bold text-slate-700 mb-2">Kryterium Zaliczania (dla wielu odpowiedzi)</label>
                                                 <select className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white" value={selectedTest.questions[currentQuestionIndex]?.gradingStrategy || GradingStrategy.ALL_CORRECT} onChange={(e) => {
                                                        const newQs = [...selectedTest.questions!];
                                                        if (newQs[currentQuestionIndex]) {
                                                            newQs[currentQuestionIndex].gradingStrategy = e.target.value as GradingStrategy;
                                                            setSelectedTest({...selectedTest, questions: newQs});
                                                        }
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
