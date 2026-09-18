from pathlib import Path
import hashlib,json,subprocess,sys
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'edit/20260917_ai_efficiency_sharing'
QA=BASE/'07_预览与质检/formal-v1'
QA.mkdir(parents=True,exist_ok=True)
RAW=BASE/'08_正式成片/员工AI增效分配_正式渲染原始_v1.mp4'
FINAL=BASE/'08_正式成片/员工AI增效分配_V8_1080P_正式候选_v1.mp4'
HOST=BASE/'01_素材投放区/01_口播原片/copy_A5DE456A-4712-4A6D-8425-FFB1EE24D2C9.MOV'
DURATION=4669/30
RATE=48000
def run(args):
    r=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace')[-2500:])
    return r
def write(name,data):
    (QA/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def ref(p):return {'path':str(p.relative_to(ROOT)),'sha256':sha(p),'bytes':p.stat().st_size}
def pcm(p):
    return np.frombuffer(run(['ffmpeg','-v','error','-i',str(p),'-vn','-ac','1','-ar',str(RATE),'-f','f32le','-']).stdout,dtype='<f4').astype(np.float64)
def locate(host,target):
    rows=[]
    for t in [2.,35.,70.,95.,122.,150.]:
        margin=4800;n=RATE
        sample=int(t*RATE)
        a=host[sample-margin:sample+n+margin];b=target[sample:sample+n]
        size=1<<(len(a)+len(b)-2).bit_length()
        corr=np.fft.irfft(np.fft.rfft(a,size)*np.fft.rfft(b[::-1],size),size)[n-1:len(a)]
        sq=np.concatenate(([0.],np.cumsum(a*a)))
        norm=np.sqrt(np.maximum(sq[n:]-sq[:-n],1e-20)*np.sum(b*b))
        coeff=corr/norm;idx=int(np.argmax(coeff))
        rows.append({'atSeconds':t,'sourceOffsetSamples':idx-margin,'offsetMs':(idx-margin)/48,'correlation':float(coeff[idx])})
    return rows
def loudness(p,af=''):
    filt=(af+',' if af else '')+'loudnorm=I=-16:TP=-2.2:LRA=11:print_format=json'
    r=run(['ffmpeg','-hide_banner','-nostats','-i',str(p),'-vn','-af',filt,'-f','null','-'])
    text=r.stderr.decode();return json.JSONDecoder().raw_decode(text[text.rfind('{'):])[0]
def video_hash(p):
    return run(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).stdout.decode().strip()

if sys.argv[1]=='audio':
    assert not FINAL.exists(),'禁止覆盖候选成片'
    host=pcm(HOST);raw=pcm(RAW);locations=locate(host,raw)
    write('原始渲染声画定位.v1.json',locations)
    offsets=[x['sourceOffsetSamples'] for x in locations]
    assert len(set(offsets))==1 and min(x['correlation'] for x in locations)>.99,locations
    padding=-offsets[0]
    assert 0<=padding<=4096,padding
    alignment=f'atrim=start_sample={padding},asetpts=PTS-STARTPTS'
    measure=loudness(RAW,alignment);write('原始响度.v1.json',measure)
    filt=alignment+(',loudnorm=I=-16:TP=-2.2:LRA=11:'
      f'measured_I={measure["input_i"]}:measured_TP={measure["input_tp"]}:'
      f'measured_LRA={measure["input_lra"]}:measured_thresh={measure["input_thresh"]}:'
      f'offset={measure["target_offset"]}:linear=true:print_format=json')
    result=run(['ffmpeg','-hide_banner','-nostats','-i',str(RAW),'-map','0:v:0','-map','0:a:0','-c:v','copy',
      '-af',filt,'-ar','48000','-c:a','aac','-b:a','320k','-t',str(DURATION),'-movflags','+faststart',str(FINAL)])
    (QA/'音频母版执行.log').write_bytes(result.stderr)
    final_locations=locate(host,pcm(FINAL));write('正式片声画定位.v1.json',final_locations)
    assert all(abs(x['sourceOffsetSamples'])<=1 for x in final_locations),final_locations
    before=video_hash(RAW);after=video_hash(FINAL);assert before==after
    metrics=loudness(FINAL)
    assert abs(float(metrics['input_i'])+16)<=.6 and float(metrics['input_tp'])<=-1.5,metrics
    write('音频母版回执.v1.json',{'schema':'employee-ai-formal-master/v1','source':ref(RAW),'output':ref(FINAL),
      'script':ref(Path(__file__)),'videoCopiedWithoutReencoding':True,'videoPacketSha256':after,
      'removedEncoderPrimingSamples':padding,'sampleRate':RATE,'alignment':final_locations,'measured':metrics,
      'fullWatchConfirmed':False,'publishAuthorized':False})
    print(json.dumps({'status':'audio-mastered','samplesCorrected':padding,'lufs':metrics['input_i'],'peak':metrics['input_tp']}),flush=True)
elif sys.argv[1]=='qa':
    r=run(['ffmpeg','-hide_banner','-nostats','-i',str(FINAL),'-vf','blackdetect=d=0.15:pix_th=0.10',
      '-af','silencedetect=noise=-45dB:d=1.5','-f','null','-'])
    log=r.stderr.decode();(QA/'全片解码与黑帧静音.log').write_text(log)
    black=[x for x in log.splitlines() if 'black_start:' in x]
    silence=[x for x in log.splitlines() if 'silence_start:' in x or 'silence_end:' in x]
    probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(FINAL)]).stdout)
    write('正式片探测.v1.json',probe)
    video=next(x for x in probe['streams'] if x['codec_type']=='video')
    assert video['nb_frames']=='4669' and video['width']==1920 and video['height']==1080 and video['r_frame_rate']=='30/1'
    assert not black and not silence,(black,silence)
    write('技术质检.v1.json',{'status':'passed','source':ref(FINAL),'fullDecodeExit':0,'blackEvents':black,'silenceEvents':silence,
      'frames':4669,'durationSeconds':DURATION,'fps':30,'width':1920,'height':1080})
    print(json.dumps({'status':'technical-passed','blackEvents':len(black),'silenceEvents':len(silence)}),flush=True)
elif sys.argv[1]=='frames':
    frames=QA/'frames';frames.mkdir(exist_ok=True)
    times=[0,5,7.5,10,14.9,15.1,18,20,24.9,25.1,27.4,35,47.6,55,60.5,63,65.6,70,80,84,90,101.8,107.3,109.8,112.2,113.9,116,119,126.5,129,131.6,140,143,150,154.8]
    rows=[]
    for t in times:
        p=frames/f'{round(t*30):05d}.png'
        run(['ffmpeg','-v','error','-ss',str(t),'-i',str(FINAL),'-frames:v','1','-update','1','-y',str(p)])
        pixels=Image.open(p).convert('RGB').tobytes()
        rows.append({**ref(p),'atSeconds':t,'frameIndex':round(t*30),'pixelSha256':hashlib.sha256(pixels).hexdigest()})
    write('风险帧回执.v1.json',{'sourceVideo':ref(FINAL),'frames':rows})
    for page in range((len(rows)+7)//8):
        sheet=Image.new('RGB',(1280,4*390),(30,30,30));d=ImageDraw.Draw(sheet)
        for i,row in enumerate(rows[page*8:page*8+8]):
            x=(i%2)*640;y=(i//2)*390
            im=Image.open(ROOT/row['path']);im.thumbnail((640,360));sheet.paste(im,(x,y+30));d.text((x+12,y+8),f"{row['atSeconds']:.3f}s",fill='white')
        sheet.save(QA/f'风险帧联系表_{page+1}.jpg',quality=94)
    print(json.dumps({'status':'frames-extracted','count':len(rows)}),flush=True)
else:raise ValueError('audio / qa / frames')
