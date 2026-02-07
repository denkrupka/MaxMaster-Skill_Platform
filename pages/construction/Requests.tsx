import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Search, Filter, Loader2, ChevronRight, Phone, Mail,
  Calendar, User, Building2, FileText, Clock, AlertCircle,
  CheckCircle2, XCircle, Send, Eye, Pencil, Trash2, X,
  ChevronDown, MoreVertical, MapPin, FileSpreadsheet, Play,
  Calculator, ClipboardList, ArrowLeft, Download, UserPlus,
  Star, Briefcase, Hash
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  KosztorysRequest, KosztorysRequestStatus, KosztorysObjectType,
  KosztorysInstallationType, KosztorysRequestSource, User as UserType,
  KosztorysRequestContact, KosztorysObjectTypeRecord, KosztorysObjectCategoryRecord
} from '../../types';
import { fetchCompanyByNip, validateNip, formatNip, normalizeNip } from '../../lib/gusApi';
import { searchAddress, OSMAddress, createDebouncedSearch } from '../../lib/osmAutocomplete';

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

interface ContactFormData {
  id?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  position: string;
  is_primary: boolean;
}

interface RequestFormData {
  // Client data
  client_name: string;
  nip: string;
  company_street: string;
  company_street_number: string;
  company_city: string;
  company_postal_code: string;
  company_country: string;
  internal_notes: string;
  // Legacy contact (for backward compatibility)
  contact_person: string;
  phone: string;
  email: string;
  // Object data
  investment_name: string;
  object_code: string;
  object_type: KosztorysObjectType;
  object_type_id: string;
  object_category_id: string;
  installation_types: KosztorysInstallationType;
  // Object address
  object_street: string;
  object_street_number: string;
  object_city: string;
  object_postal_code: string;
  object_country: string;
  // Other
  planned_response_date: string;
  notes: string;
  request_source: KosztorysRequestSource;
  assigned_user_id: string;
}

const initialFormData: RequestFormData = {
  client_name: '',
  nip: '',
  company_street: '',
  company_street_number: '',
  company_city: '',
  company_postal_code: '',
  company_country: 'Polska',
  internal_notes: '',
  contact_person: '',
  phone: '',
  email: '',
  investment_name: '',
  object_code: '',
  object_type: 'residential',
  object_type_id: '',
  object_category_id: '',
  installation_types: 'IE',
  object_street: '',
  object_street_number: '',
  object_city: '',
  object_postal_code: '',
  object_country: 'Polska',
  planned_response_date: '',
  notes: '',
  request_source: 'email',
  assigned_user_id: ''
};

const initialContactData: ContactFormData = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  position: '',
  is_primary: true
};

export const RequestsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [requests, setRequests] = useState<KosztorysRequest[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<KosztorysRequestStatus | 'all' | 'not_cancelled'>('not_cancelled');
  const [objectTypeFilter, setObjectTypeFilter] = useState<KosztorysObjectType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showPrepareOfferModal, setShowPrepareOfferModal] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<KosztorysRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<KosztorysRequest | null>(null);
  const [formData, setFormData] = useState<RequestFormData>(initialFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<KosztorysRequest | null>(null);

  // Contacts management
  const [contacts, setContacts] = useState<ContactFormData[]>([{ ...initialContactData }]);

  // GUS API state
  const [gusLoading, setGusLoading] = useState(false);
  const [gusError, setGusError] = useState<string | null>(null);

  // Object types and categories
  const [objectTypes, setObjectTypes] = useState<KosztorysObjectTypeRecord[]>([]);
  const [objectCategories, setObjectCategories] = useState<KosztorysObjectCategoryRecord[]>([]);

  // Address autocomplete
  const [companyAddressSuggestions, setCompanyAddressSuggestions] = useState<OSMAddress[]>([]);
  const [objectAddressSuggestions, setObjectAddressSuggestions] = useState<OSMAddress[]>([]);
  const [showCompanyAddressSuggestions, setShowCompanyAddressSuggestions] = useState(false);
  const [showObjectAddressSuggestions, setShowObjectAddressSuggestions] = useState(false);

  // Object code editing
  const [editingObjectCode, setEditingObjectCode] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadRequests();
      loadUsers();
      loadObjectTypes();
      loadObjectCategories();
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
          created_by:users!kosztorys_requests_created_by_id_fkey(id, first_name, last_name),
          contacts:kosztorys_request_contacts(*)
        `)
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error loading requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const loadObjectTypes = async () => {
    if (!currentUser) return;
    try {
      const { data } = await supabase
        .from('kosztorys_object_types')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true)
        .order('sort_order');
      if (data) setObjectTypes(data);
    } catch (err) {
      console.error('Error loading object types:', err);
    }
  };

  const loadObjectCategories = async () => {
    if (!currentUser) return;
    try {
      const { data } = await supabase
        .from('kosztorys_object_categories')
        .select('*, object_type:kosztorys_object_types(*)')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true)
        .order('sort_order');
      if (data) setObjectCategories(data);
    } catch (err) {
      console.error('Error loading object categories:', err);
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

  // Generate object code from name: "Warszawa Centrum" -> "WC26"
  const generateObjectCode = (name: string): string => {
    if (!name) return '';
    const words = name.trim().split(/\s+/).filter(w => w.length > 0);
    const initials = words.map(w => w[0].toUpperCase()).join('').slice(0, 4);
    const year = String(new Date().getFullYear()).slice(-2);
    return `${initials}${year}`;
  };

  // Auto-generate object code when name changes
  useEffect(() => {
    if (formData.investment_name && !editingObjectCode && !editingRequest) {
      setFormData(prev => ({
        ...prev,
        object_code: generateObjectCode(prev.investment_name)
      }));
    }
  }, [formData.investment_name, editingObjectCode, editingRequest]);

  // Fetch company data from GUS by NIP
  const handleFetchGus = async () => {
    if (!formData.nip) {
      setGusError('Wprowadź NIP');
      return;
    }

    if (!validateNip(formData.nip)) {
      setGusError('Nieprawidłowy format NIP');
      return;
    }

    setGusLoading(true);
    setGusError(null);

    try {
      const result = await fetchCompanyByNip(formData.nip);

      if (result.success && result.data) {
        const data = result.data;
        setFormData(prev => ({
          ...prev,
          client_name: data.name || prev.client_name,
          company_street: data.street || prev.company_street,
          company_street_number: data.streetNumber || prev.company_street_number,
          company_city: data.city || prev.company_city,
          company_postal_code: data.postalCode || prev.company_postal_code,
          company_country: data.country || 'Polska'
        }));
      } else {
        setGusError(result.error || 'Nie udało się pobrać danych');
      }
    } catch (err: any) {
      setGusError(err.message || 'Błąd połączenia');
    } finally {
      setGusLoading(false);
    }
  };

  // Address search with debounce
  const debouncedCompanyAddressSearch = useCallback(
    createDebouncedSearch(500),
    []
  );

  const debouncedObjectAddressSearch = useCallback(
    createDebouncedSearch(500),
    []
  );

  const handleCompanyStreetChange = (value: string) => {
    setFormData(prev => ({ ...prev, company_street: value }));
    if (value.length >= 3) {
      const searchQuery = formData.company_city
        ? `${value}, ${formData.company_city}`
        : value;
      debouncedCompanyAddressSearch(
        searchQuery,
        (results) => {
          setCompanyAddressSuggestions(results);
          setShowCompanyAddressSuggestions(results.length > 0);
        }
      );
    } else {
      setShowCompanyAddressSuggestions(false);
    }
  };

  const handleObjectStreetChange = (value: string) => {
    setFormData(prev => ({ ...prev, object_street: value }));
    if (value.length >= 3) {
      const searchQuery = formData.object_city
        ? `${value}, ${formData.object_city}`
        : value;
      debouncedObjectAddressSearch(
        searchQuery,
        (results) => {
          setObjectAddressSuggestions(results);
          setShowObjectAddressSuggestions(results.length > 0);
        }
      );
    } else {
      setShowObjectAddressSuggestions(false);
    }
  };

  const selectCompanyAddress = (addr: OSMAddress) => {
    setFormData(prev => ({
      ...prev,
      company_street: addr.street,
      company_street_number: addr.streetNumber,
      company_city: addr.city,
      company_postal_code: addr.postalCode,
      company_country: addr.country || 'Polska'
    }));
    setShowCompanyAddressSuggestions(false);
  };

  const selectObjectAddress = (addr: OSMAddress) => {
    setFormData(prev => ({
      ...prev,
      object_street: addr.street,
      object_street_number: addr.streetNumber,
      object_city: addr.city,
      object_postal_code: addr.postalCode,
      object_country: addr.country || 'Polska'
    }));
    setShowObjectAddressSuggestions(false);
  };

  // Contact management
  const addContact = () => {
    setContacts(prev => [...prev, { ...initialContactData, is_primary: false }]);
  };

  const removeContact = (index: number) => {
    if (contacts.length <= 1) return;
    setContacts(prev => {
      const newContacts = prev.filter((_, i) => i !== index);
      // If removed contact was primary, make first one primary
      if (prev[index].is_primary && newContacts.length > 0) {
        newContacts[0].is_primary = true;
      }
      return newContacts;
    });
  };

  const updateContact = (index: number, field: keyof ContactFormData, value: string | boolean) => {
    setContacts(prev => {
      const newContacts = [...prev];
      if (field === 'is_primary' && value === true) {
        // Only one can be primary
        newContacts.forEach((c, i) => {
          c.is_primary = i === index;
        });
      } else {
        (newContacts[index] as any)[field] = value;
      }
      return newContacts;
    });
  };

  const handleSaveRequest = async () => {
    if (!currentUser || !formData.client_name.trim() || !formData.investment_name.trim()) return;

    // Validate at least one contact
    const validContacts = contacts.filter(c => c.first_name.trim() && c.last_name.trim());
    if (validContacts.length === 0) {
      alert('Dodaj przynajmniej jednego przedstawiciela firmy');
      return;
    }

    setSaving(true);
    try {
      // Get primary contact for legacy fields
      const primaryContact = validContacts.find(c => c.is_primary) || validContacts[0];

      const requestData = {
        company_id: currentUser.company_id,
        request_number: editingRequest?.request_number || generateRequestNumber(),
        status: editingRequest?.status || 'new',
        // Client data
        client_name: formData.client_name.trim(),
        nip: normalizeNip(formData.nip) || null,
        company_street: formData.company_street.trim() || null,
        company_street_number: formData.company_street_number.trim() || null,
        company_city: formData.company_city.trim() || null,
        company_postal_code: formData.company_postal_code.trim() || null,
        company_country: formData.company_country || 'Polska',
        internal_notes: formData.internal_notes.trim() || null,
        // Legacy contact fields
        contact_person: `${primaryContact.first_name} ${primaryContact.last_name}`.trim(),
        phone: primaryContact.phone || '',
        email: primaryContact.email || null,
        // Object data
        investment_name: formData.investment_name.trim(),
        object_code: formData.object_code.trim() || null,
        object_type: formData.object_type,
        object_type_id: formData.object_type_id || null,
        object_category_id: formData.object_category_id || null,
        installation_types: formData.installation_types,
        // Object address
        object_street: formData.object_street.trim() || null,
        object_street_number: formData.object_street_number.trim() || null,
        object_city: formData.object_city.trim() || null,
        object_postal_code: formData.object_postal_code.trim() || null,
        object_country: formData.object_country || 'Polska',
        // Build full address string for legacy field
        address: [
          formData.object_street,
          formData.object_street_number,
          formData.object_postal_code,
          formData.object_city
        ].filter(Boolean).join(', ') || null,
        // Other
        planned_response_date: formData.planned_response_date || null,
        notes: formData.notes.trim() || null,
        request_source: formData.request_source || null,
        assigned_user_id: formData.assigned_user_id || currentUser.id,
        created_by_id: editingRequest?.created_by_id || currentUser.id
      };

      let requestId: string;

      if (editingRequest) {
        await supabase
          .from('kosztorys_requests')
          .update(requestData)
          .eq('id', editingRequest.id);
        requestId = editingRequest.id;

        // Delete existing contacts and re-create
        await supabase
          .from('kosztorys_request_contacts')
          .delete()
          .eq('request_id', requestId);
      } else {
        const { data: newRequest, error } = await supabase
          .from('kosztorys_requests')
          .insert(requestData)
          .select()
          .single();

        if (error || !newRequest) throw error || new Error('Failed to create request');
        requestId = newRequest.id;
      }

      // Save contacts
      if (validContacts.length > 0) {
        const contactsData = validContacts.map(c => ({
          request_id: requestId,
          first_name: c.first_name.trim(),
          last_name: c.last_name.trim(),
          phone: c.phone?.trim() || null,
          email: c.email?.trim() || null,
          position: c.position?.trim() || null,
          is_primary: c.is_primary
        }));

        await supabase.from('kosztorys_request_contacts').insert(contactsData);
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
      setEditingObjectCode(!!request.object_code); // If has code, allow editing
      setFormData({
        client_name: request.client_name,
        nip: request.nip || '',
        company_street: request.company_street || '',
        company_street_number: request.company_street_number || '',
        company_city: request.company_city || '',
        company_postal_code: request.company_postal_code || '',
        company_country: request.company_country || 'Polska',
        internal_notes: request.internal_notes || '',
        contact_person: request.contact_person,
        phone: request.phone,
        email: request.email || '',
        investment_name: request.investment_name,
        object_code: request.object_code || '',
        object_type: request.object_type,
        object_type_id: request.object_type_id || '',
        object_category_id: request.object_category_id || '',
        installation_types: request.installation_types,
        object_street: request.object_street || '',
        object_street_number: request.object_street_number || '',
        object_city: request.object_city || '',
        object_postal_code: request.object_postal_code || '',
        object_country: request.object_country || 'Polska',
        planned_response_date: request.planned_response_date || '',
        notes: request.notes || '',
        request_source: request.request_source || 'email',
        assigned_user_id: request.assigned_user_id
      });

      // Load contacts or create from legacy fields
      if (request.contacts && request.contacts.length > 0) {
        setContacts(request.contacts.map(c => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          phone: c.phone || '',
          email: c.email || '',
          position: c.position || '',
          is_primary: c.is_primary
        })));
      } else if (request.contact_person) {
        // Create contact from legacy fields
        const nameParts = request.contact_person.split(' ');
        setContacts([{
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          phone: request.phone || '',
          email: request.email || '',
          position: '',
          is_primary: true
        }]);
      } else {
        setContacts([{ ...initialContactData }]);
      }
    } else {
      setEditingRequest(null);
      setEditingObjectCode(false);
      setFormData({ ...initialFormData, assigned_user_id: currentUser?.id || '' });
      setContacts([{ ...initialContactData }]);
    }
    setGusError(null);
    setShowCompanyAddressSuggestions(false);
    setShowObjectAddressSuggestions(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRequest(null);
    setEditingObjectCode(false);
    setFormData(initialFormData);
    setContacts([{ ...initialContactData }]);
    setGusError(null);
    setShowCompanyAddressSuggestions(false);
    setShowObjectAddressSuggestions(false);
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

    if (statusFilter === 'not_cancelled') {
      filtered = filtered.filter(r => r.status !== 'cancelled');
    } else if (statusFilter !== 'all') {
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

  // Get deadline status for highlighting: 'ok' | 'warning' (<7 days) | 'danger' (<2 days) | 'overdue'
  const getDeadlineStatus = (request: KosztorysRequest): 'ok' | 'warning' | 'danger' | 'overdue' | null => {
    if (!request.planned_response_date) return null;
    if (['closed', 'cancelled', 'kp_sent'].includes(request.status)) return null;

    const deadline = new Date(request.planned_response_date);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 0) return 'overdue';
    if (diffDays < 2) return 'danger';
    if (diffDays < 7) return 'warning';
    return 'ok';
  };

  const getDeadlineStyle = (status: 'ok' | 'warning' | 'danger' | 'overdue' | null) => {
    switch (status) {
      case 'overdue': return 'text-red-600 font-semibold bg-red-50';
      case 'danger': return 'text-pink-600 font-medium bg-pink-50';
      case 'warning': return 'text-amber-600 font-medium bg-amber-50';
      default: return 'text-slate-600';
    }
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
        <p className="text-slate-600 mt-1">Zarządzanie zapytaniami ofertowymi</p>
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
              onChange={e => setStatusFilter(e.target.value as KosztorysRequestStatus | 'all' | 'not_cancelled')}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="not_cancelled">Aktywne (bez anulowanych)</option>
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
                  const deadlineStatus = getDeadlineStatus(request);

                  // Row background based on deadline status
                  const getRowBg = () => {
                    switch (deadlineStatus) {
                      case 'overdue': return 'bg-red-50/70';
                      case 'danger': return 'bg-pink-50/50';
                      case 'warning': return 'bg-amber-50/50';
                      default: return '';
                    }
                  };

                  return (
                    <tr
                      key={request.id}
                      className={`hover:bg-slate-50 cursor-pointer transition ${getRowBg()}`}
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
                        {(() => {
                          const deadlineStatus = getDeadlineStatus(request);
                          return (
                            <span className={`text-sm px-2 py-1 rounded ${getDeadlineStyle(deadlineStatus)}`}>
                              {formatDate(request.planned_response_date)}
                              {deadlineStatus === 'overdue' && <AlertCircle className="inline w-4 h-4 ml-1" />}
                            </span>
                          );
                        })()}
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

      {/* Create/Edit Modal - z-index higher than detail modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">
                {editingRequest ? 'Edytuj zapytanie' : 'Nowe zapytanie o kosztorys'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* 1. Client info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  Dane klienta
                </h3>

                {/* NIP with GUS button */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
                    <input
                      type="text"
                      value={formData.nip}
                      onChange={e => setFormData(prev => ({ ...prev, nip: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="XXX-XXX-XX-XX"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleFetchGus}
                      disabled={gusLoading || !formData.nip}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {gusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Pobierz z GUS
                    </button>
                  </div>
                </div>
                {gusError && (
                  <p className="text-sm text-red-600">{gusError}</p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
                    <input
                      type="text"
                      value={formData.client_name}
                      onChange={e => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="np. ABC Development Sp. z o.o."
                    />
                  </div>
                </div>

                {/* Company address with OSM autocomplete */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2 relative">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ulica</label>
                    <input
                      type="text"
                      value={formData.company_street}
                      onChange={e => handleCompanyStreetChange(e.target.value)}
                      onFocus={() => companyAddressSuggestions.length > 0 && setShowCompanyAddressSuggestions(true)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ul. Przykładowa"
                    />
                    {showCompanyAddressSuggestions && companyAddressSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {companyAddressSuggestions.map((addr, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectCompanyAddress(addr)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          >
                            <div className="font-medium">{addr.street} {addr.streetNumber}</div>
                            <div className="text-slate-500 text-xs">{addr.postalCode} {addr.city}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numer</label>
                    <input
                      type="text"
                      value={formData.company_street_number}
                      onChange={e => setFormData(prev => ({ ...prev, company_street_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="12A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kod pocztowy</label>
                    <input
                      type="text"
                      value={formData.company_postal_code}
                      onChange={e => setFormData(prev => ({ ...prev, company_postal_code: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="00-000"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Miasto</label>
                    <input
                      type="text"
                      value={formData.company_city}
                      onChange={e => setFormData(prev => ({ ...prev, company_city: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Warszawa"
                    />
                  </div>
                  <div className="col-span-2">
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notatka wewnętrzna</label>
                  <textarea
                    value={formData.internal_notes}
                    onChange={e => setFormData(prev => ({ ...prev, internal_notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Notatki widoczne tylko dla zespołu..."
                  />
                </div>
              </div>

              {/* 2. Representatives */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-slate-400" />
                    Przedstawiciele firmy
                  </h3>
                  <button
                    type="button"
                    onClick={addContact}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    <UserPlus className="w-4 h-4" />
                    Dodaj
                  </button>
                </div>

                <div className="space-y-4">
                  {contacts.map((contact, index) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={contact.is_primary}
                              onChange={() => updateContact(index, 'is_primary', true)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                              {contact.is_primary && <Star className="w-4 h-4 text-amber-500" />}
                              Główny kontakt
                            </span>
                          </label>
                        </div>
                        {contacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeContact(index)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Imię *</label>
                          <input
                            type="text"
                            value={contact.first_name}
                            onChange={e => updateContact(index, 'first_name', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            placeholder="Jan"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Nazwisko *</label>
                          <input
                            type="text"
                            value={contact.last_name}
                            onChange={e => updateContact(index, 'last_name', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            placeholder="Kowalski"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
                          <input
                            type="tel"
                            value={contact.phone}
                            onChange={e => updateContact(index, 'phone', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            placeholder="+48 xxx xxx xxx"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Stanowisko</label>
                          <input
                            type="text"
                            value={contact.position}
                            onChange={e => updateContact(index, 'position', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            placeholder="Kierownik projektu"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
                          <input
                            type="email"
                            value={contact.email}
                            onChange={e => updateContact(index, 'email', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            placeholder="email@firma.pl"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Object info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  Obiekt
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa obiektu *</label>
                    <input
                      type="text"
                      value={formData.investment_name}
                      onChange={e => setFormData(prev => ({ ...prev, investment_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="np. Osiedle Słoneczne - Etap II"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kod obiektu</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.object_code}
                        onChange={e => setFormData(prev => ({ ...prev, object_code: e.target.value }))}
                        disabled={!editingObjectCode}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        placeholder="WC26"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingObjectCode(!editingObjectCode)}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        title={editingObjectCode ? 'Auto-generuj' : 'Edytuj ręcznie'}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rodzaj obiektu *</label>
                    <select
                      value={formData.object_type}
                      onChange={e => setFormData(prev => ({ ...prev, object_type: e.target.value as KosztorysObjectType }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(OBJECT_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                      {objectTypes.filter(t => !['industrial', 'residential', 'office'].includes(t.code)).map(t => (
                        <option key={t.id} value={t.code}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Typ obiektu</label>
                    <select
                      value={formData.object_category_id}
                      onChange={e => setFormData(prev => ({ ...prev, object_category_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Wybierz (opcjonalnie) --</option>
                      {objectCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Object address with OSM autocomplete */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2 relative">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ulica</label>
                    <input
                      type="text"
                      value={formData.object_street}
                      onChange={e => handleObjectStreetChange(e.target.value)}
                      onFocus={() => objectAddressSuggestions.length > 0 && setShowObjectAddressSuggestions(true)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ul. Budowlana"
                    />
                    {showObjectAddressSuggestions && objectAddressSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {objectAddressSuggestions.map((addr, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectObjectAddress(addr)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          >
                            <div className="font-medium">{addr.street} {addr.streetNumber}</div>
                            <div className="text-slate-500 text-xs">{addr.postalCode} {addr.city}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numer</label>
                    <input
                      type="text"
                      value={formData.object_street_number}
                      onChange={e => setFormData(prev => ({ ...prev, object_street_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kod pocztowy</label>
                    <input
                      type="text"
                      value={formData.object_postal_code}
                      onChange={e => setFormData(prev => ({ ...prev, object_postal_code: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="00-000"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Miasto</label>
                    <input
                      type="text"
                      value={formData.object_city}
                      onChange={e => setFormData(prev => ({ ...prev, object_city: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Warszawa"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kraj</label>
                    <input
                      type="text"
                      value={formData.object_country}
                      onChange={e => setFormData(prev => ({ ...prev, object_country: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Polska"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Assignment */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                  Odpowiedzialny
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Odpowiedzialny</label>
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

              {/* 5. Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Uwagi od klienta</label>
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
                disabled={saving || !formData.client_name.trim() || !formData.investment_name.trim() || !contacts.some(c => c.first_name.trim() && c.last_name.trim())}
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
              {/* Status change - moved to top */}
              <div className="mb-6 pb-6 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-3">Realizacja</h3>
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
                      onClick={() => setShowPrepareOfferModal(true)}
                      className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
                    >
                      Przygotuj ofertę
                    </button>
                  )}
                  {selectedRequest.status === 'form_filled' && (
                    <button
                      onClick={() => setShowPrepareOfferModal(true)}
                      className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200"
                    >
                      Przygotuj ofertę
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
                  {selectedRequest.status === 'cancelled' && (
                    <button
                      onClick={() => handleStatusChange(selectedRequest, 'new')}
                      className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 flex items-center gap-1"
                    >
                      <Play className="w-4 h-4" />
                      Aktywuj
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
                        <span className={`font-medium px-2 py-0.5 rounded ${getDeadlineStyle(getDeadlineStatus(selectedRequest))}`}>
                          {formatDate(selectedRequest.planned_response_date)}
                          {isOverdue(selectedRequest) && ' (przeterminowane)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Odpowiedzialny</h3>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
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

      {/* Prepare Offer Modal */}
      {showPrepareOfferModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Przygotuj ofertę</h2>
              <p className="text-slate-600 mt-1">Wybierz sposób przygotowania oferty dla zapytania</p>
            </div>

            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  setShowPrepareOfferModal(false);
                  window.location.hash = `#/construction/formulary/${selectedRequest.id}`;
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition text-left group"
              >
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition">
                  <ClipboardList className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Wypełnić formularz</div>
                  <div className="text-sm text-slate-500">Wypełnij formularz techniczny i wygeneruj kosztorys automatycznie</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowPrepareOfferModal(false);
                  window.location.hash = `#/construction/estimates?request=${selectedRequest.id}`;
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition text-left group"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition">
                  <Calculator className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Przejść do Kosztorysowania</div>
                  <div className="text-sm text-slate-500">Utwórz kosztorys ręcznie w module kosztorysowania</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowPrepareOfferModal(false);
                  window.location.hash = `#/construction/offers?request=${selectedRequest.id}`;
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition text-left group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Przejść do Ofertowania</div>
                  <div className="text-sm text-slate-500">Utwórz ofertę handlową bezpośrednio</div>
                </div>
              </button>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowPrepareOfferModal(false)}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                Powrót
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsPage;
