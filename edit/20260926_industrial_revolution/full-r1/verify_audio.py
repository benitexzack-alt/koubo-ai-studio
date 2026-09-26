#!/usr/bin/env python3
"""全片只读技术检查；只写检查 JSON，不修改、修复或归一化任何媒体。"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
from datetime import datetime
from fractions import Fraction
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np

ROOT = Path(__file__).resolve().parent
ORIGINAL = Path('/Users/pc/Downloads/9月26日.mp3')
FINAL = ROOT / 'exports/工业革命_从蒸汽到智能_三分钟_R2.mp4'
ASSET = ROOT / 'public/music-full.wav'
REPORT = ROOT / 'verify/技术检查.json'
FPS = 30
FRAME_COUNT = 5412
DURATION = FRAME_COUNT / FPS
GAIN_DB = -3.0
FADE_OUT = 0.12
SAMPLE_RATE = 22050
MAX_DELAY = 0.005
MAX_DRIFT = 0.005
OPENING_BLACK_ALLOWANCE = 1.0
ENDING_BLACK_ALLOWANCE = 1.2
REVIEWED_DARK_WINDOW = (93.40, 93.65)
REVIEWED_DARK_EVIDENCE = (
    ('verify/异常回看-01.png', 2803, '76b8d041ad95f93e8de57c15e541f57e6bc009435291af7fd49d1a03bf888332'),
    ('verify/异常回看-02.png', 2804, 'ab959e25b5d6dea193249e4b93a842a9436d88be337493290977c53adf18d9c5'),
)
CUES = [(2330, 77.682358), (2809, 93.622857), (3383, 112.756100),
        (4403, 146.773333), (4803, 160.089977)]


def rounded(value: float | None, digits: int = 8) -> float | None:
    if value is None or not math.isfinite(float(value)):
        return None
    return round(float(value), digits)


def numeric(value) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def run(command: list[str]) -> subprocess.CompletedProcess:
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode:
        error = result.stderr.decode('utf-8', errors='replace')[-5000:]
        raise RuntimeError(f'命令执行失败（退出码 {result.returncode}）：{command[0]}\n{error}')
    return result


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(data)
    return digest.hexdigest()


def stamp(path: Path) -> tuple[int, int]:
    stat = path.stat()
    return stat.st_size, stat.st_mtime_ns


def probe(path: Path) -> dict:
    return json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams',
                           '-of', 'json', str(path)]).stdout)


def decode(path: Path, *, reference: bool = False, processed: bool = False) -> np.ndarray:
    filters = []
    if reference:
        filters += [f'atrim=start=0:end={DURATION}', 'asetpts=PTS-STARTPTS']
    if processed:
        filters += [f'volume={GAIN_DB}dB', f'afade=t=out:st={DURATION - FADE_OUT}:d={FADE_OUT}']
    command = ['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0', '-vn']
    if filters:
        command += ['-af', ','.join(filters)]
    command += ['-ac', '1', '-ar', str(SAMPLE_RATE), '-f', 'f32le', 'pipe:1']
    samples = np.frombuffer(run(command).stdout, dtype=np.float32).copy()
    if not len(samples) or not np.isfinite(samples).all():
        raise ValueError(f'没有可用的有限音频采样：{path}')
    return samples


def pair(actual: np.ndarray, expected: np.ndarray, lag: int,
         head: float = 0.25, tail: float = 0.35) -> tuple[np.ndarray, np.ndarray]:
    # 正 lag 代表实际声音晚；移除实际音频开头的 lag 个样本后进行比较。
    a = actual[max(lag, 0):]
    b = expected[max(-lag, 0):]
    count = min(len(a), len(b))
    left, right = round(head * SAMPLE_RATE), count - round(tail * SAMPLE_RATE)
    if right - left < 1024:
        raise ValueError('波形比较区间太短，无法作可靠相关分析。')
    return a[left:right].astype(np.float64), b[left:right].astype(np.float64)


def correlation(a: np.ndarray, b: np.ndarray) -> float:
    n = len(a)
    ab = float(np.dot(a, b)) - float(a.sum()) * float(b.sum()) / n
    aa = float(np.dot(a, a)) - float(a.sum()) ** 2 / n
    bb = float(np.dot(b, b)) - float(b.sum()) ** 2 / n
    if aa <= 1e-18 or bb <= 1e-18:
        raise ValueError('比较区间近似静音或常量，不能把相关系数记为通过。')
    return max(-1.0, min(1.0, ab / math.sqrt(aa * bb)))


def best_lag(actual: np.ndarray, expected: np.ndarray, max_seconds: float = 0.75) -> int:
    """NumPy FFT 互相关粗定位，再在完整采样率逐样本细化；不依赖 SciPy。"""
    stride = 4
    a = actual[::stride].astype(np.float64)
    b = expected[::stride].astype(np.float64)
    a -= a.mean()
    b -= b.mean()
    if float(np.dot(a, a)) < 1e-18 or float(np.dot(b, b)) < 1e-18:
        raise ValueError('近似静音不能估计最佳延迟。')
    fft_size = 1 << (len(a) + len(b) - 2).bit_length()
    cross = np.fft.irfft(np.fft.rfft(a, fft_size) * np.conj(np.fft.rfft(b, fft_size)), fft_size)
    radius = min(round(max_seconds * SAMPLE_RATE / stride), len(a) - 1, len(b) - 1)
    lags = np.arange(-radius, radius + 1)
    coarse = int(lags[np.argmax(cross[lags % fft_size])]) * stride
    candidates = []
    limit = round(max_seconds * SAMPLE_RATE)
    for lag in range(max(-limit, coarse - stride), min(limit, coarse + stride) + 1):
        left, right = pair(actual, expected, lag)
        candidates.append((correlation(left, right), lag))
    return max(candidates)[1]


def measure_pair(actual: np.ndarray, expected: np.ndarray) -> dict:
    a, b = pair(actual, expected, 0)
    fixed = correlation(a, b)
    lag = best_lag(actual, expected)
    a, b = pair(actual, expected, lag)
    corr = correlation(a, b)
    gain = float(np.dot(a, b) / np.dot(b, b))
    residual = a - b * gain
    return {
        'method': '单声道 22050Hz；固定零延迟比较及±0.75秒 FFT 搜索，原采样率细化；头0.25秒尾0.35秒不参与主相关',
        'sample_rate_hz': SAMPLE_RATE,
        'fixed_zero_lag_correlation': rounded(fixed),
        'best_lag_samples': lag,
        'best_lag_seconds': rounded(lag / SAMPLE_RATE),
        'best_aligned_correlation': rounded(corr),
        'gain_ratio_after_alignment': rounded(gain),
        'gain_db_after_alignment': rounded(20 * math.log10(abs(gain))) if gain else None,
        'gain_compensated_residual_rms_ratio': rounded(math.sqrt(float(np.dot(residual, residual) / np.dot(a, a)))),
        'compared_duration_s': rounded(len(a) / SAMPLE_RATE),
        'lag_sign': '正值表示实际解码声音较期望波形延后；另须加上音视频流 start_time 差才得到文件时间轴上的有效延迟',
    }


def local_windows(actual: np.ndarray, expected: np.ndarray, global_lag: int) -> dict:
    windows = []
    for start_seconds in (5, 35, 65, 95, 125, 155):
        start = round(start_seconds * SAMPLE_RATE)
        count = 12 * SAMPLE_RATE
        actual_start = start + global_lag
        a = actual[actual_start:actual_start + count]
        b = expected[start:start + count]
        if actual_start < 0 or min(len(a), len(b)) < count:
            windows.append({'start_s': start_seconds, 'status': '数据不足'})
            continue
        try:
            residual_lag = best_lag(a, b, max_seconds=0.10)
            left, right = pair(a, b, residual_lag)
            windows.append({'start_s': start_seconds, 'end_s': start_seconds + 12,
                            'status': '已测量', 'residual_lag_samples': residual_lag,
                            'absolute_decoded_lag_s': rounded((global_lag + residual_lag) / SAMPLE_RATE),
                            'aligned_correlation': rounded(correlation(left, right))})
        except ValueError as error:
            windows.append({'start_s': start_seconds, 'status': '不可测量', 'reason': str(error)})
    measured = [window for window in windows if window['status'] == '已测量']
    lags = [window['absolute_decoded_lag_s'] for window in measured]
    drift = max(lags) - min(lags) if len(lags) >= 2 else None
    slope = float(np.polyfit([w['start_s'] + 6 for w in measured], lags, 1)[0]) if len(lags) >= 2 else None
    return {'method': '六个分散12秒窗口，在全局延迟基础上各搜索±0.10秒；用于发现漂移，不等于全时段逐样本无变速证明',
            'windows': windows, 'all_six_windows_measured': len(measured) == 6,
            'lag_range_s': rounded(drift), 'linear_lag_slope_seconds_per_second': rounded(slope, 10)}


def loudness(path: Path) -> dict:
    process = run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-map', '0:a:0', '-vn',
                   '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
    candidates = re.findall(r'\{[^{}]*\}', process.stderr.decode('utf-8', errors='replace'))
    measurements = [json.loads(item) for item in candidates if 'input_i' in item]
    if not measurements:
        raise RuntimeError('没有取得 FFmpeg loudnorm 输入测量。')
    data = measurements[-1]
    return {'method': '读取 loudnorm 的 input 测量；处理结果输出到 null，不保存归一化媒体',
            'integrated_lufs': numeric(data.get('input_i')), 'true_peak_dbtp': numeric(data.get('input_tp')),
            'loudness_range_lu': numeric(data.get('input_lra')), 'gated_threshold_lufs': numeric(data.get('input_thresh')),
            'integrated_loudness_target_enforced': False,
            'note': '本片保留音乐的计划-3dB增益，不把-16LUFS当作额外成片归一化要求。'}


def dark_transition_review() -> dict:
    evidence = []
    for relative_path, frame, expected_sha in REVIEWED_DARK_EVIDENCE:
        path = ROOT / relative_path
        observed_sha = sha(path) if path.is_file() else None
        evidence.append({'path': str(path), 'source_frame': frame, 'source_time_s': rounded(frame / FPS),
                         'expected_sha256': expected_sha, 'observed_sha256': observed_sha,
                         'matches_reviewed_evidence': observed_sha == expected_sha})
    return {'review_id': 'microelectronics-designed-dark-transition-93_40-93_65',
            'window_start_s': REVIEWED_DARK_WINDOW[0], 'window_end_s': REVIEWED_DARK_WINDOW[1],
            'classification': '已回看设计暗转场', 'reviewer': '主代理局部回看记录；不是用户全片验收',
            'reason': '主代理实际回看R1第2803/2804帧，画面含“此后”年份及芯片收束为金色点，非空帧；该设计复用了用户认可试片的同一转场，R2延用该设计。',
            'scope': '只分类完整落在93.40–93.65秒内的近黑事件；不改变检测阈值，不删除原始事件，不豁免其他片中候选。',
            'evidence': evidence, 'evidence_files_verified': all(item['matches_reviewed_evidence'] for item in evidence),
            'current_candidate_pixels_independently_compared': False,
            'limitation': '这是已记录的局部画面回看及其复用设计分类，不是对当前候选全帧内容一致性的机器证明；R2仍待完整观看。'}


def classify_black(start: float, end: float, *, review_evidence_verified: bool = False) -> dict:
    allowed = (start >= 0 and end <= OPENING_BLACK_ALLOWANCE + 1e-6) or start >= DURATION - ENDING_BLACK_ALLOWANCE - 1e-6
    reviewed = review_evidence_verified and REVIEWED_DARK_WINDOW[0] <= start <= end <= REVIEWED_DARK_WINDOW[1]
    return {'start_s': rounded(start), 'end_s': rounded(end), 'duration_s': rounded(end - start),
            'inside_allowed_opening_or_ending': allowed,
            'reviewed_design_transition': reviewed, 'requires_review': not (allowed or reviewed),
            'interpretation': '允许的开头/结尾黑场区域' if allowed else '已回看设计暗转场' if reviewed else '片中近黑候选，须回看画面；不自动认定创作错误'}


def black_frames(path: Path) -> dict:
    process = run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-map', '0:v:0', '-an',
                   '-vf', 'blackdetect=d=0.032:pix_th=0.08:pic_th=0.985', '-f', 'null', '-'])
    log = process.stderr.decode('utf-8', errors='replace')
    matches = re.findall(r'black_start:([0-9.]+)\s+black_end:([0-9.]+)\s+black_duration:([0-9.]+)', log)
    review = dark_transition_review()
    events = [{**classify_black(float(start), float(end), review_evidence_verified=review['evidence_files_verified']),
               'ffmpeg_reported_duration_s': float(duration)} for start, end, duration in matches]
    return {'method': 'FFmpeg blackdetect，最短0.032秒、黑像素阈值0.08、黑像素比例0.985',
            'opening_allowance_s': OPENING_BLACK_ALLOWANCE, 'ending_allowance_s': ENDING_BLACK_ALLOWANCE,
            'raw_events': [{'black_start': start, 'black_end': end, 'black_duration': duration} for start, end, duration in matches],
            'events': events, 'raw_event_count': len(events), 'reviewed_design_transition': review,
            'reviewed_design_events': [event for event in events if event['reviewed_design_transition']],
            'unexpected_candidates': [event for event in events if event['requires_review']],
            'unexpected_candidates_definition': '原始事件中，不属于原允许开尾区域且未命中证据完整的窄范围设计回看记录的待复核候选；不是检测不到。',
            'limitation': '深色美术画面可能触发近黑候选；无候选不等于所有帧均视觉合格，也不检测停帧。'}


def cues(delay: float) -> list[dict]:
    results = []
    for frame, music_time in CUES:
        visual = frame / FPS
        actual_music_time = music_time + delay
        difference = visual - actual_music_time
        results.append({'declared_visual_frame': frame, 'visual_time_s': rounded(visual),
                        'declared_original_music_time_s': music_time,
                        'nominal_rounding_error_s': rounded(visual - music_time),
                        'music_time_after_measured_effective_delay_s': rounded(actual_music_time),
                        'visual_minus_audio_s': rounded(difference), 'visual_minus_audio_frames': rounded(difference * FPS),
                        'within_one_frame': abs(difference) <= 1 / FPS,
                        'scope': '只比较主代理声明的镜头帧与音乐事件时间；未识别实际画面切换或判断听感'})
    return results


def rms(values: np.ndarray) -> float:
    return float(np.sqrt(np.mean(values.astype(np.float64) ** 2))) if len(values) else 0.0


def tail_envelope(actual: np.ndarray, expected: np.ndarray) -> list[dict]:
    evidence = []
    for start, end in ((180.22, 180.28), (180.28, 180.32), (180.32, 180.36), (180.36, 180.40)):
        a = actual[round(start * SAMPLE_RATE):round(end * SAMPLE_RATE)]
        b = expected[round(start * SAMPLE_RATE):round(end * SAMPLE_RATE)]
        ra, rb = rms(a), rms(b)
        evidence.append({'start_s': start, 'end_s': end, 'actual_rms': rounded(ra), 'expected_rms': rounded(rb),
                         'actual_vs_expected_db': rounded(20 * math.log10(ra / rb)) if ra > 0 and rb > 1e-12 else None})
    return evidence


def write_report(path: Path, result: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def self_test() -> int:
    rng = np.random.default_rng(20260927)
    raw = rng.normal(size=SAMPLE_RATE * 5 + 48)
    source = np.convolve(raw, np.hanning(33), mode='valid')[:SAMPLE_RATE * 5].astype(np.float32)
    gain = 10 ** (GAIN_DB / 20)
    tests = []
    # 941样本约42.676毫秒，专门覆盖此前试片出现过的延迟量级。
    for lag in (0, 941, -941):
        actual = (np.pad(source, (max(lag, 0), max(-lag, 0)))[max(-lag, 0):][:len(source)] * gain)
        result = measure_pair(actual, source)
        passed = result['best_lag_samples'] == lag and abs(result['gain_db_after_alignment'] - GAIN_DB) < 0.001
        tests.append({'case': f'已知延迟{lag}样本与-3dB', 'passed': passed, 'measured_lag_samples': result['best_lag_samples']})
    rejected_silence = False
    try:
        measure_pair(np.zeros(SAMPLE_RATE * 2), np.zeros(SAMPLE_RATE * 2))
    except ValueError:
        rejected_silence = True
    tests += [{'case': '静音不伪造高相关', 'passed': rejected_silence},
              {'case': '开尾黑场与片中黑场区分', 'passed': classify_black(0, .5)['inside_allowed_opening_or_ending'] and
               classify_black(180.0, 180.4)['inside_allowed_opening_or_ending'] and not classify_black(70, 70.1)['inside_allowed_opening_or_ending']},
              {'case': '零延迟五个声明卡点均在一帧内', 'passed': all(point['within_one_frame'] for point in cues(0))}]
    tests += [
        {'case': '完整落在93.40–93.65秒且证据有效才分类为设计暗转场',
         'passed': all(classify_black(start, end, review_evidence_verified=True)['reviewed_design_transition']
                       for start, end in ((93.433, 93.633), REVIEWED_DARK_WINDOW))},
        {'case': '设计暗转场例外不能放行139.3秒孤立空帧',
         'passed': classify_black(139.3, 139.333333, review_evidence_verified=True)['requires_review']},
        {'case': '候选跨越限定窗左边界不能放行',
         'passed': classify_black(93.39, 93.64, review_evidence_verified=True)['requires_review']},
        {'case': '候选跨越限定窗右边界不能放行',
         'passed': classify_black(93.43, 93.66, review_evidence_verified=True)['requires_review']},
        {'case': '证据缺失或哈希变化时限定窗内也不能放行',
         'passed': classify_black(93.433, 93.633, review_evidence_verified=False)['requires_review']},
    ]
    passed = all(test['passed'] for test in tests)
    print(json.dumps({'self_test_passed': passed, 'tests': tests, 'media_checked': False,
                      'report_written': False, 'scope': '仅验证分析算法，不代表全片技术检查或听审通过'}, ensure_ascii=False, indent=2))
    return 0 if passed else 1


def inspect(args: argparse.Namespace) -> int:
    result = {'schema': 'industrial-history-full-technical-qa/v1',
              'measured_at': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
              'status': '未完成', 'human_listening_performed': False, 'human_full_playback_performed': False,
              'user_acceptance_recorded': False,
              'expected': {'width': 1920, 'height': 1080, 'fps': FPS, 'frame_count': FRAME_COUNT,
                           'duration_s': DURATION, 'original_music_start_s': 0, 'speed': 1,
                           'music_gain_db': GAIN_DB, 'fade_in_s': 0, 'fade_out_s': FADE_OUT,
                           'fixed_alignment_tolerance_s': MAX_DELAY, 'window_drift_tolerance_s': MAX_DRIFT,
                           'cue_tolerance_frames': 1, 'true_peak_ceiling_dbtp': -1.0},
              'limitations': ['技术通过不等于内容、视觉审美、人耳听感、音乐权利或用户验收通过。',
                             '波形相关使用单声道下混，不单独证明立体声声像与相位正确。',
                             '卡点表来自主代理输入，没有自动从像素中识别镜头真正切换的帧。',
                             '六个窗口只能对无明显变速提供抽样证据，不能代替全程播放。',
                             '淡出使用计划参数构造期望波形并记录尾部能量；未独立反演任意混音包络。',
                             '开头1秒、结尾1.2秒允许近黑；仅93.40–93.65秒完整事件可在两张证据图哈希一致时标记已回看设计暗转场；其他片中近黑仍待回看，所有原始事件保留。']}
    missing = [str(path) for path in (args.source, args.final) if not path.is_file()]
    if missing:
        result.update(status='待产物：未执行全片技术检查', missing_files=missing)
        write_report(args.report, result)
        print(json.dumps({'status': result['status'], 'missing_files': missing, 'report': str(args.report)}, ensure_ascii=False))
        return 2
    watched = [args.source, args.final] + ([args.asset] if args.asset and args.asset.is_file() else [])
    before = {str(path): stamp(path) for path in watched}
    try:
        source_probe, final_probe = probe(args.source), probe(args.final)
        audio_streams = [stream for stream in final_probe['streams'] if stream['codec_type'] == 'audio']
        video_streams = [stream for stream in final_probe['streams'] if stream['codec_type'] == 'video']
        if not audio_streams or not video_streams:
            raise ValueError('最终候选必须同时含视频流与音频流；无声视频不能通过本脚本。')
        audio, video = audio_streams[0], video_streams[0]
        source_all = decode(args.source)
        source = decode(args.source, reference=True)
        expected = decode(args.source, reference=True, processed=True)
        actual = decode(args.final)
        source_match, expected_match = measure_pair(actual, source), measure_pair(actual, expected)
        window_evidence = local_windows(actual, expected, expected_match['best_lag_samples'])
        audio_start, video_start = numeric(audio.get('start_time')), numeric(video.get('start_time'))
        stream_offset = audio_start - video_start if audio_start is not None and video_start is not None else None
        effective_delay = expected_match['best_lag_seconds'] + stream_offset if stream_offset is not None else None
        loud = loudness(args.final)
        black = black_frames(args.final)
        count = int(video['nb_frames']) if str(video.get('nb_frames', '')).isdigit() else None
        count_method = 'ffprobe nb_frames'
        if count is None:
            counted = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames',
                                      '-show_entries', 'stream=nb_read_frames', '-of', 'json', str(args.final)]).stdout)
            value = counted.get('streams', [{}])[0].get('nb_read_frames')
            count = int(value) if str(value).isdigit() else None
            count_method = 'ffprobe count_frames，实际解码计数'
        frame_rate = float(Fraction(video.get('avg_frame_rate', '0/1')))
        audio_duration, video_duration = numeric(audio.get('duration')), numeric(video.get('duration'))
        container_duration = numeric(final_probe.get('format', {}).get('duration'))
        points = cues(effective_delay) if effective_delay is not None else []
        reference_tail_rms = rms(expected[round((DURATION - FADE_OUT) * SAMPLE_RATE):round(DURATION * SAMPLE_RATE)])
        production = {'status': '未提供或文件不存在，制作WAV比对未检查', 'requested_path': str(args.asset) if args.asset else None}
        if args.asset and args.asset.is_file():
            asset = decode(args.asset)
            production = {'status': '已测量', 'path': str(args.asset), 'sha256': sha(args.asset), 'probe': probe(args.asset),
                          'final_vs_wav': measure_pair(actual, asset), 'wav_vs_original': measure_pair(asset, source),
                          'wav_vs_expected_master': measure_pair(asset, expected)}
        files = [{'role': role, 'path': str(path), 'sha256': sha(path), 'probe': metadata}
                 for role, path, metadata in [('原始音乐', args.source, source_probe), ('最终候选', args.final, final_probe)]]
        stable = all(stamp(path) == before[str(path)] for path in watched)
        checks = {
            'exactly_one_video_and_one_audio_stream': len(video_streams) == 1 and len(audio_streams) == 1,
            'resolution_1920x1080': video.get('width') == 1920 and video.get('height') == 1080,
            'frame_rate_30': abs(frame_rate - FPS) < 1e-9,
            'frame_count_5412': count == FRAME_COUNT,
            'video_duration_within_one_frame': video_duration is not None and abs(video_duration - DURATION) <= 1 / FPS,
            'audio_duration_within_one_frame': audio_duration is not None and abs(audio_duration - DURATION) <= 1 / FPS,
            'container_duration_within_one_frame': container_duration is not None and abs(container_duration - DURATION) <= 1 / FPS,
            'source_decoded_audio_covers_180_4s': len(source_all) / SAMPLE_RATE >= DURATION - 1 / SAMPLE_RATE,
            'audio_and_video_stream_starts_known': stream_offset is not None,
            'stream_start_offset_within_5ms': stream_offset is not None and abs(stream_offset) <= MAX_DELAY,
            'decoded_best_lag_within_5ms': abs(expected_match['best_lag_seconds']) <= MAX_DELAY,
            'effective_timeline_delay_within_5ms': effective_delay is not None and abs(effective_delay) <= MAX_DELAY,
            'zero_lag_correlation_at_least_0_98': expected_match['fixed_zero_lag_correlation'] >= .98,
            'best_lag_correlation_at_least_0_98': expected_match['best_aligned_correlation'] >= .98,
            'source_gain_within_0_25db_of_minus3': source_match['gain_db_after_alignment'] is not None and abs(source_match['gain_db_after_alignment'] - GAIN_DB) <= .25,
            'all_six_drift_windows_measured': window_evidence['all_six_windows_measured'],
            'window_lag_range_within_5ms': window_evidence['lag_range_s'] is not None and window_evidence['lag_range_s'] <= MAX_DRIFT,
            'each_drift_window_correlation_at_least_0_97': window_evidence['all_six_windows_measured'] and all(w.get('aligned_correlation', 0) >= .97 for w in window_evidence['windows']),
            'true_peak_at_most_minus1_dbtp': loud['true_peak_dbtp'] is not None and loud['true_peak_dbtp'] <= -1.0,
            'all_declared_cues_within_one_frame': len(points) == len(CUES) and all(point['within_one_frame'] for point in points),
            'no_unexpected_black_candidates': not black['unexpected_candidates'],
            'input_files_unchanged_during_check': stable,
        }
        if production['status'] == '已测量':
            checks['production_wav_matches_planned_master'] = production['wav_vs_expected_master']['fixed_zero_lag_correlation'] >= .999 and abs(production['wav_vs_expected_master']['gain_db_after_alignment']) <= .1
            checks['final_vs_wav_delay_within_5ms'] = abs(production['final_vs_wav']['best_lag_seconds']) <= MAX_DELAY
        failed = [name for name, passed in checks.items() if not passed]
        result.update(status='机器技术检查通过，待人工试听与完整观看' if not failed else '机器技术检查存在未通过项，须处理或人工复核',
                      files=files, observed={'container_duration_s': container_duration, 'video_duration_s': video_duration,
                      'audio_duration_s': audio_duration, 'frame_rate': frame_rate, 'frame_count': count,
                      'frame_count_method': count_method, 'video_codec': video.get('codec_name'), 'pixel_format': video.get('pix_fmt'),
                      'audio_codec': audio.get('codec_name'), 'audio_sample_rate_hz': audio.get('sample_rate'), 'audio_channels': audio.get('channels'),
                      'original_decoded_duration_s': rounded(len(source_all) / SAMPLE_RATE), 'final_decoded_duration_s': rounded(len(actual) / SAMPLE_RATE),
                      'audio_stream_start_time_s': audio_start, 'video_stream_start_time_s': video_start,
                      'audio_minus_video_stream_start_s': rounded(stream_offset), 'effective_timeline_delay_s': rounded(effective_delay)},
                      final_vs_original_0_180_4s=source_match, final_vs_expected_minus3db_faded_master=expected_match,
                      production_wav=production, sampled_drift=window_evidence, loudness=loud, black_frame_check=black,
                      tail_envelope_evidence=tail_envelope(actual, expected), declared_cue_alignment=points,
                      fade_verification={'independent_fade_curve_verified': False,
                      'reference_last_0_12s_rms': rounded(reference_tail_rms),
                      'note': '参考尾段近似静音，无法从零能量独立反演0.12秒淡出形状' if reference_tail_rms < 1e-10 else '与计划处理波形及末端分窗能量比较，未独立反演任意混音包络'},
                      technical_checks=checks, failed_checks=failed, unchecked_optional_items=[] if production['status'] == '已测量' else ['制作WAV比对'],
                      criteria_scope='阈值是本片诊断标准；最佳lag高相关不能替代固定对齐通过。近黑原始事件全部保留，no_unexpected_black_candidates只检查未复核候选，不表示没有检测到近黑；设计暗转场分类不等于用户完整观看验收。')
        write_report(args.report, result)
        print(json.dumps({'status': result['status'], 'report': str(args.report), 'failed_checks': failed,
                          'effective_timeline_delay_s': rounded(effective_delay), 'zero_lag_correlation': expected_match['fixed_zero_lag_correlation'],
                          'integrated_lufs': loud['integrated_lufs'], 'true_peak_dbtp': loud['true_peak_dbtp'],
                          'unexpected_black_candidates': black['unexpected_candidates'], 'human_listening_performed': False}, ensure_ascii=False, indent=2))
        return 0 if not failed else 1
    except Exception as error:
        result.update(status='检查执行失败，未取得完整技术结论', error_type=type(error).__name__, error=str(error))
        write_report(args.report, result)
        print(json.dumps({'status': result['status'], 'report': str(args.report), 'error': str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ORIGINAL)
    parser.add_argument('--final', type=Path, default=FINAL)
    parser.add_argument('--asset', type=Path, default=ASSET, help='制作WAV路径；缺失时明确记为未检查，不影响直接原曲比对')
    parser.add_argument('--report', type=Path, default=REPORT)
    parser.add_argument('--self-test', action='store_true', help='纯内存算法自检，不读取成片、不写技术检查报告')
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    for executable in ('ffmpeg', 'ffprobe'):
        if shutil.which(executable) is None:
            parser.error(f'未找到既有工具 {executable}；脚本不会自动安装。')
    args.source, args.final, args.report = args.source.resolve(), args.final.resolve(), args.report.resolve()
    args.asset = args.asset.resolve() if args.asset else None
    return inspect(args)


if __name__ == '__main__':
    raise SystemExit(main())
