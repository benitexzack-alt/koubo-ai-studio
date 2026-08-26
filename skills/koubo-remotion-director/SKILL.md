---
name: koubo-remotion-director
description: 把真实口播实录与权威时间轴编译成摄影级手作纸艺微缩风格的分镜、完成态静帧、动态样片计划和可复现 Remotion 命令。适用于需要为口播自动拆镜、生成纸厚/遮挡/机械因果或遮挡换态插片、执行 WithSfx/NoSfx 同画面样片或验证换输入不改源码的任务。
---

# 口播纸媒叙事装配导演

这项 Skill 的交付物不是一句提示词，也不是固定三段动画。它把一条真实口播的实录证据编译成可追溯、可换输入、可渲染的导演计划。

## 当前边界

- 只接受拍摄后的真实音视频和实录权威时间轴；拍摄前稿只能标 `comparison-only`。
- 最终参考片只学习纸材、空间、构图、装配、因果和声画机制，不复制品牌、照片、标题、具体版式、镜头顺序、机器外形或原音效。
- 旧 paper v1、G01–G04、西北算格 V1/V2 和旧 V3 成片都不得作为新母版或输入资产。
- 每条新样片都从 `candidate / awaiting-user-review` 开始。机器通过、静帧存在、视频能播放都不等于风格通过。
- 本地静帧、Remotion、SFX 和技术 QA 可以执行；联网、付费模型、正式自动化、正式剪辑恢复必须另获授权。

## 必读

按顺序读取：

1. 项目 `AGENTS.md`、`project.md` 和与实录、字幕、V8 相关的现行知识条目。
2. [paper-editorial-style.v1.json](references/paper-editorial-style.v1.json)。
3. [acceptance.md](references/acceptance.md)。
4. [workflow-contract.md](references/workflow-contract.md) 与 [validation-gates.md](references/validation-gates.md)。
5. 本条真实媒体、实录权威时间轴、语义节拍和允许使用的实录画面窗口。

[v4-visual-pack.md](references/v4-visual-pack.md) 是旧卡片包的退役说明，只用于识别并阻断历史路径，不是当前执行指南。

## 输入合同

从 [director-request.v1.json](templates/director-request.v1.json) 复制一份任务请求。至少绑定：

- 真实口播媒体的绝对路径和 SHA-256；
- 实录权威时间轴的绝对路径和 SHA-256；
- 样片源时间窗和输出时长；
- 每个语义节拍的原句、起止时间、认知增量和画面职责；
- 参考片 SHA-256 与风格卡 SHA-256；
- 允许使用的录屏片段和明确排除片段；
- 本地 SFX 的路径、SHA-256、用途和相对落点。
- 摄影级状态图、遮挡物和真实证据合成回执的路径、SHA-256、来源裁切与已披露光学处理。
- 用户风格方向接受、监督静帧门和状态资产包回执的绝对路径、SHA-256、效力类型与逐资产绑定。

缺少任一真实证据时停止编译，不用计划稿补位。

## 分镜编译

运行：

```bash
node skills/koubo-remotion-director/scripts/compile-director-plan.mjs \
  --request <director-request.json> \
  --output <director-output.json> \
  --repo-root <isolated-worktree>

node skills/koubo-remotion-director/scripts/validate-director-output.mjs \
  --plan <director-output.json> \
  --request <director-request.json> \
  --repo-root <isolated-worktree>

node skills/koubo-remotion-director/scripts/emit-render-command.mjs \
  --plan <director-output.json> \
  --request <director-request.json> \
  --repo-root <isolated-worktree>
```

`emit-render-command.mjs` 只对已通过正式 validator 的 `renderable` 计划输出固定 `cwd + argv`；`plan-only` 必须稳定拒绝。Schema 验证实际使用本地 Ajv 8.20.0 单文件闭包，第三方许可见 [Ajv-8.20.0-MIT.txt](assets/licenses/Ajv-8.20.0-MIT.txt)。

编译器必须根据语义类型选镜，不按固定中文或固定秒码选镜：

- `complex-explanation`：5–6 个物件组、9–13 个节点、至少 3 层空间、至少 5 级可见装配；每一级都增加认知，不用漂移、脉冲或装饰性浮动刷动态。
- `mechanical-causality`：输入进入、一个明确机械动作、对应输出推出、环境闭合；不能用硬切或变形冒充因果。
- `occluded-state-reveal`：只在遮挡物完全覆盖时切换已绑定的摄影级状态图；只能声称“遮挡换态/显现”，不得写成真实机械关节动画。输入态、遮挡态、结果态和事实边界必须分别绑定资产与 SHA-256。

当纯 CSS/矢量原语达不到参考片的摄影级微缩质感时，使用“高保真完成态状态图 + 确定性真实证据/中文合成 + Remotion 遮挡换态、字幕和音效”的混合管线。图像生成只能生成原创、无品牌、无文字、无 UI 的底图；真实截图与中文必须由确定性合成层写入并留下回执。

输出必须同时包含 `executionMode`、`scenes`、`captions`、`stillPlan`、`samplePlan`、固定 `cwd + argv` 的 `commands` 以及全链 SHA-256。`renderable` 才能生成渲染命令；`plan-only` 只允许 `validate-plan`。

直接播放录屏片段时必须保留 `excludedRanges`，逐片派生 `trimBeforeFrame + trimAfterFrame + playbackRate`，并绑定覆盖完整输出窗的受控父层；任何片段与排除区间重叠即阻断。若真实画面已经通过确定性合成进入摄影状态图，不得再声明为运行时录屏层；应改为绑定上游代表帧、裁切坐标、合成脚本、字体与结果 SHA-256。

## 静帧先行

先核对每张 still 的 `requiredStageIds`、共享动画完成模型给出的 `completion.actualCompletionFrame`、`completion.lockEndExclusiveFrame` 和 `minimumSettledFrames >= fps`（当前 30 帧）；除下述唯一窄例外外，必须在关系真完成后留出完整 1 秒锁定窗，再原样执行输出中的 still 命令，生成三张完成态：

唯一窄例外只适用于 `exact30 candidate-only`：请求必须绑定已经通过的 supervisor A acceptance，镜头必须是 canonical A 的 `progressive-local-assembly`，其权威终态严格为 `A16 = F463`、`endExclusive = F473`，因此该镜头 completion 及其全阶段完成态 still 的终态锁定窗可为 10 帧。只有 compiler、validator、renderer 使用同一判定，固定 acceptance registry 的双 SHA 锚、验收与独立复核回执、17 态路径/顺序/帧，以及 A16 终态资产 SHA-256 全部匹配时才允许该例外；9 帧仍拒绝，任何普通镜头的 29 帧仍拒绝。该例外只修正这条精确 30 秒候选的完成窗约束，不代表 `productionEligible=true`，也不授权正式生产、口播自动化解冻、外部平台动作或发布。

1. 复杂多轨装配完成态；
2. 遮挡换态后的证据完成态；
3. 地图到菜单的事实边界完成态。

再制作联系表，与参考片的锁定代表帧并排检查：

- 纸厚、接触阴影和材质差异是否真实可感；
- 前中后景遮挡是否成立；
- 是否出现平面卡片/PPT 式重复版式；
- 复杂镜是否真的有 5–6 组、9–13 节点和 5 级装配；
- 真实机械镜能否在静音状态下读出输入、连续动作和输出；遮挡换态镜能否准确读出输入态、完全遮挡换态点和显现结果，且没有冒充机械关节动画。

静帧没有达到参考片同一视觉语言时，不启动视频渲染；保留已完成分镜和完成态需求，转入外部生成报价与单独授权。

## 动态样片

三张静帧方向分别通过后，执行输出中的两条精确 30.0 秒视频命令：

- `PaperEditorialDirector-Sample-WithSfx`
- `PaperEditorialDirector-Sample-NoSfx`

两条 Composition 必须共用同一视觉组件和同一 props；`withSfx` 只能增加 SFX 音轨，不能改变任何画面分支。NoSfx 仍保留真实口播。

不得用空白纸擦除做长转场。优先使用同一物件、定位针、纸带或输出窗口的匹配连续。

## 验收

逐项执行 [acceptance.md](references/acceptance.md)。最低证据包括：

- 快速包装校验和真实输入前向测试；
- 输出命令在隔离工作树原样运行；
- WithSfx/NoSfx 视频流逐帧一致；
- 两片完整解码、黑白场、冻结、重复帧、字幕和音轨检查；
- 与参考片并排人工审查；
- 第二条不同真实输入不改编译器源码，生成不同计划和命令；
- 独立 SHA-256 复核；
- 用户按正常速度完整观看并明确接受。

用户明确接受后，从 [director-user-style-acceptance.v1.json](templates/director-user-style-acceptance.v1.json) 实例化一张独立验收回执，绑定用户消息来源、选中的 WithSfx 路径与 SHA-256、同画面 NoSfx、请求、计划和机器 QA 回执。不得回写或改写已经生成的请求、计划、媒体 QA 回执来制造晋级状态。

任何一项缺失时，只能写 `candidate` 或 `awaiting-user-review`，不能写 `complete`、`verified`、`promoted` 或 `production-ready`。

## 第二输入前向测试

第二输入只验证“数据变、计划变、源码不变”，必须使用 `execution.mode=plan-only`，输出不得包含视频或静帧渲染命令。除非用户后续明确要求，不复制其大体积媒体、不渲染第二条旧内容，不把其历史成片状态外推到本轮。

运行：

```bash
node skills/koubo-remotion-director/scripts/test-forward-real-input.mjs
```

脚本默认读取本次两份真实输入；需要换任务时再显式传入 `--wechat-request`、`--ai-request` 与 `--repo-root`。测试必须记录编译器 SHA、两份请求 SHA、两份计划 SHA、两份命令差异和源码前后 SHA；源码发生变化则测试失败。

## 付款与外部模型

如果本地确定性方法达不到参考片同一质量维度，停止在完成态静帧/分镜/提示词阶段，并单独列出：模型、分辨率、镜数、每镜时长、准确费用、批准静帧路径与 SHA-256。用户明确授权前不得创建任务、联网调用或扣费。
