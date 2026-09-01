# 纸艺完成态首帧质量合同

## 一、逐图硬项

每项只能写 `passed` 或 `failed`，不得用总分掩盖硬失败。

1. `semanticMatch`：主物件、数量、方位、颜色和关系与提示词一致。
2. `paperMaterial`：纸纤维、纸厚、撕边或瓦楞结构可见；不是塑料、陶瓷或通用三维渲染。
3. `depthAndContact`：至少三层空间；存在前后遮挡、接触阴影和落地关系，无大面积悬浮。
4. `cleanTextAndBrand`：无可读文字、乱码、随机英文、Logo、水印和未经要求的数字。
5. `compositionAndReadability`：主体清楚、关系路径可辨、留白服务视线，静音看图能复述核心关系。
6. `videoReadiness`：主要物件可分离，适合后续 4—7 步装配；不存在严重粘连、缺件或形态歧义。

任一项失败，整图为 `revision-required`。

## 二、批次一致性

- 色彩锚点稳定，但不得把所有镜头锁成同一固定比例。
- 材料、镜位和构图应随语义变化；禁止连续单物件居中、固定俯拍、大留白。
- 同类物件跨镜身份稳定，例如机柜、任务卡、棉线、纸门和店铺纸模不应无故变形。
- 图片不得复制参考片品牌、照片、具体版式、镜头顺序或第三方素材。

## 三、样图通过标准

- 三张代表图六项硬项全部通过；
- 联系表与三张原图均已打开检查；
- 无串镜、重号、缺图或重复图；
- 用户明确确认视觉方向。

机器检查、代理初检和文件哈希不能替代用户的审美确认。

## 四、视觉复核文件

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
