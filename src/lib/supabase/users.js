import { createAdminClient } from "./admin";

const PENDING_SCHEMA_ERROR_CODES = new Set([
  "PGRST205", // table missing in schema cache
  "PGRST204", // column missing in schema cache
  "42501", // insufficient privilege until GRANT is applied
]);

function isSchemaPendingError(error) {
  return Boolean(error?.code && PENDING_SCHEMA_ERROR_CODES.has(error.code));
}

/**
 * Upserts a Supabase Auth user into `public.users` on registration, login, or profile update.
 * Gracefully reports `schemaPending: true` if migrations/grants haven't been applied yet.
 */
export async function syncUserRecord(
  user,
  { markLogin = false, markOnline = true, profile = null } = {}
) {
  if (!user?.id || !user?.email) {
    return {
      synced: false,
      missingTable: false,
      schemaPending: false,
      error: "Invalid user payload",
    };
  }

  const metadata = user.user_metadata || {};
  const now = new Date().toISOString();

  const payload = {
    id: user.id,
    email: user.email.toLowerCase(),
    username: profile?.username ?? metadata.username ?? null,
    full_name: profile?.full_name ?? metadata.full_name ?? null,
    phone: profile?.phone ?? metadata.phone ?? null,
    about: profile?.about ?? metadata.about ?? null,
    date_of_birth: profile?.date_of_birth ?? metadata.date_of_birth ?? null,
    avatar_url: profile?.avatar_url ?? metadata.avatar_url ?? null,
    profile_completed: Boolean(
      profile?.profile_completed ?? metadata.profile_completed
    ),
    is_verified: Boolean(user.email_confirmed_at),
    is_online: markOnline,
    last_seen_at: now,
  };

  if (markLogin) {
    payload.last_login_at = now;
  }

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("users")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    if (isSchemaPendingError(error)) {
      console.warn(
        `[supabase/users] Database sync skipped (${error.code}: ${error.message}). Run supabase/migrations/002_add_profile_fields_to_users.sql in Supabase SQL Editor.`
      );
      return {
        synced: false,
        missingTable: error.code === "PGRST205",
        schemaPending: true,
        error: error.message,
      };
    }

    return {
      synced: false,
      missingTable: false,
      schemaPending: false,
      error: error.message,
    };
  }

  return { synced: true, missingTable: false, schemaPending: false, user: data };
}

/**
 * Marks a user offline in `public.users` when signing out.
 */
export async function markUserOffline(userId) {
  if (!userId) return;

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("users")
    .update({
      is_online: false,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error && !isSchemaPendingError(error)) {
    console.warn("[supabase/users] Failed to mark user offline:", error.message);
  }
}

/**
 * Fetches a user's stored record from `public.users`.
 */
export async function getUserRecordById(userId) {
  if (!userId) {
    return { user: null, missingTable: false, schemaPending: false };
  }

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isSchemaPendingError(error)) {
      return {
        user: null,
        missingTable: error.code === "PGRST205",
        schemaPending: true,
      };
    }
    return {
      user: null,
      missingTable: false,
      schemaPending: false,
      error: error.message,
    };
  }

  return { user: data, missingTable: false, schemaPending: false };
}
