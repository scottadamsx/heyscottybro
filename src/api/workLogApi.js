// src/api/workLogApi.js — daily work log: task done, notes, project (Plan > Work).
import { supabase } from "../utils/supabase";
import { uid } from "./_base";
import { emitDataChange } from "../utils/dataEvents";

export async function loadWorkLog() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("work_log").select("*").eq("user_id", userId)
    .order("date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createWorkLog({ date, task, notes = "", project_id = null, minutes = null }) {
  const userId = await uid();
  const row = { user_id: userId, date, task: String(task).trim(), notes: notes || "", project_id: project_id || null, minutes: minutes ? Number(minutes) : null };
  const { data, error } = await supabase.from("work_log").insert(row).select().single();
  if (error) throw error;
  emitDataChange("work_log");
  return data;
}

export async function updateWorkLog(id, patch) {
  const allowed = ["date", "task", "notes", "project_id", "minutes"];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  const { error } = await supabase.from("work_log").update(clean).eq("id", id);
  if (error) throw error;
  emitDataChange("work_log");
}

export async function deleteWorkLog(id) {
  const { error } = await supabase.from("work_log").delete().eq("id", id);
  if (error) throw error;
  emitDataChange("work_log");
}
