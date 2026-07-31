import React from 'react';
import {
  V72ProductionShell,
  type V72ProductionConfig,
} from './components/V72ProductionShell';

const fps = 30;
export const V72_DATA_DRIVEN_PREVIEW_DURATION_IN_FRAMES = 30 * fps;

const config: V72ProductionConfig = {
  durationSeconds: 30,
  sourceVideo: 'media/cycle-assets-20260730/main-30fps.mp4',
  captionsSrc: 'data/CYCLE_ASSETS_20260730_talk01.bilingual.v1.json',
  brandLabel: '超哥AI创业记',
  motion: {
    cuts: [0, 8, 18, 30],
    baseScale: 1.035,
    peakScales: [1.078, 1.083, 1.075],
    peakX: [-24, -12, 8],
    peakY: [-5, -3, -4],
    transformOrigin: '56% 42%',
  },
  scenes: [
    {
      id: 'chapter-hook',
      kind: 'chapter',
      start: 0,
      end: 8,
      index: '01',
      eyebrow: 'WHAT REMAINS · 热潮退去以后',
      title: '最后能留下什么？',
      subtitle: '不只看谁会赢，更看技术、钱和时间沉淀成什么。',
      tone: 'cyan',
    },
    {
      id: 'three-inputs',
      kind: 'info-stack',
      start: 8,
      end: 18,
      eyebrow: 'THREE INPUTS · 三种投入',
      title: '热潮退去，先看留下什么',
      items: [
        {label: 'TECH', detail: '技术能力', tone: 'cyan'},
        {label: 'CAPITAL', detail: '资金投入', tone: 'amber'},
        {label: 'TIME', detail: '行动时间', tone: 'green'},
      ],
    },
    {
      id: 'fiber-process',
      kind: 'process',
      start: 18,
      end: 24,
      eyebrow: 'INTERNET CYCLE · 互联网周期',
      title: '从建设热潮到重新利用',
      steps: [
        {label: '铺设', detail: '抢着铺光纤'},
        {label: '过剩', detail: '大量线路闲置', tone: 'amber'},
        {label: '需求', detail: '带宽持续增长'},
        {label: '复用', detail: '无需从零再挖', tone: 'green'},
      ],
    },
    {
      id: 'fiber-media',
      kind: 'annotated-media',
      start: 24,
      end: 30,
      background: 'opaque',
      index: '01',
      eyebrow: 'INFRASTRUCTURE',
      title: '底层基础设施',
      facts: [
        {label: '建设', value: '光纤与网络'},
        {label: '周期后', value: '仍可重新利用', tone: 'green'},
      ],
      mediaSrc: 'media/cycle-assets-20260730/01-fiber-construction-30fps.mp4',
      mediaKind: 'video',
      mediaLabel: 'AI生成概念画面',
      mediaFit: 'cover',
    },
  ],
  sfxCues: [
    {
      id: 'preview-section',
      time: 0.15,
      file: 'section-sweep.wav',
      volume: 0.15,
    },
    {
      id: 'preview-stack',
      time: 8,
      file: 'card-slide.wav',
      volume: 0.18,
    },
    {
      id: 'preview-process',
      time: 18,
      file: 'node-select.wav',
      volume: 0.1,
    },
    {
      id: 'preview-media',
      time: 24,
      file: 'evidence-shutter.wav',
      volume: 0.16,
    },
  ],
};

export const V72DataDrivenPreview16x9WithSfx: React.FC = () => (
  <V72ProductionShell config={config} soundEnabled />
);

export const V72DataDrivenPreview16x9NoSfx: React.FC = () => (
  <V72ProductionShell config={config} soundEnabled={false} />
);
