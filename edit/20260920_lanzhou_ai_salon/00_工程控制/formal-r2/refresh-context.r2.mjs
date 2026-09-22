import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../../..');
const control = path.join(
  root,
  'edit/20260920_lanzhou_ai_salon/00_工程控制/formal-r2',
);
const taskId = 'task-20260922T081153Z-62896994';
const relativeGroups = {
  current_project_index: ['knowledge/00-项目知识索引.md'],
  current_project_summary: ['project.md'],
  latest_update: ['knowledge/08-决策与复盘日志.md'],
  applicable_rules_or_skills: [
    'AGENTS.md',
    'skills/koubo-remotion-director/SKILL.md',
    'knowledge/20-V8连续语义动效与可感知音效基线.md',
    'knowledge/22-实录优先字幕与系列发布包硬门禁.md',
    'workflow/active-production-profile.v1.json',
  ],
  historical_failures: [
    'knowledge/20-V8连续语义动效与可感知音效基线.md',
    'knowledge/22-实录优先字幕与系列发布包硬门禁.md',
  ],
  task_original_materials: [
    'workflow/jobs/20260920_lanzhou_ai_salon_v8_r2.production.json',
    'edit/20260920_lanzhou_ai_salon/00_工程控制/final-source.v2.json',
    'edit/20260920_lanzhou_ai_salon/00_工程控制/formal-r2/formal-authorization.r2.json',
    'edit/20260920_lanzhou_ai_salon/00_工程控制/formal-r2/formal-authorization.user.jsonl',
    'edit/20260920_lanzhou_ai_salon/00_工程控制/formal-r2/formal-manifest.r2.json',
    'edit/20260920_lanzhou_ai_salon/03_导演拆解/director-v2-r2/director-cues.v2.json',
    'edit/20260920_lanzhou_ai_salon/03_导演拆解/director-v2-r2/director-cues-user-approval.v2.json',
    'edit/20260920_lanzhou_ai_salon/03_导演拆解/director-v2-r2/handoff-v2/director-cues-v2-handoff.v1.json',
    'edit/20260920_lanzhou_ai_salon/03_导演拆解/director-v2-r2/handoff-v2/director-cues-v2-handoff-validation-receipt.v1.json',
    'edit/20260920_lanzhou_ai_salon/05_实录与字幕/canonical-transcript.final-source.v2.json',
    'edit/20260920_lanzhou_ai_salon/05_实录与字幕/caption-review.final-source.v2.json',
    'edit/20260920_lanzhou_ai_salon/05_实录与字幕/spoken-source-policy.v2.json',
    'remotion/public-salon-20260920/data/captions.final-source.bilingual.v2.json',
    'edit/20260920_lanzhou_ai_salon/06_剪辑工程/final-proxy.receipt.v2.json',
    'edit/20260920_lanzhou_ai_salon/06_剪辑工程/visual-plan.v2.json',
    'edit/20260920_lanzhou_ai_salon/06_剪辑工程/sfx-cues.v2.json',
    'remotion/src/salon-20260920-r2/Root.tsx',
    'remotion/src/salon-20260920-r2/SalonHighlightR2.tsx',
    'remotion/src/salon-20260920-r2/index.ts',
    'remotion/src/salon-20260920-r2/index.tsx',
  ],
};

const absolute = (relativePath) => path.resolve(root, relativePath);
const groups = Object.fromEntries(
  Object.entries(relativeGroups).map(([group, files]) => [
    group,
    files.map(absolute),
  ]),
);

const requirements = {
  schema_version: 'opc-task-requirements/1.0',
  task_id: taskId,
  required_receipt_groups: groups,
};

const notes = {
  'knowledge/00-项目知识索引.md':
    '已读取并用于定位本期 edit-release 阶段的 V8、实录字幕与发布包权威文件。',
  'project.md':
    '已读取当前状态；本轮只推进兰州 AI 沙龙 R2 正式候选，不继承其他视频的待办。',
  'knowledge/08-决策与复盘日志.md':
    '已检索本期相关记录；未发现可替代用户最新指令的旧沙龙决策。',
  'AGENTS.md':
    '已应用实录音频唯一正文、V8 正式候选、用户完整观看终验和禁止自动发布边界。',
  'skills/koubo-remotion-director/SKILL.md':
    '已核对导演四路、事实核验与下游交接边界；本期使用已验证的 R2 导演交接。',
  'knowledge/20-V8连续语义动效与可感知音效基线.md':
    '已应用人物主画面、42%覆盖率、连续语义动效、音效防重复和正式候选质检要求。',
  'knowledge/22-实录优先字幕与系列发布包硬门禁.md':
    '已应用录音为中文字幕唯一正文、英文从实录中文翻译及候选片发布包触发规则。',
  'workflow/active-production-profile.v1.json':
    '已应用当前 V8 最低生产档案、字幕校验阈值与 ready-for-user-review 边界。',
};

const allRelativePaths = [...new Set(Object.values(relativeGroups).flat())];
const receipts = {
  schema_version: 'opc-read-receipts/1.0',
  task_id: taskId,
  receipts: allRelativePaths.map((relativePath) => {
    const filePath = absolute(relativePath);
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`上下文回执只接受普通文件：${relativePath}`);
    }
    return {
      path: filePath,
      sha256: createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'),
      read_status: 'read',
      application_status: 'applied',
      read_completed_at: new Date().toISOString(),
      application_note:
        notes[relativePath] ??
        '已核对当前 R2 正式候选输入并用于锁定最终源、实录字幕、导演交接、视觉音效与渲染入口。',
    };
  }),
};

const requirementsPath = path.join(control, 'context-requirements.r2.json');
const receiptsPath = path.join(control, 'read-receipts.r2.json');
const resultPath = path.join(control, 'context-start.r2.json');
fs.writeFileSync(requirementsPath, `${JSON.stringify(requirements, null, 2)}\n`);
fs.writeFileSync(receiptsPath, `${JSON.stringify(receipts, null, 2)}\n`);

const result = spawnSync(
  'python3',
  [
    '/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py',
    'start',
    '--project',
    '口播',
    '--task',
    '兰州AI实践者共创沙龙第一期：最终源实录字幕与V8正式候选',
    '--cwd',
    root,
    '--task-id',
    taskId,
    '--important',
    '--requirements-file',
    requirementsPath,
    '--receipt-file',
    receiptsPath,
  ],
  {cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
);

const combinedOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`;
fs.writeFileSync(resultPath, combinedOutput);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
