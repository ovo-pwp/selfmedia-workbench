/**
 * 本地服务器：静态文件 + 热点 API
 *   node server.js            默认 7788 端口
 *   局域网内手机用 http://<你的IP>:7788 访问
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// 延迟加载抓取模块：即使它出问题，也不能拖垮服务启动
let _hotMod = null;
function hotMod() {
  if (!_hotMod) _hotMod = require('./scripts/fetch-hot.js');
  return _hotMod;
}

const ROOT = __dirname;
// 云端沙箱必须监听 3000；本地 Windows 默认 7788
const PORT = Number(process.env.PORT) || (process.platform === 'win32' ? 7788 : 3000);
const CACHE_MS = 5 * 60 * 1000; // 热榜缓存 5 分钟

/* 每日内容生成：每天这个点之后自动跑一次（本地/云端一致）
 * 原来这一步靠仓库外手工跑，现在收进服务里，关了浏览器也会更新。
 */
const GEN_HOUR = Number(process.env.GEN_HOUR != null ? process.env.GEN_HOUR : 7);
const GEN_INTERVAL_MS = 30 * 60 * 1000; // 每 30 分钟检查一次

/* 写接口的简易访问码：不设则只允许本机调用，设了就要带 ?key= */
const API_KEY = process.env.API_KEY || '';

/* 限流：同一 IP 每分钟最多 N 次写操作，防止 /api/hot?force=1 被人刷爆源站 */
const RATE = new Map();
const RATE_MAX = 6;
const RATE_WINDOW = 60 * 1000;
function rateLimited(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = RATE.get(ip) || { n: 0, at: now };
  if (now - rec.at > RATE_WINDOW) { rec.n = 0; rec.at = now; }
  rec.n++;
  RATE.set(ip, rec);
  if (RATE.size > 5000) RATE.clear(); // 防内存膨胀
  return rec.n > RATE_MAX;
}

function isLocal(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

/** 写接口鉴权：有 API_KEY 就校验 key；没配就只允许本机 */
function authWrite(req, u) {
  if (API_KEY) {
    const k = u.searchParams.get('key') || req.headers['x-api-key'] || '';
    // 定长比较，避免时序侧信道
    const a = Buffer.from(String(k));
    const b = Buffer.from(API_KEY);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    return true;
  }
  return isLocal(req);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
};

let hotCache = { at: 0, data: null };
let hotInflight = null;

async function getHot(force) {
  const now = Date.now();
  if (!force && hotCache.data && now - hotCache.at < CACHE_MS) return hotCache.data;
  if (hotInflight) return hotInflight;
  hotInflight = (async () => {
    try {
      const d = await hotMod().fetchAll();
      if (d.ok) {
        // 某个平台这次没抓到（限流/网络抖动）→ 用上次落盘的数据补上，别让那个 tab 空掉
        if (d.failed && d.failed.length) {
          try {
            const prev = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'hot.json'), 'utf8'));
            const filled = [];
            for (const k of d.failed) {
              const arr = prev && prev.hot && prev.hot[k];
              if (arr && arr.length) { d.hot[k] = arr; filled.push(k); }
            }
            if (filled.length) {
              d.staleSources = filled;
              d.picks = hotMod().buildPicks(d.hot);
            }
          } catch (e) { /* 没有旧数据就算了 */ }
        }
        hotCache = { at: Date.now(), data: d };
        // 落盘，手机离线 / 静态托管时也有得看
        try {
          fs.writeFileSync(path.join(ROOT, 'data', 'hot.json'), JSON.stringify(d, null, 1), 'utf8');
        } catch (e) { /* 只读环境忽略 */ }
        return d;
      }
    } catch (e) {
      console.error('[hot] 抓取失败:', e.message);
    } finally {
      hotInflight = null;
    }
    // 失败：用磁盘上一次的
    try {
      const raw = fs.readFileSync(path.join(ROOT, 'data', 'hot.json'), 'utf8');
      const j = JSON.parse(raw);
      j.stale = true;
      return j;
    } catch (e) {
      return { ok: false, hot: {}, picks: [], failed: ['all'] };
    }
  })();
  return hotInflight;
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/* ---------------- 每日内容生成 ---------------- */
let genTimer = null;
let genRunning = false;
let genLast = { at: 0, ok: null, error: null };

let _genMod = null;
function genMod() {
  if (!_genMod) _genMod = require('./scripts/gen-daily.js');
  return _genMod;
}

function dailyDate() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'daily.json'), 'utf8')).date;
  } catch (e) { return null; }
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function runGen(reason) {
  if (genRunning) return { ok: false, error: 'already running' };
  genRunning = true;
  const t0 = Date.now();
  try {
    console.log(`[gen] 开始生成（${reason}）`);
    const r = await genMod().run({ quiet: true });
    genLast = { at: Date.now(), ok: r.ok, error: r.error || null };
    if (r.ok) {
      console.log(`[gen] 完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s${r.skipped ? '（当天已生成，跳过）' : ''}`);
    } else {
      console.error('[gen] 失败：' + (r.error || JSON.stringify((r.errors || []).slice(0, 3))));
    }
    return r;
  } catch (e) {
    genLast = { at: Date.now(), ok: false, error: e.message };
    console.error('[gen] 异常：' + e.message);
    return { ok: false, error: e.message };
  } finally {
    genRunning = false;
  }
}

/** 每小时检查一次：今天的稿子还没生成、且已过 GEN_HOUR 点，就跑一次 */
function scheduleGen() {
  if (genTimer) clearInterval(genTimer);
  const tick = () => {
    const h = new Date().getHours();
    if (h < GEN_HOUR) return;
    if (dailyDate() === todayStr()) return;
    runGen('定时任务');
  };
  // 启动后 20 秒先看一次（不用等半小时）
  setTimeout(tick, 20000);
  genTimer = setInterval(tick, GEN_INTERVAL_MS);
  if (genTimer.unref) genTimer.unref();
}

function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  // android/ 是打包源码，里面有签名私钥，绝不能当静态文件发出去
  const lower = p.toLowerCase();
  if (lower.startsWith('/android/') || lower.endsWith('.keystore') || lower.endsWith('/build.sh')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  const file = path.join(ROOT, p);
  // 防目录穿越
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + p);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const isHTML = ext === '.html';
    let ctype = MIME[ext] || 'application/octet-stream';
    // PWA manifest 必须带 manifest+json，浏览器才会认
    if (p.endsWith('manifest.json')) ctype = 'application/manifest+json; charset=utf-8';

    // HTML 里把 __V__ 换成静态资源的真实修改时间，
    // 让每次改代码后 URL 都变，彻底绕开浏览器/SW 的旧缓存（否则新旧文件混用会白屏）
    if (isHTML) {
      fs.readFile(file, 'utf8', (e2, html) => {
        if (e2) { res.writeHead(500); res.end('read error'); return; }
        let ver = '0';
        try {
          // 取所有静态资源里最新的修改时间——改任何一个文件，版本号都会变
          const watch = [
            'assets/css/style.css',
            'assets/js/store.js', 'assets/js/generator.js', 'assets/js/sensitive.js',
            'assets/js/tarot.js', 'assets/js/views.js', 'assets/js/app.js',
          ];
          let max = 0;
          for (const f of watch) {
            try {
              const m = fs.statSync(path.join(ROOT, f)).mtimeMs;
              if (m > max) max = m;
            } catch (x) { /* 文件不存在就跳过 */ }
          }
          ver = String(Math.floor(max));
        } catch (x) { /* 忽略 */ }
        const body = html.replace(/__V__/g, ver);
        res.writeHead(200, {
          'Content-Type': ctype,
          'Cache-Control': 'no-cache',
          'Service-Worker-Allowed': '/',
          'Access-Control-Allow-Origin': '*',
          'Content-Length': Buffer.byteLength(body),
        });
        res.end(body);
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': ctype,
      // no-cache：每次回源验证（没改动就是 304，很快），避免改了代码用户还看旧版
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (u.pathname === '/api/hot') {
    // ?force=1 会真的去抓源站，必须限流，否则谁都能拿来刷我们
    const force = u.searchParams.get('force') === '1';
    if (force && rateLimited(req)) {
      return sendJSON(res, 429, { ok: false, error: '太频繁了，等一分钟再试' });
    }
    const d = await getHot(force);
    return sendJSON(res, 200, d);
  }

  if (u.pathname === '/api/gen') {
    if (!authWrite(req, u)) return sendJSON(res, 403, { ok: false, error: '未授权' });
    if (genRunning) return sendJSON(res, 409, { ok: false, error: '正在生成，别催' });
    const r = await runGen('手动触发');
    return sendJSON(res, r.ok ? 200 : 500, r);
  }

  if (u.pathname === '/api/daily') {
    try {
      const raw = fs.readFileSync(path.join(ROOT, 'data', 'daily.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(raw);
    } catch (e) {
      return sendJSON(res, 404, { error: 'no daily.json' });
    }
  }

  if (u.pathname === '/api/health') {
    return sendJSON(res, 200, {
      ok: true,
      at: new Date().toISOString(),
      hotCachedAt: hotCache.at,
      dailyDate: dailyDate(),
      genHour: GEN_HOUR,
      genLast,
    });
  }

  // 固定下载入口：手机点一下就能装（文件名带中文，用 RFC 5987 传）
  if (u.pathname === '/apk' || u.pathname === '/apk/') {
    const apk = fs.readdirSync(ROOT).find((f) => f.endsWith('.apk'));
    if (!apk) return sendJSON(res, 404, { error: 'no apk' });
    const buf = fs.readFileSync(path.join(ROOT, apk));
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': buf.length,
      'Content-Disposition': "attachment; filename=\"zimeiti.apk\"; filename*=UTF-8''" + encodeURIComponent(apk),
    });
    return res.end(buf);
  }

  serveStatic(req, res, req.url);
});

function lanIPs() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const k of Object.keys(nets)) {
    for (const n of nets[k] || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

function onListening() {
  console.log('[boot] listening on 0.0.0.0:' + PORT + ' pid=' + process.pid);
  const ips = lanIPs();
  console.log('');
  console.log('  🌸  我的小工作台 已启动');
  console.log('  ─────────────────────────────');
  console.log('  电脑打开：  http://localhost:' + PORT);
  ips.forEach((ip) => console.log('  手机打开：  http://' + ip + ':' + PORT + '   ← 手机连同一个 WiFi'));
  console.log('  ─────────────────────────────');
  console.log('  关闭窗口或按 Ctrl+C 停止');
  console.log('');
  // 每天 GEN_HOUR 点后自动更新内容（原来靠仓库外手工跑）
  scheduleGen();
  // 监听成功后再开浏览器，避免打开时还没起来（仅 Windows 本地运行）
  if (!process.env.NO_OPEN && process.platform === 'win32') {
    try {
      require('child_process').exec('start "" "http://localhost:' + PORT + '"');
    } catch (e) { /* 忽略 */ }
  }
  // 预热一次热榜，页面打开时不用等
  getHot(false).then((d) => {
    const n = Object.values(d.hot || {}).reduce((a, b) => a + b.length, 0);
    console.log('  ✓ 热榜已就绪，共 ' + n + ' 条');
  }).catch(() => {});
}

/* 端口被上一轮进程占着时（云端重启服务的常见情况），等待后重试，而不是直接退出 */
let listenAttempt = 0;
let listening = false;
function startListen() {
  server.removeAllListeners('error');
  server.once('error', (e) => {
    console.error('[boot] listen error code=' + e.code + ' attempt=' + listenAttempt);
    if (e.code === 'EADDRINUSE' && listenAttempt < 40) {
      listenAttempt++;
      // 0.5 秒一次、最多 20 秒：旧进程被回收后要立刻抢到端口，等太久会超过平台 60 秒探测上限
      console.log('[boot] 端口被占用，0.5 秒后重试（第 ' + listenAttempt + ' 次）');
      setTimeout(startListen, 500);
    } else {
      console.error('[boot] 放弃：' + e.message);
      process.exit(1);
    }
  });
  server.listen(PORT, '0.0.0.0', () => {
    if (listening) return;
    listening = true;
    onListening();
  });
}
startListen();
