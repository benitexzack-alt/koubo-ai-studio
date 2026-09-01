#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {createActualFixture} from './test-director-contract-v2.mjs';
import {
  buildDirectorExternalAnchorBindingPayloadV2,
  serializeDirectorExternalAnchorEntryForSignatureV2,
  stableJsonSha256,
  verifyDirectorExternalAnchorEntryV2,
} from './director-contract-v2-core.mjs';
import {buildControlledRemotionRenderArgsV2} from './remotion-production-command-v2.mjs';
import {
  DIRECTOR_PRODUCTION_ENTRY_BINDING_SCHEMA,
  DIRECTOR_PRODUCTION_FREEZE_RECEIPT_SCHEMA,
  DEFAULT_PRODUCTION_FREEZE_REGISTRY,
  assertProductionExternalMessageV2,
  assertProductionEntryPreflightV2,
  collectProductionBoundFilesV2,
  collectRemotionRuntimeGraphV2,
  computeProductionCompositionBindingV2,
  computeProductionGateClosureV2,
  computeProductionJobSnapshotSha256V2,
  stableJsonSha256ForProductionGateV2,
  resolveControlledRemotionCliV2,
  validateControlledRemotionCliBindingV2,
  validateProductionEntryPreflightV2,
} from './director-production-preflight-v2.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(HERE, '../../..');
const runV72 = resolve(projectRoot, 'tools/run-v72-production.mjs');
const controlledRemotion = resolve(HERE, 'run-remotion-production-v2.mjs');
const accidentJob = resolve(projectRoot, 'workflow/jobs/20260823_wechat_geo_aao_v80.production.json');
const testRoot = mkdtempSync(resolve(projectRoot, 'edit/.director-production-gate-test-'));
const sha256Bytes = (value) => createHash('sha256').update(value).digest('hex');
const sha256File = (path) => sha256Bytes(readFileSync(path));
const relativeProject = (path) => relative(projectRoot, path).split('\\').join('/');
const writeJson = (path, value) => {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return {path: relativeProject(path), sha256: sha256File(path)};
};
const ref = (item) => ({path: relativeProject(item.path), sha256: item.sha256});
const sha256Text = (value) => sha256Bytes(value);
const entrypointFor = (command) =>
  JSON.parse(readFileSync(DEFAULT_PRODUCTION_FREEZE_REGISTRY, 'utf8')).entrypointByCommand[command];
const makeSignedExternalAnchor = (receipt, kind) => {
  const {publicKey, privateKey} = generateKeyPairSync('ed25519');
  const receiptBindingPayload = buildDirectorExternalAnchorBindingPayloadV2(receipt, kind);
  const entry = {
    kind,
    status: 'accepted',
    sourceThreadId: receipt.sourceThreadId,
    sourceMessageId: receipt.sourceMessageId,
    sourceMessageSha256: receipt.sourceMessageSha256,
    issuerGroupId: receipt.issuerGroupId,
    explicitAcceptanceQuoteSha256: sha256Text(receipt.explicitAcceptanceQuote),
    receiptBindingPayload,
    receiptBindingSha256: stableJsonSha256(receiptBindingPayload),
    signerKeyId: 'independent-audit-key',
  };
  entry.signatureBase64 = sign(
    null,
    Buffer.from(serializeDirectorExternalAnchorEntryForSignatureV2(entry)),
    privateKey,
  ).toString('base64');
  return {entry, publicKey};
};

const tests = [];
const test = (name, fn) => tests.push({name, fn});

let actual;
let jobPath;
let job;

test('建立真媒体但执行器自造验收回执的恢复候选', () => {
  mkdirSync(join(testRoot, 'director'), {recursive: true});
  actual = createActualFixture({rootOverride: join(testRoot, 'director')});
  const entryPath = join(testRoot, 'remotion', 'entry.tsx');
  mkdirSync(dirname(entryPath), {recursive: true});
  writeFileSync(entryPath, "export {FixtureEntry} from './runtime/component';\n");
  mkdirSync(join(testRoot, 'remotion', 'runtime'), {recursive: true});
  writeFileSync(join(testRoot, 'remotion', 'runtime', 'component.tsx'), "import data from './data.json';\nexport const FixtureEntry = data.ok;\n");
  writeFileSync(join(testRoot, 'remotion', 'runtime', 'data.json'), '{"ok":true}\n');
  writeFileSync(join(testRoot, 'remotion', 'package.json'), '{"name":"director-preflight-case","private":true}\n');
  writeFileSync(join(testRoot, 'remotion', 'package-lock.json'), '{"name":"director-preflight-case","lockfileVersion":3}\n');
  writeFileSync(join(testRoot, 'remotion', 'tsconfig.json'), '{"compilerOptions":{}}\n');
  const publicDir = join(testRoot, 'remotion', 'public');
  mkdirSync(publicDir, {recursive: true});
  writeFileSync(join(publicDir, 'bound-public-asset.txt'), 'public-dir-full-tree-binding\n');
  const contractRef = {path: relativeProject(actual.contractPath), sha256: sha256File(actual.contractPath)};
  const handoffRef = ref(actual.contract.lifecycle.handoff.receipt);
  const freezePath = join(testRoot, 'freeze.json');
  jobPath = join(testRoot, 'job.json');
  job = {
    schemaVersion: 1,
    jobId: 'validator-production-gate-fixture',
    videoId: 'validator-fixture-video',
    productionState: 'ready-for-production',
    experiment: {status: 'candidate-preview-required', userPreviewApproved: false},
    formal: {enabled: false},
    inputs: {
      source: relativeProject(actual.media('candidate.mp4')),
      renderProxy: relativeProject(actual.media('candidate.mp4')),
      screenRecording: relativeProject(actual.media('screen.mp4')),
      visualPlan: relativeProject(actual.media('contract.json')),
      bilingualCaptions: relativeProject(actual.media('transcript.json')),
      sfxCueSheet: relativeProject(actual.media('transcript.json')),
      fingerprintPaths: [],
    },
    remotion: {
      root: relativeProject(join(testRoot, 'remotion')),
      entry: 'entry.tsx',
      publicDir: relativeProject(publicDir),
      compositionWithSfx: 'Fixture-WithSfx',
      compositionWithoutSfx: 'Fixture-NoSfx',
      durationSeconds: 30,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    productionGate: {
      schema: DIRECTOR_PRODUCTION_ENTRY_BINDING_SCHEMA,
      revisionId: 'validator-revision-001',
      state: 'candidate-preview-required',
      userPreviewApproved: false,
      formalEnabled: false,
      directorContract: contractRef,
      handoffReceipt: handoffRef,
      handoffBindingSha256: actual.contract.lifecycle.handoff.bindingSha256,
      freezeReceipt: {path: relativeProject(freezePath), sha256: '0'.repeat(64)},
    },
  };
  const message = '独立监督同意该新修订只进入 candidate preview，正式命令仍冻结。';
  const boundFiles = collectProductionBoundFilesV2({projectRoot, job});
  const closure = computeProductionGateClosureV2({projectRoot});
  const freeze = {
    schema: DIRECTOR_PRODUCTION_FREEZE_RECEIPT_SCHEMA,
    evidenceScope: 'real-e2e',
    decision: 'approved-candidate-revision',
    issuerGroupId: 'independent-production-supervision-group',
    sourceThreadId: 'validator-independent-thread',
    sourceMessageId: 'validator-independent-message',
    explicitAuthorizationQuote: message,
    sourceMessageSha256: sha256Text(message),
    reviewedAt: '2026-08-24T16:00:00+08:00',
    expiresAt: '2099-08-24T16:00:00+08:00',
    jobId: job.jobId,
    revisionId: job.productionGate.revisionId,
    jobSnapshotSha256: computeProductionJobSnapshotSha256V2(job),
    directorContractSha256: contractRef.sha256,
    handoffReceiptSha256: handoffRef.sha256,
    handoffBindingSha256: job.productionGate.handoffBindingSha256,
    boundFiles,
    boundFilesSha256: stableJsonSha256ForProductionGateV2(boundFiles),
    compositionBinding: computeProductionCompositionBindingV2(job),
    gateClosure: closure.files,
    gateClosureSha256: closure.sha256,
    allowedCommands: [
      'doctor', 'fingerprint', 'preview', 'risk-frames', 'audio-preflight', 'prepare',
    ],
  };
  job.productionGate.freezeReceipt = writeJson(freezePath, freeze);
  writeJson(jobPath, job);
  const result = validateProductionEntryPreflightV2({projectRoot, jobPath, job, command: 'preview', entrypoint: entrypointFor('preview')});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DPG2_DIRECTOR_CONTRACT_NOT_ELIGIBLE');
});

test('声明 eligible 的合同配自造 independent issuer 冻结回执仍命中独立签名锚点门', () => {
  assert.equal(actual.contract.lifecycle.state, 'automation-handoff-eligible');
  const freeze = JSON.parse(readFileSync(resolve(projectRoot, job.productionGate.freezeReceipt.path), 'utf8'));
  assert.throws(() => assertProductionExternalMessageV2({
    body: freeze,
    executionGroupId: actual.contract.executionGroupId,
    decision: 'approved-candidate-revision',
    revisionId: job.productionGate.revisionId,
    kind: 'director-production-freeze-authorization',
    codePrefix: 'DPG2_FREEZE_RECEIPT',
  }), (error) => {
    assert.equal(error.code, 'DPG2_FREEZE_RECEIPT_EXTERNAL_ANCHOR_INVALID');
    return true;
  });
});

test('已签名生产冻结锚点不能换绑 job 修订或导演合同 SHA', () => {
  const body = JSON.parse(readFileSync(resolve(projectRoot, job.productionGate.freezeReceipt.path), 'utf8'));
  const receipt = {...body, explicitAcceptanceQuote: body.explicitAuthorizationQuote};
  const signed = makeSignedExternalAnchor(receipt, 'director-production-freeze-authorization');
  assert.equal(verifyDirectorExternalAnchorEntryV2({receipt, kind: 'director-production-freeze-authorization', ...signed}).ok, true);
  for (const tampered of [
    {...receipt, revisionId: 'validator-revision-002'},
    {...receipt, directorContractSha256: '0'.repeat(64)},
  ]) {
    const rejected = verifyDirectorExternalAnchorEntryV2({receipt: tampered, kind: 'director-production-freeze-authorization', ...signed});
    assert.equal(rejected.ok, false);
    assert.match(rejected.reason, /未逐项绑定/);
  }
});

for (const command of ['doctor', 'fingerprint', 'preview', 'risk-frames', 'audio-preflight', 'prepare']) {
  test(`无真实外部锚点时候选命令 ${command} 也不得解冻`, () => {
    const result = validateProductionEntryPreflightV2({projectRoot, jobPath, job, command, entrypoint: entrypointFor(command)});
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.code, 'DPG2_DIRECTOR_CONTRACT_NOT_ELIGIBLE');
  });
}

for (const command of ['formal-audio', 'formal', 'qa', 'regression', 'all', 'direct-remotion-render', 'release-validation']) {
  test(`自造风格交接不能解冻 ${command}`, () => {
    const result = validateProductionEntryPreflightV2({projectRoot, jobPath, job, command, entrypoint: entrypointFor(command)});
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DPG2_DIRECTOR_CONTRACT_NOT_ELIGIBLE');
  });
}

test('未知命令 fail-closed', () => {
  const result = validateProductionEntryPreflightV2({projectRoot, jobPath, job, command: 'invented-command', entrypoint: 'validator-test'});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DPG2_COMMAND_NOT_SUPPORTED');
});

test('调用方 job 对象与磁盘 job 不一致时在深层门禁前拒绝', () => {
  const changed = structuredClone(job);
  changed.remotion.compositionWithSfx = 'Caller-Tampered';
  const result = validateProductionEntryPreflightV2({
    projectRoot,
    jobPath,
    job: changed,
    command: 'preview',
    entrypoint: entrypointFor('preview'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DPG2_JOB_ARGUMENT_DISK_MISMATCH');
});

test('命令不能由非固定 entrypoint 冒充调用', () => {
  const result = validateProductionEntryPreflightV2({projectRoot, jobPath, job, command: 'preview', entrypoint: 'tools/validate-release.mjs'});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DPG2_COMMAND_ENTRYPOINT_MISMATCH');
});

test('Remotion entry 递归 import 图与三份锁文件全量绑定且深层漂移可见', () => {
  const before = collectRemotionRuntimeGraphV2({projectRoot, job});
  const paths = before.map((item) => item.path);
  assert.ok(paths.some((item) => item.endsWith('/remotion/entry.tsx')));
  assert.ok(paths.some((item) => item.endsWith('/remotion/runtime/component.tsx')));
  assert.ok(paths.some((item) => item.endsWith('/remotion/runtime/data.json')));
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) {
    assert.ok(paths.some((item) => item.endsWith(`/remotion/${name}`)));
  }
  const nestedPath = join(testRoot, 'remotion', 'runtime', 'data.json');
  const original = readFileSync(nestedPath);
  try {
    writeFileSync(nestedPath, '{"ok":false}\n');
    const after = collectRemotionRuntimeGraphV2({projectRoot, job});
    assert.notEqual(stableJsonSha256ForProductionGateV2(before), stableJsonSha256ForProductionGateV2(after));
  } finally {
    writeFileSync(nestedPath, original);
  }
});

test('composition 绑定哈希对篡改敏感', () => {
  const changed = structuredClone(job);
  changed.remotion.compositionWithSfx = 'Tampered';
  assert.notEqual(
    stableJsonSha256ForProductionGateV2(computeProductionCompositionBindingV2(changed)),
    stableJsonSha256ForProductionGateV2(computeProductionCompositionBindingV2(job)),
  );
});

test('job publicDir 被显式写入 composition binding 且目录文件进入全量哈希清单', () => {
  assert.equal(computeProductionCompositionBindingV2(job).publicDir, job.remotion.publicDir);
  const bound = collectProductionBoundFilesV2({projectRoot, job});
  assert.ok(bound.some((item) => item.path.endsWith('/remotion/public/bound-public-asset.txt')));
  const renderArgs = buildControlledRemotionRenderArgsV2({
    entryRelative: 'entry.tsx',
    composition: 'Fixture-WithSfx',
    output: '/tmp/never-rendered.mp4',
    publicDir: resolve(projectRoot, job.remotion.publicDir),
  });
  assert.ok(renderArgs.includes(`--public-dir=${resolve(projectRoot, job.remotion.publicDir)}`));
});

test('受控 Remotion CLI 允许项目内 .bin symlink 并绑定真实目标 SHA', () => {
  const cli = resolveControlledRemotionCliV2({projectRoot});
  assert.equal(cli.linkPathRelative, 'remotion/node_modules/.bin/remotion');
  assert.equal(cli.realTargetRelative, 'remotion/node_modules/@remotion/cli/remotion-cli.js');
  assert.equal(cli.targetSha256, 'a10a711f052487d302dcf52dc08729c84c4deca0dc41c5b708edd1a7b7b48bfa');
  assert.equal(computeProductionCompositionBindingV2(job).controlledRemotionCli.targetSha256, cli.targetSha256);
});

test('Remotion CLI symlink 指向项目依赖目录外时稳定拒绝', () => {
  const fakeRoot = join(testRoot, 'external-cli-case');
  const linkDir = join(fakeRoot, 'remotion/node_modules/.bin');
  const externalTarget = join(testRoot, 'outside-dependencies-remotion-cli.js');
  mkdirSync(linkDir, {recursive: true});
  writeFileSync(externalTarget, '#!/usr/bin/env node\n');
  symlinkSync(externalTarget, join(linkDir, 'remotion'));
  assert.throws(() => validateControlledRemotionCliBindingV2({
    projectRoot: fakeRoot,
    binding: {
      linkPath: 'remotion/node_modules/.bin/remotion',
      allowedRealpath: 'remotion/node_modules/@remotion/cli/remotion-cli.js',
      targetSha256: sha256File(externalTarget),
    },
  }), (error) => {
    assert.equal(error.code, 'DPG2_REMOTION_CLI_REALPATH_MISMATCH');
    return true;
  });
});

test('Remotion CLI 真实目标内容漂移时 SHA 门稳定拒绝', () => {
  const registry = JSON.parse(readFileSync(DEFAULT_PRODUCTION_FREEZE_REGISTRY, 'utf8'));
  assert.throws(() => validateControlledRemotionCliBindingV2({
    projectRoot,
    binding: {...registry.controlledRemotionCli, targetSha256: '0'.repeat(64)},
  }), (error) => {
    assert.equal(error.code, 'DPG2_REMOTION_CLI_TARGET_SHA_MISMATCH');
    return true;
  });
});

test('release 校验器与生产 release 门已进入闭包且 release 命令受冻结注册表约束', () => {
  const closurePaths = computeProductionGateClosureV2({projectRoot}).files.map((item) => item.path);
  assert.ok(closurePaths.includes('tools/validate-release.mjs'));
  assert.ok(closurePaths.includes('tools/release-production-gate-v2.mjs'));
  assert.ok(closurePaths.includes('tools/generated-video-plan-v2-core.mjs'));
  assert.equal(closurePaths.includes('tools/runninghub-generated-video-client.mjs'), false);
  assert.equal(closurePaths.includes('tools/run-runninghub-generated-video.mjs'), false);
  assert.ok(closurePaths.includes('tools/runninghub-generated-video-v2-adapter.mjs'));
  assert.ok(closurePaths.includes('tools/qa-generated-video-v2.mjs'));
  assert.ok(closurePaths.includes('tools/video-quality-metrics-v2.mjs'));
  assert.ok(closurePaths.includes('workflow/director-production-freeze-registry.v2.json'));
  assert.equal(closurePaths.includes('skills/koubo-remotion-director/fixtures/production-freeze-registry.v2.json'), false);
  const registry = JSON.parse(readFileSync(DEFAULT_PRODUCTION_FREEZE_REGISTRY, 'utf8'));
  assert.ok(registry.supportedCommands.includes('release-validation'));
  assert.ok(registry.formalCommandsRequireSeparateAuthorization.includes('release-validation'));
  const generatedCommands = registry.supportedCommands.filter((item) => item.startsWith('generated-video-'));
  assert.deepEqual(generatedCommands, []);
  assert.deepEqual(registry.candidateRevisionAllowedCommands.filter((item) => item.startsWith('generated-video-')), []);
  const fixtureMirror = JSON.parse(readFileSync(resolve(HERE, '../fixtures/production-freeze-registry.v2.json'), 'utf8'));
  assert.equal(fixtureMirror.fixtureMirrorOf, 'workflow/director-production-freeze-registry.v2.json');
  for (const key of ['supportedCommands', 'candidateRevisionAllowedCommands', 'formalCommandsRequireSeparateAuthorization', 'controlledRemotionCli', 'entrypointByCommand', 'blockedJobFiles', 'retiredOutputSha256']) {
    assert.deepEqual(fixtureMirror[key], registry[key]);
  }
});

const snapshotSelected = (paths) => Object.fromEntries(paths.map((path) => {
  if (!existsSync(path)) return [path, null];
  const stat = statSync(path);
  return [path, {bytes: stat.size, sha256: stat.isFile() ? sha256File(path) : null}];
}));

test('事故 job 的 11 个命令均在报告/锁/输出写入前冻结', () => {
  const controlled = [
    accidentJob,
    resolve(projectRoot, 'work/production-runs/20260823-wechat-geo-aao-v80/run-manifest.json'),
    resolve(projectRoot, 'work/production-runs/20260823-wechat-geo-aao-v80/timing-report.json'),
    resolve(projectRoot, 'work/production-runs/20260823-wechat-geo-aao-v80/regression-report.json'),
    resolve(projectRoot, 'work/production-runs/20260823-wechat-geo-aao-v80/rejected-output/微信AI_GEO_AAO_16x9_V80_已否决_禁止发布.mp4'),
    resolve(projectRoot, 'outputs/微信AI_GEO_AAO_16x9_V80_有音效_候选成片_v1.mp4'),
  ];
  const lockRoot = resolve(projectRoot, 'work/production-runs/20260823-wechat-geo-aao-v80');
  const lockListingBefore = existsSync(lockRoot)
    ? readdirSync(lockRoot, {recursive: true}).filter((name) => String(name).endsWith('.lock')).sort()
    : [];
  const before = snapshotSelected(controlled);
  const commands = ['doctor', 'fingerprint', 'preview', 'risk-frames', 'audio-preflight', 'formal-audio', 'prepare', 'formal', 'qa', 'regression', 'all'];
  for (const command of commands) {
    const result = spawnSync(process.execPath, [runV72, relativeProject(accidentJob), command], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {...process.env, HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9'},
    });
    assert.equal(result.status, 1, `${command}\n${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /DPG2_FROZEN_JOB_REVISION/u);
  }
  const after = snapshotSelected(controlled);
  assert.deepEqual(after, before, '受控 job/报告/输出字节发生了变化');
  const lockListingAfter = existsSync(lockRoot)
    ? readdirSync(lockRoot, {recursive: true}).filter((name) => String(name).endsWith('.lock')).sort()
    : [];
  assert.deepEqual(lockListingAfter, lockListingBefore, '冻结拒绝前不得创建锁');
});

test('当前事故 production compositions 经唯一 wrapper 在 Remotion spawn 前冻结', () => {
  const jobBody = JSON.parse(readFileSync(accidentJob, 'utf8'));
  assert.ok(jobBody.remotion.compositionWithSfx);
  assert.ok(jobBody.remotion.compositionWithoutSfx);
  const outputs = [
    resolve(projectRoot, jobBody.preview.output),
    resolve(projectRoot, jobBody.formal.rawOutput),
  ];
  const before = snapshotSelected(outputs);
  for (const invocation of [
    ['preview'],
    ['preview', '--no-sfx'],
    ['formal'],
  ]) {
    const result = spawnSync(process.execPath, [controlledRemotion, relativeProject(accidentJob), ...invocation], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {...process.env, HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9'},
    });
    assert.equal(result.status, 1, `${invocation.join(' ')}\n${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /DPG2_FROZEN_JOB_REVISION/u);
  }
  assert.deepEqual(snapshotSelected(outputs), before);
});

let passed = 0;
try {
  for (const item of tests) {
    await item.fn();
    passed += 1;
    console.log(`PASS ${item.name}`);
  }
  console.log(`RESULT ${passed}/${tests.length} passed; skipped=0; networkCalls=0`);
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
