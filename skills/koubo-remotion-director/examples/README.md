# `director-contract/v2` 使用边界

本目录只说明如何填写合同，不提供可冒充真实项目的“已通过”样例。可复制骨架位于：

```text
../templates/director-contract-v2.template.json
```

## 校验命令

```bash
node skills/koubo-remotion-director/scripts/validate-director-contract-v2.mjs \
  /absolute/path/to/director-contract.v2.json \
  --root /absolute/path/to/evidence-root \
  --json
```

退出码固定：

- `0`：合同、绑定文件、内容 SHA-256、ffprobe 和机器门禁通过；不等于风格已被用户接受。
- `1`：合同被门禁阻断；JSON 输出中的每个 `errors[].code` 都是稳定错误码。
- `2`：参数、JSON 读取或语法错误。

`--no-file-check` 只允许回归测试和结构开发。它不会检查真实文件、SHA-256 或 ffprobe，不能作为真实端到端回执。

## 状态机

```text
candidate-blocked
  ↓ 参考压力测试样片 + 技术 QA + 正常速度完整观看 + A/B SHA + 人工回执
user-accepted-style
  ↓ 稳定哈希交接回执绑定合同快照、样片、QA、人工回执和 A/B
automation-handoff-eligible
```

- `low-fidelity-prototype` 永远不能晋级。
- `user-accepted-style` 仍保持 `productionEligible=false`。
- 只有交接回执通过内容校验后，`automation-handoff-eligible` 才允许 `productionEligible=true`。
- 风格晋级不会打开 `formal`。正式任务仍必须单独授权，合同中的 `formal.enabled` 始终为 `false`。

## 证据边界

- `evidenceScope=fixture-only` 只能证明 validator 回归，不证明真实端到端、用户观看或风格接受。
- `evidenceScope=real-e2e` 仍必须绑定真实媒体、完整逐字时间轴、完整录屏、技术 QA 和人工回执。
- 录屏使用率只在 `report.screenRecordings[].usageRatio` 中报告，不以“高”或“低”直接判断质量；质量来自逐段 used/excluded 理由与口播语义映射。
- 字幕、纯运镜、人物空讲、Logo 和装饰不计有效语义画面覆盖。
- 参考片缺授权时只能内部研究机制，禁止复制品牌、照片、具体版式、具体镜头或原素材。

## 9:16 → 16:9

默认使用：

```json
{"fit":"contain","crop":"none","scale":1}
```

如果必须 `cover`，合同必须同时绑定：源尺寸、focus、safe-area、objectPosition、裁切理由、关键文字/按钮/二维码清单，以及首/中/尾实际渲染风险帧和逐项未裁切回执。

## 生成插片

`producer=user` 和 `producer=provider` 走同一证据门：真实媒体文件及内容 SHA、口播 segment/word IDs、认知障碍证据、认知增量、进入/退出点、四类优先素材不可替代证明、授权来源和授权回执。`provider` 还必须绑定批准静帧、批准回执、请求回执和请求所用静帧 SHA。
