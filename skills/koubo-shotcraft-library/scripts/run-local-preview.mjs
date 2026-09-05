/**
 * 本条首次隔离实验入口，不调用生产 V2，不签名、不更新导演锁、不代表用户后验收。
 * CLI: node skills/koubo-shotcraft-library/scripts/run-local-preview.mjs preflight|stills|render-ab
 * 授权及独立审查由主任务提供；审查使用 schemaVersion，绑定原顺序 bindings 的 JSON 哈希。
 * 已有输出/失败产物绝不覆盖；重试前由主任务另行授权保留旧产物，本入口不搬移或删除它们。
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), '../../..');
const require = createRequire(new URL('../../../remotion/package.json', import.meta.url));
const ts = require('typescript');
const BASE = 'skills/koubo-shotcraft-library';
const CANDIDATE = 'remotion/src/shotcraft-candidate-v1';
export const ENTRY = `${CANDIDATE}/index.tsx`;
export const PLAN = `${CANDIDATE}/candidate-plan.v1.json`;
export const AUTHORIZATION = 'edit/shotcraft-integration-20260904/local-preview-authorization.v1.json';
export const OUTPUT_ROOT = 'edit/shotcraft-integration-20260904/local-preview-v1';
export const IMPLEMENTER_AGENT_ID = '01a06afe-bc5f-77d0-8fe1-7a5afb307300';
export const COMPOSITIONS = Object.freeze(['ShotcraftCandidateWithSfx', 'ShotcraftCandidateNoSfx']);
export const STILL_FRAMES = Object.freeze([95, 245, 332, 470, 550, 650, 870]);
export const LOCAL_CLI = 'remotion/node_modules/@remotion/cli/remotion-cli.js';
export const LOCAL_BROWSER = 'remotion/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell';
export const LOOPBACK_PRELOAD = `${pathToFileURL(HERE).href}#loopback-only`;
export const REMOTION_PORT_CONFIG = 'remotion/node_modules/@remotion/renderer/dist/port-config.js';
export const CONTEXT_TASK_ID = 'task-20260904T084602Z-be40d4d5';
const KB_ROOT = path.resolve(ROOT, '../个人知识库');
export const CONTEXT_PATH = `${KB_ROOT}/.opc-rag/tasks/${CONTEXT_TASK_ID}/context.json`;
const RAG_SCRIPT = `${KB_ROOT}/04_Claude Code日常操作/scripts/opc_rag.py`;
const RAG_CONFIG = `${KB_ROOT}/04_Claude Code日常操作/scripts/opc_rag_config.json`;
export const CONTEXT_EVIDENCE_PATHS = Object.freeze([
  CONTEXT_PATH, `${ROOT}/edit/shotcraft-integration-20260904/context-requirements.v1.json`,
  `${ROOT}/edit/shotcraft-integration-20260904/read-receipts.v1.json`, RAG_SCRIPT, RAG_CONFIG,
]);
// 只在本条 CLI 的 --import 分支内修改内存；Remotion 默认 wildcard 监听并不受现有 SBPL 入站规则可靠限制。
if (new URL(import.meta.url).hash === '#loopback-only') {
  const portConfig = require(path.join(ROOT, REMOTION_PORT_CONFIG));
  Object.defineProperty(portConfig, 'getPortConfig', {
    value: () => ({host: '127.0.0.1', hostsToTry: ['127.0.0.1']}), writable: false, configurable: false,
  });
}
const SOURCE = 'remotion/public/media/local-ai-services-20260902-r1/R01_talk_normalized_1920x1080.mp4';
const CAPTIONS = 'remotion/public/data/LOCAL_AI_SERVICES_20260902.actual.bilingual.v1.json';
// 已实查此 CLI 仅自动加载这两种配置；当前均不存在。出现配置即停，不隐式执行。
export const ABSENT_CONFIGS = Object.freeze(['remotion/remotion.config.ts', 'remotion/remotion.config.js']);
export const REQUIRED_BINDINGS = Object.freeze([
  `${BASE}/scripts/run-local-preview.mjs`, `${BASE}/scripts/validate-plan.mjs`, `${BASE}/registry.v1.json`,
  `${BASE}/assets/ShotcraftEffects.tsx`, ENTRY, `${CANDIDATE}/ShotcraftCandidate.tsx`,
  `${CANDIDATE}/ShotcraftEffects.generated.tsx`, `${CANDIDATE}/captions.generated.json`, PLAN,
  `${CANDIDATE}/tsconfig.json`, 'remotion/tsconfig.json', 'remotion/package.json', 'remotion/package-lock.json', LOCAL_CLI,
  SOURCE, CAPTIONS,
  'remotion/public/media/local-ai-services-20260902-r1/proxies/U02_family_composite_1920x1080.mp4',
  'remotion/public/audio/koubo-sfx-v8/v3-soft-card-pop-a.wav',
  'remotion/public/audio/koubo-sfx-v8/v3-list-tick-a.wav',
  'remotion/public/audio/koubo-sfx-v8/v3-line-connect-a.wav',
  'edit/20260902_local_ai_services/06_转写与字幕/LOCAL_AI_SERVICES_20260902.spoken-source-policy.v1.json',
  'edit/20260902_local_ai_services/06_转写与字幕/LOCAL_AI_SERVICES_20260902.actual.cleaned.v1.json',
  'tools/check-spoken-source-policy.mjs',
  'remotion/src/index.ts', 'remotion/src/Root.tsx', 'remotion/src/components/V8SemanticStage.tsx',
  'remotion/src/components/V72ProductionShell.tsx',
  'remotion/src/local-ai-services-v8-candidate-r1/LocalAIServicesV8CandidateR1.tsx',
  'workflow/active-production-profile.v1.json', 'workflow/active-director-profile.v1.json',
  'workflow/director-skill-lock.v1.json', 'tools/director-skill-lock-core.mjs',
  'tools/director-production-binding-core.mjs', 'tools/knowledge-context-production-gate.mjs',
  'tools/run-v72-production.mjs', 'tools/validate-v8-production-contract.mjs',
  'skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs',
  'skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs',
  'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs',
  'workflow/director-production-freeze-registry.v2.json',
  'skills/koubo-remotion-director/fixtures/external-acceptance-anchor-registry.v2.json',
]);
// 出站仍用沙箱；入站隔离依赖上述真实的回环绑定，不能把 SBPL 文本当作已阻止 LAN 的证据。
export const NETWORK_SANDBOX = '(version 1) (allow default) (deny network-outbound) (deny network-inbound) (allow network-outbound (remote ip "localhost:*")) (allow network-inbound (local ip "localhost:*"))';
const COMMANDS = Object.freeze(['preflight', 'stills', 'render-ab']);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (code, detail = '') => { throw new Error(`${code}${detail ? `:${detail}` : ''}`); };
const ensure = (condition, code, detail) => { if (!condition) fail(code, detail); };

export function parseCommand(args) {
  ensure(args.length === 1 && COMMANDS.includes(args[0]), 'COMMAND_NOT_ALLOWED');
  return args[0];
}

function relativeName(name) {
  ensure(typeof name === 'string' && name.length > 0 && !path.isAbsolute(name) &&
    !/[\\\x00-\x1f]/u.test(name) && name.split('/').every((part) => part && part !== '.' && part !== '..'), 'UNSAFE_PATH', String(name));
  return name;
}

// 检查每一级目录，包含断链；不能用 existsSync 把断开的符号链接当作空路径。
export function checkedPath(root, name, allowMissing = false) {
  relativeName(name);
  ensure(fs.realpathSync(root) === path.resolve(root), 'ROOT_NOT_CANONICAL');
  let current = root;
  const parts = name.split('/');
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) { if (allowMissing && error.code === 'ENOENT') continue; throw error; }
    ensure(!stat.isSymbolicLink(), 'SYMLINK_FORBIDDEN', name);
    if (index < parts.length - 1) ensure(stat.isDirectory(), 'PARENT_NOT_DIRECTORY', name);
  }
  return current;
}

function fileHash(root, name) {
  const absolute = checkedPath(root, name);
  const fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    ensure(stat.isFile(), 'REGULAR_FILE_REQUIRED', name);
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count));
    const after = fs.fstatSync(fd);
    ensure(stat.size === after.size && stat.mtimeMs === after.mtimeMs && stat.ctimeMs === after.ctimeMs, 'FILE_CHANGED_DURING_READ', name);
    return hash.digest('hex');
  } finally { fs.closeSync(fd); }
}

function readJson(root, name) {
  const absolute = checkedPath(root, name);
  ensure(fs.lstatSync(absolute).isFile(), 'REGULAR_FILE_REQUIRED', name);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

// 从 PATH 解析一次，执行与回执仍使用绝对路径；忽略空项和相对目录。
export function resolvePythonExecutable(searchPath = process.env.PATH || '') {
  for (const directory of searchPath.split(path.delimiter).filter((entry) => path.isAbsolute(entry))) {
    const executable = path.join(directory, 'python3');
    try {
      fs.accessSync(executable, fs.constants.X_OK);
      if (fs.statSync(executable).isFile()) return executable;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) throw error;
    }
  }
  fail('CONTEXT_PYTHON_NOT_FOUND');
}

export function contextValidationCommand(python = process.env.PYTHON || resolvePythonExecutable()) {
  ensure(typeof python === 'string' && path.isAbsolute(python), 'CONTEXT_PYTHON_ABSOLUTE_REQUIRED');
  return {executable: python, args: ['-I', '-B', RAG_SCRIPT, '--config', RAG_CONFIG, 'validate-context', '--context', CONTEXT_PATH],
    cwd: KB_ROOT, env: {PATH: '/usr/bin:/bin:/usr/sbin:/sbin'}};
}

export function assertContextValidation(result) {
  let body;
  try { body = JSON.parse(result.stdout); } catch { fail('CONTEXT_VALIDATION_JSON_INVALID'); }
  ensure(!result.error && result.status === 0 && body.schema_version === 'opc-task-context-validation/1.0' &&
    body.status === 'context-valid' && body.gate?.formal_execution_allowed === true, 'CONTEXT_VALIDATION_FAILED', body.status);
  ensure(body.context_path === CONTEXT_PATH && body.task?.id === CONTEXT_TASK_ID && body.task?.important === true &&
    body.project_route?.project_root === ROOT, 'CONTEXT_TASK_MISMATCH');
  return body;
}

export function validateKnowledgeContext(previous) {
  const inputSHA = CONTEXT_EVIDENCE_PATHS.map((absolute) => ({path: absolute, sha256: fileHash('/', absolute.slice(1))}));
  if (previous) ensure(JSON.stringify(inputSHA) === JSON.stringify(previous.inputSHA), 'CONTEXT_INPUT_CHANGED');
  const context = readJson('/', CONTEXT_PATH.slice(1));
  ensure(context.task?.id === CONTEXT_TASK_ID && context.task?.important === true && context.status === 'context-ready' &&
    context.project_route?.project_root === ROOT, 'CONTEXT_TASK_MISMATCH');
  const command = contextValidationCommand();
  fs.accessSync(command.executable, fs.constants.X_OK);
  const result = spawnSync(command.executable, command.args, {cwd: command.cwd, env: command.env,
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000});
  const receipt = {taskId: CONTEXT_TASK_ID, inputSHA, command, exitCode: result.status,
    stdoutSha256: sha(result.stdout ?? ''), stderrSha256: sha(result.stderr ?? ''),
    cryptographicProductionAuthorization: false, formalEnabled: false};
  try {
    const body = assertContextValidation(result);
    for (const item of inputSHA) ensure(fileHash('/', item.path.slice(1)) === item.sha256, 'CONTEXT_INPUT_CHANGED');
    return {...receipt, status: body.status, indexGeneration: body.index_generation?.id ?? null};
  } catch (error) {
    error.knowledgeContext = {...receipt, status: 'blocked'};
    throw error;
  }
}

function assertAbsent(root, name) {
  const absolute = checkedPath(root, name, true);
  let stat;
  try { stat = fs.lstatSync(absolute); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (stat) fail('PATH_ALREADY_EXISTS', name);
}

function assertNoConfig(root) {
  for (const name of ABSENT_CONFIGS) assertAbsent(root, name);
}

export function outputPaths(command) {
  parseCommand([command]);
  if (command === 'stills') return STILL_FRAMES.map((frame) => `${OUTPUT_ROOT}/stills/frame-${frame}.png`);
  if (command === 'render-ab') return [`${OUTPUT_ROOT}/with-sfx.mp4`, `${OUTPUT_ROOT}/no-sfx.mp4`];
  return [];
}

export function assertOutputsAvailable(root, command) {
  parseCommand([command]);
  checkedPath(root, OUTPUT_ROOT, true);
  assertAbsent(root, `${OUTPUT_ROOT}/active-run.lock`);
  for (const phase of command === 'preflight' ? ['stills', 'render-ab'] : [command]) {
    if (phase === 'stills') assertAbsent(root, `${OUTPUT_ROOT}/stills`);
    for (const output of outputPaths(phase)) assertAbsent(root, output);
    for (const suffix of ['start', 'finish']) assertAbsent(root, `${OUTPUT_ROOT}/${phase}.${suffix}.json`);
  }
}

function sourceFile(root, name) {
  const source = ts.createSourceFile(name, fs.readFileSync(checkedPath(root, name), 'utf8'), ts.ScriptTarget.Latest, true);
  ensure(source.parseDiagnostics.length === 0, 'SOURCE_PARSE_FAILED', name);
  return source;
}

function assertIndex(root) {
  const compositions = [];
  function visit(node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText() === 'Composition') {
      const attrs = new Map();
      for (const item of node.attributes.properties) {
        ensure(ts.isJsxAttribute(item) && !attrs.has(item.name.getText()), 'COMPOSITION_ATTRIBUTES');
        attrs.set(item.name.getText(), item.initializer);
      }
      const id = attrs.get('id');
      ensure(id && ts.isStringLiteral(id) && COMPOSITIONS.includes(id.text), 'COMPOSITION_ID');
      ensure(attrs.size === 7, 'COMPOSITION_ATTRIBUTES');
      const expression = (name) => attrs.get(name)?.expression;
      for (const [key, value] of [['width', 1920], ['height', 1080]]) {
        const expr = expression(key);
        ensure(expr && ts.isNumericLiteral(expr) && Number(expr.text) === value, 'INTRINSIC_SIZE');
      }
      for (const key of ['fps', 'durationInFrames']) {
        const expr = expression(key);
        ensure(expr && ts.isPropertyAccessExpression(expr) && expr.expression.getText() === 'plan' && expr.name.text === key, 'COMPOSITION_TIMING');
      }
      ensure(expression('component')?.getText() === 'ShotcraftCandidate', 'COMPOSITION_COMPONENT');
      const props = expression('defaultProps');
      ensure(props && ts.isObjectLiteralExpression(props) && props.properties.length === 1, 'COMPOSITION_PROPS');
      const prop = props.properties[0];
      ensure(ts.isPropertyAssignment(prop) && prop.name.getText() === 'withSfx' &&
        prop.initializer.kind === (id.text === COMPOSITIONS[0] ? ts.SyntaxKind.TrueKeyword : ts.SyntaxKind.FalseKeyword), 'COMPOSITION_PROPS');
      compositions.push(id.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile(root, ENTRY));
  ensure(compositions.length === 2 && new Set(compositions).size === 2, 'COMPOSITIONS_REQUIRED');
}

// 跟踪隔离入口及入口校验代码的静态本地模块；第三方库由现有 package-lock 锁定。
export function collectImportClosure(root, bindings) {
  const declared = new Set(bindings.map((item) => item.path));
  const seen = new Set();
  function visitFile(name) {
    if (seen.has(name)) return;
    ensure(declared.has(name), 'IMPORT_BINDING_REQUIRED', name);
    seen.add(name);
    if (name.endsWith('.json')) return;
    const source = sourceFile(root, name);
    const rendererSource = name.startsWith(`${CANDIDATE}/`);
    function visit(node) {
      if (rendererSource && ts.isStringLiteralLike(node)) ensure(!/^(?:[a-z]+:|\/\/)|url\s*\(/iu.test(node.text), 'EXTERNAL_RESOURCE_FORBIDDEN', name);
      if (rendererSource && ts.isIdentifier(node)) ensure(!['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'eval', 'Function', 'require', 'process'].includes(node.text), 'DYNAMIC_IO_FORBIDDEN', name);
      if (name !== `${BASE}/scripts/run-local-preview.mjs` && ts.isCallExpression(node)) ensure(node.expression.kind !== ts.SyntaxKind.ImportKeyword, 'DYNAMIC_IMPORT_FORBIDDEN', name);
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        ensure(ts.isStringLiteral(node.moduleSpecifier), 'IMPORT_INVALID', name);
        const spec = node.moduleSpecifier.text;
        if (!spec.startsWith('.')) ensure(rendererSource ? ['react', 'react/jsx-runtime', 'remotion'].includes(spec) : spec.startsWith('node:'), 'PACKAGE_NOT_ALLOWED', spec);
        else {
          const base = path.posix.normalize(path.posix.join(path.posix.dirname(name), spec));
          ensure(base.startsWith(`${rendererSource ? CANDIDATE : BASE}/`), 'IMPORT_OUTSIDE_CANDIDATE', spec);
          const possible = /\.(?:tsx?|jsx?|mjs|json)$/u.test(base) ? [base] : [base, ...['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '/index.tsx', '/index.ts'].map((ext) => base + ext)];
          const found = possible.filter((candidate) => {
            const absolute = checkedPath(root, candidate, true);
            return fs.existsSync(absolute) && fs.lstatSync(absolute).isFile();
          });
          ensure(found.length === 1 && /\.(?:tsx?|jsx?|mjs|json)$/u.test(found[0]), 'IMPORT_UNRESOLVED_OR_AMBIGUOUS', spec);
          visitFile(found[0]);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  visitFile(ENTRY);
  visitFile(`${BASE}/scripts/run-local-preview.mjs`);
  visitFile(`${BASE}/scripts/validate-plan.mjs`);
  return [...seen].sort();
}

function assertPlan(root, plan, byPath) {
  ensure(record(plan) && plan.formalEnabled === false && plan.productionEligible === false, 'PLAN_FORMAL_FORBIDDEN');
  ensure(plan.fps === 30 && plan.durationInFrames === 930 && plan.width === 1920 && plan.height === 1080 && plan.sourceStartFrame === 1278, 'FIXED_SAMPLE_REQUIRED');
  ensure(plan.review?.userApproved === false, 'POST_REVIEW_MUST_REMAIN_PENDING');
  ensure(record(plan.assets) && ['family', 'pop', 'tick', 'line'].every((id) => Object.hasOwn(plan.assets, id)), 'ASSETS_REQUIRED');
  for (const item of [plan.source, plan.captions, ...Object.values(plan.assets)]) {
    ensure(record(item) && typeof item.publicPath === 'string', 'PUBLIC_BINDING_REQUIRED');
    relativeName(item.publicPath);
    ensure(!/[:%?#]/u.test(item.publicPath) && item.path === `remotion/public/${item.publicPath}`, 'MEDIA_PUBLIC_PATH_MISMATCH');
    ensure(byPath.get(item.path) === item.sha256, 'PLAN_BINDING_MISMATCH', item.path);
  }
  ensure(plan.source.path === SOURCE && plan.captions.path === CAPTIONS, 'FIXED_SOURCE_REQUIRED');
  if (Object.hasOwn(plan, 'mediaPublicPath')) ensure(plan.mediaPublicPath === plan.source.publicPath, 'MEDIA_PUBLIC_PATH_MISMATCH');
  ensure(byPath.get(`${CANDIDATE}/captions.generated.json`) === byPath.get(plan.captions.path), 'CAPTION_MIRROR_MISMATCH');
  ensure(byPath.get(`${CANDIDATE}/ShotcraftEffects.generated.tsx`) === byPath.get(`${BASE}/assets/ShotcraftEffects.tsx`), 'EFFECT_MIRROR_MISMATCH');
  ensure(Array.isArray(plan.mediaWindows) && plan.mediaWindows.every((w) => Number.isInteger(w.from) && w.from >= 0 && Number.isInteger(w.duration) && w.duration > 0 && w.from + w.duration <= 930 && Number.isInteger(w.mediaStartFrame) && w.mediaStartFrame >= 0), 'MEDIA_WINDOW_INVALID');
  ensure(Array.isArray(plan.sfx) && plan.sfx.every((cue) => ['pop', 'tick', 'line'].includes(cue.assetId) && Number.isInteger(cue.frame) && cue.frame >= 0 && cue.frame < 930 && Number.isFinite(cue.gain) && cue.gain >= 0 && cue.gain <= 1), 'SFX_INVALID');
  const config = readJson(root, `${CANDIDATE}/tsconfig.json`);
  ensure(config.extends === '../../tsconfig.json', 'TSCONFIG_EXTENDS');
  const parentConfig = readJson(root, 'remotion/tsconfig.json');
  ensure(!parentConfig.extends && !parentConfig.references && !parentConfig.compilerOptions?.plugins && !parentConfig.compilerOptions?.paths, 'TSCONFIG_EXTERNAL_CONFIGURATION');
}

export async function validateLocalPreview({root = ROOT, command = 'preflight'} = {}) {
  parseCommand([command]);
  assertNoConfig(root);
  assertOutputsAvailable(root, command);
  const authorizationSha256 = fileHash(root, AUTHORIZATION);
  const auth = readJson(root, AUTHORIZATION);
  ensure(auth.schemaVersion === 'shotcraft-local-preview-authorization/v1' && auth.scope === 'local-experiment-only' && auth.userConfirmed === true && auth.formalEnabled === false && auth.productionEligible === false, 'AUTHORIZATION_INVALID');
  ensure(Array.isArray(auth.bindings) && auth.bindings.length > 0, 'BINDINGS_REQUIRED');
  const byPath = new Map();
  for (const item of auth.bindings) {
    ensure(record(item) && Object.keys(item).length === 2 && /^[a-f0-9]{64}$/u.test(item.sha256), 'BINDING_INVALID');
    relativeName(item.path);
    ensure(item.path !== AUTHORIZATION && !item.path.startsWith(`${OUTPUT_ROOT}/`) && !byPath.has(item.path), 'BINDING_DUPLICATE_OR_CIRCULAR', item.path);
    ensure(fileHash(root, item.path) === item.sha256, 'BINDING_HASH_MISMATCH', item.path);
    byPath.set(item.path, item.sha256);
  }
  for (const name of REQUIRED_BINDINGS) ensure(byPath.has(name), 'REQUIRED_BINDING_MISSING', name);
  const reviewBinding = auth.independentReview;
  ensure(record(reviewBinding) && /^[a-f0-9]{64}$/u.test(reviewBinding.sha256), 'REVIEW_BINDING_REQUIRED');
  relativeName(reviewBinding.path);
  ensure(reviewBinding.path.startsWith('edit/shotcraft-integration-20260904/') && reviewBinding.path !== AUTHORIZATION && !reviewBinding.path.startsWith(`${OUTPUT_ROOT}/`) && !byPath.has(reviewBinding.path), 'REVIEW_PATH_INVALID');
  ensure(fileHash(root, reviewBinding.path) === reviewBinding.sha256, 'REVIEW_HASH_MISMATCH');
  const manifestSha256 = sha(JSON.stringify(auth.bindings));
  const review = readJson(root, reviewBinding.path);
  ensure(review.schemaVersion === 'shotcraft-local-preview-code-review/v1' && review.decision === 'allow-local-preview' && review.manifestSha256 === manifestSha256 && review.cryptographicProductionAuthorization === false, 'INDEPENDENT_REVIEW_INVALID');
  ensure(typeof review.reviewerAgentId === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(review.reviewerAgentId) && review.reviewerAgentId.toLowerCase() !== IMPLEMENTER_AGENT_ID, 'INDEPENDENT_REVIEWER_REQUIRED');
  const plan = readJson(root, PLAN);
  assertPlan(root, plan, byPath);
  assertIndex(root);
  const importClosure = collectImportClosure(root, auth.bindings);
  // 先验哈希再加载校验器；不加载或执行任何生产门禁模块。
  const validatorPath = `${BASE}/scripts/validate-plan.mjs`;
  const {validateFiles} = await import(`${pathToFileURL(checkedPath(root, validatorPath)).href}?sha=${byPath.get(validatorPath)}`);
  const errors = validateFiles(plan, root);
  ensure(Array.isArray(errors) && errors.length === 0, 'PLAN_VALIDATION_FAILED', JSON.stringify(errors));
  const result = {
    schemaVersion: 'shotcraft-local-preview-preflight/v1', status: 'local-preflight-passed', command,
    scope: 'local-experiment-only', formalEnabled: false, productionEligible: false,
    cryptographicProductionAuthorization: false, userPostReview: 'pending',
    authorizationSha256, independentReview: {...reviewBinding, reviewerAgentId: review.reviewerAgentId},
    manifestSha256, bindings: auth.bindings, importClosure, absentConfigs: [...ABSENT_CONFIGS],
  };
  assertSnapshot(root, result);
  return result;
}

export function assertSnapshot(root, snapshot) {
  assertNoConfig(root);
  for (const item of [{path: AUTHORIZATION, sha256: snapshot.authorizationSha256}, snapshot.independentReview, ...snapshot.bindings]) {
    ensure(fileHash(root, item.path) === item.sha256, 'INPUT_CHANGED', item.path);
  }
}

export function buildCommands(root, command) {
  parseCommand([command]);
  return outputPaths(command).map((output, index) => {
    const args = [path.join(root, LOCAL_CLI), command === 'stills' ? 'still' : 'render',
      path.join(root, ENTRY), command === 'stills' ? COMPOSITIONS[0] : COMPOSITIONS[index], path.join(root, output),
      '--width=1920', '--height=1080', '--fps=30', '--duration=930', '--scale=0.5', '--concurrency=2',
      '--overwrite=false', '--bundle-cache=false', '--env-file=/dev/null', '--public-dir=' + path.join(root, 'remotion/public'),
      '--browser-executable=' + path.join(root, LOCAL_BROWSER)];
    if (command === 'stills') args.push(`--frame=${STILL_FRAMES[index]}`, '--image-format=png');
    else args.push('--crf=20', '--codec=h264', '--pixel-format=yuv420p');
    return {executable: '/usr/bin/sandbox-exec', args: ['-p', NETWORK_SANDBOX, process.execPath, '--import', LOOPBACK_PRELOAD, ...args], cwd: path.join(root, 'remotion'), output};
  });
}

function writeNew(root, name, body) {
  const absolute = checkedPath(root, name, true);
  fs.writeFileSync(absolute, JSON.stringify(body, null, 2) + '\n', {flag: 'wx', mode: 0o600});
}

async function main() {
  const command = parseCommand(process.argv.slice(2));
  const snapshot = await validateLocalPreview({command});
  snapshot.knowledgeContext = validateKnowledgeContext();
  if (command === 'preflight') { console.log(JSON.stringify(snapshot, null, 2)); return; }
  ensure(process.platform === 'darwin' && process.arch === 'arm64' && fs.existsSync('/usr/bin/sandbox-exec'), 'LOCAL_NETWORK_SANDBOX_REQUIRED');
  const browser = checkedPath(ROOT, LOCAL_BROWSER);
  fs.accessSync(browser, fs.constants.X_OK);
  fs.accessSync(checkedPath(ROOT, LOCAL_CLI), fs.constants.R_OK);
  const runtime = {node: process.execPath, nodeSha256: sha(fs.readFileSync(process.execPath)), browserSha256: fileHash(ROOT, LOCAL_BROWSER),
    portConfigSha256: fileHash(ROOT, REMOTION_PORT_CONFIG), bindHost: '127.0.0.1'};
  const commands = buildCommands(ROOT, command);
  assertSnapshot(ROOT, snapshot);
  assertOutputsAvailable(ROOT, command);
  snapshot.knowledgeContext = validateKnowledgeContext(snapshot.knowledgeContext);
  fs.mkdirSync(checkedPath(ROOT, OUTPUT_ROOT, true), {recursive: true, mode: 0o700});
  const lock = `${OUTPUT_ROOT}/active-run.lock`;
  writeNew(ROOT, lock, {pid: process.pid, command, manifestSha256: snapshot.manifestSha256});
  let started = false;
  const completed = [];
  const base = {...snapshot, runtime, commands, outputSize: {width: 960, height: 540}, intrinsic: {width: 1920, height: 1080, fps: 30, durationInFrames: 930}};
  try {
    writeNew(ROOT, `${OUTPUT_ROOT}/${command}.start.json`, {...base, status: 'local-preview-started', at: new Date().toISOString(), outputSHA: []});
    started = true;
    if (command === 'stills') fs.mkdirSync(checkedPath(ROOT, `${OUTPUT_ROOT}/stills`, true), {mode: 0o700});
    for (const spec of commands) {
      assertSnapshot(ROOT, snapshot);
      assertAbsent(ROOT, spec.output);
      base.knowledgeContext = validateKnowledgeContext(snapshot.knowledgeContext);
      const result = spawnSync(spec.executable, spec.args, {
        cwd: spec.cwd, stdio: 'inherit', timeout: 30 * 60 * 1000,
        env: {PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME, TMPDIR: process.env.TMPDIR ?? '/tmp', LANG: 'zh_CN.UTF-8', CI: '1'},
      });
      ensure(!result.error && result.status === 0, 'RENDER_PROCESS_FAILED', result.error?.message ?? String(result.status));
      assertSnapshot(ROOT, snapshot);
      ensure(fs.statSync(checkedPath(ROOT, spec.output)).size > 0, 'OUTPUT_EMPTY', spec.output);
      completed.push({path: spec.output, sha256: fileHash(ROOT, spec.output)});
    }
    base.knowledgeContext = validateKnowledgeContext(snapshot.knowledgeContext);
    const finish = {...base, status: 'local-preview-generated-awaiting-review', at: new Date().toISOString(), outputSHA: completed};
    writeNew(ROOT, `${OUTPUT_ROOT}/${command}.finish.json`, finish);
    console.log(JSON.stringify(finish, null, 2));
  } catch (error) {
    if (started) {
      const outputSHA = commands.flatMap(({output}) => {
        try { return [{path: output, sha256: fileHash(ROOT, output)}]; } catch { return []; }
      });
      writeNew(ROOT, `${OUTPUT_ROOT}/${command}.finish.json`, {...base, knowledgeContext: error.knowledgeContext ?? base.knowledgeContext,
        status: 'local-preview-failed-retained', at: new Date().toISOString(), error: error.message, outputSHA});
    }
    throw error;
  } finally { fs.unlinkSync(checkedPath(ROOT, lock)); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === HERE) {
  main().catch((error) => { console.error(JSON.stringify({status: 'local-preview-blocked-or-failed', error: error.message,
    knowledgeContext: error.knowledgeContext, formalEnabled: false, productionEligible: false, userPostReview: 'pending'})); process.exitCode = 1; });
}
