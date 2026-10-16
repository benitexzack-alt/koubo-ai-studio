"""复用旧研究的显式SDR适配；只写本期拥有的素材、适配器和色彩回执。"""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
FFPROBE = '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe'
IMPORT_FILTER = 'zscale=pin=bt709:tin=bt709:min=bt709:rin=limited:p=bt709:t=iec61966-2-1:m=bt470bg:r=full,format=yuvj444p'
EXPORT_FILTER = 'format=gbrpf32le,zscale=pin=bt709:tin=iec61966-2-1:min=gbr:rin=full:p=bt709:t=bt709:m=bt709:r=limited,format=yuv420p,sidedata=mode=delete'

def sha(path):
    d = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(2**20), b''):d.update(b)
    return d.hexdigest()

def main():
    manifest = json.loads((ROOT/'manifest.json').read_text())
    extending = sys.argv[1:] == ['--extend-to-3694']
    if sys.argv[1:] and not extending:raise SystemExit('未知参数。')
    if not extending and ((ROOT/'render-sdr-study.mjs').exists() or (ROOT/'qa/color-adaptation.json').exists()):
        raise SystemExit('SDR适配已存在，禁止覆盖。')
    window = manifest['frameWindow']
    start = window['startFrame']/window['fps']
    frames = window['durationFrames']
    if extending:
        assert window['startFrame']==2887 and window['endFrameExclusive']==3694 and frames==807
        assert (ROOT/'media/history-562/color-adaptation.json').is_file()
    commands, evidence = [], {}
    def run(args):
        begun = datetime.datetime.now(datetime.timezone.utc).isoformat()
        clock = time.monotonic()
        r = subprocess.run(args, capture_output=True, text=True)
        commands.append({'argv': args, 'startedAt': begun, 'elapsedSeconds': round(time.monotonic()-clock,3),
                         'exitCode': r.returncode, 'stdout': r.stdout, 'stderr': r.stderr})
        manifest['sdrCommands'] = commands
        (ROOT/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
        if r.returncode:raise RuntimeError(r.stderr[-2000:])
        return r.stdout
    for key in ['proxy','baseline']:
        source = manifest['inputs'][key]
        if sha(source['path']) != source['sha256']:raise SystemExit(f'输入已变化：{key}')
        stream = json.loads(run([FFPROBE,'-v','error','-select_streams','v:0','-show_streams','-of','json',source['path']]))['streams'][0]
        tags = {k:stream.get(k) for k in ['color_range','color_space','color_transfer','color_primaries']}
        expected = {'color_range':'tv','color_space':'bt709','color_transfer':'bt709','color_primaries':'bt709'}
        legacy = {'color_range':'pc','color_space':'bt470bg','color_transfer':None,'color_primaries':None}
        if tags != expected and not (key=='baseline' and tags==legacy):
            raise SystemExit(f'不属于本适配器已核对SDR输入，停止：{key} {tags}')
        evidence[key] = {'source': source, 'probeTags': tags}
        if key=='baseline' and tags==legacy:
            evidence[key]['interpretation']='本期R3成片缺少传递函数和原色标签；字幕条按既有全范围JPEG显示解释为sRGB。这是显式假设，不作为严格调色对照。'
    version = run([FFMPEG,'-version']).splitlines()[0]
    if 'zscale' not in run([FFMPEG,'-hide_banner','-filters']):raise SystemExit('现有完整FFmpeg无zscale，停止。')
    image_sets = {}
    for key,name in [('proxy','raw-srgb'),('baseline','subtitles-srgb')]:
        directory = ROOT/'media'/name
        existing = sorted(directory.glob('*.jpg')) if directory.exists() else []
        if extending:
            assert len(existing)==562 and [p.name for p in existing]==[f'{i:05d}.jpg' for i in range(1,563)]
            prefix_hashes = {p.name:sha(p) for p in existing}
        else:
            directory.mkdir(exist_ok=False)
            prefix_hashes = {}
        first_output = len(existing)+1
        extraction_start = (window['startFrame']+len(existing))/window['fps']
        crop = window['subtitleCrop']
        vf = IMPORT_FILTER if key=='proxy' else f"crop={crop['width']}:{crop['height']}:{crop['x']}:{crop['y']},format=yuvj444p"
        run([FFMPEG,'-nostdin','-n','-v','error','-ss',f'{extraction_start:.12f}','-i',manifest['inputs'][key]['path'],
             '-frames:v',str(frames-len(existing)),'-vf',vf,'-q:v','2','-start_number',str(first_output),str(directory/'%05d.jpg')])
        images = sorted(directory.glob('*.jpg'))
        if len(images)!=frames or images[0].name!='00001.jpg' or images[-1].name!=f'{frames:05d}.jpg':
            raise RuntimeError(f'抽帧数量或命名不符：{name}')
        image_hashes = [{'file':p.name,'sha256':sha(p)} for p in images]
        image_sets[name] = {'directory':str(directory),'frames':len(images),'bytes':sum(p.stat().st_size for p in images),
            'firstFrameSha256':image_hashes[0]['sha256'],'lastFrameSha256':image_hashes[-1]['sha256'],
            'orderedFrameHashListSha256':hashlib.sha256(json.dumps(image_hashes,sort_keys=True,separators=(',',':')).encode()).hexdigest()}
        if extending:
            assert all(sha(directory/name)==digest for name,digest in prefix_hashes.items())
            image_sets[name]['extension']={'preservedPrefixFrames':562,'appendedFrames':245,'firstAppendedName':'00563.jpg',
                'firstAppendedSourceFrame':3449,'lastAppendedSourceFrame':3693,'prefixHashesUnchanged':True}
    upstream = ROOT/'upstream/scripts/render_project.mjs'
    before = upstream.read_text()
    after = before.replace("import { chrome } from './chrome.mjs';", "import { chrome } from './upstream/scripts/chrome.mjs';")
    begin = after.index('      const plan = spawnSync(process.env.ADU_PYTHON')
    end = after.index('\n    }',begin)
    color = {'policy':'本期隔离研究-SDR-zscale-v1','engine':version,'input':'Chrome forced sRGB, lossless RGB PNG',
        'sourceEvidence':evidence,'upstreamVideoEntrypointPassed':False,
        'reason':'复用旧研究的本地SDR适配；本期重新probe。未执行上游强制FFmpeg9入口，未改上游。',
        'output':{'pix_fmt':'yuv420p','color_range':'tv','color_space':'bt709','color_transfer':'bt709','color_primaries':'bt709'},
        'conversion':'zscale实际像素转换，非只改标签','filter':EXPORT_FILTER}
    after = after[:begin]+'      color = '+json.dumps(color,ensure_ascii=False)+';'+after[end:]
    after = after.replace("'ffmpeg'",repr(FFMPEG)).replace("'ffprobe'",repr(FFPROBE))
    after = after.replace('// Local deterministic renderAt(t) export.', '// adunext/adu-motion-video MIT源码本期研究适配；许可见本目录。\n// Local deterministic renderAt(t) export.')
    (ROOT/'render-sdr-study.mjs').write_text(after)
    receipt = {'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'upstreamSha256':sha(upstream),'localSha256':sha(ROOT/'render-sdr-study.mjs'),
        'tools':{'ffmpeg':{'path':FFMPEG,'sha256':sha(FFMPEG)},'ffprobe':{'path':FFPROBE,'sha256':sha(FFPROBE)}},
        'inputFilter':IMPORT_FILTER,'output':color,'frameWindow':{k:window[k] for k in ['startFrame','endFrameExclusive','fps','durationFrames']},
        'imageSets':image_sets,'commands':commands,'formalProduction':False,'humanAccepted':False}
    (ROOT/'qa/color-adaptation.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    manifest['renderAdapter'] = {'path':'render-sdr-study.mjs','sha256':sha(ROOT/'render-sdr-study.mjs'),
        'colorReceipt':'qa/color-adaptation.json','colorReceiptSha256':sha(ROOT/'qa/color-adaptation.json'),
        'upstreamFullPipelineVerified':False}
    manifest['preparedImageSets'] = image_sets
    manifest['imageExtensionPending'] = False
    manifest['status'] = '本期同窗输入、SDR抽帧和现有版对照已准备；三版待渲染，未启动服务，未人工验收'
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'framesPerSet':frames,'sets':image_sets,'renderer':str(ROOT/'render-sdr-study.mjs'),
        'sampleHtmlModified':False,'otherVariantsRendered':False},ensure_ascii=False))

if __name__=='__main__':main()
