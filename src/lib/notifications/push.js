import { sendNotification, setVapidDetails } from "web-push";
import { isChatSchemaPendingError } from "@/lib/supabase/chat";

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    (process.env.USER_EMAIL ? `mailto:${process.env.USER_EMAIL.trim()}` : "mailto:admin@example.com");

  if (!publicKey || !privateKey) {
    return false;
  }

  setVapidDetails(subject, publicKey, privateKey);
  return true;
}

/**
 * Sends Web Push notifications to a list of recipient user IDs.
 */
export async function sendPushToRecipients({
  adminSupabase,
  recipientIds,
  title,
  body,
  icon,
  conversationId,
  url,
}) {
  if (!configureWebPush()) return;
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) return;

  const { data: subscriptions, error: subErr } = await adminSupabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", recipientIds);

  if (subErr) {
    if (!isChatSchemaPendingError(subErr)) {
      console.warn("[push] Failed to load subscriptions:", subErr.message);
    }
    return;
  }

  if (!subscriptions?.length) return;

  const payload = JSON.stringify({
    title,
    body,
    icon: icon || "/favicon.ico",
    conversationId: conversationId || null,
    url: url || (conversationId ? `/?chat=${encodeURIComponent(conversationId)}` : "/"),
  });

  const expiredIds = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          expiredIds.push(sub.id);
        }
      }
    })
  );

  if (expiredIds.length > 0) {
    await adminSupabase
      .from("push_subscriptions")
      .delete()
      .in("id", expiredIds);
  }
}

/**
 * Sends Web Push desktop notifications to all other members of a conversation.
 */
export async function sendPushToConversationMembers({
  adminSupabase,
  conversationId,
  senderId,
  senderName,
  senderAvatar,
  groupName,
  previewText,
}) {
  if (!configureWebPush()) return;

  const { data: participants, error: partErr } = await adminSupabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", senderId);

  if (partErr || !participants?.length) return;

  const recipientIds = participants.map((p) => p.user_id);
  const title = groupName ? `${groupName} · ${senderName}` : senderName;

  await sendPushToRecipients({
    adminSupabase,
    recipientIds,
    title,
    body: previewText,
    icon: senderAvatar || "/favicon.ico",
    conversationId,
    url: `/?chat=${encodeURIComponent(conversationId)}`,
  });
}
