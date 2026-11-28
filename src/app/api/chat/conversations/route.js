import { NextResponse } from "next/server";
import {
  cacheNewChatForUsers,
  getCachedJson,
  getConvsPageCacheKey,
  invalidateUserConversationCaches,
  setCachedJson,
} from "@/lib/cache/redis";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensurePublicBucket } from "@/lib/supabase/storage";
import {
  isChatSchemaPendingError,
  isUserParticipant,
  listAllChatUsers,
  listUserConversations,
} from "@/lib/supabase/chat";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const CONVERSATIONS_PAGE_SIZE = 10;

async function uploadGroupAvatar(adminSupabase, groupId, file) {
  if (!file || typeof file !== "object" || file.size <= 0) {
    return null;
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Group photo must be JPG, PNG, WebP, or GIF.");
  }

  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Group photo must be 5 MB or smaller.");
  }

  await ensurePublicBucket(adminSupabase, AVATAR_BUCKET, {
    fileSizeLimit: MAX_AVATAR_BYTES,
    allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
  });

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const storagePath = `groups/${groupId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await adminSupabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(uploadErr.message || "Failed to upload group photo.");
  }

  const { data: urlData } = adminSupabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(storagePath);

  return urlData?.publicUrl || null;
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
    const offset = Math.max(0, Number(searchParams.get("offset") || 0) || 0);
    const limit = Math.max(
      1,
      Math.min(CONVERSATIONS_PAGE_SIZE, Number(searchParams.get("limit") || CONVERSATIONS_PAGE_SIZE) || CONVERSATIONS_PAGE_SIZE)
    );

    const cacheKey = getConvsPageCacheKey(user.id, offset, limit);
    const cachedPage = await getCachedJson(cacheKey);
    if (cachedPage) {
      return NextResponse.json({
        ok: true,
        ...cachedPage,
        cached: true,
      });
    }

    const adminSupabase = createAdminClient();
    const allUsers = await listAllChatUsers(adminSupabase);
    const usersById = new Map(allUsers.map((u) => [u.id, u]));

    const result = await listUserConversations(adminSupabase, user.id, usersById, {
      offset,
      limit,
    });

    await setCachedJson(cacheKey, result, 45);

    return NextResponse.json({
      ok: true,
      ...result,
      cached: false,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load conversations.",
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
    let body = {};
    let groupAvatarFile = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      let memberIds = [];
      try {
        const parsedMembers = JSON.parse(
          String(formData.get("memberIds") || "[]")
        );
        if (Array.isArray(parsedMembers)) memberIds = parsedMembers;
      } catch {
        memberIds = [];
      }
      body = {
        type: String(formData.get("type") || "group"),
        name: String(formData.get("name") || ""),
        targetUserId: String(formData.get("targetUserId") || ""),
        memberIds,
      };
      groupAvatarFile = formData.get("avatar");
    } else {
      body = await request.json();
    }

    const type = body?.type === "group" ? "group" : "direct";
    const adminSupabase = createAdminClient();

    const allUsers = await listAllChatUsers(adminSupabase);
    const usersById = new Map(allUsers.map((u) => [u.id, u]));

    if (type === "direct") {
      const targetUserId = String(body?.targetUserId || "").trim();
      if (!targetUserId || targetUserId === user.id || !usersById.has(targetUserId)) {
        return NextResponse.json(
          { error: "Please select a valid user to chat with." },
          { status: 400 }
        );
      }

      const { conversations, chatTablesReady } = await listUserConversations(
        adminSupabase,
        user.id,
        usersById,
        { offset: 0, limit: 25 }
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

      const existingDirect = conversations.find(
        (conv) =>
          conv.type === "direct" &&
          conv.participants.length === 2 &&
          conv.participants.some((p) => p.id === targetUserId)
      );

      if (existingDirect) {
        return NextResponse.json({
          ok: true,
          existing: true,
          conversation: existingDirect,
        });
      }

      const { data: createdConv, error: convErr } = await adminSupabase
        .from("conversations")
        .insert({
          type: "direct",
          created_by: user.id,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (convErr) {
        if (isChatSchemaPendingError(convErr)) {
          return NextResponse.json(
            { error: "Run 003_create_chat_tables.sql in Supabase SQL Editor first." },
            { status: 503 }
          );
        }
        return NextResponse.json({ error: convErr.message }, { status: 500 });
      }

      const { error: partErr } = await adminSupabase
        .from("conversation_participants")
        .insert([
          { conversation_id: createdConv.id, user_id: user.id, role: "admin" },
          {
            conversation_id: createdConv.id,
            user_id: targetUserId,
            role: "member",
          },
        ]);

      if (partErr) {
        return NextResponse.json({ error: partErr.message }, { status: 500 });
      }

      const hydratedDirect = {
        id: createdConv.id,
        type: "direct",
        name: null,
        avatarUrl: null,
        createdBy: user.id,
        lastMessageAt: createdConv.last_message_at,
        participants: [usersById.get(user.id), usersById.get(targetUserId)].filter(
          Boolean
        ),
        lastMessage: null,
      };

      await cacheNewChatForUsers([user.id, targetUserId], hydratedDirect);

      return NextResponse.json({
        ok: true,
        existing: false,
        conversation: hydratedDirect,
      });
    }

    // Group chat creation
    const groupName = String(body?.name || "").trim();
    const rawMembers = Array.isArray(body?.memberIds) ? body.memberIds : [];
    const uniqueMemberIds = Array.from(
      new Set(
        rawMembers
          .map((id) => String(id).trim())
          .filter((id) => id && id !== user.id && usersById.has(id))
      )
    );

    if (groupName.length < 2) {
      return NextResponse.json(
        { error: "Group name must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (uniqueMemberIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least 1 member to create a group." },
        { status: 400 }
      );
    }

    const { data: createdGroup, error: groupErr } = await adminSupabase
      .from("conversations")
      .insert({
        type: "group",
        name: groupName,
        created_by: user.id,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (groupErr) {
      if (isChatSchemaPendingError(groupErr)) {
        return NextResponse.json(
          {
            error:
              "Chat database tables are not set up yet. Run supabase/migrations/003_create_chat_tables.sql in Supabase SQL Editor.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: groupErr.message }, { status: 500 });
    }

    const participantRows = [
      { conversation_id: createdGroup.id, user_id: user.id, role: "admin" },
      ...uniqueMemberIds.map((memberId) => ({
        conversation_id: createdGroup.id,
        user_id: memberId,
        role: "member",
      })),
    ];

    const { error: partErr } = await adminSupabase
      .from("conversation_participants")
      .insert(participantRows);

    if (partErr) {
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    let avatarUrl = createdGroup.avatar_url || null;
    if (groupAvatarFile && typeof groupAvatarFile === "object" && groupAvatarFile.size > 0) {
      avatarUrl = await uploadGroupAvatar(
        adminSupabase,
        createdGroup.id,
        groupAvatarFile
      );
      if (avatarUrl) {
        await adminSupabase
          .from("conversations")
          .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
          .eq("id", createdGroup.id);
      }
    }

    const allMemberIds = [user.id, ...uniqueMemberIds];
    const hydratedGroup = {
      id: createdGroup.id,
      type: "group",
      name: createdGroup.name,
      avatarUrl,
      createdBy: user.id,
      lastMessageAt: createdGroup.last_message_at,
      participants: allMemberIds.map((id) => usersById.get(id)).filter(Boolean),
      lastMessage: null,
    };

    await cacheNewChatForUsers(allMemberIds, hydratedGroup);

    return NextResponse.json({
      ok: true,
      existing: false,
      conversation: hydratedGroup,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to create conversation.",
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

    const formData = await request.formData();
    const conversationId = String(formData.get("conversationId") || "").trim();
    const nameInput = formData.get("name");
    const avatarFile = formData.get("avatar");

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
      return NextResponse.json(
        { error: "Run 003_create_chat_tables.sql in Supabase SQL Editor first." },
        { status: 503 }
      );
    }

    if (!isMember) {
      return NextResponse.json(
        { error: "Only group members can update group info." },
        { status: 403 }
      );
    }

    const updates = { updated_at: new Date().toISOString() };
    if (typeof nameInput === "string" && nameInput.trim().length >= 2) {
      updates.name = nameInput.trim();
    }

    let avatarUrl = null;
    if (avatarFile && typeof avatarFile === "object" && avatarFile.size > 0) {
      avatarUrl = await uploadGroupAvatar(
        adminSupabase,
        conversationId,
        avatarFile
      );
      if (avatarUrl) {
        updates.avatar_url = avatarUrl;
      }
    }

    const { data: updatedConv, error: updErr } = await adminSupabase
      .from("conversations")
      .update(updates)
      .eq("id", conversationId)
      .eq("type", "group")
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { data: participants } = await adminSupabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId);

    await invalidateUserConversationCaches(
      (participants || []).map((p) => p.user_id)
    );

    return NextResponse.json({
      ok: true,
      conversationId: updatedConv.id,
      name: updatedConv.name,
      avatarUrl: updatedConv.avatar_url,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to update group profile.",
      },
      { status: 500 }
    );
  }
}
