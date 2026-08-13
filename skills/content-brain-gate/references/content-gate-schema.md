# 内容门禁卡数据格式

## 顶层字段

```json
{
  "schema_version": 6,
  "task_id": "唯一任务标识",
  "target_stage": "outline | draft | production",
  "required_rules": [],
  "sources": [],
  "topic_authorization": {},
  "recent_six": [],
  "candidate_generation": {},
  "topic": {},
  "frozen_topic_hits": [],
  "audience_fit": {},
  "performance_feedback": {},
  "douyin_quality": {},
  "mechanism_cards": [],
  "voice": {},
  "draft": {}
}
```

`schema_version: 6` 从 2026-08-13 起用于所有重新进入选题、写稿或制作的内容。v6 在 v5 的账号实测学习卡硬门基础上，新增“全部已接纳官方快照 + 全部已发布作品 + 最近六条”的自动预检回执。历史 v1 至 v5 卡只保留审计和发布复盘价值，不得重新获得选题、改稿或制作权限。

## required_rules

每项记录实际读取的规则，不是计划读取：

```json
{
  "path": "<project-root>/knowledge/规则.md",
  "read": true
}
```

至少包含：全局公开内容硬门禁、项目内容规范。文件必须真实存在。

路径可以使用绝对路径，也可以使用 `<project-root>/...`、`<personal-kb>/...`、`<skill-root>/...` 和 `<codex-home>/...`。校验器会从门禁卡位置及当前工作目录向上定位项目根目录；个人知识库优先由 `KOUBO_PERSONAL_KB` 指定，否则检查项目同级的 `../个人知识库`；项目根目录也可用 `KOUBO_PROJECT_ROOT` 显式指定。

## sources

```json
{
  "id": "source-1",
  "title": "来源标题",
  "completeness": "metadata-only | partial | complete | primary-source",
  "acquisition": "public-page | user-pasted | local-asr | official-page | local-file",
  "intended_uses": ["title-clue"],
  "content_path": "可选，完整转写或原文的绝对路径",
  "verification_status": "待核验 | 部分核验 | 已核验 | 不适用",
  "canonical_ref": "作为成稿证据时必填的稳定来源引用",
  "evidence_ids": ["evidence:来源域:稳定证据标识"]
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
- `draft-evidence` 还必须提供稳定的 `canonical_ref` 和至少一个 `evidence_id`；改写标题或摘要不能产生新的证据 ID。

## topic_authorization

进入 `draft` 或 `production` 前必填。候选生成、历史召回和模型建议都不能替代用户明确选题。

```json
{
  "status": "user-selected",
  "selected_by": "user",
  "selection_mode": "explicit-topic-request | explicit-candidate-choice | user-confirmed-assistant-candidate",
  "selected_topic": "必须与 topic.novel_claim 完全一致",
  "user_instruction": "可审计的用户原始指令",
  "source_ref": "conversation:任务或会话:消息标识",
  "confirmed_at": "ISO 8601 时间",
  "candidate_only": false
}
```

本字段提供可追踪审计门，不是密码学证明。执行环境若不能读取原始消息，只能将其标记为外部可信输入；不得由模型根据“继续”“好的”等模糊指令补写选题授权。

## recent_six

至少六条：

```json
{
  "title": "最近内容标题",
  "date": "2026-07-15",
  "audience_problem": "服务的具体问题",
  "main_claim": "唯一主张",
  "claim_id": "claim:范围:稳定主张标识",
  "evidence": "核心证据",
  "evidence_ids": ["evidence:来源域:稳定证据标识"],
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
  "claim_id": "claim:范围:稳定主张标识",
  "primary_evidence_ids": ["evidence:来源域:稳定证据标识"],
  "difference_from_recent": "与最近六条相比的新问题、新信息、新证据和新交付物",
  "evidence_proves": "当前证据只证明什么",
  "evidence_does_not_prove": "当前证据不能证明什么",
  "audience_takeaway": "观众可带走的判断、工具或动作",
  "boundary": "不适用和最容易误用之处",
  "delete_candidates": ["不服务主张、应删除的材料"]
}
```

`claim_id` 与最近六条重复时直接阻断。`primary_evidence_ids` 必须已在 `sources` 登记；与最近六条重复时默认阻断。确有更新、反例或背景复用需要时，必须增加 `evidence_reuse_authorization`，记录用户批准来源、复用理由和本次新增贡献，不能仅靠换标题或改写 `difference_from_recent` 放行。

## candidate_generation

仅当本轮使用 25 格、曼陀罗、关键词组合或其他组合式方法生成候选题时填写；未使用时可省略。该对象只记录候选生成和后续验证，不得把组合动作本身写成“已验证”。

```json
{
  "used": true,
  "method": "25-grid",
  "selected_candidate": "本轮唯一进入验证的候选题",
  "combination_basis": [
    "行业相关内容",
    "目标人群",
    "具体场景"
  ],
  "generation_is_not_validation": true,
  "validation_checks": {
    "audience_problem_confirmed": true,
    "recent_six_increment_confirmed": true,
    "evidence_or_personal_fact_confirmed": true,
    "account_stage_fit_confirmed": true,
    "deliverable_confirmed": true
  },
  "rejected_or_deferred": [
    "未通过验证、暂不进入提纲的候选题"
  ]
}
```

固定规则：

- 对象存在时 `used` 和 `generation_is_not_validation` 必须为 `true`；
- `selected_candidate` 只能有一个明确候选题；
- `combination_basis` 至少包含三个非空要素；
- 五项 `validation_checks` 必须全部为 `true`，并继续接受 `topic`、`recent_six`、来源和账号阶段门禁的独立校验；
- 该对象通过只表示“候选生成方法没有被误当成验证”，不表示整张内容门禁卡通过；
- 单条高互动、同行采用或 AI 能生成文稿不能填写为验证依据。

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

## performance_feedback

每次进入选题、提纲、写稿或制作前都必须绑定当前账号实测学习卡。真实账号任务使用个人知识库中的当前卡；Skill 的 `fixtures/account-learning-card.json` 只用于回归测试，不得替代真实账号数据。

在填写其余字段前，自动运行：

```bash
node <project-root>/tools/prepare-account-performance-preflight.mjs --task-id <任务ID>
```

任务明确依赖“现在/最新账号表现”时增加 `--requires-current`。默认允许使用明确标记为过期的最后一次成功全量历史做比较，但禁止表述为实时状态。工具生成任务级不可变证据快照和回执；自动层只汇总描述性事实，因果规律仍须人工确认后进入学习卡。

```json
{
  "account_data_preflight": {
    "receipt_path": "<project-root>/workflow/account-performance-preflights/<任务ID>.json",
    "receipt_sha256": "64位小写SHA-256",
    "read": true
  },
  "account_data_application": {
    "account_baseline_evidence": {
      "metric": "weightedMetrics.fiveSecondCompletionRate",
      "value": 31.8711,
      "use": "把全账号五秒完播基线作为本条开头调整的观察参照"
    },
    "recent_work_evidence": {
      "video_key": "回执最近六条中的真实 videoKey",
      "metric": "metrics.fiveSecondCompletionRate",
      "value": 27.34,
      "use": "对照这条最近作品，把标题答案和真实场景提前"
    },
    "planned_change": "本条前十二秒先交付标题答案和一个可感知场景，再进入背景和机制解释。",
    "causal_claim": "human-confirmed-lesson-only"
  },
  "learning_card_path": "<personal-kb>/01_项目实战/抖音知识中台/工作区/2026-08-09-超哥AI创业记账号数据复盘/当前账号实测学习卡.json",
  "learning_card_sha256": "64位小写SHA-256",
  "snapshot_at": "2026-08-10T22:52:59+08:00",
  "read": true,
  "newer_content_acknowledged": true,
  "newer_content_ids": ["2026-08-11-training-camp-episode-1"],
  "newer_content_metric_status": "新作品尚无完整观察窗口，只用于内容锚点去重，不升级为稳定表现规律。",
  "applied_lesson_ids": [
    "lesson:opening:title-answer-before-background",
    "lesson:hook:concrete-conflict-scene-object"
  ],
  "opening_plan": {
    "answer_or_conflict_by_second": 4,
    "proof_or_real_scene_by_second": 12,
    "audience_relevance_by_second": 20,
    "first_viewer_value_by_second": 28,
    "title_answer_by_second": 12,
    "delayed_payoff_risk_checked": true
  },
  "duration_plan": {
    "planned_seconds": 210,
    "single_core_problem": "本条只解决的一个具体问题",
    "justification": "用本条必要证据、机制、场景和交付物解释为什么需要这个时长，至少30字",
    "evidence_based_justification": true
  },
  "metric_plan": {
    "primary_metric": "five_second_completion_rate",
    "secondary_metrics": [
      "average_watch_seconds",
      "profile_visits"
    ],
    "observation_windows": [
      "early-within-3h",
      "24h",
      "72h",
      "7d"
    ],
    "hypothesis": "本条改变了什么内容变量，预计影响哪个指标，什么结果会推翻这个判断，至少30字",
    "early_vs_mature_windows_acknowledged": true
  }
}
```

如果 `workflow/recent-content-history.v1.json` 中存在晚于学习卡 `snapshot_at` 的已拍摄、已确认或已发布内容，必须显式填写 `newer_content_acknowledged`、全部 `newer_content_ids` 和 `newer_content_metric_status`。新作品还没有完整观察窗口时，只能用于内容和表达去重，不能当作新的稳定表现规律。

固定规则：

- `account_data_preflight` 回执必须与当前 `task_id` 一致，回执、账号数据证据快照和学习卡哈希必须真实匹配；
- 回执必须覆盖全部已接纳快照、全部已发布作品和最近六条；缺一项即 `blocked`；
- `account_data_application` 至少绑定回执中一项全账号基线、一条最近作品数值和本条具体改动；数值必须与不可变快照一致；
- `causal_claim` 只能为 `none` 或 `human-confirmed-lesson-only`，禁止把单条作品数据直接升级为因果规律；
- 过期历史只能作为历史比较，任务要求当前数据时必须是 `ready-current`；
- 每次重新选题、改稿或重新制作生成新回执，不用用户重复下指令；
- `learning_card_sha256` 必须与当前文件完全一致；学习卡更新后旧门禁卡自动失效；
- `snapshot_at` 必须与学习卡一致，学习卡状态必须为 `current`；
- `applied_lesson_ids` 至少一项，且必须来自学习卡中状态为 `active` 的学习；
- `opening_plan` 五个时间点不得超过学习卡当前上限；
- 时长没有固定秒数，但必须只解决一个核心问题，并以证据和交付物解释；
- 主指标和辅助指标必须来自学习卡指标合同，观察窗口必须全部覆盖；
- 早期信号不能冒充成熟结果，一条作品不能自动升级为稳定规律。

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
  "read_aloud_evidence": {
    "mode": "user-read | human-listen",
    "status": "confirmed",
    "evidence_ref": "conversation:本人朗读确认或真人听读记录"
  },
  "voice_match_passed": true,
  "recent_six_recheck_passed": true,
  "performance_feedback_recheck_passed": true,
  "compliance_passed": true,
  "user_script_approved": true,
  "user_language_approval": {
    "status": "approved",
    "approved_by": "user",
    "approval_ref": "conversation:用户确认当前稿件语言",
    "approved_at": "ISO 8601 时间"
  },
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
- 模式扫描、AI 味边界审查、事实安全精修、留存风险审稿、朗读和本人声音六项执行状态；
- `ai_boundary_review` 中自我说明、防御性边界、万能转场、抽象判断、资料插入和机械完整六项处理结果；
- 留存风险节点数量；
- 事实差异四类数组；
- 五项评分及事实保真 `10/10`。

只写“已完成初检”或手填 `humanize_passed: true` 不再构成执行证据。稿件或任一 Skill 改动后，旧报告立即失效。

`read_aloud_evidence` 与 `user_language_approval` 是制作阶段的独立人工证据，不能由
`copy_review` 的自报布尔值代替。电脑 TTS 只允许用于估算时长和发现明显断句，不能写成
`user-read` 或 `human-listen`，也不能据此把状态升级为 `ready-for-production`。只有用户明确
确认当前稿件语言，并留下可追溯的确认记录后，才允许进入制作。

当同一个 Markdown 同时包含正文、事实锁、复盘或已删除内容时，应同时填写 `content_start_marker` 和 `content_end_marker`。校验器只扫描两个标记之间真正会被拍摄的正文；只填一个标记、标记不存在或顺序错误时会失败。未填写时保持全文件扫描。

校验器会扫描以下高风险旧句式：先别买系统、重复小事、跑一周/七天、标准化再复制、兰州 AI 创业身份结尾。命中后没有具体豁免理由，不能进入制作。
