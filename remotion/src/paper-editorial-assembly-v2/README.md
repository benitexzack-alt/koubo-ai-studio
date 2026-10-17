# 纸媒叙事装配 v2：确定性候选测试片

这是一个完全本地、无外部素材、无付费调用的 Remotion 风格候选。它只验证“纸媒材质 + 多层编辑构图 + 连续因果装配”能否形成新的视觉母语，当前状态固定为 `candidate`，`productionEligible=false`。机器检查或成功渲染都不能把它升级为生产风格，必须由用户正常速度完整观看并明确接受。

## 画面结构

成片为 1920×1080、30fps、810 帧、27 秒，包含三个明显不同的语义世界：

1. **信号拆解**：左侧原始信号经过中央拆分枢纽，形成“镜头、证据、关系”三项视觉任务。
2. **证据关系**：分散材料、地图、时间轴先落位，红线再建立关系，最后才出现闭合印章。
3. **机制生长**：三类输入沿纸质路径进入处理齿轮，数据节点穿过机制，右侧微缩城市逐栋长成。

三个世界都满足：3–6 个物件组、至少三层空间、4–7 级连续装配、最终完成态停留。共享材质为纸纤维、整洁撕边、半调网点、暖米色描边和分层纸影；共享色锚为米白、墨蓝、砖红、芥末黄。构图、语义对象和动作链均为本候选新作，没有复用被否决片段、参考片品牌、照片、具体版式或镜头顺序。

## 自包含入口

为了不修改多人协作中的 `remotion/src/Root.tsx`，本目录提供独立入口：

```bash
cd /Users/pc/Documents/口播/remotion
npx remotion compositions src/paper-editorial-assembly-v2/entry.tsx
```

目标 Composition：

```text
PaperEditorialAssemblyV2Candidate16x9
```

## 机器契约检查

```bash
cd /Users/pc/Documents/口播/remotion
node src/paper-editorial-assembly-v2/test-paper-editorial-assembly-v2.mjs
npx tsc --noEmit
```

检查内容包括：候选不得自我晋级、不得拥有生产资格、三种语义世界、每段物件组/空间层/装配级数/完成态停留、无外部 URL、无媒体资产、无随机数和墙钟、无 CSS 动画或过渡。

## 渲染

```bash
cd /Users/pc/Documents/口播/remotion
mkdir -p src/paper-editorial-assembly-v2/artifacts
npx remotion render \
  src/paper-editorial-assembly-v2/entry.tsx \
  PaperEditorialAssemblyV2Candidate16x9 \
  src/paper-editorial-assembly-v2/artifacts/paper-editorial-assembly-v2-candidate.mp4 \
  --codec=h264 \
  --pixel-format=yuv420p \
  --muted \
  --crf=18
```

## 技术验收建议

```bash
ffprobe -v error -show_streams -show_format -of json \
  /Users/pc/Documents/口播/remotion/src/paper-editorial-assembly-v2/artifacts/paper-editorial-assembly-v2-candidate.mp4

ffmpeg -v error -i \
  /Users/pc/Documents/口播/remotion/src/paper-editorial-assembly-v2/artifacts/paper-editorial-assembly-v2-candidate.mp4 \
  -f null -
```

本候选刻意不含音轨，用于隔离视觉风格判断；后续正式链路仍要单独完成音效主观试听门禁。还需做黑帧、冻结、重复帧、连续性、文字/标识/伪界面检查，并由用户正常速度完整观看。机器检查通过不等于风格通过。

## 主工程接线（交由总任务处理）

如需在主 Remotion Studio 暴露此候选，只需从 `./paper-editorial-assembly-v2` 导入组件和四个规格常量，再在 `Root.tsx` 新增一个 `Composition`。本子任务不修改 `Root.tsx`，以避免覆盖并行工作。
