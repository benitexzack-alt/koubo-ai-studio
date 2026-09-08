#!/usr/bin/env node
import {copyFileSync, constants, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSceneIdentity, sha256File} from './preproduction-director-core.mjs';
import {requiredPaperIntakeFrames, readPaperOcrRawText, validatePaperIncidentRegistryAssets, computePaperEvidenceSetSha256} from './paper-asset-intake-incident.mjs';
import {paperMediaTools, probePaperVideo, runPaperMediaTool, paperFrameSelect} from './paper-asset-intake-media.mjs';

export function collectPaperAssetEvidence({planPath, sceneId, videoPath, out, negativeDiagnostics = false}) {
  for (const value of [planPath, videoPath, out]) if (!path.isAbsolute(value)) throw new Error('PAPER_COLLECT_ABSOLUTE_PATH_REQUIRED');
  if (existsSync(out)) throw new Error('PAPER_COLLECT_NEW_OUTPUT_REQUIRED');
  if (!statSync(planPath).isFile() || !statSync(videoPath).isFile()) throw new Error('PAPER_COLLECT_REGULAR_INPUT_FILE_REQUIRED');
  const planSha256 = sha256File(planPath);
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const index = Number(/^P(\d+)$/u.exec(sceneId)?.[1]) - 1;
  const scene = plan.paperScenes?.[index];
  if (!scene) throw new Error('PAPER_COLLECT_SCENE_UNKNOWN');
  if (!negativeDiagnostics && (plan.policy?.incidentPreventionVersion !== '1' || !plan.revisionId || plan.phase !== 'post-shoot')) throw new Error('PAPER_COLLECT_NEW_PLAN_REQUIRED');
  const source = {path: videoPath, sha256: sha256File(videoPath)};
  const registry = validatePaperIncidentRegistryAssets({assets: [{sceneId, generatedVideo: source}], projectRoot: path.dirname(planPath)});
  if (registry.errors.length && (!negativeDiagnostics || registry.errors.some(error => !error.includes('NEGATIVECASE_NOT_REUSABLE')))) {
    throw new Error(registry.errors.join('|'));
  }
  const tools = paperMediaTools(['ffmpeg', 'ffprobe', 'magick', 'tesseract']);
  mkdirSync(out, {recursive: false});
  const save = (name, data) => {
    const file = path.join(out, name);
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
    return {path: file, sha256: sha256File(file)};
  };
  const identity = buildSceneIdentity(scene, index);
  const candidatePath = path.join(out, `${sceneId}__${identity.pairSha256.slice(0, 8)}.mp4`);
  copyFileSync(videoPath, candidatePath, constants.COPYFILE_EXCL);
  if (sha256File(candidatePath) !== source.sha256) throw new Error('PAPER_COLLECT_COPY_SHA_MISMATCH');
  const candidate = {path: candidatePath, sha256: source.sha256, canonicalFileName: path.basename(candidatePath)};
  const revisionId = plan.revisionId ?? 'negative-readonly-diagnostic';
  const binding = {sceneId, revisionId, videoSha256: source.sha256, planSha256};
  const {probe, media, commandReceipt: probeCommand} = probePaperVideo(candidatePath, tools, {out});
  const probeRef = save('probe.json', probe);
  const sampling = requiredPaperIntakeFrames(scene, media);
  if (sampling.errors.length) throw new Error(`PAPER_COLLECT_SAMPLING_INVALID:${sampling.errors.join('|')}`);
  const decode = runPaperMediaTool(tools.ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-i', candidatePath,
    '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-'], {out, name: 'full-decode'});
  const mediaQaReceipt = save('media-qa.json', {...binding, ...media, fullDecodePassed: true, probe: probeRef,
    probeCommand, decodeCommand: decode.commandReceipt, negativeRegressionOnly: negativeDiagnostics || registry.errors.length > 0});
  const framesDir = path.join(out, 'frames'); mkdirSync(framesDir);
  const extract = runPaperMediaTool(tools.ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-i', candidatePath,
    '-map', '0:v:0', '-vf', paperFrameSelect(sampling.frameIndices), '-an', '-pix_fmt', 'rgb24',
    '-fps_mode', 'passthrough', '-start_number', '0', '-n', path.join(framesDir, 'frame-%06d.png')], {out, name: 'extract'});
  const engine = {name: 'tesseract', version: runPaperMediaTool(tools.tesseract, ['--version']).stdout.split('\n')[0]};
  const frames = [];
  const ocrFailures = [];
  for (const [ordinal, frameIndex] of sampling.frameIndices.entries()) {
    const framePath = path.join(framesDir, `frame-${String(ordinal).padStart(6, '0')}.png`);
    const frame = {path: framePath, sha256: sha256File(framePath), frameIndex,
      moment: frameIndex === 0 ? 'first' : frameIndex === Math.floor(media.frameCount / 2) ? 'middle' :
        frameIndex === media.frameCount - 1 ? 'last' : 'action-grid'};
    const results = [];
    for (const node of scene.textPlan ?? []) {
      const rectangles = scene.layoutContract?.paperLabelSurfaceBoxes?.filter(box => box.nodeId === node.nodeId) ?? [];
      const rect = rectangles[0]?.box;
      if (rectangles.length !== 1 || !rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
        rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > 1 || rect.y + rect.height > 1) throw new Error(`PAPER_COLLECT_OCR_ROI_REQUIRED:${node.nodeId}`);
      const left = Math.floor(rect.x * media.width), top = Math.floor(rect.y * media.height);
      const width = Math.min(media.width - left, Math.ceil(rect.width * media.width));
      const height = Math.min(media.height - top, Math.ceil(rect.height * media.height));
      const name = `f${frameIndex}-n${results.length}`;
      const cropPath = path.join(out, `${name}.png`);
      const crop = runPaperMediaTool(tools.magick, [framePath, '-crop', `${width}x${height}+${left}+${top}`, '+repage', cropPath], {out, name: `${name}-crop`});
      const ocr = runPaperMediaTool(tools.tesseract, [cropPath, 'stdout', '-l', 'chi_sim', '--psm', '7', 'tsv'], {out, name: `${name}-ocr`});
      const raw = {path: path.join(out, `${name}-ocr.stdout.txt`), sha256: sha256File(path.join(out, `${name}-ocr.stdout.txt`)), format: 'tesseract-tsv'};
      const recognized = readPaperOcrRawText(raw, out);
      const exact = recognized === node.text.replace(/\s/gu, '');
      if (!exact) ocrFailures.push({frameIndex, nodeId: node.nodeId, recognized});
      results.push({nodeId: node.nodeId, expected: node.text, recognized, exact,
        visibility: exact ? 'ocr-readable-not-visually-reviewed' : 'unreadable-or-mismatched', raw,
        crop: {path: cropPath, sha256: sha256File(cropPath)}, cropRect: {left, top, width, height},
        cropCommand: crop.commandReceipt, ocrCommand: ocr.commandReceipt});
    }
    frame.ocrReceipt = save(`ocr-${frameIndex}.json`, {schemaVersion: 'koubo-paper-frame-ocr/v1', ...binding,
      frameIndex, imageSha256: frame.sha256, engine, results, allExact: results.every(result => result.exact)});
    frames.push(frame);
  }
  const extractionReceipt = save('extraction.json', {schemaVersion: 'koubo-paper-frame-extraction/v1', ...binding, media,
    producer: {path: fileURLToPath(import.meta.url), sha256: sha256File(fileURLToPath(import.meta.url))}, tools,
    commandReceipt: extract.commandReceipt, frames: frames.map(frame => ({frameIndex: frame.frameIndex, imageSha256: frame.sha256}))});
  const evidenceSetSha256 = computePaperEvidenceSetSha256(frames);
  const pendingReview = kind => save(`${kind}-review.pending.json`, {schemaVersion: 'koubo-paper-dynamic-review/v1',
    ...binding, kind, evidenceSetSha256, method: kind === 'silent' ? 'silent-video' : 'video-and-plan',
    status: 'pending-review', reviewerId: null, reviewedAt: null, reviewedFrameIndices: [], playbackCoverage: [],
    observations: [], observedEvents: [], textObservations: [], findings: []});
  const artifact = {schemaVersion: 'koubo-paper-intake-collected-evidence/v1', revisionId,
    status: negativeDiagnostics || registry.errors.length ? 'negative-regression-only-not-eligible' : 'evidence-collected-pending-independent-review',
    policy: {incidentPreventionVersion: '1'}, formalEligible: false, sourcePlan: {path: planPath, sha256: planSha256},
    negativeRegistry: registry.registry, negativeCaseErrors: registry.errors, ocrFailures,
    assetEvidence: {sceneId, pairId: identity.pairId, pairSha256: identity.pairSha256, textPlanSha256: identity.textPlanSha256,
      generatedVideo: source, productionCandidate: candidate, evidenceFrames: frames, mediaQaReceipt, extractionReceipt,
      semanticReviewReceipt: pendingReview('semantic'), silentViewReviewReceipt: pendingReview('silent')}};
  if (sha256File(videoPath) !== source.sha256 || sha256File(candidatePath) !== source.sha256 || sha256File(planPath) !== planSha256) throw new Error('PAPER_COLLECT_INPUT_CHANGED');
  const receipt = save('asset-evidence.json', artifact);
  return {receipt, status: artifact.status, sampledFrames: frames.length, ocrFailureCount: ocrFailures.length,
    negativeCaseErrors: registry.errors, formalEligible: false, exitCode: negativeDiagnostics || registry.errors.length ? 2 : ocrFailures.length ? 3 : 0};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--diagnose-known-negative') args.negative = true;
    else {args[process.argv[i].replace(/^--/u, '')] = process.argv[++i];}
  }
  try {
    const result = collectPaperAssetEvidence({planPath: path.resolve(args.plan), sceneId: args['scene-id'],
      videoPath: path.resolve(args.video), out: path.resolve(args.out), negativeDiagnostics: args.negative === true});
    console.log(JSON.stringify(result)); process.exitCode = result.exitCode;
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
