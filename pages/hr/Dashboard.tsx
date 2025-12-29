
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, FileText, Clock, ChevronRight, Bell, Activity, Plus, X, Calendar, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Role, UserStatus, SkillStatus, VerificationType } from '../../types';
import { Button } from '../../components/Button';

export const HRDashboard = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    
    // 1. Kandydaci (Active candidates, not rejected)
    const candidatesCount = state.users.filter(u => u.role === Role.CANDIDATE && u.status !== UserStatus.REJECTED && u.status !== UserStatus.PORTAL_BLOCKED).length;
    
    // 2. Okres Próbny (Trial status)
    const trialCount = state.users.filter(u => u.status === UserStatus.TRIAL).length;
    
    // 3. Pracownicy (Employees + Brigadirs, Active ONLY)
    // Exclude Trial users as they have their own tile, ensuring consistency with the Employees list.
    const employeesCount = state.users.filter(u => (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR) && u.status === UserStatus.ACTIVE).length;
    
    // 4. Dokumenty (Pending)
    const pendingDocs = state.userSkills.filter(us => {
        const skill = state.skills.find(s => s.id === us.skill_id);
        const isDoc = skill?.verification_type === VerificationType.DOCUMENT || us.skill_id.startsWith('doc_');
        return isDoc && us.status === SkillStatus.PENDING && !us.is_archived;
    }).length;

    // --- MERGED FEED: History + Notifications ---
    
    // 1. Map History Items
    const historyItems = state.candidateHistory.map(h => {
        const user = state.users.find(u => u.id === h.candidate_id);
        const userName = user ? `${user.first_name} ${user.last_name}` : 'Użytkownik';
        
        let performedByLabel = userName;
        if (h.performed_by === 'System') performedByLabel = 'System';
        else if (h.performed_by === 'HR') performedByLabel = 'HR Manager';
        else if (h.performed_by === 'Kandydat') performedByLabel = userName;

        return {
            id: h.id,
            type: 'history',
            title: h.action,
            subtitle: `Wykonał: ${performedByLabel}`,
            message: h.action, // For modal
            date: h.date,
            icon: Activity,
            colorClass: 'text-slate-400'
        };
    });

    // 2. Map Notification Items
    const notificationItems = state.appNotifications.map(n => ({
        id: n.id,
        type: 'notification',
        title: n.title,
        subtitle: n.message,
        message: n.message, // For modal
        date: n.createdAt,
        icon: Bell,
        colorClass: 'text-blue-500',
        link: n.link
    }));

    // 3. Combine, Sort, Limit
    const feed = [...historyItems, ...notificationItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 15);

    const StatCard = ({ title, count, icon: Icon, colorClass, path, action }: { title: string, count: number, icon: any, colorClass: string, path: string, action?: React.ReactNode }) => (
        <div 
            onClick={() => navigate(path)}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-all group flex flex-col justify-between"
        >
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
                    <Icon className={colorClass} size={20} />
                </div>
                <div className="flex items-end justify-between">
                    <p className="text-3xl font-bold text-slate-900">{count}</p>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
            </div>
            {action && (
                <div className="mt-4 pt-4 border-t border-slate-50" onClick={e => e.stopPropagation()}>
                    {action}
                </div>
            )}
        </div>
    );

    const renderDetailModal = () => {
        if (!selectedItem) return null;

        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedItem(null)}>
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative" onClick={e => e.stopPropagation()}>
                    <button 
                        onClick={() => setSelectedItem(null)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                    >
                        <X size={24} />
                    </button>

                    <div className="flex items-start gap-4 mb-4">
                        <div className={`p-3 rounded-full ${selectedItem.colorClass.replace('text-', 'bg-').replace('500', '100').replace('400', '100')} ${selectedItem.colorClass}`}>
                            <selectedItem.icon size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{selectedItem.title}</h3>
                            <div className="flex items-center text-xs text-slate-500 mt-1">
                                <Calendar size={12} className="mr-1"/>
                                {new Date(selectedItem.date).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 text-sm leading-relaxed mb-6 max-h-[60vh] overflow-y-auto">
                        {selectedItem.message || selectedItem.subtitle}
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setSelectedItem(null)}>
                            Zamknij
                        </Button>
                        {selectedItem.link && (
                            <Button onClick={() => { navigate(selectedItem.link); setSelectedItem(null); }}>
                                Przejdź do szczegółów <ArrowRight size={16} className="ml-2"/>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard HR</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* 1. Kandydaci */}
                <StatCard 
                    title="Kandydaci" 
                    count={candidatesCount} 
                    icon={UserPlus} 
                    colorClass="text-purple-500" 
                    path="/hr/candidates"
                    action={
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate('/hr/candidates', { state: { openAddCandidate: true } });
                            }}
                            className="w-full bg-purple-50 text-purple-700 hover:bg-purple-100 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                        >
                            <Plus size={16} className="mr-2"/> Dodaj Kandydata
                        </button>
                    }
                />
                
                {/* 2. Kandydaci na okresie próbnym */}
                <StatCard 
                    title="Kandydaci na okresie próbnym" 
                    count={trialCount} 
                    icon={Clock} 
                    colorClass="text-orange-500" 
                    path="/hr/trial"
                />

                {/* 3. Pracownicy */}
                <StatCard 
                    title="Pracownicy" 
                    count={employeesCount} 
                    icon={Users} 
                    colorClass="text-blue-500" 
                    path="/hr/employees"
                />

                {/* 4. Dokumenty do sprawdzenia */}
                <StatCard 
                    title="Dokumenty do sprawdzenia" 
                    count={pendingDocs} 
                    icon={FileText} 
                    colorClass="text-green-500" 
                    path="/hr/documents"
                />
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4">Ostatnie Aktywności</h3>
                <div className="space-y-0 divide-y divide-slate-100">
                    {feed.map(item => (
                        <div 
                            key={item.id} 
                            onClick={() => setSelectedItem(item)}
                            className="flex items-center justify-between py-4 group hover:bg-slate-50 transition-colors px-2 -mx-2 rounded-lg cursor-pointer"
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 ${item.colorClass}`}>
                                    <item.icon size={18} />
                                </div>
                                <div>
                                    <p className={`text-sm ${item.type === 'notification' ? 'font-bold text-slate-800' : 'font-medium text-slate-900'}`}>
                                        {item.title}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                        {item.subtitle}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                                <span className="text-xs text-slate-400 block">{new Date(item.date).toLocaleDateString()}</span>
                                <span className="text-xs text-slate-400 block">{new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                        </div>
                    ))}
                    {feed.length === 0 && <p className="text-slate-400 text-sm py-4">Brak ostatnich aktywności.</p>}
                </div>
            </div>
            {renderDetailModal()}
        </div>
    );
};
