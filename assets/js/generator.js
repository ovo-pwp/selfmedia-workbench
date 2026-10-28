/* ===== 文案引擎：结构 · 钩子 · 案例 · 金句 · 行动 · 标签 =====
 * 原则：
 *  1) 标题说"几条"，正文就写几条（数量严格一致）
 *  2) 效果类数字只用用户填的真实素材，没有就用不给数字的说法，绝不编造
 *  3) 口语化：短句 + 语气词 + 具体场景，去掉书面连接词
 */
(function () {
  'use strict';

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const pickN = (a, n) => {
    const c = a.slice();
    const out = [];
    while (out.length < n && c.length) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
    return out;
  };
  const fill = (t, map) => t.replace(/\{(\w+)\}/g, (m, k) => (map[k] !== undefined ? map[k] : m));

  /* ---------- 赛道识别 ---------- */
  const SECTORS = [
    { key: 'money',   name: '搞钱副业', re: /副业|搞钱|赚钱|存钱|攒钱|理财|收入|工资|加薪|跳槽|兼职|接单|变现|带货|佣金/ },
    { key: 'career',  name: '职场打工', re: /上班|职场|打工|裸辞|辞职|加班|领导|老板|同事|面试|简历|offer|实习|毕业|找工作|00后|打工人/ },
    { key: 'growth',  name: '自我成长', re: /自律|早起|习惯|时间管理|效率|拖延|专注|计划|复盘|焦虑|内耗|情绪|治愈|成长|性格|内向|讨好|边界|松弛|自我/ },
    { key: 'read',    name: '读书学习', re: /读书|书单|阅读|写作|学习|技能|考证|考试|考研|考公|备考|知识|认知/ },
    { key: 'family',  name: '家庭情感', re: /宝妈|育儿|亲子|孩子|带娃|父母|妈妈|爸爸|家庭|婚姻|恋爱|对象|相亲|催婚|婆媳/ },
    { key: 'health',  name: '健康生活', re: /养生|睡眠|失眠|熬夜|早睡|健康|体检|颈椎|脱发|减肥|瘦|健身|跑步|瑜伽|减脂|便秘|气血/ },
    { key: 'life',    name: '生活方式', re: /美食|做饭|菜谱|早餐|咖啡|旅行|露营|装修|租房|家居|收纳|断舍离|极简|手账|宠物|猫|狗|穿搭|护肤|化妆|好物|平替|省钱/ },
    { key: 'tech',    name: '工具效率', re: /AI|人工智能|大模型|工具|软件|手机|App|剪辑|摄影|拍视频|自媒体|博主|流量|涨粉|直播/ },
  ];
  function detectSector(text) {
    let best = { key: 'growth', name: '自我成长', hit: 0 };
    for (const s of SECTORS) {
      const m = String(text || '').match(new RegExp(s.re.source, 'g'));
      const n = m ? m.length : 0;
      if (n > best.hit) best = { key: s.key, name: s.name, hit: n };
    }
    return best;
  }

  /* ---------- 钩子 ---------- */
  const HOOKS = {
    contrast: [
      '我说句可能不讨喜的话：{topic}这件事，大部分人做的方向是反的。',
      '越{verb}的人，越拿不到结果。这话我以前也不信，直到我自己撞了墙。',
      '别再{verb}了。真的。我用了很久才承认这件事没用。',
      '关于{topic}，我踩过的坑比我知道的方法还多。今天把坑摊开说。',
      '讲个反常识的：{topic}做得好的人，往往不是最{verb}的那批。',
      '你可能不信，我在{topic}上最大的进步，是放弃了原来那套。',
    ],
    emotion: [
      '你有没有过这种时候：{scene}。',
      '这条我改了三次才发出来，因为写的时候有点难受。',
      '有件事憋挺久了，今天想说清楚。',
      '我不知道你是不是也这样——{scene}。',
      '凌晨一点还没睡，想的不是{topic}，是"我是不是不太行"。',
    ],
    suspense: [
      '今天才搞明白一件事：{topic}里最值钱的那部分，几乎所有人都在跳过。',
      '{topic}做得最好的人，其实都在偷偷干一件很笨的事。',
      '要不是我自己试了一遍，我也不信{topic}能这么简单。',
      '关于{topic}，我花了很久才想通一句话。先说结论。',
    ],
    story: [
      '去年这个时候，我还在为{topic}发愁。现在回头看，当时缺的不是方法。',
      '讲个真事。{scene}',
      '有个读者问我：{topic}到底该怎么开始。我回了一大段，后来发现可以写成一篇。',
    ],
  };

  const SCENES = {
    growth: ['手机放下又拿起来，一天就这样过去了', '明明很累，躺下又睡不着', '计划写得漂漂亮亮，第三天就废了', '看到别人进步，心里咯噔一下', '想做的事一大堆，一件都没开始'],
    career: ['周一到工位，先叹一口气', '开会两小时，一句有用的没有', '加班到很晚，回头想想不知道忙了啥', '群里 @全员，心跳先快一下', '想辞职又不敢，留着又难受'],
    money: ['工资到账，还完款就剩个零头', '刷到别人月入几万，自己默默划走', '想搞点副业，不知道从哪下手', '报过课，学完啥也没干', '存款数字三个月没动过'],
    read: ['书买回来拆了塑封，就没翻过', '收藏了几百篇干货，一篇没看完', '想学点东西，一打开就困', '笔记记了一堆，用的时候一个也想不起来', '计划一年读五十本，读了五本'],
    family: ['孩子睡了，才有一点自己的时间', '跟家里人说话，三句就能吵起来', '想陪孩子，又怕耽误工作', '父母老了，我还没准备好', '明明很爱，说出口就成了刺'],
    health: ['说好早睡，一刷就到两点', '腰一弯下去，起来要缓一下', '体重秤上的数字，比上个月又多了', '明明没干什么，就是累', '体检报告不敢细看'],
    life: ['房间收拾完，两天又乱了', '想吃得健康，最后还是点了外卖', '看到好看的家，再看看自己的', '东西越来越多，心越来越挤', '一天到晚在忙，生活没变好'],
    tech: ['收藏了二十个工具，一个没用', '剪个视频，软件开了就关', 'AI 更新太快，学不过来', '想做账号，发了两条就没下文', '写完就发，发完就没人看'],
  };

  const VERBS = {
    growth: ['自律', '逼自己', '靠意志力', '拼命努力'],
    career: ['加班', '忍耐', '死磕', '熬'],
    money: ['追风口', '瞎折腾', '看别人做什么就跟着做', '省钱'],
    read: ['囤课', '收藏干货', '做笔记', '读书'],
    family: ['讲道理', '忍着不说', '付出', '操心'],
    health: ['硬撑', '熬着', '减肥', '进补'],
    life: ['买东西', '收拾', '计划', '讲究'],
    tech: ['追新工具', '埋头剪', '堆素材', '报班'],
  };

  /* ---------- 收藏引导 ---------- */
  const SAVES = [
    '先点个收藏吧，下面几条你以后一定用得上。',
    '这篇不短，建议收藏，回头照着做一遍。',
    '看到这儿先收藏。刷走了，就真的找不回来了。',
    '我怕你记不住，建议收藏 + 顺手转给自己。',
    '收藏一下，等你哪天卡住了，翻开就是答案。',
  ];

  /* ---------- 金句 ---------- */
  const QUOTES = {
    growth: [
      '你不需要变成另一个人，你只需要把现在这个人用对地方。',
      '改变不是从"想通了"开始的，是从"今天做了一件小事"开始的。',
      '大多数人的问题不是不够努力，是努力的方向根本不通向结果。',
      '自律不是把自己按在地上摩擦，是让该发生的事自己发生。',
      '所谓松弛感，是手里有牌，心里不慌。',
    ],
    career: [
      '你以为的稳定，其实是把风险攒起来了，一次还给你。',
      '工资不是公司给你的，是你替市场解决问题换来的。',
      '在职场，能被替代的努力，都不算筹码。',
      '别用忙碌掩盖不成长。忙和值钱，是两回事。',
      '能让你走远的，从来不是加班，是稀缺。',
    ],
    money: [
      '赚小钱靠力气，赚稳钱靠信息差，赚大钱靠复利。',
      '门槛越低的路，走得人越多，越难挣到钱。',
      '第一笔钱从来不是为了发财，是为了让你相信自己能做到。',
      '别急着找捷径，先把一条笨路走通。',
      '存钱的意义不是抠，是给自己留"不干"的底气。',
    ],
    read: [
      '读书不是为了知道更多，是为了发现自己一直在骗自己。',
      '学了很多却没用上，等于没学。',
      '知识只有变成动作，才叫本事。',
      '一本书能改掉你一个习惯，这书就值了。',
      '慢慢来，但别停。',
    ],
    family: [
      '家不是讲道理的地方，是讲感受的地方。',
      '你以为你在为孩子好，孩子以为你在为自己好。',
      '很多关系的裂缝，是从"算了不说了"开始的。',
      '被好好爱过的人，说话是有底气的。',
      '父母在，人生尚有来处。',
    ],
    health: [
      '身体不跟你商量，它只记账。',
      '养生不是吃补品，是把觉睡够。',
      '你熬的每一个夜，都是提前透支的明天。',
      '最好的养生是情绪稳定。',
      '健康是那种失去了才知道贵的东西。',
    ],
    life: [
      '生活变好，往往是从一件很小的事开始的。',
      '你不是不会生活，你是没给自己留时间。',
      '把家里收拾干净，心里的事就少了一半。',
      '仪式感不贵，贵的是你愿意为自己花心思。',
      '过得讲究一点，人就有精神一点。',
    ],
    tech: [
      '工具不改变命运，用工具做出的东西才会。',
      '别人用 AI 省时间，你不用，你就被时间追着跑。',
      '所有的爆款，都是把一个真问题讲透了。',
      '先做完，再做好。',
      '内容这事，堆量能救审美。',
    ],
  };

  /* ---------- 行动号召 ---------- */
  const CTAS = {
    gongzhonghao: [
      '你在这件事上是怎么做的？评论区说一句，我会一条条看。',
      '如果这篇戳到你了，点个"在看"，让更多人看见。',
      '先挑一条去做。做完回来告诉我结果，我等着。',
      '你最近在为什么事卡着？留言告诉我，我下次单独写。',
    ],
    xiaohongshu: [
      '你卡在哪一步？评论区说，我一条条回 🫶',
      '有用的话点个赞让我知道，我下次多写这个方向～',
      '先收藏！明天照着做第一条就行 ✅',
      '评论区聊聊：你最近最想搞定的一件事是什么？',
    ],
    shipinhao: [
      '你先从第一条开始做，做完在评论区告诉我结果。',
      '觉得有用，点个赞、转给那个需要的人。',
      '关注我，明天讲怎么把这条落地。',
      '你卡在哪一步？评论区留一句，我挑着回。',
    ],
    douyin: [
      '先收藏，别到时候找不着了。',
      '你现在就试第一条，回来告诉我怎么样。',
      '关注我，这类实在的东西我天天更。',
      '评论区说说你做到第几条了。',
    ],
  };

  /* ---------- 正文要点模板（按赛道，保证"说几条就是几条"） ---------- */
  const POINT_BANK = {
    growth: [
      ['先砍掉一半目标', '你不是做不到，是想做的太多。把清单砍到只剩三件，剩下的全划掉，心里立刻就轻了'],
      ['把动作拆到"不用动脑"的程度', '不是"今天要学习"，是"翻开书读两页"。门槛低到不可能拒绝，才做得下去'],
      ['用一个固定锚点绑住它', '起床后、刷牙后、通勤路上——绑在一个每天必做的事后面，比定闹钟管用'],
      ['允许自己做得很烂', '完美主义是拖延的另一种说法。先写出垃圾版，再改'],
      ['记录，但别打卡上瘾', '记的是"今天做了什么"，不是"今天有没有达标"。前者给人力量，后者给人压力'],
      ['给自己设一个最小的底线', '状态再差也能做到的那种。生病、加班、心情崩了，只做底线，不算断'],
    ],
    career: [
      ['先搞清楚"谁为你的工作买单"', '不是领导，是客户或者业务结果。搞清楚这条，很多委屈就不成立了'],
      ['把"忙"翻译成"产出"', '每天下班前问一句：今天我留下了什么能被看见的东西'],
      ['找一件只有你能干的事', '哪怕是"全组最会做表"。有一件不可替代的，你就站得住'],
      ['学会说不，但要给方案', '直接拒绝是情绪，带着替代方案拒绝才是能力'],
      ['给自己留一条后路', '简历每半年更新一次，不是想跳，是知道自己值多少'],
      ['跟对人比埋头干重要', '看你的直属领导有没有在往上走，他不动，你也动不了'],
    ],
    money: [
      ['先选"交付物清楚"的活', '对方一眼知道你要交什么，你就不用反复解释，成交快'],
      ['从你已经在做的事里找', '会做表、会写文案、会拍照、会带娃——都是能换钱的技能'],
      ['第一单不要想着赚', '先跑通一次完整流程，把坑踩完，后面的单才快'],
      ['把报价拆成"套餐"', '不要给对方一个数字，给三个：基础/标准/加急。选择比谈判省力'],
      ['先收定金再开工', '这一条能挡掉八成的白干'],
      ['每月留出固定的一笔"不动钱"', '哪怕很少。它的作用是让你敢拒绝烂活'],
    ],
    read: [
      ['一本书只带走一个动作', '读完问自己：我要改哪一个具体行为。改不动，就等于没读'],
      ['带着问题读，不是从第一页读', '先看目录，找能回答你当下问题的章节，读完再补'],
      ['用自己的话讲一遍', '讲不出来就是没懂。讲给朋友听，或者写下来'],
      ['做"最小可用笔记"', '三行：说了什么、我原来怎么想、我准备怎么做'],
      ['同一主题连读三本', '三本一起看，重复的部分就是重点，矛盾的部分就是要思考的地方'],
      ['学完立刻用一次', '不用就会忘。哪怕只是在家试一次'],
    ],
    family: [
      ['先接住情绪，再谈事情', '"我知道你难受"这句话，比十句道理有用'],
      ['把"你怎么又"换成"我看到"', '描述事实，不评价人。对方就不会立刻防御'],
      ['每天留十分钟"不看手机的时间"', '质量不在时长，在你是不是真的在'],
      ['别在孩子面前翻旧账', '孩子记住的不是道理，是那个气氛'],
      ['把要求说成一个具体动作', '不是"你要懂事"，是"吃完饭把碗放水池里"'],
      ['先照顾自己，再照顾别人', '你空了，给出去的都是怨气'],
    ],
    health: [
      ['先定睡觉时间，其他都往后排', '睡不够，什么方法都白搭'],
      ['把水杯放在看得见的地方', '改环境比改意志力容易一百倍'],
      ['每天走够步数，不追求强度', '能坚持的低强度，胜过坚持不了的高强度'],
      ['久坐一小时就起来两分钟', '腰和颈椎的账，都是坐出来的'],
      ['晚饭少一口，比什么减肥法都稳', '不用戒，只要少'],
      ['情绪上来先深呼吸十次', '很多身体的毛病，根子在情绪'],
    ],
    life: [
      ['先把"看得见的地方"收拾干净', '桌面、玄关、床头。三处干净，人就清爽'],
      ['东西只留"在用"和"真喜欢"的', '剩下的不是扔，是送出去，让它去该去的地方'],
      ['建一个三分钟的日常', '睡前擦桌子、早上叠被子。小到不会失败'],
      ['一周做一次饭给自己', '不是发朋友圈那种，是自己吃着舒服那种'],
      ['买之前问一句：我会用几次', '这一句话能省掉八成的冲动消费'],
      ['给周末留一个"什么都不干"的半天', '不安排，才是休息'],
    ],
    tech: [
      ['先定"要交付什么"，再选工具', '工具换得再勤，方向错了都白费'],
      ['把重复动作做成模板', '模板一次做好，后面每次都省时间'],
      ['先做完一条完整的内容', '哪怕粗糙。做完一条，你就知道流程卡在哪'],
      ['研究同赛道的前十条爆款', '拆开头、拆结构、拆结尾，抄结构不抄内容'],
      ['每天固定一个"只做内容"的时间段', '不刷手机，不回消息，就做这一件事'],
      ['发出去，然后看数据', '不看数据的创作，等于闭眼走路'],
    ],
  };

  /* ---------- 平台风格 ---------- */
  const PLATFORM_CFG = {
    gongzhonghao: { name: '公众号', titleCount: 5, emoji: false, sep: '\n\n', tagCount: 4, maxPointLen: 200 },
    xiaohongshu: { name: '小红书', titleCount: 6, emoji: true, sep: '\n\n', tagCount: 8, maxPointLen: 90 },
    shipinhao: { name: '视频号', titleCount: 4, emoji: false, sep: '\n\n', tagCount: 5, maxPointLen: 70 },
    douyin: { name: '抖音', titleCount: 4, emoji: false, sep: '\n\n', tagCount: 5, maxPointLen: 70 },
  };

  /* ---------- 标题生成 ---------- */
  function titles(topic, points, sectorName, platform, angle) {
    const n = points;
    const base = [
      `${topic}：我踩过的 ${n} 个坑，你别再踩了`,
      `关于${topic}，说 ${n} 句大实话`,
      `${topic}做不好，八成是这 ${n} 件事没搞对`,
      `我把${topic}重做了一遍，总结出 ${n} 条`,
      `${n} 条${topic}的笨办法，但真管用`,
      `别再瞎试了，${topic}就这 ${n} 步`,
      `${topic}这件事，我想说 ${n} 点`,
      `说 ${n} 个${topic}的真相，有点扎心`,
      `如果重来一次，${topic}我会这么做（${n} 条）`,
      `${n} 个让${topic}变简单的动作`,
    ];
    const xhs = [
      `${topic}｜我总结了 ${n} 条，第 3 条最有用✨`,
      `真的会谢！${topic}原来只要 ${n} 步`,
      `${topic}别乱试了😭 这 ${n} 条亲测有效`,
      `搞懂${topic}，我只用了这 ${n} 个方法`,
      `${topic}踩坑记录｜${n} 条血泪经验`,
      `建议收藏｜${topic}的 ${n} 个关键动作`,
    ];
    const video = [
      `${topic}，${n} 句话讲明白`,
      `${topic}的 ${n} 个坑，第 ${Math.min(2, n)} 个最要命`,
      `${n} 条${topic}的实话，可能不太好听`,
      `${topic}怎么做？我说 ${n} 点`,
    ];
    let pool = base;
    if (platform === 'xiaohongshu') pool = xhs;
    else if (platform === 'shipinhao' || platform === 'douyin') pool = video;
    const out = pickN(pool, PLATFORM_CFG[platform].titleCount);
    // 保证首条带数字，符合"标题说几条就是几条"
    out.unshift(base[0]);
    return [...new Set(out)].slice(0, PLATFORM_CFG[platform].titleCount);
  }

  /* ---------- 正文 ---------- */
  function buildBody({ topic, sector, platform, points, materials, angle }) {
    const cfg = PLATFORM_CFG[platform] || PLATFORM_CFG.gongzhonghao;
    const sec = sector.key;
    const hook = fill(pick(HOOKS[angle] || HOOKS.contrast), {
      topic,
      verb: pick(VERBS[sec] || VERBS.growth),
      scene: pick(SCENES[sec] || SCENES.growth),
    });
    const save = pick(SAVES);
    const bank = POINT_BANK[sec] || POINT_BANK.growth;
    const chosen = pickN(bank, Math.min(points, bank.length));

    const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
    const plainNums = ['一', '二', '三', '四', '五', '六', '七', '八'];
    const useEmojiNum = platform === 'xiaohongshu';

    const blocks = [];
    blocks.push(fill(hook, { topic }));

    // 真实素材优先插入
    const story = materials && materials.stories && materials.stories.length ? pick(materials.stories) : '';
    if (story) {
      blocks.push(platform === 'xiaohongshu' ? `先说个我自己的事：${story}` : `先说个真事。${story}`);
    }

    blocks.push(save);

    if (platform === 'gongzhonghao') {
      blocks.push(`下面这 ${points} 条，是我自己一条条试出来的，不是抄来的。`);
    } else if (platform === 'xiaohongshu') {
      blocks.push(`下面这 ${points} 条，都是我踩过坑才明白的👇`);
    } else {
      blocks.push(`下面这 ${points} 条，你听完就能用。`);
    }

    chosen.forEach((p, i) => {
      const [head, desc] = p;
      const mark = useEmojiNum ? nums[i] : (platform === 'gongzhonghao' ? plainNums[i] + '、' : `${i + 1}. `);
      let line = desc;
      if (line.length > cfg.maxPointLen) line = line.slice(0, cfg.maxPointLen);
      if (useEmojiNum) {
        blocks.push(`${mark} ${head}\n${line}`);
      } else {
        blocks.push(`${mark}${head}\n${line}`);
      }
    });

    // 案例（用户素材）
    if (materials && materials.cases && materials.cases.length) {
      const c = pick(materials.cases);
      blocks.push((platform === 'xiaohongshu' ? '再讲个例子🌰：' : '再讲个例子。') + c);
    }

    // 金句
    const q = materials && materials.quotes && materials.quotes.length
      ? pick(materials.quotes)
      : pick(QUOTES[sec] || QUOTES.growth);
    blocks.push(platform === 'xiaohongshu' ? `💬 ${q}` : q);

    // 行动号召
    blocks.push(pick(CTAS[platform] || CTAS.gongzhonghao));

    const body = blocks.join(cfg.sep);

    if (platform === 'shipinhao' || platform === 'douyin') {
      const secs = Math.max(45, Math.round(body.length / 4.2));
      return `【口播稿 · 约 ${Math.min(90, secs)} 秒】\n\n【前3秒 钩子 · 直视镜头】\n${fill(hook, { topic })}\n\n【正文 · 语速稍快，每讲完一条停半秒】\n${chosen.map((p, i) => `${i + 1}、${p[0]}。${p[1]}`).join('\n')}\n\n【结尾 · 看向镜头，放慢】\n${pick(CTAS[platform])}\n\n【字幕条】${topic}`;
    }
    return body;
  }

  /* ---------- 标签 ---------- */
  const TAG_BANK = {
    growth: ['#自我成长', '#自律', '#情绪管理', '#内耗', '#女生成长', '#普通人逆袭'],
    career: ['#职场', '#打工人', '#职场生存', '#上班日常', '#打工人日常', '#职场干货'],
    money: ['#副业', '#搞钱', '#存钱', '#普通人搞钱', '#副业推荐', '#赚钱思路'],
    read: ['#读书', '#读书笔记', '#学习方法', '#自我提升', '#书单', '#成长'],
    family: ['#亲子', '#家庭教育', '#婚姻', '#情感', '#宝妈日常', '#原生家庭'],
    health: ['#养生', '#健康生活', '#早睡', '#减肥', '#颈椎', '#好好吃饭'],
    life: ['#生活方式', '#断舍离', '#收纳', '#租房改造', '#日常', '#小确幸'],
    tech: ['#自媒体', '#AI工具', '#效率工具', '#短视频', '#涨粉', '#副业'],
  };

  function tags(topic, sector, platform) {
    const cfg = PLATFORM_CFG[platform] || PLATFORM_CFG.gongzhonghao;
    const base = pickN(TAG_BANK[sector.key] || TAG_BANK.growth, Math.max(2, cfg.tagCount - 2));
    const clean = String(topic).replace(/[《》""''\s·、，,。.]/g, '');
    const t = [`#${clean.slice(0, 12)}`, ...base];
    return [...new Set(t)].slice(0, cfg.tagCount);
  }

  /* ---------- 主入口 ---------- */
  function generate({ topic, platform = 'gongzhonghao', points = 5, angle, materials = {} }) {
    const sector = detectSector(topic);
    const ang = angle || pick(['contrast', 'contrast', 'suspense', 'story', 'emotion']);
    const t = titles(topic, points, sector.name, platform, ang);
    const body = buildBody({ topic, sector, platform, points, materials, angle: ang });
    return {
      topic, platform, sector: sector.name, sectorKey: sector.key, angle: ang,
      points, titles: t, body, tags: tags(topic, sector, platform),
      generatedAt: new Date().toISOString(),
    };
  }

  window.CopyGen = { generate, detectSector, PLATFORM_CFG, SECTORS };
})();
