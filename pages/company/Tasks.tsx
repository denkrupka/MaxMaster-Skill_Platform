
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, X, Search, Filter, LayoutGrid, List, ClipboardList, Play, Eye,
  CheckCircle2, Calendar, Clock, Timer, Tag, FolderKanban, ArrowRight,
  Loader2, ChevronDown, CheckSquare, AlertCircle, User
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  ProjectTask, Project, TaskTimeLog, TaskStatus_Project, TaskPriority
} from '../../types';
import { SectionTabs } from '../../components/SectionTabs';

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

const emptyTaskForm = {
  title: '', description: '', project_id: '', assigned_to: '',
  priority: 'medium' as TaskPriority, due_date: '', estimated_hours: '', tags: '',
};

export const CompanyTasksPage: React.FC = () => {
  const { state, setState } = useAppContext();
  const { currentUser, users } = state;

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [filterProject, setFilterProject] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus_Project | ''>('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('');
  const [filterDueDateFrom, setFilterDueDateFrom] = useState('');
  const [filterDueDateTo, setFilterDueDateTo] = useState('');
  const [search, setSearch] = useState('');

  // Create task modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [savingTask, setSavingTask] = useState(false);

  // Task detail panel
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [taskTimeLogs, setTaskTimeLogs] = useState<TaskTimeLog[]>([]);

  // Bulk selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false);

  // Move dropdown
  const [moveDropdownTaskId, setMoveDropdownTaskId] = useState<string | null>(null);

  const companyUsers = useMemo(() =>
    users.filter(u => u.company_id === currentUser?.company_id && u.status === 'active'),
    [users, currentUser]
  );

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
          .eq('company_id', currentUser.company_id)
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
  };

  const closeDetail = () => {
    setSelectedTask(null);
    setTaskTimeLogs([]);
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

  const bulkChangeStatus = async (newStatus: TaskStatus_Project) => {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'done') updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;

    const { error } = await supabase.from('project_tasks').update(updates).in('id', ids);
    if (!error) {
      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...updates } : t));
      setSelectedTaskIds(new Set());
      setState(prev => ({ ...prev, toast: { title: 'Sukces', message: `Zaktualizowano ${ids.length} zadań` } }));
    }
    setShowBulkStatusMenu(false);
  };

  const createTask = async () => {
    if (!currentUser || !taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const { data, error } = await supabase.from('project_tasks').insert({
        company_id: currentUser.company_id,
        project_id: taskForm.project_id || null,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        assigned_to: taskForm.assigned_to || null,
        priority: taskForm.priority,
        status: 'todo' as TaskStatus_Project,
        due_date: taskForm.due_date || null,
        estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : null,
        tags: taskForm.tags ? taskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        is_archived: false,
        created_by: currentUser.id,
      }).select().single();

      if (!error && data) {
        setTasks(prev => [data, ...prev]);
        setTaskForm(emptyTaskForm);
        setShowCreateModal(false);
        setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Zadanie zostało utworzone' } }));
      }
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setSavingTask(false);
    }
  };

  const getUserName = (userId?: string) => {
    if (!userId) return 'Nieprzypisany';
    const u = users.find(u => u.id === userId);
    return u ? `${u.first_name} ${u.last_name}` : 'Nieznany';
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'Bez projektu';
    return projects.find(p => p.id === projectId)?.name || 'Nieznany';
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterProject && t.project_id !== filterProject) return false;
      if (filterEmployee && t.assigned_to !== filterEmployee) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterDueDateFrom && t.due_date && t.due_date < filterDueDateFrom) return false;
      if (filterDueDateTo && t.due_date && t.due_date > filterDueDateTo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.title.toLowerCase().includes(s) && !t.description?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [tasks, filterProject, filterEmployee, filterStatus, filterPriority, filterDueDateFrom, filterDueDateTo, search]);

  const hasActiveFilters = filterProject || filterEmployee || filterStatus || filterPriority || filterDueDateFrom || filterDueDateTo || search;

  const clearFilters = () => {
    setFilterProject('');
    setFilterEmployee('');
    setFilterStatus('');
    setFilterPriority('');
    setFilterDueDateFrom('');
    setFilterDueDateTo('');
    setSearch('');
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  if (!currentUser) return null;

  const renderPriorityBadge = (priority: TaskPriority) => {
    const cfg = PRIORITY_CONFIG[priority];
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
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
              onClick={(e) => { e.stopPropagation(); setMoveDropdownTaskId(moveDropdownTaskId === task.id ? null : task.id); }}
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
                    {col.icon} {col.label}
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
              <FolderKanban className="w-3 h-3 mr-1" />{getProjectName(task.project_id)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {task.assigned_to && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />{getUserName(task.assigned_to).split(' ')[0]}
            </span>
          )}
          {task.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
              <Calendar className="w-3 h-3" />{new Date(task.due_date).toLocaleDateString('pl-PL')}
            </span>
          )}
          {task.estimated_hours && (
            <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{task.estimated_hours}h</span>
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
              <span className="text-xs bg-white rounded-full px-2 py-0.5 text-gray-500 font-medium">{columnTasks.length}</span>
            </div>
            <div className="space-y-2">
              {columnTasks.map(renderTaskCard)}
              {columnTasks.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Brak zadań</p>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Bulk actions bar */}
      {selectedTaskIds.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-4">
          <span className="text-sm font-medium text-blue-700">
            Zaznaczono: {selectedTaskIds.size}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowBulkStatusMenu(!showBulkStatusMenu)}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Zmień status <ChevronDown className="w-3 h-3" />
            </button>
            {showBulkStatusMenu && (
              <div className="absolute left-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                {STATUS_COLUMNS.map(col => (
                  <button
                    key={col.key}
                    onClick={() => bulkChangeStatus(col.key)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                  >
                    {col.icon} {col.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setSelectedTaskIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Odznacz wszystko
          </button>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length}
                onChange={(e) => {
                  if (e.target.checked) setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
                  else setSelectedTaskIds(new Set());
                }}
                className="rounded border-gray-300"
              />
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zadanie</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Projekt</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Przypisany</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Priorytet</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Termin</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Godziny</th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.map(task => {
            const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
            return (
              <tr
                key={task.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedTaskIds.has(task.id) ? 'bg-blue-50' : ''}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.has(task.id)}
                    onChange={() => toggleTaskSelection(task.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => openTaskDetail(task)}>
                  <span className="text-sm font-medium text-gray-900 hover:text-blue-600">{task.title}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{getProjectName(task.project_id)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{getUserName(task.assigned_to)}</td>
                <td className="px-4 py-3">
                  <select
                    value={task.status}
                    onChange={(e) => changeTaskStatus(task.id, e.target.value as TaskStatus_Project)}
                    className="text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_COLUMNS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">{renderPriorityBadge(task.priority)}</td>
                <td className="px-4 py-3">
                  {task.due_date ? (
                    <span className={`text-sm ${overdue ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                      {new Date(task.due_date).toLocaleDateString('pl-PL')}
                    </span>
                  ) : <span className="text-sm text-gray-400">-</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {task.estimated_hours ? `${task.estimated_hours}h` : '-'}
                </td>
              </tr>
            );
          })}
          {filteredTasks.length === 0 && (
            <tr><td colSpan={8} className="text-center py-12 text-gray-400">Brak zadań do wyświetlenia</td></tr>
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
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Status</label>
                <select
                  value={selectedTask.status}
                  onChange={(e) => changeTaskStatus(selectedTask.id, e.target.value as TaskStatus_Project)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_COLUMNS.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Priorytet</label>
                <div className="mt-1">{renderPriorityBadge(selectedTask.priority)}</div>
              </div>
            </div>

            {selectedTask.description && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Opis</label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{selectedTask.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Projekt</label>
                <p className="text-sm text-gray-700">{getProjectName(selectedTask.project_id)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Przypisany do</label>
                <p className="text-sm text-gray-700">{getUserName(selectedTask.assigned_to)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Termin</label>
                <p className={`text-sm ${overdue ? 'text-red-500 font-medium' : 'text-gray-700'}`}>
                  {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('pl-PL') : 'Nie ustalono'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Szacowane godziny</label>
                <p className="text-sm text-gray-700">{selectedTask.estimated_hours ? `${selectedTask.estimated_hours}h` : '-'}</p>
              </div>
            </div>

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
              <label className="text-xs font-medium text-gray-500 uppercase mb-3 block">
                Zalogowany czas ({Math.round(taskTimeLogs.reduce((s, l) => s + l.minutes, 0) / 60 * 10) / 10}h)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {taskTimeLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{getUserName(log.user_id)}</span>
                      <span className="text-gray-500 ml-2">{log.minutes} min</span>
                      {log.description && <span className="text-gray-400 ml-2">- {log.description}</span>}
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
      <SectionTabs section="projekty" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zadania firmy</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tasks.length} zadań łącznie | {filteredTasks.length} widocznych
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-sm ${viewMode === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { setTaskForm(emptyTaskForm); setShowCreateModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nowe zadanie
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtry</span>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800 ml-2">
              Wyczyść filtry
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Wszystkie projekty</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Wszyscy pracownicy</option>
            {companyUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TaskStatus_Project | '')}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Wszystkie statusy</option>
            {STATUS_COLUMNS.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as TaskPriority | '')}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Wszystkie priorytety</option>
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
          </select>
          <div className="flex gap-1">
            <input
              type="date"
              value={filterDueDateFrom}
              onChange={(e) => setFilterDueDateFrom(e.target.value)}
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              title="Termin od"
            />
            <input
              type="date"
              value={filterDueDateTo}
              onChange={(e) => setFilterDueDateTo(e.target.value)}
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              title="Termin do"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : viewMode === 'kanban' ? renderKanban() : renderListView()}

      {/* Detail Panel */}
      {renderDetailPanel()}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Nowe zadanie</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tytuł *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Nazwa zadania"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Opis</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Opis zadania..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Projekt</label>
                <select
                  value={taskForm.project_id}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, project_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Bez projektu --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Przypisz do</label>
                  <select
                    value={taskForm.assigned_to}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Nieprzypisany --</option>
                    {companyUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Priorytet</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Termin</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Szacowane godziny</label>
                  <input
                    type="number"
                    value={taskForm.estimated_hours}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, estimated_hours: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="np. 8"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tagi (oddzielone przecinkami)</label>
                <input
                  type="text"
                  value={taskForm.tags}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, tags: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="np. frontend, pilne, design"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Anuluj
              </button>
              <button
                onClick={createTask}
                disabled={savingTask || !taskForm.title.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingTask && <Loader2 className="w-4 h-4 animate-spin" />}
                Utwórz zadanie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
