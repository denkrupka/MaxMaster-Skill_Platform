
import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock, CalendarRange, ChevronLeft, ChevronRight,
  List, Grid3X3, Clock
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { ScheduleTemplate, ScheduleAssignment } from '../../types';
import { SectionTabs } from '../../components/SectionTabs';

type ViewMode = 'weekly' | 'monthly';

const DAY_LABELS_WEEK = ['Pon.', 'Wt.', 'Śr.', 'Czw.', 'Pt.', 'Sob.', 'Niedz.'];
const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toISO = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

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

const formatTime = (t: string | undefined) => t?.slice(0, 5) || '';

const calcShiftHours = (start?: string, end?: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round(mins / 60 * 10) / 10;
};

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
      const { data: tplData } = await supabase
        .from('schedule_templates')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_archived', false);
      if (tplData) setTemplates(tplData);

      const { data: assignData } = await supabase
        .from('schedule_assignments')
        .select('*, template:schedule_templates(*)')
        .eq('company_id', currentCompany.id)
        .eq('user_id', currentUser.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);
      if (assignData) setAssignments(assignData);

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

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalHours = useMemo(() => {
    let total = 0;
    for (const a of assignments) {
      if (a.template) {
        total += calcShiftHours(a.template.start_time, a.template.end_time);
      } else if (a.custom_start_time && a.custom_end_time) {
        total += calcShiftHours(a.custom_start_time, a.custom_end_time);
      }
    }
    return total;
  }, [assignments]);

  const totalShifts = assignments.length;

  // ── Rendering helpers ──────────────────────────────────────────────────────

  const isToday = (d: Date) => toISO(d) === toISO(new Date());
  const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth();
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

  const periodLabel = useMemo(() => {
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate]);

  const getDayHours = (date: Date): number => {
    const a = getAssignmentForDate(date);
    if (!a) return 0;
    if (a.template) return calcShiftHours(a.template.start_time, a.template.end_time);
    return calcShiftHours(a.custom_start_time, a.custom_end_time);
  };

  const renderCellContent = (date: Date) => {
    const timeOff = getTimeOffForDate(date);
    if (timeOff) {
      return (
        <div
          className="rounded-md px-2 py-1.5 text-xs font-medium text-white truncate"
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
          className="rounded-md px-2 py-1.5 text-xs font-medium text-white truncate"
          style={{ backgroundColor: tpl.color || '#3b82f6' }}
          title={`${tpl.name}: ${formatTime(tpl.start_time)} - ${formatTime(tpl.end_time)}`}
        >
          <span className="font-semibold">{formatTime(tpl.start_time)} - {formatTime(tpl.end_time)}</span>
        </div>
      );
    }

    if (assignment.custom_start_time && assignment.custom_end_time) {
      return (
        <div
          className="rounded-md px-2 py-1.5 text-xs font-medium text-white bg-gray-600 truncate"
          title={`${formatTime(assignment.custom_start_time)} - ${formatTime(assignment.custom_end_time)}`}
        >
          <span className="font-semibold">{formatTime(assignment.custom_start_time)} - {formatTime(assignment.custom_end_time)}</span>
        </div>
      );
    }

    return null;
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!currentUser) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-4">
      <SectionTabs section="grafiki" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock className="w-7 h-7 text-blue-600" />
            Mój grafik
          </h1>
          <p className="text-gray-500 text-sm mt-1">Twój harmonogram pracy</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
            <Clock className="w-4 h-4 text-blue-600" />
            <div>
              <div className="text-xs text-blue-600 font-medium">Godziny</div>
              <div className="text-sm font-bold text-blue-700">{totalHours}h</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
            <CalendarRange className="w-4 h-4 text-green-600" />
            <div>
              <div className="text-xs text-green-600 font-medium">Zmiany</div>
              <div className="text-sm font-bold text-green-700">{totalShifts}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={goToToday}
              className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Dzisiaj
            </button>
            <button onClick={navigatePrev} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button onClick={navigateNext} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-lg font-bold text-gray-900">{periodLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('weekly')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'weekly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Widok tygodniowy"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'monthly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Widok miesięczny"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {/* Weekly view */}
        {!loading && viewMode === 'weekly' && (
          <>
            {/* Desktop grid */}
            <div className="hidden md:block">
              <div className="grid grid-cols-7 divide-x divide-gray-200 border-b border-gray-200">
                {weekDates.map((date, i) => {
                  const dayHours = getDayHours(date);
                  return (
                    <div
                      key={i}
                      className={`px-2 py-2 text-center ${
                        isToday(date) ? 'bg-gray-900 text-white' : isWeekend(date) ? 'bg-gray-50 text-gray-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1">
                          <span className="text-base font-bold">{date.getDate()}</span>
                          <span className="text-xs font-medium">{DAY_LABELS_WEEK[i]}</span>
                        </div>
                        <span className="text-xs font-normal opacity-70">{dayHours > 0 ? `${dayHours}h` : '0h'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 divide-x divide-gray-100 min-h-[140px]">
                {weekDates.map((date, i) => (
                  <div
                    key={i}
                    className={`p-2 ${
                      isToday(date) ? 'bg-blue-50/30' : isWeekend(date) ? 'bg-gray-50/50' : ''
                    }`}
                  >
                    {renderCellContent(date) || (
                      <div className="text-xs text-gray-300 text-center mt-4">—</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-gray-100">
              {weekDates.map((date, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 ${isToday(date) ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="text-center w-12 flex-shrink-0">
                    <div className="text-xs font-medium text-gray-500 uppercase">{DAY_LABELS_WEEK[i]}</div>
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
          </>
        )}

        {/* Monthly view */}
        {!loading && viewMode === 'monthly' && (
          <div>
            {/* Header row */}
            <div className="grid grid-cols-7 divide-x divide-gray-200 border-b border-gray-200">
              {DAY_LABELS_WEEK.map((day, i) => (
                <div
                  key={day}
                  className={`px-2 py-2 text-center text-sm font-semibold ${
                    i >= 5 ? 'text-red-500' : 'text-gray-700'
                  }`}
                >
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
                    } ${isWeekend(date) ? 'bg-blue-50/20' : ''} ${
                      isToday(date) ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''
                    }`}
                  >
                    <div
                      className={`text-sm font-bold mb-1 ${
                        !isCurrentMonth(date) ? 'text-gray-300' : isToday(date)
                          ? 'w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs'
                          : di >= 5 ? 'text-red-400' : 'text-gray-900'
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
      </div>

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
                  {tpl.name} ({formatTime(tpl.start_time)} - {formatTime(tpl.end_time)})
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
