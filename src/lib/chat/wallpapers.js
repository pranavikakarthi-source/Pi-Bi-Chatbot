export const WALLPAPER_STORAGE_KEY = "chatbot_chat_wallpaper";

const DOODLE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140" fill="none" stroke="rgba(148,163,184,0.14)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="10"/><path d="M58 18l8 14H50z"/><rect x="92" y="16" width="20" height="14" rx="4"/><path d="M22 68c6-10 18-10 24 0s-18 18-24 0z"/><circle cx="76" cy="70" r="9"/><path d="M106 60l12 12m0-12l-12 12"/><path d="M16 112h22l-6 12H22z"/><path d="M62 108c4-6 12-6 16 0s-4 14-8 14-12-8-8-14z"/><circle cx="114" cy="114" r="10"/></svg>`
);

const SPACE_CARTOON_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none" stroke="rgba(167,139,250,0.22)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="34" cy="34" r="13"/><ellipse cx="34" cy="34" rx="22" ry="6" transform="rotate(-18 34 34)"/><path d="M112 22l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z"/><path d="M40 118c0-14 14-24 14-24s14 10 14 24l-5 8h-18z"/><circle cx="54" cy="113" r="4"/><path d="M116 108a12 12 0 1 0 16 16 9 9 0 0 1-16-16z"/><circle cx="88" cy="72" r="2.5"/><circle cx="22" cy="76" r="2"/><circle cx="136" cy="64" r="2.5"/></svg>`
);

const CANDY_DOODLE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150" fill="none" stroke="rgba(244,114,182,0.22)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 38c0-6 5-10 10-10a11 11 0 0 1 20 2 8 8 0 0 1 2 15H25a7 7 0 0 1-1-7z"/><path d="M108 24l-8 14h10l-6 14 16-18h-10z"/><circle cx="38" cy="108" r="12"/><circle cx="34" cy="105" r="1.5"/><circle cx="42" cy="105" r="1.5"/><path d="M33 112c3 3 7 3 10 0"/><path d="M102 104c-4-6-13-5-15 2-2 8 15 17 15 17s17-9 15-17c-2-7-11-8-15-2z"/></svg>`
);

export const CHAT_WALLPAPERS = [
  {
    id: "default-doodle",
    name: "Default Doodle",
    lightBg: `#efeae2 url("data:image/svg+xml,${DOODLE_SVG}") repeat`,
    darkBg: `#0b141a url("data:image/svg+xml,${DOODLE_SVG}") repeat`,
    lightBubble: "#0f766e",
    darkBubble: "#005c4b",
  },
  {
    id: "naruto-sunset",
    name: "Naruto Sunset",
    lightBg:
      'linear-gradient(rgba(255,247,237,0.22), rgba(255,247,237,0.28)), url("/wallpapers/naruto-sunset.jpg") center / cover no-repeat',
    darkBg:
      'linear-gradient(rgba(11,16,20,0.42), rgba(11,16,20,0.52)), url("/wallpapers/naruto-sunset.jpg") center / cover no-repeat',
    lightBubble: "#c2410c",
    darkBubble: "#9a3412",
  },
  {
    id: "cartoon-squad",
    name: "Cartoon Squad",
    lightBg:
      'linear-gradient(rgba(255,255,255,0.24), rgba(255,255,255,0.28)), url("/wallpapers/cartoon-squad.jpg") center / cover no-repeat',
    darkBg:
      'linear-gradient(rgba(11,16,20,0.52), rgba(11,16,20,0.58)), url("/wallpapers/cartoon-squad.jpg") center / cover no-repeat',
    lightBubble: "#0284c7",
    darkBubble: "#0369a1",
  },
  {
    id: "hogwarts-houses",
    name: "Hogwarts Houses",
    lightBg:
      'linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.26)), url("/wallpapers/hogwarts-houses.jpg") center / cover no-repeat',
    darkBg:
      'linear-gradient(rgba(10,14,18,0.45), rgba(10,14,18,0.55)), url("/wallpapers/hogwarts-houses.jpg") center / cover no-repeat',
    lightBubble: "#7f1d1d",
    darkBubble: "#14532d",
  },
  {
    id: "space-cartoon",
    name: "Space Cartoon",
    lightBg: `#eef2ff url("data:image/svg+xml,${SPACE_CARTOON_SVG}") repeat`,
    darkBg: `#0d1024 url("data:image/svg+xml,${SPACE_CARTOON_SVG}") repeat`,
    lightBubble: "#4f46e5",
    darkBubble: "#4338ca",
  },
  {
    id: "candy-cartoon",
    name: "Candy Doodles",
    lightBg: `#fdf2f8 url("data:image/svg+xml,${CANDY_DOODLE_SVG}") repeat`,
    darkBg: `#1b1019 url("data:image/svg+xml,${CANDY_DOODLE_SVG}") repeat`,
    lightBubble: "#db2777",
    darkBubble: "#9d174d",
  },
  {
    id: "ocean-slate",
    name: "Ocean Slate",
    lightBg: "linear-gradient(135deg, #e8f1fb 0%, #dbeafe 100%)",
    darkBg: "linear-gradient(135deg, #0b1117 0%, #0e1726 100%)",
    lightBubble: "#1d4ed8",
    darkBubble: "#0f4c81",
  },
  {
    id: "lavender-bloom",
    name: "Lavender Silk",
    lightBg:
      "radial-gradient(circle at 20% 20%, #e9d5ff 0%, transparent 45%), radial-gradient(circle at 80% 75%, #c4b5fd 0%, transparent 50%), linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)",
    darkBg:
      "radial-gradient(circle at 20% 20%, rgba(139,92,246,0.38) 0%, transparent 48%), radial-gradient(circle at 80% 75%, rgba(99,102,241,0.32) 0%, transparent 52%), linear-gradient(135deg, #1b1530 0%, #110e1c 100%)",
    lightBubble: "#5b21b6",
    darkBubble: "#4c3599",
  },
  {
    id: "blush-blossom",
    name: "Blush Blossom",
    lightBg:
      "radial-gradient(circle at 75% 25%, #fbcfe8 0%, transparent 48%), radial-gradient(circle at 25% 80%, #fecdd3 0%, transparent 50%), linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
    darkBg:
      "radial-gradient(circle at 75% 25%, rgba(236,72,153,0.32) 0%, transparent 50%), radial-gradient(circle at 25% 80%, rgba(244,63,94,0.28) 0%, transparent 50%), linear-gradient(135deg, #27131d 0%, #150d13 100%)",
    lightBubble: "#9d174d",
    darkBubble: "#7c2d6e",
  },
  {
    id: "golden-amber",
    name: "Golden Silk",
    lightBg:
      "radial-gradient(circle at 30% 30%, #fed7aa 0%, transparent 48%), radial-gradient(circle at 80% 70%, #fde68a 0%, transparent 50%), linear-gradient(135deg, #fffbeb 0%, #ffedd5 100%)",
    darkBg:
      "radial-gradient(circle at 30% 30%, rgba(217,119,6,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(180,83,9,0.28) 0%, transparent 52%), linear-gradient(135deg, #271a0c 0%, #140e08 100%)",
    lightBubble: "#b45309",
    darkBubble: "#8f3b1b",
  },
  {
    id: "coastal-teal",
    name: "Coastal Horizon",
    lightBg:
      "linear-gradient(180deg, #bae6fd 0%, #ccfbf1 55%, #f3e8ff 100%)",
    darkBg:
      "linear-gradient(180deg, #16303d 0%, #154347 55%, #1c242c 100%)",
    lightBubble: "#0f766e",
    darkBubble: "#0c6e5d",
  },
  {
    id: "forest-emerald",
    name: "Midnight Forest",
    lightBg: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
    darkBg:
      "radial-gradient(circle at 25% 25%, rgba(16,185,129,0.22) 0%, transparent 50%), linear-gradient(135deg, #0b1f1a 0%, #07120f 100%)",
    lightBubble: "#047857",
    darkBubble: "#065f46",
  },
  {
    id: "minimal-graphite",
    name: "Minimal Graphite",
    lightBg: "#f3f4f6",
    darkBg: "#121518",
    lightBubble: "#111827",
    darkBubble: "#374151",
  },
];

export function resolveWallpaperConfig(selection, isDark) {
  if (selection && selection.startsWith("custom:")) {
    const dataUrl = selection.slice("custom:".length);
    return {
      id: "custom",
      name: "Custom Photo",
      background: `url("${dataUrl}") center / cover no-repeat`,
      bubbleColor: isDark ? "#005c4b" : "#111111",
    };
  }

  const found =
    CHAT_WALLPAPERS.find((w) => w.id === selection) || CHAT_WALLPAPERS[0];

  return {
    id: found.id,
    name: found.name,
    background: isDark ? found.darkBg : found.lightBg,
    bubbleColor: isDark ? found.darkBubble : found.lightBubble,
  };
}
