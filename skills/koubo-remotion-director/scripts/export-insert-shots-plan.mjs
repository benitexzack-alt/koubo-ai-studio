#!/usr/bin/env node

import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportInsertShotsPlan, parseInsertShotsArgs} from './insert-shots-plan-core.mjs';

try {
  const args = parseInsertShotsArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args['repo-root'] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'));
  const result = exportInsertShotsPlan({inputPath: path.resolve(repoRoot, args.input), repoRoot});
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({ok: false, validationScope: 'structure-only', error: error.message, errors: error.validation?.errors}));
  process.exitCode = 1;
}
