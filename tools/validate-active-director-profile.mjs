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
if (profile.profileVersion !== '3.1.0') errors.push('DIRECTOR_PROFILE_VERSION_NOT_V3_1');
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
if (profile.promptHandoffPolicy?.defaultPaperTextMode !== 'tracked-paper-surface') {
  errors.push('DIRECTOR_PROFILE_TRACKED_TEXT_NOT_DEFAULT');
}
if (profile.promptHandoffPolicy?.firstFrameBakeOnlyForRigidSurface !== true) {
  errors.push('DIRECTOR_PROFILE_FIRST_FRAME_BAKE_NOT_RIGID_ONLY');
}
if (profile.promptHandoffPolicy?.ocrRequiredForFirstFrameBake !== true) {
  errors.push('DIRECTOR_PROFILE_FIRST_FRAME_OCR_NOT_REQUIRED');
}
if (profile.promptHandoffPolicy?.paperNodeScreenOverlayAllowed !== false) {
  errors.push('DIRECTOR_PROFILE_PAPER_NODE_SCREEN_OVERLAY_ALLOWED');
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
