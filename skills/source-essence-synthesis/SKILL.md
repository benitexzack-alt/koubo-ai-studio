---
name: source-essence-synthesis
description: 在使用完整访谈、长视频、文章或参考口播做深度改编时，先提取母命题、认知转折、论证链、功能性DNA、事实纠偏和普通人所得，再逐节点校验提纲覆盖，防止把高信息密度源头压缩成一句正确但贫乏的结论。用于用户要求“保留精髓”“完整拆解源头”“结合多个参考形成自己的口播”“原稿正确但启发不够”“不要只浓缩成一个模型”时。
---

# 源头精髓转译

本 Skill 解决的不是一般摘要，而是高信息密度来源到原创口播之间的“认知保真”。目标不是保留所有句子，而是保留那些一旦删除，观众所得就明显下降的认知节点和论证关系。

## 适用边界

使用本 Skill：

- 已取得完整访谈、完整转写、完整文章或用户提供的完整原文；
- 用户明确要求深度拆解、保留主要观点和知识点；
- 需要把源头观点、二次创作者拆解和本人经验合成一条原创口播；
- 旧稿事实基本正确，但用户认为“精髓没抓到”“看完没有原片启发大”。

不要使用本 Skill：

- 只有标题、封面、简介或零散片段；
- 单纯改写用户已经确认的完整原创稿；
- 只需回答一个窄问题，且用户明确选择 `single-claim`；
- 用它代替事实核验、内容门禁、声音精修或发布合规检查。

## 核心原则

1. 摘要长度不是目标，观众认知变化才是目标。
2. 区分“形式”和“功能”：不复制原句、比喻和案例，但必须说明它们在论证中承担什么作用。
3. 先建立母命题和认知转折，再决定删什么；不能先套三段式，再把放不进去的观点删除。
4. 事实纠偏不能顺手删除洞察。错误表达应被准确替换，而不是连同它解释的问题一起消失。
5. “普通人怎么办”至少包含三层：看懂一个机制、获得一个判断标准、能执行一个动作。
6. 覆盖不靠百分比自报。每个 `must-preserve` 节点都必须在提纲中映射到真实存在的短句。

## 两阶段工作流

### 第一阶段：精髓提炼

1. 确认来源为 `complete` 或 `primary-source`，记录真实文件路径和核验范围。
2. 填写读者简报：观众是谁、原有误解是什么、看完应改变什么、必须带走什么。
3. 写一个母命题。母命题负责统领，不负责吞掉其他观点。
4. 提取认知节点。`deep-explainer` 至少 6 个节点，其中至少 5 个为 `must-preserve`。
5. 每个节点填写：源头主张、源头定位、结构功能、观众所得、情绪功能、事实状态和准确替代表达。
6. 用 `argument_chain` 记录节点之间的“为什么、但是、所以、例子、边界”，让全部必须节点形成一条连通论证链。
7. 填写纠偏账本。任何 `partial` 或 `interpretation` 节点必须有对应的 `replace` 或 `qualify` 记录。
8. 填写普通人三层所得：解释、判断、行动，并绑定支撑节点。
9. 运行校验；只有 `ready-for-outline` 才能进入提纲。

### 第二阶段：提纲覆盖

1. 先写能承载全部必须节点的长提纲，不预设三分钟或单一模型。
2. 为每个 `must-preserve` 节点填写一条 `draft_ref`，它必须是提纲中真实存在的连续短句。
3. 标记 `function_preserved`。换案例、换比喻可以，节点的论证功能不能丢。
4. 再次运行校验。缺失一个必须节点、映射短句不存在、论证链断裂，状态都必须是 `blocked`。
5. 只有 `ready-for-draft` 才能把结果交给 `content-brain-gate` 继续做选题增量、账号阶段、声音和公开内容门禁。

## 数据卡和命令

按 [source-essence-card-schema.md](references/source-essence-card-schema.md) 创建 JSON。

```bash
python3 <project-root>/skills/source-essence-synthesis/scripts/validate_source_essence.py /绝对路径/源头精髓卡.json
```

保存机器报告：

```bash
python3 <project-root>/skills/source-essence-synthesis/scripts/validate_source_essence.py /绝对路径/源头精髓卡.json --report /绝对路径/源头精髓报告.json
```

退出码为 0 才通过当前阶段。机器报告会给出必须节点总数、真实映射数和缺失节点，不接受人工填写的覆盖率替代。

## 与其他 Skill 的顺序

```text
完整素材取得
-> source-essence-synthesis
-> content-brain-gate
-> humanizer-zh + humanize-koubo-script
-> 用户本人朗读确认
-> ready-for-production 后的视觉与成片流程
```

- `ingest-douyin-knowledge` 负责取得和标记素材完整度；
- 本 Skill 负责源头认知保真；
- `content-brain-gate` 负责这条内容是否值得公开写、是否与最近作品重复；
- `humanize-koubo-script` 负责事实锁定后的本人声音和口语表达；
- 后期 Skill 不能补回上游已经删除的认知节点。

## 回归测试

```bash
cd <project-root>/skills/source-essence-synthesis
python3 scripts/test_source_essence.py
python3 scripts/validate_source_essence.py fixtures/ai007-v1-fail.json
python3 scripts/validate_source_essence.py fixtures/ai007-outline-pass.json
```

AI007 v1 必须因为多个必保节点没有真实提纲映射而失败；合格提纲必须返回 `ready-for-draft`。如果旧失败样本意外通过，停止生成新稿并先修复校验器。

## 输出格式

```text
源头精髓状态：blocked / ready-for-outline / ready-for-draft
母命题：
必须保留节点：
已覆盖节点：
缺失节点：
纠偏但保留的洞察：
普通人三层所得：
允许进入的下一阶段：
```
