
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, X, Search, FolderKanban, Users, Clock, FileText, Pencil, Trash2,
  Calendar, DollarSign, LayoutGrid, List, ChevronRight, Loader2, Eye,
  Play, CheckCircle2, ClipboardList, ArrowRight, Timer, UserPlus, UserMinus,
  Download, Tag, AlertCircle, BarChart3, Briefcase, Filter, ArrowLeft,
  Settings, ChevronDown, ExternalLink, Building2, MapPin, TrendingUp,
  Receipt, Wrench, FileCheck, Shield, Paperclip, MessageSquare, Upload,
  Check, XCircle, RefreshCw, Printer, Hash, ToggleLeft, ToggleRight,
  Home, ChevronsRight
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project, ProjectTask, ProjectMember, ProjectCustomer, TaskTimeLog,
  TaskAttachment, TaskStatus_Project, TaskPriority, ProjectStatus, User,
  Department, ProjectBillingType, ProjectNameMode, ProjectProtocol,
  ProjectIncome, ProjectCost, ProjectScheduleEntry, ProjectIssue,
  ProjectFile, ProjectMemberType, ProjectMemberPaymentType, ProjectMemberStatus,
  ProjectIssueStatus, ProjectTaskBillingType, ProjectTaskWorkerPayment,
  ProjectProtocolTask, ProjectIssueHistoryEntry, ProjectCustomerContact,
  ContractorClient
} from '../../types';
import { SectionTabs } from '../../components/SectionTabs';
import { ProjectDetailPage } from './ProjectDetail';

const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'Aktywny', bg: 'bg-green-100', text: 'text-green-700' },
  completed: { label: 'Zakończony', bg: 'bg-blue-100', text: 'text-blue-700' },
  archived: { label: 'Zarchiwizowany', bg: 'bg-gray-100', text: 'text-gray-600' },
  on_hold: { label: 'Wstrzymany', bg: 'bg-amber-100', text: 'text-amber-700' },
};

const COLOR_OPTIONS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

interface HourlySettings {
  overtime_paid: boolean;
  overtime_rate: string;
  overtime_base_hours: string;
  saturday_paid: boolean;
  saturday_rate: string;
  saturday_hours: string;
  sunday_paid: boolean;
  sunday_rate: string;
  sunday_hours: string;
  night_paid: boolean;
  night_rate: string;
  night_start_hour: string;
  night_end_hour: string;
  travel_paid: boolean;
  travel_rate: string;
  travel_hours: string;
}

const emptyHourlySettings: HourlySettings = {
  overtime_paid: false, overtime_rate: '', overtime_base_hours: '8',
  saturday_paid: false, saturday_rate: '', saturday_hours: '8',
  sunday_paid: false, sunday_rate: '', sunday_hours: '8',
  night_paid: false, night_rate: '', night_start_hour: '22:00', night_end_hour: '06:00',
  travel_paid: false, travel_rate: '', travel_hours: '1',
};

const emptyProjectForm = {
  name: '', description: '', customer_id: '', department_id: '',
  name_mode: 'custom' as ProjectNameMode,
  status: 'active' as ProjectStatus,
  color: '#3B82F6',
  billing_type: 'ryczalt' as ProjectBillingType,
  budget_hours: '', budget_amount: '',
  hourly_rate: '',
  start_date: '', end_date: '',
};

export const CompanyProjectsPage: React.FC = () => {
  const { state, setState } = useAppContext();
  const { currentUser, users } = state;

  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [contractorClients, setContractorClients] = useState<ContractorClient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('active');

  // Project costs for list columns
  const [projectCosts, setProjectCosts] = useState<ProjectCost[]>([]);
  const [projectIncome, setProjectIncome] = useState<ProjectIncome[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  // Create / Edit project modal
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [hourlySettings, setHourlySettings] = useState<HourlySettings>(emptyHourlySettings);
  const [showHourlySettingsModal, setShowHourlySettingsModal] = useState(false);
  const [savingProject, setSavingProject] = useState(false);

  // Client search for modal
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Project detail view
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const companyUsers = useMemo(() =>
    users.filter(u => u.company_id === currentUser?.company_id && u.status === 'active'),
    [users, currentUser]
  );

  // Filtered clients for searchable dropdown
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm.trim()) return contractorClients;
    const term = clientSearchTerm.toLowerCase();
    return contractorClients.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.nip || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''))
    );
  }, [contractorClients, clientSearchTerm]);

  // Departments filtered by selected client
  const filteredDepartments = useMemo(() => {
    if (!projectForm.customer_id) return departments;
    return departments.filter(d => d.client_id === projectForm.customer_id);
  }, [departments, projectForm.customer_id]);

  // Selected client object
  const selectedClient = useMemo(() => {
    if (!projectForm.customer_id) return null;
    return contractorClients.find(c => c.id === projectForm.customer_id) || null;
  }, [projectForm.customer_id, contractorClients]);

  async function loadData() {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Core queries (tables that always exist)
      const [projRes, custRes, ccRes, deptRes] = await Promise.all([
        supabase.from('projects').select('*').eq('company_id', currentUser.company_id).order('created_at', { ascending: false }),
        supabase.from('project_customers').select('*').eq('company_id', currentUser.company_id).eq('is_archived', false),
        supabase.from('contractors_clients').select('*').eq('company_id', currentUser.company_id).eq('is_archived', false),
        supabase.from('departments').select('*').eq('company_id', currentUser.company_id).eq('is_archived', false),
      ]);
      if (projRes.data) setProjects(projRes.data);
      if (custRes.data) setCustomers(custRes.data);
      if (ccRes.data) setContractorClients(ccRes.data);
      if (deptRes.data) setDepartments(deptRes.data);

      // Extended queries (tables/columns from migrations - may not exist yet, ignore errors)
      const companyProjectIds = new Set((projRes.data || []).map((p: any) => p.id));
      const [costsRes, incomeRes, membersRes] = await Promise.all([
        supabase.from('project_costs').select('*').eq('company_id', currentUser.company_id).then(r => r.data || []).catch(() => []),
        supabase.from('project_income').select('*').eq('company_id', currentUser.company_id).then(r => r.data || []).catch(() => []),
        supabase.from('project_members').select('*').then(r => r.data || []).catch(() => []),
      ]);
      setProjectCosts(costsRes as ProjectCost[]);
      setProjectIncome(incomeRes as ProjectIncome[]);
      setProjectMembers((membersRes as ProjectMember[]).filter((m: any) => companyProjectIds.has(m.project_id)));
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  function openCreateModal() {
    setEditingProject(null);
    setProjectForm(emptyProjectForm);
    setHourlySettings(emptyHourlySettings);
    setClientSearchTerm('');
    setShowClientDropdown(false);
    setShowProjectModal(true);
  }

  function openEditModal(project: Project) {
    setEditingProject(project);
    // Use contractor_client_id if set, otherwise fall back to customer_id
    const clientId = project.contractor_client_id || project.customer_id || '';
    setProjectForm({
      name: project.name,
      description: project.description || '',
      customer_id: clientId,
      department_id: project.department_id || '',
      name_mode: project.name_mode || 'custom',
      status: project.status,
      color: project.color || '#3B82F6',
      billing_type: project.billing_type || 'ryczalt',
      budget_hours: project.budget_hours?.toString() || '',
      budget_amount: project.budget_amount?.toString() || '',
      hourly_rate: project.hourly_rate?.toString() || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
    });
    setHourlySettings({
      overtime_paid: project.overtime_paid || false,
      overtime_rate: project.overtime_rate?.toString() || '',
      overtime_base_hours: project.overtime_base_hours?.toString() || '8',
      saturday_paid: project.saturday_paid || false,
      saturday_rate: project.saturday_rate?.toString() || '',
      saturday_hours: project.saturday_hours?.toString() || '8',
      sunday_paid: project.sunday_paid || false,
      sunday_rate: project.sunday_rate?.toString() || '',
      sunday_hours: project.sunday_hours?.toString() || '8',
      night_paid: project.night_paid || false,
      night_rate: project.night_rate?.toString() || '',
      night_start_hour: project.night_start_hour != null ? `${String(Math.floor(project.night_start_hour)).padStart(2,'0')}:00` : '22:00',
      night_end_hour: project.night_end_hour != null ? `${String(Math.floor(project.night_end_hour)).padStart(2,'0')}:00` : '06:00',
      travel_paid: project.travel_paid || false,
      travel_rate: project.travel_rate?.toString() || '',
      travel_hours: project.travel_hours?.toString() || '1',
    });
    setClientSearchTerm('');
    setShowClientDropdown(false);
    setShowProjectModal(true);
  }

  function handleDepartmentChange(deptId: string) {
    if (deptId) {
      const dept = departments.find(d => d.id === deptId);
      if (dept) {
        setProjectForm(prev => ({
          ...prev,
          department_id: deptId,
          name: prev.name_mode === 'object' ? dept.name : prev.name,
          // Auto-select client linked to this department
          customer_id: dept.client_id || prev.customer_id,
        }));
      } else {
        setProjectForm(prev => ({ ...prev, department_id: deptId }));
      }
    } else {
      setProjectForm(prev => ({ ...prev, department_id: '' }));
    }
  }

  async function saveProject() {
    if (!currentUser) return;
    const nameToUse = projectForm.name_mode === 'object'
      ? departments.find(d => d.id === projectForm.department_id)?.name || projectForm.name
      : projectForm.name;
    if (!nameToUse.trim()) return;

    setSavingProject(true);
    try {
      // Determine if customer_id is from project_customers (FK safe) or contractors_clients
      const selectedCustomerId = projectForm.customer_id || null;
      const isProjectCustomer = selectedCustomerId ? customers.some(c => c.id === selectedCustomerId) : false;
      const isContractorClient = selectedCustomerId && !isProjectCustomer;

      // Build full payload with all fields
      const payload: any = {
        company_id: currentUser.company_id,
        name: nameToUse.trim(),
        description: projectForm.description.trim() || null,
        customer_id: isProjectCustomer ? selectedCustomerId : null,
        status: projectForm.status,
        color: projectForm.color,
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null,
        updated_at: new Date().toISOString(),
        // Extended fields (may not exist in DB yet)
        name_mode: projectForm.name_mode,
        department_id: projectForm.department_id || null,
        billing_type: projectForm.billing_type,
        contractor_client_id: isContractorClient ? selectedCustomerId : null,
      };

      if (projectForm.billing_type === 'ryczalt') {
        payload.budget_hours = projectForm.budget_hours ? parseFloat(projectForm.budget_hours) : null;
        payload.budget_amount = projectForm.budget_amount ? parseFloat(projectForm.budget_amount) : null;
        payload.hourly_rate = null;
        payload.overtime_paid = false;
        payload.saturday_paid = false;
        payload.sunday_paid = false;
        payload.night_paid = false;
        payload.travel_paid = false;
      } else {
        payload.hourly_rate = projectForm.hourly_rate ? parseFloat(projectForm.hourly_rate) : null;
        payload.budget_hours = null;
        payload.budget_amount = null;
        payload.overtime_paid = hourlySettings.overtime_paid;
        payload.overtime_rate = hourlySettings.overtime_rate ? parseFloat(hourlySettings.overtime_rate) : null;
        payload.overtime_base_hours = hourlySettings.overtime_base_hours ? parseFloat(hourlySettings.overtime_base_hours) : null;
        payload.saturday_paid = hourlySettings.saturday_paid;
        payload.saturday_rate = hourlySettings.saturday_rate ? parseFloat(hourlySettings.saturday_rate) : null;
        payload.saturday_hours = hourlySettings.saturday_hours ? parseFloat(hourlySettings.saturday_hours) : null;
        payload.sunday_paid = hourlySettings.sunday_paid;
        payload.sunday_rate = hourlySettings.sunday_rate ? parseFloat(hourlySettings.sunday_rate) : null;
        payload.sunday_hours = hourlySettings.sunday_hours ? parseFloat(hourlySettings.sunday_hours) : null;
        payload.night_paid = hourlySettings.night_paid;
        payload.night_rate = hourlySettings.night_rate ? parseFloat(hourlySettings.night_rate) : null;
        payload.night_start_hour = hourlySettings.night_start_hour ? parseInt(hourlySettings.night_start_hour.split(':')[0], 10) : null;
        payload.night_end_hour = hourlySettings.night_end_hour ? parseInt(hourlySettings.night_end_hour.split(':')[0], 10) : null;
        payload.travel_paid = hourlySettings.travel_paid;
        payload.travel_rate = hourlySettings.travel_rate ? parseFloat(hourlySettings.travel_rate) : null;
        payload.travel_hours = hourlySettings.travel_hours ? parseFloat(hourlySettings.travel_hours) : null;
      }

      // Dynamically retry, removing missing columns detected from error messages
      let resultData: any = null;
      let lastError: any = null;
      const removedCols: string[] = [];

      for (let attempt = 0; attempt < 15; attempt++) {
        const { data, error } = editingProject
          ? await supabase.from('projects').update(payload).eq('id', editingProject.id).select().single()
          : await supabase.from('projects').insert(payload).select().single();

        if (!error && data) {
          resultData = data;
          break;
        }

        // Parse error to find missing column name
        const colMatch = error?.message?.match(/Could not find the '(\w+)' column/);
        const fkMatch = error?.message?.match(/violates foreign key constraint/);

        if (colMatch) {
          const col = colMatch[1];
          delete payload[col];
          removedCols.push(col);
        } else if (fkMatch && payload.customer_id) {
          // FK constraint violation - clear customer_id
          payload.customer_id = null;
          removedCols.push('customer_id(FK)');
        } else {
          // Unknown error, stop retrying
          lastError = error;
          break;
        }
      }

      if (resultData) {
        if (editingProject) {
          setProjects(prev => prev.map(p => p.id === resultData.id ? resultData : p));
          if (selectedProject?.id === resultData.id) setSelectedProject(resultData);
        } else {
          setProjects(prev => [resultData, ...prev]);
        }
        if (removedCols.length > 0) {
          console.warn('Saved with missing columns (run migrations to fix):', removedCols);
        }
        setState(prev => ({ ...prev, toast: { title: 'Sukces', message: editingProject ? 'Projekt został zaktualizowany' : 'Projekt został utworzony' } }));
      } else {
        console.error('Save failed:', lastError);
        setState(prev => ({ ...prev, toast: { title: 'Błąd', message: editingProject ? 'Nie udało się zaktualizować projektu' : 'Nie udało się utworzyć projektu' } }));
      }

      setShowProjectModal(false);
    } catch (err) {
      console.error('Error saving project:', err);
      setState(prev => ({ ...prev, toast: { title: 'Błąd', message: 'Wystąpił nieoczekiwany błąd' } }));
    } finally {
      setSavingProject(false);
    }
  }

  async function deleteProject(projectId: string) {
    if (!confirm('Czy na pewno chcesz usunąć ten projekt? Wszystkie powiązane dane zostaną również usunięte.')) return;
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (!error) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) setSelectedProject(null);
      setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Projekt został usunięty' } }));
    }
  }

  function getUserName(userId?: string) {
    if (!userId) return 'Nieprzypisany';
    const u = users.find(u => u.id === userId);
    return u ? `${u.first_name} ${u.last_name}` : 'Nieznany';
  }

  function getCustomerName(customerId?: string) {
    if (!customerId) return '-';
    // Check contractor_clients first, then fall back to project_customers
    const cc = contractorClients.find(c => c.id === customerId);
    if (cc) return cc.name;
    return customers.find(c => c.id === customerId)?.name || '-';
  }

  function getDepartmentName(deptId?: string) {
    if (!deptId) return '-';
    return departments.find(d => d.id === deptId)?.name || '-';
  }

  // Calculate budget display for list
  function getBudgetDisplay(project: Project) {
    if (project.billing_type === 'ryczalt' || !project.billing_type) {
      if (!project.budget_amount) return '-';
      const totalInvoiced = projectIncome
        .filter(i => i.project_id === project.id)
        .reduce((s, i) => s + (i.value || 0), 0);
      const percent = project.budget_amount > 0 ? Math.min((totalInvoiced / project.budget_amount) * 100, 100) : 0;
      return { type: 'bar' as const, total: project.budget_amount, used: totalInvoiced, percent };
    } else {
      // Hourly - calculate earned amount based on confirmed hours
      // Formula: weekday_hours * rate + saturday_hours * saturday_rate + sunday_hours * sunday_rate
      const earnedFromIncome = projectIncome
        .filter(i => i.project_id === project.id)
        .reduce((s, i) => s + (i.value || 0), 0);
      const rate = project.hourly_rate || 0;
      return {
        type: 'hourly' as const,
        rate,
        earned: earnedFromIncome,
        saturdayRate: project.saturday_paid ? (project.saturday_rate || 0) : 0,
        sundayRate: project.sunday_paid ? (project.sunday_rate || 0) : 0,
      };
    }
  }

  // Calculate direct costs for a project
  function getDirectCosts(projectId: string) {
    return projectCosts.filter(c => c.project_id === projectId && c.cost_type === 'direct').reduce((s, c) => s + (c.value_netto || 0), 0);
  }

  // Calculate labor costs (simplified)
  function getLaborCosts(projectId: string) {
    return projectCosts.filter(c => c.project_id === projectId && c.cost_type === 'labor').reduce((s, c) => s + (c.value_netto || 0), 0);
  }

  // Calculate profit
  function getProfit(project: Project) {
    const budget = project.billing_type === 'ryczalt' ? (project.budget_amount || 0) : 0;
    const directCosts = getDirectCosts(project.id);
    const laborCosts = getLaborCosts(project.id);
    return budget - directCosts - laborCosts;
  }

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (statusFilter !== 'all') {
      list = list.filter(p => p.status === statusFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(s) ||
        getCustomerName(p.contractor_client_id || p.customer_id).toLowerCase().includes(s)
      );
    }
    return list;
  }, [projects, search, customers, statusFilter]);

  // ========== RENDER MODAL FUNCTIONS ==========
  function renderProjectModal() {
    if (!showProjectModal) return null;
    const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowProjectModal(false)} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              {editingProject ? 'Edytuj projekt' : 'Nowy projekt'}
            </h2>
            <button onClick={() => setShowProjectModal(false)} className="p-1 rounded-lg hover:bg-gray-100 -mr-1">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            {/* Client */}
            <div className="relative">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Klient</label>
              {selectedClient ? (
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-blue-50/50">
                  <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedClient.name}</p>
                    {selectedClient.nip && <p className="text-[11px] text-gray-400 font-mono">{selectedClient.nip}</p>}
                  </div>
                  <button type="button" onClick={() => { setProjectForm(prev => ({ ...prev, customer_id: '', department_id: '' })); setClientSearchTerm(''); }} className="p-0.5 text-gray-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input type="text" value={clientSearchTerm} onChange={(e) => { setClientSearchTerm(e.target.value); setShowClientDropdown(true); }} onFocus={() => setShowClientDropdown(true)} placeholder="Szukaj po nazwie lub NIP..." className="w-full pl-8 pr-3 border border-gray-200 rounded-lg py-1.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white" />
                  {showClientDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                      <button type="button" onClick={() => { setProjectForm(prev => ({ ...prev, customer_id: '' })); setShowClientDropdown(false); setClientSearchTerm(''); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 border-b border-gray-100">-- Brak klienta --</button>
                      {filteredClients.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400">Brak wyników</p>
                      ) : filteredClients.map(client => (
                        <button key={client.id} type="button" onClick={() => { setProjectForm(prev => ({ ...prev, customer_id: client.id })); setShowClientDropdown(false); setClientSearchTerm(''); }} className="w-full text-left px-3 py-1.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                          <p className="text-sm text-gray-800 truncate">{client.name}</p>
                          {client.nip && <p className="text-[11px] text-gray-400 font-mono">{client.nip}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Name source */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Źródło nazwy</label>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 w-fit">
                <button onClick={() => setProjectForm(prev => ({ ...prev, name_mode: 'custom' }))} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${projectForm.name_mode === 'custom' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Nazwa własna</button>
                <button onClick={() => setProjectForm(prev => ({ ...prev, name_mode: 'object' }))} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${projectForm.name_mode === 'object' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Wybrać obiekt</button>
              </div>
            </div>

            {projectForm.name_mode === 'custom' ? (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Nazwa projektu *</label>
                <input type="text" value={projectForm.name} onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))} className={inputCls} placeholder="Nazwa projektu" />
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Obiekt *</label>
                <div className="flex gap-2">
                  <select value={projectForm.department_id} onChange={(e) => handleDepartmentChange(e.target.value)} className={`flex-1 ${inputCls}`}>
                    <option value="">-- Wybierz --</option>
                    {filteredDepartments.map(d => <option key={d.id} value={d.id}>{d.name} {d.kod_obiektu ? `(${d.kod_obiektu})` : ''}</option>)}
                  </select>
                  <a href="#/company/departments" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"><Plus className="w-3.5 h-3.5" /> Nowy</a>
                </div>
                {projectForm.customer_id && filteredDepartments.length < departments.length && filteredDepartments.length > 0 && (
                  <p className="mt-1 text-[11px] text-gray-400">Filtrowane wg wybranego klienta</p>
                )}
                {projectForm.customer_id && filteredDepartments.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-500">Brak obiektów dla tego klienta</p>
                )}
                {projectForm.department_id && (() => {
                  const dept = departments.find(d => d.id === projectForm.department_id);
                  if (!dept) return null;
                  return (
                    <div className="mt-1.5 px-3 py-2 bg-gray-50 rounded-lg text-[11px] text-gray-500 leading-relaxed">
                      {dept.kod_obiektu && <span className="mr-3"><b>Kod:</b> {dept.kod_obiektu}</span>}
                      {dept.rodzaj && <span className="mr-3"><b>Rodzaj:</b> {dept.rodzaj}</span>}
                      {dept.typ && <span className="mr-3"><b>Typ:</b> {dept.typ}</span>}
                      {(dept.address_street || dept.address_city) && <><br /><b>Adres:</b> {[dept.address_street, dept.address_postal_code, dept.address_city].filter(Boolean).join(', ')}</>}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Opis</label>
              <textarea value={projectForm.description} onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))} rows={2} className={inputCls} placeholder="Opis projektu..." />
            </div>

            {/* Status + Color */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                <select value={projectForm.status} onChange={(e) => setProjectForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))} className={inputCls}>
                  {Object.entries(PROJECT_STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Kolor</label>
                <div className="flex flex-wrap gap-1">
                  {COLOR_OPTIONS.map(color => (
                    <button key={color} onClick={() => setProjectForm(prev => ({ ...prev, color }))} className={`w-5 h-5 rounded-full border-2 transition-transform ${projectForm.color === color ? 'border-gray-700 scale-110' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Billing type */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Forma wynagrodzenia</label>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 w-fit">
                <button onClick={() => setProjectForm(prev => ({ ...prev, billing_type: 'ryczalt' }))} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${projectForm.billing_type === 'ryczalt' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Ryczałt</button>
                <button onClick={() => setProjectForm(prev => ({ ...prev, billing_type: 'hourly' }))} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${projectForm.billing_type === 'hourly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Roboczogodziny</button>
              </div>
            </div>

            {projectForm.billing_type === 'ryczalt' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Budżet godzin</label>
                  <input type="number" value={projectForm.budget_hours} onChange={(e) => setProjectForm(prev => ({ ...prev, budget_hours: e.target.value }))} className={inputCls} placeholder="np. 100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Budżet netto (PLN)</label>
                  <input type="number" value={projectForm.budget_amount} onChange={(e) => setProjectForm(prev => ({ ...prev, budget_amount: e.target.value }))} className={inputCls} placeholder="np. 50000" />
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Stawka netto (PLN/godz.)</label>
                  <input type="number" value={projectForm.hourly_rate} onChange={(e) => setProjectForm(prev => ({ ...prev, hourly_rate: e.target.value }))} className={inputCls} placeholder="np. 65" />
                </div>
                <button onClick={() => setShowHourlySettingsModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Settings className="w-3.5 h-3.5" /> Dodatkowe
                </button>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Data rozpoczęcia</label>
                <input type="date" value={projectForm.start_date} onChange={(e) => setProjectForm(prev => ({ ...prev, start_date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Data zakończenia</label>
                <input type="date" value={projectForm.end_date} onChange={(e) => setProjectForm(prev => ({ ...prev, end_date: e.target.value }))} className={inputCls} />
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 bg-white flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
            <button onClick={() => setShowProjectModal(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Anuluj</button>
            <button onClick={saveProject} disabled={savingProject || (projectForm.name_mode === 'custom' ? !projectForm.name.trim() : !projectForm.department_id)} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
              {savingProject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingProject ? 'Zapisz' : 'Utwórz'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderHourlySettingsModal() {
    if (!showHourlySettingsModal) return null;
    const sInput = 'w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 bg-white';
    const toggleBtn = (active: boolean, toggle: () => void) => (
      <button onClick={toggle} className="flex-shrink-0">
        {active ? <ToggleRight className="w-7 h-4 text-blue-600" /> : <ToggleLeft className="w-7 h-4 text-gray-300" />}
      </button>
    );
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowHourlySettingsModal(false)} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Ustawienia stawek</h2>
            <button onClick={() => setShowHourlySettingsModal(false)} className="p-1 rounded-lg hover:bg-gray-100 -mr-1">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="px-4 py-3 space-y-2">
            {/* Workday rate */}
            <div className="p-2.5 bg-blue-50/60 rounded-lg">
              <label className="text-xs font-medium text-gray-600 block mb-1">Stawka za dni robocze netto (PLN/godz.)</label>
              <input type="number" value={projectForm.hourly_rate} onChange={(e) => setProjectForm(prev => ({ ...prev, hourly_rate: e.target.value }))} className={sInput} />
            </div>

            {/* Overtime */}
            <div className="p-2.5 border border-gray-100 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Nadgodziny</span>
                {toggleBtn(hourlySettings.overtime_paid, () => setHourlySettings(prev => ({ ...prev, overtime_paid: !prev.overtime_paid })))}
              </div>
              {hourlySettings.overtime_paid && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><label className="text-[11px] text-gray-400">Stawka netto</label><input type="number" value={hourlySettings.overtime_rate} onChange={(e) => setHourlySettings(prev => ({ ...prev, overtime_rate: e.target.value }))} className={sInput} /></div>
                  <div><label className="text-[11px] text-gray-400">Godz. podstaw./dzień</label><input type="number" value={hourlySettings.overtime_base_hours} onChange={(e) => setHourlySettings(prev => ({ ...prev, overtime_base_hours: e.target.value }))} className={sInput} /></div>
                </div>
              )}
            </div>

            {/* Saturday */}
            <div className="p-2.5 border border-gray-100 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Soboty</span>
                {toggleBtn(hourlySettings.saturday_paid, () => setHourlySettings(prev => ({ ...prev, saturday_paid: !prev.saturday_paid })))}
              </div>
              {hourlySettings.saturday_paid && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><label className="text-[11px] text-gray-400">Stawka netto</label><input type="number" value={hourlySettings.saturday_rate} onChange={(e) => setHourlySettings(prev => ({ ...prev, saturday_rate: e.target.value }))} className={sInput} /></div>
                  <div><label className="text-[11px] text-gray-400">Godz. pracy</label><input type="number" value={hourlySettings.saturday_hours} onChange={(e) => setHourlySettings(prev => ({ ...prev, saturday_hours: e.target.value }))} className={sInput} /></div>
                </div>
              )}
            </div>

            {/* Sunday */}
            <div className="p-2.5 border border-gray-100 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Niedziele</span>
                {toggleBtn(hourlySettings.sunday_paid, () => setHourlySettings(prev => ({ ...prev, sunday_paid: !prev.sunday_paid })))}
              </div>
              {hourlySettings.sunday_paid && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><label className="text-[11px] text-gray-400">Stawka netto</label><input type="number" value={hourlySettings.sunday_rate} onChange={(e) => setHourlySettings(prev => ({ ...prev, sunday_rate: e.target.value }))} className={sInput} /></div>
                  <div><label className="text-[11px] text-gray-400">Godz. pracy</label><input type="number" value={hourlySettings.sunday_hours} onChange={(e) => setHourlySettings(prev => ({ ...prev, sunday_hours: e.target.value }))} className={sInput} /></div>
                </div>
              )}
            </div>

            {/* Night */}
            <div className="p-2.5 border border-gray-100 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Prace nocne</span>
                {toggleBtn(hourlySettings.night_paid, () => setHourlySettings(prev => ({ ...prev, night_paid: !prev.night_paid })))}
              </div>
              {hourlySettings.night_paid && (
                <div className="space-y-2 mt-2">
                  <div><label className="text-[11px] text-gray-400">Stawka netto</label><input type="number" value={hourlySettings.night_rate} onChange={(e) => setHourlySettings(prev => ({ ...prev, night_rate: e.target.value }))} className={sInput} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-400">Od (początek nocy)</label>
                      <input type="time" value={hourlySettings.night_start_hour} onChange={(e) => setHourlySettings(prev => ({ ...prev, night_start_hour: e.target.value }))} className={sInput} />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400">Do (koniec nocy)</label>
                      <input type="time" value={hourlySettings.night_end_hour} onChange={(e) => setHourlySettings(prev => ({ ...prev, night_end_hour: e.target.value }))} className={sInput} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Travel */}
            <div className="p-2.5 border border-gray-100 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Dojazd</span>
                {toggleBtn(hourlySettings.travel_paid, () => setHourlySettings(prev => ({ ...prev, travel_paid: !prev.travel_paid })))}
              </div>
              {hourlySettings.travel_paid && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><label className="text-[11px] text-gray-400">Stawka netto</label><input type="number" value={hourlySettings.travel_rate} onChange={(e) => setHourlySettings(prev => ({ ...prev, travel_rate: e.target.value }))} className={sInput} /></div>
                  <div><label className="text-[11px] text-gray-400">Szac. godzin</label><input type="number" value={hourlySettings.travel_hours} onChange={(e) => setHourlySettings(prev => ({ ...prev, travel_hours: e.target.value }))} className={sInput} /></div>
                </div>
              )}
            </div>
          </div>
          <div className="sticky bottom-0 bg-white flex justify-end px-4 py-2.5 border-t border-gray-100">
            <button onClick={() => setShowHourlySettingsModal(false)} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Gotowe</button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  // ========== PROJECT DETAIL VIEW ==========
  if (selectedProject) {
    return (
      <>
        <ProjectDetailPage
          project={selectedProject}
          projects={projects}
          customers={customers}
          contractorClients={contractorClients}
          departments={departments}
          companyUsers={companyUsers}
          users={users}
          onBack={() => { setSelectedProject(null); loadData(); }}
          onEditProject={openEditModal}
          onUpdateProject={(updated) => {
            setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
            setSelectedProject(updated);
          }}
        />
        {renderProjectModal()}
        {renderHourlySettingsModal()}
      </>
    );
  }

  // ========== PROJECT LIST VIEW ==========
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projekty</h1>
          <p className="text-sm text-gray-500 mt-1">{filteredProjects.length} z {projects.length} projektów</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nowy projekt
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj projektów..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { key: 'active', label: 'Aktywne' },
            { key: 'on_hold', label: 'Wstrzymane' },
            { key: 'completed', label: 'Zakończone' },
            { key: 'archived', label: 'Archiwum' },
            { key: 'all', label: 'Wszystkie' },
          ] as { key: ProjectStatus | 'all'; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === f.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nazwa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Klient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[180px]">Budżet</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Koszty bezpośrednie netto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Koszty robocizny netto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zysk netto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Termin</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(project => {
                const budgetInfo = getBudgetDisplay(project);
                const directCosts = getDirectCosts(project.id);
                const laborCosts = getLaborCosts(project.id);
                const profit = getProfit(project);
                return (
                  <tr
                    key={project.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedProject(project)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || '#3B82F6' }} />
                        <div>
                          <span className="text-sm font-medium text-gray-900">{project.name}</span>
                          <span className="ml-2 text-xs text-gray-400">
                            {project.billing_type === 'hourly' ? 'RG' : 'Ryczałt'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getCustomerName(project.contractor_client_id || project.customer_id)}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const cfg = PROJECT_STATUS_CONFIG[project.status];
                        return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {budgetInfo && typeof budgetInfo === 'object' && budgetInfo.type === 'bar' ? (
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>{budgetInfo.used.toLocaleString('pl-PL')} PLN</span>
                            <span>{budgetInfo.total.toLocaleString('pl-PL')} PLN netto</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${budgetInfo.percent > 90 ? 'bg-red-500' : budgetInfo.percent > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                              style={{ width: `${budgetInfo.percent}%` }}
                            />
                          </div>
                        </div>
                      ) : budgetInfo && typeof budgetInfo === 'object' && budgetInfo.type === 'hourly' ? (
                        <div className="text-sm">
                          <div className="text-gray-900 font-medium">{budgetInfo.earned > 0 ? `${budgetInfo.earned.toLocaleString('pl-PL')} PLN netto` : '-'}</div>
                          <div className="text-xs text-gray-400">{budgetInfo.rate} PLN/godz. netto</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {directCosts > 0 ? `${directCosts.toLocaleString('pl-PL')} PLN` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {laborCosts > 0 ? `${laborCosts.toLocaleString('pl-PL')} PLN` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {project.billing_type === 'ryczalt' && project.budget_amount
                          ? `${profit.toLocaleString('pl-PL')} PLN`
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {project.end_date ? new Date(project.end_date).toLocaleDateString('pl-PL') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Edytuj"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                          title="Usuń"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    {search ? 'Brak wyników wyszukiwania' : 'Brak projektów. Utwórz pierwszy projekt.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {renderProjectModal()}
      {renderHourlySettingsModal()}
    </div>
  );
};
