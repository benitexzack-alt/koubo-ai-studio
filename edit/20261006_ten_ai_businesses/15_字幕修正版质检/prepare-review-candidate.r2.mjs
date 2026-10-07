import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertScopedDirectExport} from '../../../tools/scoped-direct-export-core.mjs';
import {validateKnowledgeContextForProductionV2} from '../../../tools/knowledge-context-production-gate.mjs';

// 仅为已有完整渲染制作观看候选；不补造失败的生产回执，不解除正式登记阻断。
const qa = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(qa, '../../..');
const base = path.resolve(root, 'edit/20261006_ten_ai_businesses');
const jobPath = path.resolve(base, '00_成片控制/subtitle-r2/production-full-candidate.r2.json');
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const binding = assertScopedDirectExport({projectRoot: root, jobPath, job, command: 'direct-remotion-preview'});
const context = validateKnowledgeContextForProductionV2({projectRoot: root, jobPath, job, command: 'qa'});
const rendered = path.resolve(root, job.preview.output);
const prior = path.resolve(base, '08_正式成片/10个AI生意_V8_R1_1080P_成片.mp4');
const output = path.resolve(base, '08_正式成片/10个AI生意_V8_R2_1080P_字幕修正版.mp4');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const local = file => path.relative(root, file);
if (fs.existsSync(output)) throw new Error('候选已存在，禁止覆盖');
if (sha(prior) !== '1b42b91c4299f0fb8b8f1d7c98dc4492915d7f24553222c3437e7d59bd5f5352') throw new Error('原版音轨来源变化');
const claims = fs.readdirSync(path.dirname(rendered)).filter(name => name.startsWith(`.${path.basename(rendered)}.render-claim.`));
if (claims.length !== 1) throw new Error('受控原始渲染claim不唯一');
const claim = path.resolve(path.dirname(rendered), claims[0]);
const args = ['-nostdin', '-hide_banner', '-i', rendered, '-i', prior, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', output];
const result = spawnSync('ffmpeg', args, {encoding: 'utf8', maxBuffer: 1024 * 1024});
if (result.status !== 0) throw new Error(result.stderr);
const receipt = {
  schema: 'ten-ai-businesses-review-candidate/r2',
  generatedAt: new Date().toISOString(),
  status: 'blocked-production-registration',
  purpose: '供用户观看的完整字幕修正版；不是正式生产通过回执',
  parentRender: {path: local(rendered), sha256: sha(rendered), frameCountReportedByRenderer: 8534,
    wrapperExitCode: 1, renderCompleted: true, postRenderGatePassed: false,
    failureCode: 'KCPG2_CONTEXT_VALIDATION_FAILED', failureDetail: 'blocked-context-stale / index-not-current',
    failureEvidence: '本轮受控进程8850：Encoded 8534/8534后，知识上下文复检失败；不存在成功production-receipt。',
    originalClaim: {path: local(claim), sha256: sha(claim)}},
  diagnosis: '全知识库候选文件哈希变化触发索引失效；只读定位到其他项目文档与每日复盘更新。本轮不修改全局门禁。',
  currentFrozenProductionBindingRechecked: binding.ok === true,
  currentContextForReadOnlyQa: context,
  contextRefreshDoesNotRetroactivelyValidateParentRender: true,
  videoSource: {path: local(rendered), sha256: sha(rendered)},
  audioSource: {path: local(prior), sha256: sha(prior)},
  command: ['ffmpeg', ...args],
  output: {path: local(output), sha256: sha(output), bytes: fs.statSync(output).size},
  mediaQaPending: true, formalProductionPassed: false, releaseVerified: false,
  userFullWatchConfirmed: false, publishAuthorized: false, published: false,
};
fs.writeFileSync(path.resolve(qa, '候选制作与生产阻断说明.r2.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output: local(output), status: receipt.status, binding: binding.ok}));
