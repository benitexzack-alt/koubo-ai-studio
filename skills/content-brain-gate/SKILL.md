---
name: content-brain-gate
description: 在任何公开内容进入选题、写稿或制作前，强制检查来源完整度、最近六条主张查重、唯一内容增量、核心对象机制解释、本人声音、抖音精选质量目标和制作顺序，并输出 blocked、ready-for-outline、ready-for-draft 或 ready-for-production 状态。用于口播、抖音短视频、公众号、图文、直播提纲、热点解读、参考视频改编、内容事故复盘，以及用户说“先找问题再写”“不要重复以前内容”“检查有没有读取知识库/MD/Skill”“这篇能不能拍”“先验证流程”时。
---

# 内容大脑硬门禁

先证明这条内容值得写、资料够写、与过去不同、核心机制讲得清，再生成文稿。不要用更强表达、钩子或后期包装掩盖上游问题。

## 必读顺序

1. 从当前工作目录向上查找同时包含 `AGENTS.md`、`knowledge/` 和 `skills/content-brain-gate/` 的目录，记为 `<project-root>`。
2. 读取 `<project-root>/AGENTS.md`、项目内容规范和启动脚本列出的必读文档。
3. 定位个人知识库：优先使用 `KOUBO_PERSONAL_KB`，否则检查 `<project-root>/../个人知识库`。如果存在，必须读取其 `AGENTS.md` 和 `00_规范与配置/12_公开内容生产大脑硬门禁.md`，并以个人知识库现行版为优先规则。
4. 如果个人知识库不存在，读取项目内便携规则 [references/public-content-gate.md](references/public-content-gate.md)。
5. 读取 `<project-root>/knowledge/15-抖音精选内容质量验收.md`。
6. 读取最近六条已发布、已拍摄或已确认内容。
7. 读取当前账号声音档案。
8. 读取本轮来源完整度报告、完整原文/转写和证据表。

读取必须有实际路径或来源记录。不能用“应该读过”“知识库里有”代替。

## 何时停止

以下任一情况出现，状态先设为 `blocked`，不得直接写稿：

- 参考素材只有 `metadata-only`，任务却要求拆观点、原意、Talking 链路或爆款机制；
- 最近六条没有读够，或新主张与旧母题的差异说不清；
- 先选了一堆产品，再反向拼与普通人的关系；
- 核心产品只能说参数和结论，讲不清问题、瓶颈和工作原理；
- 声音档案不存在或没有读取；
- 文稿尚未通过，却已经开始 V6、动效、音效、封面或成片。

`blocked` 是正确结果，不是任务失败。先补资料、删素材、换主张或缩小范围。

## 工作流

### 1. 建立内容门禁卡

按照 [数据格式](references/content-gate-schema.md) 新建 JSON。必须逐项填写真实状态，不为了通过而补写不存在的来源、差异或机制。

目标阶段：

- `outline`：验证是否值得进入提纲；
- `draft`：验证是否可以写第一版完整文稿；
- `production`：验证文稿是否可以进入拍摄和后期。

### 2. 标记来源用途

每条来源分别写：完整度、取得方式、核验状态和本轮用途。

固定规则：

- `metadata-only` 只能使用 `title-clue` 或 `source-index`；
- `partial` 只能使用 `partial-context`，结论必须限定在已取得片段；
- `viewpoint`、`talking-structure` 需要完整转写或完整用户原文；
- `draft-evidence` 还需要一手来源或相称的独立核验。

不要把来源卡创建成功当成内容取得成功。

### 3. 做最近六条主张级查重

每条最近内容填写：受众问题、唯一主张、证据、交付物和行动引导。

新选题必须写清：

- 新问题；
- 新信息；
- 新证据；
- 新交付物；
- 删掉热点名和产品名后，为什么仍然是新内容。

标题不同不算新。项目冻结母题只能做背景，不能再次成为结论。

### 4. 先定问题，再选材料

填写第一性原理选题卡：服务谁、改变什么状态、唯一新主张、证据只证明什么、不能证明什么、观众拿走什么、什么不适用、哪些材料删除。

顺序固定：

```text
观众问题 → 新主张 → 必要机制 → 必要证据 → 删除多余展品 → 表达
```

禁止按“算力、模型、应用”或“第一、第二、第三、第四”凑齐展品盘点。

### 5. 填核心对象机制卡

每个承担核心论证的产品、案例、政策或技术都要回答：

- 真实问题；
- 原有瓶颈；
- 关键工作方法；
- 可观察变化；
- 一手或高质量证据；
- 证据证明和不能证明什么；
- 与目标观众的直接关系；
- 最容易讲错的边界。

只报参数、价格、发布日期或“更强更快”不算通过。

### 5.5 检查观众距离和账号阶段

高层技术、院士观点和大公司产品只有在账号具备相称一手经验时才能成为主角。否则必须降为证据或背景，并填写 `audience_fit`：当前账号阶段、讲述者真实位置、前20秒普通人场景、至少两个可感知场景、观众所得和权威边界。

内容很正确但需要依赖科学家、架构师或成熟方法导师身份才能成立时，状态仍是 `blocked`。不能把“能讲明白”当成“当前账号适合讲”。

### 5.6 建立抖音精选质量目标

使用 `schema_version: 2`，按照项目 `knowledge/15-抖音精选内容质量验收.md` 填写 `douyin_quality`：

- 获得感和表达力必须为 `primary`；
- 惊喜感、感染力按真实素材填写 `primary`、`supporting` 或 `not-targeted`；
- 每项都要写正文证据和观众验收方式；
- 必须明确 `selection_not_guaranteed: true`；
- `production` 阶段必须由用户人工复核，`review_status` 才能写为 `human-reviewed`。

这一步只证明质量目标已经落到具体证据，不证明平台会标记精选、给流量或产生商业结果。事实、来源、合规和用户确认不通过时，质量卡不能反向放行。

### 6. 运行机器校验

如果稿件 Markdown 同时包含口播正文、事实锁和审计附录，在 `draft` 中同时填写 `content_start_marker` 与 `content_end_marker`，避免把“已删除旧句式”的说明误判为正文。标记必须真实存在；不填写时默认扫描整份稿件。

```bash
python3 <project-root>/skills/content-brain-gate/scripts/validate_content_gate.py /绝对路径/内容门禁卡.json
```

需要保存报告时：

```bash
python3 <project-root>/skills/content-brain-gate/scripts/validate_content_gate.py /绝对路径/内容门禁卡.json --report /绝对路径/门禁报告.json
```

退出码为 0 才表示目标阶段通过。退出码非 0 时，按报告中的 `errors` 修复，不绕过校验器。

### 7. 分阶段推进

- `ready-for-outline`：只写提纲，不写拍摄终稿；
- `ready-for-draft`：可以写文稿，但仍不能做 V6、音效和成片；
- 写稿后建立事实锁，逐项标出四项质量特征的正文证据，运行 `humanize-koubo-script`，做大声朗读、本人声音、最近六条和合规复核；
- 用户确认脚本且 `production` 校验通过，才升级为 `ready-for-production`。

## 与其他 Skill 的关系

- 抖音链接先由 `ingest-douyin-knowledge` 标记真实完整度；
- 事实、数据和技术机制用一手来源或深度研究能力补齐；
- 声音档案缺失时用 `brand-voice` 从真实样本建立；
- 本 Skill 决定能不能写、能不能制作；
- `humanize-koubo-script` 只在事实与结构锁定后精修表达；
- 口播导演、Remotion、动效和音效能力只在 `ready-for-production` 后使用。

调用过某个 Skill 不等于通过，最终看门禁卡和校验报告。

## 回归测试

Skill 内置两个样本：

```bash
cd <project-root>/skills/content-brain-gate
python3 scripts/validate_content_gate.py fixtures/waic-old-fail.json
python3 scripts/validate_content_gate.py fixtures/waic-new-pass.json
python3 scripts/test_content_gate.py
```

第一个必须失败，第二个必须返回 `ready-for-draft`。如果旧失败样本意外通过，立即停止新稿生成并修复校验器。

## 输出格式

向用户先给结论，再给证据：

```text
内容状态：blocked / ready-for-outline / ready-for-draft / ready-for-production
已通过：
未通过：
当前主要矛盾：
最小下一步：
允许进入的下一阶段：
```

不得在 `blocked` 时附送一篇“先凑合看看”的完整稿。
