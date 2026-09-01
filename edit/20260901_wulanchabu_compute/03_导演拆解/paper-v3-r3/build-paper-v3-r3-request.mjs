#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../../../..');
const sourceRequestPath = path.resolve(
  here,
  '../paper-v3-r2/director-preproduction-request.v1.json',
);
const outputPath = path.resolve(here, 'director-preproduction-request.v1.json');

if (existsSync(outputPath)) {
  throw new Error(`OUTPUT_ALREADY_EXISTS:${outputPath}`);
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const sourceBuffer = readFileSync(sourceRequestPath);
const request = JSON.parse(sourceBuffer.toString('utf8'));
const revisionRootRelative = path.relative(projectRoot, here);
const handoffRoot =
  'edit/generated-video/20260901_wulanchabu_compute_paper-v3-r3';

request.requestId = 'wulanchabu-compute-paper-v3-r3-pre-shoot';
request.revision = {
  id: 'paper-v3-r3',
  supersedes: 'paper-v3-r2',
  reason: '首帧生图与 RunningHub 图生视频提示词改为独立交付并强制一对一配对',
  sourceRequestPath: path.relative(projectRoot, sourceRequestPath),
  sourceRequestSha256: sha256(sourceBuffer),
};
request.outputs = {
  routeLockPath: `${revisionRootRelative}/director-route-lock.v1.json`,
  planPath: `${revisionRootRelative}/director-preproduction-plan.v1.json`,
  assetSheetPath: `${revisionRootRelative}/纸艺素材执行单_v3-r3.md`,
  firstFramePromptManifestPath: `${handoffRoot}/first-frame-prompts.v1.json`,
  runningHubPromptManifestPath: `${handoffRoot}/runninghub-image-to-video-prompts.v1.json`,
  runningHubPromptSheetPath: `${handoffRoot}/runninghub-image-to-video-prompts.md`,
  compileReceiptPath: `${revisionRootRelative}/director-compile-receipt.v1.json`,
  validationReceiptPath: `${revisionRootRelative}/director-validation-receipt.v1.json`,
};

writeFileSync(outputPath, `${JSON.stringify(request, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});

console.log(
  JSON.stringify({
    ok: true,
    outputPath,
    sourceRequestPath,
    sourceRequestSha256: request.revision.sourceRequestSha256,
    paperSceneCount: request.beats.filter(
      (beat) => beat.visualDecision?.class === 'paper-editorial',
    ).length,
  }),
);
