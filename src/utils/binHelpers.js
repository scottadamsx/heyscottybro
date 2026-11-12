// Pure display/flow helpers for the Bin page (docs/features/bin.md).

export const BIN_STATUSES = ["new", "picked_up", "done"];

const NEXT_STATUS = { new: "picked_up", picked_up: "done", done: "new" };
const NEXT_LABEL = { new: "Mark picked up", picked_up: "Mark done", done: "Back to New" };
const STATUS_LABEL = { new: "New", picked_up: "Picked up", done: "Done" };
const KIND_LABEL = { text: "Text", file: "File", link: "Link" };

export const nextStatus = (status) => NEXT_STATUS[status] ?? "new";
export const nextStatusLabel = (status) => NEXT_LABEL[status] ?? "Mark picked up";
export const statusLabel = (status) => STATUS_LABEL[status] ?? status;
export const kindLabel = (kind) => KIND_LABEL[kind] ?? kind;

/** One-line preview of a text body: first non-empty line, capped. */
export function excerpt(body, max = 140) {
  const line = (body || "").split("\n").map((s) => s.trim()).find(Boolean) || "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Default title for a text space: the first few words of the excerpt. */
export function titleFromText(body) {
  const words = excerpt(body, 60).split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  return words || "Untitled";
}
