import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File} from '../../scripts/preproduction-director-core.mjs';
import {bindSemanticReview, makeIncidentMotionRequest} from './paper-motion-request.mjs';
import {renderMotionAction, renderMotionPrompt} from '../../scripts/paper-motion-contract.mjs';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const runDirectorCli = (name, root, args) => spawnSync(process.execPath, [
  path.join(repositoryRoot, 'skills/koubo-remotion-director/scripts', name), '--repo-root', root, ...args,
], {encoding: 'utf8'});

export function createNativePreproductionFixture(root, {twoScenes = false} = {}) {
  const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
  const write = (relative, body) => {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), {recursive: true});
    writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  };
  const source = read(path.join(repositoryRoot,
    'edit/20260906_lanzhou_ai_services/04_导演拆解/v9.1-r2/director-preproduction-request.v1.json'));
  const request = makeIncidentMotionRequest(source);
  request.taskId = 'native-v9-offline-fixture';
  request.requestId = 'native-v9-offline-request-r1';
  request.revisionId = 'native-v9-offline-candidate-r1';
  if (twoScenes) {
    const next = structuredClone(request.beats[0]);
    next.id = 'B12';
    next.order = 2;
    next.paperScene.motionContract.actions[0].endSeconds = 4.5;
    next.paperScene.stages[0].action = renderMotionAction(next.paperScene, next.paperScene.motionContract.actions[0]);
    next.paperScene.prompt.motion = renderMotionPrompt(next.paperScene);
    request.beats.push(next);
  }
  writeFileSync(path.join(root, 'script.md'), readFileSync(path.resolve(repositoryRoot, source.inputScript.path)));
  request.inputScript.path = 'script.md';
  request.directorProfile.path = 'profile.json';
  for (const key of Object.keys(request.outputs)) {
    request.outputs[key] = `native/${key}.${key.endsWith('SheetPath') ? 'md' : 'json'}`;
  }
  const profile = read(path.join(repositoryRoot, 'workflow/active-director-profile.v1.json'));
  const style = read(path.resolve(repositoryRoot, profile.style.path));
  profile.style.path = 'style.json';
  profile.incidentPreventionPolicy = {...profile.incidentPreventionPolicy, requiredForNewPreproduction: true};
  write('profile.json', profile);
  write('style.json', style);
  bindSemanticReview(request, root);
  write('request.json', request);
  for (const name of ['compile-preproduction-director.mjs', 'validate-preproduction-director.mjs']) {
    const result = runDirectorCli(name, root, ['--request', 'request.json']);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  }
  const binding = (relative) => ({path: relative, sha256: sha256File(path.join(root, relative))});
  const revisionId = request.revisionId;
  write('confirmation.json', {
    schemaVersion: 'koubo-pre-shoot-user-confirmation/v1', taskId: request.taskId, revisionId,
    approved: true, authority: 'direct-user-message', recordedAt: '2026-09-08T10:00:00+08:00',
    quote: '离线输入夹具，不构成现实用户授权。', script: binding('script.md'),
    scope: '预拍导演准备', formalAuthorized: false, externalGenerationAuthorized: false,
  });
  const state = read(path.join(repositoryRoot, 'skills/koubo-remotion-director/templates/v9-production-state.v1.json'));
  Object.assign(state, {taskId: request.taskId, revisionId, preproductionRequestId: request.requestId,
    currentStage: 'director-prompt-packs-ready'});
  state.stageHistory = [{stage: 'script-confirmed', completedAt: '2026-09-08T10:00:00+08:00',
    artifacts: {script: binding('script.md'), scriptUserConfirmation: binding('confirmation.json')}},
  {stage: 'director-prompt-packs-ready', completedAt: '2026-09-08T10:01:00+08:00', artifacts: {
    directorRequest: binding('request.json'), directorPlan: binding(request.outputs.planPath),
    directorValidation: binding(request.outputs.validationReceiptPath),
    firstFramePromptManifest: binding(request.outputs.firstFramePromptManifestPath),
    imageToVideoPromptManifest: binding(request.outputs.runningHubPromptManifestPath),
    aiVideoPromptManifest: binding(request.outputs.aiGeneratedVideoPromptManifestPath),
    directorRouteLock: binding(request.outputs.routeLockPath),
    directorCompileReceipt: binding(request.outputs.compileReceiptPath),
  }}];
  const artifacts = Object.assign({}, ...state.stageHistory.map((item) => item.artifacts));
  return {state, request, artifacts, read, write};
}
