import { NextResponse } from "next/server";
import { sendPushToRecipients } from "@/lib/notifications/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isChatSchemaPendingError, listUserCallLogs } from "@/lib/supabase/chat";
import { createClient } from "@/lib/supabase/server";

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
    const { callLogs, callTablesReady } = await listUserCallLogs(
      adminSupabase,
      user.id
    );

    return NextResponse.json({ ok: true, callLogs, callTablesReady });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load call logs.",
      },
      { status: 500 }
    );
  }
}

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
    const callId = String(body?.callId || "").trim();
    const conversationId = body?.conversationId ? String(body.conversationId) : null;
    const callType = body?.callType === "video" ? "video" : "audio";
    const isGroup = Boolean(body?.isGroup);
    const title = body?.title ? String(body.title).trim().slice(0, 120) : null;
    const calleeIds = Array.isArray(body?.calleeIds)
      ? body.calleeIds.map((id) => String(id)).filter((id) => id && id !== user.id)
      : [];

    if (!callId || calleeIds.length === 0) {
      return NextResponse.json(
        { error: "callId and calleeIds are required." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const now = new Date().toISOString();
    const fallbackLog = {
      id: callId,
      call_id: callId,
      conversation_id: conversationId,
      caller_id: user.id,
      callee_ids: calleeIds,
      call_type: callType,
      is_group: isGroup,
      title,
      status: "ringing",
      started_at: now,
      answered_at: null,
      ended_at: null,
      duration_seconds: 0,
    };

    const { data: inserted, error: insertErr } = await adminSupabase
      .from("call_logs")
      .upsert(
        {
          call_id: callId,
          conversation_id: conversationId,
          caller_id: user.id,
          callee_ids: calleeIds,
          call_type: callType,
          is_group: isGroup,
          title,
          status: "ringing",
          started_at: now,
        },
        { onConflict: "call_id" }
      )
      .select()
      .single();

    if (insertErr && !isChatSchemaPendingError(insertErr)) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const meta = user.user_metadata || {};
    const callerName =
      meta.full_name || meta.username || user.email?.split("@")[0] || "Someone";
    const pushTitle = isGroup && title ? `${title}` : callerName;
    const pushBody =
      callType === "video"
        ? isGroup
          ? `${callerName} started a group video call`
          : "Incoming video call..."
        : isGroup
          ? `${callerName} started a group voice call`
          : "Incoming voice call...";

    await sendPushToRecipients({
      adminSupabase,
      recipientIds: calleeIds,
      title: pushTitle,
      body: pushBody,
      icon: meta.avatar_url || "/favicon.ico",
      conversationId,
      url: conversationId ? `/?chat=${encodeURIComponent(conversationId)}` : "/",
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      callLog: inserted || fallbackLog,
      schemaPending: Boolean(insertErr && isChatSchemaPendingError(insertErr)),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to start call log.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
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
    const callId = String(body?.callId || "").trim();
    const status = String(body?.status || "").trim();
    const durationSeconds = Math.max(0, Number(body?.durationSeconds || 0) || 0);

    if (
      !callId ||
      !["ringing", "answered", "ended", "missed", "rejected"].includes(status)
    ) {
      return NextResponse.json(
        { error: "Valid callId and status are required." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const now = new Date().toISOString();
    const patch = { status };
    if (status === "answered") {
      patch.answered_at = now;
    } else if (["ended", "missed", "rejected"].includes(status)) {
      patch.ended_at = now;
      patch.duration_seconds = Math.round(durationSeconds);
    }

    const { data: updated, error: updateErr } = await adminSupabase
      .from("call_logs")
      .update(patch)
      .eq("call_id", callId)
      .or(`caller_id.eq.${user.id},callee_ids.cs.{${user.id}}`)
      .select()
      .maybeSingle();

    if (updateErr && !isChatSchemaPendingError(updateErr)) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      callLog: updated || null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to update call log.",
      },
      { status: 500 }
    );
  }
}
