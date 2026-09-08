#!/usr/bin/env node
import {readFileSync, realpathSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File} from './preproduction-director-core.mjs';
import {NATIVE_PREPRODUCTION_ARTIFACTS, resolveNativeEvidence} from './v9-native-preproduction-core.mjs';
import {validateV9ProductionState} from './v9-workflow-state-core.mjs';
import {NATIVE_HANDOFF_FORMAT} from './v9-native-handoff-core.mjs';

try {
  const args = {};
  for (let index = 2; index < process.argv.length; index += 2) args[process.argv[index].replace(/^--/, '')] = process.argv[index + 1];
  const root = path.resolve(args['repo-root']);
  const bind = (declared) => {
    const file = resolveNativeEvidence(root, declared);
    return {path: path.relative(realpathSync(root), file), sha256: sha256File(file)};
  };
  const read = (binding) => JSON.parse(readFileSync(path.resolve(root, binding.path), 'utf8'));
  const directorRequest = bind(args.request);
  const request = read(directorRequest);
  const scriptUserConfirmation = bind(args['script-confirmation']);
  const confirmation = read(scriptUserConfirmation);
  const stageArtifacts = {directorRequest};
  for (const [key, contract] of Object.entries(NATIVE_PREPRODUCTION_ARTIFACTS)) {
    if (contract.output) stageArtifacts[key] = bind(request.outputs[contract.output]);
  }
  const templatePath = fileURLToPath(new URL('../templates/v9-production-state.v1.json', import.meta.url));
  const state = JSON.parse(readFileSync(templatePath, 'utf8'));
  Object.assign(state, {taskId: request.taskId, revisionId: request.revisionId, preproductionRequestId: request.requestId,
    directorProfile: {profileId: request.directorProfile.profileId, profileVersion: request.directorProfile.profileVersion},
    currentStage: 'director-prompt-packs-ready'});
  state.stageHistory = [
    {stage: 'script-confirmed', completedAt: confirmation.recordedAt ?? confirmation.approvedAt,
      artifacts: {script: bind(request.inputScript.path), scriptUserConfirmation}},
    {stage: 'director-prompt-packs-ready', completedAt: new Date().toISOString(), artifacts: stageArtifacts},
  ];
  if (args['handoff-pack']) {
    const generationInventory = bind(args['handoff-pack']);
    const pack = read(generationInventory);
    state.generationHandoffFormat = NATIVE_HANDOFF_FORMAT;
    state.currentStage = 'generation-handoff-ready';
    state.stageHistory.push({stage: state.currentStage, completedAt: new Date().toISOString(),
      artifacts: {generationInventory, generationOwnershipReceipt: bind(pack.userAcceptance.path)}});
  }
  const result = validateV9ProductionState({state, projectRoot: root, verifyFiles: true});
  if (!result.ok) throw new Error(`V9_NATIVE_STATE_BUILD_BLOCKED:${result.errors.join('|')}`);
  if (!args.output) throw new Error('V9_STATE_OUTPUT_REQUIRED');
  const output = path.resolve(root, args.output);
  const parent = realpathSync(path.dirname(output));
  if (parent !== realpathSync(root) && !parent.startsWith(`${realpathSync(root)}${path.sep}`)) throw new Error('V9_STATE_OUTPUT_OUTSIDE_PROJECT');
  writeFileSync(output, `${JSON.stringify(state, null, 2)}\n`, {flag: 'wx', mode: 0o600});
  console.log(JSON.stringify({ok: true, outputPath: output, ...result}));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
