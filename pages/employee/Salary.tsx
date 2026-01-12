
import React, { useMemo } from 'react';
import { Wallet, Calendar, TrendingUp, AlertTriangle, Clock, CheckCircle, Info, Lock, Shield } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { calculateSalary } from '../../services/salaryService';
import { ContractType, SkillStatus, VerificationType } from '../../types';
import { CONTRACT_TYPE_LABELS } from '../../constants';

export const EmployeeSalaryPage = () => {
    const { state } = useAppContext();
    const { currentUser, skills, userSkills, systemConfig, monthlyBonuses, qualityIncidents } = state;

    // Current Date Context
    const now = new Date();
    const currentMonthName = now.toLocaleString('pl-PL', { month: 'long' });
    const nextMonthName = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleString('pl-PL', { month: 'long' });

    if (!currentUser) return null;

    // Calculate Salary using the Service
    const salaryInfo = useMemo(() => {
        const defaultBonus = { kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 };
        return calculateSalary(
            currentUser.base_rate || systemConfig.baseRate,
            skills,
            userSkills.filter(us => us.user_id === currentUser.id),
            monthlyBonuses[currentUser.id] || defaultBonus,
            now,
            qualityIncidents
        );
    }, [currentUser, skills, userSkills, monthlyBonuses, now, qualityIncidents]);

    // Split bonuses for summary tiles
    const matrycaBonus = useMemo(() => {
        return salaryInfo.breakdown.details.activeSkills.reduce((acc, s) => {
            const skill = skills.find(sk => sk.name_pl === s.name);
            if (skill && skill.verification_type !== VerificationType.DOCUMENT) {
                return acc + s.amount;
            }
            return acc;
        }, 0);
    }, [salaryInfo, skills]);

    const uprawnieniaBonus = useMemo(() => {
        return salaryInfo.breakdown.details.activeSkills.reduce((acc, s) => {
            const skill = skills.find(sk => sk.name_pl === s.name);
            if (skill && skill.verification_type === VerificationType.DOCUMENT) {
                return acc + s.amount;
            }
            // Also include custom docs with generic names that might not be in skills list but are in activeSkills
            const isDoc = !skills.find(sk => sk.name_pl === s.name && sk.verification_type !== VerificationType.DOCUMENT);
            if (isDoc) return acc + s.amount;
            return acc;
        }, 0);
    }, [salaryInfo, skills]);

    // Contract Bonus Logic
    const contractType = currentUser.contract_type || ContractType.UOP;
    const contractBonus = systemConfig.contractBonuses[contractType] || 0;
    const studentBonus = (contractType === ContractType.UZ && currentUser.is_student) ? 3 : 0;
    const totalContractBonus = contractBonus + studentBonus;

    const currentTotalRate = salaryInfo.total + totalContractBonus;
    const nextMonthTotalRate = salaryInfo.nextMonthTotal + totalContractBonus;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 pb-24">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Moje Wynagrodzenie</h1>
                    <p className="text-slate-500">Szczegóły stawki i prognozy finansowe.</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                    <Calendar size={18}/>
                    <span>Okres rozliczeniowy: {currentMonthName.toUpperCase()} {now.getFullYear()}</span>
                </div>
            </div>

            {/* Main Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Wallet size={20} className="text-green-600"/> STAWKA OBECNA
                        </h3>
                        <span className="text-xs font-bold uppercase bg-green-100 text-green-700 px-2 py-1 rounded">{currentMonthName}</span>
                    </div>
                    <div className="text-4xl font-black text-slate-900 mb-2">{currentTotalRate.toFixed(2)} zł<span className="text-lg font-normal text-slate-400">/h</span></div>
                    <p className="text-sm text-slate-500">Obowiązuje do ostatniego dnia miesiąca.</p>
                </div>

                <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-6 relative overflow-hidden text-white">
                    <div className="absolute top-0 right-0 p-6 opacity-10"><TrendingUp size={100} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-blue-300 flex items-center gap-2"><TrendingUp size={20}/> PROGNOZA</h3>
                            <span className="text-xs font-bold uppercase bg-white/10 text-white px-2 py-1 rounded">OD 1. {nextMonthName.toUpperCase()}</span>
                        </div>
                        <div className="text-4xl font-black mb-2">{nextMonthTotalRate.toFixed(2)} zł<span className="text-lg font-normal text-slate-400">/h</span></div>
                        <p className="text-sm text-slate-400">Uwzględnia wszystkie potwierdzone umiejętności.</p>
                    </div>
                </div>
            </div>

            {/* Quick Breakdown Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Baza</div>
                    <div className="text-xl font-black text-slate-800">{salaryInfo.breakdown.base} zł</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm text-center">
                    <div className="text-[10px] text-green-600 font-black uppercase tracking-widest mb-1">Matryca</div>
                    <div className="text-xl font-black text-green-600">+{matrycaBonus.toFixed(2)} zł</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm text-center">
                    <div className="text-[10px] text-purple-600 font-black uppercase tracking-widest mb-1">Uprawnienia</div>
                    <div className="text-xl font-black text-purple-600">+{uprawnieniaBonus.toFixed(2)} zł</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm text-center">
                    <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-1">Umowa</div>
                    <div className="text-xl font-black text-blue-600">+{totalContractBonus.toFixed(2)} zł</div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Szczegóły składników Twojej stawki</h3>
                </div>
                <div className="divide-y divide-slate-100">
                    <div className="p-4 px-6 flex justify-between items-center bg-slate-50/50 font-medium">
                        <div>
                            <span className="text-slate-700">Stawka Bazowa + Umowa</span>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{CONTRACT_TYPE_LABELS[contractType]} {studentBonus > 0 ? ' (Student < 26)' : ''}</div>
                        </div>
                        <div className="font-black text-slate-900">{(salaryInfo.breakdown.base + totalContractBonus).toFixed(2)} zł</div>
                    </div>
                    {salaryInfo.breakdown.details.activeSkills.map((skill, idx) => (
                        <div key={`active-${idx}`} className="p-4 px-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                {skill.isBlocked ? <div className="text-red-500 bg-red-50 p-1.5 rounded" title="Zablokowane jakościowo"><Lock size={16}/></div> : <div className="text-green-600 bg-green-50 p-1.5 rounded" title="Aktywne"><CheckCircle size={16}/></div>}
                                <div>
                                    <span className={`font-bold ${skill.isBlocked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{skill.name}</span>
                                    {skill.isBlocked && <span className="block text-[10px] text-red-500 font-black uppercase tracking-tighter">Blokada Jakościowa</span>}
                                </div>
                            </div>
                            <div className={`font-black tabular-nums ${skill.isBlocked ? 'text-slate-300 line-through' : 'text-green-600'}`}>+{skill.amount.toFixed(2)} zł</div>
                        </div>
                    ))}
                    {salaryInfo.breakdown.details.pendingSkills.map((skill, idx) => (
                        <div key={`pending-${idx}`} className="p-4 px-6 flex justify-between items-center bg-blue-50/30 border-l-4 border-blue-200">
                            <div className="flex items-center gap-3">
                                <div className="text-blue-500 bg-white p-1.5 rounded shadow-sm"><Clock size={16}/></div>
                                <div><span className="font-bold text-slate-700">{skill.name}</span><span className="block text-[10px] text-blue-600 font-black uppercase tracking-tighter">Wchodzi od: {new Date(skill.effectiveFrom).toLocaleDateString()}</span></div>
                            </div>
                            <div className="text-right"><div className="font-bold text-slate-300 line-through text-xs">+0.00 zł</div><div className="font-black text-blue-600 text-sm">+{skill.amount.toFixed(2)} zł (Prognoza)</div></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
