import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(scriptRoot, '../../..');
const args = process.argv.slice(2);
const taskArg = args.find((arg) => !arg.startsWith('--'));
const readArg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
};

if (!taskArg) {
  console.error('用法：node validate-cover-task.mjs <cover-task.json> [--project-root 路径] [--ocr]');
  process.exit(1);
}

const projectRoot = path.resolve(readArg('project-root', defaultProjectRoot));
const taskPath = path.resolve(projectRoot, taskArg);
const requireFromRemotion = createRequire(path.join(projectRoot, 'remotion/package.json'));
const sharp = requireFromRemotion('sharp');
const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
const errors = [];
const warnings = [];
const statuses = ['draft', 'grid-ready', 'selected', 'final-ready', 'approved'];
const statusIndex = statuses.indexOf(task.status);
const candidates = task.grid?.candidates ?? [];
const resolveProjectPath = (relativePath) => path.resolve(projectRoot, relativePath ?? '');
const exists = (relativePath) => typeof relativePath === 'string' && relativePath.length > 0 && fs.existsSync(resolveProjectPath(relativePath));
const passed = (item) => item?.status === 'passed';
const normalize = (value) => String(value ?? '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
const ocrRequested = args.includes('--ocr');

if (task.schemaVersion !== 1) errors.push('任务单必须使用 schemaVersion=1。');
if (!task.coverId) errors.push('缺少 coverId。');
if (!task.releaseId) errors.push('缺少 releaseId。');
if (statusIndex === -1) errors.push(`未知状态：${task.status}`);
if (task.canvas?.width !== 1080 || task.canvas?.height !== 1440) errors.push('单张画布必须为 1080×1440。');
if (!Array.isArray(task.styleReferenceIds) || task.styleReferenceIds.length === 0) errors.push('至少需要一个 styleReferenceIds。');
if (!exists(task.source?.video)) errors.push(`正式视频不存在：${task.source?.video ?? ''}`);
if (task.source?.portraitVideo && !exists(task.source.portraitVideo)) errors.push(`人物抽帧视频不存在：${task.source.portraitVideo}`);
if (candidates.length !== 4) errors.push(`四宫格必须恰好有 4 个候选，当前为 ${candidates.length}。`);

const exactIds = candidates.map((item) => String(item.id)).sort().join(',');
if (exactIds !== '1,2,3,4') errors.push(`候选编号必须且只能为 1、2、3、4，当前为 ${exactIds || '空'}。`);

const assertUnique = (label, values) => {
  if (new Set(values).size !== values.length) errors.push(`四个候选的${label}必须全部不同。`);
};

if (candidates.length === 4) {
  assertUnique('标题表达', candidates.map((item) => normalize((item.copy?.headlineLines ?? []).map((line) => typeof line === 'string' ? line : line.text).join(''))));
  assertUnique('人物帧时间', candidates.map((item) => Number(item.portrait?.frameSecond)));
  assertUnique('人物表情意图', candidates.map((item) => item.portrait?.expressionIntent));
  assertUnique('画面构图', candidates.map((item) => item.layout));
  assertUnique('背景氛围', candidates.map((item) => item.background?.atmosphere));
  assertUnique('颜色搭配', candidates.map((item) => `${item.palette?.base}|${item.palette?.secondary}|${item.palette?.accent}|${item.palette?.warm}`));
}

const allowedLayouts = new Set(['cinematic-right', 'clean-center', 'evidence-split', 'local-story']);
const allowedBackgroundModes = new Set(['generated', 'deterministic']);
const riskTerms = ['行业第一', '全国第一', '西北第一', '全网第一', '唯一', '首家', '领先', '最佳', '顶级', '最强', '保证获客', '保证涨粉', '保证成交', '稳赚', '必赚', '政府背书', '国家认证', '内部渠道', '效率翻倍', '收入翻倍'];

for (const candidate of candidates) {
  if (!allowedLayouts.has(candidate.layout)) errors.push(`候选 ${candidate.id} 的布局无效：${candidate.layout}`);
  if (!Number.isFinite(Number(candidate.portrait?.frameSecond)) || Number(candidate.portrait?.frameSecond) < 0) errors.push(`候选 ${candidate.id} 的 frameSecond 无效。`);
  const backgroundMode = candidate.background?.mode;
  if (!allowedBackgroundModes.has(backgroundMode)) errors.push(`候选 ${candidate.id} 的 background.mode 必须是 generated 或 deterministic。`);
  if (!candidate.background?.generationReason?.trim()) errors.push(`候选 ${candidate.id} 必须记录 background.generationReason。`);
  if (backgroundMode === 'generated' && statusIndex >= statuses.indexOf('grid-ready') && !exists(candidate.background?.path)) {
    errors.push(`候选 ${candidate.id} 声明使用 AI 背景，但背景文件不存在：${candidate.background?.path ?? ''}`);
  }
  const lines = candidate.copy?.headlineLines ?? [];
  if (lines.length < 2 || lines.length > 4) errors.push(`候选 ${candidate.id} 的主标题应为 2–4 行。`);
  const copyText = `${lines.map((line) => typeof line === 'string' ? line : line.text).join('')} ${candidate.copy?.subtitle ?? ''}`;
  for (const term of riskTerms) {
    if (copyText.includes(term) && !(task.evidence?.allowedRiskTerms ?? []).includes(term)) {
      errors.push(`候选 ${candidate.id} 含未豁免高风险词：${term}`);
    }
  }
  const prompt = candidate.background?.prompt ?? '';
  if (!/(无人物|no people)/i.test(prompt)) errors.push(`候选 ${candidate.id} 的背景提示词必须明确无人物。`);
  if (!/(无文字|no text)/i.test(prompt)) errors.push(`候选 ${candidate.id} 的背景提示词必须明确无文字。`);
  if (!/(无\s*Logo|no logos?)/i.test(prompt)) errors.push(`候选 ${candidate.id} 的背景提示词必须明确无 Logo。`);
}

const checkImage = async (relativePath, expectedWidth, expectedHeight, label) => {
  if (!exists(relativePath)) {
    errors.push(`${label}不存在：${relativePath ?? ''}`);
    return;
  }
  try {
    const metadata = await sharp(resolveProjectPath(relativePath)).metadata();
    if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
      errors.push(`${label}尺寸错误：${metadata.width}×${metadata.height}，应为 ${expectedWidth}×${expectedHeight}。`);
    }
    if (metadata.format !== 'png') errors.push(`${label}必须为 PNG，当前为 ${metadata.format ?? '未知'}。`);
  } catch (error) {
    errors.push(`${label}无法读取：${error.message}`);
  }
};

if (statusIndex >= statuses.indexOf('grid-ready')) {
  for (const candidate of candidates) {
    await checkImage(candidate.output, 1080, 1440, `候选 ${candidate.id}`);
  }
  await checkImage(task.grid?.output, 2240, 2960, '四宫格预览');
  for (const key of ['dimensions', 'text', 'identity', 'copyright', 'thumbnail']) {
    if (!passed(task.qa?.grid?.[key])) errors.push(`四宫格质检未通过：qa.grid.${key}`);
  }
  if (!task.evidence?.ocrReport) {
    errors.push('grid-ready 阶段必须在 evidence.ocrReport 声明 OCR 报告路径。');
  } else if (!exists(task.evidence.ocrReport) && !ocrRequested) {
    errors.push(`OCR 报告不存在：${task.evidence.ocrReport}`);
  }
}

if (task.status === 'grid-ready' && (task.selection !== null || task.final !== null)) {
  errors.push('grid-ready 阶段的 selection 和 final 必须为 null。');
}

if (statusIndex >= statuses.indexOf('selected')) {
  const selectedId = String(task.selection?.candidateId ?? '');
  if (!['1', '2', '3', '4'].includes(selectedId)) errors.push('selected 阶段必须记录用户选择的 1–4 编号。');
  if (task.selection?.selectedBy !== 'user') errors.push('选择必须由用户作出，selectedBy 应为 user。');
}

if (statusIndex >= statuses.indexOf('final-ready')) {
  if (!task.final) {
    errors.push('final-ready 阶段缺少 final。');
  } else {
    if (String(task.final.sourceCandidateId) !== String(task.selection?.candidateId)) errors.push('终稿来源编号必须等于用户选中编号。');
    await checkImage(task.final.output, 1080, 1440, '最终封面');
  }
  for (const key of ['dimensions', 'text', 'identity', 'copyright', 'thumbnail']) {
    if (!passed(task.qa?.final?.[key])) errors.push(`最终封面质检未通过：qa.final.${key}`);
  }
}

if (task.status === 'approved') {
  if (!task.userReview?.approved) errors.push('approved 状态必须有用户确认。');
  if (!task.userReview?.approvedAt) errors.push('approved 状态必须记录 approvedAt。');
}

const usesGeneratedBackground = candidates.some((candidate) => candidate.background?.mode === 'generated');
if (usesGeneratedBackground && (!task.aiDisclosure?.required || !task.aiDisclosure?.label || !task.aiDisclosure?.publishDeclarationRequired)) {
  errors.push('使用 AI 背景时必须记录 aiDisclosure.required=true、标识文案和 publishDeclarationRequired=true。');
}

if (ocrRequested && statusIndex >= statuses.indexOf('grid-ready')) {
  const ocrReport = {
    schemaVersion: 1,
    coverId: task.coverId,
    createdAt: new Date().toISOString(),
    engine: 'tesseract chi_sim+eng --psm 11',
    role: '辅助提醒；标题源字符串核对与人工缩略图检查仍为必需项',
    candidates: [],
  };

  for (const candidate of candidates) {
    const result = spawnSync('tesseract', [resolveProjectPath(candidate.output), 'stdout', '-l', 'chi_sim+eng', '--psm', '11'], {encoding: 'utf8'});
    const expectedLines = (candidate.copy?.headlineLines ?? []).map((line) => normalize(typeof line === 'string' ? line : line.text)).filter(Boolean);
    if (result.status !== 0) {
      warnings.push(`候选 ${candidate.id} OCR 执行失败。`);
      ocrReport.candidates.push({
        id: String(candidate.id),
        status: 'failed',
        expectedLines,
        recognizedText: '',
        matchedLines: [],
        stderr: String(result.stderr ?? '').trim(),
      });
      continue;
    }
    const actual = normalize(result.stdout);
    const matchedLines = expectedLines.filter((line) => actual.includes(line));
    const hits = matchedLines.length;
    ocrReport.candidates.push({
      id: String(candidate.id),
      status: hits >= Math.ceil(expectedLines.length / 2) ? 'matched' : 'advisory-warning',
      expectedLines,
      recognizedText: String(result.stdout ?? '').trim(),
      normalizedRecognizedText: actual,
      matchedLines,
      hitCount: hits,
      expectedCount: expectedLines.length,
    });
    if (hits < Math.ceil(expectedLines.length / 2)) warnings.push(`候选 ${candidate.id} OCR 仅命中 ${hits}/${expectedLines.length} 行，请人工复查文字。`);
  }

  if (task.evidence?.ocrReport) {
    try {
      const reportPath = resolveProjectPath(task.evidence.ocrReport);
      fs.mkdirSync(path.dirname(reportPath), {recursive: true});
      fs.writeFileSync(reportPath, `${JSON.stringify(ocrReport, null, 2)}\n`, 'utf8');
    } catch (error) {
      errors.push(`OCR 报告写入失败：${error.message}`);
    }
  }
}

if (statusIndex >= statuses.indexOf('grid-ready') && exists(task.evidence?.ocrReport)) {
  try {
    const report = JSON.parse(fs.readFileSync(resolveProjectPath(task.evidence.ocrReport), 'utf8'));
    if (report.schemaVersion !== 1) errors.push('OCR 报告必须使用 schemaVersion=1。');
    if (report.coverId !== task.coverId) errors.push('OCR 报告的 coverId 与任务单不一致。');
    if (!report.createdAt || !report.engine) errors.push('OCR 报告必须记录 createdAt 和 engine。');
    const reportCandidates = Array.isArray(report.candidates) ? report.candidates : [];
    const reportIds = reportCandidates.map((item) => String(item.id)).sort().join(',');
    if (reportIds !== '1,2,3,4') errors.push(`OCR 报告必须完整映射候选 1、2、3、4，当前为 ${reportIds || '空'}。`);
    for (const item of reportCandidates) {
      if (!Array.isArray(item.expectedLines) || item.expectedLines.length === 0) errors.push(`OCR 报告候选 ${item.id} 缺少 expectedLines。`);
      if (typeof item.recognizedText !== 'string') errors.push(`OCR 报告候选 ${item.id} 缺少 recognizedText 字符串。`);
      if (!['matched', 'advisory-warning', 'failed'].includes(item.status)) errors.push(`OCR 报告候选 ${item.id} 的 status 无效。`);
    }
  } catch (error) {
    errors.push(`OCR 报告无法解析：${error.message}`);
  }
}

for (const warning of warnings) console.warn(`警告：${warning}`);
if (errors.length > 0) {
  console.error(`封面任务校验失败：${errors.length} 项`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`封面任务校验通过：${task.coverId}，状态=${task.status}`);
