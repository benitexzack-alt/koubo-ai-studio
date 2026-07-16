import fs from 'node:fs';
import path from 'node:path';

const inputArg = process.argv[2] ?? 'remotion/public/data/AI_LANDING_20260711_documentary_v2.captions.json';
const input = path.resolve(process.cwd(), inputArg);
const captions = JSON.parse(fs.readFileSync(input, 'utf8'));

if (!Array.isArray(captions)) {
  throw new Error('字幕文件必须是数组。');
}

const exactText = new Map([
  ['GO', 'GEO'],
  ['codex', 'Codex'],
  ['skill', 'Skill'],
  ['skill，', 'Skill，'],
  ['agent', 'Agent'],
  ['agent，', 'Agent，'],
  ['(吸气声)', ''],
  ['(敲击音响)', ''],
]);

const timedText = new Map([
  [66620, '剪'],
  [66760, '映'],
  [95820, '剪'],
  [95880, '映'],
  [104280, ''],
  [141680, '棚'],
  [144480, '抠'],
]);

let changes = 0;
const corrected = captions
  .map((caption) => {
    const replacement = timedText.has(caption.startMs)
      ? timedText.get(caption.startMs)
      : exactText.get(caption.text);
    if (replacement === undefined || replacement === caption.text) {
      return caption;
    }
    changes += 1;
    return {...caption, text: replacement};
  })
  .filter((caption) => caption.text !== '');

if (changes < 10) {
  throw new Error(`字幕校正命中数量异常：${changes}`);
}

fs.writeFileSync(input, `${JSON.stringify(corrected, null, 2)}\n`);
console.log(`已校正 ${changes} 个字幕词元：${input}`);
