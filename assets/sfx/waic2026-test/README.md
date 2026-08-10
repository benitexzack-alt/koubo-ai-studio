# WAIC 2026 V6 音效源测试

> 生成日期：2026-07-18  
> 工具：ElevenLabs Sound Effects API  
> 状态：接口和文件有效性验证通过；音色主观验收与人声混音尚未完成

## 文件

| 文件 | 用途 | 实测时长 | 原始峰值 | 成片建议 |
|---|---|---:|---:|---|
| `card-pop.mp3` | 信息卡弹出 | 0.680 秒 | -13.4 dBFS | 原始音量较轻，可从 -4 dB 增益起试 |
| `node-connect.mp3` | 数据节点连接 | 0.880 秒 | -1.5 dBFS | 原始峰值很高，混音先衰减约 14—18 dB |
| `section-whoosh.mp3` | 段落横向转场 | 1.080 秒 | -0.9 dBFS | 原始峰值很高，混音先衰减约 16—20 dB |
| `thesis-impact.mp3` | 核心判断低频落点 | 1.000 秒 | -16.0 dBFS | 仅用于 1—2 个核心句，避免连续使用 |

## 生成提示词

### 卡片弹出

```text
A clean premium UI card pop, soft airy click with a tiny digital sparkle, no music, no voice, short and restrained
```

### 节点连接

```text
A precise futuristic data node connection sound, two subtle digital ticks joining into one soft confirmation pulse, no music, no voice
```

### 段落转场

```text
A short cinematic technology transition whoosh, clean left-to-right air movement with a gentle digital tail, no impact boom, no music, no voice
```

### 金句落点

```text
A restrained low-frequency cinematic emphasis hit for a key statement, warm sub pulse with a soft glass shimmer, no trailer boom, no music, no voice
```

## 当前验证结果

- 四个 API 请求均成功返回 MP3。
- 四个文件均能被 FFprobe / FFmpeg 正常解析。
- 时长均落在预设范围。
- 原始节点音和转场音峰值过高，不能直接叠到人声上。
- 当前没有本期拍摄人声，无法验证音色是否抢话、响度是否舒服，也不能据此说“音效效果已经做好”。

## 明确禁止项

- `remotion/public/audio/waic2026-v6/correction-not-equal.wav` 不是 ElevenLabs 音效，而是 WAIC V6 从本人原片截出的事实口误纠正补丁，内容为“不等于”。
- 该文件只允许在 WAIC V6 历史时间线的原声纠错窗口使用，禁止进入任何音效包、动效角色或新视频混音。
- 音效打包必须使用本页四个 API 文件的显式允许清单，禁止按目录全量扫描后默认认定为音效。

## 拍摄后的硬门禁

1. 根据最终词级转写生成音效时间点，不凭脚本预估秒数。
2. 先制作 20—30 秒有声预览，必须覆盖：卡片弹出、节点连接、段落转场和一个金句落点。
3. 预览中人声始终是主角；任何音效一旦让人注意力离开口播，立即减量或删除。
4. 全片建议只保留 7—9 个可感知音效，不给每一张卡都配声音。
5. 用户主观试听确认后，才能进入正式成片；若仍达不到剪映 AI 音效的观感，就明确降级为剪映人工补音效。

官方接口说明：

- https://elevenlabs.io/docs/overview/capabilities/sound-effects
- https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
