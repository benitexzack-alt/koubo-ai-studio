# 首次候选合同接入

这是输入许可合同，不是候选验收或正式制作许可。现有生产者输出无需伪填未来视频、技术质检、完整观看或交接；这些后置对象固定为 `null`，所有正式和验收开关固定为 `false`。

## 生产者

`scripts/first-candidate-input-contract.mjs` 导出只读的 `buildFirstCandidateInputContract`。参数为当前 `projectRoot`、新 `job`、已有 `assetIntake` 与 `assetIntakeValidation` 文件路径，以及执行组和授权用户身份。它从 `job.director.artifacts` 消费七项现有预拍/实录重绑产物，读取当前档案和风格，再复算现有校验器。返回 `{contract, validation}`，不写文件、不签名、不安装密钥、不运行渲染，也不将结果登记为验收通过。

新 job 必须显式声明 `productionEligible=false`、`formal.enabled=false`、`experiment.status=candidate-preview-required`、`experiment.userPreviewApproved=false`。`productionGate` 继续使用 `director-production-entry-binding/v2`，其 `state=first-candidate-preview-required`，`productionEligible/userPreviewApproved/formalEnabled` 均为 `false`。不允许夹带旧 `directorContract`、旧交接或正式授权。

预拍请求及其计划、路由、编译与验证回执必须传播当前预拍 `revisionId`；实录重绑与入场链必须绑定本次 `productionGate.revisionId`。各阶段的 `policy.incidentPreventionVersion='1'` 不可剥离。原导演 `taskId` 不变；生产知识上下文仍独立校验。

素材和JSON证据仍限制在工程内且拒绝符号链接。只有 `tool/tools` 中精确绑定本机固定搜索目录实际解析出的 `ffmpeg/ffprobe/magick/tesseract` 可执行文件，才作为 `role=runtime-tool` 单独计入签署清单；不能把任意外部文档改名为工具来绕过路径检查。工具记录只允许 `path/sha256` 两字段，路径或工具字节变化均需重新绑定。闭包上限为32768文件，以容纳多镜逐节点OCR与命令证据；这不是无限递归或外部路径通行许可。

## 独立授权

构造后，父集成将合同写入新文件并把真实路径/SHA 绑定到 `productionGate.firstCandidateInput`。写入不属于本构造函数的行为，也不代表渲染获批。

- `firstCandidateAuthorization` 使用专用授权模板，`role=user`、`decision=approved-first-candidate-inputs`，独立锚点类型为 `director-first-candidate-input-authorization`。
- `freezeReceipt` 使用同一新授权 schema，`role=supervisor`、`decision=approved-first-candidate-revision`，独立锚点类型仍为 `director-production-freeze-authorization`，另需 `userAuthorizationSha256`。
- 两份授权均逐项签署完整 `binding`：节目、原导演任务、本次修订、job 快照、首次输入合同、所有传递输入与媒体、运行图、composition 和当前门禁闭包。授权签名沿用现有 V2 独立验证器，无新签名器、可注入密钥或免签分支。
- 两份真实消息必须各自独立于执行组，监督组及消息还必须独立于用户许可。用户身份必须匹配 `authorizedUserId`。消息原话、SHA、有效期、修订及命令白名单继续验证。
- 首次许可只支持 `preview` 和 `direct-remotion-preview`，且必须同时命中冻结注册表及两份授权。`prepare/doctor/formal/qa/release` 不从此许可扩权。

候选完成后仍由原 V2 候选验收及正式授权合同承接，不能把本 schema 改个状态升级成“已接受候选”。任何缺失的真实签名、包锁更新、知识上下文或素材证据都维持阻断。

## 聚焦验证

```sh
node --experimental-vm-modules skills/koubo-remotion-director/tests/test-first-candidate-input-contract.mjs
node skills/koubo-remotion-director/tests/test-first-candidate-producer-integration.mjs
node skills/koubo-remotion-director/tests/test-first-candidate-runtime-tool-closure.mjs
```

第一组是隔离虚拟机中的合成签名/门禁编排正负测试，含明确的上游测试替身。第二组不替换校验器，调用现有六个编译/校验命令并消费其实际输出，使用临时静音视频、中文标签测试片完成本地解码、抽帧和OCR，再经构造函数实例化合同，同时复查运行期间源码没有漂移。第三组实测工具身份、越界拒绝和多镜规模的文件闭包。素材和观看回执均标为 `synthetic`，没有真实口播、模型生成动画、用户批准或生产放行。测试只写临时目录并自行清理。
