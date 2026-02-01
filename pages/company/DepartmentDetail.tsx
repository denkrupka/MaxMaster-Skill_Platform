
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Users, Plus, Trash2, Edit, ChevronRight, ChevronDown,
  Archive, Search, ToggleLeft, ToggleRight, ArrowLeft, Info, UserPlus, X, AlertCircle, Shield
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Department, DepartmentMember, User } from '../../types';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface DepartmentFull extends Department {
  members_count?: number;
}

type TabKey = 'info' | 'members';

const ROLE_LABELS_DEPT: Record<string, string> = {
  member: 'Pracownik',
  manager: 'Kierownik',
};

// ---------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------

export const DepartmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentCompany, currentUser, users } = state;

  // Data
  const [department, setDepartment] = useState<DepartmentFull | null>(null);
  const [parentDept, setParentDept] = useState<Department | null>(null);
  const [childDepts, setChildDepts] = useState<DepartmentFull[]>([]);
  const [members, setMembers] = useState<(DepartmentMember & { user?: User })[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignRole, setAssignRole] = useState<'member' | 'manager'>('member');
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  // ---------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------

  const loadDepartment = useCallback(async () => {
    if (!id || !currentCompany) return;
    setLoading(true);

    try {
      // Load department
      const { data: dept, error: deptError } = await supabase
        .from('departments')
        .select('*, department_members(count)')
        .eq('id', id)
        .eq('company_id', currentCompany.id)
        .single();

      if (deptError) throw deptError;

      const deptMapped: DepartmentFull = {
        ...dept,
        members_count: dept.department_members?.[0]?.count ?? 0,
      };
      setDepartment(deptMapped);

      // Load parent if exists
      if (dept.parent_id) {
        const { data: parent } = await supabase
          .from('departments')
          .select('*')
          .eq('id', dept.parent_id)
          .single();
        setParentDept(parent || null);
      } else {
        setParentDept(null);
      }

      // Load child departments
      const { data: children } = await supabase
        .from('departments')
        .select('*, department_members(count)')
        .eq('parent_id', id)
        .eq('company_id', currentCompany.id)
        .order('name');

      setChildDepts(
        (children || []).map((c: any) => ({
          ...c,
          members_count: c.department_members?.[0]?.count ?? 0,
        }))
      );

      // Load members
      const { data: membersData } = await supabase
        .from('department_members')
        .select('*')
        .eq('department_id', id)
        .eq('company_id', currentCompany.id)
        .order('assigned_at', { ascending: false });

      setMembers(membersData || []);
    } catch (err) {
      console.error('Error loading department detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id, currentCompany]);

  useEffect(() => {
    loadDepartment();
  }, [loadDepartment]);

  // ---------------------------------------------------------------
  // Member helpers
  // ---------------------------------------------------------------

  // Resolve user data from context
  const enrichedMembers = useMemo(() => {
    return members.map(m => ({
      ...m,
      user: users.find(u => u.id === m.user_id),
    }));
  }, [members, users]);

  // Users not yet assigned
  const availableUsers = useMemo(() => {
    if (!currentCompany) return [];
    const assignedIds = new Set(members.map(m => m.user_id));
    let filtered = users.filter(
      u => u.company_id === currentCompany.id && !u.is_global_user && !assignedIds.has(u.id)
    );
    if (assignSearch.trim()) {
      const term = assignSearch.toLowerCase().trim();
      filtered = filtered.filter(
        u =>
          (u.first_name || '').toLowerCase().includes(term) ||
          (u.last_name || '').toLowerCase().includes(term) ||
          (u.email || '').toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [users, currentCompany, members, assignSearch]);

  // ---------------------------------------------------------------
  // Member CRUD
  // ---------------------------------------------------------------

  const handleAssignUser = async (userId: string) => {
    if (!id || !currentCompany) return;
    setAssigningUserId(userId);

    try {
      const { error } = await supabase
        .from('department_members')
        .insert([{
          department_id: id,
          user_id: userId,
          company_id: currentCompany.id,
          role: assignRole,
        }]);
      if (error) throw error;
      setShowAssignModal(false);
      setAssignSearch('');
      setAssignRole('member');
      await loadDepartment();
    } catch (err: any) {
      console.error('Error assigning user:', err);
      alert(err.message || 'Nie udalo sie przypisac pracownika.');
    } finally {
      setAssigningUserId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, userName: string) => {
    if (!window.confirm(`Czy na pewno chcesz usunac ${userName} z tego obiektu?`)) return;

    try {
      const { error } = await supabase
        .from('department_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
      await loadDepartment();
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const handleToggleRole = async (member: DepartmentMember & { user?: User }) => {
    const newRole: 'member' | 'manager' = member.role === 'manager' ? 'member' : 'manager';
    try {
      const { error } = await supabase
        .from('department_members')
        .update({ role: newRole })
        .eq('id', member.id);
      if (error) throw error;
      await loadDepartment();
    } catch (err) {
      console.error('Error toggling role:', err);
    }
  };

  // ---------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------

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

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500">Ladowanie danych obiektu...</p>
        </div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-700">Nie znaleziono obiektu</p>
          <button
            onClick={() => navigate('/company/departments')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Powrot do listy
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: 'Informacja', icon: <Info className="w-4 h-4" /> },
    { key: 'members', label: 'Pracownicy', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 lg:p-6">
      {/* Back button & header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/company/departments')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Powrot do obiektow
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{department.name}</h1>
            <p className="text-slate-500 text-sm">
              {department.address_city ? `${department.address_city}` : 'Brak adresu'}
              {department.is_archived && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Archiwum
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* TAB: Informacja                                              */}
      {/* ============================================================ */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {/* Basic info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Informacje podstawowe
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Nazwa obiektu</p>
                <p className="text-sm font-medium text-slate-900">{department.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Status</p>
                <p className="text-sm">
                  {department.is_archived ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Zarchiwizowany</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Aktywny</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Liczba pracownikow</p>
                <p className="text-sm font-medium text-slate-900">{department.members_count ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Data utworzenia</p>
                <p className="text-sm text-slate-700">
                  {new Date(department.created_at).toLocaleDateString('pl-PL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Parent */}
          {parentDept && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-slate-500" />
                Obiekt nadrzedny
              </h3>
              <button
                onClick={() => navigate(`/company/departments/${parentDept.id}`)}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-blue-50 transition w-full text-left"
              >
                <Building2 className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-slate-900">{parentDept.name}</p>
                  {parentDept.address_city && (
                    <p className="text-xs text-slate-500">{parentDept.address_city}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
              </button>
            </div>
          )}

          {/* Address */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-500" />
              Adres
            </h3>
            {department.address_street || department.address_city ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Ulica</p>
                  <p className="text-sm text-slate-900">{department.address_street || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Miasto</p>
                  <p className="text-sm text-slate-900">{department.address_city || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Kod pocztowy</p>
                  <p className="text-sm text-slate-900">{department.address_postal_code || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Kraj</p>
                  <p className="text-sm text-slate-900">{department.address_country || '—'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Adres nie zostal uzupelniony.</p>
            )}
          </div>

          {/* Geofence */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-500" />
              Geofence
            </h3>
            {department.latitude && department.longitude ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Szerokosc geograficzna</p>
                  <p className="text-sm font-mono text-slate-900">{department.latitude}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Dlugosc geograficzna</p>
                  <p className="text-sm font-mono text-slate-900">{department.longitude}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Zasieg (metry)</p>
                  <p className="text-sm font-medium text-slate-900">{department.range_meters ?? 200} m</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Geofence nie jest skonfigurowany. Uzupelnij wspolrzedne w edycji obiektu.</p>
            )}
          </div>

          {/* Children */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <ChevronDown className="w-4 h-4 text-slate-500" />
              Podobiekty ({childDepts.length})
            </h3>
            {childDepts.length > 0 ? (
              <div className="space-y-2">
                {childDepts.map(child => (
                  <button
                    key={child.id}
                    onClick={() => navigate(`/company/departments/${child.id}`)}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-blue-50 transition w-full text-left"
                  >
                    <Building2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{child.name}</p>
                      <p className="text-xs text-slate-500">
                        {child.members_count ?? 0} pracownikow
                        {child.address_city && ` \u00B7 ${child.address_city}`}
                      </p>
                    </div>
                    {child.is_archived && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                        Archiwum
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Ten obiekt nie posiada podobiektow.</p>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: Pracownicy                                              */}
      {/* ============================================================ */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Header with assign button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {enrichedMembers.length} przypisanych pracownikow
            </p>
            <button
              onClick={() => { setShowAssignModal(true); setAssignSearch(''); setAssignRole('member'); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Przypisz pracownika
            </button>
          </div>

          {/* Members list */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {enrichedMembers.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Brak przypisanych pracownikow</p>
                <button
                  onClick={() => { setShowAssignModal(true); setAssignSearch(''); setAssignRole('member'); }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Przypisz pierwszego pracownika
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pracownik</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rola w obiekcie</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Przypisano</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrichedMembers.map(member => {
                      const user = member.user;
                      const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : member.user_id;
                      const initials = user
                        ? `${(user.first_name || '')[0] || ''}${(user.last_name || '')[0] || ''}`
                        : '?';

                      return (
                        <tr key={member.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                                {initials}
                              </div>
                              <span className="font-medium text-slate-900">{fullName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{user?.email || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleRole(member)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                                member.role === 'manager'
                                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                              title="Kliknij, aby zmienic role"
                            >
                              {member.role === 'manager' && <Shield className="w-3 h-3" />}
                              {ROLE_LABELS_DEPT[member.role] || member.role}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {new Date(member.assigned_at).toLocaleDateString('pl-PL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => handleRemoveMember(member.id, fullName)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Usun z obiektu"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Assign Member Modal                                          */}
      {/* ============================================================ */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Przypisz pracownika</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role selector */}
            <div className="px-6 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Rola w obiekcie</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAssignRole('member')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    assignRole === 'member'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Pracownik
                </button>
                <button
                  onClick={() => setAssignRole('manager')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    assignRole === 'manager'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Kierownik
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-6 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Szukaj pracownika..."
                  value={assignSearch}
                  onChange={e => setAssignSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  autoFocus
                />
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto p-6 pt-3 space-y-1">
              {availableUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    {assignSearch.trim()
                      ? 'Nie znaleziono pracownikow'
                      : 'Wszyscy pracownicy sa juz przypisani'}
                  </p>
                </div>
              ) : (
                availableUsers.map(user => {
                  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                  const initials = `${(user.first_name || '')[0] || ''}${(user.last_name || '')[0] || ''}`;
                  const isAssigning = assigningUserId === user.id;

                  return (
                    <button
                      key={user.id}
                      onClick={() => handleAssignUser(user.id)}
                      disabled={isAssigning}
                      className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-blue-50 transition text-left disabled:opacity-50"
                    >
                      <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{fullName}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                      <Plus className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
