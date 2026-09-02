# 兰州本地 AI 服务纸艺素材交接

## 首帧自动化输入

`first-frame-prompts.v1.json`

- 状态：`automation-input-ready`
- 镜头数：9
- 只含首帧静态提示词，不含图生视频动作。
- 原始首帧必须生成无字标签卡；中文由确定性写入流程补到 `*-first-frame-text-baked.png`。

## RunningHub 手动输入

- 机器清单：`runninghub-image-to-video-prompts.v1.json`
- 复制清单：`runninghub-image-to-video-prompts.md`
- 只含动作、顺序、镜头和禁止项，不重复首帧场景描述。
- 每镜输入必须使用对应 `*-first-frame-text-baked.png`，不能用未写入中文的原始首帧。

## 首帧批次

`first-frame-batch.v1.json` 已建立但尚未生图。代表性样图门为 P01、P05、P09；如由用户现有自动化一次性生成全批，仍需逐图做物件、纸材、空间、中文 OCR 和视频化风险检查。

## 当前边界

- 所有纸艺画面均为 `illustration-only`。
- 不得上传到 RunningHub 或产生付费，除非用户另行手动执行。
- 拍摄完成后必须按原片声音进行 `post-shoot` 重绑。
