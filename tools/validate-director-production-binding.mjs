#!/usr/bin/env node

import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertDirectorProductionBinding} from './director-production-binding-core.mjs';

const [jobArgument, command = 'doctor'] = process.argv.slice(2);
if (!jobArgument) {
  console.error(
    '用法：node tools/validate-director-production-binding.mjs <production-job.json> [command]',
  );
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobPath = path.isAbsolute(jobArgument)
  ? jobArgument
  : path.resolve(projectRoot, jobArgument);

try {
  const job = JSON.parse(readFileSync(jobPath, 'utf8'));
  const result = assertDirectorProductionBinding({projectRoot, job, command});
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: error?.code ?? 'DIRECTOR_PRODUCTION_BINDING_UNEXPECTED',
        message: error instanceof Error ? error.message : String(error),
        errors: error?.errors ?? [],
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
