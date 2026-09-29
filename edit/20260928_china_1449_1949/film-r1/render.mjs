import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const root = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] ?? 'stills';
const timelinePath = path.join(root, 'data', 'timeline.json');
const publicDir = path.join(root, 'public');
const outputDir = path.join(root, 'exports');
const verifyDir = path.join(root, 'verify');
const started = Date.now();

const timeline = JSON.parse(await fs.readFile(timelinePath, 'utf8'));
const assert = (value, message) => {
  if (!value) throw new Error(message);
};

assert(timeline?.meta?.fps === 30, '时间轴帧率必须为 30fps。');
assert(timeline?.meta?.width === 1920 && timeline?.meta?.height === 1080, '画面尺寸必须为 1920×1080。');
assert(timeline?.meta?.durationInFrames === 6497, '全片必须精确为 6497 帧。');
assert(Array.isArray(timeline.scenes) && timeline.scenes.length > 0, '时间轴缺少场景。');
let nextFrame = 0;
const ids = new Set();
for (const scene of timeline.scenes) {
  assert(scene.startFrame === nextFrame, `${scene.id} 的起始帧与前一镜不连续，预期 ${nextFrame}。`);
  assert(Number.isInteger(scene.durationFrames) && scene.durationFrames > 0, `${scene.id} 时长不是正整数帧。`);
  assert(typeof scene.id === 'string' && !ids.has(scene.id), `场景 id 重复或缺失：${scene.id}`);
  assert(typeof scene.year === 'string' && typeof scene.title === 'string' && typeof scene.caption === 'string', `${scene.id} 缺少上屏文案。`);
  assert(/^[a-z0-9]+$/.test(scene.artKey), `${scene.id} 的 artKey 不是安全文件名。`);
  assert(['accent', 'phrase', 'sustain'].includes(scene.beatLevel), `${scene.id} 缺少卡点强弱。`);
  assert(scene.chapter >= 1 && scene.chapter <= 6, `${scene.id} 章节不在 1—6。`);
  ids.add(scene.id);
  nextFrame += scene.durationFrames;
}
assert(nextFrame === timeline.meta.durationInFrames, `时间轴总帧数 ${nextFrame} 与预期 6497 不符。`);

const availableArtKeys = [];
for (const artKey of [...new Set(timeline.scenes.map((scene) => scene.artKey))]) {
  try {
    await fs.access(path.join(publicDir, 'assets', `${artKey}.png`));
    availableArtKeys.push(artKey);
  } catch {
    console.warn(`美术资产未就绪：assets/${artKey}.png；当前将使用抽象纸/水占位画面。`);
  }
}
let audioReady = false;
try {
  await fs.access(path.join(publicDir, 'audio', 'music.mp3'));
  audioReady = true;
} catch {
  console.warn('音乐资产未就绪：public/audio/music.mp3。');
}
if (mode === 'video' || mode === 'preview' || mode === 'r5-segment') {
  assert(audioReady, '有声预览和全片渲染必须先准备 public/audio/music.mp3。');
  assert(availableArtKeys.length === new Set(timeline.scenes.map((scene) => scene.artKey)).size, '有声预览和全片渲染要求所有正式美术资产就绪，禁止无意中交付占位画面。');
}

const inputProps = {availableArtKeys, audioReady};
// public/assets 是指向独立生成资产目录的链接。每次使用唯一临时 bundle，
// 避免 Remotion 再次复制链接时遇到 EEXIST，同时不覆盖任何既有工程或成片。
const bundleDir = await fs.mkdtemp(path.join(root, '.bundle-run-'));
let serveUrl;
try {
  serveUrl = await bundle({
    entryPoint: path.join(root, 'src', 'index.tsx'),
    rootDir: root,
    publicDir,
    outDir: bundleDir,
    enableCaching: false,
  });
} catch (error) {
  await fs.rm(bundleDir, {recursive: true, force: true});
  throw error;
}
console.log(`Remotion bundle 已生成；场景 ${timeline.scenes.length}，美术资产 ${availableArtKeys.length}。`);
if (mode === 'bundle') {
  await fs.rm(bundleDir, {recursive: true, force: true});
  process.exit(0);
}

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? path.join(root, 'node_modules', '.remotion', 'chrome-headless-shell', 'mac-arm64', 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
await fs.access(browserExecutable);
const browser = await openBrowser('chrome', {browserExecutable});
const shared = {serveUrl, puppeteerInstance: browser, inputProps, logLevel: 'warn'};
try {
  const composition = await selectComposition({...shared, id: 'ChinaHistory1449To1949'});
  assert(composition.durationInFrames === 6497, 'Remotion Composition 帧数与时间轴不符。');
  assert(composition.fps === 30 && composition.width === 1920 && composition.height === 1080, 'Remotion Composition 参数与时间轴不符。');

  if (mode === 'inspect') {
    console.log(`Composition 已在浏览器加载：${composition.id} ${composition.width}×${composition.height} ${composition.fps}fps / ${composition.durationInFrames} 帧。`);
  } else if (mode === 'stills') {
    await fs.mkdir(verifyDir, {recursive: true});
    const frames = [0, 220, 478, 500, 830, 1150, 1635, 1675, 1676, 1720, 2010, 2491, 2520, 3100, 3603, 3890, 4300, 4785, 4793, 5150, 5500, 5900, 6120, 6320, 6411, 6430, 6490];
    for (const frame of frames) {
      await renderStill({...shared, composition, frame, output: path.join(verifyDir, `frame-${String(frame).padStart(4, '0')}.png`), scale: .67});
      console.log(`抽帧 ${frame} / 6496`);
    }
  } else if (mode === 'preview' || mode === 'video' || mode === 'r5-segment') {
    await fs.mkdir(mode === 'video' ? outputDir : verifyDir, {recursive: true});
    const outputLocation = mode === 'video'
      ? path.join(outputDir, '山河五百年_1449-1949_完整候选_R4.mp4')
      : mode === 'r5-segment'
        ? path.join(verifyDir, '山河五百年_1898至1912_R5_监制样段.mp4')
        : path.join(verifyDir, '海贸工艺至1644_有声代表段_R2.mp4');
    let lastPercent = -1;
    await renderMedia({
      ...shared,
      composition,
      codec: 'h264',
      audioCodec: 'aac',
      audioBitrate: '320k',
      crf: 18,
      imageFormat: 'png',
      pixelFormat: 'yuv420p',
      colorSpace: 'bt709',
      concurrency: 3,
      overwrite: false,
      frameRange: mode === 'preview' ? [799, 1674] : mode === 'r5-segment' ? [3602, 4230] : undefined,
      outputLocation,
      onProgress: ({progress}) => {
        const percent = Math.floor(progress * 20) * 5;
        if (percent !== lastPercent) {
          lastPercent = percent;
          console.log(`${mode} ${percent}%`);
        }
      },
    });
    console.log(`候选视频：${outputLocation}`);
  } else {
    throw new Error(`未知模式：${mode}`);
  }

  await fs.mkdir(verifyDir, {recursive: true});
  await fs.writeFile(path.join(verifyDir, `${mode}-render-receipt.json`), JSON.stringify({
    mode,
    timelinePath,
    composition: {id: composition.id, width: composition.width, height: composition.height, fps: composition.fps, durationInFrames: composition.durationInFrames},
    availableArtKeys,
    audioReady,
    elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    finishedAt: new Date().toISOString(),
    status: 'technical-candidate',
    humanReview: 'pending',
    publicationAuthorized: false,
  }, null, 2) + '\n');
} finally {
  await browser.close({silent: true});
  await fs.rm(bundleDir, {recursive: true, force: true});
}
