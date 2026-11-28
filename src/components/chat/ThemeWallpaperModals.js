"use client";

import { useRef, useState } from "react";
import { CHAT_WALLPAPERS, resolveWallpaperConfig } from "@/lib/chat/wallpapers";
import { useTheme } from "@/components/theme/ThemeProvider";

export function ThemeModal({ isOpen, onClose }) {
  const { theme, setTheme } = useTheme();
  const [selected, setSelected] = useState(theme);

  if (!isOpen) return null;

  const options = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "System default" },
  ];

  function handleConfirm() {
    setTheme(selected);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] rounded-3xl bg-white dark:bg-[#202c33] text-[#111111] dark:text-neutral-100 p-6 shadow-2xl border border-neutral-200/80 dark:border-neutral-700/80"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold tracking-tight mb-5">Theme</h2>

        <div className="space-y-3.5">
          {options.map((opt) => {
            const active = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                className="w-full flex items-center gap-3.5 text-left py-1 cursor-pointer group"
              >
                <span
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${
                    active
                      ? "border-[#22c55e]"
                      : "border-neutral-400 dark:border-neutral-500 group-hover:border-neutral-600 dark:group-hover:border-neutral-300"
                  }`}
                >
                  {active && (
                    <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                  )}
                </span>
                <span className="text-[15px] font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-[#16a34a] dark:text-[#22c55e] hover:bg-neutral-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-full bg-[#22c55e] hover:bg-[#16a34a] px-6 py-2 text-sm font-semibold text-[#0b141a] transition cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export function WallpaperModal({
  isOpen,
  currentWallpaper,
  onSelectWallpaper,
  onClose,
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [draftSelection, setDraftSelection] = useState(
    currentWallpaper || "default-doodle"
  );
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  function handleCustomImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Select a valid PNG/JPG/WebP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Choose an image under 2 MB for chat wallpaper.");
      return;
    }

    setUploadError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDraftSelection(`custom:${reader.result}`);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleApply() {
    onSelectWallpaper(draftSelection);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] rounded-3xl bg-white dark:bg-[#1a242a] text-[#111111] dark:text-neutral-100 p-6 shadow-2xl border border-neutral-200/80 dark:border-neutral-700/80 max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Chat Wallpaper
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Pick a background and chat color theme
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDraftSelection("default-doodle")}
            className="text-xs font-medium text-[#2b8c98] hover:underline cursor-pointer"
          >
            Reset default
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CHAT_WALLPAPERS.map((preset) => {
              const selected = draftSelection === preset.id;
              const previewBg = isDark ? preset.darkBg : preset.lightBg;
              const previewBubble = isDark
                ? preset.darkBubble
                : preset.lightBubble;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDraftSelection(preset.id)}
                  className={`group relative h-28 rounded-2xl overflow-hidden border-2 transition cursor-pointer flex flex-col justify-between p-3 ${
                    selected
                      ? "border-white ring-2 ring-[#22c55e]"
                      : "border-neutral-200 dark:border-white/10 hover:border-neutral-400 dark:hover:border-white/30"
                  }`}
                  style={{ background: previewBg }}
                >
                  {/* Mini incoming/outgoing bubble preview matching WhatsApp theme picker */}
                  <div className="w-full flex flex-col gap-1.5 mt-1">
                    <span
                      className={`h-4 w-12 rounded-lg rounded-bl-xs self-start ${
                        isDark ? "bg-[#202c33]" : "bg-white/95 shadow-2xs"
                      }`}
                    />
                    <span
                      className="h-4 w-14 rounded-lg rounded-br-xs self-end shadow-2xs"
                      style={{ backgroundColor: previewBubble }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate ${
                        isDark
                          ? "bg-black/45 text-neutral-200"
                          : "bg-white/80 text-neutral-800"
                      }`}
                    >
                      {preset.name}
                    </span>
                    {selected && (
                      <span className="h-5 w-5 rounded-full bg-white text-[#111111] flex items-center justify-center shadow text-xs font-bold shrink-0">
                        ✓
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Custom Photo Tile */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCustomImageChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`relative h-28 rounded-2xl overflow-hidden border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center gap-1.5 p-3 ${
                draftSelection.startsWith("custom:")
                  ? "border-[#22c55e]"
                  : "border-neutral-300 dark:border-neutral-700 hover:border-[#2b8c98]"
              }`}
              style={
                draftSelection.startsWith("custom:")
                  ? {
                      background: resolveWallpaperConfig(draftSelection, isDark)
                        .background,
                    }
                  : undefined
              }
            >
              <span className="rounded-full bg-black/55 text-white px-2.5 py-1 text-[11px] font-medium">
                + Upload Photo
              </span>
              {draftSelection.startsWith("custom:") && (
                <span className="h-5 w-5 rounded-full bg-white text-[#111111] flex items-center justify-center shadow text-xs font-bold">
                  ✓
                </span>
              )}
            </button>
          </div>

          {uploadError && (
            <p className="mt-2.5 text-xs text-red-500 dark:text-red-400">
              {uploadError}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-3 pt-2 border-t border-neutral-200/70 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-[#16a34a] dark:text-[#22c55e] hover:bg-neutral-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-full bg-[#22c55e] hover:bg-[#16a34a] px-6 py-2 text-sm font-semibold text-[#0b141a] transition cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
