# 隨身筆記

網頁 App：用瀏覽器聆聽會議或上課，結束後用 Claude 整理成摘要、重點、資料、待辦，並存到 Notion。

## 啟動（Windows 最簡單）
安裝 Node.js 後，雙擊 `安裝.bat` 照指示貼上三個金鑰，之後每次雙擊 `開始使用.bat` 即可。

## 啟動（手動）
1. 安裝 Node 18+
2. `cp .env.example .env`，填入：
   - `ANTHROPIC_API_KEY`
   - `NOTION_TOKEN`：到 notion.so/my-integrations 建立 integration
   - `NOTION_PARENT_PAGE_ID`：要存放筆記的頁面，並把該頁面分享給這個 integration
3. `npm start`，開啟 http://localhost:3000（用 Chrome / Edge）

## 限制
- 語音辨識用瀏覽器內建 Web Speech API，頁面必須開著、螢幕保持亮著才會聆聽。
- 逐字稿存在瀏覽器 localStorage；下次開啟若有未整理的內容，會提示立即整理。
- 錄音前請取得在場人員同意。

## 知識庫
第一次按「存到 Notion」時，會在 `NOTION_PARENT_PAGE_ID` 那一頁底下自動建立「筆記知識庫」資料庫
（欄位：名稱、日期、類型、主題、標籤、摘要），之後每次錄音都是資料庫的一筆，頁面內有重點與完整逐字稿。
資料庫 ID 會記在 `.notion-db`；想改存到既有資料庫，可在 `.env` 設定 `NOTION_DATABASE_ID`
（該資料庫需有上述欄位）。
