
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, X, Search, Pencil, Trash2, Archive, ArchiveRestore, Loader2,
  Building2, Mail, Phone, MapPin, FileText, FolderKanban, ChevronRight,
  Users
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { ProjectCustomer, Project } from '../../types';
import { SectionTabs } from '../../components/SectionTabs';

const emptyCustomerForm = {
  name: '', email: '', phone: '', address: '', note: '',
};

export const CompanyCustomersPage: React.FC = () => {
  const { state, setState } = useAppContext();
  const { currentUser } = state;

  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ProjectCustomer | null>(null);
  const [form, setForm] = useState(emptyCustomerForm);
  const [saving, setSaving] = useState(false);

  // Customer detail (associated projects)
  const [selectedCustomer, setSelectedCustomer] = useState<ProjectCustomer | null>(null);
  const [customerProjects, setCustomerProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [custRes, projRes] = await Promise.all([
        supabase
          .from('project_customers')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('*')
          .eq('company_id', currentUser.company_id),
      ]);
      if (custRes.data) setCustomers(custRes.data);
      if (projRes.data) setProjects(projRes.data);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const getProjectCount = (customerId: string) => {
    return projects.filter(p => p.customer_id === customerId).length;
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm(emptyCustomerForm);
    setShowModal(true);
  };

  const openEditModal = (customer: ProjectCustomer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      note: customer.note || '',
    });
    setShowModal(true);
  };

  const saveCustomer = async () => {
    if (!currentUser || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        company_id: currentUser.company_id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        note: form.note.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingCustomer) {
        const { data, error } = await supabase
          .from('project_customers')
          .update(payload)
          .eq('id', editingCustomer.id)
          .select()
          .single();
        if (!error && data) {
          setCustomers(prev => prev.map(c => c.id === data.id ? data : c));
          setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Klient został zaktualizowany' } }));
        }
      } else {
        payload.is_archived = false;
        const { data, error } = await supabase
          .from('project_customers')
          .insert(payload)
          .select()
          .single();
        if (!error && data) {
          setCustomers(prev => [data, ...prev]);
          setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Klient został dodany' } }));
        }
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error saving customer:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async (customerId: string) => {
    const projectCount = getProjectCount(customerId);
    if (projectCount > 0) {
      alert(`Nie można usunąć klienta, ponieważ jest przypisany do ${projectCount} projektów. Najpierw usuń powiązania.`);
      return;
    }
    if (!confirm('Czy na pewno chcesz usunąć tego klienta?')) return;
    const { error } = await supabase.from('project_customers').delete().eq('id', customerId);
    if (!error) {
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setState(prev => ({ ...prev, toast: { title: 'Sukces', message: 'Klient został usunięty' } }));
    }
  };

  const toggleArchive = async (customer: ProjectCustomer) => {
    const newArchived = !customer.is_archived;
    const { error } = await supabase
      .from('project_customers')
      .update({ is_archived: newArchived, updated_at: new Date().toISOString() })
      .eq('id', customer.id);
    if (!error) {
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, is_archived: newArchived } : c));
      setState(prev => ({
        ...prev,
        toast: {
          title: 'Sukces',
          message: newArchived ? 'Klient został zarchiwizowany' : 'Klient został przywrócony',
        },
      }));
    }
  };

  const openCustomerDetail = (customer: ProjectCustomer) => {
    setSelectedCustomer(customer);
    setCustomerProjects(projects.filter(p => p.customer_id === customer.id));
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (!showArchived && c.is_archived) return false;
      if (showArchived && !c.is_archived) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !c.name.toLowerCase().includes(s) &&
          !(c.email || '').toLowerCase().includes(s) &&
          !(c.phone || '').toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [customers, search, showArchived]);

  if (!currentUser) return null;

  // ========== CUSTOMER DETAIL VIEW ==========
  if (selectedCustomer) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setSelectedCustomer(null)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h1>
            <p className="text-sm text-gray-500">{selectedCustomer.is_archived ? 'Zarchiwizowany' : 'Aktywny'}</p>
          </div>
        </div>

        {/* Customer info card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Dane klienta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedCustomer.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{selectedCustomer.email}</span>
              </div>
            )}
            {selectedCustomer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{selectedCustomer.phone}</span>
              </div>
            )}
            {selectedCustomer.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{selectedCustomer.address}</span>
              </div>
            )}
            {selectedCustomer.note && (
              <div className="flex items-start gap-2 col-span-full">
                <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="text-sm text-gray-700 whitespace-pre-wrap">{selectedCustomer.note}</span>
              </div>
            )}
          </div>
        </div>

        {/* Associated Projects */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Powiązane projekty ({customerProjects.length})
          </h3>
          {customerProjects.length > 0 ? (
            <div className="space-y-2">
              {customerProjects.map(project => (
                <div key={project.id} className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || '#3B82F6' }} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{project.name}</p>
                      <p className="text-xs text-gray-500">
                        {project.status === 'active' ? 'Aktywny' : project.status === 'completed' ? 'Zakończony' : project.status === 'on_hold' ? 'Wstrzymany' : 'Zarchiwizowany'}
                        {project.end_date && ` | Termin: ${new Date(project.end_date).toLocaleDateString('pl-PL')}`}
                      </p>
                    </div>
                  </div>
                  {project.budget_amount && (
                    <span className="text-sm text-gray-600">{project.budget_amount.toLocaleString('pl-PL')} PLN</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Brak powiązanych projektów</p>
          )}
        </div>
      </div>
    );
  }

  // ========== CUSTOMER LIST VIEW ==========
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <SectionTabs section="projekty" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klienci projektowi</h1>
          <p className="text-sm text-gray-500 mt-1">
            {customers.filter(c => !c.is_archived).length} aktywnych klientów
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nowy klient
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj klientów..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!showArchived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Aktywni
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${showArchived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Zarchiwizowani
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nazwa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Telefon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ilość projektów</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr
                  key={customer.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openCustomerDetail(customer)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{customer.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{customer.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <FolderKanban className="w-3.5 h-3.5 text-gray-400" />
                      {getProjectCount(customer.id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditModal(customer)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="Edytuj"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleArchive(customer)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600"
                        title={customer.is_archived ? 'Przywróć' : 'Archiwizuj'}
                      >
                        {customer.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteCustomer(customer.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        title="Usuń"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    {search ? 'Brak wyników wyszukiwania' : showArchived ? 'Brak zarchiwizowanych klientów' : 'Brak klientów. Dodaj pierwszego klienta.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCustomer ? 'Edytuj klienta' : 'Nowy klient'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nazwa *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Nazwa klienta"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="email@firma.pl"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Telefon</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="+48 123 456 789"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Adres</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="ul. Przykładowa 1, 00-001 Warszawa"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Notatka</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Dodatkowe informacje o kliencie..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={saveCustomer}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingCustomer ? 'Zapisz zmiany' : 'Dodaj klienta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
