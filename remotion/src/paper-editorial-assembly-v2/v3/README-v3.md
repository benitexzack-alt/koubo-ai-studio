# 纸媒叙事装配 V3 候选

状态固定为 `candidate-blocked-reference-minimum`，`productionEligible=false`。本目录只是一条隔离的 30 秒风格测试片，没有接入共享 `Root.tsx`、口播自动化或任何生产入口；机器检查不能把它升级为风格通过。

## 输出

- 带音效：`artifacts/paper-editorial-assembly-v3-with-sfx.mp4`
- 无音效：`artifacts/paper-editorial-assembly-v3-no-sfx.mp4`
- 1.5 秒同帧联系表：`artifacts/contact-sheet-v3-1p5s.jpg`
- 三世界代表帧：`artifacts/frame-235.png`、`artifacts/frame-495.png`、`artifacts/frame-855.png`
- 两段逐帧转场条带：`artifacts/transition-a-to-b-strip.jpg`、`artifacts/transition-b-to-c-strip.jpg`
- 技术证据：`qa/`
- 候选 QA 回执：`qa-report.v3.json`、`qa-report.v3.md`

NoSfx 由 WithSfx 直接移除音轨得到，不重新编码视频流。`run-technical-qa-v3.sh` 会对两版画面生成 FrameMD5 并逐字节比较，确保 A/B 的画面帧相同。

当前本地技术回执（不含风格验收）：两片均为 `1920x1080 / 30fps / 900 帧 / 30.000 秒`，音轨数为 `1 / 0`，完整解码无错，视频 FrameMD5 一致，黑/白场与精确重复帧连续段均为 0。使用与独立恢复 QA 相同的 `freezedetect=n=-50dB:d=0.5` 时，最长合并冻结区间为 `1.100 秒`。带音效版实测 `I=-32.6 LUFS / LRA=9.8 LU / true peak=-15.0 dBFS`。这些数值只证明候选片进入人工试看/试听门，不证明纸材风格达标。

## 三个语义世界

1. 世界 A 使用宏观俯拍：输入信号落桌、分流轮压入、三路纸带长出、任务牌依次落位、三个节点到达终点并盖上完成环。
2. 世界 B 使用斜视证据墙：程序化半调“摄影感”剪纸、材料卡、地图和命题先落位，图钉与红线随后闭合关系。该图并非真实摄影资产，这是保留的阻断项。
3. 世界 C 使用低机位纸雕微缩系统：地台折开、输入盒升起、透视道路长出、处理拱门站立、数据包穿过机制、五栋多面纸楼依次升起并形成完成态。

三个世界都包含前、中、后景遮挡、五至十一层纸边厚度、顶部高光、接触阴影、纸纤维和完成态停留。两段转场各 20 帧，擦拭中保留前后语义锚边，并显示“信号 → 证据链”或“证据链 → 可见系统”的接力纸条，不使用连续近空白画面。

## 本地音效边界

音效只来自项目已有 `koubo-sfx-v1` 本地资产，时间点、语义事件、源清单路径和 SHA-256 记录在 `sfx-map.v3.json`。许可字段只转述本地清单在 2026-07-25 留下的核验状态，没有重新联网核验或扩张许可声明。首轮 30 秒版按人声混音默认值输出后只有约 -51 LUFS，已被独立 QA 判定为基本不可感知；本无旁白预览因此提高了试听增益，并改用可追溯的 `keyword-tick.wav` 作为最终回执音。未来叠加真实口播时必须重新压低并逐句避让，主观音效试听仍待用户完成。

## 复现命令

在 `/Users/pc/Documents/口播/remotion` 运行：

```bash
node src/paper-editorial-assembly-v2/v3/test-paper-editorial-assembly-v3.mjs
npx tsc --noEmit
npx remotion compositions src/paper-editorial-assembly-v2/v3/entry-v3.tsx
npx remotion render \
  src/paper-editorial-assembly-v2/v3/entry-v3.tsx \
  PaperEditorialAssemblyV3Candidate16x9 \
  src/paper-editorial-assembly-v2/v3/artifacts/paper-editorial-assembly-v3-with-sfx.mp4 \
  --codec=h264 --pixel-format=yuv420p --crf=18
ffmpeg -y -v error \
  -i src/paper-editorial-assembly-v2/v3/artifacts/paper-editorial-assembly-v3-with-sfx.mp4 \
  -map 0:v:0 -c copy -an \
  src/paper-editorial-assembly-v2/v3/artifacts/paper-editorial-assembly-v3-no-sfx.mp4
./src/paper-editorial-assembly-v2/v3/run-technical-qa-v3.sh
node src/paper-editorial-assembly-v2/v3/summarize-technical-qa-v3.mjs \
  > src/paper-editorial-assembly-v2/v3/qa/technical-summary.v3.json
```

## 仍然阻断

- “摄影感”证据是程序化半调插画，不是真实且可追溯的照片。
- 纸纤维、厚度和光影仍是确定性 CSS 模拟，不是实拍纸材。
- 参考片的编辑微细节、物件词汇和镜头复杂度仍更丰富。
- 本片没有口播，仅用五个音效事件示范语义触点，不能证明音画口播对齐。
- 用户尚未完成正常速度完整观看、音效主观试听和与参考片的并排判断。
- 因而不能标记为 `promoted`、`verified`、`production-ready` 或新母版。
