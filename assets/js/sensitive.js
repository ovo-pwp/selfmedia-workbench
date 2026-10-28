/* ===== 文案合规检查：极限词 / 诱导互动 / 医疗夸大 / 引流 / 虚假收益 =====
 * 词库参考开源整理：wensenlab/xhs-content-checker、ijerryhuang/xiaohongshu-auto-operation
 * 原则：只匹配"精确短语"，不匹配单字，避免"最近/第一步/第一天"这类正常表达被误报
 */
(function () {
  'use strict';

  const RULES = [
    /* ---------- 绝对化用语（广告法，小红书/公众号都敏感） ---------- */
    { cat: '绝对化用语', level: 'high', re: /(最好|最佳|最优|最强|最低价|最便宜|最有效|最划算|最正宗|最顶级|最高级|最领先|最安全|最健康|最专业|最权威)/g,
      alt: '超好用 / 很好用 / 我个人更喜欢', tip: '广告法明令禁止"最"类表述' },
    { cat: '绝对化用语', level: 'high', re: /(第一名|全国第一|销量第一|行业第一|排名第一|第一品牌|NO\.?1|No\.?1)/g,
      alt: '排名靠前 / 名列前茅 / 我用过的里面很突出的', tip: '无法举证的"第一"属于虚假宣传' },
    { cat: '绝对化用语', level: 'high', re: /(唯一|独一无二|绝无仅有|独家首发|全网首发|仅此一家)/g,
      alt: '少见的 / 比较独特的', tip: '"唯一"需要举证，举证不了就算违规' },
    { cat: '绝对化用语', level: 'high', re: /(顶级|极致|终极|巅峰|天花板|史诗级)/g,
      alt: '高端 / 出色 / 很出挑', tip: '绝对化程度词' },
    { cat: '绝对化用语', level: 'medium', re: /(完美|绝对|永久|永恒|永不|一次搞定|彻底解决)/g,
      alt: '很棒 / 长期 / 基本解决', tip: '绝对化承诺，平台会判夸大' },
    { cat: '绝对化用语', level: 'medium', re: /(百分之百|100%|百分百|全效|特效|速效)/g,
      alt: '大部分情况 / 明显改善', tip: '效果承诺类，必须有依据' },

    /* ---------- 权威背书 ---------- */
    { cat: '权威背书', level: 'high', re: /(国家级|国家免检|质量免检|驰名商标|领导人推荐|国家机关专供|特供|军供|央视推荐|官方指定)/g,
      alt: '正规厂家 / 有检测报告', tip: '未经授权使用国家机关名义属违法' },
    { cat: '权威背书', level: 'medium', re: /(明星同款|医生推荐|专家推荐|三甲医院推荐)/g,
      alt: '很多人用 / 我看不少人推', tip: '需要授权证明，否则算虚假宣传' },

    /* ---------- 诱导互动（小红书重点打击） ---------- */
    { cat: '诱导互动', level: 'high', re: /(评论区扣1|评论区扣「?1」?|评论区回复\S{1,4}领|评论区领取|评论区私信|扣1领|回复关键词领)/g,
      alt: '评论区告诉我 / 评论区聊聊你的情况', tip: '小红书明确禁止"扣1""回复领取"' },
    { cat: '诱导互动', level: 'high', re: /(点赞关注领|关注我获取|关注领取|点赞破\d+|双击屏幕|一键三连|点赞收藏关注)/g,
      alt: '觉得有用可以点赞 / 收藏起来慢慢看', tip: '用利益交换互动数据会被限流' },
    { cat: '诱导互动', level: 'medium', re: /(转发抽奖|分享领红包|转发到朋友圈|分享给三个好友)/g,
      alt: '觉得有用可以转给需要的朋友', tip: '利益诱导转发' },

    /* ---------- 虚假收益（搞钱内容高发） ---------- */
    { cat: '虚假收益', level: 'high', re: /(躺赚|躺赢|暴富|一夜暴富|日入过千|日入过万|月入十万|月入百万|稳赚不赔|保本保息|零风险|高收益零风险|包赚)/g,
      alt: '能挣点零花钱 / 收入不高但真实到账', tip: '收益承诺是平台重点打击对象' },
    { cat: '虚假收益', level: 'medium', re: /(轻松月入|在家躺|不用干活|睡后收入)/g,
      alt: '需要花时间 / 前期比较累', tip: '避免描述成"不劳而获"' },

    /* ---------- 医疗 / 药效 ---------- */
    { cat: '医疗药效', level: 'high', re: /(治疗|根治|药到病除|包治百病|消炎|抗敏|防癌|抗癌|降血压|降血糖|溶脂|祛斑|生发)/g,
      alt: '缓解 / 改善 / 辅助', tip: '非医疗资质不得宣称疗效' },
    { cat: '医疗药效', level: 'medium', re: /(排毒|调理内分泌|增强免疫力|延年益寿|返老还童)/g,
      alt: '状态好一点 / 舒服一些', tip: '保健功效夸大' },

    /* ---------- 拉踩 ---------- */
    { cat: '拉踩竞品', level: 'high', re: /(吊打|碾压|秒杀同级|完爆|比\S{1,6}好用\d+倍|智商税|垃圾东西|骗人的玩意)/g,
      alt: '我更习惯用这个 / 各有各的适用场景', tip: '贬低同行会被判不正当竞争' },

    /* ---------- 引流 / 联系方式 ---------- */
    { cat: '站外引流', level: 'high', re: /(加我微信|加V信|加vx|加VX|微信号[:：]|私信我|私我|扫码加|二维码在)/gi,
      alt: '在评论区聊 / 站内联系我', tip: '小红书严禁把流量导到站外' },
    { cat: '站外引流', level: 'high', re: /(https?:\/\/[^\s，。]+|www\.[a-z0-9.-]+\.[a-z]{2,})/gi,
      alt: '（删掉链接）', tip: '正文带外链极易被限流' },
    { cat: '站外引流', level: 'high', re: /(1[3-9]\d{9})/g,
      alt: '（删掉手机号）', tip: '手机号属于高危信息' },

    /* ---------- 迷信 ---------- */
    { cat: '迷信用语', level: 'medium', re: /(招财进宝|转运|逢凶化吉|辟邪|开光|旺财|改运|化解劫难)/g,
      alt: '图个开心 / 讨个好彩头', tip: '封建迷信类表述' },

    /* ---------- 焦虑营销 ---------- */
    { cat: '焦虑营销', level: 'low', re: /(再不\S{1,4}就晚了|现在不做\S{1,6}就废了|你会后悔一辈子|同龄人已经\S{1,8}了)/g,
      alt: '早点开始会轻松一些', tip: '平台不建议制造恐慌' },
  ];

  const LEVEL_NAME = { high: '高危', medium: '中危', low: '提醒' };
  const LEVEL_ORDER = { high: 0, medium: 1, low: 2 };

  /** 检查文本，返回命中列表（按位置排序） */
  function check(text) {
    const src = String(text || '');
    if (!src) return [];
    const hits = [];
    const seen = new Set();
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(src)) !== null) {
        if (m[0] === '') { rule.re.lastIndex++; continue; }
        const key = m.index + ':' + m[0];
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push({
          word: m[0], index: m.index, cat: rule.cat, level: rule.level,
          alt: rule.alt, tip: rule.tip,
        });
      }
    }
    hits.sort((a, b) => a.index - b.index);
    return hits;
  }

  /** 汇总：按类别归并，用于展示 */
  function summary(hits) {
    const map = new Map();
    for (const h of hits) {
      const k = h.cat + '|' + h.word;
      if (!map.has(k)) map.set(k, { ...h, count: 0 });
      map.get(k).count++;
    }
    return Array.from(map.values()).sort(
      (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.index - b.index
    );
  }

  /** 返回带高亮标记的 HTML（输入已做 XSS 转义） */
  function highlightHTML(text, hits) {
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    if (!hits || !hits.length) return esc(text);
    let marked = String(text);
    // 从后往前插标记，避免位置偏移；用 \u0001\u0002 占位，不受转义影响
    const sorted = hits.slice().sort((a, b) => b.index - a.index);
    for (const h of sorted) {
      marked = marked.slice(0, h.index) + '\u0001' + marked.slice(h.index, h.index + h.word.length) + '\u0002' + marked.slice(h.index + h.word.length);
    }
    return esc(marked)
      .replace(/\u0001/g, '<mark class="risk">')
      .replace(/\u0002/g, '</mark>');
  }

  window.Sensitive = { check, summary, highlightHTML, RULES, LEVEL_NAME };
})();
