# R2 v1-v2最小差异复核

结论：R2代码与62静帧差异复核无新增P0/P1；当前context v2因日结再次并发改写而失效，暂不允许render。仅保留低清候选审查结论，formal=false，不代表动态、人耳或用户验收。

- 审查时间：2026-09-08T00:07:39.104Z。
- v2 requestIntent：`9a5eb05a335da2be2ac20a788ff49affa3f64bb86425db4eb183e657e3c4ff41`。
- 当前runtime逐文件机器校验仍为`f0649c76836fec6059a3757bd42d50e6a4104877873609cc9a2f3410c3ae5597`，与两版capture一致。不重述或重审历史研究。
- 51项绑定均核对当前SHA：49项同路径同内容；context-binding从v1替换为v2；coverage仅文件名升版，SHA和内容完全相同。入口、源码、visual、selection、public、SFX无变化。
- 22项public硬链接仍同设备同inode；26声卡与已审SFX输入SHA一致，host=1/news=0.62/paper=0.1，新声卡增益0.26-0.36。
- 24项知识读取输入SHA、原读取时间、范围和应用说明保持一致。v1没有被覆盖，未重读或伪造历史读取。

## 静帧

- 62张PNG逐项SHA、960x540尺寸及帧号与stills真实输出、父keyframe-visual-review和v2 coverage一致。
- 8页联系表实际独立查看完毕；58/2498/2610/6360此前已实际查看单图，本轮哈希确认未变。联系表审查不是62张单图逐张放大，也不是逐视频帧动态验收。
- 检查范围内未见新增溢出、挡脸或裁字。2498扫描线处于标题行间；2610官方原文“扎根用户现场”和底部实录文字分区清楚。
- 保留非阻断P2 `MARKER_PUNCTUATION_WRAP`：长marker句可能出现独立标点行或短尾行，如6360；文字完整，无新增遮挡。
- 13项ASR疑点不变，尚未人耳确认。P01-P05五段既有源片缺陷继续仅限本条、同SHA例外保留，不记录为QA通过，不继承至其他资产或任务。

## 当前执行阻断

- v2原始start/validate成功事实不变；本轮固定只读wrapper再次实际返回exit 1、`blocked-context-stale`，唯一problem为`index-not-current/status stale`。
- 变化文件：`/Users/pc/Documents/个人知识库/06_每日复盘/2026-09-08.md`，08:02:31 +0800改为20522字节。
- v2绑定时SHA：`0ffb072405ec78587150c05be8fd8f4ace0ab70ccd2a7ffdbbbddfe8a257cdfa`；当前SHA：`31210731bd3185c64d059152dabfbd698f3b2efdfd35efcb32eab9db7ff6a45b`。具体08:02写入任务未核实，不沿用07:19监督追加的归因。
- 没有重跑start、覆盖context、改request、修改共享工具或渲染。需先由父协调写入结束并恢复有效上下文，再绑定对应request作最小delta复核。

## 机器证据

- `independent-review.delta-check.v2.mjs`实际exit 0，结果`static-delta-passed-context-blocked`；结果JSON SHA：`4b50b747e2d5861c0c5ebaf919945c71d30f5830694c2dd69366cd72fdd6c7dd`。
- `independent-review.context-check.v2.json`记录真实只读出口摘录，SHA：`4b03384f048a61d000d589ebff986f3e4b4841f4391ef187cdb92138ae8b63d6`。
- 父keyframe-visual-review.v1 SHA：`4ccdf6e7c504a98337f4b914c3e7cbc991de3776c2c7748beae7b0dec3b021d1`。
- 完整动态、正常速度听感、用户样片验收、正式成片和发布全部仍未放行。runner不强制review.allowedCommands的既有边界不变；本回执decision不满足其放行条件。
