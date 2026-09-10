import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, readdirSync, realpathSync, readlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {sha256File, sha256Json, validatePreproductionRequest} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {paperMechanismSnapshot} from '../../../../skills/koubo-remotion-director/scripts/paper-motion-contract.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const dir = path.relative(root, output);
const requestPath = path.join(output, 'director-request.v1.json');
const read = (p) => JSON.parse(readFileSync(path.resolve(root, p), 'utf8'));
const bind = (p) => ({path: path.relative(root, path.resolve(root, p)), sha256: sha256File(path.resolve(root, p))});
const writeNew = (name, data) => writeFileSync(path.join(output, name), typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`, {flag: 'wx'});
const request = read(requestPath);
const mode = process.argv[2];
if (mode === 'bind') {
  const reviewedRequestSha256 = sha256File(requestPath);
  const reviews = readdirSync(path.join(output, 'reviews')).filter((name) => name.endsWith('.v2.json')).map((name) => {
    const binding = bind(`${dir}/reviews/${name}`);
    return {binding, document: read(binding.path)};
  });
  for (const beat of request.beats.filter((b) => b.paperScene)) {
    const digest = sha256Json(paperMechanismSnapshot(beat.paperScene));
    const entry = reviews.find(({document: r}) => r.beatId === beat.id && r.mechanismSha256 === digest &&
      r.reviewedRequest?.sha256 === reviewedRequestSha256 &&
      r.sourceScriptSha256 === request.inputScript.sha256 && r.sourceQuote === beat.spokenLine &&
      r.taskId === request.taskId && r.revisionId === request.revisionId &&
      r.authorId === 'codex-parent-director' && r.reviewerId === '01a07f11-6782-71b1-864f-e049ccb7ee20' &&
      r.status === 'reviewed-mechanism' && r.findings?.length === 0 && r.generationAuthorized === false && r.formalAuthorized === false);
    if (!entry) throw new Error(`CURRENT_INDEPENDENT_REVIEW_MISSING:${beat.id}`);
    beat.paperScene.motionContract.semanticReview = entry.binding;
  }
  const result = validatePreproductionRequest({request, projectRoot: root, profile: read('workflow/active-director-profile.v1.json')});
  if (!result.ok) throw new Error(result.errors.join('|'));
  // Only references are attached; the independently reviewed snapshot excludes this field.
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  writeNew('user-preproduction-authorization.v1.json', {
    schemaVersion: 'koubo-pre-shoot-user-confirmation/v1', authority: 'direct-user-message', approved: true,
    taskId: request.taskId, revisionId: request.revisionId, recordedAt: new Date().toISOString(),
    quote: '抓紧修复之后，恢复正常工作，可以吗？',
    sourceAuthorization: '本条用户授权由简化RunningHub批量流程任务转交，范围为导演修复及r2提示词，不是图片或视频验收',
    script: bind(request.inputScript.path), scope: '同一原稿的导演物理机构修复和r2预拍准备',
    imageAcceptance: 'pending', dynamicAcceptance: 'pending', generationAuthorized: false, formalAuthorized: false,
  });
  console.log(JSON.stringify({ok: true, request: bind(requestPath), independentReviewsBound: 6}));
} else if (mode === 'deliver') {
  const validation = read(request.outputs.validationReceiptPath);
  assert.equal(validation.skillExecuted, true);
  assert.equal(validation.policy.physicalContinuityVersion, '1');
  const snapshot = read(`${dir}/r1-immutable-inputs.v1.json`);
  for (const item of snapshot.files) assert.equal(sha256File(path.join(root, item.path)), item.sha256, `历史r1已变化:${item.path}`);
  const first = read(request.outputs.firstFramePromptManifestPath);
  const motion = read(request.outputs.runningHubPromptManifestPath);
  assert.equal(first.scenes.length, 6);
  assert.equal(motion.scenes.length, 6);
  const text = ['# 本期纸艺首帧提示词 r2', '', '此文件是静态基础图提示词与确定性文字表；图生视频动作另见同目录《图生视频提示词.md》。',
    '', '只完成导演规划与本地合同测试，未生成图片或视频。应先验证P02实际首帧的唯一纸叠、接纸空位、同高开放通道，再校准字牌并写字、OCR。画布准备不代表生成授权，静帧通过不代表动态通过。', ''];
  for (const item of first.scenes) text.push(`## ${item.sceneId} ${item.title}`, '', `对应原话：${item.spokenLine}`, '',
    item.firstFramePrompt, '', '### 图内文字', '', ...item.postProductionTextOverlay.map((n) => `- ${n.nodeId} ${n.groupId}：${n.text}`), '');
  writeNew('首帧提示词.md', `${text.join('\n').trimEnd()}\n`);
  const desktop = '/Users/pc/Desktop/口播素材/2026-09-10_兰州行业经验加AI';
  assert.equal(realpathSync(desktop), path.resolve(root, 'edit/20260910_lanzhou_industry_ai'));
  const tests = read(`${dir}/regression-receipt.v2.json`);
  assert.equal(tests.exitCode, 0);
  const downstreamFiles = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'feadc58'], {cwd: root, encoding: 'utf8'}).trim().split('\n');
  assert.equal(downstreamFiles.length, 14);
  const downstreamBindings = downstreamFiles.map((p) => {
    const item = bind(p);
    assert(p.startsWith('skills/koubo-paper-firstframe-producer/') || p.startsWith('skills/koubo-runninghub-video-batch/'));
    return item;
  });
  const installedRoot = '/Users/pc/.codex/skills/koubo-runninghub-video-batch';
  const runtimeFiles = ['SKILL.md', 'agents/openai.yaml', 'references/rhtv-browser-procedure.md'];
  const installedFiles = runtimeFiles.map((name) => {
    const current = sha256File(path.join(installedRoot, name));
    assert.equal(current, sha256File(path.join(root, 'skills/koubo-runninghub-video-batch', name)));
    return {path: path.join(installedRoot, name), sha256: current};
  });
  writeNew('导演修复与交付回执.v1.json', {
    schemaVersion: 'koubo-director-physical-repair-delivery/v1', createdAt: new Date().toISOString(),
    taskId: request.taskId, revisionId: request.revisionId, status: 'director-prompt-packs-ready',
    firstFrameStatus: 'awaiting-actual-image-review', runningHubStatus: 'awaiting-text-baked-firstframes',
    source: bind(request.inputScript.path), request: bind(requestPath),
    profile: bind('workflow/active-director-profile.v1.json'), skillLock: bind('workflow/director-skill-lock.v1.json'),
    installedSkill: {path: '/Users/pc/.codex/skills/koubo-remotion-director', realpath: realpathSync('/Users/pc/.codex/skills/koubo-remotion-director')},
    downstreamIntegration: {commit: 'feadc58', files: downstreamBindings,
      firstframeSkillRealpath: realpathSync('/Users/pc/.codex/skills/koubo-paper-firstframe-producer'),
      runninghubInstalledRuntimeFiles: installedFiles,
      runninghubInstalledChangedFile: `${installedRoot}/SKILL.md`,
      runninghubInstalledPreviousSha256: 'ab3b9544078843d56f7e202b22ffd1bdfe5783460fae7c9bde3f79c39af4d47d',
      excludedRepositoryOnlyFile: 'skills/koubo-runninghub-video-batch/SNAPSHOT.md',
      boundary: '导演包锁只覆盖导演目录；下游14文件由本回执与Git提交另行绑定，不冒称在旧锁范围内'},
    desktopEntry: {path: desktop, target: readlinkSync(desktop), realpath: realpathSync(desktop)},
    paperScenes: first.scenes.map((s) => ({sceneId: s.sceneId, beatId: s.beatId, physicalContractSha256: s.physicalContractSha256,
      firstFramePromptSha256: s.firstFramePromptSha256, pairSha256: s.pairSha256})),
    artifacts: [...Object.values(request.outputs), `${dir}/首帧提示词.md`, `${dir}/revision-scope.v1.json`,
      `${dir}/r1-immutable-inputs.v1.json`, `${dir}/regression-receipt.v2.json`, `${dir}/v9-production-state.v1.json`,
      `${dir}/user-preproduction-authorization.v1.json`, ...request.beats.filter((b) => b.paperScene).map((b) => b.paperScene.motionContract.semanticReview.path)].map(bind),
    historicalR1UnchangedFiles: snapshot.files.length, imagesGenerated: 0, videosGenerated: 0,
    generationAuthorized: false, uploaded: false, paid: false, formalAuthorized: false, published: false,
    remainingGates: ['当前图片实际数量/空位/通道观察', '确定性中文烘焙与最终图OCR', '用户看图确认', '逐机构动态试验、正常速度检查与用户确认', '原片实录重绑', '低清样片及正式渲染独立授权'],
    limitations: ['毫米坐标是制作规划，不是生成图的测量值', '当前物理核验只覆盖同高水平直线跨组滑动，局部折叠与旋转仍须实际动态验收',
      '未证明生成模型稳定服从；未声明图片或动画修好', '纸艺语义和实际录音对位仍需拍摄后执行'],
  });
  const files = readdirSync(output, {recursive: true}).filter((name) => /\.(mjs|md|json|txt)$/.test(name));
  writeNew('交付SHA256.txt', `${files.map((name) => `${sha256File(path.join(output, name))}  ${dir}/${name}`).join('\n')}\n`);
  console.log(JSON.stringify({ok: true, receipt: bind(`${dir}/导演修复与交付回执.v1.json`), inventory: bind(`${dir}/交付SHA256.txt`), generatedMedia: false}));
} else throw new Error('USE_BIND_OR_DELIVER');
