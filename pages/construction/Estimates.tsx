import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, X, Search, Calculator, ChevronRight, ChevronDown, Loader2,
  FolderOpen, FileText, Package, Users, Wrench, PieChart, Trash2,
  Pencil, Copy, Download, Upload, Eye, Settings, ArrowLeft,
  DollarSign, Percent, MoreVertical, GripVertical, Check, AlertCircle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project, EstimateStage, EstimateTask, EstimateResource,
  EstimateMarkup, UnitMeasure, Valuation, ValuationGroup, ResourceType
} from '../../types';
import {
  RESOURCE_TYPE_LABELS, RESOURCE_TYPE_COLORS, RESOURCE_TYPE_ICONS
} from '../../constants';

interface StageWithChildren extends EstimateStage {
  children?: StageWithChildren[];
  tasks?: TaskWithResources[];
  isExpanded?: boolean;
}

interface TaskWithResources extends EstimateTask {
  children?: TaskWithResources[];
  resources?: EstimateResource[];
  isExpanded?: boolean;
}

const ResourceTypeIcon: React.FC<{ type: ResourceType; className?: string }> = ({ type, className = 'w-4 h-4' }) => {
  const icons = { labor: Users, material: Package, equipment: Wrench, overhead: PieChart };
  const Icon = icons[type] || Package;
  return <Icon className={className} />;
};

export const EstimatesPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<StageWithChildren[]>([]);
  const [unitMeasures, setUnitMeasures] = useState<UnitMeasure[]>([]);
  const [valuationGroups, setValuationGroups] = useState<ValuationGroup[]>([]);
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [markups, setMarkups] = useState<EstimateMarkup[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showStageModal, setShowStageModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showMarkupModal, setShowMarkupModal] = useState(false);
  const [showValuationPanel, setShowValuationPanel] = useState(false);

  const [editingStage, setEditingStage] = useState<EstimateStage | null>(null);
  const [editingTask, setEditingTask] = useState<EstimateTask | null>(null);
  const [editingResource, setEditingResource] = useState<EstimateResource | null>(null);
  const [parentStageId, setParentStageId] = useState<string | null>(null);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadProjects();
      loadUnitMeasures();
      loadValuations();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedProject) {
      loadEstimateData();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false });
      if (data) setProjects(data);
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  };

  const loadUnitMeasures = async () => {
    try {
      const { data } = await supabase
        .from('unit_measures')
        .select('*')
        .or(`company_id.eq.${currentUser?.company_id},is_system.eq.true`)
        .order('id');
      if (data) setUnitMeasures(data);
    } catch (err) {
      console.error('Error loading unit measures:', err);
    }
  };

  const loadValuations = async () => {
    if (!currentUser) return;
    try {
      const [groupsRes, valsRes] = await Promise.all([
        supabase.from('valuation_groups').select('*').eq('company_id', currentUser.company_id).order('sort_order'),
        supabase.from('valuations').select('*').eq('company_id', currentUser.company_id).eq('is_active', true)
      ]);
      if (groupsRes.data) setValuationGroups(groupsRes.data);
      if (valsRes.data) setValuations(valsRes.data);
    } catch (err) {
      console.error('Error loading valuations:', err);
    }
  };

  const loadEstimateData = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const [stagesRes, tasksRes, resourcesRes, markupsRes] = await Promise.all([
        supabase.from('estimate_stages').select('*').eq('project_id', selectedProject.id).order('sort_order'),
        supabase.from('estimate_tasks').select('*').eq('project_id', selectedProject.id).order('sort_order'),
        supabase.from('estimate_resources').select('*').eq('project_id', selectedProject.id).order('sort_order'),
        supabase.from('estimate_markups').select('*').eq('project_id', selectedProject.id).order('sort_order')
      ]);

      const stagesData = stagesRes.data || [];
      const tasksData = tasksRes.data || [];
      const resourcesData = resourcesRes.data || [];

      // Build hierarchical structure
      const stagesWithTasks = buildStageHierarchy(stagesData, tasksData, resourcesData);
      setStages(stagesWithTasks);
      setMarkups(markupsRes.data || []);
    } catch (err) {
      console.error('Error loading estimate data:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildStageHierarchy = (
    stagesData: EstimateStage[],
    tasksData: EstimateTask[],
    resourcesData: EstimateResource[]
  ): StageWithChildren[] => {
    // Build task hierarchy with resources
    const taskMap = new Map<string, TaskWithResources>();
    tasksData.forEach(task => {
      taskMap.set(task.id, {
        ...task,
        children: [],
        resources: resourcesData.filter(r => r.task_id === task.id),
        isExpanded: false
      });
    });

    // Build parent-child relationships for tasks
    tasksData.forEach(task => {
      if (task.parent_id && taskMap.has(task.parent_id)) {
        taskMap.get(task.parent_id)!.children!.push(taskMap.get(task.id)!);
      }
    });

    // Get root tasks per stage
    const rootTasksByStage = new Map<string, TaskWithResources[]>();
    tasksData.forEach(task => {
      if (!task.parent_id) {
        if (!rootTasksByStage.has(task.stage_id)) {
          rootTasksByStage.set(task.stage_id, []);
        }
        rootTasksByStage.get(task.stage_id)!.push(taskMap.get(task.id)!);
      }
    });

    // Build stage hierarchy
    const stageMap = new Map<string, StageWithChildren>();
    stagesData.forEach(stage => {
      stageMap.set(stage.id, {
        ...stage,
        children: [],
        tasks: rootTasksByStage.get(stage.id) || [],
        isExpanded: true
      });
    });

    stagesData.forEach(stage => {
      if (stage.parent_id && stageMap.has(stage.parent_id)) {
        stageMap.get(stage.parent_id)!.children!.push(stageMap.get(stage.id)!);
      }
    });

    return stagesData
      .filter(s => !s.parent_id)
      .map(s => stageMap.get(s.id)!);
  };

  const calculateStageTotals = useCallback((stage: StageWithChildren): { cost: number; costWithMarkup: number } => {
    let cost = 0;
    let costWithMarkup = 0;

    const calculateTaskTotals = (task: TaskWithResources) => {
      task.resources?.forEach(r => {
        cost += r.cost || 0;
        costWithMarkup += r.cost_with_markup || 0;
      });
      task.children?.forEach(calculateTaskTotals);
    };

    stage.tasks?.forEach(calculateTaskTotals);
    stage.children?.forEach(child => {
      const childTotals = calculateStageTotals(child);
      cost += childTotals.cost;
      costWithMarkup += childTotals.costWithMarkup;
    });

    return { cost, costWithMarkup };
  }, []);

  const grandTotal = useMemo(() => {
    let subtotal = 0;
    let subtotalWithMarkup = 0;

    stages.forEach(stage => {
      const totals = calculateStageTotals(stage);
      subtotal += totals.cost;
      subtotalWithMarkup += totals.costWithMarkup;
    });

    // Apply project markups
    let total = subtotalWithMarkup;
    let nds = 0;

    markups.forEach(m => {
      if (m.is_nds) {
        nds += m.type === 'percent' ? total * (m.value / 100) : m.value;
      } else {
        total += m.type === 'percent' ? total * (m.value / 100) : m.value;
      }
    });

    return { subtotal, subtotalWithMarkup, nds, total: total + nds };
  }, [stages, markups, calculateStageTotals]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

  const toggleStageExpand = (stageId: string) => {
    setStages(prev => {
      const toggle = (items: StageWithChildren[]): StageWithChildren[] =>
        items.map(item => ({
          ...item,
          isExpanded: item.id === stageId ? !item.isExpanded : item.isExpanded,
          children: item.children ? toggle(item.children) : undefined
        }));
      return toggle(prev);
    });
  };

  // Project selection view
  if (!selectedProject) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Kosztorysowanie</h1>
          <p className="text-slate-600 mt-1">Wybierz projekt, aby rozpocząć kosztorysowanie</p>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj projektu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: project.color + '20' }}
                  >
                    <Calculator className="w-5 h-5" style={{ color: project.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600">
                      {project.name}
                    </h3>
                    <p className="text-sm text-slate-500">{project.code || 'Brak kodu'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                </div>
              </button>
            ))}
        </div>

        {projects.length === 0 && !loading && (
          <div className="text-center py-12">
            <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Brak projektów. Utwórz projekt, aby rozpocząć kosztorysowanie.</p>
          </div>
        )}
      </div>
    );
  }

  // Estimate detail view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedProject(null)}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">{selectedProject.name}</h1>
            <p className="text-sm text-slate-500">Kosztorys projektu</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowValuationPanel(!showValuationPanel)}
              className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-600"
              title="Cennik"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowMarkupModal(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-600"
              title="Narzuty"
            >
              <Percent className="w-5 h-5" />
            </button>
            <button
              onClick={() => {/* TODO: export */}}
              className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-600"
              title="Eksport"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* Stages list */}
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">Etapy i pozycje</h2>
                <button
                  onClick={() => {
                    setEditingStage(null);
                    setParentStageId(null);
                    setShowStageModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Dodaj etap
                </button>
              </div>

              {stages.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                  <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">Brak etapów w kosztorysie</p>
                  <button
                    onClick={() => {
                      setEditingStage(null);
                      setParentStageId(null);
                      setShowStageModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Utwórz pierwszy etap
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {stages.map(stage => (
                    <StageItem
                      key={stage.id}
                      stage={stage}
                      level={0}
                      onToggle={toggleStageExpand}
                      onEditStage={(s) => { setEditingStage(s); setShowStageModal(true); }}
                      onAddSubStage={(parentId) => { setParentStageId(parentId); setEditingStage(null); setShowStageModal(true); }}
                      onAddTask={(stageId) => { setCurrentStageId(stageId); setEditingTask(null); setShowTaskModal(true); }}
                      calculateStageTotals={calculateStageTotals}
                      formatCurrency={formatCurrency}
                      unitMeasures={unitMeasures}
                    />
                  ))}
                </div>
              )}

              {/* Totals panel */}
              {stages.length > 0 && (
                <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-3">Podsumowanie kosztorysu</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Suma kosztów</p>
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(grandTotal.subtotal)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Z narzutami</p>
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(grandTotal.subtotalWithMarkup)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">VAT</p>
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(grandTotal.nds)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Razem</p>
                      <p className="text-xl font-bold text-blue-600">{formatCurrency(grandTotal.total)}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Valuation sidebar */}
        {showValuationPanel && (
          <div className="w-80 border-l border-slate-200 bg-white overflow-auto">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Cennik</h3>
              <button
                onClick={() => setShowValuationPanel(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Szukaj wyceny..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              {valuationGroups.map(group => (
                <div key={group.id} className="mb-2">
                  <button className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg text-left">
                    <FolderOpen className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-slate-700">{group.name}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Stage item component
interface StageItemProps {
  stage: StageWithChildren;
  level: number;
  onToggle: (id: string) => void;
  onEditStage: (stage: EstimateStage) => void;
  onAddSubStage: (parentId: string) => void;
  onAddTask: (stageId: string) => void;
  calculateStageTotals: (stage: StageWithChildren) => { cost: number; costWithMarkup: number };
  formatCurrency: (value: number) => string;
  unitMeasures: UnitMeasure[];
}

const StageItem: React.FC<StageItemProps> = ({
  stage, level, onToggle, onEditStage, onAddSubStage, onAddTask,
  calculateStageTotals, formatCurrency, unitMeasures
}) => {
  const totals = calculateStageTotals(stage);
  const hasChildren = (stage.children && stage.children.length > 0) || (stage.tasks && stage.tasks.length > 0);

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-50"
        style={{ paddingLeft: `${12 + level * 20}px` }}
        onClick={() => onToggle(stage.id)}
      >
        {hasChildren ? (
          stage.isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )
        ) : (
          <span className="w-4" />
        )}
        <FolderOpen className="w-5 h-5 text-amber-500" />
        <span className="flex-1 font-medium text-slate-900">{stage.name}</span>
        <span className="text-sm text-slate-500">{formatCurrency(totals.costWithMarkup)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onEditStage(stage); }}
          className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100"
        >
          <Pencil className="w-4 h-4 text-slate-400" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAddTask(stage.id); }}
          className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100"
        >
          <Plus className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {stage.isExpanded && (
        <div className="border-t border-slate-100">
          {/* Child stages */}
          {stage.children?.map(child => (
            <StageItem
              key={child.id}
              stage={child}
              level={level + 1}
              onToggle={onToggle}
              onEditStage={onEditStage}
              onAddSubStage={onAddSubStage}
              onAddTask={onAddTask}
              calculateStageTotals={calculateStageTotals}
              formatCurrency={formatCurrency}
              unitMeasures={unitMeasures}
            />
          ))}

          {/* Tasks */}
          {stage.tasks?.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              level={level + 1}
              formatCurrency={formatCurrency}
              unitMeasures={unitMeasures}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Task item component
interface TaskItemProps {
  task: TaskWithResources;
  level: number;
  formatCurrency: (value: number) => string;
  unitMeasures: UnitMeasure[];
}

const TaskItem: React.FC<TaskItemProps> = ({ task, level, formatCurrency, unitMeasures }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = (task.children && task.children.length > 0) || (task.resources && task.resources.length > 0);

  const taskTotal = useMemo(() => {
    let total = 0;
    task.resources?.forEach(r => { total += r.cost_with_markup || 0; });
    return total;
  }, [task.resources]);

  const unit = unitMeasures.find(u => u.id === task.unit_measure_id);

  return (
    <div className="border-t border-slate-100">
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-slate-50"
        style={{ paddingLeft: `${12 + level * 20}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )
        ) : (
          <span className="w-4" />
        )}
        <FileText className="w-4 h-4 text-blue-500" />
        <span className="flex-1 text-sm text-slate-700">{task.name}</span>
        <span className="text-xs text-slate-500">{task.volume} {unit?.code || ''}</span>
        <span className="text-sm font-medium text-slate-900 w-24 text-right">{formatCurrency(taskTotal)}</span>
      </div>

      {isExpanded && task.resources && task.resources.length > 0 && (
        <div className="bg-slate-50">
          {task.resources.map(resource => {
            const resourceUnit = unitMeasures.find(u => u.id === resource.unit_measure_id);
            return (
              <div
                key={resource.id}
                className="flex items-center gap-2 p-2 text-sm hover:bg-slate-100"
                style={{ paddingLeft: `${12 + (level + 1) * 20}px` }}
              >
                <ResourceTypeIcon type={resource.resource_type} className="w-4 h-4 text-slate-400" />
                <span className="flex-1 text-slate-600">{resource.name}</span>
                <span className="text-xs text-slate-500">{resource.volume} {resourceUnit?.code || ''}</span>
                <span className="text-xs text-slate-500 w-20 text-right">{formatCurrency(resource.price || 0)}</span>
                <span className="text-sm font-medium text-slate-700 w-24 text-right">{formatCurrency(resource.cost_with_markup || 0)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EstimatesPage;
