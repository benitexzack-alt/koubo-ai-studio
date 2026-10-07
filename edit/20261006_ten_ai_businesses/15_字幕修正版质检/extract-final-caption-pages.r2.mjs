import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// 只读最终MP4；一次视频解码选出87页中点，输出只写入本期字幕质检目录。
const qa = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(qa, '../../..');
const output = path.join(qa, '最终成片87页字幕');
const movie = path.join(root, 'edit/20261006_ten_ai_businesses/08_正式成片/10个AI生意_V8_R2_1080P_字幕修正版.mp4');
const runtimePath = path.join(root, 'remotion/src/ten-ai-businesses-final-r2/runtime-plan.r2.json');
const emphasisPath = path.join(root, 'remotion/src/ten-ai-businesses-final-r2/caption-emphasis.r2.json');
const check = (condition, message) => { if (!condition) throw new Error(message); };
const relative = file => path.relative(root, file).split(path.sep).join('/');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeNewJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const sha = async file => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
const run = (command, args) => {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  check(result.status === 0, `${command}失败：${result.stderr || result.error || result.status}`);
  return result.stdout;
};

check(process.argv.includes('--render-complete'), '先等待主代理确认完整最终MP4已落盘，再使用--render-complete运行；不读取正在输出的半文件。');
check(fs.existsSync(movie) && fs.statSync(movie).isFile(), '最终字幕修正版MP4不存在');
check(!fs.existsSync(output), '最终87页质检目录已存在，本脚本不覆盖或删除既有证据。');
const movieBefore = fs.statSync(movie);
const movieSha256 = await sha(movie);
const runtimeSha256 = await sha(runtimePath);
const emphasisSha256 = await sha(emphasisPath);
const runtime = json(runtimePath);
const emphasis = json(emphasisPath);
check(runtime.durationInFrames === 8534 && runtime.fps === 30, '本期时间轴不是8534帧/30fps');
check(runtime.captions.length === 87 && Object.keys(emphasis).length === 87, '本期字幕或重点词不是87页');
const pageInputs = runtime.captions.map((caption, index) => {
  check(caption.id === `C${String(index + 1).padStart(3, '0')}`, `字幕ID不连续：${caption.id}`);
  check(caption.left === undefined && caption.top === undefined && caption.width === undefined,
    `${caption.id}使用自定义布局，先核对字幕像素检查区域再运行`);
  check(JSON.stringify(caption.highlights) === JSON.stringify(emphasis[caption.id]), `${caption.id}重点词与渲染计划不同`);
  check(caption.highlights.every(word => word.length > 0 && caption.chinese.includes(word)), `${caption.id}重点词不是实录原文子串`);
  const frame = Math.floor((caption.from + caption.to) / 2);
  check(Number.isInteger(frame) && frame >= caption.from && frame < caption.to, `${caption.id}中点越界`);
  return {
    captionId: caption.id, from: caption.from, to: caption.to, frame, timeSeconds: frame / 30,
    chinese: caption.chinese, english: caption.english, highlights: caption.highlights,
    expectedYellow: caption.highlights.length > 0,
  };
});
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', movie]));
const video = probe.streams.find(stream => stream.codec_type === 'video');
check(video?.width === 1920 && video?.height === 1080, '最终MP4不是1920×1080');
const [numerator, denominator] = video.avg_frame_rate.split('/').map(Number);
check(numerator / denominator === 30 && Number(video.nb_frames) === 8534, '最终MP4不是完整8534帧/30fps');
const indices = pageInputs.map(page => page.frame);
check(new Set(indices).size === 87, '87页中点未形成87个独立帧');
check(indices.every((frame, index) => index === 0 || frame > indices[index - 1]), '字幕中点未按时间递增');
fs.mkdirSync(output);
const framesDir = path.join(output, '原尺寸PNG');
fs.mkdirSync(framesDir);
const select = `select=${indices.map(frame => `eq(n\\,${frame})`).join('+')}`;
const ffmpegArgs = ['-nostdin', '-v', 'error', '-i', movie, '-map', '0:v:0', '-an', '-vf', select,
  '-fps_mode', 'vfr', '-compression_level', '2', '-start_number', '0', path.join(framesDir, 'selected_%03d.png')];
run('ffmpeg', ffmpegArgs);
const selected = fs.readdirSync(framesDir).filter(name => /^selected_\d{3}\.png$/.test(name)).sort();
check(selected.length === 87, `实际选中${selected.length}帧，预期87帧`);
const pages = [];
for (const [index, page] of pageInputs.entries()) {
  const file = path.join(framesDir, `${page.captionId}_F${String(page.frame).padStart(6, '0')}.png`);
  fs.renameSync(path.join(framesDir, selected[index]), file);
  pages.push({...page, path: relative(file), sha256: await sha(file), width: 1920, height: 1080});
}
const projection = {
  sourceMovie: {path: relative(movie), sha256: movieSha256, sizeBytes: movieBefore.size, video},
  runtime: {path: relative(runtimePath), sha256: runtimeSha256},
  emphasis: {path: relative(emphasisPath), sha256: emphasisSha256},
  frameConvention: '零起算帧；每页from/to为实际渲染帧窗，中点取floor((from+to)/2)。',
  ffmpegCommand: ['ffmpeg', ...ffmpegArgs], ffmpegVideoDecodeCount: 1, pages,
};
const projectionPath = path.join(output, '实际抽帧输入.r2.json');
writeNewJson(projectionPath, projection);

// 使用已安装Pillow从真实解码PNG裁出字幕，不放大、不缩小；检测范围避开上方动效。
const analysis = JSON.parse(run('python3', ['-c', String.raw`
import hashlib, json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

projection = json.loads(Path(sys.argv[1]).read_text())
output = Path(sys.argv[2])
root = Path(sys.argv[3])
crops = output / '字幕原尺寸裁片'
contacts = output / '字幕原尺寸联系表'
crops.mkdir(exist_ok=False)
contacts.mkdir(exist_ok=False)
font_path = '/System/Library/Fonts/STHeiti Medium.ttc'
font = ImageFont.truetype(font_path, 24)
small = ImageFont.truetype(font_path, 22)
roi = (229, 940, 1691, 995)
crop_rect = (0, 920, 1920, 1050)
threshold = 40
records = []
for page in projection['pages']:
    image = Image.open(root / page['path']).convert('RGB')
    if image.size != (1920, 1080):
        raise RuntimeError(f"{page['captionId']}实际PNG不是1920×1080")
    region = image.crop(roi)
    pixels = region.get_flattened_data() if hasattr(region, 'get_flattened_data') else region.getdata()
    count = sum(r >= 190 and 145 <= g <= 235 and b <= 125 and r-g >= 10 and g-b >= 55 for r,g,b in pixels)
    detected = count >= threshold
    crop_file = crops / f"{page['captionId']}_F{page['frame']:06d}_字幕.png"
    image.crop(crop_rect).save(crop_file, compress_level=2)
    records.append({
        'captionId': page['captionId'], 'frame': page['frame'], 'timeSeconds': page['timeSeconds'],
        'chinese': page['chinese'], 'english': page['english'], 'highlights': page['highlights'],
        'expectedYellow': page['expectedYellow'], 'yellowPixelCount': count,
        'yellowDetected': detected, 'matchesExpected': detected == page['expectedYellow'],
        'cropPath': str(crop_file.relative_to(root)), 'cropSha256': hashlib.sha256(crop_file.read_bytes()).hexdigest(),
    })
contact_records = []
for start in range(0, len(records), 8):
    group = records[start:start+8]
    tile_height = 196
    canvas = Image.new('RGB', (1920, tile_height*len(group)), '#12171d')
    draw = ImageDraw.Draw(canvas)
    for index, row in enumerate(group):
        y = index * tile_height
        color = '#adf2c7' if row['matchesExpected'] else '#ff8e88'
        draw.text((16, y+5), f"{row['captionId']}  F{row['frame']:06d}  {row['timeSeconds']:.3f}秒  黄色像素{row['yellowPixelCount']}  机器匹配：{'是' if row['matchesExpected'] else '否'}", font=font, fill=color)
        words = ' / '.join(row['highlights']) if row['highlights'] else '本页无重点词'
        draw.text((16, y+35), '重点词：'+words, font=small, fill='#f3cf61')
        canvas.paste(Image.open(root / row['cropPath']), (0, y+66))
    contact_file = contacts / f"字幕联系表_{group[0]['captionId']}_{group[-1]['captionId']}.png"
    canvas.save(contact_file, compress_level=2)
    contact_records.append({'path': str(contact_file.relative_to(root)), 'captionIds': [row['captionId'] for row in group],
        'width': canvas.width, 'height': canvas.height, 'sourceScale': 1, 'subtitlePixelsResized': False,
        'sha256': hashlib.sha256(contact_file.read_bytes()).hexdigest()})
print(json.dumps({
    'scope': '只检测实际MP4字幕区域的黄色像素；机器检查不能替代字形、遮挡、全文、正常速度及听感验收。',
    'yellowRegion': {'left':roi[0], 'top':roi[1], 'rightExclusive':roi[2], 'bottomExclusive':roi[3]},
    'yellowPredicate': 'R>=190 && 145<=G<=235 && B<=125 && R-G>=10 && G-B>=55',
    'yellowPixelMinimum': threshold,
    'subtitleCrop': {'left':crop_rect[0], 'top':crop_rect[1], 'width':1920, 'height':130},
    'sourceMovieSha256': projection['sourceMovie']['sha256'],
    'expectedYellowPageCount': sum(row['expectedYellow'] for row in records),
    'detectedYellowPageCount': sum(row['yellowDetected'] for row in records),
    'matchedPageCount': sum(row['matchesExpected'] for row in records),
    'all87PagesMatchExpected': all(row['matchesExpected'] for row in records),
    'pages':records, 'contacts':contact_records,
}, ensure_ascii=False))
`, projectionPath, output, root]));
const movieAfter = fs.statSync(movie);
check(movieAfter.size === movieBefore.size && movieAfter.mtimeMs === movieBefore.mtimeMs &&
  await sha(movie) === movieSha256, '实际MP4在抽帧过程中发生变化');
check(await sha(runtimePath) === runtimeSha256 && await sha(emphasisPath) === emphasisSha256,
  '运行期字幕或重点词输入发生变化，不能认定同源');
const receipt = {
  schemaVersion: 'ten-ai-businesses-actual-caption-pages/v2',
  status: analysis.all87PagesMatchExpected ? 'actual-movie-caption-pixel-check-passed' : 'actual-movie-caption-pixel-check-needs-review',
  ...projection, analysis, sourceMovieUnchangedDuringExtraction: true, inputsUnchangedDuringExtraction: true,
  acceptance: {all87PagesVisuallyReviewed: false, normalSpeedPlaybackReviewed: false, humanListeningPerformed: false, userAcceptance: false},
};
writeNewJson(path.join(output, '实际成片87页字幕回执.r2.json'), receipt);
console.log(JSON.stringify({status: receipt.status, movieSha256, extractedPageCount: pages.length,
  matchedPageCount: analysis.matchedPageCount, expectedYellowPageCount: analysis.expectedYellowPageCount,
  detectedYellowPageCount: analysis.detectedYellowPageCount, contactCount: analysis.contacts.length,
  mismatches: analysis.pages.filter(page => !page.matchesExpected).map(page => page.captionId),
  output: relative(output), humanListeningPerformed: false, userAcceptance: false}, null, 2));
if (!analysis.all87PagesMatchExpected) process.exitCode = 2;
