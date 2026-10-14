@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .env (
  echo 還沒設定，先執行安裝設定...
  call "%~dp0安裝.bat"
  if not exist .env exit /b 1
)
echo 隨身筆記啟動中，請保持這個視窗開著。要結束請關閉這個視窗。
start "" http://localhost:3000
node server.js
pause
