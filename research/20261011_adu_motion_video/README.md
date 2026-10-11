# 口播动效对照研究

先打开本机对照页：http://127.0.0.1:5195/ 。四个按钮切换《10个AI生意》的同一段口播，当前版本都约14秒。若服务已退出，在本目录运行 `python3 serve.py`，再打开同一地址。也可以直接打开 `outputs/` 中四个 MP4。

- `仓库拆解与升级建议.md`：Skill结构、现有能力对照、借鉴优先级和限制。
- `upstream/SKILL.md`：实际下载的原始Skill，固定提交见清单；没有全局安装。
- `adu-motion-video_6ea0c875.zip`：固定提交的完整源码压缩包；包括原始许可。
- `实验说明.md`：比较控制、范围和采用条件。
- `manifest.json` 与 `verification.json`：输入来源、版本、哈希和实际检查结果。
- `web/scenes.js`：三种本地改编的具体动作；复制代码保留MIT许可。

## 复核与恢复

使用现有环境，无需执行上游setup。`check-media.py`检查实际视频；`check-layout.mjs`检查三版逐帧文字；本机服务运行后用`check-gallery.mjs`检查连续播放及切换进度。

`prepare.py`只在尚无manifest的新研究目录准备只读输入，不覆盖现有研究。`prepare-sdr-adapter.py`生成本地渲染适配及sRGB帧，`renderer-adaptation.diff`保留与上游入口的差异。渲染参数与输出哈希见qa和verification；不是上游完整宏场景复用，也不是V8正式生产。

大体积上游源码、媒体、视频和中间抽帧保留本机，不加入口播Git；自有适配脚本、报告及轻量验收摘要存档。原片、旧成片与当前V8默认均保持原样。用户正常速度观看后再决定是否迁移局部动作。
