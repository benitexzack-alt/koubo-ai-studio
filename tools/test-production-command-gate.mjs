#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {COPYFILE_FICLONE} from 'node:constants';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

import {findRetiredGeneratedStyleFingerprints} from './generated-style-policy.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const testRootRelative = `work/.production-command-gate-test-${process.pid}`;
const testRoot = path.join(projectRoot, testRootRelative);
const validator = 'tools/validate-production-command-gate.mjs';
const personalKb = path.join(testRoot, '个人知识库');
const taskRoot = path.join(personalKb, '.opc-rag', 'tasks');
const ragScript = path.join(
  personalKb,
  '04_Claude Code日常操作',
  'scripts',
  'opc_rag.py',
);

const writeJob = (name, value) => {
  const relativePath = `${testRootRelative}/${name}.json`;
  writeFileSync(
    path.join(projectRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
  return relativePath;
};
const run = (jobPath, command) =>
  spawnSync(process.execPath, [validator, jobPath, command], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {...process.env, KOUBO_PERSONAL_KB: personalKb},
  });
const output = (result) => `${result.stdout ?? ''}${result.stderr ?? ''}`;
const assertPasses = (label, result) => {
  if (result.status !== 0) throw new Error(`${label}应通过：\n${output(result)}`);
};
const assertFailsWith = (label, result, expected) => {
  if (result.status === 0) throw new Error(`${label}应失败，但通过了。`);
  if (!output(result).includes(expected)) {
    throw new Error(`${label}缺少错误“${expected}”：\n${output(result)}`);
  }
};
const sha256 = (filePath) => createHash('sha256')
  .update(readFileSync(filePath))
  .digest('hex');

const writeContext = (name, jobPath, overrides = {}) => {
  const taskId = `task-${name}`;
  const relativePath = `${name}/context.json`;
  const contextPath = path.join(taskRoot, relativePath);
  mkdirSync(path.dirname(contextPath), {recursive: true});
  writeFileSync(
    contextPath,
    `${JSON.stringify(
      {
        schema_version: 'opc-task-context/1.0',
        status: 'context-ready',
        task: {id: taskId, important: true},
        project_route: {project_root: projectRoot},
        receipt_groups: {
          task_original_materials: {
            status: 'complete',
            entries: [{resolved_path: path.join(projectRoot, jobPath)}],
          },
        },
        gate: {formal_execution_allowed: true},
        ...overrides,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return {taskId, contextPath: relativePath};
};

mkdirSync(testRoot, {recursive: true});
try {
  mkdirSync(path.dirname(ragScript), {recursive: true});
  writeFileSync(
    ragScript,
    [
      'import json, pathlib, sys',
      "context_path = pathlib.Path(sys.argv[sys.argv.index('--context') + 1])",
      "context = json.loads(context_path.read_text(encoding='utf-8'))",
      "blocked = context.get('forceBlocked') is True",
      "result = {'status': 'blocked-context-stale' if blocked else 'context-valid', 'gate': {'formal_execution_allowed': not blocked}}",
      'print(json.dumps(result, ensure_ascii=False))',
      'raise SystemExit(1 if blocked else 0)',
      '',
    ].join('\n'),
    'utf8',
  );

  const missingContext = writeJob('missing-context', {formal: {enabled: false}});
  assertFailsWith(
    '缺少上下文时预览',
    run(missingContext, 'preview'),
    '必须绑定 knowledgeContext',
  );
  assertPasses('缺少上下文时只读体检', run(missingContext, 'doctor'));

  const retiredStyle = writeJob('retired-style', {
    formal: {enabled: true},
    styleReferenceIds: ['koubo-paper-construct-v1'],
  });
  for (const blockedCommand of [
    'preview',
    'formal',
    'qa',
    'regression',
    'all',
    'risk-frames',
    'audio-preflight',
    'formal-audio',
    'prepare',
  ]) {
    assertFailsWith(
      `退役风格阻断${blockedCommand}`,
      run(retiredStyle, blockedCommand),
      '退役生成风格硬门',
    );
  }

  const retiredComponent = writeJob('retired-component', {
    formal: {enabled: true},
    layers: [{params: {component: 'paper-construct-video'}}],
  });
  assertFailsWith(
    '退役组件指纹不依赖producer',
    run(retiredComponent, 'preview'),
    'paper-construct-video',
  );

  const retiredPath = writeJob('retired-path', {
    formal: {enabled: true},
    layers: [{asset: {source: 'remotion/public/media/test/user-generated-paper/G01.mp4'}}],
  });
  assertFailsWith(
    '退役路径段指纹不依赖sourceType',
    run(retiredPath, 'qa'),
    '/user-generated-paper/',
  );

  const retiredContentCases = [
    {
      name: 'retired-style-card',
      source: 'workflow/style-library/koubo-paper-construct-v1.json',
      sha256: 'dd32cee295502ec6f03098a48523f0601dd9688749b17d2808a7e3096c972c78',
    },
    {
      name: 'failed-generated-plan',
      source: 'edit/WECHAT_GEO_AAO_20260823_talk01/generated-video-plan_WECHAT_GEO_AAO_20260823_talk01_v1.json',
      sha256: 'ddb5e242f25038dd8b58910fe58427c2e094e056947d9db7fd51d652c6d9e7cd',
    },
    {
      name: 'failed-G01',
      source: 'remotion/public/media/wechat-geo-aao-20260823/user-generated-paper/G01.mp4',
      sha256: 'e0bb0900417c0a5f87d112ded4e3be56af4cd0ad0a9842a2349e15c0ffc70435',
    },
    {
      name: 'failed-G02',
      source: 'remotion/public/media/wechat-geo-aao-20260823/user-generated-paper/G02.mp4',
      sha256: '301660db178f59db7b9a635ae2beacb056288011d1e6e5a913f0129bfef2d79a',
    },
    {
      name: 'failed-G03',
      source: 'remotion/public/media/wechat-geo-aao-20260823/user-generated-paper/G03.mp4',
      sha256: '0a391362db21b8a476830bdd5f6225d4c6d1fab1b082ac2c100b893bbc362deb',
    },
    {
      name: 'failed-G04',
      source: 'remotion/public/media/wechat-geo-aao-20260823/user-generated-paper/G04.mp4',
      sha256: '98e397d8a1464d00f1d1493d454a57a237b070d8d5e0afca59d0812e91b1a92b',
    },
    {
      name: 'xibei-suangge-v1-complete',
      source: path.join(os.homedir(), 'Downloads', '视频 (1).mp4'),
      sha256: 'a243aa778d5b010086db34d276822bcc9d53f7a66919db589da59ef021c5d752',
    },
    {
      name: 'xibei-suangge-v2-complete',
      source: path.join(os.homedir(), 'Downloads', '视频 (2).mp4'),
      sha256: '80d80620f98487ad09aa1a9e7d3f9379f8c153d00c7cea2e76f98ca245cc5ab8',
    },
    {
      name: 'wechat-geo-aao-v80-complete-rejected-output',
      source:
        'work/production-runs/20260823-wechat-geo-aao-v80/rejected-output/' +
        '微信AI_GEO_AAO_16x9_V80_已否决_禁止发布.mp4',
      sha256: '3ba5cef4e0c5ae26e2f70d27c8799cea5d736498d85dcbd00dba2050125e5488',
    },
    {
      name: 'stale-run-manifest',
      source: 'work/production-runs/20260823-wechat-geo-aao-v80/run-manifest.json',
      sha256: '9422d8693466f4145c0b8fa2a74afbf7d0bc27cb8a8250bb9590716b126c4230',
    },
    {
      name: 'stale-formal-audio',
      source: 'work/production-runs/20260823-wechat-geo-aao-v80/stage-success/20260823-wechat-geo-aao-v80.formal-audio.json',
      sha256: 'd21c8432715247ab104919ec56255b1eba060deaa8cf8164a1f34ad7aae46308',
    },
    {
      name: 'stale-formal-qa',
      source: 'work/production-runs/20260823-wechat-geo-aao-v80/stage-success/20260823-wechat-geo-aao-v80.formal-qa.json',
      sha256: 'd92a935211593a1866d2bb0651c034e601ff73ddaf957c4abb1f91d799b62cf9',
    },
    {
      name: 'stale-formal-render',
      source: 'work/production-runs/20260823-wechat-geo-aao-v80/stage-success/20260823-wechat-geo-aao-v80.formal-render.json',
      sha256: 'f40024252b2b4f4ca8650fa8affdf7f4f7fa86a6fc60d15c97509d6c29c04257',
    },
  ];
  for (const [index, retired] of retiredContentCases.entries()) {
    const sourcePath = path.isAbsolute(retired.source)
      ? retired.source
      : path.join(projectRoot, retired.source);
    if (sha256(sourcePath) !== retired.sha256) {
      throw new Error(`${retired.name}测试源 SHA-256 已漂移。`);
    }
    const renamedRelative = `${testRootRelative}/renamed-content-${index}.bin`;
    copyFileSync(
      sourcePath,
      path.join(projectRoot, renamedRelative),
      COPYFILE_FICLONE,
    );
    const renamedJob = writeJob(`renamed-content-job-${index}`, {
      formal: {enabled: true},
      inputs: {fingerprintPaths: [renamedRelative]},
    });
    const result = run(renamedJob, 'preview');
    assertFailsWith(`${retired.name}改名复制仍按内容阻断`, result, 'RETIRED_GENERATED_STYLE');
    assertFailsWith(`${retired.name}错误必须包含目标SHA`, result, retired.sha256);
    if (output(result).includes(projectRoot) || output(result).includes(os.homedir())) {
      throw new Error(`${retired.name}退役错误不得回显绝对路径。`);
    }
  }

  const accidentJobPath = 'workflow/jobs/20260823_wechat_geo_aao_v80.production.json';
  const accidentJob = JSON.parse(
    readFileSync(path.join(projectRoot, accidentJobPath), 'utf8'),
  );
  const accidentHits = findRetiredGeneratedStyleFingerprints(accidentJob, {
    location: '$accidentJob',
    projectRoot,
    documentPaths: [accidentJobPath],
  });
  const accidentHashes = new Set(
    accidentHits.filter((hit) => hit.sha256).map((hit) => hit.sha256),
  );
  for (const expected of [
    '9422d8693466f4145c0b8fa2a74afbf7d0bc27cb8a8250bb9590716b126c4230',
    'd21c8432715247ab104919ec56255b1eba060deaa8cf8164a1f34ad7aae46308',
    'd92a935211593a1866d2bb0651c034e601ff73ddaf957c4abb1f91d799b62cf9',
    'f40024252b2b4f4ca8650fa8affdf7f4f7fa86a6fc60d15c97509d6c29c04257',
  ]) {
    if (!accidentHashes.has(expected)) {
      throw new Error(`事故 job 未递归识别受控旧回执 SHA-256：${expected}`);
    }
  }

  const locked = writeJob('locked', {
    formal: {enabled: false, blockedReason: '等待用户确认预览。'},
  });
  const lockedContext = writeContext('locked', locked);
  const lockedPayload = JSON.parse(
    readFileSync(path.join(projectRoot, locked), 'utf8'),
  );
  lockedPayload.knowledgeContext = lockedContext;
  writeFileSync(
    path.join(projectRoot, locked),
    `${JSON.stringify(lockedPayload, null, 2)}\n`,
    'utf8',
  );
  assertFailsWith('锁定时正式渲染', run(locked, 'formal'), '禁止执行 formal');
  assertFailsWith('锁定时正式音频处理', run(locked, 'formal-audio'), '禁止执行 formal-audio');
  assertFailsWith('锁定时全流程', run(locked, 'all'), '禁止执行 all');
  assertPasses('锁定时预览', run(locked, 'preview'));

  const unlocked = writeJob('unlocked', {formal: {enabled: true}});
  const unlockedContext = writeContext('unlocked', unlocked);
  const unlockedPayload = JSON.parse(
    readFileSync(path.join(projectRoot, unlocked), 'utf8'),
  );
  unlockedPayload.knowledgeContext = unlockedContext;
  writeFileSync(
    path.join(projectRoot, unlocked),
    `${JSON.stringify(unlockedPayload, null, 2)}\n`,
    'utf8',
  );
  assertPasses('明确解锁后正式渲染', run(unlocked, 'formal'));

  const genericGenerated = writeJob('generic-generated', {
    formal: {enabled: true},
    layers: [{
      asset: {
        sourceType: 'user-generated-video',
        source: 'remotion/public/media/test/user-generated-video/G01.mp4',
      },
      assetDecision: {class: 'generated-video', producer: 'user'},
    }],
  });
  const genericAsset = `${testRootRelative}/generic-generated-video.mp4`;
  writeFileSync(path.join(projectRoot, genericAsset), 'ordinary-generated-video');
  const genericGeneratedContext = writeContext('generic-generated', genericGenerated);
  const genericGeneratedPayload = JSON.parse(
    readFileSync(path.join(projectRoot, genericGenerated), 'utf8'),
  );
  genericGeneratedPayload.layers[0].asset.source = genericAsset;
  genericGeneratedPayload.knowledgeContext = genericGeneratedContext;
  writeFileSync(
    path.join(projectRoot, genericGenerated),
    `${JSON.stringify(genericGeneratedPayload, null, 2)}\n`,
    'utf8',
  );
  assertPasses(
    '普通 user/generated-video 不被退役指纹误伤',
    run(genericGenerated, 'preview'),
  );

  const stale = writeJob('stale', {formal: {enabled: true}});
  const staleContext = writeContext('stale', stale, {forceBlocked: true});
  const stalePayload = JSON.parse(readFileSync(path.join(projectRoot, stale), 'utf8'));
  stalePayload.knowledgeContext = staleContext;
  writeFileSync(
    path.join(projectRoot, stale),
    `${JSON.stringify(stalePayload, null, 2)}\n`,
    'utf8',
  );
  assertFailsWith('过期上下文正式渲染', run(stale, 'formal'), 'blocked-context-stale');

  console.log('生产命令门禁回归通过：基础门禁、三类退役指纹与普通生成视频隔离均通过。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
