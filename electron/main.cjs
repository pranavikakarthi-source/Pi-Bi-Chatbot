const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  session,
  shell,
  Tray,
} = require("electron");

const APP_USER_MODEL_ID = "com.pingme.desktop";

let mainWindow = null;
let tray = null;
let isQuitting = false;

function normalizeUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return "http://localhost:3000";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function getAppUrl() {
  if (process.env.ELECTRON_START_URL) {
    return normalizeUrl(process.env.ELECTRON_START_URL);
  }
  try {
    const configPath = path.join(__dirname, "config.json");
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (parsed?.appUrl) return normalizeUrl(parsed.appUrl);
    }
  } catch {
    // Fall back to localhost when config cannot be read.
  }
  return "http://localhost:3000";
}

function getIconPath() {
  const pngPath = path.join(__dirname, "icon.png");
  if (fs.existsSync(pngPath)) return pngPath;
  const icoPath = path.join(__dirname, "icon.ico");
  if (fs.existsSync(icoPath)) return icoPath;
  return undefined;
}

function showAndFocusWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.flashFrame(false);
}

function createTray() {
  if (tray) return;
  const iconPath = getIconPath();
  if (!iconPath) return;

  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);
  tray.setToolTip("PingMe");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open PingMe",
      click: () => showAndFocusWindow(),
    },
    { type: "separator" },
    {
      label: "Quit PingMe",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => showAndFocusWindow());
  tray.on("double-click", () => showAndFocusWindow());
}

function createMainWindow() {
  const targetUrl = getAppUrl();

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 820,
    minHeight: 600,
    title: "PingMe",
    icon: getIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(targetUrl);

  mainWindow.webContents.on("did-fail-load", (_event, _code, desc) => {
    const safeUrl = targetUrl.replace(/'/g, "");
    const html = `
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><title>PingMe - Connection</title></head>
        <body style="font-family:Segoe UI,Arial,sans-serif;background:#0b141a;color:#f3f4f6;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;max-width:420px;padding:24px;">
            <h2 style="margin:0 0 8px;">Unable to connect to PingMe</h2>
            <p style="font-size:13px;color:#9ca3af;margin:0 0 18px;">Could not reach ${safeUrl} (${desc}). Start the server or update electron/config.json.</p>
            <button onclick="window.location.href='${safeUrl}'" style="background:#2b8c98;color:#fff;border:none;border-radius:999px;padding:10px 24px;font-size:13px;cursor:pointer;">Retry</button>
          </div>
        </body>
      </html>
    `;
    mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Minimize to System Tray on close so desktop notifications continue arriving.
  mainWindow.on("close", (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("focus", () => {
    mainWindow?.flashFrame(false);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showAndFocusWindow();
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") {
      app.setAppUserModelId(APP_USER_MODEL_ID);
    }

    session.defaultSession.setPermissionRequestHandler(
      (_webContents, permission, callback) => {
        const allowed = new Set([
          "media",
          "mediaKeySystem",
          "audioCapture",
          "videoCapture",
          "notifications",
          "display-capture",
        ]);
        callback(allowed.has(permission));
      }
    );

    if (session.defaultSession.setDisplayMediaRequestHandler) {
      session.defaultSession.setDisplayMediaRequestHandler(
        async (_request, callback) => {
          try {
            const sources = await desktopCapturer.getSources({
              types: ["screen", "window"],
            });
            if (sources.length > 0) {
              callback({ video: sources[0] });
            } else {
              callback({});
            }
          } catch {
            callback({});
          }
        }
      );
    }

    createTray();
    createMainWindow();

    app.on("activate", () => {
      showAndFocusWindow();
    });
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !tray) {
    app.quit();
  }
});

const AVATAR_CACHE_TTL_MS = 15 * 60 * 1000;

async function resolveNotificationIcon(iconSource) {
  const fallback = getIconPath();
  if (!iconSource || typeof iconSource !== "string") return fallback;

  const trimmed = iconSource.trim();
  if (!trimmed || trimmed === "/favicon.ico") return fallback;

  let targetUrl = trimmed;
  if (trimmed.startsWith("/")) {
    try {
      targetUrl = new URL(trimmed, getAppUrl()).toString();
    } catch {
      return fallback;
    }
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    return fallback;
  }

  try {
    const cacheDir = path.join(app.getPath("temp"), "chatbot-notif-avatars");
    fs.mkdirSync(cacheDir, { recursive: true });
    const hash = crypto.createHash("sha256").update(targetUrl).digest("hex");
    const cachedFile = path.join(cacheDir, `${hash}.png`);

    if (fs.existsSync(cachedFile)) {
      const stat = fs.statSync(cachedFile);
      if (Date.now() - stat.mtimeMs < AVATAR_CACHE_TTL_MS) {
        return cachedFile;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return fallback;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) return fallback;

    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return fallback;

    const pngBuffer = image.resize({ width: 128, height: 128 }).toPNG();
    fs.writeFileSync(cachedFile, pngBuffer);
    return cachedFile;
  } catch {
    return fallback;
  }
}

ipcMain.on("notify", async (_event, payload = {}) => {
  if (!Notification.isSupported()) return;

  const title = String(payload.title || "New message");
  const body = String(payload.body || "You received a new message");
  const conversationId = payload.conversationId || null;
  const icon = await resolveNotificationIcon(payload.icon);

  const notification = new Notification({
    title,
    body,
    icon,
    silent: false,
  });

  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }

  notification.on("click", () => {
    showAndFocusWindow();
    if (conversationId && mainWindow) {
      mainWindow.webContents.send("open-conversation", conversationId);
    }
  });

  notification.show();
});
