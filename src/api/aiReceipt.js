// src/api/aiReceipt.js
// AI helper that reads a grocery receipt photo and returns structured line
// items + totals. Like aiFood.js, every call goes through the existing
// /api/chat proxy (no key in the browser) and forces a tool call for strict
// JSON. Vision is done with a base64 image block.
import { getAuthHeaders } from "../utils/supabase";

const MODEL = "claude-haiku-4-5-20251001";

async function callClaude(body) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || `AI error ${res.status}`);
  return data;
}

const RECEIPT_TOOL = {
  name: "record_receipt",
  description: "Record the structured contents of a grocery store receipt.",
  input_schema: {
    type: "object",
    properties: {
      store_name: { type: "string", description: "The store/merchant name printed on the receipt, if visible" },
      purchase_date: { type: "string", description: "Purchase date in YYYY-MM-DD format, if visible" },
      subtotal: { type: "number", description: "Subtotal before tax, if shown" },
      total: { type: "number", description: "Final total actually paid, including tax" },
      items: {
        type: "array",
        description: "Each purchased line item on the receipt",
        items: {
          type: "object",
          properties: {
            raw_text: { type: "string", description: "The item name/description as printed" },
            quantity: { type: "number", description: "Quantity or weight if shown, else 1" },
            unit_price: { type: "number", description: "Price per unit if shown" },
            total_price: { type: "number", description: "Line total price for this item" },
          },
          required: ["raw_text"],
        },
      },
    },
    required: ["items", "total"],
  },
};

const RECEIPT_SYSTEM =
  "You read photographed grocery receipts and transcribe them exactly. " +
  "List every purchased line item in order with its printed name and price. " +
  "Do not include subtotals, tax lines, totals, loyalty/points lines, or payment lines as items. " +
  "Use the final amount paid (after tax) as `total`. Money values are plain numbers (no currency symbol). " +
  "If something is unreadable, make your best guess from context and keep going. Always call the record_receipt tool.";

/**
 * Extract structured receipt data from a photo.
 * @param {string} base64 - raw base64 (no data: prefix)
 * @param {string} mediaType - e.g. "image/jpeg" | "image/png"
 * @returns {Promise<{store_name?:string, purchase_date?:string, subtotal?:number, total:number, items:Array}>}
 */
export async function extractReceipt(base64, mediaType) {
  const content = [
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
    { type: "text", text: "Transcribe this grocery receipt into structured line items and totals." },
  ];
  const data = await callClaude({
    max_tokens: 2000,
    system: RECEIPT_SYSTEM,
    tools: [RECEIPT_TOOL],
    tool_choice: { type: "tool", name: RECEIPT_TOOL.name },
    messages: [{ role: "user", content }],
  });
  const block = data.content?.find((b) => b.type === "tool_use");
  if (!block) throw new Error("Could not read the receipt. Try a clearer, well-lit photo.");
  const out = block.input || {};
  return {
    store_name: out.store_name || "",
    purchase_date: out.purchase_date || "",
    subtotal: typeof out.subtotal === "number" ? out.subtotal : null,
    total: typeof out.total === "number" ? out.total : 0,
    items: Array.isArray(out.items) ? out.items : [],
  };
}

/** Read a File into raw base64 (strips the data: prefix) + its media type. */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({ base64, mediaType: file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
  });
}
