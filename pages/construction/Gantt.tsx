import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft, ChevronRight, ChevronDown, Calendar, Clock, Users,
  Plus, Settings, Download, Loader2, ZoomIn, ZoomOut, Filter,
  ChevronLeft, Link as LinkIcon, Milestone, Search, X, Save,
  Pencil, Trash2, Flag, Play, AlertCircle, Check, FileText,
  Briefcase, ListTree, ClipboardList
} from 'lucide-react';
// useSearchParams removed — HashRouter requires manual hash parsing
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Project, GanttTask, GanttDependency, GanttDependencyType, Offer, KosztorysEstimate } from '../../types';
import { GANTT_DEPENDENCY_LABELS, GANTT_DEPENDENCY_SHORT_LABELS } from '../../constants';

type ZoomLevel = 'day' | 'week' | 'month';

interface GanttTaskWithChildren extends GanttTask {
  children?: GanttTaskWithChildren[];
  isExpanded?: boolean;
  level?: number;
}

// Harmonogram creation wizard types
type WizardStep = 'project' | 'time' | 'tasks' | 'resources';
type TaskImportMode = 'empty' | 'general' | 'detailed';
type ResourcePriority = 'slowest' | 'labor' | 'equipment';

interface WizardFormData {
  // Step 1: Project selection
  project_id: string;
  estimate_id: string;
  offer_id: string;
  // Step 2: Time & calendar
  start_date: string;
  deadline: string;
  working_days: boolean[];
  day_start: string;
  work_hours: number;
  // Step 3: Task import mode
  task_mode: TaskImportMode;
  // Step 4: Resources
  resource_priority: ResourcePriority;
}

const WIZARD_STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'project', label: 'Wybierz projekt', icon: <Briefcase className="w-4 h-4" /> },
  { key: 'time', label: 'Czas i kalendarz', icon: <Calendar className="w-4 h-4" /> },
  { key: 'tasks', label: 'Zadania', icon: <ListTree className="w-4 h-4" /> },
  { key: 'resources', label: 'Zasoby', icon: <Users className="w-4 h-4" /> },
];

const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0');
  return `${h}:00`;
});

const DEFAULT_WIZARD_FORM: WizardFormData = {
  project_id: '',
  estimate_id: '',
  offer_id: '',
  start_date: new Date().toISOString().split('T')[0],
  deadline: '',
  working_days: [true, true, true, true, true, false, false],
  day_start: '07:00',
  work_hours: 8,
  task_mode: 'detailed',
  resource_priority: 'slowest',
};

// Searchable select dropdown component
const SearchableSelect: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string; sublabel?: string }[];
  loading?: boolean;
  icon?: React.ReactNode;
}> = ({ label, placeholder, value, onChange, options, loading, icon }) => {
  const [open, setOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(searchVal.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(searchVal.toLowerCase()))
  );

  const selectedOption = options.find(o => o.id === value);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 border rounded-xl text-left transition-all ${
          open ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'
        } ${value ? 'text-slate-900' : 'text-slate-400'}`}
      >
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className="flex-1 truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {value && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(''); }}
            className="p-0.5 hover:bg-slate-100 rounded"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                placeholder="Szukaj..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-400">Brak wyników</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onChange(opt.id); setOpen(false); setSearchVal(''); }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-2 ${
                    value === opt.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'
                  }`}
                >
                  {value === opt.id && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  <div className={value === opt.id ? '' : 'pl-6'}>
                    <div className="text-sm font-medium">{opt.label}</div>
                    {opt.sublabel && <div className="text-xs text-slate-400">{opt.sublabel}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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

  // Project edit modal state
  const [showProjectEditModal, setShowProjectEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({ name: '', status: 'active', start_date: '', end_date: '' });

  // Wizard modal state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('project');
  const [wizardForm, setWizardForm] = useState<WizardFormData>({ ...DEFAULT_WIZARD_FORM });
  const [wizardSaving, setWizardSaving] = useState(false);
  const [allEstimates, setAllEstimates] = useState<any[]>([]);
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [estimateStages, setEstimateStages] = useState<any[]>([]);
  const [estimateItems, setEstimateItems] = useState<any[]>([]);

  // Task form
  const [taskForm, setTaskForm] = useState({
    title: '',
    parent_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    duration: 1,
    progress: 0,
    color: '#3b82f6',
    is_milestone: false,
    assigned_to_id: ''
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const autoSelectDone = useRef(false);

  useEffect(() => {
    if (currentUser) loadProjects();
  }, [currentUser]);

  // Auto-select project from URL param (e.g. #/construction/gantt?projectId=xxx)
  useEffect(() => {
    if (loading || autoSelectDone.current || !projects.length) return;
    // HashRouter: params are inside the hash, not in window.location.search
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    const params = qIndex >= 0 ? new URLSearchParams(hash.substring(qIndex)) : new URLSearchParams();
    const projectId = params.get('projectId');
    if (projectId) {
      const project = projects.find(p => p.id === projectId);
      if (project) setSelectedProject(project);
      // Clean up URL — keep path inside hash, remove query
      const hashPath = qIndex >= 0 ? hash.substring(0, qIndex) : hash;
      window.history.replaceState({}, '', window.location.pathname + hashPath);
      autoSelectDone.current = true;
    }
  }, [loading, projects]);

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

  // ===== WIZARD: Load estimates & offers =====
  const loadWizardData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [estRes, offRes] = await Promise.all([
        supabase
          .from('kosztorys_estimates')
          .select('*, request:kosztorys_requests(*)')
          .eq('company_id', currentUser.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('offers')
          .select('*, project:projects(*)')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
      ]);
      if (estRes.data) setAllEstimates(estRes.data);
      if (offRes.data) setAllOffers(offRes.data);
    } catch (err) {
      console.error('Error loading wizard data:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (showWizard && currentUser) loadWizardData();
  }, [showWizard, currentUser]);

  // Load estimate stages/items when project is selected
  const loadEstimateData = useCallback(async (projectId: string) => {
    if (!projectId) { setEstimateStages([]); setEstimateItems([]); return; }
    try {
      const [stagesRes, tasksRes] = await Promise.all([
        supabase
          .from('estimate_stages')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order'),
        supabase
          .from('estimate_tasks')
          .select('*, resources:estimate_resources(*)')
          .eq('project_id', projectId)
          .order('sort_order')
      ]);
      if (stagesRes.data) setEstimateStages(stagesRes.data);
      if (tasksRes.data) setEstimateItems(tasksRes.data);
    } catch (err) {
      console.error('Error loading estimate data:', err);
    }
  }, []);

  // Auto-fill logic: when selecting any field, fill related fields
  const handleWizardProjectChange = useCallback((projectId: string) => {
    setWizardForm(prev => {
      const update = { ...prev, project_id: projectId };
      if (projectId) {
        // Find related offer
        const relatedOffer = allOffers.find(o => o.project_id === projectId);
        if (relatedOffer && !prev.offer_id) update.offer_id = relatedOffer.id;
        // Set start date from project
        const proj = projects.find(p => p.id === projectId);
        if (proj?.start_date) update.start_date = proj.start_date.split('T')[0];
        if (proj?.end_date) update.deadline = proj.end_date.split('T')[0];
        loadEstimateData(projectId);
      }
      return update;
    });
  }, [allOffers, projects, loadEstimateData]);

  const handleWizardEstimateChange = useCallback((estimateId: string) => {
    setWizardForm(prev => {
      const update = { ...prev, estimate_id: estimateId };
      if (estimateId) {
        const est = allEstimates.find(e => e.id === estimateId);
        if (est?.request) {
          // Try to find project by investment name
          const relatedProject = projects.find(p =>
            p.name.toLowerCase() === est.request.investment_name?.toLowerCase()
          );
          if (relatedProject && !prev.project_id) {
            update.project_id = relatedProject.id;
            loadEstimateData(relatedProject.id);
          }
        }
      }
      return update;
    });
  }, [allEstimates, projects, loadEstimateData]);

  const handleWizardOfferChange = useCallback((offerId: string) => {
    setWizardForm(prev => {
      const update = { ...prev, offer_id: offerId };
      if (offerId) {
        const offer = allOffers.find(o => o.id === offerId);
        if (offer?.project_id && !prev.project_id) {
          update.project_id = offer.project_id;
          loadEstimateData(offer.project_id);
          const proj = projects.find(p => p.id === offer.project_id);
          if (proj?.start_date) update.start_date = proj.start_date.split('T')[0];
          if (proj?.end_date) update.deadline = proj.end_date.split('T')[0];
        }
      }
      return update;
    });
  }, [allOffers, projects, loadEstimateData]);

  const openWizard = () => {
    setWizardForm({ ...DEFAULT_WIZARD_FORM });
    setWizardStep('project');
    setEstimateStages([]);
    setEstimateItems([]);
    setShowWizard(true);
  };

  const wizardStepIndex = WIZARD_STEPS.findIndex(s => s.key === wizardStep);

  const canGoNext = (): boolean => {
    switch (wizardStep) {
      case 'project': return !!wizardForm.project_id;
      case 'time': return !!wizardForm.start_date && wizardForm.working_days.some(d => d);
      case 'tasks': return true;
      case 'resources': return true;
      default: return false;
    }
  };

  const goNextStep = () => {
    const idx = wizardStepIndex;
    if (idx < WIZARD_STEPS.length - 1) setWizardStep(WIZARD_STEPS[idx + 1].key);
  };

  const goPrevStep = () => {
    const idx = wizardStepIndex;
    if (idx > 0) setWizardStep(WIZARD_STEPS[idx - 1].key);
  };

  const getEndTime = () => {
    const startH = parseInt(wizardForm.day_start.split(':')[0]);
    const endH = startH + wizardForm.work_hours;
    return `${endH.toString().padStart(2, '0')}:00`;
  };

  // ===== CREATE HARMONOGRAM =====
  const handleCreateHarmonogram = async () => {
    if (!currentUser || !wizardForm.project_id) return;
    setWizardSaving(true);
    try {
      const projectId = wizardForm.project_id;

      // Update project dates if set
      const projectUpdates: any = {};
      if (wizardForm.start_date) projectUpdates.start_date = wizardForm.start_date;
      if (wizardForm.deadline) projectUpdates.end_date = wizardForm.deadline;
      if (Object.keys(projectUpdates).length > 0) {
        await supabase.from('projects').update(projectUpdates).eq('id', projectId);
      }

      // Save working days mask
      const mask = wizardForm.working_days.reduce((acc, v, i) => acc | (v ? (1 << i) : 0), 0);
      await supabase.from('project_working_days').upsert({
        project_id: projectId,
        working_days_mask: mask
      }, { onConflict: 'project_id' });

      // Clean existing gantt tasks if any
      await supabase.from('gantt_dependencies').delete().eq('project_id', projectId);
      await supabase.from('gantt_tasks').delete().eq('project_id', projectId);

      if (wizardForm.task_mode === 'empty') {
        // Just create empty harmonogram — no tasks
      } else if (wizardForm.task_mode === 'general') {
        // Import by stages (Działy) — each stage becomes a top-level task
        if (estimateStages.length > 0) {
          const startDate = new Date(wizardForm.start_date);
          let currentDate = new Date(startDate);

          const getNextWorkingDay = (date: Date): Date => {
            const d = new Date(date);
            // Day of week: 0=Sun, 1=Mon ... 6=Sat → map to our array where 0=Mon
            while (true) {
              const dow = d.getDay();
              const arrIdx = dow === 0 ? 6 : dow - 1;
              if (wizardForm.working_days[arrIdx]) return d;
              d.setDate(d.getDate() + 1);
            }
          };

          const addWorkingDays = (start: Date, days: number): Date => {
            let d = new Date(start);
            let added = 0;
            while (added < days) {
              d.setDate(d.getDate() + 1);
              const dow = d.getDay();
              const arrIdx = dow === 0 ? 6 : dow - 1;
              if (wizardForm.working_days[arrIdx]) added++;
            }
            return d;
          };

          for (let i = 0; i < estimateStages.length; i++) {
            const stage = estimateStages[i];
            const stageTasks = estimateItems.filter((t: any) => t.stage_id === stage.id && !t.parent_id);
            const duration = Math.max(stageTasks.length * 2, 5);
            const stageStart = getNextWorkingDay(currentDate);
            const stageEnd = addWorkingDays(stageStart, duration);

            await supabase.from('gantt_tasks').insert({
              project_id: projectId,
              title: stage.name,
              start_date: stageStart.toISOString().split('T')[0],
              end_date: stageEnd.toISOString().split('T')[0],
              duration,
              progress: 0,
              is_milestone: false,
              sort_order: i,
              source: 'manual',
              color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'][i % 6]
            });

            currentDate = new Date(stageEnd);
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      } else if (wizardForm.task_mode === 'detailed') {
        // Import by tasks (Pozycje) — stages as parents, tasks as children
        if (estimateStages.length > 0 || estimateItems.length > 0) {
          const startDate = new Date(wizardForm.start_date);
          let currentDate = new Date(startDate);
          let sortOrder = 0;

          const getNextWorkingDay = (date: Date): Date => {
            const d = new Date(date);
            while (true) {
              const dow = d.getDay();
              const arrIdx = dow === 0 ? 6 : dow - 1;
              if (wizardForm.working_days[arrIdx]) return d;
              d.setDate(d.getDate() + 1);
            }
          };

          const addWorkingDays = (start: Date, days: number): Date => {
            let d = new Date(start);
            let added = 0;
            while (added < days) {
              d.setDate(d.getDate() + 1);
              const dow = d.getDay();
              const arrIdx = dow === 0 ? 6 : dow - 1;
              if (wizardForm.working_days[arrIdx]) added++;
            }
            return d;
          };

          for (let si = 0; si < estimateStages.length; si++) {
            const stage = estimateStages[si];
            const stageTasks = estimateItems.filter((t: any) => t.stage_id === stage.id && !t.parent_id);

            // Calculate stage date range
            const stageStart = getNextWorkingDay(new Date(currentDate));
            let stageEnd = new Date(stageStart);

            // Insert parent task for stage
            const { data: parentData } = await supabase.from('gantt_tasks').insert({
              project_id: projectId,
              title: stage.name,
              start_date: stageStart.toISOString().split('T')[0],
              end_date: stageStart.toISOString().split('T')[0],
              duration: 0,
              progress: 0,
              is_milestone: false,
              sort_order: sortOrder++,
              source: 'manual',
              color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'][si % 6]
            }).select('id').single();

            const parentId = parentData?.id;

            // Insert child tasks
            let childDate = new Date(stageStart);
            for (let ti = 0; ti < stageTasks.length; ti++) {
              const task = stageTasks[ti];
              const taskDuration = Math.max(task.duration || 1, 1);
              const taskStart = getNextWorkingDay(childDate);
              const taskEnd = addWorkingDays(taskStart, taskDuration);

              await supabase.from('gantt_tasks').insert({
                project_id: projectId,
                title: task.name,
                parent_id: parentId,
                estimate_task_id: task.id,
                start_date: taskStart.toISOString().split('T')[0],
                end_date: taskEnd.toISOString().split('T')[0],
                duration: taskDuration,
                progress: 0,
                is_milestone: false,
                sort_order: sortOrder++,
                source: 'estimate',
                source_id: task.id,
                color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'][si % 6]
              });

              if (taskEnd > stageEnd) stageEnd = taskEnd;
              childDate = new Date(taskEnd);
              childDate.setDate(childDate.getDate() + 1);
            }

            // Update parent stage dates
            if (parentId && stageTasks.length > 0) {
              await supabase.from('gantt_tasks').update({
                end_date: stageEnd.toISOString().split('T')[0],
                duration: Math.ceil((stageEnd.getTime() - stageStart.getTime()) / (1000 * 60 * 60 * 24))
              }).eq('id', parentId);
            }

            currentDate = new Date(stageEnd);
            currentDate.setDate(currentDate.getDate() + 1);
          }

          // Also import tasks that don't belong to any stage
          const orphanTasks = estimateItems.filter((t: any) =>
            !estimateStages.some((s: any) => s.id === t.stage_id) && !t.parent_id
          );
          for (let ti = 0; ti < orphanTasks.length; ti++) {
            const task = orphanTasks[ti];
            const taskDuration = Math.max(task.duration || 1, 1);
            const taskStart = getNextWorkingDay(currentDate);
            const taskEnd = addWorkingDays(taskStart, taskDuration);

            await supabase.from('gantt_tasks').insert({
              project_id: projectId,
              title: task.name,
              estimate_task_id: task.id,
              start_date: taskStart.toISOString().split('T')[0],
              end_date: taskEnd.toISOString().split('T')[0],
              duration: taskDuration,
              progress: 0,
              is_milestone: false,
              sort_order: sortOrder++,
              source: 'estimate',
              source_id: task.id
            });

            currentDate = new Date(taskEnd);
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }

      // Navigate to the project's gantt
      const proj = projects.find(p => p.id === projectId);
      if (proj) {
        setSelectedProject(proj);
        await loadProjects();
      }
      setShowWizard(false);
    } catch (err) {
      console.error('Error creating harmonogram:', err);
    } finally {
      setWizardSaving(false);
    }
  };

  const handleOpenEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name || '',
      status: project.status || 'active',
      start_date: project.start_date ? project.start_date.split('T')[0] : '',
      end_date: project.end_date ? project.end_date.split('T')[0] : ''
    });
    setShowProjectEditModal(true);
  };

  const handleSaveProject = async () => {
    if (!editingProject || !currentUser) return;
    setSaving(true);
    try {
      await supabase
        .from('projects')
        .update({
          name: projectForm.name.trim(),
          status: projectForm.status,
          start_date: projectForm.start_date || null,
          end_date: projectForm.end_date || null
        })
        .eq('id', editingProject.id);
      await loadProjects();
      setShowProjectEditModal(false);
      setEditingProject(null);
    } catch (err) {
      console.error('Error updating project:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Czy na pewno chcesz usunąć projekt "${project.name}"?`)) return;
    try {
      await supabase
        .from('gantt_dependencies')
        .delete()
        .eq('project_id', project.id);
      await supabase
        .from('gantt_tasks')
        .delete()
        .eq('project_id', project.id);
      await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);
      await loadProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
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
      if (!endDate && taskForm.start_date && taskForm.duration) {
        const start = new Date(taskForm.start_date);
        start.setDate(start.getDate() + taskForm.duration);
        endDate = start.toISOString().split('T')[0];
      }

      const data = {
        project_id: selectedProject.id,
        title: taskForm.title,
        parent_id: taskForm.parent_id || null,
        start_date: taskForm.start_date,
        end_date: endDate,
        duration: taskForm.duration,
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
      duration: 1,
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
    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="p-6">

        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj projektu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={openWizard}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Utwórz Harmonogram
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {projects.length === 0
                ? 'Brak projektów. Utwórz projekt, aby dodać harmonogram.'
                : 'Brak projektów pasujących do wyszukiwania.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Projekt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data rozpoczęcia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data zakończenia</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProjects.map(project => (
                  <tr
                    key={project.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedProject(project)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: (project.color || '#3b82f6') + '20' }}
                        >
                          <Calendar className="w-4 h-4" style={{ color: project.color || '#3b82f6' }} />
                        </div>
                        <span className="font-medium text-slate-900">{project.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        project.status === 'completed' ? 'bg-green-100 text-green-700' :
                        project.status === 'active' ? 'bg-blue-100 text-blue-700' :
                        project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {project.status === 'active' ? 'Aktywny' :
                         project.status === 'completed' ? 'Zakończony' :
                         project.status === 'on_hold' ? 'Wstrzymany' :
                         project.status === 'planning' ? 'Planowanie' : project.status || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {project.start_date ? new Date(project.start_date).toLocaleDateString('pl-PL') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {project.end_date ? new Date(project.end_date).toLocaleDateString('pl-PL') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEditProject(project)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edytuj"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
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
        )}

        {/* ========== WIZARD MODAL ========== */}
        {showWizard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWizard(false)}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 pb-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Settings className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-900">Konfiguracja harmonogramu</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Dostosuj parametry czasu i zasobów</p>
                </div>
                <button onClick={() => setShowWizard(false)} className="p-2 hover:bg-slate-100 rounded-lg -mt-1 -mr-1">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-6 flex gap-0 border-b border-slate-200">
                {WIZARD_STEPS.map((step, idx) => {
                  const isActive = step.key === wizardStep;
                  const isPast = idx < wizardStepIndex;
                  const isFuture = idx > wizardStepIndex;
                  return (
                    <button
                      key={step.key}
                      onClick={() => { if (isPast) setWizardStep(step.key); }}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                        isActive
                          ? 'border-emerald-500 text-emerald-600'
                          : isPast
                          ? 'border-transparent text-slate-500 hover:text-slate-700 cursor-pointer'
                          : 'border-transparent text-slate-300 cursor-default'
                      }`}
                      disabled={isFuture}
                    >
                      {step.icon}
                      {step.label}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Step 1: Project selection */}
                {wizardStep === 'project' && (
                  <div className="space-y-5">
                    <SearchableSelect
                      label="Wybierz projekt"
                      placeholder="Szukaj po nazwie, adresie, kliencie..."
                      value={wizardForm.project_id}
                      onChange={handleWizardProjectChange}
                      icon={<Briefcase className="w-4 h-4" />}
                      options={projects.map(p => ({
                        id: p.id,
                        label: p.name,
                        sublabel: [
                          p.status === 'active' ? 'Aktywny' : p.status === 'completed' ? 'Zakończony' : p.status,
                          p.customer?.name
                        ].filter(Boolean).join(' • ')
                      }))}
                    />
                    <SearchableSelect
                      label="Wybierz kosztorys"
                      placeholder="Szukaj kosztorysu..."
                      value={wizardForm.estimate_id}
                      onChange={handleWizardEstimateChange}
                      icon={<FileText className="w-4 h-4" />}
                      options={allEstimates.map(e => ({
                        id: e.id,
                        label: e.estimate_number || `Kosztorys #${e.id.substring(0, 8)}`,
                        sublabel: [
                          e.request?.investment_name,
                          e.request?.client_name,
                          e.status === 'approved' ? 'Zatwierdzony' : e.status === 'draft' ? 'Szkic' : e.status
                        ].filter(Boolean).join(' • ')
                      }))}
                    />
                    <SearchableSelect
                      label="Wybierz ofertę"
                      placeholder="Szukaj oferty..."
                      value={wizardForm.offer_id}
                      onChange={handleWizardOfferChange}
                      icon={<ClipboardList className="w-4 h-4" />}
                      options={allOffers.map(o => ({
                        id: o.id,
                        label: o.name || o.number || `Oferta #${o.id.substring(0, 8)}`,
                        sublabel: [
                          o.project?.name,
                          o.status === 'accepted' ? 'Zaakceptowana' : o.status === 'sent' ? 'Wysłana' : o.status === 'draft' ? 'Szkic' : o.status,
                          o.final_amount ? `${Number(o.final_amount).toLocaleString('pl-PL')} PLN` : ''
                        ].filter(Boolean).join(' • ')
                      }))}
                    />
                    {!wizardForm.project_id && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        Wybierz co najmniej jeden projekt, aby kontynuować.
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Time & Calendar */}
                {wizardStep === 'time' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-500 mb-1.5">Start projektu</label>
                        <div className="relative flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <Play className="w-4 h-4 text-emerald-600" />
                          </div>
                          <input
                            type="date"
                            value={wizardForm.start_date}
                            onChange={e => setWizardForm({ ...wizardForm, start_date: e.target.value })}
                            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-500 mb-1.5">Deadline</label>
                        <div className="relative flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-4 h-4 text-red-500" />
                          </div>
                          <input
                            type="date"
                            value={wizardForm.deadline}
                            onChange={e => setWizardForm({ ...wizardForm, deadline: e.target.value })}
                            placeholder="yyyy-mm-dd"
                            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-500 mb-2">Dni robocze</label>
                      <div className="flex gap-2">
                        {DAY_LABELS.map((day, i) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const newDays = [...wizardForm.working_days];
                              newDays[i] = !newDays[i];
                              setWizardForm({ ...wizardForm, working_days: newDays });
                            }}
                            className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${
                              wizardForm.working_days[i]
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-5">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Harmonogram dnia</h4>
                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="block text-sm text-slate-500 mb-1.5">Start</label>
                          <select
                            value={wizardForm.day_start}
                            onChange={e => setWizardForm({ ...wizardForm, day_start: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                          >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-500 mb-1.5">Czas pracy</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={16}
                              value={wizardForm.work_hours}
                              onChange={e => setWizardForm({ ...wizardForm, work_hours: parseInt(e.target.value) || 8 })}
                              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                            />
                            <span className="text-sm text-slate-400 font-medium">h</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-500 mb-1.5">Koniec</label>
                          <div className="flex items-center gap-2 px-3 py-2.5 text-slate-600">
                            <span className="text-slate-400">&rarr;</span>
                            <span className="font-medium">{getEndTime()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Tasks (Zadania) */}
                {wizardStep === 'tasks' && (
                  <div className="space-y-3">
                    <label className="block text-sm text-slate-500 mb-2">Tryb importu</label>

                    {/* Empty harmonogram */}
                    <label
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        wizardForm.task_mode === 'empty'
                          ? 'border-emerald-400 bg-emerald-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="task_mode"
                        value="empty"
                        checked={wizardForm.task_mode === 'empty'}
                        onChange={() => setWizardForm({ ...wizardForm, task_mode: 'empty' })}
                        className="mt-0.5 w-4 h-4 text-emerald-500 focus:ring-emerald-400"
                      />
                      <div>
                        <div className="font-medium text-slate-800">Utwórz pusty harmonogram</div>
                        <div className="text-sm text-slate-400 mt-0.5">Zacznij od zera — dodasz zadania ręcznie.</div>
                      </div>
                    </label>

                    {/* General (Działy) */}
                    <label
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                        estimateStages.length === 0
                          ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                          : wizardForm.task_mode === 'general'
                          ? 'border-emerald-400 bg-emerald-50/50 cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="task_mode"
                        value="general"
                        checked={wizardForm.task_mode === 'general'}
                        onChange={() => setWizardForm({ ...wizardForm, task_mode: 'general' })}
                        disabled={estimateStages.length === 0}
                        className="mt-0.5 w-4 h-4 text-emerald-500 focus:ring-emerald-400"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">Ogólny (Działy)</span>
                          {estimateStages.length === 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-500 rounded-full">Niedostępne</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400 mt-0.5">
                          {estimateStages.length === 0
                            ? 'Ten kosztorys nie posiada sekcji.'
                            : `Importuje ${estimateStages.length} ${estimateStages.length === 1 ? 'dział' : 'działów'} jako zadania główne.`}
                        </div>
                      </div>
                    </label>

                    {/* Detailed (Pozycje) */}
                    <label
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                        estimateItems.length === 0
                          ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                          : wizardForm.task_mode === 'detailed'
                          ? 'border-emerald-400 bg-emerald-50/50 cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="task_mode"
                        value="detailed"
                        checked={wizardForm.task_mode === 'detailed'}
                        onChange={() => setWizardForm({ ...wizardForm, task_mode: 'detailed' })}
                        disabled={estimateItems.length === 0}
                        className="mt-0.5 w-4 h-4 text-emerald-500 focus:ring-emerald-400"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">Szczegółowy (Pozycje)</span>
                          {estimateItems.length === 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-500 rounded-full">Niedostępne</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400 mt-0.5">
                          {estimateItems.length === 0
                            ? 'Ten kosztorys nie posiada pozycji.'
                            : `Przenosi każdą pozycję jako osobne zadanie (${estimateItems.filter((t: any) => !t.parent_id).length} pozycji).`}
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                {/* Step 4: Resources */}
                {wizardStep === 'resources' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 rounded-xl p-5">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                        Jak wyliczać czas trwania zadań?
                      </h4>
                      <div className="space-y-3">
                        <label
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            wizardForm.resource_priority === 'slowest' ? 'bg-white shadow-sm ring-1 ring-emerald-200' : 'hover:bg-white/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="resource_priority"
                            value="slowest"
                            checked={wizardForm.resource_priority === 'slowest'}
                            onChange={() => setWizardForm({ ...wizardForm, resource_priority: 'slowest' })}
                            className="mt-0.5 w-4 h-4 text-emerald-500 focus:ring-emerald-400"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">Decyduje najwolniejszy zasób</span>
                              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Zalecane</span>
                            </div>
                            <div className="text-sm text-slate-400 mt-0.5">
                              Decyduje ten zasób, który pracuje dłużej (ludzie lub sprzęt).
                            </div>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            wizardForm.resource_priority === 'labor' ? 'bg-white shadow-sm ring-1 ring-emerald-200' : 'hover:bg-white/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="resource_priority"
                            value="labor"
                            checked={wizardForm.resource_priority === 'labor'}
                            onChange={() => setWizardForm({ ...wizardForm, resource_priority: 'labor' })}
                            className="mt-0.5 w-4 h-4 text-emerald-500 focus:ring-emerald-400"
                          />
                          <div>
                            <span className="font-medium text-slate-800">Priorytetyzuj robociznę</span>
                            <div className="text-sm text-slate-400 mt-0.5">
                              Czas pracy maszyn jest ignorowany (np. koparka czeka na ludzi).
                            </div>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            wizardForm.resource_priority === 'equipment' ? 'bg-white shadow-sm ring-1 ring-emerald-200' : 'hover:bg-white/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="resource_priority"
                            value="equipment"
                            checked={wizardForm.resource_priority === 'equipment'}
                            onChange={() => setWizardForm({ ...wizardForm, resource_priority: 'equipment' })}
                            className="mt-0.5 w-4 h-4 text-emerald-500 focus:ring-emerald-400"
                          />
                          <div>
                            <span className="font-medium text-slate-800">Priorytetyzuj sprzęt</span>
                            <div className="text-sm text-slate-400 mt-0.5">
                              Decyduje czas pracy głównej maszyny (np. dźwigu).
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {estimateItems.length === 0 && wizardForm.task_mode !== 'empty' && (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                        <Settings className="w-10 h-10 mb-3 text-slate-300" />
                        <p className="text-sm">Nie znaleziono szczegółowych zasobów w tym kosztorysie.</p>
                        <p className="text-sm">Zastosujemy domyślne ustawienia ogólne.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {wizardSaving && (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Zajmie to mniej niż minutę.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {wizardStepIndex > 0 ? (
                    <button
                      onClick={goPrevStep}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Wstecz
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowWizard(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Anuluj
                    </button>
                  )}
                  {wizardStepIndex < WIZARD_STEPS.length - 1 ? (
                    <button
                      onClick={goNextStep}
                      disabled={!canGoNext()}
                      className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      Dalej
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleCreateHarmonogram}
                      disabled={wizardSaving}
                      className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors font-medium"
                    >
                      {wizardSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Utwórz Harmonogram
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
                        duration: task.duration || 1,
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
                        value={taskForm.duration}
                        onChange={e => {
                          const days = parseInt(e.target.value) || 1;
                          const newForm = { ...taskForm, duration: days };
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

      {/* Project edit modal */}
      {showProjectEditModal && editingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Edytuj projekt</h2>
              <button onClick={() => { setShowProjectEditModal(false); setEditingProject(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa projektu *</label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={projectForm.status}
                  onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Aktywny</option>
                  <option value="planning">Planowanie</option>
                  <option value="on_hold">Wstrzymany</option>
                  <option value="completed">Zakończony</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data rozpoczęcia</label>
                  <input
                    type="date"
                    value={projectForm.start_date}
                    onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data zakończenia</label>
                  <input
                    type="date"
                    value={projectForm.end_date}
                    onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowProjectEditModal(false); setEditingProject(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveProject}
                disabled={saving || !projectForm.name.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttPage;
