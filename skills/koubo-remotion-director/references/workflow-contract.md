# 口播 Remotion 导演合同

## 目标

让每条口播从素材到正式片形成可复查链路：

```text
素材/转写/EDL
-> 内容与合规边界
-> 当前生产档案校验
-> visual-plan.json
-> 必要时纸构推演自动拆镜/报价/金额授权/生成/逐镜QA
-> production-job.json
-> Remotion 预览/风险帧
-> 正式导出
-> release.json
-> 用户完整观看
-> 发布数据回填
```

## 输入事实

开始前确认：

- `source/` 中的原片或用户指定素材；
- `edit/transcripts/` 中的词级转写；
- 原片实际声音是拍摄后唯一正文，拍摄前文稿只作术语与差异核对；
- 是否已有 EDL，是否全量保留；
- 本条视频主观点、服务对象、行动引导；
- B-roll、截图、参考图和生成素材的授权；
- 是否需要双语字幕；
- 当前唯一生产档案：`workflow/active-production-profile.v1.json`；
- V8默认规范：`knowledge/20-V8连续语义动效与可感知音效基线.md`；
- 历史回滚母版：`workflow/production-baseline.v1.json`；
- 升级待办：`workflow/upgrade-backlog.json`。

## 产物位置

- 视觉方案：`edit/visual-plan_<video-id>_vN.json`
- 字幕数据：`remotion/public/data/<video-id>.*.json`
- 生产清单：`workflow/jobs/<video-id>.production.json`
- 自动插片计划：`edit/<video-id>/generated-video-plan_<video-id>_v1.json`
- 自动插片任务账本、报价与 QA：`edit/generated-video/<plan-id>/`
- 自动插片视频：`remotion/public/media/<video-id>/generated-video/<plan-id>/Gxx.mp4`
- 自动插片风格卡：`workflow/style-library/koubo-paper-construct-v1.json`
- 内部预览和质检报告：`work/production-runs/<video-id>/`
- 正式片：`outputs/<title>_final*.mp4`
- 发布记录：`workflow/releases/<video-id>_vN.json`
- 实录来源策略：`edit/<video-id>/transcripts/<video-id>.spoken-source-policy.v1.json`
- 关键帧证据：`edit/verify/` 或发布记录中声明的路径

## visual-plan 必填逻辑

每层必须能回答：

- 为什么这个时间点需要视觉辅助；
- 这层承担标题、背景、证据还是行动引导；
- 是否和另一层重叠；
- 是否挡脸、挡手、挡字幕；
- 哪一帧需要抽查；
- 是否符合当前V8生产档案；如不符合，是否存在完整的用户明确降级批准。

同一个 `overlapGroup` 最多一个 `titleOwner=true`。

V8 使用 `codex-provider` 时，必须先读取
`references/paper-construct-generated-video.md`。生成计划须与 visual-plan 的
`requestId`、`layerId`、实录原句、起止时间和含 `plan-id` 的本地视频路径一一对应；只允许
`illustration-only` 概念演绎。只有逐镜联系表复核完成、状态达到
`qa-passed` 且通过 `materialized` 门禁后，才把生成计划写入
`job.inputs.generatedVideoPlan` 并进入生产任务。

自动生成属于 `prepare` 之前的显式素材阶段。任何生产诊断、预览、正式渲染、
缓存失效和回归命令都不得顺带提交新的付费任务。

## 用户确认点

不得跳过：

1. 本条是完整保留还是内容剪辑；只有明确要求删除、压缩、重排、重录或处理口误时，才增加粗剪确认；
2. 本条使用 `codex-provider` 时，对当前 `planId`、镜头数、实时逐镜报价和总金额上限的明确付费批准；未批准只能停在报价；
3. 视觉包装方案确认；
4. 同画面有声/无声30—45秒动态预览及关键帧确认；
5. 正式全片人工完整观看确认。

有音效正式候选片生成时同步形成完整发布包；该动作不替代第 5 项完整观看确认。候选阶段可进入 `ready-for-user-review`，用户终验后才进入 `verified`。

如果用户明确授权某一步可由 Codex 先行生成，仍需在 final 中标记“待人工确认”的状态。
