import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const taskRoot = path.join(projectRoot, 'edit/20260902_local_ai_services');
const qaRoot = path.join(taskRoot, '07_预览与质检/素材门_r1');
const decodeRoot = path.join(qaRoot, 'decode-logs');
const receiptPath = path.join(qaRoot, 'material-gate-receipt.v1.json');

const assets = [
  {
    id: 'R01',
    role: 'canonical-talk-footage',
    semantic: '279.433333秒真人口播，唯一声音与字幕正文',
    relativePath: '01_口播原片待放/copy_3F3E7580-B0D3-4922-A052-49F299E23BCA.MOV',
    expectedSha256: 'cfb3f0e467a2bfdfd2b91756d67566dbd5383acecc7ae2e814b05cdee0891f95',
  },
  {
    id: 'U02',
    role: 'user-provided-real-media',
    semantic: '家庭故事动画案例与家庭观看反应，讲解时真人缩至右下角',
    relativePath: '02_用户视频素材待放/U02_家庭故事动画原片/oQzBAAVIWzSGzCWYApECmeIfLBA7EAFIm8eqAI.mov',
    expectedSha256: '3aef8edeb02410e53d24120d16c7bca964e7f33669a39ec64ba84987027cab70',
    reviewNote: '源片含平台或生成工具标识，低清预览需人工判断是否接受。',
  },
  {
    id: 'U03',
    role: 'user-provided-real-media',
    semantic: '婚礼定制短片案例，讲解时真人缩至右下角',
    relativePath: '02_用户视频素材待放/U03_婚礼定制短片原片/oQPvfADfS6bBlF75Uzd1sgaBAQV9CWeIp5pnEj.mov',
    expectedSha256: 'd91c5774160f8ff2ba617ecf274851400d95bea56bcc449fe671a4a340bee929',
    reviewNote: '源片右上角可见 HIGGSFIELD SEEDANCE 2.5 标识，低清预览需人工判断是否接受。',
  },
  {
    id: 'U04',
    role: 'generated-video-illustration',
    semantic: 'AI长辈人生数字回忆录：老人接受访谈、桌面有老照片',
    relativePath: '02_用户视频素材待放/U04_AI长辈人生数字回忆录情景演绎/视频.mp4',
    expectedSha256: 'd71dd0141a3ce6272cc441cc62adda153016de65bf718e2eb5d036e624a357ad',
  },
  {
    id: 'U05',
    role: 'generated-video-illustration',
    semantic: '银发群体AI教育与营销赋能：门店经营者使用手机和电脑',
    relativePath: '02_用户视频素材待放/U05_银发群体AI教育情景演绎/视频_2.mp4',
    expectedSha256: 'a989b468cfe2790c05209b0b01ed4f8d8eefaa0f050a26d0ed5998d42a0a3802',
  },
  {
    id: 'P01', beat: 'B02', role: 'paper-editorial',
    semantic: '时间投入→内容产出→平台分发→结果不定',
    labels: ['时间投入', '内容产出', '平台分发', '结果不定'],
    relativePath: '05_动画资产/图生视频待回填/视频_3.mp4',
    expectedSha256: '5b694a5d7526d3ee9664bce0aa549c10fe896c2785a7a035278635dc4a47c9db',
  },
  {
    id: 'P02', beat: 'B03', role: 'paper-editorial',
    semantic: '公域分发与本地服务路径对照',
    labels: ['公域分发', '算法筛选', '本地关系', '真实验收'],
    relativePath: '05_动画资产/图生视频待回填/视频_2.mp4',
    expectedSha256: '547292976aa414cc76ba5fc285faf71e65b99d88eb83d50ad8d6f3dc300340dc',
  },
  {
    id: 'P03', beat: 'B08', role: 'paper-editorial',
    semantic: '长辈数字回忆录工作流',
    labels: ['上门访谈', '人生时间线', '老照片修复', '家族档案'],
    relativePath: '05_动画资产/图生视频待回填/视频_5.mp4',
    expectedSha256: 'c8975ddd22f2a8cc08e874e25c7db6fbb0e508c5ba1ce4478f0cb097120c8b62',
  },
  {
    id: 'P04', beat: 'B10', role: 'paper-editorial',
    semantic: '银发门店的四项实用AI任务',
    labels: ['门店产品', '短视频文案', '宣传海报', '沟通话术'],
    relativePath: '05_动画资产/图生视频待回填/视频_4.mp4',
    expectedSha256: '11b2c433dcd71f53a71286aec0f91f3ccd6e88e72dc8ee8ccbf9bc5212c0d830',
  },
  {
    id: 'P05', beat: 'B11', role: 'paper-editorial',
    semantic: '本地服务可验收闭环',
    labels: ['本地客户', '真实需求', '明确交付', '现场验收'],
    relativePath: '05_动画资产/图生视频待回填/视频_7.mp4',
    expectedSha256: '016f37ae439930e72e09ea94f5a0884c3360abed93de4afba379b9921aa226e0',
  },
  {
    id: 'P06', beat: 'B12', role: 'paper-editorial',
    semantic: '线上案例通向线下小单验证',
    labels: ['线上案例', '内容名片', '线下沟通', '小单验证'],
    relativePath: '05_动画资产/图生视频待回填/视频.mp4',
    expectedSha256: 'e1f23f0a8103f7719c71461e0417118d8b58bb82313705023ea90bc94cf8bd65',
  },
  {
    id: 'P07', beat: 'B13', role: 'paper-editorial',
    semantic: '真实需求经过AI工具和人工判断形成可用结果',
    labels: ['真实需求', 'AI工具', '人工判断', '可用结果'],
    relativePath: '05_动画资产/图生视频待回填/视频_6.mp4',
    expectedSha256: 'b0faead9ca87af85573d9f4c9e5189402561f5f0c8397410ca7454d2b50026c4',
  },
];

const hashFile = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const probe = (filePath) => JSON.parse(execFileSync('ffprobe', [
  '-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath,
], {encoding: 'utf8'}));

fs.mkdirSync(decodeRoot, {recursive: true});
const checks = assets.map((asset) => {
  const absolutePath = path.join(taskRoot, asset.relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`${asset.id} 文件缺失：${absolutePath}`);
  const sha256 = hashFile(absolutePath);
  if (sha256 !== asset.expectedSha256) {
    throw new Error(`${asset.id} SHA不一致：${sha256}`);
  }
  const media = probe(absolutePath);
  const video = media.streams.find((stream) => stream.codec_type === 'video');
  const audio = media.streams.find((stream) => stream.codec_type === 'audio');
  if (!video || !audio) throw new Error(`${asset.id} 必须同时有视频流和音频流`);
  const decode = spawnSync('ffmpeg', [
    '-hide_banner', '-v', 'error', '-i', absolutePath, '-map', '0:v:0', '-map', '0:a:0',
    '-f', 'null', '-',
  ], {encoding: 'utf8'});
  const decodeLog = path.join(decodeRoot, `${asset.id}.log`);
  fs.writeFileSync(decodeLog, `${decode.stderr ?? ''}`, 'utf8');
  if (decode.status !== 0) throw new Error(`${asset.id} 完整解码失败，见 ${decodeLog}`);
  return {
    ...asset,
    absolutePath,
    sha256,
    media: {
      durationSeconds: Number(media.format.duration),
      sizeBytes: Number(media.format.size),
      video: {
        codec: video.codec_name,
        width: video.width,
        height: video.height,
        frameRate: video.avg_frame_rate,
        pixelFormat: video.pix_fmt,
        frames: video.nb_frames ? Number(video.nb_frames) : null,
      },
      audio: {
        codec: audio.codec_name,
        sampleRate: Number(audio.sample_rate),
        channels: audio.channels,
      },
    },
    decode: {status: 'passed', log: decodeLog},
  };
});

const receipt = {
  schemaVersion: 1,
  revisionId: '20260904-local-ai-services-material-gate-r1',
  generatedAt: new Date().toISOString(),
  status: 'passed-for-candidate-preview',
  sourcePolicy: {
    originalFilesAreReadOnly: true,
    canonicalTalkAsset: 'R01',
    paperAssetsRequireUniqueSemanticMapping: true,
    generatedScenesAreIllustrationOnly: ['U04', 'U05'],
  },
  checks,
  knownHumanReviewItems: [
    'U02 源片含平台或生成工具标识。',
    'U03 源片含 HIGGSFIELD SEEDANCE 2.5 标识。',
    '所有素材原声仅低增益混入，需在低清候选按正常音量复听。',
  ],
};

fs.mkdirSync(path.dirname(receiptPath), {recursive: true});
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(`素材：${checks.length}`);
console.log(`完整解码：${checks.every((item) => item.decode.status === 'passed') ? 'PASS' : 'FAIL'}`);
console.log(`回执：${receiptPath}`);
