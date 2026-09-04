import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(skillRoot, 'registry.v1.json')));
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const norm = (text) => String(text).replace(/[\p{P}\p{Z}\s]/gu, '');
const validRect = (r) => r && ['x','y','width','height'].every((k) => Number.isFinite(r[k])) && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0;
const inside = (a,b) => a.x >= b.x && a.y >= b.y && a.x+a.width <= b.x+b.width && a.y+a.height <= b.y+b.height;
const intersects = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;

export function validatePlan(plan, captions) {
  const errors = [];
  const fail = (code, id = '') => errors.push(`${code}${id ? `:${id}` : ''}`);
  if (plan.schemaVersion !== 'shotcraft-candidate/v1') fail('SCHEMA');
  if (plan.status !== 'candidate-preview-required' || plan.formalEnabled !== false || plan.productionEligible !== false) fail('CANDIDATE_ONLY');
  if (plan.subtitleAuthority !== 'actual-recording') fail('SPOKEN_SOURCE_REQUIRED');
  if (!Array.isArray(captions) || captions.some((x) => !Number.isFinite(x.startMs) || !Number.isFinite(x.endMs) || x.startMs<0 || x.endMs<=x.startMs || typeof x.zh !== 'string')) return ['CAPTIONS_INVALID'];
  const {width,height,fps,durationInFrames,sourceStartFrame} = plan;
  if (![width,height,fps,durationInFrames].every((x)=>Number.isInteger(x)&&x>0) || !Number.isInteger(sourceStartFrame) || sourceStartFrame<0) return ['TIMING_INVALID'];
  if (durationInFrames/fps<30 || durationInFrames/fps>45) fail('SAMPLE_DURATION');
  const canvas = {x:0,y:0,width,height};
  if (!Array.isArray(plan.effects) || !plan.effects.length) return ['EFFECTS_REQUIRED'];
  const ids = new Set();
  for (const e of plan.effects) {
    if (!e.id || ids.has(e.id)) fail('DUPLICATE_EVENT',e.id); ids.add(e.id);
    const adapter = registry.effects.find((x)=>x.id === e.effectId);
    if (!adapter) { fail('UNKNOWN_EFFECT',e.id); continue; }
    if (!adapter.contexts.includes(e.mainVisual)) fail('MAIN_VISUAL_FORBIDDEN',e.id);
    if (!Number.isInteger(e.from) || !Number.isInteger(e.duration) || e.from<0 || e.duration<1 || e.from+e.duration>durationInFrames) fail('EVENT_TIMING',e.id);
    if (!validRect(e.region) || !inside(e.region,canvas)) {fail('REGION_INVALID',e.id); continue;}
    if (!Array.isArray(e.protectedRegions) || e.protectedRegions.length < 2 || e.protectedRegions.some((r)=>!validRect(r)||!inside(r,canvas))) fail('PROTECTED_REGIONS_REQUIRED',e.id);
    else if (e.protectedRegions.some((r)=>intersects(e.region,r))) fail('OCCLUSION',e.id);
    if (!e.purpose?.trim()) fail('PURPOSE_REQUIRED',e.id);
    const start = (sourceStartFrame+e.from)/fps*1000;
    const end = (sourceStartFrame+e.from+e.duration)/fps*1000;
    const spoken = norm(captions.filter((c)=>c.startMs<end && c.endMs>start).map((c)=>c.zh).join(''));
    if (!e.quote || !norm(e.quote) || !spoken.includes(norm(e.quote))) fail('QUOTE_NOT_IN_WINDOW',e.id);
    if (!Array.isArray(e.texts) || !e.texts.length || e.texts.some((t)=>!norm(t)||!spoken.includes(norm(t)))) fail('TEXT_NOT_SPOKEN',e.id);
    if (e.effectId === 'evidence-scan' && (!e.evidence?.assetId || !validRect(e.evidence.rect) || !inside(e.evidence.rect,{x:0,y:0,width:e.region.width,height:e.region.height}))) fail('EVIDENCE_REQUIRED',e.id);
    if (e.loop || e.freezeToFill || e.remoteUrl) fail('MEDIA_MANIPULATION_FORBIDDEN',e.id);
  }
  // Sum of bounding boxes is deliberately conservative for overlapping overlays.
  for (const at of new Set(plan.effects.flatMap((e)=>[e.from,e.from+e.duration-1]))) {
    const area = plan.effects.filter((e)=>e.from<=at && e.from+e.duration>at && validRect(e.region)).reduce((sum,e)=>sum+e.region.width*e.region.height,0);
    if (area/(width*height)>.42) {fail('COVERAGE_EXCEEDED');break;}
  }
  return errors;
}

export function validateFiles(plan, repoRoot) {
  const resolvedRoot = fs.realpathSync(repoRoot);
  const readBinding = (binding) => {
    if (!binding?.path || path.isAbsolute(binding.path) || !/^[a-f0-9]{64}$/.test(binding.sha256)) throw new Error('ASSET_BINDING_INVALID');
    const absolute = fs.realpathSync(path.resolve(resolvedRoot,binding.path));
    if (!absolute.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('ASSET_OUTSIDE_REPO');
    const bytes = fs.readFileSync(absolute);
    if (sha(bytes)!==binding.sha256) throw new Error(`ASSET_HASH_MISMATCH:${binding.path}`);
    return bytes;
  };
  readBinding(plan.source);
  const captions = JSON.parse(readBinding(plan.captions));
  for (const binding of Object.values(plan.assets ?? {})) readBinding(binding);
  const errors = validatePlan(plan,captions);
  for (const e of plan.effects ?? []) if (e.evidence?.assetId && (!Object.hasOwn(plan.assets ?? {},e.evidence.assetId) || !plan.assets[e.evidence.assetId]?.path)) errors.push(`UNKNOWN_EVIDENCE:${e.id}`);
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const planPath = path.resolve(process.argv[2]);
    const plan = JSON.parse(fs.readFileSync(planPath));
    const errors = validateFiles(plan,path.resolve(process.argv[3] ?? '.'));
    console.log(JSON.stringify({status:errors.length?'blocked':'candidate-contract-valid', planSha256:sha(fs.readFileSync(planPath)), errors, formalEnabled:false},null,2));
    if (errors.length) process.exitCode=1;
  } catch(error) {console.error(error.message); process.exitCode=1;}
}
