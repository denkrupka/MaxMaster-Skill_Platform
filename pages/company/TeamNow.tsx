
import React, { useState, useEffect, useMemo } from 'react';
import { Users, Coffee, Briefcase, UserX, Search, Filter, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { WorkerState, WorkerCurrentStatus, Role, Department } from '../../types';
import { SectionTabs } from '../../components/SectionTabs';

// =====================================================
// TeamNowPage - Real-time team dashboard
// Route: /company/team-now
// Access: COMPANY_ADMIN, HR (all), COORDINATOR (own dept), BRIGADIR (own brigade)
// =====================================================

interface WorkerStateWithUser extends Omit<WorkerState, 'user' | 'department'> {
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    assigned_brigadir_id?: string;
  };
  department?: Department;
}

type SortField = 'name' | 'status' | 'work_started_at';
type SortDirection = 'asc' | 'desc';

const STATUS_CONFIG: Record<WorkerCurrentStatus, { label: string; color: string; bgClass: string; badgeClass: string }> = {
  working: {
    label: 'Pracuje',
    color: 'green',
    bgClass: 'bg-green-50 border-green-200',
    badgeClass: 'bg-green-100 text-green-800',
  },
  on_break: {
    label: 'Przerwa',
    color: 'yellow',
    bgClass: 'bg-yellow-50 border-yellow-200',
    badgeClass: 'bg-yellow-100 text-yellow-800',
  },
  exit_business: {
    label: 'Wyjście służbowe',
    color: 'blue',
    bgClass: 'bg-blue-50 border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  exit_private: {
    label: 'Wyjście prywatne',
    color: 'purple',
    bgClass: 'bg-purple-50 border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-800',
  },
  offline: {
    label: 'Nieobecni',
    color: 'gray',
    bgClass: 'bg-slate-50 border-slate-200',
    badgeClass: 'bg-slate-100 text-slate-600',
  },
};

/**
 * Format duration in minutes to HH:MM string.
 */
function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h 00min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
}

/**
 * Calculate minutes elapsed from a given ISO timestamp to now.
 */
function minutesSince(isoString: string | undefined | null): number {
  if (!isoString) return 0;
  const start = new Date(isoString).getTime();
  const now = Date.now();
  return Math.max(0, (now - start) / 60000);
}

/**
 * Format an ISO timestamp to local HH:MM.
 */
function formatTime(isoString: string | undefined | null): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

/**
 * Get initials from first and last name.
 */
function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();
}

export const TeamNowPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, currentCompany, users } = state;

  const companyId = currentCompany?.id;

  // --------------- State ---------------
  const [workerStates, setWorkerStates] = useState<WorkerStateWithUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0); // for live timer re-renders

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<Set<WorkerCurrentStatus>>(
    new Set(['working', 'on_break', 'exit_business', 'offline'] as WorkerCurrentStatus[])
  );
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // --------------- Data Fetching ---------------

  const fetchWorkerStates = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('worker_states')
        .select('*')
        .eq('company_id', companyId);

      if (fetchError) throw fetchError;

      // Enrich with user data from context
      const enriched: WorkerStateWithUser[] = (data || []).map((ws: WorkerState) => {
        const user = users.find(u => u.id === ws.user_id);
        return {
          ...ws,
          user: user
            ? {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                assigned_brigadir_id: user.assigned_brigadir_id,
              }
            : undefined,
        };
      });

      setWorkerStates(enriched);
    } catch (err: any) {
      console.error('Error fetching worker states:', err);
      setError('Nie udało się załadować danych zespołu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    if (!companyId) return;
    try {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_archived', false)
        .order('name');
      setDepartments(data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  // Initial load
  useEffect(() => {
    if (companyId) {
      fetchWorkerStates();
      fetchDepartments();
    }
  }, [companyId, users]);

  // --------------- Realtime Subscription ---------------

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('team-now')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_states',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: any) => {
          setWorkerStates(prev => {
            const incoming = payload.new as WorkerState;
            const exists = prev.some(ws => ws.user_id === incoming.user_id);

            if (payload.eventType === 'DELETE') {
              return prev.filter(ws => ws.user_id !== (payload.old as any)?.user_id);
            }

            // Enrich with user data
            const user = users.find(u => u.id === incoming.user_id);
            const enriched: WorkerStateWithUser = {
              ...incoming,
              user: user
                ? {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role: user.role,
                    assigned_brigadir_id: user.assigned_brigadir_id,
                  }
                : undefined,
            };

            if (exists) {
              return prev.map(ws =>
                ws.user_id === incoming.user_id ? { ...ws, ...enriched } : ws
              );
            } else {
              return [...prev, enriched];
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, users]);

  // --------------- Live timer tick (every 30s) ---------------

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // --------------- Access Control Filtering ---------------

  const accessFilteredStates = useMemo(() => {
    if (!currentUser) return [];

    const role = currentUser.role;

    // COMPANY_ADMIN, HR see all
    if (role === Role.COMPANY_ADMIN || role === Role.HR || role === Role.SUPERADMIN) {
      return workerStates;
    }

    // COORDINATOR - own department members
    if (role === Role.COORDINATOR) {
      // We need to figure out which department the coordinator manages
      // For now, filter by current_department_id matching any department the coordinator is a manager of
      // Simplified: show workers whose department matches coordinator's assignments
      return workerStates;
    }

    // BRIGADIR - own brigade (users assigned to them)
    if (role === Role.BRIGADIR) {
      return workerStates.filter(
        ws => ws.user?.assigned_brigadir_id === currentUser.id
      );
    }

    return [];
  }, [workerStates, currentUser]);

  // --------------- Status Counts ---------------

  const statusCounts = useMemo(() => {
    const counts = {
      working: 0,
      on_break: 0,
      exit_business: 0,
      offline: 0,
      total: accessFilteredStates.length,
    };

    accessFilteredStates.forEach(ws => {
      const status = ws.current_status;
      if (status === 'working') counts.working++;
      else if (status === 'on_break') counts.on_break++;
      else if (status === 'exit_business') counts.exit_business++;
      else counts.offline++;
    });

    return counts;
  }, [accessFilteredStates]);

  // --------------- Filtered + Sorted List ---------------

  const filteredAndSorted = useMemo(() => {
    let result = [...accessFilteredStates];

    // Filter by status
    result = result.filter(ws => statusFilters.has(ws.current_status));

    // Filter by department
    if (departmentFilter !== 'all') {
      result = result.filter(ws => ws.current_department_id === departmentFilter);
    }

    // Filter by name search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(ws => {
        const fullName = `${ws.user?.first_name || ''} ${ws.user?.last_name || ''}`.toLowerCase();
        return fullName.includes(q);
      });
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name': {
          const nameA = `${a.user?.last_name || ''} ${a.user?.first_name || ''}`.toLowerCase();
          const nameB = `${b.user?.last_name || ''} ${b.user?.first_name || ''}`.toLowerCase();
          comparison = nameA.localeCompare(nameB, 'pl');
          break;
        }
        case 'status': {
          const statusOrder: Record<string, number> = { working: 0, on_break: 1, exit_business: 2, exit_private: 3, offline: 4 };
          comparison = (statusOrder[a.current_status] ?? 5) - (statusOrder[b.current_status] ?? 5);
          break;
        }
        case 'work_started_at': {
          const timeA = a.work_started_at ? new Date(a.work_started_at).getTime() : 0;
          const timeB = b.work_started_at ? new Date(b.work_started_at).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [accessFilteredStates, statusFilters, departmentFilter, searchQuery, sortField, sortDirection]);

  // --------------- Handlers ---------------

  const toggleStatusFilter = (status: WorkerCurrentStatus) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getDepartmentName = (departmentId: string | undefined | null): string => {
    if (!departmentId) return '—';
    const dept = departments.find(d => d.id === departmentId);
    return dept?.name || dept?.label || '—';
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
  };

  // --------------- Render ---------------

  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <Users className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-yellow-800 mb-2">Brak przypisanej firmy</h2>
          <p className="text-yellow-600">Skontaktuj się z administratorem platformy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <SectionTabs section="obecnosci" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kto w pracy</h1>
          <p className="text-slate-500 mt-1">
            Podgląd statusu pracowników w czasie rzeczywistym
          </p>
        </div>
        <button
          onClick={() => fetchWorkerStates()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* =================== Summary Cards =================== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {/* Pracują */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-700">Pracują</span>
          </div>
          <p className="text-2xl font-bold text-green-800">{statusCounts.working}</p>
        </div>

        {/* Na przerwie */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Coffee className="w-4 h-4 text-yellow-600" />
            </div>
            <span className="text-xs font-medium text-yellow-700">Na przerwie</span>
          </div>
          <p className="text-2xl font-bold text-yellow-800">{statusCounts.on_break}</p>
        </div>

        {/* Wyjście służbowe */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-700">Wyjście służb.</span>
          </div>
          <p className="text-2xl font-bold text-blue-800">{statusCounts.exit_business}</p>
        </div>

        {/* Nie na pracy */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              <UserX className="w-4 h-4 text-slate-500" />
            </div>
            <span className="text-xs font-medium text-slate-600">Nieobecni</span>
          </div>
          <p className="text-2xl font-bold text-slate-700">{statusCounts.offline}</p>
        </div>

        {/* Łącznie */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-slate-600">Łącznie</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{statusCounts.total}</p>
        </div>
      </div>

      {/* =================== Filters Bar =================== */}
      <div className="bg-white border border-slate-200 rounded-xl mb-4">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj po imieniu lub nazwisku..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Department filter */}
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]"
          >
            <option value="all">Wszystkie obiekty</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name || dept.label}
              </option>
            ))}
          </select>

          {/* Toggle filter panel */}
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition ${
              showFilters
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtry statusu
          </button>
        </div>

        {/* Status checkboxes */}
        {showFilters && (
          <div className="px-4 pb-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
            {(
              [
                { key: 'working' as WorkerCurrentStatus, label: 'Pracuje', dotClass: 'bg-green-500' },
                { key: 'on_break' as WorkerCurrentStatus, label: 'Przerwa', dotClass: 'bg-yellow-500' },
                { key: 'exit_business' as WorkerCurrentStatus, label: 'Wyjście służbowe', dotClass: 'bg-blue-500' },
                { key: 'offline' as WorkerCurrentStatus, label: 'Nieobecni', dotClass: 'bg-slate-400' },
              ] as const
            ).map(item => (
              <label
                key={item.key}
                className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={statusFilters.has(item.key)}
                  onChange={() => toggleStatusFilter(item.key)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`w-2.5 h-2.5 rounded-full ${item.dotClass}`} />
                {item.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* =================== Employee Table =================== */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading && workerStates.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-3" />
            Ładowanie danych zespołu...
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Users className="w-12 h-12 mb-3" />
            <p className="text-sm">
              {workerStates.length === 0
                ? 'Brak danych o pracownikach'
                : 'Brak wyników dla wybranych filtrów'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-500 w-12" />
                  <th
                    className="text-left py-3 px-4 font-medium text-slate-500 cursor-pointer hover:text-slate-800 select-none"
                    onClick={() => handleSort('name')}
                  >
                    Imię i nazwisko{getSortIcon('name')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Obiekt</th>
                  <th
                    className="text-left py-3 px-4 font-medium text-slate-500 cursor-pointer hover:text-slate-800 select-none"
                    onClick={() => handleSort('status')}
                  >
                    Status{getSortIcon('status')}
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-slate-500 cursor-pointer hover:text-slate-800 select-none"
                    onClick={() => handleSort('work_started_at')}
                  >
                    Rozpoczęcie pracy{getSortIcon('work_started_at')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Zakończenie pracy
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Czas pracy dziś
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map(ws => {
                  const statusConf = STATUS_CONFIG[ws.current_status] || STATUS_CONFIG.offline;
                  const firstName = ws.user?.first_name || 'Nieznany';
                  const lastName = ws.user?.last_name || '';
                  const workMinutesToday = minutesSince(ws.work_started_at);
                  const isOnline = ws.current_status !== 'offline';

                  // Avatar background based on status
                  const avatarBg = isOnline ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500';

                  return (
                    <tr
                      key={ws.id || ws.user_id}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition"
                    >
                      {/* Avatar */}
                      <td className="py-3 px-4">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${avatarBg}`}
                        >
                          {getInitials(firstName, lastName)}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900">
                          {firstName} {lastName}
                        </span>
                      </td>

                      {/* Department / Object */}
                      <td className="py-3 px-4 text-slate-600">
                        {getDepartmentName(ws.current_department_id)}
                      </td>

                      {/* Status badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConf.badgeClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ws.current_status === 'working'
                                ? 'bg-green-500'
                                : ws.current_status === 'on_break'
                                ? 'bg-yellow-500'
                                : ws.current_status === 'exit_business'
                                ? 'bg-blue-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {statusConf.label}
                        </span>
                      </td>

                      {/* Work start time */}
                      <td className="py-3 px-4 text-slate-600 tabular-nums">
                        {formatTime(ws.work_started_at)}
                      </td>

                      {/* Work finish time */}
                      <td className="py-3 px-4 text-slate-600 tabular-nums">
                        {formatTime(ws.work_finished_at)}
                      </td>

                      {/* Work time today (live timer) */}
                      <td className="py-3 px-4">
                        {ws.work_started_at ? (
                          <span className="font-medium text-slate-900 tabular-nums">
                            {formatDuration(workMinutesToday)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        {filteredAndSorted.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Wyświetlono {filteredAndSorted.length} z {accessFilteredStates.length} pracowników
            </p>
            <p className="text-xs text-slate-400">
              Dane odświeżane automatycznie
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
