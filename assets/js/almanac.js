/* 黄历小工具：公历日期 → 农历 / 二十四节气 / 常见节日
 * 无第三方依赖：节气用寿星通用公式（2000–2099 有效），农历走浏览器内置 Intl，
 * 不支持中文历法时只显示节气和固定节日，不影响日历使用。 */
(function () {
  'use strict';

  /* [名称, 月份, 21 世纪 C 值] */
  const TERMS = [
    ['小寒', 1, 5.4055], ['大寒', 1, 20.12],
    ['立春', 2, 3.87], ['雨水', 2, 18.73],
    ['惊蛰', 3, 5.63], ['春分', 3, 20.646],
    ['清明', 4, 4.81], ['谷雨', 4, 20.1],
    ['立夏', 5, 5.52], ['小满', 5, 21.04],
    ['芒种', 6, 5.678], ['夏至', 6, 21.37],
    ['小暑', 7, 7.108], ['大暑', 7, 22.83],
    ['立秋', 8, 7.5], ['处暑', 8, 23.13],
    ['白露', 9, 7.646], ['秋分', 9, 23.042],
    ['寒露', 10, 8.318], ['霜降', 10, 23.438],
    ['立冬', 11, 7.438], ['小雪', 11, 22.36],
    ['大雪', 12, 7.18], ['冬至', 12, 21.94],
  ];
  /* 公式在个别年份会差一天，这里是公认的例外 */
  const TERM_FIX = {
    '2019-小寒': 1, '2082-大寒': 1, '2026-雨水': -1, '2084-惊蛰': 1, '2084-春分': 1,
    '2008-小满': 1, '1928-夏至': 1, '2016-小暑': 1, '1922-大暑': 1, '2002-立秋': 1,
    '1927-白露': 1, '1942-秋分': 1, '2088-寒露': 1, '2089-霜降': 1, '2089-立冬': 1,
    '1978-小雪': 1, '1954-大雪': 1, '2021-冬至': -1,
  };

  const FIXED_FEST = {
    '01-01': '元旦', '02-14': '情人节', '03-08': '妇女节', '03-12': '植树节',
    '04-01': '愚人节', '05-01': '劳动节', '05-04': '青年节', '06-01': '儿童节',
    '06-18': '618', '07-01': '建党节', '08-01': '建军节', '09-10': '教师节',
    '10-01': '国庆节', '10-31': '万圣夜', '11-11': '双11', '12-12': '双12',
    '12-24': '平安夜', '12-25': '圣诞节', '12-31': '跨年夜',
  };
  const LUNAR_FEST = {
    '1-1': '春节', '1-15': '元宵节', '2-2': '龙抬头', '5-5': '端午节',
    '7-7': '七夕', '7-15': '中元节', '8-15': '中秋节', '9-9': '重阳节',
    '12-8': '腊八节', '12-23': '小年',
  };
  const DIG = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  /* 浏览器 ICU 的农历在个别年份会把腊月边界算错（如 2027 年春节差一天），
     春节日期用权威对照表兜底，连带修正除夕 / 元宵 */
  const CNY = {
    2024: '02-10', 2025: '01-29', 2026: '02-17', 2027: '02-06',
    2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23',
    2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08',
  };

  const termCache = {};
  const lunarCache = {};
  const dateCache = {};

  function termsOfYear(y) {
    if (termCache[y]) return termCache[y];
    const map = {};
    const yy = y % 100;
    for (const [name, m, c] of TERMS) {
      const fix = TERM_FIX[`${y}-${name}`] || 0;
      const d = Math.floor(yy * 0.2422 + c) - Math.floor(yy / 4) + fix;
      map[`${m}-${d}`] = name;
    }
    termCache[y] = map;
    return map;
  }

  function lunarDayName(n) {
    if (n <= 10) return '初' + DIG[n];
    if (n < 20) return '十' + DIG[n - 10];
    if (n === 20) return '二十';
    if (n < 30) return '廿' + DIG[n - 20];
    return '三十';
  }

  let fmtLong = null;
  let fmtNum = null;
  try {
    const a = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' });
    if (a.resolvedOptions().calendar === 'chinese') {
      fmtLong = a;
      fmtNum = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'numeric', day: 'numeric' });
    }
  } catch (e) { /* 老 WebView 没有中文历法，跳过农历 */ }

  function lunarOf(date) {
    if (!fmtLong) return null;
    const key = date.toDateString();
    if (lunarCache[key] !== undefined) return lunarCache[key];
    let info = null;
    try {
      const parts = fmtLong.formatToParts(date);
      const monthName = (parts.find((p) => p.type === 'month') || {}).value || '';
      const dayNum = Number((parts.find((p) => p.type === 'day') || {}).value);
      const num = fmtNum.format(date).split('-').map(Number);
      if (monthName && dayNum) {
        info = {
          label: monthName + lunarDayName(dayNum),
          key: `${num[0]}-${num[1]}`,
          leap: monthName.indexOf('闰') === 0,
        };
      }
    } catch (e) { info = null; }
    lunarCache[key] = info;
    return info;
  }

  function weekdayFest(y, m, d) {
    const w = new Date(y, m - 1, d).getDay();
    if (m === 5 && w === 0 && d >= 8 && d <= 14) return '母亲节';
    if (m === 6 && w === 0 && d >= 15 && d <= 21) return '父亲节';
    if (m === 11 && w === 4 && d >= 22 && d <= 28) return '感恩节';
    return '';
  }

  function forDate(dateStr) {
    if (dateCache[dateStr]) return dateCache[dateStr];
    const [y, m, d] = String(dateStr).split('-').map(Number);
    const tags = [];
    const term = termsOfYear(y)[`${m}-${d}`];
    if (term) tags.push({ type: 'term', name: term });

    const lunar = lunarOf(new Date(y, m - 1, d));
    let fest = '';
    let lunarLabel = lunar ? lunar.label : '';

    const cny = CNY[y];
    if (cny) {
      const cnyDate = new Date(y, Number(cny.slice(0, 2)) - 1, Number(cny.slice(3)));
      const diff = Math.round((new Date(y, m - 1, d) - cnyDate) / 86400000);
      if (diff >= 0 && diff <= 28) {
        lunarLabel = '正月' + lunarDayName(diff + 1);
        if (diff === 0) fest = '春节';
        if (diff === 14) fest = '元宵节';
      } else if (diff === -1) fest = '除夕';
    }

    if (!fest && lunar && !lunar.leap) {
      // 有春节对照表时，正月的节日以表为准，避免 ICU 边界差一天重复标元宵
      if (!cny || lunar.key.slice(0, 2) !== '1-') fest = LUNAR_FEST[lunar.key] || '';
      if (!fest && lunar.key.slice(0, 3) === '12-') {
        const next = new Date(y, m - 1, d + 1);
        const nl = lunarOf(next);
        if (nl && nl.key === '1-1') fest = '除夕';
      }
    }
    if (!fest) fest = FIXED_FEST[dateStr.slice(5)] || weekdayFest(y, m, d);
    if (fest) tags.push({ type: 'fest', name: fest });

    const res = { lunar: lunarLabel, tags };
    dateCache[dateStr] = res;
    return res;
  }

  const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const ymd = (dateStr) => String(dateStr).split('-').map(Number);

  function solarLabel(dateStr) {
    const [, m, d] = ymd(dateStr);
    return `${m}月${d}日`;
  }
  function weekdayLabel(dateStr) {
    const [y, m, d] = ymd(dateStr);
    return WD[new Date(y, m - 1, d).getDay()];
  }

  /* 阳历 + 星期 + 农历 + 节日/节气，例如「11月7日 周五 · 农历九月廿四 · 立冬」 */
  function label(dateStr) {
    const meta = forDate(dateStr);
    const out = [`${solarLabel(dateStr)} ${weekdayLabel(dateStr)}`];
    if (meta.lunar) out.push('农历' + meta.lunar);
    meta.tags.forEach((t) => out.push(t.name));
    return out.join(' · ');
  }

  /* 日历格用：阳历 11/07 与农历分两行 */
  function shortSolar(dateStr) {
    const [, m, d] = ymd(dateStr);
    return `${m}/${String(d).padStart(2, '0')}`;
  }

  /* 区间内的节日（不含节气），给「节日借势提醒」用 */
  function festsBetween(startStr, days) {
    const out = [];
    const d = new Date(startStr + 'T12:00:00');
    for (let i = 0; i < days; i++) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const meta = forDate(ds);
      meta.tags.filter((t) => t.type === 'fest').forEach((t) => out.push({ date: ds, name: t.name }));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  window.Almanac = { forDate, label, solarLabel, weekdayLabel, shortSolar, festsBetween, _termsOfYear: termsOfYear };
})();
