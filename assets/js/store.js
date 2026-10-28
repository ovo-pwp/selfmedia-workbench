/* ===== 数据层：IndexedDB 封装 + 导入导出 ===== */
(function () {
  'use strict';

  const DB_NAME = 'zi-meiti-workbench';
  const DB_VER = 1;
  const STORES = ['docs', 'praise', 'soul', 'plans', 'books', 'skills', 'posts', 'favs', 'kv'];

  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) {
            db.createObjectStore(s, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      let out;
      try { out = fn(os); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(out && out.__req ? out.__req.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const Store = {
    uid,
    async all(store) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readonly');
        const req = t.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },
    async get(store, id) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readonly');
        const req = t.objectStore(store).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    async put(store, obj) {
      if (!obj.id) obj.id = uid();
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        t.objectStore(store).put(obj);
        t.oncomplete = () => resolve(obj);
        t.onerror = () => reject(t.error);
      });
    },
    async del(store, id) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        t.objectStore(store).delete(id);
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    },
    async clear(store) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        t.objectStore(store).clear();
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    },
    /* kv 便捷读写（设置、素材库、缓存） */
    async kvGet(key, dflt) {
      const r = await Store.get('kv', key);
      return r ? r.value : dflt;
    },
    async kvSet(key, value) {
      return Store.put('kv', { id: key, value });
    },
  };

  /* ===== 导出 / 导入 ===== */
  const PLATFORM_NAME = { gongzhonghao: '公众号', xiaohongshu: '小红书', shipinhao: '视频号', douyin: '抖音', other: '其它' };

  function download(filename, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  async function exportAll() {
    const dump = { _type: 'zi-meiti-backup', _ver: 1, _at: new Date().toISOString(), data: {} };
    for (const s of STORES) dump.data[s] = await Store.all(s);
    download(`创作台备份-${stamp()}.json`, JSON.stringify(dump, null, 2), 'application/json');
    return true;
  }

  async function importAll(text) {
    const obj = JSON.parse(text);
    if (!obj || obj._type !== 'zi-meiti-backup' || !obj.data) throw new Error('不是有效的备份文件');
    let n = 0;
    for (const s of STORES) {
      const arr = obj.data[s];
      if (!Array.isArray(arr)) continue;
      for (const item of arr) { await Store.put(s, item); n++; }
    }
    return n;
  }

  async function exportMarkdown() {
    const [docs, praise, soul, plans, books, skills, posts] = await Promise.all([
      Store.all('docs'), Store.all('praise'), Store.all('soul'), Store.all('plans'),
      Store.all('books'), Store.all('skills'), Store.all('posts'),
    ]);
    const L = [];
    L.push(`# 我的创作台 · 全量导出\n\n> 导出时间：${new Date().toLocaleString('zh-CN')}\n`);

    if (docs.length) {
      L.push('\n---\n\n# 📄 我的文档\n');
      docs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      for (const d of docs) {
        L.push(`\n## ${d.title || '无标题'}\n`);
        L.push(`> ${PLATFORM_NAME[d.platform] || d.platform || '未分类'} · ${(d.createdAt || '').slice(0, 10)}${d.tags && d.tags.length ? ' · ' + d.tags.join(' ') : ''}\n`);
        L.push('\n' + (d.content || '') + '\n');
      }
    }
    if (praise.length) {
      L.push('\n---\n\n# 🌸 赞美日记\n');
      praise.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      for (const p of praise) L.push(`\n### ${p.date}\n\n${p.text}\n`);
    }
    if (soul.length) {
      L.push('\n---\n\n# 🍃 心灵感悟\n');
      soul.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      for (const p of soul) L.push(`\n### ${p.date}${p.title ? ' · ' + p.title : ''}\n\n${p.text}\n`);
    }
    if (plans.length) {
      L.push('\n---\n\n# 🌱 成长计划\n');
      for (const p of plans) {
        L.push(`\n## ${p.title}\n\n- 状态：${p.done ? '已完成' : '进行中'}\n- 截止：${p.deadline || '未设'}\n- 为什么做：${p.why || '—'}\n- 打卡：${(p.checks || []).length} 天\n`);
        (p.steps || []).forEach((s, i) => L.push(`${i + 1}. [${s.done ? 'x' : ' '}] ${s.text}\n`));
      }
    }
    if (books.length) {
      L.push('\n---\n\n# 📚 读书\n');
      for (const b of books) {
        L.push(`\n## 《${b.title}》${b.author ? ' · ' + b.author : ''}\n\n- 状态：${b.status || '在读'} · 进度 ${b.progress || 0}%\n`);
        if (b.quotes) L.push(`\n**摘抄**\n\n${b.quotes}\n`);
        if (b.notes) L.push(`\n**笔记**\n\n${b.notes}\n`);
      }
    }
    if (skills.length) {
      L.push('\n---\n\n# 🎯 技能学习\n');
      for (const s of skills) {
        L.push(`\n## ${s.name}\n\n- 累计：${s.hours || 0} 小时 · 打卡 ${(s.logs || []).length} 次\n`);
        (s.logs || []).forEach((l) => L.push(`- ${l.date}：${l.text}（${l.hours || 0}h）\n`));
      }
    }
    if (posts.length) {
      L.push('\n---\n\n# 📤 发布记录\n');
      posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      L.push('\n| 日期 | 标题 | 平台 | 阅读 | 赞藏 |\n|---|---|---|---|---|\n');
      for (const p of posts) {
        L.push(`| ${p.date || ''} | ${p.title || ''} | ${PLATFORM_NAME[p.platform] || p.platform || ''} | ${p.views || 0} | ${p.likes || 0} |\n`);
      }
    }
    download(`创作台全文-${stamp()}.md`, L.join(''), 'text/markdown;charset=utf-8');
    return true;
  }

  window.Store = Store;
  window.Backup = { exportAll, importAll, exportMarkdown, download, stamp };
  window.PLATFORM_NAME = PLATFORM_NAME;
})();
