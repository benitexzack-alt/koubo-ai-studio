// 原生输入全解码已在授权计算时完成；这里只核对当前哈希、聊天范围和输出槽，不代替渲染 wrapper 的完整 preflight。
import {existsSync, readFileSync, writeFileSync, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {computeProductionJobSnapshotSha256V2, computeProductionGateClosureV2, computeProductionCompositionBindingV2}
  from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {stableJsonSha256} from '../../../../skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs';
import {validateMuskGrokChatPreviewAuthorization}
  from '../../../../skills/koubo-remotion-director/scripts/musk-grok-chat-preview-authorization.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directory, '../../../..');
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const assert = (value, message) => {if (!value) throw new Error(message);};
const reference = file => ({path: path.relative(projectRoot, file), sha256: sha(file)});
const readBoundJson = (root, ref) => {
  const absolutePath = path.resolve(root, ref.path);
  assert(sha(absolutePath) === ref.sha256, `引用已改变：${ref.path}`);
  return {...ref, absolutePath, body: read(absolutePath)};
};
const jobFile = path.join(directory, 'production-job.first-candidate.v1.json'), job = read(jobFile);
const input = readBoundJson(projectRoot, job.productionGate.firstCandidateInput).body;
const auth = readBoundJson(projectRoot, job.productionGate.localChatPreviewAuthorization).body;
const binding = auth.binding;
for (const file of [...binding.boundFiles, ...binding.gateClosure]) {
  assert(sha(path.resolve(projectRoot, file.path)) === file.sha256, `闭包文件已改变：${file.path}`);
}
assert(stableJsonSha256(binding.boundFiles) === binding.boundFilesSha256, '文件列表摘要不符');
assert(computeProductionJobSnapshotSha256V2(job) === binding.jobSnapshotSha256, 'job快照已改变');
assert(computeProductionGateClosureV2({projectRoot}).sha256 === binding.gateClosureSha256, '门禁代码闭包已改变');
assert(stableJsonSha256(computeProductionCompositionBindingV2(job, {projectRoot})) === stableJsonSha256(binding.compositionBinding), 'Remotion执行绑定已改变');
const authorization = validateMuskGrokChatPreviewAuthorization({projectRoot, job, input, binding,
  command: 'direct-remotion-preview', readBoundJson});
const output = path.resolve(projectRoot, job.preview.output);
assert(!existsSync(output), 'R3输出槽已占用');
assert(existsSync(path.dirname(output)) && realpathSync(path.dirname(output)) === path.dirname(output), 'R3输出目录缺失或非真实目录');
const result = {schemaVersion: 'episode-r3-preparation-check/v1', checkedAt: new Date().toISOString(),
  ok: true, job: reference(jobFile), authorization, boundFileCount: binding.boundFiles.length,
  gateClosureSha256: binding.gateClosureSha256, output,
  nativeInputValidatedDuringAuthorizationBinding: true, currentBoundFileHashesMatched: true,
  independentFullPreflightPerformed: false, fullPreflightRequiredInRenderWrapper: true,
  renderInvoked: false, fullWatchConfirmed: false, formalAuthorized: false, publishAuthorized: false};
writeFileSync(path.join(directory, 'R3准备只读核对.v1.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
