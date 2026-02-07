import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, X, Search, Calculator, ChevronRight, ChevronDown, Loader2,
  FolderOpen, FileText, Package, Users, Wrench, PieChart, Trash2,
  Pencil, Copy, Download, Upload, Eye, Settings, ArrowLeft,
  DollarSign, Percent, MoreVertical, GripVertical, Check, AlertCircle,
  Save, XCircle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project, EstimateStage, EstimateTask, EstimateResource,
  EstimateMarkup, UnitMeasure, Valuation, ValuationGroup, ResourceType
} from '../../types';

// Resource type config
const RESOURCE_TYPE_CONFIG: Record<ResourceType, { label: string; color: string; bgColor: string; icon: React.FC<{className?: string}> }> = {
  labor: { label: 'Robocizna', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Users },
  material: { label: 'Materiał', color: 'text-green-600', bgColor: 'bg-green-100', icon: Package },
  equipment: { label: 'Sprzęt', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: Wrench },
  overhead: { label: 'Narzuty', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: PieChart }
};

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

// Inline editable cell component
const EditableCell: React.FC<{
  value: string | number;
  type?: 'text' | 'number';
  onSave: (value: string | number) => void;
  className?: string;
  suffix?: string;
}> = ({ value, type = 'text', onSave, className = '', suffix = '' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const handleSave = () => {
    const newValue = type === 'number' ? parseFloat(editValue) || 0 : editValue;
    onSave(newValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(String(value));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        type={type}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`w-full px-1 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => { setEditValue(String(value)); setIsEditing(true); }}
      className={`cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${className}`}
    >
      {type === 'number' ? Number(value).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
      {suffix}
    </span>
  );
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
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [valuationSearch, setValuationSearch] = useState('');

  // Modal states
  const [showStageModal, setShowStageModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showMarkupModal, setShowMarkupModal] = useState(false);
  const [showValuationPanel, setShowValuationPanel] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'stage' | 'task' | 'resource'; id: string; name: string } | null>(null);

  // Form states
  const [editingStage, setEditingStage] = useState<EstimateStage | null>(null);
  const [editingTask, setEditingTask] = useState<EstimateTask | null>(null);
  const [editingResource, setEditingResource] = useState<EstimateResource | null>(null);
  const [parentStageId, setParentStageId] = useState<string | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // Form data
  const [stageForm, setStageForm] = useState({ name: '', code: '' });
  const [taskForm, setTaskForm] = useState({ name: '', code: '', volume: 1, unit_measure_id: 0, is_group: false });
  const [resourceForm, setResourceForm] = useState({
    name: '', code: '', resource_type: 'material' as ResourceType,
    unit_measure_id: 0, volume: 1, price: 0, markup: 0, url: ''
  });
  const [markupForm, setMarkupForm] = useState({ name: '', value: 0, type: 'percent' as 'percent' | 'fixed', is_nds: false });

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
        supabase.from('valuations').select('*, unit_measure:unit_measures(*)').eq('company_id', currentUser.company_id).eq('is_active', true)
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
    const taskMap = new Map<string, TaskWithResources>();
    tasksData.forEach(task => {
      taskMap.set(task.id, {
        ...task,
        children: [],
        resources: resourcesData.filter(r => r.task_id === task.id),
        isExpanded: true
      });
    });

    tasksData.forEach(task => {
      if (task.parent_id && taskMap.has(task.parent_id)) {
        taskMap.get(task.parent_id)!.children!.push(taskMap.get(task.id)!);
      }
    });

    const rootTasksByStage = new Map<string, TaskWithResources[]>();
    tasksData.forEach(task => {
      if (!task.parent_id) {
        if (!rootTasksByStage.has(task.stage_id)) {
          rootTasksByStage.set(task.stage_id, []);
        }
        rootTasksByStage.get(task.stage_id)!.push(taskMap.get(task.id)!);
      }
    });

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

    return stagesData.filter(s => !s.parent_id).map(s => stageMap.get(s.id)!);
  };

  // CRUD Operations
  const handleSaveStage = async () => {
    if (!selectedProject || !stageForm.name.trim()) return;
    setSaving(true);
    try {
      const stageData = {
        project_id: selectedProject.id,
        parent_id: parentStageId || null,
        name: stageForm.name.trim(),
        code: stageForm.code.trim() || null,
        sort_order: stages.length
      };

      if (editingStage) {
        await supabase.from('estimate_stages').update(stageData).eq('id', editingStage.id);
      } else {
        await supabase.from('estimate_stages').insert(stageData);
      }

      await loadEstimateData();
      setShowStageModal(false);
      setStageForm({ name: '', code: '' });
      setEditingStage(null);
      setParentStageId(null);
    } catch (err) {
      console.error('Error saving stage:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTask = async () => {
    if (!selectedProject || !currentStageId || !taskForm.name.trim()) return;
    setSaving(true);
    try {
      const taskData = {
        project_id: selectedProject.id,
        stage_id: currentStageId,
        name: taskForm.name.trim(),
        code: taskForm.code.trim() || null,
        volume: taskForm.volume,
        unit_measure_id: taskForm.unit_measure_id || null,
        is_group: taskForm.is_group,
        calculate_mode: 'by_resources' as const,
        sort_order: 0
      };

      if (editingTask) {
        await supabase.from('estimate_tasks').update(taskData).eq('id', editingTask.id);
      } else {
        await supabase.from('estimate_tasks').insert(taskData);
      }

      await loadEstimateData();
      setShowTaskModal(false);
      setTaskForm({ name: '', code: '', volume: 1, unit_measure_id: 0, is_group: false });
      setEditingTask(null);
      setCurrentStageId(null);
    } catch (err) {
      console.error('Error saving task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResource = async () => {
    if (!selectedProject || !currentTaskId || !resourceForm.name.trim()) return;
    setSaving(true);
    try {
      const cost = resourceForm.volume * resourceForm.price;
      const priceWithMarkup = resourceForm.price * (1 + resourceForm.markup / 100);
      const costWithMarkup = resourceForm.volume * priceWithMarkup;

      const resourceData = {
        project_id: selectedProject.id,
        task_id: currentTaskId,
        name: resourceForm.name.trim(),
        code: resourceForm.code.trim() || null,
        resource_type: resourceForm.resource_type,
        unit_measure_id: resourceForm.unit_measure_id || null,
        volume: resourceForm.volume,
        price: resourceForm.price,
        markup: resourceForm.markup,
        cost,
        price_with_markup: priceWithMarkup,
        cost_with_markup: costWithMarkup,
        url: resourceForm.url || null,
        sort_order: 0
      };

      if (editingResource) {
        await supabase.from('estimate_resources').update(resourceData).eq('id', editingResource.id);
      } else {
        await supabase.from('estimate_resources').insert(resourceData);
      }

      await loadEstimateData();
      setShowResourceModal(false);
      setResourceForm({ name: '', code: '', resource_type: 'material', unit_measure_id: 0, volume: 1, price: 0, markup: 0, url: '' });
      setEditingResource(null);
      setCurrentTaskId(null);
    } catch (err) {
      console.error('Error saving resource:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateResource = async (resourceId: string, field: string, value: number | string) => {
    const resource = findResourceById(resourceId);
    if (!resource) return;

    const updatedResource = { ...resource, [field]: value };
    const cost = updatedResource.volume * updatedResource.price;
    const priceWithMarkup = updatedResource.price * (1 + updatedResource.markup / 100);
    const costWithMarkup = updatedResource.volume * priceWithMarkup;

    try {
      await supabase.from('estimate_resources').update({
        [field]: value,
        cost,
        price_with_markup: priceWithMarkup,
        cost_with_markup: costWithMarkup
      }).eq('id', resourceId);
      await loadEstimateData();
    } catch (err) {
      console.error('Error updating resource:', err);
    }
  };

  const findResourceById = (id: string): EstimateResource | null => {
    for (const stage of stages) {
      for (const task of stage.tasks || []) {
        const resource = task.resources?.find(r => r.id === id);
        if (resource) return resource;
      }
    }
    return null;
  };

  const handleAddFromValuation = async (valuation: Valuation) => {
    if (!currentTaskId) {
      alert('Najpierw wybierz pozycję, do której chcesz dodać zasób');
      return;
    }

    setResourceForm({
      name: valuation.name,
      code: valuation.code || '',
      resource_type: valuation.resource_type,
      unit_measure_id: valuation.unit_measure_id || 0,
      volume: 1,
      price: valuation.price,
      markup: 15,
      url: ''
    });
    setShowResourceModal(true);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setSaving(true);
    try {
      const { type, id } = showDeleteConfirm;
      if (type === 'stage') {
        await supabase.from('estimate_stages').delete().eq('id', id);
      } else if (type === 'task') {
        await supabase.from('estimate_tasks').delete().eq('id', id);
      } else if (type === 'resource') {
        await supabase.from('estimate_resources').delete().eq('id', id);
      }
      await loadEstimateData();
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMarkup = async () => {
    if (!selectedProject || !markupForm.name.trim()) return;
    setSaving(true);
    try {
      const markupData = {
        project_id: selectedProject.id,
        name: markupForm.name.trim(),
        value: markupForm.value,
        type: markupForm.type,
        is_nds: markupForm.is_nds,
        sort_order: markups.length
      };
      await supabase.from('estimate_markups').insert(markupData);
      await loadEstimateData();
      setShowMarkupModal(false);
      setMarkupForm({ name: '', value: 0, type: 'percent', is_nds: false });
    } catch (err) {
      console.error('Error saving markup:', err);
    } finally {
      setSaving(false);
    }
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

    let total = subtotalWithMarkup;
    let nds = 0;

    markups.forEach(m => {
      const markupAmount = m.type === 'percent' ? total * (m.value / 100) : m.value;
      if (m.is_nds) {
        nds += markupAmount;
      } else {
        total += markupAmount;
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

  const filteredValuations = useMemo(() => {
    if (!valuationSearch.trim()) return valuations;
    const search = valuationSearch.toLowerCase();
    return valuations.filter(v =>
      v.name.toLowerCase().includes(search) ||
      (v.code && v.code.toLowerCase().includes(search))
    );
  }, [valuations, valuationSearch]);

  // Export to Excel
  const handleExport = async () => {
    // Simple CSV export for now
    let csv = 'Etap;Pozycja;Zasób;Typ;Jednostka;Ilość;Cena;Narzut %;Suma\n';

    stages.forEach(stage => {
      stage.tasks?.forEach(task => {
        task.resources?.forEach(resource => {
          const unit = unitMeasures.find(u => u.id === resource.unit_measure_id);
          csv += `"${stage.name}";"${task.name}";"${resource.name}";"${RESOURCE_TYPE_CONFIG[resource.resource_type].label}";"${unit?.code || ''}";"${resource.volume}";"${resource.price}";"${resource.markup}";"${resource.cost_with_markup}"\n`;
        });
      });
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kosztorys_${selectedProject?.name || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
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
                      style={{ backgroundColor: (project.color || '#3b82f6') + '20' }}
                    >
                      <Calculator className="w-5 h-5" style={{ color: project.color || '#3b82f6' }} />
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
        )}

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
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 shadow-sm">
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
              className={`p-2 rounded-lg transition ${showValuationPanel ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-600'}`}
              title="Cennik"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowMarkupModal(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-600"
              title="Dodaj narzut"
            >
              <Percent className="w-5 h-5" />
            </button>
            <button
              onClick={handleExport}
              className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-600"
              title="Eksport CSV"
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
              {/* Action bar */}
              <div className="mb-4 flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => {
                    setEditingStage(null);
                    setParentStageId(null);
                    setStageForm({ name: '', code: '' });
                    setShowStageModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Dodaj etap
                </button>
                <div className="flex-1" />
                <div className="text-sm text-slate-500">
                  {stages.length} etapów • {grandTotal.subtotal > 0 ? formatCurrency(grandTotal.total) : '0 PLN'}
                </div>
              </div>

              {stages.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                  <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">Brak etapów w kosztorysie</p>
                  <button
                    onClick={() => {
                      setEditingStage(null);
                      setParentStageId(null);
                      setStageForm({ name: '', code: '' });
                      setShowStageModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Utwórz pierwszy etap
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {stages.map(stage => (
                    <StageCard
                      key={stage.id}
                      stage={stage}
                      level={0}
                      onToggle={toggleStageExpand}
                      onEditStage={(s) => {
                        setEditingStage(s);
                        setStageForm({ name: s.name, code: s.code || '' });
                        setShowStageModal(true);
                      }}
                      onDeleteStage={(s) => setShowDeleteConfirm({ type: 'stage', id: s.id, name: s.name })}
                      onAddTask={(stageId) => {
                        setCurrentStageId(stageId);
                        setEditingTask(null);
                        setTaskForm({ name: '', code: '', volume: 1, unit_measure_id: 0, is_group: false });
                        setShowTaskModal(true);
                      }}
                      onEditTask={(t) => {
                        setEditingTask(t);
                        setCurrentStageId(t.stage_id);
                        setTaskForm({
                          name: t.name,
                          code: t.code || '',
                          volume: t.volume,
                          unit_measure_id: t.unit_measure_id || 0,
                          is_group: t.is_group
                        });
                        setShowTaskModal(true);
                      }}
                      onDeleteTask={(t) => setShowDeleteConfirm({ type: 'task', id: t.id, name: t.name })}
                      onAddResource={(taskId) => {
                        setCurrentTaskId(taskId);
                        setEditingResource(null);
                        setResourceForm({ name: '', code: '', resource_type: 'material', unit_measure_id: 0, volume: 1, price: 0, markup: 15, url: '' });
                        setShowResourceModal(true);
                      }}
                      onEditResource={(r) => {
                        setEditingResource(r);
                        setCurrentTaskId(r.task_id);
                        setResourceForm({
                          name: r.name,
                          code: r.code || '',
                          resource_type: r.resource_type,
                          unit_measure_id: r.unit_measure_id || 0,
                          volume: r.volume,
                          price: r.price,
                          markup: r.markup,
                          url: r.url || ''
                        });
                        setShowResourceModal(true);
                      }}
                      onDeleteResource={(r) => setShowDeleteConfirm({ type: 'resource', id: r.id, name: r.name })}
                      onUpdateResource={handleUpdateResource}
                      onSelectTask={(taskId) => setCurrentTaskId(taskId)}
                      selectedTaskId={currentTaskId}
                      calculateStageTotals={calculateStageTotals}
                      formatCurrency={formatCurrency}
                      unitMeasures={unitMeasures}
                    />
                  ))}
                </div>
              )}

              {/* Totals panel */}
              {stages.length > 0 && (
                <div className="mt-6 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-4">Podsumowanie kosztorysu</h3>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Suma kosztów:</span>
                      <span className="font-medium">{formatCurrency(grandTotal.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Z narzutami pozycji:</span>
                      <span className="font-medium">{formatCurrency(grandTotal.subtotalWithMarkup)}</span>
                    </div>

                    {markups.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        {markups.map(m => (
                          <div key={m.id} className="flex justify-between items-center py-1">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600">{m.name}</span>
                              <button
                                onClick={async () => {
                                  await supabase.from('estimate_markups').delete().eq('id', m.id);
                                  await loadEstimateData();
                                }}
                                className="p-1 hover:bg-red-100 rounded text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="font-medium">
                              {m.type === 'percent' ? `${m.value}%` : formatCurrency(m.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {grandTotal.nds > 0 && (
                      <div className="flex justify-between pt-2 border-t border-slate-100">
                        <span className="text-slate-600">VAT:</span>
                        <span className="font-medium">{formatCurrency(grandTotal.nds)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t-2 border-slate-200">
                    <span className="text-lg font-semibold text-slate-900">RAZEM:</span>
                    <span className="text-2xl font-bold text-blue-600">{formatCurrency(grandTotal.total)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Valuation sidebar */}
        {showValuationPanel && (
          <div className="w-80 border-l border-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Cennik</h3>
              <button
                onClick={() => setShowValuationPanel(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Szukaj wyceny..."
                  value={valuationSearch}
                  onChange={e => setValuationSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              {currentTaskId && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ Kliknij pozycję, aby dodać do wybranej pracy
                </p>
              )}
              {!currentTaskId && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠ Wybierz najpierw pracę w kosztorysie
                </p>
              )}
            </div>
            <div className="flex-1 overflow-auto p-2">
              {filteredValuations.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Brak wycen w cenniku
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredValuations.map(val => {
                    const config = RESOURCE_TYPE_CONFIG[val.resource_type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={val.id}
                        onClick={() => handleAddFromValuation(val)}
                        disabled={!currentTaskId}
                        className={`w-full text-left p-2 rounded-lg border transition ${
                          currentTaskId
                            ? 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                            : 'border-slate-100 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`p-1 rounded ${config.bgColor}`}>
                            <Icon className={`w-3 h-3 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{val.name}</p>
                            <p className="text-xs text-slate-500">
                              {val.code && <span className="mr-2">{val.code}</span>}
                              {formatCurrency(val.price)}
                            </p>
                          </div>
                          <Plus className="w-4 h-4 text-slate-400" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stage Modal */}
      {showStageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">
                {editingStage ? 'Edytuj etap' : 'Nowy etap'}
              </h3>
              <button onClick={() => setShowStageModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa etapu *</label>
                <input
                  type="text"
                  value={stageForm.name}
                  onChange={e => setStageForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="np. Elektryka"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kod</label>
                <input
                  type="text"
                  value={stageForm.code}
                  onChange={e => setStageForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="np. E01"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowStageModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveStage}
                disabled={saving || !stageForm.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingStage ? 'Zapisz' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">
                {editingTask ? 'Edytuj pozycję' : 'Nowa pozycja'}
              </h3>
              <button onClick={() => setShowTaskModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa pozycji *</label>
                <input
                  type="text"
                  value={taskForm.name}
                  onChange={e => setTaskForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="np. Montaż instalacji elektrycznej"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kod</label>
                  <input
                    type="text"
                    value={taskForm.code}
                    onChange={e => setTaskForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="np. E01-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ilość</label>
                  <input
                    type="number"
                    value={taskForm.volume}
                    onChange={e => setTaskForm(prev => ({ ...prev, volume: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka</label>
                <select
                  value={taskForm.unit_measure_id}
                  onChange={e => setTaskForm(prev => ({ ...prev, unit_measure_id: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>-- Wybierz --</option>
                  {unitMeasures.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveTask}
                disabled={saving || !taskForm.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingTask ? 'Zapisz' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resource Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">
                {editingResource ? 'Edytuj zasób' : 'Nowy zasób'}
              </h3>
              <button onClick={() => setShowResourceModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa zasobu *</label>
                <input
                  type="text"
                  value={resourceForm.name}
                  onChange={e => setResourceForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="np. Kabel YDY 3x2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kod</label>
                  <input
                    type="text"
                    value={resourceForm.code}
                    onChange={e => setResourceForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Typ</label>
                  <select
                    value={resourceForm.resource_type}
                    onChange={e => setResourceForm(prev => ({ ...prev, resource_type: e.target.value as ResourceType }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(RESOURCE_TYPE_CONFIG).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ilość</label>
                  <input
                    type="number"
                    value={resourceForm.volume}
                    onChange={e => setResourceForm(prev => ({ ...prev, volume: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cena jedn.</label>
                  <input
                    type="number"
                    value={resourceForm.price}
                    onChange={e => setResourceForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Narzut %</label>
                  <input
                    type="number"
                    value={resourceForm.markup}
                    onChange={e => setResourceForm(prev => ({ ...prev, markup: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka</label>
                <select
                  value={resourceForm.unit_measure_id}
                  onChange={e => setResourceForm(prev => ({ ...prev, unit_measure_id: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>-- Wybierz --</option>
                  {unitMeasures.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL (link do produktu)</label>
                <input
                  type="url"
                  value={resourceForm.url}
                  onChange={e => setResourceForm(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Koszt:</span>
                  <span className="font-medium">{formatCurrency(resourceForm.volume * resourceForm.price)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-600">Z narzutem:</span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(resourceForm.volume * resourceForm.price * (1 + resourceForm.markup / 100))}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowResourceModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveResource}
                disabled={saving || !resourceForm.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingResource ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Markup Modal */}
      {showMarkupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Dodaj narzut</h3>
              <button onClick={() => setShowMarkupModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa narzutu *</label>
                <input
                  type="text"
                  value={markupForm.name}
                  onChange={e => setMarkupForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="np. VAT 23%"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Wartość</label>
                  <input
                    type="number"
                    value={markupForm.value}
                    onChange={e => setMarkupForm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Typ</label>
                  <select
                    value={markupForm.type}
                    onChange={e => setMarkupForm(prev => ({ ...prev, type: e.target.value as 'percent' | 'fixed' }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percent">Procent (%)</option>
                    <option value="fixed">Kwota stała (PLN)</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markupForm.is_nds}
                  onChange={e => setMarkupForm(prev => ({ ...prev, is_nds: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">To jest VAT (wyświetlaj osobno)</span>
              </label>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowMarkupModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveMarkup}
                disabled={saving || !markupForm.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Potwierdź usunięcie</h3>
            </div>
            <div className="p-4">
              <p className="text-slate-600">
                Czy na pewno chcesz usunąć <strong>{showDeleteConfirm.name}</strong>?
              </p>
              {showDeleteConfirm.type === 'stage' && (
                <p className="text-sm text-red-600 mt-2">
                  ⚠ Wszystkie pozycje i zasoby w tym etapie zostaną również usunięte.
                </p>
              )}
              {showDeleteConfirm.type === 'task' && (
                <p className="text-sm text-red-600 mt-2">
                  ⚠ Wszystkie zasoby w tej pozycji zostaną również usunięte.
                </p>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Stage Card Component
interface StageCardProps {
  stage: StageWithChildren;
  level: number;
  onToggle: (id: string) => void;
  onEditStage: (stage: EstimateStage) => void;
  onDeleteStage: (stage: EstimateStage) => void;
  onAddTask: (stageId: string) => void;
  onEditTask: (task: EstimateTask) => void;
  onDeleteTask: (task: EstimateTask) => void;
  onAddResource: (taskId: string) => void;
  onEditResource: (resource: EstimateResource) => void;
  onDeleteResource: (resource: EstimateResource) => void;
  onUpdateResource: (resourceId: string, field: string, value: number | string) => void;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  calculateStageTotals: (stage: StageWithChildren) => { cost: number; costWithMarkup: number };
  formatCurrency: (value: number) => string;
  unitMeasures: UnitMeasure[];
}

const StageCard: React.FC<StageCardProps> = ({
  stage, level, onToggle, onEditStage, onDeleteStage, onAddTask, onEditTask, onDeleteTask,
  onAddResource, onEditResource, onDeleteResource, onUpdateResource, onSelectTask, selectedTaskId,
  calculateStageTotals, formatCurrency, unitMeasures
}) => {
  const totals = calculateStageTotals(stage);
  const hasChildren = (stage.children && stage.children.length > 0) || (stage.tasks && stage.tasks.length > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Stage header */}
      <div
        className="flex items-center gap-2 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-slate-100 cursor-pointer hover:from-amber-100 hover:to-orange-100"
        onClick={() => onToggle(stage.id)}
      >
        {hasChildren ? (
          stage.isExpanded ? (
            <ChevronDown className="w-5 h-5 text-amber-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-amber-600" />
          )
        ) : (
          <span className="w-5" />
        )}
        <FolderOpen className="w-5 h-5 text-amber-500" />
        <div className="flex-1">
          <span className="font-semibold text-slate-900">{stage.name}</span>
          {stage.code && <span className="ml-2 text-sm text-slate-500">({stage.code})</span>}
        </div>
        <span className="text-sm font-medium text-slate-700">{formatCurrency(totals.costWithMarkup)}</span>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAddTask(stage.id); }}
            className="p-1.5 hover:bg-white/80 rounded-lg text-slate-500 hover:text-blue-600"
            title="Dodaj pozycję"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEditStage(stage); }}
            className="p-1.5 hover:bg-white/80 rounded-lg text-slate-500 hover:text-blue-600"
            title="Edytuj"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteStage(stage); }}
            className="p-1.5 hover:bg-white/80 rounded-lg text-slate-500 hover:text-red-600"
            title="Usuń"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stage content */}
      {stage.isExpanded && (
        <div className="divide-y divide-slate-100">
          {/* Child stages */}
          {stage.children?.map(child => (
            <div key={child.id} className="pl-4">
              <StageCard
                stage={child}
                level={level + 1}
                onToggle={onToggle}
                onEditStage={onEditStage}
                onDeleteStage={onDeleteStage}
                onAddTask={onAddTask}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                onAddResource={onAddResource}
                onEditResource={onEditResource}
                onDeleteResource={onDeleteResource}
                onUpdateResource={onUpdateResource}
                onSelectTask={onSelectTask}
                selectedTaskId={selectedTaskId}
                calculateStageTotals={calculateStageTotals}
                formatCurrency={formatCurrency}
                unitMeasures={unitMeasures}
              />
            </div>
          ))}

          {/* Tasks */}
          {stage.tasks?.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onAddResource={onAddResource}
              onEditResource={onEditResource}
              onDeleteResource={onDeleteResource}
              onUpdateResource={onUpdateResource}
              onSelectTask={onSelectTask}
              isSelected={selectedTaskId === task.id}
              formatCurrency={formatCurrency}
              unitMeasures={unitMeasures}
            />
          ))}

          {(!stage.tasks || stage.tasks.length === 0) && (!stage.children || stage.children.length === 0) && (
            <div className="p-4 text-center text-slate-400 text-sm">
              Brak pozycji. <button onClick={() => onAddTask(stage.id)} className="text-blue-600 hover:underline">Dodaj pierwszą pozycję</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Task Row Component
interface TaskRowProps {
  task: TaskWithResources;
  onEditTask: (task: EstimateTask) => void;
  onDeleteTask: (task: EstimateTask) => void;
  onAddResource: (taskId: string) => void;
  onEditResource: (resource: EstimateResource) => void;
  onDeleteResource: (resource: EstimateResource) => void;
  onUpdateResource: (resourceId: string, field: string, value: number | string) => void;
  onSelectTask: (taskId: string) => void;
  isSelected: boolean;
  formatCurrency: (value: number) => string;
  unitMeasures: UnitMeasure[];
}

const TaskRow: React.FC<TaskRowProps> = ({
  task, onEditTask, onDeleteTask, onAddResource, onEditResource, onDeleteResource,
  onUpdateResource, onSelectTask, isSelected, formatCurrency, unitMeasures
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasResources = task.resources && task.resources.length > 0;
  const unit = unitMeasures.find(u => u.id === task.unit_measure_id);

  const taskTotal = useMemo(() => {
    let total = 0;
    task.resources?.forEach(r => { total += r.cost_with_markup || 0; });
    return total;
  }, [task.resources]);

  return (
    <div className={`${isSelected ? 'bg-blue-50' : ''}`}>
      {/* Task header */}
      <div
        className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer group"
        onClick={() => { setIsExpanded(!isExpanded); onSelectTask(task.id); }}
      >
        {hasResources ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400 ml-4" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 ml-4" />
          )
        ) : (
          <span className="w-4 ml-4" />
        )}
        <FileText className="w-4 h-4 text-blue-500" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-700">{task.name}</span>
          {task.code && <span className="ml-2 text-xs text-slate-400">{task.code}</span>}
        </div>
        <span className="text-xs text-slate-500 w-16 text-right">{task.volume} {unit?.code || ''}</span>
        <span className="text-sm font-medium text-slate-900 w-28 text-right">{formatCurrency(taskTotal)}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onAddResource(task.id); }}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-600"
            title="Dodaj zasób"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-600"
            title="Edytuj"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-red-600"
            title="Usuń"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Resources */}
      {isExpanded && hasResources && (
        <div className="bg-slate-50 border-t border-slate-100">
          {/* Resource table header */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-500 border-b border-slate-100">
            <span className="w-5 ml-8"></span>
            <span className="flex-1">Zasób</span>
            <span className="w-16 text-right">Ilość</span>
            <span className="w-20 text-right">Cena</span>
            <span className="w-14 text-right">Narzut</span>
            <span className="w-24 text-right">Suma</span>
            <span className="w-16"></span>
          </div>
          {task.resources?.map(resource => {
            const config = RESOURCE_TYPE_CONFIG[resource.resource_type];
            const Icon = config.icon;
            const resourceUnit = unitMeasures.find(u => u.id === resource.unit_measure_id);

            return (
              <div key={resource.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 group text-sm">
                <div className={`w-5 h-5 rounded flex items-center justify-center ml-8 ${config.bgColor}`}>
                  <Icon className={`w-3 h-3 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-slate-700 truncate">{resource.name}</span>
                  {resource.url && (
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-500 hover:underline text-xs">
                      link
                    </a>
                  )}
                </div>
                <EditableCell
                  value={resource.volume}
                  type="number"
                  onSave={(v) => onUpdateResource(resource.id, 'volume', v)}
                  className="w-16 text-right text-slate-600"
                  suffix={` ${resourceUnit?.code || ''}`}
                />
                <EditableCell
                  value={resource.price}
                  type="number"
                  onSave={(v) => onUpdateResource(resource.id, 'price', v)}
                  className="w-20 text-right text-slate-600"
                />
                <EditableCell
                  value={resource.markup}
                  type="number"
                  onSave={(v) => onUpdateResource(resource.id, 'markup', v)}
                  className="w-14 text-right text-slate-600"
                  suffix="%"
                />
                <span className="w-24 text-right font-medium text-slate-800">
                  {formatCurrency(resource.cost_with_markup || 0)}
                </span>
                <div className="w-16 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => onEditResource(resource)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteResource(resource)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EstimatesPage;
