# 口播 Remotion 导演合同

## 目标

让每条口播从素材到正式片形成可复查链路：

```text
素材/转写/EDL
-> 内容与合规边界
-> visual-plan.json
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
- 是否已有 EDL，是否全量保留；
- 本条视频主观点、服务对象、行动引导；
- B-roll、截图、参考图和生成素材的授权；
- 是否需要双语字幕；
- 当前基线：`workflow/production-baseline.v1.json`；
- 升级待办：`workflow/upgrade-backlog.json`。

## 产物位置

- 视觉方案：`edit/visual-plan_<video-id>_vN.json`
- 字幕数据：`remotion/public/data/<video-id>.*.json`
- 生产清单：`workflow/jobs/<video-id>.production.json`
- 内部预览和质检报告：`work/production-runs/<video-id>/`
- 正式片：`outputs/<title>_final*.mp4`
- 发布记录：`workflow/releases/<video-id>_vN.json`
- 关键帧证据：`edit/verify/` 或发布记录中声明的路径

## visual-plan 必填逻辑

每层必须能回答：

- 为什么这个时间点需要视觉辅助；
- 这层承担标题、背景、证据还是行动引导；
- 是否和另一层重叠；
- 是否挡脸、挡手、挡字幕；
- 哪一帧需要抽查；
- 是否属于 V4 实验或当前生产基线。

同一个 `overlapGroup` 最多一个 `titleOwner=true`。

## 用户确认点

不得跳过：

1. 本条是完整保留还是内容剪辑；只有明确要求删除、压缩、重排、重录或处理口误时，才增加粗剪确认；
2. 视觉包装方案确认；
3. 20-30 秒预览或关键帧预览确认；
4. 正式全片人工完整观看确认。

如果用户明确授权某一步可由 Codex 先行生成，仍需在 final 中标记“待人工确认”的状态。
