
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, PieChart as PieChartIcon, FileSpreadsheet, Printer, Download,
  Calendar, Users, Clock, AlertCircle, Loader2, Save, Play, Trash2, Filter,
  ChevronDown, ChevronRight, X, TrendingUp, UserCheck, UserX, AlarmClock
} from 'lucide-react';
import { CompanyTimesheetsPage } from './Timesheets';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  User, WorkerDay, Department, SavedReport, Timesheet,
  UserStatus, Role, TimesheetStatus
} from '../../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const formatMinutes = (min: number): string => {
  if (!min || min <= 0) return '0h 0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
};

const formatCurrency = (val: number): string =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(val);

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#ec4899'];

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

type ReportTab = 'time_salary' | 'attendance' | 'timesheet' | 'saved';

// ---------------------------------------------------------------
// Time & Salary Report
// ---------------------------------------------------------------

interface TimeSalaryData {
  userId: string;
  name: string;
  workDays: number;
  workMinutes: number;
  overtimeMinutes: number;
  baseSalary: number;
  overtimeSalary: number;
  totalSalary: number;
}

interface DailyHoursData {
  date: string;
  hours: number;
}

const TimeSalaryReport: React.FC<{
  companyId: string;
  companyUsers: User[];
  departments: Department[];
  onSaveReport: (name: string, params: Record<string, any>) => void;
}> = ({ companyId, companyUsers, departments, onSaveReport }) => {
  const { state } = useAppContext();

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [data, setData] = useState<TimeSalaryData[]>([]);
  const [dailyData, setDailyData] = useState<DailyHoursData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEmployeeFilter, setShowEmployeeFilter] = useState(false);

  // Filtered employees by department
  const filteredUsers = useMemo(() => {
    if (selectedDept === 'all') return companyUsers;
    // Would need department_members join, simplify to all for now
    return companyUsers;
  }, [companyUsers, selectedDept]);

  const runReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('worker_days')
        .select('*')
        .eq('company_id', companyId)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      const { data: workerDays, error } = await query;
      if (error) throw error;

      const targetUserIds = selectedEmployees.length > 0
        ? selectedEmployees
        : filteredUsers.map(u => u.id);

      // Aggregate by employee
      const byUser = new Map<string, WorkerDay[]>();
      (workerDays || []).forEach((wd: WorkerDay) => {
        if (!targetUserIds.includes(wd.user_id)) return;
        const arr = byUser.get(wd.user_id) || [];
        arr.push(wd);
        byUser.set(wd.user_id, arr);
      });

      const results: TimeSalaryData[] = [];
      byUser.forEach((days, userId) => {
        const user = companyUsers.find(u => u.id === userId);
        if (!user) return;

        const workDays = days.filter(d => ['present', 'late', 'incomplete'].includes(d.status)).length;
        const workMinutes = days.reduce((s, d) => s + (d.work_time_minutes || 0), 0);
        const overtimeMinutes = days.reduce((s, d) => s + (d.overtime_minutes || 0), 0);

        const hourlyRate = user.base_rate || state.systemConfig.baseRate || 25;
        const baseSalary = Math.round((workMinutes / 60) * hourlyRate * 100) / 100;
        const overtimeSalary = Math.round((overtimeMinutes / 60) * hourlyRate * 1.5 * 100) / 100;

        results.push({
          userId,
          name: `${user.last_name} ${user.first_name}`,
          workDays,
          workMinutes,
          overtimeMinutes,
          baseSalary,
          overtimeSalary,
          totalSalary: baseSalary + overtimeSalary
        });
      });

      results.sort((a, b) => a.name.localeCompare(b.name));
      setData(results);

      // Daily aggregation for bar chart
      const byDate = new Map<string, number>();
      (workerDays || []).forEach((wd: WorkerDay) => {
        if (!targetUserIds.includes(wd.user_id)) return;
        const current = byDate.get(wd.date) || 0;
        byDate.set(wd.date, current + (wd.work_time_minutes || 0));
      });

      const daily: DailyHoursData[] = [];
      byDate.forEach((minutes, date) => {
        daily.push({ date, hours: Math.round((minutes / 60) * 10) / 10 });
      });
      daily.sort((a, b) => a.date.localeCompare(b.date));
      setDailyData(daily);
    } catch (err) {
      console.error('Error running time/salary report:', err);
    }
    setLoading(false);
  };

  const totals = useMemo(() => ({
    workDays: data.reduce((s, d) => s + d.workDays, 0),
    workMinutes: data.reduce((s, d) => s + d.workMinutes, 0),
    overtimeMinutes: data.reduce((s, d) => s + d.overtimeMinutes, 0),
    totalSalary: data.reduce((s, d) => s + d.totalSalary, 0)
  }), [data]);

  const handleExportExcel = () => {
    const wsData = data.map(d => ({
      'Pracownik': d.name,
      'Dni robocze': d.workDays,
      'Godziny pracy': formatMinutes(d.workMinutes),
      'Nadgodziny': formatMinutes(d.overtimeMinutes),
      'Podstawa (PLN)': d.baseSalary,
      'Nadgodziny (PLN)': d.overtimeSalary,
      'Lacznie (PLN)': d.totalSalary
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Czas i wynagrodzenie');
    XLSX.writeFile(wb, `raport_czas_wynagrodzenie_${dateFrom}_${dateTo}.xlsx`);
  };

  const handleExportPDF = () => {
    const rows = data.map(d => `<tr>
      <td style="padding:4px 8px;border:1px solid #ddd">${d.name}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${d.workDays}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(d.workMinutes)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(d.overtimeMinutes)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(d.baseSalary)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(d.overtimeSalary)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right;font-weight:bold">${formatCurrency(d.totalSalary)}</td>
    </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Raport: Czas i wynagrodzenie</title>
<style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}th{background:#f1f5f9;padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:12px}td{font-size:11px}h1{font-size:18px}h2{font-size:14px;color:#666}</style>
</head><body>
<h1>Raport: Czas i wynagrodzenie</h1>
<h2>Okres: ${dateFrom} - ${dateTo}</h2>
<table><thead><tr><th>Pracownik</th><th>Dni</th><th>Godziny</th><th>Nadgodziny</th><th>Podstawa</th><th>Nadg. PLN</th><th>Lacznie</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr style="font-weight:bold;background:#f8fafc"><td style="padding:4px 8px;border:1px solid #ddd">RAZEM</td>
<td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${totals.workDays}</td>
<td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(totals.workMinutes)}</td>
<td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(totals.overtimeMinutes)}</td>
<td colspan="2" style="padding:4px 8px;border:1px solid #ddd"></td>
<td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(totals.totalSalary)}</td>
</tr></tfoot></table>
<p style="margin-top:20px;font-size:10px;color:#999">Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const handleSave = () => {
    const name = prompt('Nazwa raportu:');
    if (name) {
      onSaveReport(name, {
        type: 'time_salary',
        dateFrom,
        dateTo,
        selectedDept,
        selectedEmployees
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Od</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Do</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dzial</label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="all">Wszystkie dzialy</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">Pracownicy</label>
            <button
              onClick={() => setShowEmployeeFilter(!showEmployeeFilter)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white flex items-center gap-2 min-w-[180px]"
            >
              <Users className="w-4 h-4 text-slate-400" />
              {selectedEmployees.length === 0 ? 'Wszyscy' : `Wybrani: ${selectedEmployees.length}`}
              <ChevronDown className="w-3 h-3 ml-auto" />
            </button>
            {showEmployeeFilter && (
              <div className="absolute z-20 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-64 max-h-60 overflow-auto">
                <button
                  onClick={() => { setSelectedEmployees([]); setShowEmployeeFilter(false); }}
                  className="w-full text-left px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded mb-1"
                >
                  Zaznacz wszystkich
                </button>
                {filteredUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(u.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedEmployees(prev => [...prev, u.id]);
                        } else {
                          setSelectedEmployees(prev => prev.filter(id => id !== u.id));
                        }
                      }}
                      className="rounded"
                    />
                    {u.last_name} {u.first_name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <button
            onClick={runReport}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generuj raport
          </button>
        </div>
      </div>

      {data.length > 0 && (
        <>
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={handleExportExcel} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-green-600" /> Eksport Excel
            </button>
            <button onClick={handleExportPDF} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 flex items-center gap-2">
              <Printer className="w-4 h-4 text-red-600" /> Eksport PDF
            </button>
            <button onClick={handleSave} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 flex items-center gap-2">
              <Save className="w-4 h-4 text-blue-600" /> Zapisz raport
            </button>
          </div>

          {/* Bar Chart - Daily Hours */}
          {dailyData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Godziny pracy dziennie</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getDate()}.${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: 'Godziny', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <Tooltip
                    formatter={(value: number) => [`${value}h`, 'Godziny pracy']}
                    labelFormatter={(label: string) => new Date(label).toLocaleDateString('pl-PL')}
                  />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Aggregation Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Pracownik</th>
                  <th className="text-center px-3 py-3 font-medium text-slate-600">Dni robocze</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Godziny</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Nadgodziny</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Podstawa</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Nadg. PLN</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Lacznie</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.userId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{d.name}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{d.workDays}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatMinutes(d.workMinutes)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatMinutes(d.overtimeMinutes)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(d.baseSalary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(d.overtimeSalary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700">{formatCurrency(d.totalSalary)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3">RAZEM ({data.length})</td>
                  <td className="px-3 py-3 text-center">{totals.workDays}</td>
                  <td className="px-3 py-3 text-right">{formatMinutes(totals.workMinutes)}</td>
                  <td className="px-3 py-3 text-right">{formatMinutes(totals.overtimeMinutes)}</td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 text-right text-emerald-700">{formatCurrency(totals.totalSalary)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {!loading && data.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Ustaw filtry i kliknij "Generuj raport" aby zobaczyc dane.</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------
// Attendance Report
// ---------------------------------------------------------------

interface AttendanceMetrics {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  timeOffDays: number;
  holidayDays: number;
  attendancePercent: number;
}

const AttendanceReport: React.FC<{
  companyId: string;
  companyUsers: User[];
  departments: Department[];
  onSaveReport: (name: string, params: Record<string, any>) => void;
}> = ({ companyId, companyUsers, departments, onSaveReport }) => {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [metrics, setMetrics] = useState<AttendanceMetrics | null>(null);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const runReport = async () => {
    setLoading(true);
    try {
      const { data: workerDays, error } = await supabase
        .from('worker_days')
        .select('*')
        .eq('company_id', companyId)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) throw error;

      const days = workerDays || [];
      const totalDays = days.length;
      const presentDays = days.filter(d => d.status === 'present').length;
      const lateDays = days.filter(d => d.status === 'late').length;
      const absentDays = days.filter(d => d.status === 'absent').length;
      const timeOffDays = days.filter(d => ['time_off', 'day_off'].includes(d.status)).length;
      const holidayDays = days.filter(d => ['holiday'].includes(d.status)).length;
      const otherDays = totalDays - presentDays - lateDays - absentDays - timeOffDays - holidayDays;

      const businessDays = totalDays - holidayDays - timeOffDays;
      const attendancePercent = businessDays > 0
        ? Math.round(((presentDays + lateDays) / businessDays) * 100)
        : 0;

      setMetrics({
        totalDays,
        presentDays,
        lateDays,
        absentDays,
        timeOffDays,
        holidayDays,
        attendancePercent
      });

      setPieData([
        { name: 'Obecni', value: presentDays },
        { name: 'Spoznieni', value: lateDays },
        { name: 'Nieobecni', value: absentDays },
        { name: 'Urlopy / Wolne', value: timeOffDays },
        { name: 'Swieta', value: holidayDays },
        ...(otherDays > 0 ? [{ name: 'Inne', value: otherDays }] : [])
      ].filter(d => d.value > 0));
    } catch (err) {
      console.error('Error running attendance report:', err);
    }
    setLoading(false);
  };

  const handleSave = () => {
    const name = prompt('Nazwa raportu:');
    if (name) {
      onSaveReport(name, {
        type: 'attendance',
        dateFrom,
        dateTo,
        selectedDept
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Od</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Do</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dzial</label>
            <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              <option value="all">Wszystkie dzialy</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1" />
          <button onClick={runReport} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generuj raport
          </button>
        </div>
      </div>

      {metrics && (
        <>
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 flex items-center gap-2">
              <Save className="w-4 h-4 text-blue-600" /> Zapisz raport
            </button>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                <UserCheck className="w-4 h-4 text-green-500" />
                Obecnosc %
              </div>
              <div className="text-3xl font-bold text-green-600">{metrics.attendancePercent}%</div>
              <div className="text-xs text-slate-400 mt-1">{metrics.presentDays + metrics.lateDays} / {metrics.totalDays - metrics.holidayDays - metrics.timeOffDays} dni</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                <AlarmClock className="w-4 h-4 text-amber-500" />
                Spoznienia
              </div>
              <div className="text-3xl font-bold text-amber-600">{metrics.lateDays}</div>
              <div className="text-xs text-slate-400 mt-1">dni ze spoznieniem</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                <UserX className="w-4 h-4 text-red-500" />
                Nieobecnosci
              </div>
              <div className="text-3xl font-bold text-red-600">{metrics.absentDays}</div>
              <div className="text-xs text-slate-400 mt-1">dni nieobecnosci</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                Zwolnienia / Urlopy
              </div>
              <div className="text-3xl font-bold text-blue-600">{metrics.timeOffDays}</div>
              <div className="text-xs text-slate-400 mt-1">dni wolnych</div>
            </div>
          </div>

          {/* Pie Chart */}
          {pieData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Rozklad statusow obecnosci</h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} dni`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !metrics && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <PieChartIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Ustaw filtry i kliknij "Generuj raport" aby zobaczyc dane obecnosci.</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------
// Saved Reports
// ---------------------------------------------------------------

const SavedReportsSection: React.FC<{
  companyId: string;
  savedReports: SavedReport[];
  onRun: (report: SavedReport) => void;
  onDelete: (id: string) => void;
}> = ({ companyId, savedReports, onRun, onDelete }) => {
  const typeLabels: Record<string, string> = {
    time_salary: 'Czas i wynagrodzenie',
    attendance: 'Obecnosc',
    timesheet: 'Karta czasu pracy',
    custom: 'Niestandardowy'
  };

  if (savedReports.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
        <Save className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p>Brak zapisanych raportow.</p>
        <p className="text-sm mt-2">Wygeneruj raport i kliknij "Zapisz raport" aby zachowac konfiguracje.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Nazwa</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Typ</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Utworzono</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {savedReports.map(report => (
            <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{report.name}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                  {typeLabels[report.type] || report.type}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {new Date(report.created_at).toLocaleDateString('pl-PL')}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onRun(report)}
                  className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 mr-2"
                >
                  <Play className="w-3 h-3 inline mr-1" />
                  Uruchom
                </button>
                <button
                  onClick={() => onDelete(report.id)}
                  className="px-3 py-1 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  Usun
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------

export const CompanyReportsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, currentCompany, users } = state;

  const [activeTab, setActiveTab] = useState<ReportTab>('time_salary');
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const companyId = currentCompany?.id;

  const companyUsers = useMemo(() => {
    if (!companyId) return [];
    return users.filter(u =>
      u.company_id === companyId &&
      [UserStatus.ACTIVE, UserStatus.TRIAL].includes(u.status as UserStatus)
    );
  }, [users, companyId]);

  // Load saved reports and departments
  useEffect(() => {
    if (!companyId) return;

    const load = async () => {
      setLoadingSaved(true);
      try {
        const [
          { data: reports },
          { data: depts }
        ] = await Promise.all([
          supabase.from('saved_reports').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
          supabase.from('departments').select('*').eq('company_id', companyId).eq('is_archived', false)
        ]);
        setSavedReports(reports || []);
        setDepartments(depts || []);
      } catch (err) {
        console.error('Error loading reports data:', err);
      }
      setLoadingSaved(false);
    };
    load();
  }, [companyId]);

  // Save report configuration
  const handleSaveReport = async (name: string, params: Record<string, any>) => {
    if (!companyId || !currentUser) return;
    try {
      const { data, error } = await supabase
        .from('saved_reports')
        .insert([{
          company_id: companyId,
          name,
          type: params.type || 'custom',
          parameters: params,
          created_by: currentUser.id
        }])
        .select()
        .single();

      if (!error && data) {
        setSavedReports(prev => [data, ...prev]);
      }
    } catch (err) {
      console.error('Error saving report:', err);
    }
  };

  // Run saved report
  const handleRunSavedReport = (report: SavedReport) => {
    const type = report.parameters?.type || report.type;
    if (type === 'time_salary') {
      setActiveTab('time_salary');
    } else if (type === 'attendance') {
      setActiveTab('attendance');
    }
    // In a more advanced implementation, would also restore filter parameters
  };

  // Delete saved report
  const handleDeleteReport = async (id: string) => {
    try {
      await supabase.from('saved_reports').delete().eq('id', id);
      setSavedReports(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Error deleting report:', err);
    }
  };

  // Access check
  if (!currentUser || ![Role.COMPANY_ADMIN, Role.HR, Role.COORDINATOR].includes(currentUser.role as Role)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-800">Brak dostepu</h2>
          <p className="text-red-600">Nie masz uprawnien do przeglAdania raportow.</p>
        </div>
      </div>
    );
  }

  const tabs: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
    { key: 'time_salary', label: 'Czas i wynagrodzenie', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'attendance', label: 'Obecnosc', icon: <PieChartIcon className="w-4 h-4" /> },
    { key: 'timesheet', label: 'Tabela ewidencji', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { key: 'saved', label: `Zapisane raporty (${savedReports.length})`, icon: <Save className="w-4 h-4" /> }
  ];

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Raporty</h1>
        <p className="text-slate-500 mt-1">
          Analizuj czas pracy, obecnosc i wynagrodzenia pracownikow
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6 max-w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'time_salary' && companyId && (
        <TimeSalaryReport
          companyId={companyId}
          companyUsers={companyUsers}
          departments={departments}
          onSaveReport={handleSaveReport}
        />
      )}

      {activeTab === 'attendance' && companyId && (
        <AttendanceReport
          companyId={companyId}
          companyUsers={companyUsers}
          departments={departments}
          onSaveReport={handleSaveReport}
        />
      )}

      {activeTab === 'timesheet' && companyId && (
        <div className="-mx-4 lg:-mx-6 -mb-4 lg:-mb-6">
          <CompanyTimesheetsPage embedded />
        </div>
      )}

      {activeTab === 'saved' && companyId && (
        <SavedReportsSection
          companyId={companyId}
          savedReports={savedReports}
          onRun={handleRunSavedReport}
          onDelete={handleDeleteReport}
        />
      )}
    </div>
  );
};
