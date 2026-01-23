
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle, ArrowRight, Wallet, Award, FileText, Shield,
    ChevronRight, X, Info, Check, ArrowLeft, Sparkles, Zap, Coins, TrendingUp, Plus as PlusIcon, Lock, Clock, ChevronDown
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { ContractType, UserStatus } from '../../types';
import { CONTRACT_TYPE_LABELS } from '../../constants';

const QUALIFICATIONS_LIST = [
    { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
    { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
    { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
];

type SimulationStep = 'intro' | 'contract' | 'quals' | 'skills';

export const CandidateSimulationPage = () => {
    const { state, updateUser, logCandidateAction } = useAppContext();
    const { systemConfig, tests, skills, currentUser, testAttempts } = state;
    const navigate = useNavigate();

    // Wizard State
    const [currentStep, setCurrentStep] = useState<SimulationStep>('intro');
    const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
    const [selectedContract, setSelectedContract] = useState<string>(
        currentUser?.contract_type || 'uop'
    );
    const [isStudent, setIsStudent] = useState(currentUser?.is_student || false);
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

    if (!currentUser) return null;

    // --- Calculations ---
    // Use HR-configured base rate from system settings (no hardcoded fallback)
    const baseRate = systemConfig?.baseRate || 0;

    const skillsBonus = useMemo(() => {
        let total = 0;
        selectedTestIds.forEach(testId => {
            const test = tests.find(t => t.id === testId);
            if (test) {
                // Fix: Ensure skill_ids is always treated as an array
                const skillIds = Array.isArray(test.skill_ids) ? test.skill_ids : [];
                skillIds.forEach(skillId => {
                    const skill = skills.find(s => s.id === skillId);
                    if (skill) total += skill.hourly_bonus;
                });
            }
        });
        return total;
    }, [selectedTestIds, tests, skills]);

    const qualBonus = useMemo(() => {
        const userQuals = currentUser.qualifications || [];
        return QUALIFICATIONS_LIST
            .filter(q => userQuals.includes(q.id))
            .reduce((acc, q) => acc + q.value, 0);
    }, [currentUser.qualifications]);

    const contractBonus = systemConfig.contractBonuses[selectedContract] || 0;
    const studentBonus = (selectedContract === 'uz' && isStudent) ? systemConfig.studentBonus : 0;

    const totalRate = baseRate + skillsBonus + qualBonus + contractBonus + studentBonus;

<<<<<<< HEAD
    // --- Cooldown Check ---
    const getCooldown = (testId: string) => {
        const attempts = testAttempts
            .filter(ta => ta.user_id === currentUser.id && ta.test_id === testId)
            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

        const lastAttempt = attempts[0];

        // If passed, test is permanently completed
        if (lastAttempt && lastAttempt.passed) {
            return { isLocked: true, isPassed: true, hours: 0, minutes: 0 };
        }

        // If failed, check 24h cooldown
        if (lastAttempt && !lastAttempt.passed) {
            const lastDate = new Date(lastAttempt.completed_at);
            const unlockDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000); // 24h lockout
            const now = new Date();

            if (now < unlockDate) {
                const diffMs = unlockDate.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                return { isLocked: true, isPassed: false, hours, minutes };
            }
        }

        return { isLocked: false, isPassed: false, hours: 0, minutes: 0 };
    };
=======
    // Group tests by category
    const testsByCategory = useMemo(() => {
        const grouped: Record<string, typeof tests> = {};
        tests.filter(t => t.is_active && !t.is_archived).forEach(test => {
            // Get the first skill's category for this test
            const skillIds = Array.isArray(test.skill_ids) ? test.skill_ids : [];
            const firstSkillId = skillIds[0];
            const skill = skills.find(s => s.id === firstSkillId);
            const category = skill?.category || 'Inne';

            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(test);
        });
        return grouped;
    }, [tests, skills]);
>>>>>>> origin/main

    // --- Handlers ---
    const toggleTestSelection = (testId: string) => {
        const cooldown = getCooldown(testId);
        if (cooldown.isLocked) return; // Don't allow selection if locked

        setSelectedTestIds(prev =>
            prev.includes(testId)
                ? prev.filter(id => id !== testId)
                : [...prev, testId]
        );
    };

    const toggleQual = (id: string) => {
        const currentQuals = currentUser.qualifications || [];
        const newQuals = currentQuals.includes(id)
            ? currentQuals.filter(q => q !== id)
            : [...currentQuals, id];
        updateUser(currentUser.id, { qualifications: newQuals });
    };

    const toggleCategory = (category: string) => {
        setCollapsedCategories(prev => ({
            ...prev,
            // If collapsed (undefined or true), open it (false), otherwise close it (true)
            [category]: prev[category] !== false ? false : true
        }));
    };

    const handleConfirm = async () => {
        updateUser(currentUser.id, {
            contract_type: selectedContract as any,
            is_student: isStudent,
            status: UserStatus.STARTED
        });

        const testNames = tests.filter(t => selectedTestIds.includes(t.id)).map(t => t.title).join(', ');
        logCandidateAction(currentUser.id, `Zakończono kalkulację stawki. Wybrano: ${selectedContract}. Wybrane testy: ${testNames}`);

        // Save selected test IDs to localStorage for resuming later
        localStorage.setItem(`user_${currentUser.id}_selectedTests`, JSON.stringify(selectedTestIds));

        navigate('/candidate/tests', { state: { selectedTestIds } });
    };

    // --- Step Content Components ---

    const StepContainer = ({ title, description, icon: Icon, children, colorClass, showRate = true, nextLabel = "DALEJ" }: any) => (
        <div className="bg-white rounded-[40px] shadow-2xl p-6 md:p-8 w-full max-w-lg relative animate-in zoom-in-95 duration-500 border border-white/40 flex flex-col overflow-hidden max-h-[95vh]">
            {/* Step Indicator Dot (Top) - Compact */}
            <div className="flex justify-center gap-1.5 mb-4">
                {['intro', 'contract', 'quals', 'skills'].map((s, idx) => (
                    <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${currentStep === s ? 'w-8 bg-blue-600' : (idx < ['intro', 'contract', 'quals', 'skills'].indexOf(currentStep) ? 'w-4 bg-green-500' : 'w-2 bg-slate-100')}`}></div>
                ))}
            </div>

            <div className="flex flex-col items-center text-center mb-5 relative">
                <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center mb-4 shadow-xl shadow-blue-100 ${colorClass}`}>
                    <Icon size={28} className="text-white"/>
                </div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-1">{title}</h2>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest px-4 leading-relaxed opacity-70">{description}</p>
            </div>
            
            <div className="space-y-2 mb-6 overflow-y-auto pr-1 scrollbar-hide">
                {children}
            </div>

            <div className="flex items-center justify-between pt-5 border-t border-slate-50 mt-auto">
                <div className={`transition-opacity duration-300 ${showRate ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">TWOJA STAWKA</span>
                    {/* Fixed: Cast totalRate to number to avoid 'unknown' error */}
                    <div className="text-2xl font-black text-blue-600 tabular-nums">{(totalRate as number).toFixed(2)} <span className="text-[10px] font-bold text-slate-300 uppercase">zł/h</span></div>
                </div>
                
                <div className="flex items-center gap-2">
                    {currentStep !== 'intro' && (
                        <button 
                            onClick={() => {
                                if (currentStep === 'contract') setCurrentStep('intro');
                                else if (currentStep === 'quals') setCurrentStep('contract');
                                else if (currentStep === 'skills') setCurrentStep('quals');
                            }}
                            className="px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-300 hover:text-slate-600 transition-colors"
                        >
                            Wróć
                        </button>
                    )}
                    
                    <Button 
                        onClick={() => {
                            if (currentStep === 'skills') handleConfirm();
                            else if (currentStep === 'intro') setCurrentStep('contract');
                            else if (currentStep === 'contract') setCurrentStep('quals');
                            else if (currentStep === 'quals') setCurrentStep('skills');
                        }} 
                        disabled={currentStep === 'skills' && selectedTestIds.length === 0}
                        className={`h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95 border-0 ${currentStep === 'skills' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {currentStep === 'skills' ? 'Rozpocznij testy' : nextLabel}
                        {currentStep === 'skills' ? <ArrowRight size={18} className="ml-2"/> : <ChevronRight size={18} className="ml-1 opacity-50"/>}
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 selection:bg-blue-100">
            {/* Background Blur Overlay */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-700"></div>

            {/* Step 0: Intro / Base Info */}
            {currentStep === 'intro' && (
                <StepContainer 
                    title="Twoje zarobki" 
                    description="Zacznijmy od podstawy. Sprawdź, jak budujemy Twoją stawkę."
                    icon={Coins}
                    colorClass="bg-slate-900"
                    showRate={false}
                    nextLabel="Kalkulacja"
                >
                    <div className="flex flex-col items-center">
                        {/* Base Rate Box - More Compact */}
                        <div className="w-full bg-slate-50 border border-slate-100 rounded-[28px] p-5 text-center shadow-inner ring-1 ring-slate-100 mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">STAWKA BAZOWA</span>
                            <div className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{baseRate.toFixed(2)} <span className="text-base font-bold text-slate-400 uppercase">zł/h</span></div>
                        </div>

                        {/* Plus Symbol */}
                        <div className="flex items-center justify-center -my-1 relative z-10">
                            <div className="bg-white rounded-full p-1 border border-slate-100 shadow-sm text-slate-300">
                                <PlusIcon size={16} />
                            </div>
                        </div>

                        {/* Components Stack - Tighter */}
                        <div className="grid grid-cols-1 gap-1.5 w-full">
                            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-2xl shadow-sm">
                                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm"><Award size={16}/></div>
                                <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Umiejętności techniczne</span>
                            </div>
                            
                            <div className="flex items-center justify-center -my-3 relative z-10">
                                <div className="text-slate-300"><PlusIcon size={12} /></div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-100 rounded-2xl shadow-sm">
                                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-purple-600 shadow-sm"><Shield size={16}/></div>
                                <span className="text-[10px] font-black text-purple-900 uppercase tracking-widest">Uprawnienia SEP / UDT</span>
                            </div>

                            <div className="flex items-center justify-center -my-3 relative z-10">
                                <div className="text-slate-300"><PlusIcon size={12} /></div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm">
                                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm"><FileText size={16}/></div>
                                <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Forma umowy i status</span>
                            </div>
                        </div>
                    </div>
                </StepContainer>
            )}

            {/* Step 1: Contract */}
            {currentStep === 'contract' && (
                <StepContainer 
                    title="Typ umowy" 
                    description="Wybierz formę współpracy. Wpływa ona na Twoją stawkę netto."
                    icon={FileText}
                    colorClass="bg-blue-600"
                >
                    <div className="grid grid-cols-1 gap-2.5">
                        {Object.entries(systemConfig.contractBonuses).map(([key, bonus]) => (
                            <button 
                                key={key}
                                onClick={() => setSelectedContract(key)}
                                className={`flex items-center justify-between p-4 rounded-[22px] border-2 transition-all ${
                                    selectedContract === key 
                                    ? 'border-blue-600 bg-blue-50 shadow-xl shadow-blue-100 scale-[1.02]' 
                                    : 'border-slate-50 bg-slate-50/50 hover:border-blue-200'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedContract === key ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>
                                        {selectedContract === key && <Check size={14}/>}
                                    </div>
                                    <span className={`font-black text-xs uppercase tracking-widest ${selectedContract === key ? 'text-blue-900' : 'text-slate-500'}`}>
                                        {CONTRACT_TYPE_LABELS[key as ContractType] || key}
                                    </span>
                                </div>
                                <span className={`font-black text-xs tabular-nums ${selectedContract === key ? 'text-blue-600' : 'text-slate-300'}`}>
                                    +{bonus.toFixed(2)} zł
                                </span>
                            </button>
                        ))}
                    </div>
                    {selectedContract === 'uz' && (
                        <div className="mt-3 p-3.5 bg-indigo-600 text-white rounded-[22px] shadow-xl shadow-indigo-200 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/20 rounded-lg"><Award size={18}/></div>
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Status Studenta &lt; 26</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={isStudent} onChange={e => setIsStudent(e.target.checked)} className="sr-only peer"/>
                                <div className="w-10 h-5 bg-indigo-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white after:peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    )}
                </StepContainer>
            )}

            {/* Step 2: Qualifications */}
            {currentStep === 'quals' && (
                <StepContainer 
                    title="Uprawnienia" 
                    description="Zaznacz posiadane uprawnienia, aby podnieść swoją stawkę."
                    icon={Shield}
                    colorClass="bg-purple-600"
                >
                    <div className="space-y-2.5">
                        {QUALIFICATIONS_LIST.map(q => {
                            const isSelected = (currentUser.qualifications || []).includes(q.id);
                            return (
                                <button 
                                    key={q.id}
                                    onClick={() => toggleQual(q.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-[22px] border-2 transition-all ${
                                        isSelected 
                                        ? 'border-purple-600 bg-purple-50 shadow-xl shadow-purple-100 scale-[1.02]' 
                                        : 'border-slate-50 bg-slate-50/50 hover:border-purple-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-200 bg-white'}`}>
                                            {isSelected && <Check size={14}/>}
                                        </div>
                                        <span className={`font-black text-xs uppercase tracking-widest ${isSelected ? 'text-purple-900' : 'text-slate-500'}`}>{q.label}</span>
                                    </div>
                                    <span className={`font-black text-xs tabular-nums ${isSelected ? 'text-purple-600' : 'text-slate-300'}`}>+{q.value.toFixed(1)} zł</span>
                                </button>
                            );
                        })}
                    </div>
                </StepContainer>
            )}

            {/* Step 3: Skills */}
            {currentStep === 'skills' && (
                <StepContainer
                    title="Umiejętności"
                    description="Wybierz to, co już potrafisz. Sprawdzimy to krótkim testem."
                    icon={Sparkles}
                    colorClass="bg-green-600"
                >
                    <div className="space-y-2">
<<<<<<< HEAD
                        {tests.filter(t => t.is_active && !t.is_archived).map(test => {
                            const isSelected = selectedTestIds.includes(test.id);
                            const skill = skills.find(s => s.id === (test.skill_ids && test.skill_ids[0]));
                            const bonus = (test.skill_ids || []).reduce((acc, sid) => acc + (skills.find(s => s.id === sid)?.hourly_bonus || 0), 0);
                            const cooldown = getCooldown(test.id);

                            return (
                                <button
                                    key={test.id}
                                    onClick={() => toggleTestSelection(test.id)}
                                    disabled={cooldown.isLocked}
                                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all ${
                                        cooldown.isLocked
                                            ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                                            : isSelected
                                            ? 'border-green-600 bg-green-50 shadow-lg shadow-green-50 scale-[1.01]'
                                            : 'border-slate-50 bg-slate-50/50 hover:border-green-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                            cooldown.isLocked
                                                ? 'bg-slate-300 border-slate-300 text-white'
                                                : isSelected
                                                ? 'bg-green-600 border-green-600 text-white'
                                                : 'bg-white border-slate-200'
                                        }`}>
                                            {cooldown.isLocked ? (
                                                cooldown.isPassed ? <CheckCircle size={12}/> : <Lock size={12}/>
                                            ) : (
                                                isSelected && <Check size={12}/>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <div className={`font-black text-[11px] uppercase tracking-tighter leading-none ${
                                                cooldown.isLocked ? 'text-slate-500' : isSelected ? 'text-green-900' : 'text-slate-700'
                                            }`}>{skill?.name_pl || test.title}</div>
                                            {cooldown.isLocked ? (
                                                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">
                                                    <Clock size={10}/>
                                                    {cooldown.isPassed ? (
                                                        <span>Zaliczony</span>
                                                    ) : (
                                                        <span>Odblokuje za {cooldown.hours}h {cooldown.minutes}m</span>
                                                    )}
                                                </div>
                                            ) : (
                                                skill?.criteria && skill.criteria.length > 0 && <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter truncate max-w-[200px] mt-1 opacity-60">{skill.criteria[0]}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`text-[11px] font-black tabular-nums transition-colors ${
                                        cooldown.isLocked ? 'text-slate-400' : isSelected ? 'text-green-600' : 'text-slate-300'
                                    }`}>+{bonus.toFixed(2)} zł</div>
                                </button>
=======
                        {Object.entries(testsByCategory).map(([category, categoryTests]) => {
                            // Categories are collapsed by default (true if not explicitly set to false)
                            const isCollapsed = collapsedCategories[category] !== false;
                            const categorySelectedCount = categoryTests.filter(t => selectedTestIds.includes(t.id)).length;

                            return (
                                <div key={category} className="space-y-1.5">
                                    {/* Category Header */}
                                    <button
                                        onClick={() => toggleCategory(category)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ChevronDown
                                                size={16}
                                                className={`text-slate-600 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                                            />
                                            <span className="font-black text-[10px] uppercase tracking-widest text-slate-700">
                                                {category}
                                            </span>
                                            {categorySelectedCount > 0 && (
                                                <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                                    {categorySelectedCount}
                                                </span>
                                            )}
                                        </div>
                                    </button>

                                    {/* Category Tests */}
                                    {!isCollapsed && (
                                        <div className="space-y-1.5 pl-2">
                                            {categoryTests.map(test => {
                                                const isSelected = selectedTestIds.includes(test.id);
                                                // Fix: Ensure skill_ids is always treated as an array
                                                const skillIds = Array.isArray(test.skill_ids) ? test.skill_ids : [];
                                                const skill = skills.find(s => s.id === skillIds[0]);
                                                const bonus = skillIds.reduce((acc, sid) => acc + (skills.find(s => s.id === sid)?.hourly_bonus || 0), 0);

                                                return (
                                                    <button
                                                        key={test.id}
                                                        onClick={() => toggleTestSelection(test.id)}
                                                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all ${
                                                            isSelected
                                                            ? 'border-green-600 bg-green-50 shadow-lg shadow-green-50 scale-[1.01]'
                                                            : 'border-slate-50 bg-slate-50/50 hover:border-green-200'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-slate-200'}`}>
                                                                {isSelected && <Check size={12}/>}
                                                            </div>
                                                            <div className="text-left">
                                                                <div className={`font-black text-[11px] uppercase tracking-tighter leading-none ${isSelected ? 'text-green-900' : 'text-slate-700'}`}>{skill?.name_pl || test.title}</div>
                                                                {skill?.criteria && skill.criteria.length > 0 && <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter truncate max-w-[200px] mt-1 opacity-60">{skill.criteria[0]}</div>}
                                                            </div>
                                                        </div>
                                                        <div className={`text-[11px] font-black tabular-nums transition-colors ${isSelected ? 'text-green-600' : 'text-slate-300'}`}>+{bonus.toFixed(2)} zł</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
>>>>>>> origin/main
                            );
                        })}
                    </div>
                </StepContainer>
            )}
        </div>
    );
};
