# R2冻结输入独立静态复核

结论：R2冻结输入静态复核通过，仅允许本地低清候选preflight/stills；不代表画面、动态、人耳、正式成片或公开发布验收，render仍须先经父任务静帧审阅。

## 发现与边界

- 未发现阻断本轮preflight/stills的P0/P1问题。
- P2：runner-core.mjs第315至328行核对审核身份、意图、runtime和有效期，但没有按review.allowedCommands过滤命令，也不读取fullRenderPendingParentStillReview。permission中仍允许render。因此本回执的preflight/stills限制是明确的审查与操作边界，不是当前runner程序强制门；父任务不得将这张回执当成跳过静帧审阅的render授权。本worker没有扩大写集去修改runner。
- 画面待核：官方内部焦点在2506帧切换，但c018扫描框/实录label从2450帧起生效；请留意2450至2505帧的框与标题是否发生干扰。当前是源码时序观察，不宣称实际画面通过或失败。62张计划静帧全部仍为未审阅。
- 26个附加声的静态对位不证明人耳可感知；最终混音峰值、完整解码及正常速度听验仍待实际小样。P03原声偏轻、13项ASR疑点和五段纸艺本条接受例外不变。

## 实际检查

审查角色为independent-context-reviewer-r2-resumed，实现角色为parent-r2-visual-public-runner；这是职责标识，不是平台签名。审查者仅写context和independent-review文件，未改实现或请求。

本轮实际运行context/independent-input-check.v1.mjs，退出0；结果时间2026-09-07T23:10:09.427Z。脚本SHA-256：721d062961c6d2f29ee9ba53ee96c65d569d54cc8a9d1ebc996162ffecc27bda。机器结果context/independent-input-check.v1.json，SHA-256：00845579778655007ff9cb59918192d421b5fa2739661e68e033178dd3067adc。

- 4份capture完整可解析，request.v1.json原始SHA为d14dc26ca058cdcbbf354d87c479b1a9a75da019ba8d3fb1b0aee1ed7365d0e5，检查前后不变；independentReview.sha256仍为null，交由父任务绑定。
- 使用当前requestIntentSha256函数重算得到eda2ae3ffe2b17c24ced57fdcca412a6e76394131fb9596a9963b515074d733a，与intent相同。
- 完整重采集实际安装文件、浏览器、原生工具、node/python及5个runtime文件，共10861项，与capture逐项一致；runtime SHA为f0649c76836fec6059a3757bd42d50e6a4104877873609cc9a2f3410c3ae5597。这是字节闭包核验，不声称逐行审过所有第三方库。
- 已实际阅读runner-core、runner、worker、network-probe、固定只读wrapper、R2 composition/entry与visual/public准备逻辑。固定R2入口、Composition、1920x1080画布和0.5缩放、8393帧、只许本地回环端口、清洁环境、沙箱写集和禁自动下载代码均保留；本轮没有执行沙箱动态探针或渲染，真实probe由父任务执行stills时产生。
- 51项输入当前SHA与request一致；AST收集9个本地导入，入口与JSON均有匹配的task_original_materials读取/应用证据。R1 data/captions只读，Shotcraft拷贝与共享源SHA一致。
- context taskId为opc-task-20260908-lanzhou-candidate-preview-r2-context-v1，SHA为c234a10b129da9d9d6f85997f269aeb5c141e2ac3e353453007d782b95678267；25条分组条目当前SHA一致，重要任务/context-ready状态正确。沿用本轮真实只读validate退出0、context-valid、problems=[]，未再次启动或重复校验；当前数据库SHA匹配代际且无WAL/SHM/journal旁文件。
- 22项public与permission/manifest一致，同dev/ino、非symlink；13个原资产加9个既有SFX。26个cue与visual.sfx深比较一致、全部来源SHA与最终视觉行帧窗匹配，源偏移/实际时长/淡出被composition消费；增益0.26至0.36，不落新闻或五纸艺保护区、不重叠、不连续同音、每音最多3次且同音间隔至少25秒。host/news/paper仍为1/0.62/0.1。
- selection v2全部15项componentProps及逐项wordFrames与visual一致；36语义、15效果、2开头词和9官方关键状态共62静帧，与planner重算一致。fullRenderPendingParentStillReview=true、allFramesReviewed=false保留。

## 下一步

父任务只将本审核JSON的SHA绑定回request，再执行preflight/stills。任何输入、runtime、context或索引代际变化都须停止沿用旧回执。静帧、动态和听验由父任务后续真实执行；formalEnabled、productionEligible、cryptographicProductionAuthorization、userPreviewApproved、publishAuthorized均为false。没有重新研究、生成稿件、重跑公共索引、改知识正文、日结、提交或发布。
