import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Loader2, X, ChevronRight,
  FolderOpen, Grid3X3, List, Package, AlertTriangle,
  ExternalLink, ChevronLeft, Truck, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ═══ Types ═══
interface AtutCategory {
  name: string;
  slug: string;
  image?: string;
}

interface AtutProduct {
  name: string;
  slug: string;
  image?: string;
  priceNetto?: number | null;
  priceBrutto?: number | null;
  priceUnit?: string;
  price?: string;
  specs?: string[];
}

interface AtutProductDetail {
  title: string;
  productId?: string;
  image?: string;
  images?: string[];
  priceNetto?: number | null;
  priceBrutto?: number | null;
  priceUnit?: string;
  brand?: string;
  description?: string;
  params?: Array<{ name: string; value: string }>;
  ribbon?: string;
  similar?: Array<{ slug: string; name: string; image?: string }>;
  breadcrumb?: Array<{ slug: string; name: string }>;
  contactOnly?: boolean;
}

interface Props {
  integrationId?: string;
  onAddToOwnCatalog?: (product: { name: string; sku: string; ean?: string; ref_num?: string; price?: number | null; catalogPrice?: number | null; image?: string; manufacturer?: string; unit?: string; description?: string; url?: string; wholesaler: string; category?: string }) => void;
}

// ═══ Proxy helper ═══
async function atutProxy(action: string, params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('atut-proxy', {
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

const BASE = 'https://www.atutrental.com.pl';

// ═══ Category Node ═══
const CatNode: React.FC<{
  cat: AtutCategory;
  selectedSlug: string | null;
  onPick: (cat: AtutCategory) => void;
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
    </button>
  );
};

// ═══ Product Detail Modal ═══
const ProductDetail: React.FC<{
  product: AtutProduct;
  onClose: () => void;
  onAddToOwnCatalog?: Props['onAddToOwnCatalog'];
}> = ({ product, onClose, onAddToOwnCatalog }) => {
  const [detail, setDetail] = useState<AtutProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product.slug) { setError('Brak slugu produktu'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    atutProxy('product', { slug: product.slug })
      .then(r => { setDetail(r.product); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [product.slug]);

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
        <p className="text-sm text-red-600 mb-1">Błąd: {error || 'Produkt nie znaleziony'}</p>
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
            <span className="text-sm font-semibold text-slate-700">Atut Rental</span>
            {detail.ribbon && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{detail.ribbon}</span>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap">
          {/* Image */}
          <div className="w-64 min-h-[220px] bg-slate-50 flex items-center justify-center p-4">
            {detail.image ? (
              <img src={detail.image} alt="" className="max-w-[90%] max-h-52 object-contain" />
            ) : (
              <Package className="w-14 h-14 text-slate-200" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-5 min-w-[260px]">
            <h2 className="text-base font-semibold text-slate-900 mb-2 leading-tight">{detail.title}</h2>
            {detail.brand && <p className="text-xs text-slate-500">Producent: <span className="font-medium text-slate-700">{detail.brand}</span></p>}

            {/* Breadcrumb */}
            {detail.breadcrumb && detail.breadcrumb.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-1">
                {detail.breadcrumb.map(b => b.name).join(' › ')}
              </p>
            )}

            {/* Price block */}
            <div className="mt-3 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              {detail.contactOnly ? (
                <>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena</div>
                  <div className="text-sm text-slate-500">Skontaktuj się po cenę</div>
                </>
              ) : (
                <>
                  {detail.priceNetto != null && (
                    <>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena wynajmu</div>
                      <div className="text-xl font-bold text-blue-600">
                        {detail.priceNetto.toFixed(2)} <span className="text-sm font-normal">zł netto / {detail.priceUnit || 'DOBA'}</span>
                      </div>
                    </>
                  )}
                  {detail.priceBrutto != null && (
                    <div className="mt-1 text-xs text-slate-400">
                      Brutto: {detail.priceBrutto.toFixed(2)} zł / {detail.priceUnit || 'DOBA'}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Price unit badge */}
            {detail.priceUnit && (
              <div className="flex items-center gap-1.5 mb-3">
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-[10px] text-blue-600">
                  <Clock className="w-3 h-3" />
                  Stawka za: <b>{detail.priceUnit}</b>
                </span>
              </div>
            )}

            {/* Open on site */}
            <a
              href={BASE + product.slug}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Otwórz na AtutRental.com.pl
            </a>

            {onAddToOwnCatalog && (
              <button
                onClick={() => {
                  onAddToOwnCatalog({
                    name: detail.title,
                    sku: detail.productId || product.slug,
                    price: detail.priceNetto ?? null,
                    catalogPrice: detail.priceBrutto ?? null,
                    image: detail.image,
                    manufacturer: detail.brand || undefined,
                    unit: detail.priceUnit || 'DOBA',
                    description: detail.description,
                    url: BASE + product.slug,
                    wholesaler: 'atut-rental',
                    category: detail.breadcrumb?.map(b => b.name).join(' > ') || undefined,
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
            <p className="text-xs text-slate-600 leading-relaxed">{detail.description}</p>
          </div>
        )}

        {/* Parameters */}
        {detail.params && detail.params.length > 0 && (
          <div className="px-5 pb-4">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Parametry techniczne</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {detail.params.map((s, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="px-3 py-1.5 text-slate-500 w-1/2 border-r border-slate-100">{s.name}</td>
                      <td className="px-3 py-1.5 text-slate-700 font-medium">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

        {/* Similar */}
        {detail.similar && detail.similar.length > 0 && (
          <div className="px-5 pb-4">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Podobne produkty</h4>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {detail.similar.map((s, i) => (
                <div key={i} className="flex-shrink-0 w-28 bg-slate-50 rounded-lg border border-slate-200 p-2 text-center">
                  {s.image ? <img src={s.image} alt="" className="w-16 h-16 object-contain mx-auto" /> : <Package className="w-8 h-8 text-slate-200 mx-auto" />}
                  <div className="text-[10px] text-slate-600 mt-1 line-clamp-2">{s.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══ Product Card (grid) ═══
const ProductCardGrid: React.FC<{ p: AtutProduct; onClick: () => void }> = ({ p, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
  >
    <div className="h-32 bg-slate-50 flex items-center justify-center border-b border-slate-100">
      {p.image ? (
        <img src={p.image} alt="" className="max-w-[85%] max-h-28 object-contain" />
      ) : (
        <Package className="w-10 h-10 text-slate-200" />
      )}
    </div>
    <div className="p-2.5">
      <div className="text-xs font-medium text-slate-800 mt-0.5 line-clamp-2 min-h-[32px]">{p.name}</div>
      {p.specs && p.specs.length > 0 && (
        <div className="text-[10px] text-slate-400 mt-0.5 truncate">{p.specs.join(' · ')}</div>
      )}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
        {p.priceNetto != null ? (
          <div>
            <span className="text-sm font-bold text-blue-600">{p.priceNetto.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">zł</span></span>
            <span className="text-[10px] text-slate-400 ml-1">netto/{p.priceUnit || 'DOBA'}</span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400">Cena na zapytanie</span>
        )}
      </div>
    </div>
  </div>
);

// ═══ Product Card (list) ═══
const ProductCardList: React.FC<{ p: AtutProduct; onClick: () => void }> = ({ p, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-lg border border-slate-200 p-2.5 flex items-center gap-3 cursor-pointer hover:border-blue-400 transition-colors"
  >
    <div className="w-14 h-14 bg-slate-50 rounded flex items-center justify-center flex-shrink-0">
      {p.image ? (
        <img src={p.image} alt="" className="max-w-[90%] max-h-[90%] object-contain" />
      ) : (
        <Package className="w-6 h-6 text-slate-200" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-slate-800 truncate">{p.name || '—'}</div>
      {p.specs && p.specs.length > 0 && (
        <div className="text-[10px] text-slate-400 truncate">{p.specs.join(' · ')}</div>
      )}
    </div>
    <div className="flex-shrink-0 text-right">
      {p.priceNetto != null ? (
        <div>
          <span className="text-sm font-bold text-blue-600">{p.priceNetto.toFixed(2)} zł</span>
          <div className="text-[10px] text-slate-400">netto/{p.priceUnit || 'DOBA'}</div>
        </div>
      ) : (
        <span className="text-[10px] text-slate-400">Na zapytanie</span>
      )}
    </div>
  </div>
);

// ═══ MAIN COMPONENT ═══
export const AtutIntegrator: React.FC<Props> = ({ integrationId, onAddToOwnCatalog }) => {
  const [categories, setCategories] = useState<AtutCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<AtutCategory | null>(null);

  // Navigation stack for drilling down
  const [navStack, setNavStack] = useState<Array<{ slug: string; name: string }>>([]);
  const [items, setItems] = useState<any[]>([]);
  const [hasProducts, setHasProducts] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseTitle, setBrowseTitle] = useState('');

  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState<AtutProduct[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailProduct, setDetailProduct] = useState<AtutProduct | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [connectionError, setConnectionError] = useState('');

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load top-level categories
  useEffect(() => {
    setCatLoading(true);
    atutProxy('categories')
      .then(data => { setCategories(data.categories || []); setCatLoading(false); })
      .catch(e => { setCatLoading(false); setConnectionError(e.message); });
  }, []);

  // Browse a slug
  const browse = useCallback((slug: string) => {
    setBrowseLoading(true);
    setBrowseError(null);
    atutProxy('browse', { slug })
      .then(data => {
        if (data.type === 'product') {
          // Redirect to product detail
          setDetailProduct({ name: data.product?.title || '', slug, image: data.product?.image });
          setBrowseLoading(false);
        } else {
          setItems(data.items || []);
          setHasProducts(!!data.hasProducts);
          setBrowseTitle(data.title || '');
          setBrowseLoading(false);
        }
      })
      .catch(e => { setBrowseError(e.message); setBrowseLoading(false); });
  }, []);

  // When category is selected, browse it
  useEffect(() => {
    if (!selectedCat) return;
    setNavStack([{ slug: selectedCat.slug, name: selectedCat.name }]);
    browse(selectedCat.slug);
  }, [selectedCat, browse]);

  // Navigate deeper into subcategory
  const navigateTo = (item: any) => {
    if (hasProducts) {
      // It's a product — open detail
      setDetailProduct(item as AtutProduct);
    } else {
      // It's a subcategory — drill down
      setNavStack(prev => [...prev, { slug: item.slug, name: item.name }]);
      browse(item.slug);
    }
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
    atutProxy('search', { q: q.trim() })
      .then(r => { setSearchResult(r.products || []); setSearchLoading(false); })
      .catch(() => { setSearchResult([]); setSearchLoading(false); });
  }, []);

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

  const display = searchResult !== null ? searchResult : (hasProducts ? items : []);
  const isLoading = searchLoading || browseLoading;
  const hasContent = selectedCat || searchResult !== null;

  if (connectionError && categories.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700 mb-2">Nie udało się połączyć z Atut Rental</h3>
        <p className="text-sm text-slate-500 mb-4">{connectionError}</p>
      </div>
    );
  }

  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
      {/* Sidebar: Categories */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
        <div className="px-3 py-2.5 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-blue-500" />
          Kategorie Atut Rental
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
              placeholder="Szukaj w Atut Rental..."
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

        {/* Breadcrumb nav */}
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

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasContent ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Truck className="w-12 h-12 text-slate-200 mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">Katalog sprzętu Atut Rental</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Wybierz kategorię z listy po lewej, aby przeglądać dostępny sprzęt do wynajmu.
              </p>
              {categories.length > 0 && (
                <div className="mt-6 w-full max-w-lg">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Kategorie</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {categories.slice(0, 12).map((c, i) => (
                      <button
                        key={c.slug || i}
                        onClick={() => { setSelectedCat(c); }}
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
            // Search results (products)
            <>
              <p className="text-xs text-slate-400 mb-3">Wynik wyszukiwania «{search}»: {searchResult.length} produktów</p>
              {searchResult.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Brak wyników dla «{search}».</div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {searchResult.map((p, i) => (
                    <ProductCardGrid key={p.slug || i} p={p} onClick={() => setDetailProduct(p)} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResult.map((p, i) => (
                    <ProductCardList key={p.slug || i} p={p} onClick={() => setDetailProduct(p)} />
                  ))}
                </div>
              )}
            </>
          ) : hasProducts ? (
            // Product listing
            <>
              {browseTitle && <h3 className="text-base font-semibold text-slate-800 mb-3">{browseTitle}</h3>}
              {items.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Brak produktów w tej kategorii.</div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map((p, i) => (
                    <ProductCardGrid key={p.slug || i} p={p} onClick={() => setDetailProduct(p)} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((p, i) => (
                    <ProductCardList key={p.slug || i} p={p} onClick={() => setDetailProduct(p)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            // Subcategory tiles
            <>
              {browseTitle && <h3 className="text-base font-semibold text-slate-800 mb-3">{browseTitle}</h3>}
              {items.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Brak podkategorii.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map((item, i) => (
                    <div
                      key={item.slug || i}
                      onClick={() => navigateTo(item)}
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
                        <div className="text-xs font-medium text-slate-800 line-clamp-2">{item.name}</div>
                        {item.price && <div className="text-[10px] text-blue-600 mt-1">{item.price}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {detailProduct && (
        <ProductDetail
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onAddToOwnCatalog={onAddToOwnCatalog}
        />
      )}
    </div>
  );
};
