import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const qa = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(qa, '../../..');
const base = path.resolve(root, 'edit/20261006_ten_ai_businesses');
const prior = path.resolve(base, '14_交付包_R1');
const out = path.resolve(base, '16_交付包_R2');
const film = path.resolve(base, '08_正式成片/10个AI生意_V8_R2_1080P_字幕修正版.mp4');
const archive = path.resolve(base, '08_正式成片/10个AI生意_完整观看包_R2_字幕修正版.zip');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const local = file => path.relative(root, file);
const assert = (value, text) => {if (!value) throw new Error(text);};
const copy = (from, to) => {fs.mkdirSync(path.dirname(to), {recursive: true}); fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL); assert(sha(from) === sha(to), '复制哈希不同');};
const media = read(path.resolve(qa, '最终字幕修正版媒体检查.r2.json'));
const pixelsPath = path.resolve(qa, '最终成片87页字幕/实际成片87页字幕回执.r2.json');
const candidate = read(path.resolve(qa, '候选制作与生产阻断说明.r2.json'));
const visual = path.resolve(qa, '最终87页字幕独立视觉复核.r2.md');
assert(Object.values(media.checks).every(value => value === true), '媒体检查未全部通过');
assert(fs.existsSync(visual), '最终静态视觉复核未形成');
assert(sha(film) === media.film.sha256 && sha(film) === candidate.output.sha256, '质检未绑定当前片');
assert(candidate.formalProductionPassed === false, '不能将观看包伪装正式生产通过');
assert(!fs.existsSync(archive) && !fs.existsSync(path.resolve(out, '交付记录.r2.json')), '禁止覆盖既有交付');

copy(film, path.resolve(out, path.basename(film)));
for (const name of ['3比4真人截图合成封面提示词.md', '发布文字_实录摘录.md']) copy(path.resolve(prior, name), path.resolve(out, name));
for (const name of ['中文_实录字幕_R1.srt', '英文_辅助字幕_R1.srt', '双语_同窗字幕_R1.srt',
  'captions.r2.json', 'spoken-source-policy.r2.json', 'correction-candidates.r2.json', '字幕机械对应验证.r1.json']) {
  copy(path.resolve(prior, '字幕', name), path.resolve(out, '字幕', name));
}
copy(path.resolve(root, 'remotion/src/ten-ai-businesses-final-r2/caption-emphasis.r2.json'), path.resolve(out, '字幕/caption-emphasis.r2.json'));
for (const name of ['最终字幕修正版媒体检查.r2.json', '最终字幕修正版媒体检查.r2.md', '最终87页字幕独立视觉复核.r2.md', '候选制作与生产阻断说明.r2.json']) {
  copy(path.resolve(qa, name), path.resolve(out, '质检回执', name));
}
copy(pixelsPath, path.resolve(out, '质检回执/实际成片87页字幕回执.r2.json'));
const screenshot = path.resolve(out, '本期成片真人截图.png');
const capture = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', film, '-vf', 'select=eq(n\\,444)', '-frames:v', '1', screenshot], {encoding: 'utf8'});
assert(capture.status === 0, capture.stderr);
const record = read(path.resolve(prior, '交付记录.r1.json'));
record.schema = 'ten-ai-businesses-subtitle-review-delivery/r2';
record.status = 'blocked-production-registration';
record.film = {...record.film, path: local(film), packageCopy: path.basename(film), sha256: sha(film), bytes: fs.statSync(film).size};
record.coverPerson = {...record.coverPerson, sourceFilm: local(film), sourceFilmSha256: sha(film), sha256: sha(screenshot), actualFinalExtraction: local(screenshot), actualFinalExtractionByteMatch: true};
record.mediaQa = '质检回执/最终字幕修正版媒体检查.r2.json';
delete record.alignedAudioAndUnchangedVideoReceipt;
record.subtitleVisualQa = '质检回执/实际成片87页字幕回执.r2.json';
record.subtitleVisualReview = '质检回执/最终87页字幕独立视觉复核.r2.md';
record.subtitleStyle = {style: '实心粗白字与黄色关键词', pages: 87, highlightedPages: 76, plainPages: 11, highlightTerms: 89,
  textAndTimingUnchanged: true, emphasis: '字幕/caption-emphasis.r2.json'};
record.audioPreservation = {mode: 'R1已对齐AAC逐包复制', encodedBytesIdentical: media.checks.audioEncodedBytesIdenticalToR1,
  packetTimingIdentical: media.checks.audioPacketTimingAndSizesIdenticalToR1, fullPcmIdentical: media.checks.audioDecodedSamplesIdenticalToR1};
record.productionRegistration = {status: 'blocked', successReceipt: null, failureCode: 'KCPG2_CONTEXT_VALIDATION_FAILED',
  detail: '全片渲染完成后，其他项目知识库候选变化导致index-not-current；刷新上下文只支持后续只读检查，不能追认旧渲染成功。',
  evidence: '质检回执/候选制作与生产阻断说明.r2.json', formalProductionPassed: false};
record.note = '本包仅为完整观看候选与配套材料；媒体与87页静态字幕检查通过不消除正式生产登记阻断，也不替代正常速度全片观看、听感、事实核验和发布授权。';
fs.writeFileSync(path.resolve(out, '交付记录.r2.json'), JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});

// Python zipfile 正确标记UTF-8中文文件名；不使用不带UTF-8标志的系统zip。
const zip = spawnSync('python3', ['-c', String.raw`
import hashlib, json, sys, zipfile
from pathlib import Path
folder, archive, film, receipt = map(Path, sys.argv[1:])
files = sorted(p for p in folder.rglob('*') if p.is_file())
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_STORED) as output:
    for file in files:
        if file.is_symlink(): raise RuntimeError('包内不允许符号链接')
        output.write(file, file.relative_to(folder).as_posix())
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None, 'ZIP CRC失败'
    assert sorted(output.namelist()) == sorted(p.relative_to(folder).as_posix() for p in files)
    assert all(info.flag_bits & 2048 for info in output.infolist() if not info.filename.isascii())
    digest = hashlib.sha256(output.read(film.name)).hexdigest()
    assert digest == hashlib.sha256(film.read_bytes()).hexdigest()
result = {'status': '观看包完整性检查通过，正式生产登记仍阻断', 'archive': str(archive),
          'fileCount': len(files), 'bytes': archive.stat().st_size,
          'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
          'crcValid': True, 'unicodeNamesValid': True, 'filmSha256': digest,
          'formalProductionPassed': False, 'published': False}
with receipt.open('x') as output: json.dump(result, output, ensure_ascii=False, indent=2)
print(json.dumps(result, ensure_ascii=False))
`, out, archive, film, path.resolve(qa, '观看包完整性核验.r2.json')], {encoding: 'utf8', maxBuffer: 1024 * 1024});
assert(zip.status === 0, zip.stderr);
console.log(zip.stdout);
