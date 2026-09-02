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
          paperScene: {
            nodes: [{id: 'N1', label: '按需租用'}],
            textPlan: [{nodeId: 'N1', text: '按需租用', enterStageId: 'S1'}],
          },
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
    JSON.stringify({
      authority: 'recorded-audio',
      captions: [
        {id: 'C001', startMs: 1_000, endMs: 2_500, text: '实际说的是算力可以'},
        {id: 'C002', startMs: 2_500, endMs: 4_000, text: '按需租用'},
        {id: 'C003', startMs: 5_000, endMs: 9_000, text: '后面才会说到企业运维支持'},
      ],
    }),
  );

  const request = {
    schemaVersion: 'koubo-director-postshoot-rebind-request/v1',
    requestId: 'post-request-1',
    taskId: 'task-1',
    phase: 'post-shoot',
    timelineFps: 30,
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
        actualCaptionIds: ['C001', 'C002'],
        anchorStartMs: 1_000,
        anchorEndMs: 4_000,
        actualSpokenLine: '实际说的是算力可以按需租用',
        semanticAnchorText: '算力可以按需租用',
        alignmentStatus: 'exact',
        nodeTextBindings: [
          {
            nodeId: 'N1',
            resolvedText: '按需租用',
            enterStageId: 'S1',
            actualCaptionIds: ['C002'],
            actualSpokenTerms: ['按需租用'],
            anchorStartMs: 2_500,
            anchorEndMs: 4_000,
            visualEnterMs: 2_500,
            stageActionFrame: 45,
            labelEnterFrame: 45,
            alignmentStatus: 'exact',
          },
        ],
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
  assert.equal(plan.beats[0].paperScene.textPlan[0].text, '按需租用');
  assert.equal(plan.paperScenes[0].spokenLine, request.mappings[0].actualSpokenLine);
  assert.equal(plan.paperScenes[0].textPlan[0].text, '按需租用');
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

  const outsideWindow = structuredClone(request);
  outsideWindow.mappings[0].actualSpokenLine = '后面才会说到企业运维支持';
  const outsideWindowResult = validatePostshootRebindRequest({
    request: outsideWindow,
    projectRoot: root,
  });
  assert.equal(outsideWindowResult.ok, false);
  assert.ok(
    outsideWindowResult.errors.includes('POSTSHOOT_ACTUAL_LINE_NOT_IN_DECLARED_WINDOW:B01'),
  );

  const earlyClaim = structuredClone(request);
  earlyClaim.mappings[0].nodeTextBindings[0].anchorStartMs = 2_900;
  const earlyClaimResult = validatePostshootRebindRequest({
    request: earlyClaim,
    projectRoot: root,
  });
  assert.equal(earlyClaimResult.ok, false);
  assert.ok(
    earlyClaimResult.errors.includes('POSTSHOOT_NODE_VISUAL_CLAIM_TOO_EARLY:B01:N1'),
  );

  const captionOutsideNodeAnchor = structuredClone(request);
  captionOutsideNodeAnchor.mappings[0].nodeTextBindings[0].anchorStartMs = 1_000;
  captionOutsideNodeAnchor.mappings[0].nodeTextBindings[0].anchorEndMs = 2_000;
  captionOutsideNodeAnchor.mappings[0].nodeTextBindings[0].visualEnterMs = 1_000;
  captionOutsideNodeAnchor.mappings[0].nodeTextBindings[0].stageActionFrame = 0;
  captionOutsideNodeAnchor.mappings[0].nodeTextBindings[0].labelEnterFrame = 0;
  const captionOutsideNodeAnchorResult = validatePostshootRebindRequest({
    request: captionOutsideNodeAnchor,
    projectRoot: root,
  });
  assert.equal(captionOutsideNodeAnchorResult.ok, false);
  assert.ok(
    captionOutsideNodeAnchorResult.errors.includes(
      'POSTSHOOT_NODE_CAPTION_OUTSIDE_ANCHOR:B01:N1',
    ),
  );

  const wrongTerm = structuredClone(request);
  wrongTerm.mappings[0].nodeTextBindings[0].resolvedText = '运维支持';
  const wrongTermResult = validatePostshootRebindRequest({
    request: wrongTerm,
    projectRoot: root,
  });
  assert.equal(wrongTermResult.ok, false);
  assert.ok(
    wrongTermResult.errors.includes('POSTSHOOT_NODE_TEXT_NOT_DERIVED_FROM_SPEECH:B01:N1'),
  );

  const stageDrift = structuredClone(request);
  stageDrift.mappings[0].nodeTextBindings[0].labelEnterFrame = 49;
  stageDrift.mappings[0].nodeTextBindings[0].visualEnterMs = 1_000 + (49 / 30) * 1_000;
  const stageDriftResult = validatePostshootRebindRequest({
    request: stageDrift,
    projectRoot: root,
  });
  assert.equal(stageDriftResult.ok, false);
  assert.ok(
    stageDriftResult.errors.includes('POSTSHOOT_NODE_STAGE_OFFSET_EXCEEDED:B01:N1'),
  );

  const mismatch = structuredClone(request);
  mismatch.mappings[0].alignmentStatus = 'mismatch';
  const mismatchResult = validatePostshootRebindRequest({
    request: mismatch,
    projectRoot: root,
  });
  assert.equal(mismatchResult.ok, false);
  assert.ok(mismatchResult.errors.includes('POSTSHOOT_ALIGNMENT_MISMATCH:B01:beat'));

  console.log(
    JSON.stringify({
      ok: true,
      recordedSpeechAuthoritative: true,
      postshootPaperScenesExportedForAssetBinding: true,
      unconfirmedNodeTextRejected: true,
      incompleteBeatMappingRejected: true,
      wholeTimelineFalsePositiveRejected: true,
      earlyVisualClaimRejected: true,
      nodeCaptionOutsideDeclaredAnchorRejected: true,
      spokenTermSubstitutionRejected: true,
      nodeStageOffsetOverThreeFramesRejected: true,
      mismatchAlignmentRejected: true,
      formalRemainsLocked: true,
    }),
  );
} finally {
  rmSync(root, {recursive: true, force: true});
}
