"use client";

import Image from "next/image";
import { tokenizeTextWithLinks } from "@/lib/chat/links";
import AvatarBadge from "./AvatarBadge";

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMessageTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function MessageTickIcon({ status }) {
  if (status === "read") {
    return (
      <svg
        viewBox="0 0 20 14"
        fill="none"
        className="h-3.5 w-4 text-[#38bdf8]"
        aria-label="Read"
      >
        <path
          d="M1.5 7.5L4.8 10.8L11.5 3.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.8 7.5L10.1 10.8L17.5 3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === "delivered") {
    return (
      <svg
        viewBox="0 0 20 14"
        fill="none"
        className="h-3.5 w-4 text-white/75"
        aria-label="Delivered"
      >
        <path
          d="M1.5 7.5L4.8 10.8L11.5 3.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.8 7.5L10.1 10.8L17.5 3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Single tick: sent while recipient is offline
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      className="h-3.5 w-3.5 text-white/75"
      aria-label="Sent"
    >
      <path
        d="M2.2 7.5L5.5 10.8L12 3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MessageBubble({
  message,
  isMine,
  isGroup,
  senderProfile,
  receiptStatus = "sent",
  accentColor = "",
}) {
  const senderName =
    senderProfile?.displayName || senderProfile?.email || "User";

  return (
    <div
      className={`flex items-end gap-2 ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      {!isMine && isGroup && (
        <AvatarBadge
          src={senderProfile?.avatarUrl}
          name={senderName}
          size="sm"
        />
      )}

      <div
        className={`max-w-[78%] sm:max-w-[66%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
          isMine
            ? "bg-[#111111] dark:bg-[#005c4b] text-white rounded-br-sm"
            : "bg-white dark:bg-[#202c33] text-[#111111] dark:text-neutral-100 border border-neutral-200/70 dark:border-neutral-700/60 rounded-bl-sm"
        }`}
        style={
          isMine && accentColor ? { backgroundColor: accentColor } : undefined
        }
      >
        {!isMine && isGroup && (
          <p className="mb-1 text-[11px] font-semibold text-[#2b8c98] dark:text-[#4eb8c7]">
            {senderName}
          </p>
        )}

        {message.message_type === "image" && message.media_url && (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl mb-1.5"
          >
            <Image
              unoptimized
              src={message.media_url}
              alt={message.media_name || "Photo"}
              width={360}
              height={260}
              className="max-h-72 w-auto rounded-xl object-cover"
            />
          </a>
        )}

        {message.message_type === "video" && message.media_url && (
          <div className="overflow-hidden rounded-xl mb-1.5">
            <video
              controls
              preload="metadata"
              src={message.media_url}
              className="max-h-72 w-full rounded-xl bg-black"
            />
          </div>
        )}

        {message.message_type === "document" && message.media_url && (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            download={message.media_name || "document"}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1.5 border transition ${
              isMine
                ? "bg-white/10 border-white/15 hover:bg-white/15"
                : "bg-neutral-50 dark:bg-[#111b21] border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-[#18242b]"
            }`}
          >
            <span className="h-9 w-9 shrink-0 rounded-xl bg-[#2b8c98]/20 text-[#2b8c98] dark:text-[#4eb8c7] flex items-center justify-center">
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
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">
                {message.media_name || "Document"}
              </p>
              {message.media_size ? (
                <p
                  className={`text-[11px] ${
                    isMine
                      ? "text-white/70"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {formatFileSize(message.media_size)}
                </p>
              ) : null}
            </div>
            <span className="text-xs font-semibold opacity-80">↓</span>
          </a>
        )}

        {message.content && (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
            {tokenizeTextWithLinks(message.content).map((token, idx) =>
              token.type === "link" ? (
                <a
                  key={idx}
                  href={token.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline underline-offset-2 break-all transition ${
                    isMine
                      ? "text-[#7dd3fc] hover:text-[#bae6fd]"
                      : "text-[#0284c7] dark:text-[#4eb8c7] hover:opacity-80"
                  }`}
                >
                  {token.value}
                </a>
              ) : (
                <span key={idx}>{token.value}</span>
              )
            )}
          </p>
        )}

        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            isMine
              ? "text-white/75"
              : "text-neutral-400 dark:text-neutral-400"
          }`}
        >
          <span>{formatMessageTime(message.created_at)}</span>
          {isMine && <MessageTickIcon status={receiptStatus} />}
        </div>
      </div>
    </div>
  );
}
