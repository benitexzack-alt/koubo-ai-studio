# 纸构推演自动插片合同

## 定位

`纸构推演 v1` 是 V8 的生成素材子阶段，不是 V9，也不改变“真人口播与真实证据优先”的生产档案。

```text
实录原句与 V8 visual-plan
→ 识别抽象机制的认知卡点
→ 选择 0—N 个必要插片
→ 自动拆成单一物理因果镜头
→ 编译完整纸构提示词
→ RunningHub / MiniMax-H3 / 2K 报价
→ 用户确认本计划金额
→ 单镜一次提交、轮询、下载
→ 五点联系表与逐镜视觉复核
→ qa-passed
→ materialized 证据链校验
→ V8 prepare / formal
```

没有抽象机制需要解释时，镜头数可以为 0，此时不创建生成视频计划，直接使用人物主画面、真实证据或 Remotion 信息层。禁止为了“更像大片”机械插入生成画面。

## 适用边界

只在下列情形选择 `codex-provider`：

- 口播解释抽象流程、因果链、关系变化或不可直接拍摄的机制；
- 一段话存在明确认知卡点，单靠字幕或静态信息层不易理解；
- 画面只承担 `illustration-only` 概念演绎，不作为事实或来源证据。

以下内容不得进入自动纸构插片：

- 真人、客户、真实业务现场、真实地点或人的手；
- 产品界面、录屏、截图、官方文件、账号数据和来源证据；
- 需要证明“真实发生过”的行为、效果或结果；
- 品牌、随机文字、无法核验的数字和营销承诺。

需要人物、真实行动、场景、空间或氛围的叙事视频仍走授权真实素材或用户素材执行单。自动生成失败时只能回退 `speaker-plus-information`，不得自动更换风格、生成真人或把演绎画面冒充证据。

## 自动拆镜算法

### 1. 先做素材分类

逐句标记：

- `speaker`：本人观点、情绪、转场和行动引导；
- `real-evidence`：界面、截图、数据、原文件和真实现场；
- `remotion-information`：名称、层级、列表、短关系和确定性排版；
- `generated-video`：只能用于抽象机制的概念演绎。

先删除不必要的生成候选。真实素材能说明的，不生成；局部信息层能讲清的，不生成。

### 2. 找认知卡点，不按句数平均切

把相邻且描述同一机制的原句合并为一个候选段。每段必须能写出：

```text
初始状态 → 一个肉眼可见的施力原因 → 一个稳定结果
```

写不出这条链，或需要两个以上动作才能讲清时，继续拆分、改用信息层或放弃生成。镜头数量由语义决定，不固定为五镜。

### 3. 每镜只允许一个动作

每个 `shots[]` 必须明确：

- 与 V8 图层一一对应的 `requestId` 和 `layerId`；
- 实录原句及准确起止时间；
- 单一主物件、初始状态、可见施力源、接触点、一个动词和结果状态；
- 物体身份锁、形状锁、接触连续性锁；
- `front-miniature | top-down` 构图；
- `fixed | slow-push` 镜头；
- 5—15 秒时长，0—0.8 秒建立场景，结尾至少 0.8 秒稳定停留；
- 底部至少 18% 字幕安全区，标签保持空白，由 Remotion 后期加准确中文。

同一镜头禁止同时出现“抽出后展开”“移动后变形”“推入后爆炸”等复合动作。施力物必须可见并持续接触，不能让物体无原因自行移动。

### 4. 套用完整风格锁

唯一风格卡：

```text
workflow/style-library/koubo-paper-construct-v1.json
```

每镜都调用 `compileShotPrompt` 独立编译完整提示词，禁止“同上”“沿用上一镜”等省略写法。固定风格包括：可见纸纤维、自然撕边、纸板层厚、接触阴影；暖纸色 70%、海军蓝 20%、砖红 10%；正面微缩或俯拍；轻微定格步进感；禁止真人、手、随机文字、品牌、水印、液化、光滑通用 3D、像素风和 8-bit。

## 机器合同与命令

当前提供商字段以 RunningHub 官方 API 文档与 MiniMax-H3 接口页为核验依据：

- `https://www.runninghub.cn/call-api/api-detail/2133100000000504201`
- `https://www.runninghub.cn/runninghub-api-doc-cn/api-454850620`（价格预估）
- `https://www.runninghub.cn/runninghub-api-doc-cn/api-425767306`（任务查询）

接口或价格属于动态外部状态；每次正式生成前仍以当次实时报价为准，不把本文档中的历史观察当成当前价格。

从以下模板建立本条结构化计划：

```text
templates/08-generated-video-plan-template.json
```

路径不允许自由改写：计划固定放在
`edit/<videoId>/generated-video-plan_<videoId>_v1.json`；账本、报价、全局联系表和全局 QA
固定放在 `edit/generated-video/<planId>/`；首次付费时，消费回执固定放在
`edit/generated-video/approval-receipts/<sha256(approvalId)>.json`，计划只回写该回执的路径和 SHA-256。逐镜视频固定放在
`remotion/public/media/<videoId>/generated-video/<planId>/Gxx.mp4`。这些路径必须
互不相同，不得覆盖计划、风格卡或 visual-plan，也不得经过符号链接；`planId` 进入
视频路径，防止同一口播的不同计划互相覆盖。

先编译提示词并做完全离线预检：

```bash
node tools/run-runninghub-generated-video.mjs compile --plan <generated-video-plan.json>
node tools/run-runninghub-generated-video.mjs preflight --plan <generated-video-plan.json>
node tools/validate-generated-video-plan.mjs <generated-video-plan.json> --phase plan
```

只有计划门通过后才联网报价。报价不创建任务账本、不提交付费任务：

`RUNNINGHUB_API_KEY` 只从本机环境读取，不写进计划、命令历史或仓库。环境已配置后运行：

```bash
node tools/run-runninghub-generated-video.mjs quote --plan <generated-video-plan.json>
```

向用户报告：模型、2K、16:9、镜头数、逐镜金额和预计总额。用户必须对当前 `planId` 明确确认金额上限，然后写入：

- `costAuthorization.status=approved`
- 非空 `approvalId`
- `approvedBy`、`approvedAt`、不超过 24 小时且提交时未过期的 `expiresAt`
- `scope.type=plan-only`、当前 `planId`，以及离线预检返回的
  `definitionSha256`；拆镜、提示词、visual-plan 路径或输出定义变化后原授权立即失效
- `maxPerShotCny`、`maxAmountCny`、`currency=CNY`
- `maxAttemptsPerShot=1`、`automaticRetry=false`
- `productionStatus=ready-for-submit`

提交前先全量报价；此后每个镜头真正提交前，都刷新所有剩余镜头的报价。只有“已确认
实际费用 + 剩余镜头最新报价”仍不超过总上限，且本镜最新报价不超过单镜上限，才按
顺序逐镜提交：

```bash
node tools/run-runninghub-generated-video.mjs run \
  --plan <generated-video-plan.json> \
  --confirm-paid
```

任一镜头已有任务记录时禁止再次提交。轮询或下载中断只恢复同一 `taskId`：

```bash
node tools/run-runninghub-generated-video.mjs resume \
  --plan <generated-video-plan.json> \
  --shot G01
```

首次付费提交还会在固定目录写入一次性 `approvalId` 消费回执，并把回执路径和哈希
写回计划作为可校验的物化证据。回执存在但任务账本缺失时禁止重新提交；同一批准号
不得改绑另一份计划或金额。每镜下载后立即核对本镜实际费用与累计实际费用，即使是
单镜或最后一镜，只要超过授权就记录 `cost-limit-breached` 并停止正常完成；如果平台
未返回有限、非负的实际费用，则记录 `billing-reconciliation-required`，保留已下载文件，
但停止后续付费提交。预估金额永远不写成“实际扣费”。

同一计划和账本只允许一个 `approvalId`，不得在已有付费镜头后原地替换批准号。若后续
最新报价越过原授权，`cost-reauthorization-required` 表示进入人工裁决：保留既有素材和
账本，建立新的 plan 版本重新拆镜、报价和授权；当前自动流程不得把新旧授权混在一个
账本中，也不得自动续费。

若进程恰好在视频落盘后、账本更新前中断，`resume` 会重新取得同一任务结果并比较
文件哈希：相同则完成对账，不同则隔离远端副本并要求人工裁决，绝不覆盖既有文件。
恢复前还必须核验逐镜任务与当前计划哈希、完整提示词、固定输出路径、授权和 `taskId`
一致；账本中的可变路径不能覆盖当前计划的固定路径。

`doctor`、`prepare`、视觉方案校验、缓存失效和 QA 命令都不得隐式调用 `run`。没有用户对当前计划的费用授权时，导演流程必须停在报价结果。

## 下载后 QA

先生成 0%、25%、50%、75%、100% 五个时间点的逐镜联系表、全局联系表和 ffprobe 记录：

```bash
node tools/qa-generated-video-plan.mjs prepare --plan <generated-video-plan.json>
```

逐镜查看联系表，按真实画面填写 `outputs.qaReportPath`：

- 纸纤维、撕边、纸板层厚和接触阴影是否可见；
- 是否只有一个主动作；
- 主物体身份、数量、颜色和形状是否稳定；
- 施力与受力是否持续接触；
- 底部字幕安全区是否无关键物体；
- 是否没有真人、手、随机文字、品牌、水印、液化和多余零件。

所有项真实通过后，记录复核人、复核类型、模型与版本（模型复核时）、时间，以及每项
观察结论，再执行：

```bash
node tools/qa-generated-video-plan.mjs apply-review \
  --plan <generated-video-plan.json> \
  --review <qa-report.json>

node tools/validate-generated-video-plan.mjs \
  <generated-video-plan.json> \
  --phase materialized
```

逐镜视觉复核可以由 Codex 对实际联系表完成，但不得表述成用户验收；用户仍须在 V8 正式候选片阶段完整观看确认。

QA 报告会同时绑定生成定义 SHA、visual-plan SHA、风格卡 SHA、逐镜视频 SHA 和联系表
SHA。任何口播锚点、因果链、提示词、视觉方案、视频或联系表被改动，旧 QA 都会失效。

## 接入 V8

V8 自动插片图层固定使用：

```json
{
  "purpose": "concept-illustration",
  "asset": {
    "sourceType": "provider-generated-video",
    "source": "remotion/public/media/<video-id>/generated-video/<plan-id>/G01.mp4"
  },
  "assetDecision": {
    "class": "generated-video",
    "producer": "codex-provider",
    "requestId": "G01",
    "evidenceUse": "illustration-only",
    "styleReferenceId": "koubo-paper-construct-v1",
    "fallback": "speaker-plus-information"
  },
  "params": {
    "src": "media/<video-id>/generated-video/<plan-id>/G01.mp4",
    "disclosure": "AI生成·概念演绎",
    "badge": "非真实业务证据"
  }
}
```

生产任务必须增加 `inputs.generatedVideoPlan`，并把下列内容全部加入 `inputs.fingerprintPaths`：生成计划、风格卡、金额授权消费回执、账本、全部视频、逐镜和全局联系表、逐镜和全局 QA 报告。只有计划达到 `qa-passed` 且通过 `materialized` 门禁，才允许执行 V8 `prepare`。
