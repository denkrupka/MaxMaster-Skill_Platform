
import React, { useMemo } from 'react';
import { 
    TrendingUp, Award, CheckCircle, Lock, User, Briefcase, 
    ChevronRight, Zap, BookOpen, Shield, DollarSign, List, Circle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { SkillStatus, Position } from '../../types';

export const EmployeeCareer = () => {
    const { state } = useAppContext();
    const { currentUser, skills, userSkills, positions, systemConfig } = state;

    if (!currentUser) return null;

    // --- LOGIC: Sort and Process Positions from DB ---
    const careerSteps = useMemo(() => {
        return [...positions].sort((a, b) => a.order - b.order);
    }, [positions]);

    // Determine current level based on target_position name
    const currentLevelIndex = useMemo(() => {
        const idx = careerSteps.findIndex(p => p.name === currentUser.target_position);
        return idx !== -1 ? idx : 0;
    }, [careerSteps, currentUser.target_position]);

    const getLevelData = (pos: Position) => {
        const requiredSkillIds = pos.required_skill_ids || [];
        
        // Find how many required skills the user has CONFIRMED
        const userConfirmedCount = requiredSkillIds.reduce((acc, sid) => {
            const hasSkill = userSkills.find(us => us.user_id === currentUser.id && us.skill_id === sid && us.status === SkillStatus.CONFIRMED);
            return hasSkill ? acc + 1 : acc;
        }, 0);

        const totalRequired = requiredSkillIds.length || 1; // Default to 1 to avoid div by zero
        const percentage = Math.min(100, Math.round((userConfirmedCount / totalRequired) * 100));

        // Calculate Salary Range for this position
        // If position has fixed monthly rate, use it. Otherwise calculate based on base + required skills.
        let minSalary = 0;
        let maxSalary = 0;
        let unit = 'zł/h';

        if (pos.salary_type === 'monthly') {
            minSalary = pos.min_monthly_rate || 0;
            maxSalary = pos.max_monthly_rate || 0;
            unit = 'zł/mc';
        } else {
            const base = systemConfig.baseRate;
            const reqSkills = skills.filter(s => requiredSkillIds.includes(s.id));
            const bonusSum = reqSkills.reduce((acc, s) => acc + s.hourly_bonus, 0);
            minSalary = base;
            maxSalary = base + bonusSum;
        }

        // Get unique categories for tags at the bottom
        const categories = Array.from(new Set(
            skills.filter(s => requiredSkillIds.includes(s.id)).map(s => s.category)
        ));

        return {
            userCount: userConfirmedCount,
            totalCount: requiredSkillIds.length,
            percentage,
            minSalary,
            maxSalary,
            unit,
            categories
        };
    };

    return (
        <div className="p-8 max-w-5xl mx-auto pb-32">
            <div className="mb-12">
                <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Ścieżka Rozwoju</h1>
                <p className="text-slate-500 font-medium">
                    Twoja droga awansu w MaxMaster. Zdobywaj umiejętności, aby odblokować kolejne poziomy i wyższe stawki.
                </p>
            </div>

            <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-[31px] top-8 bottom-8 w-1 bg-slate-100 rounded-full hidden md:block"></div>

                <div className="space-y-12">
                    {careerSteps.map((pos, index) => {
                        const isPast = index < currentLevelIndex;
                        const isCurrent = index === currentLevelIndex;
                        const isFuture = index > currentLevelIndex;
                        
                        const data = getLevelData(pos);

                        return (
                            <div key={pos.id} className="relative flex flex-col md:flex-row gap-10">
                                
                                {/* Timeline Icon - Matching screenshot style */}
                                <div className="hidden md:flex flex-col items-center z-10">
                                    <div className={`
                                        w-16 h-16 rounded-full border-4 flex items-center justify-center shadow-sm transition-all duration-500
                                        ${isCurrent ? 'bg-blue-600 border-blue-100 text-white scale-110 shadow-blue-200' : ''}
                                        ${isPast ? 'bg-green-50 border-green-100 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-300'}
                                    `}>
                                        {isPast ? <CheckCircle size={32}/> : (isCurrent ? <TrendingUp size={32}/> : <Circle size={32} className="fill-slate-100"/>)}
                                    </div>
                                </div>

                                {/* Content Card - Matching screenshot design */}
                                <div className={`flex-1 rounded-[32px] border transition-all duration-500 overflow-hidden ${
                                    isCurrent 
                                    ? 'bg-white border-blue-200 shadow-2xl ring-1 ring-blue-50' 
                                    : (isPast ? 'bg-slate-50/50 border-slate-200' : 'bg-white border-slate-100 opacity-60')
                                }`}>
                                    
                                    <div className="p-8">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-4">
                                                <h3 className={`text-2xl font-black tracking-tight ${isCurrent ? 'text-slate-900' : 'text-slate-700'}`}>
                                                    {pos.name}
                                                </h3>
                                                {isCurrent && (
                                                    <span className="bg-blue-600 text-white text-[10px] uppercase font-black px-3 py-1 rounded-full tracking-widest shadow-sm">
                                                        Twój poziom
                                                    </span>
                                                )}
                                                {isPast && (
                                                    <span className="bg-green-100 text-green-700 text-[10px] uppercase font-black px-3 py-1 rounded-full tracking-widest border border-green-200">
                                                        ZALICZONE
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Salary Display */}
                                            <div className="text-right">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">STAWKA PROGNOZOWANA</div>
                                                <div className={`text-xl font-black ${isCurrent ? 'text-blue-600' : 'text-slate-600'}`}>
                                                    {data.minSalary}-{data.maxSalary} <span className="text-xs font-bold text-slate-400">{data.unit}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-slate-500 text-sm font-medium mb-8">
                                            Poziom kariery: {index + 1}. Wymaga potwierdzenia kluczowych kompetencji technicznych.
                                        </p>

                                        {/* Responsibilities - List style from screenshot */}
                                        <div className="mb-10">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Briefcase size={14}/> ODPOWIEDZIALNOŚĆ
                                            </h4>
                                            <ul className="space-y-3">
                                                {(pos.responsibilities || []).map((resp, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-sm font-medium text-slate-700">
                                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCurrent ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                                        {resp}
                                                    </li>
                                                ))}
                                                {(!pos.responsibilities || pos.responsibilities.length === 0) && (
                                                    <li className="text-sm italic text-slate-400">Brak zdefiniowanych obowiązków.</li>
                                                )}
                                            </ul>
                                        </div>

                                        {/* Competence Progress - Styled exactly as requested */}
                                        <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                                            <div className="flex justify-between items-end mb-4">
                                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Award size={16} className={isCurrent ? 'text-blue-500' : 'text-slate-400'}/> WYMAGANE KOMPETENCJE
                                                </h4>
                                                <div className="text-right">
                                                    <span className={`text-xl font-black ${data.userCount >= data.totalCount && data.totalCount > 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                                        {data.userCount}
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-400"> / {data.totalCount}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Progress Bar */}
                                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-6 shadow-inner">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ease-out ${
                                                        data.userCount >= data.totalCount && data.totalCount > 0 ? 'bg-green-500' : (isCurrent ? 'bg-blue-600' : 'bg-slate-400')
                                                    }`} 
                                                    style={{ width: `${data.percentage}%` }}
                                                ></div>
                                            </div>

                                            {/* Tags at the bottom */}
                                            <div className="flex flex-wrap gap-2">
                                                {data.categories.map((cat, i) => (
                                                    <span key={i} className="text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white text-slate-500 px-3 py-1.5 rounded-lg shadow-sm">
                                                        {cat}
                                                    </span>
                                                ))}
                                                {data.categories.length === 0 && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white text-slate-400 px-3 py-1.5 rounded-lg shadow-sm">
                                                        PODSTAWY
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Future path reminder for current position */}
                                        {isCurrent && !isPast && (
                                            <div className="mt-8 flex justify-center">
                                                <div className="text-xs font-bold text-blue-600 bg-blue-50 px-6 py-3 rounded-2xl flex items-center gap-3 border border-blue-100 shadow-sm animate-pulse">
                                                    <Zap size={16} fill="currentColor"/>
                                                    Zdobądź brakujące kompetencje, aby awansować na kolejny poziom!
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {careerSteps.length === 0 && (
                        <div className="bg-white p-20 text-center rounded-[32px] border border-dashed border-slate-200 text-slate-400 font-bold italic">
                            Lista stanowisk nie została jeszcze skonfigurowana przez dział HR.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
