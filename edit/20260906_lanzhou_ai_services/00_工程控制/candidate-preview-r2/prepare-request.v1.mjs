import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT, CONTROL, EPISODE, REVISION, ENTRY, PUBLIC, PERMISSION, RENDER, COMPOSITION, MAX_STILLS,
  SHOTCRAFT_SOURCE, checked, absent, ensure, digest, collectRuntime, hashFile, readJson,
  requestIntentSha256, collectLocalImports, loadTypescript, validatePermission, validatePreservedInputs} from './runner-core.mjs';

const SRC = path.posix.dirname(ENTRY);
const PLAN = `${SRC}/visual-plan.v1.json`;
const encode = data => JSON.stringify(data, null, 2) + '\n';
const validFrame = n => Number.isInteger(n) && n >= 0 && n < RENDER.durationInFrames;

export function selectStillFrames(visual) {
  ensure(visual.semantic?.length === 36 && visual.effects?.length === 15, 'EXPECTED_36_SEMANTIC_15_EFFECTS');
  const points = [];
  for (const kind of ['semantic', 'effects']) {
    const ids = new Set();
    for (const scene of visual[kind]) {
      ensure(typeof scene.id === 'string' && scene.id.trim() && !ids.has(scene.id), 'KEYFRAME_SCENE_ID_INVALID');
      ids.add(scene.id);
      ensure(validFrame(scene.from) && Number.isInteger(scene.to) && scene.to <= 8393 && scene.to > scene.from + 1, 'KEYFRAME_SCENE_RANGE_INVALID');
      const duration = scene.to - scene.from;
      const middle = scene.from + Math.floor(duration * 0.55);
      let frame = scene.from + Math.floor(duration * 0.72);
      if (kind === 'effects' && scene.effectId === 'keyword-reveal') {
        ensure(Array.isArray(scene.wordFrames) && scene.wordFrames.length > 0
          && scene.wordFrames.every(n => Number.isInteger(n) && n >= 0 && n < duration), 'WORD_REVEAL_TIMING_REQUIRED');
        frame = Math.max(frame, scene.from + Math.max(...scene.wordFrames) + 8);
      }
      frame = Math.min(scene.to - 1, frame);
      points.push({kind, id: scene.id, text: scene.title ?? scene.words?.join(' / ') ?? scene.id,
        frame, from: scene.from, to: scene.to, coverageWindow: [middle, scene.to - 1],
        reason: 'mid-to-late-state', reviewed: false});
    }
  }
  const qa = visual.qaKeyframes;
  ensure(qa?.openingWords?.length === 2 && Array.isArray(qa.officialReveals) && qa.officialReveals.length > 0, 'EXPLICIT_OPENING_AND_OFFICIAL_REVEALS_REQUIRED');
  for (const kind of ['openingWords', 'officialReveals']) {
    const ids = new Set();
    for (const p of qa[kind]) {
      ensure(p.id?.trim() && p.text?.trim() && !ids.has(p.id) && validFrame(p.frame), 'EXPLICIT_REVEAL_FRAME_INVALID');
      ids.add(p.id);
      if (kind === 'officialReveals') ensure(p.frame >= 2336 && p.frame < 2614, 'OFFICIAL_REVEAL_OUTSIDE_2336_2614');
      points.push({kind, id: p.id, text: p.text, frame: p.frame, reason: 'explicit-reveal-review-frame', reviewed: false});
    }
  }
  const stillFrames = [...new Set(points.map(p => p.frame))].sort((a, b) => a - b);
  ensure(stillFrames.length <= MAX_STILLS, 'KEYFRAME_LIMIT_EXCEEDED_NO_SILENT_DROP');
  return {schemaVersion: 'lanzhou-r2-planned-still-coverage/v1', status: 'planned-pending-parent-visual-review',
    stillFrames, coverage: points, counts: {semantic: 36, effects: 15, openingWords: 2,
      officialReveals: qa.officialReveals.length, uniqueFrames: stillFrames.length},
    allFramesReviewed: false, fullRenderPendingParentStillReview: true, formalEnabled: false};
}

function listFiles(name) {
  const file = checked(ROOT, name);
  if (fs.statSync(file).isFile()) return [name];
  return fs.readdirSync(file).sort().flatMap(n => listFiles(`${name}/${n}`));
}

export function captureRequest(version, contextVersion) {
  ensure(/^v[1-9][0-9]*$/u.test(version) && /^v[1-9][0-9]*$/u.test(contextVersion), 'RECEIPT_VERSION_REQUIRED');
  const names = {request: `${CONTROL}/request.${version}.json`, runtime: `${CONTROL}/runtime-snapshot.${version}.json`,
    intent: `${CONTROL}/review-request-intent.${version}.json`, coverage: `${CONTROL}/still-coverage.${version}.json`};
  for (const name of Object.values(names)) absent(ROOT, name);
  const permission = readJson(checked(ROOT, PERMISSION));
  validatePermission(permission, {episodeId: EPISODE, revisionId: REVISION}, 'preflight');
  const contextBindingPath = `${CONTROL}/context/context-binding.${contextVersion}.json`;
  const knowledgeContext = readJson(checked(ROOT, contextBindingPath));
  const publicManifestPath = `${CONTROL}/public-assets.v1.json`;
  const manifest = readJson(checked(ROOT, publicManifestPath));
  ensure(manifest.publicDir === PUBLIC && Array.isArray(manifest.bindings), 'PUBLIC_MANIFEST_NOT_READY');
  const coverage = {...selectStillFrames(readJson(checked(ROOT, PLAN))), plan: {path: PLAN, sha256: hashFile(checked(ROOT, PLAN))}};
  const publicFiles = listFiles(PUBLIC);
  for (const b of manifest.bindings) ensure(publicFiles.includes(b.publicPath)
    && b.sha256 === hashFile(checked(ROOT, b.publicPath)), 'PUBLIC_MANIFEST_DRIFT');
  ensure(digest(publicFiles) === digest(manifest.bindings.map(b => b.publicPath).sort()), 'PUBLIC_MANIFEST_INCOMPLETE');
  const base = `edit/${EPISODE}`;
  const inputs = new Set([
    ...listFiles(SRC), ...publicFiles, ...permission.preservedInputs.map(b => b.path),
    'remotion/src/components/AdaptiveBilingualCaptionOverlay.tsx', 'remotion/src/components/LocalFont.tsx',
    'remotion/src/components/V8SemanticStage.tsx', 'remotion/src/styles.ts', SHOTCRAFT_SOURCE,
    `${base}/09_实录与字幕/transcription-review.v1.json`, `${base}/00_工程控制/paper-asset-intake.v1.json`,
    `${CONTROL}/prepare-request.v1.mjs`, `${CONTROL}/prepare-public.v1.mjs`,
    `${CONTROL}/audio-audit.public-assets.v1.json`, `${CONTROL}/sfx-plan.v1.json`, publicManifestPath, contextBindingPath,
    `${CONTROL}/prepare-visual.v1.mjs`,
    `${base}/04_导演拆解/candidate-preview-r2/output-selection.derived.v2.json`,
    `${base}/04_导演拆解/candidate-preview-r2/evidence-layout-plan.v1.json`,
    ...manifest.bindings.map(b => b.source).filter(n => typeof n === 'string' && (!n.startsWith('remotion/public/') || n.startsWith(`${PUBLIC}/`))),
  ]);
  for (const n of ['audio-audit.recommendations.json', 'audio-audit.measurements.json']) {
    const name = `${CONTROL}/${n}`;
    if (fs.existsSync(checked(ROOT, name, true))) inputs.add(name);
  }
  const bindings = [...inputs].sort().map(n => ({path: n, sha256: hashFile(checked(ROOT, n))}));
  const byPath = new Map(bindings.map(b => [b.path, b.sha256]));
  validatePreservedInputs(permission, byPath, publicFiles);
  collectLocalImports(ROOT, ENTRY, byPath, loadTypescript());
  const coverageText = encode(coverage);
  bindings.push({path: names.coverage, sha256: digest(coverageText)});
  const runtime = collectRuntime();
  const request = {schemaVersion: 'koubo-lanzhou-candidate-preview/v1', episodeId: EPISODE, revisionId: REVISION,
    permission: {path: PERMISSION, sha256: hashFile(checked(ROOT, PERMISSION))}, entry: ENTRY, compositionId: COMPOSITION,
    publicDir: PUBLIC, render: RENDER, stillFrames: coverage.stillFrames, knowledgeContext, runtimeSha256: runtime.sha256,
    bindings, independentReview: {path: `${CONTROL}/independent-review.${version}.json`, sha256: null}};
  const intent = {requestPath: names.request, requestIntentSha256: requestIntentSha256(request), runtimeSha256: runtime.sha256,
    coveragePath: names.coverage, reviewNotYetPerformed: true, fullRenderPendingParentStillReview: true, formalEnabled: false};
  // Only explicit CLI invocation captures files; importing the planner performs no I/O.
  for (const [name, text] of [[names.coverage, coverageText], [names.runtime, encode(runtime)], [names.request, encode(request)], [names.intent, encode(intent)]]) {
    fs.writeFileSync(checked(ROOT, name, true), text, {flag: 'wx', mode: 0o600});
  }
  return {requestPath: names.request, coveragePath: names.coverage, stillCount: coverage.stillFrames.length, runtimeSha256: runtime.sha256,
    readyToRender: false, formalEnabled: false};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensure(process.argv.length === 5 && process.argv[4] === '--capture', 'USE_VERSION_CONTEXTVERSION_CAPTURE_AFTER_INPUT_FREEZE');
  process.stdout.write(encode(captureRequest(process.argv[2], process.argv[3])));
}
