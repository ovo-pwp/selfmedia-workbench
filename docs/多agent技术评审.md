# selfmedia-workbench · 多 agent 技术评审（2026-10-31）

参与：pi(w5:p1)、omp(w5:p2)、claude(w5:p4)、codex(w5:p5)
方法：静态读码（约 3130 行）+ 本地起服务实测 + GitHub 同类项目调研

---

## 一、现状快照（实测）

| 项 | 结果 |
|---|---|
| 代码量 | assets/js 2377 行 + server 211 + fetch-hot 268，**零依赖、零构建、零测试** |
| 运行 | `node server.js` → 7788 正常；`/api/hot` 6 平台全通，共 217 条，picks 40 条 |
| 数据 | `data/daily.json` 45KB / `data/hot.json` 97KB **都提交进了 git**，每天变动 |
| 存储 | 全部 IndexedDB，`DB_VER = 1`，仅手动导出备份 |
| 部署 | WorkBuddy 托管（`.wbapp_*.genie`），sharecode 硬编码 3 处 |
| 自动化 | **仓库里没有任何生成 daily.json 的脚本**，7:00 更新靠仓库外 agent 手跑 |

四家共识：架构不烂（原生 JS + 本地优先是优点），问题集中在 **「内容链路不可复现」「数据不可迁移」「没有回归保护」** 三处。

---

## 二、实测确认的硬伤（有证据，不是推测）

### 1. 文案引擎与话题脱钩（最致命的产品问题）

```
输入 A: "30岁还没存款"        → sector = growth
输入 B: "10元快剪暴打设计总监" → sector = growth   ← 应该命中「消费观察」，但 SECTORS 里没有这类
```

两条话题产出的正文要点 100% 相同（先砍掉一半目标 / 把动作拆到不用动脑 / 允许自己做得很烂…）。
`generator.js` 的 `POINT_BANK` 按赛道取 5 条随机点，**话题只进钩子和标题，不进正文**。
再加 `SECTORS` 缺「消费观察 / 社会话题 / 热点评论」，所有非工具/情绪类热词都会掉进 growth 兜底。
→ 这是「看起来像模板」的真正原因，跟有没有接大模型无关。

### 2. 热榜过滤有明确误伤与漏放（实测）

```
BLOCK.test('死磕一件事')              → true   ✗ 单字"死"误伤
BLOCK.test('如何评价死磕英语')         → true   ✗
BLOCK.test('央行降息')                → true   （这个是对的）
```

同时 picks 头部出现：`阿维塔省钱救不了销量` `苹果国行AI来了` `iPhone Duo的铰链是AI打造的吗`
—— 品牌/产品新闻靠 `AI` `销量` 命中 BOOST 加权进了选题池，缺「品牌商品」负向规则。

### 3. daily.json 更新链路不在仓库内

`grep` 全仓只有 `server.js:138` / `app.js` 读它，没有写入方。
→ 不可复现、无校验、无回滚；45KB 整份覆写，一次坏运行全丢。

### 4. 用户数据只有单点

`store.js` `DB_VER=1` 无 upgrade 分支、无迁移路径；数据只在本机 IndexedDB。
清缓存 / 换设备 = 全丢，仅靠用户自觉导出。**唯一不可逆的损失类型。**

### 5. 部署与接口面

- sharecode `KLEYZT3KBE` 硬编码在 `index.html:13`、`manifest.json`、`sw.js:15`，随 HTML 下发＝等同公开
- `/api/hot?force=1` 无鉴权无频率限制 + `Access-Control-Allow-Origin: *` → 可被外部刷爆源站
- `sw.js` 手写 `VER='v6'`，改代码忘升版本 → 用户长期吃旧缓存
- `server.js` 非 Windows 固定 3000 端口（本机 3000 已被其他进程占用，已实测）

### 6. 零回归保护

无 test / lint / CI。generator / sensitive / 热榜过滤三块全是正则，改一个 `/g` 就可能静默出错。

---

## 三、GitHub 抄作业清单（按能立刻用的顺序）

### 热榜层
| 项目 | ★ | 拿走什么 |
|---|---|---|
| imsyy/DailyHotApi | 4.1k | **一源一路由文件 + 统一响应 + 缓存**。`scripts/fetch-hot.js` 现在是 6 个函数塞一个文件，改成 `sources/*.js` 各自导出 `{id,name,fetch}`，单源失败只影响自己 |
| DIYgod/RSSHub | 46.7k | RSS 当兜底通道：接口改版时先降级到 RSS 抓，别直接 stale |
| JackyST0/hotpush | 200 | 多平台聚合 + 推送；它的去重/打分思路可参考 |

### 内容质量层（本项目最该抄的一块）
| 项目 | ★ | 拿走什么 |
|---|---|---|
| blader/humanizer | 62.7k | **「AI 写作 26 个特征」清单**（Wikipedia Signs of AI writing）：Not X but Y / 一行收尾 / 伪深刻开头 / 铺垫式起手。做成 `generator.js` 的 lint 规则，可离线、零成本 |
| MrGeDiao/shuorenhua | 2.4k | 说人话改写规则：删招呼、删预告、删重复铺垫、保留数字与条件。直接换成 `SAVES`/`HOOKS` 的写法约束 |
| larashero3-dotcom/lieflat-less-ai-tone | 4.7k | 520 万字语料统计出的**可量化指标**（句长方差、对举句密度、段首雷同率）。拿来做自检分数，不是玄学 |
| miqdadbadjuber/anti-slop | 7.6k | 过滤「通用 AI 味 UI/文案」的规则集 |
| iniwap/AIWriteX | 2.2k | **最接近本项目的完整参考**：热搜聚合 → 选题 → 生成 → 排版 → 公众号发布 → 去 AI 味，一条链路都跑通了 |

### 生产/分发层（现在是空白，也是「工作台」真正的闭环）
| 项目 | ★ | 拿走什么 |
|---|---|---|
| harry0703/MoneyPrinterTurbo | 136k | 关键词 → 脚本 → TTS → 素材 → 成片。对口 `shipinhao/douyin` 的「口播稿」下一步 |
| rany2/edge-tts | 12.4k | 免费 TTS。口播稿一键出音频，成本 0，价值巨大 |
| lyricat/wechat-format | 4.5k | Markdown → 微信专属 HTML 排版 |
| wechatsync/Wechatsync | 6.5k | 一稿多平台同步发布 |
| xpzouying/xiaohongshu-mcp / dreammis/social-auto-upload | 16.7k / 16k | 自动发布通道（风险高，建议只做「草稿」不自动发） |
| yikart/AiToEarn | 27k | AI 内容变现整链路的产品形态参考 |

### 数据与 PWA 层
| 项目 | ★ | 拿走什么 |
|---|---|---|
| jakearchibald/idb / Dexie | 7.4k | 换掉手写 205 行 store.js，拿到 schema 版本迁移 |
| tinyplex/tinybase / livestorejs/livestore | 5.2k / 3.7k | local-first + 同步引擎，做「手机↔电脑共用一份数据」 |
| GoogleChrome/workbox | 13k | SW 预缓存/版本化，替掉手写 sw.js |

---

## 四、分歧点（值得记下来）

- **claude**：DB_VER + 清缓存即丢是唯一不可逆损失，必须排到第 2。
- **codex**：不主张 generator 接 LLM —— 纯 PWA 没有鉴权后端，浏览器直连必泄露 key，且破坏「免费/离线/隐私」卖点；应先把素材库和去 AI 味规则做扎实。弱项是零测试/CI，五条待办都建立在「改了不坏」上。
- **omp**：抓取靠 UA 伪装 + 私有接口 + 千字正则，平台一改版静默失效；`hot.json` 进 git 是噪音。
- **pi 的裁决**：三方都对，组合起来是 —— **模板引擎当地基（永远离线可用），LLM 当可选增强且必须走 `server.js` 代理**。这样既保住卖点，又不把 key 暴露到前端。

---

## 五、建议的改造顺序

### P0 · 先把「不会丢 / 不会坏」补上（2～3 天）
1. `scripts/gen-daily.js` 入库：生成 → 校验（标题条数 == 正文条数、字数区间、敏感词、JSON schema）→ `rename` 原子写 → 保留 `daily.json.bak`
2. `store.js` → Dexie/idb，写 upgrade 迁移；加「每周自动导出一份 JSON 到 File System Access」或 `/api/backup`
3. 建最小回归：`node:test` 覆盖 generator 条数一致性、sensitive 词库、fetch-hot 过滤（用 fixture，不打网络）+ GitHub Actions

### P1 · 内容质量（决定产品生死）
4. 修 `SECTORS`：补「消费观察 / 社会话题 / 热点评论」，并在 `POINT_BANK` 里让要点带话题锚点（模板里嵌 `{topic}`，不只是一句钩子）
5. 引入 humanizer 的 26 条 + shuorenhua 规则做**成稿自检评分**（纯前端，可离线）
6. `server.js` 加 `/api/gen`：OpenAI 兼容代理（DeepSeek/通义/Ollama），key 走环境变量，加限流；前端 LLM 开关默认关，关着就用模板
7. 热榜过滤重构：`sources/` 插件化 + 单源超时/重试/降级；修单字「死」；补品牌商品负向规则

### P2 · 交付与闭环
8. `sw.js` 版本自动 hash（或 Workbox）；sharecode 改部署注入；`/api/hot?force=1` 加 token + 限流
9. `.gitignore` 掉 `data/hot.json`（运行产物不入库）
10. 发布闭环：wechat-format 排版 + edge-tts 出音频 + 发布记录自动回填数据

---

## 六、P0 落地记录（已完成）

开工范围：P0 全部 3 项 + P1 第 7 项（热榜重构）。

### 新增文件
| 文件 | 作用 |
|---|---|
| `scripts/gen-daily.js` | 每日生成管线：抓榜 → 生成 → 校验 → 备份 → 原子写。支持 `--dry` / `--offline` / `--force` / `--date` |
| `scripts/validate-daily.js` | 出厂校验器：结构 + 条数一致性 + 字数 + 合规分级 + AI 味，可单独跑 |
| `tests/engines.test.js` | 24 个回归测试，全离线（`node --test`） |
| `.github/workflows/test.yml` | CI：push / PR / 每日定时 |
| `data/money-bank.json` | 搞钱项目金库（8 条），每日轮换不重复 |
| `data/daily.override.json` | 手工稿覆盖层，模板稿永远碰不到 |

### 改动文件
- `assets/js/generator.js`：双端导出；标题生成重写（函数化模板 + 紧凑版回退 + 词边界保护，30 字上限且不切出「搭伙过日子很」这种半截话）
- `assets/js/sensitive.js`：双端导出
- `scripts/fetch-hot.js`：修单字「死」误伤；新增 `BRAND` / `BEAUTY_NOISE` 负向规则；`buildPicks` 改成每次重算 score（不信任落盘旧值）
- `server.js`：内建每日调度（`GEN_HOUR`，默认 7 点）；`/api/gen` 手动触发（本机放行 / `API_KEY` 校验）；`/api/hot?force=1` 加限流（6 次/分钟/IP）；`/api/health` 暴露生成状态
- `package.json`：`gen` / `gen:dry` / `validate` / `test` 脚本
- `.gitignore`：`data/hot.json`、`*.bak`、`history/` 不再入库

### 实测数据
| 指标 | 改前 | 改后 |
|---|---|---|
| 测试 | 0 | **24 个，全过** |
| 单字「死」误伤 | `死磕一件事` 被拦 | **放行** |
| 品牌/产品新闻进选题池 | 4 条（阿维塔/苹果/iPhone…） | **0 条** |
| 美妆种草类进选题池 | 2 条（香颂可可妆/AI珍珠妆） | **0 条** |
| 超长标题（>30 字） | 大量（最长 51 字） | **0 条** |
| daily.json 更新链路 | 在仓库外，不可复现 | **入库，自动调度 + CI 演练** |
| 坏稿保护 | 无 | **校验阻断 + 备份 + 原子写，实测失败时文件零改动** |
| `/api/hot?force=1` | 无限制 | **6 次/分钟/IP，第 7 次起 429** |

### 关键实现细节（容易踩坑的地方）
1. **`buildPicks` 必须每次重算 score**。改过滤规则后，磁盘上的 `hot.json` 里存的还是旧 score，直接读会把已封禁的词放回来。这是实测发现的。
2. **标题不能从词中间切**。热词常有 19 字以上（知乎式长句），按长度硬截会产出「为什么老一辈人觉得搭伙过日子很」这类半截话。解法是给每个模板配一个紧凑版，先试完整版、太长换紧凑版、再不行才切并清掉尾部虚词。
3. **`declaredPoints` 要排除「第 N 条」**。否则「5 条大实话，第 3 条最有用」会被判成声明 3 条，跟正文 5 条冲突。
4. **合规要分级**。「唯一」「治疗」「天花板」在编辑语境里正常，按广告法一刀切会把所有稿子拦死。分级为「必改」（虚假收益/站外引流/诱导互动/权威背书）和「软风险」（人工过一眼）。
5. **模板稿字数天然短**。手工稿 760~820 字，模板稿 270~400 字。校验对 `source: template` 放宽到 65% 下限 + 报警告，不误杀但明确提示要扩写。
6. **手工稿保护靠收割**。`harvestOverrides` 在生成前把旧 `daily.json` 里无 `source` 字段的成稿（历史文件都是人工稿）收进 override 层，模板稿不会覆盖它们。

### 未做（下一步）
- P1 第 4 项：修 `SECTORS` 补「消费观察 / 社会话题」，让要点带话题锚点 —— **这是解决「模板腔」的根本，比接大模型更有效**
- P1 第 5、6 项：humanizer 26 条做成前端自检分；`/api/gen` 接 OpenAI 兼容代理
- P2：sw.js 版本自动 hash、sharecode 部署注入、`store.js` 迁 Dexie
