#!/usr/bin/env node

import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const sourcePath = path.resolve(
  repoRoot,
  'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r3/director-preproduction-request.v1.json',
);
const outputPath = path.resolve(here, 'director-preproduction-request.v1.json');
const request = JSON.parse(readFileSync(sourcePath, 'utf8'));

const getBeat = (beatId) => {
  const beat = request.beats.find((item) => item.id === beatId);
  if (!beat) throw new Error(`R4_SOURCE_BEAT_MISSING:${beatId}`);
  return beat;
};

const getNode = (beat, nodeId) => {
  const node = beat.paperScene.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error(`R4_SOURCE_NODE_MISSING:${beat.id}:${nodeId}`);
  return node;
};

const getTextItem = (beat, nodeId) => {
  const item = beat.paperScene.textPlan.find((entry) => entry.nodeId === nodeId);
  if (!item) throw new Error(`R4_SOURCE_TEXT_ITEM_MISSING:${beat.id}:${nodeId}`);
  return item;
};

request.requestId = 'local-ai-services-paper-v3-r4-pre-shoot';
request.outputs = {
  routeLockPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r4/director-route-lock.v1.json',
  planPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r4/director-preproduction-plan.v1.json',
  assetSheetPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r4/全素材路由与制作清单_v3-r4.md',
  firstFramePromptManifestPath: 'edit/generated-video/20260902_local_ai_services_paper-v3-r4/first-frame-prompts.v1.json',
  runningHubPromptManifestPath: 'edit/generated-video/20260902_local_ai_services_paper-v3-r4/runninghub-image-to-video-prompts.v1.json',
  runningHubPromptSheetPath: 'edit/generated-video/20260902_local_ai_services_paper-v3-r4/runninghub-image-to-video-prompts.md',
  compileReceiptPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r4/director-compile-receipt.v1.json',
  validationReceiptPath: 'edit/20260902_local_ai_services/03_导演拆解/paper-v3-r4/director-validation-receipt.v1.json',
};

const b08 = getBeat('B08');
b08.spokenLine =
  '你就上门访谈，听老人讲述自己的一生，童年、求学、工作时代、家庭变迁，录音收集口述素材。再借助AI整理时间线、润色文稿，修复老照片。最终交付可以是电子纪念手册、家族数字档案，也可以做成动画短片，甚至印刷成纸质回忆录，作为家族的一份数字资产留给后代。';
b08.coreMeaning =
  '完整呈现访谈采集、时间整理、照片修复、数字交付和家族归档流程，并保留人工核对。';
getNode(b08, 'N4').groupId = 'G5';
Object.assign(getTextItem(b08, 'N4'), {
  groupId: 'G5',
  surfaceId: 'G5-rigid-label-card',
  enterStageId: 'S5',
  persistence: 'S5-to-end',
});
b08.paperScene.labelBindingPolicy = {
  unlabeledObjectGroups: [
    {
      groupId: 'G4',
      reason: '电子手册由绿色电子手册纸模直接表达，只作无字数字交付物件，不配置第五张标签牌。',
    },
  ],
};
b08.paperScene.prompt.firstFrame =
  '16:9电影级手作纸艺口述史工作台，五组物件沿由左后向右前的路径清楚分层：暖灰访谈桌与录音纸盘、深蓝时间线与逐字卡、冷青照片修复台与校对放大镜、绿色电子手册纸模、暖白装订册与档案盒。严格只设置四张独立空白刚性标签牌：第一张固定在访谈桌与录音纸盘旁，第二张固定在时间线与逐字卡旁，第三张固定在照片修复台与放大镜旁，第四张固定在装订册与档案盒旁。绿色电子手册纸模只作无字物件，周围不得出现第五张标签牌。四张标签牌正面朝向镜头、互不遮挡、四角完整、面积足够，五层纵深、柔和侧光、纸纤维清晰。不得生成真实老人面孔、隐私信息、可读文字、乱码、字母、数字、Logo、水印或虚假档案编号，准确中文将在本地确定性写入。';
b08.paperScene.prompt.motion =
  '8秒纸艺定格。保持首帧五组物件、四张带字标签牌的位置关系和数量不变：访谈桌展开且录音纸盘缓慢转动；逐字卡按年代落入时间线；旧照片滑入修复台，校对放大镜压下确认；绿色电子手册作为无字刚性物件从交付盒中展开；暖白装订册最后进入档案盒，第四张标签牌随档案盒刚性扣合。四张首帧已有中文标签必须逐字保持，不新增第五张标签牌，不改写、不遮挡、不翻面、不弯曲、不拉伸，不产生乱码或漂浮屏幕字幕；结尾稳定停留至少0.8秒。';

const b10 = getBeat('B10');
getNode(b10, 'N2').groupId = 'G3';
Object.assign(getTextItem(b10, 'N2'), {
  groupId: 'G3',
  surfaceId: 'G3-rigid-label-card-copy',
  enterStageId: 'S3',
  persistence: 'S3-to-end',
});
getTextItem(b10, 'N3').surfaceId = 'G3-rigid-label-card-poster';
b10.paperScene.labelBindingPolicy = {
  unlabeledObjectGroups: [
    {
      groupId: 'G2',
      reason: '提示词抽屉与无字任务卡只负责启动任务，节点含义由造型和动作表达，不配置标签牌。',
    },
    {
      groupId: 'G5',
      reason: '反馈盘与回流纸片只表达复盘动作，不增加第五张标签牌。',
    },
  ],
};
b10.paperScene.prompt.firstFrame =
  '16:9克制的手作纸艺实体门店工作台，左后方为暖白柜台和产品纸模，中间为深蓝提示词抽屉，右侧为冷青文案与海报双工位，前景为绿色沟通交付门和灰白反馈盘。严格只设置四张独立空白刚性标签牌：第一张放在柜台产品旁；第二张放在冷青工作台左侧文案位；第三张放在同一工作台右侧海报位；第四张放在绿色沟通交付门旁。深蓝提示词抽屉和灰白反馈盘均不配置标签牌。四张纸牌正面朝向镜头、互不遮挡、四角完整、面积足够，五层空间、真实纸纤维、柔和侧光。不得生成保健疗效暗示、虚假订单、二维码、真实平台Logo、可读文字、乱码、字母、数字或水印，准确中文将在本地确定性写入。';
b10.paperScene.prompt.motion =
  '8秒纸艺定格。保持首帧四张带字标签牌和五组物件的对应关系：门店柜台与产品纸模立起；深蓝提示词抽屉拉开并推出一张完全空白任务卡；冷青工作台上的文案纸片和海报纸片依次滑到各自工位；绿色沟通纸片穿过交付门；灰白反馈盘转动后送回一张无字调整纸片。四张首帧已有中文标签必须逐字保持且只随各自刚性物件移动，不新增标签、不改写、不遮挡、不翻面、不弯曲、不拉伸，不产生乱码、营销承诺或漂浮屏幕字幕；结尾稳定停留至少0.8秒。';

const b13 = getBeat('B13');
b13.paperScene.objectGroups.find((group) => group.id === 'G1').material =
  '暖白人物与纯空白需求卡';
b13.paperScene.objectGroups.find((group) => group.id === 'G4').material =
  '绿色交付盒与无字确认压板';
Object.assign(b13.paperScene.stages.find((stage) => stage.id === 'S1'), {
  action: '一张完全空白、无图形无印记的需求卡落到人物旁的桌面',
});
Object.assign(b13.paperScene.stages.find((stage) => stage.id === 'S2'), {
  action: 'AI工具箱打开并推出三张靠颜色和位置区分的纯空白候选纸片',
});
Object.assign(b13.paperScene.stages.find((stage) => stage.id === 'S4'), {
  action: '可用结果进入现场，无字确认压板在用户检查后落下锁定',
});
b13.paperScene.prompt.firstFrame =
  '16:9手作纸艺结论场景，左侧为暖白无脸纸片人物，人物旁放一张完全空白、无图形无印记的需求卡；中间为深蓝纸质AI工具箱，箱内横向摆放三张纯空白候选纸片，深蓝纸片在左、冷青纸片居中、灰白纸片在右，只靠颜色和位置区分；右侧为冷青人工检查尺与选择门；前景为绿色交付盒和一块无字确认压板。四张独立空白刚性标签牌分别固定在人物需求区、工具箱、人工判断区和交付盒旁，正面朝向镜头、互不遮挡、四角完整、面积足够。四层空间、真实纸纤维与柔和侧光。不得生成机器人、魔法按钮、金币、收益保证、可读文字、乱码、字母、数字、Logo、水印，也不得在需求卡或三张候选纸片上生成任何图形、印记、编号、图标或勾叉；准确中文将在本地确定性写入。';
b13.paperScene.prompt.motion =
  '6秒纸艺定格。暖白人物旁的一张完全空白需求卡先滑入桌面；深蓝AI工具箱打开，三张纯空白候选纸片按左、中、右位置依次推出；冷青检查尺逐张经过，只把居中的冷青纸片送过选择门，其余两张退回工具箱；绿色交付盒滑入现场，无字确认压板在用户检查动作后垂直落下完成机械锁定。四张首帧已有中文标签必须逐字保持且只随各自刚性物件移动；需求卡与候选纸片始终保持纯空白，不新增图形、印记、编号、图标、勾叉、文字或漂浮屏幕字幕，不改写、不遮挡、不翻面、不弯曲、不拉伸；结尾稳定停留至少0.8秒。';

writeFileSync(outputPath, `${JSON.stringify(request, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});

console.log(
  JSON.stringify({
    ok: true,
    sourcePath,
    outputPath,
    requestId: request.requestId,
    correctedBeats: ['B08', 'B10', 'B13'],
  }),
);
