import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, CheckSquare, Clock, CheckCircle, XCircle, AlertCircle,
  Loader2, Filter, User, Calendar, MessageSquare, ArrowRight, FileText,
  Send, RotateCcw, Users, Settings, ChevronRight, MoreVertical, X,
  Save, Pencil, Trash2, Eye
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  ApprovalRequest, ApprovalWorkflowTemplate, ApprovalAction,
  ApprovalRequestStatus, ApprovalEntityType, Project
} from '../../types';
import {
  APPROVAL_REQUEST_STATUS_LABELS, APPROVAL_REQUEST_STATUS_COLORS,
  APPROVAL_ENTITY_TYPE_LABELS, APPROVAL_ACTION_TYPE_LABELS
} from '../../constants';

type TabType = 'pending' | 'my-requests' | 'all' | 'templates';

export const ApprovalsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, users } = state;

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [templates, setTemplates] = useState<ApprovalWorkflowTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<ApprovalWorkflowTemplate | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Request form
  const [requestForm, setRequestForm] = useState({
    subject: '',
    description: '',
    entity_type: 'document' as ApprovalEntityType,
    project_id: '',
    template_id: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  });

  // Template form
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    entity_types: [] as ApprovalEntityType[],
    steps: [{ name: 'Krok 1', approvers: [] as string[], all_must_approve: false }]
  });

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [requestsRes, templatesRes, projectsRes] = await Promise.all([
        supabase
          .from('approval_requests')
          .select('*, project:projects(*), workflow_template:approval_workflow_templates(*), actions:approval_actions(*)')
          .eq('company_id', currentUser.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('approval_workflow_templates')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('projects')
          .select('*')
          .eq('company_id', currentUser.company_id)
      ]);

      if (requestsRes.data) setRequests(requestsRes.data);
      if (templatesRes.data) setTemplates(templatesRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
    } catch (err) {
      console.error('Error loading approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const pendingForMe = useMemo(() => {
    if (!currentUser) return [];
    return requests.filter(r => {
      if (r.status !== 'in_progress') return false;
      // Check if current user is an approver at current step
      const template = templates.find(t => t.id === r.workflow_template_id);
      if (!template || !template.steps) return false;
      const steps = template.steps as any[];
      const currentStep = steps[r.current_step - 1];
      if (!currentStep) return false;
      return currentStep.approvers?.includes(currentUser.id);
    });
  }, [requests, templates, currentUser]);

  const myRequests = useMemo(() => {
    return requests.filter(r => r.initiated_by_id === currentUser?.id);
  }, [requests, currentUser]);

  const stats = useMemo(() => ({
    pendingCount: pendingForMe.length,
    approvedCount: requests.filter(r => r.status === 'approved').length,
    rejectedCount: requests.filter(r => r.status === 'rejected').length,
    totalCount: requests.length
  }), [requests, pendingForMe]);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Nieznany';
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

  // Approval actions
  const handleApprove = async (request: ApprovalRequest, action: 'approved' | 'rejected') => {
    if (!currentUser) return;
    setProcessing(true);
    try {
      // Create action record
      await supabase.from('approval_actions').insert({
        request_id: request.id,
        step: request.current_step,
        user_id: currentUser.id,
        action,
        comment: approvalComment || null
      });

      // Update request status
      const template = templates.find(t => t.id === request.workflow_template_id);
      const totalSteps = (template?.steps as any[])?.length || 1;

      if (action === 'rejected') {
        await supabase
          .from('approval_requests')
          .update({ status: 'rejected' })
          .eq('id', request.id);
      } else if (request.current_step >= totalSteps) {
        await supabase
          .from('approval_requests')
          .update({ status: 'approved' })
          .eq('id', request.id);
      } else {
        await supabase
          .from('approval_requests')
          .update({ current_step: request.current_step + 1 })
          .eq('id', request.id);
      }

      setShowApproveModal(false);
      setApprovalComment('');
      setSelectedRequest(null);
      loadData();
    } catch (err) {
      console.error('Error processing approval:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Create request
  const handleCreateRequest = async () => {
    if (!currentUser || !requestForm.subject) return;
    setSaving(true);
    try {
      const template = templates.find(t => t.id === requestForm.template_id);

      await supabase.from('approval_requests').insert({
        company_id: currentUser.company_id,
        subject: requestForm.subject,
        description: requestForm.description,
        entity_type: requestForm.entity_type,
        project_id: requestForm.project_id || null,
        workflow_template_id: requestForm.template_id || null,
        status: template ? 'in_progress' : 'pending',
        current_step: 1,
        priority: requestForm.priority,
        initiated_by_id: currentUser.id
      });

      setShowRequestModal(false);
      resetRequestForm();
      loadData();
    } catch (err) {
      console.error('Error creating request:', err);
    } finally {
      setSaving(false);
    }
  };

  const resetRequestForm = () => {
    setRequestForm({
      subject: '',
      description: '',
      entity_type: 'document',
      project_id: '',
      template_id: '',
      priority: 'medium'
    });
  };

  // Template CRUD
  const handleSaveTemplate = async () => {
    if (!currentUser || !templateForm.name) return;
    setSaving(true);
    try {
      const data = {
        company_id: currentUser.company_id,
        name: templateForm.name,
        description: templateForm.description,
        entity_types: templateForm.entity_types,
        steps: templateForm.steps,
        is_active: true
      };

      if (editingTemplate) {
        await supabase
          .from('approval_workflow_templates')
          .update(data)
          .eq('id', editingTemplate.id);
      } else {
        await supabase.from('approval_workflow_templates').insert(data);
      }

      setShowTemplateModal(false);
      setEditingTemplate(null);
      resetTemplateForm();
      loadData();
    } catch (err) {
      console.error('Error saving template:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: ApprovalWorkflowTemplate) => {
    if (!confirm('Czy na pewno chcesz usunąć ten szablon?')) return;
    try {
      await supabase
        .from('approval_workflow_templates')
        .update({ is_active: false })
        .eq('id', template.id);
      loadData();
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      description: '',
      entity_types: [],
      steps: [{ name: 'Krok 1', approvers: [], all_must_approve: false }]
    });
  };

  const addStep = () => {
    setTemplateForm({
      ...templateForm,
      steps: [...templateForm.steps, { name: `Krok ${templateForm.steps.length + 1}`, approvers: [], all_must_approve: false }]
    });
  };

  const removeStep = (index: number) => {
    if (templateForm.steps.length <= 1) return;
    setTemplateForm({
      ...templateForm,
      steps: templateForm.steps.filter((_, i) => i !== index)
    });
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...templateForm.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setTemplateForm({ ...templateForm, steps: newSteps });
  };

  const tabs: { key: TabType; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'pending', label: 'Do zatwierdzenia', icon: Clock, count: stats.pendingCount },
    { key: 'my-requests', label: 'Moje wnioski', icon: User },
    { key: 'all', label: 'Wszystkie', icon: FileText },
    { key: 'templates', label: 'Szablony', icon: Settings }
  ];

  const getDisplayedRequests = () => {
    switch (activeTab) {
      case 'pending': return pendingForMe;
      case 'my-requests': return myRequests;
      case 'all': return requests;
      default: return [];
    }
  };

  const filteredRequests = useMemo(() => {
    const displayed = getDisplayedRequests();
    if (!search) return displayed;
    return displayed.filter(r =>
      r.subject.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeTab, requests, pendingForMe, myRequests, search]);

  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600'
  };

  const priorityLabels = {
    low: 'Niski',
    medium: 'Średni',
    high: 'Wysoki',
    urgent: 'Pilny'
  };

  const entityTypeOptions: { value: ApprovalEntityType; label: string }[] = [
    { value: 'document', label: 'Dokument' },
    { value: 'estimate', label: 'Kosztorys' },
    { value: 'offer', label: 'Oferta' },
    { value: 'purchase_request', label: 'Zapotrzebowanie' },
    { value: 'purchase_order', label: 'Zamówienie' },
    { value: 'ticket', label: 'Zgłoszenie' },
    { value: 'other', label: 'Inne' }
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-end">
        <div className="flex gap-2">
          {activeTab !== 'templates' && (
            <button
              onClick={() => { resetRequestForm(); setShowRequestModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowy wniosek
            </button>
          )}
          {activeTab === 'templates' && (
            <button
              onClick={() => { resetTemplateForm(); setEditingTemplate(null); setShowTemplateModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowy szablon
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Do zatwierdzenia</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.pendingCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Zatwierdzone</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.approvedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <XCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Odrzucone</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.rejectedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <FileText className="w-5 h-5" />
            <span className="text-sm font-medium">Wszystkie</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Search */}
        {activeTab !== 'templates' && (
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Szukaj..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : activeTab === 'templates' ? (
            templates.length === 0 ? (
              <div className="text-center py-12">
                <Settings className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Brak szablonów workflow</p>
                <button
                  onClick={() => { resetTemplateForm(); setShowTemplateModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Utwórz pierwszy szablon
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 group"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{template.name}</p>
                      <p className="text-sm text-slate-500">
                        {(template.steps as any[])?.length || 0} etapów •
                        {template.entity_types?.length || 0} typów dokumentów
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => {
                          setEditingTemplate(template);
                          setTemplateForm({
                            name: template.name,
                            description: template.description || '',
                            entity_types: template.entity_types || [],
                            steps: (template.steps as any[]) || [{ name: 'Krok 1', approvers: [], all_must_approve: false }]
                          });
                          setShowTemplateModal(true);
                        }}
                        className="p-1.5 hover:bg-slate-200 rounded"
                      >
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template)}
                        className="p-1.5 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                ))}
              </div>
            )
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {activeTab === 'pending' ? 'Brak wniosków do zatwierdzenia' : 'Brak wniosków'}
              </p>
              <button
                onClick={() => { resetRequestForm(); setShowRequestModal(true); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Utwórz wniosek
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRequests.map(request => (
                <div
                  key={request.id}
                  className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer group"
                  onClick={() => { setSelectedRequest(request); setShowDetailModal(true); }}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    request.status === 'pending' ? 'bg-slate-100' :
                    request.status === 'in_progress' ? 'bg-amber-100' :
                    request.status === 'approved' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {request.status === 'pending' ? (
                      <Clock className="w-5 h-5 text-slate-600" />
                    ) : request.status === 'in_progress' ? (
                      <Clock className="w-5 h-5 text-amber-600" />
                    ) : request.status === 'approved' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{request.subject}</p>
                    <p className="text-sm text-slate-500">
                      {APPROVAL_ENTITY_TYPE_LABELS[request.entity_type]} •
                      {getUserName(request.initiated_by_id)} •
                      {formatDate(request.created_at)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[request.priority || 'medium']}`}>
                    {priorityLabels[request.priority || 'medium']}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${APPROVAL_REQUEST_STATUS_COLORS[request.status]}`}>
                    {APPROVAL_REQUEST_STATUS_LABELS[request.status]}
                  </span>
                  {activeTab === 'pending' && request.status === 'in_progress' && (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setSelectedRequest(request); setShowApproveModal(true); }}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        Zatwierdź
                      </button>
                      <button
                        onClick={() => handleApprove(request, 'rejected')}
                        className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                      >
                        Odrzuć
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Nowy wniosek o zatwierdzenie</h2>
              <button onClick={() => setShowRequestModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Temat *</label>
                <input
                  type="text"
                  value={requestForm.subject}
                  onChange={e => setRequestForm({ ...requestForm, subject: e.target.value })}
                  placeholder="np. Zatwierdzenie kosztorysu projektu X"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea
                  value={requestForm.description}
                  onChange={e => setRequestForm({ ...requestForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="Szczegółowy opis wniosku..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Typ dokumentu</label>
                  <select
                    value={requestForm.entity_type}
                    onChange={e => setRequestForm({ ...requestForm, entity_type: e.target.value as ApprovalEntityType })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    {entityTypeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priorytet</label>
                  <select
                    value={requestForm.priority}
                    onChange={e => setRequestForm({ ...requestForm, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="low">Niski</option>
                    <option value="medium">Średni</option>
                    <option value="high">Wysoki</option>
                    <option value="urgent">Pilny</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                <select
                  value={requestForm.project_id}
                  onChange={e => setRequestForm({ ...requestForm, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Wybierz projekt --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Szablon workflow</label>
                <select
                  value={requestForm.template_id}
                  onChange={e => setRequestForm({ ...requestForm, template_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Bez szablonu (ręczne zatwierdzanie) --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleCreateRequest}
                disabled={!requestForm.subject || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Wyślij wniosek
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? 'Edytuj szablon' : 'Nowy szablon workflow'}
              </h2>
              <button onClick={() => setShowTemplateModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa szablonu *</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="np. Zatwierdzanie kosztorysów"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea
                  value={templateForm.description}
                  onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Typy dokumentów</label>
                <div className="flex flex-wrap gap-2">
                  {entityTypeOptions.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={templateForm.entity_types.includes(opt.value)}
                        onChange={e => {
                          const newTypes = e.target.checked
                            ? [...templateForm.entity_types, opt.value]
                            : templateForm.entity_types.filter(t => t !== opt.value);
                          setTemplateForm({ ...templateForm, entity_types: newTypes });
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-slate-700">Etapy zatwierdzania</label>
                  <button
                    onClick={addStep}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Dodaj etap
                  </button>
                </div>
                <div className="space-y-3">
                  {templateForm.steps.map((step, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-slate-500">Etap {index + 1}</span>
                        {templateForm.steps.length > 1 && (
                          <button
                            onClick={() => removeStep(index)}
                            className="ml-auto p-1 hover:bg-red-100 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={step.name}
                        onChange={e => updateStep(index, 'name', e.target.value)}
                        placeholder="Nazwa etapu"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-2"
                      />
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Osoby zatwierdzające</label>
                        <select
                          multiple
                          value={step.approvers}
                          onChange={e => {
                            const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                            updateStep(index, 'approvers', selected);
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                          size={3}
                        >
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.all_must_approve}
                          onChange={e => updateStep(index, 'all_must_approve', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-slate-700">Wszyscy muszą zatwierdzić</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateForm.name || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingTemplate ? 'Zapisz' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Zatwierdź wniosek</h2>
              <p className="text-slate-600 mb-4">{selectedRequest.subject}</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Komentarz (opcjonalnie)
                </label>
                <textarea
                  value={approvalComment}
                  onChange={e => setApprovalComment(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg resize-none"
                  rows={3}
                  placeholder="Dodaj komentarz..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowApproveModal(false); setApprovalComment(''); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                  disabled={processing}
                >
                  Anuluj
                </button>
                <button
                  onClick={() => handleApprove(selectedRequest, 'approved')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  disabled={processing}
                >
                  {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Zatwierdź
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Szczegóły wniosku</h2>
              <button onClick={() => { setShowDetailModal(false); setSelectedRequest(null); }} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-2">{selectedRequest.subject}</h3>

              <div className="flex gap-2 mb-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${APPROVAL_REQUEST_STATUS_COLORS[selectedRequest.status]}`}>
                  {APPROVAL_REQUEST_STATUS_LABELS[selectedRequest.status]}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[selectedRequest.priority || 'medium']}`}>
                  {priorityLabels[selectedRequest.priority || 'medium']}
                </span>
              </div>

              {selectedRequest.description && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-1">Opis</h4>
                  <p className="text-slate-600">{selectedRequest.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-1">Typ dokumentu</h4>
                  <p className="text-slate-600">{APPROVAL_ENTITY_TYPE_LABELS[selectedRequest.entity_type]}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-1">Projekt</h4>
                  <p className="text-slate-600">{(selectedRequest as any).project?.name || 'Nie przypisano'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-1">Wnioskodawca</h4>
                  <p className="text-slate-600">{getUserName(selectedRequest.initiated_by_id)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-1">Data utworzenia</h4>
                  <p className="text-slate-600">{formatDate(selectedRequest.created_at)}</p>
                </div>
              </div>

              {(selectedRequest as any).actions && (selectedRequest as any).actions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Historia zatwierdzeń</h4>
                  <div className="space-y-2">
                    {(selectedRequest as any).actions.map((action: any) => (
                      <div key={action.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                        {action.action === 'approved' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm text-slate-700">
                            {getUserName(action.user_id)} - {action.action === 'approved' ? 'Zatwierdzono' : 'Odrzucono'}
                          </p>
                          {action.comment && (
                            <p className="text-xs text-slate-500">{action.comment}</p>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{formatDate(action.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowDetailModal(false); setSelectedRequest(null); }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Zamknij
              </button>
              {selectedRequest.status === 'in_progress' && pendingForMe.some(r => r.id === selectedRequest.id) && (
                <>
                  <button
                    onClick={() => { setShowDetailModal(false); setShowApproveModal(true); }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Zatwierdź
                  </button>
                  <button
                    onClick={() => { setShowDetailModal(false); handleApprove(selectedRequest, 'rejected'); }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Odrzuć
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsPage;
