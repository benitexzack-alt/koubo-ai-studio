import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const rows=JSON.parse(fs.readFileSync(path.join(dir,'probe-results.json'),'utf8'));
const map=[
 ['P01','paper-file-3','试错、追问、重练；蓝色圆片沿S形纸槽移动',[69.333333,76.6],'最少让你踩两次坑→直到你独立答对','前景三字牌下缘约画高88%，缩入上部资料视窗，字幕置其外。'],
 ['P02','paper-file-6','检验一、检验二、检验三、继续学习；红色闸杆抬起',[92.266667,98.8],'然后抛出三道检验题→必须三道全部答对才能往下学','源素材后半镜头上移，前景三检验字牌渐出底边；这是源素材局限，后期不能恢复。不得叠字幕再覆盖，建议素材上部独立视窗。'],
 ['P03','paper-file-2','七天计划、每天四十五分、任务与验收；纸日历展开',[110.066667,117.333333],'AI输出七天学习计划→做到什么样才算完成','每天四十五分字牌在左下约画高76%-90%，独立字幕区。'],
 ['P04','paper-file-4','表面会了、五个追问、实际盲区；蓝遮板向右移',[132,139.266667],'AI抛出五个深挖底层的问题→看着会一上手就废的盲区','本窗口与已确认问题录屏133.0-135.5重叠，不能直接覆盖已确认录屏；可在125.733333-133.0提前伴随隐藏漏洞检测器/已经学会展示整段，或保持录屏优先并仅用其余语义窗。不应改变已确认录屏摆位。'],
 ['P05','paper-file-5','上次作业、这次作业、同一问题；蓝纸叠合白纸',[163.733333,170.2],'如果停止不前→不做虚假鼓励','同一问题字牌约画高68%-83%，需独立字幕区。本窗口覆盖已批准R2语义卡的末段：若保留已批准卡，可前移到155.0-161.566667的前后产出/能力提升语义区；不要在纸艺上重复叠Remotion卡。'],
 ['P06','paper-file-1','依据、推理、结论；左三纸牌连倒至断点，右侧保留直立',[208.9,215.466667],'你必须讲清楚每一步为什么这么判断→逻辑通顺才算真正掌握','依据字牌在左下中部，画面底部较干净，仍保留字幕区。'],
 ['P07','paper-file-7','试错、挑错、核验、人工判断；橙色托架依次行进',[269.666667,277.666667],'三号AI交叉校验所有结果→多个AI相互校验','全程字牌在中上部，底部较空，可用正常底部双语字幕。'],
 ['G01','G01','办公室会议，男性面对递来的文件夹，视线下降',[178.066667,184.533333],'比如客户临时改需求→方案现场被质疑/让你现场输出','仅作情景说明，不是客户实证；桌面下部较干净，生成音轨静音。']
];
const assets=map.map(([id,key,observed,range,anchor,risk])=>{
 const row=rows.find(r=>r.key===key);
 return {...row,id,route:id==='G01'?'ai-generated-video':'paper-editorial',visualInspection:{firstMiddleLastViewed:true,observed,sourceVideoMotionVisible:true,sourceAudioShouldBeMuted:true,subtitleRisk:risk},suggestedTimeline:{status:'recommendation-not-applied',source:'05_实录与字幕/turbo.actual.raw.json 的实际口播时间，不以原稿估时',startSeconds:range[0],endSeconds:range[1],anchor,durationPolicy:'实际时间窗不可超过已解码素材时长；无定格、无循环，30fps按窗口向内取整。'}};
});
const result={schemaVersion:'ai-training-generated-assets-manifest/v1',date:'2026-09-20',task:'AI八种训练方法正式成片素材核验',scope:'只核验已提供8段生成素材，原文件只读，未重生成/未剪辑/未改导演表',authority:'插入建议仅供主剪辑对照真实语音与已验收小样；不替代最终入出点',allDecoded:assets.every(a=>a.decoded),allActualPathsInspected:true,assets};
fs.writeFileSync(path.join(dir,'generated-assets.manifest.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(assets.map(a=>({id:a.id,path:a.path,durationSeconds:a.durationSeconds,sha256:a.sha256})),null,2));
