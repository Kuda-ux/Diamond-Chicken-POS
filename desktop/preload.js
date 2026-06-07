// Preload script — runs before the page loads.
// Exposes a small, sandboxed bridge to native features (printers, etc.) under
// the `window.diamond` global. Renderer-side code calls these like normal
// async functions; the heavy lifting happens in main.js via IPC.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diamond', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,

  // ---- Printer bridge --------------------------------------------------
  printers: {
    // Returns: [{ name, displayName, description, status, isDefault }]
    list: () => ipcRenderer.invoke('printers:list'),

    // Silent print: html is a full HTML document string; opts.deviceName is
    // the Windows printer name (e.g. "POS-80"); opts.width/height in microns.
    // Returns: { ok: boolean, error?: string }
    print: (html, opts) => ipcRenderer.invoke('printers:print', { html, opts }),
  },
});
