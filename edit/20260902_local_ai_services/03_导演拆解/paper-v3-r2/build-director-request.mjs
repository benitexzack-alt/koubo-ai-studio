#!/usr/bin/env node

import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const sourcePath = path.resolve(
  repoRoot,
  'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r1/director-preproduction-request.v1.json',
);
const outputPath = path.resolve(here, 'director-preproduction-request.v1.json');

const request = JSON.parse(readFileSync(sourcePath, 'utf8'));

request.requestId = 'local-ai-services-paper-v3-r2-pre-shoot';
request.outputs = {
  routeLockPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r2/director-route-lock.v1.json',
  planPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r2/director-preproduction-plan.v1.json',
  assetSheetPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r2/纸艺素材执行单_v3-r2.md',
  firstFramePromptManifestPath: 'edit/generated-video/20260902_local_ai_services_paper-v3-r2/first-frame-prompts.v1.json',
  runningHubPromptManifestPath: 'edit/generated-video/20260902_local_ai_services_paper-v3-r2/runninghub-image-to-video-prompts.v1.json',
  runningHubPromptSheetPath: 'edit/generated-video/20260902_local_ai_services_paper-v3-r2/runninghub-image-to-video-prompts.md',
  compileReceiptPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r2/director-compile-receipt.v1.json',
  validationReceiptPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r2/director-validation-receipt.v1.json',
};

const userClipBeat = ({id, order, spokenLine, coreMeaning, evidenceRef}) => ({
  id,
  order,
  spokenLine,
  coreMeaning,
  kind: 'real-person-action',
  visualDecision: {
    class: 'real-evidence',
    producer: 'user',
    fallback: 'blocked',
  },
  evidenceRefs: [evidenceRef],
});

request.beats = request.beats.map((beat) => {
  if (beat.id === 'B04') {
    return {
      ...beat,
      coreMeaning: '用用户提供的家庭故事动画和婚礼定制短片原片建立第一方向，不再生成同主题纸艺替代画面。',
      evidenceRefs: [
        'U02 用户家庭故事动画原片，待回填并验收',
        'U03 用户婚礼定制短片原片，待回填并验收',
      ],
    };
  }

  if (beat.id === 'B05') {
    return userClipBeat({
      id: beat.id,
      order: beat.order,
      spokenLine: beat.spokenLine,
      coreMeaning: '直接使用用户家庭故事动画原片，按读书、相遇、工作、结婚生子的实录语义截取，不用纸艺复述。',
      evidenceRef: 'U02 用户家庭故事动画原片，待回填并验收',
    });
  }

  if (beat.id === 'B06') {
    return userClipBeat({
      id: beat.id,
      order: beat.order,
      spokenLine: beat.spokenLine,
      coreMeaning: '直接使用用户婚礼定制短片原片展示成片质感，不用纸艺画面证明价格、成本或成交结果。',
      evidenceRef: 'U03 用户婚礼定制短片原片，待回填并验收',
    });
  }

  return beat;
});

writeFileSync(outputPath, `${JSON.stringify(request, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});

console.log(JSON.stringify({
  ok: true,
  sourcePath,
  outputPath,
  paperSceneCount: request.beats.filter(
    (beat) => beat.visualDecision.class === 'paper-editorial',
  ).length,
  userClipBeatIds: ['B05', 'B06'],
}));
