const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

ipcMain.handle("dialog:saveFile", async (event, content, defaultName) => {
    const result = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: "All Files", extensions: ["*"] }],
    });
    if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, "utf-8");
        return true;
    }
    return false;
});

ipcMain.handle("dialog:openFile", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "All Files", extensions: ["*"] }],
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return fs.readFileSync(result.filePaths[0], "utf-8");
    }
    return null;
});

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 736,
        minWidth: 800,
        minHeight: 736,
        webPreferences: {
            devTools: !!process.env.ELECTRON_DEV,
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.cjs"),
        },
    });

    if (process.env.ELECTRON_DEV) {
        win.loadURL("http://127.0.0.1:5173");
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    }
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
