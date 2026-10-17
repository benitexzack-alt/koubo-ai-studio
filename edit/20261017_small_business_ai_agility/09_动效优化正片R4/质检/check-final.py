"""本期全片候选只读检查；输入文件不修改，输出只写本目录的新标签。"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import re
from fractions import Fraction
import numpy as np

HERE = Path(__file__).resolve().parent
EPISODE = HERE.parent.parent
ROOT = EPISODE.parent.parent
spec = importlib.util.spec_from_file_location('existing_qa', EPISODE / '06_预览与质检/视频候选R2/check-video.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def sync_windows(plan, reference, actual):
    events = {e['id']: e['frame'] for e in plan['events']}
    occupied = [(s['window']['from']/30, s['window']['to']/30) for s in plan['mediaSlots'] if s.get('window')]
    for cue in plan['sfx']:
        start = (events[cue['eventId']] - cue['transientOffsetFrames'])/30
        occupied.append((start-.3, start+(cue['trimAfterFrame']-cue['trimBeforeFrame'])/30+.3))
    results = []
    for center in [15.5, 38.5, 78.5, 102.5, 134.5]:
        options = sorted(np.arange(center-4, center+4.01, .25), key=lambda x: abs(x-center))
        chosen = next((float(c) for c in options if c-1 >= 0 and c+1 < 4126/30 and
                       not any(c+1 > a and c-1 < b for a, b in occupied)), None)
        if chosen is None:
            raise ValueError(f'无法在{center}秒附近找到不含附加声的同步窗')
        start, end = chosen-1, chosen+1
        a, b = round(start*16000), round(end*16000)
        x, y = reference[a:b].astype('float64'), actual[a:b].astype('float64')
        if len(x) != b-a or len(y) != b-a:
            raise ValueError('同步窗音频不足')
        x -= x.mean(); y -= y.mean()
        size = 1 << (len(x)+len(y)-2).bit_length()
        values = np.fft.irfft(np.conj(np.fft.rfft(x, size))*np.fft.rfft(y, size), size)
        lags = np.arange(-3200, 3201)
        lag = int(lags[np.argmax(values[lags % size])])
        corr = helper.correlation(x[max(0, -lag):len(x)-max(0, lag)], y[max(0, lag):len(y)-max(0, -lag)])
        results.append({'seconds':[start,end], 'lagMs':lag/16, 'alignedCorrelation':corr,
                        'pass':abs(lag/16)<1 and corr is not None and corr>.98})
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', type=Path)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--audio-only', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'[\w\-\u4e00-\u9fff]{1,80}', args.tag):
        parser.error('标签只能含中文、数字、字母、连字符和下划线')
    out = HERE / args.tag; out.mkdir(exist_ok=False)
    video = args.video.resolve(strict=True)
    voice = EPISODE / '05_剪辑工程/public/audio/voice.m4a'
    baseline = json.loads((EPISODE / '05_剪辑工程/runtime-plan.v1.json').read_text())
    plan = json.loads(args.runtime.read_text())
    report = {'schemaVersion':'agility-r4-candidate-technical-qa/v1', 'video':str(video),
              'videoSha256':helper.sha(video), 'runtime':str(args.runtime.resolve()),
              'runtimeSha256':helper.sha(args.runtime), 'automaticChecksPassed':False,
              'humanFullWatchConfirmed':False, 'publishAuthorized':False, 'formalAccepted':False,
              'scope':'技术检查；不代替用户完整观看、音效听感和内容事实审阅。'}
    try:
        probe = json.loads(helper.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]).stdout)
        v = next(s for s in probe['streams'] if s['codec_type']=='video')
        report['probe'] = probe
        report['metadataPass'] = (v['width'],v['height'])==(1920,1080) and Fraction(v['avg_frame_rate'])==30 and int(v['nb_frames'])==4126 and abs(float(probe['format']['duration'])-4126/30)<.1
        report['preservedInputs'] = {k:plan[k]==baseline[k] for k in ['host','voice','captions','mediaSlots','cameraWindows','fonts']}
        report['captionPageCount'] = len(plan['captions'])
        reference, actual = helper.pcm(voice), helper.pcm(video)
        report['syncWindows'] = sync_windows(plan, reference, actual)
        report['sameTimestampSyncPass'] = all(w['pass'] for w in report['syncWindows'])
        if not args.audio_only:
            decoded = helper.run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(video),'-f','null','-'])
            (out/'完整解码日志.txt').write_text(decoded.stderr.decode(errors='replace'))
            report['fullDecode'] = True
            checks = helper.run(['ffmpeg','-nostdin','-hide_banner','-i',str(video),'-vf','blackdetect=d=0.15:pix_th=0.1:pic_th=0.98','-af','silencedetect=n=-50dB:d=2,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'])
            log = checks.stderr.decode(errors='replace'); (out/'黑帧静音响度日志.txt').write_text(log)
            report['blackSegments'] = [l for l in log.splitlines() if 'black_start:' in l]
            report['silenceSegments'] = [l for l in log.splitlines() if 'silence_start:' in l or 'silence_end:' in l]
            report['loudness'] = helper.loudness_from_log(log)
            report['peakSafe'] = math.isfinite(report['loudness']['truePeakDbtp']) and report['loudness']['truePeakDbtp'] <= -1.5
            times = [2.2,10.7,12.6,22.6,25,33.13,39.2,46.2,48.2,49.8,52.8,55.7,58.7,66.6,67,69,73.9,74.6,80.4,82.2,85.8,90.4,94.5,96.5,99.6,102.6,104.8,106.2,112.3,115.8,118.4,120.3,123,131.3,136]
            from PIL import Image, ImageDraw
            canvas = Image.new('RGB',(1440,294*math.ceil(len(times)/3)),'#252525'); draw = ImageDraw.Draw(canvas)
            for i,t in enumerate(times):
                dst = out/f'{t:07.3f}s.jpg'
                helper.run(['ffmpeg','-nostdin','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1','-q:v','2',str(dst)])
                im = Image.open(dst); im.thumbnail((480,270)); x=i%3*480;y=i//3*294
                canvas.paste(im,(x,y+24)); draw.text((x+12,y+6),f'{t:.3f}s',fill='white')
            canvas.save(out/'全片关键帧联系表.jpg',quality=91)
            report['checkedFrameTimes'] = times
            report['automaticChecksPassed'] = all([report['metadataPass'],all(report['preservedInputs'].values()),report['sameTimestampSyncPass'],report['fullDecode'],not report['blackSegments'],not report['silenceSegments'],report['peakSafe']])
        else:
            report['scope'] = '原始导出的音频偏移测量，尚未做完整技术检查。'
    except Exception as e:
        report['error'] = f'{type(e).__name__}: {e}'
    (out/'技术检查.v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'report':str(out/'技术检查.v1.json'),'passed':report['automaticChecksPassed'],'syncWindows':report.get('syncWindows'),'error':report.get('error')},ensure_ascii=False))
    return 0 if (args.audio_only and 'error' not in report) or report['automaticChecksPassed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
