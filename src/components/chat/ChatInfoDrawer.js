"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { extractLinksFromText } from "@/lib/chat/links";
import AvatarBadge from "./AvatarBadge";

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatInfoDrawer({
  isOpen,
  onClose,
  conversation,
  messages,
  currentUserId,
  onlineUserIds,
  onSelectMember,
}) {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "media" | "docs" | "links"
  const [lightboxItem, setLightboxItem] = useState(null); // { url, type, name }

  const mediaItems = useMemo(
    () =>
      (messages || []).filter(
        (m) =>
          (m.message_type === "image" || m.message_type === "video") &&
          Boolean(m.media_url)
      ),
    [messages]
  );

  const docItems = useMemo(
    () =>
      (messages || []).filter(
        (m) => m.message_type === "document" && Boolean(m.media_url)
      ),
    [messages]
  );

  const linkItems = useMemo(() => {
    const items = [];
    (messages || []).forEach((m) => {
      if (!m.content) return;
      const links = extractLinksFromText(m.content);
      links.forEach((link, idx) => {
        items.push({
          id: `${m.id}-${idx}`,
          url: link.href,
          label: link.label,
          createdAt: m.created_at,
        });
      });
    });
    return items;
  }, [messages]);

  if (!isOpen || !conversation) return null;

  const isGroup = conversation.type === "group";
  const peer = !isGroup
    ? conversation.participants?.find((p) => p.id !== currentUserId) ||
      conversation.participants?.[0] ||
      null
    : null;

  const title = isGroup
    ? conversation.name || "Group Chat"
    : peer?.displayName || peer?.email || "Contact";

  const avatarUrl = isGroup ? conversation.avatarUrl : peer?.avatarUrl;
  const members = conversation.participants || [];
  const onlineCount = members.filter(
    (m) => m.id === currentUserId || onlineUserIds.has(m.id)
  ).length;
  const peerOnline = peer ? onlineUserIds.has(peer.id) : false;

  const totalSharedCount =
    mediaItems.length + docItems.length + linkItems.length;
  const previewMedia = [...mediaItems].reverse().slice(0, 4);

  return (
    <>
      <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[360px] bg-white dark:bg-[#111b21] border-l border-neutral-200 dark:border-neutral-800 flex flex-col shadow-2xl xl:static xl:shadow-none">
        {/* Header */}
        <div className="h-[68px] shrink-0 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (activeTab !== "overview") {
                setActiveTab("overview");
              } else {
                onClose();
              }
            }}
            aria-label={activeTab !== "overview" ? "Back to info" : "Close info"}
            className="h-9 w-9 rounded-full flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            {activeTab !== "overview" ? "←" : "✕"}
          </button>
          <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
            {activeTab !== "overview"
              ? "Media, links and docs"
              : isGroup
                ? "Group info"
                : "Contact info"}
          </h2>
        </div>

        {activeTab === "overview" ? (
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {/* Hero Profile / Group Avatar & Title */}
            <div className="px-6 py-7 flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => {
                  if (avatarUrl) {
                    setLightboxItem({
                      url: avatarUrl,
                      type: "image",
                      name: title,
                    });
                  }
                }}
                className={`group relative h-24 w-24 rounded-full overflow-hidden flex items-center justify-center ${
                  avatarUrl ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="h-24 w-24 rounded-full overflow-hidden flex items-center justify-center bg-[#2b8c98] text-white text-3xl font-semibold">
                  {avatarUrl ? (
                    <Image
                      unoptimized
                      src={avatarUrl}
                      alt={title}
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                    />
                  ) : isGroup ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-10 w-10"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  ) : (
                    <span>{title.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                {avatarUrl && (
                  <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[11px] font-medium text-white">
                    View photo
                  </span>
                )}
              </button>

              <h3 className="mt-3.5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </h3>

              {isGroup ? (
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Group · {members.length} Members ·{" "}
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {onlineCount} Online
                  </span>
                </p>
              ) : (
                <div className="mt-1 space-y-0.5">
                  {peer?.phone && (
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      {peer.phone}
                    </p>
                  )}
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {peer?.username ? `@${peer.username} · ` : ""}
                    <span
                      className={
                        peerOnline
                          ? "text-emerald-600 dark:text-emerald-400 font-medium"
                          : ""
                      }
                    >
                      {peerOnline ? "Online" : "Offline"}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Contact About & Email (for 1-on-1) */}
            {!isGroup && peer && (
              <div className="px-5 py-4 space-y-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    About
                  </p>
                  <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                    {peer.about || "Hey there! I am using Chatbot."}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    Email
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                    {peer.email}
                  </p>
                </div>
              </div>
            )}

            {/* Media, links and docs showcase */}
            <div className="px-5 py-4 space-y-3">
              <button
                type="button"
                onClick={() => setActiveTab("media")}
                className="w-full flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 text-neutral-500 dark:text-neutral-400"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200 group-hover:text-[#2b8c98] transition">
                    Media, links and docs
                  </span>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {totalSharedCount} ›
                </span>
              </button>

              {previewMedia.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {previewMedia.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setLightboxItem({
                          url: item.media_url,
                          type: item.message_type,
                          name: item.media_name || "Media",
                        })
                      }
                      className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-700/70 hover:opacity-90 transition cursor-pointer"
                    >
                      {item.message_type === "image" ? (
                        <Image
                          unoptimized
                          src={item.media_url}
                          alt={item.media_name || "Shared photo"}
                          width={96}
                          height={96}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="relative h-full w-full bg-black flex items-center justify-center">
                          <video
                            src={item.media_url}
                            muted
                            preload="metadata"
                            className="h-full w-full object-cover opacity-75"
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-white text-sm">
                            ▶
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {docItems.length > 0
                    ? `${docItems.length} document(s) shared. Tap above to view.`
                    : "No media, links, or docs shared yet."}
                </p>
              )}
            </div>

            {/* Group Members List (shown for Group Chats like Agri) */}
            {isGroup && (
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {members.length} members
                </p>
                <div className="space-y-1.5">
                  {members.map((member) => {
                    const isSelf = member.id === currentUserId;
                    const memberOnline = isSelf || onlineUserIds.has(member.id);
                    const isAdmin =
                      member.role === "admin" ||
                      member.id === conversation.createdBy;

                    return (
                      <button
                        key={member.id}
                        type="button"
                        disabled={isSelf}
                        onClick={() => {
                          if (!isSelf && onSelectMember) {
                            onSelectMember(member.id);
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-3 rounded-2xl px-2.5 py-2 text-left transition ${
                          isSelf
                            ? "cursor-default"
                            : "hover:bg-neutral-100 dark:hover:bg-[#1b2730] cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarBadge
                            src={member.avatarUrl}
                            name={member.displayName}
                            isOnline={memberOnline}
                            showPresence
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                {isSelf ? `${member.displayName} (You)` : member.displayName}
                              </p>
                              {isAdmin && (
                                <span className="rounded-full bg-[#2b8c98]/15 px-2 py-0.5 text-[10px] font-medium text-[#2b8c98] dark:text-[#4eb8c7]">
                                  Admin
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                              {member.about ||
                                (member.username
                                  ? `@${member.username}`
                                  : member.email)}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-medium shrink-0 ${
                            memberOnline
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-neutral-400"
                          }`}
                        >
                          {memberOnline ? "Online" : "Offline"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Expanded Media, Docs, & Links Gallery */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-3 border-b border-neutral-200 dark:border-neutral-800 text-xs font-medium">
              {[
                { id: "media", label: `Media (${mediaItems.length})` },
                { id: "docs", label: `Docs (${docItems.length})` },
                { id: "links", label: `Links (${linkItems.length})` },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 text-center border-b-2 transition cursor-pointer ${
                      active
                        ? "border-[#2b8c98] text-[#2b8c98] dark:text-[#4eb8c7]"
                        : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "media" &&
                (mediaItems.length === 0 ? (
                  <p className="py-12 text-center text-xs text-neutral-500">
                    No photos or videos shared in this chat yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {[...mediaItems].reverse().map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setLightboxItem({
                            url: item.media_url,
                            type: item.message_type,
                            name: item.media_name || "Media",
                          })
                        }
                        className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-700/70 hover:opacity-90 transition cursor-pointer"
                      >
                        {item.message_type === "image" ? (
                          <Image
                            unoptimized
                            src={item.media_url}
                            alt={item.media_name || "Photo"}
                            width={140}
                            height={140}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="relative h-full w-full bg-black flex items-center justify-center">
                            <video
                              src={item.media_url}
                              muted
                              preload="metadata"
                              className="h-full w-full object-cover opacity-75"
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-white text-lg">
                              ▶
                            </span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ))}

              {activeTab === "docs" &&
                (docItems.length === 0 ? (
                  <p className="py-12 text-center text-xs text-neutral-500">
                    No documents shared in this chat yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[...docItems].reverse().map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={doc.media_name || "document"}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0b141a] px-3.5 py-2.5 hover:bg-neutral-100 dark:hover:bg-[#1a242b] transition"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {doc.media_name || "Document"}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {formatFileSize(doc.media_size)}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-[#2b8c98]">
                          Download
                        </span>
                      </a>
                    ))}
                  </div>
                ))}

              {activeTab === "links" &&
                (linkItems.length === 0 ? (
                  <p className="py-12 text-center text-xs text-neutral-500">
                    No links shared in this chat yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[...linkItems].reverse().map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0b141a] px-3.5 py-2.5 text-xs text-[#2b8c98] dark:text-[#4eb8c7] underline break-all hover:bg-neutral-100 dark:hover:bg-[#1a242b] transition"
                      >
                        {link.url}
                      </a>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        )}
      </aside>

      {/* Lightbox Modal for Photos & Videos */}
      {lightboxItem && (
        <div
          onClick={() => setLightboxItem(null)}
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl flex flex-col items-center gap-3"
          >
            <div className="w-full flex items-center justify-between text-white">
              <span className="text-sm font-medium truncate">
                {lightboxItem.name}
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={lightboxItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={lightboxItem.name}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25 transition"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {lightboxItem.type === "video" ? (
              <video
                src={lightboxItem.url}
                controls
                autoPlay
                className="max-h-[80vh] w-auto rounded-2xl bg-black"
              />
            ) : (
              <Image
                unoptimized
                src={lightboxItem.url}
                alt={lightboxItem.name || "Preview"}
                width={960}
                height={720}
                className="max-h-[80vh] w-auto rounded-2xl object-contain"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
