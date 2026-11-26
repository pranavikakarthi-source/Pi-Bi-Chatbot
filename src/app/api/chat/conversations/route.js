import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isChatSchemaPendingError,
  listAllChatUsers,
  listUserConversations,
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
        usersById
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

      return NextResponse.json({
        ok: true,
        existing: false,
        conversation: {
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
        },
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

    return NextResponse.json({
      ok: true,
      existing: false,
      conversation: {
        id: createdGroup.id,
        type: "group",
        name: createdGroup.name,
        avatarUrl: createdGroup.avatar_url,
        createdBy: user.id,
        lastMessageAt: createdGroup.last_message_at,
        participants: [user.id, ...uniqueMemberIds]
          .map((id) => usersById.get(id))
          .filter(Boolean),
        lastMessage: null,
      },
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
