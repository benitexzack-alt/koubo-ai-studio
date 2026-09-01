#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assertDirectorProductionBinding} from './director-production-binding-core.mjs';
import {sha256File} from './director-skill-lock-core.mjs';

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
      historicalJobsGrandfathered: true,
    }),
  );
} finally {
  rmSync(root, {recursive: true, force: true});
}
