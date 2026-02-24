import { useState, useEffect, useCallback, useRef } from "react";

/*
 * ─────────────────────────────────────────────
 *  TIM.pl Materials Portal
 *  Каталог матеріалів з гуртівні для кошторисування
 * ─────────────────────────────────────────────
 *
 *  SETUP:
 *  1. Запустіть проксі-сервер:
 *     cd tim-portal && npm install express cors node-fetch@2 && node server.js
 *  2. Встановіть PROXY_URL нижче на адресу вашого проксі
 *  3. Вставте цей компонент у ваш портал
 */

// ═══ КОНФІГУРАЦІЯ ═══
// Змініть на адресу вашого проксі-сервера:
const PROXY_URL = "http://localhost:3001/graphql";

// ═══ GraphQL Helper ═══
async function gql(query, token) {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

// ═══ GraphQL Queries ═══
const Q = {
  categories: `{
    category {
      _id name
      subcategories {
        _id name
        subcategories { _id name }
      }
    }
  }`,

  categoryProducts: (catId, page) => `{
    categoryProducts(id: ${catId}, pageSize: _48, currentPage: ${page}) {
      products { _id name sku ean ref_num manufacturer }
      total
      pages
    }
  }`,

  product: (sku) => `{
    product(id: "${sku}") {
      _id ean name
      price { value label }
      can_be_returned
      stock { qty unit }
      series { name }
      ref_num
      manufacturer { name }
      main_category { name
        subcategories { name
          subcategories { name }
        }
      }
      attributes_block { label value }
      is_wire is_vendor available package_size
      shipping { type time }
      default_image
    }
  }`,
};

// ═══ SVG Icons ═══
const I = {
  search: <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  folder: <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8"/></svg>,
  chev: <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  plus: <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  x: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  cart: <svg width="19" height="19" fill="none" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="1.8"/></svg>,
  grid: <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.8" rx="1"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.8" rx="1"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.8" rx="1"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.8" rx="1"/></svg>,
  list: <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  trash: <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  warn: <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="m10.29 3.86-8.6 14.98A2 2 0 0 0 3.4 22h17.2a2 2 0 0 0 1.71-3.16l-8.6-14.98a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  box: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="1.8"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.8"/></svg>,
};

// ═══ Estimate (кошторис) Store ═══
function useEstimate() {
  const [items, setItems] = useState([]);
  const add = useCallback((p) => {
    setItems((prev) => {
      const key = p.sku || p._id;
      const ex = prev.find((i) => i.sku === key);
      if (ex) return prev.map((i) => (i.sku === key ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { sku: key, name: p.name, price: p.price, image: p.default_image, mfr: typeof p.manufacturer === "object" ? p.manufacturer?.name : p.manufacturer, qty: 1 }];
    });
  }, []);
  const remove = useCallback((sku) => setItems((p) => p.filter((i) => i.sku !== sku)), []);
  const setQty = useCallback((sku, q) => {
    if (q < 1) return setItems((p) => p.filter((i) => i.sku !== sku));
    setItems((p) => p.map((i) => (i.sku === sku ? { ...i, qty: q } : i)));
  }, []);
  const parsePrice = (p) => parseFloat(String(typeof p === "object" ? p?.value : p || "0").replace(",", ".").replace(/[^\d.]/g, "")) || 0;
  const total = items.reduce((s, i) => s + parsePrice(i.price) * i.qty, 0);
  return { items, add, remove, setQty, total, count: items.length, parsePrice };
}

// ═══ Category Tree Node ═══
function CatNode({ c, depth, sel, onPick }) {
  const [open, setOpen] = useState(false);
  const hasSub = c.subcategories?.length > 0;
  const active = sel === c._id;
  return (
    <div>
      <div
        onClick={() => { onPick(c); if (hasSub) setOpen(!open); }}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", paddingLeft: 8 + depth * 18, cursor: "pointer", fontSize: 12.5, borderRadius: 5, margin: "1px 5px", fontWeight: active ? 600 : 400, background: active ? "#fff3ed" : "transparent", color: active ? "#b5421a" : "#444", transition: "background .12s" }}
        onMouseEnter={(e) => !active && (e.currentTarget.style.background = "#f5f3f0")}
        onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
      >
        {hasSub ? <span style={{ display: "flex", transform: open ? "rotate(90deg)" : "none", transition: "transform .18s", opacity: .45, flexShrink: 0 }}>{I.chev}</span> : <span style={{ width: 13, flexShrink: 0 }} />}
        <span style={{ opacity: .4, flexShrink: 0 }}>{I.folder}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
      </div>
      {open && hasSub && c.subcategories.map((s) => <CatNode key={s._id} c={s} depth={depth + 1} sel={sel} onPick={onPick} />)}
    </div>
  );
}

// ═══ Product Card ═══
function Card({ p, mode, onPick, onAdd }) {
  const mfr = typeof p.manufacturer === "object" ? p.manufacturer?.name : p.manufacturer;
  const priceStr = p.price ? (typeof p.price === "object" ? p.price.value : p.price) : null;

  const addBtn = (sz) => (
    <button onClick={(e) => { e.stopPropagation(); onAdd(p); }} style={{ background: "#b5421a", color: "#fff", border: "none", borderRadius: 5, padding: sz === "sm" ? "5px 8px" : "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, transition: "background .12s", flexShrink: 0 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#933618")} onMouseLeave={(e) => (e.currentTarget.style.background = "#b5421a")}>
      {I.plus}{sz !== "sm" && " До кошторису"}
    </button>
  );

  const imgBox = (size) => (
    <div style={{ width: size, height: size, background: "#f5f2ee", borderRadius: mode === "grid" ? 0 : 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
      {p.default_image
        ? <img src={p.default_image} alt="" style={{ maxWidth: "88%", maxHeight: "88%", objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; e.target.parentElement.innerHTML = '<span style="color:#ccc;font-size:24px">📦</span>'; }} />
        : <span style={{ color: "#ccc", fontSize: size > 60 ? 36 : 22 }}>📦</span>}
    </div>
  );

  if (mode === "grid") {
    return (
      <div onClick={() => onPick(p)} style={{ background: "#fff", borderRadius: 8, border: "1px solid #e6e2dc", overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", transition: "border-color .15s, box-shadow .15s" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#b5421a"; e.currentTarget.style.boxShadow = "0 3px 16px rgba(181,66,26,.08)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e6e2dc"; e.currentTarget.style.boxShadow = "none"; }}>
        <div style={{ height: 150, borderBottom: "1px solid #ede9e4", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f7f4" }}>
          {imgBox(130)}
        </div>
        <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, color: "#999", fontFamily: "monospace", letterSpacing: .3 }}>SKU: {p.sku || p._id}</div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "#222", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", minHeight: 48 }}>{p.name}</div>
          {mfr && <div style={{ fontSize: 11, color: "#888" }}>{mfr}</div>}
          <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f0ece8" }}>
            {priceStr ? <div style={{ fontSize: 15, fontWeight: 700, color: "#b5421a" }}>{priceStr} <span style={{ fontSize: 11, fontWeight: 400, color: "#999" }}>zł</span></div> : <div style={{ fontSize: 11, color: "#bbb" }}>—</div>}
            {addBtn("sm")}
          </div>
        </div>
      </div>
    );
  }

  // list mode
  return (
    <div onClick={() => onPick(p)} style={{ background: "#fff", borderRadius: 6, border: "1px solid #e6e2dc", padding: "8px 12px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "border-color .12s" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#b5421a")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e6e2dc")}>
      {imgBox(52)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
        <div style={{ fontSize: 11, color: "#999", fontFamily: "monospace" }}>{p.sku || p._id}{mfr ? ` · ${mfr}` : ""}</div>
      </div>
      {priceStr && <div style={{ fontSize: 14, fontWeight: 700, color: "#b5421a", flexShrink: 0 }}>{priceStr} zł</div>}
      {addBtn("sm")}
    </div>
  );
}

// ═══ Product Detail Panel ═══
function Detail({ sku, onClose, onAdd }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    gql(Q.product(sku))
      .then((r) => { setD(r.product); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, [sku]);

  if (loading) return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, padding: 60, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 13, color: "#999" }}>Завантаження даних товару...</div>
      </div>
    </div>
  );

  if (err || !d) return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, padding: 40, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ color: "#b5421a", marginBottom: 8 }}>{I.warn}</div>
        <div style={{ fontSize: 13, color: "#b5421a" }}>Помилка: {err || "Товар не знайдено"}</div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>SKU: {sku}</div>
        <button onClick={onClose} style={{ marginTop: 16, padding: "8px 20px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13 }}>Закрити</button>
      </div>
    </div>
  );

  const mfr = d.manufacturer?.name || "—";
  const pv = d.price ? d.price.value : null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #ebe7e2" }}>
          <span style={{ fontSize: 11, color: "#999", fontFamily: "monospace" }}>SKU: {d._id || sku}{d.ean ? ` · EAN: ${d.ean}` : ""}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: 2 }}>{I.x}</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {/* Image */}
          <div style={{ width: 260, minHeight: 220, background: "#f5f2ee", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {d.default_image
              ? <img src={d.default_image} alt="" style={{ maxWidth: "90%", maxHeight: 210, objectFit: "contain" }} />
              : <span style={{ fontSize: 56, opacity: .3 }}>📦</span>}
          </div>

          {/* Info */}
          <div style={{ flex: 1, padding: "16px 20px", minWidth: 260 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#222", margin: "0 0 8px", lineHeight: 1.35 }}>{d.name}</h2>
            <div style={{ fontSize: 12, color: "#777" }}>Виробник: <b style={{ color: "#333" }}>{mfr}</b></div>
            {d.ref_num && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Ref: {d.ref_num}</div>}

            {/* Price block */}
            <div style={{ margin: "14px 0 10px", padding: "10px 14px", background: "#faf8f5", borderRadius: 7, border: "1px solid #ebe7e2" }}>
              <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>Ціна</div>
              {pv
                ? <div style={{ fontSize: 22, fontWeight: 700, color: "#b5421a" }}>{pv} <span style={{ fontSize: 13, fontWeight: 400 }}>zł netto</span></div>
                : <div style={{ fontSize: 12, color: "#bbb" }}>Недоступна (потрібен токен або товар без ціни)</div>}
              {d.price?.label && <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{d.price.label}</div>}
            </div>

            {/* Badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {d.stock && <Badge label="Склад" val={`${d.stock.qty} ${d.stock.unit || "шт"}`} />}
              {d.shipping?.time && <Badge label="Доставка" val={d.shipping.time} />}
              {d.package_size && <Badge label="Габарит" val={d.package_size} />}
              {d.available !== undefined && <Badge label="Наявність" val={d.available ? "✓ Є" : "✗ Ні"} color={d.available ? "#2a8" : "#c44"} />}
              {d.is_wire !== undefined && d.is_wire ? <Badge label="Різаний" val="Кабель" /> : null}
              {d.is_vendor !== undefined && <Badge label="Склад" val={d.is_vendor ? "Зовнішній" : "TIM центральний"} />}
              {d.can_be_returned !== undefined && <Badge label="Повернення" val={d.can_be_returned ? "Можливо" : "Ні"} />}
            </div>

            {/* Series */}
            {d.series?.name && <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Серія: <b>{d.series.name}</b></div>}

            {/* Main category path */}
            {d.main_category?.name && (
              <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
                Категорія: {d.main_category.name}
                {d.main_category.subcategories?.[0]?.name && ` › ${d.main_category.subcategories[0].name}`}
              </div>
            )}

            <button onClick={() => onAdd(d)} style={{ width: "100%", padding: "11px", background: "#b5421a", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "background .12s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#933618")} onMouseLeave={(e) => (e.currentTarget.style.background = "#b5421a")}>
              {I.plus} Додати до кошторису
            </button>
          </div>
        </div>

        {/* Attributes */}
        {d.attributes_block?.length > 0 && (
          <div style={{ padding: "4px 18px 18px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6, marginTop: 4 }}>Технічні характеристики</div>
            <div style={{ background: "#fff", borderRadius: 6, border: "1px solid #ebe7e2", overflow: "hidden" }}>
              {d.attributes_block.map((a, i) => (
                <div key={i} style={{ display: "flex", padding: "6px 12px", fontSize: 11.5, borderBottom: i < d.attributes_block.length - 1 ? "1px solid #f3f0ec" : "none", background: i % 2 ? "#fff" : "#faf8f6" }}>
                  <div style={{ width: "42%", color: "#888", flexShrink: 0 }}>{a.label}</div>
                  <div style={{ color: "#333", fontWeight: 500 }}>{a.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ label, val, color }) {
  return (
    <span style={{ padding: "3px 8px", background: "#f5f3f0", borderRadius: 4, fontSize: 10.5, color: color || "#666" }}>
      <span style={{ color: "#aaa" }}>{label}:</span> <b>{val}</b>
    </span>
  );
}

const overlayStyle = { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(25,22,18,.45)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "36px 16px", overflowY: "auto", backdropFilter: "blur(3px)" };
const modalStyle = { background: "#faf8f5", borderRadius: 12, maxWidth: 700, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,.18)", overflow: "hidden", animation: "tmSlideUp .25s ease-out" };

// ═══ Estimate Sidebar ═══
function EstPanel({ est, onClose }) {
  const exportCSV = () => {
    const rows = [["SKU", "Назва", "Виробник", "Кількість", "Ціна од.", "Сума"].join(";")];
    est.items.forEach((i) => {
      const p = est.parsePrice(i.price);
      rows.push([i.sku, `"${i.name}"`, i.mfr || "", i.qty, p.toFixed(2), (p * i.qty).toFixed(2)].join(";"));
    });
    rows.push(["", "", "", "", "РАЗОМ:", est.total.toFixed(2)].join(";"));
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `koshtorys_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 370, maxWidth: "92vw", background: "#faf8f5", boxShadow: "-6px 0 28px rgba(0,0,0,.1)", zIndex: 999, display: "flex", flexDirection: "column", animation: "tmSlideR .22s ease-out" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid #ebe7e2", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>🧾 Кошторис ({est.count})</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}>{I.x}</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {est.items.length === 0
          ? <div style={{ textAlign: "center", padding: 36, color: "#bbb", fontSize: 13, lineHeight: 1.6 }}>Кошторис порожній.<br />Додайте матеріали з каталогу.</div>
          : est.items.map((it) => {
              const up = est.parsePrice(it.price);
              return (
                <div key={it.sku} style={{ background: "#fff", borderRadius: 7, border: "1px solid #ebe7e2", padding: "9px 11px", marginBottom: 7 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    {it.image && <img src={it.image} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, background: "#f5f2ee" }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: "#333", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      <div style={{ fontSize: 10, color: "#aaa", fontFamily: "monospace" }}>{it.sku}{it.mfr ? ` · ${it.mfr}` : ""}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Btn onClick={() => est.setQty(it.sku, it.qty - 1)}>−</Btn>
                      <input type="number" value={it.qty} onChange={(e) => est.setQty(it.sku, parseInt(e.target.value) || 0)} style={{ width: 42, textAlign: "center", border: "1px solid #ddd", borderRadius: 4, padding: "2px 3px", fontSize: 12.5, fontWeight: 600, outline: "none" }} />
                      <Btn onClick={() => est.setQty(it.sku, it.qty + 1)}>+</Btn>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {up > 0 && <span style={{ fontSize: 12.5, fontWeight: 600, color: "#b5421a" }}>{(up * it.qty).toFixed(2)} zł</span>}
                      <button onClick={() => est.remove(it.sku)} style={{ background: "none", border: "none", cursor: "pointer", color: "#c44", opacity: .5, padding: 2 }}>{I.trash}</button>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {est.items.length > 0 && (
        <div style={{ padding: "12px 18px", borderTop: "2px solid #b5421a", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "#888" }}>Разом netto:</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#b5421a" }}>{est.total.toFixed(2)} zł</span>
          </div>
          <button onClick={exportCSV} style={{ width: "100%", padding: 11, background: "#222", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            📥 Експорт CSV
          </button>
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick }) {
  return <button onClick={onClick} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</button>;
}

// ═══ MAIN COMPONENT ═══
export default function TIMPortal() {
  const [cats, setCats] = useState([]);
  const [catLoad, setCatLoad] = useState(true);
  const [selCat, setSelCat] = useState(null);
  const [products, setProducts] = useState([]);
  const [prodLoad, setProdLoad] = useState(false);
  const [prodErr, setProdErr] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [detailSku, setDetailSku] = useState(null);
  const [view, setView] = useState("grid");
  const [showEst, setShowEst] = useState(false);
  const [proxyOk, setProxyOk] = useState(null); // null=checking, true=ok, false=error
  const [errMsg, setErrMsg] = useState("");
  const est = useEstimate();
  const searchRef = useRef(null);

  // Check proxy
  useEffect(() => {
    const proxyBase = PROXY_URL.replace("/graphql", "");
    fetch(proxyBase).then((r) => r.ok ? setProxyOk(true) : setProxyOk(false)).catch(() => setProxyOk(false));
  }, []);

  // Load categories
  useEffect(() => {
    if (proxyOk !== true) return;
    setCatLoad(true);
    gql(Q.categories)
      .then((r) => { setCats(r.category || []); setCatLoad(false); })
      .catch((e) => { setCatLoad(false); setErrMsg(e.message); });
  }, [proxyOk]);

  // Load products by category
  useEffect(() => {
    if (!selCat || proxyOk !== true) return;
    setProdLoad(true);
    setProdErr(null);
    gql(Q.categoryProducts(selCat._id, page))
      .then((r) => {
        const cp = r.categoryProducts;
        setProducts(cp?.products || []);
        setTotalPages(cp?.pages || 0);
        setTotalCount(cp?.total || 0);
        setProdLoad(false);
        setSearchResult(null);
      })
      .catch((e) => { setProdErr(e.message); setProdLoad(false); });
  }, [selCat, page, proxyOk]);

  // Search by SKU
  const doSearch = useCallback((q) => {
    if (!q.trim() || proxyOk !== true) { setSearchResult(null); return; }
    setProdLoad(true);
    gql(Q.product(q.trim()))
      .then((r) => {
        if (r.product) {
          setSearchResult([{ ...r.product, sku: r.product._id || q.trim() }]);
        } else {
          setSearchResult([]);
        }
        setProdLoad(false);
      })
      .catch(() => { setSearchResult([]); setProdLoad(false); });
  }, [proxyOk]);

  const onSearchChange = (v) => {
    setSearch(v);
    clearTimeout(searchRef.current);
    if (v.length >= 3) searchRef.current = setTimeout(() => doSearch(v), 500);
    else setSearchResult(null);
  };

  const addToEst = (p) => {
    est.add({ sku: p.sku || p._id, name: p.name, price: p.price, default_image: p.default_image, manufacturer: p.manufacturer });
  };

  const pickProduct = (p) => setDetailSku(p.sku || p._id);
  const display = searchResult !== null ? searchResult : products;

  return (
    <div style={{ fontFamily: "'Nunito Sans','Segoe UI',system-ui,sans-serif", minHeight: "100vh", background: "#efeae4", color: "#222" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700;800&display=swap');
        @keyframes tmSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes tmSlideR{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes tmFade{from{opacity:0}to{opacity:1}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#d4cec6;border-radius:3px}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ background: "#1e1b18", color: "#fff", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "#b5421a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, letterSpacing: -.5 }}>TIM</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.2 }}>Матеріали</div>
            <div style={{ fontSize: 9.5, color: "#888", marginTop: -1 }}>TIM.pl · Каталог для кошторисування</div>
          </div>
        </div>
        <button onClick={() => setShowEst(true)} style={{ background: est.count > 0 ? "#b5421a" : "rgba(255,255,255,.07)", border: "none", borderRadius: 7, padding: "7px 14px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
          {I.cart} Кошторис
          {est.count > 0 && <span style={{ background: "#fff", color: "#b5421a", borderRadius: 10, padding: "0 6px", fontSize: 11, fontWeight: 700 }}>{est.count}</span>}
        </button>
      </header>

      {/* Proxy status banner */}
      {proxyOk === false && (
        <div style={{ background: "#fef3e8", borderBottom: "1px solid #fcd49e", padding: "14px 22px", fontSize: 12.5, color: "#7a5200", lineHeight: 1.6 }}>
          <b>⚠ Проксі-сервер недоступний</b> ({PROXY_URL.replace("/graphql", "")})<br />
          Для роботи потрібен проксі. Запустіть:
          <code style={{ display: "block", margin: "6px 0", padding: "8px 12px", background: "#fff8ef", borderRadius: 4, fontSize: 12, color: "#444" }}>
            cd tim-portal && npm install express cors node-fetch@2 && node server.js
          </code>
          Проксі перенаправлятиме запити на <b>tim.pl/graphql</b> і обходить CORS.
        </div>
      )}
      {proxyOk === null && (
        <div style={{ padding: "10px 22px", fontSize: 12, color: "#999", background: "#f8f6f3", borderBottom: "1px solid #eee" }}>
          Перевірка з'єднання з проксі-сервером...
        </div>
      )}

      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* ── SIDEBAR ── */}
        <aside style={{ width: 270, flexShrink: 0, background: "#fff", borderRight: "1px solid #e6e2dc", overflowY: "auto" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #f0ece8", fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>Категорії</div>
          {catLoad
            ? <div style={{ padding: 24, textAlign: "center", color: "#ccc", fontSize: 12 }}>Завантаження...</div>
            : cats.length === 0
              ? <div style={{ padding: 20, textAlign: "center", color: "#bbb", fontSize: 12, lineHeight: 1.6 }}>
                  Категорії не завантажені.
                  {proxyOk === false && " Запустіть проксі-сервер."}
                  {errMsg && <div style={{ marginTop: 6, fontSize: 11, color: "#c44" }}>{errMsg}</div>}
                </div>
              : <div style={{ padding: "4px 0" }}>{cats.map((c) => <CatNode key={c._id} c={c} depth={0} sel={selCat?._id} onPick={(cat) => { setSelCat(cat); setPage(1); setSearch(""); setSearchResult(null); }} />)}</div>}
        </aside>

        {/* ── MAIN ── */}
        <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* Search bar */}
          <div style={{ padding: "12px 20px", background: "#fff", borderBottom: "1px solid #e6e2dc", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 10 }}>
            <div style={{ flex: 1, maxWidth: 480, display: "flex", alignItems: "center", background: "#f5f3f0", borderRadius: 7, padding: "0 12px", border: "1px solid #e6e2dc" }}>
              <span style={{ color: "#bbb" }}>{I.search}</span>
              <input value={search} onChange={(e) => onSearchChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch(search)} placeholder="Пошук по SKU (напр. 1115-247BY-FA013)..."
                style={{ flex: 1, border: "none", background: "transparent", padding: "9px 10px", fontSize: 13, outline: "none", color: "#333" }} />
              {search && <button onClick={() => { setSearch(""); setSearchResult(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", padding: 2 }}>{I.x}</button>}
            </div>

            <div style={{ display: "flex", gap: 3, background: "#f5f3f0", borderRadius: 5, padding: 2 }}>
              {["grid", "list"].map((m) => (
                <button key={m} onClick={() => setView(m)} style={{ padding: "5px 7px", border: "none", borderRadius: 3, cursor: "pointer", background: view === m ? "#fff" : "transparent", color: view === m ? "#b5421a" : "#aaa", boxShadow: view === m ? "0 1px 3px rgba(0,0,0,.06)" : "none" }}>
                  {m === "grid" ? I.grid : I.list}
                </button>
              ))}
            </div>

            {selCat && !searchResult && (
              <span style={{ fontSize: 11.5, color: "#aaa", whiteSpace: "nowrap" }}>{totalCount} товарів</span>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: 20 }}>
            {!selCat && !searchResult ? (
              /* Landing state */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "30px 16px", animation: "tmFade .35s" }}>
                <div style={{ marginBottom: 18, opacity: .9 }}>{I.box}</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>Каталог матеріалів TIM.pl</h2>
                <p style={{ fontSize: 13, color: "#888", maxWidth: 400, lineHeight: 1.55, margin: 0 }}>
                  Оберіть категорію зліва або знайдіть товар по SKU.<br />
                  Додавайте матеріали до кошторису → експортуйте CSV.
                </p>
                {cats.length > 0 && (
                  <div style={{ marginTop: 28, width: "100%", maxWidth: 580 }}>
                    <div style={{ fontSize: 10, color: "#bbb", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Основні категорії</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
                      {cats.slice(0, 10).map((c) => (
                        <button key={c._id} onClick={() => { setSelCat(c); setPage(1); }}
                          style={{ background: "#fff", border: "1px solid #e6e2dc", borderRadius: 6, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#444", transition: "all .12s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#b5421a"; e.currentTarget.style.color = "#b5421a"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e6e2dc"; e.currentTarget.style.color = "#444"; }}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : prodLoad ? (
              <div style={{ textAlign: "center", padding: 50, color: "#aaa", fontSize: 13 }}>Завантаження товарів...</div>
            ) : prodErr ? (
              <div style={{ textAlign: "center", padding: 30, background: "#fff", borderRadius: 8, border: "1px solid #e6e2dc" }}>
                <div style={{ color: "#b5421a", fontSize: 13, marginBottom: 4 }}>Помилка завантаження</div>
                <div style={{ fontSize: 12, color: "#aaa" }}>{prodErr}</div>
              </div>
            ) : display.length === 0 ? (
              <div style={{ textAlign: "center", padding: 50, color: "#aaa", fontSize: 13 }}>
                {searchResult !== null ? `Товар «${search}» не знайдено. Спробуйте повний SKU.` : "Товарів у цій категорії немає."}
              </div>
            ) : (
              <>
                {selCat && !searchResult && <div style={{ marginBottom: 14 }}><h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{selCat.name}</h3></div>}
                {searchResult !== null && <div style={{ marginBottom: 12, fontSize: 12, color: "#888" }}>Результат пошуку: {searchResult.length}</div>}

                <div style={view === "grid"
                  ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }
                  : { display: "flex", flexDirection: "column", gap: 7 }}>
                  {display.map((p, i) => <Card key={p.sku || p._id || i} p={p} mode={view} onPick={pickProduct} onAdd={addToEst} />)}
                </div>

                {/* Pagination */}
                {totalPages > 1 && !searchResult && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 22, paddingBottom: 16 }}>
                    <PgBtn disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</PgBtn>
                    <span style={{ fontSize: 12, color: "#888", padding: "0 6px" }}>{page} / {totalPages}</span>
                    <PgBtn disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Далі →</PgBtn>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Detail modal */}
      {detailSku && <Detail sku={detailSku} onClose={() => setDetailSku(null)} onAdd={(p) => { addToEst(p); setDetailSku(null); }} />}

      {/* Estimate sidebar */}
      {showEst && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", zIndex: 998 }} onClick={() => setShowEst(false)} />
          <EstPanel est={est} onClose={() => setShowEst(false)} />
        </>
      )}
    </div>
  );
}

function PgBtn({ children, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "7px 14px", border: "1px solid #ddd", borderRadius: 5, background: "#fff", cursor: disabled ? "default" : "pointer", opacity: disabled ? .4 : 1, fontSize: 12 }}>
      {children}
    </button>
  );
}
