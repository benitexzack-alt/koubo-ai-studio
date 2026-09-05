# koubo-ai-studio · AI 口播工作室

面向真人口播的内容与视频生产工程。把来源研究、账号反馈、脚本审阅、实录字幕、纸艺分镜、Remotion 包装和发布复盘接在同一套可检查的流程里，让每条内容都能追溯到来源、实际录音、素材和验收记录。

项目来自「超哥AI创业记」的真实制作实践，主要服务甘肃本地小微企业、创业者和希望看懂 AI 应用的普通人。仓库提供工作流、Skill、代码、模板和校验器；新账号需要替换个人事实与账号资料。

## 当前版本：V8 生产基线 + V9 导演试点

更新日期：2026-09-05。生产版本和导演版本分别管理。

| 层级 | 当前状态 | 解决的问题 |
| --- | --- | --- |
| 内容流程 | 来源研究、候选选择、源头精髓、内容门禁、双 Skill 审稿 | 写稿前确认来源、内容增量、事实和本人表达 |
| 正式生产 | V8 活动基线 | 真人主画面、连续语义动效、实录中英字幕、数字运镜、逐视觉音效与发布包 |
| 导演流程 | V9 / 9.0.0，下一条新视频试点 | 三套提示词、安全区、纸艺布局、Shotcraft 应用证据、九阶段状态机 |
| 历史基线 | V7.2 锁定母版 | 历史回归与故障回滚 |

V9 已有代码、模板和校验器，仍须下一条真实素材完成端到端制作、小样观看和用户终验。现阶段不能称为「V9 正式生产已全面验收」。版本依据见 [生产档案](workflow/active-production-profile.v1.json)、[导演档案](workflow/active-director-profile.v1.json) 和 [V9 升级审计](workflow/audits/director-v9-upgrade-20260905.v1.md)。

## 能完成什么

- 研究与选题：绑定知识库阅读记录、已接纳账号数据和最近六条内容；建立机制卡、跨源矩阵及候选题，用户选定题目、钩子和提纲后继续。
- 脚本审阅：完整来源适用时先提炼源头精髓，再核查事实、观点增量、重复与语言；保留事实锁、稿件哈希和审稿报告。
- 实录字幕：拍摄后以真实声音为唯一正文，拍摄前文稿只作核对；英文从确认后的实录中文翻译。
- 视觉导演：分别选择真人、真实证据、AI 情景演绎和摄影级纸艺；纸艺解释机制，真实材料承担证据。
- 纸艺首帧：模型生成无字基础图，本地按实际纸面四角写入中文，经 OCR 和人工检查形成带字首帧交接包。
- 视频包装：人物讲解小窗、局部连续语义动效、声画绑定、响度处理、风险帧与媒体质检；Shotcraft 作为按需启用的辅助信息层。
- 交付复盘：候选成片、当期真人截图、3:4 封面提示词、主标题与两个备选标题、发布文案、话题和发布记录一次整理。

## V9 的制作顺序

```text
文稿确认 → 三套提示词 → 生成交接 → 素材验收 → 实录重绑
→ 低清候选 → 用户确认 → 正式渲染 → 发布包
```

三套提示词分别用于纸艺首帧、RunningHub 图生视频和 AI 情景视频，即使某类镜头为零也保留对应空清单。首帧先试一张代表图；图片、文字、配对和用户验收齐全后，才形成 RunningHub 交接包。

本地生成文件、机器检查通过、用户完整观看、平台发布是不同状态。生产校验器检查阶段顺序和证据绑定；公开视频发布由用户单独决定。完整单条口播默认保留实录，只有明确要求删减、重排或修正口误时才进入内容剪辑。

## 随仓库分发的 9 项 Skill

| Skill | 职责 |
| --- | --- |
| [douyin-koubo-source-to-original](skills/douyin-koubo-source-to-original/SKILL.md) | 来源研究、机制拆解、原创候选与用户选择 |
| [source-essence-synthesis](skills/source-essence-synthesis/SKILL.md) | 完整来源的母命题、认知节点与论证链保真 |
| [content-brain-gate](skills/content-brain-gate/SKILL.md) | 事实、账号数据、内容增量、声音与生产准入 |
| [humanize-koubo-script](skills/humanize-koubo-script/SKILL.md) | 事实安全精修、本人表达与留存风险审稿 |
| [koubo-remotion-director](skills/koubo-remotion-director/SKILL.md) | V9 导演、实录重绑与 V8 生产衔接 |
| [koubo-paper-firstframe-producer](skills/koubo-paper-firstframe-producer/SKILL.md) | 首帧批次、纸面中文、OCR 与交接包 |
| [koubo-asset-prep](skills/koubo-asset-prep/SKILL.md) | 授权素材的抠图、图片或生成视频升清 |
| [koubo-shotcraft-library](skills/koubo-shotcraft-library/SKILL.md) | 动效检索、逐节拍选择与实际应用回执 |
| [koubo-runninghub-video-batch](skills/koubo-runninghub-video-batch/SKILL.md) | RHTV 图片与提示词逐节点配置、参数回读；默认停在生成前 |

`humanizer-zh` 是文案双 Skill 流程所需的独立全局依赖，未随本仓库分发。公开稿审阅前必须准备并读取其当前版本；缺失时不能声称双 Skill 审稿已经完成。RunningHub 批量 Skill 的来源与同步边界见 [快照说明](skills/koubo-runninghub-video-batch/SNAPSHOT.md)。

## 本地接入

当前主要验证环境为 macOS。需要 Git、Node.js、npm、Python 3、FFmpeg / FFprobe；Remotion 依赖版本由 `remotion/package-lock.json` 锁定。纸面中文还需要可用中文字体、Tesseract 及中文识别数据；Apple Vision 复核仅适用于 macOS。

以下命令在仓库根目录执行：

```bash
cd remotion
npm ci
npm run toolchain
cd ..
node tools/setup-koubo.mjs --dry-run
node tools/setup-koubo.mjs
node tools/doctor-koubo.mjs
```

安装器默认注册 8 项项目 Skill。它只创建缺失的链接；同名独立目录或不同来源链接会报告冲突，不覆盖已有安装。可选的 RunningHub 批量 Skill 单独注册：

```bash
node tools/setup-koubo.mjs --skill koubo-runninghub-video-batch --dry-run
node tools/setup-koubo.mjs --skill koubo-runninghub-video-batch
```

按 `.env.example` 建立本机 `.env`，只填写实际需要的环境变量。个人知识库优先由 `KOUBO_PERSONAL_KB` 指定，否则检查项目同级的 `个人知识库`。完整生产需要任务级上下文、授权素材与真实验收记录；克隆仓库只提供代码和模板。

新账号接入请读 [复制与新账号清单](templates/03-复制与新账号接入清单.md)。项目入口为 [AGENTS.md](AGENTS.md)、[项目状态](project.md) 和 [知识索引](knowledge/00-项目知识索引.md)。

## 验证与受控生产入口

```bash
node tools/test-portable.mjs
node tools/validate-active-director-profile.mjs
node --test skills/koubo-remotion-director/tests/*.mjs
node --test skills/koubo-shotcraft-library/tests/*.test.mjs
```

便携回归检查语法、Skill、门禁、安装保护及不含私密媒体的 Remotion 打包；它不替代真实视频的观看验收。历史任务可能引用本机媒体，缺少这些素材时不能复现对应历史成片。

新生产任务必须通过当前导演、实录来源与知识上下文检查，再使用受控入口：

```bash
node tools/run-v72-production.mjs <production-job.json> doctor
node tools/run-v72-production.mjs <production-job.json> prepare
node tools/run-v72-production.mjs <production-job.json> formal
node tools/validate-release.mjs <release.json>
```

`run-v72-production.mjs` 保留历史文件名，实际执行受活动 V8 档案和当前门禁控制。正式渲染要求本条预览与用户确认。不要用 `remotion/package.json` 里的历史样片快捷命令替代新任务生产流程。

## 数据与素材边界

原片、导出成片、代理视频、本地字体、缓存和 `.env` 不作为代码同步内容。仓库中有历史任务描述、字幕数据、素材台账和发布回执，部分 `edit/`、`outputs/` 文件已被历史提交跟踪，不能把这些目录理解为「全部为空」或「全部私密」。添加文件前应检查实际暂存清单。

ElevenLabs 转写会上传提取出的音频；素材增强和 RunningHub 可能上传文件并计费。相关工具按本次授权执行。素材来源、使用许可、AI 演绎标识和用户终验记录需要单独核查。

仓库当前没有授予整体代码再分发的统一开源许可证；Remotion 工程标记为 `UNLICENSED / private`。Shotcraft 上游的 Apache-2.0 许可和归属保留在其目录内，不能推定覆盖整个仓库。

版本变化见 [更新记录](CHANGELOG.md)。
