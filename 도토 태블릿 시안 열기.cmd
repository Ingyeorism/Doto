@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules\vite\bin\vite.js (
  echo 도토 미리보기에 필요한 파일을 준비합니다.
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts\open-ui.mjs --tablet
if errorlevel 1 pause
