import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

export const DIRECTOR_CUES_SCHEMA = 'koubo-director-cues/v1';

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const list = (value) => Array.isArray(value) ? value : [];
const characters = (value) => Array.from(String(value ?? '').trim()).length;
const speechCharacters = (value) => Array.from(String(value ?? '').replace(/[\s\p{P}\p{S}]+/gu, '')).length;
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const normalized = (value) => String(value ?? '').replace(/[\s\p{P}\p{S}]+/gu, '');

const visualRoles = new Set(['mechanism', 'process', 'relationship', 'comparison', 'metaphor']);
const routes = new Set(['paper-editorial']);
const scriptAuthorities = new Set(['user-confirmed-script', 'actual-spoken-transcript']);
const technicalPromptTerms = [
  '毫米', '归一化坐标', '布局合同', '碰撞', 'OCR', 'sha256',
  'generatedDecorationPolicy', 'sweptRect', 'projectionContract',
  'x=', 'y=', 'width=', 'height=',
];
const firstFrameMotionWords = [
  '随后', '然后', '逐渐', '最终', '接着', '滑入', '飞入', '移入',
  '旋转', '展开', '折叠', '变成', '汇聚', '推镜', '拉镜', '镜头移动',
];
const videoSequenceWords = [
  '随后', '然后', '接着', '继而', '再把', '再将', '同时', '与此同时', '并且',
  '第一步', '第二步',
];
const generatedSymbolTerms = [
  '问号', '纸币', '金币', '人民币', '印章', '对号', '勾选', '图表', '清单',
];

function validTextList(value, minimum, maximum) {
  return list(value).length >= minimum && list(value).length <= maximum && list(value).every(text);
}

function validTextPlan(value) {
  return list(value).length >= 1 && list(value).length <= 4 && list(value).every((entry) => (
    entry && typeof entry === 'object' &&
    text(entry.text) && characters(entry.text) <= 8 &&
    text(entry.surface) && characters(entry.surface) <= 24
  ));
}

function resolveFile(projectRoot, declaredPath) {
  if (!text(declaredPath)) return null;
  return path.isAbsolute(declaredPath)
    ? path.normalize(declaredPath)
    : path.resolve(projectRoot, declaredPath);
}

function checkSha(filePath, expected) {
  return existsSync(filePath) && /^[a-f0-9]{64}$/.test(String(expected ?? '')) &&
    sha256(readFileSync(filePath)) === expected;
}

function validPngReference(filePath) {
  if (!existsSync(filePath) || path.extname(filePath).toLowerCase() !== '.png') return false;
  const bytes = readFileSync(filePath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) return false;
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') return false;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const ratio = width / height;
  return width >= 720 && height >= 405 && ratio >= 1.3 && ratio <= 2.1;
}

export function validateDirectorCues({cues, projectRoot, scriptText}) {
  const errors = [];
  const fail = (condition, code) => { if (!condition) errors.push(code); };

  fail(cues?.schemaVersion === DIRECTOR_CUES_SCHEMA, 'DIRECTOR_CUES_SCHEMA_INVALID');
  fail(text(cues?.taskId), 'DIRECTOR_CUES_TASK_ID_REQUIRED');
  fail(cues?.status === 'ready-for-user-review', 'DIRECTOR_CUES_STATUS_INVALID');
  fail(scriptAuthorities.has(cues?.inputScript?.authority), 'DIRECTOR_CUES_SCRIPT_AUTHORITY_INVALID');

  const source = String(scriptText ?? '');
  fail(text(source), 'DIRECTOR_CUES_SCRIPT_EMPTY');

  const style = cues?.styleLock ?? {};
  fail(text(style.promptPrefix) && characters(style.promptPrefix) <= 160, 'DIRECTOR_CUES_STYLE_PREFIX_INVALID');
  fail(list(style.referenceImages).length > 0, 'DIRECTOR_CUES_REFERENCE_REQUIRED');
  fail(style.textPolicy === 'generated-base-image-then-deterministic-chinese', 'DIRECTOR_CUES_TEXT_POLICY_INVALID');
  fail(validTextList(style.mustKeep, 4, 8), 'DIRECTOR_CUES_STYLE_KEEP_RULES_INVALID');
  fail(validTextList(style.mustAvoid, 3, 8), 'DIRECTOR_CUES_STYLE_AVOID_RULES_INVALID');

  const referenceIds = new Set();
  for (const reference of list(style.referenceImages)) {
    fail(text(reference?.id) && !referenceIds.has(reference.id), 'DIRECTOR_CUES_REFERENCE_ID_INVALID');
    if (text(reference?.id)) referenceIds.add(reference.id);
    fail(reference?.usage === 'style-mechanism-only', `DIRECTOR_CUES_REFERENCE_USAGE_INVALID:${reference?.id ?? 'unknown'}`);
    const referencePath = resolveFile(projectRoot, reference?.path);
    fail(referencePath && checkSha(referencePath, reference.sha256), `DIRECTOR_CUES_REFERENCE_BINDING_INVALID:${reference?.id ?? 'unknown'}`);
    fail(referencePath && validPngReference(referencePath), `DIRECTOR_CUES_REFERENCE_MEDIA_INVALID:${reference?.id ?? 'unknown'}`);
  }

  const inserts = list(cues?.inserts);
  fail(cues?.selectionSummary?.insertCount === inserts.length, 'DIRECTOR_CUES_INSERT_COUNT_MISMATCH');
  fail(text(cues?.selectionSummary?.mainPoint), 'DIRECTOR_CUES_MAIN_POINT_REQUIRED');
  fail(text(cues?.selectionSummary?.densityReason), 'DIRECTOR_CUES_DENSITY_REASON_REQUIRED');
  const protectedSections = list(cues?.selectionSummary?.protectedSpeakerSections);
  fail(validTextList(protectedSections, 1, 8), 'DIRECTOR_CUES_PROTECTED_SPEAKER_SECTIONS_INVALID');
  const protectedRanges = [];
  for (const quote of protectedSections) {
    const offset = source.indexOf(String(quote ?? ''));
    fail(text(quote) && offset >= 0, 'DIRECTOR_CUES_PROTECTED_SPEAKER_QUOTE_MISMATCH');
    if (text(quote) && offset >= 0) protectedRanges.push([offset, offset + quote.length]);
  }

  const ids = new Set();
  const metaphors = new Set();
  const compositions = new Set();
  let previousQuoteEnd = 0;
  inserts.forEach((insert, index) => {
    const id = insert?.id ?? `index-${index}`;
    fail(/^P\d{2}$/.test(id) && !ids.has(id), `DIRECTOR_CUES_INSERT_ID_INVALID:${id}`);
    ids.add(id);
    fail(insert?.order === index + 1, `DIRECTOR_CUES_INSERT_ORDER_INVALID:${id}`);
    const quote = String(insert?.scriptQuote ?? '');
    const anyQuoteOffset = source.indexOf(quote);
    const quoteOffset = source.indexOf(quote, previousQuoteEnd);
    fail(text(quote) && anyQuoteOffset >= 0, `DIRECTOR_CUES_SCRIPT_QUOTE_MISMATCH:${id}`);
    fail(anyQuoteOffset < 0 || !protectedRanges.some(([start, end]) => anyQuoteOffset < end && anyQuoteOffset + quote.length > start), `DIRECTOR_CUES_PROTECTED_SPEAKER_OVERLAP:${id}`);
    fail(anyQuoteOffset < 0 || quoteOffset >= 0, `DIRECTOR_CUES_SCRIPT_ORDER_INVALID:${id}`);
    fail(characters(quote) >= 4 && characters(quote) <= 80, `DIRECTOR_CUES_SCRIPT_QUOTE_LENGTH_INVALID:${id}`);
    if (quoteOffset >= 0) previousQuoteEnd = quoteOffset + quote.length;
    const startAnchor = String(insert?.startAnchorText ?? '');
    const endAnchor = String(insert?.endAnchorText ?? '');
    const startAnchorOffset = quote.indexOf(startAnchor);
    const endAnchorOffset = quote.indexOf(endAnchor);
    fail(text(startAnchor) && startAnchorOffset >= 0, `DIRECTOR_CUES_START_ANCHOR_MISMATCH:${id}`);
    fail(text(endAnchor) && endAnchorOffset >= 0, `DIRECTOR_CUES_END_ANCHOR_MISMATCH:${id}`);
    fail(startAnchorOffset >= 0 && endAnchorOffset >= startAnchorOffset + startAnchor.length, `DIRECTOR_CUES_ANCHOR_ORDER_INVALID:${id}`);
    fail(insert?.timingStatus === 'pre-shoot-text-anchor-only' || insert?.timingStatus === 'post-shoot-audio-bound', `DIRECTOR_CUES_TIMING_STATUS_INVALID:${id}`);
    fail(Number.isFinite(insert?.durationSeconds) && insert.durationSeconds >= 2 && insert.durationSeconds <= 8, `DIRECTOR_CUES_DURATION_INVALID:${id}`);
    fail(Number.isFinite(insert?.durationSeconds) && speechCharacters(quote) / insert.durationSeconds <= 8, `DIRECTOR_CUES_SPEECH_WINDOW_TOO_DENSE:${id}`);
    fail(text(insert?.reason), `DIRECTOR_CUES_REASON_REQUIRED:${id}`);
    fail(visualRoles.has(insert?.visualRole), `DIRECTOR_CUES_VISUAL_ROLE_INVALID:${id}`);
    fail(routes.has(insert?.route), `DIRECTOR_CUES_ROUTE_INVALID:${id}`);
    fail(text(insert?.visualMetaphor) && !metaphors.has(normalized(insert.visualMetaphor)), `DIRECTOR_CUES_METAPHOR_NOT_UNIQUE:${id}`);
    metaphors.add(normalized(insert.visualMetaphor));
    fail(text(insert?.composition) && !compositions.has(normalized(insert.composition)), `DIRECTOR_CUES_COMPOSITION_NOT_UNIQUE:${id}`);
    compositions.add(normalized(insert.composition));
    fail(text(insert?.primaryAction) && characters(insert.primaryAction) <= 60, `DIRECTOR_CUES_PRIMARY_ACTION_INVALID:${id}`);
    const textPlan = list(insert?.textPlan);
    fail(validTextPlan(textPlan), `DIRECTOR_CUES_TEXT_PLAN_INVALID:${id}`);
    fail(new Set(textPlan.map((entry) => normalized(entry?.text))).size === textPlan.length, `DIRECTOR_CUES_TEXT_PLAN_LABEL_INVALID:${id}`);
    fail(list(insert?.referenceImageIds).length > 0 && insert.referenceImageIds.every((refId) => referenceIds.has(refId)), `DIRECTOR_CUES_REFERENCE_ID_UNKNOWN:${id}`);

    const firstFrame = String(insert?.firstFramePrompt ?? '').trim();
    const video = String(insert?.videoPrompt ?? '').trim();
    fail(new Set(textPlan.map((entry) => normalized(entry?.surface))).size === textPlan.length && textPlan.every((entry) => text(entry?.surface) && firstFrame.includes(entry.surface)), `DIRECTOR_CUES_TEXT_PLAN_SURFACE_INVALID:${id}`);
    for (const entry of textPlan) {
      fail(!text(entry?.text) || !firstFrame.includes(entry.text), `DIRECTOR_CUES_TEXT_LEAKED_TO_FIRST_FRAME:${id}:${entry?.text ?? 'unknown'}`);
    }
    fail(characters(firstFrame) >= 80 && characters(firstFrame) <= 600, `DIRECTOR_CUES_FIRST_FRAME_LENGTH_INVALID:${id}`);
    fail(characters(video) >= 40 && characters(video) <= 350, `DIRECTOR_CUES_VIDEO_LENGTH_INVALID:${id}`);
    fail(firstFrame.startsWith(style.promptPrefix), `DIRECTOR_CUES_STYLE_PREFIX_MISSING:${id}`);
    fail(video.startsWith('基于已确认首帧'), `DIRECTOR_CUES_VIDEO_NOT_BOUND_TO_FIRST_FRAME:${id}`);
    fail(video.includes(insert?.primaryAction ?? ''), `DIRECTOR_CUES_PRIMARY_ACTION_NOT_IN_VIDEO:${id}`);
    for (const word of technicalPromptTerms) {
      fail(!firstFrame.includes(word) && !video.includes(word), `DIRECTOR_CUES_TECHNICAL_PROMPT_POLLUTION:${id}:${word}`);
    }
    for (const word of firstFrameMotionWords) {
      fail(!firstFrame.includes(word), `DIRECTOR_CUES_FIRST_FRAME_CONTAINS_MOTION:${id}:${word}`);
    }
    for (const word of videoSequenceWords) {
      fail(!video.includes(word), `DIRECTOR_CUES_VIDEO_CONTAINS_SEQUENCE:${id}:${word}`);
    }
    for (const word of generatedSymbolTerms) {
      fail(!firstFrame.includes(word), `DIRECTOR_CUES_FIRST_FRAME_SYMBOL_RISK:${id}:${word}`);
    }
    fail(validTextList(insert?.negativePrompt, 3, 8), `DIRECTOR_CUES_NEGATIVE_PROMPT_INVALID:${id}`);
  });

  return {ok: errors.length === 0, errors};
}

export function validateDirectorCuesFile({inputPath, projectRoot}) {
  const cues = JSON.parse(readFileSync(inputPath, 'utf8'));
  const scriptPath = resolveFile(projectRoot, cues?.inputScript?.path);
  if (!scriptPath || !existsSync(scriptPath)) {
    return {ok: false, errors: ['DIRECTOR_CUES_SCRIPT_FILE_MISSING']};
  }
  if (!checkSha(scriptPath, cues?.inputScript?.sha256)) {
    return {ok: false, errors: ['DIRECTOR_CUES_SCRIPT_SHA_MISMATCH']};
  }
  return validateDirectorCues({
    cues,
    projectRoot,
    scriptText: readFileSync(scriptPath, 'utf8'),
  });
}
