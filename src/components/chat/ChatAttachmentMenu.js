"use client";

export default function ChatAttachmentMenu({
  isOpen,
  onPickType,
}) {
  if (!isOpen) return null;

  const options = [
    {
      type: "image",
      label: "Photo",
      badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
      icon: (
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
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      ),
    },
    {
      type: "video",
      label: "Video",
      badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
      icon: (
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
          <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
          <rect x="2" y="6" width="14" height="12" rx="2" />
        </svg>
      ),
    },
    {
      type: "document",
      label: "Document",
      badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
      icon: (
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
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt.type}
          type="button"
          onClick={() => onPickType(opt.type)}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#111b21] px-3.5 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-100 shadow-xs hover:bg-neutral-50 dark:hover:bg-[#1b2730] transition cursor-pointer"
        >
          <span
            className={`h-6 w-6 rounded-full flex items-center justify-center ${opt.badgeClass}`}
          >
            {opt.icon}
          </span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
