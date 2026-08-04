# 口播音效 V3 试听候选包

这个目录只是下一条口播的试听候选，不是正式生产基线，不会自动替换 `koubo-sfx-v2`。

## 候选角色

- `soft-card-pop`：轻卡入场，2 个变体。
- `list-tick`：列表勾选，2 个变体。
- `line-connect`：线条或箭头连接。
- `number-settle`：数字计数完成和落位。
- `media-whoosh`：全屏媒体切入，2 个变体。
- `evidence-paper`：证据截图或纸张卡入场。
- `chapter-sweep`：章节切换。
- `cta-confirm`：结尾行动确认。

## 使用规则

1. 下一条只在代表性动态预览中试听。
2. 每个主视觉单元只触发一个主音效，字幕和普通小字不逐个发声。
3. 用户必须确认听得见、不压人声、不单调，候选文件才能晋升。
4. 来源、许可页、文件哈希和处理规格记录在 `manifest.json`。

## 重建

```bash
node tools/prepare-koubo-sfx-v3-candidates.mjs
```

脚本通过 Mixkit 官方下载弹窗解析实际文件地址，然后统一转为 `48kHz / 双声道 / pcm_s16le WAV`，并写回 SHA-256。
