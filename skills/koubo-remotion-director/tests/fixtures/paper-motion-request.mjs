import {renderMotionAction, renderMotionPrompt, renderMotionFirstFrame, paperMechanismSnapshot} from '../../scripts/paper-motion-contract.mjs';
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {sha256Json, sha256File} from '../../scripts/preproduction-director-core.mjs';

export function bindSemanticReview(request, root) {
  for (const beat of request.beats.filter((beat) => beat.paperScene)) {
    const file = path.join(root, `synthetic-mechanism-review-${beat.id}.json`);
    const review = {schemaVersion: 'koubo-paper-mechanism-review/v1', status: 'reviewed-mechanism',
      taskId: request.taskId, revisionId: request.revisionId, beatId: beat.id,
      sourceScriptSha256: request.inputScript.sha256, sourceQuote: beat.spokenLine,
      mechanismSha256: sha256Json(paperMechanismSnapshot(beat.paperScene)),
      authorId: 'synthetic-test-author', reviewerId: 'synthetic-test-reviewer',
      reviewedAt: '2026-09-08T00:00:00Z', findings: [], semanticRationale: '仅用于隔离回归的明确测试证据，不是真实媒体或用户验收。',
      generationAuthorized: false, formalAuthorized: false};
    mkdirSync(root, {recursive: true});
    writeFileSync(file, `${JSON.stringify(review, null, 2)}\n`);
    beat.paperScene.motionContract.semanticReview = {path: file, sha256: sha256File(file)};
  }
  return request;
}

// Derive an isolated test case from the immutable incident request, never rewrite the episode.
export function makeIncidentMotionRequest(source) {
  const request = structuredClone(source);
  request.requestId = 'incident-motion-local-contract-test';
  request.revisionId = 'incident-motion-local-contract-r1';
  request.policy.incidentPreventionVersion = '1';
  request.policy.physicalContinuityVersion = '1';
  request.beats = [request.beats.find((beat) => beat.id === 'B11')];
  const beat = request.beats[0];
  beat.order = 1;
  const scene = beat.paperScene;
  scene.textPlan.forEach((label) => {
    label.enterStageId = 'initial';
    label.persistence = 'initial-to-end';
    label.firstReadableFrame = 0;
  });
  scene.motionContract = {
    schemaVersion: 'koubo-paper-motion-contract/v1',
    meaning: {
      sourceQuote: beat.spokenLine,
      viewerTakeaway: '先分清资料版本，只将筛过的合适资料送入知识库。',
      excludedOutcomes: ['作废资料进入知识库', '全部资料无筛选入库'],
    },
    parts: [
      ...scene.textPlan.map((label) => ({id: `${label.groupId}-label`, name: `${label.text}固定纸牌`,
        kind: 'label', groupId: label.groupId, surfaceId: label.surfaceId, mount: 'independent-fixed-stand'})),
      {id: 'valid-pages', name: '已筛选的无字有效纸页', kind: 'blank-part', groupId: 'G2'},
      {id: 'obsolete-pages', name: '灰盒内的无字作废纸页', kind: 'blank-part', groupId: 'G3'},
    ],
    initialLocations: [{partId: 'valid-pages', groupId: 'G2'}, {partId: 'obsolete-pages', groupId: 'G3'}],
    allowedTransfers: [{partId: 'valid-pages', fromGroupId: 'G2', toGroupId: 'G4'}],
    forbiddenTransfers: [{partId: 'obsolete-pages', fromGroupId: 'G3', toGroupId: 'G4', sourceQuote: beat.spokenLine}],
    requiredPredecessors: [],
    actions: [{id: 'A1', stageId: 'S1', partId: 'valid-pages', operation: 'slide',
      fromGroupId: 'G2', toGroupId: 'G4', startSeconds: 1, endSeconds: 5,
      sweptRect: {x: 0.36, y: 0.36, width: 0.48, height: 0.16}}],
    finalLocations: [{partId: 'valid-pages', groupId: 'G4'}, {partId: 'obsolete-pages', groupId: 'G3'}],
    dynamicValidation: {requiredBeforeBatch: true, staticApprovalIsNotDynamicApproval: true, automaticRetryAllowed: false},
  };
  scene.stages = [{id: 'S1', order: 1, subject: 'G2', landingNodeIds: [], sfxRole: 'paper-slide',
    action: renderMotionAction(scene, scene.motionContract.actions[0])}];
  // Synthetic tabletop dimensions for offline regression, never image measurements.
  scene.motionContract.physicalContract = {
    schemaVersion: 'koubo-paper-physical-contract/v1', coordinateSystem: 'tabletop-mm', minimumClearanceMm: 2,
    inventory: ['valid-pages', 'obsolete-pages'].map((partId) => ({partId, quantity: 1,
      unit: 'rigid-assembly', envelopeMm: {width: 40, depth: 20, height: 4}})),
    stations: scene.objectGroups.map((group) => ({groupId: group.id,
      initialPartIds: scene.motionContract.initialLocations.filter((item) => item.groupId === group.id).map((item) => item.partId)})),
    docks: [{id: 'valid-from', groupId: 'G2', xMm: 100, yMm: 100, supportHeightMm: 20, openingWidthMm: 30, openingHeightMm: 10},
      {id: 'valid-to', groupId: 'G4', xMm: 300, yMm: 100, supportHeightMm: 20, openingWidthMm: 30, openingHeightMm: 10}],
    supports: [{id: 'valid-lane', xMm: 75, yMm: 85, widthMm: 250, depthMm: 30, topHeightMm: 20}],
    obstacles: [{id: 'obsolete-isolated-box', xMm: 190, yMm: 170, zMm: 20, widthMm: 40, depthMm: 30, heightMm: 25}],
    transfers: [{actionId: 'A1', fromDockId: 'valid-from', toDockId: 'valid-to', supportIds: ['valid-lane']}],
  };
  scene.prompt.firstFrame = renderMotionFirstFrame(scene);
  scene.prompt.motion = renderMotionPrompt(scene);
  return request;
}
