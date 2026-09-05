#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildCardCapabilityIndex,
  sha256Bytes,
  validateCapabilityIndex,
} from './shotcraft-matcher-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libraryPath = path.join(skillRoot, 'upstream/gallery/api/library.json');
const registryPath = path.join(skillRoot, 'registry.v1.json');
const lockPath = path.join(skillRoot, 'upstream-lock.v1.json');
const outputPath = path.resolve(process.argv[2] ?? path.join(skillRoot, 'card-capability-index.v2.json'));
const libraryBytes = fs.readFileSync(libraryPath);
const registryBytes = fs.readFileSync(registryPath);
const library = JSON.parse(libraryBytes);
const registry = JSON.parse(registryBytes);
const upstreamLock = JSON.parse(fs.readFileSync(lockPath));
const lockedLibrary = upstreamLock.entries?.find((entry) => entry.path === 'upstream/gallery/api/library.json');

if (lockedLibrary?.sha256 !== sha256Bytes(libraryBytes)) {
  throw new Error('SHOTCRAFT_UPSTREAM_LIBRARY_LOCK_MISMATCH');
}

const index = buildCardCapabilityIndex({
  library,
  registry,
  libraryBinding: {
    path: 'skills/koubo-shotcraft-library/upstream/gallery/api/library.json',
    sha256: sha256Bytes(libraryBytes),
  },
  registryBinding: {
    path: 'skills/koubo-shotcraft-library/registry.v1.json',
    sha256: sha256Bytes(registryBytes),
  },
  upstreamCommit: upstreamLock.commit,
});
const errors = validateCapabilityIndex(index, library, registry);
if (errors.length) throw new Error(errors.join('\n'));
fs.writeFileSync(outputPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status: 'capability-index-valid',
  outputPath,
  outputSha256: sha256Bytes(fs.readFileSync(outputPath)),
  ...index.stats,
}, null, 2));
