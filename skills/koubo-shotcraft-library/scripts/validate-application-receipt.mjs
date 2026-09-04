#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CANONICAL_COMPONENT_MODULE_PATH,
  CANONICAL_REGISTRY_PATH,
  DIRECTOR_SELECTION_SCHEMA,
  framesEqual,
  validateDirectorSelectionFiles,
} from './validate-director-selection.mjs';

export const APPLICATION_RECEIPT_SCHEMA = 'koubo-shotcraft-application-receipt/v1';

const SHA256_RE = /^[a-f0-9]{64}$/u;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const issue = (code, beatId = '') => `${code}${beatId ? `:${beatId}` : ''}`;
const validBinding = (binding) => isRecord(binding) && isText(binding.path) && !path.isAbsolute(binding.path) && SHA256_RE.test(String(binding.sha256 ?? ''));

const validFrames = (frames) => isRecord(frames) &&
  Number.isInteger(frames.startFrame) && frames.startFrame >= 0 &&
  Number.isInteger(frames.endFrameExclusive) && frames.endFrameExclusive > frames.startFrame;

const insideRoot = (root, target) => {
  const relation = path.relative(root, target);
  return relation !== '' && relation !== '..' && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
};

const sha256File = async (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(hash.digest('hex')));
});

const resolveBoundFile = (binding, repoRoot, label, expectedPath = null) => {
  if (!validBinding(binding) || (expectedPath && binding.path !== expectedPath)) {
    return {error: `SHOTCRAFT_${label}_BINDING_INVALID`, path: null};
  }
  try {
    const root = fs.realpathSync(repoRoot);
    const declared = path.resolve(root, binding.path);
    if (!insideRoot(root, declared) || !fs.existsSync(declared)) {
      return {error: `SHOTCRAFT_${label}_PATH_INVALID`, path: null};
    }
    const stat = fs.lstatSync(declared);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return {error: `SHOTCRAFT_${label}_PATH_INVALID`, path: null};
    }
    const real = fs.realpathSync(declared);
    if (!insideRoot(root, real)) return {error: `SHOTCRAFT_${label}_PATH_INVALID`, path: null};
    return {error: null, path: real};
  } catch {
    return {error: `SHOTCRAFT_${label}_READ_FAILED`, path: null};
  }
};

const selectedBeats = (selection) => Array.isArray(selection?.beats)
  ? selection.beats.filter((beat) => beat?.decision === 'apply')
  : [];

export function validateApplicationReceipt(receipt, selection, registry) {
  const errors = [];
  if (!isRecord(receipt) || receipt.schemaVersion !== APPLICATION_RECEIPT_SCHEMA) {
    return ['SHOTCRAFT_APPLICATION_RECEIPT_SCHEMA_INVALID'];
  }
  if (!isRecord(selection) || selection.schemaVersion !== DIRECTOR_SELECTION_SCHEMA) {
    errors.push('SHOTCRAFT_SELECTION_SCHEMA_INVALID');
  }
  if (receipt.taskId !== selection?.taskId || !isText(receipt.taskId)) errors.push('SHOTCRAFT_RECEIPT_TASK_MISMATCH');
  if (receipt.revisionId !== selection?.revisionId || !isText(receipt.revisionId)) errors.push('SHOTCRAFT_RECEIPT_REVISION_MISMATCH');
  if (!validBinding(receipt.selection)) errors.push('SHOTCRAFT_SELECTION_BINDING_INVALID');
  if (!validBinding(receipt.output)) errors.push('SHOTCRAFT_OUTPUT_BINDING_INVALID');

  const effects = Array.isArray(registry?.effects) ? registry.effects : [];
  const applications = Array.isArray(receipt.applications) ? receipt.applications : [];
  if (!Array.isArray(receipt.applications)) errors.push('SHOTCRAFT_APPLICATIONS_REQUIRED');

  const applicationIds = new Set();
  for (const application of applications) {
    const beatId = isText(application?.beatId) ? application.beatId.trim() : '';
    if (!beatId || application.beatId !== beatId) {
      errors.push('SHOTCRAFT_APPLICATION_BEAT_ID_INVALID');
      continue;
    }
    if (applicationIds.has(beatId)) errors.push(issue('SHOTCRAFT_APPLICATION_DUPLICATE', beatId));
    applicationIds.add(beatId);
    if (!isText(application.effectId)) errors.push(issue('SHOTCRAFT_APPLICATION_EFFECT_ID_REQUIRED', beatId));
    if (!validFrames(application.frames)) errors.push(issue('SHOTCRAFT_APPLICATION_FRAMES_INVALID', beatId));
    if (!isRecord(application.component) || !isText(application.component.name) || !validBinding(application.component)) {
      errors.push(issue('SHOTCRAFT_APPLICATION_COMPONENT_INVALID', beatId));
    }
    if (application.outputSha256 !== receipt.output?.sha256) errors.push(issue('SHOTCRAFT_APPLICATION_OUTPUT_MISMATCH', beatId));
    if (application.finalWorking !== true) errors.push(issue('SHOTCRAFT_APPLICATION_NOT_WORKING', beatId));
  }

  const expected = selectedBeats(selection);
  for (const beat of expected) {
    const adapter = effects.find((effect) => effect.id === beat.effectId);
    const match = applications.find((application) =>
      application?.beatId === beat.beatId &&
      application.effectId === beat.effectId &&
      framesEqual(application.frames, beat.frames) &&
      application.component?.name === adapter?.component &&
      application.component?.path === CANONICAL_COMPONENT_MODULE_PATH &&
      SHA256_RE.test(String(application.component?.sha256 ?? '')) &&
      SHA256_RE.test(String(receipt.output?.sha256 ?? '')) &&
      application.outputSha256 === receipt.output?.sha256 &&
      application.finalWorking === true
    );
    if (!match) errors.push(issue('SHOTCRAFT_SELECTED_NOT_APPLIED', beat.beatId));
  }

  const expectedIds = new Set(expected.map((beat) => beat.beatId));
  for (const application of applications) {
    if (isText(application?.beatId) && !expectedIds.has(application.beatId)) {
      errors.push(issue('SHOTCRAFT_UNSELECTED_APPLIED', application.beatId));
    }
  }

  return [...new Set(errors)];
}

export async function validateApplicationReceiptFiles(receipt, repoRoot = '.') {
  const errors = [];
  const root = path.resolve(repoRoot);
  const expected = [];
  const selectionFile = resolveBoundFile(receipt?.selection, root, 'SELECTION');
  if (selectionFile.error) errors.push(selectionFile.error);

  let selection;
  if (selectionFile.path) {
    try {
      const selectionBytes = fs.readFileSync(selectionFile.path);
      const actualHash = crypto.createHash('sha256').update(selectionBytes).digest('hex');
      if (actualHash !== receipt.selection.sha256) errors.push('SHOTCRAFT_SELECTION_HASH_MISMATCH');
      selection = JSON.parse(selectionBytes);
    } catch {
      errors.push('SHOTCRAFT_SELECTION_READ_FAILED');
    }
  }

  let registry;
  if (selection) {
    expected.push(...selectedBeats(selection));
    errors.push(...validateDirectorSelectionFiles(selection, root));
    const registryFile = resolveBoundFile(selection.registry, root, 'REGISTRY', CANONICAL_REGISTRY_PATH);
    if (registryFile.error) errors.push(registryFile.error);
    else {
      try { registry = JSON.parse(fs.readFileSync(registryFile.path)); }
      catch { errors.push('SHOTCRAFT_REGISTRY_JSON_INVALID'); }
    }
  }

  if (selection && registry) errors.push(...validateApplicationReceipt(receipt, selection, registry));

  const outputFile = resolveBoundFile(receipt?.output, root, 'OUTPUT');
  if (outputFile.error) {
    errors.push(outputFile.error);
    for (const beat of expected) errors.push(issue('SHOTCRAFT_SELECTED_NOT_APPLIED', beat.beatId));
  }
  else {
    try {
      if (await sha256File(outputFile.path) !== receipt.output.sha256) {
        errors.push('SHOTCRAFT_OUTPUT_HASH_MISMATCH');
        for (const beat of expected) errors.push(issue('SHOTCRAFT_SELECTED_NOT_APPLIED', beat.beatId));
      }
    } catch {
      errors.push('SHOTCRAFT_OUTPUT_READ_FAILED');
      for (const beat of expected) errors.push(issue('SHOTCRAFT_SELECTED_NOT_APPLIED', beat.beatId));
    }
  }

  const checkedComponents = new Map();
  for (const application of Array.isArray(receipt?.applications) ? receipt.applications : []) {
    const binding = application?.component;
    const cacheKey = `${binding?.path ?? ''}:${binding?.sha256 ?? ''}`;
    if (!checkedComponents.has(cacheKey)) {
      const componentFile = resolveBoundFile(binding, root, 'COMPONENT', CANONICAL_COMPONENT_MODULE_PATH);
      if (componentFile.error) checkedComponents.set(cacheKey, componentFile.error);
      else {
        try {
          const matches = await sha256File(componentFile.path) === binding.sha256;
          checkedComponents.set(cacheKey, matches ? null : 'SHOTCRAFT_COMPONENT_HASH_MISMATCH');
        } catch {
          checkedComponents.set(cacheKey, 'SHOTCRAFT_COMPONENT_READ_FAILED');
        }
      }
    }
    const componentError = checkedComponents.get(cacheKey);
    if (componentError) {
      errors.push(issue(componentError, application?.beatId ?? ''));
      if (expected.some((beat) => beat.beatId === application?.beatId)) {
        errors.push(issue('SHOTCRAFT_SELECTED_NOT_APPLIED', application.beatId));
      }
    }
  }

  return [...new Set(errors)];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('用法：node validate-application-receipt.mjs <receipt.json> [project-root]');
    const repoRoot = path.resolve(process.argv[3] ?? '.');
    const receiptPath = path.isAbsolute(process.argv[2]) ? process.argv[2] : path.resolve(repoRoot, process.argv[2]);
    const bytes = fs.readFileSync(receiptPath);
    const receipt = JSON.parse(bytes);
    const errors = await validateApplicationReceiptFiles(receipt, repoRoot);
    console.log(JSON.stringify({
      status: errors.length ? 'blocked' : 'application-receipt-valid',
      receiptSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      applicationCount: Array.isArray(receipt.applications) ? receipt.applications.length : 0,
      errors,
    }, null, 2));
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({status: 'blocked', errors: [String(error?.message ?? error)]}, null, 2));
    process.exitCode = 1;
  }
}
