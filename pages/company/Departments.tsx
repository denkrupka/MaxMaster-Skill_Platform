
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Users, Plus, Trash2, Edit, ChevronRight, ChevronDown,
  Archive, Search, ToggleLeft, ToggleRight, X, AlertCircle, List, GitBranch
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Department } from '../../types';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface DepartmentWithCount extends Department {
  members_count?: number;
  children?: DepartmentWithCount[];
}

interface DepartmentFormData {
  name: string;
  parent_id: string | null;
  address_street: string;
  address_city: string;
  address_postal_code: string;
  address_country: string;
  latitude: string;
  longitude: string;
  range_meters: string;
}

const EMPTY_FORM: DepartmentFormData = {
  name: '',
  parent_id: null,
  address_street: '',
  address_city: '',
  address_postal_code: '',
  address_country: 'Polska',
  latitude: '',
  longitude: '',
  range_meters: '200',
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function buildTree(flat: DepartmentWithCount[]): DepartmentWithCount[] {
  const map = new Map<string, DepartmentWithCount>();
  const roots: DepartmentWithCount[] = [];

  flat.forEach(d => map.set(d.id, { ...d, children: [] }));

  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function flattenTree(nodes: DepartmentWithCount[], depth = 0): { node: DepartmentWithCount; depth: number }[] {
  const result: { node: DepartmentWithCount; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ node: n, depth });
    if (n.children && n.children.length > 0) {
      result.push(...flattenTree(n.children, depth + 1));
    }
  }
  return result;
}

function matchesSearch(dept: DepartmentWithCount, term: string): boolean {
  if (dept.name.toLowerCase().includes(term)) return true;
  if (dept.children) {
    return dept.children.some(c => matchesSearch(c, term));
  }
  return false;
}

function filterTree(nodes: DepartmentWithCount[], term: string): DepartmentWithCount[] {
  if (!term) return nodes;
  return nodes
    .filter(n => matchesSearch(n, term))
    .map(n => ({
      ...n,
      children: n.children ? filterTree(n.children, term) : [],
    }));
}

// ---------------------------------------------------------------
// TreeNode Component
// ---------------------------------------------------------------

const TreeNode: React.FC<{
  node: DepartmentWithCount;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (dept: DepartmentWithCount) => void;
  onArchive: (dept: DepartmentWithCount) => void;
  onDelete: (dept: DepartmentWithCount) => void;
  onAddChild: (parentId: string) => void;
  onNavigate: (id: string) => void;
}> = ({ node, depth, expanded, toggleExpand, onEdit, onArchive, onDelete, onAddChild, onNavigate }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);

  return (
    <>
      <div
        className={`flex items-center gap-2 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition group ${
          node.is_archived ? 'opacity-60' : ''
        }`}
        style={{ paddingLeft: `${16 + depth * 28}px` }}
      >
        {/* Expand / collapse toggle */}
        <button
          onClick={() => hasChildren && toggleExpand(node.id)}
          className={`w-6 h-6 flex items-center justify-center rounded transition ${
            hasChildren ? 'text-slate-500 hover:bg-slate-200 cursor-pointer' : 'text-transparent cursor-default'
          }`}
        >
          {hasChildren && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
        </button>

        {/* Department icon */}
        <Building2 className="w-5 h-5 text-blue-500 flex-shrink-0" />

        {/* Name – clickable to navigate */}
        <button
          onClick={() => onNavigate(node.id)}
          className="font-medium text-slate-900 hover:text-blue-600 transition truncate text-left"
        >
          {node.name}
        </button>

        {/* Badges */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {/* Member count */}
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" />
            {node.members_count ?? 0}
          </span>

          {/* Geofence indicator */}
          {node.latitude && node.longitude && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600" title="Geofence aktywny">
              <MapPin className="w-3.5 h-3.5" />
            </span>
          )}

          {node.is_archived && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Archiwum
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onAddChild(node.id)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Dodaj podobiekt"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(node)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Edytuj"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onArchive(node)}
              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
              title={node.is_archived ? 'Przywroc' : 'Archiwizuj'}
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(node)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Usun"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Render children when expanded */}
      {hasChildren && isExpanded &&
        node.children!.map(child => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggleExpand={toggleExpand}
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onNavigate={onNavigate}
          />
        ))}
    </>
  );
};

// ---------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------

export const DepartmentsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentCompany } = state;
  const navigate = useNavigate();

  // Data
  const [departments, setDepartments] = useState<DepartmentWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentWithCount | null>(null);
  const [form, setForm] = useState<DepartmentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ------- Data loading -------
  const loadDepartments = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*, department_members(count)')
        .eq('company_id', currentCompany.id)
        .order('name');

      if (error) throw error;

      const mapped: DepartmentWithCount[] = (data || []).map((d: any) => ({
        ...d,
        members_count: d.department_members?.[0]?.count ?? 0,
      }));

      setDepartments(mapped);
    } catch (err) {
      console.error('Error loading departments:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  // ------- Tree building -------
  const visibleDepartments = useMemo(() => {
    const filtered = showArchived ? departments : departments.filter(d => !d.is_archived);
    return filtered;
  }, [departments, showArchived]);

  const tree = useMemo(() => {
    const built = buildTree(visibleDepartments);
    const term = searchTerm.toLowerCase().trim();
    return term ? filterTree(built, term) : built;
  }, [visibleDepartments, searchTerm]);

  const flatList = useMemo(() => flattenTree(tree), [tree]);

  // ------- Expand / collapse -------
  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(departments.map(d => d.id)));
  }, [departments]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  // ------- Modal open helpers -------
  const openCreateModal = (parentId?: string) => {
    setEditingDept(null);
    setForm({ ...EMPTY_FORM, parent_id: parentId || null });
    setShowModal(true);
  };

  const openEditModal = (dept: DepartmentWithCount) => {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      parent_id: dept.parent_id ?? null,
      address_street: dept.address_street || '',
      address_city: dept.address_city || '',
      address_postal_code: dept.address_postal_code || '',
      address_country: dept.address_country || 'Polska',
      latitude: dept.latitude != null ? String(dept.latitude) : '',
      longitude: dept.longitude != null ? String(dept.longitude) : '',
      range_meters: dept.range_meters != null ? String(dept.range_meters) : '200',
    });
    setShowModal(true);
  };

  // ------- CRUD -------
  const handleSave = async () => {
    if (!currentCompany || !form.name.trim()) return;
    setSaving(true);

    const payload: Record<string, any> = {
      company_id: currentCompany.id,
      name: form.name.trim(),
      parent_id: form.parent_id || null,
      address_street: form.address_street || null,
      address_city: form.address_city || null,
      address_postal_code: form.address_postal_code || null,
      address_country: form.address_country || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      range_meters: form.range_meters ? parseInt(form.range_meters, 10) : 200,
    };

    try {
      if (editingDept) {
        const { error } = await supabase
          .from('departments')
          .update(payload)
          .eq('id', editingDept.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('departments')
          .insert([payload]);
        if (error) throw error;
      }
      setShowModal(false);
      setEditingDept(null);
      setForm(EMPTY_FORM);
      await loadDepartments();
    } catch (err: any) {
      console.error('Error saving department:', err);
      alert(err.message || 'Wystapil blad podczas zapisu');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (dept: DepartmentWithCount) => {
    const newValue = !dept.is_archived;
    const label = newValue ? 'zarchiwizowac' : 'przywrocic';
    if (!window.confirm(`Czy na pewno chcesz ${label} obiekt "${dept.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_archived: newValue })
        .eq('id', dept.id);
      if (error) throw error;
      await loadDepartments();
    } catch (err) {
      console.error('Error archiving department:', err);
    }
  };

  const handleDelete = async (dept: DepartmentWithCount) => {
    if (!window.confirm(`Czy na pewno chcesz trwale usunac obiekt "${dept.name}"? Ta operacja jest nieodwracalna.`)) return;

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', dept.id);
      if (error) throw error;
      await loadDepartments();
    } catch (err: any) {
      console.error('Error deleting department:', err);
      alert(err.message || 'Nie mozna usunac obiektu. Sprawdz czy nie ma podobiektow lub przypisanych pracownikow.');
    }
  };

  // ------- Form helpers -------
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Parent select options – exclude self and descendants when editing
  const parentOptions = useMemo(() => {
    if (!editingDept) return departments.filter(d => !d.is_archived);

    // Collect all descendant ids to prevent circular references
    const getDescendantIds = (parentId: string): string[] => {
      const children = departments.filter(d => d.parent_id === parentId);
      return children.reduce<string[]>((acc, c) => [...acc, c.id, ...getDescendantIds(c.id)], []);
    };
    const excluded = new Set([editingDept.id, ...getDescendantIds(editingDept.id)]);
    return departments.filter(d => !d.is_archived && !excluded.has(d.id));
  }, [departments, editingDept]);

  // ------- Render guards -------
  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <p className="text-yellow-800">Brak przypisanej firmy</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Obiekty</h1>
          <p className="text-slate-500 mt-1">
            {currentCompany.name} &mdash; {visibleDepartments.length} obiektow
          </p>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Dodaj obiekt
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj obiektow..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Show archived toggle */}
          <button
            onClick={() => setShowArchived(prev => !prev)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition text-sm font-medium ${
              showArchived
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showArchived ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            Pokaz archiwalne
          </button>

          {/* View mode toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${
                viewMode === 'tree' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Drzewo
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${
                viewMode === 'table' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <List className="w-4 h-4" />
              Tabela
            </button>
          </div>

          {/* Expand / collapse */}
          {viewMode === 'tree' && (
            <div className="flex items-center gap-1">
              <button onClick={expandAll} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 transition">
                Rozwin
              </button>
              <span className="text-slate-300">|</span>
              <button onClick={collapseAll} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 transition">
                Zwin
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500">Ladowanie obiektow...</p>
        </div>
      ) : tree.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nie znaleziono obiektow</p>
          <button
            onClick={() => openCreateModal()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj pierwszy obiekt
          </button>
        </div>
      ) : viewMode === 'tree' ? (
        /* -------- Tree View -------- */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {tree.map(rootNode => (
            <TreeNode
              key={rootNode.id}
              node={rootNode}
              depth={0}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onEdit={openEditModal}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onAddChild={parentId => openCreateModal(parentId)}
              onNavigate={id => navigate(`/company/departments/${id}`)}
            />
          ))}
        </div>
      ) : (
        /* -------- Table View -------- */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Nazwa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Obiekt nadrzedny</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Miasto</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pracownicy</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Geofence</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flatList.map(({ node, depth }) => {
                  const parentName = node.parent_id
                    ? departments.find(d => d.id === node.parent_id)?.name || '—'
                    : '—';
                  return (
                    <tr key={node.id} className={`hover:bg-slate-50 ${node.is_archived ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/company/departments/${node.id}`)}
                          className="flex items-center gap-2 hover:text-blue-600 transition"
                          style={{ paddingLeft: `${depth * 20}px` }}
                        >
                          <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="font-medium text-slate-900">{node.name}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{parentName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{node.address_city || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                          <Users className="w-3.5 h-3.5" />
                          {node.members_count ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {node.latitude && node.longitude ? (
                          <MapPin className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {node.is_archived ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Archiwum
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Aktywny
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openCreateModal(node.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Dodaj podobiekt"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(node)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edytuj"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(node)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title={node.is_archived ? 'Przywroc' : 'Archiwizuj'}
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(node)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Usun"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Create / Edit Modal                                              */}
      {/* ---------------------------------------------------------------- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">
                {editingDept ? 'Edytuj obiekt' : 'Nowy obiekt'}
              </h3>
              <button
                onClick={() => { setShowModal(false); setEditingDept(null); setForm(EMPTY_FORM); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa obiektu *</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="np. Obiekt Warszawa Centrum"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Parent */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Obiekt nadrzedny</label>
                <select
                  name="parent_id"
                  value={form.parent_id || ''}
                  onChange={e => setForm(prev => ({ ...prev, parent_id: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">— Brak (obiekt glowny) —</option>
                  {parentOptions.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Address section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  Adres
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Ulica i numer</label>
                    <input
                      type="text"
                      name="address_street"
                      value={form.address_street}
                      onChange={handleFormChange}
                      placeholder="ul. Przykladowa 10"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Miasto</label>
                    <input
                      type="text"
                      name="address_city"
                      value={form.address_city}
                      onChange={handleFormChange}
                      placeholder="Warszawa"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Kod pocztowy</label>
                    <input
                      type="text"
                      name="address_postal_code"
                      value={form.address_postal_code}
                      onChange={handleFormChange}
                      placeholder="00-001"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Kraj</label>
                    <input
                      type="text"
                      name="address_country"
                      value={form.address_country}
                      onChange={handleFormChange}
                      placeholder="Polska"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Geofence section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  Geofence
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Szerokosc geogr.</label>
                    <input
                      type="text"
                      name="latitude"
                      value={form.latitude}
                      onChange={handleFormChange}
                      placeholder="52.2297"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Dlugosc geogr.</label>
                    <input
                      type="text"
                      name="longitude"
                      value={form.longitude}
                      onChange={handleFormChange}
                      placeholder="21.0122"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Zasieg (m)</label>
                    <input
                      type="number"
                      name="range_meters"
                      value={form.range_meters}
                      onChange={handleFormChange}
                      placeholder="200"
                      min={0}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Uzupelnij wspolrzedne, aby aktywowac geofence dla rejestracji czasu pracy.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => { setShowModal(false); setEditingDept(null); setForm(EMPTY_FORM); }}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
              >
                Anuluj
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 transition"
              >
                {saving ? 'Zapisywanie...' : editingDept ? 'Zapisz zmiany' : 'Dodaj obiekt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
