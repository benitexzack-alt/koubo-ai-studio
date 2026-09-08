#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePreproductionRequest, sha256File} from '../scripts/preproduction-director-core.mjs';
import {validatePaperMotionContract, renderMotionAction, renderMotionPrompt, renderMotionFirstFrame} from '../scripts/paper-motion-contract.mjs';
import {makeIncidentMotionRequest, bindSemanticReview} from './fixtures/paper-motion-request.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = JSON.parse(readFileSync(path.join(root,
  'edit/20260906_lanzhou_ai_services/04_导演拆解/v9.1-r2/director-preproduction-request.v1.json')));
const profile = JSON.parse(readFileSync(path.join(root, 'workflow/active-director-profile.v1.json')));
const check = (request, selectedProfile = profile) =>
  validatePreproductionRequest({request, profile: selectedProfile, projectRoot: root});
const negative = structuredClone(source);
const scene = negative.beats.find((beat) => beat.id === 'B11').paperScene;
negative.policy.incidentPreventionVersion = '1';
scene.stages[2].action = '作废资料从灰盒继续送入右侧企业知识库。';
scene.stages[3].action = '有效资料和作废资料一起进入知识库。';
scene.prompt.motion += '有效资料和作废资料一起进入知识库。';
assert.equal(check(negative).ok, false, '事故反义请求必须拒绝，不能只检查字段齐全');

const fold = structuredClone(source);
fold.policy.incidentPreventionVersion = '1';
fold.beats.find((beat) => beat.id === 'B11').paperScene.stages[1].action = '带字牌折叠翻面。';
assert.equal(check(fold).ok, false, '没有可验证动作合同的带字牌运动必须拒绝');
const reviewsRoot = mkdtempSync(path.join(os.tmpdir(), 'koubo-mechanism-review-test-'));
process.on('exit', () => rmSync(reviewsRoot, {recursive: true, force: true}));
const valid = bindSemanticReview(makeIncidentMotionRequest(source), reviewsRoot);
assert.deepEqual(check(valid).errors, [], '单一有效资料移动，固定标签与灰盒隔离的合法计划应通过');
let tests = 3;
const reject = (change, expected) => {
  const candidate = structuredClone(valid);
  const beat = candidate.beats[0];
  change(beat.paperScene, beat, candidate);
  const result = check(candidate);
  assert(result.errors.some((error) => error.includes(expected)), `${expected}: ${result.errors.join('|')}`);
  tests++;
};
reject((s) => {s.motionContract.actions[0].partId = 'obsolete-pages'; s.motionContract.actions[0].fromGroupId = 'G3';}, 'PAPER_FORBIDDEN_TRANSFER');
reject((s) => {
  s.motionContract.initialLocations.find((p) => p.partId === 'obsolete-pages').groupId = 'G4';
  s.motionContract.finalLocations.find((p) => p.partId === 'obsolete-pages').groupId = 'G4';
}, 'PAPER_FORBIDDEN_STATE');
reject((s) => {
  s.motionContract.forbiddenTransfers = [];
  s.motionContract.allowedTransfers = [{partId: 'obsolete-pages', fromGroupId: 'G3', toGroupId: 'G4'}];
  Object.assign(s.motionContract.actions[0], {partId: 'obsolete-pages', fromGroupId: 'G3'});
  s.motionContract.finalLocations = [{partId: 'valid-pages', groupId: 'G2'}, {partId: 'obsolete-pages', groupId: 'G4'}];
  s.stages[0].subject = 'G3';
  s.stages[0].action = renderMotionAction(s, s.motionContract.actions[0]);
  s.prompt.motion = renderMotionPrompt(s);
  s.prompt.firstFrame = renderMotionFirstFrame(s);
}, 'PAPER_SEMANTIC_REVIEW_GRAPH_MISMATCH');
reject((s) => {s.prompt.firstFrame += '作废资料与知识库之间用连续纸路连接，作废资料已经放在知识库内部。';}, 'PAPER_FIRSTFRAME_PROMPT_NOT_COMPILED');
reject((s) => {s.motionContract.semanticReview.sha256 = '0'.repeat(64);}, 'PAPER_SEMANTIC_REVIEW_FILE_OR_SHA_INVALID');
reject((s) => {s.motionContract.allowedTransfers.push({...s.motionContract.forbiddenTransfers[0]});}, 'PAPER_TRANSFER_RULE_CONTRADICTION');
reject((s) => {s.motionContract.actions[0].partId = 'G2-label'; s.motionContract.actions[0].operation = 'fold';}, 'PAPER_TEXT_SURFACE_ACTION_FORBIDDEN');
reject((s) => {s.motionContract.parts[0].mount = 'moving-hinge';}, 'PAPER_LABEL_MOUNT_NOT_INDEPENDENT');
reject((s) => {s.motionContract.actions[0].sweptRect = {x: 0.36, y: 0.27, width: 0.1, height: 0.05};}, 'PAPER_MOTION_LABEL_COLLISION');
reject((s) => {s.motionContract.actions[0].sweptRect.y = 0.81;}, 'PAPER_MOTION_ZONE_UNSAFE');
reject((s) => {s.motionContract.initialLocations[0].groupId = 'G1';}, 'PAPER_ACTION_STATE_DISCONTINUITY');
reject((s) => {s.motionContract.finalLocations[0].groupId = 'G3';}, 'PAPER_FINAL_STATE_MISMATCH');
reject((s) => {s.motionContract.meaning.sourceQuote = '虚构的口播';}, 'PAPER_MEANING_SOURCE_QUOTE_MISMATCH');
reject((s) => {s.motionContract.meaning.sourceQuote = '。';}, 'PAPER_MEANING_SOURCE_QUOTE_MISMATCH');
reject((s) => {s.readableTextPolicy.maximumSimultaneousLabels = 3;}, 'PAPER_INITIAL_LABELS_EXCEED_READABLE_LIMIT');
reject((s) => {s.stages[0].action = '把有效和作废资料一起送入知识库。';}, 'PAPER_STAGE_ACTION_NOT_COMPILED');
reject((s) => {s.prompt.motion += '\n让带字牌翻面。';}, 'PAPER_MOTION_PROMPT_NOT_COMPILED');
reject((s) => {s.motionContract.dynamicValidation.requiredBeforeBatch = false;}, 'PAPER_DYNAMIC_PILOT_POLICY_REQUIRED');
reject((s) => {s.prompt.firstFrame += '禁止字幕，问题票滑入。';}, 'SYMBOL_CUE_CONFLICT');
reject((s) => {s.textPlan[0].firstReadableFrame = 60;}, 'PAPER_FIXED_LABEL_VISIBILITY_REQUIRED');
reject((s) => {s.motionContract.parts.pop();}, 'PAPER_INITIAL_STATE_INVALID');
const prohibitionList = structuredClone(valid);
prohibitionList.beats[0].paperScene.prompt.firstFrame += '禁止文字，问号，编号卡。';
assert(!check(prohibitionList).errors.some((error) => error.includes('SYMBOL_CUE_CONFLICT')), '纯禁止列表不应被当作正向符号诱导');
tests++;

const conditional = structuredClone(valid.beats[0]);
const cs = conditional.paperScene;
const first = cs.motionContract.actions[0];
const next = {...structuredClone(first), id: 'A2', stageId: 'S2', operation: 'lock', fromGroupId: 'G4',
  startSeconds: 5.2, endSeconds: 6};
cs.motionContract.actions.push(next);
cs.stages.push({id: 'S2', order: 2, subject: 'G2', landingNodeIds: [], sfxRole: 'paper-click', action: renderMotionAction(cs, next)});
cs.motionContract.requiredPredecessors = [{actionId: 'A2', beforeActionId: 'A1', sourceQuote: conditional.spokenLine}];
cs.prompt.motion = renderMotionPrompt(cs);
assert.deepEqual(validatePaperMotionContract({scene: cs, beat: conditional, required: true}), []);
cs.motionContract.requiredPredecessors[0] = {actionId: 'A1', beforeActionId: 'A2', sourceQuote: conditional.spokenLine};
assert(validatePaperMotionContract({scene: cs, beat: conditional, required: true}).some((error) => error.startsWith('PAPER_PRECONDITION_NOT_SATISFIED')));
tests += 2;
const stripped = structuredClone(valid);
delete stripped.policy.incidentPreventionVersion;
assert.equal(check(stripped, {...profile, incidentPreventionPolicy: {requiredForNewPreproduction: true}}).ok, false);
tests++;
const temporary = mkdtempSync(path.join(os.tmpdir(), 'koubo-incident-roundtrip-'));
try {
  const request = structuredClone(valid);
  bindSemanticReview(request, temporary);
  request.inputScript.path = path.resolve(root, source.inputScript.path);
  request.directorProfile.path = 'profile.json';
  for (const key of Object.keys(request.outputs)) request.outputs[key] = `out/${key}.${key.endsWith('SheetPath') ? 'md' : 'json'}`;
  const writeJson = (declared, value) => {
    const target = path.join(temporary, declared);
    mkdirSync(path.dirname(target), {recursive: true});
    writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  };
  const localProfile = {...profile, style: {...profile.style, path: path.resolve(root, profile.style.path)},
    incidentPreventionPolicy: {requiredForNewPreproduction: true}};
  writeJson('profile.json', localProfile);
  writeJson('request.json', request);
  const run = (script) => spawnSync(process.execPath, [path.join(root, 'skills/koubo-remotion-director/scripts', script),
    '--repo-root', temporary, '--request', 'request.json'], {encoding: 'utf8'});
  const compiled = run('compile-preproduction-director.mjs');
  assert.equal(compiled.status, 0, compiled.stderr);
  const validated = run('validate-preproduction-director.mjs');
  assert.equal(validated.status, 0, validated.stderr);
  const receipt = JSON.parse(readFileSync(path.join(temporary, request.outputs.validationReceiptPath)));
  assert.equal(receipt.policy.incidentPreventionVersion, '1');
  assert.equal(receipt.gates.formalEligible, false);
  assert.equal(receipt.status, 'validated-provisional-previsualization');
  tests++;
  rmSync(path.join(temporary, request.outputs.validationReceiptPath));
  const planPath = path.join(temporary, request.outputs.planPath);
  const plan = JSON.parse(readFileSync(planPath));
  delete plan.policy;
  writeJson(request.outputs.planPath, plan);
  const compileReceipt = JSON.parse(readFileSync(path.join(temporary, request.outputs.compileReceiptPath)));
  compileReceipt.plan.sha256 = sha256File(planPath);
  writeJson(request.outputs.compileReceiptPath, compileReceipt);
  const strippedResult = run('validate-preproduction-director.mjs');
  assert.equal(strippedResult.status, 1);
  assert(strippedResult.stderr.includes('INCIDENT_PLAN_REQUEST_RECOMPILE_MISMATCH'), strippedResult.stderr);
  tests++;
} finally {
  rmSync(temporary, {recursive: true, force: true});
}
console.log(JSON.stringify({ok: true, tests, scope: 'local-contract-only', generatedMedia: false}));
