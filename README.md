# 隨身筆記

網頁 App：用瀏覽器聆聽會議或上課，結束後用 Claude 整理成摘要、重點、資料、待辦，並存到 Notion。

## 啟動
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
