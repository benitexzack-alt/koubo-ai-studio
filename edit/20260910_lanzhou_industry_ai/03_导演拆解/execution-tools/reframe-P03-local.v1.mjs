import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

// 本轮仅处理已获用户批准的 P03，原图与导演包均保持只读。
const base = path.resolve(import.meta.dirname, '..');
const source = path.join(base, 'paper-v9.1-r4/first-frame-production-r1/first-frames/P03_B10_first-frame.png');
const outputRoot = path.join(base, 'paper-v9.1-r4/first-frame-local-reframe-P03-r1');
const output = path.join(outputRoot, 'first-frames/P03_B10_first-frame-reframed.png');
const receiptPath = path.join(outputRoot, 'local-reframe-receipt.v1.json');
const expectedSha = '0d5461b0a0304c2631c213d32260154c0c07e57c69f65229c91efd7d4394071c';
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const run = args => execFileSync('/opt/homebrew/bin/magick', args, {encoding: 'utf8'});
if (hash(source) !== expectedSha) throw new Error('源图哈希不匹配');
if (existsSync(output) || existsSync(receiptPath)) throw new Error('本轮产物已存在，禁止覆盖');
const dimensions = run(['identify', '-format', '%w %h', source]).trim();
if (dimensions !== '1672 941') throw new Error('源图尺寸变化');

const scale = 0.94, dx = 50.16, dy = 8.23;
const transform = ([x, y]) => [x * scale + dx, y * scale + dy];
// 源图实际观察包围盒，含约三像素估读余量，不使用计划坐标。
const sourceBounds = [82, 129, 1601, 744];
const mappedBounds = [...transform(sourceBounds.slice(0, 2)), ...transform(sourceBounds.slice(2))];
const safe = [66.88, 112.92, 1605.12, 715.16];
if (mappedBounds[0] < safe[0] || mappedBounds[1] < safe[1] || mappedBounds[2] > safe[2] || mappedBounds[3] > safe[3]) throw new Error('变换后仍越界');
const reflectedSourceEdgeWidths = [dx / scale, dy / scale, (1672 - (1672 * scale + dx)) / scale, (941 - (941 * scale + dy)) / scale];
const sourceClearEdges = [sourceBounds[0], sourceBounds[1], 1672 - sourceBounds[2], 941 - sourceBounds[3]];
if (reflectedSourceEdgeWidths.some((width, i) => width >= sourceClearEdges[i])) throw new Error('补边可能反射复制功能物件');

mkdirSync(path.dirname(output), {recursive: true});
const commandArgs = [source, '-filter', 'Lanczos', '-virtual-pixel', 'Mirror', '-define', 'distort:viewport=1672x941+0+0', '-distort', 'AffineProjection', `${scale},0,0,${scale},${dx},${dy}`, '+repage', output];
run(commandArgs);
if (hash(source) !== expectedSha) throw new Error('源图被改变');
if (run(['identify', '-format', '%w %h', output]).trim() !== dimensions) throw new Error('输出尺寸错误');
const receipt = {
  schemaVersion: 'koubo-paper-firstframe-local-reframe/v1',
  createdAt: new Date().toISOString(), sceneId: 'P03',
  status: 'geometry-transform-checked-awaiting-actual-visual-review',
  authority: {userQuote: '好的，那就抓紧落实。', acceptedProposal: '先用本地工具将P03整组等比缩小并补背景，不重绘、不裁掉底台和支脚，再检查质量。'},
  source: {path: source, sha256: expectedSha, width: 1672, height: 941},
  output: {path: output, sha256: hash(output), width: 1672, height: 941},
  transform: {scaleX: scale, scaleY: scale, translateX: dx, translateY: dy, rotationDegrees: 0, method: '全画面同一仿射，不单独改变任何物件比例', filter: 'Lanczos'},
  edgeFill: {method: 'Mirror', description: '仅将源图无物件的外边缘背景镜像延伸至输出画布；不得反射复制功能物件', reflectedSourceEdgeWidths, sourceClearEdges},
  geometryCheck: {sourceObservedBoundsWith3PxTolerance: sourceBounds, transformedBounds: mappedBounds, contentSafeBounds: safe, passed: true, actualVisualReviewRequired: true},
  tool: {path: '/opt/homebrew/bin/magick', version: run(['-version']).split('\n')[0], commandArgs},
  originalUnchanged: true, sourceDirectorPlanChanged: false, generatedImageCalls: 0, textBaked: false,
  actualMillimetreClearanceVerified: false, dynamicAccepted: false, runninghubActions: 0,
};
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, receiptPath, sha256: receipt.output.sha256, mappedBounds, reflectedSourceEdgeWidths}));
