#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {formatValidationText, validateDirectorContractV2} from './director-contract-v2-core.mjs';

const usage = () => {
  process.stderr.write([
    '用法：node validate-director-contract-v2.mjs <contract.json> [--root <目录>] [--json] [--no-file-check]',
    '退出码：0=合同通过；1=合同阻断；2=参数/读取错误。',
    '',
  ].join('\n'));
};

const args = process.argv.slice(2);
const contractArg = args.find((arg) => !arg.startsWith('--') && args[args.indexOf(arg) - 1] !== '--root');
const jsonOutput = args.includes('--json');
const noFileCheck = args.includes('--no-file-check');
const rootIndex = args.indexOf('--root');

if (!contractArg || (rootIndex >= 0 && !args[rootIndex + 1])) {
  usage();
  process.exit(2);
}

const contractPath = resolve(contractArg);
const rootDir = rootIndex >= 0 ? resolve(args[rootIndex + 1]) : dirname(contractPath);

let contract;
try {
  contract = JSON.parse(readFileSync(contractPath, 'utf8'));
} catch (error) {
  process.stderr.write(`[DCV2_INPUT_ERROR] ${error.message}\n`);
  process.exit(2);
}

const result = validateDirectorContractV2(contract, {rootDir, checkFiles: !noFileCheck});
if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(`${formatValidationText(result)}\n`);
}
process.exit(result.ok ? 0 : 1);
