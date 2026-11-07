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

  /* ---------- 赛道识别 ----------
   * 关键设计：赛道不只是「词汇分类」，它决定正文的**结构**。
   *   mode: 'method'  —— 可执行类（怎么搞钱/怎么自律），正文是「N 个具体动作」
   *   mode: 'comment' —— 观察评论类（消费现象/社会话题），正文是「N 个观察和判断」
   * 之前所有赛道都走 method 结构，所以「10 元快剪」会被写成「先砍掉一半目标」，
   * 跟话题毫无关系——这是模板腔的真正根源，不是措辞问题。
   */
  /* weight 是该赛道的优先级系数：通用词（上班/孩子/钱）权重低，
   * 特征词（快剪/预制菜/抽成）权重高。否则「撞脸王祖贤女生去景区上班」
   * 会因为一个「上班」被误判成职场话题。
   */
  const SECTORS = [
    { key: 'money',   name: '搞钱副业', mode: 'method',  w: 1.0, re: /副业|搞钱|赚钱|存钱|攒钱|理财|收入|工资|加薪|跳槽|兼职|接单|变现|带货|佣金|月薪|年终奖|存款|数币|数字人民币/ },
    { key: 'career',  name: '职场打工', mode: 'method',  w: 0.8, re: /辞职|裸辞|加班|领导|老板|同事|面试|简历|offer|实习|毕业|找工作|00后|打工人|裁员|晋升|绩效|上班|职场|打工/ },
    { key: 'growth',  name: '自我成长', mode: 'method',  w: 0.9, re: /自律|早起|习惯|时间管理|效率|拖延|专注|计划|复盘|焦虑|内耗|情绪|治愈|成长|性格|内向|讨好|边界|松弛|自我|坚持/ },
    { key: 'read',    name: '读书学习', mode: 'method',  w: 1.0, re: /读书|书单|阅读|写作|学习|技能|考证|考试|考研|考公|备考|知识|认知|英语|记忆/ },
    { key: 'health',  name: '健康生活', mode: 'method',  w: 1.0, re: /养生|睡眠|失眠|熬夜|早睡|健康|体检|颈椎|脱发|减肥|瘦|健身|跑步|瑜伽|减脂|便秘|气血|血糖|血压|三高|鸡蛋|饮食|营养|吃什么/ },
    { key: 'life',    name: '生活方式', mode: 'method',  w: 0.9, re: /美食|做饭|菜谱|早餐|咖啡|旅行|露营|装修|租房|家居|收纳|断舍离|极简|手账|宠物|猫|狗|穿搭|护肤|化妆|好物|平替|省钱|景区|秋叶|换季/ },
    { key: 'tech',    name: '工具效率', mode: 'method',  w: 1.0, re: /AI|人工智能|大模型|工具|软件|手机|App|剪辑|摄影|拍视频|自媒体|博主|流量|涨粉|直播|算法/ },
    /* ↓ 新增：这两类是热榜主力，之前全被错判成「自我成长」 */
    { key: 'consume', name: '消费观察', mode: 'comment', w: 1.6, re: /快剪|理发|设计总监|办卡|会员|续费|智商税|套路|霸王条款|抽成|团购|折扣|消费|买单|退货|预制菜|涨价|降价|收费|价格|性价比|贵|便宜/ },
    { key: 'society', name: '社会话题', mode: 'comment', w: 1.5, re: /老人|养老|退休|年轻人|中年人|独居|空巢|生育|彩礼|相亲|催婚|离婚|结婚|代际|城乡|返乡|县城|就业|失业|内卷|躺平|摆烂|搭伙|陪伴|爸妈|父母/ },
    { key: 'family',  name: '家庭情感', mode: 'comment', w: 1.1, re: /宝妈|育儿|亲子|孩子|带娃|妈妈|爸爸|家庭|婚姻|恋爱|对象|婆媳|原生家庭|亲子关系|女儿|儿子/ },
  ];

  /* 打分：命中次数多者胜；同分时比命中字符总长度（长词更具体，更可信） */
  function detectSector(text) {
    const src = String(text || '');
    let best = null;
    for (const s of SECTORS) {
      const hits = src.match(s.re) || [];
      if (!hits.length) continue;
      // 命中词的总长度 × 赛道权重：长词更具体，权重高的赛道更该抢到判定
      const weight = hits.reduce((a, h) => a + h.length, 0) * (s.w == null ? 1 : s.w);
      const cur = { key: s.key, name: s.name, mode: s.mode, hit: hits.length, weight: Math.round(weight * 10) / 10 };
      if (!best || weight > best.weight || (weight === best.weight && hits.length > best.hit)) best = cur;
    }
    // 一个都没命中：带「怎么/如何」的多半是方法论，硬套评论结构会写出
    // 「我不太同意…这种说法」这种和话题无关的钩子
    if (!best && /怎么|如何|怎样|方法|步骤|技巧|教程|攻略|入门/.test(src)) {
      return { key: 'growth', name: '自我成长', mode: 'method', hit: 0, weight: 0 };
    }
    // 其余纯情绪/观点类，走 comment 结构比硬套方法论自然
    return best || { key: 'society', name: '社会话题', mode: 'comment', hit: 0, weight: 0 };
  }

  /* ---------- 正文结构：method（动作）vs comment（观察） ---------- */
  const MODE_INTRO = {
    method: {
      gongzhonghao: '下面这 {n} 条，是我自己一条条试出来的，不是抄来的。',
      xiaohongshu: '下面这 {n} 条，都是我踩过坑才明白的👇',
      shipinhao: '下面这 {n} 条，你听完就能用。',
      douyin: '下面这 {n} 条，你听完就能用。',
    },
    comment: {
      gongzhonghao: '下面这 {n} 条，是我把这件事翻来覆去想了几遍才理清的。',
      xiaohongshu: '我拆了 {n} 条，看完你大概会有点想法👇',
      shipinhao: '这件事我讲 {n} 个点，讲完你就明白了。',
      douyin: '这件事我讲 {n} 个点。',
    },
  };

  /* 评论类的内容推进：现象 → 原因 → 代价 → 谁受影响 → 判断 */
  const SCENES = {
    growth: ['手机放下又拿起来，一天就这样过去了', '明明很累，躺下又睡不着', '计划写得漂漂亮亮，第三天就废了', '看到别人进步，心里咯噔一下', '想做的事一大堆，一件都没开始'],
    career: ['周一到工位，先叹一口气', '开会两小时，一句有用的没有', '加班到很晚，回头想想不知道忙了啥', '群里 @全员，心跳先快一下', '想辞职又不敢，留着又难受'],
    money: ['工资到账，还完款就剩个零头', '刷到别人月入几万，自己默默划走', '想搞点副业，不知道从哪下手', '报过课，学完啥也没干', '存款数字三个月没动过'],
    read: ['书买回来拆了塑封，就没翻过', '收藏了几百篇干货，一篇没看完', '想学点东西，一打开就困', '笔记记了一堆，用的时候一个也想不起来', '计划一年读五十本，读了五本'],
    family: ['孩子睡了，才有一点自己的时间', '跟家里人说话，三句就能吵起来', '想陪孩子，又怕耽误工作', '父母老了，我还没准备好', '明明很爱，说出口就成了刺'],
    health: ['说好早睡，一刷就到两点', '腰一弯下去，起来要缓一下', '体重秤上的数字，比上个月又多了', '明明没干什么，就是累', '体检报告不敢细看'],
    life: ['房间收拾完，两天又乱了', '想吃得健康，最后还是点了外卖', '看到好看的家，再看看自己的', '东西越来越多，心越来越挤', '一天到晚在忙，生活没变好'],
    tech: ['收藏了二十个工具，一个没用', '剪个视频，软件开了就关', 'AI 更新太快，学不过来', '想做账号，发了两条就没下文', '写完就发，发完就没人看'],
    consume: ['坐下刚说剪短一点，接下来三十分钟全在聊办卡', '价目表上一排头衔，从助理到首席，一级一个价', '只是想剪个头，最后要拒绝三拨人', '结账时被问"要不要充值，充五百送两百"', '明明只想买个基础款，被推着加了三个配件'],
    society: ['电话打过来，聊了十分钟，谁都没说想对方', '一年回去十几天，剩下三百多天靠电话', '想回回不去，想留留不下，卡在中间', '亲戚聚在一起，问的都是挣多少、什么时候结婚', '父母的体检报告，我比他们自己还紧张'],
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
    consume: ['为品牌溢价买单', '图省事', '不好意思拒绝', '认贵就是好'],
    society: ['硬扛', '报喜不报忧', '把话说一半', '等到有空再说'],
  };

  /* 评论类内容池。
   * 每条格式：[标题, 正文, 适用条件（可选正则）]。
   * 带条件的条目只有话题命中该正则时才会被抽到——
   * 这样「差价在名头不在手艺」不会出现在「外卖涨价」的稿子里。
   * 没带条件的条目是通用判断，任何同赛道话题都能用。
   */
  const COMMENT_BANK = {
    consume: [
      /* —— 通用：任何消费现象都能用 —— */
      ['自己算一遍账，比听谁说都清楚', '一个月几次、每次多少、一年下来差多少。数字摆出来，该选哪个一目了然', null],
      ['这不是小气，是账算明白了', '愿意花钱和愿意花明白钱，是两件事。前者叫大方，后者叫清醒', null],
      ['真正在做选择的是钱包，不是嘴', '嘴上说贵，脚还是会走。所有人的选择加起来，就是这个行业的方向', null],
      ['便宜也有代价，得认', '省了钱就得多担点麻烦：体验没那么舒服，有些需求它接不了，出了问题也没人专门伺候你', null],
      ['贵的从来不是东西，是"省事"', '同样的结果，你花钱买的是不用自己想、不用自己动手、不用担责任。这三样才是溢价', null],
      ['信息在谁手里，钱就流向谁', '同一个东西，懂行的人拿一个价，不懂的人拿另一个价。差价不写在价目表上', null],
      ['价格是标签，账单才是真相', '标价只写了起步，真正的花销在加项里。买之前先问清楚"还要另外加什么"', null],
      ['越是着急的时候，越容易被加价', '赶时间、怕麻烦、不好意思拒绝——商家最懂这三点，也最会利用这三点', null],
      ['所有套路能成立，都靠你不问', '一句"这个包含在里面吗"，能挡掉一半的坑。问不丢人，不问才贵', null],
      ['别为看不懂的东西付钱', '你说不清它到底贵在哪，那它就是不值。说不清的部分，通常是营销费', null],

      /* —— 专属：只在命中对应关键词时出现 —— */
      ['差价在名头，不在手艺', '同一件事被切成助理、技师、总监、首席，一级一个价。可落到手上的动作还是那几下', /理发|剪|头衔|总监|技师|等级/],
      ['便宜，是因为它只卖一件事', '把洗头、吹造型、寒暄、推销全砍掉，只留下最核心的那一步。它不是做得差，是它不卖别的', /快剪|标准|简化|只做|自助/],
      ['人到门口就怕了，怕的不是花钱', '怕的是坐下那一刻起，你就成了销售目标。一句接一句的"要不要办张卡"，比价格更劝退', /办卡|推销|会员|充值|续费|套餐/],
      ['被淘汰的不是贵的，是没价值的贵', '有人愿意为环境、为安静、为不用自己动手付钱。撑不住的是那种：装修很贵、名头很多、东西一般、全程推销', /店|门店|装修|行业|连锁/],
      ['抽成抽走的不是钱，是选择权', '平台定多少，你只能接多少。看着是自由接单，其实是没得选', /抽成|佣金|骑手|网约车|接单平台/],
      ['涨价的理由里，很少有"东西变好了"', '多是房租涨了、人工涨了、平台抽多了。成本往上走，落到你手上的东西却没变', /涨|贵|价格|成本|套餐/],
      ['办卡的本质，是让你提前付钱', '一次性收走一年的钱，风险全转到你这边。人跑了、店关了，你连追的地方都没有', /办卡|预付|充值|年卡|储值/],
      ['套路之所以有效，是因为它专挑你的不好意思', '拒绝一次很难，拒绝三次更难。多数人不是认了，是累了', /推销|套路|拒绝|办卡|续费/],
    ],
    society: [
      /* —— 通用 —— */
      ['一件事吵成两派，通常两边都没说到点上', '所有人都在争"该不该"，很少有人先问"为什么只能这么选"。前提不谈清，结论永远对立', null],
      ['把个体选择当成品性问题，永远聊不明白', '一个人怎么选，往往不是他想通了，是他手上只有这些牌。这不是认知问题，是条件问题', null],
      ['别急着评价别人怎么选', '你没走过他那条路，就不知道他权衡了什么。评价之前，先想想自己会怎么选', null],
      ['变化先发生在没人注意的地方', '等到所有人都开始聊，事情其实已经变了很久。真正值得看的，是那些还没被总结的部分', null],
      ['每一次讨论，最后都落在同一批人身上', '论战很热闹，但代价是具体的人在承担。这批人最少被问到，也最少被听见', null],
      ['拿平均数说事，最容易骗人', '平均涨了多少、平均多少岁，跟具体某个人的处境没关系。看平均，看不出难', null],
      ['嘴上说的和实际做的，常常是两件事', '问想要什么，答案都体面；看实际怎么选，才是真实想法。后者更可信', null],
      ['最容易被忽略的，是没意见的那批人', '会发声的只是一部分。沉默的人不是没有处境，是没力气说', null],

      /* —— 专属 —— */
      ['中间那代人最难受', '上有老下有小，想回回不去，想留留不下。所有讨论最后都压在这批人肩上，可他们最少被问到', /老人|养老|父母|中年|独居|空巢|孩子|带娃/],
      ['缺的往往不是钱，是"被惦记"', '有人给钱给物，但没人问一句今天吃了什么。这两件事完全不等价，也只是其中一件能用钱买', /老人|养老|独居|空巢|陪|孤/],
      ['最难过的是心里那道坎', '真去做了，先过不去的常常是自己。旁人还没开口，自己先给自己定了罪', /请人|代|外包|孝|亏欠|内疚/],
      ['能听同一个人把同一个故事讲第三遍还不烦，这才是门槛', '技术好学，耐心学不来。真正的稀缺从来不是知识，是愿意花时间', /服务|陪伴|护工|保姆|照顾/],
      ['你能做的其实很便宜', '固定时间打个电话，问吃了什么，别问身体。成本几乎为零，但很少有人真的做到', /老人|父母|陪伴|家/],
      ['代际之间的分歧，多半是时代差，不是对错', '他们二十岁时面对的世界和你二十岁时完全不同。用现在的标准评判当年的选择，不公平', /老一辈|父母|代际|年轻人|观念|催婚/],
      ['独居不是问题，失去连接才是', '一个人住可以过得好，真正难的是没人可联系。热闹和连接是两回事', /独居|一个人|空巢|单身/],
      ['"为你好"是最难反驳的一句话', '出发点越好，越不好拒绝。可感受是自己的，好不好只有自己知道', /父母|孩子|催婚|相亲|家人|管/],
    ],
    family: [
      ['{topic}，先接住情绪，再谈事情', '一句"我知道你难受"，比十句道理有用。道理都懂，人需要的是先被看见', null],
      ['把"你怎么又"换成"我看到"', '描述事实，不评价人。一开口就是判词，对方立刻会竖起防御', null],
      ['每天留十分钟不看手机的时间', '质量不在时长，在你是不是真的在场。人坐在旁边，眼睛在屏幕上，等于没陪', null],
      ['先照顾自己，再照顾别人', '你空了，给出去的都是怨气。这不是自私，这是可持续的前提', null],
      ['很多裂缝是从"算了不说了"开始的', '一次次咽下去的话不会消失，会变成距离。关系不是被大事毁掉的，是被沉默', null],
      ['爱要说出口，也要说具体', '不说对方猜不到，说了不具体对方做不到。这两步任缺一步，都白搭', null],
      ['要求越抽象，失望越具体', '不是"你要懂事"，是"吃完饭把碗放水池里"。抽象的期待只会变成互相失望', null],
      ['别在孩子面前翻旧账', '孩子记住的从来不是道理，是那个气氛。他长大后复制的是当时的语气，不是内容', /孩子|娃|亲子|教育/],
    ],
  };

  /* ---------- 收藏引导 ---------- */
  const SAVES = [
    '先点个收藏吧，下面几条你以后一定用得上。',
    '这篇不短，建议收藏，回头照着做一遍。',
    '看到这儿先收藏。刷走了，就真的找不回来了。',
    '我怕你记不住，建议收藏 + 顺手转给自己。',
    '收藏一下，等你哪天卡住了，翻开就是答案。',
  ];

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

  /* ---------- 钩子（按 mode 分） ----------
   * 观察评论类不能用"我自己试了一遍"这种语气——你没法"试"一个社会现象，
   * 硬套会让整篇读起来很假。
   */
  const HOOKS_COMMENT = {
    contrast: [
      '关于{topic}，我想说的和主流观点不太一样。',
      '{topic}这件事，吵得最凶的那批人，其实没说到点上。',
      '聊{topic}之前，先说个被忽略的前提。',
      '{topic}看着是个小问题，往下挖才发现不是。',
      '我不太同意"这是个人选择"这种说法，{topic}不是。',
    ],
    emotion: [
      '你有没有过这种时候：{scene}。',
      '写这条的时候我犹豫了一下，因为说出来的话有点不好听。',
      '有件事憋挺久了，今天想说清楚。',
      '我不知道你是不是也这样——{scene}。',
      '这个话题吵了很多轮，但很少有人问：当事人自己怎么想。',
    ],
    suspense: [
      '{topic}里最值得看的那部分，几乎所有人都跳过了。',
      '把{topic}翻来覆去想了几遍，我发现真正的问题不在表面。',
      '关于{topic}，我先说一个反直觉的观察。',
      '{topic}这件事，答案可能比你想的简单，也可能更难受。',
    ],
    story: [
      '讲个真事。{scene}',
      '最近老刷到{topic}，看得多了，有些话想说。',
      '有个朋友问我怎么看{topic}，我回了一大段，后来发现可以写成一篇。',
    ],
  };

  const SAVES_COMMENT = [
    '这篇有点长，值得看完。',
    '看到这儿，先别急着下结论。',
    '想法不成熟，但都是自己想的。',
    '存下来，过段时间再看会有别的感受。',
    '不同意很正常，先看完再说。',
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
    consume: [
      '你不是不愿意花钱，你是不愿意花不明白的钱。',
      '贵不一定值，但便宜一定有它省掉的地方。',
      '所有套路能成立，都是因为信息在对方那边。',
      '价格是标签，账单才是真相。',
      '会算账的人不抠，他只是不肯为看不懂的东西付钱。',
    ],
    society: [
      '很多事不是想通了才做，是做了才慢慢想通。',
      '把个体选择当成品性问题，永远聊不明白。',
      '你以为的理所当然，是别人的无能为力。',
      '有些位置，花钱补不上。',
      '真正的距离不是路程，是"算了不说了"。',
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

  /* 评论类的行动号召：不能说"照着做第一条"，因为那些条不是动作 */
  const CTAS_COMMENT = {
    gongzhonghao: [
      '你怎么看这件事？评论区说一句，我会一条条看。',
      '如果这篇让你改了点想法，点个"在看"。',
      '你身边有没有类似的例子？留言告诉我，我下次写进去。',
      '不同意也欢迎来辩，评论区比正文好看。',
    ],
    xiaohongshu: [
      '你怎么看？评论区聊聊 🫶',
      '有同感的话点个赞让我知道～',
      '你身边有这样的例子吗？评论区说说',
      '不同意见也欢迎，评论区比正文有意思',
    ],
    shipinhao: [
      '你怎么看这件事？评论区说一句。',
      '觉得说到点上了，点个赞、转给那个能聊的人。',
      '你身边有类似的吗？评论区留一句。',
    ],
    douyin: [
      '你怎么看？评论区说。',
      '有同感的点个赞。',
      '你身边有这样的例子吗？',
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
      /* —— 通用：作息 / 习惯 / 运动 —— */
      ['先定睡觉时间，其他都往后排', '睡不够，什么方法都白搭。先把这个时间钉死，别的才谈得上', null],
      ['把水杯放在看得见的地方', '改环境比改意志力容易一百倍。你不需要更自律，只需要让正确的事更容易发生', null],
      ['每天走够步数，不追求强度', '能坚持的低强度，胜过坚持不了的高强度。走路的门槛低到不会失败', null],
      ['久坐一小时就起来两分钟', '腰和颈椎的账，都是坐出来的。不需要运动，只需要别一直坐着', null],
      ['晚饭少一口，比什么减肥法都稳', '不用戒，只要少。所有需要"彻底戒掉"的方法，最后都会反弹', null],
      ['情绪上来先深呼吸十次', '很多身体的毛病，根子在情绪。呼吸不解决问题，但能让你不在气头上做决定', null],
      /* —— 饮食专属 —— */
      ['别盯着一个数字，先看总量和结构', '一天吃几个不是关键，关键是全天吃进去多少、怎么搭配。单个数字拿出来讨论，怎么都能吵起来', /吃|鸡蛋|饮食|营养|摄入|餐|食/],
      ['指南给的是范围，不是标准答案', '同样的建议落到不同人身上差别很大。体重、活动量、有没有基础病，都会改变答案', /吃|鸡蛋|饮食|营养|摄入|餐|食|多少/],
      ['真正要防的不是吃多了，是吃得太单一', '种类少比数量多更容易出问题。一周吃的食物种类数，比某一样吃多少更值得关心', /吃|鸡蛋|饮食|营养|摄入|餐|食/],
      ['身体会给你反馈，比任何建议都直接', '吃完舒服不舒服、精神好不好，这些信号比看来的结论更该信。前提是你真的在留意', /吃|鸡蛋|饮食|营养|摄入|餐|食|健康/],
      /* —— 减重/指标专属 —— */
      ['体重和指标看趋势，不看单次', '一次称重、一次化验说明不了什么。连续四周的方向才有意义', /减|瘦|瘦身|体重|血糖|血压|血脂|三高|指标|减重/],
      ['不用去健身房，先把日常活动量提上来', '多走两站路、爬楼、站着打电话。这些不需要额外时间，也不需要花钱', /减|瘦|健身|运动|减重/],
      ['能长期做的，才算有效的方法', '再快的方法，坚持不了三周就等于零。先问自己：这个我能做一年吗', /减|瘦|健身|运动|减重|养生/],
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

  /* ---------- 标题生成 ----------
   * 信息流里标题超过 ~30 字就被截断。
   * 所以热词很长时不切词（切了会出「搭伙过日子很幸的」这种半截话），
   * 而是换一整套紧凑模板：话题原样保留，只缩掉装饰部分。
   */
  const TITLE_MAX = 30;

  function clipTopic(topic, platform) {
    const max = { gongzhonghao: 22, xiaohongshu: 20, shipinhao: 18, douyin: 18 }[platform] || 20;
    const t = String(topic).trim();
    if (t.length <= max) return t;
    // 只在标点处断，绝不从词中间切
    const m = t.match(/^(.{4,}?)[，、：；,.:;？！?!]/);
    if (m && m[1].length >= 4) return m[1];
    return t;
  }

  /* 模板函数化：先试完整版，太长就换紧凑版，再不行才硬截（并清掉尾部虚词） */
  function fit(full, compact, topicShort, n) {
    let out = full(topicShort, n);
    if (out.length <= TITLE_MAX) return out;
    out = compact(topicShort, n);
    if (out.length <= TITLE_MAX) return out;
    return out.slice(0, TITLE_MAX).replace(/[的了很都就也还把和被让给与，、：；,.:;（(]+$/, '');
  }

  function titles(topic, points, sectorName, platform, angle) {
    const n = points;
    const t = clipTopic(topic, platform);

    // [完整版, 紧凑版]
    const base = [
      [(x, m) => `${x}：我踩过的 ${m} 个坑`, (x, m) => `${x}的 ${m} 个坑`],
      [(x, m) => `关于${x}，说 ${m} 句大实话`, (x, m) => `${x}，${m} 句实话`],
      [(x, m) => `${x}做不好，八成是这 ${m} 件事`, (x, m) => `${x}差在哪？${m} 件事`],
      [(x, m) => `${x}重做一遍，总结出 ${m} 条`, (x, m) => `${x}，我总结出 ${m} 条`],
      [(x, m) => `${m} 条${x}的笨办法，真管用`, (x, m) => `${m} 条笨办法，真管用`],
      [(x, m) => `别再瞎试了，${x}就这 ${m} 步`, (x, m) => `${x}就这 ${m} 步`],
      [(x, m) => `${x}这件事，我想说 ${m} 点`, (x, m) => `${x}，我想说 ${m} 点`],
      [(x, m) => `说 ${m} 个${x}的真相`, (x, m) => `${m} 个真相，有点扎心`],
      [(x, m) => `重来一次，${x}我会这么做（${m} 条）`, (x, m) => `${x}重来一次（${m} 条）`],
      [(x, m) => `${m} 个让${x}变简单的动作`, (x, m) => `${m} 个动作，让事变简单`],
    ];
    const xhs = [
      [(x, m) => `${x}｜我总结了 ${m} 条✨`, (x, m) => `${x}｜${m} 条✨`],
      [(x, m) => `真的会谢！${x}原来只要 ${m} 步`, (x, m) => `${x}只要 ${m} 步`],
      [(x, m) => `${x}别乱试了😭 这 ${m} 条亲测有效`, (x, m) => `${x}｜亲测 ${m} 条`],
      [(x, m) => `搞懂${x}，只用了这 ${m} 个方法`, (x, m) => `${x}｜${m} 个方法`],
      [(x, m) => `${x}踩坑记录｜${m} 条血泪经验`, (x, m) => `${x}踩坑记录`],
      [(x, m) => `建议收藏｜${x}的 ${m} 个关键动作`, (x, m) => `收藏｜${m} 个关键动作`],
    ];
    const video = [
      [(x, m) => `${x}，${m} 句话讲明白`, (x, m) => `${x}｜${m} 句话`],
      [(x, m) => `${x}的 ${m} 个坑，第 2 个最要命`, (x, m) => `${x}的 ${m} 个坑`],
      [(x, m) => `${m} 条${x}的实话，不太好听`, (x, m) => `${m} 条实话，不太好听`],
      [(x, m) => `${x}，我总结出 ${m} 条`, (x, m) => `${x}｜${m} 条`],
    ];
    let pool = base;
    if (platform === 'xiaohongshu') pool = xhs;
    else if (platform === 'shipinhao' || platform === 'douyin') pool = video;

    const picked = pickN(pool, PLATFORM_CFG[platform].titleCount);
    // 首条固定用主模板，保证一定有一个「说了几条」的标题
    picked.unshift(base[0]);
    const out = picked.map(([full, compact]) => fit(full, compact, t, n));
    return [...new Set(out)].slice(0, PLATFORM_CFG[platform].titleCount);
  }

  /* ---------- 正文 ---------- */
  /* 话题锚点：让要点里出现话题本身，而不是纯通用句。
   * 方法：head 里如果有 {topic} 就替换；desc 里按需在首句补一个「说到话题」的引子。 */
  function anchorPoint(entry, topic) {
    const [head, desc] = entry;
    return [fill(head, { topic }), fill(desc, { topic })];
  }

  function buildBody({ topic, sector, platform, points, materials, angle, duration = 60 }) {
    const cfg = PLATFORM_CFG[platform] || PLATFORM_CFG.gongzhonghao;
    const sec = sector.key;
    const mode = sector.mode || 'method';
    const hookSet = mode === 'comment' ? HOOKS_COMMENT : HOOKS;
    const hookVars = { topic, verb: pick(VERBS[sec] || VERBS.growth), scene: pick(SCENES[sec] || SCENES.growth) };
    const hook = fill(pick(hookSet[angle] || hookSet.contrast), hookVars);
    const save = pick(mode === 'comment' ? SAVES_COMMENT : SAVES);

    /* 选要点：评论类走 COMMENT_BANK（现象/原因/代价），方法类走 POINT_BANK（具体动作） */
    let pool;
    if (mode === 'comment') {
      const raw = COMMENT_BANK[sec] || COMMENT_BANK.society;
      // 第 3 位是适用条件：带条件的条目只在话题命中时才参与抽取。
      // 这样「差价在名头不在手艺」不会跑到「外卖涨价」的稿子里。
      const applicable = raw.filter((e) => !e[2] || e[2].test(topic));
      // 通用条目永远保留，专属条目匹配不上就剔掉；可用条目不足时退回全部
      pool = (applicable.length >= Math.min(points, 4) ? applicable : raw);
    } else {
      const raw = POINT_BANK[sec] || POINT_BANK.growth;
      // 同样支持第 3 位条件：饮食类要点不会跑到「如何早起」的稿子里
      const applicable = raw.filter((e) => !e[2] || e[2].test(topic));
      pool = (applicable.length >= Math.min(points, 4) ? applicable : raw);
    }
    const chosen = pickN(pool, Math.min(points, pool.length)).map((p) => anchorPoint(p, topic));

    const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
    const plainNums = ['一', '二', '三', '四', '五', '六', '七', '八'];
    const useEmojiNum = platform === 'xiaohongshu';

    const blocks = [];

    // 评论类：先落一个具体场景，比直接抛观点更抓人
    if (mode === 'comment') {
      const scene = pick(SCENES[sec] || SCENES.society || SCENES.growth);
      if (platform === 'xiaohongshu') blocks.push(`关于「${topic}」，我想说点具体的。`);
      else blocks.push(`关于${topic}，先说个场景：${scene}。`);
      blocks.push(hook);
    } else {
      blocks.push(hook);
    }

    // 真实素材优先插入
    const story = materials && materials.stories && materials.stories.length ? pick(materials.stories) : '';
    if (story) {
      blocks.push(platform === 'xiaohongshu' ? `先说个我自己的事：${story}` : `先说个真事。${story}`);
    }

    blocks.push(save);

    const intro = MODE_INTRO[mode][platform] || MODE_INTRO[mode].gongzhonghao;
    blocks.push(fill(intro, { n: chosen.length }));

    chosen.forEach((p, i) => {
      const [head, desc] = p;
      const mark = useEmojiNum ? nums[i] : (platform === 'gongzhonghao' ? plainNums[i] + '、' : `${i + 1}. `);
      let line = desc;
      if (line.length > cfg.maxPointLen) line = line.slice(0, cfg.maxPointLen);
      if (useEmojiNum) {
        blocks.push(`${mark} ${head}
${line}`);
      } else {
        blocks.push(`${mark}${head}
${line}`);
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
    const ctaSet = mode === 'comment' ? CTAS_COMMENT : CTAS;
    blocks.push(pick(ctaSet[platform] || ctaSet.gongzhonghao));

    const body = blocks.join(cfg.sep);

    if (platform === 'shipinhao' || platform === 'douyin') {
      /* 口播按 3 字/秒算：15 秒≈45 字，30 秒≈90 字，60 秒≈180 字。
         钩子给三条候选，正文按目标字数裁，宁可少说一条也不赶语速。 */
      const HOOK_NAME = { contrast: '反差', suspense: '悬念', emotion: '情绪', story: '故事' };
      const hookOrder = [...new Set([angle, 'contrast', 'suspense', 'emotion'].filter(Boolean))];
      const hookCands = [];
      for (const key of hookOrder) {
        if (!hookSet[key]) continue;
        for (let i = 0; i < 2 && hookCands.length < 3; i++) {
          const text = fill(pick(hookSet[key]), hookVars);
          if (!hookCands.some((h) => h.text === text)) hookCands.push({ key, text });
        }
        if (hookCands.length >= 3) break;
      }
      if (!hookCands.length) hookCands.push({ key: angle || 'contrast', text: hook });

      const shorten = (s, cap) => {
        if (s.length <= cap) return s;
        const cut = s.slice(0, cap);
        const m = cut.match(/^(.{6,})[，。！？；,.;!?]/);
        return (m ? m[1] : cut.replace(/[的了很都就也还把和被让给与，、：；,.:;（(]+$/, '')) + '。';
      };
      const hookCap = duration <= 15 ? 12 : duration <= 30 ? 24 : 48;
      const mainHook = shorten(hookCands[0].text, hookCap);
      const ctaCap = duration <= 15 ? 8 : duration <= 30 ? 14 : 24;
      const ctaText = shorten(pick((mode === 'comment' ? CTAS_COMMENT : CTAS)[platform] || CTAS.gongzhonghao), ctaCap);
      const targetChars = Math.round(duration * 3);
      // 条数必须等于档位（标题写了 2 条就真给 2 条），所以不做「预算不够就少说一条」。
      // 15 秒一共才 45 字，每条只剩十来个字，硬塞解释会截成半句话——这种档位只留动作本身
      const perLine = Math.max(8, Math.floor((targetChars - mainHook.length - ctaText.length - 8) / Math.max(1, chosen.length)) + 2);
      const shortMode = perLine <= 12;

      const lines = [];
      const spokenLines = [];
      for (let i = 0; i < chosen.length; i++) {
        const [head, desc] = chosen[i];
        let text = `${head}。${desc}`;
        if (text.length > perLine) {
          if (shortMode) {
            text = head;
          } else {
            // 别在「标题句号」处裁——那样永远只剩动作名。给解释留出剩余额度，
            // 但只在逗号/句号处收尾；收不了就整句不要，别念出「不是"今天要。」这种半句
            const room = perLine - head.length - 1;
            let clause = '';
            if (room >= 6) {
              const cut = desc.slice(0, room);
              const hits = [...cut.matchAll(/[，、。；,.;！？!?]/g)].map((m) => m.index).filter((i) => i >= 6);
              if (hits.length) clause = cut.slice(0, hits[hits.length - 1]);
              if ((clause.match(/"/g) || []).length % 2) clause = '';
            }
            text = clause ? `${head}。${clause}` : head;
          }
        }
        lines.push(`${i + 1}、${text}`);
        spokenLines.push(text);
      }

      const spoken = [mainHook, ...spokenLines, ctaText].join('');
      const secs = Math.max(8, Math.round(spoken.length / 3));
      const bodyEnd = Math.max(6, Math.round(secs * 0.72));

      const parts = [
        `【口播稿 · 约 ${secs} 秒 · ${spoken.length} 字 · 按 3 字/秒】`,
        '（15 秒≈45 字，30 秒≈90 字，60 秒≈180 字；宁可少说一条，也别赶）',
        '',
        '【钩子 · 三选一 · 读出来选最顺的】',
        ...hookCands.map((h, i) => `${'ABC'[i] || i + 1}｜${HOOK_NAME[h.key] || ''}｜${h.text}`),
        '',
        `【0-3 秒 · 近景，直视镜头】`,
        mainHook,
        '',
        `【3-${bodyEnd} 秒 · 中景，每讲完一条停半秒、切一次镜头】`,
        ...lines,
        '',
        `【${bodyEnd}-${secs} 秒 · 近景，放慢半拍】`,
        ctaText,
        '',
        `【字幕条】${topic}`,
        '【拍摄提示】竖屏 9:16，窗边自然光，手机和眼睛齐平，麦克风离嘴 20cm；片头别加长 logo。',
      ];
      return parts.join('\n');
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
    consume: ['#消费观察', '#省钱', '#性价比', '#生活观察', '#避坑', '#消费主义'],
    society: ['#社会观察', '#普通人', '#代际', '#中年', '#养老', '#现实'],
  };

  function tags(topic, sector, platform) {
    const cfg = PLATFORM_CFG[platform] || PLATFORM_CFG.gongzhonghao;
    const base = pickN(TAG_BANK[sector.key] || TAG_BANK.growth, Math.max(2, cfg.tagCount - 2));
    const clean = String(topic).replace(/[《》""''\s·、，,。.]/g, '');
    const t = [`#${clean.slice(0, 12)}`, ...base];
    return [...new Set(t)].slice(0, cfg.tagCount);
  }

  /* ---------- 主入口 ---------- */
  const DURATION_POINTS = { 15: 2, 30: 5, 60: 5 };

  function generate({ topic, platform = 'gongzhonghao', points = 5, duration = 60, angle, materials = {} }) {
    const isVideo = platform === 'shipinhao' || platform === 'douyin';
    const sector = detectSector(topic);
    // 评论类的判断句普遍更长，60 秒多给一条才凑得满 3 字/秒
    const basePts = DURATION_POINTS[duration] || DURATION_POINTS[60];
    const pts = isVideo ? (sector.mode === 'comment' && duration >= 60 ? 6 : basePts) : points;
    const ang = angle || pick(['contrast', 'contrast', 'suspense', 'story', 'emotion']);
    const t = titles(topic, pts, sector.name, platform, ang);
    const body = buildBody({ topic, sector, platform, points: pts, materials, angle: ang, duration });
    return {
      topic, platform, sector: sector.name, sectorKey: sector.key, angle: ang,
      points: pts, duration, titles: t, body, tags: tags(topic, sector, platform),
      generatedAt: new Date().toISOString(),
    };
  }

  const API = { generate, detectSector, PLATFORM_CFG, SECTORS };

  // 浏览器与 Node 双端可用：scripts/gen-daily.js 和 tests/ 都要用同一份引擎
  if (typeof window !== 'undefined') window.CopyGen = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
