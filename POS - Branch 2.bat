@echo off
REM Diamond Chicken POS - Branch 2 launcher
REM Points the desktop app at the branch-2 deployment instead of branch 1.
set DC_POS_URL=https://diamond-chicken-pos-2.vercel.app
cd /d "%~dp0desktop"
call node_modules\.bin\electron.cmd .
