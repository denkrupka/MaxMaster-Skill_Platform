
import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, AlertTriangle, Edit2, Lock, Unlock, Eye, EyeOff, Pencil } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Role, User } from '../../types';
import { ROLE_LABELS } from '../../constants';

export const AdminUsersPage = () => {
  const { state, addUser, deleteUserCompletely, blockUser, unblockUser, updateUserWithPassword } = useAppContext();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ first_name: '', last_name: '', email: '', phone: '', role: Role.EMPLOYEE, password: '' });
  const [validationErrors, setValidationErrors] = useState<{email?: string, phone?: string}>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const formatPhone = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.startsWith('48')) cleaned = cleaned.substring(2);
    let limited = cleaned.substring(0, 9);
    let result = '+48 ';
    if (limited.length > 0) result += limited.substring(0, 3);
    if (limited.length > 3) result += ' ' + limited.substring(3, 6);
    if (limited.length > 6) result += ' ' + limited.substring(6, 9);
    return result.trim();
  };

  useEffect(() => {
    if (!isAddModalOpen) return;
    const newErrors: {email?: string, phone?: string} = {};

    if (newUser.email.length > 3) {
        const exists = state.users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase());
        if (exists) newErrors.email = 'Adres email już istnieje.';
    }

    if (newUser.phone.length > 10) {
        const exists = state.users.some(u => u.phone === newUser.phone);
        if (exists) newErrors.phone = 'Numer telefonu już istnieje.';
    }

    setValidationErrors(newErrors);
  }, [newUser.email, newUser.phone, state.users, isAddModalOpen]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Czy na pewno chcesz całkowicie usunąć tego użytkownika? Wszystkie dane zostaną bezpowrotnie utracone!')) {
      try {
        await deleteUserCompletely(id);
      } catch (error: any) {
        alert('Błąd podczas usuwania użytkownika: ' + error.message);
      }
    }
  };

  const handleBlock = async (user: User) => {
    if (user.is_blocked) {
      if (window.confirm(`Czy na pewno chcesz odblokować użytkownika ${user.first_name} ${user.last_name}?`)) {
        await unblockUser(user.id);
      }
    } else {
      const reason = window.prompt('Podaj powód blokady (opcjonalnie):');
      if (reason !== null) {
        await blockUser(user.id, reason);
      }
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsEditingPassword(false);
    setNewPassword('');
    setShowEditPassword(false);
    setIsEditModalOpen(true);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationErrors.email || validationErrors.phone) return;

    try {
      await addUser({ ...newUser, hired_date: new Date().toISOString() });
      setIsAddModalOpen(false);
      setNewUser({ first_name: '', last_name: '', email: '', phone: '', role: Role.EMPLOYEE, password: '' });
      alert('Użytkownik został utworzony pomyślnie!');
    } catch (error: any) {
      alert('Błąd podczas tworzenia użytkownika: ' + error.message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updates = {
        first_name: editingUser.first_name,
        last_name: editingUser.last_name,
        email: editingUser.email,
        phone: editingUser.phone,
        role: editingUser.role
      };

      const password = isEditingPassword ? newPassword.trim() : undefined;

      await updateUserWithPassword(editingUser.id, updates, password || undefined);
      setIsEditModalOpen(false);
      setEditingUser(null);
      setIsEditingPassword(false);
      setNewPassword('');
      alert('Użytkownik został zaktualizowany pomyślnie!');
    } catch (error: any) {
      alert('Błąd podczas aktualizacji użytkownika: ' + error.message);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zarządzanie Użytkownikami</h1>
          <p className="text-slate-500">Panel techniczny administratora</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}><UserPlus size={18} className="mr-2"/> Dodaj Użytkownika</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="p-4">Imię i Nazwisko</th>
              <th className="p-4">Email</th>
              <th className="p-4">Telefon</th>
              <th className="p-4">Rola</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.users.map(user => (
              <tr key={user.id} className={`hover:bg-slate-50 ${user.is_blocked ? 'bg-red-50' : ''}`}>
                <td className="p-4 font-medium">{user.first_name} {user.last_name}</td>
                <td className="p-4 text-slate-500">{user.email}</td>
                <td className="p-4 text-slate-500">{user.phone || '-'}</td>
                <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs uppercase font-semibold">{ROLE_LABELS[user.role]}</span></td>
                <td className="p-4">
                  {user.is_blocked ? (
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">ZABLOKOWANY</span>
                  ) : (
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">AKTYWNY</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-500 hover:bg-blue-50 p-2 rounded"
                      title="Edytuj"
                    >
                      <Edit2 size={18}/>
                    </button>
                    <button
                      onClick={() => handleBlock(user)}
                      className={`${user.is_blocked ? 'text-green-500 hover:bg-green-50' : 'text-orange-500 hover:bg-orange-50'} p-2 rounded`}
                      title={user.is_blocked ? 'Odblokuj' : 'Zablokuj'}
                    >
                      {user.is_blocked ? <Unlock size={18}/> : <Lock size={18}/>}
                    </button>
                    {user.role !== Role.ADMIN && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded"
                        title="Usuń całkowicie"
                      >
                        <Trash2 size={18}/>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-6">Dodaj Użytkownika</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Imię" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" required value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} />
                <input placeholder="Nazwisko" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" required value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} />
              </div>

              <div className="space-y-1">
                <div className="relative">
                    <input
                        type="email"
                        placeholder="Email"
                        className={`w-full border p-2 rounded outline-none focus:ring-2 ${validationErrors.email ? 'border-red-500 bg-red-50' : 'focus:ring-blue-500'}`}
                        required
                        value={newUser.email}
                        onChange={e => setNewUser({...newUser, email: e.target.value.toLowerCase()})}
                    />
                    {validationErrors.email && <AlertTriangle className="absolute right-2 top-2 text-red-500" size={18} />}
                </div>
                {validationErrors.email && <p className="text-[10px] text-red-500 font-bold ml-1">{validationErrors.email}</p>}
              </div>

              <div className="space-y-1">
                <div className="relative">
                    <input
                        placeholder="Telefon (+48 ...)"
                        className={`w-full border p-2 rounded outline-none focus:ring-2 ${validationErrors.phone ? 'border-red-500 bg-red-50' : 'focus:ring-blue-500'}`}
                        required
                        value={newUser.phone}
                        onChange={e => setNewUser({...newUser, phone: formatPhone(e.target.value)})}
                    />
                    {validationErrors.phone && <AlertTriangle className="absolute right-2 top-2 text-red-500" size={18} />}
                </div>
                {validationErrors.phone && <p className="text-[10px] text-red-500 font-bold ml-1">{validationErrors.phone}</p>}
              </div>

              <div className="space-y-1">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Hasło (opcjonalne - jeśli puste, wygenerowane automatycznie)"
                    className="w-full border p-2 pr-10 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 ml-1">Jeśli nie podasz hasła, zostanie wygenerowane automatycznie</p>
              </div>

              <select className="w-full border p-2 rounded bg-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as Role})}>
                <option value={Role.HR}>HR Manager</option>
                <option value={Role.BRIGADIR}>Brygadzista</option>
                <option value={Role.EMPLOYEE}>Pracownik</option>
              </select>

              <div className="flex justify-end space-x-2 pt-6 border-t mt-4">
                <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={Object.keys(validationErrors).length > 0}>Utwórz konto</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-6">Edytuj Użytkownika</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  placeholder="Imię"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  value={editingUser.first_name}
                  onChange={e => setEditingUser({...editingUser, first_name: e.target.value})}
                />
                <input
                  placeholder="Nazwisko"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  value={editingUser.last_name}
                  onChange={e => setEditingUser({...editingUser, last_name: e.target.value})}
                />
              </div>

              <input
                type="email"
                placeholder="Email"
                className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                required
                value={editingUser.email}
                onChange={e => setEditingUser({...editingUser, email: e.target.value.toLowerCase()})}
              />

              <input
                placeholder="Telefon (+48 ...)"
                className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                required
                value={editingUser.phone || ''}
                onChange={e => setEditingUser({...editingUser, phone: formatPhone(e.target.value)})}
              />

              <div className="space-y-1">
                <label className="text-xs text-slate-500 ml-1">Hasło</label>
                {!isEditingPassword ? (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        className="w-full border p-2 pr-10 rounded bg-slate-50 outline-none"
                        value={editingUser.plain_password || '(brak zapisanego hasła)'}
                        readOnly
                      />
                      {editingUser.plain_password && (
                        <button
                          type="button"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          className="absolute right-2 top-2 text-slate-500 hover:text-slate-700"
                        >
                          {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingPassword(true)}
                      className="p-2 border rounded hover:bg-slate-50 text-slate-600 hover:text-blue-600"
                      title="Zmień hasło"
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        placeholder="Wprowadź nowe hasło"
                        className="w-full border p-2 pr-10 rounded outline-none focus:ring-2 focus:ring-blue-500"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2 top-2 text-slate-500 hover:text-slate-700"
                      >
                        {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setIsEditingPassword(false); setNewPassword(''); }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Anuluj zmianę hasła
                    </button>
                  </div>
                )}
              </div>

              <select
                className="w-full border p-2 rounded bg-white"
                value={editingUser.role}
                onChange={e => setEditingUser({...editingUser, role: e.target.value as Role})}
              >
                <option value={Role.ADMIN}>Administrator</option>
                <option value={Role.HR}>HR Manager</option>
                <option value={Role.BRIGADIR}>Brygadzista</option>
                <option value={Role.EMPLOYEE}>Pracownik</option>
                <option value={Role.CANDIDATE}>Kandydat</option>
              </select>

              <div className="flex justify-end space-x-2 pt-6 border-t mt-4">
                <Button variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditingUser(null); }}>Anuluj</Button>
                <Button type="submit">Zapisz zmiany</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
