import {createHash} from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';

export const sha256Buffer = (buffer) =>
  createHash('sha256').update(buffer).digest('hex');

export const sha256File = (filePath) => sha256Buffer(readFileSync(filePath));

const toPosix = (value) => value.split(path.sep).join('/');

export function walkRegularFiles(rootPath) {
  const root = path.resolve(rootPath);
  const files = [];

  const visit = (currentPath) => {
    const entries = readdirSync(currentPath, {withFileTypes: true}).sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    );
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      const absolutePath = path.join(currentPath, entry.name);
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        const error = new Error(`DIRECTOR_SKILL_LOCK_SYMLINK_FORBIDDEN:${absolutePath}`);
        error.code = 'DIRECTOR_SKILL_LOCK_SYMLINK_FORBIDDEN';
        throw error;
      }
      if (stat.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!stat.isFile()) continue;
      files.push({
        path: toPosix(path.relative(root, absolutePath)),
        bytes: stat.size,
        sha256: sha256File(absolutePath),
      });
    }
  };

  visit(root);
  return files;
}

export function packageSha256(entries) {
  const canonical = entries
    .map((entry) => `${entry.sha256}  ${entry.path}\n`)
    .join('');
  return sha256Buffer(Buffer.from(canonical, 'utf8'));
}

export function buildSkillLock({projectRoot, profile}) {
  const skillRoot = path.resolve(projectRoot, profile.skill.path);
  if (!existsSync(skillRoot)) {
    throw new Error(`DIRECTOR_SKILL_ROOT_MISSING:${skillRoot}`);
  }
  const entries = walkRegularFiles(skillRoot);
  return {
    schemaVersion: 'koubo-director-skill-lock/v1',
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    skillRoot: profile.skill.path,
    generatedAt: new Date().toISOString(),
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    packageSha256: packageSha256(entries),
    entries,
  };
}

export function assertSkillLock({projectRoot, profile, lock}) {
  const errors = [];
  if (lock.schemaVersion !== 'koubo-director-skill-lock/v1') {
    errors.push('DIRECTOR_SKILL_LOCK_SCHEMA_INVALID');
  }
  if (lock.profileId !== profile.profileId || lock.profileVersion !== profile.profileVersion) {
    errors.push('DIRECTOR_SKILL_LOCK_PROFILE_MISMATCH');
  }
  if (lock.skillRoot !== profile.skill.path) {
    errors.push('DIRECTOR_SKILL_LOCK_ROOT_MISMATCH');
  }

  let actualEntries = [];
  try {
    actualEntries = walkRegularFiles(path.resolve(projectRoot, profile.skill.path));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const expectedByPath = new Map((lock.entries ?? []).map((entry) => [entry.path, entry]));
  const actualByPath = new Map(actualEntries.map((entry) => [entry.path, entry]));
  for (const [relativePath, expected] of expectedByPath) {
    const actual = actualByPath.get(relativePath);
    if (!actual) {
      errors.push(`DIRECTOR_SKILL_LOCK_FILE_MISSING:${relativePath}`);
      continue;
    }
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
      errors.push(`DIRECTOR_SKILL_LOCK_FILE_DRIFT:${relativePath}`);
    }
  }
  for (const relativePath of actualByPath.keys()) {
    if (!expectedByPath.has(relativePath)) {
      errors.push(`DIRECTOR_SKILL_LOCK_UNDECLARED_FILE:${relativePath}`);
    }
  }

  const actualPackageSha256 = packageSha256(actualEntries);
  if (actualPackageSha256 !== lock.packageSha256) {
    errors.push('DIRECTOR_SKILL_LOCK_PACKAGE_SHA_MISMATCH');
  }
  if (actualEntries.length !== lock.fileCount) {
    errors.push('DIRECTOR_SKILL_LOCK_FILE_COUNT_MISMATCH');
  }
  return {ok: errors.length === 0, errors, actualEntries, actualPackageSha256};
}

export function assertActiveSkillLink({projectRoot, profile, activeSkillPath}) {
  const expected = realpathSync(path.resolve(projectRoot, profile.skill.path));
  if (!existsSync(activeSkillPath)) {
    return {
      ok: false,
      error: `DIRECTOR_ACTIVE_SKILL_LINK_MISSING:${activeSkillPath}`,
      expected,
    };
  }
  const actual = realpathSync(activeSkillPath);
  return {
    ok: actual === expected,
    error: actual === expected ? null : 'DIRECTOR_ACTIVE_SKILL_LINK_TARGET_MISMATCH',
    expected,
    actual,
  };
}
