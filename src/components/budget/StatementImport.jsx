import { useMemo, useState } from "react";
import { fileToContent, extract } from "../../lib/smartImport";
import { formatMoney, genId } from "../../utils/budgetCalc";
import { useToast } from "../../contexts/ToastContext";
import "./statementImport.css";

/**
 * Statement Import — real banking, so the pipeline is paranoid by design:
 *
 *   AI proposes → CODE VERIFIES → YOU approve → then it writes.
 *
 * 1. The model reads the statement (PDF/image/CSV/paste) alongside your
 *    existing transactions in that window and proposes, per entry: update an
 *    existing transaction (the "$40 Walmart you logged vs $39.47 WAL-MART
 *    #3454 on the statement" case), create new, or "already logged, no change".
 * 2. A deterministic verifier re-checks every claimed match with hard rules
 *    (date within ±6 days, amount within max($5, 20%), direction agrees).
 *    Anything that fails is DEMOTED to an unchecked "new" row with a warning —
 *    the AI never gets to overwrite a transaction the code can't corroborate.
 * 3. Every row is a checkbox with a full before→after diff. Low-confidence
 *    rows default UNCHECKED. Nothing applies until you press the button, and
 *    the apply goes through the page's reconciling setter (normal audit path).
 */

const STATEMENT_TOOL = {
  name: "parse_statement",
  description: "Parse a bank statement and reconcile it against the user's existing logged transactions.",
  input_schema: {
    type: "object",
    properties: {
      period: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, description: "Statement period, YYYY-MM-DD" },
      ending_balance: { type: "number", description: "Closing balance if the statement shows one" },
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD" },
            description: { type: "string", description: "Cleaned merchant name (WAL-MART #3454 -> Walmart)" },
            raw_description: { type: "string", description: "Exactly as printed" },
            amount: { type: "number", description: "Positive number" },
            direction: { type: "string", enum: ["debit", "credit"] },
            category_guess: { type: "string" },
            match_id: { type: "string", description: "id of the existing transaction this IS (rounded amounts and shortened names still count), or omit" },
            match_kind: { type: "string", enum: ["exact", "update", "none"], description: "exact = already logged identically (no change needed); update = same purchase, details differ; none = new" },
            match_reason: { type: "string", description: "One line: why this matches (or doesn't)" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["date", "description", "amount", "direction", "match_kind", "confidence"],
        },
      },
    },
    required: ["entries"],
  },
};

// ── The deterministic verifier: the AI never outranks these rules ──
const dayDiff = (a, b) => Math.abs((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000);
function verifyMatch(entry, tx) {
  if (!tx) return { ok: false, why: "matched transaction not found" };
  if (dayDiff(entry.date, tx.date) > 6) return { ok: false, why: `dates ${Math.round(dayDiff(entry.date, tx.date))} days apart` };
  const tol = Math.max(5, entry.amount * 0.2);
  if (Math.abs(Number(tx.amount) - entry.amount) > tol) return { ok: false, why: `amounts differ by ${formatMoney(Math.abs(tx.amount - entry.amount))}` };
  const txIsCredit = tx.type === "income";
  if ((entry.direction === "credit") !== txIsCredit) return { ok: false, why: "money direction disagrees" };
  return { ok: true };
}

export default function StatementImport({ transactions, setTransactions, categories = [], onSetBalance }) {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | busy | review | done
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState([]);       // verified proposals
  const [period, setPeriod] = useState(null); // {from, to} statement window, if the model found one
  const [balance, setBalance] = useState(null);
  const [applyBalance, setApplyBalance] = useState(false);
  const [summary, setSummary] = useState(null);

  const byId = useMemo(() => Object.fromEntries(transactions.map((t) => [String(t.id), t])), [transactions]);

  const analyze = async (content) => {
    setPhase("busy");
    try {
      // Statements cover recent months, so cap what we hand the model at the
      // most recent 400 transactions — keeps the prompt bounded (and focused)
      // even after years of ledger history.
      const existing = [...transactions]
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, 400)
        .map((t) => ({
          id: String(t.id), date: t.date, description: t.description,
          amount: Number(t.amount), type: t.type, category: t.category,
        }));
      const out = await extract({
        system:
          "You reconcile a bank statement against a personal ledger. Be precise with every number — this is real banking. " +
          "Matching rules: the user often logs rounded amounts ('$40 Walmart' for a $39.47 WAL-MART purchase) and short names — " +
          "treat same-merchant, close-amount (within ~$5 or 20%), close-date (within a few days) entries as the SAME purchase (match_kind 'update', or 'exact' if identical). " +
          "One statement entry matches at most one existing transaction and vice versa. NEVER invent entries not on the statement. " +
          "Skip statement noise (running balance lines, headers). Categorise guesses from this list when obvious: " + categories.join(", "),
        prompt: "Parse this statement and reconcile it against my existing transactions.\n\nMY EXISTING TRANSACTIONS:\n" + JSON.stringify(existing),
        tool: STATEMENT_TOOL,
        content,
        maxTokens: 4000,
      });

      // Verify + shape into review rows
      const seen = new Set();
      const shaped = (out.entries || []).flatMap((e) => {
        if (!e.date || !(Number(e.amount) > 0)) return []; // hard drop malformed
        const amount = Math.round(Number(e.amount) * 100) / 100;
        const base = { ...e, amount, key: `${e.date}-${e.description}-${amount}-${Math.random().toString(36).slice(2, 7)}` };
        if (e.match_id && (e.match_kind === "update" || e.match_kind === "exact")) {
          if (seen.has(e.match_id)) return [{ ...base, kind: "new", checked: false, warn: "AI matched one transaction twice — review by hand" }];
          const tx = byId[String(e.match_id)];
          const v = verifyMatch(base, tx);
          if (!v.ok) return [{ ...base, kind: "new", checked: false, warn: `Match failed verification (${v.why}) — left as new, unchecked` }];
          seen.add(e.match_id);
          if (e.match_kind === "exact" || (Number(tx.amount) === amount && tx.date === e.date)) {
            return [{ ...base, kind: "logged", tx, checked: false }];
          }
          return [{ ...base, kind: "update", tx, checked: e.confidence === "high" }];
        }
        return [{ ...base, kind: "new", checked: e.confidence !== "low" }];
      });

      setRows(shaped);
      setPeriod(out.period ?? null);
      setBalance(out.ending_balance ?? null);
      setApplyBalance(false);
      setPhase("review");
      if (!shaped.length) addToast("No transactions found in that document.", "error");
    } catch (e2) {
      addToast(e2.message, "error");
      setPhase("idle");
    }
  };

  const onFile = async (f) => {
    if (!f) return;
    try { await analyze(await fileToContent(f)); }
    catch (e) { addToast(e.message, "error"); setPhase("idle"); }
  };

  const toggle = (key) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, checked: !r.checked } : r)));

  const apply = () => {
    const updates = rows.filter((r) => r.kind === "update" && r.checked);
    const news = rows.filter((r) => r.kind === "new" && r.checked);
    const created = news.map((n) => ({
      id: genId(),
      description: n.description,
      amount: n.amount,
      type: n.direction === "credit" ? "income" : "expense",
      category: categories.includes(n.category_guess) ? n.category_guess : (categories[0] || "Other"),
      date: n.date,
      notes: n.raw_description && n.raw_description !== n.description ? `Statement: ${n.raw_description}` : "",
      reconciled: true,
      is_bill: false,
      fulfills_recurring_id: null,
    }));
    setTransactions((prev) => {
      let next = prev;
      for (const u of updates) {
        next = next.map((t) => String(t.id) === String(u.tx.id)
          ? { ...t, amount: u.amount, date: u.date, description: t.description || u.description, reconciled: true }
          : t);
      }
      return [...created, ...next];
    });
    if (applyBalance && balance != null && onSetBalance) {
      // The statement gives us a CLOSING balance, but startingBalance is what the
      // ledger's running balance starts FROM (getLedgerRows adds every transaction
      // on top). Setting startingBalance = closing balance would double-count the
      // whole ledger. Instead, anchor: pick the startingBalance that makes the
      // running balance equal the statement's close at the end of the statement
      // period — transactions dated after the period still stack on top correctly.
      const updById = Object.fromEntries(updates.map((u) => [String(u.tx.id), u]));
      const after = [
        ...created,
        ...transactions.map((t) => {
          const u = updById[String(t.id)];
          return u ? { ...t, amount: u.amount, date: u.date } : t;
        }),
      ];
      const cutoff = period?.to;
      const considered = cutoff ? after.filter((t) => t.date && t.date <= cutoff) : after;
      const net = considered.reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
      onSetBalance(Math.round((balance - net) * 100) / 100);
    }
    setSummary({ updated: updates.length, created: news.length, balance: applyBalance ? balance : null });
    setPhase("done");
    addToast(`Applied: ${updates.length} updated, ${news.length} added.`, "success");
  };

  const reset = () => { setPhase("idle"); setRows([]); setPaste(""); setPeriod(null); setBalance(null); setSummary(null); };

  const checkedCount = rows.filter((r) => r.checked).length;
  const conf = (c) => <span className={`si-conf ${c}`}>{c}</span>;

  return (
    <div className={`si${open ? " open" : ""}`}>
      <button type="button" className="si-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="si-toggle-title"><i className="fa-solid fa-file-invoice" /> Import statement</span>
        <span className="si-toggle-sub">Drop a bank statement — it reconciles against your ledger, you approve every line</span>
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"} si-chev`} />
      </button>

      {open && (
        <div className="si-body">
          {phase === "idle" && (
            <>
              <label className="si-drop">
                <input type="file" accept=".pdf,.csv,.txt,image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                <i className="fa-solid fa-cloud-arrow-up" /> Drop or choose a statement (PDF · image · CSV)
              </label>
              <div className="si-or">or paste the statement text</div>
              <textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the transactions section of your statement…" />
              <button className="btn btn-sm" disabled={!paste.trim()} onClick={() => analyze({ text: paste.trim().slice(0, 24000) })}>
                <i className="fa-solid fa-magnifying-glass-dollar" /> Analyze
              </button>
            </>
          )}

          {phase === "busy" && <p className="si-busy"><i className="fa-solid fa-spinner fa-spin" /> Reading the statement and reconciling against {transactions.length} logged transactions…</p>}

          {phase === "review" && (
            <>
              <p className="si-note"><i className="fa-solid fa-shield-halved" /> Every claimed match was re-verified by hard rules (±6 days, amount within $5/20%, direction agrees). Failed matches were demoted to unchecked. Nothing writes until you apply.</p>

              {rows.some((r) => r.kind === "update") && (
                <div className="si-group">
                  <div className="si-group-title"><i className="fa-solid fa-pen"/> Updates — same purchase, exact figures from the statement</div>
                  {rows.filter((r) => r.kind === "update").map((r) => (
                    <label key={r.key} className="si-row">
                      <input type="checkbox" checked={r.checked} onChange={() => toggle(r.key)} />
                      <span className="si-row-main">
                        <span className="si-row-title">{r.tx.description}</span>
                        <span className="si-diff">
                          {formatMoney(r.tx.amount)} → <strong>{formatMoney(r.amount)}</strong>
                          {r.tx.date !== r.date && <> · {r.tx.date} → <strong>{r.date}</strong></>}
                        </span>
                        {r.match_reason && <span className="si-reason">{r.match_reason}</span>}
                      </span>
                      {conf(r.confidence)}
                    </label>
                  ))}
                </div>
              )}

              {rows.some((r) => r.kind === "new") && (
                <div className="si-group">
                  <div className="si-group-title"><i className="fa-solid fa-plus"/> New — on the statement, not in your ledger</div>
                  {rows.filter((r) => r.kind === "new").map((r) => (
                    <label key={r.key} className={`si-row${r.warn ? " warned" : ""}`}>
                      <input type="checkbox" checked={r.checked} onChange={() => toggle(r.key)} />
                      <span className="si-row-main">
                        <span className="si-row-title">{r.description} <em className="si-cat">{r.category_guess}</em></span>
                        <span className="si-diff"><strong>{r.direction === "credit" ? "+" : "−"}{formatMoney(r.amount)}</strong> · {r.date}</span>
                        {r.warn && <span className="si-warn"><i className="fa-solid fa-triangle-exclamation" /> {r.warn}</span>}
                      </span>
                      {conf(r.confidence)}
                    </label>
                  ))}
                </div>
              )}

              {rows.some((r) => r.kind === "logged") && (
                <div className="si-group muted">
                  <div className="si-group-title"><i className="fa-solid fa-circle-check"/> Already logged correctly ({rows.filter((r) => r.kind === "logged").length}) — no action</div>
                </div>
              )}

              {balance != null && onSetBalance && (
                <label className="si-row si-balance">
                  <input type="checkbox" checked={applyBalance} onChange={() => setApplyBalance((v) => !v)} />
                  <span className="si-row-main">
                    <span className="si-row-title">Anchor ledger to statement balance</span>
                    <span className="si-diff">adjusts starting balance so your running balance hits <strong>{formatMoney(balance)}</strong> at the statement close</span>
                  </span>
                </label>
              )}

              <div className="si-actions">
                <button className="btn btn-sm" onClick={apply} disabled={checkedCount === 0 && !applyBalance}>
                  <i className="fa-solid fa-check" /> Apply {checkedCount} change{checkedCount === 1 ? "" : "s"}{applyBalance ? " + balance" : ""}
                </button>
                <button className="btn btn-sm btn-secondary-sm" onClick={reset}>Cancel</button>
              </div>
            </>
          )}

          {phase === "done" && summary && (
            <div className="si-done">
              <p><i className="fa-solid fa-circle-check" /> Done: <strong>{summary.updated}</strong> transaction{summary.updated === 1 ? "" : "s"} updated to exact statement figures, <strong>{summary.created}</strong> added{summary.balance != null ? <>, ledger anchored to <strong>{formatMoney(summary.balance)}</strong> at statement close</> : ""}.</p>
              <button className="btn btn-sm btn-secondary-sm" onClick={reset}>Import another</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
