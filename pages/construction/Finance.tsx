import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Search, DollarSign, TrendingUp, TrendingDown, Wallet,
  CreditCard, Loader2, Filter, Download, Calendar, Building2,
  FileText, ArrowUpRight, ArrowDownRight, PieChart, BarChart3,
  Receipt, CheckCircle, Clock, AlertCircle, X, Pencil, Save,
  Trash2, AlertTriangle, Target, Layers
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart as RPieChart, Pie, Cell
} from 'recharts';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type TabType = 'operations' | 'acts' | 'accounts' | 'budget';

const BUDGET_CATEGORIES = [
  { code: 'materialy', label: 'Materiały', color: '#3b82f6' },
  { code: 'robocizna', label: 'Robocizna', color: '#10b981' },
  { code: 'sprzet', label: 'Sprzęt', color: '#f59e0b' },
  { code: 'inne', label: 'Inne', color: '#8b5cf6' },
];

const MONTHS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze',
                   'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

interface BudgetItem {
  id?: string;
  project_id: string;
  company_id?: string;
  category: string; // materialy | robocizna | sprzet | inne
  name: string;
  planned_amount: number;
  actual_amount: number;
  created_at?: string;
}

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

  // Budget state
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [budgetProject, setBudgetProject] = useState<string>('');
  const [budgetYear, setBudgetYear] = useState<number>(new Date().getFullYear());
  const [monthlyBudget, setMonthlyBudget] = useState<any[]>([]);
  const [savingBudget, setSavingBudget] = useState(false);
  const [showAddBudgetItemModal, setShowAddBudgetItemModal] = useState(false);
  const [budgetItemForm, setBudgetItemForm] = useState({
    category: 'materialy',
    name: '',
    planned_amount: 0,
    actual_amount: 0,
  });

  // Modals
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [showActModal, setShowActModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingOperation, setEditingOperation] = useState<FinanceOperation | null>(null);
  const [editingAct, setEditingAct] = useState<FinanceAct | null>(null);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const [operationForm, setOperationForm] = useState({
    project_id: '', account_id: '', contractor_id: '',
    operation_type: 'expense' as FinanceOperationType,
    amount: 0, description: '',
    operation_date: new Date().toISOString().split('T')[0],
    document_number: ''
  });

  const [actForm, setActForm] = useState({
    project_id: '', contractor_id: '', number: '', name: '',
    act_date: new Date().toISOString().split('T')[0],
    period_start: '', period_end: '', total: 0, nds_amount: 0,
    payment_status: 'pending' as 'pending' | 'partial' | 'paid'
  });

  const [accountForm, setAccountForm] = useState({
    name: '', account_type: 'bank' as 'bank' | 'cash' | 'card',
    bank_name: '', account_number: '', current_balance: 0
  });

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [operationsRes, actsRes, accountsRes, projectsRes, contractorsRes] = await Promise.all([
        supabase.from('finance_operations')
          .select('*, project:projects(*), account:finance_accounts(*), contractor:contractors(*)')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('operation_date', { ascending: false }),
        supabase.from('finance_acts')
          .select('*, project:projects(*), contractor:contractors(*)')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('act_date', { ascending: false }),
        supabase.from('finance_accounts')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .eq('is_active', true)
          .order('name'),
        supabase.from('projects')
          .select('*')
          .eq('company_id', currentUser.company_id),
        supabase.from('contractors')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
      ]);

      if (operationsRes.data) setOperations(operationsRes.data);
      if (actsRes.data) setActs(actsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (projectsRes.data) {
        setProjects(projectsRes.data);
        if (!budgetProject && projectsRes.data.length > 0) {
          setBudgetProject(projectsRes.data[0].id);
        }
      }
      if (contractorsRes.data) setContractors(contractorsRes.data);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBudgetData = useCallback(async () => {
    if (!budgetProject || !currentUser) return;
    try {
      const { data: items } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', budgetProject)
        .order('created_at', { ascending: true });
      setBudgetItems(items || []);

      // Load monthly project_budgets for the year (keep for bar chart)
      const { data: monthly } = await supabase
        .from('project_budgets')
        .select('*')
        .eq('project_id', budgetProject)
        .eq('year', budgetYear)
        .order('month');
      setMonthlyBudget(monthly || []);
    } catch (err) {
      console.error('Error loading budget data:', err);
    }
  }, [budgetProject, budgetYear, currentUser]);

  useEffect(() => {
    if (activeTab === 'budget' && budgetProject) {
      loadBudgetData();
    }
  }, [activeTab, budgetProject, budgetYear]);

  const stats = useMemo(() => {
    const completedOps = operations.filter(o => o.status === 'completed');
    const income = completedOps.filter(o => o.operation_type === 'income').reduce((s, o) => s + o.amount, 0);
    const expense = completedOps.filter(o => o.operation_type === 'expense').reduce((s, o) => s + o.amount, 0);
    const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);
    const pendingActs = acts.filter(a => a.payment_status !== 'paid').reduce((s, a) => s + ((a.total || 0) - (a.paid_amount || 0)), 0);

    // Monthly stats (last 6 months)
    const now = new Date();
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const y = d.getFullYear(), m = d.getMonth();
      const monthOps = completedOps.filter(op => {
        const od = new Date(op.operation_date);
        return od.getFullYear() === y && od.getMonth() === m;
      });
      return {
        name: MONTHS_PL[m],
        Przychody: monthOps.filter(o => o.operation_type === 'income').reduce((s, o) => s + o.amount, 0),
        Koszty: monthOps.filter(o => o.operation_type === 'expense').reduce((s, o) => s + o.amount, 0),
      };
    });

    return { income, expense, balance: income - expense, totalBalance, pendingActs, monthlyData };
  }, [operations, accounts, acts]);

  // Budget KPIs
  const budgetKPIs = useMemo(() => {
    const totalPlanned = budgetItems.reduce((s, c) => s + (c.planned_amount || 0), 0);
    const totalActual = budgetItems.reduce((s, c) => s + (c.actual_amount || 0), 0);
    const remaining = totalPlanned - totalActual;
    const pctSpent = totalPlanned > 0 ? totalActual / totalPlanned : 0;

    // Overspend > 10% warning
    const overBudget = totalActual > totalPlanned && totalPlanned > 0;
    const overTenPct = totalPlanned > 0 && (totalActual - totalPlanned) / totalPlanned > 0.1;
    const warningThreshold = pctSpent > 0.8 && !overBudget && totalPlanned > 0;

    const now = new Date();
    const thisMonthOps = operations.filter(o => {
      if (o.project_id !== budgetProject || o.operation_type !== 'expense' || o.status !== 'completed') return false;
      const d = new Date(o.operation_date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const thisMonthSpent = thisMonthOps.reduce((s, o) => s + o.amount, 0);

    // Per-category >80% alerts
    const categoryAlerts = BUDGET_CATEGORIES.map(cat => {
      const catItems = budgetItems.filter(i => i.category === cat.code);
      const planned = catItems.reduce((s, i) => s + (i.planned_amount || 0), 0);
      const actual = catItems.reduce((s, i) => s + (i.actual_amount || 0), 0);
      const pct = planned > 0 ? actual / planned : 0;
      return { ...cat, planned, actual, pct, alert: planned > 0 && pct >= 0.8 && actual <= planned };
    }).filter(c => c.alert);

    return { totalPlanned, totalActual, remaining, pctSpent, overBudget, overTenPct, warningThreshold, thisMonthSpent, categoryAlerts };
  }, [budgetItems, operations, budgetProject]);

  // Category aggregates for pie chart
  const categoryAggregates = useMemo(() => {
    return BUDGET_CATEGORIES.map(cat => {
      const items = budgetItems.filter(i => i.category === cat.code);
      return {
        ...cat,
        planned: items.reduce((s, i) => s + (i.planned_amount || 0), 0),
        actual: items.reduce((s, i) => s + (i.actual_amount || 0), 0),
      };
    });
  }, [budgetItems]);

  const filteredOperations = useMemo(() => operations.filter(op => {
    const matchesProject = projectFilter === 'all' || op.project_id === projectFilter;
    const matchesType = typeFilter === 'all' || op.operation_type === typeFilter;
    const matchesSearch = !search || op.description?.toLowerCase().includes(search.toLowerCase());
    return matchesProject && matchesType && matchesSearch;
  }), [operations, projectFilter, typeFilter, search]);

  const filteredActs = useMemo(() => acts.filter(act => {
    const matchesProject = projectFilter === 'all' || act.project_id === projectFilter;
    const matchesSearch = !search ||
      act.number?.toLowerCase().includes(search.toLowerCase()) ||
      (act.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesProject && matchesSearch;
  }), [acts, projectFilter, search]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pl-PL');

  // JPK Export
  const handleExportJPK = () => {
    const now = new Date();
    const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const company = currentUser?.company_id || '';

    const jpkXml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02172/" xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2018/08/24/eD/DefinicjeTypy/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M" wersjaSchemy="1-2">JPK_VAT</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
    <DataWytworzeniaJPK>${now.toISOString()}</DataWytworzeniaJPK>
    <NazwaSystemu>MaxMaster Portal</NazwaSystemu>
    <CelZlozenia poz="P_7">1</CelZlozenia>
    <DataOd>${periodStart}</DataOd>
    <DataDo>${periodEnd}</DataDo>
    <NazwaFirmy>MaxMaster</NazwaFirmy>
    <NIP>${company}</NIP>
  </Naglowek>
  <Podmiot1>
    <IdentyfikatorPodmiotu>
      <NIP>${company}</NIP>
    </IdentyfikatorPodmiotu>
  </Podmiot1>
  <SprzedazWiersz>
    ${acts
      .filter(a => {
        const d = new Date(a.act_date || a.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .map((a, i) => `
    <LpSprzedazy>${i + 1}</LpSprzedazy>
    <NrKontrahenta>${(a as any).contractor?.tax_id || ''}</NrKontrahenta>
    <NazwaKontrahenta>${(a as any).contractor?.name || ''}</NazwaKontrahenta>
    <DowodSprzedazy>${a.number}</DowodSprzedazy>
    <DataWystawienia>${a.act_date || a.date}</DataWystawienia>
    <K_19>${((a.total || 0) - (a.nds_amount || 0)).toFixed(2)}</K_19>
    <K_20>${(a.nds_amount || 0).toFixed(2)}</K_20>`)
      .join('\n')}
  </SprzedazWiersz>
  <SprzedazCtrl>
    <LiczbaWierszy>${acts.length}</LiczbaWierszy>
    <PodatekNalezny>${acts.reduce((s, a) => s + (a.nds_amount || 0), 0).toFixed(2)}</PodatekNalezny>
  </SprzedazCtrl>
</JPK>`;

    const blob = new Blob([jpkXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JPK_V7M_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Faktura from Act
  const handleCreateInvoiceFromAct = (act: FinanceAct) => {
    const actName = act.name || `Akt nr ${act.number}`;
    const contractor = (act as any).contractor;
    const project = (act as any).project;
    setActForm({
      project_id: act.project_id || '',
      contractor_id: act.contractor_id || '',
      number: `FV/${act.number}`,
      name: `Faktura za: ${actName}`,
      act_date: new Date().toISOString().split('T')[0],
      period_start: act.period_start?.split('T')[0] || '',
      period_end: act.period_end?.split('T')[0] || '',
      total: act.total || act.amount || 0,
      nds_amount: act.nds_amount || 0,
      payment_status: 'pending'
    });
    setEditingAct(null);
    setShowActModal(true);
  };

  // Add budget item
  const handleAddBudgetItem = async () => {
    if (!currentUser || !budgetProject || !budgetItemForm.name) return;
    setSavingBudget(true);
    try {
      const { data, error } = await supabase
        .from('budget_items')
        .insert({
          project_id: budgetProject,
          company_id: currentUser.company_id,
          category: budgetItemForm.category,
          name: budgetItemForm.name,
          planned_amount: budgetItemForm.planned_amount,
          actual_amount: budgetItemForm.actual_amount,
        })
        .select()
        .single();
      if (!error && data) {
        setBudgetItems(prev => [...prev, data]);
      }
      setShowAddBudgetItemModal(false);
      setBudgetItemForm({ category: 'materialy', name: '', planned_amount: 0, actual_amount: 0 });
    } catch (err) {
      console.error('Error adding budget item:', err);
    } finally {
      setSavingBudget(false);
    }
  };

  // Delete budget item
  const handleDeleteBudgetItem = async (id: string) => {
    if (!confirm('Usunąć pozycję budżetową?')) return;
    await supabase.from('budget_items').delete().eq('id', id);
    setBudgetItems(prev => prev.filter(i => i.id !== id));
  };

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
        await supabase.from('finance_operations').update(data).eq('id', editingOperation.id);
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
    await supabase.from('finance_operations').update({ deleted_at: new Date().toISOString() }).eq('id', op.id);
    await loadData();
  };

  const resetOperationForm = () => setOperationForm({
    project_id: '', account_id: '', contractor_id: '', operation_type: 'expense',
    amount: 0, description: '', operation_date: new Date().toISOString().split('T')[0], document_number: ''
  });

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
        await supabase.from('finance_acts').update(data).eq('id', editingAct.id);
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
    await supabase.from('finance_acts').update({ deleted_at: new Date().toISOString() }).eq('id', act.id);
    await loadData();
  };

  const resetActForm = () => setActForm({
    project_id: '', contractor_id: '', number: '', name: '',
    act_date: new Date().toISOString().split('T')[0],
    period_start: '', period_end: '', total: 0, nds_amount: 0, payment_status: 'pending'
  });

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
        await supabase.from('finance_accounts').update(data).eq('id', editingAccount.id);
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

  const resetAccountForm = () => setAccountForm({
    name: '', account_type: 'bank', bank_name: '', account_number: '', current_balance: 0
  });

  // ===== EXPORT FUNCTIONS =====
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const projectName = projects.find(p => p.id === (projectFilter !== 'all' ? projectFilter : ''))?.name || 'Wszystkie projekty';
    
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text('Raport Finansowy', 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`MaxMaster Portal | ${now.toLocaleDateString('pl-PL')}`, 14, 28);
    doc.text(`Projekt: ${projectName}`, 14, 35);

    // Summary table
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text('Podsumowanie', 14, 46);
    autoTable(doc, {
      startY: 50,
      head: [['Wskaźnik', 'Wartość']],
      body: [
        ['Przychody łącznie', formatCurrency(stats.income)],
        ['Koszty łącznie', formatCurrency(stats.expense)],
        ['Marża (Bilans)', formatCurrency(stats.balance)],
        ['Marża %', stats.income > 0 ? `${((stats.balance / stats.income) * 100).toFixed(1)}%` : '0%'],
        ['Saldo kont', formatCurrency(stats.totalBalance)],
        ['Należności', formatCurrency(stats.pendingActs)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    // Operations table
    const ops = projectFilter !== 'all' 
      ? filteredOperations 
      : operations.filter(o => o.status === 'completed');
    if (ops.length > 0) {
      const prevY = (doc as any).lastAutoTable?.finalY || 120;
      doc.setFontSize(13);
      doc.setTextColor(30);
      doc.text('Operacje finansowe', 14, prevY + 12);
      autoTable(doc, {
        startY: prevY + 16,
        head: [['Data', 'Opis', 'Typ', 'Kwota']],
        body: ops.slice(0, 50).map(op => [
          formatDate(op.operation_date),
          op.description || '-',
          op.operation_type === 'income' ? 'Przychód' : 'Wydatek',
          `${op.operation_type === 'income' ? '+' : '-'}${formatCurrency(op.amount)}`,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 58, 138] },
        columnStyles: { 3: { halign: 'right' } },
      });
    }

    doc.save(`Raport_Finansowy_${now.toISOString().split('T')[0]}.pdf`);
  };

  const handleExportXLSX = () => {
    const now = new Date();
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['Raport Finansowy MaxMaster', ''],
      ['Data:', now.toLocaleDateString('pl-PL')],
      [''],
      ['Wskaźnik', 'Wartość PLN'],
      ['Przychody łącznie', stats.income],
      ['Koszty łącznie', stats.expense],
      ['Marża (Bilans)', stats.balance],
      ['Marża %', stats.income > 0 ? (stats.balance / stats.income) * 100 : 0],
      ['Saldo kont', stats.totalBalance],
      ['Należności', stats.pendingActs],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Podsumowanie');

    // Operations sheet
    const opsData = [
      ['Data', 'Opis', 'Typ', 'Projekt', 'Kwota PLN', 'Nr dokumentu'],
      ...filteredOperations.map(op => [
        formatDate(op.operation_date),
        op.description || '',
        op.operation_type === 'income' ? 'Przychód' : 'Wydatek',
        (op as any).project?.name || '',
        op.operation_type === 'income' ? op.amount : -op.amount,
        op.document_number || '',
      ])
    ];
    const wsOps = XLSX.utils.aoa_to_sheet(opsData);
    XLSX.utils.book_append_sheet(wb, wsOps, 'Operacje');

    // Acts sheet
    const actsData = [
      ['Nr', 'Nazwa', 'Data', 'Projekt', 'Kontrahent', 'Suma PLN', 'VAT PLN', 'Status'],
      ...filteredActs.map(act => [
        act.number,
        act.name || '',
        formatDate(act.act_date || act.date),
        (act as any).project?.name || '',
        (act as any).contractor?.name || '',
        act.total || act.amount || 0,
        act.nds_amount || 0,
        act.payment_status,
      ])
    ];
    const wsActs = XLSX.utils.aoa_to_sheet(actsData);
    XLSX.utils.book_append_sheet(wb, wsActs, 'Akty');

    XLSX.writeFile(wb, `Raport_Finansowy_${now.toISOString().split('T')[0]}.xlsx`);
  };

  const handleGenerateActPDF = (act: FinanceAct) => {
    const doc = new jsPDF();
    const contractor = (act as any).contractor;
    const project = (act as any).project;
    const now = new Date();
    const actDate = new Date(act.act_date || act.date);
    const netAmount = (act.total || 0) - (act.nds_amount || 0);

    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138);
    doc.text('FAKTURA VAT', 105, 25, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(60);
    doc.text(`Nr: ${act.number}`, 105, 33, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data wystawienia: ${actDate.toLocaleDateString('pl-PL')}`, 14, 45);
    if (act.period_start && act.period_end) {
      doc.text(`Okres: ${new Date(act.period_start).toLocaleDateString('pl-PL')} – ${new Date(act.period_end).toLocaleDateString('pl-PL')}`, 14, 52);
    }

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Sprzedawca:', 14, 65);
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text('MaxMaster', 14, 72);

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Nabywca:', 120, 65);
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(contractor?.name || '—', 120, 72);
    if (contractor?.tax_id) doc.text(`NIP: ${contractor.tax_id}`, 120, 79);
    if (contractor?.address) doc.text(contractor.address, 120, 86);

    if (project?.name) {
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text(`Projekt: ${project.name}`, 14, 98);
    }

    autoTable(doc, {
      startY: 105,
      head: [['Lp.', 'Nazwa usługi/towaru', 'Netto PLN', 'VAT PLN', 'Brutto PLN']],
      body: [
        ['1', act.name || `Usługi budowlane – ${act.number}`,
         formatCurrency(netAmount), formatCurrency(act.nds_amount || 0), formatCurrency(act.total || 0)],
      ],
      foot: [['', 'RAZEM:', formatCurrency(netAmount), formatCurrency(act.nds_amount || 0), formatCurrency(act.total || 0)]],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 58, 138] },
      footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`Do zapłaty: ${formatCurrency(act.total || 0)}`, 14, finalY + 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Status: ${act.payment_status === 'paid' ? 'Zapłacono' : act.payment_status === 'partial' ? 'Częściowo zapłacono' : 'Oczekuje na płatność'}`, 14, finalY + 23);

    doc.save(`Faktura_${act.number.replace(/[\/]/g, '_')}.pdf`);
  };

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: 'operations', label: 'Operacje', icon: DollarSign },
    { key: 'acts', label: 'Akty', icon: FileText },
    { key: 'accounts', label: 'Konta', icon: Wallet },
    { key: 'budget', label: 'Budżet', icon: PieChart }
  ];

  const budgetPieData = categoryAggregates
    .filter(c => c.planned > 0)
    .map(c => ({ name: c.label, value: c.planned, color: c.color }));

  const budgetBarData = categoryAggregates.map(cat => ({
    name: cat.label,
    Plan: cat.planned,
    Faktura: cat.actual,
  }));

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-2">
        <div></div>
        <div className="flex gap-2">
          {activeTab === 'acts' && (
            <button
              onClick={handleExportJPK}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 min-h-[44px] text-sm"
            >
              <Download className="w-4 h-4" />
              Eksport JPK
            </button>
          )}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Download className="w-4 h-4" />
            Raport PDF
          </button>
          <button
            onClick={handleExportXLSX}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Raport XLSX
          </button>
          {activeTab === 'operations' && (
            <button
              onClick={() => { resetOperationForm(); setEditingOperation(null); setShowOperationModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" /> Nowa operacja
            </button>
          )}
          {activeTab === 'acts' && (
            <button
              onClick={() => { resetActForm(); setEditingAct(null); setShowActModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" /> Nowy akt
            </button>
          )}
          {activeTab === 'accounts' && (
            <button
              onClick={() => { resetAccountForm(); setEditingAccount(null); setShowAccountModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" /> Nowe konto
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Przychody', value: stats.income, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Koszty', value: stats.expense, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Bilans', value: stats.balance, icon: BarChart3, color: stats.balance >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-blue-50' },
          { label: 'Na kontach', value: stats.totalBalance, icon: Wallet, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Należności', value: stats.pendingActs, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white p-4 rounded-xl border border-slate-200">
            <div className={`flex items-center gap-2 ${color} mb-2`}>
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <p className={`text-xl font-bold ${color}`}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap min-h-[44px] ${
                  activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {(activeTab === 'operations' || activeTab === 'acts') && (
          <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Szukaj..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg" />
            </div>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg">
              <option value="all">Wszystkie projekty</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {activeTab === 'operations' && (
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
                className="px-4 py-2 border border-slate-200 rounded-lg">
                <option value="all">Wszystkie typy</option>
                <option value="income">Przychody</option>
                <option value="expense">Wydatki</option>
              </select>
            )}
          </div>
        )}

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
                <button onClick={() => { resetOperationForm(); setShowOperationModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Dodaj pierwszą operację
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOperations.map(op => (
                  <div key={op.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer group">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      op.operation_type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {op.operation_type === 'income' ? <ArrowUpRight className="w-5 h-5 text-green-600" /> : <ArrowDownRight className="w-5 h-5 text-red-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{op.description || 'Operacja finansowa'}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(op.operation_date)} • {(op as any).project?.name || 'Bez projektu'}
                        {op.document_number && ` • ${op.document_number}`}
                      </p>
                    </div>
                    <p className={`text-lg font-semibold ${op.operation_type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {op.operation_type === 'income' ? '+' : '-'}{formatCurrency(op.amount)}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={e => {
                        e.stopPropagation();
                        setEditingOperation(op);
                        setOperationForm({
                          project_id: op.project_id || '', account_id: op.account_id || '',
                          contractor_id: op.contractor_id || '',
                          operation_type: op.operation_type as FinanceOperationType,
                          amount: op.amount, description: op.description || '',
                          operation_date: op.operation_date?.split('T')[0] || '',
                          document_number: op.document_number || ''
                        });
                        setShowOperationModal(true);
                      }} className="p-1 hover:bg-slate-200 rounded">
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteOperation(op); }}
                        className="p-1 hover:bg-red-100 rounded">
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
                <button onClick={() => { resetActForm(); setShowActModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Dodaj pierwszy akt
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredActs.map(act => (
                  <div key={act.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer group">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">Akt nr {act.number}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(act.act_date || act.date)} • {(act as any).project?.name}
                        {(act as any).contractor?.name && ` • ${(act as any).contractor?.name}`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ACT_STATUS_COLORS[act.status as ActStatus] || 'bg-slate-100 text-slate-700'}`}>
                      {ACT_STATUS_LABELS[act.status as ActStatus] || act.status}
                    </span>
                    <p className="text-lg font-semibold text-slate-900">{formatCurrency(act.total || act.amount || 0)}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={e => { e.stopPropagation(); handleCreateInvoiceFromAct(act); }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        title="Wystaw fakturę"
                      >
                        Wystaw fakturę
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleGenerateActPDF(act); }}
                        className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                        title="Pobierz PDF"
                      >
                        PDF
                      </button>
                      <button onClick={e => {
                        e.stopPropagation(); setEditingAct(act);
                        setActForm({
                          project_id: act.project_id || '', contractor_id: act.contractor_id || '',
                          number: act.number, name: act.name || '',
                          act_date: (act.act_date || act.date)?.split('T')[0] || '',
                          period_start: act.period_start?.split('T')[0] || '',
                          period_end: act.period_end?.split('T')[0] || '',
                          total: act.total || act.amount || 0, nds_amount: act.nds_amount || 0,
                          payment_status: (act.payment_status || 'pending') as any
                        });
                        setShowActModal(true);
                      }} className="p-1 hover:bg-slate-200 rounded">
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteAct(act); }}
                        className="p-1 hover:bg-red-100 rounded">
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
                <button onClick={() => { resetAccountForm(); setShowAccountModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                        {account.account_type === 'bank' ? <Building2 className="w-5 h-5 text-blue-600" /> :
                         account.account_type === 'cash' ? <DollarSign className="w-5 h-5 text-green-600" /> :
                         <CreditCard className="w-5 h-5 text-purple-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{account.name}</p>
                        <p className="text-xs text-slate-500">{account.bank_name || 'Gotówka'}</p>
                      </div>
                      <button onClick={() => {
                        setEditingAccount(account);
                        setAccountForm({
                          name: account.name, account_type: (account.account_type || 'bank') as any,
                          bank_name: account.bank_name || '', account_number: account.account_number || '',
                          current_balance: account.current_balance
                        });
                        setShowAccountModal(true);
                      }} className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100">
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(account.current_balance)}</p>
                    {account.account_number && <p className="text-xs text-slate-400 mt-1">{account.account_number}</p>}
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ========== BUDGET TAB ========== */
            <div className="space-y-6">
              {/* Budget Controls */}
              <div className="flex flex-wrap gap-4 items-center">
                <select value={budgetProject} onChange={e => setBudgetProject(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg font-medium">
                  <option value="">-- Wybierz projekt --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={budgetYear} onChange={e => setBudgetYear(Number(e.target.value))}
                  className="px-3 py-2 border border-slate-200 rounded-lg">
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {!budgetProject ? (
                <div className="text-center py-12 text-slate-500">
                  <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  Wybierz projekt aby zarządzać budżetem
                </div>
              ) : (
                <>
                  {/* Alerts */}
                  {budgetKPIs.overTenPct && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-red-800">🚨 Budżet przekroczony o ponad 10%!</p>
                        <p className="text-sm text-red-700">
                          Faktyczne: {formatCurrency(budgetKPIs.totalActual)} z planowanych {formatCurrency(budgetKPIs.totalPlanned)}.
                          Przekroczenie: {formatCurrency(budgetKPIs.totalActual - budgetKPIs.totalPlanned)} ({((budgetKPIs.pctSpent - 1) * 100).toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                  )}
                  {budgetKPIs.overBudget && !budgetKPIs.overTenPct && (
                    <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-orange-800">⚠️ Budżet nieznacznie przekroczony</p>
                        <p className="text-sm text-orange-700">
                          Faktyczne: {formatCurrency(budgetKPIs.totalActual)} z {formatCurrency(budgetKPIs.totalPlanned)}.
                        </p>
                      </div>
                    </div>
                  )}
                  {budgetKPIs.warningThreshold && (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-800">⚠️ Uwaga: wykorzystano ponad 80% budżetu</p>
                        <p className="text-sm text-amber-700">
                          Faktyczne: {formatCurrency(budgetKPIs.totalActual)} z {formatCurrency(budgetKPIs.totalPlanned)}.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Per-category AI alerts */}
                  {budgetKPIs.categoryAlerts && budgetKPIs.categoryAlerts.length > 0 && (
                    <div className="space-y-2">
                      {budgetKPIs.categoryAlerts.map(cat => (
                        <div key={cat.code} className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-yellow-800">
                              ⚠️ {cat.label}: {(cat.pct * 100).toFixed(0)}% budżetu wykorzystane
                            </p>
                            <p className="text-sm text-yellow-700">
                              Wydano {formatCurrency(cat.actual)} z {formatCurrency(cat.planned)}.
                              Pozostało: {formatCurrency(cat.planned - cat.actual)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Budżet projektu', value: budgetKPIs.totalPlanned, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { label: 'Faktyczne (actual)', value: budgetKPIs.totalActual, color: budgetKPIs.overBudget ? 'text-red-600' : 'text-slate-900', bg: budgetKPIs.overBudget ? 'bg-red-50' : 'bg-slate-50' },
                      { label: 'Pozostało', value: budgetKPIs.remaining, color: budgetKPIs.remaining < 0 ? 'text-red-600' : 'text-green-600', bg: 'bg-green-50' },
                      { label: 'Realizacja', value: budgetKPIs.pctSpent * 100, color: budgetKPIs.overBudget ? 'text-red-600' : 'text-purple-600', bg: 'bg-purple-50', isPercent: true },
                    ].map(({ label, value, color, bg, isPercent }) => (
                      <div key={label} className={`p-4 rounded-xl border border-slate-200 ${bg}`}>
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className={`text-xl font-bold ${color}`}>{isPercent ? `${value.toFixed(1)}%` : formatCurrency(value)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Budget vs Actual Bar Chart by category */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Plan vs Realizacja wg kategorii
                      </h3>
                      <button
                        onClick={() => { setBudgetItemForm({ category: 'materialy', name: '', planned_amount: 0, actual_amount: 0 }); setShowAddBudgetItemModal(true); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" /> Dodaj pozycję budżetową
                      </button>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={budgetBarData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="Plan" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Faktura" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Budget Items Table */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-purple-600" />
                      Pozycje budżetowe
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        {budgetItems.length === 0 ? (
                          <div className="text-center py-8 text-slate-400">
                            <Target className="w-10 h-10 mx-auto mb-2" />
                            <p className="text-sm">Brak pozycji. Dodaj pierwszą pozycję budżetową.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-100">
                                  <th className="text-left pb-2 pr-2">Nazwa</th>
                                  <th className="text-left pb-2 pr-2">Kategoria</th>
                                  <th className="text-right pb-2 pr-2">Plan</th>
                                  <th className="text-right pb-2 pr-2">Fakt</th>
                                  <th className="text-right pb-2 pr-2">Odchyl.</th>
                                  <th className="pb-2"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {budgetItems.map(item => {
                                  const deviation = (item.actual_amount || 0) - (item.planned_amount || 0);
                                  const over = deviation > 0;
                                  const catInfo = BUDGET_CATEGORIES.find(c => c.code === item.category);
                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                      <td className="py-2 pr-2 font-medium text-slate-800">{item.name}</td>
                                      <td className="py-2 pr-2">
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                          style={{ backgroundColor: catInfo?.color + '22', color: catInfo?.color }}>
                                          {catInfo?.label || item.category}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-2 text-right text-slate-600">{formatCurrency(item.planned_amount || 0)}</td>
                                      <td className="py-2 pr-2 text-right font-medium">{formatCurrency(item.actual_amount || 0)}</td>
                                      <td className={`py-2 pr-2 text-right font-semibold ${over ? 'text-red-600' : 'text-green-600'}`}>
                                        {over ? '+' : ''}{formatCurrency(deviation)}
                                      </td>
                                      <td className="py-2">
                                        <button onClick={() => handleDeleteBudgetItem(item.id!)}
                                          className="p-1 hover:bg-red-100 rounded text-red-400 opacity-0 group-hover:opacity-100">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="border-t-2 border-slate-200">
                                <tr className="font-bold text-slate-900">
                                  <td className="pt-2 pr-2" colSpan={2}>Łącznie</td>
                                  <td className="pt-2 pr-2 text-right">{formatCurrency(budgetKPIs.totalPlanned)}</td>
                                  <td className="pt-2 pr-2 text-right">{formatCurrency(budgetKPIs.totalActual)}</td>
                                  <td className={`pt-2 pr-2 text-right ${budgetKPIs.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {budgetKPIs.remaining < 0 ? '+' : ''}{formatCurrency(-budgetKPIs.remaining)}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Pie Chart */}
                      {budgetPieData.length > 0 ? (
                        <div>
                          <ResponsiveContainer width="100%" height={220}>
                            <RPieChart>
                              <Pie data={budgetPieData} cx="50%" cy="50%" outerRadius={80}
                                dataKey="value" nameKey="name"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={true}>
                                {budgetPieData.map((entry, i) => (
                                  <Cell key={i} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => formatCurrency(v)} />
                            </RPieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-slate-400 text-sm">
                          Dodaj pozycje budżetowe aby zobaczyć wykres
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Operation Modal */}
      {showOperationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editingOperation ? 'Edytuj operację' : 'Nowa operacja'}</h2>
              <button onClick={() => setShowOperationModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {(['income', 'expense'] as FinanceOperationType[]).map(type => (
                  <button key={type} type="button"
                    onClick={() => setOperationForm({ ...operationForm, operation_type: type })}
                    className={`p-4 rounded-lg border-2 text-center transition ${
                      operationForm.operation_type === type
                        ? (type === 'income' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                        : 'border-slate-200 hover:border-slate-300'
                    }`}>
                    {type === 'income' ? <ArrowUpRight className={`w-6 h-6 mx-auto mb-1 ${operationForm.operation_type === type ? 'text-green-600' : 'text-slate-400'}`} /> :
                     <ArrowDownRight className={`w-6 h-6 mx-auto mb-1 ${operationForm.operation_type === type ? 'text-red-600' : 'text-slate-400'}`} />}
                    <span className={operationForm.operation_type === type ? (type === 'income' ? 'text-green-700 font-medium' : 'text-red-700 font-medium') : 'text-slate-600'}>
                      {type === 'income' ? 'Przychód' : 'Wydatek'}
                    </span>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kwota *</label>
                <input type="number" value={operationForm.amount || ''} step="0.01" min="0"
                  onChange={e => setOperationForm({ ...operationForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <input type="text" value={operationForm.description}
                  onChange={e => setOperationForm({ ...operationForm, description: e.target.value })}
                  placeholder="np. Faktura za materiały"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input type="date" value={operationForm.operation_date}
                    onChange={e => setOperationForm({ ...operationForm, operation_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nr dokumentu</label>
                  <input type="text" value={operationForm.document_number}
                    onChange={e => setOperationForm({ ...operationForm, document_number: e.target.value })}
                    placeholder="FV/2024/001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                  <select value={operationForm.project_id} onChange={e => setOperationForm({ ...operationForm, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Konto</label>
                  <select value={operationForm.account_id} onChange={e => setOperationForm({ ...operationForm, account_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kontrahent</label>
                <select value={operationForm.contractor_id} onChange={e => setOperationForm({ ...operationForm, contractor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="">-- Wybierz --</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowOperationModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleSaveOperation} disabled={!operationForm.amount || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
              <h2 className="text-lg font-semibold">{editingAct ? 'Edytuj akt' : 'Nowy akt wykonawczy'}</h2>
              <button onClick={() => setShowActModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Numer *</label>
                  <input type="text" value={actForm.number} onChange={e => setActForm({ ...actForm, number: e.target.value })}
                    placeholder="ACT-001" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data aktu</label>
                  <input type="date" value={actForm.act_date} onChange={e => setActForm({ ...actForm, act_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa</label>
                <input type="text" value={actForm.name} onChange={e => setActForm({ ...actForm, name: e.target.value })}
                  placeholder="np. Akt wykonania robót elektrycznych"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                  <select value={actForm.project_id} onChange={e => setActForm({ ...actForm, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kontrahent</label>
                  <select value={actForm.contractor_id} onChange={e => setActForm({ ...actForm, contractor_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Wybierz --</option>
                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Okres od</label>
                  <input type="date" value={actForm.period_start} onChange={e => setActForm({ ...actForm, period_start: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Okres do</label>
                  <input type="date" value={actForm.period_end} onChange={e => setActForm({ ...actForm, period_end: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Suma *</label>
                  <input type="number" value={actForm.total || ''} step="0.01" min="0"
                    onChange={e => setActForm({ ...actForm, total: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VAT</label>
                  <input type="number" value={actForm.nds_amount || ''} step="0.01" min="0"
                    onChange={e => setActForm({ ...actForm, nds_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status płatności</label>
                <select value={actForm.payment_status} onChange={e => setActForm({ ...actForm, payment_status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="pending">Oczekuje</option>
                  <option value="partial">Częściowo opłacony</option>
                  <option value="paid">Opłacony</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowActModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleSaveAct} disabled={!actForm.number || !actForm.total || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingAct ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Item Modal */}
      {showAddBudgetItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Dodaj pozycję budżetową</h2>
              <button onClick={() => setShowAddBudgetItemModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kategoria *</label>
                <select value={budgetItemForm.category}
                  onChange={e => setBudgetItemForm({ ...budgetItemForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  {BUDGET_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa pozycji *</label>
                <input type="text" value={budgetItemForm.name}
                  onChange={e => setBudgetItemForm({ ...budgetItemForm, name: e.target.value })}
                  placeholder="np. Cement, piasek, robocizna elektryczna..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kwota planowana (PLN)</label>
                  <input type="number" value={budgetItemForm.planned_amount || ''}
                    onChange={e => setBudgetItemForm({ ...budgetItemForm, planned_amount: parseFloat(e.target.value) || 0 })}
                    min="0" step="0.01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kwota faktyczna (PLN)</label>
                  <input type="number" value={budgetItemForm.actual_amount || ''}
                    onChange={e => setBudgetItemForm({ ...budgetItemForm, actual_amount: parseFloat(e.target.value) || 0 })}
                    min="0" step="0.01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowAddBudgetItemModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleAddBudgetItem} disabled={!budgetItemForm.name || savingBudget}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingBudget ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Dodaj pozycję
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
              <h2 className="text-lg font-semibold">{editingAccount ? 'Edytuj konto' : 'Nowe konto finansowe'}</h2>
              <button onClick={() => setShowAccountModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa konta *</label>
                <input type="text" value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                  placeholder="np. Konto główne PKO"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Typ konta</label>
                <select value={accountForm.account_type} onChange={e => setAccountForm({ ...accountForm, account_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="bank">Konto bankowe</option>
                  <option value="cash">Gotówka</option>
                  <option value="card">Karta</option>
                </select>
              </div>
              {accountForm.account_type === 'bank' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa banku</label>
                    <input type="text" value={accountForm.bank_name}
                      onChange={e => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                      placeholder="np. PKO BP"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numer konta</label>
                    <input type="text" value={accountForm.account_number}
                      onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })}
                      placeholder="PL 00 0000 0000 0000 0000 0000 0000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Saldo początkowe</label>
                <input type="number" value={accountForm.current_balance || ''} step="0.01"
                  onChange={e => setAccountForm({ ...accountForm, current_balance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowAccountModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
              <button onClick={handleSaveAccount} disabled={!accountForm.name || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
