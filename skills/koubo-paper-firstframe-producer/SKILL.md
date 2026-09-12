---
name: koubo-paper-firstframe-producer
description: 执行口播纸艺导演输出的首帧生图清单：先生成无字纸艺基础图并检查材质与构图，再按实际纸面四角确定性写入准确中文、执行OCR和带字成片检查，最后生成唯一 RunningHub 手工交接包。用户粘贴多条纸艺首帧提示词、提供 first-frame-prompts.v1.json，或要求批量生图并放入指定口播项目文件夹时使用。
---

# 口播纸艺首帧执行导演

把导演的纸艺分镜变成可供 RunningHub 手动图生视频使用的**准确带字完成态首帧**。模型先生成无字纸艺基础图，本地工具再把导演锁定的中文写到真实纸面上；RunningHub 只负责纸片运动，不负责创造、改写或重绘文字。

当前 `incidentPreventionVersion=1` 的文字牌必须从首帧起固定在独立支架上，只有指定无字部件运动。下文历史刚性带字牌运动说明不适用于该策略；首帧应是动作开始前的初态，不是提前画出终态。

## 职责边界

- 当前 v2 上游权威是经用户批准后生成的 `director-cues-v2-handoff.v1.json` 及其绑定的 `paper-editorial.first-frame-handoff.v1.json`。只有纸艺分路为 `planned` 才启动本 Skill；`not-required` 必须原样停止，不能为了运行首帧自动化补造纸艺镜头。
- v2 交接中的 `paper-editorial.image-to-video-handoff.v1.json` 只供后续视频生成阶段，首帧阶段不得读取其中的动作词；AI 分路的两个清单也不得送入纸艺首帧流程。
- 历史上游权威仍可能是 `koubo-remotion-director` 生成并验证的 `first-frame-prompts.v1.json`；若旧简化导演直接交付 `koubo-director-cues/v1`，必须先走下述 cue-native 桥接，不能退回旧 V9 工程合同重新写提示词。
- 本 Skill 不重写口播、不重新导演；生成模型不得写中文，但本地确定性文字烘焙属于本 Skill 的必经步骤。
- 本 Skill 不提交 RunningHub、不生成视频、不发布。
- `runninghub-image-to-video-prompts.v1.json` 只供后续人工操作；不得把其中动作提示词混入首帧生图。
- 真实界面、官方资料、地点和业务证据不得用纸艺图冒充。所有图片用途固定为 `illustration-only`。
- 原始清单和已生成图片不得覆盖。修订必须建立新 revision 或新文件名。

## 固定流程

### 1. 预检导演交付

优先接收首帧 JSON 清单的绝对路径。若用户只粘贴提示词，先按同样 schema 建立新的项目内清单，并明确它是 `manual-import`，不能伪造导演验证回执。

若输入是 `koubo-director-cues/v2`，不得直接相信手工复制的提示词，也不得调用旧 v1 桥接。先取得绑定当前 cues SHA-256 的 `koubo-director-cues-user-approval/v2`，再建立新的、不可覆盖的本地交接目录：

```bash
node skills/koubo-remotion-director/scripts/build-director-cues-v2-handoff.mjs \
  --project-root <口播项目根目录> \
  --cues <director-cues.v2.json> \
  --approval <director-cues-user-approval.v2.json> \
  --profile workflow/active-director-profile.v1.json \
  --output-dir <新的v2交接目录>
```

该命令只构造本地交接，不生图、不提交平台。总清单必须实际记录 active profile 的四路映射；真实素材、AI 情景和纸艺三条分路都必须存在，空分路保持 `not-required`。进入本 Skill 时只取总清单绑定的纸艺首帧文件，并逐项复验 task、revision、路径和 SHA-256；提示词正文必须与 v2 cues 完全一致。现有批次入口若尚未声明接受该 v2 交接 schema，应保持 `blocked`，不得把它伪装成旧 `koubo-director-cues/v1` 或 V9 清单绕过验证。

若输入是简化导演 `director-cues.v1.json`，先取得绑定当前 cues SHA-256 的单样本用户确认回执，再运行：

```bash
node skills/koubo-paper-firstframe-producer/scripts/bridge-director-cues.mjs \
  --project-root <口播项目根目录> \
  --cues <director-cues.v1.json> \
  --acceptance <user-confirmation.v1.json> \
  --output-dir <新的cue-native修订目录>
```

该桥接必须原样保留每镜 `firstFramePrompt` 和 `videoPrompt`：前者只进入首帧清单，后者只进入独立 RunningHub 清单。内部临时纸牌坐标仅供旧写字器建立身份，必须标记为 provisional，不能进入生图提示词；写字前仍以实际生成图片的四角标定为准。cue-native 清单固定 `samplePolicy=one-representative-scene`，只授权用户确认的一个代表镜头。

正式导演清单必须同时满足：

- schema 为 `koubo-paper-first-frame-prompt-manifest/v1`；
- `status=automation-input-ready`；
- 每镜具有唯一 `sceneId`、`pairId`、`outputFileName`；
- `firstFramePromptSha256` 与提示词正文一致；
- 不含 `imageToVideoPrompt`；
- `generatedReadableTextAllowed=false`，且每镜有 `deterministicTextBake.enabled=true`；
- `deterministicTextBake.anchorCalibrationRequired=true`，RunningHub 清单状态为 `awaiting-text-baked-firstframes`；
- 同 revision 的导演验证回执存在且 `skillExecuted=true`。
- 批次建立后的登记、联系表、写字、验证与整批授权入口，必须每次重新校验 `job.sourceManifest → directorValidationReceipt → receipt.artifacts.firstFramePromptManifest → 当前清单文件` 的路径、SHA-256 和 `taskId/requestId/revisionId`。不得相信 job 自报的 `sourceDirectorSchema`，也不得把另一份旧 V9 清单改指为当前来源。
- 旧 V9 完整导演清单必须有 `v9ContractEnabled=true`；每镜的 `layoutContract`、哈希、构图宽区、标签预留区和禁装饰策略必须完整一致。该条不适用于明确标记 `sourceDirectorSchema=koubo-director-cues/v1` 的 cue-native 清单；后者不得为了过门禁重新拼入坐标、碰撞或物理条款。
- `policy.physicalContinuityVersion="1"` 的新清单还必须保留每镜 `physicalContract`、`motionContract` 及各自哈希，实际图像复核不得删除或忽略这些字段。

运行：

```bash
node skills/koubo-paper-firstframe-producer/scripts/prepare-firstframe-batch.mjs \
  --manifest <first-frame-prompts.v1.json> \
  --director-receipt <director-validation-receipt.v1.json> \
  --project-root <口播项目根目录> \
  --sample P03
```

脚本只在清单同级创建首帧/带字首帧/质检目录、新的 `first-frame-batch.v1.json`，以及独立固定名的 `first-frame-route-lock.v1.json`，不调用生图工具。五个关键入口必须从实际 job 路径定位该锁，不得相信 job 自报路由。锁会绑定导演清单、导演回执、任务身份、唯一样镜和逐镜静态快照；除 `scene.result` 及顶层状态、事件、写字回执、验收/授权字段外，提示词、配对、文字计划、输出路径、镜头顺序等变化都必须阻断。

只有在该硬门上线前已经由本脚本建立、仍处于未授权状态的 cue-native 批次，才允许一次性补锁。迁移命令必须显式提供已经人工核对的任务身份、P02 等代表镜编号和两份当前 SHA-256；它只补不存在的锁，不改写或覆盖 job、清单、回执，也不生成用户验收：

```bash
node skills/koubo-paper-firstframe-producer/scripts/migrate-cue-native-firstframe-route-lock.mjs \
  --project-root <口播项目根目录> \
  --job <first-frame-batch.v1.json> \
  --expected-task-id <taskId> \
  --expected-request-id <requestId> \
  --expected-revision-id <revisionId> \
  --expected-selected-scene <sceneId> \
  --expected-manifest-sha256 <当前首帧清单SHA256> \
  --expected-director-receipt-sha256 <当前导演验证回执SHA256>
```

### 2. 一张代表性样图门

每个 V9 或 cue-native 新任务只先选一张结构最复杂、标签最多或遮挡关系最强的代表镜头。优先级依次为 `complex-explanation`、`mechanical-causality`、`occluded-state-reveal`；如果清单不携带 archetype，从同 revision 的导演 plan 或 cues 读取，仍无法判断时选择中段复杂镜并在批次记录中声明限制。旧版非 V9、非 cue-native 清单仍保持三张样图门，不得借此改写历史批次。

使用内置 `image_gen`，每张图片必须是独立调用。默认最多同时执行两张，禁止把多条提示词拼进同一调用。提示词可追加统一质量锁和禁止项，但不得改变核心物件、数量、颜色、关系或事实边界；原始提示词与实际执行提示词都要留存并计算哈希。

生成后把返回图片复制到批次声明的绝对路径，文件名严格使用清单中的 `outputFileName`。已有文件立即停止，不得覆盖。

每张完成后登记：

```bash
node skills/koubo-paper-firstframe-producer/scripts/record-firstframe-result.mjs \
  --job <first-frame-batch.v1.json> \
  --scene P01 \
  --image <first-frames/P01_B04_first-frame.png> \
  --execution-prompt-file <first-frame-qa/P01.execution-prompt.txt> \
  --tool image_gen
```

### 3. 无字基础图视觉质检

必须实际打开每张图，不得只看尺寸或文件存在。完整标准见 [references/quality-contract.md](references/quality-contract.md)。逐图至少检查：

- 主物件、数量、方位和关系是否对应提示词；
- 是否有三层以上空间、真实遮挡、纸厚和接触阴影；
- 材质是否像纸张、瓦楞纸、棉线、硫酸纸等，而不是塑料 CGI；
- 是否出现模型生成的乱码、可读文字、Logo、水印、人手或未要求人物；
- 静音看图是否能理解该镜核心关系；
- 是否符合本镜实际动作合同，关键物件没有粘连或缺失；事故预防版最多4个活动动作，不强凑步骤。
- 启用实体合同后，按质量合同记录 `physicalObservations`：实际图中的活动件数量、各组占用、空接收位、固定牌和移动通道。计划里的数量、坐标与“净空”说明不能当作实际图像观察。

把逐图视觉结论写入 `first-frame-qa/<sceneId>.visual-review.v1.json`。任何硬项失败，该镜状态为 `revision-required`；不得自动补跑。

生成联系表并汇总验证：

```bash
node skills/koubo-paper-firstframe-producer/scripts/build-firstframe-contact-sheet.mjs \
  --job <first-frame-batch.v1.json> --phase sample
node skills/koubo-paper-firstframe-producer/scripts/validate-firstframe-batch.mjs \
  --job <first-frame-batch.v1.json> --phase sample
```

代表样图通过也只能写 `candidate-stills-awaiting-user-review`。用户看过样图和原图并明确确认后，才能生成剩余图片。失败即停，禁止自动重试；先回到导演布局或提示词修订。

cue-native 任务还必须等带字样图、原图质检和 OCR 通过后，由主任务根据用户实际看图原话建立独立 `koubo-paper-firstframe-sample-user-acceptance/v1` 回执。回执必须绑定当前 `taskId/requestId/revisionId`、`selectedSceneId`、`sourceManifest {path,sha256}`、`textBakedSample {sceneId,path,sha256}`、`userQuote` 和 `approvedAt`，然后只能用安全登记命令开启整批：

```bash
node skills/koubo-paper-firstframe-producer/scripts/authorize-firstframe-full-batch.mjs \
  --project-root <口播项目根目录> \
  --job <first-frame-batch.v1.json> \
  --acceptance <已存在的样图用户验收回执>
```

该命令不生成、补写或推断用户验收，只验证当前带字样图、原图逐项质检、最新 sample 写字/OCR 回执和所有哈希后登记。手改 `fullBatchAuthorized=true` 不构成授权；未通过时，未选镜头登记、`phase=full` 写字、验证与联系表均必须阻断。

若用户明确要求“整批首帧和画布准备好，最后再确认”，可在代表图实际QA通过后按该授权继续剩余首帧与本地烘焙，不再重复申请中途审美确认。必须记录原话、当前任务和修订范围，用户视觉验收始终为 `pending`，不得伪造“用户看过/已批准图片”。本例外不适用于 cue-native 单样本路线；cue-native 仍必须完成上述独立样图验收登记。本例外不豁免任何硬失败、写字/OCR检查，也不授权视频提交、付款或自动重试。

### 4. 剩余图片批量执行

用户确认样图后：

- 把用户原话、时间、样图路径与 SHA-256 写入独立验收回执；
- 每张仍保持独立生图调用，最多两路并发；
- 每生成一张就落盘、登记和检查，不等整批结束才发现串镜；
- 单镜失败只阻断该镜和整批 ready 状态，不自动重试、不静默换提示词；
- 修订图使用新 revision，不能覆盖失败图。

### 5. 实际纸面标定与确定性写字

无字基础图通过后，必须针对**实际生成图片**登记每张标签纸的四个角。导演计划里的 `anchorQuad` 只是构图意图，禁止直接当成真实坐标。

每镜建立 `first-frame-qa/anchor-calibrations/<sceneId>.v1.json`：

```json
{
  "schemaVersion": "koubo-paper-firstframe-anchor-calibration/v1",
  "sceneId": "P01",
  "status": "passed",
  "sourceImage": {"path": "<ABSOLUTE_PATH>", "sha256": "<SHA256>"},
  "labels": [
    {
      "nodeId": "N1",
      "anchorQuad": [[0.10, 0.20], [0.30, 0.20], [0.30, 0.31], [0.10, 0.31]],
      "placementChecked": true
    }
  ]
}
```

四角顺序固定为左上、右上、右下、左下；坐标按图片宽高归一化。必须实际打开图片检查纸面，不能复制所有镜头同一套坐标。

然后运行：

```bash
node skills/koubo-paper-firstframe-producer/scripts/bake-firstframe-batch.mjs \
  --project-root <口播项目根目录> \
  --job <first-frame-batch.v1.json> \
  --source-plan <director-preproduction-plan.v1.json> \
  --font <可嵌入中文字体绝对路径> \
  --phase sample
```

脚本会组装并调用导演 Skill 的确定性写字器，输出 `text-baked-first-frames/`、写字请求和 OCR 回执。目标中文必须逐字相等；位置偏离纸面、溢字、缺字、多字或 OCR 不通过都必须阻断。
最终图 OCR 必须先按实际 `anchorQuad` 反透视成正视纸牌，再放大、二值化、加白边并使用单行模式精确识别。可按固定、可审计的字号与预处理档位识别，但任一档都必须与目标中文逐字相等，并在回执中保留全部尝试。macOS 上只有当 Tesseract 全部固定档位均失败时，才可使用本机 Apple Vision 做第二 OCR 引擎复核；仍必须对同一张最终合成图逐字完全匹配，且回执必须记录最终识别引擎。中文纸牌优先使用已验证的 `NotoSansCJKsc-Regular.otf`；不要为了让 OCR 放行而更改目标文字。每次执行会自动选择下一个未使用的请求/回执版本号，失败记录和旧产物保持不变。

用户确认带字样图后，再对 `--phase full` 执行同样流程。联系表应优先使用带字图，不能拿无字基础图申请 RunningHub 交接。

写字入口与批次验证使用同一逐项视觉门；顶层 `status=passed` 不得掩盖失败或缺失的质量项。启用实体合同的图片缺少实际观察绑定时也不得写字。

### 6. RunningHub 交接

全部图片完成、无字图 QA、实际纸面标定、确定性写字、OCR 和用户整批确认全部通过后，才运行：

```bash
node skills/koubo-paper-firstframe-producer/scripts/build-runninghub-ready-pack.mjs \
  --project-root <口播项目根目录> \
  --job <first-frame-batch.v1.json> \
  --runninghub-manifest <runninghub-image-to-video-prompts.v1.json> \
  --user-acceptance <text-baked-firstframes-user-acceptance.v1.json>
```

`runninghub-ready-pack.v1.json` 是唯一可提交入口。动作提示词清单本身不是提交授权。每镜必须一一绑定：

- `sceneId`、`pairId`、`pairSha256`；
- 首帧文件绝对路径、字节数和 SHA-256；
- 原始首帧提示词 SHA-256；
- 对应 RunningHub 动态提示词 SHA-256；
- 用户验收状态。

cue-native 交接不得伪造旧 V9 `motionContract` / `physicalContract`。它必须复验 cues→source plan→首帧清单→动作清单的顺序、原文和哈希；`first-trial` 只允许已锁定的代表镜。批次交接还必须绑定同一份 `sampleUserAcceptanceReceipt` 和当前 cue 集的 `koubo-cue-native-representative-dynamic-acceptance/v1`。两类交接包均必须保持 `codexSubmissionAllowed=false`、`externalSubmissionAuthorized=false` 和 `paidGenerationAllowed=false`；实际提交仍需用户另行授权。

事故预防版的带字标签全程固定，仅无字件按动作合同运动。历史非事故预防版才允许带字标签刚性滑入、平移、小角度旋转、抽屉推出和刚性拼图扣合；始终禁止折叠、弯曲、卷曲、揉皱、拉伸、翻面、强运动模糊和重新生成文字。

最终文件夹至少包含首帧清单、全部图片、联系表、生成回执、逐图质检、RunningHub JSON/Markdown 清单和交接包。只有这些齐全，状态才可写 `ready-for-runninghub-manual`。

### 7. 用户最后确认的画布准备模式

用户已明确授权上传首帧和准备画布、但尚未看图或验收动态时，不生成伪造的用户验收回执，不使用可提交的ready pack。全部首帧逐项QA、实际标定、写字、OCR和带字视觉检查通过后，调用：

```bash
node skills/koubo-paper-firstframe-producer/scripts/build-runninghub-canvas-preparation-pack.mjs \
  --project-root <口播项目根目录> --job <first-frame-batch.v1.json> \
  --runninghub-manifest <runninghub-image-to-video-prompts.v1.json> \
  --authorization <canvas-preparation-authorization.v1.json>
```

授权结构和实际观察结构见 [references/quality-contract.md](references/quality-contract.md)。输出为独立的 `runninghub-canvas-preparation-pack.v1.json`，只能用于上传、连线和填写；`userAcceptance=pending`、`dynamicValidation=pending`、提交与付费权限为false。它不能满足V9的生成交接或视频验收，不得通过改名冒充ready pack。画布填好后交由用户检查，运行仍需独立授权。

## 停止条件

- 导演清单、验证回执、提示词哈希或配对关系不一致；
- 目标目录不在用户指定的口播项目内；
- 目标图片已存在；
- 样图有任一硬项失败，或用户未确认且没有明确的整批准备授权；
- 实际纸面四角未登记、沿用计划坐标或多镜复制同一坐标；
- 带字首帧不存在、哈希不一致、中文OCR不通过或文字没有落在对应纸面；
- RunningHub 清单仍为 `awaiting-text-baked-firstframes` 且没有符合本轮动作范围的ready pack或独立画布准备包；画布准备包永远不能用于提交视频；
- 生图返回不确定、文件损坏、画幅明显不符；
- 连续一次受控修订仍复现同一硬失败；
- 需要 RunningHub 上传、付费、重试或其他外部动作但没有单独授权。

## 完成用语

- 只建批次：`首帧批次已建立，尚未生图`。
- V9 代表样图完成：`一张候选首帧已生成并完成初检，待用户看图确认`。
- 全批机器侧通过：`首帧批次机器侧与逐图初检通过，待用户整批确认`。
- 用户确认后：`首帧交接包已达到 ready-for-runninghub-manual；RunningHub 视频仍由用户手动生成和另行验收`。
