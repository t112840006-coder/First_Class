@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==== 隨身筆記 安裝設定 ====
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo 找不到 Node.js，請先到 https://nodejs.org 下載 LTS 版並安裝，裝好後再雙擊這個檔案。
  pause
  exit /b 1
)
echo 1/3 請貼上 Anthropic API key（到 console.anthropic.com 的 API Keys 建立）
set /p AKEY=API key: 
echo.
echo 2/3 請貼上 Notion integration secret（到 notion.so/my-integrations 建立）
set /p NKEY=Notion secret: 
echo.
echo 3/3 請貼上存放筆記的 Notion 頁面網址（記得先把該頁面的 Connections 加入你的 integration）
set /p NURL=頁面網址或ID: 
for /f %%i in ('powershell -NoProfile -Command "$m=[regex]::Matches($env:NURL.Replace('-',''),'[0-9a-fA-F]{32}'); if($m.Count){$m[$m.Count-1].Value}"') do set NID=%%i
if "%NID%"=="" (
  echo 找不到 32 碼的頁面 ID，請檢查網址後重新執行。
  pause
  exit /b 1
)
(
  echo ANTHROPIC_API_KEY=%AKEY%
  echo NOTION_TOKEN=%NKEY%
  echo NOTION_PARENT_PAGE_ID=%NID%
) > .env
echo.
echo 設定完成！之後雙擊「開始使用.bat」就能開始。
pause
