import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const output = path.dirname(fileURLToPath(import.meta.url));
const source = path.dirname(output);
const cache = '/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo';
const snapshot = path.join(cache, 'snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const protectedFiles = fs.readdirSync(source, {withFileTypes: true})
  .filter((entry) => entry.isFile()).map((entry) => path.join(source, entry.name));
const before = protectedFiles.map((file) => ({path: file, sha256: sha(file)}));
const candidates = [
  '/Users/pc/.local/share/uv/tools/hermes-agent/bin/python',
  '/Users/pc/.agents/skills/video-use/.venv/bin/python',
  '/Users/pc/.cache/ai-daihuo-funasr-venv/bin/python',
  '/Users/pc/.venv-html-to-docx/bin/python',
  '/opt/homebrew/bin/python3',
];
const probe = [
  'import sys, json, importlib.util',
  'names = ["mlx_whisper", "mlx"]',
  'specs = {name: importlib.util.find_spec(name) for name in names}',
  'print(json.dumps({"python": sys.executable, "version": sys.version, "packages": {name: {"found": spec is not None, "origin": None if spec is None else spec.origin, "locations": [] if spec is None else list(spec.submodule_search_locations or [])} for name, spec in specs.items()}}))',
].join('\n');
const checks = candidates.map((python) => {
  const result = spawnSync(python, ['-B', '-c', probe], {
    encoding: 'utf8', timeout: 15000,
    env: {...process.env, PYTHONDONTWRITEBYTECODE: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1'},
  });
  return {
    requestedPython: python, exitCode: result.status,
    error: result.error?.code ?? null,
    result: result.status === 0 ? JSON.parse(result.stdout) : null,
    stderr: result.stderr ?? '',
  };
});
if (checks.some((check) => check.result?.packages.mlx_whisper.found)) {
  throw new Error('发现运行库，不能生成缺失报告；应继续真实离线识别。');
}
const audio = path.join(source, 'R01_16k_mono.wav');
const ffprobe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels,codec_name', '-of', 'json', audio], {encoding: 'utf8'});
if (ffprobe.status !== 0) throw new Error(ffprobe.stderr);
const metadata = JSON.parse(ffprobe.stdout);
const draftPath = path.join(source, '中英字幕准备稿_待复听.v2.json');
const issuePath = path.join(source, '字幕专名修正与待听清单.v2.json');
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
const issues = JSON.parse(fs.readFileSync(issuePath, 'utf8'));
const after = before.map((entry) => ({...entry, sha256After: sha(entry.path), unchanged: sha(entry.path) === entry.sha256}));
const report = {
  schemaVersion: 'offline-asr-runtime-check/v1',
  checkedAt: new Date().toISOString(),
  status: 'blocked-runtime-not-found-in-bounded-search',
  scope: '仅证明下列有限已查路径未找到运行库，不声称本机绝无其他环境。',
  checks,
  additionalReadOnlySearches: [
    {root: '/Users/pc/.cache/uv/environments-v2', maxDepth: 8, followedSymlinks: true, target: 'mlx_whisper', matches: 0},
    {root: '/Users/pc/.cache/uv/archive-v0', maxDepth: 2, followedSymlinks: true, target: 'mlx_whisper 或 mlx_whisper-*.dist-info', matches: 0},
    {root: '/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies', maxDepth: 8, target: 'mlx_whisper', matches: 0},
  ],
  model: {
    cache, snapshot,
    files: ['config.json', 'weights.safetensors'].map((name) => {
      const file = path.join(snapshot, name);
      return {path: file, resolvedPath: fs.realpathSync(file), bytes: fs.statSync(file).size, sha256: sha(file)};
    }),
    modelLoadAttempted: false,
    inferenceStarted: false,
  },
  audio: {path: audio, sha256: sha(audio), ffprobe: metadata, statedDurationSeconds: 261.933, measuredDurationSeconds: Number(metadata.format.duration)},
  inputProtection: {allUnchangedAcrossProbe: after.every((entry) => entry.unchanged), files: after},
  evidenceBoundary: {
    humanListeningPerformed: false, assistantAudioPerceptionAvailable: false,
    rawAsrProduced: false, pageDifferenceAvailable: false,
    uncertainPageCount: issues.unresolved.length, draftPageCount: draft.captions.length,
    originalV2Modified: false, scriptProvidedToAsr: false,
    downloadPerformed: false, uploadPerformed: false, apiCalled: false,
    dependencyInstalled: false, gitCommitPerformed: false,
  },
};
const unresolved = {
  schemaVersion: 'offline-asr-unresolved-handoff/v1',
  status: 'uncertain',
  sourcePath: issuePath, sourceSha256: sha(issuePath),
  draftPath, draftSha256: sha(draftPath),
  timeline: '原 v2 的剪后毫秒时间；未映射为新 ASR 时间。',
  newAsrResult: null, humanListeningPerformed: false,
  pages: issues.unresolved.map((issue) => ({
    ...issue, status: 'uncertain', newAsrCandidate: null,
    recommendation: '保留原疑点；取得本地强模型真实输出或人耳确认后再裁决，英文继续暂缓，不按上下文猜补。',
  })),
};
for (const [name, data] of [['环境与输入核查.json', report], ['21页疑点保留_无新增ASR证据.json', unresolved]]) {
  fs.writeFileSync(path.join(output, name), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
}
console.log(JSON.stringify({status: report.status, durationSeconds: report.audio.measuredDurationSeconds, uncertainPageCount: unresolved.pages.length, inputFilesUnchanged: report.inputProtection.allUnchangedAcrossProbe, output}, null, 2));
