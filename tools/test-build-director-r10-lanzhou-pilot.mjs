import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {
  LanzhouR10BuildError,
  buildLanzhouR10Pilot,
  LANZHOU_R10_COMPILE_RECEIPT_PATH,
  LANZHOU_R10_INTENT_PATH,
  LANZHOU_R10_RUNTIME_PATH,
} from './build-director-r10-lanzhou-pilot.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const expectCode = (code, callback) => {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof LanzhouR10BuildError);
    assert.equal(error.code, code);
    return true;
  });
};

const first = buildLanzhouR10Pilot({projectRoot});
const second = buildLanzhouR10Pilot({projectRoot});
assert.equal(first.runtimeBytes, second.runtimeBytes);
assert.equal(first.receiptBytes, second.receiptBytes);
assert.equal(
  first.runtimeBytes,
  readFileSync(path.join(projectRoot, LANZHOU_R10_RUNTIME_PATH), 'utf8'),
);
assert.equal(
  first.receiptBytes,
  readFileSync(path.join(projectRoot, LANZHOU_R10_COMPILE_RECEIPT_PATH), 'utf8'),
);

assert.equal(first.runtime.fps, 30);
assert.equal(first.runtime.durationFrames, 1737);
assert.equal(first.receipt.localSourceOffsetFrame, 1200);
assert.equal(first.receipt.durationFrames, 1737);
assert.equal(first.receipt.status, 'compiled-sidecar-not-rendered');
assert.equal(first.receipt.productionEligible, false);
assert.deepEqual(first.runtime.events.map((event) => event.beatId), [
  'b05',
  'b06',
  'b07',
  'b08',
]);
assert.deepEqual(first.runtime.events.map((event) => event.component), [
  'ContrastLedgerR10',
  'OwnerQuestionArchiveR10',
  'PaperBusinessPipelineR10',
  'VisibilityBridgeR10',
]);
assert.ok(first.runtime.soundCues.every((cue) => /^sfx\/[^/]+\.wav$/u.test(cue.source)));

const b07 = first.runtime.events.find((event) => event.beatId === 'b07');
assert.ok(b07);
assert.equal(Object.keys(b07.semanticBinding.namedAnchors).length, 6);
assert.deepEqual(
  Object.fromEntries(
    Object.entries(b07.semanticBinding.namedAnchors).map(([name, anchor]) => [
      name,
      anchor.captionIds,
    ]),
  ),
  {
    'ai-classify': ['cap-b07-p02'],
    'ai-production': ['cap-b07-p05'],
    'business-foundation': ['cap-b07-p06'],
    collect: ['cap-b07-p01'],
    'public-materials': ['cap-b07-p04'],
    'script-draft': ['cap-b07-p03'],
  },
);
assert.deepEqual(b07.actions.map((action) => action.id), [
  'collect',
  'ai-classify',
  'script-draft',
  'public-materials',
  'ai-production',
  'business-foundation',
]);
assert.deepEqual(
  b07.actions.map((action) => action.sound.role),
  [
    'paper-collect',
    'paper-ai-classify',
    'paper-script-draft',
    'paper-public-materials',
    'paper-ai-production',
    'paper-business-foundation',
  ],
);
assert.ok(b07.actions.every((action) => action.soundRequired));
assert.ok(b07.endFrameExclusive - b07.actionEndFrame >= 30);
assert.equal(b07.props.objectGroups.length, 6);
assert.equal(b07.props.semanticNodes.length, 10);
assert.equal(b07.props.depthLayers, 3);
assert.deepEqual(b07.props.assemblyBeatIds, b07.actions.map((action) => action.id));
assert.deepEqual(
  b07.props.semanticNodes.map((node) => node.captionId),
  [
    'cap-b07-p01',
    'cap-b07-p01',
    'cap-b07-p02',
    'cap-b07-p02',
    'cap-b07-p03',
    'cap-b07-p03',
    'cap-b07-p04',
    'cap-b07-p04',
    'cap-b07-p05',
    'cap-b07-p06',
  ],
);
assert.equal(
  first.runtime.soundCues.filter((cue) => cue.eventId === b07.id).length,
  6,
);

assert.equal(first.receipt.legacyPostshootAudit.timingAuthorityUsed, false);
assert.equal(first.receipt.legacyPostshootAudit.tailFlattenDetected, true);
assert.equal(first.receipt.legacyPostshootAudit.legacyB07GranularActionCount, 4);
assert.equal(first.receipt.legacyPostshootAudit.r10B07ActionCount, 6);
assert.equal(first.receipt.componentRegistryAudit.paperStructureTargetValid, true);
assert.ok(first.receipt.sourceFiles.every((source) => /^[a-f0-9]{64}$/u.test(source.sha256)));
assert.equal(first.receipt.governanceFiles.length, 6);
assert.ok(first.receipt.governanceFiles.every((source) => source.application.length > 0));
assert.ok(first.receipt.sfxFiles.every((source) => source.gitTracked));
assert.ok(first.receipt.sfxFiles.every((source) => source.byteIdentical));
assert.ok(
  first.receipt.sfxFiles.every((source) =>
    existsSync(path.join(projectRoot, source.publicPath)),
  ),
);

const virtualRead = (mutate) => (filePath, encoding) => {
  const original = readFileSync(filePath, encoding);
  return mutate(path.relative(projectRoot, filePath), original);
};

const absoluteTimingReader = virtualRead((relativePath, original) => {
  if (relativePath !== LANZHOU_R10_INTENT_PATH) return original;
  const intent = JSON.parse(original);
  intent.events[0].startSeconds = 40.3;
  return `${JSON.stringify(intent, null, 2)}\n`;
});
expectCode('R10_LANZHOU_INTENT_ABSOLUTE_TIMING_FORBIDDEN', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: absoluteTimingReader}),
);

const changedBoundaryReader = virtualRead((relativePath, original) => {
  if (!relativePath.endsWith('actual-spoken.bilingual.candidate.v1.json')) {
    return original;
  }
  const captions = JSON.parse(original);
  captions.captions.find((caption) => caption.id === 'cap-b07-p02').startMs += 100;
  return `${JSON.stringify(captions, null, 2)}\n`;
});
expectCode('R10_LANZHOU_SOURCE_SHA_MISMATCH', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: changedBoundaryReader}),
);

const changedBindingHashReader = virtualRead((relativePath, original) => {
  if (relativePath !== LANZHOU_R10_INTENT_PATH) return original;
  const intent = JSON.parse(original);
  intent.sourceBindings[0].sha256 = 'f'.repeat(64);
  return `${JSON.stringify(intent, null, 2)}\n`;
});
expectCode('R10_LANZHOU_SOURCE_SHA_MISMATCH', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: changedBindingHashReader}),
);

const legacyRendererReader = virtualRead((relativePath, original) => {
  if (relativePath !== LANZHOU_R10_INTENT_PATH) return original;
  const intent = JSON.parse(original);
  intent.events[0].componentId = 'r10-generic-specific-contrast';
  return `${JSON.stringify(intent, null, 2)}\n`;
});
expectCode('R10_LANZHOU_COMPONENT_NOT_REGISTERED', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: legacyRendererReader}),
);

const hiddenRuntimeRemapReader = virtualRead((relativePath, original) => {
  if (relativePath !== LANZHOU_R10_INTENT_PATH) return original;
  const intent = JSON.parse(original);
  intent.events[0].sound.source =
    'remotion/public/audio/koubo-sfx-v8/v2-keyword-select.wav';
  return `${JSON.stringify(intent, null, 2)}\n`;
});
expectCode('R10_LANZHOU_SFX_RUNTIME_SOURCE_INVALID', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: hiddenRuntimeRemapReader}),
);

const changedSfxSourceShaReader = virtualRead((relativePath, original) => {
  if (relativePath !== LANZHOU_R10_INTENT_PATH) return original;
  const intent = JSON.parse(original);
  intent.events[0].sound.sourceAsset.sha256 = 'f'.repeat(64);
  return `${JSON.stringify(intent, null, 2)}\n`;
});
expectCode('R10_LANZHOU_SFX_SOURCE_SHA_MISMATCH', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: changedSfxSourceShaReader}),
);

const changedPublicSfxReader = virtualRead((relativePath, original) => {
  if (
    relativePath !==
    'remotion/public-lanzhou-industry-ai-v91-r1/sfx/v2-keyword-select.wav'
  ) {
    return original;
  }
  return Buffer.concat([Buffer.from(original), Buffer.from([0])]);
});
expectCode('R10_LANZHOU_SFX_COPY_MISMATCH', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: changedPublicSfxReader}),
);

const missingPaperActionSoundReader = virtualRead((relativePath, original) => {
  if (relativePath !== LANZHOU_R10_INTENT_PATH) return original;
  const intent = JSON.parse(original);
  delete intent.events.find((event) => event.sourceBeatId === 'B07').actions[3].sound;
  return `${JSON.stringify(intent, null, 2)}\n`;
});
assert.throws(
  () => buildLanzhouR10Pilot({projectRoot, readFile: missingPaperActionSoundReader}),
  (error) => {
    assert.equal(error.code, 'R10_ACTION_SOUND_REQUIRED');
    return true;
  },
);

const tooFewPaperNodesReader = virtualRead((relativePath, original) => {
  if (relativePath !== LANZHOU_R10_INTENT_PATH) return original;
  const intent = JSON.parse(original);
  intent.events.find((event) => event.sourceBeatId === 'B07').paperStructure.semanticNodes =
    intent.events
      .find((event) => event.sourceBeatId === 'B07')
      .paperStructure.semanticNodes.slice(0, 8);
  return `${JSON.stringify(intent, null, 2)}\n`;
});
expectCode('R10_LANZHOU_PAPER_STRUCTURE_COUNT_INVALID', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: tooFewPaperNodesReader}),
);

const fourAssemblyBeatsReader = virtualRead((relativePath, original) => {
  if (relativePath !== LANZHOU_R10_INTENT_PATH) return original;
  const intent = JSON.parse(original);
  intent.events
    .find((event) => event.sourceBeatId === 'B07')
    .paperStructure.assemblyBeatIds = ['collect', 'ai-classify', 'script-draft', 'public-materials'];
  return `${JSON.stringify(intent, null, 2)}\n`;
});
expectCode('R10_LANZHOU_PAPER_STRUCTURE_COUNT_INVALID', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: fourAssemblyBeatsReader}),
);

const orphanPaperNodeReader = virtualRead((relativePath, original) => {
  if (relativePath !== LANZHOU_R10_INTENT_PATH) return original;
  const intent = JSON.parse(original);
  intent.events
    .find((event) => event.sourceBeatId === 'B07')
    .paperStructure.semanticNodes[0].objectGroupId = 'g-renderer-hardcode';
  return `${JSON.stringify(intent, null, 2)}\n`;
});
expectCode('R10_LANZHOU_PAPER_NODE_GROUP_INVALID', () =>
  buildLanzhouR10Pilot({projectRoot, readFile: orphanPaperNodeReader}),
);

console.log('build-director-r10-lanzhou-pilot tests passed');
