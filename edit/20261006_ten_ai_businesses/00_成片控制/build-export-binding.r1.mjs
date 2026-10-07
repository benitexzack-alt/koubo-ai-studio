import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CONTROL, ROUTE, EPISODE, ORIGINALS, REVISION,
  variantFor, jobPathFor, manifestPathFor, collectTenAIBusinessesBindings,
} from './export-adapter.r1.mjs';

// 仅形成本期文件摘要，含本次明确授权的完整候选；用户证据、输入文件、job 与上下文均由主任务真实准备。
const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2), get = key => {
  const index = args.indexOf(key);
  return index === -1 ? null : args[index + 1];
};
const jobPath = get('--job'), authorizationPath = get('--authorization');
const digest = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
try {
  if (!jobPath || !authorizationPath) throw new Error('用法：node build-export-binding.r1.mjs --job <本期job> --authorization <真实授权JSON> [--print-only]');
  const job = JSON.parse(readFileSync(resolve(root, jobPath), 'utf8')), variant = variantFor(job);
  if (jobPath !== jobPathFor(variant)) throw new Error('任务必须使用本期固定 job 路径');
  if (job.productionGate?.route !== ROUTE || job.productionGate?.revisionId !== REVISION) throw new Error('任务没有绑定本期路由／修订');
  if (!authorizationPath.startsWith(`${CONTROL}/`) || !authorizationPath.endsWith('.json')) throw new Error('授权 JSON 必须位于本期控制目录');
  const authorization = JSON.parse(readFileSync(resolve(root, authorizationPath), 'utf8'));
  if (authorization.schema !== 'ten-ai-businesses-render-authorization/v1' || !authorization.evidence?.path) throw new Error('真实用户授权尚未准备');
  const binding = collectTenAIBusinessesBindings({projectRoot: root, job});
  const bound = new Map(binding.boundFiles.map(value => [value.path, value]));
  for (const path of [...ORIGINALS, authorizationPath, authorization.evidence.path]) {
    if (!bound.has(path)) throw new Error(`必需输入没有进入 job 的 fingerprintPaths：${path}`);
  }
  const manifest = {
    schema: 'ten-ai-businesses-export-manifest/v1', route: ROUTE, episodeId: EPISODE,
    jobId: job.jobId, jobPath, variant,
    authorization: {path: authorizationPath, sha256: digest(authorizationPath)},
    originalMedia: ORIGINALS.map(path => ({path, sha256: bound.get(path).sha256})), binding,
    fullWatchConfirmed: false, publishAuthorized: false,
    validationMeaning: '仅真实文件绑定；不是人工观看通过、不是音效听感通过，不生成或批准新的用户证据',
  };
  const bytes = `${JSON.stringify(manifest, null, 2)}\n`, path = manifestPathFor(variant);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (args.includes('--print-only')) {
    console.log(JSON.stringify({manifestPath: path, sha256, contentBindingSha256: binding.contentBindingSha256, manifest}, null, 2));
  } else {
    if (existsSync(resolve(root, path))) throw new Error('清单已存在；禁止覆盖，先核对是否需要新修订');
    // 不用此脚本落盘绕过编辑纪律；输出可交给主任务 apply_patch 原样保存。
    console.log(JSON.stringify({manifestPath: path, sha256, contentBindingSha256: binding.contentBindingSha256,
      patch: `*** Begin Patch\n*** Add File: ${path}\n${bytes.split('\n').filter((line, index, lines) => index < lines.length - 1).map(line => `+${line}`).join('\n')}\n*** End Patch`}, null, 2));
  }
} catch (error) {
  console.error(`本期绑定保持待准备：${error.message}`);
  process.exitCode = 1;
}
