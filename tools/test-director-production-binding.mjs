#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertDirectorProductionBinding,
  validateAiNoNewBusinessModelPreshootBinding,
} from './director-production-binding-core.mjs';
import {sha256File} from './director-skill-lock-core.mjs';
import {SCOPED_DIRECT_EXPORT_AI_NO_NEW_BUSINESS_MODEL} from './scoped-direct-export-core.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-director-production-test-'));
try {
  mkdirSync(path.join(root, 'workflow'), {recursive: true});
  writeFileSync(
    path.join(root, 'workflow/active-director-profile.v1.json'),
    JSON.stringify({
      profileId: 'paper-editorial-director-v3',
      profileVersion: '3.0.0',
      status: 'active-default',
      effectiveFrom: '2026-09-01',
      routingPolicy: {fallback: 'blocked'},
      skill: {path: 'skills/koubo-remotion-director', lockPath: 'workflow/lock.json'},
    }),
  );
  const artifactsRoot = path.join(root, 'artifacts');
  mkdirSync(artifactsRoot, {recursive: true});
  const writeArtifact = (name, value) => {
    const filePath = path.join(artifactsRoot, `${name}.json`);
    writeFileSync(filePath, JSON.stringify(value));
    return {path: filePath, sha256: sha256File(filePath)};
  };
  const taskId = 'task-20260901-paper';
  const artifacts = {
    preproductionRequest: writeArtifact('pre-request', {taskId}),
    routeLock: writeArtifact('route', {
      taskId,
      branch: 'paper-editorial',
      fallback: 'blocked',
      genericInformationCardCanSatisfyPaperBeat: false,
    }),
    preproductionPlan: writeArtifact('pre-plan', {
      taskId,
      paperScenes: [{beatId: 'B01'}],
    }),
    preproductionValidation: writeArtifact('pre-validation', {taskId, skillExecuted: true}),
    postshootRequest: writeArtifact('post-request', {taskId}),
    postshootPlan: writeArtifact('post-plan', {
      taskId,
      spokenAuthority: 'recorded-audio',
      scriptRole: 'comparison-only',
    }),
    postshootValidation: writeArtifact('post-validation', {taskId, skillExecuted: true}),
  };
  const job = {
    jobId: '20260901-paper-test-v80',
    director: {
      required: true,
      taskId,
      profileId: 'paper-editorial-director-v3',
      profileVersion: '3.0.0',
      phase: 'post-shoot',
      paperRequired: true,
      fallback: 'blocked',
      artifacts,
    },
  };
  const preview = assertDirectorProductionBinding({
    projectRoot: root,
    job,
    command: 'preview',
    skipSkillLock: true,
  });
  assert.equal(preview.status, 'candidate-entry-director-bound');

  let formalError;
  try {
    assertDirectorProductionBinding({
      projectRoot: root,
      job,
      command: 'formal',
      skipSkillLock: true,
    });
  } catch (error) {
    formalError = error;
  }
  assert.ok(formalError);
  assert.ok(
    formalError.errors.includes('DIRECTOR_PRODUCTION_ARTIFACT_MISSING:currentTaskUserAcceptance'),
  );

  job.director.currentTaskUserAcceptance = writeArtifact('acceptance', {
    taskId,
    status: 'user-accepted-current-task-preview',
    userAccepted: true,
  });
  const formal = assertDirectorProductionBinding({
    projectRoot: root,
    job,
    command: 'formal',
    skipSkillLock: true,
  });
  assert.equal(formal.status, 'formal-entry-director-bound');

  const generic = structuredClone(job);
  const routePath = generic.director.artifacts.routeLock.path;
  writeFileSync(
    routePath,
    JSON.stringify({
      taskId,
      branch: 'paper-editorial',
      fallback: 'blocked',
      genericInformationCardCanSatisfyPaperBeat: true,
    }),
  );
  generic.director.artifacts.routeLock.sha256 = sha256File(routePath);
  assert.throws(
    () =>
      assertDirectorProductionBinding({
        projectRoot: root,
        job: generic,
        command: 'preview',
        skipSkillLock: true,
      }),
    /DIRECTOR_PRODUCTION_GENERIC_CARD_ALLOWED/,
  );

  const currentTaskId = '20260912_ai_no_new_business_model_director_v2_r3';
  const currentRevisionId = 'director-core-r3-edit-release-r1';
  const currentPaths = SCOPED_DIRECT_EXPORT_AI_NO_NEW_BUSINESS_MODEL.preshootArtifacts;
  const currentArtifacts = {
    preproductionRequest: {path: currentPaths.preproductionRequest, sha256: '1'.repeat(64)},
    preproductionPlan: {path: currentPaths.preproductionPlan, sha256: '2'.repeat(64)},
    routeLock: {path: currentPaths.routeLock, sha256: '3'.repeat(64)},
    preproductionValidation: {
      path: currentPaths.preproductionValidation,
      sha256: '4'.repeat(64),
    },
  };
  const routeCounts = {
    speaker: 19,
    'real-evidence': 6,
    'ai-generated-video': 2,
    'paper-editorial': 7,
  };
  let beatNumber = 0;
  const semanticBeats = Object.entries(routeCounts).flatMap(([primaryRoute, count]) =>
    Array.from({length: count}, () => ({
      id: `B${String(++beatNumber).padStart(2, '0')}`,
      primaryRoute,
    })),
  );
  const currentDocuments = {
    cues: {
      schemaVersion: 'koubo-director-cues/v2',
      taskId: currentTaskId,
      status: 'ready-for-user-review',
      executionScope: 'director-only',
      semanticBeats,
      selectionSummary: {routeCounts},
    },
    approval: {
      schemaVersion: 'koubo-director-cues-user-approval/v2',
      status: 'approved',
      taskId: currentTaskId,
      revisionId: currentRevisionId,
      approved: true,
      bindings: {directorCues: currentArtifacts.preproductionRequest},
      authorizationScope: {
        allowed: [
          'local-offline-transcription-and-actual-speech-timeline-binding',
          'complete-single-video-full-retention-edit',
          'scan-full-shotcraft-library-for-speaker-and-real-evidence-beats',
          'apply-semantically-relevant-remotion-shotcraft-effects',
          'build-chinese-captions-from-actual-speech',
          'translate-english-captions-from-confirmed-actual-chinese',
          'design-and-mix-local-traceable-sound-effects',
          'render-full-review-candidate-and-complete-candidate-package',
          'run-local-machine-quality-checks',
        ],
        forbidden: ['publish-to-douyin-or-any-external-platform'],
        finalUserVisualAcceptance: 'pending',
      },
    },
    handoff: {
      schemaVersion: 'koubo-director-cues-v2-handoff/v1',
      taskId: currentTaskId,
      revisionId: currentRevisionId,
      status: 'local-handoff-ready',
      executionScope: 'local-handoff-only',
      source: {
        directorCues: currentArtifacts.preproductionRequest,
        userApproval: currentArtifacts.preproductionPlan,
      },
      routeMappings: Object.entries(routeCounts).map(([sourceRoute, beatCount]) => ({
        sourceRoute,
        downstreamRoute: sourceRoute === 'ai-generated-video' ? 'generated-video' : sourceRoute,
        beatCount,
      })),
      externalActionsAuthorized: false,
      generationAuthorized: false,
      remotionAuthorized: false,
      publicationAuthorized: false,
    },
    validation: {
      schemaVersion: 'koubo-director-cues-v2-handoff-validation-receipt/v1',
      taskId: currentTaskId,
      revisionId: currentRevisionId,
      status: 'validated-local-handoff',
      skillExecuted: true,
      validatorExecuted: true,
      source: {
        directorCues: currentArtifacts.preproductionRequest,
        userApproval: currentArtifacts.preproductionPlan,
      },
      handoffMaster: currentArtifacts.routeLock,
      externalActionsAuthorized: false,
      generationAuthorized: false,
    },
  };
  const validateCurrent = (documents = currentDocuments, artifacts = currentArtifacts) =>
    validateAiNoNewBusinessModelPreshootBinding({
      director: {taskId: currentTaskId},
      artifacts,
      bound: {
        preRequest: {
          value: documents.cues,
          sha256: artifacts.preproductionRequest.sha256,
        },
        prePlan: {value: documents.approval, sha256: artifacts.preproductionPlan.sha256},
        routeLock: {value: documents.handoff, sha256: artifacts.routeLock.sha256},
        preValidation: {
          value: documents.validation,
          sha256: artifacts.preproductionValidation.sha256,
        },
      },
    });

  const currentPositive = validateCurrent();
  assert.equal(currentPositive.ok, true);
  assert.equal(currentPositive.paperSceneCount, 7);

  const missingBeat = structuredClone(currentDocuments);
  missingBeat.cues.semanticBeats.pop();
  assert.ok(
    validateCurrent(missingBeat).errors.includes(
      'DIRECTOR_PRODUCTION_CURRENT_CUES_BEAT_COUNT_INVALID',
    ),
  );

  const approvalBindingTamper = structuredClone(currentDocuments);
  approvalBindingTamper.approval.bindings.directorCues.sha256 = 'f'.repeat(64);
  assert.ok(
    validateCurrent(approvalBindingTamper).errors.includes(
      'DIRECTOR_PRODUCTION_CURRENT_APPROVAL_CUES_BINDING_INVALID',
    ),
  );

  const approvalScopeTamper = structuredClone(currentDocuments);
  approvalScopeTamper.approval.authorizationScope.allowed =
    approvalScopeTamper.approval.authorizationScope.allowed.filter(
      (permission) => permission !== 'complete-single-video-full-retention-edit',
    );
  assert.ok(
    validateCurrent(approvalScopeTamper).errors.includes(
      'DIRECTOR_PRODUCTION_CURRENT_APPROVAL_SCOPE_INVALID',
    ),
  );

  const paperCountTamper = structuredClone(currentDocuments);
  paperCountTamper.handoff.routeMappings.find(
    (entry) => entry.sourceRoute === 'paper-editorial',
  ).beatCount = 6;
  assert.ok(
    validateCurrent(paperCountTamper).errors.includes(
      'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_ROUTE_COUNT_MISMATCH',
    ),
  );

  const receiptTamper = structuredClone(currentDocuments);
  receiptTamper.validation.validatorExecuted = false;
  assert.ok(
    validateCurrent(receiptTamper).errors.includes(
      'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_VALIDATION_INVALID',
    ),
  );

  const publicationTamper = structuredClone(currentDocuments);
  publicationTamper.handoff.publicationAuthorized = true;
  assert.ok(
    validateCurrent(publicationTamper).errors.includes(
      'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_AUTHORIZATION_INVALID',
    ),
  );

  const fixedPathTamper = structuredClone(currentArtifacts);
  fixedPathTamper.preproductionRequest.path = 'edit/another-episode/director-cues.v3.json';
  assert.ok(
    validateCurrent(currentDocuments, fixedPathTamper).errors.includes(
      'DIRECTOR_PRODUCTION_CURRENT_ARTIFACT_BINDING_INVALID:preproductionRequest',
    ),
  );

  const historical = assertDirectorProductionBinding({
    projectRoot: root,
    job: {jobId: '20260830-historical-v80'},
    command: 'doctor',
    skipSkillLock: true,
  });
  assert.equal(historical.status, 'historical-grandfathered');

  console.log(
    JSON.stringify({
      ok: true,
      previewRequiresDirectorArtifacts: true,
      formalRequiresCurrentTaskUserAcceptance: true,
      genericCardFallbackRejected: true,
      currentNativeV2HandoffAccepted: true,
      currentNativeV2PaperSceneCount: currentPositive.paperSceneCount,
      currentNativeV2TamperRejected: true,
      historicalJobsGrandfathered: true,
    }),
  );
} finally {
  rmSync(root, {recursive: true, force: true});
}
