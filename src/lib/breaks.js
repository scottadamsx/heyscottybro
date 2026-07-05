/**
 * Study-break tokens — the currency between studying and the Arcade.
 * The Learn page will call earnBreak() when you get things right (flashcard
 * streaks, passed quizzes, completed sims); games are the reward. Until Learn
 * ships, the Arcade grants a courtesy token so it's playable standalone.
 */
const KEY = "hsb_break_tokens";
const BEST_KEY = "hsb_arcade_best";

export function breakTokens() {
  try { return Math.max(0, parseInt(localStorage.getItem(KEY) || "0", 10) || 0); } catch { return 0; }
}
export function earnBreak(n = 1, reason = "") {
  try { localStorage.setItem(KEY, String(breakTokens() + n)); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent("hsb-breaks", { detail: { earned: n, reason } }));
  return breakTokens();
}
export function spendBreak() {
  const t = breakTokens();
  if (t <= 0) return false;
  try { localStorage.setItem(KEY, String(t - 1)); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent("hsb-breaks", { detail: { spent: 1 } }));
  return true;
}

export function bestScores() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) || "{}"); } catch { return {}; }
}
export function recordScore(gameId, score) {
  if (score == null) return bestScores();
  const all = bestScores();
  if (score > (all[gameId] || 0)) {
    all[gameId] = score;
    try { localStorage.setItem(BEST_KEY, JSON.stringify(all)); } catch { /* noop */ }
  }
  return all;
}
