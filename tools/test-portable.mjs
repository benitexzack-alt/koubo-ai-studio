#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const remotionRoot = path.join(projectRoot, 'remotion');
const pythonBin = process.env.PYTHON_BIN || 'python3';
const ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg';
const steps = [];
const temporaryRoots = [];

const makeTemporaryRoot = () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'koubo-portable-'));
  temporaryRoots.push(directory);
  return directory;
};

const cleanupTemporaryRoot = (directory) => {
  const resolved = path.resolve(directory);
  const tempPrefix = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (!resolved.startsWith(tempPrefix) || !path.basename(resolved).startsWith('koubo-portable-')) {
    throw new Error(`拒绝清理未经确认的目录：${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
};

const run = (name, command, args, options = {}) => {
  const expectedCodes = options.expectedCodes ?? [0];
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    env: options.env ?? process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: options.timeoutMs ?? 120000,
  });
  const code = result.status ?? 1;
  const ok = !result.error && expectedCodes.includes(code);
  steps.push({ name, ok, code });
  console.log(`[${ok ? '通过' : '失败'}] ${name}`);
  if (!ok) {
    if (result.error) console.error(result.error.message);
    if (result.stdout?.trim()) console.error(result.stdout.trim());
    if (result.stderr?.trim()) console.error(result.stderr.trim());
    throw new Error(`${name} 未通过，退出码 ${code}`);
  }
  return result;
};

try {
  const toolFiles = readdirSync(path.join(projectRoot, 'tools'))
    .filter((name) => name.endsWith('.mjs'))
    .sort();
  for (const toolFile of toolFiles) {
    run(`Node 语法 ${toolFile}`, process.execPath, ['--check', path.join('tools', toolFile)]);
  }

  const systemSkillValidator = path.join(
    process.env.CODEX_HOME?.trim() || path.join(os.homedir(), '.codex'),
    'skills',
    '.system',
    'skill-creator',
    'scripts',
    'quick_validate.py',
  );
  if (existsSync(systemSkillValidator)) {
    for (const skillName of [
      'source-essence-synthesis',
      'content-brain-gate',
      'humanize-koubo-script',
      'koubo-asset-prep',
      'koubo-remotion-director',
    ]) {
      run(
        `Skill 结构 ${skillName}`,
        pythonBin,
        [systemSkillValidator, path.join('skills', skillName)],
      );
    }
  } else {
    steps.push({ name: 'Codex Skill 官方结构校验', ok: true, skipped: true });
    console.log('[跳过] 当前 Codex 未提供 skill-creator/quick_validate.py，保留项目文件体检');
  }

  run(
    '源头精髓单元回归',
    pythonBin,
    ['skills/source-essence-synthesis/scripts/test_source_essence.py'],
  );
  run(
    '源头精髓应通过样例',
    pythonBin,
    [
      'skills/source-essence-synthesis/scripts/validate_source_essence.py',
      'skills/source-essence-synthesis/fixtures/ai007-outline-pass.json',
    ],
  );
  run(
    '源头精髓应拦截旧稿',
    pythonBin,
    [
      'skills/source-essence-synthesis/scripts/validate_source_essence.py',
      'skills/source-essence-synthesis/fixtures/ai007-v1-fail.json',
    ],
    { expectedCodes: [1] },
  );

  run(
    '内容门禁单元回归',
    pythonBin,
    ['skills/content-brain-gate/scripts/test_content_gate.py'],
  );
  run(
    '内容门禁应通过样例',
    pythonBin,
    [
      'skills/content-brain-gate/scripts/validate_content_gate.py',
      'skills/content-brain-gate/fixtures/waic-new-pass.json',
    ],
  );
  run(
    '内容门禁应拦截样例',
    pythonBin,
    [
      'skills/content-brain-gate/scripts/validate_content_gate.py',
      'skills/content-brain-gate/fixtures/waic-old-fail.json',
    ],
    { expectedCodes: [1] },
  );

  const cleanCodexHome = path.join(makeTemporaryRoot(), 'codex-home');
  const isolatedAgentsHome = path.join(makeTemporaryRoot(), 'agents-home');
  const isolatedEnv = {
    ...process.env,
    CODEX_HOME: cleanCodexHome,
    AGENTS_HOME: isolatedAgentsHome,
  };
  run('空白 Codex Skill 安装', process.execPath, ['tools/setup-koubo.mjs'], {
    env: isolatedEnv,
  });
  run('Codex Skill 重复安装幂等', process.execPath, ['tools/setup-koubo.mjs'], {
    env: isolatedEnv,
  });
  run('隔离 Codex 环境体检', process.execPath, ['tools/doctor-koubo.mjs'], {
    env: isolatedEnv,
  });

  const conflictCodexHome = path.join(makeTemporaryRoot(), 'codex-home');
  mkdirSync(path.join(conflictCodexHome, 'skills', 'content-brain-gate'), { recursive: true });
  run('同名 Skill 冲突保护', process.execPath, ['tools/setup-koubo.mjs'], {
    env: { ...process.env, CODEX_HOME: conflictCodexHome },
    expectedCodes: [2],
  });
  for (const skillName of [
    'source-essence-synthesis',
    'humanize-koubo-script',
    'koubo-asset-prep',
    'koubo-remotion-director',
  ]) {
    if (existsSync(path.join(conflictCodexHome, 'skills', skillName))) {
      throw new Error(`冲突时发生部分安装：${skillName}`);
    }
  }
  steps.push({ name: '冲突时无部分写入', ok: true, code: 0 });
  console.log('[通过] 冲突时无部分写入');
  run(
    '同名冲突下定向安装新 Skill',
    process.execPath,
    ['tools/setup-koubo.mjs', '--skill', 'koubo-asset-prep'],
    { env: { ...process.env, CODEX_HOME: conflictCodexHome } },
  );

  run('素材预处理脚本语法', process.execPath, [
    '--check',
    'skills/koubo-asset-prep/scripts/prepare-asset.mjs',
  ]);
  run('素材预处理离线体检', process.execPath, [
    'skills/koubo-asset-prep/scripts/prepare-asset.mjs',
    'doctor',
  ], {
    env: { ...process.env, EACHLABS_API_KEY: '' },
  });
  const assetPrepOutput = path.join(projectRoot, 'edit', '.portable-asset-prep-test.png');
  run('素材预处理离线计划', process.execPath, [
    'skills/koubo-asset-prep/scripts/prepare-asset.mjs',
    'remove-background',
    'assets/generated/token-v5-20260715/chip-server-datacenter-cinematic-v1.png',
    '--output',
    path.relative(projectRoot, assetPrepOutput),
    '--asset-class',
    'generated',
    '--production-state',
    'ready-for-production',
    '--dry-run',
  ], {
    env: { ...process.env, EACHLABS_API_KEY: '' },
  });
  if (existsSync(assetPrepOutput) || existsSync(`${assetPrepOutput}.asset-prep.json`)) {
    throw new Error('素材预处理 dry-run 不应生成输出或处理记录');
  }
  steps.push({ name: '素材预处理预检未上传且未写结果', ok: true, code: 0 });
  console.log('[通过] 素材预处理预检未上传且未写结果');
  run('素材预处理证据门禁', process.execPath, [
    'skills/koubo-asset-prep/scripts/prepare-asset.mjs',
    'upscale-image',
    'assets/screenshots/waic2026-neowise-official.png',
    '--output',
    path.relative(projectRoot, assetPrepOutput),
    '--asset-class',
    'evidence',
    '--production-state',
    'ready-for-production',
    '--dry-run',
  ], {
    expectedCodes: [1],
    env: { ...process.env, EACHLABS_API_KEY: '' },
  });
  run('素材预处理无密钥停止', process.execPath, [
    'skills/koubo-asset-prep/scripts/prepare-asset.mjs',
    'upscale-image',
    'assets/generated/token-v5-20260715/chip-server-datacenter-cinematic-v1.png',
    '--output',
    path.relative(projectRoot, assetPrepOutput),
    '--asset-class',
    'generated',
    '--production-state',
    'ready-for-production',
    '--confirm-external-processing',
    '--confirm-cost',
  ], {
    expectedCodes: [1],
    env: { ...process.env, EACHLABS_API_KEY: '' },
  });
  if (existsSync(assetPrepOutput) || existsSync(`${assetPrepOutput}.asset-prep.json`)) {
    throw new Error('无密钥门禁不应生成输出或处理记录');
  }

  const mediaRoot = makeTemporaryRoot();
  const syntheticVideo = path.join(mediaRoot, 'synthetic.mp4');
  const syntheticTranscript = path.join(mediaRoot, 'synthetic.json');
  run(
    '生成本地合成测试视频',
    ffmpegBin,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=black:s=320x180:d=1',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-shortest',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      syntheticVideo,
    ],
  );
  run(
    'ElevenLabs 转写本地预检',
    process.execPath,
    [
      'tools/transcribe-elevenlabs.mjs',
      '--input',
      syntheticVideo,
      '--output',
      syntheticTranscript,
      '--dry-run',
    ],
  );
  if (existsSync(syntheticTranscript)) {
    throw new Error('dry-run 不应生成转写文件');
  }
  steps.push({ name: '转写预检未上传且未写结果', ok: true, code: 0 });
  console.log('[通过] 转写预检未上传且未写结果');

  run('Remotion 工具链', 'npm', ['run', 'toolchain'], { cwd: remotionRoot });
  const bundleRoot = makeTemporaryRoot();
  const emptyPublic = path.join(bundleRoot, 'empty-public');
  const bundleOutput = path.join(bundleRoot, 'bundle');
  mkdirSync(emptyPublic, { recursive: true });
  run(
    'Remotion 工程可编译',
    'npx',
    [
      '--no-install',
      'remotion',
      'bundle',
      'src/index.ts',
      '--public-dir',
      emptyPublic,
      '--out-dir',
      bundleOutput,
    ],
    { cwd: remotionRoot },
  );

  const passed = steps.filter((step) => step.ok && !step.skipped).length;
  const skipped = steps.filter((step) => step.skipped).length;
  console.log(`\n便携回归完成：通过 ${passed}，跳过 ${skipped}，失败 0`);
} catch (error) {
  console.error(`\n便携回归失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  for (const directory of temporaryRoots) cleanupTemporaryRoot(directory);
}
