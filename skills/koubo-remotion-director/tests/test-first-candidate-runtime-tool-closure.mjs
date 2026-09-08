#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {paperMediaTools} from '../scripts/paper-asset-intake-media.mjs';
import {readFirstCandidateInputClosure} from '../scripts/first-candidate-input-contract.mjs';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'fci-runtime-tools-')));
const outside = realpathSync(mkdtempSync(join(tmpdir(), 'fci-external-doc-')));
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const tools = paperMediaTools(['ffmpeg', 'ffprobe', 'magick', 'tesseract']);
let count = 0;
const check = body => {
  const path = join(root, 'receipt.json');
  writeFileSync(path, JSON.stringify(body));
  return readFirstCandidateInputClosure({projectRoot: root, references: [{path, sha256: hash(path)}]});
};
const rejects = (body, code) => { assert.throws(() => check(body), error => error.code === code); count++; };
try {
  const closure = check({command: {tool: tools.ffmpeg}, sourceVerification: {tools}});
  assert.equal(closure.files.filter(file => file.role === 'runtime-tool').length, 4);
  assert.equal(closure.documents.length, 1);
  assert(closure.files.some(file => file.path === tools.ffmpeg.path && file.sha256 === tools.ffmpeg.sha256)); count++;
  const externalPath = join(outside, 'not-a-tool.json');
  writeFileSync(externalPath, '{"status":"not-executed"}');
  const external = {path: externalPath, sha256: hash(externalPath)};
  rejects({source: external}, 'FCI_PATH_OUTSIDE');
  rejects({tool: external}, 'FCI_RUNTIME_TOOL_IDENTITY_MISMATCH');
  rejects({tools: {ffmpeg: external}}, 'FCI_RUNTIME_TOOL_IDENTITY_MISMATCH');
  rejects({tools: {shell: tools.ffmpeg}}, 'FCI_RUNTIME_TOOLS_CONTAINER_INVALID');
  rejects({tools: external}, 'FCI_RUNTIME_TOOLS_CONTAINER_INVALID');
  rejects({tools: {ffmpeg: tools.ffmpeg, appendixPath: external.path, appendixSha256: external.sha256}}, 'FCI_RUNTIME_TOOLS_CONTAINER_INVALID');
  rejects({tools: {ffmpeg: 'arbitrary-string'}}, 'FCI_RUNTIME_TOOLS_CONTAINER_INVALID');
  rejects({tool: {...tools.ffmpeg, unrelated: external}}, 'FCI_RUNTIME_TOOL_FIELDS_INVALID');
  rejects({tool: {...tools.ffmpeg, sha256: '0'.repeat(64)}}, 'FCI_RUNTIME_TOOL_IDENTITY_MISMATCH');
  rejects({source: tools.ffmpeg}, 'FCI_PATH_OUTSIDE');
  const copied = join(root, 'copied-ffmpeg'); copyFileSync(tools.ffmpeg.path, copied);
  rejects({tool: {path: copied, sha256: hash(copied)}}, 'FCI_RUNTIME_TOOL_IDENTITY_MISMATCH');
  const linked = join(root, 'linked-ffmpeg'); symlinkSync(tools.ffmpeg.path, linked);
  rejects({tool: {path: linked, sha256: hash(linked)}}, 'FCI_RUNTIME_TOOL_IDENTITY_MISMATCH');
  rejects({source: {path: linked, sha256: hash(linked)}}, 'FCI_PATH_SYMLINK');
  const evidence = Array.from({length: 2500}, (_, index) => {
    const path = join(root, `frame-evidence-${index}.txt`);
    writeFileSync(path, `synthetic-local-scale-check-${index}`);
    return {path, sha256: hash(path)};
  });
  assert.equal(check({evidence}).files.length, 2501); count++;
  console.log(JSON.stringify({status: 'passed', assertions: count, scope: 'local-runtime-tool-closure-only', productionEligible: false}));
} finally {
  rmSync(root, {recursive: true, force: true}); rmSync(outside, {recursive: true, force: true});
}
