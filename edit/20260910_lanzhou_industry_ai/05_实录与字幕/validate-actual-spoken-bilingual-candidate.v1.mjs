#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(here, 'actual-spoken.bilingual.candidate.validation.v1.json');
const bindings = Object.freeze({
  rawAsr: {path: path.join(here, 'host_whisper_small_raw_v1.json'), sha256: '27a28f5c5b735f4e9b8fde74ac4fa877e771435579a83b0ac6593b064b6c909b'},
  review: {path: path.join(here, 'transcription-review.v1.json'), sha256: '204753ed7298ffc39363500601505ae755aee23a32c4f6956e0f34ed40afe498'},
  timeline: {path: path.join(here, 'spoken-timeline.candidate.v1.json'), sha256: 'be4a59f697cabd520c0219cef782cc7d779fdd129ab2c8633aad9e202ebeefa2'},
  candidate: {path: path.join(here, 'actual-spoken.bilingual.candidate.v1.json'), sha256: '1e0401c5edd119581d38f8ee83f3bcba3aafcaa31fddd370ed51477a5e9a8914'},
});
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readLocked = (binding) => {
  const bytes = fs.readFileSync(binding.path);
  const actual = sha256(bytes);
  if (actual !== binding.sha256) throw new Error(`INPUT_HASH_MISMATCH:${path.basename(binding.path)}:${actual}`);
  return {body: JSON.parse(bytes), binding: {path: path.relative(process.cwd(), binding.path).split(path.sep).join('/'), sha256: actual}};
};
const normalize = (text) => String(text ?? '').normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu, '').toLowerCase();
const raw = readLocked(bindings.rawAsr);
const review = readLocked(bindings.review);
const timeline = readLocked(bindings.timeline);
const candidate = readLocked(bindings.candidate);
const errors = [];

if (candidate.body.schemaVersion !== 'koubo-actual-spoken-bilingual-candidate/v1') errors.push('BILINGUAL_SCHEMA_INVALID');
if (candidate.body.status !== 'needs-user-audio-review' || candidate.body.humanListeningPerformed !== false || candidate.body.userAudioReviewConfirmed !== false || candidate.body.formalAllowed !== false) errors.push('CANDIDATE_REVIEW_GATE_INVALID');
if (candidate.body.pageCount !== 96 || candidate.body.captions?.length !== 96 || raw.body.transcription?.length !== 96) errors.push('CAPTION_PAGE_COUNT_INVALID');
if (candidate.body.beatCount !== 22 || timeline.body.captions?.length !== 22) errors.push('BEAT_COUNT_INVALID');

const correct = (sourceText) => {
  let text = String(sourceText).trim().replace(/\s+/gu, '');
  for (const {from, to} of review.body.corrections) text = text.replaceAll(from, to);
  return text;
};
for (let index = 0; index < candidate.body.captions.length; index += 1) {
  const page = candidate.body.captions[index];
  const source = raw.body.transcription[index];
  const beat = timeline.body.captions.find((item) => item.beatId === page.beatId);
  if (!source || !beat) errors.push(`PAGE_SOURCE_MISSING:${page.id}`);
  if (page.sourceSegmentIndex !== index || page.startMs !== source?.offsets.from || page.endMs !== source?.offsets.to) errors.push(`PAGE_WINDOW_DRIFT:${page.id}`);
  if (page.zh !== correct(source?.text)) errors.push(`CHINESE_SOURCE_DRIFT:${page.id}`);
  if (typeof page.en !== 'string' || !page.en.trim()) errors.push(`ENGLISH_EMPTY:${page.id}`);
  if (page.reviewRequired !== (beat?.reviewRequired === true)) errors.push(`REVIEW_REQUIRED_DRIFT:${page.id}`);
  const expectedUncertainty = JSON.stringify(beat?.uncertaintyIds ?? []);
  if (JSON.stringify(page.uncertaintyIds) !== expectedUncertainty || JSON.stringify(page.uncertainIds) !== expectedUncertainty) errors.push(`UNCERTAINTY_DRIFT:${page.id}`);
  if (index > 0 && page.startMs < candidate.body.captions[index - 1].endMs) errors.push(`PAGE_OVERLAP:${page.id}`);
}
for (const beat of timeline.body.captions) {
  const joined = candidate.body.captions.filter((page) => page.beatId === beat.beatId).map((page) => page.zh).join('');
  if (normalize(joined) !== normalize(beat.text)) errors.push(`AGGREGATE_CHINESE_DRIFT:${beat.beatId}`);
}

const reviewRequiredPageIds = candidate.body.captions.filter((page) => page.reviewRequired).map((page) => page.id);
const uncertainIds = [...new Set(candidate.body.captions.flatMap((page) => page.uncertainIds))].sort();
const result = {
  schemaVersion: 'koubo-actual-spoken-bilingual-candidate-validation/v1',
  status: errors.length ? 'blocked' : 'bilingual-candidate-valid-needs-user-audio-review',
  validatedAt: new Date().toISOString(),
  candidate: candidate.binding,
  sources: {rawAsr: raw.binding, review: review.binding, timeline: timeline.binding},
  summary: {
    pageCount: candidate.body.captions.length,
    beatCount: timeline.body.captions.length,
    reviewRequiredPageCount: reviewRequiredPageIds.length,
    reviewRequiredPageIds,
    uncertainIds,
    correctedPageCount: candidate.body.captions.filter((page) => page.correctionIds.length > 0).length,
    maximumChineseCharactersPerPage: Math.max(...candidate.body.captions.map((page) => [...page.zh].length)),
    maximumEnglishCharactersPerPage: Math.max(...candidate.body.captions.map((page) => [...page.en].length)),
  },
  gates: {
    candidateOnly: true,
    userAudioReviewConfirmed: false,
    formalAllowed: false,
    chineseDerivedFromActualAsrSegments: true,
    englishDerivedFromSameWindowChinese: true,
  },
  errors,
};
const bytes = Buffer.from(`${JSON.stringify(result, null, 2)}\n`, 'utf8');
fs.writeFileSync(outputPath, bytes, {flag: 'wx'});
console.log(JSON.stringify({...result, output: {path: path.relative(process.cwd(), outputPath).split(path.sep).join('/'), sha256: sha256(bytes)}}, null, 2));
if (errors.length) process.exitCode = 1;
