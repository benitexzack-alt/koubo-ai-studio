// Current paper planning policy; historical production contracts remain immutable.
export const PAPER_BASELINE_ID = 'paper-super-individual-20260829-v1';
export const PAPER_TEXT_POLICY = 'first-frame-generated-chinese-surface-bound';

export function isSurfaceBoundPaper(style) {
  return style?.textPolicy === PAPER_TEXT_POLICY;
}

export function validatePaperMotionIntent(item) {
  const errors = [];
  const fail = (condition, name) => { if (!condition) errors.push(`${name}:${item?.id ?? 'unknown'}`); };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const motion = item?.motionPlan;
  fail(text(motion?.goal) && text(motion?.result), 'PAPER_COGNITIVE_GOAL_AND_RESULT_REQUIRED');
  fail(Array.isArray(motion?.actions) && motion.actions.length > 0 && motion.actions.every(text), 'PAPER_CAUSAL_ACTIONS_REQUIRED');
  fail(motion?.textBinding === 'surface-bound', 'PAPER_TEXT_OBJECT_BINDING_REQUIRED');
  fail(motion?.audioPolicy === 'preserve-usable-native-action-sound', 'PAPER_NATIVE_AUDIO_REVIEW_REQUIRED');
  for (const label of item?.textPlan ?? []) {
    fail(['with-object', 'fixed-context'].includes(label.motion), 'PAPER_LABEL_MOTION_REQUIRED');
    fail(label.motion !== 'fixed-context' || text(label.reason), 'PAPER_FIXED_LABEL_REASON_REQUIRED');
  }
  return errors;
}

export function assertCurrentPaperBaseline(cues, profile) {
  if (!(cues?.routePlans?.paperEditorials?.items?.length > 0)) return;
  if (!profile?.paperQualityBaseline) return; // dated compatibility fixtures, not the active default
  if (cues?.styleLocks?.paperEditorial?.qualityBaselineId !== profile.paperQualityBaseline.id ||
      !isSurfaceBoundPaper(cues?.styleLocks?.paperEditorial)) {
    throw new Error('PAPER_CURRENT_BASELINE_REQUIRED');
  }
}
