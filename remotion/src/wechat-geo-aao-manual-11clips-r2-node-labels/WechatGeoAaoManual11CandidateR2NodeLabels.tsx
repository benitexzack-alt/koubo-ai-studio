import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  WECHAT_GEO_AAO_MANUAL_R2_DURATION_IN_FRAMES,
  WechatGeoAaoManual11CandidateR2WithSfx,
} from '../wechat-geo-aao-manual-11clips-r2/WechatGeoAaoManual11CandidateR2';

const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

type NodeLabelScene = {
  id: string;
  start: number;
  end: number;
  labels: string[];
};

const nodeLabelScenes: NodeLabelScene[] = [
  {
    id: 'P01',
    start: 33.76,
    end: 45.33,
    labels: ['刷短视频', '翻评价', '开地图', '问朋友'],
  },
  {
    id: 'P02',
    start: 62.96,
    end: 75.28,
    labels: ['说清需求', '定位地图', '进入门店', '接上服务'],
  },
  {
    id: 'P03',
    start: 82.56,
    end: 89.852,
    labels: ['位置', '人数', '口味', '预算'],
  },
  {
    id: 'P04',
    start: 96.82,
    end: 104.12,
    labels: ['大量候选', '条件筛选', '少数匹配'],
  },
  {
    id: 'P05',
    start: 125.74,
    end: 133.032,
    labels: ['地图', '营业时间', '菜单', '线上入口'],
  },
  {
    id: 'P06',
    start: 143.02,
    end: 150.312,
    labels: ['老地址', '旧时间', '旧菜单', '路径断开'],
  },
  {
    id: 'P07',
    start: 173.01,
    end: 182.05,
    labels: ['地址', '日期', '价格', '营业信息'],
  },
  {
    id: 'P08',
    start: 195.6,
    end: 202.9,
    labels: ['找到店', '看菜单', '订位', '问停车'],
  },
  {
    id: 'P09',
    start: 216.59,
    end: 227.48,
    labels: ['下一件事', '明确动作', '真实完成', '可以验收'],
  },
  {
    id: 'P10',
    start: 227.48,
    end: 234.772,
    labels: ['多个应用', 'AI收窄', '用户确认', '完成动作'],
  },
  {
    id: 'P11',
    start: 296.52,
    end: 304.48,
    labels: ['GEO识别', 'AAO承接', '服务入口', '客户不走丢'],
  },
];

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const PaperNodeFlow: React.FC<{scene: NodeLabelScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const localFrame = frame - Math.round(scene.start * fps);
  const durationInFrames = Math.round((scene.end - scene.start) * fps);
  const revealStep = Math.max(13, Math.floor((durationInFrames - 36) / scene.labels.length));
  const exit = interpolate(
    localFrame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    clamp,
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: 846,
        top: 168,
        zIndex: 200,
        width: 1018,
        display: 'grid',
        gridTemplateColumns: `repeat(${scene.labels.length}, minmax(0, 1fr))`,
        alignItems: 'center',
        gap: 20,
        opacity: exit,
        fontFamily,
        pointerEvents: 'none',
      }}
    >
      {scene.labels.map((label, index) => {
        const reveal = spring({
          frame: localFrame - 8 - index * revealStep,
          fps,
          config: {damping: 20, stiffness: 190, mass: 0.78},
        });
        const activeStart = 8 + index * revealStep;
        const activeEnd =
          index === scene.labels.length - 1
            ? durationInFrames
            : 8 + (index + 1) * revealStep;
        const active = interpolate(
          localFrame,
          [activeStart - 3, activeStart + 4, activeEnd - 4, activeEnd + 3],
          [0, 1, 1, 0],
          clamp,
        );
        const rotation = [-1.1, 0.7, -0.5, 0.9][index % 4];
        return (
          <React.Fragment key={`${scene.id}-${label}`}>
            <div
              style={{
                position: 'relative',
                minHeight: 92,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '15px 13px 13px',
                boxSizing: 'border-box',
                color: '#15212B',
                background: active > 0.5 ? '#FFD56A' : '#F2E8D1',
                border: '2px solid rgba(28,45,58,0.5)',
                borderRadius: 3,
                boxShadow:
                  active > 0.5
                    ? '0 16px 38px rgba(255,190,74,0.34), 0 5px 12px rgba(0,0,0,0.3)'
                    : '0 12px 30px rgba(0,0,0,0.32)',
                fontSize: [...label].length >= 6 ? 28 : 32,
                lineHeight: 1.08,
                fontWeight: 950,
                textAlign: 'center',
                letterSpacing: 0,
                opacity: reveal,
                transform: `translateY(${interpolate(reveal, [0, 1], [18, 0])}px) rotate(${rotation}deg) scale(${interpolate(reveal, [0, 1], [0.9, 1])})`,
                transformOrigin: 'center center',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 8,
                  color: active > 0.5 ? '#8B3A2A' : '#557084',
                  fontSize: 15,
                  fontWeight: 950,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: -7,
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  background: '#B84D3D',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.38)',
                  transform: 'translateX(-50%)',
                }}
              />
              <span style={{paddingTop: 8}}>{label}</span>
            </div>
            {index < scene.labels.length - 1 ? (
              <div
                style={{
                  position: 'absolute',
                  left: `calc(${((index + 1) / scene.labels.length) * 100}% - 11px)`,
                  top: 42,
                  width: 22,
                  height: 3,
                  background: '#68DAFF',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
                  opacity: reveal,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    right: -1,
                    top: -5,
                    width: 0,
                    height: 0,
                    borderTop: '6px solid transparent',
                    borderBottom: '6px solid transparent',
                    borderLeft: '9px solid #68DAFF',
                  }}
                />
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const NodeLabelOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const scene = nodeLabelScenes.find(
    (candidate) => seconds >= candidate.start && seconds < candidate.end,
  );
  return scene ? <PaperNodeFlow scene={scene} /> : null;
};

export const WECHAT_GEO_AAO_MANUAL_R2_NODE_LABELS_DURATION_IN_FRAMES =
  WECHAT_GEO_AAO_MANUAL_R2_DURATION_IN_FRAMES;

export const WechatGeoAaoManual11CandidateR2NodeLabelsWithSfx: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    <WechatGeoAaoManual11CandidateR2WithSfx />
    <NodeLabelOverlay />
  </AbsoluteFill>
);
