---
name: koubo-shotcraft-library
description: 为口播 V9.1 导演自动检索、评分和选择 Shotcraft 信息层动效，并把用户对候选片的通过或否决写入可校验经验账本。适用于关键词强调、逐项呈现、真实证据框选和章节连接；不替代摄影级纸艺、真实素材或 RunningHub。本条实际使用必须经过自动匹配、落片回执和用户预览验收闭环。
---

# 可选动效库

## 边界

先读项目 `koubo-remotion-director` 和当前四分支路由。本库是辅助信息层，不是第五种主画面，不改变 V8 默认、纸艺首帧叠字或图生视频流程。

本地目录包含上游锁定快照的 157 张卡、214 个样式，但不等于所有效果都已接入。仅 `registry.v1.json` 中五项具备候选组件，默认仍为 `candidate-only`。其他 152 张参与自动检索，但只能进入适配队列；不得自动下载、执行远程代码或引用预览视频当成自己的素材。

## V9.1 自动选择与执行

1. 在实录字幕和素材盘点完成后，导演为每个 beat 绑定原句、时间窗、语义意图、主画面、素材类型、可用区域和人物/字幕避让区。
2. `match-director-effects.mjs` 必须检索 `card-capability-index.v2.json` 的全部 157 张卡，以语义相关性和已验收经验为主要依据，自动生成逐 beat `apply | not-needed` 决策。用户不需要手动找卡。
3. 若最匹配卡尚无本地组件，必须保留原画面并输出适配候选，不得用相关性更低的已适配卡替换。
4. 运行 `validate-plan.mjs <计划.json> <项目根>`。它只验本库合同，不替代现有知识上下文、生产前置和实录源校验。
5. 只读导入 `assets/ShotcraftEffects.tsx`，外部显式传入帧数、帧率和时长；不改 V8 公共组件。禁止 CSS 实时时钟、随机结果、素材循环或冻结补时。
6. 先看风险帧，再做 30–45 秒同画面的有/无附加音效样片，核对声画、字词、遮挡与手机小尺寸。样片只能标记待用户审阅。用户确认具体效果后，才可在新片计划中申请使用，不能直接重做已完成影片。

## V9.1 导演选择、实际应用与经验闭环

本闭环不设全片效果配额，也不自行改变注册效果的 `candidate-only` 状态或授予生产权限。它只把已经取得本条权限的导演决定变成可校验合同，并证明最终成片确实消费了所选组件。

1. 从 `templates/auto-match-request.v1.template.json` 建立请求，由匹配器自动生成选择合同；不再把手工浏览卡库当作正常工作流。`catalog.mjs` 只保留给调试和库维护。
2. `apply` 必须绑定注册效果、用途、实录原句与效果文字、半开帧区间、叠层区域、人物/字幕等保护区，以及 `fallback: "blocked"`。`paper-editorial`、`generated-video` 内部禁止应用。
3. 运行：

   ```bash
   node skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs <选择合同.json> <项目根>
   ```

4. 渲染完成后复制 `templates/application-receipt.v1.template.json`。每个已选 `apply` 必须在同一成片哈希下回执同 `beatId`、`effectId`、`frames` 和注册组件；未选择任何效果时，空 `applications` 合法。
5. 运行：

   ```bash
   node skills/koubo-shotcraft-library/scripts/validate-application-receipt.mjs <应用回执.json> <项目根>
   ```

6. 用户完整观看候选片后，必须逐个已应用 beat 记录通过或否决。通过案例优先复用，否决案例阻断同语境直接复用；两个不同任务的同类通过才能晋级为可复用规则。

字段定义、错误码与完整约束见 `references/v9-director-selection-and-application.md` 和 `references/v9.1-auto-match-and-learning.md`。`SHOTCRAFT_SELECTED_NOT_APPLIED` 必须阻断，不能用渲染成功、人工口头确认或不同版本组件回执代替。

## 不可越界

### 首次本地样片特例（仅本条）

2026-09-04 用户批准先前《首次样片入口待裁决》的隔离实验方案。入口为 `scripts/run-local-preview.mjs`，只接受 `preflight`、`stills`、`render-ab`，固定使用 `shotcraft-candidate-v1` 中已经确认的实录42.6至73.6秒，输出31秒、960×540同画面音效对照。它不调用生产V2，也不构成生产V2的签名授权。

执行顺序：用户预渲染许可与独立代码审查、输入哈希绑定 → 只读预检 → 风险帧 → 本地样片 → 媒体与声画质检 → 用户正常速度完整观看。授权回执固定在 `edit/shotcraft-integration-20260904/local-preview-authorization.v1.json`。禁止跳过前置审查、覆盖已有输出或把待观看样片登记为验收通过。

该例不推广为任意视频的备用生产入口，不修改共享V8、纸艺路由、信任根、注册表、正式开关或已完成业务片。今后其他素材、时间段或正式接入必须另行授权和审查；本条样片完成也不会自动启用五项动效。

- `paper-editorial`、`generated-video` 插片内部禁止套本库语义动效；只保留其已批准的品牌、字幕、进度等持续层。
- 真实素材保持比例与真实性，框选不能捏造证据或遮盖目标。讲解小窗仍走原有 `PresenterMediaStage`。
- 中文说明必须源于实录，英文字幕从实录中文翻译，不修改口播事实；没有字幕依据的效果文本不得通过。
- 信息层合计覆盖率不超过 42%，不遮挡人物脸、手势和字幕，不能做成连续全屏信息板。
- 不引入原站音频。仅使用项目已有可溯源本地音效，音量和落点逐项登记；原声不删、不移、不拉伸。
- 立体书与数字滚动等未适配项只供参考；网页演示不等于摄影级纸艺，也不能据此替换生成视频路线。

## 来源和维护

上游固定提交见 `upstream-lock.v1.json`，Apache-2.0 全文见 `upstream/LICENSE`。改编归属与改动说明见 `NOTICE.md`。不追随远程主分支自动升级；更新必须另建快照、检查差异并重审样片。

验证：`node --test skills/koubo-shotcraft-library/tests/*.test.mjs`。
