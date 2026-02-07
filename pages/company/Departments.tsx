
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Users, Plus, Trash2, Edit, ChevronRight, ChevronDown,
  Archive, Search, ToggleLeft, ToggleRight, X, AlertCircle, List, GitBranch, Pencil, Loader2,
  Tag, Hash, ChevronUp, Handshake
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Department, ContractorClient } from '../../types';
import { supabase } from '../../lib/supabase';
import { ContractorsPage } from './Contractors';

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
  client_id: string | null;
  rodzaj: string;
  typ: string;
  kod_obiektu: string;
  kod_manual: boolean;
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
  client_id: null,
  rodzaj: '',
  typ: '',
  kod_obiektu: '',
  kod_manual: false,
  address_street: '',
  address_city: '',
  address_postal_code: '',
  address_country: 'Polska',
  latitude: '',
  longitude: '',
  range_meters: '200',
};

// ---------------------------------------------------------------
// Helper: generate Kod obiektu from city and name
// Format: MIASTO\XXY\RR
// MIASTO - город из адреса объекта (первые 3 буквы)
// XX - первые 2 буквы первого слова названия инвестиции
// Y - первая буква второго слова названия (если есть)
// RR - последние 2 цифры года
// Пример: "Osiedle Słoneczne" в Warszawa -> "WAR\OSS\26"
// ---------------------------------------------------------------
function generateKodObiektu(name: string, city?: string): string {
  if (!name) return '';

  // City part (first 3 letters, uppercase, padded with X if needed)
  const cityPart = city ? city.trim().toUpperCase().slice(0, 3).padEnd(3, 'X') : 'XXX';

  // Name part
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);
  let namePart = '';
  if (words.length >= 2) {
    // First 2 letters of first word + first letter of second word
    namePart = (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  } else if (words.length === 1) {
    // First 3 letters of the only word
    namePart = words[0].slice(0, 3).toUpperCase();
  }

  // Year part (last 2 digits)
  const year = String(new Date().getFullYear()).slice(-2);

  return `${cityPart}\\${namePart}\\${year}`;
}

// ---------------------------------------------------------------
// ComboBox Component (select from list or type new value)
// ---------------------------------------------------------------
const ComboBox: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ label, value, options, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    o.toLowerCase().includes(inputValue.toLowerCase())
  );
  const showAddNew = inputValue.trim() && !options.some(o => o.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || `Wybierz lub wpisz ${label.toLowerCase()}...`}
          className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 && !showAddNew && (
            <div className="px-3 py-2 text-sm text-slate-400">Brak opcji</div>
          )}
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setInputValue(opt); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition ${
                opt === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
              }`}
            >
              {opt}
            </button>
          ))}
          {showAddNew && (
            <button
              type="button"
              onClick={() => { onChange(inputValue.trim()); setIsOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition text-emerald-700 border-t border-slate-100 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Dodaj: "{inputValue.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
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
          className="font-medium text-slate-900 hover:text-blue-600 transition truncate text-left flex items-center gap-2"
        >
          {node.name}
          {node.kod_obiektu && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-500">
              {node.kod_obiektu}
            </span>
          )}
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

  // Top-level tab
  const [activeTopTab, setActiveTopTab] = useState<'obiekty' | 'kontrahenci'>('obiekty');

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

  // Rodzaj / Typ options from DB
  const [rodzajOptions, setRodzajOptions] = useState<string[]>([]);
  const [typOptions, setTypOptions] = useState<string[]>([]);

  // Clients for selector
  const [clients, setClients] = useState<ContractorClient[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

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

  const loadRodzajTypOptions = useCallback(async () => {
    if (!currentCompany) return;
    try {
      const [rodzajRes, typRes] = await Promise.all([
        supabase.from('department_rodzaj_options').select('name').eq('company_id', currentCompany.id).order('name'),
        supabase.from('department_typ_options').select('name').eq('company_id', currentCompany.id).order('name'),
      ]);
      if (rodzajRes.data) setRodzajOptions(rodzajRes.data.map((r: any) => r.name));
      if (typRes.data) setTypOptions(typRes.data.map((r: any) => r.name));
    } catch (err) {
      console.error('Error loading rodzaj/typ options:', err);
    }
  }, [currentCompany]);

  const loadClients = useCallback(async () => {
    if (!currentCompany) return;
    try {
      const { data } = await supabase
        .from('contractors_clients')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_archived', false)
        .order('name');
      if (data) setClients(data);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadDepartments();
    loadRodzajTypOptions();
    loadClients();
  }, [loadDepartments, loadRodzajTypOptions, loadClients]);

  // Close client dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = useMemo(() => {
    const term = clientSearchTerm.toLowerCase().trim();
    if (!term) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.nip || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''))
    );
  }, [clients, clientSearchTerm]);

  const selectedClient = useMemo(() => {
    if (!form.client_id) return null;
    return clients.find(c => c.id === form.client_id) || null;
  }, [form.client_id, clients]);

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
    setGeoManualEdit(false);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setClientSearchTerm('');
    setShowClientDropdown(false);
    setShowModal(true);
  };

  const openEditModal = (dept: DepartmentWithCount) => {
    setEditingDept(dept);
    setGeoManualEdit(false);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setClientSearchTerm('');
    setShowClientDropdown(false);
    setForm({
      name: dept.name,
      parent_id: dept.parent_id ?? null,
      client_id: dept.client_id ?? null,
      rodzaj: dept.rodzaj || '',
      typ: dept.typ || '',
      kod_obiektu: dept.kod_obiektu || '',
      kod_manual: !!dept.kod_obiektu,
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

    // Determine kod_obiektu: use manual value or auto-generate
    const kodValue = form.kod_manual && form.kod_obiektu.trim()
      ? form.kod_obiektu.trim()
      : generateKodObiektu(form.name, form.address_city);

    const payload: Record<string, any> = {
      company_id: currentCompany.id,
      name: form.name.trim(),
      parent_id: form.parent_id || null,
      client_id: form.client_id || null,
      rodzaj: form.rodzaj.trim() || null,
      typ: form.typ.trim() || null,
      kod_obiektu: kodValue || null,
      address_street: form.address_street || null,
      address_city: form.address_city || null,
      address_postal_code: form.address_postal_code || null,
      address_country: form.address_country || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      range_meters: form.range_meters ? parseInt(form.range_meters, 10) : 200,
    };

    try {
      // Save new rodzaj/typ options to lookup tables if they don't exist yet
      if (form.rodzaj.trim() && !rodzajOptions.includes(form.rodzaj.trim())) {
        await supabase.from('department_rodzaj_options').upsert(
          { company_id: currentCompany.id, name: form.rodzaj.trim() },
          { onConflict: 'company_id,name' }
        );
      }
      if (form.typ.trim() && !typOptions.includes(form.typ.trim())) {
        await supabase.from('department_typ_options').upsert(
          { company_id: currentCompany.id, name: form.typ.trim() },
          { onConflict: 'company_id,name' }
        );
      }

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
      await loadRodzajTypOptions();
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

  // ------- Address autocomplete (Nominatim) -------
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [geoManualEdit, setGeoManualEdit] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) { setAddressSuggestions([]); return; }
    setAddressLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'pl',
        'accept-language': 'pl',
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': 'MaxMaster-Skill-Platform/1.0' },
      });
      const data = await res.json();
      setAddressSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch (err) {
      console.error('Nominatim error:', err);
      setAddressSuggestions([]);
    } finally {
      setAddressLoading(false);
    }
  }, []);

  const handleStreetInput = (value: string) => {
    setForm(prev => ({ ...prev, address_street: value }));
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    addressDebounceRef.current = setTimeout(() => {
      const fullQuery = [value, form.address_city, form.address_country].filter(Boolean).join(', ');
      searchAddress(fullQuery);
    }, 400);
  };

  const selectSuggestion = (suggestion: any) => {
    const addr = suggestion.address || {};
    const street = [addr.road, addr.house_number].filter(Boolean).join(' ');
    const city = addr.city || addr.town || addr.village || addr.municipality || '';
    const postcode = addr.postcode || '';

    setForm(prev => ({
      ...prev,
      address_street: street || prev.address_street,
      address_city: city,
      address_postal_code: postcode,
      address_country: addr.country || 'Polska',
      latitude: suggestion.lat || '',
      longitude: suggestion.lon || '',
    }));
    setShowSuggestions(false);
    setAddressSuggestions([]);
    setGeoManualEdit(false);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
      {/* Top-level tabs: Obiekty / Kontrahenci */}
      <div className="flex space-x-1 bg-slate-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setActiveTopTab('obiekty')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTopTab === 'obiekty' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Building2 size={18} />
          <span>Obiekty</span>
        </button>
        <button
          onClick={() => setActiveTopTab('kontrahenci')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTopTab === 'kontrahenci' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Handshake size={18} />
          <span>Kontrahenci</span>
        </button>
      </div>

      {activeTopTab === 'kontrahenci' ? (
        <ContractorsPage />
      ) : (
      <>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Kod</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rodzaj</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Typ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Klient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Miasto</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pracownicy</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Geofence</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flatList.map(({ node, depth }) => {
                  const clientName = node.client_id
                    ? clients.find(c => c.id === node.client_id)?.name || '—'
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
                      <td className="px-4 py-3">
                        {node.kod_obiektu ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-700">
                            {node.kod_obiektu}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{node.rodzaj || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{node.typ || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{clientName}</td>
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

              {/* Client selector */}
              <div ref={clientDropdownRef} className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Klient</label>
                {selectedClient ? (
                  <div className="flex items-center justify-between w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{selectedClient.name}</p>
                      {selectedClient.nip && <p className="text-xs text-slate-400 font-mono">{selectedClient.nip}</p>}
                    </div>
                    <button type="button" onClick={() => { setForm(prev => ({ ...prev, client_id: null })); setClientSearchTerm(''); }}
                      className="p-0.5 text-slate-400 hover:text-red-500 shrink-0 ml-2"><X size={16} /></button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={clientSearchTerm}
                        onChange={e => { setClientSearchTerm(e.target.value); setShowClientDropdown(true); }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Szukaj klienta po nazwie lub NIP..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                    {showClientDropdown && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredClients.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-slate-400 text-center">Brak klientów</p>
                        ) : filteredClients.map(client => (
                          <button key={client.id} type="button"
                            onClick={() => { setForm(prev => ({ ...prev, client_id: client.id })); setShowClientDropdown(false); setClientSearchTerm(''); }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{client.name}</p>
                            {client.nip && <p className="text-xs text-slate-400 font-mono">{client.nip}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rodzaj & Typ */}
              <div className="grid grid-cols-2 gap-3">
                <ComboBox
                  label="Rodzaj"
                  value={form.rodzaj}
                  options={rodzajOptions}
                  onChange={val => setForm(prev => ({ ...prev, rodzaj: val }))}
                  placeholder="np. Biuro, Magazyn, Hala..."
                />
                <ComboBox
                  label="Typ"
                  value={form.typ}
                  options={typOptions}
                  onChange={val => setForm(prev => ({ ...prev, typ: val }))}
                  placeholder="np. Wlasny, Wynajmowany..."
                />
              </div>

              {/* Kod obiektu */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kod obiektu
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={form.kod_manual ? form.kod_obiektu : (form.name.trim() ? generateKodObiektu(form.name, form.address_city) : '')}
                      onChange={e => setForm(prev => ({ ...prev, kod_obiektu: e.target.value, kod_manual: true }))}
                      readOnly={!form.kod_manual}
                      placeholder="Auto"
                      className={`w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-mono tracking-wider ${
                        form.kod_manual
                          ? 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                          : 'bg-slate-50 text-slate-500 cursor-default'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (form.kod_manual) {
                        setForm(prev => ({ ...prev, kod_manual: false, kod_obiektu: '' }));
                      } else {
                        setForm(prev => ({ ...prev, kod_manual: true, kod_obiektu: generateKodObiektu(prev.name, prev.address_city) }));
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                      form.kod_manual
                        ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {form.kod_manual ? 'Auto' : 'Edytuj'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {form.kod_manual
                    ? 'Reczna edycja kodu. Kliknij "Auto" aby przywrocic automatyczne generowanie.'
                    : 'Generowany automatycznie: pierwsze litery slow nazwy + rok (np. WC26 = Warszawa Centrum 2026).'}
                </p>
              </div>

              {/* Address section with autocomplete */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  Adres
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 relative" ref={suggestionsRef}>
                    <label className="block text-xs text-slate-500 mb-1">Ulica i numer</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="address_street"
                        value={form.address_street}
                        onChange={e => handleStreetInput(e.target.value)}
                        onFocus={() => { if (addressSuggestions.length > 0) setShowSuggestions(true); }}
                        placeholder="Zacznij pisac adres..."
                        autoComplete="off"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      {addressLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                      )}
                    </div>
                    {/* Suggestions dropdown */}
                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {addressSuggestions.map((s: any, i: number) => (
                          <button
                            key={s.place_id || i}
                            type="button"
                            onClick={() => selectSuggestion(s)}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition text-sm border-b border-slate-50 last:border-b-0"
                          >
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-slate-900 font-medium leading-tight">{s.display_name?.split(',').slice(0, 3).join(',')}</p>
                                <p className="text-slate-400 text-xs mt-0.5">{s.display_name}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                        <div className="px-3 py-1.5 text-[10px] text-slate-300 text-right">
                          Powered by OpenStreetMap Nominatim
                        </div>
                      </div>
                    )}
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

              {/* Geofence section — auto-filled from address, editable via button */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    Geofence
                  </h4>
                  {!geoManualEdit && (form.latitude || form.longitude) && (
                    <button
                      type="button"
                      onClick={() => setGeoManualEdit(true)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition font-medium"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Zmien recznie
                    </button>
                  )}
                  {geoManualEdit && (
                    <button
                      type="button"
                      onClick={() => setGeoManualEdit(false)}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition font-medium"
                    >
                      <X className="w-3.5 h-3.5" />
                      Zablokuj
                    </button>
                  )}
                </div>
                {form.latitude && form.longitude && !geoManualEdit && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-800">
                      {parseFloat(form.latitude).toFixed(4)}, {parseFloat(form.longitude).toFixed(4)}
                    </span>
                    <span className="text-xs text-emerald-600 ml-auto">Automatycznie z adresu</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Szerokosc geogr.</label>
                    <input
                      type="text"
                      name="latitude"
                      value={form.latitude}
                      onChange={handleFormChange}
                      placeholder="52.2297"
                      readOnly={!geoManualEdit && !!(form.latitude && form.longitude)}
                      className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm ${
                        !geoManualEdit && form.latitude && form.longitude
                          ? 'bg-slate-50 text-slate-500 cursor-default'
                          : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                      }`}
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
                      readOnly={!geoManualEdit && !!(form.latitude && form.longitude)}
                      className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm ${
                        !geoManualEdit && form.latitude && form.longitude
                          ? 'bg-slate-50 text-slate-500 cursor-default'
                          : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                      }`}
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
                  {form.latitude && form.longitude
                    ? 'Wspolrzedne uzupelnione automatycznie na podstawie adresu.'
                    : 'Wpisz adres powyzej — wspolrzedne uzupelnia sie automatycznie.'}
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
      </>
      )}
    </div>
  );
};
