const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    platform: process.platform,
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
    },
    saveFile: (content, defaultName) =>
        ipcRenderer.invoke("dialog:saveFile", content, defaultName),
    openFile: () => ipcRenderer.invoke("dialog:openFile"),
});
