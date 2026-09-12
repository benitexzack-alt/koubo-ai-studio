# 导演系统 R10 根治试点合同

> 状态：旁路候选，禁止登记为正式生产基线
>
> 任务：`task-20260912T060855Z-7d30cd1b`
>
> 首要成果：用一份由实录证据编译出的语义运行时间轴，同时驱动字幕、视觉动作与音效，并让“动画整段迟到”成为自动失败。

## 1. 已验证的问题

- 兰州产业 AI 的实录双语字幕把 B07 分成 `66.0–69.0`、`69.0–71.0`、`71.0–74.8`、`74.8–79.5`、`79.5–82.7`、`82.7–85.9` 六个真实片段。
- 现行 post-shoot 计划却把 B07 的四个纸艺节点统一重绑到 `85.6–85.9` 秒，并把 `firstReadableFrame` 全部写为 0。
- 现行 V8 再对所有组件统一预卷 6 帧，不能恢复已经丢失的片段级语义证据，也不能补齐纸艺内部四段动作的逐动作音效。
- 现行预览只有 `0–45` 秒；声明式 `previewCoverage` 即使填满，也没有覆盖 P02–P06、B21 和 CTA。

结论：根因是“多个手写时间轴 + 语义证据降精度 + 自报预览覆盖”，不是单条视频的统一偏移量不足。

## 2. R10 唯一运行时间轴

R10 不允许 Remotion、字幕和音效各自维护绝对秒数。唯一编译链为：

```text
实录分段/词级锚点
+ post-shoot 语义绑定
+ 组件注册表与纸艺动作合同
        ↓ 纯函数编译
semantic-runtime-timeline.r10.json
        ├─ Remotion 画面
        ├─ 字幕页
        ├─ 动作音效
        ├─ 实算预览区间
        └─ 风险帧
```

源计划只表达“相对哪个实录锚点、偏移多少帧”。编译产物才可以含绝对帧。事件中若手填 `startSeconds`、`endSeconds`、`enterAt` 或 `previewCoverage`，必须直接失败。

每个事件至少绑定：

- 稳定 `eventId`、`beatId`、实录 `captionIds`；
- 组件种类、渲染参数、证据精度；
- `spokenStartFrame`、`spokenEndFrame`；
- `firstVisibleFrame`、`firstReadableFrame`、`semanticSettleFrame`、`actionEndFrame`、`endFrameExclusive`；
- 从上述锚点派生的逐动作 `sfxFrame`；
- 输入图、组件注册表、编译产物与覆盖报告的 SHA-256。

固定时序约束：

```text
firstVisible <= firstReadable <= semanticSettle <= actionEnd < endExclusive
firstReadable >= claimFrame - 300ms
```

装饰可以先出现，但可读语义相对本事件的核心表达锚点不得提前超过 300ms。`300ms` 与音效偏移上限是硬上限，不得由单条任务放宽。任何全局预卷不得替代逐事件锚点。

## 3. 预览必须实算

预览覆盖只能由真实事件区间求产生，不能由作者填写标签，也不允许单条事件自行退出预览。候选预览必须实际包含：

- 开头钩子与 CTA；
- 每一种本条实际使用的 V8 组件；
- 每一条全屏真实素材或纸艺素材；
- 每一种本条实际使用的音效角色；
- 每个关键事件从 `firstVisibleFrame` 到 `actionEndFrame` 的完整窗口；
- 有音效与无音效的同画面对照。

只覆盖 `0–45` 秒而漏掉后段事件，必须失败。

## 4. 固定回归样本

失败复现：

- 成片：`outputs/留在兰州做企业AI_V9.1_V8_有音效_完整候选_r2.mp4`
- 窗口：`40.000–97.900` 秒
- P02：`77.600–85.600` 秒
- P02 四段动作：`78.200–79.300`、`79.600–80.700`、`81.000–82.300`、`82.700–84.100` 秒

已验收金样：

- 成片：`outputs/AI产品与个人IP_16x9_V8_R1_有音效_正式候选成片_v1.mp4`
- 窗口：`20.160–75.420` 秒
- 只作节奏、结构变化、音效可感知与字幕连续性的比较基准，不复制其内容或硬编码其秒数。

## 5. 试点通过与停止条件

机器门：

1. 相同输入必须产生字节级一致的时间轴和 SHA；任一上游或组件注册表变化必须使旧回执失效。
2. 四类锚点顺序、300ms 语义提前上限、逐动作音效同步和实际预览覆盖全部通过。
3. 每个事件抽取 `firstVisible-1 / firstVisible / semanticSettle / actionEnd / actionEnd+1` 风险帧并检测目标区域变化。
4. 每个实际组件以正常速度渲染完整微片，检查解码、PTS、冻结、重复帧、动作完成与稳定状态。

人工门：

- 用户以正常速度完整观看兰州失败窗口的 R10 有声/无声对照；
- 用户确认动画不迟到、组件结构有变化、纸艺每个动作有可感知反馈、字幕不冲突；
- 字幕听校未完成前，本候选不能晋级正式。

若 R10 仍依赖逐条手改绝对秒数，或机器通过但正常观看仍明显迟到，立即停止晋级，不修改 V8 正式基线，回到语义锚点/组件生命周期模型重做。

## 6. 隔离边界

试点阶段禁止修改：

- `workflow/active-director-profile.v1.json` 与 `workflow/active-production-profile.v1.json`；
- 现行 skill lock、freeze registry、V8/V9.1 production job 与 release；
- `tools/run-v72-production.mjs`、V2 preflight、现行 V8 validator；
- `remotion/src/Root.tsx`、`remotion/src/components/V8SemanticStage.tsx`；
- 当前兰州 R1/R2 composition、outputs 与历史回执。

只有固定回归样本通过机器门和人工门后，才另立变更把 R10 原子晋级进正式导演 Skill、锁文件和生产入口。
