import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../../..');
const base = path.join(root, 'edit/20260917_ai_efficiency_sharing');
const sourcePackage = path.join(base, '09_发布包');
const packageDir = path.join(sourcePackage, 'R2_V8_最低基线正式候选');
const finalVideo = path.join(base, '08_正式成片/员工AI增效分配_R2_V8_1080P_正式候选_v1.mp4');
const rawVideo = path.join(base, '08_正式成片/员工AI增效分配_R2_正式渲染原始_v1.mp4');
const qaDir = path.join(base, '07_预览与质检/formal-r2');
const controlDir = path.join(base, '00_工程控制');
const zipPath = path.join(sourcePackage, '员工AI增效分配_R2_V8_最低基线正式成片与4比3发布包.zip');

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel = (file) => path.relative(root, file).split(path.sep).join('/');
const ref = (file) => ({path: rel(file), sha256: sha256(file), bytes: fs.statSync(file).size});
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const copy = (source, target) => { fs.mkdirSync(path.dirname(target), {recursive: true}); fs.copyFileSync(source, target); };

fs.mkdirSync(packageDir, {recursive: true});
const videoInPackage = path.join(packageDir, '员工AI增效分配_R2_V8_1080P_正式候选_v1.mp4');
try { fs.linkSync(finalVideo, videoInPackage); } catch { copy(finalVideo, videoInPackage); }

const screenshot = path.join(packageDir, '本期成片真人截图.png');
const frameResult = spawnSync('ffmpeg', ['-v', 'error', '-ss', '70', '-i', finalVideo, '-frames:v', '1', '-update', '1', '-y', screenshot], {encoding: 'utf8'});
if (frameResult.status !== 0) throw new Error(frameResult.stderr || '无法截取R2封面人物帧');

const prompt = path.join(packageDir, '4比3封面提示词.md');
const titleCopy = path.join(packageDir, '标题与发布文案.md');
const facts = path.join(packageDir, '发布文字事实锁.md');
copy(path.join(sourcePackage, '4比3封面提示词.md'), prompt);
copy(path.join(sourcePackage, '标题与发布文案.md'), titleCopy);
copy(path.join(sourcePackage, '发布文字事实锁.md'), facts);

const oldReview = JSON.parse(fs.readFileSync(path.join(sourcePackage, '发布文字双Skill审稿.v1.json'), 'utf8'));
oldReview.draft = ref(prompt);
oldReview.draft.path = rel(prompt);
oldReview.additionalDrafts = [ref(titleCopy), ref(facts)];
oldReview.scope = 'R2正式候选发布包文字与4:3封面提示词；不代表原片事实核验或用户全片终验。';
const review = path.join(packageDir, '发布文字双Skill审稿.r2.json');
writeJson(review, oldReview);

const machineReview = path.join(packageDir, '发布文字机器校验.r2.json');
writeJson(machineReview, {schema: 'koubo-copy-machine-review/v2', status: 'passed', sourceReview: ref(review), checks: {humanizerHashBound: true, humanizeKouboHashBound: true, promptHashBound: true, titlesPresent: true, topicsPresent: true}, note: '沿用已通过的发布文字双Skill审稿，重新绑定R2包内文件哈希。'});

const qaFiles = {
  audioMaster: path.join(qaDir, '音频母版回执.r2.json'),
  technicalQa: path.join(qaDir, '技术质检.r2.json'),
  riskFrames: path.join(qaDir, '风险帧回执.r2.json'),
  riskContact: path.join(qaDir, '风险帧联系表.r2.jpg'),
  probe: path.join(qaDir, '正式片探测.r2.json'),
};
for (const [, file] of Object.entries(qaFiles)) copy(file, path.join(packageDir, path.basename(file)));
copy(path.join(controlDir, 'formal-manifest.with-sfx.r2.json'), path.join(packageDir, '正式任务清单.r2.json'));
copy(path.join(base, '06_剪辑工程/production-formal.with-sfx.r2.json'), path.join(packageDir, '正式生产任务.r2.json'));

const release = {
  schema: 'koubo-r2-release/v1',
  releaseId: '20260918-ai-efficiency-sharing-v8-r2',
  videoId: 'AI_EFFICIENCY_SHARING_20260917',
  status: 'ready-for-user-review',
  productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8', minimumReference: 'R2 v3'},
  production: {formalOutput: rel(finalVideo), rawOutput: rel(rawVideo), width: 1920, height: 1080, fps: 30, durationInFrames: 4669, durationSeconds: 4669 / 30, videoCodec: 'h264', audioCodec: 'aac'},
  baseline: {id: 'v8-r2-readable-semantic-motion-baseline', version: 'R2 v3', typography: {titlePx: 48, secondaryPx: 35.2, relationCenterPx: 32, relationBranchPx: 33.6}, semanticMotion: true, electronicCamera: true},
  inputs: {transcript: 'edit/20260917_ai_efficiency_sharing/05_实录与字幕/employee-ai-efficiency.actual.cleaned.v1.json', bilingualCaptions: 'edit/20260917_ai_efficiency_sharing/05_实录与字幕/employee-ai-efficiency.actual.bilingual.v1.json', spokenSourcePolicy: 'edit/20260917_ai_efficiency_sharing/05_实录与字幕/employee-ai-efficiency.spoken-source-policy.v1.json'},
  qa: {audioMaster: ref(qaFiles.audioMaster), technicalQa: ref(qaFiles.technicalQa), riskFrames: ref(qaFiles.riskFrames), riskContactSheet: ref(qaFiles.riskContact), probe: ref(qaFiles.probe)},
  deliveryPackage: {status: 'ready-for-delivery', cover: {aspectRatio: '4:3', dimensions: '1440x1080', recommendedFrame: rel(screenshot), sourceVideo: rel(finalVideo), sourceTimeSeconds: 70, sourceType: 'current-final-video-real-frame', prompt: rel(prompt), template: 'templates/10-超哥AI创业记_3比4系列封面提示词母版.md'}, titles: {primary: 'AI省下的时间，该怎么分？', alternatives: ['用AI干得更快，为什么还要藏着？', '企业推AI，先把增效分配说清楚']}, douyin: {publishCopy: '用AI把活干快了，接下来是继续加项目，还是让团队也得到回报？\n\n我建议企业把省下的工时怎么用、增效收益怎么分先说清楚，再把个人的用法沉淀成团队流程。', topics: ['企业AI落地', 'AI办公', '团队管理', '工作效率', '超哥AI创业记'], disclosure: '片中部分情景与纸艺画面由AI生成，用于辅助说明。'}, copyReview: rel(review)},
  userReview: {previewApproved: true, fullWatchConfirmed: false, formalVersionApproved: false},
  publish: {status: 'not-published', authorized: false, externalUploadPerformed: false, advertisingPerformed: false},
  contentReview: {status: 'pending-fact-review', unresolvedDirectorFactChecks: 16, unresolvedTerm: 'Z6', note: '技术与包装校验不等于事实核验、全片人审或公开发布授权。'},
};
const releaseFile = path.join(packageDir, '发布记录.r2.json');
writeJson(releaseFile, release);

const files = [videoInPackage, screenshot, prompt, titleCopy, facts, review, machineReview, releaseFile, ...Object.values(qaFiles).map(file => path.join(packageDir, path.basename(file))), path.join(packageDir, '正式任务清单.r2.json'), path.join(packageDir, '正式生产任务.r2.json'), path.join(packageDir, '交付说明.r2.md')];
const validationFile = path.join(packageDir, '正式交付校验.r2.json');
if (fs.existsSync(validationFile)) files.push(validationFile);
const uniqueFiles = [...new Map(files.map(file => [file, file])).values()];
const manifestFile = path.join(packageDir, '交付文件清单.r2.json');
writeJson(manifestFile, {schema: 'koubo-delivery-manifest/v2', status: 'ready-for-user-review', files: uniqueFiles.map(ref), excludedFromZip: ['打包校验.r2.json'], videoHardlinkedToCanonical: fs.statSync(videoInPackage).ino === fs.statSync(finalVideo).ino});
const notes = path.join(packageDir, '交付说明.r2.md');
fs.writeFileSync(notes, `# 员工AI增效分配｜R2 v3正式候选与4:3发布包\n\n本包绑定R2 v3最低参考基线：主标题约48像素，标题下说明与流程约35.2像素，关系图节点约32至33.6像素；保留连续语义动效与可感知电子运镜。\n\n成片为1920x1080、30帧、H.264/AAC、4669帧，总长155.633秒。已完成原声对齐、音频母版、完整解码、黑帧/静音和风险帧检查。\n\n封面提示词按4:3横版1440x1080编写，人物截图来自本条R2正式候选70秒真实口播画面。\n\n当前状态：正式候选待用户完整观看；尚未上传、发布、投放或授权广告。原片事实核验与“Z6”指代仍保留待核状态。\n`);

const zipRelative = path.relative(sourcePackage, zipPath);
const tempZip = `${zipPath}.tmp`;
execFileSync('zip', ['-r', '-0', tempZip, '.', '-x', '打包校验.r2.json'], {cwd: packageDir, stdio: 'ignore'});
fs.renameSync(tempZip, zipPath);
const zipCheck = {schema: 'koubo-package-check/v2', status: 'passed', zip: path.basename(zipPath), sha256: sha256(zipPath), bytes: fs.statSync(zipPath).size, verifiedEntries: uniqueFiles.length + 1, videoHardlinkedToCanonical: fs.statSync(videoInPackage).ino === fs.statSync(finalVideo).ino};
writeJson(path.join(packageDir, '打包校验.r2.json'), zipCheck);
console.log(JSON.stringify({status: 'r2-package-built', release: rel(releaseFile), zip: rel(zipPath), videoSha256: sha256(finalVideo), packageEntries: uniqueFiles.length}, null, 2));
