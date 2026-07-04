import fs from 'node:fs/promises';
import path from 'node:path';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error('用法：node tools/prepare-elevenlabs-captions.mjs 输入转写.json 输出captions.json');
  process.exit(1);
}

const raw = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const words = Array.isArray(raw.words) ? raw.words : [];

const captions = words
  .filter((word) => word && word.type !== 'spacing' && String(word.text ?? '').trim().length > 0)
  .map((word) => {
    const startMs = Math.max(0, Math.round(Number(word.start ?? 0) * 1000));
    const endMs = Math.max(startMs + 60, Math.round(Number(word.end ?? word.start ?? 0) * 1000));
    return {
      text: String(word.text ?? ''),
      startMs,
      endMs,
      timestampMs: startMs,
      confidence: typeof word.logprob === 'number' ? Math.max(0, Math.min(1, 1 + word.logprob)) : null,
    };
  });

const replaceSequence = (items, from, to) => {
  for (let index = 0; index <= items.length - from.length; index += 1) {
    const matched = from.every((text, offset) => items[index + offset]?.text === text);
    if (!matched) {
      continue;
    }

    to.forEach((text, offset) => {
      if (items[index + offset]) {
        items[index + offset].text = text;
      }
    });
  }
};

replaceSequence(captions, ['青', '阳'], ['庆', '阳']);
replaceSequence(captions, ['等', '见', '效'], ['能', '见', '效']);

await fs.mkdir(path.dirname(outputPath), {recursive: true});
await fs.writeFile(outputPath, `${JSON.stringify(captions, null, 2)}\n`, 'utf8');
console.log(`已生成 ${captions.length} 条 Remotion captions：${outputPath}`);
