/* ===== 各板块视图 ===== */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayStr = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const PLAT = { gongzhonghao: '公众号', xiaohongshu: '小红书', shipinhao: '视频号', douyin: '抖音', other: '其它' };
  const PLAT_EMOJI = { gongzhonghao: '💚', xiaohongshu: '📕', shipinhao: '🎬', douyin: '🎵', other: '📎' };

  const empty = (icon, text, btn) => `<div class="empty"><span class="big">${icon}</span>${text}${btn || ''}</div>`;

  /* 最近的连续打卡天数 */
  function streak(checks) {
    if (!checks || !checks.length) return 0;
    const set = new Set(checks);
    let n = 0;
    const d = new Date();
    // 今天没打卡也从昨天算起，允许"今天还没开始"
    if (!set.has(todayStr())) d.setDate(d.getDate() - 1);
    for (; ;) {
      const p = (x) => String(x).padStart(2, '0');
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      if (set.has(key)) { n++; d.setDate(d.getDate() - 1); } else break;
    }
    return n;
  }

  function last30Dots(checks) {
    const set = new Set(checks || []);
    const out = [];
    const d = new Date();
    d.setDate(d.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      const p = (x) => String(x).padStart(2, '0');
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const on = set.has(key) ? 'on' : '';
      const today = key === todayStr() ? 'today' : '';
      out.push(`<i class="dot ${on} ${today}" data-act="checkToggle" data-ref="${key}" title="${key}"></i>`);
      d.setDate(d.getDate() + 1);
    }
    return `<div class="checks">${out.join('')}</div>`;
  }

  /* ================= 首页 ================= */
  async function home(ctx) {
    const daily = ctx.daily || {};
    const hot = ctx.hot || {};
    const topics = (ctx.liveTopics && ctx.liveTopics.length) ? ctx.liveTopics : (daily.topics || []);
    const isLive = !!(ctx.liveTopics && ctx.liveTopics.length);
    const money = daily.money || [];
    const [docs, plans, posts] = await Promise.all([Store.all('docs'), Store.all('plans'), Store.all('posts')]);
    const allChecks = plans.reduce((a, p) => a.concat(p.checks || []), []);
    const postWeek = posts.filter((p) => p.date && dayDiff(p.date, todayStr()) < 7).length;
    const d = new Date();
    const dateCN = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${'日一二三四五六'[d.getDay()]}`;
    const hour = d.getHours();
    const greet = hour < 6 ? '还没睡呀 🌙' : hour < 11 ? '早上好 ☀️' : hour < 14 ? '中午好 🍚' : hour < 18 ? '下午好 🍵' : '晚上好 🌛';

    const platTabs = [
      ['douyin', '🎵 抖音'], ['weibo', '🔥 微博'], ['zhihu', '💡 知乎'],
      ['bilibili', '📺 B站'], ['baidu', '🔍 百度'], ['toutiao', '📰 头条'],
    ];
    const hotKeys = Object.keys(hot.hot || {});
    const firstPlat = hotKeys[0] || 'douyin';
    const hotListHTML = (key) => {
      const arr = (hot.hot && hot.hot[key]) || [];
      if (!arr.length) return `<div class="empty" style="padding:22px">这个平台暂时没抓到，换一个看看</div>`;
      return `<div class="hotlist">${arr.slice(0, 20).map((x, i) => `
        <div class="hotitem" data-act="pickHot" data-word="${esc(x.word)}">
          <span class="n ${i < 3 ? 'top' : ''}">${i + 1}</span>
          <span class="w">${esc(x.word)}</span>
          <span class="h">${x.hot ? (x.hot / 10000).toFixed(0) + 'w' : ''}</span>
        </div>`).join('')}</div>`;
    };

    const topicCards = topics.slice(0, 8).map((t, i) => `
      <div class="topic" data-act="openTopic" data-id="${esc(t.id)}">
        <div class="idx">${i === 0 ? '🔥 首推' : '#' + (i + 1)}</div>
        <h3>${esc(t.title)}</h3>
        <div class="row" style="gap:6px">
          ${(t.platforms || []).map((p) => `<span class="tag p">${PLAT[p] || p}</span>`).join('')}
          <span class="tag y">${esc(t.angle || '')}</span>
          ${t.copies ? '' : '<span class="tag">现场生成</span>'}
        </div>
        <div class="why">💡 ${esc(t.why || '')}</div>
        <div class="acts">
          <button class="btn btn-primary btn-sm" data-act="openTopic" data-id="${esc(t.id)}">✍️ 写这篇</button>
          <button class="btn btn-sm" data-act="copyTopic" data-id="${esc(t.id)}">📋 复制文案</button>
        </div>
      </div>`).join('');

    return `
    <div class="hero">
      <div class="deco">🌸</div>
      <h2>${greet}</h2>
      <p>${dateCN} · ${topics.length ? `今天 ${topics.length} 个选题、${money.length} 个搞钱路子` : '今天的数据还没更新，先用上次的'}</p>
      <div class="stat-row">
        <div class="stat"><b>${topics.length}</b><span>今日选题</span></div>
        <div class="stat"><b>${docs.length}</b><span>存下的稿</span></div>
        <div class="stat"><b>${streak(allChecks)}</b><span>连续打卡</span></div>
        <div class="stat"><b>${postWeek}</b><span>本周发布</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2>${isLive ? '🔥 热榜现做选题' : '🔥 今日精选选题'}</h2><span class="more" data-act="goRefresh">🔄 换一批</span></div>
      ${topics.length ? topicCards : empty('🌙', '今天还没更新到选题<br>点右上角 🔄 重新抓一次', '<br><button class="btn btn-primary btn-sm" style="margin-top:12px" data-act="goRefresh">立即更新</button>')}
    </div>

    <div class="section">
      <div class="section-head"><h2>📈 实时热榜</h2><span class="more" data-act="goRefresh">抓最新的</span></div>
      <div class="card tight">
        <div class="hotbar" id="hotTabs">
          ${platTabs.map(([k, n], i) => `<span class="chip ${k === firstPlat ? 'active' : ''}" data-act="hotTab" data-key="${k}">${n}</span>`).join('')}
        </div>
        <div id="hotBody">${hotListHTML(firstPlat)}</div>
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:8px;text-align:center">点任意一条 → 直接按这个话题写文案</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2>💰 今天能搞的钱</h2><span class="more" data-act="go" data-view="money">全部</span></div>
      ${money.slice(0, 3).map((m) => `
        <div class="card tight" data-act="openMoney" data-id="${esc(m.id)}" style="cursor:pointer">
          <div class="row" style="justify-content:space-between;align-items:flex-start">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:14.5px;margin-bottom:3px">${esc(m.title)}</div>
              <div style="font-size:12.5px;color:var(--ink-3);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(m.desc)}</div>
            </div>
            <span class="tag g">${esc(m.income || '')}</span>
          </div>
        </div>`).join('') || empty('💰', '还没加载到搞钱项目')}
    </div>

    <div class="section">
      <div class="section-head"><h2>✨ 随手记一笔</h2></div>
      <div class="grid grid-2">
        <div class="card tight" data-act="go" data-view="praise" style="cursor:pointer">
          <div class="card-title">🌸 赞美日记</div><div class="card-sub" style="margin:0">今天也夸夸自己</div>
        </div>
        <div class="card tight" data-act="go" data-view="soul" style="cursor:pointer">
          <div class="card-title">🍃 心灵感悟</div><div class="card-sub" style="margin:0">想到什么写下来</div>
        </div>
      </div>
    </div>`;
  }

  /* ================= 写文案 ================= */
  async function write(ctx) {
    const p = ctx.params || {};
    const mats = (await Store.kvGet('materials', {})) || {};
    const matCount = (mats.stories || []).length + (mats.cases || []).length + (mats.quotes || []).length;
    const topic = p.topic || '';
    const w = (window.App && App.state.write) || {};
    const curPlat = w.plat || 'gongzhonghao';
    const curPts = w.pts || 5;
    const curAngle = w.angle || '';
    return `
    <div class="card">
      <div class="field">
        <label>想写点什么？</label>
        <input class="input" id="topicInput" placeholder="比如：35岁以后要不要考编 / 我用AI做副业第一个月" value="${esc(topic)}">
      </div>
      <div class="row" style="gap:14px;margin-bottom:12px">
        <div style="flex:1;min-width:150px">
          <label style="font-size:12.8px;color:var(--ink-2);font-weight:600;display:block;margin-bottom:6px">发哪个平台</label>
          <div class="row" style="gap:6px" id="platRow">
            ${Object.entries(PLAT).filter(([k]) => k !== 'other').map(([k, v]) => `<span class="chip ${k === curPlat ? 'active' : ''}" data-act="pickPlat" data-key="${k}">${PLAT_EMOJI[k]} ${v}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="row" style="gap:14px;margin-bottom:14px">
        <div>
          <label style="font-size:12.8px;color:var(--ink-2);font-weight:600;display:block;margin-bottom:6px">正文几条</label>
          <div class="row" style="gap:6px" id="ptsRow">
            ${[3, 4, 5, 6].map((n) => `<span class="chip ${n === curPts ? 'active' : ''}" data-act="pickPts" data-key="${n}">${n} 条</span>`).join('')}
          </div>
        </div>
        <div>
          <label style="font-size:12.8px;color:var(--ink-2);font-weight:600;display:block;margin-bottom:6px">开头用哪种钩子</label>
          <div class="row" style="gap:6px" id="angRow">
            <span class="chip ${curAngle === '' ? 'active' : ''}" data-act="pickAngle" data-key="">随机</span>
            <span class="chip ${curAngle === 'contrast' ? 'active' : ''}" data-act="pickAngle" data-key="contrast">反差</span>
            <span class="chip ${curAngle === 'emotion' ? 'active' : ''}" data-act="pickAngle" data-key="emotion">情绪</span>
            <span class="chip ${curAngle === 'suspense' ? 'active' : ''}" data-act="pickAngle" data-key="suspense">悬念</span>
            <span class="chip ${curAngle === 'story' ? 'active' : ''}" data-act="pickAngle" data-key="story">故事</span>
          </div>
        </div>
      </div>
      <div class="row">
        <button class="btn btn-primary" data-act="doGenerate">✨ 开始写</button>
        <button class="btn btn-ghost btn-sm" data-act="go" data-view="settings">🎒 我的素材库 ${matCount ? '(' + matCount + ')' : '(空)'}</button>
      </div>
    </div>
    <div id="genResult"></div>`;
  }

  /* ================= 搞钱项目 ================= */
  async function money(ctx) {
    const list = (ctx.daily && ctx.daily.money) || [];
    const favs = await Store.all('favs');
    const favSet = new Set(favs.map((f) => f.id));
    return `
    <div class="hero" style="background:linear-gradient(125deg,#EAFBF1,#FFF9E3 60%,#FFECF3)">
      <div class="deco">💰</div>
      <h2>真实、门槛低、不卖课</h2>
      <p>只放普通人今天就能开始试的路子。每一笔收益都写清成本、耗时和坑。</p>
    </div>
    ${list.length ? list.map((m) => `
      <div class="topic" data-act="openMoney" data-id="${esc(m.id)}">
        <h3>${esc(m.title)}</h3>
        <div style="font-size:13px;color:var(--ink-2);margin:6px 0 4px">${esc(m.desc)}</div>
        <div class="metas">
          <span class="tag p">${esc(m.level || '')}</span>
          <span class="tag g">💵 ${esc(m.income || '—')}</span>
          <span class="tag y">⏰ ${esc(m.time || '—')}</span>
          <span class="tag">💸 ${esc(m.cost || '—')}</span>
        </div>
        <div class="acts">
          <button class="btn btn-sm btn-primary" data-act="openMoney" data-id="${esc(m.id)}">看看怎么干</button>
          <button class="btn btn-sm btn-ghost" data-act="favMoney" data-id="${esc(m.id)}">${favSet.has(m.id) ? '⭐ 已收藏' : '☆ 收藏'}</button>
        </div>
      </div>`).join('') : empty('🌙', '今天还没更新搞钱项目', '<br><button class="btn btn-primary btn-sm" style="margin-top:12px" data-act="goRefresh">立即更新</button>')}
    <div class="card" style="background:var(--yellow-100);border-color:var(--yellow-200)">
      <div class="card-title">⚠️ 三条铁律</div>
      <div style="font-size:13px;color:var(--ink-2);line-height:1.9">
        1. 先收定金再干活，别垫钱。<br>
        2. 要你先交"加盟费/培训费/保证金"的，一律是坑。<br>
        3. 任何承诺"日入过千""躺赚"的，直接划走。
      </div>
    </div>`;
  }

  /* ================= 赞美日记 ================= */
  async function praise(ctx) {
    const list = (await Store.all('praise')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const todayHas = list.some((x) => x.date === todayStr());
    const grouped = {};
    list.forEach((x) => { (grouped[x.date] = grouped[x.date] || []).push(x); });
    return `
    <div class="hero" style="background:linear-gradient(125deg,#FFF0F5,#F3EAFF 70%,#FFF9E3)">
      <div class="deco">🌸</div>
      <h2>${todayHas ? '今天夸过自己了 ✓' : '今天也值得被夸'}</h2>
      <p>夸自己一句，也夸夸身边的人。写得越具体，越有力量。</p>
    </div>
    <div class="row" style="margin-bottom:16px">
      <button class="btn btn-primary" data-act="addPraise">🌸 写一条</button>
      <span style="font-size:12.5px;color:var(--ink-3)">共 ${list.length} 条 · 连续 ${streak(list.map((x) => x.date))} 天</span>
    </div>
    ${Object.keys(grouped).length ? Object.entries(grouped).map(([date, items]) => `
      <div class="section">
        <div class="section-head"><h2 style="font-size:13.5px;color:var(--ink-3)">${date}${date === todayStr() ? ' · 今天' : ''}</h2></div>
        ${items.map((x) => `
          <div class="card tight">
            <div class="row" style="justify-content:space-between">
              <span class="tag ${x.about === '自己' ? 'p' : 'g'}">${esc(x.about || '自己')}</span>
              <span style="font-size:11.5px;color:var(--ink-3);cursor:pointer" data-act="del" data-store="praise" data-id="${x.id}">删除</span>
            </div>
            <div style="margin-top:8px;font-size:14px;line-height:1.85">${esc(x.text).replace(/\n/g, '<br>')}</div>
          </div>`).join('')}
      </div>`).join('') : empty('🌸', '还没有记录<br>今天先夸自己一句？')}`;
  }

  /* ================= 心灵感悟 ================= */
  async function soul(ctx) {
    const list = (await Store.all('soul')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `
    <div class="hero" style="background:linear-gradient(125deg,#EAFBF1,#F3EAFF 70%,#FFF0F5)">
      <div class="deco">🍃</div>
      <h2>心里那些话</h2>
      <p>不用写得好看。想到什么写什么，写下来就轻一点。</p>
    </div>
    <div class="row" style="margin-bottom:16px">
      <button class="btn btn-primary" data-act="addSoul">🍃 记一条</button>
      <span style="font-size:12.5px;color:var(--ink-3)">共 ${list.length} 条</span>
    </div>
    ${list.length ? list.map((x) => `
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <div style="font-size:12px;color:var(--ink-3)">${x.date}${x.title ? ' · ' + esc(x.title) : ''}</div>
          <span style="font-size:11.5px;color:var(--ink-3);cursor:pointer" data-act="del" data-store="soul" data-id="${x.id}">删除</span>
        </div>
        <div style="font-size:14.3px;line-height:1.95;white-space:pre-wrap">${esc(x.text)}</div>
        ${(x.tags || []).length ? `<div style="margin-top:10px">${x.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      </div>`).join('') : empty('🍃', '还没有感悟<br>今天心里有什么翻涌的吗？')}`;
  }

  /* ================= 成长计划 ================= */
  async function plan(ctx) {
    const list = await Store.all('plans');
    const active = list.filter((p) => !p.done);
    const doneList = list.filter((p) => p.done);
    const card = (p) => {
      const steps = p.steps || [];
      const doneSteps = steps.filter((s) => s.done).length;
      const pct = steps.length ? Math.round((doneSteps / steps.length) * 100) : 0;
      const st = streak(p.checks || []);
      return `
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div class="card-title">${p.done ? '✅' : '🌱'} ${esc(p.title)}</div>
            ${p.why ? `<div class="card-sub" style="margin-bottom:8px">为什么：${esc(p.why)}</div>` : ''}
          </div>
          <span style="font-size:11.5px;color:var(--ink-3);cursor:pointer;white-space:nowrap" data-act="planMenu" data-id="${p.id}">⋯</span>
        </div>
        ${steps.length ? `
          <div class="row" style="justify-content:space-between;font-size:12px;color:var(--ink-3);margin-bottom:5px">
            <span>步骤 ${doneSteps}/${steps.length}</span><span>${pct}%</span>
          </div>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div style="margin-top:10px">
            ${steps.map((s, i) => `<div class="row" style="gap:8px;padding:4px 0;font-size:13.3px;cursor:pointer" data-act="toggleStep" data-id="${p.id}" data-i="${i}">
              <span style="font-size:15px">${s.done ? '✅' : '⬜️'}</span>
              <span style="flex:1;${s.done ? 'color:var(--ink-3);text-decoration:line-through' : ''}">${esc(s.text)}</span>
            </div>`).join('')}
          </div>` : ''}
        <div style="margin-top:12px;font-size:12px;color:var(--ink-3)">打卡 ${(p.checks || []).length} 天 · 连续 ${st} 天</div>
        ${last30Dots(p.checks)}
      </div>`;
    };
    return `
    <div class="hero" style="background:linear-gradient(125deg,#EAFBF1,#FFF9E3 70%,#F3EAFF)">
      <div class="deco">🌱</div>
      <h2>一点一点长出来</h2>
      <p>计划不在多，在每天真的有动。点方格就能打卡。</p>
    </div>
    <div class="row" style="margin-bottom:16px">
      <button class="btn btn-primary" data-act="addPlan">🌱 新建计划</button>
      <span style="font-size:12.5px;color:var(--ink-3)">进行中 ${active.length} · 已完成 ${doneList.length}</span>
    </div>
    ${active.length ? active.map(card).join('') : empty('🌱', '还没有进行中的计划<br>先定一个小的？比如"每天读 10 页"')}
    ${doneList.length ? `<div class="section"><div class="section-head"><h2>✅ 已经完成的</h2></div>${doneList.map(card).join('')}</div>` : ''}`;
  }

  /* ================= 发布记录 ================= */
  /* 台账：内容类型 / 发布时段（固定标签，才好做聚合） */
  const POST_TYPES = ['干货教程', '经验分享', '日常记录', '测评', '热点蹭流'];
  const POST_SLOTS = ['早7-9', '午12-14', '晚20-22', '其他'];

  const interRate = (p) => {
    const v = Number(p.views) || 0;
    if (!v) return null;
    const i = (Number(p.likes) || 0) + (Number(p.comments) || 0);
    return i / v;
  };
  const pct = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');
  const num = (x) => (x > 10000 ? (x / 10000).toFixed(1) + 'w' : String(Math.round(x)));

  /* 聚合：篇数 / 平均阅读 / 平均互动率 / 爆款数 */
  function aggregate(list, keyFn, hotLine) {
    const map = new Map();
    for (const p of list) {
      const k = keyFn(p) || '未记录';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    }
    const rows = [];
    for (const [k, arr] of map) {
      const views = arr.map((p) => Number(p.views) || 0);
      const avgV = views.reduce((a, b) => a + b, 0) / arr.length;
      const rates = arr.map(interRate).filter((x) => x != null);
      const avgR = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
      rows.push({
        key: k, count: arr.length, avgV,
        avgR, hot: arr.filter((p) => (Number(p.views) || 0) > hotLine).length,
      });
    }
    rows.sort((a, b) => b.avgV - a.avgV);
    return rows;
  }

  function aggTable(title, icon, rows, hotLine) {
    if (!rows.length) return '';
    const maxV = Math.max(...rows.map((r) => r.avgV)) || 1;
    return `
      <div class="card">
        <div class="card-title">${icon} ${title}</div>
        <div class="card-sub">按平均阅读排序 · 点一行看这类内容的全部</div>
        <div class="agg">
          <div class="agg-h">
            <span class="c1">分类</span><span class="c2">篇数</span><span class="c3">平均阅读</span><span class="c4">互动率</span><span class="c5">爆款</span>
          </div>
          ${rows.map((r) => `
            <div class="agg-r" data-act="filterPosts" data-key="${esc(r.key)}">
              <span class="c1"><b>${esc(r.key)}</b><i class="agg-bar" style="width:${Math.round(r.avgV / maxV * 100)}%"></i></span>
              <span class="c2">${r.count}</span>
              <span class="c3">${num(r.avgV)}</span>
              <span class="c4">${pct(r.avgR)}</span>
              <span class="c5">${r.hot || '—'}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  async function posts(ctx) {
    const all = (await Store.all('posts')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const range = (ctx.params && ctx.params.range) || 'all';
    const filterKey = ctx.params && ctx.params.key;

    // 近 30 天
    let list = all;
    if (range === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      const lim = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      list = all.filter((p) => (p.date || '') >= lim);
    }

    // 基准线：用「全部」数据算均值和爆款线，切换时间范围不影响判定
    const allViews = all.map((p) => Number(p.views) || 0);
    const avgAll = allViews.length ? allViews.reduce((a, b) => a + b, 0) / allViews.length : 0;
    const hotLine = avgAll * 2;

    const totalViews = list.reduce((a, b) => a + (Number(b.views) || 0), 0);
    const rates = list.map(interRate).filter((x) => x != null);
    const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    const hotCount = list.filter((p) => (Number(p.views) || 0) > hotLine).length;

    const byType = aggregate(list, (p) => p.type, hotLine);
    const bySlot = aggregate(list, (p) => p.slot, hotLine);
    const hots = list.filter((p) => (Number(p.views) || 0) > hotLine);

    // 按分类筛选后的明细
    const shown = filterKey
      ? list.filter((p) => (p.type || '未记录') === filterKey || (p.slot || '未记录') === filterKey)
      : list;

    const recRow = (p) => {
      const r = interRate(p);
      const isHot = (Number(p.views) || 0) > hotLine;
      return `
      <div class="rec">
        <div class="rec-top">
          <div class="rec-title">${isHot ? '🔥 ' : ''}${esc(p.title)}</div>
          <span class="rec-edit" data-act="editPost" data-id="${p.id}">编辑</span>
        </div>
        <div class="rec-meta">
          <span>${PLAT_EMOJI[p.platform] || '📎'} ${PLAT[p.platform] || '其它'}</span>
          <span>${p.date || ''}</span>
          ${p.type ? `<span class="tag g">${esc(p.type)}</span>` : '<span class="tag" style="opacity:.6">未分类</span>'}
          ${p.slot ? `<span class="tag y">${esc(p.slot)}</span>` : ''}
        </div>
        <div class="rec-nums">
          <span>👀 ${num(Number(p.views) || 0)}</span>
          <span>❤️ ${Number(p.likes) || 0}</span>
          <span>💬 ${Number(p.comments) || 0}</span>
          <span class="rec-rate ${r == null ? '' : r >= 0.03 ? 'good' : ''}">互动率 ${pct(r)}</span>
        </div>
        ${p.notes ? `<div class="rec-note">📝 ${esc(p.notes)}</div>` : ''}
      </div>`;
    };

    return `
    <div class="hero" style="background:linear-gradient(125deg,#FFF0F5,#F3EAFF 60%,#EAFBF1)">
      <div class="deco">📤</div>
      <h2>发布台账</h2>
      <p>${all.length ? `共 ${all.length} 条 · 爆款线是平均阅读的 2 倍（${num(hotLine)}）` : '记下来才知道哪种内容真的有人看'}</p>
      <div class="stat-row">
        <div class="stat"><b>${list.length}</b><span>${range === 'month' ? '近30天' : '总发布'}</span></div>
        <div class="stat"><b>${num(totalViews)}</b><span>总阅读</span></div>
        <div class="stat"><b>${pct(avgRate)}</b><span>平均互动率</span></div>
        <div class="stat"><b>${hotCount}</b><span>爆款</span></div>
      </div>
    </div>

    <div class="row" style="margin-bottom:14px;gap:8px">
      <button class="btn btn-primary" data-act="addPost">📤 记一条</button>
      <span class="chip ${range === 'all' ? 'active' : ''}" data-act="postRange" data-key="all">全部</span>
      <span class="chip ${range === 'month' ? 'active' : ''}" data-act="postRange" data-key="month">近30天</span>
    </div>

    ${all.length ? `
      ${aggTable('哪类内容更受欢迎', '📊', byType, hotLine)}
      ${aggTable('哪个时段发更好', '⏰', bySlot, hotLine)}
      ${hots.length ? `
      <div class="card">
        <div class="card-title">🔥 爆款（超均值 2 倍）</div>
        <div class="card-sub">这些值得单独拆一次结构</div>
        ${hots.slice(0, 5).map((p) => `<div class="hot-line" data-act="filterPosts" data-key="${esc(p.type || '未记录')}">
          <span class="hl-t">${esc(p.title)}</span><span class="hl-v">${num(Number(p.views) || 0)}</span>
        </div>`).join('')}
      </div>` : ''}
    ` : ''}

    <div class="section-head" style="margin-top:18px">
      <h2>📋 ${filterKey ? esc(filterKey) + ' · ' + shown.length + ' 条' : '全部记录'}</h2>
      ${filterKey ? `<span class="more" data-act="postRange" data-key="${range}">看全部</span>` : ''}
    </div>
    ${shown.length ? shown.map(recRow).join('') : empty('📤', all.length ? '这个分类下还没有记录' : '还没记录发布<br>发完一条就回来记一下')}`;
  }

  /* ================= 读书 ================= */
  async function books(ctx) {
    const list = await Store.all('books');
    const reading = list.filter((b) => b.status !== '读完');
    const read = list.filter((b) => b.status === '读完');
    const card = (b) => `
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div class="card-title">📖 《${esc(b.title)}》</div>
            <div class="card-sub" style="margin-bottom:6px">${esc(b.author || '佚名')} · ${esc(b.status || '在读')}</div>
          </div>
          <span style="font-size:11.5px;color:var(--ink-3);cursor:pointer" data-act="del" data-store="books" data-id="${b.id}">删除</span>
        </div>
        <div class="row" style="justify-content:space-between;font-size:12px;color:var(--ink-3);margin-bottom:5px"><span>进度</span><span>${b.progress || 0}%</span></div>
        <div class="bar y"><i style="width:${b.progress || 0}%"></i></div>
        ${b.quotes ? `<div style="margin-top:11px;font-size:13px;background:var(--yellow-100);border-radius:12px;padding:10px 12px;color:#7A5300;line-height:1.85">“${esc(b.quotes).slice(0, 160)}”</div>` : ''}
        ${b.notes ? `<div style="margin-top:9px;font-size:13px;color:var(--ink-2);line-height:1.85">${esc(b.notes).replace(/\n/g, '<br>')}</div>` : ''}
        <div class="row" style="margin-top:11px;gap:7px">
          <button class="btn btn-sm" data-act="editBook" data-id="${b.id}">✏️ 更新进度</button>
          <button class="btn btn-sm btn-ghost" data-act="bookToDoc" data-id="${b.id}">📄 生成读书笔记</button>
        </div>
      </div>`;
    return `
    <div class="hero" style="background:linear-gradient(125deg,#FFF9E3,#FFF0F5 60%,#F3EAFF)">
      <div class="deco">📚</div>
      <h2>今年读了几本？</h2>
      <p>读完 ${read.length} 本 · 在读 ${reading.length} 本。读一本记一句，比读完就忘强。</p>
    </div>
    <div class="row" style="margin-bottom:16px"><button class="btn btn-primary" data-act="addBook">📚 加一本书</button></div>
    ${reading.length ? `<div class="section"><div class="section-head"><h2>📖 在读</h2></div>${reading.map(card).join('')}</div>` : ''}
    ${read.length ? `<div class="section"><div class="section-head"><h2>✅ 读完了</h2></div>${read.map(card).join('')}</div>` : ''}
    ${!list.length ? empty('📚', '书架还空着<br>加一本你最近想读的') : ''}`;
  }

  /* ================= 技能学习 ================= */
  async function skills(ctx) {
    const list = await Store.all('skills');
    const totalHours = list.reduce((a, b) => a + (Number(b.hours) || 0), 0);
    return `
    <div class="hero" style="background:linear-gradient(125deg,#F3EAFF,#EAFBF1 70%,#FFF9E3)">
      <div class="deco">🎯</div>
      <h2>练一个能换钱的技能</h2>
      <p>${list.length} 个技能 · 累计 ${totalHours} 小时。每天记一笔，看得见自己在长。</p>
    </div>
    <div class="row" style="margin-bottom:16px"><button class="btn btn-primary" data-act="addSkill">🎯 加一个技能</button></div>
    ${list.length ? list.map((s) => {
      const logs = (s.logs || []).slice().reverse();
      return `
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <div class="card-title">🎯 ${esc(s.name)}</div>
            <div class="card-sub" style="margin-bottom:4px">${s.goal ? '目标：' + esc(s.goal) + ' · ' : ''}累计 ${s.hours || 0} 小时 · 打卡 ${(s.logs || []).length} 次</div>
          </div>
          <span style="font-size:11.5px;color:var(--ink-3);cursor:pointer" data-act="del" data-store="skills" data-id="${s.id}">删除</span>
        </div>
        <div style="margin-top:11px">
          ${logs.slice(0, 5).map((l) => `<div style="font-size:13px;color:var(--ink-2);padding:5px 0;border-top:1px dashed var(--line)"><span style="color:var(--ink-3);font-size:11.5px">${l.date}</span>　${esc(l.text)} <span class="tag y">${l.hours || 0}h</span></div>`).join('') || '<div style="font-size:12.5px;color:var(--ink-3)">还没有练习记录</div>'}
        </div>
        <button class="btn btn-sm btn-primary" style="margin-top:11px" data-act="logSkill" data-id="${s.id}">＋ 记一次练习</button>
      </div>`;
    }).join('') : empty('🎯', '还没有在学的技能<br>想练什么？剪辑、写作、烘焙都算')}`;
  }

  /* ================= 我的文档 ================= */
  async function docs(ctx) {
    const list = (await Store.all('docs')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const kw = (ctx.params && ctx.params.q) || '';
    const filtered = kw ? list.filter((d) => (d.title + d.content).includes(kw)) : list;
    return `
    <div class="row" style="margin-bottom:14px;gap:8px">
      <button class="btn btn-primary" data-act="addDoc">📝 写新文章</button>
      <button class="btn btn-ghost btn-sm" data-act="exportMd">⬇️ 导出全部</button>
    </div>
    <div class="card tight">
      <input class="input" id="docSearch" placeholder="🔍 搜标题或正文…" value="${esc(kw)}" data-act="searchDoc" style="border:none;background:var(--lav-50)">
    </div>
    ${filtered.length ? filtered.map((d) => `
      <div class="card tight" data-act="openDoc" data-id="${d.id}" style="cursor:pointer">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14.5px;margin-bottom:4px">${esc(d.title || '无标题')}</div>
            <div style="font-size:12.5px;color:var(--ink-3);overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical">${esc((d.content || '').replace(/[#*>\n]/g, ' ').slice(0, 80))}</div>
          </div>
          <span class="tag ${d.platform === 'xiaohongshu' ? 'p' : d.platform === 'gongzhonghao' ? 'g' : 'y'}">${PLAT[d.platform] || '随手记'}</span>
        </div>
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:7px">${(d.updatedAt || '').slice(0, 16).replace('T', ' ')} · ${(d.content || '').length} 字</div>
      </div>`).join('') : empty('📄', kw ? '没搜到相关内容' : '还没有文章<br>点上面「写新文章」开始')}`;
  }

  /* ================= 设置 ================= */
  async function settings(ctx) {
    const mats = (await Store.kvGet('materials', {})) || {};
    const line = (arr) => (arr || []).join('\n');
    return `
    <div class="card">
      <div class="card-title">🎒 我的素材库</div>
      <div class="card-sub">填进去的东西会直接进文案里。填得越具体，写出来越不像 AI。</div>
      <div class="field">
        <label>我的真实经历（一行一个，比如"我去年在县城开过三个月奶茶店，赔了两万"）</label>
        <textarea class="textarea" id="matStories" rows="4" placeholder="一行一个">${esc(line(mats.stories))}</textarea>
      </div>
      <div class="field">
        <label>我见过的真实案例（一行一个）</label>
        <textarea class="textarea" id="matCases" rows="3" placeholder="一行一个">${esc(line(mats.cases))}</textarea>
      </div>
      <div class="field">
        <label>我喜欢的金句 / 引用（一行一个）</label>
        <textarea class="textarea" id="matQuotes" rows="3" placeholder="一行一个">${esc(line(mats.quotes))}</textarea>
      </div>
      <button class="btn btn-primary" data-act="saveMaterials">保存素材库</button>
    </div>

    <div class="card">
      <div class="card-title">💾 数据备份</div>
      <div class="card-sub">数据存在你手机/电脑本地，不上传任何服务器。换设备或清缓存前请先导出。</div>
      <div class="row">
        <button class="btn btn-green" data-act="exportAll">⬇️ 导出备份（JSON）</button>
        <button class="btn" data-act="exportMd">📄 导出全文（Markdown）</button>
        <button class="btn btn-ghost" data-act="importAll">⬆️ 导入备份</button>
        <input type="file" id="fileInput" accept=".json" style="display:none">
      </div>
    </div>

    <div class="card">
      <div class="card-title">🔄 数据更新</div>
      <div class="card-sub">每天早晨自动抓一次热榜。没网或没抓到，就显示上一次的数据。</div>
      <div class="row" style="margin-bottom:10px">
        <span class="tag ${ctx.daily && ctx.daily.date === todayStr() ? 'g' : 'y'}">${ctx.daily ? '选题数据：' + ctx.daily.date : '还没数据'}</span>
        <span class="tag ${ctx.hot && ctx.hot.ok ? 'g' : 'y'}">${ctx.hot ? '热榜：' + (ctx.hot.updatedAt || '').slice(0, 16).replace('T', ' ') : '还没抓过'}</span>
      </div>
      <button class="btn btn-primary" data-act="goRefresh">立即更新一次</button>
    </div>

    <div class="card">
      <div class="card-title">📱 装到手机桌面</div>
      <div style="font-size:13.2px;color:var(--ink-2);line-height:2">
        <b>iPhone（Safari）</b>：点底部「分享」→「添加到主屏幕」<br>
        <b>安卓（Chrome/Edge）</b>：右上角 ⋮ →「安装应用」或「添加到主屏幕」<br>
        <span style="color:var(--ink-3)">装好后有独立图标，全屏打开，跟 App 一样。</span>
      </div>
    </div>

    <div class="card" style="background:var(--pink-100);border-color:var(--pink-200)">
      <div class="card-title">🧹 危险区</div>
      <div class="row" style="margin-top:8px">
        <button class="btn btn-ghost btn-sm" data-act="clearAll" style="color:#C4536F">清空全部数据</button>
      </div>
    </div>`;
  }

  window.Views = { home, write, money, praise, soul, plan, posts, books, skills, docs, settings };
  window.ViewUtil = { esc, todayStr, streak, PLAT, PLAT_EMOJI, empty, last30Dots, POST_TYPES, POST_SLOTS };
})();
