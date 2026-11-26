const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  sendNotification(payload) {
    ipcRenderer.send("notify", payload);
  },
  onOpenConversation(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, conversationId) => {
      callback(conversationId);
    };
    ipcRenderer.on("open-conversation", listener);
    return () => {
      ipcRenderer.removeListener("open-conversation", listener);
    };
  },
});
