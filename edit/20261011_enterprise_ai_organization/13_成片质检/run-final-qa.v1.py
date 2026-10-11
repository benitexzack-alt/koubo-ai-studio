"""本期一次性只读媒体质检：不等待轮询，不改写成片，不冒充人工验收。"""
import argparse
import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
EPISODE = ROOT.parent
DEFAULT_SOURCE = EPISODE / '11_成片与发布包/企业全员AI改造_V8_R1_1080P_完整候选.mp4'
FFMPEG = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'
EXPECTED_FRAMES = 4385
EXPECTED_FPS = 30
EXPECTED_SECONDS = 146.145011
KEYFRAMES = [60, 315, 810, 1030, 1480, 1640, 2200, 2655, 3090, 3560, 3920, 4260]

def sha256(p):
    with p.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()

def write_json(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def parse_number(text):
    value = float(text)
    return value if math.isfinite(value) else str(value)

def main():
    parser = argparse.ArgumentParser(description='本期实际候选成片的只读技术质检')
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--run-id', default='final-v1', help='13目录内的唯一结果子目录名；禁止覆盖旧结果')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,60}', args.run_id):
        raise SystemExit('run-id只允许字母、数字、短横线、下划线')
    source = args.source.resolve()
    if not source.is_file() or source.stat().st_size == 0:
        raise SystemExit(f'成片尚未真实存在，未启动质检，不等待轮询：{source}')
    probe_command = [FFPROBE, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(source)]
    probe_run = subprocess.run(probe_command, capture_output=True, text=True)
    if probe_run.returncode != 0:
        raise SystemExit('成片尚不可解码或未写完，未启动质检：' + probe_run.stderr.strip())
    probe = json.loads(probe_run.stdout)
    videos = [s for s in probe.get('streams', []) if s.get('codec_type') == 'video']
    audios = [s for s in probe.get('streams', []) if s.get('codec_type') == 'audio']
    if len(videos) != 1 or not audios:
        raise SystemExit('必须有且只有一路主视频，且至少一路声音；未启动完整质检')
    result_dir = ROOT / args.run_id
    result_dir.mkdir(exist_ok=False)
    frames_dir = result_dir / '关键帧'
    frames_dir.mkdir()
    started = time.monotonic()
    started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    initial_stat = source.stat()
    source_hash = sha256(source)
    write_json(result_dir / 'ffprobe.json', probe)
    video, audio = videos[0], audios[0]
    numerator, denominator = map(int, video.get('avg_frame_rate', '0/1').split('/'))
    fps = numerator / denominator if denominator else 0
    duration = float(probe['format']['duration'])
    expected_video_seconds = EXPECTED_FRAMES / EXPECTED_FPS
    video_seconds = float(video.get('duration', 0))
    audio_seconds = float(audio.get('duration', 0))
    audio_start = float(audio.get('start_time', 0))
    video_tb_num, video_tb_den = map(int, video.get('time_base', '1/90000').split('/'))
    video_tick = video_tb_num / video_tb_den
    audio_sample_rate = int(audio.get('sample_rate', '48000'))
    # 全量解码，同时检测近黑画面、数字静音和EBU响度/真峰值。
    filter_graph = '[0:v:0]blackdetect=d=0.20:pix_th=0.10:pic_th=0.98[v];[0:a:0]silencedetect=noise=-50dB:d=0.30,ebur128=peak=true[a]'
    command = [FFMPEG, '-nostdin', '-hide_banner', '-xerror', '-nostats', '-progress', 'pipe:1',
               '-i', str(source), '-filter_complex', filter_graph,
               '-map', '[v]', '-map', '[a]', '-f', 'null', '-']
    print('开始整片解码、黑帧与静音检测、响度与真峰值测量。', flush=True)
    run = subprocess.run(command, capture_output=True, text=True)
    (result_dir / '全解码及音视频检测.log').write_text(run.stderr, encoding='utf-8')
    (result_dir / '解码进度.log').write_text(run.stdout, encoding='utf-8')
    progress = {}
    for line in run.stdout.splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            progress[key] = value
    decoded_frames = int(progress.get('frame', '0'))
    black = [{'start': float(a), 'end': float(b), 'duration': float(c)} for a, b, c in re.findall(
        r'black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)', run.stderr)]
    silence = []
    silence_start = None
    for line in run.stderr.splitlines():
        match = re.search(r'silence_start:\s*([-\d.]+)', line)
        if match:
            silence_start = float(match.group(1))
        match = re.search(r'silence_end:\s*([-\d.]+)\s*\|\s*silence_duration:\s*([-\d.]+)', line)
        if match:
            end, length = map(float, match.groups())
            silence.append({'start': silence_start if silence_start is not None else end-length,
                            'end': end, 'duration': length})
            silence_start = None
    if silence_start is not None:
        silence.append({'start': silence_start, 'end': duration, 'duration': duration-silence_start})
    for interval in black + silence:
        interval['location'] = 'boundary' if interval['start'] < 0.35 or interval['end'] > duration-0.35 else 'internal'
    loudness_matches = re.findall(r'Integrated loudness:\s*\n\s*I:\s*([-\d.inf]+)\s*LUFS', run.stderr)
    range_matches = re.findall(r'Loudness range:\s*\n\s*LRA:\s*([-\d.inf]+)\s*LU', run.stderr)
    peak_matches = re.findall(r'True peak:\s*\n\s*Peak:\s*([-\d.inf]+)\s*dBFS', run.stderr)
    loudness = parse_number(loudness_matches[-1]) if loudness_matches else None
    loudness_range = parse_number(range_matches[-1]) if range_matches else None
    peak = parse_number(peak_matches[-1]) if peak_matches else None
    hard_checks = {
        'fullDecodeSucceeded': run.returncode == 0 and progress.get('progress') == 'end',
        'decodedFramesMatch4385': decoded_frames == EXPECTED_FRAMES,
        'fpsIs30': abs(fps-EXPECTED_FPS) < 0.0001,
        'resolutionIs1920x1080': video.get('width') == 1920 and video.get('height') == 1080,
        'videoDurationMatches4385FrameTarget': abs(video_seconds-expected_video_seconds) <= video_tick,
        'videoRoundingWithinOneFrameOfOriginal': 0 <= video_seconds-EXPECTED_SECONDS <= 1/EXPECTED_FPS,
        'containerTailWithinTwoFramesOfVideo': 0 <= duration-video_seconds <= 2/EXPECTED_FPS,
        'audioTimeSpanCoversOriginalDuration': abs(audio_start) <= 1/audio_sample_rate and audio_seconds+audio_start >= EXPECTED_SECONDS,
        'hasAudioStream': bool(audios),
        'integratedLoudnessMeasured': isinstance(loudness, (int, float)),
        'truePeakMeasured': isinstance(peak, (int, float)),
    }
    warnings = []
    if any(i['location'] == 'internal' for i in black):
        warnings.append('检测到内部近黑区间；检测不等于意外黑帧，须结合关键帧复核。')
    if any(i['location'] == 'internal' for i in silence):
        warnings.append('检测到内部低于-50dB且不少于0.30秒的静音；可能为自然停顿，不自动等同音轨缺失。')
    if isinstance(peak, (int, float)) and peak > -1:
        warnings.append('真峰值高于-1dBTP的保守余量；需留意转码后削波风险。')
    if isinstance(loudness, (int, float)) and not -23 <= loudness <= -12:
        warnings.append('综合响度超出本次提醒区间-23至-12 LUFS；这不是平台官方标准，也不替代试听。')
    frame_records = []
    selection = '+'.join(f'eq(n\\,{frame})' for frame in KEYFRAMES)
    frame_command = [FFMPEG, '-nostdin', '-hide_banner', '-loglevel', 'error', '-n',
                     '-i', str(source), '-vf', f'select={selection},scale=960:540',
                     '-frames:v', str(len(KEYFRAMES)), '-fps_mode', 'vfr', '-an',
                     str(frames_dir / 'frame_%02d.png')]
    subprocess.run(frame_command, check=True)
    for index, frame in enumerate(KEYFRAMES, 1):
        frame_path = frames_dir / f'frame_{index:02}.png'
        frame_records.append({'index': index, 'frame': frame, 'seconds': frame/EXPECTED_FPS,
                              'path': str(frame_path), 'sha256': sha256(frame_path)})
        print(f'关键帧 {index}/12：第{frame}帧', flush=True)
    contact = result_dir / '十二关键帧联系表.png'
    contact_command = [FFMPEG, '-nostdin', '-hide_banner', '-loglevel', 'error', '-n',
                       '-framerate', '1', '-start_number', '1', '-i', str(frames_dir / 'frame_%02d.png'),
                       '-vf', 'scale=480:270,tile=4x3:nb_frames=12:padding=8:margin=8:color=0x111A24',
                       '-frames:v', '1', str(contact)]
    subprocess.run(contact_command, check=True)
    final_stat = source.stat()
    final_hash = sha256(source)
    hard_checks['sourceUnchangedDuringQa'] = source_hash == final_hash and initial_stat.st_size == final_stat.st_size and initial_stat.st_mtime_ns == final_stat.st_mtime_ns
    status = 'technical-checks-passed-human-review-pending' if all(hard_checks.values()) else 'technical-checks-failed'
    report = {'schemaVersion': 'enterprise-ai-final-media-qa/v1', 'status': status,
              'startedAt': started_at, 'endedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'elapsedSeconds': round(time.monotonic()-started, 3),
              'source': {'path': str(source), 'sha256Before': source_hash, 'sha256After': final_hash,
                         'bytes': initial_stat.st_size, 'durationSeconds': duration},
              'expected': {'frames': EXPECTED_FRAMES, 'fps': EXPECTED_FPS, 'width':1920, 'height':1080, 'originalDurationSeconds':EXPECTED_SECONDS},
              'observed': {'decodedFrames': decoded_frames, 'fps': fps, 'videoCodec': video.get('codec_name'),
                           'audioCodec': audio.get('codec_name'), 'audioChannels':audio.get('channels'), 'audioSampleRate':audio.get('sample_rate'),
                           'integratedLufs':loudness, 'loudnessRangeLu':loudness_range, 'truePeakDbtp':peak},
              'durationAssessment': {'expectedVideoSecondsFromFrames':expected_video_seconds,
                                     'videoStreamSeconds':video_seconds,'videoTimeBase':video.get('time_base'),
                                     'audioStreamSeconds':audio_seconds,'audioStartSeconds':audio_start,
                                     'audioDurationTs':audio.get('duration_ts'),'audioTimeBase':audio.get('time_base'),
                                     'audioPacketCount':audio.get('nb_frames'),
                                     'containerMinusVideoSeconds':duration-video_seconds,
                                     'videoMinusOriginalSeconds':video_seconds-EXPECTED_SECONDS,
                                     'voiceNoInternalCutsProvenByDuration':False,
                                     'methodCorrection':'final-v1把MP4容器时长与原片时长直接作两帧比较，混淆原片到4385帧的取整与AAC包尾部。现在分别检查视频目标、原片帧取整、音轨覆盖和容器尾差；不修改原MP4，也不把时长相同当作原声未剪切的充分证据。'},
              'hardChecks': hard_checks, 'blackIntervals':black, 'silenceIntervals':silence,
              'warnings':warnings, 'keyframes':frame_records,
              'contactSheet': {'path':str(contact), 'sha256':sha256(contact), 'order':'从左到右、从上到下，对应关键帧索引1—12；未把抽帧代替全片观看'},
              'commands':{'probe':probe_command,'fullDecode':command,'extractKeyframes':frame_command,'contactSheet':contact_command},
              'humanListeningPerformed':False, 'humanFullVideoReview':False, 'finalHumanAcceptance':False,
              'visualQualityApproved':False, 'subtitleRecognitionApproved':False,
              'note':'机器技术检测不证明导演选择、字幕疑词、音效听感或画面审美已通过。原片语义与素材授权另见本期记录。'}
    write_json(result_dir / '完整成片技术质检.v1.json', report)
    lines = ['# 本期完整成片技术质检', '', f'状态：{status}', '',
             f'视频：{source}', f'时长：{duration:.6f} 秒；解码帧数：{decoded_frames}；帧率：{fps:g}。',
             f'视频流：{video_seconds:.6f} 秒；4385帧目标：{expected_video_seconds:.6f} 秒；音轨：{audio_seconds:.6f} 秒；容器比视频流多 {duration-video_seconds:.6f} 秒。',
             f'综合响度：{loudness} LUFS；响度范围：{loudness_range} LU；真峰值：{peak} dBTP。', '',
             '## 必检结果', '']
    lines.extend(f'- {name}：{value}' for name, value in hard_checks.items())
    lines += ['', '## 自动检测提醒', ''] + (['- '+w for w in warnings] or ['- 未触发上述自动提醒；不等于人工验收完成。'])
    lines += ['', '## 联系表索引', '', '|序号|原片帧|时间|', '|---|---:|---:|']
    lines.extend(f"|{r['index']}|{r['frame']}|{r['seconds']:.3f} 秒|" for r in frame_records)
    lines += ['', '本轮修正了final-v1将容器时长直接对原片时长比较的测试口径：视频帧目标、原片整帧取整、音轨覆盖范围与AAC容器尾差分别判断。原声没有内部删剪不能仅凭时长证明，需结合本期混音来源回执。', '', '未进行人耳听辨、全片人工观看或字幕事实确认。检测报告不得被写成“成片已通过用户验收”。', '']
    (result_dir / '完整成片技术质检.v1.md').write_text('\n'.join(lines), encoding='utf-8')
    print(json.dumps({'status':status,'report':str(result_dir/'完整成片技术质检.v1.json'),'contactSheet':str(contact),'warnings':len(warnings)},ensure_ascii=False),flush=True)
    return 0 if all(hard_checks.values()) else 2

if __name__ == '__main__':
    sys.exit(main())
