import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');
export const EPISODE = '20260906_lanzhou_ai_services';
export const REVISION = '20260907-lanzhou-services-candidate-preview-r1';
export const CONTROL = `edit/${EPISODE}/00_工程控制/candidate-preview-r1`;
export const ENTRY = 'remotion/src/lanzhou-services-v91-candidate-r1/index.tsx';
export const PUBLIC = 'remotion/public/lanzhou-services-candidate-r1';
export const OUTPUT = `edit/${EPISODE}/07_预览与质检/candidate-preview-r1`;
export const PERMISSION = `${CONTROL}/permission.v1.json`;
export const RENDER = Object.freeze({width: 1920, height: 1080, scale: 0.5, fps: 30, durationInFrames: 8393});
export const COMPOSITION = 'LanzhouServicesV91CandidateR1';
export const PORT = 54091;
export const DEBUG_PORT = 54092;
export const BROWSER = 'remotion/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell';
export const BINARIES = 'remotion/node_modules/@remotion/compositor-darwin-arm64';
export const RUNTIME_FILES = ['runner.mjs', 'runner-core.mjs', 'runtime/worker.mjs', 'runtime/network-probe.mjs', 'runtime/knowledge-readonly.py'].map(n => `${CONTROL}/${n}`);
export const KB = path.resolve(ROOT, '../个人知识库');
export const RAG = `${KB}/04_Claude Code日常操作/scripts/opc_rag.py`;
export const RAG_CONFIG = `${KB}/04_Claude Code日常操作/scripts/opc_rag_config.json`;
export const CAPTION_COMPONENT = 'remotion/src/components/AdaptiveBilingualCaptionOverlay.tsx';
export const CAPTION_SHA = 'e9fd51cd5d36cd1b98a6d08a3f5eced851992e26f65739e6c3bbdbb766d0570f';
export const SHOTCRAFT_SOURCE = 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx';
export const SHOTCRAFT_COPY = 'remotion/src/lanzhou-services-v91-candidate-r1/ShotcraftEffects.generated.tsx';
const SHA = /^[a-f0-9]{64}$/u;
export const ensure = (condition, code, detail = '') => { if (!condition) throw new Error(`${code}${detail ? `:${detail}` : ''}`); };
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export const stable = x => Array.isArray(x) ? x.map(stable) : record(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])])) : x;
export const digest = x => createHash('sha256').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : JSON.stringify(stable(x))).digest('hex');
export const requestIntentSha256 = request => { const copy = {...request}; delete copy.independentReview; return digest(copy); };
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

export function relativePath(name) {
  ensure(typeof name === 'string' && name.length > 0 && !path.isAbsolute(name) && !/[\\\x00-\x1f:%?#]/u.test(name)
    && name.split('/').every(p => p && p !== '.' && p !== '..'), 'PATH_ESCAPE', String(name));
  ensure(!name.split('/').some(p => /^(?:\.env(?:\.|$)|\.ssh$|\.aws$|\.git$)/u.test(p)), 'SECRET_PATH_FORBIDDEN');
  return name;
}

export function checked(root, name, missing = false) {
  relativePath(name);
  ensure(fs.realpathSync(root) === root, 'ROOT_NOT_CANONICAL');
  let current = root;
  const parts = name.split('/');
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try { stat = fs.lstatSync(current); } catch (e) { if (missing && e.code === 'ENOENT') continue; throw e; }
    ensure(!stat.isSymbolicLink(), 'SYMLINK_FORBIDDEN', name);
    if (i < parts.length - 1) ensure(stat.isDirectory(), 'PARENT_NOT_DIRECTORY', name);
  }
  return current;
}

export function hashFile(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd);
    ensure(before.isFile(), 'REGULAR_FILE_REQUIRED', file);
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, count));
    const after = fs.fstatSync(fd);
    ensure(before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'READ_DRIFT', file);
    return hash.digest('hex');
  } finally { fs.closeSync(fd); }
}

export function absent(root, name) {
  const file = checked(root, name, true);
  try { fs.lstatSync(file); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  throw new Error(`OUTPUT_EXISTS:${name}`);
}

function fileList(root, name) {
  const file = checked(root, name);
  const s = fs.lstatSync(file);
  if (s.isFile()) return [name];
  ensure(s.isDirectory(), 'UNSUPPORTED_FILE_TYPE', name);
  return fs.readdirSync(file).sort().flatMap(n => fileList(root, `${name}/${n}`));
}

function resolvePython() {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter).filter(path.isAbsolute)) {
    const p = path.join(directory, 'python3');
    try { fs.accessSync(p, fs.constants.X_OK); return fs.realpathSync(p); } catch {}
  }
  throw new Error('LOCAL_PYTHON_MISSING');
}

// Include installed bytes and native tools; a lockfile alone is not a dependency closure.
export function collectRuntime(root = ROOT) {
  const files = [];
  const modules = checked(root, 'remotion/node_modules');
  const visit = (absolute) => {
    const rel = path.relative(root, absolute).split(path.sep).join('/');
    const s = fs.lstatSync(absolute);
    if (s.isSymbolicLink()) {
      const target = fs.realpathSync(absolute);
      ensure(target.startsWith(`${modules}/`), 'RUNTIME_SYMLINK_ESCAPE', rel);
      files.push({path: rel, link: fs.readlinkSync(absolute), target: path.relative(root, target)});
    } else if (s.isDirectory()) {
      for (const n of fs.readdirSync(absolute).sort()) {
        visit(path.join(absolute, n));
      }
    } else {
      ensure(s.isFile(), 'RUNTIME_SPECIAL_FILE', rel);
      files.push({path: rel, sha256: hashFile(absolute)});
    }
  };
  visit(modules);
  for (const n of [...RUNTIME_FILES, 'remotion/package.json', 'remotion/package-lock.json', 'remotion/tsconfig.json']) {
    files.push({path: n, sha256: hashFile(checked(root, n))});
  }
  for (const n of [BROWSER, `${BINARIES}/ffmpeg`, `${BINARIES}/ffprobe`]) fs.accessSync(checked(root, n), fs.constants.X_OK);
  const node = fs.realpathSync(process.execPath);
  const python = resolvePython();
  for (const n of [node, python, '/usr/bin/sandbox-exec', RAG, RAG_CONFIG]) {
    ensure(fs.existsSync(n), 'LOCAL_RUNTIME_MISSING', n);
    files.push({path: n, sha256: hashFile(n)});
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {sha256: digest(files), files, node, python, browser: path.join(root, BROWSER)};
}

function ref(root, binding, code) {
  ensure(record(binding) && SHA.test(binding.sha256), `${code}_BINDING_REQUIRED`);
  const file = checked(root, binding.path);
  ensure(hashFile(file) === binding.sha256, `${code}_SHA_MISMATCH`, binding.path);
  return file;
}

export function validatePermission(p, request, command) {
  ensure(p.schemaVersion === 'lanzhou-services-first-preview-permission/v1', 'OLD_GRANT_FORBIDDEN');
  ensure(p.episodeId === EPISODE && request.episodeId === EPISODE && p.revisionId === REVISION && request.revisionId === REVISION, 'EPISODE_REVISION_MISMATCH');
  ensure(p.directorTaskId === 'task-20260906T154937Z-69f6ebf8', 'DIRECTOR_ID_MISMATCH');
  for (const key of ['formalEnabled', 'productionEligible', 'cryptographicProductionAuthorization', 'userPreviewApproved', 'publishAuthorized']) {
    ensure(p[key] === false, 'FORMAL_AUTHORIZATION_FORBIDDEN', key);
  }
  const s = p.scope;
  ensure(s?.localOnly === true && s.preserveExistingFivePaperClips === true && s.allowNewGeneration === false
    && s.allowExternalNetwork === false && s.allowPayments === false && s.allowOverwrite === false, 'PERMISSION_SCOPE_INVALID');
  ensure(Array.isArray(s.allowedCommands) && s.allowedCommands.includes(command)
    && s.allowedCommands.every(c => ['preflight', 'stills', 'render'].includes(c)), 'COMMAND_NOT_AUTHORIZED');
  ensure(digest(s.canvas) === digest({width: 1920, height: 1080, fps: 30, durationInFrames: 8393})
    && digest(s.output) === digest({width: 960, height: 540, fps: 30}) && s.outputRoot === OUTPUT, 'PERMISSION_RENDER_SCOPE_MISMATCH');
  ensure(s.keepAllHostFrames === 8149 && s.openingInsert?.afterSourceFrameExclusive === 69
    && s.openingInsert?.sourceVideoFrames === 243 && s.openingInsert?.outputFrames === 244, 'SOURCE_TIMELINE_SCOPE_MISMATCH');
  ensure(p.evidence?.kind === 'current-conversation-direct-user-confirmation' && p.evidence.userQuote?.trim()
    && p.evidence.confirmedQuestion?.trim(), 'CURRENT_USER_EVIDENCE_REQUIRED');
  ensure(p.exceptionInheritance === 'forbidden-other-episodes-or-assets'
    && p.postshootRepresentation?.preshootB23 === 'recorded-absence-not-output'
    && p.postshootRepresentation?.labelVisibility === 'first-frame-baked-visible-from-source-frame-zero'
    && p.postshootRepresentation?.labelActionIsFirstReveal === false
    && p.postshootRepresentation?.currentSharedPostshootValidatorPassed === false, 'EXCEPTION_SCOPE_INVALID');
  ensure(p.subtitleAuthority === 'actual-recording' && p.scriptRole === 'comparison-only'
    && p.unresolvedAsrMustRemainVisibleInReceipt === true, 'SPOKEN_SOURCE_REQUIRED');
  const scenes = p.acceptedPaperExceptions;
  ensure(Array.isArray(scenes) && scenes.length === 5 && new Set(scenes.map(x => x.sceneId)).size === 5
    && scenes.every(x => /^P0[1-5]$/u.test(x.sceneId) && SHA.test(x.sha256) && x.defect?.trim() && x.disposition?.trim()), 'FIVE_ASSET_EXCEPTIONS_REQUIRED');
}

export function collectLocalImports(root, entry, declared, ts) {
  const seen = new Set();
  let captionUses = 0;
  const allowedPackages = new Set(['react', 'react/jsx-runtime', 'remotion', '@remotion/media', '@remotion/fonts', '@remotion/captions']);
  const visit = name => {
    if (seen.has(name)) return;
    ensure(declared.has(name), 'IMPORT_BINDING_MISSING', name);
    ensure(!name.includes('/node_modules/'), 'LOCAL_RUNTIME_IMPORT_FORBIDDEN', name);
    seen.add(name);
    const text = fs.readFileSync(checked(root, name), 'utf8');
    if (name.endsWith('.json')) { JSON.parse(text); return; }
    ensure(/\.[cm]?[jt]sx?$/u.test(name), 'IMPORT_TYPE_UNSUPPORTED', name);
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    ensure(source.parseDiagnostics.length === 0, 'SOURCE_PARSE_FAILED', name);
    if (name === CAPTION_COMPONENT) ensure(declared.get(name) === CAPTION_SHA && hashFile(checked(root, name)) === CAPTION_SHA, 'CAPTION_IMPLEMENTATION_CHANGED');
    const walk = node => {
      if (ts.isIdentifier(node) && node.text === 'fetch') {
        const call = node.parent;
        const arg = ts.isCallExpression(call) && call.arguments[0];
        ensure(name === CAPTION_COMPONENT && call.expression === node && call.arguments.length === 1
          && ts.isCallExpression(arg) && ts.isIdentifier(arg.expression) && arg.expression.text === 'staticFile'
          && arg.arguments.length === 1 && ts.isIdentifier(arg.arguments[0]) && arg.arguments[0].text === 'captionsSrc', 'DYNAMIC_IO_FORBIDDEN', `${name}:fetch`);
      }
      if (ts.isIdentifier(node)) ensure(!['XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'eval', 'Function', 'require', 'process'].includes(node.text), 'DYNAMIC_IO_FORBIDDEN', `${name}:${node.text}`);
      if (name !== CAPTION_COMPONENT && ts.isIdentifier(node) && node.text === 'AdaptiveBilingualCaptionOverlay') {
        const p = node.parent;
        ensure((ts.isImportSpecifier(p) && !p.propertyName) || ((ts.isJsxSelfClosingElement(p) || ts.isJsxOpeningElement(p)) && p.tagName === node)
          || (ts.isJsxClosingElement(p) && p.tagName === node), 'CAPTION_ALIAS_FORBIDDEN');
      }
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === 'AdaptiveBilingualCaptionOverlay') {
        const attrs = node.attributes.properties;
        ensure(!attrs.some(a => ts.isJsxSpreadAttribute(a)), 'CAPTION_PROP_SPREAD_FORBIDDEN');
        const props = attrs.filter(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'captionsSrc');
        ensure(props.length === 1 && props[0].initializer && ts.isStringLiteral(props[0].initializer)
          && props[0].initializer.text === 'captions.json', 'CAPTION_LITERAL_REQUIRED');
        captionUses++;
      }
      if (ts.isCallExpression(node)) ensure(node.expression.kind !== ts.SyntaxKind.ImportKeyword, 'DYNAMIC_IMPORT_FORBIDDEN', name);
      if (ts.isStringLiteralLike(node)) ensure(!/^(?:https?:|file:|data:|\/\/)/iu.test(node.text), 'REMOTE_ASSET_FORBIDDEN', name);
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        ensure(ts.isStringLiteral(node.moduleSpecifier), 'IMPORT_INVALID', name);
        const spec = node.moduleSpecifier.text;
        if (!spec.startsWith('.')) ensure(allowedPackages.has(spec), 'PACKAGE_NOT_ALLOWED', spec);
        else {
          const base = path.posix.normalize(path.posix.join(path.posix.dirname(name), spec));
          relativePath(base);
          const possibilities = /\.[cm]?[jt]sx?$|\.json$/u.test(base) ? [base]
            : [base, ...['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '/index.tsx', '/index.ts'].map(e => base + e)];
          const found = possibilities.filter(n => { const f = checked(root, n, true); return fs.existsSync(f) && fs.lstatSync(f).isFile(); });
          ensure(found.length === 1, 'IMPORT_UNRESOLVED_OR_AMBIGUOUS', spec);
          if (found[0] === CAPTION_COMPONENT) {
            const bindings = ts.isImportDeclaration(node) && node.importClause?.namedBindings;
            ensure(bindings && ts.isNamedImports(bindings) && !node.importClause.name && bindings.elements.length === 1
              && !bindings.elements[0].propertyName && bindings.elements[0].name.text === 'AdaptiveBilingualCaptionOverlay', 'CAPTION_ALIAS_FORBIDDEN');
          }
          visit(found[0]);
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  };
  visit(entry);
  if (seen.has(CAPTION_COMPONENT)) ensure(captionUses === 1 && declared.has(`${PUBLIC}/captions.json`), 'CAPTION_SINGLE_USE_REQUIRED');
  return [...seen].sort();
}

export function outputNames(request, command) {
  ensure(['preflight', 'stills', 'render'].includes(command), 'COMMAND_FORBIDDEN');
  if (command === 'render') return [`${OUTPUT}/render/with-sfx-960x540.mp4`];
  if (command === 'stills') return request.stillFrames.map(n => `${OUTPUT}/stills/frame-${String(n).padStart(5, '0')}.png`);
  return [];
}

export function validateRequest({root = ROOT, kb = KB, requestPath, command, runtime, ts, now = Date.now()}) {
  ensure(['preflight', 'stills', 'render'].includes(command), 'COMMAND_FORBIDDEN');
  ensure(requestPath.startsWith(`${CONTROL}/`) && requestPath.endsWith('.json'), 'REQUEST_SCOPE_INVALID');
  const absolute = checked(root, requestPath);
  const request = readJson(absolute);
  const allowed = ['schemaVersion', 'episodeId', 'revisionId', 'permission', 'entry', 'compositionId', 'publicDir', 'render', 'stillFrames', 'knowledgeContext', 'runtimeSha256', 'bindings', 'independentReview'];
  ensure(Object.keys(request).every(k => allowed.includes(k)), 'UNKNOWN_REQUEST_FIELD');
  ensure(request.schemaVersion === 'koubo-lanzhou-candidate-preview/v1', 'REQUEST_SCHEMA_INVALID');
  ensure(request.permission?.path === PERMISSION, 'OLD_GRANT_FORBIDDEN');
  const permission = readJson(ref(root, request.permission, 'PERMISSION'));
  validatePermission(permission, request, command);
  ensure(request.entry === ENTRY && request.compositionId === COMPOSITION && request.publicDir === PUBLIC, 'FIXED_ENTRY_REQUIRED');
  ensure(digest(request.render) === digest(RENDER), 'LOW_RES_ONLY');
  ensure(Array.isArray(request.stillFrames) && request.stillFrames.length > 0 && request.stillFrames.length <= 32
    && new Set(request.stillFrames).size === request.stillFrames.length
    && request.stillFrames.every(n => Number.isInteger(n) && n >= 0 && n < 8393), 'STILL_RANGE_INVALID');
  ensure(SHA.test(request.runtimeSha256) && request.runtimeSha256 === runtime.sha256, 'RUNTIME_DRIFT');
  ensure(Array.isArray(request.bindings) && request.bindings.length > 0, 'BINDINGS_REQUIRED');
  const byPath = new Map();
  for (const b of request.bindings) {
    ensure(record(b) && Object.keys(b).length === 2 && !byPath.has(b.path), 'BINDING_DUPLICATE_OR_INVALID');
    ensure(!b.path.startsWith(`${OUTPUT}/`) && !b.path.startsWith(`${CONTROL}/runtime/`) && b.path !== requestPath
      && b.path !== PERMISSION && b.path !== request.independentReview?.path, 'BINDING_CYCLE_OR_OUTPUT');
    ensure(b.path.startsWith('remotion/src/') || b.path.startsWith(`${PUBLIC}/`) || b.path.startsWith(`edit/${EPISODE}/`)
      || b.path.startsWith('skills/koubo-remotion-director/assets/') || b.path.startsWith('skills/koubo-shotcraft-library/assets/'), 'ASSET_SCOPE_INVALID', b.path);
    ref(root, b, 'ASSET');
    byPath.set(b.path, b.sha256);
  }
  const publicFiles = fileList(root, PUBLIC);
  ensure(publicFiles.length > 0 && publicFiles.every(n => byPath.has(n)), 'PUBLIC_CLOSURE_INCOMPLETE');
  const publicHashes = new Set(publicFiles.map(n => byPath.get(n)));
  for (const item of permission.acceptedPaperExceptions) ensure(publicHashes.has(item.sha256), 'ACCEPTED_PAPER_ASSET_MISSING', item.sceneId);
  ensure(byPath.has(`${PUBLIC}/fonts/STHeiti-Medium.ttc`), 'LOCAL_FONT_MISSING');
  const imports = collectLocalImports(root, ENTRY, byPath, ts);
  if (imports.includes(SHOTCRAFT_COPY)) ensure(byPath.has(SHOTCRAFT_SOURCE)
    && byPath.get(SHOTCRAFT_COPY) === byPath.get(SHOTCRAFT_SOURCE), 'SHOTCRAFT_COPY_SOURCE_MISMATCH');
  const k = request.knowledgeContext;
  ensure(record(k) && /^[A-Za-z0-9_-]+$/u.test(k.taskId) && SHA.test(k.sha256), 'CONTEXT_BINDING_REQUIRED');
  const expectedContext = path.join(kb, '.opc-rag/tasks', k.taskId, 'context.json');
  ensure(k.contextPath === expectedContext, 'CONTEXT_PATH_ESCAPE');
  const contextFile = checked(kb, path.relative(kb, expectedContext));
  ensure(hashFile(contextFile) === k.sha256, 'CONTEXT_SHA_MISMATCH');
  const context = readJson(contextFile);
  ensure(context.task?.id === k.taskId && context.task?.important === true && context.status === 'context-ready'
    && context.gate?.formal_execution_allowed === true && context.project_route?.project_root === root, 'CONTEXT_NOT_READY');
  const materials = context.receipt_groups?.task_original_materials;
  ensure(materials?.status === 'complete' && Array.isArray(materials.entries), 'CONTEXT_MATERIAL_RECEIPTS_REQUIRED');
  for (const name of imports.filter(n => n === ENTRY || n.endsWith('.json'))) {
    const e = materials.entries.find(x => x.resolved_path === path.join(root, name));
    ensure(e?.sha256 === byPath.get(name) && e.states?.retrieved === true && e.states?.read === true && e.states?.applied === true
      && e.application_note?.trim(), 'CONTEXT_MATERIAL_NOT_APPLIED', name);
  }
  const reviewBinding = request.independentReview;
  ensure(reviewBinding?.path?.startsWith(`${CONTROL}/`) && reviewBinding.path !== requestPath && reviewBinding.path !== PERMISSION
    && !reviewBinding.path.startsWith(`${CONTROL}/runtime/`), 'REVIEW_SCOPE_INVALID');
  const review = readJson(ref(root, reviewBinding, 'REVIEW'));
  ensure(review.schemaVersion === 'koubo-lanzhou-candidate-code-review/v1' && review.episodeId === EPISODE && review.revisionId === REVISION
    && review.decision === 'allow-candidate-preview' && review.cryptographicProductionAuthorization === false, 'INDEPENDENT_REVIEW_INVALID');
  ensure(review.reviewerId?.trim() && review.implementerId?.trim() && review.reviewerId !== review.implementerId, 'INDEPENDENT_REVIEWER_REQUIRED');
  ensure(review.requestIntentSha256 === requestIntentSha256(request) && review.runtimeSha256 === runtime.sha256, 'REVIEW_STALE');
  ensure(Number.isFinite(Date.parse(review.reviewedAt)) && Date.parse(review.reviewedAt) <= now && Date.parse(review.expiresAt) > now
    && Date.parse(review.expiresAt) > Date.parse(review.reviewedAt), 'REVIEW_EXPIRED');
  const reviewEvidence = ref(root, review.evidence, 'REVIEW_EVIDENCE');
  ensure(review.evidence.path.startsWith(`edit/${EPISODE}/`) && review.quote?.trim()
    && fs.readFileSync(reviewEvidence, 'utf8').includes(review.quote), 'REVIEW_EVIDENCE_MISMATCH');
  if (command !== 'preflight') absent(root, `${OUTPUT}/${command}`);
  absent(root, `${OUTPUT}/active.lock`);
  const bound = [...request.bindings, request.permission, request.independentReview, review.evidence,
    {path: requestPath, sha256: hashFile(absolute)}];
  return {request, permission, context, imports, publicFiles, bound, runtimeSha256: runtime.sha256,
    requestIntentSha256: requestIntentSha256(request), command, formalEnabled: false, productionEligible: false,
    cryptographicProductionAuthorization: false, userPreviewApproved: false, publishAuthorized: false};
}

export function assertSnapshot(root, snapshot, kb = KB) {
  for (const item of snapshot.bound) ref(root, item, 'INPUT_DRIFT');
  const k = snapshot.request.knowledgeContext;
  ensure(hashFile(checked(kb, path.relative(kb, k.contextPath))) === k.sha256, 'CONTEXT_DRIFT');
  ensure(digest(fileList(root, PUBLIC)) === digest(snapshot.publicFiles), 'PUBLIC_SET_DRIFT');
}

export function cleanEnvironment(scratch) {
  return {PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: path.join(scratch, 'home'), TMPDIR: path.join(scratch, 'tmp'),
    TMP: path.join(scratch, 'tmp'), TEMP: path.join(scratch, 'tmp'), LANG: 'zh_CN.UTF-8', CI: '1', NODE_ENV: 'production'};
}

export function sandboxProfile({root = ROOT, scratch, outputDir, readFiles = [], network = true}) {
  const quote = s => JSON.stringify(s);
  const home = path.dirname(root.split('/Documents/')[0] + '/placeholder');
  const reads = [...RUNTIME_FILES.map(n => path.join(root, n)), ...readFiles];
  return `(version 1)\n(allow default)\n(deny network*)\n` +
    (network ? [PORT, DEBUG_PORT].map(p => `(allow network-outbound (remote ip "localhost:${p}"))\n(allow network-inbound (local ip "localhost:${p}"))\n`).join('') : '') +
    `(deny mach-lookup (global-name "com.apple.securityd") (global-name "com.apple.security.agent") (global-name "com.apple.cfprefsd.agent"))\n` +
    `(deny file-write*)\n(allow file-write* (subpath ${quote(scratch)}) (subpath ${quote(outputDir)}) (literal "/dev/null"))\n` +
    `(deny file-read-data (subpath ${quote(home)}))\n` +
    `(allow file-read-data (subpath ${quote(path.join(root, 'remotion/node_modules'))}) (subpath ${quote(scratch)}) (subpath ${quote(outputDir)}) ${reads.map(f => `(literal ${quote(f)})`).join(' ')})\n` +
    `(deny file-read-data (regex #"(^|/)\\.env($|\\.)") (subpath ${quote(path.join(home, '.ssh'))}) (subpath ${quote(path.join(home, '.aws'))}))\n`;
}

export const loadTypescript = (root = ROOT) => createRequire(path.join(root, 'remotion/package.json'))('typescript');
