
import React, { useState, useMemo } from 'react';
import {
  Building2, Search, Percent, Calendar, Gift, X, AlertCircle,
  Save, Loader2, Check, ChevronRight, Clock, CreditCard, Users
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Company } from '../../types';
import { Button } from '../../components/Button';
import { supabase } from '../../lib/supabase';

export const SalesClients: React.FC = () => {
  const { state, refreshData } = useAppContext();
  const { companies, companyModules, systemConfig, currentUser } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  // Form states
  const [discountPercent, setDiscountPercent] = useState(0);
  const [extensionDays, setExtensionDays] = useState(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get max limits from SuperAdmin settings
  const maxDiscount = systemConfig.salesMaxDiscountPercent || 20;
  const maxExtensionDays = systemConfig.salesMaxFreeExtensionDays || 30;

  // Filter companies
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                           c.legal_name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [companies, search, statusFilter]);

  // Get company modules
  const getCompanyModules = (companyId: string) => {
    return companyModules.filter(cm => cm.company_id === companyId && cm.is_active);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(value);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pl-PL');

  // Open discount modal
  const openDiscountModal = (company: Company) => {
    setSelectedCompany(company);
    setDiscountPercent(0);
    setReason('');
    setError(null);
    setShowDiscountModal(true);
  };

  // Open extension modal
  const openExtensionModal = (company: Company) => {
    setSelectedCompany(company);
    setExtensionDays(0);
    setReason('');
    setError(null);
    setShowExtensionModal(true);
  };

  // Apply discount
  const handleApplyDiscount = async () => {
    if (!selectedCompany) return;
    if (discountPercent <= 0 || discountPercent > maxDiscount) {
      setError(`Zniżka musi być w zakresie 1-${maxDiscount}%`);
      return;
    }
    if (!reason.trim()) {
      setError('Podaj powód przyznania zniżki');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get active modules for this company
      const activeModules = companyModules.filter(
        cm => cm.company_id === selectedCompany.id && cm.is_active
      );

      // Update prices with discount
      for (const mod of activeModules) {
        const discountedPrice = Math.round(mod.price_per_user * (1 - discountPercent / 100));

        await supabase
          .from('company_modules')
          .update({ price_per_user: discountedPrice })
          .eq('id', mod.id);
      }

      // Log the action
      await supabase.from('sales_actions_log').insert({
        sales_user_id: currentUser?.id,
        company_id: selectedCompany.id,
        action_type: 'discount',
        value: discountPercent,
        reason: reason,
        created_at: new Date().toISOString()
      });

      setSuccess(`Zniżka ${discountPercent}% została zastosowana dla ${selectedCompany.name}`);
      await refreshData();
      setShowDiscountModal(false);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error('Error applying discount:', err);
      setError(err instanceof Error ? err.message : 'Błąd podczas aplikowania zniżki');
    } finally {
      setLoading(false);
    }
  };

  // Apply extension
  const handleApplyExtension = async () => {
    if (!selectedCompany) return;
    if (extensionDays <= 0 || extensionDays > maxExtensionDays) {
      setError(`Przedłużenie musi być w zakresie 1-${maxExtensionDays} dni`);
      return;
    }
    if (!reason.trim()) {
      setError('Podaj powód przedłużenia');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate new trial end date
      const currentTrialEnd = selectedCompany.trial_ends_at
        ? new Date(selectedCompany.trial_ends_at)
        : new Date();

      const newTrialEnd = new Date(currentTrialEnd);
      newTrialEnd.setDate(newTrialEnd.getDate() + extensionDays);

      // Update company trial end date
      await supabase
        .from('companies')
        .update({
          trial_ends_at: newTrialEnd.toISOString(),
          status: 'trial' // Keep in trial status
        })
        .eq('id', selectedCompany.id);

      // Log the action
      await supabase.from('sales_actions_log').insert({
        sales_user_id: currentUser?.id,
        company_id: selectedCompany.id,
        action_type: 'extension',
        value: extensionDays,
        reason: reason,
        created_at: new Date().toISOString()
      });

      setSuccess(`Przedłużenie ${extensionDays} dni zostało dodane dla ${selectedCompany.name}`);
      await refreshData();
      setShowExtensionModal(false);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error('Error applying extension:', err);
      setError(err instanceof Error ? err.message : 'Błąd podczas przedłużania');
    } finally {
      setLoading(false);
    }
  };

  // Add bonus balance
  const handleAddBonus = async () => {
    // This could be expanded for bonus balance functionality
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      active: { color: 'bg-green-100 text-green-700', label: 'Aktywna' },
      trial: { color: 'bg-blue-100 text-blue-700', label: 'Trial' },
      suspended: { color: 'bg-yellow-100 text-yellow-700', label: 'Zawieszona' },
      cancelled: { color: 'bg-red-100 text-red-700', label: 'Anulowana' }
    };
    return badges[status] || { color: 'bg-slate-100 text-slate-700', label: status };
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-600" />
            Klienci
          </h1>
          <p className="text-slate-500 mt-1">
            Zarządzaj subskrypcjami klientów - zniżki i przedłużenia
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj klientów..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">Wszystkie statusy</option>
            <option value="trial">Trial</option>
            <option value="active">Aktywne</option>
            <option value="suspended">Zawieszone</option>
            <option value="cancelled">Anulowane</option>
          </select>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Limits Info */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Twoje limity</p>
            <p className="text-sm text-blue-700">
              Maksymalna zniżka: <strong>{maxDiscount}%</strong> |
              Maksymalne darmowe przedłużenie: <strong>{maxExtensionDays} dni</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Companies List */}
      {filteredCompanies.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCompanies.map(company => {
            const modules = getCompanyModules(company.id);
            const badge = getStatusBadge(company.status);

            return (
              <div
                key={company.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{company.name}</h3>
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  {company.trial_ends_at && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>
                        Trial do: <strong>{formatDate(company.trial_ends_at)}</strong>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-600">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    <span>
                      Aktywne moduły: <strong>{modules.length}</strong>
                    </span>
                  </div>
                  {modules.length > 0 && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>
                        Miejsca: <strong>{modules.reduce((sum, m) => sum + m.current_users, 0)}/{modules.reduce((sum, m) => sum + m.max_users, 0)}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Module prices */}
                {modules.length > 0 && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-2">Aktywne moduły:</p>
                    <div className="space-y-1">
                      {modules.map(mod => (
                        <div key={mod.id} className="flex justify-between text-sm">
                          <span className="text-slate-700">{mod.module_code}</span>
                          <span className="font-medium text-slate-900">
                            {formatCurrency(mod.price_per_user)}/użytkownik
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openDiscountModal(company)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition font-medium text-sm"
                  >
                    <Percent className="w-4 h-4" />
                    Zniżka
                  </button>
                  <button
                    onClick={() => openExtensionModal(company)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition font-medium text-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    Przedłuż
                  </button>
                  <button
                    onClick={() => {}}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
                    title="Dodaj bonus"
                  >
                    <Gift className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {companies.length === 0 ? 'Brak klientów w systemie' : 'Brak klientów spełniających kryteria'}
          </p>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Percent className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Przyznaj zniżkę</h3>
                  <p className="text-sm text-slate-500">{selectedCompany.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Procent zniżki (max {maxDiscount}%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={maxDiscount}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(maxDiscount, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-2 pr-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={maxDiscount}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value))}
                  className="w-full mt-2 accent-purple-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Powód zniżki *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Np. Długoterminowa współpraca, nowy klient, promocja..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowDiscountModal(false)}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button
                onClick={handleApplyDiscount}
                disabled={loading || discountPercent <= 0}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Zastosuj zniżkę
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Extension Modal */}
      {showExtensionModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Przedłuż darmowo</h3>
                  <p className="text-sm text-slate-500">{selectedCompany.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowExtensionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {selectedCompany.trial_ends_at && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  Obecna data końca triala: <strong>{formatDate(selectedCompany.trial_ends_at)}</strong>
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Liczba dni (max {maxExtensionDays})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={maxExtensionDays}
                    value={extensionDays}
                    onChange={(e) => setExtensionDays(Math.min(maxExtensionDays, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-2 pr-12 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">dni</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={maxExtensionDays}
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(parseInt(e.target.value))}
                  className="w-full mt-2 accent-orange-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Powód przedłużenia *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Np. Potrzebują więcej czasu na wdrożenie, problemy techniczne..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowExtensionModal(false)}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button
                onClick={handleApplyExtension}
                disabled={loading || extensionDays <= 0}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Calendar className="w-4 h-4 mr-2" />
                )}
                Przedłuż trial
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
