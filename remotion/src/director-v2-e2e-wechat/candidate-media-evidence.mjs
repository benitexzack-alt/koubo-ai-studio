#!/usr/bin/env node

import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(THIS_DIR, '../../..');
const CONTRACT_PATH = resolve(THIS_DIR, 'candidate-media-contract.json');
const VISUAL_SEMANTIC_CONTRACT_PATH = resolve(THIS_DIR, 'visual-semantic-contract.json');
const PROXY_VALIDATOR = resolve(THIS_DIR, 'proxy-evidence.mjs');
const PREVIEW_DIR = resolve(
  REPO_ROOT,
  'work/director-v2-e2e/20260823-wechat-geo-aao-candidate-01/preview',
);
const DEFAULT_RECEIPT_PATH = resolve(PREVIEW_DIR, 'candidate-media-receipt.json');
const DEFAULT_EVIDENCE_DIR = resolve(PREVIEW_DIR, 'media-validation');
const DIRECT_CLI_BLOCK_CODE = 'CANDIDATE_MEDIA_DIRECT_CLI_BLOCKED';
const FIXED_TOOLS = Object.freeze({
  ffmpeg: '/opt/homebrew/bin/ffmpeg',
  ffprobe: '/opt/homebrew/bin/ffprobe',
  imagemagick: '/opt/homebrew/bin/magick',
  tesseract: '/opt/homebrew/bin/tesseract',
});

const RETIRED_SCREEN_SHA = 'c62481e12b095462748d216c71b45cf8d81fe495a25a52a28a9fe763d948ea6c';
const CANONICAL_SCREEN_SHA = '8e8a58c4e1b267350d623cf078b2ac3f6df22217d968e3080e4f08c86ec18e6b';
const CANONICAL_SCREEN_NAME = 'screen-full-0a992254-30fps.mp4';
const EXPECTED_SCREEN_CLIP_IDS = [
  'query',
  'answerRecommendations',
  'mapApp',
  'storeEntryJump',
  'storeMenu',
];
const EXPECTED_SCREEN_CLIP_RANGES = Object.freeze({
  query: [86, 98],
  answerRecommendations: [104, 107.4],
  mapApp: [126, 129.72],
  storeEntryJump: [129.8, 131],
  storeMenu: [142, 146.5],
});
const EXPECTED_TALKING_HEAD_RANGE = [59.96, 63.03];
const EXPECTED_CAPTION_CUE_TIMES = [
  ['cleaned-page-001', 0, 2.48],
  ['cleaned-page-002', 2.48, 5.52],
  ['cleaned-page-003', 5.52, 8.09],
  ['cleaned-page-004', 8.09, 10.64],
  ['cleaned-page-005', 10.64, 13.31],
  ['cleaned-page-006', 13.31, 15.99],
  ['cleaned-page-007', 15.99, 18.7],
  ['cleaned-page-008', 18.7, 22.23],
  ['cleaned-page-009', 22.23, 25.64],
  ['cleaned-page-010', 25.64, 29.36],
  ['cleaned-page-011', 29.36, 31.84],
  ['cleaned-page-012', 31.84, 36.64],
  ['cleaned-page-013', 36.64, 39.71],
  ['cleaned-page-014', 39.71, 42.84],
  ['cleaned-page-015-partial', 42.84, 45],
];
const EXPECTED_CAPTION_TEXT_SHA256 =
  '59105200fd1e32fb19daaae5783fca1c36ac7b9b05fcaf5c5422375c28850870';
const EXPECTED_VISUAL_SHOT_IDS = [
  'S01-query-origin',
  'S02-condition-tags',
  'S03-empty-workbench',
  'S04-four-actions',
  'S05-answer-readable',
  'S06-map-match-cut',
  'S07-store-entry-jump',
  'S08-menu-readable',
  'S09-human-and-question',
];
const EXPECTED_STILL_FRAMES = [30, 318, 319, 666, 667, 674, 690, 810, 940, 1020, 1140, 1285, 1286, 1340];
const EXPECTED_PROOF_WINDOW_CHECKS = [
  [30, 'query', 2, ['四人', '不辣', '减肥']],
  [690, 'answerRecommendations', 1, ['地图问答']],
  [810, 'mapApp', 2, ['牧之初心', '原切牛排']],
  [1020, 'storeMenu', 2, ['牧之初心', '牛排', '129']],
];
const EXPECTED_MANUAL_ONLY_STILL_CHECKS = [
  [940, 'frame-940-jump-strip-readable-and-does-not-occlude-ocr-evidence'],
];
const EXPECTED_CONTINUITY_PAIRS = [
  [318, 319],
  [666, 667],
  [1285, 1286],
];
const EXPECTED_SFX_CUE_FRAMES = [
  ['condition-lanzhou', 102],
  ['condition-people', 148],
  ['condition-light', 190],
  ['condition-diet', 245],
  ['action-video', 480],
  ['action-comments', 525],
  ['action-map', 570],
  ['action-friend', 630],
  ['answer-converge', 667],
  ['map-match', 769],
  ['store-entry', 881],
  ['store-entry-jump', 919],
  ['menu-enter', 955],
  ['question-flip', 1286],
];
const EXPECTED_MANUAL_STILL_CHECKS = [
  'privacy-loading-not-shown-as-answer',
  'internal-qa-text-absent',
  'subtitle-does-not-occlude-evidence',
  'third-party-status-disclaimer-readable',
  'third-party-status-strip-outside-card-and-readable',
  'frame-940-jump-strip-readable-and-does-not-occlude-ocr-evidence',
  'boundary-geometry-reviewed',
  'frame-30-output-ocr-reviewed',
];
const EXPECTED_CLOSING_EVIDENCE_LAYOUT = {
  imageCard: {
    left: 115,
    top: 270,
    width: 790,
    height: 535,
    paddingX: 27,
    paddingY: 27,
    outerBorderWidth: 2,
    screenContentHeight: 426,
    screenBorderWidth: 13,
    overflow: 'hidden',
  },
  thirdPartyStatusStrip: {
    left: 115,
    top: 826,
    width: 1590,
    height: 74,
    paddingX: 24,
    paddingY: 8,
    outerBorderWidth: 2,
    fontSize: 24,
    lineHeight: 1.35,
    overflow: 'visible',
  },
  minimumGapFromImageCard: 16,
  subtitleSafeTop: 922,
};

const checkClosingEvidenceBoxModel = (closingLayout) => {
  const imageCard = closingLayout.imageCard;
  const statusStrip = closingLayout.thirdPartyStatusStrip;
  const imageCardInnerHeight = imageCard.height - 2 * imageCard.paddingY - 2 * imageCard.outerBorderWidth;
  const screenOuterHeight = imageCard.screenContentHeight + 2 * imageCard.screenBorderWidth;
  assert(screenOuterHeight <= imageCardInnerHeight, 'Closing screenshot exceeds its card content box');
  assert(
    statusStrip.top >= imageCard.top + imageCard.height + closingLayout.minimumGapFromImageCard,
    'Third-party status strip overlaps the closing screenshot card',
  );
  assert(
    statusStrip.top + statusStrip.height <= closingLayout.subtitleSafeTop,
    'Third-party status strip enters the subtitle-safe band',
  );
  const statusStripInnerHeight =
    statusStrip.height - 2 * statusStrip.paddingY - 2 * statusStrip.outerBorderWidth;
  assert(
    statusStrip.overflow === 'visible' &&
      statusStrip.fontSize >= 24 &&
      statusStripInnerHeight >= statusStrip.fontSize * statusStrip.lineHeight,
    'Third-party status strip text is not visibly accommodated by its box model',
  );
};
const MUTABLE_ACCEPTANCE_FIELDS = new Set([
  'candidateRenderEligible',
  'manualBeforeAfterReview',
  'normalSpeedFullWatch',
  'styleAcceptedByUser',
  'videoRenderAllowed',
  'proofWindowOcrStatus',
  'manualFullFrameReviewStatus',
  'acceptanceReceipt',
]);

const fail = (message) => {
  throw new Error(message);
};

const assert = (condition, message) => {
  if (!condition) fail(message);
};

const assertImmutableInputEvidence = (value, label = 'Candidate media input evidence') => {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (MUTABLE_ACCEPTANCE_FIELDS.has(key)) found.push(key);
      visit(child);
    }
  };
  visit(value);
  assert(found.length === 0, `${label} contains mutable acceptance state: ${[...new Set(found)].sort().join(',')}`);
};

const run = (command, args) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const execute = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    command: [command, ...args],
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
};

const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

const sha256Text = (value) => createHash('sha256').update(value).digest('hex');

const pathLexists = (path) => {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};

const assertOutputPathVacant = (path, label) => {
  assert(!pathLexists(path), `${label} already exists; overwrite is forbidden`);
};

const claimExclusiveDirectory = (path, label) => {
  assertOutputPathVacant(path, label);
  mkdirSync(path);
  assert(pathLexists(path) && !lstatSync(path).isSymbolicLink() && statSync(path).isDirectory(), `${label} exclusive claim failed`);
  return path;
};

const resolveWithin = (root, path, label) => {
  assert(typeof path === 'string' && path.length > 0, `${label} is empty`);
  assert(!isAbsolute(path), `${label} must be repository-relative`);
  const absolutePath = resolve(root, path);
  const relativePath = relative(root, absolutePath);
  assert(
    relativePath !== '' && !relativePath.startsWith(`..${sep}`) && relativePath !== '..' &&
      !isAbsolute(relativePath),
    `${label} escapes its allowed root`,
  );
  return absolutePath;
};

const assertNoSymlinkSegments = (root, target, label) => {
  const relativePath = relative(root, target);
  assert(!relativePath.startsWith('..') && !isAbsolute(relativePath), `${label} escapes root`);
  let current = root;
  for (const segment of relativePath.split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    if (pathLexists(current)) {
      assert(!lstatSync(current).isSymbolicLink(), `${label} traverses symlink: ${current}`);
    }
  }
};

const resolveRepo = (path, label = 'repository path') => {
  const absolutePath = resolveWithin(REPO_ROOT, path, label);
  assertNoSymlinkSegments(REPO_ROOT, absolutePath, label);
  return absolutePath;
};

const probe = (path) =>
  JSON.parse(
    run(FIXED_TOOLS.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]),
  );

const firstLine = (value) => value.split(/\r?\n/)[0];

const toolVersions = () => ({
  node: process.version,
  ffmpeg: firstLine(run(FIXED_TOOLS.ffmpeg, ['-version'])),
  ffprobe: firstLine(run(FIXED_TOOLS.ffprobe, ['-version'])),
  imagemagick: firstLine(run(FIXED_TOOLS.imagemagick, ['-version'])),
  tesseract: firstLine(run(FIXED_TOOLS.tesseract, ['--version'])),
});

const validateProxyFirst = (proxyReceiptPath) => {
  const result = execute(process.execPath, [
    PROXY_VALIDATOR,
    'validate',
    '--receipt',
    proxyReceiptPath,
  ]);
  assert(result.exitCode === 0, `Proxy receipt live validation failed: ${result.stderr}`);
  return {
    command: result.command,
    exitCode: result.exitCode,
    stdoutSha256: sha256Text(result.stdout),
    stderrSha256: sha256Text(result.stderr),
  };
};

const representativeFrameArguments = (proxyPath, frameIndex, outputPath) => [
    '-v',
    'error',
    '-i',
    proxyPath,
    '-map',
    '0:v:0',
    '-vf',
    `select=eq(n\\,${frameIndex})`,
    '-fps_mode',
    'passthrough',
    '-frames:v',
    '1',
    '-n',
    outputPath,
  ];

const extractProxyFrame = (proxyPath, frameIndex, outputPath) => {
  assertOutputPathVacant(outputPath, 'Representative frame output');
  const result = execute(FIXED_TOOLS.ffmpeg, representativeFrameArguments(proxyPath, frameIndex, outputPath));
  assert(result.exitCode === 0, `Representative frame extraction failed: ${result.stderr}`);
  return result;
};

const normalizeOcr = (text) => text.replace(/[\s\p{P}\p{S}]/gu, '');

const inspectOcr = ({inputPath, config, cropOutputPath}) => {
  assertOutputPathVacant(cropOutputPath, 'OCR crop output');
  const crop = execute(FIXED_TOOLS.imagemagick, [
    inputPath,
    '-crop',
    config.crop,
    '+repage',
    '-colorspace',
    'Gray',
    '-contrast-stretch',
    '1%x1%',
    '-resize',
    config.resize,
    cropOutputPath,
  ]);
  assert(crop.exitCode === 0, `OCR crop failed: ${crop.stderr}`);
  const ocr = execute(FIXED_TOOLS.tesseract, [
    realpathSync(cropOutputPath),
    'stdout',
    '-l',
    'chi_sim+eng',
    '--psm',
    String(config.psm),
  ]);
  assert(ocr.exitCode === 0, `OCR failed: ${ocr.stderr}`);
  const normalized = normalizeOcr(ocr.stdout);
  const matchedAnchors = config.anchors.filter((anchor) => normalized.includes(anchor));
  assert(
    matchedAnchors.length >= config.mustContainAtLeast,
    `OCR semantic anchors failed: required ${config.mustContainAtLeast}, got ${matchedAnchors.length}; text=${ocr.stdout}`,
  );
  return {
    cropOutputPath,
    cropSha256: sha256(cropOutputPath),
    text: ocr.stdout,
    normalized,
    matchedAnchors,
    requiredCount: config.mustContainAtLeast,
  };
};

const inspectPrivacyPolicy = (imagePath) => {
  const ocr = execute(FIXED_TOOLS.tesseract, [
    realpathSync(imagePath),
    'stdout',
    '-l',
    'chi_sim+eng',
    '--psm',
    '6',
  ]);
  assert(ocr.exitCode === 0, `Privacy-policy OCR failed: ${ocr.stderr}`);
  const normalized = normalizeOcr(ocr.stdout);
  assert(
    normalized.includes('服务协议与隐私政策'),
    `Excluded 134-second frame is not the privacy-policy screen: ${ocr.stdout}`,
  );
  assert(
    !normalized.includes('兰州中心'),
    'Excluded 134-second frame unexpectedly contains retired query text',
  );
  return {text: ocr.stdout, normalized};
};

const decodeSpokenWindow = (spokenPath, sourceRangeSeconds) => {
  const durationSeconds = sourceRangeSeconds[1] - sourceRangeSeconds[0];
  const args = [
    '-v',
    'error',
    '-ss',
    String(sourceRangeSeconds[0]),
    '-t',
    String(durationSeconds),
    '-i',
    spokenPath,
    '-map',
    '0:a:0',
    '-f',
    'null',
    '-',
  ];
  const result = execute(FIXED_TOOLS.ffmpeg, args);
  assert(result.exitCode === 0, `Spoken 45-second audio decode failed: ${result.stderr}`);
  return {
    command: ['ffmpeg', ...args],
    exitCode: result.exitCode,
    stdoutSha256: sha256Text(result.stdout),
    stderrSha256: sha256Text(result.stderr),
  };
};

const checkTimelineSemantics = (contract) => {
  const clips = Object.entries(contract.screenClips);
  assert(
    JSON.stringify(clips.map(([id]) => id)) === JSON.stringify(EXPECTED_SCREEN_CLIP_IDS),
    'Screen clip IDs/order mismatch',
  );
  assert(
    JSON.stringify(contract.screenClipRuntimeOrder) === JSON.stringify(EXPECTED_SCREEN_CLIP_IDS),
    'Runtime screen clip order mismatch',
  );
  assert(new Set(clips.map(([id]) => id)).size === clips.length, 'Screen clip IDs are duplicated');
  assert(contract.excludedScreenRange.renderAllowed === false, 'Privacy/loading range is renderable');
  for (const [id, clip] of clips) {
    assert(
      JSON.stringify([clip.sourceIn, clip.sourceOut]) === JSON.stringify(EXPECTED_SCREEN_CLIP_RANGES[id]),
      `${id} source range differs from the locked canonical full-recording interval`,
    );
    assert(clip.sourceIn < clip.sourceOut, `${id} source range is invalid`);
    assert(clip.outputInFrame < clip.outputOutFrame, `${id} output range is invalid`);
    assert(clip.semanticClaim.trim().length > 0, `${id} semantic claim is empty`);
    assert(
      clip.representativeTime >= clip.sourceIn && clip.representativeTime <= clip.sourceOut,
      `${id} representative time is outside its source range`,
    );
    const overlapsExcluded =
      clip.sourceIn < contract.excludedScreenRange.sourceOut &&
      clip.sourceOut > contract.excludedScreenRange.sourceIn;
    assert(!overlapsExcluded, `${id} overlaps excluded 132-140 second privacy/loading range`);
    const outputDurationSeconds = (clip.outputOutFrame - clip.outputInFrame) / 30;
    const playbackRate = (clip.sourceOut - clip.sourceIn) / outputDurationSeconds;
    assert(
      playbackRate <= contract.maxScreenPlaybackRate,
      `${id} playback rate ${playbackRate.toFixed(6)} exceeds ${contract.maxScreenPlaybackRate}`,
    );
  }
  assert(contract.maxScreenPlaybackRate === 1.25, 'Screen playback-rate ceiling mismatch');
  assert(contract.unusedTransitionRange.renderAllowed === false, '140-142 second transition is renderable');
  assert(contract.screenClips.query.outputInFrame === 0, 'Query output must start at frame 0');
  assert(contract.screenClips.query.outputOutFrame === 319, 'Query output end mismatch');
  assert(contract.screenClips.answerRecommendations.outputInFrame === 667, 'Answer output start mismatch');
  assert(
    contract.screenClips.answerRecommendations.outputOutFrame ===
      contract.screenClips.mapApp.outputInFrame,
    'Answer/map output ranges are not contiguous',
  );
  assert(
    contract.screenClips.mapApp.outputOutFrame === contract.screenClips.storeEntryJump.outputInFrame,
    'Map/store-entry output ranges are not contiguous',
  );
  assert(
    contract.screenClips.storeEntryJump.outputOutFrame === contract.screenClips.storeMenu.outputInFrame,
    'Store-entry/menu output ranges are not contiguous',
  );
  assert(contract.screenClips.storeMenu.outputOutFrame === 1099, 'Store output end mismatch');
  assert(contract.talkingHeadClip.outputInFrame === 1099, 'Talking-head output start mismatch');
  assert(contract.talkingHeadClip.outputOutFrame === 1191, 'Talking-head output end mismatch');
  assert(
    JSON.stringify([contract.talkingHeadClip.spokenSourceIn, contract.talkingHeadClip.spokenSourceOut]) ===
      JSON.stringify(EXPECTED_TALKING_HEAD_RANGE),
    'Talking-head source range differs from the locked spoken interval',
  );
  assert(
    contract.semanticFrameGates.questionFlipLastForbiddenFrame === 1285 &&
      contract.semanticFrameGates.questionFlipFirstAllowedFrame === 1286 &&
      contract.semanticFrameGates.storeEntryJumpFrame === 919,
    'Semantic frame gates differ from the locked 919/1285/1286 boundaries',
  );
  const render = contract.candidateOnlyRender;
  assert(JSON.stringify(render.stillFrames) === JSON.stringify(EXPECTED_STILL_FRAMES), 'Still review frame set mismatch');
  const stillAcceptance = render.stillAcceptancePolicy;
  assert(stillAcceptance.requiredBeforeVideoRender === true, 'Still review is not required before video render');
  assert(
    stillAcceptance.receiptSchema === 'director-v2-e2e-wechat-still-acceptance-receipt/v1',
    'Still acceptance receipt schema mismatch',
  );
  assert(
    stillAcceptance.receiptPath ===
      'work/director-v2-e2e/20260823-wechat-geo-aao-candidate-01/preview/still-acceptance-receipt.v1.json',
    'Still acceptance receipt path mismatch',
  );
  assert(
    stillAcceptance.trustModel === 'independent-system-ed25519-external-message-anchor',
    'Still acceptance trust model is not independently signed',
  );
  for (const mutableField of [
    'status',
    'decision',
    'proofWindowOcrStatus',
    'manualFullFrameReviewStatus',
    'videoRenderAllowed',
    'acceptanceReceipt',
  ]) {
    assert(
      !Object.hasOwn(stillAcceptance, mutableField),
      `Candidate input contract contains mutable acceptance state: ${mutableField}`,
    );
  }
  assert(
    JSON.stringify(
      stillAcceptance.outputProofWindowOcr.map((item) => [
        item.frame,
        item.clipId,
        item.mustContainAtLeast,
        item.anchors,
      ]),
    ) === JSON.stringify(EXPECTED_PROOF_WINDOW_CHECKS),
    'Output proof-window OCR checklist mismatch',
  );
  assert(
    JSON.stringify(
      stillAcceptance.manualOnlyStillChecks.map((item) => [item.frame, item.requiredCheck]),
    ) === JSON.stringify(EXPECTED_MANUAL_ONLY_STILL_CHECKS),
    'Manual-only still checklist mismatch',
  );
  assert(
    JSON.stringify(stillAcceptance.closingEvidenceLayout) === JSON.stringify(EXPECTED_CLOSING_EVIDENCE_LAYOUT),
    'Closing evidence layout differs from the locked box model',
  );
  checkClosingEvidenceBoxModel(stillAcceptance.closingEvidenceLayout);
  assert(
    JSON.stringify(stillAcceptance.continuityPairs.map((item) => [item.fromFrame, item.toFrame])) ===
      JSON.stringify(EXPECTED_CONTINUITY_PAIRS),
    'Still continuity-pair checklist mismatch',
  );
  assert(
    JSON.stringify(stillAcceptance.manualReviewRequiredChecks) === JSON.stringify(EXPECTED_MANUAL_STILL_CHECKS),
    'Manual still review checklist mismatch',
  );
  for (const check of stillAcceptance.outputProofWindowOcr) {
    assert(render.stillFrames.includes(check.frame), `Proof-window OCR frame ${check.frame} is not in stillFrames`);
    assert(contract.screenClips[check.clipId], `Proof-window OCR clip ${check.clipId} is unregistered`);
  }
};

const checkCaptionBindings = (contract, cleaned) => {
  const cues = contract.captionAuthority.cues;
  assert(Array.isArray(cues), 'Caption cue contract is missing');
  assert(cues.length === EXPECTED_CAPTION_CUE_TIMES.length, 'Caption cue count mismatch');
  assert(new Set(cues.map((cue) => cue.id)).size === cues.length, 'Caption cue IDs are duplicated');
  assert(
    JSON.stringify(cues.map(({id, start, end}) => [id, start, end])) ===
      JSON.stringify(EXPECTED_CAPTION_CUE_TIMES),
    'Caption cue IDs or timings differ from the locked 45-second spoken timeline',
  );
  assert(cues[0].start === 0, 'Caption timeline does not start at zero');
  assert(cues.at(-1).end === 45, 'Caption timeline does not end at 45 seconds');
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    assert(typeof cue.text === 'string' && cue.text.length > 0, `${cue.id} caption text is empty`);
    assert(cue.start < cue.end, `${cue.id} caption duration is invalid`);
    if (index > 0) {
      assert(cue.start === cues[index - 1].end, `${cue.id} caption timeline is not contiguous`);
    }
  }
  const joined = cues.map((cue) => cue.text).join('');
  assert(sha256Text(joined) === EXPECTED_CAPTION_TEXT_SHA256, 'Caption text hash mismatch');
  const canonicalStart = cleaned.text.indexOf(cues[0].text);
  assert(canonicalStart >= 0, 'Caption start text is absent from canonical cleaned transcript');
  const canonicalEndMarker = cues.at(-1).text;
  const canonicalEndStart = cleaned.text.indexOf(canonicalEndMarker, canonicalStart);
  assert(canonicalEndStart >= 0, 'Caption end text is absent from canonical cleaned transcript');
  const canonicalWindow = cleaned.text.slice(
    canonicalStart,
    canonicalEndStart + canonicalEndMarker.length,
  );
  assert(joined === canonicalWindow, 'Caption cues do not equal the canonical cleaned spoken substring');
  assert(
    contract.spokenMedia.sourceRangeSeconds[0] === 23.32 &&
      contract.spokenMedia.sourceRangeSeconds[1] === 68.32,
    'Spoken source range is not the locked 23.32-68.32 second window',
  );
  return {
    cueCount: cues.length,
    joinedTextSha256: sha256Text(joined),
    canonicalWindowSha256: sha256Text(canonicalWindow),
  };
};

const checkVisualSemanticContract = () => {
  const visual = JSON.parse(readFileSync(VISUAL_SEMANTIC_CONTRACT_PATH, 'utf8'));
  const media = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  assert(visual.status === 'candidate-blocked', 'Visual-semantic contract enables production');
  assert(visual.durationSeconds === 45, 'Visual-semantic duration mismatch');
  assert(Array.isArray(visual.shots) && visual.shots.length === 9, 'Visual shot count mismatch');
  assert(
    JSON.stringify(visual.shots.map((shot) => shot.id)) === JSON.stringify(EXPECTED_VISUAL_SHOT_IDS),
    'Visual shot IDs/order mismatch',
  );
  assert(new Set(visual.shots.map((shot) => shot.id)).size === 9, 'Visual shot IDs are duplicated');
  visual.shots.forEach((shot, index) => {
    assert(shot.outputRangeSeconds[0] < shot.outputRangeSeconds[1], `${shot.id} range is invalid`);
    assert(shot.spokenLine.trim().length > 0, `${shot.id} spoken line is empty`);
    assert(shot.visualEvent.trim().length > 0, `${shot.id} visual event is empty`);
    assert(shot.cognitiveIncrement.trim().length > 0, `${shot.id} cognitive increment is empty`);
    assert(Array.isArray(shot.prohibitions) && shot.prohibitions.length > 0, `${shot.id} prohibitions missing`);
    if (index === 0) assert(shot.outputRangeSeconds[0] === 0, 'Visual timeline does not start at zero');
    if (index > 0) {
      assert(
        shot.outputRangeSeconds[0] === visual.shots[index - 1].outputRangeSeconds[1],
        `${shot.id} visual timeline is not contiguous`,
      );
    }
    const spokenFromCues = media.captionAuthority.cues
      .filter(
        (cue) =>
          cue.start >= shot.outputRangeSeconds[0] && cue.end <= shot.outputRangeSeconds[1],
      )
      .map((cue) => cue.text)
      .join('');
    assert(shot.spokenLine === spokenFromCues, `${shot.id} spokenLine differs from locked caption cues`);
  });
  assert(visual.shots.at(-1).outputRangeSeconds[1] === 45, 'Visual timeline does not end at 45 seconds');
  assert(visual.shots[1].visualEvent.includes('318→319'), 'S02/S03 boundary geometry is not explicitly bound');
  assert(visual.shots[3].visualEvent.includes('666→667'), 'S04/S05 boundary geometry is not explicitly bound');
  assert(
    visual.shots[8].visualEvent.includes('帧1285仍禁止') && visual.shots[8].visualEvent.includes('帧1286才首次允许'),
    'Closing 1285/1286 semantic boundary is not explicit',
  );
  return visual;
};

const assertExactReceiptClipIds = (receiptClipIds, contract) => {
  assert(
    JSON.stringify(receiptClipIds) === JSON.stringify(EXPECTED_SCREEN_CLIP_IDS),
    'Candidate media receipt clip evidence is missing, extra, duplicated, or out of order',
  );
  assert(new Set(receiptClipIds).size === receiptClipIds.length, 'Receipt clip evidence IDs are duplicated');
  assert(
    receiptClipIds.length === Object.keys(contract.screenClips).length,
    'Receipt clip evidence count differs from contract exact set',
  );
};

const assertDeclaredStaticMediaBindings = (contract, proxyReceipt) => {
  const screenPath = resolveRepo(contract.screenMedia.relativePath, 'screen media path');
  const spokenPath = resolveRepo(contract.spokenMedia.relativePath, 'spoken media path');
  assert(contract.screenMedia.staticFileName === CANONICAL_SCREEN_NAME, 'Canonical screen static name mismatch');
  assert(
    !contract.screenMedia.staticFileName.includes('screen-30fps.mp4'),
    'Retired screen static path is present in media contract',
  );
  assert(contract.screenMedia.sha256 === CANONICAL_SCREEN_SHA, 'Canonical screen contract SHA mismatch');
  assert(contract.screenMedia.sha256 !== RETIRED_SCREEN_SHA, 'Retired screen SHA is present in media contract');
  assert(basename(screenPath) === contract.screenMedia.staticFileName, 'Screen static basename mismatch');
  assert(
    screenPath === resolve(resolveRepo(contract.publicDir, 'candidate publicDir'), contract.screenMedia.staticFileName),
    'Screen relativePath is not exactly publicDir + staticFileName',
  );
  assert(
    proxyReceipt.controlledProxy.absolutePath === screenPath,
    'Screen static path does not equal proxy receipt canonical path',
  );
  assert(
    proxyReceipt.controlledProxy.sha256 === contract.screenMedia.sha256,
    'Screen contract SHA does not equal proxy receipt SHA',
  );
  assert(
    spokenPath === resolve(resolveRepo(contract.publicDir, 'candidate publicDir'), contract.spokenMedia.staticFileName),
    'Spoken relativePath is not exactly publicDir + staticFileName',
  );
  assert(contract.screenMedia.fit === 'contain', 'Screen media fit must be contain');
  assert(contract.screenMedia.crop === 'none', 'Screen media crop must be none');
  assert(contract.retiredInputs.oldSha256 === RETIRED_SCREEN_SHA, 'Retired SHA identity missing');
  assert(contract.retiredInputs.old86To150MappingAllowed === false, 'Old 86-150 mapping is enabled');
  assert(contract.retiredInputs.automaticTimeConversionAllowed === false, 'Old time conversion is enabled');
  const sfxPaths = contract.sfxMedia.map((item) => {
    const path = resolveRepo(item.relativePath, `SFX ${item.id} path`);
    assert(
      path === resolve(resolveRepo(contract.publicDir, 'candidate publicDir'), item.staticFileName),
      `SFX ${item.id} relativePath is not exactly publicDir + staticFileName`,
    );
    assert(item.license === 'CC0', `SFX ${item.id} is not CC0`);
    return {id: item.id, path};
  });
  assert(new Set(contract.sfxMedia.map((item) => item.id)).size === contract.sfxMedia.length, 'SFX media IDs are duplicated');
  assert(new Set(contract.sfxCues.map((cue) => cue.id)).size === contract.sfxCues.length, 'SFX cue IDs are duplicated');
  assert(
    JSON.stringify(
      contract.sfxCues.map((cue) => [
        cue.id,
        Number.isInteger(cue.atFrame) ? cue.atFrame : Math.round(cue.atSeconds * 30),
      ]),
    ) === JSON.stringify(EXPECTED_SFX_CUE_FRAMES),
    'SFX cue event frames differ from the locked visual events',
  );
  const allowedSfxNames = new Set(contract.sfxMedia.map((item) => item.staticFileName));
  for (const cue of contract.sfxCues) {
    assert(allowedSfxNames.has(cue.staticFileName), `SFX cue ${cue.id} uses unregistered media`);
    assert(
      (Number.isInteger(cue.atFrame) && !Object.hasOwn(cue, 'atSeconds')) ||
        (!Object.hasOwn(cue, 'atFrame') && Number.isFinite(cue.atSeconds)),
      `SFX cue ${cue.id} must bind exactly one of atFrame or atSeconds`,
    );
    const cueFrame = Number.isInteger(cue.atFrame) ? cue.atFrame : Math.round(cue.atSeconds * 30);
    assert(cueFrame >= 0 && cueFrame < 1350, `SFX cue ${cue.id} is outside the candidate`);
    assert(cue.volume > 0 && cue.volume <= 0.3, `SFX cue ${cue.id} volume is outside the audition-safe contract`);
  }
  return {screenPath, spokenPath, sfxPaths};
};

const assertStaticMediaBindings = (contract, proxyReceipt) => {
  const bindings = assertDeclaredStaticMediaBindings(contract, proxyReceipt);
  assert(existsSync(bindings.screenPath), `Screen static file is missing: ${bindings.screenPath}`);
  assert(sha256(bindings.screenPath) === CANONICAL_SCREEN_SHA, 'Screen static live SHA mismatch');
  assert(
    proxyReceipt.controlledProxy.sha256 === sha256(bindings.screenPath),
    'Screen static bytes do not equal proxy receipt SHA',
  );
  assert(existsSync(bindings.spokenPath), `Spoken static file is missing: ${bindings.spokenPath}`);
  assert(
    sha256(bindings.spokenPath) === contract.spokenMedia.sha256,
    'Spoken static live SHA mismatch',
  );
  for (const binding of bindings.sfxPaths) {
    const declared = contract.sfxMedia.find((item) => item.id === binding.id);
    assert(existsSync(binding.path), `SFX ${binding.id} file is missing`);
    assert(sha256(binding.path) === declared.sha256, `SFX ${binding.id} SHA mismatch`);
  }
  return bindings;
};

const inspectContractSources = (contract) => {
  const cleanedPath = resolveRepo(contract.captionAuthority.cleanedTranscriptPath, 'cleaned transcript path');
  const policyPath = resolveRepo(contract.captionAuthority.spokenSourcePolicyPath, 'spoken-source policy path');
  const spokenOriginalPath = resolveRepo(contract.spokenMedia.authoritativeOriginalPath, 'spoken original path');
  assert(sha256(cleanedPath) === contract.captionAuthority.cleanedTranscriptSha256, 'Cleaned transcript SHA mismatch');
  assert(sha256(policyPath) === contract.captionAuthority.spokenSourcePolicySha256, 'Spoken-source policy SHA mismatch');
  assert(
    sha256(spokenOriginalPath) === contract.spokenMedia.authoritativeOriginalSha256,
    'Authoritative spoken original SHA mismatch',
  );
  const timelineSource = readFileSync(resolve(THIS_DIR, 'timeline.ts'), 'utf8');
  assert(!timelineSource.includes('减肥切'), 'Raw ASR error 减肥切 remains in caption timeline body');
  assert(!timelineSource.includes('一个饭，评论'), 'Raw ASR error 一个饭，评论 remains in caption timeline body');
  const cleaned = JSON.parse(readFileSync(cleanedPath, 'utf8'));
  const captionBinding = checkCaptionBindings(contract, cleaned);
  return {cleanedPath, policyPath, spokenOriginalPath, captionBinding};
};

const inspectRuntimeSourceText = (componentText) => {
  assert(!componentText.includes('screen-30fps.mp4'), 'Component contains retired screen static path');
  assert(!componentText.includes(RETIRED_SCREEN_SHA), 'Component contains retired screen SHA');
  assert(
    componentText.includes("import mediaContract from './candidate-media-contract.json'"),
    'Component does not import the canonical media contract',
  );
  assert(
    !/trim(?:Before|After)=\{Math\.round\(\s*\d/.test(componentText),
    'Component contains an unregistered numeric screen trim',
  );
  assert(!componentText.includes('看饭评论'), 'Component contains the rejected ASR wording 看饭评论');
  assert(!componentText.includes('路径必须能验证'), 'Component adds an unspoken conclusion');
  assert(!componentText.includes('五步完成'), 'Component claims a false five-step structure');
  assert(!/Math\.sin|\bdrift\b|\bpulse\b|\blift\b/.test(componentText), 'Component contains non-causal drift/pulse/lift motion');
  const runtimeClipReferences = [...componentText.matchAll(/SCREEN_CLIPS\.([A-Za-z0-9_]+)/g)].map(
    (match) => match[1],
  );
  const runtimeClipSet = [...new Set(runtimeClipReferences)];
  assert(
    JSON.stringify(runtimeClipSet) === JSON.stringify(EXPECTED_SCREEN_CLIP_IDS),
    `Runtime screen clips do not consume the exact ordered contract set: ${runtimeClipSet.join(',')}`,
  );
  for (const clipId of EXPECTED_SCREEN_CLIP_IDS) {
    assert(runtimeClipReferences.includes(clipId), `Runtime does not consume screen clip ${clipId}`);
  }
  assert(componentText.includes('mediaContract.talkingHeadClip'), 'Runtime does not consume talkingHeadClip');
  assert(
    componentText.includes('clip.sourceIn * fps') && componentText.includes('clip.sourceOut * fps'),
    'Screen playback trims are not sourced from clip contracts',
  );
  assert(
    componentText.includes('screenshotClip.representativeTime * fps'),
    'Closing still is not bound to the registered representative time',
  );
  for (const bannedCleanViewText of [
    'candidate-blocked',
    'productionEligible=false',
    '15.99 秒前',
    '45 秒内不替',
    '原录屏',
    '局部放大',
    '完整手机保留',
    '按话音装配',
  ]) {
    assert(!componentText.includes(bannedCleanViewText), `Clean view contains internal QA text: ${bannedCleanViewText}`);
  }
  for (const positiveTimingBinding of [
    'video: frameAt(15.99 - 10.64)',
    'comments: frameAt(17.5 - 10.64)',
    'map: frameAt(19 - 10.64)',
    'friend: frameAt(21 - 10.64)',
    'mediaContract.semanticFrameGates.questionFlipFirstAllowedFrame',
    'globalFrame >= sentenceFrame',
    'const globalFrame = frame + SCREEN_CLIPS.storeEntryJump.outputInFrame',
    'const jumpStartFrame = mediaContract.semanticFrameGates.storeEntryJumpFrame',
    'enterAt(globalFrame, jumpStartFrame - 1, 18)',
    "'atFrame' in cue ? cue.atFrame : frameAt(cue.atSeconds)",
  ]) {
    assert(componentText.includes(positiveTimingBinding), `Runtime timing binding missing: ${positiveTimingBinding}`);
  }
  assert(
    componentText.includes("sentenceAllowed ? '不是它推荐了哪家店'"),
    'Closing sentence is not gated until its spoken time',
  );
  assert(
    componentText.includes('录屏当时画面；价格、评分、营业状态以当时页面为准，非现时推荐'),
    'Clean view lacks the required third-party screen evidence disclaimer',
  );
  assert(
    componentText.includes('const ThirdPartyStatusStrip') &&
      componentText.includes('<ThirdPartyStatusStrip layout={closingLayout.thirdPartyStatusStrip} />') &&
      componentText.includes('stillAcceptancePolicy.closingEvidenceLayout'),
    'Closing third-party status strip is not outside the screenshot card and contract-bound',
  );
  assert(
    !componentText.includes('fontSize: 24, marginTop: 13'),
    'Closing third-party status disclaimer remains inside the screenshot card',
  );
  assert(componentText.includes('withSfx ? <SfxTrack /> : null'), 'WithSfx/NoSfx visual-twin switch is missing');
  assert(
    componentText.includes('const CONDITION_TAG_GEOMETRY') &&
      componentText.includes('<ConditionTagCard') &&
      componentText.includes('frame >= 318 ? 1'),
    'S02/S03 does not share the locked condition-tag geometry and component at 318/319',
  );
  assert(
    componentText.includes('const ACTION_OBJECT_GEOMETRY') &&
      componentText.includes('<ActionObject') &&
      componentText.includes('frame >= 347 ? 1'),
    'S04/S05 does not share the locked four-object geometry and component at 666/667',
  );
  assert(!componentText.includes('bottom: 49'), 'Third-party status disclaimer remains inside the subtitle-safe bottom band');
  return {runtimeClipReferences, runtimeClipSet};
};

const inspectCodeBindings = () => {
  const paths = [
    'candidate-media-contract.json',
    'visual-semantic-contract.json',
    'timeline.ts',
    'DirectorV2E2EWechat.tsx',
    'entry.tsx',
    'README.md',
    'proxy-evidence.mjs',
    'candidate-media-evidence.mjs',
    'render-candidate.mjs',
    'test-proxy-evidence.mjs',
    'test-candidate-media-evidence.mjs',
    'test-render-candidate.mjs',
    'network-deny.sb',
  ].map((file) => resolve(THIS_DIR, file));
  const componentText = readFileSync(resolve(THIS_DIR, 'DirectorV2E2EWechat.tsx'), 'utf8');
  const entryText = readFileSync(resolve(THIS_DIR, 'entry.tsx'), 'utf8');
  inspectRuntimeSourceText(componentText);
  assert(
    entryText.includes('DirectorV2E2EWechat-Candidate02-WithSfx') &&
      entryText.includes('DirectorV2E2EWechat-Candidate02-NoSfx'),
    'Entry does not expose the locked WithSfx/NoSfx pair',
  );
  assert(
    entryText.includes('withSfx: true') && entryText.includes('withSfx: false'),
    'Entry A/B compositions do not differ only by the SFX flag contract',
  );
  return paths.map((path) => ({absolutePath: path, sha256: sha256(path)}));
};

const buildPublicDirManifest = (contract) => {
  const publicDir = resolveRepo(contract.publicDir, 'candidate publicDir');
  const entries = readdirSync(publicDir, {withFileTypes: true});
  assert(entries.every((entry) => entry.isFile()), 'Candidate publicDir contains a directory or symlink');
  const files = entries
    .map((entry) => {
      const absolutePath = resolve(publicDir, entry.name);
      return {
        staticFileName: entry.name,
        absolutePath,
        bytes: statSync(absolutePath).size,
        sha256: sha256(absolutePath),
      };
    })
    .sort((a, b) => a.staticFileName.localeCompare(b.staticFileName));
  const expectedNames = [
    contract.screenMedia.staticFileName,
    contract.spokenMedia.staticFileName,
    ...contract.sfxMedia.map((item) => item.staticFileName),
  ].sort();
  assert(
    JSON.stringify(files.map((file) => file.staticFileName)) === JSON.stringify(expectedNames),
    'Candidate publicDir contains missing or unexpected files',
  );
  const manifestSha256 = sha256Text(JSON.stringify(files));
  return {absolutePath: publicDir, files, manifestSha256};
};

const buildRepresentativeEvidence = ({contract, proxyPath, evidenceDir}) => {
  const representativeDir = resolve(evidenceDir, 'clip-representatives');
  claimExclusiveDirectory(representativeDir, 'Representative evidence directory');
  const clips = Object.entries(contract.screenClips).map(([id, clip]) => {
    const frameIndex = Math.round(clip.representativeTime * 30);
    const imagePath = resolve(
      representativeDir,
      `${id}-t-${String(clip.representativeTime).replace('.', 'p')}-f-${frameIndex}.png`,
    );
    const ocrCropPath = resolve(representativeDir, `${id}-ocr-crop.png`);
    extractProxyFrame(proxyPath, frameIndex, imagePath);
    const ocr = inspectOcr({inputPath: imagePath, config: clip.ocr, cropOutputPath: ocrCropPath});
    return {
      id,
      semanticClaim: clip.semanticClaim,
      sourceIn: clip.sourceIn,
      sourceOut: clip.sourceOut,
      outputInFrame: clip.outputInFrame,
      outputOutFrame: clip.outputOutFrame,
      representativeTime: clip.representativeTime,
      representativeFrameIndex: frameIndex,
      playbackRate:
        (clip.sourceOut - clip.sourceIn) /
        ((clip.outputOutFrame - clip.outputInFrame) / 30),
      imagePath,
      imageSha256: sha256(imagePath),
      ocr,
    };
  });

  const excluded = contract.excludedScreenRange;
  const excludedFrameIndex = Math.round(excluded.representativeTime * 30);
  const excludedImagePath = resolve(
    representativeDir,
    `excluded-privacy-t-${excluded.representativeTime}-f-${excludedFrameIndex}.png`,
  );
  extractProxyFrame(proxyPath, excludedFrameIndex, excludedImagePath);
  const privacyOcr = inspectPrivacyPolicy(excludedImagePath);
  return {
    clips,
    excluded: {
      ...excluded,
      representativeFrameIndex: excludedFrameIndex,
      imagePath: excludedImagePath,
      imageSha256: sha256(excludedImagePath),
      privacyOcr,
    },
  };
};

const build = ({receiptPath, evidenceDir}) => {
  assert(receiptPath === DEFAULT_RECEIPT_PATH, 'Candidate media receipt path is not the fixed task path');
  assert(evidenceDir === DEFAULT_EVIDENCE_DIR, 'Candidate media evidenceDir is not the fixed task path');
  assertNoSymlinkSegments(PREVIEW_DIR, receiptPath, 'candidate media receipt');
  assertNoSymlinkSegments(PREVIEW_DIR, evidenceDir, 'candidate media evidenceDir');
  assertOutputPathVacant(receiptPath, 'Candidate media receipt');
  // Atomic directory creation is the build claim. A concurrent builder loses
  // with EEXIST before it can write any representative frame.
  claimExclusiveDirectory(evidenceDir, 'Candidate media evidenceDir');
  assertNoSymlinkSegments(PREVIEW_DIR, evidenceDir, 'candidate media evidenceDir after exclusive create');
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  const proxyReceiptPath = resolveRepo(contract.proxyReceipt);
  const proxyValidation = validateProxyFirst(proxyReceiptPath);
  const proxyReceipt = JSON.parse(readFileSync(proxyReceiptPath, 'utf8'));
  checkTimelineSemantics(contract);
  const visualSemanticContract = checkVisualSemanticContract();
  const {screenPath, spokenPath, sfxPaths} = assertStaticMediaBindings(contract, proxyReceipt);
  const sourcePaths = inspectContractSources(contract);
  const codeBindings = inspectCodeBindings();
  const publicDirManifest = buildPublicDirManifest(contract);
  const screenProbe = probe(screenPath);
  const spokenProbe = probe(spokenPath);
  assert(
    spokenProbe.streams.some((stream) => stream.codec_type === 'audio'),
    'Spoken static media has no audio stream',
  );
  const spokenWindowDecode = decodeSpokenWindow(spokenPath, contract.spokenMedia.sourceRangeSeconds);
  const representativeEvidence = buildRepresentativeEvidence({
    contract,
    proxyPath: screenPath,
    evidenceDir,
  });

  const receipt = {
    schemaVersion: 'director-v2-e2e-wechat-candidate-media-receipt/v2',
    status: 'candidate-inputs-validated',
    productionEligible: false,
    proxyReceipt: {
      absolutePath: proxyReceiptPath,
      sha256: sha256(proxyReceiptPath),
      validation: proxyValidation,
      boundProxyPath: screenPath,
      boundProxySha256: CANONICAL_SCREEN_SHA,
    },
    mediaContract: {
      absolutePath: CONTRACT_PATH,
      sha256: sha256(CONTRACT_PATH),
    },
    screenMedia: {
      absolutePath: screenPath,
      staticFileName: contract.screenMedia.staticFileName,
      sha256: sha256(screenPath),
      bytes: statSync(screenPath).size,
      ffprobe: screenProbe,
      fit: contract.screenMedia.fit,
      crop: contract.screenMedia.crop,
    },
    spokenMedia: {
      absolutePath: spokenPath,
      staticFileName: contract.spokenMedia.staticFileName,
      sha256: sha256(spokenPath),
      bytes: statSync(spokenPath).size,
      ffprobe: spokenProbe,
      authoritativeOriginal: {
        absolutePath: sourcePaths.spokenOriginalPath,
        sha256: contract.spokenMedia.authoritativeOriginalSha256,
      },
      sourceRangeSeconds: contract.spokenMedia.sourceRangeSeconds,
      windowDecode: spokenWindowDecode,
    },
    sfxMedia: contract.sfxMedia.map((item) => {
      const bound = sfxPaths.find((entry) => entry.id === item.id);
      return {
        id: item.id,
        absolutePath: bound.path,
        staticFileName: item.staticFileName,
        sha256: item.sha256,
        bytes: statSync(bound.path).size,
        license: item.license,
        licenseManifest: item.licenseManifest,
      };
    }),
    sfxCues: contract.sfxCues,
    captions: {
      cleanedTranscript: {
        absolutePath: sourcePaths.cleanedPath,
        sha256: contract.captionAuthority.cleanedTranscriptSha256,
      },
      spokenSourcePolicy: {
        absolutePath: sourcePaths.policyPath,
        sha256: contract.captionAuthority.spokenSourcePolicySha256,
      },
      audioConfirmedCorrections: contract.captionAuthority.audioConfirmedCorrections,
      fullCueBinding: sourcePaths.captionBinding,
    },
    visualSemanticContract: {
      absolutePath: VISUAL_SEMANTIC_CONTRACT_PATH,
      sha256: sha256(VISUAL_SEMANTIC_CONTRACT_PATH),
      shotIds: visualSemanticContract.shots.map((shot) => shot.id),
    },
    screenClipEvidence: representativeEvidence.clips,
    excludedPrivacyAndLoadingEvidence: representativeEvidence.excluded,
    publicDirManifest,
    codeBindings,
    tools: toolVersions(),
    failClosedPolicy: {
      proxyReceiptMustValidateFirst: true,
      staticFileBytesMustEqualProxyReceiptSha: true,
      retiredScreenPathOrShaBlocks: true,
      clipRepresentativeMustReextractFromLiveProxy: true,
      privacyAndLoadingRangeMustRemainExcluded: true,
      directRemotionRenderIsNotAuthorized: true,
    },
  };
  assertImmutableInputEvidence(receipt);
  assert(dirname(receiptPath) === PREVIEW_DIR, 'Candidate media receipt parent differs from fixed preview directory');
  assertNoSymlinkSegments(PREVIEW_DIR, evidenceDir, 'candidate media evidenceDir after build');
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
  validate({receiptPath});
  return receipt;
};

const validate = ({receiptPath}) => {
  assert(receiptPath === DEFAULT_RECEIPT_PATH, 'Candidate media receipt path is not the fixed task path');
  assertNoSymlinkSegments(PREVIEW_DIR, receiptPath, 'candidate media receipt');
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  const proxyReceiptPath = resolveRepo(contract.proxyReceipt);
  validateProxyFirst(proxyReceiptPath);

  assert(pathLexists(receiptPath), `Candidate media receipt is missing: ${receiptPath}`);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert(
    receipt.schemaVersion === 'director-v2-e2e-wechat-candidate-media-receipt/v2',
    'Candidate media receipt schema mismatch',
  );
  assert(receipt.status === 'candidate-inputs-validated', 'Candidate media receipt status mismatch');
  assert(receipt.productionEligible === false, 'Candidate media receipt enables production');
  assertImmutableInputEvidence(receipt);
  assert(receipt.proxyReceipt.absolutePath === proxyReceiptPath, 'Bound proxy receipt path mismatch');
  assert(receipt.proxyReceipt.sha256 === sha256(proxyReceiptPath), 'Bound proxy receipt SHA mismatch');
  assert(receipt.mediaContract.sha256 === sha256(CONTRACT_PATH), 'Media contract SHA mismatch');

  const proxyReceipt = JSON.parse(readFileSync(proxyReceiptPath, 'utf8'));
  checkTimelineSemantics(contract);
  const visualSemanticContract = checkVisualSemanticContract();
  const {screenPath, spokenPath, sfxPaths} = assertStaticMediaBindings(contract, proxyReceipt);
  const sourcePaths = inspectContractSources(contract);
  const liveCodeBindings = inspectCodeBindings();
  assert(
    JSON.stringify(liveCodeBindings) === JSON.stringify(receipt.codeBindings),
    'Code binding changed after candidate media receipt was built',
  );
  const livePublicDirManifest = buildPublicDirManifest(contract);
  assert(
    JSON.stringify(livePublicDirManifest) === JSON.stringify(receipt.publicDirManifest),
    'Candidate publicDir full manifest changed after receipt build',
  );
  assert(receipt.screenMedia.absolutePath === screenPath, 'Receipt screen path mismatch');
  assert(receipt.screenMedia.sha256 === sha256(screenPath), 'Receipt screen SHA mismatch');
  assert(receipt.screenMedia.bytes === statSync(screenPath).size, 'Receipt screen byte count mismatch');
  assert(receipt.spokenMedia.absolutePath === spokenPath, 'Receipt spoken path mismatch');
  assert(receipt.spokenMedia.sha256 === sha256(spokenPath), 'Receipt spoken SHA mismatch');
  assert(receipt.spokenMedia.bytes === statSync(spokenPath).size, 'Receipt spoken byte count mismatch');
  assert(receipt.sfxMedia.length === sfxPaths.length, 'Receipt SFX media count mismatch');
  for (const item of receipt.sfxMedia) {
    const contractItem = contract.sfxMedia.find((candidate) => candidate.id === item.id);
    const live = sfxPaths.find((candidate) => candidate.id === item.id);
    assert(contractItem && live, `Unknown SFX receipt item ${item.id}`);
    assert(item.absolutePath === live.path, `SFX ${item.id} receipt path mismatch`);
    assert(item.sha256 === sha256(live.path), `SFX ${item.id} receipt SHA mismatch`);
    assert(item.bytes === statSync(live.path).size, `SFX ${item.id} receipt bytes mismatch`);
    assert(item.license === 'CC0', `SFX ${item.id} receipt license mismatch`);
  }
  assert(JSON.stringify(receipt.sfxCues) === JSON.stringify(contract.sfxCues), 'Receipt SFX cues mismatch');
  assert(
    JSON.stringify(receipt.screenMedia.ffprobe) === JSON.stringify(probe(screenPath)),
    'Receipt screen ffprobe mismatch',
  );
  assert(
    JSON.stringify(receipt.spokenMedia.ffprobe) === JSON.stringify(probe(spokenPath)),
    'Receipt spoken ffprobe mismatch',
  );
  decodeSpokenWindow(spokenPath, contract.spokenMedia.sourceRangeSeconds);

  const receiptClipIds = receipt.screenClipEvidence.map((clip) => clip.id);
  assertExactReceiptClipIds(receiptClipIds, contract);
  assert(
    receipt.captions.fullCueBinding.cueCount === sourcePaths.captionBinding.cueCount &&
      receipt.captions.fullCueBinding.joinedTextSha256 === sourcePaths.captionBinding.joinedTextSha256 &&
      receipt.captions.fullCueBinding.canonicalWindowSha256 ===
        sourcePaths.captionBinding.canonicalWindowSha256,
    'Receipt full caption binding differs from live canonical transcript',
  );
  assert(
    receipt.visualSemanticContract.absolutePath === VISUAL_SEMANTIC_CONTRACT_PATH &&
      receipt.visualSemanticContract.sha256 === sha256(VISUAL_SEMANTIC_CONTRACT_PATH) &&
      JSON.stringify(receipt.visualSemanticContract.shotIds) ===
        JSON.stringify(visualSemanticContract.shots.map((shot) => shot.id)),
    'Receipt visual-semantic contract binding mismatch',
  );

  const tempDir = mkdtempSync(resolve(tmpdir(), 'director-v2-media-validate-'));
  try {
    for (const clip of receipt.screenClipEvidence) {
      const contractClip = contract.screenClips[clip.id];
      assert(contractClip, `Unknown clip in media receipt: ${clip.id}`);
      assert(clip.semanticClaim === contractClip.semanticClaim, `${clip.id} semantic claim mismatch`);
      assert(clip.sourceIn === contractClip.sourceIn, `${clip.id} source-in mismatch`);
      assert(clip.sourceOut === contractClip.sourceOut, `${clip.id} source-out mismatch`);
      assert(
        clip.representativeFrameIndex === Math.round(contractClip.representativeTime * 30),
        `${clip.id} representative frame mismatch`,
      );
      assert(existsSync(clip.imagePath), `${clip.id} representative image is missing`);
      assert(sha256(clip.imagePath) === clip.imageSha256, `${clip.id} stored image SHA mismatch`);
      const liveImagePath = resolve(tempDir, `${clip.id}-live.png`);
      const liveOcrCropPath = resolve(tempDir, `${clip.id}-live-ocr.png`);
      extractProxyFrame(screenPath, clip.representativeFrameIndex, liveImagePath);
      assert(
        sha256(liveImagePath) === clip.imageSha256,
        `${clip.id} representative image is not reproducible from live canonical proxy`,
      );
      const liveOcr = inspectOcr({
        inputPath: liveImagePath,
        config: contractClip.ocr,
        cropOutputPath: liveOcrCropPath,
      });
      assert(
        JSON.stringify(liveOcr.matchedAnchors) === JSON.stringify(clip.ocr.matchedAnchors),
        `${clip.id} live OCR anchors no longer match receipt`,
      );
    }

    const excluded = receipt.excludedPrivacyAndLoadingEvidence;
    assert(excluded.renderAllowed === false, 'Excluded privacy/loading range became renderable');
    assert(excluded.sourceIn === 132 && excluded.sourceOut === 140, 'Excluded source range mismatch');
    assert(existsSync(excluded.imagePath), 'Excluded privacy representative is missing');
    assert(sha256(excluded.imagePath) === excluded.imageSha256, 'Excluded privacy image SHA mismatch');
    const liveExcludedPath = resolve(tempDir, 'excluded-privacy-live.png');
    extractProxyFrame(screenPath, excluded.representativeFrameIndex, liveExcludedPath);
    assert(
      sha256(liveExcludedPath) === excluded.imageSha256,
      'Excluded privacy image is not reproducible from live canonical proxy',
    );
    inspectPrivacyPolicy(liveExcludedPath);
  } finally {
    rmSync(tempDir, {recursive: true, force: true});
  }

  assert(receipt.failClosedPolicy.proxyReceiptMustValidateFirst, 'Proxy-first policy missing');
  assert(
    receipt.failClosedPolicy.staticFileBytesMustEqualProxyReceiptSha,
    'Static-file byte binding policy missing',
  );
  assert(receipt.failClosedPolicy.retiredScreenPathOrShaBlocks, 'Retired media block missing');
  assert(receipt.failClosedPolicy.directRemotionRenderIsNotAuthorized, 'Direct render is authorized');
  return {ok: true, receiptPath};
};

const selftest = () => {
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  const cleaned = JSON.parse(
    readFileSync(resolveRepo(contract.captionAuthority.cleanedTranscriptPath), 'utf8'),
  );
  const componentText = readFileSync(resolve(THIS_DIR, 'DirectorV2E2EWechat.tsx'), 'utf8');
  const results = [];
  const passes = (id, callback) => {
    callback();
    results.push({id, passed: true});
  };
  const rejects = (id, callback, expectedPattern) => {
    let message = '';
    try {
      callback();
    } catch (error) {
      message = error.message;
    }
    assert(expectedPattern.test(message), `${id} did not fail as expected: ${message}`);
    results.push({id, passed: true, rejectedWith: message});
  };

  passes('fixture-only-locked-contract-caption-visual-shape', () => {
    checkTimelineSemantics(contract);
    checkCaptionBindings(contract, cleaned);
    checkVisualSemanticContract();
    inspectRuntimeSourceText(componentText);
    assertExactReceiptClipIds(EXPECTED_SCREEN_CLIP_IDS, contract);
  });

  for (const [id, ids] of [
    ['receipt-missing-clip-rejected', EXPECTED_SCREEN_CLIP_IDS.slice(0, -1)],
    ['receipt-extra-clip-rejected', [...EXPECTED_SCREEN_CLIP_IDS, 'unregistered']],
    ['receipt-duplicate-clip-rejected', [...EXPECTED_SCREEN_CLIP_IDS.slice(0, -1), 'storeEntryJump']],
    ['receipt-reordered-clip-rejected', [
      'query',
      'mapApp',
      'answerRecommendations',
      'storeEntryJump',
      'storeMenu',
    ]],
  ]) {
    rejects(id, () => assertExactReceiptClipIds(ids, contract), /missing, extra, duplicated, or out of order/);
  }

  const missingStoreEntry = structuredClone(contract);
  delete missingStoreEntry.screenClips.storeEntryJump;
  rejects(
    'contract-missing-store-entry-rejected',
    () => checkTimelineSemantics(missingStoreEntry),
    /Screen clip IDs\/order mismatch/,
  );

  const excessiveRate = structuredClone(contract);
  excessiveRate.screenClips.mapApp.outputInFrame = 850;
  rejects(
    'screen-playback-rate-over-1p25-rejected',
    () => checkTimelineSemantics(excessiveRate),
    /playback rate/,
  );

  for (const clipId of EXPECTED_SCREEN_CLIP_IDS) {
    const sourceTamper = structuredClone(contract);
    sourceTamper.screenClips[clipId].sourceIn += 0.01;
    rejects(
      `screen-source-range-${clipId}-tamper-rejected`,
      () => checkTimelineSemantics(sourceTamper),
      /source range differs from the locked canonical full-recording interval/,
    );
  }
  const talkingHeadTamper = structuredClone(contract);
  talkingHeadTamper.talkingHeadClip.spokenSourceOut += 0.01;
  rejects(
    'talking-head-source-range-tamper-rejected',
    () => checkTimelineSemantics(talkingHeadTamper),
    /Talking-head source range differs from the locked spoken interval/,
  );

  const mutableAcceptanceStateInInputContract = structuredClone(contract);
  mutableAcceptanceStateInInputContract.candidateOnlyRender.stillAcceptancePolicy.proofWindowOcrStatus = 'passed';
  rejects(
    'mutable-still-acceptance-state-in-input-contract-rejected',
    () => checkTimelineSemantics(mutableAcceptanceStateInInputContract),
    /mutable acceptance state/,
  );

  const missingProofWindowCheck = structuredClone(contract);
  missingProofWindowCheck.candidateOnlyRender.stillAcceptancePolicy.outputProofWindowOcr.pop();
  rejects(
    'missing-output-proof-window-check-rejected',
    () => checkTimelineSemantics(missingProofWindowCheck),
    /Output proof-window OCR checklist mismatch/,
  );

  const frame940AsAutomaticOcr = structuredClone(contract);
  frame940AsAutomaticOcr.candidateOnlyRender.stillAcceptancePolicy.outputProofWindowOcr.splice(3, 0, {
    frame: 940,
    clipId: 'storeEntryJump',
    mustContainAtLeast: 1,
    anchors: ['牧之初心'],
  });
  rejects(
    'frame-940-automatic-ocr-rejected',
    () => checkTimelineSemantics(frame940AsAutomaticOcr),
    /Output proof-window OCR checklist mismatch/,
  );

  const overlappingStatusStrip = structuredClone(EXPECTED_CLOSING_EVIDENCE_LAYOUT);
  overlappingStatusStrip.thirdPartyStatusStrip.top = 790;
  rejects(
    'closing-status-strip-overlap-box-model-rejected',
    () => checkClosingEvidenceBoxModel(overlappingStatusStrip),
    /overlaps the closing screenshot card/,
  );

  const clippedStatusStrip = structuredClone(EXPECTED_CLOSING_EVIDENCE_LAYOUT);
  clippedStatusStrip.thirdPartyStatusStrip.height = 40;
  rejects(
    'closing-status-strip-clipped-text-rejected',
    () => checkClosingEvidenceBoxModel(clippedStatusStrip),
    /not visibly accommodated/,
  );

  rejects(
    'input-evidence-receipt-mutable-acceptance-rejected',
    () => assertImmutableInputEvidence({screenClipEvidence: [{id: 'query', manualBeforeAfterReview: 'pending'}]}),
    /contains mutable acceptance state/,
  );

  const captionGap = structuredClone(contract);
  captionGap.captionAuthority.cues[4].start = 10.7;
  rejects('caption-gap-rejected', () => checkCaptionBindings(captionGap, cleaned), /timings differ/);

  const captionMissing = structuredClone(contract);
  captionMissing.captionAuthority.cues.splice(7, 1);
  rejects(
    'caption-missing-cue-rejected',
    () => checkCaptionBindings(captionMissing, cleaned),
    /cue count mismatch/,
  );

  const captionRewrite = structuredClone(contract);
  captionRewrite.captionAuthority.cues[6].text = '一个看饭评论';
  rejects('caption-rewrite-rejected', () => checkCaptionBindings(captionRewrite, cleaned), /text hash mismatch/);

  const captionReordered = structuredClone(contract);
  [captionReordered.captionAuthority.cues[5], captionReordered.captionAuthority.cues[6]] = [
    captionReordered.captionAuthority.cues[6],
    captionReordered.captionAuthority.cues[5],
  ];
  rejects(
    'caption-reordered-rejected',
    () => checkCaptionBindings(captionReordered, cleaned),
    /timings differ/,
  );

  const wrongSpokenPath = structuredClone(contract);
  wrongSpokenPath.spokenMedia.relativePath = contract.screenMedia.relativePath;
  const declaredProxyReceipt = {
    controlledProxy: {
      absolutePath: resolveRepo(contract.screenMedia.relativePath, 'fixture screen media path'),
      sha256: contract.screenMedia.sha256,
    },
  };
  passes('fixture-only-declared-static-media-binding-shape', () => {
    assertDeclaredStaticMediaBindings(contract, declaredProxyReceipt);
  });
  rejects(
    'spoken-path-not-publicdir-plus-static-name-rejected',
    () => assertDeclaredStaticMediaBindings(wrongSpokenPath, declaredProxyReceipt),
    /not exactly publicDir \+ staticFileName/,
  );

  rejects(
    'runtime-missing-store-entry-rejected',
    () =>
      inspectRuntimeSourceText(
        componentText.replace(/SCREEN_CLIPS\.storeEntryJump/g, 'SCREEN_CLIPS.answerRecommendations'),
      ),
    /exact ordered contract set/,
  );
  rejects(
    'runtime-unregistered-numeric-trim-rejected',
    () => inspectRuntimeSourceText(`${componentText}\n{/* trimBefore={Math.round(95 * fps)} */}`),
    /unregistered numeric screen trim/,
  );
  rejects(
    'runtime-missing-talking-head-rejected',
    () => inspectRuntimeSourceText(componentText.replaceAll('mediaContract.talkingHeadClip', 'null')),
    /does not consume talkingHeadClip/,
  );

  passes('fixture-only-runtime-action-closing-and-boundary-shape', () => inspectRuntimeSourceText(componentText));

  rejects(
    'closing-frame-1286-first-allowance-tamper-rejected',
    () => inspectRuntimeSourceText(componentText.replace('globalFrame >= sentenceFrame', 'globalFrame > sentenceFrame')),
    /Runtime timing binding missing/,
  );
  rejects(
    'store-jump-visual-sfx-frame-tamper-rejected',
    () =>
      inspectRuntimeSourceText(
        componentText.replace('enterAt(globalFrame, jumpStartFrame - 1, 18)', 'enterAt(frame, 38, 18)'),
      ),
    /Runtime timing binding missing/,
  );
  rejects(
    'closing-status-strip-returned-inside-card-rejected',
    () =>
      inspectRuntimeSourceText(
        componentText.replace(
          '<ThirdPartyStatusStrip layout={closingLayout.thirdPartyStatusStrip} />',
          '{null}',
        ),
      ),
    /status strip is not outside the screenshot card/,
  );
  rejects(
    'condition-boundary-shared-geometry-tamper-rejected',
    () => inspectRuntimeSourceText(componentText.replace('const CONDITION_TAG_GEOMETRY', 'const SPLIT_CONDITION_TAG_GEOMETRY')),
    /condition-tag geometry/,
  );
  rejects(
    'action-boundary-shared-geometry-tamper-rejected',
    () => inspectRuntimeSourceText(componentText.replace('const ACTION_OBJECT_GEOMETRY', 'const SPLIT_ACTION_OBJECT_GEOMETRY')),
    /four-object geometry/,
  );

  passes('fixture-only-representative-ffmpeg-no-overwrite-shape', () => {
    const args = representativeFrameArguments('/tmp/input.mp4', 30, '/tmp/output.png');
    assert(args.includes('-n') && !args.includes('-y'), 'Representative extraction is not fail-closed against overwrite');
  });

  const tempDir = mkdtempSync(resolve(tmpdir(), 'candidate-media-exclusive-test-'));
  try {
    const claimed = resolve(tempDir, 'evidence');
    claimExclusiveDirectory(claimed, 'Fixture evidenceDir');
    rejects(
      'concurrent-media-evidence-build-rejected',
      () => claimExclusiveDirectory(claimed, 'Fixture evidenceDir'),
      /already exists; overwrite is forbidden/,
    );
    const dangling = resolve(tempDir, 'dangling-evidence');
    symlinkSync(resolve(tempDir, 'missing-target'), dangling);
    rejects(
      'dangling-media-evidence-path-rejected',
      () => claimExclusiveDirectory(dangling, 'Dangling fixture evidenceDir'),
      /already exists; overwrite is forbidden/,
    );
    const existingCrop = resolve(tempDir, 'existing-crop.png');
    writeFileSync(existingCrop, 'existing');
    rejects(
      'existing-representative-output-rejected',
      () => assertOutputPathVacant(existingCrop, 'Fixture representative output'),
      /already exists; overwrite is forbidden/,
    );
  } finally {
    rmSync(tempDir, {recursive: true, force: true});
  }

  const blockedCliTempDir = mkdtempSync(resolve(tmpdir(), 'candidate-media-direct-cli-block-'));
  try {
    for (const mode of ['build', 'validate']) {
      const receiptPath = resolve(blockedCliTempDir, `${mode}-receipt.json`);
      const evidenceDir = resolve(blockedCliTempDir, `${mode}-evidence`);
      const result = spawnSync(
        process.execPath,
        [THIS_FILE, mode, '--receipt', receiptPath, '--evidence-dir', evidenceDir],
        {encoding: 'utf8', maxBuffer: 1024 * 1024},
      );
      assert(result.status !== 0, `Direct ${mode} CLI unexpectedly succeeded`);
      assert(
        result.stderr.includes(DIRECT_CLI_BLOCK_CODE),
        `Direct ${mode} CLI did not return the stable block code`,
      );
      assert(!existsSync(receiptPath), `Direct ${mode} CLI created a receipt before blocking`);
      assert(!existsSync(evidenceDir), `Direct ${mode} CLI created an evidence directory before blocking`);
      results.push({id: `direct-${mode}-cli-before-io-blocked`, passed: true});
    }
  } finally {
    rmSync(blockedCliTempDir, {recursive: true, force: true});
  }

  return {ok: true, tests: results, count: results.length};
};

const parseArguments = () => {
  const args = process.argv.slice(2);
  const mode = args.shift() || 'validate';
  const options = {
    mode,
    receiptPath: DEFAULT_RECEIPT_PATH,
    evidenceDir: DEFAULT_EVIDENCE_DIR,
  };
  while (args.length > 0) {
    const flag = args.shift();
    const value = args.shift();
    if (!value) fail(`Missing value for ${flag}`);
    if (flag === '--receipt') {
      options.receiptPath = resolve(value);
      assert(options.receiptPath === DEFAULT_RECEIPT_PATH, 'Only the fixed candidate media receipt is allowed');
    } else if (flag === '--evidence-dir') {
      options.evidenceDir = resolve(value);
      assert(options.evidenceDir === DEFAULT_EVIDENCE_DIR, 'Only the fixed candidate media evidenceDir is allowed');
    }
    else fail(`Unknown option: ${flag}`);
  }
  return options;
};

try {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length !== 1 || rawArgs[0] !== 'selftest') {
    fail(
      `${DIRECT_CLI_BLOCK_CODE}: live build/validate requires an independently installed, immutable system launcher; repository code cannot authorize itself`,
    );
  }
  process.stdout.write(`${JSON.stringify(selftest(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
