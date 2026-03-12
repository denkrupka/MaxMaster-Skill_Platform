import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Search, Building2, User, Phone, Mail, Globe, Pencil, Trash2,
  ChevronRight, ChevronLeft, Tag, FileText, Truck, HardHat, X, Check,
  Loader2, AlertCircle, CheckCircle2, ShieldAlert, ShieldCheck, ShieldOff,
  CreditCard, History, BarChart3, RefreshCw, ExternalLink, Info, TrendingUp,
  TrendingDown, Minus, DollarSign, Calendar, Briefcase, Package
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Contractor, ContractorGroup, ContractorType, ContractorEntityType } from '../../types';
import {
  CONTRACTOR_TYPE_LABELS, CONTRACTOR_TYPE_COLORS, CONTRACTOR_TYPE_ICONS,
  CONTRACTOR_ENTITY_TYPE_LABELS
} from '../../constants';

// ---- Types ----
type RiskLevel = 'low' | 'medium' | 'high';

interface ContractorExtended extends Contractor {
  credit_limit?: number;
  risk_level?: RiskLevel;
  gus_verified?: boolean;
  gus_status?: string;
}

interface GUSData {
  name: string;
  address: string;
  status: string;
  nip: string;
  regon?: string;
}

// ---- Helpers ----
const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  low:    { label: 'Niskie',   color: 'text-emerald-700', bg: 'bg-emerald-100',  icon: <ShieldCheck size={14}/> },
  medium: { label: 'Średnie',  color: 'text-amber-700',   bg: 'bg-amber-100',    icon: <ShieldAlert size={14}/> },
  high:   { label: 'Wysokie',  color: 'text-red-700',     bg: 'bg-red-100',      icon: <ShieldOff size={14}/> },
};

const ContractorTypeIcon: React.FC<{ type: ContractorType; className?: string }> = ({ type, className = 'w-5 h-5' }) => {
  const icons: Record<string, React.ElementType> = { customer: Building2, contractor: HardHat, supplier: Truck };
  const Icon = icons[type] || Building2;
  return <Icon className={className} />;
};

// ---- Main Component ----
export const KontrahenciPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [contractors, setContractors] = useState<ContractorExtended[]>([]);
  const [groups, setGroups] = useState<ContractorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContractorType | 'all'>('all');

  // Detail panel
  const [selected, setSelected] = useState<ContractorExtended | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'gus' | 'credit' | 'history'>('info');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ContractorExtended | null>(null);
  const [saving, setSaving] = useState(false);

  // GUS
  const [gusLoading, setGusLoading] = useState(false);
  const [gusData, setGusData] = useState<GUSData | null>(null);
  const [gusError, setGusError] = useState<string | null>(null);

  // History
  const [historyOffers, setHistoryOffers] = useState<any[]>([]);
  const [historyProjects, setHistoryProjects] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Credit form
  const [creditForm, setCreditForm] = useState({ credit_limit: 0, risk_level: 'medium' as RiskLevel });

  // Form
  const emptyForm = {
    name: '', short_name: '', contractor_entity_type: 'legal_entity' as ContractorEntityType,
    contractor_type: 'contractor' as ContractorType, group_id: '',
    contact_person: '', position: '', phone: '', email: '', website: '',
    nip: '', regon: '', legal_address: '', actual_address: '',
    bank_name: '', bank_account: '', notes: '',
    credit_limit: 0, risk_level: 'medium' as RiskLevel,
  };
  const [form, setForm] = useState(emptyForm);

  // ---- Load ----
  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [cRes, gRes] = await Promise.all([
        supabase.from('contractors').select('*, group:contractor_groups(*)').eq('company_id', currentUser.company_id).is('deleted_at', null).order('name'),
        supabase.from('contractor_groups').select('*').eq('company_id', currentUser.company_id).order('name'),
      ]);
      if (cRes.data) setContractors(cRes.data as ContractorExtended[]);
      if (gRes.data) setGroups(gRes.data);
    } finally {
      setLoading(false);
    }
  };

  // ---- Filter ----
  const filtered = useMemo(() => contractors.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.nip?.includes(q);
    const matchType = typeFilter === 'all' || c.contractor_type === typeFilter;
    return matchSearch && matchType;
  }), [contractors, search, typeFilter]);

  // ---- GUS NIP check ----
  const checkGUS = useCallback(async (nip: string) => {
    if (!nip || nip.length < 10) { setGusError('Podaj prawidłowy NIP (10 cyfr)'); return; }
    const clean = nip.replace(/[-\s]/g, '');
    setGusLoading(true);
    setGusError(null);
    setGusData(null);
    try {
      // Primary: api.recherche.gov.pl
      const res = await fetch(`https://api.recherche.gov.pl/api/1.0/firm/${clean}`, {
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const d = await res.json();
        const entry = Array.isArray(d) ? d[0] : d;
        if (entry) {
          setGusData({
            name: entry.name || entry.companyName || entry.firma || '-',
            address: entry.address || entry.adres || (entry.street ? `${entry.street}, ${entry.city}` : '-'),
            status: entry.status || entry.statusFirmy || 'Aktywna',
            nip: clean,
            regon: entry.regon || entry.REGON || '',
          });
          return;
        }
      }
      // Fallback: regon.stat.gov.pl (public)
      const fallback = await fetch(`https://wyszukiwarkaregon.stat.gov.pl/api/Data/SearchData?Nip=${clean}&format=json`).catch(() => null);
      if (fallback && fallback.ok) {
        const fd = await fallback.json();
        const item = fd?.dane?.[0] || fd?.[0];
        if (item) {
          setGusData({
            name: item.Nazwa || '-',
            address: `${item.Ulica || ''} ${item.NrNieruchomosci || ''}, ${item.Miejscowosc || ''}`.trim(),
            status: 'Aktywna',
            nip: clean,
            regon: item.Regon || '',
          });
          return;
        }
      }
      setGusError('Nie znaleziono firmy dla podanego NIP');
    } catch (e: any) {
      setGusError('Błąd połączenia z GUS: ' + (e.message || 'nieznany błąd'));
    } finally {
      setGusLoading(false);
    }
  }, []);

  // ---- Load history ----
  const loadHistory = useCallback(async (contractorId: string) => {
    setHistoryLoading(true);
    try {
      const [offersRes, projectsRes] = await Promise.all([
        supabase.from('offers').select('id, name, status, final_amount, created_at').eq('client_id', contractorId).is('deleted_at', null).order('created_at', { ascending: false }).limit(10),
        supabase.from('projects').select('id, name, status, created_at').or(`client_id.eq.${contractorId},contractor_id.eq.${contractorId}`).is('deleted_at', null).order('created_at', { ascending: false }).limit(10),
      ]);
      if (offersRes.data) setHistoryOffers(offersRes.data);
      if (projectsRes.data) setHistoryProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
    } catch {
      // silently fail — tables may not have client_id
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) {
      // Reset GUS when contractor changes
      setGusData(null);
      setGusError(null);
      setCreditForm({ credit_limit: selected.credit_limit || 0, risk_level: selected.risk_level || 'medium' });
      loadHistory(selected.id);
    }
  }, [selected?.id]);

  // ---- Save credit ----
  const saveCreditInfo = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await supabase.from('contractors').update({ credit_limit: creditForm.credit_limit, risk_level: creditForm.risk_level } as any).eq('id', selected.id);
      setContractors(prev => prev.map(c => c.id === selected.id ? { ...c, ...creditForm } : c));
      setSelected(prev => prev ? { ...prev, ...creditForm } : null);
    } finally {
      setSaving(false);
    }
  };

  // ---- Modal Save ----
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await supabase.from('contractors').update(form as any).eq('id', editing.id).select('*, group:contractor_groups(*)').single();
        if (data) setContractors(prev => prev.map(c => c.id === editing.id ? data as ContractorExtended : c));
      } else {
        const { data } = await supabase.from('contractors').insert({ ...form, company_id: currentUser.company_id, created_by_id: currentUser.id } as any).select('*, group:contractor_groups(*)').single();
        if (data) setContractors(prev => [...prev, data as ContractorExtended]);
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (err: any) {
      alert('Błąd: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć kontrahenta?')) return;
    await supabase.from('contractors').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    setContractors(prev => prev.filter(c => c.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const openEdit = (c: ContractorExtended) => {
    setEditing(c);
    setForm({ ...emptyForm, ...c } as any);
    setShowModal(true);
  };

  // ---- Render ----
  if (selected) {
    const risk = RISK_CONFIG[selected.risk_level || 'medium'];
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-4 group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform"/> Wróć do listy
        </button>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <ContractorTypeIcon type={selected.contractor_type} className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">{selected.name}</h1>
                {selected.short_name && <p className="text-sm text-slate-400 font-medium">{selected.short_name}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${CONTRACTOR_TYPE_COLORS[selected.contractor_type] || 'bg-slate-100 text-slate-600'}`}>
                    {CONTRACTOR_TYPE_LABELS[selected.contractor_type]}
                  </span>
                  {selected.group && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                      <Tag size={10}/>{selected.group.name}
                    </span>
                  )}
                  {selected.risk_level && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${risk.bg} ${risk.color}`}>
                      {risk.icon} {risk.label} ryzyko
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(selected)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                <Pencil size={18}/>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex border-b border-slate-200 px-4">
            {([
              { id: 'info', label: 'Informacje', icon: <Info size={14}/> },
              { id: 'gus', label: 'Weryfikacja GUS', icon: <CheckCircle2 size={14}/> },
              { id: 'credit', label: 'Limit kredytowy', icon: <CreditCard size={14}/> },
              { id: 'history', label: 'Historia', icon: <History size={14}/> },
            ] as Array<{ id: typeof detailTab; label: string; icon: React.ReactNode }>).map(t => (
              <button key={t.id} onClick={() => setDetailTab(t.id)} className={`py-3.5 px-4 font-bold text-sm border-b-4 transition-all whitespace-nowrap flex items-center gap-1.5 ${detailTab === t.id ? 'border-blue-600 text-blue-600 bg-blue-50/20' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* --- INFO TAB --- */}
            {detailTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Dane kontaktowe</p>
                    <div className="space-y-3">
                      {selected.contact_person && <div className="flex items-center gap-2 text-sm"><User size={14} className="text-slate-400"/><span className="font-medium text-slate-700">{selected.contact_person}</span>{selected.position && <span className="text-slate-400">— {selected.position}</span>}</div>}
                      {selected.phone && <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-slate-400"/><a href={`tel:${selected.phone}`} className="text-blue-600 hover:underline font-medium">{selected.phone}</a></div>}
                      {selected.email && <div className="flex items-center gap-2 text-sm"><Mail size={14} className="text-slate-400"/><a href={`mailto:${selected.email}`} className="text-blue-600 hover:underline font-medium">{selected.email}</a></div>}
                      {selected.website && <div className="flex items-center gap-2 text-sm"><Globe size={14} className="text-slate-400"/><a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium flex items-center gap-1">{selected.website}<ExternalLink size={11}/></a></div>}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Dane formalne</p>
                    <div className="space-y-2 text-sm">
                      {selected.nip && <div className="flex justify-between"><span className="text-slate-500">NIP</span><span className="font-bold font-mono">{selected.nip}</span></div>}
                      {selected.regon && <div className="flex justify-between"><span className="text-slate-500">REGON</span><span className="font-bold font-mono">{selected.regon}</span></div>}
                      <div className="flex justify-between"><span className="text-slate-500">Forma prawna</span><span className="font-bold">{CONTRACTOR_ENTITY_TYPE_LABELS[selected.contractor_entity_type] || selected.contractor_entity_type}</span></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Adres</p>
                    <div className="space-y-2 text-sm">
                      {selected.legal_address && <div><span className="text-slate-400 text-[10px] uppercase font-bold">Prawny: </span><span className="text-slate-700">{selected.legal_address}</span></div>}
                      {selected.actual_address && <div><span className="text-slate-400 text-[10px] uppercase font-bold">Faktyczny: </span><span className="text-slate-700">{selected.actual_address}</span></div>}
                    </div>
                  </div>

                  {(selected.bank_name || selected.bank_account) && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Dane bankowe</p>
                      <div className="space-y-2 text-sm">
                        {selected.bank_name && <div className="flex justify-between"><span className="text-slate-500">Bank</span><span className="font-bold">{selected.bank_name}</span></div>}
                        {selected.bank_account && <div className="flex justify-between"><span className="text-slate-500">Konto</span><span className="font-bold font-mono text-xs">{selected.bank_account}</span></div>}
                      </div>
                    </div>
                  )}

                  {selected.notes && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notatki</p>
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 leading-relaxed">{selected.notes}</p>
                    </div>
                  )}

                  {/* Credit summary box */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Limit kredytowy</p>
                        <p className="text-2xl font-black mt-0.5">{(selected.credit_limit || 0).toLocaleString('pl-PL')} <span className="text-sm font-medium">PLN</span></p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1 ${risk.bg} ${risk.color}`}>
                        {risk.icon} {risk.label}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- GUS TAB --- */}
            {detailTab === 'gus' && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-2">Weryfikacja danych firmy przez GUS (NIP)</p>
                  <div className="flex gap-3">
                    <input
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="NIP (10 cyfr)"
                      defaultValue={selected.nip || ''}
                      id="gus-nip-input"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('gus-nip-input') as HTMLInputElement;
                        checkGUS(input?.value || selected.nip || '');
                      }}
                      disabled={gusLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all"
                    >
                      {gusLoading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                      Weryfikuj
                    </button>
                  </div>
                </div>

                {gusError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
                    <AlertCircle size={18}/><span className="text-sm font-medium">{gusError}</span>
                  </div>
                )}

                {gusData && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-700 font-black uppercase text-xs tracking-widest">
                      <CheckCircle2 size={16}/> Dane z GUS — zweryfikowane
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Nazwa firmy</span>
                        <p className="font-bold text-slate-900 mt-0.5">{gusData.name}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">NIP</span>
                        <p className="font-bold text-slate-900 font-mono mt-0.5">{gusData.nip}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Adres</span>
                        <p className="font-bold text-slate-900 mt-0.5">{gusData.address}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Status</span>
                        <p className={`font-bold mt-0.5 ${gusData.status.toLowerCase().includes('aktywna') || gusData.status.toLowerCase().includes('active') ? 'text-emerald-700' : 'text-red-700'}`}>{gusData.status}</p>
                      </div>
                      {gusData.regon && <div><span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">REGON</span><p className="font-bold font-mono mt-0.5">{gusData.regon}</p></div>}
                    </div>

                    {/* Comparison with stored data */}
                    {selected.name && gusData.name && selected.name !== gusData.name && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                        <span className="font-black text-amber-700">⚠️ Uwaga: </span>
                        <span className="text-amber-800">Nazwa w systemie (<strong>{selected.name}</strong>) różni się od GUS (<strong>{gusData.name}</strong>)</span>
                      </div>
                    )}
                  </div>
                )}

                {!gusData && !gusError && !gusLoading && (
                  <div className="text-center py-12 text-slate-400">
                    <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30"/>
                    <p className="font-medium text-sm">Kliknij "Weryfikuj" aby sprawdzić dane firmy w GUS</p>
                    <p className="text-xs mt-1">Wymagany NIP (10 cyfr)</p>
                  </div>
                )}
              </div>
            )}

            {/* --- CREDIT TAB --- */}
            {detailTab === 'credit' && (
              <div className="space-y-6 max-w-lg">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Limit kredytowy (PLN)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      className="w-full pl-9 pr-4 py-3 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={creditForm.credit_limit}
                      onChange={e => setCreditForm(f => ({ ...f, credit_limit: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Poziom ryzyka</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.entries(RISK_CONFIG) as [RiskLevel, typeof RISK_CONFIG[RiskLevel]][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setCreditForm(f => ({ ...f, risk_level: key }))}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all font-bold text-sm ${creditForm.risk_level === key ? `${cfg.bg} ${cfg.color} border-current` : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        <span className="text-xl">{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`rounded-xl p-4 ${RISK_CONFIG[creditForm.risk_level].bg} border border-current`}>
                  <div className={`text-xs font-black uppercase tracking-wide ${RISK_CONFIG[creditForm.risk_level].color} mb-1`}>
                    Podsumowanie
                  </div>
                  <p className="text-sm text-slate-700">
                    Limit: <strong>{creditForm.credit_limit.toLocaleString('pl-PL')} PLN</strong> · Ryzyko: <strong>{RISK_CONFIG[creditForm.risk_level].label}</strong>
                  </p>
                </div>

                <button
                  onClick={saveCreditInfo}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
                >
                  {saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
                  Zapisz
                </button>
              </div>
            )}

            {/* --- HISTORY TAB --- */}
            {detailTab === 'history' && (
              <div className="space-y-6">
                {historyLoading ? (
                  <div className="text-center py-12"><Loader2 size={32} className="animate-spin mx-auto text-slate-300"/></div>
                ) : (
                  <>
                    {/* Offers */}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FileText size={12}/> Oferty ({historyOffers.length})</p>
                      {historyOffers.length > 0 ? (
                        <div className="space-y-2">
                          {historyOffers.map(o => (
                            <div key={o.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border hover:bg-white transition-all">
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{o.name}</p>
                                <p className="text-[10px] text-slate-400">{new Date(o.created_at).toLocaleDateString('pl-PL')}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-slate-900 text-sm">{(o.final_amount || 0).toLocaleString('pl-PL')} PLN</p>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${o.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : o.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {o.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-slate-400 italic py-4 text-center">Brak ofert dla tego kontrahenta</p>}
                    </div>

                    {/* Projects */}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Briefcase size={12}/> Projekty ({historyProjects.length})</p>
                      {historyProjects.length > 0 ? (
                        <div className="space-y-2">
                          {historyProjects.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border hover:bg-white transition-all">
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                                <p className="text-[10px] text-slate-400">{new Date(p.created_at).toLocaleDateString('pl-PL')}</p>
                              </div>
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{p.status}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-slate-400 italic py-4 text-center">Brak projektów dla tego kontrahenta</p>}
                    </div>

                    {historyOffers.length === 0 && historyProjects.length === 0 && (
                      <div className="text-center py-10 text-slate-400">
                        <History size={40} className="mx-auto mb-3 opacity-30"/>
                        <p className="font-medium text-sm">Brak historii dla tego kontrahenta</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kontrahenci</h1>
          <p className="text-sm text-slate-500 mt-0.5">Zarządzanie bazą kontrahentów, weryfikacja NIP, limity kredytowe.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md shadow-blue-600/20 transition-all"
        >
          <Plus size={18}/> Dodaj kontrahenta
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Szukaj po nazwie, emailu, NIP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as any)}
        >
          <option value="all">Wszystkie typy</option>
          {(Object.entries(CONTRACTOR_TYPE_LABELS) as [ContractorType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-slate-300"/></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">Kontrahent</th>
                  <th className="px-4 py-3 text-left">Typ</th>
                  <th className="px-4 py-3 text-left">NIP</th>
                  <th className="px-4 py-3 text-left">Kontakt</th>
                  <th className="px-4 py-3 text-left">Limit kredytowy</th>
                  <th className="px-4 py-3 text-left">Ryzyko</th>
                  <th className="px-4 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => {
                  const risk = RISK_CONFIG[c.risk_level || 'medium'];
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 cursor-pointer transition-colors group" onClick={() => setSelected(c)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <ContractorTypeIcon type={c.contractor_type} className="w-4 h-4"/>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{c.name}</p>
                            {c.short_name && <p className="text-[10px] text-slate-400">{c.short_name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${CONTRACTOR_TYPE_COLORS[c.contractor_type] || 'bg-slate-100 text-slate-600'}`}>
                          {CONTRACTOR_TYPE_LABELS[c.contractor_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 text-xs">{c.nip || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        <div>{c.contact_person || '—'}</div>
                        <div className="text-slate-400">{c.phone || c.email || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {c.credit_limit ? `${c.credit_limit.toLocaleString('pl-PL')} PLN` : <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${risk.bg} ${risk.color}`}>
                          {risk.icon} {risk.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" onClick={e => { e.stopPropagation(); openEdit(c); }}>
                            <Pencil size={14}/>
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" onClick={e => { e.stopPropagation(); handleDelete(c.id); }}>
                            <Trash2 size={14}/>
                          </button>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 ml-1 transition-all group-hover:translate-x-0.5"/>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={7} className="py-16 text-center text-slate-400 italic">Brak kontrahentów spełniających kryteria</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black uppercase">{editing ? 'Edytuj kontrahenta' : 'Nowy kontrahent'}</h2>
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="text-slate-400 hover:text-slate-600 p-1"><X size={22}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nazwa firmy *</label>
                  <input required className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Skrót</label>
                  <input className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Typ</label>
                  <select className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.contractor_type} onChange={e => setForm(f => ({ ...f, contractor_type: e.target.value as ContractorType }))}>
                    {(Object.entries(CONTRACTOR_TYPE_LABELS) as [ContractorType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">NIP</label>
                  <input className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">REGON</label>
                  <input className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.regon} onChange={e => setForm(f => ({ ...f, regon: e.target.value }))}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Osoba kontaktowa</label>
                  <input className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Stanowisko</label>
                  <input className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Telefon</label>
                  <input className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Email</label>
                  <input type="email" className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Adres</label>
                  <input className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.legal_address} onChange={e => setForm(f => ({ ...f, legal_address: e.target.value }))} placeholder="ul. Przykładowa 1, 00-001 Warszawa"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Limit kredytowy (PLN)</label>
                  <input type="number" min="0" className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: Number(e.target.value) }))}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Poziom ryzyka</label>
                  <select className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.risk_level} onChange={e => setForm(f => ({ ...f, risk_level: e.target.value as RiskLevel }))}>
                    <option value="low">Niskie</option>
                    <option value="medium">Średnie</option>
                    <option value="high">Wysokie</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Notatki</label>
                  <textarea rows={3} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-sm font-black text-slate-400 uppercase">Anuluj</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-md transition-all">
                  {saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
                  {editing ? 'Zapisz zmiany' : 'Utwórz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
