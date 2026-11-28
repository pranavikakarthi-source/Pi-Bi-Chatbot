"use client";

import Image from "next/image";

export default function AvatarBadge({
  src,
  name,
  isGroup = false,
  isOnline = false,
  showPresence = false,
  size = "md",
}) {
  const sizeClass =
    size === "xs"
      ? "h-6 w-6 text-[10px]"
      : size === "sm"
        ? "h-9 w-9 text-xs"
        : size === "lg"
          ? "h-12 w-12 text-base"
          : size === "xl"
            ? "h-full w-full text-3xl min-h-[96px] min-w-[96px]"
            : "h-11 w-11 text-sm";

  const initial = String(name || (isGroup ? "G" : "U"))
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="relative shrink-0">
      <div
        className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center font-semibold ${
          src
            ? "bg-neutral-200 dark:bg-neutral-800"
            : isGroup
              ? "bg-[#1f2937] dark:bg-[#2b8c98] text-white"
              : "bg-[#2b8c98] text-white"
        }`}
      >
        {src ? (
          <Image
            unoptimized
            src={src}
            alt={name || "Avatar"}
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
        ) : isGroup ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {showPresence && !isGroup && (
        <span
          title={isOnline ? "Online" : "Offline"}
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-[#111b21] ${
            isOnline ? "bg-emerald-500" : "bg-neutral-400 dark:bg-neutral-600"
          }`}
        />
      )}
    </div>
  );
}
