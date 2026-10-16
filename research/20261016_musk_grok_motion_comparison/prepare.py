"""复用 20261011 研究准备器；仅准备本期同窗输入与现有版对照。"""
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
OLD = ROOT.parent / '20261011_adu_motion_video'
UPSTREAM = ROOT / 'upstream'
EPISODE = PROJECT / 'edit/20261016_musk_grok_business_ai'
PUBLIC = EPISODE / '05_后期工程/public'
FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
FFPROBE = '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe'
START, END, FPS = 2887, 3694, 30
FILES = {
    'original': EPISODE / '01_素材投放区/01_口播原片/copy_7BB13FE6-D6AA-467C-9A11-D944F0BD6F88.MOV',
    'proxy': PUBLIC / 'media/host.mp4',
    'voice': PUBLIC / 'audio/voice.m4a',
    'baseline': EPISODE / '10_正片交付_R3/飞车与企业AI_V9正片_R3_1080p_有音效.mp4',
    'runtime': EPISODE / '08_字幕校正R3/runtime-plan.r3.json',
    'transcript': EPISODE / '04_后期准备/实录转写/musk-grok-business-ai.mlx-whisper-large-v3-turbo.raw.v1.words.json',
    'sourcePreservationReceipt': EPISODE / '04_后期准备/媒体代理/原声保全检查.v1.json',
    'cameraImplementation': PROJECT / 'remotion/src/musk-grok-business-ai-20261016/runtime.ts',
    'font': PUBLIC / 'fonts/smiley-sans.woff2',
}

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(2**20), b''):
            digest.update(block)
    return digest.hexdigest()

def ref(path):
    return {'path': str(path), 'sha256': sha(path), 'bytes': Path(path).stat().st_size}

def save(manifest):
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

def run(args, manifest):
    started = now()
    tick = time.monotonic()
    result = subprocess.run(args, capture_output=True, text=True)
    manifest['commands'].append({'argv': args, 'startedAt': started,
        'elapsedSeconds': round(time.monotonic() - tick, 3), 'exitCode': result.returncode,
        'stdout': result.stdout, 'stderr': result.stderr})
    save(manifest)
    if result.returncode:
        raise RuntimeError(f'命令失败：{args[0]}，退出 {result.returncode}，{result.stderr[-2000:]}')
    return result.stdout

def main():
    if (ROOT / 'manifest.json').exists():
        raise SystemExit('本期准备回执已存在，禁止隐式覆盖或重跑。')
    for directory in ['web', 'web/fonts', 'media', 'outputs', 'qa']:
        (ROOT / directory).mkdir(parents=True, exist_ok=True)
    if UPSTREAM.exists() or UPSTREAM.is_symlink():
        if not UPSTREAM.is_symlink() or UPSTREAM.resolve() != (OLD / 'upstream').resolve():
            raise SystemExit('上游链接不是旧冻结包，停止。')
    else:
        UPSTREAM.symlink_to('../20261011_adu_motion_video/upstream', target_is_directory=True)
    plan = json.loads(FILES['runtime'].read_text())
    transcript = json.loads(FILES['transcript'].read_text())
    old_manifest = json.loads((OLD / 'manifest.json').read_text())
    assert plan['fps'] == FPS and plan['width'] == 1920 and plan['height'] == 1080
    assert not any(s.get('window') and s['window']['to'] > START and s['window']['from'] < END
                   for s in plan['mediaSlots']), '本窗不能含资料/纸艺插片，避免改变比较变量。'
    start, end = START / FPS, END / FPS
    words = [dict(w, sourceWordIndex=i) for i, w in enumerate(transcript['words'])
             if w['start'] >= start and w['end'] <= end]
    boundary_words = [dict(w, sourceWordIndex=i) for i, w in enumerate(transcript['words'])
                      if w['end'] > start and w['start'] < end and (w['start'] < start or w['end'] > end)]
    data = {'startFrame': START, 'endFrameExclusive': END, 'fps': FPS,
        'durationFrames': END - START,
        'captions': [c for c in plan['captions'] if c['to'] > START and c['from'] < END],
        'cameraWindows': [c for c in plan['cameraWindows'] if c['to'] > START and c['from'] < END],
        'events': [e for e in plan['events'] if START <= e['frame'] < END],
        'words': words, 'boundaryWords': boundary_words,
        'wordTimingStatus': '既有本地ASR候选，未作本轮独立听审；R3字幕像素为正文显示来源。',
        'subtitleCrop': {'x': 0, 'y': 886, 'width': 1920, 'height': 194},
        'cameraTransformOrigin': '62% 44%',
        'cameraPolicy': '逐帧复用本期runtime.ts cameraScale；不使用旧研究cameras算法。'}
    for p in [ROOT/'web/data.js', ROOT/'web/upstream-helpers.js', ROOT/'web/upstream-motion.js',
              ROOT/'MIT上游许可.txt', ROOT/'web/fonts/motion.woff2']:
        if p.exists() or p.is_symlink():
            raise SystemExit(f'禁止覆盖已存在的准备产物：{p}')
    source_code = []
    for item in old_manifest['sourceCode']:
        p = ROOT / item['path']
        if sha(p) != item['sha256']:
            raise SystemExit(f'旧冻结上游源码已变化：{p}')
        source_code.append({'path': item['path'], 'sha256': sha(p)})
    (ROOT/'web/data.js').write_text('window.SAMPLE_DATA = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')
    lib = UPSTREAM/'packs/continuous-performance/1.0.0/lib.js'
    helpers = lib.read_text().split('/* entrance/exit presets */')[0]
    (ROOT/'web/upstream-helpers.js').write_text('// 来源 adunext/adu-motion-video；MIT许可见本目录。\n' + helpers)
    shutil.copy2(UPSTREAM/'packs/continuous-performance/1.0.0/motion.js', ROOT/'web/upstream-motion.js')
    shutil.copy2(UPSTREAM/'LICENSE', ROOT/'MIT上游许可.txt')
    (ROOT/'web/fonts/motion.woff2').symlink_to(FILES['font'])
    manifest = {'schemaVersion': 'episode-motion-comparison-research/v1', 'createdAt': now(),
        'status': '本期同窗输入准备中', 'stage': 'edit-release：本期隔离动效小样，用户已直接授权',
        'studyId': '20261016_musk_grok_motion_comparison', 'productionJob': False,
        'upstream': {k: old_manifest['upstream'][k] for k in ['url', 'commit', 'version', 'installedGlobally']},
        'inputs': {k: ref(p) for k, p in FILES.items()}, 'frameWindow': data, 'sourceCode': source_code,
        'boundaries': {'formalProduction': False, 'publishAuthorized': False, 'baselineModified': False,
            'rawModified': False, 'captionTextModified': False, 'addedSfx': False, 'newBgm': False,
            'uploaded': False, 'fullMacroReplay': False, 'humanAccepted': False, 'fullWatchConfirmed': False},
        'experiment': '四版同原片整帧窗、同一原声片段、R3成片字幕像素；只比较局部动效。本脚本只生成现有版对照。',
        'cutBoundary': 'START/END由主线程指定；跨整帧窗的ASR候选另列boundaryWords，不额外延长、不变速、不声称人工确认逐词切点。',
        'server': {'host': '127.0.0.1', 'port': 5196, 'started': False}, 'commands': []}
    save(manifest)
    try:
        run([FFMPEG, '-nostdin', '-n', '-v', 'error', '-i', str(FILES['voice']), '-af',
             f'atrim=start={start:.12f}:end={end:.12f},asetpts=PTS-STARTPTS', '-ar', '48000',
             '-c:a', 'pcm_s16le', str(ROOT/'media/voice.wav')], manifest)
        output = ROOT/'outputs/00_现有动效_同原声对照.mp4'
        run([FFMPEG, '-nostdin', '-n', '-v', 'error', '-ss', f'{start:.12f}', '-i', str(FILES['baseline']),
             '-i', str(ROOT/'media/voice.wav'), '-map', '0:v:0', '-map', '1:a:0', '-frames:v', str(END-START),
             '-t', f'{(END-START)/FPS:.12f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
             '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-b:a', '192k', '-movflags', '+faststart', str(output)], manifest)
        metadata = json.loads(run([FFPROBE, '-v', 'error', '-count_frames', '-show_streams', '-show_format',
                                   '-of', 'json', str(output)], manifest))
        video = next(s for s in metadata['streams'] if s['codec_type'] == 'video')
        audio = next(s for s in metadata['streams'] if s['codec_type'] == 'audio')
        assert int(video['nb_read_frames']) == END-START and video['r_frame_rate'] == '30/1'
        assert (video['width'], video['height']) == (1920, 1080)
        assert abs(float(video['duration']) - (END-START)/FPS) < .001
        run([FFMPEG, '-nostdin', '-v', 'error', '-i', str(output), '-f', 'null', '-'], manifest)
        pcm = run([FFMPEG, '-nostdin', '-v', 'error', '-i', str(output), '-map', '0:a:0',
                   '-t', f'{(END-START)/FPS:.12f}', '-c:a', 'pcm_s16le', '-f', 'hash', '-hash', 'sha256', '-'], manifest).strip()
        manifest['preparedMedia'] = {'voice': ref(ROOT/'media/voice.wav'), 'baseline': {
            **ref(output), 'frames': int(video['nb_read_frames']), 'fps': video['r_frame_rate'],
            'durationSeconds': float(video['duration']), 'audioStart': audio.get('start_time'),
            'videoStart': video.get('start_time'), 'fullDecodePassed': True, 'decodedAudioHash': pcm}}
        manifest['inputHashesUnchangedAfterBaseline'] = {k: sha(p) == manifest['inputs'][k]['sha256'] for k,p in FILES.items()}
        assert all(manifest['inputHashesUnchangedAfterBaseline'].values())
        manifest['status'] = '本期原声和现有版对照已准备；待SDR抽帧及三版动效渲染'
        save(manifest)
        print(json.dumps({'frames': END-START, 'durationSeconds': (END-START)/FPS,
            'captions': len(data['captions']), 'words': len(words), 'baseline': str(output),
            'baselineFullDecodePassed': True}, ensure_ascii=False))
    except Exception as error:
        manifest['status'] = '准备失败，保留现场；不得隐式覆盖重试'
        manifest['error'] = str(error)
        save(manifest)
        raise

def extend_to_3694():
    """仅延长本期已存在的562帧准备；旧版必须先逐字节存档。"""
    manifest = json.loads((ROOT/'manifest.json').read_text())
    assert manifest['frameWindow']['startFrame'] == START
    assert manifest['frameWindow']['endFrameExclusive'] == 3449
    history = ROOT/'media/history-562'
    assert (history/'历史保存回执.json').is_file()
    assert not (ROOT/'outputs/00_现有动效_同原声对照.mp4').exists()
    assert all(sha(p) == manifest['inputs'][k]['sha256'] for k,p in FILES.items())
    plan = json.loads(FILES['runtime'].read_text())
    transcript = json.loads(FILES['transcript'].read_text())
    assert not any(s.get('window') and s['window']['to'] > START and s['window']['from'] < END for s in plan['mediaSlots'])
    start, end = START/FPS, END/FPS
    data = dict(manifest['frameWindow'])
    data.update({'endFrameExclusive':END, 'durationFrames':END-START,
        'captions':[c for c in plan['captions'] if c['to']>START and c['from']<END],
        'cameraWindows':[c for c in plan['cameraWindows'] if c['to']>START and c['from']<END],
        'events':[e for e in plan['events'] if START<=e['frame']<END],
        'words':[dict(w,sourceWordIndex=i) for i,w in enumerate(transcript['words']) if w['start']>=start and w['end']<=end],
        'boundaryWords':[dict(w,sourceWordIndex=i) for i,w in enumerate(transcript['words']) if w['end']>start and w['start']<end and (w['start']<start or w['end']>end)]})
    manifest['frameWindow'] = data
    manifest['revision'] = '同窗807帧-v2'
    manifest['status'] = '扩窗准备中；现有版和后245帧尚待生成'
    manifest['history562'] = ref(history/'历史保存回执.json')
    manifest['cutBoundary'] = '扩至原片3694帧，完整覆盖真实工作环节当中去；整帧窗不变速，跨边界ASR候选单列，未冒称人工切点确认。'
    manifest.pop('preparationCheck', None)
    manifest.pop('renderAdapter', None)
    manifest['imageExtensionPending'] = True
    (ROOT/'web/data.js').write_text('window.SAMPLE_DATA = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n')
    voice = ROOT/'media/voice.wav'
    assert not (history/'voice.wav').exists()
    voice.rename(history/'voice.wav')
    manifest['history562Voice'] = ref(history/'voice.wav')
    save(manifest)
    run([FFMPEG,'-nostdin','-n','-v','error','-i',str(FILES['voice']),'-af',
         f'atrim=start={start:.12f}:end={end:.12f},asetpts=PTS-STARTPTS','-ar','48000','-c:a','pcm_s16le',str(voice)],manifest)
    output = ROOT/'outputs/00_现有动效_同原声对照.mp4'
    run([FFMPEG,'-nostdin','-n','-v','error','-ss',f'{start:.12f}','-i',str(FILES['baseline']),'-i',str(voice),
         '-map','0:v:0','-map','1:a:0','-frames:v',str(END-START),'-t',f'{(END-START)/FPS:.12f}',
         '-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-ar','48000',
         '-b:a','192k','-movflags','+faststart',str(output)],manifest)
    metadata = json.loads(run([FFPROBE,'-v','error','-count_frames','-show_streams','-show_format','-of','json',str(output)],manifest))
    video = next(s for s in metadata['streams'] if s['codec_type']=='video')
    audio = next(s for s in metadata['streams'] if s['codec_type']=='audio')
    assert int(video['nb_read_frames'])==END-START and video['r_frame_rate']=='30/1'
    assert (video['width'],video['height'])==(1920,1080)
    assert abs(float(video['duration'])-(END-START)/FPS)<.001
    run([FFMPEG,'-nostdin','-v','error','-i',str(output),'-f','null','-'],manifest)
    pcm = run([FFMPEG,'-nostdin','-v','error','-i',str(output),'-map','0:a:0','-t',f'{(END-START)/FPS:.12f}',
               '-c:a','pcm_s16le','-f','hash','-hash','sha256','-'],manifest).strip()
    manifest['preparedMedia'] = {'voice':ref(voice),'baseline':{**ref(output),'frames':int(video['nb_read_frames']),
        'fps':video['r_frame_rate'],'durationSeconds':float(video['duration']),'audioStart':audio.get('start_time'),
        'videoStart':video.get('start_time'),'fullDecodePassed':True,'decodedAudioHash':pcm}}
    manifest['inputHashesUnchangedAfterBaseline'] = {k:sha(p)==manifest['inputs'][k]['sha256'] for k,p in FILES.items()}
    assert all(manifest['inputHashesUnchangedAfterBaseline'].values())
    manifest['status'] = '807帧原声与现有版已准备；后245帧图像待续提取'
    save(manifest)
    print(json.dumps({'frames':END-START,'durationSeconds':(END-START)/FPS,'captions':len(data['captions']),
        'words':len(data['words']),'history':str(history),'baselineFullDecodePassed':True},ensure_ascii=False))

if __name__ == '__main__':
    if sys.argv[1:] == ['--extend-to-3694']:
        extend_to_3694()
    elif not sys.argv[1:]:
        main()
    else:
        raise SystemExit('仅支持无参数首次准备或 --extend-to-3694 本期扩窗。')
