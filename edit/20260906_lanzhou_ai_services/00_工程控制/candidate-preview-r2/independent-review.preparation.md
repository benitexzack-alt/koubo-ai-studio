# R2上下文准备交接

## 冻结后结果

- 已收到父任务冻结通知，仅补读4项变化/新增输入；当前24个去重输入为15份旧读取复用及9份增量读取。
- 单次官方start退出0，状态context-ready；固定SHA只读wrapper调用官方validate-context退出0，状态context-valid。
- 绑定：context/context-binding.v1.json；taskId=opc-task-20260908-lanzhou-candidate-preview-r2-context-v1；context SHA-256=c234a10b129da9d9d6f85997f269aeb5c141e2ac3e353453007d782b95678267。
- 真实出口及命令见context/start.v1.command.json、context/validate-context.v1.command.json，结果见context/context-result.v1.json。
- formal=false，未渲染、未签发独立放行。等待父任务capture request及runtime快照后复核；下方为冻结前历史准备记录，不代表当前仍待冻结。

## 冻结前记录

- 状态：等待父任务明确输入冻结；尚无R2 context绑定，尚无真实validate出口，未签发独立审查放行。
- 写集：仅本目录的context及本文件。未改R1、父runner、共享Skill、知识工具、信任根、project.md或知识库正文；未渲染、提交、发布、日结。
- 准备结果：context/requirements.prepared.v1.json列24个去重输入；15份读取按SHA复用并保留R1时间，7份增量实读，2份待生成读取。
- 待冻结输入：最终R2 visual-plan、独立22文件public-assets；permission需指向R2 public并绑定9个既有SFX，sfx-plan需绑定最终selection v2及生成visual。父任务当前并行改动不由本worker处理。
- 冻结后：仅补新增/变化输入的实际读取，在context/read-observations.v1.json追加当前SHA、真实时间及范围；记录父任务冻结证据到context/input-freeze.v1.json，再执行context/renew-context.v1.mjs --start-after-freeze。
- 命令脚本复用R1 v3流程：一次官方opc start；一次固定SHA的runtime/knowledge-readonly.py调用原官方validate-context。无显式index命令、无自动重试、无工具或数据库逻辑修改；官方start若内部同步索引，其真实结果保留在回执。
- 预期绑定文件：context/context-binding.v1.json；真实出口：context/start.v1.command.json、context/validate-context.v1.command.json及对应result/stdout/stderr。上述文件当前没有生成，不能当已通过。
- 权限始终仅本地960x540低清候选；formal=false。源声1/0.62/0.1、26卡点0.26至0.36、13项ASR疑点、五段纸艺本条例外及P03试听待核不变。
- 下一门：context通过后等待父request及runtime快照，针对冻结输入独立复核；源码/静态合同不等于动态画面、实际混音或用户验收。
