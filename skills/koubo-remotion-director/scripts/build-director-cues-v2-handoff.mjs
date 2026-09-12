#!/usr/bin/env node

import {buildDirectorCuesV2Handoff} from './director-cues-v2-handoff-core.mjs';

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`DIRECTOR_V2_HANDOFF_UNKNOWN_ARGUMENT:${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`DIRECTOR_V2_HANDOFF_ARGUMENT_VALUE_MISSING:${name}`);
    values[name] = value;
    index += 1;
  }
  return values;
}

try {
  const args = parseArgs(process.argv.slice(2));
  for (const required of ['project-root', 'cues', 'approval', 'profile', 'output-dir']) {
    if (!args[required]) throw new Error(`DIRECTOR_V2_HANDOFF_ARGUMENT_REQUIRED:${required}`);
  }
  const result = buildDirectorCuesV2Handoff({
    projectRoot: args['project-root'],
    cues: args.cues,
    approval: args.approval,
    profile: args.profile,
    outputDir: args['output-dir'],
  });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
