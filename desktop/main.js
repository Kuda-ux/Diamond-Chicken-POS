const { app, BrowserWindow, Menu, shell, dialog, session } = require('electron');
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
