#!/usr/bin/env node

import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateV9ProductionState} from './v9-workflow-state-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    values[token.slice(2)] = argv[index + 1] ?? true;
    if (values[token.slice(2)] !== true) index += 1;
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
const projectRoot = path.resolve(args['repo-root'] ?? defaultProjectRoot);
const statePath = path.resolve(projectRoot, args.state ?? '');

if (!args.state || !existsSync(statePath)) {
  console.error('V9_PRODUCTION_STATE_FILE_MISSING');
  process.exit(1);
}

try {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const result = validateV9ProductionState({
    state,
    projectRoot,
    verifyFiles: args['skip-file-check'] !== true,
  });
  console.log(JSON.stringify({statePath, ...result}, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
