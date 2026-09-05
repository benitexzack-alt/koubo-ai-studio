# V9.1 口播导演与生产顺序合同

## 目标

V9.1 固化一条单向、可检查的生产链。它解决四类重复事故：提示词没有独立交接、素材未齐便开始剪辑、预览未确认便进入正式渲染，以及 Shotcraft 靠人工找卡且验收经验无法复用。

V9.1 是下一条新口播的候选导演路线。V8 正式生产档案继续作为回退基线；在真实新片完成低清候选、独立检查和用户确认前，不把 V9.1 表述为已经通过正式生产验证。

## 固定顺序

1. `script-confirmed`：用户确认文稿。拍摄前文稿只拥有预拍权限。
2. `director-prompt-packs-ready`：导演同时交付并验证三套独立提示词：纸艺首帧、纸艺图生视频、AI 情景视频。此时尚无实录字幕，不得提前选择 Shotcraft。
3. `generation-handoff-ready`：逐镜声明执行者、文件名、时长、费用/登录边界和无需生成的镜头。
4. `asset-intake-passed`：原片与全部必需素材完成唯一映射、哈希、媒体探测、完整解码和人工内容核对。
5. `postshoot-rebound`：只用实际录音重绑字幕、节点、画面和音效；拍摄前文稿降为 `comparison-only`。Shotcraft 必须在此时绑定实录、素材盘点、全库能力索引和验收账本，自动检索 157 张卡并逐 beat 生成 `apply` 或 `not-needed`。
6. `candidate-preview-rendered`：只生成低清同画面有声候选，并完成风险帧、字幕、安全区、音轨、素材覆盖和 Shotcraft 实际应用回执检查。
7. `candidate-preview-user-approved`：用户按正常速度观看并明确确认；同时逐个已应用 beat 写入通过或否决案例和经验回执。
8. `formal-rendered`：才允许正式全片渲染和正式机器质检。
9. `release-package-ready`：正式片、真人截图、3:4 封面提示词、主标题与两个备选标题、发布文案、话题、审稿和 release 记录齐全。

公开发布不属于此状态机的自动动作，始终由用户另行决定。

## 三套提示词

- 首帧提示词只描述静态完成态、物件、标签纸面和机器可检查的安全布局。
- RunningHub 提示词只描述首帧之后的动作、顺序、镜头运动、文字保持和时长。
- AI 情景视频提示词只描述没有真实证据时的说明性演绎，必须标记 `illustration-only`，不得冒充真实事件。

三套清单即使某类为零镜头也必须生成合法空包，避免下游靠“没看见文件”猜测是否漏做。

## 失败与复用

- 某一层失败只回到该层的新 revision，不能覆盖旧回执或复用已否决产物。
- 首帧原图通过、只在确定性文字烘焙或 OCR 失败时，保留原图，不重新消耗生图。
- RunningHub 返回文件必须沿用 `sceneId + pairId + pairSha256`；通用文件名不能作为自动映射证据。
- 旧 189 秒链、退役 paper v1、失败导演母版和已被后续版本替代的 revision 永久排除。

## 验证入口

```bash
node skills/koubo-remotion-director/scripts/validate-v9-production-state.mjs \
  --state <v9-production-state.json> \
  --repo-root <project-root>
```

验证器会检查阶段必须严格连续、每阶段证据存在且哈希匹配、实录优先、正式渲染授权以及发布包顺序。
