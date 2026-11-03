# 公开代码候选验证说明

## 验证范围

本目录仅含工作台代码与接口说明。自动化测试使用合成目录、数据和临时文件，覆盖保存、版本冲突、导出、路径安全与候选文件变化等服务行为。前端脚本另做语法检查。具体执行结果以实际运行输出为准。

```sh
node --test motion-workbench/tests/server.test.mjs
node --check motion-workbench/dist/app.js
node --check motion-workbench/scripts/build-catalog.mjs
```

## 使用边界

代码不包含原始授权资料、第三方媒体、本地审查 JSON、生成目录、用户期次或账号数据；初次生成目录需要自行准备这些必要输入并确认使用许可。自动化测试不证明外部网址当前可用、授权适用、目录可生成、浏览器真实播放或项目成片已获验收。
