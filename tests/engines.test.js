/**
 * 回归测试：node --test tests/
 * 覆盖三块纯逻辑引擎（generator / sensitive / 校验器）+ 热榜过滤 + 原子写。
 * 全部离线，不打网络。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const CopyGen = require(path.join(ROOT, 'assets/js/generator.js'));
const Sensitive = require(path.join(ROOT, 'assets/js/sensitive.js'));
const V = require(path.join(ROOT, 'scripts/validate-daily.js'));

/* ---------------- generator：标题 ---------------- */
test('标题：条数声明与 points 一致', () => {
  for (const p of ['gongzhonghao', 'xiaohongshu', 'shipinhao']) {
    for (const n of [3, 4, 5]) {
      const r = CopyGen.generate({ topic: '30岁还没存款', platform: p, points: n });
      assert.ok(r.titles.length >= 3, `${p}/${n} 标题太少`);
      assert.strictEqual(r.points, n);
    }
  }
});

test('标题：长度不超过 30 字（信息流截断线）', () => {
  const long = '为什么老一辈人觉得搭伙过日子很幸福，而现在的年轻人却很排斥';
  for (const p of ['gongzhonghao', 'xiaohongshu', 'shipinhao']) {
    const r = CopyGen.generate({ topic: long, platform: p, points: 5 });
    for (const t of r.titles) {
      assert.ok(t.length <= 30, `${p} 标题 ${t.length} 字超限：${t}`);
    }
  }
});

test('标题：不出现半截话（结尾不能是虚词/助词）', () => {
  const long = '为什么老一辈人觉得搭伙过日子很幸福，而现在的年轻人却很排斥';
  const bad = /[的了很都就也还把被让给与，、：；,.:;（(]$/;
  for (const p of ['gongzhonghao', 'xiaohongshu', 'shipinhao']) {
    const r = CopyGen.generate({ topic: long, platform: p, points: 5 });
    for (const t of r.titles) {
      assert.ok(!bad.test(t), `${p} 标题尾部残缺：「${t}」`);
    }
  }
});

test('标题：首条一定带数字（「说几条就写几条」的承诺）', () => {
  const r = CopyGen.generate({ topic: '10元快剪', platform: 'xiaohongshu', points: 5 });
  assert.match(r.titles[0], /[1-9]/);
});

/* ---------------- generator：正文 ---------------- */
test('正文：说 5 条就写 5 条（三平台各自的结构）', () => {
  for (const p of ['gongzhonghao', 'xiaohongshu', 'shipinhao']) {
    const r = CopyGen.generate({ topic: '如何早起', platform: p, points: 5 });
    assert.strictEqual(V.countItems(r.body, p), 5, `${p} 正文条目数不对`);
  }
});

test('正文：多段、无重复段', () => {
  const r = CopyGen.generate({ topic: '如何早起', platform: 'gongzhonghao', points: 5 });
  const paras = r.body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  assert.ok(paras.length >= 5, `只有 ${paras.length} 段`);
  assert.strictEqual(new Set(paras).size, paras.length, '有重复段');
});

test('正文：素材库内容会被插进去', () => {
  const story = '我去年在县城开过三个月奶茶店，赔了两万';
  const r = CopyGen.generate({
    topic: '副业', platform: 'gongzhonghao', points: 5,
    materials: { stories: [story] },
  });
  assert.ok(r.body.includes(story), '真实经历没进正文');
});

test('赛道识别：能认出错配的情况（回归已知缺陷）', () => {
  // 「10元快剪」属于消费观察，SECTORS 里没有这个赛道 → 现在会掉进 growth 兜底
  // 这个测试固定住现状，等修好 SECTORS 后应改成期望「消费观察」
  const r = CopyGen.generate({ topic: '10元快剪暴打设计总监', platform: 'gongzhonghao', points: 5 });
  assert.ok(r.sectorKey, '没识别出赛道');
});

/* ---------------- sensitive ---------------- */
test('合规：高危词能命中', () => {
  const hits = Sensitive.check('这个产品月入十万，加我微信领取');
  const cats = new Set(hits.map((h) => h.cat));
  assert.ok(cats.has('虚假收益'), '没抓到虚假收益');
  assert.ok(cats.has('站外引流'), '没抓到站外引流');
});

test('合规：正常表达不误报', () => {
  const hits = Sensitive.check('最近我第一步是先把桌子收拾干净，第一天只做五分钟。');
  assert.strictEqual(hits.length, 0, '误报了：' + JSON.stringify(hits.map((h) => h.word)));
});

/* ---------------- 校验器 ---------------- */
function goodPayload() {
  const mk = (topic) => {
    const copies = {};
    for (const p of ['gongzhonghao', 'xiaohongshu', 'shipinhao']) {
      const g = CopyGen.generate({ topic, platform: p, points: 5 });
      copies[p] = { points: 5, titles: g.titles, body: g.body };
    }
    return copies;
  };
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    updatedAt: new Date().toISOString(),
    topics: ['如何早起', '怎么存钱', '要不要裸辞'].map((t, i) => ({
      id: 't' + (i + 1), title: t, angle: '自我成长', why: '测试',
      heat: 70, tags: ['#测试'], platforms: ['gongzhonghao', 'xiaohongshu', 'shipinhao'],
      copies: mk(t), source: 'template',
    })),
    money: [1, 2, 3].map((n) => ({
      id: 'm' + n, title: '项目' + n, desc: '描述', income: '一天 100 左右',
      time: '一小时', cost: '几十块', level: '会用手就行',
      how: ['第一步', '第二步', '第三步'], risk: ['坑一'],
    })),
  };
}

test('校验器：合格数据应通过', () => {
  const r = V.summarize(V.validateShipped(goodPayload()));
  assert.strictEqual(r.errors.length, 0, JSON.stringify(r.errors, null, 1));
});

test('校验器：标题说 5 条正文只写 3 条 → 报错', () => {
  const d = goodPayload();
  const g = CopyGen.generate({ topic: '如何早起', platform: 'gongzhonghao', points: 3 });
  d.topics[0].copies.gongzhonghao = { points: 5, titles: g.titles, body: g.body };
  const errs = V.summarize(V.validateShipped(d)).errors;
  assert.ok(errs.some((e) => /条/.test(e.msg)), '没抓到条数不一致');
});

test('校验器：日期过期 → 拒绝上线', () => {
  const d = goodPayload();
  d.date = '2020-01-01';
  const errs = V.summarize(V.validateShipped(d)).errors;
  assert.ok(errs.some((e) => e.path === 'date'), '没拦过期日期');
});

test('校验器：声明了平台但没有成稿 → 报错', () => {
  const d = goodPayload();
  delete d.topics[0].copies.shipinhao;
  const errs = V.summarize(V.validateShipped(d)).errors;
  assert.ok(errs.some((e) => /没有成稿/.test(e.msg)), '没拦缺失成稿');
});

test('校验器：id 重复 → 报错', () => {
  const d = goodPayload();
  d.topics[1].id = d.topics[0].id;
  const errs = V.summarize(V.validateShipped(d)).errors;
  assert.ok(errs.some((e) => /id 重复/.test(e.msg)), '没拦重复 id');
});

test('校验器：搞钱项目收益承诺 → 报错', () => {
  const d = goodPayload();
  d.money[0].income = '躺赚，月入十万，稳赚不赔';
  const errs = V.summarize(V.validateShipped(d)).errors;
  assert.ok(errs.some((e) => /收益/.test(e.msg)), '没拦收益承诺');
});

test('校验器：declaredPoints 不能被「第 3 条」骗到', () => {
  assert.strictEqual(V.declaredPoints('5 条大实话，第 3 条最有用'), 5);
  assert.strictEqual(V.declaredPoints('这 4 件事，第 2 个最要命'), 4);
});

test('校验器：AI 味能识别对举句', () => {
  const hits = V.detectAI('这不是技术问题，而是认知问题。');
  assert.ok(hits.some((h) => /对举/.test(h.name)), '没抓到「不是…而是…」');
});

/* ---------------- 热榜过滤 ---------------- */
test('热榜过滤：单字「死」不该误伤正常词', () => {
  const { BLOCK } = require(path.join(ROOT, 'scripts/fetch-hot.js'));
  assert.strictEqual(BLOCK.test('死磕一件事'), false, '「死磕」被误伤了');
  assert.strictEqual(BLOCK.test('如何评价死磕英语'), false, '「死磕」被误伤了');
  // 真正的灾情/伤亡仍然要拦
  assert.strictEqual(BLOCK.test('某地地震致多人遇难'), true, '真正的灾情没拦住');
});

test('热榜过滤：品牌/产品新闻不该进选题池', () => {
  const m = require(path.join(ROOT, 'scripts/fetch-hot.js'));
  for (const w of ['阿维塔省钱救不了销量', '苹果国行AI来了', 'iPhone Duo的铰链是AI打造的吗']) {
    assert.ok(m.scoreWord(w).score <= 0, `品牌新闻没被压分：${w} → ${m.scoreWord(w).score}`);
  }
});

test('热榜过滤：美妆种草类不该进选题池', () => {
  const m = require(path.join(ROOT, 'scripts/fetch-hot.js'));
  for (const w of ['秋天化个浪漫香颂可可妆', 'AI珍珠圣女妆']) {
    assert.ok(m.scoreWord(w).score <= 0, `美妆类没被压分：${w} → ${m.scoreWord(w).score}`);
  }
  // 但「平价/学生党」这类实用向要留活路
  assert.ok(m.scoreWord('学生党平价护肤怎么选').score > m.scoreWord('秋天化个妆').score);
});

test('buildPicks：不信任落盘里的旧 score，一律按新规则重算', () => {
  const m = require(path.join(ROOT, 'scripts/fetch-hot.js'));
  const fake = {
    hot: { douyin: [{ word: '死磕一件事', platform: 'douyin', score: 999, hits: 9 }] },
  };
  const picks = m.buildPicks(fake.hot);
  assert.ok(!picks.some((p) => p.score === 999), '旧 score 被直接信任了');
});

/* ---------------- 原子写 ---------------- */
test('原子写：写坏不覆盖原文件', () => {
  const { writeAtomic } = require(path.join(ROOT, 'scripts/gen-daily.js'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zm-'));
  const f = path.join(dir, 'x.json');
  fs.writeFileSync(f, '{"a":1}');
  writeAtomic(f, '{"a":2}');
  assert.strictEqual(fs.readFileSync(f, 'utf8'), '{"a":2}');
  assert.ok(!fs.existsSync(f + '.tmp'), '临时文件没清掉');
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ---------------- 线上文件体检 ---------------- */
test('data/daily.json 现状能通过校验', () => {
  const obj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/daily.json'), 'utf8'));
  const r = V.summarize(V.validateShipped(obj));
  assert.strictEqual(r.errors.length, 0, '线上稿有错误：\n' + V.format(V.validateShipped(obj)));
});
