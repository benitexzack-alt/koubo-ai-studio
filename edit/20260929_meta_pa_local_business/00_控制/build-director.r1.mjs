import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const ep='edit/20260929_meta_pa_local_business';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const put=(p,x)=>fs.writeFileSync(`${ep}/${p}`,typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');
const raw=JSON.parse(fs.readFileSync(`${ep}/06_实录核对/本地转写_未听审.r1.json`,'utf8'));
const seg=raw.segments;
const plain=seg.map(s=>s.text.trim()).join('\n')+'\n';
put('06_实录核对/实录候选_导演覆盖输入.txt',plain);
const fmt=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${(n%60).toFixed(2).padStart(5,'0')}`;
// 全部209条实录候选连续覆盖；这不是字幕听审记录。
const rows=[
 [0,2,'speaker','开场：顾客先问AI','keyword-emphasis','“挑商家→找得到？”随核心词强调，不给长前奏。','Meta发布源支持产品事实；未来顾客行为是推演，不是所有人已改变。'],
 [3,7,'speaker','本地老板先补三类信息','list-reveal','服务、条件、预约入口逐项出现，停留到观众读完。'],
 [8,10,'speaker','Meta是谁',null,null,'Meta财报与公司介绍，只支持社交及广告业务。'],
 [11,15,'real-evidence','广告占比与日活口径','evidence-focus','分两次聚焦财报对应行，不把日活误写成Muse用户。','财报广告收入59363/总收入60801百万美元，约97.63%；日活36亿是产品家族2026年6月平均DAP。','S02_Meta二季报官方.pdf'],
 [16,19,'real-evidence','Muse产品亮相','screen-callout','官方片中产品名与真实界面短展示，不假造本人实测。','Muse于2026年9月8日发布；用户需求后的业务接入是作者解释。','V01_Muse官方介绍.mp4'],
 [20,26,'speaker','刷广告自己挑→交代需求','relationship-line','两条短路径逐段接通，保留真人脸和手势。'],
 [27,28,'speaker','个人AI助理','keyword-emphasis','PA只解释一次，不用持续大标题遮人。'],
 [29,31,'real-evidence','云浏览器与用户确认','screen-callout','只框实际存在的步骤；官方购物片没有展示的云浏览器能力用官方发布原页短摘录。','核对云端浏览器、操作、确认边界；不外推任意网站或国内已开放。','V02_Muse官方购物演示.mp4'],
 [32,33,'speaker','引出兰州订房情景',null,null],
 [34,37,'ai-generated-video','夜晚带家人抵达',null,null],
 [38,40,'speaker','取消费用是关键条件','keyword-emphasis','取消怎么收费只圈核心词，轻敲声对应重点。'],
 [41,47,'paper-editorial','条件把候选筛小',null,null],
 [48,54,'paper-editorial','授权偏好进入本次筛选',null,null,'记忆是授权条件下的能力；老人、电梯为假设场景，不证明Muse实测通过。'],
 [55,59,'speaker','变化条件重新确认','list-reveal','日期、人数、预算可替换标签；保留“越有可能”，不用成功保证。'],
 [60,64,'paper-editorial','推荐到预订之间的关卡',null,null],
 [65,67,'speaker','推荐与订成不可等同',null,null,'实录候选“一键都不会拉下”需听审；即使为“一件都不会落下”，也不能据此承诺助手不遗漏。'],
 [68,69,'speaker','回到老板视角',null,null],
 [70,72,'speaker','原来的流量入口','list-reveal','位置、视频、推荐作为旧路径三个节点，给下一段对照。'],
 [73,78,'speaker','未进入候选名单','pinning','三张抽象候选条保留在侧栏，未入名单的空槽与真人判断形成对比，不造真实排名。'],
 [79,82,'speaker','平台入口受挑战','transition-carry','延续上段候选条，把注意力从平台入口移到助理入口。'],
 [83,91,'paper-editorial','入口改变不等于底座消失',null,null],
 [92,98,'speaker','能力仍参与竞争','relationship-line','入口与商品售后分上下两层；不画平台消失或被取代结论。'],
 [99,100,'real-evidence','九月二十一日涨幅','evidence-focus','聚焦报道标题和发布日期，不使用网页今天的行情栏，不画虚构K线。','Yahoo当日原报道写涨超11%；文稿约11%为四舍五入。未独立核算收盘价，不增加“收盘”字样。','S07_九月二十一日股价报道原页.png'],
 [101,105,'real-evidence','交易收费属于计划','evidence-focus','仅显示含收费计划的短句和报道归属，“未来”保留。','Yahoo记者对Connect讲话的归属报道；不是已执行收费规则。','S06_收费计划报道原页.png'],
 [106,109,'speaker','国内两种走法',null,null],
 [110,113,'real-evidence','豆包二代手机','screen-callout','展示当期官方发布与产品能力图，聚焦系统入口，不拿一代M153冒充二代。','中兴2026年9月16日NaviX Ultra公告；能力依赖授权、机型与支持范围。','I03_豆包二代能力官方图.png'],
 [114,120,'real-evidence','千问接入阿里服务','evidence-focus','官方段落中淘宝闪购、飞猪、高德依次框选，一声轻点对应一组。','阿里2026年1月15日公告；仅陈述服务接入，不担保所有任务完成。','S03_千问生态正文视窗.png'],
 [121,123,'real-evidence','千问淘宝互通','screen-callout','官方四屏图横向引导到商品和订单，不把图上的历史价格当今天报价。','阿里2026年5月11日公告；商品、订单、物流、售后为官方范围描述。','I01_千问淘宝官方图.png'],
 [124,129,'speaker','操作手机与接入生意的区别','relationship-line','双路径并排：手机→应用；对话→已有服务。两条线落点不同，不能只有卡片进出。'],
 [130,137,'speaker','企业应用三问','list-reveal','信息能查到、服务能接上、失败有人接手，沿用同一组三节点。'],
 [138,146,'paper-editorial','实际合适却没有写出来',null,null],
 [147,151,'speaker','老板知道高频问题','list-reveal','免费/收费、晚到联系逐项展示；它们是问题，不是给某家酒店填写的答案。'],
 [152,156,'paper-editorial','口头答案未进入公开资料',null,null],
 [157,164,'speaker','逐项对照真实业务','list-reveal','缺失、过时、不一致逐项定位；末端以“实际服务”为核准点，不虚构客户案例。'],
 [165,172,'speaker','能查到不等于一定推荐','relationship-line','查到→理解→核对回答及出处；不把推荐画成必然的绿色终点。'],
 [173,178,'paper-editorial','推荐后仍可能断在预约',null,null],
 [179,185,'speaker','哪一环断了修哪一环','list-reveal','延续信息、入口、人工三节点，口播讲到哪一项就聚焦哪一项。'],
 [186,188,'speaker','已有功能先用','keyword-emphasis','“先用已有功能”一处强调，不堆工具标志。'],
 [189,194,'speaker','老板与超哥的分工','relationship-line','老板确认条件→整理给员工→共同核对，保留面对面讲话。'],
 [195,200,'speaker','观众可以立刻做的检查','list-reveal','地址、服务条件、预约联系方式、出处四步逐个点亮，不生成假AI答复。'],
 [201,205,'speaker','本地业务行动邀请','keyword-emphasis','仅保留服务范围关键词，不造获客承诺，不加未经提供的联系方式。'],
 [206,208,'speaker','本人收尾',null,null],
];
const paperPrefix='摄影级微缩纸艺定格，深海军蓝背景、米白纤维卡纸与少量珊瑚橙点色，至少三层实体空间，瓦楞断面、折痕、柔和侧光与真实接触阴影，16:9横屏。';
const aiPrefix='写实生活电影镜头，克制的暖冷对比与自然光，真实中国城市普通旅馆环境，16:9横屏。';
const paperDefs=[
 {title:'条件筛选，不是搜索列表',start:89.72,duration:8,role:'mechanism',metaphor:'三道有条件的纸质筛门分流候选旅馆',composition:'斜俯视纵深轨道，三栋旅馆在前景，筛门居中，结果泊位在右后方',
  text:[['停车','橙色第一筛门横梁'],['晚到','白色第二筛门横梁'],['退订','蓝色第三筛门横梁'],['候选','右后纸托盘前沿']],
  frame:'斜俯视一座精密但可读的微缩纸板筛选装置，前景三栋外观各异的无品牌旅馆纸模型，模型底部有大小不同的实体榫口；中景三道筛门错层排列，门轴、滑轨和侧面分流槽清楚可见；右后纸托盘为空，尚无成功结果。模型和纸门不是平面图标。',
  action:'三栋旅馆沿轨道经过纸质筛门并分流',actions:['筛门压下核对榫口','两栋不匹配旅馆被导入侧槽','匹配旅馆抵达候选托盘'],result:'条件不合的被分开，留下候选但没有订单',
  video:'0—2秒三道带字筛门依次压到检验位置；2—6秒三栋旅馆沿轨道经过纸质筛门并分流，两栋被导轨拨到侧槽，一栋抵达后方托盘；6—8秒托盘带着“候选”向前推出一点后停稳。侧向轻跟拍只辅助实体动作，不能用镜头推近替代筛选。保留三次轻纸板扣合与滑轨摩擦声。'},
 {title:'记忆有授权，不是偷偷画像',start:103.82,duration:8,role:'relationship',metaphor:'授权插销控制偏好抽屉与本次行程连接',composition:'正侧三分之二角度，左边偏好抽屉，中间授权插销，右边本次行程凹槽',
  text:[['电梯','米白偏好纸片正面'],['少走路','蓝边偏好纸片正面'],['已允许','橙色授权插销上表面'],['本次行程','右侧可移动托盘前沿']],
  frame:'三分之二侧视一台木盒尺度的纸板记忆装置，左侧浅抽屉内两张厚纸偏好片清晰可读，中间橙色插销处在封闭轨道的起始位置，右侧行程托盘留有两个对应凹槽，前景纸板台阶、中景装置、后景折纸室内墙构成空间。所有偏好只属于抽象示意，不出现真实人脸资料或账号。',
  action:'授权插销解除挡板后两张偏好片接入行程托盘',actions:['插销解锁挡板','抽屉送出偏好片','行程托盘接合'],result:'只有经过允许的偏好进入本次考虑',
  video:'0—2秒写有“已允许”的插销滑到解锁位，挡板抬起；2—6秒授权插销解除挡板后两张偏好片接入行程托盘，两张纸片保持彼此可辨；6—8秒托盘向镜头方向移动并停稳。四处文字全部贴在各自纸面上随运动改变透视。纸抽屉滑动、插销轻响与纸片落槽声清楚可闻。'},
 {title:'订成之前仍需过关',start:122.14,duration:7.3,role:'process',metaphor:'四节检验桥与末端确认闸门',composition:'低角度侧视，前景候选房间模型，中景四段桥，后景尚未开启的出口',
  text:[['房态','第一块纸桥桥面'],['价格','第二块纸桥桥面'],['退订','第三块纸桥桥面'],['确认','末端橙色闸门正面']],
  frame:'低角度侧视微缩纸桥机构，前景单栋无品牌旅馆候选模型停在起点，中景三块厚纸桥板平放但接缝清晰，末端橙色闸门处于关闭状态，远处没有订单、付款成功或绿色成功标志。底层裸露纸梁，中层桥面，后层竖直闸门层次鲜明。',
  action:'候选模型经过三段检验桥停在确认闸门之前',actions:['桥段逐节扣合','候选模型经过检查区','确认闸门保持关闭等待人决定'],result:'查房态、价格与退订之后仍等待用户确认',
  video:'基于候选停在起点的状态，0—2秒三段带字桥面逐节扣合；2—5.5秒候选模型经过三段检验桥停在确认闸门之前；余下时间闸门轻轻回弹一次保持关闭，模型没有穿越。桥面文字随桥板扣合，确认文字随闸门回弹；不得出现自动支付或预订成功。保留桥板卡扣、模型滚动和闸门轻响。'},
 {title:'入口换了，交易底座还在',start:170.34,duration:8,role:'mechanism',metaphor:'上层入口换轨，下层服务承重梁继续运作',composition:'正面剖开的两层纸楼，上层两个入口，下层三根实体服务梁',
  text:[['平台','上层左侧活动入口门'],['助理','上层右侧活动入口门'],['商品','下层左侧服务抽屉'],['订单','下层中间服务抽屉'],['售后','下层右侧服务抽屉']],
  frame:'正面略俯视一栋剖开的纸质交易楼，前景阶梯、中景双层楼体、后景海军蓝城市纸剪影。上层左右两扇厚纸门及一段可换向轨道，下层三只服务抽屉由可见纸梁承托；上下层连接是实体纸轨道，不是电子屏幕上的流程图。入口门未切换，下层结构完整。',
  action:'上层导轨切到助理入口而下层服务抽屉继续承接',actions:['两扇入口门交换开合状态','上层导轨换向','下层三只服务抽屉依次短距推出'],result:'变化发生在入口，商品订单售后能力仍然参与',
  video:'0—3秒上层导轨切到助理入口而下层服务抽屉继续承接，左门收合、右门开启，轨道不是凭空生成；3—6秒下层三只带字服务抽屉按顺序短距推出，展示承重结构仍完整；6—8秒镜头轻降到上下层连接处停留。字随门转、随抽屉移动，纸梁不坍塌。保留纸铰链与抽屉的节奏动作声，不加灾难音。'},
 {title:'店里有，资料里没写',start:267.76,duration:8,role:'comparison',metaphor:'酒店真实条件剖面与只写空泛词的资料页形成错位',composition:'左边立体旅馆剖面，右边薄资料册，中间尚未接通的三条纸桥',
  text:[['停车','可推出车库门正面'],['电梯','可升降电梯厢正面'],['晚入住','可开启夜间门牌'],['环境好','右侧资料册封面上半部'],['服务周到','右侧资料册封面下半部']],
  frame:'左边是一座无品牌旅馆纸模型的立体剖面，地下小车库、竖直电梯井和夜间接待门可区分，右边薄资料册封面只有两句空泛介绍，册页侧边有空白缺口。两边通过三条尚未搭接的厚纸窄桥相对，背景为层叠深蓝街景。灯光清楚照亮纸纤维、门轴及电梯纸绳。',
  action:'旅馆展示三种真实条件而资料册翻开仍是空白缺口',actions:['车库门推出','电梯厢短距上行和夜间门牌开启','资料册翻开暴露对应空白'],result:'服务存在不代表资料中能查到条件',
  video:'0—4秒旅馆展示三种真实条件而资料册翻开仍是空白缺口：车库门推出，电梯厢升一层，夜间门牌开启；4—6秒右侧资料册翻开，封面两句文字随封面转动，内页对应条件处依旧空白；6—8秒三条纸桥停在缺口边缘，没有连接完成。文字始终跟所属物件，不漂在屏幕上；保留车库、电梯纸绳与翻页的轻声。'},
 {title:'前台知道，不等于网上可查',start:287.88,duration:8,role:'metaphor',metaphor:'前台答案纸带在柜台内反复回转，未进入外侧公开册',composition:'近景柜台与回环纸带，后景未打开的对外资料盒',
  text:[['停车收费','第一段答案纸带表面'],['晚到联系','第二段答案纸带表面'],['退订条件','第三段答案纸带表面'],['可查资料','外侧资料盒活动盖']],
  frame:'一个立体微缩旅馆前台，柜台内有由纸轮支撑的宽纸带，三段常见问题标题沿带面分区清楚排布，柜台外侧有合盖的资料盒，盒口与纸带之间存在一小段明显断开。前景柜台边缘、中景纸轮纸带、后景房间钥匙纸挂板有真实深度。没有真人手、手机截图或伪造评价。',
  action:'答案纸带在前台回环两次却未进入外侧资料盒',actions:['三段带字纸带连续回转','资料盒盖短暂打开','纸带停在断口内侧'],result:'口头反复回答与对外资料沉淀是两件事',
  video:'0—5秒答案纸带在前台回环两次却未进入外侧资料盒，三段中文字随带面的弯曲和位置变化，字形不变；5—6.5秒资料盒盖短暂打开露出空槽，写有“可查资料”的盖随轴运动；6.5—8秒纸带停在断口内侧。重点是资料没有出去，不自动补全缺口。保留纸轮细碎转动和纸带摩擦声，不生成说话声。'},
 {title:'被推荐之后，仍会断在入口',start:325.92,duration:8,role:'process',metaphor:'顾客纸球到达推荐节点后被预约断桥挡住，新增介绍不能填桥',composition:'对角纵深旅程轨道，前景资料叠层，中景预约断桥，远景人工服务台',
  text:[['推荐','起点可转动路标牌'],['预约','中景断桥活动桥板'],['介绍','前景可滑动资料册封面'],['人工','远景小服务台前挡板']],
  frame:'一条从左前通向右后的微缩纸轨道，起点是一枚可辨的小顾客纸球与路标，中间预约桥板缺了一段，远处人工服务台与轨道尚未连接。前景有一本薄资料册，底部纸架、中部轨道与后景服务台三层分明，没有订单成功、支付动画或真实网页。所有中文简短清晰地印在指定实体表面。',
  action:'顾客纸球在预约断桥前停下而新增介绍册落在一旁',actions:['路标转向推荐路线','纸球到达断桥并停止','介绍册移到桥旁但无法搭桥'],result:'增加介绍不等于修通预约入口',
  video:'0—2秒推荐路标转向轨道，顾客纸球沿实体槽滚动；2—5秒顾客纸球在预约断桥前停下而新增介绍册落在一旁，预约桥板轻晃，不能让纸球跳过断口；5—8秒远景人工服务台向前移少许仍未连接，以清晰断点结束。四处字随所属物件动作，结束保持可读。保留滚动、纸板轻碰和翻册声，不加预订成功提示音。'},
];
const cues=JSON.parse(fs.readFileSync('skills/koubo-remotion-director/templates/director-cues.v2.json','utf8'));
cues.taskId='meta-pa-local-business-20260929-director-r1';
cues.inputScript={path:`${ep}/06_实录核对/实录候选_导演覆盖输入.txt`,sha256:hash(`${ep}/06_实录核对/实录候选_导演覆盖输入.txt`),authority:'actual-spoken-transcript'};
const ref=`${ep}/07_核对图/超级个体_字物同动参考_原尺寸.png`;
cues.styleLocks={aiGeneratedVideo:{referenceImages:[],promptPrefix:aiPrefix,mustKeep:['生活细节','无品牌通用环境','单一人物动作'],mustAvoid:['真实酒店冒充','伪造平台界面','文字水印']},paperEditorial:{referenceImages:[{id:'REF01',path:ref,sha256:hash(ref),usage:'style-mechanism-only'}],promptPrefix:paperPrefix,qualityBaselineId:'paper-super-individual-20260829-v1',textPolicy:'first-frame-generated-chinese-surface-bound',mustKeep:['首帧直接带准确中文','文字和载体一起运动','三层空间与真实纸纤维','一镜一个认知目标和因果动作','可用原生动作声'],mustAvoid:['镜头推拉冒充机构动作','所有字牌固定','屏幕悬浮字','塑料三维','整页幻灯片','替本地酒店伪造实测证据']}};
cues.semanticBeats=[];cues.factChecks=[];cues.shotcraftOpportunities=[];cues.rhythmAudit.runs=[];
for(const p of Object.values(cues.routePlans)){p.items=[];p.status='planned';p.notRequiredReason=null;}
const counts={speaker:0,'real-evidence':0,'ai-generated-video':0,'paper-editorial':0,shotcraftOpportunity:0};
const timing=[],sound=[],realMap=[];
let pi=0,ri=0,fi=0,so=0;
const id=(prefix,n)=>prefix+String(n).padStart(2,'0');
for(const [i,row]of rows.entries()){
 const [a,z,route,title,intent,motion,fact,asset]=row;
 const quote=seg.slice(a,z+1).map(s=>s.text.trim()).join('\n');
 const bid=id('B',i+1),fid=fact?id('F',++fi):null;
 const routeId=route==='paper-editorial'?id('P',pi+1):route==='real-evidence'?id('R',++ri):route==='ai-generated-video'?'G01':null;
 const reason=route==='speaker'?'该段主要是本人判断或业务行动说明，保留真人；'+(motion||'不增加没有信息收益的装饰。'):route==='real-evidence'?'观众需要看到可追溯的真实产品或原文，而不是纸艺冒充证据。':route==='paper-editorial'?paperDefs[pi].result:'夜间抵达的生活情景用于代入条件，不承担平台功能证明。';
 const beat={id:bid,order:i+1,scriptQuote:quote,rhetoricalRole:title,claimClass:fact?'factual-claim':route==='ai-generated-video'?'generic-illustration':route==='paper-editorial'?'abstract-explanation':'presenter-expression',requiresFactCheck:!!fact,factCheckId:fid,primaryRoute:route,routeCueId:routeId,decisionReason:reason,viewerGain:route==='speaker'?'presenter-trust':route==='real-evidence'?'proof':route==='paper-editorial'?'explain-mechanism':'make-scene-concrete'};
 cues.semanticBeats.push(beat);counts[route]++;
 if(fact)cues.factChecks.push({id:fid,beatId:bid,sourceRequirement:fact,owner:'codex-public-source',onScreenTreatment:route==='real-evidence'?'primary-real-evidence':'optional-source-card',fallbackIfUnverified:'block-production'});
 const anchors={id:routeId,beatId:bid,startAnchorText:quote.slice(0,Math.min(10,Math.floor(quote.length/3))),endAnchorText:quote.slice(-Math.min(10,Math.floor(quote.length/3))),timingStatus:'post-shoot-audio-bound'};
 let start=seg[a].start,duration=seg[z].end-start;
 if(route==='paper-editorial'){
  const p=paperDefs[pi++];start=p.start;duration=p.duration;
  const textPlan=p.text.map(([text,surface])=>({text,surface,motion:'with-object'}));
  const firstFramePrompt=paperPrefix+p.frame+'首帧准确写中文：'+p.text.map(([t,s])=>`${s}印“${t}”`).join('；')+'。除这些文字外不新增字，字属于纸面而非后贴字幕。底部留出干净字幕空间。';
  const videoPrompt='基于已确认首帧，'+p.video+'不重造场景、不新增物件和文字，不要背景音乐和人声，保留可用原生动作音。';
  cues.routePlans.paperEditorials.items.push({...anchors,durationSeconds:duration,purpose:'illustration-only',evidenceEligible:false,reason:p.result,visualRole:p.role,visualMetaphor:p.metaphor,composition:p.composition,primaryAction:p.action,textPlan,referenceImageIds:['REF01'],firstFramePrompt,videoPrompt,negativePrompt:['文字不脱离纸面或变形','不把所有文字固定在画面上','不以推镜代替物件动作','不做塑料三维或幻灯片','不添加人声与背景音乐'],motionPlan:{goal:p.title,actions:p.actions,result:p.result,textBinding:'surface-bound',audioPolicy:'preserve-usable-native-action-sound'}});
 }else if(route==='ai-generated-video'){
  duration=6;start=70.46;
  cues.routePlans.aiGeneratedVideos.items.push({...anchors,durationSeconds:duration,purpose:'illustration-only',representationPolicy:'synthetic-not-evidence',evidenceEligible:false,disclosureRequired:true,realEntityReenactmentForbidden:true,mode:'image-to-video',visualIntent:'让夜晚带家人抵达的假设条件具体化，人物与酒店均非真实案例。',primaryAction:'成年旅客把行李箱拉向旅馆门口',firstFramePrompt:aiPrefix+'夜间普通无品牌旅馆门前中景，一位成年旅客手扶行李箱，另一位成年家人在旁，普通私家车停在后景，街面微湿，暖色门灯照到人物和行李轮；两人正对旅馆入口，距离门口尚有几步。真实布料和灯光，不出现可读店名、车牌、手机界面或地标，不扮演任何真实客户，画面下方干净。',videoPrompt:'基于已确认首帧，成年旅客把行李箱拉向旅馆门口，箱轮沿地面滚动，家人自然跟随，镜头在侧后方缓慢跟进，结尾停在门前而不是入住成功。保留轻微轮声与夜间环境声，不添加对白、配乐、新人物或文字。',negativePrompt:['不复刻真实酒店品牌或地标','不出现可读车牌和手机界面','不生成未成年人特写','不伪装本人亲测或客户证据']});
 }else if(route==='real-evidence'){
  cues.routePlans.realMaterials.items.push({...anchors,assetType:asset.endsWith('.mp4')||asset.startsWith('I')?'official-interface':'official-document',usageRole:'evidence',materialRequest:title+'；来源候选文件见公开素材映射，不是用户已批准素材。',reason,evidenceStatus:'candidate-unbound',usableInProduction:false,sourceBinding:null,fallbackIfUnavailable:'block-production',generatedSubstituteAllowed:false});
  realMap.push({id:routeId,beatId:bid,title,candidatePath:`${ep}/01_素材投放区/05_公开素材_Codex准备/${asset}`,fallbackAlternative:bid==='B08'?'S01_Meta发布原页.html：没有对应的真实演示就使用官方原文短摘录，不造浏览器界面。':null,humanAcceptance:false,rightsReview:'署名短引文/必要局部展示待复核，非无限转载许可'});
 }
 let opportunity=null;
 if(intent){opportunity=id('SO',++so);cues.shotcraftOpportunities.push({id:opportunity,beatId:bid,baseVisualRoute:route,intent,reason:motion,status:'opportunity-only-post-shoot-selection-pending',catalogScope:'full-current-catalog'});sound.push({id:opportunity,beatId:bid,start:seg[a].start,end:seg[z].end,visualAction:motion,audioIntent:intent==='evidence-focus'||intent==='screen-callout'?'资料进入轻纸声；每个主要框选或聚焦落点有短促轻点，禁止盖住数字和专有名词。':intent==='list-reveal'?'每项进入配低存在感纸片落位声；末项用一次轻确认声，避免连发刺耳音。':intent==='relationship-line'||intent==='transition-carry'?'路线推进轻扫声，连接落点轻扣声；不能只给卡片入场配音。':i===0?'钩子核心词处短促有质感的重音，不能延后到论点之后；不在第一个字上叠爆破。':'关键词出现或状态变化配一次清晰短音，不做背景连续提示。',state:'设计意图，尚未选卡、生成、混音或试听'});}
 timing.push({beatId:bid,asrSegmentIds:[a,z],startSeconds:seg[a].start,endSeconds:seg[z].end,title,primaryRoute:route,routeCueId:routeId,insertStartSeconds:route==='speaker'?null:start,insertDurationSeconds:route==='speaker'?null:duration,opportunityId:opportunity,anchorConfidence:'local-asr-provisional-not-listened',outsideInsert:'该语义段内插片之外保留原真人；禁止冻结、循环或拉长生成素材填满语义段。'});
}
counts.shotcraftOpportunity=so;
cues.selectionSummary={mainPoint:'顾客入口可能变为助理，但业务资料、可用入口和真人接手仍决定事情能否继续办。',argumentFlow:['先让老板理解查得到','核对Meta产品事实','订房条件解释筛选和授权','区分入口竞争与交易底座','国内两种路线','回到资料入口人工三件具体事'],routeCounts:counts,routeRationales:{speaker:'真实判断、本人业务范围及行动步骤以真人为主，用有信息收益的语义动效辅助。','real-evidence':'仅产品、数字和有出处的新闻需要官方或真实原文上屏。','ai-generated-video':'仅夜间抵达这一生活场景受益于真实空间和人物动作，不拿生成画面证明功能。','paper-editorial':'七个不同物理机构解释筛选、授权、确认、底座、资料缺失、口头知识和预约断点。'},visualRhythmReason:'按论证段落切换，资料在事实处，纸艺在机制处，业务邀请与判断保留真人。生成片段短于语义段时返回真人，不循环慢放补长。',protectedSpeakerBeatIds:cues.semanticBeats.filter(b=>b.primaryRoute==='speaker').map(b=>b.id)};
let run=[];const flush=()=>{if(!run.length)return;const refs=cues.shotcraftOpportunities.filter(o=>run.includes(o.beatId)).map(o=>o.id);cues.rhythmAudit.runs.push({fromBeatId:run[0],toBeatId:run.at(-1),risk:run.length>3?'medium':'low',decision:refs.length?'shotcraft-opportunity':'keep-presenter',reason:refs.length?'真人连续段以信息节点推进、关系对照与停留交替，不靠无意义运镜撑时长。':'本段靠语气和停顿建立判断，短暂安静的真人画面是节奏的一部分。',mitigationRefs:refs});run=[];};for(const b of cues.semanticBeats){if(b.primaryRoute==='speaker')run.push(b.id);else flush();}flush();
put('03_导演拆解/director-cues.v2.json',cues);
put('03_导演拆解/实录候选时间锚点.r1.json',{recordingSha256:JSON.parse(fs.readFileSync(`${ep}/00_控制/原片入库.json`)).sha256,transcriptSha256:hash(`${ep}/06_实录核对/本地转写_未听审.r1.json`),humanListeningCompleted:false,formalFrameBinding:false,notes:'post-shoot-audio-bound只表示本地识别对本条原声时间轴的绑定；不是已听审逐字稿或剪辑锁点。',beats:timing});
put('03_导演拆解/公开素材镜头映射.r1.json',realMap);
put('04_动效与声音计划/逐段动效声音意图.r1.json',{implementationStatus:'not-started',effectSelection:'导演确认后，剪辑阶段扫描当前全库，不能把未实现当不需要。',items:sound});
const routeZh={speaker:'真人','real-evidence':'公开资料','paper-editorial':'纸艺','ai-generated-video':'AI情景'};
let md='# 本期导演方案｜Meta个人AI助理与本地商家\n\n状态：待您审阅。以本条6分49.5秒实录为主；本地转写和时间点是候选，未冒充逐句听审、正式字幕或帧级定稿。文稿只对照，不恢复实录没有说的话。\n\n';
md+=`## 这一期怎么拍、谁负责\n\n- 您的原片已入库，不需重交。\n- 建议您制作：${pi}条纸艺、1条AI生活情景；首帧与视频提示词见同目录《给您制作_首帧与视频提示词》。先确认首帧中文字与构图，再做视频。\n- Codex负责：${ri}个公开资料展示位置的来源候选、后续${so}处动效机会与对应声音；这里是设计意图，不是声画已实现。\n- 未要求您再录平台操作：没有真实测试就显示官方材料，绝不生成假界面。\n- 您确认本方案、生成素材回来后，才进入选卡、剪辑、小样和声音试听。\n\n## 全片顺序\n\n|原片时间|画面分工|内容及动作安排|\n|---|---|---|\n`;
for(const t of timing){const r=rows[timing.indexOf(t)];md+=`|${fmt(t.startSeconds)}—${fmt(t.endSeconds)}|${routeZh[t.primaryRoute]}${t.routeCueId?' '+t.routeCueId:''}|${t.title}。${r[5]||''}${t.primaryRoute==='paper-editorial'||t.primaryRoute==='ai-generated-video'?`建议${fmt(t.insertStartSeconds)}开始，使用${t.insertDurationSeconds}秒，余下返回真人。`:''}|\n`;}
md+='\n## 必须保住的观看体验\n\n1. 首帧中文直接生成，随承载纸面移动；同一认知目标有前因、动作和结果，不做文字静止、背景乱动。\n2. 公开资料独立视窗＋同步左下真人；文字与来源留在上方资料区，底部单独中英文字幕，不压正文和真人。R/P/B编号只在内部文件，不能出现在观众画面。\n3. 主播手势也在保护区，不再把左侧卡片机械固定到手上。动效按当前真实画面位置排，不盲目全片放大。\n4. 电子运镜只是辅助；本期要恢复信息的逐项出现、重点定位和关系推进，不把推拉当作全部Remotion。\n5. 每个主要Remotion动作均安排声音。纸艺用合格原生动作声；官方产品片的音乐不带入，真人原声始终保留。\n6. 生成片段是说明，不是本人酒店案例；不得生成真实平台交易成功、真实商家排名或虚构客户。\n\n## 尚需确认，不擅自改声画\n\n- 00:35—00:38新增日活句：原财报为Meta产品家族2026年6月平均日活36亿，不是Muse用户，也不是同时在线。建议另配口径说明；字幕仍按实际听到的原话。\n- 02:09—02:16实录候选“中间的事情他一键都不会拉下”：须听清“一件/一键”“落下/拉下”，且避免理解为AI必然不遗漏。建议另加“示例流程，实际仍需逐项核对”，不通过改字幕掩盖原话。\n- 识别中的千问/飞猪/房态/晚入住/漏掉/AI/GEO等疑点见核对表，未确认前不可直接导出为字幕。\n- 本方案和生成提示词为候选，机器结构检查不代表视觉效果、听感或事实全部获准。\n';
put('03_导演拆解/本期导演方案.md',md);
let prompts='# 给您制作｜7条纸艺＋1条生活情景\n\n本包待您确认导演方案后使用。只生成这些说明画面，官方截图与公开资料由Codex准备。每条先做首帧，准确核对指定中文字，再把首帧和对应视频词交给图生视频。无需本地渲染动画。\n\n统一最低参考：8月29日《超级个体》的纸纤维、实体层次、因果动作、字物同动和可用原生动作声；只继承品质，不照搬那条的模型/会员/教程内容。参考原尺寸图在本期07_核对图。\n\n生成建议：16:9，优先1080P或以上；镜头所需时长见每条。若平台只支持整秒，7.3秒镜生成8秒并保留首尾余量。不要拉慢、重复或冻结画面补时长。字幕由后期统一制作，生成片中只放指定物件文字。\n\n';
for(const p of [...cues.routePlans.paperEditorials.items,...cues.routePlans.aiGeneratedVideos.items]){
 const t=timing.find(t=>t.routeCueId===p.id),def=paperDefs.find(d=>d.start===t.insertStartSeconds);
 prompts+=`## ${p.id}｜${def?.title||t.title}\n\n- 插入参考：原片${fmt(t.insertStartSeconds)}起，${p.durationSeconds}秒；位置仍待听审细校。\n- 作用：${p.reason||p.visualIntent}\n- 输出文件名：${p.id}_首帧.png、${p.id}_视频.mp4。\n\n### 首帧提示词\n\n${p.firstFramePrompt}\n\n### 图生视频提示词\n\n${p.videoPrompt}\n\n### 生成限制\n\n${p.negativePrompt.map(x=>'- '+x).join('\n')}\n\n`;
}
prompts+='## 交回之前，只检查这些\n\n逐个字核对；正常速度看字是否跟物件同动；能否看懂动作前后关系；纸纤维与三层空间是否还在；听原生动作声是否清楚、无爆音、无多余人声与配乐。失败只返工对应镜，不重做全部。先保留含原生音轨的原文件，后期单镜混音，不统一静音。\n';
put('03_导演拆解/给您制作_首帧与视频提示词.md',prompts);
put('01_素材投放区/投放说明.md','# 本期唯一素材入口\n\n口播原片已放入01，无需再交。您确认方案后，将G01的视频和首帧放03_AI情景视频；P01—P07的视频和首帧放04_纸艺视频。保留原生声音，不要另外加背景音乐或烧制口播字幕。公开资料由Codex放05。已有原片只读，不删除覆盖。\n\n桌面入口只是本期工程的链接，请不要再复制一套工程。当前目录不是成片发布包。\n');
console.log(JSON.stringify({beats:rows.length,counts,paper:pi,real:ri,coverageSegments:seg.length}));
