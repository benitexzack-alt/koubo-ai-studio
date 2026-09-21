import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
const inputPath = resolve(
  projectRoot,
  'remotion/public-salon-20260920/data/captions.machine-candidate.v1.json',
);
const outputPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/05_实录与字幕/兰州AI沙龙_实录中文字幕候选_v1.srt',
);

const captions = JSON.parse(readFileSync(inputPath, 'utf8'));

const timestamp = (milliseconds) => {
  const safe = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safe / 3600000);
  const minutes = Math.floor((safe % 3600000) / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const millis = safe % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
};

const srt = captions
  .map(
    (cue, index) =>
      `${index + 1}\n${timestamp(cue.startMs)} --> ${timestamp(cue.endMs)}\n${cue.text}\n`,
  )
  .join('\n');

writeFileSync(outputPath, srt, 'utf8');
process.stdout.write(`${outputPath}\n`);
