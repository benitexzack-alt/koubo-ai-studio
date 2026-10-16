from pathlib import Path
import copy
import datetime
import hashlib
import json

directory = Path(__file__).resolve().parent
root = directory.parents[3]
episode = directory.parents[1]
r2 = episode / '07_小样修改R2/入口准备'
r3 = episode / '08_字幕校正R3'
revision = 'musk-grok-business-ai-v9-full-candidate-r3-20261016'
now = datetime.datetime.now(datetime.timezone.utc)
task_id = now.strftime('task-%Y%m%dT%H%M%SZ-musk-grok-r3')
read = lambda path: json.loads(path.read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
ref = lambda path: {'path': str(path.relative_to(root)), 'sha256': sha(path)}

def write(name, body):
    file = directory / name
    with file.open('x') as stream:
        stream.write(json.dumps(body, ensure_ascii=False, indent=2) + '\n')
    return file

def verify(reference):
    file = root / reference['path']
    assert sha(file) == reference['sha256'], str(file)
    return file

assert not (directory / 'production-job.first-candidate.v1.json').exists()
runtime_file = r3 / 'runtime-plan.r3.json'
snapshot_file = root / 'remotion/src/musk-grok-business-ai-20261016/runtime-plan.snapshot.json'
assert sha(runtime_file) == '998b5c216d7654aa635e2a9938cf3eb28a2ee85868c289ceccd600186e53fc65'
assert runtime_file.read_bytes() == snapshot_file.read_bytes()
assert sha(root / 'remotion/src/musk-grok-business-ai-20261016/Composition.tsx') == 'b9837cd493ebdc88aae25609c3ed7389a9f61386e79a11052a8b5dd4f340194a'
runtime = read(runtime_file)
previous = read(episode / '07_小样修改R2/runtime-plan.r2.json')
assert {key: value for key, value in runtime.items() if key != 'captions'} == {key: value for key, value in previous.items() if key != 'captions'}
assert runtime['durationInFrames'] == 5035 and runtime['fps'] == 30
assert len(runtime['captions']) == 80 and all(a['from'] == b['from'] and a['to'] == b['to'] for a, b in zip(runtime['captions'], previous['captions']))
source_file = directory.parent / '本轮正片导出原话.v1.json'
source = read(source_file)
assert sha(source_file) == 'b17d7c34f28019f1685fc947075becaff945745a3db406f4c6d3b067bb549a68'
assert source['verbatimUserMessage'] == '好的，现在抓紧修正，修正完之后导出正片。'
user_instruction = verify(source['subtitleCorrectionSource'])
spoken_file = r3 / '实录正文校字.r3.json'
spoken = read(spoken_file)
change_file = r3 / '校字变更与检查.v1.json'
changes = read(change_file)
assert sha(change_file) == '1c922a08b42b583aee5f615ca6f9d4d93ccd6e67dfe4a8476e0eb08ed86a35c9'
base_correction_file = episode / '04_后期准备/字幕制作/识别修正与待听词.v1.json'
base_correction = read(base_correction_file)
guards = [ref(r2 / name) for name in ['production-job.first-candidate.v1.json', 'first-candidate-input.v1.json', '内部预览聊天授权.v1.json']]
output = directory.parent / '预览与质检/受控正片候选_R3_1080p_有音效.mp4'
assert not output.exists()

corrections = copy.deepcopy(base_correction['corrections'])
for change in changes['changes']:
    segment = next(item for item in spoken['segments'] if item['id'] == int(change['captionId'][1:]) - 1)
    corrections.append({'captionId': change['captionId'], 'segmentId': segment['id'],
        'raw_text': change['before'], 'text': change['after'], 'start': segment['start'], 'end': segment['end'],
        'basis': change['basis'], 'status': 'user-directed-spelling-correction', 'userDirected': True,
        'humanListeningPerformed': False, 'userConfirmed': False})
assert len(corrections) == 19
correction_file = write('本期用户校字重放回执.v1.json', {
    'schemaVersion': 'episode-user-directed-spelling-corrections/v1', 'revisionId': revision,
    'baseCorrectionReceipt': ref(base_correction_file), 'userInstruction': ref(user_instruction),
    'changeReport': ref(change_file), 'exportInstruction': ref(source_file),
    'corrections': corrections, 'noFactCorrectionsApplied': True, 'noSpokenWordsTrimmed': True,
    'userDirectedSpellingOnly': True, 'fullNormalSpeedListeningPerformed': False,
    'factsVerified': False, 'formalAuthorized': False, 'publishAuthorized': False,
    'note': '旧11条ASR候选原样保留；8条新增来自用户校字指令及真实差异，非逐句人工听审或事实更正。'})
scope = read(r2 / '用户小样范围.v1.json')
scope.update(revisionId=revision, quotedUserMessage=source['verbatimUserMessage'], sourceMessage=ref(source_file),
    recordedAt=now.isoformat(), authorizationKind='本轮真实正片导出指令，仅本期完整1080p有声候选供用户终看',
    supportingInstructions=[ref(user_instruction), ref(episode / '07_小样修改R2/本轮用户修改原话.v1.json'),
        ref(episode / '07_小样修改R2/本轮动效反馈原话.v1.json')])
scope['localRevisionScope'] = {'userDirectedSpellingCorrection': ref(correction_file), 'preserveAllOriginalSpeech': True,
    'preserveCaptionTiming': True, 'captionTextChangesLimitedToCurrentReceipt': True,
    'fixObservedCardConvergenceOverlap': True, 'outputWidth': 1920, 'outputHeight': 1080, 'fps': 30,
    'v10Upgrade': False, 'sharedStyleUpgrade': False}
scope_file = write('用户导出范围.v1.json', scope)
snapshot_receipt = write('Remotion内数据快照.r3.json', {'runtimeCanonical': ref(runtime_file),
    'snapshot': ref(snapshot_file), 'byteIdentical': True, 'componentFreeze': ref(directory.parent / '组件复核/组件冻结回执.v1.json')})
provenance = read(r2 / '来源到件现状.v1.json')
provenance.update(revisionId=revision, capturedAt=now.isoformat(), runtimePlan=ref(runtime_file), userScope=ref(scope_file),
    remotionDataSnapshot=ref(snapshot_receipt), exportInstruction=ref(source_file),
    spokenCorrection=ref(correction_file), revisedSpokenTimeline=ref(spoken_file))
provenance_file = write('来源到件现状.v1.json', provenance)
intake = read(r2 / '原生素材入库候选.v1.json')
intake.update(revisionId=revision, createdAt=now.isoformat(), runtimePlan=ref(runtime_file), spokenCorrectionReceipt=ref(correction_file))
for asset in intake['assets']:
    verify(asset['source']); verify(asset['renderAsset'])
    asset['sourceReceipt'] = ref(provenance_file)
for cue in intake['sfxCueBindings']:
    cue['sourceReceipt'] = ref(provenance_file)
intake_file = write('原生素材入库候选.v1.json', intake)
facts = read(r2 / '事实差异当前绑定.v1.json')
facts.update(revisionId=revision, capturedAt=now.isoformat(), userScope=ref(scope_file),
    subtitleSpellingRevision=ref(correction_file), factsResolved=False)
facts_file = write('事实差异当前绑定.v1.json', facts)
rebound = read(r2 / '实录导演重绑候选.r2.json')
rebound.update(revisionId=revision)
rebound['visualRevision'].update(sourceMessage=ref(source_file), runtimePlan=ref(runtime_file),
    userScope=ref(scope_file), spokenTextAndOrderUnchanged=False, originalAudioAndRawAsrUnchanged=True,
    userDirectedSpellingRevision=ref(correction_file))
rebound_file = write('实录导演重绑候选.r3.json', rebound)
contract = read(r2 / 'first-candidate-input.v1.json')
contract.update(revisionId=revision, executionGroupId='codex-musk-grok-v9-full-candidate-r3-20261016')
contract['artifacts'].update(runtimePlan=ref(runtime_file), spokenTimeline=ref(spoken_file),
    postshootRebind=ref(rebound_file), mediaIntake=ref(intake_file), factReview=ref(facts_file), userScope=ref(scope_file))
contract_file = write('first-candidate-input.v1.json', contract)
job = read(r2 / 'production-job.first-candidate.v1.json')
job['director']['artifacts'] = contract['artifacts']
job['productionGate'].update(revisionId=revision, firstCandidateInput=ref(contract_file), localChatPreviewAuthorization=None)
job['preview'].update(output=str(output.relative_to(root)), renderSettings={'concurrency': 1, 'timeoutInMilliseconds': 120000, 'scale': 1})
job['knowledgeContext'] = {'taskId': task_id, 'contextPath': task_id + '/context.json'}
job['preparationNote'] = '按本轮真实指令导出完整1080p有声候选正片供终看；R3用户校字逐项绑定，原声完整，非独立签名或已完成整片验收，正式验收/发布false。'
job_file = write('production-job.first-candidate.v1.json', job)
authorization = read(r2 / '内部预览聊天授权.v1.json')
authorization.update(revisionId=revision, executionGroupId=contract['executionGroupId'], recordedAt=now.isoformat(),
    sourceMessages=ref(source_file), supplementalSourceMessages=[ref(user_instruction)], binding=None)
write('内部预览聊天授权.draft.v1.json', authorization)
for item in guards: verify(item)
result = {'recordedAt': now.isoformat(), 'job': ref(job_file), 'input': ref(contract_file), 'runtime': ref(runtime_file),
    'knowledgeTaskId': task_id, 'originalR2FilesUnchanged': guards, 'sourceSpeechPreserved': True,
    'correctionCount': len(corrections), 'formalAuthorized': False, 'publishAuthorized': False, 'renderInvoked': False}
write('R3输入准备回执.v1.json', result)
print(json.dumps(result, ensure_ascii=False))
