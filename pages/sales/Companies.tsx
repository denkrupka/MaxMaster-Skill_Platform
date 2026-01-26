
import React, { useState, useMemo } from 'react';
import { Plus, Search, Building2, MapPin, Users, Edit, Trash2, X, Phone, Mail, User, Briefcase, Check, Loader2, ChevronRight, CheckSquare } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CRMCompany, CRMContact } from '../../types';
import { INDUSTRY_OPTIONS, CRM_STATUS_OPTIONS, CRM_STATUS_LABELS, CRM_STATUS_COLORS } from '../../constants';
import { supabase, SUPABASE_ANON_KEY } from '../../lib/supabase';

export const SalesCompanies: React.FC = () => {
  const { state, setState } = useAppContext();
  const { crmCompanies, crmContacts, crmActivities } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<CRMCompany | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTab, setDetailTab] = useState<'company' | 'contacts'>('company');
  const [isEditing, setIsEditing] = useState(false);

  // Contact management state
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    is_decision_maker: false
  });

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskContact, setTaskContact] = useState<CRMContact | null>(null);
  const [taskForm, setTaskForm] = useState({
    subject: '',
    description: '',
    scheduled_at: ''
  });

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

  // Task modal handlers
  const openTaskModal = (contact: CRMContact) => {
    setTaskContact(contact);
    setTaskForm({
      subject: `Zadanie dla ${contact.first_name} ${contact.last_name}`,
      description: '',
      scheduled_at: new Date().toISOString().slice(0, 16)
    });
    setShowTaskModal(true);
  };

  const handleCreateTask = async () => {
    if (!selectedCompany || !taskContact) return;

    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .insert([{
          activity_type: 'task',
          subject: taskForm.subject,
          description: taskForm.description || null,
          crm_company_id: selectedCompany.id,
          contact_id: taskContact.id,
          scheduled_at: taskForm.scheduled_at,
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
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${CRM_STATUS_COLORS[selectedCompany.status] || 'bg-slate-100 text-slate-700'}`}>
                    {CRM_STATUS_LABELS[selectedCompany.status] || selectedCompany.status}
                  </span>
                </div>
              </div>
              <button onClick={() => { setShowDetailModal(false); setSelectedCompany(null); setIsEditing(false); }} className="text-slate-400 hover:text-slate-600">
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
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <Users className="w-4 h-4" />
                            <span className="text-xs uppercase font-medium">Pracownicy</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">{selectedCompany.employee_count || '-'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <Briefcase className="w-4 h-4" />
                            <span className="text-xs uppercase font-medium">Branża</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">{selectedCompany.industry || '-'}</p>
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
                      onClick={openAddContactModal}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Dodaj kontakt
                    </button>
                  </div>

                  {getCompanyContacts(selectedCompany.id).length > 0 ? (
                    <div className="space-y-3">
                      {getCompanyContacts(selectedCompany.id).map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-4">
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
                        onClick={openAddContactModal}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Dodaj pierwszy kontakt
                      </button>
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
    </div>
  );
};
