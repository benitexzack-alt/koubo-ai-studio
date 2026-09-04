import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validatePreproductionRequest} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../../../');
const relative = p => path.relative(root, p);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'workflow/active-director-profile.v1.json')));
const sourceScript = path.join(dir, '素材授权与原句.md');
const style = '横向16:9，摄影级微缩纸艺定格场景，真实纤维卡纸、瓦楞纸切面、可见纸厚、棉线、柔和侧光与接触阴影。至少前景纸边、中景机构、后景承托三层互相遮挡。系列靛蓝、暖白、工业灰为主体，少量珊瑚红与灰绿区分功能，不做旧、不泛黄、不用霓虹。纸牌是独立硬质暖白矩形，正面近乎朝向镜头，留完整清洁书写区。全部物件须在画内，底部16%留给后续字幕，不摆关键物件。';
const blank = '本次只生成无字基础图，所有纸片表面均为纯空白，无图形、无印记；不画任何可读文字、数字、字母、Logo、水印或符号。严格只有四张目标空白标签牌，不能为无标签组补牌，也不能生成额外标题横幅。不能生成人类手、写实人物脸或真实软件界面。';
const motionLock = '严格以带字首帧为唯一身份、构图和材质基准，四张中文牌始终属于原物件，不重写文字，不添字、不漏字、不串牌。文字牌仅允许刚性小幅平移、抽屉式滑入或小角度扣合，不折叠、卷曲、拉伸、翻面或模糊中文；仅无字底板可以展开。不开新镜、不数字变焦、不旋转整场景。保留纸片摩擦、槽口轻碰、压合等同步原生拟音，不生成配音、音乐、字幕或屏幕浮字。末尾锁住完成关系至少1秒。';

const scenes = [
  {
    id: 'B01', title: '从问答到软件操作', seconds: 7,
    line: '不再单纯靠你一问一答，它可以直接操控电脑、浏览器、各类业务软件，自主跑完完整业务工作流。',
    meaning: '对照单个回答出口与连接电脑、浏览器和业务软件的操作路径，只解释任务形态。',
    window: [33.36, 41.72],
    groups: [
      ['对话出口', '暖白对话轮廓纸件与单口靛蓝浅托盘', 2],
      ['电脑工位', '灰白纸雕显示器及瓦楞纸键盘底座', 3],
      ['浏览器工位', '灰绿叠层空白窗口纸框与侧轨', 3],
      ['业务软件工位', '靛蓝多层软件抽屉、珊瑚红结果薄片', 4],
      ['路径桥', '前景瓦楞轨道和暖白连接纸桥', 1],
    ],
    labels: [['一问一答', 1, [0.07,0.55,0.28,0.65]], ['电脑', 2, [0.36,0.28,0.51,0.38]], ['浏览器', 3, [0.55,0.40,0.72,0.50]], ['业务软件', 4, [0.74,0.56,0.94,0.66]]],
    unlabeled: [{groupId:'G5',reason:'路径桥只承载动作关系，不产生第五张标签。'}],
    first: '35度斜俯视完成态。左侧约三分之一宽是对话出口，回答薄片停在独立托盘，托盘无通向右侧的轨道。右侧电脑、浏览器纸框、软件抽屉由前景实体纸桥顺次连接，四组主物件保持可分离。一个无字珊瑚红任务滑块停在电脑工位轨道起点。四张空白牌位置逐一限定：对话托盘正前方一张；电脑底座前沿一张；浏览器纸框下沿一张；软件抽屉面板一张。路径桥无牌。',
    actions: ['对话托盘吐出一张无字薄片，薄片停在本托盘中，不飞向右侧', '右侧任务滑块进入电脑底座的实体槽口，显示器保持原位', '同一个滑块沿纸轨到达浏览器工位，窗口底层无字薄片被抽出一小段', '滑块进入软件抽屉，抽屉推出无字交付薄片并停住', '前景纸桥扣合，左右两个不同出口保持清楚', '全体停止，保留左右对照和四张纸牌'],
    motion: '0至0.5秒保持首帧。0.5至1.3秒左侧对话托盘只推出一张无字回答薄片并停止。1.3至2.4秒右侧无字任务滑块进入电脑底座槽口；2.4至3.5秒同一滑块沿实体轨道经过浏览器工位，底层薄片抽出；3.5至4.7秒进入业务软件抽屉，抽屉推出无字交付薄片；4.7至5.7秒前景连接桥轻扣合；5.7至7秒锁定。左侧与右侧是对照而不是彼此变形，禁止把对话牌变成电脑牌。',
  },
  {
    id:'B02', title:'任务到交付', seconds:8,
    line:'下达一个复杂业务任务，它可以自己拆解目标、自主操作软件、搜集资料、排查问题、自我校对复盘，最后直接交付成品结果。',
    meaning:'同一任务经历操作、资料归集和检查后才输出，不能跳过中间环节或表示每项任务保证成功。',
    window:[41.72,54.84],
    groups:[['任务入口','暖白任务托盘和无字珊瑚红任务薄片',2],['操作工位','靛蓝纸雕电脑和灰色短行程推杆',3],['资料归集','灰绿资料纸堆、三层文件槽和棉线束',3],['检查工位','前景刚性检视窗、无字透明薄片和定位槽',1],['交付出口','后景暖白交付盒和刚性抽屉',4]],
    labels:[['业务任务',1,[0.05,0.26,0.25,0.36]],['操作软件',2,[0.32,0.20,0.53,0.30]],['排查问题',4,[0.39,0.64,0.61,0.74]],['交付结果',5,[0.73,0.46,0.94,0.56]]],
    unlabeled:[{groupId:'G3',reason:'搜集资料用三份无字纸片汇入一个文件槽表达；完整说法保留口播和字幕，不再添加第五张牌。'}],
    first:'斜俯视S形实体工作台，五个大物件组从左后向右后形成一条经过前景的连续路径：任务入口、电脑操作、资料槽、检视窗、交付盒。资料槽内三份不同纸色的无字资料可辨认，不像软件截图。检视窗有明确入槽和出槽，无标记、无印记。首帧无字任务薄片放在左侧入口，交付盒为空但结构完整。四张空白牌逐一固定在任务入口前沿、电脑底座、检视窗下沿、交付盒面板。资料组只有纸堆和文件槽，没有标签牌。',
    actions:['任务薄片进入入口托盘','推杆把同一任务薄片推进操作槽','三份资料薄片汇入一个文件槽并与任务一同推进','资料经过刚性检视窗，偏离的薄片退回槽内重新对齐','对齐后的纸束进入交付盒，抽屉推出','保持输入、检查和输出全路径'],
    motion:'从首帧连续开始。0至0.5秒读图；0.5至1.4秒任务薄片滑入入口；1.4至2.4秒推杆把它推进电脑操作槽；2.4至3.8秒三份无字资料顺次汇入文件槽；3.8至5.0秒纸束穿过检视窗，一张偏斜薄片退回后重新对齐，禁止冒出勾叉；5.0至6.6秒纸束进入交付盒，抽屉推出；6.6至8秒完成态锁定。资料不凭空消失，出口不能提前跳出结果。',
  },
  {
    id:'B03',title:'传统驾驶中的人',seconds:7,
    line:'人开车、人判断、人负责、人决策。',
    meaning:'解释传统驾驶的四类职责围绕同一个驾驶者，不涉及Cybercab是否无人负责的事实宣称。',
    window:[100.36,112.08],
    groups:[['驾驶控制','灰白瓦楞方向盘和短纸轴',2],['道路判断','后景灰绿道路模型、观察窗和分岔槽',3],['责任承托','前景深灰实体承托座及暖白连接支架',1],['路线决策','右侧靛蓝双路径拨杆和无字定位滑块',2],['驾驶者','中央暖白无脸纸偶、座椅和立体驾驶台',4]],
    labels:[['人开车',1,[0.06,0.33,0.25,0.44]],['人判断',2,[0.35,0.15,0.55,0.25]],['人负责',3,[0.32,0.64,0.54,0.75]],['人决策',4,[0.71,0.38,0.92,0.49]]],
    unlabeled:[{groupId:'G5',reason:'中央纸偶是四类职责的共同主体，不另加身份标签。'}],
    first:'低机位斜正视微缩驾驶台，中央无脸纸偶坐在座椅上，不驾驶具体品牌车辆。左侧方向盘、后侧观察道路、前侧责任承托座、右侧路线拨杆围绕同一纸偶，承托座压住棉线联接的前端，三层以上有落地遮挡。四张空白牌逐一固定在方向盘底座、后侧观察窗下方、前景承托座正面、右侧路线拨杆底座。纸偶没有第五张牌。道路不出现交通文字或符号。',
    actions:['方向盘绕原纸轴轻转并回正','观察窗后的一条道路薄片平移对齐驾驶者视线','前景承托座扣紧与驾驶台相连的两根棉线','路线拨杆把无字滑块导入一条分支后停住','中央纸偶和驾驶台保持同一主体，不变脸不变形','锁定四类职责围绕驾驶者的完成关系'],
    motion:'0至0.6秒保持首帧；0.6至1.6秒方向盘绕纸轴小角转动后回正；1.6至2.6秒后侧道路薄片通过观察窗对齐；2.6至3.6秒前景承托座扣紧棉线连接；3.6至4.8秒右侧拨杆把无字滑块引向一条分支；4.8至5.8秒四个支架轻轻贴合中央驾驶台；5.8至7秒保持。纸偶始终在中央，不能撤走人、改成机器人或生成无人驾驶事实镜头。',
  },
  {
    id:'B04',title:'软件与现实两条路径',seconds:7,
    line:'GPT‑6 Astra，是虚拟世界的超级智能大脑，能在软件系统里面完成整套商业工作。\nCybercab，是现实世界的超级执行身体。',
    meaning:'两个领域的类比，不是同一系统，也不是通用智能成熟证明。',
    window:[135.56,143.56],
    groups:[['软件系统','上层靛蓝纸雕电脑和刚性文件槽',3],['商业工作','上层右端暖白成果托盘和无字纸束',4],['现实环境','下层灰绿无字道路与路面起点',1],['执行物件','下层右端无品牌灰白四轮纸车与独立纸轨',2],['领域分隔','贯穿全宽的灰色硬纸隔板与独立底座',2]],
    labels:[['软件系统',1,[0.07,0.18,0.29,0.29]],['商业工作',2,[0.66,0.18,0.89,0.29]],['现实世界',3,[0.07,0.64,0.29,0.75]],['执行身体',4,[0.66,0.64,0.89,0.75]]],
    unlabeled:[{groupId:'G5',reason:'分隔板只显示两个独立领域，不产生关系结论或第五张牌。'}],
    first:'近正视上下双层纸艺舞台。上层电脑在左、文件输出托盘在右；下层道路在左、无品牌四轮纸车在右。中央是一条贯穿全宽的实体灰色隔板，上下轨道完全不相接，不能共享棉线或箭头。上层无字任务薄片停在电脑入口，下层小车停在短路起点。四张空白牌逐一放在上层电脑底座前沿、上层成果托盘前沿、下层道路左侧台阶、下层小车轨道右侧台阶。中央隔板无牌，不能出现平台Logo或AGI结论。',
    actions:['上层任务薄片进入电脑文件槽','上层纸束从槽口送到右端工作托盘','下层独立道路的无字底板沿折痕展开一小段','下层无品牌纸车沿自身轨道前移，车轮绕原轴滚动','分隔板保持完全隔开两条路径','上下结果各自锁定，不合并'],
    motion:'0至0.5秒保持首帧；0.5至1.5秒上层无字薄片进入电脑槽口；1.5至2.7秒上层纸束送入右侧托盘；2.7至3.7秒仅下层无字道路底板展开；3.7至5.0秒下层纸车沿独立纸轨前行；5.0至5.8秒两侧各自停稳；5.8至7秒锁定。中央隔板全程存在，禁止上下路径连通、电脑控制下方纸车、两者合体或新增结论牌。',
  },
  {
    id:'B05',title:'人的工作不能消失',seconds:7,
    line:'机器干重复的事，\n人只干：决策、判断、资源、服务、经营！',
    meaning:'重复任务进入独立处理轨，人的决策、判断、资源组织、服务和经营保持在主工作台。',
    window:[206.8,213.72],
    groups:[['决策工位','左侧靛蓝双路选择槽和暖白刚性拨片',2],['判断工位','后侧灰绿对照纸样和检视支架',3],['资源连接','前景棉线调度桥、三种无字物件、独立重复任务短轨',1],['服务工位','右侧两张暖白椅子与纸雕交接台',2],['经营工位','中央暖白无脸纸偶、工作台和无字记录册',4]],
    labels:[['决策',1,[0.06,0.34,0.24,0.46]],['判断',2,[0.35,0.15,0.53,0.27]],['服务',4,[0.72,0.35,0.90,0.47]],['经营',5,[0.42,0.62,0.61,0.74]]],
    unlabeled:[{groupId:'G3',reason:'资源用连接三种物件的棉线调度桥表达，重复任务用相同无字纸片的独立短轨表达；原词仍在口播字幕，不增加第五张牌。'}],
    first:'顶视偏20度的中心放射纸艺工作台，中央无脸纸偶和经营台仍是主角。左侧选择槽、后侧对照支架、右侧双椅交接台通过前景棉线调度桥连接中央。前景左下还有只承接相同无字薄片的短轨，和人的工作台保持分区，不能让整个人或其工位滑走。四张空白牌逐一在选择槽、对照支架、双椅交接台和中央经营台正前方。棉线资源桥与重复任务短轨均没有额外牌。',
    actions:['左侧拨片把一张无字备选片送入选定槽口','后侧对照纸样滑到检视支架下并列对齐','前景相同任务薄片进入独立短轨，三条棉线连到人的工作台','右侧一张无字交接片在双椅之间的交接台上移交','中央记录册翻开无字页面，纸偶保持原位','人的工作台与重复任务轨分别停稳'],
    motion:'0至0.5秒保持首帧；0.5至1.5秒左侧刚性拨片选择一条槽口；1.5至2.5秒后侧两张无字纸样对齐比较；2.5至3.6秒前景相同任务薄片沿独立短轨滑走，棉线把资源物件留接在人工作台；3.6至4.7秒右侧交接台传递一张无字纸片；4.7至5.8秒中央记录册展开无字页；5.8至7秒保持。纸偶和四张中文牌始终保留，不能把人推离画面，也不能用成功标记替代经营。',
  },
  {
    id:'B06',title:'四类服务工作',seconds:6,
    line:'你的门店获客、营销策划、视觉设计、流程简化、SOP搭建、数据复盘，所有问题，AI全部能解决。',
    meaning:'只说明四类工作项目，不证明获客、盈利或所有问题均能解决。',
    window:[239.2,243.88],
    groups:[['营销策划','左后方灰绿策划纸册和三条无字提纲纸条',3],['视觉设计','右后方暖白画板、三张纯色色样和靛蓝支脚',4],['流程搭建','左前方工业灰折页索引、阶梯槽与无字纸块',1],['数据复盘','右前方暖白记录册、两张无数字对照纸样',2],['服务承托','中部靛蓝瓦楞工具底座与横向纸梁',2]],
    labels:[['营销策划',1,[0.09,0.20,0.32,0.31]],['视觉设计',2,[0.61,0.20,0.84,0.31]],['SOP搭建',3,[0.09,0.60,0.32,0.72]],['数据复盘',4,[0.61,0.60,0.84,0.72]]],
    unlabeled:[{groupId:'G5',reason:'承托底座仅组织四个服务物件，不增加能力总包标题或第五张标签。'}],
    first:'略高于桌面的斜俯视微缩工坊，四个不同大物件前后错层排列，不是平铺PPT卡片：左后策划纸册、右后设计画板、左前流程折页索引、右前复盘记录册。中间瓦楞横梁承托四个工位且有真实遮挡。画板只含纯色色样，纸册和纸样完全无图无字。四张空白牌逐一放在策划册下沿、画板底座、流程索引前沿、复盘册下沿，矩形正面留足中文空间。中间横梁没有牌，不出现订单、数字、效果章或产品Logo。',
    actions:['三条无字提纲纸条插入策划纸册的三个浅槽','纯色色样依次叠入设计画板边框','无字底板折页展开，刚性流程标签不弯折','两张无字对照纸样滑入复盘册左右页','中央横梁轻扣合四个工位','四类服务物件锁定，保持无结果保证'],
    motion:'0至0.4秒保持首帧；0.4至1.3秒左后提纲纸条依次插入策划册；1.3至2.2秒右后纯色色样滑入设计画板；2.2至3.1秒左前只有无字底板折页展开，中文牌保持刚性；3.1至4.1秒右前两张无字纸样进入复盘册；4.1至5.0秒中央承托横梁轻扣合；5.0至6秒保持。仅展示工作类别，不添加收入、客户量、增长图形或保证效果的任何新文字。',
  },
];

const request = JSON.parse(fs.readFileSync(path.join(root, 'skills/koubo-remotion-director/templates/director-preproduction-request.v1.json')));
request.requestId = '20260904-gpt6-cybercab-paper-v3-r1';
request.taskId = '20260904-gpt6-cybercab-paper-assets';
request.inputScript.path = relative(sourceScript);
request.inputScript.sha256 = hash(sourceScript);
request.directorProfile.profileVersion = profile.profileVersion;
request.authorization = {
  sourceThreadId:'019f3383-706c-78f3-9dbe-6c6b20affb59',
  userQuote:'好的，那你先把这6段纸艺动画发给简化Running Hop批量流程的这个项目里面，让他去做。',
  scope:'六段独立纸艺素材预制及首帧批量流程交接，不含付费视频生成、正式生产、全片事实背书或公开发布。',
  observedProductionPhase:'post-recording-asset-previsualization',
  schemaPhaseExplanation:'既有编译器pre-shoot是资产预制合同名称，不声称尚未拍摄。原片已拍且有EDL；所有时间/字幕仍须post-shoot重绑。',
};
request.sourceMediaBinding = {
  original:{path:'edit/20260904_gpt6_cybercab/01_口播原片/R01_口播原片.MOV',sha256:'403e295fd1eb73769fe9b3c64000179f5c1b791f016a621afeaa69aa7859ebde'},
  edited:{path:'edit/20260904_gpt6_cybercab/11_指定句剪除_r1/01_口播原片_仅剪除没有人负责_r1.mp4',sha256:'5cc1564f54abff9171ba705c11c94f08f52dc7964bb39eddaaa8185b99b00be6',durationSeconds:261},
  edl:{path:'edit/20260904_gpt6_cybercab/11_指定句剪除_r1/cut-edl.v1.json',sha256:hash(path.join(root,'edit/20260904_gpt6_cybercab/11_指定句剪除_r1/cut-edl.v1.json'))},
  transcript:{path:'edit/20260904_gpt6_cybercab/07_实录与字幕/R01.whisper-small.raw.v1.json',sha256:hash(path.join(root,'edit/20260904_gpt6_cybercab/07_实录与字幕/R01.whisper-small.raw.v1.json')),status:'raw-asr-for-semantic-navigation-only',finalCaptions:false},
};
const outputNames={routeLockPath:'director-route-lock.v1.json',planPath:'director-preproduction-plan.v1.json',assetSheetPath:'六段纸艺素材执行单.md',firstFramePromptManifestPath:'first-frame-prompts.v1.json',runningHubPromptManifestPath:'runninghub-image-to-video-prompts.v1.json',runningHubPromptSheetPath:'runninghub-image-to-video-prompts.md',compileReceiptPath:'director-compile-receipt.v1.json',validationReceiptPath:'director-validation-receipt.v1.json'};
request.outputs=Object.fromEntries(Object.entries(outputNames).map(([k,v])=>[k,relative(path.join(dir,v))]));
request.beats=scenes.map((s,index)=>{
  const labels=s.labels.map(([text,group,rect],i)=>({nodeId:`N${i+1}`,text,groupId:`G${group}`,surfaceId:`G${group}-rigid-label-card`,enterStageId:`S${group}`,role:'diegetic-node-label',anchorQuad:[[rect[0],rect[1]],[rect[2],rect[1]],[rect[2],rect[3]],[rect[0],rect[3]]],maxChars:[...text].length,persistence:`S${group}-to-end`,occlusionOwner:'own-rigid-card-above-own-group',ocrRequired:true,motionConstraint:'rigid-surface',embeddingMode:'first-frame-baked',stageOffsetFrames:0,anchorCalibrationRequired:true}));
  const nodes=[...labels.map(l=>({id:l.nodeId,label:l.text,groupId:l.groupId,textVisibility:'paper-label'})),...s.groups.map((g,i)=>({id:`V${i+1}`,label:g[0],groupId:`G${i+1}`,textVisibility:'visual-only'}))];
  const stages=s.actions.map((action,i)=>({id:`S${i+1}`,order:i+1,subject:`G${Math.min(i+1,5)}`,action,sfxRole:i===5?'completion-hold-no-new-sound':i%2?'paper-slot-click':'paper-slide',landingNodeIds:labels.filter(l=>l.enterStageId===`S${i+1}`).map(l=>l.nodeId)}));
  const shift=t=>t>=118.866666667?t-28/30:t;
  return {id:s.id,order:index+1,spokenLine:s.line,coreMeaning:s.meaning,kind:index===1?'process-explanation':index===2||index===3?'comparison':'abstract-mechanism',visualDecision:{class:'paper-editorial',producer:'user',fallback:'blocked'},assetUse:{role:'illustration-only',evidenceEligible:false,aiDisclosureRequired:true},provisionalTiming:{sourceWindowSeconds:s.window,editedWindowSeconds:s.window.map(shift),notAnEditDecision:true,wordLevelBindingVerified:false,finalClipInOutLocked:false},paperScene:{title:s.title,archetype:'complex-explanation',durationSeconds:s.seconds,objectGroups:s.groups.map(([name,material,depth],i)=>({id:`G${i+1}`,name,material,depth})),nodes,stages,textPlan:labels,screenTextPlan:[],labelBindingPolicy:{unlabeledObjectGroups:s.unlabeled},readableTextPolicy:{silentTruncationForbidden:true,slashMergeForbidden:true,maximumSimultaneousLabels:4},firstFrameState:{kind:'fully-arranged-scene-with-input-object-at-start',labelsPresentAtFrameZero:true,stageIdsDescribeObjectActionLandingsNotProofOfFirstTextAppearance:true},postShootCaveats:['首帧四张标签已存在，stage入场字段不能冒充文字首次出现的逐帧证据。正式重绑须按真实视频可见文字和实录复核。','本条为资产预制，时长不等于最终插片时窗；不得冻结末帧或拉伸视频凑口播时长。'],prompt:{firstFrame:`${style}\n${s.first}\n${blank}`,motion:`${s.motion}\n${motionLock}`,generatedReadableTextAllowed:false}}};
});
const result=validatePreproductionRequest({request,projectRoot:root,profile});
if(!result.ok)throw new Error(result.errors.join('\n'));
fs.writeFileSync(path.join(dir,'director-preproduction-request.v1.json'),JSON.stringify(request,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({requestId:request.requestId,scenes:request.beats.length,totalSeconds:scenes.reduce((n,s)=>n+s.seconds,0),outputDir:dir}));
