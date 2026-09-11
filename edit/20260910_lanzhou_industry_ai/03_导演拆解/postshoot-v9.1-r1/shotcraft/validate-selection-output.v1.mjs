#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {validateDirectorSelectionFiles} from '../../../../../skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs';

const repoRoot = process.cwd();
const selectionPath = 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/director-selection.v1.json';
const autoMatchReceiptPath = 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/auto-match-receipt.v1.json';
const lookupPath = 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/experience-lookup-receipt.v1.json';
const outputPath = 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/selection-validation-output.v1.json';

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (relativePath) => {
  const bytes = fs.readFileSync(path.resolve(repoRoot, relativePath));
  return {body: JSON.parse(bytes), binding: {path: relativePath, sha256: sha256(bytes)}};
};

const selection = read(selectionPath);
const receipt = read(autoMatchReceiptPath);
const lookup = read(lookupPath);
const errors = validateDirectorSelectionFiles(selection.body, repoRoot);
if (receipt.body.selection.sha256 !== selection.binding.sha256) errors.push('AUTO_MATCH_RECEIPT_SELECTION_HASH_MISMATCH');
if (receipt.body.experienceLookup.sha256 !== lookup.binding.sha256) errors.push('AUTO_MATCH_RECEIPT_LOOKUP_HASH_MISMATCH');
if (receipt.body.summary.analyzedCardCount !== 157) errors.push('FULL_157_CARD_MATCH_NOT_PROVEN');
if (selection.body.beats.length !== 22) errors.push('SELECTION_22_BEAT_COVERAGE_REQUIRED');
const paperBeats = selection.body.beats.filter((beat) => beat.mainVisual === 'paper-editorial');
if (paperBeats.map((beat) => beat.beatId).join(',') !== 'B04,B07,B10,B11,B15,B17') errors.push('PAPER_BEAT_SET_INVALID');
if (paperBeats.some((beat) => beat.decision !== 'not-needed')) errors.push('SHOTCRAFT_MUST_NOT_OVERLAY_PAPER_MAIN_VISUAL');
if (selection.body.beats.filter((beat) => beat.mainVisual === 'speaker').length !== 16) errors.push('SPEAKER_BEAT_COUNT_INVALID');

const result = {
  schemaVersion: 'koubo-shotcraft-selection-validation-output/v1',
  status: errors.length ? 'blocked' : 'director-selection-valid',
  validatedAt: new Date().toISOString(),
  selection: selection.binding,
  autoMatchReceipt: receipt.binding,
  experienceLookup: lookup.binding,
  summary: {
    analyzedCardCount: receipt.body.summary.analyzedCardCount,
    candidateRenderableCardCount: receipt.body.summary.candidateRenderableCardCount,
    adaptationRequiredCardCount: receipt.body.summary.adaptationRequiredCardCount,
    beatCount: selection.body.beats.length,
    speakerBeatCount: selection.body.beats.filter((beat) => beat.mainVisual === 'speaker').length,
    paperBeatCount: paperBeats.length,
    applyCount: selection.body.beats.filter((beat) => beat.decision === 'apply').length,
    notNeededCount: selection.body.beats.filter((beat) => beat.decision === 'not-needed').length,
  },
  gates: {
    candidatePreviewStillRequired: true,
    formalApprovalGranted: false,
    publicationApproved: false,
    captionsNeedUserAudioReview: true,
    paperDynamicCandidateAccepted: false,
  },
  errors: [...new Set(errors)],
};

const bytes = Buffer.from(`${JSON.stringify(result, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.resolve(repoRoot, outputPath), bytes, {flag: 'wx'});
console.log(JSON.stringify({...result, output: {path: outputPath, sha256: sha256(bytes)}}, null, 2));
if (errors.length) process.exitCode = 1;
