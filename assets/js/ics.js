/* ===== 导出 .ics：交给手机/电脑系统日历去提醒（关掉网页也能响） ===== */
(function () {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /* RFC 5545：每行不超过 75 字节，续行以空格开头（按 UTF-8 字节算，不能按字符切） */
  const enc = new TextEncoder();
  function fold(line) {
    if (enc.encode(line).length <= 75) return line;
    const out = [];
    let buf = '';
    let size = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (size + b > 74) { out.push(buf); buf = ' '; size = 1; }
      buf += ch;
      size += b;
    }
    out.push(buf);
    return out.join('\r\n');
  }

  function stampUTC(d) {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  }

  function dateOnly(ds) {
    return ds.replace(/-/g, '');
  }

  function nextDay(ds) {
    const d = new Date(ds + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function eventBlock(ev, dtstamp) {
    const L = ['BEGIN:VEVENT', `UID:${ev.uid}`, `DTSTAMP:${dtstamp}`];
    if (ev.time) {
      // 按本机时区换算成 UTC，省掉 VTIMEZONE，各家日历都能认
      const d = new Date(`${ev.date}T${ev.time}:00`);
      L.push(`DTSTART:${stampUTC(d)}`);
      L.push(`DTEND:${stampUTC(new Date(d.getTime() + 30 * 60000))}`);
    } else {
      L.push(`DTSTART;VALUE=DATE:${dateOnly(ev.date)}`);
      L.push(`DTEND;VALUE=DATE:${dateOnly(nextDay(ev.date))}`);
    }
    L.push(`SUMMARY:${esc(ev.title)}`);
    if (ev.desc) L.push(`DESCRIPTION:${esc(ev.desc)}`);
    L.push('TRANSP:TRANSPARENT');
    if (ev.alarm) {
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.title)}`, `TRIGGER:${ev.alarm}`, 'END:VALARM');
    }
    L.push('END:VEVENT');
    return L;
  }

  function build(events, name) {
    const dtstamp = stampUTC(new Date());
    const L = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//zi-meiti-workbench//CN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(name || '我的小工作台')}`,
    ];
    for (const ev of events) L.push(...eventBlock(ev, dtstamp));
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  window.Ics = { build };
})();
