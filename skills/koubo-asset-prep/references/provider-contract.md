# 提供商与上游契约

> 核对日期：2026-07-19。接口、价格、存储期限和模型参数可能变化；正式调用前以 each::labs 当前模型目录和后台为准。

## 上游来源锁定

- 仓库：`https://github.com/awesome-genmedia/skills`
- 提交：`e4e641e21e59561fab7ab2bb7d90889e04aed84e`
- 许可：MIT
- 选取的上游能力说明：
  - `models/eachlabs-bg-remover-v1/SKILL.md`
  - `models/topaz-upscale-image/SKILL.md`
  - `models/topaz-upscale-video/SKILL.md`

项目没有注册上游三个通用触发器，而是通过 `koubo-asset-prep` 统一增加口播门禁、路径限制、上传确认、哈希记录和验收流程。上游示例只提供公网 URL 调用，不能直接构成本机口播素材的完整交付链。

## 现行 API

基础地址：`https://api.eachlabs.ai`

### 1. 预签名上传

`POST /v1/upload/presign`

请求头：

```text
X-API-Key: $EACHLABS_API_KEY
Content-Type: application/json
```

请求体：

```json
{
  "content_type": "image/png",
  "file_type": "image"
}
```

响应需要包含：

- `id`
- `presigned_url`
- `public_url`
- `required_headers`

随后对 `presigned_url` 执行 `PUT`，请求体为原文件字节，并原样携带 `required_headers` 和文件 `Content-Type`。上传成功后，把 `public_url` 作为模型输入。

### 2. 创建预测

`POST /v1/prediction`

```json
{
  "model": "MODEL_SLUG",
  "input": {}
}
```

现行 OpenAPI 将 `version` 标为已废弃并说明会被忽略，因此项目适配器不发送该字段，避免复制上游 Skill 中已经漂移的 `0.0.1` 示例。

响应的预测标识可能使用 `predictionID` 或兼容字段 `id`。脚本同时兼容两种写法。

### 3. 轮询结果

`GET /v1/prediction/{prediction_id}`

- 继续等待：`starting | processing | queued | pending`
- 成功：`success | completed`
- 失败：`error | failed | cancelled | canceled`

默认每 2 秒轮询一次，最多等待 20 分钟。成功响应从 `output` 中提取第一个 HTTPS 媒体地址并下载到项目内指定输出路径。

## 模型参数

### eachlabs-bg-remover-v1

```json
{
  "image_url": "https://..."
}
```

输出预期为带透明通道的 PNG。项目验收不能只看扩展名，必须实际检查 Alpha 和边缘。

### topaz-upscale-image

```json
{
  "image_url": "https://...",
  "upscale_factor": 2,
  "model": "High Fidelity V2",
  "face_enhancement": false,
  "output_format": "png"
}
```

当前允许的项目预设：

- 真人授权照片：`High Fidelity V2`，强制关闭面部增强。
- AI 图、插画和普通视觉素材：`Standard V2` 或 `High Fidelity V2`。
- 含事实文字或证据的截图：禁止调用，不使用 `Text Refinement` 猜测文字。

### topaz-upscale-video

```json
{
  "video_url": "https://...",
  "upscale_factor": 2,
  "h264_output": true
}
```

`target_fps` 会启动补帧，只能在非证据、非主口播素材上按明确需求使用。Seedance 等生成视频默认保持原帧率，仅做 2 倍升清。

## 数据与隐私

该链路至少涉及：

1. each::labs API；
2. each::labs 或其对象存储/CDN；
3. 实际模型提供商；
4. 本机项目输出目录。

官方公开接口说明没有给出足以覆盖本项目全部场景的统一素材删除时限和下游处理期限，因此项目按“外部留存未知”处理：

- 禁止上传证件、合同、财务、客户隐私、未公开聊天、密钥和内部后台；
- 未取得肖像/素材授权时禁止上传真人或第三方作品；
- 优先使用无隐私测试素材完成首次端到端验证；
- 不在日志中保存预签名 URL、API Key 或完整请求头；
- 输出记录只保存提供商上传 ID、模型、哈希、成本指标和本机相对路径。

## 费用与失败边界

- 费用按模型和输入动态计算，调用前必须再次查看后台余额和当次价格。
- `doctor` 与 `--dry-run` 不创建预测、不上传、不计费。
- 余额不足、模型变更、内容过滤、提供商故障、超时或输出不合格时，保持原素材不变并把结果标为失败。
- 技术成功不等于视觉合格；所有输出必须人工检查后才能写入正式视觉方案。

## 官方参考

- API 文档：`https://api.eachlabs.ai/v1/docs`
- API 总览：`https://docs.eachlabs.ai/api/overview`
- 背景移除：`https://docs.eachlabs.ai/models/image-editing/eachlabs-bg-remover-v1`
- 图片升清：`https://docs.eachlabs.ai/models/image-editing/topaz-upscale-image`
- 视频升清：`https://docs.eachlabs.ai/models/video-editing/topaz-upscale-video`
