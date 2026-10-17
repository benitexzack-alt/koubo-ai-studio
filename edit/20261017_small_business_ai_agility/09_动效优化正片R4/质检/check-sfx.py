"""对实际输出减去原声，检查每个计划音效是否存在；不替代正常速度听感验收。"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import numpy as np

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parent.parent / '05_剪辑工程/public'
RATE = 48000


def pcm(path):
    out = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path),
                          '-map', '0:a:0', '-ar', str(RATE), '-ac', '1', '-f', 'f32le', '-'],
                         capture_output=True, check=True)
    return np.frombuffer(out.stdout, dtype='<f4')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('video', type=Path)
    p.add_argument('runtime', type=Path)
    p.add_argument('output', type=Path)
    args = p.parse_args()
    if args.output.exists():
        raise ValueError('拒绝覆盖检查回执')
    plan = json.loads(args.runtime.read_text())
    actual, voice = pcm(args.video), pcm(PUBLIC / plan['voice']['src'])
    size = min(len(actual), len(voice))
    residual = actual[:size].astype('float64') - voice[:size].astype('float64')
    events = {e['id']: e['frame'] for e in plan['events']}
    results = []
    for cue in plan['sfx']:
        source = pcm(PUBLIC / cue['src']).astype('float64')
        start = round((events[cue['eventId']] - cue['transientOffsetFrames']) / 30 * RATE)
        trim = round(cue['trimBeforeFrame'] / 30 * RATE)
        duration = cue['trimAfterFrame'] - cue['trimBeforeFrame']
        length = round(duration / 30 * RATE)
        signal = np.pad(source[trim:trim+length], (0, max(0, trim+length-len(source))))
        # 当前 @remotion/media 在每个视频帧上求一次 volume，再作用于该帧音频块。
        f = np.floor(np.arange(length) / RATE * 30)
        fade_in = np.clip(f / cue['fadeInFrames'], 0, 1) if cue['fadeInFrames'] else 1
        fade_out = np.clip((duration-f) / cue['fadeOutFrames'], 0, 1) if cue['fadeOutFrames'] else 1
        expected = signal * cue['gain'] * fade_in * fade_out
        observed = residual[start:start+length]
        denom = float(np.dot(expected, expected))
        coeff = float(np.dot(observed, expected)/denom) if denom else None
        corr = float(np.corrcoef(observed, expected)[0, 1]) if np.std(observed) and np.std(expected) else None
        results.append({'eventId':cue['eventId'], 'frame':events[cue['eventId']], 'src':cue['src'],
                        'residualCorrelation':corr, 'expectedSignalCoefficient':coeff,
                        'residualPeakDbfs':float(20*np.log10(max(np.max(np.abs(observed)), 1e-12))),
                        'signalDetected':bool(corr is not None and corr>.30 and coeff is not None and coeff>.2)})
    report = {'video':str(args.video.resolve()), 'videoSha256':hashlib.sha256(args.video.read_bytes()).hexdigest(),
              'scope':'解码混音减去同时间原声，与本期裁窗淡变声源相关；检测存在而非人工听感通过。',
              'events':results, 'allSignalsDetected':all(r['signalDetected'] for r in results),
              'humanAuditionConfirmed':False}
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'count':len(results),'detected':sum(r['signalDetected'] for r in results),
                      'notDetected':[r for r in results if not r['signalDetected']],
                      'report':str(args.output)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
