---
name: koubo-remotion-director
description: 用于口播的全片导演规划。完整读取用户确认文稿或实录，按语义判断何处保留真人、使用真实素材、普通 AI 情景视频或纸艺解释片，输出真实素材执行单、两类首帧/视频提示词和拍后 Shotcraft 机会。本 Skill 只到导演表人工确认，不执行生成、剪辑或发布。
---

# 口播全片语义导演

> 目录名中的 `remotion` 仅为历史兼容，不代表本阶段执行 Remotion。

## 阶段边界

- 阶段固定为 `director-only`。输入必须是完整的用户确认文稿，或拍摄后的真实口播转写。
- 本阶段只读取当前文稿、用户确认的风格参考、本文件、[v2 导演核心](references/semantic-visual-director.v2.md)、[纸艺最低质量基线](references/paper-quality-baseline-20260829.md) 和 [v2 导演表模板](templates/director-cues.v2.json)。
- 不启动生图、OCR、RunningHub、Shotcraft 选卡、Remotion、字幕、音效、渲染或发布。不回读旧 V9.1 布局、物理、投影和状态机合同来扩写提示词。
- 唯一校验命令是 `scripts/validate-director-cues-v2.mjs`。校验通过后状态仍只能是 `ready-for-user-review`。
- 用户确认整份导演表前，`handoffGate.downstreamAllowed` 必须是 `false`。“继续”或“验证”只延续当前阶段，不自动获得下游权限。

## 导演判断

必须先读完全文，写出一句主观点和论证顺序，再把全文拆成自然 `semanticBeats`。每个 beat 有且只有一个主画面：

1. `real-evidence`：真实对象本身必须上屏时使用，例如官方原文、真实界面、录屏、演示、产品、地点或人物行为。某句话需要核验，并不自动等于主画面必须走本路。
2. `paper-editorial`：构造性说明画面的首选。机制、流程、因果、关系、层级、对比或决策路径需要物理隐喻时优先使用纸艺。
3. `ai-generated-video`：仅当需要具体人物或环境情景、且纸艺表达明显不自然时使用。它只能作说明，不能作证据。
4. `speaker`：钩子、本人判断、情绪、边界、金句、行动号召，或换画面不会增加理解时保留真人。

先独立判断事实是否需要核验，再判断观众此刻最该看什么。事实来源可以只在后台锁定、以可选来源卡呈现，或在真实对象本身值得上屏时成为 `real-evidence` 主画面。生成画面不得冒充证据。四路都没有配额；普通 AI 视频、纸艺视频、真实素材和 Shotcraft 都可以为 0。禁止每隔固定秒数换镜、为试功能强插素材，或用不相关的现成效果凑数。

每个 beat 还必须声明 `claimClass`、`requiresFactCheck` 与 `factCheckId`。`factual-claim` 和 `real-operation` 必须各自严格绑定一条顶层 `factChecks` 记录；其他类型不得伪造核验记录。事实核验与主画面路由互不替代：事实段可以保留真人，也可以用纸艺或普通 AI 作 `illustration-only` 主画面；只有真实对象本身需要上屏时才选 `real-evidence`。如果导演判断一句话只是本人观点或抽象解释，应如实分类，不能靠关闭核验标记绕过事实责任。

## 动作编排增强候选

本次增强把阿杜的连续动作、动作与阅读分离、真人交接和声音落点方法写入现有导演输出，不新增路线、字段或正式生产版本。正式 V8 与纸艺《超级个体》基线继续有效。

- 先写观众要理解的关系，再决定是否需要动效。确实采用动效的段落必须写清：**对象、初态、语义变化、结果、阅读停留**。动作应当呈现口播中的关系，不能把并列用途演成先后流程、把相关性演成因果。
- 同一对象跨段仍有意义时，说明上一段留下什么、下一段接住什么；没有承接意义时允许正常收场。不能默认每句清空重建，也不能为连续而硬连。
- 把动作发生、结果落定与阅读停留分开描述。拍前只绑定原句和触发词，不指定帧号；拍后再按实录安排时点。口播变长时先调整阅读停留，不能把整段动作和真人统一拉慢凑时长。
- 真人与资料交接时写明谁让位、焦点转给谁、何时回归。公开资料主画面仍遵守左下角真人小窗和独立字幕区，不照搬上游的右侧人物窗；人物口型连续，不用冻结人脸补时长。
- 重要动作写声音意图或有意留白的理由。声音服务具体触发、移动或落定，不规定每次都响；准确音点、音色、尾音和混音留到拍后试听，不能用统一延迟和统一音量代替设计。
- 真人/真实素材上的动作写入 `shotcraftOpportunities.reason`；`intent` 保持现有枚举。纸艺复用 `motionPlan.goal/actions/result` 和 `videoPrompt`；普通 AI 保持单主动作。字段用法与正反例见 [v2 导演核心](references/semantic-visual-director.v2.md#动作描述写入现有字段)。首帧仍只写静态初态。
- 保留真人的段落可以明确不加动效，不必补齐一套虚构动作。动效升级时还必须按[升级库发现与分层](references/motion-upgrade-discovery.v1.md)完成相关候选的真实动作比较，并在拍后把选定意图落实到代码与画面证据；“扫过全库”或“已下载”不能替代。

## 四类输出

顶层 `factChecks` 必须始终存在。每条事实核验记录写明来源要求、准备责任、是否需要上屏，以及核验失败时删改主张还是阻断生产。`onScreenTreatment=primary-real-evidence` 必须与 `real-evidence` 主画面一一对应；`not-required` 和 `optional-source-card` 不会强迫主画面改路由。

`routePlans` 中三条素材分路必须始终存在：

- `realMaterials`：真实素材执行单。未绑定来源时必须是 `candidate-unbound` 且 `usableInProduction=false`；写明需要什么、用来证明、演示或补充什么上下文、缺失时怎么处理。公开画面仅作叙事上下文且主张已另行核验时，允许缺失后保留真人；承担证据、演示或明确要求上屏的材料缺失时，必须改稿或阻断。禁止写生成提示词。
- `aiGeneratedVideos`：普通 AI 情景视频。必须是 `illustration-only`、`evidenceEligible=false`，仅用于纸艺不自然的具体人物或环境情景，并分开写静态首帧词和单主动作视频词。
- `paperEditorials`：纸艺解释片，也是构造性说明画面的默认首选。必须是 `illustration-only`、`evidenceEligible=false`；每镜需要独立构图、物理隐喻、`textPlan`、带准确中文的静态首帧词和服务一个认知目标的连续动作视频词。一个认知目标不等于只准一个原子动作。

一条分路有内容时使用 `status=planned`；没有内容时使用 `status=not-required`、`items=[]` 并写具体理由。这用于区分“确认不需要”和“遗忘了判断”。

`speaker` 在 `semanticBeats` 和 `protectedSpeakerBeatIds` 中记录，不生成素材包。

## 节奏和 Shotcraft

- 编制 `rhythmAudit`，复核每组连续真人 beat；即使整段只被拆成一个真人 beat 也不能跳过。最终处置可以保留表演、缩短文稿或绑定本组内的 Shotcraft 机会，但不强制插片。
- `shotcraftOpportunities` 只能标记功能意图，不能写具体 `cardId/effectId/presetId/componentId`。
- Shotcraft 只能对 `speaker` 和 `real-evidence` 标机会；禁止进入 `paper-editorial` 和 `ai-generated-video` 内部。
- 原片和素材到齐后，才根据实录原句、帧窗、字幕与人物保护区扫描当前全库，并对每个适用 beat 输出 `apply` 或 `not-needed`。
- 拍后必须读取机会记录中的完整 `reason`，逐项处理动作、阅读、承接和声音意图，不能只读 `intent` 就套现成列表。候选不适合时说明语义、素材或空间上的具体原因；适合但未适配时保留待办，不能伪写为已经实现或“现有效果足够”。
- 用户明确要求动效升级或拍后匹配升级候选时，按需读[升级库发现与分层](references/motion-upgrade-discovery.v1.md)。这不改变四路判断、七字段白名单或纸艺基准；独立升级试验与正式选卡、剪辑授权分开，下载库不等于全库已适配。

## 提示词边界

- 每种生成视觉单独建立 `styleLock`；该分路为 0 时风格锁必须是 `null`。
- 首帧词只写动作前的静态构图、主体、材料、光线、机位和初始状态。
- 视频词以“基于已确认首帧”开头。普通 AI 情景保持一个主动作；纸艺围绕一个认知目标编排有因果关系的连续动作、必要运镜和可读的结果停留，不因出现“然后”“同时”就判定多主题。
- 新纸艺统一声明 `styleLocks.paperEditorial.qualityBaselineId=paper-super-individual-20260829-v1`、`textPolicy=first-frame-generated-chinese-surface-bound`。基线是用户确认的 2026-08-29《超级个体》实际作品，不是只沿用一个风格名字。
- 纸艺目标中文同时写入 `textPlan` 和首帧词，说明分别印在哪个实际纸质物件上；生成首帧时一次性带字，不默认无字底图、本地烘焙或视频后的浮层补字。
- 新路线 `textPlan` 允许一至九条短标签，每条不超过八字；这不是数量目标，同屏能否读清仍须实际验收。逐项声明 `motion=with-object` 或 `fixed-context`，固定项写明 `reason`；`motionPlan` 记录认知目标、相关动作、结果、纸面文字绑定和原生动作声策略，字段以公共基线说明为准。
- 视频词明确文字与承载物件一起平移、旋转、展开或折页；字形身份保持稳定，不漂浮、不重绘。必要固定标题可以保留，但不得强制所有文字都固定、只让无字件运动。折页可改变纸面姿态，不能把字撕裂或变成乱码；阅读阶段必须能看清。
- 按原句设计丰富但有主次的物件组、至少三层空间、纸厚、接触阴影和因果动作，禁止所有镜头套同一桌面三字牌。纸片滑动、翻折、扣合等原生动作音应随动作生成并保留候选源；不添加解说或背景音乐，后期按原声口播试听决定混音，不一律静音。
- 旧 `first-frame-baked` 固定牌、无字底图与本地烘焙、毫米/投影合同只用于历史路线回归，不得倒灌到上述新基线。首帧确认与真实动态验收仍逐阶段执行，机器结构校验不能替代看图、看片和试听。
- 失败时只修改失败镜头；不连锁重写已经通过的其他镜头。

## 本期素材投放入口

导演表达到 `ready-for-user-review` 时，必须同时准备本期素材投放入口。这是导演交接的本地整理动作，不是素材生产或下游授权。

- 本期项目目录是唯一真实目录。目录内建立 `01_素材投放区/`，固定包含：`01_口播原片/`、`02_用户录屏与演示/`、`03_AI情景视频/`、`04_纸艺视频/`、`05_公开素材_Codex准备/`、`06_其他授权素材/`。
- `01_素材投放区/素材投放说明_请先看.md` 必须写清本期真实素材责任、AI/纸艺镜号、尚未授权的阶段及原文件保留规则。没有要求用户准备的分路，也应写明“不需要”，不能留空让用户猜。
- 在 `~/Desktop/口播素材/` 只建立一个按“日期_本期短标题”命名的符号链接，目标必须是本期项目目录。桌面入口只供用户放入素材；任何校验、哈希、生成、剪辑与渲染仍使用项目内规范路径。
- 建立前先解析并核对目标。若同名桌面项已存在且目标不同、不是符号链接或已经断开，禁止删除或覆盖，报告 `素材入口待处理`。
- 交付前复验桌面链接的实际目标、六个分区和投放说明，并在本期控制目录写入 `桌面入口回执.v1.json`，记录 `entry`、`type=single-directory-symlink`、`target`、`resolved` 和 `duplicateProjectCreated=false`。任一缺失时，不得把本期导演交接称为完整。
- 创建目录、说明和链接不启动素材搜索、下载、生图、OCR、RunningHub、Remotion、字幕、音效、渲染或发布，也不把 `handoffGate.downstreamAllowed` 改为 `true`。

## 校验与交接

```bash
node skills/koubo-remotion-director/scripts/validate-director-cues-v2.mjs \
  --input <director-cues.v2.json> \
  --repo-root <project-root>
```

校验器必须检查全文覆盖、事实段与 `factChecks` 严格一对一、事实核验与主画面分离、四路一对一映射、任一路可为 0、空分路理由、真实证据边界、AI/纸艺仅作说明、纸艺文字与动作边界、所有真人段节奏复核和 Shotcraft 严格字段白名单。

机器通过不代表导演质量通过，也不证明动作描述被实际实现。必须由用户审阅四路取舍、真实素材需求、AI 演绎必要性、纸艺构图、动作关系、阅读节奏与两类提示词。确认后才按项目 `AGENTS.md` 分路交给首帧、视频生成、真实素材入库和剪辑阶段。

现有交接会原样保留 Shotcraft 的 `reason`，把纸艺 `motionPlan` 交给图生视频子清单，并分别传递首帧词与视频词。拍后制作须按这些内容重新绑定实录，记录采用、调整或不采用的具体结果；交接字段存在不等于下游已消费。正式成片的效果仍以正常速度观看、试听和用户确认判断。

用户明确确认整份导演表后，才可用独立批准回执建立本地交接包：

```bash
node skills/koubo-remotion-director/scripts/build-director-cues-v2-handoff.mjs \
  --repo-root <project-root> \
  --cues <director-cues.v2.json> \
  --approval <director-cues-user-approval.v2.json> \
  --profile workflow/active-director-profile.v1.json \
  --output-dir <new-handoff-directory>
```

该交接只生成本地、不可覆盖的分路清单和校验回执，不授权外部提交、付费生成、Remotion 或发布。V9.1 强化状态必须同时绑定当前导演表、批准回执、handoff master 和 handoff validation receipt；删除 `directorPlanningOutput`、沿用旧提示词包或只重算状态外层哈希都不能绕过。
