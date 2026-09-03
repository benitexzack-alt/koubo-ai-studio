#!/usr/bin/env node

import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {JOB_SCHEMA, parseArgs, readJson, requiredSceneIds} from './firstframe-batch-core.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  const job = readJson(path.resolve(args.job));
  if (job.schemaVersion !== JOB_SCHEMA) throw new Error('FIRSTFRAME_JOB_SCHEMA_INVALID');
  const sceneIds = requiredSceneIds(job, args.phase);
  const scenes = sceneIds.map((sceneId) => job.scenes.find((scene) => scene.sceneId === sceneId));
  const imageKind = args['image-kind'] ?? 'raw';
  if (!['raw', 'text-baked'].includes(imageKind)) throw new Error(`IMAGE_KIND_INVALID:${imageKind}`);
  scenes.forEach((scene) => {
    const imagePath = imageKind === 'text-baked'
      ? scene?.deterministicTextBake?.outputPath
      : scene?.result?.imagePath;
    if (!imagePath || !existsSync(imagePath)) throw new Error(`IMAGE_RESULT_MISSING:${scene?.sceneId}`);
  });
  const columns = Math.ceil(Math.sqrt(scenes.length));
  const rows = Math.ceil(scenes.length / columns);
  const cellWidth = 640;
  const cellHeight = 360;
  const inputArgs = scenes.flatMap((scene) => ['-i', imageKind === 'text-baked'
    ? scene.deterministicTextBake.outputPath
    : scene.result.imagePath]);
  const filters = scenes.map((_, index) =>
    `[${index}:v]scale=${cellWidth}:${cellHeight}:force_original_aspect_ratio=decrease,pad=${cellWidth}:${cellHeight}:(ow-iw)/2:(oh-ih)/2:color=white[v${index}]`,
  );
  const layout = scenes.map((_, index) => `${(index % columns) * cellWidth}_${Math.floor(index / columns) * cellHeight}`).join('|');
  const inputs = scenes.map((_, index) => `[v${index}]`).join('');
  filters.push(`${inputs}xstack=inputs=${scenes.length}:layout=${layout}:fill=white[out]`);
  const outputPath = path.join(
    job.output.qaRoot,
    imageKind === 'text-baked'
      ? `${args.phase}-text-baked-contact-sheet.jpg`
      : `${args.phase}-contact-sheet.jpg`,
  );
  if (existsSync(outputPath)) throw new Error(`OUTPUT_ALREADY_EXISTS:${outputPath}`);
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', ...inputArgs,
    '-filter_complex', filters.join(';'), '-map', '[out]',
    '-frames:v', '1', '-q:v', '2', outputPath,
  ], {encoding: 'utf8'});
  if (result.status !== 0) throw new Error(`FFMPEG_CONTACT_SHEET_FAILED:${result.stderr.trim()}`);
  console.log(JSON.stringify({ok: true, outputPath, imageKind, sceneIds, width: columns * cellWidth, height: rows * cellHeight}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
