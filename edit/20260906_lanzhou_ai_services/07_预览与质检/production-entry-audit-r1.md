# 本条 V9.1 生产入口只读调查报告 r1

> 项目：/Users/pc/Documents/口播
> 对象：20260906_lanzhou_ai_services，新实拍低清候选
> 代码与系统状态复核时间：2026-09-07T09:13:13Z 起，本轮落盘前复核
> 状态：等待用户授权修复；父任务已询问单条范围许可，尚未收到确认。
> 执行边界：调查阶段只读；本轮唯一新增文件为本报告。未改工具代码，未生成修复合同，未运行渲染，未联网，未修改签名、信任根、共享组件或生产开关。

## 一、结论与证据等级

本条目前不能凭现成入口合法获得首个低清候选。三个实质阻点是：未说节拍没有省略合同、首帧烘焙标签与现有时序合同不兼容、生产 V2 首次候选存在先验收后渲染依赖且没有可直接复用的通用隔离入口。

- 已核验：当前源码、模板、预拍 r2 的 taskId 与 23 个节拍、生产入口调用关系、现有隔离入口的固定范围、独立信任根读取结果及验收注册表条目数。
- 用户/父任务提供的本条事实：原声结尾只到“可以来找我”，B23 整段未说；五段用户纸艺的烘焙标签从首帧全部可见。审计者未独立重听原片或逐帧观看五段素材，不能将这些输入改写为本报告自行完成的音画验收。
- 推导结论：按上述实录事实填写真实请求，当前校验规则不能支持省略 B23；首帧可见的后说标签若领先实录超过 300ms，则不能通过现行时序合同。
- 未验证：修复方案、真实新候选端到端渲染、媒体质量、用户完整观看、正式 V2 放行、新闻素材公开使用权。本报告不是独立渲染许可、人工验收回执、签名 grant 或 production passed。

## 二、当前入口与精确约束

### 1. 通用生产入口存在，但不是首个候选的免签入口

[tools/run-v72-production.mjs:301](/Users/pc/Documents/口播/tools/run-v72-production.mjs:301) 先调用生产 V2 前置门，再于第 319 行调用导演生产绑定门。脚本名是历史兼容名，不代表允许新片降级到 V7.2。

合同齐备后才适用的命令形式如下，未执行。`J` 须由父任务设置为实际新 job 的仓库相对路径；此入口拒绝绝对 job 路径，不能把占位符当作已存在的 job。

```bash
cd /Users/pc/Documents/口播
node /Users/pc/Documents/口播/tools/run-v72-production.mjs "$J" prepare
```

- `prepare` 调用体检、动态预览、完整分辨率风险帧及音频预检；仅动态预览使用子命令 `preview`。参见 [execute:1760](/Users/pc/Documents/口播/tools/run-v72-production.mjs:1760)。
- 低清参数来自 `preview.scale`、`preview.crf`、`preview.ranges`；`renderWithoutSfxComparison=true` 时同时形成同画面音效对照。参见 [renderPreview:1077](/Users/pc/Documents/口播/tools/run-v72-production.mjs:1077)。
- `doctor` / `--dry-run` 不能统称纯只读入口：门禁之后仍有运行报告写入逻辑，参见 [1819](/Users/pc/Documents/口播/tools/run-v72-production.mjs:1819)。本审计没有执行这些生产命令。

另有 [run-remotion-production-v2.mjs:79](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs:79)：

```bash
node /Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs "$J" preview
```

此入口同样先过 V2；它不消费 `preview.scale/ranges`。`--no-sfx` 仍使用同一个 `preview.output`，已有输出会被拒绝，不能直接连续调用覆盖。它不是规避完整 V9.1 流程的低清捷径。

### 2. 重绑身份和知识上下文是两种绑定

- 预拍 r2 请求：[director-preproduction-request.v1.json](/Users/pc/Documents/口播/edit/20260906_lanzhou_ai_services/04_导演拆解/v9.1-r2/director-preproduction-request.v1.json)。
- 预拍 r2 计划：[director-preproduction-plan.v1.json](/Users/pc/Documents/口播/edit/20260906_lanzhou_ai_services/04_导演拆解/v9.1-r2/director-preproduction-plan.v1.json)。
- `taskId` 为 `task-20260906T154937Z-69f6ebf8`。重绑请求须沿用该值，新建 `requestId` 和输出路径；旧 r2 请求、计划和真实历史回执保持原样。[postshoot-rebind-core.mjs:208](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/postshoot-rebind-core.mjs:208) 同时核对预拍请求和计划的 taskId，不能换成新 bootstrap ID。
- 新 bootstrap 只作本轮辅助上下文，不能冒充原导演链路。生产 `job.knowledgeContext` 则须独立满足当前知识门：项目路由正确、`important=true`、`context-ready`，当前 job 在 `task_original_materials` 中有当前 SHA-256、`retrieved/read/applied=true` 及应用说明，复检返回 `context-valid` 和 `formal_execution_allowed=true`。参见 [knowledge-context-production-gate.mjs:90](/Users/pc/Documents/口播/tools/knowledge-context-production-gate.mjs:90) 与 [152](/Users/pc/Documents/口播/tools/knowledge-context-production-gate.mjs:152)。
- 不能因辅助上下文有效，就声称生产 job 的上下文已有效；job 改动后旧读取哈希失效。

## 三、三项阻点与安全修复最小范围

### 阻点一：未说的 B23 没有合法 omit 表达

当前规则：[postshoot-rebind-core.mjs:228](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/postshoot-rebind-core.mjs:228) 从预拍全部 beat 建集合；第 239 至 303 行无条件要求正时长、非空实录、字幕 ID、窗口内原句和语义锚；[464](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/postshoot-rebind-core.mjs:464) 只接受 `visualDecision=keep`；第 470 至 476 行要求全覆盖且数量一致。

因此删除映射报 `POSTSHOOT_MAPPING_BEAT_MISSING:B23` / `POSTSHOOT_MAPPING_COVERAGE_INCOMPLETE`，空原句报 `POSTSHOOT_ACTUAL_LINE_MISSING:B23`，改 `omit` 报 `POSTSHOOT_VISUAL_DECISION_NOT_KEEP:B23`。`partialException` 只涉及对齐状态，不能免除这些要求。编译器 [508](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/postshoot-rebind-core.mjs:508) 也逐个预拍 beat 生成输出，没有省略输出分支。

最小修复建议，尚未授权：

1. 仅在新版本的重绑合同中增加“已说并保留”和“本次未说、不入输出”两种明确处置，仍要求 23 个预拍 ID 每个恰好出现一次。省略是保留来源账本，不是删除预拍历史。
2. B23 省略记录必须绑定当前原片、完整实录及末尾核验依据，说明实际结束位置；不得生成虚构原句、字幕 ID、零长假片段、补录或音效。不能把 B22 的“可以来找我”重新贴成 B23。
3. 编译输出和下游数量检查要区分全部处置记录与实际入片节拍；已说节拍继续接受原有严格时间与文字校验。未说内容不能因此自动变成一般删剪授权。
4. 若申请修复共享能力，最小逻辑范围是重绑核心的校验/编译、对应输出校验器、请求模板及聚焦回归测试；不改正式 V2 签名。核心范围分别为本节引用文件、[validate-postshoot-director.mjs:51](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/validate-postshoot-director.mjs:51)、[请求模板](/Users/pc/Documents/口播/skills/koubo-remotion-director/templates/director-postshoot-rebind-request.v1.json)、[现有测试](/Users/pc/Documents/口播/skills/koubo-remotion-director/tests/test-postshoot-rebind-contract.mjs)。共享 Skill 更新涉及锁/哈希失效时须另行按治理流程审阅，不能自行刷新锁即宣称获批。
5. 如果最终只授权本条隔离适配，不授权共享修复，应使用明确的新候选合同与独立审查，保留“现行 postshoot 校验不支持”的状态；不能伪造现有 schema 的 `skillExecuted=true` 或 `passed`。

### 阻点二：首帧烘焙可见标签不能伪填后续出现时间

当前规则：[postshoot-rebind-core.mjs:403](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/postshoot-rebind-core.mjs:403) 要求视觉进入片段时间窗；第 413 行限制 `anchorStartMs - visualEnterMs <= 300`；第 421 行限制 `abs(stageActionFrame - labelEnterFrame) <= 3`；第 429 至 434 行要求帧号与毫秒时间误差不超过一帧。不是动作与标签必须严格相等。当前没有 `first-frame-baked` 的独立校验分支，也没有可用的“只改语义标记便忽略已可见文字”例外。

最小修复建议，尚未授权：

- 先建立逐节点真实“首次可读帧”和动作发生帧证据，绑定视频 SHA-256、节点、采样时间及 OCR/人工画面检查。不能仅以合同声明证明画面时序。
- 对首帧已经可读的节点如实记录本地帧 0；后续强调、运动或音效不得冒充首次出现。若需要区分“首次可读”和“后续动作”，须使用清楚的新字段及独立校验，不暗改旧字段语义。
- 300ms 领先规则和实录真实性仍是约束。优先评估本条 composition 是否能在不扭曲机制、不遮错字、不改变原声的情况下真实安排可读时点；不能做到就保持阻断，提出明确的素材修订或本条政策裁决需求，不能自动豁免整组烘焙标签。
- 不改共享 `V72ProductionShell.tsx`、`V8SemanticStage.tsx`，不修改预拍 r2 来倒造通过，不覆盖五段原始导出。任何资产再生成、内容改动或政策例外都不在本报告执行授权内。

### 阻点三：首个低清候选与生产 V2 发生先验收依赖

[director-production-preflight-v2.mjs:510](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs:510) 在候选 `preview` 之前也要求 `director-contract/v2` 真文件校验通过、`lifecycle.state=automation-handoff-eligible`、`productionEligible=true`，同时合同自身 `formal.enabled=false`。

该生命周期本身要求可审阅候选、技术 QA、正常速度完整观看、同画面 A/B、人工验收和监督交接，参见 [director-contract-v2-core.mjs:1375](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:1375)。这不能充当“尚无任何候选时的第一次渲染许可”。

生产预览还须有本 revision 的 `approved-candidate-revision` 冻结授权，绑定 job 快照、导演合同、交接、媒体全集、运行图、composition 和门禁闭包，并包含具体 `allowedCommands`。参见 [preflight:530](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs:530)。

本机只读实查结果：

```json
{"trustRoot":{"ok":false,"reason":"blocked-no-independent-ed25519-key：独立系统信任根尚未安装"},"anchorEntries":0}
```

固定信任根路径为 `/Library/Application Support/KouboDirector/director-independent-ed25519-trust-root.v2.json`；读取器位于 [director-contract-v2-core.mjs:94](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:94)。现有注册表为 [external-acceptance-anchor-registry.v2.json](/Users/pc/Documents/口播/skills/koubo-remotion-director/fixtures/external-acceptance-anchor-registry.v2.json)，本次为 0 条。

人工回执须绑定授权用户、非执行组、真实消息、当前候选/QA/A-B 哈希、正常速度完整观看及有效期；监督回执还须来自与人工验收不同的消息并绑定当前合同快照和交接。二者需通过独立 Ed25519 锚点，不是执行组填写 JSON 即成立。参见 [1434](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:1434)、[1490](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:1490)。

最小修复方向是另行审批本条专用的候选前置许可和隔离入口，而不是修改上述正式链，详见下一节。修复代码许可、首次候选渲染许可、用户后验收、正式 V2 签名放行四者分开。

## 四、后续独立本条低清候选入口边界建议

以下全部是待用户裁决的设计建议，不是已有能力、已获授权或可立即运行的命令。

### 1. 将首次候选许可与候选验收分开

建议阶段为“本条输入和诚实重绑完成、独立代码审查、用户明确许可首次低清候选、隔离渲染、机器检查、用户观看”，而不是“先有已验收候选，才许生成同一候选”。

- 首次候选准入只要求渲染前能够真实存在的输入、授权和审查，不要求未来 MP4 哈希、用户看完本候选或 `automation-handoff-eligible`。
- 渲染完成后才生成输出哈希、运行回执、实际应用证据和机器 QA；用户观看后才产生接受或否决记录。所有后置字段初始为待完成，不填未来 `accepted`。
- 候选许可绑定且仅绑定 `20260906_lanzhou_ai_services`、本条新 revision、真实用户许可消息及本次代码/媒体闭包；正式 V2 仍独立冻结。
- 未说 beat、烘焙标签等输入合同问题必须先得到真实解决或明确批准的新合同表达。不能因新入口避免了循环，就顺带跳过这些内容约束。

### 2. 最小新增范围

仅建议新增本条专用候选请求、隔离 runner/校验器、独立 composition 入口、聚焦负向测试和本条输出/证据目录。不要先扩成任意视频的通用后门；具体新增路径清单须进入用户待批范围和独立代码审查，本文不预设它们已经存在。

候选请求至少绑定：episodeId、原导演 taskId、新 revisionId、当前辅助上下文引用、用户许可原话/消息定位/哈希、许可动作/时长/分辨率/次数/有效期、输入资产/字幕/重绑/素材入场/Shotcraft 决策哈希、entry/composition/publicDir、依赖和本地工具哈希、唯一输出范围、独立审查回执。

原导演身份不变；候选自身知识上下文验证应保留重要任务、项目路由、当前材料读取应用和哈希新鲜度要求。若尚无正式 job，不得伪造一个通过生产知识门的 job；需要本条候选请求对应的明确上下文合同。

### 3. 独立审查需要的真实证据

- 审查者与执行者身份区分，记录真实审查消息和时间；绑定被审代码及有序文件清单哈希，不能只有 `reviewed=true`。
- 检查本条原片、新闻插入、五段纸艺、字幕、B23 省略、标签首次可读帧、保护区、音轨归属、Shotcraft 选择是否与真实资产一致。
- 检查导入闭包、锁文件、本地 Remotion/浏览器、所有输出位置、覆盖/符号链接/路径逃逸拒绝和执行前后哈希复检。
- 检查没有网络/付费调用、环境密钥继承、远程资产或缺依赖自动下载；需要本机真实约束和拒绝测试，不能把配置文本当成 OS 级隔离已经验证。缺少可用的隔离能力就继续阻断。
- 聚焦负例至少覆盖：旧 grant 重放、不同 episode/revision、媒体或代码哈希漂移、未授权扩大时长/尺寸/动作、已存在输出、虚构字幕、省略已说内容、伪造标签时间、formal 调用和外网调用。

独立代码 review 只证明指定候选入口获准进行限定实验，不声称是正式 V2 的密码学生产授权。不得拿本报告代替这份尚未发生的审查。

### 4. 输出与正式 V2 的隔离

- 入口只接受固定候选动作，禁止任意 shell/额外渲染参数，禁止 formal/release/publish。首次默认限定明确的低清 A/B 范围；全长低清、额外重试或扩大范围须在本条新授权中明确，不从“开始制作”泛化。
- 输出进入本条独立候选目录，存在即拒绝覆盖；成功、失败与重试保留独立记录。保持 `formalEnabled=false`、`productionEligible=false`、`userPreviewApproved=false`、`publishAuthorized=false`，只允许标记待观看。
- 不伪造 `KOUBO_CONTROLLED_RENDER_*` claim，不伪造生产 V2 wrapper 回执，不伪造导演 `skillExecuted`。不删除/改写默认配置绕过门禁，不修改共享 V8、签名器、信任根、验收注册表、冻结注册表或旧 scoped pin。
- 若现行本地渲染配置拒绝隔离候选，必须将候选自身配置与入口边界纳入新的明确审批和代码审查；不得临时更换配置来假装现有生产入口已通过。
- 本条候选生成和用户接受，均不自动满足正式 V2。未来进入正式 V2 时仍按其原规则准备真实签名、交接和当前修订授权；独立信任根缺失时继续阻断。低清实验也不能直接冒充其要求的 `reviewable-full-fidelity-sample`。

### 5. 历史入口均不可借用

| 现有文件 | 已核验边界 |
|---|---|
| [Shotcraft run-local-preview.mjs:19](/Users/pc/Documents/口播/skills/koubo-shotcraft-library/scripts/run-local-preview.mjs:19) | 固定旧 entry、旧素材、旧 taskId 和 20260904 授权路径，不是本条模板。第 322 至 347 行的独立 review 绑定输入清单，明确 `cryptographicProductionAuthorization=false`。不能复制旧许可或换路径冒用。 |
| [微信 render-candidate.mjs:35](/Users/pc/Documents/口播/remotion/src/director-v2-e2e-wechat/render-candidate.mjs:35) | 固定微信候选；第 1640 行对全部实际动作无条件报 `RUNTIME_SNAPSHOT_DELEGATION_BLOCKED`，只有自测分支不同，不能把它当作可运行通用入口。 |
| [scoped-direct-export-core.mjs:17](/Users/pc/Documents/口播/tools/scoped-direct-export-core.mjs:17) | 固定 `20260904_gpt6_cybercab`、job、revision、composition 和清单摘要，不得复用或修改其 pin 为本条放行。 |

结论仅限当前检索并核对的仓库状态：没有发现可直接承接本条、无需修改共享文件且已经授权的通用候选 runner。新入口必须新授权、新代码审查、新输入绑定，不继承历史临时 grant。

## 五、本条最小材料合同与额外约束

| 现有模板 | 本条必须真实生成的材料 |
|---|---|
| [director-postshoot-rebind-request.v1.json](/Users/pc/Documents/口播/skills/koubo-remotion-director/templates/director-postshoot-rebind-request.v1.json) | 原片/实录/r2三件绑定、逐 beat 及节点实录锚、输出新路径。当前 omit 与标签能力缺口未修复，不能强行生成通过回执。 |
| [director-paper-asset-intake.v1.json](/Users/pc/Documents/口播/skills/koubo-remotion-director/templates/director-paper-asset-intake.v1.json) | 五镜唯一配对、原始导出与候选 SHA、完整解码、首中尾图/OCR、静音复述、输入-动作-结果、与资产哈希绑定的联系表；文件已到不等于验收通过。 |
| [auto-match-request.v1.template.json](/Users/pc/Documents/口播/skills/koubo-shotcraft-library/templates/auto-match-request.v1.template.json) | V9.1身份、实录字幕、全节拍、主画面和安全区、注册表/全库/能力索引/经验账本/组件当前哈希。由匹配器生成选择、匹配回执及经验检索回执。 |
| [application-receipt.v1.template.json](/Users/pc/Documents/口播/skills/koubo-shotcraft-library/templates/application-receipt.v1.template.json) | 候选渲染之后再绑定实际 MP4 SHA、所选 beat/effect/帧窗/注册组件；不能提前写入已应用。 |
| [director-contract-v2.template.json](/Users/pc/Documents/口播/skills/koubo-remotion-director/templates/director-contract-v2.template.json) | 仅用于未来正式 V2 所要求的真实候选、QA、A/B、人工验收和监督交接；不是首个低清候选许可模板。 |

新闻插入依据为 [opening-insert-plan.v1.json](/Users/pc/Documents/口播/edit/20260906_lanzhou_ai_services/04_导演拆解/开头引用_v1/opening-insert-plan.v1.json)：首句真实结束后插入 243 帧/30fps 的 8.1 秒视频，保留新闻原声，新闻期间没有主播旁白和主播小窗，音频尾部声明为 8.102993 秒。该文件仍是预拍补充计划，不是已经锁定的实录输出时间轴。须由父任务用真实首句边界处理媒体源时钟与合成时钟，不能把插入后的累计输出时间直接冒充原片实录时间。来源文字不能伪装成主播字幕给 Shotcraft 过门；公开使用权仍未核实。

V9.1 状态文件必须按顺序绑定生成交接、素材入场、实录重绑、Shotcraft 自动选择，再到候选及用户观看；参见 [v9-workflow-state-core.mjs:7](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/v9-workflow-state-core.mjs:7)。仅在状态文件中补齐路径/哈希，不证明各合同内容已经通过。

## 六、核查快照与下一步

以下 SHA-256 用于定位本报告所读版本，不是批准、签名或可复用 grant。路径均以本报告开头的项目根目录解析。

| 文件标识 | SHA-256 |
|---|---|
| run-v72-production.mjs | b2c3104a8b309dd00b5c890ad4ae6461d5018a75a6ed6c1a1bbb7995131e9d2d |
| knowledge-context-production-gate.mjs | 0b76f395c26e247cd2945d3e145f9dd792b768bb15fec9d36072d5ecf616db68 |
| director-production-binding-core.mjs | 92a08db1504c90ad551dbf432e82a46003692a20e8c9826d1bc609ab404fbe16 |
| postshoot-rebind-core.mjs | 2ba40a856432c1d5bca12af2cc1734dca49ad24a31a84f47b8669e13451949c0 |
| director-production-preflight-v2.mjs | f67a4aa00c276732efd8b3161822b18fdcd18b7a31b0b63b9d72c988d14a0466 |
| director-contract-v2-core.mjs | 57555858f6f757c5054e7b3690981058bcd9cc8083e20ccf4a38748353d21806 |
| Shotcraft run-local-preview.mjs | b4508b875b8711781cbd16eb792cb25033bc4c56cf4d5cb89a9dfdc8601da7d6 |
| 微信 render-candidate.mjs | a83506866f9110f9267e1f9c2487609542fa7ddc09bace9a5c2e1172f182391c |
| 本条 r2 director-preproduction-request.v1.json | fc0ad9d3b46453f89d8519b648001e5ccbfc73c40ee054b325138deb614e13f6 |
| 本条 r2 director-preproduction-plan.v1.json | 3f12440f9d6baaa907e240d3451b5783fc282d94d77a406e23654e780f2f3d2d |

下一步仅等待用户对单条范围修复的明确授权。若获批，先锁定允许改动的文件清单和候选动作边界，再实现、独立审查与验证；未经批准不改核心、不新增 runner、不渲染。不把本报告落盘称为生产问题已修复。
