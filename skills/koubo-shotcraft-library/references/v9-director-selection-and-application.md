# V9.1 Shotcraft 导演选择与实际应用合同

本合同只负责 Shotcraft 的逐 beat 选择和实际消费证明，不修改生产路由、活动档案、纸艺导演核心、Presenter 或共享 V8，也不授予本条以外的生产权限。

## 选择合同

由 `templates/auto-match-request.v1.template.json` 建立本条自动匹配请求，并保持 `paper-editorial-director-v9@9.1.0` 身份一致。选择合同应由匹配器自动生成；手工编写只用于 fixture 和故障定位，不得冒充自动匹配证据。

- 本合同的 V9.1 eligible 主画面固定为 `speaker`、`real-evidence`；注册表的 `contexts` 进一步限制每个效果能用在哪一类画面。
- `beats` 必须列出本条完整主画面清单，并保持同一时间轴的唯一 `beatId` 与半开帧区间；不能通过漏列 beat 规避选择。
- 每个 eligible beat 必须显式写 `decision: "apply"` 或 `decision: "not-needed"`。
- `apply` 必须绑定已注册的 `effectId`、具体 `purpose`、实录 `quote` 和 `texts`、帧窗、画面 `region`、全部 `protectedRegions`，并固定 `fallback: "blocked"`。
- `quote` 和每项 `texts` 必须出现在该帧窗重叠的 `actual-recording` 中文字幕中。
- `not-needed` 必须写能解释该 beat 画面目标的具体理由；“不需要”“不适用”“本段无需效果”等占位理由不通过。
- `paper-editorial` 与 `generated-video` 内部不得选择 Shotcraft。
- 非 `apply` beat 不得残留效果、区域或证据等应用字段。
- 允许所有 eligible beat 都选择 `not-needed`。合同禁止设置最低应用数、效果数或类似全片机械配额。
- 选择合同中的 `sourceCard`、`matchContext`和 `componentProps` 必须与当前注册表、匹配语境和组件要求一致。
- 匹配回执必须证明全部 157 张卡都已分析，并分开记录可渲染选择与尚需适配的候选。

校验命令：

```bash
node skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs \
  <仓库内选择合同.json> \
  .
```

成功状态为 `director-selection-valid`。任何错误均以退出码 `1` 阻断。

## 应用回执

复制 `templates/application-receipt.v1.template.json`，绑定已通过的选择合同与实际成片文件。

- 选择合同中的每个 `apply` 必须有且只有一个对应应用项。
- 应用项必须与选择合同具有完全相同的 `beatId`、`effectId` 和半开帧区间 `[startFrame, endFrameExclusive)`。
- `component.name` 必须等于注册效果的组件名；组件路径必须等于注册表的 `componentModule`，并绑定该文件当前 SHA-256。
- 每项应用必须绑定同一个实际成片 SHA-256，并声明 `finalWorking: true`。
- 计划中没有任何 `apply` 时，`applications: []` 合法；反向出现未选择的应用会阻断。
- 任一已选择项缺失或字段失配，统一包含错误 `SHOTCRAFT_SELECTED_NOT_APPLIED:<beatId>`，不能以渲染成功或人工描述替代。

校验命令：

```bash
node skills/koubo-shotcraft-library/scripts/validate-application-receipt.mjs \
  <仓库内应用回执.json> \
  .
```

成功状态为 `application-receipt-valid`。校验器会重新核对选择合同、字幕、注册表、组件和成片文件哈希；它只读这些文件，不生成或修改视频。
