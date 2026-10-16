// 仅绑定用户本轮真实范围；不是签名器，不渲染，不改变正式验收。
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {computeFirstCandidatePreviewBindingV2} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directory, '../../../..');
const read = (name) => JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const ref = (file) => ({path: path.relative(projectRoot, file).split(path.sep).join('/'), sha256: sha(file)});
const write = (name, value) => writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + '\n');
const job = read('production-job.first-candidate.v1.json');
const sourcePath = path.join(directory, '本轮内部预览用户原话.v1.json');
const source = read('本轮内部预览用户原话.v1.json');
if (source.userReply !== '允许，仅修复内部预览入口并出小样' || source.source.platformMessageId !== null ||
    source.isIndependentSignature !== false) throw new Error('真实本轮授权原文或身份边界不符');
if (existsSync(path.resolve(projectRoot, job.preview.output))) throw new Error('本期既有输出槽已有文件，停止避免覆盖');
job.productionGate.previewAuthorizationMode = 'musk-grok-current-chat-review/v1';
job.productionGate.firstCandidateAuthorization = null;
job.productionGate.freezeReceipt = null;
job.productionGate.localChatPreviewAuthorization = null;
job.preparationNote = '真实原生v2首次候选输入；仅本期内部预览采用本轮真实聊天授权，独立签名未声称存在。正式验收、完整观看与发布保持false。';
const binding = computeFirstCandidatePreviewBindingV2({projectRoot, job});
const draft = read('内部预览聊天授权.draft.v1.json');
delete draft.preparationState;
const authorization = {...draft, authorizationType: 'local-chat-authorization',
  recordedAt: new Date().toISOString(), sourceMessages: ref(sourcePath), binding};
write('内部预览聊天授权.v1.json', authorization);
job.productionGate.localChatPreviewAuthorization = ref(path.join(directory, '内部预览聊天授权.v1.json'));
write('production-job.first-candidate.v1.json', job);
write('聊天授权绑定生成回执.v1.json', {
  recordedAt: new Date().toISOString(), generatedBy: 'computeFirstCandidatePreviewBindingV2',
  authorizationType: 'local-chat-authorization',
  authorization: ref(path.join(directory, '内部预览聊天授权.v1.json')),
  job: ref(path.join(directory, 'production-job.first-candidate.v1.json')),
  sourceMessages: ref(sourcePath), boundFileCount: binding.boundFiles.length,
  bindingJobSnapshotSha256: binding.jobSnapshotSha256,
  gateClosureSha256: binding.gateClosureSha256,
  independentSignature: false, humanAcceptancePerformed: false,
  formalEnabled: false, publishAuthorized: false, renderInvoked: false,
});
console.log(JSON.stringify({job: ref(path.join(directory, 'production-job.first-candidate.v1.json')),
  authorization: ref(path.join(directory, '内部预览聊天授权.v1.json')),
  boundFileCount: binding.boundFiles.length, renderInvoked: false}));
