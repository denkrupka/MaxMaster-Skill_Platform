
import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Building2, Users, CreditCard, Lock, Unlock,
  Edit2, Trash2, Eye, X, MoreVertical, Check, AlertCircle, Loader2
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Company, CompanyStatus, SubscriptionStatus } from '../../types';
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_COLORS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_COLORS } from '../../constants';
import { supabase, SUPABASE_ANON_KEY } from '../../lib/supabase';

export const SuperAdminCompaniesPage: React.FC = () => {
  const { state, addCompany, updateCompany, deleteCompany, blockCompany, unblockCompany } = useAppContext();
  const { companies, users, companyModules, modules } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // GUS search state
  const [isSearchingGUS, setIsSearchingGUS] = useState(false);
  const [gusError, setGusError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    legal_name: '',
    tax_id: '',
    regon: '',
    address_street: '',
    address_city: '',
    address_postal_code: '',
    contact_email: '',
    contact_phone: '',
    billing_email: ''
  });

  // Get users count for company
  const getCompanyUsersCount = (companyId: string): number => {
    return users.filter(u => u.company_id === companyId).length;
  };

  // Get modules for company
  const getCompanyModules = (companyId: string) => {
    return companyModules.filter(cm => cm.company_id === companyId);
  };

  // Filter companies
  const filteredCompanies = useMemo(() => {
    if (!searchTerm) return companies;
    const searchLower = searchTerm.toLowerCase();
    return companies.filter(company =>
      company.name?.toLowerCase().includes(searchLower) ||
      company.slug?.toLowerCase().includes(searchLower) ||
      company.contact_email?.toLowerCase().includes(searchLower)
    );
  }, [companies, searchTerm]);

  // Stats
  const stats = useMemo(() => ({
    total: companies.length,
    active: companies.filter(c => c.status === 'active').length,
    trial: companies.filter(c => c.status === 'trial' || c.subscription_status === 'trialing').length,
    blocked: companies.filter(c => c.is_blocked).length
  }), [companies]);

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
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'name' ? { slug: generateSlug(value) } : {})
    }));
  };

  // Handle add company
  const handleAddCompany = async () => {
    try {
      await addCompany({
        ...formData,
        status: 'trial' as CompanyStatus,
        subscription_status: 'trialing' as SubscriptionStatus,
        is_blocked: false,
        bonus_balance: 0
      });
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error adding company:', error);
      alert('Błąd podczas dodawania firmy');
    }
  };

  // Handle update company
  const handleUpdateCompany = async () => {
    if (!selectedCompany) return;
    try {
      await updateCompany(selectedCompany.id, formData);
      setShowEditModal(false);
      setSelectedCompany(null);
      resetForm();
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Błąd podczas aktualizacji firmy');
    }
  };

  // Handle delete company
  const handleDeleteCompany = async (company: Company) => {
    const usersCount = getCompanyUsersCount(company.id);
    if (usersCount > 0) {
      alert(`Nie można usunąć firmy, która ma ${usersCount} użytkowników. Najpierw usuń lub przenieś użytkowników.`);
      return;
    }
    if (window.confirm(`Czy na pewno chcesz usunąć firmę "${company.name}"? Ta operacja jest nieodwracalna.`)) {
      await deleteCompany(company.id);
    }
  };

  // Handle block
  const handleBlock = async () => {
    if (selectedCompany) {
      await blockCompany(selectedCompany.id, blockReason);
      setShowBlockModal(false);
      setBlockReason('');
      setSelectedCompany(null);
    }
  };

  // Handle unblock
  const handleUnblock = async (company: Company) => {
    await unblockCompany(company.id);
  };

  // Open edit modal
  const openEditModal = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name || '',
      slug: company.slug || '',
      legal_name: company.legal_name || '',
      tax_id: company.tax_id || '',
      regon: company.regon || '',
      address_street: company.address_street || '',
      address_city: company.address_city || '',
      address_postal_code: company.address_postal_code || '',
      contact_email: company.contact_email || '',
      contact_phone: company.contact_phone || '',
      billing_email: company.billing_email || ''
    });
    setShowEditModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      legal_name: '',
      tax_id: '',
      regon: '',
      address_street: '',
      address_city: '',
      address_postal_code: '',
      contact_email: '',
      contact_phone: '',
      billing_email: ''
    });
    setGusError(null);
  };

  // Search GUS/DataPort by NIP
  const searchGUS = async () => {
    const cleanNip = formData.tax_id.replace(/[\s-]/g, '');
    if (!cleanNip || cleanNip.length !== 10) {
      setGusError('NIP musi mieć 10 cyfr');
      return;
    }

    setIsSearchingGUS(true);
    setGusError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Brak sesji');

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

      const result = await response.json();

      if (result.success && result.data && result.data.found !== false) {
        const d = result.data;
        const street = d.ulica ? `${d.ulica} ${d.nrNieruchomosci || ''}${d.nrLokalu ? '/' + d.nrLokalu : ''}`.trim() : '';

        setFormData(prev => ({
          ...prev,
          name: prev.name || d.nazwa || '',
          slug: prev.slug || generateSlug(d.nazwa || ''),
          legal_name: d.nazwa || prev.legal_name,
          regon: d.regon || prev.regon,
          address_street: street || prev.address_street,
          address_city: d.miejscowosc || prev.address_city,
          address_postal_code: d.kodPocztowy || prev.address_postal_code,
          contact_email: d.email || prev.contact_email,
          contact_phone: d.telefon || prev.contact_phone
        }));
      } else {
        setGusError(result.error || 'Nie znaleziono firmy');
      }
    } catch (err) {
      console.error('GUS search error:', err);
      setGusError('Błąd podczas wyszukiwania. Spróbuj później.');
    } finally {
      setIsSearchingGUS(false);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zarządzanie Firmami</h1>
          <p className="text-slate-500 mt-1">Wszystkie firmy na platformie</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Dodaj firmę
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Wszystkich firm</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
              <p className="text-xs text-slate-500">Aktywnych</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.trial}</p>
              <p className="text-xs text-slate-500">Trial</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.blocked}</p>
              <p className="text-xs text-slate-500">Zablokowanych</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj firm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCompanies.map(company => (
          <div
            key={company.id}
            className={`bg-white rounded-xl border p-5 hover:shadow-md transition ${
              company.is_blocked ? 'border-red-200 bg-red-50' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={company.name} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                    {company.name?.[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-slate-900">{company.name}</h3>
                  <p className="text-sm text-slate-500">/{company.slug}</p>
                </div>
              </div>
              {company.is_blocked && (
                <Lock className="w-5 h-5 text-red-500" />
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                COMPANY_STATUS_COLORS[company.status] || 'bg-slate-100 text-slate-800 border-slate-200'
              }`}>
                {COMPANY_STATUS_LABELS[company.status] || company.status}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                SUBSCRIPTION_STATUS_COLORS[company.subscription_status] || 'bg-slate-100 text-slate-800 border-slate-200'
              }`}>
                {SUBSCRIPTION_STATUS_LABELS[company.subscription_status] || company.subscription_status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-slate-500">Użytkownicy</p>
                <p className="font-semibold text-slate-900">{getCompanyUsersCount(company.id)}</p>
              </div>
              <div>
                <p className="text-slate-500">Moduły</p>
                <p className="font-semibold text-slate-900">{getCompanyModules(company.id).length}</p>
              </div>
              <div>
                <p className="text-slate-500">Balans</p>
                <p className="font-semibold text-slate-900">{company.bonus_balance?.toFixed(2) || '0.00'} PLN</p>
              </div>
              <div>
                <p className="text-slate-500">Kontakt</p>
                <p className="font-semibold text-slate-900 truncate" title={company.contact_email || '-'}>
                  {company.contact_email || '-'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => { setSelectedCompany(company); setShowDetailModal(true); }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <Eye className="w-4 h-4" />
                Szczegóły
              </button>
              <button
                onClick={() => openEditModal(company)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <Edit2 className="w-4 h-4" />
                Edytuj
              </button>
              {company.is_blocked ? (
                <button
                  onClick={() => handleUnblock(company)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                  title="Odblokuj"
                >
                  <Unlock className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => { setSelectedCompany(company); setShowBlockModal(true); }}
                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                  title="Zablokuj"
                >
                  <Lock className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleDeleteCompany(company)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Usuń"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCompanies.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nie znaleziono firm</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {showAddModal ? 'Dodaj firmę' : 'Edytuj firmę'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* NIP with GUS Search - at the top */}
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
                  {gusError && (
                    <p className="text-xs text-red-600 mt-1">{gusError}</p>
                  )}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL)</label>
                  <div className="flex items-center">
                    <span className="text-slate-500 mr-1">/</span>
                    <input
                      type="text"
                      name="slug"
                      value={formData.slug}
                      onChange={handleFormChange}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 mt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Dane do faktury</p>
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

                <div className="md:col-span-2 mt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Dane kontaktowe</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email kontaktowy</label>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email do faktur</label>
                  <input
                    type="email"
                    name="billing_email"
                    value={formData.billing_email}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={showAddModal ? handleAddCompany : handleUpdateCompany}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!formData.name}
                >
                  {showAddModal ? 'Dodaj firmę' : 'Zapisz zmiany'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Zablokuj firmę</h3>
              <button onClick={() => setShowBlockModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 mb-4">
              Czy na pewno chcesz zablokować firmę <strong>{selectedCompany.name}</strong>?
              Wszyscy użytkownicy tej firmy stracą dostęp.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Powód blokady</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Opcjonalnie podaj powód..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleBlock}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Zablokuj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Szczegóły firmy</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                {selectedCompany.logo_url ? (
                  <img src={selectedCompany.logo_url} alt={selectedCompany.name} className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
                    {selectedCompany.name?.[0]}
                  </div>
                )}
                <div>
                  <h4 className="text-xl font-bold text-slate-900">{selectedCompany.name}</h4>
                  <p className="text-slate-500">/{selectedCompany.slug}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    COMPANY_STATUS_COLORS[selectedCompany.status]
                  }`}>
                    {COMPANY_STATUS_LABELS[selectedCompany.status]}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Subskrypcja</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    SUBSCRIPTION_STATUS_COLORS[selectedCompany.subscription_status]
                  }`}>
                    {SUBSCRIPTION_STATUS_LABELS[selectedCompany.subscription_status]}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Użytkownicy</p>
                  <p className="font-bold text-slate-900">{getCompanyUsersCount(selectedCompany.id)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Balans bonusowy</p>
                  <p className="font-bold text-slate-900">{selectedCompany.bonus_balance?.toFixed(2) || '0.00'} PLN</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">NIP</p>
                  <p className="font-medium text-slate-900">{selectedCompany.tax_id || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">REGON</p>
                  <p className="font-medium text-slate-900">{selectedCompany.regon || '-'}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h5 className="font-semibold text-slate-900 mb-3">Dane kontaktowe</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium text-slate-900">{selectedCompany.contact_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Telefon</p>
                    <p className="font-medium text-slate-900">{selectedCompany.contact_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email do faktur</p>
                    <p className="font-medium text-slate-900">{selectedCompany.billing_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Adres</p>
                    <p className="font-medium text-slate-900">
                      {selectedCompany.address_street && selectedCompany.address_city
                        ? `${selectedCompany.address_street}, ${selectedCompany.address_postal_code} ${selectedCompany.address_city}`
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <h5 className="font-semibold text-slate-900 mb-3">Aktywne moduły</h5>
                {getCompanyModules(selectedCompany.id).length > 0 ? (
                  <div className="space-y-2">
                    {getCompanyModules(selectedCompany.id).map(cm => {
                      const mod = modules.find(m => m.code === cm.module_code);
                      return (
                        <div key={cm.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">{mod?.name_pl || cm.module_code}</p>
                            <p className="text-sm text-slate-500">{cm.max_users} użytkowników, {cm.price_per_user} PLN/os</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            cm.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {cm.is_active ? 'Aktywny' : 'Nieaktywny'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Brak aktywnych modułów</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
