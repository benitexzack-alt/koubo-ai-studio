from pathlib import Path
import hashlib, json, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'edit/20260917_ai_efficiency_sharing'
QA = BASE / '07_预览与质检/formal-r2'
QA.mkdir(parents=True, exist_ok=True)
RAW = BASE / '08_正式成片/员工AI增效分配_R2_正式渲染原始_v1.mp4'
FINAL = BASE / '08_正式成片/员工AI增效分配_R2_V8_1080P_正式候选_v1.mp4'
HOST = BASE / '01_素材投放区/01_口播原片/copy_A5DE456A-4712-4A6D-8425-FFB1EE24D2C9.MOV'
DURATION = 4669 / 30
RATE = 48000

def run(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-3000:])
    return result

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def ref(path):
    return {'path': str(path.relative_to(ROOT)), 'sha256': sha(path), 'bytes': path.stat().st_size}

def write(name, value):
    (QA / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def pcm(path):
    return np.frombuffer(run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-']).stdout, dtype='<f4').astype(np.float64)

def locate(host, target):
    rows = []
    for at in [2.0, 35.0, 70.0, 95.0, 122.0, 150.0]:
        margin, length = 4800, RATE
        sample = int(at * RATE)
        source = host[sample - margin:sample + length + margin]
        segment = target[sample:sample + length]
        size = 1 << (len(source) + len(segment) - 2).bit_length()
        corr = np.fft.irfft(np.fft.rfft(source, size) * np.fft.rfft(segment[::-1], size), size)[length - 1:len(source)]
        sq = np.concatenate(([0.0], np.cumsum(source * source)))
        norm = np.sqrt(np.maximum(sq[length:] - sq[:-length], 1e-20) * np.sum(segment * segment))
        coeff = corr / norm
        index = int(np.argmax(coeff))
        offset = index - margin
        rows.append({'atSeconds': at, 'sourceOffsetSamples': offset, 'offsetMs': offset / 48, 'correlation': float(coeff[index])})
    return rows

def loudness(path, audio_filter=''):
    filt = (audio_filter + ',' if audio_filter else '') + 'loudnorm=I=-16:TP=-2.2:LRA=11:print_format=json'
    text = run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-vn', '-af', filt, '-f', 'null', '-']).stderr.decode()
    return json.JSONDecoder().raw_decode(text[text.rfind('{'):])[0]

def video_hash(path):
    return run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).stdout.decode().strip()

def audio_master():
    if FINAL.exists():
        raise RuntimeError('禁止覆盖已有R2正式候选')
    host, raw = pcm(HOST), pcm(RAW)
    alignment = locate(host, raw)
    write('原始渲染声画定位.r2.json', alignment)
    offsets = [row['sourceOffsetSamples'] for row in alignment]
    if len(set(offsets)) != 1 or min(row['correlation'] for row in alignment) <= 0.99:
        raise RuntimeError(f'原始声画定位不稳定：{alignment}')
    padding = -offsets[0]
    if not 0 <= padding <= 4096:
        raise RuntimeError(f'异常音频起始填充：{padding}')
    trim = f'atrim=start_sample={padding},asetpts=PTS-STARTPTS'
    measured = loudness(RAW, trim)
    write('原始响度.r2.json', measured)
    filt = trim + ',loudnorm=I=-16:TP=-2.2:LRA=11:' + f'measured_I={measured["input_i"]}:measured_TP={measured["input_tp"]}:' + f'measured_LRA={measured["input_lra"]}:measured_thresh={measured["input_thresh"]}:' + f'offset={measured["target_offset"]}:linear=true:print_format=json'
    result = run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(RAW), '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-af', filt, '-ar', str(RATE), '-c:a', 'aac', '-b:a', '320k', '-t', str(DURATION), '-movflags', '+faststart', str(FINAL)])
    (QA / '音频母版执行.log').write_bytes(result.stderr)
    final_alignment = locate(host, pcm(FINAL))
    if any(abs(row['sourceOffsetSamples']) > 1 for row in final_alignment):
        raise RuntimeError(f'正式片声画未对齐：{final_alignment}')
    if video_hash(RAW) != video_hash(FINAL):
        raise RuntimeError('正式片视频包发生重新编码或变化')
    metrics = loudness(FINAL)
    if abs(float(metrics['input_i']) + 16) > 0.6 or float(metrics['input_tp']) > -1.5:
        raise RuntimeError(f'正式片响度不合格：{metrics}')
    write('正式片声画定位.r2.json', final_alignment)
    write('音频母版回执.r2.json', {'schema': 'employee-ai-formal-master/v2', 'source': ref(RAW), 'output': ref(FINAL), 'script': ref(Path(__file__)), 'videoCopiedWithoutReencoding': True, 'videoPacketSha256': video_hash(FINAL), 'removedEncoderPrimingSamples': padding, 'sampleRate': RATE, 'alignment': final_alignment, 'measured': metrics, 'fullWatchConfirmed': False, 'publishAuthorized': False})
    print(json.dumps({'status': 'audio-mastered-r2', 'samplesCorrected': padding, 'lufs': metrics['input_i'], 'peak': metrics['input_tp']}, ensure_ascii=False))

def qa():
    result = run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(FINAL), '-vf', 'blackdetect=d=0.15:pix_th=0.10', '-af', 'silencedetect=noise=-45dB:d=1.5', '-f', 'null', '-'])
    log = result.stderr.decode()
    (QA / '全片解码与黑帧静音.r2.log').write_text(log)
    black = [line for line in log.splitlines() if 'black_start:' in line]
    silence = [line for line in log.splitlines() if 'silence_start:' in line or 'silence_end:' in line]
    probe = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(FINAL)]).stdout)
    write('正式片探测.r2.json', probe)
    video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
    if video.get('nb_frames') != '4669' or video.get('width') != 1920 or video.get('height') != 1080 or video.get('r_frame_rate') != '30/1' or black or silence:
        raise RuntimeError(f'技术质检失败：frames={video.get("nb_frames")}, black={black}, silence={silence}')
    write('技术质检.r2.json', {'status': 'passed', 'source': ref(FINAL), 'fullDecodeExit': 0, 'blackEvents': black, 'silenceEvents': silence, 'frames': 4669, 'durationSeconds': DURATION, 'fps': 30, 'width': 1920, 'height': 1080})
    print(json.dumps({'status': 'technical-passed-r2', 'blackEvents': len(black), 'silenceEvents': len(silence)}, ensure_ascii=False))

def frames():
    directory = QA / 'frames'
    directory.mkdir(exist_ok=True)
    times = [0, 7, 24, 47, 83, 107, 131.6, 141, 152]
    rows = []
    for at in times:
        output = directory / f'{round(at * 30):05d}.png'
        run(['ffmpeg', '-v', 'error', '-ss', str(at), '-i', str(FINAL), '-frames:v', '1', '-update', '1', '-y', str(output)])
        rows.append({**ref(output), 'atSeconds': at, 'frameIndex': round(at * 30), 'pixelSha256': hashlib.sha256(Image.open(output).convert('RGB').tobytes()).hexdigest()})
    final_ref = ref(FINAL)
    write('风险帧回执.r2.json', {
        'schema': 'release-risk-frame-receipt/v2',
        'evidenceScope': 'real-final-output',
        'sourceVideo': {**final_ref, 'fps': 30},
        'frames': [{**row, 'sourceVideoSha256': final_ref['sha256']} for row in rows],
    })
    sheet = Image.new('RGB', (1280, 5 * 390), (30, 30, 30))
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        x, y = (index % 2) * 640, (index // 2) * 390
        image = Image.open(ROOT / row['path'])
        image.thumbnail((640, 360))
        sheet.paste(image, (x, y + 30))
        draw.text((x + 12, y + 8), f'{row["atSeconds"]:.3f}s', fill='white')
    sheet.save(QA / '风险帧联系表.r2.jpg', quality=94)
    print(json.dumps({'status': 'frames-extracted-r2', 'count': len(rows)}, ensure_ascii=False))

if __name__ == '__main__':
    {'audio': audio_master, 'qa': qa, 'frames': frames}[sys.argv[1]]()
