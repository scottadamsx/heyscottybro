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
  const h = headers.map(x => x.toLowerCase().trim());
  let nameIdx = -1, firstIdx = -1, lastIdx = -1, emailIdx = -1, phoneIdx = -1;
  h.forEach((col, i) => {
    // Full name patterns — including Google Form section headers that contain the name
    if (nameIdx === -1 && (
      /full\s*name|first\s*and\s*last|your\s*full\s*name|^name$/.test(col) ||
      /personal\s*details|let.*start.*personal|start.*with.*your/.test(col)
    )) nameIdx = i;
    // First name
    if (firstIdx === -1 && /\bfirst\s*name\b|^first\b/.test(col)) firstIdx = i;
    // Last name / surname
    if (lastIdx === -1 && (/\blast\s*name\b|^last\b|\bsurname\b/.test(col))) lastIdx = i;
    // Email
    if (emailIdx === -1 && /email/.test(col)) emailIdx = i;
    // Phone — skip emergency/guardian contacts
    if (phoneIdx === -1 && /phone|mobile|cell/.test(col) && !/emergency|guardian|parent/.test(col)) phoneIdx = i;
  });

  // Last-resort fallback: if still no name column found, use the first text-looking column
  // that isn't email/phone/date (helps with non-standard forms)
  if (nameIdx === -1 && firstIdx === -1) {
    for (let i = 0; i < h.length; i++) {
      if (i !== emailIdx && i !== phoneIdx && !/date|time|stamp|id\b/.test(h[i])) {
        nameIdx = i;
        break;
      }
    }
  }

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

export async function loadHikeHistory() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("hiker_imports")
    .select("*")
    .eq("user_id", userId)
    .order("hike_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadHikeAttendees(hikeImportId) {
  const { data, error } = await supabase
    .from("hike_attendees")
    .select("member_id, hiker_members(id, first, last, email, phone, attendance)")
    .eq("hike_import_id", hikeImportId);
  if (error) throw error;
  return (data ?? []).map(r => r.hiker_members).filter(Boolean);
}

export async function importCSV(fileText, filename, hikeName, hikeDate) {
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

  const existingList = existing ?? [];
  const existingByName = {};
  const existingByEmail = {};
  const existingByPhone = {};
  existingList.forEach(m => {
    existingByName[`${m.first.toLowerCase()}|${m.last.toLowerCase()}`] = m;
    if (m.email) existingByEmail[m.email.toLowerCase()] = m;
    if (m.phone) existingByPhone[m.phone] = m;
  });

  let firstTimers = 0, returning = 0;
  const toInsert = [];
  const toUpdate = [];
  // track which existing IDs we've already queued an update for this import
  const updatedIds = new Set();

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

    // Find existing match: name first, then email, then phone
    const nameKey = `${first.toLowerCase()}|${last.toLowerCase()}`;
    let match =
      existingByName[nameKey] ||
      (email ? existingByEmail[email.toLowerCase()] : null) ||
      (phone ? existingByPhone[phone] : null);

    if (match && !updatedIds.has(match.id)) {
      toUpdate.push({
        id: match.id,
        attendance: (match.attendance || 1) + 1,
        // Fill in missing details from the new row
        first: match.first || first,
        last: match.last || last,
        email: email || match.email,
        phone: phone || match.phone,
      });
      // Keep lookup maps fresh so same-import duplicates also merge
      existingByName[nameKey] = { ...match, attendance: (match.attendance || 1) + 1 };
      if (email) existingByEmail[email.toLowerCase()] = existingByName[nameKey];
      if (phone) existingByPhone[phone] = existingByName[nameKey];
      updatedIds.add(match.id);
      returning++;
    } else if (!match) {
      const newMember = { user_id: userId, first, last, email, phone, attendance: 1, joined_date: new Date().toISOString().split("T")[0] };
      toInsert.push(newMember);
      // Add to maps so within-file duplicates merge too
      existingByName[nameKey] = newMember;
      if (email) existingByEmail[email.toLowerCase()] = newMember;
      if (phone) existingByPhone[phone] = newMember;
      firstTimers++;
    }
    // If match already in updatedIds — same person appeared twice in this file, skip
  }

  // Batch upserts
  if (toInsert.length) {
    await supabase.from("hiker_members").insert(toInsert);
  }
  for (const u of toUpdate) {
    await supabase.from("hiker_members")
      .update({ attendance: u.attendance, first: u.first, last: u.last, email: u.email, phone: u.phone })
      .eq("id", u.id);
  }

  // Log the import
  const { data: importRow, error: importErr } = await supabase.from("hiker_imports").insert({
    user_id: userId, filename,
    imported_at: new Date().toISOString().split("T")[0],
    hike_name: hikeName || filename,
    hike_date: hikeDate || new Date().toISOString().split("T")[0],
    first_timers: firstTimers, returning_count: returning, total: firstTimers + returning,
  }).select().single();
  if (importErr) throw importErr;

  // Record attendees for this hike (all inserted + updated members)
  const attendeeInserts = [];
  for (const u of toUpdate) {
    attendeeInserts.push({ hike_import_id: importRow.id, member_id: u.id });
  }
  // For new inserts we need to fetch their IDs
  if (toInsert.length) {
    const newNames = toInsert.map(m => `${m.first.toLowerCase()}|${m.last.toLowerCase()}`);
    const { data: newRows } = await supabase
      .from("hiker_members")
      .select("id, first, last")
      .eq("user_id", userId)
      .in("first", toInsert.map(m => m.first));
    if (newRows) {
      newRows.forEach(r => {
        const key = `${r.first.toLowerCase()}|${r.last.toLowerCase()}`;
        if (newNames.includes(key)) {
          attendeeInserts.push({ hike_import_id: importRow.id, member_id: r.id });
        }
      });
    }
  }
  if (attendeeInserts.length) {
    await supabase.from("hike_attendees").insert(attendeeInserts);
  }

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
