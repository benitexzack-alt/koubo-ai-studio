#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const packagePath = resolve(projectRoot, 'remotion/package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const scripts = packageJson.scripts ?? {};
const rawRenderPattern = /(?:^|\s)(?:npx\s+)?remotion\s+render(?:\s|$)/u;
const controlledEntrypoint =
  '../skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs';

const rawRenderScripts = Object.entries(scripts)
  .filter(([, command]) => rawRenderPattern.test(String(command)))
  .map(([name]) => name);

assert.deepEqual(
  rawRenderScripts,
  [],
  `remotion/package.json 仍存在绕过任务级知识上下文硬门的裸渲染脚本：${rawRenderScripts.join('、')}`,
);

assert.equal(
  scripts['render:production'],
  `node ${controlledEntrypoint}`,
  '正式视频渲染必须只暴露统一受控 wrapper，由调用方传入 job 和 preview|formal。',
);

for (const [name, command] of Object.entries(scripts)) {
  if (!name.startsWith('render:')) continue;
  assert.match(
    command,
    /run-remotion-production-v2\.mjs/u,
    `视频渲染脚本 ${name} 没有经过统一受控 wrapper。`,
  );
}

const rawCliTestRoot = mkdtempSync(resolve(tmpdir(), 'koubo-raw-remotion-gate-'));
try {
  const rawCli = spawnSync(
    resolve(projectRoot, 'remotion/node_modules/.bin/remotion'),
    ['render', 'missing-entry.ts', 'MissingComposition', resolve(rawCliTestRoot, 'must-not-render.mp4')],
    {
      cwd: resolve(projectRoot, 'remotion'),
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        LANG: process.env.LANG,
      },
    },
  );
  const rawCliOutput = `${rawCli.stdout ?? ''}${rawCli.stderr ?? ''}`;
  assert.notEqual(rawCli.status, 0, '裸 Remotion CLI 不得进入渲染。');
  assert.match(
    rawCliOutput,
    /禁止裸调用 Remotion render/u,
    `裸 Remotion CLI 没有在配置初始化阶段被受控声明拦截：\n${rawCliOutput}`,
  );
} finally {
  rmSync(rawCliTestRoot, {recursive: true, force: true});
}

console.log('Remotion 正式生产入口边界回归通过。');
