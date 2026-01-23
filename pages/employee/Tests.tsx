
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Play, Lock, AlertTriangle, Clock, RotateCcw, CheckCircle, HelpCircle, X, List } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { SkillStatus, TestAttempt, Test } from '../../types';

export const EmployeeTests = () => {
    const { state } = useAppContext();
    const { currentUser, skills, userSkills, tests, testAttempts } = state;
    const navigate = useNavigate();
    
    // History Modal State
    const [historyTestId, setHistoryTestId] = useState<string | null>(null);

    if (!currentUser) return null;

    const COOLDOWN_HOURS = 24;

    // Helper: Calculate Cooldown
    const getCooldown = (testId: string) => {
        const attempts = testAttempts
            .filter(ta => ta.user_id === currentUser.id && ta.test_id === testId)
            .sort((a,b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
        
        const lastAttempt = attempts[0];
        
        if (lastAttempt && !lastAttempt.passed) {
            const lastDate = new Date(lastAttempt.completed_at);
            const unlockDate = new Date(lastDate.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
            const now = new Date();
            
            if (now < unlockDate) {
                const diffMs = unlockDate.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const days = Math.floor(hours / 24);
                
                let text = '';
                if (days > 0) text = `${days} dni`;
                else text = `${hours} godz.`;
                
                return { isLocked: true, text };
            }
        }
        return { isLocked: false, text: '' };
    };

    // Helper: Get Test Status for Display
    const getTestStatus = (test: Test) => {
        const skill = skills.find(s => s.id === test.skill_ids[0]);
        const userSkill = userSkills.find(us => us.user_id === currentUser.id && us.skill_id === skill?.id);
        const cooldown = getCooldown(test.id);

        if (userSkill?.status === SkillStatus.CONFIRMED) {
            return { label: 'Zaliczone (Komplet)', color: 'bg-green-100 text-green-800', icon: CheckCircle, action: 'none' };
        }
        if (userSkill?.status === SkillStatus.THEORY_PASSED || userSkill?.status === SkillStatus.PRACTICE_PENDING) {
            return { label: 'Teoria OK', color: 'bg-blue-100 text-blue-800', icon: CheckCircle, action: 'practice' };
        }
        if (userSkill?.status === SkillStatus.FAILED && cooldown.isLocked) {
            return { label: `Dostępny za: ${cooldown.text}`, color: 'bg-red-100 text-red-800', icon: Lock, action: 'locked' };
        }
        if (userSkill?.status === SkillStatus.FAILED) {
            return { label: 'Do poprawy', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle, action: 'start' };
        }
        return { label: 'Dostępny', color: 'bg-slate-100 text-slate-600', icon: Play, action: 'start' };
    };

    const handleStartTest = (testId: string) => {
        const cooldown = getCooldown(testId);
        if (cooldown.isLocked) {
            // Don't allow starting test during cooldown
            return;
        }
        navigate('/dashboard/run-test', { state: { selectedTestIds: [testId] } });
    };

    // Filter relevant tests:
    // 1. Must be active and not archived.
    // 2. Must have been attempted at least once by the current user.
    const activeTests = tests.filter(t => {
        const isActive = t.is_active && !t.is_archived;
        const hasAttempts = testAttempts.some(ta => ta.user_id === currentUser.id && ta.test_id === t.id);
        return isActive && hasAttempts;
    });

    // Get History Data for Modal
    const getHistoryData = (testId: string) => {
        const test = tests.find(t => t.id === testId);
        if (!test) return [];

        // 1. Get Theory Attempts
        const attempts = testAttempts
            .filter(ta => ta.user_id === currentUser.id && ta.test_id === testId)
            .map(a => ({
                id: a.id,
                date: a.completed_at,
                score: `${a.score}%`,
                duration: a.duration_seconds,
                status: a.passed ? 'Zaliczony' : 'Niezaliczony',
                type: 'Test'
            }));

        // 2. Get Practical History (Logs)
        const skill = skills.find(s => test.skill_ids.includes(s.id));
        let practicalHistory: any[] = [];
        
        if (skill) {
            const skillNameLower = skill.name_pl.toLowerCase();
            practicalHistory = state.candidateHistory
                .filter(h => {
                    if (h.candidate_id !== currentUser.id) return false;
                    const actionLower = h.action.toLowerCase();
                    
                    // Filter Logic:
                    // 1. Must contain skill name
                    // 2. EXCLUDE logs that are clearly "Test" logs (because we have attempts for that), 
                    //    UNLESS it's a generic status change that might be relevant.
                    //    Test logs usually look like "Zaliczono test: [SkillName]" or "Rozpoczęto test".
                    
                    if (!actionLower.includes(skillNameLower)) return false;

                    // Exclude duplicative test logs
                    if (actionLower.includes('zaliczono test') || actionLower.includes('rozpoczęto test')) {
                        return false; 
                    }

                    return true;
                })
                .map(h => {
                    const actionLower = h.action.toLowerCase();
                    const isRejected = actionLower.includes('odrzuco') || actionLower.includes('failed') || actionLower.includes('niezaliczon') || (actionLower.includes('status') && actionLower.includes('failed'));
                    
                    let statusLabel = 'INFO';
                    if (isRejected) statusLabel = 'ODRZUCONY';
                    else if (actionLower.includes('zaliczono') || actionLower.includes('confirmed')) statusLabel = 'ZALICZONY';
                    
                    return {
                        id: h.id,
                        // Fixed line 136: Property 'date' does not exist on type 'CandidateHistoryEntry'. Changed to 'created_at'.
                        date: h.created_at,
                        score: 'Weryfikacja/Status',
                        duration: null,
                        status: statusLabel,
                        type: 'Log'
                    };
                });
        }

        // Merge and Sort
        return [...attempts, ...practicalHistory].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const renderHistoryModal = () => {
        if (!historyTestId) return null;
        const history = getHistoryData(historyTestId);
        const testTitle = tests.find(t => t.id === historyTestId)?.title || 'Test';

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setHistoryTestId(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-900">Historia podejść: {testTitle}</h3>
                        <button onClick={() => setHistoryTestId(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="p-3 rounded-l-lg">Data</th>
                                    <th className="p-3">Wynik / Typ</th>
                                    <th className="p-3">Czas trwania</th>
                                    <th className="p-3 rounded-r-lg text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {history.map(attempt => {
                                    const mins = attempt.duration ? Math.floor(attempt.duration / 60) : 0;
                                    const secs = attempt.duration ? attempt.duration % 60 : 0;
                                    
                                    const isPassed = attempt.status === 'Zaliczony' || attempt.status === 'ZALICZONY';
                                    const isRejected = attempt.status === 'ODRZUCONY' || attempt.status === 'Niezaliczony';
                                    const isPractice = attempt.type === 'Log';

                                    return (
                                        <tr key={attempt.id} className={isPractice ? 'bg-slate-50/50' : ''}>
                                            <td className="p-3 text-slate-700">
                                                {new Date(attempt.date).toLocaleDateString()} {new Date(attempt.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </td>
                                            <td className="p-3 font-bold">
                                                {isPractice ? (
                                                    <span className="text-slate-500 text-xs uppercase font-semibold">Weryfikacja</span>
                                                ) : (
                                                    <span className={isPassed ? 'text-green-600' : 'text-red-600'}>{attempt.score}</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-slate-500 font-mono">
                                                {attempt.duration ? `${mins}m ${secs}s` : '-'}
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${isPassed ? 'bg-green-100 text-green-700' : (isRejected ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')}`}>
                                                    {attempt.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {history.length === 0 && (
                                    <tr><td colSpan={4} className="p-6 text-center text-slate-400">Brak historii podejść.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button variant="ghost" onClick={() => setHistoryTestId(null)}>Zamknij</Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-6xl mx-auto pb-24">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Testy i Weryfikacja</h1>
            <p className="text-slate-500 mb-8">
                Lista rozpoczętych testów. Aby rozpocząć nowy test, przejdź do zakładki <strong>Moje Umiejętności</strong>.
            </p>

            <div className="grid grid-cols-1 gap-4">
                {activeTests.map(test => {
                    const status = getTestStatus(test);
                    const lastAttempt = testAttempts
                        .filter(ta => ta.user_id === currentUser.id && ta.test_id === test.id)
                        .sort((a,b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];

                    const skill = skills.find(s => s.id === test.skill_ids[0]);

                    return (
                        <div key={test.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center gap-6">
                            
                            {/* Icon & Basic Info */}
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`p-4 rounded-xl flex-shrink-0 ${status.action === 'start' ? 'bg-blue-50 text-blue-600' : (status.action === 'practice' || status.action === 'none' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}`}>
                                    <FileCheck size={28} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg mb-1">{test.title}</h3>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                                        <span className="flex items-center gap-1"><Clock size={14}/> Czas: {test.time_limit_minutes} min</span>
                                        <span className="flex items-center gap-1"><HelpCircle size={14}/> Pytań: {test.questions.length}</span>
                                        {skill && <span className="flex items-center gap-1 font-medium text-green-600">Bonus: +{skill.hourly_bonus} zł/h</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Status & Last Result */}
                            <div className="flex flex-col items-start md:items-end gap-1 min-w-[140px]">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-2 ${status.color}`}>
                                    {status.action === 'locked' && <Lock size={12}/>}
                                    {status.label}
                                </span>
                                {lastAttempt && (
                                    <span className="text-xs text-slate-400 mt-1">
                                        Ostatni wynik: <span className={lastAttempt.passed ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{lastAttempt.score}%</span> ({new Date(lastAttempt.completed_at).toLocaleDateString()})
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={() => setHistoryTestId(test.id)}
                                    className="flex-1 md:flex-none"
                                >
                                    <List size={16} className="mr-2"/> Historia
                                </Button>

                                {status.action === 'start' && (
                                    <Button 
                                        size="sm" 
                                        onClick={() => handleStartTest(test.id)}
                                        className="bg-blue-600 hover:bg-blue-700 flex-1 md:flex-none"
                                    >
                                        <Play size={16} className="mr-2"/> Rozpocznij
                                    </Button>
                                )}
                                
                                {status.action === 'locked' && (
                                    <Button size="sm" disabled className="bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex-1 md:flex-none">
                                        <Lock size={16} className="mr-2"/> Zablokowany
                                    </Button>
                                )}

                                {status.action === 'practice' && (
                                    <Button 
                                        size="sm" 
                                        onClick={() => navigate('/dashboard/practice')}
                                        className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none"
                                    >
                                        Przejdź do Praktyki
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {activeTests.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                    <p className="text-slate-400 mb-2">Brak rozpoczętych testów.</p>
                    <Button variant="outline" onClick={() => navigate('/dashboard/skills')}>
                        Przejdź do Umiejętności
                    </Button>
                </div>
            )}

            {renderHistoryModal()}
        </div>
    );
};
