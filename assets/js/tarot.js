/* ===== 塔罗：22 张大阿卡纳（韦特体系）+ 每日一牌 =====
 * 牌意按传统含义写，解读角度偏向「做内容的人」的日常处境。
 * 不预测吉凶，只给一个看问题的角度。
 */
(function () {
  'use strict';

  const CARDS = [
    {
      n: 0, name: '愚者', en: 'The Fool', sym: '🃏',
      kw: ['新的开始', '冒险', '不被定义'],
      up: '今天适合「先开始，再完美」。你脑子里那个还没成形的想法，比你以为的更有生命力。别等准备充分，准备永远不会充分。',
      rev: '逆位提醒你：横冲直撞和勇敢是两件事。想清楚第一步要落在哪里，再抬脚。',
      act: '把那个拖了很久的草稿，先发出 1/3。',
    },
    {
      n: 1, name: '魔术师', en: 'The Magician', sym: '🎩',
      kw: ['行动力', '资源整合', '表达'],
      up: '你手上的东西已经够了——素材、经历、会的那点技能。今天的关键不是再学什么，而是把它们组合起来用一次。',
      rev: '逆位是「想得多做得少」，或者把力气花在了包装上。先把内容做实。',
      act: '从你的素材库里挑 3 条，硬凑成一篇。',
    },
    {
      n: 2, name: '女祭司', en: 'The High Priestess', sym: '🌙',
      kw: ['直觉', '沉淀', '未说出口的'],
      up: '今天不适合输出，适合输入和观察。你心里那个「说不上来但觉得不对」的感觉，值得信一次。',
      rev: '逆位是把自己关得太紧了。有些话憋太久会发霉，找个信得过的人说一句。',
      act: '关掉手机，安静地读 20 页书。',
    },
    {
      n: 3, name: '皇后', en: 'The Empress', sym: '🌷',
      kw: ['滋养', '丰盛', '被看见'],
      up: '今天适合做「有温度」的内容。你的生活细节、你的照顾、你的审美，就是别人替代不了的部分。',
      rev: '逆位提醒：别把照顾别人当成唯一的价值。你今天也需要被照顾。',
      act: '写一件今天让你觉得舒服的小事，发出去。',
    },
    {
      n: 4, name: '皇帝', en: 'The Emperor', sym: '🏛️',
      kw: ['结构', '纪律', '掌控'],
      up: '该定规矩了。更新频率、选题范围、发布时段——把这三件事写死，比每天靠意志力硬撑管用。',
      rev: '逆位是控制过头：计划排太满，一点意外就全线崩。留 20% 的空白。',
      act: '给下周定一个「最低完成量」，低到不可能失败。',
    },
    {
      n: 5, name: '教皇', en: 'The Hierophant', sym: '📜',
      kw: ['学习', '方法论', '传承'],
      up: '今天适合「照着做」。别急着创新，先找一个你认可的人，把他的结构拆开抄一遍。',
      rev: '逆位是规则不再适用了。你一直遵循的那套玩法，可能该换了。',
      act: '拆解一篇你喜欢的爆款，只记它的结构。',
    },
    {
      n: 6, name: '恋人', en: 'The Lovers', sym: '💞',
      kw: ['选择', '契合', '价值观'],
      up: '今天会面对一个选择。判断标准不是哪个更划算，而是哪个更像你。选完就别回头看。',
      rev: '逆位是摇摆不定。两个都要，往往两个都留不住。',
      act: '把纠结的两件事写下来，各写 3 条理由，然后今天定。',
    },
    {
      n: 7, name: '战车', en: 'The Chariot', sym: '🏇',
      kw: ['推进', '意志', '盯住目标'],
      up: '适合啃硬骨头。今天做那件你一直绕着走的事，做起来没有想象中难。',
      rev: '逆位是方向散了：同时推五件事，结果一件都没动。砍到只剩一件。',
      act: '关掉所有别的窗口，只做最难的那一件，计时 45 分钟。',
    },
    {
      n: 8, name: '力量', en: 'Strength', sym: '🦁',
      kw: ['柔韧', '耐心', '驯服'],
      up: '硬碰硬不如慢慢来。今天需要的不是爆发力，是「不着急」的力气。',
      rev: '逆位是自我怀疑上来了。你不是不行，你只是累了。',
      act: '给自己泡杯热的，什么都不干地坐 10 分钟。',
    },
    {
      n: 9, name: '隐士', en: 'The Hermit', sym: '🕯️',
      kw: ['独处', '内省', '找方向'],
      up: '今天适合一个人待着。热闹给不了答案，安静可以。少刷一会儿别人的生活。',
      rev: '逆位是躲太久了，该出来见人了。发一条消息给一个久没联系的朋友。',
      act: '关掉推荐流，写 300 字给自己看的东西。',
    },
    {
      n: 10, name: '命运之轮', en: 'Wheel of Fortune', sym: '🎡',
      kw: ['转机', '周期', '时机'],
      up: '事情在动。今天遇到的某个偶然、某条评论、某次闲聊，可能就是转折点。别错过。',
      rev: '逆位是低谷期。轮子总会转回来，你现在要做的只是别下牌桌。',
      act: '回一条你一直没回的消息。',
    },
    {
      n: 11, name: '正义', en: 'Justice', sym: '⚖️',
      kw: ['公平', '因果', '实事求是'],
      up: '今天适合做判断和取舍。数据说不行就是不不行，别用情绪替它找理由。',
      rev: '逆位是偏心了——可能对自己太苛刻，也可能对某件事太宽容。',
      act: '看一眼你的发布台账，找出数据最差的那篇，写一句它为什么差。',
    },
    {
      n: 12, name: '倒吊人', en: 'The Hanged Man', sym: '🙃',
      kw: ['换视角', '暂停', '放下'],
      up: '卡住的时候，不是要更用力。今天试着把问题倒过来问一遍，答案可能自己浮出来。',
      rev: '逆位是明知该放还攥着。有些选题、有些合作，该断了。',
      act: '把你最头疼的问题，反着写一遍。',
    },
    {
      n: 13, name: '死神', en: 'Death', sym: '🦋',
      kw: ['结束', '断舍离', '重生'],
      up: '有东西该结束了。不是坏事——旧的不腾出位置，新的进不来。今天适合断一件事。',
      rev: '逆位是拖着不肯结束。你其实早就知道该停了，只是舍不得沉没成本。',
      act: '删掉一个你三个月没动过的计划。',
    },
    {
      n: 14, name: '节制', en: 'Temperance', sym: '🍶',
      kw: ['平衡', '节奏', '调和'],
      up: '今天讲的是「刚刚好」。用力过猛和躺平都不对，找一个你能持续三个月的强度。',
      rev: '逆位是节奏乱了——要么连熬三天，要么三天不动。',
      act: '定一个你明天也做得到的量，只做那么多。',
    },
    {
      n: 15, name: '恶魔', en: 'The Devil', sym: '⛓️',
      kw: ['执念', '欲望', '被困'],
      up: '今天可能被某样东西牵着走：数据、比较、别人的评价。先看清绳子在哪，你才知道能不能解。',
      rev: '逆位是好消息——你开始松了。那个绑住你的东西，其实一直有钥匙。',
      act: '关掉数据后台，今天不看阅读量。',
    },
    {
      n: 16, name: '塔', en: 'The Tower', sym: '⚡',
      kw: ['崩塌', '真相', '重建'],
      up: '可能会有意外打断计划。别急着修，先看看塌掉的部分是不是本来就不稳。',
      rev: '逆位是你在硬撑。允许自己说一句「我搞不定了」，会轻松很多。',
      act: '把今天必须做完的事，划掉一半。',
    },
    {
      n: 17, name: '星星', en: 'The Star', sym: '⭐',
      kw: ['希望', '疗愈', '方向感'],
      up: '今天适合抬头看远一点。你现在做的事，可能半年后才见效——但这不代表它没用。',
      rev: '逆位是信心掉了。回想一下三个月前的你，其实已经走了很远。',
      act: '写下你做这件事最初的理由。',
    },
    {
      n: 18, name: '月亮', en: 'The Moon', sym: '🌗',
      kw: ['迷雾', '不安', '想象力'],
      up: '今天的信息可能不完整，别急着下结论。但梦和直觉会很好用，记下来。',
      rev: '逆位是迷雾在散。困扰你的那件事，很快就有答案了。',
      act: '把脑子里乱转的念头全写下来，不整理。',
    },
    {
      n: 19, name: '太阳', en: 'The Sun', sym: '☀️',
      kw: ['明朗', '成功', '生命力'],
      up: '今天状态会不错。适合把准备了很久的东西发出去，别压着。',
      rev: '逆位是光被挡住了——不是没能力，是心情低。今天先照顾自己。',
      act: '把最满意的那篇，今天发出去。',
    },
    {
      n: 20, name: '审判', en: 'Judgement', sym: '📯',
      kw: ['觉醒', '复盘', '重新出发'],
      up: '今天适合回头看。翻翻三个月前的东西，你会发现自己变了多少。',
      rev: '逆位是自我批判过头。复盘是为了往前走，不是为了给自己判刑。',
      act: '翻出你最早发的一条内容，重看一遍。',
    },
    {
      n: 21, name: '世界', en: 'The World', sym: '🌍',
      kw: ['圆满', '完成', '新阶段'],
      up: '有个阶段要收尾了。该庆祝就庆祝，收完再开下一局。',
      rev: '逆位是差最后一步。别在 90% 的地方停下。',
      act: '把一件做到 90% 的事，今天收尾。',
    },
  ];

  const TIPS = [
    '牌是一面镜子，照的是你本来就知道的事。',
    '塔罗不预测命运，它只是换个角度问你想怎么走。',
    '抽到不顺的牌不用慌，它提醒的是可能性，不是结局。',
    '决定权一直在你手上，牌只是陪你想一想。',
  ];

  /* ---------- 问卜：问题分类 ---------- */
  const TOPICS = [
    { key: 'career', name: '工作 / 搞钱', re: /工作|事业|赚钱|副业|项目|客户|老板|领导|升职|跳槽|离职|辞职|创业|收入|工资|offer|面试|公司|甲方|合作|变现|账号|做号|这个号|涨粉|粉丝|流量|接单/i },
    { key: 'love', name: '感情', re: /感情|喜欢|爱|恋爱|结婚|分手|复合|对象|男朋友|女朋友|老公|老婆|暧昧|相亲|告白|暗恋|前任/i },
    { key: 'relation', name: '人际 / 家庭', re: /朋友|同事|家人|父母|妈|爸|孩子|亲戚|关系|吵架|误会|沟通|婆媳|邻居|催婚/i },
    { key: 'choice', name: '选择 / 决定', re: /要不要|该不该|是否|选|决定|纠结|继续|放弃|坚持|留下|离开|还是/i },
    { key: 'self', name: '自己 / 状态', re: /焦虑|迷茫|累|内耗|自信|方向|意义|状态|情绪|坚持不下去|抑郁|孤独|自我|提不起劲|没劲|不想动|没动力|低落|空虚|丧|打不起精神/i },
    { key: 'other', name: '这件事', re: /[\s\S]*/ },
  ];

  /* ---------- 牌的能量倾向（决定怎么落到问题上） ---------- */
  const ENERGY = {
    0: 'advance', 1: 'advance', 2: 'pause', 3: 'build', 4: 'build', 5: 'build',
    6: 'choose', 7: 'advance', 8: 'advance', 9: 'pause', 10: 'build', 11: 'choose',
    12: 'pause', 13: 'release', 14: 'build', 15: 'release', 16: 'release',
    17: 'build', 18: 'pause', 19: 'advance', 20: 'choose', 21: 'advance',
  };

  /* ---------- 6 类问题 × 5 种倾向 的解读矩阵 ---------- */
  const LENS = {
    career: {
      advance: { view: '牌面在推你往前走，这件事已经有起势了，别再等「完全准备好」。', do: '今天把最想推进的那一步做掉，做完再评估。' },
      pause: { view: '现在还不是出手的时候，你缺的不是勇气，是信息。', do: '先别拍板，把这件想知道的事问清楚一件。' },
      release: { view: '这条路里有一部分该停下来了，你其实早就知道是哪部分。', do: '列出最消耗你的一项，这个月先砍掉它。' },
      choose: { view: '这题没有标准答案，只有「更像你」的那个。', do: '两个选项各写三条要付的代价，看哪个你更愿意承担。' },
      build: { view: '决定成败的是结构，不是灵感。', do: '把这件事拆成三步，今天只做第一步。' },
    },
    love: {
      advance: { view: '感情里主动一点不吃亏，藏着反而容易错过。', do: '把那句憋了很久的话，用最笨的方式说出来。' },
      pause: { view: '现在追问只会把人推远，你越急对方越退。', do: '今天先不主动联系，把注意力放回自己身上。' },
      release: { view: '某个反复消耗你的模式该结束了。', do: '写下让你委屈过三次的同一件事，看看是不是一个模式。' },
      choose: { view: '喜欢和合适，你得诚实选一个，不能都要。', do: '问自己一句：一年后还愿意为这个选择买单吗。' },
      build: { view: '感情靠日常攒，不靠一次表态。', do: '做一件很小但具体的事：一条消息、一顿饭、一句谢谢。' },
    },
    relation: {
      advance: { view: '这段关系值得你多走一步，别端着。', do: '主动开一次口，哪怕只是问一句最近怎么样。' },
      pause: { view: '先别急着解释，对方现在听不进去。', do: '搁两天，等情绪退了再谈这件事。' },
      release: { view: '有些期待该收回来了，你不是非要被理解。', do: '把「他应该」换成「他就是这样」，再看你还愿不愿意。' },
      choose: { view: '你要选的是界限，不是对错。', do: '写下你能退让的底线，就一条，然后守住它。' },
      build: { view: '关系里的安全感来自可预期，不是惊喜。', do: '定一个你们都能做到的小约定。' },
    },
    choice: {
      advance: { view: '这个方向是对的，别再反复验证了。', do: '今天把决定说出口，说给自己听也算数。' },
      pause: { view: '现在是「等一等」的时刻，不是「快一点」的时刻。', do: '给这个决定设一个截止日，在那之前不许自己再想。' },
      release: { view: '有一个选项其实已经结束了，你在拖。', do: '把已经投入的成本写下来，然后问一次：还继续吗。' },
      choose: { view: '你纠结的其实不是选项，是自己更看重什么。', do: '写出你最不能失去的那一样，答案就在那。' },
      build: { view: '不用一步到位，先搭一个能跑的版本。', do: '选一个不完美但今天就能开始的方案。' },
    },
    self: {
      advance: { view: '你的状态在回升，别用旧眼光看自己。', do: '做一件能立刻看到结果的小事，把信心攒回来。' },
      pause: { view: '累了就是累了，不需要什么重大理由。', do: '今天晚上什么都不干，早点睡。' },
      release: { view: '扛着的那件事，其实可以放下。', do: '对自己说一句「我搞不定」，看看天会不会塌。' },
      choose: { view: '你在两个自己之间做选择。', do: '写下三个月后想成为的样子，再倒推今天做什么。' },
      build: { view: '稳定比爆发更有用，你需要的是一套能持续的节奏。', do: '定一个你明天也做得到的量，只做那么多。' },
    },
    other: {
      advance: { view: '顺着这个势头走，别自己刹车。', do: '把想到的第一件事做掉，别排序。' },
      pause: { view: '先别催答案，它还没到时候。', do: '给它三天，三天后再看这件事。' },
      release: { view: '该结束的部分，结束掉才轻。', do: '删掉一件拖了很久、想起来就累的事。' },
      choose: { view: '两件事里，选更像你的那个。', do: '各写三条理由，今天定，定完不许回头。' },
      build: { view: '把想法变成一个具体动作，它才有重量。', do: '写下来，越具体越好，写到能立刻执行。' },
    },
  };

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /** 抽一张：随机牌 + 随机正逆位 */
  function draw() {
    const card = CARDS[Math.floor(Math.random() * CARDS.length)];
    const reversed = Math.random() < 0.5;
    return {
      card,
      reversed,
      text: reversed ? card.rev : card.up,
      tip: TIPS[Math.floor(Math.random() * TIPS.length)],
    };
  }

  /** 按牌阵抽牌：真实塔罗同一副牌不会重复，所以不洗回抽取 */
  function drawSpread(count) {
    const pool = CARDS.slice();
    const out = [];
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const c = pool.splice(idx, 1)[0];
      out.push({ n: c.n, reversed: Math.random() < 0.5 });
    }
    return out;
  }

  /* 牌阵定义：位置名称 + 这个位置该用什么口吻带出牌意 */
  const SPREADS = {
    one: {
      name: '一张', desc: '一问一答，最直接',
      slots: [
        { label: '当前', pre: '这张牌说的是这件事此刻的样子——' },
      ],
    },
    three: {
      name: '三张', desc: '过去 · 现在 · 走向，看整件事的脉络',
      slots: [
        { label: '过去', pre: '这件事的来处——' },
        { label: '现在', pre: '你现在站的位置——' },
        { label: '走向', pre: '照这样走下去——' },
      ],
    },
  };

  /** 识别问题类型 */
  function topicOf(question) {
    const q = String(question || '').trim();
    if (!q) return null;
    return TOPICS.find((t) => t.re.test(q)) || TOPICS[TOPICS.length - 1];
  }

  /** 针对具体问题生成解读；没问题就只给通用牌意 */
  function interpret(question, n, reversed) {
    const card = CARDS[n];
    if (!card) return null;
    const q = String(question || '').trim().slice(0, 80);
    const topic = topicOf(q);
    const energy = ENERGY[n] || 'advance';
    const lens = topic ? (LENS[topic.key] && LENS[topic.key][energy]) : null;
    return {
      question: q,
      topic: topic ? topic.name : '',
      base: reversed ? card.rev : card.up,
      lens: lens ? lens.view : '',
      action: lens ? lens.do : card.act,
    };
  }

  /** 牌阵解读：逐张给位置 + 牌意，最后统一落到问题上 */
  function interpretSpread(question, cards) {
    const q = String(question || '').trim().slice(0, 80);
    const topic = topicOf(q);
    const spread = cards.length >= 3 ? SPREADS.three : SPREADS.one;
    const items = cards.map((c, i) => {
      const card = CARDS[c.n];
      const slot = spread.slots[i] || spread.slots[spread.slots.length - 1];
      return {
        n: c.n, reversed: c.reversed, card,
        label: slot.label,
        pre: slot.pre,
        text: c.reversed ? card.rev : card.up,
      };
    });
    // 用最后一张（走向）的能量决定怎么落到问题上
    const last = cards[cards.length - 1];
    const energy = ENERGY[last.n] || 'advance';
    const lens = topic ? (LENS[topic.key] && LENS[topic.key][energy]) : null;
    return {
      question: q,
      topic: topic ? topic.name : '',
      spread: cards.length >= 3 ? 'three' : 'one',
      items,
      lens: lens ? lens.view : '',
      action: lens ? lens.do : (CARDS[last.n] ? CARDS[last.n].act : ''),
    };
  }

  window.Tarot = { CARDS, SPREADS, draw, drawSpread, todayKey, topicOf, interpret, interpretSpread };
})();
