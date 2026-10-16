// 只调用门禁校验函数；不导入渲染入口，不创建媒体、签名或通过回执。
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directory, '../../../..');
const jobPath = path.join(directory, 'production-job.first-candidate.pending.v1.json');
const jobBytes = readFileSync(jobPath);
const job = JSON.parse(jobBytes);
const {validateProductionEntryPreflightV2} = await import(pathToFileURL(path.join(projectRoot,
  'skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs')));
const {assertDirectorProductionBinding} = await import(pathToFileURL(path.join(projectRoot,
  'tools/director-production-binding-core.mjs')));

const entry = validateProductionEntryPreflightV2({projectRoot, jobPath, job,
  command: 'direct-remotion-preview',
  entrypoint: 'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs'});
let director;
try { director = assertDirectorProductionBinding({projectRoot, job, command: 'direct-remotion-preview'}); }
catch (error) { director = {ok: false, code: error.code, message: error.message, errors: error.errors ?? []}; }
console.log(JSON.stringify({
  schemaVersion: 'episode-first-candidate-readonly-check/v1',
  checkedAt: new Date().toISOString(),
  job: {path: path.relative(projectRoot, jobPath), sha256: createHash('sha256').update(jobBytes).digest('hex')},
  invokedFunctions: ['validateProductionEntryPreflightV2', 'assertDirectorProductionBinding'],
  command: 'direct-remotion-preview',
  entry, director,
  renderEntryInvoked: false, renderExecuted: false, gateBypassed: false,
  acceptanceCreated: false, authorizationCreated: false,
}, null, 2));
if (!entry.ok || !director.ok) process.exitCode = 1;
