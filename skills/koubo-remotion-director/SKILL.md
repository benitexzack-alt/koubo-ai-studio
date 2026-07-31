---
name: koubo-remotion-director
description: 口播项目的 Remotion 视频包装导演流程。用于包含本项目 AGENTS.md、knowledge/、remotion/、tools/ 和 workflow/ 的口播仓库，将转写、粗剪或完整原片推进到 visual-plan.json、V4/V5/V6/V7 视觉规划、风险帧预览、Remotion 包装、字幕/动效/遮挡质检和 release 记录；当用户要求优化口播剪辑流程、做视觉实验、把参考图落到成片、修复卡片裁切/挡脸/字幕错位或生成与校验 visual-plan/release 时使用。
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
10. 与本条视频直接相关的转写、EDL、素材清单、视觉参考和发布记录

按任务需要再读：

- [references/workflow-contract.md](references/workflow-contract.md)：需要生成或校验一条视频的导演流程时读取。
- [references/v4-visual-pack.md](references/v4-visual-pack.md)：需要执行 V4 视觉实验、参考图落地或新增卡片时读取。
- [references/validation-gates.md](references/validation-gates.md)：需要渲染预览、检查风险帧、导出正式片或填写 release 时读取。

## 工作流

### 1. 识别任务类型

- 选题/脚本阶段：先做事实、合规和素材需求判断，不进入 Remotion。
- 粗剪/字幕阶段：以词级转写和 EDL 输出时间轴为准，不手估字幕时间。
- 视觉包装阶段：先写 `visual-plan.json`，再做 Remotion 组件或参数。
- V4 实验阶段：优先读取 V4 参考与验收，不回退旧 `mind-map / perspective / metric / flow` 默认包。
- V7.2 正式阶段：默认使用语义数字运镜、透明信息组件、全屏素材、中英文同窗字幕和本地音效 V2；章节、流程、证据、数字和媒体标注不得全部挤进同一种卡片。
- 正式导出阶段：先预览和风险帧，后全片；先机器质检，后用户完整观看。

### 2. 建立本条视频事实源

只处理用户指定素材。不得扫描无关桌面、下载、证件、合同、财务目录。

优先确认：

- 原片路径和只读副本；
- 是否删减、是否全量保留、是否已有 EDL；
- 最终字幕时间轴来源；
- 参考图、真实 B-roll、截图、AI 素材的授权和用途；
- 指定视觉素材是否确需抠图或升清；仅在 `ready-for-production` 后调用 `koubo-asset-prep`，证据截图和真人主口播保持原样；
- 本条唯一主观点和行动引导；
- 是否涉及抖音高风险垂类、AI 声明、商单、投放或交易。

### 3. 生成视觉方案

使用 `templates/03-visual-plan-template.json` 或已有方案递进生成 `edit/visual-plan_<id>_vN.json`。

每个图层必须包含：

- `start` / `end` / `spokenLine`
- `purpose` / `kind` / `variant`
- `titleOwner` / `overlapGroup` / `zone`
- `asset.sourceType` / `asset.source`
- `checks.needsFrameReview` / `checks.reviewAt`
- 避让对象：脸、手、底部字幕、安全区

校验：

```bash
node tools/validate-visual-plan.mjs <visual-plan.json>
```

校验失败时先修方案，不渲染全片。

如果方案明确需要透明 PNG、授权低清图修复或生成式 B-roll 升清，先用 `koubo-asset-prep` 生成候选素材和 `.asset-prep.json`。人工检查透明边缘、虚构细节、文字、面部和运动稳定性后，才能把候选路径写入视觉方案；封面仍只交付提示词，不进入本机抠图或升清链路。

### 4. 做预览和风险帧

先为本条建立 `workflow/jobs/<id>.production.json`，然后统一执行：

```bash
node tools/run-v72-production.mjs <production-job.json> prepare
```

`prepare` 必须一次完成有音效动态预览、完整分辨率风险帧和音频预检。输入指纹完全一致时允许命中缓存；任一素材、字幕、组件、方案或音效变化时必须失效。

正式片前必须输出 20-30 秒预览或覆盖关键节点的 still/range。预览至少覆盖：

- 钩子；
- 最复杂叠层；
- 本条实际采用的每类 V4 或 V7.1 组件；
- 每段全屏素材；
- 结尾 CTA。

必须抽查 `reviewAt` 风险帧。发现卡片裁切、文字溢出、字幕错位、挡脸、挡手或标题叠层时，回到视觉方案或组件修正。

### 5. 导出与发布记录

预览和风险帧通过后，只渲染一次 `WithSfx` 正式片：

```bash
node tools/run-v72-production.mjs <production-job.json> formal
```

`formal` 包含两遍响度处理和正式片机器质检。公共模板、渲染链路或基线参数变化时，还必须对锁定母版执行 `regression`。

正式导出后填写或更新 `workflow/releases/<id>.json`，再执行：

```bash
node tools/validate-release.mjs <release.json>
```

验证通过也只能说明机器侧通过。用户完整观看确认后，才允许把状态推进到已确认。

## 硬边界

- 不把旧卡片包当作下一条 V4 默认高级包装。
- 不用固定高度和 `overflow: hidden` 掩盖内容超限。
- 不用手工估字幕时间替代词级转写或 EDL 映射。
- 不让参考图只停留在计划文字里；必须绑定原创组件变体和验收帧。
- 不为了高级感强制生图；真实素材和确定性 Remotion 排版优先。
- 不把二创参考视频当作事实原始信源；外部案例引用必须显示来源和证据边界。
- 不在左上角显示 V7、V7.1 或模板名，只保留“超哥AI创业记”。
- 沿用已验收的本地音效 V2 时，默认只出有音效动态预览；只有音色、音量策略或音效类型发生变化，或故障排查、用户明确要求时，才必须做同画面 30 秒 `WithSfx / NoSfx` A/B。
- 不把机器质检、编译成功或文件存在说成发布效果已验证。
