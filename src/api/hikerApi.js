import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

// ── Members ──────────────────────────────────
export async function loadMembers(search = "") {
  const userId = await uid();
  let query = supabase
    .from("hiker_members")
    .select("*")
    .eq("user_id", userId)
    .order("last", { ascending: true });

  if (search.trim()) {
    query = query.or(`first.ilike.%${search}%,last.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function loadStats() {
  const userId = await uid();
  const { data: members, error } = await supabase
    .from("hiker_members")
    .select("attendance, email")
    .eq("user_id", userId);
  if (error) throw error;

  const { data: imports } = await supabase
    .from("hiker_imports")
    .select("id, returning_count")
    .eq("user_id", userId);

  const total = members.length;
  const returning = members.filter(m => m.attendance > 1).length;
  const withEmail = members.filter(m => m.email).length;
  const totalCheckins = members.reduce((s, m) => s + (m.attendance || 0), 0);

  const { data: top } = await supabase
    .from("hiker_members")
    .select("first, last, attendance")
    .eq("user_id", userId)
    .order("attendance", { ascending: false })
    .limit(5);

  return {
    total, returning, withEmail, totalCheckins,
    totalImports: imports?.length ?? 0,
    topHikers: top ?? [],
  };
}

// ── CSV Import ────────────────────────────────
function detectColumns(headers) {
  const h = headers.map(x => x.toLowerCase());
  let nameIdx = -1, firstIdx = -1, lastIdx = -1, emailIdx = -1, phoneIdx = -1;
  h.forEach((col, i) => {
    if (/full\s*name|first\s*and\s*last|your\s*full\s*name/.test(col) && nameIdx === -1) nameIdx = i;
    if (/^first/.test(col) && firstIdx === -1) firstIdx = i;
    if (/^last/.test(col) && lastIdx === -1) lastIdx = i;
    if (/email/.test(col) && emailIdx === -1) emailIdx = i;
    if (/phone/.test(col) && !/emergency/.test(col) && phoneIdx === -1) phoneIdx = i;
  });
  return { nameIdx, firstIdx, lastIdx, emailIdx, phoneIdx };
}

function splitName(full) {
  const parts = full.trim().split(/\s+/);
  if (!parts.length) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts.slice(1).join(" ")];
}

function cleanPhone(p) {
  return p ? p.replace(/[^0-9+]/g, "") : "";
}

function toTitle(s) {
  return s.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export async function importCSV(fileText, filename) {
  const userId = await uid();
  const lines = fileText.split(/\r?\n/);
  const rows = lines.map(l => {
    // Simple CSV parse (handles quoted fields)
    const result = [];
    let cur = "", inQ = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { result.push(cur); cur = ""; continue; }
      cur += c;
    }
    result.push(cur);
    return result;
  }).filter(r => r.some(c => c.trim()));

  if (rows.length < 2) return { first_timers: 0, returning: 0, total: 0, filename };

  const headers = rows[0];
  const { nameIdx, firstIdx, lastIdx, emailIdx, phoneIdx } = detectColumns(headers);

  // Load existing members for dedup
  const { data: existing } = await supabase
    .from("hiker_members")
    .select("id, first, last, email, phone, attendance")
    .eq("user_id", userId);

  const existingMap = {};
  (existing ?? []).forEach(m => {
    existingMap[`${m.first.toLowerCase()}|${m.last.toLowerCase()}`] = m;
  });

  let firstTimers = 0, returning = 0;
  const toInsert = [];
  const toUpdate = [];

  for (const row of rows.slice(1)) {
    let first = "", last = "", email = "", phone = "";

    if (nameIdx >= 0 && row[nameIdx]?.trim()) {
      [first, last] = splitName(row[nameIdx]);
    } else {
      first = row[firstIdx]?.trim() ?? "";
      last = row[lastIdx]?.trim() ?? "";
    }
    if (!first && !last) continue;

    email = row[emailIdx]?.trim() ?? "";
    phone = cleanPhone(row[phoneIdx] ?? "");
    first = toTitle(first);
    last = toTitle(last);

    const key = `${first.toLowerCase()}|${last.toLowerCase()}`;
    const match = existingMap[key];

    if (match) {
      toUpdate.push({
        id: match.id,
        attendance: (match.attendance || 1) + 1,
        email: email || match.email,
        phone: phone || match.phone,
      });
      returning++;
    } else {
      toInsert.push({
        user_id: userId, first, last, email, phone,
        attendance: 1,
        joined_date: new Date().toISOString().split("T")[0],
      });
      existingMap[key] = { first, last, email, phone, attendance: 1 };
      firstTimers++;
    }
  }

  // Batch upserts
  if (toInsert.length) {
    await supabase.from("hiker_members").insert(toInsert);
  }
  for (const u of toUpdate) {
    await supabase.from("hiker_members")
      .update({ attendance: u.attendance, email: u.email, phone: u.phone })
      .eq("id", u.id);
  }

  // Log the import
  await supabase.from("hiker_imports").insert({
    user_id: userId, filename,
    imported_at: new Date().toISOString().split("T")[0],
    first_timers: firstTimers, returning_count: returning, total: firstTimers + returning,
  });

  return { first_timers: firstTimers, returning, total: firstTimers + returning, filename };
}

export function exportCSV(members) {
  const rows = [["First Name", "Last Name", "Email", "Phone", "Attendance"]];
  members.forEach(m => rows.push([m.first, m.last, m.email || "", m.phone || "", m.attendance]));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sjhc_members.csv";
  a.click();
  URL.revokeObjectURL(url);
}
