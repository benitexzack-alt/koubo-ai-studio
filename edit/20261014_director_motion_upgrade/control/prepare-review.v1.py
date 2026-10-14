"""受控候选导出后，制作同窗对照及技术复核；不生成正式回执或人工验收。"""
from pathlib import Path
import json, hashlib, subprocess
ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'edit/20261014_director_motion_upgrade'
OUT=BASE/'outputs'; QA=BASE/'review'; QA.mkdir(exist_ok=True)
NEW=OUT/'企业全员AI改造_导演升级_一分钟_R1_有音效.mp4'
NATIVE=BASE/'public/motion-upgrade/audio/native.wav'
OLD=ROOT/'edit/20261011_enterprise_ai_organization/11_成片与发布包/企业全员AI改造_V8_R1_1080P_完整候选.mp4'

def run(args):
 return subprocess.run(args,cwd=ROOT,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def gate():
 return json.loads(run(['node','--input-type=module','-e',"import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {validateKnowledgeContextForProductionV2 as v} from './tools/knowledge-context-production-gate.mjs';const p=resolve('edit/20261014_director_motion_upgrade/control/preview-job.v1.json');console.log(JSON.stringify(v({projectRoot:process.cwd(),jobPath:p,job:JSON.parse(readFileSync(p)),command:'qa'})));"]))

g=gate(); assert NEW.is_file()
receipt=list(OUT.glob('.'+NEW.name+'.production-receipt.*.json'))
assert len(receipt)<=1
reconciliation=None
if not receipt:
 reconciliation=json.loads((BASE/'control/post-render-reconciliation.v1.json').read_text())
 assert reconciliation['status']=='blocked-final-registration-watchable-candidate' and reconciliation['inputDrift']==[] and reconciliation['successfulProductionReceipt'] is None
 assert 'Encoded 1798/1798' in (BASE/'control/render.log').read_text()
 assert 'index-not-current' in (BASE/'control/render.log').read_text()
no=OUT/'企业全员AI改造_导演升级_一分钟_R1_无新增音效.mp4'
original=OUT/'企业全员AI改造_原版同窗_统一底声.mp4'
ff=['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-n']
if not no.exists():run(ff+['-i',str(NEW),'-i',str(NATIVE),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(1798/30),'-movflags','+faststart',str(no)])
if not original.exists():run(ff+['-i',str(OLD),'-i',str(NATIVE),'-filter_complex','[0:v]trim=start_frame=1604:end_frame=3402,setpts=PTS-STARTPTS[v]','-map','[v]','-map','1:a:0','-frames:v','1798','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t',str(1798/30),'-movflags','+faststart',str(original)])
meta={}
for p in [NEW,no,original]:
 probe=json.loads(run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames,sample_rate','-of','json',str(p)]))
 v=next(s for s in probe['streams'] if s['codec_type']=='video');assert int(v['nb_frames'])==1798 and v['width']==1920 and v['height']==1080 and v['avg_frame_rate']=='30/1'
 run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'])
 video_hash=run(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).decode().strip()
 meta[p.name]={'sha256':sha(p),'probe':probe,'fullDecodePassed':True,'videoPacketHash':video_hash}
assert meta[NEW.name]['videoPacketHash']==meta[no.name]['videoPacketHash']
# 连续关键点序列：让位、标签新增及比较状态。这里只抽成片，不重新渲染。
frames=[26,38,350,426,450,498,506,514,618,729,730,738,746,969,973,981,1025,1034,1060,1070,1140,1331,1365,1371,1440,1596,1604,1612,1615,1635,1656,1682,1694,1711,1740]
for f in frames:
 target=QA/f'frame-{f:04d}.jpg'
 if not target.exists():run(['ffmpeg','-v','error','-nostdin','-n','-ss',str(f/30),'-i',str(NEW),'-frames:v','1','-q:v','2',str(target)])
(QA/'technical-review.v1.json').write_text(json.dumps({'schema':'director-motion-minute-review/v1','knowledgeContext':g,'candidate':str(NEW.relative_to(ROOT)),'productionReceipt':({'path':str(receipt[0].relative_to(ROOT)),'sha256':sha(receipt[0])} if receipt else None),'productionRegistrationStatus':('passed' if receipt else 'blocked-context-stale-after-render'),'postRenderReconciliation':reconciliation,'nativeAudioSha256':sha(NATIVE),'derivedOnly':True,'newAndNoSfxVideoPacketsIdentical':True,'originalComparison':'原版画面原帧1604至3402，改用同一native底声以隔离新增音效影响；没有改历史成片。','outputs':meta,'framesExtracted':frames,'visualHumanAccepted':False,'audioHumanAccepted':False,'formalVersionChanged':False},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':'media-technical-checks-complete','frames':1798,'seconds':1798/30,'outputs':[str(p) for p in [NEW,no,original]],'normalSpeedHumanReview':'pending'},ensure_ascii=False))
