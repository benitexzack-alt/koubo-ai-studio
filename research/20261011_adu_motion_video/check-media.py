"""真实编码结果检查。机器记录只证明媒体与输入边界，不代替正常视听。"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parent

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(2**20),b''):h.update(b)
    return h.hexdigest()

def run(args):
    return subprocess.run(args,check=True,capture_output=True,text=True)

def inspect(path):
    metadata=json.loads(run(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(path)]).stdout)
    video=next(s for s in metadata['streams'] if s['codec_type']=='video')
    audio=next(s for s in metadata['streams'] if s['codec_type']=='audio')
    decode=run(['ffmpeg','-v','error','-i',str(path),'-f','null','-'])
    black=run(['ffmpeg','-v','info','-i',str(path),'-an','-vf','blackdetect=d=0.08:pix_th=0.10:pic_th=0.98','-f','null','-']).stderr
    pcm=run(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-t',str(412/30),'-c:a','pcm_s16le','-f','hash','-hash','sha256','-']).stdout.strip()
    frames=ROOT/'qa'/path.stem
    frames.mkdir(exist_ok=True)
    for i,t in enumerate([0,2.9,4.5,5.5,6.8,8.5,9.3,12.1,13.4]):
        target=frames/f'{i:02d}_{t:.1f}.jpg'
        run(['ffmpeg','-nostdin','-y','-v','error','-ss',str(t),'-i',str(path),'-frames:v','1','-q:v','2','-update','1',str(target)])
    return {
        'file':str(path),'sha256':sha(path),'bytes':path.stat().st_size,
        'width':video['width'],'height':video['height'],'fps':video['r_frame_rate'],
        'frames':int(video['nb_read_frames']),'duration':float(video['duration']),
        'videoStart':video.get('start_time'),'audioStart':audio.get('start_time'),
        'videoCodec':video['codec_name'],'audioCodec':audio['codec_name'],
        'audioHash':pcm,'decodeErrors':decode.stderr,'blackFrames':re.findall(r'black_start:\S+.*',black),
        'color':{k:video.get(k) for k in ['color_range','color_space','color_transfer','color_primaries']},
    }

def main():
    paths=sorted((ROOT/'outputs').glob('0[0-3]_*.mp4'))
    if len(paths)!=4:raise SystemExit('应有1个对照+3个样片，未齐全。')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(inspect,paths))
    manifest=json.loads((ROOT/'manifest.json').read_text())
    unchanged={key:sha(Path(value['path']))==value['sha256'] for key,value in manifest['inputs'].items()}
    report={
        'files':results,'inputHashesUnchanged':unchanged,
        'sameDecodedAudioAllFour':len(set(r['audioHash'] for r in results))==1,
        'newSamplesSameDecodedAudio':len(set(r['audioHash'] for r in results[1:]))==1,
        'humanAccepted':False,'fullWatchPerformedByUser':False,
        'colorBoundary':'历史对照缺传递函数及原色标签；新片为显式SDR转换。历史字幕条按全范围JPEG/sRGB解释，不作为全流程色彩一致性验收。',
    }
    report['passed']=all(unchanged.values()) and report['sameDecodedAudioAllFour'] and all(r['frames']==412 and r['fps']=='30/1' and r['width']==1920 and r['height']==1080 and abs(r['duration']-412/30)<0.001 and not r['decodeErrors'] and not r['blackFrames'] for r in results)
    (ROOT/'qa/media.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':report['passed'],'sameDecodedAudioAllFour':report['sameDecodedAudioAllFour'],'inputsUnchanged':all(unchanged.values()),'files':[{k:r[k] for k in ['file','frames','duration','bytes','blackFrames','audioStart']} for r in results]},ensure_ascii=False))
    if not report['passed']:raise SystemExit(1)

if __name__=='__main__':main()
