import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desk = '/Users/pc/Desktop/口播素材/2026-09-04_GPT6与Cybercab';
const dirs = ['01_口播原片','02_参考与官方素材','03_事实与来源核验','04_导演拆解','05_首帧图片','06_用户生成视频','07_实录与字幕','08_预览与质检','09_正式候选','10_发布包'];
const sources = [
  {id:'R01', from:'/Users/pc/Downloads/copy_20817306-25F6-45B7-8EE1-158C2A6D98FD.MOV', to:'01_口播原片/R01_口播原片.MOV', role:'user-declared-spoken-source'},
  {id:'U01', from:'/Users/pc/Downloads/oMaPx7AtihdCnv6pBMtSaiCiIQmAta9avXE3P.MP4', to:'02_参考与官方素材/U01_用户提供发布视频_待来源核验.MP4', role:'user-declared-official-reference-unverified'},
];
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (process.argv.length !== 2) throw new Error('只接受本条固定素材');
const manifest = path.join(root, '00_工程控制/intake-receipt.v1.json');
if (fs.existsSync(manifest)) throw new Error('已有盘点不能覆盖');
for (const dir of dirs) fs.mkdirSync(path.join(root, dir), {recursive:true});
for (const item of sources) {
  if (fs.lstatSync(item.from).isSymbolicLink() || !fs.statSync(item.from).isFile()) throw new Error('输入不是常规文件');
  if (fs.existsSync(path.join(root,item.to))) throw new Error('副本已存在，停止而非覆盖');
}
try { fs.lstatSync(desk); throw new Error('桌面同名入口已存在'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const receipt = {schemaVersion:'koubo-asset-intake/v1', at:new Date().toISOString(), taskId:'20260904-gpt6-cybercab',
  status:'intake-only-content-review-required', formalEnabled:false, publicPublishEnabled:false, root, desktop:desk, assets:[]};
for (const item of sources) {
  const target = path.join(root,item.to);
  const hash = sha(item.from);
  fs.copyFileSync(item.from,target,fs.constants.COPYFILE_EXCL);
  if (sha(target)!==hash || sha(item.from)!==hash) throw new Error('复制前后哈希不一致');
  const probe = spawnSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',target],{encoding:'utf8'});
  if (probe.status!==0) throw new Error(probe.stderr);
  const media = JSON.parse(probe.stdout);
  const decode = spawnSync('ffmpeg',['-nostdin','-hide_banner','-v','error','-xerror','-i',target,'-map','0:v:0','-map','0:a:0','-f','null','-'],{encoding:'utf8',timeout:180000,maxBuffer:1024*1024});
  fs.writeFileSync(path.join(root,`08_预览与质检/${item.id}.decode.log`),decode.stderr??'',{flag:'wx'});
  fs.writeFileSync(path.join(root,`08_预览与质检/${item.id}.ffprobe.json`),probe.stdout,{flag:'wx'});
  receipt.assets.push({...item,absolutePath:target,sha256:hash,bytes:fs.statSync(target).size,
    durationSeconds:Number(media.format.duration),video:media.streams.find(s=>s.codec_type==='video'),
    audio:media.streams.find(s=>s.codec_type==='audio'),fullDecodeExitCode:decode.status,sourceUnchanged:true});
  if(decode.error||decode.status!==0) throw new Error(`${item.id}完整解码失败`);
}
fs.symlinkSync(root,desk,'dir');
receipt.desktopReadlink=fs.readlinkSync(desk);
receipt.desktopRealpath=fs.realpathSync(desk);
fs.writeFileSync(manifest,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({manifest,desktop:desk,assets:receipt.assets.map(({id,absolutePath,sha256,durationSeconds,fullDecodeExitCode})=>({id,absolutePath,sha256,durationSeconds,fullDecodeExitCode}))},null,2));
