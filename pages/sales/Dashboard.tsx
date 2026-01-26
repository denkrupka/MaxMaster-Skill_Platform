
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Users, Building2, DollarSign, Target,
  ChevronRight, Calendar, Phone, Mail, Clock, CheckSquare
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { DealStage, ActivityType } from '../../types';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '../../constants';

// Custom stage type for dynamic stages (same as Pipeline.tsx)
interface CustomStage {
  id: string;
  name: string;
  color: string;
}

// Default stages
const DEFAULT_STAGES: CustomStage[] = [
  { id: DealStage.LEAD, name: 'Nowy Lead', color: 'bg-slate-500' },
  { id: DealStage.QUALIFIED, name: 'Zakwalifikowany', color: 'bg-blue-500' },
  { id: DealStage.PROPOSAL, name: 'Propozycja', color: 'bg-purple-500' },
  { id: DealStage.NEGOTIATION, name: 'Negocjacje', color: 'bg-orange-500' },
];

export const SalesDashboard: React.FC = () => {
  const { state } = useAppContext();
  const { crmDeals, crmCompanies, crmContacts, crmActivities } = state;
  const navigate = useNavigate();

  // Load custom stages from localStorage (synced with Pipeline.tsx)
  const [stages, setStages] = useState<CustomStage[]>(() => {
    const saved = localStorage.getItem('crm_custom_stages');
    return saved ? JSON.parse(saved) : DEFAULT_STAGES;
  });

  // Listen for localStorage changes (when stages are modified in Pipeline)
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('crm_custom_stages');
      if (saved) {
        setStages(JSON.parse(saved));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Also check on focus in case changes happened in same tab
    window.addEventListener('focus', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  // Stats calculations
  const stats = useMemo(() => {
    const totalValue = crmDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const weightedValue = crmDeals.reduce((sum, d) => sum + ((d.value || 0) * (d.probability / 100)), 0);
    const activeDeals = crmDeals.filter(d => d.stage !== DealStage.WON && d.stage !== DealStage.LOST).length;
    const lprCount = crmContacts.filter(c => c.is_decision_maker).length;

    return {
      totalPipeline: totalValue,
      weightedPipeline: weightedValue,
      activeDeals,
      companiesCount: crmCompanies.length,
      contactsCount: crmContacts.length,
      lprCount
    };
  }, [crmDeals, crmCompanies, crmContacts]);

  // Pipeline by stage - uses dynamic stages from localStorage
  const pipelineByStage = useMemo(() => {
    return stages.map(stage => ({
      stage: stage.id,
      stageName: stage.name,
      stageColor: stage.color,
      count: crmDeals.filter(d => d.stage === stage.id).length,
      value: crmDeals.filter(d => d.stage === stage.id).reduce((sum, d) => sum + (d.value || 0), 0)
    }));
  }, [crmDeals, stages]);

  // Upcoming activities
  const upcomingActivities = useMemo(() => {
    return crmActivities
      .filter(a => !a.is_completed && a.scheduled_at)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      .slice(0, 5);
  }, [crmActivities]);

  // Recent deals
  const recentDeals = useMemo(() => {
    return crmDeals
      .filter(d => d.stage !== DealStage.WON && d.stage !== DealStage.LOST)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [crmDeals]);

  const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, onClick }: {
    title: string; value: string | number; subtitle?: string; icon: any; colorClass: string; onClick?: () => void;
  }) => (
    <div onClick={onClick} className={`bg-white p-6 rounded-xl border border-slate-200 ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-all`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}><Icon className="w-5 h-5" /></div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );

  const formatCurrency = (value: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(value);

  const getActivityIcon = (type: ActivityType) => {
    switch (type) { case ActivityType.CALL: return Phone; case ActivityType.EMAIL: return Mail; case ActivityType.MEETING: return Calendar; default: return Clock; }
  };
  const getActivityColor = (type: ActivityType) => {
    switch (type) { case ActivityType.CALL: return 'bg-green-100 text-green-600'; case ActivityType.EMAIL: return 'bg-blue-100 text-blue-600'; case ActivityType.MEETING: return 'bg-purple-100 text-purple-600'; default: return 'bg-slate-100 text-slate-600'; }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Sprzedaży</h1>
        <p className="text-slate-500 mt-1">Przegląd CRM i aktywności</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Wartość Pipeline" value={formatCurrency(stats.totalPipeline)} subtitle={`Ważona: ${formatCurrency(stats.weightedPipeline)}`} icon={DollarSign} colorClass="bg-green-100 text-green-600" />
        <StatCard title="Aktywne Deale" value={stats.activeDeals} subtitle="W toku" icon={Target} colorClass="bg-blue-100 text-blue-600" onClick={() => navigate('/sales/pipeline')} />
        <StatCard title="Firmy" value={stats.companiesCount} subtitle="W bazie" icon={Building2} colorClass="bg-purple-100 text-purple-600" onClick={() => navigate('/sales/companies')} />
        <StatCard title="Kontakty" value={stats.contactsCount} subtitle="W bazie" icon={Users} colorClass="bg-orange-100 text-orange-600" onClick={() => navigate('/sales/contacts')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">CRM</h2>
            <button onClick={() => navigate('/sales/pipeline')} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
              Zobacz wszystko <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {stats.totalPipeline > 0 ? (
            <div className="space-y-4">
              {pipelineByStage.map(item => (
                <div key={item.stage} className="flex items-center gap-4 cursor-pointer hover:bg-slate-50 rounded-lg p-1 -m-1 transition" onClick={() => navigate('/sales/pipeline')}>
                  <div className="w-28 text-sm text-slate-600">{item.stageName}</div>
                  <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                    <div className={`h-full ${item.stageColor}`} style={{ width: `${Math.min((item.value / stats.totalPipeline) * 100, 100)}%` }} />
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-sm font-medium text-slate-700">{item.count} deali</span>
                      <span className="text-sm font-medium text-slate-700">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Brak aktywnych deali</p>
              <button onClick={() => navigate('/sales/pipeline')} className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium">Dodaj pierwszy deal</button>
            </div>
          )}

          {recentDeals.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="font-medium text-slate-900 mb-3">Ostatnie Deale</h3>
              <div className="space-y-3">
                {recentDeals.map(deal => {
                  const dealStage = stages.find(s => s.id === deal.stage);
                  return (
                    <div key={deal.id} onClick={() => navigate('/sales/pipeline')} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                      <div>
                        <p className="font-medium text-slate-900">{deal.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${DEAL_STAGE_COLORS[deal.stage] || 'bg-slate-100 text-slate-700'}`}>{dealStage?.name || DEAL_STAGE_LABELS[deal.stage] || deal.stage}</span>
                          <span className="text-xs text-slate-500">{deal.probability}% szansy</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(deal.value || 0)}</p>
                        {deal.expected_close_date && (<p className="text-xs text-slate-500 flex items-center gap-1 justify-end"><Calendar className="w-3 h-3" />{new Date(deal.expected_close_date).toLocaleDateString('pl-PL')}</p>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Zadania</h2>
            <CheckSquare className="w-5 h-5 text-slate-400" />
          </div>
          {upcomingActivities.length > 0 ? (
            <div className="space-y-3">
              {upcomingActivities.map(activity => {
                const IconComponent = getActivityIcon(activity.activity_type);
                const colorClass = getActivityColor(activity.activity_type);
                return (
                  <div key={activity.id} onClick={() => navigate('/sales/activities')} className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition cursor-pointer">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}><IconComponent className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{activity.subject}</p>
                      {activity.scheduled_at && (<p className="text-xs text-slate-500 mt-1">{new Date(activity.scheduled_at).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Brak zaplanowanych zadań</p>
            </div>
          )}
          <button onClick={() => navigate('/sales/activities')} className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition">Zobacz wszystkie zadania</button>
        </div>
      </div>
    </div>
  );
};
