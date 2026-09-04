import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const skillRoot = path.resolve(import.meta.dirname, '../..');
export const registryBytes = fs.readFileSync(path.join(skillRoot, 'registry.v1.json'));
export const registry = JSON.parse(registryBytes);
export const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const placeholderHash = '0'.repeat(64);
export const captions = [
  {startMs: 0, endMs: 3000, zh: '真实照片和口述故事，整理成故事脚本。'},
  {startMs: 3000, endMs: 6000, zh: '这张真实界面已经清楚显示目标按钮。'},
];

export const selectionFixture = () => ({
  schemaVersion: 'koubo-shotcraft-director-selection/v1',
  taskId: 'task-v9-test',
  revisionId: 'r1',
  directorProfile: {profileId: 'paper-editorial-director-v9', profileVersion: '9.0.0'},
  subtitleAuthority: 'actual-recording',
  registry: {
    path: 'skills/koubo-shotcraft-library/registry.v1.json',
    sha256: hash(registryBytes),
  },
  captions: {path: 'edit/test/actual-captions.json', sha256: placeholderHash},
  canvas: {width: 1920, height: 1080, fps: 30, durationInFrames: 180},
  beats: [
    {
      beatId: 'beat-001',
      mainVisual: 'speaker',
      frames: {startFrame: 0, endFrameExclusive: 90},
      decision: 'apply',
      effectId: 'marker-underline',
      purpose: '强调实录中的核心材料类型',
      quote: '真实照片和口述故事',
      texts: ['真实照片'],
      region: {x: 60, y: 140, width: 620, height: 250},
      protectedRegions: [
        {x: 800, y: 0, width: 900, height: 850},
        {x: 0, y: 900, width: 1920, height: 180},
      ],
      fallback: 'blocked',
    },
  ],
});

export const makeNotNeeded = (selection, reason = '本段完整真人表情承担语义，附加文字会重复实录信息') => {
  const beat = selection.beats[0];
  for (const key of ['effectId', 'purpose', 'quote', 'texts', 'region', 'protectedRegions', 'fallback']) delete beat[key];
  beat.decision = 'not-needed';
  beat.reason = reason;
  return selection;
};

export const receiptFixture = (selection = selectionFixture()) => ({
  schemaVersion: 'koubo-shotcraft-application-receipt/v1',
  taskId: selection.taskId,
  revisionId: selection.revisionId,
  selection: {path: 'edit/test/director-selection.json', sha256: placeholderHash},
  output: {path: 'outputs/test-v9.mp4', sha256: placeholderHash},
  applications: [
    {
      beatId: 'beat-001',
      effectId: 'marker-underline',
      frames: {startFrame: 0, endFrameExclusive: 90},
      component: {
        name: 'MarkerUnderline',
        path: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',
        sha256: placeholderHash,
      },
      outputSha256: placeholderHash,
      finalWorking: true,
    },
  ],
});
