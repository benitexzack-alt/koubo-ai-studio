// 只执行本期真实输入、知识上下文与入口校验；不导入渲染器、不签发批准。
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateFirstCandidateInputContract} from '../../../../skills/koubo-remotion-director/scripts/first-candidate-input-contract.mjs';
import {validateProductionEntryPreflightV2, collectRemotionRuntimeGraphV2} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertDirectorProductionBinding} from '../../../../tools/director-production-binding-core.mjs';
import {validateKnowledgeContextForProductionV2} from '../../../../tools/knowledge-context-production-gate.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directory, '../../../..');
const jobPath = path.join(directory, 'production-job.first-candidate.v1.json');
const contractPath = path.join(directory, 'first-candidate-input.v1.json');
const jobBytes = readFileSync(jobPath), job = JSON.parse(jobBytes);
const contract = JSON.parse(readFileSync(contractPath));
const command = 'direct-remotion-preview';
const attempt = (run) => {
  try { return run(); }
  catch (error) { return {ok: false, code: error.code ?? null, message: error.message,
    details: error.details ?? null, errors: error.errors ?? []}; }
};
const input = attempt(() => validateFirstCandidateInputContract({projectRoot, contract, job, command}));
const director = attempt(() => assertDirectorProductionBinding({projectRoot, job, command}));
const context = attempt(() => ({ok: true, ...validateKnowledgeContextForProductionV2({projectRoot, jobPath, job, command})}));
const runtimeGraph = attempt(() => collectRemotionRuntimeGraphV2({projectRoot, job}));
const preflight = attempt(() => validateProductionEntryPreflightV2({projectRoot, jobPath, job, command,
  entrypoint: 'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs'}));
const result = {
  schemaVersion: 'episode-first-candidate-real-input-check/v1', checkedAt: new Date().toISOString(),
  command, job: {path: path.relative(projectRoot, jobPath), sha256: createHash('sha256').update(jobBytes).digest('hex')},
  input: {...input, documents: undefined}, director, context, runtimeGraph, preflight,
  renderEntryInvoked: false, renderExecuted: false, gateBypassed: false,
  authorizationSigned: false, supervisionSigned: false,
  fullWatchConfirmed: false, candidateAccepted: false, formalAuthorized: false, publishAuthorized: false,
};
writeFileSync(path.join(directory, '冻结后只读入口复核.v1.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({inputOk:input.ok, inputFiles:input.files?.length, directorOk:director.ok,
  contextOk:context.ok, preflight, renderExecuted:false}));
if (!input.ok || !director.ok || !context.ok || !preflight.ok) process.exitCode = 1;
