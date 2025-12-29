
import React, { useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Role } from '../../types';
import { ROLE_LABELS } from '../../constants';

export const AdminUsersPage = () => {
  const { state, addUser, deleteUser } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ first_name: '', last_name: '', email: '', role: Role.EMPLOYEE });

  const handleDelete = (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć tego użytkownika?')) {
      deleteUser(id);
    }
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    addUser({ ...newUser, email: newUser.email, first_name: newUser.first_name, last_name: newUser.last_name, role: newUser.role });
    setIsModalOpen(false);
    setNewUser({ first_name: '', last_name: '', email: '', role: Role.EMPLOYEE });
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
              <th className="p-4">Rola</th>
              <th className="p-4 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="p-4 font-medium">{user.first_name} {user.last_name}</td>
                <td className="p-4 text-slate-500">{user.email}</td>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Dodaj Użytkownika</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <input placeholder="Imię" className="w-full border p-2 rounded" required value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} />
              <input placeholder="Nazwisko" className="w-full border p-2 rounded" required value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} />
              <input type="email" placeholder="Email" className="w-full border p-2 rounded" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <select className="w-full border p-2 rounded bg-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as Role})}>
                <option value={Role.HR}>HR Manager</option>
                <option value={Role.BRIGADIR}>Brygadzista</option>
                <option value={Role.EMPLOYEE}>Pracownik</option>
              </select>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Anuluj</Button>
                <Button type="submit">Dodaj</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
