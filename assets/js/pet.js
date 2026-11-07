/* ===== 页内萌宠：一只会说话的小猫（只依赖 CSS/SVG，无外部资源） ===== */
(function () {
  'use strict';

  const KEY = 'pet.on';
  let el = null;
  let bubble = null;
  let hideTimer = null;
  let on = true;
  let pageHidden = false;

  const LINES = [
    '写不出来就先写一句，剩下的会自己长出来。',
    '今天也别忘了夸自己一句 🌸',
    '选题不用多，一条能发出去就赢了。',
    '卡住的时候，去热榜逛两分钟。',
    '存稿不是拖延，是在攒子弹。',
    '发出去比完美重要。',
    '累了就歇会儿，工作台跑不掉。',
    '你上次的复盘，今天可以再看一眼。',
  ];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pad = (n) => String(n).padStart(2, '0');

  async function contextLine() {
    try {
      const [rems, topics] = await Promise.all([Store.all('reminders'), Store.all('topics')]);
      const d = new Date();
      const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const due = rems.filter((r) => r.kind !== 'note' && !r.done && r.date && r.date <= today).length;
      const pending = topics.filter((t) => (t.status || 'todo') !== 'done').length;
      if (due) return `今天还有 ${due} 件事要做 ⏰`;
      const h = d.getHours();
      if (h < 5) return '这个点还没睡？身体要紧。';
      if (h < 11) return '早上好，今天想发点什么？';
      if (h < 14) return '中午了，吃口饭再写。';
      if (h < 19) return pending ? `池子里还有 ${pending} 个选题，挑一个吧。` : pick(LINES);
      return pick(LINES);
    } catch (e) {
      return pick(LINES);
    }
  }

  function say(text) {
    if (!el || !bubble) return;
    bubble.textContent = text;
    bubble.classList.add('on');
    el.classList.add('happy');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      bubble.classList.remove('on');
      el.classList.remove('happy');
    }, 4200);
  }

  async function onTap(e) {
    e.preventDefault();
    e.stopPropagation();
    say(await contextLine());
  }

  function build() {
    const wrap = document.createElement('div');
    wrap.id = 'pet';
    wrap.className = 'pet';
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-label', '萌宠');
    wrap.innerHTML = `
      <div class="pet-bubble" id="petBubble" role="status"></div>
      <svg class="pet-svg" viewBox="0 0 64 72" aria-hidden="true">
        <ellipse class="pet-shadow" cx="32" cy="67" rx="13" ry="3.2"></ellipse>
        <g class="pet-body">
          <path class="pet-tail" d="M49 55c6-1 9-6 7-11"></path>
          <path class="pet-ear" d="M17 21l-2-10 10 5z"></path>
          <path class="pet-ear" d="M47 21l2-10-10 5z"></path>
          <circle class="pet-head" cx="32" cy="35" r="19"></circle>
          <circle class="pet-eye" cx="25" cy="33" r="2.4"></circle>
          <circle class="pet-eye" cx="39" cy="33" r="2.4"></circle>
          <path class="pet-mouth" d="M28.5 40q3.5 3 7 0"></path>
          <circle class="pet-cheek" cx="20.5" cy="39" r="2.4"></circle>
          <circle class="pet-cheek" cx="43.5" cy="39" r="2.4"></circle>
        </g>
      </svg>`;
    wrap.addEventListener('click', onTap);
    document.body.appendChild(wrap);
    el = wrap;
    bubble = wrap.querySelector('#petBubble');
  }

  function render() {
    if (!el) return;
    const shown = on && !pageHidden;
    el.classList.toggle('off', !on);
    el.classList.toggle('page-hide', shown ? false : pageHidden);
    el.dataset.on = on ? '1' : '0';
    document.body.classList.toggle('pet-on', shown);
  }

  function apply(v) {
    on = !!v;
    render();
  }

  function setPage(view, params) {
    pageHidden = view === 'pool' && params && params.mode === 'cal';
    render();
  }

  async function mount() {
    if (el || !document.body) return;
    if (!window.matchMedia || !window.matchMedia('(max-width: 820px)').matches) return;
    build();
    const saved = await Store.kvGet(KEY, null);
    on = saved === null ? true : !!saved;
    render();
  }

  window.Pet = {
    mount,
    apply,
    setPage,
    isOn: () => (el ? el.dataset.on === '1' : false),
    say,
  };
})();
