import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isText, resolveDeclared, sha256File, sha256Json} from './preproduction-director-core.mjs';

const list = value => Array.isArray(value) ? value : [];
const same = (a, b) => a.length === b.length && new Set(a).size === a.length &&
  new Set(b).size === b.length && a.every(value => b.includes(value));
const normalized = value => typeof value === 'string' ? value.replace(/\s/gu, '') : null;
const registryPath = fileURLToPath(new URL('../references/paper-motion-incident-registry.v1.json', import.meta.url));

const readBound = (root, ref, errors, code, json = true) => {
  try {
    const file = resolveDeclared(root, ref?.path);
    if (!file || sha256File(file) !== ref?.sha256) throw new Error('binding');
    const raw = readFileSync(file, 'utf8');
    return json ? JSON.parse(raw) : raw;
  } catch {
    errors.push(`${code}_FILE_OR_SHA_INVALID`);
    return null;
  }
};

export function resolvePaperIntakeIncidentPolicy({request, plan, projectRoot, profile}) {
  const errors = [];
  const profilePath = path.join(projectRoot, 'workflow/active-director-profile.v1.json');
  let diskProfile;
  if (existsSync(profilePath)) {
    try {diskProfile = JSON.parse(readFileSync(profilePath, 'utf8'));}
    catch {errors.push('PAPER_ASSET_INCIDENT_PROFILE_INVALID');}
  }
  const sources = [request, plan, profile, diskProfile];
  const versions = sources.flatMap(value => [value?.policy?.incidentPreventionVersion, value?.incidentPreventionVersion, value?.incidentPreventionPolicy?.version]);
  if (versions.some(value => value !== undefined && value !== '1')) errors.push('PAPER_ASSET_INCIDENT_POLICY_VERSION_INVALID');
  const required = versions.includes('1') || sources.some(value => value?.incidentPreventionPolicy?.requiredForNewPreproduction === true) ||
    list(plan?.paperScenes).some(scene => scene?.motionContract !== undefined);
  if (required && request?.policy?.incidentPreventionVersion !== '1') errors.push('PAPER_ASSET_INCIDENT_REQUEST_POLICY_REQUIRED');
  if (required && plan?.policy?.incidentPreventionVersion !== '1') errors.push('PAPER_ASSET_INCIDENT_PLAN_POLICY_REQUIRED');
  if (required && (!isText(request.revisionId) || !isText(plan?.revisionId) || request.revisionId !== plan.revisionId)) errors.push('PAPER_ASSET_INCIDENT_REVISION_MISMATCH');
  return {required, errors};
}

export function validatePaperIncidentRegistryAssets({assets, projectRoot}) {
  const errors = [];
  let registry;
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    if (registry.schemaVersion !== 'koubo-paper-motion-incident-registry/v1' ||
      registry.policy !== 'negative-regression-only-never-successful-reuse' ||
      !Array.isArray(registry.incidents) || !registry.incidents.length ||
      registry.incidents.some(entry => !/^[a-f0-9]{64}$/u.test(entry.videoSha256) || entry.reusableSuccess !== false)) throw new Error('registry');
  } catch {return {errors: ['PAPER_ASSET_NEGATIVECASE_REGISTRY_INVALID'], registry: null};}
  for (const asset of assets) {
    for (const key of ['generatedVideo', 'productionCandidate']) {
      const ref = asset?.[key];
      let actual;
      try {actual = sha256File(resolveDeclared(projectRoot, ref?.path));} catch { /* Main binding reports missing files. */ }
      for (const incident of registry.incidents) {
        if ([ref?.sha256, actual].includes(incident.videoSha256)) {
          errors.push(`PAPER_ASSET_NEGATIVECASE_NOT_REUSABLE:${asset?.sceneId}:${key}:${incident.sceneId}:${incident.code}`);
        }
      }
    }
  }
  return {errors, registry: {path: registryPath, sha256: sha256File(registryPath)}};
}

// Frame coordinates are zero-based in the candidate video, never host-timeline frames.
export function requiredPaperIntakeFrames(scene, media) {
  const errors = [];
  const {frameCount, fpsNumerator, fpsDenominator} = media ?? {};
  if (!Number.isSafeInteger(frameCount) || frameCount < 3 || frameCount > 216000 ||
    !Number.isSafeInteger(fpsNumerator) || !Number.isSafeInteger(fpsDenominator) ||
    fpsNumerator <= 0 || fpsDenominator <= 0 || fpsNumerator / fpsDenominator > 240 || fpsNumerator / fpsDenominator < 1) {
    return {errors: ['MEDIA_COORDINATES_INVALID'], frameIndices: [], actions: []};
  }
  const fps = fpsNumerator / fpsDenominator;
  const last = frameCount - 1;
  const frames = new Set([0, Math.floor(frameCount / 2), last]);
  const clamp = n => Math.max(0, Math.min(last, n));
  const grid = (start, end, step) => {
    for (let frame = start; frame <= end; frame += step) frames.add(clamp(frame));
    frames.add(clamp(end));
  };
  grid(0, last, Math.max(1, Math.floor(fps / 2)));
  const actions = list(scene?.motionContract?.actions);
  const stageIds = list(scene?.stages).map(stage => stage.id);
  if (!actions.length || !same(actions.map(a => a.id), [...new Set(actions.map(a => a.id))]) ||
    !same(actions.map(a => a.stageId), stageIds) || actions.some(a => !isText(a.id))) errors.push('ACTION_COVERAGE_INVALID');
  const windows = [...actions, ...list(scene?.motionContract?.highRiskWindows)];
  if (scene?.motionContract?.highRiskWindows !== undefined && !Array.isArray(scene.motionContract.highRiskWindows)) errors.push('RISK_WINDOWS_INVALID');
  for (const window of windows) {
    const {startSeconds: start, endSeconds: end} = window ?? {};
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > frameCount / fps) {
      errors.push(`ACTION_OR_RISK_TIME_INVALID:${window?.id}`); continue;
    }
    for (const seconds of [start, end]) {
      for (const boundary of [Math.floor(seconds * fps), Math.ceil(seconds * fps)]) {
        for (const offset of [-1, 0, 1]) frames.add(clamp(boundary + offset));
      }
    }
    // Every action is high risk; declaring an empty risk list cannot remove density.
    grid(Math.floor(start * fps), Math.ceil(end * fps), Math.max(1, Math.floor(fps / 4)));
  }
  return {errors, frameIndices: [...frames].sort((a, b) => a - b), actions, fps, frameCount};
}

export const computePaperEvidenceSetSha256 = frames => sha256Json([...frames]
  .sort((a, b) => a.frameIndex - b.frameIndex)
  .map(frame => ({frameIndex: frame.frameIndex, imageSha256: frame.sha256, ocrReceiptSha256: frame.ocrReceipt?.sha256 ?? null})));

function expectedNodes(scene, errors) {
  const nodes = list(scene?.textPlan);
  if (!nodes.length || !same(nodes.map(n => n.nodeId), [...new Set(nodes.map(n => n.nodeId))])) errors.push('TEXT_PLAN_NODE_IDS_INVALID');
  for (const node of nodes) {
    if (!isText(node.nodeId) || !isText(node.text)) errors.push('TEXT_PLAN_NODE_INVALID');
    if (node.enterStageId !== 'initial' || node.firstReadableFrame !== 0 || node.persistence !== 'initial-to-end') errors.push(`INITIAL_LABEL_PERSISTENCE_INVALID:${node.nodeId}`);
  }
  return nodes;
}

export function readPaperOcrRawText(raw, root, errors = [], code = 'PAPER_ASSET_OCR_RAW') {
  const contents = readBound(root, raw, errors, code, false);
  if (contents === null) return null;
  if (raw.format === 'text') return normalized(contents);
  if (raw.format !== 'tesseract-tsv') {errors.push(`${code}_FORMAT_INVALID`); return null;}
  const rows = contents.trimEnd().split(/\r?\n/u).map(row => row.split('\t'));
  const header = rows.shift() ?? [];
  const indexes = ['level', 'conf', 'text'].map(name => header.indexOf(name));
  if (indexes.some(index => index < 0)) {errors.push(`${code}_TSV_INVALID`); return null;}
  return normalized(rows.filter(row => row[indexes[0]] === '5' && Number(row[indexes[1]]) >= 0).map(row => row[indexes[2]] ?? '').join(''));
}

export function validatePaperFrameOcr({receipt, scene, frame, videoSha256, planSha256, revisionId, sceneId, projectRoot}) {
  const errors = [];
  const nodes = expectedNodes(scene, errors);
  if (receipt?.schemaVersion !== 'koubo-paper-frame-ocr/v1' || receipt.videoSha256 !== videoSha256 ||
    receipt.planSha256 !== planSha256 || receipt.sceneId !== sceneId || receipt.frameIndex !== frame.frameIndex ||
    receipt.imageSha256 !== frame.sha256 || (revisionId !== undefined && receipt.revisionId !== revisionId) ||
    !isText(receipt.engine?.name) || !isText(receipt.engine?.version)) errors.push('OCR_BINDING_INVALID');
  if (receipt?.exact === false || receipt?.allExact === false ||
    (receipt?.status !== undefined && receipt.status !== 'passed')) errors.push('OCR_EXPLICIT_FAILURE');
  const results = list(receipt?.results);
  if (!same(results.map(n => n.nodeId), nodes.map(n => n.nodeId))) errors.push('OCR_NODE_COVERAGE_INVALID');
  for (const node of nodes) {
    const result = results.find(item => item.nodeId === node.nodeId);
    if (!result) continue;
    const actual = readPaperOcrRawText(result.raw, projectRoot, errors);
    if (result.expected !== node.text || normalized(result.recognized) !== normalized(node.text) ||
      actual !== normalized(node.text) || !['visible-readable', 'ocr-readable-not-visually-reviewed'].includes(result.visibility) ||
      result.exact === false) errors.push(`OCR_NODE_NOT_EXACT_OR_VISIBLE:${node.nodeId}`);
  }
  return errors;
}

function validateObservedMotion(review, scene, sampling, frameIndices, code) {
  const errors = [];
  const fail = (condition, suffix) => {if (!condition) errors.push(`${code}_${suffix}`);};
  const {actions, fps, frameCount} = sampling;
  const events = list(review?.observedEvents);
  fail(same(events.map(event => event.actionId), actions.map(action => action.id)), 'OBSERVED_ACTION_COVERAGE_INVALID');
  // Planned swept rectangles are deliberately not accepted as measured motion.
  for (const action of actions) {
    const event = events.find(e => e.actionId === action.id);
    const start = event?.startFrame;
    const end = event?.endFrame;
    fail(['partId', 'operation', 'fromGroupId', 'toGroupId'].every(key => isText(action[key]) && event?.[key] === action[key]) &&
      Number.isSafeInteger(start) && Number.isSafeInteger(end) && start < end &&
      start >= Math.floor(action.startSeconds * fps) && end <= Math.min(frameCount - 1, Math.ceil(action.endSeconds * fps)) &&
      isText(event?.observation), `OBSERVED_EVENT_MISMATCH:${action.id}`);
    const evidence = list(event?.evidenceFrameIndices);
    fail(evidence.every(index => frameIndices.includes(index)) &&
      [Math.max(0, start - 1), start, end, Math.min(frameCount - 1, end + 1)].every(index => evidence.includes(index)),
    `OBSERVED_EVENT_FRAME_EVIDENCE_MISSING:${action.id}`);
  }
  for (const rule of list(scene.motionContract?.requiredPredecessors)) {
    const before = events.find(e => e.actionId === rule.beforeActionId);
    const after = events.find(e => e.actionId === rule.actionId);
    fail(before && after && Number.isSafeInteger(before.endFrame) && Number.isSafeInteger(after.startFrame) &&
      before.endFrame <= after.startFrame, 'OBSERVED_PRECONDITION_VIOLATED');
  }
  for (const forbidden of list(scene.motionContract?.forbiddenTransfers)) {
    fail(!events.some(event => event.partId === forbidden.partId && event.toGroupId === forbidden.toGroupId), 'OBSERVED_FORBIDDEN_TRANSFER');
  }
  const coverage = list(review?.playbackCoverage).slice().sort((a, b) => a.startFrame - b.startFrame);
  let next = 0;
  for (const interval of coverage) {
    fail(Number.isSafeInteger(interval.startFrame) && Number.isSafeInteger(interval.endFrame) &&
      interval.startFrame === next && interval.endFrame >= interval.startFrame && interval.endFrame < frameCount &&
      isText(interval.observation), 'PLAYBACK_INTERVAL_INVALID');
    next = interval.endFrame + 1;
  }
  fail(next === frameCount, 'PLAYBACK_COVERAGE_INCOMPLETE');
  return errors;
}

export function validatePaperIncidentAsset({asset, scene, sceneId, request, projectRoot, mediaQa}) {
  const errors = [];
  const sampling = requiredPaperIntakeFrames(scene, mediaQa);
  errors.push(...sampling.errors.map(code => `PAPER_ASSET_SAMPLING_${code}:${sceneId}`));
  if (sampling.errors.length) return {errors, requiredFrameIndices: sampling.frameIndices};
  const {fps, frameCount, actions} = sampling;
  const videoSha256 = asset.productionCandidate?.sha256;
  const planSha256 = request.sourcePlan.sha256;
  const revisionId = request.revisionId;
  const bound = receipt => receipt?.sceneId === sceneId && receipt.videoSha256 === videoSha256 &&
    receipt.planSha256 === planSha256 && receipt.revisionId === revisionId;
  if (mediaQa.revisionId !== revisionId) errors.push(`PAPER_ASSET_MEDIA_QA_REVISION_MISMATCH:${sceneId}`);
  const probe = readBound(projectRoot, mediaQa.probe, errors, `PAPER_ASSET_PROBE:${sceneId}`);
  const streams = list(probe?.streams).filter(stream => stream.codec_type === 'video');
  const rate = `${mediaQa.fpsNumerator}/${mediaQa.fpsDenominator}`;
  if (streams.length !== 1 || Number(streams[0]?.nb_read_frames ?? streams[0]?.nb_frames) !== frameCount ||
    streams[0]?.avg_frame_rate !== rate || streams[0]?.r_frame_rate !== rate ||
    !Number.isSafeInteger(mediaQa.width) || !Number.isSafeInteger(mediaQa.height) || mediaQa.width <= 0 || mediaQa.height <= 0 ||
    streams[0]?.width !== mediaQa.width || streams[0]?.height !== mediaQa.height) errors.push(`PAPER_ASSET_PROBE_COORDINATES_MISMATCH:${sceneId}`);
  const frames = list(asset.evidenceFrames);
  const frameIndices = frames.map(f => f.frameIndex);
  if (new Set(frameIndices).size !== frames.length || frames.some(f => !Number.isSafeInteger(f.frameIndex) || f.frameIndex < 0 || f.frameIndex >= frameCount)) errors.push(`PAPER_ASSET_FRAME_COORDINATES_INVALID:${sceneId}`);
  const moments = {first: 0, middle: Math.floor(frameCount / 2), last: frameCount - 1};
  for (const [moment, index] of Object.entries(moments)) {
    if (!frames.some(f => f.frameIndex === index && f.moment === moment)) errors.push(`PAPER_ASSET_FRAME_MOMENT_MISMATCH:${sceneId}:${moment}`);
  }
  if (!sampling.frameIndices.every(index => frameIndices.includes(index))) errors.push(`PAPER_ASSET_SAMPLING_COVERAGE_INCOMPLETE:${sceneId}`);
  const extraction = readBound(projectRoot, asset.extractionReceipt, errors, `PAPER_ASSET_EXTRACTION:${sceneId}`);
  if (extraction?.schemaVersion !== 'koubo-paper-frame-extraction/v1' || !bound(extraction) ||
    extraction.media?.frameCount !== frameCount || extraction.media?.fpsNumerator !== mediaQa.fpsNumerator ||
    extraction.media?.fpsDenominator !== mediaQa.fpsDenominator ||
    !same(list(extraction.frames).map(f => f.frameIndex), frameIndices) ||
    frames.some(frame => !list(extraction.frames).some(f => f.frameIndex === frame.frameIndex && f.imageSha256 === frame.sha256))) errors.push(`PAPER_ASSET_EXTRACTION_BINDING_INVALID:${sceneId}`);
  for (const frame of frames) {
    const receipt = readBound(projectRoot, frame.ocrReceipt, errors, `PAPER_ASSET_OCR:${sceneId}:${frame.frameIndex}`);
    errors.push(...validatePaperFrameOcr({receipt, scene, frame, videoSha256, planSha256, revisionId, sceneId, projectRoot})
      .map(code => `PAPER_ASSET_${code}:${sceneId}:${frame.frameIndex}`));
  }
  const evidenceSetSha256 = computePaperEvidenceSetSha256(frames);
  const reviewerIds = [];
  for (const kind of ['semantic', 'silent']) {
    const code = `PAPER_ASSET_${kind.toUpperCase()}_REVIEW:${sceneId}`;
    const review = readBound(projectRoot, asset[kind === 'silent' ? 'silentViewReviewReceipt' : 'semanticReviewReceipt'], errors, code);
    reviewerIds.push(review?.reviewerId?.trim?.());
    if (review?.schemaVersion !== 'koubo-paper-dynamic-review/v1' || review.kind !== kind || !bound(review) ||
      review.evidenceSetSha256 !== evidenceSetSha256 || review.status !== 'passed' ||
      review.method !== (kind === 'silent' ? 'silent-video' : 'video-and-plan') ||
      !isText(review.reviewerId) || !isText(review.reviewedAt) || !Number.isFinite(Date.parse(review.reviewedAt)) ||
      !same(list(review.reviewedFrameIndices), frameIndices) || !Array.isArray(review.findings) || review.findings.length !== 0 ||
      list(review.p0).length > 0 || list(review.p1).length > 0) errors.push(`${code}_BINDING_OR_FINDINGS_INVALID`);
    errors.push(...validateObservedMotion(review, scene, sampling, frameIndices, code));
    const observations = list(review?.observations);
    if (!same(observations.map(o => o.actionId), actions.map(a => a.id))) errors.push(`${code}_ACTION_COVERAGE_INVALID`);
    for (const action of actions) {
      const observation = observations.find(o => o.actionId === action.id);
      if (observation?.stageId !== action.stageId || observation.startFrame !== Math.floor(action.startSeconds * fps) ||
        observation.endFrame !== Math.min(frameCount - 1, Math.ceil(action.endSeconds * fps)) || observation.verdict !== 'matches-plan' ||
        !isText(observation.object) || !isText(observation.change) || !isText(observation.spokenConsistency)) errors.push(`${code}_ACTION_OBSERVATION_INVALID:${action.id}`);
    }
    const textObservations = list(review?.textObservations);
    if (!same(textObservations.map(o => o.frameIndex), frameIndices)) errors.push(`${code}_TEXT_FRAME_COVERAGE_INVALID`);
    for (const frame of frames) {
      const nodes = expectedNodes(scene, errors);
      const observed = list(textObservations.find(o => o.frameIndex === frame.frameIndex)?.nodes);
      if (!same(observed.map(n => n.nodeId), nodes.map(n => n.nodeId)) || observed.some(n => n.status !== 'visible-readable' || n.shape !== 'rigid-unchanged' || !isText(n.observation))) errors.push(`${code}_TEXT_VISIBILITY_OR_RIGIDITY_INVALID:${frame.frameIndex}`);
    }
  }
  if (!reviewerIds[0] || !reviewerIds[1] || reviewerIds[0] === reviewerIds[1]) errors.push(`PAPER_ASSET_INDEPENDENT_REVIEWERS_REQUIRED:${sceneId}`);
  return {errors, requiredFrameIndices: sampling.frameIndices, evidenceSetSha256};
}
