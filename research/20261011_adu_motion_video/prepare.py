"""只准备独立动效研究的真实输入，不修改历史工程。"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
UPSTREAM = ROOT / 'upstream'
START, END, FPS = 4686, 5098, 30
FILES = {
    'original': PROJECT / 'edit/20261006_ten_ai_businesses/01_素材投放区/01_口播原片/copy_49E4F13A-70AB-4E11-92B2-545146690784.MOV',
    'proxy': PROJECT / 'remotion/public-ten-ai-businesses-final-r1/ten-ai-businesses-final-r1/host.mp4',
    'voice': PROJECT / 'remotion/public-ten-ai-businesses-final-r1/ten-ai-businesses-final-r1/audio/original.wav',
    'baseline': PROJECT / 'edit/20261006_ten_ai_businesses/08_正式成片/10个AI生意_V8_R2_1080P_字幕修正版.mp4',
    'runtime': PROJECT / 'remotion/src/ten-ai-businesses-final-r2/runtime-plan.r2.json',
    'transcript': PROJECT / 'edit/20261006_ten_ai_businesses/08_实录与字幕/字幕候选_R2/transcript.r2.json',
    'profile': PROJECT / 'workflow/active-production-profile.v1.json',
}

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(2**20), b''):
            h.update(chunk)
    return h.hexdigest()

def run(args):
    subprocess.run(args, check=True)

def main():
    for name in ['web', 'media/raw', 'media/subtitles', 'outputs', 'qa']:
        (ROOT / name).mkdir(parents=True, exist_ok=True)
    if (ROOT / 'manifest.json').exists():
        raise SystemExit('准备回执已存在；禁止隐式覆盖，检查现有输入后另建版本。')
    plan = json.loads(FILES['runtime'].read_text())
    transcript = json.loads(FILES['transcript'].read_text())
    inputs = {k: {'path': str(p), 'sha256': sha(p), 'bytes': p.stat().st_size} for k, p in FILES.items()}
    data = {
        'startFrame': START, 'endFrameExclusive': END, 'fps': FPS,
        'durationFrames': END-START,
        'captions': [c for c in plan['captions'] if c['to'] > START and c['from'] < END],
        'cameras': [c for c in plan['cameras'] if c['to'] > START and c['from'] < END],
        'words': [w for w in transcript['words'] if START/FPS <= w['start'] < END/FPS],
    }
    (ROOT / 'web/data.js').write_text('window.SAMPLE_DATA = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')
    # 只复制已经逐行审阅的核心函数段；后续媒体/人脸/示例品牌运行码不加载。
    lib = UPSTREAM / 'packs/continuous-performance/1.0.0/lib.js'
    helpers = lib.read_text().split('/* entrance/exit presets */')[0]
    (ROOT / 'web/upstream-helpers.js').write_text('// 来源 adunext/adu-motion-video，MIT，见 MIT上游许可.txt\n' + helpers)
    shutil.copy2(UPSTREAM / 'packs/continuous-performance/1.0.0/motion.js', ROOT / 'web/upstream-motion.js')
    shutil.copy2(UPSTREAM / 'LICENSE', ROOT / 'MIT上游许可.txt')
    font_dir = ROOT / 'web/fonts'
    font_dir.mkdir(exist_ok=True)
    font = PROJECT / 'remotion/public-ten-ai-businesses-final-r1/motion-upgrade-r2/fonts/smiley-sans.woff2'
    if not font.exists():
        raise SystemExit(f'已有动效字体不存在：{font}')
    (font_dir / 'motion.woff2').symlink_to(font)
    common = ['ffmpeg', '-nostdin', '-n', '-v', 'error', '-ss', str(START/FPS)]
    run(common + ['-i', str(FILES['proxy']), '-frames:v', str(END-START), '-q:v', '2', str(ROOT/'media/raw/%05d.jpg')])
    # 所有适配样片使用历史MP4原像素字幕，避免字幕样式变化混入动效比较。
    run(common + ['-i', str(FILES['baseline']), '-frames:v', str(END-START), '-vf', 'crop=1920:180:0:900', '-q:v', '2', str(ROOT/'media/subtitles/%05d.jpg')])
    run(['ffmpeg','-nostdin','-n','-v','error','-i',str(FILES['voice']),'-af',f'atrim=start={START/FPS}:end={END/FPS},asetpts=PTS-STARTPTS','-ar','48000','-c:a','pcm_s16le',str(ROOT/'media/voice.wav')])
    # 对照版使用现有成片画面，音频替换为同一原声片段，只比较视觉。
    run(common + ['-i',str(FILES['baseline']),'-i',str(ROOT/'media/voice.wav'),'-map','0:v:0','-map','1:a:0','-frames:v',str(END-START),'-t',str((END-START)/FPS),'-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart',str(ROOT/'outputs/00_现有动效_同原声对照.mp4')])
    source_paths = [lib, UPSTREAM/'packs/continuous-performance/1.0.0/motion.js', UPSTREAM/'packs/continuous-performance/1.0.0/units/claim-into-container.js', UPSTREAM/'packs/stage-performance/1.0.0/units/decompose-and-consolidate.js', UPSTREAM/'packs/editorial-performance/1.0.0/units/decompose-and-consolidate.js',UPSTREAM/'scripts/render_project.mjs',UPSTREAM/'SKILL.md']
    manifest = {
        'status':'研究小样输入已准备，待渲染和用户观看',
        'stage':'governance-maintenance：用户明确授权的隔离动效试验',
        'taskId':'task-20261011T032304Z-add66267',
        'upstream':{'url':'https://github.com/adunext/adu-motion-video','commit':subprocess.check_output(['git','-C',str(UPSTREAM),'rev-parse','HEAD'],text=True).strip(),'version':'3.14.0-rc.1','installedGlobally':False},
        'inputs':inputs, 'frameWindow':data,
        'sourceCode':[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in source_paths],
        'boundaries':{'formalProduction':False,'publishAuthorized':False,'baselineModified':False,'rawModified':False,'captionTextModified':False,'addedSfx':False,'newBgm':False,'uploaded':False,'fullMacroReplay':False},
        'experiment':'同一实录、同一帧窗、同一原声；字幕像素来自现有MP4。三种样片为具体源码原语的本地适配，不声明上游完整镜头组原样复刻。',
        'acceptance':'技术检查及静态复核后交用户正常速度观看；更易理解与观感提升仍待判断，不推导流量或完播收益。',
    }
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'frames':END-START,'duration':(END-START)/FPS,'captions':len(data['captions']),'directory':str(ROOT)},ensure_ascii=False))

if __name__ == '__main__':
    main()
