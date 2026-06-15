import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { toDateStr } from "../../utils/plannerUtils";
import {
  loadReceipts, loadReceiptItems, saveReceipt, deleteReceipt,
  uploadReceiptImage, receiptImageUrl, findOrCreateStore, postReceiptToBudget,
} from "../../api/groceryApi";
import { extractReceipt, fileToBase64 } from "../../api/aiReceipt";
import "./grocery.css";

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const blankItem = () => ({ raw_text: "", quantity: 1, unit_price: "", total_price: "" });

export default function GroceryPage() {
  const { addToast } = useToast();

  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  // New-receipt workflow
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState(null); // { store_name, purchase_date, subtotal, total, items:[] }
  const [addToBudget, setAddToBudget] = useState(true);
  const [saving, setSaving] = useState(false);

  // Receipt detail (expanded)
  const [openId, setOpenId] = useState(null);
  const [openItems, setOpenItems] = useState([]);
  const [openImg, setOpenImg] = useState("");

  const refresh = () => { setLoading(true); loadReceipts().then(setReceipts).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { refresh(); }, []);

  const lineSum = draft ? draft.items.reduce((s, it) => s + (Number(it.total_price) || 0), 0) : 0;

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setDraft(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  async function readReceipt() {
    if (!file) return;
    setExtracting(true);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const r = await extractReceipt(base64, mediaType);
      setDraft({
        store_name: r.store_name || "",
        purchase_date: r.purchase_date || toDateStr(new Date()),
        subtotal: r.subtotal ?? "",
        total: r.total ?? "",
        items: (r.items || []).map((it) => ({
          raw_text: it.raw_text || "",
          quantity: it.quantity ?? 1,
          unit_price: it.unit_price ?? "",
          total_price: it.total_price ?? "",
        })),
      });
      addToast(`Read ${r.items?.length || 0} item(s) from the receipt`, "success");
    } catch (err) {
      addToast(err.message || "Could not read the receipt", "error");
    } finally {
      setExtracting(false);
    }
  }

  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setItem = (i, k, v) => setDraft((d) => ({ ...d, items: d.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));
  const addRow = () => setDraft((d) => ({ ...d, items: [...d.items, blankItem()] }));
  const removeRow = (i) => setDraft((d) => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }));

  function resetForm() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setDraft(null);
  }

  async function save() {
    if (!draft) return;
    const total = Number(draft.total) || 0;
    if (!total) { addToast("Enter the receipt total", "error"); return; }
    setSaving(true);
    try {
      const store_id = draft.store_name?.trim() ? await findOrCreateStore(draft.store_name) : null;
      const purchase_date = draft.purchase_date || toDateStr(new Date());
      const receipt = await saveReceipt(
        {
          store_id,
          purchase_date,
          subtotal: draft.subtotal === "" ? null : Number(draft.subtotal),
          total,
        },
        draft.items.map((it) => ({
          raw_text: it.raw_text,
          quantity: it.quantity === "" ? 1 : Number(it.quantity),
          unit_price: it.unit_price === "" ? null : Number(it.unit_price),
          total_price: it.total_price === "" ? null : Number(it.total_price),
        })),
      );
      if (file) { try { await uploadReceiptImage(file, receipt.id); } catch { /* image optional */ } }
      if (addToBudget) {
        try {
          await postReceiptToBudget({ total, purchase_date, storeName: draft.store_name });
        } catch { addToast("Saved, but couldn't post to budget", "error"); }
      }
      addToast("Receipt saved", "success");
      resetForm();
      refresh();
    } catch (err) {
      addToast(err.message || "Could not save the receipt", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleOpen(r) {
    if (openId === r.id) { setOpenId(null); setOpenItems([]); setOpenImg(""); return; }
    setOpenId(r.id);
    setOpenItems([]);
    setOpenImg("");
    try { setOpenItems(await loadReceiptItems(r.id)); } catch { /* noop */ }
    if (r.image_path) { try { setOpenImg(await receiptImageUrl(r.image_path)); } catch { /* noop */ } }
  }

  async function removeReceipt(id) {
    if (!window.confirm("Delete this receipt? This does not remove any budget transaction it created.")) return;
    try { await deleteReceipt(id); if (openId === id) setOpenId(null); refresh(); addToast("Receipt deleted", "success"); }
    catch (err) { addToast(err.message || "Could not delete", "error"); }
  }

  const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "");

  return (
    <div className="module-page grocery-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-receipt" /> Groceries</h1>
        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          {receipts.length} receipt{receipts.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* ── Upload + review ── */}
      <div className="db-card">
        <h3 className="db-card-title"><i className="fa-solid fa-camera" /> Scan a receipt</h3>

        {!draft && (
          <div className="grocery-upload">
            <label className="btn btn-sm">
              <i className="fa-solid fa-image" /> {file ? "Choose a different photo" : "Choose receipt photo"}
              <input type="file" accept="image/*" capture="environment" onChange={pickFile} style={{ display: "none" }} />
            </label>
            {preview && (
              <div className="grocery-preview">
                <img src={preview} alt="Receipt preview" />
                <button className="btn btn-sm" onClick={readReceipt} disabled={extracting}>
                  {extracting
                    ? <><i className="fa-solid fa-spinner fa-spin" /> Reading…</>
                    : <><i className="fa-solid fa-wand-magic-sparkles" /> Read receipt</>}
                </button>
              </div>
            )}
            {!preview && <p className="no-entries">Snap or upload a photo of a grocery receipt and AI will pull out the items and total.</p>}
          </div>
        )}

        {draft && (
          <div className="grocery-review">
            <div className="grocery-review-grid">
              <label>Store
                <input value={draft.store_name} onChange={(e) => setField("store_name", e.target.value)} placeholder="Store name" />
              </label>
              <label>Date
                <input type="date" value={draft.purchase_date} onChange={(e) => setField("purchase_date", e.target.value)} />
              </label>
              <label>Subtotal
                <input type="number" step="0.01" value={draft.subtotal} onChange={(e) => setField("subtotal", e.target.value)} placeholder="—" />
              </label>
              <label>Total
                <input type="number" step="0.01" value={draft.total} onChange={(e) => setField("total", e.target.value)} placeholder="0.00" />
              </label>
            </div>

            <div className="grocery-items">
              <div className="grocery-item-head">
                <span>Item</span><span>Qty</span><span>Unit</span><span>Total</span><span />
              </div>
              {draft.items.map((it, i) => (
                <div className="grocery-item-row" key={i}>
                  <input value={it.raw_text} onChange={(e) => setItem(i, "raw_text", e.target.value)} placeholder="Item name" />
                  <input type="number" step="0.001" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} />
                  <input type="number" step="0.01" value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} placeholder="—" />
                  <input type="number" step="0.01" value={it.total_price} onChange={(e) => setItem(i, "total_price", e.target.value)} placeholder="0.00" />
                  <button className="btn-mini" onClick={() => removeRow(i)} title="Remove"><i className="fa-solid fa-xmark" /></button>
                </div>
              ))}
              <button className="btn btn-sm btn-secondary-sm" onClick={addRow}><i className="fa-solid fa-plus" /> Add item</button>
              {lineSum > 0 && (
                <p className="grocery-linesum">
                  Items add up to {money(lineSum)}
                  {Number(draft.total) > 0 && Math.abs(lineSum - Number(draft.total)) > 0.02 && (
                    <span style={{ color: "var(--text-muted)" }}> · total entered is {money(draft.total)}</span>
                  )}
                </p>
              )}
            </div>

            <label className="grocery-check">
              <input type="checkbox" checked={addToBudget} onChange={(e) => setAddToBudget(e.target.checked)} />
              Add {money(draft.total || 0)} to the budget as a Groceries expense
            </label>

            <div className="grocery-review-actions">
              <button className="btn btn-sm" onClick={save} disabled={saving}>
                {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : <><i className="fa-solid fa-floppy-disk" /> Save receipt</>}
              </button>
              <button className="btn btn-sm btn-secondary-sm" onClick={resetForm} disabled={saving}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ── History ── */}
      <div className="db-card">
        <h3 className="db-card-title"><i className="fa-solid fa-clock-rotate-left" /> Recent receipts</h3>
        {loading && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p>}
        {!loading && receipts.length === 0 && <p className="no-entries">No receipts yet. Scan one above.</p>}
        <div className="grocery-list">
          {receipts.map((r) => (
            <div className={`grocery-receipt${openId === r.id ? " open" : ""}`} key={r.id}>
              <button className="grocery-receipt-row" onClick={() => toggleOpen(r)}>
                <span className="grocery-receipt-main">
                  <strong>{r.store_name || "Store"}</strong>
                  <span className="grocery-receipt-sub">{fmtDate(r.purchase_date)} · {r.item_count} item{r.item_count === 1 ? "" : "s"}</span>
                </span>
                <span className="grocery-receipt-total">{money(r.total)}</span>
                <i className={`fa-solid fa-chevron-${openId === r.id ? "up" : "down"}`} />
              </button>
              {openId === r.id && (
                <div className="grocery-receipt-detail">
                  {openImg && <img className="grocery-receipt-img" src={openImg} alt="Receipt" />}
                  <div className="grocery-detail-items">
                    {openItems.length === 0 && <p className="no-entries">No itemized lines.</p>}
                    {openItems.map((it) => (
                      <div className="grocery-detail-line" key={it.id}>
                        <span>{it.raw_text}</span>
                        <span>{it.total_price != null ? money(it.total_price) : ""}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-sm btn-secondary-sm" onClick={() => removeReceipt(r.id)}>
                    <i className="fa-solid fa-trash" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
