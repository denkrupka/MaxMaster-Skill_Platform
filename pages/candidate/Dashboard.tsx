
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, User, Clock, Coins, Calculator, ArrowRight, X, Building, Briefcase, TrendingUp, CheckCircle, ChevronRight, Wallet, Award, FileText, AlertTriangle, ChevronDown, ClipboardList, Shield, ChevronUp, MapPin, Gift, GraduationCap, Users, Calendar, Hammer, Shirt, PartyPopper, Zap, Star, ThumbsUp } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { ContractType, UserStatus, SkillStatus } from '../../types';
import { Button } from '../../components/Button';
import { CONTRACT_TYPE_LABELS } from '../../constants';

type ModalType = 'about' | 'conditions' | 'salary' | 'career' | null;

const QUALIFICATIONS_LIST = [
    { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
    { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
    { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
];

export const CandidateDashboard = () => {
    const { state, updateUser, logCandidateAction, triggerNotification } = useAppContext();
    const { currentUser, systemConfig, testAttempts, tests, skills, userSkills, positions } = state;
    const navigate = useNavigate();

    // Force re-render when testAttempts or userSkills change
    const [, setRenderKey] = useState(0);
    useEffect(() => {
        setRenderKey(prev => prev + 1);
    }, [testAttempts.length, userSkills.length]);

    // Modal State
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [salaryTab, setSalaryTab] = useState<'hourly' | 'piecework'>('hourly');

    // Post-Test State
    const [selectedContract, setSelectedContract] = useState<string>(
        currentUser?.contract_type || 'uop'
    );
    const [isStudent, setIsStudent] = useState(currentUser?.is_student || false);
    const [isContractPopoverOpen, setIsContractPopoverOpen] = useState(false);

    // New Interactive States for Monthly Simulator & Benefits
    const [isDelegation, setIsDelegation] = useState(false);
    const [isSaturday, setIsSaturday] = useState(false);
    const [showSalarySim, setShowSalarySim] = useState(false);
    const [showBenefits, setShowBenefits] = useState(false);
    const [benefitTab, setBenefitTab] = useState<'benefits' | 'dev' | 'career'>('career'); // Default to career to show the path

    // Qualifications State
    const [isQualModalOpen, setIsQualModalOpen] = useState(false);

    if (!currentUser) return null;

    // --- Dynamic Career Steps ---
    const careerStepsData = useMemo(() => {
        const sorted = [...positions].sort((a, b) => a.order - b.order);
        const colors = [
            'bg-slate-400',
            'bg-blue-400',
            'bg-blue-600',
            'bg-purple-600',
            'bg-orange-500',
            'bg-slate-800'
        ];
        return sorted.map((pos, idx) => ({
            step: idx + 1,
            label: pos.name,
            color: colors[idx] || 'bg-slate-800'
        }));
    }, [positions]);

    // --- REJECTION / BLOCKED SCREEN ---
    if (currentUser.status === UserStatus.REJECTED || currentUser.status === UserStatus.PORTAL_BLOCKED) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-6">
                        <X size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Dziękujemy za poświęcony czas</h2>
                    <p className="text-slate-500 mb-8 leading-relaxed">
                        Na podstawie wyników testów i procesu rekrutacji tym razem nie możemy kontynuować współpracy. 
                        Dziękujemy za udział i życzymy powodzenia w dalszych wyzwaniach zawodowych.
                    </p>
                    <div className="text-xs text-slate-400 border-t border-slate-100 pt-4">
                        MaxMaster Sp. z o.o.
                    </div>
                </div>
            </div>
        );
    }

    const isPostTestStage = [
        UserStatus.TESTS_COMPLETED,
        UserStatus.INTERESTED,
        UserStatus.NOT_INTERESTED,
        UserStatus.OFFER_SENT,
        UserStatus.DATA_REQUESTED,
        UserStatus.DATA_SUBMITTED
    ].includes(currentUser.status);

    // Lock modification if data is submitted or offer sent/active
    const isLocked = [
        UserStatus.DATA_SUBMITTED, 
        UserStatus.OFFER_SENT, 
        UserStatus.ACTIVE, 
        UserStatus.TRIAL
    ].includes(currentUser.status);

    const showEstimateBanner = !isPostTestStage && [UserStatus.INVITED, UserStatus.STARTED, UserStatus.TESTS_IN_PROGRESS].includes(currentUser.status);

    // Check if candidate has incomplete tests
    const hasIncompleteTests = useMemo(() => {
        if (!currentUser) return false;
        const savedTestsKey = `user_${currentUser.id}_selectedTests`;
        const savedTests = localStorage.getItem(savedTestsKey);
        return savedTests && JSON.parse(savedTests).length > 0;
    }, [currentUser, testAttempts.length]);

    // --- Post Test Calculations ---
    const passedAttempts = useMemo(() => {
        return testAttempts.filter(ta => ta.user_id === currentUser.id);
    }, [testAttempts, currentUser.id]);

    const skillsBonus = useMemo(() => {
        let total = 0;
        const countedSkillIds = new Set<string>();

        passedAttempts.forEach(ta => {
            if (ta.passed) {
                const test = tests.find(t => t.id === ta.test_id);
                if (test) {
                    test.skill_ids.forEach(sid => {
                        if (!countedSkillIds.has(sid)) {
                            const skill = skills.find(s => s.id === sid);
                            if (skill) {
                                total += skill.hourly_bonus;
                                countedSkillIds.add(sid);
                            }
                        }
                    });
                }
            }
        });
        return total;
    }, [passedAttempts, tests, skills]);

    const qualBonus = useMemo(() => {
        const userQuals = currentUser.qualifications || [];
        const candidateDocs = userSkills.filter(us => us.user_id === currentUser.id);

        return QUALIFICATIONS_LIST
            .filter(q => userQuals.includes(q.id))
            .reduce((acc, q) => {
                // If a document exists for this qual and is FAILED, do not add bonus
                const expectedDocName = `Certyfikat ${q.label}`;
                const doc = candidateDocs.find(d => d.custom_name === expectedDocName);
                if (doc && doc.status === SkillStatus.FAILED) {
                    return acc;
                }
                return acc + q.value;
            }, 0);
    }, [currentUser.qualifications, userSkills, currentUser.id]);

    const contractBonus = systemConfig.contractBonuses[selectedContract] || 0;
    const studentBonus = (selectedContract === 'uz' && isStudent) ? systemConfig.studentBonus : 0;
    const totalRate = systemConfig.baseRate + skillsBonus + qualBonus + contractBonus + studentBonus;

    // --- Monthly Simulation Calculations ---
    const monthlySimulations = useMemo(() => {
        // Base effective rate (including delegation bonus from systemConfig if checked)
        const effectiveRate = totalRate + (isDelegation ? (systemConfig.delegationBonus || 3) : 0);
        
        // Scenario 1: Standard (Pn-Pt 8h) -> ~168h base
        let s1_hours = 168;
        let s1_earnings = s1_hours * effectiveRate;

        // Scenario 2: Overtime (Pn-Pt 10h) -> ~210h total
        // 168h normal + 42h overtime (+ overtimeBonus from systemConfig)
        const s2_std = 168;
        const s2_ot = 42;
        let s2_hours = s2_std + s2_ot;
        let s2_earnings = (s2_std * effectiveRate) + (s2_ot * (effectiveRate + (systemConfig.overtimeBonus || 3)));

        // Apply Saturday Logic if toggled
        if (isSaturday) {
            // Assume 4 Saturdays
            // For Scenario 1 (8h base), assume 8h Saturdays
            const satHours8 = 4 * 8; 
            s1_hours += satHours8;
            s1_earnings += (satHours8 * (effectiveRate + (systemConfig.holidayBonus || 5))); // Weekend bonus from systemConfig

            // For Scenario 2 (10h base), assume 10h Saturdays
            const satHours10 = 4 * 10;
            s2_hours += satHours10;
            s2_earnings += (satHours10 * (effectiveRate + (systemConfig.holidayBonus || 5))); // Weekend bonus from systemConfig
        }

        const suffix = isSaturday ? ' + Soboty' : '';

        return [
            { label: `Standard (Pn-Pt 8h${suffix})`, hours: s1_hours, amount: Math.round(s1_earnings) },
            { label: `Z nadgodzinami (Pn-Pt 10h${suffix})`, hours: s2_hours, amount: Math.round(s2_earnings) },
        ];
    }, [totalRate, isDelegation, isSaturday, systemConfig]);

    // --- Actions ---

    const handleInterested = () => {
        updateUser(currentUser.id, { 
            status: UserStatus.INTERESTED,
            contract_type: selectedContract as any,
            is_student: isStudent
        });
        const contractLabel = CONTRACT_TYPE_LABELS[selectedContract as ContractType] || selectedContract;
        logCandidateAction(currentUser.id, `Kandydat zgłosił zainteresowanie współpracą. Umowa: ${contractLabel}${isStudent ? ' (Student)' : ''}`);
        triggerNotification('status_change', 'Zainteresowanie Kandydata', `Kandydat ${currentUser.first_name} ${currentUser.last_name} jest zainteresowany współpracą.`, '/hr/candidates');
    };

    const handleResign = () => {
        updateUser(currentUser.id, { status: UserStatus.NOT_INTERESTED });
        logCandidateAction(currentUser.id, 'Kandydat zrezygnował z rekrutacji.');
        triggerNotification('status_change', 'Rezygnacja Kandydata', `Kandydat ${currentUser.first_name} ${currentUser.last_name} zrezygnował.`, '/hr/candidates');
    };

    const handleDeclineOffer = () => {
        updateUser(currentUser.id, { status: UserStatus.NOT_INTERESTED });
        logCandidateAction(currentUser.id, 'Kandydat odrzucił ofertę pracy.');
        triggerNotification('status_change', 'Rezygnacja Kandydata', `Kandydat ${currentUser.first_name} ${currentUser.last_name} odrzucił ofertę pracy.`, '/hr/candidates');
    };

    const toggleQual = (id: string) => {
        const currentQuals = currentUser.qualifications || [];
        let newQuals;
        if (currentQuals.includes(id)) {
            newQuals = currentQuals.filter(q => q !== id);
        } else {
            newQuals = [...currentQuals, id];
        }
        updateUser(currentUser.id, { qualifications: newQuals });
    };

    const closeModal = () => {
        setActiveModal(null);
        setSalaryTab('hourly');
    };

    const handleContractClick = (type: string) => {
        if (isLocked) return;
        setSelectedContract(type);
        setIsContractPopoverOpen(false);
    };

    const InfoTile = ({ icon: Icon, label, type, colorClass }: { icon: any, label: string, type: ModalType, colorClass: string }) => (
        <button 
            onClick={() => setActiveModal(type)}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group h-32"
        >
            <div className={`mb-3 p-2 rounded-lg ${colorClass} group-hover:scale-110 transition-transform`}>
                <Icon size={24} />
            </div>
            <span className="text-sm font-bold text-slate-700 text-center leading-tight">{label}</span>
        </button>
    );

    const renderModalContent = () => {
        if (!activeModal) return null;
        let content = null;
        let title = '';

        switch (activeModal) {
            case 'about':
                title = 'O MaxMaster';
                content = (
                    <div className="space-y-6 text-slate-600">
                        <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                            <h4 className="font-bold text-blue-900 mb-2">Kim jesteśmy</h4>
                            <p className="text-sm leading-relaxed">
                                MaxMaster Sp. z o.o. to dynamicznie rozwijająca się firma, działająca od 2019 roku,
                                specjalizująca się w realizacji instalacji elektrycznych i teletechnicznych
                                na dużych obiektach: halach, biurowcach, obiektach publicznych i przemysłowych.
                            </p>
                            <p className="text-sm leading-relaxed mt-2 italic">
                                My ne pracujemy „na ilość”, my pracujemy na quality i odpowiedzialność.
                                Tworzymy przestrzenie, które są funkcjonalne, bezpieczne i trwałe.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Users size={18} className="text-blue-600"/> Jak pracujemy
                            </h4>
                            <ul className="space-y-2 text-sm pl-2">
                                <li className="flex items-start gap-2"><CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0"/> <span>Pracujemy zespołowo</span></li>
                                <li className="flex items-start gap-2"><CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0"/> <span>Szanujemy doświadczenie i zaangażowanie</span></li>
                                <li className="flex items-start gap-2"><CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0"/> <span>Stawiamy na jasne zasady i uczciwe rozliczenia</span></li>
                                <li className="flex items-start gap-2"><CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0"/> <span>Nie tolerujemy „siedzenia w telefonie” i marnowania czasu</span></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <PartyPopper size={18} className="text-purple-600"/> Atmosfera
                            </h4>
                            <ul className="space-y-2 text-sm pl-2">
                                <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5"></div> Zgrany zespół</li>
                                <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5"></div> Integracje finansowane przez firmę (grill, skutery wodne, gokarty, kręgle)</li>
                                <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5"></div> Wspieramy ludzi, którzy chcą się rozwijać i brać odpowiedzialność</li>
                            </ul>
                        </div>
                    </div>
                );
                break;
            case 'conditions':
                title = 'Warunki Pracy';
                content = (
                    <div className="space-y-6 text-slate-600">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><FileText size={18} className="text-blue-500"/> Forma zatrudnienia</h4>
                                <ul className="space-y-2 text-sm">
                                    <li>• Umowa zlecenie</li>
                                    <li>• Umowa o pracę na czas nieokreślony po pozytywnym okresie próbnym</li>
                                    <li>• Możliwość współpracy B2B</li>
                                </ul>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Clock size={18} className="text-orange-500"/> Czas pracy</h4>
                                <ul className="space-y-2 text-sm">
                                    <li>• Standardowo 5 dni w tygodniu (pon–pt)</li>
                                    <li>• Możliwość pracy w soboty (dobrowolnie, wyżej płatne)</li>
                                    <li>• Nadgodziny płatne dodatkowo</li>
                                </ul>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Hammer size={18} className="text-slate-600"/> Sprzęt i warunki</h4>
                            <ul className="space-y-2 text-sm pl-2">
                                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Praca na profesjonalnych narzędziach (HILTI)</li>
                                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Odzież robocza dostosowana do warunków pogodowych</li>
                                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500"/> Realne warunki pracy na dużych inwestycjach</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Gift size={18} className="text-purple-600"/> Dodatkowe benefity</h4>
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">Multisport / MultiLife</span>
                                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">Szkolenia</span>
                                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">Elastyczny grafik</span>
                                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">Wyjazdy integracyjne</span>
                            </div>
                        </div>
                    </div>
                );
                break;
            case 'salary':
                title = 'System Wynagrodzeń';
                content = (
                    <div>
                        <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                            <button 
                                onClick={() => setSalaryTab('hourly')} 
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${salaryTab === 'hourly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Wynagrodzenie Godzinowe
                            </button>
                            <button 
                                onClick={() => setSalaryTab('piecework')} 
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${salaryTab === 'piecework' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Wynagrodzenie Akordowe
                            </button>
                        </div>

                        {salaryTab === 'hourly' ? (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
                                    <h4 className="font-bold text-blue-900">Jak liczymy Twoją stawkę godzinową</h4>
                                    <p className="text-sm text-blue-700 mt-1">Stawka NIE JEST UZNANIOWA. Każdy wpływa na swoją stawkę.</p>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <span className="text-sm text-slate-600">Bazowa stawka w MaxMaster:</span>
                                        <span className="font-bold text-lg text-slate-900">{systemConfig.baseRate} zł netto / godz.</span>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Do tej stawki doliczane są dodatki za konkretne umiejętności, potwierdzone testami teoretycznymi oraz (jeśli wymagane) praktyką na budowie.
                                    </p>
                                    
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-3">Przykład wyliczenia:</p>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between"><span>Baza</span> <span className="font-bold">{systemConfig.baseRate.toFixed(2).replace('.', ',')} zł</span></div>
                                            <div className="flex justify-between text-green-600"><span>+ LAN – sieci strukturalne</span> <span className="font-bold">+1,00 zł</span></div>
                                            <div className="flex justify-between text-green-600"><span>+ Montaż rozdzielnic</span> <span className="font-bold">+1,00 zł</span></div>
                                            <div className="flex justify-between text-purple-600"><span>+ SEP E</span> <span className="font-bold">+0,50 zł</span></div>
                                            <div className="border-t border-slate-300 my-2 pt-2 flex justify-between font-bold text-lg text-slate-900">
                                                <span>RAZEM:</span>
                                                <span>{(systemConfig.baseRate + 2.5).toFixed(2).replace('.', ',')} zł netto / godz.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg mb-6">
                                    <h4 className="font-bold text-green-900">Akord – zarabiasz za efekt, nie za czas</h4>
                                    <p className="text-sm text-green-700 mt-1">Możesz zarabiać WIĘCEJ niż na godzinach.</p>
                                </div>

                                <div className="space-y-4 text-sm text-slate-600">
                                    <p>W systemie akordowym wynagrodzenie zależy od:</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>ilości wykonanej pracy,</li>
                                        <li>jakości wykonania.</li>
                                    </ul>

                                    <h5 className="font-bold text-slate-800 mt-4">Przykłady rozliczeń:</h5>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-slate-400"/> montaż jednej lampy</li>
                                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-slate-400"/> wykonanie metra trasy kablowej</li>
                                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-slate-400"/> prefabrykacja rozdzielnicy</li>
                                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-slate-400"/> zakończony i poprawnie wykonany etap robót</li>
                                    </ul>

                                    <div className="mt-6 p-4 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                                        Jeśli pracujesz sprawnie, bez poprawek i zgodnie z dokumentacją – <strong>możesz zarabiać znacznie więcej niż w systemie godzinowym.</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
                break;
            case 'career':
                title = 'Rozwój Zawodowy';
                content = (
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 mb-6 text-center">Twoja ścieżka rozwoju w MaxMaster</h4>
                        
                        <div className="relative pl-8 space-y-6 mb-8 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {careerStepsData.map((item) => (
                                <div key={item.step} className="relative flex items-center">
                                    <div className={`absolute -left-8 w-8 h-8 rounded-full border-4 border-white shadow-sm flex items-center justify-center text-xs font-bold text-white ${item.color}`}>
                                        {item.step}
                                    </div>
                                    <span className="font-bold text-slate-800">{item.label}</span>
                                </div>
                            ))}
                            {careerStepsData.length === 0 && (
                                <p className="text-slate-400 italic text-sm">Brak zdefiniowanych kroków kariery.</p>
                            )}
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                            <p className="text-sm text-slate-600 mb-2">Każdy kolejny poziom oznacza:</p>
                            <ul className="text-sm space-y-1 pl-2">
                                <li className="flex items-center gap-2"><TrendingUp size={14} className="text-green-500"/> większą odpowiedzialność</li>
                                <li className="flex items-center gap-2"><TrendingUp size={14} className="text-green-500"/> większy wpływ</li>
                                <li className="flex items-center gap-2"><TrendingUp size={14} className="text-green-500"/> wyższe zarobki</li>
                                <li className="flex items-center gap-2"><TrendingUp size={14} className="text-green-500"/> dostęp do szkoleń i certyfikatów</li>
                            </ul>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h5 className="font-bold text-slate-800 text-sm mb-2">Jak awansować?</h5>
                                <ul className="text-xs text-slate-600 space-y-1">
                                    <li>• Zdajesz testy</li>
                                    <li>• Potwierdzasz umiejętności w praktyce</li>
                                    <li>• Budujesz doświadczenie</li>
                                    <li>• Otrzymujesz realne wsparcie firmy</li>
                                </ul>
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-800 text-sm mb-2">Szkolenia</h5>
                                <ul className="text-xs text-slate-600 space-y-1">
                                    <li>• SEP, UDT, specjalistyczne kursy</li>
                                    <li>• Dofinansowanie przez firmę</li>
                                    <li>• Rozwijasz się → zarabiasz więcej</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                );
                break;
        }

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={closeModal}>
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                        <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        {content}
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                        <Button onClick={closeModal}>Zamknij</Button>
                    </div>
                </div>
            </div>
        );
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
                                const isSelected = (currentUser.qualifications || []).includes(q.id);
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

    // --- VIEW: POST-TEST DASHBOARD ---
    if (isPostTestStage) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 pb-24" onClick={() => setIsContractPopoverOpen(false)}>
                <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Header */}
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            {currentUser.status === UserStatus.NOT_INTERESTED ? 'Dziękujemy za Twój czas' : `Cześć, ${currentUser.first_name}`}
                        </h1>
                        <p className="text-slate-500">
                            {currentUser.status === UserStatus.NOT_INTERESTED 
                                ? 'Twoja rezygnacja została odnotowana. Poniżej znajdziesz podsumowanie swoich wyników.'
                                : 'Poniżej widzisz symulację swojej stawki na podstawie zdanych testów.'}
                        </p>
                    </div>

                    {/* Scenario A: DATA REQUESTED - Job Offer Card */}
                    {(currentUser.status === UserStatus.DATA_REQUESTED || currentUser.status === UserStatus.OFFER_SENT) && (
                        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-8 rounded-2xl shadow-xl border border-green-400 animate-in zoom-in">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="bg-white/20 p-3 rounded-full flex-shrink-0">
                                    <CheckCircle size={36} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">Oferta Pracy!</h2>
                                    <p className="text-green-50 text-base leading-relaxed">
                                        Rozpatrzyliśmy Twoje wyniki i z przyjemnością proponujemy Ci pracę zgodnie z warunkami przedstawionymi powyżej.
                                        Aby rozpocząć z nami współpracę, uzupełnij swoje dane do umowy.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button
                                    className="flex-1 bg-white text-green-700 hover:bg-green-50 border-0 shadow-lg font-bold text-base h-14"
                                    onClick={() => navigate('/candidate/profile')}
                                >
                                    Uzupełnij dane do umowy
                                    <ArrowRight size={20} className="ml-2" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 font-medium h-14"
                                    onClick={handleDeclineOffer}
                                >
                                    Rezygnuję
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Scenario A: DATA SUBMITTED - Confirmation */}
                    {currentUser.status === UserStatus.DATA_SUBMITTED && (
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 flex items-center gap-4 animate-in zoom-in shadow-md">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-blue-800">Dziękujemy za przekazane dane!</h3>
                                <p className="text-blue-700">Przygotujemy umowę i skontaktujemy się z Tobą wkrótce w sprawie dalszych kroków.</p>
                            </div>
                        </div>
                    )}

                    {/* 1. Salary Simulation Block (Reused Formula) */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* BAZA */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-slate-500 mb-2 font-medium uppercase text-xs tracking-wider">
                                    <Wallet size={16} /> Baza
                                </div>
                                <div className="text-3xl font-bold text-slate-900">{systemConfig.baseRate} zł</div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Podstawa.</p>
                        </div>

                        {/* UMIEJĘTNOŚCI (Real Result) */}
                        <div className={`p-5 rounded-xl shadow-sm border flex flex-col justify-between ${skillsBonus > 0 ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                            <div>
                                <div className="flex items-center gap-2 text-slate-500 mb-2 font-medium uppercase text-xs tracking-wider">
                                    <Award size={16} /> Umiejętności
                                </div>
                                <div className="text-3xl font-bold text-green-600">+{skillsBonus} zł</div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Wynik z testów.</p>
                        </div>

                        {/* UPRAWNIENIA (NEW) */}
                        <div 
                            className={`p-5 rounded-xl shadow-sm border flex flex-col justify-between transition-all ${isLocked ? 'cursor-default opacity-80' : 'cursor-pointer hover:shadow-md hover:border-purple-300'} ${qualBonus > 0 ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}
                            onClick={() => !isLocked && setIsQualModalOpen(true)}
                        >
                            <div>
                                <div className="flex items-center gap-2 text-slate-500 mb-2 font-medium uppercase text-xs tracking-wider">
                                    <Shield size={16} /> Uprawnienia
                                </div>
                                <div className={`text-3xl font-bold flex items-center ${qualBonus > 0 ? 'text-purple-600' : 'text-slate-300'}`}>
                                    +{qualBonus} zł {!isLocked && <ChevronRight size={20} className={`ml-auto ${qualBonus > 0 ? 'text-purple-400' : 'text-slate-300'}`} />}
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">{isLocked ? 'Zablokowane.' : 'Kliknij, aby dodać.'}</p>
                        </div>

                        {/* FORMA ZATRUDNIENIA - CUSTOM DROPDOWN (matching HR) */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between relative">
                            <div 
                                className={`cursor-pointer ${isLocked ? 'cursor-default' : 'hover:bg-slate-50'} transition-colors rounded-lg -m-2 p-2`}
                                onClick={(e) => { 
                                    if (isLocked) return;
                                    e.stopPropagation(); 
                                    setIsContractPopoverOpen(!isContractPopoverOpen); 
                                }}
                            >
                                <div className="flex items-center gap-2 text-slate-500 mb-2 font-medium uppercase text-xs tracking-wider">
                                    <FileText size={16} /> Forma Umowy
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="text-xl font-bold text-blue-600 uppercase flex items-center gap-1">
                                        {CONTRACT_TYPE_LABELS[selectedContract as ContractType] || selectedContract || 'Wybierz'}
                                        {!isLocked && <ChevronDown size={16} className="text-blue-400" />}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-0.5 mt-1">
                                    <div className="text-sm font-bold text-blue-400">
                                        {contractBonus > 0 ? `+${contractBonus} zł` : '+0 zł'}
                                    </div>
                                    {isStudent && selectedContract === 'uz' && (
                                        <div className="text-xs font-bold text-indigo-500 flex items-center gap-1">
                                            <GraduationCap size={12} />
                                            Student +{systemConfig.studentBonus} zł
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isContractPopoverOpen && (
                                <div 
                                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl z-[200] py-1 flex flex-col animate-in slide-in-from-top-2 duration-200 overflow-hidden"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {Object.entries(systemConfig.contractBonuses).map(([type, bonus]) => (
                                        <button 
                                            key={type} 
                                            className="px-4 py-3 text-[11px] font-bold text-left hover:bg-blue-50 text-slate-700 transition-colors flex justify-between items-center" 
                                            onClick={() => handleContractClick(type)}
                                        >
                                            <span className="uppercase">{CONTRACT_TYPE_LABELS[type as ContractType] || type}</span>
                                            <span className="text-blue-500 font-black">+{bonus} zł</span>
                                        </button>
                                    ))}
                                    {selectedContract === 'uz' && (
                                        <>
                                            <div className="border-t border-slate-100 my-1"></div>
                                            <div className="px-4 py-2 flex items-center justify-between bg-slate-50/50">
                                                <span className="text-[9px] font-black text-slate-400 uppercase">Student &lt; 26 lat</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-indigo-600">+{systemConfig.studentBonus} zł</span>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isStudent} 
                                                        onChange={(e) => setIsStudent(e.target.checked)}
                                                        className="w-4 h-4 text-blue-600 rounded cursor-pointer" 
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-slate-400 mt-2">{isLocked ? 'Wybrano.' : 'Twój wybór.'}</p>
                        </div>

                        {/* TOTAL */}
                        <div className="bg-slate-900 p-5 rounded-xl shadow-lg border border-slate-800 flex flex-col justify-between text-white">
                            <div>
                                <div className="flex items-center gap-2 text-slate-400 mb-2 font-medium uppercase text-xs tracking-wider">
                                    <Calculator size={16} /> Twoja Stawka
                                </div>
                                <div className="text-4xl font-bold">{totalRate.toFixed(2)} zł<span className="text-lg text-slate-400 font-normal">/h</span></div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">To jest symulacja. Finalna stawka może wejść od następnego miesiąca po potwierdzeniach.</p>
                        </div>
                    </div>

                    {/* Motivational Block - Under Rate */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-4 mt-2">
                        <div className="bg-white p-2 rounded-full text-blue-600 shadow-sm flex-shrink-0">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-900 text-sm mb-1">To nie koniec Twoich możliwości!</h4>
                            <p className="text-sm text-blue-800 leading-relaxed">
                                Niezależnie od obecnych wyników, w każdej chwili możesz podnieść swoją stawkę. 
                                Wystarczy, że zdobędziesz nowe umiejętności i potwierdzisz je weryfikacją w trakcie pracy.
                                System pozwala na ciągły rozwój i awans.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* LEFT COLUMN: Monthly Salary Simulator (Accordion) */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
                            <button 
                                onClick={() => setShowSalarySim(!showSalarySim)}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
                            >
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Wallet size={20} className="text-green-600"/> Ile zarobię w miesiącu?
                                </h3>
                                {showSalarySim ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                            </button>

                            {showSalarySim && (
                                <div className="border-t border-slate-100">
                                    <div className="p-6 bg-slate-50">
                                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                                            Standardowy grafik pracy 7:00-17:00 pn-pt. Możliwość pracy w większym wymiarze godzin oraz w soboty (dla chętnych).
                                        </p>
                                        <div className="grid grid-cols-1 gap-2 text-xs mb-6">
                                            <div className="bg-white p-2 rounded border border-slate-200 shadow-sm flex items-center gap-2">
                                                <span className="font-bold text-blue-600 w-16 text-right">+{systemConfig.overtimeBonus} zł/h</span> Nadgodziny (powyżej 8h)
                                            </div>
                                            <div className="bg-white p-2 rounded border border-slate-200 shadow-sm flex items-center gap-2">
                                                <span className="font-bold text-blue-600 w-16 text-right">+{systemConfig.holidayBonus} zł/h</span> Weekend (Soboty/Niedziele)
                                            </div>
                                            <div className="bg-white p-2 rounded border border-slate-200 shadow-sm flex items-center gap-2">
                                                <span className="font-bold text-blue-600 w-16 text-right">+{systemConfig.seniorityBonus} zł/h</span> Staż pracy (co rok)
                                            </div>
                                        </div>
                                        
                                        {/* Toggles */}
                                        <div className="flex flex-wrap gap-4 mb-4">
                                            {/* Delegation Toggle */}
                                            <div className="flex items-center gap-3 bg-blue-100 p-2 px-3 rounded-lg border border-blue-200 w-fit">
                                                <MapPin size={16} className="text-blue-600"/>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-bold text-blue-400">Dodatek</span>
                                                    <span className="text-xs font-bold text-blue-800">Delegacja (+{systemConfig.delegationBonus} zł)</span>
                                                </div>
                                                <button 
                                                    onClick={() => setIsDelegation(!isDelegation)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ml-2 ${isDelegation ? 'bg-blue-600' : 'bg-slate-300'}`}
                                                >
                                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isDelegation ? 'translate-x-5' : 'translate-x-1'}`} />
                                                </button>
                                            </div>

                                            {/* Saturday Toggle */}
                                            <div className="flex items-center gap-3 bg-orange-100 p-2 px-3 rounded-lg border border-orange-200 w-fit">
                                                <Calendar size={16} className="text-orange-600"/>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-bold text-orange-400">Czas pracy</span>
                                                    <span className="text-xs font-bold text-orange-800">Soboty (+{systemConfig.holidayBonus} zł)</span>
                                                </div>
                                                <button 
                                                    onClick={() => setIsSaturday(!isSaturday)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ml-2 ${isSaturday ? 'bg-orange-600' : 'bg-slate-300'}`}
                                                >
                                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isSaturday ? 'translate-x-5' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-4">Wariant</th>
                                                <th className="px-6 py-4">Godziny</th>
                                                <th className="px-6 py-4 text-right">Wypłata Netto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {monthlySimulations.map((sim, index) => (
                                                <tr key={index} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4 font-medium text-slate-800">{sim.label}</td>
                                                    <td className="px-6 py-4 text-slate-500">{sim.hours} h</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-xl font-bold text-green-600">{sim.amount.toLocaleString()} zł</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Benefits Accordion */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
                            <button 
                                onClick={() => setShowBenefits(!showBenefits)}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
                            >
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Gift size={20} className="text-purple-600"/> A co poza wynagrodzeniem?
                                </h3>
                                {showBenefits ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                            </button>
                            
                            {showBenefits && (
                                <div className="border-t border-slate-100">
                                    <div className="flex border-b border-slate-100">
                                        <button 
                                            onClick={() => setBenefitTab('career')}
                                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${benefitTab === 'career' ? 'border-purple-600 text-purple-600 bg-purple-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Kariera
                                        </button>
                                        <button 
                                            onClick={() => setBenefitTab('dev')}
                                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${benefitTab === 'dev' ? 'border-purple-600 text-purple-600 bg-purple-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Rozwój
                                        </button>
                                        <button 
                                            onClick={() => setBenefitTab('benefits')}
                                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${benefitTab === 'benefits' ? 'border-purple-600 text-purple-600 bg-purple-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Benefity
                                        </button>
                                    </div>
                                    <div className="p-6">
                                        {benefitTab === 'career' && (
                                            <div className="space-y-4">
                                                <p className="text-sm text-slate-600 mb-4 font-medium">Jasna ścieżka awansu w MaxMaster:</p>
                                                <div className="flex flex-col gap-3 relative">
                                                    {/* Vertical connecting line */}
                                                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200"></div>
                                                    
                                                    {careerStepsData.map((item) => (
                                                        <div key={item.step} className="flex items-center gap-4 relative z-10">
                                                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shadow-sm transition-all duration-300 ${item.color} border-white text-white`}>
                                                                {item.step}
                                                            </div>
                                                            <span className="font-medium text-slate-600">{item.label}</span>
                                                        </div>
                                                    ))}
                                                    {careerStepsData.length === 0 && (
                                                        <p className="text-slate-400 italic text-sm">Brak zdefiniowanych kroków kariery.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {benefitTab === 'dev' && (
                                            <div className="space-y-4">
                                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                                                    <Coins size={16} className="text-yellow-500"/> Finansujemy szkolenia
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    <div className="flex flex-col p-3 bg-slate-50 border border-slate-100 rounded-lg text-center justify-center h-24">
                                                        <span className="font-bold text-slate-800">LAN</span>
                                                        <span className="text-[10px] text-slate-500">Sieci strukturalne</span>
                                                    </div>
                                                    <div className="flex flex-col p-3 bg-slate-50 border border-slate-100 rounded-lg text-center justify-center h-24">
                                                        <span className="font-bold text-slate-800">CCTV</span>
                                                        <span className="text-[10px] text-slate-500">Monitoring wizyjny</span>
                                                    </div>
                                                    <div className="flex flex-col p-3 bg-slate-50 border border-slate-100 rounded-lg text-center justify-center h-24">
                                                        <span className="font-bold text-slate-800">Światłowody</span>
                                                        <span className="text-[10px] text-slate-500">Spawanie</span>
                                                    </div>
                                                    <div className="flex flex-col p-3 bg-slate-50 border border-slate-100 rounded-lg text-center justify-center h-24">
                                                        <span className="font-bold text-slate-800">PPOŻ</span>
                                                        <span className="text-[10px] text-slate-500">Systemy PPOŻ</span>
                                                    </div>
                                                    <div className="flex flex-col p-3 bg-slate-50 border border-slate-100 rounded-lg text-center justify-center h-24">
                                                        <span className="font-bold text-slate-800">SSWiN</span>
                                                        <span className="text-[10px] text-slate-500">Alarmy</span>
                                                    </div>
                                                    <div className="flex flex-col p-3 bg-slate-50 border border-slate-100 rounded-lg text-center justify-center h-24">
                                                        <span className="font-bold text-slate-800">KD</span>
                                                        <span className="text-[10px] text-slate-500">Kontrola dostępu</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {benefitTab === 'benefits' && (
                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="flex gap-3 p-2 items-center bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="bg-white p-2 rounded shadow-sm h-fit text-blue-600"><Shirt size={18}/></div>
                                                    <div className="text-sm font-medium text-slate-700">Markowa odzież robocza</div>
                                                </div>
                                                <div className="flex gap-3 p-2 items-center bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="bg-white p-2 rounded shadow-sm h-fit text-orange-600"><Hammer size={18}/></div>
                                                    <div className="text-sm font-medium text-slate-700">Własne narzędzia pracy</div>
                                                </div>
                                                <div className="flex gap-3 p-2 items-center bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="bg-white p-2 rounded shadow-sm h-fit text-red-500"><Shield size={18}/></div>
                                                    <div className="text-sm font-medium text-slate-700">Pakiet Socjalny (Med/Sport)</div>
                                                </div>
                                                <div className="flex gap-3 p-2 items-center bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="bg-white p-2 rounded shadow-sm h-fit text-purple-500"><PartyPopper size={18}/></div>
                                                    <div className="text-sm font-medium text-slate-700">Integracje firmowe</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Decision Block (Initial) */}
                    {currentUser.status === UserStatus.TESTS_COMPLETED && (
                        <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-2xl shadow-xl border border-blue-100 text-center space-y-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-blue-100 rounded-full opacity-50 blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-purple-100 rounded-full opacity-50 blur-3xl"></div>
                            
                            <div className="relative z-10">
                                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Jaka jest Twoja decyzja?</h2>
                                <p className="text-slate-600 max-w-lg mx-auto mb-8">
                                    Widzisz swoją stawkę i możliwości rozwoju. Jeśli warunki Ci odpowiadają, daj nam znać, a HR przygotuje umowę.
                                </p>
                                
                                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                                    <button 
                                        onClick={handleInterested}
                                        className="group relative flex items-center gap-4 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-105"
                                    >
                                        <div className="bg-white/20 p-2 rounded-lg">
                                            <ThumbsUp size={24} className="text-white fill-white/20"/>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs uppercase font-bold text-blue-100 tracking-wider">Chcę dołączyć</div>
                                            <div className="text-lg font-bold">Jestem zainteresowany</div>
                                        </div>
                                        <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform opacity-70"/>
                                    </button>

                                    <button 
                                        onClick={handleResign}
                                        className="group flex items-center gap-3 px-6 py-4 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <span className="font-medium group-hover:underline">Rezygnuję z procesu</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentUser.status === UserStatus.INTERESTED && (
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 flex items-center gap-4 animate-in zoom-in">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-blue-800">Dziękujemy!</h3>
                                <p className="text-blue-700">Twój akces został zgłoszony. Nasz dział HR skontaktuje się z Tobą wkrótce.</p>
                            </div>
                        </div>
                    )}

                    {/* 3. Results Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-slate-800">Twoje Wyniki</h3>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">Umiejętność</th>
                                    <th className="px-6 py-4">Kryterium</th>
                                    <th className="px-6 py-4">Dodatek do stawki</th>
                                    <th className="px-6 py-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {passedAttempts.map(ta => {
                                    const test = tests.find(t => t.id === ta.test_id);
                                    const skill = skills.find(s => s.id === test?.skill_ids[0]);
                                    
                                    if (!test || !skill) return null;

                                    return (
                                        <tr key={ta.id} className={ta.passed ? 'bg-green-50/30' : 'bg-yellow-50/30'}>
                                            <td className="px-6 py-4 font-medium text-slate-900">{skill.name_pl}</td>
                                            <td className="px-6 py-4 text-slate-600 text-xs">
                                                {skill.criteria && skill.criteria.length > 0 ? (
                                                    <ul className="list-disc pl-3 m-0">
                                                        {skill.criteria.map((c, idx) => (
                                                            <li key={idx}>{c}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span>{skill.description_pl || '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`font-bold ${ta.passed ? 'text-green-600' : 'text-slate-400 line-through'}`}>
                                                    +{skill.hourly_bonus} zł/h
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${ta.passed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {ta.passed ? 'Zaliczono' : 'Nie zaliczono'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {passedAttempts.length === 0 && (
                                    <tr><td colSpan={4} className="p-6 text-center text-slate-400">Brak wyników testów.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
                {renderQualModal()}
            </div>
        );
    }

    // --- VIEW: PRE-TEST DASHBOARD (Existing) ---
    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8" onClick={() => setIsContractPopoverOpen(false)}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoTile type="about" label="O MaxMaster" icon={Building} colorClass="bg-blue-100 text-blue-600"/>
                <InfoTile type="conditions" label="Warunki Pracy" icon={Briefcase} colorClass="bg-green-100 text-green-600"/>
                <InfoTile type="salary" label="System Wynagrodzeń" icon={Coins} colorClass="bg-yellow-100 text-yellow-600"/>
                <InfoTile type="career" label="Rozwój Zawodowy" icon={TrendingUp} colorClass="bg-purple-100 text-purple-600"/>
            </div>

            {showEstimateBanner && !hasIncompleteTests && (
                <div className="bg-slate-900 rounded-xl p-8 text-white shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-700">
                        <Calculator size={160} />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <h2 className="text-2xl font-bold mb-4">Ile możesz zarobić w MaxMaster?</h2>
                        <p className="text-blue-200 mb-8 text-lg">
                            Na początek sprawdź swoją stawkę godzinową na podstawie tego, co już potrafisz.
                            Wybierz swoje umiejętności z listy, a system wyliczy Twoją ofertę.
                        </p>
                        <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-xl shadow-blue-900/50" onClick={() => navigate('/candidate/simulation')}>
                            Poznaj swoją stawkę – wybierz umiejętności
                            <ArrowRight size={20} className="ml-2" />
                        </Button>
                    </div>
                </div>
            )}

            {showEstimateBanner && hasIncompleteTests && (
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-8 text-white shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-10 -translate-y-10">
                        <Zap size={160} />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Star size={28} className="text-yellow-300 fill-yellow-300" />
                            </div>
                            <h2 className="text-2xl font-bold">Jeszcze trochę Ci zostało!</h2>
                        </div>
                        <p className="text-blue-100 mb-6 text-lg leading-relaxed">
                            Świetnie zacząłeś! Dokończ testy weryfikacyjne, żeby poznać swoją pełną stawkę
                            i dowiedzieć się, ile możesz zarabiać w MaxMaster. <strong className="text-white">Już prawie jesteś na mecie!</strong>
                        </p>
                        <Button
                            variant="custom"
                            size="lg"
                            className="bg-white text-blue-600 hover:bg-blue-50 border-0 shadow-xl font-bold"
                            onClick={() => navigate('/candidate/tests')}
                        >
                            Kontynuuj weryfikację umiejętności
                            <ArrowRight size={20} className="ml-2" />
                        </Button>
                    </div>
                </div>
            )}

            {renderModalContent()}
            {renderQualModal()}
        </div>
    );
};
