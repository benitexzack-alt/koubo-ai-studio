import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
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
const phaseStatuses = [
  'draft',
  'layout-proof',
  'machine-ready',
  'visual-review',
  'grid-ready',
  'selected',
  'final-review',
  'final-ready',
  'approved',
];
const statuses = [...phaseStatuses, 'rejected'];
const statusIndex = phaseStatuses.indexOf(task.status);
const isRejected = task.status === 'rejected';
const atLeast = (status) => !isRejected && statusIndex >= phaseStatuses.indexOf(status);
const schemaVersion = Number(task.schemaVersion);
const isSchemaV2 = schemaVersion === 2;
const candidates = task.grid?.candidates ?? [];
const resolveProjectPath = (relativePath) => path.resolve(projectRoot, relativePath ?? '');
const exists = (relativePath) => typeof relativePath === 'string' && relativePath.length > 0 && fs.existsSync(resolveProjectPath(relativePath));
const passed = (item) => item?.status === 'passed';
const normalize = (value) => String(value ?? '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
const ocrRequested = args.includes('--ocr');
const declaredArtifactTier = task.artifactTier ?? task.grid?.artifactTier ?? '';
const formalSelectionGrid = isSchemaV2 && atLeast('machine-ready');
const outputReviewRequired = isSchemaV2 ? atLeast('visual-review') : atLeast('grid-ready');

if (![1, 2].includes(schemaVersion)) errors.push('任务单 schemaVersion 必须为 1 或 2。');
if (!task.coverId) errors.push('缺少 coverId。');
if (!task.releaseId) errors.push('缺少 releaseId。');
if (!statuses.includes(task.status)) errors.push(`未知状态：${task.status}`);
if (task.canvas?.width !== 1080 || task.canvas?.height !== 1440) errors.push('单张画布必须为 1080×1440。');
if (!Array.isArray(task.styleReferenceIds) || task.styleReferenceIds.length === 0) errors.push('至少需要一个 styleReferenceIds。');
if (!exists(task.source?.video)) errors.push(`正式视频不存在：${task.source?.video ?? ''}`);
if (task.source?.portraitVideo && !exists(task.source.portraitVideo)) errors.push(`人物抽帧视频不存在：${task.source.portraitVideo}`);
if (candidates.length !== 4) errors.push(`四宫格必须恰好有 4 个候选，当前为 ${candidates.length}。`);

if (isRejected) {
  const rejectionReason = task.rejection?.reason ?? task.rejectedReason;
  const rejectedAt = task.rejection?.rejectedAt ?? task.rejectedAt;
  if (!String(rejectionReason ?? '').trim()) errors.push('rejected 状态必须记录 rejection.reason。');
  if (!String(rejectedAt ?? '').trim()) errors.push('rejected 状态必须记录 rejection.rejectedAt。');
}

if (isSchemaV2 && formalSelectionGrid) {
  if (declaredArtifactTier !== 'selection-grid') {
    errors.push(`machine-ready 及以后必须使用 artifactTier=selection-grid，当前为 ${declaredArtifactTier || '缺失'}。`);
  }
  if (task.grid?.sharedPaletteLocked !== true && task.styleContract?.sharedPaletteLocked !== true) {
    errors.push('schema v2 正式四宫格必须记录 sharedPaletteLocked=true。');
  }
  if (!task.styleReferenceIds.includes('strong-title-tech-cover.v3')) {
    errors.push('schema v2 正式四宫格必须引用 strong-title-tech-cover.v3。');
  }
}

const exactIds = candidates.map((item) => String(item.id)).sort().join(',');
if (exactIds !== '1,2,3,4') errors.push(`候选编号必须且只能为 1、2、3、4，当前为 ${exactIds || '空'}。`);

const assertUnique = (label, values) => {
  if (new Set(values).size !== values.length) errors.push(`四个候选的${label}必须全部不同。`);
};

const semanticFingerprint = (candidate) => {
  const values = [
    candidate.background?.semanticObject,
    candidate.background?.semanticObjects,
    candidate.background?.motif,
    candidate.background?.sceneNarrative,
    candidate.semanticObject,
    candidate.semanticObjects,
    candidate.evidenceObjects,
  ].flat(Infinity).filter(Boolean);
  return normalize(values.join('|'));
};

const titleFingerprint = (candidate) => normalize(
  candidate.angle
  ?? candidate.copy?.angle
  ?? (candidate.copy?.headlineLines ?? []).map((line) => typeof line === 'string' ? line : line.text).join(''),
);

const poseFingerprint = (candidate) => normalize(
  candidate.portrait?.poseIntent
  ?? candidate.portrait?.expressionIntent
  ?? candidate.portrait?.pose,
);

if (candidates.length === 4) {
  assertUnique('标题表达', candidates.map((item) => normalize((item.copy?.headlineLines ?? []).map((line) => typeof line === 'string' ? line : line.text).join(''))));
  assertUnique('人物帧时间', candidates.map((item) => Number(item.portrait?.frameSecond)));

  if (schemaVersion === 1) {
    // 保持旧任务单的既有门禁，避免 v1 任务在升级校验器后发生语义漂移。
    assertUnique('人物表情意图', candidates.map((item) => item.portrait?.expressionIntent));
    assertUnique('画面构图', candidates.map((item) => item.layout));
    assertUnique('背景氛围', candidates.map((item) => item.background?.atmosphere));
    assertUnique('颜色搭配', candidates.map((item) => `${item.palette?.base}|${item.palette?.secondary}|${item.palette?.accent}|${item.palette?.warm}`));
  } else {
    for (const candidate of candidates) {
      if (!titleFingerprint(candidate)) errors.push(`候选 ${candidate.id} 缺少标题角度。`);
      if (!poseFingerprint(candidate)) errors.push(`候选 ${candidate.id} 缺少人物姿态意图。`);
      if (!semanticFingerprint(candidate)) errors.push(`候选 ${candidate.id} 缺少主题证据物或场景叙事。`);
    }

    for (let left = 0; left < candidates.length; left += 1) {
      for (let right = left + 1; right < candidates.length; right += 1) {
        const first = candidates[left];
        const second = candidates[right];
        const differences = [
          titleFingerprint(first) !== titleFingerprint(second),
          poseFingerprint(first) !== poseFingerprint(second),
          normalize(first.layout) !== normalize(second.layout),
          semanticFingerprint(first) !== semanticFingerprint(second),
        ].filter(Boolean).length;
        if (differences < 3) {
          errors.push(`候选 ${first.id} 与 ${second.id} 在标题角度、人物姿态、构图重心、语义物件中仅 ${differences} 项不同，至少需要 3 项。`);
        }
      }
    }
  }
}

const allowedLayouts = new Set([
  'cinematic-right',
  'clean-center',
  'evidence-split',
  'local-story',
  'workbench-right',
  'blueprint-right',
  'evidence-left',
  'local-left',
]);
const allowedBackgroundModes = new Set(['generated', 'deterministic']);
const riskTerms = ['行业第一', '全国第一', '西北第一', '全网第一', '唯一', '首家', '领先', '最佳', '顶级', '最强', '保证获客', '保证涨粉', '保证成交', '稳赚', '必赚', '政府背书', '国家认证', '内部渠道', '效率翻倍', '收入翻倍'];

for (const candidate of candidates) {
  if (!allowedLayouts.has(candidate.layout)) errors.push(`候选 ${candidate.id} 的布局无效：${candidate.layout}`);
  if (!Number.isFinite(Number(candidate.portrait?.frameSecond)) || Number(candidate.portrait?.frameSecond) < 0) errors.push(`候选 ${candidate.id} 的 frameSecond 无效。`);
  const backgroundMode = candidate.background?.mode;
  if (!allowedBackgroundModes.has(backgroundMode)) errors.push(`候选 ${candidate.id} 的 background.mode 必须是 generated 或 deterministic。`);
  if (!candidate.background?.generationReason?.trim()) errors.push(`候选 ${candidate.id} 必须记录 background.generationReason。`);
  if (backgroundMode === 'generated' && atLeast('grid-ready') && !exists(candidate.background?.path)) {
    errors.push(`候选 ${candidate.id} 声明使用 AI 背景，但背景文件不存在：${candidate.background?.path ?? ''}`);
  }
  if (formalSelectionGrid) {
    if (backgroundMode !== 'generated') {
      errors.push(`候选 ${candidate.id} 是正式 selection-grid，禁止使用 deterministic/code placeholder 背景。`);
    }
    if (candidate.background?.readiness !== 'final') {
      errors.push(`候选 ${candidate.id} 的正式背景必须标记 background.readiness=final。`);
    }
    if (!exists(candidate.background?.path)) {
      errors.push(`候选 ${candidate.id} 的最终背景文件不存在：${candidate.background?.path ?? ''}`);
    }
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

const checkPortraitMatte = async (candidate) => {
  const relativePath = candidate.portrait?.mattePath;
  const label = `候选 ${candidate.id} 人物蒙版`;
  if (!exists(relativePath)) {
    errors.push(`${label}不存在：${relativePath ?? ''}`);
    return;
  }
  try {
    const absolutePath = resolveProjectPath(relativePath);
    const image = sharp(absolutePath);
    const metadata = await image.metadata();
    if (metadata.format !== 'png') errors.push(`${label}必须为 PNG，当前为 ${metadata.format ?? '未知'}。`);
    if (!metadata.hasAlpha || Number(metadata.channels) < 4) {
      errors.push(`${label}必须包含透明 alpha 通道。`);
      return;
    }

    const alpha = await sharp(absolutePath).extractChannel('alpha').raw().toBuffer();
    let visiblePixels = 0;
    let transparentPixels = 0;
    for (const value of alpha) {
      if (value > 8) visiblePixels += 1;
      if (value < 247) transparentPixels += 1;
    }
    const coverage = alpha.length === 0 ? 0 : visiblePixels / alpha.length;
    const transparentRatio = alpha.length === 0 ? 0 : transparentPixels / alpha.length;
    if (transparentRatio < 0.01) errors.push(`${label}虽然带 alpha 通道，但几乎完全不透明，疑似原视频矩形窗口。`);
    if (coverage < 0.01) errors.push(`${label}有效人物像素不足 1%。`);
    if (coverage > 0.96) errors.push(`${label}有效像素覆盖率为 ${(coverage * 100).toFixed(1)}%，疑似矩形截图而非人物抠像。`);
  } catch (error) {
    errors.push(`${label}无法读取 alpha：${error.message}`);
  }
};

if (formalSelectionGrid) {
  for (const candidate of candidates) await checkPortraitMatte(candidate);
}

if (outputReviewRequired) {
  for (const candidate of candidates) {
    await checkImage(candidate.output, 1080, 1440, `候选 ${candidate.id}`);
  }
  await checkImage(task.grid?.output, 2240, 2960, '四宫格预览');

  const gridQa = task.qa?.machine?.grid ?? task.qa?.machine ?? task.qa?.grid;
  for (const key of ['dimensions', 'text', 'identity', 'copyright', 'thumbnail']) {
    if (!passed(gridQa?.[key])) errors.push(`四宫格机器质检未通过：qa.grid.${key}`);
  }
  if (!task.evidence?.ocrReport) {
    errors.push(`${task.status} 阶段必须在 evidence.ocrReport 声明 OCR 报告路径。`);
  } else if (!exists(task.evidence.ocrReport) && !ocrRequested) {
    errors.push(`OCR 报告不存在：${task.evidence.ocrReport}`);
  }
}

if (task.status === 'grid-ready' && (task.selection !== null || task.final !== null)) {
  errors.push('grid-ready 阶段的 selection 和 final 必须为 null。');
}

if (atLeast('selected')) {
  const selectedId = String(task.selection?.candidateId ?? '');
  if (!['1', '2', '3', '4'].includes(selectedId)) errors.push('selected 阶段必须记录用户选择的 1–4 编号。');
  if (task.selection?.selectedBy !== 'user') errors.push('选择必须由用户作出，selectedBy 应为 user。');
}

if (atLeast('final-review')) {
  if (!task.final) {
    errors.push('final-review 及以后阶段缺少 final。');
  } else {
    if (String(task.final.sourceCandidateId) !== String(task.selection?.candidateId)) errors.push('终稿来源编号必须等于用户选中编号。');
    await checkImage(task.final.output, 1080, 1440, '最终封面');
  }
}

if (atLeast('final-ready')) {
  const finalQa = task.qa?.machine?.final ?? task.qa?.final;
  for (const key of ['dimensions', 'text', 'identity', 'copyright', 'thumbnail']) {
    if (!passed(finalQa?.[key])) errors.push(`最终封面质检未通过：qa.final.${key}`);
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

const sha256 = (relativePath) => createHash('sha256').update(fs.readFileSync(resolveProjectPath(relativePath))).digest('hex');
const hashValue = (value) => String(value ?? '').replace(/^sha256:/i, '').trim().toLowerCase();
const normalizeHashMap = (value) => {
  const result = {};
  if (Array.isArray(value)) {
    for (const entry of value) {
      const id = String(entry?.id ?? entry?.candidateId ?? '');
      const hash = entry?.sha256 ?? entry?.hash ?? entry?.value;
      if (id) result[id] = hash;
    }
  } else if (value && typeof value === 'object') {
    for (const [id, entry] of Object.entries(value)) {
      result[String(id)] = typeof entry === 'string' ? entry : (entry?.sha256 ?? entry?.hash ?? entry?.value);
    }
  }
  return result;
};

const scoreValue = (score, ...keys) => {
  for (const key of keys) {
    const value = Number(score?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return Number.NaN;
};

const normalizeCandidateScores = (value) => {
  const result = {};
  if (Array.isArray(value)) {
    for (const entry of value) {
      const id = String(entry?.id ?? entry?.candidateId ?? '');
      if (id) result[id] = entry?.scores ?? entry?.score ?? entry;
    }
  } else if (value && typeof value === 'object') {
    for (const [id, entry] of Object.entries(value)) result[String(id)] = entry?.scores ?? entry?.score ?? entry;
  }
  return result;
};

if (isSchemaV2 && atLeast('grid-ready')) {
  const independentVisual = task.qa?.independentVisual ?? task.qa?.grid?.independentVisual ?? task.independentVisual;
  if (!independentVisual) {
    errors.push('grid-ready 阶段缺少 qa.independentVisual。');
  } else {
    const independentPassed = independentVisual.status === 'passed'
      || independentVisual.decision === 'passed'
      || independentVisual.passed === true;
    if (!independentPassed) errors.push('grid-ready 阶段必须由独立视觉复核明确判定 passed。');
    if (independentVisual.independent !== true) errors.push('独立视觉复核必须记录 independent=true。');
    if (!String(independentVisual.reviewedBy ?? independentVisual.reviewer ?? '').trim()) {
      errors.push('独立视觉复核必须记录 reviewedBy 或 reviewer。');
    }

    const reportPath = independentVisual.reportPath
      ?? independentVisual.report
      ?? task.evidence?.independentVisualReport
      ?? task.evidence?.visualReviewReport;
    let report = {};
    if (!exists(reportPath)) {
      errors.push(`独立视觉复核报告不存在：${typeof reportPath === 'string' ? reportPath : ''}`);
    } else if (path.extname(reportPath).toLowerCase() === '.json') {
      try {
        report = JSON.parse(fs.readFileSync(resolveProjectPath(reportPath), 'utf8'));
        if (report.coverId && report.coverId !== task.coverId) errors.push('独立视觉复核报告的 coverId 与任务单不一致。');
      } catch (error) {
        errors.push(`独立视觉复核报告无法解析：${error.message}`);
      }
    }

    const hardFailures = independentVisual.hardFailures ?? report.hardFailures ?? [];
    if ((Array.isArray(hardFailures) && hardFailures.length > 0) || hardFailures === true) {
      errors.push('独立视觉复核存在审美硬失败，不能进入 grid-ready。');
    }

    const scores = normalizeCandidateScores(
      independentVisual.candidateScores
      ?? independentVisual.candidates
      ?? report.candidateScores
      ?? report.candidates,
    );
    const totals = [];
    for (const id of ['1', '2', '3', '4']) {
      const score = scores[id];
      if (!score) {
        errors.push(`独立视觉复核缺少候选 ${id} 的评分。`);
        continue;
      }
      const total = scoreValue(score, 'total', 'totalScore');
      const referenceTranslation = scoreValue(score, 'referenceTranslation', 'referenceMechanismTranslation');
      const portraitIntegration = scoreValue(score, 'portraitIntegration', 'portraitEdgeIntegration');
      const composition = scoreValue(score, 'composition', 'compositionHierarchy');
      const topicRelation = scoreValue(score, 'topicRelation', 'semanticRelation', 'backgroundTopicRelation');
      const thumbnailReadability = scoreValue(score, 'thumbnailReadability', 'thumbnail');
      if (!Number.isFinite(total) || total < 82) errors.push(`候选 ${id} 独立视觉总分必须不低于 82，当前为 ${Number.isFinite(total) ? total : '缺失'}。`);
      else totals.push(total);
      if (!Number.isFinite(referenceTranslation) || referenceTranslation < 15) errors.push(`候选 ${id} 的 referenceTranslation 必须不低于 15/20。`);
      if (!Number.isFinite(portraitIntegration) || portraitIntegration < 15) errors.push(`候选 ${id} 的 portraitIntegration 必须不低于 15/20。`);
      if (!Number.isFinite(composition) || composition < 11) errors.push(`候选 ${id} 的 composition 必须不低于 11/15。`);
      if (!Number.isFinite(topicRelation) || topicRelation < 11) errors.push(`候选 ${id} 的 topicRelation 必须不低于 11/15。`);
      if (!Number.isFinite(thumbnailReadability) || thumbnailReadability < 12) errors.push(`候选 ${id} 的 thumbnailReadability 必须不低于 12/15。`);

      const candidateHardFailures = score.hardFailures ?? [];
      if ((Array.isArray(candidateHardFailures) && candidateHardFailures.length > 0) || candidateHardFailures === true) {
        errors.push(`候选 ${id} 存在审美硬失败，不能进入 grid-ready。`);
      }
    }

    if (totals.length === 4) {
      const average = totals.reduce((sum, value) => sum + value, 0) / totals.length;
      if (average < 85) errors.push(`四张独立视觉平均分必须不低于 85，当前为 ${average.toFixed(2)}。`);
    }

    const groupScores = independentVisual.groupScores ?? independentVisual.group ?? report.groupScores ?? report.group ?? {};
    const brandConsistency = scoreValue(groupScores, 'brandConsistency');
    const structuralDifference = scoreValue(groupScores, 'structuralDifference', 'structureDifference');
    if (!Number.isFinite(brandConsistency) || brandConsistency < 85) errors.push('整组 brandConsistency 必须不低于 85/100。');
    if (!Number.isFinite(structuralDifference) || structuralDifference < 80) errors.push('整组 structuralDifference 必须不低于 80/100。');

    const hashMap = {
      ...normalizeHashMap(report.imageHashes ?? report.hashes),
      ...normalizeHashMap(independentVisual.imageHashes ?? independentVisual.hashes),
    };
    for (const candidate of candidates) {
      const id = String(candidate.id);
      const expectedHash = hashValue(hashMap[id] ?? scores[id]?.sha256 ?? scores[id]?.hash);
      if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
        errors.push(`独立视觉复核缺少候选 ${id} 的有效 SHA-256 哈希。`);
        continue;
      }
      if (exists(candidate.output) && sha256(candidate.output) !== expectedHash) {
        errors.push(`候选 ${id} 当前图片与独立视觉复核记录的 SHA-256 不一致。`);
      }
    }
  }
}

if (ocrRequested && outputReviewRequired) {
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

if (outputReviewRequired && exists(task.evidence?.ocrReport)) {
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
