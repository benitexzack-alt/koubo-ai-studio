#!/usr/bin/env python3
"""本次一分钟音频：原底声逐样本截取，只增加按视觉事件对齐的音效。"""
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import subprocess
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
BASE = Path('edit/20261014_director_motion_upgrade')
CONTROL = BASE / 'control'
PUBLIC_AUDIO = BASE / 'public/motion-upgrade/audio'
JOB = CONTROL / 'preview-job.v1.json'
EVENTS = Path('remotion/src/enterprise-ai-motion-upgrade-20261014/visual-events.v1.json')
EXPECTED_EVENTS_SHA = '8d39e4a5f7c396dbea836e42069cfc34cb2a5eafcd08e3297fb76a99c6fc5f98'
HISTORICAL_BASE = Path('edit/20261011_enterprise_ai_organization/08_声音制作/audio/native-mix.v1.wav')
HISTORICAL_RECEIPT = Path('edit/20261011_enterprise_ai_organization/08_声音制作/mixreceipt.v1.json')
EXPECTED_BASE_SHA = '4aa67da79291defc4b640d9c6ad4870df1480254887afb8fa49fdaced21a1a54'
SOURCE_SHA = '6547a15055ec44a5765f054816e2f9555ce1524b4f8664dbbeb6bce1fa8712bb'
MANIFEST = Path('assets/sfx/koubo-sfx-v8/manifest.json')
RATE, FPS, START_FRAME, END_FRAME = 48000, 30, 1604, 3402
START_SAMPLE, SAMPLE_COUNT = 2566400, 2876800
FRAMES = END_FRAME - START_FRAME
PAPER_WINDOWS = [('P03', 514, 730), ('P04', 1371, 1596)]
ROLE_SOURCES = {
    'focus': ('v2-keyword-select', -17.0),
    'soft-arrival': ('v3-soft-card-pop-b', -20.0),
    'soft-lock': ('v1-confirm-soft', -19.0),
    'comparison': ('v1-keyword-tick', -17.5),
}


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def require(value, message):
    if not value:
        raise RuntimeError(message)


def read_json(path):
    return json.loads((ROOT / path).read_text())


def write_json_exclusive(path, value):
    with (ROOT / path).open('x') as handle:
        handle.write(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')


def context_preflight():
    # 调用现有任务上下文门；此处不建立新的授权、不跳过当前 job 的实际摘要核对。
    program = """
import fs from 'node:fs';
import {validateKnowledgeContextForProductionV2} from './tools/knowledge-context-production-gate.mjs';
const jobPath = process.argv[1];
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
console.log(JSON.stringify(validateKnowledgeContextForProductionV2({projectRoot:process.cwd(),jobPath,job,command:'audio-preflight'})));
"""
    result = subprocess.run(['node', '--input-type=module', '-e', program, str(ROOT / JOB)],
                            cwd=ROOT, text=True, capture_output=True, check=False)
    require(result.returncode == 0, 'audio-preflight 未通过：' + result.stderr + result.stdout)
    receipt = json.loads(result.stdout)
    require(receipt.get('validationStatus') == 'context-valid' and receipt.get('formalExecutionAllowed') is True,
            '上下文门未返回 context-valid')
    return receipt


def read_pcm16(path):
    with wave.open(str(ROOT / path), 'rb') as handle:
        require(handle.getframerate() == RATE and handle.getnchannels() == 2 and handle.getsampwidth() == 2,
                f'不允许对源音频重采样或转换声道：{path}')
        data = np.frombuffer(handle.readframes(handle.getnframes()), dtype='<i2').reshape(-1, 2).copy()
    return data


def write_pcm16_exclusive(path, samples):
    with (ROOT / path).open('xb') as raw:
        with wave.open(raw, 'wb') as handle:
            handle.setnchannels(2)
            handle.setsampwidth(2)
            handle.setframerate(RATE)
            handle.writeframes(samples.astype('<i2', copy=False).tobytes())


def float_wav_bytes(samples):
    # IEEE float WAV 保留加法结果；没有量化回 PCM16、限幅、归一化或侧链压低。
    data = samples.astype('<f4').tobytes()
    fmt = struct.pack('<HHIIHH', 3, 2, RATE, RATE * 8, 8, 32)
    chunks = b'fmt ' + struct.pack('<I', len(fmt)) + fmt
    chunks += b'fact' + struct.pack('<II', 4, len(samples))
    chunks += b'data' + struct.pack('<I', len(data)) + data
    return b'RIFF' + struct.pack('<I', len(chunks) + 4) + b'WAVE' + chunks


def decode_written(path):
    result = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(ROOT / path),
                             '-map', '0:a:0', '-c:a', 'pcm_f64le', '-f', 'f64le', '-'],
                            capture_output=True, check=True)
    return np.frombuffer(result.stdout, dtype='<f8').reshape(-1, 2)


def peak_db(samples):
    peak = float(np.max(np.abs(samples)))
    return 20 * math.log10(peak) if peak > 0 else None


def loudness(path):
    result = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-nostats', '-i', str(ROOT / path),
                             '-map', '0:a:0', '-af', 'loudnorm=I=-16.5:TP=-1:LRA=11:print_format=json',
                             '-f', 'null', '-'], capture_output=True, text=True, check=True)
    blocks = re.findall(r'\{[^{}]*"input_i"[^{}]*\}', result.stderr, re.S)
    require(len(blocks) == 1, '响度测量未得到唯一结果')
    measured = json.loads(blocks[0])
    return {'integratedLufs': float(measured['input_i']), 'truePeakDbtp': float(measured['input_tp']),
            'loudnessRangeLu': float(measured['input_lra']), 'measurementOnly': True,
            'method': 'ffmpeg loudnorm input measurements; output discarded'}


def main():
    gate = context_preflight()
    require(START_SAMPLE == START_FRAME * RATE // FPS and SAMPLE_COUNT == FRAMES * RATE // FPS,
            '固定帧窗与样本窗不一致')
    require(sha(EVENTS) == EXPECTED_EVENTS_SHA, '视觉事件修改后须先重新核对，不能沿用旧音点')
    require(sha(HISTORICAL_BASE) == EXPECTED_BASE_SHA, '历史底声摘要改变')
    previous = read_json(HISTORICAL_RECEIPT)
    require(previous['sourceSha256'] == SOURCE_SHA and any(
        Path(item['path']).resolve() == (ROOT / HISTORICAL_BASE).resolve() and item['sha256'] == EXPECTED_BASE_SHA
        for item in previous['outputs']), '历史底声未匹配原片声音制作回执')
    events = read_json(EVENTS)
    require(events['fps'] == FPS and events['sourceStartFrame'] == START_FRAME and
            events['durationInFrames'] == FRAMES, '事件表时间轴不匹配')
    active_events = [event for event in events['events'] if event['sfxRole']]
    require(len(active_events) == 9, '本次非空动作声事件应为九个，改变后须重新审阅')
    originals = read_pcm16(HISTORICAL_BASE)
    require(len(originals) >= START_SAMPLE + SAMPLE_COUNT, '历史底声不足以覆盖连续窗')
    sliced_pcm = originals[START_SAMPLE:START_SAMPLE + SAMPLE_COUNT].copy()
    base = sliced_pcm.astype('float64') / 32768.0
    added = np.zeros_like(base)
    active_mask = np.zeros(SAMPLE_COUNT, dtype=bool)
    manifest = read_json(MANIFEST)
    catalog = {item['id']: item for item in manifest['items']}
    cues, source_bindings = [], {}
    for event in active_events:
        source_id, target_peak_db = ROLE_SOURCES[event['sfxRole']]
        source = catalog[source_id]
        path = Path(source['output'])
        require(source['eligibleForSfx'] is True and source['contentKind'] == 'sound-effect' and
                sha(path) == source['outputSha256'], '本地音源未匹配已登记音效及摘要')
        require(source['license'] in ['CC0', 'Mixkit Free License'] and (ROOT / source['licenseReference']).is_file(),
                '本次仅使用已登记许可的现有音源')
        pcm = read_pcm16(path).astype('float64') / 32768.0
        peak_index = int(np.argmax(np.max(np.abs(pcm), axis=1)))
        peak = float(np.max(np.abs(pcm)))
        require(peak > 0, '不能使用无声源')
        gain = 10 ** (target_peak_db / 20) / peak
        target_sample = event['localFrame'] * RATE // FPS
        start_sample = target_sample - peak_index
        end_sample = start_sample + len(pcm)
        require(start_sample >= 0 and end_sample <= SAMPLE_COUNT, '完整音色及尾音不能越出样片窗口')
        require(not active_mask[start_sample:end_sample].any(), '当前九个音点不应互相重叠')
        require(all(not (start_sample < end * RATE // FPS and end_sample > start * RATE // FPS)
                    for _, start, end in PAPER_WINDOWS), '纸艺原窗必须给原生动作声留白')
        added[start_sample:end_sample] += pcm * gain
        active_mask[start_sample:end_sample] = True
        source_bindings[str(path)] = {'path': str(path), 'sha256': sha(path), 'license': source['license'],
                                      'licenseReference': source['licenseReference']}
        cues.append({'id': event['id'], 'motionId': event['id'], 'role': event['sfxRole'],
                     'description': event['description'], 'visualFrame': event['localFrame'],
                     'sourceFrame': event['sourceFrame'], 'source': str(path), 'sourceSha256': sha(path),
                     'licenseReference': source['licenseReference'], 'license': source['license'],
                     'sourcePeakSample': peak_index, 'startSample': start_sample, 'endSampleExclusive': end_sample,
                     'visualSample': target_sample, 'gain': gain, 'gainDb': 20 * math.log10(gain),
                     'targetPeakDbfs': target_peak_db, 'fullSourceTailPreserved': True,
                     'timingBasis': '独立源波形实际最大瞬态峰对齐视觉事件，不是固定延迟'})

    # 只求新增音层的最大安全增益，底声系数始终为 1；没有 limiter 或 normalize。
    ceiling = 10 ** (-1.2 / 20)
    require(float(np.max(np.abs(base))) <= ceiling, '原底声已超过本次安全阈值，禁止擅自压低原声')
    positive = added > 0
    negative = added < 0
    upper = min(1.0, float(np.min((ceiling - base[positive]) / added[positive])),
                float(np.min((-ceiling - base[negative]) / added[negative])))
    safety_gain = max(0.0, upper * (0.999 if upper < 1 else 1))
    require(safety_gain > 0.25, '若新增音效必须压得过低，则停止并重新选声')
    added *= safety_gain
    mixed = base + added
    require(np.isfinite(mixed).all() and float(np.max(np.abs(mixed))) <= ceiling, '浮点混音峰值越界')
    for cue in cues:
        cue['gain'] *= safety_gain
        cue['gainDb'] = 20 * math.log10(cue['gain'])
        segment = added[cue['startSample']:cue['endSampleExclusive']]
        actual_peak = cue['startSample'] + int(np.argmax(np.max(np.abs(segment), axis=1)))
        cue.update({'actualPremixPeakSample': actual_peak, 'actualPremixPeakFrame': actual_peak / (RATE / FPS),
                    'peakOffsetSamples': actual_peak - cue['visualSample'],
                    'actualPremixPeakWithinTwoFrames': abs(actual_peak - cue['visualSample']) <= RATE / FPS * 2,
                    'addedPeakDbfs': peak_db(segment)})
        require(cue['peakOffsetSamples'] == 0, '实际附加层峰值未逐样本落在视觉时钟')

    outputs = [PUBLIC_AUDIO / name for name in ['native.wav', 'with-sfx.wav', 'added-sfx.wav']]
    records = [CONTROL / 'audio-mix.v1.json', CONTROL / 'sfx-cues.v1.json']
    require(all(not (ROOT / item).exists() for item in outputs + records), '已有本次产物，禁止静默覆盖')
    (ROOT / PUBLIC_AUDIO).mkdir(parents=True, exist_ok=True)
    write_pcm16_exclusive(outputs[0], sliced_pcm)
    for path, samples in zip(outputs[1:], [mixed, added]):
        with (ROOT / path).open('xb') as handle:
            handle.write(float_wav_bytes(samples))
    decoded_base = read_pcm16(outputs[0])
    decoded_mixed = decode_written(outputs[1])
    decoded_added = decode_written(outputs[2])
    require(np.array_equal(decoded_base, sliced_pcm), '落盘底声样本与历史样本切片不相等')
    require(decoded_mixed.shape == base.shape == decoded_added.shape, '落盘混音采样长度改变')
    reconstruction_error = float(np.max(np.abs(decoded_mixed - decoded_added - base)))
    untouched_error = float(np.max(np.abs(decoded_mixed[~active_mask] - base[~active_mask])))
    require(reconstruction_error <= 1e-7 and untouched_error == 0, '原声路径或未叠音窗发生变化')
    paper_checks = []
    for clip_id, start, end in PAPER_WINDOWS:
        a, b = start * RATE // FPS, end * RATE // FPS
        maximum_added = float(np.max(np.abs(decoded_added[a:b])))
        unchanged = bool(np.array_equal(decoded_mixed[a:b], base[a:b]))
        require(maximum_added == 0 and unchanged, '纸艺原窗被新增音效或混音改动')
        paper_checks.append({'id': clip_id, 'startFrame': start, 'endFrameExclusive': end,
                             'addedMaxAmplitude': maximum_added, 'baseUnchanged': unchanged})
    measurements = [loudness(outputs[0]), loudness(outputs[1])]
    require(all(item['truePeakDbtp'] <= -1 for item in measurements), '实际真峰值未通过，保留文件供调查但不写通过回执')
    current_gate = context_preflight()
    require(current_gate['jobReceiptSha256'] == gate['jobReceiptSha256'] and sha(EVENTS) == EXPECTED_EVENTS_SHA,
            '执行期间job或视觉事件漂移')
    fingerprints = sorted({str(Path(__file__).relative_to(ROOT)), str(HISTORICAL_BASE), str(HISTORICAL_RECEIPT),
                           str(EVENTS), str(MANIFEST), *source_bindings.keys(),
                           *(item['licenseReference'] for item in source_bindings.values())})
    cue_sheet = {'schema': 'director-motion-minute-sfx/v1', 'fps': FPS, 'durationInFrames': FRAMES,
                 'visualEvents': {'path': str(EVENTS), 'sha256': EXPECTED_EVENTS_SHA}, 'sfx': cues,
                 'paper': [{'id': clip_id, 'startFrame': start, 'endFrameExclusive': end,
                            'sourceStartSeconds': 0, 'speed': 1, 'loop': False, 'retainOriginalNativeAudio': True}
                           for clip_id, start, end in PAPER_WINDOWS],
                 'silentEvents': [{'id': event['id'], 'visualFrame': event['localFrame'],
                                   'reason': event['silenceReason']} for event in events['events'] if not event['sfxRole']],
                 'userAudibilityConfirmed': False}
    receipt = {'schema': 'director-motion-minute-audio/v1', 'sourceSha256': SOURCE_SHA,
               'sourceStartFrame': START_FRAME, 'sourceEndFrame': END_FRAME, 'fps': FPS, 'durationInFrames': FRAMES,
               'sampleRate': RATE, 'channels': 2, 'startSample': START_SAMPLE, 'sampleCount': SAMPLE_COUNT,
               'historicalBase': {'path': str(HISTORICAL_BASE), 'sha256': EXPECTED_BASE_SHA},
               'historicalMixReceipt': {'path': str(HISTORICAL_RECEIPT), 'sha256': sha(HISTORICAL_RECEIPT)},
               'visualEvents': {'path': str(EVENTS), 'sha256': EXPECTED_EVENTS_SHA},
               'script': {'path': str(Path(__file__).relative_to(ROOT)), 'sha256': sha(Path(__file__).relative_to(ROOT))},
               'knowledgeContextGate': gate, 'knowledgeContextAfter': current_gate,
               'spokenContentChanged': False, 'originalVoiceSpeedChanged': False, 'voiceSidechainDucked': False,
               'baseAudioSampleSliceVerified': True, 'withSfxVoiceUnchanged': True,
               'sampleSliceByteExact': True, 'withSfxEncoding': 'IEEE_FLOAT_32',
               'floatReconstructionMaxAbsoluteError': reconstruction_error, 'floatTolerance': 1e-7,
               'unmodifiedWindowsMaxAbsoluteError': untouched_error,
               'unmodifiedSampleFrames': int(np.count_nonzero(~active_mask)),
               'baseCoefficient': 1, 'newSfxSafetyGain': safety_gain, 'normalizationApplied': False,
               'limiterApplied': False, 'resamplingApplied': False, 'allAddedSfxNonSilent': True,
               'actualPremixAllPeaksWithinTwoFrames': all(cue['actualPremixPeakWithinTwoFrames'] for cue in cues),
               'actualPremixAllPeaksSampleExact': all(cue['peakOffsetSamples'] == 0 for cue in cues),
               'paperChecks': paper_checks, 'sfxSources': list(source_bindings.values()),
               'samplePeaksDbfs': {'base': peak_db(base), 'withSfx': peak_db(decoded_mixed), 'added': peak_db(decoded_added)},
               'outputs': [{'path': str(path), 'sha256': sha(path), 'samples': SAMPLE_COUNT,
                            **({'loudness': measurements[i]} if i < 2 else {})} for i, path in enumerate(outputs)],
               'fingerprintPaths': fingerprints, 'userAudibilityConfirmed': False,
               'status': 'technical-checks-passed-human-listening-pending',
               'validationMeaning': '证明原底声样本与附加声数学路径，不证明正常音量试听效果或用户终验'}
    write_json_exclusive(records[1], cue_sheet)
    write_json_exclusive(records[0], receipt)
    print(json.dumps({'receipt': str(records[0]), 'cueSheet': str(records[1]), 'outputs': receipt['outputs'],
                      'sourceCount': len(source_bindings), 'cueCount': len(cues),
                      'floatError': reconstruction_error, 'paperChecks': paper_checks,
                      'fingerprintPaths': fingerprints}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
