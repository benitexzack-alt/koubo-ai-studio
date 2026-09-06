# Remotion 生产渲染入口边界

生产任务只允许通过：

```text
node skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs <job.json> <preview|formal> [--no-sfx]
```

该 wrapper 在任何输出目录、锁、报告、缓存或 Remotion 子进程产生前，强制校验当前 job、新修订、director-contract/v2、独立人工/监督锚点、handoff、freeze receipt、全量媒体哈希与门禁闭包。风格交接不会开启 formal；正式渲染还需单条外部授权回执。

项目默认 `remotion.config.ts` 会在 CLI 初始化阶段拒绝缺少本次 claim 和 preflight 哈希的裸 `remotion render`；`remotion/package.json` 也不再暴露历史裸渲染脚本。配置文件作为 Remotion 运行图的一部分进入哈希绑定，变化后旧生产回执自动失效。

残余风险：本机拥有代码和操作系统写权限的人，仍可修改配置、指定其他配置或直接调用底层渲染器。因此这是任务治理硬门，不是操作系统安全沙箱；正式交付仍必须由 `release-production-gate/v2` 核对受控渲染回执。

本回归 fixture 证明事故 job 经 wrapper 在 spawn 前被拒绝，也证明项目默认的 raw CLI 在配置初始化阶段被拒绝；它不证明本机底层渲染能力已被操作系统级禁用。
