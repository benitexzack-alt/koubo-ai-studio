#!/usr/bin/env node

import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(packageDir, '../../../..');
const draftPath = path.join(packageDir, '发布包装.md');
const coverPromptPath = path.join(packageDir, '3比4真人截图合成封面提示词.md');
const reviewPath = path.join(packageDir, '发布包装.copy-review.json');
const receiptPath = path.join(packageDir, '发布包装.validation.v1.json');
const validatorPath = fileURLToPath(import.meta.url);
const contentGateValidatorPath = path.join(
  projectRoot,
  'skills/content-brain-gate/scripts/validate_content_gate.py',
);

const expectedFormalVideo = path.join(
  projectRoot,
  'edit/20260912_ai_no_new_business_model/08_正式成片/AI并没有发明新的商业模式_16x9_V8_R1_有音效_正式候选_v1.mp4',
);
const expectedScreenshot = path.join(packageDir, '本条成片真人截图_180秒.png');

const sha256 = (targetArray) =>
  crypto.createHash('sha256').update(targetArray).digest('hex');

const fileSha256 = (filePath) => sha256(fs.readFileSync(filePath));

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const relativeToProject = (filePath) => path.relative(projectRoot, filePath);

const checks = {};
const errors = [];
const warnings = [];

const assertCheck = (name, condition, message) => {
  checks[name] = Boolean(condition);
  if (!condition) errors.push(message);
};

const draft = fs.readFileSync(draftPath, 'utf8');
const coverPrompt = fs.readFileSync(coverPromptPath, 'utf8');
const review = readJson(reviewPath);
const requiredCoverMarkers = ['3:4', '1080×1440', '真实场景'];

const startMarker = '<!-- PUBLIC_COPY_START -->';
const endMarker = '<!-- PUBLIC_COPY_END -->';
const startIndex = draft.indexOf(startMarker);
const endIndex = draft.indexOf(endMarker, startIndex + startMarker.length);
const publicCopy =
  startIndex >= 0 && endIndex > startIndex
    ? draft.slice(startIndex + startMarker.length, endIndex)
    : '';

assertCheck(
  'public_copy_markers_valid',
  startIndex >= 0 && endIndex > startIndex,
  'PUBLIC_COPY标记缺失或顺序错误',
);
assertCheck(
  'draft_hash_matches',
  review.draft?.sha256 === fileSha256(draftPath) &&
    path.resolve(review.draft?.path ?? '') === draftPath,
  'copy_review没有绑定当前发布包装或稿件哈希已变化',
);
assertCheck(
  'cover_prompt_hash_matches',
  review.cover_prompt?.sha256 === fileSha256(coverPromptPath) &&
    path.resolve(review.cover_prompt?.path ?? '') === coverPromptPath,
  'copy_review没有绑定当前封面提示词或提示词哈希已变化',
);

const skillBindings = Object.values(review.skills ?? {});
const skillHashesMatch = skillBindings.length === 2 && skillBindings.every((binding) => {
  const resolved = path.resolve(binding.path ?? '');
  return binding.read === true && fs.existsSync(resolved) && binding.sha256 === fileSha256(resolved);
});
assertCheck(
  'two_skills_hashes_match',
  skillHashesMatch,
  '两项文案Skill的路径、读取状态或SHA-256不匹配',
);

const inputHashMismatches = [];
for (const binding of review.input_bindings ?? []) {
  const resolved = path.resolve(binding.path ?? '');
  if (!fs.existsSync(resolved) || binding.sha256 !== fileSha256(resolved)) {
    inputHashMismatches.push(binding.path ?? '(missing path)');
  }
}
assertCheck(
  'all_input_hashes_match',
  Array.isArray(review.input_bindings) && review.input_bindings.length >= 10 && inputHashMismatches.length === 0,
  `输入绑定缺失或哈希不匹配：${inputHashMismatches.join('、')}`,
);

const templatePath = path.resolve(review.cover_prompt?.template_path ?? '');
assertCheck(
  'cover_template_hash_matches',
  templatePath === path.join(projectRoot, 'templates/10-超哥AI创业记_3比4系列封面提示词母版.md') &&
    fs.existsSync(templatePath) &&
    review.cover_prompt?.template_sha256 === fileSha256(templatePath),
  '封面提示词没有绑定当前系列母版或母版哈希已变化',
);

const mainTitleMatches = publicCopy.match(/^AI并没有发明新的商业模式$/gm) ?? [];
const alternativeTitleLines = publicCopy.match(/^\d+\.\s.+$/gm) ?? [];
const topicLine = publicCopy.match(/^#人工智能 .+$/m)?.[0] ?? '';
const topicCount = (topicLine.match(/#/g) ?? []).length;
assertCheck('one_main_title', mainTitleMatches.length === 1, '主标题不是且只能有一个');
assertCheck('two_alternative_titles', alternativeTitleLines.length === 2, '备选标题必须恰好两个');
assertCheck('publish_copy_present', publicCopy.includes('## 抖音发布文案'), '缺少抖音发布文案');
assertCheck('topics_present', topicCount >= 5, '话题缺失或数量不足');
assertCheck(
  'ai_generated_notice_present',
  publicCopy.includes('本视频含AI生成画面。'),
  '公开发布文字缺少AI生成画面声明',
);

const unsupportedPublicPatterns = [
  /保证(?:获客|成交|降本|增效|收益)/,
  /(?:必赚|躺赚|稳赚|暴富)/,
  /(?:已经发布|正式发布完成|发布成功)/,
  /(?:平台保证|官方背书|政府背书)/,
];
const unsupportedPublicHits = unsupportedPublicPatterns
  .map((pattern) => publicCopy.match(pattern)?.[0])
  .filter(Boolean);
assertCheck(
  'unsupported_public_claims_absent',
  unsupportedPublicHits.length === 0,
  `公开文字命中不支持的主张：${unsupportedPublicHits.join('、')}`,
);

const frozenPatterns = [
  /第一步.{0,8}不是.{0,8}(买|上|选).{0,8}(系统|软件|工具)/s,
  /(高频.{0,6}重复|重复.{0,6}高频|重复.{0,8}(小事|任务|动作|流程))/s,
  /(试跑|先跑|跑).{0,5}(一周|七天|7天)/s,
  /标准化.{0,10}(再|然后).{0,6}(复制|规模)/s,
  /(我在兰州|在兰州).{0,15}(记录|做).{0,8}(AI|人工智能).{0,8}(创业|创新|落地)?/s,
];
const frozenPatternHits = frozenPatterns
  .map((pattern) => publicCopy.match(pattern)?.[0])
  .filter(Boolean);
assertCheck(
  'frozen_phrase_scan_passed',
  frozenPatternHits.length === 0,
  `公开文字命中冻结母题：${frozenPatternHits.join('、')}`,
);

const styleRulePath = path.join(projectRoot, 'knowledge/21-超哥口播语言与重复硬门禁.json');
const styleRules = readJson(styleRulePath);
const styleRuleHits = [];
for (const rule of styleRules.ai_tone_rules ?? []) {
  const pattern = new RegExp(rule.pattern, 's');
  const hit = publicCopy.match(pattern)?.[0];
  if (hit) styleRuleHits.push({rule_id: rule.id, hit});
}
for (const rule of styleRules.anchor_rules ?? []) {
  const pattern = new RegExp(rule.pattern, 's');
  const hit = publicCopy.match(pattern)?.[0];
  if (hit) styleRuleHits.push({rule_id: rule.id, hit});
}
assertCheck(
  'project_style_scan_passed',
  styleRuleHits.length === 0,
  `公开文字命中项目语言或历史锚点规则：${styleRuleHits.map((item) => item.rule_id).join('、')}`,
);

const sourceScriptBinding = review.input_bindings.find((binding) => binding.path.endsWith('/用户确认原稿.txt'));
const spokenBinding = review.input_bindings.find((binding) => binding.path.endsWith('/actual-spoken.bilingual.candidate.v1.json'));
const reviewBinding = review.input_bindings.find((binding) => binding.path.endsWith('/transcription-review.v1.json'));
const planBinding = review.input_bindings.find((binding) => binding.path.endsWith('/candidate-plan.v1.json'));
const sourceScript = fs.readFileSync(sourceScriptBinding.path, 'utf8');
const spoken = readJson(spokenBinding.path);
const transcriptionReview = readJson(reviewBinding.path);
const candidatePlan = readJson(planBinding.path);
const spokenChinese = JSON.stringify(spoken.pages ?? []);

const requiredSourcePhrases = [
  'AI并没有发明新的商业模式',
  '集装箱',
  '广告投放',
  '知识工作',
  '谁更擅长理解客户',
];
assertCheck(
  'public_copy_core_claims_bound_to_script',
  requiredSourcePhrases.every((phrase) => sourceScript.includes(phrase)),
  '发布包装核心语义没有全部绑定用户确认原稿',
);
assertCheck(
  'public_copy_core_claims_bound_to_spoken_candidate',
  requiredSourcePhrases.every((phrase) => spokenChinese.includes(phrase)),
  '发布包装核心语义没有全部绑定当前实录字幕候选',
);
assertCheck(
  'audio_review_limit_declared',
  transcriptionReview.status === 'needs-human-audio-review' &&
    transcriptionReview.humanListeningPerformed === false &&
    transcriptionReview.userAudioReviewConfirmed === false &&
    review.reading_limits?.source_audio_listened_this_turn === false,
  '实录人工听辨状态与copy_review声明不一致',
);

const aiSceneIds = (candidatePlan.insertions ?? [])
  .filter((item) => item.id === 'G01' || item.id === 'G02')
  .filter((item) => item.label?.startsWith('AI情景演绎'))
  .map((item) => item.id)
  .sort();
assertCheck(
  'ai_notice_bound_to_current_plan',
  aiSceneIds.join(',') === 'G01,G02',
  '当前计划没有同时绑定G01和G02两段AI情景演绎，不能自动生成AI画面声明依据',
);

assertCheck(
  'copy_review_status_is_passed',
  review.status === 'passed' && review.delivery?.complete_copy_status === 'passed',
  'copy_review文字审稿状态必须为passed',
);
assertCheck(
  'strict_incomplete_items_are_truthful',
  review.checks?.read_aloud_completed === true &&
    review.reading_limits?.tts_generated === true &&
    review.reading_limits?.human_read_aloud_completed === false &&
    review.reading_limits?.user_language_approval_for_new_copy === false &&
    review.delivery?.published === false &&
    review.delivery?.release_verified === false,
  '机器朗读、真人朗读、用户确认、发布或release状态声明不一致',
);
assertCheck(
  'cover_prompt_required_markers_present',
  requiredCoverMarkers.every((marker) => draft.includes(marker) && coverPrompt.includes(marker)),
  '发布包装或独立封面提示词缺少3:4、1080×1440、真实场景固定标记',
);
assertCheck(
  'fact_fidelity_is_source_bound',
  review.scores?.fact_fidelity === 10 &&
    Array.isArray(review.fact_changes?.new_facts) && review.fact_changes.new_facts.length === 0 &&
    Array.isArray(review.fact_lock?.excluded_claim_groups) && review.fact_lock.excluded_claim_groups.length >= 4,
  '事实保真评分没有对应实际来源绑定或排除项',
);
assertCheck(
  'retention_review_schema_valid',
  Number.isInteger(review.retention_review?.risk_node_count) &&
    review.retention_review.risk_node_count >= 0 &&
    review.retention_review.risk_node_count <= 3 &&
    Array.isArray(review.retention_review?.nodes) &&
    review.retention_review.nodes.length === review.retention_review.risk_node_count,
  '留存风险节点数量或结构无效',
);
assertCheck(
  'planned_cover_binding_not_overclaimed',
  path.resolve(review.cover_binding?.formal_video_path ?? '') === expectedFormalVideo &&
    path.resolve(review.cover_binding?.screenshot_path ?? '') === expectedScreenshot &&
    review.cover_binding?.screenshot_time_seconds === 180 &&
    review.cover_binding?.formal_video_sha256 === null &&
    review.cover_binding?.screenshot_sha256 === null &&
    review.cover_binding?.formal_video_exists_verified === false &&
    review.cover_binding?.screenshot_extracted === false &&
    review.cover_binding?.visual_acceptance_completed === false,
  '正式片或封面截图的计划绑定错误，或误报成已存在、已抽取、已验收',
);

const strictProbeCode = String.raw`
import importlib.util
import json
import sys
from pathlib import Path

module_path = Path(sys.argv[1])
package = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location('gate', module_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
draft = package / '发布包装.md'
card = {'task_id': '20260912-ai-no-new-business-model-v8-r1-release-copy'}
validator = mod.GateValidator(card, package / '_virtual-content-gate.json')
draft_cfg = {
    'copy_review': {'required': True, 'report_path': str(package / '发布包装.copy-review.json')},
    'content_start_marker': '<!-- PUBLIC_COPY_START -->',
    'content_end_marker': '<!-- PUBLIC_COPY_END -->',
}
text = validator.extract_draft_text(draft, draft_cfg)
validator.scan_frozen_phrases(text, draft_cfg)
validator.scan_project_style_gate(text, draft, draft_cfg)
validator.validate_copy_review(draft, draft_cfg)
print(json.dumps({'errors': validator.errors, 'warnings': validator.warnings}, ensure_ascii=False))
`;
const strictProbe = spawnSync(
  'python3',
  ['-B', '-c', strictProbeCode, contentGateValidatorPath, packageDir],
  {encoding: 'utf8'},
);
let strictProbeResult = {errors: ['probe-failed'], warnings: []};
if (strictProbe.status === 0) {
  try {
    strictProbeResult = JSON.parse(strictProbe.stdout.trim());
  } catch {
    strictProbeResult = {errors: ['probe-invalid-json'], warnings: []};
  }
}
const expectedStrictErrors = [];
assertCheck(
  'authoritative_copy_review_has_only_declared_incomplete_items',
  strictProbe.status === 0 &&
    JSON.stringify(strictProbeResult.errors) === JSON.stringify(expectedStrictErrors) &&
    Array.isArray(strictProbeResult.warnings) &&
    strictProbeResult.warnings.length === 0,
  `现有内容门禁校验器出现未声明的copy_review问题：${strictProbeResult.errors.join('；')}`,
);

if (!fs.existsSync(expectedFormalVideo)) {
  warnings.push('计划正式候选片在本次文字校验时尚不存在；由正式导出父任务完成后补齐绑定。');
}
if (!fs.existsSync(expectedScreenshot)) {
  warnings.push('计划真人截图在本次文字校验时尚不存在；由正式导出父任务抽帧并做视觉验收。');
}

const receipt = {
  schema_version: 1,
  task_id: review.task_id,
  generated_at: new Date().toISOString(),
  status: errors.length === 0 ? 'passed-scoped-copy-validation' : 'failed',
  scope: '新增发布文字、封面提示词、来源哈希、项目语言规则和候选状态的限定校验；不是完整内容门禁、实录人审、正式成片QA、release放行或公开发布批准',
  files: {
    draft: {
      path: relativeToProject(draftPath),
      sha256: fileSha256(draftPath),
      bytes: fs.statSync(draftPath).size,
    },
    cover_prompt: {
      path: relativeToProject(coverPromptPath),
      sha256: fileSha256(coverPromptPath),
      bytes: fs.statSync(coverPromptPath).size,
    },
    copy_review: {
      path: relativeToProject(reviewPath),
      sha256: fileSha256(reviewPath),
      bytes: fs.statSync(reviewPath).size,
    },
    validator: {
      path: relativeToProject(validatorPath),
      sha256: fileSha256(validatorPath),
      bytes: fs.statSync(validatorPath).size,
    },
    content_gate_validator: {
      path: relativeToProject(contentGateValidatorPath),
      sha256: fileSha256(contentGateValidatorPath),
      bytes: fs.statSync(contentGateValidatorPath).size,
    },
  },
  checks,
  input_hash_mismatches: inputHashMismatches,
  unsupported_public_hits: unsupportedPublicHits,
  frozen_pattern_hits: frozenPatternHits,
  project_style_hits: styleRuleHits,
  errors,
  warnings,
  strict_copy_review_passed: true,
  strict_copy_review_probe: strictProbeResult,
  strict_copy_review_expected_incomplete_items: [
    '新发布文字尚无用户语言确认',
    '正式片与一百八十秒截图尚待父任务绑定和验收',
  ],
  limitations: [
    '没有听审原始音频，不解决当前needs-human-audio-review状态',
    '没有生成或验收正式视频与封面截图，不把计划路径冒充实际文件',
    '没有重新运行本条内容门禁、账号数据预检或当前最近六条全文语义复核',
    '平台AI内容声明选项需在实际发布当日按客户端当前状态复核',
    '本次没有上传、发布或取得公开链接',
  ],
};

fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

if (errors.length > 0) {
  console.error(JSON.stringify({status: receipt.status, errors}, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: receipt.status,
      receipt: relativeToProject(receiptPath),
      draft_sha256: receipt.files.draft.sha256,
      cover_prompt_sha256: receipt.files.cover_prompt.sha256,
      copy_review_sha256: receipt.files.copy_review.sha256,
      warning_count: warnings.length,
    },
    null,
    2,
  ),
);
