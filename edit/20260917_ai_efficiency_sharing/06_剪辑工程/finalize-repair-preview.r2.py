from pathlib import Path
import hashlib
import json
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'edit/20260917_ai_efficiency_sharing'
OUT = BASE / '07_预览与质检'
QA = OUT / 'repair-r2-v2'
PLAN = json.loads((ROOT / 'remotion/src/employee-ai-efficiency-v8-r2/runtime-plan.v2.json').read_text())
RATE = 48000
FRAMES = PLAN['previewDurationInFrames']
DURATION = FRAMES / 30
HOST = BASE / '01_素材投放区/01_口播原片/copy_A5DE456A-4712-4A6D-8425-FFB1EE24D2C9.MOV'
PAIRED = OUT / '员工AI增效分配_返修R2_同画面对照_仅原声_v2.mp4'
TIMES = [1., 6., 9.5, 13., 17.5, 20., 24., 27., 30., 34.5, 38., 42.]


def run(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-3000:])
    return result


def write(name, data):
    (QA / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def ref(path):
    return {'path': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}


def pcm(path):
    return np.frombuffer(run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-']).stdout, dtype='<f4').astype(np.float64)


def locate(reference, target):
    rows = []
    for time in TIMES:
        margin, n, sample = 4800, RATE, round(time * RATE)
        a, b = reference[sample-margin:sample+n+margin], target[sample:sample+n]
        size = 1 << (len(a)+len(b)-2).bit_length()
        corr = np.fft.irfft(np.fft.rfft(a, size)*np.fft.rfft(b[::-1], size), size)[n-1:len(a)]
        sq = np.concatenate(([0.], np.cumsum(a*a)))
        coeff = corr / np.sqrt(np.maximum(sq[n:]-sq[:-n], 1e-20)*np.sum(b*b))
        index = int(np.argmax(coeff))
        rows.append({'atSeconds': time, 'sourceOffsetSamples': index-margin, 'offsetMs': (index-margin)/48, 'correlation': float(coeff[index])})
    return rows


def loudness(path, prefix=''):
    filt = (prefix + ',' if prefix else '') + 'loudnorm=I=-16:TP=-2.2:LRA=11:print_format=json'
    text = run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-vn', '-af', filt, '-f', 'null', '-']).stderr.decode()
    return json.JSONDecoder().raw_decode(text[text.rfind('{'):])[0]


def video_hash(path):
    return run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).stdout.decode().strip()


def paths(mode):
    label = '有附加音效' if mode == 'with-sfx' else '仅原声'
    return OUT / f'员工AI增效分配_返修R2_代表预览_{label}_v2.mp4', OUT / f'员工AI增效分配_返修R2_观看版_{label}_v2.mp4'


def pair():
    _, picture = paths('with-sfx')
    _, audio = paths('no-sfx')
    assert not PAIRED.exists(), '禁止覆盖同画面对照'
    run(['ffmpeg', '-v', 'error', '-i', str(picture), '-i', str(audio), '-map', '0:v:0', '-map', '1:a:0',
         '-c', 'copy', '-movflags', '+faststart', str(PAIRED)])
    picture_hash, paired_hash = video_hash(picture), video_hash(PAIRED)
    assert picture_hash == paired_hash
    assert np.array_equal(pcm(audio), pcm(PAIRED))
    write('same-picture-receipt.json', {'pictureSource': ref(picture), 'audioSource': ref(audio), 'output': ref(PAIRED),
        'videoPacketSha256': paired_hash, 'videoPacketIdentical': True, 'audioDecodedIdentical': True,
        'independentRenderVideoPacketIdentical': video_hash(picture) == video_hash(audio)})
    print(json.dumps({'status': 'same-picture-paired', 'videoPacketIdentical': True}), flush=True)


QA.mkdir(exist_ok=True)
if sys.argv[1] == 'audio':
    host = pcm(HOST)
    reference = np.concatenate([host[r['startFrame']*1600:r['endFrame']*1600] for r in PLAN['previewRanges']])
    hashes = []
    for mode in ['with-sfx', 'no-sfx']:
        raw, final = paths(mode)
        assert not final.exists(), '禁止覆盖观看版'
        locations = locate(reference, pcm(raw))
        write(f'{mode}.raw-alignment.json', locations)
        offsets = [r['sourceOffsetSamples'] for r in locations]
        # Preview cuts round to milliseconds; permit at most half a millisecond.
        common_offset = round(float(np.median(offsets)))
        assert max(abs(value-common_offset) for value in offsets) <= 24 and min(r['correlation'] for r in locations) > .99, locations
        padding = -common_offset
        assert 0 <= padding <= 4096, padding
        alignment = f'atrim=start_sample={padding},asetpts=PTS-STARTPTS'
        measure = loudness(raw, alignment)
        filt = alignment + (',loudnorm=I=-16:TP=-2.2:LRA=11:'
            f'measured_I={measure["input_i"]}:measured_TP={measure["input_tp"]}:'
            f'measured_LRA={measure["input_lra"]}:measured_thresh={measure["input_thresh"]}:'
            f'offset={measure["target_offset"]}:linear=true:print_format=json')
        result = run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(raw), '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
            '-af', filt, '-ar', '48000', '-c:a', 'aac', '-b:a', '320k', '-t', str(DURATION), '-movflags', '+faststart', str(final)])
        (QA / f'{mode}.audio.log').write_bytes(result.stderr)
        aligned = locate(reference, pcm(final))
        assert all(abs(r['sourceOffsetSamples']) <= 24 for r in aligned), aligned
        before, after = video_hash(raw), video_hash(final)
        assert before == after
        hashes.append(after)
        metrics = loudness(final)
        assert abs(float(metrics['input_i'])+16) <= .6 and float(metrics['input_tp']) <= -1.5, metrics
        write(f'{mode}.master-receipt.json', {'schema': 'employee-ai-repair-preview-master/v1', 'source': ref(raw), 'output': ref(final),
            'script': ref(Path(__file__)), 'videoCopiedWithoutReencoding': True, 'videoPacketSha256': after,
            'removedEncoderPrimingSamples': padding, 'sampleRate': RATE, 'alignment': aligned, 'measured': metrics,
            'previewAccepted': False, 'fullWatchConfirmed': False, 'publishAuthorized': False})
        print(json.dumps({'mode': mode, 'samplesCorrected': padding, 'lufs': metrics['input_i'], 'peak': metrics['input_tp']}), flush=True)
    pair()
elif sys.argv[1] == 'pair':
    pair()
elif sys.argv[1] == 'qa':
    for mode in ['with-sfx', 'no-sfx']:
        _, final = paths(mode)
        if mode == 'no-sfx':
            final = PAIRED
        result = run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(final), '-vf', 'blackdetect=d=0.15:pix_th=0.10',
            '-af', 'silencedetect=noise=-45dB:d=1.5', '-f', 'null', '-'])
        log = result.stderr.decode()
        (QA / f'{mode}.decode.log').write_text(log)
        black = [line for line in log.splitlines() if 'black_start:' in line]
        silence = [line for line in log.splitlines() if 'silence_start:' in line or 'silence_end:' in line]
        probe = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(final)]).stdout)
        video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
        assert int(video['nb_frames']) == FRAMES and video['width'] == 1920 and video['height'] == 1080 and video['r_frame_rate'] == '30/1'
        assert not black and not silence, (black, silence)
        write(f'{mode}.technical-qa.json', {'status': 'passed', 'source': ref(final), 'probe': probe,
            'fullDecodeExit': 0, 'blackEvents': black, 'silenceEvents': silence, 'frames': FRAMES, 'durationSeconds': DURATION})
        print(json.dumps({'mode': mode, 'status': 'technical-passed', 'frames': FRAMES}), flush=True)
elif sys.argv[1] == 'frames':
    _, final = paths('with-sfx')
    frames = QA / 'frames'
    frames.mkdir(exist_ok=True)
    indexes = [0, 12, 40, 76, 85, 103, 123, 136, 150, 220, 257, 300, 323, 360, 369, 387, 402, 430,
               443, 480, 510, 550, 580, 633, 665, 695, 725, 765, 778, 820, 850, 857, 900, 1011, 1020, 1082,
               1095, 1130, 1160, 1210, 1240, 1290, 1313]
    rows = []
    for index in indexes:
        path = frames / f'{index:04d}.png'
        run(['ffmpeg', '-v', 'error', '-ss', str(index/30), '-i', str(final), '-frames:v', '1', '-update', '1', '-y', str(path)])
        source_range = next(r for r in PLAN['previewRanges'] if r['outputStartFrame'] <= index < r['outputStartFrame']+r['durationInFrames'])
        source_frame = index-source_range['outputStartFrame']+source_range['startFrame']
        rows.append({**ref(path), 'outputFrame': index, 'sourceFrame': source_frame, 'atSeconds': index/30})
    write('frame-evidence.json', {'sourceVideo': ref(final), 'frames': rows})
    selection_path = BASE / '06_剪辑工程/shotcraft-selection.r2-refined.json'
    selection = json.loads(selection_path.read_text())
    canonical = ROOT / 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx'
    consumed = ROOT / 'remotion/src/employee-ai-efficiency-v8-r2/ShotcraftEffects.generated.tsx'
    assert canonical.read_bytes() == consumed.read_bytes()
    applications = []
    for beat in selection['beats']:
        if beat['decision'] != 'apply':
            continue
        start, end = beat['frames']['startFrame'], beat['frames']['endFrameExclusive']
        window = next(r for r in PLAN['previewRanges'] if r['startFrame'] <= start < end <= r['endFrame'])
        offset = window['outputStartFrame']-window['startFrame']
        evidence = [row for row in rows if start+offset < row['outputFrame'] < end+offset]
        assert len(evidence) >= 2
        applications.append({'beatId': beat['beatId'], 'effectId': beat['effectId'], 'sourceFrames': beat['frames'],
            'outputFrames': {'startFrame': start+offset, 'endFrameExclusive': end+offset},
            'component': ref(canonical), 'consumedCopy': ref(consumed), 'evidenceFrames': evidence,
            'userAccepted': False})
    write('shotcraft-preview-evidence.json', {'schema': 'employee-ai-shotcraft-preview-evidence/v1',
        'selection': ref(selection_path), 'output': ref(final), 'applications': applications,
        'scope': '拼接代表预览，源帧与输出帧分别记录；不冒充全长正式片应用回执',
        'formalApplicationReceiptPending': True})
    for page in range((len(rows)+7)//8):
        sheet = Image.new('RGB', (1280, 4*390), (30, 30, 30))
        draw = ImageDraw.Draw(sheet)
        for i, row in enumerate(rows[page*8:page*8+8]):
            x, y = i % 2 * 640, i // 2 * 390
            im = Image.open(ROOT / row['path'])
            im.thumbnail((640, 360))
            sheet.paste(im, (x, y+30))
            draw.text((x+12, y+8), f"Preview {row['atSeconds']:.3f}s / source frame {row['sourceFrame']}", fill='white')
        sheet.save(QA / f'contact-{page+1}.jpg', quality=94)
    print(json.dumps({'status': 'frames-extracted', 'count': len(rows)}), flush=True)
else:
    raise ValueError('audio / pair / qa / frames')
