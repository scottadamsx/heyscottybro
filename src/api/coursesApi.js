// src/api/coursesApi.js — courses for the School space.
import { supabase } from "../utils/supabase";
import { uid } from "./_base";

export async function loadCourses({ includeArchived = false } = {}) {
  const userId = await uid();
  let q = supabase.from("courses").select("*").eq("user_id", userId).order("code");
  if (!includeArchived) q = q.eq("archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createCourse({ code, name, term = "", instructor = "", target_grade = null, color = "#5B8DEF" }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("courses")
    .insert({ user_id: userId, code, name, term, instructor, target_grade, color })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id, fields) {
  const { data, error } = await supabase.from("courses").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCourse(id) {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
}
