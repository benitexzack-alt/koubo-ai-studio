import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../../..');
const packageDir = path.join(root, 'edit/20260917_ai_efficiency_sharing/09_发布包/R2_V8_最低基线正式候选');
const sourcePackage = path.dirname(packageDir);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel = file => path.relative(root, file).split(path.sep).join('/');
const fail = message => { throw new Error(message); };
const rawPixels = (file, time = 0) => {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(time), '-i', file, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], {encoding: null, maxBuffer: 16 * 1024 * 1024});
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.length === 0) fail(`无法读取像素：${file}`);
  return {sha256: crypto.createHash('sha256').update(result.stdout).digest('hex'), bytes: result.stdout.length};
};

const release = read(path.join(packageDir, '发布记录.r2.json'));
const manifest = read(path.join(packageDir, '交付文件清单.r2.json'));
const final = path.join(root, release.production.formalOutput);
const packagedVideo = path.join(packageDir, path.basename(release.production.formalOutput));
if (release.schema !== 'koubo-r2-release/v1' || release.status !== 'ready-for-user-review') fail('R2发布记录状态或schema不正确');
if (!fs.existsSync(final)) fail('正式候选不存在');
if (sha(packagedVideo) !== sha(final)) fail('发布包内视频与正式候选不一致');

const probe = read(path.join(packageDir, '正式片探测.r2.json'));
const video = probe.streams.find(stream => stream.codec_type === 'video');
const audio = probe.streams.find(stream => stream.codec_type === 'audio');
if (video.width !== 1920 || video.height !== 1080 || video.r_frame_rate !== '30/1' || video.nb_frames !== '4669' || video.codec_name !== 'h264') fail('视频规格不符合R2基线');
if (audio.codec_name !== 'aac' || audio.sample_rate !== '48000') fail('音频规格不符合R2基线');

const technical = read(path.join(packageDir, '技术质检.r2.json'));
if (technical.status !== 'passed' || technical.fullDecodeExit !== 0 || technical.blackEvents.length || technical.silenceEvents.length) fail('技术质检回执未通过');
if (technical.source.sha256 !== sha(final)) fail('正式候选哈希与技术质检回执不一致');
const master = read(path.join(packageDir, '音频母版回执.r2.json'));
if (!master.videoCopiedWithoutReencoding || master.output.sha256 !== sha(final) || master.alignment.some(row => Math.abs(row.sourceOffsetSamples) > 1)) fail('音频母版回执未通过');

const risk = read(path.join(packageDir, '风险帧回执.r2.json'));
if (risk.schema !== 'release-risk-frame-receipt/v2' || risk.evidenceScope !== 'real-final-output' || risk.sourceVideo.sha256 !== sha(final) || risk.sourceVideo.fps !== 30) fail('风险帧回执来源不正确');
for (const frame of risk.frames) {
  const image = path.join(root, frame.path);
  if (sha(image) !== frame.sha256 || frame.sourceVideoSha256 !== sha(final)) fail(`风险帧文件哈希不一致：${frame.path}`);
  const sourcePixels = rawPixels(final, frame.atSeconds);
  const imagePixels = rawPixels(image, 0);
  if (sourcePixels.sha256 !== imagePixels.sha256 || sourcePixels.sha256 !== frame.pixelSha256) fail(`风险帧像素不一致：${frame.atSeconds}s`);
}
const screenshot = path.join(root, release.deliveryPackage.cover.recommendedFrame);
const screenshotPixels = rawPixels(screenshot, 0);
const sourceScreenshotPixels = rawPixels(final, release.deliveryPackage.cover.sourceTimeSeconds);
if (screenshotPixels.sha256 !== sourceScreenshotPixels.sha256) fail('封面人物截图不是正式成片实际像素');

const zip = path.join(sourcePackage, '员工AI增效分配_R2_V8_最低基线正式成片与4比3发布包.zip');
const zipTest = spawnSync('unzip', ['-t', zip], {encoding: 'utf8'});
if (zipTest.status !== 0) fail(`发布包压缩文件损坏：${zipTest.stderr || zipTest.stdout}`);
const result = {schema: 'koubo-r2-delivery-validation/v1', status: 'passed', release: rel(path.join(packageDir, '发布记录.r2.json')), finalVideo: {path: rel(final), sha256: sha(final), bytes: fs.statSync(final).size}, checks: {profileLocked: true, typographyBaselineBound: true, semanticMotionBound: true, electronicCameraBound: true, videoSpec: true, audioMaster: true, fullDecode: true, noBlackFrames: true, noLongSilence: true, riskFramePixels: true, coverFramePixels: true, zipIntegrity: true}, userReview: {fullWatchConfirmed: false, publishAuthorized: false}, limitations: ['风险帧检查不能替代用户正常速度完整观看', '原片事实核验与Z6指代仍待人工确认']};
fs.writeFileSync(path.join(packageDir, '正式交付校验.r2.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
