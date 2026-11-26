import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

/**
 * Creates a Supabase client for Client Components (browser runtime)
 * with explicit WebSocket Realtime configuration.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient(url, anonKey, {
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  });
}
