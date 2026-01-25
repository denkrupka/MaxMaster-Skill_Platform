
import React, { useState, useMemo } from 'react';
import { Plus, X, Search, Calendar, DollarSign, Percent, User } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { DealStage, DealPriority, CRMDeal } from '../../types';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS, DEAL_PRIORITY_LABELS, DEAL_PRIORITY_COLORS, MODULE_LABELS } from '../../constants';

export const SalesPipeline: React.FC = () => {
  const { state } = useAppContext();
  const { crmDeals, crmCompanies } = state;

  const [search, setSearch] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<CRMDeal | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);

  // Filter deals
  const filteredDeals = useMemo(() => {
    return crmDeals.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));
  }, [crmDeals, search]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<DealStage, CRMDeal[]> = {
      [DealStage.LEAD]: [], [DealStage.QUALIFIED]: [], [DealStage.PROPOSAL]: [],
      [DealStage.NEGOTIATION]: [], [DealStage.WON]: [], [DealStage.LOST]: []
    };
    filteredDeals.forEach(deal => { grouped[deal.stage].push(deal); });
    return grouped;
  }, [filteredDeals]);

  const handleDragStart = (dealId: string) => setDraggedDeal(dealId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (stage: DealStage) => {
    if (!draggedDeal) return;
    // TODO: Update deal stage via API
    console.log('Move deal', draggedDeal, 'to stage', stage);
    setDraggedDeal(null);
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(value);

  const kanbanStages: DealStage[] = [DealStage.LEAD, DealStage.QUALIFIED, DealStage.PROPOSAL, DealStage.NEGOTIATION];

  const DealCard = ({ deal }: { deal: CRMDeal }) => {
    const company = crmCompanies.find(c => c.id === deal.crm_company_id);
    return (
      <div draggable onDragStart={() => handleDragStart(deal.id)} onClick={() => setSelectedDeal(deal)}
        className={`bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${draggedDeal === deal.id ? 'opacity-50' : ''}`}>
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

  const KanbanColumn = ({ stage }: { stage: DealStage }) => {
    const stageDeals = dealsByStage[stage];
    const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    return (
      <div onDragOver={handleDragOver} onDrop={() => handleDrop(stage)} className="flex-1 min-w-[280px] max-w-[320px] bg-slate-50 rounded-xl p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${DEAL_STAGE_COLORS[stage].replace('text-', 'bg-').replace('-100', '-500').replace('-700', '-500')}`} />
            <h3 className="font-semibold text-slate-900">{DEAL_STAGE_LABELS[stage]}</h3>
            <span className="text-xs text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full">{stageDeals.length}</span>
          </div>
        </div>
        <div className="text-sm text-slate-600 mb-3 pb-3 border-b border-slate-200">{formatCurrency(totalValue)}</div>
        <div className="space-y-2 min-h-[200px]">
          {stageDeals.map(deal => (<DealCard key={deal.id} deal={deal} />))}
        </div>
        <button className="w-full mt-3 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium border border-dashed border-slate-300 rounded-lg hover:border-slate-400 transition flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" />Dodaj deal
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-500 mt-1">Zarządzaj dealami metodą Kanban</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Szukaj deali..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"><Plus className="w-4 h-4" />Nowy Deal</button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {kanbanStages.map(stage => (<KanbanColumn key={stage} stage={stage} />))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold text-green-800">Wygrane</h3><p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(dealsByStage[DealStage.WON].reduce((sum, d) => sum + (d.value || 0), 0))}</p></div>
            <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full text-sm font-medium">{dealsByStage[DealStage.WON].length} deali</span>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold text-red-800">Przegrane</h3><p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency(dealsByStage[DealStage.LOST].reduce((sum, d) => sum + (d.value || 0), 0))}</p></div>
            <span className="text-red-600 bg-red-100 px-3 py-1 rounded-full text-sm font-medium">{dealsByStage[DealStage.LOST].length} deali</span>
          </div>
        </div>
      </div>

      {selectedDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{selectedDeal.title}</h3>
              <button onClick={() => setSelectedDeal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${DEAL_STAGE_COLORS[selectedDeal.stage]}`}>{DEAL_STAGE_LABELS[selectedDeal.stage]}</span>
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
              <button className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Usuń</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
