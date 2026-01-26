
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, User, Building2, Phone, Mail, Star, X, Briefcase, Edit, Trash2, Link2, ExternalLink } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CRMContact, CRMCompany, CRMDeal } from '../../types';
import { supabase } from '../../lib/supabase';

export const SalesContacts: React.FC = () => {
  const navigate = useNavigate();
  const { state, setState } = useAppContext();
  const { crmContacts, crmCompanies, crmDeals } = state;

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [lprFilter, setLprFilter] = useState<'all' | 'lpr' | 'other'>('all');
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    is_decision_maker: false,
    crm_company_id: ''
  });

  // Deal management state
  const [showDealChoiceModal, setShowDealChoiceModal] = useState(false);
  const [showSelectDealModal, setShowSelectDealModal] = useState(false);
  const [dealSearchTerm, setDealSearchTerm] = useState('');

  // Phone formatting function
  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+48')) {
      const digits = cleaned.slice(3);
      if (digits.length <= 3) return `+48 ${digits}`;
      if (digits.length <= 6) return `+48 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+48 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
    }

    if (cleaned.startsWith('48') && cleaned.length > 2) {
      const digits = cleaned.slice(2);
      if (digits.length <= 3) return `+48 ${digits}`;
      if (digits.length <= 6) return `+48 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+48 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
    }

    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setContactForm(prev => ({ ...prev, phone: formatted }));
  };

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return crmContacts.filter(c => {
      const matchesSearch =
        c.first_name.toLowerCase().includes(search.toLowerCase()) ||
        c.last_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.position?.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = companyFilter === 'all' || c.crm_company_id === companyFilter;
      const matchesLpr = lprFilter === 'all' ||
        (lprFilter === 'lpr' && c.is_decision_maker) ||
        (lprFilter === 'other' && !c.is_decision_maker);
      return matchesSearch && matchesCompany && matchesLpr;
    });
  }, [crmContacts, search, companyFilter, lprFilter]);

  // Get company by ID
  const getCompany = (companyId?: string): CRMCompany | undefined => {
    return crmCompanies.find(c => c.id === companyId);
  };

  // Get contact's deals
  const getContactDeals = (contactId: string) => {
    return crmDeals.filter(d => d.contact_id === contactId);
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

  // Stats
  const lprCount = crmContacts.filter(c => c.is_decision_maker).length;
  const totalContacts = crmContacts.length;

  // Reset contact form
  const resetContactForm = () => {
    setContactForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      is_decision_maker: false,
      crm_company_id: ''
    });
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
      is_decision_maker: contact.is_decision_maker,
      crm_company_id: contact.crm_company_id || ''
    });
    setIsEditingContact(false);
  };

  // Open add contact modal
  const openAddContactModal = () => {
    resetContactForm();
    setShowAddContactModal(true);
  };

  // Handle add contact
  const handleAddContact = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .insert([{
          first_name: contactForm.first_name,
          last_name: contactForm.last_name,
          email: contactForm.email || null,
          phone: contactForm.phone || null,
          position: contactForm.position || null,
          is_decision_maker: contactForm.is_decision_maker,
          crm_company_id: contactForm.crm_company_id || null,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmContacts: [data, ...prev.crmContacts]
      }));

      setShowAddContactModal(false);
      resetContactForm();
    } catch (error) {
      console.error('Error adding contact:', error);
      alert('Błąd podczas dodawania kontaktu');
    }
  };

  // Handle update contact
  const handleUpdateContact = async () => {
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
          is_decision_maker: contactForm.is_decision_maker,
          crm_company_id: contactForm.crm_company_id || null
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

  // Handle delete contact
  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć kontakt "${selectedContact.first_name} ${selectedContact.last_name}"?`)) return;

    try {
      const { error } = await supabase.from('crm_contacts').delete().eq('id', selectedContact.id);
      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmContacts: prev.crmContacts.filter(c => c.id !== selectedContact.id)
      }));
      setSelectedContact(null);
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Błąd podczas usuwania kontaktu');
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

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kontakty</h1>
          <p className="text-slate-500 mt-1">
            Baza kontaktów i osób decyzyjnych (LPR) — {totalContacts} kontaktów, w tym {lprCount} LPR
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj kontaktów..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie firmy</option>
            {crmCompanies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <select
            value={lprFilter}
            onChange={(e) => setLprFilter(e.target.value as 'all' | 'lpr' | 'other')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszyscy</option>
            <option value="lpr">Tylko LPR</option>
            <option value="other">Pozostali</option>
          </select>
          <button
            onClick={openAddContactModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj kontakt
          </button>
        </div>
      </div>

      {filteredContacts.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kontakt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Firma</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stanowisko</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kontakt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.map(contact => {
                const company = getCompany(contact.crm_company_id);
                const deals = getContactDeals(contact.id);
                return (
                  <tr
                    key={contact.id}
                    onClick={() => openContactProfile(contact)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${contact.is_decision_maker ? 'bg-amber-100' : 'bg-slate-100'}`}>
                          {contact.is_decision_maker ? (
                            <Star className="w-5 h-5 text-amber-600" />
                          ) : (
                            <User className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{contact.first_name} {contact.last_name}</p>
                          {contact.is_decision_maker && (
                            <span className="text-xs text-amber-600 font-medium">LPR</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {company ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-700">{company.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {contact.position ? (
                        <p className="text-slate-700">{contact.position}</p>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {contact.email && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[180px]">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Phone className="w-3 h-3" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        contact.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {contact.status === 'active' ? 'Aktywny' : 'Nieaktywny'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {deals.length > 0 ? (
                        <span className="text-blue-600 font-medium">{deals.length} deal{deals.length > 1 ? 'i' : ''}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {crmContacts.length === 0 ? 'Brak kontaktów w bazie' : 'Brak kontaktów spełniających kryteria'}
          </p>
          {crmContacts.length === 0 && (
            <button
              onClick={openAddContactModal}
              className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Dodaj pierwszy kontakt
            </button>
          )}
        </div>
      )}

      {/* Contact Profile Modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedContact.is_decision_maker ? 'bg-amber-100' : 'bg-slate-100'}`}>
                  {selectedContact.is_decision_maker ? (
                    <Star className="w-6 h-6 text-amber-600" />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedContact.first_name} {selectedContact.last_name}
                  </h3>
                  {selectedContact.is_decision_maker && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <Star className="w-3 h-3" /> Osoba decyzyjna (LPR)
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setSelectedContact(null); setIsEditingContact(false); }}
                className="text-slate-400 hover:text-slate-600"
              >
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
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="+48 XXX XXX XXX"
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                    <select
                      value={contactForm.crm_company_id}
                      onChange={(e) => setContactForm(prev => ({ ...prev, crm_company_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Brak przypisanej firmy</option>
                      {crmCompanies.map(company => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
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
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditingContact(false)}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateContact}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Zapisz
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="space-y-4">
                  {/* Company */}
                  {selectedContact.crm_company_id && (
                    <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Firma</p>
                        <p className="font-medium text-slate-900">
                          {getCompany(selectedContact.crm_company_id)?.name || '—'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Position */}
                  {selectedContact.position && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Briefcase className="w-5 h-5 text-slate-400" />
                      <p className="font-medium text-slate-900">{selectedContact.position}</p>
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
                        type="button"
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
                                type="button"
                                onClick={() => navigate('/sales/pipeline')}
                                className="p-2 text-slate-500 hover:bg-blue-100 rounded-lg transition"
                                title="Przejdź do deala"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
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
                      type="button"
                      onClick={() => setIsEditingContact(true)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedContact(null); setIsEditingContact(false); }}
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

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Dodaj kontakt</h3>
              <button onClick={() => { setShowAddContactModal(false); resetContactForm(); }} className="text-slate-400 hover:text-slate-600">
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
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+48 XXX XXX XXX"
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                  <select
                    value={contactForm.crm_company_id}
                    onChange={(e) => setContactForm(prev => ({ ...prev, crm_company_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Brak przypisanej firmy</option>
                    {crmCompanies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="add_is_decision_maker"
                    checked={contactForm.is_decision_maker}
                    onChange={(e) => setContactForm(prev => ({ ...prev, is_decision_maker: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="add_is_decision_maker" className="text-sm text-slate-700">
                    Osoba decyzyjna (LPR)
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowAddContactModal(false); resetContactForm(); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleAddContact}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!contactForm.first_name || !contactForm.last_name}
                >
                  Dodaj
                </button>
              </div>
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
                type="button"
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
                      type="button"
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
