import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isChatSchemaPendingError,
  isUserParticipant,
} from "@/lib/supabase/chat";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const conversationId = String(body?.conversationId || "").trim();
    const status = body?.status === "read" ? "read" : "delivered";

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const { isMember, chatTablesReady } = await isUserParticipant(
      adminSupabase,
      conversationId,
      user.id
    );

    if (!chatTablesReady) {
      return NextResponse.json({ ok: true, schemaPending: true });
    }

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date().toISOString();

    if (status === "read") {
      const { error: delErr } = await adminSupabase
        .from("messages")
        .update({ delivered_at: now })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("delivered_at", null);

      if (delErr && isChatSchemaPendingError(delErr)) {
        return NextResponse.json({ ok: true, schemaPending: true });
      }

      const { error: readErr } = await adminSupabase
        .from("messages")
        .update({ read_at: now })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("read_at", null);

      if (readErr) {
        if (isChatSchemaPendingError(readErr)) {
          return NextResponse.json({ ok: true, schemaPending: true });
        }
        return NextResponse.json({ error: readErr.message }, { status: 500 });
      }
    } else {
      const { error: delErr } = await adminSupabase
        .from("messages")
        .update({ delivered_at: now })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("delivered_at", null);

      if (delErr) {
        if (isChatSchemaPendingError(delErr)) {
          return NextResponse.json({ ok: true, schemaPending: true });
        }
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, status, timestamp: now });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update receipts.",
      },
      { status: 500 }
    );
  }
}
