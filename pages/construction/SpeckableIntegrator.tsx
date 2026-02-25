import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Loader2, X, ChevronRight,
  FolderOpen, Grid3X3, List, Package, AlertTriangle,
  ExternalLink, ChevronLeft, Truck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ═══ Types ═══
interface SpeckableCategory {
  name: string;
  slug: string;
  image?: string;
  subcategories?: SpeckableCategory[];
}

interface SpeckableProduct {
  name: string;
  symbol: string;
  slug: string;
  image?: string;
  priceNetto?: number | null;
  currency?: string;
  stock?: string;
  price?: string;
}

interface SpeckableProductDetail {
  name: string;
  sku: string;
  ean?: string;
  brand?: string;
  priceNetto?: number | null;
  priceGross?: number | null;
  currency?: string;
  stock?: string;
  stockExternal?: string;
  unit?: string;
  image?: string;
  images?: string[];
  description?: string;
  descriptionHtml?: string;
  specification?: Array<{ name: string; value: string }>;
  breadcrumb?: string;
  url?: string;
  related?: SpeckableProduct[];
}

interface Props {
  integrationId?: string;
  onSelectProduct?: (product: { name: string; price: number | null; sku: string; ean?: string; unit?: string }) => void;
  onAddToOwnCatalog?: (product: { name: string; sku: string; ean?: string; ref_num?: string; price?: number | null; catalogPrice?: number | null; image?: string; manufacturer?: string; unit?: string; description?: string; url?: string; wholesaler: string; category?: string }) => void;
}

// ═══ Helper: invoke speckable-proxy edge function ═══
async function speckableProxy(action: string, params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('speckable-proxy', {
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
    console.error('[speckable-proxy]', action, 'error:', error.message, detail || '');
    throw new Error(detail ? `${error.message}: ${detail}` : (error.message || 'Edge function error'));
  }
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  if (parsed?.error) throw new Error(parsed.error);
  return parsed;
}

// ═══ Stock color ═══
function stockColor(stock: string | undefined): string {
  if (!stock) return 'bg-slate-300';
  const num = parseInt(stock);
  if (isNaN(num)) {
    if (stock.toLowerCase().includes('brak') || stock === '0') return 'bg-red-500';
    return 'bg-green-500';
  }
  if (num > 10) return 'bg-green-500';
  if (num > 0) return 'bg-yellow-500';
  return 'bg-red-500';
}

function stockLabel(stock: string | undefined): string {
  if (!stock) return '—';
  return stock;
}

// ═══ Category Tree Node ═══
const CatNode: React.FC<{
  cat: SpeckableCategory;
  depth: number;
  selectedSlug: string | null;
  onPick: (cat: SpeckableCategory) => void;
}> = ({ cat, depth, selectedSlug, onPick }) => {
  const [open, setOpen] = useState(false);
  const hasSub = (cat.subcategories?.length || 0) > 0;
  const active = selectedSlug === cat.slug;

  useEffect(() => {
    if (active && hasSub && !open) setOpen(true);
  }, [active, hasSub]);

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
  product: SpeckableProduct;
  integrationId?: string;
  onClose: () => void;
  onSelectProduct?: Props['onSelectProduct'];
  onAddToOwnCatalog?: Props['onAddToOwnCatalog'];
}> = ({ product, integrationId, onClose, onSelectProduct, onAddToOwnCatalog }) => {
  const [detail, setDetail] = useState<SpeckableProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otherPrices, setOtherPrices] = useState<Array<{ wholesaler: string; catalogPrice: number | null; purchasePrice: number | null; stock: number | null; url?: string }>>([]);
  const [loadingOtherPrices, setLoadingOtherPrices] = useState(false);

  useEffect(() => {
    if (!product.slug) {
      setError('Brak slugu produktu');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    speckableProxy('product', { integrationId, slug: product.slug })
      .then(r => { setDetail(r.product); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [product.slug, integrationId]);

  // Fetch prices from other wholesalers
  useEffect(() => {
    if (!detail) return;
    setLoadingOtherPrices(true);
    setOtherPrices([]);

    Promise.resolve(supabase.from('wholesaler_integrations').select('*').eq('is_active', true))
      .then(({ data: integrations }) => {
        if (!integrations?.length) { setLoadingOtherPrices(false); return; }
        // Deduplicate by wholesaler_id — only one integration per wholesaler
        const seenWholesalers = new Set<string>();
        const others = integrations.filter(i => {
          if (i.wholesaler_id === 'speckable') return false;
          if (seenWholesalers.has(i.wholesaler_id)) return false;
          seenWholesalers.add(i.wholesaler_id);
          return true;
        });
        if (!others.length) { setLoadingOtherPrices(false); return; }

        const queries: string[] = [];
        if (detail.sku) queries.push(detail.sku);
        if (detail.ean) queries.push(detail.ean);
        if (!queries.length && detail.name) queries.push(detail.name);
        if (!queries.length) { setLoadingOtherPrices(false); return; }

        const scoreProduct = (p: any): number => {
          let score = 0;
          const pName = (p.name || '').toLowerCase();
          const pSku = (p.sku || p.ref_num || '').toLowerCase();
          if (detail.sku) {
            const ref = detail.sku.toLowerCase();
            if (pSku === ref || pSku.includes(ref) || pName.includes(ref)) score += 20;
          }
          if (detail.ean && (pName.includes(detail.ean) || pSku.includes(detail.ean))) score += 15;
          const words = (detail.name || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
          score += words.filter(w => pName.includes(w)).length * 2;
          return score;
        };

        Promise.allSettled(others.map(async (integ) => {
          const proxyName = integ.wholesaler_id === 'tim' ? 'tim-proxy' : integ.wholesaler_id === 'oninen' ? 'oninen-proxy' : 'speckable-proxy';
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
          if ((detail.sku || detail.ean) && bestScore <= 0) best = null;
          return { integ, best };
        })).then(results => {
          const prices: typeof otherPrices = [];
          for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            const { integ, best } = r.value;
            if (!best) continue;
            const isTim = integ.wholesaler_id === 'tim';
            const isOnninen = integ.wholesaler_id === 'oninen';
            prices.push({
              wholesaler: integ.wholesaler_name || (isTim ? 'TIM' : isOnninen ? 'Onninen' : integ.wholesaler_id),
              catalogPrice: isTim ? (best.publicPrice ?? null) : isOnninen ? (best.priceCatalog ?? null) : (best.priceGross ?? null),
              purchasePrice: isTim ? (best.price ?? null) : isOnninen ? (best.priceEnd ?? null) : (best.priceNetto ?? null),
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
        <p className="text-xs text-slate-400">SKU: {product.symbol}</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
          Zamknij
        </button>
      </div>
    </div>
  );

  const discount = detail.priceGross && detail.priceNetto && detail.priceGross > detail.priceNetto
    ? Math.round((1 - detail.priceNetto / detail.priceGross) * 100)
    : null;

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
            {detail.image ? (
              <img src={detail.image} alt="" className="max-w-[90%] max-h-52 object-contain" />
            ) : (
              <Package className="w-14 h-14 text-slate-200" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-5 min-w-[260px]">
            <h2 className="text-base font-semibold text-slate-900 mb-2 leading-tight">{detail.name}</h2>
            {detail.brand && <p className="text-xs text-slate-500">Producent: <span className="font-medium text-slate-700">{detail.brand}</span></p>}

            {/* Price block */}
            <div className="mt-3 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              {detail.priceNetto != null ? (
                <>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena netto (zakup)</div>
                  <div className="text-xl font-bold text-blue-600">{detail.priceNetto.toFixed(2)} <span className="text-sm font-normal">zł netto</span></div>
                  {detail.priceGross != null && (
                    <div className="mt-1 text-xs text-slate-400">
                      Cena brutto: {detail.priceGross.toFixed(2)} zł
                      {discount != null && discount > 0 && (
                        <span className="ml-1.5 text-green-600 font-medium">-{discount}%</span>
                      )}
                    </div>
                  )}
                </>
              ) : detail.priceGross != null ? (
                <>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena brutto</div>
                  <div className="text-xl font-bold text-slate-700">{detail.priceGross.toFixed(2)} <span className="text-sm font-normal">zł</span></div>
                </>
              ) : (
                <>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena</div>
                  <div className="text-xs text-slate-400">Niedostępna</div>
                </>
              )}
            </div>

            {/* Stock badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                <span className={`w-2 h-2 rounded-full ${stockColor(detail.stock)}`} />
                Magazyn: <b>{stockLabel(detail.stock)}</b>
              </span>
              {detail.stockExternal && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                  <span className={`w-2 h-2 rounded-full ${stockColor(detail.stockExternal)}`} />
                  Zewnętrzny: <b>{stockLabel(detail.stockExternal)}</b>
                </span>
              )}
              {detail.unit && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                  Jedn.: <b>{detail.unit}</b>
                </span>
              )}
            </div>

            {onSelectProduct && (
              <button
                onClick={() => {
                  onSelectProduct({
                    name: detail.name,
                    price: detail.priceNetto ?? null,
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
                Otwórz na Speckable.pl
              </a>
            )}

            {onAddToOwnCatalog && (
              <button
                onClick={() => {
                  onAddToOwnCatalog({
                    name: detail.name,
                    sku: detail.sku,
                    ean: detail.ean,
                    price: detail.priceNetto ?? null,
                    catalogPrice: detail.priceGross ?? null,
                    image: detail.image,
                    manufacturer: detail.brand || undefined,
                    unit: detail.unit,
                    description: detail.description,
                    url: detail.url,
                    wholesaler: 'speckable',
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
                            <span className={`px-1.5 py-0.5 rounded ${typeof wp.stock === 'number' ? (wp.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600') : 'bg-green-100 text-green-700'}`}>
                              {typeof wp.stock === 'number' ? (wp.stock > 0 ? `${wp.stock} szt.` : 'Brak') : wp.stock}
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
        {(detail.descriptionHtml || detail.description) && (
          <div className="px-5 pb-3">
            <h4 className="text-xs font-semibold text-slate-600 mb-1.5">Opis</h4>
            {detail.descriptionHtml ? (
              <div
                className="text-xs text-slate-600 leading-relaxed prose prose-xs max-w-none [&_img]:max-w-full [&_img]:h-auto [&_table]:w-full [&_td]:p-1 [&_th]:p-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                dangerouslySetInnerHTML={{ __html: detail.descriptionHtml }}
              />
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">{detail.description}</p>
            )}
          </div>
        )}

        {/* Technical specifications */}
        {detail.specification && detail.specification.length > 0 && (
          <div className="px-5 pb-4">
            <h4 className="text-xs font-semibold text-slate-600 mb-1.5">Dane techniczne</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {detail.specification.map((spec, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-1.5 text-slate-500 font-medium w-2/5">{spec.name}</td>
                      <td className="px-3 py-1.5 text-slate-700">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category breadcrumb */}
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
const ProductCardGrid: React.FC<{ p: SpeckableProduct; onClick: () => void }> = ({ p, onClick }) => (
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
      {p.symbol && <div className="text-[10px] text-slate-400 font-mono">SKU: {p.symbol}</div>}
      <div className="text-xs font-medium text-slate-800 mt-0.5 line-clamp-2 min-h-[32px]">{p.name}</div>
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
        {p.priceNetto != null ? (
          <span className="text-sm font-bold text-blue-600">{p.priceNetto.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">zł netto</span></span>
        ) : (
          <span className="text-[10px] text-slate-300">—</span>
        )}
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${stockColor(p.stock)}`} />
          <span className="text-[10px] text-slate-500">{stockLabel(p.stock)}</span>
        </span>
      </div>
    </div>
  </div>
);

// ═══ Product Card (list) ═══
const ProductCardList: React.FC<{ p: SpeckableProduct; onClick: () => void }> = ({ p, onClick }) => (
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
      <div className="text-[10px] text-slate-400 font-mono">{p.symbol}</div>
    </div>
    <div className="flex-shrink-0 flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${stockColor(p.stock)}`} />
      <span className="text-[10px] text-slate-500">{stockLabel(p.stock)}</span>
    </div>
    <div className="flex-shrink-0 text-right">
      {p.priceNetto != null ? (
        <span className="text-sm font-bold text-blue-600">{p.priceNetto.toFixed(2)} zł</span>
      ) : (
        <span className="text-[10px] text-slate-300">—</span>
      )}
    </div>
  </div>
);

// ═══ MAIN COMPONENT ═══
export const SpeckableIntegrator: React.FC<Props> = ({ integrationId, onSelectProduct, onAddToOwnCatalog }) => {
  const [categories, setCategories] = useState<SpeckableCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<SpeckableCategory | null>(null);
  const [products, setProducts] = useState<SpeckableProduct[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState<SpeckableProduct[] | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailProduct, setDetailProduct] = useState<SpeckableProduct | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [connectionError, setConnectionError] = useState('');
  const [dynamicSubcats, setDynamicSubcats] = useState<Record<string, SpeckableCategory[]>>({});
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client-side cache for product listings and product details (avoids re-fetching)
  const productsCache = useRef<Record<string, { products: SpeckableProduct[]; totalPages: number; totalProducts: number; hasProducts: boolean; categories: any[]; ts: number }>>({});
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Check authentication status on mount
  useEffect(() => {
    if (!integrationId) { setAuthStatus('unauthenticated'); return; }
    setAuthStatus('checking');
    speckableProxy('session', { integrationId })
      .then(r => setAuthStatus(r.authenticated ? 'authenticated' : 'unauthenticated'))
      .catch(() => setAuthStatus('unauthenticated'));
  }, [integrationId]);

  // Load categories
  useEffect(() => {
    setCatLoading(true);
    speckableProxy('categories', { integrationId })
      .then(data => {
        setCategories(data.categories || []);
        setCatLoading(false);
      })
      .catch(e => { setCatLoading(false); setConnectionError(e.message); });
  }, [integrationId]);

  // Load products by category (with client-side cache)
  useEffect(() => {
    if (!selectedCat) return;
    const cacheKey = `${selectedCat.slug}::${page}`;
    const cached = productsCache.current[cacheKey];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (cached.categories?.length > 0) {
        setDynamicSubcats(prev => ({ ...prev, [selectedCat.slug]: cached.categories }));
        setProducts([]);  // Parent category: show subcats, not products
      } else {
        setProducts(cached.products);
      }
      setTotalPages(cached.totalPages);
      setTotalCount(cached.totalProducts);
      setProdLoading(false);
      setProdError(null);
      setSearchResult(null);
      return;
    }
    setProdLoading(true);
    setProdError(null);
    speckableProxy('products', { integrationId, cat: selectedCat.slug, page })
      .then(data => {
        if (data.error) {
          setProdError(data.error);
          setProdLoading(false);
          return;
        }
        const cats = data.categories || [];
        const prods = data.products || [];
        // Cache the result
        productsCache.current[cacheKey] = {
          products: prods,
          totalPages: data.totalPages || 0,
          totalProducts: data.totalProducts || 0,
          hasProducts: data.hasProducts,
          categories: cats,
          ts: Date.now(),
        };
        // If category has subcategories → show subcats (parent category)
        // If no subcategories → show products (leaf category)
        if (cats.length > 0) {
          setDynamicSubcats(prev => ({ ...prev, [selectedCat.slug]: cats }));
          setProducts([]);  // Clear products so subcategory tiles render
        } else {
          setProducts(prods);
        }
        setTotalPages(data.totalPages || 0);
        setTotalCount(data.totalProducts || 0);
        setProdLoading(false);
        setSearchResult(null);
      })
      .catch(e => { setProdError(e.message); setProdLoading(false); });
  }, [selectedCat, page, integrationId]);

  // Fast search
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResult(null); setSearchLoading(false); return; }
    setSearchLoading(true);
    speckableProxy('search', { integrationId, q: q.trim() })
      .then(r => {
        setSearchResult(r.products || []);
        setSearchTotal(r.total || 0);
        setSearchLoading(false);
      })
      .catch(() => { setSearchResult([]); setSearchTotal(0); setSearchLoading(false); });
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

  // Merge dynamically discovered subcategories into category tree
  const enrichedCategories = categories.map(c => ({
    ...c,
    subcategories: dynamicSubcats[c.slug] || c.subcategories || [],
  }));

  // Subcategories for the currently selected category (shown as tiles when no products)
  const currentSubcats = selectedCat ? (dynamicSubcats[selectedCat.slug] || selectedCat.subcategories || []) : [];

  const display = searchResult !== null ? searchResult : products;
  const isLoading = searchLoading || prodLoading;
  const hasContent = selectedCat || searchResult !== null;

  if (authStatus === 'checking') {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span className="text-sm text-slate-500">Sprawdzanie sesji Speckable...</span>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="text-center py-12">
        <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700 mb-2">Wymagane logowanie do Speckable</h3>
        <p className="text-sm text-slate-500 mb-4">
          Aby przeglądać katalog i ceny netto, zaloguj się do konta Speckable w ustawieniach integracji.
        </p>
      </div>
    );
  }

  if (connectionError && categories.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700 mb-2">Nie udało się połączyć ze Speckable</h3>
        <p className="text-sm text-slate-500 mb-4">{connectionError}</p>
      </div>
    );
  }

  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
      {/* Sidebar: Categories */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
        <div className="px-3 py-2.5 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Kategorie Speckable
        </div>
        {catLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : enrichedCategories.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            Nie udało się załadować kategorii.
          </div>
        ) : (
          <div className="py-1">
            {enrichedCategories.map((c, i) => (
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
              placeholder="Szukaj w Speckable..."
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
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Package className="w-12 h-12 text-slate-200 mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">Katalog materiałów Speckable.pl</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Wybierz kategorię z listy po lewej, aby przeglądać i wyszukiwać produkty.
              </p>
              {enrichedCategories.length > 0 && (
                <div className="mt-6 w-full max-w-lg">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Główne kategorie</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {enrichedCategories.slice(0, 10).map((c, i) => (
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
          ) : currentSubcats.length > 0 && searchResult === null ? (
            <div>
              {selectedCat && (
                <h3 className="text-base font-semibold text-slate-800 mb-3">{selectedCat.name}</h3>
              )}
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Podkategorie</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {currentSubcats.map((sc, i) => (
                  <button
                    key={sc.slug || i}
                    onClick={() => { setSelectedCat(sc); setPage(1); }}
                    className="bg-white rounded-lg border border-slate-200 p-4 text-left hover:border-blue-400 hover:shadow-md transition-all"
                  >
                    {sc.image && (
                      <div className="h-20 flex items-center justify-center mb-2">
                        <img src={sc.image} alt="" className="max-w-[80%] max-h-16 object-contain" />
                      </div>
                    )}
                    <div className="text-xs font-medium text-slate-700">{sc.name}</div>
                  </button>
                ))}
              </div>
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
                      key={p.slug || i}
                      p={p}
                      onClick={() => setDetailProduct(p)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {display.map((p, i) => (
                    <ProductCardList
                      key={p.slug || i}
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
