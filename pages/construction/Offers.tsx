import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, Search, FileText, Send, CheckCircle, XCircle, Eye, Pencil,
  Trash2, Copy, Download, ExternalLink, Loader2, Filter, Calendar,
  DollarSign, User, Building2, MoreVertical, ArrowLeft, Clock,
  Mail, Link as LinkIcon, RefreshCw, ChevronDown, ChevronRight,
  Save, X, GripVertical, Percent, AlertCircle, FileSpreadsheet,
  FolderPlus, Package
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { fetchCompanyByNip, validateNip, normalizeNip } from '../../lib/gusApi';
import { searchAddress, OSMAddress, createDebouncedSearch } from '../../lib/osmAutocomplete';
import { Project, Offer, OfferStatus, OfferSection, OfferItem, Contractor, Estimate, EstimateStage, EstimateTask, EstimateResource, KosztorysRequestSource } from '../../types';
import { OFFER_STATUS_LABELS, OFFER_STATUS_COLORS } from '../../constants';

const OFFER_SOURCE_LABELS: Record<KosztorysRequestSource, string> = {
  email: 'E-mail',
  phone: 'Telefon',
  meeting: 'Spotkanie',
  tender: 'Przetarg',
  other: 'Inne'
};

interface OfferExistingClient {
  contractor_id?: string;
  client_name: string;
  nip: string | null;
  company_street: string | null;
  company_street_number: string | null;
  company_city: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  source: 'contractor' | 'request_history';
}

// ============================================
// TYPES
// ============================================
interface LocalOfferItem extends Omit<OfferItem, 'total_price'> {
  total_price: number;
  isEditing?: boolean;
  isNew?: boolean;
}

interface LocalOfferSection extends OfferSection {
  items: LocalOfferItem[];
  isExpanded?: boolean;
}

// ============================================
// COMPONENTS
// ============================================

const StatusBadge: React.FC<{ status: OfferStatus }> = ({ status }) => {
  const config = OFFER_STATUS_COLORS[status];
  const label = OFFER_STATUS_LABELS[status];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config}`}>
      {label}
    </span>
  );
};

// Inline editable cell
const EditableCell: React.FC<{
  value: string | number;
  onChange: (value: string) => void;
  onBlur: () => void;
  type?: 'text' | 'number';
  className?: string;
  disabled?: boolean;
}> = ({ value, onChange, onBlur, type = 'text', className = '', disabled }) => {
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  return (
    <input
      type={type}
      value={localValue}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={() => { onChange(localValue); onBlur(); }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(localValue); onBlur(); } }}
      disabled={disabled}
      className={`w-full px-2 py-1 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${disabled ? 'bg-slate-50 cursor-not-allowed' : ''} ${className}`}
    />
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const OffersPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, language } = state;

  // List state
  const [offers, setOffers] = useState<Offer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [estimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OfferStatus | 'all'>('all');

  // Modal/View state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportFromEstimate, setShowImportFromEstimate] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [editForm, setEditForm] = useState({ name: '', project_id: '', client_id: '', valid_until: '', notes: '' });

  // Editor state
  const [offerData, setOfferData] = useState({
    name: '',
    project_id: '',
    client_id: '',
    valid_until: '',
    discount_percent: 0,
    discount_amount: 0,
    notes: '',
    internal_notes: ''
  });
  const [sections, setSections] = useState<LocalOfferSection[]>([]);
  const [savingOffer, setSavingOffer] = useState(false);

  // Import from estimate state
  const [selectedEstimateId, setSelectedEstimateId] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importSource, setImportSource] = useState<'estimates' | 'kosztorys'>('kosztorys');
  const [kosztorysEstimates, setKosztorysEstimates] = useState<any[]>([]);
  const [selectedKosztorysId, setSelectedKosztorysId] = useState('');

  const autoSelectDone = useRef(false);

  // Client form state (kosztorys-style)
  const [offerClientData, setOfferClientData] = useState({
    client_name: '', nip: '', company_street: '', company_street_number: '',
    company_city: '', company_postal_code: '', company_country: 'Polska',
    internal_notes: '', request_source: 'email' as KosztorysRequestSource
  });
  const [offerGusLoading, setOfferGusLoading] = useState(false);
  const [offerGusError, setOfferGusError] = useState<string | null>(null);
  const [offerGusSuccess, setOfferGusSuccess] = useState<string | null>(null);
  const [offerExistingClients, setOfferExistingClients] = useState<OfferExistingClient[]>([]);
  const [offerClientSearchQuery, setOfferClientSearchQuery] = useState('');
  const [offerShowClientDropdown, setOfferShowClientDropdown] = useState(false);
  const [offerFilteredClients, setOfferFilteredClients] = useState<OfferExistingClient[]>([]);
  const [offerCompanyAddressSuggestions, setOfferCompanyAddressSuggestions] = useState<OSMAddress[]>([]);
  const [offerShowCompanyAddressSuggestions, setOfferShowCompanyAddressSuggestions] = useState(false);

  // ============================================
  // DATA LOADING
  // ============================================
  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [offersRes, projectsRes, contractorsRes, kosztorysRes] = await Promise.all([
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
          .is('deleted_at', null),
        supabase
          .from('kosztorys_estimates')
          .select('*, request:kosztorys_requests(investment_name, client_name)')
          .eq('company_id', currentUser.company_id)
          .in('status', ['draft', 'pending_approval', 'approved'])
          .order('created_at', { ascending: false })
      ]);

      if (offersRes.data) setOffers(offersRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
      if (contractorsRes.data) setContractors(contractorsRes.data);
      if (kosztorysRes.data) setKosztorysEstimates(kosztorysRes.data);
    } catch (err) {
      console.error('Error loading offers:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CLIENT FORM HELPERS (kosztorys-style)
  // ============================================
  const loadOfferExistingClients = async () => {
    if (!currentUser) return;
    try {
      const { data: portalClients } = await supabase
        .from('contractors_clients')
        .select('id, name, nip, address_street, address_city, address_postal_code, address_country, contractor_type')
        .eq('company_id', currentUser.company_id)
        .eq('is_archived', false)
        .order('name');

      const { data: requestsData } = await supabase
        .from('kosztorys_requests')
        .select('client_name, nip, company_street, company_street_number, company_city, company_postal_code, company_country')
        .eq('company_id', currentUser.company_id)
        .order('client_name');

      const allClients: OfferExistingClient[] = [];
      const portalByNip = new Map<string, number>();
      const portalByName = new Map<string, number>();

      if (portalClients) {
        portalClients.forEach(c => {
          const idx = allClients.length;
          allClients.push({
            contractor_id: c.id, client_name: c.name, nip: c.nip,
            company_street: c.address_street, company_street_number: null,
            company_city: c.address_city, company_postal_code: c.address_postal_code,
            company_country: c.address_country === 'PL' ? 'Polska' : (c.address_country || 'Polska'),
            source: 'contractor'
          });
          if (c.nip) portalByNip.set(c.nip.replace(/\D/g, ''), idx);
          portalByName.set(c.name.toLowerCase(), idx);
        });
      }

      if (requestsData) {
        requestsData.forEach(r => {
          if (portalByName.has(r.client_name.toLowerCase())) {
            const idx = portalByName.get(r.client_name.toLowerCase())!;
            if (!allClients[idx].company_street && r.company_street) {
              allClients[idx].company_street = r.company_street;
              allClients[idx].company_street_number = r.company_street_number;
              allClients[idx].company_city = r.company_city;
              allClients[idx].company_postal_code = r.company_postal_code;
            }
            return;
          }
          if (r.nip) {
            const rawNip = r.nip.replace(/\D/g, '');
            if (portalByNip.has(rawNip)) return;
          }
          allClients.push({
            client_name: r.client_name, nip: r.nip,
            company_street: r.company_street, company_street_number: r.company_street_number,
            company_city: r.company_city, company_postal_code: r.company_postal_code,
            company_country: r.company_country || 'Polska', source: 'request_history'
          });
        });
      }

      setOfferExistingClients(allClients);
    } catch (err) {
      console.error('Error loading existing clients for offers:', err);
    }
  };

  useEffect(() => {
    if (currentUser) loadOfferExistingClients();
  }, [currentUser]);

  // Filter clients based on search query
  useEffect(() => {
    if (offerClientSearchQuery.trim().length >= 2) {
      const query = offerClientSearchQuery.toLowerCase();
      const filtered = offerExistingClients.filter(c =>
        c.client_name.toLowerCase().includes(query) || (c.nip && c.nip.includes(query))
      );
      filtered.sort((a, b) => {
        if (a.source !== b.source) return a.source === 'contractor' ? -1 : 1;
        return a.client_name.localeCompare(b.client_name);
      });
      setOfferFilteredClients(filtered);
      setOfferShowClientDropdown(filtered.length > 0 || offerClientSearchQuery.trim().length >= 2);
    } else {
      setOfferFilteredClients([]);
      setOfferShowClientDropdown(false);
    }
  }, [offerClientSearchQuery, offerExistingClients]);

  const debouncedOfferAddressSearch = useCallback(createDebouncedSearch(500), []);

  const handleOfferCompanyStreetChange = (value: string) => {
    setOfferClientData(prev => ({ ...prev, company_street: value }));
    if (value.length >= 3) {
      const sq = offerClientData.company_city ? `${value}, ${offerClientData.company_city}` : value;
      debouncedOfferAddressSearch(sq, (results: OSMAddress[]) => {
        setOfferCompanyAddressSuggestions(results);
        setOfferShowCompanyAddressSuggestions(results.length > 0);
      });
    } else {
      setOfferShowCompanyAddressSuggestions(false);
    }
  };

  const selectOfferCompanyAddress = (addr: OSMAddress) => {
    setOfferClientData(prev => ({
      ...prev,
      company_street: addr.street, company_street_number: addr.streetNumber,
      company_city: addr.city, company_postal_code: addr.postalCode,
      company_country: addr.country || 'Polska'
    }));
    setOfferShowCompanyAddressSuggestions(false);
  };

  const selectOfferExistingClient = (client: OfferExistingClient) => {
    let nip = client.nip || '';
    if (!nip && client.contractor_id) {
      const entry = offerExistingClients.find(c => c.contractor_id === client.contractor_id && c.nip);
      if (entry) nip = entry.nip || '';
    }
    setOfferClientData(prev => ({
      ...prev, client_name: client.client_name, nip,
      company_street: client.company_street || '', company_street_number: client.company_street_number || '',
      company_city: client.company_city || '', company_postal_code: client.company_postal_code || '',
      company_country: client.company_country || 'Polska'
    }));
    setOfferClientSearchQuery('');
    setOfferShowClientDropdown(false);
  };

  const handleOfferFetchGus = async () => {
    if (!offerClientData.nip) { setOfferGusError('Wprowadź NIP'); return; }
    if (!validateNip(offerClientData.nip)) { setOfferGusError('Nieprawidłowy format NIP'); return; }
    setOfferGusLoading(true); setOfferGusError(null); setOfferGusSuccess(null);
    try {
      // Check local contractors first
      const rawNip = offerClientData.nip.replace(/\D/g, '');
      const { data: portalClients } = await supabase
        .from('contractors_clients')
        .select('id, name, nip, address_street, address_city, address_postal_code, address_country')
        .eq('company_id', currentUser!.company_id)
        .eq('is_archived', false);
      const match = portalClients?.find(c => c.nip && c.nip.replace(/\D/g, '') === rawNip);
      if (match) {
        setOfferClientData(prev => ({
          ...prev, client_name: match.name,
          company_street: match.address_street || prev.company_street,
          company_city: match.address_city || prev.company_city,
          company_postal_code: match.address_postal_code || prev.company_postal_code,
          company_country: match.address_country === 'PL' ? 'Polska' : (match.address_country || 'Polska')
        }));
        setOfferGusSuccess('Klient znaleziony w bazie kontrahentów');
        setOfferGusLoading(false);
        return;
      }
      // Fetch from GUS API
      const result = await fetchCompanyByNip(offerClientData.nip);
      if (result.success && result.data) {
        const d = result.data;
        setOfferClientData(prev => ({
          ...prev, client_name: d.name || prev.client_name,
          company_street: d.street || prev.company_street, company_street_number: d.streetNumber || prev.company_street_number,
          company_city: d.city || prev.company_city, company_postal_code: d.postalCode || prev.company_postal_code,
          company_country: d.country || 'Polska'
        }));
        setOfferGusSuccess('Dane pobrane z GUS');
      } else {
        setOfferGusError(result.error || 'Nie udało się pobrać danych');
      }
    } catch (err: any) {
      setOfferGusError(err.message || 'Błąd połączenia');
    } finally {
      setOfferGusLoading(false);
    }
  };

  const resetOfferClientData = () => {
    setOfferClientData({
      client_name: '', nip: '', company_street: '', company_street_number: '',
      company_city: '', company_postal_code: '', company_country: 'Polska',
      internal_notes: '', request_source: 'email' as KosztorysRequestSource
    });
    setOfferGusError(null); setOfferGusSuccess(null);
    setOfferClientSearchQuery(''); setOfferShowClientDropdown(false);
    setOfferShowCompanyAddressSuggestions(false);
  };

  // Auto-select offer from URL param (e.g. #/construction/offers?offerId=xxx)
  useEffect(() => {
    if (loading || autoSelectDone.current || !offers.length) return;
    // HashRouter: params are inside the hash, not in window.location.search
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    const params = qIndex >= 0 ? new URLSearchParams(hash.substring(qIndex)) : new URLSearchParams();
    const offerId = params.get('offerId');
    if (offerId) {
      const offer = offers.find(o => o.id === offerId);
      if (offer) {
        setSelectedOffer(offer);
        loadOfferDetails(offerId);
      }
      // Clean up URL — keep path inside hash, remove query
      const hashPath = qIndex >= 0 ? hash.substring(0, qIndex) : hash;
      window.history.replaceState({}, '', window.location.pathname + hashPath);
      autoSelectDone.current = true;
    }
  }, [loading, offers]);

  const loadOfferDetails = async (offerId: string) => {
    try {
      // Load offer with sections and items
      const [offerRes, sectionsRes, itemsRes] = await Promise.all([
        supabase
          .from('offers')
          .select('*, project:projects(*), client:contractors(*)')
          .eq('id', offerId)
          .single(),
        supabase
          .from('offer_sections')
          .select('*')
          .eq('offer_id', offerId)
          .order('sort_order'),
        supabase
          .from('offer_items')
          .select('*')
          .eq('offer_id', offerId)
          .order('sort_order')
      ]);

      if (offerRes.data) {
        const offer = offerRes.data;
        setOfferData({
          name: offer.name,
          project_id: offer.project_id || '',
          client_id: offer.client_id || '',
          valid_until: offer.valid_until || '',
          discount_percent: offer.discount_percent || 0,
          discount_amount: offer.discount_amount || 0,
          notes: offer.notes || '',
          internal_notes: offer.internal_notes || ''
        });
        setSelectedOffer(offer);

        // Map sections with items
        const sectionsList: LocalOfferSection[] = (sectionsRes.data || []).map(s => ({
          ...s,
          isExpanded: true,
          items: (itemsRes.data || [])
            .filter((i: OfferItem) => i.section_id === s.id)
            .map((i: OfferItem) => ({ ...i, isEditing: false, isNew: false }))
        }));

        // Items without section
        const unsectionedItems = (itemsRes.data || [])
          .filter((i: OfferItem) => !i.section_id)
          .map((i: OfferItem) => ({ ...i, isEditing: false, isNew: false }));

        if (unsectionedItems.length > 0) {
          sectionsList.unshift({
            id: 'unsectioned',
            offer_id: offerId,
            name: 'Pozycje bez sekcji',
            sort_order: -1,
            isExpanded: true,
            items: unsectionedItems,
            created_at: '',
            updated_at: ''
          });
        }

        setSections(sectionsList);
      }
    } catch (err) {
      console.error('Error loading offer details:', err);
    }
  };

  // ============================================
  // FILTERING
  // ============================================
  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
      const matchesSearch = offer.name.toLowerCase().includes(search.toLowerCase()) ||
        offer.number?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || offer.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [offers, search, statusFilter]);

  // ============================================
  // FORMATTING
  // ============================================
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pl-PL');
  };

  // ============================================
  // CALCULATIONS
  // ============================================
  const calculateTotals = useCallback(() => {
    const total = sections.reduce((sum, sec) =>
      sum + sec.items.reduce((s, i) => s + (i.quantity * i.unit_price), 0), 0);
    const discountPct = total * (offerData.discount_percent / 100);
    const discountFixed = offerData.discount_amount;
    const final = total - discountPct - discountFixed;
    return { total, discountPct, discountFixed, final: Math.max(0, final) };
  }, [sections, offerData.discount_percent, offerData.discount_amount]);

  const totals = useMemo(() => calculateTotals(), [calculateTotals]);

  // ============================================
  // ACTIONS - OFFER CRUD
  // ============================================
  const handleCreateOffer = async () => {
    if (!currentUser || !offerData.name.trim()) return;
    setSavingOffer(true);
    try {
      // Generate offer number
      const countRes = await supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentUser.company_id);
      const nextNum = (countRes.count || 0) + 1;
      const offerNumber = `OFR-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

      const validUntil = offerData.valid_until ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: newOffer, error } = await supabase
        .from('offers')
        .insert({
          company_id: currentUser.company_id,
          name: offerData.name.trim(),
          number: offerNumber,
          project_id: offerData.project_id || null,
          client_id: offerData.client_id || null,
          valid_until: validUntil,
          discount_percent: offerData.discount_percent,
          discount_amount: offerData.discount_amount,
          notes: offerData.notes,
          internal_notes: offerData.internal_notes,
          status: 'draft',
          created_by_id: currentUser.id
        })
        .select()
        .single();

      if (error) throw error;

      // Create sections and items
      for (const section of sections.filter(s => s.id !== 'unsectioned')) {
        const { data: newSection } = await supabase
          .from('offer_sections')
          .insert({
            offer_id: newOffer.id,
            name: section.name,
            description: section.description,
            sort_order: section.sort_order
          })
          .select()
          .single();

        if (newSection) {
          for (const item of section.items) {
            await supabase
              .from('offer_items')
              .insert({
                offer_id: newOffer.id,
                section_id: newSection.id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                sort_order: item.sort_order,
                is_optional: item.is_optional,
                source_resource_id: item.source_resource_id
              });
          }
        }
      }

      // Unsectioned items
      const unsectioned = sections.find(s => s.id === 'unsectioned');
      if (unsectioned) {
        for (const item of unsectioned.items) {
          await supabase
            .from('offer_items')
            .insert({
              offer_id: newOffer.id,
              section_id: null,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              sort_order: item.sort_order,
              is_optional: item.is_optional,
              source_resource_id: item.source_resource_id
            });
        }
      }

      await loadData();
      setShowCreateModal(false);
      resetOfferForm();
    } catch (err) {
      console.error('Error creating offer:', err);
    } finally {
      setSavingOffer(false);
    }
  };

  const handleUpdateOffer = async () => {
    if (!currentUser || !selectedOffer) return;
    setSavingOffer(true);
    try {
      // Update offer
      await supabase
        .from('offers')
        .update({
          name: offerData.name.trim(),
          project_id: offerData.project_id || null,
          client_id: offerData.client_id || null,
          valid_until: offerData.valid_until || null,
          discount_percent: offerData.discount_percent,
          discount_amount: offerData.discount_amount,
          notes: offerData.notes,
          internal_notes: offerData.internal_notes
        })
        .eq('id', selectedOffer.id);

      // Delete existing sections and items (will re-create)
      await supabase.from('offer_sections').delete().eq('offer_id', selectedOffer.id);
      await supabase.from('offer_items').delete().eq('offer_id', selectedOffer.id);

      // Re-create sections and items
      for (const section of sections.filter(s => s.id !== 'unsectioned')) {
        const { data: newSection } = await supabase
          .from('offer_sections')
          .insert({
            offer_id: selectedOffer.id,
            name: section.name,
            description: section.description,
            sort_order: section.sort_order
          })
          .select()
          .single();

        if (newSection) {
          for (const item of section.items) {
            await supabase
              .from('offer_items')
              .insert({
                offer_id: selectedOffer.id,
                section_id: newSection.id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                sort_order: item.sort_order,
                is_optional: item.is_optional,
                source_resource_id: item.source_resource_id
              });
          }
        }
      }

      // Unsectioned items
      const unsectioned = sections.find(s => s.id === 'unsectioned');
      if (unsectioned) {
        for (const item of unsectioned.items) {
          await supabase
            .from('offer_items')
            .insert({
              offer_id: selectedOffer.id,
              section_id: null,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              sort_order: item.sort_order,
              is_optional: item.is_optional,
              source_resource_id: item.source_resource_id
            });
        }
      }

      await loadData();
      setEditMode(false);
      await loadOfferDetails(selectedOffer.id);
    } catch (err) {
      console.error('Error updating offer:', err);
    } finally {
      setSavingOffer(false);
    }
  };

  const handleDeleteOffer = async (offer: Offer) => {
    if (!confirm('Czy na pewno chcesz usunąć tę ofertę?')) return;
    try {
      await supabase
        .from('offers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', offer.id);
      await loadData();
      if (selectedOffer?.id === offer.id) {
        setSelectedOffer(null);
      }
    } catch (err) {
      console.error('Error deleting offer:', err);
    }
  };

  const handleOpenEditOffer = (offer: Offer) => {
    setEditingOffer(offer);
    setEditForm({
      name: offer.name || '',
      project_id: (offer as any).project?.id || offer.project_id || '',
      client_id: (offer as any).client?.id || offer.client_id || '',
      valid_until: offer.valid_until ? offer.valid_until.split('T')[0] : '',
      notes: offer.notes || ''
    });
    // Pre-populate client data from the offer's client
    const client = (offer as any).client;
    if (client) {
      setOfferClientData(prev => ({
        ...prev,
        client_name: client.name || '',
        nip: client.nip || '',
        company_street: client.address_street || '',
        company_street_number: client.address_street_number || '',
        company_city: client.address_city || '',
        company_postal_code: client.address_postal_code || '',
        internal_notes: offer.notes || ''
      }));
    } else {
      resetOfferClientData();
    }
    setShowEditModal(true);
  };

  const handleSaveEditOffer = async () => {
    if (!editingOffer || !currentUser) return;
    setSavingOffer(true);
    try {
      await supabase
        .from('offers')
        .update({
          name: editForm.name.trim(),
          project_id: editForm.project_id || null,
          client_id: editForm.client_id || null,
          valid_until: editForm.valid_until || null,
          notes: editForm.notes || null
        })
        .eq('id', editingOffer.id);
      await loadData();
      setShowEditModal(false);
      setEditingOffer(null);
    } catch (err) {
      console.error('Error updating offer:', err);
    } finally {
      setSavingOffer(false);
    }
  };

  const handleSendOffer = async (offer: Offer) => {
    if (!currentUser) return;
    if (!confirm('Czy na pewno chcesz wysłać tę ofertę? Status zmieni się na "Wysłana".')) return;
    try {
      const { error } = await supabase
        .from('offers')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', offer.id);

      if (!error) {
        await loadData();
        if (selectedOffer?.id === offer.id) {
          await loadOfferDetails(offer.id);
        }
      }
    } catch (err) {
      console.error('Error sending offer:', err);
    }
  };

  const handleAcceptOffer = async (offer: Offer) => {
    try {
      await supabase
        .from('offers')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', offer.id);
      await loadData();
      if (selectedOffer?.id === offer.id) {
        await loadOfferDetails(offer.id);
      }
    } catch (err) {
      console.error('Error accepting offer:', err);
    }
  };

  const handleRejectOffer = async (offer: Offer) => {
    const reason = prompt('Podaj powód odrzucenia (opcjonalnie):');
    try {
      await supabase
        .from('offers')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          internal_notes: offer.internal_notes
            ? `${offer.internal_notes}\n\nPowód odrzucenia: ${reason || 'Brak'}`
            : `Powód odrzucenia: ${reason || 'Brak'}`
        })
        .eq('id', offer.id);
      await loadData();
      if (selectedOffer?.id === offer.id) {
        await loadOfferDetails(offer.id);
      }
    } catch (err) {
      console.error('Error rejecting offer:', err);
    }
  };

  const copyPublicLink = (offer: Offer) => {
    if (offer.public_url) {
      navigator.clipboard.writeText(window.location.origin + offer.public_url);
      alert('Link skopiowany do schowka!');
    }
  };

  // ============================================
  // IMPORT FROM ESTIMATE
  // ============================================
  const handleImportFromEstimate = async () => {
    if (!selectedEstimateId || !currentUser) return;
    setImportLoading(true);
    try {
      // First get the estimate to find the project_id
      const { data: estimate } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', selectedEstimateId)
        .single();

      if (!estimate) {
        alert('Nie znaleziono kosztorysu');
        setImportLoading(false);
        return;
      }

      // Load stages, tasks, resources using project_id (as Estimates module saves them)
      const [stagesRes, tasksRes, resourcesRes] = await Promise.all([
        supabase
          .from('estimate_stages')
          .select('*')
          .eq('project_id', estimate.project_id)
          .order('sort_order'),
        supabase
          .from('estimate_tasks')
          .select('*')
          .eq('project_id', estimate.project_id)
          .order('sort_order'),
        supabase
          .from('estimate_resources')
          .select('*')
          .eq('project_id', estimate.project_id)
          .order('sort_order')
      ]);

      const stages = stagesRes.data || [];
      const tasks = tasksRes.data || [];
      const resources = resourcesRes.data || [];

      // Set offer data from estimate
      setOfferData(prev => ({
        ...prev,
        name: `Oferta - ${estimate.name}`,
        project_id: estimate.project_id || '',
        notes: estimate.notes || ''
      }));

      // Build sections from stages
      const newSections: LocalOfferSection[] = stages.map((stage, sIndex) => {
        // Get tasks for this stage
        const stageTasks = tasks.filter((t: EstimateTask) => t.stage_id === stage.id);

        // Get all resources for this stage's tasks
        const stageItems: LocalOfferItem[] = [];
        stageTasks.forEach((task: EstimateTask) => {
          const taskResources = resources.filter((r: EstimateResource) => r.task_id === task.id);
          taskResources.forEach((resource: EstimateResource, rIndex: number) => {
            const qty = resource.volume || 1;
            const unitPrice = resource.price_with_markup || resource.price || 0;
            stageItems.push({
              id: `new-${stage.id}-${resource.id}`,
              offer_id: '',
              section_id: stage.id,
              source_resource_id: resource.id,
              name: resource.name,
              description: `${task.name}`,
              quantity: qty,
              unit_price: unitPrice,
              total_price: qty * unitPrice,
              sort_order: rIndex,
              is_optional: false,
              created_at: '',
              updated_at: '',
              isNew: true
            });
          });
        });

        return {
          id: `new-section-${sIndex}`,
          offer_id: '',
          name: stage.name,
          description: stage.description || '',
          sort_order: sIndex,
          created_at: '',
          updated_at: '',
          isExpanded: true,
          items: stageItems
        };
      });

      // Add resources without stage/task
      const unsectionedResources = resources.filter((r: EstimateResource) => !r.task_id);
      if (unsectionedResources.length > 0) {
        newSections.unshift({
          id: 'unsectioned',
          offer_id: '',
          name: 'Inne pozycje',
          description: '',
          sort_order: -1,
          created_at: '',
          updated_at: '',
          isExpanded: true,
          items: unsectionedResources.map((r: EstimateResource, i: number) => {
            const qty = r.volume || 1;
            const unitPrice = r.price_with_markup || r.price || 0;
            return {
              id: `new-unsectioned-${r.id}`,
              offer_id: '',
              section_id: undefined,
              source_resource_id: r.id,
              name: r.name,
              description: '',
              quantity: qty,
              unit_price: unitPrice,
              total_price: qty * unitPrice,
              sort_order: i,
              is_optional: false,
              created_at: '',
              updated_at: '',
              isNew: true
            };
          })
        });
      }

      setSections(newSections);
      setShowImportFromEstimate(false);
      setSelectedEstimateId('');
    } catch (err) {
      console.error('Error importing from estimate:', err);
      alert('Błąd podczas importu z kosztorysu');
    } finally {
      setImportLoading(false);
    }
  };

  // Import from Kosztorys module (ElektroSmeta)
  const handleImportFromKosztorys = async () => {
    if (!selectedKosztorysId || !currentUser) return;
    setImportLoading(true);
    try {
      const { convertEstimateToOfferData } = await import('../../lib/proposalGenerator');
      const result = await convertEstimateToOfferData(selectedKosztorysId);

      if (!result) {
        alert('Nie można załadować danych z kosztorysu');
        setImportLoading(false);
        return;
      }

      setOfferData(prev => ({
        ...prev,
        ...result.offerData
      }));
      setSections(result.sections);
      setShowImportFromEstimate(false);
      setSelectedKosztorysId('');
      setImportSource('kosztorys');
    } catch (err) {
      console.error('Error importing from kosztorys:', err);
      alert('Błąd podczas importu z modułu kosztorysowania');
    } finally {
      setImportLoading(false);
    }
  };

  // ============================================
  // SECTION & ITEM MANAGEMENT
  // ============================================
  const addSection = () => {
    const newSection: LocalOfferSection = {
      id: `new-section-${Date.now()}`,
      offer_id: '',
      name: 'Nowa sekcja',
      description: '',
      sort_order: sections.length,
      created_at: '',
      updated_at: '',
      isExpanded: true,
      items: []
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (sectionId: string, updates: Partial<LocalOfferSection>) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, ...updates } : s));
  };

  const deleteSection = (sectionId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę sekcję wraz z pozycjami?')) return;
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const addItem = (sectionId: string) => {
    const newItem: LocalOfferItem = {
      id: `new-item-${Date.now()}`,
      offer_id: '',
      section_id: sectionId === 'unsectioned' ? undefined : sectionId,
      name: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      sort_order: 0,
      is_optional: false,
      created_at: '',
      updated_at: '',
      isEditing: true,
      isNew: true
    };
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, items: [...s.items, newItem] };
      }
      return s;
    }));
  };

  const updateItem = (sectionId: string, itemId: string, updates: Partial<LocalOfferItem>) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          items: s.items.map(i => {
            if (i.id === itemId) {
              const updated = { ...i, ...updates };
              updated.total_price = updated.quantity * updated.unit_price;
              return updated;
            }
            return i;
          })
        };
      }
      return s;
    }));
  };

  const deleteItem = (sectionId: string, itemId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, items: s.items.filter(i => i.id !== itemId) };
      }
      return s;
    }));
  };

  const resetOfferForm = () => {
    setOfferData({
      name: '',
      project_id: '',
      client_id: '',
      valid_until: '',
      discount_percent: 0,
      discount_amount: 0,
      notes: '',
      internal_notes: ''
    });
    setSections([]);
    setSelectedEstimateId('');
    resetOfferClientData();
  };

  // ============================================
  // EXPORT
  // ============================================
  const exportToCSV = () => {
    if (!selectedOffer) return;
    const rows: string[] = [];
    rows.push(['Sekcja', 'Pozycja', 'Opis', 'Ilość', 'Cena jedn.', 'Wartość', 'Opcjonalna'].join(';'));

    sections.forEach(section => {
      section.items.forEach(item => {
        rows.push([
          section.name,
          item.name,
          item.description || '',
          item.quantity.toString().replace('.', ','),
          item.unit_price.toFixed(2).replace('.', ','),
          item.total_price.toFixed(2).replace('.', ','),
          item.is_optional ? 'Tak' : 'Nie'
        ].join(';'));
      });
    });

    rows.push('');
    rows.push(['', '', '', '', 'Suma:', totals.total.toFixed(2).replace('.', ','), ''].join(';'));
    rows.push(['', '', '', '', 'Rabat %:', totals.discountPct.toFixed(2).replace('.', ','), ''].join(';'));
    rows.push(['', '', '', '', 'Rabat kwota:', totals.discountFixed.toFixed(2).replace('.', ','), ''].join(';'));
    rows.push(['', '', '', '', 'DO ZAPŁATY:', totals.final.toFixed(2).replace('.', ','), ''].join(';'));

    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedOffer.number || 'oferta'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================
  // RENDER: CLIENT FORM (kosztorys-style, reusable)
  // ============================================
  const renderClientFormSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-slate-400" />
        Dane klienta
      </h3>

      {/* NIP with GUS button */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
          <input
            type="text"
            value={offerClientData.nip}
            onChange={e => {
              setOfferClientData(prev => ({ ...prev, nip: e.target.value }));
              setOfferGusError(null);
              setOfferGusSuccess(null);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="XXX-XXX-XX-XX"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleOfferFetchGus}
            disabled={offerGusLoading || !offerClientData.nip}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {offerGusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Pobierz z GUS
          </button>
        </div>
      </div>
      {offerGusError && <p className="text-sm text-red-600">{offerGusError}</p>}
      {offerGusSuccess && <p className="text-sm text-green-600">{offerGusSuccess}</p>}

      {/* Company name with autocomplete */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
          <input
            type="text"
            value={offerClientData.client_name}
            onChange={e => {
              setOfferClientData(prev => ({ ...prev, client_name: e.target.value }));
              setOfferClientSearchQuery(e.target.value);
            }}
            onFocus={() => {
              if (offerClientData.client_name.length >= 2) setOfferClientSearchQuery(offerClientData.client_name);
            }}
            onBlur={() => { setTimeout(() => setOfferShowClientDropdown(false), 200); }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Wyszukaj istniejącego lub wpisz nową nazwę..."
          />
          {offerShowClientDropdown && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {offerFilteredClients.length > 0 ? (
                <>
                  {offerFilteredClients.some(c => c.source === 'contractor') && (
                    <div className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 border-b">Kontrahenci z bazy</div>
                  )}
                  {offerFilteredClients.filter(c => c.source === 'contractor').map((client, i) => (
                    <button key={`c-${i}`} type="button" onClick={() => selectOfferExistingClient(client)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-slate-100 last:border-0">
                      <div className="font-medium text-slate-900">{client.client_name}</div>
                      <div className="text-xs text-slate-500 flex gap-2">
                        {client.nip && <span>NIP: {client.nip}</span>}
                        {client.company_city && <span>{client.company_city}</span>}
                      </div>
                    </button>
                  ))}
                  {offerFilteredClients.some(c => c.source === 'request_history') && (
                    <div className="px-3 py-2 text-xs font-semibold text-slate-400 bg-slate-50 border-b border-t">Z historii zapytań</div>
                  )}
                  {offerFilteredClients.filter(c => c.source === 'request_history').map((client, i) => (
                    <button key={`h-${i}`} type="button" onClick={() => selectOfferExistingClient(client)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-slate-100 last:border-0 opacity-75">
                      <div className="font-medium text-slate-900">{client.client_name}</div>
                      <div className="text-xs text-slate-500 flex gap-2">
                        {client.nip && <span>NIP: {client.nip}</span>}
                        {client.company_city && <span>{client.company_city}</span>}
                      </div>
                    </button>
                  ))}
                </>
              ) : offerClientSearchQuery.length >= 2 && (
                <div className="px-3 py-3 text-sm text-slate-500 text-center">
                  Nie znaleziono klienta. Możesz dodać nowego lub wyszukać w GUS.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Company address */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2 relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Ulica</label>
          <input
            type="text"
            value={offerClientData.company_street}
            onChange={e => handleOfferCompanyStreetChange(e.target.value)}
            onFocus={() => offerCompanyAddressSuggestions.length > 0 && setOfferShowCompanyAddressSuggestions(true)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="ul. Przykładowa"
          />
          {offerShowCompanyAddressSuggestions && offerCompanyAddressSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {offerCompanyAddressSuggestions.map((addr, i) => (
                <button key={i} type="button" onClick={() => selectOfferCompanyAddress(addr)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
                  <div className="font-medium">{addr.street} {addr.streetNumber}</div>
                  <div className="text-slate-500 text-xs">{addr.postalCode} {addr.city}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Numer</label>
          <input type="text" value={offerClientData.company_street_number}
            onChange={e => setOfferClientData(prev => ({ ...prev, company_street_number: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="12A" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Kod pocztowy</label>
          <input type="text" value={offerClientData.company_postal_code}
            onChange={e => setOfferClientData(prev => ({ ...prev, company_postal_code: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="00-000" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Miasto</label>
          <input type="text" value={offerClientData.company_city}
            onChange={e => setOfferClientData(prev => ({ ...prev, company_city: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Warszawa" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Źródło zapytania</label>
          <select value={offerClientData.request_source}
            onChange={e => setOfferClientData(prev => ({ ...prev, request_source: e.target.value as KosztorysRequestSource }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500">
            {Object.entries(OFFER_SOURCE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notatka wewnętrzna</label>
        <textarea value={offerClientData.internal_notes}
          onChange={e => setOfferClientData(prev => ({ ...prev, internal_notes: e.target.value }))}
          rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Notatki widoczne tylko dla zespołu..." />
      </div>
    </div>
  );

  // ============================================
  // RENDER: CREATE MODAL
  // ============================================
  const renderCreateModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Nowa oferta</h2>
          <button onClick={() => { setShowCreateModal(false); resetOfferForm(); }} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* 1. Client (kosztorys-style) — FIRST, like in kosztorys */}
          {renderClientFormSection()}

          {/* 2. Offer details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Dane oferty
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa oferty *</label>
                <input
                  type="text"
                  value={offerData.name}
                  onChange={e => setOfferData({ ...offerData, name: e.target.value })}
                  placeholder="np. Oferta na instalację elektryczną"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                <select
                  value={offerData.project_id}
                  onChange={e => setOfferData({ ...offerData, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Wybierz projekt --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ważna do</label>
                <input
                  type="date"
                  value={offerData.valid_until}
                  onChange={e => setOfferData({ ...offerData, valid_until: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Import from estimate */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">Importuj pozycje z kosztorysu</span>
              </div>
              <button
                onClick={() => setShowImportFromEstimate(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
              >
                Wybierz kosztorys
              </button>
            </div>
          </div>

          {/* Sections & Items */}
          <div className="border border-slate-200 rounded-lg">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-medium text-slate-900">Sekcje i pozycje</h3>
              <button
                onClick={addSection}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-white border border-slate-200 rounded hover:bg-slate-50"
              >
                <FolderPlus className="w-4 h-4" />
                Dodaj sekcję
              </button>
            </div>

            {sections.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Brak pozycji. Dodaj sekcję lub zaimportuj z kosztorysu.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {sections.map(section => (
                  <div key={section.id} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => updateSection(section.id, { isExpanded: !section.isExpanded })}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        {section.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <input
                        type="text"
                        value={section.name}
                        onChange={e => updateSection(section.id, { name: e.target.value })}
                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm font-medium"
                      />
                      <span className="text-sm text-slate-500">{section.items.length} poz.</span>
                      <button
                        onClick={() => addItem(section.id)}
                        className="p-1 hover:bg-slate-100 rounded text-blue-600"
                        title="Dodaj pozycję"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteSection(section.id)}
                        className="p-1 hover:bg-red-50 rounded text-red-600"
                        title="Usuń sekcję"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {section.isExpanded && section.items.length > 0 && (
                      <div className="ml-6 space-y-1">
                        <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 font-medium px-2">
                          <div className="col-span-5">Nazwa</div>
                          <div className="col-span-2 text-right">Ilość</div>
                          <div className="col-span-2 text-right">Cena jedn.</div>
                          <div className="col-span-2 text-right">Wartość</div>
                          <div className="col-span-1"></div>
                        </div>
                        {section.items.map(item => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 items-center text-sm bg-slate-50 rounded px-2 py-1">
                            <div className="col-span-5">
                              <input
                                type="text"
                                value={item.name}
                                onChange={e => updateItem(section.id, item.id, { name: e.target.value })}
                                placeholder="Nazwa pozycji"
                                className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={e => updateItem(section.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-right"
                                step="0.01"
                              />
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                value={item.unit_price}
                                onChange={e => updateItem(section.id, item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-right"
                                step="0.01"
                              />
                            </div>
                            <div className="col-span-2 text-right font-medium text-slate-900">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button
                                onClick={() => deleteItem(section.id, item.id)}
                                className="p-1 hover:bg-red-50 rounded text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Discounts & Totals */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Percent className="w-5 h-5 text-slate-400" />
              Rabaty i podsumowanie
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rabat procentowy (%)</label>
                <input
                  type="number"
                  value={offerData.discount_percent}
                  onChange={e => setOfferData({ ...offerData, discount_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rabat kwotowy (PLN)</label>
                <input
                  type="number"
                  value={offerData.discount_amount}
                  onChange={e => setOfferData({ ...offerData, discount_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-600">Suma pozycji:</span>
                <span className="font-medium">{formatCurrency(totals.total)}</span>
              </div>
              {(offerData.discount_percent > 0 || offerData.discount_amount > 0) && (
                <>
                  {offerData.discount_percent > 0 && (
                    <div className="flex justify-between items-center mb-2 text-red-600">
                      <span>Rabat {offerData.discount_percent}%:</span>
                      <span>-{formatCurrency(totals.discountPct)}</span>
                    </div>
                  )}
                  {offerData.discount_amount > 0 && (
                    <div className="flex justify-between items-center mb-2 text-red-600">
                      <span>Rabat kwotowy:</span>
                      <span>-{formatCurrency(totals.discountFixed)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-lg font-semibold text-slate-900">Do zapłaty:</span>
                <span className="text-xl font-bold text-blue-600">{formatCurrency(totals.final)}</span>
              </div>
            </div>
          </div>

          {/* 6. Notes */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              Notatki
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Uwagi dla klienta</label>
                <textarea
                  value={offerData.notes}
                  onChange={e => setOfferData({ ...offerData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Widoczne dla klienta..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notatki wewnętrzne</label>
                <textarea
                  value={offerData.internal_notes}
                  onChange={e => setOfferData({ ...offerData, internal_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Widoczne tylko dla zespołu..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={() => { setShowCreateModal(false); resetOfferForm(); }}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Anuluj
          </button>
          <button
            onClick={handleCreateOffer}
            disabled={!offerData.name.trim() || savingOffer}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {savingOffer && <Loader2 className="w-4 h-4 animate-spin" />}
            Utwórz i przejdź do formularza
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER: IMPORT FROM ESTIMATE MODAL
  // ============================================
  const renderImportFromEstimateModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Importuj z kosztorysu</h2>
          <button onClick={() => setShowImportFromEstimate(false)} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setImportSource('kosztorys')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              importSource === 'kosztorys'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Kosztorysowanie (ElektroSmeta)
          </button>
          <button
            onClick={() => setImportSource('estimates')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              importSource === 'estimates'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Kosztorysy (Stare)
          </button>
        </div>

        <div className="p-4">
          {importSource === 'kosztorys' ? (
            // Kosztorysowanie module (ElektroSmeta)
            kosztorysEstimates.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Brak zatwierdzonych kosztorysów.</p>
                <p className="text-sm mt-1">Najpierw zatwierdź kosztorys w module Kosztorysowanie.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {kosztorysEstimates.map(est => (
                  <label
                    key={est.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      selectedKosztorysId === est.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="kosztorys"
                      checked={selectedKosztorysId === est.id}
                      onChange={() => setSelectedKosztorysId(est.id)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        {est.request?.investment_name || 'Kosztorys'} v{est.version}
                      </p>
                      <p className="text-sm text-slate-500">
                        {est.request?.client_name || 'Klient'} • {formatCurrency(est.final_total || est.grand_total || 0)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      est.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {est.status === 'approved' ? 'Zatwierdzony' : 'Wysłany'}
                    </span>
                  </label>
                ))}
              </div>
            )
          ) : (
            // Old estimates module
            estimates.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Brak dostępnych kosztorysów.</p>
                <p className="text-sm mt-1">Najpierw utwórz kosztorys w module Kosztorysowanie.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {estimates.map(est => (
                  <label
                    key={est.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      selectedEstimateId === est.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="estimate"
                      checked={selectedEstimateId === est.id}
                      onChange={() => setSelectedEstimateId(est.id)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{est.name}</p>
                      <p className="text-sm text-slate-500">
                        {est.number} • {(est as any).project?.name || 'Bez projektu'} • {formatCurrency(est.total_cost)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )
          )}
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={() => setShowImportFromEstimate(false)}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={importSource === 'kosztorys' ? handleImportFromKosztorys : handleImportFromEstimate}
            disabled={(importSource === 'kosztorys' ? !selectedKosztorysId : !selectedEstimateId) || importLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Importuj
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER: OFFER DETAIL VIEW
  // ============================================
  const renderOfferDetail = () => {
    if (!selectedOffer) return null;

    return (
      <div className="p-6">
        <button
          onClick={() => { setSelectedOffer(null); setEditMode(false); }}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Powrót do listy
        </button>

        <div className="bg-white rounded-xl border border-slate-200">
          {/* Header */}
          <div className="p-6 border-b border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                {editMode ? (
                  <input
                    type="text"
                    value={offerData.name}
                    onChange={e => setOfferData({ ...offerData, name: e.target.value })}
                    className="text-2xl font-bold text-slate-900 px-2 py-1 border border-slate-200 rounded-lg"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-slate-900">{selectedOffer.name}</h1>
                )}
                <p className="text-slate-500 mt-1">
                  {selectedOffer.number || 'Brak numeru'} • Utworzono {formatDate(selectedOffer.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedOffer.status} />
                {selectedOffer.status === 'draft' && (
                  <div className="flex gap-2">
                    {!editMode ? (
                      <>
                        <button
                          onClick={() => setEditMode(true)}
                          className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm"
                        >
                          <Pencil className="w-4 h-4" />
                          Edytuj
                        </button>
                        <button
                          onClick={() => handleSendOffer(selectedOffer)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          <Send className="w-4 h-4" />
                          Wyślij
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditMode(false); loadOfferDetails(selectedOffer.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm"
                        >
                          <X className="w-4 h-4" />
                          Anuluj
                        </button>
                        <button
                          onClick={handleUpdateOffer}
                          disabled={savingOffer}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          {savingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Zapisz
                        </button>
                      </>
                    )}
                  </div>
                )}
                {selectedOffer.status === 'sent' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptOffer(selectedOffer)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Akceptuj
                    </button>
                    <button
                      onClick={() => handleRejectOffer(selectedOffer)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      Odrzuć
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-slate-200">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Klient</p>
              {editMode ? (
                <select
                  value={offerData.client_id}
                  onChange={e => setOfferData({ ...offerData, client_id: e.target.value })}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                >
                  <option value="">-- Wybierz --</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <p className="font-medium text-slate-900">
                  {(selectedOffer as any).client?.name || 'Nie przypisano'}
                </p>
              )}
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Projekt</p>
              {editMode ? (
                <select
                  value={offerData.project_id}
                  onChange={e => setOfferData({ ...offerData, project_id: e.target.value })}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                >
                  <option value="">-- Wybierz --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <p className="font-medium text-slate-900">
                  {(selectedOffer as any).project?.name || 'Nie przypisano'}
                </p>
              )}
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Ważność</p>
              {editMode ? (
                <input
                  type="date"
                  value={offerData.valid_until}
                  onChange={e => setOfferData({ ...offerData, valid_until: e.target.value })}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                />
              ) : (
                <p className="font-medium text-slate-900">{formatDate(selectedOffer.valid_until)}</p>
              )}
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Wyświetlenia</p>
              <p className="font-medium text-slate-900">{selectedOffer.viewed_count}</p>
            </div>
          </div>

          {/* Sections & Items */}
          <div className="p-6 border-b border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Pozycje oferty</h2>
              <div className="flex gap-2">
                {editMode && (
                  <button
                    onClick={addSection}
                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Dodaj sekcję
                  </button>
                )}
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Eksport CSV
                </button>
              </div>
            </div>

            {sections.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Brak pozycji w ofercie</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map(section => (
                  <div key={section.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-200">
                      <button
                        onClick={() => updateSection(section.id, { isExpanded: !section.isExpanded })}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        {section.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {editMode ? (
                        <input
                          type="text"
                          value={section.name}
                          onChange={e => updateSection(section.id, { name: e.target.value })}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm font-medium"
                        />
                      ) : (
                        <span className="flex-1 font-medium text-slate-900">{section.name}</span>
                      )}
                      <span className="text-sm text-slate-500 mr-2">
                        {formatCurrency(section.items.reduce((s, i) => s + i.quantity * i.unit_price, 0))}
                      </span>
                      {editMode && (
                        <>
                          <button
                            onClick={() => addItem(section.id)}
                            className="p-1 hover:bg-slate-200 rounded text-blue-600"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSection(section.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    {section.isExpanded && (
                      <div className="divide-y divide-slate-100">
                        {section.items.length === 0 ? (
                          <div className="p-4 text-center text-slate-500 text-sm">
                            Brak pozycji w tej sekcji
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-slate-500 font-medium bg-slate-50/50">
                              <div className="col-span-5">Nazwa</div>
                              <div className="col-span-2 text-right">Ilość</div>
                              <div className="col-span-2 text-right">Cena jedn.</div>
                              <div className="col-span-2 text-right">Wartość</div>
                              {editMode && <div className="col-span-1"></div>}
                            </div>
                            {section.items.map(item => (
                              <div key={item.id} className={`grid grid-cols-12 gap-2 px-4 py-2 items-center text-sm ${item.is_optional ? 'bg-yellow-50' : ''}`}>
                                <div className="col-span-5">
                                  {editMode ? (
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={e => updateItem(section.id, item.id, { name: e.target.value })}
                                      className="w-full px-2 py-1 border border-slate-200 rounded"
                                    />
                                  ) : (
                                    <div>
                                      <p className="font-medium text-slate-900">{item.name}</p>
                                      {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                                    </div>
                                  )}
                                </div>
                                <div className="col-span-2 text-right">
                                  {editMode ? (
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={e => updateItem(section.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                      className="w-full px-2 py-1 border border-slate-200 rounded text-right"
                                      step="0.01"
                                    />
                                  ) : (
                                    <span>{item.quantity}</span>
                                  )}
                                </div>
                                <div className="col-span-2 text-right">
                                  {editMode ? (
                                    <input
                                      type="number"
                                      value={item.unit_price}
                                      onChange={e => updateItem(section.id, item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                                      className="w-full px-2 py-1 border border-slate-200 rounded text-right"
                                      step="0.01"
                                    />
                                  ) : (
                                    <span>{formatCurrency(item.unit_price)}</span>
                                  )}
                                </div>
                                <div className="col-span-2 text-right font-medium text-slate-900">
                                  {formatCurrency(item.quantity * item.unit_price)}
                                </div>
                                {editMode && (
                                  <div className="col-span-1 flex justify-end">
                                    <button
                                      onClick={() => deleteItem(section.id, item.id)}
                                      className="p-1 hover:bg-red-50 rounded text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial summary */}
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Podsumowanie finansowe</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {editMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">Rabat procentowy (%)</label>
                      <input
                        type="number"
                        value={offerData.discount_percent}
                        onChange={e => setOfferData({ ...offerData, discount_percent: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">Rabat kwotowy (PLN)</label>
                      <input
                        type="number"
                        value={offerData.discount_amount}
                        onChange={e => setOfferData({ ...offerData, discount_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Suma pozycji:</span>
                  <span className="font-medium">{formatCurrency(totals.total)}</span>
                </div>
                {(editMode ? offerData.discount_percent : selectedOffer.discount_percent) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Rabat {editMode ? offerData.discount_percent : selectedOffer.discount_percent}%:</span>
                    <span>-{formatCurrency(totals.discountPct)}</span>
                  </div>
                )}
                {(editMode ? offerData.discount_amount : selectedOffer.discount_amount) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Rabat kwotowy:</span>
                    <span>-{formatCurrency(totals.discountFixed)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-lg font-semibold">Do zapłaty:</span>
                  <span className="text-xl font-bold text-blue-600">{formatCurrency(editMode ? totals.final : selectedOffer.final_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Public link */}
          {selectedOffer.public_url && (
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Link publiczny</h2>
              <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                <LinkIcon className="w-5 h-5 text-blue-600" />
                <input
                  type="text"
                  readOnly
                  value={window.location.origin + selectedOffer.public_url}
                  className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm"
                />
                <button
                  onClick={() => copyPublicLink(selectedOffer)}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Copy className="w-4 h-4" />
                  Kopiuj
                </button>
                <a
                  href={selectedOffer.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  Otwórz
                </a>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-slate-900 mb-2">Uwagi dla klienta</h3>
                {editMode ? (
                  <textarea
                    value={offerData.notes}
                    onChange={e => setOfferData({ ...offerData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                ) : (
                  <p className="text-slate-600 whitespace-pre-wrap">{selectedOffer.notes || '-'}</p>
                )}
              </div>
              <div>
                <h3 className="font-medium text-slate-900 mb-2">Notatki wewnętrzne</h3>
                {editMode ? (
                  <textarea
                    value={offerData.internal_notes}
                    onChange={e => setOfferData({ ...offerData, internal_notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                ) : (
                  <p className="text-slate-600 whitespace-pre-wrap">{selectedOffer.internal_notes || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <button
              onClick={() => handleDeleteOffer(selectedOffer)}
              className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Usuń ofertę
            </button>
            <div className="text-sm text-slate-500">
              Ostatnia aktualizacja: {formatDate(selectedOffer.updated_at)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER: LIST VIEW
  // ============================================
  const renderListView = () => (
    <div className="p-6">
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => { resetOfferForm(); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Nowa oferta
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{offers.filter(o => o.status === 'draft').length}</p>
              <p className="text-sm text-slate-500">Wersje robocze</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{offers.filter(o => o.status === 'sent').length}</p>
              <p className="text-sm text-slate-500">Wysłane</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{offers.filter(o => o.status === 'accepted').length}</p>
              <p className="text-sm text-slate-500">Zaakceptowane</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{offers.filter(o => o.status === 'rejected').length}</p>
              <p className="text-sm text-slate-500">Odrzucone</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & List */}
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
            <button
              onClick={() => { resetOfferForm(); setShowCreateModal(true); }}
              className="mt-4 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
            >
              Utwórz pierwszą ofertę
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nr</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nazwa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Klient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Kwota</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ważna do</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOffers.map(offer => (
                <tr
                  key={offer.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => { setSelectedOffer(offer); loadOfferDetails(offer.id); }}
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{offer.number || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{offer.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{(offer as any).client?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={offer.status} />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">
                    {formatCurrency(offer.final_amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {offer.valid_until ? formatDate(offer.valid_until) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenEditOffer(offer)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edytuj"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteOffer(offer)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Usuń"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <>
      {selectedOffer ? renderOfferDetail() : renderListView()}
      {showCreateModal && renderCreateModal()}
      {showImportFromEstimate && renderImportFromEstimateModal()}

      {/* Edit offer modal */}
      {showEditModal && editingOffer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Edytuj ofertę</h2>
              <button onClick={() => { setShowEditModal(false); setEditingOffer(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* 1. Client (kosztorys-style) — FIRST, like in kosztorys */}
              {renderClientFormSection()}

              {/* 2. Offer details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-400" />
                  Dane oferty
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa oferty *</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                    <select
                      value={editForm.project_id}
                      onChange={e => setEditForm({ ...editForm, project_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Wybierz projekt --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ważna do</label>
                    <input
                      type="date"
                      value={editForm.valid_until}
                      onChange={e => setEditForm({ ...editForm, valid_until: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowEditModal(false); setEditingOffer(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveEditOffer}
                disabled={savingOffer || !editForm.name.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingOffer && <Loader2 className="w-4 h-4 animate-spin" />}
                Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OffersPage;
