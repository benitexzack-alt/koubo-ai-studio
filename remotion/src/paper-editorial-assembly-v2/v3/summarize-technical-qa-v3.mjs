import {readFileSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const qa=join(here,'qa');
const read=(name)=>readFileSync(join(qa,name),'utf8');
const probeWith=JSON.parse(read('ffprobe-with-sfx.json'));
const probeNo=JSON.parse(read('ffprobe-no-sfx.json'));
const videoWith=probeWith.streams.find((stream)=>stream.codec_type==='video');
const audioWith=probeWith.streams.find((stream)=>stream.codec_type==='audio');
const videoNo=probeNo.streams.find((stream)=>stream.codec_type==='video');

const freezeLog=read('freezedetect.log');
const starts=[...freezeLog.matchAll(/freeze_start:\s*([\d.]+)/g)].map((match)=>Number(match[1]));
const ends=[...freezeLog.matchAll(/freeze_end:\s*([\d.]+)/g)].map((match)=>Number(match[1]));
const duration=Number(probeWith.format.duration);
const rawFreezes=starts.map((start,index)=>({start,end:ends[index]??duration}));
const mergedFreezes=[];
for(const interval of rawFreezes){
  const previous=mergedFreezes.at(-1);
  if(previous&&interval.start<=previous.end+.1){
    previous.end=Math.max(previous.end,interval.end);
  }else{
    mergedFreezes.push({...interval});
  }
}
for(const interval of mergedFreezes){
  interval.duration=Number((interval.end-interval.start).toFixed(6));
}

const ebur=read('ebur128.log');
const eburSummary=ebur.match(/Integrated loudness:\s*\n\s*I:\s*([-\d.]+) LUFS[\s\S]*?Loudness range:\s*\n\s*LRA:\s*([-\d.]+) LU[\s\S]*?True peak:\s*\n\s*Peak:\s*([-\d.]+) dBFS/);
if(!eburSummary){
  throw new Error('Unable to parse final ebur128 summary');
}
const loudness={
  integratedLufs:Number(eburSummary[1]),
  loudnessRangeLu:Number(eburSummary[2]),
  truePeakDbfs:Number(eburSummary[3]),
};

const blackEvents=[...read('blackdetect.log').matchAll(/black_start:/g)].length;
const whiteEvents=[...read('whitedetect.log').matchAll(/black_start:/g)].length;
const duplicateRuns=read('exact-duplicate-runs.txt').trim().split('\n').filter(Boolean);
const audioStreamsWith=probeWith.streams.filter((stream)=>stream.codec_type==='audio').length;
const audioStreamsNo=probeNo.streams.filter((stream)=>stream.codec_type==='audio').length;
const zeroLengthEvidence=['decode-with-sfx.log','decode-no-sfx.log','video-stream-parity.log']
  .map((name)=>({name,bytes:statSync(join(qa,name)).size}));

const checks={
  withSfxSpec:videoWith?.width===1920&&videoWith?.height===1080&&videoWith?.r_frame_rate==='30/1'&&Number(videoWith?.nb_frames)===900&&duration===30,
  noSfxSpec:videoNo?.width===1920&&videoNo?.height===1080&&videoNo?.r_frame_rate==='30/1'&&Number(videoNo?.nb_frames)===900&&Number(probeNo.format.duration)===30,
  expectedAudioStreams:audioStreamsWith===1&&audioStreamsNo===0,
  audioReachesFinalReceipt:Number(audioWith?.duration)>=29.45,
  fullDecodeAndVideoParity:zeroLengthEvidence.every(({bytes})=>bytes===0),
  noBlackOrWhiteEvents:blackEvents===0&&whiteEvents===0,
  noExactDuplicateRuns:duplicateRuns.length===0,
  freezeIntervalsWithinCandidateGate:mergedFreezes.every((interval)=>interval.duration<=1.5),
  previewLoudnessEnvelope:loudness.integratedLufs>=-40&&loudness.integratedLufs<=-10&&loudness.truePeakDbfs>=-24&&loudness.truePeakDbfs<=-1,
};

const result={
  schemaVersion:'paper-editorial-assembly-v3-technical-summary',
  status:'candidate-blocked-reference-minimum',
  productionEligible:false,
  technicalGatePass:Object.values(checks).every(Boolean),
  freezeDetection:{noiseDb:-50,minimumDurationSeconds:0.5,mergeGapSeconds:0.1,candidateMaximumSeconds:1.5},
  checks,
  loudness,
  mergedFreezes,
  blackEvents,
  whiteEvents,
  duplicateRuns,
  audio:{withSfxStreams:audioStreamsWith,noSfxStreams:audioStreamsNo,durationSeconds:Number(audioWith?.duration)},
  zeroLengthEvidence,
  humanAcceptance:'pending-user-normal-speed-full-watch-and-sfx-audition'
};

console.log(JSON.stringify(result,null,2));
if(!result.technicalGatePass){
  process.exitCode=1;
}
