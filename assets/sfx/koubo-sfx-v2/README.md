# 口播本地音效包 v2

## 目标

这套音效只强化章节切换、信息卡、重点数字、流程节点、证据画面和行动确认。
普通字幕不配音效，人声始终是第一层。

## 来源与许可

- 来源：Mixkit 官方免费音效库。
- 许可页：https://mixkit.co/license/
- 音效页：https://mixkit.co/free-sound-effects/
- 核验日期：2026-07-26。
- 官方页面在核验时说明：Mixkit Sound Effects 可用于商业和个人项目，不要求署名。
- 每个原始文件的 Mixkit 编号、原始下载地址和 SHA-256 记录在 `manifest.json`。

许可可能变化。新增音效或长期复用前，应重新检查官方许可页，并保留当次核验日期。

## 语义分工

| 文件 | 用途 | 建议峰值 |
|---|---|---|
| `section-sweep.wav` | 新章节、案例切换 | -22 至 -18 dBFS |
| `card-slide.wav` | 大卡或全屏素材进入 | -23 至 -19 dBFS |
| `number-affirmation.wav` | 金额、人数、比例、时长 | -22 至 -18 dBFS |
| `node-select.wav` | 流程节点连接 | -24 至 -20 dBFS |
| `ui-click.wav` | 界面选择、轻量确认 | -26 至 -22 dBFS |
| `evidence-shutter.wav` | 证据截图、引用画面 | -26 至 -22 dBFS |
| `keyword-select.wav` | 单个关键判断 | -25 至 -21 dBFS |
| `zoom-out.wav` | 画面退出、回到口播 | -24 至 -20 dBFS |

## 固定纪律

1. 30 秒内通常使用 3 至 5 个音效；只有一个完整流程需要连续节点声时，最多 6 个。
2. 同一句话只保留一个主音效，不为每个字幕和关键词发声。
3. 禁止夸张爆炸、网络热梗、掌声、撒钱声和长时间提示音。
4. 音效峰值默认控制在 -26 至 -18 dBFS，人声目标仍为约 -16 LUFS。
5. 正式全片前必须输出 20 至 30 秒有音效预览，检查可听度、遮蔽人声和语义落点。
6. 静帧检查不能证明数字运镜和音效通过；必须播放预览，并做相邻时点画面差分和音频峰值检查。

## Remotion 路径

处理后的 48 kHz 双声道 PCM WAV 位于：

`remotion/public/audio/koubo-sfx-v2/`
