import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const dir = import.meta.dirname;
const repo = path.resolve(dir, '../../../..');
const episode = path.resolve(dir, '../..');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const bind = (file) => ({path: path.relative(repo, file).split(path.sep).join('/'), sha256: sha(file)});
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
const dataPath = path.join(dir, 'data.v1.json');
const data = read(dataPath);
const captionsPath = path.join(dir, 'captions.json');
assert.deepEqual(read(captionsPath), data.captions);
const priorPath = path.join(episode, '04_导演拆解/shotcraft-source-audit-r2/source-match-request.v1.json');
const prior = read(priorPath);
const coverage = [];
const beats = [];
const paperranges = data.papers.map((p) => ({sceneId: p.id, startFrame: p.outputStartFrame, endFrameExclusive: p.outputEndFrameExclusive, startMs: p.outputStartMs, endMs: p.outputEndMs, sha256: p.sha256}));
for (const c of data.captions) {
  const overlapping = paperranges.filter((p) => c.outputStartFrame < p.endFrameExclusive && c.outputEndFrameExclusive > p.startFrame);
  const reasons = [];
  if (c.reviewRequired) reasons.push('transcript-uncertainty-preserved');
  if (overlapping.length) reasons.push('final-paper-output-range-protected');
  if (reasons.length) {
    coverage.push({captionId: c.id, status: 'excluded-from-shotcraft-only-caption-still-rendered', reasons, uncertainIds: c.uncertainIds, paperIds: overlapping.map((p) => p.sceneId), outputStartFrame: c.outputStartFrame, outputEndFrameExclusive: c.outputEndFrameExclusive});
    continue;
  }
  const previous = prior.beats.find((b) => b.beatId === `source-${c.id}`);
  assert(previous, `缺少已审阅语义意图，不自动编写新文字: ${c.id}`);
  assert.equal(previous.quote, c.zh);
  for (const phrase of previous.keyPhrases ?? []) assert(c.zh.includes(phrase));
  const beatId = `output-${c.id}`;
  beats.push({...previous, beatId, frames: {startFrame: c.outputStartFrame, endFrameExclusive: c.outputEndFrameExclusive}, quote: c.zh});
  coverage.push({captionId: c.id, status: 'included-in-output-time-full-catalog-match', beatId, outputStartFrame: c.outputStartFrame, outputEndFrameExclusive: c.outputEndFrameExclusive});
}
assert.equal(coverage.length, data.captions.length);
assert.equal(prior.taskId, data.taskId);
const {preparationOnly: historicalPreparation, ...baseRequest} = prior;
const request = {...baseRequest,
  revisionId: '20260907-lanzhou-ai-services-output-match-r1',
  captions: bind(captionsPath),
  canvas: {...prior.canvas, durationInFrames: data.timeline.durationInFrames}, beats,
  candidateOutputBinding: {
    status: 'output-time-candidate-match-only', timebase: 'R01-with-244-frame-news-insert', candidateData: bind(dataPath),
    sourceIntentRequest: bind(priorPath),
    oldTaskIdRetained: data.taskId,
    frameQuantization: data.timeline.frameQuantization,
    fullOriginalCatalogRequired: 157, finalPaperRanges: paperranges, captionCoverage: coverage,
    separateNewsExclusion: {startFrame: 69, endFrameExclusive: 313, reason: '新闻不是本人实录，不编造新的口播quote或效果文字。源内嵌画面保持。'},
    recordedAbsence: {beatId: 'B23', status: 'recorded-absence', matchRequested: false, oldPostshootPassedClaimed: false},
    fullTranscriptApproved: false, compositionConsumed: false, applicationReceiptCreated: false,
    currentWorkerRenderAllowed: false, formalEnabled: false,
    preservedHistoricalFailureReference: historicalPreparation.supersedesFailedRequest,
    historicalFailureNote: '保留旧源时基r2请求引用的失败r1文件；不重跑或伪造旧失败日志。本轮匹配尝试另存真实命令、退出码、stdout、stderr。',
  },
};
for (let i = 1; i < beats.length; i++) assert(beats[i - 1].frames.endFrameExclusive <= beats[i].frames.startFrame);
write('output-match-request.v1.json', request);
const matcher = path.join(repo, 'skills/koubo-shotcraft-library/scripts/match-director-effects.mjs');
const validator = path.join(repo, 'skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs');
const core = path.join(repo, 'skills/koubo-shotcraft-library/scripts/shotcraft-matcher-core.mjs');
const attempts = [];
const run = (id, script, args) => {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [script, ...args], {cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  const stdoutName = `${id}.stdout.txt`, stderrName = `${id}.stderr.txt`;
  fs.writeFileSync(path.join(dir, stdoutName), result.stdout ?? '', {flag: 'wx'});
  fs.writeFileSync(path.join(dir, stderrName), result.stderr ?? '', {flag: 'wx'});
  attempts.push({id, startedAt, finishedAt: new Date().toISOString(), command: [process.execPath, script, ...args], exitCode: result.status,
    signal: result.signal, error: result.error ? String(result.error) : null, stdout: bind(path.join(dir, stdoutName)), stderr: bind(path.join(dir, stderrName))});
  if (result.status !== 0) {
    write('output-match-attempts.v1.json', {status: 'failed-preserved-no-silent-retry', attempts, formalAllowed: false});
    console.error(result.stderr);
    process.exit(result.status || 1);
  }
  return result;
};
const args = ['--request', path.join(dir, 'output-match-request.v1.json'), '--selection', path.join(dir, 'output-match-selection.v1.json'),
  '--receipt', path.join(dir, 'output-match-receipt.v1.json'), '--lookup', path.join(dir, 'output-experience-lookup.v1.json'), '--repo-root', repo];
const matchResult = run('output-match-attempt-01', matcher, args);
const validateResult = run('output-selection-validation-01', validator, [path.join(dir, 'output-match-selection.v1.json'), repo]);
const receipt = read(path.join(dir, 'output-match-receipt.v1.json'));
const selection = read(path.join(dir, 'output-match-selection.v1.json'));
assert.equal(receipt.summary.analyzedCardCount, 157);
assert.equal(selection.beats.length, beats.length);
for (const s of selection.beats) {
  const requestBeat = beats.find((b) => b.beatId === s.beatId);
  assert(requestBeat);
  assert.deepEqual(s.frames, requestBeat.frames);
  assert(!paperranges.some((p) => s.frames.startFrame < p.endFrameExclusive && s.frames.endFrameExclusive > p.startFrame));
  assert(!(s.frames.startFrame < 313 && s.frames.endFrameExclusive > 69));
}
write('output-match-attempts.v1.json', {status: 'actual-attempts-preserved', attempts, failureCount: attempts.filter((a) => a.exitCode !== 0).length,
  repairsAppliedThisRun: [], note: '本轮无失败时如实记0，不制造失败或重试；历史失败引用保留在请求。', formalAllowed: false});
write('output-match-validation.v1.json', {
  status: 'output-time-selection-machine-validated-not-rendered', candidateData: bind(dataPath), captions: bind(captionsPath),
  request: bind(path.join(dir, 'output-match-request.v1.json')), selection: bind(path.join(dir, 'output-match-selection.v1.json')),
  receipt: bind(path.join(dir, 'output-match-receipt.v1.json')), lookup: bind(path.join(dir, 'output-experience-lookup.v1.json')),
  libraryExecution: {matcher: bind(matcher), core: bind(core), validator: bind(validator), sharedFilesModified: false},
  summary: receipt.summary, matchedCaptionCount: beats.length, excludedCaptionCount: coverage.length - beats.length,
  coverageComplete: true, finalPaperRangesExcluded: true, newsExcludedWithoutInventedQuote: true,
  sourceCaptionTextUnchanged: true, recordedAbsenceB23Preserved: true, transcriptUncertainCount: 13,
  applicationReceiptCreated: false, renderPerformed: false, formalAllowed: false,
  expectedNextStep: '主任务按选择合同消费组件并制作候选；实际应用回执只能在真实渲染和验证后生成。',
});
console.log(matchResult.stdout);
console.log(validateResult.stdout);
