import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { toDateStr } from "../../utils/plannerUtils";
import {
  loadReceipts, loadReceiptItems, saveReceipt, updateReceipt, deleteReceipt,
  uploadReceiptImage, receiptImageUrl, findOrCreateStore, postReceiptToBudget,
} from "../../api/groceryApi";
import { extractReceipt, fileToBase64 } from "../../api/aiReceipt";
import "./grocery.css";
import DatePicker from "../../components/DatePicker";
import { FormModal, Field } from "../../components/ui";
import { useConfirm } from "../../hooks/useConfirm";
import { SkeletonList } from "../../components/Skeleton";

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const blankItem = () => ({ raw_text: "", quantity: 1, unit_price: "", total_price: "" });

export default function GroceryPage() {
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();

  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // a failed load is NOT "no receipts"

  // New-receipt workflow
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState(null); // { store_name, purchase_date, subtotal, total, items:[] }
  const [addToBudget, setAddToBudget] = useState(true);
  const [formOpen, setFormOpen] = useState(false); // the scan/edit modal
  const [editingId, setEditingId] = useState(null); // receipt.id when the form edits an existing receipt

  // Receipt detail (expanded)
  const [openId, setOpenId] = useState(null);
  const [openItems, setOpenItems] = useState([]);
  const [openImg, setOpenImg] = useState("");

  const refresh = () => {
    setLoading(true);
    loadReceipts()
      .then((rows) => { setReceipts(rows); setLoadError(null); })
      .catch((err) => {
        console.error("[grocery] load receipts failed", err);
        setLoadError(`Couldn't load receipts: ${err?.message || err}`);
        addToast(`Couldn't load receipts: ${err?.message || err}`, "error");
      })
      .finally(() => setLoading(false));
  };
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
    setFormOpen(false);
    setEditingId(null);
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setDraft(null);
  }

  // Called by the FormModal: a thrown error stays in the modal with the draft intact.
  async function save() {
    if (!draft) throw new Error("Read a receipt photo first.");
    const total = Number(draft.total) || 0;
    if (!total) throw new Error("Enter the receipt total.");
    try {
      const store_id = draft.store_name?.trim() ? await findOrCreateStore(draft.store_name) : null;
      const purchase_date = draft.purchase_date || toDateStr(new Date());
      const header = {
        store_id,
        purchase_date,
        subtotal: draft.subtotal === "" || draft.subtotal == null ? null : Number(draft.subtotal),
        total,
      };
      const rows = draft.items.map((it) => ({
        raw_text: it.raw_text,
        quantity: it.quantity === "" ? 1 : Number(it.quantity),
        unit_price: it.unit_price === "" || it.unit_price == null ? null : Number(it.unit_price),
        total_price: it.total_price === "" || it.total_price == null ? null : Number(it.total_price),
      }));
      if (editingId) {
        await updateReceipt(editingId, header, rows);
        addToast("Receipt updated", "success");
        if (openId === editingId) { try { setOpenItems(await loadReceiptItems(editingId)); } catch { /* noop */ } }
        refresh();
        return; // the modal closes and resets the form
      }
      const receipt = await saveReceipt(header, rows);
      if (file) { try { await uploadReceiptImage(file, receipt.id); } catch { /* image optional */ } }
      if (addToBudget) {
        try {
          await postReceiptToBudget({ total, purchase_date, storeName: draft.store_name });
        } catch { addToast("Saved, but couldn't post to budget", "error"); }
      }
      addToast("Receipt saved", "success");
      refresh();
    } catch (err) {
      throw new Error(`Couldn't save the receipt: ${err?.message || err}`, { cause: err });
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

  // Load an existing receipt into the review form (same form, keyed on receipt.id).
  async function startEdit(r) {
    let items = openId === r.id ? openItems : [];
    if (openId !== r.id) { try { items = await loadReceiptItems(r.id); } catch { items = []; } }
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setEditingId(r.id);
    setDraft({
      store_name: r.store_name || "",
      purchase_date: r.purchase_date || toDateStr(new Date()),
      subtotal: r.subtotal ?? "",
      total: r.total ?? "",
      items: items.map((it) => ({
        raw_text: it.raw_text || "",
        quantity: it.quantity ?? 1,
        unit_price: it.unit_price ?? "",
        total_price: it.total_price ?? "",
      })),
    });
    setFormOpen(true);
  }

  function openScan() {
    resetForm();
    setFormOpen(true);
  }

  async function removeReceipt(id) {
    if (!await confirm("Delete this receipt? This does not remove any budget transaction it created.", { title: "Delete receipt", confirmLabel: "Delete" })) return;
    try { await deleteReceipt(id); if (openId === id) setOpenId(null); if (editingId === id) resetForm(); refresh(); addToast("Receipt deleted", "success"); }
    catch (err) { addToast(err.message || "Could not delete", "error"); }
  }

  const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "");

  return (
    <div className="grocery-page">
      {dialog}

      {/* ── Scan / edit: one modal (DR-019) ── */}
      {formOpen && (
      <FormModal
        title={editingId ? "Edit receipt" : "Scan a receipt"}
        width={640}
        submitLabel={editingId ? "Save changes" : "Save receipt"}
        submitDisabled={!draft || extracting}
        onClose={resetForm}
        onSubmit={save}
      >
        {!draft && (
          <div className="grocery-upload">
            {!preview && <p className="money-card-note grocery-intro">Choose a photo of the receipt, then let AI read it. You can check and fix every line before saving.</p>}
            <label className={`grocery-pick ${preview ? "btn-sm btn-secondary-sm" : "btn btn-sm"}`}>
              <i className="fa-solid fa-image" aria-hidden="true" /> {file ? "Choose a different photo" : "Choose receipt photo"}
              <input type="file" accept="image/*" capture="environment" onChange={pickFile} className="visually-hidden" />
            </label>
            {preview && (
              <div className="grocery-preview">
                <img src={preview} alt="Receipt preview" />
                <button type="button" className="btn btn-sm" onClick={readReceipt} disabled={extracting}>
                  {extracting
                    ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Reading…</>
                    : <><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Read receipt</>}
                </button>
              </div>
            )}
          </div>
        )}

        {draft && (
          <div className="grocery-review" key={editingId || "new"}>
            {editingId && <p className="grocery-edit-note">Editing a saved receipt — changes replace its store, date, totals and item lines. Budget transactions are not touched.</p>}
            <div className="grocery-review-grid">
              <Field label="Store">
                <input data-autofocus value={draft.store_name} onChange={(e) => setField("store_name", e.target.value)} placeholder="Store name" />
              </Field>
              <div className="uik-field"><span className="field-label">Date</span>
                <DatePicker value={draft.purchase_date} onChange={(v) => setField("purchase_date", v)} />
              </div>
              <Field label="Subtotal">
                <input type="number" inputMode="decimal" step="0.01" value={draft.subtotal} onChange={(e) => setField("subtotal", e.target.value)} placeholder="—" />
              </Field>
              <Field label="Total">
                <input type="number" inputMode="decimal" step="0.01" value={draft.total} onChange={(e) => setField("total", e.target.value)} placeholder="0.00" />
              </Field>
            </div>

            <div className="grocery-items">
              <div className="grocery-item-head" aria-hidden="true">
                <span>Item</span><span>Qty</span><span>Unit</span><span>Total</span><span />
              </div>
              {draft.items.map((it, i) => (
                <div className="grocery-item-row" key={i}>
                  <input value={it.raw_text} onChange={(e) => setItem(i, "raw_text", e.target.value)} placeholder="Item name" aria-label="Item" />
                  <input type="number" step="0.001" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} aria-label="Quantity" />
                  <input type="number" step="0.01" value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} placeholder="—" aria-label="Unit price" />
                  <input type="number" step="0.01" value={it.total_price} onChange={(e) => setItem(i, "total_price", e.target.value)} placeholder="0.00" aria-label="Line total" />
                  <button type="button" className="icon-x sm" onClick={() => removeRow(i)} title="Remove" aria-label={`Remove ${it.raw_text || "item"}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              ))}
              <button type="button" className="btn-sm btn-secondary-sm grocery-add" onClick={addRow}><i className="fa-solid fa-plus" aria-hidden="true" /> Add item</button>
              {lineSum > 0 && (
                <p className="grocery-linesum">
                  Items add up to {money(lineSum)}
                  {Number(draft.total) > 0 && Math.abs(lineSum - Number(draft.total)) > 0.02 && (
                    <span className="grocery-linesum-diff"> · total entered is {money(draft.total)}</span>
                  )}
                </p>
              )}
            </div>

            {!editingId && (
              <label className="checkbox-inline grocery-check">
                <input type="checkbox" checked={addToBudget} onChange={(e) => setAddToBudget(e.target.checked)} />
                Add {money(draft.total || 0)} to the budget as a Groceries expense
              </label>
            )}
          </div>
        )}
      </FormModal>
      )}

      {/* ── History ── */}
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">
            Receipts
            {!loading && !loadError && <span className="db-count" aria-label={`${receipts.length} receipts`}>{receipts.length}</span>}
          </h3>
          <button type="button" className="btn btn-sm" onClick={openScan}>
            <i className="fa-solid fa-camera" aria-hidden="true" /> Scan a receipt
          </button>
        </div>
        <p className="money-card-note">Snap or upload a photo of a grocery receipt and AI pulls out the items and total.</p>
        {loading && <SkeletonList rows={4} label="Loading receipts" />}
        {!loading && loadError && (
          <div className="load-error" role="alert">
            <p className="load-error-msg">{loadError}</p>
            <button type="button" className="btn btn-sm" onClick={refresh}>Retry</button>
          </div>
        )}
        {!loading && !loadError && receipts.length === 0 && <p className="money-card-note">No receipts yet.</p>}
        <div className="grocery-list">
          {receipts.map((r) => (
            <div className={`grocery-receipt${openId === r.id ? " open" : ""}`} key={r.id}>
              <button type="button" className="grocery-receipt-row" aria-expanded={openId === r.id} onClick={() => toggleOpen(r)}>
                <span className="grocery-receipt-main">
                  <span className="grocery-receipt-name">{r.store_name || "Store"}</span>
                  <span className="grocery-receipt-sub">{fmtDate(r.purchase_date)} · {r.item_count} item{r.item_count === 1 ? "" : "s"}</span>
                </span>
                <span className="grocery-receipt-total">{money(r.total)}</span>
                <i className={`fa-solid fa-chevron-${openId === r.id ? "up" : "down"} grocery-chev`} aria-hidden="true" />
              </button>
              {openId === r.id && (
                <div className="grocery-receipt-detail">
                  {openImg && <img className="grocery-receipt-img" src={openImg} alt="Receipt" />}
                  <div className="grocery-detail-items">
                    {openItems.length === 0 && <p className="no-entries-compact">No itemized lines.</p>}
                    {openItems.map((it) => (
                      <div className="grocery-detail-line" key={it.id}>
                        <span>{it.raw_text}</span>
                        <span>{it.total_price != null ? money(it.total_price) : ""}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grocery-detail-actions">
                    <button type="button" className="btn-sm btn-secondary-sm" onClick={() => startEdit(r)}>
                      <i className="fa-solid fa-pen" aria-hidden="true" /> Edit
                    </button>
                    <button type="button" className="btn-sm btn-delete" onClick={() => removeReceipt(r.id)}>
                      <i className="fa-solid fa-trash" aria-hidden="true" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
