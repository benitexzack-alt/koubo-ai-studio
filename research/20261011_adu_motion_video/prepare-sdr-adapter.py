"""为已核实的 BT.709 SDR 输入适配本机 zscale；不覆盖上游源码或历史文件。"""
import difflib
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
FFPROBE = '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe'
IMPORT_FILTER = 'zscale=pin=bt709:tin=bt709:min=bt709:rin=limited:p=bt709:t=iec61966-2-1:m=bt470bg:r=full,format=yuvj444p'
EXPORT_FILTER = 'format=gbrpf32le,zscale=pin=bt709:tin=iec61966-2-1:min=gbr:rin=full:p=bt709:t=bt709:m=bt709:r=limited,format=yuv420p,sidedata=mode=delete'

def main():
    manifest=json.loads((ROOT/'manifest.json').read_text())
    evidence={}
    for key in ['proxy','baseline']:
        source=manifest['inputs'][key]['path']
        stream=json.loads(subprocess.check_output([FFPROBE,'-v','error','-select_streams','v:0','-show_streams','-of','json',source]))['streams'][0]
        tags={k:stream.get(k) for k in ['color_range','color_space','color_transfer','color_primaries']}
        expected={'color_range':'tv','color_space':'bt709','color_transfer':'bt709','color_primaries':'bt709'}
        legacy={'color_range':'pc','color_space':'bt470bg','color_transfer':None,'color_primaries':None}
        if tags != expected and not (key=='baseline' and tags==legacy):
            raise SystemExit(f'不属于本适配器已核对的 SDR 输入，停止：{key} {tags}')
        evidence[key]=tags
        if key=='baseline' and tags==legacy:
            evidence[key]['interpretation']='历史MP4缺少传递函数和原色标签。仅裁取字幕条，以既有全范围JPEG显示解释为sRGB；这是明确假设，不是历史色彩核验通过。'
    if 'zscale' not in subprocess.check_output([FFMPEG,'-hide_banner','-filters'],stderr=subprocess.STDOUT,text=True):
        raise SystemExit('现有完整FFmpeg无zscale，停止。')
    for key,name in [('proxy','raw-srgb'),('baseline','subtitles-srgb')]:
        directory=ROOT/'media'/name
        directory.mkdir(exist_ok=False)
        vf=IMPORT_FILTER if key=='proxy' else 'crop=1920:180:0:900,format=yuvj444p'
        subprocess.run([FFMPEG,'-nostdin','-n','-v','error','-ss','156.2','-i',manifest['inputs'][key]['path'],'-frames:v','412','-vf',vf,'-q:v','2',str(directory/'%05d.jpg')],check=True)
    upstream=ROOT/'upstream/scripts/render_project.mjs'
    before=upstream.read_text()
    after=before.replace("import { chrome } from './chrome.mjs';", "import { chrome } from './upstream/scripts/chrome.mjs';")
    start=after.index("      const plan = spawnSync(process.env.ADU_PYTHON")
    end=after.index("\n    }",start)
    color={
        'policy':'本地隔离研究-SDR-zscale-v1','engine':'已存在FFmpeg8.1.2-full的zscale',
        'input':'Chrome forced sRGB, lossless RGB PNG',
        'sourceEvidence':evidence,
        'upstreamVideoEntrypointPassed':False,
        'reason':'上游导出强制FFmpeg9；原入口失败已记录，采用独立SDR适配器，未改上游。',
        'output':{'pix_fmt':'yuv420p','color_range':'tv','color_space':'bt709','color_transfer':'bt709','color_primaries':'bt709'},
        'conversion':'zscale实际像素转换，非仅替换色彩标签','filter':EXPORT_FILTER,
    }
    after=after[:start]+'      color = '+json.dumps(color,ensure_ascii=False)+';'+after[end:]
    after=after.replace("'ffmpeg'",repr(FFMPEG)).replace("'ffprobe'",repr(FFPROBE))
    after=after.replace('// Local deterministic renderAt(t) export.', '// 从 adunext/adu-motion-video 改编；MIT许可见本目录。仅本轮已核实SDR样片，未通过上游原视频入口。\n// Local deterministic renderAt(t) export.')
    (ROOT/'render-sdr-study.mjs').write_text(after)
    (ROOT/'renderer-adaptation.diff').write_text(''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='上游原渲染器',tofile='本地SDR研究适配器')))
    (ROOT/'qa/color-adaptation.json').write_text(json.dumps({'upstreamSha256':hashlib.sha256(before.encode()).hexdigest(),'localSha256':hashlib.sha256(after.encode()).hexdigest(),'inputFilter':IMPORT_FILTER,'output':color,'officialReference':'https://ffmpeg.org/ffmpeg-filters.html#zscale'},ensure_ascii=False,indent=2)+'\n')
    html=ROOT/'web/sample.html'
    html.write_text(html.read_text().replace('../media/raw/','../media/raw-srgb/').replace('../media/subtitles/','../media/subtitles-srgb/'))
    print('已准备SDR输入和独立渲染适配器；上游及原片未改。')

if __name__=='__main__':main()
