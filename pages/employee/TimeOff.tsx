import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarOff,
  CalendarDays,
  Plus,
  X,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  TimeOffType,
  TimeOffLimit,
  TimeOffRequest,
  TimeOffRequestStatus,
} from '../../types';
import { SectionTabs } from '../../components/SectionTabs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count business days (Mon-Fri) between two dates, inclusive. */
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

const STATUS_CONFIG: Record<
  TimeOffRequestStatus,
  { label: string; bg: string; text: string }
> = {
  pending: { label: 'Oczekujący', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  approved: { label: 'Zatwierdzony', bg: 'bg-green-100', text: 'text-green-800' },
  rejected: { label: 'Odrzucony', bg: 'bg-red-100', text: 'text-red-800' },
  cancelled: { label: 'Anulowany', bg: 'bg-gray-100', text: 'text-gray-600' },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const EmployeeTimeOffPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  // Data
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [limits, setLimits] = useState<TimeOffLimit[]>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formTypeId, setFormTypeId] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formAllDay, setFormAllDay] = useState(true);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('16:00');
  const [formComment, setFormComment] = useState('');

  const currentYear = new Date().getFullYear();

  // ------- data loading -------
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const companyId = currentUser.company_id;

      const [typesRes, limitsRes, requestsRes] = await Promise.all([
        supabase
          .from('time_off_types')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_archived', false)
          .order('display_order'),
        supabase
          .from('time_off_limits')
          .select('*, time_off_type:time_off_types(*)')
          .eq('user_id', currentUser.id)
          .eq('year', currentYear),
        supabase
          .from('time_off_requests')
          .select('*, time_off_type:time_off_types(*)')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false }),
      ]);

      if (typesRes.data) setTypes(typesRes.data);
      if (limitsRes.data) setLimits(limitsRes.data);
      if (requestsRes.data) setRequests(requestsRes.data);
    } catch (err) {
      console.error('Error loading time-off data', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ------- derived -------
  const selectedType = useMemo(
    () => types.find((t) => t.id === formTypeId),
    [types, formTypeId],
  );

  const calculatedAmount = useMemo(() => {
    if (!formStart || !formEnd) return 0;
    if (!formAllDay && selectedType?.allows_hourly) {
      // calculate hours
      const [sh, sm] = formStartTime.split(':').map(Number);
      const [eh, em] = formEndTime.split(':').map(Number);
      const days = countBusinessDays(formStart, formEnd);
      const hoursPerDay = eh + em / 60 - (sh + sm / 60);
      return Math.max(0, Math.round(days * hoursPerDay * 100) / 100);
    }
    return countBusinessDays(formStart, formEnd);
  }, [formStart, formEnd, formAllDay, formStartTime, formEndTime, selectedType]);

  // ------- actions -------
  const openModal = () => {
    setFormTypeId(types[0]?.id || '');
    setFormStart('');
    setFormEnd('');
    setFormAllDay(true);
    setFormStartTime('08:00');
    setFormEndTime('16:00');
    setFormComment('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!currentUser || !formTypeId || !formStart || !formEnd) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('time_off_requests').insert([
        {
          company_id: currentUser.company_id,
          user_id: currentUser.id,
          time_off_type_id: formTypeId,
          start_date: formStart,
          end_date: formEnd,
          all_day: formAllDay,
          start_time: formAllDay ? null : formStartTime,
          end_time: formAllDay ? null : formEndTime,
          hourly: !formAllDay && !!selectedType?.allows_hourly,
          amount: calculatedAmount,
          status: 'pending' as TimeOffRequestStatus,
          note_worker: formComment || null,
        },
      ]);
      if (error) throw error;
      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Error submitting request', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('time_off_requests')
        .update({ status: 'cancelled' as TimeOffRequestStatus })
        .eq('id', id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Error cancelling request', err);
    }
  };

  // ------- balance helpers -------
  const getLimit = (typeId: string): TimeOffLimit | undefined =>
    limits.find((l) => l.time_off_type_id === typeId);

  if (!currentUser) return null;

  // =======================================================================
  // RENDER
  // =======================================================================
  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-6 pb-24">
      <SectionTabs section="urlopy" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarOff className="w-6 h-6 text-indigo-600" />
            Moje urlopy
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Salda urlopowe i historia wniosków na rok {currentYear}
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Złóż wniosek
        </button>
      </div>

      {/* Balance Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {types.map((type) => {
            const limit = getLimit(type.id);
            const total = limit?.total_days ?? 0;
            const used = limit?.used_days ?? 0;
            const carried = limit?.carried_over_days ?? 0;
            const remaining = total + carried - used;
            const pct = total + carried > 0 ? (used / (total + carried)) * 100 : 0;

            return (
              <div
                key={type.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: type.color || '#6366f1' }}
                  />
                  <h3 className="font-semibold text-slate-800 text-sm truncate">
                    {type.name}
                  </h3>
                </div>

                {/* progress bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full mb-3">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: type.color || '#6366f1',
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-y-1 text-xs text-slate-500">
                  <span>Limit:</span>
                  <span className="text-right font-medium text-slate-700">
                    {total} dni
                  </span>
                  <span>Wykorzystane:</span>
                  <span className="text-right font-medium text-slate-700">
                    {used} dni
                  </span>
                  <span>Pozostało:</span>
                  <span
                    className={`text-right font-bold ${
                      remaining > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {remaining} dni
                  </span>
                  {carried > 0 && (
                    <>
                      <span>Przeniesione:</span>
                      <span className="text-right font-medium text-indigo-600">
                        {carried} dni
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {types.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-400">
              <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Brak zdefiniowanych typów urlopów
            </div>
          )}
        </div>
      )}

      {/* My Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Moje wnioski
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Ładowanie...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <CalendarOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nie masz jeszcze żadnych wniosków urlopowych
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                  <th className="px-5 py-3 font-medium">Typ</th>
                  <th className="px-5 py-3 font-medium">Daty</th>
                  <th className="px-5 py-3 font-medium text-center">Dni/Godz.</th>
                  <th className="px-5 py-3 font-medium text-center">Status</th>
                  <th className="px-5 py-3 font-medium">Data złożenia</th>
                  <th className="px-5 py-3 font-medium text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const sc = STATUS_CONFIG[req.status];
                  return (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                req.time_off_type?.color || '#6366f1',
                            }}
                          />
                          <span className="font-medium text-slate-700">
                            {req.time_off_type?.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                        {formatDate(req.start_date)}
                        {req.start_date !== req.end_date && (
                          <>
                            <ArrowRight className="inline w-3 h-3 mx-1 text-slate-400" />
                            {formatDate(req.end_date)}
                          </>
                        )}
                        {!req.all_day && req.start_time && (
                          <span className="ml-1 text-xs text-slate-400">
                            {req.start_time}–{req.end_time}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center font-medium text-slate-700">
                        {req.amount} {req.hourly ? 'godz.' : 'dni'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(req.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(req.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Anuluj
                          </button>
                        )}
                        {req.status === 'rejected' && req.note_reviewer && (
                          <span
                            className="text-xs text-slate-400 cursor-help"
                            title={`Powód: ${req.note_reviewer}`}
                          >
                            <AlertTriangle className="inline w-3.5 h-3.5" />
                          </span>
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

      {/* ================================================================= */}
      {/* New Request Modal */}
      {/* ================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                Nowy wniosek urlopowy
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* body */}
            <div className="px-6 py-5 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Typ urlopu
                </label>
                <select
                  value={formTypeId}
                  onChange={(e) => setFormTypeId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data rozpoczęcia
                  </label>
                  <input
                    type="date"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data zakończenia
                  </label>
                  <input
                    type="date"
                    value={formEnd}
                    min={formStart || undefined}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* All day checkbox */}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAllDay}
                    onChange={(e) => setFormAllDay(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <span className="text-sm text-slate-700">Cały dzień</span>
              </div>

              {/* Time inputs (when not all day) */}
              {!formAllDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Godzina rozpoczęcia
                    </label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Godzina zakończenia
                    </label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Calculated amount */}
              {formStart && formEnd && (
                <div className="bg-indigo-50 rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-indigo-700 font-medium">
                    Obliczona ilość:
                  </span>
                  <span className="text-lg font-bold text-indigo-700">
                    {calculatedAmount}{' '}
                    {!formAllDay && selectedType?.allows_hourly ? 'godz.' : 'dni roboczych'}
                  </span>
                </div>
              )}

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Komentarz (opcjonalnie)
                </label>
                <textarea
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  rows={3}
                  placeholder="Dodatkowe informacje..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  submitting || !formTypeId || !formStart || !formEnd || calculatedAmount <= 0
                }
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Złóż wniosek
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeTimeOffPage;
