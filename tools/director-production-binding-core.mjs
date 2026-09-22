import {existsSync, readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SCOPED_DIRECT_EXPORT_AI_NO_NEW_BUSINESS_MODEL,
  assertScopedDirectExport,
  isScopedDirectExportJob,
} from './scoped-direct-export-core.mjs';
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

const currentEpisodeArtifactAliases = Object.freeze({
  preproductionRequest: 'preRequest',
  preproductionPlan: 'prePlan',
  routeLock: 'routeLock',
  preproductionValidation: 'preValidation',
});

const currentEpisodeRequiredEditReleasePermissions = Object.freeze([
  'local-offline-transcription-and-actual-speech-timeline-binding',
  'complete-single-video-full-retention-edit',
  'scan-full-shotcraft-library-for-speaker-and-real-evidence-beats',
  'apply-semantically-relevant-remotion-shotcraft-effects',
  'build-chinese-captions-from-actual-speech',
  'translate-english-captions-from-confirmed-actual-chinese',
  'design-and-mix-local-traceable-sound-effects',
  'render-full-review-candidate-and-complete-candidate-package',
  'run-local-machine-quality-checks',
]);

const sameBoundReference = (declared, jobReference, boundEntry) =>
  declared?.path === jobReference?.path &&
  declared?.sha256 === jobReference?.sha256 &&
  declared?.sha256 === boundEntry?.sha256;

/**
 * The current episode uses the native director-cues/v2 handoff quartet in the
 * four historical preproduction slots. Keep this adapter episode-scoped so the
 * legacy paper-scene contract remains unchanged for GPT6 and ordinary jobs.
 */
export function validateAiNoNewBusinessModelPreshootBinding({director, artifacts, bound}) {
  const errors = [];
  const add = (condition, code) => {
    if (!condition) errors.push(code);
  };
  const cues = bound?.preRequest?.value;
  const approval = bound?.prePlan?.value;
  const handoff = bound?.routeLock?.value;
  const validation = bound?.preValidation?.value;
  const expectedPaths = SCOPED_DIRECT_EXPORT_AI_NO_NEW_BUSINESS_MODEL.preshootArtifacts;

  for (const [artifactKey, boundKey] of Object.entries(currentEpisodeArtifactAliases)) {
    add(
      artifacts?.[artifactKey]?.path === expectedPaths[artifactKey] &&
        artifacts?.[artifactKey]?.sha256 === bound?.[boundKey]?.sha256,
      `DIRECTOR_PRODUCTION_CURRENT_ARTIFACT_BINDING_INVALID:${artifactKey}`,
    );
  }

  const semanticBeats = Array.isArray(cues?.semanticBeats) ? cues.semanticBeats : [];
  const paperBeats = semanticBeats.filter((beat) => beat?.primaryRoute === 'paper-editorial');
  const actualRouteCounts = new Map();
  for (const beat of semanticBeats) {
    actualRouteCounts.set(beat?.primaryRoute, (actualRouteCounts.get(beat?.primaryRoute) ?? 0) + 1);
  }
  add(
    cues?.schemaVersion === 'koubo-director-cues/v2' && cues?.taskId === director?.taskId,
    'DIRECTOR_PRODUCTION_CURRENT_CUES_SCHEMA_INVALID',
  );
  add(
    cues?.status === 'ready-for-user-review' && cues?.executionScope === 'director-only',
    'DIRECTOR_PRODUCTION_CURRENT_CUES_STATUS_INVALID',
  );
  add(
    semanticBeats.length === 34 &&
      new Set(semanticBeats.map((beat) => beat?.id)).size === 34,
    'DIRECTOR_PRODUCTION_CURRENT_CUES_BEAT_COUNT_INVALID',
  );
  add(paperBeats.length > 0, 'DIRECTOR_PRODUCTION_CURRENT_PAPER_BEATS_EMPTY');
  add(
    cues?.selectionSummary?.routeCounts?.['paper-editorial'] === paperBeats.length,
    'DIRECTOR_PRODUCTION_CURRENT_CUES_PAPER_COUNT_MISMATCH',
  );

  const approvalAllowed = approval?.authorizationScope?.allowed;
  const approvalForbidden = approval?.authorizationScope?.forbidden;
  add(
    approval?.schemaVersion === 'koubo-director-cues-user-approval/v2' &&
      approval?.status === 'approved' &&
      approval?.approved === true &&
      approval?.taskId === director?.taskId &&
      typeof approval?.revisionId === 'string' &&
      approval.revisionId.includes('edit-release'),
    'DIRECTOR_PRODUCTION_CURRENT_APPROVAL_INVALID',
  );
  add(
    Array.isArray(approvalAllowed) &&
      currentEpisodeRequiredEditReleasePermissions.every((permission) =>
        approvalAllowed.includes(permission),
      ) &&
      Array.isArray(approvalForbidden) &&
      approvalForbidden.includes('publish-to-douyin-or-any-external-platform') &&
      approval?.authorizationScope?.finalUserVisualAcceptance === 'pending',
    'DIRECTOR_PRODUCTION_CURRENT_APPROVAL_SCOPE_INVALID',
  );
  add(
    sameBoundReference(
      approval?.bindings?.directorCues,
      artifacts?.preproductionRequest,
      bound?.preRequest,
    ),
    'DIRECTOR_PRODUCTION_CURRENT_APPROVAL_CUES_BINDING_INVALID',
  );

  add(
    handoff?.schemaVersion === 'koubo-director-cues-v2-handoff/v1' &&
      handoff?.status === 'local-handoff-ready' &&
      handoff?.executionScope === 'local-handoff-only' &&
      handoff?.taskId === director?.taskId &&
      handoff?.revisionId === approval?.revisionId,
    'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_INVALID',
  );
  add(
    sameBoundReference(
      handoff?.source?.directorCues,
      artifacts?.preproductionRequest,
      bound?.preRequest,
    ) &&
      sameBoundReference(
        handoff?.source?.userApproval,
        artifacts?.preproductionPlan,
        bound?.prePlan,
      ),
    'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_SOURCE_BINDING_INVALID',
  );
  add(
    handoff?.externalActionsAuthorized === false &&
      handoff?.generationAuthorized === false &&
      handoff?.remotionAuthorized === false &&
      handoff?.publicationAuthorized === false,
    'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_AUTHORIZATION_INVALID',
  );

  const routeMappings = Array.isArray(handoff?.routeMappings) ? handoff.routeMappings : [];
  const expectedRoutes = ['speaker', 'real-evidence', 'ai-generated-video', 'paper-editorial'];
  const expectedDownstreamRoutes = {
    speaker: 'speaker',
    'real-evidence': 'real-evidence',
    'ai-generated-video': 'generated-video',
    'paper-editorial': 'paper-editorial',
  };
  const routeMappingBySource = new Map(
    routeMappings.map((entry) => [entry?.sourceRoute, entry]),
  );
  add(
    routeMappings.length === expectedRoutes.length &&
      routeMappingBySource.size === expectedRoutes.length &&
      expectedRoutes.every((route) => routeMappingBySource.has(route)),
    'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_ROUTE_MAPPINGS_INVALID',
  );
  add(
    expectedRoutes.every(
      (route) =>
        routeMappingBySource.get(route)?.downstreamRoute === expectedDownstreamRoutes[route] &&
        routeMappingBySource.get(route)?.beatCount === (actualRouteCounts.get(route) ?? 0),
    ) &&
      routeMappingBySource.get('paper-editorial')?.beatCount === paperBeats.length,
    'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_ROUTE_COUNT_MISMATCH',
  );

  add(
    validation?.schemaVersion ===
      'koubo-director-cues-v2-handoff-validation-receipt/v1' &&
      validation?.status === 'validated-local-handoff' &&
      validation?.skillExecuted === true &&
      validation?.validatorExecuted === true &&
      validation?.taskId === director?.taskId &&
      validation?.revisionId === handoff?.revisionId,
    'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_VALIDATION_INVALID',
  );
  add(
    sameBoundReference(
      validation?.handoffMaster,
      artifacts?.routeLock,
      bound?.routeLock,
    ),
    'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_MASTER_BINDING_INVALID',
  );
  add(
    sameBoundReference(
      validation?.source?.directorCues,
      artifacts?.preproductionRequest,
      bound?.preRequest,
    ) &&
      sameBoundReference(
        validation?.source?.userApproval,
        artifacts?.preproductionPlan,
        bound?.prePlan,
      ) &&
      validation?.externalActionsAuthorized === false &&
      validation?.generationAuthorized === false,
    'DIRECTOR_PRODUCTION_CURRENT_HANDOFF_VALIDATION_SOURCE_INVALID',
  );

  return {ok: errors.length === 0, errors, paperSceneCount: paperBeats.length};
}

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
  const scoped = isScopedDirectExportJob(job)
    ? assertScopedDirectExport({projectRoot, job, command})
    : null;
  // 本期原生 v2 交接；正式入口另行验证当前预览确认。
  if (['employee-ai-efficiency-scoped-preview', 'employee-ai-efficiency-scoped-formal', 'employee-ai-efficiency-repair-preview-r2', 'ai-training-methods-scoped-formal-r1', 'lanzhou-ai-salon-scoped-formal-r2', 'lanzhou-ai-salon-scoped-formal-r3'].includes(scoped?.route)) {
    return scoped.directorBinding;
  }
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

  if (!skipSkillLock && !scoped) {
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
  const isCurrentEpisodeNativeV2 =
    scoped?.episodeId === SCOPED_DIRECT_EXPORT_AI_NO_NEW_BUSINESS_MODEL.episodeId;
  let paperSceneCount = 0;
  if (isCurrentEpisodeNativeV2) {
    const nativeV2 = validateAiNoNewBusinessModelPreshootBinding({director, artifacts, bound});
    errors.push(...nativeV2.errors);
    paperSceneCount = nativeV2.paperSceneCount;
  } else {
    if (bound.routeLock?.value.branch !== 'paper-editorial') {
      errors.push('DIRECTOR_PRODUCTION_ROUTE_NOT_PAPER');
    }
    if (bound.routeLock?.value.fallback !== 'blocked') {
      errors.push('DIRECTOR_PRODUCTION_ROUTE_FALLBACK_NOT_BLOCKED');
    }
    if (bound.routeLock?.value.genericInformationCardCanSatisfyPaperBeat !== false) {
      errors.push('DIRECTOR_PRODUCTION_GENERIC_CARD_ALLOWED');
    }
    if (
      !Array.isArray(bound.prePlan?.value.paperScenes) ||
      bound.prePlan.value.paperScenes.length === 0
    ) {
      errors.push('DIRECTOR_PRODUCTION_PAPER_SCENES_EMPTY');
    } else {
      paperSceneCount = bound.prePlan.value.paperScenes.length;
    }
    if (bound.preValidation?.value.skillExecuted !== true) {
      errors.push('DIRECTOR_PRODUCTION_PRE_SKILL_NOT_EXECUTED');
    }
  }
  if (!scoped && bound.postValidation?.value.skillExecuted !== true) {
    errors.push('DIRECTOR_PRODUCTION_POST_SKILL_NOT_EXECUTED');
  }
  if (bound.postPlan?.value.spokenAuthority !== 'recorded-audio') {
    errors.push('DIRECTOR_PRODUCTION_SPOKEN_AUTHORITY_INVALID');
  }
  if (bound.postPlan?.value.scriptRole !== 'comparison-only') {
    errors.push('DIRECTOR_PRODUCTION_SCRIPT_ROLE_INVALID');
  }

  if (formalCommands.has(command) && !scoped) {
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
    status: scoped ? 'direct-export-authorized-director-bound' : formalCommands.has(command)
      ? 'formal-entry-director-bound'
      : 'candidate-entry-director-bound',
    command,
    taskId: director.taskId,
    paperSceneCount,
    spokenAuthority: bound.postPlan.value.spokenAuthority,
    ...(scoped ? {postshootEvidence: 'manual-import-bound', skillPackageAccepted: false, userPreviewApproved: false} : {}),
  };
}
