# Director V2 微信真实 E2E 候选预览

本目录只负责一条 45 秒、1920×1080、30fps 的 `candidate-blocked` 预览。它不注册到生产 `Root.tsx`，不接 RunningHub、H3 或其他付费生成接口，也不允许形成正式生产回执。

系统运行锁、内容寻址运行快照、独立回执签名器和导演验收信任根当前均未安装；系统验收锚点注册表也尚未接入。完整固定路径、哈希、权限、责任方、安装/撤销合同和稳定阻断码见 [SYSTEM-PREREQUISITES.md](./SYSTEM-PREREQUISITES.md)。该清单只供审查，不授权写系统目录或执行候选动作。

## 权威媒体与时间轴

- 完整录屏原片：`/Users/pc/Downloads/ScreenRecording_08-22-2026 15-36-53_1.MP4`，SHA-256 `0a992254195c91eefebec1f0a8d1f91263890ec2910169470ec377a02640937e`，274.243333 秒。
- 唯一受控录屏代理：`work/director-v2-e2e/20260823-wechat-geo-aao-candidate-01/preview/media/screen-full-0a992254-30fps.mp4`，SHA-256 `8e8a58c4e1b267350d623cf078b2ac3f6df22217d968e3080e4f08c86ec18e6b`，8228 帧、274.266667 秒、无音轨。
- 代理使用 `fps=30:round=up`，只在尾部多 23.334ms；逐点证据与 live 重抽验证见 `proxy-receipt.json`。
- 旧 189 秒 `screen-30fps.mp4` 来自非线性缩短链，全时间轴作废。旧 86–150 秒不得换算或复用。
- 口播画面和原声：`spoken-main-a098a9e9-30fps.mp4` 的 23.32–68.32 秒。
- 中文字幕：15 条 cue 全量读取 `candidate-media-contract.json`，并由验证器绑定 canonical cleaned transcript 的同一连续子串。仅有两处可由原音确认的识别纠错：“减肥切”→“减肥期”、“一个饭，评论”→“一个翻评论”。

## 九镜结构

候选按 `visual-semantic-contract.json` 固定为九镜：完整手机提问、四枚条件纸签、四个空轨位、四件材料逐项装配、回答卡、地图、门店入口与显式跳切、菜单、真人回场与店名降权问号。实录手机始终 `contain`；局部放大只是辅助阅读。132–142 秒加载、隐私和弹层不作为回答或菜单证据。

入口同时注册 `DirectorV2E2EWechat-Candidate02-WithSfx` 与 `DirectorV2E2EWechat-Candidate02-NoSfx`。两者使用同一组画面代码、媒体和时间轴，只由 `withSfx` 布尔值控制本地 CC0 音效轨。音效 cue 、媒体 SHA、许可和音量均绑定在 `candidate-media-contract.json`；完整 A/B 仍需正常音量人工试听。

## 当前只允许静态复核

本轮禁止运行 `build-media`、`preflight`、`stills`、`render`、裸 Remotion、live 代理验证或任何会生成媒体/回执的命令。系统前置文件全部 `absent`，所以任何候选动作都应 fail-closed。当前测试共记录 111 项结果，其中 16 项 `fixture-only` 只验证 schema/拒绝器形状，不构成真实运行或独立身份凭证；本轮有效机器证据只有 95 项拒绝负例。

未来即使系统前置安装完成，静帧也不会自动解锁：用户必须单独授权独立责任方安装系统前置，监督方必须再明确放行当前 candidate-only 静帧；两项授权互不替代。静帧生成后仍须监督方与用户人工审阅，才能形成不可由执行组自签的验收回执。

仓库内 wrapper 只能表达未来合同，不能自证真实执行。为避免可写仓库自行解锁，当前所有非 `selftest` 模式都在读取媒体/回执、写文件或启动媒体子进程前立即返回 `RUNTIME_SNAPSHOT_DELEGATION_BLOCKED`；直接执行媒体证据、代理证据、静帧验收和运行锁 live CLI 也分别以 `CANDIDATE_MEDIA_DIRECT_CLI_BLOCKED`、`CANDIDATE_PROXY_DIRECT_CLI_BLOCKED`、`CANDIDATE_STILL_ACCEPTANCE_DIRECT_CLI_BLOCKED` 和 `CANDIDATE_RUNTIME_LOCK_DIRECT_CLI_BLOCKED` 拒绝。

未来受控运行必须由仓库外、系统级独立 attestor 生成不可覆盖的执行证明，同时绑定预执行/后执行封印、所有工具与浏览器身份/SHA-256、完整参数、输入/输出 SHA-256、阶段结果和失败清理结果。仓库内 JSON、`wx` 文件或执行组自签都只是普通数据。顶层 Remotion 还必须有操作系统级、可核验的零外网/零付费证据，显式禁止 localhost 中继外联，清空代理变量、API 密钥和凭据继承。项目内 `sandbox-exec` 配置不是这份独立证明。

在系统前置与独立授权未来闭合后，也不会直接解锁这些仓库 CLI；必须由内容寻址、只读的系统启动器执行快照内对应动作，并由独立 attestor 签名。当前直接运行 `candidate-media-evidence.mjs build/validate`、`proxy-evidence.mjs build/validate` 或候选 wrapper 任一 live 模式都会稳定拒绝，不得产生回执、证据目录或媒体。

未来的 `render` 模式会在同一排他目录内生成 WithSfx/NoSfx 两条完整候选，并在同一份 v2 wrapper 回执中分别绑定 SHA。当前未获得系统前置安装授权、监督静帧许可或用户静帧验收，因此不得运行。

本地仓库写入者仍可能复制明文 gate prop 后裸跑 Remotion，因此这里不声称“直渲染在物理上不可能”。技术边界是：裸跑产物或伪造参数的产物没有与当前媒体、代码、依赖树、本地浏览器、publicDir、输出和独立验收锚同时闭合的 `director-controlled-candidate-wrapper-receipt/v2`，不能进入 QA、人工验收、交接或晋级。Remotion 命令固定 `--bundle-cache=false`，并固定使用已哈希的本地 Chrome；`node_modules/.cache` 明确排除在运行依赖树之外，不能用它证明当前运行代码。

## 当前状态

- `status=candidate-blocked`
- `productionEligible=false`
- `normalSpeedFullWatch=pending`
- `styleAcceptedByUser=false`
- 尚未生成 candidate-02 MP4；静帧也必须在全部预检通过后才能生成。
