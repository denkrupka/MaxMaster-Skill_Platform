import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, Search, FileImage, ChevronRight, Loader2,
  Upload, Eye, EyeOff, Download, Trash2, ZoomIn, ZoomOut,
  Move, Type, Circle, Square, ArrowUpRight, Ruler, MapPin,
  X, MoreVertical, ArrowLeft, Maximize2, Minimize2,
  GripVertical, BookOpen, ArrowUpDown, Clock, Pencil, Eraser,
  Lock, Unlock, PenTool, Hexagon, Minus, CloudUpload,
  ListTodo, LayoutList, Scale, ChevronDown
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Project, Plan } from '../../types';

// ---- Types ----

interface PlanFolder {
  id: string;
  project_id: string;
  parent_id?: string | null;
  name: string;
  code?: string;
  description?: string;
  sort_order: number;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface PlanRecord {
  id: string;
  component_id: string;
  project_id: string;
  name: string;
  description?: string;
  file_url: string;
  thumbnail_url?: string;
  original_filename?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  calibration_enabled?: boolean;
  calibration_length?: number;
  calibration_pixels?: number;
  scale_ratio?: number;
  version: number;
  is_current_version: boolean;
  parent_plan_id?: string | null;
  sort_order: number;
  is_active?: boolean;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface PlanVersion {
  id: string;
  file_url: string;
  original_filename?: string;
  version: number;
  is_current_version: boolean;
  created_at: string;
  created_by_id?: string;
}

interface FolderWithPlans extends PlanFolder {
  plans: PlanRecord[];
  isExpanded: boolean;
}

type AnnotationTool = 'pointer' | 'pen' | 'highlighter' | 'cloud' | 'rectangle' | 'ellipse' | 'polygon' | 'arrow' | 'line' | 'text' | 'eraser';

interface VisibilityState {
  private: boolean;
  public: boolean;
  measurements: boolean;
  drawings: boolean;
  shapes: boolean;
  texts: boolean;
}

// ---- Main Component ----

export const DrawingsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [folders, setFolders] = useState<FolderWithPlans[]>([]);
  const [allPlans, setAllPlans] = useState<PlanRecord[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderWithPlans | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');

  // Viewer state
  const [zoom, setZoom] = useState(100);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pointer');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityState>({
    private: true, public: true, measurements: true, drawings: true, shapes: true, texts: true
  });

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showVisibilityPopup, setShowVisibilityPopup] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showUploadDropdown, setShowUploadDropdown] = useState(false);
  const [showUpdateDropdown, setShowUpdateDropdown] = useState(false);
  const [showPenDropdown, setShowPenDropdown] = useState(false);
  const [showShapeDropdown, setShowShapeDropdown] = useState(false);
  const [showEraserDropdown, setShowEraserDropdown] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editParentPlan, setEditParentPlan] = useState('');
  const [saving, setSaving] = useState(false);

  // Create modal state
  const [createName, setCreateName] = useState('');
  const [createParentId, setCreateParentId] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createNoFile, setCreateNoFile] = useState(false);
  const [createAskApproval, setCreateAskApproval] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Scale calibration
  const [scaleDistance, setScaleDistance] = useState('');
  const [scaleUnit, setScaleUnit] = useState('centymetr');

  // Versions
  const [planVersions, setPlanVersions] = useState<PlanVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');

  // Dragging
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);
  const [dragOverPlanId, setDragOverPlanId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const updateFileInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const MAX_PLANS = 500;

  // ---- Data Loading ----

  useEffect(() => {
    if (currentUser) loadProjects();
  }, [currentUser]);

  useEffect(() => {
    if (selectedProject) loadPlansData();
  }, [selectedProject]);

  useEffect(() => {
    if (selectedPlan) {
      setEditName(selectedPlan.name);
      setEditParentPlan(selectedPlan.parent_plan_id || '');
    } else if (selectedFolder) {
      setEditName(selectedFolder.name);
      setEditParentPlan('');
    }
  }, [selectedPlan, selectedFolder]);

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
      const [foldersRes, plansRes] = await Promise.all([
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

      const foldersData: PlanFolder[] = foldersRes.data || [];
      const plansData: PlanRecord[] = plansRes.data || [];
      setAllPlans(plansData);

      const foldersWithPlans: FolderWithPlans[] = foldersData.map(f => ({
        ...f,
        plans: plansData.filter(p => p.component_id === f.id),
        isExpanded: true
      }));

      setFolders(foldersWithPlans);
    } catch (err) {
      console.error('Error loading plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async (planId: string) => {
    try {
      const basePlan = allPlans.find(p => p.id === planId);
      const parentId = basePlan?.parent_plan_id || planId;

      const { data } = await supabase
        .from('plans')
        .select('id, file_url, original_filename, version, is_current_version, created_at, created_by_id')
        .or(`id.eq.${parentId},parent_plan_id.eq.${parentId}`)
        .is('deleted_at', null)
        .order('version', { ascending: false });

      if (data) {
        setPlanVersions(data);
        const current = data.find(v => v.is_current_version);
        if (current) setSelectedVersionId(current.id);
      }
    } catch (err) {
      console.error('Error loading versions:', err);
    }
  };

  // ---- Helpers ----

  const totalPlans = allPlans.length;

  const filteredFolders = useMemo(() => {
    if (!search.trim()) return folders;
    const s = search.toLowerCase();
    return folders.map(f => ({
      ...f,
      plans: f.plans.filter(p =>
        p.name.toLowerCase().includes(s) ||
        (p.original_filename || '').toLowerCase().includes(s)
      )
    })).filter(f =>
      f.name.toLowerCase().includes(s) || f.plans.length > 0
    );
  }, [folders, search]);

  // ---- CRUD Operations ----

  const handleCreatePlan = async () => {
    if (!currentUser || !selectedProject || !createName.trim()) return;
    setUploading(true);
    try {
      // First ensure a folder exists
      let folderId = createParentId;
      if (!folderId && folders.length > 0) {
        folderId = folders[0].id;
      }

      if (!folderId) {
        // Create default folder
        const { data: newFolder } = await supabase
          .from('plan_components')
          .insert({
            project_id: selectedProject.id,
            name: 'DOKUMENTY BUDOWLANE',
            sort_order: 0,
            created_by_id: currentUser.id
          })
          .select()
          .single();
        if (newFolder) folderId = newFolder.id;
      }

      if (!folderId) return;

      let fileUrl = '';
      let originalFilename = '';
      let mimeType = '';
      let fileSize = 0;

      if (createFile) {
        const fileName = `${selectedProject.id}/${Date.now()}_${createFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('plans')
          .upload(fileName, createFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('plans')
          .getPublicUrl(fileName);

        fileUrl = urlData?.publicUrl || '';
        originalFilename = createFile.name;
        mimeType = createFile.type;
        fileSize = createFile.size;
      }

      await supabase
        .from('plans')
        .insert({
          project_id: selectedProject.id,
          component_id: folderId,
          name: createName.trim(),
          file_url: fileUrl || 'placeholder',
          original_filename: originalFilename,
          mime_type: mimeType,
          file_size: fileSize,
          version: 1,
          is_current_version: true,
          created_by_id: currentUser.id,
          sort_order: allPlans.length
        });

      setShowCreateModal(false);
      setCreateName('');
      setCreateParentId('');
      setCreateFile(null);
      setCreateNoFile(false);
      setCreateAskApproval(false);
      await loadPlansData();
    } catch (err) {
      console.error('Error creating plan:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadToPlan = async (file: File) => {
    if (!currentUser || !selectedProject || !selectedFolder) return;
    setUploading(true);
    try {
      const fileName = `${selectedProject.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('plans')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('plans')
        .getPublicUrl(fileName);

      await supabase
        .from('plans')
        .insert({
          project_id: selectedProject.id,
          component_id: selectedFolder.id,
          name: file.name.replace(/\.[^/.]+$/, ''),
          file_url: urlData?.publicUrl || '',
          original_filename: file.name,
          mime_type: file.type,
          file_size: file.size,
          version: 1,
          is_current_version: true,
          created_by_id: currentUser.id,
          sort_order: allPlans.length
        });

      await loadPlansData();
    } catch (err) {
      console.error('Error uploading:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdatePlanFile = async (file: File) => {
    if (!currentUser || !selectedProject || !selectedPlan) return;
    setUploading(true);
    try {
      const fileName = `${selectedProject.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('plans')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('plans')
        .getPublicUrl(fileName);

      // Mark old version as not current
      await supabase
        .from('plans')
        .update({ is_current_version: false })
        .eq('id', selectedPlan.id);

      // Create new version
      const { data: newPlan } = await supabase
        .from('plans')
        .insert({
          project_id: selectedProject.id,
          component_id: selectedPlan.component_id,
          name: selectedPlan.name,
          file_url: urlData?.publicUrl || '',
          original_filename: file.name,
          mime_type: file.type,
          file_size: file.size,
          version: (selectedPlan.version || 1) + 1,
          is_current_version: true,
          parent_plan_id: selectedPlan.parent_plan_id || selectedPlan.id,
          created_by_id: currentUser.id,
          sort_order: selectedPlan.sort_order
        })
        .select()
        .single();

      if (newPlan) setSelectedPlan(newPlan);
      await loadPlansData();
    } catch (err) {
      console.error('Error updating plan file:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;
    if (!confirm('Czy na pewno chcesz usunąć ten rzut?')) return;
    try {
      await supabase
        .from('plans')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', selectedPlan.id);
      setSelectedPlan(null);
      await loadPlansData();
    } catch (err) {
      console.error('Error deleting plan:', err);
    }
  };

  const handleDeleteOldVersions = async () => {
    if (!confirm('Czy na pewno chcesz usunąć stare wersje wszystkich planów?')) return;
    try {
      await supabase
        .from('plans')
        .update({ deleted_at: new Date().toISOString() })
        .eq('project_id', selectedProject!.id)
        .eq('is_current_version', false)
        .is('deleted_at', null);
      await loadPlansData();
    } catch (err) {
      console.error('Error deleting old versions:', err);
    }
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      if (selectedPlan) {
        await supabase
          .from('plans')
          .update({ name: editName.trim(), parent_plan_id: editParentPlan || null })
          .eq('id', selectedPlan.id);
        setSelectedPlan({ ...selectedPlan, name: editName.trim(), parent_plan_id: editParentPlan || null });
      } else if (selectedFolder) {
        await supabase
          .from('plan_components')
          .update({ name: editName.trim() })
          .eq('id', selectedFolder.id);
      }
      await loadPlansData();
    } catch (err) {
      console.error('Error saving name:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSort = async (direction: 'asc' | 'desc') => {
    const sorted = [...folders];
    sorted.forEach(f => {
      f.plans.sort((a, b) => direction === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
      );
    });
    sorted.sort((a, b) => direction === 'asc'
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name)
    );

    // Persist sort order
    for (let i = 0; i < sorted.length; i++) {
      await supabase.from('plan_components').update({ sort_order: i }).eq('id', sorted[i].id);
      for (let j = 0; j < sorted[i].plans.length; j++) {
        await supabase.from('plans').update({ sort_order: j }).eq('id', sorted[i].plans[j].id);
      }
    }

    setFolders(sorted);
    setShowSortModal(false);
  };

  const handleScaleCalibration = async () => {
    if (!selectedPlan || !scaleDistance) return;
    try {
      await supabase
        .from('plans')
        .update({
          calibration_enabled: true,
          calibration_length: parseFloat(scaleDistance)
        })
        .eq('id', selectedPlan.id);
      setShowScaleModal(false);
      setScaleDistance('');
    } catch (err) {
      console.error('Error calibrating:', err);
    }
  };

  // Drag & drop for file upload
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0]) {
      if (selectedPlan) {
        handleUpdatePlanFile(files[0]);
      } else if (selectedFolder) {
        handleUploadToPlan(files[0]);
      }
    }
  }, [selectedPlan, selectedFolder, selectedProject, currentUser]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Drag reorder for plans in list
  const handlePlanDragStart = (planId: string) => {
    setDraggedPlanId(planId);
  };

  const handlePlanDragOver = (e: React.DragEvent, planId: string) => {
    e.preventDefault();
    setDragOverPlanId(planId);
  };

  const handlePlanDrop = async (targetPlanId: string) => {
    if (!draggedPlanId || draggedPlanId === targetPlanId) {
      setDraggedPlanId(null);
      setDragOverPlanId(null);
      return;
    }

    const allFolderPlans = folders.flatMap(f => f.plans);
    const draggedIdx = allFolderPlans.findIndex(p => p.id === draggedPlanId);
    const targetIdx = allFolderPlans.findIndex(p => p.id === targetPlanId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const reordered = [...allFolderPlans];
      const [moved] = reordered.splice(draggedIdx, 1);
      reordered.splice(targetIdx, 0, moved);

      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('plans').update({ sort_order: i }).eq('id', reordered[i].id);
      }
      await loadPlansData();
    }

    setDraggedPlanId(null);
    setDragOverPlanId(null);
  };

  // ---- Project Selection ----

  if (!selectedProject) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Plany i rzuty</h1>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj projektu..."
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects
              .filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
              .map(project => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: (project.color || '#3b82f6') + '20' }}
                    >
                      <FileImage className="w-5 h-5" style={{ color: project.color || '#3b82f6' }} />
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
      </div>
    );
  }

  // ---- Main Split-Panel Layout ----

  const isPdf = selectedPlan?.mime_type === 'application/pdf' ||
    (selectedPlan?.original_filename || '').toLowerCase().endsWith('.pdf');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Top Bar */}
      <div className="bg-white border-b-2 border-blue-600 px-4 py-2 flex items-center gap-4">
        <button
          onClick={() => setSelectedProject(null)}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
          title="Powrót"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => {
            setCreateName('');
            setCreateParentId('');
            setCreateFile(null);
            setCreateNoFile(false);
            setCreateAskApproval(false);
            setShowCreateModal(true);
          }}
          className="px-5 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition text-sm whitespace-nowrap"
        >
          Utwórz rzuty
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, (totalPlans / MAX_PLANS) * 100)}%` }}
            />
          </div>
          <span className="text-sm text-slate-600 whitespace-nowrap">{totalPlans} z {MAX_PLANS} plany</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Szukaj"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex-1" />

        <button
          onClick={handleDeleteOldVersions}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded font-medium hover:bg-red-800 transition text-sm whitespace-nowrap"
        >
          <Trash2 className="w-4 h-4" />
          Usuń stare wersje planu
        </button>
      </div>

      {/* Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Plan List */}
        <div className="w-[420px] min-w-[350px] border-r border-slate-300 bg-white flex flex-col overflow-hidden">
          {/* Left header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="font-semibold text-slate-700 text-sm">Plany i rzuty</span>
            <button
              onClick={() => setShowSortModal(true)}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
              title="Sortuj"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>

          {/* Folder list with plans */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Brak planów. Kliknij "Utwórz rzuty" aby dodać pierwszy.
              </div>
            ) : (
              filteredFolders.map(folder => (
                <div key={folder.id}>
                  {/* Folder header */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                      selectedFolder?.id === folder.id && !selectedPlan
                        ? 'bg-[#2c3e50] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                    }`}
                    onClick={() => {
                      setSelectedFolder(folder);
                      setSelectedPlan(null);
                      setEditName(folder.name);
                      setEditParentPlan('');
                    }}
                  >
                    <GripVertical className="w-4 h-4 opacity-40 flex-shrink-0" />
                    <span className="font-bold text-xs uppercase tracking-wide flex-1 truncate">
                      {folder.name}
                    </span>
                  </div>

                  {/* Plans in folder */}
                  {folder.plans.map(plan => (
                    <div
                      key={plan.id}
                      draggable
                      onDragStart={() => handlePlanDragStart(plan.id)}
                      onDragOver={(e) => handlePlanDragOver(e, plan.id)}
                      onDrop={() => handlePlanDrop(plan.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-slate-100 transition-colors ${
                        selectedPlan?.id === plan.id
                          ? 'bg-[#2c3e50] text-white'
                          : dragOverPlanId === plan.id
                          ? 'bg-blue-50 border-blue-300'
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setSelectedPlan(plan);
                        setSelectedFolder(folder);
                        setEditName(plan.name);
                        setEditParentPlan(plan.parent_plan_id || '');
                        setZoom(100);
                      }}
                    >
                      <GripVertical className={`w-4 h-4 flex-shrink-0 ${selectedPlan?.id === plan.id ? 'opacity-60' : 'opacity-30'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${selectedPlan?.id === plan.id ? 'text-white' : 'text-slate-900'}`}>
                          {plan.name}
                        </p>
                        <p className={`text-xs truncate ${selectedPlan?.id === plan.id ? 'text-slate-300' : 'text-slate-500'}`}>
                          {plan.original_filename || plan.name}
                        </p>
                      </div>
                      {selectedPlan?.id === plan.id && (
                        <div className="w-px h-8 bg-white/40 mx-1" />
                      )}
                      <BookOpen className={`w-5 h-5 flex-shrink-0 ${selectedPlan?.id === plan.id ? 'text-white/80' : 'text-slate-400'}`} />
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Right header: name + parent + menu */}
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-4">
            <span className="text-sm text-slate-600 whitespace-nowrap">Nazwa</span>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              className="px-2 py-1 border border-slate-300 rounded text-sm w-52 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={selectedPlan ? 'Nazwa planu' : 'Nazwa grupy'}
            />
            <span className="text-sm text-slate-600 whitespace-nowrap">Rzut nadrzędny</span>
            <select
              value={editParentPlan}
              onChange={e => setEditParentPlan(e.target.value)}
              onBlur={handleSaveName}
              className="px-2 py-1 border border-slate-300 rounded text-sm flex-1 max-w-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Rzut nadrzędny</option>
              {allPlans
                .filter(p => p.id !== selectedPlan?.id)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>

            {/* Three-dot menu */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => { setShowMoreMenu(false); }}
                    >
                      <ListTodo className="w-4 h-4" />
                      Widok listy zadań
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => { setShowMoreMenu(false); }}
                    >
                      <LayoutList className="w-4 h-4" />
                      Widok planu zadań
                    </button>
                    {selectedPlan && (
                      <>
                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setShowMoreMenu(false);
                            setShowScaleModal(true);
                          }}
                        >
                          <Scale className="w-4 h-4" />
                          Skalibruj skalę
                        </button>
                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                          onClick={() => {
                            setShowMoreMenu(false);
                            handleDeletePlan();
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Usuń rzut
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Plan Viewer or Upload Zone */}
          {selectedPlan && selectedPlan.file_url && selectedPlan.file_url !== 'placeholder' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Viewer Toolbar */}
              <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-1">
                {/* Zoom */}
                <button
                  onClick={() => setZoom(z => Math.min(z + 25, 400))}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                  title="Powiększ"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setZoom(z => Math.max(z - 25, 25))}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                  title="Pomniejsz"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-slate-200 mx-1" />

                {/* Visibility */}
                <div className="relative">
                  <button
                    onClick={() => setShowVisibilityPopup(!showVisibilityPopup)}
                    className={`p-1.5 rounded transition-colors ${
                      showVisibilityPopup ? 'bg-yellow-400 text-white' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                    title="Widoczność oznaczeń"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  {showVisibilityPopup && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowVisibilityPopup(false)} />
                      <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-2">
                        <div className="px-4 py-1.5 text-sm font-semibold text-slate-800">Widoczność oznaczeń</div>
                        {[
                          { key: 'private' as const, label: 'Prywatne', icon: Lock },
                          { key: 'public' as const, label: 'Publiczne', icon: Unlock },
                          { key: 'measurements' as const, label: 'Pomiary', icon: Pencil },
                          { key: 'drawings' as const, label: 'Rysunki', icon: PenTool },
                          { key: 'shapes' as const, label: 'Kształty', icon: Hexagon },
                          { key: 'texts' as const, label: 'Teksty', icon: Type },
                        ].map(item => (
                          <button
                            key={item.key}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => setVisibility(v => ({ ...v, [item.key]: !v[item.key] }))}
                          >
                            <item.icon className="w-4 h-4 text-slate-400" />
                            <span className="flex-1">{item.label}</span>
                            {visibility[item.key] ? (
                              <Eye className="w-4 h-4 text-slate-500" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Fullscreen */}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                  title="Pełny ekran"
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>

                {/* Fit to view */}
                <button
                  onClick={() => setZoom(100)}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                  title="Dopasuj do widoku"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </button>

                <div className="w-px h-6 bg-slate-200 mx-1" />

                {/* Filename */}
                <span className="text-sm text-slate-600 px-2">{selectedPlan.original_filename || selectedPlan.name}</span>

                <div className="w-px h-6 bg-slate-200 mx-1" />

                {/* Version history */}
                <button
                  onClick={() => {
                    loadVersions(selectedPlan.id);
                    setShowVersionModal(true);
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                  title="Wersje"
                >
                  <Clock className="w-5 h-5" />
                </button>

                {/* Upload update */}
                <div className="relative">
                  <button
                    onClick={() => setShowUpdateDropdown(!showUpdateDropdown)}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                    title="Zaktualizuj plik"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                  {showUpdateDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUpdateDropdown(false)} />
                      <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                        <button
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setShowUpdateDropdown(false);
                            updateFileInputRef.current?.click();
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <CloudUpload className="w-4 h-4" />
                            <span>Zaktualizuj</span>
                          </div>
                          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">Prześlij</span>
                        </button>
                        <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <CloudUpload className="w-4 h-4" />
                            <span>Dropbox</span>
                          </div>
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Dropbox</span>
                        </button>
                        <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <CloudUpload className="w-4 h-4" />
                            <span>Google Drive</span>
                          </div>
                          <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">Google Drive</span>
                        </button>
                        <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <CloudUpload className="w-4 h-4" />
                            <span>OneDrive</span>
                          </div>
                          <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded">OneDrive</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Download */}
                <a
                  href={selectedPlan.file_url}
                  download={selectedPlan.original_filename || selectedPlan.name}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                  title="Pobieranie"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-5 h-5" />
                </a>

                {/* Delete plan file */}
                <button
                  onClick={handleDeletePlan}
                  className="p-1.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600"
                  title="Usuń"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Plan View Area */}
              <div
                ref={viewerRef}
                className="flex-1 overflow-auto bg-slate-100 relative"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div
                  className="min-h-full flex items-center justify-center p-4"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
                >
                  {isPdf ? (
                    <iframe
                      src={selectedPlan.file_url + '#toolbar=0'}
                      className="w-full bg-white shadow-lg"
                      style={{ height: '80vh', minWidth: '800px' }}
                      title={selectedPlan.name}
                    />
                  ) : (
                    <img
                      src={selectedPlan.file_url}
                      alt={selectedPlan.name}
                      className="max-w-full shadow-lg bg-white"
                      style={{ imageRendering: zoom > 200 ? 'pixelated' : 'auto' }}
                    />
                  )}
                </div>
              </div>

              {/* Bottom Annotation Toolbar */}
              <div className="px-4 py-2 border-t border-slate-200 bg-white flex items-center gap-1">
                {/* Pointer */}
                <button
                  onClick={() => setActiveTool('pointer')}
                  className={`p-2 rounded ${activeTool === 'pointer' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
                  title="Zaznacz"
                >
                  <Move className="w-5 h-5 text-slate-600" />
                </button>

                {/* Pen dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowPenDropdown(!showPenDropdown)}
                    className={`p-2 rounded flex items-center gap-0.5 ${
                      activeTool === 'pen' || activeTool === 'highlighter' ? 'bg-slate-200' : 'hover:bg-slate-100'
                    }`}
                  >
                    <PenTool className="w-5 h-5 text-slate-600" />
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                  {showPenDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowPenDropdown(false)} />
                      <div className="absolute left-0 bottom-full mb-1 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase">Rysowanie</div>
                        <button
                          className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-blue-50 ${activeTool === 'pen' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                          onClick={() => { setActiveTool('pen'); setShowPenDropdown(false); }}
                        >
                          <PenTool className="w-4 h-4" />
                          Pióro
                        </button>
                        <button
                          className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-blue-50 ${activeTool === 'highlighter' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                          onClick={() => { setActiveTool('highlighter'); setShowPenDropdown(false); }}
                        >
                          <Pencil className="w-4 h-4" />
                          Zakreślacz
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Shapes dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowShapeDropdown(!showShapeDropdown)}
                    className={`p-2 rounded flex items-center gap-0.5 ${
                      ['cloud', 'rectangle', 'ellipse', 'polygon', 'arrow', 'line'].includes(activeTool) ? 'bg-slate-200' : 'hover:bg-slate-100'
                    }`}
                  >
                    <Square className="w-5 h-5 text-slate-600" />
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                  {showShapeDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowShapeDropdown(false)} />
                      <div className="absolute left-0 bottom-full mb-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase">Kształty</div>
                        {[
                          { tool: 'cloud' as AnnotationTool, label: 'Chmurka rewizyjna', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16.5 18H7a5 5 0 1 1 .5-9.98A7.002 7.002 0 0 1 19 9a4.5 4.5 0 0 1-2.5 9Z" /></svg> },
                          { tool: 'rectangle' as AnnotationTool, label: 'Prostokąt', icon: <Square className="w-4 h-4" /> },
                          { tool: 'ellipse' as AnnotationTool, label: 'Elipsa', icon: <Circle className="w-4 h-4" /> },
                          { tool: 'polygon' as AnnotationTool, label: 'Wielokąt', icon: <Hexagon className="w-4 h-4" /> },
                          { tool: 'arrow' as AnnotationTool, label: 'Strzałka', icon: <ArrowUpRight className="w-4 h-4" /> },
                          { tool: 'line' as AnnotationTool, label: 'Linia', icon: <Minus className="w-4 h-4" /> },
                        ].map(item => (
                          <button
                            key={item.tool}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-blue-50 ${activeTool === item.tool ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                            onClick={() => { setActiveTool(item.tool); setShowShapeDropdown(false); }}
                          >
                            {item.icon}
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Text */}
                <button
                  onClick={() => setActiveTool('text')}
                  className={`p-2 rounded ${activeTool === 'text' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
                  title="Tekst"
                >
                  <Type className="w-5 h-5 text-slate-600" />
                </button>

                {/* Eraser dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowEraserDropdown(!showEraserDropdown)}
                    className={`p-2 rounded flex items-center gap-0.5 ${activeTool === 'eraser' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
                  >
                    <Eraser className="w-5 h-5 text-slate-600" />
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                  {showEraserDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEraserDropdown(false)} />
                      <div className="absolute left-0 bottom-full mb-1 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                        <button
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50"
                          onClick={() => { setActiveTool('eraser'); setShowEraserDropdown(false); }}
                        >
                          <Eraser className="w-4 h-4" />
                          Gumka
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Upload drop zone - when no plan selected or plan has no file */
            <div
              className="flex-1 flex flex-col items-center justify-center p-8"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 w-full max-w-lg text-center">
                <p className="text-xl text-slate-400 mb-2">
                  Aby dodać plan, możesz przeciągnąć i upuścić plik planu tutaj albo
                </p>

                {/* Upload button with dropdown */}
                <div className="relative inline-block mt-4">
                  <button
                    onClick={() => setShowUploadDropdown(!showUploadDropdown)}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
                  >
                    Wybierz plik planu.
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showUploadDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUploadDropdown(false)} />
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-60 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                        <button
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setShowUploadDropdown(false);
                            fileInputRef.current?.click();
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <CloudUpload className="w-4 h-4" />
                            <span>Wybierz plik planu.</span>
                          </div>
                          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">Prześlij</span>
                        </button>
                        <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <CloudUpload className="w-4 h-4" />
                            <span>Dropbox</span>
                          </div>
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Dropbox</span>
                        </button>
                        <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <CloudUpload className="w-4 h-4" />
                            <span>Google Drive</span>
                          </div>
                          <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">Google Drive</span>
                        </button>
                        <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <CloudUpload className="w-4 h-4" />
                            <span>OneDrive</span>
                          </div>
                          <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded">OneDrive</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.dwg,.dxf"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && selectedFolder) {
            handleUploadToPlan(file);
          }
          e.target.value = '';
        }}
      />
      <input
        ref={updateFileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.dwg,.dxf"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && selectedPlan) {
            handleUpdatePlanFile(file);
          }
          e.target.value = '';
        }}
      />
      <input
        ref={createFileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.dwg,.dxf"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) setCreateFile(file);
          e.target.value = '';
        }}
      />

      {/* =================== MODALS =================== */}

      {/* Sort Modal */}
      {showSortModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-orange-600">Sortowanie</h2>
              <button onClick={() => setShowSortModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <p className="font-semibold text-slate-800">Czy chcesz posortować alfabetycznie?</p>
              <p className="text-sm text-slate-500 mt-1">Twoje rzuty zostaną posortowane, ale hierarchia zostanie zachowana.</p>
            </div>
            <div className="p-4 flex items-center gap-3">
              <button
                onClick={() => handleSort('asc')}
                className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm"
              >
                Sortuj rosnąco (0-9, A-Z)
              </button>
              <button
                onClick={() => handleSort('desc')}
                className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm"
              >
                Sortuj malejąco (Z-A, 9-0)
              </button>
              <button
                onClick={() => setShowSortModal(false)}
                className="px-4 py-2 border border-slate-300 rounded font-medium hover:bg-slate-50 text-sm text-slate-700"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl">
            <div className="p-4 flex justify-between items-center border-b border-slate-200">
              <h2 className="text-lg font-bold text-orange-600">Utwórz rzuty</h2>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-white rounded-full hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {/* Drag zone */}
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 mb-4 text-center"
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) setCreateFile(file);
                }}
                onDragOver={e => e.preventDefault()}
              >
                {createFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileImage className="w-8 h-8 text-blue-500" />
                    <div className="text-left">
                      <p className="font-medium text-slate-800">{createFile.name}</p>
                      <p className="text-sm text-slate-500">{(createFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={() => setCreateFile(null)} className="p-1 hover:bg-slate-100 rounded">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                ) : (
                  <Plus className="w-12 h-12 text-slate-300 mx-auto" />
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <button
                  onClick={() => createFileInputRef.current?.click()}
                  className="px-4 py-2 bg-orange-500 text-white rounded font-medium hover:bg-orange-600 text-sm"
                >
                  Wybierz plik planu
                </button>
                <span className="text-sm text-slate-400">lub</span>
                <button
                  onClick={() => setCreateNoFile(true)}
                  className="px-4 py-2 bg-slate-700 text-white rounded font-medium hover:bg-slate-800 text-sm"
                >
                  Utwórz rzut bez planu
                </button>
                <span className="text-sm text-slate-400">lub</span>
                <button className="px-4 py-2 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 text-sm flex items-center gap-2">
                  <span>Dropbox</span>
                </button>
                <span className="text-sm text-slate-400">lub</span>
                <button className="px-4 py-2 bg-green-500 text-white rounded font-medium hover:bg-green-600 text-sm flex items-center gap-2">
                  <span>Google Drive</span>
                </button>
                <span className="text-sm text-slate-400">lub</span>
                <button className="px-4 py-2 bg-sky-500 text-white rounded font-medium hover:bg-sky-600 text-sm flex items-center gap-2">
                  <span>OneDrive</span>
                </button>
              </div>

              {/* Name and parent */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="Nazwa"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="relative flex-1">
                  <select
                    value={createParentId}
                    onChange={e => setCreateParentId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none pr-8"
                  >
                    <option value="">-- Folder --</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <button
                  onClick={() => createFileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-700 text-white rounded font-medium hover:bg-slate-800 text-sm"
                >
                  Wybierz plik planu
                </button>
                <button
                  onClick={() => {
                    setCreateName('');
                    setCreateFile(null);
                    setCreateParentId('');
                  }}
                  className="p-2 text-orange-500 hover:bg-orange-50 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createAskApproval}
                  onChange={e => setCreateAskApproval(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Poproś o akceptację
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreatePlan}
                  disabled={!createName.trim() || uploading}
                  className="px-6 py-2 bg-slate-700 text-white rounded font-medium hover:bg-slate-800 text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Zapisz
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 border border-slate-300 rounded font-medium hover:bg-slate-50 text-sm text-slate-700"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="p-4 flex items-center justify-between border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Zobacz wersję planu</h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="rounded border-slate-300" />
                  Pokaż zadania
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                  Pokaż oznacz...
                </label>
                <button
                  onClick={() => {
                    setShowVersionModal(false);
                    setShowCompareModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5" /></svg>
                  Porównaj wersje
                </button>
                <button onClick={() => setShowVersionModal(false)} className="p-1 hover:bg-slate-100 rounded">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Version select + viewer */}
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600">Wersja planu</span>
                  <select
                    value={selectedVersionId}
                    onChange={e => setSelectedVersionId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded text-sm flex-1 max-w-xl"
                  >
                    {planVersions.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.original_filename || 'plan'} (V{v.version} {v.is_current_version ? 'Aktualna wersja' : ''})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
                  {(() => {
                    const version = planVersions.find(v => v.id === selectedVersionId);
                    if (!version) return <p className="text-slate-400">Wybierz wersję</p>;
                    const isPdfVersion = (version.original_filename || '').toLowerCase().endsWith('.pdf');
                    return isPdfVersion ? (
                      <iframe src={version.file_url + '#toolbar=0'} className="w-full bg-white shadow-lg" style={{ height: '70vh', minWidth: '700px' }} />
                    ) : (
                      <img src={version.file_url} alt="" className="max-w-full shadow-lg bg-white" />
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare Versions Modal */}
      {showCompareModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl">
            <div className="p-4 flex justify-between items-center border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Wybierz wersję do porównania</h2>
              <button onClick={() => setShowCompareModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2 px-3 font-semibold text-slate-700">Plik planu</th>
                    <th className="py-2 px-3 font-semibold text-slate-700">Załadowane...</th>
                    <th className="py-2 px-3 font-semibold text-slate-700">Załadowano</th>
                    <th className="py-2 px-3 font-semibold text-slate-700">Status akcept...</th>
                    <th className="py-2 px-3 font-semibold text-slate-700">Wersja</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {planVersions.map(v => (
                    <tr key={v.id} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer">
                      <td className="py-2 px-3">{v.original_filename || 'plan'}</td>
                      <td className="py-2 px-3 text-slate-500">-</td>
                      <td className="py-2 px-3 text-slate-500">
                        {new Date(v.created_at).toLocaleDateString('pl-PL')} {new Date(v.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-slate-500">-</td>
                      <td className="py-2 px-3">V{v.version} {v.is_current_version ? 'Aktualna wersja' : ''}</td>
                      <td className="py-2 px-3">
                        {v.id === selectedVersionId && (
                          <span className="px-3 py-1 border border-slate-300 rounded text-xs text-slate-600">Wyświetlono</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Scale Calibration Modal */}
      {showScaleModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="p-4 flex justify-between items-center border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Skalibruj skalę</h2>
              <button onClick={() => setShowScaleModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <p className="text-sm text-slate-700">
                Na potrzeby kalibracji dostosuj pozycję dwóch pinezek na planie. W tym celu należy wprowadzić rzeczywistą odległość między nimi.
              </p>
            </div>

            <div className="px-4 py-3 border-b border-slate-200">
              <p className="text-sm font-semibold text-slate-800 mb-2">Wprowadź odległość między dwoma punktami</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={scaleDistance}
                  onChange={e => setScaleDistance(e.target.value)}
                  placeholder="Wprowadź odległość"
                  className="px-3 py-2 border border-slate-300 rounded text-sm w-56 focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={scaleUnit}
                  onChange={e => setScaleUnit(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded text-sm"
                >
                  <option value="centymetr">centymetr</option>
                  <option value="metr">metr</option>
                  <option value="milimetr">milimetr</option>
                  <option value="cal">cal</option>
                  <option value="stopa">stopa</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center min-h-[400px]">
              {isPdf ? (
                <iframe
                  src={selectedPlan.file_url + '#toolbar=0'}
                  className="w-full bg-white shadow-lg rounded"
                  style={{ height: '50vh', minWidth: '600px' }}
                />
              ) : (
                <img
                  src={selectedPlan.file_url}
                  alt={selectedPlan.name}
                  className="max-w-full max-h-[50vh] shadow-lg bg-white rounded"
                />
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={handleScaleCalibration}
                disabled={!scaleDistance}
                className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                OK
              </button>
              <button
                onClick={() => setShowScaleModal(false)}
                className="px-6 py-2 border border-slate-300 rounded font-medium hover:bg-slate-50 text-sm text-slate-700"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawingsPage;
