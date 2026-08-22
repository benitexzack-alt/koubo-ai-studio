#!/usr/bin/env node

import fs from 'node:fs';

const [transcriptPath, captionsPath, policyPath] = process.argv.slice(2);

if (!transcriptPath || !captionsPath || !policyPath) {
  console.error(
    '用法：node tools/check-spoken-source-policy.mjs <实录转写.json> <双语字幕.json> <spoken-source-policy.json>',
  );
  process.exit(1);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const transcript = readJson(transcriptPath);
const captionDocument = readJson(captionsPath);
const policy = readJson(policyPath);
const captions = Array.isArray(captionDocument)
  ? captionDocument
  : captionDocument.captions;

const errors = [];
const expectedContract = {
  canonicalSource: 'recorded-audio',
  scriptRole: 'comparison-only',
  captionTextPolicy: 'spoken-verbatim',
  englishTranslationSource: 'canonical-spoken-chinese',
};

if (policy.schemaVersion !== 1) {
  errors.push('实录来源策略必须使用 schemaVersion=1。');
}
for (const [key, value] of Object.entries(expectedContract)) {
  if (policy[key] !== value) {
    errors.push(`实录来源策略 ${key} 必须为 ${value}。`);
  }
}
if (policy.compliance?.status !== 'passed') {
  errors.push('只有 compliance.status=passed 的新片可以运行严格实录校验。');
}
if (!Array.isArray(captions) || captions.length === 0) {
  errors.push('双语字幕中没有可用字幕页。');
}

const words = Array.isArray(transcript.words)
  ? transcript.words.filter((word) => String(word?.text ?? word?.raw_text ?? '').trim())
  : [];
if (words.length === 0) {
  errors.push('实录转写中没有可用 words 数组。');
}

const allowedCorrectionTypes = new Set([
  'proper-noun-spelling',
  'unmistakable-asr-error',
]);
const corrections = policy.verification?.corrections ?? [];
for (const [index, correction] of corrections.entries()) {
  if (
    typeof correction?.from !== 'string' ||
    !correction.from ||
    typeof correction?.to !== 'string' ||
    !correction.to
  ) {
    errors.push(`第 ${index + 1} 项 ASR 修正缺少 from 或 to。`);
  }
  if (!allowedCorrectionTypes.has(correction?.type)) {
    errors.push(`第 ${index + 1} 项 ASR 修正类型不允许：${correction?.type ?? ''}`);
  }
  if (typeof correction?.evidence !== 'string' || !correction.evidence.trim()) {
    errors.push(`第 ${index + 1} 项 ASR 修正缺少音频或上下文依据。`);
  }
}

if (errors.length > 0) {
  console.error(`实录来源策略校验失败：${errors.length} 项`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const applyCorrections = (value) => {
  let result = String(value ?? '');
  for (const correction of corrections) {
    result = result.replaceAll(correction.from, correction.to);
  }
  return result;
};

const punctuation = /[\s，。？！、：；,.?!:;"“”'‘’（）()《》【】\[\]·—–-]/g;
const normalize = (value) =>
  String(value ?? '').replace(punctuation, '').toLowerCase();

const lcsLength = (leftValue, rightValue) => {
  const left = [...normalize(leftValue)];
  const right = [...normalize(rightValue)];
  const row = new Uint32Array(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    let previous = 0;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] =
        left[i - 1] === right[j - 1]
          ? previous + 1
          : Math.max(row[j], row[j - 1]);
      previous = current;
    }
  }
  return row[right.length];
};

const canonicalSegments = words.map((word) => {
  const source =
    word.verbatim_text ??
    word.raw_text ??
    word.text ??
    '';
  return applyCorrections(source);
});
const audioText = canonicalSegments.join('');
const captionText = captions.map((caption) => caption.zh ?? '').join('');
const matched = lcsLength(audioText, captionText);
const audioLength = [...normalize(audioText)].length;
const captionLength = [...normalize(captionText)].length;
const precision = captionLength === 0 ? 0 : matched / captionLength;
const coverage = audioLength === 0 ? 0 : matched / audioLength;
const minimumPrecision = Number(
  policy.verification?.minimumGlobalPrecision ?? 0.97,
);
const minimumCoverage = Number(
  policy.verification?.minimumGlobalCoverage ?? 0.95,
);

if (precision < minimumPrecision) {
  errors.push(
    `字幕含有实录之外或恢复原稿的文字：全局精确度 ${precision.toFixed(3)} < ${minimumPrecision.toFixed(3)}。`,
  );
}
if (coverage < minimumCoverage) {
  errors.push(
    `字幕删减、压缩或顺句了实际口播：全局覆盖度 ${coverage.toFixed(3)} < ${minimumCoverage.toFixed(3)}。`,
  );
}
if (captions.some((caption) => !String(caption.zh ?? '').trim())) {
  errors.push('存在空白中文字幕页。');
}
if (captions.some((caption) => !String(caption.en ?? '').trim())) {
  errors.push('存在空白英文辅助字幕页。');
}

console.log(
  `实录字符=${audioLength} 字幕字符=${captionLength} 匹配=${matched} 精确度=${precision.toFixed(3)} 覆盖度=${coverage.toFixed(3)} ASR修正=${corrections.length}`,
);

if (errors.length > 0) {
  console.error(`实录逐字保真校验失败：${errors.length} 项`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('实录逐字保真校验通过：录音为正文，文稿仅作核对。');
