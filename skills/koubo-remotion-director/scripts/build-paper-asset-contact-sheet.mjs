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
  PAPER_CONTACT_PAGE_SIZE,
  paperContactFrames,
  paperContactCellBinding,
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
  const incidentPrevention = validation.incidentPreventionVersion === '1';
  for (const [index, {asset, frame}] of paperContactFrames(validation.orderedAssets, incidentPrevention).entries()) {
    const framePath = resolveDeclared(projectRoot, frame.path);
    const cellPath = path.join(temporaryRoot, `cell-${String(index + 1).padStart(2, '0')}.png`);
    run(
      'magick',
      [
        framePath,
        '-auto-orient',
        '-resize',
        '640x360',
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
        `${asset.sceneId}${incidentPrevention ? `  f${frame.frameIndex}` : ''}  ${asset.productionCandidate.sha256.slice(0, 12)}`,
        '-bordercolor',
        '#0B1014',
        '-border',
        '6',
        cellPath,
      ],
      'PAPER_ASSET_CONTACT_SHEET_CELL_FAILED',
    );
    cells.push({
      ...paperContactCellBinding(asset, frame, incidentPrevention),
      ...(incidentPrevention ? {pageIndex: Math.floor(index / PAPER_CONTACT_PAGE_SIZE)} : {}),
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
  const pageSize = incidentPrevention ? PAPER_CONTACT_PAGE_SIZE / 2 : rowPaths.length;
  const outputName = path.parse(outputPath);
  const pagePaths = Array.from({length: Math.ceil(rowPaths.length / pageSize)}, (_, index) => index === 0 ? outputPath :
    path.join(outputName.dir, `${outputName.name}.page-${String(index + 1).padStart(3, '0')}${outputName.ext}`));
  if (pagePaths.some(file => existsSync(file))) throw new Error('PAPER_ASSET_CONTACT_SHEET_PAGE_EXISTS');
  const pages = [];
  for (const [pageIndex, pagePath] of pagePaths.entries()) {
    run('magick', [...rowPaths.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), '-append', pagePath],
      'PAPER_ASSET_CONTACT_SHEET_BUILD_FAILED');
    pages.push({pageIndex, image: {path: pagePath, sha256: sha256File(pagePath)}});
  }
  const manifest = {
    schemaVersion: PAPER_CONTACT_SHEET_SCHEMA,
    taskId: request.taskId,
    request: {path: requestPath, sha256: sha256File(requestPath)},
    assetSetSha256: validation.assetSetSha256,
    image: {path: outputPath, sha256: sha256File(outputPath)},
    cells: cells.map(({cellPath: _cellPath, ...cell}) => cell),
    ordering: incidentPrevention ? 'source-plan-scene-order-then-frame-index' : 'source-plan-scene-order',
    ...(incidentPrevention ? {revisionId: validation.revisionId, policy: {incidentPreventionVersion: '1'}, pages, dynamicEvidence: validation.dynamicEvidence} : {}),
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
