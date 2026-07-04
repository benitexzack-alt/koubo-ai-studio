import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const inputPath = args[0];
const outputPath = args[1];
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'chi_sim+eng';
const psm = args.includes('--psm') ? args[args.indexOf('--psm') + 1] : '11';

if (!inputPath || !outputPath) {
  console.error('用法：node tools/ocr-image.mjs 输入图片 输出.json [--lang chi_sim+eng] [--psm 11]');
  process.exit(1);
}

const parseTsv = (tsv) => {
  const lines = tsv.trim().split(/\r?\n/);
  const header = lines.shift()?.split('\t') ?? [];
  const index = Object.fromEntries(header.map((name, idx) => [name, idx]));

  return lines
    .map((line) => line.split('\t'))
    .map((cols) => {
      const text = String(cols[index.text] ?? '').trim();
      const confidence = Number(cols[index.conf] ?? -1);

      return {
        text,
        confidence,
        box: {
          x: Number(cols[index.left] ?? 0),
          y: Number(cols[index.top] ?? 0),
          width: Number(cols[index.width] ?? 0),
          height: Number(cols[index.height] ?? 0),
        },
        level: Number(cols[index.level] ?? 0),
        page: Number(cols[index.page_num] ?? 0),
        block: Number(cols[index.block_num] ?? 0),
        paragraph: Number(cols[index.par_num] ?? 0),
        line: Number(cols[index.line_num] ?? 0),
        word: Number(cols[index.word_num] ?? 0),
      };
    })
    .filter((item) => item.text.length > 0 && item.confidence >= 35);
};

const {stdout} = await execFileAsync('tesseract', [inputPath, 'stdout', '-l', lang, '--psm', psm, 'tsv'], {
  maxBuffer: 20 * 1024 * 1024,
});

const words = parseTsv(stdout);
const result = {
  source: path.resolve(inputPath),
  lang,
  psm,
  generatedAt: new Date().toISOString(),
  words,
};

await fs.mkdir(path.dirname(outputPath), {recursive: true});
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(`已识别 ${words.length} 个文本框：${outputPath}`);
