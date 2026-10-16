#!/usr/bin/env node
// Real producer CLIs and media collection on synthetic test clips, never production or authorization.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {basename, dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {makeIncidentMotionRequest, bindSemanticReview} from './fixtures/paper-motion-request.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'synthetic-first-candidate-producers-')));
const scripts = 'skills/koubo-remotion-director/scripts';
const cliRuns = [];
const copiedSourcePaths = [];
try {
  for (const name of [
    'first-candidate-input-contract.mjs', 'preproduction-director-core.mjs', 'paper-motion-contract.mjs',
    'compile-preproduction-director.mjs', 'validate-preproduction-director.mjs',
    'postshoot-rebind-core.mjs', 'rebind-postshoot-director.mjs', 'validate-postshoot-director.mjs',
    'paper-asset-intake-core.mjs', 'paper-asset-intake-incident.mjs',
    'paper-asset-intake-media.mjs', 'collect-paper-asset-intake-evidence.mjs',
    'build-paper-asset-contact-sheet.mjs', 'validate-paper-generated-asset-intake.mjs',
  ]) {
    const target = resolve(root, scripts, name); mkdirSync(dirname(target), {recursive: true});
    cpSync(resolve(repo, scripts, name), target);
    copiedSourcePaths.push(`${scripts}/${name}`);
  }
  const registry = 'skills/koubo-remotion-director/references/paper-motion-incident-registry.v1.json';
  mkdirSync(dirname(resolve(root, registry)), {recursive: true}); cpSync(resolve(repo, registry), resolve(root, registry));
  const core = await import(pathToFileURL(resolve(root, scripts, 'preproduction-director-core.mjs')));
  const inputCore = await import(pathToFileURL(resolve(root, scripts, 'first-candidate-input-contract.mjs')));
  const intakeCore = await import(pathToFileURL(resolve(root, scripts, 'paper-asset-intake-core.mjs')));
  const incidentCore = await import(pathToFileURL(resolve(root, scripts, 'paper-asset-intake-incident.mjs')));
  const mediaCore = await import(pathToFileURL(resolve(root, scripts, 'paper-asset-intake-media.mjs')));
  const collector = await import(pathToFileURL(resolve(root, scripts, 'collect-paper-asset-intake-evidence.mjs')));
  const mediaTools = mediaCore.paperMediaTools(['ffmpeg', 'ffprobe', 'magick']);
  const put = (path, value) => {
    const file = resolve(root, path); mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
    return {path: file, sha256: core.sha256File(file)};
  };
  const ref = (path) => ({path, sha256: core.sha256File(path)});
  const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const cli = (name, request) => {
    assert.ok(['compile-preproduction-director.mjs', 'validate-preproduction-director.mjs',
      'rebind-postshoot-director.mjs', 'validate-postshoot-director.mjs',
      'build-paper-asset-contact-sheet.mjs', 'validate-paper-generated-asset-intake.mjs'].includes(name));
    const result = spawnSync(process.execPath, [resolve(root, scripts, name), '--repo-root', root, '--request', request],
      {encoding: 'utf8', timeout: 60000});
    assert.equal(result.status, 0, `${name}: ${result.error?.message ?? result.stderr}`); cliRuns.push(name);
    console.log(`PASS ${name}`);
  };
  const original = json(resolve(repo, 'edit/20260906_lanzhou_ai_services/04_导演拆解/v9.1-r2/director-preproduction-request.v1.json'));
  const request = makeIncidentMotionRequest(original);
  request.taskId = 'synthetic-producer-task'; request.requestId = 'synthetic-preproduction'; request.revisionId = 'synthetic-r1';
  const beat = request.beats[0];
  // Explicitly synthetic extra words allow all four frame-zero labels to bind a past caption.
  beat.spokenLine += beat.paperScene.textPlan.map(t => t.text).join('，') + '。';
  request.inputScript = {...put('script.txt', beat.spokenLine), authority: 'user-confirmed-script', role: 'provisional-authority'};
  const realProfile = json(resolve(repo, 'workflow/active-director-profile.v1.json'));
  const profile = {...Object.fromEntries(['schemaVersion', 'profileId', 'profileVersion', 'status', 'effectiveFrom', 'routingPolicy'].map(k => [k, realProfile[k]])),
    evidenceScope: 'synthetic', style: {path: 'style.json'}, skill: {path: 'skills/koubo-remotion-director', lockPath: 'workflow/director-skill-lock.v1.json'}};
  put('workflow/active-director-profile.v1.json', profile);
  put('style.json', {styleId: 'synthetic-style', acceptedDynamicAnchor: {sha256: '1'.repeat(64)}, evidenceScope: 'synthetic'});
  for (const key of Object.keys(request.outputs)) request.outputs[key] = resolve(root, 'pre', basename(request.outputs[key]));
  bindSemanticReview(request, root);
  const preRequest = put('pre-request.json', request);
  cli('compile-preproduction-director.mjs', preRequest.path);
  cli('validate-preproduction-director.mjs', preRequest.path);
  const prePlan = json(request.outputs.planPath);
  assert.equal(prePlan.policy.incidentPreventionVersion, '1');
  const mediaPath = resolve(root, 'synthetic-recording.mp4');
  mediaCore.runPaperMediaTool(mediaTools.ffmpeg, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=64x36:r=30',
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-n', mediaPath]);
  const media = ref(mediaPath);
  const sourceProbe = mediaCore.probePaperVideo(mediaPath, mediaTools).media;
  const sourceDuration = sourceProbe.frameCount * sourceProbe.fpsDenominator / sourceProbe.fpsNumerator;
  assert.equal(sourceDuration, 10);
  const spoken = put('spoken.json', {evidenceScope: 'synthetic', captions: [{id: 'C1', startMs: 0, endMs: 1000, text: beat.spokenLine}]});
  const mapping = {beatId: beat.id, order: 1, disposition: 'keep', startSeconds: 1, endSeconds: 9,
    semanticTimingMode: 'contextual-summary-after-spoken-terms', actualCaptionIds: ['C1'], actualSpokenLine: beat.spokenLine,
    semanticAnchorText: beat.spokenLine, anchorStartMs: 0, anchorEndMs: 1000,
    alignmentStatus: 'exact', textDecision: 'confirmed', visualDecision: 'keep',
    nodeTextBindings: beat.paperScene.textPlan.map(t => ({nodeId: t.nodeId, resolvedText: t.text, enterStageId: 'initial',
      actualCaptionIds: ['C1'], actualSpokenTerms: [t.text], anchorStartMs: 0, anchorEndMs: 1000,
      visualEnterMs: 1000, firstReadableFrame: 0, labelEnterFrame: 0, stageActionFrame: null,
      emphasisStageId: null, emphasisFrame: null, alignmentStatus: 'exact'})),
  };
  const postRequest = put('post-request.json', {
    schemaVersion: 'koubo-director-postshoot-rebind-request/v1', taskId: request.taskId, requestId: 'synthetic-post',
    revisionId: 'synthetic-r1', phase: 'post-shoot', policy: {incidentPreventionVersion: '1'}, timelineFps: 30,
    sourcePreproduction: {requestPath: preRequest.path, requestSha256: preRequest.sha256,
      planPath: request.outputs.planPath, planSha256: core.sha256File(request.outputs.planPath),
      validationReceiptPath: request.outputs.validationReceiptPath, validationReceiptSha256: core.sha256File(request.outputs.validationReceiptPath)},
    recordedMedia: {...media, durationSeconds: sourceDuration}, spokenTimeline: {...spoken, authority: 'recorded-audio', scriptRole: 'comparison-only'},
    mappings: [mapping], outputs: {rebindPlanPath: resolve(root, 'post-plan.json'), validationReceiptPath: resolve(root, 'post-validation.json')},
  });
  cli('rebind-postshoot-director.mjs', postRequest.path);
  cli('validate-postshoot-director.mjs', postRequest.path);
  const planRef = ref(resolve(root, 'post-plan.json'));
  const plan = json(planRef.path); const scene = plan.paperScenes[0];
  assert.equal(scene.textPlan[0].postshootBinding.firstReadableFrame, 0);
  const identity = core.buildSceneIdentity(scene, 0);
  // Static calibration labels exercise actual Chinese OCR, not paper animation or real speech.
  const font = resolve(homedir(), 'Library/Fonts/NotoSansCJKsc-Regular.otf');
  assert.ok(existsSync(font), 'synthetic OCR fixture requires the installed local Chinese font');
  const width = 960, height = 540;
  const inputPath = resolve(root, 'synthetic-labels.png');
  const imageArgs = ['-size', `${width}x${height}`, 'xc:white'];
  for (const node of scene.textPlan) {
    const {box} = scene.layoutContract.paperLabelSurfaceBoxes.find(surface => surface.nodeId === node.nodeId);
    imageArgs.push('(', '-size', `${Math.ceil(box.width * width)}x${Math.ceil(box.height * height)}`, 'xc:white',
      '-font', font, '-pointsize', '28', '-fill', 'black', '-gravity', 'center', '-annotate', '+0+0', node.text, ')',
      '-gravity', 'northwest', '-geometry', `+${Math.floor(box.x * width)}+${Math.floor(box.y * height)}`, '-composite');
  }
  mediaCore.runPaperMediaTool(mediaTools.magick, [...imageArgs, inputPath]);
  const testVideoPath = resolve(root, 'synthetic-labels.mp4');
  // Lossless test encoding keeps compression noise from turning this into an OCR benchmark.
  mediaCore.runPaperMediaTool(mediaTools.ffmpeg, ['-nostdin', '-v', 'error', '-loop', '1', '-framerate', '30', '-i', inputPath,
    '-frames:v', '240', '-c:v', 'libx264', '-crf', '0', '-pix_fmt', 'yuv420p', '-n', testVideoPath]);
  const collected = collector.collectPaperAssetEvidence({planPath: planRef.path, sceneId: identity.sceneId,
    videoPath: testVideoPath, out: resolve(root, 'collected-evidence')});
  const collectedArtifact = json(collected.receipt.path);
  assert.equal(collected.exitCode, 0, JSON.stringify(collectedArtifact.ocrFailures));
  assert.equal(collected.formalEligible, false);
  assert.equal(collected.status, 'evidence-collected-pending-independent-review');
  const evidence = collectedArtifact.assetEvidence;
  const video = evidence.productionCandidate;
  assert.equal(video.sha256, core.sha256File(testVideoPath));
  const binding = {sceneId: identity.sceneId, videoSha256: video.sha256, planSha256: planRef.sha256, revisionId: 'synthetic-r1'};
  const mediaQa = json(evidence.mediaQaReceipt.path);
  const coordinates = Object.fromEntries(['frameCount', 'fpsNumerator', 'fpsDenominator', 'width', 'height'].map(key => [key, mediaQa[key]]));
  assert.deepEqual(coordinates, {frameCount: 240, fpsNumerator: 30, fpsDenominator: 1, width, height});
  assert.equal(json(mediaQa.probeCommand.path).exitCode, 0);
  assert.equal(json(mediaQa.decodeCommand.path).exitCode, 0);
  assert.equal(json(json(evidence.extractionReceipt.path).commandReceipt.path).exitCode, 0);
  const fps = coordinates.fpsNumerator / coordinates.fpsDenominator;
  const required = incidentCore.requiredPaperIntakeFrames(scene, coordinates);
  assert.deepEqual(required.errors, []);
  const frames = evidence.evidenceFrames;
  assert.deepEqual(frames.map(frame => frame.frameIndex), required.frameIndices);
  for (const frame of frames) {
    const ocr = json(frame.ocrReceipt.path);
    assert.equal(ocr.engine.name, 'tesseract');
    assert.equal(ocr.allExact, true);
    assert.equal(ocr.results.length, scene.textPlan.length);
    for (const result of ocr.results) {
      assert.equal(result.raw.format, 'tesseract-tsv');
      assert.equal(json(result.ocrCommand.path).exitCode, 0);
      assert.equal(result.raw.sha256, core.sha256File(result.raw.path));
    }
  }
  console.log(`PASS collectPaperAssetEvidence: ${frames.length} real source frames and ${frames.length * scene.textPlan.length} real OCR samples`);
  const evidenceSetSha256 = incidentCore.computePaperEvidenceSetSha256(frames);
  const review = kind => put(`evidence/${kind}.json`, {schemaVersion: 'koubo-paper-dynamic-review/v1', ...binding,
    evidenceScope: 'synthetic', kind, evidenceSetSha256, reviewerId: `synthetic-${kind}-reviewer`, reviewedAt: '2026-09-08T00:00:00Z',
    method: kind === 'silent' ? 'silent-video' : 'video-and-plan', status: 'passed', findings: [],
    reviewedFrameIndices: required.frameIndices, playbackCoverage: [{startFrame: 0, endFrame: coordinates.frameCount - 1, observation: 'synthetic test only, not actual viewing'}],
    observations: scene.motionContract.actions.map(a => ({actionId: a.id, stageId: a.stageId, startFrame: a.startSeconds * fps, endFrame: a.endSeconds * fps,
      object: 'synthetic paper', change: 'synthetic movement', spokenConsistency: 'synthetic match', verdict: 'matches-plan'})),
    observedEvents: scene.motionContract.actions.map(a => ({...Object.fromEntries(['id', 'partId', 'operation', 'fromGroupId', 'toGroupId'].map(k => [k, a[k]])),
      actionId: a.id, startFrame: a.startSeconds * fps, endFrame: a.endSeconds * fps,
      evidenceFrameIndices: [a.startSeconds * fps - 1, a.startSeconds * fps, a.endSeconds * fps, a.endSeconds * fps + 1], observation: 'synthetic event'})),
    textObservations: frames.map(f => ({frameIndex: f.frameIndex, nodes: scene.textPlan.map(t => ({nodeId: t.nodeId,
      status: 'visible-readable', shape: 'rigid-unchanged', observation: 'synthetic text'}))})),
  });
  const intake = {schemaVersion: 'koubo-paper-generated-asset-intake/v1', taskId: request.taskId, revisionId: 'synthetic-r1',
    policy: {incidentPreventionVersion: '1'}, sourcePlan: planRef,
    contactSheetFontPath: font,
    assets: [{...identity, ...evidence, inputFirstFrame: {...ref(inputPath), pHash: '0123456789abcdef', evidenceScope: 'synthetic'},
      expectedObjectGroupIds: scene.objectGroups.map(g => g.id), expectedStageIds: scene.stages.map(s => s.id),
      semanticReviewReceipt: review('semantic'), silentViewReviewReceipt: review('silent'),
    }], outputs: {contactSheetPath: resolve(root, 'contact.png'), contactSheetManifestPath: resolve(root, 'contact.json'), validationReceiptPath: resolve(root, 'intake-validation.json')},
  };
  const pending = structuredClone(intake);
  pending.assets[0].semanticReviewReceipt = evidence.semanticReviewReceipt;
  pending.assets[0].silentViewReviewReceipt = evidence.silentViewReviewReceipt;
  for (const key of ['semanticReviewReceipt', 'silentViewReviewReceipt']) assert.equal(json(evidence[key].path).status, 'pending-review');
  const pendingResult = intakeCore.validatePaperAssetIntake({request: pending, requestPath: resolve(root, 'pending-intake.json'), projectRoot: root, requireContactSheet: false});
  assert.equal(pendingResult.ok, false);
  assert.ok(pendingResult.errors.some(error => error.includes('PAPER_ASSET_SEMANTIC_REVIEW')));
  assert.ok(pendingResult.errors.some(error => error.includes('PAPER_ASSET_SILENT_REVIEW')));
  const intakeRef = put('intake.json', intake);
  const beforeContact = intakeCore.validatePaperAssetIntake({request: intake, requestPath: intakeRef.path, projectRoot: root, requireContactSheet: false});
  assert.equal(beforeContact.ok, true, beforeContact.errors.join('\n'));
  assert.equal(beforeContact.sourceFramesVerified, false);
  assert.equal(beforeContact.sourceFrameExecutionVerificationRequired, true);
  cli('build-paper-asset-contact-sheet.mjs', intakeRef.path);
  cli('validate-paper-generated-asset-intake.mjs', intakeRef.path);
  const intakeReceipt = json(intake.outputs.validationReceiptPath);
  assert.equal(intakeReceipt.gates.actualProbeFullDecodeAndSourceFramePixelsVerified, true);
  assert.equal(intakeReceipt.formalEligible, false);
  assert.equal(intakeReceipt.sourceVerification.length, 1);
  assert.equal(intakeReceipt.sourceVerification[0].frames.length, frames.length);
  assert.deepEqual(intakeReceipt.sourceVerification[0].media, coordinates);
  const verifyFrames = extra => mediaCore.verifyPaperSourceFrames({videoPath: video.path, videoSha256: video.sha256,
    frames: [frames[0]], expectedMedia: coordinates, ...extra});
  assert.throws(() => verifyFrames({expectedMedia: {...coordinates, width: width + 1}}), /PAPER_SOURCE_PROBE_MISMATCH:width/u);
  const wrongImagePath = resolve(root, 'wrong-source-pixels.png');
  mediaCore.runPaperMediaTool(mediaTools.magick, ['-size', `${width}x${height}`, 'xc:black', wrongImagePath]);
  assert.throws(() => verifyFrames({frames: [{...frames[0], ...ref(wrongImagePath)}]}), /PAPER_SOURCE_FRAME_PIXEL_MISMATCH:0/u);
  const job = {jobId: '20260908-synthetic-producer', videoId: 'synthetic-episode', productionEligible: false,
    formal: {enabled: false}, experiment: {status: 'candidate-preview-required', userPreviewApproved: false}, inputs: {source: media.path},
    director: {taskId: request.taskId, artifacts: {preproductionRequest: preRequest, routeLock: ref(request.outputs.routeLockPath),
      preproductionPlan: ref(request.outputs.planPath), preproductionValidation: ref(request.outputs.validationReceiptPath),
      postshootRequest: postRequest, postshootPlan: planRef, postshootValidation: ref(resolve(root, 'post-validation.json'))}},
    productionGate: {state: inputCore.FIRST_CANDIDATE_GATE_STATE, revisionId: 'synthetic-r1', productionEligible: false, userPreviewApproved: false, formalEnabled: false},
  };
  const built = inputCore.buildFirstCandidateInputContract({projectRoot: root, job, assetIntake: intakeRef.path,
    assetIntakeValidation: intake.outputs.validationReceiptPath, executionGroupId: 'synthetic-executor', authorizedUserId: 'synthetic-user'});
  assert.equal(built.validation.ok, true);
  assert.equal(built.contract.productionEligible, false);
  assert.equal(built.contract.candidate, null);
  assert.ok(built.validation.files.some(f => f.path === registry));
  const runtimeTools = mediaCore.paperMediaTools(['ffmpeg', 'ffprobe', 'magick', 'tesseract']);
  const runtimeFiles = built.validation.files.filter(file => file.role === 'runtime-tool');
  assert.deepEqual(runtimeFiles.map(file => file.name).sort(), Object.keys(runtimeTools).sort());
  for (const file of runtimeFiles) {
    assert.equal(file.path, runtimeTools[file.name].path);
    assert.equal(file.sha256, runtimeTools[file.name].sha256);
    assert.equal(file.sha256, core.sha256File(file.path));
  }
  assert.equal(existsSync(resolve(root, 'candidate.mp4')), false);
  const badMotion = structuredClone(request);
  badMotion.beats[0].paperScene.motionContract.actions[0].partId = badMotion.beats[0].paperScene.motionContract.parts[0].id;
  badMotion.beats[0].paperScene.motionContract.actions[0].operation = 'fold';
  assert.equal(core.validatePreproductionRequest({request: badMotion, projectRoot: root, profile}).ok, false);
  const postCore = await import(pathToFileURL(resolve(root, scripts, 'postshoot-rebind-core.mjs')));
  const post = json(postRequest.path);
  const postValidation = postCore.validatePostshootRebindRequest({request: post, projectRoot: root});
  const altered = structuredClone(plan); altered.beats[0].spokenLine = 'synthetic invented speech';
  assert.equal(postCore.validatePostshootRebindPlan({request: post, requestPath: postRequest.path, validation: postValidation, plan: altered}).ok, false);
  const wrongOcr = structuredClone(intake); wrongOcr.assets[0].evidenceFrames[0].ocrReceipt.sha256 = '0'.repeat(64);
  assert.equal(intakeCore.validatePaperAssetIntake({request: wrongOcr, requestPath: intakeRef.path, projectRoot: root, requireContactSheet: true}).ok, false);
  for (const path of [...copiedSourcePaths, registry]) {
    assert.equal(core.sha256File(resolve(repo, path)), core.sha256File(resolve(root, path)), `联测期间生产者源码变化，需要重跑：${path}`);
  }
  console.log(JSON.stringify({ok: true, evidenceScope: 'synthetic', realProducerClis: cliRuns,
    validatorMocks: false, factory: 'buildFirstCandidateInputContract', boundFiles: built.validation.files.length,
    boundRuntimeTools: runtimeFiles.map(file => file.name).sort(),
    nativeNegativeCases: 6, sourceSnapshotCurrentAtEnd: true,
    mediaEvidenceProducer: 'collectPaperAssetEvidence', actualProbeFullDecodeAndSourceFramePixelsVerified: true,
    actualOcrSamples: frames.length * scene.textPlan.length, pendingIndependentReviewsRejected: true,
    syntheticReviewFixtures: true, inputFirstFramePHashSynthetic: true,
    currentProducerOutputsCompatible: true, recordedSpeechOrMediaAcceptanceProven: false,
    signedAuthorization: false, productionEligible: false, formal: false, syntheticTestVideosGenerated: 2, productionRenderInvoked: false}));
} finally { rmSync(root, {recursive: true, force: true}); }
