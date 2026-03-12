import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, Search, DollarSign, TrendingUp, TrendingDown, Wallet,
  CreditCard, Loader2, Download, Calendar, Building2,
  FileText, ArrowUpRight, ArrowDownRight, PieChart, BarChart3,
  Receipt, CheckCircle, Clock, AlertCircle, X, Pencil, Save,
  Trash2, AlertTriangle, Target, Layers, Brain,
  Upload, Banknote, Info,
  Activity, Lightbulb, Shield, Eye
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart as RPieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
  ComposedChart, ReferenceLine
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project, FinanceAccount, FinanceOperation, FinanceAct,
  FinanceOperationType, FinanceOperationStatus, ActStatus, Contractor, Offer
} from '../../types';
import {
  FINANCE_OPERATION_TYPE_LABELS, FINANCE_OPERATION_TYPE_COLORS,
  FINANCE_OPERATION_STATUS_LABELS, ACT_STATUS_LABELS, ACT_STATUS_COLORS
} from '../../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type TabType = 'operations' | 'acts' | 'accounts' | 'budget' | 'cashflow' | 'ai';

const BUDGET_CATEGORIES = [
  { code: 'materialy', label: 'Materiały', color: '#3b82f6' },
  { code: 'robocizna', label: 'Robocizna', color: '#10b981' },
  { code: 'sprzet', label: 'Sprzęt', color: '#f59e0b' },
  { code: 'inne', label: 'Inne', color: '#8b5cf6' },
];

const MONTHS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

const INDUSTRY_BENCHMARKS: Record<string, { min: number; max: number; label: string }> = {
  materialy: { min: 40, max: 60, label: 'Materiały' },
  robocizna: { min: 25, max: 40, label: 'Robocizna' },
  sprzet: { min: 5, max: 15, label: 'Sprzęt' },
  inne: { min: 3, max: 10, label: 'Inne' },
};

interface BudgetItem {
  id?: string;
  project_id: string;
  company_id?: string;
  category: string;
  name: string;
  planned_amount: number;
  actual_amount: number;
  notes?: string;
  created_at?: string;
}

interface ReceiptFile {
  id: string;
  operation_id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
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
  const [offers, setOffers] = useState<Offer[]>([]);
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
  const [budgetItemForm, setBudgetItemForm] = useState({ category: 'materialy', name: '', planned_amount: 0, actual_amount: 0, notes: '' });
  const [editingBudgetItem, setEditingBudgetItem] = useState<BudgetItem | null>(null);
  const [budgetSnapshots, setBudgetSnapshots] = useState<Array<{date: string; totalPlanned: number; totalActual: number; categories: any[]}>>([]);
  const [showSmartAlerts, setShowSmartAlerts] = useState(true);
  const [editingBudgetItemId, setEditingBudgetItemId] = useState<string | null>(null);
  const [editingBudgetValue, setEditingBudgetValue] = useState<{planned: number; actual: number}>({ planned: 0, actual: 0 });

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiSavings, setAiSavings] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSavingsLoading, setAiSavingsLoading] = useState(false);
  const [aiProject, setAiProject] = useState<string>('');

  // Cashflow state
  const [cashflowPeriod, setCashflowPeriod] = useState<'6m' | '12m'>('6m');

  // Receipt upload state
  const [receipts, setReceipts] = useState<Record<string, ReceiptFile[]>>({});
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    document_number: '', budget_category: '',
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
      const [operationsRes, actsRes, accountsRes, projectsRes, contractorsRes, offersRes] = await Promise.all([
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
          .is('deleted_at', null),
        supabase.from('offers')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);

      if (operationsRes.data) setOperations(operationsRes.data);
      if (actsRes.data) setActs(actsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (projectsRes.data) {
        setProjects(projectsRes.data);
        if (!budgetProject && projectsRes.data.length > 0) {
          setBudgetProject(projectsRes.data[0].id);
          setAiProject(projectsRes.data[0].id);
        }
      }
      if (contractorsRes.data) setContractors(contractorsRes.data);
      if (offersRes.data) setOffers(offersRes.data as unknown as Offer[]);
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
    if (activeTab === 'budget' && budgetProject) loadBudgetData();
  }, [activeTab, budgetProject, budgetYear]);

  const loadReceipts = useCallback(async (opIds: string[]) => {
    if (!opIds.length) return;
    try {
      const { data } = await supabase.from('finance_receipts').select('*').in('operation_id', opIds);
      if (data) {
        const map: Record<string, ReceiptFile[]> = {};
        data.forEach((r: ReceiptFile) => {
          if (!map[r.operation_id]) map[r.operation_id] = [];
          map[r.operation_id].push(r);
        });
        setReceipts(map);
      }
    } catch (err) {
      // Table might not exist yet
      console.warn('Receipts table not available:', err);
    }
  }, []);

  useEffect(() => {
    if (operations.length > 0) loadReceipts(operations.map(o => o.id));
  }, [operations]);

  // ==================== STATS ====================
  const stats = useMemo(() => {
    const completedOps = operations.filter(o => o.status === 'completed');
    const income = completedOps.filter(o => o.operation_type === 'income').reduce((s, o) => s + o.amount, 0);
    const expense = completedOps.filter(o => o.operation_type === 'expense').reduce((s, o) => s + o.amount, 0);
    const totalBalance = accounts.reduce((s, a) => s + (a.current_balance || (a as any).balance || 0), 0);
    const pendingActs = acts.filter(a => a.payment_status !== 'paid').reduce((s, a) => s + ((a.total || a.amount || 0) - (a.paid_amount || 0)), 0);

    const months = cashflowPeriod === '12m' ? 12 : 6;
    const now = new Date();
    const monthlyData = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const y = d.getFullYear(), m = d.getMonth();
      const monthOps = completedOps.filter(op => {
        const od = new Date(op.operation_date);
        return od.getFullYear() === y && od.getMonth() === m;
      });
      const inc = monthOps.filter(o => o.operation_type === 'income').reduce((s, o) => s + o.amount, 0);
      const exp = monthOps.filter(o => o.operation_type === 'expense').reduce((s, o) => s + o.amount, 0);
      return { name: `${MONTHS_PL[m]}`, Przychody: inc, Koszty: exp, Saldo: inc - exp };
    });

    // Burn rate: avg monthly expense over last 3 months
    const last3Months = monthlyData.slice(-3);
    const avgMonthlyExpense = last3Months.length > 0 ? last3Months.reduce((s, m) => s + m.Koszty, 0) / last3Months.length : 0;
    const avgMonthlyIncome = last3Months.length > 0 ? last3Months.reduce((s, m) => s + m.Przychody, 0) / last3Months.length : 0;

    return { income, expense, balance: income - expense, totalBalance, pendingActs, monthlyData, avgMonthlyExpense, avgMonthlyIncome };
  }, [operations, accounts, acts, cashflowPeriod]);

  // ==================== CASHFLOW ====================
  const cashflowData = useMemo(() => {
    const now = new Date();
    const months = cashflowPeriod === '12m' ? 12 : 6;
    const completedOps = operations.filter(o => o.status === 'completed');

    const historical = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const y = d.getFullYear(), m = d.getMonth();
      const monthOps = completedOps.filter(op => {
        const od = new Date(op.operation_date);
        return od.getFullYear() === y && od.getMonth() === m;
      });
      const inc = monthOps.filter(o => o.operation_type === 'income').reduce((s, o) => s + o.amount, 0);
      const exp = monthOps.filter(o => o.operation_type === 'expense').reduce((s, o) => s + o.amount, 0);
      const paidOffers = offers.filter(of => {
        if (of.status !== 'accepted') return false;
        const od = of.accepted_at ? new Date(of.accepted_at) : null;
        return od && od.getFullYear() === y && od.getMonth() === m;
      }).reduce((s, of) => s + (of.final_amount || of.total_amount || 0), 0);
      return { name: `${MONTHS_PL[m]}`, Przychody: inc, Koszty: exp, Oferty: paidOffers, Saldo: inc - exp, isForecast: false };
    });

    // Forecast next 3 months
    const lastMonths = historical.slice(-3);
    const avgInc = lastMonths.reduce((s, m) => s + m.Przychody, 0) / 3;
    const avgExp = lastMonths.reduce((s, m) => s + m.Koszty, 0) / 3;
    const pendingOffersTotal = offers.filter(of => ['sent', 'negotiation'].includes(of.status))
      .reduce((s, of) => s + (of.final_amount || of.total_amount || 0), 0);
    const pendingIncPerMonth = pendingOffersTotal / 3;

    const forecast = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
      const m = d.getMonth();
      const forecastInc = avgInc + pendingIncPerMonth * (1 - i * 0.2);
      const forecastExp = avgExp * (1 + i * 0.05);
      return { name: `${MONTHS_PL[m]}*`, Przychody: Math.max(0, forecastInc), Koszty: Math.max(0, forecastExp), Oferty: 0, Saldo: forecastInc - forecastExp, isForecast: true };
    });

    const offersBreakdown = {
      accepted: offers.filter(o => o.status === 'accepted'),
      pending: offers.filter(o => ['sent', 'negotiation'].includes(o.status)),
      draft: offers.filter(o => o.status === 'draft'),
    };

    return { historical, forecast, combined: [...historical, ...forecast], offersBreakdown };
  }, [operations, offers, cashflowPeriod]);

  // ==================== BUDGET KPIs ====================
  const budgetKPIs = useMemo(() => {
    const totalPlanned = budgetItems.reduce((s, c) => s + (c.planned_amount || 0), 0);
    const totalActual = budgetItems.reduce((s, c) => s + (c.actual_amount || 0), 0);
    const remaining = totalPlanned - totalActual;
    const pctSpent = totalPlanned > 0 ? totalActual / totalPlanned : 0;
    const overBudget = totalActual > totalPlanned && totalPlanned > 0;
    const overTenPct = totalPlanned > 0 && (totalActual - totalPlanned) / totalPlanned > 0.1;
    const warningThreshold = pctSpent > 0.8 && !overBudget && totalPlanned > 0;

    const categoryAlerts = BUDGET_CATEGORIES.map(cat => {
      const catItems = budgetItems.filter(i => i.category === cat.code);
      const planned = catItems.reduce((s, i) => s + (i.planned_amount || 0), 0);
      const actual = catItems.reduce((s, i) => s + (i.actual_amount || 0), 0);
      const pct = planned > 0 ? actual / planned : 0;
      return { ...cat, planned, actual, pct, alert: planned > 0 && pct >= 0.8 && actual <= planned };
    }).filter(c => c.alert);

    return { totalPlanned, totalActual, remaining, pctSpent, overBudget, overTenPct, warningThreshold, categoryAlerts };
  }, [budgetItems]);

  const categoryAggregates = useMemo(() => {
    return BUDGET_CATEGORIES.map(cat => {
      const items = budgetItems.filter(i => i.category === cat.code);
      const planned = items.reduce((s, i) => s + (i.planned_amount || 0), 0);
      const actual = items.reduce((s, i) => s + (i.actual_amount || 0), 0);
      const deviation = actual - planned;
      const pct = planned > 0 ? actual / planned : 0;
      return { ...cat, planned, actual, deviation, pct };
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

  const formatDate = (date: string) => new Date(date).toLocaleDateString('pl-PL');

  // ==================== AI ANALYSIS ====================
  const handleAnalyzeAI = async () => {
    setAiLoading(true);
    setAiAnalysis('');
    try {
      const project = projects.find(p => p.id === (aiProject || budgetProject));
      const catData = categoryAggregates.map(c => ({
        category: c.label,
        planned: c.planned, actual: c.actual, deviation: c.deviation,
        pct: (c.pct * 100).toFixed(1) + '%',
        benchmark: INDUSTRY_BENCHMARKS[c.code],
      }));

      const prompt = `Jesteś ekspertem analizy finansowej w budownictwie. Przeanalizuj budżet projektu i wskaż anomalie.

PROJEKT: ${project?.name || 'Projekt budowlany'}
BUDŻET: planowany ${budgetKPIs.totalPlanned} PLN, faktyczny ${budgetKPIs.totalActual} PLN

ROZKŁAD KATEGORII:
${catData.map(c => `- ${c.category}: plan ${c.planned} PLN, fakt ${c.actual} PLN, realizacja ${c.pct} (benchmark branżowy: ${c.benchmark?.min}-${c.benchmark?.max}% budżetu)`).join('\n')}

POZYCJE BUDŻETOWE:
${budgetItems.slice(0, 20).map(i => `- ${i.name} (${i.category}): plan ${i.planned_amount} PLN, fakt ${i.actual_amount} PLN`).join('\n')}

OSTATNIE OPERACJE:
${operations.slice(0, 10).map(o => `- ${o.description || 'Operacja'}: ${o.operation_type === 'expense' ? '-' : '+'}${o.amount} PLN`).join('\n')}

Podaj:
1. 🔍 ANOMALIE - co odbiega od normy branżowej
2. ⚠️ RYZYKA - co zagraża budżetowi
3. 📊 OCENA KONDYCJI FINANSOWEJ: X/10
4. 💡 TOP 3 REKOMENDACJE

Odpowiedź po polsku, zwięźle z emoji.`;

      const geminiApiKey = 'AIzaSyC2eB-eTn0lxJc2-0iFLFkLxN9Wq5mXE_s';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
          })
        }
      );
      const data = await response.json();
      setAiAnalysis(data.candidates?.[0]?.content?.parts?.[0]?.text || 'Brak odpowiedzi AI');
    } catch (err) {
      console.error('AI analysis error:', err);
      setAiAnalysis('Błąd analizy AI. Sprawdź połączenie.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAISavings = async () => {
    setAiSavingsLoading(true);
    setAiSavings('');
    try {
      const project = projects.find(p => p.id === (aiProject || budgetProject));

      const prompt = `Jesteś ekspertem optymalizacji kosztów w budownictwie.

PROJEKT: ${project?.name || 'Projekt budowlany'}
BUDŻET: ${formatCurrency(budgetKPIs.totalPlanned)} plan, ${formatCurrency(budgetKPIs.totalActual)} fakt

KATEGORIE:
${categoryAggregates.map(c => `- ${c.label}: ${formatCurrency(c.actual)} (${(c.pct * 100).toFixed(0)}% planu)`).join('\n')}

WYDATKI:
${operations.filter(o => o.operation_type === 'expense').slice(0, 15).map(o => `- ${o.description || 'Wydatek'}: ${formatCurrency(o.amount)}`).join('\n')}

Odpowiedz konkretnie: "Gdzie można zaoszczędzić?"
Podaj 5-7 propozycji z szacowanymi kwotami oszczędności.
Format: 💰 [Propozycja] → oszczędność ~X PLN (Y%)

Potem: ## Priorytetyzacja (3 działania od zaraz)

Odpowiedź po polsku. Bardzo konkretnie.`;

      const geminiApiKey = 'AIzaSyC2eB-eTn0lxJc2-0iFLFkLxN9Wq5mXE_s';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1200 }
          })
        }
      );
      const data = await response.json();
      setAiSavings(data.candidates?.[0]?.content?.parts?.[0]?.text || 'Brak odpowiedzi AI');
    } catch (err) {
      console.error('AI savings error:', err);
      setAiSavings('Błąd analizy AI.');
    } finally {
      setAiSavingsLoading(false);
    }
  };

  // ==================== RECEIPT UPLOAD ====================
  const handleReceiptUpload = async (file: File, operationId: string) => {
    if (!currentUser || !file) return;
    setUploadingReceipt(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `receipts/${currentUser.company_id}/${operationId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('finance-receipts')
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('finance-receipts').getPublicUrl(path);
      const fileUrl = urlData.publicUrl;
      await supabase.from('finance_receipts').insert({
        company_id: currentUser.company_id,
        operation_id: operationId,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by_id: currentUser.id,
      });
      setUploadedReceiptUrl(fileUrl);
      await loadReceipts([operationId]);
    } catch (err) {
      // Fallback: data URL for preview
      const reader = new FileReader();
      reader.onload = (e) => setUploadedReceiptUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } finally {
      setUploadingReceipt(false);
    }
  };

  // ==================== JPK ====================
  const handleExportJPK = () => {
    const now = new Date();
    const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const company = currentUser?.company_id || '';
    const jpkXml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02172/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M" wersjaSchemy="1-2">JPK_VAT</KodFormularza>
    <DataWytworzeniaJPK>${now.toISOString()}</DataWytworzeniaJPK>
    <NazwaSystemu>MaxMaster Portal</NazwaSystemu>
    <DataOd>${periodStart}</DataOd>
    <DataDo>${periodEnd}</DataDo>
    <NIP>${company}</NIP>
  </Naglowek>
  <SprzedazWiersz>
    ${acts.filter(a => {
      const d = new Date(a.act_date || a.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).map((a, i) => `
    <LpSprzedazy>${i + 1}</LpSprzedazy>
    <NazwaKontrahenta>${(a as any).contractor?.name || ''}</NazwaKontrahenta>
    <DowodSprzedazy>${a.number}</DowodSprzedazy>
    <DataWystawienia>${a.act_date || a.date}</DataWystawienia>
    <K_19>${((a.total || 0) - (a.nds_amount || 0)).toFixed(2)}</K_19>
    <K_20>${(a.nds_amount || 0).toFixed(2)}</K_20>`).join('\n')}
  </SprzedazWiersz>
</JPK>`;
    const blob = new Blob([jpkXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `JPK_V7M_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.xml`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleCreateInvoiceFromAct = (act: FinanceAct) => {
    setActForm({
      project_id: act.project_id || '', contractor_id: act.contractor_id || '',
      number: `FV/${act.number}`, name: `Faktura za: ${act.name || `Akt nr ${act.number}`}`,
      act_date: new Date().toISOString().split('T')[0],
      period_start: act.period_start?.split('T')[0] || '',
      period_end: act.period_end?.split('T')[0] || '',
      total: act.total || act.amount || 0, nds_amount: act.nds_amount || 0, payment_status: 'pending'
    });
    setEditingAct(null); setShowActModal(true);
  };

  // ==================== BUDGET CRUD ====================
  const handleAddBudgetItem = async () => {
    if (!currentUser || !budgetProject || !budgetItemForm.name) return;
    setSavingBudget(true);
    try {
      const { data, error } = await supabase.from('budget_items').insert({
        project_id: budgetProject, company_id: currentUser.company_id,
        category: budgetItemForm.category, name: budgetItemForm.name,
        planned_amount: budgetItemForm.planned_amount, actual_amount: budgetItemForm.actual_amount,
        notes: budgetItemForm.notes || null,
      }).select().single();
      if (!error && data) setBudgetItems(prev => [...prev, data]);
      setShowAddBudgetItemModal(false);
      setBudgetItemForm({ category: 'materialy', name: '', planned_amount: 0, actual_amount: 0, notes: '' });
    } catch (err) { console.error('Error adding budget item:', err); }
    finally { setSavingBudget(false); }
  };

  const handleDeleteBudgetItem = async (id: string) => {
    if (!confirm('Usunąć pozycję budżetową?')) return;
    await supabase.from('budget_items').delete().eq('id', id);
    setBudgetItems(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateBudgetItemAmounts = async (id: string) => {
    const { error } = await supabase.from('budget_items').update({
      planned_amount: editingBudgetValue.planned,
      actual_amount: editingBudgetValue.actual,
    }).eq('id', id);
    if (!error) {
      setBudgetItems(prev => prev.map(i => i.id === id
        ? { ...i, planned_amount: editingBudgetValue.planned, actual_amount: editingBudgetValue.actual }
        : i
      ));
    }
    setEditingBudgetItemId(null);
  };

  // ==================== BUDGET SNAPSHOT ====================
  const handleSaveBudgetSnapshot = () => {
    const snapshot = {
      date: new Date().toISOString(),
      totalPlanned: budgetKPIs.totalPlanned,
      totalActual: budgetKPIs.totalActual,
      categories: categoryAggregates.map(c => ({ code: c.code, label: c.label, planned: c.planned, actual: c.actual })),
    };
    setBudgetSnapshots(prev => [...prev, snapshot]);
    try {
      const key = `budget_snapshots_${budgetProject}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(snapshot);
      if (existing.length > 12) existing.shift(); // keep last 12
      localStorage.setItem(key, JSON.stringify(existing));
      alert('✓ Snapshot budżetu zapisany!');
    } catch(e) {}
  };

  // Load snapshots from localStorage
  useEffect(() => {
    if (!budgetProject) return;
    try {
      const key = `budget_snapshots_${budgetProject}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setBudgetSnapshots(saved);
    } catch(e) {}
  }, [budgetProject]);

  // ==================== OPERATION CRUD ====================
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
        amount: operationForm.amount, description: operationForm.description,
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
      setShowOperationModal(false); setEditingOperation(null); setUploadedReceiptUrl('');
      resetOperationForm(); await loadData();
    } catch (err) { console.error('Error saving operation:', err); }
    finally { setSaving(false); }
  };

  const handleDeleteOperation = async (op: FinanceOperation) => {
    if (!confirm('Czy na pewno chcesz usunąć tę operację?')) return;
    await supabase.from('finance_operations').update({ deleted_at: new Date().toISOString() }).eq('id', op.id);
    await loadData();
  };

  const resetOperationForm = () => setOperationForm({
    project_id: '', account_id: '', contractor_id: '', operation_type: 'expense',
    amount: 0, description: '', operation_date: new Date().toISOString().split('T')[0],
    document_number: '', budget_category: '',
  });

  // ==================== ACT CRUD ====================
  const handleSaveAct = async () => {
    if (!currentUser || !actForm.number || !actForm.total) return;
    setSaving(true);
    try {
      const data = {
        company_id: currentUser.company_id, project_id: actForm.project_id || null,
        contractor_id: actForm.contractor_id || null, number: actForm.number, name: actForm.name,
        act_date: actForm.act_date, period_start: actForm.period_start || null,
        period_end: actForm.period_end || null, total: actForm.total, nds_amount: actForm.nds_amount,
        payment_status: actForm.payment_status, status: 'draft' as ActStatus,
        created_by_id: currentUser.id
      };
      if (editingAct) await supabase.from('finance_acts').update(data).eq('id', editingAct.id);
      else await supabase.from('finance_acts').insert(data);
      setShowActModal(false); setEditingAct(null); resetActForm(); await loadData();
    } catch (err) { console.error('Error saving act:', err); }
    finally { setSaving(false); }
  };

  const handleDeleteAct = async (act: FinanceAct) => {
    if (!confirm('Czy na pewno chcesz usunąć ten akt?')) return;
    await supabase.from('finance_acts').update({ deleted_at: new Date().toISOString() }).eq('id', act.id);
    await loadData();
  };

  const resetActForm = () => setActForm({
    project_id: '', contractor_id: '', number: '', name: '',
    act_date: new Date().toISOString().split('T')[0], period_start: '', period_end: '',
    total: 0, nds_amount: 0, payment_status: 'pending'
  });

  // ==================== ACCOUNT CRUD ====================
  const handleSaveAccount = async () => {
    if (!currentUser || !accountForm.name) return;
    setSaving(true);
    try {
      const data = {
        company_id: currentUser.company_id, name: accountForm.name,
        account_type: accountForm.account_type, bank_name: accountForm.bank_name || null,
        account_number: accountForm.account_number || null, current_balance: accountForm.current_balance
      };
      if (editingAccount) await supabase.from('finance_accounts').update(data).eq('id', editingAccount.id);
      else await supabase.from('finance_accounts').insert({ ...data, is_active: true });
      setShowAccountModal(false); setEditingAccount(null); resetAccountForm(); await loadData();
    } catch (err) { console.error('Error saving account:', err); }
    finally { setSaving(false); }
  };

  const resetAccountForm = () => setAccountForm({
    name: '', account_type: 'bank', bank_name: '', account_number: '', current_balance: 0
  });

  // ==================== EXPORTS ====================
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    doc.setFontSize(18); doc.setTextColor(30, 58, 138);
    doc.text('Raport Finansowy', 14, 20);
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text(`MaxMaster Portal | ${now.toLocaleDateString('pl-PL')}`, 14, 28);
    autoTable(doc, {
      startY: 38,
      head: [['Wskaźnik', 'Wartość']],
      body: [
        ['Przychody', formatCurrency(stats.income)],
        ['Koszty', formatCurrency(stats.expense)],
        ['Bilans', formatCurrency(stats.balance)],
        ['Marża %', stats.income > 0 ? `${((stats.balance / stats.income) * 100).toFixed(1)}%` : '0%'],
        ['Saldo kont', formatCurrency(stats.totalBalance)],
        ['Należności', formatCurrency(stats.pendingActs)],
      ],
      headStyles: { fillColor: [30, 58, 138] },
    });
    const ops = filteredOperations.filter(o => o.status === 'completed');
    if (ops.length > 0) {
      const prevY = (doc as any).lastAutoTable?.finalY || 110;
      doc.setFontSize(13); doc.text('Operacje finansowe', 14, prevY + 12);
      autoTable(doc, {
        startY: prevY + 16,
        head: [['Data', 'Opis', 'Typ', 'Kwota']],
        body: ops.slice(0, 50).map(op => [
          formatDate(op.operation_date), op.description || '-',
          op.operation_type === 'income' ? 'Przychód' : 'Wydatek',
          `${op.operation_type === 'income' ? '+' : '-'}${formatCurrency(op.amount)}`,
        ]),
        styles: { fontSize: 9 }, headStyles: { fillColor: [30, 58, 138] },
      });
    }
    if (budgetItems.length > 0) {
      const prevY2 = (doc as any).lastAutoTable?.finalY || 170;
      if (prevY2 < 250) {
        doc.setFontSize(13); doc.text('Budżet projektu', 14, prevY2 + 12);
        autoTable(doc, {
          startY: prevY2 + 16,
          head: [['Kategoria', 'Pozycja', 'Plan PLN', 'Fakt PLN', 'Odchylenie']],
          body: budgetItems.map(i => {
            const dev = (i.actual_amount || 0) - (i.planned_amount || 0);
            return [
              BUDGET_CATEGORIES.find(c => c.code === i.category)?.label || i.category,
              i.name, formatCurrency(i.planned_amount), formatCurrency(i.actual_amount),
              `${dev >= 0 ? '+' : ''}${formatCurrency(dev)}`,
            ];
          }),
          styles: { fontSize: 9 }, headStyles: { fillColor: [30, 58, 138] },
        });
      }
    }
    doc.save(`Raport_Finansowy_${now.toISOString().split('T')[0]}.pdf`);
  };

  const handleExportXLSX = () => {
    const now = new Date();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Raport Finansowy MaxMaster', ''],
      ['Data:', now.toLocaleDateString('pl-PL')],
      [''],
      ['Wskaźnik', 'Wartość PLN'],
      ['Przychody', stats.income], ['Koszty', stats.expense], ['Bilans', stats.balance],
      ['Marża %', stats.income > 0 ? (stats.balance / stats.income) * 100 : 0],
      ['Saldo kont', stats.totalBalance], ['Należności', stats.pendingActs],
    ]), 'Podsumowanie');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Data', 'Opis', 'Typ', 'Projekt', 'Kwota PLN', 'Nr dokumentu'],
      ...filteredOperations.map(op => [
        formatDate(op.operation_date), op.description || '',
        op.operation_type === 'income' ? 'Przychód' : 'Wydatek',
        (op as any).project?.name || '',
        op.operation_type === 'income' ? op.amount : -op.amount,
        op.document_number || '',
      ])
    ]), 'Operacje');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Nr', 'Nazwa', 'Data', 'Projekt', 'Kontrahent', 'Suma PLN', 'VAT PLN', 'Status'],
      ...filteredActs.map(act => [
        act.number, act.name || '', formatDate(act.act_date || act.date),
        (act as any).project?.name || '', (act as any).contractor?.name || '',
        act.total || act.amount || 0, act.nds_amount || 0, act.payment_status,
      ])
    ]), 'Akty');
    if (budgetItems.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Projekt:', projects.find(p => p.id === budgetProject)?.name || ''],
        [''],
        ['Kategoria', 'Pozycja', 'Planowane PLN', 'Faktyczne PLN', 'Odchylenie PLN', 'Odchylenie %'],
        ...budgetItems.map(i => {
          const dev = (i.actual_amount || 0) - (i.planned_amount || 0);
          const pct = i.planned_amount > 0 ? (dev / i.planned_amount * 100).toFixed(1) + '%' : '0%';
          return [BUDGET_CATEGORIES.find(c => c.code === i.category)?.label || i.category, i.name, i.planned_amount, i.actual_amount, dev, pct];
        }),
        ['', 'ŁĄCZNIE', budgetKPIs.totalPlanned, budgetKPIs.totalActual, budgetKPIs.totalActual - budgetKPIs.totalPlanned, ''],
      ]), 'Budżet');
    }
    // Cashflow sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Miesiąc', 'Przychody PLN', 'Koszty PLN', 'Saldo PLN', 'Prognoza'],
      ...cashflowData.combined.map(m => [m.name, m.Przychody, m.Koszty, m.Saldo, m.isForecast ? 'TAK' : 'NIE']),
    ]), 'Cashflow');
    XLSX.writeFile(wb, `Raport_Finansowy_${now.toISOString().split('T')[0]}.xlsx`);
  };

  const handleMonthlyReportPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const year = budgetYear || now.getFullYear();
    const project = projects.find(p => p.id === budgetProject);
    
    doc.setFontSize(20); doc.setTextColor(30, 58, 138);
    doc.text('Raport Miesięczny — Budżet Projektu', 14, 20);
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text(`MaxMaster Portal | ${now.toLocaleDateString('pl-PL')}`, 14, 28);
    doc.text(`Projekt: ${project?.name || 'Brak projektu'} | Rok: ${year}`, 14, 35);

    // Summary
    autoTable(doc, {
      startY: 42,
      head: [['Wskaźnik', 'Wartość']],
      body: [
        ['Budżet planowany', formatCurrency(budgetKPIs.totalPlanned)],
        ['Faktyczne wydatki', formatCurrency(budgetKPIs.totalActual)],
        ['Pozostało', formatCurrency(budgetKPIs.remaining)],
        ['Realizacja', `${(budgetKPIs.pctSpent * 100).toFixed(1)}%`],
        ['Status', budgetKPIs.overTenPct ? '🚨 PRZEKROCZONY >10%' : budgetKPIs.overBudget ? '⚠️ Przekroczony' : budgetKPIs.warningThreshold ? '⚠️ >80% wykorzystane' : '✓ W normie'],
      ],
      headStyles: { fillColor: [30, 58, 138] },
    });

    // Categories
    const prevY1 = (doc as any).lastAutoTable?.finalY || 110;
    doc.setFontSize(13); doc.setTextColor(30);
    doc.text('Realizacja wg kategorii', 14, prevY1 + 12);
    autoTable(doc, {
      startY: prevY1 + 16,
      head: [['Kategoria', 'Planowane', 'Faktyczne', 'Odchylenie', '%']],
      body: categoryAggregates.map(c => [
        c.label,
        formatCurrency(c.planned),
        formatCurrency(c.actual),
        `${c.deviation >= 0 ? '+' : ''}${formatCurrency(c.deviation)}`,
        `${(c.pct * 100).toFixed(0)}%`,
      ]),
      headStyles: { fillColor: [30, 58, 138] },
      styles: { fontSize: 10 },
    });

    // Budget items detail
    if (budgetItems.length > 0) {
      const prevY2 = (doc as any).lastAutoTable?.finalY || 160;
      if (prevY2 < 240) {
        doc.setFontSize(13); doc.text('Szczegóły pozycji', 14, prevY2 + 12);
        autoTable(doc, {
          startY: prevY2 + 16,
          head: [['Kategoria', 'Pozycja', 'Plan PLN', 'Fakt PLN', 'Odch.']],
          body: budgetItems.map(i => {
            const dev = (i.actual_amount || 0) - (i.planned_amount || 0);
            const cat = BUDGET_CATEGORIES.find(c => c.code === i.category)?.label || i.category;
            return [cat, i.name, formatCurrency(i.planned_amount), formatCurrency(i.actual_amount), `${dev >= 0 ? '+' : ''}${formatCurrency(dev)}`];
          }),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [30, 58, 138] },
        });
      }
    }

    doc.save(`Raport_Miesięczny_${project?.name?.replace(/[^a-z0-9]/gi, '_') || 'Projekt'}_${year}.pdf`);
  };

  const handleAllProjectsXLSX = () => {
    const now = new Date();
    const wb = XLSX.utils.book_new();
    // Overview sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Sводний звіт — Wszystkie projekty', ''],
      ['Data:', now.toLocaleDateString('pl-PL')],
      [''],
      ['Projekt', 'Przychody PLN', 'Koszty PLN', 'Bilans PLN', 'Marża %'],
      ...projects.map(p => {
        const pOps = operations.filter(o => o.project_id === p.id && o.status === 'completed');
        const pInc = pOps.filter(o => o.operation_type === 'income').reduce((s, o) => s + o.amount, 0);
        const pExp = pOps.filter(o => o.operation_type === 'expense').reduce((s, o) => s + o.amount, 0);
        const pBal = pInc - pExp;
        return [p.name, pInc, pExp, pBal, pInc > 0 ? (pBal / pInc * 100).toFixed(1) + '%' : '0%'];
      }),
      ['', '', '', '', ''],
      ['ŁĄCZNIE', stats.income, stats.expense, stats.balance, stats.income > 0 ? (stats.balance / stats.income * 100).toFixed(1) + '%' : '0%'],
    ]), 'Projekty_Zestawienie');
    // Operations per project
    projects.forEach(p => {
      const pOps = operations.filter(o => o.project_id === p.id);
      if (pOps.length === 0) return;
      const sheetName = p.name.slice(0, 28).replace(/[\/:*?\[\]]/g, '_');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Data', 'Opis', 'Typ', 'Kwota PLN'],
        ...pOps.map(o => [formatDate(o.operation_date), o.description || '', o.operation_type === 'income' ? 'Przychód' : 'Wydatek', o.operation_type === 'income' ? o.amount : -o.amount]),
      ]), sheetName);
    });
    XLSX.writeFile(wb, `Zestawienie_Projektów_${now.toISOString().split('T')[0]}.xlsx`);
  };

  const handleGenerateActPDF = (act: FinanceAct) => {
    const doc = new jsPDF();
    const contractor = (act as any).contractor;
    const actDate = new Date(act.act_date || act.date);
    const netAmount = (act.total || 0) - (act.nds_amount || 0);
    doc.setFontSize(20); doc.setTextColor(30, 58, 138);
    doc.text('FAKTURA VAT', 105, 25, { align: 'center' });
    doc.setFontSize(12); doc.setTextColor(60);
    doc.text(`Nr: ${act.number}`, 105, 33, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Data: ${actDate.toLocaleDateString('pl-PL')}`, 14, 45);
    doc.setFontSize(11); doc.setTextColor(30);
    doc.text('Nabywca:', 120, 65);
    doc.setFontSize(10); doc.setTextColor(60);
    doc.text(contractor?.name || '—', 120, 72);
    if (contractor?.tax_id) doc.text(`NIP: ${contractor.tax_id}`, 120, 79);
    autoTable(doc, {
      startY: 95,
      head: [['Lp.', 'Nazwa', 'Netto PLN', 'VAT PLN', 'Brutto PLN']],
      body: [['1', act.name || `Usługi – ${act.number}`, formatCurrency(netAmount), formatCurrency(act.nds_amount || 0), formatCurrency(act.total || 0)]],
      foot: [['', 'RAZEM:', formatCurrency(netAmount), formatCurrency(act.nds_amount || 0), formatCurrency(act.total || 0)]],
      headStyles: { fillColor: [30, 58, 138] },
    });
    doc.save(`Faktura_${act.number.replace(/\//g, '_')}.pdf`);
  };

  const tabs: { key: TabType; label: string; icon: React.ElementType; badge?: string }[] = [
    { key: 'operations', label: 'Operacje', icon: DollarSign },
    { key: 'acts', label: 'Akty', icon: FileText },
    { key: 'accounts', label: 'Konta', icon: Wallet },
    { key: 'budget', label: 'Budżet', icon: PieChart },
    { key: 'cashflow', label: 'Cashflow', icon: Activity },
    { key: 'ai', label: 'AI Analiza', icon: Brain, badge: 'AI' },
  ];

  // Top 5 expenses for AI context and display
  const topExpenses = useMemo(() => {
    return operations
      .filter(o => o.operation_type === 'expense' && o.status === 'completed')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [operations]);

  // Budget burndown: months until budget exhausted at current rate
  const burndownMonths = useMemo(() => {
    if (!budgetKPIs.remaining || !stats.avgMonthlyExpense || stats.avgMonthlyExpense === 0) return null;
    if (budgetKPIs.remaining <= 0) return 0;
    return budgetKPIs.remaining / stats.avgMonthlyExpense;
  }, [budgetKPIs.remaining, stats.avgMonthlyExpense]);

  const budgetPieData = categoryAggregates.filter(c => c.planned > 0)
    .map(c => ({ name: c.label, value: c.planned, color: c.color }));
  const budgetBarData = categoryAggregates.map(cat => ({ name: cat.label, Plan: cat.planned, Fakt: cat.actual }));

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finanse &amp; Budżet</h1>
          <p className="text-sm text-slate-500 mt-0.5">Zarządzanie finansami, budżetem i cashflow projektów</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'acts' && (
            <button onClick={handleExportJPK}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 min-h-[44px] text-sm">
              <Download className="w-4 h-4" /> Eksport JPK
            </button>
          )}
          <button onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <Download className="w-4 h-4" /> Raport PDF
          </button>
          <button onClick={handleExportXLSX}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Download className="w-4 h-4" /> Raport XLSX
          </button>
          <button onClick={handleAllProjectsXLSX}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <Download className="w-4 h-4" /> Zestawienie XLSX
          </button>
          {activeTab === 'operations' && (
            <button onClick={() => { resetOperationForm(); setEditingOperation(null); setShowOperationModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-5 h-5" /> Nowa operacja
            </button>
          )}
          {activeTab === 'acts' && (
            <button onClick={() => { resetActForm(); setEditingAct(null); setShowActModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-5 h-5" /> Nowy akt
            </button>
          )}
          {activeTab === 'accounts' && (
            <button onClick={() => { resetAccountForm(); setEditingAccount(null); setShowAccountModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
          <div key={label} className={`${bg} p-4 rounded-xl border border-slate-200`}>
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
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap min-h-[44px] ${
                  activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge && <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">{tab.badge}</span>}
              </button>
            ))}
          </nav>
        </div>

        {(activeTab === 'operations' || activeTab === 'acts') && (
          <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Szukaj..." value={search} onChange={e => setSearch(e.target.value)}
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Dodaj pierwszą operację</button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOperations.map(op => {
                  const opReceipts = receipts[op.id] || [];
                  return (
                    <div key={op.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 group">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${op.operation_type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {op.operation_type === 'income' ? <ArrowUpRight className="w-5 h-5 text-green-600" /> : <ArrowDownRight className="w-5 h-5 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900 truncate">{op.description || 'Operacja finansowa'}</p>
                          {opReceipts.length > 0 && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded flex-shrink-0">
                              <Receipt className="w-3 h-3" /> {opReceipts.length}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 truncate">
                          {formatDate(op.operation_date)} • {(op as any).project?.name || 'Bez projektu'}
                          {op.document_number && ` • ${op.document_number}`}
                        </p>
                      </div>
                      <p className={`text-lg font-semibold flex-shrink-0 ${op.operation_type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {op.operation_type === 'income' ? '+' : '-'}{formatCurrency(op.amount)}
                      </p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <button onClick={e => {
                          e.stopPropagation();
                          setUploadedReceiptUrl('');
                          setEditingOperation(op);
                          setOperationForm({
                            project_id: op.project_id || '', account_id: op.account_id || '',
                            contractor_id: op.contractor_id || '',
                            operation_type: op.operation_type as FinanceOperationType,
                            amount: op.amount, description: op.description || '',
                            operation_date: op.operation_date?.split('T')[0] || '',
                            document_number: op.document_number || '',
                            budget_category: (op as any).budget_category || '',
                          });
                          setShowOperationModal(true);
                        }} className="p-1.5 hover:bg-slate-200 rounded"><Pencil className="w-4 h-4 text-slate-400" /></button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteOperation(op); }}
                          className="p-1.5 hover:bg-red-100 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'acts' ? (
            filteredActs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Brak aktów wykonawczych</p>
                <button onClick={() => { resetActForm(); setShowActModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Dodaj pierwszy akt</button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredActs.map(act => (
                  <div key={act.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 group">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">Akt nr {act.number}</p>
                      <p className="text-sm text-slate-500 truncate">
                        {formatDate(act.act_date || act.date)} • {(act as any).project?.name}
                        {(act as any).contractor?.name && ` • ${(act as any).contractor?.name}`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                      act.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                      act.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {act.payment_status === 'paid' ? '✓ Opłacony' : act.payment_status === 'partial' ? '~ Częściowo' : '⏳ Oczekuje'}
                    </span>
                    <p className="text-lg font-semibold text-slate-900 flex-shrink-0">{formatCurrency(act.total || act.amount || 0)}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <button onClick={e => { e.stopPropagation(); handleCreateInvoiceFromAct(act); }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Faktura</button>
                      <button onClick={e => { e.stopPropagation(); handleGenerateActPDF(act); }}
                        className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">PDF</button>
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
                      }} className="p-1 hover:bg-slate-200 rounded"><Pencil className="w-4 h-4 text-slate-400" /></button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteAct(act); }}
                        className="p-1 hover:bg-red-100 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Dodaj pierwsze konto</button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map(account => (
                  <div key={account.id} className="p-4 bg-slate-50 rounded-lg group">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${account.account_type === 'bank' ? 'bg-blue-100' : account.account_type === 'cash' ? 'bg-green-100' : 'bg-purple-100'}`}>
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
                          current_balance: (account.current_balance || (account as any).balance || 0),
                        });
                        setShowAccountModal(true);
                      }} className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100">
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(account.current_balance || (account as any).balance || 0)}</p>
                    {account.account_number && <p className="text-xs text-slate-400 mt-1">{account.account_number}</p>}
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'budget' ? (
            /* ======= BUDGET TAB ======= */
            <div className="space-y-6">
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
                {budgetProject && (
                  <>
                    <button onClick={handleMonthlyReportPDF}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                      <FileText className="w-4 h-4" /> Raport miesięczny PDF
                    </button>
                    <button onClick={handleSaveBudgetSnapshot}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm"
                      title="Zapisz obecny stan budżetu jako punkt odniesienia">
                      <Save className="w-4 h-4" /> Snapshot
                    </button>
                  </>
                )}
              </div>

              {!budgetProject ? (
                <div className="text-center py-12 text-slate-500">
                  <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  Wybierz projekt aby zarządzać budżetem
                </div>
              ) : (
                <>
                  {budgetKPIs.overTenPct && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-red-800">🚨 Budżet przekroczony o ponad 10%!</p>
                        <p className="text-sm text-red-700">
                          Faktyczne: {formatCurrency(budgetKPIs.totalActual)} z {formatCurrency(budgetKPIs.totalPlanned)}.
                          Przekroczenie: {formatCurrency(budgetKPIs.totalActual - budgetKPIs.totalPlanned)} ({((budgetKPIs.pctSpent - 1) * 100).toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                  )}
                  {budgetKPIs.overBudget && !budgetKPIs.overTenPct && (
                    <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <p className="font-semibold text-orange-800">⚠️ Budżet nieznacznie przekroczony: {formatCurrency(budgetKPIs.totalActual)} z {formatCurrency(budgetKPIs.totalPlanned)}</p>
                    </div>
                  )}
                  {budgetKPIs.warningThreshold && (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="font-semibold text-amber-800">⚠️ Ponad 80% budżetu wykorzystane!</p>
                    </div>
                  )}

                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Budżet planowany', value: formatCurrency(budgetKPIs.totalPlanned), color: 'text-blue-600', bg: 'bg-blue-50' },
                      { label: 'Faktyczne wydatki', value: formatCurrency(budgetKPIs.totalActual), color: budgetKPIs.overBudget ? 'text-red-600' : 'text-slate-900', bg: budgetKPIs.overBudget ? 'bg-red-50' : 'bg-slate-50' },
                      { label: 'Pozostało', value: formatCurrency(budgetKPIs.remaining), color: budgetKPIs.remaining < 0 ? 'text-red-600' : 'text-green-600', bg: 'bg-green-50' },
                      { label: 'Realizacja', value: `${(budgetKPIs.pctSpent * 100).toFixed(1)}%`, color: budgetKPIs.overBudget ? 'text-red-600' : 'text-purple-600', bg: 'bg-purple-50' },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className={`p-4 rounded-xl border border-slate-200 ${bg}`}>
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Burndown indicator */}
                  {burndownMonths !== null && stats.avgMonthlyExpense > 0 && (
                    <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                      burndownMonths < 2 ? 'bg-red-50 border-red-200' :
                      burndownMonths < 4 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                    }`}>
                      <Activity className={`w-5 h-5 mt-0.5 flex-shrink-0 ${burndownMonths < 2 ? 'text-red-600' : burndownMonths < 4 ? 'text-amber-600' : 'text-blue-600'}`} />
                      <div>
                        <p className={`font-semibold text-sm ${burndownMonths < 2 ? 'text-red-800' : burndownMonths < 4 ? 'text-amber-800' : 'text-blue-800'}`}>
                          🔥 Burn Rate: {formatCurrency(stats.avgMonthlyExpense)}/mies.
                          {burndownMonths > 0 && (
                            <span className="ml-2">→ budżet starczy na ~{burndownMonths.toFixed(1)} mies.</span>
                          )}
                          {burndownMonths <= 0 && <span className="ml-2">→ budżet wyczerpany!</span>}
                        </p>
                        <p className={`text-xs mt-0.5 ${burndownMonths < 2 ? 'text-red-700' : burndownMonths < 4 ? 'text-amber-700' : 'text-blue-700'}`}>
                          Średnie wydatki za ostatnie 3 miesiące. Pozostało: {formatCurrency(Math.max(0, budgetKPIs.remaining))}.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Category Progress Bars */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-600" /> Realizacja wg kategorii
                    </h3>
                    <div className="space-y-4">
                      {categoryAggregates.map(cat => {
                        const overBudget = cat.actual > cat.planned && cat.planned > 0;
                        const benchmark = INDUSTRY_BENCHMARKS[cat.code];
                        const budgetShare = budgetKPIs.totalPlanned > 0 ? (cat.planned / budgetKPIs.totalPlanned * 100) : 0;
                        return (
                          <div key={cat.code}>
                            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                                <span className="font-medium text-slate-800 text-sm">{cat.label}</span>
                                {benchmark && (
                                  <span className="text-xs text-slate-400 hidden sm:inline">
                                    (norma: {benchmark.min}–{benchmark.max}%, udział: {budgetShare.toFixed(0)}%)
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500">{formatCurrency(cat.actual)} / {formatCurrency(cat.planned)}</span>
                                <span className={`font-semibold ${overBudget ? 'text-red-600' : 'text-slate-700'}`}>
                                  {(cat.pct * 100).toFixed(0)}%
                                  {cat.deviation !== 0 && (
                                    <span className={`ml-1 text-xs ${overBudget ? 'text-red-500' : 'text-green-500'}`}>
                                      ({overBudget ? '+' : ''}{formatCurrency(cat.deviation)})
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(cat.pct * 100, 100)}%`,
                                  backgroundColor: cat.pct > 1 ? '#ef4444' : cat.pct > 0.8 ? '#f59e0b' : cat.color
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-blue-600" /> Plan vs Realizacja
                        </h3>
                        <button onClick={() => { setBudgetItemForm({ category: 'materialy', name: '', planned_amount: 0, actual_amount: 0, notes: '' }); setShowAddBudgetItemModal(true); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                          <Plus className="w-4 h-4" /> Dodaj
                        </button>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={budgetBarData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend />
                          <Bar dataKey="Plan" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Fakt" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-600" /> Struktura budżetu
                      </h3>
                      {budgetPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <RPieChart>
                            <Pie data={budgetPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                              {budgetPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          </RPieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">
                          Dodaj pozycje budżetowe
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Budget Items Table */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-600" /> Pozycje budżetowe
                    </h3>
                    {budgetItems.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <Target className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-sm">Brak pozycji. Kliknij "Dodaj" aby rozpocząć.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-slate-500 border-b border-slate-100">
                              <th className="text-left pb-2 pr-3">Nazwa</th>
                              <th className="text-left pb-2 pr-3">Kategoria</th>
                              <th className="text-right pb-2 pr-3">Plan</th>
                              <th className="text-right pb-2 pr-3">Fakt</th>
                              <th className="text-right pb-2 pr-3">Odchylenie</th>
                              <th className="pb-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {budgetItems.map(item => {
                              const deviation = (item.actual_amount || 0) - (item.planned_amount || 0);
                              const over = deviation > 0;
                              const catInfo = BUDGET_CATEGORIES.find(c => c.code === item.category);
                              return (
                                <tr key={item.id} className="hover:bg-slate-50 group">
                                  <td className="py-2 pr-3 font-medium text-slate-800">{item.name}</td>
                                  <td className="py-2 pr-3">
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                      style={{ backgroundColor: catInfo?.color + '22', color: catInfo?.color }}>
                                      {catInfo?.label || item.category}
                                    </span>
                                  </td>
                                  {editingBudgetItemId === item.id ? (
                                    <>
                                      <td className="py-1 pr-3">
                                        <input type="number" value={editingBudgetValue.planned}
                                          onChange={e => setEditingBudgetValue(v => ({ ...v, planned: parseFloat(e.target.value) || 0 }))}
                                          className="w-24 px-2 py-1 border border-blue-300 rounded text-right text-sm" min="0" step="0.01" />
                                      </td>
                                      <td className="py-1 pr-3">
                                        <input type="number" value={editingBudgetValue.actual}
                                          onChange={e => setEditingBudgetValue(v => ({ ...v, actual: parseFloat(e.target.value) || 0 }))}
                                          className="w-24 px-2 py-1 border border-blue-300 rounded text-right text-sm" min="0" step="0.01" />
                                      </td>
                                      <td className="py-1 pr-3 text-right text-sm text-slate-500">
                                        {formatCurrency(editingBudgetValue.actual - editingBudgetValue.planned)}
                                      </td>
                                      <td className="py-1">
                                        <div className="flex gap-1">
                                          <button onClick={() => handleUpdateBudgetItemAmounts(item.id!)}
                                            className="p-1 bg-green-100 hover:bg-green-200 rounded text-green-700">
                                            <Save className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setEditingBudgetItemId(null)}
                                            className="p-1 hover:bg-slate-200 rounded text-slate-400">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-2 pr-3 text-right text-slate-600 cursor-pointer hover:text-blue-600"
                                        onClick={() => { setEditingBudgetItemId(item.id!); setEditingBudgetValue({ planned: item.planned_amount || 0, actual: item.actual_amount || 0 }); }}>
                                        {formatCurrency(item.planned_amount || 0)}
                                      </td>
                                      <td className="py-2 pr-3 text-right font-medium cursor-pointer hover:text-blue-600"
                                        onClick={() => { setEditingBudgetItemId(item.id!); setEditingBudgetValue({ planned: item.planned_amount || 0, actual: item.actual_amount || 0 }); }}>
                                        {formatCurrency(item.actual_amount || 0)}
                                      </td>
                                      <td className={`py-2 pr-3 text-right font-semibold ${over ? 'text-red-600' : 'text-green-600'}`}>
                                        {over ? '+' : ''}{formatCurrency(deviation)}
                                        {item.planned_amount > 0 && (
                                          <span className="text-xs ml-1 opacity-60">({(deviation / item.planned_amount * 100).toFixed(0)}%)</span>
                                        )}
                                      </td>
                                      <td className="py-2">
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                                          <button onClick={() => { setEditingBudgetItemId(item.id!); setEditingBudgetValue({ planned: item.planned_amount || 0, actual: item.actual_amount || 0 }); }}
                                            className="p-1 hover:bg-blue-100 rounded text-blue-400">
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => handleDeleteBudgetItem(item.id!)}
                                            className="p-1 hover:bg-red-100 rounded text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="border-t-2 border-slate-200">
                            <tr className="font-bold text-slate-900">
                              <td className="pt-2 pr-3" colSpan={2}>Łącznie</td>
                              <td className="pt-2 pr-3 text-right">{formatCurrency(budgetKPIs.totalPlanned)}</td>
                              <td className="pt-2 pr-3 text-right">{formatCurrency(budgetKPIs.totalActual)}</td>
                              <td className={`pt-2 pr-3 text-right ${budgetKPIs.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {budgetKPIs.remaining < 0 ? '+' : ''}{formatCurrency(-budgetKPIs.remaining)}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Budget Snapshots History */}
                  {budgetSnapshots.length > 1 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        Historia budżetu (snapshots)
                      </h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={budgetSnapshots.map(s => ({
                          date: new Date(s.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }),
                          Plan: s.totalPlanned,
                          Fakt: s.totalActual,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend />
                          <Line type="monotone" dataKey="Plan" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Fakt" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <Info className="w-3 h-3" /> {budgetSnapshots.length} snapshot(ów) zapisanych. Kliknij "Snapshot" aby dodać kolejny.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : activeTab === 'cashflow' ? (
            /* ======= CASHFLOW TAB ======= */
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-lg">
                  <Activity className="w-5 h-5 text-blue-600" /> Cashflow — przepływy pieniężne
                </h3>
                <div className="flex gap-2">
                  {(['6m', '12m'] as const).map(p => (
                    <button key={p} onClick={() => setCashflowPeriod(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${cashflowPeriod === p ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {p === '6m' ? 'Ostatnie 6M' : 'Ostatnie 12M'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Cashflow Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="font-medium text-slate-900">Przychody vs Koszty miesięcznie</h4>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">* = prognoza</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={cashflowData.combined}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="Przychody" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.9} />
                    <Bar dataKey="Koszty" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.9} />
                    <Line type="monotone" dataKey="Saldo" stroke="#6366f1" strokeWidth={2.5}
                      dot={{ fill: '#6366f1', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Cumulative Balance */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="font-medium text-slate-900 mb-4">Skumulowane saldo</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={cashflowData.combined.reduce((acc, d, i, arr) => {
                    const prevCum = i > 0 ? acc[i - 1].Skumulowane : 0;
                    return [...acc, { ...d, Skumulowane: prevCum + d.Saldo }];
                  }, [] as any[])}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="Skumulowane" stroke="#6366f1" fill="#e0e7ff" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Quarterly Forecast */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" /> Prognoza następnego kwartału
                </h4>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {cashflowData.forecast.map((f, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-slate-500 mb-1 font-medium">{f.name}</p>
                      <p className="text-sm font-medium text-green-600">+{formatCurrency(f.Przychody)}</p>
                      <p className="text-sm font-medium text-red-600">-{formatCurrency(f.Koszty)}</p>
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className={`text-sm font-bold ${f.Saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {f.Saldo >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(f.Saldo))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Prognoza na podstawie średniej z ostatnich 3 miesięcy + oferty oczekujące
                </p>
              </div>

              {/* Offers Integration */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" /> Integracja z ofertami
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Zaakceptowane', items: cashflowData.offersBreakdown.accepted, icon: CheckCircle, color: 'green', desc: 'Potwierdzone przychody' },
                    { label: 'Oczekujące', items: cashflowData.offersBreakdown.pending, icon: Clock, color: 'amber', desc: 'Potencjalne przychody' },
                    { label: 'Robocze', items: cashflowData.offersBreakdown.draft, icon: FileText, color: 'slate', desc: 'W przygotowaniu' },
                  ].map(({ label, items, icon: Icon, color, desc }) => (
                    <div key={label} className={`bg-${color}-50 rounded-lg p-3 border border-${color}-100`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 text-${color}-600`} />
                        <span className={`text-sm font-semibold text-${color}-800`}>{label}</span>
                        <span className={`ml-auto bg-${color}-200 text-${color}-800 text-xs px-2 py-0.5 rounded-full`}>{items.length}</span>
                      </div>
                      <p className={`text-xl font-bold text-${color}-700`}>
                        {formatCurrency(items.reduce((s, o) => s + (o.final_amount || o.total_amount || 0), 0))}
                      </p>
                      <p className={`text-xs text-${color}-600 mt-1`}>{desc}</p>
                    </div>
                  ))}
                </div>
                {offers.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-52 overflow-y-auto">
                    {offers.slice(0, 12).map(offer => (
                      <div key={offer.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg text-sm">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          offer.status === 'accepted' ? 'bg-green-500' :
                          offer.status === 'sent' ? 'bg-blue-500' :
                          offer.status === 'negotiation' ? 'bg-amber-500' :
                          offer.status === 'rejected' ? 'bg-red-500' : 'bg-slate-400'
                        }`} />
                        <span className="flex-1 truncate font-medium text-slate-800">{offer.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                          offer.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          offer.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                          offer.status === 'negotiation' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {offer.status === 'accepted' ? 'Zaakceptowana' : offer.status === 'sent' ? 'Wysłana' :
                           offer.status === 'negotiation' ? 'Negocjacje' : offer.status === 'draft' ? 'Robocza' : offer.status}
                        </span>
                        <span className="font-semibold text-slate-900 flex-shrink-0">
                          {formatCurrency(offer.final_amount || offer.total_amount || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ======= AI ANALYSIS TAB ======= */
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-6 h-6 text-purple-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Analiza AI</h3>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Gemini Flash</span>
                </div>
                <select value={aiProject} onChange={e => setAiProject(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">-- Wszystkie projekty --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Financial Health Score */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-lg">📊 Financial Health Score</h4>
                    <p className="text-slate-300 text-sm">Na podstawie danych z Twojego konta</p>
                  </div>
                  <div className="text-right">
                    {(() => {
                      let score = 10;
                      if (stats.balance < 0) score -= 3;
                      if (budgetKPIs.overTenPct) score -= 2;
                      if (budgetKPIs.overBudget && !budgetKPIs.overTenPct) score -= 1;
                      if (stats.pendingActs > 100000) score -= 1;
                      if (burndownMonths !== null && burndownMonths < 2) score -= 2;
                      if (offers.filter(o => o.status === 'accepted').length > 0) score += 0;
                      score = Math.max(1, Math.min(10, score));
                      const color = score >= 8 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444';
                      const emoji = score >= 8 ? '🟢' : score >= 5 ? '🟡' : '🔴';
                      return (
                        <div className="text-center">
                          <p className="text-4xl font-bold" style={{ color }}>{score}/10</p>
                          <p className="text-sm" style={{ color }}>{emoji} {score >= 8 ? 'Doskonały' : score >= 6 ? 'Dobry' : score >= 4 ? 'Wymaga uwagi' : 'Krytyczny'}</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.income).split(',')[0]}</p>
                    <p className="text-xs text-slate-300 mt-1">Przychody łącznie</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">{formatCurrency(stats.expense).split(',')[0]}</p>
                    <p className="text-xs text-slate-300 mt-1">Koszty łącznie</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(stats.balance).split(',')[0]}
                    </p>
                    <p className="text-xs text-slate-300 mt-1">Bilans netto</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Analiza AI */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Analiza AI</h4>
                      <p className="text-sm text-slate-500">Anomalie, ryzyka, ocena kondycji finansowej projektu</p>
                    </div>
                  </div>
                  <button onClick={handleAnalyzeAI} disabled={aiLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium">
                    {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                    {aiLoading ? 'Analizuję...' : '🔍 Uruchom Analizę AI'}
                  </button>
                  {aiAnalysis && (
                    <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold text-purple-800">Wyniki analizy</span>
                        <button onClick={() => setAiAnalysis('')} className="ml-auto p-0.5 hover:bg-purple-100 rounded">
                          <X className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                      </div>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
                    </div>
                  )}
                </div>

                {/* Gdzie można zaoszczędzić */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Gdzie można zaoszczędzić?</h4>
                      <p className="text-sm text-slate-500">Konkretne propozycje optymalizacji z szacowanymi kwotami</p>
                    </div>
                  </div>
                  <button onClick={handleAISavings} disabled={aiSavingsLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                    {aiSavingsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lightbulb className="w-5 h-5" />}
                    {aiSavingsLoading ? 'Szukam oszczędności...' : '💰 Znajdź oszczędności'}
                  </button>
                  {aiSavings && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-800">Propozycje oszczędności</span>
                        <button onClick={() => setAiSavings('')} className="ml-auto p-0.5 hover:bg-green-100 rounded">
                          <X className="w-3.5 h-3.5 text-green-400" />
                        </button>
                      </div>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiSavings}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Expenses Summary */}
              {topExpenses.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    Top 5 największych wydatków
                  </h4>
                  <div className="space-y-2">
                    {topExpenses.map((op, i) => (
                      <div key={op.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                        <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{op.description || 'Wydatek'}</p>
                          <p className="text-xs text-slate-500">{formatDate(op.operation_date)} • {(op as any).project?.name || 'Bez projektu'}</p>
                        </div>
                        <p className="text-sm font-bold text-red-600 flex-shrink-0">-{formatCurrency(op.amount)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-2.5 bg-slate-100 rounded-lg flex items-center justify-between">
                    <span className="text-xs text-slate-500">Łącznie top 5:</span>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(topExpenses.reduce((s, o) => s + o.amount, 0))}</span>
                  </div>
                </div>
              )}

              {/* Smart Alerts System */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" /> Smart Alerts
                  </h4>
                  <button onClick={() => setShowSmartAlerts(v => !v)}
                    className="text-xs text-slate-400 hover:text-slate-600">
                    {showSmartAlerts ? 'Ukryj' : 'Pokaż'}
                  </button>
                </div>
                {showSmartAlerts && (
                  <div className="space-y-2">
                    {/* Cashflow alerts */}
                    {stats.balance < 0 && (
                      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">🚨 Ujemny bilans finansowy</p>
                          <p className="text-xs text-red-700">Koszty przewyższają przychody o {formatCurrency(Math.abs(stats.balance))}. Sprawdź cashflow.</p>
                        </div>
                      </div>
                    )}
                    {stats.pendingActs > 50000 && (
                      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">⚠️ Wysokie należności</p>
                          <p className="text-xs text-amber-700">Masz {formatCurrency(stats.pendingActs)} nieopłaconych należności. Sprawdź akty i faktury.</p>
                        </div>
                      </div>
                    )}
                    {budgetKPIs.overTenPct && (
                      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">🚨 Budżet przekroczony</p>
                          <p className="text-xs text-red-700">Faktyczne wydatki o {((budgetKPIs.pctSpent - 1) * 100).toFixed(1)}% powyżej planu.</p>
                        </div>
                      </div>
                    )}
                    {offers.filter(o => o.status === 'sent').length > 0 && (
                      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-blue-800">📋 Oferty oczekują na odpowiedź</p>
                          <p className="text-xs text-blue-700">
                            {offers.filter(o => o.status === 'sent').length} ofert(a) wysłanych za łącznie {formatCurrency(offers.filter(o => o.status === 'sent').reduce((s, o) => s + (o.final_amount || o.total_amount || 0), 0))}.
                          </p>
                        </div>
                      </div>
                    )}
                    {categoryAggregates.filter(c => c.pct > 1.1 && c.planned > 0).map(c => (
                      <div key={c.code} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-orange-800">⚠️ {c.label} — przekroczenie kategorii</p>
                          <p className="text-xs text-orange-700">
                            Wydano {formatCurrency(c.actual)} z planowanych {formatCurrency(c.planned)} ({(c.pct * 100).toFixed(0)}%).
                          </p>
                        </div>
                      </div>
                    ))}
                    {stats.balance >= 0 && !budgetKPIs.overBudget && stats.pendingActs < 50000 && (
                      <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-semibold text-green-800">✅ Wszystko w normie! Kondycja finansowa jest dobra.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Industry Benchmarks */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" /> Normy branżowe — budownictwo
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  {Object.entries(INDUSTRY_BENCHMARKS).map(([code, bench]) => {
                    const catData = categoryAggregates.find(c => c.code === code);
                    const share = budgetKPIs.totalPlanned > 0 && catData ? (catData.planned / budgetKPIs.totalPlanned * 100) : 0;
                    const inRange = share >= bench.min && share <= bench.max;
                    const cat = BUDGET_CATEGORIES.find(c => c.code === code);
                    return (
                      <div key={code} className={`p-3 rounded-lg border ${
                        inRange ? 'border-green-200 bg-green-50' :
                        budgetKPIs.totalPlanned > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm" style={{ color: cat?.color }}>{bench.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            inRange ? 'bg-green-200 text-green-800' :
                            budgetKPIs.totalPlanned > 0 ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {inRange ? '✓ W normie' : budgetKPIs.totalPlanned > 0 ? '⚠ Poza normą' : 'Brak danych'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <span>Norma: <strong>{bench.min}–{bench.max}%</strong></span>
                          {budgetKPIs.totalPlanned > 0 && (
                            <span className={`font-semibold ${inRange ? 'text-green-700' : 'text-amber-700'}`}>
                              Twój: {share.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Normy dla projektów budowlanych w Polsce (GUS/PIB 2024)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ MODALS ============ */}

      {/* Operation Modal */}
      {showOperationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editingOperation ? 'Edytuj operację' : 'Nowa operacja'}</h2>
              <button onClick={() => { setShowOperationModal(false); setUploadedReceiptUrl(''); }} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Kwota (PLN) *</label>
                <input type="number" value={operationForm.amount || ''} step="0.01" min="0"
                  onChange={e => setOperationForm({ ...operationForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <input type="text" value={operationForm.description}
                  onChange={e => setOperationForm({ ...operationForm, description: e.target.value })}
                  placeholder="np. Faktura za materiały budowlane"
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
                    placeholder="FV/2026/001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              {operationForm.operation_type === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kategoria budżetowa</label>
                  <select value={operationForm.budget_category}
                    onChange={e => setOperationForm({ ...operationForm, budget_category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">-- Bez kategorii --</option>
                    {BUDGET_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
              )}
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

              {/* Receipt Upload */}
              <div className="border border-dashed border-slate-300 rounded-lg p-3">
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-500" /> Paragon / Faktura (zdjęcie)
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (editingOperation) {
                        await handleReceiptUpload(file, editingOperation.id);
                      } else {
                        const reader = new FileReader();
                        reader.onload = ev => setUploadedReceiptUrl(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingReceipt}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm">
                    {uploadingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingReceipt ? 'Wgrywam...' : 'Wgraj plik'}
                  </button>
                  {uploadedReceiptUrl && (
                    <div className="flex items-center gap-2">
                      <a href={uploadedReceiptUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 text-sm hover:underline flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> Podgląd
                      </a>
                      <button onClick={() => setUploadedReceiptUrl('')} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {editingOperation && (receipts[editingOperation.id] || []).length > 0 && (
                    <span className="text-xs text-blue-600">
                      {(receipts[editingOperation.id] || []).length} plik(ów) załączono
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { setShowOperationModal(false); setUploadedReceiptUrl(''); }}
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
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editingAct ? 'Edytuj akt' : 'Nowy akt wykonawczy'}</h2>
              <button onClick={() => setShowActModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
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
                <select value={budgetItemForm.category} onChange={e => setBudgetItemForm({ ...budgetItemForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  {BUDGET_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa pozycji *</label>
                <input type="text" value={budgetItemForm.name} onChange={e => setBudgetItemForm({ ...budgetItemForm, name: e.target.value })}
                  placeholder="np. Cement, piasek, robocizna elektryczna..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kwota planowana (PLN)</label>
                  <input type="number" value={budgetItemForm.planned_amount || ''}
                    onChange={e => setBudgetItemForm({ ...budgetItemForm, planned_amount: parseFloat(e.target.value) || 0 })}
                    min="0" step="0.01" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kwota faktyczna (PLN)</label>
                  <input type="number" value={budgetItemForm.actual_amount || ''}
                    onChange={e => setBudgetItemForm({ ...budgetItemForm, actual_amount: parseFloat(e.target.value) || 0 })}
                    min="0" step="0.01" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notatki</label>
                <input type="text" value={budgetItemForm.notes} onChange={e => setBudgetItemForm({ ...budgetItemForm, notes: e.target.value })}
                  placeholder="Opcjonalne uwagi..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
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
                <input type="text" value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
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
                    <input type="text" value={accountForm.bank_name} onChange={e => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                      placeholder="np. PKO BP" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numer konta</label>
                    <input type="text" value={accountForm.account_number} onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })}
                      placeholder="PL 00 0000 0000..." className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Saldo początkowe (PLN)</label>
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
