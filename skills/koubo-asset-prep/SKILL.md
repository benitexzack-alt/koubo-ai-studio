---
name: koubo-asset-prep
description: 为口播视频安全处理指定的本机或公网素材，提供人像/产品抠图、图片 AI 升清和视频 AI 升清，并生成可审计的处理记录。仅在内容已达到 ready-for-production，且确实需要透明 PNG、低清图片修复或 Seedance 等 AI B-roll 升清时使用；不得用于改写证据截图、伪造真实细节、替代 Remotion 排版或自动扫描无关目录。
---

# 口播素材预处理

把外部 AI 媒体处理限制在三个窄能力内：抠图、图片升清、视频升清。优先处理 AI 概念素材、授权图片和用户明确指定的素材；主口播、事实证据和原始素材保持只读。

## 硬门禁

1. 先确认内容状态为 `ready-for-production`。未达到时，只能运行 `doctor` 或 `--dry-run`，不得上传或付费调用。
2. 只处理用户明确指定且位于当前项目内的本机文件，或用户明确提供的 HTTPS 地址。不得扫描桌面、下载、证件、合同、财务和个人知识库。
3. 每次外部调用前说明：素材将上传到 each::labs 及其实际模型提供商，调用可能计费。只有取得本次明确授权后，才能同时传入 `--confirm-external-processing --confirm-cost`。
4. API Key 只能来自环境变量 `EACHLABS_API_KEY`，不得写入代码、Skill、日志、Git 或命令参数。
5. 原始素材只读。输出路径不得等于输入路径；已有输出不得覆盖。
6. `asset-class=evidence` 一律禁止 AI 处理。官方截图、聊天证据、合同、数据图和带有事实文字的截图保持原文件。
7. 真人图片升清默认关闭面部增强；不得借升清改变五官、服装、姿态、文字或现场事实。
8. 真人主口播不得使用 AI 补帧或生成式视频增强。视频升清优先只用于 `generated` 类型的 AI B-roll。
9. 输出只能作为素材候选。必须完成规格检查、关键帧/透明边缘检查和人工观看后，才能进入 Remotion 或 HyperFrames。
10. AI 处理后的素材必须写入素材台账和发布记录，保留模型、输入哈希、输出哈希、处理时间和人工确认状态。

## 能力选择

| 需求 | operation | 模型 | 默认用途 |
|---|---|---|---|
| 人物、产品或图标透明抠图 | `remove-background` | `eachlabs-bg-remover-v1` | Remotion/HyperFrames 分层合成 |
| 低清图片、AI 关键帧、授权旧图升清 | `upscale-image` | `topaz-upscale-image` | 改善全屏 B-roll 和透明素材清晰度 |
| Seedance 等 720P AI 视频升清 | `upscale-video` | `topaz-upscale-video` | 生成概念镜头进入 1080P 成片前的素材准备 |

不要调用仓库中的通用 `video-editing`、`auto-subtitle` 或声音 Skill：剪辑、字幕和音效继续由项目现有 EDL、ElevenLabs、Remotion 与人工门禁负责。

## 固定流程

### 1. 检查环境

```bash
node skills/koubo-asset-prep/scripts/prepare-asset.mjs doctor
```

`doctor` 只检查本机环境和密钥是否存在，不上传、不计费。

### 2. 生成离线计划

```bash
node skills/koubo-asset-prep/scripts/prepare-asset.mjs remove-background \
  assets/example/person.jpg \
  --output edit/generated/person-cutout.png \
  --asset-class person \
  --production-state ready-for-production \
  --dry-run
```

检查输出中的模型、输入类型、参数、路径和风险提示。`--dry-run` 不需要 API Key，不创建输出文件。

### 3. 取得本次授权后执行

```bash
node skills/koubo-asset-prep/scripts/prepare-asset.mjs upscale-video \
  edit/generated/seedance-v01.mp4 \
  --output edit/generated/seedance-v01-upscaled.mp4 \
  --asset-class generated \
  --production-state ready-for-production \
  --scale 2 \
  --h264 \
  --confirm-external-processing \
  --confirm-cost
```

脚本会执行：校验路径和类型 → 计算输入 SHA-256 → 请求预签名地址 → 上传原始字节 → 创建异步预测 → 轮询 → 下载结果 → 计算输出 SHA-256 → 写出同名 `.asset-prep.json` 记录。

### 4. 验收

- 抠图：检查头发、手指、透明边缘、残影和底部阴影。
- 图片升清：100% 放大检查五官、文字、Logo、纹理和边缘；出现虚构细节就弃用。
- 视频升清：用 `ffprobe` 检查分辨率、帧率、编码和时长；完整解码并抽查运动、手部、面部、文字和闪烁。
- 任何输出都先进入 `edit/generated/` 或当条项目的素材候选目录，不直接覆盖 `source/`，也不直接成为正式成片。

## 参数边界

- `--asset-class` 必填：`person | generated | illustrative | evidence`。
- 图片/视频升清默认 `--scale 2`；只有低清非证据素材才考虑 4 倍。
- 真人图片始终保持 `face_enhancement=false`；当前脚本不开放真人面部增强。
- 视频补帧默认关闭；只有用户明确要求且素材不是主口播/证据时才传 `--target-fps`。
- 视频输出默认遵循提供商编码；需要最大兼容性时传 `--h264`。
- 单次本机上传安全上限：图片 50 MB，视频 200 MB。

## 外部契约

需要核对模型来源、上游提交、API 上传流程、参数和隐私边界时，读取 [references/provider-contract.md](references/provider-contract.md)。接口发生变化时，先更新该参考和脚本，再做非隐私烟雾测试；不得在真实素材上试错。
