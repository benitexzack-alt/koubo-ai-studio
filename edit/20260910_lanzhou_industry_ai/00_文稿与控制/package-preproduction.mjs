import {readFileSync, writeFileSync, readdirSync, realpathSync, readlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sha256File, sha256Json, validatePreproductionRequest} from '../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {paperMechanismSnapshot} from '../../../skills/koubo-remotion-director/scripts/paper-motion-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const episode = 'edit/20260910_lanzhou_industry_ai';
const dir = `${episode}/03_导演拆解/paper-v9.1-r1`;
const requestPath = `${dir}/director-request.v2.json`;
const read = (p) => JSON.parse(readFileSync(path.resolve(root, p), 'utf8'));
const bind = (p) => ({path: p, sha256: sha256File(path.resolve(root, p))});
const writeNew = (p, body) => writeFileSync(path.resolve(root, p), typeof body === 'string' ? body : `${JSON.stringify(body, null, 2)}\n`, {flag: 'wx'});
const request = read(requestPath);
const profile = read('workflow/active-director-profile.v1.json');
const mode = process.argv[2];

if (mode === 'bind') {
  const reviews = readdirSync(path.join(root, dir, 'reviews')).filter((f) => f.endsWith('.json')).map((f) => {
    const p = `${dir}/reviews/${f}`;
    return {binding: bind(p), doc: read(p)};
  });
  for (const beat of request.beats.filter((b) => b.paperScene)) {
    const digest = sha256Json(paperMechanismSnapshot(beat.paperScene));
    const review = reviews.find(({doc}) => doc.beatId === beat.id && doc.mechanismSha256 === digest &&
      doc.sourceScriptSha256 === request.inputScript.sha256 && doc.sourceQuote === beat.spokenLine &&
      doc.reviewerId === '01a07f11-6782-71b1-864f-e049ccb7ee20' &&
      doc.authorId === 'codex-parent-director' && doc.status === 'reviewed-mechanism' &&
      doc.generationAuthorized === false && doc.formalAuthorized === false);
    if (!review) throw new Error(`CURRENT_INDEPENDENT_REVIEW_MISSING:${beat.id}`);
    beat.paperScene.motionContract.semanticReview = review.binding;
  }
  const check = validatePreproductionRequest({request, projectRoot: root, profile});
  if (!check.ok) throw new Error(check.errors.join('|'));
  // Mechanical binding only; reviewed scene snapshots do not include this reference.
  writeFileSync(path.resolve(root, requestPath), `${JSON.stringify(request, null, 2)}\n`);
  writeNew(`${episode}/00_文稿与控制/用户预拍授权回执.v1.json`, {
    schemaVersion: 'koubo-pre-shoot-user-confirmation/v1', authority: 'direct-user-message', status: 'approved',
    taskId: request.taskId, revisionId: request.revisionId, approved: true,
    recordedAt: new Date().toISOString(), timestampMeaning: '本地记录授权的时间，不冒称消息原始时间',
    quote: '启动导演Skill，进行新的口播文稿的拆解，然后我这会去拍原视频。',
    script: bind(request.inputScript.path), scope: '仅用户本轮原文的预拍导演规划、素材目录和提示词整理',
    generationAuthorized: false, formalAuthorized: false, publicationAuthorized: false,
    oldScriptReviewsInherited: false,
  });
  console.log(JSON.stringify({ok: true, request: bind(requestPath), reviewsBound: 6}));
} else if (mode === 'deliver') {
  const validation = read(request.outputs.validationReceiptPath);
  if (validation.skillExecuted !== true) throw new Error('DIRECTOR_VALIDATION_REQUIRED');
  const first = read(request.outputs.firstFramePromptManifestPath);
  const motion = read(request.outputs.runningHubPromptManifestPath);
  const ai = read(request.outputs.aiGeneratedVideoPromptManifestPath);
  if (first.scenes.length !== 6 || motion.scenes.length !== 6 || ai.items.length !== 0) throw new Error('EXPECTED_SCENE_SET_CHANGED');
  const lines = ['# 本期纸艺首帧提示词', '', '这是首帧项目组的静态输入，不包含图生视频指令。先生成无字基础场景，再按同编号文字表确定性写入图内；交付必须是通过最终图OCR的带字首帧，不能把空白基础图直接送去生成视频。', '', '当前仅导演提示词交付，没有生图、付费或批量视频授权。坐标是布局预留范围，需依据实际图校准纸牌四角，不能盲套估计值。', ''];
  for (const item of first.scenes) {
    const scene = request.beats.find((b) => b.id === item.beatId).paperScene;
    lines.push(`## ${item.sceneId}｜${item.title}`, '', `对应原话：${item.spokenLine}`, '', '### 静态基础图提示词', '', item.firstFramePrompt, '', '### 图内文字写入表', '', '| 节点 | 固定纸牌 | 精确文字 |', '|---|---|---|', ...scene.textPlan.map((n) => `| ${n.nodeId} | ${n.groupId} / ${n.surfaceId} | ${n.text} |`), '', '标签从第0帧可读，全部固定在独立支架。动态图只动无字部件。', '');
  }
  writeNew(`${dir}/首帧提示词.md`, `${lines.join('\n').trimEnd()}\n`);
  const execution = ['# 本期图生视频执行版', '', '本执行版逐字提取当前机器清单中的动作提示词，不采用旧导出页顶部关于带字纸片可活动的通用说明。本期所有中文字牌必须固定，只有指定无字部件运动。', '', '当前等待带字首帧、OCR与动态试验授权；未生成视频、未提交、未付费。只使用最终ready pack中同一P编号的已验收带字图。', ''];
  for (const item of motion.scenes) execution.push(`## ${item.sceneId}｜${item.title}`, '', `建议时长：${item.durationSeconds}秒。`, '', '```text', item.imageToVideoPrompt, '```', '');
  writeNew(`${dir}/图生视频执行版.md`, `${execution.join('\n').trimEnd()}\n`);
  const desktop = '/Users/pc/Desktop/口播素材/2026-09-10_兰州行业经验加AI';
  if (realpathSync(desktop) !== path.resolve(root, episode)) throw new Error('DESKTOP_ENTRY_MISMATCH');
  const tests = ['skills/koubo-remotion-director/tests/test-preproduction-director-contract.mjs', 'skills/koubo-remotion-director/tests/test-paper-motion-contract.mjs'];
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...tests], {cwd: root, encoding: 'utf8', timeout: 240000});
  writeNew(`${dir}/local-regression.v1.json`, {recordedAt: new Date().toISOString(), command: [process.execPath, '--test', '--test-reporter=spec', ...tests], exitCode: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message ?? null, bindings: tests.map(bind), scope: '本地合同回归，不等于真实图片或动态验收'});
  if (result.status !== 0) throw new Error('LOCAL_REGRESSION_FAILED');
  writeNew(`${dir}/导演交付回执.v1.json`, {
    schemaVersion: 'koubo-episode-preproduction-delivery/v1', createdAt: new Date().toISOString(),
    taskId: request.taskId, revisionId: request.revisionId, status: 'director-prompt-packs-ready',
    source: bind(request.inputScript.path), request: bind(requestPath),
    profile: bind('workflow/active-director-profile.v1.json'), sourceParagraphCount: request.beats.length,
    paperSceneCount: first.scenes.length, plannedPaperSeconds: request.beats.reduce((sum, b) => sum + (b.paperScene?.durationSeconds ?? 0), 0),
    aiGeneratedVideoCount: ai.items.length, imagesGenerated: 0, videosGenerated: 0,
    desktopEntry: {path: desktop, readlink: readlinkSync(desktop), realpath: realpathSync(desktop)},
    artifacts: [...Object.values(request.outputs), `${dir}/首帧提示词.md`, `${dir}/v9-production-state.v1.json`, `${dir}/local-regression.v1.json`, `${episode}/00_文稿与控制/用户预拍授权回执.v1.json`].map(bind),
    semanticReviews: request.beats.filter((b) => b.paperScene).map((b) => ({beatId: b.id, ...b.paperScene.motionContract.semanticReview})),
    paperUsage: first.scenes.map((item) => ({sceneId: item.sceneId, beatId: item.beatId, title: item.title, sourceQuote: item.spokenLine, durationSeconds: request.beats.find((b) => b.id === item.beatId).paperScene.durationSeconds, timeline: 'pending-recorded-audio'})),
    historicalDraft: {path: `${dir}/director-request.v1.json`, disposition: '未编译草案，仅保留复核证据，不可投递'},
    productionEligible: false, formal: false, generationAuthorized: false, uploaded: false, paid: false, published: false,
    remainingGates: ['原片实际录音重绑', '首帧生成授权与实际布局验收', '最终带字图OCR', '不同机构先做动态试验与正常速度人工验收', '真实素材盘点后Shotcraft匹配', '低清有声样片用户确认', '正式渲染及完整发布包单独验收'],
    knownRisks: ['最后一次创业风口无可验证依据；原话保留，不增加收益图表或官方背书', '降维打击为用户判断，不是已验证效果', '三组标签及四组标签必须以最终图可读性验收；布局合同不能证明模型服从', '文字从首帧可读，剪入时必须重核对实录语义，不得提前宣布结论', '旧9月8日文案审稿不可继承给本次修改后的原稿'],
  });
  const files = readdirSync(path.join(root, dir)).filter((f) => /\.(json|md)$/.test(f)).map((f) => `${dir}/${f}`);
  writeNew(`${dir}/交付SHA256.txt`, `${files.map((p) => `${sha256File(path.join(root, p))}  ${p}`).join('\n')}\n`);
  console.log(JSON.stringify({ok: true, delivery: bind(`${dir}/导演交付回执.v1.json`), inventory: bind(`${dir}/交付SHA256.txt`), formal: false}));
} else throw new Error('USE_BIND_OR_DELIVER');
