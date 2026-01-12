
import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Role } from '../../types';
import { ROLE_LABELS } from '../../constants';

export const AdminUsersPage = () => {
  const { state, addUser, deleteUser } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ first_name: '', last_name: '', email: '', phone: '', role: Role.EMPLOYEE });
  const [validationErrors, setValidationErrors] = useState<{email?: string, phone?: string}>({});

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
    if (!isModalOpen) return;
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
  }, [newUser.email, newUser.phone, state.users, isModalOpen]);

  const handleDelete = (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć tego użytkownika?')) {
      deleteUser(id);
    }
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationErrors.email || validationErrors.phone) return;
    
    addUser({ ...newUser, hired_date: new Date().toISOString() });
    setIsModalOpen(false);
    setNewUser({ first_name: '', last_name: '', email: '', phone: '', role: Role.EMPLOYEE });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zarządzanie Użytkownikami</h1>
          <p className="text-slate-500">Panel techniczny administratora</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}><UserPlus size={18} className="mr-2"/> Dodaj Użytkownika</Button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="p-4">Imię i Nazwisko</th>
              <th className="p-4">Email</th>
              <th className="p-4">Telefon</th>
              <th className="p-4">Rola</th>
              <th className="p-4 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="p-4 font-medium">{user.first_name} {user.last_name}</td>
                <td className="p-4 text-slate-500">{user.email}</td>
                <td className="p-4 text-slate-500">{user.phone || '-'}</td>
                <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs uppercase font-semibold">{ROLE_LABELS[user.role]}</span></td>
                <td className="p-4 text-right">
                  {user.role !== Role.ADMIN && (
                    <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
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

              <select className="w-full border p-2 rounded bg-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as Role})}>
                <option value={Role.HR}>HR Manager</option>
                <option value={Role.BRIGADIR}>Brygadzista</option>
                <option value={Role.EMPLOYEE}>Pracownik</option>
              </select>
              
              <div className="flex justify-end space-x-2 pt-6 border-t mt-4">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={Object.keys(validationErrors).length > 0}>Utwórz konto</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
