import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const videoId = 'AI_BEST_WORST_20260812_talk01';
const durationSeconds = 525.234;
const experimentId = 'v8-semantic-continuity-sfx';
const previewStart = 0;
const previewEnd = 45;
const editRoot = 'edit/20260812_ai_best_worst';
const mediaRoot = 'remotion/public/media/ai-best-worst-20260812';
const sourceVideo =
  'source/20260812_ai_best_worst/R01_AI在支配你还是你掌控AI_口播原片.MOV';
const talkProxy = `${mediaRoot}/main-30fps.mp4`;
const captions =
  'remotion/public/data/AI_BEST_WORST_20260812_talk01.bilingual.v1.json';
const runtimePlan = 'remotion/src/data/AIBestWorstV80.visual-plan.v1.json';
const runtimeSfx = 'remotion/src/data/AIBestWorstV80.sfx.v1.json';
const editPlan = `${editRoot}/visual-plan_AI_BEST_WORST_20260812_talk01_v8.json`;
const editSfx = `${editRoot}/sfx-cue-sheet_AI_BEST_WORST_20260812_talk01_v8.json`;
const jobPath = 'workflow/jobs/20260812_ai_best_worst_v80.production.json';

const media = {
  customerService: `${mediaRoot}/S01_customer_service_dual_path_30fps_silent.mp4`,
  factory: `${mediaRoot}/S02_factory_restructure_30fps_silent.mp4`,
  oldProcess: `${mediaRoot}/S03_old_process_bottleneck_30fps_silent.mp4`,
};
const evidence = {
  bestWorst: `${mediaRoot}/evidence/E01_斯坦福未来十年最好或最坏_第09页.png`,
  customerStudy: `${mediaRoot}/evidence/E02_NBER客服实验_第02页.png`,
  youthEmployment: `${mediaRoot}/evidence/E03_斯坦福青年就业16边界_第01页.png`,
  jCurve: `${mediaRoot}/evidence/E04_NBER生产率J曲线_第02页.png`,
};

const primitive = (start, end, role, family, title, value) => ({
  start,
  end,
  component: 'primitive',
  family,
  role,
  title,
  detail: '',
  items: [],
  primitive: value,
});

const sceneSpecs = [
  {start: 0.3, end: 5, component: 'statement', family: 'direct-statement', role: 'chapter', title: '30年 → 这一次等不了30年', detail: '技术变化正在压缩位置重排的时间。', items: ['周期压缩', '位置变化'], sourceOverride: 'v3-chapter-sweep-a.wav', volumeOverride: 0.22},
  primitive(5.06, 12.74, 'comparison', 'branch-fork', '同样一套 AI，结果为什么不同？', {kind: 'fork', title: '同样一套 AI，结果为什么不同？', input: '同一套 AI', left: '价值被稀释', right: '能力被放大', leftHint: '只剩标准执行', rightHint: '判断、取舍、担责'}),
  {start: 12.74, end: 21.59, component: 'statement', family: 'direct-statement', role: 'keyword', title: '工具差距，不是核心差距', detail: '真正的分界，在于掌控权。', items: ['AI支配你', '你掌控AI'], sourceOverride: 'v1-keyword-tick.wav', volumeOverride: 0.22},
  {start: 21.59, end: 27.61, component: 'statement', family: 'responsibility-statement', role: 'node', title: 'AI产出答案，人对结果负责', detail: '判断、取舍、最终定夺，责任不能外包。', items: ['判断', '取舍', '负责'], sourceOverride: 'v3-soft-card-pop-b.wav', volumeOverride: 0.23},
  primitive(27.61, 45, 'line', 'decision-chain', 'AI给出一版后，人还要做什么？', {kind: 'decision-chain', title: 'AI给出一版后，人还要做什么？', items: ['盘点真实任务', '补充真实背景', '判断与取舍', '决定最终采用', '对结果负责']}),
  {start: 45.1, end: 55.58, component: 'question-grid', family: 'question-list', role: 'list', title: 'AI做出一版后，再问三次', detail: '这三个答案，决定AI是在替你执行，还是在放大你。', items: ['你补了什么？', '你做了哪些决定？', '最终采用了哪些？']},
  {start: 55.58, end: 66.64, component: 'evidence', family: 'source-evidence', role: 'evidence', title: '未来十年：最好，也可能最坏', detail: '关键不只看技术创造多少价值，还要看人的位置如何变化。', items: ['斯坦福 HAI', '布林约尔松', '条件性判断'], evidenceSrc: evidence.bestWorst, evidenceLabel: 'Stanford HAI · 原始出处页'},
  {start: 66.64, end: 69.26, component: 'definition', family: 'hero-definition', role: 'keyword', title: '最好与最坏，可以同时发生', detail: '听起来矛盾，是因为三本账不能混在一起。', items: []},
  primitive(69.26, 81.61, 'number', 'three-ledgers', '技术红利，最后落在谁身上？', {kind: 'three-ledgers', title: '技术红利，最后落在谁身上？', items: ['技术创造的总价值', '消费者得到的便利', '劳动者的收入与议价']}),
  primitive(81.61, 96.69, 'comparison', 'branch-fork', 'AI进入任务以后，会走向哪一边？', {kind: 'fork', title: 'AI进入任务以后，会走向哪一边？', input: '真实任务', left: '更便宜的执行', right: '更强的判断', leftHint: '被拆成标准步骤', rightHint: '被AI增强能力'}),
  {start: 96.69, end: 106.66, component: 'question-grid', family: 'question-list', role: 'list', title: '客服里的标准问题', detail: '当企业只盯成本，最容易先拿走的是标准执行。', items: ['订单在哪里？', '怎么退款？', '规则怎么解释？']},
  {start: 106.66, end: 117.69, component: 'generated-media', family: 'annotated-media', role: 'media', title: '客服：替代与增强的两条路径', detail: '机器回答标准问题，也可以站在员工旁边提供判断提示。', items: [], src: media.customerService, disclosure: 'AI生成 · 概念画面', badge: '场景演绎 · 不作事实证据', requestId: '20260812-AI-BEST-WORST-S01'},
  {start: 117.69, end: 129.59, component: 'flow', family: 'process-rail', role: 'line', title: 'AI站在员工旁边，应该提示什么？', detail: '提示不是替代负责，而是把经验送到一线。', items: ['识别客户卡点', '调用相似案例', '提醒表达边界', '处理完成后复盘']},
  primitive(129.59, 147.74, 'line', 'training-ladder', '新人如何更快接近熟手？', {kind: 'training-ladder', title: '新人如何更快接近熟手？', items: ['问老员工', '翻资料', '犯错再改', 'AI推送经验', '接近熟手']}),
  primitive(147.74, 153.63, 'comparison', 'branch-fork', '同一个客服场景，两种结果', {kind: 'fork', title: '同一个客服场景，两种结果', input: 'AI进入一线', left: '任务被拆走', right: '能力被放大', leftHint: '人只剩更少的活', rightHint: '人学得更快'}),
  {start: 153.63, end: 168.61, component: 'definition', family: 'hero-definition', role: 'keyword', title: '图灵陷阱', detail: '只追求让机器越来越像人，目标很容易滑向替代人。', items: []},
  {start: 168.61, end: 178.71, component: 'layer-map', family: 'activated-node-map', role: 'node', title: '增强人的四个位置', detail: 'AI被设计成辅助判断，人就还有成长空间。', items: ['看清问题', '检查错误', '补足知识', '复盘经验']},
  {start: 178.71, end: 192.45, component: 'comparison', family: 'comparison-bars', role: 'comparison', title: '别只问“有没有上AI”', detail: '先看AI进来以后，人到底发生了什么。', items: ['学得更快', '只剩更少的活']},
  primitive(192.45, 204.64, 'line', 'training-ladder', '短期效率，可能拿走长期练级台阶', {kind: 'training-ladder', title: '短期效率，可能拿走长期练级台阶', items: ['基础执行', '训练与复核', '例外问题', '形成判断'], removedIndex: 1}),
  {start: 204.64, end: 211.55, component: 'evidence', family: 'source-evidence', role: 'evidence', title: '低经验员工改善更明显', detail: '这是客服实验的方向性结果，不等于所有岗位都一样。', items: ['5,179名客服', '平均生产率提升14%', '低经验员工改善更明显'], evidenceSrc: evidence.customerStudy, evidenceLabel: 'NBER · Generative AI at Work'},
  {start: 211.55, end: 221.69, component: 'status', family: 'fact-inference-stack', role: 'node', title: '事实与风险判断要分开', detail: '研究支持能力改善；练级台阶会不会被压缩，是结合就业结构的风险推断。', items: ['研究事实：低经验员工改善更明显', '风险判断：基础训练空间可能收缩']},
  primitive(221.69, 238, 'line', 'training-ladder', '职业里的任务顺序正在变化', {kind: 'training-ladder', title: '职业里的任务顺序正在变化', items: ['基础执行', '例外问题', '积累判断', '承担结果'], removedIndex: 0}),
  {start: 238, end: 249.77, component: 'question-grid', family: 'question-list', role: 'list', title: '基础执行先被拿走，新人靠什么练？', detail: '企业还愿不愿意训练、复核和带教，会影响未来的位置。', items: ['新人拿什么练？', '企业还愿意带？', '判断从哪里长出来？']},
  {start: 249.77, end: 253.96, component: 'evidence', family: 'source-evidence', role: 'evidence', title: '16%从哪里来？', detail: '先看原始研究，再说适用边界。', items: ['美国数据', '22至25岁', 'AI暴露度最高职业'], evidenceSrc: evidence.youthEmployment, evidenceLabel: 'Stanford Digital Economy Lab · 原始出处页'},
  primitive(253.96, 263.65, 'number', 'bounded-number', '早期劳动者就业相对下降', {kind: 'bounded-number', title: '早期劳动者就业相对下降', value: '≈ 16%', boundaries: ['美国高频行政薪酬数据', '22至25岁早期劳动者', 'AI暴露度最高职业']}),
  {start: 263.65, end: 274.61, component: 'status', family: 'boundary-stack', role: 'list', title: '这个16%，不能被说大', detail: '数据只能在原研究边界内使用。', items: ['不是全球所有年轻人', '不是所有行业', '限定美国、特定年龄和高暴露职业']},
  {start: 274.61, end: 282.7, component: 'statement', family: 'direct-statement', role: 'keyword', title: '压力先落在入门执行上', detail: '标准化、容易检查、企业又愿意直接自动化。', items: ['标准化', '易检查', '可自动化']},
  {start: 282.7, end: 300.81, component: 'question-grid', family: 'role-list', role: 'list', title: '职业名称太大，不能直接下结论', detail: '先把职业拆成一个个具体动作。', items: ['销售，不只会卖东西', '设计师，不只会出图', '会计，不只会填表', '老板，不只会拍板']},
  {start: 300.81, end: 321.71, component: 'layer-map', family: 'task-matrix', role: 'node', title: '你的位置，藏在这些具体任务里', detail: '把工作拆开，才能看出哪些该交给AI，哪些必须由人负责。', items: ['AI能先做一版', '必须懂行业背景', '要听懂真实的人', '需要判断并担责']},
  {start: 321.71, end: 330.8, component: 'evidence', family: 'source-evidence', role: 'evidence', title: '为什么AI没有马上变成利润？', detail: '通用技术需要流程、组织与技能的互补投入。', items: ['生产率J曲线', '互补投资', '效果滞后'], evidenceSrc: evidence.jCurve, evidenceLabel: 'NBER · The Productivity J-Curve'},
  primitive(330.8, 341.73, 'number', 'j-curve', '通用技术，不是装上就见效', {kind: 'j-curve', title: '通用技术，不是装上就见效', items: ['先投入与重构', '效果可能滞后', '流程跑通后释放价值']}),
  {start: 341.73, end: 351.8, component: 'generated-media', family: 'annotated-media', role: 'media', title: '电力进工厂，也要重构整套系统', detail: '布局、流程、管理方式和人的技能，都要跟着改。', items: [], src: media.factory, disclosure: 'AI生成 · 概念画面', badge: '场景演绎 · 不作事实证据', requestId: '20260812-AI-BEST-WORST-S02'},
  {start: 351.8, end: 359.77, component: 'flow', family: 'process-rail', role: 'line', title: '模型更新，不等于公司流程更新', detail: '买工具只是起点，业务链条不会自动重写。', items: ['模型更新', '员工开会员', '老板买工具', '流程仍待重构']},
  {start: 359.77, end: 370.77, component: 'generated-media', family: 'annotated-media', role: 'media', title: 'AI为什么容易停在演示层？', detail: '客户、数据、复核、责任和纠错都没有接入原流程。', items: [], src: media.oldProcess, disclosure: 'AI生成 · 概念画面', badge: '场景演绎 · 不作事实证据', requestId: '20260812-AI-BEST-WORST-S03'},
  {start: 370.77, end: 382.37, component: 'status', family: 'status-stack', role: 'list', title: '未来几年，三件事可能同时发生', detail: '技术繁荣和个体压力，并不矛盾。', items: ['模型越来越强', '企业还没完全吃到效率', '一部分旧任务先被削弱']},
  {start: 382.37, end: 397, component: 'comparison', family: 'comparison-bars', role: 'comparison', title: '新闻里的繁荣，落到个人身上是什么？', detail: '同一轮变化，可以产生完全不同的体感。', items: ['模型能力上升', '报价与初稿变便宜', 'AI先做你的工作？']},
  {start: 397, end: 410.58, component: 'question-grid', family: 'consumer-list', role: 'list', title: '消费者确实越来越方便', detail: '消费者福利变多，不会自动推导出劳动者更值钱。', items: ['搜索', '翻译', '写作', '制图与表格']},
  primitive(410.58, 428.73, 'number', 'three-ledgers', '技术红利，要分三本账看', {kind: 'three-ledgers', title: '技术红利，要分三本账看', items: ['技术创造的总价值', '消费者拿到的便利', '劳动者收入与议价']}),
  {start: 428.73, end: 439.71, component: 'statement', family: 'direct-statement', role: 'keyword', title: '社会更方便，不等于你的能力更稀缺', detail: '这正是“最好”和“最坏”可以同时发生的原因。', items: ['便利上升', '稀缺性未必上升']},
  {start: 439.71, end: 447.7, component: 'definition', family: 'hero-definition', role: 'chapter', title: '普通人，从现在做三件事', detail: '不追逐空泛工具清单，把能力留在真实任务里。', items: []},
  {start: 447.7, end: 460.79, component: 'layer-map', family: 'activated-node-map', role: 'node', title: '第一，保留一个真实领域', detail: '不是只会用AI，而是真正看懂一种现实问题。', items: ['一个行业', '一个客户', '一类场景', '真实问题']},
  primitive(460.79, 476.85, 'line', 'decision-chain', '第二，留下可复用资产', {kind: 'decision-chain', title: '第二，留下可复用资产', items: ['流程', '模板', '案例', '反馈', '失败记录']}),
  {start: 476.85, end: 490.79, component: 'question-grid', family: 'calibration-list', role: 'list', title: '第三，用真实任务持续校准', detail: '拿手里的真实工作反复试，让判断接受现实检验。', items: ['哪里省时间？', '哪里出错？', '哪里还需要人？', '哪里必须由你拍板？']},
  {start: 490.79, end: 506.96, component: 'statement', family: 'direct-statement', role: 'keyword', title: '决定你位置的，不是工具和提示词', detail: '位置变化不需要三十年，但能力也不会靠安装软件自动形成。', items: ['不看工具数量', '不背提示词', '看真实能力']},
  primitive(506.96, 515.68, 'line', 'decision-chain', '未来十年，真正值得积累什么？', {kind: 'decision-chain', title: '未来十年，真正值得积累什么？', items: ['看懂真实问题', '组织机器和工具', '留下可复用资产', '对结果负责']}),
  {start: 515.68, end: 521.67, component: 'definition', family: 'hero-definition', role: 'keyword', title: 'AI会放大人的意图', detail: '问题不只是AI能做什么，而是你的意图指向哪里。', items: []},
  {start: 521.67, end: 525.234, component: 'closing', family: 'closing-signature', role: 'confirm', title: '你在掌控AI，还是被AI支配？', detail: '我是超哥，在兰州AI创业。', items: []},
];

const coverageByFamily = {
  'direct-statement': 0.31,
  'responsibility-statement': 0.31,
  'branch-fork': 0.4,
  'decision-chain': 0.4,
  'question-list': 0.38,
  'source-evidence': 0.42,
  'hero-definition': 0.32,
  'three-ledgers': 0.4,
  'annotated-media': 1,
  'process-rail': 0.4,
  'training-ladder': 0.4,
  'activated-node-map': 0.4,
  'comparison-bars': 0.38,
  'fact-inference-stack': 0.39,
  'bounded-number': 0.4,
  'boundary-stack': 0.39,
  'role-list': 0.38,
  'task-matrix': 0.4,
  'j-curve': 0.4,
  'status-stack': 0.39,
  'consumer-list': 0.38,
  'calibration-list': 0.38,
  'closing-signature': 0.29,
};

const roleFiles = {
  chapter: ['v3-chapter-sweep-a.wav', 'v2-section-sweep.wav', 'v1-section-air.wav', 'waic-section-whoosh.wav'],
  comparison: ['remotion-ui-switch.wav', 'v2-card-slide.wav', 'v1-card-reveal.wav', 'v1-ui-click.wav', 'v3-soft-card-pop-a.wav'],
  keyword: ['v1-keyword-tick.wav', 'v3-soft-card-pop-a.wav', 'v3-soft-card-pop-b.wav', 'waic-card-pop.wav', 'v1-section-air.wav'],
  node: ['v3-soft-card-pop-b.wav', 'waic-node-connect.wav', 'v3-line-connect-a.wav', 'v2-node-select.wav', 'v1-node-connect.wav'],
  line: ['v3-line-connect-a.wav', 'v1-node-connect.wav', 'v2-node-select.wav', 'waic-node-connect.wav', 'remotion-whoosh.wav'],
  list: ['v3-list-tick-a.wav', 'v3-list-tick-b.wav', 'v1-ui-click.wav', 'v2-ui-click.wav', 'remotion-mouse-click.wav'],
  evidence: ['v1-camera-shutter.wav', 'v2-evidence-shutter.wav', 'v3-evidence-paper-a.wav', 'remotion-page-turn.wav'],
  media: ['v3-media-whoosh-a.wav', 'v3-media-whoosh-b.wav', 'remotion-whoosh.wav', 'v2-zoom-out.wav', 'waic-section-whoosh.wav'],
  number: ['v2-number-affirmation.wav', 'v3-number-settle-a.wav', 'waic-thesis-impact.wav', 'v1-confirm-soft.wav'],
  confirm: ['v1-confirm-soft.wav', 'v3-cta-confirm-a.wav', 'remotion-mouse-click.wav'],
};
const volumeByRole = {
  chapter: 0.22,
  comparison: 0.23,
  keyword: 0.22,
  node: 0.23,
  line: 0.22,
  list: 0.21,
  evidence: 0.22,
  media: 0.2,
  number: 0.22,
  confirm: 0.23,
};

const manifest = JSON.parse(
  readFileSync(path.join(projectRoot, 'assets/sfx/koubo-sfx-v8/manifest.json'), 'utf8'),
);
const manifestByOutput = new Map(manifest.items.map((item) => [item.output, item]));
const sourceUse = new Map();
const sourceCount = new Map();

const reserveSource = (source, start) => {
  const previous = sourceUse.get(source) ?? [];
  if (previous.some((time) => Math.abs(start - time) < 25)) {
    throw new Error(`${source} 在 ${start.toFixed(2)} 秒违反25秒复用规则。`);
  }
  if ((sourceCount.get(source) ?? 0) >= 3) {
    throw new Error(`${source} 全片使用将超过3次。`);
  }
  previous.push(start);
  sourceUse.set(source, previous);
  sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
  return source;
};

const pickSource = (scene) => {
  const candidates = roleFiles[scene.role].map(
    (file) => `remotion/public/audio/koubo-sfx-v8/${file}`,
  );
  if (scene.sourceOverride) {
    const source = `remotion/public/audio/koubo-sfx-v8/${scene.sourceOverride}`;
    if (!candidates.includes(source)) {
      throw new Error(`${scene.role} 不允许固定音效：${source}`);
    }
    return reserveSource(source, scene.start);
  }
  const source = candidates
    .filter((candidate) => (sourceUse.get(candidate) ?? []).every((time) => Math.abs(scene.start - time) >= 25))
    .filter((candidate) => (sourceCount.get(candidate) ?? 0) < 3)
    .sort((left, right) => {
      const count = (sourceCount.get(left) ?? 0) - (sourceCount.get(right) ?? 0);
      const leftLast = Math.max(...(sourceUse.get(left) ?? [-Infinity]));
      const rightLast = Math.max(...(sourceUse.get(right) ?? [-Infinity]));
      return count || leftLast - rightLast;
    })[0];
  if (!source) throw new Error(`${scene.role} 在 ${scene.start.toFixed(2)} 秒没有合规音效。`);
  return reserveSource(source, scene.start);
};

const layers = sceneSpecs.map((scene, index) => {
  const generatedMedia = Boolean(scene.src);
  const sourceEvidence = Boolean(scene.evidenceSrc);
  const order = String(index + 1).padStart(3, '0');
  const eventId = `bw8-v${order}`;
  const cueId = `bw8-sfx-${order}`;
  const mediaAsset = scene.src ?? scene.evidenceSrc;
  const assetClass = generatedMedia
    ? 'generated-video'
    : sourceEvidence
      ? 'real-evidence'
      : 'remotion-information';
  return {
    id: `bw-${order}-${scene.component}`,
    start: scene.start,
    end: scene.end,
    spokenLine: scene.title,
    purpose: generatedMedia
      ? 'generated-scene-explanation'
      : sourceEvidence
        ? 'source-evidence'
        : 'semantic-emphasis',
    kind: generatedMedia ? 'full-screen-asset' : 'transparent-semantic-information',
    variant: scene.component,
    titleOwner: true,
    overlapGroup: `bw-v${order}`,
    zone: generatedMedia ? 'full-screen' : 'left-safe',
    title: scene.title,
    detail: scene.detail,
    items: scene.items,
    asset: {
      sourceType: generatedMedia
        ? 'user-generated-ai-video'
        : sourceEvidence
          ? 'official-source-image'
          : 'remotion-component',
      source: mediaAsset ?? `AIBestWorstV80/${scene.family}`,
    },
    assetDecision: {
      class: assetClass,
      producer: generatedMedia ? 'user' : sourceEvidence ? 'existing' : 'codex-remotion',
      requestId: generatedMedia ? scene.requestId : null,
      fallback: generatedMedia
        ? 'speaker-plus-information'
        : sourceEvidence
          ? 'speaker-plus-source-label'
          : 'speaker-plus-information',
    },
    visualEvent: {id: eventId, enterAt: scene.start, primary: true},
    sound: {policy: 'required', role: scene.role, cueId, offsetFrames: 0, maxSyncErrorFrames: 2},
    params: {
      component: scene.component,
      title: scene.title,
      detail: scene.detail,
      items: scene.items,
      ...(scene.primitive ? {primitive: scene.primitive} : {}),
      ...(scene.src ? {src: scene.src.replace(/^remotion\/public\//, '')} : {}),
      ...(scene.evidenceSrc ? {evidenceSrc: scene.evidenceSrc.replace(/^remotion\/public\//, '')} : {}),
      ...(scene.evidenceLabel ? {evidenceLabel: scene.evidenceLabel} : {}),
      ...(scene.disclosure ? {disclosure: scene.disclosure} : {}),
      ...(scene.badge ? {badge: scene.badge} : {}),
    },
    checks: {
      avoidFace: !generatedMedia,
      avoidHands: !generatedMedia,
      avoidSubtitle: true,
      needsFrameReview: true,
      continuousReviewIntervalSeconds: generatedMedia ? null : 0.5,
      reviewAt: Number(((scene.start + scene.end) / 2).toFixed(2)),
    },
    background: generatedMedia ? 'opaque' : 'talk',
    presentation: {
      renderMode: generatedMedia ? 'media-fullscreen' : 'speaker-overlay',
      semanticFamily: scene.family,
      coverageRatio: coverageByFamily[scene.family],
      progressiveReveal: true,
    },
  };
});

const cues = layers.map((layer, index) => {
  const scene = sceneSpecs[index];
  const source = pickSource(scene);
  const item = manifestByOutput.get(source);
  if (!item || item.eligibleForSfx !== true || item.contentKind !== 'sound-effect') {
    throw new Error(`音效未进入审核清单：${source}`);
  }
  const previewCovered = scene.start >= previewStart && scene.start <= previewEnd;
  return {
    id: layer.sound.cueId,
    visualEventId: layer.visualEvent.id,
    role: layer.sound.role,
    start: scene.start,
    end: scene.start + Math.min(1.4, item.durationSeconds),
    source,
    license: item.license,
    licenseReference: item.licenseReference,
    volume: scene.volumeOverride ?? volumeByRole[layer.sound.role],
    voiceDuckDb: 0,
    previewCovered,
    formalReviewed: false,
    userAudibilityConfirmed: previewCovered,
  };
});

const plan = {
  schemaVersion: 4,
  experiment: {id: experimentId, status: 'candidate-preview-approved'},
  videoId,
  videoTitle: 'AI在支配你，还是你在掌控AI？',
  sourceVideo,
  transcript: `${editRoot}/transcripts/AI_BEST_WORST_20260812_talk01.cleaned.v1.json`,
  bilingualCaptions: captions,
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: [
    'v8-user-confirmed-default-20260812',
    'v8-speaker-first-continuous-semantics',
    'v8-generated-video-fullscreen-with-disclosure',
  ],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
  previewCoverage: [
    'hook',
    'complex-overlay',
    'cta',
    'full-screen-asset',
    'speaker-overlay',
    'media-fullscreen',
    'progressive-process',
    'source-evidence',
    'hero-emphasis',
    'sfx-ab',
  ],
  editPolicy: '完整保留用户原口播，不删字、不重排；三条AI视频只在对应语义段全屏覆盖且静音，始终保留原口播音轨。Remotion只做人物左侧透明信息动效，不使用全屏说明页。',
  assetCoverage: {
    usableOriginalVideoItems: 1,
    assignedOriginalVideoItems: 1,
    generatedVideoItems: 3,
    assignedGeneratedVideoItems: 3,
    officialEvidenceItems: 4,
    assignedOfficialEvidenceItems: 4,
    generatedStillItems: 0,
    allRequiredClaimsCovered: true,
    note: '三条用户生成AI视频和四张原始出处页均已一对一绑定语义节点；AI视频不作事实证据。',
  },
  layers,
};

const cueSheet = {
  schemaVersion: 3,
  videoId,
  version: 'v8-ai-best-worst-formal-1',
  experimentId,
  normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json',
  cues,
  coverageReview: {
    primaryVisualEventCount: layers.length,
    coveredPrimaryVisualEventCount: cues.length,
    coveragePercent: 100,
    maxSyncErrorFrames: 2,
    machineStatus: 'pending-validator',
    userAudibilityConfirmed: true,
    confirmationScope: '2026-08-12用户明确回复“有音效版通过”；仅0至45秒连续有音效预览中的5个cue标记为听感确认。',
  },
};

const job = {
  schemaVersion: 1,
  jobId: '20260812-ai-best-worst-v80-formal',
  videoId,
  title: 'AI在支配你，还是你在掌控AI？',
  purpose: '完整保留本人横屏口播，以V8连续语义动效、四张原始出处页和三条用户生成AI场景视频解释“替代与增强”的分岔。',
  productionState: 'ready-for-production',
  productionProfile: {id: experimentId, version: 'V8'},
  experiment: {
    id: experimentId,
    status: 'candidate-preview-approved',
    userPreviewApproved: true,
    userPreviewApprovedAt: '2026-08-12T00:00:00+08:00',
    userPreviewApprovalEvidence: '用户明确回复：有音效版通过，aI视频已经放在文件夹了。',
    revisionReason: '将已通过的45秒有音效V8预览扩展为全长正式片，并接入三条用户生成AI视频与四张出处页。',
    primaryVisualEventCount: layers.length,
    sfxCoveragePercent: 100,
    previewAuditionRoles: ['chapter', 'comparison', 'keyword', 'node', 'line'],
  },
  baseline: {path: 'workflow/production-baseline.v1.json', id: 'koubo-formal-16x9-v1', revision: 'V7.2-20260730'},
  inputs: {
    source: sourceVideo,
    renderProxy: talkProxy,
    visualPlan: editPlan,
    bilingualCaptions: captions,
    sfxCueSheet: editSfx,
    sfxManifest: 'assets/sfx/koubo-sfx-v8/manifest.json',
    fingerprintPaths: [
      sourceVideo,
      talkProxy,
      media.customerService,
      media.factory,
      media.oldProcess,
      evidence.bestWorst,
      evidence.customerStudy,
      evidence.youthEmployment,
      evidence.jCurve,
      captions,
      'remotion/src/Root.tsx',
      'remotion/src/AIBestWorstV80Talk16x9.tsx',
      'remotion/src/components/V8SemanticStage.tsx',
      'remotion/src/components/V8BestWorstPrimitives.tsx',
      'remotion/src/components/V72ProductionShell.tsx',
      runtimePlan,
      runtimeSfx,
      editPlan,
      editSfx,
      'remotion/public/audio/koubo-sfx-v8',
      'assets/sfx/koubo-sfx-v8/manifest.json',
    ],
  },
  remotion: {
    root: 'remotion',
    entry: 'src/index.ts',
    compositionWithSfx: 'AIBestWorst16x9-V80-WithSfx',
    compositionWithoutSfx: 'AIBestWorst16x9-V80-NoSfx',
    durationSeconds,
    fps: 30,
    width: 1920,
    height: 1080,
    concurrency: 4,
  },
  preview: {
    enabled: true,
    withSfxOnly: false,
    scale: 0.5,
    crf: 22,
    ranges: [{id: 'v8-approved-first-45-seconds', startSeconds: previewStart, endSeconds: previewEnd}],
    output: 'work/production-runs/20260812-ai-best-worst-v80/preview45/with-sfx.mp4',
    renderWithoutSfxComparison: true,
  },
  riskFrames: {
    enabled: true,
    source: 'visual-plan-reviewAt',
    fullResolution: true,
    outputDirectory: 'work/production-runs/20260812-ai-best-worst-v80/formal/risk-frames',
  },
  audioPreflight: {
    enabled: true,
    source: 'preview',
    integratedLoudnessTargetLufs: -16,
    truePeakMaxDbtp: -1.5,
    preferredTruePeakDbtp: -1.8,
  },
  formal: {
    enabled: true,
    composition: 'with-sfx',
    blockedReason: null,
    crf: 18,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrate: '192k',
    rawOutput: 'work/production-runs/20260812-ai-best-worst-v80/formal/formal-raw.mp4',
    finalOutput: 'outputs/AI在支配你还是你掌控AI_16x9_V80_有音效_候选成片_v1.mp4',
    loudness: {
      enabled: true,
      integratedLoudnessTargetLufs: -16,
      loudnessRangeTargetLu: 11,
      truePeakTargetDbtp: -2.2,
    },
  },
  cache: {enabled: true, directory: 'work/production-cache', reuseOnlyOnExactFingerprint: true},
  reports: {
    runManifest: 'work/production-runs/20260812-ai-best-worst-v80/run-manifest.json',
    timingReport: 'work/production-runs/20260812-ai-best-worst-v80/timing-report.json',
    regressionReport: 'work/production-runs/20260812-ai-best-worst-v80/regression-report.json',
  },
};

for (const [target, value] of [
  [runtimePlan, plan],
  [runtimeSfx, cueSheet],
  [editPlan, plan],
  [editSfx, cueSheet],
  [jobPath, job],
]) {
  const absolute = path.join(projectRoot, target);
  mkdirSync(path.dirname(absolute), {recursive: true});
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(target);
}

console.log(`V8正式视觉事件：${layers.length}`);
console.log(`V8正式音效点：${cues.length}`);
console.log(`实际音效文件：${new Set(cues.map((cue) => cue.source)).size}`);
