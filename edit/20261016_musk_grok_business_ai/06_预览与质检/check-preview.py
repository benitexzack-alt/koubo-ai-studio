#!/usr/bin/env python3
"""只检验已受控导出的本期小样，不渲染、不改媒体、不宣告人工通过。"""
from pathlib import Path
import hashlib, json, re, subprocess, sys, datetime, array, statistics
root=Path(__file__).resolve().parents[3]
episode=root/'edit/20261016_musk_grok_business_ai'
video=episode/'05_后期工程/本期候选输入/内部审阅候选_有音效.mp4'
out=Path(__file__).resolve().parent
if not video.is_file():
    raise SystemExit('本期小样尚不存在，未执行检查。')
receipts=list(video.parent.glob('.'+video.name+'.production-receipt.*.json'))
sha=hashlib.sha256(video.read_bytes()).hexdigest()
receipts=[p for p in receipts if json.loads(p.read_text()).get('output',{}).get('sha256')==sha]
if len(receipts)!=1:
    raise SystemExit('未找到唯一且哈希匹配的受控导出回执。')
probe=subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)],capture_output=True,text=True,check=True)
media=json.loads(probe.stdout)
(out/'媒体参数.v1.json').write_text(json.dumps(media,ensure_ascii=False,indent=2)+'\n')
command=['ffmpeg','-hide_banner','-nostdin','-i',str(video),'-vf','blackdetect=d=0.15:pix_th=0.08','-af','silencedetect=n=-50dB:d=0.5,ebur128=peak=true','-f','null','-']
check=subprocess.run(command,capture_output=True,text=True)
(out/'解码与声画检测.log').write_text(check.stderr)
v=next(x for x in media['streams'] if x['codec_type']=='video')
a=next(x for x in media['streams'] if x['codec_type']=='audio')
black=re.findall(r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)',check.stderr)
silence=re.findall(r'silence_end: ([\d.]+) \| silence_duration: ([\d.]+)',check.stderr)
summary=check.stderr.rsplit('Summary:',1)[-1].strip()
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'file':str(video),'sha256':sha,'bytes':video.stat().st_size,'controlledReceipt':str(receipts[0]),'decodeExitCode':check.returncode,'expectedVideoFrames':5035,'actualVideoFrames':int(v.get('nb_frames',0)),'durationSeconds':float(media['format']['duration']),'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate'],'videoCodec':v['codec_name'],'audioCodec':a['codec_name'],'blackWindows':black,'silenceWindows':silence,'audioMeasurementSummary':summary,'normalSpeedFullWatchPerformed':False,'listeningAcceptancePerformed':False,'userAccepted':False,'publishAuthorized':False}
# 20至25秒没有附加音效/插片音；检验渲染后的真实口播声道是否同点同步。
voice=episode/'05_后期工程/public/audio/voice.m4a'
cor=subprocess.run(['ffmpeg','-v','error','-nostdin','-ss','20','-t','5','-i',str(voice),'-ss','20','-t','5','-i',str(video),'-filter_complex','[0:a]aresample=16000,aformat=channel_layouts=mono[a];[1:a]aresample=16000,aformat=channel_layouts=mono[b];[a][b]axcorrelate=size=4096:algo=fast[out]','-map','[out]','-f','f32le','-'],capture_output=True)
values=array.array('f');values.frombytes(cor.stdout)
valid=[float(x) for x in values if x > 0.1]
report['voiceWindowCorrelation']={'startSeconds':20,'endSeconds':25,'exitCode':cor.returncode,'samples':len(values),'meanNonSilent':statistics.mean(valid) if valid else None,'normalSpeedListeningPerformed':False,'scope':'只证明无附加音窗的波形同步，不替代整片听审'}
report['voiceWindowCorrelation']['pass']=cor.returncode==0 and len(valid)>16000 and statistics.mean(valid)>0.95
report['technicalStructurePass']=check.returncode==0 and report['actualVideoFrames']==5035 and abs(report['durationSeconds']-5035/30)<0.1 and v['width']==1280 and v['height']==720 and not black and report['voiceWindowCorrelation']['pass']
(out/'小样技术检查.v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['technicalStructurePass','decodeExitCode','actualVideoFrames','durationSeconds','blackWindows','silenceWindows','audioMeasurementSummary','voiceWindowCorrelation']},ensure_ascii=False,indent=2))
sys.exit(0 if report['technicalStructurePass'] else 1)
