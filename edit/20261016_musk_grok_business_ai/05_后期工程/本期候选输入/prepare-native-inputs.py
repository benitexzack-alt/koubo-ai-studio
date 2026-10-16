"""本期真实候选输入准备；仅写本目录，不渲染、不签发、不修改来源。"""
import datetime, hashlib, json, pathlib, subprocess, time

ROOT = pathlib.Path('/Users/pc/Documents/口播')
BASE = ROOT / 'edit/20261016_musk_grok_business_ai'
OUT = pathlib.Path(__file__).resolve().parent
PUB = BASE / '05_后期工程/public'
EPISODE = 'musk-grok-business-ai-20261016'
TASK = '20261016_musk_grok_business_ai_director_v2'
REVISION = 'musk-grok-business-ai-v9-preview-r1-20261016'
RUNTIME = BASE / '04_后期准备/runtime-plan.v1.json'
FROZEN_RUNTIME = 'f2b340cc14b08f635e30e5b993e18fd1bcb945e68b453b162388d7b68d9d2b78'

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(path): return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
def ref(path):
    p = pathlib.Path(path).resolve()
    return {'path': str(p.relative_to(ROOT)), 'sha256': sha(p)}
def read(path): return json.loads(pathlib.Path(path).read_text())
def write(name, value):
    p = OUT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    return p
def snapshot(path, name):
    p = OUT / '来源原件快照' / (name + '.json.txt')
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(path.read_bytes())
    assert sha(p) == sha(path)
    return {'sourceDocumentPath': str(path), 'capturedAt': now(), 'exactByteSnapshot': ref(p),
            'historicalNestedReferencesRevalidated': False,
            'note': '精确保存来源原件。原件中的旧运行计划或历史依赖哈希不冒充当前绑定；本期当前依赖另行逐文件核验。'}

assert sha(RUNTIME) == FROZEN_RUNTIME, '主线程冻结运行计划已改变，停止绑定'
runtime = read(RUNTIME)
scope_path = BASE / '04_后期准备/本期后期授权与范围.v1.json'
scope = read(scope_path)
paper_map = read(BASE / '04_后期准备/纸艺到件工程映射.v1.json')
screens = read(BASE / '02_核验与来源/官网截图清单.v1.json')['assets']
sound = read(BASE / '04_后期准备/声音准备/逐动作声材与瞬态候选.v1.json')
source = pathlib.Path(scope['canonicalSource'])
pending = read(BASE / '04_后期准备/字幕制作/识别修正与待听词.v1.json')
spoken_path = BASE / '04_后期准备/字幕制作/实录正文候选.v1.json'
spoken = read(spoken_path)
rebind_path = BASE / '04_后期准备/实录导演重绑候选.v1.json'
rebind = read(rebind_path)
fact_path = BASE / '04_后期准备/真实资料对位与事实待决.json'
facts = read(fact_path)

user_scope = write('用户小样范围.v1.json', {
    'schemaVersion': 'episode-native-v2-review-authorization/v1',
    'episodeId': EPISODE, 'taskId': TASK, 'revisionId': REVISION,
    'scope': {'reviewOnly': True, 'preserveAllOriginalSpeech': True,
              'useExistingPaperVideos': True, 'allowPendingReviewInCandidate': True,
              'formalAuthorized': False, 'publishAuthorized': False},
    'quotedUserMessage': scope['latestInternalPreviewAuthorization']['userQuote'],
    'sourceMessage': ref(scope_path), 'recordedAt': now(),
    'originalSpokenInstruction': scope['latestSpokenInstruction']['userMessage'],
    'authorizationKind': '真实用户范围记录，非独立签名或视听验收',
    'humanFullWatchConfirmed': False, 'dynamicAccepted': False, 'audioAccepted': False,
})
fact_review = write('事实差异当前绑定.v1.json', {
    'schemaVersion': 'episode-native-v2-fact-review-snapshot/v1',
    'episodeId': EPISODE, 'taskId': TASK, 'revisionId': REVISION,
    'capturedAt': now(), 'sourceRecord': snapshot(fact_path, '事实待决原记录'),
    'decisionItems': facts['decisionItems'],
    'sourceOrQualificationItems': facts.get('sourceOrQualificationItems', []),
    'userScope': ref(user_scope), 'factsResolved': False,
    'factCorrectionsAppliedToSpeech': False, 'formalAuthorized': False,
    'publishAuthorized': False,
    'scopeNote': '仅进入用户内部审阅小样。来源存在、用户装配许可、事实已核实三者独立；不把演示、纸艺或官网标志当作实际能力和法律资格证明。',
})
policy = write('实录来源策略候选.v1.json', {
    'schemaVersion': 'spoken-source-policy-candidate/v1',
    'episodeId': EPISODE, 'taskId': TASK, 'revisionId': REVISION,
    'source': ref(source), 'canonicalSource': 'recorded-audio',
    'scriptRole': 'comparison-only', 'spokenTimeline': ref(spoken_path),
    'rawAsr': ref(pathlib.Path(spoken['rawSource'])),
    'correctionRecord': ref(BASE / '04_后期准备/字幕制作/识别修正与待听词.v1.json'),
    'sourcePreservationReceipt': ref(BASE / '04_后期准备/媒体代理/原声保全检查.v1.json'),
    'preserveAllOriginalSpeech': True, 'trimOrReorderAuthorized': False,
    'pendingTerms': pending['pending'], 'pendingTermCount': len(pending['pending']),
    'humanListeningPerformed': False, 'subtitleUserConfirmed': False,
    'englishAuthority': '仅从实录中文候选翻译；四处未确认词暂留空，不从拍前稿恢复',
    'noFactCorrectionsApplied': True,
    'formalAccepted': False, 'publishAuthorized': False,
})

# 每个来源回执精确存档，保留其历史状态；当前媒体哈希单独测得。
receipt_inputs = {
 'recorded': BASE / '04_后期准备/实录转写/local-asr.receipt.v1.json',
 'proxy': BASE / '04_后期准备/媒体代理/proxy-command.v1.json',
 'voice': BASE / '04_后期准备/媒体代理/原声保全检查.v1.json',
 'screenshots': BASE / '02_核验与来源/官网截图清单.v1.json',
 'paper': BASE / '04_后期准备/纸艺到件核对/纸艺到件技术与视觉回执.v1.json',
 'paper-mapping': BASE / '04_后期准备/纸艺到件工程映射.v1.json',
 'sound': BASE / '04_后期准备/声音准备/逐动作声材与瞬态候选.v1.json',
 'technical': BASE / '04_后期准备/后期准备技术回执.v1.json',
 'tesla': BASE / '01_素材投放区/05_公开素材_Codex准备/剪辑候选/Tesla_完整翻转与落地_来源回执.json',
 'sfx-license': ROOT / 'assets/sfx/koubo-sfx-v1/manifest.json',
}
receipt_snapshots = {k: snapshot(p, k) for k, p in receipt_inputs.items()}
source_receipt = write('来源到件现状.v1.json', {
 'schemaVersion': 'episode-native-v2-source-provenance/v1',
 'episodeId': EPISODE, 'taskId': TASK, 'revisionId': REVISION,
 'capturedAt': now(), 'records': receipt_snapshots,
 'runtimePlan': ref(RUNTIME), 'userScope': ref(user_scope),
 'remotionDataSnapshot': ref(BASE / '04_后期准备/Remotion内数据快照.v1.json'),
 'rightsClearedForPublication': False, 'humanAccepted': False,
 'note': '本文件证明来源记录与当前装配范围，不冒充版权许可、动态观察、原速听审或最终成片验收。',
})

ffmpeg = pathlib.Path('/opt/homebrew/bin/ffmpeg').resolve()
ffprobe = pathlib.Path('/opt/homebrew/bin/ffprobe').resolve()
tool = {'path': str(ffmpeg), 'sha256': sha(ffmpeg)}
probe_tool = {'path': str(ffprobe), 'sha256': sha(ffprobe)}
assets = []
def add_asset(identifier, kind, original, render, media_type, extra=None):
    original, render = pathlib.Path(original), pathlib.Path(render)
    before = sha(render)
    media = {'type': media_type, 'fps': None, 'durationSeconds': None}
    decode_ref = None
    if media_type in ['video', 'audio']:
        probe_cmd = [str(ffprobe), '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(render)]
        pr = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
        body = json.loads(pr.stdout)
        media['durationSeconds'] = float(body['format']['duration'])
        video = next((s for s in body['streams'] if s['codec_type'] == 'video'), None)
        if video:
            a, b = video['avg_frame_rate'].split('/')
            media['fps'] = int(a) / int(b)
            media['width'], media['height'] = video['width'], video['height']
        cmd = [str(ffmpeg), '-nostdin', '-v', 'error', '-xerror', '-err_detect', 'explode', '-i', str(render), '-map', '0:v?', '-map', '0:a?', '-f', 'null', '-']
        t = time.monotonic()
        result = subprocess.run(cmd, capture_output=True, text=True)
        assert result.returncode == 0, (identifier, result.stderr)
        assert sha(render) == before, '核验中媒体发生改变'
        receipt = write('完整解码/' + identifier + '.decode.v1.json', {
            'source': ref(render), 'command': cmd, 'exitCode': result.returncode,
            'fullDecode': True, 'tool': tool, 'checkedAt': now(),
            'elapsedSeconds': round(time.monotonic()-t, 3),
            'stderr': result.stderr, 'probe': {'command': probe_cmd, 'tool': probe_tool, 'result': body},
            'humanListeningPerformed': False, 'dynamicAcceptancePerformed': False,
        })
        decode_ref = ref(receipt)
    asset = {'id': identifier, 'kind': kind, 'source': ref(original), 'renderAsset': ref(render),
             'sourceReceipt': ref(source_receipt), 'media': media, 'decodeReceipt': decode_ref,
             'reviewAccepted': False}
    if extra: asset.update(extra)
    assets.append(asset)
    print('已核验', identifier, media_type, flush=True)

add_asset('recorded-source', 'recorded-source', source, source, 'video')
add_asset('host', 'host', source, PUB / runtime['host']['src'], 'video')
add_asset('voice', 'voice', PUB / runtime['voice']['src'], PUB / runtime['voice']['src'], 'audio')
tesla_original = pathlib.Path(read(receipt_inputs['tesla'])['候选文件'])
for slot in runtime['mediaSlots']:
    render = PUB / slot['asset']['src']
    if slot['id'] == 'R01': original = tesla_original
    elif slot['id'] == 'P01': original = BASE / '01_素材投放区/04_纸艺视频/视频.mp4'
    elif slot['id'] == 'P02': original = BASE / '01_素材投放区/04_纸艺视频/视频_2.mp4'
    else:
        match = next(x for x in screens if x['sha256'] == sha(render))
        original = pathlib.Path(match['file'])
    assert sha(original) == sha(render), '素材复制与原件不一致'
    add_asset(slot['id'], slot['kind'], original, render, slot['asset']['type'], {'runtimeWindow': slot['window']})
    native = slot['asset'].get('nativeAudio')
    if native:
        add_asset(slot['id'] + '-native', 'native-audio', PUB / native['src'], PUB / native['src'], 'audio',
                  {'extractedFrom': ref(original), 'candidateGain': native['gain'], 'audioAccepted': False})
font_sources = {'displaySrc': ROOT / 'remotion/public/motion-upgrade-r2/fonts/smiley-sans.woff2',
                'captionSrc': ROOT / 'assets/fonts/STHeiti-Medium.ttc'}
for name, path in runtime['fonts'].items():
    assert sha(font_sources[name]) == sha(PUB / path)
    add_asset('font-' + name, 'font', font_sources[name], PUB / path, 'font')
for cue in runtime['sfx']:
    origin = next(x for x in sound['cues'] if x['id'] == cue['id'])['sourcePath']
    assert sha(origin) == sha(PUB / cue['src'])
    add_asset(cue['id'], 'sfx', origin, PUB / cue['src'], 'audio', {'candidateGain': cue['gain'], 'audioAccepted': False})

intake = write('原生素材入库候选.v1.json', {
    'schemaVersion': 'episode-native-v2-media-intake/v1',
    'episodeId': EPISODE, 'taskId': TASK, 'revisionId': REVISION,
    'source': ref(source), 'renderProxy': ref(PUB / runtime['host']['src']),
    'sourcePreservationReceipt': ref(BASE / '04_后期准备/媒体代理/原声保全检查.v1.json'),
    'spokenCorrectionReceipt': ref(BASE / '04_后期准备/字幕制作/识别修正与待听词.v1.json'),
    'assets': assets, 'runtimePlan': ref(RUNTIME), 'createdAt': now(),
    'humanFullWatchConfirmed': False, 'formalAuthorized': False, 'publishAuthorized': False,
})
segment_ids = [x['id'] for x in spoken['segments']]
rebound_ids = [i for beat in rebind['semanticBeats'] for i in beat['sourceSegmentIds']]
checks = {
 'allSegmentsCoveredExactlyOnceInSourceOrder': rebound_ids == segment_ids,
 'allRuntimeCaptionTextMatchesSpokenCandidate': [x['chinese'] for x in runtime['captions']] == [x['text'] for x in spoken['segments']],
 'originalVoiceFullWindow': runtime['voice']['trimBeforeFrame'] == 0 and runtime['voice']['trimAfterFrame'] == runtime['durationInFrames'] and runtime['voice']['playbackRate'] == 1 and runtime['voice']['gain'] == 1,
 'fourPendingTermsPreserved': len(pending['pending']) == 4 and all(x['apply'] is False for x in pending['pending']),
 'fourEnglishWindowsRemainEmpty': len([x for x in runtime['captions'] if not x['english']]) == 4,
 'sevenMediaSlotsReadyForAssemblyOnly': len(runtime['mediaSlots']) == 7 and all(x['state'] == 'ready' and x['reviewStatus'] == 'pending' for x in runtime['mediaSlots']),
 'currentRuntimeStillFrozen': sha(RUNTIME) == FROZEN_RUNTIME,
}
assert all(checks.values()), checks
validation = write('拍后绑定技术复核.v1.json', {
 'schemaVersion': 'episode-native-v2-postshoot-check/v1',
 'episodeId': EPISODE, 'taskId': TASK, 'revisionId': REVISION,
 'checkedAt': now(), 'reviewer': 'Codex 子代理 /root/sample_feasibility',
 'independentFromRuntimeImplementation': True, 'independentHumanAcceptance': False,
 'spokenTimeline': ref(spoken_path), 'postshootRebind': ref(rebind_path),
 'runtimePlan': ref(RUNTIME), 'spokenSourcePolicy': ref(policy), 'mediaIntake': ref(intake),
 'sourceSegmentCount': len(segment_ids), 'semanticBeatCount': len(rebind['semanticBeats']),
 'checks': checks, 'status': 'technical-input-checks-passed-review-pending',
 'listenedToAudio': False, 'watchedRenderedCandidate': False,
 'candidateAccepted': False, 'userPreviewApproved': False, 'fullWatchConfirmed': False,
 'formalAuthorized': False, 'publishAuthorized': False,
})
refs = {'directorCues': ref(BASE / '03_导演规划/director-cues.v2.json'),
        'runtimePlan': ref(RUNTIME), 'spokenTimeline': ref(spoken_path),
        'postshootRebind': ref(rebind_path), 'mediaIntake': ref(intake),
        'factReview': ref(fact_review), 'userScope': ref(user_scope)}
write('七项真实输入引用.v1.json', {
 'schemaVersion': 'episode-native-v2-input-reference-preparation/v1',
 'episodeId': EPISODE, 'taskId': TASK, 'revisionId': REVISION,
 'artifacts': refs, 'profile': ref(ROOT / 'workflow/active-director-profile.v1.json'),
 'style': ref(ROOT / 'workflow/style-library/paper-super-individual-20260829-v1.json'),
 'technicalCheck': ref(validation), 'status': 'real-inputs-prepared-not-production-authorization',
 'candidateAccepted': False, 'userPreviewApproved': False, 'fullWatchConfirmed': False,
 'formalAuthorized': False, 'publishAuthorized': False,
})
print(json.dumps({'assets': len(assets), 'decoded': sum(x['decodeReceipt'] is not None for x in assets), 'checks': checks}, ensure_ascii=False), flush=True)
