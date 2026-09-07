import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// 仅在父任务明确报告本条关键帧实际检查完成后执行。本脚本不渲染或提交。
// 用法: node build-application-receipt.v1.mjs --review-confirmation <实查记录.json>
// 实查记录由实际检查信息整理，不得预填通过：
// {schemaVersion:'parent-keyframe-application-review/v1', reporter:'parent-task',
//  keyframeInspectionComplete:boolean, inspectedAt:ISO时间, confirmationText:原始确认信息,
//  output:{path,sha256}, selection:{path,sha256}, componentCopy:{path,sha256},
//  renderEvidence:[{path,sha256}], applications:[{beatId,effectId,frames,finalWorking:boolean,
//  observation:实际观察,evidence:[{path,sha256}]}]}
// 缺少逐效果实查结论的条目保持未通过；不得从代码或渲染成功推导finalWorking。

const dir = import.meta.dirname;
const repo = path.resolve(dir, '../../../..');
const episode = 'edit/20260906_lanzhou_ai_services';
const relativeDir = `${episode}/04_导演拆解/candidate-preview-r1`;
const paths = {
  selection: `${relativeDir}/output-selection.derived.v2.json`,
  manifest: `${relativeDir}/final-consumption.v2.json`,
  output: `${episode}/07_预览与质检/candidate-preview-r1/render/with-sfx-960x540.mp4`,
  component: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',
  componentCopy: 'remotion/src/lanzhou-services-v91-candidate-r1/ShotcraftEffects.generated.tsx',
  composition: 'remotion/src/lanzhou-services-v91-candidate-r1/LanzhouServicesCandidate.tsx',
  visualPlan: 'remotion/src/lanzhou-services-v91-candidate-r1/visual-plan.v1.json',
  validator: 'skills/koubo-shotcraft-library/scripts/validate-application-receipt.mjs',
};
const resolveFile = (p) => {
  const absolute = path.resolve(repo, p);
  const relative = path.relative(repo, absolute);
  assert(relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), '文件必须在当前仓库内');
  const stat = fs.lstatSync(absolute);
  assert(stat.isFile() && !stat.isSymbolicLink(), `必须是现有普通文件: ${p}`);
  assert.equal(fs.realpathSync(absolute), absolute, `不接受符号链接父目录: ${p}`);
  return absolute;
};
const read = (p) => JSON.parse(fs.readFileSync(resolveFile(p), 'utf8'));
const bind = async (p) => {
  const absolute = resolveFile(p);
  const digest = crypto.createHash('sha256');
  for await (const bytes of fs.createReadStream(absolute)) digest.update(bytes);
  return {path: path.relative(repo, absolute).split(path.sep).join('/'), sha256: digest.digest('hex')};
};
const verifyBinding = async (b) => {
  assert(b && typeof b.path === 'string' && /^[a-f0-9]{64}$/u.test(b.sha256), '缺少真实文件哈希绑定');
  const actual = await bind(b.path);
  assert.equal(actual.sha256, b.sha256, `哈希不匹配: ${b.path}`);
  return actual;
};
const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 2, '仅在收到父任务实查完成消息后，提供--review-confirmation <实查记录.json>执行');
  assert.equal(args[0], '--review-confirmation');
  const review = read(args[1]);
  assert.equal(review.schemaVersion, 'parent-keyframe-application-review/v1');
  assert.equal(review.reporter, 'parent-task');
  assert.equal(review.keyframeInspectionComplete, true, '父任务尚未报告实际关键帧检查完成');
  assert(typeof review.confirmationText === 'string' && review.confirmationText.trim(), '必须保留父任务的实际确认信息');
  assert(Number.isFinite(Date.parse(review.inspectedAt)) && Date.parse(review.inspectedAt) <= Date.now(), '实查时间无效');
  assert(Array.isArray(review.applications), '需要如实列出已有逐效果检查结论');
  assert(Array.isArray(review.renderEvidence) && review.renderEvidence.length, '需要绑定已完成渲染的本条本地证据，不以视频存在冒充应用证据');

  const outputNames = ['application-receipt.v1.json', 'application-validation.v1.json',
    'application-validation.v1.stdout.txt', 'application-validation.v1.stderr.txt'];
  for (const name of outputNames) assert(!fs.existsSync(path.join(dir, name)), `不覆盖已有文件: ${name}`);
  const selection = read(paths.selection);
  const manifest = read(paths.manifest);
  const plan = read(paths.visualPlan);
  const bindings = {};
  for (const [key, p] of Object.entries(paths)) bindings[key] = await bind(p);
  const reviewBinding = await bind(args[1]);
  assert.deepEqual(manifest.selection, bindings.selection);
  assert.deepEqual(plan.shotcraftSelection, bindings.selection);
  assert.equal(manifest.formalAllowed, false);
  assert.equal(bindings.componentCopy.sha256, bindings.component.sha256, '复制组件与原Shotcraft组件不等');
  assert.equal(selection.derivation.component.sha256, bindings.component.sha256, '原组件已偏离derived.v2绑定');
  for (const key of ['output', 'selection', 'componentCopy']) {
    assert.deepEqual(await verifyBinding(review[key]), bindings[key], `实查不是当前${key}`);
  }
  for (const evidence of review.renderEvidence) await verifyBinding(evidence);

  const selected = selection.beats.filter((beat) => beat.decision === 'apply');
  assert.equal(selected.length, 15, '本条只消费既定15个apply，不扩选');
  assert.equal(plan.effects.length, selected.length);
  assert.equal(new Set(plan.effects.map((effect) => effect.id)).size, selected.length);
  const registry = read(selection.registry.path);
  await verifyBinding(selection.registry);
  const reviewed = new Map();
  for (const item of review.applications) {
    assert(!reviewed.has(item.beatId), `重复实查条目: ${item.beatId}`);
    const beat = selected.find((candidate) => candidate.beatId === item.beatId);
    assert(beat, `未选效果不可进入应用回执: ${item.beatId}`);
    assert.equal(item.effectId, beat.effectId);
    assert.deepEqual(item.frames, beat.frames);
    assert.equal(typeof item.finalWorking, 'boolean', '实查结论必须明确，不接受字符串或推断');
    assert(typeof item.observation === 'string' && item.observation.trim(), '缺少实际观察记录');
    assert(Array.isArray(item.evidence) && item.evidence.length, '实查结论需绑定本条实际检查证据');
    for (const evidence of item.evidence) await verifyBinding(evidence);
    reviewed.set(item.beatId, item);
  }
  const applications = selected.map((beat) => {
    const effect = plan.effects.find((item) => item.id === beat.beatId);
    assert(effect, `visual-plan未消费所选效果: ${beat.beatId}`);
    assert.equal(effect.effectId, beat.effectId);
    assert.deepEqual({startFrame: effect.from, endFrameExclusive: effect.to}, beat.frames);
    assert.deepEqual(effect.props, beat.componentProps);
    assert.deepEqual(effect.words, beat.texts);
    if (beat.effectId === 'keyword-reveal') {
      assert.deepEqual(effect.words.map((text, index) => ({text, atFrame: effect.wordFrames[index]})), beat.componentProps.items);
    }
    const adapter = registry.effects.find((item) => item.id === beat.effectId);
    assert(adapter, `不是已注册效果: ${beat.effectId}`);
    const item = reviewed.get(beat.beatId);
    return {beatId: beat.beatId, effectId: beat.effectId, frames: beat.frames,
      component: {name: adapter.component, ...bindings.component}, actualComponentCopy: bindings.componentCopy,
      componentProps: beat.componentProps, outputSha256: bindings.output.sha256,
      finalWorking: item?.finalWorking ?? false,
      reviewStatus: item ? 'parent-reported-actual-keyframe-check' : 'not-confirmed',
      observation: item?.observation ?? '尚无本效果实际检查结论，不从渲染或代码检查推导通过。',
      evidence: item?.evidence ?? [], reviewConfirmation: reviewBinding};
  });
  const receipt = {schemaVersion: 'koubo-shotcraft-application-receipt/v1',
    status: 'candidate-application-evidence-recorded-not-release-approval',
    taskId: selection.taskId, revisionId: selection.revisionId,
    generatedAt: new Date().toISOString(), selection: bindings.selection, output: bindings.output,
    applications, sourceBindings: bindings, reviewConfirmation: reviewBinding,
    renderEvidence: review.renderEvidence,
    originalAndCopiedComponentHashesEqual: bindings.component.sha256 === bindings.componentCopy.sha256,
    pendingOrRejectedBeatIds: applications.filter((item) => !item.finalWorking).map((item) => item.beatId),
    reviewAttribution: '父任务提供的实际检查记录；生成脚本不看画面、不听音频，不把父任务检查改称最终用户完整观看验收。',
    fullVideoUserAcceptanceClaimed: false, audioListeningByGeneratorClaimed: false,
    formalAllowed: false, publicationApproved: false};
  write('application-receipt.v1.json', receipt);
  const command = [resolveFile(paths.validator), path.join(dir, 'application-receipt.v1.json'), repo];
  const validation = spawnSync(process.execPath, command, {cwd: repo, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
  for (const stream of ['stdout', 'stderr']) {
    fs.writeFileSync(path.join(dir, `application-validation.v1.${stream}.txt`), validation[stream] ?? '', {flag: 'wx'});
  }
  let result = null;
  try { result = JSON.parse(validation.stdout); } catch { /* 原始stdout/stderr已保存，不能编造校验结果。 */ }
  const valid = validation.status === 0 && result?.status === 'application-receipt-valid' && result?.errors?.length === 0;
  write('application-validation.v1.json', {
    status: valid ? 'machine-application-receipt-valid-candidate-only' : 'blocked-validation-failure-preserved',
    receipt: await bind(`${relativeDir}/application-receipt.v1.json`), validator: bindings.validator,
    command: [process.execPath, ...command], exitCode: validation.status, signal: validation.signal,
    processError: validation.error ? String(validation.error) : null, result,
    stdout: await bind(`${relativeDir}/application-validation.v1.stdout.txt`),
    stderr: await bind(`${relativeDir}/application-validation.v1.stderr.txt`),
    formalAllowed: false, fullVideoUserAcceptanceClaimed: false,
  });
  console.log(JSON.stringify({status: valid ? 'application-receipt-valid-candidate-only' : 'blocked',
    receipt: `${relativeDir}/application-receipt.v1.json`, applicationCount: applications.length,
    pendingOrRejectedBeatIds: receipt.pendingOrRejectedBeatIds, formalAllowed: false}, null, 2));
  if (!valid) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({status: 'blocked-no-success-claim', error: String(error.message ?? error), formalAllowed: false}, null, 2));
  process.exitCode = 1;
});
