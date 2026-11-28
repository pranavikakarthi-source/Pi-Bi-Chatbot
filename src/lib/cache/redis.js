const MEMORY_CACHE_KEY = "__pingmeServerCache";

function getMemoryStore() {
  if (!globalThis[MEMORY_CACHE_KEY]) {
    globalThis[MEMORY_CACHE_KEY] = new Map();
  }
  return globalThis[MEMORY_CACHE_KEY];
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

async function runUpstashCommand(args) {
  const cfg = getUpstashConfig();
  if (!cfg) return null;

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result ?? null;
  } catch {
    return null;
  }
}

export function isRedisConfigured() {
  return Boolean(getUpstashConfig());
}

export async function getCachedJson(key) {
  const upstashResult = await runUpstashCommand(["GET", key]);
  if (typeof upstashResult === "string") {
    try {
      return JSON.parse(upstashResult);
    } catch {
      return null;
    }
  }

  const store = getMemoryStore();
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export async function setCachedJson(key, value, ttlSeconds = 60) {
  const serialized = JSON.stringify(value);
  if (getUpstashConfig()) {
    await runUpstashCommand([
      "SET",
      key,
      serialized,
      "EX",
      String(Math.max(1, ttlSeconds)),
    ]);
  }

  const store = getMemoryStore();
  store.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
  });

  // Bound in-memory fallback store to prevent unbounded growth.
  if (store.size > 500) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
}

export async function deleteCachedKey(key) {
  if (getUpstashConfig()) {
    await runUpstashCommand(["DEL", key]);
  }
  getMemoryStore().delete(key);
}

export function getConvsPageCacheKey(userId, offset, limit) {
  return `pingme:convs:${userId}:offset:${offset}:limit:${limit}`;
}

export function getNewChatsCacheKey(userId) {
  return `pingme:new_chats:${userId}`;
}

export async function invalidateUserConversationCaches(userIds = []) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const offsetsToClear = [0, 10, 20, 30, 40, 50];

  await Promise.all(
    uniqueIds.flatMap((uid) =>
      offsetsToClear.map((offset) =>
        deleteCachedKey(getConvsPageCacheKey(uid, offset, 10))
      )
    )
  );
}

export async function cacheNewChatForUsers(userIds = [], conversation) {
  if (!conversation?.id) return;
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  await Promise.all(
    uniqueIds.map(async (uid) => {
      const key = getNewChatsCacheKey(uid);
      const existing = (await getCachedJson(key)) || [];
      const updated = [
        conversation,
        ...existing.filter((item) => item?.id !== conversation.id),
      ].slice(0, 20);
      await setCachedJson(key, updated, 3600);
    })
  );

  await invalidateUserConversationCaches(uniqueIds);
}

export async function getCachedNewChats(userId) {
  if (!userId) return [];
  const list = await getCachedJson(getNewChatsCacheKey(userId));
  return Array.isArray(list) ? list : [];
}
