#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../remotion/node_modules/esbuild/lib/main.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const fixtures = [
  {
    label: '训练营 V8',
    entry: 'remotion/src/TrainingCampV80Talk16x9.tsx',
  },
  {
    label: 'AI 认知位置 V8',
    entry: 'remotion/src/AICognitivePositionV80Talk16x9.tsx',
  },
  {
    label: '训练营第二集 V8',
    entry: 'remotion/src/TrainingCampEpisode2V80Talk16x9.tsx',
  },
];

const generatedSrc =
  'media/generated-route-test/generated-video/paper-construct-v1/G01.mp4';
const generatedLayer = {
  id: 'generated-route-test-G01',
  start: 12,
  end: 18,
  title: '纸构推演镜头',
  detail: '用纸板的物理动作表达因果关系。',
  items: [],
  params: {
    component: 'generated-media',
    src: generatedSrc,
    disclosure: 'AI生成·概念演绎',
    badge: '非真实业务证据',
  },
};

const tempRoot = mkdtempSync(path.join(tmpdir(), 'koubo-v8-generated-route-'));

try {
  for (const [index, fixture] of fixtures.entries()) {
    const outfile = path.join(tempRoot, `route-${index}.mjs`);
    await build({
      entryPoints: [path.join(projectRoot, fixture.entry)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'silent',
    });

    const moduleUrl = `${pathToFileURL(outfile).href}?case=${index}`;
    const composition = await import(moduleUrl);
    const rendered = composition.renderCustomScene({
      id: generatedLayer.id,
      start: generatedLayer.start,
      end: generatedLayer.end,
      kind: 'custom',
      customKey: 'generated-media',
      data: generatedLayer,
      background: 'opaque',
    });

    assert.ok(rendered, `${fixture.label} 应返回 generated-media 组件`);
    assert.equal(
      rendered.type?.name,
      'V8MediaStage',
      `${fixture.label} 不得回退到 V8DirectStatement`,
    );
    assert.equal(
      rendered.props.layer.params.src,
      generatedSrc,
      `${fixture.label} 必须将已物化的 Gxx.mp4 传入 V8MediaStage`,
    );
  }

  console.log(
    `V8 generated-media 路由测试通过：${fixtures.length}/${fixtures.length}`,
  );
} finally {
  rmSync(tempRoot, {recursive: true, force: true});
}
