import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File, sha256Json} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {renderMotionFirstFrame, renderMotionPrompt, paperMechanismSnapshot} from '../../../../skills/koubo-remotion-director/scripts/paper-motion-contract.mjs';
import {derivePaperProjection, validatePaperProjectionContract} from '../../../../skills/koubo-remotion-director/scripts/paper-projection-contract.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const previous = path.resolve(output, '../paper-v9.1-r3');
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
request.revisionId = '20260910-lanzhou-industry-ai-paper-v9.1-r4';
request.requestId = `${request.revisionId}-pre-shoot`;
request.policy.projectionRequiredBeatIds = ['B04', 'B07', 'B10'];
for (const key of Object.keys(request.outputs)) request.outputs[key] = relative(path.join(output, path.basename(request.outputs[key])));
for (const beat of request.beats.filter((b) => b.paperScene)) delete beat.paperScene.motionContract.semanticReview;

const label = (order) => `本组上沿正面有且仅有一张暖白空白牌，独立刚性支架，牌面落在原定预留区，支架不与活动部件相连；画面横向第${order}组`;
const base = '同一功能底台包含台面、前沿、侧沿和支脚的完整外轮廓，按1920乘1080参考画面内缩在横向210至1770、纵向440至770像素框内；底台前沿及支脚只在通道下方，不能横挡纸片进出口；这些坐标只作构图参考，实际图另验安全区，不要求逐像素复制';
const materials = {
  B04: [
    `暖白厚纸页立架，架内少量无字经验纸页只作静态布景；立架与牌支架退到上半部，最低轮廓不超过参考纵坐标443.5，离第一条动作区至少24像素；两条前景直滑道平行分离，不穿过立架或纸盒；两件活动纸片从首帧起分别平放在各自起点，不另摆活动纸叠；${base}；${label('一')}`,
    `浅灰纤维纸盒，盒内少量无字经验纸页只作静态布景；纸盒与支架最低轮廓不超过参考纵坐标443.5，后景静态架高度约90像素，三层空间来自纸材和前后布景；开店活动纸片平放在第二条通道起点，不从盒内穿出；${label('二')}`,
    `深蓝纸台上的两个独立暖黄色平面接收垫，分别是两条直滑道向右的齐平延续，纸片接近时看得到连续不间断的承托面；两路支承面均为20毫米高度，绝不做凹槽、漏斗、凸沿托盘、端门槛、横挡或台阶，两个入口不合并；首帧两处接收垫均为空；实心纸层与牌支架留在后方，最低轮廓不超过参考纵坐标443.5，不进入两条动作区；${label('三')}`,
  ],
  B10: [
    `唯一暖白内容折页从首帧起已经平放在第一条直滑道起点，折痕贴平，厚度不超过3毫米，运输包络40乘18乘3毫米；不是竖立册页，不新增倒伏、展开或缩小动作；第一条路线由左方内容起点直达右方客户接收面，经过中间空产品架的前方，绝不汇入产品架或第二条路线；${base}；${label('一')}`,
    `中景产品架始终空着，没有产品、服务成品或回寄件；静态空架与牌支架最低轮廓不超过参考纵坐标446.5，离第一条动作区至少24像素，静态架高度约90像素；其前方第二条独立直路从右方客户返回本组，一张完全平面的开放接询垫与这条路线齐平，支承高度20毫米，没有下沉低盘、坡道、凸沿或横向端门槛；首帧接询垫为空，咨询到来后也不填充后方产品架；${label('二')}`,
    `远景暖白无脸纸人静止留在桌旁，人物、桌和牌支架最低轮廓不超过参考纵坐标446.5，不进入动作区；第一条路线的右端为齐平开放接收垫，初态为空；唯一无字客户咨询纸片从首帧起已经平放在第二条路线的右方起点，随后只沿第二条直路向左移动；两条路线平行分离，全程支承高度20毫米，不合为蛇形通道，不造高低站台或额外拱门建筑，不放订单或钱币；${label('三')}`,
  ],
};
const changedIds = Object.keys(materials);
const derivations = [];
for (const beat of request.beats.filter((b) => changedIds.includes(b.id))) {
  const scene = beat.paperScene;
  scene.objectGroups.forEach((group, i) => {group.material = materials[beat.id][i];});
  scene.motionContract.projectionContract = {
    schemaVersion: 'koubo-paper-projection/v1', type: 'axis-aligned-affine-reference',
    frame: {width: 1920, height: 1080}, xScale: 4, yScale: 3, zScale: 2.5,
    originX: 0, originY: 270, paddingPx: 4, localActionEnvelopes: [],
  };
  const oldRectsRejected = validatePaperProjectionContract({scene, beat});
  assert(oldRectsRejected.some((e) => e.includes('ACTION_RECT_MISMATCH')));
  const projection = derivePaperProjection(scene);
  assert(projection.ok, JSON.stringify(projection.errors));
  for (const item of projection.actionRects) scene.motionContract.actions.find((a) => a.id === item.actionId).sweptRect = item.rect;
  assert.deepEqual(validatePaperProjectionContract({scene, beat}), []);
  scene.prompt.firstFrame = renderMotionFirstFrame(scene);
  scene.prompt.motion = renderMotionPrompt(scene);
  const p = scene.motionContract.projectionContract;
  const pixelRect = (r) => ({x: r.x * p.frame.width, y: r.y * p.frame.height, width: r.width * p.frame.width, height: r.height * p.frame.height});
  const firstActionY = Math.min(...projection.actionRects.map((r) => r.rect.y * p.frame.height));
  derivations.push({sceneId: beat.id === 'B04' ? 'P01' : 'P03', beatId: beat.id,
    physicalContractSha256: sha256Json(scene.motionContract.physicalContract),
    mechanismSha256: sha256Json(paperMechanismSnapshot(scene)),
    projectionContract: p, projection, oldRectsRejected,
    referenceGuide: {
      coordinateSpace: 'planned-frame-pixels', frame: p.frame,
      functionalBaseFullOutline: {x: 210, y: 440, width: 1560, height: 330},
      baseOutlineIncludes: ['台面', '前沿', '侧沿', '支脚'],
      rearStaticMaximumY: firstActionY - 24, rearStaticTypicalHeightPx: 90,
      rearStaticIncludes: ['立架或空产品架', '独立牌支架', '人物与桌（本镜如有）'],
      contentSafeRect: pixelRect(scene.layoutContract.contentSafeRect),
      subtitleReservedRect: pixelRect(scene.layoutContract.subtitleReservedRect),
      labelZones: scene.layoutContract.paperLabelSurfaceBoxes,
      objectGroups: scene.objectGroups,
      actionRects: projection.actionRects.map((r) => ({actionId: r.actionId, rect: pixelRect(r.rect)})),
      supportRects: projection.supportRects.map((r) => ({supportId: r.supportId, rect: pixelRect(r.rect)})),
      dockCenters: scene.motionContract.physicalContract.docks.map((d) => ({dockId: d.id, groupId: d.groupId,
        x: p.originX + p.xScale * d.xMm, y: p.originY + p.yScale * d.yMm - p.zScale * d.supportHeightMm})),
      initialParts: scene.motionContract.initialLocations.map((loc) => {
        const action = scene.motionContract.actions.find((a) => a.partId === loc.partId);
        const transfer = scene.motionContract.physicalContract.transfers.find((t) => t.actionId === action.id);
        return {partId: loc.partId, groupId: loc.groupId, dockId: transfer.fromDockId, pose: 'already-flat-at-first-frame',
          inventory: scene.motionContract.physicalContract.inventory.find((i) => i.partId === loc.partId)};
      }),
      receivingAppearance: '各接收垫仅为对应连续支承面的平面色块，与轨道视觉齐平；无凹陷、凸沿、横向端门槛或新托盘墙，不改变支承合同',
      exactPixelMatchRequired: false, actualGeometryCalibrated: false,
      referenceOnly: true, printedGuideTextAllowed: false, addedArrowsAllowed: false,
    },
  });
}

const unchangedScenes = [];
for (const b of request.beats.filter((b) => b.paperScene)) {
  const original = structuredClone(source.beats.find((old) => old.id === b.id).paperScene);
  delete original.motionContract.semanticReview;
  if (!changedIds.includes(b.id)) {
    assert.deepEqual(b.paperScene, original);
    unchangedScenes.push({beatId: b.id, sceneSha256: sha256Json(original), mechanismSha256: sha256Json(paperMechanismSnapshot(original)),
      firstFramePromptSha256: sha256Json(original.prompt.firstFrame), motionPromptSha256: sha256Json(original.prompt.motion)});
  } else {
    const comparable = structuredClone(b.paperScene);
    comparable.objectGroups.forEach((g, i) => {g.material = original.objectGroups[i].material;});
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
  ...['首帧提示词.md', 'revision-scope.v1.json', '导演投影修复交付回执.v1.json', '交付SHA256.txt'].map((n) => path.join(previous, n))];
const production = path.join(previous, 'first-frame-production-r1');
const preserved = [
  ['first-frames/P02_B07_first-frame.png', 'd4cec7422cb41a49b50a00f3dd1a8a9b4023664e74f13c90d0220aec56410a44'],
  ['text-baked-first-frames/P02_B07_first-frame-text-baked.png', '35f7a03b0d5b1867efc9770c84ae2ac16df6021e30405aa5218169258fdafb25'],
  ['P02.layout-reference.v1.png', 'fb18bc1099aaba252ef7360bd009f0d08fec502804ee1ea8bb93b23f22360b7a'],
].map(([name, expected]) => {
  const binding = bind(path.join(production, name));
  assert.equal(binding.sha256, expected, name);
  return binding;
});
writeNew('r3-immutable-signed-inputs.v1.json', {schemaVersion: 'koubo-immutable-snapshot/v1', recordedAt: new Date().toISOString(),
  scope: '只绑定旧导演签发文件与P02已确认的三个图像文件；不改写旧执行manifest/回执，不递归纳入并行更新目录',
  files: [...new Set(signedPaths)].map(bind), preservedP02Images: preserved});
writeNew('director-request.unbound.v1.json', request);
writeNew('projection-derivation.v1.json', {schemaVersion: 'koubo-paper-projection-derivation/v1', revisionId: request.revisionId,
  sourceRequest: bind(sourcePath), changedProjectedBeatIds: changedIds, inheritedProjectedBeatIds: ['B07'],
  unprojectedBeatIds: ['B11', 'B15', 'B17'], scenes: derivations,
  limitations: ['规划投影和参考不等于实际生成图测量', '真实安全区、通道与支架遮挡须由下游看图核验',
    'P02保持原图、烘焙图及原始来源，不伪造r4重新生成或验收记录',
    'P04-P06本轮只读，不因未改而视为已生成或动态通过', '图片合格不代替动态试验及用户正常速度验收'],
  generatedMedia: false, formalAuthorized: false});
writeNew('revision-scope.v1.json', {schemaVersion: 'koubo-director-revision-scope/v1', revisionId: request.revisionId,
  parentRequest: bind(sourcePath), changedSceneIds: ['P01', 'P03'], preservedImageSceneIds: ['P02'],
  readonlySceneIds: ['P04', 'P05', 'P06'], unchangedScenes,
  preserved: ['原稿22段逐字不变', '全部节点文字、标签绑定、物件身份与核心语义不变',
    '全部毫米合同、动作类型/顺序/时长不变', 'P02/P04/P05/P06完整场景（不含新审阅绑定）及提示词不变'],
  changed: ['P01齐平开放双接收垫与底台内缩边界', 'P03初态平放折页与平行分离路线',
    'P01/P03同源投影与派生动作矩形', '两镜材料字段及编译提示词同步', '新revision独立审阅及编译签发'],
  status: 'awaiting-independent-mechanism-review',
  executionScope: {executorThreadId: '01a05ce8-84ee-7112-bbc5-309c3e660c77',
    imageGenerationsAllowedAfterSignedHandoff: {P01: 1, P03: 1}, retryAllowed: false,
    preserveP02Provenance: true, generateP04ToP06: false, videoGeneration: false, upload: false, payment: false},
  generatedImages: false, generatedVideos: false, formalAuthorized: false});
console.log(JSON.stringify({requestPath: path.join(output, 'director-request.unbound.v1.json'), changedIds, unchangedScenes, generatedMedia: false}));
