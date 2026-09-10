# 纸艺完成态首帧质量合同

## 一、逐图硬项

每项只能写 `passed` 或 `failed`，不得用总分掩盖硬失败。

1. `semanticMatch`：主物件、数量、方位、颜色和关系与提示词一致。
2. `paperMaterial`：纸纤维、纸厚、撕边或瓦楞结构可见；不是塑料、陶瓷或通用三维渲染。
3. `depthAndContact`：至少三层空间；存在前后遮挡、接触阴影和落地关系，无大面积悬浮。
4. `cleanTextAndBrand`：无字基础图中不得出现模型生成的可读文字、乱码、随机英文、Logo、水印和未经要求的数字。
5. `compositionAndReadability`：主体清楚、关系路径可辨、留白服务视线，静音看图能复述核心关系。
6. `videoReadiness`：主要物件可分离并符合本镜实际动作合同；不存在严重粘连、缺件或形态歧义。事故预防版最多4个活动动作，不强凑4—7步。

任一项失败，整图为 `revision-required`。

## 二、带字首帧硬项

无字基础图通过后，最终交给 RunningHub 的首帧还必须同时满足：

1. `actualSurfaceCalibration`：每个标签使用实际图片中的纸面四角，计划坐标只作参考。
2. `exactChineseText`：每个中文节点与导演 `textPlan` 逐字相等，OCR 归一化后也必须相等，不能只做“包含”判断。
3. `paperSurfacePlacement`：文字完整落在对应纸面，边缘留白合理，无溢出、穿帮和悬浮。
4. `noExtraText`：除导演锁定节点外，没有新增随机字、Logo、水印或数字。
5. `rigidMotionReady`：事故预防版的带字牌位于独立固定支架，与活动件隔开；历史版才检查其完整刚性运动能力。始终不允许文字面折叠、弯曲、卷曲、翻面或拉伸。

任一项失败，不得生成 `runninghub-ready-pack.v1.json`。

## 三、批次一致性

- 色彩锚点稳定，但不得把所有镜头锁成同一固定比例。
- 材料、镜位和构图应随语义变化；禁止连续单物件居中、固定俯拍、大留白。
- 同类物件跨镜身份稳定，例如机柜、任务卡、棉线、纸门和店铺纸模不应无故变形。
- 图片不得复制参考片品牌、照片、具体版式、镜头顺序或第三方素材。

## 四、样图通过标准

- V9的一张代表图（旧非V9为三张）六项硬项全部通过；
- 联系表与全部代表原图均已打开检查；
- 无串镜、重号、缺图或重复图；
- 用户明确确认视觉方向。

机器检查、代理初检和文件哈希不能替代用户的审美确认。

## 五、视觉复核文件

每张图建立 `first-frame-qa/<sceneId>.visual-review.v1.json`：

```json
{
  "schemaVersion": "koubo-paper-firstframe-visual-review/v1",
  "sceneId": "P01",
  "imagePath": "<ABSOLUTE_PATH>",
  "imageSha256": "<SHA256>",
  "reviewer": "codex-visual-inspection",
  "status": "passed",
  "criteria": {
    "semanticMatch": "passed",
    "paperMaterial": "passed",
    "depthAndContact": "passed",
    "cleanTextAndBrand": "passed",
    "compositionAndReadability": "passed",
    "videoReadiness": "passed"
  },
  "notes": "<CONCRETE_OBSERVATIONS>"
}
```

`notes` 必须写实际观察，不能只写“很好”“符合要求”。

## 六、实体初态与通道的实际观察

当清单启用 `physicalContinuityVersion=1`，每张原图的视觉回执还必须有 `physicalObservations`。实际打开图片后填写；图像框统一为 `[x,y,width,height]` 的0—1归一化坐标，不得复制计划坐标冒充观测。

- `imageSha256` 与 `physicalContractSha256` 绑定当前图和当前实体合同。
- `inventory`：逐个 `partId` 记录 `observedQuantity`、`observedGroupIds`、每个实例的 `imageBoxes` 和具体 `notes`。一叠纸算一个刚性活动组，不能把其每张纸页算多个活动件。
- `stations`：逐 `groupId` 记录 `observedPartIds`、`imageBox`、`notes`；空接收位明确记录空数组，不得漏掉。
- `transfers`：逐 `actionId` 记录实际通道 `imageBox`、具体 `notes` 及 `checks`：`continuousSupport`、`compatibleHeight`、`noBlockingEdges`、`openingFitsPart`，各项必须为 `passed`。不能可靠看清时记为 `unknown` 并阻断，不猜测被遮挡结构。
- `fixedLabels`：逐 `nodeId` 记录实际牌面 `imageBox`、`independentStandObserved` 和具体 `notes`，不能遗漏或多出标签。

校验器比对这些观测与合同，阻断数量/位置/空位不符、缺观察和失败通道。它不会从文字回执自动证明图片真实符合物理规律；实际看图与未来真实视频的动作检查仍不可替代。

带字成品另存 `<sceneId>.text-baked-visual-review.v1.json`，schema为 `koubo-paper-text-baked-visual-review/v1`，包含 `sceneId/imageSha256/status/criteria/notes`；criteria必须完整包含第二节的五项检查。

## 七、仅准备画布的授权

`canvas-preparation-authorization.v1.json` 的schema为 `koubo-canvas-preparation-authorization/v1`，需记录：

- `status=authorized-for-canvas-preparation`；当前 `taskId/requestId/revisionId`；
- `sourceManifest={path,sha256}` 与当前批次一致；`sceneIds` 是按当前批次顺序列出的完整集合；
- 本轮用户授权原话 `userQuote` 与记录时间 `recordedAt`；
- `uploadAllowed=true`、`canvasConfigurationAllowed=true`；
- `submissionAllowed=false`、`paidGenerationAllowed=false`、`userAcceptance=pending`。

这只证明用户授权做准备，不表示用户已经看过尚未生成的图片或验收过动态。缺少授权不得上传；机器和人工逐图初检未通过不得签发准备包。
