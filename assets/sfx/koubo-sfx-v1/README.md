# 口播本地音效包 v1

## 目标

这套音效只服务口播信息表达，不承担搞笑、情绪煽动或“为了热闹而响”的任务。Remotion 可以直接调用本地 WAV，不必再到剪映补音效。

## 来源与许可

- 来源索引：<https://www.remotion.dev/docs/sfx>
- 原始下载域名：<https://remotion.media/>
- 许可核验日期：2026-07-25
- 本包选用的 `whoosh`、`pageTurn`、`uiSwitch`、`mouseClick`、`shutterModern`、`whip` 在核验时均由 Remotion SFX 页面标记为 CC0。
- `confirm-soft.wav` 由本机构建脚本使用正弦波合成，不含第三方录音。
- 未采用许可说明不够明确的 `ding`。

原始文件保存在 `originals/`，成片实际调用文件保存在 `remotion/public/audio/koubo-sfx-v1/`。每次重新下载后都应重新核验当前许可和 SHA-256。

## 语义映射

| 文件 | 使用节点 | 默认 Remotion 音量 |
|---|---|---:|
| `section-air.wav` | 新章节、话题转折 | 0.08-0.12 |
| `card-reveal.wav` | 证据卡、图片卡出现 | 0.08-0.12 |
| `node-connect.wav` | 流程节点连线、因果关系建立 | 0.12-0.18 |
| `ui-click.wav` | 截图点击、界面操作确认 | 0.08-0.12 |
| `camera-shutter.wav` | 真实照片或证据截图定格 | 0.08-0.12 |
| `keyword-tick.wav` | 单个关键词、数字落点 | 0.08-0.14 |
| `confirm-soft.wav` | 验收通过、结果落地 | 0.08-0.12 |

## 固定纪律

1. 人声优先，音效不得盖住辅音和句尾。
2. 30 秒内默认不超过 5 个音效；普通字幕出现不配音效。
3. 同一句内最多一个音效，只落在章节、证据、数字、流程连接或确认节点。
4. 不使用网络热梗、夸张爆炸、硬币撒落、鼓掌和持续提示音。
5. 正式全片前必须输出同画面的“有音效 / 无音效”30 秒 A/B 预览，由人工听感确认。
6. A/B 未通过时不把音效铺进全片；可输出音效节点表，后续在剪映替换，但剪映不是必经步骤。

## 重建

```bash
./tools/build-koubo-sfx-v1.sh
```

构建结果统一为 48 kHz、双声道、16-bit PCM WAV。
