import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, FileSpreadsheet, Calculator, Download, Upload,
  Loader2, AlertCircle, CheckCircle2, Plus, Pencil, Trash2, X,
  FileText, Package, Monitor, Settings, Send, Eye, RefreshCw,
  DollarSign, Clock, Percent, ChevronDown, ChevronRight
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type {
  KosztorysRequest, KosztorysEstimate, KosztorysEstimateItem,
} from '../../types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Szkic', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  pending_approval: { label: 'Do zatwierdzenia', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  approved: { label: 'Zatwierdzony', color: 'text-green-700', bgColor: 'bg-green-100' },
  rejected: { label: 'Odrzucony', color: 'text-red-700', bgColor: 'bg-red-100' },
  revision: { label: 'Do poprawy', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  sent: { label: 'Wysłany', color: 'text-blue-700', bgColor: 'bg-blue-100' },
};

export const EstimateViewPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;
  const { estimateId } = useParams<{ estimateId: string }>();
  const [searchParams] = useSearchParams();
  const requestIdFromUrl = searchParams.get('request');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [estimate, setEstimate] = useState<KosztorysEstimate | null>(null);
  const [request, setRequest] = useState<KosztorysRequest | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);

  // Editing state
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemDialog, setItemDialog] = useState(false);

  // Margins and discounts
  const [marginPercent, setMarginPercent] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['work', 'equipment', 'summary']));

  useEffect(() => {
    if (currentUser && (estimateId || requestIdFromUrl)) {
      loadData();
    }
  }, [currentUser, estimateId, requestIdFromUrl]);

  const loadData = async () => {
    setLoading(true);
    try {
      let estimateData: KosztorysEstimate | null = null;

      if (estimateId) {
        const { data } = await supabase
          .from('kosztorys_estimates')
          .select(`
            *,
            request:kosztorys_requests(*)
          `)
          .eq('id', estimateId)
          .single();
        estimateData = data;
        setRequest(data?.request || null);
      } else if (requestIdFromUrl) {
        // Load latest estimate for request
        const { data } = await supabase
          .from('kosztorys_estimates')
          .select(`
            *,
            request:kosztorys_requests(*)
          `)
          .eq('request_id', requestIdFromUrl)
          .order('version', { ascending: false })
          .limit(1)
          .single();
        estimateData = data;
        setRequest(data?.request || null);
      }

      if (estimateData) {
        setEstimate(estimateData);
        setMarginPercent(0);
        setDiscountPercent(0);

        // Load estimate items
        const { data: itemsData } = await supabase
          .from('kosztorys_estimate_items')
          .select('*')
          .eq('estimate_id', estimateData.id)
          .order('position_number');
        setItems(itemsData || []);

        // Load equipment items with equipment details
        const { data: eqData } = await supabase
          .from('kosztorys_estimate_equipment')
          .select(`
            *,
            equipment:kosztorys_equipment(code, name, unit)
          `)
          .eq('estimate_id', estimateData.id);
        setEquipment(eqData || []);
      }
    } catch (error) {
      console.error('Error loading estimate:', error);
      showNotification('Błąd podczas ładowania kosztorysu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Calculate totals
  const totals = useMemo(() => {
    const workTotal = items.reduce((sum, item) => sum + (item.total_work || 0), 0);
    const materialTotal = items.reduce((sum, item) => sum + (item.total_material || 0), 0);
    const equipmentTotal = equipment.reduce((sum, eq) => sum + (eq.total || 0), 0);
    const subtotal = workTotal + materialTotal + equipmentTotal;
    const vatRate = estimate?.vat_rate || 23;
    const vatAmount = subtotal * (vatRate / 100);
    const grandTotal = subtotal + vatAmount;

    return {
      workTotal,
      materialTotal,
      equipmentTotal,
      subtotal,
      vatAmount,
      grandTotal,
    };
  }, [items, equipment, estimate]);

  const handleSave = async () => {
    if (!estimate) return;
    setSaving(true);

    try {
      const subtotalNet = totals.workTotal + totals.materialTotal + totals.equipmentTotal;
      const vatAmount = subtotalNet * (estimate.vat_rate || 23) / 100;
      const totalGross = subtotalNet + vatAmount;

      const { error } = await supabase
        .from('kosztorys_estimates')
        .update({
          total_works: totals.workTotal,
          total_materials: totals.materialTotal,
          total_equipment: totals.equipmentTotal,
          subtotal_net: subtotalNet,
          vat_amount: vatAmount,
          total_gross: totalGross,
        })
        .eq('id', estimate.id);

      if (error) throw error;
      showNotification('Kosztorys zapisany', 'success');
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateItem = async (item: any) => {
    try {
      const totalWork = item.quantity * (item.unit_price_work || 0);
      const totalMaterial = item.quantity * (item.unit_price_material || 0);
      const totalItem = totalWork + totalMaterial;

      const { error } = await supabase
        .from('kosztorys_estimate_items')
        .update({
          task_description: item.task_description,
          quantity: item.quantity,
          unit_price_work: item.unit_price_work,
          total_work: totalWork,
          unit_price_material: item.unit_price_material,
          total_material: totalMaterial,
          total_item: totalItem,
        })
        .eq('id', item.id);

      if (error) throw error;
      await loadData();
      showNotification('Pozycja zaktualizowana', 'success');
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas aktualizacji', 'error');
    }
    setItemDialog(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę pozycję?')) return;

    try {
      const { error } = await supabase
        .from('kosztorys_estimate_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      await loadData();
      showNotification('Pozycja usunięta', 'success');
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
  };

  const handleExportCSV = async () => {
    if (!estimate) return;
    try {
      const { downloadEstimateCSV } = await import('../../lib/estimateExport');
      const success = await downloadEstimateCSV(estimate.id);
      if (success) {
        showNotification('Kosztorys wyeksportowany do CSV', 'success');
      } else {
        showNotification('Błąd eksportu', 'error');
      }
    } catch (error: any) {
      showNotification(error.message || 'Błąd eksportu', 'error');
    }
  };

  const handlePrint = async () => {
    if (!estimate) return;
    try {
      const { printEstimate } = await import('../../lib/estimateExport');
      await printEstimate(estimate.id);
    } catch (error: any) {
      showNotification(error.message || 'Błąd drukowania', 'error');
    }
  };

  const handleGenerateProposal = async () => {
    if (!estimate) return;
    try {
      const { downloadProposal } = await import('../../lib/proposalGenerator');
      const success = await downloadProposal(estimate.id);
      if (success) {
        showNotification('Oferta handlowa wygenerowana', 'success');
      } else {
        showNotification('Błąd generowania oferty', 'error');
      }
    } catch (error: any) {
      showNotification(error.message || 'Błąd generowania oferty', 'error');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!estimate) return;

    try {
      const { error } = await supabase
        .from('kosztorys_estimates')
        .update({ status: newStatus })
        .eq('id', estimate.id);

      if (error) throw error;

      // Update request status if estimate is approved
      if (newStatus === 'approved' && request) {
        await supabase
          .from('kosztorys_requests')
          .update({ status: 'estimate_approved' })
          .eq('id', request.id);
      }

      await loadData();
      showNotification('Status zmieniony', 'success');
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas zmiany statusu', 'error');
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
        <p className="text-slate-500">Nie znaleziono kosztorysu</p>
        <button
          onClick={() => navigate('/construction/estimates')}
          className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-700"
        >
          Wróć do listy
        </button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[estimate.status] || STATUS_CONFIG.draft;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/construction/estimates')}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Kosztorys v{estimate.version}
              </h1>
              {request && (
                <p className="text-sm text-slate-500">
                  {request.investment_name} • {request.client_name}
                </p>
              )}
            </div>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={estimate.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="draft">Szkic</option>
              <option value="pending_approval">Do zatwierdzenia</option>
              <option value="approved">Zatwierdzony</option>
              <option value="rejected">Odrzucony</option>
              <option value="revision">Do poprawy</option>
              <option value="sent">Wysłany</option>
            </select>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Zapisz
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              title="Eksport do CSV"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              title="Drukuj / PDF"
            >
              <FileText className="w-4 h-4" />
              Drukuj
            </button>
            <button
              onClick={handleGenerateProposal}
              disabled={estimate.status !== 'approved'}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              title={estimate.status !== 'approved' ? 'Zatwierdź kosztorys przed generowaniem KP' : 'Generuj ofertę handlową'}
            >
              <Send className="w-4 h-4" />
              Generuj KP
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Work Items Section */}
          <div className="bg-white rounded-lg border border-slate-200">
            <button
              onClick={() => toggleSection('work')}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                {expandedSections.has('work') ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-slate-900">Pozycje kosztorysowe</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                  {items.length}
                </span>
              </div>
              <span className="font-bold text-slate-900">
                {totals.workTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
              </span>
            </button>
            {expandedSections.has('work') && (
              <div className="border-t border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nr</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dział</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Opis pracy</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ilość</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cena pracy</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Praca</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Materiały</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Razem</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-500">{item.position_number || index + 1}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.room_group}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{item.task_description}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">
                          {item.unit_price_work?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">
                          {item.total_work?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-right">
                          {item.total_material?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">
                          {item.total_item?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setItemDialog(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Equipment Section */}
          <div className="bg-white rounded-lg border border-slate-200">
            <button
              onClick={() => toggleSection('equipment')}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                {expandedSections.has('equipment') ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
                <Monitor className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-slate-900">Sprzęt</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                  {equipment.length}
                </span>
              </div>
              <span className="font-bold text-slate-900">
                {totals.equipmentTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
              </span>
            </button>
            {expandedSections.has('equipment') && equipment.length > 0 && (
              <div className="border-t border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nr</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nazwa</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Jedn.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ilość</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cena jedn.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Wartość</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {equipment.map((eq, index) => (
                      <tr key={eq.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{eq.equipment?.code || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{eq.equipment?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{eq.equipment?.unit || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{eq.quantity}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">
                          {eq.unit_price?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">
                          {eq.total?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="bg-white rounded-lg border border-slate-200">
            <button
              onClick={() => toggleSection('summary')}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                {expandedSections.has('summary') ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
                <Calculator className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-slate-900">Podsumowanie</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {totals.grandTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
              </span>
            </button>
            {expandedSections.has('summary') && (
              <div className="border-t border-slate-200 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <FileText className="w-4 h-4" />
                      Prace
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {totals.workTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <Package className="w-4 h-4" />
                      Materiały
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {totals.materialTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <Monitor className="w-4 h-4" />
                      Sprzęt
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {totals.equipmentTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-slate-600">Suma netto:</span>
                    <span className="font-bold text-slate-900">
                      {totals.subtotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">VAT ({estimate?.vat_rate || 23}%):</span>
                    <span className="font-medium text-slate-700">
                      {totals.vatAmount.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-200 text-xl">
                    <span className="font-semibold text-slate-900">RAZEM BRUTTO:</span>
                    <span className="font-bold text-green-600">
                      {totals.grandTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Item Dialog */}
      {itemDialog && editingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Edytuj pozycję</h2>
              <button onClick={() => setItemDialog(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis pracy</label>
                <input
                  type="text"
                  value={editingItem.task_description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, task_description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ilość</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.quantity || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cena pracy (jedn.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.unit_price_work || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, unit_price_work: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cena materiałów (jedn.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingItem.unit_price_material || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, unit_price_material: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setItemDialog(false)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleUpdateItem(editingItem)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white flex items-center gap-2`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default EstimateViewPage;
