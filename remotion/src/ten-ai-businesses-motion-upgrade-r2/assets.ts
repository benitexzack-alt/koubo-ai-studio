import {ASSETS, SOUND_CUES} from './plan.ts';

export const requiredAssets = (withSfx: boolean): readonly string[] => Array.from(new Set([
  ...Object.values(ASSETS),
  ...(withSfx ? Object.values(SOUND_CUES).flat().map((cue) => cue.source) : []),
]));
type AssetHead = {ok: boolean; status: number; headers: {get(name: string): string | null}};
export const assertAssetResponse = (path: string, response: AssetHead): void => {
  if (!response.ok) throw new Error(`R2必需本地素材缺失：${path}（${response.status}）`);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) throw new Error(`R2素材返回网页而非实际媒体：${path}`);
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) <= 0) throw new Error(`R2必需本地素材为空：${path}`);
};
/** 缺图、缺抠像或缺字体均阻断，不隐藏组件、不替换为图标/白底文字。 */
export const validateAssets = async (
  withSfx: boolean,
  resolveAsset: (path: string) => string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  await Promise.all(requiredAssets(withSfx).map(async (path) => {
    const response = await fetch(resolveAsset(path), {method: 'HEAD', signal: abortSignal});
    assertAssetResponse(path, response);
  }));
};
