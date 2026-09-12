import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {auditLanzhouDirectorRegression} from './director-r10-lanzhou-regression-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));

const inputs = {
  bilingual: await readJson(
    'edit/20260910_lanzhou_industry_ai/05_实录与字幕/actual-spoken.bilingual.candidate.v1.json',
  ),
  spokenTimeline: await readJson(
    'edit/20260910_lanzhou_industry_ai/05_实录与字幕/spoken-timeline.candidate.v1.json',
  ),
  postshoot: await readJson(
    'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/director-postshoot-rebind-plan.v1.json',
  ),
  visualPlan: await readJson(
    'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1/visual-plan.v1.json',
  ),
  sfxPlan: await readJson(
    'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1/sfx-cues.v1.json',
  ),
  productionJob: await readJson(
    'workflow/jobs/20260910_lanzhou_industry_ai_v91_v8_r1.production.json',
  ),
};

const report = auditLanzhouDirectorRegression(inputs);

assert.equal(report.schemaVersion, 'koubo-director-r10-lanzhou-regression/v1');
assert.equal(report.status, 'regression-confirmed');

assert.deepEqual(
  report.evidence.b07Segments.map(({captionId, startMs, endMs}) => ({captionId, startMs, endMs})),
  [
    {captionId: 'cap-b07-p01', startMs: 66000, endMs: 69000},
    {captionId: 'cap-b07-p02', startMs: 69000, endMs: 71000},
    {captionId: 'cap-b07-p03', startMs: 71000, endMs: 74800},
    {captionId: 'cap-b07-p04', startMs: 74800, endMs: 79500},
    {captionId: 'cap-b07-p05', startMs: 79500, endMs: 82700},
    {captionId: 'cap-b07-p06', startMs: 82700, endMs: 85900},
  ],
);

assert.deepEqual(report.evidence.postshootCollapsedWindow, {
  beatId: 'B07',
  startMs: 85600,
  endMs: 85900,
  nodeIds: ['N1', 'N2', 'N3', 'N4'],
});

assert.deepEqual(report.evidence.p02, {
  layerId: 'v91-009-p02-b07',
  startMs: 77600,
  endMs: 85600,
  assetAudioMuted: true,
  entrySfxCueIds: ['v91-009-p02-b07-sfx'],
  actions: [
    {actionId: 'A1', startMs: 78200, endMs: 79300, sfxRole: 'paper-slide'},
    {actionId: 'A2', startMs: 79600, endMs: 80700, sfxRole: 'paper-slide'},
    {actionId: 'A3', startMs: 81000, endMs: 82300, sfxRole: 'paper-click'},
    {actionId: 'A4', startMs: 82700, endMs: 84100, sfxRole: 'paper-slide'},
  ],
  internalActionSfxBoundCount: 0,
});

assert.deepEqual(report.evidence.preview, {
  rangesMs: [{id: 'v91-v8-hook-paper-bilingual-sfx-45s', startMs: 0, endMs: 45000}],
  missedRequiredIds: [
    'v91-009-p02-b07',
    'v91-013-p03-b10',
    'v91-015-p04-b11',
    'v91-020-p05-b15',
    'v91-022-p06-b17',
    'v91-026-b21-start-known',
    'v91-027-b22-closing',
  ],
});

assert.deepEqual(
  report.diagnostics.map(({code, severity}) => ({code, severity})),
  [
    {code: 'R10_LANZHOU_B07_SEGMENTS_CONFIRMED', severity: 'evidence'},
    {code: 'R10_LANZHOU_POSTSHOOT_B07_TAIL_COLLAPSE', severity: 'error'},
    {code: 'R10_LANZHOU_P02_INTERNAL_ACTION_SFX_MISSING', severity: 'error'},
    {code: 'R10_LANZHOU_PREVIEW_COVERAGE_FALSE_POSITIVE', severity: 'error'},
  ],
);

assert.deepEqual(report.repairAnchors.semanticNodes, [
  {nodeId: 'N1', captionId: 'cap-b07-p01', startMs: 66000, endMs: 69000},
  {nodeId: 'N2', captionId: 'cap-b07-p02', startMs: 69000, endMs: 71000},
  {nodeId: 'N3', captionId: 'cap-b07-p03', startMs: 71000, endMs: 74800},
  {nodeId: 'N4', captionId: 'cap-b07-p04', startMs: 74800, endMs: 79500},
]);
assert.deepEqual(report.repairAnchors.p02ActionBoundariesMs, [
  {actionId: 'A1', startMs: 78200, endMs: 79300},
  {actionId: 'A2', startMs: 79600, endMs: 80700},
  {actionId: 'A3', startMs: 81000, endMs: 82300},
  {actionId: 'A4', startMs: 82700, endMs: 84100},
]);
assert.equal(report.repairAnchors.precisionPolicy, 'segment-boundaries-only');

const repeated = auditLanzhouDirectorRegression(inputs);
assert.deepEqual(repeated, report, '相同真实输入必须得到完全稳定的诊断结果');

const invalidInput = structuredClone(inputs);
invalidInput.bilingual.captions.find((caption) => caption.id === 'cap-b07-p02').startMs = 69001;
assert.throws(
  () => auditLanzhouDirectorRegression(invalidInput),
  /R10_LANZHOU_SOURCE_MISMATCH/,
  '两份实录时间源不一致时必须停止，不能自动猜测修复锚点',
);

console.log('导演 R10 兰州真实事故旁路回归：通过');
