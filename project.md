# 口播视频项目

> 当前目标：建立个人 AI 口播账号的可复用视频生产流程。
> 当前阶段：第一条 16:9 v4 样片已跑通；第二条测试口播已完成 v2 语义动效和 3:4 封面升级，等待人工观看评审。

## 一、账号定位

- 人设：甘肃兰州，38 岁，AI 创业者 / AI 博主。
- 服务对象：甘肃区域小微企业、个体老板、本地创业者、本地 OPC 一人公司创业者。
- 核心愿景：让甘肃本地企业用上 AI 工具，把 AI 从概念落到获客、内容、客服、销售等真实业务场景。
- 资源连接方向：对接本地企业需求与庆阳等区域算力中心资源。
- 内容方向：AI 基础知识、AI 工具实操、本地企业案例、AI 时代小微企业曝光与获客、一人公司创业。

## 二、参考风格

- 参考账号：柱子哥 TzFilm。
- 参考元素：AI / 全球视野 / 科技数码 / 案例分析 / 商业故事 / 强封面标题 / 科技商业口播。
- 执行边界：学习其内容结构和包装方式，不复制其具体文案、视觉资产和账号身份。

## 三、第一条视频策略

- 视频性质：账号宣言型第一期。
- 输出规格：先做 16:9 横屏，1920x1080，30fps。
- 目标长度：第一版不强行压到 45 秒，优先保留完整人设表达，预计 60-75 秒。
- 标题钩子：38岁，我在兰州做AI创业。
- 副标题：服务甘肃小微企业，把AI落到地上。
- 视觉方向：科技商业感、蓝/黄关键词、清晰字幕、轻包装，不遮挡主体。
- 音频方向：响度统一、轻微降噪、保留真实口播感。

## 四、素材清单

- 原始口播视频：`source/IMG_1911.MOV`
- 参考博主截图：`refs/IMG_1908_参考博主主页.PNG`
- 抽帧检查：`edit/verify/frame_001s.jpg`、`frame_015s.jpg`、`frame_last.jpg`

## 四点五、项目知识库

- 项目执行规则：`AGENTS.md`
- 知识入口：`knowledge/00-项目知识索引.md`
- 账号战略：`knowledge/01-账号战略与事业主线.md`
- 个人事实边界：`knowledge/02-个人事实与公开边界.md`
- 执行守则：`knowledge/03-口播执行守则.md`
- 内容 SOP：`knowledge/04-内容生产SOP.md`
- 合规隐私：`knowledge/05-合规隐私与证据规则.md`
- 风格规范：`knowledge/06-选题脚本与风格规范.md`
- 合伙人 PPT 摘要：`knowledge/07-合伙人PPT摘要与数据边界.md`
- 决策与复盘：`knowledge/08-决策与复盘日志.md`
- 命名调研：`knowledge/09-AI博主命名调研.md`
- 时事选题：`knowledge/10-AI时事选题与口播转化工作流.md`
- 封面与动效：`knowledge/11-封面与语义动效模板升级复盘.md`
- Remotion 迭代机制：`knowledge/12-Remotion协作与模板迭代机制.md`

## 五、已验证事实

- 原片来自 iPhone 13 Pro Max。
- 原片为 4K 横屏，约 79 秒，30fps，HEVC/HDR，约 674MB。
- 当前项目目录：`/Users/pc/Documents/口播`
- GitHub 仓库：`git@github.com:benitexzack-alt/koubo-ai-studio.git`
- 当前机器可用工具：FFmpeg、FFprobe、Node.js、npm。
- ElevenLabs API Key 已配置到 `/Users/pc/.agents/skills/video-use/.env`，文件权限为 `600`，已通过 ElevenLabs 用户接口有效性验证。
- 生图中转站 API 已配置到本机 `.env`，权限 `600`；已验证 `/v1/models` 可访问，模型为 `gpt-image-2`。
- 已通过 `tools/generate-image.mjs` 完成一次真实生图，输出：`outputs/generated/ai-card-smoke-test.png`。
- 已初始化本地 Git 仓库并推送到 GitHub：`benitexzack-alt/koubo-ai-studio`。
- 已建立项目本地知识库和强制执行规则，未来任务从 `AGENTS.md` 与 `knowledge/00-项目知识索引.md` 开始。
- 已建立 Remotion 子工程：`remotion/`。
- Remotion 依赖已安装：`remotion`、`@remotion/cli`、`@remotion/captions`、`@remotion/media`、`@remotion/fonts`。
- 素材工具已安装/补齐：Playwright、Sharp、本地字体、素材台账。
- 已安装项目专用 `ffmpeg-full 8.1.2`，路径为 `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`，已确认包含 `drawtext`、`subtitles/libass`、`zscale`、`tonemap`、`libplacebo`。

## 六、当前产出

- ElevenLabs 转写 API Key 已配置完成。
- 第一条视频已完成 ElevenLabs 中文词级转写，输出：`edit/transcripts/IMG_1911.json`。
- 已生成校正文稿：`edit/transcripts/IMG_1911_校正文稿.txt`。
- 已生成 16:9 第一版样片：`outputs/兰州AI创业口播样片_16x9_v1.mp4`。
- 已生成 Remotion 第二版样片：`outputs/兰州AI创业口播样片_16x9_v2_remotion.mp4`。
- 已生成 Remotion 字幕修正版全片：`outputs/兰州AI创业口播样片_16x9_v3_字幕修正版.mp4`。
- 已生成 Remotion 语义字幕版全片：`outputs/兰州AI创业口播样片_16x9_v4_语义字幕版.mp4`。
- 已生成 Remotion 10 秒语义字幕预览：`outputs/兰州AI创业口播预览10秒_语义字幕版.mp4`。
- 已生成封面 Still：`outputs/兰州AI创业封面_v1.png`。
- 已生成抖音 9:16 封面 Still：`outputs/兰州AI创业封面_9x16_v1.png`。
- 已生成第二条测试口播 v2 样片：`outputs/本地老板AI第一步不是买软件_16x9_v2.mp4`。
- 已生成第二条测试口播 3:4 封面：`outputs/本地老板AI第一步不是买软件_封面3x4_v2.png`。
- 已同步交付文件到 Codex 输出目录：`/Users/pc/Documents/Codex/2026-07-03/claude/outputs/口播/`。
- 技术自检通过：Remotion v4 全片输出 1920×1080、30fps、H.264/AAC、79.33 秒，完整解码通过；10 秒预览输出 1920×1080、30fps、H.264/AAC、10.09 秒。
- 字幕问题已定位为 Remotion 默认 TikTok 分页不适合中文连续文本；已改为中文语义分页，已保护“甘肃 / 庆阳 / 兰州 / 重新 / OPC”等关键词，并消除少于 5 个有效字的短字幕页。
- 生图 API 已补 `.env.example` 占位、`tools/check-image-api.mjs` 校验脚本和 `templates/02-生图API接入说明.md`。
- 已确认 Remotion 三项长期机制：每条视频先做 `visual-plan.json`、Remotion 只做局部动效片段、复杂参数配置化。
- 已安装并验证本地 OCR 中文识别能力：Tesseract 5.5.2 + `tesseract-lang`，可用语言包含 `chi_sim`。
- 已新增 OCR 坐标识别脚本：`tools/ocr-image.mjs`。
- 已新增 Remotion `ocr-callout` 动效类型和 `AIBizTalk16x9-OCRDemo` 验收 composition，可用 `npm run still:ocr-demo` 渲染单帧检查。
- 仍待用户人工观看确认：节奏、形象、字幕字词、标题风格、封面视觉、是否压缩到 45 秒。

## 七、隐私与密钥规则

- API Key 不写入项目文件。
- API Key 不提交 Git。
- 若使用第三方转写服务，会上传视频音频内容；用户已允许使用 ElevenLabs 转写。
- 生图 API 已配置真实 Key 到本机 `.env`，不进入项目代码；后续封面或视觉资产需要时调用 `gpt-image-2`。
- 生图 / 图生图 API 已留 `.env.example` 占位，真实 Key 不进入项目文件。

## 八、会话记录摘要

- 用户希望做类似科技 AI 商业口播博主的账号风格。
- 用户本人定位为兰州 AI 创业者，目标服务甘肃本地小微企业。
- 第一条文案已按账号宣言方向生成并完成拍摄。
- 用户指定先用 16:9 进行测试。
- 用户希望把项目资料统一放入“文稿/口播”目录。
- 2026-07-04 已完成第一条 16:9 样片，但当前 FFmpeg 缺少 `zscale` 和 `libass/subtitles`，本次采用 Pillow 透明包装层 + FFmpeg overlay 的替代方案；后续若要模板化，建议使用 Remotion 或安装带完整滤镜的 FFmpeg。
- 2026-07-04 已补齐 Remotion 工作流第一版：逐字字幕、提示卡、顶部栏目、进度条、封面 Still、截图工具、封面工具、素材台账和 10 秒预览脚本。
- 2026-07-04 已安装 `ffmpeg-full` 并接入工具链检查；已修复字幕孤字/短页问题，生成 v4 语义字幕版样片和 10 秒预览。
- 2026-07-04 已补生图 API 配置说明和校验脚本；当前项目不是 Git 仓库，未执行 commit。
- 2026-07-04 已通过 macOS 隐藏输入配置 ImageTo / GPT 生图中转站 API，已验证 `/v1/models` 返回 `gpt-image-2`。
- 2026-07-04 已新增 `shot-plan.json` 和 `tools/generate-image.mjs`，并用 `gpt-image-2` 生成一张提示卡背景测试图。
- 2026-07-04 已初始化 Git，首个提交 `a8d8ad2 feat: initialize koubo ai studio workflow`，并推送到 `git@github.com:benitexzack-alt/koubo-ai-studio.git`。
- 2026-07-04 已完成第二条测试口播 v2 升级：新增主题封面背景、语义卡片 variants、v2 composition 和 3:4 封面 Still；本次生图中转站调用封面背景时返回 `HTTP 504 Gateway Time-out`，已改为代码生成背景兜底，后续需增加重试和提示词归档。
- 2026-07-05 已根据《口播秘籍》教程确认三项机制并入工作流：`visual-plan.json`、Remotion 小动效片段分工、复杂参数配置化；同时补齐 OCR 中文识别工具，用于后续截图/界面“指哪打哪”标注。
- 2026-07-05 已把 OCR 标注从工具能力推进到 Remotion 组件能力：`Beat.variant` 支持 `ocr-callout`，可根据坐标画高亮框、连线和标签。
