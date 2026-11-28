import { NextResponse } from "next/server";
import { invalidateUserConversationCaches } from "@/lib/cache/redis";
import { sendPushToConversationMembers } from "@/lib/notifications/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensurePublicBucket } from "@/lib/supabase/storage";
import {
  isChatSchemaPendingError,
  isUserParticipant,
  listConversationMessages,
} from "@/lib/supabase/chat";

const CHAT_MEDIA_BUCKET = "chat-media";
const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25 MB

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function inferMessageType(file, requestedType) {
  if (!file) return "text";
  if (IMAGE_MIME_TYPES.has(file.type) || requestedType === "image") {
    return "image";
  }
  if (VIDEO_MIME_TYPES.has(file.type) || requestedType === "video") {
    return "video";
  }
  return "document";
}

function sanitizeFileName(name) {
  return String(name || "attachment")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = String(searchParams.get("conversationId") || "").trim();
    const before = searchParams.get("before")
      ? String(searchParams.get("before")).trim()
      : null;
    const limit = Math.max(
      1,
      Math.min(10, Number(searchParams.get("limit") || 10) || 10)
    );

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
      return NextResponse.json({
        ok: true,
        messages: [],
        hasMore: false,
        nextBefore: null,
        chatTablesReady: false,
      });
    }

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { messages, hasMore, nextBefore } = await listConversationMessages(
      adminSupabase,
      conversationId,
      { limit, before }
    );

    return NextResponse.json({
      ok: true,
      messages,
      hasMore,
      nextBefore,
      chatTablesReady: true,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load messages.",
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

    const contentType = request.headers.get("content-type") || "";
    let conversationId = "";
    let content = "";
    let requestedType = "";
    let recipientOnline = false;
    let file = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      conversationId = String(formData.get("conversationId") || "").trim();
      content = String(formData.get("content") || "").trim();
      requestedType = String(formData.get("messageType") || "").trim();
      recipientOnline = formData.get("recipientOnline") === "true";
      const uploaded = formData.get("file");
      if (uploaded && typeof uploaded === "object" && uploaded.size > 0) {
        file = uploaded;
      }
    } else {
      const body = await request.json();
      conversationId = String(body?.conversationId || "").trim();
      content = String(body?.content || "").trim();
      recipientOnline = Boolean(body?.recipientOnline);
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required." },
        { status: 400 }
      );
    }

    if (!content && !file) {
      return NextResponse.json(
        { error: "Message text or attachment is required." },
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
      return NextResponse.json(
        {
          error:
            "Chat database tables are not set up yet. Run supabase/migrations/003_create_chat_tables.sql in Supabase SQL Editor.",
        },
        { status: 503 }
      );
    }

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messageType = inferMessageType(file, requestedType);
    let mediaUrl = null;
    let mediaName = null;
    let mediaSize = null;
    let mediaMime = null;

    if (file) {
      if (file.size > MAX_MEDIA_BYTES) {
        return NextResponse.json(
          { error: "Attachment must be 25 MB or smaller." },
          { status: 400 }
        );
      }

      if (messageType === "image" && !IMAGE_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Photo must be JPG, PNG, WebP, or GIF." },
          { status: 400 }
        );
      }

      if (messageType === "video" && !VIDEO_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Video must be MP4, WebM, or MOV." },
          { status: 400 }
        );
      }

      await ensurePublicBucket(adminSupabase, CHAT_MEDIA_BUCKET, {
        fileSizeLimit: MAX_MEDIA_BYTES,
      });

      const safeName = sanitizeFileName(file.name);
      const storagePath = `${conversationId}/${user.id}-${Date.now()}-${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadErr } = await adminSupabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadErr) {
        return NextResponse.json(
          { error: uploadErr.message || "Failed to upload attachment." },
          { status: 500 }
        );
      }

      const { data: urlData } = adminSupabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .getPublicUrl(storagePath);

      mediaUrl = urlData?.publicUrl || null;
      mediaName = file.name || safeName;
      mediaSize = file.size;
      mediaMime = file.type || "application/octet-stream";
    }

    const now = new Date().toISOString();
    const baseRow = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: content || null,
      message_type: messageType,
      media_url: mediaUrl,
      media_name: mediaName,
      media_size: mediaSize,
      media_mime: mediaMime,
      created_at: now,
    };

    let insertResult = await adminSupabase
      .from("messages")
      .insert(
        recipientOnline ? { ...baseRow, delivered_at: now } : baseRow
      )
      .select()
      .single();

    // Gracefully fall back if 004_add_message_receipts.sql hasn't been applied yet.
    if (
      insertResult.error?.code === "PGRST204" &&
      recipientOnline
    ) {
      insertResult = await adminSupabase
        .from("messages")
        .insert(baseRow)
        .select()
        .single();
    }

    const { data: insertedMsg, error: insertErr } = insertResult;

    if (insertErr) {
      if (isChatSchemaPendingError(insertErr)) {
        return NextResponse.json(
          { error: "Run 003_create_chat_tables.sql in Supabase SQL Editor first." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await adminSupabase
      .from("conversations")
      .update({
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", conversationId);

    // Fire Web Push notifications for recipients whose browser tab is closed/backgrounded.
    const meta = user.user_metadata || {};
    const senderName =
      meta.full_name || meta.username || user.email?.split("@")[0] || "User";
    const previewText =
      messageType === "image"
        ? content
          ? `📷 ${content}`
          : "📷 Sent a photo"
        : messageType === "video"
          ? content
            ? `🎥 ${content}`
            : "🎥 Sent a video"
          : messageType === "document"
            ? `📄 ${mediaName || "Sent a document"}`
            : content;

    const [{ data: convInfo }, { data: convParticipants }] = await Promise.all([
      adminSupabase
        .from("conversations")
        .select("type, name")
        .eq("id", conversationId)
        .maybeSingle(),
      adminSupabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId),
    ]);

    await invalidateUserConversationCaches(
      (convParticipants || []).map((p) => p.user_id)
    ).catch(() => {});

    await sendPushToConversationMembers({
      adminSupabase,
      conversationId,
      senderId: user.id,
      senderName,
      senderAvatar: meta.avatar_url || null,
      groupName: convInfo?.type === "group" ? convInfo.name : null,
      previewText,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      message: insertedMsg,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to send message.",
      },
      { status: 500 }
    );
  }
}
