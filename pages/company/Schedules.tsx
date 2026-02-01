
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarClock, CalendarRange, Plus, Edit, Trash2, Copy,
  ChevronLeft, ChevronRight, Filter, Search, Palette, X, Check, Archive, RotateCcw
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { ScheduleTemplate, ScheduleAssignment, User, Role, Department } from '../../types';

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48',
];

type ActiveTab = 'grid' | 'templates';

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

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

// ── Component ────────────────────────────────────────────────────────────────

export const CompanySchedulesPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, currentCompany } = state;

  const [activeTab, setActiveTab] = useState<ActiveTab>('grid');

  if (!currentUser || !currentCompany) return null;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock className="w-7 h-7 text-blue-600" />
            Grafiki pracy
          </h1>
          <p className="text-gray-500 text-sm mt-1">Zarządzaj zmianami i szablonami</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('grid')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'grid' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
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

      {activeTab === 'grid' && <ScheduleGrid companyId={currentCompany.id} />}
      {activeTab === 'templates' && <ShiftTemplates companyId={currentCompany.id} />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ScheduleGrid – weekly grid of employees x days
// ═══════════════════════════════════════════════════════════════════════════════

const ScheduleGrid: React.FC<{ companyId: string }> = ({ companyId }) => {
  const { state } = useAppContext();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [departmentMembers, setDepartmentMembers] = useState<{ user_id: string; department_id: string }[]>([]);

  // Cell edit
  const [editingCell, setEditingCell] = useState<{ userId: string; date: string } | null>(null);

  // Bulk apply modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState('');
  const [bulkEmployees, setBulkEmployees] = useState<string[]>([]);
  const [bulkDateFrom, setBulkDateFrom] = useState('');
  const [bulkDateTo, setBulkDateTo] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Copy week
  const [copyingWeek, setCopyingWeek] = useState(false);

  // Custom time modal
  const [customTimeModal, setCustomTimeModal] = useState<{ userId: string; date: string } | null>(null);
  const [customStartTime, setCustomStartTime] = useState('08:00');
  const [customEndTime, setCustomEndTime] = useState('16:00');

  const weekMonday = useMemo(() => getMonday(currentDate), [currentDate]);
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekMonday]);

  const dateRange = useMemo(() => {
    const end = new Date(weekMonday);
    end.setDate(end.getDate() + 6);
    return { start: toISO(weekMonday), end: toISO(end) };
  }, [weekMonday]);

  // Company employees
  const employees = useMemo(() => {
    return state.users.filter(
      (u) =>
        u.company_id === companyId &&
        [Role.EMPLOYEE, Role.BRIGADIR, Role.COORDINATOR, Role.HR].includes(u.role) &&
        u.status === 'active'
    );
  }, [state.users, companyId]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    let list = employees;

    if (departmentFilter !== 'all') {
      const memberUserIds = new Set(
        departmentMembers.filter((dm) => dm.department_id === departmentFilter).map((dm) => dm.user_id)
      );
      list = list.filter((e) => memberUserIds.has(e.id));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (e) =>
          e.first_name.toLowerCase().includes(q) ||
          e.last_name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));
  }, [employees, departmentFilter, departmentMembers, searchTerm]);

  // Assignment lookup
  const assignmentMap = useMemo(() => {
    const m: Record<string, ScheduleAssignment> = {};
    for (const a of assignments) {
      m[`${a.user_id}_${a.date}`] = a;
    }
    return m;
  }, [assignments]);

  // ── Load data ──────────────────────────────────────────────────────────────

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

  // ── Cell actions ───────────────────────────────────────────────────────────

  const handleCellClick = (userId: string, date: string) => {
    setEditingCell((prev) => (prev?.userId === userId && prev.date === date ? null : { userId, date }));
  };

  const assignTemplate = async (userId: string, date: string, templateId: string | null) => {
    setSaving(true);
    setEditingCell(null);
    try {
      const existing = assignmentMap[`${userId}_${date}`];

      if (templateId === null) {
        // Remove assignment ("Brak zmiany")
        if (existing) {
          await supabase.from('schedule_assignments').delete().eq('id', existing.id);
        }
      } else {
        const payload = {
          company_id: companyId,
          user_id: userId,
          template_id: templateId,
          date,
          custom_start_time: null,
          custom_end_time: null,
        };

        if (existing) {
          await supabase.from('schedule_assignments').update(payload).eq('id', existing.id);
        } else {
          await supabase.from('schedule_assignments').insert(payload);
        }
      }

      await loadData();
    } catch (err) {
      console.error('Error assigning shift:', err);
    } finally {
      setSaving(false);
    }
  };

  const assignCustomTime = async () => {
    if (!customTimeModal) return;
    setSaving(true);
    try {
      const { userId, date } = customTimeModal;
      const existing = assignmentMap[`${userId}_${date}`];

      const payload = {
        company_id: companyId,
        user_id: userId,
        template_id: null,
        date,
        custom_start_time: customStartTime,
        custom_end_time: customEndTime,
      };

      if (existing) {
        await supabase.from('schedule_assignments').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('schedule_assignments').insert(payload);
      }

      setCustomTimeModal(null);
      await loadData();
    } catch (err) {
      console.error('Error assigning custom time:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Copy week ──────────────────────────────────────────────────────────────

  const handleCopyWeek = async () => {
    if (assignments.length === 0) return;
    setCopyingWeek(true);
    try {
      const nextMonday = new Date(weekMonday);
      nextMonday.setDate(nextMonday.getDate() + 7);

      const newAssignments = assignments.map((a) => {
        const origDate = new Date(a.date);
        const dayOffset = Math.round((origDate.getTime() - weekMonday.getTime()) / (1000 * 60 * 60 * 24));
        const newDate = new Date(nextMonday);
        newDate.setDate(newDate.getDate() + dayOffset);

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

      // Delete existing assignments for next week first
      const nextEnd = new Date(nextMonday);
      nextEnd.setDate(nextEnd.getDate() + 6);

      await supabase
        .from('schedule_assignments')
        .delete()
        .eq('company_id', companyId)
        .gte('date', toISO(nextMonday))
        .lte('date', toISO(nextEnd));

      // Insert new
      if (newAssignments.length > 0) {
        await supabase.from('schedule_assignments').insert(newAssignments);
      }

      alert('Grafik został skopiowany na następny tydzień.');
    } catch (err) {
      console.error('Error copying week:', err);
      alert('Błąd podczas kopiowania tygodnia.');
    } finally {
      setCopyingWeek(false);
    }
  };

  // ── Bulk apply ─────────────────────────────────────────────────────────────

  const handleBulkApply = async () => {
    if (!bulkTemplate || bulkEmployees.length === 0 || !bulkDateFrom || !bulkDateTo) return;
    setBulkSaving(true);
    try {
      const start = new Date(bulkDateFrom);
      const end = new Date(bulkDateTo);
      const inserts: any[] = [];

      const cursor = new Date(start);
      while (cursor <= end) {
        for (const empId of bulkEmployees) {
          inserts.push({
            company_id: companyId,
            user_id: empId,
            template_id: bulkTemplate,
            date: toISO(cursor),
            custom_start_time: null,
            custom_end_time: null,
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      // Upsert: remove existing in that range for those employees, then insert
      for (const empId of bulkEmployees) {
        await supabase
          .from('schedule_assignments')
          .delete()
          .eq('company_id', companyId)
          .eq('user_id', empId)
          .gte('date', bulkDateFrom)
          .lte('date', bulkDateTo);
      }

      if (inserts.length > 0) {
        // Insert in batches of 500
        for (let i = 0; i < inserts.length; i += 500) {
          await supabase.from('schedule_assignments').insert(inserts.slice(i, i + 500));
        }
      }

      setShowBulkModal(false);
      setBulkTemplate('');
      setBulkEmployees([]);
      setBulkDateFrom('');
      setBulkDateTo('');
      await loadData();
      alert('Szablon został zastosowany.');
    } catch (err) {
      console.error('Error bulk applying template:', err);
      alert('Błąd podczas stosowania szablonu.');
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleBulkEmployee = (id: string) => {
    setBulkEmployees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const navigatePrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const periodLabel = useMemo(() => {
    const endDate = new Date(weekMonday);
    endDate.setDate(endDate.getDate() + 6);
    const s = `${weekMonday.getDate()} ${MONTH_NAMES[weekMonday.getMonth()].slice(0, 3)}`;
    const e = `${endDate.getDate()} ${MONTH_NAMES[endDate.getMonth()].slice(0, 3)} ${endDate.getFullYear()}`;
    return `${s} – ${e}`;
  }, [weekMonday]);

  const isToday = (d: Date) => toISO(d) === toISO(new Date());

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <button onClick={navigatePrev} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="text-base font-semibold text-gray-900 min-w-[200px] text-center">{periodLabel}</span>
          <button onClick={navigateNext} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            Dziś
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Szukaj pracownika..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">Wszystkie działy</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <button
            onClick={handleCopyWeek}
            disabled={copyingWeek || assignments.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Copy className="w-4 h-4" />
            Kopiuj tydzień
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <CalendarRange className="w-4 h-4" />
            Zastosuj szablon
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-52 sticky left-0 bg-gray-50 z-10">
                  Pracownik
                </th>
                {weekDates.map((date, i) => (
                  <th
                    key={i}
                    className={`px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider min-w-[120px] ${
                      isToday(date) ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                    }`}
                  >
                    <div>{DAY_LABELS[i]}</div>
                    <div className="text-sm font-bold">{date.getDate()}.{String(date.getMonth() + 1).padStart(2, '0')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                    Brak pracowników do wyświetlenia
                  </td>
                </tr>
              )}
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2 text-sm font-medium text-gray-900 w-52 sticky left-0 bg-white z-10 border-r border-gray-100">
                    <div className="truncate" title={`${emp.first_name} ${emp.last_name}`}>
                      {emp.last_name} {emp.first_name}
                    </div>
                  </td>
                  {weekDates.map((date, di) => {
                    const dateStr = toISO(date);
                    const key = `${emp.id}_${dateStr}`;
                    const assignment = assignmentMap[key];
                    const isEditing = editingCell?.userId === emp.id && editingCell?.date === dateStr;

                    return (
                      <td
                        key={di}
                        className={`px-1 py-1 text-center relative ${
                          isToday(date) ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        {/* Cell display */}
                        <button
                          onClick={() => handleCellClick(emp.id, dateStr)}
                          className="w-full min-h-[48px] rounded-lg border border-transparent hover:border-gray-300 transition-colors p-1 text-left"
                          disabled={saving}
                        >
                          {assignment ? (
                            assignment.template ? (
                              <div
                                className="rounded-md px-1.5 py-1 text-xs font-medium text-white truncate"
                                style={{ backgroundColor: assignment.template.color || '#3b82f6' }}
                              >
                                <div className="truncate font-semibold">{assignment.template.name}</div>
                                <div className="opacity-90">
                                  {formatTime(assignment.template.start_time)}–{formatTime(assignment.template.end_time)}
                                </div>
                              </div>
                            ) : assignment.custom_start_time && assignment.custom_end_time ? (
                              <div className="rounded-md px-1.5 py-1 text-xs font-medium text-white bg-gray-600 truncate">
                                <div className="truncate font-semibold">Własny</div>
                                <div className="opacity-90">
                                  {formatTime(assignment.custom_start_time)}–{formatTime(assignment.custom_end_time)}
                                </div>
                              </div>
                            ) : null
                          ) : (
                            <div className="text-xs text-gray-300 text-center">—</div>
                          )}
                        </button>

                        {/* Dropdown */}
                        {isEditing && (
                          <div className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[180px]">
                            <button
                              onClick={() => assignTemplate(emp.id, dateStr, null)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <X className="w-3.5 h-3.5 text-gray-400" />
                              Brak zmiany
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            {templates.map((tpl) => (
                              <button
                                key={tpl.id}
                                onClick={() => assignTemplate(emp.id, dateStr, tpl.id)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <span
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: tpl.color }}
                                />
                                <span className="truncate">
                                  {tpl.name} ({formatTime(tpl.start_time)}–{formatTime(tpl.end_time)})
                                </span>
                              </button>
                            ))}
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={() => {
                                setEditingCell(null);
                                setCustomStartTime(assignment?.custom_start_time?.slice(0, 5) || '08:00');
                                setCustomEndTime(assignment?.custom_end_time?.slice(0, 5) || '16:00');
                                setCustomTimeModal({ userId: emp.id, date: dateStr });
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Edit className="w-3.5 h-3.5 text-gray-400" />
                              Własny czas...
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {!loading && templates.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Legenda</h3>
          <div className="flex flex-wrap gap-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tpl.color }} />
                <span className="text-xs text-gray-600">
                  {tpl.name} ({formatTime(tpl.start_time)}–{formatTime(tpl.end_time)})
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-600" />
              <span className="text-xs text-gray-600">Własny czas</span>
            </div>
          </div>
        </div>
      )}

      {/* Custom time modal */}
      {customTimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCustomTimeModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Własny czas pracy</h3>
            <p className="text-sm text-gray-500">
              Pracownik: {(() => { const u = employees.find(e => e.id === customTimeModal.userId); return u ? `${u.first_name} ${u.last_name}` : ''; })()}
              <br />
              Data: {customTimeModal.date}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Początek</label>
                <input
                  type="time"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Koniec</label>
                <input
                  type="time"
                  value={customEndTime}
                  onChange={(e) => setCustomEndTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCustomTimeModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={assignCustomTime}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Zapisuję...' : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk apply modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowBulkModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Zastosuj szablon</h3>
              <button onClick={() => setShowBulkModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Template selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Szablon zmiany</label>
              <select
                value={bulkTemplate}
                onChange={(e) => setBulkTemplate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Wybierz szablon...</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({formatTime(tpl.start_time)}–{formatTime(tpl.end_time)})
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data od</label>
                <input
                  type="date"
                  value={bulkDateFrom}
                  onChange={(e) => setBulkDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do</label>
                <input
                  type="date"
                  value={bulkDateTo}
                  onChange={(e) => setBulkDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Employee selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pracownicy ({bulkEmployees.length} wybranych)
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setBulkEmployees(employees.map((e) => e.id))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Zaznacz wszystkich
                </button>
                <button onClick={() => setBulkEmployees([])} className="text-xs text-gray-500 hover:underline">
                  Odznacz
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                {employees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={bulkEmployees.includes(emp.id)}
                      onChange={() => toggleBulkEmployee(emp.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-800">
                      {emp.last_name} {emp.first_name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleBulkApply}
                disabled={bulkSaving || !bulkTemplate || bulkEmployees.length === 0 || !bulkDateFrom || !bulkDateTo}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bulkSaving ? 'Stosowanie...' : 'Zastosuj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click-away overlay for cell dropdown */}
      {editingCell && (
        <div className="fixed inset-0 z-10" onClick={() => setEditingCell(null)} />
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

  // ── Load ───────────────────────────────────────────────────────────────────

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

  // ── Modal handlers ─────────────────────────────────────────────────────────

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

  // ── Archive / Delete ───────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

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

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Table */}
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

            {/* Name */}
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

            {/* Time */}
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

            {/* Break */}
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

            {/* Color */}
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

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Podgląd</label>
              <div
                className="rounded-lg px-3 py-2 text-sm font-medium text-white inline-block"
                style={{ backgroundColor: formData.color }}
              >
                {formData.name || 'Nazwa zmiany'} &middot; {formData.start_time}–{formData.end_time}
              </div>
            </div>

            {/* Actions */}
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
