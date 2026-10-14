import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROUTE, EPISODE, JOB_ID, JOB, MANIFEST, ORIGINALS, AUTHORIZATION, AUTHORIZATION_EVIDENCE,
  collectDirectorMotionMinuteBindings} from './export-adapter.v1.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const job = JSON.parse(readFileSync(resolve(root, JOB), 'utf8'));
if (job.jobId !== JOB_ID) throw new Error('只为本次一分钟预览建立清单');
const binding = collectDirectorMotionMinuteBindings({projectRoot: root, job});
const files = new Map(binding.boundFiles.map(file => [file.path, file]));
for (const path of [...ORIGINALS, AUTHORIZATION, AUTHORIZATION_EVIDENCE]) {
  if (!files.has(path)) throw new Error(`尚未真实绑定：${path}`);
}
const manifest = {schema: 'director-motion-minute-export-manifest/v1', route: ROUTE, episodeId: EPISODE,
  jobId: JOB_ID, jobPath: JOB, variant: 'minute-preview',
  authorization: {path: AUTHORIZATION, sha256: sha(readFileSync(resolve(root, AUTHORIZATION)))},
  originalMedia: ORIGINALS.map(path => ({path, sha256: files.get(path).sha256})), binding,
  fullWatchConfirmed: false, publishAuthorized: false,
  validationMeaning: '仅绑定本次一分钟待审样片的真实输入；不是人工观看验收、正式升级或发布授权'};
const bytes = `${JSON.stringify(manifest, null, 2)}\n`;
const digest = sha(bytes);
if (process.argv.includes('--write')) {
  writeFileSync(resolve(root, MANIFEST), bytes, 'utf8');
  if (sha(readFileSync(resolve(root, MANIFEST))) !== digest) throw new Error('清单落盘字节与摘要不一致');
}
console.log(JSON.stringify({path: MANIFEST, sha256: digest, written: process.argv.includes('--write'),
  bytes: Buffer.byteLength(bytes), ...(process.argv.includes('--write') ? {} : {manifestBytes: bytes})}, null, 2));
