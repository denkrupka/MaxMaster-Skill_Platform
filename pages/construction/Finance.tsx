import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, DollarSign, TrendingUp, TrendingDown, Wallet,
  CreditCard, Loader2, Filter, Download, Calendar, Building2,
  FileText, ArrowUpRight, ArrowDownRight, PieChart, BarChart3,
  Receipt, CheckCircle, Clock, AlertCircle, X, Pencil
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project, FinanceAccount, FinanceOperation, FinanceAct,
  FinanceOperationType, FinanceOperationStatus, ActStatus
} from '../../types';
import {
  FINANCE_OPERATION_TYPE_LABELS, FINANCE_OPERATION_TYPE_COLORS,
  FINANCE_OPERATION_STATUS_LABELS, ACT_STATUS_LABELS, ACT_STATUS_COLORS
} from '../../constants';

type TabType = 'operations' | 'acts' | 'accounts' | 'budget';

export const FinancePage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [activeTab, setActiveTab] = useState<TabType>('operations');
  const [operations, setOperations] = useState<FinanceOperation[]>([]);
  const [acts, setActs] = useState<FinanceAct[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<FinanceOperationType | 'all'>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const [showOperationModal, setShowOperationModal] = useState(false);
  const [showActModal, setShowActModal] = useState(false);
  const [editingOperation, setEditingOperation] = useState<FinanceOperation | null>(null);
  const [editingAct, setEditingAct] = useState<FinanceAct | null>(null);

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [operationsRes, actsRes, accountsRes, projectsRes] = await Promise.all([
        supabase
          .from('finance_operations')
          .select('*, project:projects(*), account:finance_accounts(*), contractor:contractors(*)')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('operation_date', { ascending: false }),
        supabase
          .from('finance_acts')
          .select('*, project:projects(*), contractor:contractors(*)')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('act_date', { ascending: false }),
        supabase
          .from('finance_accounts')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('projects')
          .select('*')
          .eq('company_id', currentUser.company_id)
      ]);

      if (operationsRes.data) setOperations(operationsRes.data);
      if (actsRes.data) setActs(actsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const completedOps = operations.filter(o => o.status === 'completed');
    const income = completedOps.filter(o => o.operation_type === 'income').reduce((sum, o) => sum + o.amount, 0);
    const expense = completedOps.filter(o => o.operation_type === 'expense').reduce((sum, o) => sum + o.amount, 0);
    const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);
    const pendingActs = acts.filter(a => a.payment_status !== 'paid').reduce((sum, a) => sum + (a.total - a.paid_amount), 0);

    return { income, expense, balance: income - expense, totalBalance, pendingActs };
  }, [operations, accounts, acts]);

  const filteredOperations = useMemo(() => {
    return operations.filter(op => {
      const matchesProject = projectFilter === 'all' || op.project_id === projectFilter;
      const matchesType = typeFilter === 'all' || op.operation_type === typeFilter;
      return matchesProject && matchesType;
    });
  }, [operations, projectFilter, typeFilter]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pl-PL');

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: 'operations', label: 'Operacje', icon: DollarSign },
    { key: 'acts', label: 'Akty', icon: FileText },
    { key: 'accounts', label: 'Konta', icon: Wallet },
    { key: 'budget', label: 'Budżet', icon: PieChart }
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finanse</h1>
          <p className="text-slate-600 mt-1">Zarządzanie operacjami finansowymi</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'operations' && (
            <button
              onClick={() => { setEditingOperation(null); setShowOperationModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowa operacja
            </button>
          )}
          {activeTab === 'acts' && (
            <button
              onClick={() => { setEditingAct(null); setShowActModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowy akt
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Przychody</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.income)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <TrendingDown className="w-5 h-5" />
            <span className="text-sm font-medium">Wydatki</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.expense)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <BarChart3 className="w-5 h-5" />
            <span className="text-sm font-medium">Bilans</span>
          </div>
          <p className={`text-xl font-bold ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(stats.balance)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium">Na kontach</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.totalBalance)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Do zapłaty</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.pendingActs)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        {(activeTab === 'operations' || activeTab === 'acts') && (
          <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Szukaj..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg"
            >
              <option value="all">Wszystkie projekty</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {activeTab === 'operations' && (
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as FinanceOperationType | 'all')}
                className="px-4 py-2 border border-slate-200 rounded-lg"
              >
                <option value="all">Wszystkie typy</option>
                <option value="income">Przychody</option>
                <option value="expense">Wydatki</option>
              </select>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : activeTab === 'operations' ? (
            filteredOperations.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Brak operacji finansowych</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOperations.map(op => (
                  <div
                    key={op.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      op.operation_type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {op.operation_type === 'income' ? (
                        <ArrowUpRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{op.description || 'Operacja finansowa'}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(op.operation_date)} • {(op as any).project?.name || 'Bez projektu'}
                      </p>
                    </div>
                    <p className={`text-lg font-semibold ${
                      op.operation_type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {op.operation_type === 'income' ? '+' : '-'}{formatCurrency(op.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'acts' ? (
            acts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Brak aktów wykonawczych</p>
              </div>
            ) : (
              <div className="space-y-2">
                {acts.map(act => (
                  <div
                    key={act.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">Akt nr {act.number}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(act.act_date)} • {(act as any).project?.name}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ACT_STATUS_COLORS[act.status]}`}>
                      {ACT_STATUS_LABELS[act.status]}
                    </span>
                    <p className="text-lg font-semibold text-slate-900">{formatCurrency(act.total)}</p>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'accounts' ? (
            accounts.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Brak kont finansowych</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map(account => (
                  <div key={account.id} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        account.account_type === 'bank' ? 'bg-blue-100' :
                        account.account_type === 'cash' ? 'bg-green-100' : 'bg-purple-100'
                      }`}>
                        {account.account_type === 'bank' ? (
                          <Building2 className="w-5 h-5 text-blue-600" />
                        ) : account.account_type === 'cash' ? (
                          <DollarSign className="w-5 h-5 text-green-600" />
                        ) : (
                          <CreditCard className="w-5 h-5 text-purple-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{account.name}</p>
                        <p className="text-xs text-slate-500">{account.bank_name || 'Gotówka'}</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(account.current_balance)}</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <PieChart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Budżetowanie w przygotowaniu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancePage;
