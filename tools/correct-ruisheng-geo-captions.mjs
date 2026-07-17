import fs from 'node:fs';

const [captionsPath] = process.argv.slice(2);

if (!captionsPath) {
  console.error('用法：node tools/correct-ruisheng-geo-captions.mjs <captions.json>');
  process.exit(1);
}

const captions = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));
let corrections = 0;

for (const item of captions) {
  const time = Number(item.startMs);
  const original = item.text;

  if (item.text === '話') item.text = '话';

  if (time >= 73000 && time <= 75000) {
    if (item.text === '睿') item.text = '瑞';
    if (item.text === '绅') item.text = '盛';
  }

  if (time >= 101000 && time <= 103000) {
    if (item.text === '五') item.text = '舞';
    if (item.text === '敏') item.text = '美';
  }

  if (item.text !== original) corrections += 1;
}

fs.writeFileSync(captionsPath, `${JSON.stringify(captions, null, 2)}\n`, 'utf8');
console.log(`已校正 ${corrections} 个词级字幕：${captionsPath}`);
