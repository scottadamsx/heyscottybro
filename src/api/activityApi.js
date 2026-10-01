import { supabase } from "../utils/supabase";
import { buildActivityEvent } from "../utils/activityEvents";
import { uid } from "./_base";

export async function recordActivityEvent(input, expectedOwnerId) {
  const userId = await uid(expectedOwnerId);
  const row = { ...buildActivityEvent(input), user_id: userId };
  const { error } = await supabase.from("activity_events").upsert(row, {
    onConflict: "user_id,idempotency_key",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`Couldn't record product activity: ${error.message || error}`);
  return true;
}

export async function tryRecordActivityEvent(input, expectedOwnerId) {
  try { return await recordActivityEvent(input, expectedOwnerId); }
  catch (error) {
    console.warn("[activity] telemetry was not recorded", error);
    return false;
  }
}
