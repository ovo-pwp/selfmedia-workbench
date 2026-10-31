/**
 * 每日内容生成管线（把原来「仓库外手工跑」的链路收进仓库）
 *
 *   node scripts/gen-daily.js                 抓热榜 → 生成 → 校验 → 原子写盘
 *   node scripts/gen-daily.js --offline       不联网，用 data/hot.json 生成
 *   node scripts/gen-daily.js --dry           只校验不写盘
 *   node scripts/gen-daily.js --force         今天已经生成过也重跑
 *   node scripts/gen-daily.js --date 2026-11-01
 *
 * 写入流程（任何一步失败都不动 data/daily.json）：
 *   1) 抓热榜（失败自动降级到磁盘上的 hot.json）
 *   2) 手工稿优先：data/daily.override.json 里同题的内容直接覆盖模板稿
 *   3) 模板引擎兜底产出三平台成稿（离线可用，零成本）
 *   4) validateShipped 出厂校验：有 error 就中止
 *   5) 备份旧稿 → 写临时文件 → rename 原子替换
 *
 * 内容来源标记（写进每个选题的 source 字段，方便和一手稿区分质量）：
 *   override  人工/大模型写好的稿子在 daily.override.json 里
 *   template  模板引擎生成（能发，但同赛道会撞结构，是已知的质量债）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const HISTORY = path.join(DATA, 'history');

const DAILY = path.join(DATA, 'daily.json');
const HOT = path.join(DATA, 'hot.json');
const OVERRIDE = path.join(DATA, 'daily.override.json');
const MONEY_BANK = path.join(DATA, 'money-bank.json');

const TOPIC_COUNT = 5;
const MONEY_COUNT = 8;
const PLATFORMS = ['gongzhonghao', 'xiaohongshu', 'shipinhao'];

/* ---------------- 小工具 ---------------- */
const readJSON = (p, dflt) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return dflt; }
};

function todayStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 原子写：先写 .tmp 并 fsync，再 rename 覆盖。断电/被 kill 不会留下半截 JSON */
function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

function backupCurrent() {
  if (!fs.existsSync(DAILY)) return null;
  const raw = fs.readFileSync(DAILY, 'utf8');
  const old = JSON.parse(raw);
  fs.writeFileSync(DAILY + '.bak', raw);
  if (!fs.existsSync(HISTORY)) fs.mkdirSync(HISTORY, { recursive: true });
  const keep = path.join(HISTORY, `daily-${old.date || 'unknown'}.json`);
  if (old.date && !fs.existsSync(keep)) fs.writeFileSync(keep, raw);
  return old;
}

/* 中文二元组，用来判断两个选题是不是在讲同一件事 */
function bigrams(s) {
  const t = String(s).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const out = new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}
function tooSimilar(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return false;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / Math.min(A.size, B.size) > 0.5;
}

/* ---------------- 选题挑选 ---------------- */
function pickTopics(hot, n) {
  const picks = (hot && hot.picks) || [];
  const chosen = [];
  for (const p of picks) {
    if (chosen.length >= n) break;
    const word = String(p.word || '').trim();
    if (!word || word.length < 6) continue;
    if (chosen.some((c) => tooSimilar(c.title, word))) continue;
    chosen.push({ ...p, title: word });
  }
  // 热榜不够时用各平台原始列表补位
  if (chosen.length < n) {
    for (const k of Object.keys(hot.hot || {})) {
      for (const it of hot.hot[k] || []) {
        if (chosen.length >= n) break;
        const word = String(it.word || '').trim();
        if (word.length < 6) continue;
        if (chosen.some((c) => tooSimilar(c.title, word))) continue;
        chosen.push({ ...it, title: word, score: it.score || 0, hits: 1 });
      }
    }
  }
  return chosen;
}

const ANGLE_LABEL = {
  contrast: '反差观点', emotion: '情绪共鸣', suspense: '悬念钩子', story: '故事切入',
};

function heatOf(score) {
  const v = Math.round(58 + Math.min(40, Math.max(0, (score || 0)) * 0.85));
  return Math.min(99, Math.max(40, v));
}

/* ---------------- 搞钱项目：从金库里轮换 ---------------- */
function rotateMoney(bank, prevIds, n) {
  const list = bank.filter((m) => m && m.title);
  if (!list.length) return [];
  const lastUsed = new Set(prevIds || []);
  const fresh = list.filter((m) => !lastUsed.has(m.id));
  const pool = fresh.length >= n ? fresh : list;
  const out = [];
  const usedTitles = [];
  for (const m of pool) {
    if (out.length >= n) break;
    if (usedTitles.some((t) => tooSimilar(t, m.title))) continue;
    out.push({ ...m });
    usedTitles.push(m.title);
  }
  return out;
}

/* ---------------- 手工稿保护 ---------------- */
/**
 * 把现有 daily.json 里带完整成稿的选题收割进 override 层。
 * 目的：自动生成永远不会覆盖掉已经写好的人工稿。
 * 旧稿没有 source 字段 → 视为人工稿（历史文件都是人工成稿）。
 */
function harvestOverrides(existing, overrideFile) {
  if (!existing || !Array.isArray(existing.topics)) return 0;
  const ov = readJSON(overrideFile, { topics: [] });
  if (!Array.isArray(ov.topics)) ov.topics = [];
  const known = new Set(ov.topics.map((t) => t.title));
  let added = 0;
  for (const t of existing.topics) {
    if (!t || !t.title || !t.copies) continue;
    if (t.source === 'template') continue; // 模板稿不收割，留位置给新内容
    const plats = Object.keys(t.copies || {});
    if (!plats.length) continue;
    if (known.has(t.title)) continue;
    ov.topics.push({
      title: t.title, angle: t.angle, why: t.why, heat: t.heat, tags: t.tags,
      copies: t.copies,
    });
    known.add(t.title);
    added++;
  }
  if (added) writeAtomic(overrideFile, JSON.stringify(ov, null, 1));
  return added;
}

/* ---------------- 主流程 ---------------- */
async function run(opts) {
  const o = Object.assign({ offline: false, dry: false, force: false, date: null, quiet: false }, opts || {});
  const log = (s) => { if (!o.quiet) console.log(s); };
  const CopyGen = require('../assets/js/generator.js');
  const V = require('./validate-daily.js');

  const date = o.date || todayStr(new Date());

  /* 1) 已经生成过就跳过（--force 除外），避免重复抓榜把稿子换掉 */
  const current = readJSON(DAILY, null);
  if (!o.force && current && current.date === date && !o.dry) {
    log(`[gen] ${date} 已生成过，跳过。要重跑加 --force`);
    return { ok: true, skipped: true };
  }

  /* 2) 热榜 */
  let hot = null;
  if (o.offline) {
    hot = readJSON(HOT, null);
    log(`[gen] 离线模式，用 ${HOT}（${hot && hot.date || '未知日期'}）`);
  } else {
    try {
      hot = await require('./fetch-hot.js').fetchAll();
      log(`[gen] 抓榜完成：${Object.entries(hot.hot || {}).map(([k, v]) => k + ':' + v.length).join(' ')}  失败:${(hot.failed || []).join(',') || '无'}`);
    } catch (e) {
      log(`[gen] 抓榜失败（${e.message}），降级用磁盘缓存`);
      hot = readJSON(HOT, null);
    }
  }
  if (!hot || !hot.hot || !Object.keys(hot.hot).length) {
    const msg = '没有任何可用热榜数据（联网失败且无本地缓存），中止。data/daily.json 未改动。';
    log('[gen] ' + msg);
    return { ok: false, error: msg };
  }

  /* 关键：磁盘上的 picks 是上次用旧过滤规则算出来的，不能直接用。
   * 每次都拿原始 hot 列表按当前规则重算，改了规则才真的生效。 */
  hot.picks = require('./fetch-hot.js').buildPicks(hot.hot);
  if (!hot.picks.length) {
    const msg = '按当前过滤规则，热榜里没有适合做内容的选题，中止。data/daily.json 未改动。';
    log('[gen] ' + msg);
    return { ok: false, error: msg };
  }

  /* 3) 选题 + 三平台成稿 */
  const picks = pickTopics(hot, TOPIC_COUNT);
  if (!picks.length) return { ok: false, error: '热榜里挑不出足够长的选题' };

  // 先把旧稿里的手工稿收割进 override 层，避免被模板稿覆盖
  if (current) {
    const n = harvestOverrides(current, OVERRIDE);
    if (n) log(`[gen] 已把 ${n} 篇旧手工稿存进 data/daily.override.json（不会被模板稿覆盖）`);
  }

  const overrides = readJSON(OVERRIDE, { topics: [] });
  const overrideByTitle = new Map((overrides.topics || []).map((t) => [t.title, t]));

  const topics = picks.map((p, i) => {
    const id = 't' + (i + 1);
    const ov = overrideByTitle.get(p.title);
    const heat = heatOf(p.score);
    const platforms = PLATFORMS.slice();

    if (ov && ov.copies) {
      log(`[gen] 采用手工稿：${p.title}`);
      return {
        id, title: p.title,
        angle: ov.angle || '热点切入',
        why: ov.why || `来自热榜，热度约 ${(p.hot / 10000 || 0).toFixed(0)}w，适合借势做内容。`,
        heat: ov.heat || heat,
        tags: ov.tags || [],
        platforms: Object.keys(ov.copies),
        copies: ov.copies,
        source: 'override',
        from: p.platform || 'hot',
      };
    }

    const copies = {};
    const tagSet = [];
    for (const pl of platforms) {
      const g = CopyGen.generate({ topic: p.title, platform: pl, points: 5 });
      copies[pl] = { points: g.points, titles: g.titles, body: g.body };
      for (const t of g.tags) if (!tagSet.includes(t)) tagSet.push(t);
    }
    const sec = CopyGen.detectSector(p.title);
    return {
      id, title: p.title,
      angle: `${sec.name} · ${ANGLE_LABEL[copies.gongzhonghao && 'contrast'] || '热点切入'}`,
      why: `来自热榜（${p.platform || 'hot'}），热度约 ${((p.hot || 0) / 10000).toFixed(0)}w。${p.hits ? '和普通人生活贴得近，有共鸣点。' : '可借这个点切进自己的领域。'}`,
      heat,
      tags: tagSet.slice(0, 6),
      platforms,
      copies,
      source: 'template',
      from: p.platform || 'hot',
    };
  });

  /* 4) 搞钱项目 */
  const bank = readJSON(MONEY_BANK, { items: [] });
  const bankItems = Array.isArray(bank) ? bank : (bank.items || []);
  let money = rotateMoney(bankItems, current && (current.money || []).map((m) => m.id), MONEY_COUNT);
  if (!money.length && current && current.money) {
    money = current.money;
    log('[gen] 搞钱金库为空，沿用上一版项目（请往 data/money-bank.json 里补）');
  }

  const out = {
    date,
    updatedAt: new Date().toISOString(),
    generator: 'gen-daily@1',
    note: '今日选题基于真实热榜加工。source=override 是人工/大模型成稿，source=template 是模板引擎兜底稿，发之前请至少改掉开头和结尾。数字只写结构数，效果数请按你自己真实情况替换。',
    topics,
    money,
  };

  /* 5) 出厂校验 */
  const list = V.validateShipped(out);
  const { ok, errors, warns } = V.summarize(list);

  const tplCount = topics.filter((t) => t.source === 'template').length;
  if (tplCount === topics.length) {
    list.push({ level: 'warn', path: 'topics', msg: `全部 ${tplCount} 个选题都是模板稿，同赛道会撞结构——往 data/daily.override.json 里补人工稿` });
  }

  log('');
  log(V.format(list) || '  （无内容）');

  if (o.dry) {
    log(`\n[gen] --dry：校验${ok ? '通过' : '未通过'}，未写盘`);
    return { ok, errors, warns, data: out };
  }

  if (!ok) {
    log(`\n[gen] 中止：${errors.length} 个错误。data/daily.json 未改动。`);
    return { ok: false, errors, warns };
  }

  /* 6) 备份 → 原子写 */
  const old = backupCurrent();
  if (old) log(`[gen] 已备份旧稿（${old.date}）→ data/daily.json.bak`);
  writeAtomic(DAILY, JSON.stringify(out, null, 1));
  log(`[gen] 已写入 data/daily.json：${topics.length} 个选题 / ${money.length} 个搞钱项目`);

  if (hot && !o.offline) {
    try { writeAtomic(HOT, JSON.stringify(hot, null, 1)); } catch (e) { log('[gen] hot.json 落盘失败：' + e.message); }
  }

  return { ok: true, data: out, errors, warns };
}

module.exports = { run, pickTopics, rotateMoney, writeAtomic, tooSimilar, harvestOverrides };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = {
    offline: argv.includes('--offline'),
    dry: argv.includes('--dry'),
    force: argv.includes('--force'),
  };
  const di = argv.indexOf('--date');
  if (di >= 0) opts.date = argv[di + 1];

  run(opts).then((r) => {
    process.exit(r.ok ? 0 : 1);
  }).catch((e) => {
    console.error('[gen] 未捕获异常：', e);
    process.exit(1);
  });
}
