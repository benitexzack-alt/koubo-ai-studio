import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const norm = (s) => s.replace(/[\s，。？！、：；,.?!:;“”"'‘’（）()【】\[\]]/gu, '');
const c = read('canonical-spoken.v1.json');
const b = read('actual-bilingual.v1.json');
const r = read('transcription-review.v1.json');
const raw = read('host_whisper_small_raw_v1.json');
const runs = read('asr-review-runs.v1.json');
const checks = [];
function check(name, fn) { fn(); checks.push({name, result: 'ok'}); }

check('四个只读原文件SHA256未改变', () => {
  for (const [file, expected] of Object.entries(r.verification.originalHashes)) assert.equal(sha(path.join(dir, file)), expected);
});
check('每个实际识别词元时间均可追溯且未按字数推算', () => {
  for (const w of c.words) {
    for (const ref of w.sourceTokenReferences) {
      const t = raw.transcription[ref.segmentIndex].tokens[ref.tokenIndex];
      assert.equal(t.text, ref.text);
      assert.equal(t.id, ref.tokenId);
      assert.equal(t.offsets.from, ref.startMs);
      assert.equal(t.offsets.to, ref.endMs);
    }
    assert.equal(w.startMs, Math.min(...w.sourceTokenReferences.map((t) => t.startMs)));
    assert.equal(w.endMs, Math.max(...w.sourceTokenReferences.map((t) => t.endMs)));
    assert(w.endMs >= w.startMs);
    assert.equal(w.raw_text, w.sourceTokenReferences.map((t) => t.text).join(''));
  }
});
check('所有非标点中文差异都在更正清单内且原识别无丢失', () => {
  assert.equal(c.words.map((w) => w.raw_text).join(''), raw.transcription.map((s) => s.text).join(''));
  for (const [i, s] of raw.transcription.entries()) {
    let text = s.text;
    for (const correction of r.corrections.filter((x) => x.segmentIndex === i)) {
      assert(text.includes(correction.from));
      text = text.replace(correction.from, correction.to);
    }
    assert.equal(c.words.filter((w) => w.sourceSegmentIndex === i).map((w) => w.text).join(''), text);
  }
});
check('中英文页编号文字和时窗一致且未新增尾句', () => {
  assert.equal(c.captions.length, b.captions.length);
  assert.equal(norm(c.captions.map((x) => x.zh).join('')), c.words.map((w) => w.text).join(''));
  assert.equal(norm(fs.readFileSync(path.join(dir, 'actual-spoken.v1.txt'), 'utf8')), c.words.map((w) => w.text).join(''));
  assert.equal(c.captions.at(-1).zh, '可以来找我。');
  for (const [i, p] of c.captions.entries()) {
    assert.equal(p.id, b.captions[i].id);
    assert.equal(p.zh, b.captions[i].zh);
    assert.equal(p.startMs, b.captions[i].startMs);
    assert.equal(p.endMs, b.captions[i].endMs);
    assert(b.captions[i].en.trim());
  }
});
check('55页18至24字且开场结尾短页有明确理由', () => {
  for (const [i, p] of c.captions.entries()) {
    const n = norm(p.zh).length;
    assert(n <= 24);
    if (i !== 0 && i !== c.captions.length - 1) assert(n >= 18);
    else assert(p.paginationNote);
  }
});
check('字幕页只覆盖所绑定真实词元且无倒序重叠或越界', () => {
  const map = new Map(c.words.map((w) => [w.id, w]));
  const used = [];
  for (const [i, p] of c.captions.entries()) {
    const words = p.wordIds.map((id) => map.get(id));
    used.push(...p.wordIds);
    assert.equal(norm(p.zh), words.map((w) => w.text).join(''));
    assert.equal(p.startMs, Math.min(...words.map((w) => w.startMs)));
    assert.equal(p.endMs, Math.max(...words.map((w) => w.endMs)));
    assert(p.startMs >= 0 && p.endMs > p.startMs && p.endMs <= c.source.audioDurationMs);
    if (i > 0) assert(p.startMs >= c.captions[i - 1].endMs);
  }
  assert.deepEqual(used, c.words.map((w) => w.id));
});
check('待核编号双向关联且无人工听验或正式发布通过声明', () => {
  const ids = new Set(r.uncertain.map((u) => u.id));
  for (const p of c.captions) for (const id of p.uncertainIds) assert(ids.has(id));
  for (const u of r.uncertain) assert.deepEqual(u.captionIds, c.captions.filter((p) => p.uncertainIds.includes(u.id)).map((p) => p.id));
  for (const doc of [c, b, r]) {
    assert.equal(doc.formalAllowed, false);
    assert.equal(doc.humanListeningPerformed, false);
    assert.equal(doc.userAudioReviewConfirmed, false);
    assert.equal(doc.status, 'needs-user-audio-review');
  }
});
check('经理外贸员工正在用AI均保留而非恢复预拍稿', () => {
  const text = c.words.map((w) => w.text).join('');
  assert(text.includes('你每天忙着客户员工和经理'));
  assert(text.includes('比如你做外贸'));
  assert(text.includes('员工正在用AI'));
  assert(!text.includes('商贸'));
  assert(!text.includes('员工和经营'));
});
check('复核引用的文件与本次识别回执哈希一致', () => {
  for (const correction of r.corrections) {
    assert(correction.from && correction.to && correction.reason);
    for (const e of [correction.originalEvidence, ...correction.comparisonEvidence]) {
      assert.equal(sha(e.file), e.sha256);
      assert(e.segments.length > 0);
      const document = JSON.parse(fs.readFileSync(e.file, 'utf8'));
      for (const s of e.segments) {
        assert.equal(s.text, document.transcription[s.segmentIndex].text);
        assert.equal(s.sourceStartMs, document.transcription[s.segmentIndex].offsets.from + e.sourceOffsetMs);
      }
    }
  }
  for (const run of runs.runs) {
    assert.equal(sha(run.jsonPath), run.jsonSha256);
    assert.equal(sha(run.audioPath), run.audioSha256);
    assert.equal(run.prompt, '兰州，企业AI，GEO，工信部，知识库');
    assert.equal(run.exitCode, 0);
  }
});

function pcm(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (kind === 'data') return bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  throw new Error('WAV缺少data块');
}
check('六个局部音频PCM逐字节匹配原音频对应区间', () => {
  const source = pcm(path.join(dir, 'host_16k.wav'));
  for (const run of runs.runs) {
    const crop = pcm(run.audioPath);
    const startByte = Math.round(run.sourceStartMs * 16) * 2;
    assert(crop.equals(source.subarray(startByte, startByte + crop.length)), run.label);
  }
});
const deliverables = ['canonical-spoken.v1.json', 'actual-bilingual.v1.json', 'transcription-review.v1.json', 'actual-spoken.v1.txt', 'actual-spoken.review-marked.v1.txt', 'transcription-validation.v1.json'];
const receipt = {schemaVersion: 1, createdAt: new Date().toISOString(), status: 'machine-structural-checks-complete', audioFidelityStatus: 'not-human-verified', formalAllowed: false, checks, deliverables: deliverables.map((file) => ({file: path.join(dir, file), sha256: sha(path.join(dir, file))})), summary: {captions: c.captions.length, words: c.words.length, corrections: r.corrections.length, uncertain: r.uncertain.length, zeroDurationASRUnits: c.words.filter((w) => w.endMs === w.startMs).length}, scopeNote: '仅验证本子任务文件、真实PCM片段和ASR记录对应关系；父任务生产入口问题不在本次修复范围，未绕过任何制作门禁。'};
fs.writeFileSync(path.join(dir, 'transcription-independent-check.v1.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(receipt, null, 2));
