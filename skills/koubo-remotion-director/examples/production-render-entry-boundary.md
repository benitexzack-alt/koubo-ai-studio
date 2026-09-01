# Remotion 生产渲染入口边界

生产任务只允许通过：

```text
node skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs <job.json> <preview|formal> [--no-sfx]
```

该 wrapper 在任何输出目录、锁、报告、缓存或 Remotion 子进程产生前，强制校验当前 job、新修订、director-contract/v2、独立人工/监督锚点、handoff、freeze receipt、全量媒体哈希与门禁闭包。风格交接不会开启 formal；正式渲染还需单条外部授权回执。

残余风险：操作系统上的任意人工 `npx remotion render ...` 无法被 Node 项目全局拦截。因此当前不得把“注册表里有 direct-remotion-render 字符串”表述为物理上完全冻结。正式流程、CI 和交付命令只能指向上述 wrapper；候选/生产 composition 在未获真实外部锚点前应不注册、不在 Root 暴露。

本回归 fixture 只证明事故 job 经 wrapper 在 spawn 前被拒绝，不证明任意 raw CLI 已被操作系统级禁用。
