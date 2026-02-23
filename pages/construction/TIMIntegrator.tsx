import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Loader2, X, ChevronRight,
  FolderOpen, Grid3X3, List, Package, AlertTriangle,
  ExternalLink, ChevronLeft
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ═══ Types ═══
interface TIMCategory {
  name: string;
  slug: string;
  subcategories?: TIMCategory[];
}

interface TIMProduct {
  name: string;
  sku: string;
  url?: string;
  image?: string;
  price?: number | null;
  publicPrice?: number | null;
  rating?: number | null;
  manufacturer?: string | { name: string };
  default_image?: string;
  _id?: string;
  stock?: number | null;
  unit?: string;
  stockColor?: string;
  shippingText?: string;
}

interface TIMProductDetail {
  sku: string;
  name: string;
  price?: number | null;
  publicPrice?: number | null;
  grossPrice?: number | null;
  image?: string;
  url?: string;
  manufacturer?: string;
  ref_num?: string;
  ean?: string;
  series?: string;
  description?: string;
  specs?: Array<{ name: string; value: string }>;
  mpn?: string;
  color?: string;
  material?: string;
  rating?: number | null;
  reviewCount?: number | null;
  breadcrumb?: string;
  stock_qty?: number;
  unit?: string;
  stockColor?: string;
  shippingText?: string;
}

interface Props {
  integrationId?: string;
  onSelectProduct?: (product: { name: string; price: number | null; sku: string; ean?: string; unit?: string }) => void;
  onAddToOwnCatalog?: (product: { name: string; sku: string; ean?: string; ref_num?: string; price?: number | null; catalogPrice?: number | null; image?: string; manufacturer?: string; unit?: string; description?: string; url?: string; wholesaler: string; category?: string }) => void;
}

// ═══ Helper: invoke tim-proxy edge function ═══
async function timProxy(action: string, params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('tim-proxy', {
    body: { action, ...params },
  });
  if (error) {
    // Try to extract body from FunctionsHttpError for more details
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
    console.error('[tim-proxy]', action, 'error:', error.message, detail || '');
    throw new Error(detail ? `${error.message}: ${detail}` : (error.message || 'Edge function error'));
  }
  // Handle case where data is a string (not auto-parsed)
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  if (parsed?.error) throw new Error(parsed.error);
  return parsed;
}

// ═══ Helper: get manufacturer string ═══
function getMfr(p: TIMProduct): string {
  if (!p.manufacturer) return '';
  return typeof p.manufacturer === 'object' ? (p.manufacturer as any)?.name || '' : p.manufacturer;
}

// ═══ Helper: get price value ═══
function getPrice(p: TIMProduct): number | null {
  if (p.price == null) return null;
  if (typeof p.price === 'object') return (p.price as any).value ?? null;
  return p.price;
}

// ═══ Category Tree Node ═══
const CatNode: React.FC<{
  cat: TIMCategory;
  depth: number;
  selectedSlug: string | null;
  onPick: (cat: TIMCategory) => void;
}> = ({ cat, depth, selectedSlug, onPick }) => {
  const [open, setOpen] = useState(false);
  const hasSub = (cat.subcategories?.length || 0) > 0;
  const active = selectedSlug === cat.slug;

  return (
    <div>
      <button
        onClick={() => { onPick(cat); if (hasSub) setOpen(!open); }}
        className={`w-full text-left flex items-center gap-1.5 py-1.5 px-2.5 text-xs rounded transition-colors ${
          active
            ? 'bg-blue-50 text-blue-700 font-semibold'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        {hasSub ? (
          <ChevronRight className={`w-3 h-3 opacity-40 transition-transform ${open ? 'rotate-90' : ''}`} />
        ) : (
          <span className="w-3" />
        )}
        <FolderOpen className="w-3.5 h-3.5 opacity-40" />
        <span className="truncate">{cat.name}</span>
      </button>
      {open && hasSub && cat.subcategories!.map((s, i) => (
        <CatNode key={s.slug || i} cat={s} depth={depth + 1} selectedSlug={selectedSlug} onPick={onPick} />
      ))}
    </div>
  );
};

// ═══ Product Detail Modal ═══
const ProductDetail: React.FC<{
  product: TIMProduct;
  integrationId?: string;
  onClose: () => void;
  onSelectProduct?: (product: { name: string; price: number | null; sku: string; ean?: string; unit?: string }) => void;
  onAddToOwnCatalog?: (product: { name: string; sku: string; ean?: string; ref_num?: string; price?: number | null; catalogPrice?: number | null; image?: string; manufacturer?: string; unit?: string; description?: string; url?: string; wholesaler: string; category?: string }) => void;
}> = ({ product, integrationId, onClose, onSelectProduct, onAddToOwnCatalog }) => {
  const [detail, setDetail] = useState<TIMProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otherPrices, setOtherPrices] = useState<Array<{ wholesaler: string; catalogPrice: number | null; purchasePrice: number | null; stock: number | null; url?: string }>>([]);
  const [loadingOtherPrices, setLoadingOtherPrices] = useState(false);

  // Fallback image from product card
  const fallbackImage = product.image || product.default_image || '';
  const fallbackMfr = getMfr(product);

  useEffect(() => {
    setLoading(true);
    setError(null);
    timProxy('product', {
      integrationId,
      url: product.url,
      sku: product.sku || product._id,
    })
      .then(r => { setDetail(r.product); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [product.url, product.sku, product._id, integrationId]);

  // Fetch prices from other wholesalers
  useEffect(() => {
    if (!detail) return;
    setLoadingOtherPrices(true);
    setOtherPrices([]);

    Promise.resolve(supabase.from('wholesaler_integrations').select('*').eq('is_active', true))
      .then(({ data: integrations }) => {
        if (!integrations?.length) { setLoadingOtherPrices(false); return; }
        const others = integrations.filter(i => i.wholesaler_id !== 'tim');
        if (!others.length) { setLoadingOtherPrices(false); return; }

        const queries: string[] = [];
        if (detail.ref_num) queries.push(detail.ref_num);
        if (detail.ean) queries.push(detail.ean);
        if (detail.sku && detail.sku !== detail.ref_num && detail.sku !== detail.ean) queries.push(detail.sku);
        if (!queries.length && detail.name) queries.push(detail.name);
        if (!queries.length) { setLoadingOtherPrices(false); return; }

        const scoreProduct = (p: any): number => {
          let score = 0;
          const pName = (p.name || '').toLowerCase();
          const pSku = (p.sku || '').toLowerCase();
          const pRefNum = (p.ref_num || '').toLowerCase();
          if (detail.ref_num) {
            const ref = detail.ref_num.toLowerCase();
            if (pRefNum === ref || pSku.includes(ref) || pName.includes(ref)) score += 20;
          }
          if (detail.ean && (pName.includes(detail.ean) || pSku.includes(detail.ean))) score += 15;
          const words = (detail.name || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
          score += words.filter(w => pName.includes(w)).length * 2;
          return score;
        };

        Promise.allSettled(others.map(async (integ) => {
          const proxyName = integ.wholesaler_id === 'tim' ? 'tim-proxy' : integ.wholesaler_id === 'speckable' ? 'speckable-proxy' : 'oninen-proxy';
          const qResults = await Promise.allSettled(
            queries.map(q =>
              supabase.functions.invoke(proxyName, { body: { action: 'search', integrationId: integ.id, q } })
                .then(({ data, error: err }) => {
                  if (err) throw err;
                  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                  if (parsed?.error) throw new Error(parsed.error);
                  return parsed;
                })
            )
          );
          const seen = new Map<string, { product: any; score: number }>();
          for (const qr of qResults) {
            if (qr.status !== 'fulfilled') continue;
            for (const p of (qr.value.products || [])) {
              const key = p.sku || p.url || p.name;
              const sc = scoreProduct(p);
              const ex = seen.get(key);
              if (!ex || sc > ex.score) seen.set(key, { product: p, score: sc });
            }
          }
          let best: any = null, bestScore = -1;
          for (const { product: pr, score: sc } of seen.values()) { if (sc > bestScore) { best = pr; bestScore = sc; } }
          if ((detail.ref_num || detail.ean) && bestScore <= 0) best = null;
          return { integ, best };
        })).then(results => {
          const prices: typeof otherPrices = [];
          for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            const { integ, best } = r.value;
            if (!best) continue;
            const isTim = integ.wholesaler_id === 'tim';
            const isSpeckable = integ.wholesaler_id === 'speckable';
            prices.push({
              wholesaler: isTim ? 'TIM' : isSpeckable ? 'Speckable' : 'Onninen',
              catalogPrice: isTim ? (best.publicPrice ?? null) : isSpeckable ? (best.priceGross ?? null) : (best.priceCatalog ?? null),
              purchasePrice: isTim ? (best.price ?? null) : isSpeckable ? (best.priceNetto ?? null) : (best.priceEnd ?? null),
              stock: best.stock ?? null,
              url: best.url || undefined,
            });
          }
          setOtherPrices(prices);
          setLoadingOtherPrices(false);
        });
      })
      .catch(() => setLoadingOtherPrices(false));
  }, [detail]);

  if (loading) return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl p-12 text-center" onClick={e => e.stopPropagation()}>
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Ładowanie danych produktu...</p>
      </div>
    </div>
  );

  if (error || !detail) return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl p-8 text-center max-w-sm" onClick={e => e.stopPropagation()}>
        <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-600 mb-1">Błąd: {error || 'Produkt nie znaleziony'}</p>
        <p className="text-xs text-slate-400">SKU: {product.sku || product._id}</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
          Zamknij
        </button>
      </div>
    </div>
  );

  const mfr = detail.manufacturer || fallbackMfr || '—';
  const img = detail.image || fallbackImage;
  const personalPrice = detail.price;
  const catalogPrice = detail.publicPrice;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <span className="text-xs text-slate-400 font-mono">SKU: {detail.sku}{detail.ean ? ` · EAN: ${detail.ean}` : ''}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap">
          {/* Image */}
          <div className="w-64 min-h-[220px] bg-slate-50 flex items-center justify-center p-4">
            {img ? (
              <img src={img} alt="" className="max-w-[90%] max-h-52 object-contain" />
            ) : (
              <Package className="w-14 h-14 text-slate-200" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-5 min-w-[260px]">
            <h2 className="text-base font-semibold text-slate-900 mb-2 leading-tight">{detail.name}</h2>
            <p className="text-xs text-slate-500">Producent: <span className="font-medium text-slate-700">{mfr}</span></p>
            {detail.ref_num && <p className="text-xs text-slate-400 mt-0.5">Indeks producenta: {detail.ref_num}</p>}

            {/* Price block */}
            <div className="mt-3 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              {personalPrice != null ? (
                <>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Twoja cena</div>
                  <div className="text-xl font-bold text-blue-600">{personalPrice} <span className="text-sm font-normal">zł netto</span></div>
                  {catalogPrice != null && catalogPrice !== personalPrice && (
                    <div className="mt-1 text-xs text-slate-400">
                      Cena katalogowa: <span className="line-through">{catalogPrice} zł</span>
                      <span className="ml-1.5 text-green-600 font-medium">
                        -{Math.round((1 - Number(personalPrice) / Number(catalogPrice)) * 100)}%
                      </span>
                    </div>
                  )}
                </>
              ) : catalogPrice != null ? (
                <>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena katalogowa</div>
                  <div className="text-xl font-bold text-slate-700">{catalogPrice} <span className="text-sm font-normal">zł netto</span></div>
                </>
              ) : (
                <>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena</div>
                  <div className="text-xs text-slate-400">Niedostępna</div>
                </>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {detail.stock_qty != null && (
                <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                  Magazyn: <b>{detail.stock_qty} {detail.unit || 'szt'}</b>
                </span>
              )}
              {detail.shippingText && (
                <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                  Dostawa: <b>{detail.shippingText}</b>
                </span>
              )}
            </div>

            {detail.series && (
              <p className="text-xs text-slate-500 mb-2">Seria: <b>{detail.series}</b></p>
            )}

            {onSelectProduct && (
              <button
                onClick={() => {
                  onSelectProduct({
                    name: detail.name,
                    price: detail.price ?? null,
                    sku: detail.sku,
                    ean: detail.ean,
                    unit: detail.unit,
                  });
                  onClose();
                }}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mb-2"
              >
                <Package className="w-4 h-4" />
                Dodaj do kosztorysu
              </button>
            )}

            {detail.url && (
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Otwórz na TIM.pl
              </a>
            )}

            {onAddToOwnCatalog && (
              <button
                onClick={() => {
                  onAddToOwnCatalog({
                    name: detail.name,
                    sku: detail.sku,
                    ean: detail.ean,
                    ref_num: detail.ref_num || undefined,
                    price: detail.price ?? null,
                    catalogPrice: detail.publicPrice ?? null,
                    image: detail.image || fallbackImage,
                    manufacturer: detail.manufacturer || fallbackMfr || undefined,
                    unit: detail.unit,
                    description: detail.description,
                    url: detail.url,
                    wholesaler: 'tim',
                    category: detail.breadcrumb?.split(' > ').pop() || undefined,
                  });
                  onClose();
                }}
                className="w-full py-2.5 mt-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" />
                Dodaj do katalogu Własnego
              </button>
            )}
          </div>
        </div>

        {/* Prices in other wholesalers */}
        {(loadingOtherPrices || otherPrices.length > 0) && (
          <div className="px-5 pb-4">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Ceny i dostępność w innych hurtowniach</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Hurtownia</th>
                    <th className="px-3 py-2 text-right text-slate-500 font-medium">Cena katalogowa</th>
                    <th className="px-3 py-2 text-right text-slate-500 font-medium">Cena zakupu</th>
                    <th className="px-3 py-2 text-center text-slate-500 font-medium">Dostępność</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingOtherPrices ? (
                    <tr><td colSpan={5} className="px-3 py-4 text-center"><Loader2 className="w-4 h-4 animate-spin text-blue-600 mx-auto" /></td></tr>
                  ) : otherPrices.map((wp, idx) => {
                    const allPrices = otherPrices.filter(p => p.purchasePrice != null).map(p => p.purchasePrice!);
                    const best = allPrices.length > 0 ? Math.min(...allPrices) : null;
                    const worst = allPrices.length > 1 ? Math.max(...allPrices) : null;
                    const isBest = best != null && wp.purchasePrice === best && allPrices.length > 1;
                    const isWorst = worst != null && wp.purchasePrice === worst && worst !== best;
                    return (
                      <tr key={idx} className={isBest ? 'bg-green-50' : isWorst ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-2 font-medium text-slate-700">{wp.wholesaler}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{wp.catalogPrice?.toFixed(2) ?? '—'} zł</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800">{wp.purchasePrice?.toFixed(2) ?? '—'} zł</td>
                        <td className="px-3 py-2 text-center">
                          {wp.stock != null ? (
                            <span className={`px-1.5 py-0.5 rounded ${wp.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {wp.stock > 0 ? `${wp.stock} szt.` : 'Brak'}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {wp.url && (
                            <a href={wp.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Description */}
        {detail.description && (
          <div className="px-5 pb-3">
            <h4 className="text-xs font-semibold text-slate-600 mb-1.5">Opis</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{detail.description}</p>
          </div>
        )}

        {/* Technical specs */}
        {detail.specs && detail.specs.length > 0 && (
          <div className="px-5 pb-4">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Dane techniczne</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {detail.specs.map((s, i) => (
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

        {/* Breadcrumb */}
        {detail.breadcrumb && (
          <div className="px-5 pb-4">
            <p className="text-[10px] text-slate-400">{detail.breadcrumb}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══ Product Card (grid) ═══
const ProductCardGrid: React.FC<{ p: TIMProduct; onClick: () => void }> = ({ p, onClick }) => {
  const mfr = getMfr(p);
  const price = getPrice(p);
  const img = p.image || p.default_image;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
    >
      <div className="h-32 bg-slate-50 flex items-center justify-center border-b border-slate-100">
        {img ? (
          <img src={img} alt="" className="max-w-[85%] max-h-28 object-contain" />
        ) : (
          <Package className="w-10 h-10 text-slate-200" />
        )}
      </div>
      <div className="p-2.5">
        <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku || p._id}</div>
        <div className="text-xs font-medium text-slate-800 mt-0.5 line-clamp-2 min-h-[32px]">{p.name}</div>
        {mfr && <div className="text-[10px] text-slate-400 mt-0.5">{mfr}</div>}
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
          {price != null ? (
            <div>
              <span className="text-sm font-bold text-blue-600">{price} <span className="text-[10px] font-normal text-slate-400">zł</span></span>
              {p.publicPrice != null && p.publicPrice !== price && (
                <span className="ml-1.5 text-[10px] text-slate-400 line-through">{p.publicPrice}</span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-slate-300">—</span>
          )}
          {p.stock != null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              p.stock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {p.stock > 0 ? `${p.stock} ${p.unit || 'szt'}` : 'Brak'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══ Product Card (list) ═══
const ProductCardList: React.FC<{ p: TIMProduct; onClick: () => void }> = ({ p, onClick }) => {
  const mfr = getMfr(p);
  const price = getPrice(p);
  const img = p.image || p.default_image;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 p-2.5 flex items-center gap-3 cursor-pointer hover:border-blue-400 transition-colors"
    >
      <div className="w-14 h-14 bg-slate-50 rounded flex items-center justify-center flex-shrink-0">
        {img ? (
          <img src={img} alt="" className="max-w-[90%] max-h-[90%] object-contain" />
        ) : (
          <Package className="w-6 h-6 text-slate-200" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-800 truncate">{p.name || '—'}</div>
        <div className="text-[10px] text-slate-400 font-mono">{p.sku || p._id}{mfr ? ` · ${mfr}` : ''}</div>
      </div>
      {p.stock != null && (
        <div className="flex-shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            p.stock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {p.stock > 0 ? `${p.stock} ${p.unit || 'szt'}` : 'Brak'}
          </span>
        </div>
      )}
      <div className="flex-shrink-0 text-right">
        {price != null ? (
          <div>
            <span className="text-sm font-bold text-blue-600">{price} zł</span>
            {p.publicPrice != null && p.publicPrice !== price && (
              <div className="text-[10px] text-slate-400 line-through">{p.publicPrice} zł</div>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-slate-300">—</span>
        )}
      </div>
    </div>
  );
};

// ═══ MAIN COMPONENT ═══
export const TIMIntegrator: React.FC<Props> = ({ integrationId, onSelectProduct, onAddToOwnCatalog }) => {
  const [categories, setCategories] = useState<TIMCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<TIMCategory | null>(null);
  const [products, setProducts] = useState<TIMProduct[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState<TIMProduct[] | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailProduct, setDetailProduct] = useState<TIMProduct | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [connectionError, setConnectionError] = useState('');

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load categories
  useEffect(() => {
    setCatLoading(true);
    timProxy('categories', { integrationId })
      .then(data => {
        setCategories(data.categories || []);
        setCatLoading(false);
      })
      .catch(e => { setCatLoading(false); setConnectionError(e.message); });
  }, [integrationId]);

  // Load products by category
  useEffect(() => {
    if (!selectedCat) return;
    setProdLoading(true);
    setProdError(null);
    timProxy('products', { integrationId, cat: selectedCat.slug, page })
      .then(data => {
        setProducts(data.products || []);
        setTotalPages(data.totalPages || 0);
        setTotalCount(data.totalProducts || 0);
        setProdLoading(false);
        setSearchResult(null);
      })
      .catch(e => { setProdError(e.message); setProdLoading(false); });
  }, [selectedCat, page, integrationId]);

  // Fast API-based search (uses wholesaler's search endpoint)
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResult(null); setSearchLoading(false); return; }
    setSearchLoading(true);
    timProxy('search', { integrationId, q: q.trim() })
      .then(r => {
        console.log('[TIM search response]', { products: r.products?.length, total: r.total, totalPages: r.totalPages, source: r.source });
        setSearchResult(r.products || []);
        setSearchTotal(r.total || 0);
        setSearchLoading(false);
      })
      .catch(err => { console.error('[TIM search error]', err); setSearchResult([]); setSearchTotal(0); setSearchLoading(false); });
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

  const display = searchResult !== null ? searchResult : products;
  const isLoading = searchLoading || prodLoading;
  const hasContent = selectedCat || searchResult !== null;

  // Connection error
  if (connectionError && categories.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700 mb-2">Nie udało się połączyć z TIM</h3>
        <p className="text-sm text-slate-500 mb-4">{connectionError}</p>
      </div>
    );
  }

  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
      {/* Sidebar: Categories */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
        <div className="px-3 py-2.5 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Kategorie TIM
        </div>
        {catLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            Nie udało się załadować kategorii.
          </div>
        ) : (
          <div className="py-1">
            {categories.map((c, i) => (
              <CatNode
                key={c.slug || i}
                cat={c}
                depth={0}
                selectedSlug={selectedCat?.slug || null}
                onPick={cat => { setSelectedCat(cat); setPage(1); setSearch(''); setSearchResult(null); }}
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
              placeholder="Szukaj w TIM..."
              className="flex-1 bg-transparent border-none px-2.5 py-2 text-sm outline-none placeholder-slate-400 text-slate-700"
            />
            {searchLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-1" />
            )}
            {search && (
              <button onClick={() => { setSearch(''); setSearchResult(null); setSearchTotal(0); setSearchLoading(false); }} className="text-slate-400 hover:text-slate-600">
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

          {selectedCat && !searchResult && (
            <span className="text-xs text-slate-400 whitespace-nowrap">{totalCount} produktów</span>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasContent ? (
            /* Landing */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Package className="w-12 h-12 text-slate-200 mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">Katalog materiałów TIM.pl</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Wybierz kategorię z listy po lewej, aby przeglądać i wyszukiwać produkty.
              </p>
              {categories.length > 0 && (
                <div className="mt-6 w-full max-w-lg">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Główne kategorie</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {categories.slice(0, 10).map((c, i) => (
                      <button
                        key={c.slug || i}
                        onClick={() => { setSelectedCat(c); setPage(1); }}
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
              <span className="text-sm text-slate-500">Ładowanie produktów...</span>
            </div>
          ) : prodError ? (
            <div className="text-center py-8 bg-white rounded-lg border border-slate-200">
              <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600">{prodError}</p>
            </div>
          ) : display.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {searchResult !== null ? `Brak wyników dla «${search}».` : 'Brak produktów w tej kategorii.'}
            </div>
          ) : (
            <>
              {selectedCat && !searchResult && (
                <h3 className="text-base font-semibold text-slate-800 mb-3">{selectedCat.name}</h3>
              )}
              {searchResult !== null && (
                <p className="text-xs text-slate-400 mb-3">Wynik wyszukiwania «{search}»: {searchTotal > searchResult.length ? `${searchResult.length} z ${searchTotal}` : searchResult.length} produktów</p>
              )}

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {display.map((p, i) => (
                    <ProductCardGrid
                      key={p.sku || p._id || i}
                      p={p}
                      onClick={() => setDetailProduct(p)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {display.map((p, i) => (
                    <ProductCardList
                      key={p.sku || p._id || i}
                      p={p}
                      onClick={() => setDetailProduct(p)}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && !searchResult && (
                <div className="flex items-center justify-center gap-3 mt-4 pb-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 border border-slate-200 rounded-md text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />Wstecz
                  </button>
                  <span className="text-xs text-slate-500">{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 border border-slate-200 rounded-md text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Dalej<ChevronRight className="w-3.5 h-3.5 inline ml-1" />
                  </button>
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
          integrationId={integrationId}
          onClose={() => setDetailProduct(null)}
          onSelectProduct={onSelectProduct}
          onAddToOwnCatalog={onAddToOwnCatalog}
        />
      )}
    </div>
  );
};
