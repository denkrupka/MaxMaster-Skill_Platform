import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, ChevronRight, ChevronDown, Calendar, Clock, Users,
  Plus, Settings, Download, Loader2, ZoomIn, ZoomOut, Filter,
  ChevronLeft, Link as LinkIcon, Milestone, Search
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
  const { currentUser } = state;

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<GanttTaskWithChildren[]>([]);
  const [dependencies, setDependencies] = useState<GanttDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week');
  const [showMilestones, setShowMilestones] = useState(true);
  const [showDependencies, setShowDependencies] = useState(true);

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
          .select('*, estimate_task:estimate_tasks(*), ticket:tickets(*)')
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
          <p className="text-sm text-slate-500">Harmonogram projektu</p>
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
          onClick={() => {/* TODO: Add task modal */}}
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
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Dodaj pierwsze zadanie
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Task list */}
          <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white overflow-auto">
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 p-3 font-medium text-sm text-slate-600">
              Zadania
            </div>
            {flatTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-3 border-b border-slate-100 hover:bg-slate-50"
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
                  <Milestone className="w-4 h-4 text-amber-500" />
                ) : (
                  <span className="w-4 h-2 rounded" style={{ backgroundColor: task.color || '#3b82f6' }} />
                )}
                <span className="flex-1 text-sm text-slate-700 truncate">{getTaskTitle(task)}</span>
                <span className="text-xs text-slate-500">{task.progress || 0}%</span>
              </div>
            ))}
          </div>

          {/* Gantt chart */}
          <div className="flex-1 overflow-auto" ref={containerRef}>
            <div style={{ width: chartWidth, minHeight: '100%' }}>
              {/* Timeline header */}
              <div className="sticky top-0 bg-slate-50 border-b border-slate-200 h-12 flex items-center">
                {Array.from({ length: totalDays }).map((_, i) => {
                  const date = new Date(dateRange.start);
                  date.setDate(date.getDate() + i);
                  const showLabel = zoomLevel === 'day' ||
                    (zoomLevel === 'week' && date.getDay() === 1) ||
                    (zoomLevel === 'month' && date.getDate() === 1);

                  return (
                    <div
                      key={i}
                      className={`flex-shrink-0 border-r border-slate-200 h-full flex items-center justify-center text-xs ${
                        date.getDay() === 0 || date.getDay() === 6 ? 'bg-slate-100' : ''
                      }`}
                      style={{ width: dayWidth }}
                    >
                      {showLabel && (
                        <span className="text-slate-500">{formatDate(date)}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Task bars */}
              {flatTasks.map(task => {
                const pos = getTaskPosition(task);
                return (
                  <div
                    key={task.id}
                    className="h-10 border-b border-slate-100 relative"
                  >
                    {task.start_date && task.end_date && (
                      <div
                        className={`absolute top-2 h-6 rounded ${
                          task.is_milestone
                            ? 'w-4 h-4 rotate-45 bg-amber-500 top-3'
                            : 'bg-blue-500'
                        }`}
                        style={{
                          left: pos.left,
                          width: task.is_milestone ? 16 : pos.width
                        }}
                      >
                        {!task.is_milestone && task.progress > 0 && (
                          <div
                            className="h-full bg-blue-700 rounded-l"
                            style={{ width: `${task.progress}%` }}
                          />
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
    </div>
  );
};

export default GanttPage;
