/**
 * Split plain text into text and link segments (BUG-082).
 *
 * Only http and https URLs become links. Trailing sentence punctuation and
 * closing brackets that do not belong to the URL stay outside it, so a note
 * like "Bundle: https://example.com/x?a=1&b=2." links the URL without the
 * final period. Pure and total: any input returns segments whose texts join
 * back to the original string.
 */
const URL_RE = /https?:\/\/[^\s<>"']+/g;

export function linkifySegments(text) {
  const s = String(text ?? "");
  if (!s) return [];
  const out = [];
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    let url = m[0];
    let trail = "";
    while (url && /[.,;:!?]$/.test(url)) {
      trail = url.at(-1) + trail;
      url = url.slice(0, -1);
    }
    while (url.endsWith(")") && url.split(")").length > url.split("(").length) {
      trail = ")" + trail;
      url = url.slice(0, -1);
    }
    while (url.endsWith("]") && url.split("]").length > url.split("[").length) {
      trail = "]" + trail;
      url = url.slice(0, -1);
    }
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    if (url) out.push({ href: url, text: url });
    if (trail) out.push({ text: trail });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}
