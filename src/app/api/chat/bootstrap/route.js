import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  listAllChatUsers,
  listUserCallLogs,
  listUserConversations,
} from "@/lib/supabase/chat";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const allUsers = await listAllChatUsers(adminSupabase);
    const usersById = new Map(allUsers.map((u) => [u.id, u]));

    const currentUser = usersById.get(user.id) || {
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.full_name || user.email,
      username: user.user_metadata?.username || "",
      avatarUrl: user.user_metadata?.avatar_url || "",
    };

    const otherUsers = allUsers.filter((u) => u.id !== user.id);

    const [{ conversations, chatTablesReady }, { callLogs }] = await Promise.all([
      listUserConversations(adminSupabase, user.id, usersById),
      listUserCallLogs(adminSupabase, user.id),
    ]);

    return NextResponse.json({
      ok: true,
      currentUser,
      users: otherUsers,
      conversations,
      chatTablesReady,
      callLogs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load chat workspace.",
      },
      { status: 500 }
    );
  }
}
