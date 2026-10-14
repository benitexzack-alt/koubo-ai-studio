#!/usr/bin/env node

import {existsSync, readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  assertActiveSkillLink,
  assertSkillLock,
  sha256File,
} from './director-skill-lock-core.mjs';
import {
  getPlatformSafeAreaProfile,
  validatePlatformSafeAreasDocument,
  validatePresenterSlot,
} from '../skills/koubo-remotion-director/scripts/platform-safe-area-core.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Kept pure so negative regression cases cannot mutate the live profile or assets.
export function validatePaperBaselineProfile(profile, style, verifyFile) {
  const errors = [];
  const baseline = profile.paperQualityBaseline;
  const baselineId = 'paper-super-individual-20260829-v1';
  const baselinePath = 'workflow/style-library/paper-super-individual-20260829-v1.json';
  if (baseline?.id !== baselineId || baseline.path !== baselinePath ||
    baseline.requiredForNewPaper !== true || profile.style?.id !== baselineId ||
    profile.style?.path !== baselinePath || style.schemaVersion !== 'koubo-paper-quality-baseline/v1') {
    errors.push('DIRECTOR_PAPER_QUALITY_BASELINE_REQUIRED');
  }
  const motion = profile.paperMotionPolicy;
  for (const key of ['oneCognitiveGoalPerShot', 'relatedActionChainAllowed',
    'textBoundToOwningSurfaceRequired', 'textFollowsOwnerMotionRequired',
    'allLabelsStaticDefaultForbidden', 'fixedLabelRequiresSemanticReason',
    'cameraMotionAloneIsNotObjectAction', 'readableResultHoldRequired',
    'dynamicPilotBeforeBatchRequired', 'actionBoundaryEvidenceRequired', 'userDynamicAcceptanceRequired']) {
    if (motion?.[key] !== true) errors.push(`DIRECTOR_PAPER_MOTION_POLICY_REQUIRED:${key}`);
  }
  const audio = profile.paperNativeAudioPolicy;
  for (const key of ['dispositionRequiredPerAsset', 'blanketMuteForbidden',
    'eligiblePhysicalActionAudioPreserved', 'unwantedSpeechMusicNoiseMustBeRemovedOrReplaced',
    'sourceVoiceRemainsPrimary', 'normalSpeedListeningRequired', 'peakAndLoudnessCheckRequired']) {
    if (audio?.[key] !== true) errors.push(`DIRECTOR_PAPER_NATIVE_AUDIO_POLICY_REQUIRED:${key}`);
  }
  if (audio?.fixedHistoricalGainIsUniversal !== false) errors.push('DIRECTOR_PAPER_HISTORICAL_GAIN_NOT_UNIVERSAL');
  const handoff = profile.promptHandoffPolicy;
  if (handoff?.paperRoute !== 'paper-director-v2-surface-bound' ||
    handoff.paperRouteLegacyBridgeAllowed !== false ||
    handoff.legacyTextContractApplicability !== 'legacy-only' ||
    handoff.generatedReadableTextAllowed !== true || handoff.modelGeneratedReadableTextAllowed !== true ||
    handoff.defaultPaperTextMode !== 'first-frame-generated-chinese-surface-bound' ||
    JSON.stringify(handoff.allowedPaperTextModes) !== JSON.stringify(['first-frame-generated-chinese-surface-bound']) ||
    handoff.deterministicTextOwner !== null || handoff.firstFrameBakeOnlyForRigidSurface !== false ||
    handoff.actualImageAnchorCalibrationRequired !== false || handoff.ocrRequiredForFirstFrameBake !== false ||
    handoff.firstFrameChineseReadabilityCheckRequired !== true || handoff.firstFrameUserAcceptanceRequired !== true ||
    handoff.localTextOverlayOrAnimationRequired !== false) {
    errors.push('DIRECTOR_PAPER_SURFACE_BOUND_TEXT_HANDOFF_REQUIRED');
  }
  if (style.textContract?.strategy !== 'first-frame-generated-chinese-surface-bound' ||
    style.textContract?.modelGeneratedReadableTextAllowed !== true ||
    style.textContract?.textMovesWithCarrier !== true || style.textContract?.allLabelsForcedStatic !== false ||
    style.textContract?.glyphStabilityRequired !== true || style.textContract?.localAnimationRequired !== false) {
    errors.push('DIRECTOR_STYLE_TEXT_STRATEGY_INVALID');
  }
  if (style.motionContract?.unit !== 'one-cognitive-goal' ||
    style.motionContract?.relatedActionChainAllowed !== true || style.motionContract?.cameraOnlyMotionSufficient !== false) {
    errors.push('DIRECTOR_STYLE_RELATED_ACTION_CHAIN_REQUIRED');
  }
  if (style.audioContract?.policy !== 'preserve-usable-native-action-sound' ||
    style.audioContract?.blanketMuteAllowed !== false || style.audioContract?.reviewEachClip !== true ||
    style.audioContract?.historicalGainIsNotUniversal !== true) errors.push('DIRECTOR_STYLE_NATIVE_AUDIO_REVIEW_REQUIRED');
  for (const key of ['normalSpeedDynamicReviewRequired', 'textCarrierMotionReviewRequired',
    'nativeAudioReviewRequired', 'userAcceptanceRequired']) {
    if (style.generatedAssetContract?.[key] !== true) errors.push(`DIRECTOR_STYLE_DYNAMIC_REVIEW_REQUIRED:${key}`);
  }
  if (style.inherits) errors.push('DIRECTOR_PAPER_BASELINE_MUST_NOT_INHERIT_LEGACY_STYLE');
  if (!Array.isArray(style.referenceClips) || style.referenceClips.length === 0) {
    errors.push('DIRECTOR_PAPER_BASELINE_REFERENCE_CLIPS_REQUIRED');
  }
  for (const anchor of [style.acceptedDynamicAnchor, ...(Array.isArray(style.referenceClips) ? style.referenceClips : [])]) {
    if (!anchor?.path || !/^[a-f0-9]{64}$/.test(anchor.sha256 ?? '') || !verifyFile(anchor.path, anchor.sha256)) {
      errors.push(`DIRECTOR_PAPER_BASELINE_ASSET_HASH_MISMATCH:${anchor?.path ?? 'unknown'}`);
    }
  }
  return errors;
}

function main() {
const profilePath = path.resolve(projectRoot, 'workflow/active-director-profile.v1.json');
const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));
const resolveDeclared = (declaredPath) =>
  path.isAbsolute(declaredPath) ? declaredPath : path.resolve(projectRoot, declaredPath);

const errors = [];
let profile;
let style;
let lock;

try {
  profile = readJson(profilePath);
  style = readJson(resolveDeclared(profile.style.path));
  lock = readJson(resolveDeclared(profile.skill.lockPath));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (profile.status !== 'active-default') errors.push('DIRECTOR_PROFILE_NOT_ACTIVE_DEFAULT');
if (profile.profileId !== 'paper-editorial-director-v9') {
  errors.push('DIRECTOR_PROFILE_ID_NOT_V9');
}
if (profile.profileVersion !== '9.1.0') errors.push('DIRECTOR_PROFILE_VERSION_NOT_V91');
const scopeBoundary = profile.scopeBoundary;
const forbiddenBeforeApproval = [
  'firstframe-generation',
  'ocr',
  'runninghub',
  'remotion',
  'subtitle',
  'sfx',
  'render',
  'release',
];
if (
  scopeBoundary?.directorPlanningAuthority !== 'skills/koubo-remotion-director/SKILL.md' ||
  scopeBoundary?.directorPlanningOutput !== 'koubo-director-cues/v2' ||
  scopeBoundary?.appliesToDirectorPlanning !== false ||
  scopeBoundary?.appliesAfter !== 'user-approved-director-cues' ||
  scopeBoundary?.userApprovalRequiredBeforeDownstream !== true ||
  !Array.isArray(scopeBoundary?.forbiddenBeforeApproval) ||
  scopeBoundary.forbiddenBeforeApproval.length !== forbiddenBeforeApproval.length ||
  forbiddenBeforeApproval.some((stage) => !scopeBoundary.forbiddenBeforeApproval.includes(stage))
) {
  errors.push('DIRECTOR_PROFILE_SCOPE_BOUNDARY_INVALID');
}
const incidentPolicy = profile.incidentPreventionPolicy;
if (incidentPolicy?.version !== '1' || incidentPolicy.requiredForNewPreproduction !== false ||
  incidentPolicy.contractApplicability !== 'legacy-only' ||
  incidentPolicy.typedMotionContractRequired !== false || incidentPolicy.fixedIndependentTextStandsRequired !== false ||
  incidentPolicy.dynamicPilotBeforeBatchRequired !== true || incidentPolicy.actionBoundaryEvidenceRequired !== true ||
  incidentPolicy.historicalOutputsImmutable !== true || incidentPolicy.automaticRetryAllowed !== false ||
  incidentPolicy.formalAuthorizationUnchanged !== true ||
  incidentPolicy.negativeRegistryPath !== 'skills/koubo-remotion-director/references/paper-motion-incident-registry.v1.json') {
  errors.push('DIRECTOR_INCIDENT_PREVENTION_POLICY_REQUIRED');
}
if (profile.routingPolicy?.fallback !== 'blocked') {
  errors.push('DIRECTOR_PROFILE_FALLBACK_NOT_BLOCKED');
}
if (
  profile.routingPolicy?.selectionBasis !== 'semantic-need-not-fixed-cadence' ||
  profile.routingPolicy?.speakerIsFallback !== true ||
  profile.routingPolicy?.generatedInsertMinimum !== 0 ||
  profile.routingPolicy?.paperInsertMinimum !== 0 ||
  profile.routingPolicy?.fixedCadenceForbidden !== true ||
  profile.routingPolicy?.paperBranchDefault !== false ||
  profile.routingPolicy?.factVerificationSeparatedFromPrimaryVisual !== true ||
  JSON.stringify(profile.routingPolicy?.constructedVisualPriority) !== JSON.stringify([
    'paper-editorial', 'generated-video',
  ]) ||
  profile.routingPolicy?.publicSourcePreparationOwner !== 'codex' ||
  profile.routingPolicy?.privateAuthenticatedRecordingOwner !== 'user' ||
  profile.routingPolicy?.aiGeneratedVideoUseCondition !==
    'concrete-human-or-environment-scene-paper-unnatural' ||
  !Array.isArray(profile.routingPolicy?.paperApplicableKinds) ||
  Object.hasOwn(profile.routingPolicy ?? {}, 'paperRequiredKinds') ||
  JSON.stringify(profile.routingPolicy?.mainVisualClasses) !== JSON.stringify([
    'speaker', 'real-evidence', 'generated-video', 'paper-editorial',
  ]) ||
  JSON.stringify(profile.routingPolicy?.directorCueRouteMap) !== JSON.stringify({
    speaker: 'speaker',
    'real-evidence': 'real-evidence',
    'ai-generated-video': 'generated-video',
    'paper-editorial': 'paper-editorial',
  })
) {
  errors.push('DIRECTOR_PROFILE_SEMANTIC_ROUTING_POLICY_INVALID');
}
if (profile.routingPolicy?.genericInformationCardCanSatisfyPaperBeat !== false) {
  errors.push('DIRECTOR_PROFILE_GENERIC_CARD_CAN_SATISFY_PAPER_BEAT');
}
if (profile.evidencePolicy?.skillReadDoesNotEqualExecuted !== true) {
  errors.push('DIRECTOR_PROFILE_EXECUTION_EVIDENCE_WEAK');
}
const requiredDirectorCuesV2Artifacts = [
  'director-cues-v2',
  'director-cues-user-approval-v2',
  'director-cues-v2-handoff',
  'director-cues-v2-handoff-validation-receipt',
];
if (
  !Array.isArray(profile.evidencePolicy?.requiredExecutionArtifacts) ||
  requiredDirectorCuesV2Artifacts.some(
    (artifact) => !profile.evidencePolicy.requiredExecutionArtifacts.includes(artifact),
  )
) {
  errors.push('DIRECTOR_PROFILE_V2_EXECUTION_ARTIFACTS_MISSING');
}
if (
  !Array.isArray(profile.phasePolicy?.preShoot?.allowedOutputs) ||
  requiredDirectorCuesV2Artifacts.some(
    (artifact) => !profile.phasePolicy.preShoot.allowedOutputs.includes(artifact),
  )
) {
  errors.push('DIRECTOR_PROFILE_V2_PRESHOOT_OUTPUTS_MISSING');
}
if (Object.hasOwn(profile.skill ?? {}, 'acceptedPackage')) {
  errors.push('DIRECTOR_PROFILE_STALE_ACCEPTED_PACKAGE_FORBIDDEN');
}
errors.push(...validatePaperBaselineProfile(profile, style, (declaredPath, expectedSha) => {
  const target = resolveDeclared(declaredPath);
  return existsSync(target) && sha256File(target) === expectedSha;
}));
if (profile.promptHandoffPolicy?.runningHubReadyPackRequired !== true) {
  errors.push('DIRECTOR_PROFILE_RUNNINGHUB_READY_PACK_NOT_REQUIRED');
}
if (profile.promptHandoffPolicy?.paperNodeScreenOverlayAllowed !== false) {
  errors.push('DIRECTOR_PROFILE_PAPER_NODE_SCREEN_OVERLAY_ALLOWED');
}
if (
  profile.promptHandoffPolicy?.independentPromptArtifactCount !== 4 ||
  JSON.stringify(profile.promptHandoffPolicy?.promptArtifactKinds) !== JSON.stringify([
    'ai-generated-video-first-frame',
    'ai-generated-video-image-to-video',
    'paper-editorial-first-frame',
    'paper-editorial-image-to-video',
  ]) ||
  profile.promptHandoffPolicy?.zeroSceneManifestRequired !== true ||
  profile.promptHandoffPolicy?.aiGeneratedVideoConsumer !==
    'user-authorized-manual-generation'
) {
  errors.push('DIRECTOR_PROFILE_FOUR_PROMPT_PACK_CONTRACT_INVALID');
}
if (
  profile.paperLayoutPolicy?.contractApplicability !== 'legacy-only' ||
  profile.paperLayoutPolicy?.coordinateSpace !== 'normalized-0-to-1' ||
  profile.paperLayoutPolicy?.contentSafeRectRequired !== true ||
  profile.paperLayoutPolicy?.subtitleReservedRectRequired !== true ||
  profile.paperLayoutPolicy?.objectGroupBoxRequired !== true ||
  profile.paperLayoutPolicy?.paperLabelSurfaceBoxRequired !== true ||
  profile.paperLayoutPolicy?.layoutInterpretation?.objectGroupBoxes !==
    'broad-composition-zones' ||
  profile.paperLayoutPolicy?.layoutInterpretation?.paperLabelSurfaceBoxes !==
    'reserved-placement-zones' ||
  profile.paperLayoutPolicy?.layoutInterpretation?.exactPixelMatchRequired !== false ||
  profile.paperLayoutPolicy?.layoutInterpretation?.contentAndSubtitleContainmentIsHard !== true ||
  profile.paperLayoutPolicy?.generatedDecorationPolicy !== 'forbidden' ||
  profile.paperLayoutPolicy?.layoutFailureBlocksGeneration !== true ||
  profile.paperLayoutPolicy?.v9SampleSceneCount !== 1 ||
  profile.paperLayoutPolicy?.automaticRetryAllowed !== false
) {
  errors.push('DIRECTOR_PROFILE_PAPER_LAYOUT_CONTRACT_INVALID');
}
if (profile.semanticTimingPolicy?.maximumVisualClaimLeadMs !== 300) {
  errors.push('DIRECTOR_PROFILE_VISUAL_LEAD_NOT_300MS');
}
if (profile.semanticTimingPolicy?.maximumNodeLabelStageOffsetFrames !== 3) {
  errors.push('DIRECTOR_PROFILE_NODE_STAGE_OFFSET_NOT_3_FRAMES');
}
if (profile.semanticTimingPolicy?.mismatchAllowed !== false) {
  errors.push('DIRECTOR_PROFILE_SEMANTIC_MISMATCH_ALLOWED');
}
if (profile.generatedAssetAcceptancePolicy?.formalAssetShaBindingRequired !== true) {
  errors.push('DIRECTOR_PROFILE_FORMAL_ASSET_SHA_NOT_REQUIRED');
}
if (profile.generatedAssetAcceptancePolicy?.silentViewRetellingRequired !== true) {
  errors.push('DIRECTOR_PROFILE_SILENT_RETELLING_NOT_REQUIRED');
}
if (profile.generatedAssetAcceptancePolicy?.inputActionResultRequired !== true) {
  errors.push('DIRECTOR_PROFILE_INPUT_ACTION_RESULT_NOT_REQUIRED');
}
if (profile.routingPolicy?.remotionInformationIsOverlayOnly !== true) {
  errors.push('DIRECTOR_PROFILE_REMOTION_INFORMATION_NOT_OVERLAY_ONLY');
}
if (
  profile.routingPolicy?.realMaterialPresenterInset?.mode !==
    'real-media-with-presenter-inset' ||
  profile.routingPolicy?.realMaterialPresenterInset?.duplicatePresenterVideoMuted !== true ||
  profile.routingPolicy?.realMaterialPresenterInset?.presenterAudioOwner !== 'base-talk-only' ||
  profile.routingPolicy?.realMaterialPresenterInset?.presenterAnchor !== 'douyin-right-safe' ||
  profile.routingPolicy?.realMaterialPresenterInset?.minimumCaptionGapPx !== 32 ||
  profile.routingPolicy?.realMaterialPresenterInset?.transitionMode !==
    'fixed-slot-opacity-scale'
) {
  errors.push('DIRECTOR_PROFILE_PRESENTER_INSET_CONTRACT_INVALID');
}
if (
  profile.routingPolicy?.generatedVideo?.role !== 'illustration-only' ||
  profile.routingPolicy?.generatedVideo?.evidenceEligible !== false ||
  profile.routingPolicy?.generatedVideo?.presentationMode !== 'full-screen' ||
  profile.routingPolicy?.generatedVideo?.useOnlyWhenPaperWouldBeUnnatural !== true
) {
  errors.push('DIRECTOR_PROFILE_GENERATED_VIDEO_CONTRACT_INVALID');
}
if (
  profile.routingPolicy?.shotcraft?.explicitDecisionRequiredForEligibleBeats !== true ||
  profile.routingPolicy?.shotcraft?.selectedEffectMustHaveApplicationReceipt !== true ||
  profile.routingPolicy?.shotcraft?.automaticSemanticMatchingRequired !== true ||
  profile.routingPolicy?.shotcraft?.fullCatalogScanRequired !== true ||
  profile.routingPolicy?.shotcraft?.validatedExperienceReuseFirst !== true ||
  profile.routingPolicy?.shotcraft?.referenceOnlyCardsRequireAdapter !== true ||
  profile.routingPolicy?.shotcraft?.lowerRelevanceSubstitutionForbidden !== true ||
  profile.routingPolicy?.shotcraft?.manualCatalogSearchIsProductionEvidence !== false ||
  profile.routingPolicy?.shotcraft?.cardCount !== 157 ||
  profile.routingPolicy?.shotcraft?.styleCount !== 214 ||
  profile.routingPolicy?.shotcraft?.candidateRenderableCardCount !== 5 ||
  profile.routingPolicy?.shotcraft?.adaptationRequiredCardCount !== 152 ||
  profile.routingPolicy?.shotcraft?.exactReuseMinimumAcceptedCases !== 1 ||
  profile.routingPolicy?.shotcraft?.patternPromotionMinimumAcceptedCases !== 2 ||
  profile.routingPolicy?.shotcraft?.patternPromotionMinimumDistinctTasks !== 2 ||
  profile.routingPolicy?.shotcraft?.latestRejectionBlocksExactReuse !== true ||
  profile.routingPolicy?.shotcraft?.candidatePreviewStillRequired !== true ||
  profile.routingPolicy?.shotcraft?.automaticFormalApproval !== false ||
  profile.routingPolicy?.shotcraft?.automaticPublicationApproval !== false ||
  profile.routingPolicy?.shotcraft?.mechanicalQuotaForbidden !== true ||
  profile.routingPolicy?.shotcraft?.fallback !== 'blocked'
) {
  errors.push('DIRECTOR_PROFILE_SHOTCRAFT_CONTRACT_INVALID');
}
for (const declaredPath of [
  profile.routingPolicy?.shotcraft?.libraryPath,
  profile.routingPolicy?.shotcraft?.capabilityIndexPath,
  profile.routingPolicy?.shotcraft?.experienceLedgerPath,
  profile.routingPolicy?.shotcraft?.matcherPath,
  profile.routingPolicy?.shotcraft?.experienceRecorderPath,
]) {
  if (!declaredPath || !existsSync(resolveDeclared(declaredPath))) {
    errors.push(`DIRECTOR_PROFILE_SHOTCRAFT_FILE_MISSING:${declaredPath ?? 'unknown'}`);
  }
}
if (
  profile.workflowPolicy?.schemaVersion !== 'koubo-v9-production-state/v1' ||
  profile.workflowPolicy?.strictStageOrder !== true ||
  profile.workflowPolicy?.candidatePreviewRequired !== true ||
  profile.workflowPolicy?.formalRequiresUserPreviewAcceptance !== true ||
  profile.workflowPolicy?.releasePackageRequiresFormalQa !== true ||
  profile.workflowPolicy?.automaticPublicationAllowed !== false
) {
  errors.push('DIRECTOR_PROFILE_V9_WORKFLOW_CONTRACT_INVALID');
}
for (const declaredPath of [
  profile.workflowPolicy?.templatePath,
  profile.workflowPolicy?.validatorPath,
]) {
  if (!declaredPath || !existsSync(resolveDeclared(declaredPath))) {
    errors.push(`DIRECTOR_PROFILE_V9_WORKFLOW_FILE_MISSING:${declaredPath ?? 'unknown'}`);
  }
}

try {
  const safeAreaPath = resolveDeclared(
    profile.routingPolicy.realMaterialPresenterInset.platformSafeAreaProfilePath,
  );
  const safeAreaDocument = readJson(safeAreaPath);
  const safeAreaDocumentResult = validatePlatformSafeAreasDocument(safeAreaDocument);
  if (!safeAreaDocumentResult.passed) {
    errors.push('DIRECTOR_PROFILE_PLATFORM_SAFE_AREA_DOCUMENT_INVALID');
  } else {
    const safeAreaProfile = getPlatformSafeAreaProfile(
      safeAreaDocument,
      profile.routingPolicy.realMaterialPresenterInset.platformSafeAreaProfileId,
    );
    for (const slotName of ['default', 'fallback']) {
      if (!validatePresenterSlot(safeAreaProfile, slotName).passed) {
        errors.push(`DIRECTOR_PROFILE_PLATFORM_SAFE_AREA_SLOT_INVALID:${slotName}`);
      }
    }
  }
} catch (error) {
  errors.push(`DIRECTOR_PROFILE_PLATFORM_SAFE_AREA_LOAD_FAILED:${error.message}`);
}

try {
  const shotcraftRegistry = readJson(
    resolveDeclared(profile.routingPolicy.shotcraft.registryPath),
  );
  if (
    shotcraftRegistry.defaultEnabled !== false ||
    !Array.isArray(shotcraftRegistry.effects) ||
    shotcraftRegistry.effects.length < 5 ||
    shotcraftRegistry.effects.some((effect) => effect.status !== 'candidate-only')
  ) {
    errors.push('DIRECTOR_PROFILE_SHOTCRAFT_REGISTRY_INVALID');
  }
} catch (error) {
  errors.push(`DIRECTOR_PROFILE_SHOTCRAFT_REGISTRY_LOAD_FAILED:${error.message}`);
}
try {
  const shotcraftIndex = readJson(resolveDeclared(profile.routingPolicy.shotcraft.capabilityIndexPath));
  const experienceLedger = readJson(resolveDeclared(profile.routingPolicy.shotcraft.experienceLedgerPath));
  if (
    shotcraftIndex.schemaVersion !== 'koubo-shotcraft-card-capability-index/v2' ||
    shotcraftIndex.stats?.cardCount !== 157 ||
    shotcraftIndex.stats?.styleCount !== 214 ||
    shotcraftIndex.stats?.candidateRenderableCount !== 5 ||
    shotcraftIndex.stats?.adaptationRequiredCount !== 152
  ) errors.push('DIRECTOR_PROFILE_SHOTCRAFT_INDEX_INVALID');
  if (
    experienceLedger.schemaVersion !== 'koubo-shotcraft-experience-ledger/v1' ||
    experienceLedger.policy?.exactReuseMinimumAcceptedCases !== 1 ||
    experienceLedger.policy?.patternPromotionMinimumAcceptedCases !== 2 ||
    experienceLedger.policy?.patternPromotionMinimumDistinctTasks !== 2 ||
    experienceLedger.policy?.latestRejectionBlocksExactReuse !== true ||
    experienceLedger.policy?.candidatePreviewStillRequired !== true ||
    experienceLedger.policy?.automaticFormalApproval !== false
  ) errors.push('DIRECTOR_PROFILE_SHOTCRAFT_EXPERIENCE_INVALID');
} catch (error) {
  errors.push(`DIRECTOR_PROFILE_SHOTCRAFT_MATCHING_LOAD_FAILED:${error.message}`);
}

try {
  const productionProfile = readJson(
    path.resolve(projectRoot, 'workflow/active-production-profile.v1.json'),
  );
  // 成片制作版本与本文件校验的纸艺导演 9.1 是两条独立版本线。
  const supportedProductionProfiles = {
    V8: {
      id: 'v8-semantic-continuity-sfx',
      role: 'formal-production-rollback-baseline-during-v9-pilot',
    },
    V9: {
      id: 'v9-semantic-direction-sfx',
      role: 'active-production-profile-with-inherited-v8-contract',
    },
  };
  const expectedProductionProfile = Object.hasOwn(supportedProductionProfiles, productionProfile.profileVersion)
    ? supportedProductionProfiles[productionProfile.profileVersion]
    : undefined;
  if (
    !expectedProductionProfile ||
    productionProfile.profileId !== expectedProductionProfile.id ||
    productionProfile.requirements?.experimentId !== 'v8-semantic-continuity-sfx' ||
    profile.v8Integration?.outerPackagingProfile !== expectedProductionProfile.id ||
    profile.v8Integration?.role !== expectedProductionProfile.role ||
    profile.v8Integration?.v9CandidateForNextNewRevision !== true ||
    profile.v8Integration?.v9FormalEligibleBeforeRealPilotAcceptance !== false
  ) {
    errors.push('DIRECTOR_PROFILE_PRODUCTION_INTEGRATION_INVALID');
  }
} catch (error) {
  errors.push(`DIRECTOR_PROFILE_PRODUCTION_INTEGRATION_LOAD_FAILED:${error.message}`);
}
const upgradeAuditPath = resolveDeclared(profile.skill?.contractUpgrade?.auditReport?.path);
if (
  !upgradeAuditPath ||
  !existsSync(upgradeAuditPath) ||
  sha256File(upgradeAuditPath) !== profile.skill?.contractUpgrade?.auditReport?.sha256
) {
  errors.push('DIRECTOR_PROFILE_CONTRACT_UPGRADE_AUDIT_MISMATCH');
}
if (style.styleId !== profile.style.id) errors.push('DIRECTOR_STYLE_ID_MISMATCH');
if (style.eligibility?.styleDirectionAccepted !== true) {
  errors.push('DIRECTOR_STYLE_DIRECTION_NOT_ACCEPTED');
}
if (style.eligibility?.previsualizationEligible !== true) {
  errors.push('DIRECTOR_STYLE_PREVIS_NOT_ELIGIBLE');
}
if (style.eligibility?.formalEligibleByDefault !== false) {
  errors.push('DIRECTOR_STYLE_FORMAL_DEFAULT_MUST_BE_FALSE');
}
if (style.generatedAssetContract?.contactSheetMustBindFormalAssetSha !== true) {
  errors.push('DIRECTOR_STYLE_CONTACT_SHEET_SHA_NOT_REQUIRED');
}

for (const anchor of [style.acceptedDynamicAnchor?.acceptanceReceipt].filter(Boolean)) {
  if (!anchor?.path || !existsSync(resolveDeclared(anchor.path))) {
    errors.push(`DIRECTOR_STYLE_ANCHOR_MISSING:${anchor?.path ?? 'unknown'}`);
    continue;
  }
  if (sha256File(resolveDeclared(anchor.path)) !== anchor.sha256) {
    errors.push(`DIRECTOR_STYLE_ANCHOR_HASH_MISMATCH:${anchor.path}`);
  }
}

const lockResult = assertSkillLock({projectRoot, profile, lock});
errors.push(...lockResult.errors);

const activeSkillPath = path.resolve(
  process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'),
  'skills/koubo-remotion-director',
);
const linkResult = assertActiveSkillLink({projectRoot, profile, activeSkillPath});
if (!linkResult.ok) errors.push(linkResult.error);

if (errors.length > 0) {
  console.error(JSON.stringify({ok: false, profilePath, errors}, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      styleId: style.styleId,
      skillPackageSha256: lockResult.actualPackageSha256,
      activeSkillPath,
      activeSkillTarget: linkResult.actual,
      formalEligibleByDefault: style.eligibility.formalEligibleByDefault,
    },
    null,
    2,
  ),
);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
