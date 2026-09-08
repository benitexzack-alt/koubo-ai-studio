#!/usr/bin/env node
// All fixtures in this test are synthetic engineering data, not accepted media.
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildSceneIdentity, sha256File, sha256Json} from '../scripts/preproduction-director-core.mjs';
import {validatePaperAssetIntake, computePaperAssetSetSha256} from '../scripts/paper-asset-intake-core.mjs';
import {paperMediaTools, runPaperMediaTool, probePaperVideo, verifyPaperSourceFrames} from '../scripts/paper-asset-intake-media.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'paper-intake-incident-engineering-'));
let serial = 0;
const put = (name, data) => {
  const file = path.join(root, `${serial++}-${name}`);
  writeFileSync(file, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
  return {path: file, sha256: sha256File(file)};
};
const update = (ref, change) => put('updated.json', change(JSON.parse(readFileSync(ref.path, 'utf8'))));
let passed = 0;
const check = (name, fn) => {fn(); passed++; console.log(`PASS ${name}`);};
try {
  const scene = {
    beatId: 'B01', title: '工程测试', prompt: {firstFrame: '静态测试', motion: '动作测试'},
    objectGroups: [{id: 'G1'}, {id: 'G2'}], stages: [{id: 'S1'}, {id: 'S2'}],
    textPlan: [{nodeId: 'N1', text: '资料和权限', enterStageId: 'initial',
      firstReadableFrame: 0, persistence: 'initial-to-end', embeddingMode: 'first-frame-baked'}],
    motionContract: {actions: [
      {id: 'A1', stageId: 'S1', partId: 'T1', operation: 'translate', fromGroupId: 'G1', toGroupId: 'G2', startSeconds: 0.5, endSeconds: 1, sweptRect: [0, 0, 1, 1]},
      {id: 'A2', stageId: 'S2', partId: 'T1', operation: 'translate', fromGroupId: 'G2', toGroupId: 'G1', startSeconds: 2, endSeconds: 3, sweptRect: [0, 0, 1, 1]},
    ], highRiskWindows: [{id: 'R1', startSeconds: 3.5, endSeconds: 4}],
    requiredPredecessors: [{beforeActionId: 'A1', actionId: 'A2'}],
    initialLocations: [{partId: 'T1', groupId: 'G1'}], finalLocations: [{partId: 'T1', groupId: 'G1'}], forbiddenTransfers: []},
  };
  const plan = {taskId: 'engineering-only', revisionId: 'engineering-r1', phase: 'post-shoot', status: 'candidate-preview-required',
    formalEligible: false, spokenAuthority: 'recorded-audio', policy: {incidentPreventionVersion: '1'}, paperScenes: [scene]};
  const planRef = put('plan.json', plan);
  const identity = buildSceneIdentity(scene, 0);
  const candidatePath = path.join(root, `P01__${identity.pairSha256.slice(0, 8)}.mp4`);
  const mediaTools = paperMediaTools();
  // A blank local test clip, not a generated paper animation or acceptance sample.
  runPaperMediaTool(mediaTools.ffmpeg, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=64x36:r=4',
    '-frames:v', '17', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-n', candidatePath]);
  const video = {path: candidatePath, sha256: sha256File(candidatePath), canonicalFileName: path.basename(candidatePath)};
  const media = {frameCount: 17, fpsNumerator: 4, fpsDenominator: 1, width: 64, height: 36};
  const probe = put('probe.json', probePaperVideo(candidatePath, mediaTools).probe);
  const binding = {sceneId: 'P01', revisionId: plan.revisionId, videoSha256: video.sha256, planSha256: planRef.sha256};
  const imageFixture = spawnSync('magick', ['-size', '64x36', 'xc:#FFFFFF', 'png:-']);
  assert.equal(imageFixture.status, 0, String(imageFixture.stderr));
  const frames = Array.from({length: 17}, (_, frameIndex) => {
    const frame = {...put('frame.png', imageFixture.stdout), frameIndex,
      moment: frameIndex === 0 ? 'first' : frameIndex === 8 ? 'middle' : frameIndex === 16 ? 'last' : 'action-grid'};
    frame.ocrReceipt = put('ocr.json', {schemaVersion: 'koubo-paper-frame-ocr/v1', ...binding,
      frameIndex, imageSha256: frame.sha256, engine: {name: 'synthetic-fixture', version: '1'},
      results: [{nodeId: 'N1', expected: '资料和权限', recognized: '资料和权限', visibility: 'visible-readable',
        raw: {...put('ocr.txt', '资料和权限'), format: 'text'}}]});
    return frame;
  });
  const evidenceSetSha256 = sha256Json(frames.map(({frameIndex, sha256, ocrReceipt}) => ({frameIndex, imageSha256: sha256, ocrReceiptSha256: ocrReceipt.sha256})));
  const review = (kind) => put('review.json', {schemaVersion: 'koubo-paper-dynamic-review/v1', kind, ...binding,
    evidenceSetSha256, reviewerId: `synthetic-engineering-${kind}-reviewer`, reviewedAt: '2026-09-08T00:00:00Z',
    method: kind === 'silent' ? 'silent-video' : 'video-and-plan', status: 'passed',
    reviewedFrameIndices: frames.map(f => f.frameIndex), findings: [],
    playbackCoverage: [{startFrame: 0, endFrame: 16, observation: '工程测试全区间观察记录，不是真实观看'}],
    observations: scene.motionContract.actions.map(a => ({actionId: a.id, stageId: a.stageId,
      startFrame: a.startSeconds * 4, endFrame: a.endSeconds * 4,
      object: '测试纸片', change: '测试纸片完成计划动作', spokenConsistency: '工程测试对应关系', verdict: 'matches-plan'})),
    observedEvents: scene.motionContract.actions.map(a => ({actionId: a.id, partId: a.partId, operation: a.operation,
      fromGroupId: a.fromGroupId, toGroupId: a.toGroupId, startFrame: a.startSeconds * 4, endFrame: a.endSeconds * 4,
      evidenceFrameIndices: [a.startSeconds * 4 - 1, a.startSeconds * 4, a.endSeconds * 4, a.endSeconds * 4 + 1],
      observation: '工程测试实测事件占位，不是真实媒体证据'})),
    textObservations: frames.map(f => ({frameIndex: f.frameIndex, nodes: [{nodeId: 'N1', status: 'visible-readable', shape: 'rigid-unchanged', observation: '工程测试标签完整'}]})),
  });
  const request = {schemaVersion: 'koubo-paper-generated-asset-intake/v1', taskId: plan.taskId, revisionId: plan.revisionId,
    contactSheetFontPath: path.join(os.homedir(), 'Library/Fonts/NotoSansCJKsc-Bold.otf'),
    policy: {incidentPreventionVersion: '1'}, sourcePlan: planRef, assets: [{...identity,
      inputFirstFrame: {...put('input.png', 'synthetic input'), pHash: '0123456789abcdef'},
      generatedVideo: video, productionCandidate: video, evidenceFrames: frames,
      extractionReceipt: put('extraction.json', {schemaVersion: 'koubo-paper-frame-extraction/v1', ...binding,
        media, frames: frames.map(f => ({frameIndex: f.frameIndex, imageSha256: f.sha256}))}),
      mediaQaReceipt: put('media-qa.json', {revisionId: plan.revisionId, fullDecodePassed: true, videoSha256: video.sha256, ...media, probe}),
      expectedObjectGroupIds: ['G1', 'G2'], expectedStageIds: ['S1', 'S2'],
      semanticReviewReceipt: review('semantic'), silentViewReviewReceipt: review('silent'),
    }], outputs: {contactSheetPath: path.join(root, 'contact.png'), contactSheetManifestPath: path.join(root, 'contact.json'), validationReceiptPath: path.join(root, 'receipt.json')}};
  const requestRef = put('request.json', request);
  const validate = (r = request, extra = {}) => validatePaperAssetIntake({request: r, requestPath: requestRef.path, projectRoot: root, requireContactSheet: false, ...extra});
  const rejected = (name, change, pattern) => check(name, () => {
    const r = structuredClone(request); change(r, r.assets[0]); const result = validate(r);
    assert.equal(result.ok, false, name);
    if (pattern) assert.ok(result.errors.some(e => e.includes(pattern)), JSON.stringify(result.errors));
  });

  check('valid bound dynamic engineering fixture', () => assert.deepEqual(validate().errors, []));
  check('equal pixel byte counts cannot hide wrong PNG dimensions', () => {
    const rotated = spawnSync('magick', [frames[0].path, '-rotate', '90', 'png:-']);
    assert.equal(rotated.status, 0);
    const image = {...put('rotated.png', rotated.stdout), frameIndex: 0};
    assert.throws(() => verifyPaperSourceFrames({videoPath: video.path, videoSha256: video.sha256,
      frames: [image], expectedMedia: media}), /FRAME_DIMENSIONS_MISMATCH/u);
  });
  rejected('request version cannot be stripped', r => delete r.policy, 'POLICY');
  rejected('unknown version rejected', r => r.policy.incidentPreventionVersion = '2', 'POLICY');
  rejected('request revision cannot be stripped', r => delete r.revisionId, 'REVISION');
  rejected('request cannot switch revision', r => r.revisionId = 'engineering-r2', 'REVISION');
  rejected('extraction cannot come from another revision', (_, a) => a.extractionReceipt = update(a.extractionReceipt, x => ({...x, revisionId: 'engineering-r2'})), 'EXTRACTION');
  rejected('OCR cannot come from another revision', (_, a) => a.evidenceFrames[0].ocrReceipt = update(a.evidenceFrames[0].ocrReceipt, x => ({...x, revisionId: 'engineering-r2'})), 'OCR');
  rejected('review cannot come from another revision', (_, a) => a.semanticReviewReceipt = update(a.semanticReviewReceipt, x => ({...x, revisionId: 'engineering-r2'})), 'SEMANTIC');
  rejected('three samples cannot replace action evidence', (_, a) => a.evidenceFrames = a.evidenceFrames.filter(f => ['first', 'middle', 'last'].includes(f.moment)), 'SAMPLING');
  rejected('missing boundary plus one frame rejected', (_, a) => a.evidenceFrames = a.evidenceFrames.filter(f => f.frameIndex !== 9), 'SAMPLING');
  rejected('missing high-risk frame rejected', (_, a) => a.evidenceFrames = a.evidenceFrames.filter(f => f.frameIndex !== 15), 'SAMPLING');
  rejected('wrong frame number rejected', (_, a) => a.evidenceFrames[3].frameIndex = 4, 'FRAME');
  rejected('changed image bytes rejected', (_, a) => a.evidenceFrames[3].sha256 = '0'.repeat(64), 'SHA');
  rejected('another video extraction rejected', (_, a) => a.extractionReceipt = update(a.extractionReceipt, x => ({...x, videoSha256: '0'.repeat(64)})), 'EXTRACTION');
  rejected('probe contradicts receipt rejected', (_, a) => a.mediaQaReceipt = update(a.mediaQaReceipt, x => ({...x, frameCount: 18})), 'PROBE');
  rejected('OCR bool cannot hide disappearance', (_, a) => a.evidenceFrames[9].ocrReceipt = update(a.evidenceFrames[9].ocrReceipt, x => ({...x, exact: true, results: x.results.map(n => ({...n, recognized: '', visibility: 'missing'}))})), 'OCR');
  rejected('OCR text cannot contradict raw output', (_, a) => a.evidenceFrames[9].ocrReceipt = update(a.evidenceFrames[9].ocrReceipt, x => ({...x, results: x.results.map(n => ({...n, raw: {...put('empty.txt', ''), format: 'text'}}))})), 'OCR');
  rejected('OCR needs every node every active sample', (_, a) => a.evidenceFrames[0].ocrReceipt = update(a.evidenceFrames[0].ocrReceipt, x => ({...x, results: []})), 'OCR');
  rejected('stale OCR video receipt rejected', (_, a) => a.evidenceFrames[0].ocrReceipt = update(a.evidenceFrames[0].ocrReceipt, x => ({...x, videoSha256: '0'.repeat(64)})), 'OCR');
  rejected('explicit failed OCR cannot hide behind matching text', (_, a) => a.evidenceFrames[0].ocrReceipt = update(a.evidenceFrames[0].ocrReceipt, x => ({...x, allExact: false})), 'OCR');
  rejected('inline semantic bool is insufficient', (_, a) => {delete a.semanticReviewReceipt; a.semanticReview = {status: 'exact', ownSceneClosest: true};}, 'SEMANTIC');
  rejected('inline silent bool is insufficient', (_, a) => {delete a.silentViewReviewReceipt; a.silentViewReview = {status: 'passed'};}, 'SILENT');
  rejected('semantic and silent reviewers must differ', (_, a) => a.silentViewReviewReceipt = update(a.silentViewReviewReceipt,
    x => ({...x, reviewerId: 'synthetic-engineering-semantic-reviewer'})), 'INDEPENDENT_REVIEWERS');
  rejected('wrong review plan rejected', (_, a) => a.semanticReviewReceipt = update(a.semanticReviewReceipt, x => ({...x, planSha256: '0'.repeat(64)})), 'SEMANTIC');
  rejected('review must cover all actions', (_, a) => a.semanticReviewReceipt = update(a.semanticReviewReceipt, x => ({...x, observations: x.observations.slice(0, 1)})), 'SEMANTIC');
  rejected('review cannot hide occlusion behind passed', (_, a) => a.silentViewReviewReceipt = update(a.silentViewReviewReceipt, x => ({...x, findings: [{frameIndex: 9, nodeId: 'N1', kind: 'occluded'}]})), 'SILENT');
  rejected('explicit P1 cannot hide behind empty findings', (_, a) => a.semanticReviewReceipt = update(a.semanticReviewReceipt, x => ({...x, p1: ['标签折叠']})), 'SEMANTIC');
  rejected('review text visibility must be checked', (_, a) => a.silentViewReviewReceipt = update(a.silentViewReviewReceipt, x => {x.textObservations[9].nodes[0].status = 'occluded'; return x;}), 'SILENT');
  rejected('OCR readable but folded label still rejected', (_, a) => a.semanticReviewReceipt = update(a.semanticReviewReceipt, x => {x.textObservations[9].nodes[0].shape = 'folded'; return x;}), 'SEMANTIC');
  rejected('planned sweep is not observed motion evidence', (_, a) => a.semanticReviewReceipt = update(a.semanticReviewReceipt, x => {delete x.observedEvents; x.sweptRects = scene.motionContract.actions.map(a => a.sweptRect); return x;}), 'SEMANTIC');
  rejected('output before prerequisite completion rejected', (_, a) => a.semanticReviewReceipt = update(a.semanticReviewReceipt, x => {x.observedEvents[1].startFrame = 3; return x;}), 'SEMANTIC');
  rejected('wrong actual transfer destination rejected', (_, a) => a.semanticReviewReceipt = update(a.semanticReviewReceipt, x => {x.observedEvents[0].toGroupId = 'G1'; return x;}), 'SEMANTIC');
  rejected('unviewed interval cannot pass', (_, a) => a.silentViewReviewReceipt = update(a.silentViewReviewReceipt, x => {x.playbackCoverage[0].endFrame = 8; return x;}), 'SILENT');
  check('initial-to-end cannot be narrowed by request', () => {
    const r = structuredClone(request);
    r.sourcePlan = update(r.sourcePlan, p => {p.paperScenes[0].textPlan[0].enterStageId = 'S2'; return p;});
    assert.ok(validate(r).errors.some(e => e.includes('INITIAL_LABEL')));
  });
  check('fixed registry cannot be overridden by request path', () => {
    const r = structuredClone(request);
    r.incidentRegistry = put('empty-registry.json', {incidents: []});
    r.assets[0].generatedVideo.sha256 = 'b96c2e7da8dbf382916523ef0553196fd9b1ad014d1057888af33365469e2c15';
    assert.ok(validate(r).errors.some(e => e.includes('NEGATIVECASE_NOT_REUSABLE')));
  });
  check('isolated engineering contact and receipt CLI include every frame', () => {
    const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts');
    for (const name of ['build-paper-asset-contact-sheet.mjs', 'validate-paper-generated-asset-intake.mjs']) {
      const result = spawnSync(process.execPath, [path.join(scripts, name), '--request', requestRef.path, '--repo-root', root], {encoding: 'utf8', timeout: 60000});
      assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    }
    const manifest = JSON.parse(readFileSync(request.outputs.contactSheetManifestPath));
    assert.equal(manifest.cells.length, 17);
    assert.equal(manifest.pages.length, 2);
    assert.equal(manifest.revisionId, plan.revisionId);
    assert.equal(manifest.pages[1].image.sha256, sha256File(manifest.pages[1].image.path));
    assert.deepEqual(manifest.cells.map(c => c.frameIndex), frames.map(f => f.frameIndex));
    const receipt = JSON.parse(readFileSync(request.outputs.validationReceiptPath));
    assert.equal(receipt.formalEligible, false);
    assert.equal(receipt.policy.incidentPreventionVersion, '1');
    assert.equal(receipt.revisionId, plan.revisionId);
    assert.equal(receipt.dynamicEvidence[0].requiredFrameIndices.length, 17);
    assert.equal(receipt.gates.actionBoundaryAndHighRiskSamplingBound, true);
    assert.equal(receipt.gates.actualProbeFullDecodeAndSourceFramePixelsVerified, true);
    assert.equal(receipt.sourceVerification[0].frames.length, 17);
    assert.equal(validate(request, {requireContactSheet: true}).ok, true);
    const savedPageSha = manifest.pages[1].image.sha256;
    manifest.pages[1].image.sha256 = '0'.repeat(64);
    writeFileSync(request.outputs.contactSheetManifestPath, JSON.stringify(manifest));
    assert.ok(validate(request, {requireContactSheet: true}).errors.some(e => e.includes('PAGE:1_SHA_MISMATCH')));
    manifest.pages[1].image.sha256 = savedPageSha;
    manifest.cells[9].frameIndex = 8;
    writeFileSync(request.outputs.contactSheetManifestPath, JSON.stringify(manifest));
    assert.ok(validate(request, {requireContactSheet: true}).errors.some(e => e.includes('CELL_BINDING')));
    manifest.cells = manifest.cells.filter(c => [0, 8, 16].includes(c.frameIndex));
    writeFileSync(request.outputs.contactSheetManifestPath, JSON.stringify(manifest));
    assert.ok(validate(request, {requireContactSheet: true}).errors.some(e => e.includes('CELL_COUNT')));
  });
  check('profile forces version even when plan and request stripped', () => {
    mkdirSync(path.join(root, 'workflow'));
    writeFileSync(path.join(root, 'workflow/active-director-profile.v1.json'), JSON.stringify({policy: {incidentPreventionVersion: '1'}}));
    const r = structuredClone(request); delete r.policy;
    r.sourcePlan = update(r.sourcePlan, p => {delete p.policy; delete p.paperScenes[0].motionContract; return p;});
    assert.ok(validate(r).errors.some(e => e.includes('POLICY')));
  });
  check('asset hash includes frame coordinate and OCR/review evidence', () => {
    const a = structuredClone(request.assets); a[0].evidenceFrames[1].frameIndex = 900;
    assert.notEqual(computePaperAssetSetSha256(a), computePaperAssetSetSha256(request.assets));
    const b = structuredClone(request.assets); b[0].silentViewReviewReceipt.sha256 = '0'.repeat(64);
    assert.notEqual(computePaperAssetSetSha256(b), computePaperAssetSetSha256(request.assets));
  });
  console.log(JSON.stringify({ok: true, tests: passed, evidenceClass: 'synthetic-engineering-only', actualMediaAccepted: false}));
} finally {rmSync(root, {recursive: true, force: true});}
