# 口播 Remotion 导演合同

## 目标

让每条口播从素材到正式片形成可复查链路：

```text
素材/转写/EDL
-> 内容与合规边界
-> 当前生产档案校验
-> visual-plan.json
-> 必要时新建纸艺导演 plan-only request；旧纸构推演不得生成，旧 request/plan/QA 不得复用
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
- 旧自动插片计划、账本、视频和风格卡：只作失败回归证据，不得建立新任务
- 摄影级纸艺导演合同：`skills/koubo-remotion-director/templates/director-request.v1.json`
- 纸艺导演计划与候选证据：`work/director-paper-editorial/<revision-id>/`
- 逐帧质量基线：`knowledge/23-参考片逐帧审计与纸媒叙事装配最低标准.md`
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

V8 使用 `codex-provider` 前，风格必须明确标记 `productionEligible=true`，并绑定用户已经通过的动态样片证据。`koubo-paper-construct-v1`、`paper-construct-video` 和 `/user-generated-paper/` 永久命中退役门；`纸媒叙事装配 v2` 当前为 `blocked-candidate`，只能做创意方向、分镜、预览、完成态静帧和一条受控压力测试，不能写入正式 `job.inputs.generatedVideoPlan`。

摄影级纸艺导演是与旧自动插片链隔离的新编译分支。它从真实实录和权威时间轴建立新的 `director-request`，默认 `plan-only`、`productionEligible=false`，输出只能包含 `validate-plan`。已验收的 30 秒 WithSfx 样片只作为风格方向锚；新口播必须重新实例化 request、plan、静帧和 QA，不能把旧候选复制为新任务完成证据。

纸艺导演候选通过后，只能作为 V8 `real-evidence` 或 `generated-video` 插片素材进入新的生产 revision；人物主画面、连续语义卡、字幕、数字运镜和正式发布包仍由 V8 分支负责。V8 的 director-contract/preflight v2、同画面 A/B 和用户完整观看门不得被纸艺导演结果替代。

未来新合同仍须把 `requestId`、`layerId`、实录原句、起止时间、完成态静帧路径与 SHA-256、H3 实际图像输入字段、任务回执、本地视频和逐镜 QA 一一绑定；用途只能是 `illustration-only`。用户通过动态样片后，才允许重新设计并启用新的生成计划 schema。

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
