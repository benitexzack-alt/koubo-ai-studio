# 从想法，到能用：纯代码动画样片

本目录是独立的 26 秒风格实验，用于让用户判断画风、持续动作和口播插片的适用性。没有绑定正式口播、导演表、首帧生产任务或发布包。

## 参考与实际做法

- 参考：[Henri Toivar 的 Skillry 案例](https://skillry.dev/zh/ai-videos/opus-5-5/henritoivar-445215)。页面标明作者只公开部分提示词；可见补充说明是用 HTML/CSS/JS、HyperFrames 制作画面，用代码合成音乐和音效，另用语音服务制作旁白。
- 本次由 Codex 根据公开方法补齐原创主题和动作，使用 Canvas 绘图、GSAP 确定性时间线及 HyperFrames 本地渲染，不是原作者工程或完整提示词的逐字复现。
- 采用暖白方格纸、手绘轮廓、彩色纸板、原创像素人物和同一空间中的连续动作。
- 没有调用生图、生视频、配音或付费模型接口。使用现有本地浏览器、本机中文字体和本地合成音轨。依赖安装联网，不等于生成服务收费；本轮未核验会员长期用量或作者原作总成本。
- 没有旁白，便于先判断画面；不是已同步某条实录的口播素材。

## 本次执行提示词

制作一段 26 秒、1920×1080、30 帧的完整代码动画。暖白方格纸作为舞台，手绘线条、柔和纸板厚度和彩色纸面物件；原创蓝外套、红围巾像素小人。

用同一座桥的两次试验讲清一个因果过程：想到点子，搭起没有支撑的桥板，小车试走后桥板坍塌；翻动纸页，小人补上三根支柱和连接，小车再次通过，到达小屋。开头和结尾保留简短中文，中文与承载纸面一起运动。不要只做文字卡片切换或局部界面动效。桥板、支柱、小车、人物、灯光都有连续动作与可见结果。音乐和纸张、落位、车轮、失败、成功音效全部通过代码在本地合成。

## 文件与播放

- `renders/henri-style-r1.mp4`：带音轨的样片。
- `index.html`、`scene.js`：画面与确定性时间线；可以倒退或乱序定位。
- `vendor/gsap.min.js`：当前 npm 依赖内的本地副本，保留原许可信息。
- `fonts/Chinese.woff2`：从本机已存在的中文字体生成的本片字形子集，仅供本机实验，不代表取得字体再分发授权。
- `audio/make_audio.py`：只用 Python 标准库生成原创音轨。
- `audio/audio-events.json`：动作音效时间点与数值检查。
- `qa/snapshots-r1/`：渲染前关键帧；最终判断需正常速度播放完整样片。
- 本地画面预览：用本地 HTTP 服务打开 `index.html?preview=1`，该入口不启动音轨；声画判断直接播放 MP4。

## 复现

在本目录运行 `npm ci`，然后运行 `python3 audio/make_audio.py`。字体子集已保存，无需重新读取大字体。渲染命令如下，浏览器路径须指向本机实际安装的浏览器：

```sh
HYPERFRAMES_BROWSER_PATH='/Users/pc/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell' \
PRODUCER_HEADLESS_SHELL_PATH='/Users/pc/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell' \
./node_modules/.bin/hyperframes render . --fps 30 --quality looks --workers 2 --output ./renders/henri-style-r1.mp4
```

截图使用 `hyperframes snapshot . --frames 6 --describe false --output ./qa/snapshots-r1`，明确关闭远程视觉描述。

## 证据边界

关键帧可以证明本样片有纸面场景、中文和可见的状态变化；技术检查可以证明文件尺寸、时长、帧率、音轨和可解码性。它们不能代替用户对画风、动作流畅度、听感和能否替代既有纸艺素材的判断。
