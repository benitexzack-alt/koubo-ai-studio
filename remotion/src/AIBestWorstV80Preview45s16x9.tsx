import React from 'react';
import {
  V72ProductionShell,
  type V72CustomScene,
  type V72ProductionConfig,
  type V72ProductionScene,
  type V72SfxCue,
} from './components/V72ProductionShell';
import {
  V8DirectStatement,
  type V8SemanticLayer,
} from './components/V8SemanticStage';
import {
  V8BestWorstPrimitiveStage,
  type V8BestWorstPrimitive,
} from './components/V8BestWorstPrimitives';

const fps = 30;
const durationSeconds = 45;
const f = (seconds: number) => Math.round(seconds * fps);

export const AI_BEST_WORST_V80_PREVIEW_DURATION_IN_FRAMES = f(durationSeconds);

type PreviewSceneData = {
  semantic?: V8SemanticLayer;
  primitive?: V8BestWorstPrimitive;
};

const semanticLayer = (
  id: string,
  start: number,
  end: number,
  title: string,
  detail: string,
  items: string[],
): V8SemanticLayer => ({
  id,
  start,
  end,
  title,
  detail,
  items,
  params: {component: 'statement'},
});

const scenes: V72ProductionScene[] = [
  {
    id: 'bw-preview-v001-time-compression',
    start: 0.3,
    end: 5,
    kind: 'custom',
    customKey: 'statement',
    background: 'talk',
    data: {
      semantic: semanticLayer(
        'bw-preview-v001-time-compression',
        0.3,
        5,
        '30年 → 这一次等不了30年',
        '技术变化正在压缩位置重排的时间。',
        ['周期压缩', '位置变化'],
      ),
    } satisfies PreviewSceneData,
  },
  {
    id: 'bw-preview-v002-fork',
    start: 5.06,
    end: 12.74,
    kind: 'custom',
    customKey: 'primitive',
    background: 'talk',
    data: {
      primitive: {
        kind: 'fork',
        title: '同样一套 AI，结果为什么不同？',
        input: '同一套 AI',
        left: '价值被稀释',
        right: '能力被放大',
        leftHint: '只剩标准执行',
        rightHint: '判断、取舍、担责',
      },
    } satisfies PreviewSceneData,
  },
  {
    id: 'bw-preview-v003-control',
    start: 12.74,
    end: 21.59,
    kind: 'custom',
    customKey: 'statement',
    background: 'talk',
    data: {
      semantic: semanticLayer(
        'bw-preview-v003-control',
        12.74,
        21.59,
        '工具差距，不是核心差距',
        '真正的分界，在于掌控权。',
        ['AI支配你', '你掌控AI'],
      ),
    } satisfies PreviewSceneData,
  },
  {
    id: 'bw-preview-v004-responsibility',
    start: 21.59,
    end: 27.61,
    kind: 'custom',
    customKey: 'statement',
    background: 'talk',
    data: {
      semantic: semanticLayer(
        'bw-preview-v004-responsibility',
        21.59,
        27.61,
        'AI产出答案，人对结果负责',
        '判断、取舍、最终定夺，责任不能外包。',
        ['判断', '取舍', '负责'],
      ),
    } satisfies PreviewSceneData,
  },
  {
    id: 'bw-preview-v005-decision-chain',
    start: 27.61,
    end: 45,
    kind: 'custom',
    customKey: 'primitive',
    background: 'talk',
    data: {
      primitive: {
        kind: 'decision-chain',
        title: 'AI给出一版后，人还要做什么？',
        items: ['盘点真实任务', '补充真实背景', '判断与取舍', '决定最终采用', '对结果负责'],
      },
    } satisfies PreviewSceneData,
  },
];

const sfxCues: V72SfxCue[] = [
  {
    id: 'bw-preview-sfx-001',
    time: 0.3,
    file: 'v3-chapter-sweep-a.wav',
    src: 'audio/koubo-sfx-v8/v3-chapter-sweep-a.wav',
    volume: 0.22,
  },
  {
    id: 'bw-preview-sfx-002',
    time: 5.06,
    file: 'remotion-ui-switch.wav',
    src: 'audio/koubo-sfx-v8/remotion-ui-switch.wav',
    volume: 0.23,
  },
  {
    id: 'bw-preview-sfx-003',
    time: 12.74,
    file: 'v1-keyword-tick.wav',
    src: 'audio/koubo-sfx-v8/v1-keyword-tick.wav',
    volume: 0.22,
  },
  {
    id: 'bw-preview-sfx-004',
    time: 21.59,
    file: 'v3-soft-card-pop-b.wav',
    src: 'audio/koubo-sfx-v8/v3-soft-card-pop-b.wav',
    volume: 0.23,
  },
  {
    id: 'bw-preview-sfx-005',
    time: 27.61,
    file: 'v3-line-connect-a.wav',
    src: 'audio/koubo-sfx-v8/v3-line-connect-a.wav',
    volume: 0.22,
  },
];

const config: V72ProductionConfig = {
  durationSeconds,
  sourceVideo: 'media/ai-best-worst-20260812/main-30fps.mp4',
  captionsSrc: 'data/AI_BEST_WORST_20260812_talk01.bilingual.v1.json',
  captionVariant: 'transparent-v8',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.022) saturate(1.012) brightness(0.998)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.18) 0%, rgba(2,7,12,0.035) 39%, rgba(2,7,12,0.005) 100%)',
  motion: {
    cuts: [0, 5.06, 12.74, 21.59, 27.61, 45],
    baseScale: 1.008,
    peakScales: [1.032, 1.025, 1.034, 1.027, 1.033],
    peakX: [-7, 5, -5, 4, -6],
    peakY: [-2, -1, -2, -1, -2],
    transformOrigin: '56% 42%',
  },
  scenes,
  sfxCues,
};

const renderCustomScene = (scene: V72CustomScene) => {
  const data = (scene.data ?? {}) as PreviewSceneData;
  if (scene.customKey === 'primitive' && data.primitive) {
    return <V8BestWorstPrimitiveStage scene={data.primitive} />;
  }
  if (data.semantic) {
    return <V8DirectStatement layer={data.semantic} />;
  }
  return null;
};

const AIBestWorstV80Preview45s16x9: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
  />
);

export const AIBestWorstV80Preview45s16x9WithSfx: React.FC = () => (
  <AIBestWorstV80Preview45s16x9 soundEnabled />
);

export const AIBestWorstV80Preview45s16x9NoSfx: React.FC = () => (
  <AIBestWorstV80Preview45s16x9 soundEnabled={false} />
);
