import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

// 仅本条 P01/P03 的布局参考。所有运动平面来自签发合同，不是最终材质图。
const [manifestArg, receiptArg, sceneId, outputArg] = process.argv.slice(2);
assert.ok(manifestArg && receiptArg && outputArg && ['P01', 'P03'].includes(sceneId));
const root = '/Users/pc/Documents/口播';
const manifestPath = path.resolve(manifestArg), receiptPath = path.resolve(receiptArg);
const outputRoot = path.resolve(outputArg);
for (const value of [manifestPath, receiptPath, outputRoot]) assert.ok(value.startsWith(root + '/'));
const read = p => JSON.parse(fs.readFileSync(p));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = read(manifestPath), validation = read(receiptPath);
assert.equal(validation.status, 'validated-provisional-previsualization');
assert.equal(validation.skillExecuted, true);
assert.equal(validation.revisionId, manifest.revisionId);
assert.equal(validation.artifacts.firstFramePromptManifest.sha256, sha(manifestPath));
const planBinding = validation.artifacts.plan;
assert.ok(planBinding.path.startsWith(root + '/'));
assert.equal(sha(planBinding.path), planBinding.sha256);
const entry = manifest.scenes.find(s => s.sceneId === sceneId);
assert.ok(entry);
const planScene = read(planBinding.path).paperScenes.find(s => s.beatId === entry.beatId);
assert.ok(planScene);
assert.deepEqual(entry.motionContract, planScene.motionContract);
assert.deepEqual(entry.layoutContract, planScene.layoutContract);
const scene = {...planScene, ...entry};
const pr = scene.motionContract.projectionContract;
assert.equal(pr?.schemaVersion, 'koubo-paper-projection/v1', '缺少本镜签发投影，不猜坐标');
const guidePath = path.join(path.dirname(planBinding.path), 'projection-derivation.v1.json');
const guideDoc = read(guidePath);
assert.equal(guideDoc.revisionId, manifest.revisionId);
const guideScene = guideDoc.scenes.find(s => s.sceneId === sceneId);
assert.ok(guideScene);
assert.deepEqual(guideScene.projectionContract, pr);
assert.equal(guideScene.physicalContractSha256, scene.physicalContractSha256);
assert.deepEqual(guideScene.referenceGuide.objectGroups, scene.objectGroups);
const guide = guideScene.referenceGuide;
const {derivePaperProjection, validatePaperProjectionContract} = await import(pathToFileURL(path.join(root, 'skills/koubo-remotion-director/scripts/paper-projection-contract.mjs')));
const derived = derivePaperProjection(scene);
assert.equal(derived.ok, true, JSON.stringify(derived.errors));
assert.deepEqual(validatePaperProjectionContract({scene}), []);
const W = pr.frame.width, H = pr.frame.height;
assert.equal(W, 1920); assert.equal(H, 1080);
const px = r => ({x: r.x * W, y: r.y * H, width: r.width * W, height: r.height * H});
const project = (x, y, z) => [pr.originX + pr.xScale * x, pr.originY + pr.yScale * y - pr.zScale * z];
const within = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const safe = px(scene.layoutContract.contentSafeRect);
const actionBoxes = derived.actionRects.map(row => {
  const signed = scene.motionContract.actions.find(a => a.id === row.actionId).sweptRect;
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(row.rect[key] - signed[key]) < 1e-8);
  const box = px(row.rect); assert.ok(within(box, safe));
  return {actionId: row.actionId, ...box};
});
const labels = scene.layoutContract.paperLabelSurfaceBoxes.map(row => {
  const r = px(row.box), box = {x: r.x + 18, y: r.y + 6, width: r.width - 36, height: r.height - 12};
  assert.ok(within(box, r)); assert.ok(within(box, safe));
  return {nodeId: row.nodeId, groupId: row.groupId, ...box};
});
assert.equal(labels.length, 3);
const firstActionY = Math.min(...actionBoxes.map(r => r.y));
const fixedBottom = firstActionY - 24;
assert.ok(Math.abs(fixedBottom - guide.rearStaticMaximumY) < 1e-8);
const fixedBoxes = labels.map(l => ({groupId: l.groupId, x: l.x + 10, y: l.y + l.height + 30, width: l.width - 20, height: fixedBottom - l.y - l.height - 30}));
fixedBoxes.forEach(box => {assert.ok(box.height >= 65, '静态布景空间不足，须回到导演布局'); assert.ok(within(box, safe));});
const stands = labels.flatMap(l => [l.x + 24, l.x + l.width - 42].map(x => ({x, y: l.y + l.height, width: 18, height: fixedBottom - l.y - l.height})));
for (const a of actionBoxes) for (const box of [...labels, ...fixedBoxes, ...stands]) assert.ok(!intersects(a, box), '参考静态件侵入动作区');
const body = [];
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const polygon = (pts, fill) => `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${fill}"/>`;
const plane = (x, y, w, d, z, fill) => polygon([[x, y, z], [x+w, y, z], [x+w, y+d, z], [x, y+d, z]].map(p => project(...p)), fill);
body.push(rect(0, 0, W, H, '#193553'));
const backgroundBoxes = labels.map((l, i) => ({x: l.x - 12, y: safe.y + 28 + i*7, width: l.width + 24, height: fixedBottom - safe.y - 28 - i*7}));
backgroundBoxes.forEach((b, i) => {assert.ok(within(b, safe)); body.push(rect(b.x, b.y, b.width, b.height, ['#213e60', '#294768', '#233f5c'][i]));});
const functionalBase = guide.functionalBaseFullOutline;
assert.ok(within(functionalBase, safe));
body.push(rect(functionalBase.x, functionalBase.y, functionalBase.width, functionalBase.height-12, '#2a4968'));
body.push(rect(functionalBase.x, functionalBase.y+functionalBase.height-12, functionalBase.width, 12, '#142f4b'));
stands.forEach(s => body.push(rect(s.x, s.y, s.width, s.height, '#caba9e')));
labels.forEach(l => body.push(rect(l.x+4, l.y+4, l.width, l.height, '#10253c', 'opacity=".25"'), rect(l.x, l.y, l.width, l.height, '#f2e9d8')));
fixedBoxes.forEach((b, i) => {
  if (sceneId === 'P01' && i < 2) {
    // 档案架/纸盒内的纸页为已声明静态布景，和前景活动组合分开。
    body.push(rect(b.x, b.y + 18, b.width, b.height - 18, i === 0 ? '#d4c6ac' : '#9c9b90'));
    for (let n=0; n<4; n++) body.push(rect(b.x+22+n*8, b.y+10+n*8, b.width-68, b.height-30-n*8, '#eee5d3'));
    body.push(rect(b.x, b.y + b.height - 24, b.width, 24, i === 0 ? '#c9bda6' : '#a19e92'));
  } else if (sceneId === 'P03' && i === 1) {
    // 产品/服务架初态完全空着，不把内容运输路线穿入货架。
    body.push(rect(b.x, b.y+20, b.width, b.height-20, '#b6a58a'));
    body.push(rect(b.x+12, b.y+30, b.width-24, b.height-42, '#e4d7bc'));
    body.push(rect(b.x+12, b.y+b.height/2, b.width-24, 9, '#aa9b83'));
    body.push(rect(b.x, b.y+b.height-13, b.width, 13, '#c9b798'));
  } else if (sceneId === 'P03' && i === 2) {
    const cx=b.x+b.width/2, top=b.y+3, radius=b.height*.16, bottom=b.y+b.height-18;
    body.push(`<circle cx="${cx}" cy="${top+radius}" r="${radius}" fill="#e8dbc3"/>`);
    body.push(polygon([[cx-radius,top+radius*2+4],[cx+radius,top+radius*2+4],[cx+radius*1.7,bottom],[cx-radius*1.7,bottom]], '#e8dbc3'));
    body.push(rect(b.x+20, bottom, b.width-40, 9, '#c6b69c'));
    body.push(rect(b.x+28, bottom+9, 13, 9, '#a79375'), rect(b.x+b.width-41, bottom+9, 13, 9, '#a79375'));
  }
});
const physical = scene.physicalContract;
assert.equal(physical.transfers.length, 2);
assert.equal(physical.inventory.length, 2);
const supportBoxes = [];
for (const support of physical.supports) {
  const [x, y] = project(support.xMm, support.yMm, support.topHeightMm);
  const box={x, y, width: support.widthMm*pr.xScale, height: support.depthMm*pr.yScale+7};
  assert.ok(within(box, safe), '参考支承面超出安全区');
  assert.ok(within(box, functionalBase), '支承面超出本镜功能底台参考框');
  supportBoxes.push({supportId: support.id, ...box});
  body.push(rect(x+3, y+box.height, box.width, 5, '#0e243d', 'opacity=".3"'));
  body.push(plane(support.xMm, support.yMm, support.widthMm, support.depthMm, support.topHeightMm, '#e5d8be'));
  const transfer = physical.transfers.find(t => t.supportIds.includes(support.id));
  assert.ok(transfer);
  const dock = physical.docks.find(d => d.id === transfer.toDockId);
  // 接收面仅换色，绝不增加横向挡沿或凹槽台阶。
  const receiveX = dock.xMm - 24, receiveEnd = Math.min(dock.xMm+24, support.xMm+support.widthMm);
  assert.ok(receiveX >= support.xMm && receiveEnd > receiveX);
  body.push(plane(receiveX, support.yMm, receiveEnd-receiveX, support.depthMm, support.topHeightMm, '#d6aa46'));
  const front = project(support.xMm, support.yMm+support.depthMm, support.topHeightMm);
  body.push(rect(front[0], front[1], box.width, 7, '#9e9077'));
}
const partBoxes=[];
for (const item of physical.inventory) {
  assert.equal(item.quantity, 1); assert.ok(item.envelopeMm.height <= 4);
  const station=physical.stations.find(s=>s.initialPartIds.includes(item.partId));
  const action=scene.motionContract.actions.find(a=>a.partId===item.partId && a.fromGroupId===station.groupId);
  // 动作的partId字段由上游合同决定；不根据纸片外观猜动作归属。
  const transfer=physical.transfers.find(t=>t.actionId===action?.id);
  assert.ok(transfer, '无法唯一定位初始运输对接点:'+item.partId);
  const dock=physical.docks.find(d=>d.id===transfer.fromDockId);
  const e=item.envelopeMm, x=dock.xMm-e.width/2, y=dock.yMm-e.depth/2;
  const top=project(x,y,dock.supportHeightMm+e.height);
  partBoxes.push({partId:item.partId,groupId:station.groupId,x:top[0],y:top[1],width:e.width*pr.xScale,height:e.depth*pr.yScale+e.height*pr.zScale,pose:'flat-transport-pose'});
  for(let n=1;n<=3;n++) {
    const z=dock.supportHeightMm+e.height*n/3;
    body.push(plane(x,y,e.width,e.depth,z,n===3?'#faf6ec':'#d9cfba'));
    const a=project(x,y+e.depth,z); body.push(rect(a[0],a[1],e.width*pr.xScale,1,'#b6a991'));
  }
}
for(const box of partBoxes) assert.ok(within(box,safe));
const names=[`${sceneId}.layout-reference.v1.svg`,`${sceneId}.layout-reference.v1.png`,`${sceneId}.layout-reference-check.v1.json`];
for(const name of names) assert.ok(!fs.existsSync(path.join(outputRoot,name)), '禁止覆盖:'+name);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body.join('\n')}</svg>`;
const sharp=createRequire(import.meta.url)(path.join(root,'remotion/node_modules/sharp'));
const png=await sharp(Buffer.from(svg)).png().toBuffer();
fs.mkdirSync(outputRoot,{recursive:true});
fs.writeFileSync(path.join(outputRoot,names[0]),svg,{flag:'wx'});
fs.writeFileSync(path.join(outputRoot,names[1]),png,{flag:'wx'});
const receipt={schemaVersion:'koubo-deterministic-layout-reference/v1',status:'reference-geometry-checked-not-final-image',sceneId,sourceRevisionId:manifest.revisionId,sourceManifest:{path:manifestPath,sha256:sha(manifestPath)},directorValidationReceipt:{path:receiptPath,sha256:sha(receiptPath)},referenceGuide:{path:guidePath,sha256:sha(guidePath)},physicalContractSha256:scene.physicalContractSha256,motionContractSha256:scene.motionContractSha256,projection:pr,layout:{labels,stands,fixedBoxes,backgroundBoxes,functionalBase,supportBoxes,partBoxes},actionBoxes,checks:{sameSignedProjection:true,allFunctionalObjectsInsideSafeArea:true,staticObjectsClearOfActionBoxes:true,receiversFlushWithTransportSurface:true,exactlyTwoInitialMovingAssemblies:true,initialMovingAssembliesFlat:true,noGeneratedText:true},limitations:'仅参考图的确定性几何检查；不是最终纸艺质量、真实毫米净空或动态通过。须独立看参考及实际生成图。',artifacts:names.slice(0,2).map(n=>({path:path.join(outputRoot,n),sha256:sha(path.join(outputRoot,n))})),createdAt:new Date().toISOString()};
fs.writeFileSync(path.join(outputRoot,names[2]),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({ok:true,sceneId,reference:receipt.artifacts[1],receipt:path.join(outputRoot,names[2])}));
