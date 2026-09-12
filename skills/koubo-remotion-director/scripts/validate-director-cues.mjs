#!/usr/bin/env node

import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDirectorCuesFile} from './director-cues-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    values[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
const projectRoot = path.resolve(args['repo-root'] ?? defaultProjectRoot);
const inputPath = path.isAbsolute(args.input ?? '')
  ? path.normalize(args.input)
  : path.resolve(projectRoot, args.input ?? '');

if (!args.input || !existsSync(inputPath)) {
  console.error('DIRECTOR_CUES_INPUT_MISSING');
  process.exit(1);
}

try {
  const result = validateDirectorCuesFile({inputPath, projectRoot});
  if (!result.ok) {
    console.error(JSON.stringify(result));
    process.exit(1);
  }
  console.log(JSON.stringify({ok: true, inputPath, status: 'ready-for-user-review'}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
