#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const planPath = 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/candidate-plan.v1.json';
const outputPath = 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/candidate-plan-validation-output.v1.json';
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = fs.readFileSync(path.resolve(repoRoot, planPath));
const plan = JSON.parse(bytes);
const errors = [];

if (plan.schemaVersion !== 'lanzhou-industry-ai-remotion-candidate-plan/v1') errors.push('CANDIDATE_PLAN_SCHEMA_INVALID');
if (plan.status !== 'candidate-plan-ready-with-blockers') errors.push('CANDIDATE_STATUS_MUST_PRESERVE_BLOCKERS');
if (plan.subtitleTrack?.pageCount !== 96 || plan.subtitleTrack.pages?.length !== 96) errors.push('BILINGUAL_96_PAGE_TRACK_REQUIRED');
if (plan.subtitleTrack?.status !== 'needs-user-audio-review' || plan.gates?.userAudioReviewConfirmed !== false) errors.push('AUDIO_REVIEW_GATE_INVALID');
if (plan.subtitleTrack.pages?.some((page) => typeof page.zh !== 'string' || !page.zh || typeof page.en !== 'string' || !page.en || page.startMs >= page.endMs)) errors.push('BILINGUAL_PAGE_INVALID');
if (plan.subtitleTrack?.renderContract?.nowrapForbidden !== true || plan.subtitleTrack?.renderContract?.chineseMustRemainExact !== true) errors.push('SUBTITLE_RENDER_CONTRACT_INVALID');
if (plan.mainVisualBeats?.length !== 22) errors.push('MAIN_VISUAL_22_BEATS_REQUIRED');
const paperIds = plan.mainVisualBeats?.filter((beat) => beat.mainVisual === 'paper-editorial').map((beat) => beat.beatId) ?? [];
if (paperIds.join(',') !== 'B04,B07,B10,B11,B15,B17') errors.push('PAPER_BEAT_SET_INVALID');
if (plan.mainVisualBeats?.filter((beat) => beat.mainVisual === 'speaker').length !== 16) errors.push('SPEAKER_BEAT_COUNT_INVALID');
if (paperIds.some((id) => !plan.gates?.paperBeatReplanRequired?.includes(id))) errors.push('PAPER_REPLAN_BLOCKER_NOT_PRESERVED');

const coverage = plan.shotcraft?.fullLibraryCoverage;
if (coverage?.analyzedCardCount !== 157 || coverage?.candidateRenderableCardCount !== 5 || coverage?.adaptationRequiredCardCount !== 152 || coverage?.autoApplyCount !== 0 || coverage?.autoNotNeededCount !== 22) errors.push('FULL_LIBRARY_COVERAGE_INVALID');
const inventory = plan.shotcraft?.adapterInventory ?? [];
if (inventory.length !== 5 || new Set(inventory.map((item) => item.component)).size !== 5) errors.push('FIVE_LOCAL_COMPONENT_INVENTORY_REQUIRED');
const effects = plan.shotcraft?.candidateEffects ?? [];
if (effects.length !== 1 || effects[0]?.beatId !== 'B21' || effects[0]?.cardId !== 'line-carry-transition' || effects[0]?.effectId !== 'line-carry' || effects[0]?.component !== 'LineCarry') errors.push('ONLY_B21_LINE_CARRY_OVERRIDE_ALLOWED');
const effect = effects[0];
if (effect?.decisionOrigin !== 'human-director-candidate-override' || effect?.candidateOnly !== true || effect?.autoMatchEvidence?.overrideDoesNotAlterAutoMatchReceipt !== true) errors.push('HUMAN_OVERRIDE_PROVENANCE_REQUIRED');
if (effect?.autoMatchEvidence?.cardScore !== 0.617778 || effect?.autoMatchEvidence?.semanticGap !== 0.125163 || effect?.autoMatchEvidence?.maximumSemanticGap !== 0.06) errors.push('AUTO_MATCH_GAP_EVIDENCE_INVALID');
if (effect?.frames?.startFrame !== 9090 || effect?.frames?.endFrameExclusive !== 9330 || effect?.localDurationInFrames !== 240) errors.push('B21_EFFECT_WINDOW_INVALID');
const sourcePages = plan.subtitleTrack.pages?.filter((page) => effect?.sourceCaptionPageIds?.includes(page.id)) ?? [];
const spoken = sourcePages.map((page) => page.zh).join('');
if (effect?.quote !== spoken || effect?.texts?.some((text) => !spoken.includes(text))) errors.push('EFFECT_TEXT_NOT_FROM_SAME_WINDOW_CAPTIONS');
if (effect?.componentProps?.fromLabel !== effect?.texts?.[0] || effect?.componentProps?.toLabel !== effect?.texts?.[1] || effect?.componentProps?.width !== effect?.region?.width) errors.push('LINE_CARRY_PROPS_INVALID');
if (plan.gates?.formalRenderAllowed !== false || plan.gates?.publicationApproved !== false || plan.gates?.shotcraftCandidateAccepted !== false) errors.push('CANDIDATE_GATES_INVALID');

for (const [key, binding] of Object.entries(plan.sources ?? {})) {
  const sourceBytes = fs.readFileSync(path.resolve(repoRoot, binding.path));
  if (sha256(sourceBytes) !== binding.sha256) errors.push(`SOURCE_HASH_MISMATCH:${key}`);
}

const result = {
  schemaVersion: 'lanzhou-industry-ai-remotion-candidate-plan-validation/v1',
  status: errors.length ? 'blocked' : 'candidate-plan-valid',
  validatedAt: new Date().toISOString(),
  plan: {path: planPath, sha256: sha256(bytes)},
  summary: {
    captionPageCount: plan.subtitleTrack?.pageCount ?? 0,
    beatCount: plan.mainVisualBeats?.length ?? 0,
    speakerBeatCount: plan.mainVisualBeats?.filter((beat) => beat.mainVisual === 'speaker').length ?? 0,
    paperBeatCount: paperIds.length,
    analyzedCardCount: coverage?.analyzedCardCount ?? 0,
    localAdapterCount: inventory.length,
    autoApplyCount: coverage?.autoApplyCount ?? 0,
    humanOverrideCandidateApplyCount: effects.length,
    selectedCardIds: effects.map((item) => item.cardId),
  },
  gates: plan.gates,
  errors,
};
const outputBytes = Buffer.from(`${JSON.stringify(result, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.resolve(repoRoot, outputPath), outputBytes, {flag: 'wx'});
console.log(JSON.stringify({...result, output: {path: outputPath, sha256: sha256(outputBytes)}}, null, 2));
if (errors.length) process.exitCode = 1;
