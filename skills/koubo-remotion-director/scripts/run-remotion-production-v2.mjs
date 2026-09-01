#!/usr/bin/env node

import {createHash, randomUUID} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync} from 'node:fs';
import {basename, dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';

import {
  DEFAULT_PRODUCTION_PROJECT_ROOT,
  assertProductionEntryPreflightV2,
  assertProductionPreflightStillCurrentV2,
  resolveControlledRemotionCliV2,
} from './director-production-preflight-v2.mjs';
import {buildControlledRemotionRenderArgsV2} from './remotion-production-command-v2.mjs';

const projectRoot = DEFAULT_PRODUCTION_PROJECT_ROOT;
const args = process.argv.slice(2);
const positional = args.filter((item) => !item.startsWith('--'));
const flags = new Set(args.filter((item) => item.startsWith('--')));
const [jobArgument, mode] = positional;
const variant = flags.has('--no-sfx') ? 'no-sfx' : 'with-sfx';

const fail = (code, message) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};

const sha256Bytes = (value) => createHash('sha256').update(value).digest('hex');
const sha256File = (path) => sha256Bytes(readFileSync(path));

const assertNoSymlinkSegments = (absolute, label) => {
  const relation = relative(projectRoot, absolute);
  let cursor = projectRoot;
  for (const segment of relation.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      fail('RRPV2_PATH_SYMLINK', `${label}不得经过符号链接。`);
    }
  }
};

const resolveInside = (pathValue, label, {mustExist = true} = {}) => {
  if (typeof pathValue !== 'string' || !pathValue.trim()) fail('RRPV2_PATH_REQUIRED', `${label}路径为空。`);
  const absolute = isAbsolute(pathValue) ? resolve(pathValue) : resolve(projectRoot, pathValue);
  const relation = relative(projectRoot, absolute);
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    fail('RRPV2_PATH_OUTSIDE', `${label}必须位于口播项目内。`);
  }
  if (mustExist && !existsSync(absolute)) fail('RRPV2_PATH_MISSING', `${label}不存在：${pathValue}`);
  assertNoSymlinkSegments(absolute, label);
  return absolute;
};

const safeRenderEnvironment = () => {
  const env = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL']) {
    if (typeof process.env[key] === 'string') env[key] = process.env[key];
  }
  env.NODE_ENV = 'production';
  env.NO_PROXY = '127.0.0.1,localhost';
  env.no_proxy = '127.0.0.1,localhost';
  return env;
};

const assertOutputSlot = (output) => {
  const parent = dirname(output);
  if (!existsSync(parent) || !lstatSync(parent).isDirectory() || realpathSync(parent) !== parent) {
    fail('RRPV2_OUTPUT_PARENT_INVALID', '受控输出父目录必须预先存在、位于项目内且不是符号链接。');
  }
  assertNoSymlinkSegments(parent, '受控输出父目录');
  if (existsSync(output)) fail('RRPV2_OUTPUT_ALREADY_EXISTS', '受控渲染输出已存在，禁止覆盖。');
};

if (!jobArgument || !['preview', 'formal'].includes(mode) || positional.length !== 2 || [...flags].some((flag) => flag !== '--no-sfx')) {
  console.error('用法：node skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs <job.json> <preview|formal> [--no-sfx]');
  process.exit(1);
}

let jobPath;
let job;
try {
  jobPath = resolveInside(jobArgument, '生产 job');
  job = JSON.parse(readFileSync(jobPath, 'utf8'));
} catch (error) {
  console.error(`受控 Remotion 入口拒绝：[${error?.code ?? 'RRPV2_JOB_INVALID'}] ${error.message}`);
  process.exit(1);
}

const gateCommand = mode === 'preview' ? 'direct-remotion-preview' : 'direct-remotion-render';
let initialPreflight;
try {
  initialPreflight = assertProductionEntryPreflightV2({
    projectRoot,
    jobPath,
    job,
    command: gateCommand,
    entrypoint: 'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs',
  });
} catch (error) {
  console.error(`受控 Remotion 入口冻结：[${error?.code ?? 'DPG2_UNEXPECTED'}] ${error.message}`);
  process.exit(1);
}

try {
  if (mode === 'formal' && variant !== 'with-sfx') {
    fail('RRPV2_FORMAL_WITH_SFX_ONLY', '正式路由只允许已授权的 WithSfx composition。');
  }
  const remotionRoot = resolveInside(job.remotion?.root, 'Remotion 根目录');
  if (!lstatSync(remotionRoot).isDirectory()) fail('RRPV2_REMOTION_ROOT_INVALID', 'Remotion 根路径必须是目录。');
  const publicDir = resolveInside(job.remotion?.publicDir, 'Remotion publicDir');
  if (!lstatSync(publicDir).isDirectory()) fail('RRPV2_PUBLIC_DIR_INVALID', 'Remotion publicDir 必须是已绑定目录。');
  const entry = resolveInside(`${job.remotion.root.replace(/\/$/u, '')}/${job.remotion.entry.replace(/^\//u, '')}`, 'Remotion entry');
  const composition = variant === 'no-sfx' ? job.remotion?.compositionWithoutSfx : job.remotion?.compositionWithSfx;
  if (typeof composition !== 'string' || !composition.trim()) fail('RRPV2_COMPOSITION_REQUIRED', '当前变体未绑定 composition。');
  const outputValue = mode === 'formal' ? job.formal?.rawOutput : job.preview?.output;
  const output = resolveInside(outputValue, '受控渲染输出', {mustExist: false});
  assertOutputSlot(output);
  const claimId = randomUUID();
  const claimPath = resolve(dirname(output), `.${basename(output)}.render-claim.${claimId}.json`);
  writeFileSync(claimPath, `${JSON.stringify({
    schema: 'director-remotion-output-claim/v2',
    claimId,
    jobId: job.jobId,
    revisionId: job.productionGate?.revisionId,
    mode,
    variant,
    output,
    preflightIntegritySealSha256: initialPreflight.integritySealSha256,
    claimedAt: new Date().toISOString(),
  }, null, 2)}\n`, {flag: 'wx', mode: 0o600});
  assertOutputSlot(output);
  const preSpawn = assertProductionPreflightStillCurrentV2({
    preflight: initialPreflight,
    projectRoot,
    jobPath,
    job,
    command: gateCommand,
    entrypoint: 'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs',
  });
  const cli = resolveControlledRemotionCliV2({projectRoot});
  const renderArgs = buildControlledRemotionRenderArgsV2({
    entryRelative: relative(remotionRoot, entry),
    composition,
    output,
    publicDir,
  });
  const result = spawnSync(cli.realTarget, renderArgs, {
    cwd: remotionRoot,
    stdio: 'inherit',
    env: safeRenderEnvironment(),
  });
  if (result.error || result.status !== 0) {
    fail('RRPV2_REMOTION_RENDER_FAILED', `Remotion 渲染失败，退出码 ${result.status ?? 'unknown'}。`);
  }
  if (!existsSync(output) || !lstatSync(output).isFile() || lstatSync(output).isSymbolicLink()) {
    fail('RRPV2_OUTPUT_NOT_REGULAR_FILE', 'Remotion 返回成功但没有形成普通输出文件。');
  }
  const postRender = assertProductionPreflightStillCurrentV2({
    preflight: preSpawn,
    projectRoot,
    jobPath,
    job,
    command: gateCommand,
    entrypoint: 'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs',
  });
  const receiptId = randomUUID();
  const receiptPath = resolve(dirname(output), `.${basename(output)}.production-receipt.${receiptId}.json`);
  const receipt = {
    schema: 'director-controlled-remotion-render-receipt/v2',
    receiptId,
    renderedAt: new Date().toISOString(),
    jobId: job.jobId,
    revisionId: job.productionGate?.revisionId,
    mode,
    variant,
    command: gateCommand,
    entrypoint: 'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs',
    outputClaim: {path: claimPath, sha256: sha256File(claimPath), claimId},
    output: {path: output, sha256: sha256File(output), bytes: statSync(output).size},
    cli: {realTarget: cli.realTarget, sha256: cli.targetSha256},
    renderArgsSha256: sha256Bytes(JSON.stringify(renderArgs)),
    preflightIntegritySealSha256: initialPreflight.integritySealSha256,
    immediatelyBeforeSpawnIntegritySealSha256: preSpawn.integritySealSha256,
    afterRenderIntegritySealSha256: postRender.integritySealSha256,
  };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx', mode: 0o600});
  console.log(`受控 Remotion 渲染完成：${relative(projectRoot, output).split(sep).join('/')}；回执：${relative(projectRoot, receiptPath).split(sep).join('/')}`);
} catch (error) {
  console.error(`受控 Remotion 入口失败：[${error?.code ?? 'RRPV2_UNEXPECTED'}] ${error.message}`);
  process.exit(1);
}
