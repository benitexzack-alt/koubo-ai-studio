"""只读检查本期 24–47 秒 R3 对照片；所有输出落在本文件所在质检目录。"""
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
HELPER = EPISODE / '06_预览与质检/视频候选R2/check-video.py'
spec = importlib.util.spec_from_file_location('readonly_r2_qa_helpers', HELPER)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', type=Path)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--runtime', type=Path)
    parser.add_argument('--transition-frames', action='store_true', help='只复核本轮实际失败的三处过渡边界')
    args = parser.parse_args()
    if not re.fullmatch(r'[\w\-\u4e00-\u9fff]{1,80}', args.tag):
        parser.error('标签只能包含中文、字母、数字、下划线和短横线')
    output = HERE / args.tag
    output.mkdir(exist_ok=False)
    video = args.video.resolve(strict=True)
    voice = EPISODE / '05_剪辑工程/public/audio/voice.m4a'
    reference_runtime = EPISODE / '05_剪辑工程/runtime-plan.v1.json'
    report = {
        'schemaVersion': 'agility-r3-local-sample-qa/v1',
        'video': str(video), 'videoSha256': helper.sha(video),
        'voice': str(voice), 'voiceSha256': helper.sha(voice),
        'sourceRangeSeconds': [24, 47], 'expectedFrames': 690,
        'automaticChecksPassed': False, 'humanFullWatchConfirmed': False,
        'formalAccepted': False, 'publishAuthorized': False,
        'scope': '技术检查及渲染输入字幕一致性；不代替完整观看、视觉质量和听审。',
    }
    try:
        probe = json.loads(helper.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(video)]).stdout)
        report['probe'] = probe
        stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        report['metadataPass'] = (stream['width'], stream['height']) == (1920, 1080) and Fraction(stream['avg_frame_rate']) == 30 and int(stream['nb_frames']) == 690 and abs(float(probe['format']['duration']) - 23) <= .05
        decoded = helper.run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', str(video), '-f', 'null', '-'])
        (output / '完整解码日志.txt').write_text(decoded.stderr.decode(errors='replace'))
        report['fullDecode'] = True
        result = helper.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', str(video), '-vf', 'blackdetect=d=0.15:pix_th=0.1:pic_th=0.98', '-af', 'silencedetect=n=-50dB:d=1.5,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
        log = result.stderr.decode(errors='replace')
        (output / '黑帧静音响度日志.txt').write_text(log)
        report['blackSegments'] = [line for line in log.splitlines() if 'black_start:' in line]
        report['silenceSegments'] = [line for line in log.splitlines() if 'silence_start:' in line or 'silence_end:' in line]
        report['loudness'] = helper.loudness_from_log(log)
        raw = helper.pcm(voice)[24 * 16000:47 * 16000]
        actual = helper.pcm(video)
        windows = []
        for start, end in [(2, 4), (6.5, 8.5), (18.5, 20.5)]:
            a, b = int(start * 16000), int(end * 16000)
            x, y = raw[a:b].astype('float64'), actual[a:b].astype('float64')
            if x.size != y.size or x.size != b-a:
                raise ValueError('音频窗口不完整')
            x -= x.mean(); y -= y.mean()
            size = 1 << (len(x) + len(y) - 2).bit_length()
            values = np.fft.irfft(np.conj(np.fft.rfft(x, size)) * np.fft.rfft(y, size), size)
            lags = np.arange(-3200, 3201)
            lag = int(lags[np.argmax(values[lags % size])])
            aligned = helper.correlation(x[max(0, -lag):len(x)-max(0, lag)], y[max(0, lag):len(y)-max(0, -lag)])
            windows.append({'localSeconds': [start, end], 'sourceSeconds': [start + 24, end + 24], 'lagMs': lag / 16, 'alignedCorrelation': aligned, 'pass': abs(lag / 16) < 1 and aligned is not None and aligned > .98})
        report['syncWindows'] = windows
        report['sameTimestampSyncPass'] = all(w['pass'] for w in windows)
        report['syncMethod'] = '16kHz单声道三窗口±200ms互相关；参考原声24–47秒，正值表示小样音轨延迟。'
        if args.runtime:
            def caption_slice(path):
                d = json.loads(path.read_text())
                return [c for c in d['captions'] if c['to'] > 720 and c['from'] < 1410]
            expected = caption_slice(reference_runtime)
            candidate = caption_slice(args.runtime)
            report['captionInputCheck'] = {'reference': str(reference_runtime), 'referenceSha256': helper.sha(reference_runtime), 'candidate': str(args.runtime), 'candidateSha256': helper.sha(args.runtime), 'expectedPages': expected, 'pageCount': len(expected), 'exactMatch': candidate == expected, 'scope': '渲染字幕数据中文、英文、时点、关键词完全一致；不冒充画面OCR或音频逐字听审。'}
        frames = []
        source_times = sorted(set([24.2, 25, 26.5, 29.5, 32.4, 33.5, 35.7, 36.6, 38.9, 40.6, 43.7, 46.5] + [f / 30 for f in [750, 805, 900, 940, 980, 1005, 1080, 1120, 1175, 1225, 1276, 1315, 1395]]))
        if args.transition_frames:
            source_times = [f / 30 for f in [880, 882, 884, 886, 986, 988, 990, 992, 994, 996, 998, 1375, 1376, 1378, 1380, 1386]]
        for source_time in source_times:
            t = source_time - 24
            dst = output / f'源{t+24:.3f}s_小样{t:.3f}s.jpg'
            if args.transition_frames:
                helper.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(video), '-vf', f'select=eq(n\\,{round(t * 30)})', '-frames:v', '1', '-q:v', '2', str(dst)])
            else:
                helper.run(['ffmpeg', '-nostdin', '-v', 'error', '-ss', str(t), '-i', str(video), '-frames:v', '1', '-q:v', '2', str(dst)])
            frames.append(dst)
        from PIL import Image, ImageDraw
        canvas = Image.new('RGB', (1440, math.ceil(len(frames) / 3) * 294), '#252525'); draw = ImageDraw.Draw(canvas)
        for i, f in enumerate(frames):
            im = Image.open(f); im.thumbnail((480, 270)); x = i % 3 * 480; y = i // 3 * 294
            canvas.paste(im, (x, y + 24)); draw.text((x+12, y+6), f'{source_times[i]:.3f}s', fill='white')
        contact = output / '关键帧联系表.jpg'; canvas.save(contact, quality=92)
        report['frameContactSheet'] = str(contact)
        report['sourceFrameTimesSeconds'] = source_times
        report['sourceAndCandidateUnchanged'] = helper.sha(video) == report['videoSha256'] and helper.sha(voice) == report['voiceSha256']
        finite = all(math.isfinite(report['loudness'][k]) for k in ['integratedLufs', 'truePeakDbtp', 'rangeLu'])
        report['automaticChecksPassed'] = all([report['metadataPass'], report['fullDecode'], not report['blackSegments'], not report['silenceSegments'], report['sameTimestampSyncPass'], report['sourceAndCandidateUnchanged'], finite, report.get('captionInputCheck', {}).get('exactMatch', True)])
    except Exception as e:
        report['error'] = f'{type(e).__name__}: {e}'
    (output / '技术检查.v1.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({'report': str(output / '技术检查.v1.json'), 'automaticChecksPassed': report['automaticChecksPassed'], 'error': report.get('error')}, ensure_ascii=False))
    return 0 if report['automaticChecksPassed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
