import measured from '../../director/beats_R4.json';

// These are absolute frames on the R4 music timebase, not a BPM-derived grid.
export const beatFrames = measured.beats.map((beat) => beat.frame);
export const downbeatFrames = measured.beats
  .filter((beat) => beat.downbeatEst)
  .map((beat) => beat.frame);
export const strongFrames = measured.strongAccents.map((accent) => accent.frame);

export const impulse = (frame: number, cue: number, decay: number): number =>
  frame < cue ? 0 : Math.exp(-(frame - cue) / Math.max(0.001, decay));

// One value per cue. The target starts changing on the cue frame and reaches
// it within three frames; the prior value is held before the first cue.
export const stepTo = (frame: number, cues: number[], values: number[]): number => {
  if (cues.length !== values.length || cues.length === 0) {
    throw new Error('stepTo requires equally sized non-empty cue and value lists');
  }
  let active = -1;
  for (let i = 0; i < cues.length; i++) {
    if (frame >= cues[i]) active = i;
    else break;
  }
  if (active < 0) return values[0];
  const from = active === 0 ? values[0] : values[active - 1];
  const to = values[active];
  const progress = Math.min(1, Math.max(0, (frame - cues[active] + 1) / 3));
  return from + (to - from) * progress;
};
