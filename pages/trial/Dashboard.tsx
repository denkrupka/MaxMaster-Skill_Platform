
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Lock, CheckCircle, Clock, Play, AlertCircle, Info, User, Briefcase, Phone, Mail, X, BookOpen, Award, Star, Eye, HardHat } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { calculateSalary } from '../../services/salaryService';
import { SkillStatus, ContractType, VerificationType, Role } from '../../types';
import { CONTRACT_TYPE_LABELS } from '../../constants';
import { Button } from '../../components/Button';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

export const TrialDashboard = () => {
    const { state } = useAppContext();
    const { currentUser, userSkills, skills, systemConfig, monthlyBonuses, tests, testAttempts, qualityIncidents, libraryResources, employeeBadges } = state;
    const navigate = useNavigate();

    // UI States
    const [breakdownType, setBreakdownType] = useState<'current' | 'potential' | null>(null);
    const [showContactModal, setShowContactModal] = useState<{type: 'brigadir' | 'hr' | 'coordinator', user: any} | null>(null);
    const [isQualityOpen, setIsQualityOpen] = useState(false);
    const [selectedQualitySkillId, setSelectedQualitySkillId] = useState<string | null>(null);
    const [trialNow, setTrialNow] = useState(new Date());

    // File Viewer State
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    // Update time for trial progress bar
    useEffect(() => {
        const interval = setInterval(() => setTrialNow(new Date()), 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    // Auto-refresh data from storage every 10 seconds
    useEffect(() => {
        const handleStorageChange = () => {
            // Force re-render by updating state
            // The AppContext will automatically provide updated data
            setTrialNow(new Date());
        };

        // Listen to storage events (for cross-tab sync)
        window.addEventListener('storage', handleStorageChange);

        // Also poll every 10 seconds
        const pollInterval = setInterval(handleStorageChange, 10000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(pollInterval);
        };
    }, []);

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
    // During TRIAL period, use frozen rate (set at hiring time)
    // This ensures candidate gets the rate they agreed to, even before completing practice verifications
    const frozenRate = currentUser.base_rate || systemConfig.baseRate;

    // For trial employees, calculate what WILL be their rate after trial ends
    // This is based on CONFIRMED skills only (not just passed tests)
    const postTrialSalaryInfo = calculateSalary(
        systemConfig.baseRate,
        skills,
        userSkills.filter(us => us.user_id === currentUser.id),
        monthlyBonuses[currentUser.id] || { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 },
        now,
        qualityIncidents
    );

    const contractBonus = systemConfig.contractBonuses[currentUser.contract_type || ContractType.UOP] || 0;
    const studentBonus = (currentUser.contract_type === ContractType.UZ && currentUser.is_student) ? 3 : 0;
    const totalExtras = contractBonus + studentBonus;

    // Current rate = frozen rate during trial (includes ALL bonuses from hire time)
    const currentTotalRate = frozenRate;
    // Next month rate = what they'll get after trial ends (based on confirmed skills only)
    const nextMonthTotalRate = postTrialSalaryInfo.total + totalExtras;

    // --- LOGIC: TRIAL TIME DATA ---
    const trialTimeData = useMemo(() => {
        if (!currentUser?.trial_end_date || !currentUser?.hired_date) return null;
        const start = new Date(currentUser.hired_date).getTime();
        const end = new Date(currentUser.trial_end_date).getTime();
        const currentTime = trialNow.getTime();
        const remaining = end - currentTime;
        const isEnded = remaining <= 0;
        const daysLeft = isEnded ? 0 : Math.ceil(remaining / (1000 * 3600 * 24));
        const total = end - start;
        const elapsed = currentTime - start;
        const percent = isEnded ? 100 : Math.min(100, Math.max(0, (elapsed / total) * 100));
        return { daysLeft, percent, isEnded };
    }, [currentUser, trialNow]);

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
        .slice(0, 3);

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

        // For TRIAL employees:
        // - "current" shows frozen rate from hiring (no detailed breakdown available)
        // - "potential" shows what they'll get after trial based on confirmed skills
        const isFrozenRate = breakdownType === 'current';
        const title = isFrozenRate ? 'Zamrożona Stawka' : `Prognoza Po Okresie Próbnym`;
        const total = isFrozenRate ? currentTotalRate : nextMonthTotalRate;

        if (isFrozenRate) {
            // Calculate frozen rate breakdown based on current user data
            // This shows what was frozen at hire time
            const base = systemConfig?.baseRate || 24;

            // Get passed tests for skills bonus
            const passedTests = (testAttempts || []).filter(ta =>
                ta.user_id === currentUser?.id && ta.passed
            );
            const skillsFromTests: Array<{name: string, bonus: number}> = [];
            const countedSkillIds = new Set<string>();

            passedTests.forEach(ta => {
                const test = (tests || []).find(t => t.id === ta.test_id);
                if (test && test.skill_ids) {
                    test.skill_ids.forEach(sid => {
                        if (!countedSkillIds.has(sid)) {
                            const skill = (skills || []).find(s => s.id === sid);
                            if (skill && skill.name_pl && typeof skill.hourly_bonus === 'number') {
                                skillsFromTests.push({
                                    name: skill.name_pl,
                                    bonus: skill.hourly_bonus
                                });
                                countedSkillIds.add(sid);
                            }
                        }
                    });
                }
            });

            const skillsBonus = skillsFromTests.reduce((sum, s) => sum + (s.bonus || 0), 0);

            // Get qualifications bonus
            const QUALIFICATIONS_LIST = [
                { id: 'sep_e', label: 'SEP E z pomiarami', value: 0.5 },
                { id: 'sep_d', label: 'SEP D z pomiarami', value: 0.5 },
                { id: 'udt', label: 'UDT na podnośniki', value: 1.0 }
            ];

            const userQualsList = QUALIFICATIONS_LIST.filter(q =>
                (currentUser?.qualifications || []).includes(q.id)
            );
            const qualsBonus = userQualsList.reduce((sum, q) => sum + (q.value || 0), 0);

            // Show simple breakdown for frozen rate
            return (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setBreakdownType(null)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h3 className="font-bold text-slate-900">{title}</h3>
                            <button onClick={() => setBreakdownType(null)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>

                        <div className="space-y-3">
                            {/* Total Frozen Rate */}
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-green-900">Gwarantowana Stawka</div>
                                        <div className="text-sm text-green-700 mt-1">
                                            Zamrożona z momentu zatrudnienia na okres próbny
                                        </div>
                                    </div>
                                    <div className="font-black text-3xl text-green-700">{(currentTotalRate || 0).toFixed(2)} zł</div>
                                </div>
                            </div>

                            {/* Breakdown of Frozen Rate */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Skład Zamrożonej Stawki</div>

                                {/* Base Rate */}
                                <div className="flex justify-between items-center p-2 rounded bg-white border border-slate-100">
                                    <div>
                                        <div className="font-medium text-sm text-slate-800">Stawka Bazowa</div>
                                        <div className="text-xs text-slate-500">Podstawa</div>
                                    </div>
                                    <div className="font-bold text-slate-900">{(base || 0).toFixed(2)} zł</div>
                                </div>

                                {/* Skills from Tests */}
                                {skillsFromTests && skillsFromTests.length > 0 && (
                                    <>
                                        <div className="text-xs font-bold text-green-600 uppercase tracking-wider pt-2">Umiejętności z Testów</div>
                                        {skillsFromTests.map((skill, idx) => (
                                            <div key={skill.name || idx} className="flex justify-between items-center p-2 rounded bg-green-50 border border-green-100">
                                                <div>
                                                    <div className="font-medium text-sm text-green-900">{skill.name || 'Nieznana'}</div>
                                                    <div className="text-xs text-green-600">Test zaliczony</div>
                                                </div>
                                                <div className="font-bold text-green-700">+{(skill.bonus || 0).toFixed(2)} zł</div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* Qualifications */}
                                {userQualsList && userQualsList.length > 0 && (
                                    <>
                                        <div className="text-xs font-bold text-purple-600 uppercase tracking-wider pt-2">Uprawnienia</div>
                                        {userQualsList.map((qual, idx) => (
                                            <div key={qual.id || idx} className="flex justify-between items-center p-2 rounded bg-purple-50 border border-purple-100">
                                                <div>
                                                    <div className="font-medium text-sm text-purple-900">{qual.label || 'Nieznane'}</div>
                                                    <div className="text-xs text-purple-600">Wymaga weryfikacji</div>
                                                </div>
                                                <div className="font-bold text-purple-700">+{(qual.value || 0).toFixed(2)} zł</div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* Contract & Student Bonus */}
                                {totalExtras > 0 && (
                                    <div className="flex justify-between items-center p-2 rounded bg-blue-50 border border-blue-100">
                                        <div>
                                            <div className="font-medium text-sm text-blue-900">Umowa i Dodatkowe</div>
                                            <div className="text-xs text-blue-600">
                                                {currentUser?.contract_type ? String(currentUser.contract_type).toUpperCase() : 'UOP'}
                                                {currentUser?.is_student ? ' + Student' : ''}
                                            </div>
                                        </div>
                                        <div className="font-bold text-blue-700">+{(totalExtras || 0).toFixed(2)} zł</div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                                <div>
                                    <p className="text-sm font-bold text-blue-900 mb-2">Jak zachować tę stawkę?</p>
                                    <ul className="text-sm text-blue-800 space-y-1.5 pl-4">
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-600 font-bold">•</span>
                                            <span>Potwierdź umiejętności praktyką na budowie podczas okresu próbnego</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-600 font-bold">•</span>
                                            <span>Załaduj dokumenty uprawnień do weryfikacji (jeśli zostały zadeklarowane)</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="pt-2 border-t border-blue-200">
                                    <p className="text-sm text-blue-800">
                                        <strong className="text-orange-700">⚠️ Uwaga:</strong> Jeśli któryś z umiejętności nie zostanie potwierdzony praktyką lub uprawnienia nie przejdą weryfikacji –
                                        dana umiejętność zostanie usunięta, a stawka zostanie przeliczona bez jej bonusu.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button onClick={() => setBreakdownType(null)}>Zamknij</Button>
                        </div>
                    </div>
                </div>
            );
        }

        // For potential (post-trial) rate, show detailed breakdown
        const activeItems = postTrialSalaryInfo.breakdown.details.activeSkills;
        const pendingItems = postTrialSalaryInfo.breakdown.details.pendingSkills;

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
                            <div className="font-bold text-slate-900">+{postTrialSalaryInfo.breakdown.base.toFixed(2)} zł</div>
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

                        {activeItems.length > 0 && (
                            <>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">Potwierdzone Umiejętności</div>
                                {activeItems.map(item => (
                                    <div key={item.name} className="flex justify-between items-center p-2 rounded bg-green-50 border border-green-100">
                                        <div>
                                            <div className="font-medium text-sm text-green-900">{item.name}</div>
                                            <div className="text-xs text-green-600">Skill</div>
                                        </div>
                                        <div className="font-bold text-green-700">+{item.value.toFixed(2)} zł</div>
                                    </div>
                                ))}
                            </>
                        )}

                        {pendingItems.length > 0 && (
                            <>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">Oczekujące (Teoria zdana, praktyka w toku)</div>
                                {pendingItems.map(item => (
                                    <div key={item.name} className="flex justify-between items-center p-2 rounded bg-orange-50 border border-orange-100">
                                        <div>
                                            <div className="font-medium text-sm text-orange-900">{item.name}</div>
                                            <div className="text-xs text-orange-600">Wymaga potwierdzenia</div>
                                        </div>
                                        <div className="font-bold text-orange-700">+{item.value.toFixed(2)} zł</div>
                                    </div>
                                ))}
                            </>
                        )}

                        {activeItems.length === 0 && pendingItems.length === 0 && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                                <p className="text-sm text-slate-600">Brak potwierdzonych umiejętności. Po okresie próbnym otrzymasz stawkę bazową + bonus za umowę.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg text-slate-900">RAZEM PO PRÓBNYM:</span>
                            <span className="font-black text-2xl text-blue-600">{total.toFixed(2)} zł/h</span>
                        </div>
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
                <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
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

        const affectedSkill = (affectedSkills as any[]).find(a => a.skill.id === selectedQualitySkillId);
        if (!affectedSkill) return null;

        const relatedResources = libraryResources.filter(r => r.skill_ids.includes(affectedSkill.skill.id));

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedQualitySkillId(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                        <h3 className="font-bold text-slate-900">Szczegóły Zgłoszeń Jakości</h3>
                        <button onClick={() => setSelectedQualitySkillId(null)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>

                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-10 h-10 ${affectedSkill.isBlocked ? 'bg-red-500' : 'bg-orange-400'} rounded-full flex items-center justify-center text-white font-bold text-lg`}>
                                {affectedSkill.count}
                            </div>
                            <div>
                                <h4 className="font-bold text-red-800">{affectedSkill.skill.name_pl}</h4>
                                <p className="text-sm text-red-600">
                                    {affectedSkill.isBlocked
                                        ? `❌ Umiejętność Zablokowana (-${affectedSkill.penalty.toFixed(2)} zł/h)`
                                        : `⚠️ Ostrzeżenie (${affectedSkill.count}/2)`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {affectedSkill.incidents.map((inc: any, idx: number) => (
                            <div key={inc.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-sm font-bold text-slate-700">Zgłoszenie #{affectedSkill.incidents.length - idx}</div>
                                    <div className="text-xs text-slate-500">{new Date(inc.date).toLocaleDateString('pl-PL')}</div>
                                </div>
                                <p className="text-sm text-slate-900 mb-2"><strong>Problem:</strong> {inc.description}</p>
                                {inc.evidence_url && (
                                    <button
                                        onClick={() => openImagePreview(inc.evidence_url)}
                                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        <Eye size={16}/> Pokaż dowód
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {affectedSkill.isBlocked && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h5 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                <Info size={18}/> Co teraz?
                            </h5>
                            <p className="text-sm text-blue-700">
                                Skontaktuj się z brygadzistą lub koordynatorem, aby omówić zgłoszenia i przywrócić umiejętność.
                                Musisz poprawić jakość pracy, aby odblokować bonusy.
                            </p>

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

                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                        <Button onClick={() => setSelectedQualitySkillId(null)}>Rozumiem</Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 pb-24">

            {/* TRIAL PROGRESS BAR */}
            {trialTimeData && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                            <Clock size={28}/>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Twój Okres Próbny</h2>
                            <p className="text-sm text-slate-500 font-medium">Status: {trialTimeData.isEnded ? 'Zakończony' : 'W trakcie'}</p>
                        </div>
                    </div>

                    <div className="flex-1 max-w-md w-full">
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                            <span>Postęp czasu</span>
                            <span className={trialTimeData.daysLeft <= 7 ? 'text-red-500' : 'text-orange-600'}>
                                Zostało: {trialTimeData.daysLeft} dni
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                            <div
                                className="bg-gradient-to-r from-orange-400 to-orange-600 h-full transition-all duration-1000 shadow-sm"
                                style={{ width: `${trialTimeData.percent}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="hidden md:block border-l border-slate-100 pl-6">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Koniec okresu</div>
                        <div className="font-bold text-slate-700">{currentUser.trial_end_date?.split('T')[0]}</div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Panel Pracownika</h1>
                    <p className="text-slate-500">Witaj, {currentUser.first_name}. Twoje finanse i zadania.</p>
                </div>

                {/* Contact Buttons */}
                <div className="flex gap-3">
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

                    <button
                        onClick={() => setShowContactModal({type: 'brigadir', user: brigadir})}
                        className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                            <User size={18} />
                        </div>
                        <div className="text-left hidden sm:block">
                            <span className="block text-slate-500 text-[10px] uppercase font-bold">Twój Brygadzista</span>
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
                                        <div className="font-bold text-yellow-800 text-sm">{badge.badge_name}</div>
                                        <div className="text-xs text-yellow-600">{new Date(badge.created_at).toLocaleDateString('pl-PL')}</div>
                                    </div>
                                    <Award className="text-yellow-500 fill-yellow-100" size={24}/>
                                </div>
                                {badge.message && <p className="text-xs text-slate-600 mt-2">{badge.message}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Salary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Salary Card - Frozen Rate */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider opacity-90">Twoja Stawka Gwarantowana</h2>
                            <p className="text-xs opacity-75 mt-1">Podczas okresu próbnego</p>
                        </div>
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Wallet className="text-white" size={20}/>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-black">{currentTotalRate.toFixed(2)}</span>
                        <span className="text-lg font-bold opacity-90">zł/h</span>
                    </div>
                    <button
                        onClick={() => setBreakdownType('current')}
                        className="text-sm font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                        Zobacz szczegóły
                        <ChevronDown size={16}/>
                    </button>
                </div>

                {/* Projected Salary Card - After Trial */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Prognoza Po Próbnym</h2>
                            <p className="text-xs text-slate-400 mt-1">Na podstawie potwierdzonych umiejętności</p>
                        </div>
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <TrendingUp className="text-blue-600" size={20}/>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-black text-slate-900">{nextMonthTotalRate.toFixed(2)}</span>
                        <span className="text-lg font-bold text-slate-500">zł/h</span>
                    </div>
                    <button
                        onClick={() => setBreakdownType('potential')}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                        Zobacz szczegóły
                        <ChevronDown size={16}/>
                    </button>
                </div>
            </div>

            {/* Quality Warnings Section - Collapsible */}
            {affectedSkills.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm overflow-hidden">
                    <button
                        onClick={() => setIsQualityOpen(!isQualityOpen)}
                        className="w-full p-4 flex items-center justify-between hover:bg-red-100 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-red-500 text-white p-2 rounded-full">
                                <AlertTriangle size={20}/>
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-red-800">Ostrzeżenia Jakości ({affectedSkills.length})</h3>
                                <p className="text-sm text-red-600">Zgłoszono problemy z jakością Twojej pracy w tym miesiącu</p>
                            </div>
                        </div>
                        {isQualityOpen ? <ChevronUp className="text-red-600" size={24}/> : <ChevronDown className="text-red-600" size={24}/>}
                    </button>

                    {isQualityOpen && (
                        <div className="p-4 border-t border-red-200 bg-white">
                            <div className="space-y-3">
                                {(affectedSkills as any[]).map(a => (
                                    <div
                                        key={a.skill.id}
                                        className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                                        onClick={() => setSelectedQualitySkillId(a.skill.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 ${a.isBlocked ? 'bg-red-500' : 'bg-orange-400'} rounded-full flex items-center justify-center text-white font-bold`}>
                                                {a.count}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{a.skill.name_pl}</div>
                                                <div className="text-sm text-red-600">
                                                    {a.isBlocked
                                                        ? `❌ Zablokowane (-${a.penalty.toFixed(2)} zł/h)`
                                                        : `⚠️ Ostrzeżenie (${a.count}/2)`}
                                                </div>
                                            </div>
                                        </div>
                                        <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                                            Szczegóły →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tasks Section */}
            {tasks.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <CheckCircle className="text-green-500"/> Twoje Zadania ({tasks.length})
                    </h3>
                    <div className="space-y-3">
                        {tasks.map((task, idx) => {
                            const isPractice = task.type === 'practice';
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`${isPractice ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'} p-2 rounded-full`}>
                                            {isPractice ? <Play size={18}/> : <Lock size={18}/>}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900">{task.title}</div>
                                            <div className="text-xs text-slate-500">
                                                {isPractice ? 'Weryfikacja praktyczna' : task.isLocked ? `Odblokuje się za: ${task.cooldownText}` : 'Test teoretyczny'}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => isPractice ? navigate('/trial/practice') : navigate('/trial/tests')}
                                        disabled={task.isLocked}
                                        className={task.isLocked ? 'opacity-50 cursor-not-allowed' : ''}
                                    >
                                        {isPractice ? 'Praktyka' : 'Test'}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {renderBreakdownModal()}
            {renderContactModal()}
            {renderQualityDetailModal()}
            <DocumentViewerModal
                isOpen={fileViewer.isOpen}
                urls={fileViewer.urls}
                title={fileViewer.title}
                currentIndex={fileViewer.index}
                onClose={() => setFileViewer({ isOpen: false, urls: [], title: '', index: 0 })}
                onNavigate={(newIndex) => setFileViewer(prev => ({ ...prev, index: newIndex }))}
            />
        </div>
    );
};
