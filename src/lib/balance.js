/**
 * Balance anchoring — pure helper shared by everything that lets Scott state
 * his CURRENT balance (set_balance tool, statement import).
 *
 * The ledger's running balance is startingBalance + Σ(signed transactions), so
 * writing "current balance" straight into startingBalance double-counts the
 * whole ledger. Instead we solve for the startingBalance that makes the ledger
 * land on the stated balance today:
 *
 *   startingBalance = currentBalance − Σ signed amounts of tx dated ≤ today
 *
 * Planned rows (type "future") are excluded — they haven't hit the bank yet, so
 * they don't explain today's balance. Amounts are the SIGNED values as stored
 * in the transactions table (expenses/savings negative, income positive).
 */

const isPlanned = (t) => t?.type === "future" || t?.planned === true || t?.future === true;

/** Signed cash effect of one stored row. Tolerates UI-shaped rows (abs amount + type). */
export function signedAmount(t) {
  const n = Number(t?.amount || 0);
  if (Number.isNaN(n)) return 0;
  // Stored rows are already signed. A UI-shaped row carries a positive amount
  // with the sign implied by type — detect that case and re-sign it.
  if (n > 0 && (t.type === "expense" || t.type === "savings" || t.type === "future")) return -n;
  return n;
}

/**
 * @param {number} currentBalance  what the bank says today
 * @param {Array}  transactions    stored rows ({ amount (signed), date, type })
 * @param {string} todayStr        YYYY-MM-DD; rows after this are ignored
 * @returns {number} the startingBalance to store (rounded to cents)
 */
export function anchorStartingBalance(currentBalance, transactions = [], todayStr) {
  const cur = Number(currentBalance);
  if (!Number.isFinite(cur)) throw new Error("current balance must be a number");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(todayStr || ""))) throw new Error("todayStr must be YYYY-MM-DD");
  const net = (transactions || [])
    .filter((t) => t && t.date && String(t.date).slice(0, 10) <= todayStr && !isPlanned(t))
    .reduce((s, t) => s + signedAmount(t), 0);
  return Math.round((cur - net) * 100) / 100;
}
