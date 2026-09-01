import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';

export const KNOWLEDGE_CONTEXT_REQUIRED_COMMANDS_V2 = new Set([
  'fingerprint',
  'preview',
  'risk-frames',
  'audio-preflight',
  'formal-audio',
  'prepare',
  'formal',
  'qa',
  'regression',
  'all',
  'direct-remotion-preview',
  'direct-remotion-render',
  'release-validation',
]);

export class KnowledgeContextProductionGateV2Error extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'KnowledgeContextProductionGateV2Error';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = null) => {
  throw new KnowledgeContextProductionGateV2Error(code, message, details);
};
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const sha256File = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex');

const assertDirectory = (pathValue, code, label) => {
  if (!existsSync(pathValue) || !lstatSync(pathValue).isDirectory()) {
    fail(code, `${label}不存在或不是目录。`);
  }
  if (lstatSync(pathValue).isSymbolicLink() || realpathSync(pathValue) !== pathValue) {
    fail(code, `${label}不得是符号链接或经由非规范路径。`);
  }
};

const resolveContextInsideTaskRoot = (taskRoot, contextPath) => {
  if (!isText(contextPath) || isAbsolute(contextPath)) {
    fail('KCPG2_CONTEXT_PATH_INVALID', 'knowledgeContext.contextPath 必须是任务目录内非空相对路径。');
  }
  const absolute = resolve(taskRoot, contextPath);
  const relation = relative(taskRoot, absolute);
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    fail('KCPG2_CONTEXT_PATH_OUTSIDE', 'knowledgeContext.contextPath 逃逸 .opc-rag/tasks。');
  }
  let cursor = taskRoot;
  for (const segment of relation.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      fail('KCPG2_CONTEXT_PATH_SYMLINK', '任务上下文路径不得经过符号链接。');
    }
  }
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) {
    fail('KCPG2_CONTEXT_MISSING', `任务上下文不存在：${contextPath}`);
  }
  if (realpathSync(absolute) !== absolute) {
    fail('KCPG2_CONTEXT_REALPATH_MISMATCH', '任务上下文真实路径不一致。');
  }
  return absolute;
};

const readContext = (contextPath) => {
  try {
    const context = JSON.parse(readFileSync(contextPath, 'utf8'));
    if (!isRecord(context)) throw new Error('根节点不是对象');
    return context;
  } catch (error) {
    fail(
      'KCPG2_CONTEXT_JSON_INVALID',
      `任务上下文不是有效 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const assertJobReadReceipt = ({context, jobPath}) => {
  const group = context.receipt_groups?.task_original_materials;
  if (group?.status !== 'complete' || !Array.isArray(group.entries)) {
    fail('KCPG2_JOB_READ_RECEIPT_MISSING', 'task_original_materials 读取回执缺失或未完成。');
  }
  const canonicalJobPath = resolve(jobPath);
  const entry = group.entries.find((item) =>
    isRecord(item) && resolve(String(item.resolved_path ?? '')) === canonicalJobPath);
  if (!entry) {
    fail('KCPG2_JOB_READ_RECEIPT_MISSING', '当前 production job 未进入 task_original_materials 回执。');
  }
  if (
    entry.states?.retrieved !== true ||
    entry.states?.read !== true ||
    entry.states?.applied !== true ||
    !isText(entry.application_note)
  ) {
    fail(
      'KCPG2_JOB_READ_RECEIPT_INCOMPLETE',
      '当前 production job 必须分别留下 retrieved/read/applied=true 和非空应用说明。',
    );
  }
  const currentJobSha256 = sha256File(canonicalJobPath);
  if (entry.sha256 !== currentJobSha256) {
    fail(
      'KCPG2_JOB_READ_RECEIPT_SHA_MISMATCH',
      '当前 production job 已在读取回执后变化，必须重新生成任务上下文。',
    );
  }
  return {entry, currentJobSha256};
};

export const validateKnowledgeContextForProductionV2 = ({
  projectRoot,
  jobPath,
  job,
  command,
  personalKbRoot = resolve(
    process.env.KOUBO_PERSONAL_KB?.trim() || resolve(projectRoot, '..', '个人知识库'),
  ),
  pythonBinary = process.env.PYTHON?.trim() || 'python3',
  runner = spawnSync,
}) => {
  if (!KNOWLEDGE_CONTEXT_REQUIRED_COMMANDS_V2.has(command)) {
    return {required: false, command};
  }
  if (!isRecord(job?.knowledgeContext)) {
    fail('KCPG2_CONTEXT_REQUIRED', `执行 ${command} 前必须绑定 knowledgeContext。`);
  }
  const binding = job.knowledgeContext;
  if (!isText(binding.taskId)) {
    fail('KCPG2_TASK_ID_REQUIRED', 'knowledgeContext.taskId 缺失。');
  }

  const canonicalProjectRoot = resolve(projectRoot);
  const canonicalPersonalKbRoot = resolve(personalKbRoot);
  assertDirectory(canonicalPersonalKbRoot, 'KCPG2_PERSONAL_KB_INVALID', '个人知识库根目录');
  const taskRoot = resolve(canonicalPersonalKbRoot, '.opc-rag/tasks');
  assertDirectory(taskRoot, 'KCPG2_TASK_ROOT_INVALID', '个人知识库任务上下文目录');
  const contextPath = resolveContextInsideTaskRoot(taskRoot, binding.contextPath);
  const context = readContext(contextPath);

  if (context.task?.id !== binding.taskId) {
    fail(
      'KCPG2_TASK_ID_MISMATCH',
      `任务上下文 ID 不匹配：job=${binding.taskId}，context=${context.task?.id ?? '缺失'}。`,
    );
  }
  if (context.task?.important !== true) {
    fail('KCPG2_IMPORTANT_TASK_REQUIRED', '口播生产上下文必须标记 important=true。');
  }
  if (resolve(String(context.project_route?.project_root ?? '')) !== canonicalProjectRoot) {
    fail('KCPG2_PROJECT_ROUTE_MISMATCH', '任务上下文绑定的主项目不是当前口播项目。');
  }
  if (context.gate?.formal_execution_allowed !== true || context.status !== 'context-ready') {
    fail('KCPG2_CONTEXT_NOT_READY', '任务上下文自身尚未允许正式执行。');
  }
  const receipt = assertJobReadReceipt({context, jobPath});

  const ragScript = resolve(
    canonicalPersonalKbRoot,
    '04_Claude Code日常操作/scripts/opc_rag.py',
  );
  if (!existsSync(ragScript) || !lstatSync(ragScript).isFile()) {
    fail('KCPG2_RAG_VALIDATOR_MISSING', '个人知识库 RAG 上下文复检脚本不存在。');
  }
  const validation = runner(
    pythonBinary,
    [ragScript, 'validate-context', '--context', contextPath],
    {
      cwd: canonicalPersonalKbRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const combinedOutput = `${validation.stdout ?? ''}${validation.stderr ?? ''}`.trim();
  if (validation.error || validation.status !== 0) {
    fail(
      'KCPG2_CONTEXT_VALIDATION_FAILED',
      `任务上下文复检未通过：${combinedOutput || validation.error?.message || `退出码 ${validation.status ?? 'unknown'}`}`,
    );
  }
  let result;
  try {
    result = JSON.parse(validation.stdout);
  } catch (error) {
    fail(
      'KCPG2_CONTEXT_VALIDATION_OUTPUT_INVALID',
      `任务上下文复检未返回有效 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (result.status !== 'context-valid' || result.gate?.formal_execution_allowed !== true) {
    fail(
      'KCPG2_CONTEXT_VALIDATION_FAILED',
      `任务上下文复检状态不是 context-valid：${result.status ?? '缺失'}。`,
    );
  }

  return {
    required: true,
    command,
    taskId: binding.taskId,
    contextPath: relative(taskRoot, contextPath).split(sep).join('/'),
    contextSha256: sha256File(contextPath),
    jobReceiptSha256: receipt.currentJobSha256,
    validationStatus: result.status,
    formalExecutionAllowed: true,
  };
};
