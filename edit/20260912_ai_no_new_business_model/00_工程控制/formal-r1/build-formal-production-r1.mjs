#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {createInterface} from 'node:readline';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  SCOPED_DIRECT_EXPORT_GATE_FILES,
  collectScopedDirectExportBindings,
  resolveScopedDirectExportProfile,
} from '../../../../tools/scoped-direct-export-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const EPISODE_ID = '20260912_ai_no_new_business_model';
const EPISODE = `edit/${EPISODE_ID}`;
const CONTROL = `${EPISODE}/00_工程控制/formal-r1`;
const POSTSHOOT = `${EPISODE}/03_导演拆解/postshoot-formal-r1`;
const CANONICAL = `${EPISODE}/05_实录与字幕/canonical-r2`;
const PUBLIC_DIR = 'remotion/public-ai-no-new-business-model-v8-r1';
const JOB_PATH = 'workflow/jobs/20260912_ai_no_new_business_model_v8_r1.production.json';
const CURRENT_ROLLOUT =
  '/Users/pc/.codex/sessions/2026/09/11/rollout-2026-09-11T19-21-27-01a09033-794b-7dc2-a53d-19afbccec54e.jsonl';

const AUDIO_DECISION_PATH = `${CONTROL}/audio-review-user-decision.v1.json`;
const B23_DECISION_PATH = `${CONTROL}/b23-correction-card-user-approval.v1.json`;
const REVIEW_MANIFEST_PATH = `${EPISODE}/05_实录与字幕/review-pack-r1/manifest.v1.json`;
const CANDIDATE_CAPTIONS_PATH = `${EPISODE}/05_实录与字幕/canonical-r1/actual-spoken.bilingual.candidate.v1.json`;
const CANDIDATE_TIMELINE_PATH = `${EPISODE}/05_实录与字幕/canonical-r1/spoken-timeline.candidate.v1.json`;
const TRANSCRIPTION_REVIEW_PATH = `${EPISODE}/05_实录与字幕/canonical-r1/transcription-review.v1.json`;
const RAW_ASR_PATH =
  `${EPISODE}/05_实录与字幕/asr-large-v3-turbo-r1/host.mlx-whisper-large-v3-turbo.full.raw.json`;
const CANDIDATE_PLAN_PATH = `${PUBLIC_DIR}/data/candidate-plan.v1.json`;
const RUNTIME_PATH =
  'remotion/src/ai-no-new-business-model-v8-candidate-r1/AINoNewBusinessModelV8CandidateR1.tsx';
const PUBLIC_FORMAL_CAPTIONS_PATH =
  `${PUBLIC_DIR}/data/actual-spoken.bilingual.formal.v1.json`;

const TRANSCRIPT_PATH = `${CANONICAL}/canonical-transcript.formal.v1.json`;
const CAPTIONS_PATH = `${CANONICAL}/actual-spoken.bilingual.formal.v1.json`;
const POLICY_PATH = `${CANONICAL}/spoken-source-policy.v1.json`;
const RESOLUTION_PATH = `${CANONICAL}/focused-audio-review-resolution.v1.json`;
const VISUAL_PLAN_PATH = `${CONTROL}/visual-plan.formal-r1.json`;
const SFX_CUE_PATH = `${CONTROL}/sfx-cues.formal-r1.json`;
const DIRECT_EXPORT_EVIDENCE_PATH = `${CONTROL}/direct-export-user-events.sanitized.jsonl`;
const DIRECT_EXPORT_PROVENANCE_PATH = `${CONTROL}/direct-export-user-events.provenance.json`;
const MANIFEST_PATH = `${CONTROL}/scoped-direct-export.v1.json`;
const BUILD_RECEIPT_PATH = `${CONTROL}/formal-build-draft-receipt.v1.json`;

const POST_REQUEST_PATH = `${POSTSHOOT}/manual-postshoot-request.v1.json`;
const POST_PLAN_PATH = `${POSTSHOOT}/manual-postshoot-plan.v1.json`;
const POST_RECEIPT_PATH = `${POSTSHOOT}/manual-postshoot-validation.v1.json`;

const RAW_OUTPUT =
  `${EPISODE}/08_正式成片/AI并没有发明新的商业模式_16x9_V8_R1_有音效_正式渲染原始音轨_v1.mp4`;
const FINAL_OUTPUT =
  `${EPISODE}/08_正式成片/AI并没有发明新的商业模式_16x9_V8_R1_有音效_正式候选_v1.mp4`;
const QA_DIR = `${EPISODE}/07_预览与质检/formal-r1`;

const REQUIRED_REVIEW_IDS = Object.freeze(['U04', 'U05', 'U08', 'U09']);
const DECISION_TOKEN_BY_ID = Object.freeze({
  U04: Object.freeze({
    '经济地理的重现': '重现',
    '经济地理的重写': '重写',
  }),
  U05: Object.freeze({
    '被浪费的流量被重新计划': '重新计划',
    '被浪费的流量被重新激活': '重新激活',
  }),
  U08: Object.freeze({
    '真正需要人类判断的内部': '内部',
    '真正需要人类判断的那部分': '那部分',
  }),
  U09: Object.freeze({
    '我是超哥，在兰州，也在创业': '也在创业',
    '我是超哥，在兰州AI创业': 'AI创业',
  }),
});
const B23_CORRECTION = Object.freeze({
  title: '扫描 → 分析 → 洞察 → 初稿',
  subtitle: '本条未做同任务受控计时，“几小时”不作为事实结论',
});
const FORMAL_CAPTION_SOURCE = 'data/actual-spoken.bilingual.formal.v1.json';
const SHA256 = /^[a-f0-9]{64}$/u;
const ZERO_SHA256 = '0'.repeat(64);
const hashCache = new Map();

const fail = (code, message, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
};

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

const projectPath = (pathValue, {mustExist = true} = {}) => {
  if (!isText(pathValue) || isAbsolute(pathValue) || pathValue.includes('\\')) {
    fail('FORMAL_PATH', `只接受项目相对路径：${String(pathValue)}`);
  }
  const absolute = resolve(ROOT, pathValue);
  const normalized = relative(ROOT, absolute).split(sep).join('/');
  if (normalized !== pathValue || normalized.startsWith('../') || !normalized) {
    fail('FORMAL_PATH', `路径越界或不规范：${pathValue}`);
  }
  if (mustExist && !existsSync(absolute)) {
    fail('FORMAL_FILE_MISSING', `缺少文件：${pathValue}`);
  }
  return absolute;
};

const readJson = (pathValue) => {
  const absolute = projectPath(pathValue);
  try {
    return JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    fail('FORMAL_JSON', `JSON 无法读取：${pathValue}；${error.message}`);
  }
};

const sha256 = (pathValue) => {
  const absolute = projectPath(pathValue);
  const stat = statSync(absolute);
  if (!stat.isFile()) fail('FORMAL_REGULAR_FILE', `必须是普通文件：${pathValue}`);
  const cacheKey = `${absolute}:${stat.size}:${stat.mtimeMs}`;
  if (!hashCache.has(cacheKey)) {
    hashCache.set(
      cacheKey,
      createHash('sha256').update(readFileSync(absolute)).digest('hex'),
    );
  }
  return hashCache.get(cacheKey);
};

const ref = (pathValue) => ({path: pathValue, sha256: sha256(pathValue)});

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const writeAtomic = (pathValue, bytes) => {
  const absolute = projectPath(pathValue, {mustExist: false});
  mkdirSync(dirname(absolute), {recursive: true});
  const temporary = `${absolute}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, bytes);
    renameSync(temporary, absolute);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
};
const writeJson = (pathValue, value) => writeAtomic(pathValue, stableJson(value));

const requireDecisionFilesBeforeAnyOutput = () => {
  const missing = [AUDIO_DECISION_PATH, B23_DECISION_PATH].filter(
    (pathValue) => !existsSync(projectPath(pathValue, {mustExist: false})),
  );
  if (missing.length > 0) {
    fail(
      'FORMAL_USER_DECISIONS_REQUIRED',
      '正式构建保持关闭：必须先有两份真实用户决定回执，脚本不会生成 job 或 scoped manifest。',
      {
        missing,
        audioReceiptContract: {
          schemaVersion: 'koubo-audio-review-user-decision/v1',
          requiredIds: REQUIRED_REVIEW_IDS,
          mustBind: REVIEW_MANIFEST_PATH,
          evidence: '真实 Codex rollout 中 role=user 的完整原话，且原话须逐项包含与完整候选唯一对应的选择词',
        },
        b23ReceiptContract: {
          schemaVersion: 'koubo-b23-correction-card-user-approval/v1',
          exactCorrectionCard: B23_CORRECTION,
          evidence:
            '当前真实 Codex rollout 中含完整更正卡的 role=assistant 提问，以及紧随其后的 role=user 明确同意',
        },
      },
    );
  }
};

const userTextFromEvent = (event) => {
  if (event?.type === 'event_msg' && event.payload?.type === 'user_message') {
    if (!isText(event.payload.message)) fail('FORMAL_USER_EVENT', 'user_message 没有正文。');
    return event.payload.message;
  }
  if (
    event?.type === 'response_item' &&
    event.payload?.type === 'message' &&
    event.payload?.role === 'user' &&
    Array.isArray(event.payload.content)
  ) {
    const text = event.payload.content
      .filter((item) => ['input_text', 'text'].includes(item?.type))
      .map((item) => String(item.text ?? ''))
      .join('\n');
    if (!isText(text)) fail('FORMAL_USER_EVENT', 'user message 没有可用文字。');
    return text;
  }
  fail('FORMAL_USER_EVENT', '证据必须是真实 role=user 消息，不接受助手总结、工具输出或压缩摘要。');
};

const extractUserEvents = async (sourceRollout, wantedOrdinals) => {
  if (sourceRollout !== CURRENT_ROLLOUT || !isAbsolute(sourceRollout)) {
    fail('FORMAL_ROLLOUT_SCOPE', `本期只接受当前真实 rollout：${CURRENT_ROLLOUT}`);
  }
  if (!existsSync(sourceRollout) || !statSync(sourceRollout).isFile()) {
    fail('FORMAL_ROLLOUT_MISSING', `当前 rollout 不存在：${sourceRollout}`);
  }
  const wanted = new Set(wantedOrdinals);
  const found = new Map();
  const input = createInterface({
    input: createReadStream(sourceRollout),
    crlfDelay: Infinity,
  });
  for await (const raw of input) {
    if (![...wanted].some((ordinal) => raw.includes(`"ordinal":${ordinal}`))) continue;
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!wanted.has(event.ordinal)) continue;
    const text = userTextFromEvent(event);
    found.set(event.ordinal, {
      timestamp: event.timestamp,
      ordinal: event.ordinal,
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{type: 'input_text', text}],
      },
      text,
    });
  }
  const missing = [...wanted].filter((ordinal) => !found.has(ordinal));
  if (missing.length > 0) {
    fail('FORMAL_USER_EVENT_MISSING', `rollout 中未找到真实 user 消息：${missing.join(', ')}`);
  }
  return found;
};

const extractAssistantEvent = async (sourceRollout, wantedOrdinal) => {
  if (sourceRollout !== CURRENT_ROLLOUT || !isAbsolute(sourceRollout)) {
    fail('FORMAL_ROLLOUT_SCOPE', `本期只接受当前真实 rollout：${CURRENT_ROLLOUT}`);
  }
  if (!Number.isInteger(wantedOrdinal) || wantedOrdinal < 1) {
    fail('FORMAL_ASSISTANT_EVENT', 'B23 提问缺少有效 assistant ordinal。');
  }
  const input = createInterface({
    input: createReadStream(sourceRollout),
    crlfDelay: Infinity,
  });
  for await (const raw of input) {
    if (!raw.includes(`"ordinal":${wantedOrdinal}`)) continue;
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }
    if (
      event.ordinal !== wantedOrdinal ||
      event.type !== 'response_item' ||
      event.payload?.type !== 'message' ||
      event.payload?.role !== 'assistant' ||
      !Array.isArray(event.payload.content)
    ) {
      continue;
    }
    const text = event.payload.content
      .filter((item) => item?.type === 'output_text')
      .map((item) => String(item.text ?? ''))
      .join('\n');
    if (!isText(text)) fail('FORMAL_ASSISTANT_EVENT', 'B23 提问没有可用正文。');
    return {ordinal: event.ordinal, timestamp: event.timestamp, text};
  }
  fail('FORMAL_ASSISTANT_EVENT_MISSING', `rollout 中未找到 assistant 消息：${wantedOrdinal}`);
};

const assertReceiptBase = (receipt, expectedSchema, label) => {
  if (!isRecord(receipt) || receipt.schemaVersion !== expectedSchema) {
    fail('FORMAL_DECISION_SCHEMA', `${label} schemaVersion 必须为 ${expectedSchema}`);
  }
  if (receipt.episodeId !== EPISODE_ID || receipt.status !== 'user-confirmed') {
    fail('FORMAL_DECISION_SCOPE', `${label} 必须绑定本期且 status=user-confirmed。`);
  }
  if (receipt.sourceRollout !== CURRENT_ROLLOUT) {
    fail('FORMAL_DECISION_SOURCE', `${label} 必须绑定当前真实 rollout。`);
  }
  if (!Number.isInteger(receipt.userMessageOrdinal) || receipt.userMessageOrdinal < 1) {
    fail('FORMAL_DECISION_SOURCE', `${label} 缺少真实 userMessageOrdinal。`);
  }
  if (!isText(receipt.userQuote)) {
    fail('FORMAL_DECISION_SOURCE', `${label} 缺少用户完整原话。`);
  }
};

const assertAudioDecision = (receipt, reviewManifest) => {
  assertReceiptBase(receipt, 'koubo-audio-review-user-decision/v1', '四处原声听辨回执');
  if (
    receipt.humanListeningPerformed !== true ||
    receipt.userAudioReviewConfirmed !== true ||
    receipt.formalCandidateUseApproved !== true
  ) {
    fail('FORMAL_AUDIO_DECISION', '四处回执必须明确实际听辨、用户确认及正式候选使用批准。');
  }
  const expectedReviewRef = ref(REVIEW_MANIFEST_PATH);
  if (
    receipt.reviewPackManifest?.path !== expectedReviewRef.path ||
    receipt.reviewPackManifest?.sha256 !== expectedReviewRef.sha256
  ) {
    fail('FORMAL_AUDIO_REVIEW_BINDING', '四处回执未精确绑定当前 review-pack manifest SHA-256。');
  }
  const reviewById = new Map(reviewManifest.items.map((item) => [item.id, item]));
  if (!Array.isArray(receipt.decisions) || receipt.decisions.length !== REQUIRED_REVIEW_IDS.length) {
    fail('FORMAL_AUDIO_DECISION', `四处回执必须且只能含 ${REQUIRED_REVIEW_IDS.join('、')}。`);
  }
  const decisionById = new Map();
  for (const decision of receipt.decisions) {
    if (!REQUIRED_REVIEW_IDS.includes(decision?.id) || decisionById.has(decision.id)) {
      fail('FORMAL_AUDIO_DECISION', `听辨 ID 缺失、重复或越界：${String(decision?.id)}`);
    }
    const review = reviewById.get(decision.id);
    const allowed = review?.candidates ?? [];
    if (!allowed.includes(decision.selectedText)) {
      fail(
        'FORMAL_AUDIO_DECISION',
        `${decision.id} 所选说法不在实际 review-pack 候选中：${String(decision.selectedText)}`,
      );
    }
    const expectedToken = DECISION_TOKEN_BY_ID[decision.id]?.[decision.selectedText];
    if (!expectedToken || decision.userToken !== expectedToken) {
      fail(
        'FORMAL_AUDIO_DECISION_TOKEN',
        `${decision.id} 的 userToken 未与所选完整说法建立唯一对应。`,
      );
    }
    if (!receipt.userQuote.includes(expectedToken)) {
      fail('FORMAL_AUDIO_QUOTE', `${decision.id} 的用户选择词没有逐字出现在用户原话中。`);
    }
    decisionById.set(decision.id, decision);
  }
  for (const id of REQUIRED_REVIEW_IDS) {
    if (!decisionById.has(id)) fail('FORMAL_AUDIO_DECISION', `缺少 ${id} 的听辨决定。`);
  }
  return decisionById;
};

const assertB23Decision = (receipt, candidatePlan) => {
  assertReceiptBase(receipt, 'koubo-b23-correction-card-user-approval/v1', 'B23 更正卡回执');
  if (
    receipt.approved !== true ||
    receipt.formalCandidateUseApproved !== true ||
    receipt.claimTreatment !== 'visible-correction-card'
  ) {
    fail('FORMAL_B23_DECISION', 'B23 回执必须明确批准可见更正卡用于正式候选。');
  }
  if (
    receipt.correctionCard?.title !== B23_CORRECTION.title ||
    receipt.correctionCard?.subtitle !== B23_CORRECTION.subtitle
  ) {
    fail('FORMAL_B23_DECISION', 'B23 回执中的更正卡文案不是本期固定更正。');
  }
  if (receipt.approvalToken !== '同意' || !receipt.userQuote.includes(receipt.approvalToken)) {
    fail('FORMAL_B23_QUOTE', '用户原话必须包含本次唯一批准词“同意”。');
  }
  if (
    receipt.promptSourceRollout !== CURRENT_ROLLOUT ||
    !Number.isInteger(receipt.promptAssistantOrdinal) ||
    !isText(receipt.promptQuote) ||
    !receipt.promptQuote.includes(B23_CORRECTION.subtitle) ||
    !receipt.promptQuote.includes('是否同意')
  ) {
    fail('FORMAL_B23_PROMPT_BINDING', 'B23 同意必须绑定含完整更正卡的当前 assistant 提问。');
  }
  const runtimeCard = candidatePlan.speakerOverlays?.find((item) => item.id === 'O11');
  if (
    runtimeCard?.beatId !== 'B23' ||
    runtimeCard.title !== B23_CORRECTION.title ||
    runtimeCard.subtitle !== B23_CORRECTION.subtitle
  ) {
    fail(
      'FORMAL_B23_RUNTIME_SYNC_REQUIRED',
      '当前 candidate-plan 的 O11 尚未精确同步用户批准的 B23 可见更正卡；禁止只在合同里写已更正。',
      {expected: B23_CORRECTION, actual: runtimeCard ?? null},
    );
  }
};

const assertActualRuntimeSync = (candidatePlan) => {
  const invalidCues = (candidatePlan.sfxCues ?? [])
    .filter((cue) => !Number.isFinite(cue.volume) || cue.volume < 0.2 || cue.volume > 0.55)
    .map((cue) => ({id: cue.id, volume: cue.volume, src: cue.src}));
  if (invalidCues.length > 0) {
    fail(
      'FORMAL_SFX_RUNTIME_SYNC_REQUIRED',
      '当前运行时音效仍有不在 V8 正式范围 0.20–0.55 的点；禁止在正式 cue sheet 中虚报别的音量。',
      {invalidCues},
    );
  }
  for (const cue of candidatePlan.sfxCues ?? []) {
    projectPath(`${PUBLIC_DIR}/${cue.src}`);
  }
  const runtime = readFileSync(projectPath(RUNTIME_PATH), 'utf8');
  if (!runtime.includes(`captionsSrc: '${FORMAL_CAPTION_SOURCE}'`)) {
    fail(
      'FORMAL_CAPTION_RUNTIME_SYNC_REQUIRED',
      `当前 Remotion runtime 仍读取候选字幕；必须精确切换为 ${FORMAL_CAPTION_SOURCE} 后再构建。`,
    );
  }
};

const PAGE_TRANSLATIONS = Object.freeze({
  U04: {
    '经济地理的重现': 'But the change in cost structure caused economic geography to re-emerge.',
    '经济地理的重写': 'But the change in cost structure brought about a rewriting of economic geography.',
  },
  U05: {
    '被浪费的流量被重新计划': 'Traffic once wasted because it could not be found is replanned.',
    '被浪费的流量被重新激活': 'Traffic once wasted because it could not be found is reactivated.',
  },
  U08: {
    '真正需要人类判断的内部': 'freeing the consultant’s energy inside the work that truly needs human judgment.',
    '真正需要人类判断的那部分': 'freeing the consultant’s energy for the part that truly needs human judgment.',
  },
  U09: {
    '我是超哥，在兰州，也在创业': 'also building a business.',
    '我是超哥，在兰州AI创业': 'building an AI venture.',
  },
});

const pageReplacementFor = (id, selectedText) => {
  if (id !== 'U09') return selectedText;
  return selectedText === '我是超哥，在兰州AI创业' ? 'AI创业' : '也在创业';
};

const MACHINE_TRANSCRIPT_NORMALIZATIONS = Object.freeze([
  {id: 'N01', pageId: 'cap-b03-p02', from: '他们', to: '它们', evidence: '本句指代前文宏大叙事词语。'},
  {id: 'N02', pageId: 'cap-b05-p01', from: '20', to: '二十', evidence: '同一中文读音的显示正字统一，不改变实际口播信息。'},
  {id: 'C01', pageId: 'cap-b06-p01', from: '暗需经济', to: '按需经济'},
  {id: 'C02', pageId: 'cap-b06-p02', from: '可交易的运营', to: '可交易的运力'},
  {id: 'N03', pageId: 'cap-b06-p04', from: '他们', to: '它们', evidence: '本句指代供给方式。'},
  {id: 'C03', pageId: 'cap-b06-p05', from: '买段', to: '买断'},
  {id: 'N04', pageId: 'cap-b06-p07', from: '他们', to: '它们', evidence: '本句指代 SaaS 交付方式。'},
  {id: 'N05', pageId: 'cap-b07-p02', from: '他们', to: '它们', evidence: '本句指代前述创新。'},
  {id: 'N06', pageId: 'cap-b09-p01', from: '他', to: '它', evidence: '本句主语为 AI。'},
  {id: 'N07', pageId: 'cap-b10-p01', from: '他', to: '它', evidence: '本句主语为 AI。'},
  {id: 'C04', pageId: 'cap-b11-p01', from: '贬值AI的价值', to: '贬低AI的价值'},
  {id: 'C05', pageId: 'cap-b15-p04', from: 'AA', to: 'AI'},
  {id: 'C06', pageId: 'cap-b15-p04', from: '如出一转', to: '如出一辙'},
  {id: 'C07', pageId: 'cap-b18-p02', from: '异象匹配', to: '意图匹配'},
  {id: 'C08', pageId: 'cap-b18-p07', from: '半页总形', to: '半夜总醒'},
  {id: 'N08', pageId: 'cap-b19-p06', from: '大幅的挤压', to: '大幅地挤压', evidence: '按句法作同音正字，不改变实际口播信息。'},
  {id: 'C09', pageId: 'cap-b23-p02', from: '专业调效', to: '专业调校'},
  {id: 'C10', pageId: 'cap-b23-p06', from: '报告出稿', to: '报告初稿'},
  {id: 'C11', pageId: 'cap-b24-p03', from: '交付把控上', to: '交付把控者'},
  {id: 'C12', pageId: 'cap-b29-p02', from: '常见的一个物件', to: '常见的一个误解'},
  {id: 'C13', pageId: 'cap-b29-p03', from: '港口收费驱通', to: '港口收费趋同'},
  {id: 'C14', pageId: 'cap-b30-p02', from: '链接成本趋劲于零', to: '连接成本趋近于零'},
  {id: 'C15', pageId: 'cap-b32-p02', from: '一页报复', to: '一夜暴富'},
  {id: 'N09', pageId: 'cap-b32-p07', from: '流的更快', to: '流得更快', evidence: '按句法作同音正字，不改变实际口播信息。'},
  {id: 'N10', pageId: 'cap-b33-p02', from: '他', to: '它', evidence: '本句主语为水流。'},
]);

const REVIEW_PAGE_BY_ID = Object.freeze({
  U04: 'cap-b15-p03',
  U05: 'cap-b19-p03',
  U08: 'cap-b27-p02',
  U09: 'cap-b34-p03',
});

const tokenText = (word) => String(word?.text ?? '').replaceAll(/\s/gu, '');

const replaceTimedPhrase = ({words, page, replacement}) => {
  const candidates = [];
  for (let startIndex = 0; startIndex < words.length; startIndex += 1) {
    const startWord = words[startIndex];
    const midpoint = ((startWord.start + startWord.end) / 2) * 1000;
    if (midpoint < page.startMs || midpoint >= page.endMs) continue;
    let joined = '';
    for (let endIndex = startIndex; endIndex < words.length; endIndex += 1) {
      const word = words[endIndex];
      const wordMidpoint = ((word.start + word.end) / 2) * 1000;
      if (wordMidpoint >= page.endMs) break;
      joined += tokenText(word);
      if (joined === replacement.from) {
        candidates.push({startIndex, endIndex});
        break;
      }
      if (!replacement.from.startsWith(joined)) break;
    }
  }
  if (candidates.length !== 1) {
    fail(
      'FORMAL_TRANSCRIPT_NORMALIZATION_BINDING',
      `${replacement.id} 在 ${replacement.pageId} 的原始逐词时窗中必须且只能命中一次。`,
      {from: replacement.from, matches: candidates.length},
    );
  }
  const {startIndex, endIndex} = candidates[0];
  const sourceWords = words.slice(startIndex, endIndex + 1);
  const rawText = sourceWords.map((word) => word.raw_text ?? word.text).join('');
  words.splice(startIndex, sourceWords.length, {
    id: `W-N-${replacement.id}`,
    type: 'word',
    text: replacement.to,
    raw_text: rawText,
    verbatim_text: replacement.to,
    start: sourceWords[0].start,
    end: sourceWords.at(-1).end,
    source_start: sourceWords[0].source_start,
    source_end: sourceWords.at(-1).source_end,
    confidence: Math.min(...sourceWords.map((word) => word.confidence ?? 0)),
    correctionIds: [replacement.id],
    normalizationAuthority: replacement.authority,
    normalizationEvidence: replacement.evidence,
    sourceReferences: sourceWords.flatMap((word) => word.sourceReferences ?? []),
    status:
      replacement.authority === 'user-confirmed-focused-audio-review'
        ? 'user-confirmed-focused-audio-review'
        : 'machine-normalized-candidate',
    displayAllowed: true,
  });
};

const buildCanonicalWords = ({
  rawAsr,
  candidateCaptions,
  transcriptionReview,
  reviewManifest,
  decisions,
}) => {
  if (!Array.isArray(rawAsr.segments) || rawAsr.segments.length === 0) {
    fail('FORMAL_RAW_ASR', 'large-v3-turbo 原始转写缺少 segments。');
  }
  const words = rawAsr.segments.flatMap((segment, segmentIndex) =>
    (segment.words ?? []).map((word, wordIndex) => ({
      id: `W-${String(segmentIndex + 1).padStart(4, '0')}-${String(wordIndex + 1).padStart(3, '0')}`,
      type: 'word',
      text: String(word.word ?? '').trim(),
      raw_text: String(word.word ?? '').trim(),
      verbatim_text: String(word.word ?? '').trim(),
      start: Number(word.start),
      end: Number(word.end),
      source_start: Number(word.start),
      source_end: Number(word.end),
      confidence: Number(word.probability ?? 0),
      correctionIds: [],
      sourceReferences: [
        {
          path: RAW_ASR_PATH,
          jsonPointer: `/segments/${segmentIndex}/words/${wordIndex}`,
        },
      ],
      status: 'machine-transcribed',
      displayAllowed: true,
    })),
  ).filter(
    (word) =>
      isText(word.text) &&
      Number.isFinite(word.start) &&
      Number.isFinite(word.end) &&
      word.end > word.start,
  );
  const pageById = new Map(candidateCaptions.pages.map((page) => [page.id, page]));
  const correctionById = new Map(
    (transcriptionReview.corrections ?? []).map((correction) => [correction.id, correction]),
  );
  for (const normalization of MACHINE_TRANSCRIPT_NORMALIZATIONS) {
    const page = pageById.get(normalization.pageId);
    if (!page) fail('FORMAL_TRANSCRIPT_PAGE', `缺少正字绑定页：${normalization.pageId}`);
    const reviewed = correctionById.get(normalization.id);
    if (
      normalization.id.startsWith('C') &&
      (
        reviewed?.from !== normalization.from ||
        reviewed?.to !== normalization.to ||
        !isText(reviewed?.reason)
      )
    ) {
      fail('FORMAL_TRANSCRIPT_REVIEW_BINDING', `${normalization.id} 未绑定既有转写审计。`);
    }
    replaceTimedPhrase({
      words,
      page,
      replacement: {
        ...normalization,
        authority: 'machine-reviewed-orthographic-candidate',
        evidence: normalization.evidence ?? reviewed.reason,
      },
    });
  }
  const reviewById = new Map(reviewManifest.items.map((item) => [item.id, item]));
  for (const id of REQUIRED_REVIEW_IDS) {
    const review = reviewById.get(id);
    const selectedText = decisions.get(id).selectedText;
    replaceTimedPhrase({
      words,
      page: pageById.get(REVIEW_PAGE_BY_ID[id]),
      replacement: {
        id,
        pageId: REVIEW_PAGE_BY_ID[id],
        from: pageReplacementFor(id, review.candidates[0]),
        to: pageReplacementFor(id, selectedText),
        authority: 'user-confirmed-focused-audio-review',
        evidence: `用户通过本期四处原声听辨包选择“${decisions.get(id).userToken}”。`,
      },
    });
  }
  return words;
};

const splitOverlongCaptionPage = (pages) =>
  pages.flatMap((page) => {
    if (page.id !== 'cap-b28-p03') return [page];
    if (
      page.startMs !== 315980 ||
      page.endMs !== 322120 ||
      page.zh !== '那它最终会让所有行业变成卷价格的“红海”吗'
    ) {
      fail('FORMAL_CAPTION_SPLIT_BINDING', '超长字幕页内容或时点已变化，禁止静默套用旧拆分。');
    }
    return [
      {
        ...page,
        id: 'cap-b28-p03a',
        endMs: 319380,
        zh: '那它最终会让所有行业',
        en: 'will it eventually make every industry',
        splitFrom: 'cap-b28-p03',
      },
      {
        ...page,
        id: 'cap-b28-p03b',
        startMs: 319380,
        zh: '变成卷价格的“红海”吗',
        en: 'become a price-war “red ocean”?',
        splitFrom: 'cap-b28-p03',
      },
    ];
  });

const resolveCanonical = ({
  candidateCaptions,
  candidateTimeline,
  rawAsr,
  transcriptionReview,
  reviewManifest,
  decisions,
  generatedAt,
}) => {
  const selected = new Map([...decisions].map(([id, value]) => [id, value.selectedText]));
  const reviewById = new Map(reviewManifest.items.map((item) => [item.id, item]));
  const resolvedPagesUnsplit = candidateCaptions.pages.map((page) => {
    let zh = page.zh;
    let en = page.en;
    let focusedHumanListening = false;
    for (const id of REQUIRED_REVIEW_IDS) {
      const review = reviewById.get(id);
      const selectedText = selected.get(id);
      const pageReplacement = pageReplacementFor(id, selectedText);
      const retainedPageText = pageReplacementFor(id, review.candidates[0]);
      if (zh.includes(retainedPageText)) {
        zh = zh.replace(retainedPageText, pageReplacement);
        en = PAGE_TRANSLATIONS[id][selectedText];
        focusedHumanListening = true;
      }
    }
    const uncertaintyIds = (page.uncertaintyIds ?? []).filter(
      (id) => !REQUIRED_REVIEW_IDS.includes(id),
    );
    return {
      ...page,
      zh,
      en,
      authority: focusedHumanListening
        ? 'recorded-audio-user-confirmed-focused-review'
        : 'recorded-audio-local-asr-candidate',
      humanListeningPerformed: focusedHumanListening,
      userAudioReviewConfirmed: focusedHumanListening,
      reviewRequired: uncertaintyIds.length > 0,
      uncertaintyIds,
    };
  });
  const resolvedPages = splitOverlongCaptionPage(resolvedPagesUnsplit);
  const resolvedBeats = candidateTimeline.beats.map((beat) => {
    let actualChinese = beat.actualChinese;
    let focusedHumanListening = false;
    for (const id of REQUIRED_REVIEW_IDS) {
      const review = reviewById.get(id);
      if (actualChinese.includes(review.candidates[0])) {
        actualChinese = actualChinese.replace(review.candidates[0], selected.get(id));
        focusedHumanListening = true;
      }
    }
    return {
      ...beat,
      actualChinese,
      authority: focusedHumanListening
        ? 'recorded-audio-user-confirmed-focused-review'
        : 'recorded-audio-local-asr-candidate',
      humanListeningPerformed: focusedHumanListening,
      userAudioReviewConfirmed: focusedHumanListening,
      reviewRequired: (beat.uncertaintyIds ?? []).some(
        (id) => !REQUIRED_REVIEW_IDS.includes(id),
      ),
      uncertaintyIds: (beat.uncertaintyIds ?? []).filter(
        (id) => !REQUIRED_REVIEW_IDS.includes(id),
      ),
    };
  });
  const residualUncertaintyIds = [
    ...new Set(resolvedPages.flatMap((page) => page.uncertaintyIds ?? [])),
  ].sort();
  const canonicalWords = buildCanonicalWords({
    rawAsr,
    candidateCaptions,
    transcriptionReview,
    reviewManifest,
    decisions,
  });
  const transcript = {
    schemaVersion: 1,
    taskId: 'task-20260913T155154Z-a375cbd9',
    episodeId: EPISODE_ID,
    status: 'focused-low-confidence-audio-review-passed',
    canonicalSource: 'recorded-audio',
    scriptRole: 'comparison-only',
    captionTextPolicy: 'spoken-verbatim',
    generatedAt,
    sourceRawPath: RAW_ASR_PATH,
    sourceCandidateCaptions: ref(CANDIDATE_CAPTIONS_PATH),
    sourceReviewManifest: ref(REVIEW_MANIFEST_PATH),
    wordGranularity: 'asr-word-timestamp-with-bounded-phrase-normalization',
    wordGranularityNotice:
      'words 保留 large-v3-turbo 原始逐词时点；正字与四处用户选择仅在精确页时窗内合并替换，并保留 raw_text、来源指针和依据。不冒充全片人工听校。',
    humanListeningCompleted: false,
    focusedHumanListeningCompleted: true,
    focusedUserDecisionIds: REQUIRED_REVIEW_IDS,
    unresolvedMediumConfidenceIds: residualUncertaintyIds,
    fullWatchConfirmed: false,
    words: canonicalWords,
    beats: resolvedBeats,
  };
  const captions = {
    schemaVersion: 'koubo-actual-spoken-bilingual/v1',
    taskId: 'task-20260913T155154Z-a375cbd9',
    episodeId: EPISODE_ID,
    status: 'focused-low-confidence-audio-review-passed',
    formalAllowed: true,
    publishAllowed: false,
    humanListeningPerformed: false,
    focusedHumanListeningPerformed: true,
    userAudioReviewConfirmed: true,
    fullWatchConfirmed: false,
    authority: 'recorded-audio',
    chineseSource: 'canonical-transcript.formal.v1.json',
    englishTranslationSource: 'canonical-spoken-chinese',
    scriptRole: 'comparison-only',
    permittedUse: 'scoped-direct-export-formal-candidate-only',
    createdAt: generatedAt,
    residualMediumConfidenceUncertaintyIds: residualUncertaintyIds,
    pages: resolvedPages,
    captions: resolvedPages,
  };
  return {
    transcript,
    captions,
    canonicalCaptions: resolvedPages,
    resolvedBeats,
    residualUncertaintyIds,
  };
};

const layerSource = (item) => {
  if (item.id.startsWith('O')) {
    return {
      asset: {sourceType: 'remotion', source: RUNTIME_PATH},
      assetDecision: {
        class: 'remotion-information',
        producer: 'codex-remotion',
        requestId: `runtime-${item.id}`,
        fallback: 'speaker',
      },
      presentation: {
        semanticFamily: `speaker-${item.type}`,
        renderMode: 'speaker-overlay',
        coverageRatio: 0.36,
      },
      kind: 'semantic-overlay',
      zone: 'left',
    };
  }
  if (item.id.startsWith('P') || item.id.startsWith('G')) {
    return {
      asset: {
        sourceType: 'user-generated-video',
        source: `${PUBLIC_DIR}/${item.src}`,
      },
      assetDecision: {
        class: 'generated-video',
        producer: 'user',
        requestId: `manual-${item.id}`,
        fallback: 'blocked',
      },
      presentation: {
        semanticFamily: item.id.startsWith('P') ? 'paper-editorial' : 'ai-scene',
        renderMode: 'media-fullscreen',
        coverageRatio: 1,
      },
      kind: 'full-screen-asset',
      zone: 'full-screen',
    };
  }
  return {
    asset: {sourceType: 'real-evidence', source: `${PUBLIC_DIR}/${item.src}`},
    assetDecision: {
      class: 'real-evidence',
      producer: 'existing',
      requestId: `existing-${item.id}`,
      fallback: 'speaker',
    },
    presentation: {
      semanticFamily:
        item.kind === 'video'
          ? 'public-archive-video'
          : item.id === 'R04B'
            ? 'public-archive-photo'
            : 'public-evidence-card',
      renderMode: 'media-fullscreen',
      coverageRatio: 1,
    },
    kind: 'full-screen-asset',
    zone: 'full-screen',
  };
};

const soundRole = (item) => {
  if (!item.id.startsWith('O')) return 'media';
  return {
    thesis: 'hero',
    chapter: 'chapter',
    question: 'keyword',
    list: 'list',
    comparison: 'number',
    keyword: 'keyword',
    causal: 'node',
    boundary: 'keyword',
    process: 'node',
    quote: 'keyword',
    outro: 'cta',
  }[item.type] ?? 'keyword';
};

const spokenLineFor = (pages, startFrame, endFrame, fps) =>
  pages
    .filter(
      (page) =>
        page.startMs < (endFrame / fps) * 1000 &&
        page.endMs > (startFrame / fps) * 1000,
    )
    .map((page) => page.zh)
    .join('；');

const buildFormalPlans = ({candidatePlan, pages, b23Decision, generatedAt}) => {
  const allVisuals = [
    ...candidatePlan.insertions,
    ...candidatePlan.speakerOverlays,
  ];
  const byStart = new Map();
  for (const item of allVisuals) {
    const frame = item.startFrame;
    const list = byStart.get(frame) ?? [];
    list.push(item);
    byStart.set(frame, list);
  }
  const preferredAtSameFrame = (items) =>
    [...items].sort((left, right) => {
      const score = (item) => (item.id.startsWith('O') ? 0 : 1);
      return score(left) - score(right);
    })[0];
  const primary = candidatePlan.sfxCues.map((cue) => {
    const candidates = byStart.get(cue.atFrame) ?? [];
    if (candidates.length === 0) {
      fail('FORMAL_VISUAL_SFX_BINDING', `${cue.id} 在实际 candidate-plan 中没有同帧主视觉。`);
    }
    return {cue, item: preferredAtSameFrame(candidates)};
  });
  const layers = primary.map(({cue, item}) => {
    const source = layerSource(item);
    const role = soundRole(item);
    const startFrame = item.startFrame;
    const endFrame = item.endFrameExclusive;
    return {
      id: item.id,
      start: startFrame / candidatePlan.canvas.fps,
      end: endFrame / candidatePlan.canvas.fps,
      spokenLine: spokenLineFor(pages, startFrame, endFrame, candidatePlan.canvas.fps),
      purpose: item.title ?? item.label,
      kind: source.kind,
      overlapGroup: 'primary',
      zone: source.zone,
      titleOwner: true,
      asset: source.asset,
      assetDecision: source.assetDecision,
      presentation: source.presentation,
      visualEvent: {
        id: `${item.id}-event`,
        enterAt: cue.atFrame / candidatePlan.canvas.fps,
        primary: true,
      },
      sound: {
        policy: 'required',
        role,
        cueId: cue.id,
        offsetFrames: 0,
        maxSyncErrorFrames: 2,
      },
      params: {
        component: item.type ?? item.kind,
        src: item.src ?? null,
        title: item.title ?? null,
        subtitle: item.subtitle ?? null,
        items: item.items ?? [],
        ...(item.id === 'O11'
          ? {
              userApprovedCorrectionCard: b23Decision.correctionCard,
              correctionCardEvidence: ref(B23_DECISION_PATH),
            }
          : {}),
      },
      checks: {
        needsFrameReview: true,
        reviewAt: Math.min(
          (startFrame + Math.max(1, Math.round((endFrame - startFrame) / 2))) /
            candidatePlan.canvas.fps,
          endFrame / candidatePlan.canvas.fps,
        ),
        continuousReviewIntervalSeconds: 0.5,
      },
    };
  });
  const cues = primary.map(({cue, item}) => ({
    id: cue.id,
    visualEventId: `${item.id}-event`,
    role: soundRole(item),
    start: cue.atFrame / candidatePlan.canvas.fps,
    end: cue.atFrame / candidatePlan.canvas.fps + 0.4,
    source: `${PUBLIC_DIR}/${cue.src}`,
    license: '本地 V8 已审计音效包',
    licenseReference: 'assets/sfx/koubo-sfx-v8/manifest.json',
    volume: cue.volume,
    voiceDuckDb: 0,
    previewCovered: false,
    formalReviewed: false,
    userAudibilityConfirmed: false,
  }));
  if (
    cues.some(
      (cue) =>
        !Number.isFinite(cue.start) ||
        !Number.isFinite(cue.end) ||
        cue.end <= cue.start,
    )
  ) {
    fail('FORMAL_SFX_TIME', '正式 cue sheet 出现无效的 start/end；禁止写入草案。');
  }
  const actualRuntimeInventory = allVisuals
    .map((item) => ({
      id: item.id,
      beatId: item.beatId,
      startFrame: item.startFrame,
      endFrameExclusive: item.endFrameExclusive,
      kind: item.type ?? item.kind,
      source: item.src ?? RUNTIME_PATH,
      title: item.title ?? null,
      subtitle: item.subtitle ?? null,
      label: item.label ?? null,
    }))
    .sort((left, right) => left.startFrame - right.startFrame);
  const visualPlan = {
    schemaVersion: 4,
    videoId: EPISODE_ID,
    videoTitle: 'AI并没有发明新的商业模式',
    sourceVideo:
      `${EPISODE}/01_素材投放区/01_口播原片/copy_00131113-A43E-48CD-B158-AB0CDE2EF8DC 2.MOV`,
    baselineId: 'koubo-formal-16x9-v1',
    styleReferenceIds: ['v8-semantic-continuity-sfx'],
    experiment: {
      id: 'v8-semantic-continuity-sfx',
      status: 'scoped-direct-export-authorized',
    },
    previewCoverage: [],
    target: {
      width: candidatePlan.canvas.width,
      height: candidatePlan.canvas.height,
      fps: candidatePlan.canvas.fps,
    },
    generatedAt,
    runtimeCandidatePlan: ref(CANDIDATE_PLAN_PATH),
    actualRuntimeInventory,
    primaryVisualEventSelection:
      'layers 逐项对应当前 runtime 的真实 SFX 同帧主视觉；actualRuntimeInventory 完整保留所有实际可见插片与信息层。',
    b23FactBoundary: {
      status: 'user-approved-visible-correction-card',
      correctionCard: B23_CORRECTION,
      evidence: ref(B23_DECISION_PATH),
      limitation: '不把 AI 情景画面、纸艺或流程卡当作“几小时”时效证据。',
    },
    layers,
  };
  const cueSheet = {
    schemaVersion: 3,
    videoId: EPISODE_ID,
    version: 'formal-r1-runtime-exact',
    experimentId: 'v8-semantic-continuity-sfx',
    normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json',
    generatedAt,
    runtimeCandidatePlan: ref(CANDIDATE_PLAN_PATH),
    runtimeVolumePolicy:
      '逐项复制当前 candidate-plan 实际 volume，不虚构预览、正式试听或用户听感确认。',
    cues,
    coverageReview: {
      primaryVisualEventCount: layers.length,
      coveredPrimaryVisualEventCount: cues.length,
      coveragePercent: 100,
      maxSyncErrorFrames: 2,
      machineStatus: 'pending-validator',
      userAudibilityConfirmed: false,
      confirmationScope: null,
    },
  };
  return {visualPlan, cueSheet, actualRuntimeInventory};
};

const generatedMediaBindings = (mediaManifest) => {
  const items = mediaManifest.generatedInserts ?? [];
  if (items.length !== 9) fail('FORMAL_GENERATED_MEDIA', '必须精确绑定本期 9 段人工生成视频。');
  const ids = new Set(items.map((item) => item.logicalId));
  const expectedIds = new Set(['G01', 'G02', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07']);
  if (ids.size !== expectedIds.size || [...expectedIds].some((id) => !ids.has(id))) {
    fail('FORMAL_GENERATED_MEDIA', '9 段人工生成视频 ID 不完整或重复。');
  }
  const bindings = items
    .map((item) => {
      const actualSha = sha256(item.path);
      if (item.sha256 !== actualSha) {
        fail('FORMAL_GENERATED_MEDIA', `人工生成视频哈希变化：${item.logicalId}`);
      }
      const runtimePath = `${PUBLIC_DIR}/media/${item.logicalId}.mp4`;
      return {
        id: item.logicalId,
        path: item.path,
        sha256: actualSha,
        provenance: 'user-generated-manual-import',
        runtime: ref(runtimePath),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(bindings.map((item) => item.sha256)).size !== 9) {
    fail('FORMAL_GENERATED_MEDIA', '9 段人工生成视频原始 SHA-256 必须互不相同。');
  }
  return bindings;
};

const main = async () => {
  // This check deliberately precedes every generated write.
  requireDecisionFilesBeforeAnyOutput();

  const profile = resolveScopedDirectExportProfile({videoId: EPISODE_ID});
  if (profile.jobPath !== JOB_PATH || profile.manifestPath !== MANIFEST_PATH) {
    fail('FORMAL_PROFILE_SCOPE', 'scoped direct-export profile 与本构建器固定路径不一致。');
  }
  const audioDecision = readJson(AUDIO_DECISION_PATH);
  const b23Decision = readJson(B23_DECISION_PATH);
  const reviewManifest = readJson(REVIEW_MANIFEST_PATH);
  const candidatePlan = readJson(CANDIDATE_PLAN_PATH);
  const candidateCaptions = readJson(CANDIDATE_CAPTIONS_PATH);
  const candidateTimeline = readJson(CANDIDATE_TIMELINE_PATH);
  const transcriptionReview = readJson(TRANSCRIPTION_REVIEW_PATH);
  const rawAsr = readJson(RAW_ASR_PATH);
  const mediaManifest = readJson(`${EPISODE}/04_素材清单/用户提供媒体清单.v1.json`);

  const decisions = assertAudioDecision(audioDecision, reviewManifest);
  assertB23Decision(b23Decision, candidatePlan);
  assertActualRuntimeSync(candidatePlan);

  const evidenceOrdinals = [
    26132,
    27560,
    audioDecision.userMessageOrdinal,
    b23Decision.userMessageOrdinal,
  ];
  const userEvents = await extractUserEvents(CURRENT_ROLLOUT, evidenceOrdinals);
  const b23PromptEvent = await extractAssistantEvent(
    b23Decision.promptSourceRollout,
    b23Decision.promptAssistantOrdinal,
  );
  for (const [receipt, label] of [
    [audioDecision, '四处原声听辨回执'],
    [b23Decision, 'B23 更正卡回执'],
  ]) {
    const event = userEvents.get(receipt.userMessageOrdinal);
    if (event.text !== receipt.userQuote) {
      fail('FORMAL_USER_QUOTE_MISMATCH', `${label} 的 userQuote 与真实 user 消息不一致。`);
    }
  }
  if (b23PromptEvent.text !== b23Decision.promptQuote) {
    fail('FORMAL_B23_PROMPT_QUOTE_MISMATCH', 'B23 promptQuote 与真实 assistant 提问不一致。');
  }
  const directEvents = [userEvents.get(26132), userEvents.get(27560)];
  const generatedAt = [
    ...new Set(evidenceOrdinals),
  ]
    .map((ordinal) => userEvents.get(ordinal).timestamp)
    .filter(isText)
    .sort()
    .at(-1);
  if (!isText(generatedAt)) fail('FORMAL_TIMESTAMP', '无法从真实用户事件确定构建时间锚点。');

  const {transcript, captions, canonicalCaptions, residualUncertaintyIds} = resolveCanonical({
    candidateCaptions,
    candidateTimeline,
    rawAsr,
    transcriptionReview,
    reviewManifest,
    decisions,
    generatedAt,
  });
  const {visualPlan, cueSheet, actualRuntimeInventory} = buildFormalPlans({
    candidatePlan,
    pages: captions.pages,
    b23Decision,
    generatedAt,
  });
  const generatedBindings = generatedMediaBindings(mediaManifest);
  const generatedVideos = generatedBindings.map(({path, sha256, provenance}) => ({
    path,
    sha256,
    provenance,
  }));
  const source =
    `${EPISODE}/01_素材投放区/01_口播原片/copy_00131113-A43E-48CD-B158-AB0CDE2EF8DC 2.MOV`;
  const renderProxy = `${PUBLIC_DIR}/media/host.mp4`;

  const sanitizedEvidence = directEvents
    .map(({text: _text, ...event}) => JSON.stringify(event))
    .join('\n') + '\n';
  const resolution = {
    schemaVersion: 'koubo-focused-audio-review-resolution/v1',
    taskId: 'task-20260913T155154Z-a375cbd9',
    episodeId: EPISODE_ID,
    status: 'four-low-confidence-spans-user-confirmed',
    generatedAt,
    reviewPackManifest: ref(REVIEW_MANIFEST_PATH),
    userDecision: ref(AUDIO_DECISION_PATH),
    decisions: REQUIRED_REVIEW_IDS.map((id) => ({
      id,
      selectedText: decisions.get(id).selectedText,
      candidates: reviewManifest.items.find((item) => item.id === id).candidates,
      status: 'user-confirmed-from-recorded-audio-excerpt',
    })),
    humanListeningScope: 'review-pack-four-low-confidence-spans-only',
    humanListeningCompletedForEntireVideo: false,
    fullWatchConfirmed: false,
    residualMediumConfidenceUncertaintyIds: residualUncertaintyIds,
    limitation:
      '本回执不把四处局部听辨冒充全片人工听校，也不表示用户已完整观看正式候选。',
  };
  const policy = {
    schemaVersion: 1,
    canonicalSource: 'recorded-audio',
    scriptRole: 'comparison-only',
    captionTextPolicy: 'spoken-verbatim',
    englishTranslationSource: 'canonical-spoken-chinese',
    compliance: {
      status: 'passed',
      scope:
        '严格实录来源、四处低置信原声听辨与中英字幕绑定；只解锁本地正式候选，不表示全片已人工听校、完整观看或获准发布。',
    },
    verification: {
      minimumGlobalPrecision: 0.97,
      minimumGlobalCoverage: 0.95,
      corrections: [],
      focusedAudioReviewResolution: RESOLUTION_PATH,
      reviewPackManifest: REVIEW_MANIFEST_PATH,
      userDecisionEvidence: AUDIO_DECISION_PATH,
      humanListeningCompleted: false,
      focusedHumanListeningCompleted: true,
      focusedUserDecisionIds: REQUIRED_REVIEW_IDS,
      userFullWatchConfirmed: false,
    },
    knownLimitations: [
      {
        id: 'residual-medium-confidence-asr-spans',
        status: 'retained-for-formal-candidate-full-watch',
        uncertaintyIds: residualUncertaintyIds,
        treatment:
          '保留当前实录 ASR 候选，不以拍摄前文稿覆盖；正式候选仍须用户完整观看。',
      },
      {
        id: 'b23-few-hours-claim',
        status: 'not-established-by-this-episode',
        treatment: B23_CORRECTION.subtitle,
        approval: B23_DECISION_PATH,
      },
    ],
    authorizedEdit:
      '完整单条原声保留；沿用已留原始词与依据的机器候选正字，四处低置信说法按用户原声听辨选择确定；不删改、压缩或恢复拍摄前文稿。',
    publishAuthorized: false,
  };

  const spokenCheckSuffix = `.spoken-check-${process.pid}.json`;
  const spokenCheckPaths = {
    transcript: `${TRANSCRIPT_PATH}${spokenCheckSuffix}`,
    captions: `${CAPTIONS_PATH}${spokenCheckSuffix}`,
    policy: `${POLICY_PATH}${spokenCheckSuffix}`,
  };
  try {
    writeJson(spokenCheckPaths.transcript, transcript);
    writeJson(spokenCheckPaths.captions, canonicalCaptions);
    writeJson(spokenCheckPaths.policy, policy);
    const spokenCheck = spawnSync(
      process.execPath,
      [
        resolve(ROOT, 'tools/check-spoken-source-policy.mjs'),
        resolve(ROOT, spokenCheckPaths.transcript),
        resolve(ROOT, spokenCheckPaths.captions),
        resolve(ROOT, spokenCheckPaths.policy),
      ],
      {cwd: ROOT, encoding: 'utf8'},
    );
    if (spokenCheck.status !== 0) {
      fail(
        'FORMAL_SPOKEN_SOURCE_CHECK_FAILED',
        `正式 transcript/captions 未通过严格实录来源 LCS 校验：${spokenCheck.stderr || spokenCheck.stdout}`,
      );
    }
    const verbatimCheck = spawnSync(
      process.execPath,
      [
        resolve(ROOT, 'tools/check-verbatim-caption-sync.mjs'),
        resolve(ROOT, spokenCheckPaths.transcript),
        resolve(ROOT, spokenCheckPaths.captions),
      ],
      {cwd: ROOT, encoding: 'utf8'},
    );
    if (verbatimCheck.status !== 0) {
      fail(
        'FORMAL_VERBATIM_CAPTION_CHECK_FAILED',
        `正式字幕未通过逐页逐词同步校验：${verbatimCheck.stderr || verbatimCheck.stdout}`,
      );
    }
  } finally {
    for (const pathValue of Object.values(spokenCheckPaths)) {
      const absolute = projectPath(pathValue, {mustExist: false});
      if (existsSync(absolute)) unlinkSync(absolute);
    }
  }

  // 所有用户决定、运行时同步和严格实录 LCS 已通过，正式产物才从这里开始写入。
  writeJson(RESOLUTION_PATH, resolution);
  writeJson(TRANSCRIPT_PATH, transcript);
  writeJson(CAPTIONS_PATH, canonicalCaptions);
  writeJson(POLICY_PATH, policy);
  writeJson(PUBLIC_FORMAL_CAPTIONS_PATH, captions);
  writeJson(VISUAL_PLAN_PATH, visualPlan);
  writeJson(SFX_CUE_PATH, cueSheet);
  writeAtomic(DIRECT_EXPORT_EVIDENCE_PATH, sanitizedEvidence);
  writeJson(DIRECT_EXPORT_PROVENANCE_PATH, {
    schemaVersion: 'koubo-sanitized-user-event-provenance/v1',
    episodeId: EPISODE_ID,
    sourceRollout: CURRENT_ROLLOUT,
    sourceEvidenceLastOrdinal: Math.max(...directEvents.map((event) => event.ordinal)),
    extraction: 'exact-role-user-text-with-input-images-omitted',
    ordinals: [26132, 27560],
    messages: directEvents.map((event, index) => ({
      ordinal: event.ordinal,
      timestamp: event.timestamp,
      sanitizedLine: index + 1,
      fullUserTextSha256: createHash('sha256').update(event.text).digest('hex'),
    })),
    assistantMessagesAccepted: false,
    compactedSummariesAccepted: false,
  });

  const preproduction = Object.fromEntries(
    Object.entries(profile.preshootArtifacts).map(([key, pathValue]) => [key, ref(pathValue)]),
  );
  const postRequest = {
    schema: 'koubo-manual-postshoot-request/v1',
    taskId: profile.directorTaskId,
    phase: 'post-shoot',
    provenance: 'user-generated-manual-import',
    request:
      '按实录全文保留并重绑现有 9 段人工生成素材、公开资料、当前 Remotion runtime、正式实录字幕和用户批准的 B23 可见更正卡；直接导出正式候选但不伪造预览、全片观看或发布。',
    recordedMedia: ref(source),
    renderProxy: ref(renderProxy),
    transcript: ref(TRANSCRIPT_PATH),
    bilingualCaptions: ref(CAPTIONS_PATH),
    spokenSourcePolicy: ref(POLICY_PATH),
    focusedAudioDecision: ref(AUDIO_DECISION_PATH),
    b23CorrectionCardApproval: ref(B23_DECISION_PATH),
    durationFrames: candidatePlan.canvas.durationInFrames,
    fps: candidatePlan.canvas.fps,
    scriptRole: 'comparison-only',
    generatedVideos,
    runtimeGeneratedVideos: generatedBindings.map(({id, runtime}) => ({id, ...runtime})),
    preproduction,
  };
  writeJson(POST_REQUEST_PATH, postRequest);

  const postMappings = candidatePlan.insertions
    .filter((insertion) => insertion.id.startsWith('P') || insertion.id.startsWith('G'))
    .map((insertion) => {
      const binding = generatedBindings.find((item) => item.id === insertion.id);
      return {
        id: insertion.id,
        beatId: insertion.beatId,
        source: {path: binding.path, sha256: binding.sha256},
        runtimeMedia: binding.runtime,
        startFrame: insertion.startFrame,
        endFrameExclusive: insertion.endFrameExclusive,
        actualSpokenLine: spokenLineFor(
          captions.pages,
          insertion.startFrame,
          insertion.endFrameExclusive,
          candidatePlan.canvas.fps,
        ),
        purpose: insertion.label,
        playbackRate: 1,
        sourceAudio: 'muted-by-current-runtime',
        alignment: 'actual-spoken-semantic-window',
        limitation:
          '人工生成说明画面不具备事实证据资格；按当前 runtime 非破坏性规范化版本渲染。',
      };
    });
  const postPlan = {
    schema: 'koubo-manual-postshoot-plan/v1',
    taskId: profile.directorTaskId,
    phase: 'post-shoot',
    status: 'manual-import-bound',
    request: ref(POST_REQUEST_PATH),
    spokenAuthority: 'recorded-audio',
    scriptRole: 'comparison-only',
    skillExecuted: false,
    automatedDirectorReproductionClaimed: false,
    userPreviewApproved: false,
    userFullWatchConfirmed: false,
    publishAuthorized: false,
    generatedVideos,
    mappings: postMappings,
    actualRuntimeInventory,
    b23FactBoundary: {
      status: 'user-approved-visible-correction-card',
      correctionCard: B23_CORRECTION,
      approval: ref(B23_DECISION_PATH),
      evidenceQualification: 'boundary-only-not-timing-proof',
    },
    transcriptResolution: ref(RESOLUTION_PATH),
    sourceAudioHumanAuditionCompleted: false,
    focusedFourSpanHumanAuditionCompleted: true,
    fullWatchConfirmed: false,
  };
  writeJson(POST_PLAN_PATH, postPlan);

  const artifactsWithoutReceipt = {
    ...preproduction,
    postshootRequest: ref(POST_REQUEST_PATH),
    postshootPlan: ref(POST_PLAN_PATH),
  };
  const postReceipt = {
    schema: 'koubo-scoped-manual-postshoot/v1',
    taskId: profile.directorTaskId,
    episodeId: profile.episodeId,
    jobId: profile.jobId,
    revisionId: profile.revisionId,
    phase: 'post-shoot',
    status: 'manual-import-bound',
    provenance: 'user-generated-manual-import',
    skillExecuted: false,
    skillPackageAccepted: false,
    userPreviewApproved: false,
    spokenAuthority: 'recorded-audio',
    scriptRole: 'comparison-only',
    bindings: {
      ...artifactsWithoutReceipt,
      source: ref(source),
      transcript: ref(TRANSCRIPT_PATH),
      bilingualCaptions: ref(CAPTIONS_PATH),
      spokenSourcePolicy: ref(POLICY_PATH),
      visualPlan: ref(VISUAL_PLAN_PATH),
      compositionEntry: ref(profile.entry),
    },
    generatedVideos,
  };

  writeJson(POST_RECEIPT_PATH, postReceipt);

  const artifacts = {
    ...artifactsWithoutReceipt,
    postshootValidation: ref(POST_RECEIPT_PATH),
  };
  const fingerprintPaths = [
    profile.manifestPath,
    ...SCOPED_DIRECT_EXPORT_GATE_FILES,
    'tools/check-verbatim-caption-sync.mjs',
    DIRECT_EXPORT_EVIDENCE_PATH,
    DIRECT_EXPORT_PROVENANCE_PATH,
    AUDIO_DECISION_PATH,
    B23_DECISION_PATH,
    REVIEW_MANIFEST_PATH,
    TRANSCRIPTION_REVIEW_PATH,
    RESOLUTION_PATH,
    source,
    renderProxy,
    TRANSCRIPT_PATH,
    CAPTIONS_PATH,
    POLICY_PATH,
    VISUAL_PLAN_PATH,
    SFX_CUE_PATH,
    CANDIDATE_PLAN_PATH,
    `${EPISODE}/04_素材清单/用户提供媒体清单.v1.json`,
    `${EPISODE}/04_素材清单/公开素材来源登记.v1.json`,
    ...generatedVideos.map((item) => item.path),
    ...generatedBindings.map((item) => item.runtime.path),
    ...Object.values(artifacts).map((item) => item.path),
    'remotion/src/ai-no-new-business-model-v8-candidate-r1',
    PUBLIC_DIR,
    'assets/sfx/koubo-sfx-v8/manifest.json',
    `${CONTROL}/build-formal-production-r1.mjs`,
  ];
  const contentApproval = preproduction.preproductionPlan;
  const job = {
    schemaVersion: 1,
    jobId: profile.jobId,
    videoId: profile.episodeId,
    title: 'AI并没有发明新的商业模式',
    purpose:
      '按真实口播、已准备的 9 段人工生成素材、已核验公开资料、当前 V8 Remotion 画面、正式实录字幕和可追溯音效导出完整正式候选。',
    productionState: 'ready-for-production',
    productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8'},
    contentApproval: {userScriptApproved: true, evidence: contentApproval},
    finalReview: {fullWatchConfirmed: false, reviewOutcome: 'pending'},
    experiment: {
      id: 'v8-semantic-continuity-sfx',
      status: profile.state,
      userPreviewApproved: false,
      userPreviewApprovedAt: null,
      userPreviewApprovalEvidence: null,
      primaryVisualEventCount: visualPlan.layers.length,
      sfxCoveragePercent: 100,
      previewAuditionRoles: [],
      revisionReason:
        '用户明确要求直出正式 MP4 和完整发布包；保持当前画面，补齐实录四处听辨、B23 可见更正卡、正式字幕、正式音效合同及单条直出审计。',
    },
    baseline: {
      path: 'workflow/production-baseline.v1.json',
      id: 'koubo-formal-16x9-v1',
      revision: 'V7.2-20260730',
    },
    inputs: {
      source,
      renderProxy,
      visualPlan: VISUAL_PLAN_PATH,
      transcript: TRANSCRIPT_PATH,
      captions: CAPTIONS_PATH,
      bilingualCaptions: CAPTIONS_PATH,
      spokenSourcePolicy: POLICY_PATH,
      sfxCueSheet: SFX_CUE_PATH,
      sfxManifest: 'assets/sfx/koubo-sfx-v8/manifest.json',
      timingRebind: POST_PLAN_PATH,
      fingerprintPaths: [...new Set(fingerprintPaths)],
    },
    remotion: {
      root: 'remotion',
      entry: profile.remotionEntry,
      publicDir: PUBLIC_DIR,
      compositionWithSfx: profile.composition,
      compositionWithoutSfx: profile.compositionWithoutSfx,
      durationSeconds: candidatePlan.canvas.durationInFrames / candidatePlan.canvas.fps,
      fps: candidatePlan.canvas.fps,
      width: candidatePlan.canvas.width,
      height: candidatePlan.canvas.height,
      concurrency: 4,
    },
    preview: {
      enabled: false,
      ranges: [],
      output: null,
      renderWithoutSfxComparison: false,
    },
    riskFrames: {
      enabled: true,
      source: 'formal-output-extraction',
      fullResolution: true,
      outputDirectory: profile.riskFrameDirectory,
    },
    audioPreflight: {
      enabled: false,
      source: 'formal',
      integratedLoudnessTargetLufs: -16,
      truePeakMaxDbtp: -1.5,
      preferredTruePeakDbtp: -2.2,
    },
    formal: {
      enabled: true,
      composition: 'with-sfx',
      blockedReason: null,
      crf: 16,
      pixelFormat: 'yuv420p',
      audioCodec: 'aac',
      audioBitrate: '320k',
      rawOutput: RAW_OUTPUT,
      finalOutput: FINAL_OUTPUT,
      loudness: {
        enabled: true,
        integratedLoudnessTargetLufs: -16,
        loudnessRangeTargetLu: 11,
        truePeakTargetDbtp: -2.2,
      },
    },
    cache: {
      enabled: true,
      directory: 'work/production-cache/ai-no-new-business-model-v8-r1',
    },
    reports: {
      runManifest: `${QA_DIR}/run-manifest.json`,
      timingReport: `${QA_DIR}/timings.json`,
      regressionReport: `${QA_DIR}/regression.json`,
    },
    knowledgeContext: {
      taskId: 'task-20260913T155154Z-a375cbd9',
      contextPath: 'task-20260913T155154Z-a375cbd9/context.json',
    },
    director: {
      required: true,
      profileId: 'paper-editorial-director-v9',
      profileVersion: '9.1.0',
      paperRequired: true,
      fallback: 'blocked',
      taskId: profile.directorTaskId,
      phase: 'post-shoot',
      artifacts,
    },
    productionGate: {
      schema: 'director-production-entry-binding/v2',
      route: profile.route,
      state: profile.state,
      revisionId: profile.revisionId,
      formalEnabled: true,
      userPreviewApproved: false,
      scopedDirectExport: {path: profile.manifestPath, sha256: ZERO_SHA256},
    },
  };
  writeJson(JOB_PATH, job);

  const bindings = collectScopedDirectExportBindings({projectRoot: ROOT, job});
  const directExportEvidence = ref(DIRECT_EXPORT_EVIDENCE_PATH);
  const manifest = {
    schema: profile.schema,
    route: profile.route,
    episodeId: profile.episodeId,
    jobId: profile.jobId,
    revisionId: profile.revisionId,
    jobPath: profile.jobPath,
    ...bindings,
    authorization: {
      kind: 'verified-user-direct-export',
      evidence: directExportEvidence,
      format: 'codex-rollout-jsonl',
      directExportMessage: {line: 2, quote: directEvents[1].text},
      skipPreviewMessage: {line: 1, quote: directEvents[0].text},
      independentSignature: false,
    },
    media: {
      source: ref(source),
      renderProxy: ref(renderProxy),
      transcript: ref(TRANSCRIPT_PATH),
      bilingualCaptions: ref(CAPTIONS_PATH),
      spokenSourcePolicy: ref(POLICY_PATH),
    },
    generatedVideos,
    outputs: {rawOutput: RAW_OUTPUT, finalOutput: FINAL_OUTPUT},
    allowedCommands: [
      'doctor',
      'fingerprint',
      'risk-frames',
      'formal',
      'formal-audio',
      'qa',
      'release-validation',
    ],
    constraints: {
      previewApproved: false,
      fullWatchConfirmed: false,
      publishAuthorized: false,
      providerCallsAllowed: false,
    },
  };
  writeJson(MANIFEST_PATH, manifest);
  const manifestSha256 = sha256(MANIFEST_PATH);
  job.productionGate.scopedDirectExport.sha256 = manifestSha256;
  writeJson(JOB_PATH, job);
  const jobSha256 = sha256(JOB_PATH);

  const pinStatus =
    !isText(profile.manifestSha256) || !SHA256.test(profile.manifestSha256)
      ? 'profile-pin-missing'
      : profile.manifestSha256 === manifestSha256
        ? 'profile-pin-matched'
        : 'profile-pin-mismatch';
  writeJson(BUILD_RECEIPT_PATH, {
    schemaVersion: 'koubo-formal-production-draft-build-receipt/v1',
    episodeId: EPISODE_ID,
    jobId: profile.jobId,
    revisionId: profile.revisionId,
    status: pinStatus === 'profile-pin-matched' ? 'ready-for-gate-validation' : 'draft-awaiting-profile-pin',
    generatedAt,
    job: {path: JOB_PATH, sha256: jobSha256},
    manifest: {path: MANIFEST_PATH, sha256: manifestSha256},
    profileManifestSha256: profile.manifestSha256 ?? null,
    userPreviewApproved: false,
    fullWatchConfirmed: false,
    publishAuthorized: false,
    artifacts: {
      transcript: ref(TRANSCRIPT_PATH),
      captions: ref(CAPTIONS_PATH),
      spokenSourcePolicy: ref(POLICY_PATH),
      visualPlan: ref(VISUAL_PLAN_PATH),
      sfxCueSheet: ref(SFX_CUE_PATH),
      postshootValidation: ref(POST_RECEIPT_PATH),
    },
    nextGate:
      pinStatus === 'profile-pin-matched'
        ? '运行 scoped route、V8 合同、实录来源、知识上下文与正式命令门禁。'
        : '审计 scoped manifest 后，由独立门禁改动把同一 SHA-256 固定到当前 episode profile；不得由本脚本自我批准。',
  });

  if (pinStatus !== 'profile-pin-matched') {
    fail(
      'FORMAL_SCOPED_PIN_PENDING',
      `已生成可审计草案，但 scoped profile pin 尚未匹配；manifest SHA-256=${manifestSha256}`,
      {pinStatus, manifestSha256, profileManifestSha256: profile.manifestSha256 ?? null},
    );
  }

  console.log(
    JSON.stringify(
      {
        status: 'ready-for-gate-validation',
        job: JOB_PATH,
        jobSha256,
        manifest: MANIFEST_PATH,
        manifestSha256,
        finalOutput: FINAL_OUTPUT,
        userPreviewApproved: false,
        fullWatchConfirmed: false,
        publishAuthorized: false,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} catch (error) {
  console.error(`[${error.code ?? 'FORMAL_BUILD_FAILED'}] ${error.message}`);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exitCode = 1;
}
