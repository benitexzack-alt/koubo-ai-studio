#!/usr/bin/env node

import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const sourcePath = path.resolve(
  repoRoot,
  'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r2/director-preproduction-request.v1.json',
);
const outputPath = path.resolve(here, 'director-preproduction-request.v1.json');
const request = JSON.parse(readFileSync(sourcePath, 'utf8'));

request.requestId = 'local-ai-services-paper-v3-r3-pre-shoot';
request.directorProfile.profileVersion = '3.2.0';
request.policy = {
  branch: 'paper-editorial',
  fallback: 'blocked',
  textStrategy: 'deterministic-first-frame-text-v3.2',
  generatedReadableTextAllowed: false,
  modelGeneratedReadableTextAllowed: false,
  deterministicTextMayBeBakedIntoFirstFrame: true,
  defaultPaperTextMode: 'first-frame-baked',
  actualImageAnchorCalibrationRequired: true,
  runningHubRequiresTextBakeReceipt: true,
  paperNodeScreenOverlayAllowed: false,
  postShootRebindRequired: true,
};
request.outputs = {
  routeLockPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r3/director-route-lock.v1.json',
  planPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r3/director-preproduction-plan.v1.json',
  assetSheetPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r3/全素材路由与制作清单_v3-r3.md',
  firstFramePromptManifestPath: 'edit/generated-video/20260902_local_ai_services_paper-v3-r3/first-frame-prompts.v1.json',
  runningHubPromptManifestPath: 'edit/generated-video/20260902_local_ai_services_paper-v3-r3/runninghub-image-to-video-prompts.v1.json',
  runningHubPromptSheetPath: 'edit/generated-video/20260902_local_ai_services_paper-v3-r3/runninghub-image-to-video-prompts.md',
  compileReceiptPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r3/director-compile-receipt.v1.json',
  validationReceiptPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r3/director-validation-receipt.v1.json',
};

const presenterInset = (materialAudioMode = 'duck-under-narration') => ({
  mode: 'real-media-with-presenter-inset',
  materialAudioMode,
  speakerIsExplainingThisAsset: true,
  minimumDurationSeconds: 3,
  presenter: {
    source: 'authoritative-talk-source',
    audioOwner: 'base-talk-only',
    duplicateVideoMuted: true,
    anchor: 'bottom-right',
    shape: 'circle',
  },
  transition: {enterFrames: 16, exitFrames: 12, hardCutForbidden: true},
  captions: {overlapForbidden: true, minimumGapPx: 24},
});

const generatedVideo = ({beat, purpose, prompt}) => ({
  ...beat,
  visualDecision: {class: 'generated-video', producer: 'user', fallback: 'blocked'},
  evidenceRefs: [],
  generatedVideoBrief: {
    role: 'illustration-only',
    presentationMode: 'full-screen',
    evidenceEligible: false,
    purpose,
    prompt,
    disclosureRequired: true,
  },
});

const rigidTextSafety =
  '首帧中已经写入的全部中文必须逐字保持不变。带字纸牌只能作为完整刚性物件滑入、平移、小角度旋转、从抽屉推出或刚性拼图扣合；禁止折叠、弯曲、卷曲、揉皱、拉伸、翻面、遮挡文字、重新生成文字和强运动模糊。需要展开时只展开无字底板，再让带字纸牌滑入。结尾稳定停留至少0.8秒，保证所有中文清楚可读。';
const blankLabelSafety =
  '每个需要标注的节点都放置一张独立、正面可见、无遮挡、面积足够的空白刚性纸牌，并贴近其对应物件；纸牌彼此分离，四角完整可见。不得在纸牌或背景生成任何可读文字、乱码、字母、数字、Logo或水印，准确中文将在本地确定性写入。';

const normalizeBlankLabelLayout = (prompt) =>
  prompt
    .replace(
      '前景整齐叠放四张无字刚性标签卡并预留中文写入空间',
      '四张无字刚性标签卡分别放在对应节点旁，正面朝向镜头并预留中文写入空间',
    )
    .replace(
      '四张无字刚性标签卡整齐叠放并留足中文写入区域',
      '四张无字刚性标签卡分别放在对应节点旁，正面朝向镜头并留足中文写入区域',
    )
    .replace(
      /四张无字刚性标签卡叠放并(?:留足中文写入空间|留足中文写入区域|预留中文写入区域)/gu,
      '四张无字刚性标签卡分别放在对应节点旁，正面朝向镜头并留足中文写入区域',
    );

request.beats = request.beats.map((beat) => {
  if (beat.visualDecision.class === 'paper-editorial') {
    return {
      ...beat,
      paperScene: {
        ...beat.paperScene,
        textPlan: beat.paperScene.textPlan.map((item) => ({
          ...item,
          embeddingMode: 'first-frame-baked',
          motionConstraint: 'rigid-surface',
          trackingKeyframesRequired: false,
          anchorRole: 'provisional-layout-intent-requires-actual-image-calibration',
        })),
        prompt: {
          ...beat.paperScene.prompt,
          firstFrame: `${normalizeBlankLabelLayout(beat.paperScene.prompt.firstFrame)} ${blankLabelSafety}`,
          motion: `${beat.paperScene.prompt.motion} ${rigidTextSafety}`,
        },
      },
    };
  }

  if (beat.id === 'B01') {
    return {
      ...beat,
      visualDecision: {class: 'speaker', producer: 'user', fallback: 'blocked'},
      evidenceRefs: [],
      overlayDecision: {
        class: 'remotion-information',
        producer: 'codex-remotion',
        role: 'keyword',
        items: ['AIGC内卷', '投入不确定'],
      },
    };
  }
  if (beat.id === 'B04') {
    return {
      ...beat,
      visualDecision: {class: 'speaker', producer: 'user', fallback: 'blocked'},
      evidenceRefs: [],
      overlayDecision: {
        class: 'remotion-information',
        producer: 'codex-remotion',
        role: 'chapter-anchor',
        items: ['方向一', '家庭故事与婚礼'],
      },
    };
  }
  if (beat.id === 'B05') {
    return {
      ...beat,
      coreMeaning: '用户家庭故事动画作为主画面，本人平滑缩到右下角继续讲解，不重新生成同主题素材。',
      visualDecision: {class: 'real-evidence', producer: 'user', fallback: 'blocked'},
      evidenceRefs: ['U02 用户家庭故事动画原片，待回填、授权与内容验收'],
      presentation: presenterInset('duck-under-narration'),
    };
  }
  if (beat.id === 'B06') {
    return {
      ...beat,
      coreMeaning: '用户婚礼定制短片作为主画面，本人平滑缩到右下角讲解成片用途；素材不能证明价格、成本或成交。',
      visualDecision: {class: 'real-evidence', producer: 'user', fallback: 'blocked'},
      evidenceRefs: ['U03 用户婚礼定制短片原片，待回填、授权与内容验收'],
      presentation: presenterInset('duck-under-narration'),
    };
  }
  if (beat.id === 'B07') {
    return generatedVideo({
      beat,
      purpose: '用人物、家庭环境和老照片表现长辈人生数字回忆录的情感场景',
      prompt: '16:9真实商业纪实摄影风格，中国西北普通家庭客厅，一位成年子女与长辈并肩坐在桌边，桌上摊开数张旧照片和一本空白纪念册，子女认真倾听并用小型录音设备记录，长辈自然讲述往事，暖色窗光与克制侧光，真实年龄感和生活细节，镜头缓慢推进，情绪温暖但不煽情，不出现可读文字、品牌、Logo、水印、收益暗示或虚构客户背书。',
    });
  }
  if (beat.id === 'B09') {
    return generatedVideo({
      beat,
      purpose: '表现中老年实体店经营者学习用AI完成具体宣传任务的真实动作',
      prompt: '16:9真实商业纪实摄影风格，中国西北社区实体小店内，一位中老年店主坐在柜台前使用手机和电脑，先整理商品照片，再查看短视频脚本草稿与宣传海报版式，旁边纸笔记录客户沟通要点，神态专注而不夸张，背景可见真实货架与日常经营环境，镜头从中景轻缓移到手部操作特写，不展示任何可读界面文字、平台Logo、医疗功效、收益数字或虚假成交。',
    });
  }
  if (beat.id === 'B14') {
    return {
      ...beat,
      visualDecision: {class: 'speaker', producer: 'user', fallback: 'blocked'},
      evidenceRefs: [],
      overlayDecision: {
        class: 'remotion-information',
        producer: 'codex-remotion',
        role: 'cta',
        items: ['本地真实需求', '评论区交流'],
      },
    };
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
  routeCounts: request.beats.reduce((counts, beat) => {
    counts[beat.visualDecision.class] = (counts[beat.visualDecision.class] ?? 0) + 1;
    return counts;
  }, {}),
}));
