# 候选动作系统前置清单

> 状态：`blocked-system-prerequisites-absent`
>
> 适用范围：`director-v2-e2e-wechat` 的 candidate-only `build-media`、`preflight`、`stills` 与 `render`。
>
> 本文只是不可执行的安装合同和 dry-run 核验说明，不授权 `sudo`、系统目录写入、信任根安装、静帧或视频渲染。

## 当前事实与证据边界

下列真实系统文件当前全部不存在，系统注册表也尚未接入导演核心。因此所有候选动作必须稳定失败，不得以项目内 fixture、仓库写权限或自签 JSON 代替：

| 系统事实 | 固定位置 | 当前状态 | 稳定阻断 |
|---|---|---|---|
| 独立运行锁 | `/Library/Application Support/KouboDirector/runtime-locks/sha256-524bc6d3b9c57c1deca378ad574a8b12f7d0d56d038c05b69cc91ad6159805ef.json` | `absent` | `RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED` |
| 独立 dry-run 验证器 | `/Library/Application Support/KouboDirector/attestor/bin/verify-runtime-lock` | `absent` | `RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED` |
| 内容寻址运行快照 | `/Library/Application Support/KouboDirector/runtime-snapshots/sha256-89c127e7c22882df529f957c2fc5dfacff8d773a11a98bc62a3f710dfd7cc889` | `absent` | `RUNTIME_SNAPSHOT_DELEGATION_BLOCKED` |
| 独立候选回执签名器 | `/Library/Application Support/KouboDirector/attestor/bin/sign-candidate-receipt` | `absent` | `SYSTEM_RECEIPT_SIGNER_MISSING_BLOCKED` |
| 独立不可覆盖尝试账本 | `/Library/Application Support/KouboDirector/attestor/receipts/candidate-attempts` | `absent-and-manifest-unreviewed` | `SYSTEM_ATTEMPT_LEDGER_MISSING_BLOCKED` |
| OS 级零外网/零付费执行器及证明 | 尚无经独立评审的可执行文件与 manifest | `absent-and-undefined` | `OS_NETWORK_ATTESTATION_MISSING_BLOCKED` |
| 导演独立验收信任根 | `/Library/Application Support/KouboDirector/director-independent-ed25519-trust-root.v2.json` | `absent` | `blocked-no-independent-ed25519-key` |
| 系统级验收锚点注册表 | 尚未由导演核心绑定固定系统路径 | `absent-and-not-wired` | `CONTROLLED_STILLS_WRAPPER_VALIDATION_BLOCKED` |

当前测试共记录 111 项结果，其中 16 项带 `fixture-only`，只能证明 schema 或拒绝器形状，不能证明真实系统前置存在、真实签名身份成立或候选动作可执行。本轮可作为有效机器证据的只有 95 项拒绝负例；它们证明已知绕过被拒，不证明正向动作可放行。

## 共用信任边界

- 独立责任方：由候选执行组之外的安全/运维管理员管理，执行账号不得兼任安装者、私钥持有人、验收锚点登记者或撤销审批人。
- 固定所有权：本文要求的系统目录和文件均为 `root:wheel`。只读目录为 `0555`，JSON/清单为 `0444`，可执行验证器和签名器为 `0555`；唯一例外是 attestor 专用尝试账本根，由 root 服务以 `0700` 排他写入。候选执行账号、组和其他用户均不得有写权。
- 运行锁信任键：未来 `keyId=koubo-director-runtime-root-2026-08-v1`，算法 `Ed25519`。当前仓库不再含可用于 live 正向验签的公钥常量，经独立评审的系统信任根公钥也尚未安装；因此 `SYSTEM_RUNTIME_TRUST_ROOT_NOT_WIRED_BLOCKED` 和 `SYSTEM_TRUST_ROOT_NOT_WIRED_BLOCKED` 必须保持。

- 导演人工/监督验收信任根使用独立 schema `director-independent-ed25519-trust-root/v2`，不得把运行锁公钥、执行组自选公钥或 fixture 公钥自动当成验收公钥。
- 验收锚点注册表使用 schema `director-external-acceptance-anchor-registry/v2`，必须由独立监督方签署和管理。当前导演核心实际读取的是项目 fixture：`skills/koubo-remotion-director/fixtures/external-acceptance-anchor-registry.v2.json`。该路径可由仓库写入者修改，不是系统信任事实，不能形成真实静帧验收、QA 或晋级证据。
- 建议的系统注册表目标路径是 `/Library/Application Support/KouboDirector/director-external-acceptance-anchor-registry.v2.json`。这只是待导演核心责任方评审并固定接线的前置合同；当前代码没有读取它，不得据此宣称已接通。

## 一、独立运行锁与 dry-run 验证器

### 固定绑定

| 对象 | 固定合同 |
|---|---|
| 运行锁路径 | `/Library/Application Support/KouboDirector/runtime-locks/sha256-524bc6d3b9c57c1deca378ad574a8b12f7d0d56d038c05b69cc91ad6159805ef.json` |
| 运行锁字节 SHA-256 | `524bc6d3b9c57c1deca378ad574a8b12f7d0d56d038c05b69cc91ad6159805ef` |
| 验证器路径 | `/Library/Application Support/KouboDirector/attestor/bin/verify-runtime-lock` |
| 验证器 SHA-256 | `ff57cb96aa27e115bca6bc1c10f01cb32a59af3df0b429fd404e98f5db52865a` |
| 运行锁 schema | `koubo-director-system-runtime-lock/v1` |
| owner/group/mode | 父目录 `root:wheel 0555`；运行锁 `root:wheel 0444`；验证器 `root:wheel 0555` |

运行锁字节 SHA、验证器 SHA、固定路径、运行快照路径、工具七元组、`node_modules` 清单、最小 `PATH`、`remotion/.env=absent`、候选签名器路径和 Ed25519 `keyId` 必须同时一致。只替换文件名、改 JSON 后重算自签哈希或临时传入别的路径都不成立。

### 安装与撤销合同（仅文档）

安装责任方是独立安全/运维管理员。经用户单独授权后，责任方应使用经过评审的离线安装包，在项目目录之外同卷暂存；先核对签名、固定 SHA、普通文件属性和目标父目录权限，再用原子落位安装。禁止由候选 wrapper、测试脚本或执行组首次生成真实运行锁。

撤销由同一独立责任方执行：先撤销对应 `keyId` 或运行委托，再把验证器/运行锁移出固定路径；如需换键或换哈希，必须走代码评审并更新固定常量，不能原地改写同一路径内容。本文不执行安装或撤销。

### 未来 dry-run 验证命令

以下命令只供系统前置获得用户单独授权、由独立责任方安装后核验；本轮禁止运行：

```bash
"/Library/Application Support/KouboDirector/attestor/bin/verify-runtime-lock" verify-action-runtime --dry-run
```

项目内 `runtime-lock-evidence.mjs validate-production` 不是独立验证器，当前必须以 `CANDIDATE_RUNTIME_LOCK_DIRECT_CLI_BLOCKED` 拒绝，不得把它写成未来正向命令。任一系统文件缺失、路径/SHA/签名/权限不符或独立 dry-run 非零退出时，稳定阻断码为 `RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED`。运行环境带代理、密钥或凭据变量时为 `RUNTIME_VERIFY_ENV_BLOCKED`。

## 二、内容寻址运行快照

### 固定绑定

| 对象 | 固定合同 |
|---|---|
| 快照根 | `/Library/Application Support/KouboDirector/runtime-snapshots/sha256-89c127e7c22882df529f957c2fc5dfacff8d773a11a98bc62a3f710dfd7cc889` |
| 全快照 manifest SHA-256 | `89c127e7c22882df529f957c2fc5dfacff8d773a11a98bc62a3f710dfd7cc889` |
| `node_modules` 文件数 | `10798` |
| `node_modules` 符号链接数 | `48` |
| `node_modules` 普通文件字节数 | `433475193` |
| `node_modules` manifest SHA-256 | `c9990be5552918a734d3724cd98aa800e6862155756e45c07e300b84f5b6c8d5` |
| 唯一排除项 | `remotion/node_modules/.cache`，必须在启动前保持不可作为运行依赖 |
| owner/group/mode | 全树 `root:wheel`；目录 `0555`；普通数据文件 `0444`；七个工具可执行文件 `0555` |

快照必须逐项绑定七个工具的相对路径、SHA-256 和字节数：`node`、`ffmpeg`、`ffprobe`、`magick`、`tesseract`、`sandbox-exec`、`python3`。符号链接本身及目标均归 `root:wheel`，只允许指向同一内容寻址快照内部；目标必须纳入签名清单。验证器必须递归检查整个快照，不能只检查根目录或七个工具。

最小 `PATH` 固定为：

```text
/Library/Application Support/KouboDirector/runtime-snapshots/sha256-89c127e7c22882df529f957c2fc5dfacff8d773a11a98bc62a3f710dfd7cc889/toolchain/bin:/usr/bin:/bin:/usr/sbin:/sbin
```

`remotion/.env` 的缺失状态属于签名合同；出现该文件时必须以 `RUNTIME_ENV_PRESENT_BLOCKED` 拒绝。代理、令牌、API Key、secret 或 authorization 环境变量不得进入验证与候选动作环境。

### 安装与撤销合同（仅文档）

独立安全/运维管理员从已签名离线包创建新内容地址，递归验证每个目录、普通文件和符号链接后原子落位；快照一经安装不得就地补丁、下载浏览器、写缓存或替换工具。任何变更都生成新的 tree hash、固定路径和独立运行锁。

撤销不改写旧快照：先撤销运行锁中的委托，再移除或隔离该内容地址。旧快照即使字节仍在，也不得被新候选复用。本文不执行安装或撤销。

### 未来 dry-run 验证命令

快照没有独立可绕过的项目内验收入口；必须由上一节固定的仓库外验证器递归核验。若快照未安装、树清单不符、委托未生效或 spawn 前后闭包变化，稳定阻断码为 `RUNTIME_SNAPSHOT_DELEGATION_BLOCKED`。

## 三、系统回执签名器与独立验收信任根/注册表

### 固定绑定

| 对象 | 固定合同 |
|---|---|
| 候选回执签名器 | `/Library/Application Support/KouboDirector/attestor/bin/sign-candidate-receipt` |
| 签名器 SHA-256 | `a02652f4c02dc0c276d6da7db8948ad93c9af59c5d7cf28d20dc6f097944ab20` |
| 导演验收信任根 | `/Library/Application Support/KouboDirector/director-independent-ed25519-trust-root.v2.json` |
| 信任根 schema | `director-independent-ed25519-trust-root/v2` |
| 当前注册表 | `skills/koubo-remotion-director/fixtures/external-acceptance-anchor-registry.v2.json`，仅 fixture，不构成系统证据 |
| 待接线系统注册表 | `/Library/Application Support/KouboDirector/director-external-acceptance-anchor-registry.v2.json`，当前代码未读取 |
| 注册表 schema | `director-external-acceptance-anchor-registry/v2` |
| owner/group/mode | 父目录 `root:wheel 0555`；签名器 `root:wheel 0555`；信任根和未来系统注册表 `root:wheel 0444` |

签名器私钥只能由独立系统服务持有，不能交给仓库、候选执行组或测试 fixture。有效执行证明必须在仓库外生成并绑定：预执行与后执行封印、完整参数、全部输入/输出 SHA-256、所有可执行工具与浏览器真实路径/字节 SHA-256、各阶段结果、输出 claim 与失败清理结果。撤销、失败与成功回执均使用唯一名称和 `O_EXCL` 或等价不可覆盖落盘。普通 `wx` JSON、完整重算 envelope、阶段 manifest 或执行组自签都无效。

不可覆盖账本的未来命名合同为 `<candidateId>.<mode>.<attemptId>.<startedAtNs>.<status>.attestation.json`；必须由系统 attestor 以 `O_EXCL` 或等价原子方式创建，成功、失败、撤销各自生成新文件，不得覆盖前次证据。账本根由 `root:wheel 0700` 的独立服务管理，落盘后单份证明降为 `root:wheel 0444`；候选执行账号无写权。安装包 manifest SHA 尚未经独立评审，所以当前稳定保持 `SYSTEM_ATTEMPT_LEDGER_MISSING_BLOCKED`，禁止伪造占位哈希。

文件名字段语法固定为：`candidateId` 匹配 `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`；`mode` 只允许 `build-media|preflight|stills|render|qa|revoke`；`attemptId` 为小写 UUIDv4；`startedAtNs` 匹配 `^[0-9]{16,20}$`；`status` 只允许 `success|failed|revoked`。任一字段含 `/`、`\\`、`..`、NUL 或不在 allowlist 均拒绝。账本由候选执行组之外的安全/运维责任方生成、安装、轮换和撤销；撤销只追加 `revoked` 证明和更新信任委托，不删除或改写历史成功/失败证据。未来 verifier CLI 与安装包 manifest SHA 尚未定义，所以当前没有可运行的正向验证命令，不得用仓库脚本代替。

顶层 Remotion 的零外网/零付费不得由应用自报。未来系统执行器必须在 OS 层禁止外网、禁止 localhost/本地代理中继外联，不继承 `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`/`NO_PROXY`、API Key、token、authorization 或付费凭据，并由同一独立 attestor 签名拒绝证据。当前尚无经评审的可执行文件和 manifest SHA，故必须保持 `OS_NETWORK_ATTESTATION_MISSING_BLOCKED`；不得为填表而伪造哈希或正向回执。

人工静帧验收与监督验收另走导演独立信任根和验收锚点注册表。信任根只接受 `managedBy=independent-system-administrator` 的激活 Ed25519 公钥；注册表必须由 `independent-supervision-only` 管理。两者缺一不可，且不得回落到项目 fixture。

### 安装与撤销合同（仅文档）

签名器、验收信任根和系统注册表由独立安全/监督责任方安装与管理。经用户单独授权后，责任方应离线核对可执行文件 SHA、信任根公钥指纹、激活/撤销状态和注册表签名，再按固定 owner/group/mode 原子落位。导演核心责任方还必须先把注册表读取路径从项目 fixture 迁到固定系统路径并接受独立审查；未完成接线时，即使系统路径存在也不得使用。

撤销时，独立责任方先在信任根/注册表将相关 key 或锚点标为 revoked，再停用签名服务并把固定路径移出；不得只删除项目 fixture 或改候选 JSON 冒充撤销。本文不执行安装、接线或撤销。

### 未来 dry-run 验证命令

当前签名器的受控 dry-run CLI 合同尚未定义，因此不能给出一个假定可用的正向命令；这本身保持 `SYSTEM_RECEIPT_SIGNER_MISSING_BLOCKED`。信任根在未来安装后可由导演核心做只读 dry-run：

```bash
node --input-type=module -e "import {readDirectorIndependentTrustRootV2} from './skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs'; const r=readDirectorIndependentTrustRootV2(); if(!r.ok){console.error(r.reason);process.exit(1)}"
```

本轮禁止运行上述命令。真实签名器缺失时为 `SYSTEM_RECEIPT_SIGNER_MISSING_BLOCKED`；OS 级执行证明缺失时为 `SYSTEM_WRAPPER_ATTESTATION_MISSING_BLOCKED`；验收信任根缺失时为 `blocked-no-independent-ed25519-key`；真实受控静帧 wrapper 回执未闭合时为 `CONTROLLED_STILLS_WRAPPER_VALIDATION_BLOCKED`。

## 动作授权与停止条件

系统前置授权、候选静帧授权和风格验收是三道独立门，不能相互替代：

1. 用户必须先单独授权独立安全/运维责任方安装或撤销上述系统前置；本轮没有该授权，也没有真实系统文件。
2. 系统前置全部安装并通过 live dry-run 后，监督方还必须复核当前候选闭包、95 项拒绝负例、字幕/语义/隐私和静帧清单，并明确放行 candidate-only 静帧。
3. 静帧生成后仍需监督方和用户人工审阅；未形成不可由执行组伪造的接受回执前，视频渲染、QA、交接和晋级继续阻断。

任一门未闭合时只允许源码与文档静态审计。fixture-only 结果、仓库内生成的 JSON、裸 Remotion 产物、技术 QA 或机器 OCR 都不能替代独立授权和人工验收。
