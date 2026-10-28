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

function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
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
    res.writeHead(200, {
      'Content-Type': ctype,
      'Cache-Control': isHTML ? 'no-cache' : 'public, max-age=3600',
      'Service-Worker-Allowed': '/',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (u.pathname === '/api/hot') {
    const d = await getHot(u.searchParams.get('force') === '1');
    return sendJSON(res, 200, d);
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
    return sendJSON(res, 200, { ok: true, at: new Date().toISOString(), hotCachedAt: hotCache.at });
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
