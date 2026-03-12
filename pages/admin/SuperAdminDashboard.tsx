import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Users, TrendingUp, TrendingDown, DollarSign, BarChart3,
  Lock, Unlock, Loader2, AlertCircle, CheckCircle, Clock, Search,
  RefreshCw, Calendar, CreditCard, Activity, ChevronUp, ChevronDown
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAppContext } from '../../context/AppContext';
import { Role } from '../../types';

const MONTHS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze',
                   'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

const PLAN_MRR: Record<string, number> = {
  basic: 299,
  standard: 599,
  professional: 999,
  enterprise: 2499,
  demo: 0,
  trial: 0,
};

interface CompanyRow {
  id: string;
  name: string;
  nip?: string;
  subscription_plan?: string;
  subscription_status?: string;
  is_blocked?: boolean;
  created_at?: string;
  email?: string;
}

export const SuperAdminDashboard: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof CompanyRow>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Guard: only SUPERADMIN
  if (currentUser?.role !== Role.SUPERADMIN) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-6 h-6 mr-2" />
        Brak dostępu. Tylko dla SuperAdmin.
      </div>
    );
  }

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('companies')
        .select('id, name, nip, subscription_plan, subscription_status, is_blocked, created_at, email')
        .order('created_at', { ascending: false });
      setCompanies(data || []);
    } catch (err) {
      console.error('SuperAdmin: error loading companies', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCompanies(); }, []);

  const handleBlockToggle = async (company: CompanyRow) => {
    setBlocking(company.id);
    try {
      await supabase
        .from('companies')
        .update({ is_blocked: !company.is_blocked })
        .eq('id', company.id);
      setCompanies(prev => prev.map(c =>
        c.id === company.id ? { ...c, is_blocked: !c.is_blocked } : c
      ));
    } catch (err) {
      console.error('Error toggling block', err);
    } finally {
      setBlocking(null);
    }
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const kpis = useMemo(() => {
    const total = companies.length;
    const active = companies.filter(c => !c.is_blocked && c.subscription_status !== 'expired').length;
    const newThisMonth = companies.filter(c => c.created_at && new Date(c.created_at) >= monthStart).length;
    const mrr = companies
      .filter(c => !c.is_blocked)
      .reduce((s, c) => s + (PLAN_MRR[c.subscription_plan || ''] || 0), 0);
    return { total, active, newThisMonth, mrr };
  }, [companies]);

  // Growth chart: new companies per month (last 12 months)
  const growthData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const y = d.getFullYear(), m = d.getMonth();
      return {
        name: MONTHS_PL[m],
        Firmy: companies.filter(c => {
          if (!c.created_at) return false;
          const cd = new Date(c.created_at);
          return cd.getFullYear() === y && cd.getMonth() === m;
        }).length,
      };
    });
  }, [companies]);

  // Filtered + sorted companies
  const filteredCompanies = useMemo(() => {
    let list = companies.filter(c =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.nip?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      const va = String(a[sortField] || '');
      const vb = String(b[sortField] || '');
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [companies, search, sortField, sortDir]);

  const recentCompanies = useMemo(
    () => companies.slice(0, 5),
    [companies]
  );

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('pl-PL') : '—';

  const toggleSort = (field: keyof CompanyRow) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: keyof CompanyRow }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  const statusBadge = (company: CompanyRow) => {
    if (company.is_blocked) return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Zablokowana</span>;
    if (company.subscription_status === 'expired') return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">Wygasła</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Aktywna</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SuperAdmin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Zarządzanie wszystkimi firmami na platformie MaxMaster</p>
        </div>
        <button onClick={loadCompanies} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Wszystkich firm', value: kpis.total, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Aktywnych', value: kpis.active, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Nowych w miesiącu', value: kpis.newThisMonth, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
          {
            label: 'MRR (est.)',
            value: new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(kpis.mrr),
            icon: DollarSign,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            isString: true
          },
        ].map(({ label, value, icon: Icon, color, bg, isString }) => (
          <div key={label} className={`p-4 rounded-xl border border-slate-200 ${bg}`}>
            <div className={`flex items-center gap-2 ${color} mb-2`}>
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Growth Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Wzrost liczby firm (ostatnie 12 miesięcy)
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={growthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Firmy" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Registrations */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          Ostatnie rejestracje
        </h2>
        <div className="space-y-2">
          {recentCompanies.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm">
                {(c.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{c.name}</p>
                <p className="text-xs text-slate-500">{formatDate(c.created_at)} • {c.subscription_plan || 'brak planu'}</p>
              </div>
              {statusBadge(c)}
            </div>
          ))}
          {recentCompanies.length === 0 && (
            <p className="text-center py-4 text-slate-400 text-sm">Brak firm</p>
          )}
        </div>
      </div>

      {/* All Companies Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-600" />
            Wszystkie firmy ({filteredCompanies.length})
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Szukaj firmy..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-64" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    { label: 'Nazwa', field: 'name' as keyof CompanyRow },
                    { label: 'NIP', field: 'nip' as keyof CompanyRow },
                    { label: 'Plan', field: 'subscription_plan' as keyof CompanyRow },
                    { label: 'Status', field: 'subscription_status' as keyof CompanyRow },
                    { label: 'Data rejestracji', field: 'created_at' as keyof CompanyRow },
                  ].map(col => (
                    <th key={col.field}
                      onClick={() => toggleSort(col.field)}
                      className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none">
                      {col.label}<SortIcon field={col.field} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map(company => (
                  <tr key={company.id} className={`hover:bg-slate-50 ${company.is_blocked ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                          {(company.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{company.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{company.nip || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 capitalize">
                        {company.subscription_plan || 'brak'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(company)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(company.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleBlockToggle(company)}
                        disabled={blocking === company.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          company.is_blocked
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        } disabled:opacity-50`}>
                        {blocking === company.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : company.is_blocked ? (
                          <><Unlock className="w-3 h-3" /> Odblokuj</>
                        ) : (
                          <><Lock className="w-3 h-3" /> Zablokuj</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCompanies.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Brak firm spełniających kryteria wyszukiwania
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
