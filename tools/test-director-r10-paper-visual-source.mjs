import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentPath = path.join(
  projectRoot,
  'remotion/src/lanzhou-industry-ai-r10-pilot-r1/R10VisualComponents.tsx',
);
const source = fs.readFileSync(componentPath, 'utf8');

const block = (startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `缺少源码标记：${startMarker}`);
  assert.notEqual(end, -1, `缺少源码标记：${endMarker}`);
  return source.slice(start, end);
};

const motionBlock = block('const actionMotion =', 'const PaperGrain');
for (const field of [
  'action.landedFrame',
  'action.motionEndFrameExclusive',
  'action.relationStartFrame',
  'action.relationEndFrameExclusive',
]) {
  assert.ok(motionBlock.includes(field), `动作执行层未读取字段：${field}`);
}
assert.ok(!source.includes('spring('), 'B07不得再用长语义窗spring拉伸动作');
assert.ok(
  !source.includes('action.endFrameExclusive - action.startFrame'),
  'B07不得把语义action终点当作动画时长',
);

const nodeLabelBlock = block('const NodeLabel:', 'const PaperAdornment:');
assert.ok(!/opacity\s*:/.test(nodeLabelBlock), '节点文字不得二次淡入');
assert.ok(!/scale\(/.test(nodeLabelBlock), '节点文字不得二次缩放');
assert.ok(
  nodeLabelBlock.includes('data-text-mounted="rigid-with-paper"'),
  '节点文字必须声明刚性随纸片',
);

const sceneBlock = block(
  'export const PaperBusinessPipelineR10:',
  'export const VisibilityBridgeR10:',
);
assert.equal(
  [...sceneBlock.matchAll(/data-paper-stage=/g)].length,
  2,
  'B07必须恰好包含两个纸面阶段',
);
for (const marker of [
  'data-paper-scene-model="two-stage-match-cut"',
  'data-match-cut-action="public-materials"',
  'data-preserved-causal-chain="confirmed-stage-one"',
  'data-foundation-substrate="business-foundation"',
]) {
  assert.ok(sceneBlock.includes(marker), `B07缺少视觉结构标记：${marker}`);
}

const stageOne = sceneBlock.slice(
  sceneBlock.indexOf('data-paper-stage="internal-workbench"'),
  sceneBlock.indexOf('data-paper-stage="public-production-workbench"'),
);
assert.ok(!stageOne.includes("'business-foundation'"), '第一纸面不得提前出现生意底子语义');

assert.ok(
  sceneBlock.includes('<HeaderToken visible={aiProduction.visible}>→ {paper.actionLabelsZh[\'ai-production\']}</HeaderToken>'),
  'AI整理制作顶栏必须由第五步动作控制',
);
assert.ok(
  sceneBlock.includes('<HeaderToken visible={businessFoundation.visible} accent>→ {paper.actionLabelsZh[\'business-foundation\']}</HeaderToken>'),
  '生意底子顶栏必须由第六步动作控制',
);
const aiStart = sceneBlock.indexOf('actionId="ai-production"');
const foundationStart = sceneBlock.indexOf('actionId="business-foundation"', aiStart);
assert.ok(aiStart > -1 && foundationStart > aiStart, '第五、六步视觉块顺序错误');
const aiBlock = sceneBlock.slice(aiStart, foundationStart);
const foundationBlock = sceneBlock.slice(foundationStart);
assert.ok(aiBlock.includes("node('n9-ai-production')"), '第五步必须显示n9');
assert.ok(!aiBlock.includes("node('n10-business-foundation')"), '第五步不得提前显示n10');
assert.ok(foundationBlock.includes("node('n10-business-foundation')"), '第六步必须显示n10');

console.log('R10纸艺视觉源码回归通过');
