import { createAdminClient } from "./admin";

const PENDING_SCHEMA_CODES = new Set(["PGRST205", "PGRST204", "42501"]);

export function isChatSchemaPendingError(error) {
  return Boolean(error?.code && PENDING_SCHEMA_CODES.has(error.code));
}

function mapAuthUserToProfile(authUser, dbRow) {
  const meta = authUser?.user_metadata || {};
  const email = (dbRow?.email || authUser?.email || "").toLowerCase();
  const fullName = dbRow?.full_name || meta.full_name || "";
  const username = dbRow?.username || meta.username || "";
  const displayName =
    fullName || username || (email ? email.split("@")[0] : "User");

  return {
    id: authUser.id,
    email,
    username,
    fullName,
    displayName,
    about: dbRow?.about || meta.about || "Hey there! I am using Chatbot.",
    phone: dbRow?.phone || meta.phone || "",
    avatarUrl: dbRow?.avatar_url || meta.avatar_url || "",
    isOnline: Boolean(dbRow?.is_online),
    lastSeenAt: dbRow?.last_seen_at || authUser?.last_sign_in_at || null,
    profileCompleted: Boolean(
      dbRow?.profile_completed ?? meta.profile_completed
    ),
  };
}

/**
 * Fetches all registered users (merged from auth.users and public.users).
 */
export async function listAllChatUsers(adminSupabase) {
  const { data: authList, error: authErr } =
    await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (authErr) {
    throw new Error(authErr.message || "Failed to load users.");
  }

  const { data: dbRows, error: dbErr } = await adminSupabase
    .from("users")
    .select("*");

  const dbMap = new Map();
  if (!dbErr && Array.isArray(dbRows)) {
    dbRows.forEach((row) => dbMap.set(row.id, row));
  }

  return (authList?.users || [])
    .filter((u) => Boolean(u.email))
    .map((authUser) => mapAuthUserToProfile(authUser, dbMap.get(authUser.id)))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Fetches hydrated conversations (participants + latest message) for a given user.
 */
export async function listUserConversations(adminSupabase, userId, usersById) {
  const { data: myMemberships, error: memErr } = await adminSupabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  if (memErr) {
    if (isChatSchemaPendingError(memErr)) {
      return { conversations: [], chatTablesReady: false };
    }
    throw new Error(memErr.message);
  }

  const conversationIds = (myMemberships || []).map((m) => m.conversation_id);
  if (conversationIds.length === 0) {
    return { conversations: [], chatTablesReady: true };
  }

  const [convRes, partRes, msgRes] = await Promise.all([
    adminSupabase
      .from("conversations")
      .select("*")
      .in("id", conversationIds)
      .order("last_message_at", { ascending: false }),
    adminSupabase
      .from("conversation_participants")
      .select("*")
      .in("conversation_id", conversationIds),
    adminSupabase
      .from("messages")
      .select("*")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (convRes.error) {
    if (isChatSchemaPendingError(convRes.error)) {
      return { conversations: [], chatTablesReady: false };
    }
    throw new Error(convRes.error.message);
  }

  const participantsByConv = new Map();
  (partRes.data || []).forEach((row) => {
    const list = participantsByConv.get(row.conversation_id) || [];
    const profile = usersById.get(row.user_id);
    if (profile) {
      list.push({ ...profile, role: row.role });
    }
    participantsByConv.set(row.conversation_id, list);
  });

  const lastMessageByConv = new Map();
  (msgRes.data || []).forEach((msg) => {
    if (!lastMessageByConv.has(msg.conversation_id)) {
      lastMessageByConv.set(msg.conversation_id, msg);
    }
  });

  const conversations = (convRes.data || []).map((conv) => ({
    id: conv.id,
    type: conv.type,
    name: conv.name,
    avatarUrl: conv.avatar_url,
    createdBy: conv.created_by,
    lastMessageAt: conv.last_message_at,
    participants: participantsByConv.get(conv.id) || [],
    lastMessage: lastMessageByConv.get(conv.id) || null,
  }));

  return { conversations, chatTablesReady: true };
}

/**
 * Checks whether a user belongs to a conversation.
 */
export async function isUserParticipant(adminSupabase, conversationId, userId) {
  const { data, error } = await adminSupabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isChatSchemaPendingError(error)) {
      return { isMember: false, chatTablesReady: false };
    }
    throw new Error(error.message);
  }

  return { isMember: Boolean(data), chatTablesReady: true };
}
