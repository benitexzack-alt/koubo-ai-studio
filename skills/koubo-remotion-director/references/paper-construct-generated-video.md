# 纸构推演 v1 退役记录

> 状态：`retired-quality-failure`
> 生效日期：2026-08-24
> 生产资格：无
> 原文档退役前 SHA-256：`b4b751ea8eb6c73f24087b48d24433c6d881edac46c12899de822d8ac9a6d690`

## 不得执行

以下指纹已经退役：

- `koubo-paper-construct-v1`
- `paper-construct-video`
- `/user-generated-paper/`
- `templates/08-generated-video-plan-template.json` 中的旧 v1 入口

不得创建新的 v1 拆镜计划，不得执行旧版 `compile / preflight / quote / run`，不得通过 `producer=user`、本地文件改名、删除 `generatedVideoPlan` 或直接调用 QA 工具绕过退役门。

旧计划、提示词、视频、视觉方案、任务文件和 Remotion 组件只作为失败回归证据保留。安全恢复只用于已经绑定的历史付费任务结算或下载，不产生生产资格；当前工作区没有发现需要恢复的 provider ledger。

## 退役原因

逐帧参考片审计和 MiniMax 官方 Skill 对照证明，旧 v1 把正确流程写反：

- 参考片使用 5—7 个物件组、至少三层空间和 4—7 级顺序装配；旧版强制单物件居中和单一动作；
- 参考片按内容切换顶视、正视、低机位、分屏、证据网和谱系构图；旧版连续固定俯拍或正视；
- 官方纸拼贴先确认制作方案和完成态静帧，再把静帧真实传给 H3；旧版只有文本 prompt；
- 官方色板跟随已批准静帧；旧版锁死暖纸 70%、海军蓝 20%、砖红 10%；
- 官方规划纸片滑入、弹入、压平、摩擦等触感拟音；旧版没有声音合同；
- 旧版 QA 只检查技术存在和内部规则，没有检查与参考片、批准静帧是否在同一质量维度；
- 当前正式任务还能通过 `producer=user + user-generated-paper` 绕过 provider 质量门。

完整证据和新候选标准见：

- `knowledge/23-参考片逐帧审计与纸媒叙事装配最低标准.md`
- `workflow/style-library/koubo-paper-editorial-assembly-v2.candidate.json`

## 可以保留的通用能力

退役的是错误风格和错误生产路径，不是以下通用能力：

- RunningHub 的报价、费用上限、任务绑定、CAS、防重复付费、轮询、下载隔离和恢复；
- MiniMax-H3 / 2K 路由；
- Remotion 通用媒体舞台；
- `generated-video`、`producer=user` 和 `codex-provider` 的其他合规用途；
- 输入指纹、TOCTOU、AI 披露和 `illustration-only` 证据边界。

## 替代候选的阶段门

`纸媒叙事装配 v2` 当前是 `blocked-candidate`，只能按以下顺序推进：

```text
实录语义拆解
→ 3—5 个创意方向
→ 用户选择方向和时长
→ Brief、视觉节奏轨和分镜确认
→ 1—3 张视觉预览
→ 每镜完成态静帧
→ 用户确认静帧并记录 SHA-256
→ 适配层证明静帧真实进入 H3 请求
→ 一条 4—5 秒动态压力测试
→ 与参考片及批准静帧并排验收
→ 用户明确通过
→ 才能建立新的批量生成合同、报价和费用授权
```

当前 `buildH3RequestDefinition` 只有 `prompt / resolution / duration / ratio / aigc_watermark`，没有图像字段。在这个接口缺口修复并真实验证前，任何文档、提示词或生成成功都不能把候选提升为可用 Skill。
