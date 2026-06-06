; Diamond Chicken POS — NSIS installer script
; Builds a single-file .exe installer that installs the packaged Electron app.

!define APP_NAME       "Diamond Chicken POS"
!define APP_VERSION    "1.0.0"
!define APP_PUBLISHER  "Diamond Chicken"
!define APP_EXE        "Diamond Chicken POS.exe"
!define APP_REGKEY     "Software\Microsoft\Windows\CurrentVersion\Uninstall\DiamondChickenPOS"
!define SOURCE_DIR     "release\Diamond Chicken POS-win32-x64"

Name "${APP_NAME}"
OutFile "release\DiamondChickenPOS-Setup-${APP_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\Diamond Chicken POS"
InstallDirRegKey HKCU "Software\Diamond Chicken POS" "Install_Dir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show
BrandingText "Diamond Chicken POS Installer"

; Modern UI
!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON   "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_FINISHPAGE_RUN          "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT     "Launch Diamond Chicken POS"
!define MUI_FINISHPAGE_LINK         "Open POS in browser"
!define MUI_FINISHPAGE_LINK_LOCATION "https://diamond-chicken-pos.vercel.app"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName"     "${APP_NAME}"
VIAddVersionKey "CompanyName"     "${APP_PUBLISHER}"
VIAddVersionKey "FileDescription" "${APP_NAME} Installer"
VIAddVersionKey "FileVersion"     "${APP_VERSION}"
VIAddVersionKey "ProductVersion"  "${APP_VERSION}"
VIAddVersionKey "LegalCopyright"  "(c) 2026 ${APP_PUBLISHER}"

Section "Install" SecMain
  SetOutPath "$INSTDIR"
  ; Copy ALL files from the packaged folder
  File /r "${SOURCE_DIR}\*.*"

  ; Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\Diamond Chicken POS"
  CreateShortCut  "$SMPROGRAMS\Diamond Chicken POS\Diamond Chicken POS.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut  "$SMPROGRAMS\Diamond Chicken POS\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

  ; Desktop shortcut
  CreateShortCut "$DESKTOP\Diamond Chicken POS.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; Registry: Add/Remove Programs
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayName"     "${APP_NAME}"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayVersion"  "${APP_VERSION}"
  WriteRegStr HKCU "${APP_REGKEY}" "Publisher"       "${APP_PUBLISHER}"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayIcon"     "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${APP_REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${APP_REGKEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoRepair" 1
  WriteRegStr HKCU "Software\Diamond Chicken POS" "Install_Dir" "$INSTDIR"

  ; Approx installed size in KB (260 MB)
  WriteRegDWORD HKCU "${APP_REGKEY}" "EstimatedSize" 266240

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  ; Remove shortcuts
  Delete "$DESKTOP\Diamond Chicken POS.lnk"
  Delete "$SMPROGRAMS\Diamond Chicken POS\Diamond Chicken POS.lnk"
  Delete "$SMPROGRAMS\Diamond Chicken POS\Uninstall.lnk"
  RMDir  "$SMPROGRAMS\Diamond Chicken POS"

  ; Remove files & install dir (recursive)
  RMDir /r "$INSTDIR"

  ; Registry cleanup
  DeleteRegKey HKCU "${APP_REGKEY}"
  DeleteRegKey HKCU "Software\Diamond Chicken POS"
SectionEnd

