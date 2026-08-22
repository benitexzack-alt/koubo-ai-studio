#!/usr/bin/env node

import {
  loadPlanAndStyle,
  validateGeneratedVideoPlan,
} from './generated-video-plan-core.mjs';

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith('--'));
const optionValue = (name) => {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : null;
};

const planPath = positional[0];
const phase = optionValue('phase') ?? 'plan';
const explicitStylePath = optionValue('style');
const printPrompts = args.includes('--print-prompts');

if (!planPath) {
  console.error(
    '用法：node tools/validate-generated-video-plan.mjs <plan.json> ' +
      '[--phase plan|submit|materialized] [--style <style.json>] [--print-prompts]',
  );
  process.exit(1);
}

try {
  const loaded = loadPlanAndStyle(planPath, explicitStylePath);
  const result = validateGeneratedVideoPlan(loaded.plan, loaded.style, {phase});

  for (const warning of result.warnings) {
    console.warn(`警告 [${warning.code}] ${warning.message}`);
  }

  if (!result.ok) {
    console.error(`生成视频拆镜计划校验失败：phase=${phase}，${result.errors.length} 项`);
    for (const error of result.errors) {
      console.error(`- [${error.code}] ${error.message}`);
    }
    process.exit(1);
  }

  console.log(
    `生成视频拆镜计划校验通过：phase=${phase}，planId=${loaded.plan.planId}，` +
      `shots=${loaded.plan.shots.length}，style=${loaded.style.id}`,
  );
  console.log(`planSha256=${result.planSha256}`);
  console.log(`styleSha256=${result.styleSha256}`);

  if (printPrompts) {
    for (const [shotId, prompt] of Object.entries(result.compiledPrompts)) {
      console.log(`\n===== ${shotId} =====\n${prompt}`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
