# 内容门禁卡数据格式

## 顶层字段

```json
{
  "schema_version": 3,
  "task_id": "唯一任务标识",
  "target_stage": "outline | draft | production",
  "required_rules": [],
  "sources": [],
  "recent_six": [],
  "topic": {},
  "frozen_topic_hits": [],
  "audience_fit": {},
  "douyin_quality": {},
  "mechanism_cards": [],
  "voice": {},
  "draft": {}
}
```

`schema_version: 3` 从 2026-07-24 起用于所有新内容。历史卡只保留审计价值，重新进入写稿或制作时必须升级；不得自动继承抖音精选质量验收或文案双 Skill 执行状态。

## required_rules

每项记录实际读取的规则，不是计划读取：

```json
{
  "path": "<project-root>/knowledge/规则.md",
  "read": true
}
```

至少包含：全局公开内容硬门禁、项目内容规范。文件必须真实存在。

路径可以使用绝对路径，也可以使用 `<project-root>/...`、`<skill-root>/...` 和 `<codex-home>/...`。校验器会从门禁卡位置及当前工作目录向上定位项目根目录；也可用 `KOUBO_PROJECT_ROOT` 显式指定。

## sources

```json
{
  "id": "source-1",
  "title": "来源标题",
  "completeness": "metadata-only | partial | complete | primary-source",
  "acquisition": "public-page | user-pasted | local-asr | official-page | local-file",
  "intended_uses": ["title-clue"],
  "content_path": "可选，完整转写或原文的绝对路径",
  "verification_status": "待核验 | 部分核验 | 已核验 | 不适用"
}
```

用途取值：

- `title-clue`：标题线索；
- `source-index`：作者和链接索引；
- `partial-context`：只引用已取得片段；
- `viewpoint`：提炼作者观点；
- `talking-structure`：拆解完整 Talking 链路；
- `draft-evidence`：进入公开文稿证据链。

限制：

- `metadata-only` 只能使用 `title-clue`、`source-index`；
- `partial` 只能使用 `title-clue`、`source-index`、`partial-context`；
- `viewpoint` 和 `talking-structure` 需要 `complete` 且有非空 `content_path`；
- `draft-evidence` 需要 `complete` 或 `primary-source`、有非空 `content_path`，且核验状态不是“待核验”。

## recent_six

至少六条：

```json
{
  "title": "最近内容标题",
  "date": "2026-07-15",
  "audience_problem": "服务的具体问题",
  "main_claim": "唯一主张",
  "evidence": "核心证据",
  "deliverable": "观众带走什么",
  "cta": "唯一行动引导"
}
```

## topic

```json
{
  "audience": "明确受众",
  "problem": "当前具体问题",
  "desired_change": "看完后的可观察变化",
  "novel_claim": "本条唯一新主张",
  "difference_from_recent": "与最近六条相比的新问题、新信息、新证据和新交付物",
  "evidence_proves": "当前证据只证明什么",
  "evidence_does_not_prove": "当前证据不能证明什么",
  "audience_takeaway": "观众可带走的判断、工具或动作",
  "boundary": "不适用和最容易误用之处",
  "delete_candidates": ["不服务主张、应删除的材料"]
}
```

## brief_contract

当任一来源的 `intended_uses` 包含 `talking-structure` 时，本对象必填。它锁定用户原始任务，防止事实纠偏、参考资料或质量包装擅自改写主题。

```json
{
  "user_goal": "用户真正要讲什么",
  "reference_role": "参考内容在本稿中只承担什么作用",
  "reference_forbidden_role": "参考内容明确不承担什么作用",
  "required_arc": ["至少三段用户要求的故事线"],
  "forbidden_reframes": ["至少两个禁止擅自改写的其他主题"],
  "alignment_evidence": "成稿哪些段落逐项兑现了用户要求",
  "status": "locked"
}
```

固定规则：

- `status` 必须为 `locked`；
- 事实纠偏和风险边界默认只作护栏，不能自动升级为主题；
- 精选质量目标只能验收既定主题，不能反向发明新主题；
- 缺失、占位或故事线不足时，状态必须为 `blocked`。

## frozen_topic_hits

```json
{
  "topic": "命中的冻结母题",
  "usage": "background | main-claim",
  "new_evidence": "有则填写",
  "new_counterexample": "有则填写",
  "conclusion_change": "有则填写"
}
```

`main-claim` 至少必须提供新证据、反例或结论变化之一，否则失败。

## audience_fit

```json
{
  "account_stage": "调查 | 试验 | 结果 | 方法 | 复制",
  "speaker_position": "本题中的真实身份，例如本地AI实践者和复杂信息翻译者",
  "first_20s_connection": "前20秒观众在哪个具体工作或生活场景认出自己",
  "high_level_material_role": "evidence | background | none",
  "ordinary_scenes": ["至少两个普通人可感知场景"],
  "audience_gain": "看完得到的认同、判断或行动",
  "authority_boundary": "哪些结论需要专家或真实结果，本账号当前不能替代",
  "requires_expert_authority": false
}
```

高层技术、院士观点和大公司产品不得填写为主角。当前稿件必须不依赖讲述者并不具备的专家身份，并至少有两个普通人可感知场景。

## douyin_quality

四项特征来自抖音精选优质内容质量方向，但不是算法公式或入选保证。机器只校验目标、正文证据和验收方式是否完整。

```json
{
  "source_scope": "quality-guidance-not-selection-guarantee",
  "gain": {
    "target": "primary",
    "script_evidence": "正文中提供新信息、机制、经验或可带走动作的段落",
    "viewer_test": "目标观众看完后能复述或完成什么"
  },
  "surprise": {
    "target": "supporting",
    "script_evidence": "有证据的新角度、新反差或新表达",
    "viewer_test": "删掉夸张词后，新意是否仍成立"
  },
  "expression": {
    "target": "primary",
    "script_evidence": "唯一主张、具体场景和清晰结构",
    "viewer_test": "陌生观众能否用一句话准确复述"
  },
  "resonance": {
    "target": "supporting",
    "script_evidence": "真实经历、冲突、选择或感受的来源",
    "viewer_test": "共鸣是否来自真实处境，而不是煽情"
  },
  "integrity_boundary": "不得通过虚构、夸张、隐去边界或包装局部功能制造惊喜和感染力",
  "review_status": "planned",
  "selection_not_guaranteed": true
}
```

固定规则：

- `target` 只能是 `primary`、`supporting` 或 `not-targeted`；
- 获得感 `gain` 和表达力 `expression` 必须为 `primary`；
- 每项都必须填写 `script_evidence` 和 `viewer_test`，`not-targeted` 也要说明不采用原因和验收边界；
- `review_status` 只能是 `planned`、`self-reviewed` 或 `human-reviewed`；
- `production` 阶段必须为 `human-reviewed`；
- `selection_not_guaranteed` 必须为 `true`。

## mechanism_cards

`draft` 和 `production` 阶段至少一张，每张必填：

```json
{
  "name": "核心对象",
  "problem": "解决的真实问题",
  "bottleneck": "原有瓶颈",
  "mechanism": "关键工作方法",
  "observable_change": "能观察到的变化",
  "evidence": "一手或高质量证据",
  "evidence_proves": "证据准确证明什么",
  "evidence_does_not_prove": "证据不能证明什么",
  "audience_relevance": "与目标观众的直接关系",
  "boundary": "最容易讲错或误用的边界"
}
```

## voice

```json
{
  "profile_path": "<project-root>/knowledge/声音档案.md",
  "read": true
}
```

## draft

实际文稿一旦写入 `draft.path`，`draft.copy_review` 就必须存在；`production` 阶段还必须填写其余人工确认字段：

```json
{
  "path": "<project-root>/notes/待拍文稿.md",
  "content_start_marker": "可选：正文开始标题",
  "content_end_marker": "可选：正文结束标题",
  "copy_review": {
    "required": true,
    "report_path": "<project-root>/notes/待拍文稿.copy-review.json"
  },
  "fact_lock_passed": true,
  "humanize_passed": true,
  "read_aloud_passed": true,
  "voice_match_passed": true,
  "recent_six_recheck_passed": true,
  "compliance_passed": true,
  "user_script_approved": true,
  "phrase_exemptions": [
    {
      "pattern_id": "run-seven-days",
      "reason": "必须说明为什么本条虽命中旧句式仍有新证据"
    }
  ]
}
```

`copy_review.report_path` 指向 `humanize-koubo-script` 生成的机器报告，格式见 `<project-root>/skills/humanize-koubo-script/references/copy-review-report-schema.md`。校验器会真实检查：

- 当前稿件 SHA-256；
- `humanizer-zh` 与 `humanize-koubo-script` 的规定路径和当前 SHA-256；
- 模式扫描、事实安全精修、留存风险审稿、朗读和本人声音五项执行状态；
- 留存风险节点数量；
- 事实差异四类数组；
- 五项评分及事实保真 `10/10`。

只写“已完成初检”或手填 `humanize_passed: true` 不再构成执行证据。稿件或任一 Skill 改动后，旧报告立即失效。

当同一个 Markdown 同时包含正文、事实锁、复盘或已删除内容时，应同时填写 `content_start_marker` 和 `content_end_marker`。校验器只扫描两个标记之间真正会被拍摄的正文；只填一个标记、标记不存在或顺序错误时会失败。未填写时保持全文件扫描。

校验器会扫描以下高风险旧句式：先别买系统、重复小事、跑一周/七天、标准化再复制、兰州 AI 创业身份结尾。命中后没有具体豁免理由，不能进入制作。
