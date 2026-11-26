"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  isElectronRuntime,
  playNotificationChime,
  registerServiceWorkerAndSubscribe,
  showBrowserDesktopNotification,
} from "@/lib/notifications/browser";
import ThemeToggle from "@/components/theme/ThemeToggle";
import SignOutButton from "@/components/auth/SignOutButton";
import AvatarBadge from "./AvatarBadge";
import ChatAttachmentMenu from "./ChatAttachmentMenu";
import ChatInfoDrawer from "./ChatInfoDrawer";
import MessageBubble from "./MessageBubble";
import NewGroupModal from "./NewGroupModal";
import NotificationToast from "./NotificationToast";

const NOTIF_PERMISSION_EVENT = "chatbot-notif-perm-change";

function subscribeNotifPermission(callback) {
  window.addEventListener(NOTIF_PERMISSION_EVENT, callback);
  return () => window.removeEventListener(NOTIF_PERMISSION_EVENT, callback);
}

function getNotifPermissionSnapshot() {
  if (typeof window === "undefined") return "default";
  if (isElectronRuntime()) return "granted";
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function getServerNotifPermission() {
  return "default";
}

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessagePreview(message) {
  if (!message) return "Tap to start chatting";
  if (message.message_type === "image") {
    return message.content ? `📷 ${message.content}` : "📷 Photo";
  }
  if (message.message_type === "video") {
    return message.content ? `🎥 ${message.content}` : "🎥 Video";
  }
  if (message.message_type === "document") {
    return message.media_name
      ? `📄 ${message.media_name}`
      : "📄 Document";
  }
  return message.content || "Message";
}

function getConversationDisplay(conversation, currentUserId) {
  if (!conversation) {
    return { title: "", peer: null, isGroup: false };
  }

  if (conversation.type === "group") {
    return {
      title: conversation.name || "Group Chat",
      peer: null,
      isGroup: true,
    };
  }

  const peer =
    conversation.participants?.find((p) => p.id !== currentUserId) ||
    conversation.participants?.[0] ||
    null;

  return {
    title: peer?.displayName || peer?.email || "Direct Chat",
    peer,
    isGroup: false,
  };
}

export default function ChatWorkspace({
  initialCurrentUser,
  initialUsers,
  initialConversations,
  initialMessages = [],
  initialChatTablesReady,
  initialMigrationSql = "",
}) {
  const [currentUser, setCurrentUser] = useState(initialCurrentUser);
  const [users, setUsers] = useState(initialUsers);
  const [conversations, setConversations] = useState(initialConversations);
  const [chatTablesReady, setChatTablesReady] = useState(
    initialChatTablesReady
  );
  const [sqlCopied, setSqlCopied] = useState(false);

  const [activeConversationId, setActiveConversationId] = useState(
    initialConversations[0]?.id || null
  );
  const [messagesByConv, setMessagesByConv] = useState(() =>
    initialConversations[0]?.id
      ? { [initialConversations[0].id]: initialMessages }
      : {}
  );
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [filterTab, setFilterTab] = useState("all"); // "all" | "direct" | "group"
  const [searchQuery, setSearchQuery] = useState("");
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);

  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [typingByConv, setTypingByConv] = useState({}); // { [convId]: { [userId]: name } }
  const [deliveredConvAt, setDeliveredConvAt] = useState({}); // { [convId]: iso }
  const [readConvAt, setReadConvAt] = useState({}); // { [convId]: iso }
  const [toastNotification, setToastNotification] = useState(null);

  const notifPermission = useSyncExternalStore(
    subscribeNotifPermission,
    getNotifPermissionSnapshot,
    getServerNotifPermission
  );

  const [draftText, setDraftText] = useState("");
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null); // { file, type, previewUrl }
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const globalChannelRef = useRef(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const conversationsRef = useRef(conversations);
  const notifiedMsgIdsRef = useRef(new Set());
  const toastTimerRef = useRef(null);
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimerRef = useRef(null);
  const typingExpireTimersRef = useRef(new Map());

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const usersById = useMemo(() => {
    const map = new Map();
    map.set(currentUser.id, currentUser);
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [currentUser, users]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const activeMessages = useMemo(
    () => (activeConversationId ? messagesByConv[activeConversationId] || [] : []),
    [messagesByConv, activeConversationId]
  );

  const refreshBootstrap = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/bootstrap", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.currentUser) setCurrentUser(data.currentUser);
      if (Array.isArray(data.users)) setUsers(data.users);
      if (Array.isArray(data.conversations)) setConversations(data.conversations);
      if (typeof data.chatTablesReady === "boolean") {
        setChatTablesReady(data.chatTablesReady);
      }
    } catch {
      // Ignore transient refresh failures.
    }
  }, []);

  const acknowledgeReceipt = useCallback(
    async (conversationId, status) => {
      if (!conversationId) return;
      const timestamp = new Date().toISOString();

      globalChannelRef.current?.send({
        type: "broadcast",
        event: "message_receipt",
        payload: {
          conversationId,
          userId: currentUser.id,
          status,
          timestamp,
        },
      });

      if (
        String(conversationId).startsWith("direct:") ||
        String(conversationId).startsWith("group:")
      ) {
        return;
      }

      try {
        await fetch("/api/chat/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, status }),
        });
      } catch {
        // Ignore transient receipt failures.
      }
    },
    [currentUser.id]
  );

  const loadMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
      setIsLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.messages)) {
          setMessagesByConv((prev) => ({
            ...prev,
            [conversationId]: data.messages,
          }));
          if (data.messages.some((m) => m.sender_id !== currentUser.id)) {
            acknowledgeReceipt(conversationId, "read");
          }
        }
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [acknowledgeReceipt, currentUser.id]
  );

  // Auto-scroll to latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, activeConversationId]);

  // Cleanup staged attachment preview URL on unmount/change.
  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment]);

  // Register Service Worker / Electron IPC listener for clicking notifications.
  useEffect(() => {
    registerServiceWorkerAndSubscribe();

    let unsubscribeElectron = () => {};
    if (isElectronRuntime() && window.electronAPI?.onOpenConversation) {
      unsubscribeElectron = window.electronAPI.onOpenConversation(
        (conversationId) => {
          if (conversationId) {
            setActiveConversationId(conversationId);
            loadMessages(conversationId);
          }
        }
      );
    }

    if (!("serviceWorker" in navigator)) {
      return () => {
        unsubscribeElectron();
      };
    }

    function handleSwMessage(event) {
      if (event.data?.type === "OPEN_CONVERSATION" && event.data?.conversationId) {
        const targetId = event.data.conversationId;
        setActiveConversationId(targetId);
        loadMessages(targetId);
      }
    }
    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => {
      unsubscribeElectron();
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, [loadMessages]);

  const notifyIncomingMessage = useCallback(
    (msg) => {
      if (!msg?.id || msg.sender_id === currentUser.id) return;
      if (notifiedMsgIdsRef.current.has(msg.id)) return;
      notifiedMsgIdsRef.current.add(msg.id);

      const isCurrentlyViewing =
        activeConversationIdRef.current === msg.conversation_id &&
        document.visibilityState === "visible" &&
        document.hasFocus();

      if (isCurrentlyViewing) {
        playNotificationChime();
        return;
      }

      const sender = usersById.get(msg.sender_id);
      const conv = conversationsRef.current.find(
        (c) => c.id === msg.conversation_id
      );
      const senderName = sender?.displayName || sender?.email || "New message";
      const title =
        conv?.type === "group" && conv?.name
          ? `${conv.name} · ${senderName}`
          : senderName;
      const body = formatMessagePreview(msg);

      playNotificationChime();

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToastNotification({
        id: msg.id,
        conversationId: msg.conversation_id,
        title,
        body,
        avatarUrl: sender?.avatarUrl || "",
      });
      toastTimerRef.current = window.setTimeout(() => {
        setToastNotification(null);
      }, 5000);

      showBrowserDesktopNotification({
        title,
        body,
        icon: sender?.avatarUrl || "",
        conversationId: msg.conversation_id,
        onSelectConversation: (convId) => {
          setActiveConversationId(convId);
          loadMessages(convId);
        },
      });
    },
    [currentUser.id, loadMessages, usersById]
  );

  async function handleEnableNotifications() {
    if (isElectronRuntime()) {
      window.electronAPI.sendNotification({
        title: "Desktop Notifications Active",
        body: "Electron desktop popup notifications are ready for incoming messages.",
        conversationId: activeConversationIdRef.current,
      });
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      setChatError("Desktop notifications are not supported in this browser.");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      window.dispatchEvent(new Event(NOTIF_PERMISSION_EVENT));

      if (result === "granted") {
        await registerServiceWorkerAndSubscribe();
        setToastNotification({
          id: "notif-enabled",
          conversationId: activeConversationIdRef.current,
          title: "Desktop Notifications Enabled",
          body: "You will now receive popup alerts on this laptop when new messages arrive.",
          avatarUrl: currentUser.avatarUrl,
        });
        if (toastTimerRef.current) {
          window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => {
          setToastNotification(null);
        }, 4000);
      } else if (result === "denied") {
        setChatError(
          "Notifications are blocked by your browser. Click the lock/tune icon near the address bar to allow Notifications."
        );
      }
    } catch {
      setChatError("Unable to enable notifications right now.");
    }
  }

  // Supabase Realtime: presence, typing broadcasts, and postgres changes.
  useEffect(() => {
    const supabase = createClient();

    const presenceChannel = supabase.channel("global-presence", {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const nextOnline = new Set(Object.keys(state));
        setOnlineUserIds(nextOnline);

        const nowIso = new Date().toISOString();
        setConversations((currentConvs) => {
          const updates = {};
          currentConvs.forEach((c) => {
            const hasOnlinePeer = c.participants?.some(
              (p) => p.id !== currentUser.id && nextOnline.has(p.id)
            );
            if (hasOnlinePeer) {
              updates[c.id] = nowIso;
            }
          });
          if (Object.keys(updates).length > 0) {
            setDeliveredConvAt((prev) => ({ ...prev, ...updates }));
          }
          return currentConvs;
        });
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key && !usersById.has(key)) {
          refreshBootstrap();
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: currentUser.id,
            display_name: currentUser.displayName,
            online_at: new Date().toISOString(),
          });
          if (activeConversationIdRef.current) {
            acknowledgeReceipt(activeConversationIdRef.current, "read");
          }
        }
      });

    const eventsChannel = supabase.channel("global-chat-events");
    globalChannelRef.current = eventsChannel;

    eventsChannel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload?.conversationId || payload.userId === currentUser.id) {
          return;
        }

        const key = `${payload.conversationId}:${payload.userId}`;
        const existingTimer = typingExpireTimersRef.current.get(key);
        if (existingTimer) {
          window.clearTimeout(existingTimer);
        }

        setTypingByConv((prev) => {
          const convMap = { ...(prev[payload.conversationId] || {}) };
          if (payload.isTyping) {
            convMap[payload.userId] = payload.name || "Someone";
          } else {
            delete convMap[payload.userId];
          }
          return { ...prev, [payload.conversationId]: convMap };
        });

        if (payload.isTyping) {
          const expireId = window.setTimeout(() => {
            setTypingByConv((prev) => {
              const convMap = { ...(prev[payload.conversationId] || {}) };
              delete convMap[payload.userId];
              return { ...prev, [payload.conversationId]: convMap };
            });
          }, 3000);
          typingExpireTimersRef.current.set(key, expireId);
        }
      })
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload?.message;
        if (!msg?.id || !msg?.conversation_id) return;

        setMessagesByConv((prev) => {
          const existing = prev[msg.conversation_id] || [];
          if (existing.some((item) => item.id === msg.id)) return prev;
          return { ...prev, [msg.conversation_id]: [...existing, msg] };
        });

        setConversations((prev) => {
          const exists = prev.some((c) => c.id === msg.conversation_id);
          if (!exists) {
            if (
              String(msg.conversation_id).startsWith("direct:") &&
              String(msg.conversation_id).includes(currentUser.id)
            ) {
              const sender = usersById.get(msg.sender_id);
              const selfUser = usersById.get(currentUser.id);
              if (sender && selfUser) {
                return [
                  {
                    id: msg.conversation_id,
                    type: "direct",
                    name: null,
                    avatarUrl: null,
                    createdBy: msg.sender_id,
                    lastMessageAt: msg.created_at,
                    participants: [selfUser, sender],
                    lastMessage: msg,
                  },
                  ...prev,
                ];
              }
            }
            refreshBootstrap();
            return prev;
          }
          const updated = prev.map((c) =>
            c.id === msg.conversation_id
              ? { ...c, lastMessage: msg, lastMessageAt: msg.created_at }
              : c
          );
          return updated.sort(
            (a, b) =>
              new Date(b.lastMessageAt).getTime() -
              new Date(a.lastMessageAt).getTime()
          );
        });

        if (msg.sender_id !== currentUser.id) {
          notifyIncomingMessage(msg);
          const isViewing =
            activeConversationIdRef.current === msg.conversation_id &&
            document.visibilityState === "visible";
          acknowledgeReceipt(
            msg.conversation_id,
            isViewing ? "read" : "delivered"
          );
        }
      })
      .on("broadcast", { event: "message_receipt" }, ({ payload }) => {
        if (!payload?.conversationId || payload.userId === currentUser.id) {
          return;
        }
        const ts = payload.timestamp || new Date().toISOString();
        if (payload.status === "read") {
          setReadConvAt((prev) => ({ ...prev, [payload.conversationId]: ts }));
          setDeliveredConvAt((prev) => ({
            ...prev,
            [payload.conversationId]: ts,
          }));
        } else {
          setDeliveredConvAt((prev) => ({
            ...prev,
            [payload.conversationId]: ts,
          }));
        }
      })
      .on("broadcast", { event: "conversation_created" }, () => {
        refreshBootstrap();
      })
      .subscribe();

    const dbChannel = supabase
      .channel("chat-db-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new;
          if (!msg?.id || !msg?.conversation_id) return;

          setMessagesByConv((prev) => {
            const existing = prev[msg.conversation_id] || [];
            if (existing.some((item) => item.id === msg.id)) return prev;
            return { ...prev, [msg.conversation_id]: [...existing, msg] };
          });

          setConversations((prev) => {
            const exists = prev.some((c) => c.id === msg.conversation_id);
            if (!exists) {
              refreshBootstrap();
              return prev;
            }
            return prev
              .map((c) =>
                c.id === msg.conversation_id
                  ? { ...c, lastMessage: msg, lastMessageAt: msg.created_at }
                  : c
              )
              .sort(
                (a, b) =>
                  new Date(b.lastMessageAt).getTime() -
                  new Date(a.lastMessageAt).getTime()
              );
          });

          if (msg.sender_id !== currentUser.id) {
            notifyIncomingMessage(msg);
            const isViewing =
              activeConversationIdRef.current === msg.conversation_id &&
              document.visibilityState === "visible";
            acknowledgeReceipt(
              msg.conversation_id,
              isViewing ? "read" : "delivered"
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const updatedMsg = payload.new;
          if (!updatedMsg?.id || !updatedMsg?.conversation_id) return;

          setMessagesByConv((prev) => {
            const existing = prev[updatedMsg.conversation_id];
            if (!existing) return prev;
            return {
              ...prev,
              [updatedMsg.conversation_id]: existing.map((item) =>
                item.id === updatedMsg.id ? { ...item, ...updatedMsg } : item
              ),
            };
          });

          setConversations((prev) =>
            prev.map((c) =>
              c.id === updatedMsg.conversation_id &&
              c.lastMessage?.id === updatedMsg.id
                ? { ...c, lastMessage: { ...c.lastMessage, ...updatedMsg } }
                : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          refreshBootstrap();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_participants" },
        () => {
          refreshBootstrap();
        }
      )
      .subscribe();

    const expireTimers = typingExpireTimersRef.current;

    return () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      expireTimers.forEach((timerId) => window.clearTimeout(timerId));
      expireTimers.clear();
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(dbChannel);
      globalChannelRef.current = null;
    };
  }, [
    acknowledgeReceipt,
    currentUser.id,
    currentUser.displayName,
    notifyIncomingMessage,
    refreshBootstrap,
    usersById,
  ]);

  function emitTyping(conversationId, isTyping) {
    if (!conversationId || !globalChannelRef.current) return;
    globalChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        conversationId,
        userId: currentUser.id,
        name: currentUser.displayName,
        isTyping,
      },
    });
  }

  function handleDraftChange(value) {
    setDraftText(value);
    if (!activeConversationId) return;

    const now = Date.now();
    if (value.trim().length > 0 && now - lastTypingSentAtRef.current > 1000) {
      lastTypingSentAtRef.current = now;
      emitTyping(activeConversationId, true);
    }

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    if (value.trim().length === 0) {
      emitTyping(activeConversationId, false);
      return;
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      emitTyping(activeConversationId, false);
    }, 2200);
  }

  async function handleStartDirectChat(targetUserId) {
    setChatError("");
    const existing = conversations.find(
      (conv) =>
        conv.type === "direct" &&
        conv.participants.some((p) => p.id === targetUserId)
    );

    if (existing) {
      setActiveConversationId(existing.id);
      if (
        !String(existing.id).startsWith("direct:") &&
        !messagesByConv[existing.id]
      ) {
        await loadMessages(existing.id);
      }
      return;
    }

    const peer = usersById.get(targetUserId);
    const localConvId = `direct:${[currentUser.id, targetUserId].sort().join(":")}`;

    if (!chatTablesReady) {
      const localConv = {
        id: localConvId,
        type: "direct",
        name: null,
        avatarUrl: null,
        createdBy: currentUser.id,
        lastMessageAt: new Date().toISOString(),
        participants: [currentUser, peer].filter(Boolean),
        lastMessage: null,
      };
      setConversations((prev) =>
        prev.some((c) => c.id === localConvId) ? prev : [localConv, ...prev]
      );
      setActiveConversationId(localConvId);
      setMessagesByConv((prev) => ({
        ...prev,
        [localConvId]: prev[localConvId] || [],
      }));
      return;
    }

    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "direct", targetUserId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 503) {
        setChatTablesReady(false);
        const localConv = {
          id: localConvId,
          type: "direct",
          name: null,
          avatarUrl: null,
          createdBy: currentUser.id,
          lastMessageAt: new Date().toISOString(),
          participants: [currentUser, peer].filter(Boolean),
          lastMessage: null,
        };
        setConversations((prev) =>
          prev.some((c) => c.id === localConvId) ? prev : [localConv, ...prev]
        );
        setActiveConversationId(localConvId);
        setMessagesByConv((prev) => ({
          ...prev,
          [localConvId]: prev[localConvId] || [],
        }));
        return;
      }
      setChatError(data?.error || "Unable to open direct chat.");
      return;
    }

    const conv = data.conversation;
    setConversations((prev) => {
      if (prev.some((c) => c.id === conv.id)) return prev;
      return [conv, ...prev];
    });
    setActiveConversationId(conv.id);
    setMessagesByConv((prev) => ({ ...prev, [conv.id]: prev[conv.id] || [] }));

    globalChannelRef.current?.send({
      type: "broadcast",
      event: "conversation_created",
      payload: { conversationId: conv.id },
    });
  }

  async function handleCreateGroup({ name, memberIds }) {
    if (!chatTablesReady) {
      const localGroupId = `group:${Date.now()}`;
      const localConv = {
        id: localGroupId,
        type: "group",
        name,
        avatarUrl: null,
        createdBy: currentUser.id,
        lastMessageAt: new Date().toISOString(),
        participants: [currentUser.id, ...memberIds]
          .map((id) => usersById.get(id))
          .filter(Boolean),
        lastMessage: null,
      };
      setConversations((prev) => [localConv, ...prev]);
      setActiveConversationId(localGroupId);
      setMessagesByConv((prev) => ({ ...prev, [localGroupId]: [] }));
      return;
    }

    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "group", name, memberIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Unable to create group.");
    }

    const conv = data.conversation;
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(conv.id);
    setMessagesByConv((prev) => ({ ...prev, [conv.id]: [] }));

    globalChannelRef.current?.send({
      type: "broadcast",
      event: "conversation_created",
      payload: { conversationId: conv.id },
    });
  }

  function handlePickAttachmentType(type) {
    setIsAttachmentOpen(false);
    if (type === "image") photoInputRef.current?.click();
    else if (type === "video") videoInputRef.current?.click();
    else if (type === "document") docInputRef.current?.click();
  }

  function handleFileSelected(type, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setChatError("Attachment must be 25 MB or smaller.");
      return;
    }

    setChatError("");
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }

    const previewUrl =
      type === "image" || type === "video" ? URL.createObjectURL(file) : "";
    setPendingAttachment({ file, type, previewUrl });
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!activeConversationId || isSending) return;
    if (!draftText.trim() && !pendingAttachment) return;

    setChatError("");
    setIsSending(true);
    emitTyping(activeConversationId, false);

    try {
      let targetConvId = activeConversationId;
      let targetConv = activeConversation;

      // Auto-upgrade any local direct:/group: placeholder conversation to a real DB UUID
      // if the chat tables are now ready in Supabase.
      if (
        String(targetConvId).startsWith("direct:") ||
        String(targetConvId).startsWith("group:")
      ) {
        const upgradePayload =
          targetConv?.type === "group"
            ? {
                type: "group",
                name: targetConv.name,
                memberIds: (targetConv.participants || [])
                  .map((p) => p.id)
                  .filter((id) => id !== currentUser.id),
              }
            : {
                type: "direct",
                targetUserId: targetConv?.participants?.find(
                  (p) => p.id !== currentUser.id
                )?.id,
              };

        if (
          (upgradePayload.type === "direct" && upgradePayload.targetUserId) ||
          (upgradePayload.type === "group" && upgradePayload.memberIds?.length > 0)
        ) {
          const convRes = await fetch("/api/chat/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(upgradePayload),
          });
          if (convRes.ok) {
            const convData = await convRes.json().catch(() => ({}));
            if (convData?.conversation?.id) {
              const upgraded = convData.conversation;
              const oldId = targetConvId;
              targetConvId = upgraded.id;
              targetConv = upgraded;
              setChatTablesReady(true);
              setActiveConversationId(upgraded.id);
              setConversations((prev) =>
                prev.map((c) => (c.id === oldId ? upgraded : c))
              );
              setMessagesByConv((prev) => {
                const oldMsgs = prev[oldId] || [];
                const next = { ...prev };
                delete next[oldId];
                next[upgraded.id] = next[upgraded.id] || oldMsgs;
                return next;
              });
            }
          }
        }
      }

      const recipientOnline = Boolean(
        targetConv?.participants?.some(
          (p) => p.id !== currentUser.id && onlineUserIds.has(p.id)
        )
      );

      const stillLocalOnly =
        String(targetConvId).startsWith("direct:") ||
        String(targetConvId).startsWith("group:");

      let savedMsg;
      if (stillLocalOnly) {
        if (pendingAttachment) {
          setChatError(
            "Run 003_create_chat_tables.sql in Supabase SQL Editor, then click Send again."
          );
          return;
        }
        const nowIso = new Date().toISOString();
        savedMsg = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conversation_id: targetConvId,
          sender_id: currentUser.id,
          content: draftText.trim(),
          message_type: "text",
          media_url: null,
          media_name: null,
          media_size: null,
          media_mime: null,
          delivered_at: recipientOnline ? nowIso : null,
          read_at: null,
          created_at: nowIso,
        };
      } else {
        let res;
        if (pendingAttachment) {
          const formData = new FormData();
          formData.append("conversationId", targetConvId);
          formData.append("messageType", pendingAttachment.type);
          formData.append("recipientOnline", String(recipientOnline));
          if (draftText.trim()) {
            formData.append("content", draftText.trim());
          }
          formData.append("file", pendingAttachment.file);

          res = await fetch("/api/chat/messages", {
            method: "POST",
            body: formData,
          });
        } else {
          res = await fetch("/api/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: targetConvId,
              content: draftText.trim(),
              recipientOnline,
            }),
          });
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setChatError(data?.error || "Failed to send message.");
          return;
        }

        savedMsg = data.message;
        if (recipientOnline && !savedMsg.delivered_at) {
          savedMsg = { ...savedMsg, delivered_at: savedMsg.created_at };
        }
      }
      setDraftText("");
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
      setPendingAttachment(null);

      setMessagesByConv((prev) => {
        const existing = prev[targetConvId] || [];
        if (existing.some((m) => m.id === savedMsg.id)) return prev;
        return { ...prev, [targetConvId]: [...existing, savedMsg] };
      });

      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === targetConvId
              ? { ...c, lastMessage: savedMsg, lastMessageAt: savedMsg.created_at }
              : c
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt).getTime() -
              new Date(a.lastMessageAt).getTime()
          )
      );

      globalChannelRef.current?.send({
        type: "broadcast",
        event: "new_message",
        payload: { message: savedMsg },
      });
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : "Failed to send message."
      );
    } finally {
      setIsSending(false);
    }
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredConversations = conversations.filter((conv) => {
    if (filterTab === "direct" && conv.type !== "direct") return false;
    if (filterTab === "group" && conv.type !== "group") return false;
    if (!normalizedQuery) return true;
    const { title, peer } = getConversationDisplay(conv, currentUser.id);
    return (
      title.toLowerCase().includes(normalizedQuery) ||
      (peer?.email || "").toLowerCase().includes(normalizedQuery) ||
      (peer?.username || "").toLowerCase().includes(normalizedQuery)
    );
  });

  const directPeerIds = useMemo(() => {
    const ids = new Set();
    conversations.forEach((conv) => {
      if (conv.type === "direct") {
        conv.participants?.forEach((p) => {
          if (p.id !== currentUser.id) ids.add(p.id);
        });
      }
    });
    return ids;
  }, [conversations, currentUser.id]);

  const discoverableUsers = users.filter((u) => {
    if (filterTab === "group") return false;
    if (directPeerIds.has(u.id)) return false;
    if (!normalizedQuery) return true;
    return (
      u.displayName.toLowerCase().includes(normalizedQuery) ||
      u.username.toLowerCase().includes(normalizedQuery) ||
      u.email.toLowerCase().includes(normalizedQuery)
    );
  });

  const activeInfo = getConversationDisplay(activeConversation, currentUser.id);
  const activeTypingMap = activeConversationId
    ? typingByConv[activeConversationId] || {}
    : {};
  const activeTypingNames = Object.values(activeTypingMap);

  let activeStatusText = "";
  let activeIsOnline = false;
  if (activeConversation) {
    if (activeTypingNames.length > 0) {
      activeStatusText = activeInfo.isGroup
        ? `${activeTypingNames[0]} is typing...`
        : "Typing...";
    } else if (activeInfo.isGroup) {
      const onlineCount = (activeConversation.participants || []).filter(
        (p) => p.id === currentUser.id || onlineUserIds.has(p.id)
      ).length;
      const totalCount = activeConversation.participants?.length || 1;
      activeStatusText = `${onlineCount} Online · ${totalCount} Members`;
      activeIsOnline = onlineCount > 1;
    } else if (activeInfo.peer) {
      activeIsOnline = onlineUserIds.has(activeInfo.peer.id);
      activeStatusText = activeIsOnline ? "Online" : "Offline";
    }
  }

  function getMessageReceiptStatus(msg) {
    if (!msg || msg.sender_id !== currentUser.id) return "sent";
    const convId = msg.conversation_id;
    const readTs = readConvAt[convId];
    if (
      msg.read_at ||
      (readTs && new Date(readTs).getTime() >= new Date(msg.created_at).getTime())
    ) {
      return "read";
    }
    const delivTs = deliveredConvAt[convId];
    if (
      msg.delivered_at ||
      (delivTs && new Date(delivTs).getTime() >= new Date(msg.created_at).getTime())
    ) {
      return "delivered";
    }
    return "sent";
  }

  return (
    <div className="h-screen w-full bg-[#f5f6f8] dark:bg-[#0b141a] text-[#111111] dark:text-neutral-100 flex overflow-hidden font-sans transition-colors">
      <NotificationToast
        toast={toastNotification}
        onOpen={(convId) => {
          setToastNotification(null);
          if (convId) {
            setActiveConversationId(convId);
            if (
              !String(convId).startsWith("direct:") &&
              !String(convId).startsWith("group:")
            ) {
              loadMessages(convId);
            }
          }
        }}
        onDismiss={() => setToastNotification(null)}
      />

      {/* Left Sidebar: Chats & Registered Users */}
      <aside
        className={`${
          activeConversationId ? "hidden md:flex" : "flex"
        } w-full md:w-[360px] lg:w-[390px] shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111b21]`}
      >
        {/* Top User Bar */}
        <div className="px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/profile-setup" title="Edit Profile">
                <AvatarBadge
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName}
                  isOnline
                  showPresence
                  size="md"
                />
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
                  Messages
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {currentUser.username
                    ? `@${currentUser.username}`
                    : currentUser.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleEnableNotifications}
                title={
                  notifPermission === "granted"
                    ? "Desktop notifications enabled"
                    : "Enable desktop notifications"
                }
                aria-label="Desktop notifications"
                className={`h-8 w-8 rounded-full border flex items-center justify-center transition cursor-pointer ${
                  notifPermission === "granted"
                    ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                    : notifPermission === "denied"
                      ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-500"
                      : "border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(true)}
                title="Create Group Chat"
                className="h-8 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-3 text-xs font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer"
              >
                + Group
              </button>
              <ThemeToggle />
            </div>
          </div>

          {notifPermission === "default" && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#2b8c98]/25 bg-[#2b8c98]/10 px-3 py-2 text-xs">
              <span className="text-neutral-700 dark:text-neutral-200">
                Enable desktop popup alerts for new messages
              </span>
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="shrink-0 rounded-full bg-[#2b8c98] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#237782] transition cursor-pointer"
              >
                Allow
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats or people..."
              className="w-full h-10 rounded-full bg-neutral-100 dark:bg-[#0b141a] border border-transparent focus:border-[#2b8c98] pl-10 pr-4 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none transition"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {[
              { id: "all", label: "All" },
              { id: "direct", label: "Chats" },
              { id: "group", label: "Groups" },
            ].map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer ${
                    active
                      ? "bg-[#111111] dark:bg-[#2b8c98] text-white"
                      : "bg-neutral-100 dark:bg-[#0b141a] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat List + All Registered Users */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {filteredConversations.map((conv) => {
            const { title, peer, isGroup } = getConversationDisplay(
              conv,
              currentUser.id
            );
            const isSelected = conv.id === activeConversationId;
            const peerOnline = peer ? onlineUserIds.has(peer.id) : false;
            const typingNames = Object.values(typingByConv[conv.id] || {});
            const isTyping = typingNames.length > 0;

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => {
                  setActiveConversationId(conv.id);
                  if (
                    !String(conv.id).startsWith("direct:") &&
                    !String(conv.id).startsWith("group:")
                  ) {
                    if (!messagesByConv[conv.id]) {
                      loadMessages(conv.id);
                    } else {
                      acknowledgeReceipt(conv.id, "read");
                    }
                  }
                }}
                className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition cursor-pointer ${
                  isSelected
                    ? "bg-neutral-100 dark:bg-[#202c33]"
                    : "hover:bg-neutral-50 dark:hover:bg-[#1a242b]"
                }`}
              >
                <AvatarBadge
                  src={isGroup ? conv.avatarUrl : peer?.avatarUrl}
                  name={title}
                  isGroup={isGroup}
                  isOnline={peerOnline}
                  showPresence={!isGroup}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {title}
                    </p>
                    <span className="text-[11px] text-neutral-400 shrink-0">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className={`text-xs truncate ${
                        isTyping
                          ? "text-[#2b8c98] dark:text-emerald-400 font-medium"
                          : "text-neutral-500 dark:text-neutral-400"
                      }`}
                    >
                      {isTyping
                        ? isGroup
                          ? `${typingNames[0]} is typing...`
                          : "Typing..."
                        : formatMessagePreview(conv.lastMessage)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {discoverableUsers.length > 0 && (
            <div className="pt-3">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                People ({discoverableUsers.length})
              </p>
              <div className="space-y-1">
                {discoverableUsers.map((person) => {
                  const online = onlineUserIds.has(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleStartDirectChat(person.id)}
                      className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-[#1a242b] transition cursor-pointer"
                    >
                      <AvatarBadge
                        src={person.avatarUrl}
                        name={person.displayName}
                        isOnline={online}
                        showPresence
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {person.displayName}
                          </p>
                          <span
                            className={`text-[11px] font-medium shrink-0 ${
                              online
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-neutral-400"
                            }`}
                          >
                            {online ? "Online" : "Offline"}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {person.username
                            ? `@${person.username}`
                            : person.email}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredConversations.length === 0 &&
            discoverableUsers.length === 0 && (
              <p className="py-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
                No chats or people found yet.
              </p>
            )}
        </div>

        {/* Sidebar Footer */}
        <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
          <Link
            href="/profile-setup"
            aria-label="Settings"
            title="Settings"
            className="h-9 w-9 rounded-full flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-[#2b8c98] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
              aria-hidden="true"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
          <SignOutButton />
        </div>
      </aside>

      {/* Right Pane: Active Chat Window */}
      <section
        className={`${
          activeConversationId ? "flex" : "hidden md:flex"
        } flex-1 flex-col bg-[#f7f8fa] dark:bg-[#0b141a] min-w-0`}
      >
        {!chatTablesReady && (
          <div className="mx-4 mt-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
            <span>
              Run{" "}
              <code className="font-mono font-semibold">
                supabase/migrations/003_create_chat_tables.sql
              </code>{" "}
              in Supabase SQL Editor to save offline messages &amp; media.
            </span>
            {initialMigrationSql && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(initialMigrationSql);
                    setSqlCopied(true);
                    window.setTimeout(() => setSqlCopied(false), 2500);
                  } catch {
                    // Ignore clipboard errors.
                  }
                }}
                className="rounded-full bg-amber-900/15 dark:bg-amber-200/15 px-3 py-1 font-medium hover:bg-amber-900/25 dark:hover:bg-amber-200/25 transition cursor-pointer"
              >
                {sqlCopied ? "SQL Copied ✓" : "Copy SQL"}
              </button>
            )}
          </div>
        )}

        {activeConversation ? (
          <>
            {/* Conversation Header (click title/avatar to view Group / Contact Info & Media) */}
            <header className="h-[68px] shrink-0 px-4 sm:px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111b21] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveConversationId(null)}
                  aria-label="Back to chat list"
                  className="md:hidden h-9 w-9 rounded-full flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  ←
                </button>

                <button
                  type="button"
                  onClick={() => setIsInfoDrawerOpen((prev) => !prev)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-2xl py-1 pr-2 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 transition cursor-pointer"
                  title={
                    activeInfo.isGroup
                      ? "Click to view group members & media"
                      : "Click to view contact info & media"
                  }
                >
                  <AvatarBadge
                    src={
                      activeInfo.isGroup
                        ? activeConversation.avatarUrl
                        : activeInfo.peer?.avatarUrl
                    }
                    name={activeInfo.title}
                    isGroup={activeInfo.isGroup}
                    isOnline={activeIsOnline}
                    showPresence={!activeInfo.isGroup}
                  />

                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {activeInfo.title}
                    </h2>
                    <p
                      className={`text-xs truncate flex items-center gap-1.5 ${
                        activeTypingNames.length > 0
                          ? "text-[#2b8c98] dark:text-emerald-400 font-medium"
                          : activeIsOnline
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-500 dark:text-neutral-400"
                      }`}
                    >
                      {activeTypingNames.length === 0 && activeIsOnline && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                      <span>{activeStatusText}</span>
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsInfoDrawerOpen((prev) => !prev)}
                  aria-label={activeInfo.isGroup ? "Group info" : "Contact info"}
                  title={activeInfo.isGroup ? "Group info & media" : "Contact info & media"}
                  className={`h-9 w-9 rounded-full flex items-center justify-center transition cursor-pointer ${
                    isInfoDrawerOpen
                      ? "bg-[#2b8c98]/15 text-[#2b8c98] dark:text-[#4eb8c7]"
                      : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Messages Timeline */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3">
              {isLoadingMessages && activeMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-500">
                  Loading messages...
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    Say hello to {activeInfo.title}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Send a message, photo, video, or document to start the conversation.
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isMine={msg.sender_id === currentUser.id}
                    isGroup={activeInfo.isGroup}
                    senderProfile={usersById.get(msg.sender_id)}
                    receiptStatus={getMessageReceiptStatus(msg)}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer & Attachments */}
            <div className="px-4 sm:px-6 py-3 bg-white dark:bg-[#111b21] border-t border-neutral-200 dark:border-neutral-800">
              {chatError && (
                <p
                  role="alert"
                  className="mb-2 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3.5 py-2 text-xs text-red-700 dark:text-red-300"
                >
                  {chatError}
                </p>
              )}

              {pendingAttachment && (
                <div className="mb-2.5 flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0b141a] px-3.5 py-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-semibold uppercase text-[#2b8c98]">
                      {pendingAttachment.type}
                    </span>
                    <span className="text-xs text-neutral-700 dark:text-neutral-200 truncate">
                      {pendingAttachment.file.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingAttachment.previewUrl) {
                        URL.revokeObjectURL(pendingAttachment.previewUrl);
                      }
                      setPendingAttachment(null);
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <ChatAttachmentMenu
                isOpen={isAttachmentOpen}
                onPickType={handlePickAttachmentType}
              />

              {/* Hidden file pickers for Photo, Video, Document */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => handleFileSelected("image", e)}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => handleFileSelected("video", e)}
                className="hidden"
              />
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.json"
                onChange={(e) => handleFileSelected("document", e)}
                className="hidden"
              />

              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2"
              >
                <div className="flex-1 flex items-center gap-1.5 h-12 rounded-full bg-neutral-100 dark:bg-[#202c33] border border-neutral-200/80 dark:border-neutral-700 px-3">
                  <button
                    type="button"
                    onClick={() => setIsAttachmentOpen((prev) => !prev)}
                    aria-label="Attach photo, video, or document"
                    title="Attach Photo, Video, or Document"
                    className={`h-8 w-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                      isAttachmentOpen
                        ? "bg-[#2b8c98] text-white"
                        : "text-neutral-500 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePickAttachmentType("image")}
                    aria-label="Send photo"
                    title="Send Photo"
                    className="h-8 w-8 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>

                  <input
                    type="text"
                    value={draftText}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    placeholder="Enter message..."
                    className="flex-1 bg-transparent px-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    isSending || (!draftText.trim() && !pendingAttachment)
                  }
                  aria-label="Send message"
                  className="h-12 w-12 shrink-0 rounded-full bg-[#111111] dark:bg-[#2b8c98] text-white flex items-center justify-center hover:bg-[#262626] dark:hover:bg-[#237782] transition disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 translate-x-[1px]"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="h-16 w-16 rounded-3xl bg-[#2b8c98]/15 text-[#2b8c98] flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Start chatting in real time
            </h2>
            <p className="mt-1.5 max-w-sm text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Select any registered user from the left list for 1-on-1 chat, or
              create a group chat to message multiple people together.
            </p>
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(true)}
              className="mt-5 h-10 rounded-full bg-[#111111] dark:bg-[#2b8c98] px-5 text-xs font-medium text-white hover:bg-[#262626] dark:hover:bg-[#237782] transition cursor-pointer"
            >
              + Create Group Chat
            </button>
          </div>
        )}
      </section>

      <ChatInfoDrawer
        isOpen={isInfoDrawerOpen}
        onClose={() => setIsInfoDrawerOpen(false)}
        conversation={activeConversation}
        messages={activeMessages}
        currentUserId={currentUser.id}
        onlineUserIds={onlineUserIds}
        onSelectMember={(memberId) => {
          setIsInfoDrawerOpen(false);
          handleStartDirectChat(memberId);
        }}
      />

      <NewGroupModal
        isOpen={isGroupModalOpen}
        users={users}
        onlineUserIds={onlineUserIds}
        onClose={() => setIsGroupModalOpen(false)}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
}
