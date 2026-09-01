# 乌兰察布纸艺提示词交接

本目录是 `paper-v3-r3` 的双提示词交接入口。

- `first-frame-prompts.v1.json`：只给首帧生图自动化读取。每个镜头使用 `firstFramePrompt`，输出文件名以 `outputFileName` 为准。
- `runninghub-image-to-video-prompts.v1.json`：图生视频机器清单。每个镜头使用 `imageToVideoPrompt`，并通过 `inputFirstFrameFileName` 绑定对应首帧。
- `runninghub-image-to-video-prompts.md`：供人工复制到 RunningHub 的中文版本，只包含图生视频动作提示词。

固定顺序：

1. 首帧自动化读取 `first-frame-prompts.v1.json`，生成 P01 至 P10 的图片。
2. 人工核对图片文件名与 `pairId`。
3. 在 RunningHub 选择同一 P 编号的首帧，再复制对应图生视频提示词。
4. 模型不得生成可读中文；节点文字由 Remotion 后期按 `postProductionTextOverlay` 叠加。

当前只完成提示词拆分与合同校验，未调用 RunningHub，未生成或验收图片、视频，也不具备正式成片资格。
