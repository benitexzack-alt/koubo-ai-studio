# R2音效审计与交接

本轮只读解码R1全片音轨、测量现有素材及51个旧音效窗口；没有原速人耳试听，也没有声称看完全部动态画面。所有结论是本地机器测量与代码/词元/可见文字计划核对。只写本目录音效审计及SFX计划，不改画面、字幕、源音轨、共享代码或知识库，不生成新素材、不联网、不提交。

## 先说结论

R1音效弱有具体电平和时长依据，不能只看文件有声或峰值接近-6dBFS。统一gain=0.13进一步衰减17.72dB；card的90%能量仅6.54毫秒，tick仅30.38毫秒。45帧Sequence没有把实际声音延长。重复36次card和15次tick也没有形成可感知层级。

|R1文件|文件时长|源立体声sample peak|源RMS|0.13后最强50ms RMS|相对同长口播RMS中位数|
|---|---:|---:|---:|---:|---:|
|card.wav|1.071021秒|-5.97dBFS|-34.55dBFS|-38.97dBFS|-36.48dB|
|tick.wav|0.237秒|-6.00dBFS|-25.04dBFS|-36.20dBFS|-23.40dB|

相对值用同一单声道分析域、相同时间窗计算，包含素材静音尾部；须结合50ms能量一起理解，不是心理声学可闻阈值，更不证明R1音效缺失。R1立体声真峰值沿用已核QA的-1.1dBTP。测量文件里的单声道混音峰值不可当作立体声削波；探索性cueResults[].model粗搜索结果全部排除，不用于存在性、真实gain或听感判定。

## 本次配置

计划为26个重点、9个现有变体，各源最多3次，同源间隔至少25秒且不连续；不是把旧51个点整体加大。完整cue、实录词ID/时间、visualId、播放帧窗、SHA和来源见sfx-plan.v1.json；26条noCue覆盖其他视觉行，官方其他行另列documentNoCue。host=1、news=0.62、paper=0.1不变，新闻和五纸艺整个区间禁止新增SFX。

|本地变体ID|gain|durationInFrames|sourceStartFrame|主要角色|
|---|---:|---:|---:|---|
|v3-soft-card-pop-b|0.36|12|0|包容、客户咨询主重音|
|v1-keyword-tick|0.30|7|0|支持、扎根、确定轻节点|
|v1-section-air|0.32|8|0|在兰州、出处、权限|
|v3-media-whoosh-b|0.28|6|0|真人关键词轻节点|
|v1-card-reveal|0.30|12|0|人工智能文件行、作废、适合|
|v3-list-tick-b|0.32|6|0|靠谱、核对、决定|
|v3-number-settle-a|0.26|11|0|外贸、实际查、找我|
|v3-line-connect-a|0.28|12|6|资料、更新、待跟进|
|v3-chapter-sweep-a|0.30|10|5|企业AI应用、对外、改进|

所有音效fadeOutFrames=1、无循环、无变速。帧率30。sourceStartFrame仅为未来composition对既有文件的播放偏移，不写新WAV。card-pop-b虽与旧card同为约-6dBFS峰值，源RMS高约13.99dB、90%能量约212毫秒，因此不只靠更高尖峰增强。

开头包容词帧30/文件起帧29，支持词帧52/文件起帧51；两者在新闻69帧前结束。文件重点改为人工智能词帧2427、扎根词帧2557，对齐父实际行强调/进入节点，文件内部延迟另作补偿，不再在通知2406或用户2578处发声。c020改成现有可见实录词外贸；c047取消，因为可见摘句所有实录词点均在P05内，纸艺之后的看清情况未出现在该行，不改字或挪点强配。

## 验收边界

对照本轮实际读取的knowledge/20-V8连续语义动效与可感知音效基线.md，以上仅是按文件测量制定的候选起测参数。最终立体声AAC必须实测true peak不高于-1dBTP，并通过完整解码，才能登记技术不过载；目前R2混音未生成，truePeakMeasured=false。若越界，仅减新增SFX或改点，不降低固定三路源声。不得靠源文件sample peak预测冒充最终true peak。

人耳可感知仍需用户以正常手机外放核对同画面30-45秒有/无新增SFX A/B；无新增SFX版也保留host/news/paper。audibilityConfirmedByUser=false，未声称人耳试听。P03原声音量数值不确定继续保留P2待用户试听，13项ASR不确定不变；formal=false。

9项publicAsset需求绑定现有V8输出SHA及本地V1/V3许可manifest；CC0/Mixkit属于历史本地来源记录，未联网核验现行许可。Linnaeus负责父冻结后的R2public链接，本worker不写public目录。R2知识上下文待父输入稳定后另行真实建立，不提前start或写allow，不写daily/project。

## 证据

- audio-audit.measurements.json：全片解码音频统计、源文件峰值/RMS/能量时长、旧51点相对主声、12项候选源测量。
- audio-audit.commands.json：实际命令、退出码、stderr、解码PCM样本数及输入SHA；PCM只在内存。
- audio-audit.recommendations.json：测量解释与限制，具体cue以sfx-plan.v1.json为准。
- audio-audit.public-assets.v1.json：源绝对路径/SHA、目标public路径、来源manifest绑定。
- sfx-plan.v1.json：消费接口、可见词绑定、noCue理由和待最终实测/用户验收标记。
