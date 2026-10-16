"""仅以本期离线实录生成字幕候选；不读取拍前文稿，不处理音视频。"""
from pathlib import Path
import hashlib
import json
import re

OUT = Path(__file__).resolve().parent
RAW = OUT.parent / '实录转写/musk-grok-business-ai.mlx-whisper-large-v3-turbo.raw.v1.json'
data = json.loads(RAW.read_text())
hashfile = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

# 时间词槽保留来源索引。专名拼写和同音正字均是待听审候选，不能更正事实。
changes = {
    11: [(3, 7, 'SpaceX', '短窗F01识别SpaceX；原A71保留')],
    21: [(6, 7, '牌', '上排/上牌同音正字；上路说法本身未改')],
    29: [(4, 5, '图', '短窗F04识别出图；保留原句呢')],
    32: [(4, 5, 'Claude', '专名拼写候选'), (7, 9, 'Opus', '专名拼写候选'),
         (9, 12, '5.5', '短窗F04识别5.5；未修改调用断言')],
    33: [(0, 3, 'Grok', '专名拼写候选')],
    47: [(4, 7, '是万能', '短窗F05明确识别是万能')],
    54: [(3, 6, 'Grok', '专名拼写候选')],
    59: [(5, 7, '环节', '工作缓解/工作环节同音正字；未顺句')],
    62: [(9, 10, '岗', '业务港/业务岗同音正字')],
}
pending = {
    17: {'raw': '直接去水', 'otherASR': '直接起舍', 'candidate': '直接起势', 'apply': False},
    24: {'raw': 'Girls AM', 'otherASR': 'Groker AM', 'candidate': 'Grok AI', 'apply': False},
    35: {'raw': '调度状态', 'otherASR': '调度状态', 'candidate': '须分清实录是状态还是中台', 'apply': False},
    70: {'raw': '设了不少', 'otherASR': '是了不少', 'candidate': '试了不少', 'apply': False},
}

# 逐段译自以上实际ASR和已登记的识别候选。疑词段暂停英文，不借译文改正文。
english = [
    'Hi, bro.',
    'Musk has just revealed a car that can fly and is about to enter mass production.',
    'This is not a science fiction film.',
    'And it is not just a concept presentation.',
    'The car can flip in mid-air.',
    'It can stick to a wall.',
    'It really flies.',
    'Here is the key point.',
    'When it takes off,',
    'you do not need to press the brake.',
    'As for the core technology,',
    'it uses the SpaceX A71',
    'cold-gas propulsion system,',
    'plus its underbody',
    'negative-pressure suction fan.',
    'It takes off into the air,',
    'using jets for propulsion.',
    '',
    'Zero to 100 km/h in about 1.7 seconds.',
    'A range of 483 kilometres,',
    'and a top speed of 370 kilometres per hour.',
    'It can get a licence plate and drive on public roads.',
    'Beyond this car,',
    'what Musk has been doing lately that really deserves our attention',
    '',
    'The way this large AI model works has changed too.',
    'It no longer works alone,',
    'relying only on its own model.',
    'Instead, it lets us use leading models from different fields around the world at any time.',
    'For drawing and image generation,',
    'it directly calls MG.',
    'For repetitive, complex business tasks,',
    'you can directly call Claude Code\'s Opus 5.5.',
    'Grok',
    'is now acting as',
    '',
    'Different jobs go to the AI that is best at that job in the world,',
    'instead of expecting one large model to do everything.',
    'And this is exactly the biggest pitfall for most businesses',
    'when putting AI into practice.',
    'Many business owners',
    'keep asking around:',
    'Which large AI model is the strongest?',
    'They always want to buy an all-purpose AI',
    'and bring it back to solve every problem in the company.',
    'Musk has already shown us through his actions',
    'what the reality is:',
    'no single AI can do everything.',
    'Some models are good at making images.',
    'For in-depth coding,',
    'and complex reasoning, there are suitable models.',
    'Reading business documents calls for another set of tools.',
    'Real enterprise AI transformation',
    'is not buying a model advertised as the strongest.',
    'It is learning from this approach of Grok:',
    'call on capabilities as needed and match them to the business.',
    'Put different AI capabilities',
    'into the various departments of our company,',
    'and into each person\'s',
    'actual steps at work.',
    'It is not about showing off in short videos,',
    'or just watching a flying car for entertainment.',
    'Sales, operations, administration and business roles:',
    'give everyone AI suited to their work,',
    'to solve the real problems in front of them.',
    'Do not keep thinking AI is far from ordinary business owners',
    'or ordinary people like us.',
    'A flying car is a toy for the future.',
    'AI is a tool we can use now to reduce costs and improve efficiency.',
    'If your business is stuck trying to put AI into practice,',
    '',
    'but cannot fit them into real work,',
    'and you see others using AI',
    'but do not know where to start,',
    'leave your industry in the comments',
    'and tell me what is holding you back.',
    'Let us talk.',
    'I will help you break down the problem.',
    'I am Chao Ge,',
    'working on enterprise AI implementation in Lanzhou.',
]
assert len(english) == len(data['segments']) == 80
words, segments, corrections = [], [], []
source_word_index = 0
for seg in data['segments']:
    sid = seg['id']
    ws = seg['words']
    mapping = {a: (z, replacement, why) for a, z, replacement, why in changes.get(sid, [])}
    chosen = []
    i = 0
    while i < len(ws):
        z, replacement, why = mapping.get(i, (i + 1, ws[i]['word'], None))
        span = ws[i:z]
        w = {'text': replacement, 'raw_text': ''.join(v['word'] for v in span),
             'start': span[0]['start'], 'end': span[-1]['end'], 'segmentId': sid,
             'sourceWordIndices': list(range(source_word_index + i, source_word_index + z)),
             'type': 'word', 'speaker_id': 'speaker_0'}
        words.append(w)
        chosen.append(w)
        if why:
            corrections.append({**w, 'basis': why, 'status': 'asr-correction-candidate',
                                'humanListeningPerformed': False, 'userConfirmed': False})
        i = z
    source_word_index += len(ws)
    segments.append({'id': sid, 'start': seg['start'], 'end': seg['end'],
                     'text': ''.join(v['text'] for v in chosen), 'raw_text': seg['text']})

highlights = ['AI', '按需调用', '匹配业务', '真实', '万能', '模型', '兰州', '行业', '卡点']
captions = []
for s, en in zip(segments, english):
    captions.append({'id': f"C{s['id'] + 1:03d}", 'from': round(s['start'] * 30),
                     'to': round(s['end'] * 30), 'chinese': s['text'], 'english': en,
                     'highlights': [x for x in highlights if x in s['text']],
                     'sourceSegmentIds': [s['id']],
                     'reviewStatus': 'pending-listening' if s['id'] in pending else 'candidate-not-human-reviewed'})
assert all(x['to'] > x['from'] for x in captions)
assert all(a['to'] <= b['from'] for a, b in zip(captions, captions[1:]))
assert ''.join(c['chinese'] for c in captions) == ''.join(w['text'] for w in words)
assert [i for w in words for i in w['sourceWordIndices']] == list(range(source_word_index))

def save(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

save('实录正文候选.v1.json', {'canonicalSource': 'recorded-audio', 'rawSource': str(RAW),
     'rawSha256': hashfile(RAW), 'scriptRole': 'comparison-only', 'words': words,
     'segments': segments, 'text': ''.join(s['text'] for s in segments),
     'humanListeningPerformed': False, 'userConfirmed': False})
save('双语字幕候选.v1.json', {'captions': captions, 'fps': 30, 'durationInFrames': 5035,
     'translationSource': 'canonical-spoken-chinese-candidate', 'rawSha256': hashfile(RAW),
     'englishPendingSegmentIds': list(pending), 'userConfirmed': False, 'renderReady': False})
save('识别修正与待听词.v1.json', {'corrections': corrections,
     'pending': [{'segmentId': i, 'start': segments[i]['start'], 'end': segments[i]['end'], **v} for i, v in pending.items()],
     'noFactCorrectionsApplied': True, 'noSpokenWordsTrimmed': True,
     'sourceWordCoverage': f'{source_word_index}/{source_word_index}',
     'note': '原始ASR完整保留；这里只处理识别候选。两次同模型一致不等于人工听审。'})

def stamp(sec):
    n = round(sec * 1000)
    return f'{n//3600000:02d}:{n//60000%60:02d}:{n//1000%60:02d},{n%1000:03d}'

for lang, name in [('chinese', '实录中文字幕_待听审.srt'), ('english', '英文辅助字幕_4段待听审.srt')]:
    parts = []
    for c in captions:
        if not c[lang]:
            continue
        parts.append(f"{len(parts)+1}\n{stamp(c['from']/30)} --> {stamp(c['to']/30)}\n{c[lang]}\n")
    (OUT / name).write_text('\n'.join(parts))

save('字幕技术检查.v1.json', {'sourceSegments': 80, 'captionPages': len(captions),
     'rawWordCount': source_word_index, 'allSourceWordSpansRetained': True,
     'timingMonotonic': True, 'captionTextEqualsCandidateTranscript': True,
     'chineseEnglishSameFrameWindows': True, 'englishPagesReadyForReview': len(captions) - len(pending),
     'pendingListeningSegments': list(pending), 'finalHumanAcceptance': False,
     'scope': '仅同源和时间窗技术检查，不证明ASR听辨、事实、译文或视觉验收。'})
print(f'80页实录字幕候选，{len(captions) - len(pending)}页英文候选，{len(pending)}页疑词暂停英文；672个原始词槽均保留来源。')
