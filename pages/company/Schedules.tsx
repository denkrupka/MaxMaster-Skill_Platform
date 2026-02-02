
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarClock, CalendarRange, Plus, Edit, Trash2, Copy,
  ChevronLeft, ChevronRight, Filter, Search, Palette, X, Check, Archive, RotateCcw,
  HelpCircle, Download, Send, Sparkles, Grid3X3, List, ChevronDown, Users, Clock
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { ScheduleTemplate, ScheduleAssignment, User, Role, Department } from '../../types';
import { SectionTabs } from '../../components/SectionTabs';

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS_SHORT = ['Niedz.', 'Pon.', 'Wt.', 'Śr.', 'Czw.', 'Pt.', 'Sob.'];
const DAY_LABELS_WEEK = ['Pon.', 'Wt.', 'Śr.', 'Czw.', 'Pt.', 'Sob.', 'Niedz.'];

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48',
];

const SHIFT_PRESETS = [
  { label: '07:00 - 17:00', start: '07:00', end: '17:00' },
  { label: '08:00 - 16:00', start: '08:00', end: '16:00' },
  { label: '06:00 - 14:00', start: '06:00', end: '14:00' },
  { label: '14:00 - 22:00', start: '14:00', end: '22:00' },
  { label: '22:00 - 06:00', start: '22:00', end: '06:00' },
];

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

type ViewMode = 'weekly' | 'monthly';
type ActiveTab = 'schedule' | 'templates';

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

const formatTime = (t: string | undefined) => t?.slice(0, 5) || '';

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

const getMonthDateRange = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startMonday = getMonday(firstDay);
  const allWeeks = getMonthCalendarDates(year, month);
  const allDates = allWeeks.flat();
  return {
    start: toISO(allDates[0]),
    end: toISO(allDates[allDates.length - 1]),
  };
};

const calcShiftHours = (start?: string, end?: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round(mins / 60 * 10) / 10;
};

// ── Component ────────────────────────────────────────────────────────────────

export const CompanySchedulesPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, currentCompany } = state;

  const [activeTab, setActiveTab] = useState<ActiveTab>('schedule');

  if (!currentUser || !currentCompany) return null;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">
      <SectionTabs section="grafiki" />

      {/* Tabs: Schedule vs Templates */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'schedule' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          Grafik
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'templates' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Palette className="w-4 h-4" />
          Szablony zmian
        </button>
      </div>

      {activeTab === 'schedule' && <ScheduleView companyId={currentCompany.id} />}
      {activeTab === 'templates' && <ShiftTemplates companyId={currentCompany.id} />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ScheduleView – Main schedule view with weekly/monthly modes
// ═══════════════════════════════════════════════════════════════════════════════

const ScheduleView: React.FC<{ companyId: string }> = ({ companyId }) => {
  const { state } = useAppContext();

  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentMembers, setDepartmentMembers] = useState<{ user_id: string; department_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Add shift modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalData, setAddModalData] = useState({
    date: toISO(new Date()),
    startTime: '08:00',
    endTime: '16:00',
    name: '',
    color: '#6b7280',
    userId: '',
    departmentId: '',
    templateId: '',
    allowEarlyStart: true,
    allowOvertime: true,
  });

  // Copy month modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyingMonth, setCopyingMonth] = useState(false);

  // Demand mode
  const [demandMode, setDemandMode] = useState(false);

  // ── Computed dates ────────────────────────────────────────────────────────

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
    return getMonthDateRange(currentDate.getFullYear(), currentDate.getMonth());
  }, [viewMode, weekMonday, currentDate]);

  // ── Employees ─────────────────────────────────────────────────────────────

  const employees = useMemo(() => {
    return state.users.filter(
      (u) =>
        u.company_id === companyId &&
        [Role.EMPLOYEE, Role.BRIGADIR, Role.COORDINATOR, Role.HR, Role.COMPANY_ADMIN].includes(u.role) &&
        u.status === 'active'
    );
  }, [state.users, companyId]);

  // Group employees by department
  const employeesByDepartment = useMemo(() => {
    const groups: { department: Department | null; employees: User[] }[] = [];
    const memberMap = new Map<string, string[]>();

    for (const dm of departmentMembers) {
      if (!memberMap.has(dm.department_id)) memberMap.set(dm.department_id, []);
      memberMap.get(dm.department_id)!.push(dm.user_id);
    }

    const assignedUserIds = new Set<string>();

    // Filter departments
    const deptList = departmentFilter === 'all'
      ? departments
      : departments.filter(d => d.id === departmentFilter);

    for (const dept of deptList) {
      const memberIds = new Set(memberMap.get(dept.id) || []);
      let deptEmployees = employees.filter(e => memberIds.has(e.id));

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        deptEmployees = deptEmployees.filter(
          e => e.first_name.toLowerCase().includes(q) || e.last_name.toLowerCase().includes(q)
        );
      }

      deptEmployees.sort((a, b) =>
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      );

      if (deptEmployees.length > 0) {
        groups.push({ department: dept, employees: deptEmployees });
        deptEmployees.forEach(e => assignedUserIds.add(e.id));
      }
    }

    // Unassigned employees
    if (departmentFilter === 'all') {
      let unassigned = employees.filter(e => !assignedUserIds.has(e.id));
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        unassigned = unassigned.filter(
          e => e.first_name.toLowerCase().includes(q) || e.last_name.toLowerCase().includes(q)
        );
      }
      if (unassigned.length > 0) {
        groups.push({ department: null, employees: unassigned });
      }
    }

    return groups;
  }, [employees, departments, departmentMembers, departmentFilter, searchTerm]);

  const totalEmployees = useMemo(
    () => employeesByDepartment.reduce((sum, g) => sum + g.employees.length, 0),
    [employeesByDepartment]
  );

  // Assignment lookup
  const assignmentMap = useMemo(() => {
    const m: Record<string, ScheduleAssignment> = {};
    for (const a of assignments) {
      m[`${a.user_id}_${a.date}`] = a;
    }
    return m;
  }, [assignments]);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, assignRes, deptRes, dmRes] = await Promise.all([
        supabase.from('schedule_templates').select('*').eq('company_id', companyId).eq('is_archived', false),
        supabase
          .from('schedule_assignments')
          .select('*, template:schedule_templates(*)')
          .eq('company_id', companyId)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end),
        supabase.from('departments').select('*').eq('company_id', companyId).eq('is_archived', false),
        supabase.from('department_members').select('user_id, department_id').eq('company_id', companyId),
      ]);

      if (tplRes.data) setTemplates(tplRes.data);
      if (assignRes.data) setAssignments(assignRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (dmRes.data) setDepartmentMembers(dmRes.data);
    } catch (err) {
      console.error('Error loading schedule data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Navigation ────────────────────────────────────────────────────────────

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

  const periodLabel = useMemo(() => {
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate]);

  const isToday = (d: Date) => toISO(d) === toISO(new Date());
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth();

  // ── Shift actions ─────────────────────────────────────────────────────────

  const handleDeleteAssignment = async (assignmentId: string) => {
    setSaving(true);
    try {
      await supabase.from('schedule_assignments').delete().eq('id', assignmentId);
      await loadData();
    } catch (err) {
      console.error('Error deleting assignment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddShift = async () => {
    if (!addModalData.userId || !addModalData.date) return;
    setSaving(true);
    try {
      const existing = assignmentMap[`${addModalData.userId}_${addModalData.date}`];
      const payload: any = {
        company_id: companyId,
        user_id: addModalData.userId,
        date: addModalData.date,
        department_id: addModalData.departmentId || null,
      };

      if (addModalData.templateId) {
        payload.template_id = addModalData.templateId;
        payload.custom_start_time = null;
        payload.custom_end_time = null;
      } else {
        payload.template_id = null;
        payload.custom_start_time = addModalData.startTime;
        payload.custom_end_time = addModalData.endTime;
      }

      if (existing) {
        await supabase.from('schedule_assignments').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('schedule_assignments').insert(payload);
      }

      setShowAddModal(false);
      await loadData();
    } catch (err) {
      console.error('Error adding shift:', err);
    } finally {
      setSaving(false);
    }
  };

  // Quick assign from cell click
  const handleCellClick = (userId: string, date: string) => {
    setAddModalData({
      date,
      startTime: '08:00',
      endTime: '16:00',
      name: '',
      color: '#6b7280',
      userId,
      departmentId: '',
      templateId: '',
      allowEarlyStart: true,
      allowOvertime: true,
    });
    setShowAddModal(true);
  };

  // ── Copy month ────────────────────────────────────────────────────────────

  const handleCopyMonth = async () => {
    setCopyingMonth(true);
    try {
      // Get current month's assignments
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = toISO(new Date(year, month, 1));
      const lastDay = toISO(new Date(year, month + 1, 0));

      const { data: currentMonthAssignments } = await supabase
        .from('schedule_assignments')
        .select('*')
        .eq('company_id', companyId)
        .gte('date', firstDay)
        .lte('date', lastDay);

      if (!currentMonthAssignments || currentMonthAssignments.length === 0) {
        alert('Brak zmian do skopiowania w bieżącym miesiącu.');
        setCopyingMonth(false);
        setShowCopyModal(false);
        return;
      }

      // Calculate next month
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const nextFirstDay = toISO(new Date(nextYear, nextMonth, 1));
      const nextLastDay = toISO(new Date(nextYear, nextMonth + 1, 0));

      // Delete existing assignments in next month
      await supabase
        .from('schedule_assignments')
        .delete()
        .eq('company_id', companyId)
        .gte('date', nextFirstDay)
        .lte('date', nextLastDay);

      // Copy assignments shifting by one month
      const newAssignments = currentMonthAssignments.map(a => {
        const origDate = new Date(a.date);
        const dayOfMonth = origDate.getDate();
        const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        const newDay = Math.min(dayOfMonth, daysInNextMonth);
        const newDate = new Date(nextYear, nextMonth, newDay);

        return {
          company_id: companyId,
          user_id: a.user_id,
          template_id: a.template_id || null,
          date: toISO(newDate),
          custom_start_time: a.custom_start_time || null,
          custom_end_time: a.custom_end_time || null,
          department_id: a.department_id || null,
          note: a.note || null,
        };
      });

      // Insert in batches
      for (let i = 0; i < newAssignments.length; i += 500) {
        await supabase.from('schedule_assignments').insert(newAssignments.slice(i, i + 500));
      }

      setShowCopyModal(false);
      alert('Grafik został skopiowany na następny miesiąc.');
    } catch (err) {
      console.error('Error copying month:', err);
      alert('Błąd podczas kopiowania grafiku.');
    } finally {
      setCopyingMonth(false);
    }
  };

  // ── Publish toggle ────────────────────────────────────────────────────────

  const togglePublish = () => {
    setPublished(!published);
  };

  // ── Calc day hours ────────────────────────────────────────────────────────

  const getDayHours = (date: Date): number => {
    const dateStr = toISO(date);
    let total = 0;
    for (const a of assignments) {
      if (a.date === dateStr) {
        if (a.template) {
          total += calcShiftHours(a.template.start_time, a.template.end_time);
        } else if (a.custom_start_time && a.custom_end_time) {
          total += calcShiftHours(a.custom_start_time, a.custom_end_time);
        }
      }
    }
    return total;
  };

  const getEmployeeTotalHours = (userId: string): number => {
    let total = 0;
    for (const a of assignments) {
      if (a.user_id === userId) {
        if (a.template) {
          total += calcShiftHours(a.template.start_time, a.template.end_time);
        } else if (a.custom_start_time && a.custom_end_time) {
          total += calcShiftHours(a.custom_start_time, a.custom_end_time);
        }
      }
    }
    return total;
  };

  const getDayShiftCount = (date: Date): number => {
    const dateStr = toISO(date);
    return assignments.filter(a => a.date === dateStr).length;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">
      {/* Demand mode banner */}
      {demandMode && (
        <div className="bg-gray-800 text-white px-4 py-2 rounded-t-xl flex items-center justify-between">
          <span className="text-sm font-medium">Jesteś w trybie określania zapotrzebowania</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDemandMode(false)}
              className="text-sm px-3 py-1 rounded-md hover:bg-gray-700 transition-colors"
            >
              Anuluj
            </button>
            <button
              onClick={() => setDemandMode(false)}
              className="text-sm px-3 py-1 bg-white text-gray-900 rounded-md font-medium hover:bg-gray-100 transition-colors"
            >
              Zapisz
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className={`bg-white border border-gray-200 ${demandMode ? 'rounded-b-xl' : 'rounded-xl'} overflow-hidden`}>
        {/* Header row 1: Department filter, Help, Export, Publish */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-sm font-medium text-gray-700 bg-transparent border-0 focus:ring-0 cursor-pointer pr-6 appearance-none"
            >
              <option value="all">{departments.length} oddziałów</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              <HelpCircle className="w-4 h-4" />
              Pomoc
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              Eksportuj
            </button>
            <button
              onClick={togglePublish}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                published
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Send className="w-4 h-4" />
              {published ? 'Opublikowany' : 'Publikuj'}
            </button>
          </div>
        </div>

        {/* Header row 2: Navigation, period, view toggle, actions */}
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
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              published
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {published ? 'Opublikowany' : 'Nieopublikowany'}
            </span>
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

            {/* Copy */}
            <button
              onClick={() => setShowCopyModal(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="Skopiuj grafik na następny miesiąc"
            >
              <Copy className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-200" />

            {/* Autoplanowanie */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Autoplanowanie
            </button>

            {/* Add shift */}
            <button
              onClick={() => {
                setAddModalData({
                  date: toISO(new Date()),
                  startTime: '08:00',
                  endTime: '16:00',
                  name: '',
                  color: '#6b7280',
                  userId: employees.length > 0 ? employees[0].id : '',
                  departmentId: '',
                  templateId: '',
                  allowEarlyStart: true,
                  allowOvertime: true,
                });
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Zmianę
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {/* Weekly View */}
        {!loading && viewMode === 'weekly' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-56 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <span>{totalEmployees} pracownik{totalEmployees === 1 ? '' : totalEmployees < 5 ? 'ów' : 'ów'}</span>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Filtruj"
                      >
                        <Filter className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>
                    {showFilters && (
                      <div className="mt-1">
                        <input
                          type="text"
                          placeholder="Szukaj..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </th>
                  {weekDates.map((date, i) => {
                    const dayHours = getDayHours(date);
                    return (
                      <th
                        key={i}
                        className={`px-2 py-2 text-center min-w-[120px] ${
                          isToday(date) ? 'bg-gray-900 text-white' : isWeekend(date) ? 'bg-gray-50 text-gray-500' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-1">
                            <span className={`text-base font-bold ${isToday(date) ? '' : ''}`}>
                              {date.getDate()}
                            </span>
                            <span className="text-xs font-medium">
                              {DAY_LABELS_WEEK[i]}
                            </span>
                          </div>
                          <span className="text-xs font-normal opacity-70">{dayHours}h</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employeesByDepartment.map((group, gi) => (
                  <React.Fragment key={gi}>
                    {/* Department header */}
                    <tr className="bg-gray-50 border-t border-b border-gray-200">
                      <td
                        colSpan={8}
                        className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10"
                      >
                        {group.department?.name || 'BEZ DZIAŁU'} ({group.employees.length})
                      </td>
                    </tr>

                    {/* Demand row */}
                    {!demandMode && (
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-1.5 text-xs text-gray-500 sticky left-0 bg-white z-10">
                          <div className="flex items-center gap-1.5">
                            <span>Zapotrzebowanie</span>
                            <button
                              onClick={() => setDemandMode(true)}
                              className="p-0.5 rounded hover:bg-gray-100"
                              title="Edytuj zapotrzebowanie"
                            >
                              <Edit className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        </td>
                        {weekDates.map((date, di) => {
                          const shiftCount = getDayShiftCount(date);
                          return (
                            <td key={di} className={`px-2 py-1.5 text-center text-xs ${isWeekend(date) ? 'bg-gray-50' : ''}`}>
                              <div className="flex items-center justify-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${shiftCount > 0 ? 'bg-green-500' : 'bg-green-500'}`} />
                                <span className="text-gray-500">{shiftCount} zmian</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}

                    {/* Employee rows */}
                    {group.employees.map(emp => {
                      const totalHours = getEmployeeTotalHours(emp.id);
                      const isCurrentUser = emp.id === state.currentUser?.id;
                      return (
                        <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/30">
                          <td className="px-3 py-2 sticky left-0 bg-white z-10">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-white overflow-hidden flex-shrink-0">
                                {emp.first_name?.[0]}{emp.last_name?.[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {emp.first_name} {emp.last_name}
                                  </span>
                                  {emp.role === Role.COMPANY_ADMIN && (
                                    <span className="text-xs font-bold text-amber-600">A</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-gray-500 truncate">
                                    {emp.target_position || emp.role}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isCurrentUser && (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 rounded px-1">Ty</span>
                                  )}
                                  <span className="text-xs text-gray-400">{totalHours}h</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          {weekDates.map((date, di) => {
                            const dateStr = toISO(date);
                            const assignment = assignmentMap[`${emp.id}_${dateStr}`];
                            return (
                              <td
                                key={di}
                                className={`px-1 py-1 relative group ${
                                  isWeekend(date) ? 'bg-gray-50' : ''
                                }`}
                              >
                                {assignment ? (
                                  <div className="relative group/shift">
                                    {assignment.template ? (
                                      <div
                                        className="rounded-md px-2 py-1.5 text-xs font-medium text-white cursor-pointer"
                                        style={{ backgroundColor: assignment.template.color || '#6b7280' }}
                                        title={`${assignment.template.name}: ${formatTime(assignment.template.start_time)} - ${formatTime(assignment.template.end_time)}`}
                                      >
                                        <div className="font-semibold truncate">{formatTime(assignment.template.start_time)} - {formatTime(assignment.template.end_time)}</div>
                                      </div>
                                    ) : assignment.custom_start_time && assignment.custom_end_time ? (
                                      <div
                                        className="rounded-md px-2 py-1.5 text-xs font-medium text-white bg-gray-600 cursor-pointer"
                                        title={`${formatTime(assignment.custom_start_time)} - ${formatTime(assignment.custom_end_time)}`}
                                      >
                                        <div className="font-semibold truncate">{formatTime(assignment.custom_start_time)} - {formatTime(assignment.custom_end_time)}</div>
                                      </div>
                                    ) : null}
                                    {/* Delete button on hover */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAssignment(assignment.id);
                                      }}
                                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover/shift:flex items-center justify-center hover:bg-red-600"
                                      title="Usuń zmianę"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                    {/* Draft label */}
                                    {!published && (
                                      <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-gray-200 text-gray-600 px-1 rounded group-hover/shift:hidden">
                                        Draft
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleCellClick(emp.id, dateStr)}
                                    className="w-full min-h-[40px] rounded-md border border-transparent hover:border-gray-300 hover:bg-gray-100/50 transition-colors cursor-pointer"
                                    disabled={saving}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}

                {totalEmployees === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                      Brak pracowników do wyświetlenia
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Monthly View */}
        {!loading && viewMode === 'monthly' && (
          <div>
            {/* Employee avatars */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
              <span className="text-xs text-gray-500">{totalEmployees} pracownik{totalEmployees !== 1 ? 'ów' : ''}</span>
              <div className="flex -space-x-1">
                {employees.slice(0, 10).map(emp => (
                  <div
                    key={emp.id}
                    className="w-7 h-7 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-[10px] font-medium text-white"
                    title={`${emp.first_name} ${emp.last_name}`}
                  >
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </div>
                ))}
                {employees.length > 10 && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-medium text-gray-600">
                    +{employees.length - 10}
                  </div>
                )}
              </div>
              <div className="ml-auto">
                <button className="p-1 rounded hover:bg-gray-100" title="Filtruj">
                  <Filter className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Calendar header */}
            <div className="grid grid-cols-7 border-b border-gray-200">
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

            {/* Calendar weeks */}
            {monthWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-100">
                {week.map((date, di) => {
                  const dateStr = toISO(date);
                  const dayAssignments = assignments.filter(a => a.date === dateStr);
                  const isCurrent = isCurrentMonth(date);
                  return (
                    <div
                      key={di}
                      className={`min-h-[100px] p-1.5 border-r border-gray-100 last:border-r-0 ${
                        !isCurrent ? 'bg-gray-50/60' : ''
                      } ${isWeekend(date) ? 'bg-blue-50/20' : ''} ${
                        isToday(date) ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''
                      }`}
                    >
                      <div className={`text-sm font-bold mb-1 ${
                        !isCurrent ? 'text-gray-300' : isToday(date)
                          ? 'w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs'
                          : di >= 5 ? 'text-red-400' : 'text-gray-900'
                      }`}>
                        {date.getDate()}
                      </div>
                      {dayAssignments.slice(0, 3).map(a => (
                        <div
                          key={a.id}
                          className="rounded px-1 py-0.5 text-[10px] font-medium text-white truncate mb-0.5 cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: a.template?.color || '#6b7280' }}
                          title={`${state.users.find(u => u.id === a.user_id)?.first_name || ''}: ${
                            a.template
                              ? `${formatTime(a.template.start_time)}-${formatTime(a.template.end_time)}`
                              : `${formatTime(a.custom_start_time)}-${formatTime(a.custom_end_time)}`
                          }`}
                        >
                          {a.template
                            ? `${formatTime(a.template.start_time)}-${formatTime(a.template.end_time)}`
                            : `${formatTime(a.custom_start_time)}-${formatTime(a.custom_end_time)}`
                          }
                        </div>
                      ))}
                      {dayAssignments.length > 3 && (
                        <div className="text-[10px] text-gray-500 text-center">
                          +{dayAssignments.length - 3} więcej
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Shift Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-20" onClick={() => setShowAddModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Dodaj zmianę</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Shift presets */}
              <div className="flex flex-wrap gap-2">
                {SHIFT_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => setAddModalData(p => ({
                      ...p,
                      startTime: preset.start,
                      endTime: preset.end,
                      templateId: '',
                    }))}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      addModalData.startTime === preset.start && addModalData.endTime === preset.end && !addModalData.templateId
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Template selection */}
              {templates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lub wybierz szablon</label>
                  <select
                    value={addModalData.templateId}
                    onChange={e => {
                      const tpl = templates.find(t => t.id === e.target.value);
                      setAddModalData(p => ({
                        ...p,
                        templateId: e.target.value,
                        startTime: tpl ? formatTime(tpl.start_time) : p.startTime,
                        endTime: tpl ? formatTime(tpl.end_time) : p.endTime,
                      }));
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Własny czas</option>
                    {templates.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({formatTime(tpl.start_time)} - {formatTime(tpl.end_time)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Nazwa (Opcjonalnie)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="np. Kasjer"
                    value={addModalData.name}
                    onChange={e => setAddModalData(p => ({ ...p, name: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="relative">
                    <input
                      type="color"
                      value={addModalData.color}
                      onChange={e => setAddModalData(p => ({ ...p, color: e.target.value }))}
                      className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div>
                <div className="flex items-center gap-4 mb-1">
                  <label className="text-sm font-medium text-gray-700 w-12">Data</label>
                  <label className="text-sm font-medium text-gray-700">Start</label>
                  <label className="text-sm font-medium text-gray-700">Koniec</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={addModalData.date}
                    onChange={e => setAddModalData(p => ({ ...p, date: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="time"
                    value={addModalData.startTime}
                    onChange={e => setAddModalData(p => ({ ...p, startTime: e.target.value, templateId: '' }))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="time"
                    value={addModalData.endTime}
                    onChange={e => setAddModalData(p => ({ ...p, endTime: e.target.value, templateId: '' }))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addModalData.allowEarlyStart}
                    onChange={e => setAddModalData(p => ({ ...p, allowEarlyStart: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Pozwalaj rozpocząć pracę wcześniej</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addModalData.allowOvertime}
                    onChange={e => setAddModalData(p => ({ ...p, allowOvertime: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Pozwalaj na pracę po godzinach</span>
                </label>
              </div>

              {/* Worker */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Pracownik</label>
                <select
                  value={addModalData.userId}
                  onChange={e => setAddModalData(p => ({ ...p, userId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Wybierz pracownika...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Oddział</label>
                <select
                  value={addModalData.departmentId}
                  onChange={e => setAddModalData(p => ({ ...p, departmentId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Wybierz oddział...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowAddModal(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Mniej opcji
              </button>
              <button
                onClick={handleAddShift}
                disabled={saving || !addModalData.userId}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Dodawanie...' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Month Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCopyModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">
              Czy chcesz skopiować i wkleić grafik na następny miesiąc?
            </h3>
            <p className="text-sm text-gray-600">
              Skopiowane zostaną wszystkie zmiany z wybranego miesiąca. Wklejenie spowoduje nadpisanie obecnego grafiku w następnym miesiącu. Tej akcji nie da się cofnąć jednym kliknięciem.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Więcej tego nie pokazuj</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleCopyMonth}
                disabled={copyingMonth}
                className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {copyingMonth ? 'Kopiowanie...' : 'Tak, skopiuj i wklej'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ShiftTemplates – CRUD table for schedule templates
// ═══════════════════════════════════════════════════════════════════════════════

const ShiftTemplates: React.FC<{ companyId: string }> = ({ companyId }) => {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_time: '08:00',
    end_time: '16:00',
    break_minutes: 30,
    color: '#3b82f6',
  });
  const [formSaving, setFormSaving] = useState(false);

  // Confirm delete
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedule_templates')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (data) setTemplates(data);
      if (error) console.error('Error loading templates:', error);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const visibleTemplates = useMemo(() => {
    return showArchived ? templates : templates.filter((t) => !t.is_archived);
  }, [templates, showArchived]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: '', start_time: '08:00', end_time: '16:00', break_minutes: 30, color: '#3b82f6' });
    setShowModal(true);
  };

  const openEditModal = (tpl: ScheduleTemplate) => {
    setEditingId(tpl.id);
    setFormData({
      name: tpl.name,
      start_time: tpl.start_time?.slice(0, 5) || '08:00',
      end_time: tpl.end_time?.slice(0, 5) || '16:00',
      break_minutes: tpl.break_minutes ?? 30,
      color: tpl.color || '#3b82f6',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setFormSaving(true);
    try {
      const payload = {
        company_id: companyId,
        name: formData.name.trim(),
        start_time: formData.start_time,
        end_time: formData.end_time,
        break_minutes: formData.break_minutes,
        color: formData.color,
      };

      if (editingId) {
        await supabase.from('schedule_templates').update(payload).eq('id', editingId);
      } else {
        await supabase.from('schedule_templates').insert({ ...payload, is_archived: false });
      }

      setShowModal(false);
      await loadTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Błąd podczas zapisywania szablonu.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleArchive = async (id: string, archive: boolean) => {
    try {
      await supabase.from('schedule_templates').update({ is_archived: archive }).eq('id', id);
      await loadTemplates();
    } catch (err) {
      console.error('Error archiving template:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('schedule_templates').delete().eq('id', id);
      setDeleteConfirm(null);
      await loadTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      alert('Nie można usunąć szablonu. Może być używany w przypisaniach.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Pokaż zarchiwizowane
          </label>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nowy szablon
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Kolor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nazwa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Początek</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Koniec</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Przerwa (min)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleTemplates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                      Brak szablonów zmian. Utwórz pierwszy szablon.
                    </td>
                  </tr>
                )}
                {visibleTemplates.map((tpl) => (
                  <tr key={tpl.id} className={`hover:bg-gray-50/50 ${tpl.is_archived ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block w-6 h-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: tpl.color || '#3b82f6' }}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{tpl.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatTime(tpl.start_time)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatTime(tpl.end_time)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{tpl.break_minutes ?? '—'}</td>
                    <td className="px-4 py-3">
                      {tpl.is_archived ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                          Zarchiwizowany
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                          Aktywny
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(tpl)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                          title="Edytuj"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {tpl.is_archived ? (
                          <button
                            onClick={() => handleArchive(tpl.id, false)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-600 transition-colors"
                            title="Przywróć"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchive(tpl.id, true)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-yellow-600 transition-colors"
                            title="Archiwizuj"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirm(tpl.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"
                          title="Usuń"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? 'Edytuj szablon' : 'Nowy szablon zmiany'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="np. Zmiana poranna"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Początek</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData((p) => ({ ...p, start_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Koniec</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData((p) => ({ ...p, end_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Przerwa (minuty)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={formData.break_minutes}
                onChange={(e) => setFormData((p) => ({ ...p, break_minutes: parseInt(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kolor</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFormData((p) => ({ ...p, color: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === c ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent hover:border-gray-300'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                  className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <span className="text-xs text-gray-500">lub wybierz własny kolor</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Podgląd</label>
              <div
                className="rounded-lg px-3 py-2 text-sm font-medium text-white inline-block"
                style={{ backgroundColor: formData.color }}
              >
                {formData.name || 'Nazwa zmiany'} &middot; {formData.start_time}–{formData.end_time}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleSave}
                disabled={formSaving || !formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {formSaving ? 'Zapisuję...' : editingId ? 'Zapisz zmiany' : 'Utwórz szablon'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Potwierdź usunięcie</h3>
            <p className="text-sm text-gray-600">
              Czy na pewno chcesz usunąć ten szablon? Istniejące przypisania korzystające z tego szablonu mogą utracić
              powiązanie.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
