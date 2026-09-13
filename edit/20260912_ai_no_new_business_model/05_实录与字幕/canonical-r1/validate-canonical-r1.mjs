import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const outputDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(outputDir, '../../../..');
const episodeRoot = path.resolve(outputDir, '../..');

const files = {
  timeline: path.join(outputDir, 'spoken-timeline.candidate.v1.json'),
  bilingual: path.join(outputDir, 'actual-spoken.bilingual.candidate.v1.json'),
  review: path.join(outputDir, 'transcription-review.v1.json'),
  policy: path.join(outputDir, 'spoken-source-policy.v1.json'),
  director: path.join(episodeRoot, '03_导演拆解/director-core-r3/director-cues.v3.json'),
  media: path.join(episodeRoot, '01_素材投放区/01_口播原片/copy_00131113-A43E-48CD-B158-AB0CDE2EF8DC 2.MOV'),
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const sha256 = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');
const displayLength = (value) => [...value.replace(/[\s\p{P}\p{S}]/gu, '')].length;
const normalize = (value) => value.replace(/[\s\p{P}\p{S}]/gu, '');

const [timeline, bilingual, review, policy, director] = await Promise.all([
  readJson(files.timeline),
  readJson(files.bilingual),
  readJson(files.review),
  readJson(files.policy),
  readJson(files.director),
]);

assert.equal(timeline.schemaVersion, 'koubo-authoritative-spoken-timeline-candidate/v1');
assert.equal(timeline.authority, 'recorded-audio');
assert.equal(timeline.scriptRole, 'comparison-only');
assert.equal(timeline.humanListeningPerformed, false);
assert.equal(timeline.formalAllowed, false);
assert.equal(timeline.beats.length, 34);

const expectedIds = Array.from({length: 34}, (_, index) => `B${String(index + 1).padStart(2, '0')}`);
assert.deepEqual(timeline.beats.map((beat) => beat.beatId), expectedIds);
assert.equal(timeline.beats[0].startMs, 600);
assert.equal(timeline.beats.at(-1).endMs, 386460);

for (let index = 0; index < timeline.beats.length; index += 1) {
  const beat = timeline.beats[index];
  const directorBeat = director.semanticBeats[index];
  assert.equal(beat.beatId, directorBeat.id);
  assert.equal(beat.originalDirectorBeatId, directorBeat.id);
  assert.equal(beat.route, directorBeat.primaryRoute);
  assert.equal(beat.routeCueId, directorBeat.routeCueId ?? null);
  assert.ok(beat.startMs < beat.endMs);
  assert.ok(beat.actualChinese.length > 0);
  assert.ok(Array.isArray(beat.sourceLargeSegmentIndices) && beat.sourceLargeSegmentIndices.length > 0);
  assert.ok(Array.isArray(beat.sourceSmallSegmentIndices) && beat.sourceSmallSegmentIndices.length > 0);
  if (index > 0) assert.ok(timeline.beats[index - 1].endMs <= beat.startMs);
}

const fullActualChinese = timeline.beats.map((beat) => beat.actualChinese).join('');
for (const requiredPhrase of ['那么', '两个小时', '这个流程', '每一次的']) {
  assert.ok(fullActualChinese.includes(requiredPhrase), `未保留实际口语：${requiredPhrase}`);
}

assert.equal(bilingual.schemaVersion, 'koubo-actual-spoken-bilingual-candidate/v1');
assert.equal(bilingual.authority, 'recorded-audio');
assert.equal(bilingual.chineseSource, 'spoken-timeline.candidate.v1.json');
assert.equal(bilingual.englishTranslationSource, 'canonical-spoken-chinese-candidate');
assert.equal(bilingual.humanListeningPerformed, false);
assert.equal(bilingual.formalAllowed, false);
assert.ok(bilingual.pages.length >= 90);
assert.equal(bilingual.pages[0].startMs, 600);
assert.equal(bilingual.pages.at(-1).endMs, 386460);

const pageBeatIds = new Set();
for (let index = 0; index < bilingual.pages.length; index += 1) {
  const page = bilingual.pages[index];
  pageBeatIds.add(page.beatId);
  assert.ok(expectedIds.includes(page.beatId));
  assert.ok(page.startMs < page.endMs);
  assert.ok(page.zh.length > 0 && page.en.length > 0);
  assert.ok(displayLength(page.zh) <= 22, `字幕页过长 ${page.id}: ${page.zh}`);
  if (index > 0) assert.ok(bilingual.pages[index - 1].endMs <= page.startMs, `字幕时间重叠：${page.id}`);
}
assert.deepEqual([...pageBeatIds].sort(), expectedIds);
for (const beat of timeline.beats) {
  const pageText = bilingual.pages
    .filter((page) => page.beatId === beat.beatId)
    .map((page) => page.zh)
    .join('');
  assert.equal(normalize(pageText), normalize(beat.actualChinese), `字幕页与实录 beat 不一致：${beat.beatId}`);
}

assert.equal(review.schemaVersion, 'koubo-transcription-review/v1');
assert.equal(review.humanListeningPerformed, false);
assert.equal(review.userAudioReviewConfirmed, false);
assert.equal(review.formalAllowed, false);
assert.equal(review.beatComparisons.length, 34);
assert.ok(review.uncertainties.length > 0);
assert.ok(review.limitations.some((item) => item.includes('没有进行人工听校')));
const uncertaintyIds = review.uncertainties.map((item) => item.id);
assert.equal(new Set(uncertaintyIds).size, uncertaintyIds.length);
for (const item of review.uncertainties) {
  assert.ok(expectedIds.includes(item.beatId));
  assert.equal(item.status, 'needs-human-audio-review');
  assert.ok(item.retained.length > 0 && item.reason.length > 0);
}

assert.equal(policy.schemaVersion, 1);
assert.equal(policy.canonicalSource, 'recorded-audio');
assert.equal(policy.scriptRole, 'comparison-only');
assert.equal(policy.englishTranslationSource, 'canonical-spoken-chinese-candidate');
assert.equal(policy.compliance.humanListeningPerformed, false);
assert.equal(policy.compliance.formalAllowed, false);
assert.equal(policy.compliance.candidateStructureValidated, true);

const expectedHashes = {
  source: await sha256(files.media),
  canonical: await sha256(files.timeline),
  bilingual: await sha256(files.bilingual),
  review: await sha256(files.review),
};
assert.equal(policy.source.sha256, expectedHashes.source);
assert.equal(policy.canonical.sha256, expectedHashes.canonical);
assert.equal(policy.bilingual.sha256, expectedHashes.bilingual);
assert.equal(policy.verification.review.sha256, expectedHashes.review);

for (const [key, file] of Object.entries({
  source: files.media,
  canonical: files.timeline,
  bilingual: files.bilingual,
  review: files.review,
})) {
  const expectedBytes = (await stat(file)).size;
  const record = key === 'review' ? policy.verification.review : policy[key];
  assert.equal(record.bytes, expectedBytes, `${key} bytes 不一致`);
}

const receipt = {
  schemaVersion: 'koubo-canonical-r1-validation/v1',
  status: 'candidate-valid-needs-human-audio-review',
  formalAllowed: false,
  checked: {
    beatCount: timeline.beats.length,
    pageCount: bilingual.pages.length,
    firstSpeechMs: timeline.beats[0].startMs,
    lastSpeechMs: timeline.beats.at(-1).endMs,
    routesBoundToDirector: true,
    subtitleOverlapCount: 0,
    mobilePageMaxCharacters: Math.max(...bilingual.pages.map((page) => displayLength(page.zh))),
    preservedRecordedPhrases: ['那么', '两个小时', '这个流程', '每一次的'],
    sourceHashesMatched: true,
  },
  limitations: [
    '本校验只证明候选数据结构、范围、绑定和不重叠要求通过。',
    '未进行人工听校；待定词不得用于正式字幕或正式发布。',
  ],
  paths: Object.fromEntries(Object.entries(files).slice(0, 4).map(([key, value]) => [key, path.relative(projectRoot, value)])),
};

await writeFile(
  path.join(outputDir, 'canonical-r1.validation-receipt.v1.json'),
  `${JSON.stringify(receipt, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
