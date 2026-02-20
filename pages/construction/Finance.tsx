import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, DollarSign, TrendingUp, TrendingDown, Wallet,
  CreditCard, Loader2, Filter, Download, Calendar, Building2,
  FileText, ArrowUpRight, ArrowDownRight, PieChart, BarChart3,
  Receipt, CheckCircle, Clock, AlertCircle, X, Pencil, Save, Trash2
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project, FinanceAccount, FinanceOperation, FinanceAct,
  FinanceOperationType, FinanceOperationStatus, ActStatus, Contractor
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
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<FinanceOperationType | 'all'>('all');

  // Modals
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [showActModal, setShowActModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingOperation, setEditingOperation] = useState<FinanceOperation | null>(null);
  const [editingAct, setEditingAct] = useState<FinanceAct | null>(null);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [saving, setSaving] = useState(false);

  // Operation form
  const [operationForm, setOperationForm] = useState({
    project_id: '',
    account_id: '',
    contractor_id: '',
    operation_type: 'expense' as FinanceOperationType,
    amount: 0,
    description: '',
    operation_date: new Date().toISOString().split('T')[0],
    document_number: ''
  });

  // Act form
  const [actForm, setActForm] = useState({
    project_id: '',
    contractor_id: '',
    number: '',
    name: '',
    act_date: new Date().toISOString().split('T')[0],
    period_start: '',
    period_end: '',
    total: 0,
    nds_amount: 0,
    payment_status: 'pending' as 'pending' | 'partial' | 'paid'
  });

  // Account form
  const [accountForm, setAccountForm] = useState({
    name: '',
    account_type: 'bank' as 'bank' | 'cash' | 'card',
    bank_name: '',
    account_number: '',
    current_balance: 0
  });

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [operationsRes, actsRes, accountsRes, projectsRes, contractorsRes] = await Promise.all([
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
          .eq('company_id', currentUser.company_id),
        supabase
          .from('contractors')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
      ]);

      if (operationsRes.data) setOperations(operationsRes.data);
      if (actsRes.data) setActs(actsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
      if (contractorsRes.data) setContractors(contractorsRes.data);
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
      const matchesSearch = !search || op.description?.toLowerCase().includes(search.toLowerCase());
      return matchesProject && matchesType && matchesSearch;
    });
  }, [operations, projectFilter, typeFilter, search]);

  const filteredActs = useMemo(() => {
    return acts.filter(act => {
      const matchesProject = projectFilter === 'all' || act.project_id === projectFilter;
      const matchesSearch = !search ||
        act.number?.toLowerCase().includes(search.toLowerCase()) ||
        act.name?.toLowerCase().includes(search.toLowerCase());
      return matchesProject && matchesSearch;
    });
  }, [acts, projectFilter, search]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pl-PL');

  // Operation CRUD
  const handleSaveOperation = async () => {
    if (!currentUser || !operationForm.amount) return;
    setSaving(true);
    try {
      const data = {
        company_id: currentUser.company_id,
        project_id: operationForm.project_id || null,
        account_id: operationForm.account_id || null,
        contractor_id: operationForm.contractor_id || null,
        operation_type: operationForm.operation_type,
        amount: operationForm.amount,
        description: operationForm.description,
        operation_date: operationForm.operation_date,
        document_number: operationForm.document_number || null,
        status: 'completed' as FinanceOperationStatus,
        created_by_id: currentUser.id
      };

      if (editingOperation) {
        await supabase
          .from('finance_operations')
          .update(data)
          .eq('id', editingOperation.id);
      } else {
        await supabase.from('finance_operations').insert(data);
      }

      setShowOperationModal(false);
      setEditingOperation(null);
      resetOperationForm();
      await loadData();
    } catch (err) {
      console.error('Error saving operation:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOperation = async (op: FinanceOperation) => {
    if (!confirm('Czy na pewno chcesz usunąć tę operację?')) return;
    try {
      await supabase
        .from('finance_operations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', op.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting operation:', err);
    }
  };

  const resetOperationForm = () => {
    setOperationForm({
      project_id: '',
      account_id: '',
      contractor_id: '',
      operation_type: 'expense',
      amount: 0,
      description: '',
      operation_date: new Date().toISOString().split('T')[0],
      document_number: ''
    });
  };

  // Act CRUD
  const handleSaveAct = async () => {
    if (!currentUser || !actForm.number || !actForm.total) return;
    setSaving(true);
    try {
      const data = {
        company_id: currentUser.company_id,
        project_id: actForm.project_id || null,
        contractor_id: actForm.contractor_id || null,
        number: actForm.number,
        name: actForm.name,
        act_date: actForm.act_date,
        period_start: actForm.period_start || null,
        period_end: actForm.period_end || null,
        total: actForm.total,
        nds_amount: actForm.nds_amount,
        payment_status: actForm.payment_status,
        status: 'draft' as ActStatus,
        created_by_id: currentUser.id
      };

      if (editingAct) {
        await supabase
          .from('finance_acts')
          .update(data)
          .eq('id', editingAct.id);
      } else {
        await supabase.from('finance_acts').insert(data);
      }

      setShowActModal(false);
      setEditingAct(null);
      resetActForm();
      await loadData();
    } catch (err) {
      console.error('Error saving act:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAct = async (act: FinanceAct) => {
    if (!confirm('Czy na pewno chcesz usunąć ten akt?')) return;
    try {
      await supabase
        .from('finance_acts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', act.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting act:', err);
    }
  };

  const resetActForm = () => {
    setActForm({
      project_id: '',
      contractor_id: '',
      number: '',
      name: '',
      act_date: new Date().toISOString().split('T')[0],
      period_start: '',
      period_end: '',
      total: 0,
      nds_amount: 0,
      payment_status: 'pending'
    });
  };

  // Account CRUD
  const handleSaveAccount = async () => {
    if (!currentUser || !accountForm.name) return;
    setSaving(true);
    try {
      const data = {
        company_id: currentUser.company_id,
        name: accountForm.name,
        account_type: accountForm.account_type,
        bank_name: accountForm.bank_name || null,
        account_number: accountForm.account_number || null,
        current_balance: accountForm.current_balance
      };

      if (editingAccount) {
        await supabase
          .from('finance_accounts')
          .update(data)
          .eq('id', editingAccount.id);
      } else {
        await supabase.from('finance_accounts').insert({ ...data, is_active: true });
      }

      setShowAccountModal(false);
      setEditingAccount(null);
      resetAccountForm();
      await loadData();
    } catch (err) {
      console.error('Error saving account:', err);
    } finally {
      setSaving(false);
    }
  };

  const resetAccountForm = () => {
    setAccountForm({
      name: '',
      account_type: 'bank',
      bank_name: '',
      account_number: '',
      current_balance: 0
    });
  };

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: 'operations', label: 'Operacje', icon: DollarSign },
    { key: 'acts', label: 'Akty', icon: FileText },
    { key: 'accounts', label: 'Konta', icon: Wallet },
    { key: 'budget', label: 'Budżet', icon: PieChart }
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-end">
        <div className="flex gap-2">
          {activeTab === 'operations' && (
            <button
              onClick={() => { resetOperationForm(); setEditingOperation(null); setShowOperationModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowa operacja
            </button>
          )}
          {activeTab === 'acts' && (
            <button
              onClick={() => { resetActForm(); setEditingAct(null); setShowActModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowy akt
            </button>
          )}
          {activeTab === 'accounts' && (
            <button
              onClick={() => { resetAccountForm(); setEditingAccount(null); setShowAccountModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nowe konto
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
                <p className="text-slate-500 mb-4">Brak operacji finansowych</p>
                <button
                  onClick={() => { resetOperationForm(); setShowOperationModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Dodaj pierwszą operację
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOperations.map(op => (
                  <div
                    key={op.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer group"
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
                        {op.document_number && ` • ${op.document_number}`}
                      </p>
                    </div>
                    <p className={`text-lg font-semibold ${
                      op.operation_type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {op.operation_type === 'income' ? '+' : '-'}{formatCurrency(op.amount)}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingOperation(op);
                          setOperationForm({
                            project_id: op.project_id || '',
                            account_id: op.account_id || '',
                            contractor_id: op.contractor_id || '',
                            operation_type: op.operation_type,
                            amount: op.amount,
                            description: op.description || '',
                            operation_date: op.operation_date?.split('T')[0] || '',
                            document_number: op.document_number || ''
                          });
                          setShowOperationModal(true);
                        }}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteOperation(op); }}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'acts' ? (
            filteredActs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Brak aktów wykonawczych</p>
                <button
                  onClick={() => { resetActForm(); setShowActModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Dodaj pierwszy akt
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredActs.map(act => (
                  <div
                    key={act.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer group"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">Akt nr {act.number}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(act.act_date)} • {(act as any).project?.name}
                        {(act as any).contractor?.name && ` • ${(act as any).contractor?.name}`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ACT_STATUS_COLORS[act.status]}`}>
                      {ACT_STATUS_LABELS[act.status]}
                    </span>
                    <p className="text-lg font-semibold text-slate-900">{formatCurrency(act.total)}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingAct(act);
                          setActForm({
                            project_id: act.project_id || '',
                            contractor_id: act.contractor_id || '',
                            number: act.number,
                            name: act.name || '',
                            act_date: act.act_date?.split('T')[0] || '',
                            period_start: act.period_start?.split('T')[0] || '',
                            period_end: act.period_end?.split('T')[0] || '',
                            total: act.total,
                            nds_amount: act.nds_amount,
                            payment_status: act.payment_status
                          });
                          setShowActModal(true);
                        }}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAct(act); }}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'accounts' ? (
            accounts.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Brak kont finansowych</p>
                <button
                  onClick={() => { resetAccountForm(); setShowAccountModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Dodaj pierwsze konto
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map(account => (
                  <div key={account.id} className="p-4 bg-slate-50 rounded-lg group">
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
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{account.name}</p>
                        <p className="text-xs text-slate-500">{account.bank_name || 'Gotówka'}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => {
                            setEditingAccount(account);
                            setAccountForm({
                              name: account.name,
                              account_type: account.account_type,
                              bank_name: account.bank_name || '',
                              account_number: account.account_number || '',
                              current_balance: account.current_balance
                            });
                            setShowAccountModal(true);
                          }}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          <Pencil className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(account.current_balance)}</p>
                    {account.account_number && (
                      <p className="text-xs text-slate-400 mt-1">{account.account_number}</p>
                    )}
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

      {/* Operation Modal */}
      {showOperationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingOperation ? 'Edytuj operację' : 'Nowa operacja'}
              </h2>
              <button onClick={() => setShowOperationModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setOperationForm({ ...operationForm, operation_type: 'income' })}
                  className={`p-4 rounded-lg border-2 text-center transition ${
                    operationForm.operation_type === 'income'
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-green-300'
                  }`}
                >
                  <ArrowUpRight className={`w-6 h-6 mx-auto mb-1 ${
                    operationForm.operation_type === 'income' ? 'text-green-600' : 'text-slate-400'
                  }`} />
                  <span className={operationForm.operation_type === 'income' ? 'text-green-700 font-medium' : 'text-slate-600'}>
                    Przychód
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOperationForm({ ...operationForm, operation_type: 'expense' })}
                  className={`p-4 rounded-lg border-2 text-center transition ${
                    operationForm.operation_type === 'expense'
                      ? 'border-red-500 bg-red-50'
                      : 'border-slate-200 hover:border-red-300'
                  }`}
                >
                  <ArrowDownRight className={`w-6 h-6 mx-auto mb-1 ${
                    operationForm.operation_type === 'expense' ? 'text-red-600' : 'text-slate-400'
                  }`} />
                  <span className={operationForm.operation_type === 'expense' ? 'text-red-700 font-medium' : 'text-slate-600'}>
                    Wydatek
                  </span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kwota *</label>
                <input
                  type="number"
                  value={operationForm.amount || ''}
                  onChange={e => setOperationForm({ ...operationForm, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <input
                  type="text"
                  value={operationForm.description}
                  onChange={e => setOperationForm({ ...operationForm, description: e.target.value })}
                  placeholder="np. Faktura za materiały"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={operationForm.operation_date}
                    onChange={e => setOperationForm({ ...operationForm, operation_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nr dokumentu</label>
                  <input
                    type="text"
                    value={operationForm.document_number}
                    onChange={e => setOperationForm({ ...operationForm, document_number: e.target.value })}
                    placeholder="FV/2024/001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                  <select
                    value={operationForm.project_id}
                    onChange={e => setOperationForm({ ...operationForm, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">-- Wybierz --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Konto</label>
                  <select
                    value={operationForm.account_id}
                    onChange={e => setOperationForm({ ...operationForm, account_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">-- Wybierz --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kontrahent</label>
                <select
                  value={operationForm.contractor_id}
                  onChange={e => setOperationForm({ ...operationForm, contractor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Wybierz --</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowOperationModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveOperation}
                disabled={!operationForm.amount || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingOperation ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Act Modal */}
      {showActModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingAct ? 'Edytuj akt' : 'Nowy akt wykonawczy'}
              </h2>
              <button onClick={() => setShowActModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Numer aktu *</label>
                  <input
                    type="text"
                    value={actForm.number}
                    onChange={e => setActForm({ ...actForm, number: e.target.value })}
                    placeholder="ACT-001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data aktu</label>
                  <input
                    type="date"
                    value={actForm.act_date}
                    onChange={e => setActForm({ ...actForm, act_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa</label>
                <input
                  type="text"
                  value={actForm.name}
                  onChange={e => setActForm({ ...actForm, name: e.target.value })}
                  placeholder="np. Akt wykonania robót elektrycznych"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                  <select
                    value={actForm.project_id}
                    onChange={e => setActForm({ ...actForm, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">-- Wybierz --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kontrahent</label>
                  <select
                    value={actForm.contractor_id}
                    onChange={e => setActForm({ ...actForm, contractor_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">-- Wybierz --</option>
                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Okres od</label>
                  <input
                    type="date"
                    value={actForm.period_start}
                    onChange={e => setActForm({ ...actForm, period_start: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Okres do</label>
                  <input
                    type="date"
                    value={actForm.period_end}
                    onChange={e => setActForm({ ...actForm, period_end: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Suma *</label>
                  <input
                    type="number"
                    value={actForm.total || ''}
                    onChange={e => setActForm({ ...actForm, total: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VAT</label>
                  <input
                    type="number"
                    value={actForm.nds_amount || ''}
                    onChange={e => setActForm({ ...actForm, nds_amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status płatności</label>
                <select
                  value={actForm.payment_status}
                  onChange={e => setActForm({ ...actForm, payment_status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="pending">Oczekuje</option>
                  <option value="partial">Częściowo opłacony</option>
                  <option value="paid">Opłacony</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowActModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveAct}
                disabled={!actForm.number || !actForm.total || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingAct ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingAccount ? 'Edytuj konto' : 'Nowe konto finansowe'}
              </h2>
              <button onClick={() => setShowAccountModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa konta *</label>
                <input
                  type="text"
                  value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                  placeholder="np. Konto główne PKO"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Typ konta</label>
                <select
                  value={accountForm.account_type}
                  onChange={e => setAccountForm({ ...accountForm, account_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="bank">Konto bankowe</option>
                  <option value="cash">Gotówka</option>
                  <option value="card">Karta</option>
                </select>
              </div>

              {accountForm.account_type === 'bank' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa banku</label>
                    <input
                      type="text"
                      value={accountForm.bank_name}
                      onChange={e => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                      placeholder="np. PKO BP"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numer konta</label>
                    <input
                      type="text"
                      value={accountForm.account_number}
                      onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })}
                      placeholder="PL 00 0000 0000 0000 0000 0000 0000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Saldo początkowe</label>
                <input
                  type="number"
                  value={accountForm.current_balance || ''}
                  onChange={e => setAccountForm({ ...accountForm, current_balance: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  step="0.01"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAccountModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveAccount}
                disabled={!accountForm.name || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingAccount ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancePage;
