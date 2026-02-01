
import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, Play, Pause, Square, Coffee, MapPin, Monitor,
  ChevronLeft, ChevronRight, FileEdit, Send
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type {
  WorkerDay, WorkerDayEntry, WorkerDayActivity,
  WorkerState, WorkerCurrentStatus, TimeActionType, Department
} from '../../types';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const fmt2 = (n: number) => String(n).padStart(2, '0');

const formatDuration = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${fmt2(h)}:${fmt2(m)}:${fmt2(s)}`;
};

const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${fmt2(h)}:${fmt2(m)}`;
};

const formatTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
};

const dayStatusColor = (status: string): string => {
  switch (status) {
    case 'present': return 'bg-green-100 text-green-800 border-green-200';
    case 'late': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'absent': return 'bg-red-100 text-red-800 border-red-200';
    case 'day_off':
    case 'holiday':
    case 'time_off': return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'incomplete': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const dayStatusLabel = (status: string): string => {
  switch (status) {
    case 'present': return 'Obecny';
    case 'late': return 'Spóźniony';
    case 'absent': return 'Nieobecny';
    case 'day_off': return 'Dzień wolny';
    case 'holiday': return 'Święto';
    case 'time_off': return 'Urlop';
    case 'incomplete': return 'Niekompletny';
    default: return status;
  }
};

const dayStatusRowBg = (status: string): string => {
  switch (status) {
    case 'present': return 'hover:bg-green-50/60';
    case 'late': return 'bg-yellow-50/40 hover:bg-yellow-50/70';
    case 'absent': return 'bg-red-50/40 hover:bg-red-50/70';
    case 'day_off':
    case 'holiday':
    case 'time_off': return 'bg-gray-50/60 hover:bg-gray-100/60';
    default: return 'hover:bg-slate-50';
  }
};

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export const EmployeeAttendancePage = () => {
  const { state } = useAppContext();
  const currentUser = state.currentUser;
  const currentCompany = state.currentCompany;

  // ── live clock state ──────────────────────────────────────────
  const [workerState, setWorkerState] = useState<WorkerState | null>(null);
  const [todayDay, setTodayDay] = useState<WorkerDay | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // ── department / remote ───────────────────────────────────────
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [isRemote, setIsRemote] = useState(false);

  // ── month history ─────────────────────────────────────────────
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthDays, setMonthDays] = useState<WorkerDay[]>([]);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);

  // ── change request modal ──────────────────────────────────────
  const [requestModal, setRequestModal] = useState<{
    open: boolean;
    day: WorkerDay | null;
  }>({ open: false, day: null });
  const [reqStartTime, setReqStartTime] = useState('');
  const [reqFinishTime, setReqFinishTime] = useState('');
  const [reqComment, setReqComment] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);

  const userId = currentUser?.id;
  const companyId = currentCompany?.id;

  // ══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ══════════════════════════════════════════════════════════════

  const loadWorkerState = useCallback(async () => {
    if (!userId || !companyId) return;
    const { data } = await supabase
      .from('worker_states')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (data) {
      setWorkerState(data as WorkerState);
      if (data.current_department_id) {
        setSelectedDepartmentId(data.current_department_id);
      }
      setIsRemote(data.is_remote ?? false);
    }
  }, [userId, companyId]);

  const loadTodayDay = useCallback(async () => {
    if (!userId || !companyId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('worker_days')
      .select('*, entries:worker_day_entries(*, activities:worker_day_activities(*))')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('date', today)
      .maybeSingle();
    if (data) setTodayDay(data as WorkerDay);
  }, [userId, companyId]);

  const loadDepartments = useCallback(async () => {
    if (!userId || !companyId) return;
    const { data: members } = await supabase
      .from('department_members')
      .select('department_id')
      .eq('user_id', userId)
      .eq('company_id', companyId);
    if (members && members.length > 0) {
      const ids = members.map(m => m.department_id);
      const { data: deps } = await supabase
        .from('departments')
        .select('*')
        .in('id', ids)
        .eq('is_archived', false);
      if (deps) {
        setDepartments(deps as Department[]);
        if (!selectedDepartmentId && deps.length === 1) {
          setSelectedDepartmentId(deps[0].id);
        }
      }
    }
  }, [userId, companyId, selectedDepartmentId]);

  const loadMonthDays = useCallback(async () => {
    if (!userId || !companyId) return;
    setMonthLoading(true);
    const startDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
      .toISOString().slice(0, 10);
    const endDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
      .toISOString().slice(0, 10);

    const { data } = await supabase
      .from('worker_days')
      .select('*, entries:worker_day_entries(*, activities:worker_day_activities(*))')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    setMonthDays((data ?? []) as WorkerDay[]);
    setMonthLoading(false);
  }, [userId, companyId, viewMonth]);

  // ── initial loads ─────────────────────────────────────────────
  useEffect(() => {
    loadWorkerState();
    loadTodayDay();
    loadDepartments();
  }, [loadWorkerState, loadTodayDay, loadDepartments]);

  useEffect(() => {
    loadMonthDays();
  }, [loadMonthDays]);

  // ── live timer ────────────────────────────────────────────────
  useEffect(() => {
    if (!workerState) return;
    const status = workerState.current_status;
    if (status === 'offline') {
      setElapsedSeconds(0);
      return;
    }

    const referenceTime = workerState.activity_started_at || workerState.work_started_at;
    if (!referenceTime) {
      setElapsedSeconds(0);
      return;
    }

    const calcElapsed = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(referenceTime).getTime()) / 1000));
      setElapsedSeconds(diff);
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [workerState]);

  // ══════════════════════════════════════════════════════════════
  // CLOCK ACTION
  // ══════════════════════════════════════════════════════════════

  const performAction = async (actionType: TimeActionType) => {
    if (!userId || !companyId || actionLoading) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('process_time_action', {
        p_user_id: userId,
        p_company_id: companyId,
        p_action_type: actionType,
        p_timestamp: new Date().toISOString(),
        p_source: 'web',
        p_department_id: selectedDepartmentId || null,
        p_note: null,
      });
      if (error) {
        console.error('process_time_action error:', error);
        alert(`Blad: ${error.message}`);
      }
      await Promise.all([loadWorkerState(), loadTodayDay(), loadMonthDays()]);
    } catch (err: any) {
      console.error(err);
      alert('Wystapil nieoczekiwany blad.');
    } finally {
      setActionLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // CHANGE REQUEST
  // ══════════════════════════════════════════════════════════════

  const openRequestModal = (day: WorkerDay) => {
    setRequestModal({ open: true, day });
    setReqStartTime('');
    setReqFinishTime('');
    setReqComment('');
  };

  const closeRequestModal = () => {
    setRequestModal({ open: false, day: null });
  };

  const submitChangeRequest = async () => {
    if (!userId || !companyId || !requestModal.day) return;
    if (!reqComment.trim()) {
      alert('Komentarz jest wymagany.');
      return;
    }
    if (!reqStartTime || !reqFinishTime) {
      alert('Podaj godzine rozpoczecia i zakonczenia.');
      return;
    }

    setReqSubmitting(true);
    try {
      const requestedEntries = [
        {
          start_time: `${requestModal.day.date}T${reqStartTime}:00`,
          finish_time: `${requestModal.day.date}T${reqFinishTime}:00`,
          department_id: selectedDepartmentId || undefined,
          activities: [
            {
              type: 'work' as const,
              start_time: `${requestModal.day.date}T${reqStartTime}:00`,
              finish_time: `${requestModal.day.date}T${reqFinishTime}:00`,
            },
          ],
        },
      ];

      const { error } = await supabase.from('worker_day_requests').insert({
        company_id: companyId,
        user_id: userId,
        worker_day_id: requestModal.day.id || undefined,
        date: requestModal.day.date,
        status: 'pending',
        requested_entries: requestedEntries,
        note: reqComment.trim(),
      });

      if (error) {
        console.error('insert request error:', error);
        alert(`Blad: ${error.message}`);
      } else {
        alert('Wniosek zostal wyslany.');
        closeRequestModal();
      }
    } catch (err: any) {
      console.error(err);
      alert('Wystapil nieoczekiwany blad.');
    } finally {
      setReqSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // MONTH NAVIGATION
  // ══════════════════════════════════════════════════════════════

  const prevMonth = () =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  const monthLabel = viewMonth.toLocaleString('pl-PL', { month: 'long', year: 'numeric' });

  // ══════════════════════════════════════════════════════════════
  // MONTH SUMMARY
  // ══════════════════════════════════════════════════════════════

  const summary = (() => {
    let workDays = 0;
    let totalMinutes = 0;
    let overtimeMinutes = 0;
    let absences = 0;
    for (const d of monthDays) {
      if (d.status === 'present' || d.status === 'late') {
        workDays++;
        totalMinutes += d.work_time_minutes || 0;
        overtimeMinutes += d.overtime_minutes || 0;
      }
      if (d.status === 'absent') absences++;
    }
    return { workDays, totalMinutes, overtimeMinutes, absences };
  })();

  // ══════════════════════════════════════════════════════════════
  // DERIVED STATUS TEXT
  // ══════════════════════════════════════════════════════════════

  const currentStatus: WorkerCurrentStatus = workerState?.current_status ?? 'offline';

  const statusText = (() => {
    if (currentStatus === 'working' && workerState?.work_started_at) {
      return `Pracuje od ${formatTime(workerState.work_started_at)}`;
    }
    if (currentStatus === 'on_break' && workerState?.activity_started_at) {
      return `Na przerwie od ${formatTime(workerState.activity_started_at)}`;
    }
    if (currentStatus === 'offline') {
      return 'Nie w pracy';
    }
    return currentStatus;
  })();

  // ══════════════════════════════════════════════════════════════
  // GUARD
  // ══════════════════════════════════════════════════════════════

  if (!currentUser || !currentCompany) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Brak danych uzytkownika.
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-24">
      {/* ── HEADER ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Moja ewidencja</h1>
        <p className="text-sm text-slate-500">Ewidencja czasu pracy</p>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TOP BLOCK - CURRENT STATUS
          ══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
        {/* Status line */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                currentStatus === 'working'
                  ? 'bg-green-500 animate-pulse'
                  : currentStatus === 'on_break'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-slate-300'
              }`}
            />
            <span className="text-base font-semibold text-slate-800">{statusText}</span>
          </div>

          {/* Live timer */}
          {currentStatus !== 'offline' && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
              <Clock size={18} className="text-slate-500" />
              <span className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                {formatDuration(elapsedSeconds)}
              </span>
            </div>
          )}
        </div>

        {/* Department + Remote */}
        <div className="flex flex-col sm:flex-row gap-3">
          {departments.length > 0 && (
            <div className="flex items-center gap-2 flex-1">
              <MapPin size={16} className="text-slate-400 shrink-0" />
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Wybierz dzial --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={isRemote}
              onChange={(e) => setIsRemote(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <Monitor size={16} className="text-slate-400" />
            Praca zdalna
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {currentStatus === 'offline' && (
            <button
              disabled={actionLoading}
              onClick={() => performAction('work_start')}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold rounded-xl shadow-sm transition-colors text-sm sm:text-base"
            >
              <Play size={20} />
              Rozpocznij prace
            </button>
          )}

          {currentStatus === 'working' && (
            <>
              <button
                disabled={actionLoading}
                onClick={() => performAction('break_start')}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white font-bold rounded-xl shadow-sm transition-colors text-sm sm:text-base"
              >
                <Coffee size={20} />
                Przerwa
              </button>
              <button
                disabled={actionLoading}
                onClick={() => performAction('work_finish')}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-xl shadow-sm transition-colors text-sm sm:text-base"
              >
                <Square size={20} />
                Zakoncz prace
              </button>
            </>
          )}

          {currentStatus === 'on_break' && (
            <button
              disabled={actionLoading}
              onClick={() => performAction('break_finish')}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold rounded-xl shadow-sm transition-colors text-sm sm:text-base"
            >
              <Pause size={20} />
              Zakoncz przerwe
            </button>
          )}

          {actionLoading && (
            <span className="flex items-center text-sm text-slate-400 ml-2">
              <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Przetwarzanie...
            </span>
          )}
        </div>

        {/* Today summary mini */}
        {todayDay && (
          <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100 text-sm text-slate-600">
            <span>
              Praca:{' '}
              <strong className="text-slate-800">{formatMinutes(todayDay.work_time_minutes || 0)}</strong>
            </span>
            <span>
              Przerwa:{' '}
              <strong className="text-slate-800">{formatMinutes(todayDay.break_time_minutes || 0)}</strong>
            </span>
            {(todayDay.overtime_minutes || 0) > 0 && (
              <span>
                Nadgodziny:{' '}
                <strong className="text-orange-600">{formatMinutes(todayDay.overtime_minutes || 0)}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          MONTH SUMMARY CARDS
          ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">
            Dni robocze
          </span>
          <span className="text-2xl font-bold text-slate-900">{summary.workDays}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">
            Przepracowano godzin
          </span>
          <span className="text-2xl font-bold text-slate-900">
            {formatMinutes(summary.totalMinutes)}
          </span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">
            Nadgodziny
          </span>
          <span className="text-2xl font-bold text-orange-600">
            {formatMinutes(summary.overtimeMinutes)}
          </span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">
            Nieobecnosci
          </span>
          <span className="text-2xl font-bold text-red-600">{summary.absences}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          BOTTOM BLOCK - MONTH HISTORY
          ══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Month Nav */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50">
          <button
            onClick={prevMonth}
            className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft size={18} /> Poprzedni
          </button>
          <h3 className="font-bold text-slate-800 capitalize text-sm sm:text-base">{monthLabel}</h3>
          <button
            onClick={nextMonth}
            className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Nastepny <ChevronRight size={18} />
          </button>
        </div>

        {/* Table */}
        {monthLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Ladowanie...</div>
        ) : monthDays.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Brak danych za wybrany miesiac.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Przyjscie</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Wyjscie</th>
                  <th className="px-4 py-3">Praca</th>
                  <th className="px-4 py-3 hidden md:table-cell">Przerwa</th>
                  <th className="px-4 py-3 hidden md:table-cell">Nadgodziny</th>
                  <th className="px-4 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthDays.map((day) => {
                  const isExpanded = expandedDayId === day.id;
                  const entries = (day.entries ?? []) as WorkerDayEntry[];
                  const firstEntry = entries[0];
                  const lastEntry = entries[entries.length - 1];
                  const dayDate = new Date(day.date);
                  const dayStr = dayDate.toLocaleDateString('pl-PL', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  });
                  const isPast =
                    dayDate.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);

                  return (
                    <React.Fragment key={day.id}>
                      <tr
                        className={`cursor-pointer transition-colors ${dayStatusRowBg(day.status)}`}
                        onClick={() => setExpandedDayId(isExpanded ? null : day.id)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap capitalize">
                          {dayStr}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full border ${dayStatusColor(
                              day.status
                            )}`}
                          >
                            {dayStatusLabel(day.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-slate-600">
                          {firstEntry ? formatTime(firstEntry.start_time) : '—'}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-slate-600">
                          {lastEntry?.finish_time ? formatTime(lastEntry.finish_time) : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {formatMinutes(day.work_time_minutes || 0)}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                          {formatMinutes(day.break_time_minutes || 0)}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-orange-600 font-medium">
                          {(day.overtime_minutes || 0) > 0
                            ? formatMinutes(day.overtime_minutes)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isPast && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRequestModal(day);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              title="Zloz wniosek o zmiane"
                            >
                              <FileEdit size={14} />
                              <span className="hidden lg:inline">Zmiana</span>
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 px-4 py-4">
                            {entries.length === 0 ? (
                              <p className="text-sm text-slate-400">
                                Brak wpisow w tym dniu.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                                  Wpisy i aktywnosci
                                </h4>
                                {entries.map((entry, eIdx) => (
                                  <div
                                    key={entry.id}
                                    className="bg-white rounded-lg border border-slate-200 p-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
                                      <span className="font-semibold text-slate-800">
                                        Wpis #{eIdx + 1}
                                      </span>
                                      <span className="text-slate-500">
                                        {formatTime(entry.start_time)} &mdash;{' '}
                                        {entry.finish_time ? formatTime(entry.finish_time) : 'w toku'}
                                      </span>
                                      {entry.is_remote && (
                                        <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                          <Monitor size={12} /> Zdalnie
                                        </span>
                                      )}
                                      {entry.department && (
                                        <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                          <MapPin size={12} /> {entry.department.name}
                                        </span>
                                      )}
                                    </div>

                                    {/* Activities */}
                                    {entry.activities && entry.activities.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {entry.activities.map((act: WorkerDayActivity) => (
                                          <div
                                            key={act.id}
                                            className="flex items-center gap-2 text-xs text-slate-600 pl-2 border-l-2 border-slate-200"
                                          >
                                            <span
                                              className={`w-2 h-2 rounded-full shrink-0 ${
                                                act.type === 'work'
                                                  ? 'bg-green-500'
                                                  : act.type === 'break'
                                                  ? 'bg-yellow-500'
                                                  : 'bg-blue-500'
                                              }`}
                                            />
                                            <span className="font-medium capitalize">
                                              {act.type === 'work'
                                                ? 'Praca'
                                                : act.type === 'break'
                                                ? 'Przerwa'
                                                : act.type === 'exit_business'
                                                ? 'Wyjscie sluzbowe'
                                                : act.type === 'exit_private'
                                                ? 'Wyjscie prywatne'
                                                : act.type}
                                            </span>
                                            <span>
                                              {formatTime(act.start_time)} &mdash;{' '}
                                              {act.finish_time ? formatTime(act.finish_time) : 'w toku'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          CHANGE REQUEST MODAL
          ══════════════════════════════════════════════════════════ */}
      {requestModal.open && requestModal.day && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeRequestModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="font-bold text-lg text-slate-900">Zloz wniosek o zmiane</h3>
              <button
                onClick={closeRequestModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Square size={20} />
              </button>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Data
              </label>
              <input
                type="text"
                readOnly
                value={new Date(requestModal.day.date).toLocaleDateString('pl-PL', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
              />
            </div>

            {/* Current entries (readonly) */}
            {requestModal.day.entries && (requestModal.day.entries as WorkerDayEntry[]).length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Obecne wpisy (do wgladu)
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-sm text-slate-600">
                  {(requestModal.day.entries as WorkerDayEntry[]).map((entry, idx) => (
                    <div key={entry.id}>
                      Wpis #{idx + 1}: {formatTime(entry.start_time)} &mdash;{' '}
                      {entry.finish_time ? formatTime(entry.finish_time) : 'brak'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposed entries */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Proponowane przyjscie
                </label>
                <input
                  type="time"
                  value={reqStartTime}
                  onChange={(e) => setReqStartTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Proponowane wyjscie
                </label>
                <input
                  type="time"
                  value={reqFinishTime}
                  onChange={(e) => setReqFinishTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Komentarz <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reqComment}
                onChange={(e) => setReqComment(e.target.value)}
                placeholder="Opisz powod wnioskowanej zmiany..."
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeRequestModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={submitChangeRequest}
                disabled={reqSubmitting || !reqComment.trim() || !reqStartTime || !reqFinishTime}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
              >
                <Send size={16} />
                {reqSubmitting ? 'Wysylanie...' : 'Wyslij wniosek'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
