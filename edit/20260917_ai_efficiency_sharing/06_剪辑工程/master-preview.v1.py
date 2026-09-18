from pathlib import Path
import sys,json,subprocess,hashlib

root=Path(__file__).resolve().parents[3]
folder=root/'edit/20260917_ai_efficiency_sharing/07_预览与质检'
variant=sys.argv[1]
assert variant in ['with-sfx','no-sfx']
label='有附加音效' if variant=='with-sfx' else '仅原声'
source=folder/f'员工AI增效分配_代表预览_{label}_v1.mp4'
output=folder/f'员工AI增效分配_代表预览_{label}_响度统一_v2.mp4'
assert not output.exists(),'禁止覆盖已有预览'
measure=json.loads((folder/f'preview-{variant}.raw-loudness.v1.json').read_text())
# 两版受控输出均有2048/48000秒编码前填充；逐段波形证据定位为统一42.667毫秒延迟。
# 移除渲染编码填充，不删改原片内容或既有剪辑点。
audio_filter=('atrim=start_sample=2048,asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-2.2:LRA=11:'
    f'measured_I={measure["input_i"]}:measured_TP={measure["input_tp"]}:'
    f'measured_LRA={measure["input_lra"]}:measured_thresh={measure["input_thresh"]}:'
    f'offset={measure["target_offset"]}:linear=true:print_format=json')
command=['ffmpeg','-hide_banner','-nostats','-i',str(source),'-map','0:v:0','-map','0:a:0',
    '-c:v','copy','-af',audio_filter,'-ar','48000','-c:a','aac','-b:a','320k',
    '-t',str(1232/30),'-movflags','+faststart',str(output)]
result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
if result.returncode: print(result.stderr[-1800:]);raise SystemExit(result.returncode)
verify=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(output),
    '-vf','blackdetect=d=0.15:pix_th=0.10','-af','loudnorm=I=-16:TP=-2.2:LRA=11:print_format=json',
    '-f','null','-'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
t=verify.stderr;metrics=json.JSONDecoder().raw_decode(t[t.rfind('{'):])[0]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
packet_hash=lambda p:subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-'],text=True).strip()
original_video_hash=packet_hash(source);mastered_video_hash=packet_hash(output)
report={'schemaVersion':'koubo-preview-audio-master/v1','source':{'path':str(source.relative_to(root)),'sha256':sha(source)},
    'output':{'path':str(output.relative_to(root)),'sha256':sha(output)},'scriptSha256':sha(Path(__file__)),
    'videoCopiedWithoutReencoding':original_video_hash==mastered_video_hash,'videoPacketSha256':mastered_video_hash,
    'baseline':{'integratedLufs':-16,'truePeakDbtp':-2.2,'sampleRate':48000,'audioBitrate':'320k'},
    'audioAlignmentCorrection':{'removedEncoderPrimingSamples':2048,'sampleRate':48000,'milliseconds':2048/48,
        'evidence':'预览原声逐段定位.v1.json；原始预览音轨41.109333秒，比1232帧视频长42.667毫秒'},
    'measured':metrics,'fullDecodeExit':verify.returncode,'blackEvents':[x for x in t.splitlines() if 'black_start:' in x],
    'userAudibilityConfirmed':False,'fullWatchConfirmed':False,'formalCandidate':False}
assert report['videoCopiedWithoutReencoding']
assert verify.returncode==0
assert abs(float(metrics['input_i'])+16)<=0.6
assert float(metrics['input_tp'])<=-1.5
(folder/f'preview-{variant}.mastering-receipt.v2.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'variant':variant,'lufs':metrics['input_i'],'truePeak':metrics['input_tp'],
    'videoUnchanged':report['videoCopiedWithoutReencoding'],'blackEvents':report['blackEvents'],'output':str(output)},ensure_ascii=False))
