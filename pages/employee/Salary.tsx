
import React, { useMemo } from 'react';
import { Wallet, Calendar, TrendingUp, AlertTriangle, Clock, CheckCircle, Info, Lock } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { calculateSalary } from '../../services/salaryService';
import { ContractType } from '../../types';
import { CONTRACT_TYPE_LABELS } from '../../constants';

export const EmployeeSalaryPage = () => {
    const { state } = useAppContext();
    const { currentUser, skills, userSkills, systemConfig, monthlyBonuses } = state;

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
            now
        );
    }, [currentUser, skills, userSkills, monthlyBonuses, now]);

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

            {/* Notification Banner about M+1 Rule */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4 items-start">
                <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
                    <Info size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-amber-800 text-sm mb-1">Zasada naliczania dodatków</h4>
                    <p className="text-sm text-amber-700 leading-relaxed">
                        Pamiętaj: Każda nowa umiejętność (zaliczony test + praktyka) zwiększa Twoją stawkę <strong>od 1. dnia kolejnego miesiąca</strong>.
                    </p>
                </div>
            </div>

            {/* Rate Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Current Rate */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Wallet size={20} className="text-green-600"/> STAWKA OBECNA
                        </h3>
                        <span className="text-xs font-bold uppercase bg-green-100 text-green-700 px-2 py-1 rounded">
                            {currentMonthName}
                        </span>
                    </div>
                    <div className="text-4xl font-bold text-slate-900 mb-2">
                        {currentTotalRate.toFixed(2)} zł<span className="text-lg font-normal text-slate-400">/h</span>
                    </div>
                    <p className="text-sm text-slate-500">
                        Obowiązuje do ostatniego dnia miesiąca.
                    </p>
                </div>

                {/* Projected Rate */}
                <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-6 relative overflow-hidden text-white">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <TrendingUp size={100} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-blue-300 flex items-center gap-2">
                                <TrendingUp size={20}/> PROGNOZA
                            </h3>
                            <span className="text-xs font-bold uppercase bg-white/10 text-white px-2 py-1 rounded">
                                OD 1. {nextMonthName.toUpperCase()}
                            </span>
                        </div>
                        <div className="text-4xl font-bold mb-2">
                            {nextMonthTotalRate.toFixed(2)} zł<span className="text-lg font-normal text-slate-400">/h</span>
                        </div>
                        <p className="text-sm text-slate-400">
                            Uwzględnia wszystkie potwierdzone umiejętności.
                        </p>
                    </div>
                </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Składniki Twojej Stawki</h3>
                </div>
                
                <div className="divide-y divide-slate-100">
                    {/* 1. Base + Contract */}
                    <div className="p-4 px-6 flex justify-between items-center bg-slate-50/50">
                        <div>
                            <span className="font-bold text-slate-700">Stawka Bazowa + Umowa</span>
                            <div className="text-xs text-slate-500">
                                {CONTRACT_TYPE_LABELS[contractType]} {studentBonus > 0 ? '(+Student)' : ''}
                            </div>
                        </div>
                        <div className="font-bold text-slate-900">
                            {(salaryInfo.breakdown.base + totalContractBonus).toFixed(2)} zł
                        </div>
                    </div>

                    {/* 2. Active Skills */}
                    {salaryInfo.breakdown.details.activeSkills.map((skill, idx) => (
                        <div key={`active-${idx}`} className="p-4 px-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                {skill.isBlocked ? (
                                    <div className="text-red-500 bg-red-50 p-1.5 rounded" title="Zablokowane jakościowo">
                                        <Lock size={16}/>
                                    </div>
                                ) : (
                                    <div className="text-green-600 bg-green-50 p-1.5 rounded" title="Aktywne">
                                        <CheckCircle size={16}/>
                                    </div>
                                )}
                                <div>
                                    <span className={`font-medium ${skill.isBlocked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                        {skill.name}
                                    </span>
                                    {skill.isBlocked && (
                                        <span className="block text-xs text-red-500 font-bold">Blokada Jakościowa (Bieżący miesiąc)</span>
                                    )}
                                </div>
                            </div>
                            <div className={`font-bold ${skill.isBlocked ? 'text-slate-300 line-through' : 'text-green-600'}`}>
                                +{skill.amount.toFixed(2)} zł
                            </div>
                        </div>
                    ))}

                    {/* 3. Pending Skills (Next Month) */}
                    {salaryInfo.breakdown.details.pendingSkills.map((skill, idx) => {
                        const effectiveDate = new Date(skill.effectiveFrom);
                        return (
                            <div key={`pending-${idx}`} className="p-4 px-6 flex justify-between items-center bg-blue-50/30 border-l-4 border-blue-200">
                                <div className="flex items-center gap-3">
                                    <div className="text-blue-500 bg-white p-1.5 rounded shadow-sm">
                                        <Clock size={16}/>
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-700">{skill.name}</span>
                                        <span className="block text-xs text-blue-600 font-medium">
                                            Wchodzi od: {effectiveDate.toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-slate-300 line-through text-xs">
                                        +0.00 zł
                                    </div>
                                    <div className="font-bold text-blue-600 text-sm">
                                        (Prognoza: +{skill.amount.toFixed(2)} zł)
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* 4. Monthly Bonuses */}
                    {salaryInfo.breakdown.monthly > 0 && (
                        <div className="p-4 px-6 flex justify-between items-center bg-purple-50/30">
                            <div className="flex items-center gap-3">
                                <div className="text-purple-600 bg-white p-1.5 rounded shadow-sm">
                                    <TrendingUp size={16}/>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-700">Premie Miesięczne / Stażowe</span>
                                </div>
                            </div>
                            <div className="font-bold text-purple-600">
                                +{salaryInfo.breakdown.monthly.toFixed(2)} zł
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="p-4 bg-slate-50 text-xs text-center text-slate-400 border-t border-slate-100">
                    System MaxMaster Skills • Dane aktualizowane w czasie rzeczywistym
                </div>
            </div>
        </div>
    );
};
