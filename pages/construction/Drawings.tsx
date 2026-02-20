import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, FileImage, FolderOpen, ChevronRight, ChevronDown, Loader2,
  Upload, Eye, Download, Trash2, Pencil, Grid, List, ZoomIn, ZoomOut,
  Move, Type, Circle, Square, ArrowRight, Ruler, Layers, Settings,
  MapPin, MessageSquare, X, MoreVertical, ArrowLeft, Save, Check
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
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<PlanComponent | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadComponentId, setUploadComponentId] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // Component form
  const [componentForm, setComponentForm] = useState({
    name: '',
    description: '',
    parent_id: ''
  });

  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setAllPlans(plansData);

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

  const flattenComponents = (comps: ComponentWithPlans[], result: ComponentWithPlans[] = []): ComponentWithPlans[] => {
    comps.forEach(c => {
      result.push(c);
      if (c.children) flattenComponents(c.children, result);
    });
    return result;
  };

  const allComponentsFlat = useMemo(() => flattenComponents(components), [components]);

  // Component CRUD
  const handleSaveComponent = async () => {
    if (!currentUser || !selectedProject || !componentForm.name.trim()) return;
    setSaving(true);
    try {
      if (editingComponent) {
        await supabase
          .from('plan_components')
          .update({
            name: componentForm.name.trim(),
            description: componentForm.description,
            parent_id: componentForm.parent_id || null
          })
          .eq('id', editingComponent.id);
      } else {
        await supabase
          .from('plan_components')
          .insert({
            project_id: selectedProject.id,
            name: componentForm.name.trim(),
            description: componentForm.description,
            parent_id: componentForm.parent_id || null,
            sort_order: allComponentsFlat.length
          });
      }
      setShowComponentModal(false);
      setEditingComponent(null);
      setComponentForm({ name: '', description: '', parent_id: '' });
      await loadPlansData();
    } catch (err) {
      console.error('Error saving component:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComponent = async (componentId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten komponent i wszystkie rysunki w nim?')) return;
    try {
      await supabase
        .from('plan_components')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', componentId);
      await loadPlansData();
    } catch (err) {
      console.error('Error deleting component:', err);
    }
  };

  // File upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!currentUser || !selectedProject || uploadFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of uploadFiles) {
        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedProject.id}/${Date.now()}_${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('plans')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('plans')
          .getPublicUrl(fileName);

        // Create plan record
        await supabase
          .from('plans')
          .insert({
            project_id: selectedProject.id,
            component_id: uploadComponentId || null,
            name: file.name.replace(/\.[^/.]+$/, ''),
            file_name: file.name,
            file_url: urlData?.publicUrl,
            file_size: file.size,
            mime_type: file.type,
            version: 1,
            is_current_version: true,
            created_by_id: currentUser.id,
            sort_order: allPlans.length
          });
      }

      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadComponentId('');
      await loadPlansData();
    } catch (err) {
      console.error('Error uploading files:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePlan = async (plan: Plan) => {
    if (!confirm('Czy na pewno chcesz usunąć ten rysunek?')) return;
    try {
      await supabase
        .from('plans')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', plan.id);
      await loadPlansData();
    } catch (err) {
      console.error('Error deleting plan:', err);
    }
  };

  // Project selection view
  if (!selectedProject) {
    return (
      <div className="p-6">
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
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            {selectedPlan.file_url && (
              <a
                href={selectedPlan.file_url}
                download
                className="p-2 hover:bg-slate-100 rounded-lg"
                title="Pobierz"
              >
                <Download className="w-5 h-5 text-slate-600" />
              </a>
            )}
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
          onClick={() => {
            setEditingComponent(null);
            setComponentForm({ name: '', description: '', parent_id: '' });
            setShowComponentModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <Plus className="w-4 h-4" />
          Komponent
        </button>
        <button
          onClick={() => {
            setUploadFiles([]);
            setUploadComponentId('');
            setShowUploadModal(true);
          }}
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
            onClick={() => {
              setEditingComponent(null);
              setComponentForm({ name: '', description: '', parent_id: '' });
              setShowComponentModal(true);
            }}
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
              onEditComponent={(c) => {
                setEditingComponent(c);
                setComponentForm({
                  name: c.name,
                  description: c.description || '',
                  parent_id: c.parent_id || ''
                });
                setShowComponentModal(true);
              }}
              onDeleteComponent={handleDeleteComponent}
              onDeletePlan={handleDeletePlan}
              onUploadTo={(id) => {
                setUploadComponentId(id);
                setShowUploadModal(true);
              }}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

      {/* Component Modal */}
      {showComponentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingComponent ? 'Edytuj komponent' : 'Nowy komponent'}
              </h2>
              <button onClick={() => setShowComponentModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
                <input
                  type="text"
                  value={componentForm.name}
                  onChange={e => setComponentForm({ ...componentForm, name: e.target.value })}
                  placeholder="np. Piętro 1, Instalacja elektryczna"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea
                  value={componentForm.description}
                  onChange={e => setComponentForm({ ...componentForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Komponent nadrzędny</label>
                <select
                  value={componentForm.parent_id}
                  onChange={e => setComponentForm({ ...componentForm, parent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Brak (główny poziom) --</option>
                  {allComponentsFlat
                    .filter(c => c.id !== editingComponent?.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowComponentModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveComponent}
                disabled={!componentForm.name.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingComponent ? 'Zapisz' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Wgraj rysunki</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Komponent docelowy</label>
                <select
                  value={uploadComponentId}
                  onChange={e => setUploadComponentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Bez komponentu --</option>
                  {allComponentsFlat.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pliki *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.dwg,.dxf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-6 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-center"
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">Kliknij aby wybrać pliki</p>
                  <p className="text-xs text-slate-400 mt-1">lub przeciągnij i upuść</p>
                </button>
              </div>
              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Wybrane pliki ({uploadFiles.length})</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {uploadFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <FileImage className="w-4 h-4 text-slate-400" />
                        <span className="flex-1 text-sm truncate">{file.name}</span>
                        <span className="text-xs text-slate-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <button
                          onClick={() => setUploadFiles(uploadFiles.filter((_, j) => j !== i))}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleUpload}
                disabled={uploadFiles.length === 0 || uploading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Wgraj ({uploadFiles.length})
              </button>
            </div>
          </div>
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
  onEditComponent: (c: PlanComponent) => void;
  onDeleteComponent: (id: string) => void;
  onDeletePlan: (plan: Plan) => void;
  onUploadTo: (componentId: string) => void;
  viewMode: 'grid' | 'list';
}

const ComponentItem: React.FC<ComponentItemProps> = ({
  component, level, onToggle, onSelectPlan, onEditComponent, onDeleteComponent, onDeletePlan, onUploadTo, viewMode
}) => {
  const hasChildren = (component.children && component.children.length > 0) ||
    (component.plans && component.plans.length > 0);

  return (
    <div>
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-50"
        style={{ paddingLeft: `${12 + level * 20}px` }}
      >
        <button onClick={() => onToggle(component.id)} className="p-0.5">
          {hasChildren ? (
            component.isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>
        <FolderOpen className="w-5 h-5 text-amber-500" />
        <span className="flex-1 font-medium text-slate-900">{component.name}</span>
        <span className="text-sm text-slate-500">
          {component.plans?.length || 0} rysunków
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onUploadTo(component.id); }}
          className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600"
          title="Wgraj rysunek"
        >
          <Upload className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEditComponent(component); }}
          className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
          title="Edytuj"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteComponent(component.id); }}
          className="p-1.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
          title="Usuń"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
              onEditComponent={onEditComponent}
              onDeleteComponent={onDeleteComponent}
              onDeletePlan={onDeletePlan}
              onUploadTo={onUploadTo}
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
                    ? 'bg-slate-50 rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-md transition group'
                    : 'flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer group'
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
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{plan.name}</p>
                          <p className="text-xs text-slate-500">Wersja {plan.version}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeletePlan(plan); }}
                          className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <FileImage className="w-5 h-5 text-blue-500" />
                      <span className="flex-1 text-sm text-slate-700">{plan.name}</span>
                      <span className="text-xs text-slate-500">v{plan.version}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeletePlan(plan); }}
                        className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
