import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Reminder {
  id: string;
  document_id: string;
  reminder_date: string;
  reminder_type: 'email' | 'notification' | 'both';
  message: string;
  is_sent: boolean;
  created_at: string;
}

interface DocumentRemindersProps {
  documentId: string;
  companyId: string;
  userId: string;
}

export const DocumentReminders: React.FC<DocumentRemindersProps> = ({
  documentId,
  companyId,
  userId,
}) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newReminder, setNewReminder] = useState({
    reminder_date: '',
    reminder_type: 'email' as const,
    message: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadReminders();
  }, [documentId]);

  const loadReminders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('document_reminders')
      .select('*')
      .eq('document_id', documentId)
      .order('reminder_date', { ascending: true });
    
    setReminders(data || []);
    setLoading(false);
  };

  const addReminder = async () => {
    if (!newReminder.reminder_date) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('document_reminders').insert({
        document_id: documentId,
        company_id: companyId,
        created_by: userId,
        reminder_date: new Date(newReminder.reminder_date).toISOString(),
        reminder_type: newReminder.reminder_type,
        message: newReminder.message,
        is_sent: false,
      });

      if (error) throw error;

      setShowAdd(false);
      setNewReminder({ reminder_date: '', reminder_type: 'email', message: '' });
      loadReminders();
    } catch (err: any) {
      alert('Błąd: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteReminder = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć to przypomnienie?')) return;
    
    await supabase.from('document_reminders').delete().eq('id', id);
    loadReminders();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return '';
      case 'notification': return '🔔';
      case 'both': return '🔔';
      default: return '🔔';
    }
  };

  const upcomingReminders = reminders.filter(r => !r.is_sent && new Date(r.reminder_date) > new Date());
  const pastReminders = reminders.filter(r => r.is_sent || new Date(r.reminder_date) <= new Date());

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-slate-700">Przypomnienia</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" />
          Dodaj
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-50 rounded-lg p-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Data przypomnienia
            </label>
            <input
              type="datetime-local"
              value={newReminder.reminder_date}
              onChange={(e) => setNewReminder({ ...newReminder, reminder_date: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Typ powiadomienia
            </label>
            <select
              value={newReminder.reminder_type}
              onChange={(e) => setNewReminder({ ...newReminder, reminder_type: e.target.value as any })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="email">Email</option>
              <option value="notification">Powiadomienie</option>
              <option value="both">Email + Powiadomienie</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Wiadomość (opcjonalnie)
            </label>
            <input
              type="text"
              value={newReminder.message}
              onChange={(e) => setNewReminder({ ...newReminder, message: e.target.value })}
              placeholder="Np. Sprawdź termin płatności"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg"
            >
              Anuluj
            </button>
            <button
              onClick={addReminder}
              disabled={saving || !newReminder.reminder_date}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Zapisz'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-6 text-slate-400">
          <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Brak przypomnień</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingReminders.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Nadchodzące</p>
              <div className="space-y-1">
                {upcomingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-2 bg-blue-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span>{getTypeIcon(reminder.reminder_type)}</span>
                      <div>
                        <p className="text-sm">
                          {new Date(reminder.reminder_date).toLocaleString('pl-PL')}
                        </p>
                        {reminder.message && (
                          <p className="text-xs text-slate-500">{reminder.message}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastReminders.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Wysłane / Przeszłe</p>
              <div className="space-y-1">
                {pastReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      <span>{getTypeIcon(reminder.reminder_type)}</span>
                      <div>
                        <p className="text-sm">
                          {new Date(reminder.reminder_date).toLocaleString('pl-PL')}
                        </p>
                        {reminder.is_sent && (
                          <span className="text-xs text-green-600">✓ Wysłane</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentReminders;
