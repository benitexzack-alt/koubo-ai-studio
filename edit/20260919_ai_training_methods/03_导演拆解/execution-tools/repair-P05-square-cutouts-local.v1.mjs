import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const MAGICK = '/opt/homebrew/bin/magick';
const WIDTH = 1672;
const HEIGHT = 941;
const ROOT = '/Users/pc/Documents/口播/edit/20260919_ai_training_methods/03_导演拆解';
const SOURCE = path.join(
  ROOT,
  'firstframe-direct-text-r2/first-frames/rejected-attempts/P05_B25_attempt3-targeted-failed.png',
);
const SOURCE_SHA256 = '3cfe491cacd15f8fee21e236defc4643f6c34f57c5e77e05561328d3c0e1059a';
const DIRECTOR = path.join(ROOT, 'director-cues.v2.json');
const DIRECTOR_SHA256 = '73828ffe3dffdc0807b5a0b05247658bf6393be7e4d31206a5ac78aca9b55bf5';
const OUT = path.join(ROOT, 'firstframe-direct-text-r3');
const FRAME_DIR = path.join(OUT, 'first-frames');
const QA_DIR = path.join(OUT, 'first-frame-qa');
const LAYER_DIR = path.join(QA_DIR, 'local-composite-layers', 'P05');
const OUTPUT = path.join(FRAME_DIR, 'P05_B25_first-frame-direct-text-r3.png');
const RECEIPT = path.join(QA_DIR, 'P05.local-geometry-composite-receipt.v1.json');

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function magick(args) {
  return execFileSync(MAGICK, args, {encoding: 'utf8'}).trim();
}

function assertNew(file) {
  if (fs.existsSync(file)) throw new Error(`拒绝覆盖已有文件：${file}`);
}

function solveLinear(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('单应矩阵不可求解');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

function unitToQuadHomography(quad) {
  const unit = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const matrix = [];
  const vector = [];
  unit.forEach(([u, v], i) => {
    const [x, y] = quad[i];
    matrix.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    vector.push(x);
    matrix.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    vector.push(y);
  });
  const h = solveLinear(matrix, vector);
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}

function project(h, [u, v]) {
  const w = h[2][0] * u + h[2][1] * v + h[2][2];
  return [
    (h[0][0] * u + h[0][1] * v + h[0][2]) / w,
    (h[1][0] * u + h[1][1] * v + h[1][2]) / w,
  ];
}

function roundedQuad(quad) {
  return quad.map(([x, y]) => [Number(x.toFixed(4)), Number(y.toFixed(4))]);
}

if (!fs.existsSync(MAGICK)) throw new Error(`ImageMagick 不存在：${MAGICK}`);
if (sha256(SOURCE) !== SOURCE_SHA256) throw new Error('P05 源图 SHA-256 不匹配');
if (sha256(DIRECTOR) !== DIRECTOR_SHA256) throw new Error('导演包 SHA-256 不匹配');
const identify = magick(['identify', '-format', '%wx%h|%[channels]', SOURCE]);
if (!identify.startsWith(`${WIDTH}x${HEIGHT}|srgb`)) {
  throw new Error(`P05 源图尺寸或通道异常：${identify}`);
}

assertNew(OUTPUT);
assertNew(RECEIPT);
fs.mkdirSync(FRAME_DIR, {recursive: true});
fs.mkdirSync(LAYER_DIR, {recursive: true});

// 右侧浅蓝纸片四角来自 attempt3 的独立像素分割与边界拟合。
const rightPaperQuad = [
  [901.8, 274.0],
  [1362.7, 274.0],
  [1423.2, 569.0],
  [902.8, 569.0],
];
const h = unitToQuadHomography(rightPaperQuad);

// 左孔是已验证的唯一模板；右孔为待校正几何。所有数值均是相对各自纸面的归一化量。
const canonicalHole = {u: 0.49812, v: 0.46102, width: 0.22812, height: 0.23051};
const observedRightHole = {u: 0.51156, v: 0.46441, width: 0.23529, height: 0.23051};
const scaleU = canonicalHole.width / observedRightHole.width;
const scaleV = canonicalHole.height / observedRightHole.height;
const transformUv = ([u, v]) => [
  (u - observedRightHole.u) * scaleU + canonicalHole.u,
  (v - observedRightHole.v) * scaleV + canonicalHole.v,
];

// 补丁边界与孔保持足够距离，只包含浅蓝纸面，不触及字牌、练习册、底板或字幕区。
const sourcePatchUv = [[0.34, 0.30], [0.68, 0.30], [0.68, 0.70], [0.34, 0.70]];
const targetPatchUv = sourcePatchUv.map(transformUv);
const sourcePatchQuad = roundedQuad(sourcePatchUv.map((point) => project(h, point)));
const targetPatchQuad = roundedQuad(targetPatchUv.map((point) => project(h, point)));
const warped = path.join(LAYER_DIR, 'P05-right-paper-warped.png');
const mask = path.join(LAYER_DIR, 'P05-right-paper-feather-mask.png');
const layer = path.join(LAYER_DIR, 'P05-right-paper-correction-layer.png');
[warped, mask, layer].forEach(assertNew);

const perspectivePairs = sourcePatchQuad
  .map(([sx, sy], i) => `${sx},${sy} ${targetPatchQuad[i][0]},${targetPatchQuad[i][1]}`)
  .join(' ');
magick([
  SOURCE,
  '-alpha', 'on',
  '-filter', 'Lanczos',
  '-virtual-pixel', 'transparent',
  '-define', `distort:viewport=${WIDTH}x${HEIGHT}+0+0`,
  '-distort', 'Perspective', perspectivePairs,
  '+repage',
  warped,
]);

const polygon = targetPatchQuad.map(([x, y]) => `${x},${y}`).join(' ');
magick([
  '-size', `${WIDTH}x${HEIGHT}`,
  'xc:none',
  '-fill', 'white',
  '-draw', `polygon ${polygon}`,
  '-channel', 'A',
  '-blur', '0x5',
  '+channel',
  mask,
]);
magick([warped, mask, '-compose', 'DstIn', '-composite', layer]);
magick([SOURCE, layer, '-compose', 'Over', '-composite', `PNG24:${OUTPUT}`]);

const outputSha256 = sha256(OUTPUT);
const receipt = {
  schemaVersion: 'koubo-local-paper-geometry-composite/v1',
  sceneId: 'P05',
  beatId: 'B25',
  createdAt: new Date().toISOString(),
  method: '同一归一化方孔模板的确定性纸面透视局部合成',
  authorization: {
    path: path.join(OUT, 'P05-local-composite-authorization.v1.json'),
    userQuote: '·批准',
    allowedAction: 'P05-local-deterministic-geometry-compositing-only',
  },
  source: {path: SOURCE, sha256: SOURCE_SHA256, identify},
  directorPackage: {path: DIRECTOR, sha256: DIRECTOR_SHA256},
  measuredGeometry: {
    uncertaintyPixels: 2,
    canonicalLeftHole: canonicalHole,
    observedRightHole,
    beforeDelta: {
      u: Number((observedRightHole.u - canonicalHole.u).toFixed(5)),
      v: Number((observedRightHole.v - canonicalHole.v).toFixed(5)),
      width: Number((observedRightHole.width - canonicalHole.width).toFixed(5)),
      height: Number((observedRightHole.height - canonicalHole.height).toFixed(5)),
    },
    rightPaperQuad,
    sourcePatchUv,
    targetPatchUv: roundedQuad(targetPatchUv),
    sourcePatchQuad,
    targetPatchQuad,
  },
  operations: [
    '校验源图、导演包 SHA-256 和 1672x941 RGB 画布',
    '以左孔实测归一化中心与宽高作为唯一共享模板',
    '仅将右侧纸片孔周围的原生摄影纹理透视校正到模板位置',
    '5 像素羽化边界融合，然后以 PNG24 合成回原图',
  ],
  protectedContent: [
    '上次作业',
    '这次作业',
    '同一问题',
    '素色练习册',
    '底部字幕净区',
    'P01/P02/P03/P04/P06/P07 已通过首帧',
  ],
  output: {path: OUTPUT, sha256: outputSha256},
  intermediateLayers: [warped, mask, layer].map((file) => ({path: file, sha256: sha256(file)})),
  modelCalls: 0,
  runningHubConfigured: false,
  videoGenerated: false,
  paidAction: false,
  userAcceptance: 'pending',
  visualQa: 'pending',
};
fs.writeFileSync(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
console.log(JSON.stringify({output: OUTPUT, sha256: outputSha256, receipt: RECEIPT}, null, 2));
