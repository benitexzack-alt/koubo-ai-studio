#!/usr/bin/env node

import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSkillLock} from './director-skill-lock-core.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.resolve(projectRoot, 'workflow/active-director-profile.v1.json');
const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
const outputPath = path.resolve(projectRoot, profile.skill.lockPath);
const lock = buildSkillLock({projectRoot, profile});

writeFileSync(outputPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify({
    ok: true,
    outputPath,
    fileCount: lock.fileCount,
    totalBytes: lock.totalBytes,
    packageSha256: lock.packageSha256,
  }),
);
