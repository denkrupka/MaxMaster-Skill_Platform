import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Award, Clock, Search,
  User, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Mail, Phone, Calendar, Building2
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { UserStatus, Skill, UserSkill, SkillStatus } from '../../types';

export const DoradcaCompanyView: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const { state } = useAppContext();
  const { companies, users, skills, userSkills } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Get current company
  const company = companies.find(c => c.id === companyId);

  // Get company users
  const companyUsers = useMemo(() => {
    return (users || []).filter(u => u.company_id === companyId);
  }, [users, companyId]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return companyUsers.filter(user => {
      const matchesSearch =
        user.first_name.toLowerCase().includes(search.toLowerCase()) ||
        user.last_name.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.target_position?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [companyUsers, search, statusFilter]);

  // Get user skills
  const getUserSkills = (userId: string): (UserSkill & { skill: Skill })[] => {
    return userSkills
      .filter(us => us.user_id === userId)
      .map(us => ({
        ...us,
        skill: skills.find(s => s.id === us.skill_id)!
      }))
      .filter(us => us.skill);
  };

  // Stats
  const stats = useMemo(() => {
    const active = companyUsers.filter(u => u.status === UserStatus.ACTIVE).length;
    const trial = companyUsers.filter(u => u.status === UserStatus.TRIAL).length;
    const pending = companyUsers.filter(u => u.status === UserStatus.PENDING).length;
    return { total: companyUsers.length, active, trial, pending };
  }, [companyUsers]);

  const getStatusIcon = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ACTIVE: return <CheckCircle className="w-4 h-4 text-green-500" />;
      case UserStatus.TRIAL: return <Clock className="w-4 h-4 text-amber-500" />;
      case UserStatus.PENDING: return <AlertTriangle className="w-4 h-4 text-blue-500" />;
      case UserStatus.INACTIVE: return <XCircle className="w-4 h-4 text-slate-400" />;
      default: return null;
    }
  };

  // Get skill status color
  const getSkillStatusColor = (status: SkillStatus): string => {
    switch (status) {
      case SkillStatus.CONFIRMED: return 'bg-green-100 text-green-700';
      case SkillStatus.PRACTICE_PENDING: return 'bg-amber-100 text-amber-700';
      case SkillStatus.THEORY_PASSED: return 'bg-blue-100 text-blue-700';
      case SkillStatus.PENDING: return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  if (!company) {
    return (
      <div className="p-6 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Firma nie została znaleziona</p>
        <Link to="/doradca/dashboard" className="text-blue-600 hover:underline mt-2 inline-block">
          Wróć do panelu
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/doradca/dashboard"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            <p className="text-slate-500">{company.industry || 'Brak branży'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Łącznie</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
              <p className="text-xs text-slate-500">Aktywnych</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.trial}</p>
              <p className="text-xs text-slate-500">Okres próbny</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
              <p className="text-xs text-slate-500">Kandydaci</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl mb-6">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj pracownika..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie statusy</option>
            <option value={UserStatus.ACTIVE}>Aktywni</option>
            <option value={UserStatus.TRIAL}>Okres próbny</option>
            <option value={UserStatus.PENDING}>Kandydaci</option>
            <option value={UserStatus.INACTIVE}>Nieaktywni</option>
          </select>
        </div>

        {/* Users List */}
        {filteredUsers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredUsers.map(user => {
              const userSkillsList = getUserSkills(user.id);
              const isExpanded = expandedUser === user.id;
              const confirmedSkills = userSkillsList.filter(us => us.status === SkillStatus.CONFIRMED);

              return (
                <div key={user.id} className="transition-colors">
                  <div
                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {user.first_name} {user.last_name}
                          </p>
                          {getStatusIcon(user.status)}
                        </div>
                        <p className="text-sm text-slate-500">
                          {user.target_position || 'Brak stanowiska'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-2">
                        <Award className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{confirmedSkills.length} potwierdzone</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        {/* Contact Info */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Kontakt</h4>
                          <div className="space-y-2">
                            {user.email && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Mail className="w-4 h-4" />
                                <span>{user.email}</span>
                              </div>
                            )}
                            {user.phone && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Phone className="w-4 h-4" />
                                <span>{user.phone}</span>
                              </div>
                            )}
                            {user.created_at && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Calendar className="w-4 h-4" />
                                <span>Od: {new Date(user.created_at).toLocaleDateString('pl-PL')}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Skills */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Umiejętności</h4>
                          {userSkillsList.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {userSkillsList.slice(0, 6).map(us => (
                                <span
                                  key={us.id}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getSkillStatusColor(us.status)}`}
                                >
                                  {us.skill.name}
                                </span>
                              ))}
                              {userSkillsList.length > 6 && (
                                <span className="text-xs text-slate-500 py-1">
                                  +{userSkillsList.length - 6} więcej
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">Brak przypisanych umiejętności</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {companyUsers.length === 0 ? 'Brak pracowników w tej firmie' : 'Brak pracowników spełniających kryteria'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
