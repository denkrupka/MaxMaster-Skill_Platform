import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  FileText, CheckCircle, Clock, Building2, Calendar,
  Download, Loader2, ExternalLink, Shield, Star, Phone, Mail
} from 'lucide-react';

interface PublicOffer {
  id: string;
  name: string;
  number: string;
  valid_until: string;
  total_amount: number;
  discount_percent: number;
  discount_amount: number;
  final_amount: number;
  notes: string;
  status: string;
  created_at: string;
  print_settings: any;
  company: {
    id: string;
    name: string;
    logo_url: string | null;
    nip: string;
  } | null;
  client: {
    name: string;
  } | null;
  sections: {
    id: string;
    name: string;
    sort_order: number;
    items: {
      id: string;
      name: string;
      description: string;
      unit: string;
      quantity: number;
      unit_price: number;
      discount_percent: number;
      vat_rate: number;
      sort_order: number;
      is_optional: boolean;
    }[];
  }[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

const formatDate = (date: string | null | undefined) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const OfferLandingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [offer, setOffer] = useState<PublicOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (token) loadOffer(token);
  }, [token]);

  const loadOffer = async (publicToken: string) => {
    setLoading(true);
    try {
      // Find offer by public token or ID prefix
      const { data: offerData, error: offerErr } = await supabase
        .from('offers')
        .select('*, company:companies(id, name, logo_url, nip)')
        .or(`public_token.eq.${publicToken},id.ilike.${publicToken}%`)
        .is('deleted_at', null)
        .single();

      if (offerErr || !offerData) {
        setError('Oferta nie została znaleziona lub link wygasł.');
        setLoading(false);
        return;
      }

      // Track view
      await supabase
        .from('offers')
        .update({
          viewed_at: new Date().toISOString(),
          viewed_count: (offerData.viewed_count || 0) + 1
        })
        .eq('id', offerData.id);

      // Load sections and items
      const [sectionsRes, itemsRes, clientRes] = await Promise.all([
        supabase
          .from('offer_sections')
          .select('*')
          .eq('offer_id', offerData.id)
          .order('sort_order'),
        supabase
          .from('offer_items')
          .select('*')
          .eq('offer_id', offerData.id)
          .order('sort_order'),
        offerData.client_id
          ? supabase.from('contractors').select('name').eq('id', offerData.client_id).single()
          : Promise.resolve({ data: null })
      ]);

      const sections = (sectionsRes.data || []).map(s => ({
        ...s,
        items: (itemsRes.data || []).filter((i: any) => i.section_id === s.id)
      }));

      // Add unsectioned items
      const unsectionedItems = (itemsRes.data || []).filter((i: any) => !i.section_id);
      if (unsectionedItems.length > 0) {
        sections.unshift({
          id: 'unsectioned',
          name: 'Pozycje',
          sort_order: -1,
          items: unsectionedItems
        });
      }

      setOffer({
        ...offerData,
        client: clientRes.data as any,
        sections
      });
    } catch (err) {
      console.error('Error loading public offer:', err);
      setError('Wystąpił błąd podczas ładowania oferty.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!offer) return;
    await supabase
      .from('offers')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', offer.id);
    setAccepted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-500">Ładowanie oferty...</p>
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Oferta niedostępna</h1>
          <p className="text-slate-500">{error || 'Nie udało się załadować oferty.'}</p>
        </div>
      </div>
    );
  }

  const issueDate = offer.print_settings?.issue_date || offer.created_at;
  const isExpired = offer.valid_until && new Date(offer.valid_until) < new Date();
  const totalNetto = offer.sections.reduce((sum, s) =>
    sum + s.items.reduce((si, i) => si + i.quantity * i.unit_price, 0), 0);
  const totalDiscount = offer.sections.reduce((sum, s) =>
    sum + s.items.reduce((si, i) => {
      const itemTotal = i.quantity * i.unit_price;
      return si + itemTotal * ((i.discount_percent || 0) / 100);
    }, 0), 0);
  const nettoAfterDiscount = totalNetto - totalDiscount;
  const vatAmount = offer.sections.reduce((sum, s) =>
    sum + s.items.reduce((si, i) => {
      const itemTotal = i.quantity * i.unit_price;
      const itemDiscount = itemTotal * ((i.discount_percent || 0) / 100);
      return si + (itemTotal - itemDiscount) * ((i.vat_rate ?? 23) / 100);
    }, 0), 0);
  const brutto = nettoAfterDiscount + vatAmount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {offer.company?.logo_url ? (
                <img
                  src={offer.company.logo_url}
                  alt={offer.company.name}
                  className="w-14 h-14 rounded-xl bg-white/10 object-contain p-1"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
                  <Building2 className="w-7 h-7" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{offer.company?.name || 'Firma'}</h1>
                {offer.company?.nip && <p className="text-blue-200 text-sm">NIP: {offer.company.nip}</p>}
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                accepted || offer.status === 'accepted' ? 'bg-green-500/20 text-green-100' :
                isExpired ? 'bg-red-500/20 text-red-200' :
                'bg-white/20 text-white'
              }`}>
                {accepted || offer.status === 'accepted' ? (
                  <><CheckCircle className="w-4 h-4" /> Zaakceptowana</>
                ) : isExpired ? (
                  <><Clock className="w-4 h-4" /> Wygasła</>
                ) : (
                  <><Clock className="w-4 h-4" /> Aktywna</>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 -mt-4">
        {/* Offer card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Offer header */}
          <div className="p-8 border-b border-slate-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-blue-600 font-medium mb-1">{offer.number}</p>
                <h2 className="text-2xl font-bold text-slate-900">{offer.name}</h2>
                {offer.client && (
                  <p className="text-slate-500 mt-2">Dla: <span className="font-medium text-slate-700">{offer.client.name}</span></p>
                )}
              </div>
              <div className="text-right text-sm text-slate-500 space-y-1">
                <div className="flex items-center gap-2 justify-end">
                  <Calendar className="w-4 h-4" />
                  <span>Wystawiona: {formatDate(issueDate)}</span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Clock className="w-4 h-4" />
                  <span>Ważna do: <span className={isExpired ? 'text-red-500 font-medium' : 'font-medium text-slate-700'}>{formatDate(offer.valid_until)}</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Sections & Items */}
          <div className="p-8">
            {offer.sections.map(section => (
              <div key={section.id} className="mb-8 last:mb-0">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b-2 border-blue-100">
                  {section.name}
                </h3>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-slate-500">
                      <th className="pb-3 pr-4 w-10">Lp.</th>
                      <th className="pb-3 pr-4">Nazwa</th>
                      <th className="pb-3 pr-4 text-center w-16">Jedn.</th>
                      <th className="pb-3 pr-4 text-right w-20">Ilość</th>
                      <th className="pb-3 pr-4 text-right w-28">Cena jedn.</th>
                      <th className="pb-3 text-right w-28">Wartość</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, idx) => {
                      const itemTotal = item.quantity * item.unit_price;
                      const itemDiscount = itemTotal * ((item.discount_percent || 0) / 100);
                      return (
                        <tr key={item.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                          <td className="py-3 pr-4 text-sm text-slate-400">{idx + 1}</td>
                          <td className="py-3 pr-4">
                            <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                            {item.is_optional && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded ml-1">opcja</span>}
                            {(item.discount_percent || 0) > 0 && (
                              <span className="text-xs text-red-500 ml-1">-{item.discount_percent}%</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-sm text-center text-slate-500">{item.unit || 'szt.'}</td>
                          <td className="py-3 pr-4 text-sm text-right text-slate-600">{item.quantity}</td>
                          <td className="py-3 pr-4 text-sm text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                          <td className="py-3 text-sm text-right font-medium text-slate-900">
                            {formatCurrency(itemTotal - itemDiscount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="p-8 bg-gradient-to-r from-slate-50 to-blue-50/30 border-t border-slate-100">
            <div className="max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Suma netto:</span>
                <span className="font-medium">{formatCurrency(totalNetto)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Rabat:</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Netto po rabacie:</span>
                  <span className="font-medium">{formatCurrency(nettoAfterDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">VAT:</span>
                <span className="font-medium">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t-2 border-blue-200">
                <span className="text-lg font-bold text-slate-900">Brutto:</span>
                <span className="text-2xl font-bold text-blue-600">{formatCurrency(brutto)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {offer.notes && (
            <div className="p-8 border-t border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-2">Uwagi</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{offer.notes}</p>
            </div>
          )}

          {/* Accept button */}
          {!accepted && offer.status !== 'accepted' && offer.status !== 'rejected' && !isExpired && (
            <div className="p-8 border-t border-slate-100 text-center">
              <button
                onClick={handleAccept}
                className="px-8 py-3 bg-green-600 text-white rounded-xl text-lg font-semibold hover:bg-green-700 transition shadow-lg shadow-green-200"
              >
                <CheckCircle className="w-5 h-5 inline-block mr-2 -mt-0.5" />
                Akceptuję ofertę
              </button>
              <p className="text-xs text-slate-400 mt-3">Klikając powyższy przycisk, akceptujesz warunki przedstawione w ofercie.</p>
            </div>
          )}

          {accepted && (
            <div className="p-8 border-t border-slate-100 text-center bg-green-50">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-800">Oferta zaakceptowana!</h3>
              <p className="text-green-600 mt-1">Dziękujemy za akceptację. Skontaktujemy się z Tobą wkrótce.</p>
            </div>
          )}
        </div>

        {/* Footer - marketing */}
        <div className="mt-8 mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 rounded-full shadow-sm border border-slate-100">
            <Shield className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-slate-500">Oferta wygenerowana w</span>
            <span className="text-sm font-semibold text-blue-600">MaxMaster</span>
            <Star className="w-3 h-3 text-amber-400" />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Profesjonalne narzędzie do zarządzania firmą budowlano-instalacyjną
          </p>
        </div>
      </div>
    </div>
  );
};

export default OfferLandingPage;
