#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  chmodSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  consumeCommittedDirectorPlanSnapshot,
  deriveDirectorPlanPublicationPaths,
  publishDirectorPlanExclusiveForTest,
  validateDirectorPlanPublicationJournal,
} from '../scripts/compile-director-plan.mjs';
import {emitRenderCommands} from '../scripts/emit-render-command.mjs';
import {
  assertCommittedDirectorOutputPlan,
  readCommittedDirectorOutputPlan,
  revalidateCommittedDirectorOutputPlan,
} from '../scripts/validate-director-output.mjs';

function expectCode(code, callback) {
  assert.throws(callback, (error) => error?.code === code, code);
}

function captureError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  assert.fail('Expected an exception');
}

function publishProbe(outputPath, plan) {
  const bytes = Buffer.from(`${JSON.stringify(plan)}\n`);
  const publication = publishDirectorPlanExclusiveForTest({
    outputPath,
    bytes,
    revalidate: () => {},
  });
  return {bytes, publication};
}

const fixtureRoot = realpathSync(
  mkdtempSync(path.join(realpathSync(tmpdir()), 'director-publication-consumer-test-')),
);

try {
  const requestPath = path.join(fixtureRoot, 'request.json');
  writeFileSync(requestPath, '{"schemaVersion":"consumer-request-probe/v1"}\n');

  const publishedPath = path.join(fixtureRoot, 'published-plan.json');
  const publishedPlan = {
    schemaVersion: 'consumer-plan-probe/v1',
    executionMode: 'renderable',
    commands: [],
  };
  const {bytes: publishedBytes, publication} = publishProbe(publishedPath, publishedPlan);
  const entrySnapshot = readCommittedDirectorOutputPlan(publishedPath);
  assert.deepEqual(entrySnapshot.plan, publishedPlan);
  assert.deepEqual(entrySnapshot.publicationReceipt, publication.publicationReceipt);
  assert.deepEqual(
    assertCommittedDirectorOutputPlan(publishedPlan, publishedPath).publicationReceipt,
    publication.publicationReceipt,
  );
  assert.deepEqual(
    revalidateCommittedDirectorOutputPlan(entrySnapshot, {phase: 'consumer-test-return'})
      .publicationReceipt,
    publication.publicationReceipt,
  );
  expectCode('DIRECTOR_PLAN_PUBLICATION_ASYNC_CONSUMER_FORBIDDEN', () =>
    consumeCommittedDirectorPlanSnapshot(
      publishedPath,
      () => Promise.resolve(null),
    ));
  expectCode('DIRECTOR_OUTPUT_PUBLICATION_PLAN_ARGUMENT_MISMATCH', () =>
    assertCommittedDirectorOutputPlan({...publishedPlan, commands: [{id: 'foreign'}]}, publishedPath));
  expectCode('DIRECTOR_PLAN_PUBLICATION_COMMIT_MISSING', () =>
    validateDirectorPlanPublicationJournal({
      outputPath: publishedPath,
      expectedBytes: Buffer.from(JSON.stringify(publishedPlan)),
    }));

  const legacyPath = path.join(fixtureRoot, 'legacy-plan-without-journal.json');
  writeFileSync(legacyPath, publishedBytes);
  expectCode('DIRECTOR_PLAN_PUBLICATION_COMMIT_MISSING', () =>
    readCommittedDirectorOutputPlan(legacyPath));
  expectCode('DIRECTOR_PLAN_PUBLICATION_COMMIT_MISSING', () =>
    emitRenderCommands({
      plan: publishedPlan,
      request: {},
      repoRoot: fixtureRoot,
      planPath: legacyPath,
      requestPath,
    }));

  const validatorPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../scripts/validate-director-output.mjs',
  );
  const emitterPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../scripts/emit-render-command.mjs',
  );
  for (const scriptPath of [validatorPath, emitterPath]) {
    const result = spawnSync(
      process.execPath,
      [scriptPath, '--plan', legacyPath, '--request', requestPath, '--repo-root', fixtureRoot],
      {encoding: 'utf8'},
    );
    assert.equal(result.status, 1, `${scriptPath}:${result.stdout}`);
    assert.match(result.stderr, /DIRECTOR_PLAN_PUBLICATION_COMMIT_MISSING/);
  }

  for (const targetName of ['stagePath', 'outputPath', 'committedPath']) {
    const outputPath = path.join(fixtureRoot, `foreign-${targetName}-plan.json`);
    const {bytes} = publishProbe(outputPath, publishedPlan);
    const publicationPaths = deriveDirectorPlanPublicationPaths(outputPath, bytes);
    unlinkSync(publicationPaths[targetName]);
    writeFileSync(publicationPaths[targetName], bytes);
    chmodSync(publicationPaths[targetName], 0o400);
    const foreignIdentity = lstatSync(publicationPaths[targetName]);
    const foreignPathError = captureError(() =>
      readCommittedDirectorOutputPlan(outputPath));
    assert.equal(
      foreignPathError.code,
      'DIRECTOR_PLAN_PUBLICATION_IDENTITY_MISMATCH',
      foreignPathError.stack,
    );
    assert.deepEqual(readFileSync(publicationPaths[targetName]), bytes);
    assert.equal(lstatSync(publicationPaths[targetName]).ino, foreignIdentity.ino);
    const authorityIdentity = lstatSync(
      targetName === 'stagePath' ? publicationPaths.outputPath : publicationPaths.stagePath,
    );
    assert.notEqual(
      `${foreignIdentity.dev}:${foreignIdentity.ino}`,
      `${authorityIdentity.dev}:${authorityIdentity.ino}`,
    );
  }

  const terminalDriftPath = path.join(fixtureRoot, 'terminal-drift-plan.json');
  const {bytes: terminalDriftBytes} = publishProbe(terminalDriftPath, publishedPlan);
  const terminalDriftPaths = deriveDirectorPlanPublicationPaths(
    terminalDriftPath,
    terminalDriftBytes,
  );
  const terminalDriftSnapshot = readCommittedDirectorOutputPlan(terminalDriftPath);
  for (const filePath of [
    terminalDriftPaths.outputPath,
    terminalDriftPaths.stagePath,
    terminalDriftPaths.committedPath,
  ]) {
    unlinkSync(filePath);
  }
  writeFileSync(terminalDriftPaths.stagePath, terminalDriftBytes);
  chmodSync(terminalDriftPaths.stagePath, 0o400);
  linkSync(terminalDriftPaths.stagePath, terminalDriftPaths.outputPath);
  linkSync(terminalDriftPaths.stagePath, terminalDriftPaths.committedPath);
  const terminalReplacementIdentity = lstatSync(terminalDriftPaths.outputPath);
  assert.notEqual(
    `${terminalReplacementIdentity.dev}:${terminalReplacementIdentity.ino}`,
    `${terminalDriftSnapshot.device}:${terminalDriftSnapshot.inode}`,
  );
  expectCode('DIRECTOR_PLAN_PUBLICATION_SNAPSHOT_DRIFT', () =>
    revalidateCommittedDirectorOutputPlan(terminalDriftSnapshot, {
      phase: 'consumer-test-terminal-drift',
    }));

  const heldTransactionPath = path.join(fixtureRoot, 'held-transaction-plan.json');
  const {bytes: heldTransactionBytes} = publishProbe(heldTransactionPath, publishedPlan);
  const heldTransactionPaths = deriveDirectorPlanPublicationPaths(
    heldTransactionPath,
    heldTransactionBytes,
  );
  const heldTransactionError = captureError(() =>
    consumeCommittedDirectorPlanSnapshot(
      heldTransactionPath,
      (entrySnapshot) => {
        for (const filePath of [
          heldTransactionPaths.outputPath,
          heldTransactionPaths.stagePath,
          heldTransactionPaths.committedPath,
        ]) {
          unlinkSync(filePath);
        }
        writeFileSync(heldTransactionPaths.stagePath, heldTransactionBytes);
        chmodSync(heldTransactionPaths.stagePath, 0o400);
        linkSync(heldTransactionPaths.stagePath, heldTransactionPaths.outputPath);
        linkSync(heldTransactionPaths.stagePath, heldTransactionPaths.committedPath);
        const replacementIdentity = lstatSync(heldTransactionPaths.outputPath);
        assert.notEqual(
          `${replacementIdentity.dev}:${replacementIdentity.ino}`,
          `${entrySnapshot.device}:${entrySnapshot.inode}`,
        );
        return null;
      },
      {phase: 'consumer-test-held-transaction'},
    ));
  assert.equal(
    heldTransactionError.code,
    'DIRECTOR_PLAN_PUBLICATION_OWNERSHIP_DRIFT',
    heldTransactionError.stack,
  );

  const symlinkPath = path.join(fixtureRoot, 'symlink-plan.json');
  const {bytes: symlinkBytes} = publishProbe(symlinkPath, publishedPlan);
  const symlinkPaths = deriveDirectorPlanPublicationPaths(symlinkPath, symlinkBytes);
  unlinkSync(symlinkPaths.committedPath);
  symlinkSync(symlinkPaths.stagePath, symlinkPaths.committedPath);
  captureError(() => readCommittedDirectorOutputPlan(symlinkPath));
  assert.equal(lstatSync(symlinkPaths.committedPath).isSymbolicLink(), true);

  const badDirectoryPath = path.join(fixtureRoot, 'bad-directory-plan.json');
  const {bytes: badDirectoryBytes} = publishProbe(badDirectoryPath, publishedPlan);
  const badDirectoryPaths = deriveDirectorPlanPublicationPaths(
    badDirectoryPath,
    badDirectoryBytes,
  );
  chmodSync(badDirectoryPaths.outputJournalDirectory, 0o755);
  expectCode('DIRECTOR_PLAN_PUBLICATION_JOURNAL_DIRECTORY_INVALID', () =>
    readCommittedDirectorOutputPlan(badDirectoryPath));

  const badRootContainer = path.join(fixtureRoot, 'bad-root-container');
  mkdirSync(badRootContainer, {mode: 0o700});
  const badRootPath = path.join(badRootContainer, 'bad-root-plan.json');
  const {bytes: badRootBytes} = publishProbe(badRootPath, publishedPlan);
  const badRootPaths = deriveDirectorPlanPublicationPaths(badRootPath, badRootBytes);
  chmodSync(badRootPaths.journalRoot, 0o755);
  expectCode('DIRECTOR_PLAN_PUBLICATION_JOURNAL_DIRECTORY_INVALID', () =>
    readCommittedDirectorOutputPlan(badRootPath));

  const validatorSource = readFileSync(validatorPath, 'utf8');
  const emitterSource = readFileSync(emitterPath, 'utf8');
  const compilerSource = readFileSync(
    new URL('../scripts/compile-director-plan.mjs', import.meta.url),
    'utf8',
  );
  assert.match(validatorSource, /consumeCommittedDirectorOutputPlan\(planPath,/);
  assert.doesNotMatch(validatorSource, /readFileSync\(planPath,\s*['"]utf8['"]\)/);
  assert.match(emitterSource, /consumeCommittedDirectorOutputPlan\(planPath,/);
  assert.doesNotMatch(emitterSource, /readFileSync\(planPath,\s*['"]utf8['"]\)/);
  const transactionStart = compilerSource.indexOf(
    'export function consumeCommittedDirectorPlanSnapshot',
  );
  const transactionEntryGate = compilerSource.indexOf(
    'const entryReceipt = validateDirectorPlanPublicationJournalCore',
    transactionStart,
  );
  const transactionConsumer = compilerSource.indexOf(
    'const value = consumer(entrySnapshot)',
    transactionEntryGate,
  );
  const transactionTerminalGate = compilerSource.indexOf(
    'const terminalReceipt = validateDirectorPlanPublicationJournalCore',
    transactionConsumer,
  );
  const transactionClose = compilerSource.indexOf(
    'closeSync(heldFinalSnapshot.descriptor)',
    transactionTerminalGate,
  );
  assert.ok(
    transactionStart >= 0 &&
      transactionEntryGate > transactionStart &&
      transactionConsumer > transactionEntryGate &&
      transactionTerminalGate > transactionConsumer &&
      transactionClose > transactionTerminalGate,
  );
  const validatorMain = validatorSource.indexOf('async function main()');
  const validatorEntryGate = validatorSource.indexOf(
    'consumeCommittedDirectorOutputPlan(planPath',
    validatorMain,
  );
  const validatorSemanticGate = validatorSource.indexOf(
    'validateDirectorOutput(plan,',
    validatorEntryGate,
  );
  const validatorStdout = validatorSource.indexOf('process.stdout.write', validatorSemanticGate);
  assert.ok(
    validatorMain >= 0 &&
      validatorEntryGate > validatorMain &&
      validatorSemanticGate > validatorEntryGate &&
      validatorStdout > validatorSemanticGate,
  );
  const emitterStart = emitterSource.indexOf('export function emitRenderCommands');
  const emitterEntryGate = emitterSource.indexOf(
    'consumeCommittedDirectorOutputPlan(planPath',
    emitterStart,
  );
  const emitterSemanticGate = emitterSource.indexOf(
    'validateDirectorOutput(committedPlan,',
    emitterEntryGate,
  );
  const emitterConsumptionResult = emitterSource.indexOf(
    'const {committedPlan, commands} = consumption.value',
    emitterSemanticGate,
  );
  const emitterReturn = emitterSource.indexOf('return {', emitterConsumptionResult);
  assert.ok(
    emitterStart >= 0 &&
      emitterEntryGate > emitterStart &&
      emitterSemanticGate > emitterEntryGate &&
      emitterConsumptionResult > emitterSemanticGate &&
      emitterReturn > emitterConsumptionResult,
  );
  for (const source of [validatorSource, emitterSource]) {
    assert.match(source, /publicationState:\s*'committed-revalidated'/);
    assert.match(source, /recoveryValidationPerformed:\s*true/);
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    committedSnapshotUsesExactFinalBytes: true,
    legacyFinalWithoutJournalRejected: true,
    directEmitterCannotBypassJournal: true,
    validatorAndEmitterCliFailClosed: true,
    allThreeForeignPathsRejectedWithoutCleanup: true,
    terminalSnapshotDriftRejected: true,
    heldFinalDescriptorSpansSemanticConsumer: true,
    symlinkRejectedWithoutCleanup: true,
    privateJournalModeRequired: true,
    entrySemanticTerminalOrderingFixed: true,
    explicitRecoveryValidationState: true,
  })}\n`);
} finally {
  rmSync(fixtureRoot, {recursive: true, force: true});
}
