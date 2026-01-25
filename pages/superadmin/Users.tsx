
import React, { useState, useMemo } from 'react';
import { Search, Filter, Users, Building2, UserPlus, Edit2, Trash2, Lock, Unlock, Eye, X, ChevronDown, Save, Loader2, EyeOff, Plus } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { User, Role, UserStatus, Company } from '../../types';
import { ROLE_LABELS, COMPANY_STATUS_COLORS } from '../../constants';
import { supabase, SUPABASE_ANON_KEY } from '../../lib/supabase';
import { Button } from '../../components/Button';

const STATUS_LABELS: Record<string, string> = {
  [UserStatus.ACTIVE]: 'Aktywny',
  [UserStatus.INACTIVE]: 'Nieaktywny',
  [UserStatus.TRIAL]: 'Okres próbny',
  [UserStatus.INVITED]: 'Zaproszony',
  [UserStatus.STARTED]: 'Rozpoczęty',
  [UserStatus.TESTS_IN_PROGRESS]: 'Testy w toku',
  [UserStatus.TESTS_COMPLETED]: 'Testy zakończone',
  [UserStatus.INTERESTED]: 'Zainteresowany',
  [UserStatus.NOT_INTERESTED]: 'Niezainteresowany',
  [UserStatus.REJECTED]: 'Odrzucony',
  [UserStatus.OFFER_SENT]: 'Oferta wysłana',
  [UserStatus.DATA_REQUESTED]: 'Dane wymagane',
  [UserStatus.DATA_SUBMITTED]: 'Dane przesłane',
  [UserStatus.PORTAL_BLOCKED]: 'Portal zablokowany'
};

const STATUS_COLORS: Record<string, string> = {
  [UserStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [UserStatus.INACTIVE]: 'bg-red-100 text-red-800',
  [UserStatus.TRIAL]: 'bg-blue-100 text-blue-800',
  [UserStatus.INVITED]: 'bg-yellow-100 text-yellow-800',
  [UserStatus.STARTED]: 'bg-purple-100 text-purple-800',
  [UserStatus.TESTS_IN_PROGRESS]: 'bg-orange-100 text-orange-800',
  [UserStatus.TESTS_COMPLETED]: 'bg-teal-100 text-teal-800',
};

// Available roles for selection
const AVAILABLE_ROLES = [
  { value: Role.SUPERADMIN, label: 'Super Admin' },
  { value: Role.COMPANY_ADMIN, label: 'Admin Firmy' },
  { value: Role.SALES, label: 'Sprzedawca' },
  { value: Role.DORADCA, label: 'Doradca' },
  { value: Role.HR, label: 'HR' },
  { value: Role.COORDINATOR, label: 'Koordynator' },
  { value: Role.BRIGADIR, label: 'Brygadzista' },
  { value: Role.EMPLOYEE, label: 'Pracownik' },
  { value: Role.CANDIDATE, label: 'Kandydat' },
  { value: Role.ADMIN, label: 'Admin (Tech)' },
];

interface UserFormData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone: string;
  role: Role;
  company_id: string;
  is_global_user: boolean;
  status: UserStatus;
}

const INITIAL_FORM_DATA: UserFormData = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  phone: '',
  role: Role.EMPLOYEE,
  company_id: '',
  is_global_user: false,
  status: UserStatus.ACTIVE
};

export const SuperAdminUsersPage: React.FC = () => {
  const { state, blockUser, unblockUser, deleteUserCompletely, updateUserWithPassword, refreshData } = useAppContext();
  const { users, companies } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Add/Edit User Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState<UserFormData>(INITIAL_FORM_DATA);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  // Get company name by id
  const getCompanyName = (companyId?: string): string => {
    if (!companyId) return 'Globalny';
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Nieznana';
  };

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        user.first_name?.toLowerCase().includes(searchLower) ||
        user.last_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower);

      // Company filter
      const matchesCompany = selectedCompany === 'all' ||
        (selectedCompany === 'global' ? !user.company_id : user.company_id === selectedCompany);

      // Role filter
      const matchesRole = selectedRole === 'all' || user.role === selectedRole;

      // Status filter
      const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;

      return matchesSearch && matchesCompany && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, selectedCompany, selectedRole, selectedStatus]);

  // Stats
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === UserStatus.ACTIVE).length,
    blocked: users.filter(u => u.is_blocked).length,
    global: users.filter(u => u.is_global_user).length
  }), [users]);

  // Unique roles from users
  const availableRoles = useMemo(() => {
    const roles = new Set(users.map(u => u.role));
    return Array.from(roles);
  }, [users]);

  // Handle block user
  const handleBlock = async () => {
    if (selectedUser) {
      await blockUser(selectedUser.id, blockReason);
      setShowBlockModal(false);
      setBlockReason('');
      setSelectedUser(null);
    }
  };

  // Handle unblock user
  const handleUnblock = async (user: User) => {
    await unblockUser(user.id);
  };

  // Handle delete user
  const handleDelete = async (user: User) => {
    if (window.confirm(`Czy na pewno chcesz usunąć użytkownika ${user.first_name} ${user.last_name}? Ta operacja jest nieodwracalna.`)) {
      await deleteUserCompletely(user.id);
    }
  };

  // Open Add User Modal
  const openAddModal = () => {
    setFormData(INITIAL_FORM_DATA);
    setShowPassword(false);
    setFormError(null);
    setShowNewCompanyInput(false);
    setNewCompanyName('');
    setShowAddModal(true);
  };

  // Open Edit User Modal
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      password: '', // Don't show existing password
      phone: user.phone || '',
      role: user.role,
      company_id: user.company_id || '',
      is_global_user: user.is_global_user || false,
      status: user.status
    });
    setShowPassword(false);
    setFormError(null);
    setShowNewCompanyInput(false);
    setNewCompanyName('');
    setShowEditModal(true);
  };

  // Handle Add User Submit
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      // Validate
      if (!formData.first_name || !formData.last_name || !formData.email) {
        throw new Error('Imię, nazwisko i email są wymagane');
      }
      if (!formData.password || formData.password.length < 6) {
        throw new Error('Hasło musi mieć co najmniej 6 znaków');
      }

      let companyId = formData.company_id;

      // Create new company if needed
      if (showNewCompanyInput && newCompanyName) {
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert([{
            name: newCompanyName,
            status: 'trial',
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          }])
          .select()
          .single();

        if (companyError) throw companyError;
        companyId = newCompany.id;
      }

      // Get session for Edge Function call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Brak aktywnej sesji');
      }

      // Call Edge Function to create user with auth
      const supabaseUrl = 'https://diytvuczpciikzdhldny.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone || null,
          role: formData.role,
          status: formData.status,
          company_id: companyId || null,
          is_global_user: formData.is_global_user
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Błąd podczas tworzenia użytkownika');
      }

      await refreshData();
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding user:', err);
      setFormError(err instanceof Error ? err.message : 'Błąd podczas dodawania użytkownika');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit User Submit
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      // Validate
      if (!formData.first_name || !formData.last_name || !formData.email) {
        throw new Error('Imię, nazwisko i email są wymagane');
      }

      let companyId = formData.company_id;

      // Create new company if needed
      if (showNewCompanyInput && newCompanyName) {
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert([{
            name: newCompanyName,
            status: 'trial',
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          }])
          .select()
          .single();

        if (companyError) throw companyError;
        companyId = newCompany.id;
      }

      // Update user in database
      const updateData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role,
        status: formData.status,
        company_id: companyId || null,
        is_global_user: formData.is_global_user
      };

      // If password is provided, update it too
      if (formData.password && formData.password.length >= 6) {
        await updateUserWithPassword(selectedUser.id, updateData, formData.password);
      } else {
        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', selectedUser.id);

        if (error) throw error;
      }

      await refreshData();
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (err) {
      console.error('Error editing user:', err);
      setFormError(err instanceof Error ? err.message : 'Błąd podczas edycji użytkownika');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate random password
  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
    setShowPassword(true);
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zarządzanie Użytkownikami</h1>
          <p className="text-slate-500 mt-1">Wszyscy użytkownicy platformy</p>
        </div>
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Dodaj użytkownika
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Wszystkich</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
              <p className="text-xs text-slate-500">Aktywnych</p>
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
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.global}</p>
              <p className="text-xs text-slate-500">Globalnych</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj po imieniu, nazwisku lub email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span>Filtry</span>
            <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
            {/* Company Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Wszystkie firmy</option>
                <option value="global">Użytkownicy globalni</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rola</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Wszystkie role</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Wszystkie statusy</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Użytkownik</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Firma</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rola</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className={`hover:bg-slate-50 ${user.is_blocked ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                        user.is_global_user ? 'bg-purple-500' : 'bg-blue-500'
                      }`}>
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                        {user.is_global_user && (
                          <span className="text-xs text-purple-600 font-medium">Użytkownik globalny</span>
                        )}
                        {user.is_blocked && (
                          <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Zablokowany
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-600">{getCompanyName(user.company_id)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[user.status] || 'bg-slate-100 text-slate-800'
                    }`}>
                      {STATUS_LABELS[user.status] || user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-600">{user.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setSelectedUser(user); setShowUserModal(true); }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Podgląd"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Edytuj"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {user.is_blocked ? (
                        <button
                          onClick={() => handleUnblock(user)}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="Odblokuj"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSelectedUser(user); setShowBlockModal(true); }}
                          className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                          title="Zablokuj"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Usuń"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nie znaleziono użytkowników</p>
          </div>
        )}
      </div>

      {/* Block Modal */}
      {showBlockModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Zablokuj użytkownika</h3>
              <button onClick={() => setShowBlockModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 mb-4">
              Czy na pewno chcesz zablokować użytkownika <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>?
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

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Szczegóły użytkownika</h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold ${
                  selectedUser.is_global_user ? 'bg-purple-500' : 'bg-blue-500'
                }`}>
                  {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900">{selectedUser.first_name} {selectedUser.last_name}</h4>
                  <p className="text-slate-500">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Firma</p>
                  <p className="font-medium text-slate-900">{getCompanyName(selectedUser.company_id)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Rola</p>
                  <p className="font-medium text-slate-900">{ROLE_LABELS[selectedUser.role] || selectedUser.role}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Status</p>
                  <p className="font-medium text-slate-900">{STATUS_LABELS[selectedUser.status] || selectedUser.status}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Telefon</p>
                  <p className="font-medium text-slate-900">{selectedUser.phone || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Data zatrudnienia</p>
                  <p className="font-medium text-slate-900">
                    {selectedUser.hired_date ? new Date(selectedUser.hired_date).toLocaleDateString('pl-PL') : '-'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Globalny użytkownik</p>
                  <p className="font-medium text-slate-900">{selectedUser.is_global_user ? 'Tak' : 'Nie'}</p>
                </div>
              </div>

              {selectedUser.is_blocked && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Użytkownik zablokowany</p>
                  {selectedUser.blocked_reason && (
                    <p className="text-sm text-red-600">Powód: {selectedUser.blocked_reason}</p>
                  )}
                  {selectedUser.blocked_at && (
                    <p className="text-xs text-red-500 mt-1">
                      Data: {new Date(selectedUser.blocked_at).toLocaleString('pl-PL')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Dodaj nowego użytkownika
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {formError}
                </div>
              )}

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hasło *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Min. 6 znaków"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 whitespace-nowrap"
                  >
                    Generuj
                  </button>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="+48 XXX XXX XXX"
                />
              </div>

              {/* Role & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rola *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as Role }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {AVAILABLE_ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as UserStatus }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value={UserStatus.ACTIVE}>Aktywny</option>
                    <option value={UserStatus.INACTIVE}>Nieaktywny</option>
                    <option value={UserStatus.TRIAL}>Okres próbny</option>
                    <option value={UserStatus.INVITED}>Zaproszony</option>
                  </select>
                </div>
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                {!showNewCompanyInput ? (
                  <div className="flex gap-2">
                    <select
                      value={formData.company_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_id: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">-- Użytkownik globalny --</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCompanyInput(true)}
                      className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nowa
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Nazwa nowej firmy"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { setShowNewCompanyInput(false); setNewCompanyName(''); }}
                      className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                    >
                      Anuluj
                    </button>
                  </div>
                )}
              </div>

              {/* Global user checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_global_user"
                  checked={formData.is_global_user}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_global_user: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_global_user" className="text-sm text-slate-700">
                  Użytkownik globalny (dostęp do wszystkich firm)
                </label>
              </div>

              {/* Submit buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Utwórz użytkownika
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-green-600" />
                Edytuj użytkownika
              </h3>
              <button onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {formError}
                </div>
              )}

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Password (optional for edit) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nowe hasło <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      minLength={6}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Pozostaw puste, aby nie zmieniać"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 whitespace-nowrap"
                  >
                    Generuj
                  </button>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="+48 XXX XXX XXX"
                />
              </div>

              {/* Role & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rola *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as Role }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {AVAILABLE_ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as UserStatus }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                {!showNewCompanyInput ? (
                  <div className="flex gap-2">
                    <select
                      value={formData.company_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_id: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">-- Użytkownik globalny --</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCompanyInput(true)}
                      className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nowa
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Nazwa nowej firmy"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { setShowNewCompanyInput(false); setNewCompanyName(''); }}
                      className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                    >
                      Anuluj
                    </button>
                  </div>
                )}
              </div>

              {/* Global user checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_global_user_edit"
                  checked={formData.is_global_user}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_global_user: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_global_user_edit" className="text-sm text-slate-700">
                  Użytkownik globalny (dostęp do wszystkich firm)
                </label>
              </div>

              {/* Submit buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Zapisz zmiany
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
