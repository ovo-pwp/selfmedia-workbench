/**
 * 热点抓取引擎（零依赖，Node 内置模块）
 * 直连抓取抖音 / B站 / 百度 / 头条 的公开热榜，过滤敏感与不适合创作的词，
 * 输出统一结构供 server.js 和定时任务复用。
 */
'use strict';

const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { URL } = require('url');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function request(url, { timeout = 12000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(e); }
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': u.origin + '/',
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        try {
          if (enc.includes('br')) buf = zlib.brotliDecompressSync(buf);
          else if (enc.includes('gzip')) buf = zlib.gunzipSync(buf);
          else if (enc.includes('deflate')) buf = zlib.inflateSync(buf);
        } catch (_) { /* 有些服务声明了编码但没压缩，直接用原文 */ }
        resolve({ status: res.statusCode, body: buf.toString('utf8') });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function getJson(url, opts) {
  const r = await request(url, opts);
  if (r.status !== 200) throw new Error('HTTP ' + r.status);
  return JSON.parse(r.body);
}

/* ---------------- 过滤规则 ---------------- */

// 政治 / 灾情 / 伤亡 / 案件 / 明星八卦 一律不进选题池
const BLOCK = /(中共中央|政治局|总书记|国家主席|总理|国务院|人大|政协|外交部|国防部|解放军|军队|台湾|台独|香港|澳门|西藏|新疆|南海|钓鱼岛|地震|台风|洪水|山洪|泥石流|暴雨|火灾|爆炸|塌方|事故|遇难|身亡|死亡|死|受伤|伤者|确诊|疫情|病毒|肺炎|癌|猝死|自杀|跳楼|坠楼|被杀|凶杀|杀人|尸体|遗体|哀悼|安葬|葬礼|去世|逝世|讣告|悼念|被捕|刑拘|判刑|获刑|庭审|起诉|受贿|落马|双规|纪委|监委|警方通报|公安通报|失联|失踪|拐卖|性侵|猥亵|吸毒|贩毒|诈骗案|非法集资|爆雷|官宣恋情|离婚|出轨|家暴|怀孕|生子|领证|婚礼|恋情|分手|塌房|封杀|道歉|互撕|怒怼|回怼|股价|涨停|跌停|A股|港股|美股|金价|房价|楼市|烂尾|存量房贷|LPR|降息|加息|央行|关税|汇率|选举|总统|首相|峰会|制裁|战争|俄乌|以色列|巴勒斯坦|伊朗|朝鲜|美国|日本|韩国|特朗普|拜登|普\S*京|主演|男主|女主|剧集|电视剧|综艺|票房|杀青|剧组|导演|演员|歌手|新歌|专辑|代言|路演|磕CP|番位|粉丝|爱豆|被曝|曝出|辟谣|起诉|律师函|回应|小城良方|演唱会|定档|海报|预告片|片花|红毯|盛典|颁奖|坠亡|身亡|遇难|溺亡|猝死|死因|遗体|警方|立案|不予立案|法院|庭审|判决|犯罪|违法|刑拘|猥亵|性侵|拐卖)/;

// 娱乐 / 体育赛事 / 时尚活动 → 不是不能做，但基本做不出普通人共鸣，重降权
const LOW_VALUE = /(综艺|节目|真人秀|嘉宾|选手|战队|夺冠|晋级|赛事|赛果|复盘|战报|球员|球星|赛季|进球|联赛|教练|主场|客场|VOGUE|时尚|明星|艺人|出道|选秀|节目组|摄制|影视|剧集|深扒|爆料|内幕|名单|番位|路透|同框|营业|打歌|舞台|排练)/;

// 各平台基础倾向：知乎长议题最好用，微博八卦/广告最多，B站游戏二次元比例高
const PLATFORM_BIAS = { zhihu: 8, douyin: 2, baidu: 0, toutiao: 0, bilibili: -4, weibo: -6 };

// 和「普通人能做出内容」相关的方向，命中即加权
const BOOST = [
  [/霜降|立冬|秋日|秋天|换季|降温|季节|二十四节气/, 26],
  [/养生|睡眠|失眠|熬夜|早睡|健康|体检|颈椎|腰痛|眼睛|脱发/, 20],
  [/减肥|瘦|健身|跑步|运动|跳绳|瑜伽|体态|减脂/, 20],
  [/自律|早起|习惯|时间管理|效率|拖延|专注|计划|复盘/, 26],
  [/读书|书单|阅读|写作|学习|技能|考证|考试|考研|考公|备考/, 26],
  [/副业|搞钱|赚钱|存钱|攒钱|理财|省钱|记账|收入|工资|加薪|跳槽/, 30],
  [/上班|职场|打工|裸辞|辞职|加班|领导|老板|同事|面试|简历|offer|实习|毕业|找工作/, 26],
  [/宝妈|育儿|亲子|孩子|带娃|父母|妈妈|爸爸|家庭|婚姻|恋爱|对象|相亲|催婚/, 22],
  [/情绪|焦虑|内耗|治愈|孤独|幸福|成长|崩溃|松弛|自我|性格|内向|讨好|边界/, 30],
  [/AI|人工智能|大模型|工具|效率软件|手机|App|剪辑|摄影|拍视频|自媒体|博主|流量|涨粉|直播/, 24],
  [/美食|做饭|菜谱|早餐|咖啡|旅行|露营|装修|租房|家居|收纳|断舍离|极简|手账/, 18],
  [/宠物|猫|狗|穿搭|护肤|化妆|发型|穿搭|好物|平价|性价比|平替/, 16],
  [/中年|30岁|35岁|40岁|普通人|小城|老家|返乡|退休|养老/, 24],
];

// 明显是广告 / 平台活动 / 无信息量的词
const NOISE = /(大赏|挑战赛|小赛|收藏赛|征集|投票|直播预告|开播|抽奖|福利|优惠|补贴|券|活动|报名|招募|上新|首发|预售|官宣|定档|预告|花絮|片单|OST|主题曲|演唱会|巡演|路透|生图|机场|同框|合作曲|联名|瓜分|抢购|秒杀|下单|满减|旗舰店|买一送一|直播间|抽好礼|免费领)/;

function scoreWord(word) {
  let score = 0;
  const hits = [];
  for (const [re, w] of BOOST) {
    if (re.test(word)) { score += w; hits.push(w); }
  }
  if (LOW_VALUE.test(word)) score -= 60;
  else if (NOISE.test(word)) score -= 30;
  if (word.length < 5) score -= 8;
  // 知乎类长标题（"如何看待…"）反而是好选题，放宽惩罚阈值
  if (word.length > 42) score -= 6;
  return { score, hits };
}

function clean(list, platform) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const word = String(item.word || '').replace(/\s+/g, ' ').trim();
    if (!word) continue;
    if (BLOCK.test(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    const { score, hits } = scoreWord(word);
    out.push({
      word,
      platform,
      hot: item.hot || 0,
      score: score + (PLATFORM_BIAS[platform] || 0),
      hits: hits.length,
      url: item.url || '',
    });
  }
  return out;
}

/* ---------------- 各平台抓取 ---------------- */

async function douyin() {
  const j = await getJson('https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/', {
    headers: { Referer: 'https://www.douyin.com/' },
  });
  return (j.word_list || []).map((x, i) => ({
    word: x.word, hot: x.hot_value || 0, rank: i + 1,
    url: 'https://www.douyin.com/search/' + encodeURIComponent(x.word),
  }));
}

async function bilibili() {
  const j = await getJson('https://api.bilibili.com/x/web-interface/search/square?limit=30', {
    headers: { Referer: 'https://www.bilibili.com/' },
  });
  const list = (j.data && j.data.trending && j.data.trending.list) || [];
  return list.map((x, i) => ({
    word: x.show_name || x.keyword, hot: x.heat_score || 0, rank: i + 1,
    url: 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(x.keyword || x.show_name),
  }));
}

async function baidu() {
  const j = await getJson('https://top.baidu.com/api/board?platform=wise&tab=realtime', {
    headers: { Referer: 'https://top.baidu.com/board?tab=realtime' },
  });
  const cards = (j.data && j.data.cards) || [];
  const raw = [];
  for (const card of cards) {
    for (const group of (card.content || [])) {
      for (const it of (group.content || [])) {
        if (it.word) raw.push({ word: it.word, hot: Number(it.hotScore) || 0, url: it.url || '' });
      }
    }
  }
  return raw.map((x, i) => ({ ...x, rank: i + 1 }));
}

async function toutiao() {
  const j = await getJson('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', {
    headers: { Referer: 'https://www.toutiao.com/' },
  });
  const list = j.data || [];
  return list.map((x, i) => ({
    word: x.Title || x.QueryWord, hot: Number(x.HotValue) || 0, rank: i + 1,
    url: x.Url || ('https://so.toutiao.com/search?keyword=' + encodeURIComponent(x.Title || '')),
  }));
}

/* 微博热搜：接口只认特定版本 UA，换成新版 Chrome 会直接 403（参考 imsyy/DailyHotApi 的实现） */
const WEIBO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

async function weibo() {
  const j = await getJson('https://weibo.com/ajax/side/hotSearch', {
    headers: { 'User-Agent': WEIBO_UA, Referer: 'https://weibo.com/' },
  });
  const list = (j.data && j.data.realtime) || [];
  return list.map((x, i) => {
    const raw = x.word || x.word_scheme || '';
    const word = String(raw).replace(/^#+|#+$/g, '');
    return {
      word, hot: Number(x.num) || 0, rank: i + 1,
      url: 'https://s.weibo.com/weibo?q=' + encodeURIComponent(raw),
    };
  });
}

/* 知乎热榜：域名必须用 api.zhihu.com，www.zhihu.com/api/v3 会 401 */
async function zhihu() {
  const j = await getJson('https://api.zhihu.com/topstory/hot-lists/total?limit=50', {
    headers: { 'User-Agent': WEIBO_UA, Referer: 'https://www.zhihu.com/hot' },
  });
  const list = j.data || [];
  return list.map((x, i) => {
    const t = x.target || {};
    const m = String(x.detail_text || '').match(/([\d.]+)\s*万/);
    const qid = String(t.url || '').split('/').pop();
    return {
      word: t.title || '',
      hot: m ? Math.round(parseFloat(m[1]) * 10000) : 0,
      rank: i + 1,
      url: qid ? 'https://www.zhihu.com/question/' + qid : (t.url || ''),
    };
  });
}

const SOURCES = { douyin, bilibili, baidu, toutiao, weibo, zhihu };

/** 从各平台热度池里挑出适合做内容的选题，按匹配度排序 */
function buildPicks(hot) {
  const all = [];
  const seen = new Set();
  for (const n of Object.keys(hot || {})) {
    for (const it of hot[n] || []) {
      if (!seen.has(it.word)) { seen.add(it.word); all.push(it); }
    }
  }
  all.sort((a, b) => b.score - a.score || b.hot - a.hot);
  // 只保留正分（真正适合做内容的），全负时退回原始排序，避免空池
  const good = all.filter((x) => x.score > 0);
  return (good.length >= 10 ? good : all).slice(0, 40);
}

/**
 * 抓取全部平台。任一平台失败不影响其它，返回 failed 列表便于前端提示。
 */
async function fetchAll() {
  const names = Object.keys(SOURCES);
  const results = await Promise.allSettled(names.map((n) => SOURCES[n]()));
  const hot = {};
  const failed = [];
  names.forEach((n, i) => {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value.length) hot[n] = clean(r.value, n);
    else failed.push(n);
  });
  return {
    date: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
    ok: Object.keys(hot).length > 0,
    failed,
    hot,
    picks: buildPicks(hot),
  };
}

module.exports = { fetchAll, buildPicks, request, BLOCK };

if (require.main === module) {
  fetchAll().then((d) => {
    console.log(JSON.stringify({
      date: d.date, ok: d.ok, failed: d.failed,
      counts: Object.fromEntries(Object.entries(d.hot).map(([k, v]) => [k, v.length])),
      picks: d.picks.slice(0, 12).map((x) => `${x.word} (${x.score})`),
    }, null, 2));
    require('fs').writeFileSync(
      require('path').join(__dirname, '..', 'data', 'hot.json'),
      JSON.stringify(d, null, 1)
    );
  }).catch((e) => { console.error(e); process.exit(1); });
}
