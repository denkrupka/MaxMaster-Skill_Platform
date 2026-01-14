
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Lock, CheckCircle, Clock, Play, AlertCircle, Info, User, Briefcase, Phone, Mail, X, BookOpen, Award, Star, Eye, HardHat } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { calculateSalary } from '../../services/salaryService';
import { SkillStatus, ContractType, VerificationType, Role } from '../../types';
import { CONTRACT_TYPE_LABELS } from '../../constants';
import { Button } from '../../components/Button';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

export const EmployeeDashboard = () => {
    const { state } = useAppContext();
    const { currentUser, userSkills, skills, systemConfig, monthlyBonuses, tests, testAttempts, qualityIncidents, libraryResources, employeeBadges } = state;
    const navigate = useNavigate();
    
    // UI States
    const [breakdownType, setBreakdownType] = useState<'current' | 'potential' | null>(null);
    const [showContactModal, setShowContactModal] = useState<{type: 'brigadir' | 'hr' | 'coordinator', user: any} | null>(null);
    const [isQualityOpen, setIsQualityOpen] = useState(false);
    const [selectedQualitySkillId, setSelectedQualitySkillId] = useState<string | null>(null);
    
    // File Viewer State
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    if (!currentUser) return null;

    // --- HELPER DATA ---
    const brigadir = state.users.find(u => u.id === currentUser.assigned_brigadir_id);
    const hrContact = state.users.find(u => u.role === Role.HR);
    const coordinator = state.users.find(u => u.role === Role.COORDINATOR);

    // --- LOGIC: DATE CONTEXT ---
    const now = new Date();
    const currentMonthName = now.toLocaleString('pl-PL', { month: 'long' });
    const nextMonthName = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleString('pl-PL', { month: 'long' });

    // --- LOGIC: SALARY ---
    const salaryInfo = calculateSalary(
        currentUser.base_rate || systemConfig.baseRate,
        skills,
        userSkills.filter(us => us.user_id === currentUser.id),
        monthlyBonuses[currentUser.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
        now,
        qualityIncidents // PASS QUALITY INCIDENTS
    );

    const contractBonus = systemConfig.contractBonuses[currentUser.contract_type || ContractType.UOP] || 0;
    const studentBonus = (currentUser.contract_type === ContractType.UZ && currentUser.is_student) ? 3 : 0;
    const totalExtras = contractBonus + studentBonus;

    const currentTotalRate = salaryInfo.total + totalExtras;
    const nextMonthTotalRate = salaryInfo.nextMonthTotal + totalExtras;

    // --- HELPER: Cooldown Calculation ---
    const getCooldown = (testId: string) => {
        const attempts = testAttempts
            .filter(ta => ta.user_id === currentUser.id && ta.test_id === testId)
            .sort((a,b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
        
        const lastAttempt = attempts[0];
        
        if (lastAttempt && !lastAttempt.passed) {
            const lastDate = new Date(lastAttempt.completed_at);
            const unlockDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000); // 24h lockout
            
            if (now < unlockDate) {
                const diffMs = unlockDate.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                return { isLocked: true, hours, minutes };
            }
        }
        return { isLocked: false, hours: 0, minutes: 0 };
    };

    // --- LOGIC: TASKS (Section D) ---
    const practiceTasks = userSkills
        .filter(us => {
            if (us.user_id !== currentUser.id) return false;
            const skill = skills.find(s => s.id === us.skill_id);
            if (!skill) return false;

            const isPendingPractice = skill.verification_type === VerificationType.THEORY_PRACTICE && 
                                     (us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING);
            return isPendingPractice;
        })
        .map(us => {
            const skill = skills.find(s => s.id === us.skill_id);
            return { 
                type: 'practice', 
                title: skill?.name_pl, 
                id: us.skill_id,
                isLocked: false,
                cooldownText: ''
            };
        });

    const failedOrResetTests = tests
        .filter(t => t.is_active && !t.is_archived)
        .filter(t => {
            const skillId = t.skill_ids[0];
            const us = userSkills.find(u => u.user_id === currentUser.id && u.skill_id === skillId);
            
            if (us?.status === SkillStatus.FAILED) return true;
            const hasAttempts = testAttempts.some(ta => ta.user_id === currentUser.id && ta.test_id === t.id);
            if (us?.status === SkillStatus.PENDING && hasAttempts) return true;

            return false;
        })
        .map(t => {
            const cooldown = getCooldown(t.id);
            return { 
                type: 'test', 
                title: t.title, 
                id: t.id,
                isLocked: cooldown.isLocked,
                cooldownText: cooldown.isLocked ? `${cooldown.hours}h ${cooldown.minutes}m` : ''
            };
        });

    const tasks = [...practiceTasks, ...failedOrResetTests].slice(0, 5);

    // --- LOGIC: QUALITY WARNINGS & INCIDENTS ---
    const affectedSkills = skills.map(skill => {
        const userSkill = userSkills.find(us => us.user_id === currentUser.id && us.skill_id === skill.id);
        
        if (!userSkill || userSkill.status !== SkillStatus.CONFIRMED) {
            return null;
        }

        const incidents = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === currentUser.id && 
                   inc.skill_id === skill.id && 
                   d.getMonth() === now.getMonth() && 
                   d.getFullYear() === now.getFullYear();
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        if (incidents.length === 0) return null;
        
        const isBlocked = incidents.length >= 2;
        return {
            skill,
            incidents,
            count: incidents.length,
            isBlocked,
            penalty: skill.hourly_bonus
        };
    }).filter(Boolean);

    // --- LOGIC: BADGES ---
    const myBadges = employeeBadges
        .filter(b => b.employee_id === currentUser.id && b.visible_to_employee)
        .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3); // Last 3 badges

    const openImagePreview = (url: string) => {
        setFileViewer({
            isOpen: true,
            urls: [url],
            title: 'Dowód Zgłoszenia',
            index: 0
        });
    };

    // --- RENDER MODALS ---

    const renderBreakdownModal = () => {
        if (!breakdownType) return null;
        
        const title = breakdownType === 'current' ? `Skład Stawki (Bieżący: ${currentMonthName})` : `Prognoza Stawki (Od 1. ${nextMonthName})`;
        const total = breakdownType === 'current' ? currentTotalRate : nextMonthTotalRate;
        
        const activeItems = salaryInfo.breakdown.details.activeSkills;
        const pendingItems = salaryInfo.breakdown.details.pendingSkills;

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setBreakdownType(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                        <h3 className="font-bold text-slate-900">{title}</h3>
                        <button onClick={() => setBreakdownType(null)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="flex justify-between items-center p-2 rounded bg-white border border-slate-100">
                            <div>
                                <div className="font-medium text-sm text-slate-800">Stawka Bazowa</div>
                                <div className="text-xs text-slate-500">Podstawa</div>
                            </div>
                            <div className="font-bold text-slate-900">+{salaryInfo.breakdown.base.toFixed(2)} zł</div>
                        </div>

                        {totalExtras > 0 && (
                            <div className="flex justify-between items-center p-2 rounded bg-white border border-slate-100">
                                <div>
                                    <div className="font-medium text-sm text-slate-800">Umowa</div>
                                    <div className="text-xs text-blue-600 font-bold">{CONTRACT_TYPE_LABELS[currentUser.contract_type || ContractType.UOP]}</div>
                                </div>
                                <div className="font-bold text-blue-600">+{totalExtras.toFixed(2)} zł</div>
                            </div>
                        )}

                        <div className="mt-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Umiejętności</h4>
                            {breakdownType === 'current' ? (
                                activeItems.map((item, idx) => (
                                    <div key={idx} className={`flex justify-between items-center p-2 rounded ${item.isBlocked ? 'bg-red-50' : 'bg-white border border-slate-100'}`}>
                                        <div>
                                            <div className={`font-medium text-sm ${item.isBlocked ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{item.name}</div>
                                            {item.isBlocked && <div className="text-xs text-red-600 font-bold">Blokada jakościowa</div>}
                                        </div>
                                        <div className={`font-bold ${item.isBlocked ? 'text-slate-400 line-through' : 'text-green-600'}`}>+{item.amount.toFixed(2)} zł</div>
                                    </div>
                                ))
                            ) : (
                                <>
                                    {activeItems.map((item, idx) => (
                                        <div key={`act-${idx}`} className="flex justify-between items-center p-2 rounded bg-white border border-slate-100">
                                            <div className="font-medium text-sm text-slate-800">{item.name}</div>
                                            <div className="font-bold text-green-600">+{item.amount.toFixed(2)} zł</div>
                                        </div>
                                    ))}
                                    {pendingItems.map((item, idx) => (
                                        <div key={`pen-${idx}`} className="flex justify-between items-center p-2 rounded bg-blue-50 border border-blue-100">
                                            <div>
                                                <div className="font-medium text-sm text-slate-800">{item.name}</div>
                                                <div className="text-xs text-blue-600 font-bold">Nowa (od 1. {nextMonthName})</div>
                                            </div>
                                            <div className="font-bold text-blue-600">+{item.amount.toFixed(2)} zł</div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-slate-500 text-sm font-medium">Razem:</span>
                        <span className="text-2xl font-bold text-blue-600">{total.toFixed(2)} zł</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderContactModal = () => {
        if (!showContactModal) return null;
        const { type, user } = showContactModal;
        const title = type === 'brigadir' ? 'Twój Brygadzista' : type === 'coordinator' ? 'Twój Koordynator' : 'Twój Opiekun HR';

        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowContactModal(null)}>
                <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold mx-auto mb-4">
                        {user ? `${user.first_name[0]}${user.last_name[0]}` : <User size={32}/>}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1">{title}</h3>
                    {user ? (
                        <>
                            <p className="text-slate-600 font-medium mb-4">{user.first_name} {user.last_name}</p>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-center gap-2 p-2 bg-slate-50 rounded">
                                    <Phone size={16} className="text-blue-500"/>
                                    <a href={`tel:${user.phone}`} className="font-bold text-slate-800 hover:text-blue-600">{user.phone || 'Brak numeru'}</a>
                                </div>
                                <div className="flex items-center justify-center gap-2 p-2 bg-slate-50 rounded">
                                    <Mail size={16} className="text-blue-500"/>
                                    <a href={`mailto:${user.email}`} className="font-medium text-slate-800 hover:text-blue-600">{user.email}</a>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-slate-500">Brak przypisanej osoby.</p>
                    )}
                    <div className="mt-6">
                        <Button fullWidth onClick={() => setShowContactModal(null)}>Zamknij</Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderQualityDetailModal = () => {
        if (!selectedQualitySkillId) return null;
        const data = affectedSkills.find(d => d && d.skill.id === selectedQualitySkillId);
        if (!data) return null;

        const relatedResources = libraryResources.filter(r => r.skill_ids.includes(data.skill.id) && !r.is_archived);

        return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedQualitySkillId(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <AlertTriangle size={24} className={data.isBlocked ? 'text-red-500' : 'text-yellow-500'}/>
                            Szczegóły Incydentu
                        </h3>
                        <button onClick={() => setSelectedQualitySkillId(null)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    
                    <div className="overflow-y-auto pr-2 space-y-6">
                        <div className={`p-4 rounded-xl border ${data.isBlocked ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                            <h4 className={`font-bold text-lg mb-1 ${data.isBlocked ? 'text-red-700' : 'text-yellow-800'}`}>
                                {data.isBlocked ? 'Dodatek Zablokowany' : 'Ostrzeżenie'}
                            </h4>
                            <p className={`text-sm ${data.isBlocked ? 'text-red-600' : 'text-yellow-700'}`}>
                                {data.isBlocked 
                                    ? `Niestety, z powodu ${data.count} incydentów, dodatek za tę umiejętność (-${data.penalty} zł/h) został wstrzymany w tym miesiącu.` 
                                    : `To jest pierwsze zgłoszenie. Kolejny błąd spowoduje utratę dodatku w tym miesiącu.`
                                }
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase">Zgłoszone uwagi</h4>
                            <div className="space-y-4">
                                {data.incidents.map((inc, idx) => (
                                    <div key={inc.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                                        <div className="flex justify-between text-xs text-slate-400 mb-2">
                                            <span>{new Date(inc.date).toLocaleDateString()} {new Date(inc.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            <span>Zgłosił: {inc.reported_by}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 font-medium mb-2">{inc.description}</p>
                                        {inc.image_url && (
                                            <div className="mt-2 rounded-lg overflow-hidden border border-slate-100 relative group cursor-pointer" onClick={() => openImagePreview(inc.image_url!)}>
                                                <img src={inc.image_url} alt="Dowód błędu" className="w-full h-40 object-cover" />
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="bg-white/90 p-2 rounded-full shadow-lg">
                                                        <Eye size={20} className="text-slate-700"/>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {data.isBlocked && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex items-start gap-3 mb-3">
                                    <TrendingUp size={24} className="text-blue-600 mt-1"/>
                                    <div>
                                        <h4 className="font-bold text-blue-900">Nie poddawaj się!</h4>
                                        <p className="text-sm text-blue-700">Każdemu zdarzają się błędy. Ważne, aby wyciągnąć z nich wnioski. W przyszłym miesiącu Twoja stawka wróci do normy, jeśli poprawisz jakość.</p>
                                    </div>
                                </div>
                                
                                {relatedResources.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-blue-200">
                                        <h5 className="text-xs font-bold text-blue-800 uppercase mb-2">Materiały, które mogą Ci pomóc:</h5>
                                        <div className="space-y-2">
                                            {relatedResources.map(res => (
                                                <a 
                                                    key={res.id} 
                                                    href={res.url} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 bg-white p-2 rounded border border-blue-200 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                                                >
                                                    <BookOpen size={14}/> {res.title}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                        <Button onClick={() => setSelectedQualitySkillId(null)}>Rozumiem</Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 pb-24">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Panel Pracownika</h1>
                    <p className="text-slate-500">Witaj, {currentUser.first_name}. Twoje finanse i zadania.</p>
                </div>
                
                {/* Contact Buttons */}
                <div className="flex gap-3">
                    {/* New Coordinator Button for regular Employee */}
                    {currentUser.role === Role.EMPLOYEE && (
                        <button 
                            onClick={() => setShowContactModal({type: 'coordinator', user: coordinator})}
                            className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                        >
                            <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                                <HardHat size={18} />
                            </div>
                            <div className="text-left hidden sm:block">
                                <span className="block text-slate-500 text-[10px] uppercase font-bold">Twój Koordynator</span>
                                <span className="font-bold text-slate-800 text-sm leading-tight">{coordinator ? `${coordinator.first_name} ${coordinator.last_name}` : 'Brak'}</span>
                            </div>
                        </button>
                    )}

                    <button 
                        onClick={() => setShowContactModal({type: 'brigadir', user: brigadir})}
                        className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                            <User size={18} />
                        </div>
                        <div className="text-left hidden sm:block">
                            <span className="block text-slate-500 text-[10px] uppercase font-bold">
                                {currentUser.role === Role.BRIGADIR ? 'Twój Koordynator' : 'Twój Brygadzista'}
                            </span>
                            <span className="font-bold text-slate-800 text-sm leading-tight">{brigadir ? `${brigadir.first_name} ${brigadir.last_name}` : 'Brak'}</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => setShowContactModal({type: 'hr', user: hrContact})}
                        className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                        <div className="bg-purple-100 p-2 rounded-full text-purple-600">
                            <Briefcase size={18} />
                        </div>
                        <div className="text-left hidden sm:block">
                            <span className="block text-slate-500 text-[10px] uppercase font-bold">Twój HR</span>
                            <span className="font-bold text-slate-800 text-sm leading-tight">{hrContact ? `${hrContact.first_name} ${hrContact.last_name}` : 'HR Team'}</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* BADGES SECTION */}
            {myBadges.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-xl border border-yellow-200 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                        <Star className="fill-yellow-500 text-yellow-600"/> Twoje Wyróżnienia (Ostatnie)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {myBadges.map(badge => (
                            <div key={badge.id} className="bg-white p-3 rounded-lg shadow-sm border border-yellow-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase">{badge.month}</div>
                                        <div className="font-bold text-slate-800">{badge.type}</div>
                                    </div>
                                    <Award size={20} className="text-yellow-500"/>
                                </div>
                                <p className="text-xs text-slate-600 mt-2 italic">"{badge.description}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTIONS A & B: RATES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* SECTION A: CURRENT RATE */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between relative overflow-hidden group hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start z-10">
                        <div>
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                                <Wallet size={18} className="text-slate-400"/> Aktualna Stawka
                            </h2>
                            <span className="text-xs text-slate-400 font-medium">Bieżący miesiąc ({currentMonthName})</span>
                        </div>
                    </div>
                    <div className="mt-4 z-10">
                        <div className="text-4xl font-bold text-slate-900">
                            {currentTotalRate.toFixed(2)} zł<span className="text-lg font-normal text-slate-400">/h</span>
                        </div>
                        <button 
                            onClick={() => setBreakdownType('current')}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 mt-2"
                        >
                            <Info size={12}/> Pokaż skład stawki
                        </button>
                    </div>
                </div>

                {/* SECTION B: PROJECTED RATE */}
                <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-6 flex flex-col justify-between relative overflow-hidden text-white">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <TrendingUp size={120} />
                    </div>
                    <div className="flex justify-between items-start z-10">
                        <div>
                            <h2 className="text-sm font-bold text-blue-300 uppercase tracking-wide flex items-center gap-2">
                                <TrendingUp size={18}/> Prognoza (Następny Miesiąc)
                            </h2>
                            <span className="text-xs text-slate-400 font-medium">Od 1. {nextMonthName}</span>
                        </div>
                    </div>
                    <div className="mt-4 z-10">
                        <div className="text-4xl font-bold">
                            {nextMonthTotalRate.toFixed(2)} zł<span className="text-lg font-normal text-slate-400">/h</span>
                        </div>
                        <button 
                            onClick={() => setBreakdownType('potential')}
                            className="text-xs font-bold text-white/90 hover:text-white hover:underline flex items-center gap-1 mt-2"
                        >
                            <Info size={12}/> Pokaż skład stawki
                        </button>
                        <p className="text-xs text-slate-400 mt-3 bg-white/10 p-2 rounded inline-block border border-white/5">
                            Zmiany stawki wchodzą w życie od 1 dnia następnego miesiąca. <br/>
                            <span className="text-blue-300 font-bold">Rozwijaj się, zdobywaj nowe umiejętności i zarabiaj więcej!</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* QUALITY WARNINGS SECTION (Collapsible) */}
            <div className={`bg-white rounded-xl shadow-sm border transition-all overflow-hidden ${affectedSkills.length > 0 ? 'border-red-200' : 'border-slate-200'}`}>
                <button 
                    onClick={() => setIsQualityOpen(!isQualityOpen)}
                    className={`w-full px-6 py-4 flex items-center justify-between transition-colors ${affectedSkills.length > 0 ? 'bg-red-50 hover:bg-red-100' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                    <h3 className={`font-bold text-sm uppercase tracking-wide flex items-center gap-2 ${affectedSkills.length > 0 ? 'text-red-800' : 'text-slate-800'}`}>
                        <AlertTriangle size={18} className={affectedSkills.length > 0 ? 'text-red-500' : 'text-slate-400'}/> 
                        Jakość i Błędy (Bieżący miesiąc)
                    </h3>
                    <div className="flex items-center gap-3">
                        {affectedSkills.length > 0 && <span className="text-xs font-bold bg-white text-red-600 px-2 py-1 rounded-full border border-red-200">{affectedSkills.length} uwag</span>}
                        {isQualityOpen ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                    </div>
                </button>
                
                {isQualityOpen && (
                    <div className="divide-y divide-slate-100">
                        {affectedSkills.length > 0 ? affectedSkills.map((item, idx) => (
                            <div 
                                key={idx} 
                                className="p-4 px-6 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => setSelectedQualitySkillId(item!.skill.id)}
                            >
                                <div>
                                    <span className="font-medium text-slate-800 block">{item!.skill.name_pl}</span>
                                    <span className="text-xs text-slate-500">Ostatnie zgłoszenie: {new Date(item!.incidents[0].date).toLocaleDateString()}</span>
                                </div>
                                {item!.isBlocked ? (
                                    <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full border border-red-200 flex items-center gap-1">
                                        <Lock size={12}/> Dodatek Zablokowany do końca miesiąca
                                    </span>
                                ) : (
                                    <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full border border-yellow-200 flex items-center gap-1">
                                        <AlertTriangle size={12}/> 1. Ostrzeżenie
                                    </span>
                                )}
                            </div>
                        )) : (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                Brak zgłoszonych uwag w tym miesiącu. Świetna robota!
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* SECTION D: TASKS (Filtered) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Twoje Zadania</h3>
                </div>
                <div className="divide-y divide-slate-100">
                    {tasks.length > 0 ? tasks.map((task, idx) => (
                        <div key={idx} className={`p-4 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors ${task.isLocked ? 'bg-red-50/50' : ''}`}>
                            <div className="flex items-center gap-3">
                                {task.type === 'practice' && <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><CheckCircle size={18}/></div>}
                                {task.type === 'test' && (
                                    <div className={`p-2 rounded-lg ${task.isLocked ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {task.isLocked ? <Lock size={18}/> : <Play size={18}/>}
                                    </div>
                                )}
                                
                                <div>
                                    <span className={`block font-medium text-sm ${task.isLocked ? 'text-red-800' : 'text-slate-700'}`}>{task.title}</span>
                                    <span className="text-xs text-slate-500">
                                        {task.type === 'practice' && 'Wymagana weryfikacja praktyczna'}
                                        {task.type === 'test' && !task.isLocked && 'Test niezliczony - Spróbuj ponownie'}
                                        {task.type === 'test' && task.isLocked && (
                                            <span className="font-bold text-red-600 flex items-center gap-1">
                                                <Clock size={10} /> Dostępny za: {task.cooldownText}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </div>
                            
                            {task.type === 'test' ? (
                                <button 
                                    onClick={() => !task.isLocked && navigate('/dashboard/run-test', { state: { selectedTestIds: [task.id] } })}
                                    disabled={task.isLocked}
                                    className={`text-xs font-bold px-3 py-1.5 rounded border transition-colors ${
                                        task.isLocked 
                                        ? 'bg-white text-slate-400 border-slate-200 cursor-not-allowed' 
                                        : 'text-blue-600 hover:bg-blue-50 border-blue-200'
                                    }`}
                                >
                                    {task.isLocked ? 'Zablokowane' : 'Ponów'}
                                </button>
                            ) : task.type === 'practice' ? (
                                <button 
                                    onClick={() => navigate('/dashboard/practice')}
                                    className="text-xs font-bold text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded border border-orange-200"
                                >
                                    Szczegóły
                                </button>
                            ) : null}
                        </div>
                    )) : (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            Brak pilnych zadań (poprawek lub praktyk).
                            <br/>
                            <button onClick={() => navigate('/dashboard/skills')} className="text-blue-600 hover:underline mt-1 font-medium">
                                Przejdź do umiejętności, aby rozpocząć nowe.
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {renderBreakdownModal()}
            {renderContactModal()}
            {renderQualityDetailModal()}

            <DocumentViewerModal 
                isOpen={fileViewer.isOpen}
                onClose={() => setFileViewer({ ...fileViewer, isOpen: false })}
                urls={fileViewer.urls}
                initialIndex={fileViewer.index}
                title={fileViewer.title}
            />
        </div>
    );
};
