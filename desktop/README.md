# Diamond Chicken POS — Desktop App

A native Windows desktop app that wraps the Diamond Chicken POS web system in
its own window. Looks and feels like a real installed application — no browser
address bar, runs in the taskbar, has Start Menu / desktop shortcuts.

The app loads the live, hosted POS at
**https://diamond-chicken-pos.vercel.app**, which means **every feature update
ships automatically** — no re-installing the desktop app when we add features.

> **Note:** This build does **not** include offline support. The PC needs an
> internet connection. (See the project root `OWNER_GUIDE.md` for the full
> system overview.)

---

## Quick start (running from source)

```powershell
cd desktop
npm install
npm start
```

This launches the POS in a desktop window for testing.

---

## Sharing the app — what you actually give to the cashier PC

Pre-built distribution files live in `release/`:

| File | What it is | When to use |
|------|-----------|-------------|
| **`DiamondChickenPOS-Setup-1.0.0.exe`** (77 MB) | **Real Windows installer** — runs a wizard, adds Start Menu + desktop shortcuts, registers in Add/Remove Programs | Recommended for cashier PCs |
| **`DiamondChickenPOS-1.0.0-portable.zip`** (106 MB) | Portable folder — extract anywhere, double-click `Diamond Chicken POS.exe` to run. No install, no admin needed | USB-stick deployment, kiosks, testing |

**To deploy:** copy the `Setup` `.exe` (or the ZIP) to the till PC by USB / WhatsApp / network share / Google Drive. Double-click → done. No additional software needed on the target machine.

> **Note about Windows SmartScreen:** because we don't have a $200/year code-signing certificate, Windows will show *"Unrecognised app"* the first time. Tell the user to click *More info → Run anyway*. After the first run it stops asking.

---

## Rebuilding from source

You need **Node.js 18+** and **NSIS** (`winget install NSIS.NSIS`). Run from this `desktop/` folder:

```powershell
npm install
npm run build
```

This runs three steps in sequence:

1. **`npm run package`** — uses `@electron/packager` to bundle the Electron runtime + your app code into `release/Diamond Chicken POS-win32-x64/`
2. **`npm run zip`** — compresses that folder into `DiamondChickenPOS-1.0.0-portable.zip`
3. **`npm run installer`** — runs NSIS against `installer.nsi` to produce `DiamondChickenPOS-Setup-1.0.0.exe`

You can run any step individually too.

> **Custom icon:** drop a 256×256 `.ico` file at `build/icon.ico` and re-run. Without one, the app uses Electron's default.

---

## What the desktop app gives you over a browser

- ✅ **Looks like a real app** — own taskbar entry, full-screen ready, no URL bar
- ✅ **Single instance** — clicking the shortcut twice focuses the existing window instead of opening a duplicate
- ✅ **Persistent login** — cookies / PIN sessions survive PC restarts (just like a browser, but isolated)
- ✅ **Maximises on launch** — opens full-size automatically
- ✅ **Friendly "no connection" dialog** if internet is down on launch (Retry / Quit)
- ✅ **Custom menu bar** with Reload, Zoom, Full Screen, About
- ✅ **External links open in default browser** (so receipts you share don't take over the app)
- ✅ **Locked navigation** — the window cannot be hijacked to navigate to a non-Diamond-Chicken URL
- ❌ **No offline support** in this build (can be added later — see project notes)

---

## Configuration

The hosted URL is hard-coded to the production Vercel site. To override (e.g.
to point a test PC at a staging URL), launch with an env var:

```powershell
$env:DC_POS_URL = "https://staging-diamond-chicken.vercel.app"
npm start
```

---

## File structure

```
desktop/
├── main.js          # Electron main process (window, menu, security)
├── preload.js       # Bridge between desktop & web (currently minimal)
├── splash.html      # Loading splash shown while site is fetched
├── package.json     # Dependencies + electron-builder config
├── build/
│   └── icon.ico     # App icon (optional — defaults to Electron's icon)
└── release/         # Output folder for the .exe (after `npm run build`)
```

---

## Updating the desktop app itself

Because the desktop app loads the hosted POS, **most updates require no action**
— you just push code to GitHub, Vercel rebuilds, and the next time the cashier
opens the desktop app it gets the new version automatically.

You only need to rebuild and reinstall the desktop `.exe` when you change:
- `main.js`, `preload.js`, `splash.html` (this folder)
- The Electron version
- The branding/icon

---

## Troubleshooting

**"Cannot reach Diamond Chicken POS" on launch**
The PC has no internet, or Vercel is down. Test in a normal browser:
https://diamond-chicken-pos.vercel.app — if that loads, restart the desktop app.

**App won't install / SmartScreen warning**
Windows flags unsigned `.exe` files. Click *More info → Run anyway*. To remove
this warning permanently, sign the binary with a code-signing certificate (not
included; cost ~$200/year).

**Cashier signed out unexpectedly**
The desktop app stores session cookies in
`%APPDATA%\Diamond Chicken POS\` — clearing this folder forces a fresh login.
