# 文案双 Skill 执行报告

每次生成或实质修改公开口播文案后，必须保存一份 JSON 报告，并在内容门禁卡的 `draft.copy_review.report_path` 中引用。

```json
{
  "schema_version": 1,
  "task_id": "与内容门禁卡一致",
  "status": "passed",
  "reviewed_at": "ISO 8601 时间",
  "draft": {
    "path": "<project-root>/notes/待审口播稿.md",
    "sha256": "当前稿件文件 SHA-256"
  },
  "skills": {
    "humanizer_zh": {
      "path": "<codex-home>/skills/humanizer-zh/SKILL.md",
      "sha256": "当前 Skill 文件 SHA-256",
      "read": true
    },
    "humanize_koubo_script": {
      "path": "<project-root>/skills/humanize-koubo-script/SKILL.md",
      "sha256": "当前 Skill 文件 SHA-256",
      "read": true
    }
  },
  "checks": {
    "humanizer_pattern_scan_completed": true,
    "ai_boundary_review_completed": true,
    "fact_safe_rewrite_completed": true,
    "retention_risk_review_completed": true,
    "read_aloud_completed": true,
    "voice_match_completed": true
  },
  "ai_boundary_review": {
    "self_explanation_removed": true,
    "defensive_boundary_embedded": true,
    "generic_transitions_replaced": true,
    "abstract_claims_grounded": true,
    "source_insertions_contextualized": true,
    "mechanical_completeness_reduced": true,
    "notes": "说明本稿如何把 AI 味改成人在现场判断、取舍和说话"
  },
  "retention_review": {
    "risk_node_count": 0,
    "nodes": [],
    "no_high_risk_reason": "没有高风险节点时必填；有节点时可为空"
  },
  "fact_changes": {
    "new_facts": [],
    "removed_facts": [],
    "wording_strength_changes": [],
    "pending_user_confirmations": []
  },
  "scores": {
    "directness": 0,
    "spoken_naturalness": 0,
    "rhythm": 0,
    "personal_voice": 0,
    "fact_fidelity": 10
  }
}
```

存在风险节点时，`nodes` 中每项使用：

```json
{
  "original": "原句或位置",
  "risk_level": "high | medium | low",
  "reason": "具体的预测风险原因",
  "candidates": {
    "conservative": "保守版",
    "direct": "直接版",
    "vivid": "生动版"
  },
  "fact_difference": "三个候选与事实锁相比有无变化",
  "recommendation": "推荐版本及理由"
}
```

固定规则：

- `draft.sha256` 必须与门禁当前读取到的稿件完全一致；改一个字都必须重新审稿并生成新报告。
- 两项 Skill 的 `path`、`sha256` 和 `read` 必须与本机当前文件一致。
- 六项 `checks` 必须全部为 `true`。
- `ai_boundary_review` 六个布尔字段必须全部为 `true`，并填写 `notes`；任一项无法通过时，不得把报告状态写为 `passed`，除非 `notes` 明确记录事实锁或用户原话理由。
- `risk_node_count` 只能为 `0` 至 `3`，并与 `nodes` 数量一致。
- `risk_node_count` 为 `0` 时，`no_high_risk_reason` 不能为空。
- `fact_changes` 四个数组必须如实填写，不得用缺失字段冒充“无变化”。
- 五项评分取值为 `0` 至 `10`；`fact_fidelity` 必须等于 `10`。
- 报告只证明规定步骤和文件绑定已完成，不替代用户对自然度、吸引力和本人感的最终判断。
