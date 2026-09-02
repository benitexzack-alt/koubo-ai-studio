#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertActiveSkillLink,
  assertSkillLock,
  buildSkillLock,
} from './director-skill-lock-core.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-director-lock-test-'));
try {
  const skillRoot = path.join(root, 'skills/koubo-remotion-director');
  mkdirSync(skillRoot, {recursive: true});
  writeFileSync(path.join(skillRoot, 'SKILL.md'), '# test\n');
  const profile = {
    profileId: 'paper-editorial-director-v3',
    profileVersion: '3.1.0',
    skill: {path: 'skills/koubo-remotion-director'},
  };
  const lock = buildSkillLock({projectRoot: root, profile});
  assert.equal(assertSkillLock({projectRoot: root, profile, lock}).ok, true);

  writeFileSync(path.join(skillRoot, 'SKILL.md'), '# drift\n');
  const drift = assertSkillLock({projectRoot: root, profile, lock});
  assert.equal(drift.ok, false);
  assert.ok(drift.errors.some((error) => error.includes('FILE_DRIFT')));

  writeFileSync(path.join(skillRoot, 'SKILL.md'), '# test\n');
  writeFileSync(path.join(skillRoot, 'undeclared.txt'), 'unexpected\n');
  const undeclared = assertSkillLock({projectRoot: root, profile, lock});
  assert.equal(undeclared.ok, false);
  assert.ok(undeclared.errors.some((error) => error.includes('UNDECLARED_FILE')));

  rmSync(path.join(skillRoot, 'undeclared.txt'));
  const activeRoot = path.join(root, '.codex/skills');
  mkdirSync(activeRoot, {recursive: true});
  const activePath = path.join(activeRoot, 'koubo-remotion-director');
  symlinkSync(skillRoot, activePath);
  assert.equal(
    assertActiveSkillLink({projectRoot: root, profile, activeSkillPath: activePath}).ok,
    true,
  );

  console.log(
    JSON.stringify({
      ok: true,
      lockAcceptsExactTree: true,
      driftRejected: true,
      undeclaredFileRejected: true,
      activeLinkVerified: true,
    }),
  );
} finally {
  rmSync(root, {recursive: true, force: true});
}
