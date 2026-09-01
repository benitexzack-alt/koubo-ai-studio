# 纸媒叙事装配导演验收

本清单区分“计划可追溯”“本地媒体技术通过”“风格达到参考维度”和“用户接受”四个不同状态。任何前一项都不能自动推出后一项。

## 1. 输入与编译

- [ ] 真实口播媒体、原始媒体、实录权威时间轴、参考片和风格卡都绑定当前 SHA-256。
- [ ] 所有字幕逐字来自实录权威时间轴，时间窗连续覆盖样片，无缺口或重叠。
- [ ] 每个镜头绑定原句、认知增量、进入/退出点和不可替代理由。
- [ ] 录屏片段绑定源入点、源出点、输出入点、输出出点、语义声明、`trimBeforeFrame`、`trimAfterFrame`、`playbackRate` 和完整覆盖输出窗的父层；隐私、加载、弹层等排除窗口没有进入画面。
- [ ] 编译器输出 `executionMode`、`stillPlan`、`samplePlan`、固定 `cwd + argv` 命令和全链 SHA-256；`plan-only` 不含任何 render/still 命令。
- [ ] `validate-director-output.mjs` 使用当前真实文件复验并以退出码 0 结束。

## 2. 完成态静帧门

每张静帧必须晚于共享完成模型计算的最后子动画完成帧，且对应场景在下一阶段或场景结束前必须保留至少 `fps` 帧（当前 30 帧）的完成关系锁定窗；随后才允许生成三张完成态和一张联系表。

唯一窄例外只适用于 `exact30 candidate-only` 的 canonical A：请求已绑定并通过 supervisor A acceptance，方法为 `progressive-local-assembly`，权威终态严格为 `A16 = F463`、`endExclusive = F473`。只有 compiler、validator、renderer 的判定一致，固定 acceptance registry 双 SHA 锚、验收与独立复核回执、17 态路径/顺序/帧及 A16 终态资产 SHA-256 全部匹配时，该镜头 completion 及其全阶段完成态 still 才可使用 10 帧锁定窗。9 帧仍失败；任何普通镜头的 29 帧仍失败。此例外只允许生成该精确 30 秒候选，不改变 `productionEligible=false`，不构成正式生产、自动化解冻、外部平台动作或发布授权。

随后生成：

1. 复杂多轨装配完成态；
2. 遮挡换态后的地图证据完成态；
3. 地图到菜单的事实边界完成态。

逐张人工检查：

- [ ] 复杂镜具有 5–6 个物件组、9–13 个可指认节点、至少 3 层空间、至少 5 级装配。
- [ ] 纸材之间有不同厚度、边缘、纤维、折痕、表面和接触阴影，不是同一卡片换色。
- [ ] 前景确实遮挡中景，中景确实压住后景；物件有落地关系，不悬浮。
- [ ] 直接播放的真实录屏保留完整比例和可读证据窗；确定性嵌入的真实证据绑定上游代表帧、裁切、光学处理、字体、脚本和结果 SHA-256；关键字、按钮、菜单没有被无理由裁掉。
- [ ] 真实机械镜能明确指出输入、唯一连续机械动作和对应输出；`occluded-state-reveal` 只能复述为遮挡换态，不得冒充机械关节动画。
- [ ] 没有内部 QA、版本号、秒码、候选状态、伪 UI、无授权品牌复刻或参考片原有素材。
- [ ] 与参考片 S12、S20、S21、S23、S25 并排后，不再呈现扁平 PPT/信息卡等级差。

任一项失败：状态保持 `candidate-stills-revision-required`，禁止开始视频。

## 3. 精确 30.0 秒 A/B 样片

- [ ] WithSfx 与 NoSfx 使用同一份计划、同一视觉组件、同一帧数和同一渲染参数。
- [ ] NoSfx 保留真实口播，只移除触感 SFX。
- [ ] 两片视频流 FrameMD5 逐帧一致。
- [ ] 两片都能完整解码；1920×1080、30fps、30.0 秒、900 帧及编码参数一致。
- [ ] 无意外黑场、白场、长冻结、重复帧、空纸闪屏或无意义抖动。
- [ ] 字幕文本、时间、遮挡和安全区通过；画面没有替用户提前说结论。
- [ ] WithSfx 的纸张、扣合、翻页、定位和压印落点与视觉事件对齐，正常音量可感知但不遮口播。
- [ ] A/B 由人以正常音量完整试听，不能用响度数值替代主观判断。

## 4. 参考并排

使用同一 1920×1080 联系表和正常速度视频并排检查：

- [ ] 材料复杂度、空间深度、遮挡、摄影感、微缩世界和装配密度处于同一视觉语言。
- [ ] 动作密度来自语义因果，不用随机位移提高数值。
- [ ] 完成态阅读层级清楚；复杂不等于堆满，留白承担视线引导。
- [ ] 参考片音频整数帧审计证据为提交 `a86d2ced9a648c8c8207cb60b137f9c2e1a31c85`、P75 `23/25=92%`、P90 `18/25=72%`；该结果不替代新样片风格判断。

## 5. 换输入、不改源码

- [ ] 第二条真实输入有独立媒体、实录时间轴、语义节拍、隐私边界和 SHA-256。
- [ ] 编译前后 compiler/validator/Remotion 资产 SHA-256 不变。
- [ ] 两份 request SHA、plan SHA、chain SHA 不同；场景物件、节点、原句、认知增量和命令路径随输入变化。
- [ ] 第二条仅做前向计划时不生成媒体，不沿用历史成片的 verified 状态。

## 6. 状态用语

- 只有计划通过：`candidate-plan-validated`。
- 三张静帧生成但未人工通过：`candidate-stills-awaiting-review`。
- 技术 QA 通过但未看完：`candidate-video-awaiting-user-review`。
- 用户正常速度完整观看并明确接受风格：`user-accepted-style`。
- 是否恢复正式自动化是另一项独立授权；本 Skill 不自动解锁 formal。

## 7. 用户验收落证

用户明确通过动态样片后，新建独立 `koubo-director-user-style-acceptance/v1` 回执，不修改已经生成的 request、plan 或机器 QA 回执。回执至少绑定：

- 用户消息所在任务 ID、原话与记录时间；
- 被接受的 WithSfx 绝对路径、字节数和 SHA-256；
- 同画面 NoSfx、request、plan、机器 QA 回执和独立媒体复核回执的绝对路径与 SHA-256；只通过 WithSfx 时，NoSfx 仅作为同画面技术对照绑定，不得写成用户也试听通过；
- 用户原话是否明确复述了正常速度、完整观看和实际观看时长；没有明说就如实记录缺口，不得补写；
- 接受范围与未授权范围；
- `productionEligible=false`、`formalAutomationUnlocked=false` 和 `externalPlatformAuthorized=false`。

回执从 [director-user-style-acceptance.v1.json](../templates/director-user-style-acceptance.v1.json) 实例化。用户风格通过只完成 `user-accepted-style`；自动化接入必须由独立控制面建立新 revision 和交接回执，不能复用事故 revision 或把本回执改写成正式生产授权。
