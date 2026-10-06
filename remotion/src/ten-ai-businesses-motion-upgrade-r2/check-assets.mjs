import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {requiredAssets} from './assets.ts';
import {ASSETS, FPS, HEIGHT, SCENES, WIDTH} from './plan.ts';

const publicDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
for (const path of requiredAssets(true)) {
  const absolute = resolve(publicDirectory, path);
  assert.ok(existsSync(absolute), `必需素材缺失：${path}`);
  assert.ok(statSync(absolute).size > 0, `必需素材为空：${path}`);
}
for (const path of [ASSETS.doubao, ASSETS.workbuddy, ASSETS.codex]) {
  assert.deepEqual(readFileSync(resolve(publicDirectory, path)).subarray(0, 8), Buffer.from([137,80,78,71,13,10,26,10]), `需要实际PNG：${path}`);
}
assert.equal(readFileSync(resolve(publicDirectory, ASSETS.font)).subarray(0, 4).toString('ascii'), 'wOF2');
const probe = (path) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
  'stream=index,codec_type,width,height,r_frame_rate,nb_frames:stream_tags=alpha_mode',
  '-show_entries', 'format=duration', '-of', 'json', resolve(publicDirectory, path)], {encoding: 'utf8'}));
const base = probe(ASSETS.base), take = probe(ASSETS.titleTake), matte = probe(ASSETS.presenterMatte);
for (const [name, metadata] of [['base', base], ['titleTake', take], ['presenterMatte', matte]]) {
  const video = metadata.streams.find((stream) => stream.codec_type === 'video');
  assert.ok(video, `${name}缺视频轨`);
  assert.equal(video.width, WIDTH); assert.equal(video.height, HEIGHT); assert.equal(video.r_frame_rate, `${FPS}/1`);
}
assert.ok(base.streams.some((stream) => stream.codec_type === 'audio'), 'base没有真实原声音轨');
assert.equal(Number(take.format.duration), 5.4); assert.equal(Number(matte.format.duration), 5.4);
assert.equal(Number(take.streams[0].nb_frames), SCENES[0].duration);
assert.equal(matte.streams[0].tags.ALPHA_MODE, '1', 'matte缺alpha声明');
for (const scene of SCENES) {
  assert.ok((scene.narrationFrom + scene.duration) / FPS <= Number(base.format.duration), `${scene.kind}原声不足`);
  if (scene.source === ASSETS.base) assert.ok((scene.sourceFrom + scene.duration) / FPS <= Number(base.format.duration));
}
console.log('本地素材检查通过：7项主资产与5项短动作音到齐；PNG/WOFF2真实格式；1920×1080/30fps；title与matte均5.4秒；base具真实音轨且覆盖所有原声窗口。');
console.log('alpha声明不单独证明抠像品质或同片段关系，须结合素材回执与实际透明帧审阅。未导出任何视频。');
