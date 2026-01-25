import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Building2, Award, BookOpen, Settings, TrendingUp,
  CheckCircle, Clock, AlertTriangle, DollarSign
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Role, UserStatus } from '../../types';

export const SuperAdminDashboard: React.FC = () => {
  const { state } = useAppContext();
  const { users, companies, skills, libraryResources } = state;

  // Statistics
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && !u.is_blocked).length;
  const blockedUsers = users.filter(u => u.is_blocked).length;
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter(c => !c.is_blocked).length;
  const blockedCompanies = companies.filter(c => c.is_blocked).length;

  // Users by role
  const usersByRole = {
    superadmin: users.filter(u => u.role === Role.SUPERADMIN).length,
    sales: users.filter(u => u.role === Role.SALES).length,
    doradca: users.filter(u => u.role === Role.DORADCA).length,
    hr: users.filter(u => u.role === Role.HR).length,
    companyAdmin: users.filter(u => u.role === Role.COMPANY_ADMIN).length,
    employees: users.filter(u => u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR).length,
    candidates: users.filter(u => u.role === Role.CANDIDATE).length,
  };

  // Recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentUsers = users.filter(u => new Date(u.hired_date || u.created_at || 0) >= sevenDaysAgo);
  const recentCompanies = companies.filter(c => new Date(c.created_at || 0) >= sevenDaysAgo);

  const StatCard = ({ title, value, icon: Icon, color, link }: {
    title: string;
    value: number | string;
    icon: any;
    color: string;
    link?: string;
  }) => {
    const content = (
      <div className={`bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow ${link ? 'cursor-pointer' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
            <Icon size={24} className="text-white" />
          </div>
        </div>
      </div>
    );

    if (link) {
      return <Link to={link}>{content}</Link>;
    }
    return content;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Panel SuperAdmin</h1>
        <p className="text-slate-600">Zarządzanie platformą MaxMaster</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Użytkownicy"
          value={totalUsers}
          icon={Users}
          color="bg-blue-500"
          link="/superadmin/users"
        />
        <StatCard
          title="Firmy"
          value={totalCompanies}
          icon={Building2}
          color="bg-purple-500"
          link="/superadmin/companies"
        />
        <StatCard
          title="Umiejętności"
          value={skills.length}
          icon={Award}
          color="bg-green-500"
          link="/superadmin/skills"
        />
        <StatCard
          title="Zasoby biblioteki"
          value={libraryResources.length}
          icon={BookOpen}
          color="bg-amber-500"
          link="/superadmin/library"
        />
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle className="text-green-500" size={24} />
            <h3 className="font-semibold text-slate-800">Aktywni</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Użytkownicy</span>
              <span className="font-medium text-green-600">{activeUsers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Firmy</span>
              <span className="font-medium text-green-600">{activeCompanies}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="text-red-500" size={24} />
            <h3 className="font-semibold text-slate-800">Zablokowani</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Użytkownicy</span>
              <span className="font-medium text-red-600">{blockedUsers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Firmy</span>
              <span className="font-medium text-red-600">{blockedCompanies}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center space-x-3 mb-4">
            <Clock className="text-blue-500" size={24} />
            <h3 className="font-semibold text-slate-800">Ostatnie 7 dni</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Nowi użytkownicy</span>
              <span className="font-medium text-blue-600">{recentUsers.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Nowe firmy</span>
              <span className="font-medium text-blue-600">{recentCompanies.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Users by Role */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8">
        <h3 className="font-semibold text-slate-800 mb-4">Użytkownicy wg roli</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: 'SuperAdmin', value: usersByRole.superadmin, color: 'bg-red-100 text-red-700' },
            { label: 'Sales', value: usersByRole.sales, color: 'bg-purple-100 text-purple-700' },
            { label: 'Doradca', value: usersByRole.doradca, color: 'bg-blue-100 text-blue-700' },
            { label: 'HR', value: usersByRole.hr, color: 'bg-green-100 text-green-700' },
            { label: 'Admin Firmy', value: usersByRole.companyAdmin, color: 'bg-amber-100 text-amber-700' },
            { label: 'Pracownicy', value: usersByRole.employees, color: 'bg-slate-100 text-slate-700' },
            { label: 'Kandydaci', value: usersByRole.candidates, color: 'bg-cyan-100 text-cyan-700' },
          ].map(item => (
            <div key={item.label} className={`rounded-lg p-3 ${item.color}`}>
              <p className="text-xs font-medium opacity-70">{item.label}</p>
              <p className="text-xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4">Szybkie akcje</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/superadmin/users"
            className="flex items-center space-x-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Users size={20} className="text-blue-500" />
            <span className="text-sm font-medium text-slate-700">Dodaj użytkownika</span>
          </Link>
          <Link
            to="/superadmin/companies"
            className="flex items-center space-x-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Building2 size={20} className="text-purple-500" />
            <span className="text-sm font-medium text-slate-700">Dodaj firmę</span>
          </Link>
          <Link
            to="/superadmin/skills"
            className="flex items-center space-x-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Award size={20} className="text-green-500" />
            <span className="text-sm font-medium text-slate-700">Zarządzaj umiejętnościami</span>
          </Link>
          <Link
            to="/superadmin/settings"
            className="flex items-center space-x-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Settings size={20} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Ustawienia</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
