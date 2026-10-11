import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BASE, CONTROL, ROUTE, EPISODE, JOB, MANIFEST, ORIGINALS, collectEnterpriseAIOrganizationBindings} from './export-adapter.v1.mjs';
const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const sha = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const job = JSON.parse(readFileSync(resolve(root, JOB), 'utf8'));
const authorizationPath = `${CONTROL}/真实制作授权.v1.json`;
const binding = collectEnterpriseAIOrganizationBindings({projectRoot: root, job});
const files = new Map(binding.boundFiles.map(file => [file.path, file]));
for (const path of [...ORIGINALS, authorizationPath, `${CONTROL}/真实制作授权.v1.user.jsonl`]) {
  if (!files.has(path)) throw new Error(`尚未真实绑定：${path}`);
}
const manifest = {schema: 'enterprise-ai-organization-export-manifest/v1', route: ROUTE, episodeId: EPISODE,
  jobId: job.jobId, jobPath: JOB, variant: 'full-candidate',
  authorization: {path: authorizationPath, sha256: sha(authorizationPath)},
  originalMedia: ORIGINALS.map(path => ({path, sha256: files.get(path).sha256})), binding,
  fullWatchConfirmed: false, publishAuthorized: false,
  validationMeaning: '真实输入摘要绑定，不是事实核验完成、人工试听通过或发布授权'};
const bytes = `${JSON.stringify(manifest, null, 2)}\n`;
console.log(JSON.stringify({path: MANIFEST, sha256: createHash('sha256').update(bytes).digest('hex'),
  patch: `*** Begin Patch\n*** Add File: ${MANIFEST}\n${bytes.trimEnd().split('\n').map(line => `+${line}`).join('\n')}\n*** End Patch`}, null, 2));
