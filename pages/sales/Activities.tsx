import React, { useState, useMemo } from 'react';
import {
  Plus, Search, Phone, Mail, Calendar, FileText, CheckSquare,
  Clock, CheckCircle, Building2, User, X, Filter, XCircle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CRMActivity, ActivityType } from '../../types';
import { ACTIVITY_TYPE_LABELS } from '../../constants';
import { supabase } from '../../lib/supabase';

interface TaskFormData {
  activity_type: ActivityType;
  subject: string;
  description: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number | '';
  crm_company_id: string;
  contact_id: string;
  deal_id: string;
}

const initialTaskForm: TaskFormData = {
  activity_type: ActivityType.TASK,
  subject: '',
  description: '',
  scheduled_date: '',
  scheduled_time: '',
  duration_minutes: '',
  crm_company_id: '',
  contact_id: '',
  deal_id: ''
};

export const SalesActivities: React.FC = () => {
  const { state, setState, refreshData } = useAppContext();
  const { crmActivities, crmCompanies, crmContacts, crmDeals } = state;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [selectedActivity, setSelectedActivity] = useState<CRMActivity | null>(null);

  // Task creation/edit modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormData>(initialTaskForm);
  const [isSaving, setIsSaving] = useState(false);

  // Filter activities
  const filteredActivities = useMemo(() => {
    const now = new Date();
    return crmActivities
      .filter(a => {
        const matchesSearch =
          a.subject.toLowerCase().includes(search.toLowerCase()) ||
          a.description?.toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === 'all' || a.activity_type === typeFilter;
        const matchesStatus = statusFilter === 'all' ||
          (statusFilter === 'completed' && a.is_completed) ||
          (statusFilter === 'upcoming' && !a.is_completed);
        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        // Upcoming first, then by date
        if (!a.is_completed && b.is_completed) return -1;
        if (a.is_completed && !b.is_completed) return 1;
        const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
        const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
        return dateA - dateB;
      });
  }, [crmActivities, search, typeFilter, statusFilter]);

  // Get company by ID
  const getCompany = (companyId?: string) => {
    return crmCompanies.find(c => c.id === companyId);
  };

  // Get contact by ID
  const getContact = (contactId?: string) => {
    return crmContacts.find(c => c.id === contactId);
  };

  // Get deal by ID
  const getDeal = (dealId?: string) => {
    return crmDeals.find(d => d.id === dealId);
  };

  // Get activity icon
  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case ActivityType.CALL: return <Phone className="w-4 h-4" />;
      case ActivityType.EMAIL: return <Mail className="w-4 h-4" />;
      case ActivityType.MEETING: return <Calendar className="w-4 h-4" />;
      case ActivityType.NOTE: return <FileText className="w-4 h-4" />;
      case ActivityType.TASK: return <CheckSquare className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  // Get activity type color
  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case ActivityType.CALL: return 'bg-green-100 text-green-600';
      case ActivityType.EMAIL: return 'bg-blue-100 text-blue-600';
      case ActivityType.MEETING: return 'bg-purple-100 text-purple-600';
      case ActivityType.NOTE: return 'bg-slate-100 text-slate-600';
      case ActivityType.TASK: return 'bg-amber-100 text-amber-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    if (isToday) {
      return `Dziś, ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (isTomorrow) {
      return `Jutro, ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = crmActivities.filter(a => !a.is_completed).length;
    const overdue = crmActivities.filter(a => !a.is_completed && a.scheduled_at && new Date(a.scheduled_at) < now).length;
    const todayActivities = crmActivities.filter(a => {
      if (!a.scheduled_at) return false;
      return new Date(a.scheduled_at).toDateString() === now.toDateString();
    }).length;
    return { upcoming, overdue, todayActivities, total: crmActivities.length };
  }, [crmActivities]);

  // Get filtered contacts based on selected company
  const filteredContacts = useMemo(() => {
    if (!taskForm.crm_company_id) return crmContacts;
    return crmContacts.filter(c => c.crm_company_id === taskForm.crm_company_id);
  }, [crmContacts, taskForm.crm_company_id]);

  // Get filtered deals based on selected company
  const filteredDeals = useMemo(() => {
    if (!taskForm.crm_company_id) return crmDeals;
    return crmDeals.filter(d => d.crm_company_id === taskForm.crm_company_id);
  }, [crmDeals, taskForm.crm_company_id]);

  // Open task creation modal
  const openCreateModal = () => {
    setTaskForm(initialTaskForm);
    setIsEditing(false);
    setEditingActivityId(null);
    setShowTaskModal(true);
  };

  // Open task edit modal
  const openEditModal = (activity: CRMActivity) => {
    const scheduledDate = activity.scheduled_at
      ? new Date(activity.scheduled_at).toISOString().split('T')[0]
      : '';
    const scheduledTime = activity.scheduled_at
      ? new Date(activity.scheduled_at).toTimeString().slice(0, 5)
      : '';

    setTaskForm({
      activity_type: activity.activity_type,
      subject: activity.subject,
      description: activity.description || '',
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      duration_minutes: activity.duration_minutes || '',
      crm_company_id: activity.crm_company_id || '',
      contact_id: activity.contact_id || '',
      deal_id: activity.deal_id || ''
    });
    setIsEditing(true);
    setEditingActivityId(activity.id);
    setSelectedActivity(null);
    setShowTaskModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowTaskModal(false);
    setTaskForm(initialTaskForm);
    setIsEditing(false);
    setEditingActivityId(null);
  };

  // Handle form submission
  const handleSubmitTask = async () => {
    if (!taskForm.subject.trim()) return;

    setIsSaving(true);
    try {
      const scheduledAt = taskForm.scheduled_date && taskForm.scheduled_time
        ? new Date(`${taskForm.scheduled_date}T${taskForm.scheduled_time}`).toISOString()
        : taskForm.scheduled_date
        ? new Date(`${taskForm.scheduled_date}T00:00`).toISOString()
        : null;

      if (isEditing && editingActivityId) {
        // Update existing activity - don't change is_completed or created_by
        const updateData = {
          activity_type: taskForm.activity_type,
          subject: taskForm.subject.trim(),
          description: taskForm.description.trim() || null,
          scheduled_at: scheduledAt,
          duration_minutes: taskForm.duration_minutes ? Number(taskForm.duration_minutes) : null,
          crm_company_id: taskForm.crm_company_id || null,
          contact_id: taskForm.contact_id || null,
          deal_id: taskForm.deal_id || null,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('crm_activities')
          .update(updateData)
          .eq('id', editingActivityId)
          .select()
          .single();

        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }

        setState(prev => ({
          ...prev,
          crmActivities: prev.crmActivities.map(a =>
            a.id === editingActivityId ? data : a
          )
        }));
      } else {
        // Create new activity
        const insertData = {
          activity_type: taskForm.activity_type,
          subject: taskForm.subject.trim(),
          description: taskForm.description.trim() || null,
          scheduled_at: scheduledAt,
          duration_minutes: taskForm.duration_minutes ? Number(taskForm.duration_minutes) : null,
          crm_company_id: taskForm.crm_company_id || null,
          contact_id: taskForm.contact_id || null,
          deal_id: taskForm.deal_id || null,
          is_completed: false,
          created_by: state.currentUser?.id || null
        };

        const { data, error } = await supabase
          .from('crm_activities')
          .insert([insertData])
          .select()
          .single();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        setState(prev => ({
          ...prev,
          crmActivities: [...prev.crmActivities, data]
        }));
      }

      closeModal();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Wystąpił błąd podczas zapisywania zadania. Spróbuj ponownie.');
    } finally {
      setIsSaving(false);
    }
  };

  // Mark activity as completed
  const markAsCompleted = async (activity: CRMActivity) => {
    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', activity.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmActivities: prev.crmActivities.map(a =>
          a.id === activity.id ? data : a
        )
      }));
      setSelectedActivity(data);
    } catch (error) {
      console.error('Error marking activity as completed:', error);
    }
  };

  // Mark activity as not completed
  const markAsNotCompleted = async (activity: CRMActivity) => {
    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .update({
          is_completed: false,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', activity.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmActivities: prev.crmActivities.map(a =>
          a.id === activity.id ? data : a
        )
      }));
      setSelectedActivity(data);
    } catch (error) {
      console.error('Error marking activity as not completed:', error);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aktywności</h1>
          <p className="text-slate-500 mt-1">
            Zarządzanie zadaniami, spotkaniami i kontaktami
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nowe zadanie
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.upcoming}</p>
              <p className="text-xs text-slate-500">Zaplanowane</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.todayActivities}</p>
              <p className="text-xs text-slate-500">Na dziś</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.overdue > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
              <Clock className={`w-5 h-5 ${stats.overdue > 0 ? 'text-red-600' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.overdue}</p>
              <p className="text-xs text-slate-500">Przeterminowane</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{crmActivities.filter(a => a.is_completed).length}</p>
              <p className="text-xs text-slate-500">Ukończone</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj aktywności..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ActivityType | 'all')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie typy</option>
            <option value={ActivityType.CALL}>Rozmowy</option>
            <option value={ActivityType.EMAIL}>E-maile</option>
            <option value={ActivityType.MEETING}>Spotkania</option>
            <option value={ActivityType.TASK}>Zadania</option>
            <option value={ActivityType.NOTE}>Notatki</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'upcoming' | 'completed')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie</option>
            <option value="upcoming">Zaplanowane</option>
            <option value="completed">Ukończone</option>
          </select>
        </div>
      </div>

      {/* Activities List */}
      {filteredActivities.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredActivities.map(activity => {
              const company = getCompany(activity.crm_company_id);
              const contact = getContact(activity.contact_id);
              const deal = getDeal(activity.deal_id);
              const isOverdue = !activity.is_completed && activity.scheduled_at && new Date(activity.scheduled_at) < new Date();

              return (
                <div
                  key={activity.id}
                  onClick={() => setSelectedActivity(activity)}
                  className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${activity.is_completed ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.activity_type)}`}>
                      {getActivityIcon(activity.activity_type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`font-medium ${activity.is_completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {activity.subject}
                        </p>
                        {activity.is_completed && (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                        {isOverdue && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Przeterminowane</span>
                        )}
                      </div>

                      {activity.description && (
                        <p className="text-sm text-slate-500 truncate mb-2">{activity.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {activity.scheduled_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(activity.scheduled_at)}</span>
                          </div>
                        )}
                        {company && (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            <span>{company.name}</span>
                          </div>
                        )}
                        {contact && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{contact.first_name} {contact.last_name}</span>
                          </div>
                        )}
                        {deal && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                            {deal.title}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${getActivityColor(activity.activity_type)}`}>
                      {ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-xl">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {crmActivities.length === 0 ? 'Brak aktywności' : 'Brak aktywności spełniających kryteria'}
          </p>
          {crmActivities.length === 0 && (
            <button className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium">
              Dodaj pierwszą aktywność
            </button>
          )}
        </div>
      )}

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getActivityColor(selectedActivity.activity_type)}`}>
                  {getActivityIcon(selectedActivity.activity_type)}
                </div>
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getActivityColor(selectedActivity.activity_type)}`}>
                    {ACTIVITY_TYPE_LABELS[selectedActivity.activity_type] || selectedActivity.activity_type}
                  </span>
                  {selectedActivity.is_completed && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">
                      Ukończone
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">{selectedActivity.subject}</h3>

            {selectedActivity.description && (
              <p className="text-slate-600 mb-4">{selectedActivity.description}</p>
            )}

            <div className="space-y-3 mb-4">
              {selectedActivity.scheduled_at && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{formatDate(selectedActivity.scheduled_at)}</span>
                </div>
              )}

              {selectedActivity.duration_minutes && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">Przewidziany czas: {selectedActivity.duration_minutes} min</span>
                </div>
              )}

              {getCompany(selectedActivity.crm_company_id) && (
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{getCompany(selectedActivity.crm_company_id)?.name}</span>
                </div>
              )}

              {getContact(selectedActivity.contact_id) && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">
                    {getContact(selectedActivity.contact_id)?.first_name} {getContact(selectedActivity.contact_id)?.last_name}
                  </span>
                </div>
              )}

              {getDeal(selectedActivity.deal_id) && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">Powiązany deal</p>
                  <p className="font-medium text-blue-900">{getDeal(selectedActivity.deal_id)?.title}</p>
                </div>
              )}

              {selectedActivity.outcome && (
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Wynik / Notatki</p>
                  <p className="text-slate-700">{selectedActivity.outcome}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-100">
              {selectedActivity.is_completed ? (
                <button
                  onClick={() => markAsNotCompleted(selectedActivity)}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Oznacz jako nieukończone
                </button>
              ) : (
                <button
                  onClick={() => markAsCompleted(selectedActivity)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Oznacz jako ukończone
                </button>
              )}
              <button
                onClick={() => openEditModal(selectedActivity)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Edytuj
              </button>
              <button
                onClick={() => setSelectedActivity(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation/Edit Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {isEditing ? 'Edytuj zadanie' : 'Nowe zadanie'}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Task Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Typ zadania *
                </label>
                <select
                  value={taskForm.activity_type}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, activity_type: e.target.value as ActivityType }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={ActivityType.TASK}>Zadanie</option>
                  <option value={ActivityType.CALL}>Rozmowa telefoniczna</option>
                  <option value={ActivityType.EMAIL}>E-mail</option>
                  <option value={ActivityType.MEETING}>Spotkanie</option>
                  <option value={ActivityType.NOTE}>Notatka</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nazwa *
                </label>
                <input
                  type="text"
                  value={taskForm.subject}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Nazwa zadania"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Zadanie
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Opis zadania..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data wykonania
                  </label>
                  <input
                    type="date"
                    value={taskForm.scheduled_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Godzina wykonania
                  </label>
                  <input
                    type="time"
                    value={taskForm.scheduled_time}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Przewidziany czas na wykonanie (minuty)
                </label>
                <input
                  type="number"
                  value={taskForm.duration_minutes}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, duration_minutes: e.target.value ? parseInt(e.target.value) : '' }))}
                  placeholder="np. 30"
                  min="1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Powiązana firma
                </label>
                <select
                  value={taskForm.crm_company_id}
                  onChange={(e) => setTaskForm(prev => ({
                    ...prev,
                    crm_company_id: e.target.value,
                    contact_id: '', // Reset contact when company changes
                    deal_id: '' // Reset deal when company changes
                  }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Wybierz firmę...</option>
                  {crmCompanies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              {/* Contact */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Powiązany kontakt
                </label>
                <select
                  value={taskForm.contact_id}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, contact_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!taskForm.crm_company_id && filteredContacts.length === 0}
                >
                  <option value="">Wybierz kontakt...</option>
                  {filteredContacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Deal */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Powiązany deal
                </label>
                <select
                  value={taskForm.deal_id}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, deal_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!taskForm.crm_company_id && filteredDeals.length === 0}
                >
                  <option value="">Wybierz deal...</option>
                  {filteredDeals.map(deal => (
                    <option key={deal.id} value={deal.id}>{deal.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={handleSubmitTask}
                disabled={!taskForm.subject.trim() || isSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Zapisywanie...' : (isEditing ? 'Zapisz zmiany' : 'Dodaj zadanie')}
              </button>
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
