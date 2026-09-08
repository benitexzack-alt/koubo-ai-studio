# 事故预防交接与状态接口 V1

适用范围：新纸艺任务的离线交接和 V9 状态校验。历史节目与现有 pack 保持不变；本接口不授权付费、重试、正式渲染或公开发布。

## 策略入口

- 新状态模板已固定 `policy.incidentPreventionVersion="1"`。
- ready-pack 从烘焙回执绑定的源 plan、job.sourceManifest 绑定的首帧清单、RunningHub 清单读取同一策略。任一来源启用，或实际项目 `workflow/active-director-profile.v1.json` 的 `incidentPreventionPolicy.requiredForNewPreproduction=true`，即进入强化模式，三份上游文件必须全部声明 `"1"`。不能删除自身或全部输入策略降级；未知版本直接失败。无档案的隔离旧夹具保留兼容。
- 无策略的旧纯夹具和历史只读兼容。V9 此时返回 `validationMode="legacy-read-only"`、`contentVerified=false`、`stageAdvanceAllowed=false`，输出的正式和发布包门均关闭，不能作为新任务晋级证据；历史文件自身保持原样。
- 强化 V9 必须提供真实 `projectRoot`、`verifyFiles=true`；跳过文件检查不能得到推进权限。

## 首帧与交接

保留原 CLI 参数，新增 `--handoff-scope first-trial|batch`，默认 `batch`；整批还需 `--dynamic-acceptance <JSON路径>`。单镜试验可指定 `--scene-id P02`，不传才默认第一镜。`--output` 只能指向新文件，已有 pack 一律不覆盖。

上游接入字段：

- `plan`、首帧与 RunningHub 清单、`job`、静态用户批准、动态验收均须有相同的非空 `revisionId`；`taskId`、`requestId` 必须相符。prepare 从真实清单和校验回执检查并传播 revisionId/policy，烘焙回执维持原 schema，并绑定 taskId 和当前 sourcePlan 文件 SHA。
- plan.paperScenes[].motionContract 是权威动作合同；RunningHub scene.motionContractSha256 必须是其 canonical SHA。
- RunningHub scene.dynamicValidation 必须与源 motionContract.dynamicValidation 完全相同，并包含 `requiredBeforeBatch=true`、`staticApprovalIsNotDynamicApproval=true`、`automaticRetryAllowed=false`。
- 源 plan 文件 SHA、清单 sourcePlanCanonicalSha256、首帧与动作 prompt SHA、pairId/pairSha256、textPlanSha256 和 labelsSha256 均重算，不信任传递摘要。
- 源 plan.prompt 仍须与原生 `renderMotionFirstFrame(scene)` / `renderMotionPrompt(scene)` 完全一致，不能通过反写源 plan 后重算全部摘要绕过 canonical 提示词。
- 每个 `motionContract.semanticReview` 外部文件须仍匹配当前 SHA；调用原生 `validatePaperMeaningReview` 重验任务、版本、beat、脚本 SHA、原话及完整机构快照。不修改外部审查或原始 plan，审查漂移与已接纳例外均阻断。
- 最终图片的 OCR 必须覆盖全部非空、唯一的烘焙 nodeId。每行必须包含准确的 `expected`、非空且规范化后匹配的 `recognized`、`matched=true`、`evaluationStage="final-composite"`、当前图片的 `inputImageSha256`。

静态用户批准在原 approved/status/taskId/requestId/scope/sceneIds 之外新增：

```json
{
  "revisionId": "当前版本",
  "assets": [{"sceneId": "P01", "path": "当前带字图片路径", "sha256": "当前图片SHA"}],
  "assetSetSha256": "当前图片集合canonical SHA",
  "userQuote": "用户针对这些图片的实际原话",
  "approvedAt": "实际确认时间"
}
```

集合摘要算法：每项只取 `sceneId/path/sha256`，路径按项目根目录解析为绝对路径，再按 sceneId 排序，使用 `sha256Json`。数组必须与本次交接图片集合完全对应，不能只有镜头编号，不能少图、重复图或批准后换图。

`first-trial` 只输出指定的一镜；接受包含该镜的当前 sample 或 full 烘焙回执，不要求剩余图片已生成。批准集合也只包含该镜。默认文件名为 `runninghub-ready-pack.P02.first-trial.v1.json`，不同镜头互不覆盖。返回 `ready-for-runninghub-first-trial-manual`、`dynamicValidation.status="pending"`。

## 动态验收

动态回执 schema 固定为 `koubo-paper-representative-dynamic-acceptance/v1`，顶层要求：

- `status="representative-dynamics-approved"`、`approved=true`。
- 当前 `taskId/requestId/revisionId`、`sourcePlan:{path,sha256}`、该回执代表镜图片集合的 `assetSetSha256`。为兼容同批签发方式，batch 也接受整批当前图片集合 SHA。
- 非空 `representatives[]`，每项的 `sceneId` 唯一。

每项代表样片要求：

```json
{
  "sceneId": "P01",
  "inputFirstFrame": {"path": "当前带字首帧", "sha256": "当前图片SHA"},
  "pairSha256": "当前配对SHA",
  "imageToVideoPromptSha256": "当前动作提示词SHA",
  "motionContractSha256": "当前动作合同canonical SHA",
  "video": {"path": "实际验收的源视频", "sha256": "该视频当前SHA"},
  "approved": true,
  "userQuote": "本条正常速度观看后的实际验收原话",
  "approvedAt": "实际确认时间",
  "checks": {
    "normalSpeedSilentMeaningCorrect": true,
    "spokenMeaningConsistent": true,
    "labelsReadableThroughout": true
  }
}
```

代表性按**完整动作合同 canonical SHA 完全相同**归组，不使用调用方自报机构名称。整批所有不同合同都需至少一个通过的代表样片。文本、part ID、动作、审查文件绑定不同都会产生不同组，真实逐 beat 的审查通常意味着每镜都需独立试验。本轮没有实现自动同机构泛化，也没有新增 pilotSceneIds 批准协议。

多次独立试验的验收不必重签：`--dynamic-acceptance` 可指向索引文件，内容为 `{"schemaVersion":"koubo-paper-dynamic-acceptance-index/v1","acceptances":[{"path":"P01验收文件","sha256":"当前文件SHA"},{"path":"P02验收文件","sha256":"当前文件SHA"}]}`。每份回执绑定自己的图片集合，后续图片生成不使原验收自动失效，但 plan/revision 变化仍须重新核对。

后续单镜试验应传入累计验收索引：已通过的 sceneId 再次申请会拒绝，仍未通过的 P02 可继续。batch 仅把剩余镜头写入 `scenes`，本次静态批准也只绑定这些剩余图片；`alreadyAcceptedScenes` 保留源视频、首帧和验收文件绑定，明确 `disposition="reuse-accepted-source"`、`regenerationAllowed=false`。全部已经验收时返回 `no-generation-required` 和空 scenes，不能把代表片重新列为生成任务。工具没有外部平台账本，调用方不得隐瞒既有验收。

固定读取同目录 `paper-motion-incident-registry.v1.json`，不可由 CLI 替换 registry。缺失、错 schema 或错误条目阻断；任何负例 videoSha256 不得用于动态成功验收。用户保留瑕疵的 exception、失败状态和失败布尔结果仍然阻断，不能靠外层 approved/status 覆盖。

整批交接返回 `dynamicValidation.status="representative-mechanisms-accepted"`，并记录动态验收和负例 registry 的文件 SHA。所有 pack 均保留 `batchDynamicallyAccepted=false`、`paidGenerationAllowed=false`、`codexSubmissionAllowed=false`、`formalEnabled=false`、`publicationEnabled=false`。代表通过不等于整批视频成功；真正入场与正式、发布门仍独立。

## V9 内部证据

预拍阶段直接消费当前生产者的原件，不要求给已签文件补通用 `bindings` 或伪造 status。`NATIVE_PREPRODUCTION_ARTIFACTS` 与原生重编译检查覆盖 request、plan、route、compile receipt、validation receipt 和三类清单：

- 保留各自真实 schema/status/phase 与 task/request/revision。原生 plan、route 和清单在内存中重编译比对。
- 原生 compile receipt 的 `compilerExecuted=true, skillExecuted=false` 是正确的“已编译待独立校验”状态，不能把它误判为失败，也不能单独当作 skill 成功。只有独立 validation 的 `skillExecuted=true` 及真实原件绑定才能完成本阶段。
- 使用原有 receipt.request/plan/routeLock、validation.artifacts 和 manifest.sourcePlanCanonicalSha256 等真实字段，不向原件加不存在的外壳。中文提示词文档、脚本与外部机制审查均重新核对。
- 原生脚本确认使用 `authority="direct-user-message"`、`quote`、`recordedAt`、`script:{path,sha256}`，并绑定 task/revision；不会要求把它改写为 userQuote/approvedAt。

独立新状态生成器：

```sh
node skills/koubo-remotion-director/scripts/build-v9-preproduction-state.mjs \
  --repo-root <项目根目录> --request <已编译校验的request> \
  --script-confirmation <当前脚本批准原件> --output <新状态文件>
```

它只创建新的状态文件，补齐 stageHistory 中的 route/compile 引用和 `preproductionRequestId`，不会修改确认原件、编译或校验原件，也不会代签用户批准。生成后可用原 `validate-v9-production-state.mjs` CLI 校验。

若同时传入 `--handoff-pack <本次ready-pack原件>`，生成器会直接进入 `generation-handoff-ready`，并设置 `generationHandoffFormat="runninghub-ready-pack-v1"`。该原生分支将 `generationInventory` 绑定真实 ready-pack，将 `generationOwnershipReceipt` 绑定 pack 内引用的真实静态用户批准，不伪造新的清单或批准回执。校验器重读并重验 job、三份上游绑定、bake、静态批准、可选动态验收、实际图片与 OCR，同时逐项比对 pack 的提示词和安全字段。错误类型或篡改 pack 后重新计算状态外层 SHA 仍会失败。

单镜 first-trial 可登记为“交接就绪”，但仍只是单镜人工交接，不代表整批已生成或动态通过；后续完整素材入场门独立保留。该分支不开放付费、自动提交、正式或发布。

预拍以后的结构化状态证据采用各键的内容合同；正文或媒体文件除外，合同要求的内部身份与依赖形状为：

```json
{
  "schemaVersion": "该产物专用schema",
  "status": "该阶段允许的真实状态",
  "taskId": "当前任务",
  "revisionId": "当前版本",
  "bindings": {
    "前序产物键名": {"path": "项目相对路径", "sha256": "当前文件SHA"}
  }
}
```

精确 schema、允许状态、必需 bindings 由 `scripts/v9-workflow-state-core.mjs` 导出的 `V9_CONTENT_CONTRACTS` 给出，其中 `native=true` 使用上述原生检查，不能套用通用外壳。其余 bindings 必须用状态文件 artifact 的同名键、同一路径及同一 SHA；不得把另一个 JSON 的哈希正确当作类型正确。未知附加 bindings 不会自动放行。

额外要求：

- scriptUserConfirmation 使用 `koubo-pre-shoot-user-confirmation/v1`；除上述原生确认格式外，保留规范化 userQuote/approvedAt 格式的独立测试。
- directorValidation 与 postshootRebindReceipt 必须有 `skillExecuted=true`。
- candidateUserAcceptance 必须绑定当前 candidatePreview/candidateQaReceipt/shotcraftApplicationReceipt，且 `formalAuthorized=true`，仅“看过候选”不能自动解锁正式。
- `not-required` AI 视频清单必须有空 `items`，不能用这一状态掩盖非空任务。
- 任何内部失败或已接纳例外不能晋升成功阶段或成功复用。错误结果返回 `nextStage=null`，并关闭结果中的 formalEnabled/releasePackageEnabled。

本轮原生生产者兼容闭环限于前三阶段（预拍、首帧交接与真实 ready-pack 的 V9 登记）；后续入场、实录重绑、正式、发布的全链原生兼容尚未证明，不能用规范化单元夹具冒充已经走通过。若其原生字段不同，须独立适配当前生产者，不能手补已签原件或降低正式与发布门。本轮不修改这些其他工作者负责的生产器。

## 验证边界

- 本轮先以原实现复现失败测试，再实现加固；负例 registry 接入也先复现特定拒绝码缺失。
- 回归包含实际 compiler/validator CLI、prepare CLI、bake CLI 和 P01/P02 ready CLI；仅原始输入图与人工批准输入是明确隔离夹具，不构成真实授权。原生 baker 输出的 8 个 OCR 节点全部匹配，确实包含 final-composite/inputImageSha256；没有手补任何 OCR 回执字段。
- `KOUBO_SKIP_MEDIA_FIXTURE=1` 只跳过旧重复媒体集成用例，不跳过 `test-native-compiler-handoff.mjs` 的真实本地确定性烘焙与 OCR。该用例在临时目录运行并清理，确认编译、校验与烘焙原件 SHA 未被交接器改写；漂移语义审查后重新交接被拒绝。
- 完整回归命令（不跳过旧集成）：`node --test --test-reporter=spec skills/koubo-paper-firstframe-producer/tests/test-firstframe-batch.mjs skills/koubo-paper-firstframe-producer/tests/test-text-bake-runninghub-handoff.mjs skills/koubo-paper-firstframe-producer/tests/test-native-compiler-handoff.mjs skills/koubo-remotion-director/tests/test-v9-workflow-state.mjs`。
- 2026-09-08 本机结果：71 项通过，0 失败，0 跳过；9 个改动脚本通过 `node --check`。同一套真实 compiler/prepare/bake/ready 产物可登记 V9 的 `generation-handoff-ready`。测试输入与产物均在隔离临时目录，未提交、未 push、未调用外部生成、未运行生产或改写历史节目。
- 校验器能核对证据身份和声明的一致性，不能证明用户真的看过视频，也不能仅凭 SHA 识别负例视频的重编码衍生物。真实动态语义、动作中文字稳定及用户验收仍未由本轮离线测试解决。
