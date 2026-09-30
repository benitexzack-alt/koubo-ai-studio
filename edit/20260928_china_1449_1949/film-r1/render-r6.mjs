import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderMedia, renderStill} from '@remotion/renderer';

const root = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] ?? 'stills';
const revision = process.argv[3] ?? 'a';
if (!['stills', 'proof', 'video'].includes(mode) || !/^[a-z0-9-]+$/.test(revision)) throw new Error('使用 stills / proof / video 和安全版本号。');
const t = JSON.parse(await fs.readFile(path.join(root, 'data/timeline.json'), 'utf8'));
let end = 0;
for (const s of t.scenes) {
  if (s.startFrame !== end || s.durationFrames <= 0) throw new Error('时间轴不连续：' + s.id);
  end += s.durationFrames;
  await fs.access(path.join(root, 'public/assets', s.artKey + '.png'));
}
if (end !== 6497) throw new Error('时间轴总帧数错误。');
const music = path.join(root, 'public/audio/music.mp3');
await fs.access(music);
const dir = path.join(root, mode === 'video' ? 'exports' : 'verify', 'r6-' + revision);
await fs.mkdir(dir, {recursive: true});
const bundleDir = await fs.mkdtemp(path.join(root, '.bundle-run-r6-'));
const started = Date.now();
let browser;
try {
  const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.tsx'), rootDir: root, publicDir: path.join(root, 'public'), outDir: bundleDir, enableCaching: false});
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? path.join(root, 'node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell');
  browser = await openBrowser('chrome', {browserExecutable});
  const inputProps = {availableArtKeys: [...new Set(t.scenes.map(s => s.artKey))], audioReady: false};
  const shared = {serveUrl, puppeteerInstance: browser, inputProps, logLevel: 'warn'};
  const composition = await selectComposition({...shared, id: 'ChinaHistory1449To1949'});
  if (composition.durationInFrames !== 6497 || composition.width !== 1920 || composition.height !== 1080) throw new Error('Composition参数不符。');
  const outputs = [];
  if (mode === 'stills') {
    const frames = [70, 230, 610, 960, 1370, 1720, 2100, 2380, 2660, 2970, 3210, 3470, 3680, 3810, 4090, 4260, 4500, 4880, 5060, 5360, 5660, 5980, 6150, 6270, 6370, 6470];
    for (const frame of frames) {
      const output = path.join(dir, 'f' + String(frame).padStart(4, '0') + '.jpg');
      await renderStill({...shared, composition, frame, output, imageFormat: 'jpeg', jpegQuality: 90, scale: .6});
      outputs.push(output);
      console.log('R6抽帧 ' + frame);
    }
  } else {
    const range = mode === 'proof' ? [3600, 4355] : undefined;
    const visual = path.join(dir, 'R6_' + mode + '_picture.mp4');
    const output = path.join(dir, mode === 'proof' ? '山河五百年_R6_纸艺有声样段.mp4' : '山河五百年_1449-1949_完整成片_R6.mp4');
    let last = -1;
    await renderMedia({...shared, composition, outputLocation: visual, frameRange: range, scale: mode === 'proof' ? .67 : 1, codec: 'h264', crf: 18, imageFormat: 'jpeg', jpegQuality: 93, pixelFormat: 'yuv420p', colorSpace: 'bt709', concurrency: 5, overwrite: false, onProgress: ({progress}) => {
      const percent = Math.floor(progress * 50) * 2;
      if (percent !== last) {last = percent; console.log('R6 ' + mode + ' ' + percent + '%');}
    }});
    const start = range ? range[0] / 30 : 0;
    const duration = range ? (range[1] - range[0] + 1) / 30 : 6497 / 30;
    // Audio is encoded once directly from the user's original song. No music replacement,
    // playback speed change, level change, or accumulated segment offset is introduced.
    execFileSync('ffmpeg', ['-v', 'error', '-n', '-i', visual, '-ss', String(start), '-i', music, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', String(duration), '-movflags', '+faststart', output], {stdio: 'inherit'});
    outputs.push(output);
    console.log('R6视频：' + output);
  }
  await fs.writeFile(path.join(dir, 'render-receipt.json'), JSON.stringify({revision, mode, outputs, composition: {width: 1920, height: 1080, fps: 30, durationInFrames: 6497}, music, musicSourcePolicy: 'original-track-direct-mux', elapsedSeconds: (Date.now() - started) / 1000, status: 'ready-for-user-review', publicationAuthorized: false}, null, 2) + '\n');
} finally {
  if (browser) await browser.close({silent: true});
  await fs.rm(bundleDir, {recursive: true, force: true});
}
