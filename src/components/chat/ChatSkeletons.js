"use client";

export function ConversationListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-1.5 px-1 py-1" aria-label="Loading conversations">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center gap-3 rounded-2xl px-3 py-2.5 animate-pulse"
        >
          <div className="h-11 w-11 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3.5 w-28 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-2.5 w-10 rounded-full bg-neutral-200/80 dark:bg-neutral-800/80" />
            </div>
            <div className="h-3 w-44 max-w-full rounded-full bg-neutral-200/75 dark:bg-neutral-800/75" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessagesTimelineSkeleton() {
  const rows = [
    { mine: false, width: "w-52", height: "h-12" },
    { mine: true, width: "w-64", height: "h-14" },
    { mine: false, width: "w-44", height: "h-10" },
    { mine: false, width: "w-60", height: "h-16" },
    { mine: true, width: "w-48", height: "h-11" },
    { mine: true, width: "w-56", height: "h-12" },
  ];

  return (
    <div className="space-y-4 py-2" aria-label="Loading messages">
      {rows.map((item, idx) => (
        <div
          key={idx}
          className={`flex ${item.mine ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`${item.width} ${item.height} max-w-[78%] rounded-2xl animate-pulse ${
              item.mine
                ? "bg-[#2b8c98]/25 dark:bg-[#2b8c98]/20 rounded-br-sm"
                : "bg-white/85 dark:bg-[#202c33]/85 rounded-bl-sm"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

export function WorkspaceShellSkeleton() {
  return (
    <main className="h-screen w-full bg-[#f5f6f8] dark:bg-[#0b141a] flex overflow-hidden">
      {/* Left Sidebar Skeleton */}
      <aside className="w-full md:w-[360px] lg:w-[390px] shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111b21]">
        <div className="px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
          <div className="flex items-center justify-between gap-2 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="space-y-1.5">
                <div className="h-4 w-24 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-3 w-16 rounded-full bg-neutral-200/80 dark:bg-neutral-800/80" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-8 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>

          <div className="h-10 w-full rounded-full bg-neutral-100 dark:bg-[#0b141a] animate-pulse" />

          <div className="flex items-center gap-2 animate-pulse">
            <div className="h-7 w-12 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-7 w-14 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-7 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-7 w-12 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-2">
          <ConversationListSkeleton count={7} />
        </div>
      </aside>

      {/* Right Chat Window Skeleton */}
      <section className="hidden md:flex flex-1 flex-col bg-[#f7f8fa] dark:bg-[#0b141a]">
        <header className="h-[68px] shrink-0 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111b21] flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-3 w-16 rounded-full bg-neutral-200/80 dark:bg-neutral-800/80" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-9 w-9 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-9 w-9 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </header>

        <div className="flex-1 p-6 overflow-hidden">
          <MessagesTimelineSkeleton />
        </div>

        <div className="px-6 py-3 bg-white dark:bg-[#111b21] border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2 animate-pulse">
          <div className="flex-1 h-12 rounded-full bg-neutral-100 dark:bg-[#202c33]" />
          <div className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </section>
    </main>
  );
}
