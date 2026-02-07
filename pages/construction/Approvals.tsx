import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, CheckSquare, Clock, CheckCircle, XCircle, AlertCircle,
  Loader2, Filter, User, Calendar, MessageSquare, ArrowRight, FileText,
  Send, RotateCcw, Users, Settings, ChevronRight, MoreVertical
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

  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [processing, setProcessing] = useState(false);

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
    // TODO: Check approval_pending table
    return requests.filter(r => r.status === 'in_progress');
  }, [requests, currentUser]);

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

  const handleApprove = async (request: ApprovalRequest, action: 'approved' | 'rejected') => {
    if (!currentUser) return;
    setProcessing(true);
    try {
      await supabase.from('approval_actions').insert({
        request_id: request.id,
        step: request.current_step,
        user_id: currentUser.id,
        action,
        comment: approvalComment || null
      });

      setShowApproveModal(false);
      setApprovalComment('');
      loadData();
    } catch (err) {
      console.error('Error processing approval:', err);
    } finally {
      setProcessing(false);
    }
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

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Uzgodnienia</h1>
          <p className="text-slate-600 mt-1">Zarządzanie procesem zatwierdzania</p>
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
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Utwórz szablon
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{template.name}</p>
                      <p className="text-sm text-slate-500">
                        {(template.steps as any[])?.length || 0} etapów
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                ))}
              </div>
            )
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {activeTab === 'pending' ? 'Brak wniosków do zatwierdzenia' : 'Brak wniosków'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRequests.map(request => (
                <div
                  key={request.id}
                  className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                  onClick={() => setSelectedRequest(request)}
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
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${APPROVAL_REQUEST_STATUS_COLORS[request.status]}`}>
                    {APPROVAL_REQUEST_STATUS_LABELS[request.status]}
                  </span>
                  {activeTab === 'pending' && request.status === 'in_progress' && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedRequest(request); setShowApproveModal(true); }}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        Zatwierdź
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(request, 'rejected'); }}
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
    </div>
  );
};

export default ApprovalsPage;
