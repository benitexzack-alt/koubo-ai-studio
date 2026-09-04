# 本期受控首预览入口只读审计

> 任务：20260904-gpt6-cybercab
> 日期：2026-09-04
> 范围：记录本对话已完成的只读调查；不扩展调查，不运行生产命令，不修改工具、合同、注册表或共享门禁。
> 授权事实：用户已直接要求开始制作，并明确沿用 V8 准备预览。开工授权有效，不得重复要求用户确认“是否开始制作”。
> 当前结论：已获开工授权，受控入口接入待监督裁决；不是等待用户重新授权开工。

## 一、最短结论

现有代码有候选渲染机制，但在已核查状态下，没有本条可直接成功运行、手续闭合的合法首次候选预览入口。

这不是“同一份待渲染视频必须先验收”的简单循环。生产门区分上游导演候选合同验收与本条生产预览验收；但现有已验收 Skill 风格包不是该生产门要求的 v2 合同及交接回执，不能直接替代。当前 v2 独立信任根缺失、运行时引用的外部验收注册表为空；本条生产绑定也尚未在本次调查范围内闭合。

用户催促或授权开工不等于已经观看并通过尚不存在的预览。反过来，不能把实现接入问题转嫁为无限重复的用户开工确认。执行方应整理本条绑定，监督方应裁决可适用的首候选路径及其授权范围；在现有脚本不能接受这些凭证时，必须明确报告接入阻断，不能裸跑、伪造或偷偷改门禁。

## 二、已有真实凭证与适用边界

| 凭证 | 已核查事实 | 不能推出的结论 |
|---|---|---|
| 当前用户直接开工要求 | 已明确要求开始制作并沿用 V8 准备预览 | 不等于本条预览验收、正式渲染或发布授权 |
| 本条工程准备记录 | 剪后基准为 261 秒、7830 帧；已有素材对位和字幕准备稿 | 不等于生产 job、知识上下文或拍后重绑已通过 |
| 本条纸艺预拍回执 | `phase=pre-shoot`、`skillExecuted=true`、`status=validated-provisional-previsualization` | 不等于拍后时点锁定、本条六段动态素材验收或正式合同交接 |
| 历史 Skill 风格包交接 | 真实文件为 `koubo-director-skill-package-handoff/v1`，记录已验收的有声风格样片 | 不等于 `director-automation-handoff-receipt/v2`，不得继承为本条验收 |

本条记录：

- [工程状态](/Users/pc/Documents/口播/edit/20260904_gpt6_cybercab/00_工程控制/current-status.v1.json:53)：调查时 `postShootRebindComplete=false`。
- [预拍校验回执](/Users/pc/Documents/口播/edit/20260904_gpt6_cybercab/04_导演拆解/paper-v3-r2/director-validation-receipt.v1.json)。
- [字幕准备稿](/Users/pc/Documents/口播/edit/20260904_gpt6_cybercab/07_实录与字幕/中英字幕准备稿_待复听.v2.json:3)：`not-renderable-transcript-review-required`；94 页中 21 页尚未解决，不能改字段冒充复听通过。
- [工程准备回执](/Users/pc/Documents/口播/edit/20260904_gpt6_cybercab/00_工程控制/preparation-receipt.v1.json)：引用 `task-20260904T115343Z-8f0379d3`；调查时默认路径 `/Users/pc/Documents/个人知识库/.opc-rag/tasks/task-20260904T115343Z-8f0379d3/context.json` 不存在。该事实不排除父任务随后建立其他有效上下文。

历史交接证据：

- [项目接入回执](/Users/pc/Documents/口播/work/director-paper-editorial/20260826-koubo-director-paper-editorial-handoff-candidate-r1/integration-receipt.v1.json)明确为 `plan-only-integration-verified`。
- [原始 Skill 包交接](/Users/pc/Documents/口播-paper-editorial-director-delivery-20260824/work/director-paper-editorial/20260824-wechat-real-input/director-skill-recovery/dynamic-gate-01/render-authored-motion-ab-freeze-scope-sfx-energy-fix/acceptance/director-skill-package-handoff.v1.json)的实测 SHA-256 为 `a8370f79022369f4a4e8002601ef1dc257788946461edf12dd275227fb60d8ef`，与接入回执引用一致；其引用的用户风格验收和独立媒体复核文件也分别校验哈希一致。
- 原始用户风格验收记录的原话为“有声版通过，封装skill。”；记录同时保留 `sourceMessageId=null`，没有再次明确完整观看时长。不能补造消息 ID、观看证据或签名来满足 v2。
- 原始交接保留 `productionEligible=false`、默认 `plan-only`、新候选需新修订，明确旧样片不构成新输入复现证据。
- [上一条本地 AI 服务发布记录](/Users/pc/Documents/口播/workflow/releases/20260904_local_ai_services_v8_r1_v1.json:69)明确不声称经过受控 job 运行链。可参考其 composition 组织结构，但不能把它当作本条受控权限凭证。

以上是调查时点的文件事实，不替代父任务随后更新的绑定或另一任务正在进行的六段纸艺验收。

## 三、两阶段字段关系与代码位置

| 位置 | 实际规则 |
|---|---|
| [导演合同核心](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:1397) | 上游候选晋级需可审阅完整保真样片、技术 QA、用户风格验收及真实媒体绑定。 |
| [独立监督交接](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:1482) | 交接需独立监督回执，绑定合同修订、候选、QA、人工验收和 A/B 哈希；不能执行组自造。 |
| [生产入口上游合同检查](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs:473) | 要求通过真实文件校验的 `automation-handoff-eligible` 导演合同，合同 `productionEligible=true` 且 `formal.enabled=false`。 |
| [本条候选授权](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs:491) | 冻结/解冻回执须绑定本条 revision，候选阶段决策为 `approved-candidate-revision`，并经独立外部消息锚核验。 |
| [命令范围](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs:518) | `allowedCommands` 必须包含实际调用命令，不能借一次风格授权解锁全部动作。 |
| [本条首次预览状态](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs:525) | `productionGate.state` 与 `experiment.status` 为 `candidate-preview-required`；两处 `userPreviewApproved=false`，正式开关为 false。此时允许候选预览，不要求本条预览已被用户通过。 |
| [拍后绑定](/Users/pc/Documents/口播/tools/director-production-binding-core.mjs:121) | 新 job 要求 `phase=post-shoot`；预拍和拍后校验均须真实执行。 |
| [本条动态验收的阶段限制](/Users/pc/Documents/口播/tools/director-production-binding-core.mjs:177) | `currentTaskUserAcceptance` 在正式类命令阶段要求，不是该检查器对首次 `preview` 的先决条件。 |

因此，“上游导演样片已验收”与“本条预览尚待验收”可以同时成立；但普通 Skill 包交接与 v2 生产合同是不同 schema、不同证据链，不能混用。

## 四、信任根与空注册表的实际核验

### 实际路径

- macOS 独立信任根：`/Library/Application Support/KouboDirector/director-independent-ed25519-trust-root.v2.json`。
- 固定路径定义：[director-contract-v2-core.mjs:20](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:20)。
- 缺失与权限校验：[director-contract-v2-core.mjs:94](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:94)。要求固定普通文件、非符号链接、root 所有且组/其他用户不可写，并有有效独立公钥。
- 运行时固定引用的注册表：`/Users/pc/Documents/口播/skills/koubo-remotion-director/fixtures/external-acceptance-anchor-registry.v2.json`。
- 注册表读取路径定义：[director-contract-v2-core.mjs:24](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:24)；实际空数组：[注册表:6](/Users/pc/Documents/口播/skills/koubo-remotion-director/fixtures/external-acceptance-anchor-registry.v2.json:6)。

该文件虽然位于名为 `fixtures` 的目录，生产核心确实固定读取它。本次仅核验其配置和空状态，没有引用测试条目证明权限，没有生成或注入 fixture。

### 已执行的只读核验命令

工作目录为 `/Users/pc/Documents/口播`。下面等价展开本对话已实际执行的只读 Node 核验，不调用生产或渲染入口，也不写文件：

```bash
cd /Users/pc/Documents/口播
node --input-type=module -e '
import fs from "node:fs";
import {readDirectorIndependentTrustRootV2} from "./skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs";
console.log("liveTrustRoot", JSON.stringify(readDirectorIndependentTrustRootV2()));
const p = "skills/koubo-remotion-director/fixtures/external-acceptance-anchor-registry.v2.json";
const r = JSON.parse(fs.readFileSync(p));
console.log("runtimeReferencedRegistry", JSON.stringify({
  schema: r.schema,
  managedBy: r.managedBy,
  trustModel: r.trustModel,
  entriesCount: r.entries?.length,
  kinds: r.entries?.map(x => x.kind)
}));
'
```

实际输出：

```text
liveTrustRoot {"ok":false,"reason":"blocked-no-independent-ed25519-key：独立系统信任根尚未安装"}
runtimeReferencedRegistry {"schema":"director-external-acceptance-anchor-registry/v2","managedBy":"independent-supervision-only","trustModel":"ed25519-detached-entry-signature","entriesCount":0,"kinds":[]}
```

空注册表首先使回执无法命中独立消息锚；即便将来存在条目，仍需通过独立信任根和签名验证。单纯把一条 JSON 加入仓库不能形成有效授权。相关拒绝位置：[director-contract-v2-core.mjs:204](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs:204)。

## 五、为何没有当前可直接开跑的合法首预览

1. `tools/run-v72-production.mjs` 有低清 `preview` 能力，实际传递 `preview.scale`，但先经过 v2 生产门、拍后绑定和知识上下文校验。当前不是缺一个缩放参数，而是缺可被该入口接受的真实凭证。入口调用见 [319 行](/Users/pc/Documents/口播/tools/run-v72-production.mjs:319)，生产状态要求见 [430 行](/Users/pc/Documents/口播/tools/run-v72-production.mjs:430)，缩放传递见 [1118 行](/Users/pc/Documents/口播/tools/run-v72-production.mjs:1118)。
2. `skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs` 的 `preview` 同样要求 v2 上游合同和本条独立候选授权，不是 bootstrap 豁免入口；现有参数构造也不传递低清缩放。该包装器未调用新的拍后绑定检查器，属于检查覆盖差异，不构成绕开项目拍后规则的许可。
3. 纸艺 Skill 存在 `compile-director-plan` 的 `renderable` 候选机制，再由 `emit-render-command` 返回经复检的命令，不要求候选视频已经动态验收才能首次生成。但它需要真实新请求及独立监督的静态/素材依据；当前注册表仅有历史微信 exact30 锚，不能把本条预拍文件或旧确认直接套入。候选命令构建见 [compile-director-plan.mjs:4890](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/compile-director-plan.mjs:4890)，30 秒限制见 [5021 行](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/compile-director-plan.mjs:5021)，命令释放检查见 [emit-render-command.mjs:51](/Users/pc/Documents/口播/skills/koubo-remotion-director/scripts/emit-render-command.mjs:51)，历史锚见 [supervisor-acceptance-anchor-registry.v1.json:14](/Users/pc/Documents/口播/skills/koubo-remotion-director/registries/supervisor-acceptance-anchor-registry.v1.json:14)。
4. 旧 v2 E2E 首候选包装器 `remotion/src/director-v2-e2e-wechat/render-candidate.mjs` 当前对非自测动作明确返回 `RUNTIME_SNAPSHOT_DELEGATION_BLOCKED`，要求仓库外独立安装的不可变启动器和外部执行证明；不能拿它作急片旁路。见 [1641 行](/Users/pc/Documents/口播/remotion/src/director-v2-e2e-wechat/render-candidate.mjs:1641)。

本次不提供“现在可以成功开渲”的命令，不运行上述入口；代码机制存在不等于本条已经获准执行。

## 六、执行侧与监督侧的下一步责任

### 执行侧

- 保留用户已有开工授权，准确绑定原话和实际可定位的消息依据；缺失的消息 ID 不得臆造。
- 只为本条建立新 job/revision，绑定当前源片、剪辑决定、字幕、视觉方案、音效、composition、输出位置及文件哈希；旧 job 和旧事故修订不复用。
- 将父任务实际建立的 `knowledgeContext.taskId/contextPath` 绑定到当前 job；上下文要求 `important=true`、`context-ready`，当前 job 进入真实读取应用回执，复检须为 `context-valid`。代码见 [knowledge-context-production-gate.mjs:164](/Users/pc/Documents/口播/tools/knowledge-context-production-gate.mjs:164)及 [201 行](/Users/pc/Documents/口播/tools/knowledge-context-production-gate.mjs:201)。
- 完成本条拍后重绑，接收另一任务六段纸艺的真实验收结果，不复制或提前填写“已通过”。
- 对字幕未核、事实争议、素材权利等保留真实状态；如需允许仅供内部审阅的待核字幕候选，须由有权责任方裁决该范围并落实到受控入口能接受的合同，不能擅改为确认通过。
- 准备候选-only 的输入与授权清单交给监督方，不自行签发独立监督验收或系统信任凭证。

### 独立监督侧及有权系统责任方

- 先确认本条适用哪条合法首候选路径，明确仅预览、字幕待核范围、禁止正式发布及其他限制；不能把历史特例自动套入新任务。
- 若采用现有 v2 生产链，须提供可验证的上游 `director-contract/v2`、`director-automation-handoff-receipt/v2`，以及绑定本条 revision、命令、job/媒体/composition/门禁闭包的独立候选授权。
- 当前 v2 依赖的独立信任根和有效签名锚尚未闭合。安装信任基础属于单独的系统权限事项，用户开工要求不自动授权安装；执行组也不能通过自签或可写仓库文件自行建立信任。
- 若监督认为历史开发控制与现行急片流程不适配，应给出明确的单条接入裁决或另行批准的实现方案。本审计不替其变更规则、不修改共享门禁，也不声称一份普通监督说明就能让当前脚本通过。

### 用户确认边界

不得再次要求用户确认“开始制作”。只有确实新增且不能由既有授权覆盖的事项，或真实预览生成后的画面、字幕、风险内容验收，才提出具体确认。不能要求用户提前验收不存在的视频，也不能把正式渲染、发布、付费或系统安装暗含在已有开工授权中。

## 七、本次落盘边界

本次仅新增此文件。没有修改工具、合同、注册表、共享门禁或生产状态；没有运行生产、渲染、付费、外部上传、发布或 Git 提交命令。行号对应本次记录前的只读定位；既有调查结果不是本条端到端生产验证，也不证明父任务后续文件状态保持不变。
