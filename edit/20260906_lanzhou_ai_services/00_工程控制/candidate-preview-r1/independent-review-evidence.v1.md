# 本条候选独立代码复核

审查者：independent-context-reviewer。实现者：Linnaeus（runner）及父任务（composition）。本审查者未修改这些实现文件。

结论：本次候选执行保持阻断，仅有一项P1：runner真实知识复检在只读沙箱内无法打开当前SQLite索引；不构成stills或render放行。

## 唯一阻断

- 位置：runner.mjs 第32至35行，validateKnowledge 调用；主命令第161行在preflight/stills/render之前必经此处。
- 实际行为：独立调用collectRuntime、当前permission校验、实际入口静态导入遍历后，调用真实validateKnowledge，进程退出1。
- 原始错误：`LOCAL_CHECK_FAILED`，随后是 `sqlite3.OperationalError: unable to open database file`。
- 调用栈：opc_rag.py 第1823行 validate_task_context → 第1188行 index_status → 第813行 meta_values → 第413行 `SELECT key, value FROM meta`。
- 当前脚本第362行设置 `PRAGMA journal_mode=WAL`，第811行使用普通 `sqlite3.connect(database)`。实际索引头部第18/19字节为02/02；目录检查仅存在101212160字节的opc_rag.sqlite3，没有-wal/-shm伴随文件。
- 原因研判：WAL连接初始化与runner `(deny file-write*)` 的全面只读策略冲突。确定事实是上述真实入口失败；未测试修复方案，也未放宽权限作绕过。
- 最小处理范围：仅使本条知识复检真实兼容受限只读环境，保留网络禁止、原库/原context不变、哈希复检和正式权限禁止。修复后重新生成runtime/request绑定，再复核真实validateKnowledge调用；不要求扩展系统。

## 本次绑定

- request：00_工程控制/candidate-preview-r1/request.v1.json。
- requestIntentSha256：3c92ccf6e95c492b405385a4dcc08f7296679b36c474bce20cb60ff350b68f8d。
- 父任务最终提供且request声明的runtimeSha256：35bc5b4a7f35ebe9c71aded1c5a6503f50e52d6882a5674fb490a3a92f1a76ba。
- 本次机器尝试在知识复检抛出异常后未打印完整runtime比对结果，不冒称其余整套preflight通过。后续如runtime改变，本回执不继承。

## 已读范围与不作的声明

已完整读取runner.mjs、runner-core.mjs、runtime/worker.mjs、runtime/network-probe.mjs、prepare-request.v1.mjs、225行runner测试源码，以及当前composition、入口、独立动效副本、字幕组件、本地字体组件、V8SemanticStage、styles和tsconfig。data与visual读取及35项静态消费比对见context目录既有回执，读取范围不扩写为原速听验。

代码约束本条固定入口、8393帧、960×540、H.264/AAC；禁止formal权限、外网、生成付费、路径穿越与覆盖已有输出；request意图及运行时、源材料、静态导入、公用素材、上下文与独立证据均有哈希绑定。除上述真实入口失败外，当前最小权限范围内未发现另一项P0/P1阻断。

父任务报告45/45 runner测试、tsc及9项视觉测试通过；本审查者只读测试源码，没有冒称独立运行了这些写临时夹具的测试。没有生成静帧或视频，没有试听，没有修改request占位sha。

五段纸艺已披露缺陷按本条用户决定保留，不重生不增费；13项ASR仍待核，不写语义/OCR/声音全通过。formalEnabled、productionEligible、cryptographicProductionAuthorization、userPreviewApproved、publishAuthorized始终为false。
