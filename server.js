import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');

// 讀取 .env（不依賴套件）
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}

const { ANTHROPIC_API_KEY, NOTION_TOKEN, NOTION_PARENT_PAGE_ID } = process.env;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const PORT = process.env.PORT || 3000;

const PROMPT = `你是會議與課堂筆記助手。根據以下逐字稿（可能有語音辨識錯字，請依上下文合理修正），用繁體中文整理成 Markdown，格式如下：

# （一句話標題）
## 摘要
（3~5 句）
## 重點
- ...
## 名詞 / 資料
- 逐字稿中出現的數字、日期、專有名詞、定義
## 待辦事項
- [ ] ...（沒有就寫「無」）

最前面先輸出一行中繼資料（單獨一行，不要放進程式碼區塊）：
<!--meta {"type":"課堂|會議|其他","topic":"科目或主題，10字內","tags":["3到5個關鍵字"]}-->

只輸出以上內容，不要加任何說明。不要編造逐字稿沒有的內容。`;

async function summarize(transcript) {
  if (!ANTHROPIC_API_KEY) throw new Error('伺服器沒有設定 ANTHROPIC_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: `${PROMPT}\n\n逐字稿：\n${transcript}` }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Anthropic API ${r.status}`);
  return j.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function parseMeta(text) {
  const m = text.match(/<!--meta\s*(\{[\s\S]*?\})\s*-->/);
  let meta = {};
  try { if (m) meta = JSON.parse(m[1]); } catch {}
  return { meta, summary: text.replace(/<!--meta[\s\S]*?-->\s*/, '').trim() };
}

// ---- Markdown -> Notion blocks ----
const rt = s => [{ type: 'text', text: { content: s.slice(0, 2000) } }];
const chunks = (s, n = 1900) => s.match(new RegExp(`[\\s\\S]{1,${n}}`, 'g')) || [];

function mdToBlocks(md) {
  const blocks = [];
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    let m;
    if ((m = line.match(/^#\s+(.*)/))) blocks.push({ type: 'heading_1', heading_1: { rich_text: rt(m[1]) } });
    else if ((m = line.match(/^##\s+(.*)/))) blocks.push({ type: 'heading_2', heading_2: { rich_text: rt(m[1]) } });
    else if ((m = line.match(/^###\s+(.*)/))) blocks.push({ type: 'heading_3', heading_3: { rich_text: rt(m[1]) } });
    else if ((m = line.match(/^\s*[-*]\s+\[( |x)\]\s*(.*)/i)))
      blocks.push({ type: 'to_do', to_do: { rich_text: rt(m[2]), checked: m[1].toLowerCase() === 'x' } });
    else if ((m = line.match(/^\s*[-*]\s+(.*)/)))
      blocks.push({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(m[1]) } });
    else blocks.push({ type: 'paragraph', paragraph: { rich_text: rt(line) } });
  }
  return blocks;
}

async function notion(method, url, body) {
  const r = await fetch(`https://api.notion.com/v1${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || `Notion API ${r.status}`);
  return j;
}

const DB_FILE = path.join(__dirname, '.notion-db');
let dbId = process.env.NOTION_DATABASE_ID || (fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf8').trim() : '');

// 第一次存檔時，自動在 NOTION_PARENT_PAGE_ID 底下建立「筆記知識庫」資料庫
async function ensureDb() {
  if (dbId) return dbId;
  const db = await notion('POST', '/databases', {
    parent: { type: 'page_id', page_id: NOTION_PARENT_PAGE_ID },
    title: rt('筆記知識庫'),
    properties: {
      '名稱': { title: {} },
      '日期': { date: {} },
      '類型': { select: { options: [{ name: '課堂' }, { name: '會議' }, { name: '其他' }] } },
      '主題': { rich_text: {} },
      '標籤': { multi_select: {} },
      '摘要': { rich_text: {} },
    },
  });
  dbId = db.id;
  fs.writeFileSync(DB_FILE, dbId);
  return dbId;
}

async function saveToNotion({ title, summary, transcript, meta = {} }) {
  if (!NOTION_TOKEN || !NOTION_PARENT_PAGE_ID) throw new Error('伺服器沒有設定 NOTION_TOKEN / NOTION_PARENT_PAGE_ID');
  const blocks = [
    ...mdToBlocks(summary).filter((b, i) => !(i === 0 && b.type === 'heading_1')),
    { type: 'divider', divider: {} },
    { type: 'heading_2', heading_2: { rich_text: rt('完整逐字稿') } },
    ...chunks(transcript).map(c => ({ type: 'paragraph', paragraph: { rich_text: rt(c) } })),
  ];
  const overview = (summary.match(/##\s*摘要\s*\n+([\s\S]*?)(?=\n##|$)/) || [])[1]?.trim() || '';
  const type = ['課堂', '會議', '其他'].includes(meta.type) ? meta.type : '其他';
  const page = await notion('POST', '/pages', {
    parent: { database_id: await ensureDb() },
    properties: {
      '名稱': { title: rt(title) },
      '日期': { date: { start: new Date().toISOString() } },
      '類型': { select: { name: type } },
      '主題': { rich_text: rt(meta.topic || '') },
      '標籤': { multi_select: (meta.tags || []).slice(0, 8).map(t => ({ name: String(t).replace(/,/g, ' ').slice(0, 50) })) },
      '摘要': { rich_text: rt(overview) },
    },
    children: blocks.slice(0, 100),
  });
  for (let i = 100; i < blocks.length; i += 100)
    await notion('PATCH', `/blocks/${page.id}/children`, { children: blocks.slice(i, i + 100) });
  return page.url;
}

// ---- HTTP ----
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

function readJson(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { reject(e); } });
  });
}

http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === 'POST' && req.url === '/api/summarize') {
      const { transcript } = await readJson(req);
      if (!transcript?.trim()) return send(400, { error: '沒有逐字稿' });
      return send(200, parseMeta(await summarize(transcript)));
    }
    if (req.method === 'POST' && req.url === '/api/notion') {
      const { title, summary, transcript, meta } = await readJson(req);
      return send(200, { url: await saveToNotion({ title: title || '未命名筆記', summary: summary || '', transcript: transcript || '', meta }) });
    }
    if (req.method === 'GET') {
      const file = path.join(PUBLIC, req.url === '/' ? 'index.html' : path.normalize(req.url.split('?')[0]));
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(405); res.end();
  } catch (e) {
    send(500, { error: e.message });
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
