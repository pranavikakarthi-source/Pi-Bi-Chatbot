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
    about: dbRow?.about || meta.about || "Hey there! I am using PingMe.",
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
 * Fetches paginated hydrated conversations (10 per retrieval by default) for a given user.
 */
export async function listUserConversations(
  adminSupabase,
  userId,
  usersById,
  { offset = 0, limit = 10 } = {}
) {
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.max(1, Math.min(25, Number(limit) || 10));

  const { data: myMemberships, error: memErr } = await adminSupabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  if (memErr) {
    if (isChatSchemaPendingError(memErr)) {
      return {
        conversations: [],
        chatTablesReady: false,
        hasMore: false,
        nextOffset: 0,
      };
    }
    throw new Error(memErr.message);
  }

  const conversationIds = (myMemberships || []).map((m) => m.conversation_id);
  if (conversationIds.length === 0) {
    return {
      conversations: [],
      chatTablesReady: true,
      hasMore: false,
      nextOffset: safeOffset,
    };
  }

  // Fetch limit + 1 rows to know whether more pages remain.
  const { data: rawConvs, error: convErr } = await adminSupabase
    .from("conversations")
    .select("*")
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit);

  if (convErr) {
    if (isChatSchemaPendingError(convErr)) {
      return {
        conversations: [],
        chatTablesReady: false,
        hasMore: false,
        nextOffset: 0,
      };
    }
    throw new Error(convErr.message);
  }

  const allFetched = rawConvs || [];
  const hasMore = allFetched.length > safeLimit;
  const pageConvs = allFetched.slice(0, safeLimit);
  const pageConvIds = pageConvs.map((c) => c.id);

  if (pageConvIds.length === 0) {
    return {
      conversations: [],
      chatTablesReady: true,
      hasMore: false,
      nextOffset: safeOffset,
    };
  }

  const [partRes, msgRes] = await Promise.all([
    adminSupabase
      .from("conversation_participants")
      .select("*")
      .in("conversation_id", pageConvIds),
    adminSupabase
      .from("messages")
      .select("*")
      .in("conversation_id", pageConvIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(40, pageConvIds.length * 4)),
  ]);

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

  const conversations = pageConvs.map((conv) => ({
    id: conv.id,
    type: conv.type,
    name: conv.name,
    avatarUrl: conv.avatar_url,
    createdBy: conv.created_by,
    lastMessageAt: conv.last_message_at,
    participants: participantsByConv.get(conv.id) || [],
    lastMessage: lastMessageByConv.get(conv.id) || null,
  }));

  return {
    conversations,
    chatTablesReady: true,
    hasMore,
    nextOffset: safeOffset + conversations.length,
  };
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

/**
 * Fetches recent voice/video call logs for a given user.
 */
export async function listUserCallLogs(adminSupabase, userId) {
  const { data, error } = await adminSupabase
    .from("call_logs")
    .select("*")
    .or(`caller_id.eq.${userId},callee_ids.cs.{${userId}}`)
    .order("started_at", { ascending: false })
    .limit(60);

  if (error) {
    if (isChatSchemaPendingError(error)) {
      return { callLogs: [], callTablesReady: false };
    }
    throw new Error(error.message);
  }

  return { callLogs: data || [], callTablesReady: true };
}

/**
 * Fetches paginated messages (10 per retrieval by default) for a single conversation_id,
 * returning oldest-to-newest order plus whether older messages exist.
 */
export async function listConversationMessages(
  adminSupabase,
  conversationId,
  { limit = 10, before = null } = {}
) {
  const safeLimit = Math.max(1, Math.min(25, Number(limit) || 10));

  let query = adminSupabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(safeLimit + 1);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) {
    if (isChatSchemaPendingError(error)) {
      return { messages: [], hasMore: false, nextBefore: null };
    }
    throw new Error(error.message);
  }

  const rows = data || [];
  const hasMore = rows.length > safeLimit;
  const pageMessages = rows.slice(0, safeLimit).reverse();
  const nextBefore = pageMessages[0]?.created_at || null;

  return { messages: pageMessages, hasMore, nextBefore };
}
