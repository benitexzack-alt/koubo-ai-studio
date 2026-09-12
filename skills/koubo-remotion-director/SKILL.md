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

1. `real-evidence`：需要证明数据、官方原文、真实界面、录屏、演示、产品、地点或人物行为。
2. `ai-generated-video`：通用情境或人物行为无可用实拍，而情景演绎能明显增加具体性、情绪或节奏。它只能作说明，不能作证据。
3. `paper-editorial`：机制、流程、因果、关系、层级、对比或决策路径需要物理隐喻。
4. `speaker`：钩子、本人判断、情绪、边界、金句、行动号召，或换画面不会增加理解时保留真人。

事实性画面先判断真实素材，不得生成冒充。其余三路没有优先级和配额；普通 AI 视频、纸艺视频、真实素材和 Shotcraft 都可以为 0。禁止每隔固定秒数换镜、为试功能强插素材，或用不相关的现成效果凑数。

每个 beat 还必须声明 `claimClass` 与 `requiresRealEvidence`。`factual-claim` 和 `real-operation` 必须标记需要真实证据并进入 `real-evidence`；如果导演判断它其实只是本人观点或抽象解释，就应如实改分类，不能用 `requiresRealEvidence=false` 绕过。官方原文、数据和真实操作不得伪装成 `generic-illustration` 送入 AI；普通 AI 只接受不指向真实主体的通用情景，纸艺只接受抽象逻辑解释。

## 四类输出

`routePlans` 中三条素材分路必须始终存在：

- `realMaterials`：用户素材执行单。未绑定来源时必须是 `candidate-unbound` 且 `usableInProduction=false`；写明需要什么、用来证明或演示什么、缺失时怎么处理。禁止写生成提示词。
- `aiGeneratedVideos`：普通 AI 情景视频。必须是 `illustration-only`、`evidenceEligible=false`，并分开写静态首帧词和单主动作视频词。
- `paperEditorials`：纸艺解释片。每镜需要独立构图、物理隐喻、`textPlan`、静态首帧词和单主动作视频词。

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

## 校验与交接

```bash
node skills/koubo-remotion-director/scripts/validate-director-cues-v2.mjs \
  --input <director-cues.v2.json> \
  --repo-root <project-root>
```

校验器必须检查全文覆盖、四路一对一映射、任一路可为 0、空分路理由、真实证据边界、AI 演绎边界、纸艺文字与动作边界、所有真人段节奏复核和 Shotcraft 严格字段白名单。

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
