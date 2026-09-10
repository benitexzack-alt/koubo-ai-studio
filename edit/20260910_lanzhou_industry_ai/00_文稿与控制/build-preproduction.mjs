import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File} from '../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {renderMotionFirstFrame, renderMotionAction, renderMotionPrompt} from '../../../skills/koubo-remotion-director/scripts/paper-motion-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const episode = 'edit/20260910_lanzhou_industry_ai';
const out = `${episode}/03_导演拆解/paper-v9.1-r1`;
const scriptPath = `${episode}/00_文稿与控制/用户确认原稿.txt`;
const paragraphs = readFileSync(path.join(root, scriptPath), 'utf8').trimEnd().split('\n');
if (paragraphs.length !== 22) throw new Error('USER_PARAGRAPH_COUNT_CHANGED');
const profile = JSON.parse(readFileSync(path.join(root, 'workflow/active-director-profile.v1.json'), 'utf8'));
const request = JSON.parse(readFileSync(path.join(root, 'skills/koubo-remotion-director/templates/director-preproduction-request.v1.json'), 'utf8'));
request.taskId = 'task-20260910T105427Z-a149c6de';
request.revisionId = '20260910-lanzhou-industry-ai-paper-v9.1-r1';
request.requestId = `${request.revisionId}-pre-shoot`;
request.inputScript = {path: scriptPath, sha256: sha256File(path.join(root, scriptPath)), authority: 'user-confirmed-script', role: 'provisional-authority'};
request.directorProfile = {path: 'workflow/active-director-profile.v1.json', profileId: profile.profileId, profileVersion: profile.profileVersion};
request.outputs = Object.fromEntries(Object.entries({routeLockPath: 'director-route-lock.v1.json', planPath: 'director-plan.v1.json', assetSheetPath: '导演素材执行单.md', firstFramePromptManifestPath: 'first-frame-prompts.v1.json', runningHubPromptManifestPath: 'runninghub-image-to-video-prompts.v1.json', runningHubPromptSheetPath: '图生视频提示词.md', aiGeneratedVideoPromptManifestPath: 'ai-generated-video-prompts.v1.json', aiGeneratedVideoPromptSheetPath: 'AI情景视频清单.md', compileReceiptPath: 'compile-receipt.v1.json', validationReceiptPath: 'validation-receipt.v1.json'}).map(([key, file]) => [key, `${out}/${file}`]));

const meanings = [
  '开场是个人趋势判断，未证实最后一次；不配不可逆淘汰或财富倒计时。',
  '本人看好熟悉行业加AI服务本地、尝试外地；不是收益承诺。',
  '既有经历和服务能力的差别不会因同用AI自动消失。',
  '销售、开店等经历中的客户了解可继续使用，不是学AI就归零。',
  '通用赞美句不能讲清这家产品为什么适合客户。',
  '老板对价格、适用人群和能力边界的回答才是内容原料。',
  '老板回答经过AI整理和老板核对后，才作为对外内容讲出去。',
  '经验有机会被更多人看见，不等于搜索推荐或曝光必达。',
  '理解、印象与真实需求可能形成选择机会，不保证成交。',
  '只有内容而无产品或服务，不能接住客户的生意。',
  '具备行业理解和履约能力后，可以尝试向外地同行介绍服务。',
  'AI增加整理制作的承载能力，客户信任仍依赖作品和服务。',
  '人在兰州可以主动调查外地是否有人需要自己会做的事。',
  '已有本地生活条件可能节省开支、留出试错时间；不是人人更便宜。',
  '真实学习制作有成本，省一些钱只能多留几次尝试，不是零成本。',
  '提问转场：客户会用AI以后，服务还承担什么。',
  '谈清工作范围、协作和交付；用不上时仍需查问题。',
  '服务需承担客户没时间做、不会检查和难持续的工作。',
  '到店了解实际情况后，才知道通用方案哪里不适用。',
  '本人已有付费交付但不等于已经营稳定，不虚构客户或收入。',
  '先在熟悉业务中练习，未了解行业不能急着给老板当顾问。',
  '本人留在兰州继续服务，明确能承担与做不了的边界。',
];
request.beats = paragraphs.map((spokenLine, i) => ({id: `B${String(i + 1).padStart(2, '0')}`, order: i + 1, spokenLine, coreMeaning: meanings[i], kind: i === 19 ? 'personal-experience' : 'speaker-judgment', visualDecision: {class: 'speaker', producer: 'user', fallback: 'blocked', reason: '保留本人判断、经历和解释；未收到真实补充素材，不伪造证据。'}, overlayDecision: {class: 'remotion-information', producer: 'codex-remotion', role: i === 21 ? 'cta' : i === 0 ? 'risk-caveat' : 'keyword', items: []}, postShoot: {status: 'awaiting-recorded-audio', shotcraft: 'pending-recorded-audio-and-asset-intake', keepOriginalWording: true}}));

const rect = (x, y, width, height) => ({x, y, width, height});
const quad = (r) => [[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height], [r.x, r.y + r.height]];
function sceneFor(paragraph, title, duration, groups, blanks, actions, meaning, excluded, forbidden = [], predecessors = []) {
  const beat = request.beats[paragraph - 1];
  const n = groups.length;
  const width = n === 4 ? 0.205 : 0.28;
  const xs = n === 4 ? [0.055, 0.285, 0.515, 0.745] : [0.055, 0.36, 0.665];
  const objects = groups.map(([name, label, material], i) => ({id: `G${i + 1}`, name, material: `${material}；本组上沿正面有且仅有一张暖白空白牌，独立刚性支架，支架不与活动部件相连；画面横向第${['一','二','三','四'][i]}组`, depth: (i % 3) + 1, label}));
  const surfaces = objects.map((g, i) => ({nodeId: `N${i + 1}`, groupId: g.id, surfaceId: `${g.id}-rigid-label-card`, box: rect(xs[i] + 0.005, 0.2, width - 0.01, 0.105)}));
  const scene = {
    title, archetype: 'mechanical-causality', durationSeconds: duration,
    objectGroups: objects.map(({label: _label, ...group}) => group),
    nodes: objects.map((g, i) => ({id: `N${i + 1}`, label: g.label, groupId: g.id, textVisibility: 'paper-label'})),
    textPlan: surfaces.map((s, i) => ({nodeId: s.nodeId, text: objects[i].label, groupId: s.groupId, surfaceId: s.surfaceId, anchorQuad: quad(s.box), maxChars: 8, role: 'diegetic-node-label', embeddingMode: 'first-frame-baked', motionConstraint: 'rigid-surface', enterStageId: 'initial', persistence: 'initial-to-end', firstReadableFrame: 0, stageOffsetFrames: 0, occlusionOwner: 'none', ocrRequired: true})),
    screenTextPlan: [], labelBindingPolicy: {unlabeledObjectGroups: []},
    readableTextPolicy: {silentTruncationForbidden: true, slashMergeForbidden: true, maximumSimultaneousLabels: n},
    layoutContract: {coordinateSpace: 'normalized-0-to-1', contentSafeRect: rect(0.04, 0.12, 0.92, 0.64), subtitleReservedRect: rect(0.04, 0.81, 0.92, 0.17), generatedDecorationPolicy: 'forbidden', layoutInterpretation: {objectGroupBoxes: 'broad-composition-zones', paperLabelSurfaceBoxes: 'reserved-placement-zones', exactPixelMatchRequired: false, contentAndSubtitleContainmentIsHard: true}, objectGroupBoxes: objects.map((g, i) => ({groupId: g.id, box: rect(xs[i], 0.17, width, 0.54)})), paperLabelSurfaceBoxes: surfaces},
    prompt: {generatedReadableTextAllowed: false},
    motionContract: {schemaVersion: 'koubo-paper-motion-contract/v1', meaning: {sourceQuote: beat.spokenLine, viewerTakeaway: meaning, excludedOutcomes: excluded}, parts: [...objects.map((g, i) => ({id: `L${i + 1}`, name: `${g.label}固定纸牌`, groupId: g.id, surfaceId: surfaces[i].surfaceId, kind: 'label', mount: 'independent-fixed-stand'})), ...blanks.map(([id, name, groupId]) => ({id, name, groupId, kind: 'blank-part'}))], initialLocations: blanks.map(([partId, _name, groupId]) => ({partId, groupId})), actions: actions.map((a, i) => ({id: `A${i + 1}`, stageId: `S${i + 1}`, ...a})), allowedTransfers: actions.filter((a) => a.fromGroupId !== a.toGroupId).map(({partId, fromGroupId, toGroupId}) => ({partId, fromGroupId, toGroupId})), forbiddenTransfers: forbidden.map((edge) => ({...edge, sourceQuote: beat.spokenLine})), requiredPredecessors: predecessors.map((p) => ({...p, sourceQuote: beat.spokenLine})), finalLocations: [], dynamicValidation: {requiredBeforeBatch: true, staticApprovalIsNotDynamicApproval: true, automaticRetryAllowed: false}},
    editorialScope: {illustrationOnly: true, noRealClientEvidence: true, noGuaranteedOutcome: true, timestamps: 'pending-post-shoot-rebind', firstReadableFrame: 0, insertOnlyAfterAllLabelConceptsHaveBeenSpoken: true, noFreezeExtension: true, shortSpokenWindowDisposition: 'return-to-speaker-or-replan-not-speedup', requiredInspection: ['首帧中文字逐字核对', '每个动作开始中间结束抽帧', '正常速度静音复述', '与实录原句对位', '全程文字无遮挡'], explanation: meaning},
  };
  const positions = new Map(scene.motionContract.initialLocations.map((s) => [s.partId, s.groupId]));
  for (const action of scene.motionContract.actions) positions.set(action.partId, action.toGroupId);
  scene.motionContract.finalLocations = [...positions].map(([partId, groupId]) => ({partId, groupId}));
  scene.stages = scene.motionContract.actions.map((action, i) => ({id: action.stageId, order: i + 1, subject: scene.motionContract.parts.find((p) => p.id === action.partId).groupId, landingNodeIds: [], action: renderMotionAction(scene, action), sfxRole: action.operation === 'slide' ? 'paper-slide' : action.operation === 'unfold' ? 'paper-unfold' : 'paper-click'}));
  scene.prompt.firstFrame = renderMotionFirstFrame(scene);
  scene.prompt.motion = renderMotionPrompt(scene);
  beat.kind = 'process-explanation';
  beat.visualDecision = {class: 'paper-editorial', producer: 'user', fallback: 'blocked', reason: meaning};
  delete beat.overlayDecision;
  beat.paperScene = scene;
  return scene;
}
const move = (partId, fromGroupId, toGroupId, startSeconds, endSeconds, box, operation = 'slide') => ({partId, fromGroupId, toGroupId, startSeconds, endSeconds, operation, sweptRect: box});

sceneFor(4, '经验留下来，客户了解用起来', 7,
  [['销售经历档案架', '销售', '暖白厚纸页立架，前景纸页边缘遮住后方棉线；所有立架退到上半部，前方两条滑道横贯三组，不穿过纸盒'], ['门店经验纸盒', '开过店', '浅灰纤维纸盒，盒内少量无字经验纸页；纸盒位于滑道后方，连续通道内没有挡板'], ['客户了解汇集台', '客户的了解', '深蓝低台和暖黄承接凹槽，背后是高低错落的实心纸层；凹槽入口与前方两条滑道同高']],
  [['sales', '来自销售经历的无字经验纸片', 'G1'], ['store', '来自开店经历的无字经验纸片', 'G2']],
  [move('sales', 'G1', 'G3', 1, 3, rect(0.1, 0.42, 0.74, 0.1)), move('store', 'G2', 'G3', 3.5, 5.5, rect(0.4, 0.57, 0.46, 0.1))],
  '从既有销售、开店经历中取用客户了解，原经验纸架仍保留，不将经验扔掉重来。', ['AI凭空生成经历', '把经验丢弃', '客户了解保证收入'], [], []);

sceneFor(7, '回答整理成内容，必须经过老板核对', 8,
  [['老板回答收集盘', '回答', '几层暖白无字纸页放在前景低托盘'], ['AI整理槽', '归类', '深蓝卡纸分格槽，入口与出口在牌面下方'], ['老板人工核对台', '老板核对', '暖白台面、侧旁无脸纸质人物和无字侧向控制杆；控制杆及转轴完全在出纸通道后侧，不压住纸页，不产生印记；纸页净空通道一直保持开放'], ['对外内容展示架', '讲出去', '暖黄空槽与竖立的纸质取景框，框上无标志，未摆放成品']],
  [['draft', '同一叠无字回答纸页', 'G1'], ['lever', '老板位置的无字右向控制杆（独立后侧转轴，运动全程在出纸通道外）', 'G3']],
  [move('draft', 'G1', 'G2', 0.6, 1.7, rect(0.1, 0.46, 0.32, 0.12)), move('draft', 'G2', 'G3', 2, 3.1, rect(0.33, 0.46, 0.31, 0.12)), move('lever', 'G3', 'G3', 3.4, 4.7, rect(0.55, 0.34, 0.14, 0.08), 'rotate-rigid'), move('draft', 'G3', 'G4', 5.1, 6.5, rect(0.56, 0.46, 0.33, 0.12))],
  '同一材料先收集和归类，再让老板核对，完成核对动作后才移往讲解展示架；不表示所有文稿天然正确。', ['跳过老板核对', 'AI自行盖章当成人工确认', '讲出去等于成交'], [], [{beforeActionId: 'A2', actionId: 'A3'}, {beforeActionId: 'A3', actionId: 'A4'}]);

sceneFor(10, '只有内容，缺产品服务就接不住', 6,
  [['内容介绍起点', '内容', '暖白折页在前景连续空滑道上，滑道从左方通到客户桌前，经过中间空架的前方而不穿过架子'], ['缺少产品服务的空承台', '产品或服务', '中景是始终空着的产品架和低位接询盘，没有产品、服务成品或回寄件'], ['客户侧等待区', '客户', '远景暖白无脸纸人留在桌旁；桌前能接到内容折页，另一条回询通道通向中间空接询盘，没有订单或钱币']],
  [['leaflet', '无字内容折页', 'G1'], ['inquiry', '无字客户咨询纸片（不是交付成品）', 'G3']],
  [move('leaflet', 'G1', 'G3', 0.6, 2.4, rect(0.1, 0.41, 0.77, 0.09)), move('inquiry', 'G3', 'G2', 2.8, 4.5, rect(0.43, 0.56, 0.42, 0.09))],
  '反例里内容可以传到客户，咨询也可以回来；但中间产品服务架始终空着，没有东西可交回客户，不能把曝光当成交。', ['内容无法传播', '用内容补造不存在的产品', '收到咨询直接等于成交', '所有商家都缺产品'], []);

sceneFor(11, '向外地介绍服务，不是订单自动到来', 7,
  [['已有工作展示台', '工作做好', '前景厚纸作品册，册页完全无字，没有证书与印记'], ['服务介绍展开区', '介绍', '中景浅灰纸质展台，面对右侧的独立空白服务折页'], ['外地同行待沟通桌', '外地同行', '后景另一张纸质小桌与无脸人物，和左方保持距离，没有握手、订单和付款物件']],
  [['portfolio', '无字服务折页（中央竖直折轴，展开终态宽0.20高0.20，不超出中间展台）', 'G2']],
  [move('portfolio', 'G2', 'G2', 1, 4.8, rect(0.39, 0.43, 0.22, 0.24), 'unfold')],
  '在具备行业理解和工作能力的前提下，把服务展开介绍给远方的潜在同行；对方仍在待沟通位置，没有成交动作。', ['全国订单自动到来', '介绍就等于被接受', 'AI发明远程接单'], [{partId: 'portfolio', fromGroupId: 'G2', toGroupId: 'G3'}]);

sceneFor(15, '不是零成本，留出继续尝试的余地', 7,
  [['制作成本纸槽', '成本', '前景少量无字矩形纸垫表示有限可用投入；左槽前部有不透明收纳口，投入纸垫滑入后不可再取回；不用钱币、金额或计数标记'], ['继续修改工作台', '继续改', '中景纤维纸工作台，带一份需调整的完全无字折页；通向下一承台的滑道净空，作品无需变小即可通过'], ['下一次尝试承台', '多试几次', '后景深蓝空承台，有一个空白作品容纳槽，未摆出成功结果']],
  [['reserve', '朝向本组遮蔽收纳口的无字投入纸垫（代表一次制作投入，不是作品材料）', 'G1'], ['work', '无字作品折页（中央折轴，展开终态宽0.14高0.14）', 'G2']],
  [move('reserve', 'G1', 'G1', 0.8, 2.2, rect(0.09, 0.41, 0.2, 0.13)), move('work', 'G2', 'G2', 2.7, 4, rect(0.41, 0.52, 0.17, 0.18), 'unfold'), move('work', 'G2', 'G3', 4.4, 5.6, rect(0.41, 0.52, 0.46, 0.18))],
  '修改需要消耗投入，有限余地允许把作品带入下一次尝试，末端只是继续试，不是成功或盈利。', ['零成本', '投入会自动回本', '试几次必成', '成本数量等于具体金额'], [], [{beforeActionId: 'A1', actionId: 'A2'}, {beforeActionId: 'A2', actionId: 'A3'}]);

sceneFor(17, '服务先说清楚范围、协作和交付', 6,
  [['工作范围纸盘', '做哪些工作', '前景暖白盘与一张完全无字的范围卡，正前方通向交付夹的滑道净空'], ['双方协作纸盘', '谁配合', '中景浅灰盘与一张完全无字的协作卡；托盘后退，不侵入范围卡滑道，两条轨道高度分离'], ['交付约定文件夹', '交什么东西', '后景纸质文件夹，开始为空，夹子保持打开，两条卡片入口与对应滑道齐平'], ['问题复查工作台', '查问题', '暖黄独立台面和无字放大镜形纸框，不出现通过印记']],
  [['scope', '无字工作范围卡', 'G1'], ['cooperation', '无字配合约定卡', 'G2']],
  [move('scope', 'G1', 'G3', 0.8, 2.4, rect(0.1, 0.4, 0.55, 0.1)), move('cooperation', 'G2', 'G3', 2.8, 4.2, rect(0.34, 0.54, 0.31, 0.1))],
  '把工作范围与谁来配合放到交付约定里；复查工作台保持开放作为后续责任，不演成验收已经通过，也不演成所有交付都失败。', ['只有工具生成就收费', '自动通过验收', '无人承担后续问题'], [], []);

const target = path.join(root, out, 'director-request.v2.json');
if (existsSync(target)) throw new Error(`REFUSE_OVERWRITE:${target}`);
mkdirSync(path.dirname(target), {recursive: true});
writeFileSync(target, `${JSON.stringify(request, null, 2)}\n`, {flag: 'wx'});
console.log(JSON.stringify({request: target, paragraphs: paragraphs.length, paperScenes: request.beats.filter((b) => b.paperScene).length, semanticReviews: 'required-before-compile', productionEligible: false}));
