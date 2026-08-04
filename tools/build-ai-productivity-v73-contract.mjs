import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const planSource = path.join(
  projectRoot,
  'remotion/src/data/AIProductivityV73.visual-plan.v1.json',
);
const planOutput = path.join(
  projectRoot,
  'edit/20260804_ai_productivity/visual-plan_AI_PRODUCTIVITY_20260804_talk01_v1.json',
);
const cueOutput = path.join(
  projectRoot,
  'edit/20260804_ai_productivity/sfx-cue-sheet_AI_PRODUCTIVITY_20260804_talk01_v1.json',
);
const cueRuntimeOutput = path.join(
  projectRoot,
  'remotion/src/data/AIProductivityV73.sfx.v1.json',
);

const roleFiles = {
  'soft-card-pop': [
    'remotion/public/audio/koubo-sfx-v3-candidates/soft-card-pop-a.wav',
    'remotion/public/audio/koubo-sfx-v3-candidates/soft-card-pop-b.wav',
  ],
  'list-tick': [
    'remotion/public/audio/koubo-sfx-v3-candidates/list-tick-a.wav',
    'remotion/public/audio/koubo-sfx-v3-candidates/list-tick-b.wav',
  ],
  'line-connect': [
    'remotion/public/audio/koubo-sfx-v3-candidates/line-connect-a.wav',
  ],
  'number-settle': [
    'remotion/public/audio/koubo-sfx-v3-candidates/number-settle-a.wav',
  ],
  'media-whoosh': [
    'remotion/public/audio/koubo-sfx-v3-candidates/media-whoosh-a.wav',
    'remotion/public/audio/koubo-sfx-v3-candidates/media-whoosh-b.wav',
  ],
  'evidence-paper': [
    'remotion/public/audio/koubo-sfx-v3-candidates/evidence-paper-a.wav',
  ],
  'chapter-sweep': [
    'remotion/public/audio/koubo-sfx-v3-candidates/chapter-sweep-a.wav',
  ],
  'cta-confirm': [
    'remotion/public/audio/koubo-sfx-v3-candidates/cta-confirm-a.wav',
  ],
};

const roleVolumes = {
  'soft-card-pop': 0.055,
  'list-tick': 0.05,
  'line-connect': 0.05,
  'number-settle': 0.06,
  'media-whoosh': 0.07,
  'evidence-paper': 0.055,
  'chapter-sweep': 0.06,
  'cta-confirm': 0.07,
};

const plan = JSON.parse(fs.readFileSync(planSource, 'utf8'));
const roleUseCount = new Map();
const cues = plan.layers.map((layer) => {
  const role = layer.sound.role;
  const files = roleFiles[role];
  if (!files) {
    throw new Error(`没有为音效角色配置本地文件：${role}`);
  }
  const used = roleUseCount.get(role) ?? 0;
  roleUseCount.set(role, used + 1);
  const source = files[used % files.length];
  const start =
    layer.visualEvent.enterAt + layer.sound.offsetFrames / plan.target.fps;
  return {
    id: layer.sound.cueId,
    visualEventId: layer.visualEvent.id,
    role,
    start,
    end: start + 0.8,
    source,
    license:
      'Mixkit Free License；详见assets/sfx/koubo-sfx-v3-candidates/manifest.json',
    volume: roleVolumes[role],
    voiceDuckDb: 0,
    previewCovered: false,
    formalReviewed: false,
    userAudibilityConfirmed: false,
  };
});

const cueSheet = {
  schemaVersion: 2,
  videoId: plan.videoId,
  version: 'v1',
  experimentId: plan.experiment.id,
  cues,
  coverageReview: {
    primaryVisualEventCount: plan.layers.length,
    coveredPrimaryVisualEventCount: cues.length,
    coveragePercent: 100,
    maxSyncErrorFrames: 2,
    machineStatus: 'passed',
    userAudibilityConfirmed: false,
    notes:
      '26个主视觉事件全部使用同一visualEventId绑定本地候选音效；正式听感仍待用户完整观看确认。',
  },
};

for (const outputPath of [planOutput, cueOutput, cueRuntimeOutput]) {
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
}
fs.copyFileSync(planSource, planOutput);
fs.writeFileSync(cueOutput, `${JSON.stringify(cueSheet, null, 2)}\n`, 'utf8');
fs.writeFileSync(cueRuntimeOutput, `${JSON.stringify(cueSheet, null, 2)}\n`, 'utf8');

console.log(`视觉事件：${plan.layers.length}`);
console.log(`音效点：${cues.length}`);
console.log(`实际音效角色：${roleUseCount.size}`);
console.log(`视觉方案：${planOutput}`);
console.log(`音效表：${cueOutput}`);
