import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  FileText, Building2, Loader2, Shield, Package, Hammer, Wrench,
  Briefcase, CheckCircle, Send, AlertCircle, Calendar, Clock,
  ChevronDown, ChevronRight, Search, X, Printer, Download
} from 'lucide-react';

interface RequestItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  section_name: string;
}

const formatDate = (date: string | null | undefined) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
};

const fmtCur = (v: number) => v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const OfferRequestLandingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    loadRequest();
  }, [token]);

  const loadRequest = async () => {
    try {
      const { data, error: err } = await supabase
        .from('offer_requests')
        .select('*')
        .eq('share_token', token)
        .single();

      if (err || !data) {
        setError('Nie znaleziono zapytania ofertowego lub link jest nieprawidłowy.');
        return;
      }

      setRequest(data);

      // Mark as viewed
      if (data.status === 'sent') {
        await supabase
          .from('offer_requests')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', data.id);
        setRequest((prev: any) => prev ? { ...prev, status: 'viewed' } : null);
      }

      if (data.response_data?.prices) {
        setPrices(data.response_data.prices);
      }
      if (data.response_data?.notes) {
        setNotes(data.response_data.notes);
      }
      if (data.status === 'responded' || data.status === 'accepted' || data.status === 'rejected') {
        setSubmitted(true);
      }
    } catch (e) {
      setError('Wystąpił błąd podczas ładowania zapytania.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!request) return;
    setSubmitting(true);
    try {
      const { error: err } = await supabase
        .from('offer_requests')
        .update({
          status: 'responded',
          responded_at: new Date().toISOString(),
          response_data: { prices, notes }
        })
        .eq('id', request.id);

      if (err) throw err;
      setSubmitted(true);
      setRequest((prev: any) => prev ? { ...prev, status: 'responded' } : null);
    } catch (e) {
      alert('Błąd podczas wysyłania odpowiedzi. Spróbuj ponownie.');
    } finally {
      setSubmitting(false);
    }
  };

  const items: RequestItem[] = request?.print_settings?.items || [];
  const companyData = request?.print_settings?.company_data || {};
  const subcontractorData = request?.print_settings?.subcontractor_data || null;
  const supplierData = request?.print_settings?.supplier_data || null;
  const offerName = request?.print_settings?.offer_name || '';
  const offerNumber = request?.print_settings?.offer_number || '';

  const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    robota: { label: 'Robota', icon: Hammer, color: 'text-blue-700', bg: 'bg-blue-100' },
    materialy: { label: 'Materiały', icon: Package, color: 'text-amber-700', bg: 'bg-amber-100' },
    sprzet: { label: 'Sprzęt', icon: Wrench, color: 'text-green-700', bg: 'bg-green-100' },
    all: { label: 'Cały zakres', icon: Briefcase, color: 'text-indigo-700', bg: 'bg-indigo-100' },
  };
  const typeInfo = typeLabels[request?.request_type] || typeLabels.all;
  const TypeIcon = typeInfo.icon;

  // Group items by section
  const sections = (() => {
    const map = new Map<string, RequestItem[]>();
    items.forEach(item => {
      const sec = item.section_name || 'Pozycje';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(item);
    });
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  })();

  const statusBadge = (() => {
    const s = request?.status;
    if (s === 'responded' || s === 'accepted') return { label: 'Odpowiedź wysłana', color: 'bg-green-100 text-green-700', Icon: CheckCircle };
    if (s === 'rejected') return { label: 'Odrzucone', color: 'bg-red-100 text-red-700', Icon: AlertCircle };
    if (s === 'viewed') return { label: 'Wyświetlone', color: 'bg-blue-100 text-blue-700', Icon: Clock };
    if (s === 'draft') return { label: 'Szkic', color: 'bg-slate-100 text-slate-700', Icon: Clock };
    return { label: 'Wysłane', color: 'bg-blue-100 text-blue-700', Icon: Send };
  })();

  const totalNetto = items.reduce((sum, item) => {
    const price = parseFloat(prices[item.id] || '0') || 0;
    return sum + price * (item.quantity || 0);
  }, 0);

  const generatePrintHTML = () => {
    const companyName = companyData.name || '';
    const companyNip = companyData.nip || '';
    const companyAddr = [companyData.street, companyData.building_number, companyData.postal_code, companyData.city].filter(Boolean).join(', ');

    let sectionsHTML = '';
    sections.forEach(sec => {
      sectionsHTML += `<div style="font-size:14px;font-weight:600;color:#2c3e50;margin:16px 0 6px;padding-bottom:3px;border-bottom:2px solid #2c3e50;">${sec.name}</div>`;
      sectionsHTML += `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;">
        <thead><tr style="background:#2c3e50;color:white;">
          <th style="padding:8px 6px;text-align:left;">Lp.</th>
          <th style="padding:8px 6px;text-align:left;">Nazwa</th>
          <th style="padding:8px 6px;text-align:center;">Jedn.</th>
          <th style="padding:8px 6px;text-align:right;">Ilość</th>
          <th style="padding:8px 6px;text-align:right;">Cena jedn. netto</th>
          <th style="padding:8px 6px;text-align:right;">Wartość netto</th>
        </tr></thead><tbody>`;
      sec.items.forEach((item, i) => {
        const price = parseFloat(prices[item.id] || '0') || 0;
        const val = price * (item.quantity || 0);
        sectionsHTML += `<tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 8px;">${i + 1}</td>
          <td style="padding:10px 8px;">${item.name}</td>
          <td style="padding:10px 8px;text-align:center;">${item.unit || 'szt.'}</td>
          <td style="padding:10px 8px;text-align:right;">${item.quantity}</td>
          <td style="padding:10px 8px;text-align:right;">${price > 0 ? fmtCur(price) : '-'}</td>
          <td style="padding:10px 8px;text-align:right;font-weight:500;">${val > 0 ? fmtCur(val) : '-'}</td>
        </tr>`;
      });
      sectionsHTML += '</tbody></table>';
    });

    return `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>Zapytanie ofertowe — ${request?.name || ''}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:20px 28px;color:#1e293b;font-size:13px;}
@media print{body{padding:0;}@page{margin:12mm 15mm;size:A4;}}
.info-table{width:100%;border-collapse:collapse;margin-bottom:24px;}
.info-table td{padding:10px 12px;vertical-align:top;border:1px solid #e2e8f0;}
.info-table .label{background:#2c3e50;color:white;font-weight:600;text-align:center;padding:8px;}
table{page-break-inside:auto;}tr{page-break-inside:avoid;}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
  <div>
    <h2 style="margin:0 0 4px;font-size:18px;">${request?.name || 'Zapytanie ofertowe'}</h2>
    <p style="margin:0;color:#64748b;font-size:12px;">Data utworzenia: ${formatDate(request?.created_at)}</p>
    ${offerName ? `<p style="margin:0;color:#64748b;font-size:12px;">Oferta źródłowa: ${offerName} ${offerNumber ? `(${offerNumber})` : ''}</p>` : ''}
  </div>
  ${companyData.logo_url ? `<img src="${companyData.logo_url}" alt="" style="max-height:50px;" />` : ''}
</div>
<table class="info-table">
  <tr><td class="label" style="width:50%;">Zamawiający</td><td class="label" style="width:50%;">Wykonawca</td></tr>
  <tr>
    <td>${subcontractorData ? `<strong>${subcontractorData.name}</strong>${subcontractorData.nip ? `<br/>NIP: ${subcontractorData.nip}` : ''}${subcontractorData.phone ? `<br/>tel. ${subcontractorData.phone}` : ''}${subcontractorData.email ? `<br/>email: ${subcontractorData.email}` : ''}` : '<em>-</em>'}</td>
    <td><strong>${companyName}</strong>${companyNip ? `<br/>NIP: ${companyNip}` : ''}${companyAddr ? `<br/>${companyAddr}` : ''}${companyData.phone ? `<br/>tel. ${companyData.phone}` : ''}${companyData.email ? `<br/>email: ${companyData.email}` : ''}</td>
  </tr>
</table>
${sectionsHTML}
<div style="margin-top:24px;padding-top:12px;border-top:2px solid #2c3e50;">
  <table style="width:300px;margin-left:auto;font-size:13px;">
    <tr style="font-weight:bold;font-size:15px;"><td style="padding:6px 0;">Razem netto:</td><td style="padding:6px 0;text-align:right;">${fmtCur(totalNetto)} zł</td></tr>
  </table>
</div>
${notes ? `<div style="margin-top:24px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;"><strong>Uwagi:</strong><br/><span style="white-space:pre-wrap;">${notes}</span></div>` : ''}
</body></html>`;
  };

  const handlePrint = () => {
    const html = generatePrintHTML();
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  };

  const handleDownloadPDF = async () => {
    const html = generatePrintHTML();
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;width:800px;height:1200px;';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument!;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    await new Promise(r => setTimeout(r, 800));
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const body = iframeDoc.body;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const canvas = await html2canvas(body, { scale: 3, useCORS: true, width: body.scrollWidth, windowWidth: body.scrollWidth, logging: false, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const contentW = 190;
      const imgH = (canvas.height * contentW) / canvas.width;
      let yOff = 0;
      const usableH = 277;
      while (yOff < imgH) {
        if (yOff > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, 10 - yOff, contentW, imgH);
        yOff += usableH;
      }
      pdf.save(`zapytanie-${request?.name || 'ofertowe'}.pdf`);
    } catch {
      handlePrint();
    }
    document.body.removeChild(iframe);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-slate-500">Ładowanie zapytania ofertowego…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Błąd</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-6 pt-6">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-8 border-b border-slate-100">
            <div className="flex justify-between items-start">
              <div>
                {offerNumber && <p className="text-sm text-indigo-600 font-medium mb-1">{offerNumber}</p>}
                <h2 className="text-2xl font-bold text-slate-900">{request?.name || 'Zapytanie ofertowe'}</h2>
                {offerName && (
                  <p className="text-slate-500 mt-1 text-sm">Oferta źródłowa: <span className="font-medium text-slate-700">{offerName}</span></p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {/* Status badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusBadge.color}`}>
                  <statusBadge.Icon className="w-4 h-4" />
                  {statusBadge.label}
                </span>
                {/* Type badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${typeInfo.bg} ${typeInfo.color}`}>
                  <TypeIcon className="w-4 h-4" />
                  {typeInfo.label}
                </span>
                <div className="text-right text-sm text-slate-500 space-y-1 mt-1">
                  <div className="flex items-center gap-2 justify-end">
                    <Calendar className="w-4 h-4" />
                    <span>Utworzone: {formatDate(request?.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Company logo */}
          {companyData.logo_url && (
            <div className="flex justify-center py-5 border-b border-slate-100">
              <img
                src={companyData.logo_url}
                alt={companyData.name}
                className="max-h-16 object-contain"
              />
            </div>
          )}

          {/* Zamawiający / Wykonawca */}
          <div className="px-8 py-6 border-b border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* Zamawiający (subcontractor / supplier) */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Podwykonawca / Dostawca</h4>
                {subcontractorData || supplierData ? (
                  <div className="space-y-3">
                    {subcontractorData && (
                      <div className="text-sm text-slate-700 space-y-0.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Podwykonawca</p>
                        <p className="font-semibold text-slate-900">{subcontractorData.name}</p>
                        {subcontractorData.nip && <p>NIP: {subcontractorData.nip}</p>}
                        {subcontractorData.phone && <p>tel. {subcontractorData.phone}</p>}
                        {subcontractorData.email && <p>email: {subcontractorData.email}</p>}
                      </div>
                    )}
                    {supplierData && (
                      <div className="text-sm text-slate-700 space-y-0.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Dostawca</p>
                        <p className="font-semibold text-slate-900">{supplierData.name}</p>
                        {supplierData.nip && <p>NIP: {supplierData.nip}</p>}
                        {supplierData.phone && <p>tel. {supplierData.phone}</p>}
                        {supplierData.email && <p>email: {supplierData.email}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Nie przypisano</p>
                )}
              </div>
              {/* Wykonawca (company) */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Wykonawca</h4>
                {companyData.name ? (
                  <div className="text-sm text-slate-700 space-y-0.5">
                    <p className="font-semibold text-slate-900">{companyData.name}</p>
                    {companyData.nip && <p>NIP: {companyData.nip}</p>}
                    {(companyData.street || companyData.city) && (
                      <p>{[companyData.street, companyData.building_number, companyData.postal_code, companyData.city].filter(Boolean).join(', ')}</p>
                    )}
                    {companyData.phone && <p>tel. {companyData.phone}</p>}
                    {companyData.email && <p>email: {companyData.email}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Brak danych</p>
                )}
              </div>
            </div>
          </div>

          {/* Sections & Items */}
          <div className="p-4 sm:p-8">
            {submitted ? (
              <div className="py-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">Odpowiedź wysłana</h2>
                <p className="text-slate-500">Dziękujemy za przesłanie wyceny. Wykonawca otrzymał Twoją odpowiedź.</p>
              </div>
            ) : (
              <>
                {/* Search bar + export buttons */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Szukaj pozycji..."
                      value={itemSearchQuery}
                      onChange={e => setItemSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    {itemSearchQuery && (
                      <button onClick={() => setItemSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                      title="Drukuj"
                    >
                      <Printer className="w-4 h-4" />
                      <span className="hidden sm:inline">Drukuj</span>
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                      title="Pobierz PDF"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">PDF</span>
                    </button>
                  </div>
                </div>

                {/* Collapse/expand all */}
                {sections.length > 1 && (
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => {
                        if (collapsedSections.size === 0) {
                          setCollapsedSections(new Set(sections.map(s => s.name)));
                        } else {
                          setCollapsedSections(new Set());
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    >
                      {collapsedSections.size === 0 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {collapsedSections.size === 0 ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
                    </button>
                  </div>
                )}

                {/* Sections */}
                {sections.filter(sec => {
                  if (!itemSearchQuery) return true;
                  const q = itemSearchQuery.toLowerCase();
                  if (sec.name.toLowerCase().includes(q)) return true;
                  return sec.items.some(i => i.name.toLowerCase().includes(q));
                }).map(section => {
                  const sectionTotal = section.items.reduce((s, item) => {
                    const price = parseFloat(prices[item.id] || '0') || 0;
                    return s + price * (item.quantity || 0);
                  }, 0);
                  const isCollapsed = collapsedSections.has(section.name);
                  const toggleSection = () => {
                    setCollapsedSections(prev => {
                      const next = new Set(prev);
                      if (next.has(section.name)) next.delete(section.name);
                      else next.add(section.name);
                      return next;
                    });
                  };

                  return (
                    <div key={section.name} className="mb-8 last:mb-0">
                      <button
                        onClick={toggleSection}
                        className="w-full flex items-center justify-between text-lg font-semibold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100 hover:text-indigo-700 transition cursor-pointer text-left"
                      >
                        <span className="flex items-center gap-2">
                          {isCollapsed ? <ChevronRight className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                          {section.name}
                        </span>
                        {sectionTotal > 0 && <span className="text-sm font-medium text-slate-500">{fmtCur(sectionTotal)} zł</span>}
                      </button>
                      {!isCollapsed && (
                        <div className="overflow-x-auto -mx-2 px-2">
                          <table className="w-full min-w-[700px]">
                            <thead>
                              <tr className="text-left text-sm text-slate-500">
                                <th className="pb-3 pr-4 w-10">Lp.</th>
                                <th className="pb-3 pr-4">Nazwa</th>
                                <th className="pb-3 pr-4 text-center w-16">Jedn.</th>
                                <th className="pb-3 pr-4 text-right w-20">Ilość</th>
                                <th className="pb-3 pr-4 text-right w-36">Cena jedn. netto (zł)</th>
                                <th className="pb-3 text-right w-28">Wartość netto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {section.items.filter(item => {
                                if (!itemSearchQuery) return true;
                                return item.name.toLowerCase().includes(itemSearchQuery.toLowerCase());
                              }).map((item, i) => {
                                const price = parseFloat(prices[item.id] || '0') || 0;
                                const value = price * (item.quantity || 0);
                                return (
                                  <tr key={item.id || i} className="border-t border-slate-100 hover:bg-slate-50/50">
                                    <td className="py-3 pr-4 text-slate-500">{i + 1}</td>
                                    <td className="py-3 pr-4 font-medium text-slate-900">{item.name}</td>
                                    <td className="py-3 pr-4 text-center text-slate-500">{item.unit || 'szt.'}</td>
                                    <td className="py-3 pr-4 text-right text-slate-700">{item.quantity}</td>
                                    <td className="py-3 pr-4 text-right">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={prices[item.id] || ''}
                                        onChange={e => setPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-right text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="0.00"
                                      />
                                    </td>
                                    <td className="py-3 text-right font-medium text-slate-900">
                                      {value > 0 ? `${fmtCur(value)} zł` : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Totals */}
                <div className="mt-6 pt-4 border-t-2 border-slate-200">
                  <div className="flex justify-end">
                    <div className="w-72 space-y-2">
                      <div className="flex justify-between text-base font-bold text-slate-900">
                        <span>Razem netto:</span>
                        <span className="text-indigo-700">{fmtCur(totalNetto)} zł</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-6">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Uwagi (opcjonalnie)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Dodatkowe informacje, warunki, terminy realizacji…"
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end mt-6">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 transition"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Wyślij wycenę
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-slate-400">
          Zapytanie ofertowe wygenerowane przez MaxMaster
        </div>
      </div>
    </div>
  );
};
