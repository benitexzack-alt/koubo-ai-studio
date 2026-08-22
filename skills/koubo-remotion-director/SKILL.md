---
name: koubo-remotion-director
description: 口播项目的 Remotion 视频包装导演流程。用于包含本项目 AGENTS.md、knowledge/、remotion/、tools/ 和 workflow/ 的口播仓库，将转写、粗剪或完整原片推进到 visual-plan.json、纸构推演自动插片、V8连续语义视觉规划、风险帧预览、Remotion包装、字幕/动效/遮挡质检和release记录；当用户要求优化口播剪辑流程、按V8制作视频、把参考图或抽象机制落到成片、修复卡片裁切/挡脸/字幕错位或生成与校验visual-plan/release时使用。
---

# 口播 Remotion 导演

## 项目根目录

从当前工作目录向上查找同时包含 `AGENTS.md`、`remotion/`、`tools/` 和 `workflow/` 的目录，将它记为 `<project-root>`。后续路径都相对于该目录，不依赖固定用户名或克隆位置。

## 核心定位

把 Codex + Remotion 从“临时写动效”变成口播项目的固定导演流程。优先保证真实口播、字幕时间轴、视觉可读性和发布门禁，再追求高级动画。

Remotion 是精确包装工具，不替代粗剪软件。正式片必须先有视觉方案、风险帧预览和机器质检；用户完整观看前，只能说“预览已生成”或“机器侧质检通过”。

## 必读顺序

每次执行前从 `<project-root>` 读取：

1. `AGENTS.md`
2. `project.md`
3. `knowledge/00-项目知识索引.md`
4. `knowledge/03-口播执行守则.md`
5. `knowledge/04-内容生产SOP.md`
6. `knowledge/12-Remotion协作与模板迭代机制.md`
7. `knowledge/16-V7.1透明信息包装与本地音效基线.md`
8. `knowledge/17-V7.2语义运镜与音效默认流程.md`
9. `knowledge/18-V7.2保质提速生产流程.md`
10. `knowledge/19-V7.3素材协作、逐卡音效与保质提速验证.md`
11. `knowledge/20-V8连续语义动效与可感知音效基线.md`
12. `knowledge/22-实录优先字幕与系列发布包硬门禁.md`
13. `templates/10-超哥AI创业记_3比4系列封面提示词母版.md`
14. `workflow/active-production-profile.v1.json`
15. 与本条视频直接相关的转写、EDL、素材清单、视觉参考和发布记录

按任务需要再读：

- [references/workflow-contract.md](references/workflow-contract.md)：需要生成或校验一条视频的导演流程时读取。
- [references/paper-construct-generated-video.md](references/paper-construct-generated-video.md)：需要把抽象机制自动拆成“纸构推演 v1”插片并通过 RunningHub 生成时读取。
- [references/v4-visual-pack.md](references/v4-visual-pack.md)：需要执行 V4 视觉实验、参考图落地或新增卡片时读取。
- [references/validation-gates.md](references/validation-gates.md)：需要渲染预览、检查风险帧、导出正式片或填写 release 时读取。

## 工作流

### 1. 识别任务类型

- 选题/脚本阶段：先做事实、合规和素材需求判断，不进入 Remotion。
- 粗剪/字幕阶段：以词级转写和 EDL 输出时间轴为准，不手估字幕时间。
- 视觉包装阶段：先写 `visual-plan.json`，再做 Remotion 组件或参数。
- V4 实验阶段：优先读取 V4 参考与验收，不回退旧 `mind-map / perspective / metric / flow` 默认包。
- V8 正式阶段：所有新视频默认使用人物主画面、局部连续语义动效、真实素材优先、逐主视觉声画绑定和可感知本地音效；说明型Remotion覆盖率不得超过42%，不得使用全屏黑板、`call-demo`或连续翻卡式PPT表达。
- V7.2 历史阶段：只保留通用技术参数、锁定母版回归和故障回滚；不得因为参考“兰州OPC”或复用旧任务而把新视频静默降级。
- 降级例外：必须在生产任务写入用户明确批准、时间、原因和单条适用范围；导演推断、旧知识条目和历史模板都不能替代批准。
- 正式导出阶段：先预览和风险帧，后全片；先机器质检，后用户完整观看。

### 2. 建立本条视频事实源

只处理用户指定素材。不得扫描无关桌面、下载、证件、合同、财务目录。

优先确认：

- 原片路径和只读副本；
- 拍摄后以原片实际声音作为唯一字幕正文，拍摄前文稿只作 `comparison-only`；
- 是否删减、是否全量保留、是否已有 EDL；
- 最终字幕时间轴来源；
- 参考图、真实 B-roll、截图、AI 素材的授权和用途；
- 每个非主播画面先声明素材决策：`speaker | real-evidence | generated-video | remotion-information`，以及制作责任：`existing | user | codex-remotion | codex-provider`；`codex-provider` 仅允许用于 V8 的纸构概念演绎插片；
- 需要人物、真实行动、场景、空间或氛围的 `generated-video` 仍由用户或授权真实素材负责；只有抽象机制、因果和关系可使用 `codex-provider`，不得默认用 Remotion 信息动画或生成画面冒充叙事事实；
- 指定视觉素材是否确需抠图或升清；仅在 `ready-for-production` 后调用 `koubo-asset-prep`，证据截图和真人主口播保持原样；
- 本条唯一主观点和行动引导；
- 是否涉及抖音高风险垂类、AI 声明、商单、投放或交易。

### 3. 生成素材执行单和视觉方案

如果本条需要用户制作图片或视频，先使用 `templates/05-用户素材执行单模板.md` 生成单独执行单。每个项目必须写清“文生视频 / 图生视频 / 文生图 / 真实素材”、对应原句、时长、中文提示词、文件名和放置目录。不得向用户交付无编号、中英文混杂或无法判断生成类型的提示词。

如果本条存在需要解释的抽象机制，自动读取 `references/paper-construct-generated-video.md` 和 `workflow/style-library/koubo-paper-construct-v1.json`。先按语义选择最少必要的 `0—N` 个插片；`N=0` 时不建立生成计划，有镜头时才从 `templates/08-generated-video-plan-template.json` 建立机器计划。不得固定五镜或逐句平均切。每镜必须形成“初始状态 → 一个可见施力动作 → 稳定结果”，并锁定物体身份、形状和施力接触连续性。

自动插片固定走 `RunningHub / MiniMax-H3 / 2K / 16:9`。先离线编译和预检，再全量报价并向用户报告当前计划总额；只有用户对当前 `planId` 明确确认费用上限，且授权绑定当前 `generationDefinitionSha256`、未超过 24 小时有效期后，才允许使用 `--confirm-paid` 提交。同一 `approvalId` 只保留一份固定消费回执；拆镜、提示词或输出定义变化后必须重新报价和授权。每个镜头真正提交前都必须刷新剩余镜头报价，重新核算单镜和累计上限；每镜最多一次付费任务，禁止自动重试。单镜、末镜或累计实际费用超限，以及实际费用缺失、非法或无法对账时，都必须落盘并停止后续付费提交，禁止把预估金额写成实际扣费。中断时只能恢复与当前计划、提示词、输出路径和授权完整绑定的同一 `taskId`，对既有文件先做哈希对账，冲突时隔离而不覆盖。下载后必须生成五点联系表并完成带逐项观察和证据哈希的视觉复核；计划同时达到 `qa-passed` 并通过 `materialized` 门禁后，才能进入 V8 `prepare`。`doctor`、`prepare`、校验和缓存失效不得隐式触发付费生成。

以已验证的 `workflow/jobs/20260810_ai_cognitive_position_v80.production.json`、对应V8视觉方案和音效点位表为结构参考，生成 `edit/visual-plan_<id>_v8.json`、`edit/sfx-cue-sheet_<id>_v8.json` 和 `workflow/jobs/<id>_v80.production.json`。只复制结构，不复制上一条文案、时间点、素材路径或画面内容。

每个新任务必须先声明：

```json
"productionProfile": {
  "id": "v8-semantic-continuity-sfx",
  "version": "V8"
}
```

每个图层必须包含：

- `start` / `end` / `spokenLine`
- `purpose` / `kind` / `variant`
- `titleOwner` / `overlapGroup` / `zone`
- `asset.sourceType` / `asset.source`
- `checks.needsFrameReview` / `checks.reviewAt`
- 避让对象：脸、手、底部字幕、安全区

V8每个图层还必须包含：

- `assetDecision.class` / `assetDecision.producer` / `assetDecision.fallback`
- `visualEvent.id` / `visualEvent.enterAt` / `visualEvent.primary`
- `sound.policy` / `sound.role` / `sound.cueId` / `sound.offsetFrames` / `sound.maxSyncErrorFrames`
- 音效点使用同一 `visualEventId` 反向绑定，不再仅靠文字描述猜测对应关系

校验：

```bash
node tools/validate-visual-plan.mjs <visual-plan.json>
```

V8必须执行：

```bash
node tools/validate-active-production-profile.mjs <production-job.json> doctor
node tools/validate-v8-production-contract.mjs <production-job.json>
```

第一道门禁确认没有静默降级；第二道门禁要求主视觉单元音效覆盖率100%、同步偏差不超过2帧、人物局部信息层不超过42%、同一音效25秒内不重复，并强制同画面有声/无声30—45秒预览。

校验失败时先修方案，不渲染全片。

如果方案明确需要透明 PNG、授权低清图修复或生成式 B-roll 升清，先用 `koubo-asset-prep` 生成候选素材和 `.asset-prep.json`。人工检查透明边缘、虚构细节、文字、面部和运动稳定性后，才能把候选路径写入视觉方案；封面仍只交付提示词，不进入本机抠图或升清链路。

### 4. 做预览和风险帧

先为本条建立 `workflow/jobs/<id>.production.json`，然后统一执行：

```bash
node tools/run-v72-production.mjs <production-job.json> prepare
```

`prepare` 必须先无条件校验当前V8生产档案，再一次完成同画面有声/无声动态预览、完整分辨率风险帧和音频预检。输入指纹完全一致时允许命中缓存；任一素材、字幕、组件、方案、音效、生产档案或档案校验器变化时必须失效。脚本名保留`run-v72-production.mjs`只是兼容历史调用，不代表当前视觉版本。

正式片前必须输出 20-30 秒预览或覆盖关键节点的 still/range。默认不做全长低清预览；只有删减、重排、大量字幕不确定或全片结构风险时才允许，并在生产任务中写明原因。预览至少覆盖：

- 钩子；
- 最复杂叠层；
- 本条实际采用的每类 V4 或 V7.1 组件；
- 每段全屏素材；
- 结尾 CTA。
- 本条实际使用的每种新音效角色。

必须抽查 `reviewAt` 风险帧。发现卡片裁切、文字溢出、字幕错位、挡脸、挡手或标题叠层时，回到视觉方案或组件修正。

### 5. 导出与发布记录

预览和风险帧通过后，只渲染一次 `WithSfx` 正式片：

```bash
node tools/run-v72-production.mjs <production-job.json> formal
```

`formal` 包含两遍响度处理和正式片机器质检。公共模板、渲染链路或基线参数变化时，还必须对锁定母版执行 `regression`。

`formal`、`formal-audio`和`all`必须先经过生产命令硬门禁。任务中`formal.enabled=false`时，执行器必须在Remotion打包和渲染之前直接失败；只有用户确认同画面动态预览并同步更新V8合同后才能显式解锁。

必须保留生产器写出的 `timing-report.json`。没有计时报告，不得宣称提速；因修正问题重渲正式片时，必须在运行记录中写明原因。

正式导出后填写或更新 `workflow/releases/<id>.json`，再执行：

```bash
node tools/validate-release.mjs <release.json>
```

V8 有音效正式候选片生成后，必须立即完成最低交付包：从本条候选片的本人真实口播画面中截取一张推荐封面人物图，记录候选片路径和截取时间点；按固定系列母版准备全中文 `3:4` 真人截图合成封面提示词、一个抖音主标题、两个备选标题、抖音发布文案和话题，并绑定当前文本的双 Skill 审稿记录。推荐截图优先选择正面清晰、眼睛自然睁开、口型不过度变形、无运动模糊、无遮挡脸、无隐私且有标题排版空间的帧。缺少任一项时，发布记录必须保持 `incomplete-delivery`，不得称为完整交付。

发布记录还必须绑定 `spoken-source-policy.json`。新片必须通过 `spoken-source-v1`，证明中文字幕来自实录声音、英文从实录中文翻译；历史片只有用户明确接受单条偏差时才能登记与 release ID 绑定的已知例外。

验证通过也只能说明机器侧通过。用户完整观看确认后，才允许把状态推进到已确认。

## 硬边界

- 不把旧卡片包当作下一条 V4 默认高级包装。
- 不用固定高度和 `overflow: hidden` 掩盖内容超限。
- 不用手工估字幕时间替代词级转写或 EDL 映射。
- 不用拍摄前文稿替换、压缩或顺句实际口播；字幕和英文翻译都以实录为准。
- 不让参考图只停留在计划文字里；必须绑定原创组件变体和验收帧。
- 不为了高级感强制生图；真实素材和确定性 Remotion 排版优先。
- 不用 Remotion 信息动画默认替代需要人物、场景、行为、空间或氛围的叙事视频；素材缺失时要明确降级为主播 + 信息卡或“情景示意”。
- 不用纸构推演插片替代真实界面、截图、数据、官方材料或现场证据；自动生成素材只允许标记为“AI生成·概念演绎 / 非真实业务证据”。
- 不让 `doctor`、`prepare`、校验、缓存失效或自动重跑隐式提交 RunningHub 付费任务；必须先全量报价，再取得绑定当前计划的金额授权。
- 不把二创参考视频当作事实原始信源；外部案例引用必须显示来源和证据边界。
- 不在左上角显示 V7、V7.1 或模板名，只保留“超哥AI创业记”。
- V8固定做同画面30—45秒`WithSfx / NoSfx` A/B；未经用户正常音量试听确认，正式渲染保持锁定。
- V8不要求每个字、字幕或卡内小项都发声，但所有标记为主视觉单元的动效卡必须有精确绑定音效；不得用“这一段里有一声”代替逐卡覆盖。
- 不把机器质检、编译成功或文件存在说成发布效果已验证。
