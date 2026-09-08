import test from 'node:test';
import assert from 'node:assert/strict';
import {selectStillFrames} from '../prepare-request.v1.mjs';

const plan = () => ({
  semantic: Array.from({length: 36}, (_, i) => ({id: `s${i}`, from: 400 + i * 160, to: 520 + i * 160, title: 'fixture'})),
  effects: Array.from({length: 15}, (_, i) => ({id: `e${i}`, from: 800 + i * 170, to: 900 + i * 170, words: ['fixture']})),
  qaKeyframes: {openingWords: [{id: 'first', text: 'fixture-one', frame: 30}, {id: 'second', text: 'fixture-two', frame: 55}],
    officialReveals: [{id: 'line-1', text: 'fixture-line-1', frame: 2350}, {id: 'line-2', text: 'fixture-line-2', frame: 2480}]},
});

test('all 36 semantic, 15 effects, two opening words and all official reveals are mapped', () => {
  const p = plan(); const result = selectStillFrames(p);
  assert.equal(result.coverage.length, 55);
  assert.deepEqual(result.counts, {semantic: 36, effects: 15, openingWords: 2, officialReveals: 2, uniqueFrames: result.stillFrames.length});
  for (const point of result.coverage) {
    assert.ok(result.stillFrames.includes(point.frame));
    if (point.coverageWindow) assert.ok(point.frame >= point.coverageWindow[0] && point.frame <= point.coverageWindow[1]);
  }
  assert.equal(result.allFramesReviewed, false);
  assert.equal(result.fullRenderPendingParentStillReview, true);
});

test('keyword-reveal uses a frame after the final word enters', () => {
  const p = plan(); Object.assign(p.effects[0], {effectId: 'keyword-reveal', wordFrames: [0, 82]});
  const point = selectStillFrames(p).coverage.find(p => p.kind === 'effects' && p.id === 'e0');
  assert.equal(point.frame, 890);
});

test('missing scenes or explicit reveal markers fail instead of silently guessing', () => {
  for (const change of [p => p.semantic.pop(), p => p.effects.pop(), p => delete p.qaKeyframes,
    p => p.qaKeyframes.openingWords.pop(), p => p.qaKeyframes.officialReveals = [],
    p => p.qaKeyframes.officialReveals[0].frame = 2614]) {
    const p = plan(); change(p); assert.throws(() => selectStillFrames(p));
  }
});

test('matching frames deduplicate without losing scene coverage', () => {
  const p = plan(); Object.assign(p.effects[0], {from: p.semantic[0].from, to: p.semantic[0].to});
  const result = selectStillFrames(p);
  assert.equal(result.coverage.length, 55);
  assert.ok(result.stillFrames.length < result.coverage.length);
});

test('more than 64 unique frames is rejected without dropping requested reveals', () => {
  const p = plan(); p.qaKeyframes.officialReveals = Array.from({length: 30}, (_, i) => ({id: `line-${i}`, text: 'fixture', frame: 2340 + i}));
  assert.throws(() => selectStillFrames(p), /KEYFRAME_LIMIT_EXCEEDED/);
});
