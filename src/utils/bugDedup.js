/**
 * Deterministic duplicate-report policy for Frodo's log_bug tool.
 *
 * Matching intentionally fails toward separate records: reports must share a
 * real product area and a specific title fingerprint. The lookup wrapper fails
 * closed so a database error can never be mistaken for "no duplicates".
 */

const STOP_WORDS = new Set([
  "the", "a", "an", "on", "in", "to", "of", "and", "or", "is", "are", "not",
  "for", "with", "when", "it", "its", "my", "page", "doesnt", "dont", "cant",
]);
const PAGE_STOP_WORDS = new Set(["page", "screen", "section", "area"]);
const OPEN_STATUSES = new Set(["open", "in_progress"]);

/** Serialize same-key read/decide/write sequences inside one browser. */
export function createKeyedMutex() {
  const tails = new Map();
  return function withLock(key, operation) {
    const previous = tails.get(key) || Promise.resolve();
    const result = previous.then(operation, operation);
    const tail = result.then(() => undefined, () => undefined);
    tails.set(key, tail);
    tail.finally(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return result;
  };
}

function words(value, stopWords = STOP_WORDS) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return { score: 0, shared: 0 };
  let shared = 0;
  A.forEach((word) => { if (B.has(word)) shared += 1; });
  return { score: shared / new Set([...A, ...B]).size, shared };
}

function sameProductArea(a, b) {
  const A = new Set(words(a, PAGE_STOP_WORDS));
  const B = new Set(words(b, PAGE_STOP_WORDS));
  if (!A.size || !B.size) return false;
  const [small, large] = A.size <= B.size ? [A, B] : [B, A];
  return [...small].every((word) => large.has(word));
}

export function isSameBugReport(existing, incoming) {
  if (!sameProductArea(existing?.page, incoming?.page)) return false;

  const title = similarity(existing?.title, incoming?.title);
  if (title.shared < 2) return false;
  if (title.score >= 0.68) return true;

  const details = similarity(existing?.description, incoming?.description);
  return title.score >= 0.45 && details.shared >= 2 && details.score >= 0.35;
}

export async function findCanonicalOpenReport({ loadReports, type = "bug", incoming }) {
  let reports;
  try {
    reports = await loadReports();
  } catch (err) {
    throw new Error(`Couldn't check existing ${type} reports, so no report was created. Try again when the bug tracker is available.`, { cause: err });
  }
  if (!Array.isArray(reports)) {
    throw new Error(`Couldn't check existing ${type} reports, so no report was created. The bug tracker returned an invalid response.`);
  }
  return reports.find((report) =>
    (report.type || "bug") === type && OPEN_STATUSES.has(report.status) && isSameBugReport(report, incoming),
  ) || null;
}

/** Append only genuinely new description lines. */
export function mergeBugDescription(existing, incoming) {
  const have = new Set(String(existing || "").split("\n").map((line) => line.trim()));
  const additions = String(incoming || "").split("\n").map((line) => line.trim())
    .filter((line) => line && !have.has(line));
  if (!additions.length) return existing;
  return `${existing || ""}\n\nAlso reported:\n${additions.join("\n")}`.trim();
}

/** Preserve order while removing empty and repeated storage paths. */
export function mergeUniqueScreenshotPaths(...lists) {
  const unique = [];
  const seen = new Set();
  for (const list of lists) {
    for (const value of Array.isArray(list) ? list : []) {
      const path = typeof value === "string" ? value.trim() : "";
      if (!path || seen.has(path)) continue;
      seen.add(path);
      unique.push(path);
    }
  }
  return unique;
}

/** Preserve the primary error while making any incomplete cleanup explicit. */
export function bugReportRollbackError(primary, { reportId, cleanupErrors = [] } = {}) {
  if (!cleanupErrors.length) {
    return primary instanceof Error ? primary : new Error(String(primary || "Bug reporting failed."));
  }
  const primaryMessage = primary?.message || String(primary || "Bug reporting failed.");
  const cleanup = cleanupErrors
    .map((error) => error?.message || String(error))
    .join("; ");
  return new Error(
    `${primaryMessage} Automatic rollback was incomplete for report ${reportId || "unknown"}; manual cleanup may be required. Cleanup errors: ${cleanup}`,
    { cause: primary },
  );
}
