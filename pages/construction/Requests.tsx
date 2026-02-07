import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Filter, Loader2, ChevronRight, Phone, Mail,
  Calendar, User, Building2, FileText, Clock, AlertCircle,
  CheckCircle2, XCircle, Send, Eye, Pencil, Trash2, X,
  ChevronDown, MoreVertical, MapPin, FileSpreadsheet
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  KosztorysRequest, KosztorysRequestStatus, KosztorysObjectType,
  KosztorysInstallationType, KosztorysRequestSource, User as UserType
} from '../../types';

// Status configuration
const STATUS_CONFIG: Record<KosztorysRequestStatus, { label: string; color: string; bgColor: string; icon: React.FC<{ className?: string }> }> = {
  new: { label: 'Nowe', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: FileText },
  in_progress: { label: 'W pracy', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Clock },
  form_filled: { label: 'Formularz', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: FileSpreadsheet },
  estimate_generated: { label: 'Kosztorys', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: FileText },
  estimate_approved: { label: 'Zatwierdzony', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle2 },
  estimate_revision: { label: 'Do poprawy', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: AlertCircle },
  kp_sent: { label: 'KP wysłane', color: 'text-cyan-700', bgColor: 'bg-cyan-100', icon: Send },
  closed: { label: 'Zamknięte', color: 'text-slate-700', bgColor: 'bg-slate-100', icon: CheckCircle2 },
  cancelled: { label: 'Anulowane', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle }
};

const OBJECT_TYPE_LABELS: Record<KosztorysObjectType, string> = {
  industrial: 'Przemysłowe',
  residential: 'Mieszkaniowe',
  office: 'Biurowe'
};

const INSTALLATION_TYPE_LABELS: Record<KosztorysInstallationType, string> = {
  'IE': 'IE - Elektryka',
  'IT': 'IT - Teletechnika',
  'IE,IT': 'IE + IT'
};

const SOURCE_LABELS: Record<KosztorysRequestSource, string> = {
  email: 'E-mail',
  phone: 'Telefon',
  meeting: 'Spotkanie',
  tender: 'Przetarg',
  other: 'Inne'
};

interface RequestFormData {
  client_name: string;
  contact_person: string;
  phone: string;
  email: string;
  investment_name: string;
  object_type: KosztorysObjectType;
  installation_types: KosztorysInstallationType;
  address: string;
  planned_response_date: string;
  notes: string;
  request_source: KosztorysRequestSource;
  assigned_user_id: string;
}

const initialFormData: RequestFormData = {
  client_name: '',
  contact_person: '',
  phone: '',
  email: '',
  investment_name: '',
  object_type: 'residential',
  installation_types: 'IE',
  address: '',
  planned_response_date: '',
  notes: '',
  request_source: 'email',
  assigned_user_id: ''
};

export const RequestsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [requests, setRequests] = useState<KosztorysRequest[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<KosztorysRequestStatus | 'all'>('all');
  const [objectTypeFilter, setObjectTypeFilter] = useState<KosztorysObjectType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<KosztorysRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<KosztorysRequest | null>(null);
  const [formData, setFormData] = useState<RequestFormData>(initialFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<KosztorysRequest | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadRequests();
      loadUsers();
    }
  }, [currentUser]);

  const loadRequests = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('kosztorys_requests')
        .select(`
          *,
          assigned_user:users!kosztorys_requests_assigned_user_id_fkey(id, first_name, last_name, email),
          created_by:users!kosztorys_requests_created_by_id_fkey(id, first_name, last_name)
        `)
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error loading requests:', err);
      // If table doesn't exist, show empty state
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!currentUser) return;
    try {
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .eq('company_id', currentUser.company_id)
        .in('role', ['company_admin', 'hr', 'coordinator', 'employee'])
        .order('first_name');
      if (data) setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const generateRequestNumber = () => {
    const year = new Date().getFullYear();
    const num = String(requests.length + 1).padStart(5, '0');
    return `ZAP-${year}-${num}`;
  };

  const handleSaveRequest = async () => {
    if (!currentUser || !formData.client_name.trim() || !formData.investment_name.trim()) return;
    setSaving(true);
    try {
      const requestData = {
        company_id: currentUser.company_id,
        request_number: editingRequest?.request_number || generateRequestNumber(),
        status: editingRequest?.status || 'new',
        client_name: formData.client_name.trim(),
        contact_person: formData.contact_person.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        investment_name: formData.investment_name.trim(),
        object_type: formData.object_type,
        installation_types: formData.installation_types,
        address: formData.address.trim() || null,
        planned_response_date: formData.planned_response_date || null,
        notes: formData.notes.trim() || null,
        request_source: formData.request_source || null,
        assigned_user_id: formData.assigned_user_id || currentUser.id,
        created_by_id: editingRequest?.created_by_id || currentUser.id
      };

      if (editingRequest) {
        await supabase
          .from('kosztorys_requests')
          .update(requestData)
          .eq('id', editingRequest.id);
      } else {
        await supabase
          .from('kosztorys_requests')
          .insert(requestData);
      }

      await loadRequests();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving request:', err);
      alert('Błąd podczas zapisywania zapytania');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (request: KosztorysRequest, newStatus: KosztorysRequestStatus) => {
    try {
      await supabase
        .from('kosztorys_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', request.id);
      await loadRequests();
      if (selectedRequest?.id === request.id) {
        setSelectedRequest({ ...request, status: newStatus });
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      await supabase
        .from('kosztorys_requests')
        .delete()
        .eq('id', showDeleteConfirm.id);
      await loadRequests();
      setShowDeleteConfirm(null);
      if (selectedRequest?.id === showDeleteConfirm.id) {
        setSelectedRequest(null);
        setShowDetailModal(false);
      }
    } catch (err) {
      console.error('Error deleting request:', err);
    }
  };

  const handleOpenModal = (request?: KosztorysRequest) => {
    if (request) {
      setEditingRequest(request);
      setFormData({
        client_name: request.client_name,
        contact_person: request.contact_person,
        phone: request.phone,
        email: request.email || '',
        investment_name: request.investment_name,
        object_type: request.object_type,
        installation_types: request.installation_types,
        address: request.address || '',
        planned_response_date: request.planned_response_date || '',
        notes: request.notes || '',
        request_source: request.request_source || 'email',
        assigned_user_id: request.assigned_user_id
      });
    } else {
      setEditingRequest(null);
      setFormData({ ...initialFormData, assigned_user_id: currentUser?.id || '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRequest(null);
    setFormData(initialFormData);
  };

  const handleViewRequest = (request: KosztorysRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const filteredRequests = useMemo(() => {
    let filtered = requests;

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.request_number.toLowerCase().includes(s) ||
        r.client_name.toLowerCase().includes(s) ||
        r.investment_name.toLowerCase().includes(s) ||
        r.contact_person.toLowerCase().includes(s)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (objectTypeFilter !== 'all') {
      filtered = filtered.filter(r => r.object_type === objectTypeFilter);
    }

    return filtered;
  }, [requests, search, statusFilter, objectTypeFilter]);

  const stats = useMemo(() => ({
    total: requests.length,
    new: requests.filter(r => r.status === 'new').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    pending_approval: requests.filter(r => r.status === 'estimate_generated').length,
    overdue: requests.filter(r =>
      r.planned_response_date &&
      new Date(r.planned_response_date) < new Date() &&
      !['closed', 'cancelled', 'kp_sent'].includes(r.status)
    ).length
  }), [requests]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pl-PL');
  };

  const isOverdue = (request: KosztorysRequest) => {
    if (!request.planned_response_date) return false;
    if (['closed', 'cancelled', 'kp_sent'].includes(request.status)) return false;
    return new Date(request.planned_response_date) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Zapytania o kosztorys</h1>
        <p className="text-slate-600 mt-1">Zarządzanie zapytaniami klientów o wycenę prac elektromontażowych</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-sm text-slate-500">Wszystkie</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="text-2xl font-bold text-blue-700">{stats.new}</div>
          <div className="text-sm text-blue-600">Nowe</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="text-2xl font-bold text-amber-700">{stats.in_progress}</div>
          <div className="text-sm text-amber-600">W pracy</div>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
          <div className="text-2xl font-bold text-indigo-700">{stats.pending_approval}</div>
          <div className="text-sm text-indigo-600">Do zatwierdzenia</div>
        </div>
        {stats.overdue > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="text-2xl font-bold text-red-700">{stats.overdue}</div>
            <div className="text-sm text-red-600">Przeterminowane</div>
          </div>
        )}
      </div>

      {/* Search and filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj po numerze, kliencie, inwestycji..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition ${
            showFilters || statusFilter !== 'all' || objectTypeFilter !== 'all'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtry
          {(statusFilter !== 'all' || objectTypeFilter !== 'all') && (
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nowe zapytanie
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as KosztorysRequestStatus | 'all')}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Wszystkie</option>
              {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Typ obiektu</label>
            <select
              value={objectTypeFilter}
              onChange={e => setObjectTypeFilter(e.target.value as KosztorysObjectType | 'all')}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Wszystkie</option>
              {Object.entries(OBJECT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setStatusFilter('all'); setObjectTypeFilter('all'); }}
            className="self-end px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
          >
            Wyczyść filtry
          </button>
        </div>
      )}

      {/* Requests list */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">
            {requests.length === 0
              ? 'Brak zapytań. Utwórz pierwsze zapytanie o kosztorys.'
              : 'Brak zapytań pasujących do kryteriów wyszukiwania.'}
          </p>
          {requests.length === 0 && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Dodaj zapytanie
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Numer</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Klient / Inwestycja</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Typ</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Instalacje</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Termin</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Odpowiedzialny</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map(request => {
                  const statusConfig = STATUS_CONFIG[request.status];
                  const StatusIcon = statusConfig.icon;
                  const overdue = isOverdue(request);

                  return (
                    <tr
                      key={request.id}
                      className={`hover:bg-slate-50 cursor-pointer transition ${overdue ? 'bg-red-50/50' : ''}`}
                      onClick={() => handleViewRequest(request)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-slate-900">
                          {request.request_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{request.client_name}</div>
                        <div className="text-sm text-slate-500 truncate max-w-xs">{request.investment_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {OBJECT_TYPE_LABELS[request.object_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {request.installation_types}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                          {formatDate(request.planned_response_date)}
                          {overdue && <AlertCircle className="inline w-4 h-4 ml-1" />}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {request.assigned_user
                            ? `${request.assigned_user.first_name} ${request.assigned_user.last_name}`
                            : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">
                {editingRequest ? 'Edytuj zapytanie' : 'Nowe zapytanie o kosztorys'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Client info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  Dane klienta
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa klienta *</label>
                    <input
                      type="text"
                      value={formData.client_name}
                      onChange={e => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="np. ABC Development Sp. z o.o."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Osoba kontaktowa *</label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={e => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Imię i nazwisko"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefon *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="+48 xxx xxx xxx"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="email@firma.pl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Źródło zapytania</label>
                    <select
                      value={formData.request_source}
                      onChange={e => setFormData(prev => ({ ...prev, request_source: e.target.value as KosztorysRequestSource }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Investment info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-400" />
                  Dane inwestycji
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa inwestycji *</label>
                    <input
                      type="text"
                      value={formData.investment_name}
                      onChange={e => setFormData(prev => ({ ...prev, investment_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="np. Osiedle Słoneczne - Etap II"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Typ obiektu *</label>
                    <select
                      value={formData.object_type}
                      onChange={e => setFormData(prev => ({ ...prev, object_type: e.target.value as KosztorysObjectType }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(OBJECT_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Typ instalacji *</label>
                    <select
                      value={formData.installation_types}
                      onChange={e => setFormData(prev => ({ ...prev, installation_types: e.target.value as KosztorysInstallationType }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(INSTALLATION_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adres obiektu</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ul. Kwiatowa 15, 00-001 Warszawa"
                    />
                  </div>
                </div>
              </div>

              {/* Assignment */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-slate-400" />
                  Przypisanie
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Odpowiedzialny specjalista</label>
                    <select
                      value={formData.assigned_user_id}
                      onChange={e => setFormData(prev => ({ ...prev, assigned_user_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Wybierz --</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Planowana data odpowiedzi</label>
                    <input
                      type="date"
                      value={formData.planned_response_date}
                      onChange={e => setFormData(prev => ({ ...prev, planned_response_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Uwagi</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Dodatkowe informacje od klienta..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveRequest}
                disabled={saving || !formData.client_name.trim() || !formData.investment_name.trim() || !formData.contact_person.trim() || !formData.phone.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingRequest ? 'Zapisz zmiany' : 'Utwórz zapytanie'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-lg font-bold text-slate-900">
                      {selectedRequest.request_number}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedRequest.status].bgColor} ${STATUS_CONFIG[selectedRequest.status].color}`}>
                      {React.createElement(STATUS_CONFIG[selectedRequest.status].icon, { className: 'w-3.5 h-3.5' })}
                      {STATUS_CONFIG[selectedRequest.status].label}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedRequest.investment_name}</h2>
                  <p className="text-slate-600">{selectedRequest.client_name}</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-slate-400" />
                      Dane klienta
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{selectedRequest.contact_person}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <a href={`tel:${selectedRequest.phone}`} className="text-blue-600 hover:underline">
                          {selectedRequest.phone}
                        </a>
                      </div>
                      {selectedRequest.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <a href={`mailto:${selectedRequest.email}`} className="text-blue-600 hover:underline">
                            {selectedRequest.email}
                          </a>
                        </div>
                      )}
                      {selectedRequest.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span>{selectedRequest.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Parametry</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Typ obiektu:</span>
                        <span className="font-medium">{OBJECT_TYPE_LABELS[selectedRequest.object_type]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Instalacje:</span>
                        <span className="font-medium">{INSTALLATION_TYPE_LABELS[selectedRequest.installation_types]}</span>
                      </div>
                      {selectedRequest.request_source && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Źródło:</span>
                          <span className="font-medium">{SOURCE_LABELS[selectedRequest.request_source]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-slate-400" />
                      Terminy
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Data utworzenia:</span>
                        <span className="font-medium">{formatDate(selectedRequest.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Planowana odpowiedź:</span>
                        <span className={`font-medium ${isOverdue(selectedRequest) ? 'text-red-600' : ''}`}>
                          {formatDate(selectedRequest.planned_response_date)}
                          {isOverdue(selectedRequest) && ' (przeterminowane)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Przypisanie</h3>
                    <div className="text-sm">
                      {selectedRequest.assigned_user ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-700">
                              {selectedRequest.assigned_user.first_name[0]}
                              {selectedRequest.assigned_user.last_name[0]}
                            </span>
                          </div>
                          <span>{selectedRequest.assigned_user.first_name} {selectedRequest.assigned_user.last_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Nie przypisano</span>
                      )}
                    </div>
                  </div>

                  {selectedRequest.notes && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">Uwagi</h3>
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                        {selectedRequest.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status change */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-3">Zmień status</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedRequest.status === 'new' && (
                    <button
                      onClick={() => handleStatusChange(selectedRequest, 'in_progress')}
                      className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200"
                    >
                      Weź w pracę
                    </button>
                  )}
                  {selectedRequest.status === 'in_progress' && (
                    <button
                      onClick={() => window.location.hash = `#/construction/formulary/${selectedRequest.id}`}
                      className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
                    >
                      Wypełnij formularz
                    </button>
                  )}
                  {selectedRequest.status === 'form_filled' && (
                    <button
                      onClick={() => handleStatusChange(selectedRequest, 'estimate_generated')}
                      className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200"
                    >
                      Generuj kosztorys
                    </button>
                  )}
                  {selectedRequest.status === 'estimate_generated' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(selectedRequest, 'estimate_approved')}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                      >
                        Zatwierdź
                      </button>
                      <button
                        onClick={() => handleStatusChange(selectedRequest, 'estimate_revision')}
                        className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200"
                      >
                        Do poprawy
                      </button>
                    </>
                  )}
                  {selectedRequest.status === 'estimate_approved' && (
                    <button
                      onClick={() => handleStatusChange(selectedRequest, 'kp_sent')}
                      className="px-3 py-1.5 bg-cyan-100 text-cyan-700 rounded-lg text-sm font-medium hover:bg-cyan-200"
                    >
                      Wyślij KP
                    </button>
                  )}
                  {selectedRequest.status === 'kp_sent' && (
                    <button
                      onClick={() => handleStatusChange(selectedRequest, 'closed')}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
                    >
                      Zamknij
                    </button>
                  )}
                  {!['closed', 'cancelled'].includes(selectedRequest.status) && (
                    <button
                      onClick={() => handleStatusChange(selectedRequest, 'cancelled')}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                    >
                      Anuluj
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(selectedRequest)}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <Pencil className="w-4 h-4" />
                  Edytuj
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(selectedRequest)}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Usuń
                </button>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Potwierdź usunięcie</h3>
            <p className="text-slate-600 mb-4">
              Czy na pewno chcesz usunąć zapytanie <strong>{showDeleteConfirm.request_number}</strong>?
              Ta operacja jest nieodwracalna.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsPage;
