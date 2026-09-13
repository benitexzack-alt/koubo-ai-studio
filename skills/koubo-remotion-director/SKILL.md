---
name: koubo-remotion-director
description: 用于口播的全片导演规划。完整读取用户确认文稿或实录，按语义判断何处保留真人、使用真实素材、普通 AI 情景视频或纸艺解释片，输出真实素材执行单、两类首帧/视频提示词和拍后 Shotcraft 机会。本 Skill 只到导演表人工确认，不执行生成、剪辑或发布。
---

# 口播全片语义导演

> 目录名中的 `remotion` 仅为历史兼容，不代表本阶段执行 Remotion。

## 阶段边界

- 阶段固定为 `director-only`。输入必须是完整的用户确认文稿，或拍摄后的真实口播转写。
- 本阶段只读取当前文稿、用户确认的风格参考、本文件、[v2 导演核心](references/semantic-visual-director.v2.md) 和 [v2 导演表模板](templates/director-cues.v2.json)。
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

## 四类输出

顶层 `factChecks` 必须始终存在。每条事实核验记录写明来源要求、准备责任、是否需要上屏，以及核验失败时删改主张还是阻断生产。`onScreenTreatment=primary-real-evidence` 必须与 `real-evidence` 主画面一一对应；`not-required` 和 `optional-source-card` 不会强迫主画面改路由。

`routePlans` 中三条素材分路必须始终存在：

- `realMaterials`：真实素材执行单。未绑定来源时必须是 `candidate-unbound` 且 `usableInProduction=false`；写明需要什么、用来证明、演示或补充什么上下文、缺失时怎么处理。公开画面仅作叙事上下文且主张已另行核验时，允许缺失后保留真人；承担证据、演示或明确要求上屏的材料缺失时，必须改稿或阻断。禁止写生成提示词。
- `aiGeneratedVideos`：普通 AI 情景视频。必须是 `illustration-only`、`evidenceEligible=false`，仅用于纸艺不自然的具体人物或环境情景，并分开写静态首帧词和单主动作视频词。
- `paperEditorials`：纸艺解释片，也是构造性说明画面的默认首选。必须是 `illustration-only`、`evidenceEligible=false`；每镜需要独立构图、物理隐喻、`textPlan`、静态首帧词和单主动作视频词。

一条分路有内容时使用 `status=planned`；没有内容时使用 `status=not-required`、`items=[]` 并写具体理由。这用于区分“确认不需要”和“遗忘了判断”。

`speaker` 在 `semanticBeats` 和 `protectedSpeakerBeatIds` 中记录，不生成素材包。

## 节奏和 Shotcraft

- 编制 `rhythmAudit`，复核每组连续真人 beat；即使整段只被拆成一个真人 beat 也不能跳过。最终处置可以保留表演、缩短文稿或绑定本组内的 Shotcraft 机会，但不强制插片。
- `shotcraftOpportunities` 只能标记功能意图，不能写具体 `cardId/effectId/presetId/componentId`。
- Shotcraft 只能对 `speaker` 和 `real-evidence` 标机会；禁止进入 `paper-editorial` 和 `ai-generated-video` 内部。
- 原片和素材到齐后，才根据实录原句、帧窗、字幕与人物保护区扫描当前全库，并对每个适用 beat 输出 `apply` 或 `not-needed`。

## 提示词边界

- 每种生成视觉单独建立 `styleLock`；该分路为 0 时风格锁必须是 `null`。
- 首帧词只写动作前的静态构图、主体、材料、光线、机位和初始状态。
- 视频词以“基于已确认首帧”开头，只写一个主动作、必要运镜和结束状态。
- 纸艺中文只写在 `textPlan`，每镜一至四个、每个不超过八个字，并绑定首帧中独立固定的空白纸牌。
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

机器通过不代表导演质量通过。必须由用户审阅四路取舍、真实素材需求、AI 演绎必要性、纸艺构图与两类提示词。确认后才按项目 `AGENTS.md` 分路交给首帧、视频生成、真实素材入库和剪辑阶段。

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
