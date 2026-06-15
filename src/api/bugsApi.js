import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function loadBugs() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("bugs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createBug({ title, description, steps, page, priority = "medium" }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("bugs")
    .insert({ user_id: userId, title, description: description || null, steps: steps || null, page: page || null, priority, status: "open" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBug(id, fields) {
  const patch = { ...fields };
  if ((fields.status === "resolved" || fields.status === "closed") && !fields.resolved_at) {
    patch.resolved_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from("bugs").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBug(id) {
  const { error } = await supabase.from("bugs").delete().eq("id", id);
  if (error) throw error;
}
