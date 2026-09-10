import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, writeFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {RAW_VISUAL_CRITERIA, REVIEW_SCHEMA, JOB_SCHEMA, sha256File, sha256Json, validateRawVisualReview} from '../scripts/firstframe-batch-core.mjs';

const scene = {sceneId: 'P02', result: {imageSha256: 'a'.repeat(64)}};
const baseline = () => ({schemaVersion: REVIEW_SCHEMA, sceneId: 'P02', imageSha256: scene.result.imageSha256,
  status: 'passed', notes: '离线检查结构夹具；不作为真实图像验收。',
  criteria: Object.fromEntries(RAW_VISUAL_CRITERIA.map((key) => [key, 'passed']))});

test('完整逐项观察结构可以通过；不宣称自动视觉识别', () => {
  assert.deepEqual(validateRawVisualReview(scene, baseline()), []);
});
for (const criterion of RAW_VISUAL_CRITERIA) {
  test(`顶层passed不能掩盖${criterion}失败或缺失`, () => {
    for (const state of ['failed', undefined]) {
      const review = baseline();
      review.criteria[criterion] = state;
      assert.ok(validateRawVisualReview(scene, review).includes(`VISUAL_CRITERION_FAILED:P02:${criterion}`));
    }
  });
}
test('整图失败、空观察、旧图SHA和串镜均阻断', () => {
  for (const [key, value, code] of [
    ['status', 'revision-required', 'VISUAL_REVIEW_NOT_PASSED'],
    ['notes', ' ', 'VISUAL_OBSERVATIONS_MISSING'],
    ['imageSha256', 'b'.repeat(64), 'VISUAL_REVIEW_IMAGE_SHA_MISMATCH'],
    ['sceneId', 'P01', 'VISUAL_REVIEW_SCHEMA_INVALID'],
  ]) {
    const review = {...baseline(), [key]: value};
    assert.ok(validateRawVisualReview(scene, review).some((error) => error.startsWith(code)));
  }
});

test('真实烘焙CLI在创建请求或调用写字器前拒绝顶层passed下的单项失败', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'koubo-review-gate-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const save = (name, value) => {
    const file = path.join(root, name);
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
    return file;
  };
  const raw = save('synthetic-image.bin', 'hash-only fixture; no image is rendered in this gate test');
  const source = save('source.json', {});
  const plan = save('plan.json', {});
  const font = save('unused-font.bin', 'must not be used');
  const review = {...baseline(), imageSha256: sha256File(raw)};
  review.criteria.videoReadiness = 'failed';
  const reviewPath = save('P02.visual-review.v1.json', review);
  const job = save('job.json', {schemaVersion: JOB_SCHEMA, sourceManifest: {path: source, sha256: sha256File(source)},
    sampleSceneIds: ['P02'], output: {qaRoot: root}, scenes: [{sceneId: 'P02',
      result: {imagePath: raw, imageSha256: sha256File(raw), visualReview: {path: reviewPath}}}]});
  const script = fileURLToPath(new URL('../scripts/bake-firstframe-batch.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--project-root', root, '--job', job,
    '--source-plan', plan, '--font', font, '--phase', 'sample'], {encoding: 'utf8'});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RAW_VISUAL_REVIEW_INVALID:P02:VISUAL_CRITERION_FAILED:P02:videoReadiness/);
  assert.equal(readdirSync(root).some((name) => name.includes('text-bake-request') || name.includes('text-bake-receipt')), false);
});

const physicalFixture = () => {
  const physicalContract = {schemaVersion: 'koubo-paper-physical-contract/v1',
    inventory: [{partId: 'draft', quantity: 1}], stations: [{groupId: 'G1', initialPartIds: ['draft']},
      {groupId: 'G2', initialPartIds: []}], transfers: [{actionId: 'A1'}]};
  const current = {...scene, physicalContract, physicalContractSha256: sha256Json(physicalContract),
    deterministicTextBake: {labels: [{nodeId: 'N1'}]}};
  const observation = {imageSha256: scene.result.imageSha256, physicalContractSha256: current.physicalContractSha256,
    inventory: [{partId: 'draft', observedQuantity: 1, observedGroupIds: ['G1'], imageBoxes: [[0.1, 0.4, 0.1, 0.1]], notes: '模拟的一叠纸观察框'}],
    stations: [{groupId: 'G1', observedPartIds: ['draft'], imageBox: [0.1, 0.4, 0.15, 0.15], notes: '模拟起点'},
      {groupId: 'G2', observedPartIds: [], imageBox: [0.3, 0.4, 0.15, 0.15], notes: '模拟空接收位'}],
    transfers: [{actionId: 'A1', imageBox: [0.1, 0.4, 0.35, 0.15], notes: '模拟同高无挡边通道',
      checks: {continuousSupport: 'passed', compatibleHeight: 'passed', noBlockingEdges: 'passed', openingFitsPart: 'passed'}}],
    fixedLabels: [{nodeId: 'N1', imageBox: [0.1, 0.2, 0.15, 0.1], independentStandObserved: true, notes: '模拟固定牌'}]};
  return {current, review: {...baseline(), physicalObservations: observation}};
};
test('实体观察记录逐项对应合同，不把结构自检当作实际动态验收', () => {
  const f = physicalFixture();
  assert.deepEqual(validateRawVisualReview(f.current, f.review), []);
});
test('删除批次实体字段不能降级绕过源清单', () => {
  const f = physicalFixture(); const sourceScene = structuredClone(f.current);
  delete f.current.physicalContract; delete f.current.physicalContractSha256;
  assert.ok(validateRawVisualReview(f.current, f.review, {sourceScene, policy: {physicalContinuityVersion: '1'}})
    .includes('PHYSICAL_SOURCE_BINDING_INVALID:P02'));
});
for (const [name, mutate, expected] of [
  ['两叠纸', (o) => {o.inventory[0].observedQuantity = 2;}, 'PHYSICAL_INVENTORY_MISMATCH'],
  ['多处起点', (o) => {o.inventory[0].observedGroupIds.push('G2');}, 'PHYSICAL_INVENTORY_MISMATCH'],
  ['接收处已有纸', (o) => {o.stations[1].observedPartIds.push('draft');}, 'PHYSICAL_STATION_OCCUPANCY_MISMATCH'],
  ['存在挡边', (o) => {o.transfers[0].checks.noBlockingEdges = 'failed';}, 'PHYSICAL_ROUTE_NOT_PASSED'],
  ['无法确定高差', (o) => {o.transfers[0].checks.compatibleHeight = 'unknown';}, 'PHYSICAL_ROUTE_NOT_PASSED'],
  ['未记录通道图像位置', (o) => {delete o.transfers[0].imageBox;}, 'PHYSICAL_ROUTE_NOT_PASSED'],
  ['照抄通过无具体观察', (o) => {o.transfers[0].notes = '';}, 'PHYSICAL_ROUTE_NOT_PASSED'],
  ['缺少固定牌', (o) => {o.fixedLabels = [];}, 'PHYSICAL_FIXED_LABELS_INVALID'],
  ['绑定旧图', (o) => {o.imageSha256 = 'b'.repeat(64);}, 'PHYSICAL_OBSERVATION_BINDING_INVALID'],
]) {
  test(`实际图像观察拒绝${name}，即使顶层仍passed`, () => {
    const f = physicalFixture(); mutate(f.review.physicalObservations);
    assert.ok(validateRawVisualReview(f.current, f.review).some((error) => error.startsWith(expected)));
  });
}
