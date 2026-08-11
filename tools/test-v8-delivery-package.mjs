#!/usr/bin/env node

import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const validator = join(projectRoot, 'tools/validate-release.mjs');
const sourceRelease = join(
  projectRoot,
  'workflow/releases/20260731_lanzhou_opc_v72_v1.json',
);
const tempRoot = mkdtempSync(join(tmpdir(), 'koubo-v8-delivery-'));

const run = (command, args) =>
  spawnSync(command, args, {cwd: projectRoot, encoding: 'utf8'});
const writeRelease = (name, value) => {
  const filePath = join(tempRoot, `${name}.json`);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
};
const assertPasses = (name, result) => {
  if (result.status !== 0) {
    throw new Error(`${name}本应通过：\n${result.stderr}\n${result.stdout}`);
  }
};
const assertFailsWith = (name, result, expectedMessages) => {
  const output = `${result.stderr}\n${result.stdout}`;
  if (result.status === 0) throw new Error(`${name}本应失败。`);
  for (const message of expectedMessages) {
    if (!output.includes(message)) {
      throw new Error(`${name}缺少预期错误“${message}”：\n${output}`);
    }
  }
};

try {
  const release = JSON.parse(readFileSync(sourceRelease, 'utf8'));
  const recommendedFrame = join(tempRoot, 'recommended-cover-frame.jpg');
  const frameResult = run('ffmpeg', [
    '-v',
    'error',
    '-ss',
    '3',
    '-i',
    release.production.formalOutput,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    '-y',
    recommendedFrame,
  ]);
  if (frameResult.status !== 0) {
    throw new Error(`测试封面帧抽取失败：${frameResult.stderr}`);
  }

  release.productionProfile = {
    id: 'v8-semantic-continuity-sfx',
    version: 'V8',
  };
  release.deliveryPackage = {
    status: 'ready-for-delivery',
    cover: {
      aspectRatio: '3:4',
      recommendedFrame,
      sourceVideo: release.production.formalOutput,
      sourceTimeSeconds: 3,
      sourceType: 'current-final-video-real-frame',
      prompt: 'notes/2026-07-31-兰州OPC大会三入口-发布包装-v1.md',
    },
    titles: {
      primary: '兰州做AI创业，三个入口正在变清楚',
      alternatives: ['兰州普通人学AI，先看这三个入口', 'AI创业离兰州还有多远？'],
    },
    douyin: {
      publishCopy: '从实训、协作和创业三个入口，看兰州本地AI机会。',
      topics: ['兰州AI创业', '人工智能'],
    },
    copyReview: 'notes/2026-07-31-兰州OPC大会三入口-发布包装-v1.copy-review.json',
  };

  const validResult = run(process.execPath, [validator, writeRelease('valid', release)]);
  assertPasses('完整V8交付包', validResult);

  const invalid = structuredClone(release);
  invalid.deliveryPackage.status = 'incomplete-delivery';
  invalid.deliveryPackage.cover.aspectRatio = '4:3';
  invalid.deliveryPackage.cover.recommendedFrame = '';
  invalid.deliveryPackage.cover.sourceVideo = 'outputs/other.mp4';
  invalid.deliveryPackage.cover.sourceTimeSeconds = -1;
  invalid.deliveryPackage.cover.prompt = '';
  invalid.deliveryPackage.titles.primary = '';
  invalid.deliveryPackage.titles.alternatives = ['重复标题', '重复标题'];
  invalid.deliveryPackage.douyin.publishCopy = '';
  invalid.deliveryPackage.douyin.topics = [];
  invalid.deliveryPackage.copyReview = '';
  const invalidResult = run(process.execPath, [validator, writeRelease('invalid', invalid)]);
  assertFailsWith('缺项V8交付包', invalidResult, [
    'ready-for-delivery',
    '画幅必须为 3:4',
    '推荐封面人物图',
    'sourceVideo 必须与本条正式成片路径一致',
    '有效截取时间点',
    '3:4真人截图合成封面提示词',
    '抖音主标题',
    '主标题和备选标题不得重复',
    '抖音发布文案',
    '抖音话题',
    '双Skill审稿记录',
  ]);

  console.log('V8完整交付包回归通过：2/2。');
} finally {
  rmSync(tempRoot, {recursive: true, force: true});
}
