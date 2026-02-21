import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft, ChevronRight, ChevronDown, Calendar, Clock, Users,
  Plus, Settings, Download, Loader2, ZoomIn, ZoomOut, Filter,
  ChevronLeft, Link as LinkIcon, Milestone, Search, X, Save,
  Pencil, Trash2, Flag, Play, AlertCircle, Check, FileText,
  Briefcase, ListTree, ClipboardList, MoreHorizontal, GripVertical
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Project, GanttTask, GanttDependency, GanttDependencyType, Offer, KosztorysEstimate } from '../../types';
import { GANTT_DEPENDENCY_LABELS, GANTT_DEPENDENCY_SHORT_LABELS } from '../../constants';

type ZoomLevel = 'day' | 'week' | 'month';

interface GanttTaskWithChildren extends GanttTask {
  children?: GanttTaskWithChildren[];
  isExpanded?: boolean;
  level?: number;
  wbs?: string;
}

// Harmonogram creation wizard types
type WizardStep = 'project' | 'time' | 'tasks' | 'resources';
type TaskImportMode = 'empty' | 'general' | 'detailed';
type ResourcePriority = 'slowest' | 'labor' | 'equipment';

interface WizardFormData {
  project_id: string;
  estimate_id: string;
  offer_id: string;
  start_date: string;
  deadline: string;
  working_days: boolean[];
  day_start: string;
  work_hours: number;
  task_mode: TaskImportMode;
  resource_priority: ResourcePriority;
}

const WIZARD_STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'project', label: 'Wybierz projekt', icon: <Briefcase className="w-4 h-4" /> },
  { key: 'time', label: 'Czas i kalendarz', icon: <Calendar className="w-4 h-4" /> },
  { key: 'tasks', label: 'Zadania', icon: <ListTree className="w-4 h-4" /> },
  { key: 'resources', label: 'Zasoby', icon: <Users className="w-4 h-4" /> },
];

const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const DAY_LETTERS = ['N', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

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

const TASK_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];
const PARENT_COLOR = '#3b82f6';

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
          open ? 'border-blue-500 ring-2 ring-blue-100' : value ? 'border-blue-300' : 'border-slate-200 hover:border-slate-300'
        } ${value ? 'text-slate-900' : 'text-slate-400'}`}
      >
        {icon && <span className={value ? 'text-blue-600' : 'text-slate-400'}>{icon}</span>}
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
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                placeholder="Szukaj..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
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
                  className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                    value === opt.id ? 'bg-blue-50' : ''
                  }`}
                >
                  {value === opt.id ? (
                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  ) : (
                    <span className="w-4 flex-shrink-0" />
                  )}
                  <div>
                    <div className={`text-sm font-medium ${value === opt.id ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</div>
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
  const [estimateDataLoading, setEstimateDataLoading] = useState(false);

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

  useEffect(() => {
    if (loading || autoSelectDone.current || !projects.length) return;
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    const params = qIndex >= 0 ? new URLSearchParams(hash.substring(qIndex)) : new URLSearchParams();
    const projectId = params.get('projectId');
    if (projectId) {
      const project = projects.find(p => p.id === projectId);
      if (project) setSelectedProject(project);
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

  // ===== WIZARD =====
  const loadWizardData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [estRes, offRes] = await Promise.all([
        supabase
          .from('kosztorys_estimates')
          .select('*, request:kosztorys_requests(*), items:kosztorys_estimate_items(count)')
          .eq('company_id', currentUser.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('offers')
          .select('*, project:projects(*), sections:offer_sections(*, items:offer_items(*))')
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

  // Load estimate_stages + estimate_tasks from project
  const loadEstimateDataFromProject = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setEstimateDataLoading(true);
    try {
      const [stagesRes, tasksRes] = await Promise.all([
        supabase.from('estimate_stages').select('*').eq('project_id', projectId).order('sort_order'),
        supabase.from('estimate_tasks').select('*, resources:estimate_resources(*)').eq('project_id', projectId).order('sort_order')
      ]);
      if (stagesRes.data && stagesRes.data.length > 0) setEstimateStages(stagesRes.data);
      if (tasksRes.data && tasksRes.data.length > 0) setEstimateItems(tasksRes.data);
    } catch (err) {
      console.error('Error loading estimate data:', err);
    } finally {
      setEstimateDataLoading(false);
    }
  }, []);

  // Load kosztorys_estimate_items from kosztorys
  const loadKosztorysData = useCallback(async (estimateId: string) => {
    if (!estimateId) return;
    setEstimateDataLoading(true);
    try {
      const { data: items } = await supabase
        .from('kosztorys_estimate_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .eq('is_deleted', false)
        .order('position_number');

      if (items && items.length > 0) {
        // Group by room_group as "działy"
        const groupMap = new Map<string, any[]>();
        items.forEach(item => {
          const group = item.room_group || 'Ogólne';
          if (!groupMap.has(group)) groupMap.set(group, []);
          groupMap.get(group)!.push(item);
        });

        const stages = Array.from(groupMap.keys()).map((name, i) => ({
          id: `kgrp_${i}`,
          name,
          sort_order: i
        }));

        const taskItems = items.map((item: any, i: number) => ({
          id: item.id,
          stage_id: stages.find(s => s.name === (item.room_group || 'Ogólne'))?.id,
          name: item.task_description || item.installation_element || `Pozycja ${item.position_number}`,
          duration: 1,
          sort_order: item.position_number || i
        }));

        setEstimateStages(stages);
        setEstimateItems(taskItems);
      }
    } catch (err) {
      console.error('Error loading kosztorys data:', err);
    } finally {
      setEstimateDataLoading(false);
    }
  }, []);

  // Load offer sections/items
  const loadOfferData = useCallback((offer: any) => {
    if (!offer?.sections || offer.sections.length === 0) return;
    const stages = offer.sections.map((s: any, i: number) => ({
      id: `osec_${s.id}`,
      name: s.name,
      sort_order: s.sort_order ?? i
    }));

    const taskItems: any[] = [];
    offer.sections.forEach((sec: any) => {
      (sec.items || []).forEach((item: any, i: number) => {
        taskItems.push({
          id: item.id,
          stage_id: `osec_${sec.id}`,
          name: item.name || `Pozycja ${i + 1}`,
          duration: 1,
          sort_order: item.sort_order ?? i
        });
      });
    });

    if (stages.length > 0) setEstimateStages(stages);
    if (taskItems.length > 0) setEstimateItems(taskItems);
  }, []);

  const handleWizardProjectChange = useCallback((projectId: string) => {
    setWizardForm(prev => {
      const update = { ...prev, project_id: projectId };
      if (projectId) {
        const relatedOffer = allOffers.find(o => o.project_id === projectId);
        if (relatedOffer && !prev.offer_id) update.offer_id = relatedOffer.id;
        const proj = projects.find(p => p.id === projectId);
        if (proj?.start_date) update.start_date = proj.start_date.split('T')[0];
        if (proj?.end_date) update.deadline = proj.end_date.split('T')[0];
      } else {
        setEstimateStages([]);
        setEstimateItems([]);
      }
      return update;
    });
    // Async call OUTSIDE setWizardForm
    if (projectId) loadEstimateDataFromProject(projectId);
  }, [allOffers, projects, loadEstimateDataFromProject]);

  const handleWizardEstimateChange = useCallback((estimateId: string) => {
    let relatedProjectId: string | null = null;
    setWizardForm(prev => {
      const update = { ...prev, estimate_id: estimateId };
      if (estimateId) {
        const est = allEstimates.find(e => e.id === estimateId);
        if (est?.request) {
          const relatedProject = projects.find(p =>
            p.name.toLowerCase() === est.request.investment_name?.toLowerCase()
          );
          if (relatedProject && !prev.project_id) {
            update.project_id = relatedProject.id;
            relatedProjectId = relatedProject.id;
          }
        }
      } else {
        setEstimateStages([]);
        setEstimateItems([]);
      }
      return update;
    });
    // Async calls OUTSIDE setWizardForm to ensure they execute properly
    if (estimateId) {
      if (relatedProjectId) loadEstimateDataFromProject(relatedProjectId);
      loadKosztorysData(estimateId);
    }
  }, [allEstimates, projects, loadEstimateDataFromProject, loadKosztorysData]);

  const handleWizardOfferChange = useCallback((offerId: string) => {
    const offer = offerId ? allOffers.find(o => o.id === offerId) : null;
    setWizardForm(prev => {
      const update = { ...prev, offer_id: offerId };
      if (offerId && offer) {
        if (offer.project_id && !prev.project_id) {
          update.project_id = offer.project_id;
          const proj = projects.find(p => p.id === offer.project_id);
          if (proj?.start_date) update.start_date = proj.start_date.split('T')[0];
          if (proj?.end_date) update.deadline = proj.end_date.split('T')[0];
        }
      } else {
        setEstimateStages([]);
        setEstimateItems([]);
      }
      return update;
    });
    // Async calls OUTSIDE setWizardForm
    if (offerId && offer) {
      if (offer.project_id) loadEstimateDataFromProject(offer.project_id);
      loadOfferData(offer);
    }
  }, [allOffers, projects, loadEstimateDataFromProject, loadOfferData]);

  const openWizard = () => {
    setWizardForm({ ...DEFAULT_WIZARD_FORM });
    setWizardStep('project');
    setEstimateStages([]);
    setEstimateItems([]);
    setEstimateDataLoading(false);
    setShowWizard(true);
  };

  const wizardStepIndex = WIZARD_STEPS.findIndex(s => s.key === wizardStep);
  const hasAnySelection = !!wizardForm.project_id || !!wizardForm.estimate_id || !!wizardForm.offer_id;

  const canGoNext = (): boolean => {
    switch (wizardStep) {
      case 'project': return hasAnySelection;
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

  // Working day helpers
  const getNextWorkingDay = (date: Date, workingDays: boolean[]): Date => {
    const d = new Date(date);
    for (let i = 0; i < 14; i++) {
      const dow = d.getDay();
      const arrIdx = dow === 0 ? 6 : dow - 1;
      if (workingDays[arrIdx]) return d;
      d.setDate(d.getDate() + 1);
    }
    return d;
  };

  const addWorkingDays = (start: Date, days: number, workingDays: boolean[]): Date => {
    const d = new Date(start);
    let added = 0;
    while (added < days) {
      d.setDate(d.getDate() + 1);
      const dow = d.getDay();
      const arrIdx = dow === 0 ? 6 : dow - 1;
      if (workingDays[arrIdx]) added++;
    }
    return d;
  };

  // ===== CREATE HARMONOGRAM =====
  const handleCreateHarmonogram = async () => {
    if (!currentUser || !hasAnySelection) return;
    setWizardSaving(true);
    try {
      let projectId = wizardForm.project_id;

      // If no project selected — create one from kosztorys/offer
      if (!projectId) {
        let projectName = 'Nowy harmonogram';
        if (wizardForm.estimate_id) {
          const est = allEstimates.find(e => e.id === wizardForm.estimate_id);
          projectName = est?.request?.investment_name || est?.estimate_number || projectName;
        } else if (wizardForm.offer_id) {
          const off = allOffers.find(o => o.id === wizardForm.offer_id);
          projectName = off?.name || off?.number || projectName;
        }
        const { data: newProj } = await supabase.from('projects').insert({
          company_id: currentUser.company_id,
          name: projectName,
          status: 'active',
          start_date: wizardForm.start_date || null,
          end_date: wizardForm.deadline || null,
          color: '#3b82f6'
        }).select('*').single();
        if (!newProj) throw new Error('Failed to create project');
        projectId = newProj.id;
      } else {
        // Update project dates
        const updates: any = {};
        if (wizardForm.start_date) updates.start_date = wizardForm.start_date;
        if (wizardForm.deadline) updates.end_date = wizardForm.deadline;
        if (Object.keys(updates).length > 0) {
          await supabase.from('projects').update(updates).eq('id', projectId);
        }
      }

      // Save working days mask
      const mask = wizardForm.working_days.reduce((acc, v, i) => acc | (v ? (1 << i) : 0), 0);
      await supabase.from('project_working_days').upsert({
        project_id: projectId,
        working_days_mask: mask
      }, { onConflict: 'project_id' });

      // Clean existing gantt tasks
      await supabase.from('gantt_dependencies').delete().eq('project_id', projectId);
      await supabase.from('gantt_tasks').delete().eq('project_id', projectId);

      const wd = wizardForm.working_days;

      if (wizardForm.task_mode === 'general' && estimateStages.length > 0) {
        let currentDate = new Date(wizardForm.start_date);
        for (let i = 0; i < estimateStages.length; i++) {
          const stage = estimateStages[i];
          const stageTasks = estimateItems.filter((t: any) => t.stage_id === stage.id);
          const duration = Math.max(stageTasks.length * 2, 5);
          const stageStart = getNextWorkingDay(currentDate, wd);
          const stageEnd = addWorkingDays(stageStart, duration, wd);

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
            color: TASK_COLORS[i % TASK_COLORS.length]
          });
          currentDate = new Date(stageEnd);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else if (wizardForm.task_mode === 'detailed' && (estimateStages.length > 0 || estimateItems.length > 0)) {
        let currentDate = new Date(wizardForm.start_date);
        let sortOrder = 0;

        for (let si = 0; si < estimateStages.length; si++) {
          const stage = estimateStages[si];
          const stageTasks = estimateItems.filter((t: any) => t.stage_id === stage.id);
          const stageStart = getNextWorkingDay(new Date(currentDate), wd);
          let stageEnd = new Date(stageStart);

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
            color: PARENT_COLOR
          }).select('id').single();

          const parentId = parentData?.id;
          let childDate = new Date(stageStart);

          for (let ti = 0; ti < stageTasks.length; ti++) {
            const task = stageTasks[ti];
            const taskDuration = Math.max(task.duration || 1, 1);
            const taskStart = getNextWorkingDay(childDate, wd);
            const taskEnd = addWorkingDays(taskStart, taskDuration, wd);

            await supabase.from('gantt_tasks').insert({
              project_id: projectId,
              title: task.name,
              parent_id: parentId,
              start_date: taskStart.toISOString().split('T')[0],
              end_date: taskEnd.toISOString().split('T')[0],
              duration: taskDuration,
              progress: 0,
              is_milestone: false,
              sort_order: sortOrder++,
              source: 'estimate',
              color: TASK_COLORS[si % TASK_COLORS.length]
            });
            if (taskEnd > stageEnd) stageEnd = taskEnd;
            childDate = new Date(taskEnd);
            childDate.setDate(childDate.getDate() + 1);
          }

          if (parentId && stageTasks.length > 0) {
            await supabase.from('gantt_tasks').update({
              end_date: stageEnd.toISOString().split('T')[0],
              duration: Math.ceil((stageEnd.getTime() - stageStart.getTime()) / (1000 * 60 * 60 * 24))
            }).eq('id', parentId);
          }
          currentDate = new Date(stageEnd);
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Orphan tasks
        const orphans = estimateItems.filter((t: any) =>
          !estimateStages.some((s: any) => s.id === t.stage_id)
        );
        for (const task of orphans) {
          const taskDuration = Math.max(task.duration || 1, 1);
          const taskStart = getNextWorkingDay(currentDate, wd);
          const taskEnd = addWorkingDays(taskStart, taskDuration, wd);
          await supabase.from('gantt_tasks').insert({
            project_id: projectId,
            title: task.name,
            start_date: taskStart.toISOString().split('T')[0],
            end_date: taskEnd.toISOString().split('T')[0],
            duration: taskDuration,
            progress: 0,
            is_milestone: false,
            sort_order: sortOrder++,
            source: 'estimate'
          });
          currentDate = new Date(taskEnd);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Refresh projects and navigate to the created gantt
      await loadProjects();
      const { data: freshProj } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (freshProj) {
        setSelectedProject(freshProj);
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
      await supabase.from('projects').update({
        name: projectForm.name.trim(),
        status: projectForm.status,
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null
      }).eq('id', editingProject.id);
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
      await supabase.from('gantt_dependencies').delete().eq('project_id', project.id);
      await supabase.from('gantt_tasks').delete().eq('project_id', project.id);
      await supabase.from('projects').delete().eq('id', project.id);
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
      const taskTree = buildTaskTree(tasksRes.data || []);
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
      taskMap.set(task.id, { ...task, children: [], isExpanded: true, level: 0 });
    });
    tasksData.forEach(task => {
      if (task.parent_id && taskMap.has(task.parent_id)) {
        const parent = taskMap.get(task.parent_id)!;
        const child = taskMap.get(task.id)!;
        child.level = (parent.level || 0) + 1;
        parent.children!.push(child);
      }
    });
    // Assign WBS numbers
    const roots = tasksData.filter(t => !t.parent_id).map(t => taskMap.get(t.id)!);
    const assignWbs = (items: GanttTaskWithChildren[], prefix: string) => {
      items.forEach((item, i) => {
        item.wbs = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        if (item.children && item.children.length > 0) assignWbs(item.children, item.wbs);
      });
    };
    assignWbs(roots, '');
    return roots;
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
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()),
        end: new Date(today.getFullYear(), today.getMonth() + 2, 0)
      };
    }
    const starts = allTasks.map(t => new Date(t.start_date!));
    const ends = allTasks.map(t => new Date(t.end_date!));
    const minDate = new Date(Math.min(...starts.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...ends.map(d => d.getTime())));
    // Align to week start (Sunday)
    minDate.setDate(minDate.getDate() - minDate.getDay() - 7);
    maxDate.setDate(maxDate.getDate() + (6 - maxDate.getDay()) + 14);
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

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDatePL = (date: string | Date) => {
    return new Date(date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  };

  const getDaysBetween = (start: Date, end: Date) => {
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const ROW_HEIGHT = 36;
  const dayWidth = zoomLevel === 'day' ? 40 : zoomLevel === 'week' ? 24 : 8;
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

  // Generate week headers
  const weekHeaders = useMemo(() => {
    const weeks: { date: Date; days: number; label: string }[] = [];
    let d = new Date(dateRange.start);
    while (d < dateRange.end) {
      const weekStart = new Date(d);
      // Find end of this week (Saturday)
      const weekEnd = new Date(d);
      weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
      if (weekEnd > dateRange.end) weekEnd.setTime(dateRange.end.getTime());
      const days = getDaysBetween(weekStart, weekEnd) + 1;
      weeks.push({
        date: weekStart,
        days: Math.min(days, getDaysBetween(weekStart, dateRange.end)),
        label: weekStart.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      });
      d = new Date(weekEnd);
      d.setDate(d.getDate() + 1);
    }
    return weeks;
  }, [dateRange]);

  // Task CRUD
  const handleSaveTask = async () => {
    if (!currentUser || !selectedProject || !taskForm.title) return;
    setSaving(true);
    try {
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
        await supabase.from('gantt_tasks').update(data).eq('id', editingTask.id);
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
      await supabase.from('gantt_tasks').delete().eq('id', task.id);
      await loadGanttData();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '', parent_id: '', start_date: new Date().toISOString().split('T')[0],
      end_date: '', duration: 1, progress: 0, color: '#3b82f6', is_milestone: false, assigned_to_id: ''
    });
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : '';
  };

  // ===== PROJECT SELECTION VIEW =====
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
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>
          <button
            onClick={openWizard}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Utwórz Harmonogram
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {projects.length === 0
                ? 'Brak projektów. Utwórz harmonogram, aby rozpocząć.'
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
                  <tr key={project.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedProject(project)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (project.color || '#3b82f6') + '20' }}>
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
                         project.status === 'on_hold' ? 'Wstrzymany' : project.status || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {project.start_date ? new Date(project.start_date).toLocaleDateString('pl-PL') : '–'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {project.end_date ? new Date(project.end_date).toLocaleDateString('pl-PL') : '–'}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleOpenEditProject(project)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edytuj">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteProject(project)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Usuń">
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
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowWizard(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="p-6 pb-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Settings className="w-6 h-6 text-slate-600" />
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
                        isActive ? 'border-blue-500 text-blue-600'
                        : isPast ? 'border-transparent text-slate-500 hover:text-slate-700 cursor-pointer'
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
                {/* Step 1 */}
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
                        sublabel: [p.status === 'active' ? 'Aktywny' : p.status === 'completed' ? 'Zakończony' : p.status, p.customer?.name].filter(Boolean).join(' • ')
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
                        sublabel: [e.request?.investment_name, e.request?.client_name, e.status === 'approved' ? 'Zatwierdzony' : e.status === 'draft' ? 'Szkic' : e.status].filter(Boolean).join(' • ')
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
                        sublabel: [o.project?.name, o.status === 'accepted' ? 'Zaakceptowana' : o.status === 'sent' ? 'Wysłana' : o.status === 'draft' ? 'Szkic' : o.status, o.final_amount ? `${Number(o.final_amount).toLocaleString('pl-PL')} PLN` : ''].filter(Boolean).join(' • ')
                      }))}
                    />
                    {!hasAnySelection && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        Wybierz co najmniej jedno pole, aby kontynuować.
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2 */}
                {wizardStep === 'time' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-500 mb-1.5">Start projektu</label>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Play className="w-4 h-4 text-blue-600" />
                          </div>
                          <input type="date" value={wizardForm.start_date} onChange={e => setWizardForm({ ...wizardForm, start_date: e.target.value })}
                            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-500 mb-1.5">Deadline</label>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-4 h-4 text-red-500" />
                          </div>
                          <input type="date" value={wizardForm.deadline} onChange={e => setWizardForm({ ...wizardForm, deadline: e.target.value })}
                            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 mb-2">Dni robocze</label>
                      <div className="flex gap-2">
                        {DAY_LABELS.map((day, i) => (
                          <button key={day} type="button" onClick={() => {
                            const nd = [...wizardForm.working_days]; nd[i] = !nd[i]; setWizardForm({ ...wizardForm, working_days: nd });
                          }} className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${
                            wizardForm.working_days[i] ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}>{day}</button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-5">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Harmonogram dnia</h4>
                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="block text-sm text-slate-500 mb-1.5">Start</label>
                          <select value={wizardForm.day_start} onChange={e => setWizardForm({ ...wizardForm, day_start: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-500 mb-1.5">Czas pracy</label>
                          <div className="flex items-center gap-2">
                            <input type="number" min={1} max={16} value={wizardForm.work_hours}
                              onChange={e => setWizardForm({ ...wizardForm, work_hours: parseInt(e.target.value) || 8 })}
                              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
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

                {/* Step 3 */}
                {wizardStep === 'tasks' && (
                  <div className="space-y-3">
                    <label className="block text-sm text-slate-500 mb-2">Tryb importu</label>
                    {estimateDataLoading && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-600 mb-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Ładowanie danych z kosztorysu...</span>
                      </div>
                    )}
                    <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      wizardForm.task_mode === 'empty' ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <input type="radio" name="task_mode" checked={wizardForm.task_mode === 'empty'} onChange={() => setWizardForm({ ...wizardForm, task_mode: 'empty' })}
                        className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                      <div>
                        <div className="font-medium text-slate-800">Utwórz pusty harmonogram</div>
                        <div className="text-sm text-slate-400 mt-0.5">Zacznij od zera — dodasz zadania ręcznie.</div>
                      </div>
                    </label>
                    <label className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                      estimateDataLoading || estimateStages.length === 0 ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                      : wizardForm.task_mode === 'general' ? 'border-blue-400 bg-blue-50/50 cursor-pointer'
                      : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}>
                      <input type="radio" name="task_mode" checked={wizardForm.task_mode === 'general'}
                        onChange={() => setWizardForm({ ...wizardForm, task_mode: 'general' })} disabled={estimateDataLoading || estimateStages.length === 0}
                        className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">Ogólny (Działy)</span>
                          {!estimateDataLoading && estimateStages.length === 0 && <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-500 rounded-full">Niedostępne</span>}
                          {estimateDataLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                        </div>
                        <div className="text-sm text-slate-400 mt-0.5">
                          {estimateDataLoading ? 'Ładowanie...' : estimateStages.length === 0 ? 'Brak sekcji w wybranym źródle.' : `Importuje ${estimateStages.length} ${estimateStages.length === 1 ? 'dział' : 'działów'} jako zadania główne.`}
                        </div>
                      </div>
                    </label>
                    <label className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                      estimateDataLoading || estimateItems.length === 0 ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                      : wizardForm.task_mode === 'detailed' ? 'border-blue-400 bg-blue-50/50 cursor-pointer'
                      : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}>
                      <input type="radio" name="task_mode" checked={wizardForm.task_mode === 'detailed'}
                        onChange={() => setWizardForm({ ...wizardForm, task_mode: 'detailed' })} disabled={estimateDataLoading || estimateItems.length === 0}
                        className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">Szczegółowy (Pozycje)</span>
                          {!estimateDataLoading && estimateItems.length === 0 && <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-500 rounded-full">Niedostępne</span>}
                          {estimateDataLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                        </div>
                        <div className="text-sm text-slate-400 mt-0.5">
                          {estimateDataLoading ? 'Ładowanie...' : estimateItems.length === 0 ? 'Brak pozycji w wybranym źródle.' : `Przenosi każdą pozycję jako osobne zadanie (${estimateItems.filter((t: any) => !t.parent_id).length} pozycji).`}
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                {/* Step 4 */}
                {wizardStep === 'resources' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 rounded-xl p-5">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Jak wyliczać czas trwania zadań?</h4>
                      <div className="space-y-3">
                        {([
                          { val: 'slowest' as const, label: 'Decyduje najwolniejszy zasób', badge: 'Zalecane', desc: 'Decyduje ten zasób, który pracuje dłużej (ludzie lub sprzęt).' },
                          { val: 'labor' as const, label: 'Priorytetyzuj robociznę', desc: 'Czas pracy maszyn jest ignorowany (np. koparka czeka na ludzi).' },
                          { val: 'equipment' as const, label: 'Priorytetyzuj sprzęt', desc: 'Decyduje czas pracy głównej maszyny (np. dźwigu).' },
                        ]).map(opt => (
                          <label key={opt.val} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            wizardForm.resource_priority === opt.val ? 'bg-white shadow-sm ring-1 ring-blue-200' : 'hover:bg-white/50'
                          }`}>
                            <input type="radio" name="rp" checked={wizardForm.resource_priority === opt.val}
                              onChange={() => setWizardForm({ ...wizardForm, resource_priority: opt.val })}
                              className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800">{opt.label}</span>
                                {opt.badge && <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">{opt.badge}</span>}
                              </div>
                              <div className="text-sm text-slate-400 mt-0.5">{opt.desc}</div>
                            </div>
                          </label>
                        ))}
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
                  {wizardSaving && <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Zajmie to mniej niż minutę.</span>}
                </div>
                <div className="flex items-center gap-3">
                  {wizardStepIndex > 0 ? (
                    <button onClick={goPrevStep} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Wstecz</button>
                  ) : (
                    <button onClick={() => setShowWizard(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Anuluj</button>
                  )}
                  {wizardStepIndex < WIZARD_STEPS.length - 1 ? (
                    <button onClick={goNextStep} disabled={!canGoNext()}
                      className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium">
                      Dalej <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={handleCreateHarmonogram} disabled={wizardSaving}
                      className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium">
                      {wizardSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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

  // ===== GANTT VIEW (Bryntum-style) =====
  const isParentTask = (task: GanttTaskWithChildren) => task.children && task.children.length > 0;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center gap-2 flex-shrink-0">
        <button onClick={() => setSelectedProject(null)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="Wróć">
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <button onClick={() => { resetTaskForm(); setEditingTask(null); setShowTaskModal(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-3.5 h-3.5" /> Dodaj
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          {(['day', 'week', 'month'] as ZoomLevel[]).map(z => (
            <button key={z} onClick={() => setZoomLevel(z)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${zoomLevel === z ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {z === 'day' ? 'Dzień' : z === 'week' ? 'Tydzień' : 'Miesiąc'}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-slate-200" />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-slate-800 truncate">{selectedProject.name}</span>
          <span className="text-xs text-slate-400">{flatTasks.length} zadań</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input type="text" placeholder="Szukaj zadań..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-44 focus:ring-1 focus:ring-blue-200 focus:border-blue-400" />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : flatTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">Brak zadań w harmonogramie</p>
            <button onClick={() => { resetTaskForm(); setShowTaskModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Dodaj pierwsze zadanie</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: task table */}
          <div className="flex-shrink-0 border-r border-slate-300 bg-white overflow-auto" style={{ width: 520 }}>
            {/* Table header */}
            <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-300 flex items-center text-xs font-semibold text-slate-500 uppercase" style={{ height: 56 }}>
              <div className="w-10 text-center shrink-0">#</div>
              <div className="flex-1 px-2">Nazwa</div>
              <div className="w-24 px-2 text-right">Start</div>
              <div className="w-16 px-2 text-right">Dni</div>
              <div className="w-12" />
            </div>
            {/* Table rows */}
            {flatTasks.map((task, rowIdx) => {
              const title = getTaskTitle(task);
              const isParent = isParentTask(task);
              if (search && !title.toLowerCase().includes(search.toLowerCase())) return null;
              return (
                <div key={task.id} className={`flex items-center border-b border-slate-100 group hover:bg-blue-50/40 ${isParent ? 'font-semibold' : ''}`}
                  style={{ height: ROW_HEIGHT }}>
                  <div className="w-10 text-center text-xs text-slate-400 shrink-0">{rowIdx + 1}</div>
                  <div className="flex-1 flex items-center gap-1 px-1 min-w-0" style={{ paddingLeft: `${4 + (task.level || 0) * 18}px` }}>
                    {isParent ? (
                      <button onClick={() => toggleTaskExpand(task.id)} className="p-0.5 flex-shrink-0">
                        {task.isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    ) : (
                      <span className="w-4 flex-shrink-0 flex justify-center">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.color || '#3b82f6' }} />
                      </span>
                    )}
                    <span className="text-xs text-slate-400 mr-1 flex-shrink-0">{task.wbs}</span>
                    <span className={`text-sm truncate ${isParent ? 'text-slate-800' : 'text-slate-700'}`}>{title}</span>
                  </div>
                  <div className="w-24 px-2 text-right text-xs text-slate-500">
                    {task.start_date ? formatDateShort(new Date(task.start_date)) : '–'}
                  </div>
                  <div className="w-16 px-2 text-right text-xs text-slate-500">{task.duration || '–'}</div>
                  <div className="w-12 flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button onClick={() => {
                      setEditingTask(task);
                      setTaskForm({
                        title: task.title || getTaskTitle(task), parent_id: task.parent_id || '',
                        start_date: task.start_date?.split('T')[0] || '', end_date: task.end_date?.split('T')[0] || '',
                        duration: task.duration || 1, progress: task.progress || 0,
                        color: task.color || '#3b82f6', is_milestone: task.is_milestone || false,
                        assigned_to_id: task.assigned_to_id || ''
                      }); setShowTaskModal(true);
                    }} className="p-1 hover:bg-slate-200 rounded"><Pencil className="w-3 h-3 text-slate-400" /></button>
                    <button onClick={() => handleDeleteTask(task)} className="p-1 hover:bg-red-100 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: timeline chart */}
          <div className="flex-1 overflow-auto relative" ref={containerRef}>
            <div style={{ width: chartWidth, minHeight: '100%' }} className="relative">
              {/* Timeline header — 2 rows */}
              <div className="sticky top-0 z-10" style={{ height: 56 }}>
                {/* Row 1: week labels */}
                <div className="flex h-7 bg-slate-50 border-b border-slate-200">
                  {weekHeaders.map((w, i) => (
                    <div key={i} className="border-r border-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-500 overflow-hidden"
                      style={{ width: w.days * dayWidth, minWidth: 0 }}>
                      {w.days * dayWidth > 60 && <span className="truncate px-1">{w.label}</span>}
                    </div>
                  ))}
                </div>
                {/* Row 2: day letters */}
                <div className="flex h-7 bg-slate-50 border-b border-slate-300">
                  {Array.from({ length: totalDays }).map((_, i) => {
                    const date = new Date(dateRange.start);
                    date.setDate(date.getDate() + i);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <div key={i} className={`flex-shrink-0 flex items-center justify-center text-[10px] border-r border-slate-100 ${
                        isToday ? 'bg-amber-100 text-amber-700 font-bold' : isWeekend ? 'bg-slate-100 text-slate-400' : 'text-slate-500'
                      }`} style={{ width: dayWidth }}>
                        {dayWidth >= 16 && DAY_LETTERS[date.getDay()]}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Today line */}
              {(() => {
                const today = new Date();
                if (today >= dateRange.start && today <= dateRange.end) {
                  const daysFromStart = getDaysBetween(dateRange.start, today);
                  return <div className="absolute z-30 pointer-events-none" style={{ left: daysFromStart * dayWidth, top: 0, bottom: 0, width: 2, background: 'rgba(245,158,11,0.7)' }} />;
                }
                return null;
              })()}

              {/* Task rows + bars */}
              {flatTasks.map((task, rowIdx) => {
                const pos = getTaskPosition(task);
                const isParent = isParentTask(task);
                const title = getTaskTitle(task);
                if (search && !title.toLowerCase().includes(search.toLowerCase())) return null;

                return (
                  <div key={task.id} className="relative border-b border-slate-50" style={{ height: ROW_HEIGHT }}>
                    {/* Weekend columns */}
                    {Array.from({ length: totalDays }).map((_, i) => {
                      const date = new Date(dateRange.start);
                      date.setDate(date.getDate() + i);
                      if (date.getDay() !== 0 && date.getDay() !== 6) return null;
                      return <div key={i} className="absolute top-0 bottom-0 bg-slate-50/70" style={{ left: i * dayWidth, width: dayWidth }} />;
                    })}

                    {task.start_date && task.end_date && (
                      <>
                        {/* Task bar */}
                        {task.is_milestone ? (
                          <div className="absolute w-3.5 h-3.5 rotate-45 bg-amber-500 border-2 border-amber-600 z-10"
                            style={{ left: pos.left - 7, top: (ROW_HEIGHT - 14) / 2 }}
                            title={`${title}: ${formatDateShort(new Date(task.start_date))}`} />
                        ) : isParent ? (
                          // Summary bar (blue trapezoid style)
                          <div className="absolute z-10 flex items-end" style={{ left: pos.left, width: pos.width, top: (ROW_HEIGHT - 10) / 2, height: 10 }}>
                            <div className="w-full h-1.5 rounded-sm" style={{ backgroundColor: PARENT_COLOR }} />
                            <div className="absolute left-0 bottom-0 w-2 h-2.5" style={{ backgroundColor: PARENT_COLOR, clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
                            <div className="absolute right-0 bottom-0 w-2 h-2.5" style={{ backgroundColor: PARENT_COLOR, clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
                          </div>
                        ) : (
                          <div className="absolute z-10 rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            style={{ left: pos.left, width: pos.width, top: (ROW_HEIGHT - 18) / 2, height: 18, backgroundColor: task.color || '#3b82f6' }}
                            title={`${title}: ${formatDateShort(new Date(task.start_date))} – ${formatDateShort(new Date(task.end_date))}`}>
                            {/* Progress */}
                            {task.progress > 0 && (
                              <div className="absolute left-0 top-0 bottom-0 rounded-sm" style={{ width: `${task.progress}%`, backgroundColor: 'rgba(0,0,0,0.15)' }} />
                            )}
                          </div>
                        )}
                        {/* Label to the right of bar */}
                        {!task.is_milestone && pos.width > 0 && (
                          <span className="absolute z-10 text-[11px] text-slate-600 whitespace-nowrap pointer-events-none"
                            style={{ left: pos.left + pos.width + 6, top: (ROW_HEIGHT - 16) / 2, lineHeight: '16px' }}>
                            {title}
                          </span>
                        )}
                      </>
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
              <h2 className="text-lg font-semibold">{editingTask ? 'Edytuj zadanie' : 'Nowe zadanie'}</h2>
              <button onClick={() => setShowTaskModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa zadania *</label>
                <input type="text" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="np. Instalacja elektryczna piętra 1" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={taskForm.is_milestone} onChange={e => setTaskForm({ ...taskForm, is_milestone: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-slate-700">Kamień milowy</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zadanie nadrzędne</label>
                <select value={taskForm.parent_id} onChange={e => setTaskForm({ ...taskForm, parent_id: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="">-- Brak (główny poziom) --</option>
                  {flatTasks.filter(t => t.id !== editingTask?.id).map(t => (
                    <option key={t.id} value={t.id}>{'  '.repeat(t.level || 0)}{getTaskTitle(t)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data rozpoczęcia *</label>
                  <input type="date" value={taskForm.start_date} onChange={e => setTaskForm({ ...taskForm, start_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{taskForm.is_milestone ? 'Data' : 'Data zakończenia'}</label>
                  <input type="date" value={taskForm.end_date} onChange={e => setTaskForm({ ...taskForm, end_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" disabled={taskForm.is_milestone} />
                </div>
              </div>
              {!taskForm.is_milestone && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Czas trwania (dni)</label>
                    <input type="number" value={taskForm.duration} onChange={e => {
                      const days = parseInt(e.target.value) || 1;
                      const nf = { ...taskForm, duration: days };
                      if (taskForm.start_date) { const s = new Date(taskForm.start_date); s.setDate(s.getDate() + days); nf.end_date = s.toISOString().split('T')[0]; }
                      setTaskForm(nf);
                    }} className="w-full px-3 py-2 border border-slate-200 rounded-lg" min="1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Postęp (%)</label>
                    <input type="number" value={taskForm.progress} onChange={e => setTaskForm({ ...taskForm, progress: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" min="0" max="100" />
                  </div>
                </div>
              )}
              {!taskForm.is_milestone && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kolor</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={taskForm.color} onChange={e => setTaskForm({ ...taskForm, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                    <div className="flex gap-1">
                      {TASK_COLORS.map(color => (
                        <button key={color} type="button" onClick={() => setTaskForm({ ...taskForm, color })}
                          className={`w-8 h-8 rounded transition ${taskForm.color === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`} style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Przypisane do</label>
                <select value={taskForm.assigned_to_id} onChange={e => setTaskForm({ ...taskForm, assigned_to_id: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="">-- Nie przypisano --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleSaveTask} disabled={!taskForm.title || !taskForm.start_date || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
              <button onClick={() => { setShowProjectEditModal(false); setEditingProject(null); }} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa projektu *</label>
                <input type="text" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="active">Aktywny</option>
                  <option value="on_hold">Wstrzymany</option>
                  <option value="completed">Zakończony</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data rozpoczęcia</label>
                  <input type="date" value={projectForm.start_date} onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data zakończenia</label>
                  <input type="date" value={projectForm.end_date} onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { setShowProjectEditModal(false); setEditingProject(null); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Anuluj</button>
              <button onClick={handleSaveProject} disabled={saving || !projectForm.name.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttPage;
