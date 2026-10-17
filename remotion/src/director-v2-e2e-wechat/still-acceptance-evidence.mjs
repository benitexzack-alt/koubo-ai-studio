#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

let buildDirectorExternalAnchorBindingPayloadV2;
let serializeDirectorExternalAnchorEntryForSignatureV2;
let stableJsonSha256;
let validateDirectorExternalMessageAnchorV2;
let verifyDirectorExternalAnchorEntryV2;

const THIS_FILE = fileURLToPath(import.meta.url);
const DIRECT_CLI_BLOCK_CODE = 'CANDIDATE_STILL_ACCEPTANCE_DIRECT_CLI_BLOCKED';
const THIS_DIR = dirname(THIS_FILE);
const REPO_ROOT = resolve(THIS_DIR, '../../..');
const PREVIEW_REL = 'work/director-v2-e2e/20260823-wechat-geo-aao-candidate-01/preview';
const PREVIEW_DIR = resolve(REPO_ROOT, PREVIEW_REL);
const CONTRACT_PATH = resolve(THIS_DIR, 'candidate-media-contract.json');
const VISUAL_CONTRACT_PATH = resolve(THIS_DIR, 'visual-semantic-contract.json');
const WRAPPER_PATH = resolve(THIS_DIR, 'render-candidate.mjs');
const RECEIPT_PATH = resolve(PREVIEW_DIR, 'still-acceptance-receipt.v1.json');
const STILL_WRAPPER_RECEIPT_PATH = resolve(PREVIEW_DIR, 'candidate-wrapper-stills-receipt.v2.json');
const CURRENT_EXECUTION_TASK = '/root/real_e2e_dynamic_preview';
const EXTERNAL_ANCHOR_KIND = 'candidate-still-acceptance';
const DEFAULT_PROOF_CROP = '1030x345+678+305';
const DEFAULT_PROOF_RESIZE = '2060x690';
const MAGICK = '/opt/homebrew/bin/magick';
const TESSERACT = '/opt/homebrew/bin/tesseract';
const EXPECTED_FRAMES = [30, 318, 319, 666, 667, 674, 690, 810, 940, 1020, 1140, 1285, 1286, 1340];
const EXPECTED_PROOF_CHECKS = [
  [30, 'query', '1000x600+100+180', '2000x1200', 2, ['四人', '不辣', '减肥']],
  [690, 'answerRecommendations', DEFAULT_PROOF_CROP, DEFAULT_PROOF_RESIZE, 1, ['地图问答']],
  [810, 'mapApp', DEFAULT_PROOF_CROP, DEFAULT_PROOF_RESIZE, 2, ['牧之初心', '原切牛排']],
  [1020, 'storeMenu', DEFAULT_PROOF_CROP, DEFAULT_PROOF_RESIZE, 2, ['牧之初心', '牛排', '129']],
];
const EXPECTED_CONTINUITY = [[318, 319], [666, 667], [1285, 1286]];
const EXPECTED_MANUAL_FRAME_CHECKS = [
  [940, 'frame-940-jump-strip-readable-and-does-not-occlude-ocr-evidence'],
];
const EXPECTED_MANUAL_CHECKS = [
  'privacy-loading-not-shown-as-answer',
  'internal-qa-text-absent',
  'subtitle-does-not-occlude-evidence',
  'third-party-status-disclaimer-readable',
  'third-party-status-strip-outside-card-and-readable',
  'frame-940-jump-strip-readable-and-does-not-occlude-ocr-evidence',
  'boundary-geometry-reviewed',
  'frame-30-output-ocr-reviewed',
];

const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const sha256Text = (value) => createHash('sha256').update(value).digest('hex');
const normalizeOcr = (value) => value.replace(/[\s\p{P}\p{S}]/gu, '');

const pathLexists = (path) => {
  try { lstatSync(path); return true; }
  catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
};

const resolveWithinRepo = (value, label) => {
  assert(typeof value === 'string' && value.length > 0 && !isAbsolute(value), `${label} must be repo-relative`);
  const target = resolve(REPO_ROOT, value);
  const rel = relative(REPO_ROOT, target);
  assert(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `${label} escapes repository`);
  let current = REPO_ROOT;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    if (pathLexists(current)) assert(!lstatSync(current).isSymbolicLink(), `${label} traverses symlink`);
  }
  return target;
};

const fileIdentity = (path) => {
  assert(pathLexists(path) && !lstatSync(path).isSymbolicLink(), `Required ordinary file is missing: ${path}`);
  const stats = statSync(path);
  assert(stats.isFile(), `Required path is not a regular file: ${path}`);
  return {path: relative(REPO_ROOT, path), sha256: sha256(path), bytes: stats.size};
};

const exactFrames = (items) => items.map((item) => item.frame);

// `fixtureOnly` is intentionally private to this module's self-test.  The CLI
// never accepts it: production validation always re-reads the fixed live files
// and the system-owned trust registry.
const validateShape = ({receipt, contract, stillWrapperReceipt, fixtureOnly = false}) => {
  assert(receipt.schemaVersion === contract.candidateOnlyRender.stillAcceptancePolicy.receiptSchema, 'Still acceptance schema mismatch');
  assert(
    receipt.evidenceScope === (fixtureOnly ? 'fixture-only' : 'real-e2e'),
    'Still acceptance evidence scope mismatch',
  );
  assert(receipt.status === 'accepted' && receipt.decision === 'accepted', 'Still acceptance decision is not accepted');
  assert(Number.isFinite(Date.parse(receipt.reviewedAt)), 'Still acceptance reviewedAt is invalid');
  assert(receipt.candidateId === '20260823-wechat-geo-aao-candidate-02', 'Still acceptance candidate ID mismatch');
  assert(typeof receipt.sourceThreadId === 'string' && receipt.sourceThreadId.length > 0, 'Still acceptance source thread missing');
  assert(typeof receipt.sourceMessageId === 'string' && receipt.sourceMessageId.length > 0, 'Still acceptance source message missing');
  assert(/^[a-f0-9]{64}$/.test(receipt.sourceMessageSha256), 'Still acceptance source message SHA invalid');
  assert(typeof receipt.issuerGroupId === 'string' && receipt.issuerGroupId.length > 0, 'Still acceptance issuer group missing');
  assert(receipt.issuerGroupId !== 'candidate-execution-group', 'Candidate execution group cannot self-sign still acceptance');
  assert(receipt.reviewer?.executionTaskPath !== CURRENT_EXECUTION_TASK, 'Candidate execution task cannot self-review stills');
  assert(['user', 'independent-supervisor'].includes(receipt.reviewer?.role), 'Still reviewer role is not external');
  assert(typeof receipt.explicitAcceptanceQuote === 'string' && receipt.explicitAcceptanceQuote.length > 0, 'Explicit still acceptance quote missing');

  assert(stillWrapperReceipt.schemaVersion === 'director-controlled-candidate-wrapper-receipt/v2', 'Still wrapper schema mismatch');
  assert(stillWrapperReceipt.status === 'candidate-stills-action-completed' && stillWrapperReceipt.mode === 'stills', 'Still wrapper receipt is not a completed still action');
  assert(stillWrapperReceipt.formal === false && stillWrapperReceipt.productionEligible === false, 'Still wrapper enables formal/production');
  assert(
    stillWrapperReceipt.networkPolicy === 'external-process-boundary-denied-loopback-only-end-to-end-unproven',
    'Still wrapper network policy mismatch',
  );
  assert(
    stillWrapperReceipt.externalNetworkDeniedAtProcessBoundary === true &&
      stillWrapperReceipt.endToEndExternalNetworkDenied === false &&
      stillWrapperReceipt.loopbackRelayRisk === 'blocked-unmeasured' &&
      stillWrapperReceipt.loopbackUsed === true,
    'Still wrapper network evidence mismatch',
  );

  assert(JSON.stringify(exactFrames(receipt.stills)) === JSON.stringify(EXPECTED_FRAMES), 'Still acceptance frames are missing, extra, duplicated, or reordered');
  assert(JSON.stringify(exactFrames(stillWrapperReceipt.outputs)) === JSON.stringify(EXPECTED_FRAMES), 'Still wrapper frames are missing, extra, duplicated, or reordered');
  assert(new Set(exactFrames(receipt.stills)).size === EXPECTED_FRAMES.length, 'Still acceptance frames are duplicated');
  assert(receipt.stills.length === stillWrapperReceipt.outputs.length, 'Still acceptance/wrapper frame counts differ');
  for (let index = 0; index < receipt.stills.length; index += 1) {
    const accepted = receipt.stills[index];
    const rendered = stillWrapperReceipt.outputs[index];
    assert(
      accepted.frame === rendered.frame && accepted.path === rendered.path &&
        accepted.sha256 === rendered.sha256 && accepted.bytes === rendered.bytes,
      `Still ${accepted.frame} does not exactly bind the controlled wrapper output`,
    );
    if (!fixtureOnly) {
      const livePath = resolveWithinRepo(accepted.path, `still ${accepted.frame}`);
      const live = fileIdentity(livePath);
      assert(live.sha256 === accepted.sha256 && live.bytes === accepted.bytes, `Still ${accepted.frame} live file mismatch`);
    }
  }

  assert(receipt.stillWrapperReceipt.path === relative(REPO_ROOT, STILL_WRAPPER_RECEIPT_PATH), 'Still acceptance wrapper receipt path mismatch');
  assert(/^[a-f0-9]{64}$/.test(receipt.stillWrapperReceipt.sha256), 'Still acceptance wrapper receipt SHA invalid');
  if (!fixtureOnly) {
    assert(
      receipt.stillWrapperReceipt.sha256 === sha256(STILL_WRAPPER_RECEIPT_PATH),
      'Still acceptance does not bind the controlled still wrapper receipt',
    );
  }
  assert(
    receipt.mediaContract.path === relative(REPO_ROOT, CONTRACT_PATH) && receipt.mediaContract.sha256 === sha256(CONTRACT_PATH),
    'Still acceptance media contract binding mismatch',
  );
  assert(
    receipt.visualSemanticContract.path === relative(REPO_ROOT, VISUAL_CONTRACT_PATH) &&
      receipt.visualSemanticContract.sha256 === sha256(VISUAL_CONTRACT_PATH),
    'Still acceptance visual contract binding mismatch',
  );
  assert(
    receipt.wrapperEntrypoint.path === relative(REPO_ROOT, WRAPPER_PATH) && receipt.wrapperEntrypoint.sha256 === sha256(WRAPPER_PATH),
    'Still acceptance wrapper binding mismatch',
  );
  assert(receipt.runtimeCodeManifestSha256 === stillWrapperReceipt.runtimeCodeManifest.manifestSha256, 'Still acceptance runtime manifest mismatch');
  assert(receipt.publicDirManifestSha256 === stillWrapperReceipt.publicDirManifest.manifestSha256, 'Still acceptance publicDir manifest mismatch');

  assert(
    JSON.stringify(receipt.proofWindowOcr.map((item) => [item.frame, item.clipId, item.cropGeometry, item.resize, item.mustContainAtLeast, item.anchors])) ===
      JSON.stringify(EXPECTED_PROOF_CHECKS),
    'Still proof-window OCR checklist mismatch',
  );
  for (const item of receipt.proofWindowOcr) {
    const still = receipt.stills.find((candidate) => candidate.frame === item.frame);
    assert(still && item.fullFrameSha256 === still.sha256, `OCR evidence frame ${item.frame} is not bound to its still`);
    assert(item.decision === 'accepted', `OCR evidence frame ${item.frame} is not accepted`);
    assert(item.matchedAnchors.length >= item.mustContainAtLeast, `OCR evidence frame ${item.frame} lacks anchors`);
    assert(item.matchedAnchors.every((anchor) => item.anchors.includes(anchor)), `OCR evidence frame ${item.frame} contains unregistered anchors`);
    if (!fixtureOnly) {
      const stillPath = resolveWithinRepo(still.path, `OCR still ${item.frame}`);
      const cropPath = resolveWithinRepo(item.cropPath, `OCR crop ${item.frame}`);
      assert(fileIdentity(cropPath).sha256 === item.cropSha256, `OCR crop ${item.frame} SHA mismatch`);
      const tempDir = mkdtempSync(resolve(tmpdir(), 'candidate-still-ocr-'));
      try {
        const liveCrop = resolve(tempDir, `frame-${item.frame}.png`);
        const crop = spawnSync(MAGICK, [realpathSync(stillPath), '-crop', item.cropGeometry, '+repage', '-resize', item.resize, liveCrop], {encoding: 'utf8'});
        assert(crop.status === 0, `Live output crop failed for frame ${item.frame}: ${crop.stderr}`);
        assert(sha256(liveCrop) === item.cropSha256, `OCR crop ${item.frame} is not reproducible from the final still`);
        const ocr = spawnSync(TESSERACT, [realpathSync(liveCrop), 'stdout', '-l', 'chi_sim+eng', '--psm', '6'], {encoding: 'utf8'});
        assert(ocr.status === 0, `Live OCR failed for frame ${item.frame}: ${ocr.stderr}`);
        const normalized = normalizeOcr(ocr.stdout);
        const matched = item.anchors.filter((anchor) => normalized.includes(anchor));
        assert(matched.length >= item.mustContainAtLeast, `Live output OCR failed for frame ${item.frame}`);
      } finally { rmSync(tempDir, {recursive: true, force: true}); }
    }
  }

  assert(
    JSON.stringify(receipt.continuityReviews.map((item) => [item.fromFrame, item.toFrame])) === JSON.stringify(EXPECTED_CONTINUITY),
    'Still continuity review pairs mismatch',
  );
  assert(receipt.continuityReviews.every((item) => item.decision === 'accepted' && item.note?.trim()), 'A still continuity review is not accepted with evidence');
  assert(receipt.manualReview?.decision === 'accepted', 'Full-frame manual still review is not accepted');
  assert(JSON.stringify(receipt.manualReview.framesReviewed) === JSON.stringify(EXPECTED_FRAMES), 'Manual review does not cover all 14 stills');
  assert(receipt.manualReview.reviewMode === 'normal-size-complete-frame', 'Manual still review mode mismatch');
  assert(
    JSON.stringify(receipt.manualReview.frameChecks.map((item) => [item.frame, item.checkId])) ===
      JSON.stringify(EXPECTED_MANUAL_FRAME_CHECKS) &&
      receipt.manualReview.frameChecks.every((item) => item.decision === 'accepted' && item.note?.trim()),
    'Manual frame-specific checks are missing, extra, reordered, or not accepted',
  );
  assert(
    JSON.stringify(receipt.manualReview.requiredChecks) === JSON.stringify(EXPECTED_MANUAL_CHECKS) &&
      receipt.manualReview.checks.every((item) => item.decision === 'accepted' && EXPECTED_MANUAL_CHECKS.includes(item.id)) &&
      JSON.stringify(receipt.manualReview.checks.map((item) => item.id)) === JSON.stringify(EXPECTED_MANUAL_CHECKS),
    'Manual still review checks are missing, extra, reordered, or not accepted',
  );
  return {ok: true};
};

const validate = (receiptPath) => {
  assert(receiptPath === RECEIPT_PATH, 'Only the fixed still acceptance receipt path is allowed');
  const wrapperValidation = spawnSync(process.execPath, [WRAPPER_PATH, 'validate-stills-receipt'], {
    encoding: 'utf8',
    env: {PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C'},
  });
  assert(
    wrapperValidation.status === 0,
    `CONTROLLED_STILLS_WRAPPER_VALIDATION_BLOCKED: ${wrapperValidation.stderr.trim()}`,
  );
  assert(pathLexists(RECEIPT_PATH), 'Independent signed still acceptance receipt is missing');
  assert(!lstatSync(RECEIPT_PATH).isSymbolicLink(), 'Still acceptance receipt is a symlink');
  assert(pathLexists(STILL_WRAPPER_RECEIPT_PATH), 'Controlled still wrapper receipt is missing');
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  assert(contract.candidateOnlyRender.stillAcceptancePolicy.receiptPath === relative(REPO_ROOT, RECEIPT_PATH), 'Contract still acceptance path mismatch');
  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
  const stillWrapperReceipt = JSON.parse(readFileSync(STILL_WRAPPER_RECEIPT_PATH, 'utf8'));
  validateShape({receipt, contract, stillWrapperReceipt});
  const anchor = validateDirectorExternalMessageAnchorV2(receipt, EXTERNAL_ANCHOR_KIND);
  assert(anchor.ok === true, `Independent signed still acceptance anchor rejected: ${anchor.reason}`);
  return {ok: true, receiptPath, receiptSha256: sha256(receiptPath), externalAnchorKind: EXTERNAL_ANCHOR_KIND};
};

const buildSynthetic = () => {
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  const outputs = EXPECTED_FRAMES.map((frame) => ({
    role: 'still', frame, path: `${PREVIEW_REL}/stills-candidate-02/frame-${String(frame).padStart(4, '0')}.png`, sha256: sha256Text(`still-${frame}`), bytes: 1000 + frame,
  }));
  const stillWrapperReceipt = {
    schemaVersion: 'director-controlled-candidate-wrapper-receipt/v2', status: 'candidate-stills-action-completed', mode: 'stills', formal: false, productionEligible: false,
    networkPolicy: 'external-process-boundary-denied-loopback-only-end-to-end-unproven',
    externalNetworkDeniedAtProcessBoundary: true,
    endToEndExternalNetworkDenied: false,
    loopbackRelayRisk: 'blocked-unmeasured',
    loopbackUsed: true,
    outputs,
    runtimeCodeManifest: {manifestSha256: sha256Text('runtime')}, publicDirManifest: {manifestSha256: sha256Text('public')},
  };
  const receipt = {
    schemaVersion: contract.candidateOnlyRender.stillAcceptancePolicy.receiptSchema,
    evidenceScope: 'fixture-only', status: 'accepted', decision: 'accepted', candidateId: '20260823-wechat-geo-aao-candidate-02',
    reviewedAt: '2026-08-24T00:00:00.000Z', sourceThreadId: '01external', sourceMessageId: 'msg-external', sourceMessageSha256: sha256Text('message'),
    issuerGroupId: 'independent-supervision', explicitAcceptanceQuote: '已完整查看十四张静帧并接受本轮静帧视觉方案。',
    reviewer: {role: 'independent-supervisor', executionTaskPath: '/root/independent-supervision'},
    stillWrapperReceipt: {
      path: relative(REPO_ROOT, STILL_WRAPPER_RECEIPT_PATH),
      sha256: sha256Text('fixture-only-still-wrapper'),
    },
    mediaContract: {path: relative(REPO_ROOT, CONTRACT_PATH), sha256: sha256(CONTRACT_PATH)},
    visualSemanticContract: {path: relative(REPO_ROOT, VISUAL_CONTRACT_PATH), sha256: sha256(VISUAL_CONTRACT_PATH)},
    wrapperEntrypoint: {path: relative(REPO_ROOT, WRAPPER_PATH), sha256: sha256(WRAPPER_PATH)},
    runtimeCodeManifestSha256: stillWrapperReceipt.runtimeCodeManifest.manifestSha256,
    publicDirManifestSha256: stillWrapperReceipt.publicDirManifest.manifestSha256,
    stills: outputs.map(({frame, path, sha256: fileSha, bytes}) => ({frame, path, sha256: fileSha, bytes})),
    proofWindowOcr: EXPECTED_PROOF_CHECKS.map(([frame, clipId, cropGeometry, resize, mustContainAtLeast, anchors]) => ({
      frame, clipId, mustContainAtLeast, anchors, matchedAnchors: anchors.slice(0, mustContainAtLeast), fullFrameSha256: outputs.find((item) => item.frame === frame).sha256,
      cropGeometry, resize, cropPath: `${PREVIEW_REL}/still-acceptance-evidence/frame-${frame}-proof.png`, cropSha256: sha256Text(`crop-${frame}`), decision: 'accepted',
    })),
    continuityReviews: EXPECTED_CONTINUITY.map(([fromFrame, toFrame]) => ({fromFrame, toFrame, decision: 'accepted', note: '前后语义物件连续'})),
    manualReview: {
      decision: 'accepted',
      framesReviewed: EXPECTED_FRAMES,
      reviewMode: 'normal-size-complete-frame',
      frameChecks: EXPECTED_MANUAL_FRAME_CHECKS.map(([frame, checkId]) => ({
        frame,
        checkId,
        decision: 'accepted',
        note: 'fixture-only full-frame jump-strip visibility shape',
      })),
      requiredChecks: EXPECTED_MANUAL_CHECKS,
      checks: EXPECTED_MANUAL_CHECKS.map((id) => ({id, decision: 'accepted', note: 'fixture-only structural acceptance shape'})),
    },
  };
  return {contract, stillWrapperReceipt, receipt};
};

const selftest = () => {
  const results = [];
  const rejects = (id, callback, pattern) => {
    let message = ''; try { callback(); } catch (error) { message = error.message; }
    assert(pattern.test(message), `${id} did not fail as expected: ${message}`);
    results.push({id, passed: true, rejectedWith: message});
  };
  const base = buildSynthetic();
  validateShape({...base, fixtureOnly: true});
  results.push({id: 'fixture-only-accepted-external-structure-shape', passed: true});
  for (const [id, mutate, pattern] of [
    ['missing-still-rejected', (x) => x.receipt.stills.pop(), /frames are missing/],
    ['reordered-stills-rejected', (x) => [x.receipt.stills[0], x.receipt.stills[1]] = [x.receipt.stills[1], x.receipt.stills[0]], /frames are missing/],
    ['wrong-still-sha-rejected', (x) => { x.receipt.stills[3].sha256 = sha256Text('wrong'); }, /does not exactly bind/],
    ['self-review-rejected', (x) => { x.receipt.reviewer.executionTaskPath = CURRENT_EXECUTION_TASK; }, /cannot self-review/],
    ['execution-group-self-sign-rejected', (x) => { x.receipt.issuerGroupId = 'candidate-execution-group'; }, /cannot self-sign/],
    ['non-accepted-decision-rejected', (x) => { x.receipt.decision = 'revise'; }, /decision is not accepted/],
    ['manual-required-check-missing-rejected', (x) => { x.receipt.manualReview.checks.pop(); }, /Manual still review checks/],
    ['frame-940-manual-check-missing-rejected', (x) => { x.receipt.manualReview.frameChecks.pop(); }, /Manual frame-specific checks/],
    ['frame-30-proof-ocr-missing-rejected', (x) => { x.receipt.proofWindowOcr.shift(); }, /OCR checklist mismatch/],
  ]) {
    const sample = structuredClone(base); mutate(sample);
    rejects(id, () => validateShape({...sample, fixtureOnly: true}), pattern);
  }
  const tempDir = mkdtempSync(resolve(tmpdir(), 'candidate-still-acceptance-cli-test-'));
  try {
    const fixturePath = resolve(tempDir, 'fixture.json');
    writeFileSync(fixturePath, `${JSON.stringify(base.receipt)}\n`, {flag: 'wx'});
    const fixtureValidate = spawnSync(process.execPath, [THIS_FILE, 'validate', '--receipt', fixturePath], {encoding: 'utf8'});
    assert(
      fixtureValidate.status !== 0 && fixtureValidate.stderr.includes(DIRECT_CLI_BLOCK_CODE),
      'Direct still-acceptance validate did not fail before repository I/O',
    );
    results.push({id: 'direct-still-acceptance-validate-before-io-blocked', passed: true});
    const bypassAttempt = spawnSync(process.execPath, [THIS_FILE, 'validate', '--check-files=false'], {encoding: 'utf8'});
    assert(
      bypassAttempt.status !== 0 && bypassAttempt.stderr.includes(DIRECT_CLI_BLOCK_CODE),
      'Direct still-acceptance bypass did not fail before repository I/O',
    );
    results.push({id: 'direct-still-acceptance-bypass-before-io-blocked', passed: true});
  } finally {
    rmSync(tempDir, {recursive: true, force: true});
  }
  const {publicKey, privateKey} = generateKeyPairSync('ed25519');
  const entry = {
    kind: EXTERNAL_ANCHOR_KIND, status: 'accepted', sourceThreadId: base.receipt.sourceThreadId, sourceMessageId: base.receipt.sourceMessageId,
    sourceMessageSha256: base.receipt.sourceMessageSha256, issuerGroupId: base.receipt.issuerGroupId,
    explicitAcceptanceQuoteSha256: sha256Text(base.receipt.explicitAcceptanceQuote), signerKeyId: 'independent-test-key',
    receiptBindingPayload: buildDirectorExternalAnchorBindingPayloadV2(base.receipt, EXTERNAL_ANCHOR_KIND),
  };
  entry.receiptBindingSha256 = stableJsonSha256(entry.receiptBindingPayload);
  entry.signatureBase64 = sign(null, Buffer.from(serializeDirectorExternalAnchorEntryForSignatureV2(entry)), privateKey).toString('base64');
  assert(verifyDirectorExternalAnchorEntryV2({receipt: base.receipt, kind: EXTERNAL_ANCHOR_KIND, entry, publicKey}).ok, 'Independent Ed25519 fixture signature failed');
  results.push({id: 'fixture-only-independent-ed25519-signature-shape', passed: true});
  const otherKey = generateKeyPairSync('ed25519').publicKey;
  rejects(
    'self-authored-or-wrong-key-signature-rejected',
    () => assert(verifyDirectorExternalAnchorEntryV2({receipt: base.receipt, kind: EXTERNAL_ANCHOR_KIND, entry, publicKey: otherKey}).ok, 'Independent signature rejected'),
    /Independent signature rejected/,
  );
  return {ok: true, count: results.length, tests: results};
};

try {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length !== 1 || rawArgs[0] !== 'selftest') {
    fail(
      `${DIRECT_CLI_BLOCK_CODE}: live validation requires an independently installed immutable launcher and external attestor; repository code cannot authorize itself`,
    );
  }
  ({
    buildDirectorExternalAnchorBindingPayloadV2,
    serializeDirectorExternalAnchorEntryForSignatureV2,
    stableJsonSha256,
    validateDirectorExternalMessageAnchorV2,
    verifyDirectorExternalAnchorEntryV2,
  } = await import('../../../skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs'));
  process.stdout.write(`${JSON.stringify(selftest(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
