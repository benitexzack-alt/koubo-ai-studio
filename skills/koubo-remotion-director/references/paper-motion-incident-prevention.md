# 纸艺动作事故修订

## 目标与边界

本修订针对2026-09-06五镜中反义流向、确认顺序不明、文字遮挡、带字牌折叠和标签消失。不是换成无字动画，不是用屏幕浮层补救，也不是把纸艺改成普通Remotion卡片。首帧仍交付带字图片，RunningHub只负责无字机构动作；主体文字留在独立固定支架上。

新请求必须声明 `policy.incidentPreventionVersion="1"`；当前活动档案不允许删除此标记来走旧验证器。已发布节目、失败中间文件和原验收记录不变。实录仍是拍摄后唯一正文。

## 生成前

每镜 `motionContract.schemaVersion="koubo-paper-motion-contract/v1"`：

- `meaning`：原句引用、观众应理解的含义、明确不能出现的相反结果。引用必须来自本节拍，语义理解仍需独立审阅，不能把字符串匹配称为语义证明。
- `parts`：逐件区分 `label` 与 `blank-part`，标签绑定唯一纸面和物件组，`mount=independent-fixed-stand`。固定标签使用 `first-frame-baked`、`enterStageId=initial`、`persistence=initial-to-end`、`firstReadableFrame=0`。
- `initialLocations / finalLocations`：每个无字部件的初始和最终位置。
- `allowedTransfers / forbiddenTransfers`：允许和禁止的对象流向；禁止流向带原句依据。不能把作废资料画进有效知识库，也不能通过中间节点绕过禁止终点。
- `requiredPredecessors`：有“确认后再发”等条件的镜头，显式绑定先后动作及依据。没有条件时允许空数组，但必须独立审阅确实不存在遗漏条件。
- `actions`：每个动作绑定ID、阶段、对象、操作、起止组、起止秒和运动包围区 `sweptRect`。运动区不得碰标签或字幕区。包围区是规划，不是生成画面已合规的证据。

用 `scripts/paper-motion-contract.mjs` 的 `renderMotionFirstFrame`、`renderMotionAction` 和 `renderMotionPrompt` 编译首帧、阶段动作及图生视频提示词，禁止另写一套相反关系。首帧的初始位置、固定支架与隔离关系直接来自合同，不再把一段自由机构指令与后置禁词拼接。禁止列表里的逗号不能使后面的“问题票滑入”逃过正向符号检查。

生成前还须独立检查“这套关系真的符合口播吗”，将结果写入 `motionContract.semanticReview={path,sha256}` 指向的只读机制审阅文件。文件类型为 `koubo-paper-mechanism-review/v1`、状态 `reviewed-mechanism`；绑定当前 taskId/revisionId/beatId/sourceScriptSha256、完整 sourceQuote 和 `sha256Json(paperMechanismSnapshot(scene))`，记录不同的 authorId/reviewerId、真实 reviewedAt、semanticRationale 与空 findings。`generationAuthorized/formalAuthorized` 必须仍为 false。改初态、正负流向或全部动作后，即使提示词重新编译且结构自洽，也必须重新审阅，不能继承旧机制锁。身份字段本身不证明审阅人真的理解语义；真实审阅来源与后续生产独立授权仍要保留，禁止自己伪造第二个名字签通过。

当前试点每次模型调用最多4个活动动作，总阶段1至7。复杂解释可以拆成多个短镜头，不再强迫每镜凑够4步。这个上限是本次保守试点限制，不是模型能力的统计结论；放宽须另做真实动态验证。带字表面运动或透视追踪不在本修订默认通路内，不能借旧模板静默启用。

可执行的结构示例见 `tests/fixtures/paper-motion-request.mjs`；它只在隔离测试中从事故原请求派生，不应当作新节目的内容模板复制。

## 交接和动态验收

### 2026-09-10：数量、空位与实体通道

新请求同时必须声明 `policy.physicalContinuityVersion="1"`，每镜增加 `motionContract.physicalContract`。它是导演规划的桌面毫米坐标，不是实拍测量，更不是生成模型已经遵守的证明。规范为 `koubo-paper-physical-contract/v1`，字段如下：

- `coordinateSystem=tabletop-mm`，`minimumClearanceMm>=1`。
- `inventory`：每个无字活动件唯一列出 `partId`、`quantity=1`、`unit=rigid-assembly`、运输姿态最大 `envelopeMm={width,depth,height}`。一叠纸作为一个固定组合，不按每页重复计数；固定标签不计入活动件。包络数值只用于跨组滑动，不声称已验算本组折叠、旋转的全部临时姿态；局部动作仍需投影动作区与真实动态检查。

### 毫米与画面联验

请求用 `policy.projectionRequiredBeatIds` 列出本次必须联验的镜头；该清单透传到计划及上下游提示词清单。列出的镜头缺失投影合同时，请求和清单校验都必须阻断；不可把未列出的历史镜头记为已覆盖。

不能把毫米物理合同和归一化运动区分别通过解释为两者兼容。使用确定性布局参考的镜头须声明`motionContract.projectionContract`，将同一完整运动包络投影成画面矩形，再加明确像素余量推导`sweptRect`；不准为了放入旧矩形缩小纸叠。跨组滑动使用起终对接点、运输包络及物理净空；局部转动须引用已声明的完整运动障碍包络，不得以单个起始姿态代替全程。

联验同时检查动作区、固定牌、字幕、内容区、支承面及跨组移动与障碍的投影关系。保守的障碍投影包围框不是实际人物轮廓，不得仅凭静态包围框重叠宣称已经发生三维碰撞；真实姿态、材质和动态仍须另验。未配置投影的镜头应明确为未做此项联验，不以兼容路径返回零错误冒充覆盖。

参数及动作区进入完整机构哈希。任何投影、物理包络或动作区改变，必须在新的导演修订中重算、重新独立审阅并编译，不能在执行批次中暗改已签请求。首帧清单携带完整`motionContract`和哈希；下游只能据当前合同制作参考并继续实际检查。
- `stations`：每个物件组恰好一项 `groupId/initialPartIds`。无活动件的组必须明确空数组；逐项与 `initialLocations` 对照。不能只写“同一叠纸在起点”，却允许其他站再摆一叠。
- `docks`：入口/出口的 `id/groupId/xMm/yMm/supportHeightMm/openingWidthMm/openingHeightMm`。正面字牌另在后侧独立支撑，不兼作通道挡板。
- `supports`：`id/xMm/yMm/widthMm/depthMm/topHeightMm`；`obstacles`：`id/xMm/yMm/zMm/widthMm/depthMm/heightMm`。如无障碍明确空数组，实际图像仍须检查有无生成未声明挡板。
- `transfers`：每次跨组滑动恰好绑定 `actionId/fromDockId/toDockId/supportIds`。当前最小实现只支持同高、同纵深的水平直线滑动；其他跨组机构必须先研究，不允许冒充水平通道。

验证器实际计算最大物件包络加净空、开口余量、两端同高、连续交接位置、承托面的并集覆盖和三维障碍相交。不能用一个包围大框代替中间有缝的支承面，也不能用 `passed=true` 代替上述数据。初态、四张固定牌、空工位和通道说明由同一合同编译到首帧及动作提示词；两份提示词不得另写矛盾机构。三层空间优先来自背景、人物和独立字牌，不靠输送台阶制造。

首帧清单保留完整 `motionContract`、`physicalContract` 及各自规范化 SHA-256，下游必须绑定当前实际图像记录：活动件数量与位置、各站空位、实际通道、支承高差和障碍。计划合格与图片观察合格是两道独立检查。图片通过后仍需正常速度动态验证。

历史兼容只限纯内存 `validatePreproductionRequest(..., historicalReadOnly:true)` 的旧字段回归；两个导出/签发 CLI 均不传此参数。删除策略、换旧 profile 或在 JSON 中自填同名字段，不能解除新请求必填要求。历史产物不重新编译、不补新回执；其旧动态批准不继承到新r2。

首帧提示词、带字图、文字表、OCR和图生视频提示词逐项绑定当前SHA。中文OCR必须覆盖全部标签并有非空结果；批准必须绑定实际图像集合。原图合格而写字失败时复用原图，不重新生成。

先完成最容易失败的代表镜动态试验，再放行本批剩余镜头。当前复用依据是完整动作合同SHA完全相同，不是“看起来像同一机构”；不同原句或审查绑定通常意味着逐镜独立试验，不能宣称已有跨镜自动泛化。每条通过的试验视频直接复用，不再为成批而重复生成；不同合同的下一镜用指定sceneId继续试验。静图批准不等于动态批准，上一节目通过不等于本批通过。外部提交、付费和重试仍需单独授权，不自动重试。具体CLI和验收索引见 `incident-handoff-state-integration.v1.md`。

验收必须从当前视频真实解码抽帧，核对动作前、中、后以及持续可读区间；逐节点OCR、独立静音复述和输入/动作/结果审阅都绑定视频及帧哈希。接触表只作索引，不能靠接触表三张图证明全程正确。镜头有过渡状态，既查最终结果也查过程是否反义。

`paper-motion-incident-registry.v1.json` 保存本次五个失败源SHA，只作拒绝回归，不作成功复用。用户对某一期容忍缺陷不等于效果合格，不能跨任务继承例外。

## 实录与生产

初始已写好的概念、动作强调和条件成立是不同时间。文字可见时间如实从0算；若其构成尚未说到的主张，必须调整剪入点、拆镜或停止，不能放宽300ms上限。未说出的文稿段落以 `disposition=omit`、`reason=not-spoken` 加完整实录审阅证据处理，不硬插素材。

首次候选只检查输入是否齐备，不要求一个尚未生成的候选已经通过；独立授权、签名、冻结清单、知识上下文和代码/媒体哈希照常检查。首次候选通行不等于正式授权。

状态推进必须检查回执正文、任务、修订、状态及依赖哈希。失败回执即使路径存在、哈希正确也不能晋级。代码回归通过只能记录本地合同测试通过；最终还需当前批动态审阅、用户正常速度确认及单独正式渲染授权。
