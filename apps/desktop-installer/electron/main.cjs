const path = require("node:path");
const { app, BrowserWindow, shell } = require("electron");

const DESKTOP_PORT = 4318;
const DEV_SERVER_URL =
  process.env.ONECLAW_INSTALLER_DESKTOP_DEV_SERVER_URL ??
  process.env.CLAWGUI_DESKTOP_DEV_SERVER_URL;
const isDev = Boolean(DEV_SERVER_URL);

let mainWindow = null;
let backendHandle = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 820,
    minHeight: 600,
    show: false,
    backgroundColor: "#eef1f5",
    title: "OneClaw Installer",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    vibrancy: process.platform === "darwin" ? "sidebar" : undefined,
    visualEffectState: process.platform === "darwin" ? "active" : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    void mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

async function maybeStartBackend() {
  if (process.platform !== "darwin") {
    return;
  }

  const { startMacInstallerServer } = await import("@oneclaw/macos-installer");
  backendHandle = await startMacInstallerServer({ port: DESKTOP_PORT });
}

async function stopBackend() {
  if (!backendHandle) {
    return;
  }

  try {
    await backendHandle.close();
  } finally {
    backendHandle = null;
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void stopBackend();
});

app.whenReady()
  .then(async () => {
    try {
      await maybeStartBackend();
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : String(error)
      );
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    app.exit(1);
  });
