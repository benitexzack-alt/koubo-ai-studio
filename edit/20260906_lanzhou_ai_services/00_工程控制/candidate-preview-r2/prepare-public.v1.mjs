import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT, CONTROL, PUBLIC, PERMISSION, EPISODE, REVISION, checked, relativePath, absent, ensure, readJson, hashFile, digest,
  validatePermission, validatePreservedInputs} from './runner-core.mjs';

const R1_PUBLIC = 'remotion/public/lanzhou-services-candidate-r1';
const R1_MANIFEST = `edit/${EPISODE}/00_工程控制/candidate-preview-r1/public-assets.v1.json`;
const REQUIREMENTS = `${CONTROL}/audio-audit.public-assets.v1.json`;
const MANIFEST = `${CONTROL}/public-assets.v1.json`;
const library = 'remotion/public/audio/koubo-sfx-v8/';

export function buildMappings(r1, requirements) {
  ensure(r1.publicDir === R1_PUBLIC && r1.bindings?.length === 13, 'R1_PUBLIC_BASELINE_INVALID');
  ensure(requirements.schemaVersion === 'lanzhou-r2-sfx-public-requirements/v1'
    && requirements.publicDir === PUBLIC && requirements.assets?.length === 9 && requirements.formalEnabled === false, 'R2_SFX_REQUIREMENTS_INVALID');
  const old = r1.bindings.map(b => {
    ensure(b.publicPath.startsWith(`${R1_PUBLIC}/`), 'R1_PUBLIC_PATH_INVALID');
    const name = relativePath(b.publicPath.slice(R1_PUBLIC.length + 1));
    return {source: b.publicPath, publicPath: `${PUBLIC}/${name}`, sha256: b.sha256, bytes: b.bytes, sourceGroup: 'r1-preserved'};
  });
  const added = requirements.assets.map(a => {
    const source = relativePath(path.relative(ROOT, a.sourcePath));
    ensure(source.startsWith(library) && /^sfx\/[A-Za-z0-9_-]+\.wav$/u.test(a.publicPath)
      && a.targetPath === path.join(ROOT, PUBLIC, a.publicPath)
      && a.copyOrLinkRequested === true && a.newGenerationRequested === false, 'SFX_PATH_OR_SCOPE_INVALID');
    return {id: a.id, source, publicPath: `${PUBLIC}/${a.publicPath}`, sha256: a.sha256, bytes: a.bytes, sourceGroup: 'r2-approved-sfx',
      licenseHistory: {label: a.license, reference: a.licenseReference, sha256: a.licenseReferenceSha256},
      sourceManifest: {path: a.manifestPath, sha256: a.manifestSha256}};
  });
  const mappings = [...old, ...added];
  ensure(new Set(mappings.map(b => b.publicPath)).size === 22 && new Set(added.map(b => b.id)).size === 9, 'PUBLIC_TARGET_DUPLICATE');
  return mappings;
}

export function preparePublic() {
  absent(ROOT, PUBLIC); absent(ROOT, MANIFEST);
  const permission = readJson(checked(ROOT, PERMISSION));
  validatePermission(permission, {episodeId: EPISODE, revisionId: REVISION}, 'preflight');
  const r1 = readJson(checked(ROOT, R1_MANIFEST));
  const requirements = readJson(checked(ROOT, REQUIREMENTS));
  const mappings = buildMappings(r1, requirements);
  const before = new Map();
  for (const b of mappings) {
    const source = checked(ROOT, b.source);
    ensure(hashFile(source) === b.sha256 && fs.statSync(source).size === b.bytes, 'SOURCE_ASSET_DRIFT', b.source);
    before.set(b.source, b.sha256);
    for (const r of [b.licenseHistory, b.sourceManifest].filter(Boolean)) {
      ensure(hashFile(checked(ROOT, relativePath(path.relative(ROOT, r.reference ?? r.path)))) === r.sha256, 'SOURCE_MANIFEST_DRIFT');
    }
  }
  const byPath = new Map(mappings.map(b => [b.publicPath, b.sha256]));
  for (const b of permission.preservedInputs) byPath.set(b.path, hashFile(checked(ROOT, b.path)));
  validatePreservedInputs(permission, byPath, mappings.map(b => b.publicPath));
  fs.mkdirSync(checked(ROOT, PUBLIC, true));
  for (const b of mappings) {
    const target = checked(ROOT, b.publicPath, true);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.linkSync(checked(ROOT, b.source), target);
    const from = fs.statSync(path.join(ROOT, b.source)), to = fs.lstatSync(target);
    ensure(to.isFile() && !to.isSymbolicLink() && from.ino === to.ino && from.dev === to.dev, 'HARDLINK_VERIFICATION_FAILED');
  }
  for (const b of mappings) ensure(hashFile(checked(ROOT, b.source)) === before.get(b.source)
    && hashFile(checked(ROOT, b.publicPath)) === b.sha256, 'SOURCE_OR_LINK_DRIFT');
  // Cue timings may still change; only the approved asset set is frozen here.
  ensure(digest(buildMappings(readJson(checked(ROOT, R1_MANIFEST)), readJson(checked(ROOT, REQUIREMENTS)))) === digest(mappings), 'ASSET_SET_DRIFT');
  const manifest = {schemaVersion: 'lanzhou-candidate-public-assets/v1', publicDir: PUBLIC, localOnly: true,
    sourceContentUnchanged: true, originalsModified: false, hardlinkMetadataNote: 'Hardlink creation changes inode link counts, never source bytes.',
    materialSetSha256: digest(mappings), requirementsPath: REQUIREMENTS, finalCueTimingNotCaptured: true,
    sourceFileCount: 22, preservedR1Count: 13, newSfxCount: 9,
    bindings: mappings.map(b => ({...b, method: 'same-file-hardlink-not-symlink'})), formalEnabled: false};
  fs.writeFileSync(checked(ROOT, MANIFEST, true), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  return {publicDir: PUBLIC, manifest: MANIFEST, manifestSha256: hashFile(checked(ROOT, MANIFEST)), count: 22,
    r1SourceBytesUnchanged: true, finalSnapshotCaptured: false, formalEnabled: false};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensure(process.argv.length === 3 && process.argv[2] === '--link', 'EXPLICIT_LINK_COMMAND_REQUIRED');
  process.stdout.write(JSON.stringify(preparePublic(), null, 2) + '\n');
}
