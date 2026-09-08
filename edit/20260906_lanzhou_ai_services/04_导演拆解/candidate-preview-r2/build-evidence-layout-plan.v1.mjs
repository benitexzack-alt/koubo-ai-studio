import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const owned = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(owned, '../../../..');
const base = 'edit/20260906_lanzhou_ai_services/';
const r1 = `${base}04_导演拆解/candidate-preview-r1/`;
const r2 = `${base}04_导演拆解/candidate-preview-r2/`;
const skill = 'skills/koubo-shotcraft-library/';
const read = (p) => fs.readFileSync(path.resolve(root, p));
const json = (p) => JSON.parse(read(p));
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const binding = (p) => ({path: p, sha256: hash(read(p))});
const write = (name, value) => {
  assert.equal(path.basename(name), name);
  fs.writeFileSync(path.join(owned, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});
  return binding(`${r2}${name}`);
};
const generatedAt = new Date().toISOString();
const canonicalPath = `${base}09_实录与字幕/canonical-spoken.v1.json`;
const canonical = json(canonicalPath);
const prior = json(`${r1}output-selection.derived.v2.json`);
const oldRequest = json(`${r1}output-match-request.v2.json`);
const catalog = json(`${skill}card-capability-index.v2.json`);
const library = json(`${skill}upstream/gallery/api/library.json`);
const registry = json(`${skill}registry.v1.json`);
const data = json(`${r1}data.v1.json`);
const words = new Map(canonical.words.map((word) => [word.id, word]));
const frameOf = (word) => Math.round(word.startMs * 30 / 1000 + (word.startMs >= 2300 ? 244 : 0));
const anchor = (id, relation, note) => {
  const word = words.get(id);
  assert.ok(word, id);
  return {wordIds: [id], spokenText: word.text, sourceStartMs: word.startMs, sourceEndMs: word.endMs,
    outputFrame: frameOf(word), relation, note, timingPrecision: 'asr-token-estimate', timingResolutionMs: 10,
    frameQuantization: 'Math.round(sourceMs * 30 / 1000 + 244)', maximumQuantizationErrorFrames: 0.5,
    timingAccuracyMs: null, phonemeAlignmentClaimed: false, heardByThisWorker: false};
};
const officialPath = `${base}03_官方素材/O01_工信部通知原文.txt`;
const officialText = read(officialPath).toString('utf8');
const titleImage = `${base}03_官方素材/O01_通知标题与日期.png`;
const paragraphImage = `${base}03_官方素材/O01_扎根用户现场_原文段落.png`;
const newsPath = `${base}06_补充实拍素材/开头引用_v1/stodownload.MP4`;
const newsStill = `${base}07_预览与质检/candidate-preview-r1/stills/frame-00153.png`;
const openingPath = `${base}04_导演拆解/开头引用_v1/opening-insert-plan.v1.json`;
const fullTitle = '工业和信息化部办公厅关于开展人工智能应用服务商培育专项行动的通知';
const fullSentence = '鼓励服务商搭建前线部署工程师（FDE）团队，扎根用户现场，保障场景落地。';
const sourceLocation = (text) => {
  const offset = officialText.indexOf(text);
  assert.ok(offset >= 0, `官方本地全文不存在：${text}`);
  return {sourcePath: officialPath, utf16Start: offset, utf16EndExclusive: offset + text.length,
    lineNumber: officialText.slice(0, offset).split('\n').length, match: 'exact-substring'};
};
const titleRect = {x: 40, y: 235, width: 1090, height: 230};
const paragraphRect = {x: 40, y: 333, width: 1090, height: 116};
const evidenceRegion = {x: 64, y: 170, width: 1170, height: 680};
const speakerRegion = {x: 64, y: 164, width: 704, height: 650};
const sourceBindings = Object.fromEntries(Object.entries({
  canonical: canonicalPath, bilingual: `${base}09_实录与字幕/actual-bilingual.v1.json`,
  transcriptionReview: `${base}09_实录与字幕/transcription-review.v1.json`,
  outputCaptions: `${r1}captions.json`, outputData: `${r1}data.v1.json`,
  r1Selection: `${r1}output-selection.derived.v2.json`, r1MatchRequest: `${r1}output-match-request.v2.json`,
  r1MatchReceipt: `${r1}output-match-receipt.v2.json`, officialText: officialPath,
  titleImage, paragraphImage, newsMedia: newsPath, newsFrame: newsStill, openingPlan: openingPath,
  registry: `${skill}registry.v1.json`, capabilityIndex: `${skill}card-capability-index.v2.json`,
  library: `${skill}upstream/gallery/api/library.json`, componentModule: `${skill}assets/ShotcraftEffects.tsx`,
  copiedR1Component: 'remotion/src/lanzhou-services-v91-candidate-r1/ShotcraftEffects.generated.tsx',
}).map(([key, p]) => [key, binding(p)]));
assert.equal(sourceBindings.componentModule.sha256, sourceBindings.copiedR1Component.sha256);
assert.equal(catalog.cards.length, 157);
assert.equal(library.cards.length, 157);
assert.equal(catalog.cards.filter((card) => card.renderability === 'candidate-renderable').length, 5);
assert.equal(catalog.cards.filter((card) => card.renderability === 'adaptation-required').length, 152);

const line = (id, text, wordId, fontSize, localRect, endFrameExclusive, relation, note) => {
  const a = anchor(wordId, relation, note);
  return {id, text, textRole: 'official-verbatim-excerpt-reflow-not-subtitle', source: sourceLocation(text),
    revealFrame: a.outputFrame, revealDurationFrames: 8, stableFromFrame: a.outputFrame + 8,
    endFrameExclusive, stableHoldFrames: endFrameExclusive - a.outputFrame - 8,
    fontSize, lineHeight: Math.ceil(fontSize * 1.3), localRect, anchor: a,
    visualImplementation: 'parent-owned-frame-driven-opacity-only', shotcraftKeywordReveal: false};
};
const titleLines = [
  line('O01-title-1', '关于开展', 'w0293', 50, {x: 52, y: 170, width: 1090, height: 65}, 2506,
    'shared-action-onset', '“开展”的真实起点；官方的“关于”没有逐字说出。'),
  line('O01-title-2', '人工智能应用服务商', 'w0295', 76, {x: 52, y: 248, width: 1090, height: 99}, 2506,
    'spoken-phrase-start', '从“人工智能”的首词元点亮整行，不把整行每字均分到时间。'),
  line('O01-title-3', '培育专项行动的通知', 'w0305', 76, {x: 52, y: 352, width: 1090, height: 99}, 2506,
    'shared-word-onset-with-official-context', '“培育”的真实起点2490；专项行动的通知为正式标题，不是逐字说出。'),
].map((entry) => ({...entry, presentFromFrame: 2336, presentationMode: 'readable-base-then-word-anchored-emphasis',
  revealMeaning: '强调开始，不是从不可见变可见', baseOpacity: 1, baseTextColor: '#51595e', activeTextColor: '#15191c',
  visualImplementation: 'parent-owned-frame-driven-emphasis-existing-text', stableHoldFrames: 2506 - 2336,
  stableFromFrame: 2336, emphasisStableHoldFrames: 2506 - entry.revealFrame - 8}));
const paragraphLines = [
  line('O01-site-1', '鼓励服务商搭建', 'w0308', 50, {x: 52, y: 178, width: 1090, height: 65}, 2614,
    'shared-word-onset-with-official-context', '“鼓励”有实录词元；服务商搭建是官方原文，不能冒充实录“服务团队”。'),
  line('O01-site-2', '前线部署工程师（FDE）团队，', 'w0310', 50, {x: 52, y: 250, width: 1090, height: 65}, 2614,
    'official-context-only-not-spoken', '本句未逐字说出，借实录“服务”的词元作展示节拍，不声称FDE读音已对齐。'),
  line('O01-site-3', '扎根用户现场，', 'w0314', 84, {x: 52, y: 344, width: 1090, height: 110}, 2614,
    'same-topic-onset-official-text-differs-from-spoken', '实录为“扎根用户的现场”，字幕中的“的”保留；此处逐字引自官方原文。'),
  line('O01-site-4', '保障场景落地。', 'w0316', 68, {x: 52, y: 468, width: 1090, height: 89}, 2614,
    'official-context-only-not-spoken', '本句未说出；在实录“用户”的首词元处补全同一官方引文，不能登记为语音逐词同步。'),
];
assert.equal(`工业和信息化部办公厅${titleLines.map((item) => item.text).join('')}`, fullTitle);
assert.equal(paragraphLines.map((item) => item.text).join(''), fullSentence);

const fields = [
  ['issuer', '发文机关', '工业和信息化部办公厅'], ['title', '标题', fullTitle],
  ['documentNumber', '发文字号', '工信厅科函〔2026〕414号'],
  ['writtenDate', '成文日期', '2026-08-27'], ['publishedDate', '发布日期', '2026-08-31'],
  ['publisherDepartment', '发布机构', '科技司'], ['category', '分类', '高技术管理'],
  ['siteSentence', '任务四末句', fullSentence],
].map(([id, label, text]) => ({id, label, text, source: sourceLocation(text), exactVerifiedInLocalText: true}));

const plan = {
  schemaVersion: 'lanzhou-candidate-evidence-layout-plan/v1', revisionId: 'candidate-preview-r2-evidence-layout-v1',
  generatedAt, status: 'proposal-and-selection-contract-only', taskId: prior.taskId,
  taskIdStatus: 'inherited-parent-task-identity-not-new-R2-execution-attestation',
  authority: {parentRequestedR2: true, localCandidateOnly: true, formal: false, publicationApproved: false,
    renderPerformed: false, audioListeningPerformed: false, userAcceptanceClaimed: false},
  bindingStatus: {stableReadOnlySources: 'sha256-snapshot-verified', parentR2Composition: 'not-bound-awaiting-stable-inputs',
    parentR2PublicDir: 'independent-path-assigned-by-parent', finalInputManifest: 'pending-parent-stable-inputs'},
  sourceBindings,
  sourceReview: {reviewedAt: generatedAt, reviewer: 'subtask-assistant-local-text-and-view_image-inspection',
    visualInputs: [titleImage, paragraphImage, newsStill], completeLocalOfficialTextRead: true,
    officialWebRefetched: false, sourceAudioHeard: false, R2RenderSeen: false,
    newsBoundary: '新闻帧可见文字不是独立核验的官方全文；两份政策不能混同。'},
  catalog: {cardCount: 157, styleCount: 214, candidateRenderableCount: 5, adaptationRequiredCount: 152,
    inspectionScope: '全部157项本地元数据与registry交叉核对；五组件本地实现及校验器只读核对，不声称152项源码都已适配或逐项渲染。',
    candidateOnly: true, auditPath: `${r2}shotcraft-capability-audit.v1.json`},
  timeline: {fps: 30, durationInFrames: 8393, durationSeconds: 8393 / 30,
    sourceDurationFrames: 8149, insert: {id: 'news-U01', sourceStartFrame: 0, outputStartFrame: 69,
      durationInFrames: 244, sourceVideoFrames: 243, sourceAudioDurationSeconds: 8.102993, authorizedTailPadFrames: 1},
    wordTimeTransform: 'sourceStartMs >= 2300 ? sourceStartMs + 244000/30 : sourceStartMs',
    captionsUnchanged: true, wordsUnchanged: true, paperRangesUnchanged: true, transcriptUncertainCount: 13,
    recordedAbsence: {id: 'B23', status: 'recorded-absence', oldPostshootPassedClaimed: false}},
  inheritedSpeakerTypography: {region: speakerRegion, markerComponentProps: {fontSize: 64}, keywordComponentProps: {fontSize: 70},
    implementationProps: {scope: 'parent-R2-only-CSS-not-shared-Skill', markerKeywordFontSize: 88,
      markerKeywordColor: '#e8c76d', markerBeforeAfterFontSize: 64, keywordFirstItemColor: '#e8c76d',
      v8TitleFontSize: 76, v8DetailFontSize: 40, v8ItemFontSize: 46,
      v8TitleColor: '#e8c76d', v8DetailColor: '#ffffff', v8Left: '54-or-64-as-parent-layout', v8Top: 170, v8Width: 704},
    componentLimit: 'fontSize仅MarkerUnderline和KeywordReveal原生支持；88px关键词/颜色/V8字号必须显式记录为父R2 scoped CSS。EvidenceScan无fontSize参数。',
    consumeAllProps: ['before', 'keyword', 'after', 'items[].text', 'items[].atFrame'],
    inheritedKeywordTiming: '逐项从R1具名derived v2继承，不能退回raw matcher的末帧均分。'},
  officialDocument: {
    id: 'O01-continuous-document', frames: {startFrame: 2336, endFrameExclusive: 2614}, durationInFrames: 278,
    region: evidenceRegion, background: '#ffffff', textColor: '#15191c', emphasisColor: '#8a5000',
    authenticityDisplayLabel: '原文摘录', sourceDocumentNumber: '工信厅科函〔2026〕414号',
    presentationType: 'verbatim-excerpt-reflow-with-original-image-provenance-not-an-original-screenshot',
    officialFields: fields,
    subtitlePages: data.captions.filter((caption) => ['c017', 'c018'].includes(caption.id)),
    persistentLayers: ['同一白色文件面', '同一文号来源标识', '父R1安全真人圆窗', '原实录字幕与原声'],
    phaseTransition: {atFrame: 2506, anchor: anchor('w0307', 'spoken-clause-boundary', '“还”开始第二个政策论点。'),
      oldTitleFadeOutFrames: [2506, 2509], newParagraphFirstRevealFrame: 2509,
      backgroundHardCut: false, presenterHardCut: false, noDocumentPositionChange: true,
      note: '只替换同一O01文档内的摘录焦点；标题收起后按行出现末句。禁止叠出两套互相遮挡的大字。'},
    phases: [
      {id: 'O01-title', selectionBeatId: 'output-c017', frames: {startFrame: 2336, endFrameExclusive: 2506},
        fullExactText: fullTitle, lines: titleLines,
        metadata: [{label: '发布日期', text: '2026-08-31', revealFrame: 2336, fontSize: 54,
          localRect: {x: 40, y: 150, width: 1090, height: 71}, anchor: anchor('w0282', 'date-context-not-literal-date-spoken', '实录“今年8月底”，不伪造读出2026-08-31。')}],
        originalImage: {asset: sourceBindings.titleImage, sourceSize: {width: 2160, height: 1620},
          sourceCrop: {x: 260, y: 445, width: 1640, height: 427}, localDestination: {x: 40, y: 548, width: 300, height: 300 * 427 / 1640},
          role: 'provenance-thumbnail-not-primary-readable-text', preserveAspectRatio: true},
        effect: {component: 'EvidenceScan', rect: titleRect, label: '工信部专门发了通知',
          targetLineId: 'O01-title-2', targetText: '人工智能应用服务商',
          targetTextLocalBox: {x: 344, y: 320, width: 684, height: 99},
          labelReservedLocalRect: {x: 332, y: 233, width: 708, height: 63},
          note: '框重排大字中的对应关键词，不框整个原段落缩略图；原截图不改字。'},
      },
      {id: 'O01-site', selectionBeatId: 'output-c018', frames: {startFrame: 2506, endFrameExclusive: 2614},
        fullExactText: fullSentence, lines: paragraphLines,
        originalImage: {asset: sourceBindings.paragraphImage, sourceSize: {width: 1620, height: 174},
          sourceCrop: {x: 0, y: 0, width: 1620, height: 174}, localDestination: {x: 40, y: 528, width: 1056, height: 1056 * 174 / 1620},
          role: 'whole-paragraph-provenance-including-final-two-physical-lines', preserveAspectRatio: true,
          note: '原图第三行尾“鼓励”和第四行均保留；不能只取第四行后声称完整句。'},
        effect: {component: 'EvidenceScan', rect: paragraphRect, label: '扎根用户的现场',
          targetLineId: 'O01-site-3', targetText: '扎根用户现场',
          targetTextLocalBox: {x: 40, y: 302, width: 420, height: 91},
          labelReservedLocalRect: {x: 28, y: 213, width: 444, height: 63},
          note: '框官方“扎根用户现场”，组件label依然用实录“扎根用户的现场”，两者证据类型明确区分。'},
      },
    ],
    keywordRevealDecision: {status: 'not-selected-for-document-context', reason: 'registry把KeywordReveal限制为speaker；本段主画面仍real-evidence，不能伪写speaker。官方逐行层由父R2证据排版消费，不伪称Shotcraft已支持。'},
    mainVisualClockBoundaryChange: {from: 2450, to: 2506, deltaFrames: 56,
      reason: '标题跨字幕c017/c018，按实录“还”在同一文档内切论点；不是延长或改写字幕，也不改音轨。'},
    claimBoundary: '只展示政策通知，不构成本人/公司的资质认定、政府推荐或服务效果承诺。未说出的官方引文不新增为口播。',
  },
  newsOpening: {id: 'news-U01', frames: {startFrame: 69, endFrameExclusive: 313},
    source: sourceBindings.newsMedia, observedFrame: sourceBindings.newsFrame,
    visiblePublisher: '金融投资报', visibleDateLabel: '9月4日消息 资料画面',
    visibleDocumentName: '《人工智能中小企业创业支持计划（2026-2028年）》',
    textAuthority: 'user-provided-news-visible-text-not-independent-official-fulltext',
    publisherVerified: false, reuseRightsVerified: false, newsAudioTranscriptionVerified: false,
    exactVisibleHeadingLines: ['工信部：鼓励各地对依托智能工具', '开展敏捷创业的“一人公司”', '超级个体等微型主体给予包容支持'],
    sourceMainRect: {x: 64, y: 60, width: 540, height: 960}, cropMainSource: false,
    synchronizedCrop: {...json(openingPath).layoutCandidate.synchronizedDetail, inheritedR1: true, changedByR2: false},
    revisionDecision: 'unchanged-from-R1-no-new-layout-no-new-sfx',
    shotcraft: {decision: 'not-needed', selected: false, applied: false, noFakeSpokenQuote: true,
      reason: '父已实看R1frame00153并明确保留原画面；本轮不新增新闻重排、组件或音效。'},
    policySeparation: '开头为新闻中的创业支持计划；正文为工信厅科函〔2026〕414号服务商通知，不能互换标题或日期。'},
  audioCueHandoff: {status: 'candidate-event-times-only-no-mix-or-auditory-approval', owner: 'parent-audio-task',
    rule: '可在逐行进入/焦点落稳时用已有可溯源本地音效；不要无差别叠加或改原声。不得把自动幅度/静帧验证写成人耳通过。',
    officialLineRevealFrames: [...titleLines, ...paragraphLines].map(({id, revealFrame, stableFromFrame}) => ({id, revealFrame, stableFromFrame})),
    newsVisualOnlyFrames: [], gainDb: null, chosenAssets: [], newAudioGenerated: false},
  handoff: {selection: `${r2}output-selection.derived.v1.json`, request: `${r2}output-match-request.v1.json`,
    rawSelection: `${r2}output-match-selection.raw.v1.json`, matchReceipt: `${r2}output-match-receipt.v1.json`,
    validation: `${r2}output-derived-validation.v1.json`, contractCheck: `${r2}evidence-layout-check.v1.json`,
    parentMustUseFinalPhaseFrames: true, parentMustKeepScopedStyling: true,
    currentDeliverableIsNotApplicationReceipt: true, finalWorkingDeclared: false},
};

// 最后两条父任务指令优先：15项原帧窗不动，新闻完整沿用R1。
plan.inheritedSpeakerTypography.implementationProps.openingSemanticTitle = '包容和支持';
plan.inheritedSpeakerTypography.implementationProps.openingSemanticTitleFontSize = 112;
plan.inheritedSpeakerTypography.implementationProps.openingSemanticTitleScale = 1.1;
plan.officialDocument.header = {text: '工业和信息化部办公厅', textRole: 'official-title-prefix',
  fontSize: 32, localRect: {x: 40, y: 24, width: 1090, height: 42}, frames: {startFrame: 2336, endFrameExclusive: 2506}};
plan.officialDocument.documentIdentity = {text: '工信厅科函〔2026〕414号', fontSize: 28,
  localRect: {x: 40, y: 610, width: 1090, height: 37}, frames: {startFrame: 2336, endFrameExclusive: 2614}};
plan.officialDocument.mainVisualClockBoundaryChange = {selectionFramesChanged: false,
  internalDocumentPhaseChangeFrame: 2506, subtitleFramesChanged: false,
  reason: 'OfficialSequence连续2336–2614，内部焦点随w0307“还”变化；15项Shotcraft保持R1效果帧窗。'};
const titlePhase = plan.officialDocument.phases[0];
const sitePhase = plan.officialDocument.phases[1];
titlePhase.selectionFrames = {startFrame: 2336, endFrameExclusive: 2450};
sitePhase.selectionFrames = {startFrame: 2450, endFrameExclusive: 2614};
titlePhase.metadata[0].localRect = {x: 40, y: 550, width: 1090, height: 47};
titlePhase.metadata[0].fontSize = 36;
titlePhase.effect.targetTextLocalBox = {x: 52, y: 248, width: 684, height: 99};
sitePhase.effect.targetTextLocalBox = {x: 52, y: 344, width: 504, height: 110};
titlePhase.effect.label = '';
sitePhase.effect.label = '';
titlePhase.effect.labelReservedLocalRect = null;
sitePhase.effect.labelReservedLocalRect = null;
plan.officialDocument.emphasisColor = '#FFD068';
plan.inheritedSpeakerTypography.implementationProps.markerKeywordColor = '#FFD068';
plan.inheritedSpeakerTypography.implementationProps.keywordFirstItemColor = '#FFD068';
plan.inheritedSpeakerTypography.implementationProps.v8TitleColor = '#FFD068';
for (const phase of plan.officialDocument.phases) {
  delete phase.originalImage.localDestination;
  phase.originalImage.globalEvidenceSlot = {x: 1282, y: 224, width: 560, height: 326};
  phase.originalImage.fit = 'contain';
  phase.originalImage.role = 'right-side-original-image-provenance-not-primary-readable-text';
}
plan.newsOpening.revisionDecision = 'unchanged-from-R1-no-new-layout-no-new-sfx';
plan.newsOpening.synchronizedCrop = {...json(openingPath).layoutCandidate.synchronizedDetail,
  inheritedR1: true, changedByR2: false};
plan.newsOpening.shotcraft = {decision: 'not-needed', selected: false, applied: false,
  reason: '父已实看R1frame00153并明确保留原画面；本轮不新增新闻重排、组件或音效。',
  noFakeSpokenQuote: true};
plan.audioCueHandoff.newsVisualOnlyFrames = [];
plan.audioCueHandoff.newsSfxAdded = false;
plan.handoff.preserveR1FifteenEffectFramesTextsAndItemTimes = true;

const adapterReasons = {
  'marker-underline': '适用于真人口播重点；完整before/keyword/after与实录一致。不是文件局部放大器。',
  'keyword-reveal': '适用于真人画面的实录列表逐项呈现；原生items.atFrame可用，保留真实词元派生时间。官方文档语境不允许。',
  'evidence-scan': '正文c017/c018首选，用来定位已放大的实际证据关键词；本身不会放大源图，也无fontSize参数。',
  'line-carry': '关系接力而非政策逐行核对，且只允许speaker；本轮不选。',
  'paper-tape-pin': '可在speaker/real-evidence承载真实图卡，但内槽压缩与摆动不利阅读文件；本轮不叠加。',
};
const capabilityAudit = {schemaVersion: 'shotcraft-local-capability-audit/v1', generatedAt,
  status: 'local-metadata-and-adapter-audit-not-render-qa', sources: {registry: sourceBindings.registry, index: sourceBindings.capabilityIndex, library: sourceBindings.library},
  count: {cards: 157, styles: 214, candidateRenderable: 5, adaptationRequired: 152},
  directAdapters: registry.effects.map((effect) => ({...effect, recommendation: adapterReasons[effect.id]})),
  relevantUnavailable: catalog.cards.filter((card) => ['document-typewriter-reveal', 'scan-bracket-sweep', 'crash-zoom-punch', 'ai-stream-response', 'type-rhythm-sync', 'lead-word-zoom-assemble'].includes(card.cardName))
    .map((card) => ({cardName: card.cardName, summary: card.summary, renderability: card.renderability, adapter: card.adapter,
      decision: 'not-applicable-without-new-adaptation', reason: '本轮不开发adapter、不执行上游演示、不冒充已可渲染。'})),
  allCards: catalog.cards.map((card) => ({cardName: card.cardName, category: card.category, summary: card.summary,
    renderability: card.renderability, adapter: card.adapter, compatibleMainVisuals: card.compatibleMainVisuals,
    sourceCardPath: `${skill}upstream/${library.cards.find((entry) => entry.name === card.cardName).source}`})),
};
write('shotcraft-capability-audit.v1.json', capabilityAudit);
const planBinding = write('evidence-layout-plan.v1.json', plan);
write('evidence-layout-plan.v1.md', `# R2官方布局核心\n\n仅方案与合同，不渲染、不耳听、不登记用户验收；formal=false。\n\n- OfficialSequence：[2336,2614)，同一白纸x64 y160 w1170 h700；右侧出处槽x1278 y180 w550 h300，原图contain；真人窗不动。\n- 父内部2506–2509淡出标题，第二阶段仍同一O01文件。15项Shotcraft保持R1帧窗、文字及items.atFrame；只调整区域、rect和已确认字号。\n- 标题前缀“工业和信息化部办公厅”单独保留；下列三行从2336起以可读底色存在，按真实词元逐行点亮，不把最后一行阅读压到16帧。\n\n|原文行|点亮/进入输出帧|字号|\n|---|---:|---:|\n${[...titleLines, ...paragraphLines].map((entry) => `|${entry.text}|${entry.revealFrame}|${entry.fontSize}|`).join('\n')}\n\n标题三行是点亮；正文四行是6帧进入。字号是父最新52/76/76和50/50/80/68。FDE、保障场景落地未逐字说出，相关词元只作官方引文展示节拍，不假称逐词口型同步；字幕“扎根用户的现场”不变。\n\n- EvidenceScan c017本地框x28 y258 w708 h120；c018 x28 y288 w504 h120。c018原合同仍[2450,2614)，父仅在2563后显出该框与label，防止在原标题上框“扎根”。原组件clock与props完整消费；该可见子窗单独披露，不改合同帧窗。\n- Marker原生fontSize64、KeywordReveal原生fontSize70。关键词88暖黄、V8 title76/detail40/items46、开头“包容和支持”112×1.1均为父独立scoped CSS，不是新增共享组件参数。\n- 官方行是原文摘录重排，不假装官方网页截图；原文与逐行全文拼接逐字核对。\n- U01明确保持R1画面与原声，不重排、不添新闻SFX，不借用另一份政策标题或日期。\n- 157张本地卡里仅5个candidate-only adapter可用；152未适配。正文选EvidenceScan；真人列表保留KeywordReveal。KeywordReveal只允许speaker，不能伪写官方文档为speaker。\n- 输出选择合同：output-selection.derived.v1.json，R1 beats[]形状。数据验证不等于R2画面或听验通过。只绑定已稳定的R1/原文/字幕输入，父R2composition/public/video的最终SHA待其稳定后绑定。\n`);
console.log(JSON.stringify({status: 'plan-files-ready', plan: planBinding}));

const request = structuredClone(oldRequest);
request.revisionId = 'candidate-preview-r2-output-rematch-v1';
request.candidateOutputBinding = {...request.candidateOutputBinding,
  status: 'R2-plan-only-not-execution-binding', r2Plan: planBinding,
  revisionReason: '父已明确R2大字与局部证据需求；只改变信息层区域与O01同文档两阶段展示，不改正文字幕或音频。',
  parentCompositionBound: false, formalEnabled: false};
for (const beat of request.beats) {
  if (beat.mainVisual === 'speaker') beat.region = structuredClone(speakerRegion);
  if (!['output-c017', 'output-c018'].includes(beat.beatId)) continue;
  const phase = plan.officialDocument.phases.find((entry) => entry.selectionBeatId === beat.beatId);
  beat.region = structuredClone(evidenceRegion);
  beat.evidence = {asset: phase.originalImage.asset, rect: phase.effect.rect,
    claimBoundary: plan.officialDocument.claimBoundary,
    presentation: {type: plan.officialDocument.presentationType, layoutPlan: planBinding,
      phaseId: phase.id, sourceSize: phase.originalImage.sourceSize, sourceCrop: phase.originalImage.sourceCrop,
      originalImageGlobalSlot: phase.originalImage.globalEvidenceSlot, primaryReadableLines: phase.lines.map((entry) => entry.id),
      targetText: phase.effect.targetText, targetLineId: phase.effect.targetLineId,
      independentlyViewedSourceImages: true, R2RenderedFrameVerified: false}};
}
write('output-match-request.v1.json', request);
const matchArgs = [`${skill}scripts/match-director-effects.mjs`, '--repo-root', root,
  '--request', `${r2}output-match-request.v1.json`, '--selection', `${r2}output-match-selection.raw.v1.json`,
  '--receipt', `${r2}output-match-receipt.v1.json`, '--lookup', `${r2}output-experience-lookup.v1.json`];
const match = spawnSync(process.execPath, matchArgs, {cwd: root, encoding: 'utf8'});
write('output-match.stdout.v1.txt', match.stdout ?? '');
write('output-match.stderr.v1.txt', match.stderr ?? '');
write('output-match-command.v1.json', {executable: process.execPath, args: matchArgs, exit: match.status, error: match.error?.message ?? null, generatedAt});
assert.equal(match.status, 0, match.stderr);

const selection = json(`${r2}output-match-selection.raw.v1.json`);
selection.revisionId = 'candidate-preview-r2-derived-application-v1';
const changes = [];
for (const beat of selection.beats.filter((entry) => entry.decision === 'apply')) {
  const r1Beat = prior.beats.find((entry) => entry.beatId === beat.beatId);
  if (beat.effectId === 'marker-underline') beat.componentProps.fontSize = 64;
  if (beat.effectId === 'keyword-reveal') {
    assert.equal(r1Beat?.effectId, beat.effectId, `新增关键词效果未取得实际词元时点：${beat.beatId}`);
    assert.deepEqual(beat.texts, r1Beat.texts);
    assert.deepEqual(beat.frames, r1Beat.frames);
    beat.componentProps = {...structuredClone(r1Beat.componentProps), fontSize: 70};
  }
  if (beat.mainVisual === 'speaker') beat.implementationProps = {
    scope: 'parent-R2-only-CSS-not-component-API', keywordColor: '#FFD068',
    ...(beat.effectId === 'marker-underline' ? {markerKeywordFontSize: 88, beforeAfterFontSize: 64} : {}),
    fullPropsConsumptionRequired: true, renderedVerification: false,
  };
  if (['output-c017', 'output-c018'].includes(beat.beatId)) beat.componentProps.label = '';
  changes.push({beatId: beat.beatId, fromR1: r1Beat ? {frames: r1Beat.frames, region: r1Beat.region, componentProps: r1Beat.componentProps} : null,
    toR2: {frames: beat.frames, region: beat.region, componentProps: beat.componentProps, implementationProps: beat.implementationProps ?? null},
    keywordAtFramesAuthority: beat.effectId === 'keyword-reveal' ? sourceBindings.r1Selection : null});
}
selection.beats.push({beatId: 'news-U01', mainVisual: 'real-evidence', frames: {startFrame: 69, endFrameExclusive: 313},
  decision: 'not-needed', reason: '新闻插段没有本人实录字幕及词元锚；只保留来源画面与父R2同步crop，不伪造actual-recording引文。'});
selection.beats.sort((a, b) => a.frames.startFrame - b.frames.startFrame);
selection.derivation = {status: 'named-agent-derived-selection-not-raw-matcher-output', generatedAt,
  plan: planBinding, parentR1: sourceBindings.r1Selection, request: binding(`${r2}output-match-request.v1.json`),
  rawSelection: binding(`${r2}output-match-selection.raw.v1.json`), rawMatchReceipt: binding(`${r2}output-match-receipt.v1.json`),
  canonical: sourceBindings.canonical, immutableSubtitles: sourceBindings.outputCaptions,
  inheritedTimingEvidence: prior.derivation, changes,
  newsNotNeededOrigin: 'explicit-R2-contract-gap-decision-not-fake-ASR-auto-match',
  sameRecordingSameWords: true, applicationReceiptCreated: false, renderVerified: false,
  parentCompositionBindingStatus: 'pending-stable-inputs', formalEnabled: false};
write('output-selection.derived.v1.json', selection);
const validateArgs = [`${skill}scripts/validate-director-selection.mjs`, `${r2}output-selection.derived.v1.json`, root];
const validation = spawnSync(process.execPath, validateArgs, {cwd: root, encoding: 'utf8'});
write('output-derived-validation.stdout.v1.txt', validation.stdout ?? '');
write('output-derived-validation.stderr.v1.txt', validation.stderr ?? '');
write('output-derived-validation.v1.json', {schemaVersion: 'R2-director-selection-validation-execution/v1', generatedAt: new Date().toISOString(),
  executable: process.execPath, args: validateArgs, exit: validation.status, error: validation.error?.message ?? null,
  result: (() => {try {return JSON.parse(validation.stdout);} catch {return {stdout: validation.stdout};}})(),
  selection: binding(`${r2}output-selection.derived.v1.json`), semanticScope: 'selection-contract-only-not-render-or-audio-qa', formal: false});
if (validation.status !== 0) {
  const receipt = {schemaVersion: 'R2-evidence-contract-handoff/v1', generatedAt: new Date().toISOString(),
    status: 'blocked-existing-validator-contract', selection: binding(`${r2}output-selection.derived.v1.json`),
    validation: binding(`${r2}output-derived-validation.v1.json`), matchExit: match.status, validationExit: validation.status,
    reason: '父要求c017/c018空label；现有validator要求label等于非空texts[0]。不改共享Skill，不伪造通过。',
    result: validation.stdout, finalWorking: false, formal: false, renderPerformed: false};
  write('contract-handoff.v1.json', receipt);
  console.log(JSON.stringify(receipt));
  process.exit(validation.status ?? 1);
}

const checks = [];
const check = (id, ok, details) => {checks.push({id, passed: Boolean(ok), details});};
check('official-title-exact', `工业和信息化部办公厅${titleLines.map((entry) => entry.text).join('')}` === fullTitle && officialText.includes(fullTitle), fullTitle);
check('official-sentence-exact', paragraphLines.map((entry) => entry.text).join('') === fullSentence && officialText.includes(fullSentence), fullSentence);
check('source-hashes-still-unchanged', Object.values(sourceBindings).every((entry) => binding(entry.path).sha256 === entry.sha256), '未写R1/09/共享Skill；当前哈希与本次开始快照相同。');
check('continuous-278-frame-document', plan.officialDocument.frames.endFrameExclusive - plan.officialDocument.frames.startFrame === 278 && plan.officialDocument.phases[0].frames.endFrameExclusive === plan.officialDocument.phases[1].frames.startFrame, '同一文件层；改变的是语义展示阶段，不是字幕页界。');
for (const entry of [...titleLines, ...paragraphLines]) {
  check(`word-anchor-${entry.id}`, entry.revealFrame === frameOf(words.get(entry.anchor.wordIds[0])), entry.anchor);
  check(`hold-${entry.id}`, entry.stableHoldFrames >= 30, {stableHoldFrames: entry.stableHoldFrames, minimumFrames: 30, visualQA: false});
  check(`text-width-estimate-${entry.id}`, Array.from(entry.text).length * entry.fontSize <= entry.localRect.width, '保守一字一字号几何估计，不冒充实际字体测量或截图QA。');
}
for (const beat of selection.beats.filter((entry) => entry.effectId === 'keyword-reveal')) {
  for (const item of beat.componentProps.items) {
    const stableAt = item.atFrame + Math.ceil(0.24 * 107);
    check(`keyword-hold-${beat.beatId}-${item.text}`, beat.frames.endFrameExclusive - beat.frames.startFrame - stableAt >= 30,
      {atFrame: item.atFrame, stableAtFrame: stableAt, stableHoldFrames: beat.frames.endFrameExclusive - beat.frames.startFrame - stableAt, authority: sourceBindings.r1Selection});
  }
}
check('news-unchanged', selection.beats.find((entry) => entry.beatId === 'news-U01').decision === 'not-needed' && plan.newsOpening.synchronizedCrop.changedByR2 === false && plan.audioCueHandoff.newsSfxAdded === false, '新闻画面、重排和音效保持R1。');
check('r1-fifteen-effect-windows-and-text-unchanged', selection.beats.filter((entry) => entry.decision === 'apply').length === 15 && prior.beats.filter((entry) => entry.decision === 'apply').every((entry) => {
  const next = selection.beats.find((item) => item.beatId === entry.beatId);
  return next?.effectId === entry.effectId && JSON.stringify(next.frames) === JSON.stringify(entry.frames)
    && next.quote === entry.quote && JSON.stringify(next.texts) === JSON.stringify(entry.texts);
}), '保留父消费所需15项原R1效果帧窗和所有文字。');
check('catalog-5-versus-152', capabilityAudit.count.candidateRenderable === 5 && capabilityAudit.count.adaptationRequired === 152, '不把157卡目录说成157可渲染组件。');
const report = {schemaVersion: 'R2-evidence-layout-check/v1', generatedAt: new Date().toISOString(),
  status: checks.every((entry) => entry.passed) ? 'plan-contract-checks-passed' : 'plan-contract-checks-failed',
  checks, selection: binding(`${r2}output-selection.derived.v1.json`), plan: planBinding,
  boundaries: {renderValidated: false, audioHeard: false, subtitleUncertaintiesResolved: false, formal: false,
    finalInputBindingsPending: true, userAcceptanceClaimed: false}};
write('evidence-layout-check.v1.json', report);
assert.ok(checks.every((entry) => entry.passed), JSON.stringify(checks.filter((entry) => !entry.passed)));
write('contract-handoff.v1.json', {schemaVersion: 'R2-evidence-contract-handoff/v1', generatedAt: new Date().toISOString(),
  status: 'plan-and-selection-valid-awaiting-parent-implementation', plan: planBinding,
  selection: binding(`${r2}output-selection.derived.v1.json`), validation: binding(`${r2}output-derived-validation.v1.json`),
  checks: binding(`${r2}evidence-layout-check.v1.json`), matchReceipt: binding(`${r2}output-match-receipt.v1.json`),
  sharedComponent: sourceBindings.componentModule, readOnlyR1Copy: sourceBindings.copiedR1Component,
  parentR2Composition: null, parentR2PublicDir: null, finalVideo: null, applicationReceipt: null,
  stableSourceHashesBound: true, finalWorking: false, formal: false});
console.log(JSON.stringify({status: report.status, selection: binding(`${r2}output-selection.derived.v1.json`),
  matchExit: match.status, validationExit: validation.status, checkCount: checks.length, renderPerformed: false}));
