/**
 * daily.json 校验器（结构 + 内容 + 合规 + AI 味）
 *
 * 两层入口：
 *   validate(raw)        —— 组装期的兜底校验（可能含未加工选题）
 *   validateShipped(obj) —— 出厂校验：只放行带完整成稿的选题，gen-daily 写盘前必须过这一关
 *
 * 设计原则：
 *   1) error 阻断写盘，warn 只报告。宁可当天没更新，也不能把坏稿推上线。
 *   2) AI 味规则参考 Wikipedia《Signs of AI writing》(blader/humanizer 的 26 条)，只用来打 warn，
 *      因为口语化中文里「不是…而是…」也可能是自然表达，不能一刀切。
 */
'use strict';

const Sensitive = require('../assets/js/sensitive.js');

const PLATFORMS = ['gongzhonghao', 'xiaohongshu', 'shipinhao', 'douyin'];
const MAX_TITLES = 6;
const MIN_TITLES = 3;

/* 平台正文的合理字数区间（口播稿含标记，区间放宽）
 * 观察评论类要点是「判断」而不是「动作清单」，天然比方法论短，单独给一套下限。
 */
const LEN_RANGE = {
  gongzhonghao: [420, 1600],
  xiaohongshu: [220, 900],
  shipinhao: [180, 1200],
  douyin: [180, 1200],
};
const LEN_RANGE_COMMENT = {
  gongzhonghao: [300, 1600],
  xiaohongshu: [180, 900],
  shipinhao: [150, 1200],
  douyin: [150, 1200],
};

/* 合规严重度分级：按平台真实执法力度，不是按广告法条文
 *   BLOCK —— 直接限流/封号/被判违规，必须改完才能上线
 *   WARN  —— 看语境，编辑类内容里常常正常，只提示人工过一眼
 */
const BLOCK_CATS = ['虚假收益', '站外引流', '诱导互动', '权威背书'];

/* ---------------- AI 味规则（只打 warn） ---------------- */
const AI_TONE = [
  { re: /不是[^。！？]{1,14}而是[^。！？]{1,14}/, name: '对举句「不是…而是…」', tip: '一段里最多留一次，多了就是模板腔' },
  { re: /(总而言之|综上所述|总的来说|需要注意的是|值得一提的是|首先[，,]|其次[，,]|最后[，,])/, name: '书面连接词', tip: '口语稿里删掉，句子直接起' },
  { re: /(在这个[^。]{0,8}(时代|社会)|随着[^。]{1,10}的发展|不可否认|众所周知|显而易见)/, name: '空洞宏大开场', tip: '从句子里挖具体场景代替' },
  { re: /(让我们|我们可以|你会发现|你是否曾经|试想一下|不妨)/, name: '宣告式引导', tip: '直接说事，别拉读者' },
  { re: /(至关重要|意义深远|深刻影响|具有重要|发挥了重要作用|起到了关键作用)/, name: '空转评价词', tip: '换成具体发生了什么' },
  { re: /(干货满满|建议收藏(?:起来)?(?:慢慢看)?|一定要看到最后|码住|狠狠[^。]{0,4}了)/, name: '套路互动套话', tip: '一句就够，重复就是 AI 味' },
  { re: /(赋能|闭环|抓手|底层逻辑|颗粒度|组合拳|生态位)/, name: '互联网黑话', tip: '普通人不说这些词' },
  { re: /(?:[^。！？\n]{8,})[；;](?:[^。！？\n]{8,})[；;](?:[^。！？\n]{8,})/, name: '三项并列排比', tip: '三个分句并列是模型最爱，砍成两项或拆成两句' },
];

/* 一份成稿里允许出现的最高重复率（同一句出现两次以上就算复读） */
function detectAI(text) {
  const hits = [];
  for (const r of AI_TONE) {
    const m = String(text).match(r.re);
    if (m) hits.push({ name: r.name, sample: m[0].slice(0, 24), tip: r.tip });
  }
  return hits;
}

/* ---------------- 正文结构：数出「讲了 N 条」 ---------------- */
const CN_NUM = '一二三四五六七八九十';

function countItems(body, platform) {
  const src = String(body || '');
  if (!src) return 0;
  if (platform === 'xiaohongshu') {
    // 1️⃣ 2️⃣ 或 1. 2. 或 ① ②
    const emoji = (src.match(/^\s*[1-9]\uFE0F?\u20E3/gm) || []).length;
    const dot = (src.match(/^\s*[1-9][.、)]/gm) || []).length;
    const circ = (src.match(/[\u2460-\u2468]/g) || []).length;
    return Math.max(emoji, dot, circ);
  }
  if (platform === 'gongzhonghao') {
    // 一、二、三、
    return (src.match(new RegExp('^[' + CN_NUM + ']、', 'gm')) || []).length;
  }
  // 口播稿：1、2、 或 一、二、
  const ar = (src.match(/^\s*[1-9]、/gm) || []).length;
  const cn = (src.match(new RegExp('^[' + CN_NUM + ']、', 'gm')) || []).length;
  return Math.max(ar, cn);
}

/* 标题里声明的总条数（"5 条""说 3 句""这 4 件事"），取出现次数最多的那个数字。
 * 必须排除「第 N 条/个」这种序号引用，否则"第 3 条最有用"会被当成声明 3 条。
 */
function declaredPoints(title) {
  const cleaned = String(title).replace(/第\s*[0-9一二三四五六七八九十]\s*(?:条|个|件|句|点|步|招|种)/g, '');
  const m = cleaned.match(/([1-9])\s*(?:条|个|件|句|点|步|招|种)/g);
  if (!m) return null;
  const counts = {};
  for (const s of m) {
    const n = Number(s.match(/[1-9]/)[0]);
    counts[n] = (counts[n] || 0) + 1;
  }
  return Number(Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]);
}

/* ---------------- 校验主流程 ---------------- */
function err(list, path, msg) { list.push({ level: 'error', path, msg }); }
function warn(list, path, msg) { list.push({ level: 'warn', path, msg }); }

function checkCopy(list, path, copy, platform, source, mode) {
  if (!copy || typeof copy !== 'object') { err(list, path, '缺少成稿'); return; }

  /* 模板稿字数天然偏短（骨架稿），把下限降到人稿的 65%，但报警告提醒扩写 */
  const isTemplate = source === 'template';
  const lenScale = isTemplate ? 0.65 : 1;

  /* --- 标题 --- */
  const titles = copy.titles;
  if (!Array.isArray(titles) || !titles.length) {
    err(list, path + '.titles', '标题列表为空');
  } else {
    if (titles.length < MIN_TITLES) err(list, path + '.titles', `标题只有 ${titles.length} 条，至少 ${MIN_TITLES} 条`);
    if (titles.length > MAX_TITLES) err(list, path + '.titles', `标题 ${titles.length} 条，超过 ${MAX_TITLES} 条`);
    const uniq = new Set(titles);
    if (uniq.size !== titles.length) err(list, path + '.titles', '标题有重复');
    titles.forEach((t, i) => {
      if (!String(t || '').trim()) err(list, `${path}.titles[${i}]`, '标题为空');
      if (String(t).length > 32) warn(list, `${path}.titles[${i}]`, `标题 ${String(t).length} 字，超过 32 字在信息流里会被截断`);
      if (/[。！？]$/.test(String(t))) warn(list, `${path}.titles[${i}]`, '标题结尾不要加句号');
    });
  }

  /* --- 正文 --- */
  const body = copy.body;
  if (typeof body !== 'string' || !body.trim()) {
    err(list, path + '.body', '正文为空');
    return;
  }
  const range = (mode === 'comment' ? LEN_RANGE_COMMENT : LEN_RANGE);
  const [lo, hi] = range[platform] || [200, 2000];
  const n = body.length;
  if (n < lo * lenScale) {
    err(list, path + '.body', `正文 ${n} 字，低于 ${platform} 的下限 ${Math.round(lo * lenScale)} 字`);
  } else if (n < lo) {
    warn(list, path + '.body', `正文 ${n} 字，低于 ${platform} 的成稿标准 ${lo} 字（骨架稿水平，发之前要扩写）`);
  } else if (n > hi) {
    warn(list, path + '.body', `正文 ${n} 字，超过 ${platform} 的常规上限 ${hi} 字`);
  }

  /* --- 段数 / 复读 --- */
  const paras = body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (paras.length < 4) err(list, path + '.body', `只分了 ${paras.length} 段，正文至少 4 段`);
  const seen = new Map();
  for (const p of paras) {
    if (p.length < 8) continue;
    seen.set(p, (seen.get(p) || 0) + 1);
  }
  for (const [p, c] of seen) {
    if (c > 1) err(list, path + '.body', `同一段重复出现 ${c} 次：「${p.slice(0, 20)}…」`);
  }

  /* --- 条数一致性：标题说几条，正文就得几条 --- */
  const items = countItems(body, platform);
  if (items === 0) {
    err(list, path + '.body', `${platform} 正文里数不出条目（公众号应用「一、」，小红书应用「1️⃣」，口播应用「1、」）`);
  } else {
    const declared = new Set((titles || []).map(declaredPoints).filter(Boolean));
    if (declared.size > 1) {
      err(list, path + '.titles', `几条标题声明的条数不一致：${[...declared].join('/')}`);
    } else if (declared.size === 1) {
      const want = [...declared][0];
      if (items !== want) err(list, path, `标题说 ${want} 条，正文实际写了 ${items} 条`);
    }
    if (copy.points != null && Number(copy.points) !== items) {
      err(list, path + '.points', `points=${copy.points}，正文实际 ${items} 条`);
    }
  }

  /* --- 合规 --- */
  const hits = Sensitive.check(body);
  const blocking = hits.filter((h) => h.level === 'high' && BLOCK_CATS.includes(h.cat));
  const soft = hits.filter((h) => !blocking.includes(h));
  if (blocking.length) {
    const names = [...new Set(blocking.map((h) => h.cat + '/' + h.word))].slice(0, 5).join('、');
    err(list, path + '.body', `命中必改违规词：${names}`);
  }
  if (soft.length) {
    const names = [...new Set(soft.map((h) => h.cat + '/' + h.word))].slice(0, 6).join('、');
    warn(list, path + '.body', `命中软风险词，人工过一眼：${names}`);
  }
  for (const t of titles || []) {
    const th = Sensitive.check(t).filter((h) => h.level === 'high' && BLOCK_CATS.includes(h.cat));
    if (th.length) err(list, path + '.titles', `标题命中必改违规词：${th.map((h) => h.word).join('、')}`);
  }

  /* --- AI 味（只提示） --- */
  const aiHits = detectAI(body + '\n' + (titles || []).join('\n'));
  for (const h of aiHits) warn(list, path, `AI 味·${h.name}：「${h.sample}」→ ${h.tip}`);
}

function validateShipped(obj) {
  const list = [];
  if (!obj || typeof obj !== 'object') return [{ level: 'error', path: '', msg: '不是一个对象' }];

  /* date 必须是 YYYY-MM-DD 且是今天或昨天（防止把过期内容当今日推上线） */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(obj.date || ''))) {
    err(list, 'date', `date 格式应为 YYYY-MM-DD，实际是 ${JSON.stringify(obj.date)}`);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (obj.date !== today && obj.date !== yest) {
      err(list, 'date', `date=${obj.date} 既不是今天(${today})也不是昨天(${yest})，拒绝上线`);
    }
  }
  if (!obj.updatedAt || Number.isNaN(Date.parse(obj.updatedAt))) err(list, 'updatedAt', 'updatedAt 不是合法时间');

  /* topics */
  const topics = obj.topics;
  if (!Array.isArray(topics) || !topics.length) {
    err(list, 'topics', 'topics 为空');
  } else {
    if (topics.length < 3) err(list, 'topics', `只有 ${topics.length} 个选题，至少 3 个`);
    const ids = new Set();
    const tts = new Set();
    topics.forEach((t, i) => {
      const p = `topics[${i}]`;
      if (!t || typeof t !== 'object') { err(list, p, '不是对象'); return; }
      if (!t.id) err(list, p + '.id', '缺少 id');
      else if (ids.has(t.id)) err(list, p + '.id', `id 重复：${t.id}`);
      else ids.add(t.id);

      if (!String(t.title || '').trim()) err(list, p + '.title', '选题标题为空');
      else if (tts.has(t.title)) err(list, p + '.title', `选题标题重复：${t.title}`);
      else tts.add(t.title);

      if (!String(t.angle || '').trim()) err(list, p + '.angle', '缺少 angle（切入角度）');
      if (!String(t.why || '').trim()) err(list, p + '.why', '缺少 why（为什么做这个选题）');
      if (t.heat != null && (typeof t.heat !== 'number' || t.heat < 0 || t.heat > 100)) {
        err(list, p + '.heat', `heat 应为 0-100 的数字，实际 ${t.heat}`);
      }
      if (!Array.isArray(t.platforms) || !t.platforms.length) {
        err(list, p + '.platforms', 'platforms 为空');
      } else {
        for (const pl of t.platforms) if (!PLATFORMS.includes(pl)) err(list, p + '.platforms', `未知平台 ${pl}`);
      }

      /* 成稿：出厂要求每个声明平台都有 copy */
      if (!t.copies || typeof t.copies !== 'object') {
        err(list, p + '.copies', '缺少成稿 copies（出厂不允许“现场生成”的选题）');
      } else {
        for (const pl of (t.platforms || [])) {
          if (!t.copies[pl]) err(list, `${p}.copies.${pl}`, '声明了该平台但没有成稿');
          else checkCopy(list, `${p}.copies.${pl}`, t.copies[pl], pl, t.source, t.mode);
        }
        for (const pl of Object.keys(t.copies)) {
          if (!PLATFORMS.includes(pl)) err(list, `${p}.copies.${pl}`, `未知平台 ${pl}`);
        }
      }
    });
  }

  /* money */
  const money = obj.money;
  if (!Array.isArray(money) || !money.length) {
    err(list, 'money', 'money 为空');
  } else {
    if (money.length < 3) err(list, 'money', `只有 ${money.length} 个搞钱项目，至少 3 个`);
    const mids = new Set();
    const mts = new Set();
    money.forEach((m, i) => {
      const p = `money[${i}]`;
      if (!m || typeof m !== 'object') { err(list, p, '不是对象'); return; }
      if (!m.id) err(list, p + '.id', '缺少 id');
      else if (mids.has(m.id)) err(list, p + '.id', `id 重复：${m.id}`);
      else mids.add(m.id);

      if (!String(m.title || '').trim()) err(list, p + '.title', '标题为空');
      else if (mts.has(m.title)) err(list, p + '.title', `标题重复：${m.title}`);
      else mts.add(m.title);

      for (const f of ['desc', 'income', 'time', 'cost', 'level']) {
        if (!String(m[f] || '').trim()) err(list, p + '.' + f, `缺少 ${f}`);
      }
      if (!Array.isArray(m.how) || m.how.length < 3) err(list, p + '.how', `how 至少 3 步，实际 ${(m.how || []).length} 步`);
      if (!Array.isArray(m.risk) || !m.risk.length) err(list, p + '.risk', 'risk 为空（必须写清坑）');

      /* 搞钱项目是高危区：只拦收益承诺与引流，绝对化词交给人工 */
      const blob = [m.desc, m.income, m.how.join(' ')].join(' ');
      const bad = Sensitive.check(blob).filter((h) => h.level === 'high' && ['虚假收益', '站外引流'].includes(h.cat));
      if (bad.length) err(list, p, `收益/引流高危词：${[...new Set(bad.map((h) => h.word))].join('、')}`);
    });
  }

  return list;
}

/**
 * 组装期兜底校验：允许选题没有 copies（UI 会标“现场生成”），其余规则不变。
 * 用途：gen-daily.js 的中间产物体检、CI 里跑历史文件。
 */
function validate(obj) {
  const list = validateShipped(obj);
  return list.filter((x) => {
    if (x.level === 'error' && /出厂不允许/.test(x.msg)) return false;
    if (x.level === 'error' && /声明了该平台但没有成稿/.test(x.msg)) return false;
    return true;
  });
}

function summarize(list) {
  const errors = list.filter((x) => x.level === 'error');
  const warns = list.filter((x) => x.level === 'warn');
  return { ok: errors.length === 0, errors, warns };
}

function format(list) {
  const { ok, errors, warns } = summarize(list);
  const lines = [];
  for (const e of errors) lines.push(`  ✗ ${e.path}  ${e.msg}`);
  for (const w of warns) lines.push(`  ! ${w.path}  ${w.msg}`);
  lines.push(`  ${ok ? '✓ 校验通过' : '✗ 校验失败'}：${errors.length} 个错误，${warns.length} 个警告`);
  return lines.join('\n');
}

module.exports = {
  validate, validateShipped, checkCopy, countItems, declaredPoints,
  detectAI, summarize, format, PLATFORMS, LEN_RANGE, LEN_RANGE_COMMENT, BLOCK_CATS,
};

if (require.main === module) {
  const path = process.argv[2] || 'data/daily.json';
  const obj = JSON.parse(require('fs').readFileSync(path, 'utf8'));
  const list = validateShipped(obj);
  console.log(`\n校验 ${path}\n`);
  console.log(format(list));
  process.exit(summarize(list).ok ? 0 : 1);
}
