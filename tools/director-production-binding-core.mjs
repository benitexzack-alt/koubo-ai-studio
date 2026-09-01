import {existsSync, readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertActiveSkillLink,
  assertSkillLock,
  sha256File,
} from './director-skill-lock-core.mjs';

const formalCommands = new Set([
  'formal-audio',
  'formal',
  'qa',
  'regression',
  'all',
  'direct-remotion-render',
  'release-validation',
]);

const normalizeDate = (value) => String(value ?? '').replaceAll('-', '');

const parseJobDate = (jobId) => {
  const match = String(jobId ?? '').match(/^(\d{8})/);
  return match?.[1] ?? null;
};

const resolveDeclared = (projectRoot, declaredPath) => {
  if (typeof declaredPath !== 'string' || !declaredPath.trim()) return null;
  return path.isAbsolute(declaredPath)
    ? path.normalize(declaredPath)
    : path.resolve(projectRoot, declaredPath);
};

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

function bindArtifact(projectRoot, artifact, label, errors) {
  const absolutePath = resolveDeclared(projectRoot, artifact?.path);
  if (!absolutePath || !existsSync(absolutePath)) {
    errors.push(`DIRECTOR_PRODUCTION_ARTIFACT_MISSING:${label}`);
    return null;
  }
  const actualSha256 = sha256File(absolutePath);
  if (actualSha256 !== artifact.sha256) {
    errors.push(`DIRECTOR_PRODUCTION_ARTIFACT_SHA_MISMATCH:${label}`);
  }
  try {
    return {path: absolutePath, value: readJson(absolutePath), sha256: actualSha256};
  } catch (error) {
    errors.push(
      `DIRECTOR_PRODUCTION_ARTIFACT_JSON_INVALID:${label}:${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

export function assertDirectorProductionBinding({
  projectRoot,
  job,
  command,
  skipSkillLock = false,
  activeSkillPath,
}) {
  const profilePath = path.resolve(projectRoot, 'workflow/active-director-profile.v1.json');
  if (!existsSync(profilePath)) {
    const error = new Error('DIRECTOR_ACTIVE_PROFILE_MISSING');
    error.code = 'DIRECTOR_ACTIVE_PROFILE_MISSING';
    throw error;
  }
  const profile = readJson(profilePath);
  const effectiveDate = normalizeDate(profile.effectiveFrom);
  const jobDate = parseJobDate(job.jobId);
  if (jobDate && jobDate < effectiveDate) {
    return {
      ok: true,
      status: 'historical-grandfathered',
      jobDate,
      effectiveDate,
      command,
    };
  }

  const errors = [];
  if (!jobDate) errors.push('DIRECTOR_PRODUCTION_JOB_DATE_MISSING');
  if (profile.status !== 'active-default') errors.push('DIRECTOR_PROFILE_NOT_ACTIVE');
  if (profile.routingPolicy?.fallback !== 'blocked') {
    errors.push('DIRECTOR_PROFILE_FALLBACK_NOT_BLOCKED');
  }

  if (!skipSkillLock) {
    const lockPath = resolveDeclared(projectRoot, profile.skill.lockPath);
    if (!lockPath || !existsSync(lockPath)) {
      errors.push('DIRECTOR_SKILL_LOCK_MISSING');
    } else {
      const lock = readJson(lockPath);
      const lockResult = assertSkillLock({projectRoot, profile, lock});
      errors.push(...lockResult.errors);
    }
    const linkResult = assertActiveSkillLink({
      projectRoot,
      profile,
      activeSkillPath:
        activeSkillPath ??
        path.resolve(
          process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'),
          'skills/koubo-remotion-director',
        ),
    });
    if (!linkResult.ok) errors.push(linkResult.error);
  }

  const director = job.director;
  if (director?.required !== true) errors.push('DIRECTOR_PRODUCTION_BINDING_REQUIRED');
  if (
    director?.profileId !== profile.profileId ||
    director?.profileVersion !== profile.profileVersion
  ) {
    errors.push('DIRECTOR_PRODUCTION_PROFILE_MISMATCH');
  }
  if (director?.phase !== 'post-shoot') errors.push('DIRECTOR_PRODUCTION_PHASE_NOT_POSTSHOOT');
  if (director?.paperRequired !== true) errors.push('DIRECTOR_PRODUCTION_PAPER_NOT_REQUIRED');
  if (director?.fallback !== 'blocked') errors.push('DIRECTOR_PRODUCTION_FALLBACK_NOT_BLOCKED');

  const artifacts = director?.artifacts ?? {};
  const bound = {
    preRequest: bindArtifact(projectRoot, artifacts.preproductionRequest, 'preproductionRequest', errors),
    routeLock: bindArtifact(projectRoot, artifacts.routeLock, 'routeLock', errors),
    prePlan: bindArtifact(projectRoot, artifacts.preproductionPlan, 'preproductionPlan', errors),
    preValidation: bindArtifact(
      projectRoot,
      artifacts.preproductionValidation,
      'preproductionValidation',
      errors,
    ),
    postRequest: bindArtifact(projectRoot, artifacts.postshootRequest, 'postshootRequest', errors),
    postPlan: bindArtifact(projectRoot, artifacts.postshootPlan, 'postshootPlan', errors),
    postValidation: bindArtifact(
      projectRoot,
      artifacts.postshootValidation,
      'postshootValidation',
      errors,
    ),
  };

  const values = Object.values(bound)
    .filter(Boolean)
    .map((entry) => entry.value);
  for (const value of values) {
    if (value.taskId !== director.taskId) errors.push('DIRECTOR_PRODUCTION_TASK_BINDING_MISMATCH');
  }
  if (bound.routeLock?.value.branch !== 'paper-editorial') {
    errors.push('DIRECTOR_PRODUCTION_ROUTE_NOT_PAPER');
  }
  if (bound.routeLock?.value.fallback !== 'blocked') {
    errors.push('DIRECTOR_PRODUCTION_ROUTE_FALLBACK_NOT_BLOCKED');
  }
  if (bound.routeLock?.value.genericInformationCardCanSatisfyPaperBeat !== false) {
    errors.push('DIRECTOR_PRODUCTION_GENERIC_CARD_ALLOWED');
  }
  if (!Array.isArray(bound.prePlan?.value.paperScenes) || bound.prePlan.value.paperScenes.length === 0) {
    errors.push('DIRECTOR_PRODUCTION_PAPER_SCENES_EMPTY');
  }
  if (bound.preValidation?.value.skillExecuted !== true) {
    errors.push('DIRECTOR_PRODUCTION_PRE_SKILL_NOT_EXECUTED');
  }
  if (bound.postValidation?.value.skillExecuted !== true) {
    errors.push('DIRECTOR_PRODUCTION_POST_SKILL_NOT_EXECUTED');
  }
  if (bound.postPlan?.value.spokenAuthority !== 'recorded-audio') {
    errors.push('DIRECTOR_PRODUCTION_SPOKEN_AUTHORITY_INVALID');
  }
  if (bound.postPlan?.value.scriptRole !== 'comparison-only') {
    errors.push('DIRECTOR_PRODUCTION_SCRIPT_ROLE_INVALID');
  }

  if (formalCommands.has(command)) {
    const acceptance = bindArtifact(
      projectRoot,
      director?.currentTaskUserAcceptance,
      'currentTaskUserAcceptance',
      errors,
    );
    if (
      acceptance?.value.status !== 'user-accepted-current-task-preview' ||
      acceptance?.value.userAccepted !== true ||
      acceptance?.value.taskId !== director.taskId
    ) {
      errors.push('DIRECTOR_PRODUCTION_CURRENT_TASK_USER_ACCEPTANCE_INVALID');
    }
  }

  if (errors.length > 0) {
    const error = new Error(errors.join('|'));
    error.code = errors[0];
    error.errors = errors;
    throw error;
  }
  return {
    ok: true,
    status: formalCommands.has(command)
      ? 'formal-entry-director-bound'
      : 'candidate-entry-director-bound',
    command,
    taskId: director.taskId,
    paperSceneCount: bound.prePlan.value.paperScenes.length,
    spokenAuthority: bound.postPlan.value.spokenAuthority,
  };
}
