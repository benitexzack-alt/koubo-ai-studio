#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  contextFingerprint,
  EXPERIENCE_DECISION_SCHEMA,
  EXPERIENCE_WRITE_RECEIPT_SCHEMA,
  normalizeContextSignature,
  rebuildExperiencePatterns,
  sha256Text,
  stableStringify,
  validateExperienceLedger,
} from './experience-ledger-core.mjs';
import {sha256Bytes} from './shotcraft-matcher-core.mjs';
import {validateApplicationReceiptFiles} from './validate-application-receipt.mjs';
import {validateDirectorSelectionFiles} from './validate-director-selection.mjs';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const decisionArg = option('--decision');
const ledgerArg = option('--ledger') ?? 'skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json';
const receiptArg = option('--receipt');
const repoRoot = fs.realpathSync(path.resolve(option('--repo-root') ?? '.'));
if (!decisionArg || !receiptArg) throw new Error('用法：node record-experience.mjs --decision <decision.json> --receipt <write-receipt.json> [--ledger <ledger.json>] [--repo-root <项目根>]');

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const relativePath = (absolute) => path.relative(repoRoot, absolute).split(path.sep).join('/');
const insideRoot = (absolute) => {
  const relation = path.relative(repoRoot, absolute);
  return relation !== '' && relation !== '..' && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
};
const resolveExisting = (declared) => {
  const absolute = path.isAbsolute(declared) ? declared : path.resolve(repoRoot, declared);
  if (!insideRoot(absolute) || !fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile() || fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`SHOTCRAFT_EXPERIENCE_PATH_INVALID:${declared}`);
  return fs.realpathSync(absolute);
};
const resolveNew = (declared) => {
  const absolute = path.isAbsolute(declared) ? path.resolve(declared) : path.resolve(repoRoot, declared);
  if (!insideRoot(absolute) || !fs.existsSync(path.dirname(absolute)) || fs.existsSync(absolute)) throw new Error(`SHOTCRAFT_EXPERIENCE_OUTPUT_INVALID:${declared}`);
  return absolute;
};
const readJsonBinding = (binding, label) => {
  if (!binding?.path || path.isAbsolute(binding.path) || !/^[a-f0-9]{64}$/u.test(String(binding.sha256 ?? ''))) throw new Error(`SHOTCRAFT_EXPERIENCE_${label}_BINDING_INVALID`);
  const absolute = resolveExisting(binding.path);
  const bytes = fs.readFileSync(absolute);
  if (sha256Bytes(bytes) !== binding.sha256) throw new Error(`SHOTCRAFT_EXPERIENCE_${label}_HASH_MISMATCH`);
  return {absolute, bytes, body: JSON.parse(bytes)};
};
const writeAtomic = (absolute, body, overwrite = false) => {
  const bytes = Buffer.from(`${JSON.stringify(body, null, 2)}\n`, 'utf8');
  const temporary = `${absolute}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes, {flag: 'wx'});
  if (overwrite) fs.renameSync(temporary, absolute);
  else fs.renameSync(temporary, absolute);
  return {path: relativePath(absolute), sha256: sha256Bytes(bytes)};
};

const decisionPath = resolveExisting(decisionArg);
const decisionBytes = fs.readFileSync(decisionPath);
const decision = JSON.parse(decisionBytes);
if (decision.schemaVersion !== EXPERIENCE_DECISION_SCHEMA) throw new Error('SHOTCRAFT_EXPERIENCE_DECISION_SCHEMA_INVALID');
if (!isText(decision.taskId) || !isText(decision.revisionId)) throw new Error('SHOTCRAFT_EXPERIENCE_DECISION_ID_REQUIRED');
if (!isText(decision.userEvidence?.quote) || decision.userEvidence.quoteSha256 !== sha256Text(decision.userEvidence.quote) || !isText(decision.userEvidence.recordedAt) || decision.userEvidence.source !== 'direct-user-message') throw new Error('SHOTCRAFT_EXPERIENCE_USER_EVIDENCE_INVALID');

const selectionInput = readJsonBinding(decision.selection, 'SELECTION');
const applicationInput = readJsonBinding(decision.applicationReceipt, 'APPLICATION_RECEIPT');
const candidatePath = resolveExisting(decision.candidate?.path ?? '');
const candidateBytes = fs.readFileSync(candidatePath);
if (sha256Bytes(candidateBytes) !== decision.candidate?.sha256) throw new Error('SHOTCRAFT_EXPERIENCE_CANDIDATE_HASH_MISMATCH');
const selection = selectionInput.body;
const applicationReceipt = applicationInput.body;
if (selection.taskId !== decision.taskId || selection.revisionId !== decision.revisionId || applicationReceipt.taskId !== decision.taskId || applicationReceipt.revisionId !== decision.revisionId) throw new Error('SHOTCRAFT_EXPERIENCE_DECISION_SCOPE_MISMATCH');
const selectionErrors = validateDirectorSelectionFiles(selection, repoRoot);
const applicationErrors = await validateApplicationReceiptFiles(applicationReceipt, repoRoot);
if (selectionErrors.length || applicationErrors.length) throw new Error([...selectionErrors, ...applicationErrors].join('\n'));

const appliedBeats = selection.beats.filter((beat) => beat.decision === 'apply');
const decisions = Array.isArray(decision.beatDecisions) ? decision.beatDecisions : [];
const appliedIds = appliedBeats.map((beat) => beat.beatId).sort();
const decisionIds = decisions.map((item) => item?.beatId).sort();
if (stableStringify(appliedIds) !== stableStringify(decisionIds) || decisions.some((item) => !['accepted', 'rejected'].includes(item?.outcome) || !isText(item?.reason))) throw new Error('SHOTCRAFT_EXPERIENCE_BEAT_DECISIONS_INCOMPLETE');

const ledgerPath = resolveExisting(ledgerArg);
const ledgerBytesBefore = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytesBefore);
const ledgerErrors = validateExperienceLedger(ledger);
if (ledgerErrors.length) throw new Error(ledgerErrors.join('\n'));

const additions = [];
for (const beat of appliedBeats) {
  const beatDecision = decisions.find((item) => item.beatId === beat.beatId);
  const application = applicationReceipt.applications.find((item) => item.beatId === beat.beatId);
  const context = normalizeContextSignature(beat.matchContext);
  if (!beat.sourceCard?.cardName || !context.mainVisual || !context.semanticIntents.length || beat.matchContext?.fingerprint !== contextFingerprint(context)) throw new Error(`SHOTCRAFT_EXPERIENCE_MATCH_CONTEXT_INVALID:${beat.beatId}`);
  const identity = {
    taskId: decision.taskId,
    revisionId: decision.revisionId,
    beatId: beat.beatId,
    outcome: beatDecision.outcome,
    candidateSha256: decision.candidate.sha256,
    selectionSha256: decision.selection.sha256,
  };
  const entry = {
    caseId: `case-${sha256Text(stableStringify(identity)).slice(0, 20)}`,
    outcome: beatDecision.outcome,
    taskId: decision.taskId,
    revisionId: decision.revisionId,
    beatId: beat.beatId,
    effectId: beat.effectId,
    cardName: beat.sourceCard.cardName,
    recordedAt: decision.userEvidence.recordedAt,
    reason: beatDecision.reason,
    context,
    contextFingerprint: contextFingerprint(context),
    selection: decision.selection,
    applicationReceipt: decision.applicationReceipt,
    candidate: decision.candidate,
    component: application.component,
    registrySha256: selection.registry.sha256,
    userEvidence: decision.userEvidence,
  };
  if (!ledger.cases.some((existing) => existing.caseId === entry.caseId)) additions.push(entry);
}

const nextLedger = {
  ...ledger,
  cases: [...ledger.cases, ...additions].sort((a, b) => `${a.recordedAt}|${a.caseId}`.localeCompare(`${b.recordedAt}|${b.caseId}`, 'en')),
};
nextLedger.patterns = rebuildExperiencePatterns(nextLedger.cases, nextLedger.policy);
const nextErrors = validateExperienceLedger(nextLedger);
if (nextErrors.length) throw new Error(nextErrors.join('\n'));
const nextBytes = Buffer.from(`${JSON.stringify(nextLedger, null, 2)}\n`, 'utf8');
const ledgerShaBefore = sha256Bytes(ledgerBytesBefore);
const ledgerShaAfter = sha256Bytes(nextBytes);
if (ledgerShaBefore !== ledgerShaAfter) {
  const temporary = `${ledgerPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, nextBytes, {flag: 'wx'});
  fs.renameSync(temporary, ledgerPath);
}

const receiptPath = resolveNew(receiptArg);
const receipt = {
  schemaVersion: EXPERIENCE_WRITE_RECEIPT_SCHEMA,
  status: 'experience-recorded',
  taskId: decision.taskId,
  revisionId: decision.revisionId,
  recordedAt: decision.userEvidence.recordedAt,
  decision: {path: relativePath(decisionPath), sha256: sha256Bytes(decisionBytes)},
  ledger: {
    path: relativePath(ledgerPath),
    beforeSha256: ledgerShaBefore,
    afterSha256: ledgerShaAfter,
  },
  addedCaseIds: additions.map((entry) => entry.caseId),
  reusablePatternIds: nextLedger.patterns.map((pattern) => pattern.patternId),
  gates: {
    candidatePreviewStillRequiredOnReuse: true,
    formalApprovalGranted: false,
    publicationApproved: false,
  },
};
const receiptBinding = writeAtomic(receiptPath, receipt);
console.log(JSON.stringify({
  status: receipt.status,
  ledger: {path: relativePath(ledgerPath), sha256: ledgerShaAfter},
  receipt: receiptBinding,
  addedCaseCount: additions.length,
  reusablePatternCount: nextLedger.patterns.length,
}, null, 2));
