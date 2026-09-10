import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File, sha256Json} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {renderMotionFirstFrame, renderMotionPrompt, paperMechanismSnapshot} from '../../../../skills/koubo-remotion-director/scripts/paper-motion-contract.mjs';
import {derivePaperProjection, validatePaperProjectionContract} from '../../../../skills/koubo-remotion-director/scripts/paper-projection-contract.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const previous = path.resolve(output, '../paper-v9.1-r2');
const relative = (p) => path.relative(root, p);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const bind = (p) => ({path: relative(p), sha256: sha256File(p)});
const writeNew = (name, data) => {
  const file = path.join(output, name);
  assert(!existsSync(file), `REFUSE_OVERWRITE:${file}`);
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, {flag: 'wx'});
};
const sourcePath = path.join(previous, 'director-request.v1.json');
const source = read(sourcePath);
const request = structuredClone(source);
request.revisionId = '20260910-lanzhou-industry-ai-paper-v9.1-r3';
request.requestId = `${request.revisionId}-pre-shoot`;
request.policy.projectionRequiredBeatIds = ['B07'];
for (const key of Object.keys(request.outputs)) request.outputs[key] = relative(path.join(output, path.basename(request.outputs[key])));
for (const beat of request.beats.filter((b) => b.paperScene)) delete beat.paperScene.motionContract.semanticReview;
const beat = request.beats.find((b) => b.id === 'B07');
const scene = beat.paperScene;
scene.motionContract.projectionContract = {
  schemaVersion: 'koubo-paper-projection/v1', type: 'axis-aligned-affine-reference',
  frame: {width: 1920, height: 1080}, xScale: 3.4, yScale: 2.8, zScale: 2.6,
  originX: 76, originY: 400, paddingPx: 4,
  localActionEnvelopes: [{actionId: 'A3', obstacleId: 'lever-full-rotation-envelope'}],
};
const oldRectsRejected = validatePaperProjectionContract({scene, beat});
assert(oldRectsRejected.length > 0, '旧画面动作范围必须被新投影拒绝');
const projection = derivePaperProjection(scene);
assert(projection.ok, JSON.stringify(projection.errors));
for (const item of projection.actionRects) scene.motionContract.actions.find((a) => a.id === item.actionId).sweptRect = item.rect;
assert.deepEqual(validatePaperProjectionContract({scene, beat}), []);
scene.prompt.firstFrame = renderMotionFirstFrame(scene);
scene.prompt.motion = renderMotionPrompt(scene);

const unchangedScenes = [];
for (const b of request.beats.filter((b) => b.paperScene)) {
  const original = structuredClone(source.beats.find((old) => old.id === b.id).paperScene);
  delete original.motionContract.semanticReview;
  if (b.id !== 'B07') {
    assert.deepEqual(b.paperScene, original);
    assert.equal(renderMotionFirstFrame(b.paperScene), original.prompt.firstFrame);
    assert.equal(renderMotionPrompt(b.paperScene), original.prompt.motion);
    unchangedScenes.push({beatId: b.id, sceneSha256: sha256Json(original)});
  } else {
    const comparable = structuredClone(b.paperScene);
    delete comparable.motionContract.projectionContract;
    comparable.motionContract.actions.forEach((a, i) => {a.sweptRect = original.motionContract.actions[i].sweptRect;});
    comparable.prompt = original.prompt;
    assert.deepEqual(comparable, original);
  }
}
assert.deepEqual(request.beats.map((b) => b.spokenLine), source.beats.map((b) => b.spokenLine));
assert.equal(sha256File(path.join(root, request.inputScript.path)), request.inputScript.sha256);
const signedPaths = [sourcePath, ...Object.values(source.outputs).map((p) => path.join(root, p)),
  ...source.beats.filter((b) => b.paperScene).map((b) => path.join(root, b.paperScene.motionContract.semanticReview.path)),
  ...['首帧提示词.md', 'revision-scope.v1.json', 'user-preproduction-authorization.v1.json', '导演修复与交付回执.v1.json'].map((p) => path.join(previous, p))];
writeNew('r2-immutable-signed-inputs.v1.json', {schemaVersion: 'koubo-immutable-snapshot/v1', recordedAt: new Date().toISOString(),
  scope: '只绑定导演r2签发文件，不递归纳入下游仍在更新的执行尝试目录', files: [...new Set(signedPaths)].map(bind)});
writeNew('director-request.unbound.v1.json', request);
writeNew('projection-derivation.v1.json', {schemaVersion: 'koubo-paper-projection-derivation/v1', revisionId: request.revisionId,
  sourceRequest: bind(sourcePath), projectedBeatIds: ['B07'], unprojectedBeatIds: unchangedScenes.map((s) => s.beatId),
  physicalContractSha256: sha256Json(scene.motionContract.physicalContract), mechanismSha256: sha256Json(paperMechanismSnapshot(scene)),
  projectionContract: scene.motionContract.projectionContract, projection, oldRectsRejected,
  conflictEvidence: {model: 'X=originX+xScale*x', oldA1Right: 806.4, oldA4Left: 1075.2,
    worldA1Right: 227, worldA4Left: 293, requiredMinScale: (1075.2 - 806.4) / (293 - 227),
    oldA2Width: 595.2, worldA2Width: 174, requiredMaxScale: 595.2 / 174,
    limitation: '证明旧边界在同一均匀仿射投影下不相容，不声称穷尽所有透视映射'},
  limitations: ['投影是制作参考，不是生成图测量', '只有P02启用本次坐标联验，其余五镜保留原合同',
    '人物障碍包围盒不是实际人物轮廓；实际标签遮挡、手部与完整旋转包络间距仍须看图验证',
    '局部A3使用完整旋转包络，不用初态杆件轮廓代替', '几何通过不能代替正常速度动态验收'],
  generatedMedia: false, formalAuthorized: false});
writeNew('revision-scope.v1.json', {schemaVersion: 'koubo-director-revision-scope/v1', revisionId: request.revisionId,
  parentRequest: bind(sourcePath), preserved: ['原稿22段逐字不变', '六镜节点文字、数量、物件与语义不变',
    '动作对象、类型、顺序、时长和毫米物理合同不变', 'P01/P03/P04/P05/P06完整场景及提示词不变'],
  unchangedScenes, changed: ['P02显式投影合同', 'P02四个sweptRect由完整3D包络推导', 'P02首帧和动作提示词加入同源投影范围',
    '新revision绑定新的独立复核和编译证据'], status: 'awaiting-independent-mechanism-review',
  generatedImages: false, generatedVideos: false, formalAuthorized: false});
console.log(JSON.stringify({requestPath: path.join(output, 'director-request.unbound.v1.json'), projection, generatedMedia: false}));
