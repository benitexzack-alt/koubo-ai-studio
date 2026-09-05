#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateExperienceLedger} from './experience-ledger-core.mjs';

if (!process.argv[2]) throw new Error('用法：node validate-experience-ledger.mjs <ledger.json>');
const ledgerPath = path.resolve(process.argv[2]);
const bytes = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(bytes);
const errors = validateExperienceLedger(ledger);
console.log(JSON.stringify({
  status: errors.length ? 'blocked' : 'experience-ledger-valid',
  ledgerPath,
  ledgerSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  caseCount: Array.isArray(ledger.cases) ? ledger.cases.length : 0,
  reusablePatternCount: Array.isArray(ledger.patterns) ? ledger.patterns.length : 0,
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;
