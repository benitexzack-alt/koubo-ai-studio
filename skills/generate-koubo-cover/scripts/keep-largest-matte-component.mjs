import path from 'node:path';
import {createRequire} from 'node:module';

const [inputArg, outputArg, thresholdArg = '12'] = process.argv.slice(2);

if (!inputArg || !outputArg) {
  console.error('用法：node keep-largest-matte-component.mjs <input.png> <output.png> [alpha-threshold]');
  process.exit(1);
}

const projectRoot = process.cwd();
const requireFromRemotion = createRequire(path.join(projectRoot, 'remotion/package.json'));
const sharp = requireFromRemotion('sharp');
const inputPath = path.resolve(projectRoot, inputArg);
const outputPath = path.resolve(projectRoot, outputArg);
const threshold = Math.max(1, Math.min(254, Number(thresholdArg)));

const {data, info} = await sharp(inputPath).ensureAlpha().raw().toBuffer({resolveWithObject: true});
const {width, height, channels} = info;
const pixelCount = width * height;
const labels = new Int32Array(pixelCount);
const queue = new Int32Array(pixelCount);
let label = 0;
let largestLabel = 0;
let largestSize = 0;

const alphaAt = (index) => data[index * channels + 3];

for (let index = 0; index < pixelCount; index += 1) {
  if (labels[index] !== 0 || alphaAt(index) < threshold) continue;

  label += 1;
  let head = 0;
  let tail = 0;
  let size = 0;
  queue[tail] = index;
  tail += 1;
  labels[index] = label;

  while (head < tail) {
    const current = queue[head];
    head += 1;
    size += 1;
    const x = current % width;
    const y = Math.floor(current / width);
    const neighbors = [
      x > 0 ? current - 1 : -1,
      x + 1 < width ? current + 1 : -1,
      y > 0 ? current - width : -1,
      y + 1 < height ? current + width : -1,
    ];

    for (const neighbor of neighbors) {
      if (neighbor < 0 || labels[neighbor] !== 0 || alphaAt(neighbor) < threshold) continue;
      labels[neighbor] = label;
      queue[tail] = neighbor;
      tail += 1;
    }
  }

  if (size > largestSize) {
    largestSize = size;
    largestLabel = label;
  }
}

if (largestLabel === 0) {
  throw new Error('未找到可保留的人物透明组件。');
}

for (let index = 0; index < pixelCount; index += 1) {
  if (labels[index] !== largestLabel) data[index * channels + 3] = 0;
}

await sharp(data, {raw: {width, height, channels}})
  .png({compressionLevel: 9})
  .toFile(outputPath);

console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  threshold,
  componentCount: label,
  largestPixels: largestSize,
  largestRatio: Number((largestSize / pixelCount).toFixed(4)),
}, null, 2));
