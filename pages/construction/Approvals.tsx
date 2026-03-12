import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, CheckSquare, Clock, CheckCircle, XCircle, AlertCircle,
  Loader2, User, Calendar, MessageSquare, ArrowRight, FileText,
  Send, RotateCcw, Users, X, Save, Pencil, Trash2, Eye,
  MapPin, Image, ChevronRight, AlertTriangle, BarChart3, Download,
  Filter, History, Target
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project
} from '../../types';

type UzgodnienieStatus = 'new' | 'in_review' | 'approved' | 'rejected' | 'delegated' | 'escalated' | 'cancelled';
type UzgodnienePriority = 'low' | 'normal' | 'high' | 'urgent';
type FilterTab = 'mine' | 'waiting' | 'all';

interface Uzgodnienie {
  id: string;
  company_id: string;
  project_id?: string;
  number?: string;
  title: string;
  description?: string;
  status: UzgodnienieStatus;
  priority: UzgodnienePriority;
  plan_id?: string;
  plan_page?: number;
  plan_x?: number;
  plan_y?: number;
  plan_screenshot_url?: string;
  assigned_to_id?: string;
  created_by_id: string;
  sla_hours: number;
  sla_deadline?: string;
  escalated_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  project?: Project;
  assigned_to?: any;
  created_by?: any;
  history?: UzgodnienieHistoryEntry[];
  photos?: UzgodnieniePhoto[];
}

interface UzgodnienieHistoryEntry {
  id: string;
  uzgodnienie_id: string;
  action: string;
  from_status?: UzgodnienieStatus;
  to_status?: UzgodnienieStatus;
  user_id: string;
  comment?: string;
  delegated_to_id?: string;
  created_at: string;
  user?: any;
  delegated_to?: any;
}

interface UzgodnieniePhoto {
  id: string;
  uzgodnienie_id: string;
  url: string;
  caption?: string;
  created_at: string;
}

const STATUS_LABELS: Record<UzgodnienieStatus, string> = {
  new: 'Nowe',
  in_review: 'W trakcie',
  approved: 'Zatwierdzone',
  rejected: 'Odrzucone',
  delegated: 'Delegowane',
  escalated: 'Eskalowane',
  cancelled: 'Anulowane'
};

const STATUS_COLORS: Record<UzgodnienieStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  delegated: 'bg-purple-100 text-purple-700 border-purple-200',
  escalated: 'bg-orange-100 text-orange-700 border-orange-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
};

const PRIORITY_LABELS: Record<UzgodnienePriority, string> = {
  low: 'Niski', normal: 'Normalny', high: 'Wysoki', urgent: 'Pilny'
};

const PRIORITY_COLORS: Record<UzgodnienePriority, string> = {
  low: 'text-slate-500', normal: 'text-blue-600', high: 'text-amber-600', urgent: 'text-red-600'
};

const ACTION_LABELS: Record<string, string> = {
  created: 'Utworzono',
  approved: 'Zatwierdzono',
  rejected: 'Odrzucono',
  delegated: 'Delegowano',
  escalated: 'Eskalowano',
  comment: 'Komentarz',
  reassigned: 'Przypisano'
};

export const ApprovalsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, users } = state;

  const [filterTab, setFilterTab] = useState<FilterTab>('mine');
  const [uzgodnienia, setUzgodnienia] = useState<Uzgodnienie[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Detail modal
  const [selectedUzgodnienie, setSelectedUzgodnienie] = useState<Uzgodnienie | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailHistory, setDetailHistory] = useState<UzgodnienieHistoryEntry[]>([]);

  // Create/Edit modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUzgodnienie, setEditingUzgodnienie] = useState<Uzgodnienie | null>(null);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Action modal (approve/reject/delegate)
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'delegate' | 'comment'>('approve');
  const [actionComment, setActionComment] = useState('');
  const [delegateTo, setDelegateTo] = useState('');

  // Form
  const [form, setForm] = useState({
    project_id: '',
    title: '',
    description: '',
    priority: 'normal' as UzgodnienePriority,
    assigned_to_id: '',
    sla_hours: 24,
    plan_screenshot_url: ''
  });

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [uzgRes, projectsRes] = await Promise.all([
        supabase.from('uzgodnienia')
          .select(`
            *,
            project:projects(*),
            assigned_to:users!uzgodnienia_assigned_to_id_fkey(id, first_name, last_name, email),
            created_by:users!uzgodnienia_created_by_id_fkey(id, first_name, last_name, email),
            photos:uzgodnienia_photos(*)
          `)
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('projects').select('*').eq('company_id', currentUser.company_id)
      ]);

      if (uzgRes.data) setUzgodnienia(uzgRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
    } catch (err) {
      console.error('Error loading uzgodnienia:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (uzgId: string) => {
    const { data } = await supabase
      .from('uzgodnienia_history')
      .select(`
        *,
        user:users!uzgodnienia_history_user_id_fkey(id, first_name, last_name),
        delegated_to:users!uzgodnienia_history_delegated_to_id_fkey(id, first_name, last_name)
      `)
      .eq('uzgodnienie_id', uzgId)
      .order('created_at', { ascending: true });
    if (data) setDetailHistory(data);
  };

  // Stats
  const stats = useMemo(() => {
    const mine = uzgodnienia.filter(u => u.created_by_id === currentUser?.id);
    const waitingForMe = uzgodnienia.filter(u => u.assigned_to_id === currentUser?.id && ['new', 'in_review', 'escalated'].includes(u.status));
    const overdue = uzgodnienia.filter(u => {
      if (!u.sla_deadline || ['approved', 'rejected', 'cancelled'].includes(u.status)) return false;
      return new Date(u.sla_deadline) < new Date();
    });
    const approvedThisMonth = uzgodnienia.filter(u => {
      if (u.status !== 'approved' || !u.resolved_at) return false;
      const d = new Date(u.resolved_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    // Avg response time (hours)
    const resolved = uzgodnienia.filter(u => u.resolved_at);
    const avgHours = resolved.length > 0
      ? resolved.reduce((s, u) => {
          const diff = (new Date(u.resolved_at!).getTime() - new Date(u.created_at).getTime()) / (1000 * 60 * 60);
          return s + diff;
        }, 0) / resolved.length
      : 0;

    return { mine: mine.length, waitingForMe: waitingForMe.length, overdue: overdue.length, approvedThisMonth: approvedThisMonth.length, avgHours };
  }, [uzgodnienia, currentUser]);

  const filteredUzgodnienia = useMemo(() => {
    let list = uzgodnienia;

    if (filterTab === 'mine') {
      list = list.filter(u => u.created_by_id === currentUser?.id);
    } else if (filterTab === 'waiting') {
      list = list.filter(u => u.assigned_to_id === currentUser?.id && ['new', 'in_review', 'escalated', 'delegated'].includes(u.status));
    }

    if (projectFilter !== 'all') list = list.filter(u => u.project_id === projectFilter);
    if (statusFilter !== 'all') list = list.filter(u => u.status === statusFilter);
    if (search) list = list.filter(u =>
      u.title.toLowerCase().includes(search.toLowerCase()) ||
      u.number?.toLowerCase().includes(search.toLowerCase())
    );

    return list;
  }, [uzgodnienia, filterTab, projectFilter, statusFilter, search, currentUser]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pl-PL');
  const formatDateTime = (d: string) => new Date(d).toLocaleString('pl-PL');
  const getUserName = (u: any) => u ? `${u.first_name} ${u.last_name}` : 'Nieznany';
  const isOverdue = (u: Uzgodnienie) =>
    u.sla_deadline && !['approved', 'rejected', 'cancelled'].includes(u.status) && new Date(u.sla_deadline) < new Date();

  // Create
  const handleSave = async () => {
    if (!currentUser || !form.title) return;
    setSaving(true);
    try {
      const data = {
        company_id: currentUser.company_id,
        project_id: form.project_id || null,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        assigned_to_id: form.assigned_to_id || null,
        sla_hours: form.sla_hours,
        created_by_id: currentUser.id,
        status: 'new' as UzgodnienieStatus
      };

      let uzgId: string;
      if (editingUzgodnienie) {
        await supabase.from('uzgodnienia').update(data).eq('id', editingUzgodnienie.id);
        uzgId = editingUzgodnienie.id;
      } else {
        const { data: created } = await supabase.from('uzgodnienia').insert(data).select().single();
        uzgId = created!.id;

        // Log history
        await supabase.from('uzgodnienia_history').insert({
          uzgodnienie_id: uzgId,
          action: 'created',
          to_status: 'new',
          user_id: currentUser.id
        });

        // Send email to assignee
        if (form.assigned_to_id) {
          const assignee = users?.find((u: any) => u.id === form.assigned_to_id);
          if (assignee?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                template: 'NOTIFICATION',
                to: assignee.email,
                data: {
                  subject: `Nowe uzgodnienie: ${form.title}`,
                  message: `Masz nowe uzgodnienie do rozpatrzenia: "${form.title}". Termin: ${form.sla_hours}h.`,
                  actionUrl: window.location.origin,
                  actionLabel: 'Przejdź do portalu'
                }
              }
            });
          }
        }
      }

      setShowCreateModal(false);
      setEditingUzgodnienie(null);
      resetForm();
      await loadData();
    } catch (err) {
      console.error('Error saving uzgodnienie:', err);
    } finally {
      setSaving(false);
    }
  };

  // Action: approve/reject/delegate
  const handleAction = async () => {
    if (!currentUser || !selectedUzgodnienie) return;
    setProcessing(true);
    try {
      const newStatus: UzgodnienieStatus =
        actionType === 'approve' ? 'approved' :
        actionType === 'reject' ? 'rejected' :
        actionType === 'delegate' ? 'delegated' :
        selectedUzgodnienie.status;

      const histData: any = {
        uzgodnienie_id: selectedUzgodnienie.id,
        action: actionType,
        from_status: selectedUzgodnienie.status,
        to_status: newStatus,
        user_id: currentUser.id,
        comment: actionComment || null
      };

      if (actionType === 'delegate' && delegateTo) {
        histData.delegated_to_id = delegateTo;
      }

      // Update status
      const updateData: any = { status: newStatus };
      if (actionType === 'approve' || actionType === 'reject') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by_id = currentUser.id;
      }
      if (actionType === 'delegate' && delegateTo) {
        updateData.assigned_to_id = delegateTo;
      }

      await Promise.all([
        supabase.from('uzgodnienia').update(updateData).eq('id', selectedUzgodnienie.id),
        supabase.from('uzgodnienia_history').insert(histData)
      ]);

      // Notify assignee/creator
      const notifyUser = actionType === 'delegate'
        ? users?.find((u: any) => u.id === delegateTo)
        : users?.find((u: any) => u.id === selectedUzgodnienie.created_by_id);

      if (notifyUser?.email) {
        const actionLabel = actionType === 'approve' ? 'zatwierdzone' : actionType === 'reject' ? 'odrzucone' : 'delegowane';
        await supabase.functions.invoke('send-email', {
          body: {
            template: 'NOTIFICATION',
            to: notifyUser.email,
            data: {
              subject: `Uzgodnienie ${selectedUzgodnienie.number || selectedUzgodnienie.title} — ${actionLabel}`,
              message: `Uzgodnienie "${selectedUzgodnienie.title}" zostało ${actionLabel}.${actionComment ? `\n\nKomentarz: ${actionComment}` : ''}`,
              actionUrl: window.location.origin,
              actionLabel: 'Przejdź do portalu'
            }
          }
        }).catch(() => {});
      }

      setShowActionModal(false);
      setShowDetailModal(false);
      setActionComment('');
      setDelegateTo('');
      await loadData();
    } catch (err) {
      console.error('Error processing action:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenDetail = async (uzg: Uzgodnienie) => {
    setSelectedUzgodnienie(uzg);
    setShowDetailModal(true);
    await loadHistory(uzg.id);
  };

  const handleDelete = async (uzg: Uzgodnienie) => {
    if (!confirm('Czy na pewno chcesz usunąć to uzgodnienie?')) return;
    await supabase.from('uzgodnienia').update({ deleted_at: new Date().toISOString() }).eq('id', uzg.id);
    await loadData();
  };

  // PDF Export
  const handleExportPDF = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const projectUzg = uzgodnienia.filter(u => u.project_id === projectId);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Uzgodnienia — ${project?.name}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  h1 { color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #f1f5f9; padding: 8px; text-align: left; border: 1px solid #e2e8f0; }
  td { padding: 8px; border: 1px solid #e2e8f0; font-size: 13px; }
  .approved { color: #16a34a; } .rejected { color: #dc2626; } .pending { color: #2563eb; }
</style></head>
<body>
<h1>Uzgodnienia: ${project?.name || 'Projekt'}</h1>
<p>Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
<table>
  <tr><th>Nr</th><th>Tytuł</th><th>Status</th><th>Priorytet</th><th>Przypisany</th><th>SLA</th><th>Data</th></tr>
  ${projectUzg.map(u => `
  <tr>
    <td>${u.number || '—'}</td>
    <td>${u.title}</td>
    <td class="${u.status}">${STATUS_LABELS[u.status]}</td>
    <td>${PRIORITY_LABELS[u.priority]}</td>
    <td>${getUserName(u.assigned_to)}</td>
    <td>${u.sla_deadline ? formatDateTime(u.sla_deadline) : '—'}</td>
    <td>${formatDate(u.created_at)}</td>
  </tr>`).join('')}
</table>
<p style="margin-top: 40px; color: #64748b; font-size: 12px;">MaxMaster Portal — Historia uzgodnień</p>
</body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uzgodnienia_${project?.name?.replace(/\s+/g, '_') || 'projekt'}_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => setForm({
    project_id: '', title: '', description: '', priority: 'normal',
    assigned_to_id: '', sla_hours: 24, plan_screenshot_url: ''
  });

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'mine', label: 'Moje uzgodnienia' },
    { key: 'waiting', label: 'Czekam na decyzję' },
    { key: 'all', label: 'Wszystkie' }
  ];

  const usersList = users || [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-end">
        <button onClick={() => { resetForm(); setEditingUzgodnienie(null); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-5 h-5" /> Nowe uzgodnienie
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Moje uzgodnienia', value: stats.mine, icon: FileText, color: 'text-blue-600' },
          { label: 'Czekam na decyzję', value: stats.waitingForMe, icon: Clock, color: 'text-amber-600' },
          { label: 'Przeterminowane', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600' },
          { label: 'Zatwierdzono (m-c)', value: stats.approvedThisMonth, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Śr. czas odpowiedzi', value: null, formatted: stats.avgHours > 0 ? `${stats.avgHours.toFixed(1)}h` : '—', icon: BarChart3, color: 'text-purple-600' },
        ].map(({ label, value, formatted, icon: Icon, color }) => (
          <div key={label} className="bg-white p-4 rounded-xl border border-slate-200">
            <div className={`flex items-center gap-2 ${color} mb-2`}>
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <p className={`text-xl font-bold ${color}`}>{formatted || value}</p>
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Filter tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            {filterTabs.map(tab => (
              <button key={tab.key} onClick={() => setFilterTab(tab.key)}
                className={`px-4 py-3 border-b-2 font-medium text-sm ${
                  filterTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {tab.label}
                {tab.key === 'waiting' && stats.waitingForMe > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">{stats.waitingForMe}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Szukaj..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg" />
          </div>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg">
            <option value="all">Wszystkie projekty</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg">
            <option value="all">Wszystkie statusy</option>
            {(Object.keys(STATUS_LABELS) as UzgodnienieStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {projectFilter !== 'all' && (
            <button onClick={() => handleExportPDF(projectFilter)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm">
              <Download className="w-4 h-4" /> Eksport PDF
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredUzgodnienia.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">Brak uzgodnień</p>
              <button onClick={() => { resetForm(); setShowCreateModal(true); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Utwórz pierwsze uzgodnienie
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUzgodnienia.map(uzg => {
                const overdue = isOverdue(uzg);
                return (
                  <div key={uzg.id}
                    onClick={() => handleOpenDetail(uzg)}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer group">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      uzg.priority === 'urgent' ? 'bg-red-100' :
                      uzg.priority === 'high' ? 'bg-amber-100' :
                      uzg.status === 'approved' ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      <CheckSquare className={`w-5 h-5 ${
                        uzg.priority === 'urgent' ? 'text-red-600' :
                        uzg.priority === 'high' ? 'text-amber-600' :
                        uzg.status === 'approved' ? 'text-green-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 truncate">{uzg.title}</p>
                        {uzg.number && <span className="text-xs text-slate-400">{uzg.number}</span>}
                        {overdue && <span className="flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="w-3 h-3" />Przeterminowane</span>}
                        {uzg.plan_screenshot_url && <MapPin className="w-3 h-3 text-slate-400" title="Przypisane do planu" />}
                        {(uzg.photos?.length || 0) > 0 && <Image className="w-3 h-3 text-slate-400" title="Posiada zdjęcia" />}
                      </div>
                      <p className="text-sm text-slate-500 truncate">
                        {uzg.project?.name || 'Bez projektu'}
                        {uzg.assigned_to && ` • ${getUserName(uzg.assigned_to)}`}
                        {uzg.sla_deadline && ` • SLA: ${formatDate(uzg.sla_deadline)}`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${STATUS_COLORS[uzg.status]}`}>
                      {STATUS_LABELS[uzg.status]}
                    </span>
                    <span className={`text-xs font-medium flex-shrink-0 ${PRIORITY_COLORS[uzg.priority]}`}>
                      {PRIORITY_LABELS[uzg.priority]}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      {uzg.assigned_to_id === currentUser?.id && ['new', 'in_review', 'escalated', 'delegated'].includes(uzg.status) && (
                        <>
                          <button onClick={e => {
                            e.stopPropagation();
                            setSelectedUzgodnienie(uzg);
                            setActionType('approve');
                            setShowActionModal(true);
                          }} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                            Zatwierdź
                          </button>
                          <button onClick={e => {
                            e.stopPropagation();
                            setSelectedUzgodnienie(uzg);
                            setActionType('reject');
                            setShowActionModal(true);
                          }} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                            Odrzuć
                          </button>
                        </>
                      )}
                      <button onClick={e => { e.stopPropagation(); handleDelete(uzg); }}
                        className="p-1 hover:bg-red-100 rounded">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editingUzgodnienie ? 'Edytuj uzgodnienie' : 'Nowe uzgodnienie'}</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tytuł *</label>
                <input type="text" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="np. Zmiana trasy instalacji elektrycznej"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                  <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priorytet</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as UzgodnienePriority })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    {(Object.entries(PRIORITY_LABELS) as [UzgodnienePriority, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Odpowiedzialny</label>
                  <select value={form.assigned_to_id} onChange={e => setForm({ ...form, assigned_to_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz --</option>
                    {usersList.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SLA (godziny)</label>
                  <input type="number" min="1" value={form.sla_hours}
                    onChange={e => setForm({ ...form, sla_hours: parseInt(e.target.value) || 24 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} placeholder="Szczegóły uzgodnienia..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <div className="flex items-center gap-2"><Image className="w-4 h-4" /> URL zdjęcia / screenshotu z planu</div>
                </label>
                <input type="text" value={form.plan_screenshot_url}
                  onChange={e => setForm({ ...form, plan_screenshot_url: e.target.value })}
                  placeholder="https://... (link do screenshotu z zaznaczonym miejscem na planie)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleSave} disabled={!form.title || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingUzgodnienie ? 'Zapisz' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedUzgodnienie && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{selectedUzgodnienie.title}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[selectedUzgodnienie.status]}`}>
                    {STATUS_LABELS[selectedUzgodnienie.status]}
                  </span>
                </div>
                {selectedUzgodnienie.number && <p className="text-sm text-slate-500">{selectedUzgodnienie.number}</p>}
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg text-sm">
                <div>
                  <span className="text-slate-500">Projekt:</span>
                  <span className="ml-2 font-medium">{selectedUzgodnienie.project?.name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Priorytet:</span>
                  <span className={`ml-2 font-medium ${PRIORITY_COLORS[selectedUzgodnienie.priority]}`}>
                    {PRIORITY_LABELS[selectedUzgodnienie.priority]}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Odpowiedzialny:</span>
                  <span className="ml-2 font-medium">{getUserName(selectedUzgodnienie.assigned_to)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Autor:</span>
                  <span className="ml-2 font-medium">{getUserName(selectedUzgodnienie.created_by)}</span>
                </div>
                <div>
                  <span className="text-slate-500">SLA deadline:</span>
                  <span className={`ml-2 font-medium ${isOverdue(selectedUzgodnienie) ? 'text-red-600' : 'text-slate-900'}`}>
                    {selectedUzgodnienie.sla_deadline ? formatDateTime(selectedUzgodnienie.sla_deadline) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Utworzono:</span>
                  <span className="ml-2 font-medium">{formatDateTime(selectedUzgodnienie.created_at)}</span>
                </div>
              </div>

              {selectedUzgodnienie.description && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-slate-700">{selectedUzgodnienie.description}</p>
                </div>
              )}

              {/* Plan screenshot */}
              {selectedUzgodnienie.plan_screenshot_url && (
                <div>
                  <h3 className="font-medium text-slate-800 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> Lokalizacja na planie</h3>
                  <img src={selectedUzgodnienie.plan_screenshot_url} alt="Plan"
                    className="max-w-full rounded-lg border border-slate-200" />
                </div>
              )}

              {/* Photos */}
              {selectedUzgodnienie.photos && selectedUzgodnienie.photos.length > 0 && (
                <div>
                  <h3 className="font-medium text-slate-800 mb-2 flex items-center gap-2"><Image className="w-4 h-4" /> Zdjęcia</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedUzgodnienie.photos.map(p => (
                      <img key={p.id} src={p.url} alt={p.caption || 'Zdjęcie'}
                        className="w-full h-24 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90"
                        onClick={() => window.open(p.url, '_blank')} />
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              <div>
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" /> Historia uzgodnienia
                </h3>
                {detailHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">Brak historii</p>
                ) : (
                  <div className="space-y-2">
                    {detailHistory.map(h => (
                      <div key={h.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="w-0.5 bg-slate-200 flex-1 mt-1" />
                        </div>
                        <div className="pb-3 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{getUserName(h.user)}</span>
                            <span className="text-slate-500">{ACTION_LABELS[h.action] || h.action}</span>
                            {h.to_status && (
                              <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[h.to_status]}`}>
                                {STATUS_LABELS[h.to_status]}
                              </span>
                            )}
                            {h.delegated_to && (
                              <span className="text-slate-500">→ {getUserName(h.delegated_to)}</span>
                            )}
                          </div>
                          {h.comment && <p className="text-sm text-slate-600 mt-1 bg-slate-50 px-2 py-1 rounded">{h.comment}</p>}
                          <p className="text-xs text-slate-400 mt-1">{formatDateTime(h.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {selectedUzgodnienie.assigned_to_id === currentUser?.id &&
             ['new', 'in_review', 'escalated', 'delegated'].includes(selectedUzgodnienie.status) && (
              <div className="p-4 border-t flex flex-wrap gap-2">
                <button onClick={() => { setActionType('approve'); setShowActionModal(true); }}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                  <CheckCircle className="w-4 h-4" /> Zatwierdź
                </button>
                <button onClick={() => { setActionType('reject'); setShowActionModal(true); }}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                  <XCircle className="w-4 h-4" /> Odrzuć
                </button>
                <button onClick={() => { setActionType('delegate'); setShowActionModal(true); }}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                  <ArrowRight className="w-4 h-4" /> Deleguj
                </button>
                <button onClick={() => { setActionType('comment'); setShowActionModal(true); }}
                  className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
                  <MessageSquare className="w-4 h-4" /> Komentarz
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedUzgodnienie && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {actionType === 'approve' ? '✅ Zatwierdź uzgodnienie' :
                 actionType === 'reject' ? '❌ Odrzuć uzgodnienie' :
                 actionType === 'delegate' ? '➡️ Deleguj uzgodnienie' :
                 '💬 Dodaj komentarz'}
              </h2>
              <button onClick={() => setShowActionModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-600">
                Uzgodnienie: <strong>{selectedUzgodnienie.title}</strong>
              </p>

              {actionType === 'delegate' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deleguj do *</label>
                  <select value={delegateTo} onChange={e => setDelegateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz osobę --</option>
                    {usersList.filter((u: any) => u.id !== currentUser?.id).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Komentarz {actionType !== 'comment' && '(opcjonalnie)'}
                </label>
                <textarea value={actionComment}
                  onChange={e => setActionComment(e.target.value)}
                  rows={3} placeholder="Wpisz komentarz..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowActionModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleAction}
                disabled={processing || (actionType === 'delegate' && !delegateTo) || (actionType === 'comment' && !actionComment)}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                  actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  actionType === 'delegate' ? 'bg-purple-600 hover:bg-purple-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 actionType === 'approve' ? <CheckCircle className="w-4 h-4" /> :
                 actionType === 'reject' ? <XCircle className="w-4 h-4" /> :
                 actionType === 'delegate' ? <ArrowRight className="w-4 h-4" /> :
                 <MessageSquare className="w-4 h-4" />}
                {actionType === 'approve' ? 'Zatwierdź' :
                 actionType === 'reject' ? 'Odrzuć' :
                 actionType === 'delegate' ? 'Deleguj' :
                 'Zapisz komentarz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsPage;
