import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  validateApplicationReceipt,
  validateApplicationReceiptFiles,
} from '../scripts/validate-application-receipt.mjs';
import {
  captions,
  hash,
  makeNotNeeded,
  receiptFixture,
  registry,
  registryBytes,
  selectionFixture,
} from './fixtures/v9-contract-fixtures.mjs';

test('同 beat、效果、帧窗、组件与成片哈希的应用回执通过', () => {
  const selection = selectionFixture();
  assert.deepEqual(validateApplicationReceipt(receiptFixture(selection), selection, registry), []);
});

test('导演已选 apply 而成片回执未应用时失败', () => {
  const selection = selectionFixture();
  const receipt = receiptFixture(selection);
  receipt.applications = [];
  assert.ok(validateApplicationReceipt(receipt, selection, registry).includes('SHOTCRAFT_SELECTED_NOT_APPLIED:beat-001'));
});

for (const [name, mutate] of [
  ['effectId', (application) => { application.effectId = 'keyword-reveal'; }],
  ['frames', (application) => { application.frames.endFrameExclusive = 89; }],
  ['component', (application) => { application.component.name = 'KeywordReveal'; }],
]) {
  test(`已选择项的 ${name} 失配时报告未实际应用`, () => {
    const selection = selectionFixture();
    const receipt = receiptFixture(selection);
    mutate(receipt.applications[0]);
    assert.ok(validateApplicationReceipt(receipt, selection, registry).includes('SHOTCRAFT_SELECTED_NOT_APPLIED:beat-001'));
  });
}

test('计划零选择且所有 eligible beat 有显式理由时，零应用回执合法', () => {
  const selection = makeNotNeeded(selectionFixture());
  const receipt = receiptFixture(selection);
  receipt.applications = [];
  assert.deepEqual(validateApplicationReceipt(receipt, selection, registry), []);
});

test('计划零选择时不得反向出现未选择应用', () => {
  const selection = makeNotNeeded(selectionFixture());
  assert.ok(validateApplicationReceipt(receiptFixture(selection), selection, registry).includes('SHOTCRAFT_UNSELECTED_APPLIED:beat-001'));
});

test('文件级回执复检选择、字幕、注册表、组件与成片哈希', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotcraft-v9-'));
  try {
    const write = (relativePath, bytes) => {
      const absolute = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolute), {recursive: true});
      fs.writeFileSync(absolute, bytes);
      return {path: relativePath, sha256: hash(bytes)};
    };
    const registryBinding = write('skills/koubo-shotcraft-library/registry.v1.json', registryBytes);
    const componentBytes = fs.readFileSync(path.resolve(import.meta.dirname, '../assets/ShotcraftEffects.tsx'));
    const componentBinding = write('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx', componentBytes);
    const captionsBytes = Buffer.from(JSON.stringify(captions));
    const captionsBinding = write('edit/test/actual-captions.json', captionsBytes);
    const outputBinding = write('outputs/test-v9.mp4', Buffer.from('deterministic-test-output'));

    const selection = selectionFixture();
    selection.registry = registryBinding;
    selection.captions = captionsBinding;
    const selectionBytes = Buffer.from(JSON.stringify(selection));
    const selectionBinding = write('edit/test/director-selection.json', selectionBytes);

    const receipt = receiptFixture(selection);
    receipt.selection = selectionBinding;
    receipt.output = outputBinding;
    receipt.applications[0].component = {name: 'MarkerUnderline', ...componentBinding};
    receipt.applications[0].outputSha256 = outputBinding.sha256;

    assert.deepEqual(await validateApplicationReceiptFiles(receipt, root), []);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('文件级组件哈希失配同时报告已选择但未应用', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotcraft-v9-hash-'));
  try {
    const write = (relativePath, bytes) => {
      const absolute = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolute), {recursive: true});
      fs.writeFileSync(absolute, bytes);
      return {path: relativePath, sha256: hash(bytes)};
    };
    const selection = selectionFixture();
    selection.registry = write('skills/koubo-shotcraft-library/registry.v1.json', registryBytes);
    selection.captions = write('edit/test/actual-captions.json', Buffer.from(JSON.stringify(captions)));
    const selectionBinding = write('edit/test/director-selection.json', Buffer.from(JSON.stringify(selection)));
    const outputBinding = write('outputs/test-v9.mp4', Buffer.from('deterministic-test-output'));
    write('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx', Buffer.from('component-on-disk'));

    const receipt = receiptFixture(selection);
    receipt.selection = selectionBinding;
    receipt.output = outputBinding;
    receipt.applications[0].component.sha256 = hash('different-component');
    receipt.applications[0].outputSha256 = outputBinding.sha256;

    const errors = await validateApplicationReceiptFiles(receipt, root);
    assert.ok(errors.includes('SHOTCRAFT_COMPONENT_HASH_MISMATCH:beat-001'));
    assert.ok(errors.includes('SHOTCRAFT_SELECTED_NOT_APPLIED:beat-001'));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
