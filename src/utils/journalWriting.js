const WORD_PATTERN = /[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}]|['’\-‐‑‒–—](?=[\p{L}\p{N}]))*/gu;
export const JOURNAL_IDLE_MS = 60_000;

export function countGraphemes(value, Segmenter = Intl?.Segmenter) {
  const text = String(value || "");
  if (typeof Segmenter === "function") {
    return [...new Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
  }
  return Array.from(text).length;
}

export function countJournalWords(value) {
  return (String(value || "").match(WORD_PATTERN) || []).length;
}

export function journalWritingCounts(value) {
  return { characters: countGraphemes(value), words: countJournalWords(value) };
}

export function createWritingTimer(meta = null) {
  const elapsedMs = Math.max(0, Number(meta?.elapsedMs) || 0);
  const pauseReason = meta?.pauseReason === "manual" ? "manual" : (elapsedMs > 0 ? "automatic" : null);
  return { elapsedMs, status: elapsedMs > 0 ? "paused" : "idle", pauseReason, startedAt: null, lastInputAt: null };
}

export function elapsedWritingMs(timer, now) {
  if (timer.status !== "running") return timer.elapsedMs;
  return timer.elapsedMs + Math.max(0, Number(now) - timer.startedAt);
}

export function writingTimerInput(timer, now) {
  if (timer.status === "paused" && timer.pauseReason === "manual") return timer;
  if (timer.status === "running") return { ...timer, lastInputAt: now };
  return { ...timer, status: "running", pauseReason: null, startedAt: now, lastInputAt: now };
}

export function pauseWritingTimer(timer, now, reason = "automatic") {
  if (timer.status !== "running") {
    if (reason === "manual") return { ...timer, status: "paused", pauseReason: "manual" };
    return timer;
  }
  return {
    ...timer,
    elapsedMs: elapsedWritingMs(timer, now),
    status: "paused",
    pauseReason: reason === "manual" ? "manual" : "automatic",
    startedAt: null,
    lastInputAt: null,
  };
}

export function resumeWritingTimer(timer, now) {
  if (timer.status === "running") return timer;
  return { ...timer, status: "running", pauseReason: null, startedAt: now, lastInputAt: now };
}

export function autoPauseIdleTimer(timer, now, idleMs = JOURNAL_IDLE_MS) {
  if (timer.status !== "running" || now - timer.lastInputAt < idleMs) return timer;
  const eligibleEnd = timer.lastInputAt + idleMs;
  return pauseWritingTimer(timer, Math.min(now, eligibleEnd), "automatic");
}

export function writingTimerMetadata(timer, now) {
  return {
    elapsedMs: Math.round(elapsedWritingMs(timer, now)),
    pauseReason: timer.status === "paused" && timer.pauseReason === "manual" ? "manual" : "automatic",
  };
}

export function formatWritingDuration(milliseconds) {
  const total = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function journalProvenanceForSave(cleanup, body, acceptedAt = new Date().toISOString()) {
  if (!cleanup || String(body || "").trim() !== String(cleanup.suggestion || "").trim()) return null;
  const source = cleanup.provenance;
  if (!source || source.feature !== "journal_cleanup" || !source.model || !source.prompt || !Number.isInteger(source.promptVersion) || !source.generatedAt) {
    return null;
  }
  return {
    feature: "journal_cleanup",
    model: String(source.model),
    prompt: String(source.prompt),
    promptVersion: source.promptVersion,
    generatedAt: String(source.generatedAt),
    acceptedAt,
  };
}

export function journalTextDiff(before, after) {
  const left = String(before || "").match(/\s+|[^\s]+/g) || [];
  const right = String(after || "").match(/\s+|[^\s]+/g) || [];
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) start += 1;
  let leftEnd = left.length;
  let rightEnd = right.length;
  while (leftEnd > start && rightEnd > start && left[leftEnd - 1] === right[rightEnd - 1]) {
    leftEnd -= 1;
    rightEnd -= 1;
  }
  return [
    ...(start ? [{ type: "same", text: left.slice(0, start).join("") }] : []),
    ...(leftEnd > start ? [{ type: "removed", text: left.slice(start, leftEnd).join("") }] : []),
    ...(rightEnd > start ? [{ type: "added", text: right.slice(start, rightEnd).join("") }] : []),
    ...(leftEnd < left.length ? [{ type: "same", text: left.slice(leftEnd).join("") }] : []),
  ];
}

export function cleanupResponseIsCurrent({ submittedBody, currentBody, requestedEntryId = null, currentEntryId = null, open }) {
  return Boolean(open) && submittedBody === currentBody && String(requestedEntryId ?? "") === String(currentEntryId ?? "");
}
