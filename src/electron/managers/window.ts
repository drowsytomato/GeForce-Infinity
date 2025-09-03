import { app, BrowserWindow } from "electron";
import path from "path";
import { getConfig } from "./config";
import { getIconPath } from "../utils";

export const GFN_WEBSITE = "https://play.geforcenow.com/";

const preloadPath = path.resolve(__dirname, "..", "preload.js");

export function createMainWindow(): BrowserWindow {
    const iconPath = getIconPath();

    const mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        title: "GeForce Infinity",
        icon: iconPath || undefined,
        // fullscreen: true,
        // kiosk: true,
        // fullscreenable: true,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            devTools: !app.isPackaged,
            webSecurity: true,
        },
        autoHideMenuBar: true,
    });

    const config = getConfig();
    if (
        typeof config.userAgent === "string" &&
        config.userAgent.trim() !== ""
    ) {
        mainWindow.webContents.setUserAgent(config.userAgent);
        console.log("[UserAgent] Overridden:", config.userAgent);
    } else {
        console.log("[UserAgent] Using default");
    }

    // Open DevTools in development so console logs are visible to the developer.
    // if (!app.isPackaged) {
    //     mainWindow.webContents.openDevTools({ mode: 'undocked' });
    //     console.log('[MAIN] DevTools opened');
    // }

    mainWindow.loadURL(GFN_WEBSITE);
    return mainWindow;
}
