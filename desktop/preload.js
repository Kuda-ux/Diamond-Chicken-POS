// Preload script — runs before the page loads.
// Currently empty (no native APIs exposed) but kept as a hook for future
// features like USB thermal printer integration via Node serialport.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('diamond', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
});
