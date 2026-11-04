import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("./BudgetDashboard.jsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../pages/admin/BudgetPage.jsx", import.meta.url), "utf8");
const transactions = readFileSync(new URL("./BudgetTransactions.jsx", import.meta.url), "utf8");

test("overview renders Add purchase on the period arrows row, opposite the arrows (BUG-078)", () => {
  assert.match(dashboard, /money-period-bar/);
  assert.match(dashboard, /className="money-period-nav"/);
  assert.match(dashboard, /onClick=\{onAddPurchase\}>[\s\S]*?Add purchase/);
  // The button is gated on the prop so other renderings of the dashboard
  // without a purchase handler stay unchanged.
  assert.match(dashboard, /\{onAddPurchase && \(/);
});

test("budget page wires the button to a one-shot nonce plus the transactions tab (BUG-078)", () => {
  assert.match(page, /onAddPurchase=\{openPurchaseForm\}/);
  assert.match(page, /setTxFormNonce\(n => n \+ 1\); switchTab\("transactions"\)/);
  assert.match(page, /formNonce=\{txFormNonce\}/);
  assert.match(page, /onFormNonceUsed=\{clearTxFormNonce\}/);
  assert.match(page, /const clearTxFormNonce = \(\) => setTxFormNonce\(0\);/);
});

test("transactions tab opens its existing form once for a fresh nonce, then reports it used (BUG-078)", () => {
  assert.match(transactions, /formNonce > 0 && formNonce !== consumedNonceRef\.current/);
  assert.match(transactions, /openNew\(\);\s*\n\s*onFormNonceUsed\?\.\(\);/);
});
