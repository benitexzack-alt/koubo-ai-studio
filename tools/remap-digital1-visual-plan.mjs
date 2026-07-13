import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error('用法：node tools/remap-digital1-visual-plan.mjs <visual-plan-v1.json> <visual-plan-v2.json>');
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const timing = {
  'hook-ai-cannot-see': [0.44, 13.94, 7.2],
  'fragmented-business-records': [13.94, 24.76, 19.0],
  'digital-one-definition': [34.72, 49.98, 42.3],
  'miit-notice-identity': [50.88, 56.16, 53.5],
  'miit-four-levels': [56.88, 72.24, 64.0],
  'gansu-industrial-evidence': [73.0, 81.74, 77.2],
  'gansu-scope-boundary': [82.56, 96.46, 89.5],
  'three-business-checks': [97.6, 112.62, 105.0],
  'chaos-faster': [112.62, 119.42, 116.0],
  'seven-five-three-method': [120.18, 145.32, 134.0],
  'minimum-digital-flow': [145.92, 152.21, 149.0],
  'local-survey-cta': [152.94, 163.06, 158.0],
  'sample-boundary': [163.06, 171.24, 167.5],
};

for (const layer of plan.layers ?? []) {
  const values = timing[layer.id];
  if (!values) {
    throw new Error(`缺少图层实录时间：${layer.id}`);
  }

  const [start, end, reviewAt] = values;
  layer.start = start;
  layer.end = end;
  layer.checks = {...layer.checks, reviewAt};
}

plan.status = 'actual-word-timeline-ready-for-render';
plan.sourceVideo = 'source/DIGITAL1_20260714_talk01_16x9.MOV';
plan.compatibleVideo = 'remotion/public/media/DIGITAL1_20260714_talk01_16x9_input.mp4';
plan.transcript = 'edit/transcripts/DIGITAL1_20260714_talk01_16x9.json';
plan.bilingualCaptions = 'remotion/public/data/DIGITAL1_20260714_talk01.bilingual.v1.json';
plan.strategy =
  '用户明确要求全量保留并直接按已确认V4方案出片；时间已按最新原片Scribe v2词级转写重映射。16:9不变，真人为主，官方截图承担事实证据，确定性V4组件承担解释；不使用GPT生图、AI视频或AI配音。跳过单独粗剪确认，但仍执行内部预览、风险帧和机器质检。';
plan.digitalCamera = {
  enabled: true,
  appliesTo: 'background-video-only',
  transformOrigin: '67% 38%',
  scaleRange: [1.012, 1.043],
  translateXRangePx: [-4, 12],
  cues: [
    {at: 0, scale: 1.012, x: 0, reason: '开场稳定'},
    {at: 6.4, scale: 1.034, x: 6, reason: '没有提效'},
    {at: 13.94, scale: 1.022, x: 4, reason: '进入问题拆解'},
    {at: 24.76, scale: 1.018, x: 8, reason: '资料不能散'},
    {at: 34.72, scale: 1.038, x: 8, reason: '定义数字化1.0'},
    {at: 50.88, scale: 1.018, x: 0, reason: '证据全屏不作用于截图'},
    {at: 82.56, scale: 1.026, x: 6, reason: '回到真人解释口径'},
    {at: 97.6, scale: 1.018, x: 5, reason: '三个问题'},
    {at: 112.62, scale: 1.043, x: 10, reason: '混乱跑得更快'},
    {at: 120.18, scale: 1.02, x: 6, reason: '七天行动'},
    {at: 145.92, scale: 1.036, x: 9, reason: '流程留下来'},
    {at: 152.94, scale: 1.022, x: 6, reason: '调查CTA'},
    {at: 171.62, scale: 1.034, x: 8, reason: '品牌收尾'},
    {at: 174.85, scale: 1.034, x: 8, reason: '保持末帧'},
  ],
};
plan.deferred = (plan.deferred ?? []).filter((item) => item.type !== 'exact-timing');

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
console.log(`已按实录词级时间轴重映射：${outputPath}`);
