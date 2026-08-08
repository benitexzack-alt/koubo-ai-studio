import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const planRuntimeOutput = path.join(
  projectRoot,
  'remotion/src/data/AISelfMediaV73.visual-plan.v1.json',
);
const planOutput = path.join(
  projectRoot,
  'edit/20260808_ai_selfmedia_lowcost/visual-plan_AI_SELFMEDIA_20260808_talk01_v1.json',
);
const cueOutput = path.join(
  projectRoot,
  'edit/20260808_ai_selfmedia_lowcost/sfx-cue-sheet_AI_SELFMEDIA_20260808_talk01_v1.json',
);
const cueRuntimeOutput = path.join(
  projectRoot,
  'remotion/src/data/AISelfMediaV73.sfx.v1.json',
);

const layerSpecs = [
  ['hook-friction', 0.2, 13.5, '普通人误以为没团队、口才不好、不会拍、不敢出镜，所以迟迟没有开始', 'hook', 'semantic-motion-card', '普通人的四个自媒体误区', 'soft-card-pop', 4.8],
  ['platform-question', 13.6, 22.35, '真正缺的是没看懂平台为什么样的内容买单', 'mechanism', 'chapter-card', '平台为什么愿意付钱', 'chapter-sweep', 18.4],
  ['youtube-flywheel', 27.6, 43.3, '创作者、用户、商家和平台形成闭环', 'mechanism', 'full-screen-asset', 'YouTube平台闭环', 'line-connect', 35.5],
  ['youtube-100b-evidence', 50.9, 58.65, 'YouTube过去四年支付超过1000亿美元', 'evidence', 'full-screen-asset', '累计支付超1000亿美元', 'evidence-paper', 55.2],
  ['alphabet-60b-metric', 58.68, 66.45, 'YouTube广告和订阅年收入超过600亿美元', 'evidence', 'metric-card', 'Alphabet 2025财报口径', 'number-settle', 62.6],
  ['douyin-entry', 70.2, 74.55, '回到抖音，逻辑类似但形式不同', 'transition', 'chapter-card', '抖音的入口形式不同', 'chapter-sweep', 72.4],
  ['douyin-routes', 74.6, 84, '列出创作者伙伴计划、星图、商品橱窗等入口', 'mechanism', 'semantic-motion-card', '入口不是躺赚按钮', 'list-tick', 79.4],
  ['xingtu-evidence', 84, 91, '巨量星图存在公开达人商业合作入口', 'evidence', 'full-screen-asset', '商业合作有明确规则', 'media-whoosh', 87.4],
  ['douyin-ec-evidence', 91, 98.2, '抖音电商存在公开达人交易路径', 'evidence', 'full-screen-asset', '抖音电商官方入口', 'media-whoosh', 94.5],
  ['content-cost', 103.5, 117.1, '内容生产包含选题、资料、文案、拍摄、剪辑、封面和复盘', 'problem', 'process-card', '内容生产为什么太贵', 'line-connect', 110.3],
  ['ai-workflow', 126.3, 141.7, 'AI把文案、选题和脚本门槛压低', 'solution', 'semantic-motion-card', 'AI辅助内容工作流', 'soft-card-pop', 134.1],
  ['ai-core-truth', 160.65, 167.5, 'AI不是替你赚钱，而是降低试错成本', 'core-claim', 'truth-card', 'AI降低的是试错成本', 'chapter-sweep', 164.1],
  ['thirty-posts', 185.1, 194.75, '先用AI跑30条内容的小闭环', 'deliverable', 'metric-card', '30条内容实验', 'number-settle', 190.1],
  ['step-four-feedback', 228.1, 245.35, '看完、收藏、评论用得上、私信问下一步', 'deliverable', 'semantic-motion-card', '四项真实反馈', 'list-tick', 236.5],
  ['effort-vs-retention', 245.4, 256.55, '平台奖励用户愿意停留的内容，不是努力本身', 'mechanism', 'truth-card', '努力不等于用户停留', 'chapter-sweep', 250.8],
  ['digital-assets', 256.6, 267.35, '持续发布会积累公开表达、市场反馈和判断材料', 'value', 'semantic-motion-card', '数字资产如何形成', 'soft-card-pop', 261.9],
  ['three-questions', 281.25, 308, '先问能否讲清问题、连续发布30条、形成可判断的数字资产', 'deliverable', 'semantic-motion-card', '普通人的三个自检问题', 'list-tick', 294.6],
  ['no-guarantees', 308.1, 331.8, '不保证变现和流量，但值得低成本测试', 'boundary', 'semantic-motion-card', '低成本路径的结果边界', 'evidence-paper', 320.1],
  ['personal-timeline', 338.1, 355.1, '本人从7月8日至8月8日持续验证AI内容实践', 'personal-record', 'semantic-motion-card', '一个月个人实践记录', 'line-connect', 346.6],
  ['start-now', 374.1, 381.4, '作为普通人，第一步一定要开始', 'cta', 'chapter-card', '第一步一定要开始', 'cta-confirm', 377.8],
  ['identity-close', 381.45, 384.733333, '我是超哥，我在兰州AI创业', 'identity', 'chapter-card', '超哥在兰州AI创业', 'soft-card-pop', 383],
];

const fullScreenAssets = {
  'youtube-flywheel': 'AISelfMediaV73/Flywheel',
  'youtube-100b-evidence': 'remotion/public/screenshots/20260808_youtube_creator_payout_100b.png',
  'xingtu-evidence': 'remotion/public/screenshots/20260808_xingtu_creator_entry.png',
  'douyin-ec-evidence': 'remotion/public/screenshots/20260808_douyin_ec_creator_path.png',
};

const mediaEvidenceIds = new Set([
  'youtube-100b-evidence',
  'xingtu-evidence',
  'douyin-ec-evidence',
]);

const layers = layerSpecs.map(
  ([id, start, end, spokenLine, purpose, kind, title, role, reviewAt], index) => {
    const realEvidence = mediaEvidenceIds.has(id);
    return {
      id,
      start,
      end,
      spokenLine,
      purpose,
      kind,
      variant: kind,
      titleOwner: true,
      overlapGroup: `aism-final-${String(index + 1).padStart(2, '0')}`,
      zone: kind === 'full-screen-asset' ? 'full-screen' : 'left-safe',
      title,
      detail: spokenLine,
      items: [],
      asset: {
        sourceType: realEvidence
          ? 'official-screenshot'
          : 'remotion-component',
        source:
          fullScreenAssets[id] ?? `AISelfMediaV73/${kind}/${id}`,
      },
      assetDecision: {
        class: realEvidence ? 'real-evidence' : 'remotion-information',
        producer: realEvidence ? 'existing' : 'codex-remotion',
        requestId: null,
        fallback: realEvidence
          ? 'official-text-evidence-card'
          : 'speaker-plus-information',
      },
      visualEvent: {
        id: `aism-final-v${String(index + 1).padStart(3, '0')}`,
        enterAt: start,
        primary: true,
      },
      sound: {
        policy: 'required',
        role,
        cueId: `aism-final-sfx-${String(index + 1).padStart(3, '0')}`,
        offsetFrames: 0,
        maxSyncErrorFrames: 2,
      },
      checks: {
        avoidFace: kind !== 'full-screen-asset',
        avoidSubtitle: true,
        needsFrameReview: true,
        reviewAt,
      },
    };
  },
);

const plan = {
  schemaVersion: 3,
  experiment: {
    id: 'v73-media-sfx-speed',
    status: 'ready-for-next-video-validation',
  },
  videoId: 'AI_SELFMEDIA_20260808_talk01',
  videoTitle: 'AI时代，普通人最低成本的入场券',
  sourceVideo:
    'source/20260808_ai_selfmedia_lowcost/01_口播原片/R01_AI自媒体低成本起号_口播原片.MOV',
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: [
    'v72-user-verified-20260730',
    'v73-transparent-events-and-sfx',
    'aism-asset-preflight-20260808',
  ],
  timingStatus: 'word-timeline-bound-to-recorded-audio',
  target: {
    aspect: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    platform: 'douyin',
  },
  style: {
    brandLine: '超哥AI创业记',
    palette: {
      ink: '#F7FAFC',
      cyan: '#62D8FF',
      yellow: '#FFBE55',
      green: '#67D8A0',
      red: '#FF7068',
      graphite: '#090D12',
    },
    motion: {
      enter: 'spring',
      exit: 'fade',
      avoidLinearEasing: true,
    },
  },
  safeAreas: {
    subtitle: {x: 205, y: 914, width: 1510, height: 124},
    face: {x: 930, y: 145, width: 520, height: 620},
    hands: {x: 790, y: 510, width: 750, height: 390},
  },
  previewCoverage: [
    'hook',
    'complex-overlay',
    'full-screen-asset',
    'cta',
    'all-new-sfx-roles',
  ],
  deferred: [
    {
      id: 'user-full-playback',
      reason: '正式片机器质检通过后，仍需用户完整观看确认内容与音效听感。',
    },
  ],
  layers,
};

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
  'soft-card-pop': 0.04,
  'list-tick': 0.035,
  'line-connect': 0.04,
  'number-settle': 0.045,
  'media-whoosh': 0.045,
  'evidence-paper': 0.04,
  'chapter-sweep': 0.04,
  'cta-confirm': 0.045,
};

const roleUseCount = new Map();
const cues = layers.map((layer) => {
  const role = layer.sound.role;
  const files = roleFiles[role];
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
    primaryVisualEventCount: layers.length,
    coveredPrimaryVisualEventCount: cues.length,
    coveragePercent: 100,
    maxSyncErrorFrames: 2,
    machineStatus: 'passed',
    userAudibilityConfirmed: false,
    notes:
      '21个主视觉事件全部绑定本地候选音效；音量已按主口播优先压低，正式听感仍待用户完整观看确认。',
  },
};

for (const outputPath of [
  planRuntimeOutput,
  planOutput,
  cueOutput,
  cueRuntimeOutput,
]) {
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
}
for (const outputPath of [planRuntimeOutput, planOutput]) {
  fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
}
for (const outputPath of [cueOutput, cueRuntimeOutput]) {
  fs.writeFileSync(outputPath, `${JSON.stringify(cueSheet, null, 2)}\n`, 'utf8');
}

console.log(`视觉事件：${layers.length}`);
console.log(`音效点：${cues.length}`);
console.log(`实际音效角色：${roleUseCount.size}`);
console.log(`视觉方案：${planOutput}`);
console.log(`音效表：${cueOutput}`);
