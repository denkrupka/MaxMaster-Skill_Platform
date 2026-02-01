
import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, LayoutGrid, List, Filter, X, Clock, Calendar, Tag,
  ChevronRight, ChevronDown, Plus, Play, Pause, CheckCircle2, Eye,
  AlertCircle, Timer, FolderKanban, ArrowRight, Loader2
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  ProjectTask, Project, TaskTimeLog, TaskStatus_Project, TaskPriority
} from '../../types';

const STATUS_COLUMNS: { key: TaskStatus_Project; label: string; color: string; icon: React.ReactNode }[] = [
  { key: 'todo', label: 'Do zrobienia', color: 'bg-slate-100 border-slate-300', icon: <ClipboardList className="w-4 h-4 text-slate-500" /> },
  { key: 'in_progress', label: 'W trakcie', color: 'bg-blue-50 border-blue-300', icon: <Play className="w-4 h-4 text-blue-500" /> },
  { key: 'review', label: 'Do przeglądu', color: 'bg-amber-50 border-amber-300', icon: <Eye className="w-4 h-4 text-amber-500" /> },
  { key: 'done', label: 'Gotowe', color: 'bg-green-50 border-green-300', icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; bg: string; text: string }> = {
  low: { label: 'Niski', bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { label: 'Średni', bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { label: 'Wysoki', bg: 'bg-orange-100', text: 'text-orange-700' },
  urgent: { label: 'Pilny', bg: 'bg-red-100', text: 'text-red-700' },
};

const STATUS_LABELS: Record<TaskStatus_Project, string> = {
  todo: 'Do zrobienia',
  in_progress: 'W trakcie',
  review: 'Do przeglądu',
  done: 'Gotowe',
  cancelled: 'Anulowane',
};

export const EmployeeTasksPage: React.FC = () => {
  const { state, setState } = useAppContext();
  const { currentUser } = state;

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [filterStatus, setFilterStatus] = useState<TaskStatus_Project | ''>('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('');
  const [filterProject, setFilterProject] = useState<string>('');

  // Detail panel
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [taskTimeLogs, setTaskTimeLogs] = useState<TaskTimeLog[]>([]);

  // Time log form
  const [showTimeLogForm, setShowTimeLogForm] = useState(false);
  const [timeLogForm, setTimeLogForm] = useState({ minutes: 0, description: '', date: new Date().toISOString().slice(0, 10) });
  const [savingTimeLog, setSavingTimeLog] = useState(false);

  // Move dropdown
  const [moveDropdownTaskId, setMoveDropdownTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        supabase
          .from('project_tasks')
          .select('*')
          .eq('assigned_to', currentUser.id)
          .eq('is_archived', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('*')
          .eq('company_id', currentUser.company_id),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTaskTimeLogs = async (taskId: string) => {
    const { data } = await supabase
      .from('task_time_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('date', { ascending: false });
    if (data) setTaskTimeLogs(data);
  };

  const openTaskDetail = (task: ProjectTask) => {
    setSelectedTask(task);
    loadTaskTimeLogs(task.id);
    setShowTimeLogForm(false);
  };

  const closeDetail = () => {
    setSelectedTask(null);
    setTaskTimeLogs([]);
    setShowTimeLogForm(false);
  };

  const changeTaskStatus = async (taskId: string, newStatus: TaskStatus_Project) => {
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'done') updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;

    const { error } = await supabase.from('project_tasks').update(updates).eq('id', taskId);
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      if (selectedTask?.id === taskId) setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }
    setMoveDropdownTaskId(null);
  };

  const submitTimeLog = async () => {
    if (!selectedTask || !currentUser || timeLogForm.minutes <= 0) return;
    setSavingTimeLog(true);
    try {
      const { data, error } = await supabase.from('task_time_logs').insert({
        company_id: currentUser.company_id,
        task_id: selectedTask.id,
        user_id: currentUser.id,
        date: timeLogForm.date,
        minutes: timeLogForm.minutes,
        description: timeLogForm.description || null,
      }).select().single();

      if (!error && data) {
        setTaskTimeLogs(prev => [data, ...prev]);
        setTimeLogForm({ minutes: 0, description: '', date: new Date().toISOString().slice(0, 10) });
        setShowTimeLogForm(false);
        const newTotal = (selectedTask.total_logged_minutes || 0) + timeLogForm.minutes;
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, total_logged_minutes: newTotal } : t));
        setSelectedTask(prev => prev ? { ...prev, total_logged_minutes: newTotal } : null);
        setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Czas został zalogowany' } }));
      }
    } catch (err) {
      console.error('Error logging time:', err);
    } finally {
      setSavingTimeLog(false);
    }
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'Bez projektu';
    return projects.find(p => p.id === projectId)?.name || 'Nieznany projekt';
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterProject && t.project_id !== filterProject) return false;
      return true;
    });
  }, [tasks, filterStatus, filterPriority, filterProject]);

  const hasActiveFilters = filterStatus || filterPriority || filterProject;

  const clearFilters = () => {
    setFilterStatus('');
    setFilterPriority('');
    setFilterProject('');
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && !['done', 'cancelled'].includes('');
  };

  if (!currentUser) return null;

  const renderPriorityBadge = (priority: TaskPriority) => {
    const cfg = PRIORITY_CONFIG[priority];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
    );
  };

  const renderTaskCard = (task: ProjectTask) => {
    const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
    return (
      <div
        key={task.id}
        onClick={() => openTaskDetail(task)}
        className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow relative group"
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900 leading-tight flex-1 pr-2">{task.title}</h4>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMoveDropdownTaskId(moveDropdownTaskId === task.id ? null : task.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 transition-opacity"
              title="Zmień status"
            >
              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {moveDropdownTaskId === task.id && (
              <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                {STATUS_COLUMNS.map(col => (
                  <button
                    key={col.key}
                    onClick={(e) => { e.stopPropagation(); changeTaskStatus(task.id, col.key); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${task.status === col.key ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                  >
                    {col.icon}
                    {col.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {renderPriorityBadge(task.priority)}
          {task.project_id && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-600">
              <FolderKanban className="w-3 h-3 mr-1" />
              {getProjectName(task.project_id)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {task.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
              <Calendar className="w-3 h-3" />
              {new Date(task.due_date).toLocaleDateString('pl-PL')}
            </span>
          )}
          {task.estimated_hours && (
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {task.estimated_hours}h
            </span>
          )}
          {(task.total_logged_minutes || 0) > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <Clock className="w-3 h-3" />
              {Math.round((task.total_logged_minutes || 0) / 60 * 10) / 10}h
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderKanban = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {STATUS_COLUMNS.map(col => {
        const columnTasks = filteredTasks.filter(t => t.status === col.key);
        return (
          <div key={col.key} className={`rounded-xl border-2 ${col.color} p-3 min-h-[300px]`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                {col.icon}
                <h3 className="font-semibold text-sm text-gray-700">{col.label}</h3>
              </div>
              <span className="text-xs bg-white rounded-full px-2 py-0.5 text-gray-500 font-medium">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnTasks.map(renderTaskCard)}
              {columnTasks.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">Brak zadań</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zadanie</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Projekt</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Priorytet</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Termin</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Czas</th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.map(task => {
            const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
            return (
              <tr
                key={task.id}
                onClick={() => openTaskDetail(task)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-gray-900">{task.title}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">{getProjectName(task.project_id)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{STATUS_LABELS[task.status]}</span>
                </td>
                <td className="px-4 py-3">{renderPriorityBadge(task.priority)}</td>
                <td className="px-4 py-3">
                  {task.due_date ? (
                    <span className={`text-sm ${overdue ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                      {new Date(task.due_date).toLocaleDateString('pl-PL')}
                    </span>
                  ) : <span className="text-sm text-gray-400">-</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">
                    {task.estimated_hours ? `${task.estimated_hours}h` : '-'}
                    {(task.total_logged_minutes || 0) > 0 && (
                      <span className="text-green-600 ml-1">({Math.round((task.total_logged_minutes || 0) / 60 * 10) / 10}h)</span>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
          {filteredTasks.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-12 text-gray-400">
                Brak zadań do wyświetlenia
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderDetailPanel = () => {
    if (!selectedTask) return null;
    const overdue = selectedTask.due_date && new Date(selectedTask.due_date) < new Date() && selectedTask.status !== 'done';

    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/30" onClick={closeDetail} />
        <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">{selectedTask.title}</h2>
            <button onClick={closeDetail} className="p-1 rounded hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Status</label>
                <select
                  value={selectedTask.status}
                  onChange={(e) => changeTaskStatus(selectedTask.id, e.target.value as TaskStatus_Project)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_COLUMNS.map(col => (
                    <option key={col.key} value={col.key}>{col.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Priorytet</label>
                <div className="mt-1">{renderPriorityBadge(selectedTask.priority)}</div>
              </div>
            </div>

            {/* Description */}
            {selectedTask.description && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Opis</label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{selectedTask.description}</p>
              </div>
            )}

            {/* Project */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Projekt</label>
              <p className="text-sm text-gray-700">{getProjectName(selectedTask.project_id)}</p>
            </div>

            {/* Due date & Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Termin</label>
                <p className={`text-sm ${overdue ? 'text-red-500 font-medium' : 'text-gray-700'}`}>
                  {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('pl-PL') : 'Nie ustalono'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Szacowane godziny</label>
                <p className="text-sm text-gray-700">{selectedTask.estimated_hours ? `${selectedTask.estimated_hours}h` : 'Nie ustalono'}</p>
              </div>
            </div>

            {/* Tags */}
            {selectedTask.tags && selectedTask.tags.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Tagi</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedTask.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                      <Tag className="w-3 h-3 mr-1" />{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Time Logs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-gray-500 uppercase">Zalogowany czas</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-600">
                    {Math.round((selectedTask.total_logged_minutes || taskTimeLogs.reduce((s, l) => s + l.minutes, 0)) / 60 * 10) / 10}h
                  </span>
                  <button
                    onClick={() => setShowTimeLogForm(!showTimeLogForm)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Zaloguj czas
                  </button>
                </div>
              </div>

              {showTimeLogForm && (
                <div className="bg-blue-50 rounded-lg p-4 mb-3 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Minuty *</label>
                    <input
                      type="number"
                      min={1}
                      value={timeLogForm.minutes || ''}
                      onChange={(e) => setTimeLogForm(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="np. 30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Opis</label>
                    <input
                      type="text"
                      value={timeLogForm.description}
                      onChange={(e) => setTimeLogForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="Co zostało zrobione..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Data</label>
                    <input
                      type="date"
                      value={timeLogForm.date}
                      onChange={(e) => setTimeLogForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowTimeLogForm(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={submitTimeLog}
                      disabled={savingTimeLog || timeLogForm.minutes <= 0}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {savingTimeLog && <Loader2 className="w-3 h-3 animate-spin" />}
                      Zapisz
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {taskTimeLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{log.minutes} min</span>
                      {log.description && <span className="text-gray-500 ml-2">- {log.description}</span>}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(log.date).toLocaleDateString('pl-PL')}</span>
                  </div>
                ))}
                {taskTimeLogs.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-3">Brak wpisów czasu</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moje zadania</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tasks.length} {tasks.length === 1 ? 'zadanie' : tasks.length < 5 ? 'zadania' : 'zadań'} przypisanych do Ciebie
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TaskStatus_Project | '')}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Wszystkie statusy</option>
          {STATUS_COLUMNS.map(col => (
            <option key={col.key} value={col.key}>{col.label}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | '')}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Wszystkie priorytety</option>
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Wszystkie projekty</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <X className="w-3 h-3" /> Wyczyść filtry
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : viewMode === 'kanban' ? renderKanban() : renderListView()}

      {/* Detail Panel */}
      {renderDetailPanel()}
    </div>
  );
};
