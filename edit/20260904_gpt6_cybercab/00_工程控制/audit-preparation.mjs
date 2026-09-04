import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const output = path.join(root, '00_工程控制/preparation-receipt.v1.json');
if (process.argv.length !== 2 || fs.existsSync(output)) throw new Error('固定本期审计，禁止覆盖回执');
const intake = JSON.parse(fs.readFileSync(path.join(root, '00_工程控制/intake-receipt.v1.json')));
const media = [...intake.assets.map(a => ({id:a.id, file:a.to, expected:a.sha256, role:a.role})),
  {id:'T01', file:'02_参考与官方素材/T01_Cybercab_官方现行宣传_拍摄日期未披露.mp4', role:'official-promotional-video',
    sourcePage:'https://www.tesla.com/robotaxi',
    downloadUrl:'https://digitalassets.tesla.com/tesla-contents/video/upload/f_auto,q_auto/Cybercab-Calling-Your-Robotaxi-Desktop.mp4',
    eventDate:null, rights:'rights-review-required'},
  {id:'T02', file:'02_参考与官方素材/T02_Cybercab_2024发布会回顾.mp4', role:'historical-official-event-recap',
    sourcePage:'https://www.tesla.com/en_qa/we-robot',
    downloadUrl:'https://digitalassets.tesla.com/tesla-contents/video/upload/f_auto,q_auto:best/We-Robot-Recap-Carousel-Slide-3-Desktop.mp4',
    eventDate:'2024-10-10', rights:'rights-review-required'}];
const results = [];
for (const item of media) {
  const full = path.join(root, item.file);
  const before = sha(full);
  if (item.expected && item.expected !== before) throw new Error(`${item.id}: 输入哈希变化`);
  const probe = spawnSync('ffprobe', ['-v','error','-show_format','-show_streams','-of','json',full], {encoding:'utf8'});
  if (probe.status !== 0) throw new Error(`${item.id}: 媒体探测失败`);
  const info = JSON.parse(probe.stdout);
  const decode = spawnSync('ffmpeg', ['-nostdin','-hide_banner','-v','error','-xerror','-i',full,'-map','0:v:0','-map','0:a?','-f','null','-'],
    {encoding:'utf8', timeout:180000, maxBuffer:1024*1024});
  if (decode.status !== 0 || sha(full) !== before) throw new Error(`${item.id}: 完整解码或哈希失败`);
  const video = info.streams.find(s => s.codec_type === 'video');
  results.push({...item, absolutePath:full, sha256:before, bytes:fs.statSync(full).size,
    durationSeconds:Number(info.format.duration), video, audio:info.streams.filter(s => s.codec_type === 'audio'),
    fullDecodeExitCode:decode.status, visualReview:'contact-sheet-only-not-full-speed-acceptance'});
  fs.writeFileSync(path.join(root, `08_预览与质检/${item.id}.preparation.ffprobe.json`), probe.stdout, {flag:'wx'});
  fs.writeFileSync(path.join(root, `08_预览与质检/${item.id}.preparation.decode.log`), decode.stderr, {flag:'wx'});
}
const asr = JSON.parse(fs.readFileSync(path.join(root, '07_实录与字幕/R01.whisper-small.raw.v1.json')));
const durationMs = Math.round(results[0].durationSeconds*1000);
const outOfRange = asr.transcription.filter(s => s.offsets.to > durationMs).map(s => ({text:s.text, offsets:s.offsets}));
const boundFiles = ['00_工程控制/intake-receipt.v1.json','03_事实与来源核验/Tesla_Cybercab_官方应急响应方案.pdf',
  '03_事实与来源核验/事实核验与待裁决.md','04_导演拆解/全片结构与纸艺审阅草案.md',
  '07_实录与字幕/R01.whisper-small.raw.v1.json','07_实录与字幕/U01.whisper-small.raw.v1.json'];
const receipt = {
  schemaVersion:'koubo-preparation-audit/v1', taskId:'20260904-gpt6-cybercab', at:new Date().toISOString(),
  status:'asset-preparation-complete-content-review-blocked', formalEnabled:false, productionEligible:false,
  directorSkillRead:true, directorSkillExecuted:false, generationSubmitted:false, externalUpload:false, payment:false,
  bootstrapTaskId:'task-20260904T115343Z-8f0379d3', knowledgeReadAttestation:'pending-executor-read-not-production-clearance',
  desktopPath:intake.desktop, desktopReadlink:fs.readlinkSync(intake.desktop), desktopRealpath:fs.realpathSync(intake.desktop),
  assets:results, bindings:boundFiles.map(file => ({file,sha256:sha(path.join(root,file))})),
  asr:{engine:'whisper.cpp-small-local', reviewedForSubtitles:false, uploaded:false, authority:'recorded-audio',
    draftRole:'comparison-only', durationMs, outOfRange, note:'原始ASR保留不改；尾段超过媒体末尾，须复听校时，禁止原样导入正式字幕。'},
  blockers:['需用户裁决实录绝对化事实与效果承诺','U01官方原始出处未完成逐镜核对','第三方素材转载与音乐使用边界待审',
    '实录字幕尚未逐句复听确认','未创建或编译纸艺执行合同','新动效仅本条候选测试许可，尚无本条视觉验收'],
  sourceFilesUnchanged:intake.assets.every(a => sha(a.from)===a.sha256),
};
if (!receipt.sourceFilesUnchanged || receipt.desktopRealpath !== root) throw new Error('源文件或桌面入口不一致');
fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sha256:sha(output),status:receipt.status,assets:results.map(a=>({id:a.id,duration:a.durationSeconds,sha256:a.sha256})),asrOutOfRange:outOfRange},null,2));
