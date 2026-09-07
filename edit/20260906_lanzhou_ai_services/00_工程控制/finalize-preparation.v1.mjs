import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const repo = path.resolve(import.meta.dirname, '../../..');
const episode = 'edit/20260906_lanzhou_ai_services';
const control = `${episode}/00_工程控制`;
const sha = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, relative))).digest('hex');
const read = relative => JSON.parse(fs.readFileSync(path.join(repo, relative), 'utf8'));
const bind = relative => ({path: relative, sha256: sha(relative), bytes: fs.statSync(path.join(repo, relative)).size});
const relativeToRepo = p => path.isAbsolute(p) ? path.relative(repo, p).split(path.sep).join('/') : p;
const verify = b => assert.equal(sha(relativeToRepo(b.path ?? b.file)), b.sha256, `Hash changed: ${b.path ?? b.file}`);
const writeNew = (relative, body) => fs.writeFileSync(path.join(repo, relative), `${JSON.stringify(body, null, 2)}\n`, {flag: 'wx'});
const createdAt = new Date().toISOString();

const owned = [
  'README_先看这里.md',
  '00_工程控制/prepare-host-intake.v1.mjs',
  '00_工程控制/prepare-postshoot-layout.v1.mjs',
  '00_工程控制/prepare-source-effect-audit.v1.mjs',
  '00_工程控制/finalize-preparation.v1.mjs',
  '00_工程控制/paper-asset-intake.v1.json',
  '04_导演拆解/postshoot-preparation-r1/postshoot-layout-preparation.v1.json',
  '04_导演拆解/shotcraft-source-audit-r1/source-match-request.v1.json',
  '04_导演拆解/shotcraft-source-audit-r2/source-match-request.v1.json',
  '04_导演拆解/shotcraft-source-audit-r2/source-match-selection.v1.json',
  '04_导演拆解/shotcraft-source-audit-r2/source-match-receipt.v1.json',
  '04_导演拆解/shotcraft-source-audit-r2/source-experience-lookup.v1.json',
  '07_预览与质检/本轮制作进度_20260907.md',
  '07_预览与质检/production-entry-audit-r1.md',
  '07_预览与质检/host-intake-r1/host-intake-receipt.v1.json',
  '07_预览与质检/host-intake-r1/source-ffprobe.v1.json',
  '07_预览与质检/host-intake-r1/proxy-ffprobe.v1.json',
  '07_预览与质检/paper-intake-r1/入场核验报告.md',
  '07_预览与质检/paper-intake-r1/verification-r2.json',
  '07_预览与质检/paper-intake-r1/evidence-manifest-r2.json',
  '09_实录与字幕/canonical-spoken.v1.json',
  '09_实录与字幕/actual-bilingual.v1.json',
  '09_实录与字幕/actual-caption-plan.v1.json',
  '09_实录与字幕/actual-spoken.v1.txt',
  '09_实录与字幕/actual-spoken.review-marked.v1.txt',
  '09_实录与字幕/transcription-review.v1.json',
  '09_实录与字幕/transcription-validation.v1.json',
  '09_实录与字幕/transcription-independent-check.v1.json',
  '09_实录与字幕/build-actual-transcript.v1.mjs',
  '09_实录与字幕/check-actual-transcript.v1.mjs',
].map(p => `${episode}/${p}`);
const hostPath = `${episode}/07_预览与质检/host-intake-r1/host-intake-receipt.v1.json`;
const paperPath = `${control}/paper-asset-intake.v1.json`;
const transcriptCheckPath = `${episode}/09_实录与字幕/transcription-independent-check.v1.json`;
const matchPath = `${episode}/04_导演拆解/shotcraft-source-audit-r2/source-match-receipt.v1.json`;
const host = read(hostPath);
const paper = read(paperPath);
const transcript = read(transcriptCheckPath);
const match = read(matchPath);
verify(host.source);
verify(host.proxy);
assert.equal(host.sourceFullDecodeExitCode, 0);
assert.equal(host.proxy.fullDecodeExitCode, 0);
assert.equal(paper.assets.length, 5);
for (const asset of paper.assets) {
  verify(asset);
  assert.equal(asset.fullDecodePassed, true);
}
for (const b of transcript.deliverables) verify(b);
assert(transcript.checks.every(c => c.result === 'ok'));
assert.equal(transcript.formalAllowed, false);
assert.equal(match.summary.analyzedCardCount, 157);
for (const b of [match.request, match.selection, match.captions, match.experienceLookup, ...Object.values(match.inputs)]) verify(b);
const oldManifestPath = `${control}/交付清单_SHA256.v4.json`;
const oldManifest = read(oldManifestPath);
const changedHistoricalPaths = oldManifest.files.filter(b => sha(b.path) !== b.sha256).map(b => b.path);
assert.deepEqual(changedHistoricalPaths, [`${episode}/README_先看这里.md`]);
const desktop = '/Users/pc/Desktop/口播素材/2026-09-06_在兰州把企业AI服务做下去';
assert.equal(fs.realpathSync(desktop), path.join(repo, episode));

const checks = [];
for (const file of owned.filter(p => p.endsWith('.mjs'))) {
  execFileSync(process.execPath, ['--check', file], {cwd: repo});
  checks.push({command: ['node', '--check', file], exitCode: 0});
}
const selectionArgs = ['skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs', match.selection.path, '.'];
const selectionResult = JSON.parse(execFileSync(process.execPath, selectionArgs, {cwd: repo, encoding: 'utf8'}));
assert.equal(selectionResult.status, 'director-selection-valid');
checks.push({command: ['node', ...selectionArgs], exitCode: 0, result: selectionResult});
const testFiles = fs.readdirSync(path.join(repo, 'skills/koubo-shotcraft-library/tests')).filter(p => p.endsWith('.test.mjs')).sort().map(p => `skills/koubo-shotcraft-library/tests/${p}`);
const tap = execFileSync(process.execPath, ['--test', ...testFiles], {cwd: repo, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
assert.match(tap, /# tests 106\b/);
assert.match(tap, /# fail 0\b/);
const testLog = `${episode}/07_预览与质检/shotcraft-preparation-tests.v1.tap`;
fs.writeFileSync(path.join(repo, testLog), tap, {flag: 'wx'});
checks.push({command: ['node', '--test', ...testFiles], exitCode: 0, tests: 106, passed: 106, failed: 0, log: bind(testLog)});
owned.push(testLog);

const receiptPath = `${control}/production-preparation-attempt.v1.json`;
writeNew(receiptPath, {
  schemaVersion: 'koubo-production-preparation-attempt/v1', createdAt,
  episodeId: '20260906_lanzhou_ai_services',
  taskId: 'task-20260906T154937Z-69f6ebf8',
  status: 'blocked-before-candidate',
  userRequest: '所有文稿文件都准备好了，开始制作。',
  desktopEntry: {path: desktop, linkTarget: fs.readlinkSync(desktop), realpath: fs.realpathSync(desktop)},
  source: host.source,
  localReviewProxy: host.proxy,
  inputReceipts: [hostPath, paperPath, transcriptCheckPath, matchPath].map(bind),
  summary: {hostFramesPreserved: 8149, paperDecodePassed: 5, paperMaterialAccepted: 0, captions: 57, transcriptUncertainItems: 13, catalogCardsSearched: 157, captionsSearched: 33, captionsDeferred: 24, proposedEffects: 15, effectsApplied: 0},
  materialDecisions: paper.assets.map(a => ({sceneId: a.sceneId, file: relativeToRepo(a.path), sha256: a.sha256, decision: a.semanticReview.decision, summary: a.semanticReview.summary})),
  postshootTiming: {draft: bind(`${episode}/04_导演拆解/postshoot-preparation-r1/postshoot-layout-preparation.v1.json`), actualTimelineApproved: false, firstCandidateRendered: false},
  entryAudit: bind(`${episode}/07_预览与质检/production-entry-audit-r1.md`),
  pendingUserDecisions: ['本条首次预览入口与真实重绑合同修复许可，已询问未确认', 'P01语义返修及其他纸艺视觉偏差处置', '实录字幕13项疑点，未人工听验'],
  sourceMatchFailure: {request: bind(`${episode}/04_导演拆解/shotcraft-source-audit-r1/source-match-request.v1.json`), error: 'SHOTCRAFT_COVERAGE_EXCEEDED', cause: '相邻相同毫秒边界向外取整后重叠一帧', correction: '仅本条准备脚本统一最近帧取整；第二次匹配通过，旧失败请求保留'},
  gates: {materialGatePassed: false, postshootRebindPassed: false, firstCandidateEntryAuthorized: false, candidateRendered: false, formalEnabled: false, publicationEnabled: false, externalGenerationStarted: false},
  historicalSnapshot: {binding: bind(oldManifestPath), changedHistoricalPaths, archivedContractsPreserved: true},
  checks,
  testScope: '本地准备脚本、已有匹配器与素材证据检查；未改前端和共享生产代码，未运行Vite/前端16项测试/部署，不将这些无关流程声称通过。',
  actualViewingBoundary: '图像抽帧检查和机器音频检测；没有声称原速完整人工听看、用户验收或正式字幕通过。',
});
owned.push(receiptPath);
const manifestPath = `${control}/交付清单_SHA256.v5.json`;
const mediaPaths = [host.source.path, host.proxy.path, ...paper.assets.map(a => relativeToRepo(a.path)), `${episode}/06_补充实拍素材/开头引用_v1/stodownload.MP4`];
const files = [...new Set([...oldManifest.files.map(b => b.path), oldManifestPath, ...owned, ...mediaPaths])].sort();
writeNew(manifestPath, {
  schemaVersion: 'koubo-preparation-inventory/v1', createdAt,
  status: 'blocked-before-candidate', previousManifest: bind(oldManifestPath),
  selfExcluded: true, archiveNote: '本次素材实录与匹配准备清单，不是发布包；旧V4及预拍合同不覆盖。README是当前入口说明，已更新。',
  files: files.map(bind),
  gitArchiveOwnedPaths: [...owned, manifestPath],
  localOnlyMedia: mediaPaths,
  formalEnabled: false,
});
for (const binding of read(manifestPath).files) verify(binding);
console.log(JSON.stringify({receipt: bind(receiptPath), manifest: bind(manifestPath), verifiedFiles: files.length, checks: checks.length, status: 'blocked-before-candidate'}, null, 2));
