# 乌兰察布算力动画预制 R1

隔离入口：`src/wulanchabu-compute-prep-r1/index.tsx`

本目录只提供三组预拍动画组件和联系样片，不修改共享 V8 组件：

- `WulanchabuReasonsPrepR1`：绿电、自然冷源、低时延；
- `ComputeRentalPrepR1`：自建 GPU 与按需租用的总账比较；
- `ComputeValueChainPrepR1`：绿电到业务现场与人工验收的五节点路径；
- `WulanchabuComputeAnimationMontageR1`：20 秒连续联系样片。

预览中的右侧虚线区只是“真人安全区”占位，正式口播不显示。原片到位后直接导入三个组件，设置 `previewBackground={false}`，按实录时间轴挂载。

当前不包含口播字幕与正式音效：字幕必须来自实录，音效必须在正式视觉事件落时后逐点绑定并通过同画面有声/无声预览。

