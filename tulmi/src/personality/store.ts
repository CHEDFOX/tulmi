/**
 * Per-user personality storage. Saved in the Supabase `personalities` table
 * (one row per user, the profile kept as JSON). When Supabase is disabled
 * (DEV_SKIP_AUTH local testing) we fall back to an in-memory map so the feature
 * still works end-to-end without a database.
 */
import { supabase } from "../auth/supabase.js";
import type { Personality } from "../../../shared/types/api.js";

const memory = new Map<string, Personality>();

export async function getPersonality(userId: string): Promise<Personality> {
  const sb = supabase();
  if (!sb) return memory.get(userId) ?? {};

  const { data, error } = await sb
    .from("personalities")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(`[personality] load failed for ${userId}:`, error.message);
    return {};
  }
  return (data?.data as Personality) ?? {};
}

export async function savePersonality(
  userId: string,
  personality: Personality,
): Promise<void> {
  const sb = supabase();
  if (!sb) {
    memory.set(userId, personality);
    return;
  }

  const { error } = await sb
    .from("personalities")
    .upsert(
      { user_id: userId, data: personality, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) {
    throw new Error(`Failed to save personality: ${error.message}`);
  }
}

/**
 * Resolve the personality to use for a request: an inline override from the app
 * wins; otherwise fall back to the user's saved profile.
 */
export async function resolvePersonality(
  userId: string,
  override: Personality | undefined,
): Promise<Personality> {
  if (override && Object.keys(override).length > 0) return override;
  return getPersonality(userId);
}
