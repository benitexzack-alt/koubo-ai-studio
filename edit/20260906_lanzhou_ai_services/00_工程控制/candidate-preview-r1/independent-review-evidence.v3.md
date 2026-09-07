# 本条候选独立代码复核 v3

审查者：independent-context-reviewer。实现者：Linnaeus（runner）及父任务（composition）。本审查者未修改被审实现文件。本轮复核时间为2026-09-07T15:35:00.106Z至2026-09-07T15:35:04.333Z。

结论：本条request.v3绑定的独立代码审查通过，仅允许既有permission范围内的本地低清候选stills/render；不构成formal渲染、成片验收或发布授权。

## 已消除的阻断

v1的真实SQLite打开错误已由本条runtime/knowledge-readonly.py解决。已独立完整阅读该修复：只接受绑定context及其SHA，固定原opc_rag.py与原配置；DB必须匹配context内当前代际SHA，禁止符号链接和-wal/-shm/-journal；以mode=ro、immutable=1及query_only连接，调用原validator main并保留原返回值；前后检查DB的inode/stat/SHA与context SHA。runner仍通过sandbox-exec禁止外网和一切文件写入，没有放宽DB写权限，没有修改共享validator。

v2在该真实入口正确报出index-not-current:stale，未被改写成通过。变化来源仅06_每日复盘/2026-09-07.md；随后官方增量index更新1份文件，full_rebuild=false。原v1 context/绑定及旧阻断证据保留，新context v2已真实start、validate并绑定request.v3。本轮未写daily。

## 本轮独立实测

实际命令：`node edit/20260906_lanzhou_ai_services/00_工程控制/candidate-preview-r1/context/verify-knowledge-v3.mjs`，退出码0。该脚本直接导入并调用当前runner.mjs导出的validateKnowledge，没有替代或伪造其返回。

- 当前runtime共10861个文件，完整计算结果与runtime-snapshot.v3、request.v3及既已审阅的v2字节闭包一致，runtime差异为空。
- request.v3与request.v2仅knowledgeContext和independentReview不同，未扩大入口、素材、权限、帧数、分辨率或静帧范围。
- 42项输入及permission共43个SHA均当前匹配，执行前后再次核对；9项静态导入闭合，entry与静态JSON data/visual均有当前SHA和真实retrieved/read/applied及非空应用说明。
- 当前validatePermission对preflight/stills/render均通过，权限文件未改变。
- 当前runner真实validateKnowledge返回context-valid、important=true、problems=[]、知识技术门formal_execution_allowed=true。此字段不等于formal渲染授权。
- DB前后dev=16777232、inode=26260840、size=101212160、mtimeNs=1788794932304147272、ctimeNs=1788794932304147272，全部一致；-wal/-shm/-journal前后均不存在。
- DB SHA：95dfb124b781b8bccff33e47b54372964a3f2fd3c665c9b23300f62e56cc4c9a，与新context绑定相同。request及context在复检过程中未变。

原始机器输出：context/knowledge-v3-independent-check.json。

机器输出SHA：0e3820951a0f010e83caefc1a6c52839a4180c117025ea393d435c66698c5ce2。

## 代码及语义审阅边界

沿用本worker此前实际完整读取的runner.mjs、runner-core.mjs、worker、network-probe、prepare-request及runner测试源码；composition、入口、ShotcraftEffects副本、字幕组件、LocalFont、V8SemanticStage、styles及tsconfig亦已读。该轮阅读记录见independent-review-evidence.v1.md；当前runtime及材料SHA复核证明未发生未读代码替换，本轮另完整重读knowledge-readonly.py。data/visual的实际阅读范围、35项静态消费检查和后续输入核验保存在context目录，不扩写为逐词听验。

本条固定入口LanzhouServicesV91CandidateR1、8393帧、30fps、960x540输出、H.264/AAC。代码限制本地输出路径和既有授权，禁止formal、外网、自动下载/生成/付费、路径穿越及覆盖已有输出，执行前后复检输入与runtime。副作用仅限runner按permission规定创建本条候选输出和隔离临时目录，原片/字幕/共享代码/全局签名root不写。除已真实消除的SQLite及索引过期问题外，本条最小权限范围内未发现尚存P0/P1阻断。

P01=视频_5、P02=视频_2、P03=视频、P04=视频_4、P05=视频_3。五段源片的已披露动作、遮字、消字、文字漂移及原声缺陷仅按本条授权接受，不重生不增费，不回填OCR或语义PASS。纸艺原声0.1增益与主持/新闻原声路径保留；13项ASR疑点继续保留。源码与机器检查不等于原速人耳听过或成片画面通过。

父任务报告tsc、9项视觉测试、45项runner测试、7项知识测试全绿。本worker没有冒称独立重跑这些测试；本轮独立执行范围为上述真实输入/权限/知识复检。

本worker未执行stills/render，未试听，未修改request.v3的review占位SHA。父任务需补reviewSHA后以该原request执行preflight与stills；实际沙箱执行探针、静帧可见性、完整有声小样与人工确认仍是后续门，不以本回执提前宣称通过。

## 严格绑定

- requestIntentSha256：911864f53f6ce093cc1fe1e8cecfa37394ef41c487f202801dc2f714776ca507。
- runtimeSha256：ed21cafce06b36a5f77ef8b24f8e692216ccf81346b3874c2a0489962f35ed6d。
- contextTaskId：opc-task-20260907-lanzhou-candidate-preview-r1-context-v2。
- context SHA：1b6ad721acb36a8d39ca7cbc2447597492c9b4aa4d0550b82b8be4cf6fba4883。
- permission SHA：71c8dd0bdffa32ec05b10a8ad9a0811f99a7ed15e563fbd372732b7d3cf0ab4b。
- 原request文件在补review前SHA：9049234318b05377b47d414a8ac7295dc19543c47c6027f1a5afdf0492159e7a；补review仅改变此文件SHA，不改变上述intent。

formalEnabled、productionEligible、cryptographicProductionAuthorization、userPreviewApproved、publishAuthorized全部保持false。此回执不可继承到其他episode、intent、runtime或正式job；任一输入或索引变化仍由运行时复检阻断。
