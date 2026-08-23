import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {findRetiredGeneratedStyleContentHashes} from './generated-style-policy.mjs';

const makeDocuments = (root, count) => {
  const documents = [];
  for (let index = 0; index < count; index += 1) {
    const documentPath = path.join(root, `${String(index).padStart(3, '0')}.json`);
    writeFileSync(documentPath, JSON.stringify({index}));
    documents.push(documentPath);
  }
  return documents;
};

test('恰好 512 个受控文件可完整扫描', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'retired-style-512-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const documentPaths = makeDocuments(root, 512);

  const hits = findRetiredGeneratedStyleContentHashes({}, {
    projectRoot: root,
    documentPaths,
  });

  assert.deepEqual(hits, []);
});

test('第 513 个候选不会被静默跳过，扫描按失败关闭', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'retired-style-513-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const documentPaths = makeDocuments(root, 513);

  assert.throws(
    () => findRetiredGeneratedStyleContentHashes({}, {
      projectRoot: root,
      documentPaths,
    }),
    (error) => {
      assert.equal(error.code, 'RETIRED_GENERATED_STYLE_SCAN_LIMIT');
      assert.equal(error.inspectedFileCount, 512);
      assert.equal(error.pendingCandidateCount, 1);
      return true;
    },
  );
});
