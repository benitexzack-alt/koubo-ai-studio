import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import json
from pathlib import Path
import mlx_whisper

out = Path(__file__).resolve().parent
model = '/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-small-mlx/snapshots/45f3915923c7a79a5a5b5a7d909d39aeb0e5630e'
entries = []
for id in ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'G01']:
    result = mlx_whisper.transcribe(str(out / f'{id}_原生音轨_试听.wav'), path_or_hf_repo=model, language=None, verbose=False, condition_on_previous_text=False, temperature=0.0)
    segments = [{k:s.get(k) for k in ['start','end','text','avg_logprob','no_speech_prob','compression_ratio']} for s in result.get('segments',[])]
    usable = [s for s in segments if (s.get('compression_ratio') or 99) <= 2.4 and (s.get('no_speech_prob') or 0) < 0.4 and (s.get('avg_logprob') or -99) > -1]
    entries.append({'id':id, 'languageDetected':result.get('language'), 'asrText':result.get('text'), 'segments':segments, 'usableSpeechCandidates':usable, 'interpretation':'ASR语音检出辅助；高重复字符不当成真实语音；不证明存在或不存在旁白/音乐，不冒充真人正常速度试听'})
    print(id, json.dumps(segments,ensure_ascii=False), flush=True)
with (out / '原生音离线语音检出辅助.r1.json').open('w') as f:
    json.dump({'schemaVersion':'native-audio-offline-asr-assistance/v1', 'model':model, 'externalUploaded':False, 'downloaded':False, 'humanListeningCompleted':False, 'musicDetectionCompleted':False, 'summary':'没有得到可用语音片段；部分片段被识别为高压缩率重复字符，不能以此判定有人声，也不能以空结果判定没有人声/音乐。', 'entries':entries}, f,ensure_ascii=False,indent=2)
