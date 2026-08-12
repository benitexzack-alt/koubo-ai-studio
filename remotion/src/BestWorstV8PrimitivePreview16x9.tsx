import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {
  V8BestWorstPrimitiveStage,
  type V8BestWorstPrimitive,
} from './components/V8BestWorstPrimitives';

const fps = 30;
const sceneSeconds = 4;
const sceneFrames = sceneSeconds * fps;

const scenes: V8BestWorstPrimitive[] = [
  {
    kind: 'fork',
    title: '同样一套 AI，结果为什么不同？',
    input: '同一套 AI',
    left: '价值被稀释',
    right: '能力被放大',
    leftHint: '只剩标准执行',
    rightHint: '判断、取舍、担责',
  },
  {
    kind: 'decision-chain',
    title: 'AI 给初稿，人负责什么？',
    items: ['AI先做一版', '补充真实背景', '判断与取舍', '决定最终采用', '对结果负责'],
  },
  {
    kind: 'training-ladder',
    title: '新人靠什么练出判断？',
    items: ['基础执行', '例外问题', '判断责任'],
    removedIndex: 0,
  },
  {
    kind: 'bounded-number',
    title: '16%不能脱离边界',
    value: '16%',
    boundaries: ['美国数据', '22至25岁', '高AI暴露职业', '相对就业下降'],
  },
  {
    kind: 'j-curve',
    title: '工具装上，不等于生产率立刻出现',
    items: ['流程', '新产品', '商业模式', '人的技能'],
  },
  {
    kind: 'three-ledgers',
    title: '最好和最坏为什么能同时发生？',
    items: ['技术创造的总价值', '消费者得到的便利', '劳动者收入与议价能力'],
  },
];

export const BEST_WORST_V8_PRIMITIVE_PREVIEW_DURATION_IN_FRAMES =
  scenes.length * sceneFrames;

export const BestWorstV8PrimitivePreview16x9: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'linear-gradient(90deg, #121923 0%, #151E27 48%, #2B3136 100%)',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        right: 120,
        top: 120,
        width: 670,
        height: 780,
        border: '1px dashed rgba(248,250,253,0.12)',
        background:
          'linear-gradient(180deg, rgba(248,250,253,0.03), rgba(248,250,253,0.005))',
      }}
    />
    <div
      style={{
        position: 'absolute',
        right: 270,
        top: 210,
        width: 350,
        height: 540,
        borderRadius: '46% 46% 22% 22%',
        background: 'rgba(248,250,253,0.035)',
        border: '1px solid rgba(248,250,253,0.07)',
      }}
    />
    {scenes.map((scene, index) => (
      <Sequence
        key={`${scene.kind}-${index}`}
        from={index * sceneFrames}
        durationInFrames={sceneFrames}
      >
        <V8BestWorstPrimitiveStage scene={scene} />
      </Sequence>
    ))}
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 62,
        color: '#F8FAFD',
        fontFamily: '"Koubo Heiti", "PingFang SC", sans-serif',
        fontSize: 18,
        fontWeight: 900,
      }}
    >
      <span style={{color: '#64D8FF'}}>■</span> 超哥AI创业记
    </div>
    <div
      style={{
        position: 'absolute',
        left: 480,
        right: 480,
        bottom: 70,
        height: 112,
        background: 'rgba(4,10,16,0.32)',
        borderTop: '1px solid rgba(248,250,253,0.12)',
      }}
    />
  </AbsoluteFill>
);
