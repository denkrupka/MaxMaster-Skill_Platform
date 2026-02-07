import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, FileText, Send, CheckCircle, XCircle, Eye, Pencil,
  Trash2, Copy, Download, ExternalLink, Loader2, Filter, Calendar,
  DollarSign, User, Building2, MoreVertical, ArrowLeft, Clock,
  Mail, Link as LinkIcon, RefreshCw
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Project, Offer, OfferStatus, Contractor } from '../../types';
import { OFFER_STATUS_LABELS, OFFER_STATUS_COLORS, OFFER_STATUS_ICONS } from '../../constants';

const StatusBadge: React.FC<{ status: OfferStatus }> = ({ status }) => {
  const config = OFFER_STATUS_COLORS[status];
  const label = OFFER_STATUS_LABELS[status];

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config}`}>
      {label}
    </span>
  );
};

export const OffersPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [offers, setOffers] = useState<Offer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OfferStatus | 'all'>('all');

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [offersRes, projectsRes, contractorsRes] = await Promise.all([
        supabase
          .from('offers')
          .select('*, project:projects(*), client:contractors(*)')
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('*')
          .eq('company_id', currentUser.company_id),
        supabase
          .from('contractors')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .eq('contractor_type', 'customer')
          .is('deleted_at', null)
      ]);

      if (offersRes.data) setOffers(offersRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
      if (contractorsRes.data) setContractors(contractorsRes.data);
    } catch (err) {
      console.error('Error loading offers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
      const matchesSearch = offer.name.toLowerCase().includes(search.toLowerCase()) ||
        offer.number?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || offer.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [offers, search, statusFilter]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pl-PL');
  };

  const handleSendOffer = async (offer: Offer) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('offers')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', offer.id);

      if (!error) {
        loadData();
      }
    } catch (err) {
      console.error('Error sending offer:', err);
    }
  };

  const copyPublicLink = (offer: Offer) => {
    if (offer.public_url) {
      navigator.clipboard.writeText(window.location.origin + offer.public_url);
      // TODO: show toast notification
    }
  };

  // Offer detail view
  if (selectedOffer) {
    return (
      <div className="p-6">
        <button
          onClick={() => setSelectedOffer(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Powrót do listy
        </button>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{selectedOffer.name}</h1>
              <p className="text-slate-500 mt-1">
                {selectedOffer.number || 'Brak numeru'} • Utworzono {formatDate(selectedOffer.created_at)}
              </p>
            </div>
            <StatusBadge status={selectedOffer.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Klient</p>
              <p className="font-medium text-slate-900">
                {(selectedOffer as any).client?.name || 'Nie przypisano'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Projekt</p>
              <p className="font-medium text-slate-900">
                {(selectedOffer as any).project?.name || 'Nie przypisano'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Ważność</p>
              <p className="font-medium text-slate-900">{formatDate(selectedOffer.valid_until)}</p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Podsumowanie finansowe</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-500">Wartość</p>
                <p className="text-xl font-semibold text-slate-900">{formatCurrency(selectedOffer.total_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Rabat</p>
                <p className="text-xl font-semibold text-red-600">-{formatCurrency(selectedOffer.discount_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Do zapłaty</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(selectedOffer.final_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Wyświetlenia</p>
                <p className="text-xl font-semibold text-slate-900">{selectedOffer.viewed_count}</p>
              </div>
            </div>
          </div>

          {selectedOffer.status === 'draft' && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => handleSendOffer(selectedOffer)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Send className="w-4 h-4" />
                Wyślij ofertę
              </button>
              <button
                onClick={() => { setEditingOffer(selectedOffer); setShowOfferModal(true); }}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <Pencil className="w-4 h-4" />
                Edytuj
              </button>
            </div>
          )}

          {selectedOffer.public_url && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 mb-2">Link publiczny do oferty:</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={window.location.origin + selectedOffer.public_url}
                  className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm"
                />
                <button
                  onClick={() => copyPublicLink(selectedOffer)}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Oferty</h1>
          <p className="text-slate-600 mt-1">Zarządzaj ofertami handlowymi</p>
        </div>
        <button
          onClick={() => { setEditingOffer(null); setShowOfferModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Nowa oferta
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj oferty..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as OfferStatus | 'all')}
            className="px-4 py-2 border border-slate-200 rounded-lg"
          >
            <option value="all">Wszystkie statusy</option>
            <option value="draft">Wersja robocza</option>
            <option value="sent">Wysłane</option>
            <option value="accepted">Zaakceptowane</option>
            <option value="rejected">Odrzucone</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Brak ofert do wyświetlenia</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredOffers.map(offer => (
              <div
                key={offer.id}
                className="p-4 hover:bg-slate-50 cursor-pointer transition"
                onClick={() => setSelectedOffer(offer)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900">{offer.name}</h3>
                      <p className="text-sm text-slate-500">
                        {offer.number || 'Brak numeru'} • {(offer as any).client?.name || 'Brak klienta'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatCurrency(offer.final_amount)}</p>
                      <p className="text-xs text-slate-500">Ważna do: {formatDate(offer.valid_until)}</p>
                    </div>
                    <StatusBadge status={offer.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OffersPage;
