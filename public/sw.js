self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "New message", body: event.data.text() };
  }

  const title = payload.title || "New message";
  const options = {
    body: payload.body || "You received a new message",
    icon: payload.icon || "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.conversationId
      ? `chat-${payload.conversationId}`
      : "chat-notification",
    renotify: true,
    data: {
      url: payload.url || "/",
      conversationId: payload.conversationId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.conversationId
    ? `/?chat=${encodeURIComponent(data.conversationId)}`
    : data.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.postMessage({
              type: "OPEN_CONVERSATION",
              conversationId: data.conversationId || null,
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
