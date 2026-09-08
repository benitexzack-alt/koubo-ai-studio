import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = join(dir, '2026-09-08-兰州AI创业-');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const bodyOf = p => readFileSync(p, 'utf8').split('<!-- CONTENT_START -->')[1].split('<!-- CONTENT_END -->')[0].trim();
const mapped = [
  ['I01', '收入上的差距反而可能拉开', '保留差异判断，写成可能，不引入当地收入数据。'],
  ['I02', '既能服务本地，也能尝试接外地的业务', '两条路径开头出现，没有设置必须先本地成功才能向外的制度。'],
  ['I03', '你可以帮他把这些回答收集起来', '原片经验到公开内容的解释功能保留；没借用家装故事。'],
  ['I04', '等他真有需要的时候，你才有机会进入他的选择', '持续被看见只是进入选择，后段另外分开咨询与成交；不保证信任或获客。'],
  ['I05', '再往外看，你做这项服务', '中段展开异地服务，另说明远程早已存在及到场任务。'],
  ['I06', '那省下来的钱，就能给找客户、改作品、磨合服务多留一点时间', '有条件地解释支出与验证时间，不把本地等同低成本成功。'],
  ['I07', '行业了解、检查结果、完成交付', '保留三项能力，展开到具体工作，不做导师式三列表模型。'],
  ['I08', '工具越容易用，只靠生成几段文字、几张图收费，以后可能更难', '保留竞争与收费压力，同时说明本地接近现场仍需判断和修改。']
];

function check(cardPath, draftPath, current) {
  const card = JSON.parse(readFileSync(cardPath, 'utf8'));
  const body = bodyOf(draftPath);
  const errors = [];
  if (card.source.path === card.adaptation.path) errors.push('来源和改编指向同一文件');
  const sourceLocators = card.insight_nodes.map(n => {
    const exists = n.source_path && n.source_quote && readFileSync(n.source_path, 'utf8').includes(n.source_quote);
    if (!exists) errors.push(n.id + '缺少独立原文引用');
    return {id:n.id, originalQuoteLocated:!!exists};
  });
  if (!/收入.{0,10}差距/.test(body)) errors.push('遗漏收入差异主问题');
  const opening = body.slice(0, 240);
  if (!/本地/.test(opening) || !/外地|向外|周边市场/.test(opening)) errors.push('两个方向没有前置');
  const mappings = current ? mapped.map(([id, anchor, note]) => {
    const position = body.indexOf(anchor);
    if (position < 0) errors.push(id + '当前正文映射缺失');
    return {id, draftQuote:anchor, position, editorialJudgment:note};
  }) : [];
  return {status:errors.length?'blocked':'task-check-passed', errors, sourceLocators, mappings,
    cardPath, cardSha256:sha(cardPath), draftPath, draftSha256:sha(draftPath),
    limitation:'机器只核对独立原文定位与本题关键锚点；editorialJudgment为编辑逐段对照意见，不是自动语义质量结论。'};
}
const old = check(join(dir,'2026-09-07-兰州AI创业-源头精髓-v1.json'),join(dir,'2026-09-07-兰州AI创业-口播稿-v1.md'),false);
const current = check(base+'源头精髓-v2.json',base+'口播稿-v2.md',true);
assert.equal(old.status,'blocked');
assert.equal(current.status,'task-check-passed');
const report = {taskId:'task-20260908T005854Z-49aee259',generatedAt:new Date().toISOString(),scope:'本题失败回归与源头到正文对照，未修改全局Skill',old,current,
  omitted:{source1:'原片家装故事与所有经营数字不入稿；案例说明经验来源、曝光咨询成交分层的功能保留。',source2:'原片建材销售假设、作者收藏引导和普遍性强断言不复制；收入差异、双路径、成本、能力、价格压力保留。'},
  originalExtensions:['兰州生活安排的条件性适配','远程早已有，AI仅辅助工作量的归因校正','本人历史经历与当前服务咨询承接'],
  remainingGates:['用户语言审阅','本人朗读','首句绝对化判断的信任风险','当前服务范围确认','发布前审核']};
writeFileSync(base+'保真对照与回归-v2.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({old:old.status,current:current.status,oldErrors:old.errors,output:base+'保真对照与回归-v2.json'},null,2));
