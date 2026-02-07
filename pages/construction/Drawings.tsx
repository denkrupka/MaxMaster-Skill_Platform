import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, FileImage, FolderOpen, ChevronRight, ChevronDown, Loader2,
  Upload, Eye, Download, Trash2, Pencil, Grid, List, ZoomIn, ZoomOut,
  Move, Type, Circle, Square, ArrowRight, Ruler, Layers, Settings,
  MapPin, MessageSquare, X, MoreVertical, ArrowLeft
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Project, Plan, PlanComponent, PlanMarkup, MarkupType } from '../../types';

interface ComponentWithPlans extends PlanComponent {
  children?: ComponentWithPlans[];
  plans?: Plan[];
  isExpanded?: boolean;
}

export const DrawingsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [components, setComponents] = useState<ComponentWithPlans[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<PlanComponent | null>(null);
  const [parentComponentId, setParentComponentId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) loadProjects();
  }, [currentUser]);

  useEffect(() => {
    if (selectedProject) loadPlansData();
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

  const loadPlansData = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const [componentsRes, plansRes] = await Promise.all([
        supabase
          .from('plan_components')
          .select('*')
          .eq('project_id', selectedProject.id)
          .is('deleted_at', null)
          .order('sort_order'),
        supabase
          .from('plans')
          .select('*')
          .eq('project_id', selectedProject.id)
          .is('deleted_at', null)
          .eq('is_current_version', true)
          .order('sort_order')
      ]);

      const componentsData = componentsRes.data || [];
      const plansData = plansRes.data || [];

      // Build hierarchy
      const componentMap = new Map<string, ComponentWithPlans>();
      componentsData.forEach(c => {
        componentMap.set(c.id, {
          ...c,
          children: [],
          plans: plansData.filter(p => p.component_id === c.id),
          isExpanded: true
        });
      });

      componentsData.forEach(c => {
        if (c.parent_id && componentMap.has(c.parent_id)) {
          componentMap.get(c.parent_id)!.children!.push(componentMap.get(c.id)!);
        }
      });

      const rootComponents = componentsData
        .filter(c => !c.parent_id)
        .map(c => componentMap.get(c.id)!);

      setComponents(rootComponents);
    } catch (err) {
      console.error('Error loading plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleComponentExpand = (componentId: string) => {
    setComponents(prev => {
      const toggle = (items: ComponentWithPlans[]): ComponentWithPlans[] =>
        items.map(item => ({
          ...item,
          isExpanded: item.id === componentId ? !item.isExpanded : item.isExpanded,
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
          <h1 className="text-2xl font-bold text-slate-900">Rysunki techniczne</h1>
          <p className="text-slate-600 mt-1">Wybierz projekt, aby zarządzać rysunkami</p>
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
                    <FileImage className="w-5 h-5" style={{ color: project.color }} />
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
      </div>
    );
  }

  // Plan viewer
  if (selectedPlan) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-4">
          <button
            onClick={() => setSelectedPlan(null)}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-slate-900">{selectedPlan.name}</h1>
            <p className="text-sm text-slate-500">{selectedProject.name}</p>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Zaznacz">
              <Move className="w-5 h-5 text-slate-600" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Tekst">
              <Type className="w-5 h-5 text-slate-600" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Koło">
              <Circle className="w-5 h-5 text-slate-600" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Prostokąt">
              <Square className="w-5 h-5 text-slate-600" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Strzałka">
              <ArrowRight className="w-5 h-5 text-slate-600" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Pomiar">
              <Ruler className="w-5 h-5 text-slate-600" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Pin">
              <MapPin className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Powiększ">
              <ZoomIn className="w-5 h-5 text-slate-600" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Pomniejsz">
              <ZoomOut className="w-5 h-5 text-slate-600" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Warstwy">
              <Layers className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto">
          {selectedPlan.file_url ? (
            <img
              src={selectedPlan.file_url}
              alt={selectedPlan.name}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-center">
              <FileImage className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Brak pliku do wyświetlenia</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Plans list view
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => setSelectedProject(null)}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{selectedProject.name}</h1>
          <p className="text-slate-500">Rysunki techniczne</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={() => { setEditingComponent(null); setParentComponentId(null); setShowComponentModal(true); }}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <Plus className="w-4 h-4" />
          Komponent
        </button>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload className="w-4 h-4" />
          Wgraj rysunek
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : components.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">Brak komponentów. Utwórz pierwszy komponent projektu.</p>
          <button
            onClick={() => { setEditingComponent(null); setParentComponentId(null); setShowComponentModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Dodaj komponent
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
          {components.map(component => (
            <ComponentItem
              key={component.id}
              component={component}
              level={0}
              onToggle={toggleComponentExpand}
              onSelectPlan={setSelectedPlan}
              onAddPlan={() => setShowUploadModal(true)}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ComponentItemProps {
  component: ComponentWithPlans;
  level: number;
  onToggle: (id: string) => void;
  onSelectPlan: (plan: Plan) => void;
  onAddPlan: () => void;
  viewMode: 'grid' | 'list';
}

const ComponentItem: React.FC<ComponentItemProps> = ({
  component, level, onToggle, onSelectPlan, onAddPlan, viewMode
}) => {
  const hasChildren = (component.children && component.children.length > 0) ||
    (component.plans && component.plans.length > 0);

  return (
    <div>
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-50"
        style={{ paddingLeft: `${12 + level * 20}px` }}
        onClick={() => onToggle(component.id)}
      >
        {hasChildren ? (
          component.isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )
        ) : (
          <span className="w-4" />
        )}
        <FolderOpen className="w-5 h-5 text-amber-500" />
        <span className="flex-1 font-medium text-slate-900">{component.name}</span>
        <span className="text-sm text-slate-500">
          {component.plans?.length || 0} rysunków
        </span>
      </div>

      {component.isExpanded && (
        <div>
          {/* Child components */}
          {component.children?.map(child => (
            <ComponentItem
              key={child.id}
              component={child}
              level={level + 1}
              onToggle={onToggle}
              onSelectPlan={onSelectPlan}
              onAddPlan={onAddPlan}
              viewMode={viewMode}
            />
          ))}

          {/* Plans */}
          {component.plans && component.plans.length > 0 && (
            <div className={viewMode === 'grid' ? 'p-4 grid grid-cols-2 md:grid-cols-4 gap-4' : ''}>
              {component.plans.map(plan => (
                <div
                  key={plan.id}
                  className={viewMode === 'grid'
                    ? 'bg-slate-50 rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-md transition'
                    : 'flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer'
                  }
                  style={viewMode === 'list' ? { paddingLeft: `${12 + (level + 1) * 20}px` } : undefined}
                  onClick={() => onSelectPlan(plan)}
                >
                  {viewMode === 'grid' ? (
                    <>
                      <div className="aspect-video bg-slate-200 rounded mb-2 flex items-center justify-center overflow-hidden">
                        {plan.thumbnail_url ? (
                          <img src={plan.thumbnail_url} alt={plan.name} className="w-full h-full object-cover" />
                        ) : (
                          <FileImage className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900 truncate">{plan.name}</p>
                      <p className="text-xs text-slate-500">Wersja {plan.version}</p>
                    </>
                  ) : (
                    <>
                      <FileImage className="w-5 h-5 text-blue-500" />
                      <span className="flex-1 text-sm text-slate-700">{plan.name}</span>
                      <span className="text-xs text-slate-500">v{plan.version}</span>
                      <Eye className="w-4 h-4 text-slate-400" />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DrawingsPage;
