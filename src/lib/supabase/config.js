/**
 * Resolves public Supabase URL and anon key for both browser and server runtimes.
 * Uses static `process.env.NEXT_PUBLIC_*` reads so Next.js can inline them in client bundles.
 */
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (typeof window === "undefined" ? process.env.SUPABASE_ANON_KEY : undefined);

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Check your .env.local file."
    );
  }

  if (!anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Check your .env.local file."
    );
  }

  return { url, anonKey };
}

/**
 * Resolves the server-only Supabase service role key.
 */
export function getSupabaseServiceRoleKey() {
  if (typeof window !== "undefined") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must never be accessed in a browser environment."
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Check your .env.local file."
    );
  }

  return serviceRoleKey;
}
