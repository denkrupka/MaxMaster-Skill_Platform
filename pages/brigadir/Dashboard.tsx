
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    CheckSquare, AlertTriangle, Star, 
    Calendar, TrendingUp, AlertCircle, ChevronRight
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { UserStatus, SkillStatus, VerificationType } from '../../types';

export const BrigadirDashboard = () => {
    const { state } = useAppContext();
    const { currentUser, users, userSkills, skills, qualityIncidents, employeeBadges } = state;
    const navigate = useNavigate();

    // Context: Date Filter
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // 1. FILTER: My Team
    const myTeam = useMemo(() => {
        if (!currentUser) return [];
        return users.filter(u => u.assigned_brigadir_id === currentUser.id && u.status !== UserStatus.INACTIVE);
    }, [currentUser, users]);

    const myTeamIds = useMemo(() => myTeam.map(u => u.id), [myTeam]);

    // 2. DATA: Urgent Verifications (Pending practical checks)
    // Note: Verifications are usually "now", so we don't filter them by selected month strictly, 
    // but show what is currently pending.
    const urgentVerifications = useMemo(() => {
        const pending = userSkills.filter(us => {
            if (!myTeamIds.includes(us.user_id)) return false;
            // Only practical skills needing check
            const skill = skills.find(s => s.id === us.skill_id);
            if (!skill || skill.verification_type !== VerificationType.THEORY_PRACTICE) return false;
            
            return us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING;
        });

        const now = new Date();

        return pending.map(us => {
            const user = users.find(u => u.id === us.user_id);
            const skill = skills.find(s => s.id === us.skill_id);
            
            // Default urgency logic
            let deadlineDate = new Date();
            if (user?.status === UserStatus.TRIAL && user.trial_end_date) {
                deadlineDate = new Date(user.trial_end_date);
            } else {
                deadlineDate.setDate(deadlineDate.getDate() + 7);
            }

            const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

            return {
                ...us,
                user,
                skill,
                daysLeft
            };
        }).sort((a, b) => a.daysLeft - b.daysLeft);
    }, [userSkills, myTeamIds, users, skills]);

    // 3. DATA: Quality KPIs (Filtered by Selected Month)
    const qualityStats = useMemo(() => {
        const [yearStr, monthStr] = selectedMonth.split('-');
        const filterYear = parseInt(yearStr);
        const filterMonth = parseInt(monthStr) - 1; // 0-indexed

        const teamIncidents = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return myTeamIds.includes(inc.user_id) && 
                   d.getMonth() === filterMonth && 
                   d.getFullYear() === filterYear;
        });

        return {
            totalIncidents: teamIncidents.length
        };
    }, [qualityIncidents, myTeamIds, selectedMonth]);

    // 4. DATA: Badges (Filtered by Selected Month)
    const badgeStats = useMemo(() => {
        // Badges have a 'month' string field (YYYY-MM)
        const count = employeeBadges.filter(b => 
            myTeamIds.includes(b.employee_id) && b.month === selectedMonth
        ).length;

        return count;
    }, [employeeBadges, myTeamIds, selectedMonth]);

    const KPI_TILE_CLASS = "bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-32 relative overflow-hidden cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group";

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 pb-24">
            
            {/* Header with Date Picker */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Panel Zarządzania</h1>
                    <p className="text-slate-500">Przegląd zadań, weryfikacji i statusu zespołu.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <Calendar size={18} className="text-slate-400 ml-2"/>
                    <input 
                        type="month" 
                        className="text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 outline-none cursor-pointer"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                </div>
            </div>

            {/* KPI TILES (Single Row, Clickable) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Verifications */}
                <div 
                    className={KPI_TILE_CLASS}
                    onClick={() => navigate('/brigadir/checks')}
                >
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckSquare size={64} className="text-blue-600"/>
                    </div>
                    <div className="text-sm font-bold text-blue-600 uppercase tracking-wide flex items-center gap-2">
                        <CheckSquare size={16}/> Do weryfikacji
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900">{urgentVerifications.length}</div>
                        <div className="text-xs text-slate-500 mt-1">Oczekujące zadania praktyczne</div>
                    </div>
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="text-blue-400" />
                    </div>
                </div>

                {/* 2. Quality Alerts */}
                <div 
                    className={KPI_TILE_CLASS}
                    onClick={() => navigate('/brigadir/quality')}
                >
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertTriangle size={64} className="text-yellow-600"/>
                    </div>
                    <div className="text-sm font-bold text-yellow-600 uppercase tracking-wide flex items-center gap-2">
                        <AlertTriangle size={16}/> Alerty Jakości
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900">{qualityStats.totalIncidents}</div>
                        <div className="text-xs text-slate-500 mt-1">Zgłoszenia w wybranym miesiącu</div>
                    </div>
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="text-yellow-400" />
                    </div>
                </div>

                {/* 3. Badges */}
                <div 
                    className={KPI_TILE_CLASS}
                    onClick={() => navigate('/brigadir/team')}
                >
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Star size={64} className="text-purple-600"/>
                    </div>
                    <div className="text-sm font-bold text-purple-600 uppercase tracking-wide flex items-center gap-2">
                        <Star size={16}/> Przyznane Odznaki
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900">{badgeStats}</div>
                        <div className="text-xs text-slate-500 mt-1">Wyróżnienia w wybranym miesiącu</div>
                    </div>
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="text-purple-400" />
                    </div>
                </div>
            </div>

            {/* LIST A: Urgent Verifications (Full Width) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <CheckSquare size={18} className="text-blue-600"/> Najpilniejsze Weryfikacje
                    </h3>
                    <Button size="sm" variant="ghost" onClick={() => navigate('/brigadir/checks')} className="text-blue-600 text-xs">
                        Zobacz wszystkie
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Pracownik</th>
                                <th className="px-6 py-4">Umiejętność</th>
                                <th className="px-6 py-4">Bonus</th>
                                <th className="px-6 py-4">Termin</th>
                                <th className="px-6 py-4 text-right">Akcja</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {urgentVerifications.slice(0, 10).map(item => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                                                {item.user?.first_name[0]}{item.user?.last_name[0]}
                                            </div>
                                            <div>
                                                <div>{item.user?.first_name} {item.user?.last_name}</div>
                                                <div className="text-xs text-slate-400">{item.user?.target_position || 'Pracownik'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {item.skill?.name_pl}
                                    </td>
                                    <td className="px-6 py-4 text-green-600 font-bold">
                                        +{item.skill?.hourly_bonus} zł/h
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`flex items-center gap-1 font-bold ${item.daysLeft <= 3 ? 'text-red-600' : 'text-slate-600'}`}>
                                            {item.daysLeft <= 3 && <AlertCircle size={12}/>}
                                            {item.daysLeft < 0 ? 'Po terminie' : `${item.daysLeft} dni`}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button size="sm" onClick={() => navigate('/brigadir/checks')} className="bg-blue-600 hover:bg-blue-700 h-8 px-4">
                                            Sprawdź
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {urgentVerifications.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center">
                                            <CheckSquare size={48} className="mb-4 opacity-20"/>
                                            <p>Brak pilnych weryfikacji. Dobra robota!</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
