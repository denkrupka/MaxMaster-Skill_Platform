import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarOff,
  CalendarDays,
  Plus,
  Check,
  X,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  TimeOffType,
  TimeOffLimit,
  TimeOffRequest,
  TimeOffRequestStatus,
  Role,
} from '../../types';
import { SectionTabs } from '../../components/SectionTabs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countBusinessDays(startStr: string, endStr: string): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function formatDate(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getUserName(users: any[], id?: string): string {
  if (!id) return '—';
  const u = users.find((usr: any) => usr.id === id);
  return u ? `${u.first_name} ${u.last_name}` : '—';
}

const STATUS_CONFIG: Record<
  TimeOffRequestStatus,
  { label: string; bg: string; text: string }
> = {
  pending: { label: 'Oczekujący', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  approved: { label: 'Zatwierdzony', bg: 'bg-green-100', text: 'text-green-800' },
  rejected: { label: 'Odrzucony', bg: 'bg-red-100', text: 'text-red-800' },
  cancelled: { label: 'Anulowany', bg: 'bg-gray-100', text: 'text-gray-600' },
};

const TABS = [
  { id: 'requests', label: 'Wnioski' },
  { id: 'calendar', label: 'Kalendarz' },
  { id: 'limits', label: 'Limity' },
  { id: 'types', label: 'Typy urlopów' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const DAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CompanyTimeOffPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, users } = state;

  const [activeTab, setActiveTab] = useState<TabId>('requests');

  // Shared data
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [limits, setLimits] = useState<TimeOffLimit[]>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const companyId = currentUser?.company_id;
  const currentYear = new Date().getFullYear();

  // Determine visible users based on role
  const visibleUsers = useMemo(() => {
    if (!currentUser) return [];
    const companyUsers = users.filter(
      (u) => u.company_id === companyId && u.status !== 'inactive',
    );
    if (
      currentUser.role === Role.COMPANY_ADMIN ||
      currentUser.role === Role.HR
    ) {
      return companyUsers;
    }
    if (currentUser.role === Role.COORDINATOR) {
      // coordinator sees own department — filter by same department (brigadir chain)
      return companyUsers.filter(
        (u) =>
          (u as any).department_id === (currentUser as any).department_id ||
          u.id === currentUser.id,
      );
    }
    if (currentUser.role === Role.BRIGADIR) {
      return companyUsers.filter(
        (u) =>
          u.assigned_brigadir_id === currentUser.id || u.id === currentUser.id,
      );
    }
    return [currentUser];
  }, [currentUser, users, companyId]);

  const visibleUserIds = useMemo(
    () => new Set(visibleUsers.map((u) => u.id)),
    [visibleUsers],
  );

  // ------- load data -------
  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [typesRes, limitsRes, requestsRes] = await Promise.all([
        supabase
          .from('time_off_types')
          .select('*')
          .eq('company_id', companyId)
          .order('display_order'),
        supabase
          .from('time_off_limits')
          .select('*, time_off_type:time_off_types(*), user:users(id, first_name, last_name, role)')
          .eq('company_id', companyId),
        supabase
          .from('time_off_requests')
          .select(
            '*, time_off_type:time_off_types(*), user:users(id, first_name, last_name, role)',
          )
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
      ]);

      if (typesRes.data) setTypes(typesRes.data);
      if (limitsRes.data) setLimits(limitsRes.data);
      if (requestsRes.data) setRequests(requestsRes.data);
    } catch (err) {
      console.error('Error loading company time-off data', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!currentUser) return null;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-24">
      <SectionTabs section="urlopy" />
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CalendarOff className="w-6 h-6 text-indigo-600" />
          Zarządzanie urlopami
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Wnioski, limity i kalendarz nieobecności
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'requests' && (
        <RequestsTab
          requests={requests.filter((r) => visibleUserIds.has(r.user_id))}
          types={types}
          visibleUsers={visibleUsers}
          currentUser={currentUser}
          loading={loading}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'calendar' && (
        <CalendarTab
          requests={requests.filter(
            (r) => r.status === 'approved' && visibleUserIds.has(r.user_id),
          )}
          types={types}
          visibleUsers={visibleUsers}
        />
      )}
      {activeTab === 'limits' && (
        <LimitsTab
          limits={limits.filter((l) => visibleUserIds.has(l.user_id))}
          types={types.filter((t) => !t.is_archived)}
          visibleUsers={visibleUsers}
          companyId={companyId!}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'types' && (
        <TypesTab
          types={types}
          companyId={companyId!}
          onRefresh={loadData}
        />
      )}
    </div>
  );
};

// ===========================================================================
// TAB 1: REQUESTS
// ===========================================================================

interface RequestsTabProps {
  requests: TimeOffRequest[];
  types: TimeOffType[];
  visibleUsers: any[];
  currentUser: any;
  loading: boolean;
  onRefresh: () => Promise<void>;
}

const RequestsTab: React.FC<RequestsTabProps> = ({
  requests,
  types,
  visibleUsers,
  currentUser,
  loading,
  onRefresh,
}) => {
  const [statusFilter, setStatusFilter] = useState<TimeOffRequestStatus | 'all'>('pending');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter && r.time_off_type_id !== typeFilter) return false;
      if (employeeFilter && r.user_id !== employeeFilter) return false;
      if (searchTerm) {
        const name = getUserName(visibleUsers, r.user_id).toLowerCase();
        if (!name.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [requests, statusFilter, typeFilter, employeeFilter, searchTerm, visibleUsers]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pendingIds = filtered.filter((r) => r.status === 'pending').map((r) => r.id);
    if (pendingIds.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingIds));
    }
  };

  const approveRequest = async (id: string) => {
    setProcessing(true);
    try {
      const req = requests.find((r) => r.id === id);
      if (!req) return;
      const { error } = await supabase
        .from('time_off_requests')
        .update({
          status: 'approved',
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;

      // Update used_days in limits
      await supabase.rpc('increment_time_off_used_days', {
        p_user_id: req.user_id,
        p_type_id: req.time_off_type_id,
        p_year: new Date(req.start_date).getFullYear(),
        p_amount: req.amount,
      }).then(async (rpcRes) => {
        // Fallback: if RPC doesn't exist, do manual update
        if (rpcRes.error) {
          const { data: existingLimit } = await supabase
            .from('time_off_limits')
            .select('*')
            .eq('user_id', req.user_id)
            .eq('time_off_type_id', req.time_off_type_id)
            .eq('year', new Date(req.start_date).getFullYear())
            .single();

          if (existingLimit) {
            await supabase
              .from('time_off_limits')
              .update({ used_days: (existingLimit.used_days || 0) + req.amount })
              .eq('id', existingLimit.id);
          }
        }
      });

      await onRefresh();
    } catch (err) {
      console.error('Error approving request', err);
    } finally {
      setProcessing(false);
    }
  };

  const rejectRequest = async (id: string, reason: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('time_off_requests')
        .update({
          status: 'rejected',
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString(),
          note_reviewer: reason || null,
        })
        .eq('id', id);
      if (error) throw error;
      setRejectId(null);
      setRejectReason('');
      await onRefresh();
    } catch (err) {
      console.error('Error rejecting request', err);
    } finally {
      setProcessing(false);
    }
  };

  const bulkApprove = async () => {
    for (const id of selected) {
      await approveRequest(id);
    }
    setSelected(new Set());
  };

  const bulkReject = async () => {
    for (const id of selected) {
      await rejectRequest(id, '');
    }
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Szukaj pracownika</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Imię lub nazwisko..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Status */}
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="all">Wszystkie</option>
              <option value="pending">Oczekujące</option>
              <option value="approved">Zatwierdzone</option>
              <option value="rejected">Odrzucone</option>
              <option value="cancelled">Anulowane</option>
            </select>
          </div>

          {/* Type */}
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Typ urlopu</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="">Wszystkie typy</option>
              {types
                .filter((t) => !t.is_archived)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Employee */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Pracownik</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="">Wszyscy</option>
              {visibleUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 rounded-lg px-4 py-3 flex items-center gap-4 flex-wrap">
          <span className="text-sm text-indigo-700 font-medium">
            Zaznaczono: {selected.size}
          </span>
          <button
            onClick={bulkApprove}
            disabled={processing}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Zatwierdź wybrane
          </button>
          <button
            onClick={bulkReject}
            disabled={processing}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Odrzuć wybrane
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Ładowanie...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <CalendarOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Brak wniosków spełniających kryteria
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      onChange={toggleAll}
                      checked={
                        filtered.filter((r) => r.status === 'pending').length > 0 &&
                        filtered
                          .filter((r) => r.status === 'pending')
                          .every((r) => selected.has(r.id))
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Pracownik</th>
                  <th className="px-4 py-3 font-medium">Typ</th>
                  <th className="px-4 py-3 font-medium">Daty</th>
                  <th className="px-4 py-3 font-medium text-center">Dni</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium">Komentarz</th>
                  <th className="px-4 py-3 font-medium text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((req) => {
                  const sc = STATUS_CONFIG[req.status];
                  return (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        {req.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selected.has(req.id)}
                            onChange={() => toggleSelect(req.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {getUserName(visibleUsers, req.user_id)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: req.time_off_type?.color || '#6366f1',
                            }}
                          />
                          <span className="text-slate-600">
                            {req.time_off_type?.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDate(req.start_date)}
                        {req.start_date !== req.end_date && ` — ${formatDate(req.end_date)}`}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-slate-700">
                        {req.amount} {req.hourly ? 'godz.' : 'dni'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">
                        {req.note_worker || '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {req.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => approveRequest(req.id)}
                              disabled={processing}
                              className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                              title="Zatwierdź"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setRejectId(req.id);
                                setRejectReason('');
                              }}
                              disabled={processing}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Odrzuć"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Powód odrzucenia</h2>
              <button
                onClick={() => setRejectId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Wpisz powód odrzucenia (opcjonalnie)..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setRejectId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Anuluj
              </button>
              <button
                onClick={() => rejectRequest(rejectId, rejectReason)}
                disabled={processing}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Odrzuć wniosek
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// TAB 2: CALENDAR
// ===========================================================================

interface CalendarTabProps {
  requests: TimeOffRequest[];
  types: TimeOffType[];
  visibleUsers: any[];
}

const CalendarTab: React.FC<CalendarTabProps> = ({ requests, types, visibleUsers }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [deptFilter, setDeptFilter] = useState('');

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthLabel = currentMonth.toLocaleString('pl-PL', { month: 'long', year: 'numeric' });

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const totalDays = lastDay.getDate();

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) calendarCells.push(null);
  for (let d = 1; d <= totalDays; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  // For each day, find who is absent
  const getAbsences = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return requests.filter((r) => {
      if (deptFilter) {
        const user = visibleUsers.find((u) => u.id === r.user_id);
        if (!user || (user as any).department_id !== deptFilter) return false;
      }
      return r.start_date <= dateStr && r.end_date >= dateStr;
    });
  };

  const departments = useMemo(() => {
    const deptMap = new Map<string, string>();
    visibleUsers.forEach((u) => {
      const deptId = (u as any).department_id;
      const deptName = (u as any).department?.name;
      if (deptId && deptName) deptMap.set(deptId, deptName);
    });
    return Array.from(deptMap.entries());
  }, [visibleUsers]);

  const isToday = (day: number) => {
    const now = new Date();
    return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  };

  const isWeekend = (cellIndex: number) => {
    const dow = cellIndex % 7;
    return dow === 5 || dow === 6;
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-semibold text-slate-800 capitalize min-w-[200px] text-center">
            {monthLabel}
          </h3>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {departments.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="">Wszystkie działy</option>
              {departments.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7">
          {DAYS_PL.map((d) => (
            <div
              key={d}
              className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase bg-slate-50 border-b border-slate-200"
            >
              {d}
            </div>
          ))}

          {calendarCells.map((day, idx) => {
            const absences = day ? getAbsences(day) : [];
            const weekend = isWeekend(idx);
            return (
              <div
                key={idx}
                className={`min-h-[90px] border-b border-r border-slate-100 p-1.5 ${
                  weekend ? 'bg-slate-50/50' : ''
                } ${day && isToday(day) ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
              >
                {day && (
                  <>
                    <span
                      className={`text-xs font-medium ${
                        isToday(day)
                          ? 'bg-indigo-600 text-white w-6 h-6 rounded-full inline-flex items-center justify-center'
                          : weekend
                            ? 'text-slate-400'
                            : 'text-slate-600'
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {absences.slice(0, 3).map((abs) => (
                        <div
                          key={abs.id}
                          className="flex items-center gap-1 text-[10px] leading-tight"
                          title={`${getUserName(visibleUsers, abs.user_id)} — ${abs.time_off_type?.name}`}
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: abs.time_off_type?.color || '#6366f1',
                            }}
                          />
                          <span className="truncate text-slate-600">
                            {getUserName(visibleUsers, abs.user_id).split(' ')[0]}
                          </span>
                        </div>
                      ))}
                      {absences.length > 3 && (
                        <span className="text-[10px] text-slate-400">
                          +{absences.length - 3} więcej
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {types
          .filter((t) => !t.is_archived)
          .map((t) => (
            <div key={t.id} className="flex items-center gap-1.5 text-xs text-slate-600">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: t.color || '#6366f1' }}
              />
              {t.name}
            </div>
          ))}
      </div>
    </div>
  );
};

// ===========================================================================
// TAB 3: LIMITS
// ===========================================================================

interface LimitsTabProps {
  limits: TimeOffLimit[];
  types: TimeOffType[];
  visibleUsers: any[];
  companyId: string;
  onRefresh: () => Promise<void>;
}

const LimitsTab: React.FC<LimitsTabProps> = ({
  limits,
  types,
  visibleUsers,
  companyId,
  onRefresh,
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTypeId, setBulkTypeId] = useState('');
  const [bulkLimit, setBulkLimit] = useState('26');
  const [processing, setProcessing] = useState(false);

  const yearLimits = useMemo(
    () => limits.filter((l) => l.year === selectedYear),
    [limits, selectedYear],
  );

  // Build table rows: user x type
  const rows = useMemo(() => {
    const result: {
      userId: string;
      userName: string;
      typeId: string;
      typeName: string;
      limit: TimeOffLimit | undefined;
    }[] = [];
    visibleUsers.forEach((u) => {
      types.forEach((t) => {
        const lim = yearLimits.find(
          (l) => l.user_id === u.id && l.time_off_type_id === t.id,
        );
        result.push({
          userId: u.id,
          userName: `${u.first_name} ${u.last_name}`,
          typeId: t.id,
          typeName: t.name,
          limit: lim,
        });
      });
    });
    return result;
  }, [visibleUsers, types, yearLimits]);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  const startEdit = (cellKey: string, currentVal: number) => {
    setEditingCell(cellKey);
    setEditValue(String(currentVal));
  };

  const saveEdit = async (userId: string, typeId: string) => {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 0) {
      setEditingCell(null);
      return;
    }
    setProcessing(true);
    try {
      const existing = yearLimits.find(
        (l) => l.user_id === userId && l.time_off_type_id === typeId,
      );
      if (existing) {
        await supabase
          .from('time_off_limits')
          .update({ total_days: val })
          .eq('id', existing.id);
      } else {
        await supabase.from('time_off_limits').insert([
          {
            company_id: companyId,
            user_id: userId,
            time_off_type_id: typeId,
            year: selectedYear,
            total_days: val,
            used_days: 0,
            carried_over_days: 0,
          },
        ]);
      }
      setEditingCell(null);
      await onRefresh();
    } catch (err) {
      console.error('Error saving limit', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkLimits = async () => {
    if (!bulkTypeId || !bulkLimit) return;
    setProcessing(true);
    try {
      const val = parseInt(bulkLimit, 10);
      for (const user of visibleUsers) {
        const existing = yearLimits.find(
          (l) => l.user_id === user.id && l.time_off_type_id === bulkTypeId,
        );
        if (existing) {
          await supabase
            .from('time_off_limits')
            .update({ total_days: val })
            .eq('id', existing.id);
        } else {
          await supabase.from('time_off_limits').insert([
            {
              company_id: companyId,
              user_id: user.id,
              time_off_type_id: bulkTypeId,
              year: selectedYear,
              total_days: val,
              used_days: 0,
              carried_over_days: 0,
            },
          ]);
        }
      }
      setShowBulkModal(false);
      await onRefresh();
    } catch (err) {
      console.error('Error setting bulk limits', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleCarryOver = async () => {
    setProcessing(true);
    try {
      const nextYear = selectedYear + 1;
      for (const lim of yearLimits) {
        const remaining = lim.total_days + lim.carried_over_days - lim.used_days;
        if (remaining <= 0) continue;

        const existingNext = limits.find(
          (l) =>
            l.user_id === lim.user_id &&
            l.time_off_type_id === lim.time_off_type_id &&
            l.year === nextYear,
        );

        if (existingNext) {
          await supabase
            .from('time_off_limits')
            .update({ carried_over_days: remaining })
            .eq('id', existingNext.id);
        } else {
          await supabase.from('time_off_limits').insert([
            {
              company_id: companyId,
              user_id: lim.user_id,
              time_off_type_id: lim.time_off_type_id,
              year: nextYear,
              total_days: 0,
              used_days: 0,
              carried_over_days: remaining,
            },
          ]);
        }
      }
      await onRefresh();
    } catch (err) {
      console.error('Error carrying over', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">Rok:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setBulkTypeId(types[0]?.id || '');
              setBulkLimit('26');
              setShowBulkModal(true);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ustaw limity dla wszystkich
          </button>
          <button
            onClick={handleCarryOver}
            disabled={processing}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            Przenieś resztki
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <th className="px-4 py-3 font-medium">Pracownik</th>
                <th className="px-4 py-3 font-medium">Typ urlopu</th>
                <th className="px-4 py-3 font-medium text-center">Limit</th>
                <th className="px-4 py-3 font-medium text-center">Wykorzystane</th>
                <th className="px-4 py-3 font-medium text-center">Pozostało</th>
                <th className="px-4 py-3 font-medium text-center">Przeniesione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Brak danych limitów
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const total = row.limit?.total_days ?? 0;
                  const used = row.limit?.used_days ?? 0;
                  const carried = row.limit?.carried_over_days ?? 0;
                  const remaining = total + carried - used;
                  const cellKey = `${row.userId}-${row.typeId}`;

                  return (
                    <tr key={cellKey} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {row.userName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.typeName}</td>
                      <td className="px-4 py-3 text-center">
                        {editingCell === cellKey ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(row.userId, row.typeId)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(row.userId, row.typeId);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            autoFocus
                            className="w-16 text-center border border-indigo-300 rounded px-1 py-0.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(cellKey, total)}
                            className="inline-flex items-center gap-1 text-slate-700 hover:text-indigo-600 font-medium cursor-pointer group"
                            title="Kliknij, aby edytować"
                          >
                            {total}
                            <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{used}</td>
                      <td
                        className={`px-4 py-3 text-center font-bold ${
                          remaining > 0 ? 'text-green-600' : remaining < 0 ? 'text-red-600' : 'text-slate-500'
                        }`}
                      >
                        {remaining}
                      </td>
                      <td className="px-4 py-3 text-center text-indigo-600 font-medium">
                        {carried > 0 ? carried : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Limits Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                Ustaw limity dla wszystkich
              </h2>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Typ urlopu
                </label>
                <select
                  value={bulkTypeId}
                  onChange={(e) => setBulkTypeId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Liczba dni
                </label>
                <input
                  type="number"
                  value={bulkLimit}
                  onChange={(e) => setBulkLimit(e.target.value)}
                  min={0}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <p className="text-xs text-slate-500">
                Limit zostanie ustawiony dla {visibleUsers.length} pracowników na rok{' '}
                {selectedYear}.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Anuluj
              </button>
              <button
                onClick={handleBulkLimits}
                disabled={processing || !bulkTypeId}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {processing ? 'Zapisywanie...' : 'Ustaw limity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// TAB 4: LEAVE TYPES
// ===========================================================================

interface TypesTabProps {
  types: TimeOffType[];
  companyId: string;
  onRefresh: () => Promise<void>;
}

const TypesTab: React.FC<TypesTabProps> = ({ types, companyId, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<TimeOffType | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#6366f1');
  const [formPaid, setFormPaid] = useState(true);
  const [formRequiresApproval, setFormRequiresApproval] = useState(true);
  const [formHalfDay, setFormHalfDay] = useState(false);
  const [formHourly, setFormHourly] = useState(false);

  const activeTypes = types.filter((t) => !t.is_archived);
  const archivedTypes = types.filter((t) => t.is_archived);

  const openCreate = () => {
    setEditingType(null);
    setFormName('');
    setFormColor('#6366f1');
    setFormPaid(true);
    setFormRequiresApproval(true);
    setFormHalfDay(false);
    setFormHourly(false);
    setShowModal(true);
  };

  const openEdit = (t: TimeOffType) => {
    setEditingType(t);
    setFormName(t.name);
    setFormColor(t.color || '#6366f1');
    setFormPaid(t.is_paid);
    setFormRequiresApproval(t.requires_approval);
    setFormHalfDay(t.allows_half_day);
    setFormHourly(t.allows_hourly);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setProcessing(true);
    try {
      if (editingType) {
        const { error } = await supabase
          .from('time_off_types')
          .update({
            name: formName.trim(),
            color: formColor,
            is_paid: formPaid,
            requires_approval: formRequiresApproval,
            allows_half_day: formHalfDay,
            allows_hourly: formHourly,
          })
          .eq('id', editingType.id);
        if (error) throw error;
      } else {
        const maxOrder =
          types.reduce((max, t) => Math.max(max, t.display_order || 0), 0) + 1;
        const { error } = await supabase.from('time_off_types').insert([
          {
            company_id: companyId,
            name: formName.trim(),
            color: formColor,
            icon: 'calendar',
            is_paid: formPaid,
            requires_approval: formRequiresApproval,
            allows_half_day: formHalfDay,
            allows_hourly: formHourly,
            is_archived: false,
            display_order: maxOrder,
          },
        ]);
        if (error) throw error;
      }
      setShowModal(false);
      await onRefresh();
    } catch (err) {
      console.error('Error saving type', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleArchive = async (id: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('time_off_types')
        .update({ is_archived: true })
        .eq('id', id);
      if (error) throw error;
      await onRefresh();
    } catch (err) {
      console.error('Error archiving type', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async (id: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('time_off_types')
        .update({ is_archived: false })
        .eq('id', id);
      if (error) throw error;
      await onRefresh();
    } catch (err) {
      console.error('Error restoring type', err);
    } finally {
      setProcessing(false);
    }
  };

  const BoolBadge: React.FC<{ value: boolean; trueLabel: string; falseLabel: string }> = ({
    value,
    trueLabel,
    falseLabel,
  }) => (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        value ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {value ? trueLabel : falseLabel}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500">
          Aktywne typy: {activeTypes.length}
        </h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nowy typ urlopu
        </button>
      </div>

      {/* Active types table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <th className="px-4 py-3 font-medium">Nazwa</th>
                <th className="px-4 py-3 font-medium text-center">Kolor</th>
                <th className="px-4 py-3 font-medium text-center">Płatny</th>
                <th className="px-4 py-3 font-medium text-center">Wymaga zatwierdzenia</th>
                <th className="px-4 py-3 font-medium text-center">Pół dnia</th>
                <th className="px-4 py-3 font-medium text-center">Godzinowy</th>
                <th className="px-4 py-3 font-medium text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTypes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Brak aktywnych typów urlopów
                  </td>
                </tr>
              ) : (
                activeTypes.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700">{t.name}</td>
                    <td className="px-4 py-3 text-center">
                      <div
                        className="w-6 h-6 rounded-full mx-auto border border-slate-200"
                        style={{ backgroundColor: t.color || '#6366f1' }}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BoolBadge value={t.is_paid} trueLabel="Tak" falseLabel="Nie" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BoolBadge
                        value={t.requires_approval}
                        trueLabel="Tak"
                        falseLabel="Nie"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BoolBadge value={t.allows_half_day} trueLabel="Tak" falseLabel="Nie" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BoolBadge value={t.allows_hourly} trueLabel="Tak" falseLabel="Nie" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edytuj"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleArchive(t.id)}
                          disabled={processing}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Archiwizuj"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Archived types */}
      {archivedTypes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-400">
            Zarchiwizowane ({archivedTypes.length})
          </h4>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {archivedTypes.map((t) => (
                    <tr key={t.id} className="text-slate-400">
                      <td className="px-4 py-3">{t.name}</td>
                      <td className="px-4 py-3">
                        <div
                          className="w-4 h-4 rounded-full opacity-50"
                          style={{ backgroundColor: t.color || '#6366f1' }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRestore(t.id)}
                          disabled={processing}
                          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                        >
                          Przywróć
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingType ? 'Edytuj typ urlopu' : 'Nowy typ urlopu'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nazwa
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="np. Urlop wypoczynkowy"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kolor
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4">
                <ToggleField label="Płatny" value={formPaid} onChange={setFormPaid} />
                <ToggleField
                  label="Wymaga zatwierdzenia"
                  value={formRequiresApproval}
                  onChange={setFormRequiresApproval}
                />
                <ToggleField label="Pół dnia" value={formHalfDay} onChange={setFormHalfDay} />
                <ToggleField label="Godzinowy" value={formHourly} onChange={setFormHourly} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Anuluj
              </button>
              <button
                onClick={handleSave}
                disabled={processing || !formName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {processing
                  ? 'Zapisywanie...'
                  : editingType
                    ? 'Zapisz zmiany'
                    : 'Utwórz typ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared Toggle Field component
// ---------------------------------------------------------------------------
const ToggleField: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
    <span className="text-sm text-slate-700">{label}</span>
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
    </label>
  </div>
);

export default CompanyTimeOffPage;
