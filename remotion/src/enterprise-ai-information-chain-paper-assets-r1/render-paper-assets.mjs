import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const remotionDir = resolve(sourceDir, '../..');
const projectRoot = resolve(remotionDir, '..');
const manifestPath = resolve(
  projectRoot,
  'edit/20260826_enterprise_ai_information_chain/04_Remotion规划/paper-assets-r1/plan/paper-assets-manifest.v1.json',
);
const outputRoot = resolve(
  projectRoot,
  'edit/20260826_enterprise_ai_information_chain/04_Remotion规划/paper-assets-r1',
);
const entryPoint = 'src/enterprise-ai-information-chain-paper-assets-r1/index.tsx';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const force = process.argv.includes('--force');

const safeTitle = (title) =>
  title.replace(/[，。；：、？！“”‘’]/g, '').replace(/\s+/g, '_');

const isValidVideo = (path) => {
  if (!existsSync(path)) return false;
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', path],
    {encoding: 'utf8'},
  );
  return result.status === 0 && result.stdout.trim().split(',')[0] === 'h264';
};

for (const shot of manifest.shots) {
  const fileStem = `${shot.id}_${safeTitle(shot.title)}`;
  const withSfxDir = resolve(outputRoot, 'with-sfx');
  const noSfxDir = resolve(outputRoot, 'no-sfx');
  mkdirSync(withSfxDir, {recursive: true});
  mkdirSync(noSfxDir, {recursive: true});
  const withSfxPath = resolve(withSfxDir, `${fileStem}_有声候选.mp4`);
  const noSfxPath = resolve(noSfxDir, `${fileStem}_无声对照.mp4`);

  if (!force && isValidVideo(withSfxPath)) {
    console.log(`\n[resume] 已有有效有声候选：${withSfxPath}`);
  } else {
    const compositionId = `EnterpriseAIInfoChain-${shot.id}-WithSfx`;
    console.log(`\n[render] ${compositionId}`);
    console.log(`[output] ${withSfxPath}`);
    const result = spawnSync(
      'npx',
      [
        'remotion',
        'render',
        entryPoint,
        compositionId,
        withSfxPath,
        '--codec=h264',
        '--pixel-format=yuv420p',
        '--audio-codec=aac',
        '--crf=18',
        '--concurrency=50%',
      ],
      {cwd: remotionDir, stdio: 'inherit'},
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  if (!force && isValidVideo(noSfxPath)) {
    console.log(`[resume] 已有有效无声对照：${noSfxPath}`);
  } else {
    console.log(`[derive] 无损移除音轨：${noSfxPath}`);
    const result = spawnSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', withSfxPath, '-map', '0:v:0', '-c:v', 'copy', '-an', '-movflags', '+faststart', noSfxPath],
      {stdio: 'inherit'},
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

console.log('\n[done] 10 条有声候选已渲染，10 条无声对照由同一视频码流无损派生。');
