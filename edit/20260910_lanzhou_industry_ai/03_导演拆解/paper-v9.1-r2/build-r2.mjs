import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {renderMotionFirstFrame, renderMotionAction, renderMotionPrompt} from '../../../../skills/koubo-remotion-director/scripts/paper-motion-contract.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const previous = path.join(path.dirname(output), 'paper-v9.1-r1');
const relative = (file) => path.relative(root, file);
const writeNew = (name, document) => {
  const file = path.join(output, name);
  if (existsSync(file)) throw new Error(`REFUSE_OVERWRITE:${file}`);
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, {flag: 'wx'});
};
const source = JSON.parse(readFileSync(path.join(previous, 'director-request.v2.json'), 'utf8'));
const request = structuredClone(source);
request.revisionId = '20260910-lanzhou-industry-ai-paper-v9.1-r2';
request.requestId = `${request.revisionId}-pre-shoot`;
request.policy.physicalContinuityVersion = '1';
for (const key of Object.keys(request.outputs)) {
  request.outputs[key] = relative(path.join(output, path.basename(request.outputs[key])));
}

// Authored tabletop dimensions, not measurements or assertions about a generated image.
const dimensions = {
  B04: {sales: [40, 20, 3], store: [40, 20, 3]},
  B07: {draft: [50, 24, 4], lever: [40, 20, 20]},
  B10: {leaflet: [40, 18, 3], inquiry: [40, 18, 3]},
  B11: {portfolio: [80, 80, 4]},
  B15: {reserve: [40, 30, 3], work: [50, 50, 4]},
  B17: {scope: [40, 20, 3], cooperation: [40, 20, 3]},
};
const dock = (id, groupId, xMm, yMm, supportHeightMm, openingWidthMm, openingHeightMm = 12) =>
  ({id, groupId, xMm, yMm, supportHeightMm, openingWidthMm, openingHeightMm});
function physicalFor(beat) {
  const contract = beat.paperScene.motionContract;
  const physical = {
    schemaVersion: 'koubo-paper-physical-contract/v1', coordinateSystem: 'tabletop-mm', minimumClearanceMm: 2,
    inventory: contract.parts.filter((p) => p.kind === 'blank-part').map((p) => {
      const [width, depth, height] = dimensions[beat.id][p.id];
      return {partId: p.id, quantity: 1, unit: 'rigid-assembly', envelopeMm: {width, depth, height}};
    }),
    stations: beat.paperScene.objectGroups.map((g) => ({groupId: g.id,
      initialPartIds: contract.initialLocations.filter((p) => p.groupId === g.id).map((p) => p.partId)})),
    docks: [], supports: [], obstacles: [], transfers: [],
  };
  if (beat.id === 'B07') {
    physical.docks = [80, 200, 320, 440].map((x, i) => dock(`draft-G${i + 1}`, `G${i + 1}`, x, 130, 20, 32));
    physical.supports = [[50, 90], [140, 120], [260, 120], [380, 90]].map(([xMm, widthMm], i) =>
      ({id: `deck-G${i + 1}`, xMm, yMm: 112, widthMm, depthMm: 36, topHeightMm: 20}));
    physical.obstacles = [
      {id: 'owner-behind-lane', xMm: 290, yMm: 20, zMm: 20, widthMm: 55, depthMm: 35, heightMm: 80},
      {id: 'lever-full-rotation-envelope', xMm: 305, yMm: 65, zMm: 20, widthMm: 40, depthMm: 20, heightMm: 20},
    ];
    physical.transfers = contract.actions.filter((a) => a.fromGroupId !== a.toGroupId).map((a) => ({
      actionId: a.id, fromDockId: `draft-${a.fromGroupId}`, toDockId: `draft-${a.toGroupId}`,
      supportIds: physical.supports.map((s) => s.id),
    }));
    return physical;
  }
  const lanes = {
    B04: [{actionId: 'A1', from: 100, to: 400, y: 100, height: 20}, {actionId: 'A2', from: 250, to: 400, y: 150, height: 20}],
    B10: [{actionId: 'A1', from: 100, to: 400, y: 100, height: 20}, {actionId: 'A2', from: 400, to: 250, y: 150, height: 20}],
    B11: [],
    B15: [{actionId: 'A3', from: 250, to: 400, y: 150, height: 20}],
    B17: [{actionId: 'A1', from: 80, to: 320, y: 100, height: 20}, {actionId: 'A2', from: 200, to: 320, y: 150, height: 35}],
  }[beat.id];
  for (const lane of lanes) {
    const action = contract.actions.find((a) => a.id === lane.actionId);
    const size = physical.inventory.find((p) => p.partId === action.partId).envelopeMm;
    const margin = 4;
    physical.docks.push(dock(`${action.id}-from`, action.fromGroupId, lane.from, lane.y, lane.height, size.depth + 2 * margin),
      dock(`${action.id}-to`, action.toGroupId, lane.to, lane.y, lane.height, size.depth + 2 * margin));
    physical.supports.push({id: `${action.id}-lane`, xMm: Math.min(lane.from, lane.to) - size.width / 2 - margin,
      yMm: lane.y - size.depth / 2 - margin, widthMm: Math.abs(lane.to - lane.from) + size.width + margin * 2,
      depthMm: size.depth + margin * 2, topHeightMm: lane.height});
    physical.transfers.push({actionId: action.id, fromDockId: `${action.id}-from`, toDockId: `${action.id}-to`, supportIds: [`${action.id}-lane`]});
  }
  return physical;
}

for (const beat of request.beats.filter((b) => b.paperScene)) {
  const scene = beat.paperScene;
  if (beat.id === 'B07') {
    const materials = [
      '暖白无字回答纸页组成唯一一叠刚性组合，只放在最左平放收集垫；垫边与连续输送面齐平，没有前唇和侧挡板',
      '深蓝平放整理垫，初始没有纸页；它不是竖立文件架，没有竖直隔板，左右开放，与两侧收集垫及核对垫共用同高连续承托面',
      '暖白平放核对垫，接纸位置初始空着；无脸纸质老板站在后方，双手空着；唯一无字控制杆与独立转轴在后侧，其完整旋转包络不触及出纸通道，不压纸、不留印记',
      '暖黄色平放接收展示垫，初始完全空着，没有预置白纸、背板或成品；没有竖立取景框和垂直插槽，左端开放，供同一叠纸水平滑入后平放展示',
    ];
    const names = ['老板回答收集垫', 'AI平放整理垫', '老板人工核对垫', '对外内容平放展示垫'];
    scene.objectGroups.forEach((group, index) => {
      group.name = names[index];
      group.material = `${materials[index]}；本组上沿正面有且仅有一张暖白空白牌，采用独立不活动支架，位于滑道后上方。四站承托面同高，三层空间由后景纸层、老板和独立标签形成，不设置输送台阶。`;
    });
  }
  scene.motionContract.physicalContract = physicalFor(beat);
  delete scene.motionContract.semanticReview;
  scene.stages.forEach((stage, index) => {stage.action = renderMotionAction(scene, scene.motionContract.actions[index]);});
  scene.prompt.firstFrame = renderMotionFirstFrame(scene);
  scene.prompt.motion = renderMotionPrompt(scene);
  const original = source.beats.find((b) => b.id === beat.id).paperScene;
  assert.deepEqual(scene.nodes, original.nodes);
  assert.deepEqual(scene.textPlan, original.textPlan);
  assert.deepEqual(scene.motionContract.actions, original.motionContract.actions);
  assert.deepEqual(scene.motionContract.meaning, original.motionContract.meaning);
  if (beat.id !== 'B07') assert.deepEqual(scene.objectGroups, original.objectGroups);
}
assert.deepEqual(request.beats.map((b) => b.spokenLine), source.beats.map((b) => b.spokenLine));

function snapshot(directory) {
  return readdirSync(directory, {withFileTypes: true}).filter((e) => e.name !== '.DS_Store').flatMap((e) => {
    const file = path.join(directory, e.name);
    return e.isDirectory() ? snapshot(file) : [{path: relative(file), sha256: sha256File(file)}];
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
writeNew('r1-immutable-inputs.v1.json', {schemaVersion: 'koubo-immutable-snapshot/v1', recordedAt: new Date().toISOString(), files: snapshot(previous)});
writeNew('director-request.v1.json', request);
writeNew('revision-scope.v1.json', {schemaVersion: 'koubo-director-revision-scope/v1', revisionId: request.revisionId,
  parentRequest: {path: relative(path.join(previous, 'director-request.v2.json')), sha256: sha256File(path.join(previous, 'director-request.v2.json'))},
  preserved: ['22段原文逐字不变', '六镜中文节点与textPlan不变', '六镜动作类型、对象、顺序、时长不变', 'P01/P03/P04/P05/P06物件组原样保留'],
  changed: ['P02四站材质和形态改为同高连续平放机构', '六镜补充活动件总数、各站初态及可计算通道合同', '所有提示词从当前合同重新编译，旧独立审阅不继承'],
  status: 'awaiting-independent-mechanism-review', generatedImages: false, generatedVideos: false,
  userImageAcceptance: 'pending', userDynamicAcceptance: 'pending', formalAuthorized: false});
console.log(JSON.stringify({requestPath: path.join(output, 'director-request.v1.json'), paperScenes: 6, generatedMedia: false}));
