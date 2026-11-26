"use client";

import AvatarBadge from "@/components/chat/AvatarBadge";

export default function NotificationToast({ toast, onOpen, onDismiss }) {
  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#111b21] p-3.5 shadow-xl">
      <div className="flex items-start gap-3">
        <AvatarBadge
          src={toast.avatarUrl}
          name={toast.title}
          isOnline
          showPresence
          size="sm"
        />
        <button
          type="button"
          onClick={() => onOpen(toast.conversationId)}
          className="min-w-0 flex-1 text-left cursor-pointer"
        >
          <p className="text-xs font-semibold text-[#2b8c98] dark:text-[#4eb8c7] truncate">
            {toast.title}
          </p>
          <p className="mt-0.5 text-xs text-neutral-700 dark:text-neutral-200 line-clamp-2">
            {toast.body}
          </p>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
