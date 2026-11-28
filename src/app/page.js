import { Suspense } from "react";
import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listAllChatUsers,
  listConversationMessages,
  listUserCallLogs,
  listUserConversations,
} from "@/lib/supabase/chat";
import { createClient } from "@/lib/supabase/server";
import { getUserRecordById, syncUserRecord } from "@/lib/supabase/users";
import { getCachedNewChats } from "@/lib/cache/redis";
import { WorkspaceShellSkeleton } from "@/components/chat/ChatSkeletons";
import ChatWorkspace from "@/components/chat/ChatWorkspace";

async function AuthenticatedChatApp() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let { user: dbUser, schemaPending } = await getUserRecordById(user.id);
  if (!dbUser && !schemaPending) {
    const syncResult = await syncUserRecord(user, { markOnline: true });
    dbUser = syncResult.user ?? null;
  }

  const meta = user.user_metadata || {};
  const profileCompleted = Boolean(
    dbUser?.profile_completed ?? meta.profile_completed
  );

  if (!profileCompleted) {
    redirect("/profile-setup");
  }

  const adminSupabase = createAdminClient();
  const allUsers = await listAllChatUsers(adminSupabase);
  const usersById = new Map(allUsers.map((u) => [u.id, u]));

  const currentUser = usersById.get(user.id) || {
    id: user.id,
    email: user.email,
    displayName: dbUser?.full_name || meta.full_name || user.email,
    username: dbUser?.username || meta.username || "",
    avatarUrl: dbUser?.avatar_url || meta.avatar_url || "",
  };

  const otherUsers = allUsers.filter((u) => u.id !== user.id);

  const [convPage, { callLogs }, cachedNewChats] = await Promise.all([
    listUserConversations(adminSupabase, user.id, usersById, {
      offset: 0,
      limit: 10,
    }),
    listUserCallLogs(adminSupabase, user.id),
    getCachedNewChats(user.id),
  ]);

  const seenConvIds = new Set(convPage.conversations.map((c) => c.id));
  const conversations = [
    ...convPage.conversations,
    ...cachedNewChats.filter((c) => c?.id && !seenConvIds.has(c.id)),
  ].slice(0, 10);
  const chatTablesReady = convPage.chatTablesReady;

  let initialMessages = [];
  let initialHasMoreMessages = false;
  if (chatTablesReady && conversations[0]?.id) {
    const firstMsgPage = await listConversationMessages(
      adminSupabase,
      conversations[0].id,
      { limit: 10 }
    );
    initialMessages = firstMsgPage.messages;
    initialHasMoreMessages = firstMsgPage.hasMore;
  }

  let initialMigrationSql = "";
  if (!chatTablesReady) {
    try {
      initialMigrationSql = fs.readFileSync(
        path.join(process.cwd(), "supabase/migrations/003_create_chat_tables.sql"),
        "utf8"
      );
    } catch {
      initialMigrationSql = "";
    }
  }

  return (
    <ChatWorkspace
      initialCurrentUser={currentUser}
      initialUsers={otherUsers}
      initialConversations={conversations}
      initialMessages={initialMessages}
      initialHasMoreMessages={initialHasMoreMessages}
      initialChatTablesReady={chatTablesReady}
      initialMigrationSql={initialMigrationSql}
      initialCallLogs={callLogs}
      initialHasMoreConversations={convPage.hasMore}
      initialNextConversationsOffset={convPage.nextOffset}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<WorkspaceShellSkeleton />}>
      <AuthenticatedChatApp />
    </Suspense>
  );
}
