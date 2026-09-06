import {existsSync, lstatSync, readFileSync, realpathSync, statSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';

const renderCommandRequested = process.argv.slice(2).includes('render');

if (renderCommandRequested) {
  const deny = (reason: string): never => {
    throw new Error(
      `禁止裸调用 Remotion render：${reason}\n` +
        '请使用 npm run render:production -- <job.json> <preview|formal>。',
    );
  };
  const claimPath = process.env.KOUBO_CONTROLLED_RENDER_CLAIM_PATH;
  const claimId = process.env.KOUBO_CONTROLLED_RENDER_CLAIM_ID;
  const preflightSha256 = process.env.KOUBO_CONTROLLED_RENDER_PREFLIGHT_SHA256;
  if (!claimPath || !claimId || !preflightSha256) {
    deny('未提供受控渲染声明和任务级门禁回执。');
  }
  if (!isAbsolute(claimPath)) deny('受控渲染声明必须是绝对路径。');

  const remotionRoot = process.cwd();
  const projectRoot = resolve(remotionRoot, '..');
  const canonicalClaimPath = resolve(claimPath);
  const relation = relative(projectRoot, canonicalClaimPath);
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    deny('受控渲染声明必须位于口播项目内。');
  }
  if (
    !existsSync(canonicalClaimPath) ||
    !lstatSync(canonicalClaimPath).isFile() ||
    lstatSync(canonicalClaimPath).isSymbolicLink() ||
    realpathSync(canonicalClaimPath) !== canonicalClaimPath
  ) {
    deny('受控渲染声明不存在、不是普通文件或经过符号链接。');
  }

  let claim: Record<string, unknown>;
  try {
    claim = JSON.parse(readFileSync(canonicalClaimPath, 'utf8')) as Record<string, unknown>;
  } catch {
    deny('受控渲染声明不是有效 JSON。');
  }
  if (
    claim.schema !== 'director-remotion-output-claim/v2' ||
    claim.claimId !== claimId ||
    claim.preflightIntegritySealSha256 !== preflightSha256 ||
    !['preview', 'formal'].includes(String(claim.mode)) ||
    typeof claim.output !== 'string' ||
    !isAbsolute(claim.output)
  ) {
    deny('受控渲染声明未绑定当前 claim、preflight、模式和输出。');
  }
  const outputPath = resolve(claim.output);
  const outputRelation = relative(projectRoot, outputPath);
  if (
    !outputRelation ||
    outputRelation === '..' ||
    outputRelation.startsWith(`..${sep}`) ||
    isAbsolute(outputRelation) ||
    dirname(canonicalClaimPath) !== dirname(outputPath) ||
    !process.argv.includes(outputPath)
  ) {
    deny('当前 CLI 参数没有绑定声明中的项目内输出槽。');
  }
  if (Date.now() - statSync(canonicalClaimPath).mtimeMs > 5 * 60 * 1000) {
    deny('受控渲染声明已过期，必须重新执行任务级门禁。');
  }
}
