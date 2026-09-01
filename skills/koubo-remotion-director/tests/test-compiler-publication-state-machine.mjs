#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {
  attachDirectorPlanPublicationInputSnapshots,
  deriveDirectorPlanPublicationPaths,
  publishDirectorPlanExclusive,
  publishDirectorPlanExclusiveForTest,
  readVerifiedJsonSnapshot,
  revalidateDirectorPlanPublicationInputs,
  revalidatePlanFileBindings,
  revalidateRequestForPublication,
  revalidateVerifiedFileSnapshot,
  sha256File,
  sha256Text,
  stableStringify,
  validateDirectorPlanPublicationJournal,
} from '../scripts/compile-director-plan.mjs';

function expectCode(code, callback) {
  assert.throws(callback, (error) => error?.code === code, code);
}

function captureCode(code, callback) {
  try {
    callback();
  } catch (error) {
    assert.equal(error?.code, code, error?.stack);
    return error;
  }
  assert.fail(`Missing expected exception: ${code}`);
}

function mode(stat) {
  return stat.mode & 0o777;
}

function assertPrivateJournalDirectory(directoryPath, expectedDevice) {
  const stat = lstatSync(directoryPath);
  assert.equal(stat.isDirectory(), true);
  assert.equal(stat.isSymbolicLink(), false);
  assert.equal(stat.dev, expectedDevice);
  assert.equal(stat.uid, process.getuid());
  assert.equal(mode(stat), 0o700);
  assert.equal(realpathSync(directoryPath), directoryPath);
}

function assertRegularPath(filePath, expectedBytes, expectedMode) {
  const stat = lstatSync(filePath);
  assert.equal(stat.isFile(), true);
  assert.equal(stat.isSymbolicLink(), false);
  assert.equal(mode(stat), expectedMode);
  assert.deepEqual(readFileSync(filePath), expectedBytes);
  return stat;
}

function assertSameInode(paths, expectedBytes) {
  const stats = paths.map((filePath) => assertRegularPath(filePath, expectedBytes, 0o400));
  assert.equal(new Set(stats.map((stat) => `${stat.dev}:${stat.ino}`)).size, 1);
  return stats[0];
}

const fixtureRoot = realpathSync(
  mkdtempSync(path.join(realpathSync(tmpdir()), 'director-plan-publication-test-')),
);

try {
  const publicationSnapshotProbe = {
    schemaVersion: 'test-plan/v1',
    chain: {chainSha256: 'a'.repeat(64)},
  };
  const publicationSnapshotProbeJson = JSON.stringify(publicationSnapshotProbe);
  const publicationSnapshotProbeCanonical = stableStringify(publicationSnapshotProbe);
  attachDirectorPlanPublicationInputSnapshots(publicationSnapshotProbe, {
    request: {bytes: Buffer.from('request-snapshot-secret')},
    integrityFiles: {compiler: {bytes: Buffer.from('compiler-snapshot-secret')}},
  });
  assert.equal(JSON.stringify(publicationSnapshotProbe), publicationSnapshotProbeJson);
  assert.equal(stableStringify(publicationSnapshotProbe), publicationSnapshotProbeCanonical);
  const publicationSnapshotSymbols = Object.getOwnPropertySymbols(publicationSnapshotProbe);
  assert.equal(publicationSnapshotSymbols.length, 1);
  assert.equal(
    Object.getOwnPropertyDescriptor(
      publicationSnapshotProbe,
      publicationSnapshotSymbols[0],
    ).enumerable,
    false,
  );

  const requestPath = path.join(fixtureRoot, 'request.json');
  const request = {schemaVersion: 'test-request/v1', status: 'candidate'};
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const requestSnapshot = readVerifiedJsonSnapshot(requestPath, {
    jsonErrorCode: 'DIRECTOR_TEST_REQUEST_JSON_INVALID',
  });
  assert.deepEqual(requestSnapshot.value, request);
  assert.equal(requestSnapshot.sha256, sha256File(requestPath));
  assert.equal(
    requestSnapshot.sha256,
    sha256Text(requestSnapshot.bytes),
    'parsed JSON and SHA must come from the same byte buffer',
  );
  assert.deepEqual(
    revalidateRequestForPublication(request, requestPath, requestSnapshot, {
      phase: 'test-request-stable',
    }).value,
    request,
  );
  writeFileSync(requestPath, `${JSON.stringify({...request, status: 'drifted'}, null, 2)}\n`);
  expectCode('DIRECTOR_REQUEST_PREWRITE_DRIFT', () =>
    revalidateRequestForPublication(request, requestPath, requestSnapshot, {
      phase: 'test-request-drift',
    }));
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  assert.equal(
    revalidateVerifiedFileSnapshot(requestSnapshot, {phase: 'test-request-restored'}).sha256,
    requestSnapshot.sha256,
  );
  expectCode('DIRECTOR_PLAN_REQUEST_CANONICAL_SHA_DRIFT', () =>
    revalidateDirectorPlanPublicationInputs({
      request,
      requestPath,
      plan: {
        render: {},
        provenance: {
          requestCanonicalSha256: '0'.repeat(64),
          integrityAnchors: {},
          fileBindings: [],
          fileBindingsSha256: sha256Text(stableStringify([])),
        },
      },
      repoRoot: fixtureRoot,
      expectedRequestSnapshot: requestSnapshot,
      expectedIntegrityFileSnapshots: {},
      phase: 'test-canonical-before-runtime',
    }));

  const boundFilePath = path.join(fixtureRoot, 'bound-runtime.mjs');
  writeFileSync(boundFilePath, 'export const authority = true;\n');
  const fileBindings = [{
    role: 'runtime',
    id: 'bound-runtime',
    path: boundFilePath,
    sha256: sha256File(boundFilePath),
  }];
  const bindingPlan = {
    provenance: {
      fileBindings,
      fileBindingsSha256: sha256Text(stableStringify(fileBindings)),
    },
  };
  assert.deepEqual(revalidatePlanFileBindings(bindingPlan), fileBindings);
  const conflictingBindings = [
    fileBindings[0],
    {...fileBindings[0], id: 'bound-runtime-conflict', sha256: '0'.repeat(64)},
  ].sort((left, right) =>
    `${left.role}\0${left.id}\0${left.path}`.localeCompare(
      `${right.role}\0${right.id}\0${right.path}`,
    ));
  expectCode('DIRECTOR_PLAN_FILE_BINDING_PATH_SHA_CONFLICT', () =>
    revalidatePlanFileBindings({
      provenance: {
        fileBindings: conflictingBindings,
        fileBindingsSha256: sha256Text(stableStringify(conflictingBindings)),
      },
    }, {phase: 'test-binding-path-conflict'}));
  writeFileSync(boundFilePath, 'export const authority = false;\n');
  expectCode('DIRECTOR_PLAN_FILE_BINDING_SHA_DRIFT', () =>
    revalidatePlanFileBindings(bindingPlan, {phase: 'test-binding-drift'}));

  const successPath = path.join(fixtureRoot, 'success-plan.json');
  const successBytes = Buffer.from('{"ok":true}\n');
  const phases = [];
  const publication = publishDirectorPlanExclusive({
    outputPath: successPath,
    bytes: successBytes,
    revalidate: (phase) => phases.push(phase),
  });
  assert.deepEqual(phases, ['pre-publish', 'post-publish']);
  const successPaths = deriveDirectorPlanPublicationPaths(successPath, successBytes);
  assert.deepEqual(publication.publicationReceipt, {
    schemaVersion: 'director-plan-publication-receipt/v1',
    state: 'committed-candidate',
    ...successPaths,
    sha256: successPaths.publicationId,
    bytes: successBytes.length,
    device: publication.publicationReceipt.device,
    inode: publication.publicationReceipt.inode,
  });
  const successIdentity = assertSameInode(
    [successPath, successPaths.stagePath, successPaths.committedPath],
    successBytes,
  );
  assert.equal(publication.publicationReceipt.device, successIdentity.dev);
  assert.equal(publication.publicationReceipt.inode, successIdentity.ino);
  const outputDirectoryStat = lstatSync(path.dirname(successPath));
  assertPrivateJournalDirectory(successPaths.journalRoot, outputDirectoryStat.dev);
  assertPrivateJournalDirectory(successPaths.outputJournalDirectory, outputDirectoryStat.dev);
  assert.deepEqual(
    validateDirectorPlanPublicationJournal({outputPath: successPath, expectedBytes: successBytes}),
    publication.publicationReceipt,
  );
  expectCode('DIRECTOR_OUTPUT_ALREADY_EXISTS', () =>
    publishDirectorPlanExclusive({
      outputPath: successPath,
      bytes: successBytes,
      revalidate: () => {},
    }));
  assertSameInode(
    [successPath, successPaths.stagePath, successPaths.committedPath],
    successBytes,
  );

  const preexistingPath = path.join(fixtureRoot, 'preexisting-plan.json');
  writeFileSync(preexistingPath, 'sentinel\n');
  const preexistingSha256 = sha256File(preexistingPath);
  const preexistingPaths = deriveDirectorPlanPublicationPaths(preexistingPath, successBytes);
  expectCode('DIRECTOR_OUTPUT_ALREADY_EXISTS', () =>
    publishDirectorPlanExclusive({
      outputPath: preexistingPath,
      bytes: successBytes,
      revalidate: () => {},
    }));
  assert.equal(sha256File(preexistingPath), preexistingSha256);
  assert.equal(existsSync(preexistingPaths.outputJournalDirectory), false);

  const preRevalidatePath = path.join(fixtureRoot, 'pre-revalidate-plan.json');
  const preRevalidatePaths = deriveDirectorPlanPublicationPaths(
    preRevalidatePath,
    successBytes,
  );
  expectCode('DIRECTOR_TEST_PRE_REVALIDATE_FAILURE', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: preRevalidatePath,
      bytes: successBytes,
      revalidate: (phase) => {
        if (phase !== 'pre-publish') return;
        const error = new Error('injected pre-publish revalidation failure');
        error.code = 'DIRECTOR_TEST_PRE_REVALIDATE_FAILURE';
        throw error;
      },
    }));
  assert.equal(existsSync(preRevalidatePath), false);
  assertRegularPath(preRevalidatePaths.stagePath, successBytes, 0o400);
  assert.equal(existsSync(preRevalidatePaths.committedPath), false);
  expectCode('DIRECTOR_PLAN_PUBLICATION_STAGE_ALREADY_EXISTS', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: preRevalidatePath,
      bytes: successBytes,
      revalidate: () => {},
    }));
  assertRegularPath(preRevalidatePaths.stagePath, successBytes, 0o400);
  expectCode('DIRECTOR_PLAN_PUBLICATION_COMMIT_MISSING', () =>
    validateDirectorPlanPublicationJournal({
      outputPath: preRevalidatePath,
      expectedBytes: successBytes,
    }));

  const postRevalidatePath = path.join(fixtureRoot, 'post-revalidate-plan.json');
  const postRevalidatePaths = deriveDirectorPlanPublicationPaths(
    postRevalidatePath,
    successBytes,
  );
  const postRevalidateError = captureCode('DIRECTOR_PLAN_PUBLICATION_STATE_AMBIGUOUS', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: postRevalidatePath,
      bytes: successBytes,
      revalidate: (phase) => {
        if (phase !== 'post-publish') return;
        const error = new Error('injected post-publish revalidation failure');
        error.code = 'DIRECTOR_TEST_POST_REVALIDATE_FAILURE';
        throw error;
      },
    }));
  assert.equal(postRevalidateError.publicationState, 'linked-uncommitted');
  assertSameInode(
    [postRevalidatePath, postRevalidatePaths.stagePath],
    successBytes,
  );
  assert.equal(existsSync(postRevalidatePaths.committedPath), false);
  expectCode('DIRECTOR_OUTPUT_ALREADY_EXISTS', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: postRevalidatePath,
      bytes: successBytes,
      revalidate: () => {},
    }));
  assertSameInode(
    [postRevalidatePath, postRevalidatePaths.stagePath],
    successBytes,
  );
  expectCode('DIRECTOR_PLAN_PUBLICATION_COMMIT_MISSING', () =>
    validateDirectorPlanPublicationJournal({
      outputPath: postRevalidatePath,
      expectedBytes: successBytes,
    }));

  const existsRacePath = path.join(fixtureRoot, 'exists-race-plan.json');
  const existsRaceBytes = Buffer.from('opponent-won\n');
  const existsRacePaths = deriveDirectorPlanPublicationPaths(existsRacePath, successBytes);
  expectCode('DIRECTOR_OUTPUT_ALREADY_EXISTS', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: existsRacePath,
      bytes: successBytes,
      revalidate: () => {},
      hooks: {
        beforeFinalLink: ({outputPath}) => writeFileSync(outputPath, existsRaceBytes),
      },
    }));
  assert.deepEqual(readFileSync(existsRacePath), existsRaceBytes);
  assertRegularPath(existsRacePaths.stagePath, successBytes, 0o400);
  assert.equal(existsSync(existsRacePaths.committedPath), false);

  const commitRacePath = path.join(fixtureRoot, 'commit-race-plan.json');
  const commitRacePaths = deriveDirectorPlanPublicationPaths(commitRacePath, successBytes);
  const commitRaceBytes = Buffer.from('foreign-commit\n');
  const commitRaceError = captureCode('DIRECTOR_PLAN_PUBLICATION_STATE_AMBIGUOUS', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: commitRacePath,
      bytes: successBytes,
      revalidate: () => {},
      hooks: {
        beforeCommitLink: ({committedPath}) => writeFileSync(committedPath, commitRaceBytes),
      },
    }));
  assert.equal(commitRaceError.publicationState, 'linked-uncommitted');
  assertSameInode([commitRacePath, commitRacePaths.stagePath], successBytes);
  assert.deepEqual(readFileSync(commitRacePaths.committedPath), commitRaceBytes);

  const shortWritePath = path.join(fixtureRoot, 'short-write-plan.json');
  const shortWritePaths = deriveDirectorPlanPublicationPaths(shortWritePath, successBytes);
  expectCode('EIO', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: shortWritePath,
      bytes: successBytes,
      revalidate: () => {},
      hooks: {
        writeToDescriptor: (descriptor, bytes) => {
          writeSync(descriptor, bytes, 0, 4, 0);
          const error = new Error('injected short write');
          error.code = 'EIO';
          throw error;
        },
      },
    }));
  assert.equal(existsSync(shortWritePath), false);
  assertRegularPath(shortWritePaths.stagePath, successBytes.subarray(0, 4), 0o600);
  assert.equal(existsSync(shortWritePaths.committedPath), false);

  const commitFsyncPath = path.join(fixtureRoot, 'commit-fsync-plan.json');
  const commitFsyncPaths = deriveDirectorPlanPublicationPaths(commitFsyncPath, successBytes);
  const commitFsyncError = captureCode('DIRECTOR_PLAN_PUBLICATION_STATE_AMBIGUOUS', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: commitFsyncPath,
      bytes: successBytes,
      revalidate: () => {},
      hooks: {
        afterDirectoryFsync: ({phase}) => {
          if (phase !== 'journal-committed') return;
          const error = new Error('injected committed journal fsync failure');
          error.code = 'EIO';
          throw error;
        },
      },
    }));
  assert.equal(commitFsyncError.publicationState, 'commit-linked-ambiguous');
  assertSameInode(
    [commitFsyncPath, commitFsyncPaths.stagePath, commitFsyncPaths.committedPath],
    successBytes,
  );
  assert.equal(
    validateDirectorPlanPublicationJournal({
      outputPath: commitFsyncPath,
      expectedBytes: successBytes,
    }).state,
    'committed-candidate',
  );

  for (const targetName of ['stagePath', 'outputPath', 'committedPath']) {
    const outputPath = path.join(fixtureRoot, `foreign-${targetName}-plan.json`);
    const publicationPaths = deriveDirectorPlanPublicationPaths(outputPath, successBytes);
    let foreignIdentity;
    const error = captureCode('DIRECTOR_PLAN_PUBLICATION_STATE_AMBIGUOUS', () =>
      publishDirectorPlanExclusiveForTest({
        outputPath,
        bytes: successBytes,
        revalidate: () => {},
        hooks: {
          afterCommitLink: (paths) => {
            unlinkSync(paths[targetName]);
            writeFileSync(paths[targetName], successBytes);
            chmodSync(paths[targetName], 0o400);
            foreignIdentity = lstatSync(paths[targetName]);
          },
        },
      }));
    assert.equal(error.publicationState, 'commit-linked-ambiguous');
    assert.deepEqual(readFileSync(publicationPaths[targetName]), successBytes);
    const retainedForeignIdentity = lstatSync(publicationPaths[targetName]);
    assert.equal(retainedForeignIdentity.ino, foreignIdentity.ino);
    const retainedAuthorityIdentity = lstatSync(
      targetName === 'stagePath' ? publicationPaths.outputPath : publicationPaths.stagePath,
    );
    assert.notEqual(
      `${retainedForeignIdentity.dev}:${retainedForeignIdentity.ino}`,
      `${retainedAuthorityIdentity.dev}:${retainedAuthorityIdentity.ino}`,
    );
  }

  const directoryDriftParent = path.join(fixtureRoot, 'directory-drift-parent');
  const directoryDriftSlot = path.join(directoryDriftParent, 'slot');
  const directoryDriftMoved = path.join(directoryDriftParent, 'slot-moved');
  mkdirSync(directoryDriftSlot, {recursive: true});
  const directoryDriftOutput = path.join(directoryDriftSlot, 'plan.json');
  const directoryDriftPaths = deriveDirectorPlanPublicationPaths(
    directoryDriftOutput,
    successBytes,
  );
  expectCode('DIRECTOR_PLAN_PUBLICATION_STATE_AMBIGUOUS', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: directoryDriftOutput,
      bytes: successBytes,
      revalidate: (phase) => {
        if (phase !== 'pre-publish') return;
        renameSync(directoryDriftSlot, directoryDriftMoved);
        mkdirSync(directoryDriftSlot);
      },
    }));
  assert.equal(existsSync(directoryDriftOutput), false);
  assertRegularPath(
    path.join(directoryDriftMoved, path.relative(directoryDriftSlot, directoryDriftPaths.stagePath)),
    successBytes,
    0o400,
  );

  const postLinkDirectoryDriftParent = path.join(
    fixtureRoot,
    'post-link-directory-drift-parent',
  );
  const postLinkDirectoryDriftSlot = path.join(postLinkDirectoryDriftParent, 'slot');
  const postLinkDirectoryDriftMoved = path.join(
    postLinkDirectoryDriftParent,
    'slot-moved',
  );
  mkdirSync(postLinkDirectoryDriftSlot, {recursive: true});
  const postLinkDirectoryDriftOutput = path.join(postLinkDirectoryDriftSlot, 'plan.json');
  const postLinkDirectoryDriftPaths = deriveDirectorPlanPublicationPaths(
    postLinkDirectoryDriftOutput,
    successBytes,
  );
  expectCode('DIRECTOR_PLAN_PUBLICATION_STATE_AMBIGUOUS', () =>
    publishDirectorPlanExclusiveForTest({
      outputPath: postLinkDirectoryDriftOutput,
      bytes: successBytes,
      revalidate: () => {},
      hooks: {
        afterFinalLink: () => {
          renameSync(postLinkDirectoryDriftSlot, postLinkDirectoryDriftMoved);
          mkdirSync(postLinkDirectoryDriftSlot);
          const error = new Error('injected post-link directory drift');
          error.code = 'DIRECTOR_TEST_POST_LINK_DIRECTORY_DRIFT';
          throw error;
        },
      },
    }));
  assert.equal(existsSync(postLinkDirectoryDriftOutput), false);
  assert.deepEqual(
    readFileSync(path.join(postLinkDirectoryDriftMoved, 'plan.json')),
    successBytes,
  );
  assertRegularPath(
    path.join(
      postLinkDirectoryDriftMoved,
      path.relative(postLinkDirectoryDriftSlot, postLinkDirectoryDriftPaths.stagePath),
    ),
    successBytes,
    0o400,
  );

  const compilerSource = readFileSync(
    new URL('../scripts/compile-director-plan.mjs', import.meta.url),
    'utf8',
  );
  const publisherStart = compilerSource.indexOf('function publishDirectorPlanExclusiveCore');
  const publisherEnd = compilerSource.indexOf(
    'export function publishDirectorPlanExclusive(',
    publisherStart,
  );
  const publisherSource = compilerSource.slice(publisherStart, publisherEnd);
  assert.doesNotMatch(publisherSource, /\b(?:unlinkSync|rmSync|renameSync)\b/);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    singleBufferJsonAndSha: true,
    publicationSnapshotsNonEnumerable: true,
    requestDriftRejected: true,
    canonicalShaCheckedBeforeRuntime: true,
    bindingDriftRejected: true,
    persistentThreePathOneInodeJournal: true,
    stageOnlyFailureEvidence: true,
    linkedUncommittedFailureEvidence: true,
    finalAndCommitCompetitionPreserved: true,
    commitFsyncAmbiguous: true,
    ambiguousCommitCanBeExplicitlyRevalidated: true,
    allThreeForeignInodesRejected: true,
    shortWriteEvidencePreserved: true,
    publisherHasNoAutomaticPathDeletion: true,
    directoryDriftFailClosed: true,
    postLinkDirectoryDriftFailClosed: true,
  })}\n`);
} finally {
  rmSync(fixtureRoot, {recursive: true, force: true});
}
