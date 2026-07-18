# koubo-ai-studio

AI 口播内容与 Remotion 生产工作流：内容门禁、事实安全精修、词级转写、视觉方案、双语字幕、数字运镜、Remotion 包装、机器质检和发布记录。

## 适用环境

- macOS + Homebrew。
- Codex 桌面端或 CLI。
- Git、Node.js、npm、Python 3、FFmpeg/FFprobe。
- 可访问 GitHub、npm 和 Remotion Chrome 下载地址的网络。

项目不依赖固定用户名或固定克隆目录。本文中的命令均假定终端已位于 Git 仓库根目录。

## 项目内 Skill

- `skills/koubo-remotion-director`：视觉方案、V4/V5/V6、Remotion 预览、质检和发布记录。
- `skills/humanize-koubo-script`：事实锁定后的去 AI 味、朗读和留存风险审稿。
- `skills/content-brain-gate`：来源、最近六条、内容增量、观众距离、机制和本人声音硬门禁。

## 快速开始

```bash
cd remotion
npm ci
npm run toolchain
cd ..
```

复制 `.env.example` 为 `.env`，只在本机填写真实密钥和可选工具路径。`.env` 不得提交。

统一使用以下命令注册和诊断 Skill：

```bash
node tools/setup-koubo.mjs
node tools/doctor-koubo.mjs
```

先只看安装计划、不写入：

```bash
node tools/setup-koubo.mjs --dry-run
```

安装器只会创建缺失的链接。如果 `~/.codex/skills/` 中已存在不同来源的同名 Skill，它会在写入前停止并报告，不覆盖、不移动、不删除。体检工具全程只读，也不会显示 `.env` 的内容。

## 本地私密文件

以下内容不进入 Git：

- `.env`：API Key 和本机路径。
- `source/`：原始口播视频。
- `outputs/`：导出成片、封面和生成图。
- `edit/`：转写、验证截图和中间文件。
- `remotion/public/media/`：代理视频素材。
- `remotion/public/fonts/`：本地字体。
- `knowledge/source-materials/`：个人知识库原始资料副本。

## 常用命令

```bash
cd remotion
npm run toolchain
npm run render:preview10
npm run render:sample
cd ..
```

```bash
node tools/check-image-api.mjs
node tools/generate-image.mjs --prompt "提示卡背景，不要文字，不要logo" --size 1536x1024
```

## 注意

真实素材、客户案例和生图提示词需要进入素材台账或 `shot-plan.json`，公开视频使用前必须确认来源、授权和证据等级。

本仓库不包含真实原片、客户素材、`.env`、本地字体和正式成片。历史 release 记录在新克隆中可能因对应私密媒体不存在而校验失败，这不代表校验器失效。
