# 项目输入、输出与状态契约

## 输入优先级

1. `workflow/releases/<release>.json`；
2. 发布记录引用的正式成片、逐字稿和视觉方案；
3. 用户明确给出的主题、选题、标题和反馈。

生成封面时，正式成片只需完成机器侧质检并处于发布前评审阶段；不要求先把视频 release 标为 `verified`。

## 任务单位置

模板：`workflow/cover-task-template.json`

实例：`workflow/covers/<coverId>.json`

任务单保留在 Git；候选图、四宫格、最终图和抽帧证据按项目 `.gitignore` 留在本机。

## 输出位置

```text
outputs/covers/<coverId>/candidate-1.png
outputs/covers/<coverId>/candidate-2.png
outputs/covers/<coverId>/candidate-3.png
outputs/covers/<coverId>/candidate-4.png
outputs/covers/<coverId>/<coverId>_grid_v1.png
outputs/covers/<coverId>/<coverId>_final_v1.png

edit/verify/covers/<coverId>/frames/
edit/verify/covers/<coverId>/thumbnails/
edit/verify/covers/<coverId>/ocr/
```

单张候选和最终图为 `1080×1440` PNG。四宫格默认 `2240×2960`，外边距 `20px`，宫格间距 `40px`。

## 状态机

```text
draft → grid-ready → selected → final-ready → approved
```

- `draft`：任务单存在，尚未完整输出四张候选。
- `grid-ready`：四张独立候选和四宫格均存在且通过初稿质检；`selection` 与 `final` 为空。
- `selected`：用户明确选择 1–4，记录选择时间和反馈；尚未生成终稿。
- `final-ready`：终稿来自选中编号，尺寸和质检通过；仍待用户人工确认。
- `approved`：用户已观看终稿并明确确认。

用户否决整组或终稿时，新建下一版本任务单，不覆盖已产生的选择与质检证据。

## 发布记录接入

发布记录只保存任务单引用：

```json
"cover": {
  "taskFile": "workflow/covers/<coverId>.json",
  "requiredForPublish": true
}
```

旧发布记录没有 `cover` 或 `cover: null` 时保持兼容。发布前若 `requiredForPublish=true`，封面任务必须达到 `approved`。

## 命令

```bash
node skills/generate-koubo-cover/scripts/render-cover-set.mjs <task.json> --mode grid
node skills/generate-koubo-cover/scripts/validate-cover-task.mjs <task.json>

node skills/generate-koubo-cover/scripts/render-cover-set.mjs <task.json> --mode final --selected 2
node skills/generate-koubo-cover/scripts/validate-cover-task.mjs <task.json>
```

Skill 结构校验：

```bash
python3 /Users/pc/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  skills/generate-koubo-cover
```

## 汇报用语

- 四宫格阶段：`四宫格初稿已生成，待你选择 1、2、3 或 4。`
- 精修生成后：`最终封面已生成，待人工确认。`
- 只有用户确认且发布数据回填后，才讨论该封面是否有效；不能把技术质检通过写成“爆款封面已验证”。
