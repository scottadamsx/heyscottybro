// ── Connected Pages: grocery price dataset parsing (connected-pages.md §2.1)
// Pure parsing/validation for the Finance "Import price snapshot" action.
// Accepts the local_grocery_prices dataset shape (CSV or JSON: store,
// product_name, brand, size_text, price_cad / price_with_tax_cad, size_g,
// size_ml, price_per_100g(_with_tax), price_per_100ml(_with_tax), url,
// category, capture_date) and the plan's canonical field names. Prices are
// integer cents; with-tax prices win when present (Scott's costing rule).

export function slugKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function checksumOf(text) {
  let h = 5381;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `djb2-${h.toString(16)}-${s.length}`;
}

/** Minimal CSV parser: quotes, escaped quotes, commas and newlines in fields. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== "")).map((r) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
}

function productKeyFor(row, storeKey, name, sizeText) {
  const url = String(row.url || row.product_url || "");
  if (url) {
    const parts = url.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    if (last) return last;
  }
  return slugKey(`${storeKey}-${name}-${sizeText}`);
}

function storeKeyFor(storeName) {
  const head = String(storeName || "").split("(")[0].trim();
  return slugKey(head) || "store";
}

const numOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Validate raw dataset rows into importable items.
 * Returns { items, rejected: [{ index, reason }], capturedAt } — capturedAt is
 * null when the rows carry no capture date (the caller refuses the import).
 */
export function rowsToPriceItems(rows) {
  const items = [];
  const rejected = [];
  let capturedAt = null;
  (rows || []).forEach((row, index) => {
    const reject = (reason) => rejected.push({ index, reason });
    const storeName = String(row.store_name || row.store || "").trim();
    const name = String(row.product_name || row.name || "").trim();
    if (!storeName) return reject("missing store");
    if (!name) return reject("missing product name");
    const capture = String(row.capture_date || row.captured_at || "").slice(0, 10);
    if (!capture) return reject("missing capture date");
    if (!capturedAt) capturedAt = capture;
    const withTax = numOrNull(row.price_with_tax_cad);
    const asCents = numOrNull(row.package_price_cents);
    const priceDollars = withTax != null ? withTax
      : asCents != null ? asCents / 100
        : (numOrNull(row.price_cad) ?? numOrNull(row.price));
    if (priceDollars == null || priceDollars < 0) return reject("missing or invalid price");
    const storeKey = String(row.store_key || "").trim() || storeKeyFor(storeName);
    const sizeText = String(row.size_text || row.package_label || "").trim();
    let unitKind = null;
    let qtyMilli = null;
    const sizeG = numOrNull(row.size_g);
    const sizeMl = numOrNull(row.size_ml);
    if (row.package_quantity_milliunits != null && row.unit_kind) {
      unitKind = row.unit_kind;
      qtyMilli = Math.round(Number(row.package_quantity_milliunits));
    } else if (sizeG != null && sizeG > 0) { unitKind = "mass"; qtyMilli = Math.round(sizeG * 1000); }
    else if (sizeMl != null && sizeMl > 0) { unitKind = "volume"; qtyMilli = Math.round(sizeMl * 1000); }
    else {
      const m = sizeText.match(/^([\d.]+)\s*(ea|each|count|ct)?\b/i);
      if (m) { unitKind = "count"; qtyMilli = Math.round(Number(m[1]) * 1000); }
    }
    if (!unitKind || !(qtyMilli > 0)) return reject("no usable package size");
    const per100 = unitKind === "mass"
      ? (numOrNull(row.price_per_100g_with_tax) ?? numOrNull(row.price_per_100g))
      : unitKind === "volume"
        ? (numOrNull(row.price_per_100ml_with_tax) ?? numOrNull(row.price_per_100ml))
        : null;
    items.push({
      store_key: storeKey,
      store_name: storeName,
      external_product_key: String(row.external_product_key || "").trim() || productKeyFor(row, storeKey, name, sizeText),
      product_name: name,
      normalized_name: name.toLowerCase().replace(/\s+/g, " ").trim(),
      brand: String(row.brand || "").trim() || null,
      category: String(row.category || "").trim() || null,
      product_url: String(row.url || row.product_url || "").trim() || null,
      package_label: sizeText || null,
      unit_kind: unitKind,
      package_quantity_milliunits: qtyMilli,
      package_price_cents: Math.round(priceDollars * 100),
      source_price_per_100_cents: per100 != null ? Math.round(per100 * 100 * 10000) / 10000 : null,
      availability: String(row.availability || "").trim() || null,
    });
  });
  return { items, rejected, capturedAt };
}

/** Parse a dataset file's text (CSV or JSON) into validated import items. */
export function parsePriceDataset(text, filename = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("That file is empty.");
  let rows;
  if (trimmed.startsWith("[") || trimmed.startsWith("{") || /\.json$/i.test(filename)) {
    const parsed = JSON.parse(trimmed);
    rows = Array.isArray(parsed) ? parsed : parsed.items || parsed.rows || [];
    if (!Array.isArray(rows)) throw new Error("The JSON does not contain a list of products.");
  } else {
    rows = parseCsv(trimmed);
  }
  if (!rows.length) throw new Error("No product rows were found in that file.");
  const out = rowsToPriceItems(rows);
  if (!out.capturedAt) throw new Error("This dataset has no capture date, so it cannot be imported as current prices.");
  return out;
}
