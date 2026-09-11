import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const relative = (value) => path.relative(repoRoot, value).split(path.sep).join('/');
const source = {
  request: path.join(repoRoot, 'edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4/director-request.v1.json'),
  plan: path.join(repoRoot, 'edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4/director-plan.v1.json'),
  validation: path.join(repoRoot, 'edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4/validation-receipt.v1.json'),
  media: path.join(repoRoot, 'edit/20260910_lanzhou_industry_ai/01_原始口播/copy_B71E2E7B-29AC-4653-AC9C-9D4A3C3D3AB6.MOV'),
  timeline: path.join(repoRoot, 'edit/20260910_lanzhou_industry_ai/05_实录与字幕/spoken-timeline.candidate.v1.json'),
};
const outputPath = path.join(here, 'director-postshoot-rebind-request.v1.json');

const expected = new Map([
  [source.request, '5b6054ab7192f330af70e60b6c9996ab06d9ab53a31deab4da8333296f630dcc'],
  [source.plan, '46efff271cccf4cb145bf8d50f0aaab65d8365bb90d757abe66260757bf7058a'],
  [source.validation, '3d72adddb8809d895b6c4a93e0888d3d846ffd395c07d0f1eb9993fa1ceea335'],
  [source.media, 'f5469a24278c333c00b4517c853958954a09cce8772a86231197e1966647d98f'],
  [source.timeline, 'be4a59f697cabd520c0219cef782cc7d779fdd129ab2c8633aad9e202ebeefa2'],
]);

const nodeTerms = {
  B04: {N1: '销售', N2: '开过店', N3: '客户的了解'},
  B07: {N1: '回答', N2: '归类', N3: '老板核对', N4: '讲出去'},
  B10: {N1: '内容', N2: '产品', N3: '客户'},
  B11: {N1: '工作做好', N2: '介绍', N3: '外地同行'},
  B15: {N1: '成本', N2: '继续改', N3: '多试几次'},
  B17: {N1: '做哪些工作', N2: '谁配合', N3: '交什么东西', N4: '查问题'},
};

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readLocked = async (filePath, parseJson = true) => {
  const bytes = await fs.readFile(filePath);
  const actual = sha256(bytes);
  if (actual !== expected.get(filePath)) {
    throw new Error('INPUT_HASH_MISMATCH:' + relative(filePath) + ':' + actual);
  }
  return {body: parseJson ? JSON.parse(bytes.toString('utf8')) : null, sha256: actual};
};

const loaded = Object.fromEntries(
  await Promise.all(
    Object.entries(source).map(async ([key, filePath]) => [
      key,
      await readLocked(filePath, key !== 'media'),
    ]),
  ),
);
const plan = loaded.plan.body;
const timeline = loaded.timeline.body;
const captions = new Map(timeline.captions.map((caption) => [caption.beatId, caption]));

if (plan.beats.length !== 22 || captions.size !== 22) throw new Error('EXPECTED_22_BEATS');

const mappings = plan.beats.map((beat, index) => {
  const caption = captions.get(beat.id);
  if (!caption) throw new Error('CAPTION_MISSING:' + beat.id);
  const labels = beat.paperScene?.textPlan ?? [];
  const isPaper = labels.length > 0;
  const startMs = isPaper ? caption.endMs - 300 : caption.startMs;
  const endMs = caption.endMs;
  const terms = nodeTerms[beat.id] ?? {};
  const nodeTextBindings = labels.map((label) => {
    const term = terms[label.nodeId];
    if (!term) throw new Error('NODE_TERM_MISSING:' + beat.id + ':' + label.nodeId);
    return {
      nodeId: label.nodeId,
      resolvedText: label.text,
      enterStageId: label.enterStageId,
      actualCaptionIds: [caption.id],
      actualSpokenTerms: [term],
      anchorStartMs: startMs,
      anchorEndMs: endMs,
      visualEnterMs: startMs,
      firstReadableFrame: 0,
      labelEnterFrame: 0,
      stageActionFrame: null,
      emphasisStageId: null,
      emphasisFrame: null,
      alignmentStatus: 'exact',
    };
  });
  return {
    beatId: beat.id,
    order: index + 1,
    disposition: 'keep',
    semanticTimingMode: 'within-beat',
    startSeconds: startMs / 1000,
    endSeconds: endMs / 1000,
    actualCaptionIds: [caption.id],
    anchorStartMs: startMs,
    anchorEndMs: endMs,
    actualSpokenLine: caption.text,
    semanticAnchorText: caption.text,
    alignmentStatus: 'exact',
    nodeTextBindings,
    textDecision: 'confirmed',
    visualDecision: 'keep',
  };
});

const request = {
  schemaVersion: 'koubo-director-postshoot-rebind-request/v1',
  requestId: '20260911-lanzhou-industry-ai-postshoot-v9.1-r1',
  revisionId: '20260911-lanzhou-industry-ai-postshoot-v9.1-r1',
  taskId: plan.taskId,
  policy: {incidentPreventionVersion: '1'},
  phase: 'post-shoot',
  timelineFps: 30,
  sourcePreproduction: {
    requestPath: relative(source.request),
    requestSha256: loaded.request.sha256,
    planPath: relative(source.plan),
    planSha256: loaded.plan.sha256,
    validationReceiptPath: relative(source.validation),
    validationReceiptSha256: loaded.validation.sha256,
  },
  recordedMedia: {
    path: relative(source.media),
    sha256: loaded.media.sha256,
    durationSeconds: 336.366667,
  },
  spokenTimeline: {
    path: relative(source.timeline),
    sha256: loaded.timeline.sha256,
    authority: 'recorded-audio',
    scriptRole: 'comparison-only',
  },
  mappings,
  outputs: {
    rebindPlanPath: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/director-postshoot-rebind-plan.v1.json',
    validationReceiptPath: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/director-postshoot-validation-receipt.v1.json',
  },
};

const bytes = Buffer.from(JSON.stringify(request, null, 2) + '\n', 'utf8');
await fs.writeFile(outputPath, bytes, {flag: 'wx', mode: 0o600});
console.log(JSON.stringify({
  status: 'postshoot-request-written',
  path: relative(outputPath),
  sha256: sha256(bytes),
  beatCount: mappings.length,
}));
