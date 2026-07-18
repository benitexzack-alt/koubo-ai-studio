#!/usr/bin/env node

import { accessSync, constants, existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const codexHome = process.env.CODEX_HOME?.trim()
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(os.homedir(), '.codex');
const skillsRoot = path.join(codexHome, 'skills');
const results = [];

const add = (level, name, detail) => results.push({ level, name, detail });

const requiredFiles = [
  'AGENTS.md',
  'README.md',
  '.env.example',
  'project.md',
  'knowledge/00-项目知识索引.md',
  'knowledge/03-口播执行守则.md',
  'knowledge/04-内容生产SOP.md',
  'knowledge/05-合规隐私与证据规则.md',
  'knowledge/06-选题脚本与风格规范.md',
  'knowledge/14-超哥口播声音档案.md',
  'remotion/package.json',
  'remotion/package-lock.json',
  'skills/content-brain-gate/SKILL.md',
  'skills/humanize-koubo-script/SKILL.md',
  'skills/koubo-remotion-director/SKILL.md',
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  try {
    const stat = statSync(absolutePath);
    if (stat.isFile() && stat.size > 0) {
      add('通过', `项目文件 ${relativePath}`, '存在且非空');
    } else {
      add('失败', `项目文件 ${relativePath}`, '不是非空文件');
    }
  } catch {
    add('失败', `项目文件 ${relativePath}`, '缺失');
  }
}

const findExecutable = (name) => {
  const pathValue = process.env.PATH ?? '';
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      if (existsSync(candidate)) return candidate;
    } catch {
      // 继续查找下一个 PATH 目录。
    }
  }
  return null;
};

for (const command of ['git', 'node', 'npm', 'python3', 'ffmpeg', 'ffprobe']) {
  const executable = findExecutable(command);
  if (executable) {
    add('通过', `命令 ${command}`, executable);
  } else {
    add('失败', `命令 ${command}`, 'PATH 中未找到可执行文件');
  }
}

const portableRoots = ['README.md', 'AGENTS.md', '.env.example', 'templates', 'tools', 'skills'];
const personalPathPrefix = ['', 'Users', 'pc'].join('/');
const fixedHomebrewPrefix = ['', 'opt', 'homebrew'].join('/');
const forbiddenPatterns = [
  { label: '个人用户绝对路径', regex: new RegExp(`${personalPathPrefix}(?:/|\\b)`, 'g') },
  { label: '固定 Homebrew 路径', regex: new RegExp(`${fixedHomebrewPrefix}(?:/|\\b)`, 'g') },
];

const collectFiles = async (entry) => {
  const output = [];
  const absoluteEntry = path.join(projectRoot, entry);
  let stat;
  try {
    stat = lstatSync(absoluteEntry);
  } catch {
    return output;
  }
  if (stat.isFile()) return [absoluteEntry];
  if (!stat.isDirectory()) return output;

  const children = await readdir(absoluteEntry, { withFileTypes: true });
  for (const child of children) {
    if (child.name === '__pycache__' || child.name === '.DS_Store') continue;
    const childRelative = path.join(entry, child.name);
    if (child.isDirectory()) {
      output.push(...(await collectFiles(childRelative)));
    } else if (child.isFile()) {
      output.push(path.join(projectRoot, childRelative));
    }
  }
  return output;
};

const portableFiles = (
  await Promise.all(portableRoots.map(collectFiles))
).flat();
const hardcodedHits = [];
for (const filePath of portableFiles) {
  const content = await readFile(filePath, 'utf8').catch(() => null);
  if (content === null || content.includes('\u0000')) continue;
  for (const pattern of forbiddenPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) {
      hardcodedHits.push(`${path.relative(projectRoot, filePath)}：${pattern.label}`);
    }
  }
}
if (hardcodedHits.length === 0) {
  add('通过', '便携路径检查', '活动文档、Skill 和工具未发现本机固定路径');
} else {
  add('失败', '便携路径检查', hardcodedHits.join('；'));
}

for (const name of ['content-brain-gate', 'humanize-koubo-script', 'koubo-remotion-director']) {
  const source = path.join(projectRoot, 'skills', name);
  const target = path.join(skillsRoot, name);
  if (!existsSync(target)) {
    add('警告', `Codex 注册 ${name}`, '未注册；可运行 node tools/setup-koubo.mjs');
    continue;
  }
  try {
    const targetStat = lstatSync(target);
    if (targetStat.isSymbolicLink() && realpathSync(target) === realpathSync(source)) {
      add('通过', `Codex 注册 ${name}`, '已链接到当前项目');
    } else if (existsSync(path.join(target, 'SKILL.md'))) {
      add('警告', `Codex 注册 ${name}`, '已有独立版本，体检未覆盖或替换');
    } else {
      add('失败', `Codex 注册 ${name}`, '目标存在但不是可用的同名 Skill');
    }
  } catch (error) {
    add('失败', `Codex 注册 ${name}`, `无法读取：${error.message}`);
  }
}

const personalKnowledgeCandidates = [
  process.env.KOUBO_PERSONAL_KB?.trim(),
  path.resolve(projectRoot, '..', '个人知识库'),
].filter(Boolean).map((candidate) => path.resolve(candidate));
const personalKnowledgeBase = personalKnowledgeCandidates.find((candidate) =>
  existsSync(path.join(candidate, 'AGENTS.md')),
);
if (personalKnowledgeBase) {
  add('通过', '知识库模式', `检测到个人知识库，继续作为本机权威规则：${personalKnowledgeBase}`);
} else {
  add('警告', '知识库模式', '未检测到个人知识库，将使用项目内便携规则快照');
}

if (existsSync(path.join(projectRoot, '.env'))) {
  add('通过', '本机环境文件', '.env 已存在（内容未读取、未显示）');
} else {
  add('警告', '本机环境文件', '.env 不存在；需要 API 时再由 .env.example 复制');
}

if (existsSync(path.join(projectRoot, 'remotion', 'node_modules'))) {
  add('通过', 'Remotion 依赖', 'node_modules 已安装');
} else {
  add('警告', 'Remotion 依赖', '尚未安装；运行 cd remotion && npm ci');
}

const order = { 失败: 0, 警告: 1, 通过: 2 };
results.sort((a, b) => order[a.level] - order[b.level]);
for (const result of results) {
  console.log(`[${result.level}] ${result.name}：${result.detail}`);
}

const summary = results.reduce(
  (counts, result) => ({ ...counts, [result.level]: counts[result.level] + 1 }),
  { 通过: 0, 警告: 0, 失败: 0 },
);
console.log(`\n体检汇总：通过 ${summary.通过}，警告 ${summary.警告}，失败 ${summary.失败}`);
if (summary.失败 > 0) process.exitCode = 1;
