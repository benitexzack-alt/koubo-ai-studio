import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('edit/20260814_training_camp_episode2_candidates/cards');

const cards = [
  {
    id: 'K01',
    label: '现场讲解口径',
    title: '海光 DCU 对标 A100',
    accent: '约八成',
    note: '具体结果随型号、任务和软件环境变化',
    side: 'left',
  },
  {
    id: 'K02',
    label: '国产AI竞争进入全链条',
    title: '从一颗芯片，走到企业交付',
    items: ['芯片', '整机制造', '软件生态', '行业交付'],
    side: 'right',
  },
  {
    id: 'K03',
    label: '这五天最重要的四个字',
    title: '责任链条',
    items: ['业务翻译', '数据边界', '流程验证', '验收交付', '长期维护'],
    side: 'left',
  },
  {
    id: 'K04',
    label: '服务器交付六道关',
    title: '芯片装进去，只是第一步',
    items: ['装配', '前测', '老化', '复检', '系统安装', '包装入库'],
    side: 'right',
  },
  {
    id: 'K05',
    label: '数据端',
    title: '企业资料不等于可用数据',
    items: ['采集', '整理', '授权', '评估', '安全管理', '可用可追溯'],
    side: 'left',
  },
  {
    id: 'K06',
    label: '四个项目问题',
    title: '先把项目说清楚',
    items: ['拿什么做？', '有没有权做？', '做进哪段业务？', '最后谁验收？'],
    side: 'right',
  },
  {
    id: 'K07',
    label: '马上能用的责任链',
    title: '把五个责任人写出来',
    items: ['业务结果', '数据权限', 'AI流程', '错误接管', '验收维护'],
    note: '只要空一格，项目就还没真正准备好',
    side: 'left',
  },
];

const escapeXml = (value = '') => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function renderCard(card) {
  const cardX = card.side === 'left' ? 110 : 850;
  const safeX = card.side === 'left' ? 1210 : 390;
  const cardWidth = 640;
  const titleY = 305;
  const items = card.items ?? [];
  const cols = items.length <= 4 ? 2 : 3;
  const itemWidth = cols === 2 ? 260 : 170;
  const itemGap = 18;
  const rows = Math.ceil(items.length / cols);
  const itemStartX = cardX + 52;
  const itemStartY = card.accent ? 520 : 460;

  const itemNodes = items.map((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = itemStartX + col * (itemWidth + itemGap);
    const y = itemStartY + row * 82;
    return `
      <rect x="${x}" y="${y}" width="${itemWidth}" height="58" rx="17" fill="#142A3A" fill-opacity="0.92" stroke="#2D536A"/>
      <text x="${x + itemWidth / 2}" y="${y + 38}" text-anchor="middle" class="item">${escapeXml(item)}</text>`;
  }).join('');

  const noteY = itemStartY + rows * 82 + 18;

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#09131D"/>
        <stop offset="1" stop-color="#102839"/>
      </linearGradient>
      <linearGradient id="glass" x1="0" x2="1">
        <stop offset="0" stop-color="#0A1924" stop-opacity="0.92"/>
        <stop offset="1" stop-color="#122D3E" stop-opacity="0.82"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.32"/>
      </filter>
    </defs>
    <style>
      text { font-family: 'Noto Sans CJK SC', 'PingFang SC', sans-serif; }
      .eyebrow { fill:#FFD84A; font-size:24px; font-weight:700; letter-spacing:2px; }
      .title { fill:#FFFFFF; font-size:45px; font-weight:800; }
      .accent { fill:#FFD84A; font-size:88px; font-weight:900; }
      .item { fill:#F5F8FA; font-size:24px; font-weight:700; }
      .note { fill:#C4D2DA; font-size:22px; font-weight:500; }
      .safe { fill:#BFD1DA; font-size:23px; font-weight:600; }
      .code { fill:#6E8794; font-size:20px; font-weight:700; }
    </style>
    <rect width="1600" height="900" fill="url(#bg)"/>
    <g opacity="0.22">
      <path d="M0 710 C320 560 520 820 830 680 S1320 500 1600 650" fill="none" stroke="#4B7E96" stroke-width="2"/>
      <path d="M0 760 C310 610 560 850 850 730 S1320 560 1600 700" fill="none" stroke="#2E596F" stroke-width="2"/>
    </g>
    <ellipse cx="${safeX}" cy="405" rx="250" ry="330" fill="#132B38" fill-opacity="0.46" stroke="#87A6B6" stroke-width="3" stroke-dasharray="16 14"/>
    <text x="${safeX}" y="405" text-anchor="middle" class="safe">人物安全区</text>
    <text x="${safeX}" y="440" text-anchor="middle" class="note">实际合成时保持无遮挡脸</text>
    <g>
      <rect x="${cardX}" y="150" width="${cardWidth}" height="610" rx="38" fill="url(#glass)" stroke="#3A6074" stroke-opacity="0.72"/>
      <rect x="${cardX + 42}" y="195" width="12" height="48" rx="6" fill="#FFD84A"/>
      <text x="${cardX + 74}" y="231" class="eyebrow">${escapeXml(card.label)}</text>
      <text x="${cardX + 48}" y="${titleY}" class="title">${escapeXml(card.title)}</text>
      ${card.accent ? `<text x="${cardX + 48}" y="455" class="accent">${escapeXml(card.accent)}</text>` : ''}
      ${itemNodes}
      ${card.note ? `<text x="${cardX + 48}" y="${noteY}" class="note">${escapeXml(card.note)}</text>` : ''}
      <text x="${cardX + 48}" y="720" class="code">${card.id} · V8局部语义卡候选</text>
    </g>
  </svg>`;
}

await fs.mkdir(outDir, {recursive: true});
for (const card of cards) {
  await fs.writeFile(path.join(outDir, `${card.id}.svg`), renderCard(card));
}
