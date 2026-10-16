// R3 仅绑定已存在的真实改片原话与当前完整闭包；不签发独立签名，不渲染。
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {computeFirstCandidatePreviewBindingV2} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {MUSK_GROK_CHAT_R3_SOURCE} from '../../../../skills/koubo-remotion-director/scripts/musk-grok-chat-preview-authorization.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url)), projectRoot = path.resolve(directory, '../../../..');
const read = name => JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const ref = file => ({path: path.relative(projectRoot, file).split(path.sep).join('/'), sha256: sha(file)});
const write = (name, body) => writeFileSync(path.join(directory, name), JSON.stringify(body, null, 2) + '\n');
const job = read('production-job.first-candidate.v1.json');
const sourceFile = path.resolve(projectRoot, MUSK_GROK_CHAT_R3_SOURCE.path);
if (sha(sourceFile) !== MUSK_GROK_CHAT_R3_SOURCE.sha256 ||
    job.productionGate.revisionId !== 'musk-grok-business-ai-v9-full-candidate-r3-20261016') throw new Error('R3真实原话或版本身份不符');
if (existsSync(path.resolve(projectRoot, job.preview.output))) throw new Error('R3输出已存在，停止覆盖');
job.productionGate.previewAuthorizationMode = 'musk-grok-current-chat-review/v1';
job.productionGate.firstCandidateAuthorization = null;
job.productionGate.freezeReceipt = null;
job.productionGate.localChatPreviewAuthorization = null;
job.preparationNote = 'R3依据本轮真实正片导出指令输出完整1080p有声候选供用户终看；原声完整、字幕按用户指定8条校字，既有11条候选保留；非独立签名，整片验收/事实/发布仍未通过。';
const binding = computeFirstCandidatePreviewBindingV2({projectRoot, job});
const authorization = read('内部预览聊天授权.draft.v1.json');
delete authorization.preparationState;
Object.assign(authorization, {authorizationType: 'local-chat-authorization', recordedAt: new Date().toISOString(),
  sourceMessages: ref(sourceFile), binding});
write('内部预览聊天授权.v1.json', authorization);
job.productionGate.localChatPreviewAuthorization = ref(path.join(directory, '内部预览聊天授权.v1.json'));
write('production-job.first-candidate.v1.json', job);
write('聊天授权绑定生成回执.v1.json', {recordedAt: new Date().toISOString(), generatedBy: 'computeFirstCandidatePreviewBindingV2',
  job: ref(path.join(directory, 'production-job.first-candidate.v1.json')),
  authorization: ref(path.join(directory, '内部预览聊天授权.v1.json')), sourceMessages: ref(sourceFile),
  boundFileCount: binding.boundFiles.length, gateClosureSha256: binding.gateClosureSha256,
  independentSignature: false, humanAcceptancePerformed: false, formalEnabled: false, publishAuthorized: false, renderInvoked: false});
console.log(JSON.stringify({stage: 'r3-binding-written-awaiting-real-context',
  job: ref(path.join(directory, 'production-job.first-candidate.v1.json')),
  authorization: ref(path.join(directory, '内部预览聊天授权.v1.json')), boundFileCount: binding.boundFiles.length, renderInvoked: false}));
