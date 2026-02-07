import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, ChevronRight, ChevronDown, Calendar, Clock, Users,
  Plus, Settings, Download, Loader2, ZoomIn, ZoomOut, Filter,
  ChevronLeft, Link as LinkIcon, Milestone, Search, X, Save,
  Pencil, Trash2, Flag
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Project, GanttTask, GanttDependency, GanttDependencyType } from '../../types';
import { GANTT_DEPENDENCY_LABELS, GANTT_DEPENDENCY_SHORT_LABELS } from '../../constants';

type ZoomLevel = 'day' | 'week' | 'month';

interface GanttTaskWithChildren extends GanttTask {
  children?: GanttTaskWithChildren[];
  isExpanded?: boolean;
  level?: number;
}

export const GanttPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, users } = state;

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<GanttTaskWithChildren[]>([]);
  const [dependencies, setDependencies] = useState<GanttDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week');
  const [showMilestones, setShowMilestones] = useState(true);
  const [showDependencies, setShowDependencies] = useState(true);

  // Modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [saving, setSaving] = useState(false);

  // Task form
  const [taskForm, setTaskForm] = useState({
    title: '',
    parent_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    duration_days: 1,
    progress: 0,
    color: '#3b82f6',
    is_milestone: false,
    assigned_to_id: ''
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) loadProjects();
  }, [currentUser]);

  useEffect(() => {
    if (selectedProject) loadGanttData();
  }, [selectedProject]);

  const loadProjects = async () => {
    if (!currentUser) return;
    try {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false });
      if (data) setProjects(data);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGanttData = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const [tasksRes, depsRes] = await Promise.all([
        supabase
          .from('gantt_tasks')
          .select('*, estimate_task:estimate_tasks(*), ticket:tickets(*), assigned_to:users(*)')
          .eq('project_id', selectedProject.id)
          .order('sort_order'),
        supabase
          .from('gantt_dependencies')
          .select('*')
          .eq('project_id', selectedProject.id)
      ]);

      const tasksData = tasksRes.data || [];
      const taskTree = buildTaskTree(tasksData);
      setTasks(taskTree);
      setDependencies(depsRes.data || []);
    } catch (err) {
      console.error('Error loading gantt data:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildTaskTree = (tasksData: GanttTask[]): GanttTaskWithChildren[] => {
    const taskMap = new Map<string, GanttTaskWithChildren>();
    tasksData.forEach(task => {
      taskMap.set(task.id, {
        ...task,
        children: [],
        isExpanded: true,
        level: 0
      });
    });

    tasksData.forEach(task => {
      if (task.parent_id && taskMap.has(task.parent_id)) {
        const parent = taskMap.get(task.parent_id)!;
        const child = taskMap.get(task.id)!;
        child.level = (parent.level || 0) + 1;
        parent.children!.push(child);
      }
    });

    return tasksData
      .filter(t => !t.parent_id)
      .map(t => taskMap.get(t.id)!);
  };

  const flattenTasks = (tasks: GanttTaskWithChildren[], result: GanttTaskWithChildren[] = []): GanttTaskWithChildren[] => {
    tasks.forEach(task => {
      result.push(task);
      if (task.isExpanded && task.children && task.children.length > 0) {
        flattenTasks(task.children, result);
      }
    });
    return result;
  };

  const flatTasks = useMemo(() => flattenTasks(tasks), [tasks]);

  const dateRange = useMemo(() => {
    const allTasks = flatTasks.filter(t => t.start_date && t.end_date);
    if (allTasks.length === 0) {
      const today = new Date();
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 2, 0)
      };
    }

    const starts = allTasks.map(t => new Date(t.start_date!));
    const ends = allTasks.map(t => new Date(t.end_date!));
    const minDate = new Date(Math.min(...starts.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...ends.map(d => d.getTime())));

    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    return { start: minDate, end: maxDate };
  }, [flatTasks]);

  const toggleTaskExpand = (taskId: string) => {
    const toggle = (items: GanttTaskWithChildren[]): GanttTaskWithChildren[] =>
      items.map(item => ({
        ...item,
        isExpanded: item.id === taskId ? !item.isExpanded : item.isExpanded,
        children: item.children ? toggle(item.children) : undefined
      }));
    setTasks(toggle(tasks));
  };

  const getTaskTitle = (task: GanttTaskWithChildren): string => {
    if (task.title) return task.title;
    if (task.estimate_task) return (task.estimate_task as any).name;
    if (task.ticket) return (task.ticket as any).title;
    return 'Bez nazwy';
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  };

  const getDaysBetween = (start: Date, end: Date) => {
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const dayWidth = zoomLevel === 'day' ? 40 : zoomLevel === 'week' ? 20 : 8;
  const totalDays = getDaysBetween(dateRange.start, dateRange.end);
  const chartWidth = totalDays * dayWidth;

  const getTaskPosition = (task: GanttTaskWithChildren) => {
    if (!task.start_date || !task.end_date) return { left: 0, width: 0 };
    const startDays = getDaysBetween(dateRange.start, new Date(task.start_date));
    const duration = getDaysBetween(new Date(task.start_date), new Date(task.end_date));
    return {
      left: startDays * dayWidth,
      width: Math.max(duration * dayWidth, dayWidth)
    };
  };

  // Task CRUD
  const handleSaveTask = async () => {
    if (!currentUser || !selectedProject || !taskForm.title) return;
    setSaving(true);
    try {
      // Calculate end date from duration if not set
      let endDate = taskForm.end_date;
      if (!endDate && taskForm.start_date && taskForm.duration_days) {
        const start = new Date(taskForm.start_date);
        start.setDate(start.getDate() + taskForm.duration_days);
        endDate = start.toISOString().split('T')[0];
      }

      const data = {
        project_id: selectedProject.id,
        title: taskForm.title,
        parent_id: taskForm.parent_id || null,
        start_date: taskForm.start_date,
        end_date: endDate,
        duration_days: taskForm.duration_days,
        progress: taskForm.progress,
        color: taskForm.color,
        is_milestone: taskForm.is_milestone,
        assigned_to_id: taskForm.assigned_to_id || null,
        sort_order: flatTasks.length
      };

      if (editingTask) {
        await supabase
          .from('gantt_tasks')
          .update(data)
          .eq('id', editingTask.id);
      } else {
        await supabase.from('gantt_tasks').insert(data);
      }

      setShowTaskModal(false);
      setEditingTask(null);
      resetTaskForm();
      await loadGanttData();
    } catch (err) {
      console.error('Error saving task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (task: GanttTask) => {
    if (!confirm('Czy na pewno chcesz usunąć to zadanie?')) return;
    try {
      await supabase
        .from('gantt_tasks')
        .delete()
        .eq('id', task.id);
      await loadGanttData();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleUpdateProgress = async (task: GanttTask, progress: number) => {
    try {
      await supabase
        .from('gantt_tasks')
        .update({ progress })
        .eq('id', task.id);
      await loadGanttData();
    } catch (err) {
      console.error('Error updating progress:', err);
    }
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      parent_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      duration_days: 1,
      progress: 0,
      color: '#3b82f6',
      is_milestone: false,
      assigned_to_id: ''
    });
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : '';
  };

  // Project selection
  if (!selectedProject) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Harmonogram Gantta</h1>
          <p className="text-slate-600 mt-1">Wybierz projekt, aby wyświetlić harmonogram</p>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj projektu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects
            .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
            .map(project => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: project.color + '20' }}
                  >
                    <Calendar className="w-5 h-5" style={{ color: project.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600">
                      {project.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {project.start_date && project.end_date
                        ? `${formatDate(project.start_date)} - ${formatDate(project.end_date)}`
                        : 'Brak dat'
                      }
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                </div>
              </button>
            ))}
        </div>
      </div>
    );
  }

  // Gantt view
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-4">
        <button
          onClick={() => setSelectedProject(null)}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{selectedProject.name}</h1>
          <p className="text-sm text-slate-500">Harmonogram projektu • {flatTasks.length} zadań</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel('day')}
            className={`px-3 py-1.5 text-sm rounded-lg ${zoomLevel === 'day' ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'}`}
          >
            Dzień
          </button>
          <button
            onClick={() => setZoomLevel('week')}
            className={`px-3 py-1.5 text-sm rounded-lg ${zoomLevel === 'week' ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'}`}
          >
            Tydzień
          </button>
          <button
            onClick={() => setZoomLevel('month')}
            className={`px-3 py-1.5 text-sm rounded-lg ${zoomLevel === 'month' ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'}`}
          >
            Miesiąc
          </button>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-lg">
          <Download className="w-5 h-5 text-slate-600" />
        </button>
        <button
          onClick={() => {
            resetTaskForm();
            setEditingTask(null);
            setShowTaskModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Dodaj zadanie
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : flatTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">Brak zadań w harmonogramie</p>
            <button
              onClick={() => {
                resetTaskForm();
                setShowTaskModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Dodaj pierwsze zadanie
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Task list */}
          <div className="w-96 flex-shrink-0 border-r border-slate-200 bg-white overflow-auto">
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 p-3 font-medium text-sm text-slate-600 flex items-center">
              <span className="flex-1">Zadania</span>
              <span className="w-16 text-center">Postęp</span>
              <span className="w-24 text-right">Czas</span>
            </div>
            {flatTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-3 border-b border-slate-100 hover:bg-slate-50 group"
                style={{ paddingLeft: `${12 + (task.level || 0) * 16}px` }}
              >
                {task.children && task.children.length > 0 ? (
                  <button onClick={() => toggleTaskExpand(task.id)} className="p-0.5">
                    {task.isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                ) : (
                  <span className="w-5" />
                )}
                {task.is_milestone ? (
                  <Flag className="w-4 h-4 text-amber-500" />
                ) : (
                  <span className="w-4 h-2 rounded" style={{ backgroundColor: task.color || '#3b82f6' }} />
                )}
                <span className="flex-1 text-sm text-slate-700 truncate">{getTaskTitle(task)}</span>
                <div className="w-16 text-center">
                  <span className="text-xs text-slate-500">{task.progress || 0}%</span>
                </div>
                <div className="w-24 text-right">
                  {task.start_date && (
                    <span className="text-xs text-slate-500">
                      {formatDate(task.start_date)}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditingTask(task);
                      setTaskForm({
                        title: task.title || getTaskTitle(task),
                        parent_id: task.parent_id || '',
                        start_date: task.start_date?.split('T')[0] || '',
                        end_date: task.end_date?.split('T')[0] || '',
                        duration_days: task.duration_days || 1,
                        progress: task.progress || 0,
                        color: task.color || '#3b82f6',
                        is_milestone: task.is_milestone || false,
                        assigned_to_id: task.assigned_to_id || ''
                      });
                      setShowTaskModal(true);
                    }}
                    className="p-1 hover:bg-slate-200 rounded"
                  >
                    <Pencil className="w-3 h-3 text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task)}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Gantt chart */}
          <div className="flex-1 overflow-auto" ref={containerRef}>
            <div style={{ width: chartWidth, minHeight: '100%' }}>
              {/* Timeline header */}
              <div className="sticky top-0 bg-slate-50 border-b border-slate-200 h-12 flex items-center z-10">
                {Array.from({ length: totalDays }).map((_, i) => {
                  const date = new Date(dateRange.start);
                  date.setDate(date.getDate() + i);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = date.toDateString() === new Date().toDateString();
                  const showLabel = zoomLevel === 'day' ||
                    (zoomLevel === 'week' && date.getDay() === 1) ||
                    (zoomLevel === 'month' && date.getDate() === 1);

                  return (
                    <div
                      key={i}
                      className={`flex-shrink-0 border-r border-slate-200 h-full flex items-center justify-center text-xs ${
                        isToday ? 'bg-blue-50' : isWeekend ? 'bg-slate-100' : ''
                      }`}
                      style={{ width: dayWidth }}
                    >
                      {showLabel && (
                        <span className={`${isToday ? 'text-blue-600 font-medium' : 'text-slate-500'}`}>
                          {formatDate(date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Today line */}
              {(() => {
                const today = new Date();
                if (today >= dateRange.start && today <= dateRange.end) {
                  const daysFromStart = getDaysBetween(dateRange.start, today);
                  return (
                    <div
                      className="absolute top-12 bottom-0 w-0.5 bg-red-500 z-20"
                      style={{ left: daysFromStart * dayWidth }}
                    />
                  );
                }
                return null;
              })()}

              {/* Task bars */}
              {flatTasks.map((task, index) => {
                const pos = getTaskPosition(task);
                return (
                  <div
                    key={task.id}
                    className="h-10 border-b border-slate-100 relative"
                    style={{ backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}
                  >
                    {/* Weekend overlay */}
                    {Array.from({ length: totalDays }).map((_, i) => {
                      const date = new Date(dateRange.start);
                      date.setDate(date.getDate() + i);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      if (!isWeekend) return null;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 bg-slate-50"
                          style={{ left: i * dayWidth, width: dayWidth }}
                        />
                      );
                    })}

                    {task.start_date && task.end_date && (
                      <div
                        className={`absolute top-2 h-6 rounded cursor-pointer group transition-shadow hover:shadow-md ${
                          task.is_milestone
                            ? 'w-4 h-4 rotate-45 bg-amber-500 top-3'
                            : ''
                        }`}
                        style={{
                          left: pos.left,
                          width: task.is_milestone ? 16 : pos.width,
                          backgroundColor: task.is_milestone ? undefined : (task.color || '#3b82f6')
                        }}
                        title={`${getTaskTitle(task)}: ${formatDate(task.start_date)} - ${formatDate(task.end_date)}`}
                      >
                        {!task.is_milestone && (
                          <>
                            {/* Progress bar */}
                            {task.progress > 0 && (
                              <div
                                className="h-full rounded-l opacity-80"
                                style={{
                                  width: `${task.progress}%`,
                                  backgroundColor: 'rgba(0,0,0,0.2)'
                                }}
                              />
                            )}
                            {/* Task label (only show if wide enough) */}
                            {pos.width > 60 && (
                              <span className="absolute inset-0 flex items-center px-2 text-xs text-white font-medium truncate">
                                {getTaskTitle(task)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingTask ? 'Edytuj zadanie' : 'Nowe zadanie'}
              </h2>
              <button onClick={() => setShowTaskModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa zadania *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="np. Instalacja elektryczna piętra 1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taskForm.is_milestone}
                    onChange={e => setTaskForm({ ...taskForm, is_milestone: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Kamień milowy</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zadanie nadrzędne</label>
                <select
                  value={taskForm.parent_id}
                  onChange={e => setTaskForm({ ...taskForm, parent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Brak (główny poziom) --</option>
                  {flatTasks
                    .filter(t => t.id !== editingTask?.id)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {'  '.repeat(t.level || 0)}{getTaskTitle(t)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data rozpoczęcia *</label>
                  <input
                    type="date"
                    value={taskForm.start_date}
                    onChange={e => setTaskForm({ ...taskForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {taskForm.is_milestone ? 'Data' : 'Data zakończenia'}
                  </label>
                  <input
                    type="date"
                    value={taskForm.end_date}
                    onChange={e => setTaskForm({ ...taskForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    disabled={taskForm.is_milestone}
                  />
                </div>
              </div>

              {!taskForm.is_milestone && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Czas trwania (dni)</label>
                      <input
                        type="number"
                        value={taskForm.duration_days}
                        onChange={e => {
                          const days = parseInt(e.target.value) || 1;
                          const newForm = { ...taskForm, duration_days: days };
                          if (taskForm.start_date) {
                            const start = new Date(taskForm.start_date);
                            start.setDate(start.getDate() + days);
                            newForm.end_date = start.toISOString().split('T')[0];
                          }
                          setTaskForm(newForm);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Postęp (%)</label>
                      <input
                        type="number"
                        value={taskForm.progress}
                        onChange={e => setTaskForm({ ...taskForm, progress: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kolor</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={taskForm.color}
                        onChange={e => setTaskForm({ ...taskForm, color: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <div className="flex gap-1">
                        {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setTaskForm({ ...taskForm, color })}
                            className={`w-8 h-8 rounded transition ${
                              taskForm.color === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Przypisane do</label>
                <select
                  value={taskForm.assigned_to_id}
                  onChange={e => setTaskForm({ ...taskForm, assigned_to_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Nie przypisano --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveTask}
                disabled={!taskForm.title || !taskForm.start_date || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingTask ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttPage;
