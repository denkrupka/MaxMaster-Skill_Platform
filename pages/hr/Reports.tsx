
import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
    Legend, PieChart, Pie, LineChart, Line 
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Role, SkillStatus, MonthlyBonus, UserStatus, ContractType } from '../../types';
import { calculateSalary } from '../../services/salaryService';

export const HRReportsPage = () => {
    const { state } = useAppContext();
    const { systemConfig, currentCompany } = state;
    const [tab, setTab] = useState<'rates' | 'skills' | 'recruitment' | 'turnover'>('rates');

    // Filter users by company_id for multi-tenant isolation
    const companyUsers = useMemo(() => state.users.filter(u => u.company_id === currentCompany?.id), [state.users, currentCompany]);
    const companyUserIds = useMemo(() => new Set(companyUsers.map(u => u.id)), [companyUsers]);

    // --- DATA PROCESSING ---

    // 1. Rates Data (Active Employees & Trial)
    const ratesRawData = companyUsers
        .filter(u => (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR) && (u.status === UserStatus.ACTIVE || u.status === UserStatus.TRIAL))
        .map(u => {
            const defaultBonus: MonthlyBonus = { 
                kontrola_pracownikow: false, realizacja_planu: false, brak_usterek: false, brak_naduzyc_materialowych: false, staz_pracy_years: 0 
            };
            const salary = calculateSalary(
                u.base_rate || systemConfig.baseRate, 
                state.skills, 
                state.userSkills.filter(us => us.user_id === u.id), 
                state.monthlyBonuses[u.id] || defaultBonus
            );
            
            // Include contract bonus
            const contractBonus = systemConfig.contractBonuses[u.contract_type || ContractType.UOP] || 0;
            const totalRate = salary.total + contractBonus;

            const skillCount = state.userSkills.filter(us => us.user_id === u.id && us.status === SkillStatus.CONFIRMED).length;
            const brigadir = companyUsers.find(b => b.id === u.assigned_brigadir_id);
            return { ...u, totalRate, skillCount, brigadirName: brigadir ? `${brigadir.first_name} ${brigadir.last_name}` : '-' };
        });

    // 1b. Rates Chart Data (Histogram-like)
    const ratesChartData = useMemo(() => {
        const counts: Record<string, number> = {};
        ratesRawData.forEach(d => {
            const rateKey = d.totalRate.toFixed(2);
            counts[rateKey] = (counts[rateKey] || 0) + 1;
        });
        return Object.keys(counts)
            .sort((a, b) => parseFloat(a) - parseFloat(b))
            .map(rate => ({ rate: `${rate} zł`, count: counts[rate] }));
    }, [ratesRawData]);

    // 2. Skills Coverage Data (filtered by company users)
    const skillsData = state.skills.map(s => {
        // "Zaliczona Praktyka" = CONFIRMED (only for company users)
        const confirmed = state.userSkills.filter(us => companyUserIds.has(us.user_id) && us.skill_id === s.id && us.status === SkillStatus.CONFIRMED).length;
        // "Zaliczony Test" = THEORY_PASSED (only for company users)
        const theory = state.userSkills.filter(us => companyUserIds.has(us.user_id) && us.skill_id === s.id && us.status === SkillStatus.THEORY_PASSED).length;
        return { name: s.name_pl, confirmed, theory };
    });

    // 3. Recruitment & Employment Data
    const recruitmentData = useMemo(() => {
        // Group 1: Kandydaci (New / In Progress)
        // Statuses: INVITED, STARTED, TESTS_IN_PROGRESS
        const candidatesNew = companyUsers.filter(u => u.role === Role.CANDIDATE && (
            u.status === UserStatus.INVITED ||
            u.status === UserStatus.STARTED ||
            u.status === UserStatus.TESTS_IN_PROGRESS
        )).length;

        // Group 2: Kandydaci (Qualified / Advanced)
        // Statuses: TESTS_COMPLETED, INTERESTED, OFFER_SENT, DATA_REQUESTED, DATA_SUBMITTED
        const candidatesPassed = companyUsers.filter(u => u.role === Role.CANDIDATE && (
            u.status === UserStatus.TESTS_COMPLETED ||
            u.status === UserStatus.INTERESTED ||
            u.status === UserStatus.OFFER_SENT ||
            u.status === UserStatus.DATA_REQUESTED ||
            u.status === UserStatus.DATA_SUBMITTED
        )).length;

        // Group 3: Okres Próbny
        // Statuses: TRIAL
        const trialActive = companyUsers.filter(u => u.status === UserStatus.TRIAL).length;

        // Trial Rejected / Candidate Rejected
        const rejectedCount = companyUsers.filter(u => u.status === UserStatus.REJECTED || u.status === UserStatus.PORTAL_BLOCKED).length;

        // Group 4: Zatrudnieni
        // Statuses: ACTIVE
        const employeesActive = companyUsers.filter(u => (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR) && u.status === UserStatus.ACTIVE).length;

        // Group 5: Zwolnieni
        // Statuses: INACTIVE
        const employeesFired = companyUsers.filter(u => (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR) && u.status === UserStatus.INACTIVE).length;

        return [
            {
                category: 'Kandydaci',
                val1: candidatesNew, label1: 'W procesie', fill1: '#60a5fa', // Blue
                val2: candidatesPassed, label2: 'Zakwalifikowani', fill2: '#34d399' // Green
            },
            {
                category: 'Okres Próbny',
                val1: trialActive, label1: 'W trakcie', fill1: '#fbbf24', // Amber
                val2: rejectedCount, label2: 'Odrzuceni', fill2: '#f87171' // Red
            },
            {
                category: 'Zatrudnienie',
                val1: employeesActive, label1: 'Obecni', fill1: '#3b82f6', // Dark Blue
                val2: employeesFired, label2: 'Byli pracownicy', fill2: '#94a3b8' // Slate
            }
        ];
    }, [companyUsers]);

    // 4. Turnover Data (REAL DATA)
    
    // Helper to calculate turnover per month
    const turnoverRateData = useMemo(() => {
        const last6Months = [];
        const today = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthLabel = d.toLocaleString('pl-PL', { month: 'short' });

            // Start and end of that month
            const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
            const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);

            // Active users at the start of that month (approximate based on hired_date and termination_date)
            // A user was active if hired before endOfMonth AND (not terminated OR terminated after startOfMonth)
            const activeCount = companyUsers.filter(u => {
                const hired = new Date(u.hired_date);
                const terminated = u.termination_date ? new Date(u.termination_date) : null;

                const hiredBeforeEndOfMonth = hired <= endOfMonth;
                const notTerminatedYet = !terminated || terminated >= startOfMonth;

                return (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR) && hiredBeforeEndOfMonth && notTerminatedYet;
            }).length;

            // Terminated during this month
            const terminatedCount = companyUsers.filter(u => {
                if (!u.termination_date) return false;
                const termDate = new Date(u.termination_date);
                return (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR) &&
                       termDate >= startOfMonth && termDate <= endOfMonth;
            }).length;

            // Simplified Turnover Rate: (Terminated / Active) * 100
            // Guard against division by zero
            const rate = activeCount > 0 ? (terminatedCount / activeCount) * 100 : 0;

            last6Months.push({ month: monthLabel, rate: Number(rate.toFixed(1)) });
        }
        return last6Months;
    }, [companyUsers]);

    // Voluntary vs Involuntary (Real Data)
    const voluntaryData = useMemo(() => {
        const terminatedUsers = companyUsers.filter(u => (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR) && u.status === UserStatus.INACTIVE);
        
        const voluntaryCount = terminatedUsers.filter(u => u.termination_initiator === 'employee').length;
        const involuntaryCount = terminatedUsers.filter(u => u.termination_initiator === 'company').length;
        
        return [
            { name: 'Dobrowolna', value: voluntaryCount, fill: '#ef4444' }, // Red-ish
            { name: 'Wymuszona', value: involuntaryCount, fill: '#3b82f6' }, // Blue
        ];
    }, [state.users]);

    // Reasons (Real Data)
    const reasonsData = useMemo(() => {
        const terminatedUsers = state.users.filter(u => (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR) && u.status === UserStatus.INACTIVE);
        const counts: Record<string, number> = {};
        
        terminatedUsers.forEach(u => {
            const reason = u.termination_reason || 'Inne';
            counts[reason] = (counts[reason] || 0) + 1;
        });

        return Object.keys(counts)
            .map(r => ({ reason: r, count: counts[r] }))
            .sort((a,b) => b.count - a.count);
    }, [state.users]);


    // --- CUSTOM TOOLTIPS ---

    const CustomRecruitmentTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm">
                    <p className="font-bold text-slate-800 mb-2">{data.category}</p>
                    <p style={{ color: data.fill1 }}>{data.label1}: {data.val1}</p>
                    <p style={{ color: data.fill2 }}>{data.label2}: {data.val2}</p>
                </div>
            );
        }
        return null;
    };

    const exportCSV = () => {
        const headers = ["Imie", "Nazwisko", "Stanowisko", "Stawka Total", "Liczba Umiejetnosci", "Brygadzista"];
        const rows = ratesRawData.map(d => [d.first_name, d.last_name, d.target_position || d.role, d.totalRate, d.skillCount, d.brigadirName].join(","));
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "raport_stawek.csv");
        document.body.appendChild(link);
        link.click();
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Raporty HR</h1>
                {tab === 'rates' && <Button variant="outline" onClick={exportCSV}><Download size={18} className="mr-2"/> Eksportuj CSV</Button>}
            </div>

            <div className="flex space-x-4 mb-6 border-b border-slate-200 overflow-x-auto">
                <button onClick={() => setTab('rates')} className={`pb-3 px-3 font-medium text-sm whitespace-nowrap ${tab === 'rates' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Stawki Pracowników</button>
                <button onClick={() => setTab('skills')} className={`pb-3 px-3 font-medium text-sm whitespace-nowrap ${tab === 'skills' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Umiejętności</button>
                <button onClick={() => setTab('recruitment')} className={`pb-3 px-3 font-medium text-sm whitespace-nowrap ${tab === 'recruitment' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Rekrutacja</button>
                <button onClick={() => setTab('turnover')} className={`pb-3 px-3 font-medium text-sm whitespace-nowrap ${tab === 'turnover' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Rotacja</button>
            </div>

            {/* Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* 1. RATES CHART */}
                {tab === 'rates' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-900 mb-6">Rozkład Stawek Godzinowych (Netto)</h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ratesChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="rate" />
                                    <YAxis allowDecimals={false} label={{ value: 'Liczba Pracowników', angle: -90, position: 'insideLeft' }}/>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#f1f5f9' }}
                                    />
                                    <Bar dataKey="count" name="Liczba pracowników" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* 2. SKILLS CHART */}
                {tab === 'skills' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-900 mb-6">Pokrycie Umiejętności w Firmie</h3>
                        <div className="h-[500px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={skillsData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={180} style={{ fontSize: '12px' }} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#f1f5f9' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="confirmed" name="Zaliczona Praktyka" fill="#10b981" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="theory" name="Tylko Teoria" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* 3. RECRUITMENT CHART */}
                {tab === 'recruitment' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-900 mb-6">Lejek Rekrutacyjny i Zatrudnienie</h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={recruitmentData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="category" />
                                    <YAxis />
                                    <Tooltip content={<CustomRecruitmentTooltip />} cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="val1" stackId="a" fill="#8884d8" radius={[0, 0, 4, 4]}>
                                        {recruitmentData.map((entry, index) => (
                                            <Cell key={`cell-1-${index}`} fill={entry.fill1} />
                                        ))}
                                    </Bar>
                                    <Bar dataKey="val2" stackId="a" fill="#82ca9d" radius={[4, 4, 0, 0]}>
                                        {recruitmentData.map((entry, index) => (
                                            <Cell key={`cell-2-${index}`} fill={entry.fill2} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-6 flex justify-center gap-6 text-sm text-slate-500">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-400"></div> Kandydaci (W procesie)</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-400"></div> Kandydaci (Zakwalifikowani)</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div> Okres Próbny</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div> Zatrudnieni</div>
                        </div>
                    </div>
                )}

                {/* 4. TURNOVER CHART */}
                {tab === 'turnover' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-900 mb-6">Wskaźnik Rotacji (Ostatnie 6 m-cy)</h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={turnoverRateData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" />
                                        <YAxis unit="%" />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none' }}
                                        />
                                        <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-900 mb-6">Przyczyny Odejść</h3>
                            <div className="flex flex-col md:flex-row items-center gap-8">
                                <div className="h-64 w-64 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={voluntaryData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {voluntaryData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-center">
                                            <span className="block text-2xl font-bold text-slate-800">{voluntaryData.reduce((a,b) => a + b.value, 0)}</span>
                                            <span className="text-xs text-slate-500 uppercase">Odejść</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-3 w-full">
                                    <h4 className="font-bold text-sm text-slate-700 border-b pb-2">Top Powody</h4>
                                    {reasonsData.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="text-slate-600">{item.reason}</span>
                                            <span className="font-bold text-slate-900">{item.count}</span>
                                        </div>
                                    ))}
                                    {reasonsData.length === 0 && <p className="text-slate-400 text-sm">Brak danych.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
