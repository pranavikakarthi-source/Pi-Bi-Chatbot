const path = require("node:path");
const { app, BrowserWindow, ipcMain, Notification, shell } = require("electron");

const APP_USER_MODEL_ID = "com.chatbot.desktop";
const DEFAULT_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 820,
    minHeight: 600,
    title: "Chatbot",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(DEFAULT_URL);

  // Open external http/https links clicked inside chat in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("focus", () => {
    mainWindow?.flashFrame(false);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("notify", (_event, payload = {}) => {
  if (!Notification.isSupported()) return;

  const title = String(payload.title || "New message");
  const body = String(payload.body || "You received a new message");
  const conversationId = payload.conversationId || null;

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }

  notification.on("click", () => {
    if (!mainWindow) {
      createMainWindow();
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
      mainWindow.flashFrame(false);
      if (conversationId) {
        mainWindow.webContents.send("open-conversation", conversationId);
      }
    }
  });

  notification.show();
});
