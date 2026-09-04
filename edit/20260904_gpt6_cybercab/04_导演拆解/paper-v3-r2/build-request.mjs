import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {validatePreproductionRequest} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../../../');
const priorDir = path.join(dir, '../paper-v3-r1');
const relative = value => path.relative(root, value);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeNew = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
const priorRequestPath = path.join(priorDir, 'director-preproduction-request.v1.json');
const stopPath = path.join(priorDir, 'first-frame-qa/generation-stop-receipt.v1.json');
assert.equal(hash(priorRequestPath), 'cf0f52cd0137c1a5fac0617f53a6a01492bed53a4ae19444c5e0679fdd1f5648');
assert.equal(hash(stopPath), 'a18b47d426902c38e3b76d5c739a3f7de05f7c1c75c96e82e47d08d3c3b91113');
const prior = readJson(priorRequestPath);
const profile = readJson(path.join(root, 'workflow/active-director-profile.v1.json'));
const templatePath = path.join(root, 'skills/koubo-remotion-director/templates/director-preproduction-request.v1.json');
const request = readJson(templatePath);
request.requestId = '20260904-gpt6-cybercab-paper-v3-r2';
request.taskId = '20260904-gpt6-cybercab-paper-assets';
request.inputScript = structuredClone(prior.inputScript);
request.sourceMediaBinding = structuredClone(prior.sourceMediaBinding);
request.directorProfile.profileVersion = profile.profileVersion;
request.beats = structuredClone(prior.beats);
request.outputs = Object.fromEntries(Object.entries(prior.outputs).map(([key, value]) => [key, relative(path.join(dir, path.basename(value)))]));
request.authorization = {
  ...prior.authorization,
  userQuote: '好的，继续',
  confirmedProposal: '先只修正P01/P02，验证通过后再继续整批；不启动付费视频生成。',
  scope: '受控修订P01/P02构图与数量约束，各试图一次；原样保留其余四镜。两张通过后继续原定P05样图，带字样图须用户确认后再做剩余三镜。',
  automaticRetryAllowed: false,
};
request.revisionOf = {requestId: prior.requestId, path: relative(priorRequestPath), sha256: hash(priorRequestPath)};
request.revisionTrigger = {path: relative(stopPath), sha256: hash(stopPath), originalStatus: 'revision-required'};

const p1 = request.beats[0].paperScene;
const p2 = request.beats[1].paperScene;
const style = prior.beats[0].paperScene.prompt.firstFrame.split('\n')[0];
const blank = '基础图中所有标签和纸片表面纯空白，无图形无印记，不生成可读文字、数字、字母、符号、Logo或水印。只出现明确列出的工作物件，不新增笔筒、笔、盆栽、云朵、圆点或装饰性小物。四张独立标签必须全部完整可见，留足后续写字空间。';

p1.objectGroups[4].material = '仅限画面右侧的前景瓦楞轨道和暖白连接纸桥，左端止于电脑底座，不跨越左右空白间隔';
p1.labelBindingPolicy.unlabeledObjectGroups[0].reason = '路径桥只连接右侧电脑、浏览器与软件工位；左侧对话出口完全隔离，桥上不增加第五张牌。';
p1.stages[4].action = '只在右侧扣合电脑、浏览器与软件之间的前景纸桥；左侧空白间隔全程保留，无任何跨越连接';
p1.prompt.firstFrame = `${style}\n35度斜俯视微缩纸艺工作台，所有物件及四张牌都收在画面横向5%至95%、纵向10%至78%以内。底部22%只留无物件的台面，确保16%字幕区前仍有缓冲。\n画面分成两个独立实体岛：左岛占横向5%至28%，只有对话出口及一个独立浅托盘；右岛占42%至95%，从左向右依次是电脑、浏览器、业务软件抽屉。横向29%至41%是一条从前景贯穿后景的纯空白台面间隔，左右底座也断开，观众能看见两岛之间连续露出的桌面。连接轨道完全位于右岛，只连接电脑到浏览器再到软件；左岛没有任何桥、棉线、薄片或底座通向右岛。\n四張独立牌由左向右完整陈列，大小接近，面向镜头：左岛对话托盘前面一张；右岛电脑底座前面一张；右岛浏览器纸框下方另外一张有纸厚的独立立牌；右岛软件抽屉正前面一张。浏览器的屏幕本身不是标签，屏幕下方必须另有清楚分开的纸牌。四牌各自占横向7%至26%、43%至56%、61%至74%、79%至94%，纵向均约65%至76%。背景只有叠层素色卡纸。一个无字珊瑚红任务滑块停在右岛电脑起点，左岛回答薄片在本托盘内。\n${blank}`.replace('四張', '四张');
p1.prompt.motion = prior.beats[0].paperScene.prompt.motion
  .replace('4.7至5.7秒前景连接桥轻扣合', '4.7至5.7秒仅右侧电脑、浏览器、软件之间的连接桥轻扣合')
  + '\n左右底座之间的空白台面贯穿前后并全程保持；任何纸件、桥、棉线和影子实体都不横跨间隔。浏览器下方独立牌必须保留，不能并入屏幕或与电脑牌合并。四牌和工作物件始终保持在上方78%区域内。';

p2.objectGroups[2].material = '一个三槽灰绿资料座，且仅有三张独立资料纸：一张灰绿、一张暖白、一张工业灰；三张完整上边缘和侧边可数，彼此不遮成纸堆';
p2.labelBindingPolicy.unlabeledObjectGroups[0].reason = '资料归集只有三张可数的无字资料与一个三槽资料座，不设标签牌；另一个珊瑚红任务薄片只在左侧任务入口，不计作资料，也不能插进资料座。';
p2.stages[2].action = '资料座中仅有的灰绿、暖白、工业灰三张薄片先后汇入资料通道，独立珊瑚红任务薄片沿相邻任务槽同步推进，不新增第四份资料';
p2.prompt.firstFrame = `${style}\n斜俯视一座S形实体纸艺工作台，五个工位从左到右绕经前景：左侧任务入口、电脑操作、后侧资料座、前侧检视窗、右侧空交付盒。整座底板、所有物件和四张标签均完整收在画面横向5%至95%、纵向10%至78%。画面下方22%是一整条空白台面，连底板、标签底边及纸张都不侵入，为16%字幕安全区多留6%缓冲。\n左入口只放一个窄珊瑚红任务薄片。中后方的资料座是三个彼此分开的浅槽，严格只有三张竖立的资料纸：从左到右一张灰绿、一张暖白、一张工业灰，每张上边缘和侧边都完整可数，中间有空隙。这三张资料纸没有其他背衬纸、夹页或叠层纸堆；珊瑚红任务薄片留在远处左入口，绝不插进资料座。检视窗为刚性空框及一块无字透明片，首帧交付盒为空，前景不散放额外纸张。\n严格四张独立空白标签，逐一固定在任务入口前沿、电脑底座前沿、前景检视窗下沿、交付盒前面；资料座完全不配牌。四牌正面接近朝向镜头，每张可写入四个中文大字。四牌的最低边缘均在画面高度76%以内，不使用照片下沿的空白台面摆牌。背景只有素色叠层卡纸。\n${blank}`;
p2.prompt.motion = prior.beats[1].paperScene.prompt.motion
  .replace('三份无字资料顺次汇入文件槽', '资料座内仅有的灰绿、暖白、工业灰三张无字资料顺次汇入文件槽，不能增加第四张')
  + '\n独立珊瑚红任务薄片与三张资料分开走槽，不复制为资料。所有纸牌、抽屉伸出和底板运动均限制在画面上方78%区域，底部22%留空。禁止增加笔筒、散纸、图形或印记；整个过程只能使用首帧已存在的三张资料。';

const setQuads = (scene, rects) => scene.textPlan.forEach((label, i) => {
  const [left, top, right, bottom] = rects[i];
  label.anchorQuad = [[left, top], [right, top], [right, bottom], [left, bottom]];
});
setQuads(p1, [[0.07,0.65,0.26,0.76],[0.43,0.65,0.56,0.76],[0.61,0.65,0.74,0.76],[0.79,0.65,0.94,0.76]]);
setQuads(p2, [[0.06,0.55,0.24,0.66],[0.28,0.35,0.48,0.46],[0.49,0.65,0.69,0.76],[0.74,0.46,0.94,0.57]]);

// Restrict this revision to the two failed scenes; preserve speech and label identity.
const changes = (before, after, prefix = '') => {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => changes(before[key], after[key], prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
};
const changedBeatPaths = changes(prior.beats, request.beats);
assert(changedBeatPaths.length > 0);
assert(changedBeatPaths.every(value => /^[01]\.paperScene\.(prompt\.(firstFrame|motion)|objectGroups\.\d+\.material|labelBindingPolicy\.unlabeledObjectGroups\.0\.reason|stages\.\d+\.action|textPlan\.\d+\.anchorQuad\.)/.test(value)));
assert.deepEqual(prior.beats.slice(2), request.beats.slice(2));
request.beats.forEach((beat, i) => {
  assert.equal(beat.spokenLine, prior.beats[i].spokenLine);
  assert.deepEqual(beat.paperScene.nodes, prior.beats[i].paperScene.nodes);
  assert.deepEqual(beat.paperScene.textPlan.map(({anchorQuad, ...label}) => label), prior.beats[i].paperScene.textPlan.map(({anchorQuad, ...label}) => label));
});
const validation = validatePreproductionRequest({request, projectRoot: root, profile});
assert(validation.ok, validation.errors.join('\n'));
const snapshot = directory => fs.readdirSync(directory, {withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
  const file = path.join(directory, entry.name);
  if (entry.isDirectory()) return snapshot(file);
  assert(entry.isFile(), `Unexpected non-file: ${file}`);
  return [{path:relative(file), sha256:hash(file)}];
});
writeNew('r1-immutable-snapshot.v1.json', {schemaVersion:'koubo-revision-source-snapshot/v1', files:snapshot(priorDir)});
writeNew('revision-diff-receipt.v1.json', {
  schemaVersion:'koubo-paper-revision-diff/v1', requestId:request.requestId,
  sourceTemplate:{path:relative(templatePath),sha256:hash(templatePath)},
  previousRequest:request.revisionOf, failureEvidence:request.revisionTrigger,
  changedSceneIds:['P01','P02'], unchangedSceneIds:['P03','P04','P05','P06'],
  changedBeatPaths, spokenLinesUnchanged:true, labelTextAndBindingsUnchanged:true,
  actualAnchorCalibrationStillRequired:true, sharedSkillModified:false,
  expectedTests:['four-separate-labels','P01-left-right-isolation','P02-three-document-sheets','all-labels-above-caption-zone'],
  actualImageTestsPassed:false, maximumControlledCallsForFailedScenes:2, automaticRetryAllowed:false,
});
writeNew('director-preproduction-request.v1.json', request);
console.log(JSON.stringify({ok:true,requestId:request.requestId,changedScenes:2,unchangedScenes:4,requestPath:path.join(dir,'director-preproduction-request.v1.json')}));
