#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  PAPER_CONTACT_SHEET_SCHEMA,
  validatePaperAssetIntake,
} from './paper-asset-intake-core.mjs';
import {resolveDeclared, sha256File} from './preproduction-director-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');
const values = {};
for (let index = 2; index < process.argv.length; index += 1) {
  if (!process.argv[index].startsWith('--')) continue;
  values[process.argv[index].slice(2)] = process.argv[index + 1];
  index += 1;
}

const run = (binary, args, code) => {
  const result = spawnSync(binary, args, {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (result.error || result.status !== 0) {
    throw new Error(`${code}:${String(result.stderr ?? result.error?.message ?? '').trim()}`);
  }
};

const projectRoot = path.resolve(values['repo-root'] ?? defaultProjectRoot);
const requestPath = resolveDeclared(projectRoot, values.request);
let temporaryRoot;
try {
  if (!requestPath || !existsSync(requestPath)) throw new Error('PAPER_ASSET_REQUEST_MISSING');
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  const validation = validatePaperAssetIntake({
    request,
    requestPath,
    projectRoot,
    requireContactSheet: false,
  });
  if (!validation.ok) {
    throw new Error(`PAPER_ASSET_DEFINITION_INVALID:${validation.errors.join('|')}`);
  }
  const outputPath = resolveDeclared(projectRoot, request.outputs.contactSheetPath);
  const manifestPath = resolveDeclared(projectRoot, request.outputs.contactSheetManifestPath);
  if (existsSync(outputPath) || existsSync(manifestPath)) {
    throw new Error('PAPER_ASSET_CONTACT_SHEET_OUTPUT_EXISTS');
  }
  const fontPath = resolveDeclared(projectRoot, request.contactSheetFontPath);
  if (!fontPath || !existsSync(fontPath)) throw new Error('PAPER_ASSET_CONTACT_SHEET_FONT_MISSING');
  temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'koubo-paper-contact-sheet-'));
  const cells = [];
  for (const [index, asset] of validation.orderedAssets.entries()) {
    const middle = asset.evidenceFrames.find((frame) => frame.moment === 'middle');
    const middlePath = resolveDeclared(projectRoot, middle.path);
    const cellPath = path.join(temporaryRoot, `cell-${String(index + 1).padStart(2, '0')}.png`);
    run(
      'magick',
      [
        middlePath,
        '-auto-orient',
        '-resize',
        '640x360^',
        '-gravity',
        'center',
        '-extent',
        '640x360',
        '-background',
        '#10171C',
        '-fill',
        '#FFFFFF',
        '-font',
        fontPath,
        '-pointsize',
        '28',
        '-gravity',
        'south',
        '-splice',
        '0x72',
        '-annotate',
        '+0+18',
        `${asset.sceneId}  ${asset.productionCandidate.sha256.slice(0, 12)}`,
        '-bordercolor',
        '#0B1014',
        '-border',
        '6',
        cellPath,
      ],
      'PAPER_ASSET_CONTACT_SHEET_CELL_FAILED',
    );
    cells.push({
      sceneId: asset.sceneId,
      productionCandidateSha256: asset.productionCandidate.sha256,
      middleFrameSha256: middle.sha256,
      cellPath,
    });
  }
  mkdirSync(path.dirname(outputPath), {recursive: true});
  const rowPaths = [];
  for (let index = 0; index < cells.length; index += 2) {
    const rowPath = path.join(temporaryRoot, `row-${String(rowPaths.length + 1).padStart(2, '0')}.png`);
    let rightPath = cells[index + 1]?.cellPath;
    if (!rightPath) {
      rightPath = path.join(temporaryRoot, 'empty-cell.png');
      run(
        'magick',
        ['-size', '652x444', 'xc:#0B1014', rightPath],
        'PAPER_ASSET_CONTACT_SHEET_EMPTY_CELL_FAILED',
      );
    }
    run(
      'magick',
      [cells[index].cellPath, rightPath, '+append', rowPath],
      'PAPER_ASSET_CONTACT_SHEET_ROW_FAILED',
    );
    rowPaths.push(rowPath);
  }
  run(
    'magick',
    [...rowPaths, '-append', outputPath],
    'PAPER_ASSET_CONTACT_SHEET_BUILD_FAILED',
  );
  const manifest = {
    schemaVersion: PAPER_CONTACT_SHEET_SCHEMA,
    taskId: request.taskId,
    request: {path: requestPath, sha256: sha256File(requestPath)},
    assetSetSha256: validation.assetSetSha256,
    image: {path: outputPath, sha256: sha256File(outputPath)},
    cells: cells.map(({cellPath: _cellPath, ...cell}) => cell),
    ordering: 'source-plan-scene-order',
    filesystemSortUsed: false,
  };
  mkdirSync(path.dirname(manifestPath), {recursive: true});
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(JSON.stringify({ok: true, outputPath, manifestPath, assetSetSha256: validation.assetSetSha256}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (temporaryRoot) rmSync(temporaryRoot, {recursive: true, force: true});
}
