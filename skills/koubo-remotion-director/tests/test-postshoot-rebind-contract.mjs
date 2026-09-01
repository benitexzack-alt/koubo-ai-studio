#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  compilePostshootRebindPlan,
  validatePostshootRebindRequest,
} from '../scripts/postshoot-rebind-core.mjs';
import {sha256File} from '../scripts/preproduction-director-core.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-postshoot-test-'));
try {
  const preRequestPath = path.join(root, 'pre-request.json');
  const prePlanPath = path.join(root, 'pre-plan.json');
  const preValidationPath = path.join(root, 'pre-validation.json');
  const mediaPath = path.join(root, 'talk.mp4');
  const timelinePath = path.join(root, 'spoken.json');
  const postRequestPath = path.join(root, 'post-request.json');

  writeFileSync(preRequestPath, JSON.stringify({taskId: 'task-1'}));
  writeFileSync(
    prePlanPath,
    JSON.stringify({
      taskId: 'task-1',
      formalEligible: false,
      beats: [
        {
          id: 'B01',
          spokenLine: '预拍文稿说法',
          paperScene: {nodes: [{id: 'N1', label: '按需租用'}]},
        },
      ],
    }),
  );
  writeFileSync(
    preValidationPath,
    JSON.stringify({
      status: 'validated-provisional-previsualization',
      skillExecuted: true,
    }),
  );
  writeFileSync(mediaPath, 'not-a-real-video-but-hash-bound-in-unit-test');
  writeFileSync(
    timelinePath,
    JSON.stringify({authority: 'recorded-audio', text: '实际说的是算力可以按需租用'}),
  );

  const request = {
    schemaVersion: 'koubo-director-postshoot-rebind-request/v1',
    requestId: 'post-request-1',
    taskId: 'task-1',
    phase: 'post-shoot',
    sourcePreproduction: {
      requestPath: preRequestPath,
      requestSha256: sha256File(preRequestPath),
      planPath: prePlanPath,
      planSha256: sha256File(prePlanPath),
      validationReceiptPath: preValidationPath,
      validationReceiptSha256: sha256File(preValidationPath),
    },
    recordedMedia: {
      path: mediaPath,
      sha256: sha256File(mediaPath),
      durationSeconds: 10,
    },
    spokenTimeline: {
      path: timelinePath,
      sha256: sha256File(timelinePath),
      authority: 'recorded-audio',
      scriptRole: 'comparison-only',
    },
    mappings: [
      {
        beatId: 'B01',
        order: 1,
        startSeconds: 1,
        endSeconds: 5,
        actualSpokenLine: '实际说的是算力可以按需租用',
        textDecision: 'confirmed',
        visualDecision: 'keep',
      },
    ],
    outputs: {
      rebindPlanPath: path.join(root, 'rebind-plan.json'),
      validationReceiptPath: path.join(root, 'rebind-validation.json'),
    },
  };
  writeFileSync(postRequestPath, JSON.stringify(request));

  const positive = validatePostshootRebindRequest({request, projectRoot: root});
  assert.equal(positive.ok, true, positive.errors.join('\n'));
  const plan = compilePostshootRebindPlan({
    request,
    requestPath: postRequestPath,
    validation: positive,
  });
  assert.equal(plan.spokenAuthority, 'recorded-audio');
  assert.equal(plan.beats[0].spokenLine, request.mappings[0].actualSpokenLine);
  assert.equal(plan.formalEligible, false);

  const scriptAuthority = structuredClone(request);
  scriptAuthority.spokenTimeline.authority = 'script';
  const authorityResult = validatePostshootRebindRequest({
    request: scriptAuthority,
    projectRoot: root,
  });
  assert.equal(authorityResult.ok, false);
  assert.ok(authorityResult.errors.includes('POSTSHOOT_TIMELINE_AUTHORITY_INVALID'));

  const unconfirmedText = structuredClone(request);
  unconfirmedText.mappings[0].textDecision = 'revise';
  const textResult = validatePostshootRebindRequest({
    request: unconfirmedText,
    projectRoot: root,
  });
  assert.equal(textResult.ok, false);
  assert.ok(textResult.errors.includes('POSTSHOOT_NODE_TEXT_NOT_CONFIRMED:B01'));

  const missingMapping = structuredClone(request);
  missingMapping.mappings = [];
  const mappingResult = validatePostshootRebindRequest({
    request: missingMapping,
    projectRoot: root,
  });
  assert.equal(mappingResult.ok, false);
  assert.ok(mappingResult.errors.includes('POSTSHOOT_MAPPING_BEAT_MISSING:B01'));

  console.log(
    JSON.stringify({
      ok: true,
      recordedSpeechAuthoritative: true,
      unconfirmedNodeTextRejected: true,
      incompleteBeatMappingRejected: true,
      formalRemainsLocked: true,
    }),
  );
} finally {
  rmSync(root, {recursive: true, force: true});
}
