#!/usr/bin/env node

import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir, tmpdir} from 'node:os';
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
const sha256 = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');
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
  const promptPath = join(tempRoot, 'series-cover-prompt.md');
  writeFileSync(
    promptPath,
    '超哥AI创业记 3:4 1080×1440 唯一人物素材 禁止重新生成人脸 知识结构 路径 真实场景\n',
  );
  const humanizerPath = join(
    process.env.CODEX_HOME ?? join(homedir(), '.codex'),
    'skills/humanizer-zh/SKILL.md',
  );
  const kouboHumanizerPath = join(
    projectRoot,
    'skills/humanize-koubo-script/SKILL.md',
  );
  const copyReviewPath = writeRelease('copy-review', {
    schema_version: 1,
    status: 'passed',
    draft: {
      path: promptPath,
      sha256: sha256(promptPath),
    },
    skills: {
      humanizer_zh: {
        path: humanizerPath,
        sha256: sha256(humanizerPath),
        read: true,
      },
      humanize_koubo_script: {
        path: kouboHumanizerPath,
        sha256: sha256(kouboHumanizerPath),
        read: true,
      },
    },
    scores: {
      fact_fidelity: 10,
    },
  });

  release.productionProfile = {
    id: 'v8-semantic-continuity-sfx',
    version: 'V8',
  };
  const spokenPolicy = writeRelease('spoken-policy', {
    schemaVersion: 1,
    canonicalSource: 'recorded-audio',
    scriptRole: 'comparison-only',
    captionTextPolicy: 'spoken-verbatim',
    englishTranslationSource: 'canonical-spoken-chinese',
    compliance: {
      status: 'known-exception-user-accepted',
      exceptionReleaseId: release.releaseId,
    },
  });
  release.inputs.spokenSourcePolicy = spokenPolicy;
  release.userReview.transcriptMismatchAccepted = true;
  release.userReview.transcriptMismatchEvidence = '回归测试中的单条已知例外。';
  release.qa.spokenSource = {
    status: 'known-exception-user-accepted',
    verifier: 'spoken-source-v1',
    evidence: '回归测试中的单条已知例外。',
  };
  release.qa.captionSync = {
    status: 'known-exception-user-accepted',
    verifier: 'spoken-source-v1',
    evidence: '回归测试中的字幕文字与时间窗单条例外。',
  };
  release.deliveryPackage = {
    status: 'ready-for-delivery',
    cover: {
      aspectRatio: '3:4',
      recommendedFrame,
      sourceVideo: release.production.formalOutput,
      sourceTimeSeconds: 3,
      sourceType: 'current-final-video-real-frame',
      prompt: promptPath,
      template: 'templates/10-超哥AI创业记_3比4系列封面提示词母版.md',
    },
    titles: {
      primary: '兰州做AI创业，三个入口正在变清楚',
      alternatives: ['兰州普通人学AI，先看这三个入口', 'AI创业离兰州还有多远？'],
    },
    douyin: {
      publishCopy: '从实训、协作和创业三个入口，看兰州本地AI机会。',
      topics: ['兰州AI创业', '人工智能'],
    },
    copyReview: copyReviewPath,
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
  invalid.deliveryPackage.cover.template = '';
  invalid.deliveryPackage.titles.primary = '';
  invalid.deliveryPackage.titles.alternatives = ['重复标题', '重复标题'];
  invalid.deliveryPackage.douyin.publishCopy = '';
  invalid.deliveryPackage.douyin.topics = [];
  invalid.deliveryPackage.copyReview = '';
  invalid.inputs.spokenSourcePolicy = '';
  const invalidResult = run(process.execPath, [validator, writeRelease('invalid', invalid)]);
  assertFailsWith('缺项V8交付包', invalidResult, [
    'ready-for-delivery',
    '画幅必须为 3:4',
    '推荐封面人物图',
    'sourceVideo 必须与本条正式成片路径一致',
    '有效截取时间点',
    '3:4真人截图合成封面提示词',
    '系列母版',
    '抖音主标题',
    '主标题和备选标题不得重复',
    '抖音发布文案',
    '抖音话题',
    '双Skill审稿记录',
    '实录来源策略文件',
  ]);

  console.log('V8完整交付包回归通过：2/2。');
} finally {
  rmSync(tempRoot, {recursive: true, force: true});
}
