#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {SCOPED_DIRECT_EXPORT as S, SCOPED_DIRECT_EXPORT_GATE_FILES} from './scoped-direct-export-core.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const root = realpathSync(mkdtempSync(resolve(os.tmpdir(), 'koubo-scoped-direct-export-test-')));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const put = (path, value) => {
  mkdirSync(dirname(resolve(root, path)), {recursive: true});
  const bytes = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(resolve(root, path), bytes);
  return {path, sha256: sha(bytes)};
};
const copied = new Set();
function copyModule(path) {
  if (copied.has(path)) return;
  copied.add(path);
  mkdirSync(dirname(resolve(root, path)), {recursive: true});
  copyFileSync(resolve(projectRoot, path), resolve(root, path));
  if (!path.endsWith('.mjs')) return;
  const source = readFileSync(resolve(projectRoot, path), 'utf8');
  for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
    if (!match[1].startsWith('.')) continue;
    const dependency = resolve(dirname(resolve(projectRoot, path)), match[1]).slice(projectRoot.length + 1);
    copyModule(dependency);
  }
}
const protectedPaths = [
  'workflow/director-production-freeze-registry.v2.json',
  'skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs',
  'skills/koubo-remotion-director/fixtures/external-acceptance-anchor-registry.v2.json',
];
const before = protectedPaths.map((path) => sha(readFileSync(resolve(projectRoot, path))));
let cases = 0;

try {
  for (const path of [...SCOPED_DIRECT_EXPORT_GATE_FILES,
    'tools/release-production-gate-v2.mjs', 'tools/validate-release.mjs', 'tools/validate-v8-production-contract.mjs',
    'workflow/production-baseline.v1.json',
    ...protectedPaths]) copyModule(path);
  const modulePath = resolve(root, 'tools/scoped-direct-export-core.mjs');
  const originalModule = readFileSync(modulePath, 'utf8');
  const api = await import(pathToFileURL(modulePath));
  const episode = `edit/${S.episodeId}`;
  const publicDir = `remotion/public/${S.episodeId}`;
  const evidence = put(`${episode}/authorization.jsonl`, [
    JSON.stringify({type: 'response_item', payload: {type: 'message', role: 'user', content: [{type: 'input_text', text: '不要预览，直接正式出片。'}]}}),
    JSON.stringify({type: 'event_msg', payload: {type: 'user_message', message: '那就抓紧修复呀，赶紧出片呀'}}),
  ].join('\n'));
  const media = {
    source: put(`${episode}/source.mp4`, 'isolated-source-fixture'),
    renderProxy: put(`${publicDir}/proxy.mp4`, 'isolated-proxy-fixture'),
    transcript: put(`${episode}/transcript.json`, {words: [{text: '实录测试'}]}),
    bilingualCaptions: put(`${episode}/captions.json`, [{zh: '实录测试', en: 'Recorded test'}]),
    spokenSourcePolicy: put(`${episode}/spoken.json`, {schemaVersion: 1, canonicalSource: 'recorded-audio',
      scriptRole: 'comparison-only', captionTextPolicy: 'spoken-verbatim', englishTranslationSource: 'canonical-spoken-chinese',
      compliance: {status: 'passed'}}),
  };
  const videos = Array.from({length: 6}, (_, index) => ({
    ...put(`${publicDir}/manual-${index}.mp4`, `isolated-manual-video-${index}`), provenance: 'user-generated-manual-import',
  }));
  put(S.entry, 'export const fixture = "no renderer is invoked";\n');
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) put(`remotion/${name}`, {});
  const cliPath = 'remotion/node_modules/@remotion/cli/remotion-cli.js';
  const cli = put(cliPath, 'throw new Error("test must never render");\n');
  mkdirSync(resolve(root, 'remotion/node_modules/.bin'), {recursive: true});
  symlinkSync('../@remotion/cli/remotion-cli.js', resolve(root, 'remotion/node_modules/.bin/remotion'));
  const registry = JSON.parse(readFileSync(resolve(root, protectedPaths[0]), 'utf8'));
  registry.controlledRemotionCli.targetSha256 = cli.sha256;
  put(protectedPaths[0], registry);
  const taskId = S.directorTaskId;
  const artifact = (key, body) => put(`${episode}/${key}.json`, {taskId, ...body});
  const artifacts = {
    preproductionRequest: put(api.SCOPED_PRESHOOT_ARTIFACTS.preproductionRequest, {taskId}),
    routeLock: put(api.SCOPED_PRESHOOT_ARTIFACTS.routeLock, {taskId, branch: 'paper-editorial', fallback: 'blocked', genericInformationCardCanSatisfyPaperBeat: false}),
    preproductionPlan: put(api.SCOPED_PRESHOOT_ARTIFACTS.preproductionPlan, {taskId, paperScenes: [{id: 'B01'}]}),
    preproductionValidation: put(api.SCOPED_PRESHOOT_ARTIFACTS.preproductionValidation, {taskId, skillExecuted: true}),
    postshootRequest: artifact('post-request', {}),
    postshootPlan: artifact('post-plan', {spokenAuthority: 'recorded-audio', scriptRole: 'comparison-only'}),
    postshootValidation: artifact('post-validation', {skillExecuted: false}),
  };
  const profile = JSON.parse(readFileSync(resolve(root, 'workflow/active-director-profile.v1.json'), 'utf8'));
  const baseline = JSON.parse(readFileSync(resolve(root, 'workflow/production-baseline.v1.json'), 'utf8'));
  const visualPlan = {schemaVersion: 4, videoId: S.episodeId, videoTitle: '隔离合同测试', sourceVideo: media.source.path,
    baselineId: baseline.baselineId, styleReferenceIds: [], experiment: {id: 'v8-semantic-continuity-sfx', status: S.state},
    previewCoverage: [], layers: []};
  const job = {
    schemaVersion: 1, jobId: S.jobId, videoId: S.episodeId, productionState: 'ready-for-production',
    experiment: {id: 'v8-semantic-continuity-sfx', status: S.state, userPreviewApproved: false},
    inputs: {...Object.fromEntries(Object.entries(media).map(([key, value]) => [key, value.path])),
      visualPlan: put(`${episode}/visual.json`, visualPlan).path,
      sfxCueSheet: put(`${episode}/sfx.json`, {cues: []}).path,
      fingerprintPaths: [S.manifestPath, ...SCOPED_DIRECT_EXPORT_GATE_FILES, evidence.path,
        ...Object.values(media).map((ref) => ref.path), ...Object.values(artifacts).map((ref) => ref.path)]},
    director: {required: true, profileId: profile.profileId, profileVersion: profile.profileVersion, taskId,
      phase: 'post-shoot', paperRequired: true, fallback: 'blocked', artifacts},
    remotion: {root: 'remotion', entry: 'src/gpt6-cybercab-v8-r1/index.tsx', publicDir,
      compositionWithSfx: S.composition, durationSeconds: 1, fps: 30, width: 1920, height: 1080},
    preview: {output: null, ranges: [], renderWithoutSfxComparison: false},
    riskFrames: {enabled: true, fullResolution: true, outputDirectory: S.riskFrameDirectory},
    formal: {enabled: true, rawOutput: `${episode}/raw.mp4`, finalOutput: `${episode}/final.mp4`},
    productionGate: {schema: 'director-production-entry-binding/v2', route: S.route, state: S.state,
      revisionId: S.revisionId, userPreviewApproved: false, formalEnabled: true,
      scopedDirectExport: {path: S.manifestPath, sha256: '0'.repeat(64)}},
  };
  const manualReceipt = {
    schema: 'koubo-scoped-manual-postshoot/v1', taskId, episodeId: S.episodeId, jobId: S.jobId, revisionId: S.revisionId,
    phase: 'post-shoot', status: 'manual-import-bound', provenance: 'user-generated-manual-import',
    skillExecuted: false, skillPackageAccepted: false, userPreviewApproved: false,
    spokenAuthority: 'recorded-audio', scriptRole: 'comparison-only',
    bindings: {...Object.fromEntries(Object.entries(artifacts).filter(([key]) => key !== 'postshootValidation')),
      ...Object.fromEntries(['source', 'transcript', 'bilingualCaptions', 'spokenSourcePolicy'].map((key) => [key, media[key]])),
      visualPlan: {path: job.inputs.visualPlan, sha256: sha(readFileSync(resolve(root, job.inputs.visualPlan)))},
      compositionEntry: {path: S.entry, sha256: sha(readFileSync(resolve(root, S.entry))) }},
    generatedVideos: videos,
  };
  artifacts.postshootValidation = put(artifacts.postshootValidation.path, manualReceipt);
  put(S.jobPath, job);
  const manifest = {
    schema: S.schema, route: S.route, episodeId: S.episodeId, jobId: S.jobId, revisionId: S.revisionId, jobPath: S.jobPath,
    authorization: {kind: 'verified-user-direct-export', evidence, format: 'codex-rollout-jsonl',
      directExportMessage: {line: 2, quote: '那就抓紧修复呀，赶紧出片呀'},
      skipPreviewMessage: {line: 1, quote: '不要预览，直接正式出片。'}, independentSignature: false},
    media, generatedVideos: videos, ...api.collectScopedDirectExportBindings({projectRoot: root, job}),
    outputs: {rawOutput: job.formal.rawOutput, finalOutput: job.formal.finalOutput},
    allowedCommands: ['doctor', 'fingerprint', 'risk-frames', 'formal', 'formal-audio', 'qa', 'release-validation'],
    constraints: {previewApproved: false, fullWatchConfirmed: false, publishAuthorized: false, providerCallsAllowed: false},
  };
  const seal = (m = manifest, j = job, pin = true) => {
    const ref = put(S.manifestPath, m);
    j.productionGate.scopedDirectExport.sha256 = ref.sha256;
    put(S.jobPath, j);
    writeFileSync(modulePath, originalModule.replace(/export const SCOPED_DIRECT_EXPORT_MANIFEST_SHA256 = (?:null|'[a-f0-9]{64}');/u,
      `export const SCOPED_DIRECT_EXPORT_MANIFEST_SHA256 = ${pin ? `'${ref.sha256}'` : 'null'};`));
  };
  const run = (command = 'formal', expression = null) => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', expression ?? `
      import {readFileSync} from 'node:fs';
      import {assertScopedDirectExport} from './tools/scoped-direct-export-core.mjs';
      const job = JSON.parse(readFileSync(${JSON.stringify(S.jobPath)}, 'utf8'));
      try { const result = assertScopedDirectExport({projectRoot: process.cwd(), job, command: ${JSON.stringify(command)}}); console.log(JSON.stringify({ok: result.ok})); }
      catch (error) { console.log(JSON.stringify({ok: false, code: error.code, message: error.message})); }
    `], {cwd: root, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout.trim());
  };
  const expect = (code, label, command) => {
    const result = run(command);
    assert.equal(result.code, code, `${label}: ${JSON.stringify(result)}`);
    cases++;
  };
  seal();
  assert.equal(run().ok, true); cases++;
  assert.equal(run('risk-frames').ok, true); cases++;
  const noRiskPermission = {...manifest, allowedCommands: manifest.allowedCommands.filter((command) => command !== 'risk-frames')};
  seal(noRiskPermission); expect('SDE_COMMAND', '清单未授权风险帧', 'risk-frames');
  for (const change of [
    (j) => { j.riskFrames.outputDirectory = `edit/${S.episodeId}/other-frames`; },
    (j) => { j.riskFrames.outputDirectory = 'edit/old-task/formal-r1/frames'; },
    (j) => { j.riskFrames.fullResolution = false; },
    (j) => { j.riskFrames.enabled = false; },
  ]) {
    const changed = structuredClone(job); change(changed);
    seal(manifest, changed); expect('SDE_RISK_FRAME_SCOPE', '风险帧范围不能扩大或降级', 'risk-frames');
  }
  seal();
  mkdirSync(dirname(resolve(root, S.riskFrameDirectory)), {recursive: true});
  symlinkSync(resolve(root, publicDir), resolve(root, S.riskFrameDirectory));
  expect('SDE_SYMLINK', '风险帧目录不能通过链接转向其他位置', 'risk-frames');
  rmSync(resolve(root, S.riskFrameDirectory));
  const visualResult = spawnSync(process.execPath, ['tools/validate-visual-plan.mjs', job.inputs.visualPlan], {cwd: root, encoding: 'utf8'});
  assert.equal(visualResult.status, 0, `${visualResult.stdout}\n${visualResult.stderr}`); cases++;
  const otherJob = run('formal', `
    import {readFileSync} from 'node:fs';
    import {assertScopedDirectExport} from './tools/scoped-direct-export-core.mjs';
    const job = JSON.parse(readFileSync(${JSON.stringify(S.jobPath)}, 'utf8'));
    try { assertScopedDirectExport({projectRoot: process.cwd(), job, jobPath: 'workflow/jobs/copied-old-task.json'}); console.log('{}'); }
    catch (error) { console.log(JSON.stringify({code: error.code})); }
  `);
  assert.equal(otherJob.code, 'SDE_SCOPE'); cases++;
  for (const command of ['preview', 'all', 'direct-remotion-render', 'publish', 'regression']) expect('SDE_COMMAND', `越权命令 ${command}`, command);
  seal(manifest, job, false); expect('SDE_PIN_NOT_SET', '未固定摘要');
  seal(); put(S.manifestPath, {...manifest, episodeId: 'old-task'}); expect('SDE_FILE_SHA', '清单篡改');
  for (const [key, value, code] of [['jobId', '20260823-wechat-geo-aao-v80', 'SDE_SCOPE'], ['videoId', 'other-episode', 'SDE_SCOPE']]) {
    const changed = structuredClone(job); changed[key] = value;
    seal(manifest, changed); expect(code, key);
  }
  const mutateJob = (change, code, label) => { const changed = structuredClone(job); change(changed); seal(manifest, changed); expect(code, label); };
  mutateJob((j) => { j.productionGate.userPreviewApproved = true; }, 'SDE_PREVIEW_STATE', '伪造预览通过');
  mutateJob((j) => { j.experiment.userPreviewApprovedAt = '2026-09-05'; }, 'SDE_PREVIEW_STATE', '伪造观看时间');
  mutateJob((j) => { j.director.currentTaskUserAcceptance = {userAccepted: true}; }, 'SDE_FALSE_ATTESTATION', '伪造动态验收');
  mutateJob((j) => { j.productionGate.freezeReceipt = {path: 'fake'}; }, 'SDE_FALSE_ATTESTATION', '伪造独立回执');
  mutateJob((j) => { j.inputs.generatedVideoPlan = 'fake.json'; }, 'SDE_PROVIDER', '扩大到生成接口');
  mutateJob((j) => { j.director.phase = 'pre-shoot'; }, 'SDE_POSTSHOOT', '缺少拍后重绑');
  mutateJob((j) => { j.inputs.fingerprintPaths = []; }, 'SDE_FINGERPRINT', '删除执行指纹');
  seal(); put(videos[0].path, 'tampered media'); expect('SDE_FILE_SHA', '媒体篡改'); put(videos[0].path, 'isolated-manual-video-0');
  seal(); rmSync(resolve(root, videos[0].path)); symlinkSync(resolve(root, videos[1].path), resolve(root, videos[0].path));
  expect('SDE_SYMLINK', '媒体符号链接'); rmSync(resolve(root, videos[0].path)); put(videos[0].path, 'isolated-manual-video-0');
  seal(); put(S.entry, 'changed composition'); expect('SDE_BINDING_DRIFT', 'composition漂移'); put(S.entry, 'export const fixture = "no renderer is invoked";\n');
  const falseQuote = structuredClone(manifest); falseQuote.authorization.directExportMessage.quote = '同意发布';
  seal(falseQuote); expect('SDE_USER_QUOTE', '原文不匹配');
  const assistantEvidence = put(evidence.path, JSON.stringify({type: 'response_item', payload: {type: 'message', role: 'assistant', content: [{type: 'output_text', text: '那就抓紧修复呀，赶紧出片呀'}]}}));
  const fakeAuthor = structuredClone(manifest); fakeAuthor.authorization.evidence = assistantEvidence; fakeAuthor.authorization.directExportMessage.line = 1;
  seal(fakeAuthor); expect('SDE_USER_MESSAGE', '助手总结不能代替用户消息');
  put(evidence.path, [
    JSON.stringify({type: 'response_item', payload: {type: 'message', role: 'user', content: [{type: 'input_text', text: '不要预览，直接正式出片。'}]}}),
    JSON.stringify({type: 'event_msg', payload: {type: 'user_message', message: '那就抓紧修复呀，赶紧出片呀'}}),
  ].join('\n'));
  const wrongCount = structuredClone(manifest); wrongCount.generatedVideos.pop(); seal(wrongCount); expect('SDE_SCHEMA', '不足六段素材');
  const retired = structuredClone(registry); retired.retiredOutputSha256.push(videos[0].sha256);
  put(protectedPaths[0], retired); seal(); expect('SDE_RETIRED_HASH', '退役字节改名不能复用'); put(protectedPaths[0], registry);
  seal();
  const badVisual = {...visualPlan, previewCoverage: ['full-screen-asset']};
  const badVisualRef = put(job.inputs.visualPlan, badVisual);
  const badVisualJob = structuredClone(job);
  badVisualJob.director.artifacts.postshootValidation = put(artifacts.postshootValidation.path,
    {...manualReceipt, bindings: {...manualReceipt.bindings, visualPlan: badVisualRef}});
  const changedVisualManifest = {...manifest, ...api.collectScopedDirectExportBindings({projectRoot: root, job: badVisualJob})};
  seal(changedVisualManifest, badVisualJob);
  const rejectedVisual = spawnSync(process.execPath, ['tools/validate-visual-plan.mjs', job.inputs.visualPlan], {cwd: root, encoding: 'utf8'});
  assert.notEqual(rejectedVisual.status, 0);
  assert.match(rejectedVisual.stderr, /不能填写未执行的预览覆盖/u); cases++;
  put(job.inputs.visualPlan, visualPlan);
  put(artifacts.postshootValidation.path, manualReceipt);
  seal();
  assert.equal(existsSync(resolve(root, profile.skill.lockPath)), false);
  put('skills/koubo-remotion-director/unrelated-development.txt', 'unrelated work must not become manual-import acceptance');
  const director = run('formal', `
    import {readFileSync} from 'node:fs';
    import {assertDirectorProductionBinding} from './tools/director-production-binding-core.mjs';
    const job = JSON.parse(readFileSync(${JSON.stringify(S.jobPath)}, 'utf8'));
    console.log(JSON.stringify(assertDirectorProductionBinding({projectRoot: process.cwd(), job, command: 'formal', activeSkillPath: 'nonexistent-development-skill'})));
  `);
  assert.equal(director.status, 'direct-export-authorized-director-bound'); cases++;
  assert.equal(director.postshootEvidence, 'manual-import-bound');
  assert.equal(director.skillPackageAccepted, false); cases++;
  for (const key of ['skillExecuted', 'skillPackageAccepted', 'userPreviewApproved']) {
    assert.throws(() => api.assertScopedManualPostshoot({projectRoot: root, job, manifest, receipt: {...manualReceipt, [key]: true}}), {code: 'SDE_SCHEMA'}); cases++;
  }
  const wrongManual = structuredClone(manualReceipt);
  wrongManual.generatedVideos[0].sha256 = 'f'.repeat(64);
  assert.throws(() => api.assertScopedManualPostshoot({projectRoot: root, job, manifest, receipt: wrongManual}), {code: 'SDE_MANUAL_MEDIA'}); cases++;
  const release = {videoId: S.episodeId, status: 'ready-for-user-review',
    productionGate: {scopedDirectExportSha256: 'd'.repeat(64)}, production: {previewOutput: null},
    userReview: {directFinalAuthorized: true, previewApproved: false, fullWatchConfirmed: false}, publish: {status: 'not-published'}};
  const preflight = {route: S.route, scopedDirectExportSha256: 'd'.repeat(64)};
  assert.equal(api.assertScopedDirectExportRelease({release, preflight}), true); cases++;
  for (const change of [
    (r) => { r.status = 'verified'; }, (r) => { r.publish.status = 'published'; },
    (r) => { r.userReview.previewApproved = true; }, (r) => { r.production.previewOutput = 'fake.mp4'; },
    (r) => { r.productionGate.scopedDirectExportSha256 = 'e'.repeat(64); },
  ]) {
    const changed = structuredClone(release); change(changed);
    assert.throws(() => api.assertScopedDirectExportRelease({release: changed, preflight}), {code: 'SDE_RELEASE_STATE'}); cases++;
  }
  assert.equal(api.assertScopedDirectExportRelease({release, preflight: {route: 'director-automation-v2'}}), false); cases++;
  console.log(JSON.stringify({ok: true, cases, scope: 'isolated-contract-and-rejection-tests', rendered: false, productionPinChanged: false}));
} finally {
  assert.deepEqual(protectedPaths.map((path) => sha(readFileSync(resolve(projectRoot, path)))), before, '真实冻结表与签名核心必须不变');
  if (existsSync(root)) rmSync(root, {recursive: true, force: true});
}
