import { contextBridge, ipcRenderer, clipboard, shell } from "electron";
import { Config } from "../shared/types";
import path from "path";
import fs from "fs";

declare global {
    interface Window {
        toggleSidebar: () => void;
        electronAPI: {
            onSidebarToggle: (callback: () => void) => void;
            [key: string]: any;
        };
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = "app://overlay/index.js";
    document.body.appendChild(script);

    // Inject a small bridge into the page context so page scripts can
    // notify the preload to call `toggle-sidebar` (page context does not
    // have access to the electron `contextBridge` API).
    const bridgeScript = document.createElement('script');
    bridgeScript.type = 'text/javascript';
    bridgeScript.textContent = `
        // API available to page scripts: call this to request the sidebar toggle
        window.__geforceInfinity = {
            toggleSidebar: function() {
                // Preferred: postMessage to the window so preload (isolated) can hear it
                window.postMessage({ source: 'geforce-infinity', action: 'toggle-sidebar' }, '*');
            }
        };

        // Also support dispatching a CustomEvent for older code
        window.__geforceInfinity.dispatchToggle = function() {
            try {
                document.dispatchEvent(new CustomEvent('geforce-infinity', { detail: { action: 'toggle-sidebar' } }));
            } catch (e) {
                // ignore
            }
        };
        
        // Listen for messages from preload (isolated world) so clicks from preload
        // can request the page to run the bridge. Preload will post messages with
        // source 'geforce-infinity-preload'.
        window.addEventListener('message', function(event) {
            try {
                var d = event.data;
                if (d && d.source === 'geforce-infinity-preload' && d.action === 'toggle-sidebar') {
                    // Call the bridge to dispatch the toggle (this will post back
                    // a message that the preload is already listening for).
                    try {
                        window.__geforceInfinity.dispatchToggle();
                    } catch (e) {
                        // ignore
                    }
                }
            } catch (e) {
                // ignore malformed messages
            }
        });
    `;
    document.documentElement.appendChild(bridgeScript);
    console.log('[PRELOAD] injected page bridge (__geforceInfinity)');

    // Inject Infinity button into hamburger menu
    injectInfinityButton();
});

// Listen for messages from the page (postMessage) and forward to main process
window.addEventListener('message', (event: MessageEvent) => {
    try {
        const data = event.data;
        console.log('[PRELOAD] received postMessage from page:', data);
        if (data && data.source === 'geforce-infinity' && data.action === 'toggle-sidebar') {
            console.log('[PRELOAD] forwarding toggle-sidebar to main via ipcRenderer');
            ipcRenderer.send('toggle-sidebar');
        }
    } catch (e) {
        console.error('[PRELOAD] malformed postMessage', e);
    }
});

// Also listen for a CustomEvent dispatched on the document
document.addEventListener('geforce-infinity', (ev: Event) => {
    try {
        const detail = (ev as CustomEvent).detail;
        console.log('[PRELOAD] received CustomEvent from page:', detail);
        if (detail && detail.action === 'toggle-sidebar') {
            console.log('[PRELOAD] forwarding toggle-sidebar (CustomEvent) to main via ipcRenderer');
            ipcRenderer.send('toggle-sidebar');
        }
    } catch (e) {
        console.error('[PRELOAD] malformed CustomEvent', e);
    }
});

function injectInfinityButton() {
    // Function to create the Infinity button
    function createInfinityButton() {
        // Wait for the hamburger menu container to be available
        const menuContainer = document.querySelector('.ng-tns-c2481951853-1');
        if (!menuContainer) {
            // Retry after a short delay if menu not found yet
            setTimeout(createInfinityButton, 500);
            return;
        }

        // Check if button already exists to avoid duplicates
        if (document.querySelector('#infinity-menu-button')) {
            return;
        }

        // Find the Settings button to insert after it
        const settingsButton = Array.from(menuContainer.querySelectorAll('button')).find(btn => 
            btn.textContent && btn.textContent.trim().includes('Settings')
        );

        if (!settingsButton) {
            // Retry if settings button not found yet
            setTimeout(createInfinityButton, 500);
            return;
        }

        // Create the Infinity button with the same structure as existing buttons
        const infinityButton = document.createElement('button');
        infinityButton.id = 'infinity-menu-button';
        infinityButton.setAttribute('mat-button', '');
        infinityButton.setAttribute('nvcursorblockerexempt', '');
        infinityButton.className = 'nv-item-button-container complex-button font-body2 mdc-button mat-mdc-button mat-unthemed mat-mdc-button-base ng-star-inserted';
        infinityButton.setAttribute('mat-ripple-loader-class-name', 'mat-mdc-button-ripple');
        infinityButton.setAttribute('style', 'height: 48px; margin: 0; padding: 0;');

        infinityButton.innerHTML = `
            <span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>
            <span class="mdc-button__label" style="flex-direction: row; box-sizing: border-box; display: flex;">
                <div fxflex="" fxlayout="row" fxlayoutalign="start start" style="flex-direction: row; box-sizing: border-box; display: flex; place-content: flex-start; align-items: flex-start; flex: 1 1 0%;">
                    <div fxlayout="row" fxlayoutalign="center center" fxflex="none" class="nv-item-icon" style="flex-direction: row; box-sizing: border-box; display: flex; place-content: center; align-items: center; flex: 0 0 auto; margin-right: 20px; margin-left: 16px; align-self: center;">
                        <mat-icon role="img" class="mat-icon notranslate mat-icon-no-color" aria-hidden="true" data-mat-icon-type="svg">
                            <svg viewBox="0 0 24 24" fit="" height="100%" width="100%" preserveAspectRatio="xMidYMid meet" focusable="false">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </mat-icon>
                    </div>
                    <div fxflexalign="center" fxlayout="column" fxlayoutalign="start start" fxflex="" class="nv-item-labels" style="flex-direction: column; box-sizing: border-box; display: flex; place-content: flex-start; align-items: flex-start; align-self: center; flex: 1 1 0%;">
                        <span class="font-body2">Infinity</span>
                    </div>
                </div>
            </span>
            <span class="mat-mdc-focus-indicator"></span>
            <span class="mat-mdc-button-touch-target"></span>
            <span class="mat-ripple mat-mdc-button-ripple"></span>
        `;

        // Add click event to trigger sidebar toggle
        infinityButton.addEventListener('click', () => {
            // Post a message into the page (main world). The injected bridge listens
            // for messages with source 'geforce-infinity-preload' and will run the
            // bridge which then posts back a message the preload listens for.
            console.log('[PRELOAD] Infinity button clicked — posting message to page bridge');
            window.postMessage({ source: 'geforce-infinity-preload', action: 'toggle-sidebar' }, '*');
        });

        // Insert the button after the Settings button
        if (settingsButton.parentNode) {
            settingsButton.parentNode.insertBefore(infinityButton, settingsButton.nextSibling);
        }
    }

    // Start the injection process
    createInfinityButton();

    // Also watch for DOM changes in case the menu gets recreated
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if we need to re-inject the button
                const menuContainer = document.querySelector('.ng-tns-c2481951853-1');
                if (menuContainer && !document.querySelector('#infinity-menu-button')) {
                    setTimeout(createInfinityButton, 100);
                }
            }
        });
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

const cssPath = path.join(__dirname, "../assets/tailwind.bundle.css");
let tailwindCss = "";
try {
    tailwindCss = fs.readFileSync(cssPath, "utf-8");
} catch (err) {
    console.error("❌ Failed to read Tailwind CSS:", err);
}

contextBridge.exposeInMainWorld("electronAPI", {
    getTailwindCss: () => tailwindCss,
    toggleSidebar: () => ipcRenderer.send("toggle-sidebar"),
    onSidebarToggle: (callback: () => void) => {
        ipcRenderer.on("sidebar-toggle", (_event, ...args) => {
            callback();
        });
    },
    saveConfig: (config: Partial<Config>) =>
        ipcRenderer.send("save-config", config),
    getCurrentConfig: () => ipcRenderer.invoke("get-config"),
    onConfigLoaded: (callback: (config: Config) => void) => {
        ipcRenderer.on("config-loaded", (event, config) => callback(config));
    },
    reloadGFN: () => {
        ipcRenderer.send("reload-gfn");
    },
    copyToClipboard: (text: string) => clipboard.writeText(text),
    openExternal: (url: string) => shell.openExternal(url),
    checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
    quitAndInstall: () => ipcRenderer.send("quit-and-install"),
    updateAvailable: (
        callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
    ) => ipcRenderer.on("update-available", callback),
    updateDownloaded: (
        callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
    ) => ipcRenderer.on("update-downloaded", callback),
    downloadUpdate: () => ipcRenderer.invoke("download-update"),
});
