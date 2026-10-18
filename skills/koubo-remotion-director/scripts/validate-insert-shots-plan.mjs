#!/usr/bin/env node

import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseInsertShotsArgs, validateInsertShotsPlanFile} from './insert-shots-plan-core.mjs';

try {
  const args = parseInsertShotsArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args['repo-root'] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'));
  const result = validateInsertShotsPlanFile({inputPath: path.resolve(repoRoot, args.input)});
  const {plan, source, ...receipt} = result;
  console.log(JSON.stringify({...receipt, shotCount: plan?.shots?.length ?? null}));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ok: false, validationScope: 'structure-only', error: error.message}));
  process.exitCode = 1;
}
