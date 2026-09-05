#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {contextFingerprint, normalizeContextSignature} from './experience-ledger-core.mjs';

export const DIRECTOR_SELECTION_SCHEMA = 'koubo-shotcraft-director-selection/v1';
export const CANONICAL_REGISTRY_PATH = 'skills/koubo-shotcraft-library/registry.v1.json';
export const CANONICAL_COMPONENT_MODULE_PATH = 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx';
export const V9_DIRECTOR_PROFILE = Object.freeze({profileId: 'paper-editorial-director-v9', profileVersion: '9.1.0'});
export const SUPPORTED_V9_DIRECTOR_VERSIONS = Object.freeze(['9.0.0', '9.1.0']);
export const ELIGIBLE_MAIN_VISUALS = Object.freeze(['speaker', 'real-evidence']);
export const FORBIDDEN_MAIN_VISUALS = Object.freeze(['paper-editorial', 'generated-video']);

const SHA256_RE = /^[a-f0-9]{64}$/u;
const forbiddenMainVisuals = new Set(FORBIDDEN_MAIN_VISUALS);
const GENERIC_REASONS = new Set([
  '无',
  '暂无',
  '不需要',
  '无需',
  '不适用',
  '未选择',
  'none',
  'na',
  'notneeded',
]);
const GENERIC_REASON_PATTERNS = [
  /^(本段|此段|该段|这里|当前)?(shotcraft|动效|效果)?(不需要|无需|不适用|未选择|不使用)(shotcraft|动效|效果)?$/u,
  /^(本段|此段|该段|这里|当前)?没有必要(使用)?(shotcraft|动效|效果)?$/u,
];
const QUOTA_KEYS = [
  'quota',
  'effectQuota',
  'minApplications',
  'minimumApplications',
  'requiredApplications',
  'minimumEffects',
  'minimumEffectCount',
  'requiredEffectCount',
  'effectCountTarget',
];

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
const normalizeText = (value) => String(value ?? '').replace(/[\p{P}\p{Z}\s]/gu, '').toLowerCase();
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const issue = (code, beatId = '') => `${code}${beatId ? `:${beatId}` : ''}`;
const validBinding = (binding) => isRecord(binding) && isText(binding.path) && !path.isAbsolute(binding.path) && SHA256_RE.test(String(binding.sha256 ?? ''));
const validRect = (rect) => isRecord(rect) && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key])) && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0;
const inside = (inner, outer) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
const intersects = (left, right) => left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
const sameFrames = (left, right) => left?.startFrame === right?.startFrame && left?.endFrameExclusive === right?.endFrameExclusive;

const captionArray = (captions) => Array.isArray(captions) ? captions : captions?.captions;

const concreteReason = (value) => {
  const normalized = normalizeText(value);
  const withoutLead = normalized.replace(/^(本段|此段|该段|这里|当前)/u, '');
  const semantic = withoutLead.replace(/shotcraft|动效|效果|使用/gu, '');
  return isText(value) && [...normalized].length >= 6 && !GENERIC_REASONS.has(normalized) && !GENERIC_REASONS.has(semantic) && semantic !== '没有必要' && !GENERIC_REASON_PATTERNS.some((pattern) => pattern.test(normalized));
};

const hasQuotaKey = (value) => {
  if (Array.isArray(value)) return value.some(hasQuotaKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => QUOTA_KEYS.includes(key) || hasQuotaKey(nested));
};

const validFrames = (frames, durationInFrames) => isRecord(frames) &&
  Number.isInteger(frames.startFrame) && frames.startFrame >= 0 &&
  Number.isInteger(frames.endFrameExclusive) && frames.endFrameExclusive > frames.startFrame &&
  frames.endFrameExclusive <= durationInFrames;

const APPLICATION_FIELDS = Object.freeze([
  'effectId',
  'purpose',
  'quote',
  'texts',
  'region',
  'protectedRegions',
  'fallback',
  'evidence',
  'sourceCard',
  'matchContext',
  'componentProps',
]);

const registryEffects = (registry, errors) => {
  if (!isRecord(registry) || registry.schemaVersion !== 'shotcraft-adapters/v1' || registry.defaultEnabled !== false || !Array.isArray(registry.effects)) {
    errors.push('SHOTCRAFT_REGISTRY_INVALID');
    return [];
  }
  const seenIds = new Set();
  const seenComponents = new Set();
  for (const effect of registry.effects) {
    if (!isRecord(effect) || !isText(effect.id) || !isText(effect.component) || !Array.isArray(effect.contexts) || effect.contexts.some((context) => !isText(context)) || seenIds.has(effect.id) || seenComponents.has(effect.component)) {
      errors.push('SHOTCRAFT_REGISTRY_INVALID');
      return [];
    }
    seenIds.add(effect.id);
    seenComponents.add(effect.component);
  }
  return registry.effects;
};

export function validateDirectorSelection(selection, captions, registry) {
  const errors = [];
  if (!isRecord(selection) || selection.schemaVersion !== DIRECTOR_SELECTION_SCHEMA) {
    return ['SHOTCRAFT_SELECTION_SCHEMA_INVALID'];
  }
  if (!isText(selection.taskId)) errors.push('SHOTCRAFT_TASK_ID_REQUIRED');
  if (!isText(selection.revisionId)) errors.push('SHOTCRAFT_REVISION_ID_REQUIRED');
  if (selection.directorProfile?.profileId !== V9_DIRECTOR_PROFILE.profileId || !SUPPORTED_V9_DIRECTOR_VERSIONS.includes(selection.directorProfile?.profileVersion)) {
    errors.push('SHOTCRAFT_V9_DIRECTOR_PROFILE_REQUIRED');
  }
  if (selection.subtitleAuthority !== 'actual-recording') errors.push('SHOTCRAFT_SPOKEN_SOURCE_REQUIRED');
  if (!validBinding(selection.registry) || selection.registry.path !== CANONICAL_REGISTRY_PATH) errors.push('SHOTCRAFT_REGISTRY_BINDING_INVALID');
  if (!validBinding(selection.captions)) errors.push('SHOTCRAFT_CAPTIONS_BINDING_INVALID');
  if (hasQuotaKey(selection)) errors.push('SHOTCRAFT_MECHANICAL_QUOTA_FORBIDDEN');

  const canvas = selection.canvas;
  const canvasValid = isRecord(canvas) && isPositiveInteger(canvas.width) && isPositiveInteger(canvas.height) && isPositiveInteger(canvas.fps) && isPositiveInteger(canvas.durationInFrames);
  if (!canvasValid) errors.push('SHOTCRAFT_CANVAS_INVALID');

  const effects = registryEffects(registry, errors);
  const eligibleMainVisuals = new Set(ELIGIBLE_MAIN_VISUALS);
  const captionsList = captionArray(captions);
  const captionsValid = Array.isArray(captionsList) && captionsList.every((caption) => isRecord(caption) && Number.isFinite(caption.startMs) && Number.isFinite(caption.endMs) && caption.startMs >= 0 && caption.endMs > caption.startMs && typeof caption.zh === 'string');
  if (!captionsValid) errors.push('SHOTCRAFT_CAPTIONS_INVALID');

  if (!Array.isArray(selection.beats)) return [...new Set([...errors, 'SHOTCRAFT_BEATS_REQUIRED'])];

  const seenBeatIds = new Set();
  const appliedBeats = [];
  for (const beat of selection.beats) {
    const beatId = isText(beat?.beatId) ? beat.beatId.trim() : '';
    if (!beatId || beat.beatId !== beatId || seenBeatIds.has(beatId)) {
      errors.push(issue('SHOTCRAFT_BEAT_ID_INVALID', beatId));
      continue;
    }
    seenBeatIds.add(beatId);
    if (!isText(beat.mainVisual)) {
      errors.push(issue('SHOTCRAFT_MAIN_VISUAL_REQUIRED', beatId));
      continue;
    }
    if (!canvasValid || !validFrames(beat.frames, canvas.durationInFrames)) errors.push(issue('SHOTCRAFT_FRAMES_INVALID', beatId));

    const eligible = eligibleMainVisuals.has(beat.mainVisual);
    const forbidden = forbiddenMainVisuals.has(beat.mainVisual);
    if (eligible && !['apply', 'not-needed'].includes(beat.decision)) {
      errors.push(issue('SHOTCRAFT_DECISION_REQUIRED', beatId));
      continue;
    }
    if (beat.decision != null && !['apply', 'not-needed'].includes(beat.decision)) {
      errors.push(issue('SHOTCRAFT_DECISION_INVALID', beatId));
      continue;
    }
    if (beat.decision === 'not-needed') {
      if (!concreteReason(beat.reason)) errors.push(issue('SHOTCRAFT_NOT_NEEDED_REASON_REQUIRED', beatId));
      if (APPLICATION_FIELDS.some((key) => Object.hasOwn(beat, key))) {
        errors.push(issue('SHOTCRAFT_NOT_NEEDED_HAS_APPLICATION_FIELDS', beatId));
      }
      continue;
    }
    if (beat.decision !== 'apply') {
      if (APPLICATION_FIELDS.some((key) => Object.hasOwn(beat, key))) errors.push(issue('SHOTCRAFT_APPLICATION_FIELDS_WITHOUT_APPLY', beatId));
      continue;
    }

    if (forbidden) errors.push(issue('SHOTCRAFT_CONTEXT_FORBIDDEN', beatId));
    else if (!eligible) errors.push(issue('SHOTCRAFT_CONTEXT_NOT_ELIGIBLE', beatId));

    const adapter = effects.find((effect) => effect.id === beat.effectId);
    if (!adapter) errors.push(issue('SHOTCRAFT_EFFECT_NOT_REGISTERED', beatId));
    else if (!adapter.contexts.includes(beat.mainVisual)) errors.push(issue('SHOTCRAFT_EFFECT_CONTEXT_MISMATCH', beatId));
    if (beat.fallback !== 'blocked') errors.push(issue('SHOTCRAFT_FALLBACK_MUST_BLOCK', beatId));
    if (!isText(beat.purpose)) errors.push(issue('SHOTCRAFT_PURPOSE_REQUIRED', beatId));
    if (!isText(beat.quote)) errors.push(issue('SHOTCRAFT_QUOTE_REQUIRED', beatId));
    if (!Array.isArray(beat.texts) || beat.texts.length === 0 || beat.texts.some((text) => !isText(text))) errors.push(issue('SHOTCRAFT_TEXTS_REQUIRED', beatId));

    const frameValid = canvasValid && validFrames(beat.frames, canvas.durationInFrames);
    if (captionsValid && frameValid) {
      const startMs = beat.frames.startFrame / canvas.fps * 1000;
      const endMs = beat.frames.endFrameExclusive / canvas.fps * 1000;
      const spoken = normalizeText(captionsList.filter((caption) => caption.startMs < endMs && caption.endMs > startMs).map((caption) => caption.zh).join(''));
      if (!normalizeText(beat.quote) || !spoken.includes(normalizeText(beat.quote))) errors.push(issue('SHOTCRAFT_QUOTE_NOT_IN_BEAT', beatId));
      if (!Array.isArray(beat.texts) || beat.texts.some((text) => !normalizeText(text) || !spoken.includes(normalizeText(text)))) errors.push(issue('SHOTCRAFT_TEXT_NOT_IN_BEAT', beatId));
    }

    const frame = canvasValid ? {x: 0, y: 0, width: canvas.width, height: canvas.height} : null;
    if (!frame || !validRect(beat.region) || !inside(beat.region, frame)) errors.push(issue('SHOTCRAFT_REGION_INVALID', beatId));
    const protectedValid = frame && Array.isArray(beat.protectedRegions) && beat.protectedRegions.length > 0 && beat.protectedRegions.every((region) => validRect(region) && inside(region, frame));
    if (!protectedValid) errors.push(issue('SHOTCRAFT_PROTECTED_REGIONS_REQUIRED', beatId));
    else if (validRect(beat.region) && beat.protectedRegions.some((region) => intersects(beat.region, region))) errors.push(issue('SHOTCRAFT_PROTECTED_REGION_OVERLAP', beatId));

    if (beat.effectId === 'evidence-scan') {
      const evidence = beat.evidence;
      if (!isRecord(evidence) || !validBinding(evidence.asset) || !validRect(evidence.rect) || !validRect(beat.region) || !inside(evidence.rect, {x: 0, y: 0, width: beat.region.width, height: beat.region.height}) || !isText(evidence.claimBoundary)) {
        errors.push(issue('SHOTCRAFT_EVIDENCE_BINDING_REQUIRED', beatId));
      }
    }
    if (selection.directorProfile.profileVersion === '9.1.0') {
      const context = normalizeContextSignature(beat.matchContext);
      if (
        !isRecord(beat.sourceCard) || beat.sourceCard.cardName !== adapter?.upstream ||
        !isRecord(beat.matchContext) || beat.matchContext.fingerprint !== contextFingerprint(context) ||
        !['catalog-match', 'validated-case', 'reusable-pattern'].includes(beat.matchContext.origin) ||
        !isRecord(beat.componentProps)
      ) errors.push(issue('SHOTCRAFT_AUTO_MATCH_METADATA_REQUIRED', beatId));
      const props = beat.componentProps;
      if (beat.effectId === 'marker-underline' && (props.keyword !== beat.texts?.[0] || `${props.before ?? ''}${props.keyword ?? ''}${props.after ?? ''}` !== beat.quote)) {
        errors.push(issue('SHOTCRAFT_COMPONENT_PROPS_INVALID', beatId));
      }
      if (beat.effectId === 'keyword-reveal' && (!Array.isArray(props.items) || props.items.map((item) => item?.text).join('\n') !== beat.texts?.join('\n') || props.items.some((item) => !Number.isInteger(item.atFrame) || item.atFrame < 0 || item.atFrame >= beat.frames.endFrameExclusive - beat.frames.startFrame))) {
        errors.push(issue('SHOTCRAFT_COMPONENT_PROPS_INVALID', beatId));
      }
      if (beat.effectId === 'evidence-scan' && (props.width !== beat.region?.width || props.height !== beat.region?.height || props.label !== beat.texts?.[0] || JSON.stringify(props.rect) !== JSON.stringify(beat.evidence?.rect))) {
        errors.push(issue('SHOTCRAFT_COMPONENT_PROPS_INVALID', beatId));
      }
      if (beat.effectId === 'line-carry' && (props.fromLabel !== beat.texts?.[0] || props.toLabel !== beat.texts?.[1] || props.width !== beat.region?.width)) {
        errors.push(issue('SHOTCRAFT_COMPONENT_PROPS_INVALID', beatId));
      }
      if (beat.effectId === 'paper-tape-pin' && (!Number.isFinite(props.width) || props.width < 240 || props.width > beat.region?.width)) {
        errors.push(issue('SHOTCRAFT_COMPONENT_PROPS_INVALID', beatId));
      }
    }
    if (frameValid && validRect(beat.region)) appliedBeats.push(beat);
  }

  if (canvasValid) {
    const points = new Set(appliedBeats.flatMap((beat) => [beat.frames.startFrame, beat.frames.endFrameExclusive - 1]));
    for (const frame of points) {
      const area = appliedBeats.filter((beat) => beat.frames.startFrame <= frame && beat.frames.endFrameExclusive > frame).reduce((sum, beat) => sum + beat.region.width * beat.region.height, 0);
      if (area / (canvas.width * canvas.height) > 0.42) {
        errors.push('SHOTCRAFT_COVERAGE_EXCEEDED');
        break;
      }
    }
  }

  return [...new Set(errors)];
}

const insideRoot = (root, target) => {
  const relation = path.relative(root, target);
  return relation !== '' && relation !== '..' && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
};

const readBinding = (binding, repoRoot, label, expectedPath = null) => {
  const errors = [];
  if (!validBinding(binding) || (expectedPath && binding.path !== expectedPath)) return {errors: [`SHOTCRAFT_${label}_BINDING_INVALID`], bytes: null};
  try {
    const root = fs.realpathSync(repoRoot);
    const declared = path.resolve(root, binding.path);
    if (!insideRoot(root, declared) || !fs.existsSync(declared) || fs.lstatSync(declared).isSymbolicLink() || !fs.lstatSync(declared).isFile()) {
      return {errors: [`SHOTCRAFT_${label}_PATH_INVALID`], bytes: null};
    }
    const real = fs.realpathSync(declared);
    if (!insideRoot(root, real)) return {errors: [`SHOTCRAFT_${label}_PATH_INVALID`], bytes: null};
    const bytes = fs.readFileSync(real);
    if (sha256(bytes) !== binding.sha256) errors.push(`SHOTCRAFT_${label}_HASH_MISMATCH`);
    return {errors, bytes};
  } catch {
    return {errors: [`SHOTCRAFT_${label}_READ_FAILED`], bytes: null};
  }
};

export function validateDirectorSelectionFiles(selection, repoRoot = '.') {
  const registryResult = readBinding(selection?.registry, repoRoot, 'REGISTRY', CANONICAL_REGISTRY_PATH);
  const captionsResult = readBinding(selection?.captions, repoRoot, 'CAPTIONS');
  const errors = [...registryResult.errors, ...captionsResult.errors];
  let registry;
  let captions;
  try { if (registryResult.bytes) registry = JSON.parse(registryResult.bytes); }
  catch { errors.push('SHOTCRAFT_REGISTRY_JSON_INVALID'); }
  try { if (captionsResult.bytes) captions = JSON.parse(captionsResult.bytes); }
  catch { errors.push('SHOTCRAFT_CAPTIONS_JSON_INVALID'); }
  if (registry && captions) errors.push(...validateDirectorSelection(selection, captions, registry));
  for (const beat of Array.isArray(selection?.beats) ? selection.beats : []) {
    if (beat?.decision === 'apply' && beat.effectId === 'evidence-scan') {
      errors.push(...readBinding(beat.evidence?.asset, repoRoot, 'EVIDENCE').errors.map((error) => `${error}:${beat.beatId ?? ''}`));
    }
  }
  return [...new Set(errors)];
}

export function framesEqual(left, right) {
  return sameFrames(left, right);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('用法：node validate-director-selection.mjs <selection.json> [project-root]');
    const repoRoot = path.resolve(process.argv[3] ?? '.');
    const selectionPath = path.isAbsolute(process.argv[2]) ? process.argv[2] : path.resolve(repoRoot, process.argv[2]);
    const bytes = fs.readFileSync(selectionPath);
    const selection = JSON.parse(bytes);
    const errors = validateDirectorSelectionFiles(selection, repoRoot);
    const beats = Array.isArray(selection.beats) ? selection.beats : [];
    console.log(JSON.stringify({
      status: errors.length ? 'blocked' : 'director-selection-valid',
      selectionSha256: sha256(bytes),
      applyCount: beats.filter((beat) => beat.decision === 'apply').length,
      notNeededCount: beats.filter((beat) => beat.decision === 'not-needed').length,
      errors,
    }, null, 2));
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({status: 'blocked', errors: [String(error?.message ?? error)]}, null, 2));
    process.exitCode = 1;
  }
}
