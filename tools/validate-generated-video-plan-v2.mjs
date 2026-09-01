#!/usr/bin/env node

import {
  validateGeneratedVideoPlanV2,
} from './generated-video-plan-v2-core.mjs';
import {
  compileRunningHubH3V2Shot,
} from './runninghub-generated-video-v2-adapter.mjs';

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith('--'));
const optionValue = (name) => {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : null;
};

const planPath = positional[0];
const stylePath = optionValue('style');
const phase = optionValue('phase') ?? 'offline-compile';
const allowedPhases = new Set(['offline-compile', 'sample-network-ready', 'production-network-ready']);

if (!planPath || !allowedPhases.has(phase)) {
  console.error(
    '用法：node tools/validate-generated-video-plan-v2.mjs <plan.json> ' +
      '[--style <style.json>] ' +
      '[--phase offline-compile|sample-network-ready|production-network-ready]',
  );
  process.exit(1);
}

const result = validateGeneratedVideoPlanV2(planPath, {
  stylePath,
  requiredOperationMode:
    phase === 'sample-network-ready'
      ? 'style-sample'
      : phase === 'production-network-ready'
        ? 'production'
        : null,
});

if (!result.ok) {
  console.error(`generated-video-plan/v2 校验失败：phase=${phase}`);
  for (const error of result.errors) {
    console.error(`- [${error.code}] ${error.message}`);
  }
  process.exit(1);
}

const compilations = result.context.plan.shots.map((shot) =>
  compileRunningHubH3V2Shot({context: result.context, shotId: shot.id}),
);

console.log(
  `generated-video-plan/v2 校验通过：phase=${phase}，` +
    `planId=${result.context.plan.planId}，shots=${compilations.length}`,
);
console.log(`planDefinitionSha256=${result.context.planDefinitionSha256}`);
console.log(`styleSha256=${result.context.styleSha256}`);
for (const compilation of compilations) {
  console.log(
    `${compilation.shot.id}: stillSha256=` +
      `${result.context.shotEvidence.get(compilation.shot.id).still.sha256}, ` +
      `payloadSha256=${compilation.payloadSha256}, ` +
      `requestDefinitionSha256=${compilation.requestDefinitionSha256}`,
  );
}
