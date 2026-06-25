const { app, BrowserWindow, Menu, shell, dialog, session, ipcMain } = require('electron');
const path = require('path');

// Production POS URL (the deployed Vercel app — auto-updates when we ship features)
const APP_URL = process.env.DC_POS_URL || 'https://diamond-chicken-pos.vercel.app';
const isDev = !app.isPackaged;

let mainWindow = null;
let splashWindow = null;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#0B0B0F',
    webPreferences: { contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0B0B0F',
    title: 'Diamond Chicken POS',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Allow access to printers, USB (thermal printer) etc.
      sandbox: false,
    },
  });

  // Prevent navigation away from our app domain (security)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    const allowed = new URL(APP_URL);
    if (target.origin !== allowed.origin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // External links open in default browser, not inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const target = new URL(url);
    const allowed = new URL(APP_URL);
    if (target.origin !== allowed.origin) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.maximize();
    mainWindow.show();
  });

  // Friendly error if Vercel/internet is down on launch
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (code === -3 || url !== APP_URL) return; // ignore aborted nav / sub-resources
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'No connection',
      message: 'Cannot reach Diamond Chicken POS',
      detail:
        `Failed to load ${APP_URL}\n\n` +
        `Reason: ${desc}\n\n` +
        'Check your internet connection and click Retry.',
      buttons: ['Retry', 'Quit'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) mainWindow.loadURL(APP_URL);
      else app.quit();
    });
  });

  mainWindow.loadURL(APP_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.reload(),
        },
        {
          label: 'Force reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow && mainWindow.webContents.reloadIgnoringCache(),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn', label: 'Zoom in' },
        { role: 'zoomOut', label: 'Zoom out' },
        { role: 'resetZoom', label: 'Reset zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Full screen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open POS in browser',
          click: () => shell.openExternal(APP_URL),
        },
        {
          label: 'About',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Diamond Chicken POS',
              message: 'Diamond Chicken POS',
              detail:
                `Version ${app.getVersion()}\n` +
                `Server: ${APP_URL}\n\n` +
                'Built for Diamond Chicken, Harare, Zimbabwe.',
              buttons: ['Close'],
            }),
        },
      ],
    },
  ];

  if (isDev) {
    template[1].submenu.push({ type: 'separator' }, { role: 'toggleDevTools', label: 'Toggle DevTools' });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Printer IPC handlers
// ---------------------------------------------------------------------------
// The renderer (React app) sends HTML over IPC; we render it in a hidden
// BrowserWindow then call webContents.print(...) which goes through the
// Windows print spooler. This works with ANY installed Windows printer
// (POS-80 thermal, laser, inkjet) without needing Web Serial / WebUSB.

// PowerShell fallback for enumerating Windows printers when Electron's
// getPrintersAsync returns an empty list (this happens on some Windows builds
// or when the print spooler service is slow to respond).
function listPrintersViaPowerShell() {
  return new Promise((resolve) => {
    try {
      const { exec } = require('child_process');
      exec(
        'powershell -NoProfile -Command "Get-Printer | Select-Object Name,DriverName,PrinterStatus | ConvertTo-Json -Compress"',
        { timeout: 5000 },
        (err, stdout) => {
          if (err || !stdout) {
            resolve([]);
            return;
          }
          try {
            let parsed = JSON.parse(stdout.trim());
            if (!Array.isArray(parsed)) parsed = [parsed];
            const list = parsed.map((p) => ({
              name: p.Name,
              displayName: p.Name,
              description: p.DriverName || '',
              status: 0,
              isDefault: false,
            }));
            resolve(list);
          } catch {
            resolve([]);
          }
        }
      );
    } catch {
      resolve([]);
    }
  });
}

ipcMain.handle('printers:list', async () => {
  try {
    if (!mainWindow) return await listPrintersViaPowerShell();
    let printers = [];
    try {
      printers = await mainWindow.webContents.getPrintersAsync();
    } catch (e) {
      console.error('getPrintersAsync threw:', e);
    }
    console.log(`[printers:list] Electron returned ${printers.length} printer(s)`);
    if (!printers || printers.length === 0) {
      const ps = await listPrintersViaPowerShell();
      console.log(`[printers:list] PowerShell returned ${ps.length} printer(s)`);
      return ps;
    }
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description || '',
      status: p.status,
      isDefault: !!p.isDefault,
    }));
  } catch (err) {
    console.error('printers:list failed:', err);
    return [];
  }
});

ipcMain.handle('printers:print', async (_evt, { html, opts }) => {
  const options = opts || {};
  const deviceName = options.deviceName || '';
  // 80mm thermal paper by default (80 000 microns wide). Use a modest default
  // height; the CSS @page rule has `size: 80mm auto` so Electron auto-trims.
  const widthMicrons = options.widthMicrons || 80000;
  const heightMicrons = options.heightMicrons || 200000;

  console.log(`[printers:print] deviceName="${deviceName}" htmlLength=${(html || '').length}`);

  // Create a hidden window dedicated to rendering this single receipt.
  // Width is set to match the paper (80mm ≈ 303px at 96dpi) so CSS mm units
  // compute against the correct viewport — a default 800px window causes
  // Chromium to interpret the layout at the wrong scale before print().
  const mmToPx = (mm) => Math.round(mm * 96 / 25.4);
  const paperMm = Math.round((widthMicrons || 80000) / 1000);
  const printWin = new BrowserWindow({
    width: mmToPx(paperMm),
    height: mmToPx(297),   // A4 height as safe max; @page auto trims
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });

  try {
    // Use base64 data URL: avoids URI-encoding pitfalls with large HTML.
    const dataUrl =
      'data:text/html;charset=utf-8;base64,' +
      Buffer.from(html, 'utf-8').toString('base64');

    // Wait for the page to finish loading AND for layout to settle.
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Load timeout')), 10000);
      printWin.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        // Give the browser a tick to compute layout for @page CSS rules.
        setTimeout(resolve, 200);
      });
      printWin.loadURL(dataUrl).catch((e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });

    const result = await new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: !!deviceName,
          printBackground: true,
          deviceName,
          margins: { marginType: 'none' },
          pageSize: { width: widthMicrons, height: heightMicrons },
          color: false,
          copies: options.copies || 1,
        },
        (success, failureReason) => {
          console.log(`[printers:print] success=${success} reason=${failureReason || ''}`);
          if (success) resolve({ ok: true });
          else resolve({ ok: false, error: failureReason || 'Print cancelled' });
        }
      );
    });

    return result;
  } catch (err) {
    console.error('[printers:print] error:', err);
    return { ok: false, error: err && err.message ? err.message : String(err) };
  } finally {
    try { printWin.destroy(); } catch { /* noop */ }
  }
});

app.on('ready', () => {
  // Persistent storage for cookies, localStorage etc. so users stay logged in.
  // (Electron does this by default — kept here as documentation.)
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    // Allow notifications, clipboard, fullscreen etc. without nagging.
    const allowed = ['notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'media'];
    callback(allowed.includes(permission));
  });

  buildMenu();
  createSplash();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

// Single instance: focus the window if user launches the app twice
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
