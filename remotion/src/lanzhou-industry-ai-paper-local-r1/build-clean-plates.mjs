import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectDir = path.resolve(import.meta.dirname, '../..');
const assetDir = path.join(
  projectDir,
  'public/lanzhou-industry-ai-paper-local-r1',
);

const featheredPatch = async ({
  input,
  source,
  target,
  feather = 14,
}) => {
  const extracted = await sharp(input)
    .extract(source)
    .resize(target.width, target.height, {fit: 'fill'})
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});

  const rgba = Buffer.alloc(target.width * target.height * 4);
  const maxX = target.width - 1;
  const maxY = target.height - 1;

  for (let y = 0; y < target.height; y += 1) {
    for (let x = 0; x < target.width; x += 1) {
      const sourceOffset = (y * target.width + x) * 3;
      const targetOffset = (y * target.width + x) * 4;
      const edgeDistance = Math.min(x, y, maxX - x, maxY - y);
      const alpha = Math.round(
        255 * Math.min(1, Math.max(0, edgeDistance / feather)),
      );

      rgba[targetOffset] = extracted.data[sourceOffset];
      rgba[targetOffset + 1] = extracted.data[sourceOffset + 1];
      rgba[targetOffset + 2] = extracted.data[sourceOffset + 2];
      rgba[targetOffset + 3] = alpha;
    }
  }

  return {
    input: await sharp(rgba, {
      raw: {width: target.width, height: target.height, channels: 4},
    })
      .png()
      .toBuffer(),
    left: target.left,
    top: target.top,
  };
};

const build = async ({sourceName, outputName, patches}) => {
  const input = path.join(assetDir, sourceName);
  const composites = [];

  for (const patch of patches) {
    composites.push(await featheredPatch({input, ...patch}));
  }

  await sharp(input)
    .composite(composites)
    .png({compressionLevel: 9, adaptiveFiltering: true})
    .toFile(path.join(assetDir, outputName));
};

await build({
  sourceName: 'P04_B11_first-frame-text-baked.png',
  outputName: 'P04_B11_clean-plate.png',
  patches: [
    {
      source: {left: 700, top: 292, width: 286, height: 54},
      target: {left: 665, top: 286, width: 330, height: 184},
      feather: 9,
    },
    {
      source: {left: 660, top: 461, width: 100, height: 160},
      target: {left: 638, top: 436, width: 388, height: 188},
      feather: 9,
    },
  ],
});

await build({
  sourceName: 'P05_B15_first-frame-text-baked.png',
  outputName: 'P05_B15_clean-plate.png',
  patches: [
    {
      source: {left: 118, top: 401, width: 34, height: 63},
      target: {left: 315, top: 397, width: 199, height: 72},
      feather: 6,
    },
    {
      source: {left: 884, top: 451, width: 278, height: 151},
      target: {left: 649, top: 451, width: 542, height: 151},
      feather: 12,
    },
  ],
});

await sharp(path.join(assetDir, 'P04_B11_first-frame-text-baked.png'))
  .extract({left: 815, top: 400, width: 54, height: 124})
  .resize(128, 128, {fit: 'fill'})
  .png({compressionLevel: 9})
  .toFile(path.join(assetDir, 'P04-paper-texture.png'));

await sharp(path.join(assetDir, 'P05_B15_first-frame-text-baked.png'))
  .extract({left: 708, top: 483, width: 96, height: 58})
  .resize(128, 128, {fit: 'fill'})
  .png({compressionLevel: 9})
  .toFile(path.join(assetDir, 'P05-paper-texture.png'));

console.log('Built isolated clean plates:', assetDir);
