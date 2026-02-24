import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Loader2, X, ChevronRight,
  FolderOpen, Grid3X3, List, Package, AlertTriangle,
  ExternalLink, ChevronLeft, Truck, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ═══ Types ═══
interface RamirentCategory {
  name: string;
  slug: string;
  image?: string;
}

interface RamirentItem {
  name: string;
  slug: string;
  image?: string;
  code?: string;
}

interface RamirentGroupDetail {
  title: string;
  code?: string;
  description?: string;
  image?: string;
  images?: string[];
  brand?: string;
  priceBrutto?: number | null;
  priceNetto?: number | null;
  priceUnit?: string;
  available?: string;
  place?: string;
  contactOnly?: boolean;
  models?: Array<{ code: string; slug: string; name: string; image?: string; badge?: string }>;
  related?: Array<{ slug: string; name: string; image?: string }>;
  parameters?: Array<{ name: string; value: string }>;
  detailUrl?: string;
}

interface Props {
  integrationId?: string;
  onAddToOwnCatalog?: (product: { name: string; sku: string; ean?: string; ref_num?: string; price?: number | null; catalogPrice?: number | null; image?: string; manufacturer?: string; unit?: string; description?: string; url?: string; wholesaler: string; category?: string }) => void;
}

// ═══ Proxy helper ═══
async function ramirentProxy(action: string, params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('ramirent-proxy', {
    body: { action, ...params },
  });
  if (error) {
    let detail = '';
    try {
      if (error.context?.body) {
        const reader = error.context.body.getReader?.();
        if (reader) {
          const { value } = await reader.read();
          detail = new TextDecoder().decode(value);
        }
      }
    } catch { /* ignore */ }
    throw new Error(detail ? `${error.message}: ${detail}` : (error.message || 'Edge function error'));
  }
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  if (parsed?.error) throw new Error(parsed.error);
  return parsed;
}

const BASE = 'https://ramirent.pl';

// ═══ Category Node ═══
const CatNode: React.FC<{
  cat: RamirentCategory;
  selectedSlug: string | null;
  onPick: (cat: RamirentCategory) => void;
}> = ({ cat, selectedSlug, onPick }) => {
  const active = selectedSlug === cat.slug;
  return (
    <button
      onClick={() => onPick(cat)}
      className={`w-full text-left flex items-center gap-1.5 py-1.5 px-2.5 text-xs rounded transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700 font-semibold'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <FolderOpen className="w-3.5 h-3.5 opacity-40" />
      <span className="truncate">{cat.name}</span>
      {cat.image && <img src={cat.image} alt="" className="w-5 h-5 object-contain ml-auto" />}
    </button>
  );
};

// ═══ Product/Group Detail Modal ═══
const GroupDetail: React.FC<{
  slug: string;
  integrationId?: string;
  onClose: () => void;
  onAddToOwnCatalog?: Props['onAddToOwnCatalog'];
  onNavigate: (slug: string) => void;
}> = ({ slug, integrationId, onClose, onAddToOwnCatalog, onNavigate }) => {
  const [detail, setDetail] = useState<RamirentGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setError('Brak slugu'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    ramirentProxy('product', { integrationId, slug })
      .then(r => { setDetail(r.product); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [slug, integrationId]);

  if (loading) return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl p-12 text-center" onClick={e => e.stopPropagation()}>
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Ładowanie danych sprzętu...</p>
      </div>
    </div>
  );

  if (error || !detail) return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl p-8 text-center max-w-sm" onClick={e => e.stopPropagation()}>
        <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-600 mb-1">Błąd: {error || 'Nie znaleziono'}</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Zamknij</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">Ramirent</span>
            {detail.code && <span className="text-[10px] text-slate-400 font-mono">#{detail.code}</span>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap">
          {/* Image */}
          <div className="w-64 min-h-[220px] bg-slate-50 flex items-center justify-center p-4">
            {detail.image ? (
              <img src={detail.image} alt="" className="max-w-[90%] max-h-52 object-contain" />
            ) : detail.images && detail.images[0] ? (
              <img src={detail.images[0]} alt="" className="max-w-[90%] max-h-52 object-contain" />
            ) : (
              <Package className="w-14 h-14 text-slate-200" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-5 min-w-[260px]">
            <h2 className="text-base font-semibold text-slate-900 mb-2 leading-tight">{detail.title}</h2>
            {detail.brand && <p className="text-xs text-slate-500">Marka: <span className="font-medium text-slate-700">{detail.brand}</span></p>}

            {/* Price block */}
            <div className="mt-3 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              {detail.contactOnly ? (
                <>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena</div>
                  <div className="text-sm text-slate-500">Skontaktuj się po cenę</div>
                </>
              ) : (
                <>
                  {detail.priceNetto != null ? (
                    <>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena wynajmu netto</div>
                      <div className="text-xl font-bold text-blue-600">
                        {detail.priceNetto.toFixed(2)} <span className="text-sm font-normal">zł / {detail.priceUnit || 'Dzień'}</span>
                      </div>
                      {detail.priceBrutto != null && (
                        <div className="mt-1 text-xs text-slate-400">
                          Brutto: {detail.priceBrutto.toFixed(2)} zł / {detail.priceUnit || 'Dzień'}
                        </div>
                      )}
                    </>
                  ) : detail.priceBrutto != null ? (
                    <>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena wynajmu brutto</div>
                      <div className="text-xl font-bold text-blue-600">
                        {detail.priceBrutto.toFixed(2)} <span className="text-sm font-normal">zł / {detail.priceUnit || 'Dzień'}</span>
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </div>

            {/* Availability */}
            {detail.available && (
              <div className="flex items-center gap-1.5 mb-3">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${
                  detail.available.toLowerCase().includes('dostępn') ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${detail.available.toLowerCase().includes('dostępn') ? 'bg-green-500' : 'bg-slate-400'}`} />
                  {detail.available}
                </span>
                {detail.place && <span className="text-[10px] text-slate-400">{detail.place}</span>}
              </div>
            )}

            {/* Open on site */}
            <a
              href={BASE + slug}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Otwórz na Ramirent.pl
            </a>

            {onAddToOwnCatalog && (
              <button
                onClick={() => {
                  onAddToOwnCatalog({
                    name: detail.title,
                    sku: detail.code || slug,
                    price: detail.priceNetto ?? detail.priceBrutto ?? null,
                    catalogPrice: detail.priceBrutto ?? null,
                    image: detail.image || detail.images?.[0],
                    manufacturer: detail.brand || undefined,
                    unit: detail.priceUnit || 'Dzień',
                    description: detail.description,
                    url: BASE + slug,
                    wholesaler: 'ramirent',
                  });
                  onClose();
                }}
                className="w-full py-2.5 mt-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" />
                Dodaj do katalogu Własnego
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {detail.description && (
          <div className="px-5 pb-3">
            <h4 className="text-xs font-semibold text-slate-600 mb-1.5">Opis</h4>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{detail.description}</p>
          </div>
        )}

        {/* Parameters */}
        {detail.parameters && detail.parameters.length > 0 && (
          <div className="px-5 pb-4">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Parametry techniczne</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {detail.parameters.map((p, i) => (
                <div key={i} className={`flex items-center text-xs ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                  <div className="w-1/2 px-3 py-2 text-slate-500 font-medium">{p.name}</div>
                  <div className="w-1/2 px-3 py-2 text-slate-700 font-semibold text-right">{p.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {detail.images && detail.images.length > 1 && (
          <div className="px-5 pb-4">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Galeria</h4>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {detail.images.map((img, i) => (
                <img key={i} src={img} alt="" className="w-20 h-20 object-contain bg-slate-50 rounded border border-slate-200 flex-shrink-0" />
              ))}
            </div>
          </div>
        )}

        {/* Related */}
        {detail.related && detail.related.length > 0 && (
          <div className="px-5 pb-4">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Powiązane produkty</h4>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {detail.related.map((r, i) => (
                <div
                  key={i}
                  onClick={() => { if (r.slug) { onClose(); onNavigate(r.slug); } }}
                  className="flex-shrink-0 w-28 bg-slate-50 rounded-lg border border-slate-200 p-2 text-center cursor-pointer hover:border-blue-400 transition-colors"
                >
                  {r.image ? <img src={r.image} alt="" className="w-16 h-16 object-contain mx-auto" /> : <Package className="w-8 h-8 text-slate-200 mx-auto" />}
                  <div className="text-[10px] text-slate-600 mt-1 line-clamp-2">{r.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══ Subcategory/Item Card ═══
const ItemCard: React.FC<{ item: RamirentItem; onClick: () => void }> = ({ item, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
  >
    <div className="h-28 bg-slate-50 flex items-center justify-center border-b border-slate-100">
      {item.image ? (
        <img src={item.image} alt="" className="max-w-[85%] max-h-24 object-contain" />
      ) : (
        <FolderOpen className="w-10 h-10 text-slate-200" />
      )}
    </div>
    <div className="p-2.5">
      <div className="text-xs font-medium text-slate-800 line-clamp-2 min-h-[32px]">{item.name}</div>
      {item.code && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.code}</div>}
    </div>
  </div>
);

// ═══ MAIN COMPONENT ═══
export const RamirentIntegrator: React.FC<Props> = ({ integrationId, onAddToOwnCatalog }) => {
  const [categories, setCategories] = useState<RamirentCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<RamirentCategory | null>(null);

  // Navigation
  const [navStack, setNavStack] = useState<Array<{ slug: string; name: string }>>([]);
  const [items, setItems] = useState<RamirentItem[]>([]);
  const [browseType, setBrowseType] = useState<'category' | 'group'>('category');
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseTitle, setBrowseTitle] = useState('');
  const [groupDetail, setGroupDetail] = useState<RamirentGroupDetail | null>(null);

  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState<RamirentItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [connectionError, setConnectionError] = useState('');

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load categories
  useEffect(() => {
    setCatLoading(true);
    ramirentProxy('categories', { integrationId })
      .then(data => { setCategories(data.categories || []); setCatLoading(false); })
      .catch(e => { setCatLoading(false); setConnectionError(e.message); });
  }, [integrationId]);

  // Browse a slug
  const browse = useCallback((slug: string) => {
    setBrowseLoading(true);
    setBrowseError(null);
    setGroupDetail(null);
    ramirentProxy('browse', { integrationId, slug })
      .then(data => {
        if (data.type === 'group') {
          const group = data.group;
          // If group has NO models (single product) — auto-open detail modal
          if (!group?.models || group.models.length === 0) {
            setDetailSlug(slug);
            setBrowseType('group');
            setGroupDetail(group);
            setItems([]);
            setBrowseTitle(group?.title || '');
          } else {
            // Group with models — show models grid
            setBrowseType('group');
            setGroupDetail(group);
            setItems(group.models || []);
            setBrowseTitle(group.title || '');
          }
        } else {
          // Category page
          setBrowseType('category');
          setItems(data.items || []);
          setBrowseTitle(data.title || '');
        }
        setBrowseLoading(false);
      })
      .catch(e => { setBrowseError(e.message); setBrowseLoading(false); });
  }, [integrationId]);

  // When category is selected
  useEffect(() => {
    if (!selectedCat) return;
    setNavStack([{ slug: selectedCat.slug, name: selectedCat.name }]);
    browse(selectedCat.slug);
  }, [selectedCat, browse]);

  // Navigate deeper
  const navigateTo = (slug: string, name?: string) => {
    setNavStack(prev => [...prev, { slug, name: name || slug }]);
    browse(slug);
  };

  // Go back
  const goBack = () => {
    if (navStack.length <= 1) return;
    const newStack = navStack.slice(0, -1);
    setNavStack(newStack);
    browse(newStack[newStack.length - 1].slug);
  };

  // Search
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResult(null); setSearchLoading(false); return; }
    setSearchLoading(true);
    ramirentProxy('search', { integrationId, q: q.trim() })
      .then(r => { setSearchResult(r.products || []); setSearchLoading(false); })
      .catch(() => { setSearchResult([]); setSearchLoading(false); });
  }, [integrationId]);

  const onSearchChange = (v: string) => {
    setSearch(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (v.length >= 2) {
      setSearchLoading(true);
      searchRef.current = setTimeout(() => doSearch(v), 400);
    } else {
      setSearchResult(null);
      setSearchLoading(false);
    }
  };

  const isLoading = searchLoading || browseLoading;
  const hasContent = selectedCat || searchResult !== null;

  if (connectionError && categories.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-10 h-10 text-blue-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700 mb-2">Nie udało się połączyć z Ramirent</h3>
        <p className="text-sm text-slate-500 mb-4">{connectionError}</p>
      </div>
    );
  }

  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
        <div className="px-3 py-2.5 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-blue-600" />
          Kategorie Ramirent
        </div>
        {catLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">Nie udało się załadować kategorii.</div>
        ) : (
          <div className="py-1">
            {categories.map((c, i) => (
              <CatNode
                key={c.slug || i}
                cat={c}
                selectedSlug={selectedCat?.slug || null}
                onPick={cat => { setSelectedCat(cat); setSearch(''); setSearchResult(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 bg-white">
          <div className="flex-1 max-w-md flex items-center rounded-lg px-3 border bg-slate-100 border-slate-200">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(search)}
              placeholder="Szukaj w Ramirent..."
              className="flex-1 bg-transparent border-none px-2.5 py-2 text-sm outline-none placeholder-slate-400 text-slate-700"
            />
            {searchLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-1" />}
            {search && (
              <button onClick={() => { setSearch(''); setSearchResult(null); setSearchLoading(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-1 bg-slate-100 rounded p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        {navStack.length > 1 && !searchResult && (
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1 text-xs text-slate-500 bg-slate-50">
            <button onClick={goBack} className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
              <ChevronLeft className="w-3.5 h-3.5" /> Wstecz
            </button>
            <span className="mx-1 text-slate-300">|</span>
            {navStack.map((n, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                <span className={i === navStack.length - 1 ? 'font-medium text-slate-700' : 'text-slate-400'}>{n.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Group detail bar (when browsing a group page) */}
        {groupDetail && !searchResult && browseType === 'group' && (
          <div className="px-4 py-3 border-b border-slate-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{groupDetail.title}</h3>
                {groupDetail.description && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{groupDetail.description}</p>}
              </div>
              <div className="flex items-center gap-3">
                {groupDetail.priceBrutto != null && (
                  <span className="text-sm font-bold text-blue-600">
                    od {groupDetail.priceBrutto.toFixed(2)} zł/{groupDetail.priceUnit || 'Dzień'}
                  </span>
                )}
                <button
                  onClick={() => setDetailSlug(navStack[navStack.length - 1]?.slug || null)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Szczegóły
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasContent ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Truck className="w-12 h-12 text-slate-200 mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">Katalog sprzętu Ramirent</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Wybierz kategorię z listy po lewej, aby przeglądać dostępny sprzęt do wynajmu.
              </p>
              {categories.length > 0 && (
                <div className="mt-6 w-full max-w-lg">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Kategorie</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {categories.slice(0, 10).map((c, i) => (
                      <button
                        key={c.slug || i}
                        onClick={() => setSelectedCat(c)}
                        className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span className="text-sm text-slate-500">Ładowanie...</span>
            </div>
          ) : browseError ? (
            <div className="text-center py-8 bg-white rounded-lg border border-slate-200">
              <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600">{browseError}</p>
            </div>
          ) : searchResult !== null ? (
            <>
              <p className="text-xs text-slate-400 mb-3">Wynik wyszukiwania «{search}»: {searchResult.length} wyników</p>
              {searchResult.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Brak wyników dla «{search}».</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {searchResult.map((item, i) => (
                    <ItemCard key={item.slug || i} item={item} onClick={() => navigateTo(item.slug, item.name)} />
                  ))}
                </div>
              )}
            </>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {browseType === 'group' ? (
                <div>
                  <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p>Kliknij «Szczegóły» aby zobaczyć informacje o produkcie.</p>
                </div>
              ) : 'Brak podkategorii.'}
            </div>
          ) : browseType === 'group' && groupDetail?.models && groupDetail.models.length > 0 ? (
            // Models grid
            <>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Modele ({groupDetail.models.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {groupDetail.models.map((model, i) => (
                  <div
                    key={model.code || i}
                    onClick={() => { if (model.slug) setDetailSlug(model.slug); }}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                  >
                    <div className="h-28 bg-slate-50 flex items-center justify-center border-b border-slate-100">
                      {model.image ? (
                        <img src={model.image} alt="" className="max-w-[85%] max-h-24 object-contain" />
                      ) : (
                        <Package className="w-10 h-10 text-slate-200" />
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs font-medium text-slate-800 line-clamp-2">{model.name}</div>
                      {model.badge && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded mt-1 inline-block">{model.badge}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            // Category items grid
            <>
              {browseTitle && <h3 className="text-base font-semibold text-slate-800 mb-3">{browseTitle}</h3>}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((item, i) => (
                  <ItemCard key={item.slug || i} item={item} onClick={() => navigateTo(item.slug, item.name)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {detailSlug && (
        <GroupDetail
          slug={detailSlug}
          integrationId={integrationId}
          onClose={() => setDetailSlug(null)}
          onAddToOwnCatalog={onAddToOwnCatalog}
          onNavigate={(slug) => { setDetailSlug(null); navigateTo(slug); }}
        />
      )}
    </div>
  );
};
