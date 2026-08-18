import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const dataDir = path.join(root, 'remotion/public/data');
const pages = JSON.parse(fs.readFileSync(path.join(dataDir, 'ordinary_ai_aigc_20260818.bilingual.v1.json'), 'utf8'));
const words = JSON.parse(fs.readFileSync(path.join(dataDir, 'ordinary_ai_aigc_20260818.captions.v1.json'), 'utf8'));
const outputPath = path.join(dataDir, 'ordinary_ai_aigc_20260818.bilingual.v2.json');

const isContent = (char) => /[\p{L}\p{N}]/u.test(char);
const zhBreak = /[，。？！；：、,.!?;:]/u;

const contentLength = (text) => [...text].filter(isContent).length;

function splitChinese(text, maxContent = 22) {
  const chars = [...text];
  const chunks = [];
  let current = '';
  let count = 0;

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
    count = 0;
  };

  for (const char of chars) {
    if (zhBreak.test(char) && !current && chunks.length) {
      chunks[chunks.length - 1] += char;
      continue;
    }
    current += char;
    if (isContent(char)) count += 1;
    if (zhBreak.test(char) && count >= 8) {
      push();
    } else if (count >= maxContent) {
      push();
    }
  }
  push();
  return chunks;
}

function splitEnglish(text, targetCount) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return Array.from({length: targetCount}, () => '');
  if (targetCount <= 1) return [text.trim()];

  const clauses = text.match(/[^.!?;:]+[.!?;:]?/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
  if (clauses.length === targetCount) return clauses;
  if (clauses.length > targetCount) {
    const merged = [];
    let cursor = 0;
    for (let index = 0; index < targetCount; index += 1) {
      const remainingGroups = targetCount - index;
      const remainingClauses = clauses.length - cursor;
      const take = index === targetCount - 1
        ? remainingClauses
        : Math.max(1, Math.round(remainingClauses / remainingGroups));
      merged.push(clauses.slice(cursor, cursor + take).join(' '));
      cursor += take;
    }
    return merged;
  }

  const result = [];
  let cursor = 0;
  for (let index = 0; index < targetCount; index += 1) {
    const remainingGroups = targetCount - index;
    const remainingWords = words.length - cursor;
    const take = index === targetCount - 1
      ? remainingWords
      : Math.max(1, Math.round(remainingWords / remainingGroups));
    result.push(words.slice(cursor, cursor + take).join(' '));
    cursor += take;
  }
  return result;
}

function makeChunkTiming(zh, pageWordOffset) {
  const count = contentLength(zh);
  return {
    firstContentIndex: pageWordOffset,
    lastContentIndex: pageWordOffset + count - 1,
  };
}

const output = [];
let pageWordOffset = 0;

for (const page of pages) {
  const zhChunks = splitChinese(page.zh);
  const enChunks = splitEnglish(page.en, zhChunks.length);
  const pageContentCount = contentLength(page.zh);
  let chunkWordOffset = pageWordOffset;

  for (let index = 0; index < zhChunks.length; index += 1) {
    const zh = zhChunks[index];
    const timing = makeChunkTiming(zh, chunkWordOffset);
    const startWord = words[timing.firstContentIndex];
    const endWord = words[timing.lastContentIndex];
    if (!startWord || !endWord) {
      throw new Error(`字幕词级映射失败：${zh}`);
    }
    output.push({
      startMs: startWord.startMs,
      endMs: endWord.endMs,
      zh,
      en: enChunks[index] || page.en,
      highlights: (page.highlights || []).filter((item) => zh.includes(item)),
    });
    chunkWordOffset += contentLength(zh);
  }
  pageWordOffset += pageContentCount;
}

if (pageWordOffset !== words.length) {
  throw new Error(`字幕总字数不一致：页面 ${pageWordOffset}，词级 ${words.length}`);
}

for (let index = 1; index < output.length; index += 1) {
  if (output[index].startMs < output[index - 1].startMs) {
    throw new Error(`字幕时间倒序：第 ${index} 段`);
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({output: path.relative(root, outputPath), pages: pages.length, chunks: output.length, mappedWords: pageWordOffset}, null, 2));
