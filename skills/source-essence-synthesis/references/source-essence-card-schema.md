# 源头精髓卡数据契约 v1

## 顶层字段

```json
{
  "schema_version": 1,
  "task_id": "task:example",
  "target_stage": "extraction",
  "mode": "deep-explainer",
  "source": {},
  "reader_brief": {},
  "mother_thesis": {},
  "insight_nodes": [],
  "argument_chain": [],
  "correction_ledger": [],
  "ordinary_person_gains": {},
  "adaptation": {}
}
```

- `target_stage`：`extraction` 或 `outline`。
- `mode`：`deep-explainer` 或 `single-claim`。
- `deep-explainer` 至少 6 个认知节点，其中至少 5 个为 `must-preserve`。
- `single-claim` 至少 2 个认知节点，其中至少 1 个为 `must-preserve`。

## 来源

```json
{
  "title": "来源标题",
  "path": "/真实路径/完整转写.md",
  "completeness": "complete",
  "verification_scope": "哪些内容已核验，哪些仍只是受访者观点"
}
```

`completeness` 只有 `complete` 或 `primary-source` 可以通过。只有片段时应停止深度改编，不能通过补写卡片伪造完整度。

## 读者简报与母命题

```json
{
  "reader_brief": {
    "audience": "目标观众",
    "existing_belief": "观众当前的误解或空白",
    "desired_change": "看完以后判断或行动发生什么变化",
    "leave_with": ["必须带走的认知1", "必须带走的认知2"]
  },
  "mother_thesis": {
    "statement": "统领全部节点的一句话",
    "scope_boundary": "这句话不能被扩大为什么",
    "supporting_node_ids": ["I01", "I02"]
  }
}
```

## 认知节点

```json
{
  "id": "I01",
  "label": "短标签",
  "source_ref": "时间码、行号或来源章节",
  "source_claim": "来源真正表达的主张",
  "structural_function": "mechanism",
  "viewer_gain": "观众因此多懂了什么",
  "emotional_function": "它制造或缓解了什么感受",
  "importance": "must-preserve",
  "verification": {
    "status": "source-backed",
    "evidence_ids": ["evidence:example"],
    "accurate_replacement": ""
  }
}
```

- `structural_function`：`hook`、`tension`、`mechanism`、`evidence`、`example`、`transition`、`implication`、`action`、`boundary`。
- `importance`：`must-preserve`、`supporting`、`optional`。
- `verification.status`：`source-backed`、`verified`、`partial`、`interpretation`。
- `partial` 和 `interpretation` 必须填写 `accurate_replacement`，并进入纠偏账本。

## 论证链

```json
{
  "from": "I01",
  "to": "I02",
  "relation": "why",
  "bridge": "I02为什么能解释I01"
}
```

`relation` 可用 `why`、`therefore`、`but`、`example`、`limit`、`enables`。全部 `must-preserve` 节点必须在同一张连通图中，不能只是彼此无关的知识点清单。

## 纠偏账本

```json
{
  "node_id": "I03",
  "source_expression": "需要纠偏的二次表达",
  "issue": "为什么不准确",
  "action": "qualify",
  "accurate_replacement": "准确且仍保留洞察的表达",
  "insight_preserved": true
}
```

`action` 可用 `replace`、`qualify`、`remove`。如果节点是 `must-preserve`，不得用 `remove` 把整个洞察删除。

## 普通人三层所得

`explanation`、`judgment`、`action` 都要包含非空 `statement` 和有效 `node_ids`：

```json
{
  "explanation": {"statement": "看懂什么机制", "node_ids": ["I02"]},
  "judgment": {"statement": "获得什么判断标准", "node_ids": ["I04"]},
  "action": {"statement": "今天可以做什么", "node_ids": ["I09"]}
}
```

## 提纲映射

`target_stage: outline` 时必须填写：

```json
{
  "adaptation": {
    "path": "/真实路径/提纲.md",
    "content_start_marker": "<!-- CONTENT_START -->",
    "content_end_marker": "<!-- CONTENT_END -->",
    "mappings": [
      {
        "node_id": "I01",
        "draft_ref": "提纲中真实存在的一段连续短句",
        "function_preserved": true
      }
    ]
  }
}
```

每个 `must-preserve` 节点必须恰好映射一次。校验器会读取真实提纲正文并查找 `draft_ref`，不会相信人工填写的覆盖率。
