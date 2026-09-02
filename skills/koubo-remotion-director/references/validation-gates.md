# 验证与交付门禁

## 视觉方案门禁

先运行当前生产档案校验：

```bash
node tools/validate-active-production-profile.mjs <production-job.json> doctor
```

新视频不是V8且没有完整用户降级批准时必须停止。该门禁对所有生产命令无条件执行，不能靠省略`experiment.id`绕过。

运行：

```bash
node tools/validate-visual-plan.mjs <visual-plan.json>
```

失败即停止渲染全片。常见失败：

- schema 或基线不匹配；
- 重叠组双标题；
- 素材路径不存在；
- 风险帧缺失；
- 时间段异常。

## 生成插片退役门与候选门

`koubo-paper-construct-v1`、`paper-construct-video` 和 `/user-generated-paper/` 已退役。视觉方案、V8 合同、生产命令、RunningHub 新任务和 QA 状态推进只要命中任一指纹都必须返回 `STYLE_RETIRED`；不能依赖 `producer` 或 `sourceType` 才检查。

旧 `纸媒叙事装配 v2` 保持 `productionEligible=false`；它的历史证据不得冒充当前 v3.1 的任务验收。在以下证据齐全前，只能做离线方案和一条受控动态压力测试，不能进入 V8 正式生产：

- 3—5 个创意方向及用户选择；
- 用户确认的 Brief、视觉节奏轨和分镜；
- 1—3 张预览；
- 每镜完成态静帧及用户确认；
- 静帧路径和 SHA-256；
- H3 实际请求中的图像字段与请求回执；
- 动态样片与参考片、批准静帧并排验收；
- 用户明确通过动态样片。

未来候选晋级后，联网报价仍不等于费用授权，也不创建任务。用户对当前 `planId`、镜头数和金额上限明确确认后，还必须把授权绑定到当前 `generationDefinitionSha256`，设置不超过 24 小时
的有效期，才允许执行 `run --confirm-paid`。每镜只允许一次付费记录；同一
`approvalId` 有固定消费回执，不能换账本或换计划复用。每个镜头提交前必须刷新剩余
镜头报价并重算单镜和累计上限；实际费用缺失、非法或无法对账时必须停止后续付费提交，
不得用预估金额冒充实际扣费。失败、超时或下载中断只能恢复与当前计划定义完整绑定的
同一 `taskId`，不得自动重试或静默加价。已有付费镜头后不得在同一账本中更换
`approvalId`；报价越界时保留证据并建立新计划版本，由人工裁决既有素材。

下载完成后运行：

```bash
node tools/qa-generated-video-plan.mjs prepare --plan <generated-video-plan.json>
node tools/qa-generated-video-plan.mjs apply-review \
  --plan <generated-video-plan.json> \
  --review <qa-report.json>
node tools/validate-generated-video-plan.mjs \
  <generated-video-plan.json> \
  --phase materialized
```

逐镜必须检查联系表、首尾帧、批准完成态静帧、2K 近似 16:9 视频、3—6 个物件组、至少三层、顺序装配、物体身份与形状稳定、接触连续、准确中文、字幕安全区和禁止元素。复杂解释镜至少达到 5—6 物件组、9—13 节点、三层和 5 级动作。逐镜视觉复核不等于最终用户验收。QA 必须绑定当前生成定义、visual-plan、风格卡、批准静帧、实际图像请求、逐镜视频和联系表哈希；旧 QA 不得复用。

V8 生产任务还必须：

- 写入 `inputs.generatedVideoPlan`；
- 图层显示 `AI生成·概念演绎` 与 `非真实业务证据`；
- 把生成计划、风格卡、金额授权消费回执、账本、视频、逐镜/全局联系表和 QA 报告全部加入
  `inputs.fingerprintPaths`；
- 在计划未同时达到 `qa-passed` 且通过 `materialized` 门禁时拒绝 `prepare`。

## 摄影级纸艺导演编译门

摄影级纸艺导演与上述退役自动插片链隔离。新任务必须使用全新 `candidate-preview-required` revision，并从当前 `director-request.v1.json` 实例化：

- 默认 `execution.mode=plan-only`、`productionEligible=false`；
- 绑定真实媒体、实录权威时间轴、当前 compiler、request-isolation registry 和 supervisor registry 的实际 SHA-256；
- `compile-director-plan.mjs` 生成的命令只能是 `validate-plan`，`samplePlan.outputs` 必须为 `null`；
- `emit-render-command.mjs` 对 plan-only 必须非零退出，且不能触发 Remotion；
- 旧 exact30 request、plan、QA、事故 revision、189 秒链、paper v1、G01-G04 和失败导演母版永久禁用。

只有新 revision 的完成态静帧、同画面精确 30 秒 WithSfx/NoSfx 候选、独立机器复核和用户正常速度确认全部齐全，才允许另建 `renderable` request。这个晋级仍不等于 V8 正式片授权；正式片继续经过现有 production job、director-contract/preflight v2 和用户完整观看门。

Skill 的既有 30 秒 WithSfx 用户验收只证明风格方向可接受。它不得被写成“新输入已复现”“production-ready”或“formal 已解锁”。

## 纸艺 v3.1 语义、文字与资产门

- 实录是拍摄后唯一正文。每个节拍和纸面节点必须声明字幕 ID 与起止毫秒，只在该窗口内检查实际词句；全文其他地方出现过同词不算通过。
- 画面结论不得比语义锨点提前超过 300ms，纸片动作与节点标签不得错开超过 3 帧。`mismatch` 直接失败；`partial` 必须有用户对本节拍的明确例外。
- 模型生成可读中文仍然禁止。运动纸片使用 Remotion `tracked-paper-surface`；低运动刚性纸片才能使用本地 `first-frame-baked`，且必须通过中文 OCR。
- 每个可读节点必须绑定纸片组、表面、入场阶段和四角透视。屏幕浮层只能承担标题或事实来源，不得完成纸面节点任务。静默截断和斜杠合并节点均为失败。
- 候选插片必须绑定 `sceneId + pairSha256 + textPlanSha256 + 正式视频SHA-256`，联系表只能按源计划顺序生成。替换视频、文字计划或证据帧后，旧联系表必须失效。
- 逐镜必须在静音观看时说清对象、关系或变化、与口播的一致性，并以首/中/尾三帧证明输入→动作→结果。“风格好看”、“大概对应”或只检查开头帧，都不足以放行。

## 预览门禁

V8 默认运行（脚本名保留V7.2只是兼容历史调用）：

```bash
node tools/run-v72-production.mjs <production-job.json> prepare
```

该命令先校验V8默认档案，再同时生成同画面有声/无声动态预览、完整分辨率风险帧和音频预检报告。

正式片前必须完成：

- 同一连续画面的30—45秒`WithSfx / NoSfx`视频对照；
- 覆盖所有`reviewAt`的完整分辨率风险帧；
- 用户正常播放确认人物、节奏、素材比例和音效听感。

检查：

- 字幕跟嘴；
- V4 卡片真实出现；
- 参考风格在画面中可见；
- 卡片、箭头、节点不裁切；
- 不挡脸、手势、字幕和关键信息；
- 全屏素材和信息卡不重复标题；
- CTA 不夸大、不违规导流。

## 字幕门禁

剪辑后字幕必须来自词级时间轴映射：

```text
输出字幕时间 = 原词级时间 - 当前保留片段起点 + 前面保留片段累计时长
```

双语字幕必须同段同窗。英文是辅助字幕，不得独立悬挂。

字幕文字还必须遵守实录优先：中文字幕来自原片实际声音，拍摄前文稿只能核对专有名词和遗漏；英文必须从确认后的实录中文翻译。新片运行：

```bash
node tools/check-spoken-source-policy.mjs \
  <实录转写.json> \
  <双语字幕.json> \
  <spoken-source-policy.json>
```

静默删词、顺句、改语序、压缩信息或恢复原稿都属于失败。事实性口误应由用户选择重录、剪除或更正，不能只改字幕。

## 正式片机器门禁

正式导出后检查：

- 分辨率、帧率、编码、音频；
- 完整解码；
- 字幕同步分；
- 关键帧视觉；
- release 记录。

封面图片仍由用户在外部工具生成，但封面提示词和完整发布包属于本 Skill 的自动化门禁；有音效正式候选片生成后必须同步交付。

运行：

```bash
node tools/validate-release.mjs <release.json>
```

## 音效可听性门禁（V6 及之后）

只要视觉方案承诺卡片、节点或转场音效，就必须从 `templates/04-sfx-cue-sheet-template.json` 建立本条音效点位表，至少记录：

- 精确秒点与对应画面动作；
- 音效类型：动态卡片弹出、节点连接、重点转场或金句落点；
- 音效文件来源、授权与实际音量；
- 人声是否始终清晰，音效是否抢话或被背景声完全掩盖。

V8 固定制作同画面 30—45 秒 `WithSfx / NoSfx` A/B 动态预览，并实际包含本条使用的主要音效类型；沿用旧音效库或音量策略也不得省略 `NoSfx`。新方案仍需用户在正常播放音量下完整试听并确认“听得见、不卡人声、不过响”。

正式片导出后，必须在音效点位表对应秒点逐项复听。以下证据只能作为辅助，不能单独证明音效完成：

- 总响度或峰值通过；
- 音轨存在；
- 代码中引用了音效文件；
- 波形中出现短促峰值。

用户没有实际听到约定音效时，一律按音效未交付处理；不得在 release、项目状态或回复中写成“音效已完成”。

## 数字运镜可感知门禁（V6 及之后）

只要正式片声明使用数字运镜，预览必须同时覆盖：

- 一个普通长句的轻推近或轻横移；
- 一个重点句的短促 `punch-in`；
- 一个运镜结束后稳定回落的画面。

机器侧至少对比运镜前、中、后三帧的缩放和位移参数；人工侧必须按正常速度播放确认“能感知、不过度、不压迫、不把脸和手推出安全区”。只看到组件引用、配置文件或单帧截图，不能证明运镜已交付。用户完整观看后认为画面没有运镜感，一律按运镜未交付处理。

## V8 正式片和历史母版回归门禁

预览通过后运行：

```bash
node tools/run-v72-production.mjs <production-job.json> formal
```

`formal` 必须使用 `WithSfx`，并自动完成两遍响度处理、完整解码、近纯黑帧、编码、帧率、采样率、综合响度和真峰值检查。

公共组件、运镜、音效路由、响度或渲染参数变化时，必须再对V7.2历史锁定母版运行：

```bash
node tools/run-v72-production.mjs workflow/jobs/20260730_cycle_assets_v72.production.json regression
```

回归必须同时通过风险帧 SSIM/PSNR、音效窗口相关性/误差/能量比、时长、综合响度和真峰值门禁。

## 封面提示词交付门禁

正式成片交付时必须同步提供一份可直接复制的封面提示词文件。提示词至少写清：主题、准确主标题、构图、上传真人截图的合成方式、背景、光线、色彩、画幅和禁用元素。

默认直接使用用户上传的真人截图作为封面人物主体，保持五官、表情、衣服和姿态不变，只做环境融合；不得写成“预留人物位置”，也不得让模型重新生成用户。封面提示词已交付不等于封面已生成或已通过用户验收。

每期提示词必须从 `templates/10-超哥AI创业记_3比4系列封面提示词母版.md` 实例化，保留栏目识别、标题三级结构、本期知识结构、蓝金路径、真实场景三层空间和统一禁止项。

## 透明贴片实验门禁

仅在用户或任务需要“给剪映/达芬奇使用的独立动画素材”时启用。

要求：

- 独立 Overlay Composition；
- 背景透明；
- ProRes 4444 或 4444 XQ；
- PNG 帧；
- `yuva444p10le`；
- 用 `ffprobe` 确认像素格式；
- 在棋盘格背景上复查 alpha。

透明贴片不是每条口播必做项，不得拖慢日常生产。

## 完成用语

- 只有方案：说“视觉方案已整理，待确认”。
- 只有预览：说“预览已生成，待人工确认”。
- 机器质检通过：说“机器侧质检通过，待完整观看确认”。
- 只有用户完整观看确认后，才说“这条口播成片通过验证”。
