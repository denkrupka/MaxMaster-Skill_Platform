
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, DollarSign, Download, FileSpreadsheet, Printer,
  ChevronLeft, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  Users, Loader2, RefreshCw, Filter, X
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  User, Timesheet, TimesheetStatus, WorkerDay, UserStatus, Role, Department
} from '../../types';
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

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

const STATUS_LABELS: Record<TimesheetStatus, string> = {
  draft: 'Szkic',
  confirmed: 'Potwierdzony',
  paid: 'Wypłacony'
};

const STATUS_COLORS: Record<TimesheetStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  confirmed: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700'
};

// ---------------------------------------------------------------
// Employee Detail Modal
// ---------------------------------------------------------------

interface DayDetail {
  date: string;
  status: string;
  work_minutes: number;
  break_minutes: number;
  overtime_minutes: number;
  is_weekend: boolean;
  is_holiday: boolean;
  note?: string;
}

const EmployeeTimesheetDetail: React.FC<{
  employee: User;
  year: number;
  month: number;
  companyId: string;
  onClose: () => void;
}> = ({ employee, year, month, companyId, onClose }) => {
  const [days, setDays] = useState<DayDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDays = async () => {
      setLoading(true);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      const { data } = await supabase
        .from('worker_days')
        .select('*')
        .eq('user_id', employee.id)
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (data) {
        setDays(data.map((d: WorkerDay) => ({
          date: d.date,
          status: d.status,
          work_minutes: d.work_time_minutes || 0,
          break_minutes: d.break_time_minutes || 0,
          overtime_minutes: d.overtime_minutes || 0,
          is_weekend: d.is_weekend || false,
          is_holiday: d.is_holiday || false,
          note: d.note
        })));
      }
      setLoading(false);
    };
    loadDays();
  }, [employee.id, year, month, companyId]);

  const totalWork = days.reduce((s, d) => s + d.work_minutes, 0);
  const totalBreak = days.reduce((s, d) => s + d.break_minutes, 0);
  const totalOvertime = days.reduce((s, d) => s + d.overtime_minutes, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {employee.first_name} {employee.last_name}
            </h3>
            <p className="text-sm text-slate-500">
              {MONTHS[month - 1]} {year} — Szczegoly dnia po dniu
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Czas pracy:</span>{' '}
            <span className="font-semibold">{formatMinutes(totalWork)}</span>
          </div>
          <div>
            <span className="text-slate-500">Przerwy:</span>{' '}
            <span className="font-semibold">{formatMinutes(totalBreak)}</span>
          </div>
          <div>
            <span className="text-slate-500">Nadgodziny:</span>{' '}
            <span className="font-semibold">{formatMinutes(totalOvertime)}</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : days.length === 0 ? (
            <div className="text-center p-12 text-slate-400">
              Brak danych o czasie pracy za wybrany okres.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Data</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Praca</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Przerwy</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Nadgodziny</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Uwagi</th>
                </tr>
              </thead>
              <tbody>
                {days.map(d => {
                  const dayName = new Date(d.date).toLocaleDateString('pl-PL', { weekday: 'short' });
                  const bgClass = d.is_weekend ? 'bg-amber-50' : d.is_holiday ? 'bg-red-50' : '';
                  return (
                    <tr key={d.date} className={`border-b border-slate-100 hover:bg-slate-50 ${bgClass}`}>
                      <td className="px-4 py-2">
                        <span className="font-medium">{new Date(d.date).toLocaleDateString('pl-PL')}</span>
                        <span className="text-slate-400 ml-1">({dayName})</span>
                        {d.is_weekend && <span className="ml-1 text-xs text-amber-600">[WKD]</span>}
                        {d.is_holiday && <span className="ml-1 text-xs text-red-600">[SW]</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          d.status === 'present' ? 'bg-green-100 text-green-700' :
                          d.status === 'late' ? 'bg-amber-100 text-amber-700' :
                          d.status === 'absent' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {d.status === 'present' ? 'Obecny' :
                           d.status === 'late' ? 'Spozniony' :
                           d.status === 'absent' ? 'Nieobecny' :
                           d.status === 'day_off' ? 'Wolne' :
                           d.status === 'holiday' ? 'Swiety' :
                           d.status === 'time_off' ? 'Urlop' :
                           d.status === 'incomplete' ? 'Niekompletny' :
                           d.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatMinutes(d.work_minutes)}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatMinutes(d.break_minutes)}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatMinutes(d.overtime_minutes)}</td>
                      <td className="px-4 py-2 text-slate-500 truncate max-w-[200px]">{d.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------

export const CompanyTimesheetsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { state } = useAppContext();
  const { currentUser, currentCompany, users } = state;

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState<User | null>(null);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const companyId = currentCompany?.id;

  // Filtered company employees
  const companyEmployees = useMemo(() => {
    if (!companyId) return [];
    return users.filter(u =>
      u.company_id === companyId &&
      [UserStatus.ACTIVE, UserStatus.TRIAL].includes(u.status as UserStatus)
    );
  }, [users, companyId]);

  // Load timesheets for selected period
  const loadTimesheets = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('timesheets')
        .select('*')
        .eq('company_id', companyId)
        .eq('year', selectedYear)
        .eq('month', selectedMonth);

      if (!error && data) {
        setTimesheets(data);
      }
    } catch (err) {
      console.error('Error loading timesheets:', err);
    }
    setLoading(false);
  }, [companyId, selectedYear, selectedMonth]);

  useEffect(() => {
    loadTimesheets();
  }, [loadTimesheets]);

  // Generate timesheets for all employees
  const handleGenerate = async () => {
    if (!companyId || !currentUser) return;
    setGenerating(true);

    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      // Fetch all worker_days for the period
      const { data: workerDays, error: wdError } = await supabase
        .from('worker_days')
        .select('*')
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (wdError) throw wdError;

      const daysByUser = new Map<string, WorkerDay[]>();
      (workerDays || []).forEach((wd: WorkerDay) => {
        const arr = daysByUser.get(wd.user_id) || [];
        arr.push(wd);
        daysByUser.set(wd.user_id, arr);
      });

      const timesheetsToUpsert: any[] = [];

      for (const emp of companyEmployees) {
        const empDays = daysByUser.get(emp.id) || [];

        const totalWorkDays = empDays.filter(d =>
          ['present', 'late', 'incomplete'].includes(d.status)
        ).length;
        const totalWorkMinutes = empDays.reduce((s, d) => s + (d.work_time_minutes || 0), 0);
        const totalBreakMinutes = empDays.reduce((s, d) => s + (d.break_time_minutes || 0), 0);
        const totalOvertimeMinutes = empDays.reduce((s, d) => s + (d.overtime_minutes || 0), 0);

        // Night minutes — assume tracked in worker_days or estimate as 0
        const totalNightMinutes = 0; // Would need separate tracking
        const totalWeekendMinutes = empDays
          .filter(d => d.is_weekend)
          .reduce((s, d) => s + (d.work_time_minutes || 0), 0);
        const totalHolidayMinutes = empDays
          .filter(d => d.is_holiday)
          .reduce((s, d) => s + (d.work_time_minutes || 0), 0);
        const totalTimeOffDays = empDays.filter(d =>
          ['time_off', 'day_off'].includes(d.status)
        ).length;

        // Salary calculations
        const hourlyRate = emp.base_rate || state.systemConfig.baseRate || 25;
        const workHours = totalWorkMinutes / 60;
        const overtimeHours = totalOvertimeMinutes / 60;
        const nightHours = totalNightMinutes / 60;
        const weekendHours = totalWeekendMinutes / 60;
        const holidayHours = totalHolidayMinutes / 60;

        const baseSalary = Math.round(workHours * hourlyRate * 100) / 100;
        const overtimeSalary = Math.round(overtimeHours * hourlyRate * 1.5 * 100) / 100;
        const nightSalary = Math.round(nightHours * hourlyRate * 0.2 * 100) / 100; // 20% night premium
        const weekendSalary = Math.round(weekendHours * hourlyRate * 0.5 * 100) / 100; // 50% weekend premium
        const holidaySalary = Math.round(holidayHours * hourlyRate * 1.0 * 100) / 100; // 100% holiday premium
        const bonusSalary = 0; // Calculated separately if needed
        const totalSalary = baseSalary + overtimeSalary + nightSalary + weekendSalary + holidaySalary + bonusSalary;

        timesheetsToUpsert.push({
          company_id: companyId,
          user_id: emp.id,
          year: selectedYear,
          month: selectedMonth,
          total_work_days: totalWorkDays,
          total_work_minutes: totalWorkMinutes,
          total_break_minutes: totalBreakMinutes,
          total_overtime_minutes: totalOvertimeMinutes,
          total_night_minutes: totalNightMinutes,
          total_weekend_minutes: totalWeekendMinutes,
          total_holiday_minutes: totalHolidayMinutes,
          total_time_off_days: totalTimeOffDays,
          base_salary: baseSalary,
          overtime_salary: overtimeSalary,
          night_salary: nightSalary,
          weekend_salary: weekendSalary,
          holiday_salary: holidaySalary,
          bonus_salary: bonusSalary,
          total_salary: totalSalary,
          status: 'draft' as TimesheetStatus,
          updated_at: new Date().toISOString()
        });
      }

      // Upsert timesheets (by company_id, user_id, year, month unique)
      if (timesheetsToUpsert.length > 0) {
        const { error } = await supabase
          .from('timesheets')
          .upsert(timesheetsToUpsert, {
            onConflict: 'company_id,user_id,year,month'
          });

        if (error) throw error;
      }

      await loadTimesheets();
    } catch (err) {
      console.error('Error generating timesheets:', err);
    }
    setGenerating(false);
  };

  // Confirm all drafts
  const handleConfirmAll = async () => {
    if (!currentUser) return;
    setConfirming(true);
    try {
      const draftIds = timesheets.filter(t => t.status === 'draft').map(t => t.id);
      if (draftIds.length > 0) {
        const { error } = await supabase
          .from('timesheets')
          .update({
            status: 'confirmed',
            confirmed_by: currentUser.id,
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .in('id', draftIds);

        if (error) throw error;
        await loadTimesheets();
      }
    } catch (err) {
      console.error('Error confirming timesheets:', err);
    }
    setConfirming(false);
  };

  // Enriched timesheets with user info
  const enrichedTimesheets = useMemo(() => {
    return timesheets.map(ts => {
      const user = users.find(u => u.id === ts.user_id);
      return { ...ts, user };
    }).sort((a, b) => {
      if (sortField === 'name') {
        const nameA = `${a.user?.last_name || ''} ${a.user?.first_name || ''}`;
        const nameB = `${b.user?.last_name || ''} ${b.user?.first_name || ''}`;
        return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortField === 'total_salary') {
        return sortDir === 'asc' ? a.total_salary - b.total_salary : b.total_salary - a.total_salary;
      }
      if (sortField === 'work_days') {
        return sortDir === 'asc'
          ? a.total_work_days - b.total_work_days
          : b.total_work_days - a.total_work_days;
      }
      return 0;
    });
  }, [timesheets, users, sortField, sortDir]);

  // Summary stats
  const totals = useMemo(() => {
    return {
      employees: enrichedTimesheets.length,
      workDays: enrichedTimesheets.reduce((s, t) => s + t.total_work_days, 0),
      workMinutes: enrichedTimesheets.reduce((s, t) => s + t.total_work_minutes, 0),
      overtimeMinutes: enrichedTimesheets.reduce((s, t) => s + t.total_overtime_minutes, 0),
      totalSalary: enrichedTimesheets.reduce((s, t) => s + t.total_salary, 0),
      drafts: enrichedTimesheets.filter(t => t.status === 'draft').length,
      confirmed: enrichedTimesheets.filter(t => t.status === 'confirmed').length,
      paid: enrichedTimesheets.filter(t => t.status === 'paid').length
    };
  }, [enrichedTimesheets]);

  // Export Excel
  const handleExportExcel = () => {
    const wsData = enrichedTimesheets.map(ts => ({
      'Pracownik': ts.user ? `${ts.user.last_name} ${ts.user.first_name}` : 'Nieznany',
      'Dni robocze': ts.total_work_days,
      'Godziny pracy': formatMinutes(ts.total_work_minutes),
      'Nadgodziny': formatMinutes(ts.total_overtime_minutes),
      'Godziny nocne': formatMinutes(ts.total_night_minutes),
      'Weekendy': formatMinutes(ts.total_weekend_minutes),
      'Podstawa (PLN)': ts.base_salary,
      'Nadgodziny (PLN)': ts.overtime_salary,
      'Nocne (PLN)': ts.night_salary,
      'Weekendy (PLN)': ts.weekend_salary,
      'Swiateczne (PLN)': ts.holiday_salary,
      'Bonusy (PLN)': ts.bonus_salary,
      'Lacznie (PLN)': ts.total_salary,
      'Status': STATUS_LABELS[ts.status as TimesheetStatus] || ts.status
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Karty czasu ${MONTHS[selectedMonth - 1]} ${selectedYear}`);
    XLSX.writeFile(wb, `karty_czasu_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`);
  };

  // Export PDF (simple print)
  const handleExportPDF = () => {
    const rows = enrichedTimesheets.map(ts => {
      const name = ts.user ? `${ts.user.last_name} ${ts.user.first_name}` : 'Nieznany';
      return `<tr>
        <td style="padding:4px 8px;border:1px solid #ddd">${name}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${ts.total_work_days}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(ts.total_work_minutes)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(ts.total_overtime_minutes)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(ts.total_night_minutes)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(ts.total_weekend_minutes)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(ts.base_salary)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(ts.bonus_salary + ts.overtime_salary + ts.night_salary + ts.weekend_salary + ts.holiday_salary)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right;font-weight:bold">${formatCurrency(ts.total_salary)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${STATUS_LABELS[ts.status as TimesheetStatus] || ts.status}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Karty czasu pracy</title>
<style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}th{background:#f1f5f9;padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:12px}td{font-size:11px}h1{font-size:18px}h2{font-size:14px;color:#666}</style>
</head><body>
<h1>Karty czasu pracy</h1>
<h2>${currentCompany?.name || 'Firma'} — ${MONTHS[selectedMonth - 1]} ${selectedYear}</h2>
<table>
<thead><tr>
<th>Pracownik</th><th>Dni</th><th>Godziny</th><th>Nadgodziny</th><th>Nocne</th><th>Weekendy</th><th>Podstawa</th><th>Bonusy</th><th>Lacznie</th><th>Status</th>
</tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr style="font-weight:bold;background:#f8fafc">
<td style="padding:4px 8px;border:1px solid #ddd">RAZEM (${enrichedTimesheets.length})</td>
<td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${totals.workDays}</td>
<td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(totals.workMinutes)}</td>
<td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatMinutes(totals.overtimeMinutes)}</td>
<td colspan="2" style="padding:4px 8px;border:1px solid #ddd"></td>
<td colspan="2" style="padding:4px 8px;border:1px solid #ddd"></td>
<td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(totals.totalSalary)}</td>
<td style="padding:4px 8px;border:1px solid #ddd"></td>
</tr></tfoot>
</table>
<p style="margin-top:20px;font-size:10px;color:#999">Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon: React.FC<{ field: string }> = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 inline ml-1" />
      : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  // Access check
  if (!currentUser || ![Role.COMPANY_ADMIN, Role.HR, Role.COORDINATOR].includes(currentUser.role as Role)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-800">Brak dostepu</h2>
          <p className="text-red-600">Nie masz uprawnien do przeglAdania kart czasu pracy.</p>
        </div>
      </div>
    );
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className={embedded ? "p-4 lg:p-6" : "p-4 lg:p-6 max-w-[1400px] mx-auto"}>
      {/* Header */}
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Karty czasu pracy</h1>
          <p className="text-slate-500 mt-1">
            Generuj i zarzadzaj kartami czasu pracy pracownikow
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Month selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <button
            onClick={handleGenerate}
            disabled={generating || companyEmployees.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Generuj tabele
          </button>

          {totals.drafts > 0 && (
            <button
              onClick={handleConfirmAll}
              disabled={confirming}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Potwierdz wszystkie ({totals.drafts})
            </button>
          )}

          {enrichedTimesheets.length > 0 && (
            <>
              <button
                onClick={handleExportExcel}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                Eksport Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Printer className="w-4 h-4 text-red-600" />
                Eksport PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {enrichedTimesheets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              Pracownicy
            </div>
            <div className="text-2xl font-bold text-slate-900">{totals.employees}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Calendar className="w-3.5 h-3.5" />
              Dni robocze (suma)
            </div>
            <div className="text-2xl font-bold text-slate-900">{totals.workDays}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              Godziny pracy
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatMinutes(totals.workMinutes)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <DollarSign className="w-3.5 h-3.5" />
              Laczne wynagrodzenie
            </div>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.totalSalary)}</div>
          </div>
        </div>
      )}

      {/* Timesheets Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-500">Ladowanie kart czasu pracy...</span>
          </div>
        ) : enrichedTimesheets.length === 0 ? (
          <div className="text-center p-16">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Brak kart czasu pracy</h3>
            <p className="text-slate-400 mb-4">
              Kliknij "Generuj tabele" aby wygenerowac karty czasu pracy<br />
              dla {companyEmployees.length} pracownikow za {MONTHS[selectedMonth - 1]} {selectedYear}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th
                    className="text-left px-4 py-3 font-medium text-slate-600 cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('name')}
                  >
                    Pracownik <SortIcon field="name" />
                  </th>
                  <th
                    className="text-center px-3 py-3 font-medium text-slate-600 cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('work_days')}
                  >
                    Dni robocze <SortIcon field="work_days" />
                  </th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Godziny</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Nadgodziny</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Nocne</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Weekendy</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Podstawa</th>
                  <th className="text-right px-3 py-3 font-medium text-slate-600">Bonusy</th>
                  <th
                    className="text-right px-3 py-3 font-medium text-slate-600 cursor-pointer hover:text-slate-900"
                    onClick={() => handleSort('total_salary')}
                  >
                    Lacznie <SortIcon field="total_salary" />
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {enrichedTimesheets.map(ts => {
                  const bonuses = ts.overtime_salary + ts.night_salary + ts.weekend_salary + ts.holiday_salary + ts.bonus_salary;
                  return (
                    <tr
                      key={ts.id}
                      className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                      onClick={() => ts.user && setDetailEmployee(ts.user)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {ts.user ? `${ts.user.last_name} ${ts.user.first_name}` : 'Nieznany pracownik'}
                        </div>
                        {ts.user?.base_rate && (
                          <div className="text-xs text-slate-400">
                            Stawka: {ts.user.base_rate} PLN/h
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-mono">{ts.total_work_days}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatMinutes(ts.total_work_minutes)}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatMinutes(ts.total_overtime_minutes)}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatMinutes(ts.total_night_minutes)}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatMinutes(ts.total_weekend_minutes)}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatCurrency(ts.base_salary)}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatCurrency(bonuses)}</td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-emerald-700">
                        {formatCurrency(ts.total_salary)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[ts.status as TimesheetStatus] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[ts.status as TimesheetStatus] || ts.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3 text-slate-700">RAZEM ({enrichedTimesheets.length})</td>
                  <td className="px-3 py-3 text-center">{totals.workDays}</td>
                  <td className="px-3 py-3 text-right">{formatMinutes(totals.workMinutes)}</td>
                  <td className="px-3 py-3 text-right">{formatMinutes(totals.overtimeMinutes)}</td>
                  <td className="px-3 py-3 text-right">—</td>
                  <td className="px-3 py-3 text-right">—</td>
                  <td className="px-3 py-3 text-right">—</td>
                  <td className="px-3 py-3 text-right">—</td>
                  <td className="px-3 py-3 text-right text-emerald-700">{formatCurrency(totals.totalSalary)}</td>
                  <td className="px-3 py-3 text-center text-xs text-slate-500">
                    {totals.drafts > 0 && <span className="mr-1">{totals.drafts} szkic</span>}
                    {totals.confirmed > 0 && <span className="mr-1">{totals.confirmed} potw.</span>}
                    {totals.paid > 0 && <span>{totals.paid} wypl.</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Employee Detail Modal */}
      {detailEmployee && companyId && (
        <EmployeeTimesheetDetail
          employee={detailEmployee}
          year={selectedYear}
          month={selectedMonth}
          companyId={companyId}
          onClose={() => setDetailEmployee(null)}
        />
      )}
    </div>
  );
};
