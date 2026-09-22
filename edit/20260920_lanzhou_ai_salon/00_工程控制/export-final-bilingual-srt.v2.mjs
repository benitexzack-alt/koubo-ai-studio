import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
const input = resolve(
  projectRoot,
  'remotion/public-salon-20260920/data/captions.final-source.bilingual.v2.json',
);
const output = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/05_实录与字幕/兰州AI沙龙_最终源_中英字幕_v2.srt',
);

const document = JSON.parse(readFileSync(input, 'utf8'));
const captions = Array.isArray(document) ? document : document.captions;
if (!Array.isArray(captions) || captions.length === 0) {
  throw new Error('双语字幕为空。');
}

const stamp = (milliseconds) => {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const millis = Math.round(milliseconds % 1000);
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':') + `,${String(millis).padStart(3, '0')}`;
};

const body = captions
  .map(
    (caption, index) =>
      `${index + 1}\n${stamp(caption.startMs)} --> ${stamp(caption.endMs)}\n${caption.zh}\n${caption.en}\n`,
  )
  .join('\n');

mkdirSync(dirname(output), {recursive: true});
writeFileSync(output, body);
process.stdout.write(`已导出 ${captions.length} 条中英字幕：${output}\n`);
