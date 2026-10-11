import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';

const root = process.cwd();
const ep = 'edit/20261011_enterprise_ai_organization';
const pub = `${ep}/09_渲染素材/public`;
const nested = `${pub}/enterprise-ai-organization`;
const source = `${ep}/01_素材投放区/01_口播原片/copy_6040572B-1985-4C66-842D-0F3B63C6E29C.MOV`;
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceHash = sha(source);
const link = (src, dest) => {
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  if (fs.existsSync(dest)) {
    if (!fs.lstatSync(dest).isSymbolicLink()) {
      if (sha(dest) !== sha(src)) throw new Error(`已有副本不匹配：${dest}`);
      return;
    }
    if (fs.realpathSync(dest) !== fs.realpathSync(src)) throw new Error(`已有目标不匹配：${dest}`);
    // 仅替换本脚本刚建且目标已核实的链接；原始文件保持只读。
    fs.unlinkSync(dest);
  }
  fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
};
fs.mkdirSync(nested, {recursive: true});
const host = `${nested}/host.mp4`;
if (!fs.existsSync(host)) {
  const result = spawnSync('ffmpeg', ['-nostdin','-hide_banner','-loglevel','error','-n','-i',source,
    '-map','0:v:0','-an','-c:v','h264_videotoolbox','-b:v','16M','-pix_fmt','yuv420p','-r','30',
    '-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',host], {stdio:'inherit'});
  if(result.status !== 0) throw new Error('原片渲染副本转换失败');
}
for (const id of ['P01','P02','P03','P04','P05']) {
  link(`${ep}/01_素材投放区/04_纸艺视频/20261011_${id}_待确认生成.mp4`, `${nested}/paper/${id}.mp4`);
}
link('remotion/public/motion-upgrade-r2/fonts/smiley-sans.woff2', `${pub}/motion-upgrade-r2/fonts/smiley-sans.woff2`);
link('/System/Library/Fonts/STHeiti Medium.ttc', `${nested}/fonts/STHeiti-Medium.ttc`);
for (const name of ['final-mix.v1.wav','native-mix.v1.wav']) {
  const p = `${ep}/08_声音制作/audio/${name}`;
  if (fs.existsSync(p)) link(p, `${nested}/audio/${name}`);
}
if (sha(source) !== sourceHash) throw new Error('原始文件发生变化');
const receipt = {schema:'enterprise-media-prep/v1',source:{path:source,sha256:sourceHash},
  host:{path:host,sha256:sha(host)},originalReadOnly:true,speed:1,cuts:[],
  note:'仅新建高码率AVC渲染副本；保留原片原速全帧，音频由原MOV独立提取混音。五纸艺和本地字体为同哈希副本，遵循既有受控入口普通文件要求。'};
fs.writeFileSync(`${ep}/09_渲染素材/media-preparation.receipt.v1.json`, JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
