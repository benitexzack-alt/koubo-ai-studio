#!/usr/bin/env node
import {existsSync, linkSync, readFileSync, realpathSync, unlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File} from './preproduction-director-core.mjs';
import {NATIVE_PREPRODUCTION_ARTIFACTS, resolveNativeEvidence} from './v9-native-preproduction-core.mjs';
import {NATIVE_HANDOFF_FORMAT} from './v9-native-handoff-core.mjs';
import {
  V2_DIRECT_HANDOFF_FORMAT,
  V2_LEGACY_BRIDGE_ARTIFACT,
  validateV9ProductionState,
} from './v9-workflow-state-core.mjs';
import {validateDirectorCuesV2HandoffDirectory} from './director-cues-v2-handoff-core.mjs';
import {buildV2LegacyGenerationBridgeReceipt} from './v2-legacy-generation-bridge-core.mjs';

let createdBridgePath = null;
const createdTemporaryPaths = new Set();
let temporaryOutputCounter = 0;

function writeJsonAtomicExclusive(target, document, existsCode) {
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  const temporaryPath = path.join(
    path.dirname(target),
    `.${path.basename(target)}.tmp-${process.pid}-${Date.now()}-${temporaryOutputCounter++}`,
  );
  writeFileSync(temporaryPath, serialized, {flag: 'wx', mode: 0o600});
  createdTemporaryPaths.add(temporaryPath);
  if (readFileSync(temporaryPath, 'utf8') !== serialized) {
    throw new Error('V9_ATOMIC_OUTPUT_ROUNDTRIP_MISMATCH');
  }
  try {
    linkSync(temporaryPath, target);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(existsCode);
    throw error;
  }
  unlinkSync(temporaryPath);
  createdTemporaryPaths.delete(temporaryPath);
}

try {
  const args = {};
  for (let index = 2; index < process.argv.length; index += 2) args[process.argv[index].replace(/^--/, '')] = process.argv[index + 1];
  const root = path.resolve(args['repo-root']);
  const bind = (declared) => {
    const file = resolveNativeEvidence(root, declared);
    return {path: path.relative(realpathSync(root), file), sha256: sha256File(file)};
  };
  const read = (binding) => JSON.parse(readFileSync(path.resolve(root, binding.path), 'utf8'));
  if (!args.output) throw new Error('V9_STATE_OUTPUT_REQUIRED');
  const output = path.resolve(root, args.output);
  const outputParent = realpathSync(path.dirname(output));
  if (outputParent !== realpathSync(root) && !outputParent.startsWith(`${realpathSync(root)}${path.sep}`)) {
    throw new Error('V9_STATE_OUTPUT_OUTSIDE_PROJECT');
  }
  if (existsSync(output)) throw new Error('V9_STATE_OUTPUT_ALREADY_EXISTS');
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
  const directorProfileDocument = read(bind(request.directorProfile.path));
  const directorPlanningOutput = directorProfileDocument?.scopeBoundary?.directorPlanningOutput;
  const directorProfile = {
    profileId: request.directorProfile.profileId,
    profileVersion: request.directorProfile.profileVersion,
    ...(request.directorProfile.profileVersion === '9.1.0' ? {directorPlanningOutput} : {}),
  };
  Object.assign(state, {taskId: request.taskId, revisionId: request.revisionId, preproductionRequestId: request.requestId,
    directorProfile,
    currentStage: 'director-prompt-packs-ready'});
  state.stageHistory = [
    {stage: 'script-confirmed', completedAt: confirmation.recordedAt ?? confirmation.approvedAt,
      artifacts: {script: bind(request.inputScript.path), scriptUserConfirmation}},
    {stage: 'director-prompt-packs-ready', completedAt: new Date().toISOString(), artifacts: stageArtifacts},
  ];
  if (args['handoff-pack'] || args['director-v2-handoff']) {
    if (!args['director-v2-handoff']) throw new Error('V9_DIRECTOR_V2_HANDOFF_REQUIRED');
    const directorCuesHandoff = bind(args['director-v2-handoff']);
    const directorCuesHandoffDir = path.dirname(directorCuesHandoff.path);
    const handoffValidation = validateDirectorCuesV2HandoffDirectory({
      projectRoot: root,
      outputDir: directorCuesHandoffDir,
    });
    if (!handoffValidation.ok) {
      throw new Error(`V9_DIRECTOR_V2_HANDOFF_INVALID:${handoffValidation.errors.join('|')}`);
    }
    if (handoffValidation.masterSha256 !== directorCuesHandoff.sha256) {
      throw new Error('V9_DIRECTOR_V2_HANDOFF_BINDING_MISMATCH');
    }
    const directorCuesHandoffValidationReceipt = bind(handoffValidation.receiptPath);
    const handoff = read(directorCuesHandoff);
    const bindDeclared = (declared, code) => {
      if (!declared || typeof declared.path !== 'string' || typeof declared.sha256 !== 'string') {
        throw new Error(`${code}_BINDING_REQUIRED`);
      }
      const actual = bind(declared.path);
      if (actual.path !== declared.path || actual.sha256 !== declared.sha256) {
        throw new Error(`${code}_BINDING_MISMATCH`);
      }
      return actual;
    };
    const directorCues = bindDeclared(handoff?.source?.directorCues, 'V9_DIRECTOR_V2_CUES');
    const directorCuesUserApproval = bindDeclared(
      handoff?.source?.userApproval,
      'V9_DIRECTOR_V2_APPROVAL',
    );
    const generationArtifacts = {
      directorCues,
      directorCuesUserApproval,
      directorCuesHandoff,
      directorCuesHandoffValidationReceipt,
    };
    if (!args['handoff-pack']) {
      state.generationHandoffFormat = V2_DIRECT_HANDOFF_FORMAT;
      Object.assign(generationArtifacts, {
        generationInventory: directorCuesHandoff,
        generationOwnershipReceipt: directorCuesUserApproval,
      });
    } else {
      const generationInventory = bind(args['handoff-pack']);
      const pack = read(generationInventory);
      const generationOwnershipReceipt = bind(pack.userAcceptance.path);
      const bridgeDocument = buildV2LegacyGenerationBridgeReceipt({
        projectRoot: root,
        directorCuesHandoff,
        directorCuesHandoffValidationReceipt,
        generationInventory,
        generationOwnershipReceipt,
        firstFramePromptManifest: stageArtifacts.firstFramePromptManifest,
        imageToVideoPromptManifest: stageArtifacts.imageToVideoPromptManifest,
        aiVideoPromptManifest: stageArtifacts.aiVideoPromptManifest,
      });
      const bridgeOutput = path.resolve(root, args['bridge-receipt-output'] ??
        path.join(path.dirname(args.output), `${path.basename(args.output, path.extname(args.output))}.director-v2-legacy-bridge.v1.json`));
      if (bridgeOutput === output) throw new Error('V9_DIRECTOR_V2_BRIDGE_OUTPUT_CONFLICTS_WITH_STATE');
      const bridgeParent = realpathSync(path.dirname(bridgeOutput));
      if (bridgeParent !== realpathSync(root) && !bridgeParent.startsWith(`${realpathSync(root)}${path.sep}`)) {
        throw new Error('V9_DIRECTOR_V2_BRIDGE_OUTPUT_OUTSIDE_PROJECT');
      }
      if (existsSync(bridgeOutput)) throw new Error('V9_DIRECTOR_V2_BRIDGE_OUTPUT_ALREADY_EXISTS');
      writeJsonAtomicExclusive(
        bridgeOutput,
        bridgeDocument,
        'V9_DIRECTOR_V2_BRIDGE_OUTPUT_ALREADY_EXISTS',
      );
      createdBridgePath = bridgeOutput;
      state.generationHandoffFormat = NATIVE_HANDOFF_FORMAT;
      Object.assign(generationArtifacts, {
        generationInventory,
        generationOwnershipReceipt,
        [V2_LEGACY_BRIDGE_ARTIFACT]: bind(bridgeOutput),
      });
    }
    state.currentStage = 'generation-handoff-ready';
    state.stageHistory.push({stage: state.currentStage, completedAt: new Date().toISOString(),
      artifacts: generationArtifacts});
  }
  const result = validateV9ProductionState({state, projectRoot: root, verifyFiles: true});
  if (!result.ok) throw new Error(`V9_NATIVE_STATE_BUILD_BLOCKED:${result.errors.join('|')}`);
  writeJsonAtomicExclusive(output, state, 'V9_STATE_OUTPUT_ALREADY_EXISTS');
  createdBridgePath = null;
  console.log(JSON.stringify({ok: true, outputPath: output, ...result}));
} catch (error) {
  for (const temporaryPath of createdTemporaryPaths) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  if (createdBridgePath && existsSync(createdBridgePath)) unlinkSync(createdBridgePath);
  console.error(error.message);
  process.exitCode = 1;
}
