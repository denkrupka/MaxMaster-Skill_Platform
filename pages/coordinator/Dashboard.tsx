import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Briefcase, Users, AlertTriangle, ChevronRight, 
    Calendar, HardHat, Phone, Mail, User
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { UserStatus, Role, SkillStatus, VerificationType } from '../../types';

export const CoordinatorDashboard = () => {
    const { state } = useAppContext();
    const { users, userSkills, skills, qualityIncidents } = state;
    const navigate = useNavigate();

    // --- DATA CALCULATIONS ---

    const stats = useMemo(() => {
        // 1. Total Workforce (Only active/trial Employees and Brigadiers)
        const totalWorkforce = users.filter(u => 
            (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR) && 
            (u.status === UserStatus.ACTIVE || u.status === UserStatus.TRIAL)
        ).length;

        // 2. Active Brigadirs
        const activeBrigadirs = users.filter(u => 
            u.role === Role.BRIGADIR && u.status === UserStatus.ACTIVE
        ).length;

        // 3. Quality Incidents (This Month)
        const now = new Date();
        const qualityAlerts = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;

        return { totalWorkforce, activeBrigadirs, qualityAlerts };
    }, [users, qualityIncidents]);

    // 4. Brigadir Overview Data
    const brigadirOverview = useMemo(() => {
        const brigadirs = users.filter(u => u.role === Role.BRIGADIR && u.status === UserStatus.ACTIVE);

        return brigadirs.map(brig => {
            // Team Members (Following the same filtering logic as the Employee List)
            const myTeam = users.filter(u => 
                u.assigned_brigadir_id === brig.id && 
                u.status !== UserStatus.INACTIVE &&
                u.role !== Role.CANDIDATE &&
                ![Role.ADMIN, Role.HR, Role.COORDINATOR].includes(u.role)
            );
            const teamIds = myTeam.map(u => u.id);

            // Pending Verifications in Team
            const pendingVerifications = userSkills.filter(us => {
                if (!teamIds.includes(us.user_id)) return false;
                const skill = skills.find(s => s.id === us.skill_id);
                // Only practical skills needing check
                if (!skill || skill.verification_type !== VerificationType.THEORY_PRACTICE) return false;
                return us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING;
            }).length;

            // Quality Incidents in Team (This Month)
            const now = new Date();
            const teamIncidents = qualityIncidents.filter(inc => {
                const d = new Date(inc.date);
                return teamIds.includes(inc.user_id) && 
                       d.getMonth() === now.getMonth() && 
                       d.getFullYear() === now.getFullYear();
            }).length;

            return {
                ...brig,
                teamSize: myTeam.length,
                pendingVerifications,
                teamIncidents
            };
        });
    }, [users, userSkills, skills, qualityIncidents]);

    // 5. Recent Alerts Feed
    const recentAlerts = useMemo(() => {
        return qualityIncidents
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5)
            .map(inc => {
                const user = users.find(u => u.id === inc.user_id);
                const skill = skills.find(s => s.id === inc.skill_id);
                return {
                    id: inc.id,
                    type: 'quality',
                    date: inc.date,
                    user: user ? `${user.first_name} ${user.last_name}` : 'Nieznany',
                    title: `Błąd: ${skill?.name_pl || 'Nieznana umiejętność'}`,
                    desc: inc.description
                };
            });
    }, [qualityIncidents, users, skills]);

    const KPI_TILE_CLASS = "bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-blue-300 transition-all cursor-pointer hover:shadow-md";

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 pb-24">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Pulpit Koordynatora</h1>
                    <p className="text-slate-500">Przegląd operacyjny projektów i zespołów.</p>
                </div>
            </div>

            {/* KPI TILES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Workforce */}
                <div className={KPI_TILE_CLASS} onClick={() => navigate('/coordinator/employees')}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users size={64} className="text-green-600"/>
                    </div>
                    <div className="text-sm font-bold text-green-600 uppercase tracking-wide flex items-center gap-2">
                        <Users size={16}/> Pracownicy podwładni
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900">{stats.totalWorkforce}</div>
                        <div className="text-xs text-slate-500 mt-1">
                            {stats.activeBrigadirs} Brygadzistów
                        </div>
                    </div>
                    <div className="absolute bottom-4 right-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <ChevronRight size={20} />
                    </div>
                </div>

                {/* 2. Global Quality */}
                <div className={KPI_TILE_CLASS} onClick={() => navigate('/coordinator/quality')}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertTriangle size={64} className="text-red-600"/>
                    </div>
                    <div className="text-sm font-bold text-red-600 uppercase tracking-wide flex items-center gap-2">
                        <AlertTriangle size={16}/> Zgłoszenia jakości
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900">{stats.qualityAlerts}</div>
                        <div className="text-xs text-slate-500 mt-1">W bieżącym miesiącu</div>
                    </div>
                    <div className="absolute bottom-4 right-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <ChevronRight size={20} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LIST: BRIGADIRS OVERVIEW */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <HardHat size={18} className="text-orange-600"/> Zespoły Brygadzistów
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">Brygadzista</th>
                                    <th className="px-6 py-4">Liczebność</th>
                                    <th className="px-6 py-4">Zadania</th>
                                    <th className="px-6 py-4">Jakość</th>
                                    <th className="px-6 py-4 text-right">Kontakt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {brigadirOverview.map(brig => (
                                    <tr key={brig.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-800">
                                            <div 
                                                className="flex items-center gap-3 cursor-pointer hover:text-blue-600 transition-colors group"
                                                onClick={() => navigate('/coordinator/employees', { state: { brigadirId: brig.id } })}
                                            >
                                                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    {brig.first_name[0]}{brig.last_name[0]}
                                                </div>
                                                <div className="underline-offset-4 group-hover:underline">{brig.first_name} {brig.last_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <button 
                                                onClick={() => navigate('/coordinator/employees', { state: { brigadirId: brig.id } })}
                                                className="hover:text-blue-600 hover:font-bold transition-all"
                                            >
                                                {brig.teamSize} os.
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            {brig.pendingVerifications > 0 ? (
                                                <button 
                                                    onClick={() => navigate('/coordinator/verifications', { state: { search: brig.last_name } })}
                                                    className="text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded text-xs hover:bg-orange-100 transition-colors"
                                                >
                                                    {brig.pendingVerifications} do weryf.
                                                </button>
                                            ) : (
                                                <span className="text-slate-400 text-xs">Na bieżąco</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {brig.teamIncidents > 0 ? (
                                                <button 
                                                    onClick={() => navigate('/coordinator/quality', { state: { search: brig.last_name } })}
                                                    className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs hover:bg-red-100 transition-colors"
                                                >
                                                    {brig.teamIncidents} uwag
                                                </button>
                                            ) : (
                                                <span className="text-green-600 font-bold text-xs flex items-center gap-1">
                                                    Brak uwag
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <a href={`tel:${brig.phone}`} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors" title={brig.phone}>
                                                    <Phone size={14}/>
                                                </a>
                                                <a href={`mailto:${brig.email}`} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors" title={brig.email}>
                                                    <Mail size={14}/>
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {brigadirOverview.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400">
                                            Brak aktywnych brygadziśców.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FEED: Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-500"/> Ostatnie Zgłoszenia
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {recentAlerts.map(alert => (
                            <div 
                                key={alert.id} 
                                className="p-3 bg-white border border-slate-100 rounded-lg hover:border-red-200 transition-colors shadow-sm cursor-pointer hover:bg-slate-50"
                                onClick={() => navigate('/coordinator/quality', { state: { search: alert.user.split(' ')[1] || alert.user } })}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-slate-500 uppercase">{new Date(alert.date).toLocaleDateString()}</span>
                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">Jakość</span>
                                </div>
                                <h4 className="font-bold text-slate-800 text-sm">{alert.title}</h4>
                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <User size={10}/> {alert.user}
                                </div>
                                <p className="text-xs text-slate-600 mt-2 italic bg-slate-50 p-2 rounded">
                                    "{alert.desc}"
                                </p>
                            </div>
                        ))}
                        {recentAlerts.length === 0 && (
                            <div className="text-center text-slate-400 text-sm py-8">
                                Brak ostatnich zgłoszeń.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};