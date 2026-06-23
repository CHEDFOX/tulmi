/**
 * Supabase client + auth helpers (server-side, uses the SERVICE ROLE key).
 *
 * The SERVICE ROLE key bypasses row-level security and must NEVER be shipped to
 * a client. The Android app authenticates the user with the ANON key, gets a
 * JWT, and sends it to us; we verify it here to resolve the user id.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";

let client: SupabaseClient | null = null;
let verifier: SupabaseClient | null = null;

/** Returns the service-role Supabase client, or null if metering is disabled. */
export function supabase(): SupabaseClient | null {
  const cfg = getConfig();
  if (!cfg.supabaseEnabled) return null;
  if (!client) {
    client = createClient(cfg.SUPABASE_URL!, cfg.SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * A client used only to VERIFY user JWTs (calls /auth/v1/user with the token).
 * Prefers the service key when present, else uses the public anon key — both can
 * resolve a user from a token, so auth works without the secret service key.
 */
function verifyClient(): SupabaseClient | null {
  const cfg = getConfig();
  if (!cfg.authEnabled) return null;
  if (!verifier) {
    const key = cfg.SUPABASE_SERVICE_KEY ?? cfg.SUPABASE_ANON_KEY!;
    verifier = createClient(cfg.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return verifier;
}

export interface AuthedUser {
  id: string;
  email?: string;
}

/**
 * Resolve the user from an Authorization header value.
 *
 * - In DEV_SKIP_AUTH mode, returns a stable dev user so the pipeline runs with
 *   only Groq + OpenRouter keys.
 * - Otherwise verifies the Supabase JWT and returns the real user.
 *
 * Returns null when the token is missing/invalid (caller should reject).
 */
export async function resolveUser(
  authorization: string | undefined,
): Promise<AuthedUser | null> {
  const cfg = getConfig();

  if (cfg.DEV_SKIP_AUTH) {
    return { id: "dev-user", email: "dev@flow.local" };
  }

  const sb = verifyClient();
  if (!sb) return null;

  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? undefined };
}
