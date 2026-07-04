# 生图 API 接入说明

## 当前用途

- 口播封面：根据标题、人物截图、参考风格生成 9:16 抖音封面底图或标题视觉。
- 提示卡素材：为视频中关键节点生成科技感背景、图标、截图包装。
- 图生图优化：把真实截图、手绘草图或封面初稿做风格统一。

## 需要配置

在 `/Users/pc/Documents/口播/.env` 填写：

```env
IMAGE_API_TYPE=openai-compatible
IMAGE_API_BASE_URL=
IMAGE_API_KEY=
IMAGE_MODEL=
IMAGE_EDIT_MODEL=
IMAGE_API_TIMEOUT_MS=120000
```

真实 Key 只放本机 `.env`，不要发到聊天里，不写入 Remotion 代码。

## 验证命令

```bash
cd /Users/pc/Documents/口播
node tools/check-image-api.mjs
```

## 生图命令

```bash
cd /Users/pc/Documents/口播
node tools/generate-image.mjs \
  --prompt "甘肃本地小微企业AI提示卡背景，真实商业纪录片风格，深色科技蓝背景，暖黄色重点光线，干净高级，适合短视频口播包装，不要文字，不要logo，16:9构图" \
  --out outputs/generated/ai-card-smoke-test.png \
  --size 1536x1024
```

常用尺寸：

- `1536x1024`：16:9 横屏提示卡背景。
- `1024x1536`：9:16 抖音封面或竖屏提示卡。
- `1024x1024`：方图测试。

如果中转站不支持 `/models`，但支持 OpenAI Images API，也可以继续接入；需要记录它的生图 endpoint、图生图 endpoint、请求字段和返回图片字段。
