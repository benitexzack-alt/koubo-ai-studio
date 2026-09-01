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
if (profile.routingPolicy?.fallback !== 'blocked') {
  errors.push('DIRECTOR_PROFILE_FALLBACK_NOT_BLOCKED');
}
if (profile.routingPolicy?.genericInformationCardCanSatisfyPaperBeat !== false) {
  errors.push('DIRECTOR_PROFILE_GENERIC_CARD_CAN_SATISFY_PAPER_BEAT');
}
if (profile.evidencePolicy?.skillReadDoesNotEqualExecuted !== true) {
  errors.push('DIRECTOR_PROFILE_EXECUTION_EVIDENCE_WEAK');
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
