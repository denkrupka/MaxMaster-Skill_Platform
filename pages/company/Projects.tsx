
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, X, Search, FolderKanban, Users, Clock, FileText, Pencil, Trash2,
  Calendar, DollarSign, LayoutGrid, List, ChevronRight, Loader2, Eye,
  Play, CheckCircle2, ClipboardList, ArrowRight, Timer, UserPlus, UserMinus,
  Download, Tag, AlertCircle, BarChart3, Briefcase
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project, ProjectTask, ProjectMember, ProjectCustomer, TaskTimeLog,
  TaskAttachment, TaskStatus_Project, TaskPriority, ProjectStatus, User
} from '../../types';

const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'Aktywny', bg: 'bg-green-100', text: 'text-green-700' },
  completed: { label: 'Zakończony', bg: 'bg-blue-100', text: 'text-blue-700' },
  archived: { label: 'Zarchiwizowany', bg: 'bg-gray-100', text: 'text-gray-600' },
  on_hold: { label: 'Wstrzymany', bg: 'bg-amber-100', text: 'text-amber-700' },
};

const TASK_STATUS_LABELS: Record<TaskStatus_Project, string> = {
  todo: 'Do zrobienia',
  in_progress: 'W trakcie',
  review: 'Do przeglądu',
  done: 'Gotowe',
  cancelled: 'Anulowane',
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; bg: string; text: string }> = {
  low: { label: 'Niski', bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { label: 'Średni', bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { label: 'Wysoki', bg: 'bg-orange-100', text: 'text-orange-700' },
  urgent: { label: 'Pilny', bg: 'bg-red-100', text: 'text-red-700' },
};

const STATUS_COLUMNS: { key: TaskStatus_Project; label: string; color: string }[] = [
  { key: 'todo', label: 'Do zrobienia', color: 'bg-slate-100 border-slate-300' },
  { key: 'in_progress', label: 'W trakcie', color: 'bg-blue-50 border-blue-300' },
  { key: 'review', label: 'Do przeglądu', color: 'bg-amber-50 border-amber-300' },
  { key: 'done', label: 'Gotowe', color: 'bg-green-50 border-green-300' },
];

const COLOR_OPTIONS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

const emptyProjectForm = {
  name: '', description: '', customer_id: '', status: 'active' as ProjectStatus,
  color: '#3B82F6', budget_hours: '', budget_amount: '', start_date: '', end_date: '',
};

const emptyTaskForm = {
  title: '', description: '', assigned_to: '', priority: 'medium' as TaskPriority,
  due_date: '', estimated_hours: '', tags: '',
};

export const CompanyProjectsPage: React.FC = () => {
  const { state, setState } = useAppContext();
  const { currentUser, users } = state;

  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create / Edit project modal
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [savingProject, setSavingProject] = useState(false);

  // Project detail view
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'tasks' | 'time' | 'files'>('info');

  // Project detail data
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [projectTimeLogs, setProjectTimeLogs] = useState<TaskTimeLog[]>([]);
  const [projectAttachments, setProjectAttachments] = useState<TaskAttachment[]>([]);
  const [taskViewMode, setTaskViewMode] = useState<'kanban' | 'list'>('list');

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'manager' | 'member'>('member');

  // Create task in project
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [savingTask, setSavingTask] = useState(false);

  const companyUsers = useMemo(() =>
    users.filter(u => u.company_id === currentUser?.company_id && u.status === 'active'),
    [users, currentUser]
  );

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [projRes, custRes] = await Promise.all([
        supabase.from('projects').select('*').eq('company_id', currentUser.company_id).order('created_at', { ascending: false }),
        supabase.from('project_customers').select('*').eq('company_id', currentUser.company_id).eq('is_archived', false),
      ]);
      if (projRes.data) setProjects(projRes.data);
      if (custRes.data) setCustomers(custRes.data);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetails = async (project: Project) => {
    const [membersRes, tasksRes, timeRes, attachRes] = await Promise.all([
      supabase.from('project_members').select('*').eq('project_id', project.id),
      supabase.from('project_tasks').select('*').eq('project_id', project.id).eq('is_archived', false).order('created_at', { ascending: false }),
      supabase.from('task_time_logs').select('*, project_tasks!inner(project_id)').eq('project_tasks.project_id', project.id),
      supabase.from('task_attachments').select('*, project_tasks!inner(project_id)').eq('project_tasks.project_id', project.id),
    ]);
    if (membersRes.data) setProjectMembers(membersRes.data);
    if (tasksRes.data) setProjectTasks(tasksRes.data);
    if (timeRes.data) setProjectTimeLogs(timeRes.data);
    if (attachRes.data) setProjectAttachments(attachRes.data);
  };

  const openProjectDetail = (project: Project) => {
    setSelectedProject(project);
    setActiveTab('info');
    loadProjectDetails(project);
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setProjectForm(emptyProjectForm);
    setShowProjectModal(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      description: project.description || '',
      customer_id: project.customer_id || '',
      status: project.status,
      color: project.color || '#3B82F6',
      budget_hours: project.budget_hours?.toString() || '',
      budget_amount: project.budget_amount?.toString() || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
    });
    setShowProjectModal(true);
  };

  const saveProject = async () => {
    if (!currentUser || !projectForm.name.trim()) return;
    setSavingProject(true);
    try {
      const payload: any = {
        company_id: currentUser.company_id,
        name: projectForm.name.trim(),
        description: projectForm.description.trim() || null,
        customer_id: projectForm.customer_id || null,
        status: projectForm.status,
        color: projectForm.color,
        budget_hours: projectForm.budget_hours ? parseFloat(projectForm.budget_hours) : null,
        budget_amount: projectForm.budget_amount ? parseFloat(projectForm.budget_amount) : null,
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null,
        updated_at: new Date().toISOString(),
      };

      if (editingProject) {
        const { data, error } = await supabase.from('projects').update(payload).eq('id', editingProject.id).select().single();
        if (!error && data) {
          setProjects(prev => prev.map(p => p.id === data.id ? data : p));
          if (selectedProject?.id === data.id) setSelectedProject(data);
          setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Projekt został zaktualizowany' } }));
        }
      } else {
        const { data, error } = await supabase.from('projects').insert(payload).select().single();
        if (!error && data) {
          setProjects(prev => [data, ...prev]);
          setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Projekt został utworzony' } }));
        }
      }
      setShowProjectModal(false);
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setSavingProject(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten projekt? Wszystkie powiązane zadania zostaną również usunięte.')) return;
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (!error) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) setSelectedProject(null);
      setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Projekt został usunięty' } }));
    }
  };

  const addMember = async () => {
    if (!selectedProject || !newMemberUserId) return;
    const exists = projectMembers.find(m => m.user_id === newMemberUserId);
    if (exists) return;
    const { data, error } = await supabase.from('project_members').insert({
      project_id: selectedProject.id,
      user_id: newMemberUserId,
      role: newMemberRole,
    }).select().single();
    if (!error && data) {
      setProjectMembers(prev => [...prev, data]);
      setNewMemberUserId('');
      setShowAddMember(false);
    }
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('project_members').delete().eq('id', memberId);
    if (!error) setProjectMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const createTask = async () => {
    if (!currentUser || !selectedProject || !taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const { data, error } = await supabase.from('project_tasks').insert({
        company_id: currentUser.company_id,
        project_id: selectedProject.id,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        assigned_to: taskForm.assigned_to || null,
        priority: taskForm.priority,
        status: 'todo' as TaskStatus_Project,
        due_date: taskForm.due_date || null,
        estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : null,
        tags: taskForm.tags ? taskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        is_archived: false,
        created_by: currentUser.id,
      }).select().single();
      if (!error && data) {
        setProjectTasks(prev => [data, ...prev]);
        setTaskForm(emptyTaskForm);
        setShowTaskModal(false);
        setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Zadanie zostało utworzone' } }));
      }
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setSavingTask(false);
    }
  };

  const changeTaskStatus = async (taskId: string, newStatus: TaskStatus_Project) => {
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'done') updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;
    const { error } = await supabase.from('project_tasks').update(updates).eq('id', taskId);
    if (!error) setProjectTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };

  const getUserName = (userId?: string) => {
    if (!userId) return 'Nieprzypisany';
    const u = users.find(u => u.id === userId);
    return u ? `${u.first_name} ${u.last_name}` : 'Nieznany';
  };

  const getCustomerName = (customerId?: string) => {
    if (!customerId) return '-';
    return customers.find(c => c.id === customerId)?.name || '-';
  };

  const filteredProjects = useMemo(() => {
    if (!search) return projects;
    const s = search.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(s) ||
      getCustomerName(p.customer_id).toLowerCase().includes(s)
    );
  }, [projects, search, customers]);

  const getTaskProgress = (project: Project) => {
    // approximate from loaded data; real calculation in detail view
    return null;
  };

  if (!currentUser) return null;

  // ========== PROJECT LIST VIEW ==========
  if (!selectedProject) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projekty</h1>
            <p className="text-sm text-gray-500 mt-1">{projects.length} projektów w firmie</p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nowy projekt
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj projektów..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nazwa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Klient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Budżet</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Termin</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(project => (
                  <tr
                    key={project.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => openProjectDetail(project)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || '#3B82F6' }} />
                        <span className="text-sm font-medium text-gray-900">{project.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getCustomerName(project.customer_id)}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const cfg = PROJECT_STATUS_CONFIG[project.status];
                        return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {project.budget_amount ? `${project.budget_amount.toLocaleString('pl-PL')} PLN` : project.budget_hours ? `${project.budget_hours}h` : '-'}
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
                ))}
                {filteredProjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      {search ? 'Brak wyników wyszukiwania' : 'Brak projektów. Utwórz pierwszy projekt.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Create / Edit Project Modal */}
        {showProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowProjectModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingProject ? 'Edytuj projekt' : 'Nowy projekt'}
                </h2>
                <button onClick={() => setShowProjectModal(false)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Nazwa projektu *</label>
                  <input
                    type="text"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Nazwa projektu"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Opis</label>
                  <textarea
                    value={projectForm.description}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Opis projektu..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Klient</label>
                  <select
                    value={projectForm.customer_id}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, customer_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Brak klienta --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
                    <select
                      value={projectForm.status}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(PROJECT_STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Kolor</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {COLOR_OPTIONS.map(color => (
                        <button
                          key={color}
                          onClick={() => setProjectForm(prev => ({ ...prev, color }))}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${projectForm.color === color ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Budżet godzin</label>
                    <input
                      type="number"
                      value={projectForm.budget_hours}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, budget_hours: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="np. 100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Budżet (PLN)</label>
                    <input
                      type="number"
                      value={projectForm.budget_amount}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, budget_amount: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="np. 50000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Data rozpoczęcia</label>
                    <input
                      type="date"
                      value={projectForm.start_date}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Data zakończenia</label>
                    <input
                      type="date"
                      value={projectForm.end_date}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Anuluj
                </button>
                <button
                  onClick={saveProject}
                  disabled={savingProject || !projectForm.name.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingProject && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingProject ? 'Zapisz zmiany' : 'Utwórz projekt'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== PROJECT DETAIL VIEW ==========
  const totalLoggedMinutes = projectTimeLogs.reduce((s, l) => s + l.minutes, 0);
  const totalLoggedHours = Math.round(totalLoggedMinutes / 60 * 10) / 10;
  const doneCount = projectTasks.filter(t => t.status === 'done').length;
  const progressPercent = projectTasks.length > 0 ? Math.round((doneCount / projectTasks.length) * 100) : 0;

  // Group time logs by user
  const timeByUser = useMemo(() => {
    const map: Record<string, number> = {};
    projectTimeLogs.forEach(log => {
      map[log.user_id] = (map[log.user_id] || 0) + log.minutes;
    });
    return Object.entries(map).map(([userId, minutes]) => ({ userId, minutes })).sort((a, b) => b.minutes - a.minutes);
  }, [projectTimeLogs]);

  // Group time logs by task
  const timeByTask = useMemo(() => {
    const map: Record<string, number> = {};
    projectTimeLogs.forEach(log => {
      map[log.task_id] = (map[log.task_id] || 0) + log.minutes;
    });
    return Object.entries(map).map(([taskId, minutes]) => ({
      taskId,
      minutes,
      taskName: projectTasks.find(t => t.id === taskId)?.title || 'Nieznane zadanie'
    })).sort((a, b) => b.minutes - a.minutes);
  }, [projectTimeLogs, projectTasks]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setSelectedProject(null)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedProject.color || '#3B82F6' }} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedProject.name}</h1>
            <p className="text-sm text-gray-500">
              {getCustomerName(selectedProject.customer_id)}
              {selectedProject.customer_id ? ' | ' : ''}
              {PROJECT_STATUS_CONFIG[selectedProject.status].label}
            </p>
          </div>
        </div>
        <button
          onClick={() => openEditModal(selectedProject)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Pencil className="w-4 h-4" /> Edytuj
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Postęp projektu</span>
          <span className="text-sm font-medium text-gray-900">{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
          <span>{projectTasks.length} zadań łącznie</span>
          <span>{doneCount} zakończonych</span>
          <span>{totalLoggedHours}h zalogowanych</span>
          {selectedProject.budget_hours && (
            <span>Budżet: {selectedProject.budget_hours}h</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: 'info', label: 'O projekcie', icon: <Briefcase className="w-4 h-4" /> },
          { key: 'tasks', label: 'Zadania', icon: <ClipboardList className="w-4 h-4" /> },
          { key: 'time', label: 'Czas', icon: <Clock className="w-4 h-4" /> },
          { key: 'files', label: 'Pliki', icon: <FileText className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {selectedProject.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Opis</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedProject.description}</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Szczegóły</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-gray-500">Klient</span>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{getCustomerName(selectedProject.customer_id) || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Budżet godzin</span>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{selectedProject.budget_hours ? `${selectedProject.budget_hours}h` : '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Budżet kwotowy</span>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{selectedProject.budget_amount ? `${selectedProject.budget_amount.toLocaleString('pl-PL')} PLN` : '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Okres</span>
                <p className="text-sm font-medium text-gray-800 mt-0.5">
                  {selectedProject.start_date ? new Date(selectedProject.start_date).toLocaleDateString('pl-PL') : '?'}
                  {' - '}
                  {selectedProject.end_date ? new Date(selectedProject.end_date).toLocaleDateString('pl-PL') : '?'}
                </p>
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Członkowie projektu ({projectMembers.length})</h3>
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                <UserPlus className="w-3.5 h-3.5" /> Dodaj
              </button>
            </div>

            {showAddMember && (
              <div className="flex items-end gap-2 mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 block mb-1">Pracownik</label>
                  <select
                    value={newMemberUserId}
                    onChange={(e) => setNewMemberUserId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">-- Wybierz --</option>
                    {companyUsers.filter(u => !projectMembers.find(m => m.user_id === u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Rola</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as 'manager' | 'member')}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="member">Członek</option>
                    <option value="manager">Kierownik</option>
                  </select>
                </div>
                <button
                  onClick={addMember}
                  disabled={!newMemberUserId}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Dodaj
                </button>
              </div>
            )}

            <div className="space-y-2">
              {projectMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                      {getUserName(member.user_id).split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-800">{getUserName(member.user_id)}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${member.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {member.role === 'manager' ? 'Kierownik' : 'Członek'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => removeMember(member.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {projectMembers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Brak członków projektu</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Tasks */}
      {activeTab === 'tasks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setTaskViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-sm ${taskViewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTaskViewMode('kanban')}
                  className={`px-3 py-1.5 rounded-md text-sm ${taskViewMode === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button
              onClick={() => { setTaskForm(emptyTaskForm); setShowTaskModal(true); }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Nowe zadanie
            </button>
          </div>

          {taskViewMode === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {STATUS_COLUMNS.map(col => {
                const columnTasks = projectTasks.filter(t => t.status === col.key);
                return (
                  <div key={col.key} className={`rounded-xl border-2 ${col.color} p-3 min-h-[200px]`}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-semibold text-sm text-gray-700">{col.label}</h3>
                      <span className="text-xs bg-white rounded-full px-2 py-0.5 text-gray-500 font-medium">{columnTasks.length}</span>
                    </div>
                    <div className="space-y-2">
                      {columnTasks.map(task => (
                        <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-3 group relative">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">{task.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded ${PRIORITY_CONFIG[task.priority].bg} ${PRIORITY_CONFIG[task.priority].text}`}>
                              {PRIORITY_CONFIG[task.priority].label}
                            </span>
                            {task.assigned_to && <span>{getUserName(task.assigned_to)}</span>}
                            {task.due_date && <span>{new Date(task.due_date).toLocaleDateString('pl-PL')}</span>}
                          </div>
                          <select
                            value={task.status}
                            onChange={(e) => changeTaskStatus(task.id, e.target.value as TaskStatus_Project)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
                          >
                            {STATUS_COLUMNS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zadanie</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Przypisany</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Priorytet</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Termin</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Godziny</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTasks.map(task => (
                    <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{task.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getUserName(task.assigned_to)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={task.status}
                          onChange={(e) => changeTaskStatus(task.id, e.target.value as TaskStatus_Project)}
                          className="text-sm border border-gray-200 rounded px-2 py-1"
                        >
                          {STATUS_COLUMNS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_CONFIG[task.priority].bg} ${PRIORITY_CONFIG[task.priority].text}`}>
                          {PRIORITY_CONFIG[task.priority].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('pl-PL') : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {task.estimated_hours ? `${task.estimated_hours}h` : '-'}
                      </td>
                    </tr>
                  ))}
                  {projectTasks.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">Brak zadań w projekcie</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Create Task Modal */}
          {showTaskModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={() => setShowTaskModal(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Nowe zadanie</h2>
                  <button onClick={() => setShowTaskModal(false)} className="p-1 rounded hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Tytuł *</label>
                    <input
                      type="text"
                      value={taskForm.title}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Opis</label>
                    <textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Przypisz do</label>
                      <select
                        value={taskForm.assigned_to}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Nieprzypisany --</option>
                        {companyUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Priorytet</label>
                      <select
                        value={taskForm.priority}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Termin</label>
                      <input
                        type="date"
                        value={taskForm.due_date}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Szacowane godziny</label>
                      <input
                        type="number"
                        value={taskForm.estimated_hours}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, estimated_hours: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Tagi (oddzielone przecinkami)</label>
                    <input
                      type="text"
                      value={taskForm.tags}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, tags: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="np. frontend, pilne, design"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                    Anuluj
                  </button>
                  <button
                    onClick={createTask}
                    disabled={savingTask || !taskForm.title.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingTask && <Loader2 className="w-4 h-4 animate-spin" />}
                    Utwórz zadanie
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Time */}
      {activeTab === 'time' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500 uppercase font-medium">Zalogowany czas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalLoggedHours}h</p>
            </div>
            {selectedProject.budget_hours && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-gray-500 uppercase font-medium">Budżet godzin</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{selectedProject.budget_hours}h</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-gray-500 uppercase font-medium">Wykorzystanie</span>
                  </div>
                  <p className={`text-2xl font-bold ${totalLoggedHours > selectedProject.budget_hours ? 'text-red-600' : 'text-gray-900'}`}>
                    {Math.round((totalLoggedHours / selectedProject.budget_hours) * 100)}%
                  </p>
                </div>
              </>
            )}
          </div>

          {/* By Employee */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Czas wg pracownika</h3>
            <div className="space-y-3">
              {timeByUser.map(item => (
                <div key={item.userId} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{getUserName(item.userId)}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${totalLoggedMinutes > 0 ? Math.round((item.minutes / totalLoggedMinutes) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-16 text-right">{Math.round(item.minutes / 60 * 10) / 10}h</span>
                  </div>
                </div>
              ))}
              {timeByUser.length === 0 && <p className="text-sm text-gray-400 text-center">Brak wpisów czasu</p>}
            </div>
          </div>

          {/* By Task */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Czas wg zadania</h3>
            <div className="space-y-3">
              {timeByTask.map(item => (
                <div key={item.taskId} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate flex-1 mr-4">{item.taskName}</span>
                  <span className="text-sm font-medium text-gray-900">{Math.round(item.minutes / 60 * 10) / 10}h</span>
                </div>
              ))}
              {timeByTask.length === 0 && <p className="text-sm text-gray-400 text-center">Brak wpisów czasu</p>}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Files */}
      {activeTab === 'files' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Załączniki zadań ({projectAttachments.length})</h3>
          {projectAttachments.length > 0 ? (
            <div className="space-y-2">
              {projectAttachments.map(att => (
                <div key={att.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{att.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ''}
                        {att.uploaded_by ? ` | ${getUserName(att.uploaded_by)}` : ''}
                        {' | '}{new Date(att.created_at).toLocaleDateString('pl-PL')}
                      </p>
                    </div>
                  </div>
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Brak załączników</p>
          )}
        </div>
      )}

      {/* Project Create/Edit Modal (shared) */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowProjectModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingProject ? 'Edytuj projekt' : 'Nowy projekt'}
              </h2>
              <button onClick={() => setShowProjectModal(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nazwa projektu *</label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Opis</label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Klient</label>
                <select
                  value={projectForm.customer_id}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, customer_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Brak klienta --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
                  <select
                    value={projectForm.status}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(PROJECT_STATUS_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Kolor</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {COLOR_OPTIONS.map(color => (
                      <button
                        key={color}
                        onClick={() => setProjectForm(prev => ({ ...prev, color }))}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${projectForm.color === color ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Budżet godzin</label>
                  <input type="number" value={projectForm.budget_hours} onChange={(e) => setProjectForm(prev => ({ ...prev, budget_hours: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Budżet (PLN)</label>
                  <input type="number" value={projectForm.budget_amount} onChange={(e) => setProjectForm(prev => ({ ...prev, budget_amount: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Data rozpoczęcia</label>
                  <input type="date" value={projectForm.start_date} onChange={(e) => setProjectForm(prev => ({ ...prev, start_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Data zakończenia</label>
                  <input type="date" value={projectForm.end_date} onChange={(e) => setProjectForm(prev => ({ ...prev, end_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Anuluj</button>
              <button
                onClick={saveProject}
                disabled={savingProject || !projectForm.name.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingProject && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingProject ? 'Zapisz zmiany' : 'Utwórz projekt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
