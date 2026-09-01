#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {
  DIRECTOR_HANDOFF_RECEIPT_SCHEMA,
  DIRECTOR_HUMAN_REVIEW_SCHEMA,
  DIRECTOR_EXTERNAL_TRUST_ROOT_PATH,
  DIRECTOR_SUPERVISOR_REVIEW_SCHEMA,
  DIRECTOR_TECHNICAL_QA_SCHEMA,
  DIRECTOR_TRANSCRIPT_SCHEMA,
  analyzeVisualCoverage,
  buildDirectorExternalAnchorBindingPayloadV2,
  buildHandoffBindingPayload,
  computeHandoffSupervisionBindingSha256,
  computeDirectorMediaQaMetrics,
  computeHandoffBindingSha256,
  computeHandoffContractSnapshotSha256,
  serializeDirectorExternalAnchorEntryForSignatureV2,
  stableJsonSha256,
  readDirectorIndependentTrustRootV2,
  validateDirectorContractV2,
  verifyDirectorExternalAnchorEntryV2,
} from './director-contract-v2-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'validate-director-contract-v2.mjs');
const MANIFEST = resolve(HERE, '../fixtures/incident-regression-manifest.v2.json');
const HASH = 'a'.repeat(64);
const clone = (value) => structuredClone(value);
const sha256Text = (value) => createHash('sha256').update(value).digest('hex');
const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options});
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stderr}\n${result.stdout}`);
  }
  return result;
};

const ffprobe = (path) => {
  const result = run('ffprobe', [
    '-v', 'error', '-count_frames',
    '-show_entries', 'format=duration:stream=codec_type,width,height,avg_frame_rate,r_frame_rate,sample_rate,nb_read_frames,nb_frames',
    '-of', 'json', path,
  ]);
  const parsed = JSON.parse(result.stdout);
  const video = parsed.streams.find((stream) => stream.codec_type === 'video');
  const audio = parsed.streams.find((stream) => stream.codec_type === 'audio');
  const rate = (value) => {
    const [a, b] = String(value).split('/').map(Number);
    return Number.isFinite(b) && b !== 0 ? a / b : Number(value);
  };
  return {
    durationSeconds: Number(parsed.format.duration),
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    ...(video ? {
      width: Number(video.width),
      height: Number(video.height),
      videoFrameRate: rate(video.avg_frame_rate || video.r_frame_rate),
      videoFrameCount: Number(video.nb_read_frames || video.nb_frames),
    } : {}),
    ...(audio ? {audioSampleRate: Number(audio.sample_rate)} : {}),
  };
};

const fileRecord = (path, probe = false) => ({
  path,
  sha256: sha256File(path),
  ...(probe ? {ffprobe: ffprobe(path)} : {}),
});
const fakeFile = (path, probe = null) => ({path, sha256: HASH, ...(probe ? {ffprobe: probe} : {})});
const writeJsonRecord = (path, value) => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return fileRecord(path);
};

const nonSubstitutability = () => ({
  realMedia: {checked: true, evidence: '素材清单无对应真实镜头', whyInsufficient: '无法显示抽象因果链'},
  officialMaterial: {checked: true, evidence: '官方材料只有定义', whyInsufficient: '缺连续装配过程'},
  screenRecording: {checked: true, evidence: '录屏审计无该过程', whyInsufficient: '无对应真实界面'},
  remotion: {checked: true, evidence: '已做确定性排版压测', whyInsufficient: '需连续空间装配'},
  conclusion: '四类优先素材均不能解决当前认知障碍，才使用受控生成插片。',
});

const makeLogicalContract = (durationSeconds = 120) => ({
  schemaVersion: 'director-contract/v2',
  contractId: `fixture-director-${durationSeconds}`,
  executionGroupId: 'fixture-execution-group',
  authorizedUserId: 'fixture-authorized-user',
  evidenceScope: 'fixture-only',
  productionEligible: false,
  spokenSource: {
    audio: {...fakeFile('media/oral.m4a', {durationSeconds, hasAudio: true}), completeness: 'full-recording'},
    transcript: {
      ...fakeFile('transcript.json'), authority: 'recorded-audio', durationSeconds,
      segments: [{id: 't1', start: 0, end: durationSeconds, text: '完整口播逐字稿'}],
      words: [
        {id: 'w1', start: 0, end: 2, text: '录屏'},
        {id: 'w2', start: 2, end: 60, text: '真实证据'},
        {id: 'w3', start: 60, end: 65, text: '装配机制'},
        {id: 'w4', start: 65, end: durationSeconds, text: '回到结论'},
      ],
    },
  },
  semanticSegments: [{
    id: 's1', start: 0, end: durationSeconds, spokenLine: '完整口播逐字稿', semanticPurpose: '解释输入到结果的完整机制',
    transcriptSegmentIds: ['t1'], wordIds: ['w1', 'w2', 'w3', 'w4'],
  }],
  screenRecordings: [{
    id: 'screen-1', ...fakeFile('media/screen.mp4', {durationSeconds: 20, hasVideo: true, width: 1080, height: 1920, videoFrameRate: 30}), completeness: 'full-recording',
    segments: [
      {id: 'screen-used', start: 0, end: 2, disposition: 'used', semanticReason: '展示真实入口与字段位置'},
      {id: 'screen-excluded', start: 2, end: 20, disposition: 'excluded', semanticReason: '等待和重复滚动无认知增量'},
    ],
  }],
  screenMappings: [{
    id: 'map-1', recordingId: 'screen-1', recordingSegmentId: 'screen-used', sourceIn: 0, sourceOut: 2,
    outputIn: 0, outputOut: 2, playbackRate: 1, visualEventId: 'visual-screen',
    semanticSegmentIds: ['s1'], wordIds: ['w1'], selectionReason: '说到真实入口时展示对应录屏段。',
  }],
  screenPresentations: [{
    mappingId: 'map-1', sourceDimensions: {width: 1080, height: 1920}, targetDimensions: {width: 1920, height: 1080},
    fit: 'contain', crop: 'none', scale: 1,
  }],
  visualCoveragePolicy: {minFullCoverageRatio: 0.5, minPerSemanticSegmentRatio: 0.2, maxUnexplainedWindowSeconds: 15},
  visualEvents: [
    {id: 'visual-screen', start: 0, end: 2, kind: 'screen-recording', screenMappingId: 'map-1', semanticSegmentIds: ['s1'], wordIds: ['w1'], cognitiveGain: '展示真实界面'},
    {id: 'visual-2', start: 2, end: 60, kind: 'remotion-semantic', semanticSegmentIds: ['s1'], wordIds: ['w2'], cognitiveGain: '解释证据结构'},
    {id: 'visual-generated', start: 60, end: 65, kind: 'generated-video', generatedInsertionId: 'generated-1', semanticSegmentIds: ['s1'], wordIds: ['w3'], cognitiveGain: '显示连续装配'},
    {id: 'visual-4', start: 65, end: durationSeconds, kind: 'real-evidence', semanticSegmentIds: ['s1'], wordIds: ['w4'], cognitiveGain: '回到真实证据'},
  ],
  generatedInsertions: [{
    id: 'generated-1', producer: 'user', media: fakeFile('media/generated.mp4', {durationSeconds: 5, hasVideo: true, width: 1920, height: 1080, videoFrameRate: 30}),
    semanticSegmentIds: ['s1'], wordIds: ['w3'], enterAt: 60, exitAt: 65,
    cognitiveObstacle: {description: '口头描述看不出传递关系', transcriptQuote: '装配机制', evidenceWordIds: ['w3']},
    cognitiveGain: '显示节点按因果顺序连接', nonSubstitutability: nonSubstitutability(),
    authorization: {authorized: true, source: '用户在本任务内提供', scope: '当前候选预览', receipt: fakeFile('receipts/generated.txt')},
  }],
  sfxSubjectiveReview: {
    normalSpeed: true, reviewedBy: 'fixture-reviewer', reviewedAt: '2026-08-24T12:00:00+08:00', decision: 'accepted', notes: 'fixture 只验证逻辑合同。',
    withSound: fakeFile('preview/with.mp4', {durationSeconds: 30, hasVideo: true, width: 1920, height: 1080, videoFrameRate: 30}),
    withoutSound: {...fakeFile('preview/without.mp4', {durationSeconds: 30, hasVideo: true, width: 1920, height: 1080, videoFrameRate: 30}), sha256: 'b'.repeat(64)},
  },
  continuousSpeakerSafety: {
    source: fakeFile('media/speaker.mp4', {durationSeconds, hasVideo: true, width: 1920, height: 1080, videoFrameRate: 30}),
    sampleFrames: [0, durationSeconds / 2, durationSeconds - 1 / 30].map((at, index) => ({
      ...fakeFile(`speaker/${index}.png`), at, frameIndex: Math.round(at * 30), sourceVideoSha256: HASH,
      subjectBox: {x: 0.25, y: 0.1, width: 0.5, height: 0.8}, safeArea: {x: 0.12, y: 0.05, width: 0.76, height: 0.9}, inside: true,
      reviewedBy: 'fixture-reviewer', reviewedAt: '2026-08-24T12:00:00+08:00',
    })),
  },
  previewAB: {
    durationSeconds: 30, candidateRange: {start: 0, end: 30}, samePictureReceipt: fakeFile('preview/same-picture.json'),
    variants: [
      {id: 'A-with-sfx', ...fakeFile('preview/with.mp4', {durationSeconds: 30, hasVideo: true, width: 1920, height: 1080, videoFrameRate: 30})},
      {id: 'B-without-sfx', ...fakeFile('preview/without.mp4', {durationSeconds: 30, hasVideo: true, width: 1920, height: 1080, videoFrameRate: 30}), sha256: 'b'.repeat(64)},
    ],
  },
  formal: {enabled: false, lockReason: '风格晋级不等于正式任务授权。'},
  lifecycle: {
    state: 'candidate-blocked',
    candidate: {qualityClass: 'low-fidelity-prototype', range: {start: 0, end: 5}, media: fakeFile('media/candidate.mp4', {durationSeconds: 5, hasVideo: true, width: 160, height: 90, videoFrameRate: 2}), technicalQaStatus: 'pending'},
    styleAcceptance: {status: 'pending'},
  },
  rightsBoundary: {
    internalMechanismStudyOnly: true, copyBrandAssets: false, copySpecificLayouts: false, copySpecificShots: false, copyPhotographs: false,
    originalTransformationPlan: '只借鉴信息层级、连续装配与节奏机制，重新设计对象、版式、色彩和动作链。',
  },
});

const extractFrame = (videoPath, frameIndex, outputPath) => run('ffmpeg', [
  '-v', 'error', '-y', '-i', videoPath, '-vf', `select=eq(n\\,${frameIndex})`, '-vsync', '0', '-frames:v', '1', outputPath,
]);

const makeQaReceipt = (candidatePath, root) => {
  const metrics = computeDirectorMediaQaMetrics(candidatePath, {rootDir: root});
  return {
    schema: DIRECTOR_TECHNICAL_QA_SCHEMA,
    evidenceScope: 'real-e2e', status: 'passed', candidatePath, candidateSha256: sha256File(candidatePath),
    checks: {
      fullDecode: {passed: true, decodedFrameCount: metrics.decodedFrameCount},
      frameCount: {passed: true, ffprobeFrameCount: metrics.ffprobeFrameCount, expectedFrameCount: metrics.expectedFrameCount},
      blackWhite: {passed: true, blackFrameCount: metrics.blackFrameCount, whiteFrameCount: metrics.whiteFrameCount},
      freeze: {passed: true, maxConsecutiveIdenticalFrames: metrics.maxConsecutiveIdenticalFrames},
      duplicate: {passed: true, duplicateFrameCount: metrics.duplicateFrameCount, duplicateFrameRatio: metrics.duplicateFrameRatio},
      coverage: {passed: true, coveredFrameCount: metrics.decodedFrameCount, expectedFrameCount: metrics.expectedFrameCount},
      motion: {passed: true, uniqueFrameCount: metrics.uniqueFrameCount},
      videoTimelineSha256: metrics.videoTimelineSha256,
    },
  };
};

export const createActualFixture = ({rootOverride = null} = {}) => {
  const root = rootOverride ?? mkdtempSync(join(tmpdir(), 'director-contract-v2.'));
  const media = (name) => join(root, name);
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '30', '-c:a', 'aac', '-b:a', '48k', media('oral.m4a')]);
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30', '-t', '30', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '38', '-pix_fmt', 'yuv420p', '-an', media('candidate.mp4')]);
  run('ffmpeg', ['-v', 'error', '-y', '-i', media('candidate.mp4'), '-f', 'lavfi', '-i', 'sine=frequency=660:sample_rate=48000', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-t', '30', media('with-sfx.mp4')]);
  run('ffmpeg', ['-v', 'error', '-y', '-i', media('candidate.mp4'), '-map', '0:v:0', '-c:v', 'copy', '-metadata', 'comment=NoSfx', media('without-sfx.mp4')]);
  copyFileSync(media('candidate.mp4'), media('speaker.mp4'));
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30', '-t', '4', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '38', '-pix_fmt', 'yuv420p', '-an', media('screen.mp4')]);

  for (const [name, frameIndex] of [['risk-first', 0], ['risk-middle', 30], ['risk-last', 59], ['speaker-first', 0], ['speaker-middle', 450], ['speaker-last', 899]]) {
    extractFrame(media(name.startsWith('speaker') ? 'speaker.mp4' : 'candidate.mp4'), frameIndex, media(`${name}.png`));
  }
  const transcriptBody = {
    schema: DIRECTOR_TRANSCRIPT_SCHEMA, durationSeconds: 30,
    segments: [{id: 't1', start: 0, end: 30, text: '完整口播逐字稿'}],
    words: [
      {id: 'w1', start: 0, end: 2, text: '录屏'},
      {id: 'w2', start: 2, end: 10, text: '真实证据'},
      {id: 'w3', start: 10, end: 15, text: '装配机制'},
      {id: 'w4', start: 15, end: 30, text: '回到结论'},
    ],
  };
  writeJsonRecord(media('transcript.json'), transcriptBody);
  writeFileSync(media('generated-authorization.txt'), 'fixture validator authorization only\n');

  const contract = makeLogicalContract(30);
  contract.contractId = 'real-media-validator-fixture';
  contract.contractRevisionId = 'director-revision-001';
  contract.executionGroupId = 'executor-group';
  contract.authorizedUserId = 'authorized-user';
  contract.evidenceScope = 'real-e2e';
  contract.spokenSource.audio = {...fileRecord(media('oral.m4a'), true), completeness: 'full-recording'};
  contract.spokenSource.transcript = {...fileRecord(media('transcript.json')), authority: 'recorded-audio', ...transcriptBody};
  contract.semanticSegments[0] = {...contract.semanticSegments[0], end: 30};
  contract.screenRecordings[0] = {
    id: 'screen-1', ...fileRecord(media('screen.mp4'), true), completeness: 'full-recording',
    segments: [
      {id: 'screen-used', start: 0, end: 2, disposition: 'used', semanticReason: '展示真实入口与字段位置'},
      {id: 'screen-excluded', start: 2, end: 4, disposition: 'excluded', semanticReason: '后续重复滚动无认知增量'},
    ],
  };
  contract.screenMappings[0] = {...contract.screenMappings[0], sourceOut: 2, outputIn: 0, outputOut: 2, playbackRate: 1, visualEventId: 'visual-screen'};
  contract.visualEvents = [
    {id: 'visual-screen', start: 0, end: 2, kind: 'screen-recording', screenMappingId: 'map-1', semanticSegmentIds: ['s1'], wordIds: ['w1'], cognitiveGain: '显示真实入口'},
    {id: 'visual-2', start: 2, end: 10, kind: 'remotion-semantic', semanticSegmentIds: ['s1'], wordIds: ['w2'], cognitiveGain: '解释证据结构'},
    {id: 'visual-generated', start: 10, end: 15, kind: 'generated-video', generatedInsertionId: 'generated-1', semanticSegmentIds: ['s1'], wordIds: ['w3'], cognitiveGain: '显示抽象节点装配'},
    {id: 'visual-4', start: 15, end: 30, kind: 'real-evidence', semanticSegmentIds: ['s1'], wordIds: ['w4'], cognitiveGain: '回到真实证据'},
  ];
  contract.generatedInsertions[0] = {
    ...contract.generatedInsertions[0], media: fileRecord(media('candidate.mp4'), true), enterAt: 10, exitAt: 15,
    authorization: {authorized: true, source: '测试执行器创建的 fixture', scope: '仅 validator 真实文件回归', receipt: fileRecord(media('generated-authorization.txt'))},
  };
  const candidate = fileRecord(media('candidate.mp4'), true);
  const withSfx = fileRecord(media('with-sfx.mp4'), true);
  const withoutSfx = fileRecord(media('without-sfx.mp4'), true);
  contract.sfxSubjectiveReview = {
    normalSpeed: true, reviewedBy: 'authorized-user', reviewedAt: '2026-08-24T14:00:00+08:00', decision: 'accepted', notes: '验收 fixture 明确接受 A/B 音效关系。',
    withSound: withSfx, withoutSound: withoutSfx,
  };
  contract.continuousSpeakerSafety = {
    source: fileRecord(media('speaker.mp4'), true),
    sampleFrames: [
      {name: 'speaker-first', at: 0, frameIndex: 0},
      {name: 'speaker-middle', at: 15, frameIndex: 450},
      {name: 'speaker-last', at: 899 / 30, frameIndex: 899},
    ].map(({name, at, frameIndex}) => ({
      ...fileRecord(media(`${name}.png`)), at, frameIndex, sourceVideoSha256: sha256File(media('speaker.mp4')),
      subjectBox: {x: 0.25, y: 0.1, width: 0.5, height: 0.8}, safeArea: {x: 0.12, y: 0.05, width: 0.76, height: 0.9}, inside: true,
      reviewedBy: 'fixture-independent-reviewer', reviewedAt: '2026-08-24T14:00:00+08:00',
    })),
  };
  const timeline = computeDirectorMediaQaMetrics(media('candidate.mp4'), {rootDir: root});
  const samePicture = {
    schema: 'director-ab-picture-match/v2', evidenceScope: 'real-e2e', candidateSha256: candidate.sha256,
    withSfxSha256: withSfx.sha256, withoutSfxSha256: withoutSfx.sha256,
    decodedFrameCount: timeline.decodedFrameCount, videoTimelineSha256: timeline.videoTimelineSha256,
  };
  contract.previewAB = {
    durationSeconds: 30, candidateRange: {start: 0, end: 30}, samePictureReceipt: writeJsonRecord(media('same-picture.json'), samePicture),
    variants: [{id: 'A-with-sfx', ...withSfx}, {id: 'B-without-sfx', ...withoutSfx}],
  };
  const protectedElements = [
    {id: 'critical-text', kind: 'text', sourceBox: {x: 0.2, y: 0.1, width: 0.6, height: 0.15}},
    {id: 'primary-button', kind: 'button', sourceBox: {x: 0.2, y: 0.7, width: 0.6, height: 0.12}},
    {id: 'qr-code', kind: 'qr-code', sourceBox: {x: 0.7, y: 0.75, width: 0.2, height: 0.2}},
  ];
  const risk = (name, atSeconds, frameIndex) => ({
    ...fileRecord(media(`${name}.png`)), sourceVideoSha256: contract.screenRecordings[0].sha256, candidateVideoSha256: candidate.sha256,
    atSeconds, frameIndex, reviewedBy: 'fixture-independent-reviewer', reviewedAt: '2026-08-24T14:00:00+08:00',
    keyContentChecks: protectedElements.map(({id, kind}) => ({id, kind, visible: true, clipped: false})),
  });
  contract.screenPresentations[0] = {
    mappingId: 'map-1', sourceDimensions: {width: 1080, height: 1920}, targetDimensions: {width: 1920, height: 1080},
    fit: 'cover', crop: 'manual', scale: 1, focus: {x: 0.5, y: 0.5}, safeArea: {x: 0.08, y: 0.08, width: 0.84, height: 0.84},
    objectPosition: {x: 0.5, y: 0.5}, cropReason: '仅当三帧像素回归与关键内容复核均通过时允许 cover。', protectedElements,
    riskFrames: {
      first: risk('risk-first', 0, 0),
      middle: risk('risk-middle', 1, 30),
      last: risk('risk-last', 59 / 30, 59),
    },
  };
  const qaRecord = writeJsonRecord(media('technical-qa.json'), makeQaReceipt(media('candidate.mp4'), root));
  contract.lifecycle = {
    state: 'candidate-blocked',
    candidate: {qualityClass: 'reviewable-full-fidelity-sample', range: {start: 0, end: 30}, media: candidate, technicalQaStatus: 'passed', technicalQaReceipt: qaRecord},
    styleAcceptance: {status: 'pending'},
  };
  contract.productionEligible = false;
  const candidateBlockedContract = clone(contract);
  const candidateContractPath = media('candidate-contract.json');
  writeFileSync(candidateContractPath, `${JSON.stringify(candidateBlockedContract, null, 2)}\n`);
  contract.lifecycle.state = 'user-accepted-style';
  const acceptanceQuote = '我已用正常速度完整看完这条 30 秒候选片和有声/无声 A/B，确认接受该风格。';
  const humanBody = {
    schema: DIRECTOR_HUMAN_REVIEW_SCHEMA, evidenceScope: 'real-e2e', receiptId: 'human-review-001',
    authorizedUserId: 'authorized-user', reviewerId: 'authorized-user', issuerGroupId: 'user-acceptance-group',
    sourceThreadId: 'thread-user-001', sourceMessageId: 'message-user-001', explicitAcceptanceQuote: acceptanceQuote,
    sourceMessageSha256: sha256Text(acceptanceQuote), decision: 'accepted', accepted: true,
    contractRevisionId: contract.contractRevisionId,
    candidateMp4Sha256: candidate.sha256, technicalQaReceiptSha256: qaRecord.sha256,
    withSfxSha256: withSfx.sha256, withoutSfxSha256: withoutSfx.sha256,
    normalSpeed: true, fullWatchCompleted: true, watchedDurationSeconds: 30, candidateDurationSeconds: 30,
    sfxDecision: 'accepted', reviewedAt: '2026-08-24T14:00:00+08:00', expiresAt: '2099-08-24T14:00:00+08:00',
    validatorTestOnly: true, notProjectAcceptanceEvidence: true,
  };
  const humanRecord = writeJsonRecord(media('human-review.json'), humanBody);
  contract.lifecycle.styleAcceptance = {
    status: 'accepted',
    normalSpeedFullWatch: {completed: true, normalSpeed: true, decision: 'accepted', reviewer: 'authorized-user', reviewedAt: humanBody.reviewedAt, conclusion: acceptanceQuote, candidateMp4Sha256: candidate.sha256, fullDurationSeconds: 30},
    withSfxSha256: withSfx.sha256, withoutSfxSha256: withoutSfx.sha256, humanReviewReceipt: humanRecord,
  };
  const userAcceptedContract = clone(contract);

  contract.lifecycle.state = 'automation-handoff-eligible';
  contract.productionEligible = true;
  const supervisorQuote = '我作为独立监督验收人，已复核合同、候选片、技术 QA、用户完整观看和 A/B，接受进入自动化交接候选。';
  const supervisorBody = {
    schema: DIRECTOR_SUPERVISOR_REVIEW_SCHEMA, evidenceScope: 'real-e2e', receiptId: 'supervisor-review-001',
    supervisorId: 'independent-supervisor', issuerGroupId: 'supervision-group', sourceThreadId: 'thread-supervisor-001', sourceMessageId: 'message-supervisor-001',
    explicitAcceptanceQuote: supervisorQuote, sourceMessageSha256: sha256Text(supervisorQuote), decision: 'accepted', accepted: true,
    contractRevisionId: contract.contractRevisionId,
    contractSnapshotSha256: computeHandoffContractSnapshotSha256(contract), candidateMp4Sha256: candidate.sha256,
    handoffSupervisionBindingSha256: computeHandoffSupervisionBindingSha256(contract),
    technicalQaReceiptSha256: qaRecord.sha256, humanReviewReceiptSha256: humanRecord.sha256,
    withSfxSha256: withSfx.sha256, withoutSfxSha256: withoutSfx.sha256, reviewedAt: '2026-08-24T15:00:00+08:00',
    expiresAt: '2099-08-24T15:00:00+08:00',
    validatorTestOnly: true, notProjectAcceptanceEvidence: true,
  };
  const supervisorRecord = writeJsonRecord(media('supervisor-review.json'), supervisorBody);
  contract.lifecycle.handoff = {supervisorReviewReceipt: supervisorRecord};
  const bindingPayload = buildHandoffBindingPayload(contract);
  const bindingSha256 = computeHandoffBindingSha256(contract);
  const handoffBody = {
    schema: DIRECTOR_HANDOFF_RECEIPT_SCHEMA, evidenceScope: 'real-e2e', status: 'automation-handoff-eligible',
    contractRevisionId: contract.contractRevisionId,
    supervisionBindingSha256: computeHandoffSupervisionBindingSha256(contract),
    supervisorReviewReceiptSha256: supervisorRecord.sha256, bindingPayload, bindingSha256,
    validatorTestOnly: true, notProjectProductionHandoff: true,
  };
  const handoffRecord = writeJsonRecord(media('handoff.json'), handoffBody);
  Object.assign(contract.lifecycle.handoff, {receipt: handoffRecord, bindingPayload, bindingSha256});
  const contractPath = media('contract.json');
  writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  return {root, media, contract, contractPath, candidateBlockedContract, candidateContractPath, userAcceptedContract};
};

const tests = [];
const test = (id, name, fn, expectedCode = null) => tests.push({id, name, fn, expectedCode});
const expectCode = (contract, code, options = {checkFiles: false}) => {
  const result = validateDirectorContractV2(contract, options);
  assert.equal(result.ok, false, `期望失败：${code}`);
  assert.ok(result.errors.some((error) => error.code === code), `缺少 ${code}\n${JSON.stringify(result.errors, null, 2)}`);
  return result;
};

const makeSignedExternalAnchor = (receipt, kind) => {
  const {publicKey, privateKey} = generateKeyPairSync('ed25519');
  const receiptBindingPayload = buildDirectorExternalAnchorBindingPayloadV2(receipt, kind);
  const entry = {
    kind,
    status: 'accepted',
    sourceThreadId: receipt.sourceThreadId,
    sourceMessageId: receipt.sourceMessageId,
    sourceMessageSha256: receipt.sourceMessageSha256,
    issuerGroupId: receipt.issuerGroupId,
    explicitAcceptanceQuoteSha256: sha256Text(receipt.explicitAcceptanceQuote),
    receiptBindingPayload,
    receiptBindingSha256: stableJsonSha256(receiptBindingPayload),
    signerKeyId: 'independent-audit-key',
  };
  entry.signatureBase64 = sign(
    null,
    Buffer.from(serializeDirectorExternalAnchorEntryForSignatureV2(entry)),
    privateKey,
  ).toString('base64');
  return {entry, publicKey};
};

test('positive-logical-contract-low-screen-usage', '逻辑候选通过，录屏使用率只报告', () => {
  const result = validateDirectorContractV2(makeLogicalContract(), {checkFiles: false});
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.equal(result.report.screenRecordings[0].usageRatio, 0.1);
});

test('semantic-timeline-gap', '语义段空缺阻断', () => {
  const contract = makeLogicalContract();
  contract.semanticSegments[0].start = 1;
  expectCode(contract, 'DCV2_SEMANTIC_TIMELINE_INCOMPLETE');
}, 'DCV2_SEMANTIC_TIMELINE_INCOMPLETE');

test('transcript-word-timeline-overlap', 'word 时间重叠阻断', () => {
  const contract = makeLogicalContract();
  contract.spokenSource.transcript.words[1].start = 1;
  expectCode(contract, 'DCV2_TRANSCRIPT_WORD_TIMELINE_INVALID');
}, 'DCV2_TRANSCRIPT_WORD_TIMELINE_INVALID');

test('screen-recording-timeline-gap', '录屏全量分段空缺阻断', () => {
  const contract = makeLogicalContract();
  contract.screenRecordings[0].segments[1].start = 3;
  expectCode(contract, 'DCV2_SCREEN_TIMELINE_INCOMPLETE');
}, 'DCV2_SCREEN_TIMELINE_INCOMPLETE');

test('screen-output-timeline-missing', '录屏映射缺输出时间线阻断', () => {
  const contract = makeLogicalContract();
  delete contract.screenMappings[0].outputOut;
  expectCode(contract, 'DCV2_SCREEN_MAPPING_OUTPUT_RANGE_INVALID');
}, 'DCV2_SCREEN_MAPPING_OUTPUT_RANGE_INVALID');

test('screen-visual-event-unbound', '录屏映射未绑定 screen-recording 事件阻断', () => {
  const contract = makeLogicalContract();
  contract.screenMappings[0].visualEventId = 'visual-2';
  expectCode(contract, 'DCV2_SCREEN_MAPPING_VISUAL_EVENT_INVALID');
}, 'DCV2_SCREEN_MAPPING_VISUAL_EVENT_INVALID');

test('visual-event-word-time-disjoint', '视觉事件与真实词时段不重合阻断', () => {
  const contract = makeLogicalContract();
  contract.visualEvents[1].wordIds = ['w4'];
  expectCode(contract, 'DCV2_VISUAL_EVENT_WORD_TIME_DISJOINT');
}, 'DCV2_VISUAL_EVENT_WORD_TIME_DISJOINT');

for (const duration of [40.76, 20.16, 47.98, 105.8]) {
  test(`incident-empty-window-${duration}s`, `事故 ${duration}s 非语义空窗阻断`, () => {
    const contract = makeLogicalContract();
    contract.generatedInsertions = [];
    contract.visualCoveragePolicy.minFullCoverageRatio = 0.05;
    contract.visualCoveragePolicy.minPerSemanticSegmentRatio = 0.05;
    contract.visualEvents = [
      contract.visualEvents[0],
      {id: 'empty', start: 2, end: 2 + duration, kind: 'subtitle-only', semanticSegmentIds: ['s1'], wordIds: ['w2', 'w3', 'w4']},
      {id: 'after', start: 2 + duration, end: 120, kind: 'real-evidence', semanticSegmentIds: ['s1'], wordIds: ['w4'], cognitiveGain: '空窗后真实证据'},
    ];
    expectCode(contract, 'DCV2_VISUAL_MAX_GAP_EXCEEDED');
  }, 'DCV2_VISUAL_MAX_GAP_EXCEEDED');
}

test('portrait-contain-scaled', '竖屏 contain 被缩放阻断', () => {
  const contract = makeLogicalContract();
  contract.screenPresentations[0].scale = 1.2;
  expectCode(contract, 'DCV2_PORTRAIT_DEFAULT_TRANSFORM_INVALID');
}, 'DCV2_PORTRAIT_DEFAULT_TRANSFORM_INVALID');

test('generated-obstacle-evidence-missing', '生成插片缺认知障碍证据阻断', () => {
  const contract = makeLogicalContract();
  contract.generatedInsertions[0].cognitiveObstacle = null;
  expectCode(contract, 'DCV2_GENERATED_OBSTACLE_EVIDENCE_REQUIRED');
}, 'DCV2_GENERATED_OBSTACLE_EVIDENCE_REQUIRED');

test('sfx-revise-blocked', 'SFX decision=revise 阻断', () => {
  const contract = makeLogicalContract();
  contract.sfxSubjectiveReview.decision = 'revise';
  expectCode(contract, 'DCV2_SFX_REVIEW_REVISE_BLOCKED');
}, 'DCV2_SFX_REVIEW_REVISE_BLOCKED');

test('formal-manually-enabled', 'formal 手改开启阻断', () => {
  const contract = makeLogicalContract();
  contract.formal.enabled = true;
  expectCode(contract, 'DCV2_FORMAL_LOCK_REQUIRED');
}, 'DCV2_FORMAL_LOCK_REQUIRED');

test('retired-style-policy-integrated', '导演合同实际调用共享退役策略', () => {
  const contract = makeLogicalContract();
  contract.debugStyleId = 'koubo-paper-construct-v1';
  expectCode(contract, 'DCV2_RETIRED_GENERATED_STYLE');
}, 'DCV2_RETIRED_GENERATED_STYLE');

test('real-e2e-file-check-disabled', 'real-e2e 禁止 checkFiles=false', () => {
  const contract = makeLogicalContract();
  contract.evidenceScope = 'real-e2e';
  expectCode(contract, 'DCV2_REAL_E2E_FILE_CHECK_REQUIRED');
}, 'DCV2_REAL_E2E_FILE_CHECK_REQUIRED');

test('fixture-lifecycle-promotion-forbidden', 'fixture-only 不能进入晋级状态', () => {
  const contract = makeLogicalContract();
  contract.lifecycle.state = 'user-accepted-style';
  expectCode(contract, 'DCV2_FIXTURE_LIFECYCLE_ADVANCE_FORBIDDEN');
}, 'DCV2_FIXTURE_LIFECYCLE_ADVANCE_FORBIDDEN');

test('subtitle-camera-motion-not-effective-coverage', '字幕和纯运镜不算语义覆盖', () => {
  const result = analyzeVisualCoverage({durationSeconds: 40, semanticSegments: [{id: 's1', start: 0, end: 40}], visualEvents: [
    {start: 0, end: 5, kind: 'real-evidence'}, {start: 5, end: 20, kind: 'subtitle-only'},
    {start: 20, end: 30, kind: 'camera-motion-only'}, {start: 30, end: 40, kind: 'remotion-semantic'},
  ]});
  assert.deepEqual(result.maxUnexplainedWindow, {start: 5, end: 30, duration: 25});
});

test('independent-trust-root-outside-project', '签名公钥信任根固定在执行组项目之外并按系统权限验证', () => {
  const projectRoot = resolve(HERE, '../../..');
  assert.equal(DIRECTOR_EXTERNAL_TRUST_ROOT_PATH.startsWith(`${projectRoot}/`), false);
  const result = readDirectorIndependentTrustRootV2();
  if (result.ok) {
    assert.equal(result.path, DIRECTOR_EXTERNAL_TRUST_ROOT_PATH);
    assert.ok(result.keys.size > 0);
  } else {
    assert.match(result.reason, /blocked-no-independent-ed25519-key|root|信任根/iu);
  }
});

let actual;
test('actual-files-hash-ffprobe-cli', '真实 1920x1080/30fps/30s 文件、全解码、QA 与 CLI 通过', () => {
  actual = createActualFixture();
  const result = validateDirectorContractV2(actual.candidateBlockedContract, {rootDir: actual.root, checkFiles: true});
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  const cli = spawnSync(process.execPath, [CLI, actual.candidateContractPath, '--root', actual.root, '--json'], {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
  assert.equal(cli.status, 0, `${cli.stderr}\n${cli.stdout}`);
});

test('user-accepted-style-complete-independent-receipt', '执行器自造的“独立”人工回执无外部锚点仍被拒绝', () => {
  expectCode(actual.userAcceptedContract, 'DCV2_HUMAN_REVIEW_EXTERNAL_ANCHOR_INVALID', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_HUMAN_REVIEW_EXTERNAL_ANCHOR_INVALID');

test('human-arbitrary-json-self-sign-rejected', '任意 fixture JSON 不能冒充人工验收', () => {
  const contract = clone(actual.userAcceptedContract);
  contract.lifecycle.styleAcceptance.humanReviewReceipt = writeJsonRecord(actual.media('human-arbitrary.json'), {scope: 'fixture-only', decision: 'fixture-accepted-for-validator-test'});
  expectCode(contract, 'DCV2_HUMAN_REVIEW_RECEIPT_CONTENT_INVALID', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_HUMAN_REVIEW_RECEIPT_CONTENT_INVALID');

test('human-execution-group-self-sign-rejected', '执行组自签人工验收阻断', () => {
  const contract = clone(actual.userAcceptedContract);
  const body = JSON.parse(readFileSync(actual.media('human-review.json'), 'utf8'));
  body.issuerGroupId = contract.executionGroupId;
  contract.lifecycle.styleAcceptance.humanReviewReceipt = writeJsonRecord(actual.media('human-self-signed.json'), body);
  expectCode(contract, 'DCV2_HUMAN_REVIEW_RECEIPT_CONTENT_INVALID', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_HUMAN_REVIEW_RECEIPT_CONTENT_INVALID');

test('automation-handoff-complete-independent-supervision', '自造 validator/test 人工、监督和交接回执不得进入 automation-handoff-eligible', () => {
  const result = validateDirectorContractV2(actual.contract, {rootDir: actual.root, checkFiles: true});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === 'DCV2_HUMAN_REVIEW_EXTERNAL_ANCHOR_INVALID'));
  assert.ok(result.errors.some((error) => error.code === 'DCV2_SUPERVISOR_REVIEW_EXTERNAL_ANCHOR_INVALID'));
  assert.ok(result.errors.some((error) => error.code === 'DCV2_HANDOFF_RECEIPT_TEST_MARKER_FORBIDDEN'));
}, 'DCV2_HUMAN_REVIEW_EXTERNAL_ANCHOR_INVALID');

test('supervisor-execution-group-self-sign-rejected', '执行组自签监督验收阻断', () => {
  const contract = clone(actual.contract);
  const body = JSON.parse(readFileSync(actual.media('supervisor-review.json'), 'utf8'));
  body.issuerGroupId = contract.executionGroupId;
  contract.lifecycle.handoff.supervisorReviewReceipt = writeJsonRecord(actual.media('supervisor-self-signed.json'), body);
  expectCode(contract, 'DCV2_SUPERVISOR_REVIEW_RECEIPT_CONTENT_INVALID', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_SUPERVISOR_REVIEW_RECEIPT_CONTENT_INVALID');

test('supervisor-not-independent-message-rejected', '监督与用户验收复用同一消息阻断', () => {
  const contract = clone(actual.contract);
  const human = JSON.parse(readFileSync(actual.media('human-review.json'), 'utf8'));
  const body = JSON.parse(readFileSync(actual.media('supervisor-review.json'), 'utf8'));
  body.sourceThreadId = human.sourceThreadId;
  body.sourceMessageId = human.sourceMessageId;
  contract.lifecycle.handoff.supervisorReviewReceipt = writeJsonRecord(actual.media('supervisor-same-message.json'), body);
  expectCode(contract, 'DCV2_SUPERVISOR_REVIEW_RECEIPT_CONTENT_INVALID', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_SUPERVISOR_REVIEW_RECEIPT_CONTENT_INVALID');

test('low-fidelity-manual-promotion', '160x90/2fps/5s 低保真候选不能晋级', () => {
  const contract = clone(actual.userAcceptedContract);
  contract.lifecycle.candidate.qualityClass = 'low-fidelity-prototype';
  expectCode(contract, 'DCV2_LIFECYCLE_LOW_FIDELITY_CANNOT_ADVANCE', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_LIFECYCLE_LOW_FIDELITY_CANNOT_ADVANCE');

test('ab-actual-video-frames-different', 'A/B 声明同画面但实际帧不同时阻断', () => {
  const different = actual.media('different.mp4');
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30', '-t', '30', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '38', '-pix_fmt', 'yuv420p', '-an', different]);
  const contract = clone(actual.userAcceptedContract);
  const record = fileRecord(different, true);
  contract.previewAB.variants.find((item) => item.id === 'B-without-sfx').path = record.path;
  contract.previewAB.variants.find((item) => item.id === 'B-without-sfx').sha256 = record.sha256;
  contract.previewAB.variants.find((item) => item.id === 'B-without-sfx').ffprobe = record.ffprobe;
  contract.sfxSubjectiveReview.withoutSound = record;
  expectCode(contract, 'DCV2_PREVIEW_ACTUAL_VIDEO_FRAMES_MISMATCH', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_PREVIEW_ACTUAL_VIDEO_FRAMES_MISMATCH');

test('ab-audio-track-relation-invalid', 'WithSfx 无音轨或 NoSfx 有音轨阻断', () => {
  const contract = clone(actual.userAcceptedContract);
  const noSound = contract.previewAB.variants.find((item) => item.id === 'B-without-sfx');
  contract.sfxSubjectiveReview.withSound = noSound;
  expectCode(contract, 'DCV2_SFX_AUDIO_TRACK_RELATION_INVALID', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_SFX_AUDIO_TRACK_RELATION_INVALID');

test('technical-qa-fake-metrics-rejected', '技术 QA 伪造全解码/重复帧指标阻断', () => {
  const contract = clone(actual.userAcceptedContract);
  const body = JSON.parse(readFileSync(actual.media('technical-qa.json'), 'utf8'));
  body.checks.fullDecode.decodedFrameCount -= 1;
  contract.lifecycle.candidate.technicalQaReceipt = writeJsonRecord(actual.media('qa-fake.json'), body);
  expectCode(contract, 'DCV2_TECHNICAL_QA_METRICS_MISMATCH', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_TECHNICAL_QA_METRICS_MISMATCH');

test('transcript-file-content-divergence', '合同逐字稿与真实文件正文不一致阻断', () => {
  const contract = clone(actual.userAcceptedContract);
  const body = JSON.parse(readFileSync(actual.media('transcript.json'), 'utf8'));
  body.words[0].text = '被篡改';
  contract.spokenSource.transcript.path = actual.media('transcript-tampered.json');
  contract.spokenSource.transcript.sha256 = writeJsonRecord(contract.spokenSource.transcript.path, body).sha256;
  expectCode(contract, 'DCV2_TRANSCRIPT_FILE_BINDING_MISMATCH', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_TRANSCRIPT_FILE_BINDING_MISMATCH');

test('risk-frame-unrelated-pixels-rejected', '风险帧复用无关图像阻断', () => {
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=red:s=1920x1080', '-frames:v', '1', actual.media('unrelated.png')]);
  const contract = clone(actual.userAcceptedContract);
  const record = fileRecord(actual.media('unrelated.png'));
  Object.assign(contract.screenPresentations[0].riskFrames.middle, record);
  expectCode(contract, 'DCV2_PORTRAIT_RISK_FRAME_PIXEL_MISMATCH', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_PORTRAIT_RISK_FRAME_PIXEL_MISMATCH');

test('speaker-frame-unrelated-pixels-rejected', '人物安全区样帧非实际源帧阻断', () => {
  const contract = clone(actual.userAcceptedContract);
  const record = fileRecord(actual.media('unrelated.png'));
  Object.assign(contract.continuousSpeakerSafety.sampleFrames[1], record);
  expectCode(contract, 'DCV2_SPEAKER_SAMPLE_FRAME_PIXEL_MISMATCH', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_SPEAKER_SAMPLE_FRAME_PIXEL_MISMATCH');

test('signed-anchor-candidate-sha-reuse-rejected', '有效 Ed25519 锚点不能换绑另一候选片 SHA', () => {
  const receipt = JSON.parse(readFileSync(actual.media('human-review.json'), 'utf8'));
  delete receipt.validatorTestOnly;
  delete receipt.notProjectAcceptanceEvidence;
  const signed = makeSignedExternalAnchor(receipt, 'human-style-acceptance');
  assert.equal(verifyDirectorExternalAnchorEntryV2({receipt, kind: 'human-style-acceptance', ...signed}).ok, true);
  const tampered = {...receipt, candidateMp4Sha256: '0'.repeat(64)};
  const rejected = verifyDirectorExternalAnchorEntryV2({receipt: tampered, kind: 'human-style-acceptance', ...signed});
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /未逐项绑定/);
});

test('signed-anchor-revision-reuse-rejected', '有效 Ed25519 锚点不能换绑另一合同修订', () => {
  const receipt = JSON.parse(readFileSync(actual.media('supervisor-review.json'), 'utf8'));
  delete receipt.validatorTestOnly;
  delete receipt.notProjectAcceptanceEvidence;
  const signed = makeSignedExternalAnchor(receipt, 'supervisor-handoff-acceptance');
  assert.equal(verifyDirectorExternalAnchorEntryV2({receipt, kind: 'supervisor-handoff-acceptance', ...signed}).ok, true);
  const tampered = {...receipt, contractRevisionId: 'director-revision-002'};
  const rejected = verifyDirectorExternalAnchorEntryV2({receipt: tampered, kind: 'supervisor-handoff-acceptance', ...signed});
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /未逐项绑定/);
});

test('handoff-binding-tampered', '交接稳定哈希篡改阻断', () => {
  const contract = clone(actual.contract);
  contract.lifecycle.handoff.bindingSha256 = '0'.repeat(64);
  expectCode(contract, 'DCV2_LIFECYCLE_HANDOFF_BINDING_INVALID', {rootDir: actual.root, checkFiles: true});
}, 'DCV2_LIFECYCLE_HANDOFF_BINDING_INVALID');

test('cli-formal-unlocked', 'CLI formal 解锁退出码 1', () => {
  const contract = clone(actual.userAcceptedContract);
  contract.formal.enabled = true;
  const path = actual.media('formal-unlocked.json');
  writeFileSync(path, `${JSON.stringify(contract, null, 2)}\n`);
  const result = spawnSync(process.execPath, [CLI, path, '--root', actual.root, '--json'], {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
  assert.equal(result.status, 1);
  assert.ok(JSON.parse(result.stdout).errors.some((error) => error.code === 'DCV2_FORMAL_LOCK_REQUIRED'));
}, 'DCV2_FORMAL_LOCK_REQUIRED');

if (resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url))) {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  assert.equal(manifest.schemaVersion, 'director-contract-regression-manifest/v2');
  assert.equal(manifest.noSkippedCases, true);
  const declared = new Map(manifest.cases.map((item) => [item.id, item]));
  assert.deepEqual([...declared.keys()].sort(), tests.map((item) => item.id).sort(), '事故 manifest 必须与实际注册测试 ID 全集一致');
  for (const item of tests) {
    const declaration = declared.get(item.id);
    if (item.expectedCode) assert.equal(declaration.expectedCode, item.expectedCode, `${item.id} manifest 错误码漂移`);
  }

  let failures = 0;
  const executed = new Set();
  for (const item of tests) {
    try {
      await item.fn();
      executed.add(item.id);
      process.stdout.write(`PASS ${item.id} ${item.name}\n`);
    } catch (error) {
      failures += 1;
      executed.add(item.id);
      process.stderr.write(`FAIL ${item.id} ${item.name}\n${error.stack || error.message}\n`);
    }
  }
  assert.deepEqual([...executed].sort(), tests.map((item) => item.id).sort(), '测试执行器不得 skip manifest 用例');
  if (actual?.root) rmSync(actual.root, {recursive: true, force: true});
  process.stdout.write(`RESULT ${tests.length - failures}/${tests.length} passed; skipped=0; manifest=${manifest.cases.length}/${tests.length}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
