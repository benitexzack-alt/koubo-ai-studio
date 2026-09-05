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
if (profile.routingPolicy?.fallback !== 'blocked') {
  errors.push('DIRECTOR_PROFILE_FALLBACK_NOT_BLOCKED');
}
if (profile.routingPolicy?.genericInformationCardCanSatisfyPaperBeat !== false) {
  errors.push('DIRECTOR_PROFILE_GENERIC_CARD_CAN_SATISFY_PAPER_BEAT');
}
if (profile.evidencePolicy?.skillReadDoesNotEqualExecuted !== true) {
  errors.push('DIRECTOR_PROFILE_EXECUTION_EVIDENCE_WEAK');
}
if (profile.promptHandoffPolicy?.modelGeneratedReadableTextAllowed !== false) {
  errors.push('DIRECTOR_PROFILE_MODEL_TEXT_NOT_BLOCKED');
}
if (profile.promptHandoffPolicy?.defaultPaperTextMode !== 'first-frame-baked') {
  errors.push('DIRECTOR_PROFILE_FIRST_FRAME_BAKED_TEXT_NOT_DEFAULT');
}
if (profile.promptHandoffPolicy?.firstFrameBakeOnlyForRigidSurface !== true) {
  errors.push('DIRECTOR_PROFILE_FIRST_FRAME_BAKE_NOT_RIGID_ONLY');
}
if (profile.promptHandoffPolicy?.ocrRequiredForFirstFrameBake !== true) {
  errors.push('DIRECTOR_PROFILE_FIRST_FRAME_OCR_NOT_REQUIRED');
}
if (profile.promptHandoffPolicy?.actualImageAnchorCalibrationRequired !== true) {
  errors.push('DIRECTOR_PROFILE_ACTUAL_ANCHOR_CALIBRATION_NOT_REQUIRED');
}
if (profile.promptHandoffPolicy?.runningHubReadyPackRequired !== true) {
  errors.push('DIRECTOR_PROFILE_RUNNINGHUB_READY_PACK_NOT_REQUIRED');
}
if (profile.promptHandoffPolicy?.paperNodeScreenOverlayAllowed !== false) {
  errors.push('DIRECTOR_PROFILE_PAPER_NODE_SCREEN_OVERLAY_ALLOWED');
}
if (
  profile.promptHandoffPolicy?.independentPromptArtifactCount !== 3 ||
  profile.promptHandoffPolicy?.zeroSceneManifestRequired !== true ||
  profile.promptHandoffPolicy?.aiGeneratedVideoConsumer !==
    'user-authorized-manual-generation'
) {
  errors.push('DIRECTOR_PROFILE_THREE_PROMPT_PACK_CONTRACT_INVALID');
}
if (
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
  profile.routingPolicy?.generatedVideo?.presentationMode !== 'full-screen'
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
  if (
    productionProfile.profileId !== 'v8-semantic-continuity-sfx' ||
    productionProfile.profileVersion !== 'V8' ||
    profile.v8Integration?.role !== 'formal-production-rollback-baseline-during-v9-pilot' ||
    profile.v8Integration?.v9CandidateForNextNewRevision !== true ||
    profile.v8Integration?.v9FormalEligibleBeforeRealPilotAcceptance !== false
  ) {
    errors.push('DIRECTOR_PROFILE_V8_ROLLBACK_BASELINE_INVALID');
  }
} catch (error) {
  errors.push(`DIRECTOR_PROFILE_V8_ROLLBACK_LOAD_FAILED:${error.message}`);
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
if (style.textContract?.strategy !== 'deterministic-paper-surface-v3.1') {
  errors.push('DIRECTOR_STYLE_TEXT_STRATEGY_INVALID');
}
if (style.textContract?.modelGeneratedReadableTextAllowed !== false) {
  errors.push('DIRECTOR_STYLE_MODEL_TEXT_NOT_BLOCKED');
}
if (style.generatedAssetContract?.contactSheetMustBindFormalAssetSha !== true) {
  errors.push('DIRECTOR_STYLE_CONTACT_SHEET_SHA_NOT_REQUIRED');
}

const inheritedPath = resolveDeclared(style.inherits.path);
if (!existsSync(inheritedPath) || sha256File(inheritedPath) !== style.inherits.sha256) {
  errors.push('DIRECTOR_STYLE_INHERITED_HASH_MISMATCH');
}

for (const anchor of [
  style.acceptedDynamicAnchor,
  style.acceptedDynamicAnchor?.acceptanceReceipt,
]) {
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
