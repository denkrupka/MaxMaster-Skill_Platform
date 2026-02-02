import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Download,
  Plane,
  Info,
  RefreshCw,
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

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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
  { id: 'requests', label: 'Wnioski urlopowe' },
  { id: 'calendar', label: 'Kalendarz urlopowy' },
  { id: 'limits', label: 'Limity pracowników' },
  { id: 'types', label: 'Typy' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const DAY_NAMES_SHORT = ['Niedz.', 'Pon.', 'Wt.', 'Śr.', 'Czw.', 'Pt.', 'Sob.'];

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
          .select('*, time_off_type:time_off_types(*), user:users(id, first_name, last_name, role, target_position)')
          .eq('company_id', companyId),
        supabase
          .from('time_off_requests')
          .select(
            '*, time_off_type:time_off_types(*), user:users(id, first_name, last_name, role, target_position)',
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
          requests={requests.filter((r) => visibleUserIds.has(r.user_id))}
          types={types}
          visibleUsers={visibleUsers}
          companyId={companyId!}
          currentUser={currentUser}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'limits' && (
        <LimitsTab
          limits={limits.filter((l) => visibleUserIds.has(l.user_id))}
          types={types.filter((t) => !t.is_archived)}
          visibleUsers={visibleUsers}
          companyId={companyId!}
          requests={requests.filter((r) => visibleUserIds.has(r.user_id))}
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
  const [statusFilter, setStatusFilter] = useState<TimeOffRequestStatus | 'all'>('all');
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

      await supabase.rpc('increment_time_off_used_days', {
        p_user_id: req.user_id,
        p_type_id: req.time_off_type_id,
        p_year: new Date(req.start_date).getFullYear(),
        p_amount: req.amount,
      }).then(async (rpcRes) => {
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
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Pracownik</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="">Wszyscy</option>
              {visibleUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="Odśwież"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
                            style={{ backgroundColor: req.time_off_type?.color || '#6366f1' }}
                          />
                          <span className="text-slate-600">{req.time_off_type?.name || '—'}</span>
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
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
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
              <button onClick={() => setRejectId(null)} className="text-slate-400 hover:text-slate-600">
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
// TAB 2: CALENDAR (horizontal timeline)
// ===========================================================================

interface CalendarTabProps {
  requests: TimeOffRequest[];
  types: TimeOffType[];
  visibleUsers: any[];
  companyId: string;
  currentUser: any;
  onRefresh: () => Promise<void>;
}

const CalendarTab: React.FC<CalendarTabProps> = ({
  requests,
  types,
  visibleUsers,
  companyId,
  currentUser,
  onRefresh,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [deptFilter, setDeptFilter] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragUserId, setDragUserId] = useState<string | null>(null);
  const [dragStartDay, setDragStartDay] = useState<number | null>(null);
  const [dragEndDay, setDragEndDay] = useState<number | null>(null);

  // Add request form state
  const [modalEmployeeId, setModalEmployeeId] = useState('');
  const [modalTypeId, setModalTypeId] = useState('');
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');
  const [modalComment, setModalComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthLabel = currentMonth.toLocaleString('pl-PL', { month: 'long', year: 'numeric' });

  const departments = useMemo(() => {
    const deptMap = new Map<string, string>();
    visibleUsers.forEach((u) => {
      const deptId = (u as any).department_id;
      const deptName = (u as any).department?.name;
      if (deptId && deptName) deptMap.set(deptId, deptName);
    });
    return Array.from(deptMap.entries());
  }, [visibleUsers]);

  const filteredUsers = useMemo(() => {
    if (!deptFilter) return visibleUsers;
    return visibleUsers.filter((u) => (u as any).department_id === deptFilter);
  }, [visibleUsers, deptFilter]);

  const approvedRequests = useMemo(
    () => requests.filter((r) => r.status === 'approved'),
    [requests],
  );

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const isWeekend = (day: number) => {
    const d = new Date(year, month, day);
    const dow = d.getDay();
    return dow === 0 || dow === 6;
  };

  const getAbsenceForCell = (userId: string, day: number): TimeOffRequest | undefined => {
    const dateStr = toDateStr(year, month, day);
    return approvedRequests.find(
      (r) => r.user_id === userId && r.start_date <= dateStr && r.end_date >= dateStr,
    );
  };

  // Drag handlers
  const handleMouseDown = (userId: string, day: number) => {
    setIsDragging(true);
    setDragUserId(userId);
    setDragStartDay(day);
    setDragEndDay(day);
  };

  const handleMouseEnter = (userId: string, day: number) => {
    if (isDragging && userId === dragUserId) {
      setDragEndDay(day);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragUserId && dragStartDay && dragEndDay) {
      const startDay = Math.min(dragStartDay, dragEndDay);
      const endDay = Math.max(dragStartDay, dragEndDay);
      const startDate = toDateStr(year, month, startDay);
      const endDate = toDateStr(year, month, endDay);

      setModalEmployeeId(dragUserId);
      setModalStartDate(startDate);
      setModalEndDate(endDate);
      setModalTypeId(types.filter((t) => !t.is_archived)[0]?.id || '');
      setModalComment('');
      setShowAddModal(true);
    }
    setIsDragging(false);
    setDragUserId(null);
    setDragStartDay(null);
    setDragEndDay(null);
  };

  const isDragSelected = (userId: string, day: number) => {
    if (!isDragging || userId !== dragUserId || !dragStartDay || !dragEndDay) return false;
    const minDay = Math.min(dragStartDay, dragEndDay);
    const maxDay = Math.max(dragStartDay, dragEndDay);
    return day >= minDay && day <= maxDay;
  };

  const openAddModal = () => {
    setModalEmployeeId('');
    setModalTypeId(types.filter((t) => !t.is_archived)[0]?.id || '');
    setModalStartDate('');
    setModalEndDate('');
    setModalComment('');
    setShowAddModal(true);
  };

  const handleAddRequest = async () => {
    if (!modalEmployeeId || !modalTypeId || !modalStartDate) return;
    setSubmitting(true);
    try {
      const endDate = modalEndDate || modalStartDate;
      const amount = countBusinessDays(modalStartDate, endDate);
      const { error } = await supabase.from('time_off_requests').insert([{
        company_id: companyId,
        user_id: modalEmployeeId,
        time_off_type_id: modalTypeId,
        start_date: modalStartDate,
        end_date: endDate,
        all_day: true,
        hourly: false,
        amount,
        status: 'pending' as TimeOffRequestStatus,
        note_worker: modalComment || null,
      }]);
      if (error) throw error;
      setShowAddModal(false);
      await onRefresh();
    } catch (err) {
      console.error('Error adding request', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate remaining days for selected employee+type
  const modalRemaining = useMemo(() => {
    if (!modalEmployeeId || !modalTypeId) return null;
    const type = types.find((t) => t.id === modalTypeId);
    if (!type) return null;
    if (!type.is_limited && !(type as any).limit_days) return 'Nielimitowany';
    // Check limits - we don't have limits in this component directly
    // but we can show from requests
    return null;
  }, [modalEmployeeId, modalTypeId, types]);

  const modalSelectedDays = useMemo(() => {
    if (!modalStartDate) return 0;
    const end = modalEndDate || modalStartDate;
    return countBusinessDays(modalStartDate, end);
  }, [modalStartDate, modalEndDate]);

  const handleExport = () => {
    const rows: string[] = [];
    rows.push('Pracownik;' + Array.from({ length: totalDays }, (_, i) => i + 1).join(';'));
    filteredUsers.forEach((u) => {
      const name = `${u.first_name} ${u.last_name}`;
      const cells = Array.from({ length: totalDays }, (_, i) => {
        const absence = getAbsenceForCell(u.id, i + 1);
        return absence ? absence.time_off_type?.name || 'Urlop' : '';
      });
      rows.push(name + ';' + cells.join(';'));
    });
    const csv = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kalendarz_urlopowy_${year}_${String(month + 1).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate initials
  const getInitials = (user: any) => {
    return `${(user.first_name || '')[0] || ''}${(user.last_name || '')[0] || ''}`.toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Department filter */}
            <div className="relative">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="appearance-none border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                <option value="">Wybierz oddział</option>
                {departments.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Month navigation */}
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-800 capitalize">
              {monthLabel}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="flex items-center gap-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filtruj
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Eksportuj
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Wniosek
            </button>
          </div>
        </div>

        {/* Employee count */}
        <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
          <span>{filteredUsers.length} pracowników</span>
          <button className="p-1 rounded hover:bg-slate-100 transition-colors">
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Calendar Timeline */}
      <div
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDragging) handleMouseUp();
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: `${260 + totalDays * 44}px` }}>
            <thead>
              <tr>
                {/* Empty corner cell */}
                <th className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 w-[260px] min-w-[260px]" />
                {/* Day headers */}
                {Array.from({ length: totalDays }, (_, i) => {
                  const day = i + 1;
                  const date = new Date(year, month, day);
                  const dow = date.getDay();
                  const weekend = dow === 0 || dow === 6;
                  const todayMark = isToday(day);

                  return (
                    <th
                      key={day}
                      className={`border-b border-r border-slate-200 text-center px-0.5 py-2 min-w-[44px] w-[44px] ${
                        weekend ? 'bg-slate-100' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`text-xs font-bold leading-none ${
                            todayMark
                              ? 'bg-slate-700 text-white w-6 h-6 rounded-full flex items-center justify-center'
                              : weekend
                                ? 'text-slate-400'
                                : 'text-slate-700'
                          }`}
                        >
                          {day}
                        </span>
                        <span className={`text-[10px] leading-none ${weekend ? 'text-slate-400 font-medium' : 'text-slate-400'}`}>
                          {DAY_NAMES_SHORT[dow]}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="group">
                  {/* Employee name */}
                  <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                        {getInitials(user)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {(user as any).target_position || ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Day cells */}
                  {Array.from({ length: totalDays }, (_, i) => {
                    const day = i + 1;
                    const weekend = isWeekend(day);
                    const absence = getAbsenceForCell(user.id, day);
                    const dragSel = isDragSelected(user.id, day);

                    return (
                      <td
                        key={day}
                        className={`border-b border-r border-slate-100 p-0 cursor-pointer select-none transition-colors ${
                          weekend ? 'bg-slate-50' : ''
                        } ${dragSel ? 'bg-indigo-100' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleMouseDown(user.id, day);
                        }}
                        onMouseEnter={() => handleMouseEnter(user.id, day)}
                        title={
                          absence
                            ? `${absence.time_off_type?.name || 'Urlop'}: ${formatDate(absence.start_date)} — ${formatDate(absence.end_date)}`
                            : `${user.first_name} ${user.last_name} — ${day}.${String(month + 1).padStart(2, '0')}.${year}`
                        }
                      >
                        {absence && (
                          <div
                            className="w-full h-[40px] flex items-center justify-center"
                            style={{ backgroundColor: (absence.time_off_type?.color || '#6366f1') + '30' }}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: absence.time_off_type?.color || '#6366f1' }}
                            />
                          </div>
                        )}
                        {!absence && <div className="w-full h-[40px]" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={totalDays + 1} className="p-8 text-center text-slate-400">
                    Brak pracowników
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {types
          .filter((t) => !t.is_archived)
          .map((t) => (
            <div key={t.id} className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#6366f1' }} />
              {t.name}
            </div>
          ))}
      </div>

      {/* Add Request Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Dodaj wniosek</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Employee */}
              <div>
                <div className="relative">
                  <select
                    value={modalEmployeeId}
                    onChange={(e) => setModalEmployeeId(e.target.value)}
                    className="w-full appearance-none border border-slate-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                  >
                    <option value="">Wybierz pracownika</option>
                    {filteredUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Leave type */}
              {modalEmployeeId && (
                <div>
                  <div className="relative">
                    <select
                      value={modalTypeId}
                      onChange={(e) => setModalTypeId(e.target.value)}
                      className="w-full appearance-none border border-slate-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      <option value="">Wybierz typ wniosku</option>
                      {types.filter((t) => !t.is_archived).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Dates */}
              {!modalEmployeeId ? (
                <div className="border border-slate-200 rounded-lg px-3 py-3 text-sm text-slate-400">
                  Najpierw wybierz pracownika
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Od</label>
                    <input
                      type="date"
                      value={modalStartDate}
                      onChange={(e) => {
                        setModalStartDate(e.target.value);
                        if (!modalEndDate || e.target.value > modalEndDate) {
                          setModalEndDate(e.target.value);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Do</label>
                    <input
                      type="date"
                      value={modalEndDate}
                      min={modalStartDate || undefined}
                      onChange={(e) => setModalEndDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Balance info */}
              <div className="bg-indigo-50 rounded-lg px-4 py-3">
                <div className="text-sm text-indigo-700">
                  <span className="font-medium">Do wykorzystania:</span>{' '}
                  {!modalTypeId ? 'Wybierz typ wniosku' : modalRemaining || 'Dostępny'}
                </div>
                <div className="text-sm text-indigo-700 mt-0.5">
                  <span className="font-medium">Wybrano:</span> {modalSelectedDays} {modalSelectedDays === 1 ? 'dzień' : 'dni'}
                </div>
              </div>

              {/* Comment */}
              <div>
                <input
                  type="text"
                  value={modalComment}
                  onChange={(e) => setModalComment(e.target.value)}
                  placeholder="Dodaj komentarz"
                  className="w-full border border-slate-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100">
              <button
                onClick={handleAddRequest}
                disabled={submitting || !modalEmployeeId || !modalTypeId || !modalStartDate || modalSelectedDays <= 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-lg text-sm font-semibold transition-colors"
              >
                {submitting ? 'Dodawanie...' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// TAB 3: LIMITS (expandable employee list)
// ===========================================================================

interface LimitsTabProps {
  limits: TimeOffLimit[];
  types: TimeOffType[];
  visibleUsers: any[];
  companyId: string;
  requests: TimeOffRequest[];
  onRefresh: () => Promise<void>;
}

const LimitsTab: React.FC<LimitsTabProps> = ({
  limits,
  types,
  visibleUsers,
  companyId,
  requests,
  onRefresh,
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTypeId, setBulkTypeId] = useState('');
  const [bulkLimit, setBulkLimit] = useState('26');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const yearLimits = useMemo(
    () => limits.filter((l) => l.year === selectedYear),
    [limits, selectedYear],
  );

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  const toggleExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  // Calculate planned (future approved) days for a user+type
  const getPlannedDays = (userId: string, typeId: string): number => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return requests
      .filter(
        (r) =>
          r.user_id === userId &&
          r.time_off_type_id === typeId &&
          r.status === 'approved' &&
          r.start_date >= todayStr,
      )
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  };

  // Get used days for a user+type
  const getUsedDays = (userId: string, typeId: string): number => {
    const lim = yearLimits.find((l) => l.user_id === userId && l.time_off_type_id === typeId);
    return lim?.used_days ?? 0;
  };

  const getLimitData = (userId: string, typeId: string): TimeOffLimit | undefined =>
    yearLimits.find((l) => l.user_id === userId && l.time_off_type_id === typeId);

  const isTypeEnabled = (userId: string, typeId: string): boolean => {
    const lim = getLimitData(userId, typeId);
    if (!lim) return true; // default enabled
    return lim.is_enabled !== false;
  };

  const toggleTypeEnabled = async (userId: string, typeId: string) => {
    setProcessing(true);
    try {
      const existing = getLimitData(userId, typeId);
      const newEnabled = !isTypeEnabled(userId, typeId);

      if (existing) {
        await supabase
          .from('time_off_limits')
          .update({ is_enabled: newEnabled })
          .eq('id', existing.id);
      } else {
        await supabase.from('time_off_limits').insert([{
          company_id: companyId,
          user_id: userId,
          time_off_type_id: typeId,
          year: selectedYear,
          total_days: 0,
          used_days: 0,
          carried_over_days: 0,
          is_enabled: newEnabled,
        }]);
      }
      await onRefresh();
    } catch (err) {
      console.error('Error toggling type enabled', err);
    } finally {
      setProcessing(false);
    }
  };

  const saveEdit = async (userId: string, typeId: string) => {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 0) {
      setEditingCell(null);
      return;
    }
    setProcessing(true);
    try {
      const existing = getLimitData(userId, typeId);
      if (existing) {
        await supabase
          .from('time_off_limits')
          .update({ total_days: val })
          .eq('id', existing.id);
      } else {
        await supabase.from('time_off_limits').insert([{
          company_id: companyId,
          user_id: userId,
          time_off_type_id: typeId,
          year: selectedYear,
          total_days: val,
          used_days: 0,
          carried_over_days: 0,
        }]);
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
          await supabase.from('time_off_limits').insert([{
            company_id: companyId,
            user_id: user.id,
            time_off_type_id: bulkTypeId,
            year: selectedYear,
            total_days: val,
            used_days: 0,
            carried_over_days: 0,
          }]);
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
          await supabase.from('time_off_limits').insert([{
            company_id: companyId,
            user_id: lim.user_id,
            time_off_type_id: lim.time_off_type_id,
            year: nextYear,
            total_days: 0,
            used_days: 0,
            carried_over_days: remaining,
          }]);
        }
      }
      await onRefresh();
    } catch (err) {
      console.error('Error carrying over', err);
    } finally {
      setProcessing(false);
    }
  };

  const getInitials = (user: any) =>
    `${(user.first_name || '')[0] || ''}${(user.last_name || '')[0] || ''}`.toUpperCase();

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
              <option key={y} value={y}>{y}</option>
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

      {/* Employee list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
        {visibleUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Brak pracowników</div>
        ) : (
          visibleUsers.map((user) => {
            const isExpanded = expandedUsers.has(user.id);
            return (
              <div key={user.id}>
                {/* Employee row */}
                <button
                  onClick={() => toggleExpand(user.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                      {getInitials(user)}
                    </div>
                    <span className="font-medium text-slate-800">
                      {user.first_name} {user.last_name}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {/* Expanded: leave types table */}
                {isExpanded && (
                  <div className="bg-slate-50/50 border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 uppercase">
                          <th className="px-6 py-2.5 font-medium">Nazwa</th>
                          <th className="px-4 py-2.5 font-medium">Zaplanowane</th>
                          <th className="px-4 py-2.5 font-medium">Wykorzystanie</th>
                          <th className="px-4 py-2.5 font-medium">Pozostało</th>
                          <th className="px-4 py-2.5 font-medium">Limit</th>
                          <th className="px-4 py-2.5 font-medium text-right">Dostępność</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {types.map((type) => {
                          const limData = getLimitData(user.id, type.id);
                          const total = limData?.total_days ?? 0;
                          const carried = limData?.carried_over_days ?? 0;
                          const used = getUsedDays(user.id, type.id);
                          const planned = getPlannedDays(user.id, type.id);
                          const isLimited = type.is_limited || total > 0 || carried > 0;
                          const totalAvailable = total + carried;
                          const remaining = isLimited ? totalAvailable - used : null;
                          const limitDisplay = isLimited ? `${totalAvailable} dni` : 'Nielimitowany';
                          const remainingDisplay = isLimited ? `${remaining} dni` : 'Nielimitowany';
                          const enabled = isTypeEnabled(user.id, type.id);
                          const cellKey = `${user.id}-${type.id}`;

                          return (
                            <tr key={type.id} className="hover:bg-white/50 transition-colors">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: (type.color || '#6366f1') + '20' }}>
                                    <Plane className="w-3.5 h-3.5" style={{ color: type.color || '#6366f1' }} />
                                  </div>
                                  <span className="font-medium text-slate-700">{type.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{planned} dni</td>
                              <td className="px-4 py-3 text-slate-600">{used} dni</td>
                              <td className="px-4 py-3">
                                <span className={`font-medium ${
                                  remaining !== null && remaining < 0
                                    ? 'text-red-600'
                                    : remaining !== null
                                      ? 'text-slate-700'
                                      : 'text-slate-500'
                                }`}>
                                  {remainingDisplay}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {editingCell === cellKey ? (
                                  <input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => saveEdit(user.id, type.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEdit(user.id, type.id);
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                    autoFocus
                                    className="w-16 text-center border border-indigo-300 rounded px-1 py-0.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                  />
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingCell(cellKey);
                                      setEditValue(String(total));
                                    }}
                                    className="inline-flex items-center gap-1 text-slate-700 hover:text-indigo-600 font-medium cursor-pointer group"
                                    title="Kliknij, aby edytować limit"
                                  >
                                    {limitDisplay}
                                    <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => toggleTypeEnabled(user.id, type.id)}
                                  disabled={processing}
                                  className={`inline-flex px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                    enabled
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  {enabled ? 'Włączony' : 'Wyłączony'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bulk Limits Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Ustaw limity dla wszystkich</h2>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Typ urlopu</label>
                <select
                  value={bulkTypeId}
                  onChange={(e) => setBulkTypeId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Liczba dni</label>
                <input
                  type="number"
                  value={bulkLimit}
                  onChange={(e) => setBulkLimit(e.target.value)}
                  min={0}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <p className="text-xs text-slate-500">
                Limit zostanie ustawiony dla {visibleUsers.length} pracowników na rok {selectedYear}.
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

  // Form fields
  const [formName, setFormName] = useState('');
  const [formShortcut, setFormShortcut] = useState('');
  const [formColor, setFormColor] = useState('#6366f1');
  const [formIsSubtype, setFormIsSubtype] = useState(false);
  const [formParentTypeId, setFormParentTypeId] = useState('');
  const [formIsDaily, setFormIsDaily] = useState(true);
  const [formHasRate, setFormHasRate] = useState(true);
  const [formPayRate, setFormPayRate] = useState(100);
  const [formIsLimited, setFormIsLimited] = useState(true);
  const [formLimitDays, setFormLimitDays] = useState(20);
  const [formCountHolidays, setFormCountHolidays] = useState(false);
  const [formCountWeekends, setFormCountWeekends] = useState(false);
  const [formCarryOver, setFormCarryOver] = useState(false);
  const [formRequireAdvance, setFormRequireAdvance] = useState(false);
  const [formAutoApprove, setFormAutoApprove] = useState(false);
  const [formDefaultComment, setFormDefaultComment] = useState('');

  const activeTypes = types.filter((t) => !t.is_archived);
  const archivedTypes = types.filter((t) => t.is_archived);

  const openCreate = () => {
    setEditingType(null);
    setFormName('');
    setFormShortcut('');
    setFormColor('#6366f1');
    setFormIsSubtype(false);
    setFormParentTypeId('');
    setFormIsDaily(true);
    setFormHasRate(true);
    setFormPayRate(100);
    setFormIsLimited(true);
    setFormLimitDays(20);
    setFormCountHolidays(false);
    setFormCountWeekends(false);
    setFormCarryOver(false);
    setFormRequireAdvance(false);
    setFormAutoApprove(false);
    setFormDefaultComment('');
    setShowModal(true);
  };

  const openEdit = (t: TimeOffType) => {
    setEditingType(t);
    setFormName(t.name);
    setFormShortcut(t.shortcut || '');
    setFormColor(t.color || '#6366f1');
    setFormIsSubtype(t.is_subtype || false);
    setFormParentTypeId(t.parent_type_id || '');
    setFormIsDaily(t.is_daily !== false);
    setFormHasRate(t.pay_rate !== undefined ? t.pay_rate > 0 : t.is_paid);
    setFormPayRate(t.pay_rate ?? (t.is_paid ? 100 : 0));
    setFormIsLimited(t.is_limited || false);
    setFormLimitDays(t.limit_days || 20);
    setFormCountHolidays(t.count_holidays || false);
    setFormCountWeekends(t.count_weekends || false);
    setFormCarryOver(t.carry_over || false);
    setFormRequireAdvance(t.require_advance || false);
    setFormAutoApprove(t.auto_approve || false);
    setFormDefaultComment(t.default_comment || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setProcessing(true);
    try {
      const data: any = {
        name: formName.trim(),
        color: formColor,
        shortcut: formShortcut.trim() || null,
        is_subtype: formIsSubtype,
        parent_type_id: formIsSubtype ? formParentTypeId || null : null,
        is_paid: formHasRate && formPayRate > 0,
        pay_rate: formHasRate ? formPayRate : 0,
        is_limited: formIsLimited,
        limit_days: formIsLimited ? formLimitDays : null,
        is_daily: formIsDaily,
        allows_hourly: !formIsDaily,
        requires_approval: !formAutoApprove,
        count_holidays: formCountHolidays,
        count_weekends: formCountWeekends,
        carry_over: formCarryOver,
        require_advance: formRequireAdvance,
        auto_approve: formAutoApprove,
        default_comment: formDefaultComment.trim() || null,
      };

      if (editingType) {
        const { error } = await supabase
          .from('time_off_types')
          .update(data)
          .eq('id', editingType.id);
        if (error) throw error;
      } else {
        const maxOrder = types.reduce((max, t) => Math.max(max, t.display_order || 0), 0) + 1;
        const { error } = await supabase.from('time_off_types').insert([{
          ...data,
          company_id: companyId,
          icon: 'calendar',
          allows_half_day: false,
          is_archived: false,
          display_order: maxOrder,
        }]);
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

  const getPayLabel = (t: TimeOffType) => {
    const rate = t.pay_rate ?? (t.is_paid ? 100 : 0);
    if (rate > 0) return `${rate}%`;
    return 'Bezpłatny';
  };

  const getLimitLabel = (t: TimeOffType) => {
    if (t.is_limited && t.limit_days) return `${t.limit_days} dni`;
    return 'Nielimitowany';
  };

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
                <th className="px-4 py-3 font-medium text-center">Limit</th>
                <th className="px-4 py-3 font-medium text-center">Płatny</th>
                <th className="px-4 py-3 font-medium text-center">Wymaga zatwierdzenia</th>
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
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        {t.name}
                        {t.shortcut && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {t.shortcut}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div
                        className="w-6 h-6 rounded-full mx-auto border border-slate-200"
                        style={{ backgroundColor: t.color || '#6366f1' }}
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {getLimitLabel(t)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        (t.pay_rate ?? (t.is_paid ? 100 : 0)) > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {getPayLabel(t)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.requires_approval ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {t.requires_approval ? 'Tak' : 'Nie'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.allows_hourly ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {t.allows_hourly ? 'Tak' : 'Nie'}
                      </span>
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

      {/* Create/Edit Modal - Full featured */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingType ? 'Edytuj typ wniosku' : 'Dodaj typ wniosku'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Section: Informacje podstawowe */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-indigo-500 uppercase tracking-wide">
                  Informacje podstawowe
                </h4>

                <div className="flex gap-3">
                  {/* Name */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nazwa wniosku
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="np. Urlop wypoczynkowy"
                        className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                      <Plane className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                    </div>
                  </div>
                  {/* Shortcut */}
                  <div className="w-24">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Skrót
                    </label>
                    <input
                      type="text"
                      value={formShortcut}
                      onChange={(e) => setFormShortcut(e.target.value.slice(0, 3).toUpperCase())}
                      maxLength={3}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    <div className="text-right text-[10px] text-slate-400 mt-0.5">
                      {formShortcut.length}/3
                    </div>
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kolor</label>
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

                {/* Subtype */}
                <CheckboxField
                  label="To jest podtyp wniosku"
                  checked={formIsSubtype}
                  onChange={setFormIsSubtype}
                  filled
                />

                {/* Parent type */}
                {formIsSubtype && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Wykorzystuj limit z
                    </label>
                    <select
                      value={formParentTypeId}
                      onChange={(e) => setFormParentTypeId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="">Brak dodanych typów wniosków</option>
                      {activeTypes
                        .filter((t) => t.id !== editingType?.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Section: Ustawienia limitów i rozliczeń */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Ustawienia limitów i rozliczeń
                </h4>

                {/* Daily/Hourly toggle */}
                <div className="flex rounded-full bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setFormIsDaily(false)}
                    className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
                      !formIsDaily
                        ? 'bg-white shadow text-slate-800'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Godzinowy
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormIsDaily(true)}
                    className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
                      formIsDaily
                        ? 'bg-white shadow text-slate-800'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Dzienny
                  </button>
                </div>

                {/* Rate + Limited row */}
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <CheckboxField
                      label="Stawka"
                      checked={formHasRate}
                      onChange={setFormHasRate}
                      filled
                    />
                    {formHasRate && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Stawka</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formPayRate}
                            onChange={(e) => setFormPayRate(Number(e.target.value))}
                            min={0}
                            max={100}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <CheckboxField
                      label="Limitowany"
                      checked={formIsLimited}
                      onChange={setFormIsLimited}
                      filled
                    />
                    {formIsLimited && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Limit</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formLimitDays}
                            onChange={(e) => setFormLimitDays(Number(e.target.value))}
                            min={0}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                            {formIsDaily ? 'dni' : 'godz'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional options */}
                <div className="space-y-1">
                  <CheckboxField
                    label="Wliczaj święta w dni urlopowe"
                    checked={formCountHolidays}
                    onChange={setFormCountHolidays}
                  />
                  <CheckboxField
                    label="Wliczaj weekendy w dni urlopowe"
                    checked={formCountWeekends}
                    onChange={setFormCountWeekends}
                  />
                  <CheckboxField
                    label="Przenieś niewykorzystane dni na kolejny rok"
                    checked={formCarryOver}
                    onChange={setFormCarryOver}
                  />
                </div>
              </div>

              {/* Section: Wymagania administracyjne */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-indigo-500 uppercase tracking-wide">
                  Wymagania administracyjne
                </h4>
                <div className="space-y-1">
                  <CheckboxField
                    label="Wymagaj wnioskowania z wyprzedzeniem"
                    checked={formRequireAdvance}
                    onChange={setFormRequireAdvance}
                  />
                  <CheckboxField
                    label="Akceptuj automatycznie"
                    checked={formAutoApprove}
                    onChange={setFormAutoApprove}
                  />
                </div>
              </div>

              {/* Default comment */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                  Domyślny komentarz
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                      Użytkownik będzie mógł edytować ten komentarz podczas składania wniosku
                    </span>
                  </span>
                </label>
                <textarea
                  value={formDefaultComment}
                  onChange={(e) => setFormDefaultComment(e.target.value)}
                  rows={2}
                  placeholder="Domyślny komentarz..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100">
              <button
                onClick={handleSave}
                disabled={processing || !formName.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-3 rounded-lg text-sm font-semibold transition-colors"
              >
                {processing
                  ? 'Zapisywanie...'
                  : editingType
                    ? 'Zapisz zmiany'
                    : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

const CheckboxField: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  filled?: boolean;
}> = ({ label, checked, onChange, filled }) => (
  <label className="flex items-center gap-3 py-2 cursor-pointer group">
    <div
      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
        checked
          ? filled
            ? 'bg-indigo-600 border-indigo-600'
            : 'bg-indigo-600 border-indigo-600'
          : 'border-slate-300 bg-white group-hover:border-slate-400'
      }`}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
    >
      {checked && <Check className="w-3.5 h-3.5 text-white" />}
    </div>
    <span className="text-sm text-slate-700">{label}</span>
  </label>
);

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
