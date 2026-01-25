import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Search, Users, Eye, CheckCircle, XCircle, Filter
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Company, Role } from '../../types';

export const DoradcaCompanies: React.FC = () => {
  const { state } = useAppContext();
  const { companies, users, currentUser } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');

  // Filter companies that doradca can manage
  // In multi-company setup, doradca can see companies they're assigned to
  // For SuperAdmin simulating doradca role, show all companies
  const accessibleCompanies = useMemo(() => {
    const companyList = companies || [];

    if (currentUser?.role === Role.SUPERADMIN) {
      // SuperAdmin in doradca mode sees all companies
      return companyList;
    }

    if (currentUser?.is_global_user) {
      // Global doradca sees all companies
      return companyList;
    }

    // Regular doradca sees only their assigned company
    if (currentUser?.company_id) {
      return companyList.filter(c => c.id === currentUser.company_id);
    }

    return [];
  }, [companies, currentUser]);

  // Apply filters
  const filteredCompanies = useMemo(() => {
    return accessibleCompanies.filter(company => {
      // Search filter
      const matchesSearch = !searchQuery ||
        company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.tax_id?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && !company.is_blocked) ||
        (statusFilter === 'blocked' && company.is_blocked);

      return matchesSearch && matchesStatus;
    });
  }, [accessibleCompanies, searchQuery, statusFilter]);

  // Get user count for company
  const getCompanyUserCount = (companyId: string) => {
    return (users || []).filter(u => u.company_id === companyId).length;
  };

  // Get employee count for company
  const getCompanyEmployeeCount = (companyId: string) => {
    return (users || []).filter(u =>
      u.company_id === companyId &&
      (u.role === Role.EMPLOYEE || u.role === Role.BRIGADIR)
    ).length;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Firmy klientów</h1>
        <p className="text-slate-600">Zarządzanie firmami i ich pracownikami</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Dostępne firmy</p>
          <p className="text-2xl font-bold text-slate-800">{accessibleCompanies.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Aktywne</p>
          <p className="text-2xl font-bold text-green-600">
            {accessibleCompanies.filter(c => !c.is_blocked).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Łączna liczba pracowników</p>
          <p className="text-2xl font-bold text-blue-600">
            {accessibleCompanies.reduce((sum, c) => sum + getCompanyEmployeeCount(c.id), 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Szukaj po nazwie lub NIP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie statusy</option>
            <option value="active">Aktywne</option>
            <option value="blocked">Zablokowane</option>
          </select>
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-12 border border-slate-200 text-center">
            <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Nie znaleziono firm</p>
          </div>
        ) : (
          filteredCompanies.map(company => (
            <Link
              key={company.id}
              to={`/doradca/company/${company.id}`}
              className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg hover:border-blue-200 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Building2 size={24} className="text-blue-600" />
                </div>
                {company.is_blocked ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                    <XCircle size={12} />
                    <span>Zablokowana</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                    <CheckCircle size={12} />
                    <span>Aktywna</span>
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                {company.name}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                NIP: {company.tax_id || '-'}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center space-x-1 text-sm text-slate-600">
                  <Users size={16} />
                  <span>{getCompanyUserCount(company.id)} użytkowników</span>
                </div>
                <div className="flex items-center space-x-1 text-sm text-blue-600 group-hover:text-blue-700">
                  <Eye size={16} />
                  <span>Zobacz szczegóły</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default DoradcaCompanies;
