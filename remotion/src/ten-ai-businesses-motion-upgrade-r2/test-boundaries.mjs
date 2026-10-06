import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertAssetResponse, requiredAssets} from './assets.ts';
import {TILE_CELLS, cardScreenBounds, cardState, sourceFrame, soundEnvelope, statementOpacity, tileOpacity, titleLayerFrames, titleState} from './motion.ts';
import {ASSETS, CARD_ENTRY_DURATION, CARD_ROW, DEMO_FRAMES, FACE_PROTECTION, FPS, HEIGHT, SCENES, SOUND_CUES, SUBTITLE_PROTECTION, TILE, TITLE, TITLE_LAYER_ORDER, TITLE_MOTION, TITLE_PAINTED_WIDTH, TITLE_VIDEO_STYLE, TOOLS, TYPE, WIDTH} from './plan.ts';

const directory = dirname(fileURLToPath(import.meta.url));
let passed = 0;
const check = (name, run) => {run(); passed++; console.log(`通过：${name}`);};
const source = (file) => readFileSync(resolve(directory, file), 'utf8');
check('三个完整连续窗口衔接，独立20.2秒', () => {
  assert.equal(WIDTH, 1920); assert.equal(HEIGHT, 1080); assert.equal(FPS, 30);
  assert.equal(DEMO_FRAMES, 606);
  assert.deepEqual(SCENES.map((scene) => scene.duration), [162, 204, 240]);
  let next = 0;
  for (const scene of SCENES) {assert.equal(scene.from, next); next += scene.duration;}
  assert.equal(next, DEMO_FRAMES);
});
check('标题锁定1730px SVG字面，底片/真实matte绝对定位且同几何', () => {
  assert.equal(TITLE, '10个AI赚钱生意'); assert.equal(TITLE_PAINTED_WIDTH, 1730);
  assert.deepEqual(TITLE_VIDEO_STYLE, {
    position: 'absolute', left: 0, top: 0,
    width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%',
    transform: 'translateX(0px) scale(1)', transformOrigin: '50% 50%',
  });
  const effect = source('effects.tsx');
  let previous = -1;
  for (const layer of TITLE_LAYER_ORDER) {
    const position = effect.indexOf(`data-layer="${layer}"`);
    assert.ok(position > previous); previous = position;
  }
  assert.equal((effect.match(/style=\{TITLE_VIDEO_STYLE\}/g) || []).length, 2);
  assert.equal((effect.match(/trimBefore=\{0\} trimAfter=\{duration\} playbackRate=\{1\} muted/g) || []).length, 2);
  assert.ok(effect.includes('muted transparent'));
  assert.ok(effect.includes('textLength={TITLE_PAINTED_WIDTH}'));
});
check('162帧背景与alpha前景同一帧，无静帧、循环或末帧补长', () => {
  for (let frame = 0; frame < SCENES[0].duration; frame++) {
    assert.deepEqual(titleLayerFrames(frame), {background: frame, foreground: frame});
  }
  for (const scene of SCENES) {
    const frames = Array.from({length: scene.duration}, (_, frame) => sourceFrame(scene.kind, frame));
    assert.equal(new Set(frames).size, frames.length);
    assert.equal(frames[0], scene.sourceFrom);
    assert.equal(frames.at(-1), scene.sourceFrom + scene.duration - 1);
    assert.throws(() => sourceFrame(scene.kind, scene.duration), /禁止循环/);
  }
  assert.throws(() => sourceFrame('type-behind-subject', -1));
  assert.throws(() => sourceFrame('type-behind-subject', 1.5));
});
check('标题冲入、小回落、快速清题，最后保持真人', () => {
  assert.equal(titleState(0).opacity, 0);
  assert.ok(titleState(TITLE_MOTION.punchEnd).scale > 1);
  assert.ok(Math.abs(titleState(50).scale - 1) < 1e-9);
  assert.equal(titleState(120).opacity, 1);
  assert.equal(titleState(150).opacity, 0);
  assert.ok(SCENES[0].duration / FPS - TITLE_MOTION.clearEnd / FPS >= 0.5);
});
check('8×5独立格子覆盖全画布，无普通fade替代', () => {
  assert.equal(TILE_CELLS.length, 40);
  assert.equal(new Set(TILE_CELLS.map((cell) => `${cell.column},${cell.row}`)).size, 40);
  assert.equal(TILE.columns * TILE.width, WIDTH); assert.equal(TILE.rows * TILE.height, HEIGHT);
  assert.deepEqual(TILE_CELLS.map((cell) => cell.rank).sort((a, b) => a-b), Array.from({length: 40}, (_, i) => i));
  assert.ok(TILE_CELLS.every((cell) => cell.rank + cell.reverseRank === 39));
  assert.ok(new Set(TILE_CELLS.map((cell) => tileOpacity(40, cell.index))).size > 3);
  assert.ok(TILE_CELLS.every((cell) => tileOpacity(49, cell.index) === 1));
  assert.ok(TILE_CELLS.every((cell) => tileOpacity(122, cell.index) === 0));
});
check('中心先铺、边缘先退，目的地读稳后返回连续原片', () => {
  const ordered = [...TILE_CELLS].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < ordered.length; i++) assert.ok(ordered[i].distance >= ordered[i-1].distance);
  const center = ordered[0], edge = ordered.at(-1);
  assert.ok(tileOpacity(37, center.index) > tileOpacity(37, edge.index));
  assert.ok(tileOpacity(109, center.index) > tileOpacity(109, edge.index));
  assert.equal(statementOpacity(47), 0); assert.equal(statementOpacity(70), 1);
  assert.equal(statementOpacity(107), 0);
});
check('三张真实产品图完整卡片入场，锚点不早于实录名称', () => {
  assert.deepEqual(TOOLS.map((tool) => tool.label), ['豆包工作', 'WorkBuddy', 'Codex']);
  assert.deepEqual(TOOLS.map((tool) => tool.at), [32, 56, 80]);
  for (let index = 0; index < TOOLS.length; index++) {
    const tool = TOOLS[index];
    const actualSeconds = SCENES[2].sourceFrom / FPS + tool.at / FPS;
    assert.ok(actualSeconds >= tool.spokenAtSeconds && actualSeconds - tool.spokenAtSeconds < 1 / FPS);
    assert.equal(cardState(tool.at - 1, index).visible, false);
    assert.ok(cardState(tool.at + 1, index).x < -20);
    assert.ok(cardState(tool.at + 1, index).rotationY > 0);
    assert.ok(cardState(tool.at + 1, index).rotationZ < 0);
    assert.ok(cardState(tool.at + 1, index).scale < 1);
    assert.equal(cardState(tool.at + CARD_ENTRY_DURATION + 1, index).x, 0);
  }
  assert.ok(source('effects.tsx').includes('<Img src={staticFile(tool.image)}'));
});
check('物理运动全程不穿入脸区或字幕区，均匀排列且字体/图标可读', () => {
  assert.ok(TYPE.body >= 44 && TYPE.label >= 32 && CARD_ROW.imageSize >= 92);
  for (let index = 0; index < TOOLS.length; index++) for (let local = 0; local < 240; local += 0.25) {
    const bounds = cardScreenBounds(local, index);
    assert.ok(bounds.top >= FACE_PROTECTION.top + FACE_PROTECTION.height, `${index}/${local}顶${bounds.top}`);
    assert.ok(bounds.bottom <= SUBTITLE_PROTECTION.top, `${index}/${local}底${bounds.bottom}`);
  }
  const centers = TOOLS.map((_, index) => CARD_ROW.left + index * (CARD_ROW.width + CARD_ROW.gap) + CARD_ROW.width / 2);
  assert.equal(centers[1] - centers[0], centers[2] - centers[1]);
  assert.ok(CARD_ROW.top + CARD_ROW.height < SUBTITLE_PROTECTION.top);
});
check('两版原声窗口始终相同，title无音轨时仍读取base对应原声', () => {
  assert.deepEqual(SCENES.map((scene) => scene.narrationFrom), [132, 990, 1110]);
  const sceneDemo = source('SceneDemo.tsx');
  assert.ok(sceneDemo.includes('data-role="original-narration" src={staticFile(ASSETS.base)}'));
  assert.ok(sceneDemo.includes('trimAfter={scene.narrationFrom + scene.duration} playbackRate={1} volume={1}'));
  assert.ok(sceneDemo.indexOf('data-role="original-narration"') < sceneDemo.indexOf('{withSfx ?'));
  assert.equal((source('effects.tsx').match(/playbackRate=\{1\} muted/g) || []).length, 4);
});
check('动作音分角色、落点有界、短瞬态保留，不覆盖原声配置', () => {
  for (const scene of SCENES) {
    let previousEnd = -1;
    for (const cue of SOUND_CUES[scene.kind]) {
      assert.ok(cue.at >= previousEnd && cue.at + cue.duration < scene.duration);
      assert.ok(cue.gain > 0 && cue.gain <= 1);
      assert.ok(cue.source.startsWith('motion-upgrade-r1/sfx/'));
      assert.equal(soundEnvelope(0, cue.duration), 1); assert.equal(soundEnvelope(cue.duration, cue.duration), 0);
      previousEnd = cue.at + cue.duration;
    }
  }
  assert.equal(new Set(SOUND_CUES['cards-foreground-row'].map((cue) => cue.source)).size, 3);
});
check('任意乱序寻帧仍确定、有限，阅读停留无环境漂移', () => {
  const frames = [239, 0, 107, 32, 56, 80, 4, 49, 162, 35, 143, 239, 122];
  for (const frame of frames) {
    assert.deepEqual(titleState(frame), titleState(frame));
    assert.ok(Object.values(titleState(frame)).every(Number.isFinite));
    for (const tile of TILE_CELLS) assert.ok(Number.isFinite(tileOpacity(frame, tile.index)));
    for (let i = 0; i < 3; i++) {
      const state = cardState(frame, i);
      assert.deepEqual(state, cardState(frame, i));
      assert.ok(Object.values(state).filter((value) => typeof value === 'number').every(Number.isFinite));
    }
  }
  for (let i = 0; i < 3; i++) assert.deepEqual(cardState(150, i), cardState(239, i));
});
check('必需资产缺失/空文件/返回网页报错，不降级为假的图像', () => {
  const head = (ok, status, type = 'image/png', length = '123') => ({ok, status,
    headers: {get: (key) => key === 'content-type' ? type : key === 'content-length' ? length : null}});
  assert.throws(() => assertAssetResponse(ASSETS.codex, head(false, 404)), /素材缺失/);
  assert.throws(() => assertAssetResponse(ASSETS.presenterMatte, head(true, 200, 'text/html')), /返回网页/);
  assert.throws(() => assertAssetResponse(ASSETS.font, head(true, 200, 'font/woff2', '0')), /素材为空/);
  assert.doesNotThrow(() => assertAssetResponse(ASSETS.doubao, head(true, 200)));
  assert.equal(requiredAssets(false).length, 7);
  for (const path of Object.values(ASSETS)) assert.ok(requiredAssets(true).includes(path));
  assert.ok(source('index.tsx').includes('await validateAssets(props.withSfx, staticFile, abortSignal)'));
});
check('独立入口与新路径，无默认Root/共享V8/正式渲染依赖', () => {
  const index = source('index.tsx');
  assert.equal((index.match(/<Composition /g) || []).length, 2);
  assert.ok(index.includes('R2-WithSfx') && index.includes('R2-NoSfx'));
  for (const name of readdirSync(directory).filter((name) => /\.tsx?$/.test(name))) {
    const code = source(name);
    assert.ok(!/from\s+['"]\.\.\//.test(code), name);
    assert.ok(!/sharedV8|Root\.tsx|renderMedia|renderStill|gsap|Math\.random|Date\.now|requestAnimationFrame/.test(code), name);
    assert.ok(!/animation\s*:|transition\s*:|https?:\/\//.test(code), name);
    assert.ok(!/<Loop|\bloop=/.test(code), name);
  }
});
console.log(`共${passed}项通过。技术边界通过不代表正常速度视觉、原声混音或正式成片验收。`);
