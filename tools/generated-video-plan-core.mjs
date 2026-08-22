import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync} from 'node:fs';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STYLE_ID = 'koubo-paper-construct-v1';
const PLAN_SCOPE = 'ai-concept-explainer-inserts-only';
const EPSILON = 1e-6;
const COST_AUTHORIZATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const COST_AUTHORIZATION_FUTURE_SKEW_MS = 5 * 60 * 1000;
const GENERATED_VIDEO_QA_CHECKS = Object.freeze([
  'styleSignature',
  'singleAction',
  'identityStable',
  'shapeStable',
  'contactContinuous',
  'subtitleSafe',
  'noForbiddenElements',
]);
const RUNNINGHUB_H3_CONTRACT = Object.freeze({
  provider: 'RunningHub',
  providerId: 'runninghub-minimax-h3-2k',
  model: 'MiniMax-H3',
  modelRoute: '/openapi/v2/minimax/hailuo-h3/multimodal-to-video',
  resolution: '2K',
  ratio: '16:9',
  aigcWatermark: false,
});

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);
const nearlyEqual = (left, right) =>
  isFiniteNumber(left) && isFiniteNumber(right) &&
  Math.abs(left - right) <= EPSILON;
const sameNumberArray = (left, right) =>
  Array.isArray(left) &&
  left.length === right.length &&
  left.every((value, index) => nearlyEqual(value, right[index]));

const resolveProjectPath = (filePath) =>
  isAbsolute(filePath) ? filePath : resolve(projectRoot, filePath);
const assertProjectPath = (filePath, label) => {
  const absolutePath = resolveProjectPath(filePath);
  const relativePath = resolve(projectRoot, absolutePath) === projectRoot
    ? ''
    : absolutePath.slice(projectRoot.length + 1);
  if (
    absolutePath !== projectRoot &&
    (!absolutePath.startsWith(`${projectRoot}/`) || relativePath.startsWith('..'))
  ) {
    throw new Error(`${label}必须位于口播项目目录内：${filePath}`);
  }
  return absolutePath;
};

const assertNoSymlinkComponents = (filePath, label) => {
  const absolutePath = assertProjectPath(filePath, label);
  const projectRelative = relative(projectRoot, absolutePath);
  let cursor = projectRoot;
  for (const segment of projectRelative.split(sep).filter(Boolean)) {
    cursor = join(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`${label}路径不得经过符号链接：${filePath}`);
    }
  }
  return absolutePath;
};

const isSameOrInside = (candidatePath, directoryPath) => {
  const relation = relative(directoryPath, candidatePath);
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
};

const pathsOverlap = (leftPath, rightPath) =>
  isSameOrInside(leftPath, rightPath) || isSameOrInside(rightPath, leftPath);

export const generatedVideoPlanPathFor = (videoId) =>
  `edit/${videoId}/generated-video-plan_${videoId}_v1.json`;

export const generatedVideoWorkflowRootFor = (planId) =>
  `edit/generated-video/${planId}`;

export const generatedVideoMediaRootFor = (videoId, planId) =>
  `remotion/public/media/${videoId}/generated-video/${planId}`;

export const generatedVideoRenderSourceFor = (videoId, planId, shotId) =>
  `media/${videoId}/generated-video/${planId}/${shotId}.mp4`;

export const approvalReceiptRelativePathFor = (approvalId) => {
  if (!isText(approvalId)) return null;
  const digest = createHash('sha256').update(approvalId.trim()).digest('hex');
  return `edit/generated-video/approval-receipts/${digest}.json`;
};

export const assertGeneratedVideoPlanPathIsolation = ({
  plan,
  planPath,
  derivedPaths = [],
}) => {
  const actualPlanPath = assertNoSymlinkComponents(planPath, '生成视频拆镜计划');
  const expectedPlanPath = isText(plan?.videoId)
    ? generatedVideoPlanPathFor(plan.videoId)
    : null;
  if (
    !isText(plan?.planPath) ||
    !isText(expectedPlanPath) ||
    resolveProjectPath(plan.planPath) !== resolveProjectPath(expectedPlanPath) ||
    actualPlanPath !== resolveProjectPath(expectedPlanPath)
  ) {
    throw new Error(
      `生成视频拆镜计划必须固定为 ${expectedPlanPath ?? 'edit/<videoId>/generated-video-plan_<videoId>_v1.json'}，且 plan.planPath 必须与实际读取路径一致。`,
    );
  }

  const protectedRuntimeRoots = [
    isText(plan?.planId) ? generatedVideoWorkflowRootFor(plan.planId) : null,
    isText(plan?.videoId) && isText(plan?.planId)
      ? generatedVideoMediaRootFor(plan.videoId, plan.planId)
      : null,
  ].filter(isText);
  for (const runtimeRoot of protectedRuntimeRoots) {
    const absoluteRuntimeRoot = assertNoSymlinkComponents(runtimeRoot, '生成视频运行产物目录');
    if (pathsOverlap(actualPlanPath, absoluteRuntimeRoot)) {
      throw new Error(
        `生成视频拆镜计划不得位于运行产物目录内，也不得作为其父目录：${runtimeRoot}`,
      );
    }
  }

  for (const entry of derivedPaths) {
    const label = isObject(entry) ? entry.label : '生成视频派生产物';
    const filePath = isObject(entry) ? entry.path : entry;
    if (!isText(filePath)) continue;
    const absoluteDerivedPath = assertNoSymlinkComponents(filePath, label);
    if (pathsOverlap(actualPlanPath, absoluteDerivedPath)) {
      throw new Error(`${label}不得覆盖、包含或被包含于生成视频拆镜计划路径：${filePath}`);
    }
  }
  return actualPlanPath;
};

const readJson = (filePath, label) => {
  const absolutePath = assertNoSymlinkComponents(filePath, label);
  if (!existsSync(absolutePath)) {
    throw new Error(`${label}不存在：${filePath}`);
  }
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${label}无法解析：${filePath}（${error instanceof Error ? error.message : String(error)}）`,
    );
  }
};

const stableValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
};

export const stableJsonSha256 = (value) =>
  createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');

export const sha256File = (filePath) =>
  createHash('sha256')
    .update(readFileSync(assertNoSymlinkComponents(filePath, '哈希文件')))
    .digest('hex');

export const generationDefinition = (plan) => ({
  schemaVersion: plan.schemaVersion,
  planId: plan.planId,
  videoId: plan.videoId,
  videoTitle: plan.videoTitle,
  planPath: plan.planPath,
  visualPlan: plan.visualPlan,
  scope: plan.scope,
  styleReference: plan.styleReference,
  provider: plan.provider,
  outputs: {
    rootDir: plan.outputs?.rootDir,
    ledgerPath: plan.outputs?.ledgerPath,
  },
  shots: (plan.shots ?? []).map(({output, qa, ...definition}) => definition),
});

export const generationDefinitionSha256 = (plan) =>
  stableJsonSha256(generationDefinition(plan));

export const buildH3RequestDefinition = (shot) => ({
  prompt: String(shot?.promptCore?.compiledPrompt ?? '').trim(),
  resolution: RUNNINGHUB_H3_CONTRACT.resolution,
  duration: String(shot?.timing?.durationSeconds),
  ratio: RUNNINGHUB_H3_CONTRACT.ratio,
  aigc_watermark: RUNNINGHUB_H3_CONTRACT.aigcWatermark,
});

const costAuthorizationSnapshot = (authorization = {}) => ({
  approvalId: authorization.approvalId,
  approvedBy: authorization.approvedBy,
  approvedAt: authorization.approvedAt,
  expiresAt: authorization.expiresAt,
  status: authorization.status,
  scope: authorization.scope,
  maxPerShotCny: authorization.maxPerShotCny,
  maxAmountCny: authorization.maxAmountCny,
  currency: authorization.currency,
  maxAttemptsPerShot: authorization.maxAttemptsPerShot,
  automaticRetry: authorization.automaticRetry,
});

export const stableJsonFileSha256 = (filePath, label = 'JSON文件') =>
  stableJsonSha256(readJson(filePath, label));

export const generatedVideoEvidenceBinding = (plan, style) => ({
  generationDefinitionSha256: generationDefinitionSha256(plan),
  visualPlanSha256: stableJsonFileSha256(plan.visualPlan, 'V8视觉方案'),
  styleSha256: stableJsonSha256(style),
});

export const loadPlanAndStyle = (planPath, explicitStylePath = null) => {
  const plan = readJson(planPath, '生成视频拆镜计划');
  const planAbsolutePath = assertGeneratedVideoPlanPathIsolation({
    plan,
    planPath,
    derivedPaths: [
      {label: '生成账本', path: plan.outputs?.ledgerPath},
      {label: '报价回执', path: plan.outputs?.quotePath},
      {label: '费用批准消费回执', path: plan.outputs?.approvalReceiptPath},
      {label: '全局联系表', path: plan.outputs?.contactSheetPath},
      {label: '全局QA报告', path: plan.outputs?.qaReportPath},
      ...(plan.shots ?? []).flatMap((shot) => [
        {label: `镜头${shot.id}输出`, path: shot.output?.videoPath},
        {label: `镜头${shot.id}联系表`, path: shot.qa?.contactSheetPath},
        {label: `镜头${shot.id}QA报告`, path: shot.qa?.reportPath},
      ]),
    ],
  });
  const stylePath = explicitStylePath ?? plan.styleReference?.path;
  if (!isText(stylePath)) {
    throw new Error('生成视频拆镜计划缺少 styleReference.path。');
  }
  const style = readJson(stylePath, '纸构推演风格卡');
  const styleAbsolutePath = assertNoSymlinkComponents(stylePath, '纸构推演风格卡');
  const protectedInputs = new Set(
    [planAbsolutePath, styleAbsolutePath, plan.visualPlan]
      .filter(isText)
      .map((filePath) => resolveProjectPath(filePath)),
  );
  for (const [field, filePath] of Object.entries({
    ledgerPath: plan.outputs?.ledgerPath,
    quotePath: plan.outputs?.quotePath,
    approvalReceiptPath: plan.outputs?.approvalReceiptPath,
    contactSheetPath: plan.outputs?.contactSheetPath,
    qaReportPath: plan.outputs?.qaReportPath,
    ...Object.fromEntries(
      (plan.shots ?? []).map((shot) => [`shot:${shot.id}`, shot.output?.videoPath]),
    ),
  })) {
    if (isText(filePath) && protectedInputs.has(resolveProjectPath(filePath))) {
      throw new Error(
        `生成输出${field}不得覆盖计划、风格卡或V8视觉方案：${filePath}`,
      );
    }
  }
  return {
    plan,
    style,
    planPath: planAbsolutePath,
    stylePath: styleAbsolutePath,
    planSha256: stableJsonSha256(plan),
    styleSha256: stableJsonSha256(style),
  };
};

const joinChinese = (values) =>
  values.filter(isText).map((value) => value.trim()).join('、');
const promptPhrase = (value) =>
  isText(value)
    ? value.trim().replace(/[。；，、.!！？?;；:：]+$/u, '')
    : '';

export const compileShotPrompt = (plan, style, shot) => {
  const action = shot.singleAction?.actions?.[0] ?? {};
  const palette = style.visualLock?.palette ?? {};
  const hex = Array.isArray(palette.approximateHex)
    ? palette.approximateHex.join('、')
    : '';
  const materials = joinChinese(style.visualLock?.materials ?? []);
  const negatives = joinChinese(style.negativeLock ?? []);
  const duration = shot.timing?.durationSeconds;
  const actionEnd = shot.timing?.action?.endSeconds;
  const holdDuration = isFiniteNumber(duration) && isFiniteNumber(actionEnd)
    ? Number((duration - actionEnd).toFixed(3))
    : '';

  return [
    `【用途边界】仅生成口播中的 AI 概念演绎插片，证据用途固定为 illustration-only，不替代真人、真实界面、截图、数据或来源证据。`,
    `【风格身份】${style.nameZh ?? '纸构推演 v1'}；手工纸构微缩推演与编辑式纸张拼贴，保持克制、清楚、可解释。`,
    `【本镜概念】口播锚点“${shot.spokenAnchor?.text ?? ''}”；选择原因：${promptPhrase(shot.selectionReason)}；画面隐喻：${promptPhrase(shot.promptCore?.visualMetaphor)}。`,
    `【三段因果】初始状态：${promptPhrase(shot.causalChain?.initialState)}；物理原因：${promptPhrase(shot.causalChain?.physicalCause)}；结果状态：${promptPhrase(shot.causalChain?.resultState)}。`,
    `【唯一动作】一镜一个可见物理因果动作；${promptPhrase(action.actor)}${promptPhrase(action.verb)}${promptPhrase(action.object)}，可见施力：${promptPhrase(action.visibleCause)}，可见结果：${promptPhrase(action.visibleEffect)}；机制=${shot.mechanism ?? ''}。`,
    `【开场与收束】开场画面：${promptPhrase(shot.promptCore?.openingFrame)}；动作指令：${promptPhrase(shot.promptCore?.actionInstruction)}；收束画面：${promptPhrase(shot.promptCore?.closingFrame)}。`,
    `【材质锁】${materials}；必须清楚出现可见纸纤维、自然撕边、纸板层厚和接触阴影。`,
    `【色彩锁】暖纸色70%＋海军蓝20%＋砖红10%；近似色 ${hex}；暖纸色为大底，海军蓝承担结构，砖红只标关键节点。`,
    `【构图锁】${shot.composition?.view ?? ''}，单一主物件“${promptPhrase(shot.composition?.mainSubject)}”居中，保留负空间；底部18%字幕安全区不得放关键物体；标签保持空白，准确中文由 Remotion 后期加入。`,
    `【镜头锁】${shot.camera?.movement ?? ''}机位；${promptPhrase(shot.camera?.framing)}；固定镜头或极慢推近，微缩中长焦观感，轻微景深，无手持抖动和超广角变形。`,
    `【连续性锁】物体身份锁：${promptPhrase(shot.continuity?.objectIdentityLock)}；形状锁：${promptPhrase(shot.continuity?.shapeLock)}；接触连续性锁：${promptPhrase(shot.continuity?.contactContinuity)}。`,
    `【时间锁】总时长${duration}秒；0—0.8秒建立场景；0.8秒开始唯一动作，${actionEnd}秒前完成；结尾至少0.8秒定格，本镜实际稳定停留${holdDuration}秒。`,
    `【光影与节奏】暖色柔光从左上方落下，低反差、轻暗角、轻纸面颗粒；动作呈轻微定格步进、停顿和回弹。`,
    `【禁止项】禁止真人和人的手；禁止真实地点；禁止随机文字、品牌和水印；禁止液化、光滑通用3D、像素风和8-bit；同时排除：${negatives}。`,
    `【输出】RunningHub，MiniMax-H3，2K，16:9，${duration}秒；画面无声也应在三秒内看懂因果。`,
  ].join('\n');
};

const addTextCheck = (errors, value, code, message) => {
  if (!isText(value)) {
    errors.push({code, message});
  }
};

const addPathExistenceCheck = (errors, filePath, code, label) => {
  if (!isText(filePath)) {
    errors.push({code, message: `${label}路径未填写。`});
  } else {
    try {
      const absolutePath = assertNoSymlinkComponents(filePath, label);
      if (!existsSync(absolutePath)) {
        errors.push({code, message: `${label}不存在：${filePath}`});
      }
    } catch (error) {
      errors.push({
        code: `${code}_OUTSIDE_PROJECT`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

const addProjectPathCheck = (errors, filePath, code, label) => {
  if (!isText(filePath)) {
    errors.push({code, message: `${label}路径未填写。`});
    return;
  }
  try {
    assertNoSymlinkComponents(filePath, label);
  } catch (error) {
    errors.push({
      code,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const addExactProjectPathCheck = (
  errors,
  filePath,
  expectedPath,
  code,
  label,
) => {
  addProjectPathCheck(errors, filePath, code, label);
  if (
    isText(filePath) &&
    isText(expectedPath) &&
    resolveProjectPath(filePath) !== resolveProjectPath(expectedPath)
  ) {
    errors.push({
      code,
      message: `${label}必须固定为 ${expectedPath}，当前为 ${filePath}。`,
    });
  }
};

export const validateGeneratedVideoPlan = (
  plan,
  style,
  {phase = 'plan', now = () => new Date().toISOString()} = {},
) => {
  const errors = [];
  const warnings = [];
  const compiledPrompts = {};
  const supportedPhases = new Set(['plan', 'submit', 'materialized']);

  if (!supportedPhases.has(phase)) {
    errors.push({
      code: 'PHASE_INVALID',
      message: `phase 必须是 plan、submit 或 materialized，当前为 ${phase}。`,
    });
    return {ok: false, phase, errors, warnings, compiledPrompts};
  }

  if (plan.schemaVersion !== 'generated-video-plan/v1') {
    errors.push({
      code: 'SCHEMA_VERSION_INVALID',
      message: 'schemaVersion 必须为 generated-video-plan/v1。',
    });
  }
  addTextCheck(errors, plan.planId, 'PLAN_ID_REQUIRED', 'planId 不能为空。');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(plan.planId ?? '')) {
    errors.push({
      code: 'PLAN_ID_UNSAFE',
      message: 'planId 只能包含字母、数字、点、下划线和连字符，且不得超过128字符。',
    });
  }
  addTextCheck(errors, plan.videoId, 'VIDEO_ID_REQUIRED', 'videoId 不能为空。');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(plan.videoId ?? '')) {
    errors.push({
      code: 'VIDEO_ID_UNSAFE',
      message: 'videoId 只能包含字母、数字、点、下划线和连字符，且不得超过128字符。',
    });
  }
  const expectedPlanPath = isText(plan.videoId)
    ? generatedVideoPlanPathFor(plan.videoId)
    : null;
  addExactProjectPathCheck(
    errors,
    plan.planPath,
    expectedPlanPath,
    'PLAN_PATH_INVALID',
    '生成视频拆镜计划',
  );
  addTextCheck(
    errors,
    plan.productionStatus,
    'PRODUCTION_STATUS_REQUIRED',
    'productionStatus 不能为空。',
  );

  if (plan.scope !== PLAN_SCOPE) {
    errors.push({
      code: 'SCOPE_FORBIDDEN',
      message: `scope 只能为 ${PLAN_SCOPE}；source-evidence 或其他证据用途禁止进入生成视频计划。`,
    });
  }
  if (style.id !== STYLE_ID || plan.styleReference?.id !== STYLE_ID) {
    errors.push({
      code: 'STYLE_REFERENCE_INVALID',
      message: `styleReference.id 与风格卡 id 必须均为 ${STYLE_ID}。`,
    });
  }
  if (
    style.primaryEvidence?.sha256 !==
    'f172d6dc4831ce51bdecfe1359b1187666cad23c098c402edfc6836e3e553949'
  ) {
    errors.push({
      code: 'STYLE_EVIDENCE_SHA_INVALID',
      message: '纸构推演风格卡未绑定用户确认的最终样片 SHA-256。',
    });
  }
  if (plan.styleReference?.sourceSampleSha256 !== style.primaryEvidence?.sha256) {
    errors.push({
      code: 'STYLE_SAMPLE_MISMATCH',
      message: 'styleReference.sourceSampleSha256 与风格卡证据哈希不一致。',
    });
  }
  addExactProjectPathCheck(
    errors,
    plan.styleReference?.path,
    'workflow/style-library/koubo-paper-construct-v1.json',
    'STYLE_PATH_OUTSIDE_PROJECT',
    '纸构推演风格卡',
  );
  const workflowRoot = isText(plan.planId)
    ? generatedVideoWorkflowRootFor(plan.planId)
    : null;
  const mediaRoot = isText(plan.videoId) && isText(plan.planId)
    ? generatedVideoMediaRootFor(plan.videoId, plan.planId)
    : null;
  for (const [field, expectedPath, label] of [
    ['rootDir', mediaRoot, '生成视频输出目录'],
    ['ledgerPath', workflowRoot ? `${workflowRoot}/generation-ledger.json` : null, '生成账本'],
    ['quotePath', workflowRoot ? `${workflowRoot}/latest-quote.json` : null, '报价回执'],
    ['contactSheetPath', workflowRoot ? `${workflowRoot}/contact-sheet.jpg` : null, '全局联系表'],
    ['qaReportPath', workflowRoot ? `${workflowRoot}/qa-report.json` : null, '全局QA报告'],
  ]) {
    addExactProjectPathCheck(
      errors,
      plan.outputs?.[field],
      expectedPath,
      'OUTPUT_PATH_OUTSIDE_PROJECT',
      label,
    );
  }

  const protectedPathEntries = [
    ['planPath', plan.planPath],
    ['styleReference.path', plan.styleReference?.path],
    ['visualPlan', plan.visualPlan],
    ['outputs.ledgerPath', plan.outputs?.ledgerPath],
    ['outputs.quotePath', plan.outputs?.quotePath],
    ['outputs.contactSheetPath', plan.outputs?.contactSheetPath],
    ['outputs.qaReportPath', plan.outputs?.qaReportPath],
    ['outputs.approvalReceiptPath', plan.outputs?.approvalReceiptPath],
    ...(Array.isArray(plan.shots)
      ? plan.shots.map((shot) => [`shots.${shot.id}.output.videoPath`, shot.output?.videoPath])
      : []),
  ].filter(([, filePath]) => isText(filePath));
  const pathOwners = new Map();
  for (const [owner, filePath] of protectedPathEntries) {
    const absolutePath = resolveProjectPath(filePath);
    if (pathOwners.has(absolutePath)) {
      errors.push({
        code: 'MANAGED_PATH_COLLISION',
        message: `${owner} 与 ${pathOwners.get(absolutePath)} 指向同一路径：${filePath}。`,
      });
    } else {
      pathOwners.set(absolutePath, owner);
    }
  }
  if (isText(plan.planPath)) {
    const absolutePlanPath = resolveProjectPath(plan.planPath);
    for (const [label, runtimeRoot] of [
      ['生成视频运行产物目录', workflowRoot],
      ['生成视频媒体目录', mediaRoot],
    ]) {
      if (isText(runtimeRoot) && pathsOverlap(absolutePlanPath, resolveProjectPath(runtimeRoot))) {
        errors.push({
          code: 'PLAN_PATH_RUNTIME_OVERLAP',
          message: `生成视频拆镜计划不得与${label}互为父子路径：${runtimeRoot}。`,
        });
      }
    }
  }

  const provider = plan.provider ?? {};
  const validProvider =
    provider.platform === 'RunningHub' &&
    provider.model === 'MiniMax-H3' &&
    provider.resolution === '2K' &&
    provider.aspectRatio === '16:9' &&
    provider.clipDurationSeconds?.min === 5 &&
    provider.clipDurationSeconds?.max === 15;
  if (!validProvider) {
    errors.push({
      code: 'PROVIDER_ROUTE_INVALID',
      message: '提供商路由必须锁定为 RunningHub / MiniMax-H3 / 2K / 16:9 / 5—15 秒。',
    });
  }

  let visualPlan = null;
  if (!isText(plan.visualPlan)) {
    errors.push({
      code: 'VISUAL_PLAN_REQUIRED',
      message: '生成视频计划必须绑定 V8 visual-plan 路径。',
    });
  } else {
    try {
      visualPlan = readJson(plan.visualPlan, 'V8视觉方案');
    } catch (error) {
      errors.push({
        code: 'VISUAL_PLAN_UNREADABLE',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (visualPlan) {
    if (
      visualPlan.schemaVersion !== 4 ||
      visualPlan.experiment?.id !== 'v8-semantic-continuity-sfx'
    ) {
      errors.push({
        code: 'VISUAL_PLAN_VERSION_INVALID',
        message: '自动生成插片只能绑定 schemaVersion=4 的 V8 视觉方案。',
      });
    }
    if (visualPlan.videoId !== plan.videoId) {
      errors.push({
        code: 'VISUAL_PLAN_VIDEO_ID_MISMATCH',
        message: '生成视频计划与 V8 视觉方案的 videoId 不一致。',
      });
    }
    if (!visualPlan.styleReferenceIds?.includes(STYLE_ID)) {
      errors.push({
        code: 'VISUAL_PLAN_STYLE_REFERENCE_MISSING',
        message: `V8 视觉方案 styleReferenceIds 必须包含 ${STYLE_ID}。`,
      });
    }
  }

  const shots = Array.isArray(plan.shots) ? plan.shots : [];
  if (shots.length === 0) {
    errors.push({
      code: 'SHOTS_REQUIRED',
      message: 'shots 至少包含一个镜头；镜头数按口播语义变化，不固定为五镜。',
    });
  }
  const allowedMechanisms = new Set(style.visualLock?.motion?.mechanisms ?? []);
  const allowedViews = new Set(style.visualLock?.composition?.allowedViews ?? []);
  const allowedCameraMovements = new Set(
    style.visualLock?.camera?.allowedMovements ?? [],
  );
  const forbiddenShorthand = style.promptContract?.forbiddenShorthand ?? [];
  const requiredTokens = style.promptContract?.requiredLiteralTokens ?? [];
  const providerLayers = (Array.isArray(visualPlan?.layers) ? visualPlan.layers : [])
    .filter((layer) => {
      const assetSource = String(layer.asset?.source ?? '').replaceAll('\\', '/');
      const fixedMediaPrefix = isText(mediaRoot) ? `${mediaRoot}/` : '';
      const assetFileName = assetSource.slice(assetSource.lastIndexOf('/') + 1);
      const fixedPlanMediaSegment = isText(plan.planId)
        ? `/generated-video/${plan.planId}/`
        : '';
      const fixedGeneratedOutput =
        /^G\d{2}\.mp4$/u.test(assetFileName) &&
        ((isText(fixedMediaPrefix) && assetSource.startsWith(fixedMediaPrefix)) ||
          (isText(fixedPlanMediaSegment) &&
            assetSource.includes(fixedPlanMediaSegment)));
      return (
        layer.asset?.sourceType === 'provider-generated-video' ||
        fixedGeneratedOutput ||
        layer.assetDecision?.producer === 'codex-provider'
      );
    });
  if (visualPlan && providerLayers.length !== shots.length) {
    errors.push({
      code: 'VISUAL_PLAN_SHOT_COUNT_MISMATCH',
      message: `V8 视觉方案含 ${providerLayers.length} 个自动生成图层，拆镜计划含 ${shots.length} 个镜头，必须一一对应。`,
    });
  }
  const layerById = new Map(providerLayers.map((layer) => [layer.id, layer]));
  const seenRequestIds = new Set();
  const seenLayerIds = new Set();

  for (const [index, shot] of shots.entries()) {
    const expectedId = `G${String(index + 1).padStart(2, '0')}`;
    const label = `shots[${index}](${shot.id ?? '未命名'})`;
    if (shot.id !== expectedId) {
      errors.push({
        code: 'SHOT_ID_SEQUENCE_INVALID',
        message: `${label} 必须连续编号为 ${expectedId}。`,
      });
    }
    addTextCheck(
      errors,
      shot.requestId,
      'SHOT_REQUEST_ID_REQUIRED',
      `${label} 缺少 requestId。`,
    );
    addTextCheck(
      errors,
      shot.layerId,
      'SHOT_LAYER_ID_REQUIRED',
      `${label} 缺少 layerId。`,
    );
    if (isText(shot.requestId) && seenRequestIds.has(shot.requestId)) {
      errors.push({
        code: 'SHOT_REQUEST_ID_DUPLICATED',
        message: `${label} requestId 重复：${shot.requestId}。`,
      });
    }
    if (isText(shot.layerId) && seenLayerIds.has(shot.layerId)) {
      errors.push({
        code: 'SHOT_LAYER_ID_DUPLICATED',
        message: `${label} layerId 重复：${shot.layerId}。`,
      });
    }
    if (isText(shot.requestId)) seenRequestIds.add(shot.requestId);
    if (isText(shot.layerId)) seenLayerIds.add(shot.layerId);
    const boundLayer = layerById.get(shot.layerId);
    if (visualPlan && !boundLayer) {
      errors.push({
        code: 'VISUAL_PLAN_LAYER_BINDING_MISSING',
        message: `${label} 找不到对应的 codex-provider 图层：${shot.layerId ?? '未填写'}。`,
      });
    } else if (boundLayer) {
      if (boundLayer.assetDecision?.requestId !== shot.requestId) {
        errors.push({
          code: 'VISUAL_PLAN_REQUEST_ID_MISMATCH',
          message: `${label} requestId 与 V8 图层不一致。`,
        });
      }
      if (
        boundLayer.spokenLine !== shot.spokenAnchor?.text ||
        !nearlyEqual(boundLayer.start, shot.spokenAnchor?.startSeconds) ||
        !nearlyEqual(boundLayer.end, shot.spokenAnchor?.endSeconds)
      ) {
        errors.push({
          code: 'VISUAL_PLAN_SPOKEN_BINDING_MISMATCH',
          message: `${label} 的原句与起止时间必须逐项绑定 V8 图层。`,
        });
      }
      if (
        boundLayer.purpose !== 'concept-illustration' ||
        boundLayer.asset?.sourceType !== 'provider-generated-video' ||
        boundLayer.assetDecision?.class !== 'generated-video' ||
        boundLayer.assetDecision?.producer !== 'codex-provider' ||
        boundLayer.assetDecision?.evidenceUse !== 'illustration-only' ||
        boundLayer.assetDecision?.styleReferenceId !== STYLE_ID ||
        boundLayer.assetDecision?.fallback !== 'speaker-plus-information' ||
        boundLayer.params?.disclosure !== 'AI生成·概念演绎' ||
        boundLayer.params?.badge !== '非真实业务证据'
      ) {
        errors.push({
          code: 'VISUAL_PLAN_PROVIDER_BOUNDARY_INVALID',
          message: `${label} 对应图层未完整声明概念演绎、纸构风格、非证据用途和安全降级。`,
        });
      }
    }
    if (shot.assetClass !== 'generated-video') {
      errors.push({
        code: 'SHOT_ASSET_CLASS_INVALID',
        message: `${label} assetClass 必须为 generated-video。`,
      });
    }
    if (shot.evidenceUse !== 'illustration-only') {
      errors.push({
        code: 'EVIDENCE_USE_FORBIDDEN',
        message: `${label} evidenceUse 只能为 illustration-only；source-evidence 必须失败。`,
      });
    }

    addTextCheck(
      errors,
      shot.spokenAnchor?.text,
      'SPOKEN_ANCHOR_REQUIRED',
      `${label} 缺少 spokenAnchor.text。`,
    );
    if (
      !isFiniteNumber(shot.spokenAnchor?.startSeconds) ||
      !isFiniteNumber(shot.spokenAnchor?.endSeconds) ||
      shot.spokenAnchor.startSeconds < 0 ||
      shot.spokenAnchor.endSeconds <= shot.spokenAnchor.startSeconds
    ) {
      errors.push({
        code: 'SPOKEN_ANCHOR_RANGE_INVALID',
        message: `${label} spokenAnchor 必须包含有效的口播起止时间。`,
      });
    }
    addTextCheck(
      errors,
      shot.selectionReason,
      'SELECTION_REASON_REQUIRED',
      `${label} 缺少 selectionReason。`,
    );
    for (const field of ['initialState', 'physicalCause', 'resultState']) {
      addTextCheck(
        errors,
        shot.causalChain?.[field],
        'CAUSAL_CHAIN_INCOMPLETE',
        `${label} 三段因果链缺少 ${field}。`,
      );
    }

    const actions = Array.isArray(shot.singleAction?.actions)
      ? shot.singleAction.actions
      : [];
    if (actions.length !== 1) {
      errors.push({
        code: 'SINGLE_ACTION_REQUIRED',
        message: `${label} 必须且只能声明一个可见物理动作，当前为 ${actions.length} 个。`,
      });
    } else {
      for (const field of ['verb', 'actor', 'object', 'visibleCause', 'visibleEffect']) {
        addTextCheck(
          errors,
          actions[0]?.[field],
          'SINGLE_ACTION_INCOMPLETE',
          `${label} 唯一动作缺少 ${field}。`,
        );
      }
    }
    if (!allowedMechanisms.has(shot.mechanism)) {
      errors.push({
        code: 'MECHANISM_INVALID',
        message: `${label} mechanism 必须来自风格卡机制枚举。`,
      });
    }

    if (!allowedViews.has(shot.composition?.view)) {
      errors.push({
        code: 'COMPOSITION_VIEW_INVALID',
        message: `${label} 只允许正面微缩 front-miniature 或俯拍 top-down。`,
      });
    }
    addTextCheck(
      errors,
      shot.composition?.mainSubject,
      'MAIN_SUBJECT_REQUIRED',
      `${label} 缺少单一主物件。`,
    );
    if (shot.composition?.mainSubjectCount !== 1) {
      errors.push({
        code: 'MAIN_SUBJECT_COUNT_INVALID',
        message: `${label} mainSubjectCount 必须为 1。`,
      });
    }
    if (
      !isFiniteNumber(shot.composition?.subtitleSafeBottomRatio) ||
      shot.composition.subtitleSafeBottomRatio < 0.18
    ) {
      errors.push({
        code: 'SUBTITLE_SAFE_AREA_INVALID',
        message: `${label} 必须保留至少底部18%字幕安全区。`,
      });
    }
    if (shot.composition?.labels !== 'blank-remotion-later') {
      errors.push({
        code: 'LABEL_POLICY_INVALID',
        message: `${label} 标签必须保持空白并由 Remotion 后期加字。`,
      });
    }
    if (!allowedCameraMovements.has(shot.camera?.movement)) {
      errors.push({
        code: 'CAMERA_MOVEMENT_INVALID',
        message: `${label} camera.movement 只能为 fixed 或 slow-push。`,
      });
    }
    addTextCheck(
      errors,
      shot.camera?.framing,
      'CAMERA_FRAMING_REQUIRED',
      `${label} 缺少 camera.framing。`,
    );

    for (const [field, name] of [
      ['objectIdentityLock', '物体身份锁'],
      ['shapeLock', '形状锁'],
      ['contactContinuity', '接触连续性锁'],
    ]) {
      addTextCheck(
        errors,
        shot.continuity?.[field],
        'CONTINUITY_LOCK_INCOMPLETE',
        `${label} 缺少${name}。`,
      );
    }

    const timing = shot.timing ?? {};
    const duration = timing.durationSeconds;
    const establish = timing.establish ?? {};
    const action = timing.action ?? {};
    const hold = timing.finalHold ?? {};
    if (
      !isFiniteNumber(duration) ||
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 15
    ) {
      errors.push({
        code: 'SHOT_DURATION_INVALID',
        message: `${label} durationSeconds 必须是 5—15 秒整数。`,
      });
    }
    if (!nearlyEqual(establish.startSeconds, 0) || !nearlyEqual(establish.endSeconds, 0.8)) {
      errors.push({
        code: 'ESTABLISH_TIMING_INVALID',
        message: `${label} 建立段必须为 0—0.8 秒。`,
      });
    }
    if (!nearlyEqual(action.startSeconds, 0.8)) {
      errors.push({
        code: 'ACTION_START_INVALID',
        message: `${label} 唯一动作必须从 0.8 秒开始。`,
      });
    }
    if (
      !isFiniteNumber(action.endSeconds) ||
      !isFiniteNumber(duration) ||
      action.endSeconds - action.startSeconds < 0.8 - EPSILON ||
      action.endSeconds > duration - 0.8 + EPSILON
    ) {
      errors.push({
        code: 'ACTION_TIMING_INVALID',
        message: `${label} 动作至少持续 0.8 秒，并须在结尾定格前完成。`,
      });
    }
    if (
      !isFiniteNumber(duration) ||
      !nearlyEqual(hold.startSeconds, action.endSeconds) ||
      !nearlyEqual(hold.endSeconds, duration) ||
      hold.endSeconds - hold.startSeconds < 0.8 - EPSILON
    ) {
      errors.push({
        code: 'FINAL_HOLD_TOO_SHORT',
        message: `${label} 结尾稳定停留必须连续且至少 0.8 秒。`,
      });
    }

    for (const field of [
      'concept',
      'visualMetaphor',
      'openingFrame',
      'actionInstruction',
      'closingFrame',
    ]) {
      addTextCheck(
        errors,
        shot.promptCore?.[field],
        'PROMPT_CORE_INCOMPLETE',
        `${label} promptCore 缺少 ${field}。`,
      );
    }

    const compiled = compileShotPrompt(plan, style, shot);
    compiledPrompts[shot.id ?? expectedId] = compiled;
    if (!isText(shot.promptCore?.compiledPrompt)) {
      errors.push({
        code: 'COMPILED_PROMPT_REQUIRED',
        message: `${label} 缺少独立完整的 promptCore.compiledPrompt。`,
      });
    } else if (shot.promptCore.compiledPrompt.trim() !== compiled.trim()) {
      errors.push({
        code: 'COMPILED_PROMPT_STALE',
        message: `${label} compiledPrompt 与当前风格锁及镜头变量不一致，必须重新完整编译。`,
      });
    }
    const allPromptText = [
      shot.promptCore?.concept,
      shot.promptCore?.visualMetaphor,
      shot.promptCore?.openingFrame,
      shot.promptCore?.actionInstruction,
      shot.promptCore?.closingFrame,
      shot.promptCore?.compiledPrompt,
    ].filter(isText).join('\n');
    for (const shorthand of forbiddenShorthand) {
      if (isText(shorthand) && allPromptText.toLowerCase().includes(shorthand.toLowerCase())) {
        errors.push({
          code: 'PROMPT_SHORTHAND_FORBIDDEN',
          message: `${label} 提示词禁止使用省略表达“${shorthand}”。`,
        });
      }
    }
    for (const token of requiredTokens) {
      if (!compiled.includes(token)) {
        errors.push({
          code: 'STYLE_LOCK_TOKEN_MISSING',
          message: `${label} 编译提示词缺少风格锁词：${token}`,
        });
      }
    }

    if (shot.fallback !== 'speaker-plus-information') {
      errors.push({
        code: 'FALLBACK_INVALID',
        message: `${label} fallback 必须为 speaker-plus-information。`,
      });
    }
    if (!isObject(shot.output) || !isObject(shot.qa)) {
      errors.push({
        code: 'OUTPUT_QA_CONTRACT_REQUIRED',
        message: `${label} 必须预留 output 与 qa 合同。`,
      });
    } else {
      addTextCheck(
        errors,
        shot.output.videoPath,
        'SHOT_OUTPUT_PATH_REQUIRED',
        `${label} 必须预先声明本地输出路径。`,
      );
      addExactProjectPathCheck(
        errors,
        shot.output.videoPath,
        mediaRoot && isText(shot.id) ? `${mediaRoot}/${shot.id}.mp4` : null,
        'SHOT_OUTPUT_PATH_OUTSIDE_PROJECT',
        `${label} 本地输出视频`,
      );
      if (
        boundLayer &&
        isText(shot.output.videoPath) &&
        boundLayer.asset?.source !== shot.output.videoPath
      ) {
        errors.push({
          code: 'VISUAL_PLAN_OUTPUT_PATH_MISMATCH',
          message: `${label} 的输出路径与 V8 图层 asset.source 不一致。`,
        });
      }
      const expectedRenderSource =
        isText(plan.videoId) && isText(plan.planId) && isText(shot.id)
          ? generatedVideoRenderSourceFor(plan.videoId, plan.planId, shot.id)
          : null;
      if (
        boundLayer &&
        (!isText(expectedRenderSource) ||
          boundLayer.params?.src !== expectedRenderSource ||
          (Array.isArray(boundLayer.params?.mediaClips) &&
            boundLayer.params.mediaClips.length > 0))
      ) {
        errors.push({
          code: 'VISUAL_PLAN_RENDER_SOURCE_MISMATCH',
          message:
            `${label} 的实际 Remotion 渲染源必须唯一绑定已 QA 视频 ` +
            `${expectedRenderSource ?? '未知路径'}，不得缺失或被 mediaClips 覆盖。`,
        });
      }
    }
  }

  if (phase === 'submit' || phase === 'materialized') {
    const authorization = plan.costAuthorization ?? {};
    if (authorization.status !== 'approved') {
      errors.push({
        code: 'COST_AUTHORIZATION_REQUIRED',
        message: '提交前必须取得明确费用授权，status=approved。',
      });
    }
    addTextCheck(
      errors,
      authorization.approvalId,
      'COST_APPROVAL_ID_REQUIRED',
      '费用授权缺少非空 approvalId。',
    );
    addTextCheck(
      errors,
      authorization.approvedBy,
      'COST_APPROVER_REQUIRED',
      '费用授权缺少 approvedBy。',
    );
    const approvedAt = Date.parse(authorization.approvedAt);
    if (!isText(authorization.approvedAt) || Number.isNaN(approvedAt)) {
      errors.push({
        code: 'COST_APPROVED_AT_REQUIRED',
        message: '费用授权缺少有效的 approvedAt 时间。',
      });
    }
    const expiresAt = Date.parse(authorization.expiresAt);
    if (!isText(authorization.expiresAt) || Number.isNaN(expiresAt)) {
      errors.push({
        code: 'COST_EXPIRES_AT_REQUIRED',
        message: '费用授权缺少有效的 expiresAt 时间。',
      });
    } else if (
      !Number.isNaN(approvedAt) &&
      (expiresAt <= approvedAt || expiresAt - approvedAt > COST_AUTHORIZATION_MAX_AGE_MS)
    ) {
      errors.push({
        code: 'COST_AUTHORIZATION_WINDOW_INVALID',
        message: '费用授权有效期必须晚于 approvedAt，且最长不得超过24小时。',
      });
    }
    if (!Number.isNaN(approvedAt)) {
      const nowValue = typeof now === 'function' ? now() : now;
      const nowMs = typeof nowValue === 'number' ? nowValue : Date.parse(nowValue);
      if (!Number.isFinite(nowMs)) {
        errors.push({
          code: 'VALIDATION_TIME_INVALID',
          message: '提交门禁无法取得有效的当前时间。',
        });
      } else {
        if (approvedAt > nowMs + COST_AUTHORIZATION_FUTURE_SKEW_MS) {
          errors.push({
            code: 'COST_APPROVED_AT_IN_FUTURE',
            message: 'approvedAt 不得比当前时间晚超过5分钟。',
          });
        }
        if (phase === 'submit' && !Number.isNaN(expiresAt) && nowMs > expiresAt) {
          errors.push({
            code: 'COST_AUTHORIZATION_EXPIRED',
            message: '本次金额授权已经过期，必须重新报价并取得新授权。',
          });
        }
      }
    }
    if (
      authorization.scope?.type !== 'plan-only' ||
      authorization.scope?.planId !== plan.planId ||
      authorization.scope?.definitionSha256 !== generationDefinitionSha256(plan)
    ) {
      errors.push({
        code: 'COST_SCOPE_INVALID',
        message:
          '费用授权范围必须为 plan-only，并精确绑定当前 planId 与 generationDefinitionSha256。',
      });
    }
    if (!isFiniteNumber(authorization.maxAmountCny) || authorization.maxAmountCny <= 0) {
      errors.push({
        code: 'COST_LIMIT_INVALID',
        message: '费用授权必须包含正数 maxAmountCny 上限。',
      });
    }
    if (!isFiniteNumber(authorization.maxPerShotCny) || authorization.maxPerShotCny <= 0) {
      errors.push({
        code: 'COST_PER_SHOT_LIMIT_INVALID',
        message: '费用授权必须包含正数 maxPerShotCny 单镜上限。',
      });
    }
    if (authorization.currency !== 'CNY') {
      errors.push({
        code: 'COST_CURRENCY_INVALID',
        message: '费用币种必须为 CNY。',
      });
    }
    if (authorization.maxAttemptsPerShot !== 1) {
      errors.push({
        code: 'ATTEMPT_LIMIT_INVALID',
        message: 'maxAttemptsPerShot 必须为 1；失败后不得自动再次扣费。',
      });
    }
    if (authorization.automaticRetry !== false) {
      errors.push({
        code: 'AUTOMATIC_RETRY_FORBIDDEN',
        message: 'automaticRetry 必须为 false。',
      });
    }
    if (!['ready-for-submit', 'submitted', 'materialized', 'qa-passed'].includes(plan.productionStatus)) {
      errors.push({
        code: 'SUBMIT_STATUS_INVALID',
        message: 'submit 阶段 productionStatus 至少应为 ready-for-submit。',
      });
    }
  }

  if (phase === 'materialized') {
    if (!['materialized', 'qa-passed'].includes(plan.productionStatus)) {
      errors.push({
        code: 'MATERIALIZED_STATUS_INVALID',
        message: 'materialized 阶段 productionStatus 必须为 materialized 或 qa-passed。',
      });
    }
    addPathExistenceCheck(
      errors,
      plan.outputs?.ledgerPath,
      'LEDGER_MISSING',
      '生成账本',
    );
    addPathExistenceCheck(
      errors,
      plan.outputs?.contactSheetPath,
      'CONTACT_SHEET_MISSING',
      '全局联系表',
    );
    addPathExistenceCheck(
      errors,
      plan.outputs?.qaReportPath,
      'QA_REPORT_MISSING',
      '全局 QA 报告',
    );
    const expectedApprovalReceiptPath = approvalReceiptRelativePathFor(
      plan.costAuthorization?.approvalId,
    );
    addExactProjectPathCheck(
      errors,
      plan.outputs?.approvalReceiptPath,
      expectedApprovalReceiptPath,
      'APPROVAL_RECEIPT_PATH_INVALID',
      '费用批准消费回执',
    );
    addPathExistenceCheck(
      errors,
      plan.outputs?.approvalReceiptPath,
      'APPROVAL_RECEIPT_MISSING',
      '费用批准消费回执',
    );
    if (!/^[a-f0-9]{64}$/i.test(plan.outputs?.approvalReceiptSha256 ?? '')) {
      errors.push({
        code: 'APPROVAL_RECEIPT_SHA_REQUIRED',
        message: 'materialized 计划必须记录费用批准消费回执 SHA-256。',
      });
    }
    let ledger = null;
    const expectedEvidenceBinding = {
      generationDefinitionSha256: generationDefinitionSha256(plan),
      visualPlanSha256: visualPlan ? stableJsonSha256(visualPlan) : null,
      styleSha256: stableJsonSha256(style),
    };
    if (
      isText(plan.outputs?.ledgerPath) &&
      existsSync(resolveProjectPath(plan.outputs.ledgerPath))
    ) {
      try {
        ledger = readJson(plan.outputs.ledgerPath, '生成账本');
        if (ledger.planId !== plan.planId) {
          errors.push({
            code: 'LEDGER_PLAN_ID_MISMATCH',
            message: '生成账本 planId 与当前计划不一致。',
          });
        }
        if (ledger.schemaVersion !== 1) {
          errors.push({
            code: 'LEDGER_SCHEMA_VERSION_INVALID',
            message: '生成账本 schemaVersion 必须为 1。',
          });
        }
        if (
          ledger.planSha256 !==
          expectedEvidenceBinding.generationDefinitionSha256
        ) {
          errors.push({
            code: 'LEDGER_PLAN_SHA_MISMATCH',
            message: '生成账本未绑定当前拆镜、提示词和输出定义。',
          });
        }
        if (
          ledger.provider !== RUNNINGHUB_H3_CONTRACT.provider ||
          ledger.providerId !== RUNNINGHUB_H3_CONTRACT.providerId ||
          ledger.model !== RUNNINGHUB_H3_CONTRACT.model
        ) {
          errors.push({
            code: 'LEDGER_PROVIDER_CONTRACT_INVALID',
            message: '生成账本必须绑定固定 RunningHub / MiniMax-H3 提供商合同。',
          });
        }
        const expectedAuthorization = costAuthorizationSnapshot(
          plan.costAuthorization,
        );
        if (
          !isObject(ledger.authorization) ||
          stableJsonSha256(ledger.authorization) !==
            stableJsonSha256(expectedAuthorization)
        ) {
          errors.push({
            code: 'LEDGER_AUTHORIZATION_SNAPSHOT_MISMATCH',
            message: '生成账本 authorization 必须完整等于当前费用授权快照。',
          });
        }
        if (
          ledger.policy?.maximumPaidAttemptsPerShot !== 1 ||
          ledger.policy?.automaticPaidRetryAllowed !== false
        ) {
          errors.push({
            code: 'LEDGER_POLICY_INVALID',
            message: '生成账本必须保持每镜一次付费尝试且禁止自动付费重试。',
          });
        }
      } catch (error) {
        errors.push({
          code: 'LEDGER_UNREADABLE',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (
      isText(plan.outputs?.approvalReceiptPath) &&
      existsSync(resolveProjectPath(plan.outputs.approvalReceiptPath))
    ) {
      try {
        const approvalReceipt = readJson(
          plan.outputs.approvalReceiptPath,
          '费用批准消费回执',
        );
        const actualReceiptSha256 = sha256File(plan.outputs.approvalReceiptPath);
        if (actualReceiptSha256 !== plan.outputs.approvalReceiptSha256?.toLowerCase()) {
          errors.push({
            code: 'APPROVAL_RECEIPT_SHA_MISMATCH',
            message: '费用批准消费回执 SHA-256 与本地文件不一致。',
          });
        }
        const expectedReceiptFields = {
          schemaVersion: 'generated-video-approval-consumption/v1',
          approvalId: plan.costAuthorization?.approvalId,
          planId: plan.planId,
          definitionSha256: expectedEvidenceBinding.generationDefinitionSha256,
          approvedBy: plan.costAuthorization?.approvedBy,
          approvedAt: plan.costAuthorization?.approvedAt,
          expiresAt: plan.costAuthorization?.expiresAt,
          maxPerShotCny: plan.costAuthorization?.maxPerShotCny,
          maxAmountCny: plan.costAuthorization?.maxAmountCny,
          currency: plan.costAuthorization?.currency,
          ledgerPath: resolveProjectPath(plan.outputs?.ledgerPath),
          providerId: RUNNINGHUB_H3_CONTRACT.providerId,
        };
        for (const [field, expected] of Object.entries(expectedReceiptFields)) {
          if (approvalReceipt[field] !== expected) {
            errors.push({
              code: 'APPROVAL_RECEIPT_BINDING_INVALID',
              message: `费用批准消费回执的 ${field} 未绑定当前计划、生成定义或金额授权。`,
            });
          }
        }
        const consumedAt = Date.parse(approvalReceipt.consumedAt);
        const approvedAt = Date.parse(plan.costAuthorization?.approvedAt);
        const expiresAt = Date.parse(plan.costAuthorization?.expiresAt);
        if (
          Number.isNaN(consumedAt) ||
          Number.isNaN(approvedAt) ||
          Number.isNaN(expiresAt) ||
          consumedAt < approvedAt - COST_AUTHORIZATION_FUTURE_SKEW_MS ||
          consumedAt > expiresAt
        ) {
          errors.push({
            code: 'APPROVAL_RECEIPT_CONSUMED_AT_INVALID',
            message: '费用批准消费回执 consumedAt 必须落在本次授权有效窗口内。',
          });
        }
      } catch (error) {
        errors.push({
          code: 'APPROVAL_RECEIPT_UNREADABLE',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (ledger) {
      const expectedAttemptIds = shots.map((shot) => shot.id).sort();
      const ledgerAttempts = isObject(ledger.attempts) ? ledger.attempts : {};
      const actualAttemptIds = Object.keys(ledgerAttempts).sort();
      if (
        expectedAttemptIds.length !== actualAttemptIds.length ||
        expectedAttemptIds.some(
          (shotId, index) => shotId !== actualAttemptIds[index],
        )
      ) {
        errors.push({
          code: 'LEDGER_ATTEMPT_SET_MISMATCH',
          message:
            `生成账本 attempts 键集合必须与计划镜头精确一致；计划=${expectedAttemptIds.join(',')}，` +
            `账本=${actualAttemptIds.join(',')}。`,
        });
      }

      let ledgerReportedActualTotalCny = 0;
      for (const [shotId, attempt] of Object.entries(ledgerAttempts)) {
        if (
          attempt?.actualCostStatus !== 'reported' ||
          !isFiniteNumber(attempt?.actualCostCny) ||
          attempt.actualCostCny < 0
        ) {
          continue;
        }
        ledgerReportedActualTotalCny += attempt.actualCostCny;
        if (
          isFiniteNumber(plan.costAuthorization?.maxPerShotCny) &&
          attempt.actualCostCny >
            plan.costAuthorization.maxPerShotCny + EPSILON
        ) {
          errors.push({
            code: 'LEDGER_PER_SHOT_COST_LIMIT_EXCEEDED',
            message:
              `账本镜头${shotId}的reported实扣${attempt.actualCostCny}元超过单镜授权上限` +
              `${plan.costAuthorization.maxPerShotCny}元。`,
          });
        }
      }
      if (
        isFiniteNumber(plan.costAuthorization?.maxAmountCny) &&
        ledgerReportedActualTotalCny >
          plan.costAuthorization.maxAmountCny + EPSILON
      ) {
        errors.push({
          code: 'LEDGER_TOTAL_COST_LIMIT_EXCEEDED',
          message:
            `生成账本全部reported实扣合计${Number(ledgerReportedActualTotalCny.toFixed(6))}元` +
            `超过授权总额${plan.costAuthorization.maxAmountCny}元。`,
        });
      }
    }

    let globalQaReport = null;
    if (
      isText(plan.outputs?.qaReportPath) &&
      existsSync(resolveProjectPath(plan.outputs.qaReportPath))
    ) {
      try {
        globalQaReport = readJson(plan.outputs.qaReportPath, '全局QA报告');
        if (
          globalQaReport.schemaVersion !== 'generated-video-visual-review/v1' ||
          globalQaReport.planId !== plan.planId ||
          globalQaReport.status !== 'passed'
        ) {
          errors.push({
            code: 'QA_REPORT_STATUS_INVALID',
            message: '全局QA报告必须为当前计划的 passed 视觉复核报告。',
          });
        }
        for (const [field, expected] of Object.entries(expectedEvidenceBinding)) {
          if (globalQaReport[field] !== expected) {
            errors.push({
              code: `QA_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}_MISMATCH`,
              message: `全局QA报告的 ${field} 未绑定当前生成定义。`,
            });
          }
        }
        if (
          globalQaReport.contactSheetPath !== plan.outputs.contactSheetPath ||
          globalQaReport.contactSheetSha256 !==
            sha256File(plan.outputs.contactSheetPath)
        ) {
          errors.push({
            code: 'QA_GLOBAL_CONTACT_SHEET_MISMATCH',
            message: '全局QA报告未绑定当前全局联系表及其SHA-256。',
          });
        }
        if (
          !isText(globalQaReport.reviewer) ||
          !['human', 'codex-vision', 'vision-model'].includes(
            globalQaReport.reviewerKind,
          ) ||
          (globalQaReport.reviewerKind !== 'human' &&
            (!isText(globalQaReport.reviewerModel) ||
              !isText(globalQaReport.reviewerVersion))) ||
          Number.isNaN(Date.parse(globalQaReport.reviewedAt))
        ) {
          errors.push({
            code: 'QA_REVIEWER_EVIDENCE_INVALID',
            message: '全局QA报告必须记录复核人、复核类型和有效复核时间。',
          });
        }
        const reportShots = Array.isArray(globalQaReport.shots)
          ? globalQaReport.shots
          : [];
        const expectedShotIds = shots.map((shot) => shot.id).sort();
        const reportShotIds = reportShots.map((item) => item?.id).sort();
        if (
          expectedShotIds.length !== reportShotIds.length ||
          expectedShotIds.some((shotId, index) => shotId !== reportShotIds[index])
        ) {
          errors.push({
            code: 'QA_REPORT_SHOT_SET_MISMATCH',
            message: '全局QA报告必须与当前计划镜头集合一一对应，不得缺失、重复或夹带额外镜头。',
          });
        }
        for (const shot of shots) {
          const matches = reportShots.filter((item) => item?.id === shot.id);
          if (matches.length !== 1) continue;
          const item = matches[0];
          const itemFailures = [];
          if (item.decision !== 'passed') itemFailures.push('decision');
          for (const check of GENERATED_VIDEO_QA_CHECKS) {
            if (item.checks?.[check] !== true) {
              itemFailures.push(`checks.${check}`);
            }
            if (!isText(item.observations?.[check])) {
              itemFailures.push(`observations.${check}`);
            }
          }
          if (item.videoSha256 !== shot.output?.sha256) {
            itemFailures.push('videoSha256');
          }
          if (item.contactSheetPath !== shot.qa?.contactSheetPath) {
            itemFailures.push('contactSheetPath');
          }
          if (
            item.contactSheetSha256 !==
            shot.qa?.visualReview?.contactSheetSha256
          ) {
            itemFailures.push('contactSheetSha256');
          }
          if (item.reportPath !== shot.qa?.reportPath) {
            itemFailures.push('reportPath');
          }
          if (itemFailures.length > 0) {
            errors.push({
              code: 'QA_REPORT_SHOT_EVIDENCE_INVALID',
              message:
                `全局QA报告的镜头${shot.id}未完整绑定逐项观察和当前证据：` +
                `${itemFailures.join('、')}。`,
            });
          }
        }
      } catch (error) {
        errors.push({
          code: 'QA_REPORT_UNREADABLE',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    let totalChargedCostCny = 0;

    for (const [index, shot] of shots.entries()) {
      const label = `shots[${index}](${shot.id ?? '未命名'})`;
      addPathExistenceCheck(
        errors,
        shot.output?.videoPath,
        'SHOT_OUTPUT_MISSING',
        `${label} 本地输出视频`,
      );
      if (!/^[a-f0-9]{64}$/i.test(shot.output?.sha256 ?? '')) {
        errors.push({
          code: 'SHOT_OUTPUT_SHA_REQUIRED',
          message: `${label} 缺少有效的输出 SHA-256。`,
        });
      } else if (isText(shot.output?.videoPath) && existsSync(resolveProjectPath(shot.output.videoPath))) {
        const actualSha = sha256File(shot.output.videoPath);
        if (actualSha !== shot.output.sha256.toLowerCase()) {
          errors.push({
            code: 'SHOT_OUTPUT_SHA_MISMATCH',
            message: `${label} 输出 SHA-256 与本地文件不一致。`,
          });
        }
      }
      addTextCheck(
        errors,
        shot.output?.providerTaskId,
        'SHOT_PROVIDER_TASK_ID_REQUIRED',
        `${label} 缺少 providerTaskId。`,
      );
      if (shot.output?.attemptCount !== 1) {
        errors.push({
          code: 'SHOT_ATTEMPT_COUNT_INVALID',
          message: `${label} attemptCount 必须为 1。`,
        });
      }
      if (
        !isFiniteNumber(shot.output?.chargedCostCny) ||
        shot.output.chargedCostCny < 0 ||
        shot.output.chargedCostCny > plan.costAuthorization.maxPerShotCny
      ) {
        errors.push({
          code: 'SHOT_COST_INVALID',
          message: `${label} chargedCostCny 必须为非负数且不超过单镜授权上限。`,
        });
      } else {
        totalChargedCostCny += shot.output.chargedCostCny;
      }
      const probe = shot.output?.probe ?? {};
      const durationToleranceSeconds = 0.75;
      if (
        !isFiniteNumber(probe.width) ||
        !isFiniteNumber(probe.height) ||
        probe.width < 1920 ||
        probe.height < 1080 ||
        Math.abs(probe.width / probe.height - 16 / 9) > 0.02
      ) {
        errors.push({
          code: 'SHOT_PROBE_FRAME_INVALID',
          message: `${label} 必须是至少 1920×1080 的近似 16:9 视频。`,
        });
      }
      if (
        !isFiniteNumber(probe.durationSeconds) ||
        Math.abs(probe.durationSeconds - shot.timing?.durationSeconds) >
          durationToleranceSeconds
      ) {
        errors.push({
          code: 'SHOT_PROBE_DURATION_INVALID',
          message: `${label} 实际时长与拆镜时长偏差不得超过 ${durationToleranceSeconds} 秒。`,
        });
      }
      if (!isFiniteNumber(probe.fps) || probe.fps <= 0 || !isText(probe.codec)) {
        errors.push({
          code: 'SHOT_PROBE_STREAM_INVALID',
          message: `${label} probe 必须记录有效 fps 与视频编码。`,
        });
      }
      const ledgerAttempt = ledger?.attempts?.[shot.id];
      if (!ledgerAttempt) {
        errors.push({
          code: 'LEDGER_SHOT_ATTEMPT_MISSING',
          message: `${label} 在生成账本中没有付费任务记录。`,
        });
      } else {
        const expectedRequest = buildH3RequestDefinition(shot);
        const expectedAuthorization = costAuthorizationSnapshot(
          plan.costAuthorization,
        );
        const attemptBindingFailures = [];
        if (ledgerAttempt.shotId !== shot.id) {
          attemptBindingFailures.push('shotId');
        }
        if (ledgerAttempt.attemptNumber !== 1) {
          attemptBindingFailures.push('attemptNumber');
        }
        if (ledgerAttempt.providerId !== RUNNINGHUB_H3_CONTRACT.providerId) {
          attemptBindingFailures.push('providerId');
        }
        if (ledgerAttempt.model !== RUNNINGHUB_H3_CONTRACT.model) {
          attemptBindingFailures.push('model');
        }
        if (ledgerAttempt.modelRoute !== RUNNINGHUB_H3_CONTRACT.modelRoute) {
          attemptBindingFailures.push('modelRoute');
        }
        if (ledgerAttempt.resolution !== RUNNINGHUB_H3_CONTRACT.resolution) {
          attemptBindingFailures.push('resolution');
        }
        if (ledgerAttempt.ratio !== RUNNINGHUB_H3_CONTRACT.ratio) {
          attemptBindingFailures.push('ratio');
        }
        if (ledgerAttempt.durationSeconds !== shot.timing?.durationSeconds) {
          attemptBindingFailures.push('durationSeconds');
        }
        if (
          ledgerAttempt.requestSha256 !== stableJsonSha256(expectedRequest)
        ) {
          attemptBindingFailures.push('requestSha256');
        }
        const expectedPromptSha256 = createHash('sha256')
          .update(Buffer.from(expectedRequest.prompt))
          .digest('hex');
        if (ledgerAttempt.promptSha256 !== expectedPromptSha256) {
          attemptBindingFailures.push('promptSha256');
        }
        if (
          !isFiniteNumber(ledgerAttempt.maximumCostCny) ||
          !nearlyEqual(
            ledgerAttempt.maximumCostCny,
            plan.costAuthorization?.maxPerShotCny,
          )
        ) {
          attemptBindingFailures.push('maximumCostCny');
        }
        if (ledgerAttempt.currency !== plan.costAuthorization?.currency) {
          attemptBindingFailures.push('currency');
        }
        if (
          !isObject(ledgerAttempt.authorization) ||
          stableJsonSha256(ledgerAttempt.authorization) !==
            stableJsonSha256(expectedAuthorization)
        ) {
          attemptBindingFailures.push('authorization');
        }
        if (attemptBindingFailures.length > 0) {
          errors.push({
            code: 'LEDGER_ATTEMPT_BINDING_INVALID',
            message:
              `${label} 账本付费尝试未完整绑定当前镜头、H3请求和授权快照：` +
              `${attemptBindingFailures.join('、')}。`,
          });
        }
        if (ledgerAttempt.attemptNumber !== 1) {
          errors.push({
            code: 'LEDGER_ATTEMPT_COUNT_INVALID',
            message: `${label} 的账本付费尝试次数必须为 1。`,
          });
        }
        if (!['downloaded', 'qa-passed'].includes(ledgerAttempt.status)) {
          errors.push({
            code: 'LEDGER_SHOT_STATUS_INVALID',
            message: `${label} 的账本状态必须为 downloaded 或 qa-passed。`,
          });
        }
        if (ledgerAttempt.taskId !== shot.output?.providerTaskId) {
          errors.push({
            code: 'LEDGER_TASK_ID_MISMATCH',
            message: `${label} providerTaskId 与账本不一致。`,
          });
        }
        if (ledgerAttempt.outputSha256 !== shot.output?.sha256) {
          errors.push({
            code: 'LEDGER_OUTPUT_SHA_MISMATCH',
            message: `${label} 输出 SHA-256 与账本不一致。`,
          });
        }
        const ledgerActualCost = ledgerAttempt.actualCostCny;
        if (
          ledgerAttempt.actualCostStatus !== 'reported' ||
          !isFiniteNumber(ledgerActualCost) ||
          ledgerActualCost < 0
        ) {
          errors.push({
            code: 'LEDGER_ACTUAL_COST_EVIDENCE_INVALID',
            message: `${label} 账本必须记录 actualCostStatus=reported 与有限非负的 actualCostCny；不得用预估费用替代实扣。`,
          });
        } else if (
          !isFiniteNumber(shot.output?.chargedCostCny) ||
          Math.abs(ledgerActualCost - shot.output.chargedCostCny) > 0.0001
        ) {
          errors.push({
            code: 'LEDGER_COST_MISMATCH',
            message: `${label} chargedCostCny 与账本 reported 实扣不一致。`,
          });
        }
        if (
          !isText(ledgerAttempt.outputPath) ||
          !isText(shot.output?.videoPath) ||
          resolveProjectPath(ledgerAttempt.outputPath) !==
            resolveProjectPath(shot.output.videoPath)
        ) {
          errors.push({
            code: 'LEDGER_OUTPUT_PATH_MISMATCH',
            message: `${label} 输出路径与账本不一致。`,
          });
        }
      }
      if (shot.qa?.status !== 'passed') {
        errors.push({
          code: 'SHOT_QA_NOT_PASSED',
          message: `${label} qa.status 必须为 passed。`,
        });
      }
      if (
        shot.qa?.visualReview?.status !== 'passed' ||
        !isText(shot.qa?.visualReview?.reviewer) ||
        !['human', 'codex-vision', 'vision-model'].includes(
          shot.qa?.visualReview?.reviewerKind,
        ) ||
        (shot.qa?.visualReview?.reviewerKind !== 'human' &&
          (!isText(shot.qa?.visualReview?.reviewerModel) ||
            !isText(shot.qa?.visualReview?.reviewerVersion))) ||
        Number.isNaN(Date.parse(shot.qa?.visualReview?.reviewedAt))
      ) {
        errors.push({
          code: 'SHOT_VISUAL_REVIEW_NOT_PASSED',
          message: `${label} 必须记录带复核人和时间的逐镜视觉复核；这不替代最终成片用户验收。`,
        });
      }
      if (!/^[a-f0-9]{64}$/i.test(shot.qa?.visualReview?.contactSheetSha256 ?? '')) {
        errors.push({
          code: 'SHOT_VISUAL_REVIEW_EVIDENCE_SHA_REQUIRED',
          message: `${label} 视觉复核必须绑定联系表 SHA-256。`,
        });
      } else if (
        isText(shot.qa?.contactSheetPath) &&
        existsSync(resolveProjectPath(shot.qa.contactSheetPath)) &&
        sha256File(shot.qa.contactSheetPath) !==
          shot.qa.visualReview.contactSheetSha256.toLowerCase()
      ) {
        errors.push({
          code: 'SHOT_VISUAL_REVIEW_EVIDENCE_SHA_MISMATCH',
          message: `${label} 视觉复核绑定的联系表 SHA-256 已失效。`,
        });
      }
      if (!sameNumberArray(shot.qa?.sampleFractions, [0, 0.25, 0.5, 0.75, 1])) {
        errors.push({
          code: 'SHOT_QA_SAMPLES_INVALID',
          message: `${label} 必须抽查 0%、25%、50%、75%、100% 五个时间点。`,
        });
      }
      for (const check of GENERATED_VIDEO_QA_CHECKS) {
        if (shot.qa?.checks?.[check] !== true) {
          errors.push({
            code: 'SHOT_QA_CHECK_NOT_PASSED',
            message: `${label} QA 检查未通过：${check}。`,
          });
        }
      }
      addPathExistenceCheck(
        errors,
        shot.qa?.contactSheetPath,
        'SHOT_CONTACT_SHEET_MISSING',
        `${label} 联系表`,
      );
      addPathExistenceCheck(
        errors,
        shot.qa?.reportPath,
        'SHOT_QA_REPORT_MISSING',
        `${label} QA 报告`,
      );
      addExactProjectPathCheck(
        errors,
        shot.qa?.contactSheetPath,
        workflowRoot && isText(shot.id)
          ? `${workflowRoot}/${shot.id}-contact-sheet.jpg`
          : null,
        'SHOT_CONTACT_SHEET_PATH_INVALID',
        `${label} 联系表`,
      );
      addExactProjectPathCheck(
        errors,
        shot.qa?.reportPath,
        workflowRoot && isText(shot.id)
          ? `${workflowRoot}/${shot.id}-qa.json`
          : null,
        'SHOT_QA_REPORT_PATH_INVALID',
        `${label} QA 报告`,
      );
      if (
        isText(shot.qa?.reportPath) &&
        existsSync(resolveProjectPath(shot.qa.reportPath))
      ) {
        try {
          const shotQaReport = readJson(shot.qa.reportPath, `${label} QA报告`);
          if (
            shotQaReport.schemaVersion !== 'generated-video-shot-qa/v1' ||
            shotQaReport.planId !== plan.planId ||
            shotQaReport.shotId !== shot.id ||
            shotQaReport.status !== 'passed'
          ) {
            errors.push({
              code: 'SHOT_QA_REPORT_STATUS_INVALID',
              message: `${label} QA报告必须为当前镜头的 passed 报告。`,
            });
          }
          for (const [field, expected] of Object.entries(expectedEvidenceBinding)) {
            if (shotQaReport[field] !== expected) {
              errors.push({
                code: `SHOT_QA_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}_MISMATCH`,
                message: `${label} QA报告的 ${field} 未绑定当前生成定义。`,
              });
            }
          }
          if (shotQaReport.videoSha256 !== shot.output?.sha256) {
            errors.push({
              code: 'SHOT_QA_VIDEO_SHA_MISMATCH',
              message: `${label} QA报告未绑定当前视频SHA-256。`,
            });
          }
          if (
            shotQaReport.contactSheetPath !== shot.qa?.contactSheetPath ||
            shotQaReport.contactSheetSha256 !==
              shot.qa?.visualReview?.contactSheetSha256
          ) {
            errors.push({
              code: 'SHOT_QA_CONTACT_SHEET_MISMATCH',
              message: `${label} QA报告未绑定当前逐镜联系表。`,
            });
          }
          const shotReportFailures = [];
          if (!sameNumberArray(shotQaReport.sampleFractions, [0, 0.25, 0.5, 0.75, 1])) {
            shotReportFailures.push('sampleFractions');
          }
          for (const check of GENERATED_VIDEO_QA_CHECKS) {
            if (shotQaReport.requiredChecks?.[check] !== true) {
              shotReportFailures.push(`requiredChecks.${check}`);
            }
            if (!isText(shotQaReport.visualReview?.observations?.[check])) {
              shotReportFailures.push(`visualReview.observations.${check}`);
            }
          }
          const expectedVisualReview = shot.qa?.visualReview ?? {};
          for (const field of [
            'status',
            'reviewer',
            'reviewerKind',
            'reviewerModel',
            'reviewerVersion',
            'reviewedAt',
            'contactSheetSha256',
          ]) {
            if (shotQaReport.visualReview?.[field] !== expectedVisualReview[field]) {
              shotReportFailures.push(`visualReview.${field}`);
            }
          }
          for (const field of [
            'spokenAnchor',
            'causalChain',
            'singleAction',
            'continuity',
          ]) {
            if (
              stableJsonSha256(shotQaReport[field] ?? null) !==
              stableJsonSha256(shot[field] ?? null)
            ) {
              shotReportFailures.push(field);
            }
          }
          if (shotReportFailures.length > 0) {
            errors.push({
              code: 'SHOT_QA_REVIEW_EVIDENCE_INVALID',
              message:
                `${label} QA报告缺少逐项观察、复核人或当前镜头证据绑定：` +
                `${shotReportFailures.join('、')}。`,
            });
          }
        } catch (error) {
          errors.push({
            code: 'SHOT_QA_REPORT_UNREADABLE',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    if (
      isFiniteNumber(plan.costAuthorization?.maxAmountCny) &&
      totalChargedCostCny > plan.costAuthorization.maxAmountCny + EPSILON
    ) {
      errors.push({
        code: 'TOTAL_COST_LIMIT_EXCEEDED',
        message:
          `全部镜头实际费用${Number(totalChargedCostCny.toFixed(4))}元超过授权总额` +
          `${plan.costAuthorization.maxAmountCny}元。`,
      });
    }
    if (
      globalQaReport &&
      (!Array.isArray(globalQaReport.shots) ||
        globalQaReport.shots.length !== shots.length)
    ) {
      errors.push({
        code: 'QA_REPORT_SHOT_COUNT_MISMATCH',
        message: '全局QA报告的逐镜数量与当前生成计划不一致。',
      });
    }
  }

  return {
    ok: errors.length === 0,
    phase,
    errors,
    warnings,
    compiledPrompts,
    planSha256: stableJsonSha256(plan),
    styleSha256: stableJsonSha256(style),
  };
};

export const generatedVideoPlanProjectRoot = projectRoot;
