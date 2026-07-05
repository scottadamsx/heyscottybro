/**
 * Smart Import — the shared engine behind "drop a document, the app learns".
 * School announcements/syllabi and bank statements ride the same rails:
 *
 *   1. fileToContent(file)  — PDF → text (pdf.js, already shipped for the
 *      viewer), image → base64 vision block, txt/csv/md → text.
 *   2. extract(...)         — one forced tool call (Sonnet: extraction accuracy
 *      matters more than pennies here) returns STRUCTURED PROPOSALS.
 *   3. The caller previews proposals as checkboxes; nothing is written until
 *      the user applies. Money especially: propose, never silently mutate.
 */
import { getAuthHeaders } from "../utils/supabase";

const MAX_TEXT = 24000; // ~6k tokens of document text is plenty for a statement/announcement

/** Turn a File into model-ready content: {text} or {image: {media_type, data}}. */
export async function fileToContent(file) {
  const name = (file.name || "").toLowerCase();
  if (file.type.startsWith("image/")) {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    return { image: { media_type: file.type, data: dataUrl.split(",")[1] } };
  }
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const { pdfjs } = await import("react-pdf");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let text = "";
    for (let p = 1; p <= doc.numPages && text.length < MAX_TEXT; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      text += tc.items.map((i) => i.str).join(" ") + "\n";
    }
    return { text: text.slice(0, MAX_TEXT) };
  }
  // txt / csv / md / anything text-like
  const text = await file.text();
  return { text: text.slice(0, MAX_TEXT) };
}

/**
 * One forced-tool extraction call.
 * content: {text} | {image} (from fileToContent) or {text} from a paste box.
 */
export async function extract({ system, prompt, tool, content, maxTokens = 3000 }) {
  const userContent = content.image
    ? [
        { type: "image", source: { type: "base64", media_type: content.image.media_type, data: content.image.data } },
        { type: "text", text: prompt },
      ]
    : `${prompt}\n\nTHE DOCUMENT:\n${content.text}`;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `AI error ${res.status}`);
  const block = (data.content || []).find((b) => b.type === "tool_use");
  if (!block) throw new Error("Couldn't read that document — try again or paste the text.");
  return block.input;
}
