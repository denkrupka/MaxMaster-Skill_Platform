
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, X, Search, Pencil, Trash2, Loader2, Handshake,
  Building2, Users, Phone, Mail, FileText, UserPlus, ChevronRight,
  Check, ChevronDown
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  ContractorClient, ContractorClientContact,
  ContractorSubcontractor, SubcontractorWorker,
  SkillCategory
} from '../../types';

// ============================================================
// SKILL OPTIONS for subcontractors
// ============================================================

const SUBCONTRACTOR_SKILL_OPTIONS = Object.values(SkillCategory).map(val => ({
  value: val,
  label: val,
}));

// ============================================================
// EMPTY FORMS
// ============================================================

const emptyClientForm = {
  name: '', nip: '', address_street: '', address_city: '',
  address_postal_code: '', address_country: 'PL', email: '', phone: '', note: '',
};

const emptyContactForm = {
  first_name: '', last_name: '', phone: '', email: '', position: '',
};

const emptySubcontractorForm = {
  name: '', workers_count: 0, email: '', phone: '', skills: '' as string,
};

const emptyWorkerForm = {
  first_name: '', last_name: '', phone: '', email: '', position: '',
};

// ============================================================
// MAIN PAGE
// ============================================================

export const ContractorsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [activeMainTab, setActiveMainTab] = useState<'clients' | 'subcontractors'>('clients');
  const [loading, setLoading] = useState(true);

  // --- Clients state ---
  const [clients, setClients] = useState<ContractorClient[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ContractorClient | null>(null);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [savingClient, setSavingClient] = useState(false);

  // Client detail modal
  const [selectedClient, setSelectedClient] = useState<ContractorClient | null>(null);
  const [clientDetailTab, setClientDetailTab] = useState<'dane' | 'kontakty' | 'notatka'>('dane');
  const [clientContacts, setClientContacts] = useState<ContractorClientContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [savingContact, setSavingContact] = useState(false);

  // --- Subcontractors state ---
  const [subcontractors, setSubcontractors] = useState<ContractorSubcontractor[]>([]);
  const [subSearch, setSubSearch] = useState('');
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<ContractorSubcontractor | null>(null);
  const [subForm, setSubForm] = useState(emptySubcontractorForm);
  const [savingSub, setSavingSub] = useState(false);

  // Subcontractor detail modal
  const [selectedSub, setSelectedSub] = useState<ContractorSubcontractor | null>(null);
  const [subWorkers, setSubWorkers] = useState<SubcontractorWorker[]>([]);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [workerForm, setWorkerForm] = useState(emptyWorkerForm);
  const [savingWorker, setSavingWorker] = useState(false);

  // Skills dropdown
  const [showSkillsDropdown, setShowSkillsDropdown] = useState(false);
  const skillsDropdownRef = useRef<HTMLDivElement>(null);

  // Close skills dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (skillsDropdownRef.current && !skillsDropdownRef.current.contains(e.target as Node)) {
        setShowSkillsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helpers for skills multi-select (comma-separated string)
  const getSelectedSkills = (): string[] => {
    if (!subForm.skills) return [];
    return subForm.skills.split(',').map(s => s.trim()).filter(Boolean);
  };

  const toggleSkill = (skill: string) => {
    const current = getSelectedSkills();
    const updated = current.includes(skill)
      ? current.filter(s => s !== skill)
      : [...current, skill];
    setSubForm({ ...subForm, skills: updated.join(', ') });
  };

  // ============================================================
  // DATA LOADING
  // ============================================================

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [clientsRes, subsRes] = await Promise.all([
        supabase.from('contractors_clients').select('*').eq('company_id', currentUser.company_id).eq('is_archived', false).order('name'),
        supabase.from('contractors_subcontractors').select('*').eq('company_id', currentUser.company_id).eq('is_archived', false).order('name'),
      ]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (subsRes.data) setSubcontractors(subsRes.data);
    } catch (err) {
      console.error('Error loading contractors:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadClientContacts = async (clientId: string) => {
    const { data } = await supabase.from('contractor_client_contacts').select('*').eq('client_id', clientId).order('last_name');
    if (data) setClientContacts(data);
  };

  const loadSubWorkers = async (subId: string) => {
    const { data } = await supabase.from('subcontractor_workers').select('*').eq('subcontractor_id', subId).order('last_name');
    if (data) setSubWorkers(data);
  };

  // ============================================================
  // CLIENT CRUD
  // ============================================================

  const openCreateClient = () => {
    setEditingClient(null);
    setClientForm(emptyClientForm);
    setShowClientModal(true);
  };

  const openEditClient = (client: ContractorClient) => {
    setEditingClient(client);
    setClientForm({
      name: client.name, nip: client.nip || '', address_street: client.address_street || '',
      address_city: client.address_city || '', address_postal_code: client.address_postal_code || '',
      address_country: client.address_country || 'PL', email: client.email || '',
      phone: client.phone || '', note: client.note || '',
    });
    setShowClientModal(true);
  };

  const saveClient = async () => {
    if (!currentUser || !clientForm.name.trim()) return;
    setSavingClient(true);
    try {
      const payload = { ...clientForm, company_id: currentUser.company_id, updated_at: new Date().toISOString() };
      if (editingClient) {
        const { data } = await supabase.from('contractors_clients').update(payload).eq('id', editingClient.id).select().single();
        if (data) setClients(prev => prev.map(c => c.id === data.id ? data : c));
      } else {
        const { data } = await supabase.from('contractors_clients').insert(payload).select().single();
        if (data) setClients(prev => [data, ...prev]);
      }
      setShowClientModal(false);
    } catch (err) {
      console.error('Error saving client:', err);
    } finally {
      setSavingClient(false);
    }
  };

  const deleteClient = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego klienta?')) return;
    await supabase.from('contractors_clients').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
    setClients(prev => prev.filter(c => c.id !== id));
  };

  const openClientDetail = (client: ContractorClient) => {
    setSelectedClient(client);
    setClientDetailTab('dane');
    loadClientContacts(client.id);
  };

  // ============================================================
  // CLIENT CONTACTS CRUD
  // ============================================================

  const saveContact = async () => {
    if (!currentUser || !selectedClient || !contactForm.first_name.trim() || !contactForm.last_name.trim()) return;
    setSavingContact(true);
    try {
      const payload = { ...contactForm, client_id: selectedClient.id, company_id: currentUser.company_id };
      const { data } = await supabase.from('contractor_client_contacts').insert(payload).select().single();
      if (data) setClientContacts(prev => [...prev, data]);
      setContactForm(emptyContactForm);
      setShowAddContact(false);
    } catch (err) {
      console.error('Error saving contact:', err);
    } finally {
      setSavingContact(false);
    }
  };

  const deleteContact = async (id: string) => {
    await supabase.from('contractor_client_contacts').delete().eq('id', id);
    setClientContacts(prev => prev.filter(c => c.id !== id));
  };

  // Save client note inline
  const saveClientNote = async (note: string) => {
    if (!selectedClient) return;
    await supabase.from('contractors_clients').update({ note, updated_at: new Date().toISOString() }).eq('id', selectedClient.id);
    setSelectedClient({ ...selectedClient, note });
    setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, note } : c));
  };

  // ============================================================
  // SUBCONTRACTOR CRUD
  // ============================================================

  const openCreateSub = () => {
    setEditingSub(null);
    setSubForm(emptySubcontractorForm);
    setShowSubModal(true);
  };

  const openEditSub = (sub: ContractorSubcontractor) => {
    setEditingSub(sub);
    setSubForm({
      name: sub.name, workers_count: sub.workers_count || 0,
      email: sub.email || '', phone: sub.phone || '', skills: sub.skills || '',
    });
    setShowSubModal(true);
  };

  const saveSub = async () => {
    if (!currentUser || !subForm.name.trim()) return;
    setSavingSub(true);
    try {
      const payload = { ...subForm, company_id: currentUser.company_id, updated_at: new Date().toISOString() };
      if (editingSub) {
        const { data } = await supabase.from('contractors_subcontractors').update(payload).eq('id', editingSub.id).select().single();
        if (data) setSubcontractors(prev => prev.map(s => s.id === data.id ? data : s));
      } else {
        const { data } = await supabase.from('contractors_subcontractors').insert(payload).select().single();
        if (data) setSubcontractors(prev => [data, ...prev]);
      }
      setShowSubModal(false);
    } catch (err) {
      console.error('Error saving subcontractor:', err);
    } finally {
      setSavingSub(false);
    }
  };

  const deleteSub = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego podwykonawcę?')) return;
    await supabase.from('contractors_subcontractors').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
    setSubcontractors(prev => prev.filter(s => s.id !== id));
  };

  const openSubDetail = (sub: ContractorSubcontractor) => {
    setSelectedSub(sub);
    loadSubWorkers(sub.id);
  };

  // ============================================================
  // SUBCONTRACTOR WORKERS CRUD
  // ============================================================

  const saveWorker = async () => {
    if (!currentUser || !selectedSub || !workerForm.first_name.trim() || !workerForm.last_name.trim()) return;
    setSavingWorker(true);
    try {
      const payload = { ...workerForm, subcontractor_id: selectedSub.id, company_id: currentUser.company_id };
      const { data } = await supabase.from('subcontractor_workers').insert(payload).select().single();
      if (data) setSubWorkers(prev => [...prev, data]);
      setWorkerForm(emptyWorkerForm);
      setShowAddWorker(false);
    } catch (err) {
      console.error('Error saving worker:', err);
    } finally {
      setSavingWorker(false);
    }
  };

  const deleteWorker = async (id: string) => {
    await supabase.from('subcontractor_workers').delete().eq('id', id);
    setSubWorkers(prev => prev.filter(w => w.id !== id));
  };

  // ============================================================
  // FILTERED DATA
  // ============================================================

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.nip || '').includes(clientSearch)
  );

  const filteredSubs = subcontractors.filter(s =>
    s.name.toLowerCase().includes(subSearch.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(subSearch.toLowerCase()) ||
    (s.skills || '').toLowerCase().includes(subSearch.toLowerCase())
  );

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setActiveMainTab('clients')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeMainTab === 'clients' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Building2 size={18} />
          <span>Klienci ({clients.length})</span>
        </button>
        <button
          onClick={() => setActiveMainTab('subcontractors')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeMainTab === 'subcontractors' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Users size={18} />
          <span>Podwykonawcy ({subcontractors.length})</span>
        </button>
      </div>

      {/* ============ TAB: KLIENCI ============ */}
      {activeMainTab === 'clients' && (
        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Szukaj klienta..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={openCreateClient} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              <Plus size={18} />
              <span>Dodaj klienta</span>
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Nazwa firmy</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Telefon</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-slate-400">Brak klientów</td></tr>
                ) : filteredClients.map(client => (
                  <tr
                    key={client.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => openClientDetail(client)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <Building2 size={16} className="text-slate-400" />
                        <span className="font-medium text-slate-800">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{client.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{client.phone || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={e => { e.stopPropagation(); openEditClient(client); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteClient(client.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ TAB: PODWYKONAWCY ============ */}
      {activeMainTab === 'subcontractors' && (
        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Szukaj podwykonawcy..."
                value={subSearch}
                onChange={e => setSubSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={openCreateSub} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              <Plus size={18} />
              <span>Dodaj podwykonawcę</span>
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Nazwa firmy</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pracownicy</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Telefon</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Umiejętności</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Brak podwykonawców</td></tr>
                ) : filteredSubs.map(sub => (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => openSubDetail(sub)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <Users size={16} className="text-slate-400" />
                        <span className="font-medium text-slate-800">{sub.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{sub.workers_count || 0}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{sub.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{sub.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[250px]">
                      {sub.skills ? (
                        <div className="flex flex-wrap gap-1">
                          {sub.skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3).map(skill => (
                            <span key={skill} className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{skill}</span>
                          ))}
                          {sub.skills.split(',').filter(s => s.trim()).length > 3 && (
                            <span className="inline-block text-xs text-slate-400">+{sub.skills.split(',').filter(s => s.trim()).length - 3}</span>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={e => { e.stopPropagation(); openEditSub(sub); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteSub(sub.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE/EDIT CLIENT */}
      {/* ============================================================ */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowClientModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-slate-800">{editingClient ? 'Edytuj klienta' : 'Nowy klient'}</h2>
              <button onClick={() => setShowClientModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
                <input type="text" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nazwa firmy" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
                  <input type="text" value={clientForm.nip} onChange={e => setClientForm({ ...clientForm, nip: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="NIP" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kraj</label>
                  <input type="text" value={clientForm.address_country} onChange={e => setClientForm({ ...clientForm, address_country: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="PL" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ulica</label>
                <input type="text" value={clientForm.address_street} onChange={e => setClientForm({ ...clientForm, address_street: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ulica i numer" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Miasto</label>
                  <input type="text" value={clientForm.address_city} onChange={e => setClientForm({ ...clientForm, address_city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Miasto" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kod pocztowy</label>
                  <input type="text" value={clientForm.address_postal_code} onChange={e => setClientForm({ ...clientForm, address_postal_code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="00-000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="email@firma.pl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input type="tel" value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+48 ..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notatka</label>
                <textarea value={clientForm.note} onChange={e => setClientForm({ ...clientForm, note: e.target.value })}
                  rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Notatka wewnętrzna..." />
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t">
              <button onClick={() => setShowClientModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Anuluj</button>
              <button onClick={saveClient} disabled={savingClient || !clientForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2">
                {savingClient && <Loader2 size={16} className="animate-spin" />}
                <span>{editingClient ? 'Zapisz' : 'Dodaj'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CLIENT DETAIL (tabs: dane, kontakty, notatka) */}
      {/* ============================================================ */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedClient(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selectedClient.name}</h2>
                {selectedClient.nip && <p className="text-sm text-slate-500">NIP: {selectedClient.nip}</p>}
              </div>
              <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            {/* Detail tabs */}
            <div className="flex space-x-1 bg-slate-100 mx-6 mt-4 rounded-lg p-1">
              {(['dane', 'kontakty', 'notatka'] as const).map(tab => (
                <button key={tab} onClick={() => setClientDetailTab(tab)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    clientDetailTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {tab === 'dane' ? 'Dane firmy' : tab === 'kontakty' ? 'Osoby kontaktowe' : 'Notatka'}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Tab: Dane firmy */}
              {clientDetailTab === 'dane' && (
                <div className="space-y-3">
                  <InfoRow label="Nazwa" value={selectedClient.name} />
                  <InfoRow label="NIP" value={selectedClient.nip} />
                  <InfoRow label="Ulica" value={selectedClient.address_street} />
                  <InfoRow label="Miasto" value={selectedClient.address_city} />
                  <InfoRow label="Kod pocztowy" value={selectedClient.address_postal_code} />
                  <InfoRow label="Kraj" value={selectedClient.address_country} />
                  <InfoRow label="Email" value={selectedClient.email} />
                  <InfoRow label="Telefon" value={selectedClient.phone} />
                </div>
              )}

              {/* Tab: Osoby kontaktowe */}
              {clientDetailTab === 'kontakty' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-slate-600">{clientContacts.length} osób kontaktowych</span>
                    <button onClick={() => { setContactForm(emptyContactForm); setShowAddContact(true); }}
                      className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      <UserPlus size={16} />
                      <span>Dodaj</span>
                    </button>
                  </div>

                  {showAddContact && (
                    <div className="bg-blue-50 rounded-xl p-4 mb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" value={contactForm.first_name} onChange={e => setContactForm({ ...contactForm, first_name: e.target.value })}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Imię *" />
                        <input type="text" value={contactForm.last_name} onChange={e => setContactForm({ ...contactForm, last_name: e.target.value })}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Nazwisko *" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <input type="tel" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Telefon" />
                        <input type="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Email" />
                        <input type="text" value={contactForm.position} onChange={e => setContactForm({ ...contactForm, position: e.target.value })}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Stanowisko" />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button onClick={() => setShowAddContact(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Anuluj</button>
                        <button onClick={saveContact} disabled={savingContact || !contactForm.first_name.trim() || !contactForm.last_name.trim()}
                          className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center space-x-1">
                          {savingContact && <Loader2 size={14} className="animate-spin" />}
                          <span>Dodaj</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {clientContacts.map(contact => (
                      <div key={contact.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800">{contact.first_name} {contact.last_name}</p>
                          <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
                            {contact.position && <span>{contact.position}</span>}
                            {contact.phone && <span className="flex items-center space-x-1"><Phone size={12} /><span>{contact.phone}</span></span>}
                            {contact.email && <span className="flex items-center space-x-1"><Mail size={12} /><span>{contact.email}</span></span>}
                          </div>
                        </div>
                        <button onClick={() => deleteContact(contact.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {clientContacts.length === 0 && !showAddContact && (
                      <p className="text-center text-sm text-slate-400 py-6">Brak osób kontaktowych</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Notatka */}
              {clientDetailTab === 'notatka' && (
                <div>
                  <textarea
                    defaultValue={selectedClient.note || ''}
                    onBlur={e => saveClientNote(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Wpisz notatki wewnętrzne dotyczące tego klienta..."
                  />
                  <p className="text-xs text-slate-400 mt-1">Notatka zapisuje się automatycznie po opuszczeniu pola.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE/EDIT SUBCONTRACTOR */}
      {/* ============================================================ */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSubModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-slate-800">{editingSub ? 'Edytuj podwykonawcę' : 'Nowy podwykonawca'}</h2>
              <button onClick={() => setShowSubModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
                <input type="text" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nazwa podwykonawcy" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ilość pracowników</label>
                  <input type="number" min={0} value={subForm.workers_count} onChange={e => setSubForm({ ...subForm, workers_count: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input type="tel" value={subForm.phone} onChange={e => setSubForm({ ...subForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+48 ..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={subForm.email} onChange={e => setSubForm({ ...subForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="email@podwykonawca.pl" />
              </div>
              <div ref={skillsDropdownRef}>
                <label className="block text-sm font-medium text-slate-700 mb-1">Umiejętności (zakres działania)</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSkillsDropdown(!showSkillsDropdown)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between bg-white"
                  >
                    <span className={getSelectedSkills().length > 0 ? 'text-slate-800' : 'text-slate-400'}>
                      {getSelectedSkills().length > 0 ? `Wybrano: ${getSelectedSkills().length}` : 'Wybierz zakres...'}
                    </span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${showSkillsDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showSkillsDropdown && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {SUBCONTRACTOR_SKILL_OPTIONS.map(opt => {
                        const selected = getSelectedSkills().includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleSkill(opt.value)}
                            className={`w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-blue-50 transition-colors ${
                              selected ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                            }`}>
                              {selected && <Check size={12} className="text-white" />}
                            </div>
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {getSelectedSkills().length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {getSelectedSkills().map(skill => (
                      <span
                        key={skill}
                        className="inline-flex items-center space-x-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full"
                      >
                        <span>{skill}</span>
                        <button type="button" onClick={() => toggleSkill(skill)} className="hover:text-blue-900">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t">
              <button onClick={() => setShowSubModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Anuluj</button>
              <button onClick={saveSub} disabled={savingSub || !subForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2">
                {savingSub && <Loader2 size={16} className="animate-spin" />}
                <span>{editingSub ? 'Zapisz' : 'Dodaj'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: SUBCONTRACTOR DETAIL (workers) */}
      {/* ============================================================ */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedSub(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selectedSub.name}</h2>
                {selectedSub.email && <p className="text-sm text-slate-500">{selectedSub.email}{selectedSub.phone ? ` · ${selectedSub.phone}` : ''}</p>}
                {selectedSub.skills && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selectedSub.skills.split(',').map(s => s.trim()).filter(Boolean).map(skill => (
                      <span key={skill} className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{skill}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedSub(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Pracownicy ({subWorkers.length})</h3>
                <button onClick={() => { setWorkerForm(emptyWorkerForm); setShowAddWorker(true); }}
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <UserPlus size={16} />
                  <span>Dodaj pracownika</span>
                </button>
              </div>

              {showAddWorker && (
                <div className="bg-blue-50 rounded-xl p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={workerForm.first_name} onChange={e => setWorkerForm({ ...workerForm, first_name: e.target.value })}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Imię *" />
                    <input type="text" value={workerForm.last_name} onChange={e => setWorkerForm({ ...workerForm, last_name: e.target.value })}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Nazwisko *" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <input type="tel" value={workerForm.phone} onChange={e => setWorkerForm({ ...workerForm, phone: e.target.value })}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Telefon" />
                    <input type="email" value={workerForm.email} onChange={e => setWorkerForm({ ...workerForm, email: e.target.value })}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Email" />
                    <input type="text" value={workerForm.position} onChange={e => setWorkerForm({ ...workerForm, position: e.target.value })}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Stanowisko" />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setShowAddWorker(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Anuluj</button>
                    <button onClick={saveWorker} disabled={savingWorker || !workerForm.first_name.trim() || !workerForm.last_name.trim()}
                      className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center space-x-1">
                      {savingWorker && <Loader2 size={14} className="animate-spin" />}
                      <span>Dodaj</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {subWorkers.map(worker => (
                  <div key={worker.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{worker.first_name} {worker.last_name}</p>
                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
                        {worker.position && <span>{worker.position}</span>}
                        {worker.phone && <span className="flex items-center space-x-1"><Phone size={12} /><span>{worker.phone}</span></span>}
                        {worker.email && <span className="flex items-center space-x-1"><Mail size={12} /><span>{worker.email}</span></span>}
                      </div>
                    </div>
                    <button onClick={() => deleteWorker(worker.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {subWorkers.length === 0 && !showAddWorker && (
                  <p className="text-center text-sm text-slate-400 py-6">Brak pracowników</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component
const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex items-start">
    <span className="text-sm font-medium text-slate-500 w-32 shrink-0">{label}</span>
    <span className="text-sm text-slate-800">{value || '—'}</span>
  </div>
);
