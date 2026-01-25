import React, { useState, useMemo } from 'react';
import {
  Settings, DollarSign, Package, Users, Percent, Calendar,
  Save, Loader2, AlertCircle, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { supabase } from '../../lib/supabase';

export const SuperAdminSettingsPage: React.FC = () => {
  const { state, refreshData } = useAppContext();
  const { modules, systemConfig } = state;

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    modules: true,
    sales: true
  });

  // Module prices state
  const [modulePrices, setModulePrices] = useState<Record<string, number>>(() => {
    const prices: Record<string, number> = {};
    modules.forEach(m => {
      prices[m.code] = m.base_price_per_user;
    });
    return prices;
  });

  // Sales limits state
  const [salesLimits, setSalesLimits] = useState({
    maxDiscountPercent: systemConfig.salesMaxDiscountPercent || 20,
    maxFreeExtensionDays: systemConfig.salesMaxFreeExtensionDays || 30
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Save module price
  const handleSaveModulePrice = async (moduleCode: string) => {
    setLoading(moduleCode);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('modules')
        .update({ base_price_per_user: modulePrices[moduleCode] })
        .eq('code', moduleCode);

      if (updateError) throw updateError;

      setSuccess(`Cena modułu ${moduleCode} została zaktualizowana`);
      await refreshData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating module price:', err);
      setError(err instanceof Error ? err.message : 'Błąd aktualizacji ceny');
    } finally {
      setLoading(null);
    }
  };

  // Save sales limits
  const handleSaveSalesLimits = async () => {
    setLoading('sales');
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('system_config')
        .update({
          config: {
            ...systemConfig,
            salesMaxDiscountPercent: salesLimits.maxDiscountPercent,
            salesMaxFreeExtensionDays: salesLimits.maxFreeExtensionDays
          }
        })
        .eq('id', 'main');

      if (updateError) throw updateError;

      setSuccess('Limity dla sprzedawców zostały zaktualizowane');
      await refreshData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating sales limits:', err);
      setError(err instanceof Error ? err.message : 'Błąd aktualizacji limitów');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <Settings className="w-7 h-7 text-blue-600" />
          Ustawienia systemu
        </h1>
        <p className="text-slate-500 mt-1">Konfiguracja cen, limitów i parametrów platformy</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Module Prices Section */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
        <button
          onClick={() => toggleSection('modules')}
          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-slate-900">Ceny modułów</h3>
              <p className="text-sm text-slate-500">Ustaw bazowe ceny za użytkownika</p>
            </div>
          </div>
          {expandedSections.modules ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {expandedSections.modules && (
          <div className="p-5 space-y-4">
            {modules.filter(m => m.is_active).map(mod => (
              <div key={mod.code} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{mod.name_pl}</p>
                  <p className="text-sm text-slate-500">{mod.description_pl}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={modulePrices[mod.code] || 0}
                      onChange={e => setModulePrices(prev => ({
                        ...prev,
                        [mod.code]: parseFloat(e.target.value) || 0
                      }))}
                      className="w-24 px-3 py-2 pr-10 border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">PLN</span>
                  </div>
                  <span className="text-slate-400 text-sm whitespace-nowrap">/ użytkownik / mc</span>
                  <Button
                    onClick={() => handleSaveModulePrice(mod.code)}
                    disabled={loading === mod.code || modulePrices[mod.code] === mod.base_price_per_user}
                    size="sm"
                  >
                    {loading === mod.code ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Uwaga</p>
                  <p className="text-sm text-amber-700">
                    Zmiana cen nie wpływa na istniejące subskrypcje. Nowe ceny będą obowiązywać tylko dla nowych aktywacji.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sales Limits Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('sales')}
          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-slate-900">Limity dla sprzedawców</h3>
              <p className="text-sm text-slate-500">Maksymalne uprawnienia działu sprzedaży</p>
            </div>
          </div>
          {expandedSections.sales ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {expandedSections.sales && (
          <div className="p-5 space-y-6">
            {/* Max Discount */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Percent className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Maksymalna zniżka</p>
                  <p className="text-sm text-slate-500">Ile % rabatu może dać sprzedawca</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={salesLimits.maxDiscountPercent}
                  onChange={e => setSalesLimits(prev => ({
                    ...prev,
                    maxDiscountPercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                  }))}
                  className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-slate-600 font-medium">%</span>
              </div>
            </div>

            {/* Max Free Extension */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Maksymalne darmowe przedłużenie</p>
                  <p className="text-sm text-slate-500">Ile dni może dać sprzedawca za darmo</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={salesLimits.maxFreeExtensionDays}
                  onChange={e => setSalesLimits(prev => ({
                    ...prev,
                    maxFreeExtensionDays: Math.min(365, Math.max(0, parseInt(e.target.value) || 0))
                  }))}
                  className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-slate-600 font-medium">dni</span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={handleSaveSalesLimits}
                disabled={loading === 'sales'}
              >
                {loading === 'sales' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Zapisz limity
              </Button>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Informacja</p>
                  <p className="text-sm text-blue-700">
                    Sprzedawcy mogą przyznawać rabaty i przedłużenia tylko w ramach tych limitów.
                    Wszystkie działania są logowane do historii.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
