#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readlinkSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = dirname(THIS_FILE);
const REPO_ROOT = resolve(THIS_DIR, '../../..');
const REMOTION_ROOT = resolve(REPO_ROOT, 'remotion');
const PREVIEW_REL = 'work/director-v2-e2e/20260823-wechat-geo-aao-candidate-01/preview';
const PREVIEW_DIR = resolve(REPO_ROOT, PREVIEW_REL);

const LOCKED = Object.freeze({
  entry: 'src/director-v2-e2e-wechat/entry.tsx',
  composition: 'DirectorV2E2EWechat-Candidate02-WithSfx',
  comparisonComposition: 'DirectorV2E2EWechat-Candidate02-NoSfx',
  stillComposition: 'DirectorV2E2EWechat-Candidate02-NoSfx',
  publicDir: `${PREVIEW_REL}/media`,
  outputDirectory: `${PREVIEW_REL}/render-candidate-02`,
  output: `${PREVIEW_REL}/render-candidate-02/director-v2-e2e-wechat-candidate-02-with-sfx.mp4`,
  comparisonOutput: `${PREVIEW_REL}/render-candidate-02/director-v2-e2e-wechat-candidate-02-no-sfx.mp4`,
  stillDirectory: `${PREVIEW_REL}/stills-candidate-02`,
  stillFrames: Object.freeze([30, 318, 319, 666, 667, 674, 690, 810, 940, 1020, 1140, 1285, 1286, 1340]),
  contract: 'remotion/src/director-v2-e2e-wechat/candidate-media-contract.json',
  proxyReceipt: `${PREVIEW_REL}/proxy-receipt.json`,
  mediaReceipt: `${PREVIEW_REL}/candidate-media-receipt.json`,
  mediaEvidenceDirectory: `${PREVIEW_REL}/media-validation`,
  candidateGate: 'candidate-only-0a992254-8e8a58c4-v2',
  screenSourceRanges: Object.freeze({
    query: Object.freeze([86, 98]),
    answerRecommendations: Object.freeze([104, 107.4]),
    mapApp: Object.freeze([126, 129.72]),
    storeEntryJump: Object.freeze([129.8, 131]),
    storeMenu: Object.freeze([142, 146.5]),
  }),
  talkingHeadSourceRange: Object.freeze([59.96, 63.03]),
  semanticFrameGates: Object.freeze({questionFlipFirstAllowedFrame: 1286, questionFlipLastForbiddenFrame: 1285, storeEntryJumpFrame: 919}),
});

const CONTRACT_PATH = resolve(REPO_ROOT, LOCKED.contract);
const PROXY_VALIDATOR = resolve(THIS_DIR, 'proxy-evidence.mjs');
const MEDIA_VALIDATOR = resolve(THIS_DIR, 'candidate-media-evidence.mjs');
const STILL_ACCEPTANCE_VALIDATOR = resolve(THIS_DIR, 'still-acceptance-evidence.mjs');
const RUNTIME_LOCK_VALIDATOR = resolve(THIS_DIR, 'runtime-lock-evidence.mjs');
const PROXY_RECEIPT = resolve(REPO_ROOT, LOCKED.proxyReceipt);
const MEDIA_RECEIPT = resolve(REPO_ROOT, LOCKED.mediaReceipt);
const STILL_ACCEPTANCE_RECEIPT = resolve(PREVIEW_DIR, 'still-acceptance-receipt.v1.json');
const LOCAL_REMOTION_LAUNCHER = resolve(REMOTION_ROOT, 'node_modules/.bin/remotion');
const LOCKED_REMOTION_CLI = Object.freeze({
  launcherRelativePath: 'remotion/node_modules/.bin/remotion',
  launcherLinkTarget: '../@remotion/cli/remotion-cli.js',
  realTargetRelativePath: 'remotion/node_modules/@remotion/cli/remotion-cli.js',
  realTargetSha256: 'a10a711f052487d302dcf52dc08729c84c4deca0dc41c5b708edd1a7b7b48bfa',
  packageJsonRelativePath: 'remotion/node_modules/@remotion/cli/package.json',
  packageJsonSha256: '21c21215ae2b68323602574c3b0755363affdf4fcadbc700bd69a0cf68c25de2',
  version: '4.0.484',
});
const LOCKED_REMOTION_PROJECT = Object.freeze({
  packageJson: Object.freeze({path: 'remotion/package.json', sha256: 'fb96873ad84a8351b45bc7d49f58b9a6f5fb4ca1f0269c2e8086876af70dea8a'}),
  packageLock: Object.freeze({path: 'remotion/package-lock.json', sha256: '4e6f036581cb88ad22b3d421bdedf8cacf112e3c4eeeadece9326764ad859566'}),
  tsconfig: Object.freeze({path: 'remotion/tsconfig.json', sha256: '1d74eb7aea6d15c33672a1d5970e76ebd6df9783f054e110cb8350d3f41965c6'}),
});
const LOCKED_BROWSER = Object.freeze({
  relativePath: 'remotion/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  sha256: 'b469d05c698ccf9f4ae3dc43fb194fbdcf56f9da1fc46dcc19f2bf9fe2aa20b8',
  bytes: 159972320,
});
const LOCKED_BROWSER_PATH = resolve(REPO_ROOT, LOCKED_BROWSER.relativePath);
const DIRECT_RUNTIME_PACKAGES = Object.freeze([
  Object.freeze({specifier: 'react', packageJson: 'remotion/node_modules/react/package.json', entries: ['remotion/node_modules/react/index.js', 'remotion/node_modules/react/jsx-runtime.js']}),
  Object.freeze({specifier: 'react-dom', packageJson: 'remotion/node_modules/react-dom/package.json', entries: ['remotion/node_modules/react-dom/index.js']}),
  Object.freeze({specifier: 'remotion', packageJson: 'remotion/node_modules/remotion/package.json', entries: ['remotion/node_modules/remotion/dist/esm/index.mjs', 'remotion/node_modules/remotion/dist/cjs/index.js']}),
  Object.freeze({specifier: '@remotion/media', packageJson: 'remotion/node_modules/@remotion/media/package.json', entries: ['remotion/node_modules/@remotion/media/dist/esm/index.mjs']}),
  Object.freeze({specifier: '@remotion/cli', packageJson: LOCKED_REMOTION_CLI.packageJsonRelativePath, entries: [LOCKED_REMOTION_CLI.realTargetRelativePath]}),
]);
const PACKAGE_LOCK = resolve(REMOTION_ROOT, 'package-lock.json');
const SANDBOX_EXEC = '/usr/bin/sandbox-exec';
const SANDBOX_PROFILE_PATH = resolve(THIS_DIR, 'network-deny.sb');
const CONTROLLED_TOOL_PATHS = Object.freeze({
  node: process.execPath,
  ffmpeg: '/opt/homebrew/bin/ffmpeg',
  ffprobe: '/opt/homebrew/bin/ffprobe',
  imagemagick: '/opt/homebrew/bin/magick',
  tesseract: '/opt/homebrew/bin/tesseract',
  sandboxExec: SANDBOX_EXEC,
  networkProbePython: '/usr/bin/python3',
});
const RETIRED_SCREEN_NAME = 'screen-30fps.mp4';
const RETIRED_SCREEN_SHA = 'c62481e12b095462748d216c71b45cf8d81fe495a25a52a28a9fe763d948ea6c';
const RECEIPT_PATHS = Object.freeze({
  'build-media': resolve(PREVIEW_DIR, 'candidate-wrapper-media-build-receipt.v2.json'),
  preflight: resolve(PREVIEW_DIR, 'candidate-wrapper-preflight-receipt.v2.json'),
  stills: resolve(PREVIEW_DIR, 'candidate-wrapper-stills-receipt.v2.json'),
  render: resolve(PREVIEW_DIR, 'candidate-wrapper-render-receipt.v2.json'),
});
const MEDIA_BUILD_WRAPPER_RECEIPT = RECEIPT_PATHS['build-media'];
const MEDIA_EVIDENCE_DIRECTORY = resolve(REPO_ROOT, LOCKED.mediaEvidenceDirectory);
const REMOTION_ENV_PATH = resolve(REMOTION_ROOT, '.env');
const SYSTEM_ATTESTATION_KEY_ID = 'koubo-director-runtime-root-2026-08-v1';
const LIVE_REPOSITORY_BLOCK_CODE = 'RUNTIME_SNAPSHOT_DELEGATION_BLOCKED';
const LIVE_MODES = Object.freeze([
  'build-media',
  'preflight',
  'stills',
  'render',
  'validate-media-build-receipt',
  'validate-stills-receipt',
  'validate-render-receipt',
]);

const RUNTIME_RELATIVE_PATHS = Object.freeze([
  'remotion/src/director-v2-e2e-wechat/render-candidate.mjs',
  'remotion/src/director-v2-e2e-wechat/entry.tsx',
  'remotion/src/director-v2-e2e-wechat/DirectorV2E2EWechat.tsx',
  'remotion/src/director-v2-e2e-wechat/timeline.ts',
  'remotion/src/director-v2-e2e-wechat/candidate-media-contract.json',
  'remotion/src/director-v2-e2e-wechat/visual-semantic-contract.json',
  'remotion/src/director-v2-e2e-wechat/proxy-evidence.mjs',
  'remotion/src/director-v2-e2e-wechat/candidate-media-evidence.mjs',
  'remotion/src/director-v2-e2e-wechat/still-acceptance-evidence.mjs',
  'remotion/src/director-v2-e2e-wechat/runtime-lock-evidence.mjs',
  'remotion/src/director-v2-e2e-wechat/test-proxy-evidence.mjs',
  'remotion/src/director-v2-e2e-wechat/test-candidate-media-evidence.mjs',
  'remotion/src/director-v2-e2e-wechat/test-render-candidate.mjs',
  'remotion/src/director-v2-e2e-wechat/test-still-acceptance-evidence.mjs',
  'remotion/src/director-v2-e2e-wechat/test-runtime-lock-evidence.mjs',
  'remotion/src/director-v2-e2e-wechat/network-deny.sb',
  'remotion/src/director-v2-e2e-wechat/README.md',
  'remotion/package.json',
  'remotion/package-lock.json',
  'remotion/tsconfig.json',
  'remotion/node_modules/@remotion/cli/package.json',
  'remotion/node_modules/@remotion/cli/remotion-cli.js',
  'skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs',
  'tools/generated-style-policy.mjs',
]);

const fail = (message) => {
  throw new Error(message);
};

const assert = (condition, message) => {
  if (!condition) fail(message);
};

const sha256Text = (value) => createHash('sha256').update(value).digest('hex');
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const nowIso = () => new Date().toISOString();
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const execute = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  return {
    command: [command, ...args],
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
};

const pathLexists = (path) => {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};

const openExclusiveNoFollow = (path, mode = 0o600) =>
  openSync(
    path,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
    mode,
  );

const resolveWithin = (root, value, label) => {
  assert(typeof value === 'string' && value.length > 0, `${label} is empty`);
  assert(!isAbsolute(value), `${label} must be relative`);
  const target = resolve(root, value);
  const rel = relative(root, target);
  assert(rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `${label} escapes root`);
  return target;
};

const assertNoSymlinkSegments = (root, target, label) => {
  const rel = relative(root, target);
  assert(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `${label} escapes root`);
  let current = root;
  for (const segment of rel.split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    if (pathLexists(current)) {
      assert(!lstatSync(current).isSymbolicLink(), `${label} traverses symlink: ${current}`);
    }
  }
};

const resolveRepo = (value, label) => {
  const target = resolveWithin(REPO_ROOT, value, label);
  assertNoSymlinkSegments(REPO_ROOT, target, label);
  return target;
};

const assertPathDoesNotExist = (path, label) => {
  assert(!pathLexists(path), `${label} already exists; overwrite is forbidden`);
};

const relativeRepo = (path) => relative(REPO_ROOT, path);

const fileIdentity = (path) => {
  assert(pathLexists(path), `Required file is missing: ${path}`);
  assert(!lstatSync(path).isSymbolicLink(), `Required file is a symlink: ${path}`);
  const stats = statSync(path);
  assert(stats.isFile(), `Required path is not a regular file: ${path}`);
  return {
    path: relativeRepo(path),
    sha256: sha256(path),
    bytes: stats.size,
    device: stats.dev,
    inode: stats.ino,
  };
};

const assertPinnedFile = ({path, sha256: expectedSha256, bytes}) => {
  const target = resolveRepo(path, 'pinned runtime file');
  const identity = fileIdentity(target);
  assert(identity.sha256 === expectedSha256, `Pinned runtime file SHA mismatch: ${path}`);
  if (bytes !== undefined) assert(identity.bytes === bytes, `Pinned runtime file byte count mismatch: ${path}`);
  return identity;
};

const canonicalTreeManifest = (treeRoot, {excludeRelativePrefixes = []} = {}) => {
  assert(pathLexists(treeRoot) && !lstatSync(treeRoot).isSymbolicLink(), `Runtime tree root is missing or a symlink: ${treeRoot}`);
  const normalizedRoot = realpathSync(treeRoot);
  const rootStats = statSync(normalizedRoot);
  assert(rootStats.isDirectory(), `Runtime tree root is not a directory: ${treeRoot}`);
  const excluded = [...excludeRelativePrefixes].sort();
  const isExcluded = (rel) => excluded.some((prefix) => rel === prefix || rel.startsWith(`${prefix}${sep}`));
  const entries = [];
  const walk = (directory, relPrefix = '') => {
    const children = readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const childRel = relPrefix ? `${relPrefix}${sep}${child.name}` : child.name;
      if (isExcluded(childRel)) continue;
      const childPath = resolve(directory, child.name);
      const stats = lstatSync(childPath);
      if (stats.isSymbolicLink()) {
        const realTarget = realpathSync(childPath);
        const realRel = relative(normalizedRoot, realTarget);
        assert(realRel !== '..' && !realRel.startsWith(`..${sep}`) && !isAbsolute(realRel), `Runtime tree symlink escapes node_modules: ${childRel}`);
        const targetStats = statSync(realTarget);
        entries.push({
          type: 'symlink',
          path: childRel,
          linkTarget: readlinkSync(childPath),
          realTarget: realRel,
          targetType: targetStats.isFile() ? 'file' : targetStats.isDirectory() ? 'directory' : 'other',
          targetSha256: targetStats.isFile() ? sha256(realTarget) : null,
          targetBytes: targetStats.isFile() ? targetStats.size : null,
        });
      } else if (stats.isDirectory()) {
        walk(childPath, childRel);
      } else if (stats.isFile()) {
        entries.push({type: 'file', path: childRel, bytes: stats.size, sha256: sha256(childPath)});
      } else {
        fail(`Unsupported runtime tree entry type: ${childRel}`);
      }
    }
  };
  walk(normalizedRoot);
  const regularFiles = entries.filter((entry) => entry.type === 'file');
  const symlinks = entries.filter((entry) => entry.type === 'symlink');
  return {
    root: relativeRepo(normalizedRoot),
    algorithm: 'canonical-json-sorted-path-file-bytes-sha256-symlink-link-and-real-target/v1',
    excludedRelativePrefixes: excluded,
    fileCount: regularFiles.length,
    symlinkCount: symlinks.length,
    regularFileBytes: regularFiles.reduce((sum, entry) => sum + entry.bytes, 0),
    manifestSha256: sha256Text(JSON.stringify(entries)),
  };
};

const projectRuntimeBindings = () => {
  const files = Object.values(LOCKED_REMOTION_PROJECT).map(assertPinnedFile);
  return {files, manifestSha256: sha256Text(JSON.stringify(files))};
};

const browserBinding = () => {
  const identity = assertPinnedFile({path: LOCKED_BROWSER.relativePath, sha256: LOCKED_BROWSER.sha256, bytes: LOCKED_BROWSER.bytes});
  return {...identity, executable: true};
};

const directRuntimePackageGraph = () => {
  const packages = DIRECT_RUNTIME_PACKAGES.map((binding) => {
    const packageIdentity = fileIdentity(resolveRepo(binding.packageJson, `${binding.specifier} package JSON`));
    const metadata = JSON.parse(readFileSync(resolveRepo(binding.packageJson, `${binding.specifier} package metadata`), 'utf8'));
    const entries = binding.entries.map((entry) => fileIdentity(resolveRepo(entry, `${binding.specifier} runtime entry`)));
    return {specifier: binding.specifier, version: metadata.version, packageJson: packageIdentity, entries};
  });
  return {
    resolutionPolicy: 'explicit-direct-package-entries-plus-package-lock-and-full-node-modules-tree/v1',
    packages,
    manifestSha256: sha256Text(JSON.stringify(packages)),
  };
};

const assertDirectRuntimePackageSet = (graph) => {
  assert(
    JSON.stringify(graph.packages.map((item) => item.specifier)) ===
      JSON.stringify(DIRECT_RUNTIME_PACKAGES.map((item) => item.specifier)),
    'Direct runtime package graph is missing, extra, duplicated, or reordered',
  );
};

const controlledToolBindings = () => {
  const tools = Object.entries(CONTROLLED_TOOL_PATHS).map(([id, launcherPath]) => {
    assert(existsSync(launcherPath), `Controlled tool ${id} is missing: ${launcherPath}`);
    const target = realpathSync(launcherPath);
    const stats = statSync(target);
    assert(stats.isFile(), `Controlled tool ${id} target is not a regular file: ${target}`);
    return {
      id,
      launcherPath,
      launcherIsSymlink: lstatSync(launcherPath).isSymbolicLink(),
      realPath: target,
      sha256: sha256(target),
      bytes: stats.size,
      device: stats.dev,
      inode: stats.ino,
    };
  });
  return {
    path: `${dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    tools,
    manifestSha256: sha256Text(JSON.stringify(tools)),
  };
};

const directoryIdentity = (path, root, label) => {
  assertNoSymlinkSegments(root, path, label);
  const stats = statSync(path);
  assert(stats.isDirectory(), `${label} is not a directory`);
  return {path: relativeRepo(path), device: stats.dev, inode: stats.ino};
};

const runValidator = (script, receipt) => {
  const result = execute(SANDBOX_EXEC, [
    '-f',
    SANDBOX_PROFILE_PATH,
    CONTROLLED_TOOL_PATHS.node,
    script,
    'validate',
    '--receipt',
    receipt,
  ], {
    env: minimalEnvironment(),
  });
  assert(result.exitCode === 0, `${basename(script)} rejected candidate input: ${result.stderr}`);
  return {
    command: [
      SANDBOX_EXEC,
      '-f',
      `<profile-sha256:${sha256(SANDBOX_PROFILE_PATH)}>`,
      '<node-runtime>',
      script,
      'validate',
      '--receipt',
      receipt,
    ],
    exitCode: result.exitCode,
    stdoutSha256: sha256Text(result.stdout),
    stderrSha256: sha256Text(result.stderr),
    sandboxEnforced: true,
  };
};

const candidateMediaBuildInvocation = () => ({
  command: SANDBOX_EXEC,
  args: ['-f', SANDBOX_PROFILE_PATH, CONTROLLED_TOOL_PATHS.node, MEDIA_VALIDATOR, 'build'],
  env: minimalEnvironment(),
});

const sandboxedCandidateMediaBuild = () => {
  const invocation = candidateMediaBuildInvocation();
  const result = execute(invocation.command, invocation.args, {env: invocation.env});
  return {
    ...result,
    commandForReceipt: [
      SANDBOX_EXEC,
      '-f',
      `<profile-sha256:${sha256(SANDBOX_PROFILE_PATH)}>`,
      '<node-runtime>',
      relativeRepo(MEDIA_VALIDATOR),
      'build',
    ],
  };
};

const minimalEnvironment = () => {
  const env = {
    PATH: `${dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: process.env.HOME || '/tmp',
    TMPDIR: process.env.TMPDIR || '/tmp',
    LANG: process.env.LANG || 'en_US.UTF-8',
    LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
    NODE_ENV: 'production',
  };
  return env;
};

const assertMinimalEnvironment = (env) => {
  const allowed = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'NODE_ENV'];
  assert(Object.keys(env).every((key) => allowed.includes(key)), 'Minimal runtime environment contains an unregistered key');
  assert(!Object.keys(env).some((key) => /proxy|token|api[_-]?key|secret|authorization/i.test(key)), 'Minimal runtime environment contains proxy or credential state');
};

const validateProductionRuntimeGate = () => {
  assert(!pathLexists(REMOTION_ENV_PATH), 'RUNTIME_ENV_PRESENT_BLOCKED: remotion/.env must remain absent');
  const env = {PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C'};
  assert(
    !Object.keys(env).some((key) => /proxy|token|api[_-]?key|secret|authorization/i.test(key)),
    'RUNTIME_VERIFY_ENV_BLOCKED: system verifier environment contains proxy or credential state',
  );
  const result = execute(process.execPath, [RUNTIME_LOCK_VALIDATOR, 'validate-production'], {env});
  assert(result.exitCode === 0, `RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED: ${result.stderr.trim()}`);
  const gate = JSON.parse(result.stdout);
  assert(gate.actionAllowed === true, `RUNTIME_SNAPSHOT_DELEGATION_BLOCKED: ${gate.blockedReason || 'system attestation did not authorize action'}`);
  assert(gate.snapshotRoot && !gate.snapshotRoot.startsWith(`${REPO_ROOT}${sep}`), 'Runtime snapshot is not external to the project');
  return gate;
};

const assertSystemSignedWrapperReceipt = (receipt) => {
  void receipt;
  fail(
    'SYSTEM_TRUST_ROOT_NOT_WIRED_BLOCKED: repository public keys cannot validate a live system execution attestation',
  );
};

const assertControlledReceiptPresent = (receiptPath, missingMessage) => {
  assert(pathLexists(receiptPath), missingMessage);
};

const assertLockedContract = (contract) => {
  const render = contract.candidateOnlyRender;
  assert(render.mode === 'candidate-only', 'Candidate contract mode mismatch');
  assert(render.entry === LOCKED.entry, 'Candidate entry differs from wrapper constant');
  assert(render.composition === LOCKED.composition, 'Candidate composition differs from wrapper constant');
  assert(
    render.comparisonComposition === LOCKED.comparisonComposition,
    'Candidate comparisonComposition differs from wrapper constant',
  );
  assert(render.stillComposition === LOCKED.stillComposition, 'Candidate stillComposition differs from wrapper constant');
  assert(render.outputDirectory === LOCKED.outputDirectory, 'Candidate outputDirectory differs from wrapper constant');
  assert(render.output === LOCKED.output, 'Candidate output differs from wrapper constant');
  assert(render.comparisonOutput === LOCKED.comparisonOutput, 'Candidate comparisonOutput differs from wrapper constant');
  assert(render.stillDirectory === LOCKED.stillDirectory, 'Candidate stillDirectory differs from wrapper constant');
  assert(JSON.stringify(render.stillFrames) === JSON.stringify(LOCKED.stillFrames), 'Candidate stillFrames differ from wrapper constant');
  assert(render.gate === LOCKED.candidateGate, 'Candidate gate differs from wrapper constant');
  assert(contract.publicDir === LOCKED.publicDir, 'Candidate publicDir differs from wrapper constant');
  assert(render.formal === false, 'Candidate contract enables formal render');
  assert(render.productionEligible === false && contract.productionEligible === false, 'Candidate contract enables production');
  assert(render.externalNetworkAllowed === false, 'Candidate contract permits external network');
  assert(render.loopbackAllowed === true, 'Candidate contract blocks required local Remotion loopback');
  assert(render.paidGenerationAllowed === false, 'Candidate contract permits paid generation');
  assert(
    JSON.stringify(
      Object.fromEntries(Object.entries(contract.screenClips).map(([id, clip]) => [id, [clip.sourceIn, clip.sourceOut]])),
    ) === JSON.stringify(LOCKED.screenSourceRanges),
    'Candidate contract screen source ranges differ from wrapper constants',
  );
  assert(
    JSON.stringify([contract.talkingHeadClip.spokenSourceIn, contract.talkingHeadClip.spokenSourceOut]) ===
      JSON.stringify(LOCKED.talkingHeadSourceRange),
    'Candidate talking-head source range differs from wrapper constant',
  );
  assert(
    JSON.stringify(contract.semanticFrameGates) === JSON.stringify(LOCKED.semanticFrameGates),
    'Candidate semantic frame gates differ from wrapper constants',
  );
  assert(contract.screenMedia.staticFileName !== RETIRED_SCREEN_NAME, 'Retired screen path selected');
  assert(contract.screenMedia.sha256 !== RETIRED_SCREEN_SHA, 'Retired screen SHA selected');
};

const assertVideoRenderAuthorized = (contract) => {
  const policy = contract.candidateOnlyRender.stillAcceptancePolicy;
  assert(policy?.requiredBeforeVideoRender === true, 'Candidate still acceptance policy is missing');
  assert(policy.receiptPath === relativeRepo(STILL_ACCEPTANCE_RECEIPT), 'Candidate still acceptance receipt path mismatch');
  assert(policy.trustModel === 'independent-system-ed25519-external-message-anchor', 'Candidate still acceptance trust model mismatch');
  return runValidator(STILL_ACCEPTANCE_VALIDATOR, STILL_ACCEPTANCE_RECEIPT);
};

const assertCandidateOnlyCode = () => {
  const scannedPaths = RUNTIME_RELATIVE_PATHS
    .filter((path) =>
      /(?:entry|DirectorV2E2EWechat|timeline)\.tsx?$|candidate-media-contract\.json$|visual-semantic-contract\.json$/.test(
        path,
      ),
    )
    .map((path) => resolveRepo(path, 'runtime source'));
  const forbiddenProviderPattern =
    /runninghub|hailuo|minimax|agnes|fal\.ai|replicate|openai|api[_-]?key|authorization\s*:/i;
  const providerMarkersFound = [];
  for (const path of scannedPaths) {
    const text = readFileSync(path, 'utf8');
    if (forbiddenProviderPattern.test(text)) providerMarkersFound.push(relativeRepo(path));
    if (['entry.tsx', 'DirectorV2E2EWechat.tsx', 'timeline.ts'].includes(basename(path))) {
      assert(!/https?:\/\//.test(text), `External URL remains in candidate runtime source ${path}`);
      assert(
        !/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\bEventSource\b/.test(text),
        `Network-capable runtime call remains in ${path}`,
      );
    }
  }
  const wrapperImports = [
    ...readFileSync(THIS_FILE, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);
  assert(
    wrapperImports.every((specifier) => specifier.startsWith('node:')),
    `Candidate wrapper imports a non-local provider-capable module: ${wrapperImports.join(', ')}`,
  );
  assert(providerMarkersFound.length === 0, `Provider/payment path found: ${providerMarkersFound.join(', ')}`);
  return {
    scannedPaths: scannedPaths.map(relativeRepo),
    wrapperImports,
    providerMarkersFound,
    providerClientImported: false,
    paidGenerationPathPresent: false,
  };
};

const manifestPublicDir = (publicDir) => {
  assertNoSymlinkSegments(REPO_ROOT, publicDir, 'candidate publicDir');
  const entries = readdirSync(publicDir, {withFileTypes: true});
  assert(entries.every((entry) => entry.isFile()), 'Candidate publicDir contains a directory or symlink');
  const files = entries
    .map((entry) => fileIdentity(resolve(publicDir, entry.name)))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    path: relativeRepo(publicDir),
    files,
    manifestSha256: sha256Text(JSON.stringify(files)),
  };
};

const runtimeCodeManifest = () => {
  const files = RUNTIME_RELATIVE_PATHS.map((path) => fileIdentity(resolveRepo(path, 'runtime binding')));
  const projectFiles = projectRuntimeBindings();
  const browser = browserBinding();
  const directImportGraph = directRuntimePackageGraph();
  assertDirectRuntimePackageSet(directImportGraph);
  const nodeModulesTree = canonicalTreeManifest(resolve(REMOTION_ROOT, 'node_modules'), {
    excludeRelativePrefixes: ['.cache'],
  });
  const payload = {files, projectFiles, browser, directImportGraph, nodeModulesTree};
  return {...payload, manifestSha256: sha256Text(JSON.stringify(payload))};
};

const validateCliLayout = ({launcherPath, expectedTargetPath, expectedLinkTarget, expectedTargetSha256}) => {
  assert(pathLexists(launcherPath), 'Local Remotion launcher is missing');
  assert(lstatSync(launcherPath).isSymbolicLink(), 'Local Remotion launcher is not the locked symlink');
  assert(readlinkSync(launcherPath) === expectedLinkTarget, 'Remotion launcher symlink target differs from the locked target');
  const target = realpathSync(launcherPath);
  assert(target === expectedTargetPath, 'Remotion CLI real target differs from the locked repo-relative target');
  assert(sha256(target) === expectedTargetSha256, 'Remotion CLI real target SHA mismatch');
  return {target, launcherLinkTarget: readlinkSync(launcherPath)};
};

const cliBinding = () => {
  const expectedTarget = resolveRepo(LOCKED_REMOTION_CLI.realTargetRelativePath, 'locked Remotion CLI target');
  const layout = validateCliLayout({
    launcherPath: LOCAL_REMOTION_LAUNCHER,
    expectedTargetPath: expectedTarget,
    expectedLinkTarget: LOCKED_REMOTION_CLI.launcherLinkTarget,
    expectedTargetSha256: LOCKED_REMOTION_CLI.realTargetSha256,
  });
  const packageIdentity = assertPinnedFile({
    path: LOCKED_REMOTION_CLI.packageJsonRelativePath,
    sha256: LOCKED_REMOTION_CLI.packageJsonSha256,
  });
  const packageJson = JSON.parse(readFileSync(resolveRepo(LOCKED_REMOTION_CLI.packageJsonRelativePath, 'locked CLI package JSON'), 'utf8'));
  assert(packageJson.version === LOCKED_REMOTION_CLI.version, 'Remotion CLI package version mismatch');
  return {
    launcherPath: relativeRepo(LOCAL_REMOTION_LAUNCHER),
    launcherIsSymlink: true,
    launcherLinkTarget: layout.launcherLinkTarget,
    realTarget: relativeRepo(layout.target),
    targetSha256: LOCKED_REMOTION_CLI.realTargetSha256,
    targetIdentity: fileIdentity(layout.target),
    cliPackage: {...packageIdentity, version: packageJson.version},
    packageLock: fileIdentity(PACKAGE_LOCK),
    projectRuntime: projectRuntimeBindings(),
    browser: browserBinding(),
    nodeRuntime: {
      absolutePath: process.execPath,
      realPath: realpathSync(process.execPath),
      sha256: sha256(realpathSync(process.execPath)),
    },
  };
};

const networkDenyProbe = () => {
  assert(existsSync(SANDBOX_EXEC), 'sandbox-exec is unavailable');
  const sandboxProfile = readFileSync(SANDBOX_PROFILE_PATH, 'utf8');
  assertLoopbackOnlySandboxProfile(sandboxProfile);
  const python = CONTROLLED_TOOL_PATHS.networkProbePython;
  const loopbackProbeCode =
    'import socket; s=socket.socket(); s.bind(("0.0.0.0",0)); s.listen(1); port=s.getsockname()[1]; c=socket.socket(); c.connect(("127.0.0.1",port)); p,_=s.accept(); c.sendall(b"x"); assert p.recv(1)==b"x"; p.close(); c.close(); s.close()';
  const loopback = execute(
    SANDBOX_EXEC,
    ['-f', SANDBOX_PROFILE_PATH, python, '-c', loopbackProbeCode],
    {env: minimalEnvironment()},
  );
  assert(loopback.exitCode === 0, `Loopback server/client failed inside sandbox: ${loopback.stderr}`);
  const externalProbeCode = 'import socket; socket.create_connection(("1.1.1.1", 53), 1)';
  const external = execute(
    SANDBOX_EXEC,
    ['-f', SANDBOX_PROFILE_PATH, python, '-c', externalProbeCode],
    {env: minimalEnvironment()},
  );
  assert(external.exitCode !== 0, 'External network probe unexpectedly succeeded inside loopback-only sandbox');
  assert(
    /Operation not permitted|PermissionError/.test(external.stderr),
    `External probe did not fail because of sandbox denial: ${external.stderr}`,
  );
  return {
    sandboxExecutable: SANDBOX_EXEC,
    sandboxExecutableSha256: sha256(SANDBOX_EXEC),
    profilePath: relativeRepo(SANDBOX_PROFILE_PATH),
    profileSha256: sha256(SANDBOX_PROFILE_PATH),
    policy: 'external-process-boundary-denied-loopback-only-end-to-end-unproven',
    loopbackProbe: {
      command: [SANDBOX_EXEC, '-f', relativeRepo(SANDBOX_PROFILE_PATH), python, '-c', '<fixed-loopback-probe>'],
      exitCode: loopback.exitCode,
      stdoutSha256: sha256Text(loopback.stdout),
      stderrSha256: sha256Text(loopback.stderr),
      allowed: true,
    },
    externalProbe: {
      command: [SANDBOX_EXEC, '-f', relativeRepo(SANDBOX_PROFILE_PATH), python, '-c', '<fixed-external-probe>'],
      exitCode: external.exitCode,
      stderrSha256: sha256Text(external.stderr),
      denied: true,
    },
    loopbackAllowed: true,
    externalNetworkDeniedAtProcessBoundary: true,
    endToEndExternalNetworkDenied: false,
    loopbackRelayRisk: 'blocked-unmeasured',
    enforcedNetworkDeny: true,
  };
};

const assertLoopbackOnlySandboxProfile = (sandboxProfile) => {
  assert(
    sandboxProfile.includes('(deny network-outbound (require-not (remote ip "localhost:*")))'),
    'Sandbox profile does not deny non-loopback outbound network access',
  );
  assert(
    sandboxProfile.includes(
      '(deny network-inbound (require-all (remote ip) (require-not (remote ip "localhost:*"))))',
    ),
    'Sandbox profile does not deny non-loopback inbound network access',
  );
};

const captureClosure = ({contract, mediaReceipt, publicDir}) => {
  assertLockedContract(contract);
  const code = runtimeCodeManifest();
  const publicManifest = manifestPublicDir(publicDir);
  const screenFile = publicManifest.files.find((file) => basename(file.path) === contract.screenMedia.staticFileName);
  const spokenFile = publicManifest.files.find((file) => basename(file.path) === contract.spokenMedia.staticFileName);
  assert(screenFile?.sha256 === contract.screenMedia.sha256, 'Public screen SHA differs from contract');
  assert(spokenFile?.sha256 === contract.spokenMedia.sha256, 'Public spoken SHA differs from contract');
  assert(
    JSON.stringify(
      publicManifest.files.map((file) => ({
        staticFileName: basename(file.path),
        bytes: file.bytes,
        sha256: file.sha256,
      })),
    ) ===
      JSON.stringify(
        mediaReceipt.publicDirManifest.files.map((file) => ({
          staticFileName: file.staticFileName,
          bytes: file.bytes,
          sha256: file.sha256,
        })),
      ),
    'PublicDir files differ from candidate media receipt',
  );
  return {
    contract: fileIdentity(CONTRACT_PATH),
    proxyReceipt: fileIdentity(PROXY_RECEIPT),
    mediaReceipt: fileIdentity(MEDIA_RECEIPT),
    mediaBuildWrapperReceipt: pathLexists(MEDIA_BUILD_WRAPPER_RECEIPT)
      ? fileIdentity(MEDIA_BUILD_WRAPPER_RECEIPT)
      : null,
    stillAcceptanceReceipt: pathLexists(STILL_ACCEPTANCE_RECEIPT) ? fileIdentity(STILL_ACCEPTANCE_RECEIPT) : null,
    runtimeCodeManifest: code,
    publicDirManifest: publicManifest,
    cli: cliBinding(),
    controlledTools: controlledToolBindings(),
  };
};

const assertSameClosure = (expected, contract, mediaReceipt, publicDir) => {
  const actual = captureClosure({contract, mediaReceipt, publicDir});
  assert(JSON.stringify(actual) === JSON.stringify(expected), 'Candidate render closure changed after validation');
  return actual;
};

const claimAction = (mode) => {
  const workspaceRoot = mkdtempSync(resolve(tmpdir(), `koubo-candidate-${mode}-claim-`));
  assert(!lstatSync(workspaceRoot).isSymbolicLink(), 'Candidate claim workspace is a symlink');
  const claimId = `${mode}-${nowIso().replace(/[:.]/g, '-')}-${randomBytes(8).toString('hex')}`;
  const claimPath = resolve(workspaceRoot, 'action.claim');
  const fd = openExclusiveNoFollow(claimPath, 0o600);
  writeFileSync(fd, `${JSON.stringify({claimId, mode, claimedAt: nowIso(), pid: process.pid})}\n`);
  closeSync(fd);
  return {claimId, claimPath, claimSha256: sha256(claimPath), workspaceRoot};
};

const cleanupEphemeralClaim = (claim) => {
  if (claim?.workspaceRoot && pathLexists(claim.workspaceRoot)) {
    rmSync(claim.workspaceRoot, {recursive: true, force: true});
  }
};

const createExclusiveOutputDirectory = (mode, contract) => {
  const finalTarget =
    mode === 'stills'
      ? resolveRepo(contract.candidateOnlyRender.stillDirectory, 'candidate stillDirectory')
      : resolveRepo(contract.candidateOnlyRender.outputDirectory, 'candidate outputDirectory');
  assertPathDoesNotExist(finalTarget, `${mode} output directory`);
  const parent = dirname(finalTarget);
  assertNoSymlinkSegments(REPO_ROOT, parent, `${mode} output parent`);
  const parentIdentityBefore = directoryIdentity(parent, REPO_ROOT, `${mode} output parent`);
  const target = mkdtempSync(resolve(parent, `.candidate-${mode}-staging-`));
  assertNoSymlinkSegments(REPO_ROOT, target, `${mode} staging output directory after create`);
  const parentIdentityAfter = directoryIdentity(parent, REPO_ROOT, `${mode} output parent after create`);
  assert(
    JSON.stringify(parentIdentityBefore) === JSON.stringify(parentIdentityAfter),
    `${mode} output parent changed during exclusive directory creation`,
  );
  return {target, finalTarget, parentIdentity: parentIdentityAfter, identity: directoryIdentity(target, REPO_ROOT, `${mode} staging output directory`)};
};

const finalizeExclusiveOutputDirectory = (claimed) => {
  assertOutputDirectoryUnchanged(claimed);
  assertPathDoesNotExist(claimed.finalTarget, 'Candidate final output directory');
  const parent = dirname(claimed.finalTarget);
  assert(
    JSON.stringify(directoryIdentity(parent, REPO_ROOT, 'candidate output parent before atomic placement')) ===
      JSON.stringify(claimed.parentIdentity),
    'Candidate output parent changed before atomic placement',
  );
  renameSync(claimed.target, claimed.finalTarget);
  assertNoSymlinkSegments(REPO_ROOT, claimed.finalTarget, 'candidate final output directory after atomic placement');
  return claimed.finalTarget;
};

const assertOutputDirectoryUnchanged = (claimed) => {
  const actual = directoryIdentity(claimed.target, REPO_ROOT, 'claimed output directory');
  assert(JSON.stringify(actual) === JSON.stringify(claimed.identity), 'Claimed output directory inode changed');
};

const renderArguments = ({contract, publicDir, outputPath, frame, composition}) => {
  const command = frame === undefined ? 'render' : 'still';
  const args = [
    command,
    LOCKED.entry,
    composition,
    outputPath,
    `--public-dir=${publicDir}`,
    `--props=${JSON.stringify({candidateRenderGate: LOCKED.candidateGate})}`,
    '--overwrite=false',
    '--bundle-cache=false',
    `--browser-executable=${LOCKED_BROWSER_PATH}`,
    '--log=info',
  ];
  if (frame === undefined) args.push('--codec=h264', '--pixel-format=yuv420p', '--crf=18');
  else args.push(`--frame=${frame}`, '--image-format=png');
  assert(contract.candidateOnlyRender.entry === LOCKED.entry, 'Render entry TOCTOU mismatch');
  assert(
    [LOCKED.composition, LOCKED.comparisonComposition, LOCKED.stillComposition].includes(composition),
    'Render composition is not a locked candidate composition',
  );
  return args;
};

const sandboxedRemotion = (args) => {
  const cli = cliBinding();
  const cliTarget = resolveRepo(cli.realTarget, 'sandboxed Remotion CLI target');
  const commandArgs = ['-f', SANDBOX_PROFILE_PATH, process.execPath, cliTarget, ...args];
  const result = execute(SANDBOX_EXEC, commandArgs, {cwd: REMOTION_ROOT, env: minimalEnvironment()});
  return {
    ...result,
    commandForReceipt: [
      SANDBOX_EXEC,
      '-f',
      `<profile-sha256:${sha256(SANDBOX_PROFILE_PATH)}>`,
      '<node-runtime>',
      relativeRepo(cliTarget),
      ...args,
    ],
  };
};

const receiptPathFor = (mode) => {
  const path = RECEIPT_PATHS[mode];
  assert(path, `No receipt path for mode ${mode}`);
  assertNoSymlinkSegments(PREVIEW_DIR, path, `${mode} wrapper receipt`);
  assertPathDoesNotExist(path, `${mode} wrapper receipt`);
  return path;
};

const buildReceipt = ({
  mode,
  claim,
  startedAt,
  completedAt,
  proxyValidation,
  mediaValidation,
  stillAcceptanceValidation,
  closure,
  networkPolicy,
  paidPolicy,
  outputs,
  renderCommands,
}) => {
  const renderedAt = mode === 'render' ? completedAt : null;
  const output = outputs.find((item) => item.role === 'with-sfx') || null;
  const comparisonOutput = outputs.find((item) => item.role === 'no-sfx') || null;
  const renderBinding = {
    entry: LOCKED.entry,
    composition: LOCKED.composition,
    comparisonComposition: LOCKED.comparisonComposition,
    stillComposition: LOCKED.stillComposition,
    publicDir: LOCKED.publicDir,
    output: mode === 'render' ? LOCKED.output : null,
    comparisonOutput: mode === 'render' ? LOCKED.comparisonOutput : null,
    mode,
    renderedAt,
    claimId: claim.claimId,
    candidateMediaReceiptSha256: closure.mediaReceipt.sha256,
    mediaContractSha256: closure.contract.sha256,
    runtimeCodeManifestSha256: closure.runtimeCodeManifest.manifestSha256,
    publicDirManifestSha256: closure.publicDirManifest.manifestSha256,
    remotionCliTargetSha256: closure.cli.targetSha256,
    packageLockSha256: closure.cli.packageLock.sha256,
    sandboxProfileSha256: networkPolicy.profileSha256,
    stillAcceptanceReceiptSha256: mode === 'render' ? closure.stillAcceptanceReceipt?.sha256 : null,
    candidateMp4Sha256: mode === 'render' ? output?.sha256 : null,
    noSfxComparisonMp4Sha256: mode === 'render' ? comparisonOutput?.sha256 : null,
  };
  const receipt = {
    schemaVersion: 'director-controlled-candidate-wrapper-receipt/v2',
    evidenceScope: 'real-e2e',
    status:
      mode === 'render'
        ? 'candidate-render-action-completed'
        : mode === 'stills'
          ? 'candidate-stills-action-completed'
          : mode === 'build-media'
            ? 'candidate-media-build-action-completed'
            : 'candidate-preflight-passed',
    mode,
    claimId: claim.claimId,
    claimedAtReceipt: {
      claimId: claim.claimId,
      sha256: claim.claimSha256,
      storage: 'ephemeral-o_nofollow-exclusive-removed-after-system-attestation',
    },
    startedAt,
    completedAt,
    renderedAt,
    formal: false,
    productionEligible: false,
    networkPolicy: 'external-process-boundary-denied-loopback-only-end-to-end-unproven',
    loopbackUsed: true,
    externalNetworkDeniedAtProcessBoundary: true,
    endToEndExternalNetworkDenied: false,
    loopbackRelayRisk: 'blocked-unmeasured',
    paidGenerationUsed: false,
    candidateMedia: {path: closure.mediaReceipt.path, sha256: closure.mediaReceipt.sha256},
    mediaBuildWrapperReceipt:
      mode === 'build-media' || !closure.mediaBuildWrapperReceipt
        ? null
        : {path: closure.mediaBuildWrapperReceipt.path, sha256: closure.mediaBuildWrapperReceipt.sha256},
    proxyReceipt: {path: closure.proxyReceipt.path, sha256: closure.proxyReceipt.sha256},
    stillAcceptanceReceipt:
      mode === 'render'
        ? {path: closure.stillAcceptanceReceipt.path, sha256: closure.stillAcceptanceReceipt.sha256}
        : null,
    wrapperEntrypoint: fileIdentity(THIS_FILE),
    runtimeCodeManifest: closure.runtimeCodeManifest,
    mediaContract: {path: closure.contract.path, sha256: closure.contract.sha256},
    publicDirManifest: closure.publicDirManifest,
    cliBinding: closure.cli,
    controlledTools: closure.controlledTools,
    sandbox: networkPolicy,
    paidGenerationEvidence: paidPolicy,
    inputValidation: {
      proxy: proxyValidation,
      candidateMedia: mediaValidation,
      stillAcceptance: mode === 'render' ? stillAcceptanceValidation : null,
    },
    outputs,
    renderCommands,
    renderBinding,
    renderBindingSha256: sha256Text(JSON.stringify(renderBinding)),
    directRenderBoundary: {
      physicallyImpossibleClaimed: false,
      policyAuthorized: false,
      eligibleWithoutThisExactReceipt: false,
      explanation:
        'A repository writer can copy the gate prop and invoke Remotion directly. Such bytes cannot enter QA or promotion because they lack this immutable wrapper/media/code/publicDir/output binding receipt.',
    },
  };
  return receipt;
};

const writeReceiptExclusive = (mode, receipt) => {
  void mode;
  void receipt;
  fail('SYSTEM_RECEIPT_SIGNER_MISSING_BLOCKED: unsigned local wx JSON cannot become a controlled wrapper receipt');
};

const validateControlledMediaBuildReceipt = () => {
  assertControlledReceiptPresent(
    MEDIA_BUILD_WRAPPER_RECEIPT,
    'Controlled candidate media-build wrapper receipt is missing',
  );
  assert(!lstatSync(MEDIA_BUILD_WRAPPER_RECEIPT).isSymbolicLink(), 'Candidate media-build wrapper receipt is a symlink');
  const receipt = JSON.parse(readFileSync(MEDIA_BUILD_WRAPPER_RECEIPT, 'utf8'));
  assert(receipt.schemaVersion === 'director-controlled-candidate-wrapper-receipt/v2', 'Media-build wrapper schema mismatch');
  assert(receipt.evidenceScope === 'real-e2e', 'Media-build wrapper evidence scope mismatch');
  assertSystemSignedWrapperReceipt(receipt);
  assert(receipt.status === 'candidate-media-build-action-completed' && receipt.mode === 'build-media', 'Media-build wrapper status/mode mismatch');
  assert(receipt.formal === false && receipt.productionEligible === false, 'Media-build wrapper enables formal/production');
  assert(
    receipt.networkPolicy === 'external-process-boundary-denied-loopback-only-end-to-end-unproven' &&
      receipt.externalNetworkDeniedAtProcessBoundary === true &&
      receipt.endToEndExternalNetworkDenied === false &&
      receipt.loopbackRelayRisk === 'blocked-unmeasured' &&
      receipt.loopbackUsed === true,
    'Media-build wrapper network policy mismatch',
  );
  assert(receipt.paidGenerationUsed === false, 'Media-build wrapper reports paid generation');
  assert(JSON.stringify(receipt.wrapperEntrypoint) === JSON.stringify(fileIdentity(THIS_FILE)), 'Media-build wrapper entrypoint binding mismatch');
  assert(receipt.mediaBuildWrapperReceipt === null, 'Media-build wrapper receipt contains a self-referential binding');
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  assertLockedContract(contract);
  assert(pathLexists(MEDIA_RECEIPT), 'Candidate media receipt built by wrapper is missing');
  const mediaReceipt = JSON.parse(readFileSync(MEDIA_RECEIPT, 'utf8'));
  const publicDir = resolveRepo(LOCKED.publicDir, 'media-build publicDir');
  const closure = captureClosure({contract, mediaReceipt, publicDir});
  assert(JSON.stringify(receipt.runtimeCodeManifest) === JSON.stringify(closure.runtimeCodeManifest), 'Media-build runtime closure changed');
  assert(JSON.stringify(receipt.publicDirManifest) === JSON.stringify(closure.publicDirManifest), 'Media-build publicDir closure changed');
  assert(JSON.stringify(receipt.cliBinding) === JSON.stringify(closure.cli), 'Media-build CLI binding changed');
  assert(JSON.stringify(receipt.controlledTools) === JSON.stringify(closure.controlledTools), 'Media-build controlled tools changed');
  assert(
    receipt.candidateMedia.path === closure.mediaReceipt.path &&
      receipt.candidateMedia.sha256 === closure.mediaReceipt.sha256 &&
      receipt.mediaContract.path === closure.contract.path &&
      receipt.mediaContract.sha256 === closure.contract.sha256 &&
      receipt.proxyReceipt.path === closure.proxyReceipt.path &&
      receipt.proxyReceipt.sha256 === closure.proxyReceipt.sha256,
    'Media-build source/receipt binding mismatch',
  );
  const evidenceTree = canonicalTreeManifest(MEDIA_EVIDENCE_DIRECTORY);
  assert(
    receipt.outputs?.length === 2 &&
      receipt.outputs[0].role === 'candidate-media-receipt' &&
      JSON.stringify(receipt.outputs[0].identity) === JSON.stringify(fileIdentity(MEDIA_RECEIPT)) &&
      receipt.outputs[1].role === 'candidate-media-evidence-tree' &&
      JSON.stringify(receipt.outputs[1].manifest) === JSON.stringify(evidenceTree),
    'Media-build output/evidence tree binding mismatch',
  );
  assert(
    receipt.renderCommands?.length === 1 &&
      receipt.renderCommands[0].role === 'candidate-media-build' &&
      receipt.renderCommands[0].exitCode === 0 &&
      receipt.renderCommands[0].command?.[0] === SANDBOX_EXEC &&
      receipt.renderCommands[0].command.at(-1) === 'build',
    'Media-build command is not the controlled sandboxed build action',
  );
  const liveNetworkPolicy = networkDenyProbe();
  assert(receipt.sandbox.profileSha256 === liveNetworkPolicy.profileSha256, 'Media-build sandbox profile changed');
  const proxyValidation = runValidator(PROXY_VALIDATOR, PROXY_RECEIPT);
  const mediaValidation = runValidator(MEDIA_VALIDATOR, MEDIA_RECEIPT);
  assert(
    JSON.stringify(receipt.inputValidation.proxy) === JSON.stringify(proxyValidation) &&
      JSON.stringify(receipt.inputValidation.candidateMedia) === JSON.stringify(mediaValidation) &&
      receipt.inputValidation.stillAcceptance === null,
    'Media-build sandboxed validation binding mismatch',
  );
  return {ok: true, receiptPath: relativeRepo(MEDIA_BUILD_WRAPPER_RECEIPT), receiptSha256: sha256(MEDIA_BUILD_WRAPPER_RECEIPT)};
};

const validateControlledStillsReceipt = () => {
  const receiptPath = RECEIPT_PATHS.stills;
  assertControlledReceiptPresent(receiptPath, 'Controlled candidate stills wrapper receipt is missing');
  assert(!lstatSync(receiptPath).isSymbolicLink(), 'Candidate stills wrapper receipt is a symlink');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert(receipt.schemaVersion === 'director-controlled-candidate-wrapper-receipt/v2', 'Stills wrapper schema mismatch');
  assert(receipt.evidenceScope === 'real-e2e', 'Stills wrapper evidence scope mismatch');
  assertSystemSignedWrapperReceipt(receipt);
  assert(receipt.status === 'candidate-stills-action-completed' && receipt.mode === 'stills', 'Stills wrapper status/mode mismatch');
  assert(receipt.formal === false && receipt.productionEligible === false, 'Stills wrapper enables formal/production');
  assert(
    receipt.networkPolicy === 'external-process-boundary-denied-loopback-only-end-to-end-unproven' &&
      receipt.externalNetworkDeniedAtProcessBoundary === true &&
      receipt.endToEndExternalNetworkDenied === false &&
      receipt.loopbackRelayRisk === 'blocked-unmeasured' &&
      receipt.loopbackUsed === true,
    'Stills wrapper network policy mismatch',
  );
  assert(receipt.paidGenerationUsed === false, 'Stills wrapper reports paid generation');
  assert(JSON.stringify(receipt.wrapperEntrypoint) === JSON.stringify(fileIdentity(THIS_FILE)), 'Stills wrapper entrypoint binding mismatch');
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  assertLockedContract(contract);
  assert(pathLexists(MEDIA_RECEIPT), 'Candidate media receipt is missing for stills receipt validation');
  const mediaBuildValidation = validateControlledMediaBuildReceipt();
  const mediaReceipt = JSON.parse(readFileSync(MEDIA_RECEIPT, 'utf8'));
  const publicDir = resolveRepo(LOCKED.publicDir, 'stills receipt publicDir');
  const closure = captureClosure({contract, mediaReceipt, publicDir});
  assert(JSON.stringify(receipt.runtimeCodeManifest) === JSON.stringify(closure.runtimeCodeManifest), 'Stills runtime closure changed');
  assert(JSON.stringify(receipt.publicDirManifest) === JSON.stringify(closure.publicDirManifest), 'Stills publicDir closure changed');
  assert(JSON.stringify(receipt.cliBinding) === JSON.stringify(closure.cli), 'Stills CLI binding changed');
  assert(JSON.stringify(receipt.controlledTools) === JSON.stringify(closure.controlledTools), 'Stills controlled tools changed');
  assert(
    receipt.mediaContract.path === closure.contract.path && receipt.mediaContract.sha256 === closure.contract.sha256 &&
      receipt.candidateMedia.path === closure.mediaReceipt.path && receipt.candidateMedia.sha256 === closure.mediaReceipt.sha256 &&
      receipt.proxyReceipt.path === closure.proxyReceipt.path && receipt.proxyReceipt.sha256 === closure.proxyReceipt.sha256 &&
      receipt.mediaBuildWrapperReceipt.path === closure.mediaBuildWrapperReceipt?.path &&
      receipt.mediaBuildWrapperReceipt.sha256 === closure.mediaBuildWrapperReceipt?.sha256,
    'Stills media/contract/build binding mismatch',
  );
  const proxyValidation = runValidator(PROXY_VALIDATOR, PROXY_RECEIPT);
  const mediaValidation = runValidator(MEDIA_VALIDATOR, MEDIA_RECEIPT);
  assert(
    JSON.stringify(receipt.inputValidation.proxy) === JSON.stringify(proxyValidation) &&
      JSON.stringify(receipt.inputValidation.candidateMedia) === JSON.stringify(mediaValidation) &&
      JSON.stringify(receipt.inputValidation.mediaBuildWrapper) === JSON.stringify(mediaBuildValidation) &&
      receipt.inputValidation.stillAcceptance === null,
    'Stills sandboxed input validation binding mismatch',
  );
  assert(
    JSON.stringify(receipt.outputs.map((item) => item.frame)) === JSON.stringify(LOCKED.stillFrames) &&
      new Set(receipt.outputs.map((item) => item.frame)).size === LOCKED.stillFrames.length,
    'Stills receipt frame set/order mismatch',
  );
  for (const output of receipt.outputs) {
    assert(output.role === 'still', `Unexpected still output role for frame ${output.frame}`);
    const live = fileIdentity(resolveRepo(output.path, `controlled still ${output.frame}`));
    assert(JSON.stringify(output) === JSON.stringify({role: 'still', frame: output.frame, ...live}), `Controlled still ${output.frame} live identity mismatch`);
  }
  assert(
    receipt.renderCommands?.length === LOCKED.stillFrames.length &&
      receipt.renderCommands.every((command) =>
        command.exitCode === 0 && command.command?.[0] === SANDBOX_EXEC &&
        command.command.includes('--overwrite=false') && command.command.includes('--bundle-cache=false') &&
        command.command.includes(`--browser-executable=${LOCKED_BROWSER_PATH}`) &&
        command.command.includes(`--public-dir=${publicDir}`)),
    'Stills commands are not the locked sandboxed non-overwrite commands',
  );
  assert(receipt.renderBinding.mode === 'stills' && receipt.renderBindingSha256 === sha256Text(JSON.stringify(receipt.renderBinding)), 'Stills render binding mismatch');
  assert(
    receipt.claimedAtReceipt.claimId === receipt.claimId &&
      /^[a-f0-9]{64}$/.test(receipt.claimedAtReceipt.sha256) &&
      receipt.claimedAtReceipt.storage === 'ephemeral-o_nofollow-exclusive-removed-after-system-attestation',
    'Stills ephemeral claim attestation binding mismatch',
  );
  return {ok: true, receiptPath: relativeRepo(receiptPath), receiptSha256: sha256(receiptPath)};
};

const validateControlledRenderReceipt = ({receiptPath, outputPath}) => {
  assert(pathLexists(receiptPath), 'Controlled render receipt is missing');
  assert(!lstatSync(receiptPath).isSymbolicLink(), 'Controlled render receipt is a symlink');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert(receipt.schemaVersion === 'director-controlled-candidate-wrapper-receipt/v2', 'Wrapper receipt schema mismatch');
  assert(receipt.evidenceScope === 'real-e2e', 'Wrapper receipt evidence scope mismatch');
  assertSystemSignedWrapperReceipt(receipt);
  assert(receipt.status === 'candidate-render-action-completed', 'Wrapper receipt status mismatch');
  assert(receipt.mode === 'render', 'Wrapper receipt is not a render receipt');
  assert(receipt.formal === false && receipt.productionEligible === false, 'Wrapper receipt enables formal/production');
  assert(
    receipt.networkPolicy === 'external-process-boundary-denied-loopback-only-end-to-end-unproven' &&
      receipt.loopbackUsed === true &&
      receipt.externalNetworkDeniedAtProcessBoundary === true &&
      receipt.endToEndExternalNetworkDenied === false &&
      receipt.loopbackRelayRisk === 'blocked-unmeasured',
    'Wrapper receipt lacks the enforced loopback-only network policy',
  );
  assert(receipt.paidGenerationUsed === false, 'Wrapper receipt reports paid generation use');
  assert(
    receipt.sandbox.enforcedNetworkDeny === true &&
      receipt.sandbox.loopbackAllowed === true &&
      receipt.sandbox.externalNetworkDeniedAtProcessBoundary === true &&
      receipt.sandbox.endToEndExternalNetworkDenied === false &&
      receipt.sandbox.loopbackRelayRisk === 'blocked-unmeasured',
    'Wrapper receipt lacks enforced loopback-only network evidence',
  );
  assert(
    JSON.stringify(receipt.wrapperEntrypoint) === JSON.stringify(fileIdentity(THIS_FILE)),
    'Wrapper receipt entrypoint binding differs from live wrapper',
  );
  assert(receipt.renderBinding.entry === LOCKED.entry, 'Render receipt entry mismatch');
  assert(receipt.renderBinding.composition === LOCKED.composition, 'Render receipt composition mismatch');
  assert(
    receipt.renderBinding.comparisonComposition === LOCKED.comparisonComposition,
    'Render receipt comparison composition mismatch',
  );
  assert(receipt.renderBinding.publicDir === LOCKED.publicDir, 'Render receipt publicDir mismatch');
  assert(receipt.renderBinding.output === LOCKED.output, 'Render receipt output mismatch');
  assert(receipt.renderBinding.comparisonOutput === LOCKED.comparisonOutput, 'Render receipt comparison output mismatch');
  assert(
    receipt.renderBindingSha256 === sha256Text(JSON.stringify(receipt.renderBinding)),
    'Render binding SHA mismatch',
  );
  assert(receipt.renderedAt === receipt.completedAt, 'Render receipt renderedAt/completedAt mismatch');
  assert(Number.isFinite(Date.parse(receipt.renderedAt)), 'Render receipt timestamp is invalid');

  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  assertLockedContract(contract);
  assert(pathLexists(MEDIA_RECEIPT), 'Candidate media receipt is missing for render receipt validation');
  const mediaReceipt = JSON.parse(readFileSync(MEDIA_RECEIPT, 'utf8'));
  const publicDir = resolveRepo(LOCKED.publicDir, 'render receipt publicDir');
  const closure = captureClosure({contract, mediaReceipt, publicDir});
  assert(
    JSON.stringify(receipt.runtimeCodeManifest) === JSON.stringify(closure.runtimeCodeManifest),
    'Render receipt runtime code manifest differs from live closure',
  );
  assert(
    JSON.stringify(receipt.publicDirManifest) === JSON.stringify(closure.publicDirManifest),
    'Render receipt publicDir manifest differs from live closure',
  );
  assert(JSON.stringify(receipt.cliBinding) === JSON.stringify(closure.cli), 'Render receipt CLI binding differs from live closure');
  assert(
    JSON.stringify(receipt.controlledTools) === JSON.stringify(closure.controlledTools),
    'Render receipt controlled-tool binding differs from live closure',
  );
  assert(
    receipt.mediaContract.path === closure.contract.path &&
      receipt.mediaContract.sha256 === closure.contract.sha256 &&
      receipt.candidateMedia.path === closure.mediaReceipt.path &&
      receipt.candidateMedia.sha256 === closure.mediaReceipt.sha256 &&
      receipt.proxyReceipt.path === closure.proxyReceipt.path &&
      receipt.proxyReceipt.sha256 === closure.proxyReceipt.sha256 &&
      receipt.stillAcceptanceReceipt.path === closure.stillAcceptanceReceipt?.path &&
      receipt.stillAcceptanceReceipt.sha256 === closure.stillAcceptanceReceipt?.sha256,
    'Render receipt media/proxy/contract closure binding mismatch',
  );
  assert(
    receipt.renderBinding.candidateMediaReceiptSha256 === closure.mediaReceipt.sha256 &&
      receipt.renderBinding.mediaContractSha256 === closure.contract.sha256 &&
      receipt.renderBinding.runtimeCodeManifestSha256 === closure.runtimeCodeManifest.manifestSha256 &&
      receipt.renderBinding.publicDirManifestSha256 === closure.publicDirManifest.manifestSha256 &&
      receipt.renderBinding.remotionCliTargetSha256 === closure.cli.targetSha256 &&
      receipt.renderBinding.packageLockSha256 === closure.cli.packageLock.sha256 &&
      receipt.renderBinding.stillAcceptanceReceiptSha256 === closure.stillAcceptanceReceipt?.sha256 &&
      receipt.renderBinding.sandboxProfileSha256 === sha256(SANDBOX_PROFILE_PATH),
    'Render binding does not match the live candidate closure',
  );
  const liveNetworkPolicy = networkDenyProbe();
  assert(
    receipt.sandbox.profileSha256 === liveNetworkPolicy.profileSha256 &&
      receipt.sandbox.policy === liveNetworkPolicy.policy,
    'Render receipt sandbox policy differs from live enforcement',
  );
  const proxyValidation = runValidator(PROXY_VALIDATOR, PROXY_RECEIPT);
  const mediaValidation = runValidator(MEDIA_VALIDATOR, MEDIA_RECEIPT);
  const mediaBuildValidation = validateControlledMediaBuildReceipt();
  const stillAcceptanceValidation = assertVideoRenderAuthorized(contract);
  assert(
    proxyValidation.sandboxEnforced && mediaValidation.sandboxEnforced && stillAcceptanceValidation.sandboxEnforced,
    'Render receipt validators escaped sandbox',
  );
  assert(
    receipt.inputValidation.proxy.sandboxEnforced === true &&
      receipt.inputValidation.candidateMedia.sandboxEnforced === true &&
      receipt.inputValidation.stillAcceptance.sandboxEnforced === true &&
      JSON.stringify(receipt.inputValidation.mediaBuildWrapper) === JSON.stringify(mediaBuildValidation),
    'Render receipt does not bind sandboxed input validation',
  );
  assert(
    receipt.claimedAtReceipt.claimId === receipt.claimId &&
      /^[a-f0-9]{64}$/.test(receipt.claimedAtReceipt.sha256) &&
      receipt.claimedAtReceipt.storage === 'ephemeral-o_nofollow-exclusive-removed-after-system-attestation',
    'Render ephemeral claim attestation binding mismatch',
  );

  assert(pathLexists(outputPath), 'Controlled candidate MP4 is missing');
  assert(!lstatSync(outputPath).isSymbolicLink(), 'Controlled candidate MP4 is a symlink');
  assert(sha256(outputPath) === receipt.renderBinding.candidateMp4Sha256, 'Candidate MP4 SHA mismatch');
  const comparisonPath = resolveRepo(LOCKED.comparisonOutput, 'candidate comparison output');
  assert(pathLexists(comparisonPath), 'Controlled no-SFX comparison MP4 is missing');
  assert(!lstatSync(comparisonPath).isSymbolicLink(), 'Controlled no-SFX comparison MP4 is a symlink');
  assert(
    sha256(comparisonPath) === receipt.renderBinding.noSfxComparisonMp4Sha256,
    'No-SFX comparison MP4 SHA mismatch',
  );
  const expectedOutputs = [
    {role: 'no-sfx', ...fileIdentity(comparisonPath)},
    {role: 'with-sfx', ...fileIdentity(outputPath)},
  ];
  assert(JSON.stringify(receipt.outputs) === JSON.stringify(expectedOutputs), 'Render receipt output identities differ from live files');
  assert(
    Array.isArray(receipt.renderCommands) &&
      receipt.renderCommands.length === 2 &&
      receipt.renderCommands.every(
        (item) =>
          item.exitCode === 0 &&
          item.command?.[0] === SANDBOX_EXEC &&
          item.command.includes('--overwrite=false') &&
          item.command.includes(`--public-dir=${publicDir}`),
      ),
    'Render receipt commands are not the locked sandboxed non-overwrite commands',
  );
  return {ok: true};
};

const selftest = () => {
  const results = [];
  const rejects = (id, callback, pattern) => {
    let message = '';
    try {
      callback();
    } catch (error) {
      message = error.message;
    }
    assert(pattern.test(message), `${id} did not fail as expected: ${message}`);
    results.push({id, passed: true, rejectedWith: message});
  };
  const sandboxProfile = readFileSync(SANDBOX_PROFILE_PATH, 'utf8');
  assertLoopbackOnlySandboxProfile(sandboxProfile);
  results.push({id: 'fixture-only-loopback-sandbox-profile-shape', passed: true});
  rejects(
    'sandbox-external-deny-rule-removal-rejected',
    () =>
      assertLoopbackOnlySandboxProfile(
        sandboxProfile.replace('(deny network-outbound (require-not (remote ip "localhost:*")))', ''),
      ),
    /does not deny non-loopback outbound/,
  );

  rejects(
    'production-action-without-system-runtime-lock-rejected',
    () => validateProductionRuntimeGate(),
    /RUNTIME_LOCK_MISSING_OR_INVALID_BLOCKED/,
  );
  rejects(
    'unsigned-local-wrapper-receipt-write-rejected',
    () => writeReceiptExclusive('preflight', {}),
    /SYSTEM_RECEIPT_SIGNER_MISSING_BLOCKED/,
  );
  rejects(
    'repository-public-key-cannot-validate-system-attestation',
    () => {
      const forged = {
        schemaVersion: 'director-controlled-candidate-wrapper-receipt/v2',
        evidenceScope: 'real-e2e',
        status: 'candidate-render-action-completed',
        mode: 'render',
      };
      const payload = stableJson(forged);
      forged.systemExecutionAttestation = {
        schemaVersion: 'koubo-director-system-wrapper-attestation/v1',
        keyId: SYSTEM_ATTESTATION_KEY_ID,
        payloadSha256: sha256Text(payload),
        signatureBase64: Buffer.alloc(64).toString('base64'),
      };
      assertSystemSignedWrapperReceipt(forged);
    },
    /SYSTEM_TRUST_ROOT_NOT_WIRED_BLOCKED/,
  );
  const mediaBuildInvocation = candidateMediaBuildInvocation();
  assert(
    mediaBuildInvocation.command === SANDBOX_EXEC &&
      mediaBuildInvocation.args[0] === '-f' &&
      mediaBuildInvocation.args[1] === SANDBOX_PROFILE_PATH &&
      mediaBuildInvocation.args.at(-1) === 'build' &&
      mediaBuildInvocation.args.includes(MEDIA_VALIDATOR) &&
      !Object.keys(mediaBuildInvocation.env).some((key) => /token|api|key|secret|authorization/i.test(key)),
    'Candidate media build invocation is not the fixed sandboxed minimal-environment command',
  );
  results.push({id: 'fixture-only-candidate-media-build-command-shape', passed: true});
  const missingReceiptRoot = mkdtempSync(resolve(tmpdir(), 'candidate-wrapper-missing-receipt-'));
  try {
    rejects(
      'candidate-media-build-receipt-required-before-preview-actions',
      () =>
        assertControlledReceiptPresent(
          resolve(missingReceiptRoot, 'media-build.json'),
          'Controlled candidate media-build wrapper receipt is missing',
        ),
      /media-build wrapper receipt is missing/,
    );
    rejects(
      'controlled-stills-receipt-required-before-external-acceptance',
      () =>
        assertControlledReceiptPresent(
          resolve(missingReceiptRoot, 'stills.json'),
          'Controlled candidate stills wrapper receipt is missing',
        ),
      /stills wrapper receipt is missing/,
    );
  } finally {
    rmSync(missingReceiptRoot, {recursive: true, force: true});
  }

  const missingDirectDependency = {
    packages: DIRECT_RUNTIME_PACKAGES.slice(0, -1).map((item) => ({specifier: item.specifier})),
  };
  rejects(
    'direct-runtime-package-graph-missing-dependency-rejected',
    () => assertDirectRuntimePackageSet(missingDirectDependency),
    /package graph is missing/,
  );

  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  assertLockedContract(contract);
  results.push({id: 'fixture-only-locked-candidate-contract-shape', passed: true});
  const missingAcceptanceRoot = mkdtempSync(resolve(tmpdir(), 'candidate-wrapper-missing-acceptance-'));
  try {
    rejects(
      'video-render-before-still-acceptance-rejected',
      () =>
        assertControlledReceiptPresent(
          resolve(missingAcceptanceRoot, 'still-acceptance.json'),
          'Independent signed still acceptance receipt is missing',
        ),
      /Independent signed still acceptance receipt is missing/,
    );
  } finally {
    rmSync(missingAcceptanceRoot, {recursive: true, force: true});
  }
  const lockedStillArgs = renderArguments({
    contract,
    publicDir: resolveRepo(LOCKED.publicDir, 'selftest publicDir'),
    outputPath: resolve(tmpdir(), 'candidate-wrapper-overwrite-flag-selftest.png'),
    frame: 30,
    composition: LOCKED.stillComposition,
  });
  assert(lockedStillArgs.includes('--overwrite=false'), 'Remotion overwrite=false flag is missing');
  results.push({id: 'fixture-only-remotion-overwrite-false-argument-shape', passed: true});
  assert(lockedStillArgs.includes('--bundle-cache=false'), 'Remotion bundle-cache=false flag is missing');
  results.push({id: 'fixture-only-remotion-bundle-cache-disabled-argument-shape', passed: true});
  assert(
    lockedStillArgs.includes(`--browser-executable=${LOCKED_BROWSER_PATH}`),
    'Pinned local browser executable flag is missing',
  );
  results.push({id: 'fixture-only-remotion-browser-argument-shape', passed: true});
  const changed = structuredClone(contract);
  changed.candidateOnlyRender.output = `${PREVIEW_REL}/escaped.mp4`;
  rejects('contract-output-change-rejected', () => assertLockedContract(changed), /output differs/);

  const changedEntry = structuredClone(contract);
  changedEntry.candidateOnlyRender.entry = 'src/director-v2-e2e-wechat/other-entry.tsx';
  rejects('contract-entry-change-rejected', () => assertLockedContract(changedEntry), /entry differs/);

  const changedComposition = structuredClone(contract);
  changedComposition.candidateOnlyRender.composition = 'Unregistered-Candidate';
  rejects(
    'contract-composition-change-rejected',
    () => assertLockedContract(changedComposition),
    /composition differs/,
  );

  const changedPublicDir = structuredClone(contract);
  changedPublicDir.publicDir = `${PREVIEW_REL}/other-media`;
  rejects('contract-publicdir-change-rejected', () => assertLockedContract(changedPublicDir), /publicDir differs/);

  const changedSourceRange = structuredClone(contract);
  changedSourceRange.screenClips.storeMenu.sourceIn = 141.9;
  rejects(
    'contract-screen-source-range-tamper-rejected',
    () => assertLockedContract(changedSourceRange),
    /screen source ranges differ/,
  );
  const changedTalkingHeadRange = structuredClone(contract);
  changedTalkingHeadRange.talkingHeadClip.spokenSourceOut = 63.04;
  rejects(
    'contract-talking-head-source-range-tamper-rejected',
    () => assertLockedContract(changedTalkingHeadRange),
    /talking-head source range differs/,
  );
  const changedSemanticGate = structuredClone(contract);
  changedSemanticGate.semanticFrameGates.questionFlipFirstAllowedFrame = 1285;
  rejects(
    'contract-closing-frame-gate-tamper-rejected',
    () => assertLockedContract(changedSemanticGate),
    /semantic frame gates differ/,
  );

  rejects('absolute-output-path-rejected', () => resolveWithin(REPO_ROOT, '/tmp/x.mp4', 'test output'), /must be relative/);
  rejects('parent-escape-output-path-rejected', () => resolveWithin(REPO_ROOT, '../x.mp4', 'test output'), /escapes root/);

  const tempRoot = mkdtempSync(resolve(tmpdir(), 'director-v2-candidate-wrapper-test-'));
  try {
    const realDir = resolve(tempRoot, 'real');
    const linkDir = resolve(tempRoot, 'link');
    mkdirSync(realDir);
    const symlinkResult = execute('/bin/ln', ['-s', realDir, linkDir]);
    assert(symlinkResult.exitCode === 0, `Unable to create symlink fixture: ${symlinkResult.stderr}`);
    rejects('symlink-output-parent-rejected', () => assertNoSymlinkSegments(tempRoot, resolve(linkDir, 'x'), 'fixture'), /symlink/);

    const danglingTarget = resolve(tempRoot, 'missing-target');
    const danglingOutput = resolve(tempRoot, 'dangling-output.mp4');
    const danglingResult = execute('/bin/ln', ['-s', danglingTarget, danglingOutput]);
    assert(danglingResult.exitCode === 0, `Unable to create dangling symlink fixture: ${danglingResult.stderr}`);
    rejects(
      'dangling-output-symlink-rejected',
      () => assertPathDoesNotExist(danglingOutput, 'Dangling candidate output'),
      /already exists; overwrite is forbidden/,
    );
    rejects(
      'o_nofollow-exclusive-open-on-dangling-symlink-rejected',
      () => openExclusiveNoFollow(danglingOutput),
      /EEXIST|ELOOP|file already exists/i,
    );

    const existingOutput = resolve(realDir, 'existing-output.mp4');
    writeFileSync(existingOutput, 'existing');
    rejects(
      'existing-output-rejected',
      () => assertPathDoesNotExist(existingOutput, 'Candidate fixture output'),
      /already exists; overwrite is forbidden/,
    );

    const cliRoot = resolve(tempRoot, 'cli-fixture');
    const cliBin = resolve(cliRoot, '.bin');
    const cliPackageDir = resolve(cliRoot, '@remotion', 'cli');
    mkdirSync(cliPackageDir, {recursive: true});
    mkdirSync(cliBin);
    const cliTarget = resolve(cliPackageDir, 'remotion-cli.js');
    const cliReplacement = resolve(cliPackageDir, 'replacement.js');
    writeFileSync(cliTarget, 'locked-cli-target\n');
    writeFileSync(cliReplacement, 'replacement-cli-target\n');
    const cliLauncher = resolve(cliBin, 'remotion');
    symlinkSync('../@remotion/cli/remotion-cli.js', cliLauncher);
    const fixtureTargetSha = sha256(cliTarget);
    const cliTargetReal = realpathSync(cliTarget);
    validateCliLayout({
      launcherPath: cliLauncher,
      expectedTargetPath: cliTargetReal,
      expectedLinkTarget: '../@remotion/cli/remotion-cli.js',
      expectedTargetSha256: fixtureTargetSha,
    });
    results.push({id: 'fixture-only-cli-layout-shape', passed: true});
    unlinkSync(cliLauncher);
    symlinkSync('../@remotion/cli/replacement.js', cliLauncher);
    rejects(
      'cli-launcher-replacement-rejected',
      () => validateCliLayout({launcherPath: cliLauncher, expectedTargetPath: cliTargetReal, expectedLinkTarget: '../@remotion/cli/remotion-cli.js', expectedTargetSha256: fixtureTargetSha}),
      /symlink target differs/,
    );
    unlinkSync(cliLauncher);
    symlinkSync('../@remotion/cli/remotion-cli.js', cliLauncher);
    writeFileSync(cliTarget, 'mutated-cli-target\n');
    rejects(
      'cli-real-target-replacement-rejected',
      () => validateCliLayout({launcherPath: cliLauncher, expectedTargetPath: cliTargetReal, expectedLinkTarget: '../@remotion/cli/remotion-cli.js', expectedTargetSha256: fixtureTargetSha}),
      /real target SHA mismatch/,
    );

    const treeRoot = resolve(tempRoot, 'tree-fixture');
    mkdirSync(treeRoot);
    writeFileSync(resolve(treeRoot, 'a.js'), 'a\n');
    writeFileSync(resolve(treeRoot, 'b.js'), 'b\n');
    symlinkSync('a.js', resolve(treeRoot, 'cli-link'));
    const treeBefore = canonicalTreeManifest(treeRoot);
    unlinkSync(resolve(treeRoot, 'b.js'));
    const treeMissing = canonicalTreeManifest(treeRoot);
    rejects(
      'runtime-dependency-missing-rejected',
      () => assert(treeMissing.manifestSha256 === treeBefore.manifestSha256, 'Runtime dependency tree changed'),
      /dependency tree changed/,
    );
    writeFileSync(resolve(treeRoot, 'b.js'), 'b\n');
    writeFileSync(resolve(treeRoot, 'a.js'), 'replaced\n');
    const treeReplaced = canonicalTreeManifest(treeRoot);
    rejects(
      'runtime-dependency-content-replacement-rejected',
      () => assert(treeReplaced.manifestSha256 === treeBefore.manifestSha256, 'Runtime dependency tree changed'),
      /dependency tree changed/,
    );

    const validatorSource = runValidator.toString();
    assert(
      validatorSource.includes('SANDBOX_EXEC') &&
        validatorSource.includes('SANDBOX_PROFILE_PATH') &&
        validatorSource.includes("'validate'") &&
        validatorSource.includes("'--receipt'"),
      'Validator command construction is not structurally sandbox-bound',
    );
    results.push({id: 'fixture-only-validator-command-sandbox-shape', passed: true});

    const closureFixture = resolve(realDir, 'closure.txt');
    writeFileSync(closureFixture, 'before');
    const closureBefore = fileIdentity(closureFixture);
    writeFileSync(closureFixture, 'after');
    rejects(
      'spawn-preflight-to-spawn-content-change-rejected',
      () => assert(JSON.stringify(fileIdentity(closureFixture)) === JSON.stringify(closureBefore), 'Candidate render closure changed after validation'),
      /closure changed after validation/,
    );

    const exclusiveReceipt = resolve(realDir, 'exclusive-receipt.json');
    writeFileSync(exclusiveReceipt, '{}', {flag: 'wx'});
    rejects(
      'existing-receipt-overwrite-rejected',
      () => writeFileSync(exclusiveReceipt, '{}', {flag: 'wx'}),
      /EEXIST|file already exists/i,
    );

    const directOutput = resolve(tempRoot, 'direct.mp4');
    writeFileSync(directOutput, 'not-a-controlled-render');
    rejects(
      'direct-output-without-wrapper-receipt-rejected',
      () => validateControlledRenderReceipt({receiptPath: resolve(tempRoot, 'missing.json'), outputPath: directOutput}),
      /receipt is missing/,
    );
    const forgedReceiptPath = resolve(tempRoot, 'forged.json');
    writeFileSync(forgedReceiptPath, `${JSON.stringify({schemaVersion: 'director-controlled-candidate-wrapper-receipt/v2'})}\n`);
    rejects(
      'forged-wrapper-receipt-rejected',
      () => validateControlledRenderReceipt({receiptPath: forgedReceiptPath, outputPath: directOutput}),
      /evidence scope mismatch/,
    );
    const selfAuthoredEnvelopePath = resolve(tempRoot, 'self-authored-envelope.json');
    writeFileSync(
      selfAuthoredEnvelopePath,
      `${JSON.stringify({
        schemaVersion: 'director-controlled-candidate-wrapper-receipt/v2',
        evidenceScope: 'real-e2e',
        status: 'candidate-render-action-completed',
        mode: 'render',
        formal: false,
        productionEligible: false,
        networkPolicy: 'external-process-boundary-denied-loopback-only-end-to-end-unproven',
        loopbackUsed: true,
        externalNetworkDeniedAtProcessBoundary: true,
        endToEndExternalNetworkDenied: false,
        loopbackRelayRisk: 'blocked-unmeasured',
        paidGenerationUsed: false,
        sandbox: {
          enforcedNetworkDeny: true,
          loopbackAllowed: true,
          externalNetworkDeniedAtProcessBoundary: true,
          endToEndExternalNetworkDenied: false,
          loopbackRelayRisk: 'blocked-unmeasured',
        },
        wrapperEntrypoint: {},
      })}\n`,
    );
    rejects(
      'self-authored-envelope-without-external-trust-rejected',
      () =>
        validateControlledRenderReceipt({
          receiptPath: selfAuthoredEnvelopePath,
          outputPath: directOutput,
        }),
      /SYSTEM_TRUST_ROOT_NOT_WIRED_BLOCKED/,
    );
  } finally {
    rmSync(tempRoot, {recursive: true, force: true});
  }
  for (const mode of LIVE_MODES) {
    const blocked = spawnSync(process.execPath, [THIS_FILE, mode], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    assert(blocked.status !== 0, `Repository live mode ${mode} unexpectedly succeeded`);
    assert(
      blocked.stderr.includes(LIVE_REPOSITORY_BLOCK_CODE),
      `Repository live mode ${mode} did not return the stable delegation block code`,
    );
    results.push({id: `repository-live-${mode}-before-io-blocked`, passed: true});
  }
  return {ok: true, count: results.length, tests: results};
};

const parseMode = () => {
  const args = process.argv.slice(2);
  assert(args.length === 1, 'Candidate wrapper accepts exactly one mode: selftest, build-media, preflight, stills, render, validate-media-build-receipt, validate-stills-receipt, or validate-render-receipt');
  const mode = args[0];
  assert(
    ['selftest', ...LIVE_MODES].includes(mode),
    `Unsupported candidate wrapper mode: ${mode}`,
  );
  return mode;
};

let activeClaim = null;
let activeStagingDirectory = null;

try {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 1 && rawArgs[0] === 'selftest') {
    process.stdout.write(`${JSON.stringify(selftest(), null, 2)}\n`);
    process.exit(0);
  }

  fail(
    `${LIVE_REPOSITORY_BLOCK_CODE}: all live candidate actions require an independently installed immutable launcher and external attestor; repository code cannot authorize itself`,
  );

  const mode = parseMode();

  // Every live subcommand, including receipt validation, is blocked before it
  // can probe media or write artifacts unless the fixed system dry-run verifier,
  // root-owned signed runtime lock, external snapshot delegation, and receipt
  // attestor are all present. This repository cannot supply or override them.
  const runtimeGate = validateProductionRuntimeGate();
  assert(runtimeGate.actionAllowed === true, 'RUNTIME_SNAPSHOT_DELEGATION_BLOCKED');

  if (mode === 'validate-render-receipt') {
    const outputPath = resolveRepo(LOCKED.output, 'candidate output');
    process.stdout.write(
      `${JSON.stringify(validateControlledRenderReceipt({receiptPath: RECEIPT_PATHS.render, outputPath}))}\n`,
    );
    process.exit(0);
  }
  if (mode === 'validate-media-build-receipt') {
    process.stdout.write(`${JSON.stringify(validateControlledMediaBuildReceipt())}\n`);
    process.exit(0);
  }
  if (mode === 'validate-stills-receipt') {
    process.stdout.write(`${JSON.stringify(validateControlledStillsReceipt())}\n`);
    process.exit(0);
  }

  const startedAt = nowIso();

  // Only an independently attested external-snapshot process may reach here.
  const networkPolicy = networkDenyProbe();
  controlledToolBindings();
  // Validators and the optional media build execute inside the same loopback-only sandbox and fixed minimal PATH.
  const proxyValidation = runValidator(PROXY_VALIDATOR, PROXY_RECEIPT);
  if (mode === 'build-media') {
    assertPathDoesNotExist(MEDIA_RECEIPT, 'Candidate media receipt');
    assertPathDoesNotExist(MEDIA_EVIDENCE_DIRECTORY, 'Candidate media evidence directory');
    receiptPathFor(mode);
    const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
    assertLockedContract(contract);
    const paidPolicy = assertCandidateOnlyCode();
    activeClaim = claimAction(mode);
    const claim = activeClaim;
    const buildResult = sandboxedCandidateMediaBuild();
    assert(buildResult.exitCode === 0, `Controlled candidate media build failed: ${buildResult.stderr}`);
    const mediaValidation = runValidator(MEDIA_VALIDATOR, MEDIA_RECEIPT);
    const publicDir = resolveRepo(LOCKED.publicDir, 'candidate media publicDir');
    const mediaReceipt = JSON.parse(readFileSync(MEDIA_RECEIPT, 'utf8'));
    const closure = captureClosure({contract, mediaReceipt, publicDir});
    const completedAt = nowIso();
    const outputs = [
      {role: 'candidate-media-receipt', identity: fileIdentity(MEDIA_RECEIPT)},
      {role: 'candidate-media-evidence-tree', manifest: canonicalTreeManifest(MEDIA_EVIDENCE_DIRECTORY)},
    ];
    const receipt = buildReceipt({
      mode,
      claim,
      startedAt,
      completedAt,
      proxyValidation,
      mediaValidation,
      stillAcceptanceValidation: null,
      closure,
      networkPolicy,
      paidPolicy,
      outputs,
      renderCommands: [{
        role: 'candidate-media-build',
        command: buildResult.commandForReceipt,
        exitCode: buildResult.exitCode,
        stderrSha256: sha256Text(buildResult.stderr),
      }],
    });
    const receiptArtifact = writeReceiptExclusive(mode, receipt);
    cleanupEphemeralClaim(activeClaim);
    activeClaim = null;
    process.stdout.write(`${JSON.stringify({ok: true, mode, receiptPath: receiptArtifact.path, receiptSha256: receiptArtifact.sha256})}\n`);
    process.exit(0);
  }
  const mediaBuildValidation = validateControlledMediaBuildReceipt();
  const mediaValidation = runValidator(MEDIA_VALIDATOR, MEDIA_RECEIPT);
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  assertLockedContract(contract);
  const stillAcceptanceValidation = mode === 'render' ? assertVideoRenderAuthorized(contract) : null;
  const paidPolicy = assertCandidateOnlyCode();
  const publicDir = resolveRepo(LOCKED.publicDir, 'candidate publicDir');
  const mediaReceipt = JSON.parse(readFileSync(MEDIA_RECEIPT, 'utf8'));
  const closure = captureClosure({contract, mediaReceipt, publicDir});

  const outputPath = resolveRepo(LOCKED.output, 'candidate output');
  const comparisonOutputPath = resolveRepo(LOCKED.comparisonOutput, 'candidate comparison output');
  const stillDirectory = resolveRepo(LOCKED.stillDirectory, 'candidate stillDirectory');
  const outputDirectory = resolveRepo(LOCKED.outputDirectory, 'candidate outputDirectory');
  assertPathDoesNotExist(outputPath, 'Candidate MP4');
  assertPathDoesNotExist(comparisonOutputPath, 'Candidate comparison MP4');
  if (mode === 'preflight' || mode === 'stills') {
    assertPathDoesNotExist(outputDirectory, 'Candidate render output directory');
  }
  if (mode === 'preflight' || mode === 'stills') {
    assertPathDoesNotExist(stillDirectory, 'Candidate still directory');
  }

  // Resolve and reject an existing immutable receipt before claiming or spawning anything.
  receiptPathFor(mode);
  activeClaim = claimAction(mode);
  const claim = activeClaim;
  const outputs = [];
  const renderCommands = [];

  if (mode === 'stills') {
    const claimedDirectory = createExclusiveOutputDirectory(mode, contract);
    activeStagingDirectory = claimedDirectory.target;
    for (const frame of contract.candidateOnlyRender.stillFrames) {
      const frameOutput = resolve(claimedDirectory.target, `frame-${String(frame).padStart(4, '0')}.png`);
      assertNoSymlinkSegments(REPO_ROOT, frameOutput, 'candidate still output');
      assertPathDoesNotExist(frameOutput, `Candidate still ${frame}`);
      const liveContract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
      assertSameClosure(closure, liveContract, mediaReceipt, publicDir);
      assertOutputDirectoryUnchanged(claimedDirectory);
      assertPathDoesNotExist(frameOutput, `Candidate still ${frame} immediately before spawn`);
      const args = renderArguments({
        contract: liveContract,
        publicDir,
        outputPath: frameOutput,
        frame,
        composition: LOCKED.stillComposition,
      });
      const result = sandboxedRemotion(args);
      assert(result.exitCode === 0, `Candidate still frame ${frame} failed: ${result.stderr}`);
      assertSameClosure(closure, JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')), mediaReceipt, publicDir);
      assertOutputDirectoryUnchanged(claimedDirectory);
      renderCommands.push({command: result.commandForReceipt, exitCode: result.exitCode, stderrSha256: sha256Text(result.stderr)});
    }
    const finalStillDirectory = finalizeExclusiveOutputDirectory(claimedDirectory);
    activeStagingDirectory = null;
    for (const frame of contract.candidateOnlyRender.stillFrames) {
      const finalFrameOutput = resolve(finalStillDirectory, `frame-${String(frame).padStart(4, '0')}.png`);
      outputs.push({role: 'still', frame, ...fileIdentity(finalFrameOutput)});
    }
  } else if (mode === 'render') {
    const claimedDirectory = createExclusiveOutputDirectory(mode, contract);
    activeStagingDirectory = claimedDirectory.target;
    const stagedOutputPath = resolve(claimedDirectory.target, basename(LOCKED.output));
    const stagedComparisonOutputPath = resolve(claimedDirectory.target, basename(LOCKED.comparisonOutput));
    assertPathDoesNotExist(outputPath, 'Candidate MP4 before render spawn');
    const liveContract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
    assertSameClosure(closure, liveContract, mediaReceipt, publicDir);
    assertOutputDirectoryUnchanged(claimedDirectory);
    for (const renderTarget of [
      {role: 'no-sfx', composition: LOCKED.comparisonComposition, path: stagedComparisonOutputPath},
      {role: 'with-sfx', composition: LOCKED.composition, path: stagedOutputPath},
    ]) {
      assertPathDoesNotExist(renderTarget.path, `${renderTarget.role} output before render spawn`);
      const currentContract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
      assertSameClosure(closure, currentContract, mediaReceipt, publicDir);
      assertOutputDirectoryUnchanged(claimedDirectory);
      assertPathDoesNotExist(renderTarget.path, `${renderTarget.role} output immediately before spawn`);
      const args = renderArguments({
        contract: currentContract,
        publicDir,
        outputPath: renderTarget.path,
        composition: renderTarget.composition,
      });
      const result = sandboxedRemotion(args);
      assert(result.exitCode === 0, `Candidate ${renderTarget.role} video render failed: ${result.stderr}`);
      assertSameClosure(closure, JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')), mediaReceipt, publicDir);
      assertOutputDirectoryUnchanged(claimedDirectory);
      renderCommands.push({
        role: renderTarget.role,
        command: result.commandForReceipt,
        exitCode: result.exitCode,
        stderrSha256: sha256Text(result.stderr),
      });
    }
    const finalOutputDirectory = finalizeExclusiveOutputDirectory(claimedDirectory);
    activeStagingDirectory = null;
    assert(finalOutputDirectory === outputDirectory, 'Atomic render placement target differs from locked output directory');
    outputs.push(
      {role: 'no-sfx', ...fileIdentity(comparisonOutputPath)},
      {role: 'with-sfx', ...fileIdentity(outputPath)},
    );
  }

  const completedAt = nowIso();
  const receipt = buildReceipt({
    mode,
    claim,
    startedAt,
    completedAt,
    proxyValidation,
    mediaValidation,
    stillAcceptanceValidation,
    closure,
    networkPolicy,
    paidPolicy,
    outputs,
    renderCommands,
  });
  receipt.inputValidation.mediaBuildWrapper = mediaBuildValidation;
  const receiptArtifact = writeReceiptExclusive(mode, receipt);
  cleanupEphemeralClaim(activeClaim);
  activeClaim = null;
  process.stdout.write(
    `${JSON.stringify({ok: true, mode, receiptPath: receiptArtifact.path, receiptSha256: receiptArtifact.sha256, outputs})}\n`,
  );
} catch (error) {
  if (activeStagingDirectory && pathLexists(activeStagingDirectory)) {
    rmSync(activeStagingDirectory, {recursive: true, force: true});
  }
  cleanupEphemeralClaim(activeClaim);
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
