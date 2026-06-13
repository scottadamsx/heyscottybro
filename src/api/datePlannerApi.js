import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

export async function loadDateIdeas() {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("date_ideas").select("*").eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addDateIdea({ title, emoji = "💖", note = "" }) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("date_ideas")
    .insert({ user_id: userId, title, emoji, note })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteDateIdea(id) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in.");
  const { error } = await supabase.from("date_ideas").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function loadDateCompleted() {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("date_completed").select("*").eq("user_id", userId)
    .order("done_on", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addDateCompleted({ title, emoji = "💖", note = "", done_on }) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("date_completed")
    .insert({ user_id: userId, title, emoji, note, done_on })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateDateMemory(id, memory) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in.");
  const { error } = await supabase.from("date_completed").update({ memory }).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteDateCompleted(id) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in.");
  const { error } = await supabase.from("date_completed").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

/** One-time migration: push localStorage facts to Supabase. */
export async function syncLocalDatePlanner() {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in.");
  let local = { ideas: [], completed: [] };
  try { local = JSON.parse(localStorage.getItem("datePlanner")) || local; } catch { /* ignore */ }

  const { data: existingIdeas } = await supabase.from("date_ideas").select("title").eq("user_id", userId);
  const { data: existingDone } = await supabase.from("date_completed").select("title").eq("user_id", userId);
  const ideaTitles = new Set((existingIdeas || []).map((r) => r.title.trim().toLowerCase()));
  const doneTitles = new Set((existingDone || []).map((r) => r.title.trim().toLowerCase()));

  const newIdeas = (local.ideas || []).filter((i) => i.title && !ideaTitles.has(i.title.trim().toLowerCase()));
  const newDone = (local.completed || []).filter((c) => c.title && !doneTitles.has(c.title.trim().toLowerCase()));

  if (newIdeas.length) {
    await supabase.from("date_ideas").insert(newIdeas.map((i) => ({ user_id: userId, title: i.title, emoji: i.emoji || "💖", note: i.note || "" })));
  }
  if (newDone.length) {
    await supabase.from("date_completed").insert(newDone.map((c) => ({ user_id: userId, title: c.title, emoji: c.emoji || "💖", note: c.note || "", memory: c.memory || "", done_on: c.doneOn || null })));
  }
  return { ideas: newIdeas.length, completed: newDone.length };
}
