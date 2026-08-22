#!/usr/bin/env node

import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const verifier = join(projectRoot, 'tools/check-spoken-source-policy.mjs');
const tempRoot = mkdtempSync(join(tmpdir(), 'koubo-spoken-source-'));
const writeJson = (name, value) => {
  const filePath = join(tempRoot, `${name}.json`);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
};
const run = (transcript, captions, policy) =>
  spawnSync(
    process.execPath,
    [verifier, writeJson('transcript', transcript), writeJson('captions', captions), writeJson('policy', policy)],
    {cwd: projectRoot, encoding: 'utf8'},
  );
const assertPasses = (name, result) => {
  if (result.status !== 0) {
    throw new Error(`${name}本应通过：\n${result.stderr}\n${result.stdout}`);
  }
};
const assertFailsWith = (name, result, expected) => {
  const output = `${result.stderr}\n${result.stdout}`;
  if (result.status === 0) throw new Error(`${name}本应失败。`);
  if (!output.includes(expected)) {
    throw new Error(`${name}缺少预期错误“${expected}”：\n${output}`);
  }
};

const transcript = {
  words: [
    {raw_text: '豆包 Deep Sync 这些我都会用', text: '豆包DeepSeek这些我都会用'},
    {raw_text: '资料还是得我自己找表格还是得我自己填'},
    {raw_text: '客户还是得我自己回真出了问题也还是我兜着'},
  ],
};
const captions = [
  {startMs: 0, endMs: 2000, zh: '豆包、DeepSeek这些我都会用。', en: 'I can use these AI assistants.'},
  {startMs: 2000, endMs: 5000, zh: '资料还是得我自己找，表格还是得我自己填。', en: 'I still find the files and fill the sheets.'},
  {startMs: 5000, endMs: 8000, zh: '客户还是得我自己回，真出了问题也还是我兜着。', en: 'I still reply and take responsibility.'},
];
const policy = {
  schemaVersion: 1,
  canonicalSource: 'recorded-audio',
  scriptRole: 'comparison-only',
  captionTextPolicy: 'spoken-verbatim',
  englishTranslationSource: 'canonical-spoken-chinese',
  compliance: {status: 'passed'},
  verification: {
    minimumGlobalPrecision: 0.97,
    minimumGlobalCoverage: 0.95,
    corrections: [
      {
        from: 'Deep Sync',
        to: 'DeepSeek',
        type: 'proper-noun-spelling',
        evidence: '原片语境和产品名可确认。',
      },
    ],
  },
};

try {
  assertPasses('忠实实录并修正专有名词', run(transcript, captions, policy));

  const compressed = structuredClone(captions);
  compressed.splice(2, 1);
  assertFailsWith(
    '压缩实际口播',
    run(transcript, compressed, policy),
    '字幕删减、压缩或顺句了实际口播',
  );

  const restored = structuredClone(captions);
  restored[1].zh = 'AI已经把后面的工作全部完成了。';
  assertFailsWith(
    '用原稿替换实际说法',
    run(transcript, restored, policy),
    '字幕含有实录之外或恢复原稿的文字',
  );

  console.log('实录优先字幕回归通过：3/3。');
} finally {
  rmSync(tempRoot, {recursive: true, force: true});
}
