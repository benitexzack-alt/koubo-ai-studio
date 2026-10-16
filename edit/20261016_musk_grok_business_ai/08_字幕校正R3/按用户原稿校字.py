#!/usr/bin/env python3
"""按本轮用户纠正校字，保留R2和原始识别，输出独立字幕修订稿。"""
from pathlib import Path
import copy
import datetime
import hashlib
import json
import shutil

HERE = Path(__file__).resolve().parent
EPISODE = HERE.parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
load = lambda p: json.loads(p.read_text())
def save(name, value):
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

runtime_path = EPISODE / '07_小样修改R2/runtime-plan.r2.json'
captions_path = EPISODE / '04_后期准备/字幕制作/双语字幕候选.v1.json'
spoken_path = EPISODE / '04_后期准备/字幕制作/实录正文候选.v1.json'
script_path = EPISODE / '00_控制/用户原稿_只读.txt'
baseline = {str(p): sha(p) for p in [runtime_path, captions_path, spoken_path, script_path]}
runtime = load(runtime_path)
captions = load(captions_path)
spoken = load(spoken_path)
old_runtime = copy.deepcopy(runtime)
old_spoken = copy.deepcopy(spoken)
image_path = Path('/Users/pc/Downloads/查看最近的照片.png')
image_copy = HERE / '用户截图_直接起势.png'
if not image_copy.exists():
    shutil.copyfile(image_path, image_copy)
assert sha(image_copy) == sha(image_path)
save('用户校字原话.v1.json', {
    'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'messages': ['直接起势', '我给你复制了我的整个文案，你按照那个文案去改吗？然后就是基本上那个文字都是没有问题的，你这个文字都不对， grok AI也不对。'],
    'attachment': {'path': str(image_copy), 'sha256': sha(image_copy)},
    'referenceScript': {'path': str(script_path), 'sha256': sha(script_path)},
    'scope': '本条按用户已给原稿校正识别错字和专名；不删除或重排实际口播。',
    'fullVideoAccepted': False,
})

# 6处词义/专名纠错，另2处指代字形和英文型号间距规范。
changes = {
    'C018': ('直接去水', '直接起势', 'and launches straight into motion.'),
    'C025': ('还有他的Girls AM', '还有他的Grok AI', 'is his Grok AI.'),
    'C027': ('他不再单打独斗', '它不再单打独斗', 'It no longer works alone,'),
    'C031': ('直接调用MG', '直接调用MJ', 'it directly calls MJ.'),
    'C032': ('遇到重复复杂的业务问题呢', '遇到重度复杂的业务问题呢', 'For demanding, complex business problems,'),
    'C033': ('直接可以调用Claude Code的Opus5.5', '直接可以调用Claude Code的Opus 5.5', "you can directly call Claude Code's Opus 5.5."),
    'C036': ('就是一个调度状态', '就是一个调度中台', 'an orchestration hub.'),
    'C071': ('设了不少的工具', '试了不少的工具', 'and you have tried quite a few tools,'),
}
ledger = []
for item in captions['captions']:
    if item['id'] not in changes:
        continue
    before, after, english = changes[item['id']]
    assert item['chinese'] == before
    ledger.append({'captionId': item['id'], 'from': item['from'], 'to': item['to'],
        'before': before, 'after': after, 'englishBefore': item['english'], 'englishAfter': english,
        'basis': '本轮用户明确要求依其完整原稿校字；直接起势、Grok AI另有当轮点名。',
        'normalizationOnly': item['id'] in ['C027', 'C033']})
    item.update(chinese=after, english=english, reviewStatus='user-directed-spelling-correction')
    seg = spoken['segments'][item['sourceSegmentIds'][0]]
    assert seg['text'] == before
    seg['text'] = after

for item in runtime['captions']:
    if item['id'] in changes:
        before, after, english = changes[item['id']]
        assert item['chinese'] == before
        item.update(chinese=after, english=english)

# 词槽保持原时间与原始sourceWordIndices；Grok合并此前Girl+s两槽。
word_updates = {113: '起', 114: '势', 175: ' AI', 188: '它', 230: 'J', 234: '度', 267: '中', 268: '台', 598: '试'}
words = []
for w in spoken['words']:
    indexes = w['sourceWordIndices']
    if indexes == [173]:
        follower = next(v for v in spoken['words'] if v['sourceWordIndices'] == [174])
        w.update(text='Grok', raw_text=w['raw_text'] + follower['raw_text'],
            end=follower['end'], sourceWordIndices=[173, 174])
    elif indexes == [174]:
        continue
    elif len(indexes) == 1 and indexes[0] in word_updates:
        w['text'] = word_updates[indexes[0]]
    elif indexes == [251, 252, 253]:
        assert w['text'] == '5.5'
        w['text'] = ' 5.5'
    words.append(w)
spoken['words'] = words
spoken['text'] = ''.join(s['text'] for s in spoken['segments'])
spoken['spellingAuthority'] = {'userReceipt': str(HERE / '用户校字原话.v1.json'),
    'referenceScript': str(script_path), 'scope': '用户指定校字，不冒称已重新逐句听审'}
captions['englishPendingSegmentIds'] = []
captions['translationSource'] = '本轮依用户原稿校字后的实录中文；保留实际口头用词、句序和时点。'
captions['translationReviewPending'] = True
captions['userConfirmed'] = False
captions['renderReady'] = False

for seg in spoken['segments']:
    assert ''.join(w['text'] for w in words if w['segmentId'] == seg['id']) == seg['text']
assert [i for w in old_spoken['words'] for i in w['sourceWordIndices']] == [i for w in words for i in w['sourceWordIndices']]
assert [(s['id'], s['start'], s['end'], s['raw_text']) for s in old_spoken['segments']] == [(s['id'], s['start'], s['end'], s['raw_text']) for s in spoken['segments']]
assert {k:v for k,v in old_runtime.items() if k != 'captions'} == {k:v for k,v in runtime.items() if k != 'captions'}
assert [(c['id'],c['from'],c['to'],c['highlights']) for c in old_runtime['captions']] == [(c['id'],c['from'],c['to'],c['highlights']) for c in runtime['captions']]
assert [c['id'] for a,c in zip(old_runtime['captions'],runtime['captions']) if a != c] == list(changes)
assert all(sha(Path(p)) == digest for p,digest in baseline.items())
assert len(runtime['captions']) == 80 and all(c['english'] for c in runtime['captions'])

save('runtime-plan.r3.json', runtime)
save('双语字幕修订.r3.json', captions)
save('实录正文校字.r3.json', spoken)
save('校字变更与检查.v1.json', {
    'sourceFilesUnchanged': baseline, 'changes': ledger,
    'captionCount': 80, 'englishCount': 80, 'originalWordIndexCoverage': 672,
    'captionTimesUnchanged': True, 'rawAsrUnchanged': True, 'allNonCaptionRuntimeFieldsUnchanged': True,
    'userDirectedCorrectionsApplied': True, 'fullNormalSpeedListeningPerformed': False,
    'fullVideoAccepted': False, 'rendered': False, 'factsVerified': False,
    'pass': True,
})
def stamp(frame):
    ms = round(frame * 1000 / runtime['fps'])
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
for filename, fields in [('中文字幕_修订R3.srt', ['chinese']), ('中英字幕_修订R3.srt', ['chinese','english'])]:
    rows = []
    for i,c in enumerate(runtime['captions'], 1):
        rows += [str(i), stamp(c['from']) + ' --> ' + stamp(c['to']), *[c[k] for k in fields], '']
    (HERE/filename).write_text('\n'.join(rows).rstrip() + '\n')
print('已核对80条字幕；6处词语纠错和2处字形/间距规范，80条英文齐全；原时点、媒体、音频、动效不变。尚未重导视频。')
