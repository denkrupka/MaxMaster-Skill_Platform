import React, { useState, useMemo } from 'react';
import {
  Building2, Search, Filter, Eye, Edit2, MoreVertical,
  Calendar, DollarSign, Users, CheckCircle, XCircle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Company } from '../../types';

export const SuperAdminClients: React.FC = () => {
  const { state } = useAppContext();
  const { companies, users } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Get unique subscription tiers
  const subscriptionTiers = useMemo(() => {
    const tiers = new Set(companies.map(c => c.subscription_tier).filter(Boolean));
    return Array.from(tiers);
  }, [companies]);

  // Filter companies
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Search filter
      const matchesSearch = !searchQuery ||
        company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.tax_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.email?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && !company.is_blocked) ||
        (statusFilter === 'blocked' && company.is_blocked);

      // Subscription filter
      const matchesSubscription = subscriptionFilter === 'all' ||
        company.subscription_tier === subscriptionFilter;

      return matchesSearch && matchesStatus && matchesSubscription;
    });
  }, [companies, searchQuery, statusFilter, subscriptionFilter]);

  // Get user count for company
  const getCompanyUserCount = (companyId: string) => {
    return users.filter(u => u.company_id === companyId).length;
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pl-PL');
  };

  // Get subscription badge color
  const getSubscriptionColor = (tier?: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-700';
      case 'professional': return 'bg-blue-100 text-blue-700';
      case 'basic': return 'bg-green-100 text-green-700';
      case 'trial': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Klienci (Wszystkie firmy)</h1>
        <p className="text-slate-600">Zarządzanie wszystkimi firmami w systemie</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Wszystkie firmy</p>
          <p className="text-2xl font-bold text-slate-800">{companies.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Aktywne</p>
          <p className="text-2xl font-bold text-green-600">
            {companies.filter(c => !c.is_blocked).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Zablokowane</p>
          <p className="text-2xl font-bold text-red-600">
            {companies.filter(c => c.is_blocked).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Łączna liczba użytkowników</p>
          <p className="text-2xl font-bold text-blue-600">
            {users.filter(u => u.company_id).length}
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
              placeholder="Szukaj po nazwie, NIP lub email..."
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

          {/* Subscription Filter */}
          <select
            value={subscriptionFilter}
            onChange={(e) => setSubscriptionFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie plany</option>
            {subscriptionTiers.map(tier => (
              <option key={tier} value={tier}>{tier}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Firma</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">NIP</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Plan</th>
                <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">Użytkownicy</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Data utworzenia</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Nie znaleziono firm
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(company => (
                  <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{company.name}</p>
                          <p className="text-sm text-slate-500">{company.email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {company.tax_id || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getSubscriptionColor(company.subscription_tier)}`}>
                        {company.subscription_tier || 'Brak'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center space-x-1 text-sm text-slate-600">
                        <Users size={16} />
                        <span>{getCompanyUserCount(company.id)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {company.is_blocked ? (
                        <span className="inline-flex items-center space-x-1 text-red-600">
                          <XCircle size={16} />
                          <span className="text-sm">Zablokowana</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-green-600">
                          <CheckCircle size={16} />
                          <span className="text-sm">Aktywna</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(company.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedCompany(company)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Szczegóły firmy</h2>
                <button
                  onClick={() => setSelectedCompany(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Company Info */}
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Building2 size={32} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{selectedCompany.name}</h3>
                  <p className="text-slate-500">{selectedCompany.email || 'Brak email'}</p>
                  {selectedCompany.is_blocked && (
                    <span className="inline-flex items-center space-x-1 text-red-600 text-sm mt-1">
                      <XCircle size={14} />
                      <span>Zablokowana: {selectedCompany.blocked_reason}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">NIP</p>
                  <p className="font-medium text-slate-800">{selectedCompany.tax_id || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">REGON</p>
                  <p className="font-medium text-slate-800">{selectedCompany.regon || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Telefon</p>
                  <p className="font-medium text-slate-800">{selectedCompany.phone || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Plan</p>
                  <p className="font-medium text-slate-800">{selectedCompany.subscription_tier || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg col-span-2">
                  <p className="text-sm text-slate-500">Adres</p>
                  <p className="font-medium text-slate-800">
                    {selectedCompany.street} {selectedCompany.building_number}
                    {selectedCompany.apartment_number && `/${selectedCompany.apartment_number}`}
                    {selectedCompany.postal_code && `, ${selectedCompany.postal_code}`}
                    {selectedCompany.city && ` ${selectedCompany.city}`}
                  </p>
                </div>
              </div>

              {/* Users in this company */}
              <div>
                <h4 className="font-medium text-slate-800 mb-3">Użytkownicy w firmie ({getCompanyUserCount(selectedCompany.id)})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {users.filter(u => u.company_id === selectedCompany.id).map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-800">{user.first_name} {user.last_name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {user.role}
                      </span>
                    </div>
                  ))}
                  {getCompanyUserCount(selectedCompany.id) === 0 && (
                    <p className="text-slate-500 text-sm">Brak użytkowników</p>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center space-x-4 text-sm text-slate-500">
                <span>Utworzono: {formatDate(selectedCompany.created_at)}</span>
                {selectedCompany.subscription_start && (
                  <span>Subskrypcja od: {formatDate(selectedCompany.subscription_start)}</span>
                )}
                {selectedCompany.subscription_end && (
                  <span>Subskrypcja do: {formatDate(selectedCompany.subscription_end)}</span>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedCompany(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminClients;
