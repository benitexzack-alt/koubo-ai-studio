import {Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {
  V72ProductionShell,
  type V72CustomScene,
  type V72ProductionConfig,
  type V72ProductionScene,
  type V72SfxCue,
} from '../components/V72ProductionShell';
import {
  V8Closing,
  V8ComparisonBars,
  V8DirectStatement,
  V8HeroDefinition,
  V8ProcessRail,
  V8QuestionList,
  V8RightsRail,
  V8StatusStack,
  type V8SemanticLayer,
} from './V8SemanticStageSnapshot.r2';
import {
  EvidenceScan,
  KeywordReveal,
  LineCarry,
  MarkerUnderline,
  PaperTapePin,
} from '../../../skills/koubo-shotcraft-library/assets/ShotcraftEffects';
import candidatePlanDocument from './candidate-plan.v1.json';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FrameRange = {
  startFrame: number;
  endFrameExclusive: number;
};

type SpeakerOnlyWindow = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  reason: string;
};

type PaperClipPlan = {
  id: string;
  asset: string;
  startSeconds: number;
  durationSeconds: number;
};

type SemanticComponent =
  | 'direct-statement'
  | 'comparison'
  | 'process'
  | 'question-list'
  | 'hero-definition'
  | 'rights-rail'
  | 'status-stack'
  | 'closing';

type SemanticLayerPlan = {
  id: string;
  beatId: string;
  startSeconds: number;
  endSeconds: number;
  component: SemanticComponent;
  controlComponent: string;
  semanticFamily: string;
  coverageRatio: number;
  title: string;
  detail: string;
  items: string[];
};

type ShotcraftEffectId =
  | 'marker-underline'
  | 'keyword-reveal'
  | 'evidence-scan'
  | 'line-carry'
  | 'paper-tape-pin';

type ShotcraftEffectPlan = {
  beatId: string;
  mainVisual: 'speaker' | 'real-evidence' | 'paper-editorial' | 'generated-video';
  frames: FrameRange;
  decision: 'apply' | 'not-needed';
  effectId?: ShotcraftEffectId;
  purpose?: string;
  quote?: string;
  texts?: string[];
  region?: Rect;
  protectedRegions?: Rect[];
  fallback?: 'blocked';
  sourceCard?: Record<string, unknown>;
  matchContext?: Record<string, unknown>;
  componentProps?: Record<string, unknown>;
};

type SfxCuePlan = {
  id: string;
  controlLayerId: string;
  visualEventId: string;
  role: string;
  time?: number;
  frame?: number;
  src: string;
  volume: number;
};

type CandidatePlan = {
  controlCounts: {
    mainVisuals: number;
    semanticLayers: number;
    paperClips: number;
    sfxCues: number;
    captionPages: number;
  };
  canvas: {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    durationInFrames: number;
  };
  sourceVideo: string;
  captionsSrc: string;
  brandLabel: string;
  candidateLabel: string;
  paperDisclosure: {primary: string; secondary: string};
  timingRuntime: {
    revisionId: string;
    semanticPrerollFrames: number;
    paperFadeFrames: number;
  };
  speakerOnlyWindows: SpeakerOnlyWindow[];
  paperClips: PaperClipPlan[];
  semanticLayers: SemanticLayerPlan[];
  effects: ShotcraftEffectPlan[];
  sfxCues: SfxCuePlan[];
};

const plan = candidatePlanDocument as unknown as CandidatePlan;
const {fps, durationSeconds, durationInFrames, width, height} = plan.canvas;
const toFrame = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const maximumInformationCoverage = 0.42;

export const LANZHOU_INDUSTRY_AI_V91_CANDIDATE_R1_DURATION_IN_FRAMES =
  durationInFrames;

const paperFrameRanges = plan.paperClips.map((clip) => ({
  id: clip.id,
  startFrame: toFrame(clip.startSeconds),
  endFrameExclusive:
    toFrame(clip.startSeconds) + toFrame(clip.durationSeconds),
}));

const overlaps = (left: FrameRange, right: FrameRange) =>
  left.startFrame < right.endFrameExclusive &&
  left.endFrameExclusive > right.startFrame;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isRect = (value: unknown): value is Rect =>
  isRecord(value) &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.width) &&
  isFiniteNumber(value.height) &&
  value.width > 0 &&
  value.height > 0;

const validateCandidatePlan = () => {
  if (
    width !== 1920 ||
    height !== 1080 ||
    fps !== 30 ||
    durationSeconds !== 336.366667 ||
    durationInFrames !== 10091
  ) {
    throw new Error('兰州产业AI候选画布或总时长合同不匹配。');
  }
  if (plan.sourceVideo !== 'R01.mp4' || plan.captionsSrc !== 'captions.json') {
    throw new Error('候选必须使用 R01.mp4 和 captions.json。');
  }

  if (
    plan.controlCounts.mainVisuals !== 27 ||
    plan.controlCounts.semanticLayers !== 21 ||
    plan.controlCounts.paperClips !== 6 ||
    plan.controlCounts.sfxCues !== 27 ||
    plan.controlCounts.captionPages !== 96 ||
    plan.semanticLayers.length !== 21 ||
    plan.paperClips.length !== 6 ||
    plan.semanticLayers.length + plan.paperClips.length !== 27 ||
    plan.sfxCues.length !== 27
  ) {
    throw new Error('V9.1 / V8 控制面必须完整同步 27 个主视觉、27 条音效和 96 页字幕。');
  }

  const expectedPaperStarts = [
    32.708,
    77.6,
    130.116,
    141.116,
    211.116,
    238.116,
  ];
  if (
    plan.timingRuntime.revisionId !== '20260911-animation-rebind-r2' ||
    plan.timingRuntime.semanticPrerollFrames !== 6 ||
    plan.timingRuntime.paperFadeFrames !== 3 ||
    plan.speakerOnlyWindows.length !== 1 ||
    plan.speakerOnlyWindows[0]?.id !== 'speaker-only-b16-question' ||
    toFrame(plan.speakerOnlyWindows[0]?.startSeconds ?? -1) !== 6531 ||
    toFrame(plan.speakerOnlyWindows[0]?.endSeconds ?? -1) !== 6660
  ) {
    throw new Error('动画重定时修订、预卷或真人留白窗口合同不匹配。');
  }
  if (
    plan.paperClips.length !== expectedPaperStarts.length ||
    plan.paperClips.some(
      (clip, index) => clip.startSeconds !== expectedPaperStarts[index],
    )
  ) {
    throw new Error('六条纸艺片的数量或入点与导演合同不一致。');
  }

  for (const layer of plan.semanticLayers) {
    const layerFrames = {
      startFrame: toFrame(layer.startSeconds),
      endFrameExclusive: toFrame(layer.endSeconds),
    };
    if (
      layerFrames.startFrame < 0 ||
      layerFrames.endFrameExclusive <= layerFrames.startFrame ||
      layerFrames.endFrameExclusive > durationInFrames
    ) {
      throw new Error(`V8 信息层 ${layer.id} 帧窗无效。`);
    }
    if (paperFrameRanges.some((paper) => overlaps(layerFrames, paper))) {
      throw new Error(`V8 信息层 ${layer.id} 不得覆盖 paper-editorial 窗口。`);
    }
    if (layer.coverageRatio > maximumInformationCoverage) {
      throw new Error(`V8 信息层 ${layer.id} 覆盖率超过 42%。`);
    }
  }

  for (const effect of plan.effects) {
    if (effect.decision !== 'apply') continue;
    if (!['speaker', 'real-evidence'].includes(effect.mainVisual)) {
      throw new Error(
        `Shotcraft ${effect.beatId} 只能用于 speaker / real-evidence。`,
      );
    }
    if (
      paperFrameRanges.some((paper) => overlaps(effect.frames, paper))
    ) {
      throw new Error(
        `Shotcraft ${effect.beatId} 与 paper-editorial 窗口重叠，已阻断。`,
      );
    }
    if (
      !effect.effectId ||
      !effect.region ||
      !isRect(effect.region) ||
      !effect.componentProps ||
      effect.fallback !== 'blocked'
    ) {
      throw new Error(`Shotcraft ${effect.beatId} 缺少可渲染合同字段。`);
    }
    if (
      effect.frames.startFrame < 0 ||
      effect.frames.endFrameExclusive <= effect.frames.startFrame ||
      effect.frames.endFrameExclusive > durationInFrames
    ) {
      throw new Error(`Shotcraft ${effect.beatId} 帧窗无效。`);
    }
    const {x, y, width: regionWidth, height: regionHeight} = effect.region;
    if (
      x < 0 ||
      y < 0 ||
      x + regionWidth > width ||
      y + regionHeight > height
    ) {
      throw new Error(`Shotcraft ${effect.beatId} 区域超出画布。`);
    }
    if (
      (regionWidth * regionHeight) / (width * height) >
      maximumInformationCoverage
    ) {
      throw new Error(`Shotcraft ${effect.beatId} 覆盖率超过 42%。`);
    }
  }

  const primaryVisuals = [
    ...plan.semanticLayers.map((layer) => ({
      id: layer.id,
      startFrame: toFrame(layer.startSeconds),
      endFrameExclusive: toFrame(layer.endSeconds),
    })),
    ...plan.paperClips.map((clip) => ({
      id: clip.id,
      startFrame: toFrame(clip.startSeconds),
      endFrameExclusive:
        toFrame(clip.startSeconds) + toFrame(clip.durationSeconds),
    })),
  ].sort((left, right) => left.startFrame - right.startFrame);
  if (new Set(primaryVisuals.map((visual) => visual.id)).size !== 27) {
    throw new Error('V9.1 主视觉 ID 必须 27/27 唯一。');
  }
  if (
    primaryVisuals[0]?.startFrame !== 0 ||
    primaryVisuals.at(-1)?.endFrameExclusive !== toFrame(336.28)
  ) {
    throw new Error('V9.1 主视觉控制区间必须从 0 秒覆盖到 336.28 秒。');
  }
  const detectedSpeakerOnlyWindows: FrameRange[] = [];
  for (let index = 1; index < primaryVisuals.length; index++) {
    const previous = primaryVisuals[index - 1];
    const current = primaryVisuals[index];
    if (previous.endFrameExclusive > current.startFrame) {
      throw new Error(`V9.1 主视觉 ${previous.id} → ${current.id} 发生重叠。`);
    }
    if (previous.endFrameExclusive < current.startFrame) {
      detectedSpeakerOnlyWindows.push({
        startFrame: previous.endFrameExclusive,
        endFrameExclusive: current.startFrame,
      });
    }
  }
  const declaredSpeakerOnlyWindows = plan.speakerOnlyWindows.map((window) => ({
    startFrame: toFrame(window.startSeconds),
    endFrameExclusive: toFrame(window.endSeconds),
  }));
  if (
    JSON.stringify(detectedSpeakerOnlyWindows) !==
    JSON.stringify(declaredSpeakerOnlyWindows)
  ) {
    throw new Error('V9.1 主视觉空窗必须精确绑定到已声明的真人留白窗口。');
  }

  const cueLayerIds = new Set<string>();
  for (const cue of plan.sfxCues) {
    const time = isFiniteNumber(cue.time)
      ? cue.time
      : isFiniteNumber(cue.frame)
        ? cue.frame / fps
        : Number.NaN;
    if (
      !Number.isFinite(time) ||
      time < 0 ||
      time >= durationSeconds ||
      !cue.src ||
      cue.volume < 0.2 ||
      cue.volume > 0.55
    ) {
      throw new Error(`V8 音效 ${cue.id} 合同无效。`);
    }
    const boundVisual = primaryVisuals.find(
      (visual) => visual.id === cue.controlLayerId,
    );
    if (
      !cue.controlLayerId ||
      !boundVisual ||
      cueLayerIds.has(cue.controlLayerId) ||
      !cue.src.startsWith('sfx/') ||
      toFrame(time) !== boundVisual.startFrame
    ) {
      throw new Error(`V8 音效 ${cue.id} 未与唯一主视觉或独立 public 路径绑定。`);
    }
    cueLayerIds.add(cue.controlLayerId);
  }
};

validateCandidatePlan();

const renderableEffects = plan.effects.filter(
  (effect): effect is ShotcraftEffectPlan & {
    effectId: ShotcraftEffectId;
    region: Rect;
    componentProps: Record<string, unknown>;
  } =>
    effect.decision === 'apply' &&
    Boolean(effect.effectId) &&
    Boolean(effect.region) &&
    Boolean(effect.componentProps) &&
    ['speaker', 'real-evidence'].includes(effect.mainVisual) &&
    !paperFrameRanges.some((paper) => overlaps(effect.frames, paper)),
);

const subtractFrameRanges = (
  source: FrameRange,
  exclusions: FrameRange[],
): FrameRange[] => {
  let segments = [source];
  for (const exclusion of exclusions) {
    segments = segments.flatMap((segment) => {
      if (!overlaps(segment, exclusion)) return [segment];
      const remaining: FrameRange[] = [];
      if (segment.startFrame < exclusion.startFrame) {
        remaining.push({
          startFrame: segment.startFrame,
          endFrameExclusive: exclusion.startFrame,
        });
      }
      if (segment.endFrameExclusive > exclusion.endFrameExclusive) {
        remaining.push({
          startFrame: exclusion.endFrameExclusive,
          endFrameExclusive: segment.endFrameExclusive,
        });
      }
      return remaining;
    });
  }
  return segments;
};

const semanticScenes = plan.semanticLayers.flatMap((layer) => {
  const layerFrames = {
    startFrame: toFrame(layer.startSeconds),
    endFrameExclusive: toFrame(layer.endSeconds),
  };
  const effectFrames = renderableEffects
    .filter((effect) => overlaps(effect.frames, layerFrames))
    .map((effect) => effect.frames);
  return subtractFrameRanges(layerFrames, effectFrames).map((segment, index) => ({
    ...layer,
    id: effectFrames.length ? `${layer.id}-v8-segment-${index + 1}` : layer.id,
    startSeconds: segment.startFrame / fps,
    endSeconds: segment.endFrameExclusive / fps,
  }));
});

const scenes: V72ProductionScene[] = [
  ...plan.paperClips.map<V72CustomScene>((clip) => ({
    id: `paper-${clip.id}`,
    start: clip.startSeconds,
    end: clip.startSeconds + clip.durationSeconds,
    kind: 'custom',
    customKey: 'paper-editorial',
    data: clip as unknown as Record<string, unknown>,
    background: 'talk',
    zIndex: 180,
  })),
  ...semanticScenes.map<V72CustomScene>((layer) => ({
    id: layer.id,
    start: layer.startSeconds,
    end: layer.endSeconds,
    kind: 'custom',
    customKey: 'v8-semantic',
    data: layer as unknown as Record<string, unknown>,
    background: 'talk',
    zIndex: 90,
  })),
  ...renderableEffects.map<V72CustomScene>((effect) => ({
    id: `shotcraft-${effect.beatId}`,
    start: effect.frames.startFrame / fps,
    end: effect.frames.endFrameExclusive / fps,
    kind: 'custom',
    customKey: 'shotcraft',
    data: effect as unknown as Record<string, unknown>,
    background: 'talk',
    zIndex: 110,
  })),
].sort((left, right) => left.start - right.start || (left.zIndex ?? 0) - (right.zIndex ?? 0));

const sfxCues: V72SfxCue[] = plan.sfxCues.map((cue) => ({
  id: cue.id,
  time: isFiniteNumber(cue.time) ? cue.time : (cue.frame ?? 0) / fps,
  src: cue.src,
  file: cue.src.split('/').at(-1) ?? cue.id,
  volume: cue.volume,
}));

const config: V72ProductionConfig = {
  durationSeconds,
  sourceVideo: plan.sourceVideo,
  captionsSrc: plan.captionsSrc,
  captionMode: 'bilingual',
  captionVariant: 'transparent-v8',
  brandLabel: plan.brandLabel,
  sourceObjectFit: 'cover',
  sourceFilter: 'contrast(1.02) saturate(1.015) brightness(1.002)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.14) 0%, rgba(2,7,12,0.02) 43%, rgba(2,7,12,0.025) 100%)',
  motion: {
    cuts: [
      ...plan.paperClips.flatMap((clip) => [
        clip.startSeconds,
        clip.startSeconds + clip.durationSeconds,
      ]),
      ...plan.semanticLayers.map((layer) => layer.startSeconds),
      durationSeconds,
    ],
    baseScale: 1.004,
    peakScales: [1.014, 1.011, 1.016, 1.012, 1.015, 1.011],
    peakX: [-3, 2, -2, 3, -2, 2],
    peakY: [-1, 0, -1, 0, -1, 0],
    transformOrigin: '61% 43%',
  },
  scenes,
  sfxCues,
};

const PaperEditorialScene: React.FC<{clip: PaperClipPlan}> = ({clip}) => {
  const frame = useCurrentFrame();
  const sceneFrames = toFrame(clip.durationSeconds);
  const fadeFrames = Math.min(
    plan.timingRuntime.paperFadeFrames,
    Math.max(2, Math.floor(sceneFrames / 5)),
  );
  const opacity = Math.min(
    interpolate(frame, [0, fadeFrames], [0, 1], {
      ...clamp,
      easing: Easing.inOut(Easing.cubic),
    }),
    interpolate(
      frame,
      [Math.max(fadeFrames, sceneFrames - fadeFrames), sceneFrames],
      [1, 0],
      {...clamp, easing: Easing.inOut(Easing.cubic)},
    ),
  );

  return (
    <AbsoluteFill style={{background: '#0B1015', opacity}}>
      <Video
        src={staticFile(clip.asset)}
        muted
        style={{width: '100%', height: '100%', objectFit: 'contain'}}
      />
      <div
        style={{
          position: 'absolute',
          right: 42,
          top: 58,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 7,
          color: '#F8FAFD',
          fontFamily,
          textShadow: '0 2px 9px rgba(0,0,0,0.92)',
        }}
      >
        <div
          style={{
            padding: '7px 12px',
            background: 'rgba(4,8,12,0.78)',
            borderLeft: '4px solid #F0C765',
            fontSize: 24,
            fontWeight: 900,
          }}
        >
          {plan.paperDisclosure.primary}
        </div>
        <div
          style={{
            padding: '5px 10px',
            background: 'rgba(4,8,12,0.7)',
            color: '#C9D2D8',
            fontSize: 19,
            fontWeight: 800,
          }}
        >
          {plan.paperDisclosure.secondary}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SemanticScene: React.FC<{scene: SemanticLayerPlan}> = ({scene}) => {
  const layer: V8SemanticLayer = {
    id: scene.id,
    start: scene.startSeconds,
    end: scene.endSeconds,
    title: scene.title,
    detail: scene.detail,
    items: scene.items,
    params: {component: scene.component},
  };

  switch (scene.component) {
    case 'comparison':
      return <V8ComparisonBars layer={layer} />;
    case 'process':
      return <V8ProcessRail layer={layer} />;
    case 'question-list':
      return <V8QuestionList layer={layer} />;
    case 'hero-definition':
      return <V8HeroDefinition layer={layer} />;
    case 'status-stack':
      return <V8StatusStack layer={layer} />;
    case 'rights-rail':
      return <V8RightsRail layer={layer} />;
    case 'closing':
      return <V8Closing layer={layer} />;
    case 'direct-statement':
      return <V8DirectStatement layer={layer} />;
  }
};

const stringProp = (
  props: Record<string, unknown>,
  key: string,
  fallback = '',
) => (typeof props[key] === 'string' ? props[key] : fallback);

const numberProp = (
  props: Record<string, unknown>,
  key: string,
  fallback: number,
) => (isFiniteNumber(props[key]) ? props[key] : fallback);

const ShotcraftScene: React.FC<{effect: ShotcraftEffectPlan}> = ({effect}) => {
  const frame = useCurrentFrame();
  const duration = effect.frames.endFrameExclusive - effect.frames.startFrame;
  const region = effect.region;
  const props = effect.componentProps;
  if (!effect.effectId || !region || !props) return null;

  const timing = {frame, fps, durationInFrames: duration};
  let content: React.ReactNode = null;

  switch (effect.effectId) {
    case 'marker-underline':
      content = (
        <MarkerUnderline
          {...timing}
          before={stringProp(props, 'before')}
          keyword={stringProp(props, 'keyword', effect.texts?.[0] ?? '')}
          after={stringProp(props, 'after')}
          fontSize={numberProp(props, 'fontSize', 58)}
        />
      );
      break;
    case 'keyword-reveal': {
      const items = Array.isArray(props.items)
        ? props.items.flatMap((item) =>
            isRecord(item) &&
            typeof item.text === 'string' &&
            Number.isInteger(item.atFrame)
              ? [{text: item.text, atFrame: item.atFrame as number}]
              : [],
          )
        : [];
      content = (
        <KeywordReveal
          {...timing}
          items={items}
          fontSize={numberProp(props, 'fontSize', 54)}
        />
      );
      break;
    }
    case 'evidence-scan': {
      const rect = isRect(props.rect)
        ? props.rect
        : {x: 0, y: 0, width: region.width, height: region.height};
      content = (
        <EvidenceScan
          {...timing}
          width={numberProp(props, 'width', region.width)}
          height={numberProp(props, 'height', region.height)}
          rect={rect}
          label={stringProp(props, 'label', effect.texts?.[0] ?? '')}
        />
      );
      break;
    }
    case 'line-carry':
      content = (
        <LineCarry
          {...timing}
          fromLabel={stringProp(
            props,
            'fromLabel',
            effect.texts?.[0] ?? '',
          )}
          toLabel={stringProp(props, 'toLabel', effect.texts?.[1] ?? '')}
          width={numberProp(props, 'width', region.width)}
        />
      );
      break;
    case 'paper-tape-pin':
      content = (
        <PaperTapePin
          {...timing}
          width={numberProp(props, 'width', Math.min(640, region.width))}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 28,
              background: '#F2EBDD',
              color: '#172027',
              fontFamily,
              fontSize: 40,
              fontWeight: 900,
              lineHeight: 1.25,
              textAlign: 'center',
            }}
          >
            {(effect.texts ?? []).join(' · ')}
          </div>
        </PaperTapePin>
      );
      break;
  }

  return (
    <div
      data-shotcraft-effect={effect.effectId}
      data-shotcraft-beat={effect.beatId}
      style={{
        position: 'absolute',
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height,
        overflow: effect.effectId === 'evidence-scan' ? 'hidden' : 'visible',
      }}
    >
      {content}
    </div>
  );
};

const renderCustomScene = (scene: V72CustomScene) => {
  if (scene.customKey === 'paper-editorial') {
    return <PaperEditorialScene clip={scene.data as unknown as PaperClipPlan} />;
  }
  if (scene.customKey === 'v8-semantic') {
    return (
      <Sequence from={-plan.timingRuntime.semanticPrerollFrames}>
        <SemanticScene scene={scene.data as unknown as SemanticLayerPlan} />
      </Sequence>
    );
  }
  if (scene.customKey === 'shotcraft') {
    return <ShotcraftScene effect={scene.data as unknown as ShotcraftEffectPlan} />;
  }
  return null;
};

const CandidateStatus: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: 24,
      zIndex: 360,
      transform: 'translateX(-50%)',
      padding: '9px 18px',
      border: '2px solid rgba(255,196,94,0.92)',
      background: 'rgba(4,8,12,0.86)',
      color: '#FFD06D',
      fontFamily,
      fontSize: 24,
      fontWeight: 950,
      letterSpacing: 0,
      whiteSpace: 'nowrap',
      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
    }}
  >
    {plan.candidateLabel}
  </div>
);

export const LanzhouIndustryAIV91CandidateR1: React.FC<{
  soundEnabled?: boolean;
  showCandidateStatus?: boolean;
}> = ({soundEnabled = true, showCandidateStatus = true}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={showCandidateStatus ? <CandidateStatus /> : null}
  />
);

export const LanzhouIndustryAIV91CandidateR1WithSfx: React.FC = () => (
  <LanzhouIndustryAIV91CandidateR1 soundEnabled />
);

export const LanzhouIndustryAIV91CandidateR1NoSfx: React.FC = () => (
  <LanzhouIndustryAIV91CandidateR1 soundEnabled={false} />
);

export const LanzhouIndustryAIV91PublishR2WithSfx: React.FC = () => (
  <LanzhouIndustryAIV91CandidateR1 soundEnabled showCandidateStatus={false} />
);
