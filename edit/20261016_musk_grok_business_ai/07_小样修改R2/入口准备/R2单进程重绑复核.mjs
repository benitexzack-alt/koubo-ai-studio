// 本期内部预览的单进程编排；只复用现有验证器缓存，不导入渲染器。
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
const sha = (name) => createHash('sha256').update(readFileSync(path.join(directory, name))).digest('hex');

await import('./绑定本期聊天预览授权.mjs');
const job = read('production-job.first-candidate.v1.json');
const authorization = read('内部预览聊天授权.v1.json');
console.log(JSON.stringify({stage: 'awaiting-real-context-refresh',
  jobSha256: sha('production-job.first-candidate.v1.json'),
  authorizationSha256: sha('内部预览聊天授权.v1.json'),
  preview: job.preview, bindingFileCount: authorization.binding.boundFiles.length,
  allowedCommands: authorization.allowedCommands,
  independentSignature: authorization.independentSignature,
  fullWatchConfirmed: authorization.fullWatchConfirmed,
  formalEnabled: authorization.formalEnabled, publishAuthorized: authorization.publishAuthorized,
  renderInvoked: false}));

// 主执行者实际回读绑定结果、更新读取回执并完成现有 opc_rag start 后才继续。
const lines = createInterface({input: process.stdin, terminal: false});
await new Promise((resolve, reject) => {
  lines.once('line', (line) => {
    lines.close();
    process.stdin.pause();
    if (line.trim() === 'context-ready') resolve();
    else reject(new Error('本期知识上下文未发出完成信号，停止入口复核'));
  });
  lines.once('error', reject);
});

await import('./只读入口复核.mjs');
