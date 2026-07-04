import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const bankPath = path.join(projectRoot, 'topic-bank/topic-bank.json');
const outputPath = path.join(projectRoot, 'topic-bank/topic-bank.scored.json');

const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const dimensions = Object.keys(bank.weights);

const scoreItem = (item) => {
  const weighted = dimensions.map((name) => {
    const raw = Number(item.scores?.[name] ?? 0);
    const weight = Number(bank.weights[name] ?? 1);
    return {
      name,
      raw,
      weight,
      weighted: raw * weight,
    };
  });

  const total = weighted.reduce((sum, item) => sum + item.weighted, 0);
  const max = weighted.reduce((sum, item) => sum + 5 * item.weight, 0);
  const normalized = Math.round((total / max) * 100);

  let recommendation = 'skip';
  if (normalized >= 82) {
    recommendation = 'main_video';
  } else if (normalized >= 68) {
    recommendation = 'short_video';
  } else if (normalized >= 56) {
    recommendation = 'reserve';
  }

  return {
    ...item,
    computed_score: {
      total: Number(total.toFixed(1)),
      max: Number(max.toFixed(1)),
      normalized,
      recommendation,
      weighted,
    },
  };
};

const scoredItems = bank.items
  .map(scoreItem)
  .sort((a, b) => b.computed_score.normalized - a.computed_score.normalized);

const scoredBank = {
  ...bank,
  updated_at: new Date().toISOString().slice(0, 10),
  items: scoredItems,
};

fs.writeFileSync(outputPath, `${JSON.stringify(scoredBank, null, 2)}\n`);

console.log('选题打分完成：');
for (const item of scoredItems) {
  console.log(
    `${item.computed_score.normalized}\t${item.computed_score.recommendation}\t${item.id}\t${item.title}`,
  );
}
