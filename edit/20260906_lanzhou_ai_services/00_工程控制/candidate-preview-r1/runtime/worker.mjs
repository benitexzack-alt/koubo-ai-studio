import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {ROOT, ENTRY, PUBLIC, OUTPUT, BROWSER, BINARIES, PORT, DEBUG_PORT, ensure, outputNames} from '../runner-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
ensure(root === ROOT && process.argv.length === 3, 'WORKER_SCOPE_INVALID');
const descriptor = process.argv[2];
ensure(path.isAbsolute(descriptor) && descriptor.startsWith(`${root}/edit/20260906_lanzhou_ai_services/00_工程控制/candidate-preview-r1/runtime/runs/`)
  && path.basename(descriptor) === 'job.json', 'WORKER_DESCRIPTOR_SCOPE_INVALID');
const job = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
ensure(['stills', 'render'].includes(job.command) && job.root === root && job.port === PORT
  && job.scratch === path.dirname(descriptor) && job.browser === path.join(root, BROWSER)
  && job.binaries === path.join(root, BINARIES) && job.stageRoot === path.join(job.scratch, 'project')
  && job.entry === path.join(job.stageRoot, ENTRY) && job.publicDir === path.join(job.stageRoot, PUBLIC), 'WORKER_SCOPE_INVALID');
const expected = outputNames({stillFrames: job.outputs.map(o => o.frame)}, job.command);
ensure(job.outputs.length === expected.length && job.outputs.every((o, i) => o.path === path.join(root, expected[i])
  && !fs.existsSync(o.path) && (job.command === 'render' || (Number.isInteger(o.frame) && o.frame >= 0 && o.frame < 8393))), 'WORKER_OUTPUT_SCOPE_INVALID');
ensure(fs.existsSync(path.join(root, OUTPUT, 'active.lock')), 'RUNNER_LOCK_REQUIRED');
const require = createRequire(path.join(root, 'remotion/package.json'));
// Pin Chromium's otherwise random CDP port in this worker only, never on disk.
const launcher = require(path.join(root, 'remotion/node_modules/@remotion/renderer/dist/browser/BrowserRunner.js'));
const originalLaunch = launcher.makeBrowserRunner;
launcher.makeBrowserRunner = args => originalLaunch({...args, processArguments: args.processArguments.map(a => a === '--remote-debugging-port=0' ? `--remote-debugging-port=${DEBUG_PORT}` : a)});
const portConfig = require(path.join(root, 'remotion/node_modules/@remotion/renderer/dist/port-config.js'));
Object.defineProperty(portConfig, 'getPortConfig', {value: () => ({host: '127.0.0.1', hostsToTry: ['127.0.0.1']}), writable: false});
const {bundle} = require('@remotion/bundler');
const {selectComposition, renderMedia, renderStill, openBrowser} = require('@remotion/renderer');
const noDownload = () => { throw new Error('AUTOMATIC_DOWNLOAD_FORBIDDEN'); };
const serveUrl = await bundle({entryPoint: job.entry, rootDir: path.join(job.stageRoot, 'remotion'), publicDir: job.publicDir,
  outDir: path.join(job.scratch, 'bundle'), enableCaching: false, symlinkPublicDir: false, gitSource: null,
  webpackOverride: config => ({...config, cache: false,
    resolve: {...config.resolve, modules: [path.join(root, 'remotion/node_modules')]},
    resolveLoader: {...config.resolveLoader, modules: [path.join(root, 'remotion/node_modules')]}})});
const common = {serveUrl, browserExecutable: job.browser, binariesDirectory: job.binaries, port: job.port,
  envVariables: {}, onBrowserDownload: noDownload, logLevel: 'warn'};
const browser = await openBrowser('chrome', {browserExecutable: job.browser, logLevel: 'warn'});
common.puppeteerInstance = browser;
try {
const composition = await selectComposition({...common, id: 'LanzhouServicesV91CandidateR1'});
if (composition.id !== 'LanzhouServicesV91CandidateR1' || composition.width !== 1920 || composition.height !== 1080
  || composition.fps !== 30 || composition.durationInFrames !== 8393) throw new Error('ACTUAL_COMPOSITION_SCOPE_MISMATCH');
if (job.command === 'stills') {
  for (const item of job.outputs) {
    await renderStill({...common, composition, output: item.path, frame: item.frame, scale: 0.5, imageFormat: 'png', overwrite: false});
    process.stdout.write(`静帧已输出：${item.frame}，尚非人工验收\n`);
  }
} else {
  let lastBucket = -1;
  let progress = {progress: 0, renderedFrames: 0, encodedFrames: 0};
  const report = () => process.stdout.write(`低清候选进度 ${Math.floor(progress.progress * 100)}%：渲染 ${progress.renderedFrames}/8393，编码 ${progress.encodedFrames}/8393\n`);
  const timer = setInterval(report, 30000);
  try {
    await renderMedia({...common, composition, outputLocation: job.outputs[0].path, codec: 'h264', pixelFormat: 'yuv420p',
      audioCodec: 'aac', muted: false, scale: 0.5, frameRange: [0, 8392], concurrency: 2, crf: 23, overwrite: false,
      onProgress: value => {
        progress = value;
        const bucket = Math.floor(value.progress * 20);
        if (bucket > lastBucket) { lastBucket = bucket; report(); }
      }});
  } finally { clearInterval(timer); }
}
} finally { await browser.close({silent: true}); }
