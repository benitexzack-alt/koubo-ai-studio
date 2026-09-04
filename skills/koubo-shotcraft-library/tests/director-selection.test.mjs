import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDirectorSelection} from '../scripts/validate-director-selection.mjs';
import {captions, makeNotNeeded, registry, selectionFixture} from './fixtures/v9-contract-fixtures.mjs';

test('已注册效果在允许的主画面上下文通过', () => {
  assert.deepEqual(validateDirectorSelection(selectionFixture(), captions, registry), []);
});

test('eligible beat 缺少显式决定时失败', () => {
  const selection = selectionFixture();
  delete selection.beats[0].decision;
  assert.ok(validateDirectorSelection(selection, captions, registry).includes('SHOTCRAFT_DECISION_REQUIRED:beat-001'));
});

test('效果与主画面上下文错配时失败', () => {
  const selection = selectionFixture();
  selection.beats[0].mainVisual = 'real-evidence';
  assert.ok(validateDirectorSelection(selection, captions, registry).includes('SHOTCRAFT_EFFECT_CONTEXT_MISMATCH:beat-001'));
});

test('非 V9 导演上下文失败', () => {
  const selection = selectionFixture();
  selection.directorProfile.profileVersion = '8.0.0';
  assert.ok(validateDirectorSelection(selection, captions, registry).includes('SHOTCRAFT_V9_DIRECTOR_PROFILE_REQUIRED'));
});

for (const mainVisual of ['paper-editorial', 'generated-video']) {
  test(`${mainVisual} 内部禁止应用 Shotcraft`, () => {
    const selection = selectionFixture();
    selection.beats[0].mainVisual = mainVisual;
    assert.ok(validateDirectorSelection(selection, captions, registry).includes('SHOTCRAFT_CONTEXT_FORBIDDEN:beat-001'));
  });
}

test('禁入主画面不能靠省略 decision 保留 Shotcraft 应用字段', () => {
  const selection = selectionFixture();
  selection.beats[0].mainVisual = 'paper-editorial';
  delete selection.beats[0].decision;
  assert.ok(validateDirectorSelection(selection, captions, registry).includes('SHOTCRAFT_APPLICATION_FIELDS_WITHOUT_APPLY:beat-001'));
});

test('零选择时，eligible beat 的具体 not-needed 理由通过', () => {
  assert.deepEqual(validateDirectorSelection(makeNotNeeded(selectionFixture()), captions, registry), []);
});

test('占位式 not-needed 理由失败', () => {
  const selection = makeNotNeeded(selectionFixture(), '本段不需要 Shotcraft 效果');
  assert.ok(validateDirectorSelection(selection, captions, registry).includes('SHOTCRAFT_NOT_NEEDED_REASON_REQUIRED:beat-001'));
});

test('未注册效果失败', () => {
  const selection = selectionFixture();
  selection.beats[0].effectId = 'remote-unregistered-effect';
  assert.ok(validateDirectorSelection(selection, captions, registry).includes('SHOTCRAFT_EFFECT_NOT_REGISTERED:beat-001'));
});

test('任何层级的机械配额字段都失败', () => {
  const selection = selectionFixture();
  selection.policy = {minimumApplications: 3};
  assert.ok(validateDirectorSelection(selection, captions, registry).includes('SHOTCRAFT_MECHANICAL_QUOTA_FORBIDDEN'));
});
