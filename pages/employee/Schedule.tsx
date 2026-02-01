
import React, { useState, useEffect, useMemo } from 'react';
import { CalendarClock, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { ScheduleTemplate, ScheduleAssignment } from '../../types';

type ViewMode = 'weekly' | 'monthly';

const DAY_LABELS_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];
const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Return Monday of the week that contains `date`. */
const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Format Date to YYYY-MM-DD. */
const toISO = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** Get all dates in a given month grouped by weeks (Mon-Sun rows). */
const getMonthCalendarDates = (year: number, month: number): Date[][] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startMonday = getMonday(firstDay);
  const weeks: Date[][] = [];
  const cursor = new Date(startMonday);

  while (cursor <= lastDay || cursor.getDay() !== 1) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor > lastDay && cursor.getDay() === 1) break;
  }
  return weeks;
};

const formatTime = (t: string) => t?.slice(0, 5) || '';

// ── Component ────────────────────────────────────────────────────────────────

export const EmployeeSchedulePage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, currentCompany } = state;

  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [timeOffDates, setTimeOffDates] = useState<Record<string, { name: string; color: string }>>({});
  const [loading, setLoading] = useState(true);

  // Computed date ranges
  const weekMonday = useMemo(() => getMonday(currentDate), [currentDate]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekMonday]);

  const monthWeeks = useMemo(
    () => getMonthCalendarDates(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  // Compute date range for data fetching
  const dateRange = useMemo(() => {
    if (viewMode === 'weekly') {
      const end = new Date(weekMonday);
      end.setDate(end.getDate() + 6);
      return { start: toISO(weekMonday), end: toISO(end) };
    }
    const allDates = monthWeeks.flat();
    return { start: toISO(allDates[0]), end: toISO(allDates[allDates.length - 1]) };
  }, [viewMode, weekMonday, monthWeeks]);

  // ── Data loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || !currentCompany) return;
    loadData();
  }, [currentUser, currentCompany, dateRange]);

  const loadData = async () => {
    if (!currentUser || !currentCompany) return;
    setLoading(true);
    try {
      // Load templates
      const { data: tplData } = await supabase
        .from('schedule_templates')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_archived', false);
      if (tplData) setTemplates(tplData);

      // Load assignments
      const { data: assignData } = await supabase
        .from('schedule_assignments')
        .select('*, template:schedule_templates(*)')
        .eq('company_id', currentCompany.id)
        .eq('user_id', currentUser.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);
      if (assignData) setAssignments(assignData);

      // Load approved time-off requests overlapping the range
      const { data: timeOffData } = await supabase
        .from('time_off_requests')
        .select('*, time_off_type:time_off_types(*)')
        .eq('company_id', currentCompany.id)
        .eq('user_id', currentUser.id)
        .eq('status', 'approved')
        .lte('start_date', dateRange.end)
        .gte('end_date', dateRange.start);

      const map: Record<string, { name: string; color: string }> = {};
      if (timeOffData) {
        for (const req of timeOffData) {
          const start = new Date(req.start_date);
          const end = new Date(req.end_date);
          const cursor = new Date(start);
          while (cursor <= end) {
            const key = toISO(cursor);
            map[key] = {
              name: req.time_off_type?.name || 'Wolne',
              color: req.time_off_type?.color || '#9333ea',
            };
            cursor.setDate(cursor.getDate() + 1);
          }
        }
      }
      setTimeOffDates(map);
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'weekly') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'weekly') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  // ── Lookup helpers ─────────────────────────────────────────────────────────

  const assignmentMap = useMemo(() => {
    const m: Record<string, ScheduleAssignment> = {};
    for (const a of assignments) m[a.date] = a;
    return m;
  }, [assignments]);

  const getAssignmentForDate = (date: Date) => assignmentMap[toISO(date)] ?? null;
  const getTimeOffForDate = (date: Date) => timeOffDates[toISO(date)] ?? null;

  // ── Rendering helpers ──────────────────────────────────────────────────────

  const isToday = (d: Date) => toISO(d) === toISO(new Date());
  const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth();

  const renderPeriodLabel = () => {
    if (viewMode === 'weekly') {
      const endDate = new Date(weekMonday);
      endDate.setDate(endDate.getDate() + 6);
      const startStr = `${weekMonday.getDate()} ${MONTH_NAMES[weekMonday.getMonth()].slice(0, 3)}`;
      const endStr = `${endDate.getDate()} ${MONTH_NAMES[endDate.getMonth()].slice(0, 3)} ${endDate.getFullYear()}`;
      return `${startStr} – ${endStr}`;
    }
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const renderCellContent = (date: Date) => {
    const timeOff = getTimeOffForDate(date);
    if (timeOff) {
      return (
        <div
          className="rounded-lg px-2 py-1 text-xs font-medium text-white truncate"
          style={{ backgroundColor: timeOff.color }}
          title={timeOff.name}
        >
          {timeOff.name}
        </div>
      );
    }

    const assignment = getAssignmentForDate(date);
    if (!assignment) return null;

    const tpl = assignment.template;
    if (tpl) {
      return (
        <div
          className="rounded-lg px-2 py-1 text-xs font-medium text-white truncate"
          style={{ backgroundColor: tpl.color || '#3b82f6' }}
          title={`${tpl.name}: ${formatTime(tpl.start_time)} – ${formatTime(tpl.end_time)}`}
        >
          <span className="font-semibold">{tpl.name}</span>
          <br />
          <span className="opacity-90">{formatTime(tpl.start_time)} – {formatTime(tpl.end_time)}</span>
        </div>
      );
    }

    // Custom time (no template)
    if (assignment.custom_start_time && assignment.custom_end_time) {
      return (
        <div
          className="rounded-lg px-2 py-1 text-xs font-medium text-white bg-gray-600 truncate"
          title={`Własny czas: ${formatTime(assignment.custom_start_time)} – ${formatTime(assignment.custom_end_time)}`}
        >
          <span className="font-semibold">Własny czas</span>
          <br />
          <span className="opacity-90">{formatTime(assignment.custom_start_time)} – {formatTime(assignment.custom_end_time)}</span>
        </div>
      );
    }

    return null;
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!currentUser) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock className="w-7 h-7 text-blue-600" />
            Mój grafik
          </h1>
          <p className="text-gray-500 text-sm mt-1">Twój harmonogram pracy</p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('weekly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'weekly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            Tydzień
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            Miesiąc
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-3">
        <button
          onClick={navigatePrev}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Poprzedni okres"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900">{renderPeriodLabel()}</span>
          <button
            onClick={goToToday}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            Dziś
          </button>
        </div>

        <button
          onClick={navigateNext}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Następny okres"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Weekly view */}
      {!loading && viewMode === 'weekly' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Desktop grid */}
          <div className="hidden md:grid grid-cols-7 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
            {weekDates.map((date, i) => (
              <div
                key={i}
                className={`px-3 py-2 text-center ${isToday(date) ? 'bg-blue-50' : ''}`}
              >
                <div className="text-xs font-medium text-gray-500 uppercase">{DAY_LABELS_SHORT[i]}</div>
                <div className={`text-lg font-bold ${isToday(date) ? 'text-blue-700' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:grid grid-cols-7 divide-x divide-gray-100 min-h-[120px]">
            {weekDates.map((date, i) => (
              <div
                key={i}
                className={`p-2 ${isToday(date) ? 'bg-blue-50/30' : ''}`}
              >
                {renderCellContent(date)}
              </div>
            ))}
          </div>

          {/* Mobile list */}
          <div className="md:hidden divide-y divide-gray-100">
            {weekDates.map((date, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 ${isToday(date) ? 'bg-blue-50/50' : ''}`}
              >
                <div className="text-center w-12 flex-shrink-0">
                  <div className="text-xs font-medium text-gray-500 uppercase">{DAY_LABELS_SHORT[i]}</div>
                  <div className={`text-lg font-bold ${isToday(date) ? 'text-blue-700' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {renderCellContent(date) || (
                    <span className="text-xs text-gray-400 italic">Brak zmiany</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly view */}
      {!loading && viewMode === 'monthly' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-7 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
            {DAY_LABELS_SHORT.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                {day}
              </div>
            ))}
          </div>
          {/* Weeks */}
          {monthWeeks.map((week, wi) => (
            <div
              key={wi}
              className="grid grid-cols-7 divide-x divide-gray-100 border-b last:border-b-0 border-gray-100"
            >
              {week.map((date, di) => (
                <div
                  key={di}
                  className={`min-h-[80px] md:min-h-[100px] p-1.5 ${
                    !isCurrentMonth(date) ? 'bg-gray-50/60' : ''
                  } ${isToday(date) ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-200' : ''}`}
                >
                  <div
                    className={`text-xs mb-1 font-medium ${
                      !isCurrentMonth(date) ? 'text-gray-400' : isToday(date) ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  {renderCellContent(date)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Legenda</h3>
          <div className="flex flex-wrap gap-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tpl.color || '#3b82f6' }}
                />
                <span className="text-xs text-gray-600">
                  {tpl.name} ({formatTime(tpl.start_time)} – {formatTime(tpl.end_time)})
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-600" />
              <span className="text-xs text-gray-600">Własny czas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-purple-600" />
              <span className="text-xs text-gray-600">Nieobecność (zatwierdzona)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
