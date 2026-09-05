import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const skillRoot = path.resolve(import.meta.dirname, '..');
const matcherCli = path.join(skillRoot, 'scripts/match-director-effects.mjs');
const recorderCli = path.join(skillRoot, 'scripts/record-experience.mjs');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (filePath) => readFileSync(filePath);
const binding = (root, relativePath) => ({path: relativePath, sha256: sha(read(path.join(root, relativePath)))});
const writeJson = (filePath, value) => writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

function runCli(script, args, root) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function prepareProject() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'shotcraft-v91-cli-'));
  const files = [
    'registry.v1.json',
    'card-capability-index.v2.json',
    'assets/ShotcraftEffects.tsx',
    'experience/shotcraft-acceptance-ledger.v1.json',
    'upstream/gallery/api/library.json',
  ];
  for (const relative of files) {
    const target = path.join(root, 'skills/koubo-shotcraft-library', relative);
    mkdirSync(path.dirname(target), {recursive: true});
    copyFileSync(path.join(skillRoot, relative), target);
  }
  mkdirSync(path.join(root, 'edit/test'), {recursive: true});
  mkdirSync(path.join(root, 'outputs'), {recursive: true});
  return root;
}

function requestFor(root, {taskId, revisionId}) {
  const captions = [{startMs: 0, endMs: 6000, zh: '第一看门店数据，第二看库存，第三看同行活动。'}];
  const captionsPath = 'edit/test/actual-captions.json';
  if (taskId === 'task-cli-1') writeJson(path.join(root, captionsPath), captions);
  return {
    schemaVersion: 'koubo-shotcraft-auto-match-request/v1',
    taskId,
    revisionId,
    directorProfile: {profileId: 'paper-editorial-director-v9', profileVersion: '9.1.0'},
    subtitleAuthority: 'actual-recording',
    registry: binding(root, 'skills/koubo-shotcraft-library/registry.v1.json'),
    library: binding(root, 'skills/koubo-shotcraft-library/upstream/gallery/api/library.json'),
    capabilityIndex: binding(root, 'skills/koubo-shotcraft-library/card-capability-index.v2.json'),
    experienceLedger: binding(root, 'skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json'),
    componentModule: binding(root, 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx'),
    captions: binding(root, captionsPath),
    canvas: {width: 1920, height: 1080, fps: 30, durationInFrames: 180},
    beats: [{
      beatId: 'beat-list',
      mainVisual: 'speaker',
      frames: {startFrame: 0, endFrameExclusive: 180},
      quote: '第一看门店数据，第二看库存，第三看同行活动。',
      purpose: '逐项呈现每天要检查的三类信息',
      semanticIntents: ['list', 'process'],
      materialClass: 'talking-head',
      energy: 'medium',
      existingVisualSufficiency: 'low',
      keyPhrases: ['门店数据', '库存', '同行活动'],
      region: {x: 60, y: 140, width: 620, height: 360},
      protectedRegions: [
        {x: 800, y: 0, width: 900, height: 850},
        {x: 0, y: 900, width: 1920, height: 180},
      ],
    }],
  };
}

test('CLI完成全157卡匹配、验收入账和下次精确复用', () => {
  const root = prepareProject();
  try {
    const request1Path = path.join(root, 'edit/test/request-r1.json');
    writeJson(request1Path, requestFor(root, {taskId: 'task-cli-1', revisionId: 'candidate-r1'}));
    const first = runCli(matcherCli, [
      '--request', 'edit/test/request-r1.json',
      '--selection', 'edit/test/selection-r1.json',
      '--receipt', 'edit/test/match-r1.json',
      '--lookup', 'edit/test/lookup-r1.json',
      '--repo-root', root,
    ], root);
    assert.equal(first.analyzedCardCount, 157);
    const selectionPath = path.join(root, 'edit/test/selection-r1.json');
    const selection = JSON.parse(read(selectionPath));
    assert.equal(selection.beats[0].effectId, 'keyword-reveal');
    assert.equal(selection.beats[0].matchContext.origin, 'catalog-match');

    const candidatePath = path.join(root, 'outputs/candidate-r1.mp4');
    writeFileSync(candidatePath, Buffer.from('reviewed-candidate-fixture'));
    const component = binding(root, 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx');
    const applicationPath = path.join(root, 'edit/test/application-r1.json');
    writeJson(applicationPath, {
      schemaVersion: 'koubo-shotcraft-application-receipt/v1',
      taskId: 'task-cli-1',
      revisionId: 'candidate-r1',
      selection: {path: 'edit/test/selection-r1.json', sha256: sha(read(selectionPath))},
      output: {path: 'outputs/candidate-r1.mp4', sha256: sha(read(candidatePath))},
      applications: [{
        beatId: 'beat-list',
        effectId: 'keyword-reveal',
        frames: {startFrame: 0, endFrameExclusive: 180},
        component: {name: 'KeywordReveal', ...component},
        outputSha256: sha(read(candidatePath)),
        finalWorking: true,
      }],
    });
    const quote = '通过，这个逐项呈现和口播对得上。';
    const decisionPath = path.join(root, 'edit/test/decision-r1.json');
    writeJson(decisionPath, {
      schemaVersion: 'koubo-shotcraft-experience-decision/v1',
      taskId: 'task-cli-1',
      revisionId: 'candidate-r1',
      selection: {path: 'edit/test/selection-r1.json', sha256: sha(read(selectionPath))},
      applicationReceipt: {path: 'edit/test/application-r1.json', sha256: sha(read(applicationPath))},
      candidate: {path: 'outputs/candidate-r1.mp4', sha256: sha(read(candidatePath))},
      userEvidence: {source: 'direct-user-message', quote, quoteSha256: sha(Buffer.from(quote)), recordedAt: '2026-09-05T12:00:00+08:00'},
      beatDecisions: [{beatId: 'beat-list', outcome: 'accepted', reason: '用户完整观看后确认语义和动效匹配'}],
    });
    const recorded = runCli(recorderCli, [
      '--decision', 'edit/test/decision-r1.json',
      '--receipt', 'edit/test/experience-write-r1.json',
      '--repo-root', root,
    ], root);
    assert.equal(recorded.addedCaseCount, 1);
    assert.equal(recorded.reusablePatternCount, 0);

    const request2Path = path.join(root, 'edit/test/request-r2.json');
    writeJson(request2Path, requestFor(root, {taskId: 'task-cli-2', revisionId: 'candidate-r2'}));
    runCli(matcherCli, [
      '--request', 'edit/test/request-r2.json',
      '--selection', 'edit/test/selection-r2.json',
      '--receipt', 'edit/test/match-r2.json',
      '--lookup', 'edit/test/lookup-r2.json',
      '--repo-root', root,
    ], root);
    const selection2 = JSON.parse(read(path.join(root, 'edit/test/selection-r2.json')));
    assert.equal(selection2.beats[0].effectId, 'keyword-reveal');
    assert.equal(selection2.beats[0].matchContext.origin, 'validated-case');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
