
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList, Calendar, FileSpreadsheet, Check, X, Edit, Filter,
  Search, ChevronDown, Clock, AlertCircle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  WorkerDay, WorkerDayEntry, WorkerDayActivity, WorkerDayRequest,
  Department, User, Role, WorkerDayStatus, ActivityType_TA, DayRequestStatus
} from '../../types';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinutes(min: number): string {
  if (!min || min <= 0) return '0h 0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABELS: Record<string, string> = {
  present: 'Obecny',
  absent: 'Nieobecny',
  late: 'Spóźniony',
  incomplete: 'Niekompletny',
  day_off: 'Dzień wolny',
  holiday: 'Święto',
  time_off: 'Urlop',
};

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  late: 'bg-yellow-100 text-yellow-800',
  incomplete: 'bg-orange-100 text-orange-800',
  day_off: 'bg-blue-100 text-blue-800',
  holiday: 'bg-purple-100 text-purple-800',
  time_off: 'bg-indigo-100 text-indigo-800',
};

const ACTIVITY_LABELS: Record<string, string> = {
  work: 'Praca',
  break: 'Przerwa',
  exit_business: 'Wyjście służbowe',
  exit_private: 'Wyjście prywatne',
};

type Tab = 'daily' | 'period' | 'requests';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const CompanyAttendancePage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, currentCompany, users } = state;

  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // ---- Access control helpers ----
  const userRole = currentUser?.role as Role;
  const canAccessAll = [Role.COMPANY_ADMIN, Role.HR].includes(userRole);
  const isCoordinator = userRole === Role.COORDINATOR;
  const isBrigadir = userRole === Role.BRIGADIR;

  // ---- Load departments ----
  useEffect(() => {
    if (!currentCompany) return;
    (async () => {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_archived', false)
        .order('name');
      if (data) setDepartments(data);
    })();
  }, [currentCompany]);

  // ---- Pending request count ----
  useEffect(() => {
    if (!currentCompany) return;
    (async () => {
      const { count } = await supabase
        .from('worker_day_requests')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .eq('status', 'pending');
      setPendingCount(count ?? 0);
    })();
  }, [currentCompany]);

  // ---- Company users filtered by access ----
  const visibleUsers = useMemo(() => {
    if (!currentCompany) return [];
    let pool = users.filter(
      (u) => u.company_id === currentCompany.id && !u.is_global_user
    );
    // Coordinators / brigadirs see limited set — resolved per-tab via department membership
    return pool;
  }, [users, currentCompany]);

  // ------------------------------------------------------------------ TABS
  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'daily', label: 'Podsumowanie dnia', icon: <Calendar className="w-4 h-4" /> },
    { key: 'period', label: 'Podsumowanie okresu', icon: <ClipboardList className="w-4 h-4" /> },
    {
      key: 'requests',
      label: 'Wnioski o zmianę',
      icon: <AlertCircle className="w-4 h-4" />,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Poszczaemosc</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge !== undefined && (
              <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'daily' && (
        <DailySummaryTab
          companyId={currentCompany?.id ?? ''}
          departments={departments}
          users={visibleUsers}
          currentUser={currentUser}
          canAccessAll={canAccessAll}
          isCoordinator={isCoordinator}
          isBrigadir={isBrigadir}
        />
      )}
      {activeTab === 'period' && (
        <PeriodSummaryTab
          companyId={currentCompany?.id ?? ''}
          departments={departments}
          users={visibleUsers}
          currentUser={currentUser}
          canAccessAll={canAccessAll}
          isCoordinator={isCoordinator}
          isBrigadir={isBrigadir}
        />
      )}
      {activeTab === 'requests' && (
        <ChangeRequestsTab
          companyId={currentCompany?.id ?? ''}
          users={visibleUsers}
          currentUser={currentUser}
          onCountChange={setPendingCount}
        />
      )}
    </div>
  );
};

// ===========================================================================
// TAB 1 — Daily Summary
// ===========================================================================

interface DailyTabProps {
  companyId: string;
  departments: Department[];
  users: User[];
  currentUser: User | null;
  canAccessAll: boolean;
  isCoordinator: boolean;
  isBrigadir: boolean;
}

const DailySummaryTab: React.FC<DailyTabProps> = ({
  companyId, departments, users, currentUser, canAccessAll, isCoordinator, isBrigadir,
}) => {
  const [date, setDate] = useState(todayISO());
  const [workerDays, setWorkerDays] = useState<WorkerDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set(['present', 'absent', 'late']));
  const [showFilters, setShowFilters] = useState(false);
  const [editModal, setEditModal] = useState<{ day: WorkerDay; user: User } | null>(null);

  // ---- Fetch worker days for selected date ----
  const fetchDays = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worker_days')
        .select('*, entries:worker_day_entries(*, activities:worker_day_activities(*), department:departments(*))')
        .eq('company_id', companyId)
        .eq('date', date);
      if (error) throw error;
      setWorkerDays((data as WorkerDay[]) ?? []);
    } catch (e) {
      console.error('Error loading worker days:', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, date]);

  useEffect(() => { fetchDays(); }, [fetchDays]);

  // ---- Build rows (merge users without a worker_day record) ----
  const rows = useMemo(() => {
    const dayMap = new Map<string, WorkerDay>();
    workerDays.forEach((wd) => dayMap.set(wd.user_id, wd));

    return users
      .map((u) => {
        const wd = dayMap.get(u.id);
        const firstEntry = wd?.entries?.[0];
        const deptName = firstEntry?.department?.name ?? '';
        return { user: u, wd, deptName };
      })
      .filter((r) => {
        // Status filter
        const status = r.wd?.status ?? 'absent';
        if (statusFilters.size > 0 && !statusFilters.has(status)) return false;
        // Department filter
        if (departmentFilter && r.wd?.entries) {
          const match = r.wd.entries.some((e) => e.department_id === departmentFilter);
          if (!match) return false;
        } else if (departmentFilter && !r.wd) {
          return false;
        }
        // Search
        if (searchTerm) {
          const full = `${r.user.first_name} ${r.user.last_name}`.toLowerCase();
          if (!full.includes(searchTerm.toLowerCase())) return false;
        }
        return true;
      });
  }, [users, workerDays, departmentFilter, statusFilters, searchTerm]);

  // ---- Export Excel ----
  const exportExcel = () => {
    const wsData = rows.map((r) => ({
      'Imie i nazwisko': `${r.user.first_name ?? ''} ${r.user.last_name ?? ''}`.trim(),
      'Obiekt': r.deptName,
      'Status': STATUS_LABELS[r.wd?.status ?? 'absent'] ?? r.wd?.status ?? 'Nieobecny',
      'Przyjscie': r.wd?.entries?.[0]?.start_time?.slice(11, 16) ?? '-',
      'Wyjscie': r.wd?.entries?.[r.wd.entries.length - 1]?.finish_time?.slice(11, 16) ?? '-',
      'Praca': formatMinutes(r.wd?.work_time_minutes ?? 0),
      'Przerwa': formatMinutes(r.wd?.break_time_minutes ?? 0),
      'Nadgodziny': formatMinutes(r.wd?.overtime_minutes ?? 0),
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Poszczaemosc');
    XLSX.writeFile(wb, `poszczaemosc_${date}.xlsx`);
  };

  const toggleStatus = (s: string) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return (
    <div>
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Department filter */}
        <div className="relative">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Wszystkie obiekty</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Status filters */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filtry statusu
        </button>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Szukaj po nazwisku..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={exportExcel}
          className="flex items-center gap-1.5 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Eksport Excel
        </button>
      </div>

      {/* Status filter checkboxes (collapsible) */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          {(['present', 'absent', 'late', 'incomplete', 'day_off', 'holiday', 'time_off'] as const).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={statusFilters.has(s)}
                onChange={() => toggleStatus(s)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
                {STATUS_LABELS[s]}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Imie i nazwisko</th>
              <th className="px-4 py-3">Obiekt</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Przyjscie</th>
              <th className="px-4 py-3">Wyjscie</th>
              <th className="px-4 py-3">Praca</th>
              <th className="px-4 py-3">Przerwa</th>
              <th className="px-4 py-3">Nadgodziny</th>
              <th className="px-4 py-3">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  <Clock className="w-5 h-5 inline-block animate-spin mr-2" />
                  Ladowanie...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Brak danych dla wybranego dnia i filtrow.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const status = r.wd?.status ?? 'absent';
                const entries = r.wd?.entries ?? [];
                const firstStart = entries[0]?.start_time?.slice(11, 16) ?? '-';
                const lastFinish = entries[entries.length - 1]?.finish_time?.slice(11, 16) ?? '-';

                return (
                  <tr
                    key={r.user.id}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                    onClick={() => {
                      if (canAccessAll) {
                        setEditModal({
                          day: r.wd ?? {
                            id: '', company_id: companyId, user_id: r.user.id, date,
                            status: 'absent', confirmed: false, finished: false,
                            total_time_minutes: 0, work_time_minutes: 0, break_time_minutes: 0,
                            overtime_minutes: 0, is_business_day: true, is_holiday: false, is_weekend: false,
                            created_at: '', updated_at: '', entries: [],
                          } as WorkerDay,
                          user: r.user,
                        });
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {r.user.first_name} {r.user.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.deptName || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status] ?? status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{firstStart}</td>
                    <td className="px-4 py-3 text-gray-600">{lastFinish}</td>
                    <td className="px-4 py-3 text-gray-600">{formatMinutes(r.wd?.work_time_minutes ?? 0)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatMinutes(r.wd?.break_time_minutes ?? 0)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatMinutes(r.wd?.overtime_minutes ?? 0)}</td>
                    <td className="px-4 py-3">
                      {canAccessAll && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditModal({
                              day: r.wd ?? {
                                id: '', company_id: companyId, user_id: r.user.id, date,
                                status: 'absent', confirmed: false, finished: false,
                                total_time_minutes: 0, work_time_minutes: 0, break_time_minutes: 0,
                                overtime_minutes: 0, is_business_day: true, is_holiday: false, is_weekend: false,
                                created_at: '', updated_at: '', entries: [],
                              } as WorkerDay,
                              user: r.user,
                            });
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edytuj"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editModal && (
        <EditDayModal
          companyId={companyId}
          day={editModal.day}
          user={editModal.user}
          departments={departments}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); fetchDays(); }}
        />
      )}
    </div>
  );
};

// ===========================================================================
// TAB 2 — Period Summary
// ===========================================================================

interface PeriodTabProps {
  companyId: string;
  departments: Department[];
  users: User[];
  currentUser: User | null;
  canAccessAll: boolean;
  isCoordinator: boolean;
  isBrigadir: boolean;
}

const PeriodSummaryTab: React.FC<PeriodTabProps> = ({
  companyId, departments, users,
}) => {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(todayISO());
  const [workerDays, setWorkerDays] = useState<WorkerDay[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPeriod = useCallback(async () => {
    if (!companyId || !startDate || !endDate) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worker_days')
        .select('*')
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate);
      if (error) throw error;
      setWorkerDays((data as WorkerDay[]) ?? []);
    } catch (e) {
      console.error('Error loading period data:', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, startDate, endDate]);

  useEffect(() => { fetchPeriod(); }, [fetchPeriod]);

  // Aggregate per user
  const aggregated = useMemo(() => {
    const map = new Map<string, {
      workDays: number; workMinutes: number; breakMinutes: number;
      overtimeMinutes: number; lateCount: number; absentCount: number;
    }>();

    workerDays.forEach((wd) => {
      const prev = map.get(wd.user_id) ?? {
        workDays: 0, workMinutes: 0, breakMinutes: 0,
        overtimeMinutes: 0, lateCount: 0, absentCount: 0,
      };
      if (wd.status === 'present' || wd.status === 'late') prev.workDays += 1;
      prev.workMinutes += wd.work_time_minutes ?? 0;
      prev.breakMinutes += wd.break_time_minutes ?? 0;
      prev.overtimeMinutes += wd.overtime_minutes ?? 0;
      if (wd.status === 'late') prev.lateCount += 1;
      if (wd.status === 'absent') prev.absentCount += 1;
      map.set(wd.user_id, prev);
    });

    return users.map((u) => ({
      user: u,
      agg: map.get(u.id) ?? {
        workDays: 0, workMinutes: 0, breakMinutes: 0,
        overtimeMinutes: 0, lateCount: 0, absentCount: 0,
      },
    }));
  }, [workerDays, users]);

  const exportExcel = () => {
    const wsData = aggregated.map((r) => ({
      'Imie i nazwisko': `${r.user.first_name ?? ''} ${r.user.last_name ?? ''}`.trim(),
      'Dni robocze': r.agg.workDays,
      'Godziny pracy': formatMinutes(r.agg.workMinutes),
      'Godziny przerw': formatMinutes(r.agg.breakMinutes),
      'Nadgodziny': formatMinutes(r.agg.overtimeMinutes),
      'Spoznienia': r.agg.lateCount,
      'Nieobecnosci': r.agg.absentCount,
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Okres');
    XLSX.writeFile(wb, `poszczaemosc_${startDate}_${endDate}.xlsx`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Od:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Do:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={exportExcel}
          className="flex items-center gap-1.5 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Eksport Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Imie i nazwisko</th>
              <th className="px-4 py-3">Dni robocze</th>
              <th className="px-4 py-3">Godziny pracy</th>
              <th className="px-4 py-3">Godziny przerw</th>
              <th className="px-4 py-3">Nadgodziny</th>
              <th className="px-4 py-3">Spoznienia</th>
              <th className="px-4 py-3">Nieobecnosci</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  <Clock className="w-5 h-5 inline-block animate-spin mr-2" />
                  Ladowanie...
                </td>
              </tr>
            ) : aggregated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Brak danych dla wybranego okresu.
                </td>
              </tr>
            ) : (
              aggregated.map((r) => (
                <tr key={r.user.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.user.first_name} {r.user.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.agg.workDays}</td>
                  <td className="px-4 py-3 text-gray-600">{formatMinutes(r.agg.workMinutes)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatMinutes(r.agg.breakMinutes)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatMinutes(r.agg.overtimeMinutes)}</td>
                  <td className="px-4 py-3">
                    {r.agg.lateCount > 0 ? (
                      <span className="text-yellow-700 font-medium">{r.agg.lateCount}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.agg.absentCount > 0 ? (
                      <span className="text-red-700 font-medium">{r.agg.absentCount}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ===========================================================================
// TAB 3 — Change Requests
// ===========================================================================

interface RequestsTabProps {
  companyId: string;
  users: User[];
  currentUser: User | null;
  onCountChange: (count: number) => void;
}

const ChangeRequestsTab: React.FC<RequestsTabProps> = ({
  companyId, users, currentUser, onCountChange,
}) => {
  const [requests, setRequests] = useState<WorkerDayRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const userMap = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const fetchRequests = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worker_day_requests')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items = (data as WorkerDayRequest[]) ?? [];
      setRequests(items);
      onCountChange(items.length);
    } catch (e) {
      console.error('Error loading requests:', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, onCountChange]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (ids: string[], action: 'approved' | 'rejected') => {
    if (!currentUser) return;
    setProcessing(true);
    try {
      for (const id of ids) {
        await supabase
          .from('worker_day_requests')
          .update({
            status: action,
            reviewer_id: currentUser.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', id);
      }
      setSelectedIds(new Set());
      await fetchRequests();
    } catch (e) {
      console.error('Error processing requests:', e);
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  };

  return (
    <div>
      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-800">
            Zaznaczono: {selectedIds.size}
          </span>
          <button
            onClick={() => handleAction(Array.from(selectedIds), 'approved')}
            disabled={processing}
            className="flex items-center gap-1.5 bg-green-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Zatwierdz wybrane
          </button>
          <button
            onClick={() => handleAction(Array.from(selectedIds), 'rejected')}
            disabled={processing}
            className="flex items-center gap-1.5 bg-red-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Odrzuc wybrane
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={requests.length > 0 && selectedIds.size === requests.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3">Pracownik</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Obecne dane</th>
              <th className="px-4 py-3">Wnioskowane dane</th>
              <th className="px-4 py-3">Komentarz</th>
              <th className="px-4 py-3">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  <Clock className="w-5 h-5 inline-block animate-spin mr-2" />
                  Ladowanie...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Brak oczekujacych wnioskow.
                </td>
              </tr>
            ) : (
              requests.map((req) => {
                const emp = userMap.get(req.user_id);
                const reqEntries = req.requested_entries ?? [];
                return (
                  <tr key={req.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(req.id)}
                        onChange={() => toggleSelect(req.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {emp ? `${emp.first_name} ${emp.last_name}` : req.user_id}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.date}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {req.worker_day_id ? (
                        <span className="italic">Istniejacy dzien</span>
                      ) : (
                        <span className="italic">Brak wpisu</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {reqEntries.length > 0 ? (
                        <div className="space-y-1">
                          {reqEntries.map((e, i) => (
                            <div key={i} className="bg-gray-50 px-2 py-1 rounded">
                              {e.start_time?.slice(11, 16)} - {e.finish_time?.slice(11, 16)}
                              {e.activities?.length > 0 && (
                                <span className="ml-1 text-gray-400">
                                  ({e.activities.map((a) => ACTIVITY_LABELS[a.type] ?? a.type).join(', ')})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                      {req.note || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAction([req.id], 'approved')}
                          disabled={processing}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Zatwierdz"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAction([req.id], 'rejected')}
                          disabled={processing}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Odrzuc"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ===========================================================================
// Edit Day Modal
// ===========================================================================

interface EditDayModalProps {
  companyId: string;
  day: WorkerDay;
  user: User;
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}

interface EditEntry {
  id?: string;
  start_time: string;
  finish_time: string;
  department_id: string;
  is_remote: boolean;
  activities: EditActivity[];
}

interface EditActivity {
  id?: string;
  type: ActivityType_TA;
  start_time: string;
  finish_time: string;
}

const EditDayModal: React.FC<EditDayModalProps> = ({
  companyId, day, user, departments, onClose, onSaved,
}) => {
  const [status, setStatus] = useState<WorkerDayStatus>(day.status);
  const [managerNote, setManagerNote] = useState(day.manager_note ?? '');
  const [confirmed, setConfirmed] = useState(day.confirmed);
  const [entries, setEntries] = useState<EditEntry[]>(() => {
    if (!day.entries || day.entries.length === 0) return [];
    return day.entries.map((e) => ({
      id: e.id,
      start_time: e.start_time?.slice(11, 16) ?? '',
      finish_time: e.finish_time?.slice(11, 16) ?? '',
      department_id: e.department_id ?? '',
      is_remote: e.is_remote ?? false,
      activities: (e.activities ?? []).map((a) => ({
        id: a.id,
        type: a.type,
        start_time: a.start_time?.slice(11, 16) ?? '',
        finish_time: a.finish_time?.slice(11, 16) ?? '',
      })),
    }));
  });
  const [saving, setSaving] = useState(false);

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      { start_time: '', finish_time: '', department_id: '', is_remote: false, activities: [] },
    ]);
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx: number, updates: Partial<EditEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...updates } : e)));
  };

  const addActivity = (entryIdx: number) => {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === entryIdx
          ? { ...e, activities: [...e.activities, { type: 'work' as ActivityType_TA, start_time: '', finish_time: '' }] }
          : e
      )
    );
  };

  const removeActivity = (entryIdx: number, actIdx: number) => {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === entryIdx
          ? { ...e, activities: e.activities.filter((_, j) => j !== actIdx) }
          : e
      )
    );
  };

  const updateActivity = (entryIdx: number, actIdx: number, updates: Partial<EditActivity>) => {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === entryIdx
          ? {
              ...e,
              activities: e.activities.map((a, j) => (j === actIdx ? { ...a, ...updates } : a)),
            }
          : e
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const datePrefix = day.date + 'T';

      // 1) Upsert worker_day
      let workerDayId = day.id;
      if (workerDayId) {
        await supabase
          .from('worker_days')
          .update({
            status,
            manager_note: managerNote || null,
            confirmed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', workerDayId);
      } else {
        const { data: newDay, error } = await supabase
          .from('worker_days')
          .insert({
            company_id: companyId,
            user_id: user.id,
            date: day.date,
            status,
            confirmed,
            finished: true,
            total_time_minutes: 0,
            work_time_minutes: 0,
            break_time_minutes: 0,
            overtime_minutes: 0,
            manager_note: managerNote || null,
            is_business_day: true,
            is_holiday: false,
            is_weekend: false,
          })
          .select('id')
          .single();
        if (error) throw error;
        workerDayId = newDay.id;
      }

      // 2) Delete old entries & activities for this day
      if (day.id) {
        const oldEntryIds = (day.entries ?? []).map((e) => e.id);
        if (oldEntryIds.length > 0) {
          await supabase
            .from('worker_day_activities')
            .delete()
            .in('entry_id', oldEntryIds);
          await supabase
            .from('worker_day_entries')
            .delete()
            .eq('worker_day_id', day.id);
        }
      }

      // 3) Insert new entries & activities
      let totalWork = 0;
      let totalBreak = 0;

      for (const entry of entries) {
        const startISO = entry.start_time ? `${datePrefix}${entry.start_time}:00` : null;
        const finishISO = entry.finish_time ? `${datePrefix}${entry.finish_time}:00` : null;

        const { data: newEntry, error: entryErr } = await supabase
          .from('worker_day_entries')
          .insert({
            worker_day_id: workerDayId,
            company_id: companyId,
            user_id: user.id,
            start_time: startISO,
            finish_time: finishISO,
            finished: !!finishISO,
            department_id: entry.department_id || null,
            is_remote: entry.is_remote,
          })
          .select('id')
          .single();
        if (entryErr) throw entryErr;

        for (const act of entry.activities) {
          const actStart = act.start_time ? `${datePrefix}${act.start_time}:00` : null;
          const actFinish = act.finish_time ? `${datePrefix}${act.finish_time}:00` : null;

          await supabase
            .from('worker_day_activities')
            .insert({
              entry_id: newEntry.id,
              company_id: companyId,
              user_id: user.id,
              type: act.type,
              start_time: actStart,
              finish_time: actFinish,
              finished: !!actFinish,
              approved: true,
            });

          // Calculate minutes for summary
          if (actStart && actFinish) {
            const diff = (new Date(actFinish).getTime() - new Date(actStart).getTime()) / 60000;
            if (act.type === 'work') totalWork += diff;
            if (act.type === 'break') totalBreak += diff;
          }
        }
      }

      // 4) Update worker_day totals
      const overtime = Math.max(0, totalWork - 480); // 8h = 480m
      await supabase
        .from('worker_days')
        .update({
          work_time_minutes: Math.round(totalWork),
          break_time_minutes: Math.round(totalBreak),
          total_time_minutes: Math.round(totalWork + totalBreak),
          overtime_minutes: Math.round(overtime),
          updated_at: new Date().toISOString(),
        })
        .eq('id', workerDayId);

      onSaved();
    } catch (e) {
      console.error('Error saving worker day:', e);
      alert('Blad podczas zapisywania. Sprobuj ponownie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edycja dnia pracy</h2>
            <p className="text-sm text-gray-500">
              {user.first_name} {user.last_name} &mdash; {day.date}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as WorkerDayStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Entries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Wpisy czasu pracy</label>
              <button
                onClick={addEntry}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                + Dodaj wpis
              </button>
            </div>

            {entries.length === 0 && (
              <p className="text-sm text-gray-400 italic">Brak wpisow. Kliknij "Dodaj wpis" aby rozpoczac.</p>
            )}

            <div className="space-y-4">
              {entries.map((entry, eIdx) => (
                <div key={eIdx} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Wpis #{eIdx + 1}</span>
                    <button
                      onClick={() => removeEntry(eIdx)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      Usun
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Poczatek</label>
                      <input
                        type="time"
                        value={entry.start_time}
                        onChange={(e) => updateEntry(eIdx, { start_time: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Koniec</label>
                      <input
                        type="time"
                        value={entry.finish_time}
                        onChange={(e) => updateEntry(eIdx, { finish_time: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Obiekt</label>
                      <select
                        value={entry.department_id}
                        onChange={(e) => updateEntry(eIdx, { department_id: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Wybierz --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm cursor-pointer pb-1.5">
                        <input
                          type="checkbox"
                          checked={entry.is_remote}
                          onChange={(e) => updateEntry(eIdx, { is_remote: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Zdalnie
                      </label>
                    </div>
                  </div>

                  {/* Activities */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">Aktywnosci</span>
                      <button
                        onClick={() => addActivity(eIdx)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        + Dodaj aktywnosc
                      </button>
                    </div>
                    {entry.activities.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Brak aktywnosci.</p>
                    )}
                    <div className="space-y-2">
                      {entry.activities.map((act, aIdx) => (
                        <div key={aIdx} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2">
                          <select
                            value={act.type}
                            onChange={(e) => updateActivity(eIdx, aIdx, { type: e.target.value as ActivityType_TA })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="work">Praca</option>
                            <option value="break">Przerwa</option>
                            <option value="exit_business">Wyjscie sluzbowe</option>
                            <option value="exit_private">Wyjscie prywatne</option>
                          </select>
                          <input
                            type="time"
                            value={act.start_time}
                            onChange={(e) => updateActivity(eIdx, aIdx, { start_time: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-xs text-gray-400">-</span>
                          <input
                            type="time"
                            value={act.finish_time}
                            onChange={(e) => updateActivity(eIdx, aIdx, { finish_time: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => removeActivity(eIdx, aIdx)}
                            className="p-1 text-red-400 hover:text-red-600 ml-auto transition-colors"
                            title="Usun aktywnosc"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Manager note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notatka menadzera</label>
            <textarea
              value={managerNote}
              onChange={(e) => setManagerNote(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Opcjonalna notatka..."
            />
          </div>

          {/* Confirmed checkbox */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-gray-700">Potwierdz dzien</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Zapisywanie...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Zapisz
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
