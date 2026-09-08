import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const owned = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(owned, '../../../..');
const relative = (name) => path.relative(root, path.join(owned, name));
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const bind = (name) => ({path: relative(name), sha256: sha(fs.readFileSync(path.join(owned, name)))});
const write = (name, value) => {
  assert.equal(path.basename(name), name);
  fs.writeFileSync(path.join(owned, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});
  return bind(name);
};
const previousBinding = bind('output-selection.derived.v1.json');
const failedValidation = bind('output-derived-validation.v1.json');
const previous = JSON.parse(fs.readFileSync(path.join(owned, 'output-selection.derived.v1.json')));
const selection = structuredClone(previous);
const revisedIds = ['output-c017', 'output-c018'];
const changes = [];
for (const beatId of revisedIds) {
  const beat = selection.beats.find((entry) => entry.beatId === beatId);
  assert.equal(beat.effectId, 'evidence-scan');
  assert.equal(beat.componentProps.label, '');
  assert.ok(beat.texts[0]);
  beat.componentProps.label = beat.texts[0];
  beat.implementationProps = {
    scope: 'parent-R2-scoped-CSS-candidate-only-not-shared-adapter-API',
    appliesTo: 'EvidenceScan-last-label-element',
    labelRectOverride: {left: 52, top: 600, width: 1066, height: 63},
    coordinateSystem: 'effect-region-local-pixels',
    labelPrefix: '口播：',
    labelVisible: true,
    componentLabelMustRemainExact: true,
    sharedAdapterCapabilityClaimed: false,
    parentRenderedImplementationVerified: false,
  };
  changes.push({beatId, label: {from: '', to: beat.texts[0]}, implementationProps: beat.implementationProps});
}
assert.equal(selection.beats.filter((beat) => beat.decision === 'apply').length, 15);
for (const previousBeat of previous.beats) {
  const next = structuredClone(selection.beats.find((beat) => beat.beatId === previousBeat.beatId));
  if (revisedIds.includes(next.beatId)) {
    next.componentProps.label = previousBeat.componentProps.label;
    delete next.implementationProps;
  }
  assert.deepEqual(next, previousBeat, `超出两项label与CSS记录的改动：${previousBeat.beatId}`);
}
selection.revisionId = 'candidate-preview-r2-derived-application-v2';
selection.derivation = {...previous.derivation,
  generatedAt: new Date().toISOString(),
  changes,
  inheritedV1Changes: previous.derivation.changes,
  parentDerivedV1: previousBinding,
  preservedFailedValidation: failedValidation,
  revisionReason: '按父确认仅恢复c017/c018原实录label；R2可见口播前缀及底部标签位置仅记为局部CSS，不改共享库。',
  otherBeatFieldsUnchanged: true,
  applicationReceiptCreated: false,
  renderVerified: false,
};
const selectionBinding = write('output-selection.derived.v2.json', selection);
const args = ['skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs', selectionBinding.path, root];
const execution = spawnSync(process.execPath, args, {cwd: root, encoding: 'utf8'});
write('output-derived-validation.stdout.v2.txt', execution.stdout ?? '');
write('output-derived-validation.stderr.v2.txt', execution.stderr ?? '');
let result;
try {result = JSON.parse(execution.stdout);} catch {result = {stdout: execution.stdout};}
const validation = write('output-derived-validation.v2.json', {
  schemaVersion: 'R2-director-selection-validation-execution/v1', generatedAt: new Date().toISOString(),
  executable: process.execPath, args, exit: execution.status, error: execution.error?.message ?? null,
  result, selection: selectionBinding, semanticScope: 'selection-contract-only-not-render-or-audio-qa', formal: false,
});
assert.deepEqual(bind('output-selection.derived.v1.json'), previousBinding);
assert.deepEqual(bind('output-derived-validation.v1.json'), failedValidation);
const receipt = write('contract-handoff.v2.json', {
  schemaVersion: 'R2-evidence-contract-handoff/v1', generatedAt: new Date().toISOString(),
  status: execution.status === 0 ? 'selection-valid-awaiting-parent-scoped-CSS-consumption' : 'blocked-existing-validator-contract',
  selection: selectionBinding, validation, validationExit: execution.status, result,
  previousSelectionPreserved: previousBinding, failedValidationPreserved: failedValidation,
  changedBeatIds: revisedIds, originalFramesTextsWordsAndOtherPropsUnchanged: true,
  parentCompositionModifiedByThisWorker: false, sharedSkillModified: false,
  labelHidden: false, finalWorking: false, formal: false, renderPerformed: false,
});
console.log(JSON.stringify({selection: selectionBinding, validation, receipt, exit: execution.status, result}, null, 2));
process.exitCode = execution.status ?? 1;
