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

test('赛道识别：消费观察 / 社会话题不再掉进「自我成长」兜底', () => {
  const cases = {
    '10元快剪暴打设计总监': '消费观察',
    '理发店办卡套路': '消费观察',
    '外卖越来越贵': '消费观察',
    '预制菜进校园': '消费观察',
    '老人花钱请人陪聊': '社会话题',
    '为什么老一辈人觉得搭伙过日子很幸福': '社会话题',
    '如何早起': '自我成长',
    '要不要裸辞': '职场打工',
    '53岁减重血糖回正常': '健康生活',
  };
  for (const [topic, want] of Object.entries(cases)) {
    assert.strictEqual(CopyGen.detectSector(topic).name, want, `「${topic}」判成了别的赛道`);
  }
});

test('赛道 mode：观察类走 comment，方法论类走 method', () => {
  assert.strictEqual(CopyGen.detectSector('10元快剪暴打设计总监').mode, 'comment');
  assert.strictEqual(CopyGen.detectSector('老人花钱请人陪聊').mode, 'comment');
  assert.strictEqual(CopyGen.detectSector('如何早起').mode, 'method');
  assert.strictEqual(CopyGen.detectSector('30岁还没存款').mode, 'method');
});

test('评论类正文：不能出现「先砍掉一半目标」这类方法论要点', () => {
  // 这是改造前最刺眼的 bug：「10元快剪」被写成「把清单砍到只剩三件」
  const r = CopyGen.generate({ topic: '10元快剪暴打设计总监', platform: 'gongzhonghao', points: 5 });
  const forbidden = ['砍掉一半目标', '拆到', '打卡上瘾', '固定锚点', '允许自己做得很烂'];
  for (const f of forbidden) {
    assert.ok(!r.body.includes(f), `评论类正文里混进了方法论要点：${f}`);
  }
});

test('评论类正文：要点必须和消费/社会话题相关', () => {
  const r = CopyGen.generate({ topic: '10元快剪暴打设计总监', platform: 'gongzhonghao', points: 5 });
  // 至少有一个要点提到价格/贵/卡/套路/问 这类消费向的词
  const items = r.body.split('\n\n').filter((x) => /^[一二三四五]、/.test(x));
  assert.strictEqual(items.length, 5);
  const related = items.filter((x) => /价|贵|便宜|卡|套路|问|账|钱|成本/.test(x));
  assert.ok(related.length >= 3, `只有 ${related.length}/5 条和消费相关`);
});

test('评论类正文：不同话题的同赛道要点应尽量不重叠', () => {
  const pickItems = (t) => CopyGen.generate({ topic: t, platform: 'gongzhonghao', points: 5 })
    .body.split('\n\n').filter((x) => /^[一二三四五]、/.test(x))
    .map((x) => x.split('\n')[0].slice(3, 12));
  const a = pickItems('10元快剪暴打设计总监');
  const b = pickItems('外卖越来越贵');
  const overlap = a.filter((x) => b.includes(x)).length;
  // 同一赛道同一个池子，允许少量重叠；超过 3 条说明条件过滤没生效
  assert.ok(overlap <= 3, `两个不同话题重叠了 ${overlap}/5 条要点`);
});

test('评论类钩子：不能用「我自己试了一遍」这种方法论语气', () => {
  for (let i = 0; i < 12; i++) {
    const r = CopyGen.generate({ topic: '老人花钱请人陪聊', platform: 'gongzhonghao', points: 5 });
    assert.ok(!r.body.includes('我自己试了一遍'), '评论类用了方法论钩子');
    assert.ok(!/明天照着做第一条/.test(r.body), '评论类用了方法论 CTA');
  }
});

test('方法类正文：不能出现「差价在名头」这类消费向要点', () => {
  const r = CopyGen.generate({ topic: '如何早起', platform: 'gongzhonghao', points: 5 });
  assert.ok(!r.body.includes('名头'), '方法类混进了消费向要点');
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

test('热榜过滤：人物八卦 / 撞脸奇闻不该进选题池', () => {
  const m = require(path.join(ROOT, 'scripts/fetch-hot.js'));
  for (const w of ['撞脸王祖贤女生去景区上班', '姜乘澜回忆小时候的妈妈']) {
    assert.ok(m.scoreWord(w).score <= 0, `八卦类没被压分：${w} → ${m.scoreWord(w).score}`);
  }
  // 但纯八卦就算加上提问结构，也不该进选题池（"如何看待网红撞脸走红"仍然是八卦）
  assert.ok(m.scoreWord('如何看待网红撞脸明星走红').score <= 0, '换汤不换药的八卦被放行了');
  // 真正的议题结构应该有加成：同一件事，提问式比陈述式分高
  assert.ok(
    m.scoreWord('为什么老一辈人觉得搭伙过日子很幸福').score > m.scoreWord('老人搭伙过日子').score,
    '议题结构没有加成'
  );
});

test('要点池：方法类也支持条件过滤（饮食要点不跑到作息话题里）', () => {
  const eat = CopyGen.generate({ topic: '每天吃多少鸡蛋才科学', platform: 'gongzhonghao', points: 5 });
  const sleep = CopyGen.generate({ topic: '如何早起', platform: 'gongzhonghao', points: 5 });
  // 饮食类专属要点不该出现在早起话题里
  assert.ok(!sleep.body.includes('吃得太单一'), '饮食要点跑到了作息话题');
  assert.ok(!sleep.body.includes('指南给的是范围'), '饮食要点跑到了作息话题');
  // 反过来，作息要点也不该霸占饮食话题
  const eatItems = eat.body.split('\n\n').filter((x) => /^[一二三四五]、/.test(x));
  assert.ok(eatItems.length === 5, '饮食话题条目数不对');
});

test('要点池：健康话题能抽到饮食向内容', () => {
  let hit = 0;
  for (let i = 0; i < 20; i++) {
    const r = CopyGen.generate({ topic: '每天吃几个鸡蛋合适', platform: 'gongzhonghao', points: 5 });
    if (/吃|饮食|营养|总量|结构|种类/.test(r.body)) hit++;
  }
  assert.ok(hit >= 14, `20 次里只有 ${hit} 次抽到饮食向内容`);
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
