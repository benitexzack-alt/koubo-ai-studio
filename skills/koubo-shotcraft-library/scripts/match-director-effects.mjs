#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {validateDirectorSelection} from './validate-director-selection.mjs';
import {validateExperienceLedger} from './experience-ledger-core.mjs';
import {
  AUTO_MATCH_RECEIPT_SCHEMA,
  EXPERIENCE_LOOKUP_RECEIPT_SCHEMA,
  matchDirectorEffects,
  sha256Bytes,
  validateAutoMatchRequest,
  validateCapabilityIndex,
} from './shotcraft-matcher-core.mjs';

const CANONICAL_PATHS = Object.freeze({
  registry: 'skills/koubo-shotcraft-library/registry.v1.json',
  library: 'skills/koubo-shotcraft-library/upstream/gallery/api/library.json',
  capabilityIndex: 'skills/koubo-shotcraft-library/card-capability-index.v2.json',
  experienceLedger: 'skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json',
  componentModule: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',
});

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const requestArg = option('--request');
const repoRoot = fs.realpathSync(path.resolve(option('--repo-root') ?? '.'));
const selectionArg = option('--selection');
const receiptArg = option('--receipt');
const lookupArg = option('--lookup');
if (!requestArg || !selectionArg || !receiptArg || !lookupArg) {
  throw new Error('用法：node match-director-effects.mjs --request <request.json> --selection <selection.json> --receipt <receipt.json> --lookup <lookup.json> [--repo-root <项目根>]');
}

const relativePath = (absolute) => path.relative(repoRoot, absolute).split(path.sep).join('/');
const insideRoot = (absolute) => {
  const relation = path.relative(repoRoot, absolute);
  return relation !== '' && relation !== '..' && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
};
const resolveInput = (declared) => {
  const absolute = path.isAbsolute(declared) ? declared : path.resolve(repoRoot, declared);
  if (!insideRoot(absolute) || !fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile() || fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`SHOTCRAFT_INPUT_PATH_INVALID:${declared}`);
  return fs.realpathSync(absolute);
};
const resolveOutput = (declared) => {
  const absolute = path.isAbsolute(declared) ? path.resolve(declared) : path.resolve(repoRoot, declared);
  if (!insideRoot(absolute) || !fs.existsSync(path.dirname(absolute))) throw new Error(`SHOTCRAFT_OUTPUT_PATH_INVALID:${declared}`);
  const parent = fs.realpathSync(path.dirname(absolute));
  if (!insideRoot(path.join(parent, path.basename(absolute)))) throw new Error(`SHOTCRAFT_OUTPUT_PATH_INVALID:${declared}`);
  if (fs.existsSync(absolute)) throw new Error(`SHOTCRAFT_OUTPUT_ALREADY_EXISTS:${declared}`);
  return absolute;
};
const readBinding = (binding, label, expectedPath = null, parseJson = true) => {
  if (!binding?.path || path.isAbsolute(binding.path) || !/^[a-f0-9]{64}$/u.test(String(binding.sha256 ?? '')) || (expectedPath && binding.path !== expectedPath)) throw new Error(`SHOTCRAFT_${label}_BINDING_INVALID`);
  const absolute = resolveInput(binding.path);
  const bytes = fs.readFileSync(absolute);
  if (sha256Bytes(bytes) !== binding.sha256) throw new Error(`SHOTCRAFT_${label}_HASH_MISMATCH`);
  return {absolute, bytes, body: parseJson ? JSON.parse(bytes) : null};
};
const writeNew = (absolute, body) => {
  const bytes = Buffer.from(`${JSON.stringify(body, null, 2)}\n`, 'utf8');
  const temporary = `${absolute}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes, {flag: 'wx'});
  fs.renameSync(temporary, absolute);
  return {path: relativePath(absolute), sha256: sha256Bytes(bytes)};
};

const requestPath = resolveInput(requestArg);
const requestBytes = fs.readFileSync(requestPath);
const request = JSON.parse(requestBytes);
const requestErrors = validateAutoMatchRequest(request);
if (requestErrors.length) throw new Error(requestErrors.join('\n'));

const inputs = Object.fromEntries(Object.entries(CANONICAL_PATHS).map(([key, expected]) => [
  key,
  readBinding(request[key], key.toUpperCase(), expected, key !== 'componentModule'),
]));
inputs.captions = readBinding(request.captions, 'CAPTIONS');
const indexErrors = validateCapabilityIndex(inputs.capabilityIndex.body, inputs.library.body, inputs.registry.body);
const ledgerErrors = validateExperienceLedger(inputs.experienceLedger.body);
if (indexErrors.length || ledgerErrors.length) throw new Error([...indexErrors, ...ledgerErrors].join('\n'));

const result = matchDirectorEffects({
  request,
  captions: inputs.captions.body,
  index: inputs.capabilityIndex.body,
  registry: inputs.registry.body,
  ledger: inputs.experienceLedger.body,
});
const selectionErrors = validateDirectorSelection(result.selection, inputs.captions.body, inputs.registry.body);
if (selectionErrors.length) throw new Error(selectionErrors.join('\n'));

const selectionPath = resolveOutput(selectionArg);
const lookupPath = resolveOutput(lookupArg);
const receiptPath = resolveOutput(receiptArg);
const selectionBinding = writeNew(selectionPath, result.selection);
const generatedAt = new Date().toISOString();
const requestBinding = {path: relativePath(requestPath), sha256: sha256Bytes(requestBytes)};
const lookup = {
  schemaVersion: EXPERIENCE_LOOKUP_RECEIPT_SCHEMA,
  taskId: request.taskId,
  revisionId: request.revisionId,
  generatedAt,
  request: requestBinding,
  experienceLedger: request.experienceLedger,
  caseCount: inputs.experienceLedger.body.cases.length,
  reusablePatternCount: inputs.experienceLedger.body.patterns.length,
  beats: result.matches.map((match) => ({
    beatId: match.beatId,
    selectedOrigin: match.origin ?? null,
    selectedExactCaseId: match.rankedCandidates?.find((candidate) => candidate.adapterId === match.effectId)?.experience?.exactCaseId ?? null,
    selectedReusablePatternId: match.rankedCandidates?.find((candidate) => candidate.adapterId === match.effectId)?.experience?.reusablePatternId ?? null,
    staleCaseIds: match.staleExperienceCaseIds ?? [],
  })),
  policy: inputs.experienceLedger.body.policy,
  formalApprovalGranted: false,
};
const lookupBinding = writeNew(lookupPath, lookup);
const receipt = {
  schemaVersion: AUTO_MATCH_RECEIPT_SCHEMA,
  status: 'candidate-match-ready',
  taskId: request.taskId,
  revisionId: request.revisionId,
  generatedAt,
  request: requestBinding,
  inputs: Object.fromEntries(Object.keys(CANONICAL_PATHS).map((key) => [key, request[key]])),
  captions: request.captions,
  selection: selectionBinding,
  experienceLookup: lookupBinding,
  summary: result.summary,
  matches: result.matches,
  gates: {
    onlyRegisteredAdaptersMayApply: true,
    adaptationCandidatesAreNotRenderable: true,
    candidatePreviewStillRequired: true,
    formalApprovalGranted: false,
    publicationApproved: false,
  },
};
const receiptBinding = writeNew(receiptPath, receipt);
console.log(JSON.stringify({
  status: receipt.status,
  selection: selectionBinding,
  receipt: receiptBinding,
  experienceLookup: lookupBinding,
  ...result.summary,
}, null, 2));
