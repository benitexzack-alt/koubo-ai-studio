import {createHash} from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  createReadStream,
  existsSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const DIRECTOR_R10_DIAGNOSTIC_CONTRACT = Object.freeze({
  manifestSchema: 'director-r10-diagnostic-render-manifest/v1',
  preflightReceiptSchema: 'director-r10-diagnostic-preflight-receipt/v1',
  resultReceiptSchema: 'director-r10-diagnostic-render-result/v1',
  taskId: 'task-20260912T060855Z-7d30cd1b',
  status: 'sidecar-diagnostic-not-release',
  knowledgeContextPath:
    '/Users/pc/Documents/个人知识库/.opc-rag/tasks/task-20260912T060855Z-7d30cd1b/context.json',
  ragValidatorPath:
    '/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py',
  remotionRoot: 'remotion',
  entry: 'src/lanzhou-industry-ai-r10-pilot-r1/index.tsx',
  publicDir: 'remotion/public-lanzhou-industry-ai-v91-r1',
  pilotSourceDir: 'remotion/src/lanzhou-industry-ai-r10-pilot-r1',
  runtimeTimelinePath:
    'remotion/src/lanzhou-industry-ai-r10-pilot-r1/runtime-timeline.r10.json',
  compileReceiptPath:
    'workflow/director-r10/lanzhou-window-r1.compile-receipt.json',
  actualSpokenBilingualPath:
    'edit/20260910_lanzhou_industry_ai/05_实录与字幕/actual-spoken.bilingual.candidate.v1.json',
  outputRoot: 'edit/20260910_lanzhou_industry_ai/07_R10旁路预览',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 1737,
  sourceTrimBeforeFrames: 1200,
  speechAuditSampleRate: 3000,
  speechAuditSearchWindowMs: 50,
  minimumSpeechCorrelation: 0.95,
  maximumSpeechRmsDeltaDb: 1,
  minimumCueDifferenceRmsDbfs: -55,
  minimumCueDifferencePeakDbfs: -45,
  renderStrategy: 'single-visual-master-audio-mux-v1',
  visualMasterCompositionId: 'LanzhouIndustryAIR10PilotR1NoSfx',
  sfxAudioCompositionId: 'LanzhouIndustryAIR10PilotR1WithSfx',
  compositionIds: Object.freeze([
    'LanzhouIndustryAIR10PilotR1WithSfx',
    'LanzhouIndustryAIR10PilotR1NoSfx',
  ]),
  outputFiles: Object.freeze({
    LanzhouIndustryAIR10PilotR1WithSfx:
      'lanzhou-industry-ai-r10-pilot-r1-with-sfx.mp4',
    LanzhouIndustryAIR10PilotR1NoSfx:
      'lanzhou-industry-ai-r10-pilot-r1-no-sfx.mp4',
  }),
  requiredProjectInputs: Object.freeze([
    'tools/director-r10-diagnostic-render-core.mjs',
    'tools/run-director-r10-diagnostic-preview.mjs',
    'remotion/package.json',
    'remotion/package-lock.json',
    'workflow/director-r10/lanzhou-window-r1.intent.json',
    'workflow/director-r10/lanzhou-window-r1.compile-receipt.json',
    'workflow/director-r10/component-registry.v1.json',
  ]),
  requiredPublicMedia: Object.freeze([
    'R01.mp4',
    'fonts/STHeiti-Medium.ttc',
  ]),
});

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RUN_DIRECTORY_PATTERN = /^r10-diagnostic-[a-z0-9](?:[a-z0-9._-]{0,95})$/u;
const TOP_LEVEL_KEYS = [
  'diagnosticOnly',
  'inputs',
  'knowledgeContext',
  'output',
  'productionEligible',
  'publishAuthorized',
  'releaseEligible',
  'remotion',
  'schemaVersion',
  'status',
  'taskId',
  'userNormalSpeedReviewRequired',
];

export class DirectorR10DiagnosticRenderError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'DirectorR10DiagnosticRenderError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = null) => {
  throw new DirectorR10DiagnosticRenderError(code, message, details);
};

const isRecord = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
};

export const stableJson = (value) => JSON.stringify(stableValue(value));

export const stableJsonSha256 = (value) =>
  createHash('sha256').update(stableJson(value)).digest('hex');

const assertExactKeys = (value, allowedKeys, code, label) => {
  if (!isRecord(value)) fail(code, `${label}必须是对象。`);
  const actual = Object.keys(value).sort();
  const expected = [...allowedKeys].sort();
  if (stableJson(actual) !== stableJson(expected)) {
    fail(code, `${label}字段不属于固定诊断合同。`, {actual, expected});
  }
};

const assertBoolean = (value, expected, code, label) => {
  if (value !== expected) fail(code, `${label}必须为 ${String(expected)}。`);
};

const assertSha256 = (value, code, label) => {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail(code, `${label}必须是小写 SHA-256。`);
  }
};

const assertCanonicalProjectRelativePath = (value, code, label) => {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\0') ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value === '.' ||
    value === '..' ||
    value.startsWith('../') ||
    value.includes('/../') ||
    value.endsWith('/..')
  ) {
    fail(code, `${label}必须是项目内规范相对路径：${String(value)}`);
  }
  return value;
};

const resolveInsideProject = (projectRoot, relativePath, code, label) => {
  assertCanonicalProjectRelativePath(relativePath, code, label);
  const absolute = path.resolve(projectRoot, ...relativePath.split('/'));
  const relation = path.relative(projectRoot, absolute);
  if (
    !relation ||
    relation === '..' ||
    relation.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relation)
  ) {
    fail(code, `${label}逃逸项目目录：${relativePath}`);
  }
  return absolute;
};

const pathComponents = (absolutePath) => {
  const resolved = path.resolve(absolutePath);
  const parsed = path.parse(resolved);
  const components = resolved
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  const result = [parsed.root];
  let cursor = parsed.root;
  for (const component of components) {
    cursor = path.join(cursor, component);
    result.push(cursor);
  }
  return result;
};

const displayPath = (absolutePath, projectRoot) => {
  const relation = path.relative(projectRoot, absolutePath);
  if (
    relation &&
    relation !== '..' &&
    !relation.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relation)
  ) {
    return relation.split(path.sep).join('/');
  }
  return absolutePath;
};

export const assertNoSymlinkPath = (
  absolutePath,
  {projectRoot, allowMissingTail = false, label = '路径'} = {},
) => {
  for (const component of pathComponents(absolutePath)) {
    if (!existsSync(component)) {
      if (allowMissingTail) return;
      fail(
        'R10_DIAGNOSTIC_PATH_MISSING',
        `${label}路径组件不存在：${displayPath(component, projectRoot)}`,
      );
    }
    const metadata = lstatSync(component);
    if (metadata.isSymbolicLink()) {
      fail(
        'R10_DIAGNOSTIC_SYMLINK_FORBIDDEN',
        `${label}禁止符号链接：${displayPath(component, projectRoot)}`,
      );
    }
  }
};

const identityOf = (metadata) => ({
  dev: metadata.dev.toString(),
  ino: metadata.ino.toString(),
  mode: metadata.mode.toString(),
  size: metadata.size.toString(),
  mtimeNs: metadata.mtimeNs.toString(),
});

export const captureSecureFile = async (
  absolutePath,
  {projectRoot, expectedSha256 = null, label = '输入文件'} = {},
) => {
  const canonicalPath = path.resolve(absolutePath);
  assertNoSymlinkPath(canonicalPath, {projectRoot, label});
  const pathMetadata = lstatSync(canonicalPath, {bigint: true});
  if (!pathMetadata.isFile()) {
    fail(
      'R10_DIAGNOSTIC_NOT_REGULAR_FILE',
      `${label}必须是普通文件：${displayPath(canonicalPath, projectRoot)}`,
    );
  }
  if (realpathSync(canonicalPath) !== canonicalPath) {
    fail(
      'R10_DIAGNOSTIC_REALPATH_MISMATCH',
      `${label}真实路径不一致：${displayPath(canonicalPath, projectRoot)}`,
    );
  }

  let descriptor;
  try {
    descriptor = openSync(
      canonicalPath,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
    );
    const openedBefore = fstatSync(descriptor, {bigint: true});
    if (!openedBefore.isFile()) {
      fail(
        'R10_DIAGNOSTIC_NOT_REGULAR_FILE',
        `${label}必须是普通文件：${displayPath(canonicalPath, projectRoot)}`,
      );
    }
    if (stableJson(identityOf(pathMetadata)) !== stableJson(identityOf(openedBefore))) {
      fail(
        'R10_DIAGNOSTIC_FILE_REPLACED',
        `${label}在打开时被替换：${displayPath(canonicalPath, projectRoot)}`,
      );
    }

    const hash = createHash('sha256');
    await new Promise((resolve, reject) => {
      const stream = createReadStream(canonicalPath, {
        fd: descriptor,
        autoClose: false,
        start: 0,
      });
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', resolve);
    });
    const openedAfter = fstatSync(descriptor, {bigint: true});
    const finalPathMetadata = lstatSync(canonicalPath, {bigint: true});
    const initialIdentity = identityOf(openedBefore);
    if (
      stableJson(initialIdentity) !== stableJson(identityOf(openedAfter)) ||
      stableJson(initialIdentity) !== stableJson(identityOf(finalPathMetadata))
    ) {
      fail(
        'R10_DIAGNOSTIC_FILE_DRIFT_DURING_HASH',
        `${label}在计算哈希时发生漂移：${displayPath(canonicalPath, projectRoot)}`,
      );
    }
    const sha256 = hash.digest('hex');
    if (expectedSha256 && sha256 !== expectedSha256) {
      fail(
        'R10_DIAGNOSTIC_SHA256_MISMATCH',
        `${label} SHA-256 与 manifest 不一致：${displayPath(canonicalPath, projectRoot)}`,
        {expected: expectedSha256, actual: sha256},
      );
    }
    return {
      absolutePath: canonicalPath,
      sha256,
      bytes: Number(openedAfter.size),
      identity: initialIdentity,
    };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
};

const readJsonFile = (filePath, code, label) => {
  let document;
  let runtime;
  try {
    document = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(
      code,
      `${label}不是有效 JSON：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return document;
};

const parseRuntimeBindings = (runtimePath) => {
  const runtime = readJsonFile(
    runtimePath,
    'R10_DIAGNOSTIC_RUNTIME_JSON_INVALID',
    'R10 runtime ',
  );
  if (!isRecord(runtime)) {
    fail('R10_DIAGNOSTIC_RUNTIME_DOCUMENT_INVALID', 'R10 runtime 必须是对象。');
  }
  if (!Array.isArray(runtime.sourceGraph) || runtime.sourceGraph.length === 0) {
    fail(
      'R10_DIAGNOSTIC_RUNTIME_SOURCE_GRAPH_REQUIRED',
      'R10 runtime 缺少非空 sourceGraph。',
    );
  }
  const sourceGraphPaths = new Set();
  const sourceGraph = runtime.sourceGraph.map((entry, index) => {
    if (
      !isRecord(entry) ||
      typeof entry.role !== 'string' ||
      entry.role.trim().length === 0
    ) {
      fail(
        'R10_DIAGNOSTIC_RUNTIME_SOURCE_GRAPH_ENTRY_INVALID',
        `R10 runtime sourceGraph[${index}] 缺少有效 role。`,
      );
    }
    assertCanonicalProjectRelativePath(
      entry.path,
      'R10_DIAGNOSTIC_RUNTIME_SOURCE_GRAPH_PATH_INVALID',
      `sourceGraph[${index}].path`,
    );
    assertSha256(
      entry.sha256,
      'R10_DIAGNOSTIC_RUNTIME_SOURCE_GRAPH_SHA_INVALID',
      `sourceGraph[${index}].sha256`,
    );
    if (sourceGraphPaths.has(entry.path)) {
      fail(
        'R10_DIAGNOSTIC_RUNTIME_SOURCE_GRAPH_PATH_DUPLICATE',
        `R10 runtime sourceGraph 路径重复：${entry.path}`,
      );
    }
    sourceGraphPaths.add(entry.path);
    return {role: entry.role, path: entry.path, sha256: entry.sha256};
  });
  assertSha256(
    runtime.sourceGraphSha,
    'R10_DIAGNOSTIC_RUNTIME_SOURCE_GRAPH_SHA_INVALID',
    'runtime.sourceGraphSha',
  );
  assertSha256(
    runtime.sourceGraphSha256,
    'R10_DIAGNOSTIC_RUNTIME_SOURCE_GRAPH_SHA_INVALID',
    'runtime.sourceGraphSha256',
  );
  const computedSourceGraphSha = stableJsonSha256(sourceGraph);
  if (
    runtime.sourceGraphSha !== runtime.sourceGraphSha256 ||
    runtime.sourceGraphSha256 !== computedSourceGraphSha
  ) {
    fail(
      'R10_DIAGNOSTIC_RUNTIME_SOURCE_GRAPH_SHA_MISMATCH',
      'R10 runtime sourceGraph 哈希与内容不一致。',
      {
        sourceGraphSha: runtime.sourceGraphSha,
        sourceGraphSha256: runtime.sourceGraphSha256,
        computed: computedSourceGraphSha,
      },
    );
  }
  assertSha256(
    runtime.timelineSha256,
    'R10_DIAGNOSTIC_RUNTIME_TIMELINE_SHA_INVALID',
    'runtime.timelineSha256',
  );
  const {timelineSha256, ...unsignedRuntime} = runtime;
  const computedTimelineSha = stableJsonSha256(unsignedRuntime);
  if (timelineSha256 !== computedTimelineSha) {
    fail(
      'R10_DIAGNOSTIC_RUNTIME_TIMELINE_SHA_MISMATCH',
      'R10 runtime timelineSha256 与内容不一致。',
      {expected: timelineSha256, computed: computedTimelineSha},
    );
  }
  if (!Array.isArray(runtime.soundCues)) {
    fail('R10_DIAGNOSTIC_RUNTIME_SOUND_CUES_REQUIRED', 'R10 runtime 缺少 soundCues。');
  }
  const sources = new Set();
  for (const cue of runtime.soundCues) {
    const source = cue?.source;
    assertCanonicalProjectRelativePath(
      source,
      'R10_DIAGNOSTIC_RUNTIME_SOUND_PATH_INVALID',
      'soundCues[].source',
    );
    if (!source.startsWith('sfx/')) {
      fail(
        'R10_DIAGNOSTIC_RUNTIME_SOUND_OUTSIDE_PUBLIC_SFX',
        `R10 runtime 音效必须是 publicDir 内 sfx/ 规范路径：${source}`,
      );
    }
    sources.add(source);
  }
  if (!sourceGraphPaths.has(DIRECTOR_R10_DIAGNOSTIC_CONTRACT.actualSpokenBilingualPath)) {
    fail(
      'R10_DIAGNOSTIC_ACTUAL_SPOKEN_SOURCE_NOT_BOUND',
      'R10 runtime sourceGraph 未绑定组件直接使用的实录中英字幕源。',
    );
  }
  return {
    runtime,
    sourceGraph,
    soundSources: [...sources].sort(),
  };
};

const assertCompileReceiptRuntimeBinding = ({
  compileReceiptPath,
  runtimeBinding,
  runtimeFileSha256,
}) => {
  const receipt = readJsonFile(
    compileReceiptPath,
    'R10_DIAGNOSTIC_COMPILE_RECEIPT_JSON_INVALID',
    'R10 compile receipt ',
  );
  if (
    !isRecord(receipt) ||
    receipt.schemaVersion !== 'director-r10-lanzhou-compile-receipt/v1' ||
    receipt.status !== 'compiled-sidecar-not-rendered' ||
    receipt.productionEligible !== false ||
    receipt.rendered !== false ||
    receipt.userDynamicAcceptanceRequired !== true ||
    !isRecord(receipt.runtime)
  ) {
    fail(
      'R10_DIAGNOSTIC_COMPILE_RECEIPT_STATE_INVALID',
      'R10 compile receipt 不是未渲染、非生产、等待动态验收的当前合同。',
    );
  }
  const expectedRuntime = {
    path: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath,
    sha256: runtimeFileSha256,
    sourceGraphSha: runtimeBinding.runtime.sourceGraphSha256,
    timelineSha256: runtimeBinding.runtime.timelineSha256,
  };
  const actualRuntime = {
    path: receipt.runtime.path,
    sha256: receipt.runtime.sha256,
    sourceGraphSha: receipt.runtime.sourceGraphSha,
    timelineSha256: receipt.runtime.timelineSha256,
  };
  if (stableJson(actualRuntime) !== stableJson(expectedRuntime)) {
    fail(
      'R10_DIAGNOSTIC_COMPILE_RECEIPT_RUNTIME_MISMATCH',
      'R10 compile receipt 与当前 runtime 文件、sourceGraph 或 timeline 哈希不一致。',
      {expected: expectedRuntime, actual: actualRuntime},
    );
  }
  return receipt;
};

const listRegularFilesRecursively = (directoryPath, {projectRoot}) => {
  assertNoSymlinkPath(directoryPath, {projectRoot, label: 'R10 源码目录'});
  if (!lstatSync(directoryPath).isDirectory()) {
    fail('R10_DIAGNOSTIC_PILOT_SOURCE_DIR_INVALID', 'R10 源码路径不是目录。');
  }
  const files = [];
  const visit = (currentPath) => {
    const entries = readdirSync(currentPath, {withFileTypes: true}).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isSymbolicLink()) {
        fail(
          'R10_DIAGNOSTIC_SYMLINK_FORBIDDEN',
          `R10 源码目录禁止符号链接：${displayPath(entryPath, projectRoot)}`,
        );
      }
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) files.push(entryPath);
      else {
        fail(
          'R10_DIAGNOSTIC_NOT_REGULAR_FILE',
          `R10 源码树只允许普通文件：${displayPath(entryPath, projectRoot)}`,
        );
      }
    }
  };
  visit(directoryPath);
  return files;
};

const expectedPilotKind = (relativePath) =>
  /\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(relativePath) ? 'code' : 'data';

export const assertDirectorR10DiagnosticManifest = (
  manifest,
  {
    projectRoot,
    knowledgeContextPath = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.knowledgeContextPath,
  },
) => {
  assertExactKeys(
    manifest,
    TOP_LEVEL_KEYS,
    'R10_DIAGNOSTIC_MANIFEST_FIELDS_INVALID',
    'manifest',
  );
  if (manifest.schemaVersion !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.manifestSchema) {
    fail('R10_DIAGNOSTIC_MANIFEST_SCHEMA_INVALID', 'manifest schemaVersion 不匹配。');
  }
  if (manifest.taskId !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.taskId) {
    fail('R10_DIAGNOSTIC_TASK_ID_INVALID', '诊断入口只允许已锁定的 R10 任务 ID。');
  }
  if (manifest.status !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.status) {
    fail('R10_DIAGNOSTIC_STATUS_INVALID', '诊断入口状态必须为 sidecar-diagnostic-not-release。');
  }
  assertBoolean(
    manifest.diagnosticOnly,
    true,
    'R10_DIAGNOSTIC_ONLY_REQUIRED',
    'diagnosticOnly',
  );
  assertBoolean(
    manifest.productionEligible,
    false,
    'R10_DIAGNOSTIC_PRODUCTION_FORBIDDEN',
    'productionEligible',
  );
  assertBoolean(
    manifest.releaseEligible,
    false,
    'R10_DIAGNOSTIC_RELEASE_FORBIDDEN',
    'releaseEligible',
  );
  assertBoolean(
    manifest.publishAuthorized,
    false,
    'R10_DIAGNOSTIC_PUBLISH_FORBIDDEN',
    'publishAuthorized',
  );
  assertBoolean(
    manifest.userNormalSpeedReviewRequired,
    true,
    'R10_DIAGNOSTIC_USER_REVIEW_REQUIRED',
    'userNormalSpeedReviewRequired',
  );

  assertExactKeys(
    manifest.knowledgeContext,
    ['path', 'sha256'],
    'R10_DIAGNOSTIC_CONTEXT_FIELDS_INVALID',
    'knowledgeContext',
  );
  if (
    typeof manifest.knowledgeContext.path !== 'string' ||
    path.resolve(manifest.knowledgeContext.path) !== path.resolve(knowledgeContextPath) ||
    manifest.knowledgeContext.path !== path.resolve(knowledgeContextPath)
  ) {
    fail(
      'R10_DIAGNOSTIC_CONTEXT_PATH_INVALID',
      '知识上下文只允许已知个人知识库绝对路径。',
    );
  }
  assertSha256(
    manifest.knowledgeContext.sha256,
    'R10_DIAGNOSTIC_CONTEXT_SHA_REQUIRED',
    'knowledgeContext.sha256',
  );

  assertExactKeys(
    manifest.remotion,
    ['compositions', 'entry', 'publicDir', 'renderWindow', 'root'],
    'R10_DIAGNOSTIC_REMOTION_FIELDS_INVALID',
    'remotion',
  );
  if (manifest.remotion.root !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.remotionRoot) {
    fail('R10_DIAGNOSTIC_REMOTION_ROOT_INVALID', 'Remotion root 不匹配固定合同。');
  }
  if (manifest.remotion.entry !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.entry) {
    fail('R10_DIAGNOSTIC_ENTRY_INVALID', 'Remotion entry 不匹配固定 R10 旁路入口。');
  }
  if (manifest.remotion.publicDir !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.publicDir) {
    fail('R10_DIAGNOSTIC_PUBLIC_DIR_INVALID', 'Remotion publicDir 不匹配固定合同。');
  }
  assertExactKeys(
    manifest.remotion.renderWindow,
    ['endFrameExclusive', 'startFrame'],
    'R10_DIAGNOSTIC_RENDER_WINDOW_FIELDS_INVALID',
    'renderWindow',
  );
  if (
    manifest.remotion.renderWindow.startFrame !== 0 ||
    manifest.remotion.renderWindow.endFrameExclusive !==
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames
  ) {
    fail(
      'R10_DIAGNOSTIC_FULL_WINDOW_REQUIRED',
      'R10 诊断必须成对渲染 0–1737 帧完整窗口。',
    );
  }
  if (
    !Array.isArray(manifest.remotion.compositions) ||
    manifest.remotion.compositions.length !== 2
  ) {
    fail(
      'R10_DIAGNOSTIC_COMPOSITION_PAIR_REQUIRED',
      'R10 诊断必须在同一调用中提供两个 composition。',
    );
  }
  manifest.remotion.compositions.forEach((composition, index) => {
    assertExactKeys(
      composition,
      ['durationInFrames', 'fps', 'height', 'id', 'outputFile', 'width'],
      'R10_DIAGNOSTIC_COMPOSITION_FIELDS_INVALID',
      `compositions[${index}]`,
    );
    const expectedId = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds[index];
    if (composition.id !== expectedId) {
      fail(
        'R10_DIAGNOSTIC_COMPOSITION_PAIR_INVALID',
        `compositions[${index}] 必须为 ${expectedId}。`,
      );
    }
    if (
      composition.width !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.width ||
      composition.height !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.height ||
      composition.fps !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps ||
      composition.durationInFrames !==
        DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames
    ) {
      fail(
        'R10_DIAGNOSTIC_COMPOSITION_SPEC_DRIFT',
        `${composition.id} 必须为 1920x1080 / 30fps / 1737帧。`,
      );
    }
    if (
      composition.outputFile !==
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.outputFiles[composition.id]
    ) {
      fail(
        'R10_DIAGNOSTIC_OUTPUT_FILENAME_INVALID',
        `${composition.id} 输出文件名不匹配固定合同。`,
      );
    }
  });

  assertExactKeys(
    manifest.output,
    ['root', 'runDirectory'],
    'R10_DIAGNOSTIC_OUTPUT_FIELDS_INVALID',
    'output',
  );
  if (manifest.output.root !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.outputRoot) {
    fail('R10_DIAGNOSTIC_OUTPUT_ROOT_INVALID', '输出只能进入固定 R10 旁路预览目录。');
  }
  if (
    typeof manifest.output.runDirectory !== 'string' ||
    !RUN_DIRECTORY_PATTERN.test(manifest.output.runDirectory)
  ) {
    fail(
      'R10_DIAGNOSTIC_RUN_DIRECTORY_INVALID',
      'runDirectory 必须是以 r10-diagnostic- 开头的单层安全新目录名。',
    );
  }

  if (!Array.isArray(manifest.inputs) || manifest.inputs.length === 0) {
    fail('R10_DIAGNOSTIC_INPUTS_REQUIRED', 'manifest.inputs 不得为空。');
  }
  const ids = new Set();
  const paths = new Set();
  let contextInputCount = 0;
  for (const [index, input] of manifest.inputs.entries()) {
    assertExactKeys(
      input,
      ['id', 'kind', 'path', 'sha256'],
      'R10_DIAGNOSTIC_INPUT_FIELDS_INVALID',
      `inputs[${index}]`,
    );
    if (
      typeof input.id !== 'string' ||
      !/^[a-z0-9][a-z0-9._-]{0,95}$/u.test(input.id) ||
      ids.has(input.id)
    ) {
      fail('R10_DIAGNOSTIC_INPUT_ID_INVALID', `inputs[${index}].id 缺失、不规范或重复。`);
    }
    ids.add(input.id);
    if (!['code', 'data', 'dependency', 'media', 'knowledge-context'].includes(input.kind)) {
      fail('R10_DIAGNOSTIC_INPUT_KIND_INVALID', `inputs[${index}].kind 不受允许。`);
    }
    assertSha256(
      input.sha256,
      'R10_DIAGNOSTIC_INPUT_SHA_REQUIRED',
      `inputs[${index}].sha256`,
    );
    if (input.kind === 'knowledge-context') {
      contextInputCount += 1;
      if (input.path !== manifest.knowledgeContext.path) {
        fail(
          'R10_DIAGNOSTIC_CONTEXT_INPUT_MISMATCH',
          '知识上下文 input 必须绑定 knowledgeContext.path。',
        );
      }
    } else {
      assertCanonicalProjectRelativePath(
        input.path,
        'R10_DIAGNOSTIC_INPUT_PATH_INVALID',
        `inputs[${index}].path`,
      );
      if (input.kind === 'media' && !input.path.startsWith(`${manifest.remotion.publicDir}/`)) {
        fail(
          'R10_DIAGNOSTIC_MEDIA_OUTSIDE_PUBLIC_DIR',
          `运行媒体只能来自固定 publicDir：${input.path}`,
        );
      }
    }
    if (paths.has(input.path)) {
      fail('R10_DIAGNOSTIC_INPUT_PATH_DUPLICATE', `manifest.inputs 路径重复：${input.path}`);
    }
    paths.add(input.path);
  }
  if (contextInputCount !== 1) {
    fail(
      'R10_DIAGNOSTIC_CONTEXT_INPUT_REQUIRED',
      'manifest.inputs 必须且只能有一个 knowledge-context 输入。',
    );
  }
  if (!paths.has(manifest.knowledgeContext.path)) {
    fail('R10_DIAGNOSTIC_CONTEXT_INPUT_REQUIRED', '知识上下文未进入输入哈希闭包。');
  }
  const contextEntry = manifest.inputs.find(
    (input) => input.kind === 'knowledge-context',
  );
  if (contextEntry.sha256 !== manifest.knowledgeContext.sha256) {
    fail(
      'R10_DIAGNOSTIC_CONTEXT_SHA_BINDING_MISMATCH',
      '知识上下文在两处绑定的 SHA-256 不一致。',
    );
  }

  for (const requiredPath of DIRECTOR_R10_DIAGNOSTIC_CONTRACT.requiredProjectInputs) {
    const requiredInput = manifest.inputs.find((input) => input.path === requiredPath);
    if (!requiredInput) {
      fail(
        'R10_DIAGNOSTIC_REQUIRED_INPUT_MISSING',
        `R10 诊断输入闭包缺少：${requiredPath}`,
      );
    }
    const expectedKind = requiredPath.startsWith('tools/')
      ? 'code'
      : requiredPath.startsWith('remotion/package')
        ? 'dependency'
        : 'data';
    if (requiredInput.kind !== expectedKind) {
      fail(
        'R10_DIAGNOSTIC_REQUIRED_INPUT_KIND_INVALID',
        `R10 诊断输入类型错误：${requiredPath} 应为 ${expectedKind}`,
      );
    }
  }

  const canonicalProjectRoot = path.resolve(projectRoot);
  if (!existsSync(canonicalProjectRoot) || !lstatSync(canonicalProjectRoot).isDirectory()) {
    fail('R10_DIAGNOSTIC_PROJECT_ROOT_INVALID', '项目根目录不存在或不是目录。');
  }
  assertNoSymlinkPath(canonicalProjectRoot, {
    projectRoot: canonicalProjectRoot,
    label: '项目根目录',
  });
  if (realpathSync(canonicalProjectRoot) !== canonicalProjectRoot) {
    fail('R10_DIAGNOSTIC_PROJECT_ROOT_REALPATH_MISMATCH', '项目根目录真实路径不一致。');
  }
  return manifest;
};

export const captureDirectorR10InputSnapshot = async (
  manifest,
  {
    projectRoot,
    knowledgeContextPath = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.knowledgeContextPath,
  },
) => {
  assertDirectorR10DiagnosticManifest(manifest, {projectRoot, knowledgeContextPath});
  const canonicalProjectRoot = path.resolve(projectRoot);
  const snapshot = [];
  for (const input of manifest.inputs) {
    const absolutePath =
      input.kind === 'knowledge-context'
        ? path.resolve(knowledgeContextPath)
        : resolveInsideProject(
            canonicalProjectRoot,
            input.path,
            'R10_DIAGNOSTIC_INPUT_PATH_INVALID',
            `input ${input.id}`,
          );
    const captured = await captureSecureFile(absolutePath, {
      projectRoot: canonicalProjectRoot,
      expectedSha256: input.sha256,
      label: `input ${input.id}`,
    });
    snapshot.push({
      id: input.id,
      kind: input.kind,
      path: input.path,
      sha256: captured.sha256,
      bytes: captured.bytes,
      identity: captured.identity,
    });
  }

  const byPath = new Map(manifest.inputs.map((input) => [input.path, input]));
  const pilotSourceAbsolute = resolveInsideProject(
    canonicalProjectRoot,
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.pilotSourceDir,
    'R10_DIAGNOSTIC_PILOT_SOURCE_DIR_INVALID',
    'R10 源码目录',
  );
  for (const filePath of listRegularFilesRecursively(pilotSourceAbsolute, {
    projectRoot: canonicalProjectRoot,
  })) {
    const relativePath = path
      .relative(canonicalProjectRoot, filePath)
      .split(path.sep)
      .join('/');
    const entry = byPath.get(relativePath);
    if (!entry) {
      fail(
        'R10_DIAGNOSTIC_PILOT_SOURCE_NOT_IN_CLOSURE',
        `R10 源码文件未进入 manifest 哈希闭包：${relativePath}`,
      );
    }
    const expectedKind = expectedPilotKind(relativePath);
    if (entry.kind !== expectedKind) {
      fail(
        'R10_DIAGNOSTIC_PILOT_SOURCE_KIND_INVALID',
        `R10 源码文件类型错误：${relativePath} 应为 ${expectedKind}`,
      );
    }
  }

  const runtimeRelativePath = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath;
  if (!byPath.has(runtimeRelativePath)) {
    fail(
      'R10_DIAGNOSTIC_RUNTIME_INPUT_MISSING',
      'runtime-timeline.r10.json 未进入 manifest 哈希闭包。',
    );
  }
  const runtimeInput = byPath.get(runtimeRelativePath);
  const runtimeBinding = parseRuntimeBindings(
    resolveInsideProject(
      canonicalProjectRoot,
      runtimeRelativePath,
      'R10_DIAGNOSTIC_RUNTIME_INPUT_MISSING',
      'R10 runtime',
    ),
  );
  for (const source of runtimeBinding.sourceGraph) {
    const sourceInput = byPath.get(source.path);
    if (!sourceInput) {
      fail(
        'R10_DIAGNOSTIC_SOURCE_GRAPH_INPUT_MISSING',
        `R10 runtime sourceGraph 文件未进入 manifest 哈希闭包：${source.path}`,
      );
    }
    if (sourceInput.sha256 !== source.sha256) {
      fail(
        'R10_DIAGNOSTIC_SOURCE_GRAPH_INPUT_SHA_MISMATCH',
        `R10 runtime sourceGraph 与 manifest 哈希不一致：${source.path}`,
        {sourceGraph: source.sha256, manifest: sourceInput.sha256},
      );
    }
    const expectedKind = source.path.startsWith(`${manifest.remotion.publicDir}/`)
      ? 'media'
      : expectedPilotKind(source.path);
    if (sourceInput.kind !== expectedKind) {
      fail(
        'R10_DIAGNOSTIC_SOURCE_GRAPH_INPUT_KIND_INVALID',
        `R10 runtime sourceGraph 输入类型错误：${source.path} 应为 ${expectedKind}`,
      );
    }
  }
  const captionInput = byPath.get(
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.actualSpokenBilingualPath,
  );
  if (!captionInput || captionInput.kind !== 'data') {
    fail(
      'R10_DIAGNOSTIC_ACTUAL_SPOKEN_INPUT_MISSING',
      '组件直接导入的实录中英字幕源未以 data 类型进入 manifest 哈希闭包。',
    );
  }
  const compileReceiptInput = byPath.get(
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compileReceiptPath,
  );
  if (!compileReceiptInput) {
    fail(
      'R10_DIAGNOSTIC_COMPILE_RECEIPT_INPUT_MISSING',
      'R10 compile receipt 未进入 manifest 哈希闭包。',
    );
  }
  assertCompileReceiptRuntimeBinding({
    compileReceiptPath: resolveInsideProject(
      canonicalProjectRoot,
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compileReceiptPath,
      'R10_DIAGNOSTIC_COMPILE_RECEIPT_INPUT_MISSING',
      'R10 compile receipt',
    ),
    runtimeBinding,
    runtimeFileSha256: runtimeInput.sha256,
  });
  const requiredMedia = [
    ...DIRECTOR_R10_DIAGNOSTIC_CONTRACT.requiredPublicMedia,
    ...runtimeBinding.soundSources,
  ].map((relativePath) => `${manifest.remotion.publicDir}/${relativePath}`);
  for (const mediaPath of new Set(requiredMedia)) {
    const mediaInput = byPath.get(mediaPath);
    if (!mediaInput || mediaInput.kind !== 'media') {
      fail(
        'R10_DIAGNOSTIC_RUNTIME_MEDIA_NOT_IN_CLOSURE',
        `R10 运行媒体未以 media 类型进入哈希闭包：${mediaPath}`,
      );
    }
  }
  return snapshot;
};

export const assertDirectorR10SnapshotStable = (before, after, label = '输入') => {
  if (stableJson(before) !== stableJson(after)) {
    fail(
      'R10_DIAGNOSTIC_INPUT_DRIFT',
      `${label}在受控渲染前后发生哈希或文件身份漂移。`,
      {before, after},
    );
  }
};

export const assertKnowledgeContextValidation = (result) => {
  if (!isRecord(result)) {
    fail('R10_DIAGNOSTIC_CONTEXT_VALIDATION_INVALID', '知识上下文复检结果必须是对象。');
  }
  if (result.status !== 'context-valid' || result.gate?.formal_execution_allowed !== true) {
    fail(
      'R10_DIAGNOSTIC_CONTEXT_NOT_VALID',
      '知识上下文未达到 context-valid 且 formal_execution_allowed=true。',
      {status: result.status, gate: result.gate ?? null},
    );
  }
  return {
    status: result.status,
    formalExecutionAllowed: true,
  };
};

export const assertKnowledgeContextDocument = (context, {projectRoot}) => {
  if (!isRecord(context)) {
    fail('R10_DIAGNOSTIC_CONTEXT_DOCUMENT_INVALID', '知识上下文文档必须是对象。');
  }
  if (
    context.status !== 'context-ready' ||
    context.task?.id !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.taskId ||
    context.task?.important !== true ||
    context.gate?.formal_execution_allowed !== true ||
    path.resolve(String(context.project_route?.project_root ?? '')) !== path.resolve(projectRoot)
  ) {
    fail(
      'R10_DIAGNOSTIC_CONTEXT_DOCUMENT_NOT_READY',
      '知识上下文文档未绑定当前 R10 重要任务、口播项目或正式执行门禁。',
      {
        status: context.status,
        taskId: context.task?.id,
        important: context.task?.important,
        formalExecutionAllowed: context.gate?.formal_execution_allowed,
        projectRoot: context.project_route?.project_root,
      },
    );
  }
  return {
    status: context.status,
    taskId: context.task.id,
    important: true,
    projectRoot: path.resolve(projectRoot),
    formalExecutionAllowed: true,
  };
};

export const assertR10CompositionMetadata = (composition) => {
  if (!isRecord(composition)) {
    fail('R10_DIAGNOSTIC_SELECTED_COMPOSITION_INVALID', '选中的 composition 无效。');
  }
  if (!DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds.includes(composition.id)) {
    fail('R10_DIAGNOSTIC_SELECTED_COMPOSITION_INVALID', `未授权 composition：${String(composition.id)}`);
  }
  if (
    composition.width !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.width ||
    composition.height !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.height ||
    composition.fps !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps ||
    composition.durationInFrames !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames
  ) {
    fail(
      'R10_DIAGNOSTIC_SELECTED_COMPOSITION_SPEC_DRIFT',
      `${composition.id} 实际规格与 1920x1080 / 30fps / 1737帧合同不符。`,
    );
  }
  return composition;
};

const rationalToNumber = (value) => {
  if (typeof value !== 'string') return Number.NaN;
  const [numeratorText, denominatorText = '1'] = value.split('/');
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return Number.NaN;
  }
  return numerator / denominator;
};

export const assertR10OutputProbe = (probe, compositionId) => {
  if (!DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds.includes(compositionId)) {
    fail('R10_DIAGNOSTIC_OUTPUT_PROBE_ID_INVALID', '输出探测的 composition ID 未授权。');
  }
  if (!isRecord(probe) || !Array.isArray(probe.streams)) {
    fail('R10_DIAGNOSTIC_OUTPUT_PROBE_INVALID', `${compositionId} ffprobe 结果无效。`);
  }
  const videoStreams = probe.streams.filter((stream) => stream?.codec_type === 'video');
  const audioStreams = probe.streams.filter((stream) => stream?.codec_type === 'audio');
  if (videoStreams.length !== 1 || audioStreams.length !== 1) {
    fail(
      'R10_DIAGNOSTIC_OUTPUT_STREAMS_INVALID',
      `${compositionId} 必须有且只有一路视频和一路混合音频。`,
    );
  }
  const video = videoStreams[0];
  const audio = audioStreams[0];
  const frameRate = rationalToNumber(video.avg_frame_rate || video.r_frame_rate);
  const frameCount = Number(video.nb_read_frames ?? video.nb_frames);
  const duration = Number(video.duration ?? probe.format?.duration);
  const containerDuration = Number(probe.format?.duration ?? video.duration);
  const audioDuration = Number(audio.duration ?? probe.format?.duration);
  const audioSampleRate = Number(audio.sample_rate);
  const expectedDuration =
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames /
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps;
  if (
    video.codec_name !== 'h264' ||
    video.width !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.width ||
    video.height !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.height ||
    !['yuv420p', 'yuvj420p'].includes(video.pix_fmt) ||
    !Number.isFinite(frameRate) ||
    Math.abs(frameRate - DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps) > 0.001 ||
    !Number.isFinite(frameCount) ||
    frameCount !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames ||
    !Number.isFinite(duration) ||
    Math.abs(duration - expectedDuration) > 0.002 ||
    !Number.isFinite(containerDuration) ||
    containerDuration < expectedDuration - 0.002 ||
    containerDuration > expectedDuration + 0.08 ||
    audio.codec_name !== 'aac' ||
    !Number.isFinite(audioSampleRate) ||
    audioSampleRate !== 48000 ||
    audio.channels !== 2 ||
    !Number.isFinite(audioDuration) ||
    audioDuration < expectedDuration - 0.002 ||
    audioDuration > expectedDuration + 0.08
  ) {
    fail(
      'R10_DIAGNOSTIC_OUTPUT_SPEC_DRIFT',
      `${compositionId} 输出不是 1920x1080 / 30fps / 1737帧 / H.264 4:2:0 / AAC 48kHz 立体声完整窗口。`,
      {video, audio, duration, containerDuration, audioDuration},
    );
  }
  return {
    width: video.width,
    height: video.height,
    fps: frameRate,
    frames: frameCount,
    durationSeconds: duration,
    containerDurationSeconds: containerDuration,
    videoCodec: video.codec_name,
    pixelFormat: video.pix_fmt,
    audioCodec: audio.codec_name,
    audioSampleRate,
    audioChannels: audio.channels,
    audioDurationSeconds: audioDuration,
  };
};

export const assertR10PairedVisualHashes = (outputs) => {
  if (!Array.isArray(outputs) || outputs.length !== 2) {
    fail(
      'R10_DIAGNOSTIC_VISUAL_PAIR_REQUIRED',
      '只有两个诊断输出都完成后才能校验同画面。',
    );
  }
  const expectedIds = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds;
  for (const [index, output] of outputs.entries()) {
    if (
      output?.compositionId !== expectedIds[index] ||
      typeof output.decodedVideoSha256 !== 'string' ||
      !SHA256_PATTERN.test(output.decodedVideoSha256)
    ) {
      fail(
        'R10_DIAGNOSTIC_VISUAL_PAIR_INVALID',
        '诊断视频对缺少固定 composition 或解码画面哈希。',
      );
    }
  }
  if (outputs[0].decodedVideoSha256 !== outputs[1].decodedVideoSha256) {
    fail(
      'R10_DIAGNOSTIC_VISUAL_PAIR_MISMATCH',
      '有音效与无附加音效诊断片的解码画面不一致，不得作为成对对照。',
      {
        withSfx: outputs[0].decodedVideoSha256,
        noSfx: outputs[1].decodedVideoSha256,
      },
    );
  }
  return {
    status: 'decoded-visual-streams-identical',
    decodedVideoSha256: outputs[0].decodedVideoSha256,
  };
};

export const assertR10PairedAudioHashes = (outputs) => {
  if (!Array.isArray(outputs) || outputs.length !== 2) {
    fail(
      'R10_DIAGNOSTIC_AUDIO_PAIR_REQUIRED',
      '只有两个诊断输出都完成后才能校验附加音效差异。',
    );
  }
  const expectedIds = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds;
  for (const [index, output] of outputs.entries()) {
    if (
      output?.compositionId !== expectedIds[index] ||
      typeof output.decodedAudioSha256 !== 'string' ||
      !SHA256_PATTERN.test(output.decodedAudioSha256)
    ) {
      fail(
        'R10_DIAGNOSTIC_AUDIO_PAIR_INVALID',
        '诊断视频对缺少固定 composition 或解码音频哈希。',
      );
    }
  }
  if (outputs[0].decodedAudioSha256 === outputs[1].decodedAudioSha256) {
    fail(
      'R10_DIAGNOSTIC_AUDIO_PAIR_IDENTICAL',
      '有音效与无附加音效诊断片的解码音频完全相同，不能证明附加音效已生效。',
    );
  }
  return {
    status: 'decoded-audio-streams-distinct',
    withSfxDecodedAudioSha256: outputs[0].decodedAudioSha256,
    noSfxDecodedAudioSha256: outputs[1].decodedAudioSha256,
  };
};

export const assertR10SingleVisualMasterDerivation = (derivation, outputs) => {
  if (!isRecord(derivation)) {
    fail(
      'R10_DIAGNOSTIC_RENDER_DERIVATION_INVALID',
      '单画面母版派生记录无效。',
    );
  }
  if (
    derivation.strategy !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.renderStrategy ||
    derivation.visualMasterCompositionId !==
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.visualMasterCompositionId ||
    derivation.sfxAudioCompositionId !==
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.sfxAudioCompositionId ||
    derivation.videoCodec !== 'copy' ||
    derivation.audioCodec !== 'copy' ||
    typeof derivation.sourceAudioSha256 !== 'string' ||
    !SHA256_PATTERN.test(derivation.sourceAudioSha256) ||
    typeof derivation.sourceAudioDecodedSha256 !== 'string' ||
    !SHA256_PATTERN.test(derivation.sourceAudioDecodedSha256)
  ) {
    fail(
      'R10_DIAGNOSTIC_RENDER_DERIVATION_INVALID',
      '诊断片必须由固定无音效画面母版与固定有音效音轨无损封装派生。',
    );
  }
  if (!Array.isArray(outputs) || outputs.length !== 2) {
    fail(
      'R10_DIAGNOSTIC_RENDER_DERIVATION_OUTPUTS_INVALID',
      '单画面母版派生审计缺少成对输出。',
    );
  }
  const withSfxOutput = outputs.find(
    (output) =>
      output?.compositionId ===
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.sfxAudioCompositionId,
  );
  if (
    typeof withSfxOutput?.decodedAudioSha256 !== 'string' ||
    withSfxOutput.decodedAudioSha256 !== derivation.sourceAudioDecodedSha256
  ) {
    fail(
      'R10_DIAGNOSTIC_AUDIO_MUX_PROVENANCE_MISMATCH',
      '有音效成片音轨与 Remotion 有音效音频母带不一致。',
      {
        expected: derivation.sourceAudioDecodedSha256,
        actual: withSfxOutput?.decodedAudioSha256 ?? null,
      },
    );
  }
  return {
    status: 'single-visual-master-audio-mux-provenance-passed',
    strategy: derivation.strategy,
    visualMasterCompositionId: derivation.visualMasterCompositionId,
    sfxAudioCompositionId: derivation.sfxAudioCompositionId,
    sourceAudioSha256: derivation.sourceAudioSha256,
    sourceAudioDecodedSha256: derivation.sourceAudioDecodedSha256,
    videoCodec: derivation.videoCodec,
    audioCodec: derivation.audioCodec,
  };
};

export const assertR10SpeechPreservationMetrics = (metrics) => {
  if (
    !isRecord(metrics) ||
    !Number.isFinite(metrics.correlation) ||
    !Number.isFinite(metrics.offsetMs) ||
    !Number.isFinite(metrics.rmsDeltaDb) ||
    !Number.isInteger(metrics.comparedSamples) ||
    metrics.comparedSamples <= 0 ||
    metrics.sampleRate !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.speechAuditSampleRate
  ) {
    fail(
      'R10_DIAGNOSTIC_SPEECH_AUDIT_INVALID',
      '实录原声相关性审计结果无效。',
    );
  }
  if (
    metrics.correlation < DIRECTOR_R10_DIAGNOSTIC_CONTRACT.minimumSpeechCorrelation ||
    Math.abs(metrics.offsetMs) >
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.speechAuditSearchWindowMs ||
    Math.abs(metrics.rmsDeltaDb) >
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.maximumSpeechRmsDeltaDb
  ) {
    fail(
      'R10_DIAGNOSTIC_SPEECH_NOT_PRESERVED',
      '无附加音效片与原片对应窗口的声音相关性或电平差未达到实录保留门。',
      {
        metrics,
        minimumCorrelation:
          DIRECTOR_R10_DIAGNOSTIC_CONTRACT.minimumSpeechCorrelation,
        maximumOffsetMs:
          DIRECTOR_R10_DIAGNOSTIC_CONTRACT.speechAuditSearchWindowMs,
        maximumRmsDeltaDb:
          DIRECTOR_R10_DIAGNOSTIC_CONTRACT.maximumSpeechRmsDeltaDb,
      },
    );
  }
  return {
    status: 'recorded-speech-correlation-passed',
    ...metrics,
  };
};

export const assertR10CueAudibilityAudit = (audits, expectedCueIds) => {
  if (
    !Array.isArray(audits) ||
    !Array.isArray(expectedCueIds) ||
    expectedCueIds.length === 0 ||
    audits.length !== expectedCueIds.length
  ) {
    fail(
      'R10_DIAGNOSTIC_CUE_AUDIT_INCOMPLETE',
      '逐 cue 音效差分审计数量与 runtime 声明不一致。',
    );
  }
  const auditIds = audits.map((audit) => audit?.cueId);
  if (stableJson(auditIds) !== stableJson(expectedCueIds)) {
    fail(
      'R10_DIAGNOSTIC_CUE_AUDIT_ORDER_INVALID',
      '逐 cue 音效差分审计未按 runtime 声明完整绑定。',
      {expectedCueIds, auditIds},
    );
  }
  for (const audit of audits) {
    if (
      !Number.isFinite(audit.differenceRmsDbfs) ||
      !Number.isFinite(audit.differencePeakDbfs) ||
      !Number.isInteger(audit.comparedSamples) ||
      audit.comparedSamples <= 0
    ) {
      fail(
        'R10_DIAGNOSTIC_CUE_AUDIT_INVALID',
        `音效 ${String(audit?.cueId)} 的差分审计无效。`,
      );
    }
    if (
      audit.differenceRmsDbfs <
        DIRECTOR_R10_DIAGNOSTIC_CONTRACT.minimumCueDifferenceRmsDbfs ||
      audit.differencePeakDbfs <
        DIRECTOR_R10_DIAGNOSTIC_CONTRACT.minimumCueDifferencePeakDbfs
    ) {
      fail(
        'R10_DIAGNOSTIC_CUE_NOT_AUDIBLE',
        `音效 ${audit.cueId} 在绑定窗口内没有达到可检测差分下限。`,
        {
          audit,
          minimumRmsDbfs:
            DIRECTOR_R10_DIAGNOSTIC_CONTRACT.minimumCueDifferenceRmsDbfs,
          minimumPeakDbfs:
            DIRECTOR_R10_DIAGNOSTIC_CONTRACT.minimumCueDifferencePeakDbfs,
        },
      );
    }
  }
  return {
    status: 'all-runtime-cues-have-detectable-difference',
    cueCount: audits.length,
    audits,
  };
};

export const resolveDirectorR10OutputTarget = (manifest, {projectRoot}) => {
  const basePath = resolveInsideProject(
    projectRoot,
    manifest.output.root,
    'R10_DIAGNOSTIC_OUTPUT_ROOT_INVALID',
    'R10 输出根目录',
  );
  const runPath = path.join(basePath, manifest.output.runDirectory);
  const relation = path.relative(basePath, runPath);
  if (
    !relation ||
    relation.includes(path.sep) ||
    relation === '..' ||
    relation.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relation)
  ) {
    fail('R10_DIAGNOSTIC_OUTPUT_PATH_ESCAPE', '输出运行目录必须是固定根下单层子目录。');
  }
  assertNoSymlinkPath(basePath, {
    projectRoot,
    allowMissingTail: true,
    label: 'R10 输出根目录',
  });
  if (existsSync(runPath)) {
    fail(
      'R10_DIAGNOSTIC_OUTPUT_ALREADY_EXISTS',
      `R10 诊断输出目录已存在，禁止覆盖：${manifest.output.runDirectory}`,
    );
  }
  return {
    basePath,
    runPath,
    outputs: manifest.remotion.compositions.map((composition) => ({
      compositionId: composition.id,
      fileName: composition.outputFile,
      absolutePath: path.join(runPath, composition.outputFile),
    })),
    preflightReceiptPath: path.join(runPath, 'diagnostic-preflight.receipt.json'),
    resultReceiptPath: path.join(runPath, 'diagnostic-result.receipt.json'),
  };
};

export const createDirectorR10OutputDirectory = (target, {projectRoot}) => {
  mkdirSync(target.basePath, {recursive: true});
  assertNoSymlinkPath(target.basePath, {projectRoot, label: 'R10 输出根目录'});
  if (realpathSync(target.basePath) !== path.resolve(target.basePath)) {
    fail('R10_DIAGNOSTIC_OUTPUT_ROOT_REALPATH_MISMATCH', 'R10 输出根目录真实路径不一致。');
  }
  try {
    mkdirSync(target.runPath, {recursive: false, mode: 0o750});
  } catch (error) {
    fail(
      'R10_DIAGNOSTIC_OUTPUT_CREATE_FAILED',
      `R10 诊断输出目录创建失败：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  assertNoSymlinkPath(target.runPath, {projectRoot, label: 'R10 输出运行目录'});
};

export const writeJsonAtomic = (absolutePath, value, {projectRoot} = {}) => {
  const directory = path.dirname(absolutePath);
  assertNoSymlinkPath(directory, {projectRoot, label: '回执目录'});
  const temporaryPath = path.join(
    directory,
    `.${path.basename(absolutePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o640,
    });
    linkSync(temporaryPath, absolutePath);
  } catch (error) {
    fail(
      'R10_DIAGNOSTIC_RECEIPT_WRITE_FAILED',
      `诊断回执写入失败或目标已存在：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
};

export const snapshotForReceipt = (snapshot) =>
  snapshot.map(({id, kind, path: inputPath, sha256, bytes, identity}) => ({
    id,
    kind,
    path: inputPath,
    sha256,
    bytes,
    identity,
  }));

export const captureExistingOutput = async (
  absolutePath,
  {projectRoot, label = '诊断输出'} = {},
) => {
  if (!existsSync(absolutePath)) return {exists: false};
  const captured = await captureSecureFile(absolutePath, {projectRoot, label});
  return {
    exists: true,
    sha256: captured.sha256,
    bytes: captured.bytes,
    identity: captured.identity,
    mtimeMs: statSync(absolutePath).mtimeMs,
  };
};
