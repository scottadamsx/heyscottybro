/**
 * Turn a raw agent_actions row into a human one-liner + a friendly timestamp.
 * Shared by the Dashboard "recent actions" widget and the Command Center feed.
 */
const COLLECTION_NOUN = {
  reminders: "reminder", events: "event", projects: "project", initiatives: "initiative",
  transactions: "transaction", recurring_bills: "bill", income_sources: "income source",
  snippets: "snippet", event_types: "event type", hikers: "hiker", brain: "note",
};

function itemLabel(data = {}) {
  return data.name || data.title || data.description || data.text || data.first
    || (data.category && data.amount != null ? `${data.category} $${data.amount}` : null);
}

export function describeAction(a) {
  const args = a.args || {};
  const coll = a.collection || args.collection;
  const noun = COLLECTION_NOUN[coll] || (coll ? coll.replace(/_/g, " ") : "item");
  const quote = (s) => (s ? `: “${String(s).length > 80 ? String(s).slice(0, 80) + "…" : s}”` : "");
  switch (a.tool) {
    case "create_item": return `New ${noun}${quote(itemLabel(args.data))}`;
    case "update_item": { const s = itemLabel(args.data); const f = Object.keys(args.data || {}); return `Edited ${noun}${s ? quote(s) : f.length ? ` (${f.join(", ")})` : ""}`; }
    case "delete_item": return `Deleted a ${noun}`;
    case "link_brain_nodes": return `Linked brain notes${args.source_slug ? `: ${args.source_slug} → ${args.target_slug}` : ""}`;
    case "complete_reminder": return "Completed a reminder";
    case "set_balance": return `Set balance to $${args.balance}`;
    case "set_category_budget": return args.amount > 0 ? `Set ${args.category} budget to $${args.amount}/mo` : `Removed ${args.category} budget`;
    case "consult_banker": return `Consulted Griphook${quote(args.request)}`;
    case "log_food": return `Logged food${quote(args.name)}`;
    case "log_weight": return "Logged a weigh-in";
    case "web_fetch": return `Read a web page${args.url ? `: ${args.url}` : ""}`;
    case "save_context": return `Saved a memory${quote(args.text)}`;
    default: return a.tool.replace(/_/g, " ");
  }
}

export const actionTime = (ts) =>
  new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
