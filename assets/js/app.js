/* ===== 应用主控：路由 · 状态 · 事件 · 表单 ===== */
(function () {
  'use strict';

  const { esc, todayStr, PLAT } = window.ViewUtil;

  const App = {
    state: {
      view: 'home',
      params: {},
      daily: null,
      hot: null,
      liveTopics: null,     // 从热榜现做的选题
      write: { plat: 'gongzhonghao', pts: 5, angle: '', topic: '', result: null, preset: null },
    },
  };

  /* ---------- 工具 ---------- */
  function toast(msg, ms) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), ms || 1900);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* 回退 */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch (e) { return false; }
  }

  /* ---------- 弹层 ---------- */
  function modal({ title, body, foot }) {
    document.getElementById('modalTitle').textContent = title || '';
    document.getElementById('modalBody').innerHTML = body || '';
    document.getElementById('modalFoot').innerHTML = foot || '';
    document.getElementById('modal').classList.add('show');
    const first = document.querySelector('#modalBody input, #modalBody textarea');
    if (first && window.innerWidth > 820) setTimeout(() => first.focus(), 60);
  }
  function closeModal() { document.getElementById('modal').classList.remove('show'); }

  /* ---------- 表单弹层 ---------- */
  function form({ title, fields, values = {}, submitText = '保存', onSubmit }) {
    const html = fields.map((f) => {
      const v = values[f.name] != null ? values[f.name] : (f.value || '');
      let input;
      if (f.type === 'textarea') {
        input = `<textarea class="textarea" data-f="${f.name}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
      } else if (f.type === 'select') {
        input = `<select class="select" data-f="${f.name}">${(f.options || []).map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const lab = typeof o === 'string' ? o : o.label;
          return `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(lab)}</option>`;
        }).join('')}</select>`;
      } else if (f.type === 'number') {
        input = `<input class="input" type="number" data-f="${f.name}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}">`;
      } else if (f.type === 'date') {
        input = `<input class="input" type="date" data-f="${f.name}" value="${esc(v || todayStr())}">`;
      } else {
        input = `<input class="input" data-f="${f.name}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}">`;
      }
      return `<div class="field"><label>${esc(f.label)}</label>${input}</div>`;
    }).join('');

    modal({
      title,
      body: html,
      foot: `<button class="btn btn-ghost" data-act="closeModal">取消</button><button class="btn btn-primary" id="formSubmit">${esc(submitText)}</button>`,
    });

    const submit = () => {
      const out = {};
      document.querySelectorAll('#modalBody [data-f]').forEach((el) => {
        const f = fields.find((x) => x.name === el.dataset.f);
        let val = el.value;
        if (f && f.type === 'number') val = Number(val) || 0;
        if (f && f.type === 'lines') val = val.split('\n').map((s) => s.trim()).filter(Boolean);
        out[el.dataset.f] = val;
      });
      const missing = fields.filter((f) => f.required && !String(out[f.name] || '').trim());
      if (missing.length) { toast('「' + missing[0].label + '」还没填'); return; }
      closeModal();
      onSubmit(out);
    };
    document.getElementById('formSubmit').onclick = submit;
  }

  function confirmBox(text, onOk) {
    modal({
      title: '确认一下',
      body: `<div style="font-size:14px;line-height:1.85;color:var(--ink-2);padding:4px 0 10px">${esc(text)}</div>`,
      foot: `<button class="btn btn-ghost" data-act="closeModal">取消</button><button class="btn btn-primary" id="okBtn">确定</button>`,
    });
    document.getElementById('okBtn').onclick = () => { closeModal(); onOk(); };
  }

  /* ---------- 数据加载 ---------- */
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function loadDaily() {
    try {
      const j = await fetchJSON('/api/daily');
      localStorage.setItem('cache_daily', JSON.stringify(j));
      return j;
    } catch (e) { /* 静态托管或离线 */ }
    try {
      const j = await fetchJSON('data/daily.json');
      localStorage.setItem('cache_daily', JSON.stringify(j));
      return j;
    } catch (e) { /* 再用缓存 */ }
    try { return JSON.parse(localStorage.getItem('cache_daily')); } catch (e) { return null; }
  }

  async function loadHot(force) {
    try {
      const j = await fetchJSON('/api/hot' + (force ? '?force=1' : ''));
      if (j && j.ok) { localStorage.setItem('cache_hot', JSON.stringify(j)); return j; }
    } catch (e) { /* 静态托管或离线 */ }
    try {
      const j = await fetchJSON('data/hot.json' + (force ? '?t=' + Date.now() : ''));
      if (j) { localStorage.setItem('cache_hot', JSON.stringify(j)); return j; }
    } catch (e) { /* 再用缓存 */ }
    try { return JSON.parse(localStorage.getItem('cache_hot')); } catch (e) { return null; }
  }

  function updateSyncBar() {
    const dot = document.getElementById('syncDot');
    const txt = document.getElementById('syncText');
    const d = App.state.daily;
    const h = App.state.hot;
    const today = todayStr();
    if (d && d.date === today) {
      dot.className = 'sync-dot';
      txt.textContent = '今日数据已更新';
    } else if (d && App.state.liveTopics) {
      dot.className = 'sync-dot stale';
      txt.textContent = '选题走今日热榜';
    } else if (d) {
      dot.className = 'sync-dot stale';
      txt.textContent = '显示 ' + d.date + ' 的数据';
    } else if (h && h.ok) {
      dot.className = 'sync-dot stale';
      txt.textContent = '热榜已连上';
    } else {
      dot.className = 'sync-dot off';
      txt.textContent = '离线 · 用缓存';
    }
  }

  /* ---------- 路由 ---------- */
  const TITLES = {
    home: '首页选题', write: '写文案', money: '搞钱项目', praise: '赞美日记',
    soul: '心灵感悟', plan: '成长计划', posts: '发布台账', books: '读书',
    skills: '技能学习', docs: '我的文档', settings: '设置',
  };

  async function go(view, params = {}, noPush) {
    App.state.view = view;
    App.state.params = params;
    document.getElementById('nav').querySelectorAll('.nav-item').forEach((a) => {
      a.classList.toggle('active', a.dataset.view === view);
    });
    document.querySelectorAll('.tabbar a').forEach((a) => {
      a.classList.toggle('active', a.dataset.view === view);
    });
    document.getElementById('viewTitle').textContent = TITLES[view] || '';
    document.getElementById('app').classList.remove('nav-open');
    if (!noPush) history.replaceState({ view, params }, '', '#' + view);

    const v = document.getElementById('view');
    v.innerHTML = `<div class="skeleton" style="height:130px;margin-bottom:14px"></div><div class="skeleton" style="height:90px;margin-bottom:14px"></div><div class="skeleton" style="height:90px"></div>`;
    try {
      const html = await window.Views[view]({
        daily: App.state.daily,
        hot: App.state.hot,
        params: App.state.params,
        liveTopics: App.state.liveTopics,
      });
      v.innerHTML = html;
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      if (view === 'write') {
        document.getElementById('topicInput').value = App.state.write.topic || '';
        if (App.state.write.result) renderResult();
      }
    } catch (e) {
      console.error(e);
      v.innerHTML = `<div class="empty">页面加载出错：${esc(e.message)}</div>`;
    }
  }

  /* ---------- 文案渲染 ---------- */
  function currentCopy() {
    const w = App.state.write;
    const r = w.result;
    if (!r) return null;
    const preset = w.preset;
    if (preset && preset.copies && preset.copies[w.plat]) {
      return { ...preset.copies[w.plat], platform: w.plat, topic: r.topic };
    }
    return r;
  }

  /* 合规检查面板 */
  function riskPanelHTML(list, showOk) {
    if (!list.length) {
      return showOk ? `<div class="risk-panel ok"><div class="risk-head"><span class="risk-count">✅ 没检出明显的风险词</span></div></div>` : '';
    }
    return `
      <div class="risk-panel">
        <div class="risk-head">
          <span class="risk-count">⚠️ 检测到 ${list.length} 类风险表述</span>
          <span class="risk-sub">小红书最严，公众号次之</span>
        </div>
        <div class="risk-list">
          ${list.slice(0, 10).map((r) => `
            <div class="risk-item">
              <span class="risk-badge ${r.level}">${Sensitive.LEVEL_NAME[r.level]}</span>
              <div class="risk-main">
                <div><span class="risk-word">${esc(r.word)}</span>${r.count > 1 ? `<span class="risk-times">×${r.count}</span>` : ''} <span class="risk-arrow">→</span> <span class="risk-alt">${esc(r.alt || '换个说法')}</span></div>
                <div class="risk-tip">${esc(r.tip || '')} · ${esc(r.cat)}</div>
              </div>
            </div>`).join('')}
        </div>
        ${list.length > 10 ? `<div class="risk-more">还有 ${list.length - 10} 类，先改高危的</div>` : ''}
      </div>`;
  }

  function renderResult() {
    const box = document.getElementById('genResult');
    if (!box) return;
    const w = App.state.write;
    const c = currentCopy();
    if (!c) { box.innerHTML = ''; return; }

    const titles = c.titles || [];
    const body = c.body || '';
    const tags = c.tags || [];
    const full = `【标题备选】\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n【正文】\n${body}\n\n${tags.join(' ')}`;
    const fromPreset = !!(w.preset && w.preset.copies && w.preset.copies[w.plat]);

    // 合规检查：正文高亮 + 标题/正文汇总提示
    const bodyHits = Sensitive.check(body);
    const titleHits = titles.reduce((a, t) => a.concat(Sensitive.check(t)), []);
    const riskList = Sensitive.summary(bodyHits.concat(titleHits));
    const bodyHTML = Sensitive.highlightHTML(body, bodyHits);
    const riskPanel = riskPanelHTML(riskList, true);

    box.innerHTML = `
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:10px">
          <div class="card-title" style="margin:0">📝 ${PLAT[c.platform] || ''} 文案${fromPreset ? ' · 今日精选' : ' · 即时生成'}</div>
          <button class="btn btn-sm btn-ghost" data-act="doGenerate">🔄 换一版</button>
        </div>

        <div style="font-size:12.5px;color:var(--ink-3);margin-bottom:7px">标题备选（点一条直接复制）· 共 ${titles.length} 条</div>
        ${titles.map((t, i) => `<div class="title-opt" data-act="copyOne" data-text="${esc(t)}"><span class="num">${i + 1}</span><span class="txt">${esc(t)}</span><span style="font-size:11px;color:var(--ink-3)">复制</span></div>`).join('')}

        <div style="font-size:12.5px;color:var(--ink-3);margin:15px 0 7px">正文${c.points ? ` · 说 ${c.points} 条就写 ${c.points} 条` : ''}</div>
        <div class="copy-block">${bodyHTML}</div>

        <div style="margin-top:12px">${tags.map((t) => `<span class="tag p">${esc(t)}</span>`).join('')}</div>

        ${riskPanel}

        <div class="row" style="margin-top:16px;gap:8px">
          <button class="btn btn-primary" data-act="copyFull">📋 复制全文</button>
          <button class="btn btn-green" data-act="saveDoc">💾 存到文档</button>
          <button class="btn btn-yellow" data-act="markPosted">📤 记入发布</button>
          <button class="btn btn-sm btn-ghost" data-act="checkMore">🔍 检查别的文字</button>
        </div>
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:10px;line-height:1.7">
          💡 想让文案更像你：去「设置 → 我的素材库」填 3 条真实经历，再生成一次。
        </div>
      </div>`;
  }

  /* 用实时热榜现场合成选题（daily.json 没更新时的兜底） */
  function buildLiveTopics(picks) {
    const SRC = { douyin: '抖音', bilibili: 'B站', baidu: '百度', toutiao: '头条', weibo: '微博', zhihu: '知乎' };
    return (picks || []).slice(0, 12).map((p, i) => ({
      id: 'h' + i,
      title: p.word,
      platforms: ['gongzhonghao', 'xiaohongshu', 'shipinhao'],
      angle: p.hits ? '高热度' : '潜力',
      why: `来自${SRC[p.platform] || '热榜'}，热度 ${((p.hot || 0) / 10000).toFixed(0)}w。${p.hits ? '和普通人生活贴得近，容易共情。' : '可以借这个点切进你的领域。'}`,
      from: 'hot',
    }));
  }

  /* ---------- 动作 ---------- */
  const Actions = {
    closeModal() { closeModal(); },

    go(el) { go(el.dataset.view); },

    async goRefresh() {
      toast('正在抓取最新热榜…');
      const hot = await loadHot(true);
      App.state.hot = hot;
      const picks = (hot && hot.picks) || [];
      if (picks.length) App.state.liveTopics = buildLiveTopics(picks);
      updateSyncBar();
      await go(App.state.view, App.state.params, true);
      toast(picks.length ? `抓到 ${picks.length} 条可用热词` : '没抓到新数据，继续用上次的');
    },

    hotTab(el) {
      document.querySelectorAll('#hotTabs .chip').forEach((c) => c.classList.remove('active'));
      el.classList.add('active');
      const key = el.dataset.key;
      const hot = App.state.hot || {};
      const arr = (hot.hot && hot.hot[key]) || [];
      document.getElementById('hotBody').innerHTML = arr.length
        ? `<div class="hotlist">${arr.slice(0, 20).map((x, i) => `
            <div class="hotitem" data-act="pickHot" data-word="${esc(x.word)}">
              <span class="n ${i < 3 ? 'top' : ''}">${i + 1}</span>
              <span class="w">${esc(x.word)}</span>
              <span class="h">${x.hot ? (x.hot / 10000).toFixed(0) + 'w' : ''}</span>
            </div>`).join('')}</div>`
        : `<div class="empty" style="padding:22px">这个平台暂时没抓到，换一个看看</div>`;
    },

    pickHot(el) {
      const word = el.dataset.word;
      App.state.write.topic = word;
      App.state.write.preset = null;
      App.state.write.result = null;
      go('write', { topic: word }).then(() => {
        document.getElementById('topicInput').value = word;
        toast('已填入话题，点「开始写」');
      });
    },

    async openTopic(el) {
      const id = el.dataset.id;
      const all = [...((App.state.daily && App.state.daily.topics) || []), ...(App.state.liveTopics || [])];
      const t = all.find((x) => x.id === id);
      if (!t) return;
      App.state.write.topic = t.title;
      if (t.copies) {
        App.state.write.preset = t;
        App.state.write.result = { topic: t.title };
        const plats = Object.keys(t.copies);
        App.state.write.plat = plats.includes(App.state.write.plat) ? App.state.write.plat : (plats[0] || 'gongzhonghao');
      } else {
        // 热榜现做的选题：立刻用引擎写一版
        const mats = await Store.kvGet('materials', {});
        App.state.write.preset = null;
        App.state.write.result = CopyGen.generate({ topic: t.title, platform: App.state.write.plat, points: App.state.write.pts, materials: mats });
      }
      go('write', { topic: t.title });
    },

    async copyTopic(el) {
      const id = el.dataset.id;
      const all = [...((App.state.daily && App.state.daily.topics) || []), ...(App.state.liveTopics || [])];
      const t = all.find((x) => x.id === id);
      if (!t) return;
      if (t.copies) {
        const p = Object.keys(t.copies)[0];
        const c = t.copies[p];
        await copyText(`${c.titles.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n${c.body}\n\n${(c.tags || []).join(' ')}`);
        toast('已复制 ' + (PLAT[p] || '') + ' 文案');
      } else {
        const r = CopyGen.generate({ topic: t.title, platform: 'gongzhonghao', points: 5, materials: await Store.kvGet('materials', {}) });
        await copyText(`${r.titles.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n${r.body}\n\n${r.tags.join(' ')}`);
        toast('已复制文案');
      }
    },

    pickPlat(el) {
      document.querySelectorAll('#platRow .chip').forEach((c) => c.classList.remove('active'));
      el.classList.add('active');
      const w = App.state.write;
      w.plat = el.dataset.key;
      // 今日精选只备了部分平台，切到没备的就现场生成一版
      if (w.preset && !(w.preset.copies && w.preset.copies[w.plat])) {
        w.preset = null;
        Store.kvGet('materials', {}).then((m) => {
          w.result = CopyGen.generate({ topic: w.topic, platform: w.plat, points: w.pts, materials: m });
          renderResult();
        });
        return;
      }
      if (w.result) renderResult();
    },

    pickPts(el) {
      document.querySelectorAll('#ptsRow .chip').forEach((c) => c.classList.remove('active'));
      el.classList.add('active');
      App.state.write.pts = Number(el.dataset.key);
    },

    pickAngle(el) {
      document.querySelectorAll('#angRow .chip').forEach((c) => c.classList.remove('active'));
      el.classList.add('active');
      App.state.write.angle = el.dataset.key;
    },

    async doGenerate() {
      const topic = (document.getElementById('topicInput') || {}).value || App.state.write.topic;
      if (!topic || !topic.trim()) { toast('先写个话题吧'); return; }
      const w = App.state.write;
      w.topic = topic.trim();
      w.preset = null;
      const mats = await Store.kvGet('materials', {});
      w.result = CopyGen.generate({ topic: w.topic, platform: w.plat, points: w.pts, angle: w.angle || undefined, materials: mats });
      renderResult();
      document.getElementById('genResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('写好了 · ' + w.pts + ' 条');
    },

    async copyOne(el) {
      const ok = await copyText(el.dataset.text);
      toast(ok ? '标题已复制' : '复制失败，长按手动复制');
    },

    async copyFull() {
      const c = currentCopy();
      if (!c) return;
      const text = `【标题备选】\n${(c.titles || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n【正文】\n${c.body}\n\n${(c.tags || []).join(' ')}`;
      const ok = await copyText(text);
      toast(ok ? '全文已复制，去粘贴吧 ✨' : '复制失败');
    },

    async saveDoc() {
      const c = currentCopy();
      if (!c) return;
      const w = App.state.write;
      await Store.put('docs', {
        id: Store.uid(),
        title: (c.titles && c.titles[0]) || w.topic,
        platform: w.plat,
        content: `【标题备选】\n${(c.titles || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n${c.body}\n\n${(c.tags || []).join(' ')}`,
        tags: c.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'gen',
      });
      toast('已存到「我的文档」📄');
    },

    markPosted() {
      const c = currentCopy();
      if (!c) return;
      const w = App.state.write;
      const { POST_TYPES, POST_SLOTS } = window.ViewUtil;
      form({
        title: '记一笔发布',
        fields: [
          { name: 'title', label: '标题', value: (c.titles && c.titles[0]) || w.topic, required: true },
          { name: 'platform', label: '平台', type: 'select', value: w.plat, options: Object.entries(PLAT).map(([v, l]) => ({ value: v, label: l })) },
          { name: 'type', label: '内容类型', type: 'select', value: POST_TYPES[0], options: POST_TYPES },
          { name: 'slot', label: '发布时段', type: 'select', value: POST_SLOTS[2], options: POST_SLOTS },
          { name: 'date', label: '发布日期', type: 'date', value: todayStr() },
          { name: 'url', label: '链接（可不填）', placeholder: 'https://' },
          { name: 'views', label: '阅读量（可不填）', type: 'number', value: 0 },
          { name: 'likes', label: '赞+藏（可不填）', type: 'number', value: 0 },
        ],
        onSubmit: async (v) => {
          await Store.put('posts', { id: Store.uid(), ...v, comments: 0, createdAt: new Date().toISOString() });
          toast('已记入发布台账 📤');
        },
      });
    },

    /* --- 搞钱 --- */
    openMoney(el) {
      const id = el.dataset.id;
      const m = ((App.state.daily && App.state.daily.money) || []).find((x) => x.id === id);
      if (!m) return;
      modal({
        title: m.title,
        body: `
          <div style="font-size:13.5px;line-height:1.9;color:var(--ink-2)">
            <div style="background:var(--green-100);border-radius:14px;padding:12px 14px;margin-bottom:14px;color:#1F6B4E">${esc(m.desc)}</div>
            <b style="color:var(--ink)">怎么做</b>
            <div style="margin:6px 0 14px">${(m.how || []).map((s, i) => `<div style="padding:4px 0">${i + 1}. ${esc(s)}</div>`).join('')}</div>
            <b style="color:var(--ink)">真实情况</b>
            <div style="margin:6px 0 14px;display:grid;gap:7px">
              <div>💵 收入区间：${esc(m.income || '—')}</div>
              <div>⏰ 每天投入：${esc(m.time || '—')}</div>
              <div>💸 启动成本：${esc(m.cost || '—')}</div>
              <div>🎯 门槛：${esc(m.level || '—')}</div>
            </div>
            <b style="color:var(--ink)">要注意的坑</b>
            <div style="margin:6px 0 4px;color:#B05070">${(m.risk || []).map((s) => `<div style="padding:3px 0">· ${esc(s)}</div>`).join('')}</div>
          </div>`,
        foot: `<button class="btn btn-ghost" data-act="closeModal">关闭</button>
               <button class="btn btn-primary" id="mFav">${''}☆ 收藏</button>`,
      });
      document.getElementById('mFav').onclick = async () => {
        await Store.put('favs', { id: m.id, title: m.title, at: new Date().toISOString() });
        toast('已收藏 ⭐');
        closeModal();
      };
    },

    async favMoney(el) {
      const id = el.dataset.id;
      const m = ((App.state.daily && App.state.daily.money) || []).find((x) => x.id === id);
      if (!m) return;
      await Store.put('favs', { id, title: m.title, at: new Date().toISOString() });
      toast('已收藏 ⭐');
      go('money');
    },

    /* --- 赞美日记 --- */
    addPraise() {
      form({
        title: '🌸 写一条赞美',
        fields: [
          { name: 'about', label: '夸谁', type: 'select', value: '自己', options: ['自己', '别人'] },
          { name: 'text', label: '夸什么（越具体越好）', type: 'textarea', rows: 4, required: true, placeholder: '比如：今天明明很累，还是把该做的事做完了，我说到做到。' },
          { name: 'date', label: '日期', type: 'date', value: todayStr() },
        ],
        onSubmit: async (v) => {
          await Store.put('praise', { id: Store.uid(), ...v, createdAt: new Date().toISOString() });
          toast('记下了 🌸');
          go('praise');
        },
      });
    },

    addSoul() {
      form({
        title: '🍃 记一条感悟',
        fields: [
          { name: 'title', label: '一句话概括（可不填）', placeholder: '今天想通了什么' },
          { name: 'text', label: '心里的话', type: 'textarea', rows: 6, required: true, placeholder: '想什么写什么，不用修饰。' },
          { name: 'tags', label: '标签（逗号分隔，可不填）', placeholder: '成长, 情绪' },
          { name: 'date', label: '日期', type: 'date', value: todayStr() },
        ],
        onSubmit: async (v) => {
          v.tags = (v.tags || '').split(/[,，\s]+/).filter(Boolean);
          await Store.put('soul', { id: Store.uid(), ...v, createdAt: new Date().toISOString() });
          toast('记下了 🍃');
          go('soul');
        },
      });
    },

    /* --- 成长计划 --- */
    addPlan() {
      form({
        title: '🌱 新建计划',
        fields: [
          { name: 'title', label: '计划名', required: true, placeholder: '比如：30 天早起写作' },
          { name: 'why', label: '为什么做', placeholder: '给自己一个真实理由' },
          { name: 'deadline', label: '截止日期（可不填）', type: 'date' },
          { name: 'steps', label: '拆成几步（一行一步，可不填）', type: 'textarea', rows: 4, placeholder: '买一个本子\n每天写 20 分钟\n第 30 天整理成一篇' },
        ],
        onSubmit: async (v) => {
          const steps = (v.steps || '').split('\n').map((s) => s.trim()).filter(Boolean).map((t) => ({ text: t, done: false }));
          await Store.put('plans', { id: Store.uid(), title: v.title, why: v.why, deadline: v.deadline, steps, checks: [], done: false, createdAt: new Date().toISOString() });
          toast('计划建好了 🌱');
          go('plan');
        },
      });
    },

    planMenu(el) {
      const id = el.dataset.id;
      Store.get('plans', id).then((p) => {
        if (!p) return;
        modal({
          title: p.title,
          body: `<div class="row" style="flex-direction:column;align-items:stretch;gap:9px">
            <button class="btn ${p.done ? '' : 'btn-green'}" id="pmDone">${p.done ? '↩️ 标记为未完成' : '✅ 标记为已完成'}</button>
            <button class="btn" id="pmEdit">✏️ 编辑计划</button>
            <button class="btn btn-ghost" id="pmDel" style="color:#C4536F">🗑 删除计划</button>
          </div>`,
          foot: `<button class="btn btn-ghost" data-act="closeModal">关闭</button>`,
        });
        document.getElementById('pmDone').onclick = async () => {
          p.done = !p.done;
          await Store.put('plans', p);
          closeModal(); go('plan'); toast(p.done ? '完成了！🎉' : '已恢复');
        };
        document.getElementById('pmEdit').onclick = () => {
          closeModal();
          form({
            title: '编辑计划',
            values: p,
            fields: [
              { name: 'title', label: '计划名', required: true },
              { name: 'why', label: '为什么做' },
              { name: 'deadline', label: '截止日期', type: 'date' },
            ],
            onSubmit: async (v) => { Object.assign(p, v); await Store.put('plans', p); go('plan'); toast('已更新'); },
          });
        };
        document.getElementById('pmDel').onclick = () => {
          closeModal();
          confirmBox('删除后无法恢复，确定吗？', async () => { await Store.del('plans', id); go('plan'); toast('已删除'); });
        };
      });
    },

    async toggleStep(el) {
      const { id, i } = el.dataset;
      const p = await Store.get('plans', id);
      if (!p || !p.steps || !p.steps[i]) return;
      p.steps[i].done = !p.steps[i].done;
      await Store.put('plans', p);
      go('plan', {}, true);
    },

    async checkToggle(el) {
      const ref = el.dataset.ref;
      const plans = await Store.all('plans');
      const active = plans.filter((p) => !p.done);
      if (!active.length) { toast('先建一个计划'); return; }
      const p = active[0];
      p.checks = p.checks || [];
      const idx = p.checks.indexOf(ref);
      if (idx >= 0) p.checks.splice(idx, 1); else p.checks.push(ref);
      await Store.put('plans', p);
      go('plan', {}, true);
      toast(idx >= 0 ? '取消打卡' : '打卡成功 ✓');
    },

    /* --- 发布记录 / 台账 --- */
    postRange(el) {
      go('posts', { range: el.dataset.key, key: '' });
    },

    filterPosts(el) {
      const key = el.dataset.key;
      const cur = App.state.params || {};
      go('posts', { range: cur.range || 'all', key: cur.key === key ? '' : key }, true);
    },

    addPost() {
      const { POST_TYPES, POST_SLOTS } = window.ViewUtil;
      form({
        title: '📤 记一条发布',
        fields: [
          { name: 'title', label: '标题', required: true },
          { name: 'platform', label: '平台', type: 'select', value: 'gongzhonghao', options: Object.entries(PLAT).map(([v, l]) => ({ value: v, label: l })) },
          { name: 'type', label: '内容类型（决定能不能复盘）', type: 'select', value: POST_TYPES[0], options: POST_TYPES },
          { name: 'slot', label: '发布时段', type: 'select', value: POST_SLOTS[2], options: POST_SLOTS },
          { name: 'date', label: '日期', type: 'date', value: todayStr() },
          { name: 'url', label: '链接（可不填）' },
          { name: 'views', label: '阅读量', type: 'number', value: 0 },
          { name: 'likes', label: '赞+藏', type: 'number', value: 0 },
          { name: 'comments', label: '评论', type: 'number', value: 0 },
          { name: 'notes', label: '备注（蹭到热点/被限流/改了标题重发）', placeholder: '一句话记下当时发生了什么' },
        ],
        onSubmit: async (v) => {
          await Store.put('posts', { id: Store.uid(), ...v, createdAt: new Date().toISOString() });
          toast('记下了 📤');
          go('posts', App.state.params || {});
        },
      });
    },

    editPost(el) {
      const id = el.dataset.id;
      const { POST_TYPES, POST_SLOTS } = window.ViewUtil;
      Store.get('posts', id).then((p) => {
        if (!p) return;
        form({
          title: '编辑记录',
          values: p,
          fields: [
            { name: 'title', label: '标题', required: true },
            { name: 'platform', label: '平台', type: 'select', value: p.platform, options: Object.entries(PLAT).map(([v, l]) => ({ value: v, label: l })) },
            { name: 'type', label: '内容类型', type: 'select', value: p.type || POST_TYPES[0], options: POST_TYPES },
            { name: 'slot', label: '发布时段', type: 'select', value: p.slot || POST_SLOTS[2], options: POST_SLOTS },
            { name: 'date', label: '日期', type: 'date', value: p.date || todayStr() },
            { name: 'views', label: '阅读量', type: 'number', value: p.views || 0 },
            { name: 'likes', label: '赞+藏', type: 'number', value: p.likes || 0 },
            { name: 'comments', label: '评论', type: 'number', value: p.comments || 0 },
            { name: 'notes', label: '备注' },
          ],
          onSubmit: async (v) => {
            Object.assign(p, v);
            await Store.put('posts', p);
            toast('已更新');
            go('posts', App.state.params || {}, true);
          },
        });
      });
    },

    /* --- 读书 --- */
    addBook() {
      form({
        title: '📚 加一本书',
        fields: [
          { name: 'title', label: '书名', required: true },
          { name: 'author', label: '作者' },
          { name: 'status', label: '状态', type: 'select', value: '在读', options: ['想读', '在读', '读完'] },
          { name: 'progress', label: '进度 %', type: 'number', value: 0 },
        ],
        onSubmit: async (v) => {
          await Store.put('books', { id: Store.uid(), ...v, quotes: '', notes: '', createdAt: new Date().toISOString() });
          toast('加好了 📚');
          go('books');
        },
      });
    },

    editBook(el) {
      const id = el.dataset.id;
      Store.get('books', id).then((b) => {
        if (!b) return;
        form({
          title: '更新《' + b.title + '》',
          values: b,
          fields: [
            { name: 'status', label: '状态', type: 'select', value: b.status || '在读', options: ['想读', '在读', '读完'] },
            { name: 'progress', label: '进度 %', type: 'number', value: b.progress || 0 },
            { name: 'quotes', label: '摘抄（最喜欢的几句）', type: 'textarea', rows: 4 },
            { name: 'notes', label: '我的想法', type: 'textarea', rows: 5 },
          ],
          onSubmit: async (v) => {
            Object.assign(b, v);
            if (Number(v.progress) >= 100) b.status = '读完';
            await Store.put('books', b);
            toast('已更新 📖');
            go('books');
          },
        });
      });
    },

    bookToDoc(el) {
      const id = el.dataset.id;
      Store.get('books', id).then(async (b) => {
        if (!b) return;
        const content = `《${b.title}》读书笔记\n\n作者：${b.author || '—'}\n读完时间：${todayStr()}\n\n【最打动我的句子】\n${b.quotes || '（还没写）'}\n\n【我的想法】\n${b.notes || '（还没写）'}\n\n【读完我要改的一件事】\n1. `;
        await Store.put('docs', { id: Store.uid(), title: `《${b.title}》读书笔记`, platform: 'other', content, tags: ['读书笔记'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'book' });
        toast('已生成到「我的文档」📄');
        go('docs');
      });
    },

    /* --- 技能 --- */
    addSkill() {
      form({
        title: '🎯 加一个技能',
        fields: [
          { name: 'name', label: '技能名', required: true, placeholder: '比如：短视频剪辑 / 写作 / 烘焙' },
          { name: 'goal', label: '想达到什么程度', placeholder: '比如：能独立剪出一条 1 分钟的口播' },
        ],
        onSubmit: async (v) => {
          await Store.put('skills', { id: Store.uid(), ...v, hours: 0, logs: [], createdAt: new Date().toISOString() });
          toast('加好了 🎯');
          go('skills');
        },
      });
    },

    logSkill(el) {
      const id = el.dataset.id;
      form({
        title: '记一次练习',
        fields: [
          { name: 'text', label: '今天练了什么', type: 'textarea', rows: 3, required: true, placeholder: '比如：练了 5 个转场，终于会卡点了' },
          { name: 'hours', label: '花了多久（小时）', type: 'number', value: 1 },
          { name: 'date', label: '日期', type: 'date', value: todayStr() },
        ],
        onSubmit: async (v) => {
          const s = await Store.get('skills', id);
          if (!s) return;
          s.logs = s.logs || [];
          s.logs.push({ date: v.date, text: v.text, hours: Number(v.hours) || 0 });
          s.hours = (Number(s.hours) || 0) + (Number(v.hours) || 0);
          await Store.put('skills', s);
          toast('记下了 ✓');
          go('skills');
        },
      });
    },

    /* --- 文档 --- */
    addDoc() {
      App.state.editDoc = null;
      App.state.write.topic = '';
      App.state.write.preset = null;
      App.state.write.result = null;
      go('write', { topic: '' });
      toast('在上面输入话题，或直接点「开始写」');
    },

    openDoc(el) {
      const id = el.dataset.id;
      Store.get('docs', id).then((d) => {
        if (!d) return;
        modal({
          title: d.title || '无标题',
          body: `
            <div class="copy-block" style="max-height:52vh" id="docView">${esc(d.content)}</div>
            <div class="row" style="margin-top:12px;gap:7px">
              <button class="btn btn-sm" data-act="closeModal" id="docCopy">📋 复制全文</button>
              <button class="btn btn-sm" id="docEdit">✏️ 编辑</button>
            </div>`,
          foot: `<button class="btn btn-ghost" id="docDel" style="color:#C4536F">删除</button><button class="btn btn-primary" data-act="closeModal">关闭</button>`,
        });
        document.getElementById('docCopy').onclick = async () => { await copyText(d.content); toast('已复制'); };
        document.getElementById('docDel').onclick = () => {
          closeModal();
          confirmBox('删除这篇文章？', async () => { await Store.del('docs', id); go('docs'); toast('已删除'); });
        };
        document.getElementById('docEdit').onclick = () => {
          document.getElementById('docView').outerHTML = `<textarea class="textarea" id="docEditArea" rows="16" style="max-height:52vh">${esc(d.content)}</textarea>`;
          document.getElementById('docEdit').outerHTML = `<button class="btn btn-sm btn-primary" id="docSaveBtn">💾 保存</button>`;
          document.getElementById('docSaveBtn').onclick = async () => {
            d.content = document.getElementById('docEditArea').value;
            d.updatedAt = new Date().toISOString();
            await Store.put('docs', d);
            closeModal();
            go('docs');
            toast('已保存');
          };
        };
      });
    },

    searchDoc(el) {
      clearTimeout(el._t);
      el._t = setTimeout(() => { go('docs', { q: el.value }, true); }, 320);
    },

    /* --- 设置 --- */
    /* --- 合规检查 --- */
    checkMore() {
      modal({
        title: '🔍 文案合规检查',
        body: `
          <div style="font-size:12.5px;color:var(--ink-3);margin-bottom:8px;line-height:1.7">
            粘贴准备发布的文字，查一下有没有会被限流的词。标题和正文都可以。
          </div>
          <textarea class="textarea" id="ckText" rows="9" placeholder="把文案粘进来…"></textarea>
          <div id="ckResult" style="margin-top:12px"></div>`,
        foot: `<button class="btn btn-ghost" data-act="closeModal">关闭</button>
               <button class="btn btn-primary" id="ckBtn">开始检查</button>`,
      });
      document.getElementById('ckBtn').onclick = () => {
        const t = document.getElementById('ckText').value;
        if (!t.trim()) { toast('先粘一段文字'); return; }
        const hits = Sensitive.check(t);
        const list = Sensitive.summary(hits);
        document.getElementById('ckResult').innerHTML = riskPanelHTML(list, true);
      };
    },

    async saveMaterials() {
      const toLines = (id) => (document.getElementById(id).value || '').split('\n').map((s) => s.trim()).filter(Boolean);
      await Store.kvSet('materials', {
        stories: toLines('matStories'),
        cases: toLines('matCases'),
        quotes: toLines('matQuotes'),
      });
      toast('素材库已保存 🎒');
    },

    exportAll() { Backup.exportAll().then(() => toast('备份已下载')); },
    exportMd() { Backup.exportMarkdown().then(() => toast('Markdown 已下载')); },
    importAll() { document.getElementById('fileInput').click(); },

    clearAll() {
      confirmBox('会清空所有文章、日记、计划、记录，且无法恢复。建议先导出备份。确定要清空吗？', async () => {
        for (const s of ['docs', 'praise', 'soul', 'plans', 'books', 'skills', 'posts', 'favs']) await Store.clear(s);
        toast('已清空');
        go('settings');
      });
    },

    async del(el) {
      const { store, id } = el.dataset;
      confirmBox('确定删除？', async () => {
        await Store.del(store, id);
        go(App.state.view, App.state.params, true);
        toast('已删除');
      });
    },
  };

  /* ---------- 事件委托 ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (!Actions[act]) return;
    e.preventDefault();
    e.stopPropagation();
    try { Actions[act](t, e); } catch (err) { console.error(err); toast('出错了：' + err.message); }
  });

  // 浏览器前进/后退或手动改 hash
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').slice(1);
    if (TITLES[h] && h !== App.state.view) go(h, {}, true);
  });

  // 导航
  document.getElementById('nav').addEventListener('click', (e) => {
    const a = e.target.closest('.nav-item');
    if (a) go(a.dataset.view);
  });
  document.getElementById('tabbar').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a) go(a.dataset.view);
  });
  document.getElementById('hamburger').onclick = () => document.getElementById('app').classList.toggle('nav-open');
  document.getElementById('scrim').onclick = () => document.getElementById('app').classList.remove('nav-open');
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.getElementById('quickBtn').onclick = () => go('write');
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); document.getElementById('app').classList.remove('nav-open'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && App.state.view === 'write') { e.preventDefault(); Actions.doGenerate(); }
  });

  // 文件导入
  document.addEventListener('change', (e) => {
    if (e.target.id === 'fileInput' && e.target.files[0]) {
      const f = e.target.files[0];
      const r = new FileReader();
      r.onload = async () => {
        try {
          const n = await Backup.importAll(r.result);
          toast(`导入 ${n} 条数据`);
          go('home');
        } catch (err) { toast('导入失败：' + err.message); }
      };
      r.readAsText(f);
    }
  });

  /* ---------- 启动 ---------- */
  async function boot() {
    const d = new Date();
    document.getElementById('brandDate').textContent = `${d.getMonth() + 1}月${d.getDate()}日 · 星期${'日一二三四五六'[d.getDay()]}`;

    const [daily, hot] = await Promise.all([loadDaily(), loadHot(false)]);
    App.state.daily = daily;
    App.state.hot = hot;

    // daily.json 不是今天的（云端/离线时常见）→ 用今天的真实热榜现场合成选题，不让首页空着
    const today = todayStr();
    if (hot && hot.picks && hot.picks.length && (!daily || daily.date !== today)) {
      App.state.liveTopics = buildLiveTopics(hot.picks);
    }

    updateSyncBar();

    const hash = (location.hash || '#home').slice(1);
    const view = TITLES[hash] ? hash : 'home';
    await go(view, {}, true);

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  window.App = App;
  App.go = go;
  App.modal = modal;
  window.toast = toast;
  window.copyText = copyText;
  boot();
})();
