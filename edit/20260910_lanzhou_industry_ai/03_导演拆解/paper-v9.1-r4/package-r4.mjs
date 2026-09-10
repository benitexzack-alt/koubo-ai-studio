import assert from 'node:assert/strict';
import {readFileSync, readdirSync, writeFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File, sha256Json, validatePreproductionRequest} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {paperMechanismSnapshot} from '../../../../skills/koubo-remotion-director/scripts/paper-motion-contract.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const dir = path.relative(root, output);
const oldDir = path.relative(root, path.resolve(output, '../paper-v9.1-r3'));
const read = (p) => JSON.parse(readFileSync(path.resolve(root, p), 'utf8'));
const bind = (p) => ({path: path.relative(root, path.resolve(root, p)), sha256: sha256File(path.resolve(root, p))});
const writeNew = (name, data) => writeFileSync(path.join(output, name), typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`, {flag: 'wx'});
const mode = process.argv[2];
if (mode === 'bind') {
  const raw = bind(`${dir}/director-request.unbound.v1.json`);
  const request = read(raw.path);
  const entries = readdirSync(path.join(output, 'reviews')).filter((f) => f.endsWith('.v1.json')).map((f) => {
    const binding = bind(`${dir}/reviews/${f}`);
    return {binding, review: read(binding.path)};
  });
  for (const beat of request.beats.filter((b) => b.paperScene)) {
    const entry = entries.find(({review: r}) => r.beatId === beat.id &&
      r.mechanismSha256 === sha256Json(paperMechanismSnapshot(beat.paperScene)) &&
      r.reviewedRequest?.sha256 === raw.sha256 && r.reviewedRequest?.path === raw.path &&
      r.sourceScriptSha256 === request.inputScript.sha256 && r.sourceQuote === beat.spokenLine &&
      r.taskId === request.taskId && r.revisionId === request.revisionId &&
      r.authorId === 'codex-parent-director' && r.reviewerId === '01a07f11-6782-71b1-864f-e049ccb7ee20' &&
      r.status === 'reviewed-mechanism' && r.findings?.length === 0 && r.generationAuthorized === false && r.formalAuthorized === false);
    assert(entry, `CURRENT_INDEPENDENT_REVIEW_MISSING:${beat.id}`);
    beat.paperScene.motionContract.semanticReview = entry.binding;
  }
  const result = validatePreproductionRequest({request, projectRoot: root, profile: read('workflow/active-director-profile.v1.json')});
  assert(result.ok, result.errors.join('|'));
  writeNew('director-request.v1.json', request);
  const now = new Date().toISOString();
  writeNew('user-preproduction-authorization.v1.json', {schemaVersion: 'koubo-pre-shoot-user-confirmation/v1',
    authority: 'user-confirmation-relayed-by-supervisor-task', status: 'approved', approved: true,
    taskId: request.taskId, revisionId: request.revisionId, recordedAt: now, approvedAt: now,
    userQuote: '好的，继续', relayThreadId: '01a05ce8-84ee-7112-bbc5-309c3e660c77',
    sourceAuthorization: '下游任务转交的用户A方案确认；保留P02，五镜先只读审计，仅P01/P03受控参考各生成一次。原稿批准沿用本条原始授权，未声称用户审过r4图片。',
    originalAuthorization: bind(`${oldDir}/user-preproduction-authorization.v1.json`),
    scope: '同一原稿P01/P03最小布局与初态修复、新r4导演包及指定下游各一次首帧执行',
    bindings: {script: bind(request.inputScript.path)},
    imageAcceptance: 'pending', dynamicAcceptance: 'pending',
    generationAuthorization: {executorThreadId: '01a05ce8-84ee-7112-bbc5-309c3e660c77', sceneLimits: {P01: 1, P03: 1},
      controlledReferenceRequired: true, retryAllowed: false, regenerateP02: false, generateP04ToP06: false},
    videoGenerationAuthorized: false, uploadAuthorized: false, paymentAuthorized: false, formalAuthorized: false});
  console.log(JSON.stringify({ok: true, request: bind(`${dir}/director-request.v1.json`), independentReviewsBound: 6}));
} else if (mode === 'deliver') {
  const request = read(`${dir}/director-request.v1.json`);
  const validation = read(request.outputs.validationReceiptPath);
  assert.equal(validation.skillExecuted, true);
  assert.deepEqual(validation.policy.projectionRequiredBeatIds, ['B04', 'B07', 'B10']);
  const immutable = read(`${dir}/r3-immutable-signed-inputs.v1.json`);
  [...immutable.files, ...immutable.preservedP02Images].forEach((f) => assert.equal(sha256File(path.join(root, f.path)), f.sha256, f.path));
  const tests = read(`${dir}/regression-receipt.v1.json`);
  assert.equal(tests.exitCode, 0);
  const first = read(request.outputs.firstFramePromptManifestPath);
  const motion = read(request.outputs.runningHubPromptManifestPath);
  assert.equal(first.scenes.length, 6);
  assert.equal(motion.scenes.length, 6);
  const oldRequest = read(`${oldDir}/director-request.v1.json`);
  const oldP02 = oldRequest.beats.find((b) => b.id === 'B07').paperScene;
  const newP02 = request.beats.find((b) => b.id === 'B07').paperScene;
  assert.deepEqual(paperMechanismSnapshot(newP02), paperMechanismSnapshot(oldP02));
  assert.deepEqual(newP02.prompt, oldP02.prompt);
  const production = `${oldDir}/first-frame-production-r1`;
  const bakeReceipt = bind(`${production}/first-frame-qa/sample-text-bake-receipt.v1.json`);
  const bake = read(bakeReceipt.path);
  const baked = bake.scenes.find((s) => s.sceneId === 'P02');
  assert.equal(bake.status, 'deterministic-first-frame-text-baked-and-ocr-passed');
  assert.equal(baked.sourceImage.sha256, sha256File(baked.sourceImage.path));
  assert.equal(baked.outputImage.sha256, sha256File(baked.outputImage.path));
  assert.equal(baked.ocr.length, 4);
  for (const row of baked.ocr) {
    assert.equal(row.matched, true);
    assert.equal(row.expected, newP02.textPlan.find((n) => n.nodeId === row.nodeId).text);
    assert.equal(row.inputImageSha256, baked.outputImage.sha256);
    assert.equal(row.evaluationStage, 'final-composite');
  }
  writeNew('P02-保留原始来源回执.v1.json', {schemaVersion: 'koubo-preserved-scene-provenance/v1',
    createdAt: new Date().toISOString(), sceneId: 'P02', beatId: 'B07', targetRevisionId: request.revisionId,
    disposition: 'preserve-existing-r3-assets-and-provenance', newGeneration: false,
    sourceRequest: bind(`${oldDir}/director-request.v1.json`), targetRequest: bind(`${dir}/director-request.v1.json`),
    sourceManifest: bind(oldRequest.outputs.firstFramePromptManifestPath), targetManifest: bind(request.outputs.firstFramePromptManifestPath),
    unchangedMechanismSha256: sha256Json(paperMechanismSnapshot(newP02)),
    unchangedPromptSha256: sha256Json(newP02.prompt), unchangedTextPlanSha256: sha256Json(newP02.textPlan),
    sourceImage: bind(baked.sourceImage.path), bakedImage: bind(baked.outputImage.path),
    sourceRawReview: bind(`${production}/first-frame-qa/P02.visual-review.v1.json`),
    sourceTextReview: bind(`${production}/first-frame-qa/P02.text-baked-visual-review.v1.json`),
    sourceGenerationReceipt: bind(`${production}/first-frame-qa/P02.generation-receipt.v1.json`),
    sourceBakeReceipt: bakeReceipt, sourceAnchorCalibration: bind(baked.anchorCalibration.path),
    historicalOcrNodesMatched: 4, historicalBakePairSha256: baked.pairSha256,
    targetPairSha256: first.scenes.find((s) => s.sceneId === 'P02').pairSha256,
    policy: '不改写旧pairSha/计划哈希或验收时间，不冒充r4重新生成。原文件就地保留；新执行manifest如需引用，必须显式连同本来源回执核对，禁止只改旧manifest的revision或哈希。',
    dynamicAcceptanceInherited: false, actualGeometryCalibrated: false, formalAuthorized: false});
  const lines = ['# 本期纸艺首帧提示词 r4', '',
    '首帧与图生视频提示词分开投递。本轮只执行P01/P03：每镜先制作受控布局参考，再各生成一次；P02保留原图与烘焙图；P04-P06只读、不生成。', '',
    '原稿、标签文字、毫米物理合同、动作类型/顺序/时长不变。两镜底台内缩，接收垫与路线齐平；P03折页初态已平放。基础图无字，中文字确定性写入首帧，最终合成图OCR通过后才交付带字首帧。', ''];
  for (const s of first.scenes) lines.push(`## ${s.sceneId} ${s.title}`, '',
    `本轮：${['P01', 'P03'].includes(s.sceneId) ? '受控参考后生成一次，失败停下' : s.sceneId === 'P02' ? '保留，不重新生成' : '只读，不生成'}`, '',
    `对应原话：${s.spokenLine}`, '', s.firstFramePrompt, '', '### 图内文字', '',
    ...s.postProductionTextOverlay.map((n) => `- ${n.nodeId} ${n.groupId}：${n.text}`), '');
  writeNew('首帧提示词.md', `${lines.join('\n').trimEnd()}\n`);
  writeNew('投递说明.md', `# r4投递与验收边界\n\n本轮范围：P01/P03受控参考各生成一次；P02保留；P04-P06只读、不生成。六镜清单完整不等于授权全批执行。\n\n## 参考与首帧\n\n以本目录签发plan及first-frame清单为输入，物件组与合同必须深比较一致。P01/P03统一使用X=4x、Y=270+3y-2.5z的1920×1080参考投影；实际图按宽高同比映射。动作和支承区必须从当前模块derivePaperProjection推导，不复用r3旧矩形。projection-derivation.v1.json含同源参数、各动作矩形、支承面、对接点和初始活动件。\n\n功能底台完整轮廓（含台面、前沿、侧沿、支脚）内缩至x210..1770、y440..770；各接收面只是连续通道上的平面色块，视觉齐平，无凸沿、凹陷、端门槛或横挡。标签保持原有独立支架和预留区；后景静态物件/支架最低轮廓：P01为443.5、P03为446.5。参考不得多画文字、箭头、PPT框或新机构。\n\nP01两件纸片各自平放，第一条G1到G3、第二条G2到G3；G3两接收面初态均为空。P03唯一折页已平放，第一条G1到G3（x100到400），第二条咨询G3到G2（x400到250），路线平行分离，不能汇入蛇形低盘；产品架始终空着，不将咨询演成订单。\n\n上述坐标属于规划参考，exactPixelMatchRequired=false。真正硬门是实际功能物件处于安全区、不遮字、不占字幕区、机构拓扑和初态正确。不能把纸图上的毫米数值当作实测，也不能只验证导轨却漏掉底台前沿/支脚。\n\n## 保留与停止条件\n\nP02来源见P02-保留原始来源回执.v1.json；原图、烘焙图、校准和OCR回执仍属于r3，不改其时间或pairSha。新包重新审阅仅证明计划不变，不代替旧图片的来源绑定，也不构成动态通过。\n\nP04-P06只读审计结果见reviews，不因本轮不改而声称已生成、投影联验或动态通过。P04展开姿态、P05展开后运输包络、P06双高度入口保留为后续验证项，不在本轮扩改。\n\n两张新图每镜一次，失败不自动重试；先真实看图通过，再校准牌面、确定性写字及最终图OCR。不得上传、配置RunningHub画布、提交视频、付费或正式渲染。图片通过后仍需单镜动态试验及正常速度用户确认。原片回来后按实际口播重绑，再做低清样片。\n`);
  const artifacts = [...Object.values(request.outputs), `${dir}/首帧提示词.md`, `${dir}/投递说明.md`,
    ...['director-request.unbound.v1.json', 'director-request.v1.json', 'projection-derivation.v1.json', 'revision-scope.v1.json',
      'r3-immutable-signed-inputs.v1.json', 'P02-保留原始来源回执.v1.json', 'regression-receipt.v1.json',
      'user-preproduction-authorization.v1.json', 'v9-production-state.v1.json'].map((n) => `${dir}/${n}`),
    ...readdirSync(path.join(output, 'reviews')).map((n) => `${dir}/reviews/${n}`),
    ...['build-r4.mjs', 'package-r4.mjs', 'run-regression.mjs'].map((n) => `${dir}/${n}`)];
  writeNew('导演最小修复交付回执.v1.json', {schemaVersion: 'koubo-director-projection-repair-delivery/v1',
    createdAt: new Date().toISOString(), taskId: request.taskId, revisionId: request.revisionId,
    status: 'director-prompt-packs-ready', firstFrameStatus: 'awaiting-P01-P03-controlled-reference-and-actual-image-review',
    runningHubStatus: 'not-authorized', source: bind(request.inputScript.path),
    request: bind(`${dir}/director-request.v1.json`), skillLock: bind('workflow/director-skill-lock.v1.json'),
    installedDirectorPath: realpathSync('/Users/pc/.codex/skills/koubo-remotion-director'),
    changedSceneIds: ['P01', 'P03'], preservedSceneIds: ['P02'], readonlySceneIds: ['P04', 'P05', 'P06'],
    projectionCheckedSceneIds: ['P01', 'P02', 'P03'], unprojectedSceneIds: ['P04', 'P05', 'P06'],
    artifacts: [...new Set(artifacts)].map(bind), historicalR3UnchangedFiles: immutable.files.length,
    preservedP02Images: immutable.preservedP02Images,
    remainingGates: ['P01/P03受控参考与真实首帧检验', '中文牌校准、确定性烘焙和最终图OCR', '用户看图确认',
      'P04-P06后续另行授权生成与验收', '单镜动态试验与正常速度用户确认', '实录重新对位', '低清样片与正式渲染独立授权'],
    imagesGeneratedByThisTask: 0, videosGeneratedByThisTask: 0,
    downstreamImageAuthorization: {threadId: '01a05ce8-84ee-7112-bbc5-309c3e660c77', limits: {P01: 1, P03: 1},
      automaticRetry: false, preserveP02: true, generateP04ToP06: false},
    sharedSkillFilesChanged: [], uploaded: false, paid: false, formalAuthorized: false, published: false});
  const files = [...new Set([...artifacts, `${dir}/导演最小修复交付回执.v1.json`])].sort();
  writeNew('交付SHA256.txt', `${files.map((p) => `${sha256File(path.join(root, p))}  ${p}`).join('\n')}\n`);
  console.log(JSON.stringify({ok: true, receipt: bind(`${dir}/导演最小修复交付回执.v1.json`), inventory: bind(`${dir}/交付SHA256.txt`)}));
} else throw new Error('USE_BIND_OR_DELIVER');
