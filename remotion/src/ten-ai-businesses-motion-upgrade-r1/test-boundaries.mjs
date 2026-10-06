import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {chapterSettle, frameState, progress, soundEnvelope} from './motion.ts';
import {CHAPTERS, DEFAULT_BURST_LINES, DEFAULT_BURST_STATEMENT, DEMO_FRAMES, EFFECT_KINDS, HEIGHT, OVERLAY_BOUNDS, PRESENTER_PROTECTION, SEGMENT_FRAMES, SOUND_ASSETS, SOUND_CUES, SUBTITLE_PROTECTION, TYPE, WIDTH} from './plan.ts';

const candidateDir = dirname(fileURLToPath(import.meta.url));
const remotionDir = resolve(candidateDir, '../..');
let passed = 0;
const check = (name, run) => {run(); passed++; console.log(`通过：${name}`);};
check('六场景 × 八秒，1920 × 1080', () => {assert.equal(DEMO_FRAMES, 1440); assert.equal(WIDTH, 1920); assert.equal(HEIGHT, 1080);});
check('信息层不相交真人或字幕保护区', () => {
  assert.ok(OVERLAY_BOUNDS.left + OVERLAY_BOUNDS.width < PRESENTER_PROTECTION.left);
  assert.ok(OVERLAY_BOUNDS.top + OVERLAY_BOUNDS.height < SUBTITLE_PROTECTION.top);
});
check('字体下限与十个独立章名', () => {
  assert.ok(TYPE.headline >= 60 && TYPE.body >= 44 && TYPE.label >= 32);
  assert.equal(CHAPTERS.length, 10);
  for (const chapter of CHAPTERS) {assert.ok(chapter.length <= 2); assert.ok(chapter.every((line) => line.length <= 12));}
});
check('开头大卡锁定用户指定词，不改变原声或字幕', () => {
  assert.equal(DEFAULT_BURST_STATEMENT, '10个AI赚钱生意');
  assert.equal(DEFAULT_BURST_LINES.join(''), DEFAULT_BURST_STATEMENT);
  assert.equal(DEFAULT_BURST_LINES.length, 2);
  const source = readFileSync(resolve(candidateDir, 'effects.tsx'), 'utf8');
  assert.ok(source.includes('statement = DEFAULT_BURST_STATEMENT'));
  assert.ok(source.includes('fontSize: 104'));
});
check('边界及乱序寻帧全部有限、确定', () => {
  const boundaries = [-1, 0, 4, 5, 10, 15, 16, 22, 47, 60, 66, 72, 79, 83, 97, 102, 123, 149, 168, 239, 240];
  for (const kind of EFFECT_KINDS) for (const frame of boundaries) {
    const state = frameState(kind, frame);
    assert.ok(state.every(Number.isFinite));
    assert.deepEqual(frameState(kind, 199), frameState(kind, 199));
    assert.deepEqual(state, frameState(kind, frame));
  }
});
check('动作顺序：初词退出后再对照；最后收束并读稳', () => {
  assert.equal(frameState('opposing', 60)[0], 0);
  assert.equal(frameState('opposing', 60)[1], 0);
  assert.equal(frameState('opposing', 60)[2], 0);
  assert.ok(frameState('pipeline', 125)[4] > 0.99);
  assert.equal(frameState('pipeline', 125)[6], 0);
  assert.deepEqual(frameState('pipeline', 199), frameState('pipeline', 239));
  assert.deepEqual(frameState('equation', 199), frameState('equation', 239));
  assert.ok(Math.abs(chapterSettle(199) - 1) < 0.0001);
  assert.equal(progress(-1, 0, 10), 0); assert.equal(progress(20, 0, 10), 1);
});
check('派生音效本地存在、动作帧有界、无前景重叠、不二次压低增益', () => {
  for (const asset of Object.values(SOUND_ASSETS)) {
    assert.ok(asset.peakOffsetFrames >= 0 && asset.peakOffsetFrames <= 2);
    assert.ok(asset.peakDbfs >= -20 && asset.peakDbfs <= -14);
  }
  for (const kind of EFFECT_KINDS) {
    let previousEnd = -1;
    for (const cue of SOUND_CUES[kind]) {
      assert.ok(cue.at >= previousEnd); assert.ok(cue.at >= 0 && cue.at + cue.duration <= SEGMENT_FRAMES);
      assert.equal(cue.gain, 1); assert.ok(cue.source.startsWith('motion-upgrade-r1/sfx/'));
      assert.ok(!cue.source.includes('://'));
      assert.ok(existsSync(resolve(remotionDir, 'public', cue.source)), cue.source);
      assert.equal(soundEnvelope(0, cue.duration), 1);
      assert.equal(soundEnvelope(cue.duration, cue.duration), 0);
      previousEnd = cue.at + cue.duration;
    }
  }
});
check('本目录无时间驱动动画、随机数、远程素材、原始音频上传', () => {
  for (const name of readdirSync(candidateDir).filter((name) => /\.tsx?$/.test(name))) {
    const source = readFileSync(resolve(candidateDir, name), 'utf8');
    assert.ok(!/Date\.now|Math\.random|setInterval|setTimeout|requestAnimationFrame|gsap|https?:\/\//.test(source), name);
    assert.ok(!/animation\s*:|transition\s*:/.test(source), name);
  }
});
console.log(`共 ${passed} 项通过。只证明限定技术边界，不证明视觉、混音或本期成片验收。`);
