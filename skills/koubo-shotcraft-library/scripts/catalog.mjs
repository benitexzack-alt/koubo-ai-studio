import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'upstream/gallery/api/library.json')));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry.v1.json')));
const query = process.argv.slice(2).join(' ').toLowerCase();
const selected = catalog.cards.filter((card) => JSON.stringify(card).toLowerCase().includes(query));
console.log(JSON.stringify({revision: catalog.revision, count: selected.length, cards: selected.map((card) => ({
  name: card.name, summary: card.summary, use: card.use, source: card.source,
  styles: card.styles.map((style) => ({key: style.key, label: style.label})),
  adapter: registry.effects.find((effect) => effect.upstream === card.name) ?? {status:'reference-only'},
}))}, null, 2));
