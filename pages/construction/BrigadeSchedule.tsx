import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, Calendar, ChevronLeft, ChevronRight, Filter,
  RefreshCw, UserPlus, Building2, Clock, Check, X,
  Loader2, AlertCircle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { User, Project, WorkerDay, Role } from '../../types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface DayCell {
  date: string; // YYYY-MM-DD
  status: 'on_project' | 'busy' | 'free' | 'unknown';
  projectId?: string;
  projectName?: string;
  minutes?: number;
}

interface ScheduleRow {
  user: User;
  cells: Record<string, DayCell>; // date → cell
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

const SHORT_DAY: Record<number, string> = { 0: 'Nd', 1: 'Pn', 2: 'Wt', 3: 'Śr', 4: 'Cz', 5: 'Pt', 6: 'Sb' };

const CELL_COLORS: Record<DayCell['status'], string> = {
  on_project: 'bg-green-500 text-white',
  busy: 'bg-red-400 text-white',
  free: 'bg-gray-100 text-gray-400',
  unknown: 'bg-gray-50 text-gray-300',
};

const LEGEND_COLORS: Record<DayCell['status'], string> = {
  on_project: 'bg-green-500',
  busy: 'bg-red-400',
  free: 'bg-gray-200',
  unknown: 'bg-gray-50 border border-gray-200',
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export const BrigadeSchedulePage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, users } = state;
  const companyId = currentUser?.company_id;

  // Date range: show 4 weeks from mondayStart
  const [mondayStart, setMondayStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [weeksToShow] = useState(4);

  // Filters
  const [filterBrigadir, setFilterBrigadir] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');

  // Data
  const [workerDaysMap, setWorkerDaysMap] = useState<Map<string, WorkerDay>>(new Map());
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assign modal
  const [assignModal, setAssignModal] = useState<{ user: User; date: string } | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // ── date range ──────────────────────────────
  const dates: string[] = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < weeksToShow * 7; i++) {
      arr.push(toISO(addDays(mondayStart, i)));
    }
    return arr;
  }, [mondayStart, weeksToShow]);

  const dateFrom = dates[0];
  const dateTo = dates[dates.length - 1];

  // ── employees list ──────────────────────────
  const employees = useMemo(() => {
    return (users ?? []).filter(u =>
      u.company_id === companyId &&
      [Role.EMPLOYEE, Role.BRIGADIR, Role.COORDINATOR].includes(u.role)
    );
  }, [users, companyId]);

  // brigadirs for filter
  const brigadirs = useMemo(() =>
    employees.filter(u => u.role === Role.BRIGADIR),
    [employees]
  );

  // ── fetch data ──────────────────────────────
  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [daysRes, projRes] = await Promise.all([
        supabase
          .from('worker_days')
          .select('id, user_id, date, status, work_time_minutes, total_time_minutes, entries:worker_day_entries(department_id, department:departments(name))')
          .eq('company_id', companyId)
          .gte('date', dateFrom)
          .lte('date', dateTo),
        supabase
          .from('projects')
          .select('id, name, color, status, department_id, department:departments(name)')
          .eq('company_id', companyId)
          .neq('status', 'archived')
          .order('name'),
      ]);

      if (daysRes.error) throw daysRes.error;
      if (projRes.error) throw projRes.error;

      const map = new Map<string, WorkerDay>();
      (daysRes.data as unknown as WorkerDay[] ?? []).forEach((d: WorkerDay) => {
        map.set(`${d.user_id}::${d.date}`, d);
      });
      setWorkerDaysMap(map);
      setProjects((projRes.data ?? []) as unknown as Project[]);
    } catch (e: any) {
      setError(e.message ?? 'Błąd ładowania danych');
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── build schedule rows ─────────────────────
  const rows: ScheduleRow[] = useMemo(() => {
    let filtered = employees;
    if (filterBrigadir !== 'all') {
      filtered = filtered.filter(u =>
        u.assigned_brigadir_id === filterBrigadir || u.id === filterBrigadir
      );
    }

    return filtered.map(user => {
      const cells: Record<string, DayCell> = {};
      dates.forEach(date => {
        const wd = workerDaysMap.get(`${user.id}::${date}`);
        if (!wd) {
          cells[date] = { date, status: 'unknown' };
        } else if (
          wd.status === 'present' ||
          wd.status === 'late' ||
          (wd.work_time_minutes ?? 0) > 0
        ) {
          // Check if tied to a project via department
          const firstEntry = (wd as any).entries?.[0];
          const deptName = firstEntry?.department?.name;
          const matchedProject = deptName
            ? projects.find(p => (p as any).department?.name === deptName)
            : undefined;

          cells[date] = {
            date,
            status: 'on_project',
            projectId: matchedProject?.id,
            projectName: matchedProject?.name ?? deptName,
            minutes: wd.work_time_minutes,
          };
        } else if (
          wd.status === 'absent' ||
          wd.status === 'day_off' ||
          wd.status === 'time_off' ||
          wd.status === 'holiday'
        ) {
          cells[date] = { date, status: 'busy' };
        } else {
          cells[date] = { date, status: 'free' };
        }
      });
      return { user, cells };
    });
  }, [employees, dates, workerDaysMap, projects, filterBrigadir]);

  // filter by project
  const filteredRows = useMemo(() => {
    if (filterProject === 'all') return rows;
    return rows.filter(row =>
      dates.some(d => row.cells[d]?.projectId === filterProject)
    );
  }, [rows, filterProject, dates]);

  // ── week groups for column headers ──────────
  const weekGroups: { weekLabel: string; days: string[] }[] = useMemo(() => {
    const groups: { weekLabel: string; days: string[] }[] = [];
    for (let w = 0; w < weeksToShow; w++) {
      const weekStart = addDays(mondayStart, w * 7);
      const days: string[] = [];
      for (let d = 0; d < 7; d++) {
        days.push(toISO(addDays(weekStart, d)));
      }
      const wn = getISOWeek(weekStart);
      groups.push({ weekLabel: `Tyg. ${wn}`, days });
    }
    return groups;
  }, [mondayStart, weeksToShow]);

  // ── free windows summary ────────────────────
  const freeWindowsCount = useMemo(() => {
    let count = 0;
    filteredRows.forEach(row => {
      dates.forEach(d => {
        if (row.cells[d]?.status === 'free') count++;
      });
    });
    return count;
  }, [filteredRows, dates]);

  // ── assign to project ───────────────────────
  const handleAssign = async () => {
    if (!assignModal || !assignProjectId) return;
    setAssigning(true);
    try {
      // Find the project's department
      const project = projects.find(p => p.id === assignProjectId);
      const deptId = project?.department_id;

      // Upsert worker_day
      const { data: wd, error: wdErr } = await supabase
        .from('worker_days')
        .upsert({
          company_id: companyId,
          user_id: assignModal.user.id,
          date: assignModal.date,
          status: 'present',
          confirmed: false,
          finished: false,
          total_time_minutes: 0,
          work_time_minutes: 0,
          break_time_minutes: 0,
          overtime_minutes: 0,
          is_business_day: true,
          is_holiday: false,
          is_weekend: false,
        }, { onConflict: 'company_id,user_id,date' })
        .select('id')
        .single();

      if (wdErr) throw wdErr;

      if (deptId && wd) {
        await supabase.from('worker_day_entries').insert({
          worker_day_id: wd.id,
          company_id: companyId,
          user_id: assignModal.user.id,
          start_time: new Date(`${assignModal.date}T07:00:00`).toISOString(),
          finished: false,
          department_id: deptId,
          is_remote: false,
        });
      }

      setAssignModal(null);
      setAssignProjectId('');
      await fetchData();
    } catch (e: any) {
      alert('Błąd: ' + e.message);
    } finally {
      setAssigning(false);
    }
  };

  const todayStr = toISO(new Date());

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            Graf. brygad
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Wizualna oś czasu — kto gdzie pracuje i kiedy jest wolny
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Odśwież
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-xl p-3">
        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMondayStart(d => addDays(d, -7))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-700 px-2">
            {mondayStart.toLocaleDateString('pl-PL', { month: 'long', day: 'numeric' })}
            {' – '}
            {addDays(mondayStart, weeksToShow * 7 - 1).toLocaleDateString('pl-PL', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            onClick={() => setMondayStart(d => addDays(d, 7))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="h-5 w-px bg-gray-200 hidden sm:block" />

        {/* Brigadir filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterBrigadir}
            onChange={e => setFilterBrigadir(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie brygady</option>
            {brigadirs.map(b => (
              <option key={b.id} value={b.id}>
                Brygada: {b.first_name} {b.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Project filter */}
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Wszystkie projekty</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="ml-auto text-xs text-gray-500 hidden sm:flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Wolnych okien: <strong>{freeWindowsCount}</strong>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        {(['on_project', 'busy', 'free', 'unknown'] as const).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded ${LEGEND_COLORS[s]}`} />
            {s === 'on_project' ? 'Na obiekcie' : s === 'busy' ? 'Zajęty/Urlop' : s === 'free' ? 'Wolny' : 'Brak danych'}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-max text-sm border-collapse">
          <thead>
            {/* Week row */}
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-left text-xs font-semibold text-gray-500 min-w-[160px] border-r border-gray-200">
                Pracownik
              </th>
              {weekGroups.map(wg => (
                <th
                  key={wg.weekLabel}
                  colSpan={7}
                  className="px-2 py-2 text-center text-xs font-semibold text-gray-500 border-r border-gray-100"
                >
                  {wg.weekLabel}
                </th>
              ))}
            </tr>
            {/* Day row */}
            <tr className="bg-white border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-white border-r border-gray-200" />
              {dates.map(date => {
                const d = new Date(date + 'T12:00:00');
                const isToday = date === todayStr;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th
                    key={date}
                    className={`px-1 py-1.5 text-center min-w-[40px] border-r border-gray-100 ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50' : ''}`}
                  >
                    <div className={`text-[10px] font-medium ${isToday ? 'text-blue-600' : isWeekend ? 'text-gray-400' : 'text-gray-500'}`}>
                      {SHORT_DAY[d.getDay()]}
                    </div>
                    <div className={`text-[11px] font-bold ${isToday ? 'text-blue-700' : isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                      {d.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={dates.length + 1} className="text-center py-12 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Ładowanie...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={dates.length + 1} className="text-center py-12 text-gray-400">
                  Brak pracowników
                </td>
              </tr>
            ) : (
              filteredRows.map((row, i) => (
                <tr key={row.user.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  {/* Employee name */}
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-r border-gray-200 min-w-[160px]">
                    <div className="font-medium text-gray-800 text-sm">
                      {row.user.first_name} {row.user.last_name}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {row.user.role}
                    </div>
                  </td>
                  {/* Day cells */}
                  {dates.map(date => {
                    const cell = row.cells[date];
                    const d = new Date(date + 'T12:00:00');
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = date === todayStr;
                    return (
                      <td
                        key={date}
                        className={`px-0.5 py-1 text-center border-r border-gray-100 ${isToday ? 'ring-1 ring-inset ring-blue-300' : ''} ${isWeekend ? 'opacity-50' : ''}`}
                      >
                        <div
                          className={`mx-auto w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-medium transition-all cursor-pointer hover:scale-105 ${
                            cell ? CELL_COLORS[cell.status] : 'bg-gray-50 text-gray-300'
                          } ${cell?.status === 'free' ? 'hover:bg-blue-100 hover:text-blue-600' : ''}`}
                          title={
                            cell?.status === 'on_project'
                              ? `${cell.projectName ?? 'Obiekt'} — ${Math.round((cell.minutes ?? 0) / 60)}h`
                              : cell?.status === 'busy'
                              ? 'Zajęty / Urlop'
                              : cell?.status === 'free'
                              ? 'Wolny — kliknij aby przypisać'
                              : 'Brak danych'
                          }
                          onClick={() => {
                            if (cell?.status === 'free' || cell?.status === 'unknown') {
                              setAssignModal({ user: row.user, date });
                              setAssignProjectId('');
                            }
                          }}
                        >
                          {cell?.status === 'on_project' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : cell?.status === 'busy' ? (
                            <X className="w-3.5 h-3.5" />
                          ) : cell?.status === 'free' ? (
                            <UserPlus className="w-3 h-3" />
                          ) : (
                            '–'
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Przypisz do projektu</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  <strong>{assignModal.user.first_name} {assignModal.user.last_name}</strong>
                  {' '}&mdash;{' '}
                  {new Date(assignModal.date + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button
                onClick={() => setAssignModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Projekt / Obiekt</label>
              <select
                value={assignProjectId}
                onChange={e => setAssignProjectId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— wybierz projekt —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Anuluj
              </button>
              <button
                onClick={handleAssign}
                disabled={!assignProjectId || assigning}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Przypisz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrigadeSchedulePage;

// ── ISO week number helper ────────────────────
function getISOWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}
