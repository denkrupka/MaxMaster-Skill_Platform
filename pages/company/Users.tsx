
import React, { useState, useMemo } from 'react';
import { Search, UserPlus, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { User, Role, UserStatus } from '../../types';
import { ROLE_LABELS, MODULE_LABELS, COMPANY_ROLES } from '../../constants';

const STATUS_LABELS: Record<string, string> = {
  [UserStatus.ACTIVE]: 'Aktywny',
  [UserStatus.INACTIVE]: 'Nieaktywny',
  [UserStatus.TRIAL]: 'Okres próbny',
  [UserStatus.INVITED]: 'Zaproszony',
};

const STATUS_COLORS: Record<string, string> = {
  [UserStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [UserStatus.INACTIVE]: 'bg-red-100 text-red-800',
  [UserStatus.TRIAL]: 'bg-blue-100 text-blue-800',
  [UserStatus.INVITED]: 'bg-yellow-100 text-yellow-800',
};

// Roles available for company admin to assign
const ASSIGNABLE_ROLES = [
  Role.HR,
  Role.COORDINATOR,
  Role.BRIGADIR,
  Role.EMPLOYEE,
];

// Format phone number as +48 XXX XXX XXX
const formatPhone = (val: string): string => {
  let cleaned = val.replace(/\D/g, '');
  if (cleaned.startsWith('48')) cleaned = cleaned.substring(2);
  let limited = cleaned.substring(0, 9);
  let result = '+48 ';
  if (limited.length > 0) result += limited.substring(0, 3);
  if (limited.length > 3) result += ' ' + limited.substring(3, 6);
  if (limited.length > 6) result += ' ' + limited.substring(6, 9);
  return result.trim();
};

export const CompanyUsersPage: React.FC = () => {
  const { state, addUser, updateUser, deleteUserCompletely } = useAppContext();
  const { currentUser, currentCompany, users, companyModules, modules, moduleUserAccess } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: Role.EMPLOYEE as Role
  });

  // Get company users
  const companyUsers = useMemo(() => {
    if (!currentCompany) return [];
    return users.filter(u => u.company_id === currentCompany.id && !u.is_global_user);
  }, [users, currentCompany]);

  // Filter users
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return companyUsers;
    const searchLower = searchTerm.toLowerCase();
    return companyUsers.filter(user =>
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  }, [companyUsers, searchTerm]);

  // Get company modules
  const myModules = useMemo(() => {
    if (!currentCompany) return [];
    return companyModules.filter(cm => cm.company_id === currentCompany.id && cm.is_active);
  }, [companyModules, currentCompany]);

  // Check if can add more users
  const canAddUsers = useMemo(() => {
    const totalSlots = myModules.reduce((sum, m) => sum + m.max_users, 0);
    return companyUsers.length < totalSlots;
  }, [myModules, companyUsers]);

  // Handle form change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const formatted = value ? formatPhone(value) : '';
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };


  // Handle add user
  const handleAddUser = async () => {
    if (!currentCompany) return;

    try {
      await addUser({
        ...formData,
        company_id: currentCompany.id,
        status: UserStatus.ACTIVE,
        hired_date: new Date().toISOString()
      });
      setShowAddModal(false);
      resetForm();
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert(error.message || 'Błąd podczas dodawania użytkownika');
    }
  };

  // Handle edit user
  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      await updateUser(selectedUser.id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        role: formData.role
      });
      setShowEditModal(false);
      setSelectedUser(null);
      resetForm();
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(error.message || 'Błąd podczas aktualizacji użytkownika');
    }
  };

  // Handle delete user
  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('Nie możesz usunąć swojego konta.');
      return;
    }
    if (window.confirm(`Czy na pewno chcesz usunąć użytkownika ${user.first_name} ${user.last_name}?`)) {
      await deleteUserCompletely(user.id);
    }
  };

  // Open edit modal
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone ? formatPhone(user.phone) : '',
      role: user.role
    });
    setShowEditModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: Role.EMPLOYEE
    });
  };

  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <p className="text-yellow-800">Brak przypisanej firmy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Użytkownicy</h1>
          <p className="text-slate-500 mt-1">{currentCompany.name} - {companyUsers.length} użytkowników</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          disabled={!canAddUsers}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            canAddUsers
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-200 text-slate-500 cursor-not-allowed'
          }`}
        >
          <UserPlus className="w-5 h-5" />
          Dodaj użytkownika
        </button>
      </div>

      {/* Limit warning */}
      {!canAddUsers && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <p className="text-yellow-800">
            Osiągnięto limit użytkowników. Zwiększ limit w ustawieniach subskrypcji.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj użytkowników..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Użytkownik</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rola</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                        {user.id === currentUser?.id && (
                          <span className="text-xs text-blue-600 font-medium">To Ty</span>
                        )}
                      </div>
                    </div>
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
                        onClick={() => openEditModal(user)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edytuj"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Usuń"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nie znaleziono użytkowników</p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Dodaj użytkownika</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  placeholder="+48 XXX XXX XXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rola *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {ASSIGNABLE_ROLES.map(role => (
                    <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-slate-500 mt-2">Użytkownik otrzyma email z linkiem do ustawienia własnego hasła.</p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddUser}
                disabled={!formData.first_name || !formData.last_name || !formData.email}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
              >
                Dodaj użytkownika
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Edytuj użytkownika</h3>
              <button onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1">Email nie może być zmieniony</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  placeholder="+48 XXX XXX XXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rola *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={selectedUser.id === currentUser?.id}
                >
                  {ASSIGNABLE_ROLES.map(role => (
                    <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                  ))}
                </select>
                {selectedUser.id === currentUser?.id && (
                  <p className="text-xs text-slate-500 mt-1">Nie możesz zmienić swojej roli</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleEditUser}
                disabled={!formData.first_name || !formData.last_name}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
              >
                Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
