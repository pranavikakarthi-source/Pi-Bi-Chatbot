"use client";

import ThemeToggle from "@/components/theme/ThemeToggle";

export default function AuthBoxShell({
  children,
  leftAction = null,
  maxWidthClass = "max-w-[440px]",
}) {
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-[#eef2ff] via-[#f5f7fb] to-[#e6f4f6] dark:from-[#071015] dark:via-[#0b141a] dark:to-[#0f2027] text-[#111111] dark:text-neutral-100 flex items-center justify-center px-4 py-8 font-sans transition-colors">
      <div
        className={`w-full ${maxWidthClass} rounded-[24px] bg-white dark:bg-[#111b21] border border-neutral-200/80 dark:border-neutral-800 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.12)] dark:shadow-black/60 p-6 sm:p-9 transition-colors`}
      >
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            {leftAction || (
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg bg-[#2b8c98] text-white flex items-center justify-center shadow-xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  PingMe
                </span>
              </div>
            )}
          </div>

          <ThemeToggle />
        </div>

        {children}
      </div>
    </main>
  );
}
