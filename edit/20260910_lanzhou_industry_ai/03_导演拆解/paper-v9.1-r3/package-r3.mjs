import assert from 'node:assert/strict';
import {readFileSync, readdirSync, writeFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File, sha256Json, validatePreproductionRequest} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {paperMechanismSnapshot} from '../../../../skills/koubo-remotion-director/scripts/paper-motion-contract.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const dir = path.relative(root, output);
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
  writeNew('user-preproduction-authorization.v1.json', {schemaVersion: 'koubo-pre-shoot-user-confirmation/v1',
    authority: 'direct-user-message', approved: true, taskId: request.taskId, revisionId: request.revisionId,
    recordedAt: new Date().toISOString(), quote: '抓紧修复之后，恢复正常工作，可以吗？',
    sourceAuthorization: '既有用户修复授权及B布局参考方法确认，由简化RunningHub批量流程任务转交；本次只闭合同一镜头的坐标一致性，不是新增图片或动画验收',
    scope: '同一原稿P02最小投影修复及新r3导演包', script: bind(request.inputScript.path),
    imageAcceptance: 'pending', dynamicAcceptance: 'pending', generationAuthorized: false, formalAuthorized: false});
  console.log(JSON.stringify({ok: true, request: bind(`${dir}/director-request.v1.json`), independentReviewsBound: 6}));
} else if (mode === 'deliver') {
  const request = read(`${dir}/director-request.v1.json`);
  const validation = read(request.outputs.validationReceiptPath);
  assert.equal(validation.skillExecuted, true);
  assert.deepEqual(validation.policy.projectionRequiredBeatIds, ['B07']);
  const immutable = read(`${dir}/r2-immutable-signed-inputs.v1.json`);
  immutable.files.forEach((f) => assert.equal(sha256File(path.join(root, f.path)), f.sha256, f.path));
  const tests = read(`${dir}/regression-receipt.v1.json`);
  assert.equal(tests.exitCode, 0);
  const first = read(request.outputs.firstFramePromptManifestPath);
  const motion = read(request.outputs.runningHubPromptManifestPath);
  assert.equal(first.scenes.length, 6);
  assert.equal(motion.scenes.length, 6);
  const lines = ['# 本期纸艺首帧提示词 r3', '',
    '首帧与图生视频提示词分开投递。六镜原稿、字牌、物件、动作顺序与时长保持不变；仅P02采用新的同源投影范围。', '',
    '先根据新合同制作P02布局参考，再验实际首帧；旧r2失败图片及执行参考仅作历史证据，不得混作当前合格首帧。基础图无字，字牌校准后确定性写入，最终图OCR通过才是带字首帧。', ''];
  for (const s of first.scenes) lines.push(`## ${s.sceneId} ${s.title}`, '', `对应原话：${s.spokenLine}`, '', s.firstFramePrompt, '',
    '### 图内文字', '', ...s.postProductionTextOverlay.map((n) => `- ${n.nodeId} ${n.groupId}：${n.text}`), '');
  writeNew('首帧提示词.md', `${lines.join('\n').trimEnd()}\n`);
  writeNew('投递说明.md', '# r3投递与验收边界\n\n先核对本目录清单哈希，再用P02的新projectionContract及完整包络重建布局参考。不得复用旧r2的sweptRect、图像合格声明或烘焙回执。先验证P02唯一纸叠、其他接纸位为空、开放同高承托、标签和字幕区、人物轮廓与完整旋转区间隔。只有实际首帧通过后再进行确定性文字烘焙和最终图OCR。\n\n其他五镜内容保持不变，但不能声称已通过P02新增的坐标联验。新机构仍需单镜动态试验、正常速度查看及用户确认，之后才能批量生成。此包只交付导演计划，不授权本任务生图、上传、RunningHub提交、付费、正式渲染或发布。\n');
  const artifacts = [...Object.values(request.outputs), `${dir}/首帧提示词.md`, `${dir}/投递说明.md`,
    ...['director-request.unbound.v1.json', 'director-request.v1.json', 'projection-derivation.v1.json', 'revision-scope.v1.json',
      'r2-immutable-signed-inputs.v1.json', 'regression-receipt.v1.json', 'user-preproduction-authorization.v1.json',
      'v9-production-state.v1.json'].map((n) => `${dir}/${n}`),
    ...readdirSync(path.join(output, 'reviews')).map((n) => `${dir}/reviews/${n}`),
    ...['build-r3.mjs', 'package-r3.mjs', 'run-regression.mjs'].map((n) => `${dir}/${n}`)];
  writeNew('导演投影修复交付回执.v1.json', {schemaVersion: 'koubo-director-projection-repair-delivery/v1',
    createdAt: new Date().toISOString(), taskId: request.taskId, revisionId: request.revisionId,
    status: 'director-prompt-packs-ready', firstFrameStatus: 'awaiting-actual-image-review',
    runningHubStatus: 'awaiting-text-baked-firstframes', source: bind(request.inputScript.path),
    request: bind(`${dir}/director-request.v1.json`), skillLock: bind('workflow/director-skill-lock.v1.json'),
    installedDirectorPath: realpathSync('/Users/pc/.codex/skills/koubo-remotion-director'),
    projectionCheckedSceneIds: ['P02'], unprojectedSceneIds: ['P01', 'P03', 'P04', 'P05', 'P06'],
    artifacts: [...new Set(artifacts)].map(bind), historicalR2UnchangedFiles: immutable.files.length,
    remainingGates: ['新P02布局参考和真实首帧检验', '实际中文字牌烘焙和最终图OCR', '用户看图确认',
      '单镜动态试验及正常速度用户确认', '实录重新对位', '低清样片与正式渲染独立授权'],
    imagesGenerated: 0, videosGenerated: 0, generationAuthorized: false, uploaded: false, paid: false,
    formalAuthorized: false, published: false});
  // Explicit owned artifacts only: downstream execution folders remain independently versioned.
  const files = [...new Set([...artifacts, `${dir}/导演投影修复交付回执.v1.json`])].sort();
  writeNew('交付SHA256.txt', `${files.map((p) => `${sha256File(path.join(root, p))}  ${p}`).join('\n')}\n`);
  console.log(JSON.stringify({ok: true, receipt: bind(`${dir}/导演投影修复交付回执.v1.json`), inventory: bind(`${dir}/交付SHA256.txt`)}));
} else throw new Error('USE_BIND_OR_DELIVER');
