
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, Calendar, DollarSign, Percent, User, Trash2, Edit3, GripVertical } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { DealStage, DealPriority, CRMDeal } from '../../types';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS, DEAL_PRIORITY_LABELS, DEAL_PRIORITY_COLORS, MODULE_LABELS } from '../../constants';

// Custom stage type for dynamic stages
interface CustomStage {
  id: string;
  name: string;
  color: string;
}

// Default stages based on DealStage enum
const DEFAULT_STAGES: CustomStage[] = [
  { id: DealStage.LEAD, name: 'Nowy Lead', color: 'bg-slate-500' },
  { id: DealStage.QUALIFIED, name: 'Zakwalifikowany', color: 'bg-blue-500' },
  { id: DealStage.PROPOSAL, name: 'Propozycja', color: 'bg-purple-500' },
  { id: DealStage.NEGOTIATION, name: 'Negocjacje', color: 'bg-orange-500' },
];

const STAGE_COLORS = [
  'bg-slate-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
  'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-lime-500'
];

export const SalesPipeline: React.FC = () => {
  const { state, addCrmDeal, updateCrmDeal, deleteCrmDeal } = useAppContext();
  const { crmDeals, crmCompanies } = state;

  const [search, setSearch] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<CRMDeal | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [newDealStage, setNewDealStage] = useState<string>(DealStage.LEAD);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editedStageName, setEditedStageName] = useState('');

  // Custom stages management
  const [stages, setStages] = useState<CustomStage[]>(() => {
    const saved = localStorage.getItem('crm_custom_stages');
    return saved ? JSON.parse(saved) : DEFAULT_STAGES;
  });

  // Save stages to localStorage
  useEffect(() => {
    localStorage.setItem('crm_custom_stages', JSON.stringify(stages));
  }, [stages]);

  // New deal form state
  const [newDeal, setNewDeal] = useState({
    title: '',
    crm_company_id: '',
    value: '',
    probability: '50',
    expected_close_date: '',
    employee_count_estimate: '',
    modules_interested: [] as string[],
    notes: '',
    priority: DealPriority.MEDIUM
  });

  // Filter deals
  const filteredDeals = useMemo(() => {
    return crmDeals.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));
  }, [crmDeals, search]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, CRMDeal[]> = {};
    stages.forEach(stage => {
      grouped[stage.id] = [];
    });
    // Also add WON and LOST for summary
    grouped[DealStage.WON] = [];
    grouped[DealStage.LOST] = [];

    filteredDeals.forEach(deal => {
      if (grouped[deal.stage]) {
        grouped[deal.stage].push(deal);
      }
    });
    return grouped;
  }, [filteredDeals, stages]);

  const handleDragStart = (dealId: string) => setDraggedDeal(dealId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (stageId: string) => {
    if (!draggedDeal) return;

    const deal = crmDeals.find(d => d.id === draggedDeal);
    if (deal && deal.stage !== stageId) {
      try {
        await updateCrmDeal(draggedDeal, { stage: stageId as DealStage });
      } catch (error) {
        console.error('Failed to update deal stage:', error);
      }
    }
    setDraggedDeal(null);
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(value);

  const handleCreateDeal = async () => {
    if (!newDeal.title.trim()) return;

    try {
      await addCrmDeal({
        title: newDeal.title,
        crm_company_id: newDeal.crm_company_id || undefined,
        value: newDeal.value ? parseFloat(newDeal.value) : undefined,
        probability: parseInt(newDeal.probability),
        expected_close_date: newDeal.expected_close_date || undefined,
        employee_count_estimate: newDeal.employee_count_estimate ? parseInt(newDeal.employee_count_estimate) : undefined,
        modules_interested: newDeal.modules_interested.length > 0 ? newDeal.modules_interested : undefined,
        notes: newDeal.notes || undefined,
        priority: newDeal.priority,
        stage: newDealStage as DealStage
      });

      // Reset form
      setNewDeal({
        title: '',
        crm_company_id: '',
        value: '',
        probability: '50',
        expected_close_date: '',
        employee_count_estimate: '',
        modules_interested: [],
        notes: '',
        priority: DealPriority.MEDIUM
      });
      setShowNewDealModal(false);
    } catch (error) {
      console.error('Failed to create deal:', error);
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten deal?')) return;
    try {
      await deleteCrmDeal(dealId);
      setSelectedDeal(null);
    } catch (error) {
      console.error('Failed to delete deal:', error);
    }
  };

  const openNewDealModal = (stageId: string) => {
    setNewDealStage(stageId);
    setShowNewDealModal(true);
  };

  // Stage management functions
  const handleEditStageName = (stageId: string, currentName: string) => {
    setEditingStage(stageId);
    setEditedStageName(currentName);
  };

  const handleSaveStageName = (stageId: string) => {
    if (editedStageName.trim()) {
      setStages(prev => prev.map(s =>
        s.id === stageId ? { ...s, name: editedStageName.trim() } : s
      ));
    }
    setEditingStage(null);
    setEditedStageName('');
  };

  const handleAddStage = () => {
    const newId = `custom_${Date.now()}`;
    const usedColors = stages.map(s => s.color);
    const availableColor = STAGE_COLORS.find(c => !usedColors.includes(c)) || STAGE_COLORS[stages.length % STAGE_COLORS.length];

    setStages(prev => [...prev, {
      id: newId,
      name: 'Nowy status',
      color: availableColor
    }]);
  };

  const handleDeleteStage = (stageId: string) => {
    const stageDeals = dealsByStage[stageId] || [];
    if (stageDeals.length > 0) {
      alert('Nie można usunąć statusu, który zawiera deale. Najpierw przenieś deale do innego statusu.');
      return;
    }

    if (stages.length <= 1) {
      alert('Musisz mieć co najmniej jeden status.');
      return;
    }

    if (confirm('Czy na pewno chcesz usunąć ten status?')) {
      setStages(prev => prev.filter(s => s.id !== stageId));
    }
  };

  const DealCard = ({ deal }: { deal: CRMDeal }) => {
    const company = crmCompanies.find(c => c.id === deal.crm_company_id);
    return (
      <div draggable onDragStart={() => handleDragStart(deal.id)} onClick={() => setSelectedDeal(deal)}
        className={`bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${draggedDeal === deal.id ? 'opacity-50 scale-95' : ''}`}>
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-slate-900 text-sm line-clamp-2">{deal.title}</h4>
          {deal.priority === DealPriority.URGENT && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">!</span>}
        </div>
        {company && <p className="text-xs text-slate-500 mb-2">{company.name}</p>}
        <div className="space-y-1.5">
          {deal.value && (<div className="flex items-center gap-1.5 text-sm"><DollarSign className="w-3.5 h-3.5 text-green-500" /><span className="font-semibold text-green-700">{formatCurrency(deal.value)}</span></div>)}
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><Percent className="w-3 h-3" /><span>{deal.probability}% szansy</span></div>
          {deal.expected_close_date && (<div className="flex items-center gap-1.5 text-xs text-slate-500"><Calendar className="w-3 h-3" /><span>{new Date(deal.expected_close_date).toLocaleDateString('pl-PL')}</span></div>)}
          {deal.employee_count_estimate && (<div className="flex items-center gap-1.5 text-xs text-slate-500"><User className="w-3 h-3" /><span>{deal.employee_count_estimate} użytkowników</span></div>)}
        </div>
        {deal.modules_interested && deal.modules_interested.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
            {deal.modules_interested.map(mod => (<span key={mod} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{MODULE_LABELS[mod] || mod}</span>))}
          </div>
        )}
      </div>
    );
  };

  const KanbanColumn = ({ stage }: { stage: CustomStage }) => {
    const stageDeals = dealsByStage[stage.id] || [];
    const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

    return (
      <div onDragOver={handleDragOver} onDrop={() => handleDrop(stage.id)} className="flex-1 min-w-[280px] max-w-[320px] bg-slate-50 rounded-xl p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${stage.color}`} />
            {editingStage === stage.id ? (
              <input
                type="text"
                value={editedStageName}
                onChange={(e) => setEditedStageName(e.target.value)}
                onBlur={() => handleSaveStageName(stage.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveStageName(stage.id);
                  if (e.key === 'Escape') {
                    setEditingStage(null);
                    setEditedStageName('');
                  }
                }}
                className="font-semibold text-slate-900 bg-white border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <h3
                className="font-semibold text-slate-900 cursor-pointer hover:text-blue-600 truncate"
                onClick={() => handleEditStageName(stage.id, stage.name)}
                title="Kliknij, aby edytować nazwę"
              >
                {stage.name}
              </h3>
            )}
            <span className="text-xs text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full flex-shrink-0">{stageDeals.length}</span>
          </div>
          <button
            onClick={() => handleDeleteStage(stage.id)}
            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Usuń status"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm text-slate-600 mb-3 pb-3 border-b border-slate-200">{formatCurrency(totalValue)}</div>
        <div className="space-y-2 min-h-[200px]">
          {stageDeals.map(deal => (<DealCard key={deal.id} deal={deal} />))}
        </div>
        <button
          onClick={() => openNewDealModal(stage.id)}
          className="w-full mt-3 py-2 text-slate-500 hover:text-blue-600 text-sm font-medium border border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" />Dodaj deal
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM</h1>
          <p className="text-slate-500 mt-1">Zarządzaj dealami metodą Kanban</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Szukaj deali..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <button
            onClick={() => openNewDealModal(stages[0]?.id || DealStage.LEAD)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />Nowy Deal
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (<KanbanColumn key={stage.id} stage={stage} />))}

        {/* Add new stage button */}
        <div className="flex-shrink-0">
          <button
            onClick={handleAddStage}
            className="w-[280px] h-full min-h-[400px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-8 h-8" />
            <span className="font-medium">Dodaj status</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold text-green-800">Wygrane</h3><p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency((dealsByStage[DealStage.WON] || []).reduce((sum, d) => sum + (d.value || 0), 0))}</p></div>
            <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full text-sm font-medium">{(dealsByStage[DealStage.WON] || []).length} deali</span>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold text-red-800">Przegrane</h3><p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency((dealsByStage[DealStage.LOST] || []).reduce((sum, d) => sum + (d.value || 0), 0))}</p></div>
            <span className="text-red-600 bg-red-100 px-3 py-1 rounded-full text-sm font-medium">{(dealsByStage[DealStage.LOST] || []).length} deali</span>
          </div>
        </div>
      </div>

      {/* New Deal Modal */}
      {showNewDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Nowy Deal</h3>
              <button onClick={() => setShowNewDealModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa deala *</label>
                <input
                  type="text"
                  value={newDeal.title}
                  onChange={(e) => setNewDeal(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="np. Firma XYZ - Wdrożenie systemu"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                <select
                  value={newDeal.crm_company_id}
                  onChange={(e) => setNewDeal(prev => ({ ...prev, crm_company_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Wybierz firmę...</option>
                  {crmCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Wartość (PLN)</label>
                  <input
                    type="number"
                    value={newDeal.value}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, value: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="np. 25000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prawdopodobieństwo (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newDeal.probability}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, probability: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data zamknięcia</label>
                  <input
                    type="date"
                    value={newDeal.expected_close_date}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, expected_close_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Liczba użytkowników</label>
                  <input
                    type="number"
                    value={newDeal.employee_count_estimate}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, employee_count_estimate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="np. 50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priorytet</label>
                <select
                  value={newDeal.priority}
                  onChange={(e) => setNewDeal(prev => ({ ...prev, priority: e.target.value as DealPriority }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.values(DealPriority).map(p => (
                    <option key={p} value={p}>{DEAL_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zainteresowane moduły</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MODULE_LABELS).map(([code, label]) => (
                    <label key={code} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newDeal.modules_interested.includes(code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewDeal(prev => ({ ...prev, modules_interested: [...prev.modules_interested, code] }));
                          } else {
                            setNewDeal(prev => ({ ...prev, modules_interested: prev.modules_interested.filter(m => m !== code) }));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notatki</label>
                <textarea
                  value={newDeal.notes}
                  onChange={(e) => setNewDeal(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Dodatkowe informacje..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowNewDealModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleCreateDeal}
                disabled={!newDeal.title.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Utwórz deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{selectedDeal.title}</h3>
              <button onClick={() => setSelectedDeal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${DEAL_STAGE_COLORS[selectedDeal.stage] || 'bg-slate-100 text-slate-700'}`}>
                  {stages.find(s => s.id === selectedDeal.stage)?.name || DEAL_STAGE_LABELS[selectedDeal.stage] || selectedDeal.stage}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${DEAL_PRIORITY_COLORS[selectedDeal.priority]}`}>{DEAL_PRIORITY_LABELS[selectedDeal.priority]}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500 mb-1">Wartość</p><p className="text-lg font-bold text-green-600">{formatCurrency(selectedDeal.value || 0)}</p></div>
                <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500 mb-1">Prawdopodobieństwo</p><p className="text-lg font-bold text-slate-900">{selectedDeal.probability}%</p></div>
              </div>
              {selectedDeal.expected_close_date && (<div className="flex items-center gap-2 text-slate-600"><Calendar className="w-4 h-4" /><span>Planowane zamknięcie: {new Date(selectedDeal.expected_close_date).toLocaleDateString('pl-PL')}</span></div>)}
              {selectedDeal.modules_interested && selectedDeal.modules_interested.length > 0 && (
                <div><p className="text-sm text-slate-500 mb-2">Zainteresowane moduły:</p><div className="flex flex-wrap gap-2">{selectedDeal.modules_interested.map(mod => (<span key={mod} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">{MODULE_LABELS[mod] || mod}</span>))}</div></div>
              )}
              {selectedDeal.notes && (<div><p className="text-sm text-slate-500 mb-1">Notatki:</p><p className="text-slate-700">{selectedDeal.notes}</p></div>)}
            </div>
            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
              <button className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Edytuj</button>
              <button
                onClick={() => handleDeleteDeal(selectedDeal.id)}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
