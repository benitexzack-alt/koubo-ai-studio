import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {
  buildSceneIdentity,
  isText,
  resolveDeclared,
  sha256File,
  sha256Json,
} from './preproduction-director-core.mjs';
import {
  resolvePaperIntakeIncidentPolicy,
  validatePaperIncidentAsset,
  validatePaperIncidentRegistryAssets,
} from './paper-asset-intake-incident.mjs';

export const PAPER_ASSET_INTAKE_SCHEMA = 'koubo-paper-generated-asset-intake/v1';
export const PAPER_CONTACT_SHEET_SCHEMA = 'koubo-paper-asset-contact-sheet/v1';
export const PAPER_CONTACT_PAGE_SIZE = 12;

const push = (errors, condition, code) => {
  if (!condition) errors.push(code);
};

const sameSet = (left, right) => {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

const bindFile = ({projectRoot, reference, label, errors}) => {
  const absolutePath = resolveDeclared(projectRoot, reference?.path);
  if (!absolutePath || !existsSync(absolutePath)) {
    errors.push(`${label}_MISSING`);
    return null;
  }
  if (!isText(reference?.sha256) || sha256File(absolutePath) !== reference.sha256) {
    errors.push(`${label}_SHA_MISMATCH`);
  }
  return absolutePath;
};

const bindFrame = ({projectRoot, frame, label, errors}) => {
  const absolutePath = bindFile({projectRoot, reference: frame, label, errors});
  push(
    errors,
    ['first', 'middle', 'last', 'action-grid', 'action-boundary', 'high-risk'].includes(frame?.moment),
    `${label}_MOMENT_INVALID`,
  );
  return absolutePath;
};

const canonicalAssetSet = (assets) =>
  assets.map((asset) => ({
    sceneId: asset?.sceneId ?? null,
    pairId: asset?.pairId ?? null,
    pairSha256: asset?.pairSha256 ?? null,
    inputFirstFrameSha256: asset?.inputFirstFrame?.sha256 ?? null,
    generatedVideoSha256: asset?.generatedVideo?.sha256 ?? null,
    productionCandidateSha256: asset?.productionCandidate?.sha256 ?? null,
    evidenceFrames: (asset?.evidenceFrames ?? []).map((frame) => ({
      moment: frame.moment,
      sha256: frame.sha256,
      ...(frame.frameIndex !== undefined ? {frameIndex: frame.frameIndex, ocrReceiptSha256: frame.ocrReceipt?.sha256 ?? null} : {}),
    })),
    ...(asset?.extractionReceipt ? {
      extractionReceiptSha256: asset.extractionReceipt.sha256,
      mediaQaReceiptSha256: asset.mediaQaReceipt?.sha256 ?? null,
      semanticReviewReceiptSha256: asset.semanticReviewReceipt?.sha256 ?? null,
      silentViewReviewReceiptSha256: asset.silentViewReviewReceipt?.sha256 ?? null,
    } : {}),
  }));

export const computePaperAssetSetSha256 = (assets) => sha256Json(canonicalAssetSet(assets));

export const paperContactFrames = (assets, incidentPrevention) => assets.flatMap(asset =>
  (incidentPrevention ? [...(asset.evidenceFrames ?? [])].sort((a, b) => a.frameIndex - b.frameIndex) :
    [asset.evidenceFrames?.find(frame => frame.moment === 'middle')]).map(frame => ({asset, frame})));

export const paperContactCellBinding = (asset, frame, incidentPrevention) => ({
  sceneId: asset.sceneId,
  productionCandidateSha256: asset.productionCandidate?.sha256,
  ...(incidentPrevention ? {frameIndex: frame?.frameIndex, imageSha256: frame?.sha256,
    ocrReceiptSha256: frame?.ocrReceipt?.sha256} : {middleFrameSha256: frame?.sha256}),
});

export function validatePaperAssetIntake({
  request,
  requestPath,
  projectRoot,
  requireContactSheet = true,
  profile,
}) {
  const errors = [];
  push(errors, request.schemaVersion === PAPER_ASSET_INTAKE_SCHEMA, 'PAPER_ASSET_SCHEMA_INVALID');
  push(errors, isText(request.taskId), 'PAPER_ASSET_TASK_ID_MISSING');
  const planPath = bindFile({
    projectRoot,
    reference: request.sourcePlan,
    label: 'PAPER_ASSET_SOURCE_PLAN',
    errors,
  });
  let plan;
  try {
    if (planPath) plan = JSON.parse(readFileSync(planPath, 'utf8'));
  } catch {
    errors.push('PAPER_ASSET_SOURCE_PLAN_JSON_INVALID');
  }
  push(errors, plan?.taskId === request.taskId, 'PAPER_ASSET_SOURCE_PLAN_TASK_MISMATCH');
  push(
    errors,
    plan?.phase === 'post-shoot' &&
      plan?.status === 'candidate-preview-required' &&
      plan?.formalEligible === false &&
      plan?.spokenAuthority === 'recorded-audio',
    'PAPER_ASSET_SOURCE_PLAN_NOT_POSTSHOOT_AUTHORITY',
  );
  const paperScenes = Array.isArray(plan?.paperScenes) ? plan.paperScenes : [];
  push(errors, paperScenes.length > 0, 'PAPER_ASSET_SOURCE_SCENES_EMPTY');
  const incidentPolicy = resolvePaperIntakeIncidentPolicy({request, plan, projectRoot, profile});
  errors.push(...incidentPolicy.errors);
  const incidentPrevention = incidentPolicy.required;

  const assets = Array.isArray(request.assets) ? request.assets : [];
  const incidentRegistry = incidentPrevention ? validatePaperIncidentRegistryAssets({assets, projectRoot}) : null;
  errors.push(...(incidentRegistry?.errors ?? []));
  push(errors, assets.length === paperScenes.length, 'PAPER_ASSET_SCENE_COUNT_MISMATCH');
  const assetBySceneId = new Map();
  for (const asset of assets) {
    push(errors, isText(asset.sceneId), 'PAPER_ASSET_SCENE_ID_MISSING');
    push(
      errors,
      !assetBySceneId.has(asset.sceneId),
      `PAPER_ASSET_SCENE_ID_DUPLICATE:${asset.sceneId ?? 'unknown'}`,
    );
    if (isText(asset.sceneId)) assetBySceneId.set(asset.sceneId, asset);
  }

  const orderedAssets = [];
  const dynamicEvidence = [];
  paperScenes.forEach((scene, index) => {
    const identity = buildSceneIdentity(scene, index);
    const asset = assetBySceneId.get(identity.sceneId) ?? {};
    orderedAssets.push(asset);
    const suffix = identity.sceneId;
    push(errors, asset.pairId === identity.pairId, `PAPER_ASSET_PAIR_ID_MISMATCH:${suffix}`);
    push(
      errors,
      asset.pairSha256 === identity.pairSha256,
      `PAPER_ASSET_PAIR_SHA_MISMATCH:${suffix}`,
    );
    push(
      errors,
      asset.textPlanSha256 === identity.textPlanSha256,
      `PAPER_ASSET_TEXT_PLAN_SHA_MISMATCH:${suffix}`,
    );
    const firstFramePath = bindFile({
      projectRoot,
      reference: asset.inputFirstFrame,
      label: `PAPER_ASSET_FIRST_FRAME:${suffix}`,
      errors,
    });
    push(
      errors,
      isText(asset.inputFirstFrame?.pHash) && /^[a-f0-9]{16,64}$/u.test(asset.inputFirstFrame.pHash),
      `PAPER_ASSET_FIRST_FRAME_PHASH_INVALID:${suffix}`,
    );
    const generatedVideoPath = bindFile({
      projectRoot,
      reference: asset.generatedVideo,
      label: `PAPER_ASSET_GENERATED_VIDEO:${suffix}`,
      errors,
    });
    const candidatePath = bindFile({
      projectRoot,
      reference: asset.productionCandidate,
      label: `PAPER_ASSET_PRODUCTION_CANDIDATE:${suffix}`,
      errors,
    });
    const expectedName = `${suffix}__${identity.pairSha256.slice(0, 8)}.mp4`;
    push(
      errors,
      asset.productionCandidate?.canonicalFileName === expectedName &&
        candidatePath &&
        path.basename(candidatePath) === expectedName,
      `PAPER_ASSET_CANONICAL_NAME_INVALID:${suffix}`,
    );
    push(errors, Boolean(firstFramePath), `PAPER_ASSET_FIRST_FRAME_UNBOUND:${suffix}`);
    push(errors, Boolean(generatedVideoPath), `PAPER_ASSET_GENERATED_VIDEO_UNBOUND:${suffix}`);

    const frames = Array.isArray(asset.evidenceFrames) ? asset.evidenceFrames : [];
    const frameByMoment = new Map();
    frames.forEach((frame) => {
      bindFrame({
        projectRoot,
        frame,
        label: `PAPER_ASSET_EVIDENCE_FRAME:${suffix}:${frame?.moment ?? 'unknown'}`,
        errors,
      });
      if (isText(frame?.moment)) frameByMoment.set(frame.moment, frame);
    });
    push(
      errors,
      ['first', 'middle', 'last'].every((moment) => frameByMoment.has(moment)) && frames.length >= 3,
      `PAPER_ASSET_EVIDENCE_FRAME_COVERAGE_INVALID:${suffix}`,
    );

    const mediaQaPath = bindFile({
      projectRoot,
      reference: asset.mediaQaReceipt,
      label: `PAPER_ASSET_MEDIA_QA:${suffix}`,
      errors,
    });
    let mediaQa;
    if (mediaQaPath) {
      try {
        mediaQa = JSON.parse(readFileSync(mediaQaPath, 'utf8'));
        push(
          errors,
          mediaQa.fullDecodePassed === true &&
            mediaQa.videoSha256 === asset.productionCandidate?.sha256,
          `PAPER_ASSET_MEDIA_QA_NOT_BOUND:${suffix}`,
        );
      } catch {
        errors.push(`PAPER_ASSET_MEDIA_QA_JSON_INVALID:${suffix}`);
      }
    }

    push(
      errors,
      sameSet(
        asset.expectedObjectGroupIds ?? [],
        scene.objectGroups.map((group) => group.id),
      ),
      `PAPER_ASSET_OBJECT_GROUP_BINDING_MISMATCH:${suffix}`,
    );
    push(
      errors,
      sameSet(asset.expectedStageIds ?? [], scene.stages.map((stage) => stage.id)),
      `PAPER_ASSET_STAGE_BINDING_MISMATCH:${suffix}`,
    );

    if (incidentPrevention) {
      const result = validatePaperIncidentAsset({asset, scene, sceneId: suffix, request, projectRoot, mediaQa});
      errors.push(...result.errors);
      dynamicEvidence.push({sceneId: suffix, videoSha256: asset.productionCandidate?.sha256,
        requiredFrameIndices: result.requiredFrameIndices, evidenceSetSha256: result.evidenceSetSha256,
        extractionReceipt: asset.extractionReceipt, semanticReviewReceipt: asset.semanticReviewReceipt,
        silentViewReviewReceipt: asset.silentViewReviewReceipt});
      return;
    }

    const semantic = asset.semanticReview ?? {};
    push(errors, semantic.status === 'exact', `PAPER_ASSET_SEMANTIC_NOT_EXACT:${suffix}`);
    push(errors, isText(semantic.object), `PAPER_ASSET_SEMANTIC_OBJECT_MISSING:${suffix}`);
    push(errors, isText(semantic.change), `PAPER_ASSET_SEMANTIC_CHANGE_MISSING:${suffix}`);
    push(
      errors,
      isText(semantic.spokenConsistency),
      `PAPER_ASSET_SEMANTIC_SPOKEN_CONSISTENCY_MISSING:${suffix}`,
    );
    push(
      errors,
      semantic.ownSceneClosest === true && semantic.mostSimilarSceneId === suffix,
      `PAPER_ASSET_CROSS_SCENE_MATCH_FAILED:${suffix}`,
    );

    const silent = asset.silentViewReview ?? {};
    push(errors, silent.status === 'passed', `PAPER_ASSET_SILENT_VIEW_NOT_PASSED:${suffix}`);
    push(errors, isText(silent.objectAnswer), `PAPER_ASSET_SILENT_OBJECT_MISSING:${suffix}`);
    push(
      errors,
      isText(silent.relationshipOrChangeAnswer),
      `PAPER_ASSET_SILENT_CHANGE_MISSING:${suffix}`,
    );
    push(
      errors,
      isText(silent.spokenConsistencyAnswer),
      `PAPER_ASSET_SILENT_SPOKEN_CONSISTENCY_MISSING:${suffix}`,
    );

    const mechanism = asset.mechanismEvidence ?? {};
    push(
      errors,
      mechanism.inputMoment === 'first' &&
        mechanism.actionMoment === 'middle' &&
        mechanism.outputMoment === 'last' &&
        mechanism.visibleStateChange === true,
      `PAPER_ASSET_INPUT_ACTION_OUTPUT_INVALID:${suffix}`,
    );

    const textQa = asset.textQa ?? {};
    const plannedTexts = scene.textPlan.map((item) => item.text);
    const samples = Array.isArray(textQa.samples) ? textQa.samples : [];
    push(errors, textQa.status === 'passed', `PAPER_ASSET_TEXT_QA_NOT_PASSED:${suffix}`);
    push(errors, textQa.driftFree === true, `PAPER_ASSET_TEXT_DRIFT_DETECTED:${suffix}`);
    push(
      errors,
      ['first', 'middle', 'last'].every((moment) =>
        samples.some(
          (sample) =>
            sample.moment === moment &&
            sample.exact === true &&
            Array.isArray(sample.expectedTexts) &&
            Array.isArray(sample.recognizedTexts) &&
            sameSet(sample.expectedTexts, sample.recognizedTexts),
        ),
      ),
      `PAPER_ASSET_TEXT_QA_SAMPLE_COVERAGE_INVALID:${suffix}`,
    );
    const coveredTexts = new Set(
      samples.flatMap((sample) => (Array.isArray(sample.expectedTexts) ? sample.expectedTexts : [])),
    );
    push(
      errors,
      plannedTexts.every((text) => coveredTexts.has(text)),
      `PAPER_ASSET_TEXT_QA_PLAN_COVERAGE_INVALID:${suffix}`,
    );
  });

  const assetSetSha256 = computePaperAssetSetSha256(orderedAssets);
  let contactSheetManifestPath = null;
  let contactSheetManifest = null;
  if (requireContactSheet) {
    contactSheetManifestPath = resolveDeclared(
      projectRoot,
      request.outputs?.contactSheetManifestPath,
    );
    if (!contactSheetManifestPath || !existsSync(contactSheetManifestPath)) {
      errors.push('PAPER_ASSET_CONTACT_SHEET_MANIFEST_MISSING');
      contactSheetManifestPath = null;
    }
    try {
      if (contactSheetManifestPath) {
        contactSheetManifest = JSON.parse(readFileSync(contactSheetManifestPath, 'utf8'));
      }
    } catch {
      errors.push('PAPER_ASSET_CONTACT_SHEET_MANIFEST_JSON_INVALID');
    }
    push(
      errors,
      contactSheetManifest?.schemaVersion === PAPER_CONTACT_SHEET_SCHEMA,
      'PAPER_ASSET_CONTACT_SHEET_SCHEMA_INVALID',
    );
    push(
      errors,
      contactSheetManifest?.request?.path === requestPath &&
        contactSheetManifest?.request?.sha256 === sha256File(requestPath),
      'PAPER_ASSET_CONTACT_SHEET_REQUEST_BINDING_MISMATCH',
    );
    push(
      errors,
      contactSheetManifest?.assetSetSha256 === assetSetSha256,
      'PAPER_ASSET_CONTACT_SHEET_ASSET_SET_MISMATCH',
    );
    const contactImagePath = bindFile({
      projectRoot,
      reference: contactSheetManifest?.image,
      label: 'PAPER_ASSET_CONTACT_SHEET_IMAGE',
      errors,
    });
    push(errors, Boolean(contactImagePath), 'PAPER_ASSET_CONTACT_SHEET_IMAGE_UNBOUND');
    const cells = Array.isArray(contactSheetManifest?.cells) ? contactSheetManifest.cells : [];
    const expectedCells = paperContactFrames(orderedAssets, incidentPrevention);
    push(errors, cells.length === expectedCells.length, 'PAPER_ASSET_CONTACT_SHEET_CELL_COUNT_INVALID');
    if (incidentPrevention) {
      const pages = Array.isArray(contactSheetManifest?.pages) ? contactSheetManifest.pages : [];
      push(errors, contactSheetManifest?.policy?.incidentPreventionVersion === '1' &&
        contactSheetManifest?.revisionId === request.revisionId &&
        pages.length === Math.ceil(expectedCells.length / PAPER_CONTACT_PAGE_SIZE), 'PAPER_ASSET_CONTACT_SHEET_PAGES_INVALID');
      pages.forEach((page, index) => {
        bindFile({projectRoot, reference: page?.image, label: `PAPER_ASSET_CONTACT_SHEET_PAGE:${index}`, errors});
        push(errors, page?.pageIndex === index, `PAPER_ASSET_CONTACT_SHEET_PAGE_ORDER_INVALID:${index}`);
      });
      push(errors, pages[0]?.image?.sha256 === contactSheetManifest?.image?.sha256 &&
        pages[0]?.image?.path === contactSheetManifest?.image?.path, 'PAPER_ASSET_CONTACT_SHEET_FIRST_PAGE_MISMATCH');
    }
    expectedCells.forEach(({asset, frame}, index) => {
      const cell = cells[index] ?? {};
      const expected = paperContactCellBinding(asset, frame, incidentPrevention);
      push(
        errors,
        Object.entries(expected).every(([key, value]) => cell[key] === value) &&
          (!incidentPrevention || cell.pageIndex === Math.floor(index / PAPER_CONTACT_PAGE_SIZE)),
        `PAPER_ASSET_CONTACT_SHEET_CELL_BINDING_MISMATCH:${asset.sceneId ?? index}`,
      );
    });
  }

  const outputPaths = [
    request.outputs?.contactSheetPath,
    request.outputs?.contactSheetManifestPath,
    request.outputs?.validationReceiptPath,
  ];
  push(
    errors,
    outputPaths.every(isText) &&
      new Set(outputPaths.map((value) => resolveDeclared(projectRoot, value))).size === outputPaths.length,
    'PAPER_ASSET_OUTPUT_PATHS_INVALID',
  );

  return {
    ok: errors.length === 0,
    errors,
    plan,
    planPath,
    incidentPreventionVersion: incidentPrevention ? '1' : null,
    revisionId: incidentPrevention ? request.revisionId : null,
    sourceFrameExecutionVerificationRequired: incidentPrevention,
    sourceFramesVerified: false,
    incidentRegistry: incidentRegistry?.registry ?? null,
    dynamicEvidence,
    orderedAssets,
    assetSetSha256,
    contactSheetManifest,
    contactSheetManifestPath,
  };
}
