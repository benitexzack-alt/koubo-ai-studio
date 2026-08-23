纸媒叙事参考片审计证据说明（2026-08-24 锁定版）

当前状态：blocked

原因：机器逐帧覆盖和视觉产物已可复现，但按锁定音频算法计算，25 个边界中只有 22 个在 ±100ms 达到全片频谱瞬变 P75，即 88%，未达已有 90% 门槛。不下调门槛，不把不同算法的 92% 与 72% 拼在一起。

一、输入身份

- 绝对路径：/Users/pc/Downloads/oMvzQBgiqE2X3ZNqAYQxEjIrfTAxvBANZDe9aF.MP4
- SHA-256：f172d6dc4831ce51bdecfe1359b1187666cad23c098c402edfc6836e3e553949
- 规格：1920×1080，30fps，110.154s，3304 帧
- 原片从未修改。
- 尚无发布页、作者身份、许可协议或授权回执，只允许内部研究可迁移机制；禁止复制品牌、照片、具体版式、镜头和素材。

二、唯一锁定算法

- 算法 ID：paper-editorial-reference-audit/2026-08-24-s16-center1024-v1
- 脚本：/Users/pc/Documents/口播/tools/audit-paper-editorial-reference.py
- 脚本 SHA-256：e5c99b58e5a6e5ff63d4f5686ad5c441ac24d0e7bbf29d77de38a32f73e17bd6
- 权威人工详细镜头表 SHA-256：d1620de6b9f34c8f290b9f334b77584acd2f857957d1fd780e26272e203c25c3
- 机器镜头表 SHA-256：9d3f38c483da172612c30217ea41c155dff5b9d746d757a526f5025ad6f6376a
- 产物清单规范 JSON SHA-256：039d0c3b5ae24ba75f2f43217a85bb20b9e0a53dc71457049cf532eaac098dca
- artifact-manifest.json 文件字节 SHA-256：e9a2e879d5f2995c2211a4e46f4e52ab48eff4df77d477b4f8e320cf7523e26d
- 审计定义规范 JSON SHA-256：7afc3b259bf6c36a1fa81044f348ce9657c61b204881dc38ab8c4383fc45ab4f
- audit-summary.json 文件字节 SHA-256：a23f1446c8ef22b846ee5b1874087e310087b5afd41189ec30831af7c4ed5c0d
- 视觉：FFmpeg 缩放为 320×180 RGB24；3304/3304 帧逐帧计算 Rec.709 亮度、256 档熵、水平/垂直边缘差、RGB 逐帧 MAD 和运动像素比。
- 音频：FFmpeg 解码为单声道 16000Hz pcm_s16le；每个 30fps 视频帧在 floor((frame+0.5)*16000/30) 处取居中 1024 样本 Hann 窗；使用归一化频谱正向通量。
- 音频分位数：nearest-rank，索引 ceil(n*p)-1；边界值为包含端点的 ±100ms 窗内最大频谱通量。
- 场景边界：lavfi.scene_score ≥0.20，0.50s NMS；97.600s 为人工复核确认的同色语义重置，在摘要中单独标注 provenance。

本次锁定环境：Python 3.14.6，FFmpeg/ffprobe 8.1.2，NumPy 2.5.0，Pillow 12.3.0，Tesseract 5.5.2，OCR 语言 chi_sim+eng。其他环境可重跑，但必须保留版本回执并逐字节比对核心产物，不得默认跨版本结果等价。

三、干净目录重跑回执

复现器：/Users/pc/Documents/口播/tools/reproduce-paper-editorial-reference-audit.py

- 复现器 SHA-256：1160670ae024c3d483cdad1517cb451bf889c4bce87fa3e5747789dba1340c8f
- 运行回执：run-receipt.json
- 运行回执文件字节 SHA-256：2514d9ec56a4e7a4c1334d74457171937f2a4905626504b8a6de94cc147ad011
- 运行回执定义规范 JSON SHA-256：7954b5dca5ae71be45653636211c2b648934a4d0e5ab114d864407611f902e66

本次回执记录的两个全新目录：

- /private/tmp/koubo-reference-audit-A-ovffkhoj/output
- /private/tmp/koubo-reference-audit-B-51ju133v/output

输出目录约定：每次独立复核必须使用全新空目录；非空目录时脚本默认拒绝覆盖。`--force` 只用于明确重生受控派生物，不得指向原片、人工镜头表或事故证据目录。

复现命令：

python3 tools/reproduce-paper-editorial-reference-audit.py --source '/Users/pc/Downloads/oMvzQBgiqE2X3ZNqAYQxEjIrfTAxvBANZDe9aF.MP4' --expected-source-sha256 f172d6dc4831ce51bdecfe1359b1187666cad23c098c402edfc6836e3e553949 --shot-table 'knowledge/evidence/paper-editorial-reference-audit-20260824/primary_shots_detailed.csv' --controlled-output 'knowledge/evidence/paper-editorial-reference-audit-20260824/reproducible' --receipt 'knowledge/evidence/paper-editorial-reference-audit-20260824/run-receipt.json'

回执同时固化了两次底层审计命令。两个 output 在起跑前都不存在，条目数均为 0；两次真实退出码均为 0，耗时分别为 19.658843s 与 19.199346s。两个目录各有 65 个文件，路径、字节数与每文件 SHA-256 全部一致，输出树规范 JSON SHA-256 均为 ad98a007ef7096a06d68ea848cc590f3fd07ff955444ac31ff7aa6a88d8a8b4a。受控 reproducible/ 同步后与 A/B 输出树完全一致。

锁定输出：

- 解码：3304/3304，100%
- 平均亮度：137.13737513705294
- 平均灰度熵：6.753509077380094
- 灰度熵中位数：6.841951721258566
- 平均边缘强度：7.504535650718309
- 边缘强度中位数：7.417417184722879
- 平均 RGB 逐帧 MAD：3.3393906463685994
- MAD P90 / P99：9.228049768518519 / 23.05431712962963
- 音频 P75：22/25 = 88%，阈值 0.45301510672728146
- 音频 P90：18/25 = 72%，阈值 0.5386591803737822
- 已有 P75 ≥90% 规则：false，blocked-reference-below-existing-threshold

四、受控产物

权威机器输出在 reproducible/ 下：

- audit-summary.json：算法、脚本 SHA、输入 SHA、覆盖率、边界、全片数值和 90% 失败回执。内嵌 definitionSha256 是加入该字段前的规范 JSON 哈希，不是文件字节哈希。
- artifact-manifest.json：绑定除自身和 audit-summary.json 外全部 63 个派生产物的路径、字节数和 SHA-256；audit-summary.json 再绑定该清单。内嵌 manifestSha256 是加入该字段前的规范 JSON 哈希，不是文件字节哈希；两者已在本说明和 run-receipt.json 分开记录。
- frame_metrics.csv：3304 行逐帧视觉指标。
- audio_frame_metrics.csv：3304 行逐帧音频窗指标。
- scene_scores.txt：3304 帧场景分数原始输出。
- probe.json：ffprobe 原始结果。
- primary_shots.machine.csv：机器分段、时间和代表帧路径。
- shot_reps/：26 张代表帧。
- candidate_pages/：25 组边界前各 3 帧、当帧、后各 3 帧。
- contact_pages/：每秒一帧的联系表。
- primary_shots_contact_sheet.jpg：26 段代表帧联系表。
- ocr.json：26 段均执行成功，1 段为空、25 段有输出但包含大量乱码或误识别。它只是导航线索，禁止用作字幕、语义结论或人工验收证据。

最终不可漂移锚点只包含 reproducible/ 这一套机器输出，不再把根层同步副本纳入提交。脚本正式运行强制要求 `--shot-table`，并验证 S01–S26 的 ID、起止时间和代表帧都落在对应机器分段内。

五、机器证据与人工证据分离

- 机器证据：reproducible/ 中的全部输出。
- 权威人工证据：primary_shots_detailed.csv，记录镜头语义、构图、材质、空间、动作链、转场、信息密度、音画关系与最低验收；其 SHA-256 被机器摘要和运行回执同时绑定。表内代表帧均指向受控目录，不再依赖 /tmp。
- 非权威 12 列便览投影不属于最终证据提交；审计脚本不读取它，不能替代或修改权威详细表结论。
- 人工逐镜复核不会被机器指标或 OCR 替代。

六、历史漂移隔离

- 三套 superseded-* 中间目录明确排除在最终证据提交之外，不能作为不可漂移锚点，也不得引用为当前结果。
- 03:18 的 92%/64% 属于另一算法；92%/72% 是两套结果拼接。两者都不是当前锁定结果。

计数口径：S01（0.000–0.100s）是 3 帧技术冷开闪回，不计入正常内容镜头。正常内容为 25 镜、24 个内部主边界、110.054s；含冷开异常的诊断口径为 26 段、25 边界、110.154s。
