import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../../../..');
const episode = path.join(root, 'edit/20260906_lanzhou_ai_services');
const pub = path.join(root, 'remotion/public/lanzhou-services-candidate-r1');
const video = path.join(episode, '07_预览与质检/candidate-preview-r1/render/with-sfx-960x540.mp4');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(out, `audio-audit.${name}.json`), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const commands = [];
function decode(p, rate = 16000, channels = 1) {
  const args = ['-hide_banner', '-v', 'error', '-i', p, '-map', '0:a:0', '-ac', String(channels), '-ar', String(rate), '-f', 'f32le', 'pipe:1'];
  const r = spawnSync('/opt/homebrew/bin/ffmpeg', args, {maxBuffer: 128 * 1024 * 1024});
  commands.push({tool: '/opt/homebrew/bin/ffmpeg', args, exitCode: r.status, stderr: r.stderr?.toString(), decodedBytes: r.stdout?.length,
    decodedPcmSha256: crypto.createHash('sha256').update(r.stdout ?? '').digest('hex')});
  assert.equal(r.status, 0, r.stderr?.toString());
  const a = new Float32Array(r.stdout.length / 4);
  for (let i = 0; i < a.length; i++) a[i] = r.stdout.readFloatLE(i * 4);
  return a;
}
const db = amplitude => amplitude > 0 ? 20 * Math.log10(amplitude) : -180;
function stats(a, rate, channels = 1) {
  let sum = 0, peak = 0;
  const frames = a.length / channels;
  const energy = new Float64Array(frames);
  for (let i = 0; i < a.length; i++) { const v = a[i]; sum += v * v; peak = Math.max(peak, Math.abs(v)); energy[Math.floor(i / channels)] += v * v; }
  let cumulative = 0, p05 = 0, p95 = frames - 1, found05 = false;
  for (let i = 0; i < frames; i++) {
    cumulative += energy[i];
    if (!found05 && cumulative >= sum * 0.05) { p05 = i; found05 = true; }
    if (cumulative >= sum * 0.95) { p95 = i; break; }
  }
  const hop = Math.round(rate * 0.01), window = Math.round(rate * 0.05);
  let maxRms = 0;
  for (let i = 0; i < frames; i += hop) { let e = 0; const n = Math.min(window, frames - i); for (let j = i; j < i + n; j++) e += energy[j]; maxRms = Math.max(maxRms, Math.sqrt(e / n / channels)); }
  return {durationSeconds: frames / rate, samplePeakDbfs: db(peak), rmsDbfs: db(Math.sqrt(sum / a.length)),
    max50msRmsDbfs: db(maxRms), energy05Seconds: p05 / rate, energy95Seconds: p95 / rate, energy90DurationSeconds: (p95 - p05 + 1) / rate};
}
const visualPath = path.join(root, 'remotion/src/lanzhou-services-v91-candidate-r1/visual-plan.v1.json');
const visual = read(visualPath);
const data = read(path.join(episode, '04_导演拆解/candidate-preview-r1/data.v1.json'));
const manifestPath = path.join(root, 'assets/sfx/koubo-sfx-v8/manifest.json');
const manifest = read(manifestPath);
assert.equal(hash(video), '9d6342ac4456f362406e3b0b4da00eeeb09812265fae02cf203d01740e69d2e4');
const mix = decode(video), host = decode(path.join(pub, 'R01.mp4')), news = decode(path.join(pub, 'U01.mp4'));
const rate = 16000;
const base = new Float32Array(mix.length);
for (let i = 0; i < base.length; i++) {
  const t = i / rate;
  base[i] = t < 69 / 30 ? (host[i] ?? 0) : t < 313 / 30 ? (news[i - Math.round(69 / 30 * rate)] ?? 0) * 0.62 : (host[i - Math.round(244 / 30 * rate)] ?? 0);
}
const current = {};
for (const name of ['card', 'tick']) {
  const p = path.join(pub, `sfx/${name}.wav`);
  const sha256 = hash(p);
  current[name] = {path: p, sha256, source: manifest.items.find(x => x.outputSha256 === sha256),
    native48kStereo: stats(decode(p, 48000, 2), 48000, 2), mono: decode(p)};
}
const sorted = [...visual.sfx].sort((a, b) => a.frame - b.frame);
const cueResults = [];
for (const cue of sorted) {
  const name = cue.publicPath.includes('card') ? 'card' : 'tick';
  const s = current[name].mono;
  const start = Math.round(cue.frame / 30 * rate);
  const length = Math.min(s.length, Math.round(Math.min(45, 8393 - cue.frame) / 30 * rate));
  const h = base.slice(start, start + length);
  const fx = s.slice(0, length);
  let hh = 0, hs = 0, ss = 0;
  for (let i = 0; i < length; i++) { hh += h[i] ** 2; hs += h[i] * fx[i]; ss += fx[i] ** 2; }
  const determinant = hh * ss - hs * hs;
  function fit(lag) {
    if (start + lag < 0 || start + lag + length > mix.length || determinant <= 0) return null;
    let yh = 0, ys = 0, yy = 0;
    for (let i = 0; i < length; i++) { const y = mix[start + lag + i]; yh += y * h[i]; ys += y * fx[i]; yy += y * y; }
    const a = (yh * ss - ys * hs) / determinant, b = (ys * hh - yh * hs) / determinant;
    return {lag, hostCoefficient: a, sfxCoefficient: b, r2ZeroMeanAssumption: yy ? (a * yh + b * ys) / yy : 0};
  }
  let best = null;
  const accept = x => { if (x && (!best || x.r2ZeroMeanAssumption > best.r2ZeroMeanAssumption)) best = x; };
  for (let lag = -8000; lag <= 8000; lag += 64) accept(fit(lag));
  const coarse = best.lag;
  for (let lag = coarse - 64; lag <= coarse + 64; lag += 4) accept(fit(lag));
  const fine = best.lag;
  for (let lag = fine - 4; lag <= fine + 4; lag++) accept(fit(lag));
  const hsStats = stats(h, rate), fxStats = stats(fx, rate), mixStats = stats(mix.slice(start + best.lag, start + best.lag + length), rate);
  const attenuation = db(cue.gain);
  const semantic = visual.semantic.find(x => x.id === cue.visualId) ?? visual.effects.find(x => x.id === cue.visualId);
  cueResults.push({id: cue.id, frame: cue.frame, seconds: cue.frame / 30, asset: name, gain: cue.gain,
    visualTitle: semantic?.title ?? semantic?.words ?? semantic?.effectId, sourceDurationSeconds: fx.length / rate,
    host: hsStats, sourceMono: fxStats, actualMix: mixStats,
    predictedSfxRmsDbfs: fxStats.rmsDbfs + attenuation,
    predictedSfxToHostRmsDb: fxStats.rmsDbfs + attenuation - hsStats.rmsDbfs,
    predictedSfxPeakDbfs: fxStats.samplePeakDbfs + attenuation,
    model: {...best, lagMilliseconds: best.lag / rate * 1000, sfxCoefficientRelativeToDeclaredGain: best.sfxCoefficient / cue.gain,
      note: '低电平AAC短脉冲与主声的联合拟合，只作数值存在性参考；不作独立听感判定。'},
    paperOverlap: data.papers.filter(p => cue.frame < p.outputStartFrame + p.durationInFrames && cue.frame + length / rate * 30 > p.outputStartFrame).map(p => p.id ?? p.sceneId)});
}
const candidates = [];
const selectedIds = ['v1-card-reveal', 'v1-keyword-tick', 'v1-node-connect', 'v1-section-air', 'v1-camera-shutter',
  'v3-soft-card-pop-b', 'v3-list-tick-b', 'v3-media-whoosh-b', 'v3-evidence-paper-a', 'v3-chapter-sweep-a', 'v3-line-connect-a', 'v3-number-settle-a'];
for (const id of selectedIds) {
  const item = manifest.items.find(x => x.id === id), p = path.join(root, item.output);
  assert.equal(hash(p), item.outputSha256);
  candidates.push({...item, native48kStereo: stats(decode(p, 48000, 2), 48000, 2),
    licenseReferenceSha256: hash(path.join(root, item.licenseReference)), currentOutputHashMatches: true,
    licenseStatus: '本地历史许可记录已读；未联网重新核实，不表示本条已获试听接纳。'});
}
const repeats = ['card', 'tick'].map(name => {
  const cues = cueResults.filter(c => c.asset === name), gaps = cues.slice(1).map((c, i) => c.seconds - cues[i].seconds);
  return {asset: name, count: cues.length, gapsUnder25Seconds: gaps.filter(x => x < 25).length, minimumGapSeconds: Math.min(...gaps)};
});
const consecutiveSameSource = sorted.slice(1).filter((c, i) => c.publicPath === sorted[i].publicPath).length;
const metrics = {schemaVersion: 'lanzhou-r2-audio-readonly-audit/v1', measuredAt: new Date().toISOString(),
  video: {path: video, sha256: hash(video)}, visualPlan: {path: visualPath, sha256: hash(visualPath)},
  baseline: {path: path.join(root, 'knowledge/20-V8连续语义动效与可感知音效基线.md'), sha256: hash(path.join(root, 'knowledge/20-V8连续语义动效与可感知音效基线.md'))},
  method: {fullMixAudioDecoded: true, analysisSampleRate: rate, nativeSourceStatsRate: 48000, nativeSourceStatsChannels: 2,
    outputPeakIsSamplePeakNotTruePeak: true, noEarListening: true, noNormalSpeedFullVisualWatchClaim: true,
    noNewAudioSynthesized: true, sourceGainsUnchanged: {host: 1, news: 0.62, paper: 0.1},
    relativeDbIsWindowMatchedUnweightedRmsNotPsychoacousticMaskingThreshold: true},
  mixFullMono: stats(mix, rate), declaredAttenuationDb: db(0.13),
  currentAssets: Object.fromEntries(Object.entries(current).map(([k, v]) => [k, {...v, mono: undefined}])),
  counts: {events: sorted.length, distinctSourceFiles: 2, repeatedSourceGaps: repeats, consecutiveSameSource},
  cueResults, candidateAssets: candidates, formalEnabled: false, userAudibilityConfirmed: false};
write('measurements', metrics);
write('commands', commands);
console.log(JSON.stringify({status: 'audio-audit-measured', currentAssets: metrics.currentAssets, repeats,
  opening: cueResults.slice(0, 5), candidates: candidates.map(c => ({id: c.id, ...c.native48kStereo}))}, null, 2));
