#!/usr/bin/env node

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  compilePostshootRebindPlan,
  validatePostshootRebindRequest,
} from './postshoot-rebind-core.mjs';
import {resolveDeclared, sha256File} from './preproduction-director-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');
const values = {};
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token.startsWith('--')) continue;
  values[token.slice(2)] = process.argv[index + 1];
  index += 1;
}

const projectRoot = path.resolve(values['repo-root'] ?? defaultProjectRoot);
const requestPath = resolveDeclared(projectRoot, values.request);
if (!requestPath || !existsSync(requestPath)) {
  console.error('POSTSHOOT_REQUEST_FILE_MISSING');
  process.exit(1);
}

try {
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  const validation = validatePostshootRebindRequest({request, projectRoot});
  if (!validation.ok) {
    throw new Error(`POSTSHOOT_REQUEST_INVALID:${validation.errors.join('|')}`);
  }
  const outputPath = resolveDeclared(projectRoot, request.outputs.rebindPlanPath);
  if (existsSync(outputPath)) throw new Error(`POSTSHOOT_OUTPUT_ALREADY_EXISTS:${outputPath}`);
  const plan = compilePostshootRebindPlan({request, requestPath, validation});
  mkdirSync(path.dirname(outputPath), {recursive: true});
  writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      ok: true,
      outputPath,
      sha256: sha256File(outputPath),
      beatCount: plan.beats.length,
      formalEligible: false,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
