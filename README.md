# koubo-ai-studio

AI 口播视频生产工作流：转写、字幕、封面、Remotion 包装、素材管理和镜头计划。

## 当前能力

- ElevenLabs 转写结果转 Remotion captions。
- Remotion 16:9 口播包装模板。
- 中文语义字幕分页，避免孤字和半词掉页。
- 9:16 抖音封面 still 模板。
- ImageTo / GPT 生图中转站接入校验。
- `shot-plan.json` 镜头计划机制，用于决定每段内容使用真人、真实截图、生图、视频素材或文字卡。

## 本地私密文件

以下内容不进入 Git：

- `.env`：API Key 和本机路径。
- `source/`：原始口播视频。
- `outputs/`：导出成片、封面和生成图。
- `edit/`：转写、验证截图和中间文件。
- `remotion/public/media/`：代理视频素材。
- `remotion/public/fonts/`：本地字体。
- `knowledge/source-materials/`：个人知识库原始资料副本。

## 常用命令

```bash
cd /Users/pc/Documents/口播/remotion
npm run toolchain
npm run render:preview10
npm run render:sample
```

```bash
cd /Users/pc/Documents/口播
node tools/check-image-api.mjs
node tools/generate-image.mjs --prompt "提示卡背景，不要文字，不要logo" --size 1536x1024
```

## 注意

真实素材、客户案例和生图提示词需要进入素材台账或 `shot-plan.json`，公开视频使用前必须确认来源、授权和证据等级。
