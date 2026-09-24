#!/usr/bin/env node

import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePaperBaselineProfile} from './validate-active-director-profile.mjs';
import {sha256File} from './director-skill-lock-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = JSON.parse(readFileSync(path.join(root, 'workflow/active-director-profile.v1.json'), 'utf8'));
const style = JSON.parse(readFileSync(path.join(root, profile.paperQualityBaseline.path), 'utf8'));
const hashes = new Map();
const verifyFile = (declared, expected) => {
  const target = path.resolve(root, declared);
  if (!existsSync(target)) return false;
  if (!hashes.has(target)) hashes.set(target, sha256File(target));
  return hashes.get(target) === expected;
};
const validate = (p, s) => validatePaperBaselineProfile(p, s, verifyFile);
assert.deepEqual(validate(profile, style), [], '实际基线和参考视频哈希应通过');

const negativeCases = [
  ['撤掉最低基准', (p) => {p.paperQualityBaseline.requiredForNewPaper = false;}],
  ['恢复全静止字牌', (p) => {p.paperMotionPolicy.allLabelsStaticDefaultForbidden = false;}],
  ['中文字脱离物件', (p) => {p.paperMotionPolicy.textFollowsOwnerMotionRequired = false;}],
  ['禁止相关动作链', (p) => {p.paperMotionPolicy.relatedActionChainAllowed = false;}],
  ['图生视频改回本地烘字', (p) => {p.promptHandoffPolicy.defaultPaperTextMode = 'first-frame-baked';}],
  ['误入旧桥接', (p) => {p.promptHandoffPolicy.paperRouteLegacyBridgeAllowed = true;}],
  ['一律静音', (p) => {p.paperNativeAudioPolicy.blanketMuteForbidden = false;}],
  ['历史增益当全局常数', (p) => {p.paperNativeAudioPolicy.fixedHistoricalGainIsUniversal = true;}],
  ['取消实际试听', (p) => {p.paperNativeAudioPolicy.normalSpeedListeningRequired = false;}],
  ['风格静止文字回退', (_p, s) => {s.textContract.textMovesWithCarrier = false;}],
  ['风格一律静音回退', (_p, s) => {s.audioContract.blanketMuteAllowed = true;}],
  ['取消动态人审', (_p, s) => {s.generatedAssetContract.userAcceptanceRequired = false;}],
  ['历史风格继承冲突', (_p, s) => {s.inherits = {path: 'old.json'};}],
  ['参考片哈希不符', (_p, s) => {s.referenceClips[0].sha256 = '0'.repeat(64);}],
  ['正式参考片哈希不符', (_p, s) => {s.acceptedDynamicAnchor.sha256 = '0'.repeat(64);}],
  ['缺少原始参考视频', (_p, s) => {s.referenceClips = [];}],
  ['错误参考视频结构', (_p, s) => {s.referenceClips = {};}],
];
for (const [name, mutate] of negativeCases) {
  const candidateProfile = structuredClone(profile);
  const candidateStyle = structuredClone(style);
  mutate(candidateProfile, candidateStyle);
  assert.ok(validate(candidateProfile, candidateStyle).length > 0, `必须拒绝：${name}`);
}
console.log(`纸艺活动基准：实际资产哈希正例通过，${negativeCases.length} 项退化负例全部被拒绝。`);
