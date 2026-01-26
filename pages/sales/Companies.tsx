
import React, { useState, useMemo } from 'react';
import { Plus, Search, Building2, MapPin, Users, Edit, Trash2, X, Phone, Mail, User, Briefcase, Check, Loader2, ChevronRight, CheckSquare, History, Star, ExternalLink, Link2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CRMCompany, CRMContact, CRMDeal } from '../../types';
import { INDUSTRY_OPTIONS, CRM_STATUS_OPTIONS, CRM_STATUS_LABELS, CRM_STATUS_COLORS } from '../../constants';
import { supabase, SUPABASE_ANON_KEY } from '../../lib/supabase';

export const SalesCompanies: React.FC = () => {
  const { state, setState } = useAppContext();
  const { crmCompanies, crmContacts, crmActivities, crmDeals } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<CRMCompany | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTab, setDetailTab] = useState<'company' | 'contacts' | 'history'>('company');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  // Inline edit state for quick fields
  const [editingField, setEditingField] = useState<'employee_count' | 'industry' | null>(null);
  const [inlineValue, setInlineValue] = useState('');

  // Contact management state
  const [showContactModal, setShowContactModal] = useState(false);
  const [showContactChoiceModal, setShowContactChoiceModal] = useState(false);
  const [showSelectContactModal, setShowSelectContactModal] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    is_decision_maker: false
  });

  // Contact Profile modal state
  const [showContactProfileModal, setShowContactProfileModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);

  // Deal management state
  const [showDealChoiceModal, setShowDealChoiceModal] = useState(false);
  const [showSelectDealModal, setShowSelectDealModal] = useState(false);
  const [dealSearchTerm, setDealSearchTerm] = useState('');

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskContact, setTaskContact] = useState<CRMContact | null>(null);
  const [taskForm, setTaskForm] = useState({
    activity_type: 'task',
    subject: '',
    description: '',
    scheduled_at: '',
    location: ''
  });

  // Task type options
  const TASK_TYPE_OPTIONS = [
    { value: 'call', label: 'Telefon' },
    { value: 'email', label: 'Email' },
    { value: 'meeting', label: 'Spotkanie' },
    { value: 'task', label: 'Zadanie' }
  ];

  // GUS search state
  const [isSearchingGUS, setIsSearchingGUS] = useState(false);
  const [gusError, setGusError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    tax_id: '',
    regon: '',
    industry: '',
    address_street: '',
    address_city: '',
    address_postal_code: '',
    employee_count: '',
    notes: '',
    status: 'new',
    source: ''
  });

  // Filter companies by search and CRM status
  const filteredCompanies = useMemo(() => {
    return crmCompanies.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                           c.legal_name?.toLowerCase().includes(search.toLowerCase()) ||
                           c.tax_id?.toLowerCase().includes(search.toLowerCase()) ||
                           c.address_city?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [crmCompanies, search, statusFilter]);

  // Get contacts for a company
  const getCompanyContacts = (companyId: string) => {
    return crmContacts.filter(c => c.crm_company_id === companyId);
  };

  // Get activities/history for a company
  const getCompanyHistory = (companyId: string) => {
    return crmActivities
      .filter(a => a.crm_company_id === companyId)
      .sort((a, b) => new Date(b.created_at || b.scheduled_at).getTime() - new Date(a.created_at || a.scheduled_at).getTime());
  };

  // Get deals for a contact
  const getContactDeals = (contactId: string) => {
    return crmDeals.filter(d => d.contact_id === contactId);
  };

  // Get available contacts (not linked to this company)
  const getAvailableContacts = () => {
    if (!selectedCompany) return [];
    const companyContactIds = getCompanyContacts(selectedCompany.id).map(c => c.id);
    return crmContacts.filter(c =>
      !companyContactIds.includes(c.id) &&
      (c.first_name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
       c.last_name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
       c.email?.toLowerCase().includes(contactSearchTerm.toLowerCase()))
    );
  };

  // Get available deals (not linked to this contact)
  const getAvailableDeals = () => {
    if (!selectedContact) return [];
    const contactDealIds = getContactDeals(selectedContact.id).map(d => d.id);
    return crmDeals.filter(d =>
      !contactDealIds.includes(d.id) &&
      d.title.toLowerCase().includes(dealSearchTerm.toLowerCase())
    );
  };

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[ąą]/g, 'a')
      .replace(/[ćć]/g, 'c')
      .replace(/[ęę]/g, 'e')
      .replace(/[łł]/g, 'l')
      .replace(/[ńń]/g, 'n')
      .replace(/[óó]/g, 'o')
      .replace(/[śś]/g, 's')
      .replace(/[źżźż]/g, 'z')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Handle form change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Search GUS/DataPort by NIP
  const searchGUS = async () => {
    const cleanNip = formData.tax_id.replace(/[\s-]/g, '');
    if (!cleanNip || cleanNip.length !== 10) {
      setGusError('NIP musi mieć 10 cyfr');
      return;
    }

    // Validate NIP checksum
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanNip[i]) * weights[i];
    }
    const checkDigit = sum % 11;
    if (checkDigit === 10 || checkDigit !== parseInt(cleanNip[9])) {
      setGusError('Nieprawidłowy NIP - błędna suma kontrolna');
      return;
    }

    setIsSearchingGUS(true);
    setGusError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setGusError('Brak sesji - proszę zalogować się ponownie');
        setIsSearchingGUS(false);
        return;
      }

      const supabaseUrl = 'https://diytvuczpciikzdhldny.supabase.co';

      const response = await fetch(`${supabaseUrl}/functions/v1/search-gus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ nip: cleanNip })
      });

      if (!response.ok) {
        setGusError(`Błąd serwera (${response.status}). Spróbuj później.`);
        setIsSearchingGUS(false);
        return;
      }

      const result = await response.json();

      if (result.success && result.data && result.data.found !== false) {
        const d = result.data;
        const street = d.ulica ? `${d.ulica} ${d.nrNieruchomosci || ''}${d.nrLokalu ? '/' + d.nrLokalu : ''}`.trim() : '';

        setFormData(prev => ({
          ...prev,
          name: prev.name || d.nazwa || '',
          legal_name: d.nazwa || prev.legal_name,
          regon: d.regon || prev.regon,
          address_street: street || prev.address_street,
          address_city: d.miejscowosc || prev.address_city,
          address_postal_code: d.kodPocztowy || prev.address_postal_code
        }));
      } else {
        setGusError(result.error || 'Nie znaleziono firmy o podanym NIP w rejestrze GUS');
      }
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch')) {
        setGusError('Błąd połączenia z serwerem. Sprawdź połączenie internetowe.');
      } else {
        setGusError('Błąd podczas wyszukiwania. Spróbuj później.');
      }
    } finally {
      setIsSearchingGUS(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      legal_name: '',
      tax_id: '',
      regon: '',
      industry: '',
      address_street: '',
      address_city: '',
      address_postal_code: '',
      employee_count: '',
      notes: '',
      status: 'new',
      source: ''
    });
    setGusError(null);
  };

  // Handle add company
  const handleAddCompany = async () => {
    try {
      const newCompany = {
        name: formData.name,
        legal_name: formData.legal_name || null,
        tax_id: formData.tax_id || null,
        regon: formData.regon || null,
        industry: formData.industry || null,
        address_street: formData.address_street || null,
        address_city: formData.address_city || null,
        address_postal_code: formData.address_postal_code || null,
        employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
        notes: formData.notes || null,
        status: formData.status,
        source: formData.source || null,
        assigned_sales_id: state.currentUser?.id
      };

      const { data, error } = await supabase.from('crm_companies').insert([newCompany]).select().single();
      if (error) throw error;

      setState(prev => ({ ...prev, crmCompanies: [data, ...prev.crmCompanies] }));
      setShowAddModal(false);
      resetForm();

      // Open the detail modal for the newly created company
      setSelectedCompany(data);
      setShowDetailModal(true);
      setDetailTab('company');
    } catch (error) {
      console.error('Error adding company:', error);
      alert('Błąd podczas dodawania firmy');
    }
  };

  // Handle update company
  const handleUpdateCompany = async () => {
    if (!selectedCompany) return;
    try {
      const updates = {
        name: formData.name,
        legal_name: formData.legal_name || null,
        tax_id: formData.tax_id || null,
        regon: formData.regon || null,
        industry: formData.industry || null,
        address_street: formData.address_street || null,
        address_city: formData.address_city || null,
        address_postal_code: formData.address_postal_code || null,
        employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
        notes: formData.notes || null,
        status: formData.status,
        source: formData.source || null
      };

      const { data, error } = await supabase.from('crm_companies').update(updates).eq('id', selectedCompany.id).select().single();
      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmCompanies: prev.crmCompanies.map(c => c.id === selectedCompany.id ? data : c)
      }));
      setSelectedCompany(data);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Błąd podczas aktualizacji firmy');
    }
  };

  // Handle delete company
  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć firmę "${selectedCompany.name}"?`)) return;

    try {
      const { error } = await supabase.from('crm_companies').delete().eq('id', selectedCompany.id);
      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmCompanies: prev.crmCompanies.filter(c => c.id !== selectedCompany.id)
      }));
      setShowDetailModal(false);
      setSelectedCompany(null);
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Błąd podczas usuwania firmy');
    }
  };

  // Handle inline field update
  const handleInlineUpdate = async (field: 'employee_count' | 'industry', value: string) => {
    if (!selectedCompany) return;

    try {
      const updates: Record<string, any> = {};
      if (field === 'employee_count') {
        updates.employee_count = value ? parseInt(value) : null;
      } else {
        updates.industry = value || null;
      }

      const { data, error } = await supabase
        .from('crm_companies')
        .update(updates)
        .eq('id', selectedCompany.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmCompanies: prev.crmCompanies.map(c => c.id === selectedCompany.id ? data : c)
      }));
      setSelectedCompany(data);
      setEditingField(null);
      setInlineValue('');
    } catch (error) {
      console.error('Error updating field:', error);
      alert('Błąd podczas aktualizacji');
    }
  };

  // Open detail modal
  const openDetailModal = (company: CRMCompany) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name || '',
      legal_name: company.legal_name || '',
      tax_id: company.tax_id || '',
      regon: company.regon || '',
      industry: company.industry || '',
      address_street: company.address_street || '',
      address_city: company.address_city || '',
      address_postal_code: company.address_postal_code || '',
      employee_count: company.employee_count?.toString() || '',
      notes: company.notes || '',
      status: company.status || 'new',
      source: company.source || ''
    });
    setShowDetailModal(true);
    setDetailTab('company');
    setIsEditing(false);
  };

  // Contact form handlers
  const resetContactForm = () => {
    setContactForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      is_decision_maker: false
    });
    setEditingContact(null);
  };

  const openAddContactModal = () => {
    resetContactForm();
    setShowContactModal(true);
  };

  const openEditContactModal = (contact: CRMContact) => {
    setEditingContact(contact);
    setContactForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      position: contact.position || '',
      is_decision_maker: contact.is_decision_maker
    });
    setShowContactModal(true);
  };

  const handleSaveContact = async () => {
    if (!selectedCompany) return;

    try {
      if (editingContact) {
        // Update existing contact
        const { data, error } = await supabase
          .from('crm_contacts')
          .update({
            first_name: contactForm.first_name,
            last_name: contactForm.last_name,
            email: contactForm.email || null,
            phone: contactForm.phone || null,
            position: contactForm.position || null,
            is_decision_maker: contactForm.is_decision_maker
          })
          .eq('id', editingContact.id)
          .select()
          .single();

        if (error) throw error;

        setState(prev => ({
          ...prev,
          crmContacts: prev.crmContacts.map(c => c.id === editingContact.id ? data : c)
        }));
      } else {
        // Add new contact
        const { data, error } = await supabase
          .from('crm_contacts')
          .insert([{
            crm_company_id: selectedCompany.id,
            first_name: contactForm.first_name,
            last_name: contactForm.last_name,
            email: contactForm.email || null,
            phone: contactForm.phone || null,
            position: contactForm.position || null,
            is_decision_maker: contactForm.is_decision_maker,
            status: 'active'
          }])
          .select()
          .single();

        if (error) throw error;

        setState(prev => ({
          ...prev,
          crmContacts: [data, ...prev.crmContacts]
        }));
      }

      setShowContactModal(false);
      resetContactForm();
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Błąd podczas zapisywania kontaktu');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten kontakt?')) return;

    try {
      const { error } = await supabase.from('crm_contacts').delete().eq('id', contactId);
      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmContacts: prev.crmContacts.filter(c => c.id !== contactId)
      }));
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Błąd podczas usuwania kontaktu');
    }
  };

  // Update company status
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('crm_companies')
        .update({ status: newStatus })
        .eq('id', selectedCompany.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmCompanies: prev.crmCompanies.map(c => c.id === selectedCompany.id ? data : c)
      }));
      setSelectedCompany(data);
      setIsEditingStatus(false);

      // Log activity
      await logCompanyActivity('status_change', `Zmiana statusu na: ${CRM_STATUS_LABELS[newStatus]}`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Błąd podczas aktualizacji statusu');
    }
  };

  // Log company activity
  const logCompanyActivity = async (type: string, description: string) => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .insert([{
          activity_type: type,
          subject: description,
          crm_company_id: selectedCompany.id,
          is_completed: true,
          created_by: state.currentUser?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmActivities: [data, ...prev.crmActivities]
      }));
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  // Link existing contact to company
  const handleLinkContact = async (contact: CRMContact) => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .update({ crm_company_id: selectedCompany.id })
        .eq('id', contact.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmContacts: prev.crmContacts.map(c => c.id === contact.id ? data : c)
      }));

      setShowSelectContactModal(false);
      setContactSearchTerm('');

      await logCompanyActivity('contact_linked', `Powiązano kontakt: ${contact.first_name} ${contact.last_name}`);
    } catch (error) {
      console.error('Error linking contact:', error);
      alert('Błąd podczas powiązywania kontaktu');
    }
  };

  // Open contact profile modal
  const openContactProfile = (contact: CRMContact) => {
    setSelectedContact(contact);
    setContactForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      position: contact.position || '',
      department: contact.department || '',
      is_decision_maker: contact.is_decision_maker
    });
    setIsEditingContact(false);
    setShowContactProfileModal(true);
  };

  // Update contact from profile
  const handleUpdateContactProfile = async () => {
    if (!selectedContact) return;

    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .update({
          first_name: contactForm.first_name,
          last_name: contactForm.last_name,
          email: contactForm.email || null,
          phone: contactForm.phone || null,
          position: contactForm.position || null,
          department: contactForm.department || null,
          is_decision_maker: contactForm.is_decision_maker
        })
        .eq('id', selectedContact.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmContacts: prev.crmContacts.map(c => c.id === selectedContact.id ? data : c)
      }));
      setSelectedContact(data);
      setIsEditingContact(false);
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Błąd podczas aktualizacji kontaktu');
    }
  };

  // Link deal to contact
  const handleLinkDeal = async (deal: CRMDeal) => {
    if (!selectedContact) return;

    try {
      const { data, error } = await supabase
        .from('crm_deals')
        .update({ contact_id: selectedContact.id })
        .eq('id', deal.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmDeals: prev.crmDeals.map(d => d.id === deal.id ? data : d)
      }));

      setShowSelectDealModal(false);
      setDealSearchTerm('');
    } catch (error) {
      console.error('Error linking deal:', error);
      alert('Błąd podczas powiązywania deala');
    }
  };

  // Unlink deal from contact
  const handleUnlinkDeal = async (dealId: string) => {
    try {
      const { data, error } = await supabase
        .from('crm_deals')
        .update({ contact_id: null })
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmDeals: prev.crmDeals.map(d => d.id === dealId ? data : d)
      }));
    } catch (error) {
      console.error('Error unlinking deal:', error);
      alert('Błąd podczas usuwania powiązania');
    }
  };

  // Format activity type for display
  const formatActivityType = (type: string) => {
    const types: Record<string, string> = {
      'call': 'Telefon',
      'email': 'Email',
      'meeting': 'Spotkanie',
      'task': 'Zadanie',
      'note': 'Notatka',
      'status_change': 'Zmiana statusu',
      'contact_linked': 'Powiązanie kontaktu',
      'deal_created': 'Utworzenie deala'
    };
    return types[type] || type;
  };

  // Task modal handlers
  const openTaskModal = (contact: CRMContact) => {
    setTaskContact(contact);
    setTaskForm({
      activity_type: 'task',
      subject: `Zadanie dla ${contact.first_name} ${contact.last_name}`,
      description: '',
      scheduled_at: new Date().toISOString().slice(0, 16),
      location: ''
    });
    setShowTaskModal(true);
  };

  const handleCreateTask = async () => {
    if (!selectedCompany || !taskContact) return;

    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .insert([{
          activity_type: taskForm.activity_type,
          subject: taskForm.subject,
          description: taskForm.description || null,
          crm_company_id: selectedCompany.id,
          contact_id: taskContact.id,
          scheduled_at: taskForm.scheduled_at,
          location: taskForm.location || null,
          is_completed: false,
          created_by: state.currentUser?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmActivities: [data, ...prev.crmActivities]
      }));

      setShowTaskModal(false);
      setTaskContact(null);
      alert('Zadanie zostało utworzone');
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Błąd podczas tworzenia zadania');
    }
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Firmy</h1>
          <p className="text-slate-500 mt-1">Baza firm klientów i prospektów ({crmCompanies.length})</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj firm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie statusy</option>
            {CRM_STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj firmę
          </button>
        </div>
      </div>

      {/* Companies List */}
      {filteredCompanies.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Firma</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Lokalizacja</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Branża</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pracownicy</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCompanies.map(company => (
                <tr
                  key={company.id}
                  onClick={() => openDetailModal(company)}
                  className="hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{company.name}</p>
                        {company.tax_id && (
                          <p className="text-xs text-slate-500">NIP: {company.tax_id}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {company.address_city ? (
                      <div className="flex items-center gap-1 text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{company.address_city}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-600">{company.industry || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {company.employee_count ? (
                      <div className="flex items-center gap-1 text-slate-600">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>{company.employee_count}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${CRM_STATUS_COLORS[company.status] || 'bg-slate-100 text-slate-700'}`}>
                      {CRM_STATUS_LABELS[company.status] || company.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-5 h-5 text-slate-400 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{crmCompanies.length === 0 ? 'Brak firm w bazie' : 'Brak firm spełniających kryteria'}</p>
          {crmCompanies.length === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Dodaj pierwszą firmę
            </button>
          )}
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Dodaj firmę</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* NIP with GUS Search */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="tax_id"
                      value={formData.tax_id}
                      onChange={handleFormChange}
                      placeholder="0000000000"
                      maxLength={10}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={searchGUS}
                      disabled={isSearchingGUS || formData.tax_id.replace(/[\s-]/g, '').length !== 10}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      {isSearchingGUS ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Szukam...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          Szukaj w GUS
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Wpisz NIP i kliknij "Szukaj w GUS" aby automatycznie wypełnić dane</p>
                  {gusError && <p className="text-xs text-red-600 mt-1">{gusError}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa prawna</label>
                  <input
                    type="text"
                    name="legal_name"
                    value={formData.legal_name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">REGON</label>
                  <input
                    type="text"
                    name="regon"
                    value={formData.regon}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branża</label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Wybierz branżę</option>
                    {INDUSTRY_OPTIONS.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ulica</label>
                  <input
                    type="text"
                    name="address_street"
                    value={formData.address_street}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Miasto</label>
                  <input
                    type="text"
                    name="address_city"
                    value={formData.address_city}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kod pocztowy</label>
                  <input
                    type="text"
                    name="address_postal_code"
                    value={formData.address_postal_code}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Liczba pracowników</label>
                  <input
                    type="number"
                    name="employee_count"
                    value={formData.employee_count}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status CRM</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {CRM_STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Źródło</label>
                  <input
                    type="text"
                    name="source"
                    value={formData.source}
                    onChange={handleFormChange}
                    placeholder="np. LinkedIn, Polecenie, Strona www"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notatki</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleAddCompany}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!formData.name}
                >
                  Dodaj firmę
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Detail Modal */}
      {showDetailModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedCompany.name}</h3>
                  {/* Clickable status tag */}
                  <div className="relative">
                    {isEditingStatus ? (
                      <select
                        value={selectedCompany.status}
                        onChange={(e) => handleUpdateStatus(e.target.value)}
                        onBlur={() => setIsEditingStatus(false)}
                        autoFocus
                        className="px-2 py-1 text-xs font-medium border border-blue-300 rounded-full focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {CRM_STATUS_OPTIONS.map(status => (
                          <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setIsEditingStatus(true)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition ${CRM_STATUS_COLORS[selectedCompany.status] || 'bg-slate-100 text-slate-700'}`}
                      >
                        {CRM_STATUS_LABELS[selectedCompany.status] || selectedCompany.status}
                        <Edit className="w-3 h-3 ml-1 opacity-50" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowDetailModal(false); setSelectedCompany(null); setIsEditing(false); setIsEditingStatus(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 px-6">
              <div className="flex gap-6">
                <button
                  onClick={() => setDetailTab('company')}
                  className={`py-3 border-b-2 font-medium transition ${detailTab === 'company' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Dane firmy
                </button>
                <button
                  onClick={() => setDetailTab('contacts')}
                  className={`py-3 border-b-2 font-medium transition ${detailTab === 'contacts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Kontakty ({getCompanyContacts(selectedCompany.id).length})
                </button>
                <button
                  onClick={() => setDetailTab('history')}
                  className={`py-3 border-b-2 font-medium transition ${detailTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Historia ({getCompanyHistory(selectedCompany.id).length})
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Company Data Tab */}
              {detailTab === 'company' && (
                <div>
                  {isEditing ? (
                    // Edit mode
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa prawna</label>
                        <input
                          type="text"
                          name="legal_name"
                          value={formData.legal_name}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
                        <input
                          type="text"
                          name="tax_id"
                          value={formData.tax_id}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">REGON</label>
                        <input
                          type="text"
                          name="regon"
                          value={formData.regon}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Branża</label>
                        <select
                          name="industry"
                          value={formData.industry}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Wybierz branżę</option>
                          {INDUSTRY_OPTIONS.map(ind => (
                            <option key={ind} value={ind}>{ind}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Liczba pracowników</label>
                        <input
                          type="number"
                          name="employee_count"
                          value={formData.employee_count}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ulica</label>
                        <input
                          type="text"
                          name="address_street"
                          value={formData.address_street}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Miasto</label>
                        <input
                          type="text"
                          name="address_city"
                          value={formData.address_city}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Kod pocztowy</label>
                        <input
                          type="text"
                          name="address_postal_code"
                          value={formData.address_postal_code}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Status CRM</label>
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {CRM_STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Źródło</label>
                        <input
                          type="text"
                          name="source"
                          value={formData.source}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notatki</label>
                        <textarea
                          name="notes"
                          value={formData.notes}
                          onChange={handleFormChange}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2 flex gap-3 mt-4">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                        >
                          Anuluj
                        </button>
                        <button
                          onClick={handleUpdateCompany}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Zapisz zmiany
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div>
                      {/* Info cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* Employee count - editable */}
                        <div
                          className="bg-slate-50 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition group"
                          onClick={() => {
                            setEditingField('employee_count');
                            setInlineValue(selectedCompany.employee_count?.toString() || '');
                          }}
                        >
                          <div className="flex items-center justify-between text-slate-500 mb-1">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              <span className="text-xs uppercase font-medium">Pracownicy</span>
                            </div>
                            <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          {editingField === 'employee_count' ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <input
                                type="number"
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                className="w-full px-2 py-1 text-lg font-bold border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineUpdate('employee_count', inlineValue);
                                  if (e.key === 'Escape') { setEditingField(null); setInlineValue(''); }
                                }}
                              />
                              <button
                                onClick={() => handleInlineUpdate('employee_count', inlineValue)}
                                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-lg font-bold text-slate-900">{selectedCompany.employee_count || '-'}</p>
                          )}
                        </div>

                        {/* Industry - editable */}
                        <div
                          className="bg-slate-50 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition group"
                          onClick={() => {
                            setEditingField('industry');
                            setInlineValue(selectedCompany.industry || '');
                          }}
                        >
                          <div className="flex items-center justify-between text-slate-500 mb-1">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4" />
                              <span className="text-xs uppercase font-medium">Branża</span>
                            </div>
                            <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          {editingField === 'industry' ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <select
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                className="w-full px-2 py-1 text-sm font-bold border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineUpdate('industry', inlineValue);
                                  if (e.key === 'Escape') { setEditingField(null); setInlineValue(''); }
                                }}
                              >
                                <option value="">Wybierz branżę</option>
                                {INDUSTRY_OPTIONS.map(ind => (
                                  <option key={ind} value={ind}>{ind}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleInlineUpdate('industry', inlineValue)}
                                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-lg font-bold text-slate-900">{selectedCompany.industry || '-'}</p>
                          )}
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <MapPin className="w-4 h-4" />
                            <span className="text-xs uppercase font-medium">Miasto</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">{selectedCompany.address_city || '-'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <User className="w-4 h-4" />
                            <span className="text-xs uppercase font-medium">Kontakty</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">{getCompanyContacts(selectedCompany.id).length}</p>
                        </div>
                      </div>

                      {/* Company details */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">Dane rejestrowe</h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-slate-500">Nazwa prawna</p>
                              <p className="font-medium text-slate-900">{selectedCompany.legal_name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">NIP</p>
                              <p className="font-medium text-slate-900">{selectedCompany.tax_id || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">REGON</p>
                              <p className="font-medium text-slate-900">{selectedCompany.regon || '-'}</p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">Adres</h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-slate-500">Ulica</p>
                              <p className="font-medium text-slate-900">{selectedCompany.address_street || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Kod pocztowy</p>
                              <p className="font-medium text-slate-900">{selectedCompany.address_postal_code || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Miasto</p>
                              <p className="font-medium text-slate-900">{selectedCompany.address_city || '-'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedCompany.notes && (
                        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-500 mb-1">Notatki</p>
                          <p className="text-slate-700 whitespace-pre-wrap">{selectedCompany.notes}</p>
                        </div>
                      )}

                      {selectedCompany.source && (
                        <p className="mt-4 text-sm text-slate-500">Źródło: {selectedCompany.source}</p>
                      )}

                      <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition flex items-center justify-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edytuj
                        </button>
                        <button
                          onClick={handleDeleteCompany}
                          className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contacts Tab */}
              {detailTab === 'contacts' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-slate-900">Kontakty firmowe</h4>
                    <button
                      onClick={() => setShowContactChoiceModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Dodaj kontakt
                    </button>
                  </div>

                  {getCompanyContacts(selectedCompany.id).length > 0 ? (
                    <div className="space-y-3">
                      {getCompanyContacts(selectedCompany.id).map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                          <div
                            className="flex items-center gap-4 flex-1 cursor-pointer"
                            onClick={() => openContactProfile(contact)}
                          >
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-900">
                                  {contact.first_name} {contact.last_name}
                                </p>
                                {contact.is_decision_maker && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                    LPR
                                  </span>
                                )}
                              </div>
                              {contact.position && (
                                <p className="text-sm text-slate-500">{contact.position}</p>
                              )}
                              <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                                {contact.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {contact.email}
                                  </span>
                                )}
                                {contact.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {contact.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openTaskModal(contact)}
                              className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition"
                              title="Utwórz zadanie"
                            >
                              <CheckSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openContactProfile(contact)}
                              className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition"
                              title="Profil kontaktu"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditContactModal(contact)}
                              className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition"
                              title="Edytuj"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteContact(contact.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                              title="Usuń"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-lg">
                      <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500">Brak kontaktów</p>
                      <button
                        onClick={() => setShowContactChoiceModal(true)}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Dodaj pierwszy kontakt
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {detailTab === 'history' && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-4">Historia aktywności</h4>
                  {getCompanyHistory(selectedCompany.id).length > 0 ? (
                    <div className="space-y-3">
                      {getCompanyHistory(selectedCompany.id).map(activity => (
                        <div key={activity.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            activity.activity_type === 'call' ? 'bg-green-100 text-green-600' :
                            activity.activity_type === 'email' ? 'bg-blue-100 text-blue-600' :
                            activity.activity_type === 'meeting' ? 'bg-purple-100 text-purple-600' :
                            activity.activity_type === 'status_change' ? 'bg-orange-100 text-orange-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {activity.activity_type === 'call' && <Phone className="w-4 h-4" />}
                            {activity.activity_type === 'email' && <Mail className="w-4 h-4" />}
                            {activity.activity_type === 'meeting' && <Users className="w-4 h-4" />}
                            {activity.activity_type === 'task' && <CheckSquare className="w-4 h-4" />}
                            {!['call', 'email', 'meeting', 'task'].includes(activity.activity_type) && <History className="w-4 h-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-slate-900">{activity.subject}</p>
                              <span className="text-xs text-slate-500">
                                {new Date(activity.created_at || activity.scheduled_at).toLocaleDateString('pl-PL', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
                                {formatActivityType(activity.activity_type)}
                              </span>
                              {activity.is_completed && (
                                <span className="ml-2 text-green-600">Zakończone</span>
                              )}
                            </p>
                            {activity.description && (
                              <p className="text-sm text-slate-600 mt-2">{activity.description}</p>
                            )}
                            {activity.location && (
                              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {activity.location}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-lg">
                      <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500">Brak historii aktywności</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Add/Edit Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingContact ? 'Edytuj kontakt' : 'Dodaj kontakt'}
              </h3>
              <button onClick={() => { setShowContactModal(false); resetContactForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                    <input
                      type="text"
                      value={contactForm.first_name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, first_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                    <input
                      type="text"
                      value={contactForm.last_name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, last_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stanowisko</label>
                  <input
                    type="text"
                    value={contactForm.position}
                    onChange={(e) => setContactForm(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_decision_maker"
                    checked={contactForm.is_decision_maker}
                    onChange={(e) => setContactForm(prev => ({ ...prev, is_decision_maker: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_decision_maker" className="text-sm text-slate-700">
                    Osoba decyzyjna (LPR)
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowContactModal(false); resetContactForm(); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleSaveContact}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!contactForm.first_name || !contactForm.last_name}
                >
                  {editingContact ? 'Zapisz' : 'Dodaj'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && taskContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Utwórz zadanie</h3>
              <button onClick={() => { setShowTaskModal(false); setTaskContact(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">
                Zadanie dla: <span className="font-medium text-slate-700">{taskContact.first_name} {taskContact.last_name}</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Typ zadania *</label>
                  <select
                    value={taskForm.activity_type}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, activity_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {TASK_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Temat *</label>
                  <input
                    type="text"
                    value={taskForm.subject}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data i godzina *</label>
                  <input
                    type="datetime-local"
                    value={taskForm.scheduled_at}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lokalizacja</label>
                  <input
                    type="text"
                    value={taskForm.location}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="np. Biuro, Online, Adres"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowTaskModal(false); setTaskContact(null); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleCreateTask}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!taskForm.subject || !taskForm.scheduled_at}
                >
                  Utwórz zadanie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Choice Modal */}
      {showContactChoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Dodaj kontakt</h3>
              <button onClick={() => setShowContactChoiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  setShowContactChoiceModal(false);
                  resetContactForm();
                  setShowContactModal(true);
                }}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Dodaj nowy kontakt</p>
                  <p className="text-sm text-slate-500">Utwórz nową osobę kontaktową</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowContactChoiceModal(false);
                  setContactSearchTerm('');
                  setShowSelectContactModal(true);
                }}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Wybierz z kontaktów</p>
                  <p className="text-sm text-slate-500">Powiąż istniejący kontakt</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Contact Modal */}
      {showSelectContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Wybierz kontakt</h3>
              <button onClick={() => setShowSelectContactModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={contactSearchTerm}
                  onChange={(e) => setContactSearchTerm(e.target.value)}
                  placeholder="Szukaj kontaktu..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {getAvailableContacts().length > 0 ? (
                <div className="space-y-2">
                  {getAvailableContacts().map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => handleLinkContact(contact)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition text-left"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{contact.first_name} {contact.last_name}</p>
                        <p className="text-sm text-slate-500">{contact.email || contact.phone || 'Brak danych'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Brak dostępnych kontaktów</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Profile Modal */}
      {showContactProfileModal && selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Star className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedContact.first_name} {selectedContact.last_name}</h3>
                  {selectedContact.is_decision_maker && (
                    <span className="text-sm text-amber-600 flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Osoba decyzyjna (LPR)
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => { setShowContactProfileModal(false); setSelectedContact(null); setIsEditingContact(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {isEditingContact ? (
                // Edit mode
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                      <input
                        type="text"
                        value={contactForm.first_name}
                        onChange={(e) => setContactForm(prev => ({ ...prev, first_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                      <input
                        type="text"
                        value={contactForm.last_name}
                        onChange={(e) => setContactForm(prev => ({ ...prev, last_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stanowisko</label>
                    <input
                      type="text"
                      value={contactForm.position}
                      onChange={(e) => setContactForm(prev => ({ ...prev, position: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dział</label>
                    <input
                      type="text"
                      value={contactForm.department}
                      onChange={(e) => setContactForm(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="profile_is_decision_maker"
                      checked={contactForm.is_decision_maker}
                      onChange={(e) => setContactForm(prev => ({ ...prev, is_decision_maker: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="profile_is_decision_maker" className="text-sm text-slate-700">
                      Osoba decyzyjna (LPR)
                    </label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setIsEditingContact(false)}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={handleUpdateContactProfile}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Zapisz
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="space-y-4">
                  {/* Company info */}
                  {selectedCompany && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Firma</p>
                        <p className="font-medium text-slate-900">{selectedCompany.name}</p>
                      </div>
                    </div>
                  )}

                  {/* Position & Department */}
                  {(selectedContact.position || selectedContact.department) && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Briefcase className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{selectedContact.position || '-'}</p>
                        {selectedContact.department && (
                          <p className="text-sm text-slate-500">{selectedContact.department}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  {selectedContact.email && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Mail className="w-5 h-5 text-slate-400" />
                      <a href={`mailto:${selectedContact.email}`} className="text-blue-600 hover:underline">
                        {selectedContact.email}
                      </a>
                    </div>
                  )}

                  {/* Phone */}
                  {selectedContact.phone && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Phone className="w-5 h-5 text-slate-400" />
                      <a href={`tel:${selectedContact.phone}`} className="text-blue-600 hover:underline">
                        {selectedContact.phone}
                      </a>
                    </div>
                  )}

                  {/* Deals */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-slate-500">Powiązane deale</p>
                      <button
                        onClick={() => setShowDealChoiceModal(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Dodaj deal
                      </button>
                    </div>
                    {getContactDeals(selectedContact.id).length > 0 ? (
                      <div className="space-y-2">
                        {getContactDeals(selectedContact.id).map(deal => (
                          <div key={deal.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <div>
                              <p className="font-medium text-slate-900">{deal.title}</p>
                              <p className="text-sm text-blue-600 font-semibold">
                                {deal.value?.toLocaleString('pl-PL')} zł
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => window.open(`/sales/pipeline?deal=${deal.id}`, '_blank')}
                                className="p-2 text-slate-500 hover:bg-blue-100 rounded-lg transition"
                                title="Przejdź do deala"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUnlinkDeal(deal.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                title="Usuń powiązanie"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-4">Brak powiązanych deali</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => setIsEditingContact(true)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edytuj
                    </button>
                    <button
                      onClick={() => { setShowContactProfileModal(false); setSelectedContact(null); }}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                      Zamknij
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deal Choice Modal */}
      {showDealChoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Dodaj deal</h3>
              <button onClick={() => setShowDealChoiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  setShowDealChoiceModal(false);
                  // Navigate to pipeline with new deal for this contact
                  window.open(`/sales/pipeline?newDeal=true&contactId=${selectedContact?.id}`, '_blank');
                }}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Dodaj nowy deal</p>
                  <p className="text-sm text-slate-500">Utwórz nową szansę sprzedaży</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowDealChoiceModal(false);
                  setDealSearchTerm('');
                  setShowSelectDealModal(true);
                }}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Wybierz z istniejących</p>
                  <p className="text-sm text-slate-500">Powiąż istniejący deal</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Deal Modal */}
      {showSelectDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Wybierz deal</h3>
              <button onClick={() => setShowSelectDealModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={dealSearchTerm}
                  onChange={(e) => setDealSearchTerm(e.target.value)}
                  placeholder="Szukaj deala..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {getAvailableDeals().length > 0 ? (
                <div className="space-y-2">
                  {getAvailableDeals().map(deal => (
                    <button
                      key={deal.id}
                      onClick={() => handleLinkDeal(deal)}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition text-left"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{deal.title}</p>
                        <p className="text-sm text-slate-500">{deal.stage}</p>
                      </div>
                      <p className="font-semibold text-blue-600">{deal.value?.toLocaleString('pl-PL')} zł</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Brak dostępnych deali</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
