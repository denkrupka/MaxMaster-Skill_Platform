
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, CheckCircle, ChevronDown, ArrowRight, Wallet, Award, FileText, Shield, ChevronRight, X, AlertTriangle, Info } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { ContractType, Skill, Test, UserStatus } from '../../types';
import { CONTRACT_TYPE_LABELS } from '../../constants';

const QUALIFICATIONS_LIST = [
    { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
    { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
    { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
];

export const CandidateSimulationPage = () => {
    const { state, updateUser, logCandidateAction } = useAppContext();
    const { systemConfig, tests, skills, currentUser } = state;
    const navigate = useNavigate();

    // State
    const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
    const [selectedContract, setSelectedContract] = useState<ContractType>(
        currentUser?.contract_type || ContractType.UOP
    );
    const [isStudent, setIsStudent] = useState(currentUser?.is_student || false);
    const [isQualModalOpen, setIsQualModalOpen] = useState(false);

    // --- Calculations ---

    const baseRate = systemConfig.baseRate;

    // Calculate potential bonus from selected tests
    const skillsBonus = useMemo(() => {
        let total = 0;
        selectedTestIds.forEach(testId => {
            const test = tests.find(t => t.id === testId);
            if (test) {
                test.skill_ids.forEach(skillId => {
                    const skill = skills.find(s => s.id === skillId);
                    if (skill) total += skill.hourly_bonus;
                });
            }
        });
        return total;
    }, [selectedTestIds, tests, skills]);

    // Use qualifications from currentUser
    const qualBonus = useMemo(() => {
        const userQuals = currentUser?.qualifications || [];
        return QUALIFICATIONS_LIST
            .filter(q => userQuals.includes(q.id))
            .reduce((acc, q) => acc + q.value, 0);
    }, [currentUser?.qualifications]);

    const contractBonus = systemConfig.contractBonuses[selectedContract] || 0;
    const studentBonus = (selectedContract === ContractType.UZ && isStudent) ? 3 : 0;
    const totalRate = baseRate + skillsBonus + qualBonus + contractBonus + studentBonus;

    // --- Helpers ---

    const toggleTestSelection = (testId: string) => {
        setSelectedTestIds(prev => 
            prev.includes(testId) 
                ? prev.filter(id => id !== testId) 
                : [...prev, testId]
        );
    };

    const toggleQual = (id: string) => {
        if (!currentUser) return;
        const currentQuals = currentUser.qualifications || [];
        let newQuals;
        if (currentQuals.includes(id)) {
            newQuals = currentQuals.filter(q => q !== id);
        } else {
            newQuals = [...currentQuals, id];
        }
        updateUser(currentUser.id, { qualifications: newQuals });
    };

    const getTestBonus = (test: Test) => {
        return test.skill_ids.reduce((acc, sid) => {
            const s = skills.find(sk => sk.id === sid);
            return acc + (s?.hourly_bonus || 0);
        }, 0);
    };

    const handleConfirm = async () => {
        if (!currentUser) return;

        // 1. Update User Contract Preference and Status
        updateUser(currentUser.id, { 
            contract_type: selectedContract,
            is_student: isStudent,
            status: UserStatus.STARTED // Ensure status allows testing
        });

        // 2. Log Action
        const testNames = tests.filter(t => selectedTestIds.includes(t.id)).map(t => t.title).join(', ');
        const qualNames = QUALIFICATIONS_LIST.filter(q => (currentUser.qualifications || []).includes(q.id)).map(q => q.label).join(', ');
        logCandidateAction(currentUser.id, `Symulacja stawki. Wybrano: ${CONTRACT_TYPE_LABELS[selectedContract]}${isStudent ? ' (Student)' : ''}. Planowane testy: ${testNames}. Uprawnienia: ${qualNames}`);

        // 3. Navigate WITH STATE
        navigate('/candidate/tests', { state: { selectedTestIds } });
    };

    const renderQualModal = () => {
        if (!isQualModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setIsQualModalOpen(false)}>
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-6 border-b border-slate-100">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Shield size={24} className="text-purple-600"/> Uprawnienia
                        </h3>
                        <button onClick={() => setIsQualModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                    </div>
                    <div className="p-6">
                        <p className="text-sm text-slate-500 mb-4">Zaznacz posiadane uprawnienia, aby zwiększyć swoją stawkę.</p>
                        <div className="space-y-2">
                            {QUALIFICATIONS_LIST.map(q => {
                                const isSelected = (currentUser?.qualifications || []).includes(q.id);
                                return (
                                    <div 
                                        key={q.id}
                                        onClick={() => toggleQual(q.id)}
                                        className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                            isSelected 
                                            ? 'bg-green-50 border-green-200 shadow-sm' 
                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-green-600 border-green-600' : 'border-slate-300'}`}>
                                                {isSelected && <CheckCircle size={14} className="text-white"/>}
                                            </div>
                                            <span className={`font-medium ${isSelected ? 'text-green-800' : 'text-slate-700'}`}>{q.label}</span>
                                        </div>
                                        <span className={`font-bold ${isSelected ? 'text-green-600' : 'text-slate-400'}`}>+{q.value} zł</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-6 p-4 bg-blue-50 text-blue-800 text-xs rounded-lg flex items-start gap-2">
                            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5"/>
                            <span>Dokumenty potwierdzające wybrane uprawnienia będziesz musiał dostarczyć na etapie podpisywania umowy.</span>
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                        <Button onClick={() => setIsQualModalOpen(false)}>Zatwierdź</Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Kalkulator Stawki</h1>
                    <p className="text-slate-500">
                        Wybierz umiejętności które posiadasz oraz dobierz preferowaną formę współpracy, aby poznać swoją prognozowaną stawkę.
                    </p>
                </div>

                {/* 1. Formula Block */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* BAZA */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-slate-500 mb-2 font-medium uppercase text-xs tracking-wider">
                                <Wallet size={16} /> Baza
                            </div>
                            <div className="text-3xl font-bold text-slate-900">{baseRate} zł</div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Minimalna stawka godzinowa w MaxMaster.</p>
                    </div>

                    {/* UMIEJĘTNOŚCI */}
                    <div className={`p-5 rounded-xl shadow-sm border flex flex-col justify-between transition-colors ${skillsBonus > 0 ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                        <div>
                            <div className="flex items-center gap-2 text-slate-500 mb-2 font-medium uppercase text-xs tracking-wider">
                                <Award size={16} /> Umiejętności
                            </div>
                            <div className="text-3xl font-bold text-green-600">+{skillsBonus} zł</div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Suma dodatków za wybrane umiejętności.</p>
                    </div>

                    {/* UPRAWNIENIA */}
                    <div 
                        className={`p-5 rounded-xl shadow-sm border flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${qualBonus > 0 ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200 hover:border-purple-300'}`}
                        onClick={() => setIsQualModalOpen(true)}
                    >
                        <div>
                            <div className="flex items-center gap-2 text-slate-500 mb-2 font-medium uppercase text-xs tracking-wider">
                                <Shield size={16} /> Uprawnienia
                            </div>
                            <div className={`text-3xl font-bold flex items-center ${qualBonus > 0 ? 'text-purple-600' : 'text-slate-300'}`}>
                                +{qualBonus} zł <ChevronRight size={20} className={`ml-auto ${qualBonus > 0 ? 'text-purple-400' : 'text-slate-300'}`} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Kliknij, aby dodać.</p>
                    </div>

                    {/* FORMA ZATRUDNIENIA */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between relative group">
                        <div>
                            <div className="flex items-center gap-2 text-slate-500 mb-2 font-medium uppercase text-xs tracking-wider">
                                <FileText size={16} /> Forma Umowy
                            </div>
                            <div className="relative">
                                <select 
                                    className="w-full appearance-none bg-transparent text-xl font-bold text-blue-600 focus:outline-none cursor-pointer py-1 pr-6"
                                    value={selectedContract}
                                    onChange={(e) => setSelectedContract(e.target.value as ContractType)}
                                >
                                    <option value={ContractType.UOP}>Umowa o Pracę</option>
                                    <option value={ContractType.UZ}>Umowa Zlecenie</option>
                                    <option value={ContractType.B2B}>B2B</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none"/>
                            </div>
                            <div className="text-sm font-bold text-blue-400 mt-1">
                                {contractBonus > 0 ? `+${contractBonus} zł` : '+0 zł'}
                            </div>
                            {selectedContract === ContractType.UZ && (
                                <div className="mt-2 flex items-center gap-2 bg-blue-50 p-2 rounded">
                                    <input 
                                        type="checkbox" 
                                        id="studentCb"
                                        checked={isStudent} 
                                        onChange={(e) => setIsStudent(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="studentCb" className="text-xs text-slate-700 font-medium cursor-pointer">Student &lt; 26 lat (+3 zł)</label>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Wpływ formy współpracy na stawkę.</p>
                    </div>

                    {/* TOTAL */}
                    <div className="bg-slate-900 p-5 rounded-xl shadow-lg border border-slate-800 flex flex-col justify-between text-white">
                        <div>
                            <div className="flex items-center gap-2 text-slate-400 mb-2 font-medium uppercase text-xs tracking-wider">
                                <Calculator size={16} /> Twoja Stawka
                            </div>
                            <div className="text-4xl font-bold">{totalRate} zł<span className="text-lg text-slate-400 font-normal">/h</span></div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Szacowana stawka netto (na rękę).</p>
                    </div>
                </div>

                {/* INFO BOX */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-4 items-start">
                    <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
                        <Info size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-blue-800 text-sm mb-1">Zasada aktualizacji stawki</h4>
                        <p className="text-sm text-blue-700 leading-relaxed">
                            Aktualizacja stawki następuje raz w miesiącu. 
                            Jeśli zaliczysz test i potwierdzisz umiejętność w praktyce, nowa stawka zacznie obowiązywać od 1 dnia następnego miesiąca.
                        </p>
                    </div>
                </div>

                {/* 2. Skills Selection Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-800">Wybierz umiejętności które posiadasz</h3>
                        <p className="text-sm text-slate-500">Zaznacz te obszary, w których czujesz się pewnie.</p>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 w-12"></th>
                                <th className="px-6 py-4">Nazwa Umiejętności</th>
                                <th className="px-6 py-4">Kryterium</th>
                                <th className="px-6 py-4 text-right">Dodatek do stawki</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {tests.filter(t => t.is_active && !t.is_archived).map(test => {
                                const isSelected = selectedTestIds.includes(test.id);
                                const bonus = getTestBonus(test);
                                const skill = skills.find(s => s.id === test.skill_ids[0]);
                                
                                return (
                                    <tr 
                                        key={test.id} 
                                        onClick={() => toggleTestSelection(test.id)}
                                        className={`cursor-pointer transition-all ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                                {isSelected && <CheckCircle size={14} className="text-white" />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                                {skill ? skill.name_pl : test.title}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs">
                                            {skill && skill.criteria && skill.criteria.length > 0 ? (
                                                <ul className="list-disc pl-4 space-y-1">
                                                    {skill.criteria.map((c, i) => (
                                                        <li key={i}>{c}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className="italic text-slate-400">Brak zdefiniowanych kryteriów</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${isSelected ? 'text-green-600' : 'text-slate-400'}`}>
                                                +{bonus} zł/h
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* 3. CTA */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-50 md:static md:bg-transparent md:border-0 md:p-0">
                    <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-slate-500 hidden md:block">
                            Wybrano umiejętności: <strong>{selectedTestIds.length}</strong>. Potencjalny wzrost stawki: <strong>+{skillsBonus} zł/h</strong>.
                        </div>
                        <Button 
                            size="lg" 
                            disabled={selectedTestIds.length === 0}
                            onClick={handleConfirm}
                            className="w-full md:w-auto shadow-xl shadow-blue-900/10"
                        >
                            Potwierdź wybrane umiejętności
                            <ArrowRight size={18} className="ml-2" />
                        </Button>
                    </div>
                </div>

                {renderQualModal()}
            </div>
        </div>
    );
};
