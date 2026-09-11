# V9.1 导演 + V8 生产候选入口阻断报告

> 任务：`20260910-lanzhou-industry-ai-v91-v8-r1`
> 检查日期：2026-09-11
> 当前结论：候选素材与 V8 计划可准备，但统一生产入口仍被真实信任链锁定；本轮不伪造签名，不裸渲染。

## 已验证的准备状态

- `visual-plan.v1.json` 使用 schema v4，共 27 个主视觉事件，包含 6 条纸艺视频的 V9.1 实录术语时点绑定。
- `sfx-cues.v1.json` 使用 schema v3，27/27 个主视觉事件都绑定已审核 V8 音效；同文件 25 秒内不重复。
- `node tools/validate-visual-plan.mjs .../visual-plan.v1.json` 通过：27 个图层，27 个风险抽帧。
- `node tools/validate-v8-production-contract.mjs workflow/jobs/20260910_lanzhou_industry_ai_v91_v8_r1.production.json` 通过：27 个视觉事件，10 类音效，正式渲染保持锁定。
- 候选阶段导演绑定校验通过：`candidate-entry-director-bound`，绑定 6 个纸艺镜头，实录声音为正文权威。
- production job 的 `experiment.status` 是 `candidate-preview-required`，`formal.enabled=false`，`userPreviewApproved=false`。

## 真实阻断

1. 统一 V2 生产入口要求当前修订绑定真实 `directorContract`、`handoffReceipt` 和独立 `freezeReceipt`，或者走首次候选的独立签名合同。当前这些回执不存在，因此 job 只保留空值，没有填写虚假 SHA-256。
2. 真实执行统一入口的预演结果：

   ```text
   生产入口冻结门禁失败：[DPG2_BOUND_JSON_REFERENCE_INVALID]
   导演合同必须绑定项目内路径和小写 SHA-256。
   ```

3. 当前任务的个人知识库上下文文件不存在：

   ```text
   [KCPG2_CONTEXT_MISSING]
   任务上下文不存在：task-20260910T105427Z-a149c6de/context.json
   ```

4. 当前同窗双语字幕是从本地 ASR 生成的候选，状态仍是 `needs-user-audio-review`、`formalAllowed=false`。它可以用于本地低清候选预览，不能冒充已完成人工听校的正式字幕。

## 解锁条件

1. 以最终 Remotion 代码、独立 `publicDir`、字幕、V8 计划、六条视频和 Shotcraft 应用回执重建当前修订全闭包。
2. 建立有真实外部消息锚的导演合同/交接/冻结回执，或首次候选授权链；不得由执行组自造。
3. 重建 `task-20260910T105427Z-a149c6de` 的 context，将当前 production job 以当前 SHA-256 写入 `task_original_materials`，留下 `retrieved/read/applied=true` 及应用说明，再运行 `validate-context`。
4. 只在上述两道门通过后，使用统一入口生成同画面 WithSfx/NoSfx 45 秒候选；用户验收候选和字幕听校前，正式开关继续为 `false`。
