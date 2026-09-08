import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const permissionPath = path.join(dir, 'permission.v1.json');
const previous = fs.readFileSync(permissionPath, 'utf8');
const permission = JSON.parse(previous);
const requirements = JSON.parse(fs.readFileSync(path.join(dir, 'audio-audit.public-assets.v1.json'), 'utf8'));
assert.equal(permission.scope.publicDir, 'remotion/public/lanzhou-services-candidate-r1');
assert.equal(permission.approvedAdditionalPublicSfx.length, 0);
assert.equal(permission.formalEnabled, false);
assert.equal(requirements.assets.length, 9);
fs.writeFileSync(path.join(dir, 'permission.before-public-binding.v1.json'), previous, {flag: 'wx'});
permission.scope.publicDir = requirements.publicDir;
permission.preservedPublicFiles = permission.preservedPublicFiles.map(item => ({...item,
  path: item.path.replace('lanzhou-services-candidate-r1/', 'lanzhou-services-candidate-r2/')}));
permission.approvedAdditionalPublicSfx = requirements.assets.map(item => ({
  path: `${requirements.publicDir}/${item.publicPath}`, sha256: item.sha256,
  confirmationQuote: permission.evidence.userQuote,
}));
fs.writeFileSync(permissionPath, JSON.stringify(permission, null, 2) + '\n');
process.stdout.write('R2 public asset binding completed; formal remains false.\n');
