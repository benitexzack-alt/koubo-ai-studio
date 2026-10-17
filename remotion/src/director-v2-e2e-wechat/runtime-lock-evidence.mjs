#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash, generateKeyPairSync, sign, verify} from 'node:crypto';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const DIRECT_CLI_BLOCK_CODE = 'CANDIDATE_RUNTIME_LOCK_DIRECT_CLI_BLOCKED';
const THIS_DIR = dirname(THIS_FILE);
const REPO_ROOT = resolve(THIS_DIR, '../../..');
const SNAPSHOT_TREE_SHA256 = '89c127e7c22882df529f957c2fc5dfacff8d773a11a98bc62a3f710dfd7cc889';
const FIXED_RUNTIME_LOCK_SHA256 = '524bc6d3b9c57c1deca378ad574a8b12f7d0d56d038c05b69cc91ad6159805ef';
const FIXED_RUNTIME_LOCK_PATH = `/Library/Application Support/KouboDirector/runtime-locks/sha256-${FIXED_RUNTIME_LOCK_SHA256}.json`;
const FIXED_SNAPSHOT_ROOT = `/Library/Application Support/KouboDirector/runtime-snapshots/sha256-${SNAPSHOT_TREE_SHA256}`;
const FIXED_SYSTEM_VERIFIER = '/Library/Application Support/KouboDirector/attestor/bin/verify-runtime-lock';
const FIXED_SYSTEM_RECEIPT_SIGNER = '/Library/Application Support/KouboDirector/attestor/bin/sign-candidate-receipt';
const FIXED_SYSTEM_VERIFIER_SHA256 = 'ff57cb96aa27e115bca6bc1c10f01cb32a59af3df0b429fd404e98f5db52865a';
const FIXED_SYSTEM_SIGNER_SHA256 = 'a02652f4c02dc0c276d6da7db8948ad93c9af59c5d7cf28d20dc6f097944ab20';
const FIXED_MINIMAL_PATH = `${FIXED_SNAPSHOT_ROOT}/toolchain/bin:/usr/bin:/bin:/usr/sbin:/sbin`;
const EXPECTED_NODE_MODULES_TREE = Object.freeze({
  fileCount: 10798,
  symlinkCount: 48,
  regularFileBytes: 433475193,
  manifestSha256: 'c9990be5552918a734d3724cd98aa800e6862155756e45c07e300b84f5b6c8d5',
  excludedRelativePrefixes: ['.cache'],
});
const EXPECTED_TOOLS = Object.freeze([
  ['node', 'toolchain/bin/node', '5d9d3872911e2340a43b707962e68143de8a4e8d54628845c0c4f2de1fb7cd5c', 112915776],
  ['ffmpeg', 'toolchain/bin/ffmpeg', '329fa7360b28a067a0cd7281474bb18cd868932d5173646a674466bcb56d6e93', 444224],
  ['ffprobe', 'toolchain/bin/ffprobe', '841ab2259a55e5c5e44c5851890867d48750ff1e7cfa92b5fbed91445a493128', 254912],
  ['magick', 'toolchain/bin/magick', '97c56e54523f234efe2dc42012222ca1d1dea760521141b67ee0cb4608bbf1da', 53440],
  ['tesseract', 'toolchain/bin/tesseract', 'beb291643298f6f824e38531182802b17588c6ac240c168146885a82afa90785', 103248],
  ['sandbox-exec', 'toolchain/bin/sandbox-exec', '97da2b6160df132c0a559e30fb5d931c65560d99e48172324531b87a5bf5b5fd', 102560],
  ['python3', 'toolchain/bin/python3', '7f30f076d0e9c38f772a76449fca9da8cf97f6a3d43b94c90a00e4f9ce7ad39e', 118864],
].map(([id, snapshotRelativePath, sha256, bytes]) => ({id, snapshotRelativePath, sha256, bytes})));
const FORBIDDEN_ENV = /(?:^|_)(?:http|https|all|no)_proxy$|proxy|token|api[_-]?key|secret|authorization/i;

const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const sha256Text = (value) => createHash('sha256').update(value).digest('hex');
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const pathLexists = (path) => {
  try { lstatSync(path); return true; }
  catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
};
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

const assertOutsideProject = (path, label) => {
  const rel = relative(REPO_ROOT, path);
  assert(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel), `${label} is inside the mutable project`);
};

const assertOwnedReadOnly = (path, {requiredUid, requiredGid, label}) => {
  const stats = lstatSync(path);
  assert(!stats.isSymbolicLink(), `${label} is a symlink`);
  assert(stats.uid === requiredUid, `${label} is not owned by the independent runtime owner`);
  assert(stats.gid === requiredGid, `${label} is not owned by the independent runtime group`);
  assert((stats.mode & 0o022) === 0, `${label} is group/world writable`);
  return stats;
};

const canonicalTree = (treeRoot, {excludeRelativePrefixes = [], requiredUid, requiredGid} = {}) => {
  const normalizedRoot = realpathSync(treeRoot);
  const excluded = [...excludeRelativePrefixes].sort();
  const excludedPath = (rel) => excluded.some((prefix) => rel === prefix || rel.startsWith(`${prefix}${sep}`));
  const entries = [];
  const assertEntryOwnership = (stats, rel, kind) => {
    if (requiredUid === undefined || requiredGid === undefined) return;
    assert(stats.uid === requiredUid, `Snapshot ${kind} owner mismatch: ${rel || '.'}`);
    assert(stats.gid === requiredGid, `Snapshot ${kind} group mismatch: ${rel || '.'}`);
    if (kind !== 'symlink') {
      assert((stats.mode & 0o022) === 0, `Snapshot ${kind} is group/world writable: ${rel || '.'}`);
    }
  };
  const walk = (directory, relPrefix = '') => {
    assertEntryOwnership(lstatSync(directory), relPrefix, 'directory');
    for (const name of readdirSync(directory).sort()) {
      const rel = relPrefix ? `${relPrefix}${sep}${name}` : name;
      if (excludedPath(rel)) continue;
      const path = resolve(directory, name);
      const stats = lstatSync(path);
      if (stats.isSymbolicLink()) {
        assertEntryOwnership(stats, rel, 'symlink');
        const realTarget = realpathSync(path);
        const targetRel = relative(normalizedRoot, realTarget);
        assert(targetRel !== '..' && !targetRel.startsWith(`..${sep}`) && !isAbsolute(targetRel), `Snapshot symlink escapes root: ${rel}`);
        const targetStats = statSync(realTarget);
        assertEntryOwnership(targetStats, rel, targetStats.isDirectory() ? 'directory-target' : 'file-target');
        entries.push({
          type: 'symlink', path: rel, linkTarget: readlinkSync(path), realTarget: targetRel,
          targetType: targetStats.isFile() ? 'file' : targetStats.isDirectory() ? 'directory' : 'other',
          targetSha256: targetStats.isFile() ? sha256(realTarget) : null,
          targetBytes: targetStats.isFile() ? targetStats.size : null,
        });
      } else if (stats.isDirectory()) walk(path, rel);
      else if (stats.isFile()) {
        assertEntryOwnership(stats, rel, 'file');
        entries.push({type: 'file', path: rel, bytes: stats.size, sha256: sha256(path)});
      }
      else fail(`Unsupported snapshot entry: ${rel}`);
    }
  };
  walk(normalizedRoot);
  const files = entries.filter((entry) => entry.type === 'file');
  const symlinks = entries.filter((entry) => entry.type === 'symlink');
  return {
    fileCount: files.length,
    symlinkCount: symlinks.length,
    regularFileBytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
    manifestSha256: sha256Text(JSON.stringify(entries)),
    excludedRelativePrefixes: excluded,
  };
};

const assertMinimalEnvironment = (environment, expectedPath) => {
  assert(environment.PATH === expectedPath, 'Runtime PATH differs from the independently locked minimal PATH');
  const forbidden = Object.keys(environment).filter((key) => FORBIDDEN_ENV.test(key));
  assert(forbidden.length === 0, `Runtime environment contains proxy/credential variables: ${forbidden.sort().join(',')}`);
};

const makeFixtureTreeWritable = (path) => {
  if (!pathLexists(path)) return;
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) return;
  if (stats.isDirectory()) {
    chmodSync(path, 0o755);
    for (const name of readdirSync(path)) makeFixtureTreeWritable(resolve(path, name));
  } else chmodSync(path, 0o644);
};

const validateLockShape = ({lock, lockPath, publicKey, expected, requiredUid, requiredGid, requireExternal = true}) => {
  assert(lock.schemaVersion === 'koubo-director-system-runtime-lock/v1', 'Runtime lock schema mismatch');
  assert(lock.status === 'active' && lock.productionEligible === false, 'Runtime lock status/scope mismatch');
  assert(lock.payload?.snapshotRoot === expected.snapshotRoot, 'Runtime snapshot root mismatch');
  assert(lock.payload?.snapshotTreeSha256 === expected.snapshotTreeSha256, 'Runtime snapshot content address mismatch');
  assert(
    JSON.stringify(lock.payload?.snapshotTree?.excludedRelativePrefixes) ===
      JSON.stringify(expected.snapshotExcludedRelativePrefixes ?? []),
    'Runtime snapshot exclusion policy mismatch',
  );
  assert(lock.payload?.minimalPath === expected.minimalPath, 'Runtime minimal PATH mismatch');
  assert(lock.payload?.remotionEnvState?.relativePath === 'remotion/.env' && lock.payload.remotionEnvState.state === 'absent', 'Remotion .env absence is not locked');
  assert(JSON.stringify(lock.payload?.tools) === JSON.stringify(expected.tools), 'Runtime tool tuple mismatch');
  assert(JSON.stringify(lock.payload?.nodeModulesTree) === JSON.stringify(expected.nodeModulesTree), 'node_modules tree tuple mismatch');
  assert(lock.payload?.receiptSigner?.absolutePath === expected.signerPath, 'System receipt signer path mismatch');
  assert(/^[a-f0-9]{64}$/.test(lock.payload.receiptSigner.sha256), 'System receipt signer SHA missing');
  assert(lock.signature?.algorithm === 'ed25519' && lock.signature.keyId === expected.keyId, 'Runtime lock signature metadata mismatch');
  const signedPayload = Buffer.from(stableJson(lock.payload));
  assert(verify(null, signedPayload, publicKey, Buffer.from(lock.signature.valueBase64, 'base64')), 'Runtime lock independent signature rejected');
  if (requireExternal) assertOutsideProject(lockPath, 'Runtime lock');
  assertOwnedReadOnly(lockPath, {requiredUid, requiredGid, label: 'Runtime lock'});
  const snapshotRoot = lock.payload.snapshotRoot;
  if (requireExternal) assertOutsideProject(snapshotRoot, 'Runtime snapshot');
  assertOwnedReadOnly(snapshotRoot, {requiredUid, requiredGid, label: 'Runtime snapshot root'});
  assert(basenameSafe(snapshotRoot) === `sha256-${lock.payload.snapshotTreeSha256}`, 'Runtime snapshot root is not content-addressed');
  const liveSnapshot = canonicalTree(snapshotRoot, {
    excludeRelativePrefixes: expected.snapshotExcludedRelativePrefixes ?? [],
    requiredUid,
    requiredGid,
  });
  assert(JSON.stringify(liveSnapshot) === JSON.stringify(lock.payload.snapshotTree), 'Runtime snapshot live tree differs from signed lock');
  const envPath = resolve(snapshotRoot, lock.payload.remotionEnvState.relativePath);
  assert(!pathLexists(envPath), 'Locked-absent Remotion .env is present');
  for (const tool of lock.payload.tools) {
    const toolPath = resolve(snapshotRoot, tool.snapshotRelativePath);
    assertOwnedReadOnly(toolPath, {requiredUid, requiredGid, label: `Runtime tool ${tool.id}`});
    const stats = statSync(toolPath);
    assert(stats.isFile(), `Runtime tool ${tool.id} is not a regular file`);
    assert(
      realpathSync(toolPath) === resolve(realpathSync(snapshotRoot), tool.snapshotRelativePath),
      `Runtime tool ${tool.id} realpath differs from signed path`,
    );
    assert(stats.size === tool.bytes && sha256(toolPath) === tool.sha256, `Runtime tool ${tool.id} SHA/bytes mismatch`);
  }
  return {ok: true, snapshotRoot, snapshotTree: liveSnapshot};
};

const basenameSafe = (path) => path.split(sep).filter(Boolean).at(-1);

const productionDescriptor = () => ({
  snapshotRoot: FIXED_SNAPSHOT_ROOT,
  snapshotTreeSha256: SNAPSHOT_TREE_SHA256,
  minimalPath: FIXED_MINIMAL_PATH,
  tools: EXPECTED_TOOLS,
  nodeModulesTree: EXPECTED_NODE_MODULES_TREE,
  signerPath: FIXED_SYSTEM_RECEIPT_SIGNER,
  keyId: 'koubo-director-runtime-root-2026-08-v1',
  snapshotExcludedRelativePrefixes: ['remotion/node_modules/.cache'],
});

const validateProduction = () => {
  fail(
    'SYSTEM_RUNTIME_TRUST_ROOT_NOT_WIRED_BLOCKED: repository public keys cannot validate a live runtime lock',
  );
  assert(pathLexists(FIXED_SYSTEM_VERIFIER), 'RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED: independent system runtime verifier is not installed');
  assertOwnedReadOnly(FIXED_SYSTEM_VERIFIER, {requiredUid: 0, requiredGid: 0, label: 'System runtime verifier'});
  assert(sha256(FIXED_SYSTEM_VERIFIER) === FIXED_SYSTEM_VERIFIER_SHA256, 'RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED: system runtime verifier SHA mismatch');
  assert(pathLexists(FIXED_RUNTIME_LOCK_PATH), 'RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED: independent signed runtime lock is not installed');
  assert(sha256(FIXED_RUNTIME_LOCK_PATH) === FIXED_RUNTIME_LOCK_SHA256, 'RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED: runtime lock file SHA differs from the fixed system path');
  const result = spawnSync(FIXED_SYSTEM_VERIFIER, ['verify-action-runtime', '--dry-run'], {
    encoding: 'utf8',
    env: {PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C'},
  });
  assert(result.status === 0, `RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED: independent dry-run verifier rejected action runtime: ${result.stderr}`);
  const lock = JSON.parse(readFileSync(FIXED_RUNTIME_LOCK_PATH, 'utf8'));
  const validated = validateLockShape({
    lock,
    lockPath: FIXED_RUNTIME_LOCK_PATH,
    publicKey: null,
    expected: productionDescriptor(),
    requiredUid: 0,
    requiredGid: 0,
  });
  assert(pathLexists(FIXED_SYSTEM_RECEIPT_SIGNER), 'SYSTEM_RECEIPT_SIGNER_MISSING_BLOCKED: independent system receipt signer is not installed');
  assertOwnedReadOnly(FIXED_SYSTEM_RECEIPT_SIGNER, {requiredUid: 0, requiredGid: 0, label: 'System receipt signer'});
  assert(sha256(FIXED_SYSTEM_RECEIPT_SIGNER) === FIXED_SYSTEM_SIGNER_SHA256, 'SYSTEM_RECEIPT_SIGNER_MISSING_BLOCKED: system receipt signer SHA mismatch');
  return {
    ...validated,
    runtimeLockPath: FIXED_RUNTIME_LOCK_PATH,
    runtimeLockSha256: FIXED_RUNTIME_LOCK_SHA256,
    systemVerifierPath: FIXED_SYSTEM_VERIFIER,
    systemReceiptSignerPath: FIXED_SYSTEM_RECEIPT_SIGNER,
    actionAllowed: false,
    blockedReason: 'snapshot-delegation-and-system-receipt-attestation-not-installed-for-this-candidate',
  };
};

const selftest = () => {
  const results = [];
  const rejects = (id, callback, pattern) => {
    let message = ''; try { callback(); } catch (error) { message = error.message; }
    assert(pattern.test(message), `${id} did not fail as expected: ${message}`);
    results.push({id, passed: true, rejectedWith: message});
  };
  const root = mkdtempSync(resolve(tmpdir(), 'koubo-runtime-lock-fixture-'));
  try {
    const seed = resolve(root, 'snapshot-seed');
    mkdirSync(seed);
    mkdirSync(resolve(seed, 'remotion'));
    mkdirSync(resolve(seed, 'toolchain'));
    mkdirSync(resolve(seed, 'toolchain/bin'));
    writeFileSync(resolve(seed, 'runtime.mjs'), 'export const fixture = true;\n');
    writeFileSync(resolve(seed, 'toolchain/bin/node'), 'fixture-node\n');
    const seedTree = canonicalTree(seed);
    const snapshotRoot = resolve(root, `sha256-${seedTree.manifestSha256}`);
    renameSync(seed, snapshotRoot);
    const toolPath = resolve(snapshotRoot, 'toolchain/bin/node');
    const tools = [{id: 'node', snapshotRelativePath: 'toolchain/bin/node', sha256: sha256(toolPath), bytes: statSync(toolPath).size}];
    const {publicKey, privateKey} = generateKeyPairSync('ed25519');
    const payload = {
      snapshotRoot,
      snapshotTreeSha256: seedTree.manifestSha256,
      snapshotTree: seedTree,
      minimalPath: `${snapshotRoot}/toolchain/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
      remotionEnvState: {relativePath: 'remotion/.env', state: 'absent'},
      tools,
      nodeModulesTree: {fileCount: 1, symlinkCount: 0, regularFileBytes: 1, manifestSha256: sha256Text('fixture'), excludedRelativePrefixes: ['.cache']},
      receiptSigner: {absolutePath: '/fixture/system-signer', sha256: sha256Text('signer')},
    };
    const lock = {
      schemaVersion: 'koubo-director-system-runtime-lock/v1', status: 'active', productionEligible: false, payload,
      signature: {algorithm: 'ed25519', keyId: 'fixture-key', valueBase64: sign(null, Buffer.from(stableJson(payload)), privateKey).toString('base64')},
    };
    const lockPath = resolve(root, 'fixture-lock.json');
    writeFileSync(lockPath, `${JSON.stringify(lock)}\n`);
    chmodSync(toolPath, 0o444);
    chmodSync(resolve(snapshotRoot, 'runtime.mjs'), 0o444);
    chmodSync(resolve(snapshotRoot, 'remotion'), 0o555);
    chmodSync(resolve(snapshotRoot, 'toolchain/bin'), 0o555);
    chmodSync(resolve(snapshotRoot, 'toolchain'), 0o555);
    chmodSync(snapshotRoot, 0o555);
    chmodSync(lockPath, 0o444);
    const expected = {snapshotRoot, snapshotTreeSha256: seedTree.manifestSha256, snapshotExcludedRelativePrefixes: [], minimalPath: payload.minimalPath, tools, nodeModulesTree: payload.nodeModulesTree, signerPath: payload.receiptSigner.absolutePath, keyId: 'fixture-key'};
    validateLockShape({lock, lockPath, publicKey, expected, requiredUid: process.getuid(), requiredGid: process.getgid(), requireExternal: false});
    results.push({id: 'fixture-only-independent-signed-runtime-lock-shape', passed: true});
    chmodSync(resolve(snapshotRoot, 'remotion'), 0o775);
    rejects(
      'snapshot-recursive-writable-directory-rejected',
      () => validateLockShape({lock, lockPath, publicKey, expected, requiredUid: process.getuid(), requiredGid: process.getgid(), requireExternal: false}),
      /group\/world writable/,
    );
    chmodSync(resolve(snapshotRoot, 'remotion'), 0o555);
    const forged = structuredClone(lock);
    forged.payload.minimalPath = '/tmp/attacker';
    rejects('runtime-lock-complete-forgery-rejected', () => validateLockShape({lock: forged, lockPath, publicKey, expected: {...expected, minimalPath: forged.payload.minimalPath}, requiredUid: process.getuid(), requiredGid: process.getgid(), requireExternal: false}), /signature rejected/);
    const runtimeFile = resolve(snapshotRoot, 'runtime.mjs');
    chmodSync(snapshotRoot, 0o755);
    chmodSync(runtimeFile, 0o644);
    const original = resolve(root, 'original-runtime.mjs');
    renameSync(runtimeFile, original);
    writeFileSync(runtimeFile, 'malicious\n');
    chmodSync(runtimeFile, 0o444);
    chmodSync(snapshotRoot, 0o555);
    rejects('snapshot-swap-in-before-restore-rejected', () => validateLockShape({lock, lockPath, publicKey, expected, requiredUid: process.getuid(), requiredGid: process.getgid(), requireExternal: false}), /live tree differs/);
    chmodSync(snapshotRoot, 0o755);
    rmSync(runtimeFile);
    renameSync(original, runtimeFile);
    chmodSync(snapshotRoot, 0o555);
    const envPath = resolve(snapshotRoot, 'remotion/.env');
    chmodSync(resolve(snapshotRoot, 'remotion'), 0o755);
    writeFileSync(envPath, 'SECRET=fixture\n');
    chmodSync(envPath, 0o444);
    chmodSync(resolve(snapshotRoot, 'remotion'), 0o555);
    rejects('runtime-snapshot-env-presence-rejected', () => validateLockShape({lock, lockPath, publicKey, expected, requiredUid: process.getuid(), requiredGid: process.getgid(), requireExternal: false}), /live tree differs|\.env is present/);
    chmodSync(resolve(snapshotRoot, 'remotion'), 0o755);
    rmSync(envPath);
    chmodSync(resolve(snapshotRoot, 'remotion'), 0o555);
    assertMinimalEnvironment({PATH: payload.minimalPath, LANG: 'C'}, payload.minimalPath);
    results.push({id: 'fixture-only-minimal-path-no-proxy-shape', passed: true});
    rejects('runtime-path-tamper-rejected', () => assertMinimalEnvironment({PATH: '/usr/local/bin'}, payload.minimalPath), /PATH differs/);
    rejects('runtime-proxy-environment-rejected', () => assertMinimalEnvironment({PATH: payload.minimalPath, HTTPS_PROXY: 'http://127.0.0.1:7890'}, payload.minimalPath), /proxy\/credential/);
    rejects('direct-runtime-lock-path-override-before-io-blocked', () => {
      const result = spawnSync(process.execPath, [THIS_FILE, 'validate-production', '--lock', lockPath], {encoding: 'utf8'});
      assert(result.status === 0, result.stderr);
    }, /CANDIDATE_RUNTIME_LOCK_DIRECT_CLI_BLOCKED/);
    rejects('direct-runtime-lock-validate-before-io-blocked', () => {
      const result = spawnSync(process.execPath, [THIS_FILE, 'validate-production'], {encoding: 'utf8'});
      assert(result.status === 0, result.stderr);
    }, /CANDIDATE_RUNTIME_LOCK_DIRECT_CLI_BLOCKED/);
  } finally {
    makeFixtureTreeWritable(root);
    rmSync(root, {recursive: true, force: true});
  }
  return {ok: true, count: results.length, tests: results};
};

try {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length !== 1 || rawArgs[0] !== 'selftest') {
    fail(
      `${DIRECT_CLI_BLOCK_CODE}: live runtime validation requires an independently installed immutable launcher; repository code cannot authorize itself`,
    );
  }
  process.stdout.write(`${JSON.stringify(selftest(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
