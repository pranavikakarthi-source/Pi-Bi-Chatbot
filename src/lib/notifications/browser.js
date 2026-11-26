"use client";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isElectronRuntime() {
  return typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron);
}

export async function registerServiceWorkerAndSubscribe() {
  if (typeof window === "undefined") return null;
  if (isElectronRuntime()) return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    if (!("PushManager" in window) || Notification.permission !== "granted") {
      return registration;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return registration;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    return registration;
  } catch {
    return null;
  }
}

export async function showBrowserDesktopNotification({
  title,
  body,
  icon,
  conversationId,
  onSelectConversation,
}) {
  if (typeof window === "undefined") return;

  // Native Electron main-process desktop notification
  if (isElectronRuntime()) {
    window.electronAPI.sendNotification({
      title,
      body,
      icon,
      conversationId,
    });
    return;
  }

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg && reg.active) {
        await reg.showNotification(title, {
          body,
          icon: icon || "/favicon.ico",
          badge: "/favicon.ico",
          tag: conversationId ? `chat-${conversationId}` : "chat-message",
          renotify: true,
          data: { conversationId, url: "/" },
        });
        return;
      }
    }

    const notification = new window.Notification(title, {
      body,
      icon: icon || "/favicon.ico",
      tag: conversationId ? `chat-${conversationId}` : "chat-message",
    });

    notification.onclick = () => {
      window.focus();
      if (conversationId && onSelectConversation) {
        onSelectConversation(conversationId);
      }
      notification.close();
    };
  } catch {
    // Ignore browser notification errors in restricted contexts.
  }
}

export function playNotificationChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Ignore autoplay restriction errors before user interaction.
  }
}
