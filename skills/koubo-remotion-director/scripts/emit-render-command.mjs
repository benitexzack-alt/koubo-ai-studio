#!/usr/bin/env node

import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {stableStringify} from './compile-director-plan.mjs';
import {
  consumeCommittedDirectorOutputPlan,
  validateDirectorOutput,
} from './validate-director-output.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), '../../..');

function invariant(condition, code, detail) {
  if (!condition) {
    const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
    error.code = code;
    throw error;
  }
}

function parseCli(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    result[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  invariant(result.plan && result.request, 'DIRECTOR_EMIT_USAGE', '--plan <json> --request <json> [--command <id>] [--repo-root <path>]');
  return result;
}

export function emitRenderCommands({plan, request, repoRoot, planPath, requestPath, commandId}) {
  const consumption = consumeCommittedDirectorOutputPlan(planPath, ({plan: committedPlan}) => {
    if (plan !== undefined) {
      invariant(
        stableStringify(plan) === stableStringify(committedPlan),
        'DIRECTOR_OUTPUT_PUBLICATION_PLAN_ARGUMENT_MISMATCH',
        planPath,
      );
    }
    validateDirectorOutput(committedPlan, {
      request,
      repoRoot,
      requestPath,
      outputPath: planPath,
    });
    invariant(
      committedPlan.executionMode === 'renderable',
      'DIRECTOR_EMIT_EXECUTION_MODE_FORBIDDEN',
      committedPlan.executionMode,
    );
    const commands = commandId
      ? committedPlan.commands.filter((command) => command.id === commandId)
      : committedPlan.commands;
    invariant(commands.length > 0, 'DIRECTOR_EMIT_COMMAND_NOT_FOUND', commandId);
    return {committedPlan, commands};
  }, {
    phase: 'emit-render-command-return',
  });
  const {committedPlan, commands} = consumption.value;
  return {
    schemaVersion: 'koubo-director-command-set/v1',
    requestId: committedPlan.requestId,
    chainSha256: committedPlan.chain.chainSha256,
    publicationState: 'committed-revalidated',
    recoveryValidationPerformed: true,
    publicationReceipt: consumption.snapshot.publicationReceipt,
    commands: commands.map((command) => ({
      id: command.id,
      cwd: command.cwd,
      argv: [...command.argv],
    })),
  };
}

async function main() {
  const args = parseCli(process.argv.slice(2));
  const repoRoot = path.resolve(args['repo-root'] ?? defaultRepoRoot);
  const planPath = path.resolve(repoRoot, args.plan);
  const requestPath = path.resolve(repoRoot, args.request);
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  const result = emitRenderCommands({
    request,
    repoRoot,
    planPath,
    requestPath,
    commandId: args.command,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error.code ?? 'DIRECTOR_EMIT_FAILED'}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
