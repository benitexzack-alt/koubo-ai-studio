---
name: koubo-paper-firstframe-producer
description: 执行口播纸艺导演输出的首帧生图清单：先生成无字纸艺基础图并检查材质与构图，再按实际纸面四角确定性写入准确中文、执行OCR和带字成片检查，最后生成唯一 RunningHub 手工交接包。用户粘贴多条纸艺首帧提示词、提供 first-frame-prompts.v1.json，或要求批量生图并放入指定口播项目文件夹时使用。
---

# 口播纸艺首帧执行导演

把导演的纸艺分镜变成可供 RunningHub 手动图生视频使用的**准确带字完成态首帧**。模型先生成无字纸艺基础图，本地工具再把导演锁定的中文写到真实纸面上；RunningHub 只负责纸片运动，不负责创造、改写或重绘文字。

## 职责边界

- 上游唯一权威是 `koubo-remotion-director` 生成并验证的 `first-frame-prompts.v1.json`。
- 本 Skill 不重写口播、不重新导演；生成模型不得写中文，但本地确定性文字烘焙属于本 Skill 的必经步骤。
- 本 Skill 不提交 RunningHub、不生成视频、不发布。
- `runninghub-image-to-video-prompts.v1.json` 只供后续人工操作；不得把其中动作提示词混入首帧生图。
- 真实界面、官方资料、地点和业务证据不得用纸艺图冒充。所有图片用途固定为 `illustration-only`。
- 原始清单和已生成图片不得覆盖。修订必须建立新 revision 或新文件名。

## 固定流程

### 1. 预检导演交付

优先接收首帧 JSON 清单的绝对路径。若用户只粘贴提示词，先按同样 schema 建立新的项目内清单，并明确它是 `manual-import`，不能伪造导演验证回执。

正式导演清单必须同时满足：

- schema 为 `koubo-paper-first-frame-prompt-manifest/v1`；
- `status=automation-input-ready`；
- 每镜具有唯一 `sceneId`、`pairId`、`outputFileName`；
- `firstFramePromptSha256` 与提示词正文一致；
- 不含 `imageToVideoPrompt`；
- `generatedReadableTextAllowed=false`，且每镜有 `deterministicTextBake.enabled=true`；
- `deterministicTextBake.anchorCalibrationRequired=true`，RunningHub 清单状态为 `awaiting-text-baked-firstframes`；
- 同 revision 的导演验证回执存在且 `skillExecuted=true`。

运行：

```bash
node skills/koubo-paper-firstframe-producer/scripts/prepare-firstframe-batch.mjs \
  --manifest <first-frame-prompts.v1.json> \
  --director-receipt <director-validation-receipt.v1.json> \
  --project-root <口播项目根目录> \
  --sample P01,P03,P07
```

脚本只在清单同级创建 `first-frames/`、`first-frame-qa/` 和新的 `first-frame-batch.v1.json`，不调用生图工具。

### 2. 三张代表性样图门

每个新任务先选三张，尽量覆盖 `complex-explanation`、`mechanical-causality`、`occluded-state-reveal`。如果清单不携带 archetype，从同 revision 的导演 plan 读取；仍无法判断时，选择首、中、末三镜并在批次记录中声明限制。

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
- 是否适合后续按 4—7 步装配，关键物件没有粘连或缺失。

把逐图视觉结论写入 `first-frame-qa/<sceneId>.visual-review.v1.json`。任何硬项失败，该镜状态为 `revision-required`；不得自动补跑。

生成联系表并汇总验证：

```bash
node skills/koubo-paper-firstframe-producer/scripts/build-firstframe-contact-sheet.mjs \
  --job <first-frame-batch.v1.json> --phase sample
node skills/koubo-paper-firstframe-producer/scripts/validate-firstframe-batch.mjs \
  --job <first-frame-batch.v1.json> --phase sample
```

三张全部通过也只能写 `candidate-stills-awaiting-user-review`。用户看过联系表和原图并明确确认后，才能生成剩余图片。

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

带字标签只允许刚性滑入、平移、小角度旋转、抽屉推出和刚性拼图扣合。禁止折叠、弯曲、卷曲、揉皱、拉伸、翻面、强运动模糊和重新生成文字；需要“展开”时，只展开无字底板，再让带字纸牌滑入。

最终文件夹至少包含首帧清单、全部图片、联系表、生成回执、逐图质检、RunningHub JSON/Markdown 清单和交接包。只有这些齐全，状态才可写 `ready-for-runninghub-manual`。

## 停止条件

- 导演清单、验证回执、提示词哈希或配对关系不一致；
- 目标目录不在用户指定的口播项目内；
- 目标图片已存在；
- 样图有任一硬项失败或用户未确认；
- 实际纸面四角未登记、沿用计划坐标或多镜复制同一坐标；
- 带字首帧不存在、哈希不一致、中文OCR不通过或文字没有落在对应纸面；
- RunningHub 清单仍为 `awaiting-text-baked-firstframes` 且没有 `runninghub-ready-pack.v1.json`；
- 生图返回不确定、文件损坏、画幅明显不符；
- 连续一次受控修订仍复现同一硬失败；
- 需要 RunningHub 上传、付费、重试或其他外部动作但没有单独授权。

## 完成用语

- 只建批次：`首帧批次已建立，尚未生图`。
- 三张样图完成：`三张候选首帧已生成并完成初检，待用户看图确认`。
- 全批机器侧通过：`首帧批次机器侧与逐图初检通过，待用户整批确认`。
- 用户确认后：`首帧交接包已达到 ready-for-runninghub-manual；RunningHub 视频仍由用户手动生成和另行验收`。
