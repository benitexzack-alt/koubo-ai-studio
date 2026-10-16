// 复用现有 native 验证器的进程内缓存。先真实绑定并等待当前 context；只有主执行者发启动信号才调用原 wrapper。
import {createInterface} from 'node:readline';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {readFileSync, writeFileSync} from 'node:fs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
const jobPath = path.join(directory, 'production-job.first-candidate.v1.json');
await import('./绑定本期聊天预览授权.mjs');
console.log(JSON.stringify({stage: 'r3-bound-awaiting-real-context-and-root-render-start',
  jobPath, renderInvoked: false, independentFullPreflightPerformed: false}));
const lines = createInterface({input: process.stdin, terminal: false});
await new Promise((resolve, reject) => {
  lines.once('line', line => {
    lines.close(); process.stdin.pause();
    if (line.trim() === 'controlled-render-start') resolve();
    else reject(new Error('未收到主执行者受控启动信号，未调用渲染'));
  });
  lines.once('error', reject);
});
// 当前 context 与整条入口由原 wrapper 再次验证，任何状态或文件变化照常拒绝。
const job = JSON.parse(readFileSync(jobPath));
const wrapper = path.join(root, 'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs');
process.argv = [process.execPath, wrapper, path.relative(root, jobPath), 'preview'];
writeFileSync(path.join(directory, '主执行者启动受控入口.v1.json'), JSON.stringify({
  invokedAt: new Date().toISOString(), command: process.argv, knowledgeTaskId: job.knowledgeContext.taskId,
  sameProcessNativeCache: true, sourceHashesStillCheckedByWrapper: true,
  fullWrapperPreflightAndPostcheckRequired: true, humanAcceptancePerformed: false, publishAuthorized: false}, null, 2) + '\n');
await import(pathToFileURL(wrapper).href);
