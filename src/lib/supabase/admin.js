import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig, getSupabaseServiceRoleKey } from "./config";

/**
 * Creates a privileged Supabase client using the service role key.
 * Only use in trusted server-side contexts (Route Handlers, Server Actions, scripts).
 */
export function createAdminClient() {
  const { url } = getSupabaseConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
