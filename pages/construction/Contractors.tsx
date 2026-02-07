import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Building2, User, Phone, Mail, Globe, Pencil, Trash2,
  MoreVertical, Loader2, Filter, ChevronRight, Tag, FileText,
  Truck, HardHat, X, Check
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Contractor, ContractorGroup, ContractorType, ContractorEntityType } from '../../types';
import {
  CONTRACTOR_TYPE_LABELS, CONTRACTOR_TYPE_COLORS, CONTRACTOR_TYPE_ICONS,
  CONTRACTOR_ENTITY_TYPE_LABELS
} from '../../constants';

const ContractorTypeIcon: React.FC<{ type: ContractorType; className?: string }> = ({ type, className = 'w-5 h-5' }) => {
  const icons = { customer: Building2, contractor: HardHat, supplier: Truck };
  const Icon = icons[type] || Building2;
  return <Icon className={className} />;
};

export const ContractorsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, users } = state;

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [groups, setGroups] = useState<ContractorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContractorType | 'all'>('all');
  const [groupFilter, setGroupFilter] = useState<string | 'all'>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    contractor_entity_type: 'legal_entity' as ContractorEntityType,
    contractor_type: 'contractor' as ContractorType,
    group_id: '',
    contact_person: '',
    position: '',
    phone: '',
    email: '',
    website: '',
    nip: '',
    regon: '',
    legal_address: '',
    actual_address: '',
    bank_name: '',
    bank_account: '',
    notes: ''
  });

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [contractorsRes, groupsRes] = await Promise.all([
        supabase
          .from('contractors')
          .select('*, group:contractor_groups(*)')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('contractor_groups')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .order('name')
      ]);

      if (contractorsRes.data) setContractors(contractorsRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
    } catch (err) {
      console.error('Error loading contractors:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredContractors = useMemo(() => {
    return contractors.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.nip?.includes(search);
      const matchesType = typeFilter === 'all' || c.contractor_type === typeFilter;
      const matchesGroup = groupFilter === 'all' || c.group_id === groupFilter;
      return matchesSearch && matchesType && matchesGroup;
    });
  }, [contractors, search, typeFilter, groupFilter]);

  const openCreateModal = () => {
    setEditingContractor(null);
    setFormData({
      name: '', short_name: '',
      contractor_entity_type: 'legal_entity',
      contractor_type: 'contractor',
      group_id: '', contact_person: '', position: '',
      phone: '', email: '', website: '',
      nip: '', regon: '',
      legal_address: '', actual_address: '',
      bank_name: '', bank_account: '', notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (contractor: Contractor) => {
    setEditingContractor(contractor);
    setFormData({
      name: contractor.name,
      short_name: contractor.short_name || '',
      contractor_entity_type: contractor.contractor_entity_type,
      contractor_type: contractor.contractor_type,
      group_id: contractor.group_id || '',
      contact_person: contractor.contact_person || '',
      position: contractor.position || '',
      phone: contractor.phone || '',
      email: contractor.email || '',
      website: contractor.website || '',
      nip: contractor.nip || '',
      regon: contractor.regon || '',
      legal_address: contractor.legal_address || '',
      actual_address: contractor.actual_address || '',
      bank_name: contractor.bank_name || '',
      bank_account: contractor.bank_account || '',
      notes: contractor.notes || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!currentUser || !formData.name.trim()) return;
    setSaving(true);

    try {
      const payload = {
        ...formData,
        company_id: currentUser.company_id,
        group_id: formData.group_id || null,
        created_by_id: editingContractor ? undefined : currentUser.id
      };

      if (editingContractor) {
        const { error } = await supabase
          .from('contractors')
          .update(payload)
          .eq('id', editingContractor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contractors')
          .insert({ ...payload, created_by_id: currentUser.id });
        if (error) throw error;
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      console.error('Error saving contractor:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contractor: Contractor) => {
    if (!confirm('Czy na pewno chcesz usunąć tego kontrahenta?')) return;

    try {
      const { error } = await supabase
        .from('contractors')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', contractor.id);

      if (!error) {
        loadData();
        if (selectedContractor?.id === contractor.id) {
          setSelectedContractor(null);
        }
      }
    } catch (err) {
      console.error('Error deleting contractor:', err);
    }
  };

  const contractorStats = useMemo(() => ({
    total: contractors.length,
    customers: contractors.filter(c => c.contractor_type === 'customer').length,
    contractors: contractors.filter(c => c.contractor_type === 'contractor').length,
    suppliers: contractors.filter(c => c.contractor_type === 'supplier').length
  }), [contractors]);

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kontrahenci</h1>
          <p className="text-slate-600 mt-1">Klienci, podwykonawcy i dostawcy</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Dodaj kontrahenta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Wszyscy</p>
          <p className="text-2xl font-bold text-slate-900">{contractorStats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Klienci</p>
          <p className="text-2xl font-bold text-blue-600">{contractorStats.customers}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Podwykonawcy</p>
          <p className="text-2xl font-bold text-amber-600">{contractorStats.contractors}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Dostawcy</p>
          <p className="text-2xl font-bold text-green-600">{contractorStats.suppliers}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj kontrahenta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as ContractorType | 'all')}
            className="px-4 py-2 border border-slate-200 rounded-lg"
          >
            <option value="all">Wszystkie typy</option>
            <option value="customer">Klienci</option>
            <option value="contractor">Podwykonawcy</option>
            <option value="supplier">Dostawcy</option>
          </select>
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg"
          >
            <option value="all">Wszystkie grupy</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredContractors.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Brak kontrahentów do wyświetlenia</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredContractors.map(contractor => (
              <div
                key={contractor.id}
                className="p-4 hover:bg-slate-50 cursor-pointer transition"
                onClick={() => setSelectedContractor(contractor)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${CONTRACTOR_TYPE_COLORS[contractor.contractor_type]}`}>
                    <ContractorTypeIcon type={contractor.contractor_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900">{contractor.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      {contractor.nip && <span>NIP: {contractor.nip}</span>}
                      {contractor.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contractor.email}
                        </span>
                      )}
                      {contractor.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contractor.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${CONTRACTOR_TYPE_COLORS[contractor.contractor_type]}`}>
                    {CONTRACTOR_TYPE_LABELS[contractor.contractor_type]}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(contractor); }}
                      className="p-2 hover:bg-slate-200 rounded-lg"
                    >
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(contractor); }}
                      className="p-2 hover:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">
                {editingContractor ? 'Edytuj kontrahenta' : 'Nowy kontrahent'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nazwa firmy lub imię i nazwisko"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Typ podmiotu</label>
                  <select
                    value={formData.contractor_entity_type}
                    onChange={e => setFormData({ ...formData, contractor_entity_type: e.target.value as ContractorEntityType })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="legal_entity">Osoba prawna</option>
                    <option value="individual">Osoba fizyczna</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Typ kontrahenta</label>
                  <select
                    value={formData.contractor_type}
                    onChange={e => setFormData({ ...formData, contractor_type: e.target.value as ContractorType })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="customer">Klient / Zamawiający</option>
                    <option value="contractor">Podwykonawca</option>
                    <option value="supplier">Dostawca</option>
                  </select>
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
                  <input
                    type="text"
                    value={formData.nip}
                    onChange={e => setFormData({ ...formData, nip: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                    placeholder="0000000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">REGON</label>
                  <input
                    type="text"
                    value={formData.regon}
                    onChange={e => setFormData({ ...formData, regon: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                <textarea
                  value={formData.legal_address}
                  onChange={e => setFormData({ ...formData, legal_address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg resize-none"
                  rows={2}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notatki</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingContractor ? 'Zapisz zmiany' : 'Dodaj kontrahenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractorsPage;
