import { Suspense } from "react";
import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listAllChatUsers,
  listUserCallLogs,
  listUserConversations,
} from "@/lib/supabase/chat";
import { createClient } from "@/lib/supabase/server";
import { getUserRecordById, syncUserRecord } from "@/lib/supabase/users";
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

  const [{ conversations, chatTablesReady }, { callLogs }] = await Promise.all([
    listUserConversations(adminSupabase, user.id, usersById),
    listUserCallLogs(adminSupabase, user.id),
  ]);

  let initialMessages = [];
  if (chatTablesReady && conversations[0]?.id) {
    const { data: msgRows } = await adminSupabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversations[0].id)
      .order("created_at", { ascending: true })
      .limit(250);
    initialMessages = msgRows || [];
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
      initialChatTablesReady={chatTablesReady}
      initialMigrationSql={initialMigrationSql}
      initialCallLogs={callLogs}
    />
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="h-screen w-full bg-white dark:bg-[#0b141a] flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading chats...
        </main>
      }
    >
      <AuthenticatedChatApp />
    </Suspense>
  );
}
