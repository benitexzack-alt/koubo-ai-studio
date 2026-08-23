#!/usr/bin/env node

import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

import {
  quoteH3Shot,
  resumeH3Shot,
  runH3Shot,
} from './runninghub-generated-video-client.mjs';

let networkCalls = 0;
const forbiddenFetch = async () => {
  networkCalls += 1;
  throw new Error('冻结前不应联网');
};
const outputPath = resolve('edit/.runninghub-v1-freeze-should-not-exist.mp4');
const ledgerPath = resolve('edit/.runninghub-v1-freeze-should-not-exist.json');
const tests = [];
const test = (name, fn) => tests.push({name, fn});

const expectCode = async (promise, code) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.code, code);
    return true;
  });
};

const forgedProductionScope = {
  projectRoot: process.cwd(),
  jobPath: 'workflow/jobs/does-not-exist.json',
  entrypoint: 'tools/test-runninghub-v1-production-freeze.mjs',
};

test('quote 即使伪造 job 上下文也在联网前永久退役', async () => {
  await expectCode(
    quoteH3Shot({
      productionScope: forgedProductionScope,
      apiKey: 'not-read-before-freeze',
      shot: {id: 'G01', durationSeconds: 5},
      prompt: '不得到达请求构建',
      fetchImpl: forbiddenFetch,
    }),
    'RH_V1_RETIRED',
  );
});

test('run 即使伪造 job 上下文也在联网和写入前永久退役', async () => {
  await expectCode(
    runH3Shot({
      productionScope: forgedProductionScope,
      outputPath,
      ledgerPath,
      fetchImpl: forbiddenFetch,
    }),
    'RH_V1_RETIRED',
  );
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(ledgerPath), false);
});

test('resume 即使伪造 job 上下文也在联网和写入前永久退役', async () => {
  await expectCode(
    resumeH3Shot({
      productionScope: forgedProductionScope,
      outputPath,
      ledgerPath,
      fetchImpl: forbiddenFetch,
    }),
    'RH_V1_RETIRED',
  );
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(ledgerPath), false);
});

let passed = 0;
for (const item of tests) {
  await item.fn();
  passed += 1;
  console.log(`PASS ${item.name}`);
}
assert.equal(networkCalls, 0);
console.log(`RESULT ${passed}/${tests.length} passed; skipped=0; networkCalls=${networkCalls}`);
