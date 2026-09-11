import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(here, 'host_whisper_small_raw_v1.json');
const reviewPath = path.join(here, 'transcription-review.v1.json');
const timelinePath = path.join(here, 'spoken-timeline.candidate.v1.json');
const outputPath = path.join(here, 'actual-spoken.bilingual.candidate.v1.json');

const expectedHashes = new Map([
  [rawPath, '27a28f5c5b735f4e9b8fde74ac4fa877e771435579a83b0ac6593b064b6c909b'],
  [reviewPath, '204753ed7298ffc39363500601505ae755aee23a32c4f6956e0f34ed40afe498'],
  [timelinePath, 'be4a59f697cabd520c0219cef782cc7d779fdd129ab2c8633aad9e202ebeefa2'],
]);

const translations = [
  'AI will be the last major entrepreneurial opportunity for ordinary people.',
  'What I see promise in is using the industry you already know in Lanzhou, a third-tier city.',
  'Add AI, and it becomes an asymmetric advantage.',
  'You can serve local clients and also try taking work from elsewhere.',
  'What have you done before?',
  'How far have you helped others get?',
  'AI will not automatically erase those differences.',
  'The income gap may widen because of them.',
  'I used to work in sales and ran a shop.',
  'Or you may have spent years in one industry.',
  'Do not think learning AI means throwing all of that away.',
  'And changing careers from scratch.',
  'Your understanding of customers may be exactly what becomes useful.',
  'Take helping local business owners create content.',
  'Anyone can ask AI to write "good quality, good service."',
  'But customers still will not know why they should choose this business.',
  'How does the owner usually answer customers, and what resources do they have?',
  'Why are prices different, and who is this product for?',
  'Which requests genuinely cannot be met?',
  'They may already have explained these questions many times.',
  'You can help collect those answers.',
  'Use AI to categorize and organize them.',
  'Then turn them into video-ready scripts for the owner to verify.',
  'Add product and service materials that can be made public, and explain them one by one.',
  'AI handles part of the organizing and production.',
  'But the foundation is still the business the owner has actually done.',
  'In the past, perhaps only customers who visited and talked with the owner knew this experience.',
  'Now people who have never visited may also see it.',
  "And find the owner's explanation when searching related questions.",
  'Not every piece of content has to chase a viral hit.',
  'A local customer first understands your product.',
  'Then sees how you handle problems.',
  'And gradually remembers you.',
  'When they genuinely need help,',
  'you then have a chance to enter their consideration.',
  'This is a content approach a business owner can try.',
  'It also creates a service opportunity for someone who understands the industry.',
  "You help explain the owner's experience clearly and keep turning it into content.",
  'Saving them the effort of figuring out and producing everything alone.',
  'But if they have no product or service to deliver to customers,',
  'content alone cannot capture the business.',
  "If you can understand an industry's problems,",
  'and deliver the work you agreed to do,',
  'you can try introducing this service to peers in other places.',
  'To people who also need to organize customer questions and produce product content.',
  'Remote work has existed for a long time.',
  'AI did not invent it.',
  'What AI adds is the possibility for one person or a small team',
  'to take on more organizing and production work than they previously could.',
  'As for how clients find you,',
  'and why they trust you, that still depends on your own work and service.',
  'Seen this way, staying in Lanzhou is no longer only about how many jobs the city offers me.',
  'That is no longer the only question.',
  'I can also ask whether people elsewhere need what I know how to do.',
  'If your home and life are already here,',
  'staying local can reduce moving and living costs.',
  'The money saved can go toward finding clients, improving your work, and refining the service.',
  'Giving you a little more time.',
  'Many things only reveal whether they are worth continuing after you try and revise them.',
  'When results have not arrived yet, having some room left matters.',
  'I spend money learning AI—courses, memberships, and usage fees.',
  'Creating images and videos also costs money.',
  'If the result does not fit, it has to be revised again.',
  'So I will not describe this as starting a business with one computer and zero cost.',
  'Spending a little less simply gives you more chances to try.',
  'If clients can use AI themselves, what do they still need you for?',
  "You need to understand the owner's real problem.",
  'You cannot generate a generic plan the moment they say business is slow.',
  'You must also spot where AI-generated content does not fit reality.',
  'When charging a service fee, you must clarify what work will be done.',
  'Who will cooperate, and what must be delivered.',
  'If the client cannot use the result, you need to keep investigating the problem.',
  'And tools are becoming easier to use.',
  'Charging only for a few generated paragraphs or images may become harder.',
  'Owners can try AI themselves, so you must take on more of the work they lack time to do.',
  'Work they cannot check or sustain.',
  'Locally, we can visit shops and talk.',
  'See how they actually work day to day.',
  'Only after understanding this can we know which generic online plans simply do not work for that shop.',
  'Whether we can help depends on adapting to the actual situation.',
  'I have completed paid business AI application and GEO projects, including delivery.',
  'That is one reason I want to keep doing this.',
  'But one delivery does not mean the business is finished.',
  'We still need to improve the service and see whether clients can keep using it.',
  'If you have a job, start with the business you already know.',
  'If you are already running a business, see which experience your customers still do not know.',
  'If you have never worked in an industry, first learn how the real work is done.',
  'Do not rush to advise business owners just because AI can generate a plan.',
  'I choose to stay in Lanzhou and do this.',
  'Understand the problems of local businesses.',
  'Do the work I can take responsibility for, then seek more clients.',
  'Business owners in Lanzhou who need business AI applications',
  'can come talk to me with the real problems they face.',
  'We can discuss which part I can help with and what I still cannot do.',
  'We will make that clear face to face.',
  'I am Chao, building an AI business in Lanzhou.',
];

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const normalize = (text) => String(text ?? '')
  .normalize('NFKC')
  .replace(/[\p{P}\p{Z}\s]/gu, '')
  .toLowerCase();

const readLocked = async (filePath) => {
  const bytes = await fs.readFile(filePath);
  const actual = sha256(bytes);
  const expected = expectedHashes.get(filePath);
  if (actual !== expected) throw new Error(`INPUT_HASH_MISMATCH:${path.basename(filePath)}:${actual}`);
  return {bytes, body: JSON.parse(bytes.toString('utf8')), sha256: actual};
};

const raw = await readLocked(rawPath);
const review = await readLocked(reviewPath);
const timeline = await readLocked(timelinePath);
const sourceSegments = raw.body.transcription;
const beatCaptions = timeline.body.captions;

if (sourceSegments.length !== 96 || translations.length !== 96 || beatCaptions.length !== 22) {
  throw new Error(`COUNT_MISMATCH:segments=${sourceSegments.length}:translations=${translations.length}:beats=${beatCaptions.length}`);
}

const correctionForSegment = (sourceText) => review.body.corrections
  .filter(({from}) => String(sourceText).includes(from));

const correct = (sourceText) => {
  let text = String(sourceText).trim().replace(/\s+/gu, '');
  for (const {from, to} of review.body.corrections) text = text.replaceAll(from, to);
  return text;
};

const pages = sourceSegments.map((segment, index) => {
  const startMs = segment.offsets.from;
  const endMs = segment.offsets.to;
  const beat = beatCaptions.find((item) => startMs >= item.startMs && endMs <= item.endMs);
  if (!beat) throw new Error(`SEGMENT_BEAT_MAPPING_MISSING:${index + 1}`);
  const pageNumber = sourceSegments
    .slice(0, index + 1)
    .filter((item) => item.offsets.from >= beat.startMs && item.offsets.to <= beat.endMs)
    .length;
  const appliedCorrections = correctionForSegment(segment.text);
  const uncertaintyIds = [...(beat.uncertaintyIds ?? [])];
  return {
    id: `${beat.id}-p${String(pageNumber).padStart(2, '0')}`,
    beatId: beat.beatId,
    sourceSegmentIndex: index,
    startMs,
    endMs,
    zh: correct(segment.text),
    en: translations[index],
    highlights: [],
    timingPrecision: 'asr-segment-boundary-estimate',
    authority: 'recorded-audio-candidate-from-local-asr',
    reviewRequired: beat.reviewRequired === true,
    uncertaintyIds,
    uncertainIds: uncertaintyIds,
    correctionIds: appliedCorrections.map(({id}) => id),
  };
});

for (const beat of beatCaptions) {
  const joined = pages.filter((page) => page.beatId === beat.beatId).map((page) => page.zh).join('');
  if (normalize(joined) !== normalize(beat.text)) {
    throw new Error(`CHINESE_DRIFT:${beat.beatId}`);
  }
}

for (let index = 0; index < pages.length; index += 1) {
  const page = pages[index];
  if (index > 0 && page.startMs < pages[index - 1].endMs) throw new Error(`PAGE_OVERLAP:${page.id}`);
  if (!page.zh || !page.en || page.endMs <= page.startMs) throw new Error(`PAGE_INVALID:${page.id}`);
}

const output = {
  schemaVersion: 'koubo-actual-spoken-bilingual-candidate/v1',
  taskId: timeline.body.taskId,
  status: 'needs-user-audio-review',
  phase: 'post-shoot-caption-candidate',
  authority: 'recorded-audio-candidate-from-local-asr',
  canonicalSource: 'recorded-audio',
  scriptRole: 'comparison-only',
  captionTextPolicy: 'spoken-verbatim-candidate',
  englishTranslationSource: 'same-window-recorded-chinese-candidate',
  humanListeningPerformed: false,
  userAudioReviewConfirmed: false,
  formalAllowed: false,
  permittedUse: 'local-low-resolution-candidate-preparation-only',
  pageCount: pages.length,
  beatCount: beatCaptions.length,
  source: {
    rawAsr: {path: 'edit/20260910_lanzhou_industry_ai/05_实录与字幕/host_whisper_small_raw_v1.json', sha256: raw.sha256},
    transcriptionReview: {path: 'edit/20260910_lanzhou_industry_ai/05_实录与字幕/transcription-review.v1.json', sha256: review.sha256},
    aggregateSpokenTimeline: {path: 'edit/20260910_lanzhou_industry_ai/05_实录与字幕/spoken-timeline.candidate.v1.json', sha256: timeline.sha256},
  },
  captions: pages,
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
await fs.writeFile(outputPath, serialized, {encoding: 'utf8', flag: 'wx', mode: 0o600});

console.log(JSON.stringify({
  status: output.status,
  outputPath,
  sha256: sha256(Buffer.from(serialized)),
  pageCount: pages.length,
  beatCount: beatCaptions.length,
  formalAllowed: false,
}, null, 2));
