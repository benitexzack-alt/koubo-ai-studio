import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MEDIA,AUDIO,USER_QUOTE,FINAL,FFMPEG,FFMPEG_SHA,verifyFfmpeg} from './formal-core.mjs';
test('正式输出全帧原尺寸，R2不是上采样源',()=>{assert.equal(MEDIA.width,1920);assert.equal(MEDIA.height,1080);assert.equal(MEDIA.frames,8393);assert.equal(MEDIA.scale,1);assert.equal(MEDIA.muted,true);});
test('音效混音只有固定线性总衰减，不截尾不改相对增益',()=>{assert.equal(AUDIO.filter,'volume=-0.3dB:precision=double');assert.equal(AUDIO.trim,false);assert.equal(AUDIO.resample,false);assert.equal(AUDIO.relativeMixChanged,false);});
test('只授权当前正式文件，不覆盖旧小样',()=>{assert(USER_QUOTE.includes('直接出成片'));assert(FINAL.includes('1080P正式候选'));assert(!FINAL.includes('candidate-preview-r2/render'));});
test('用户确认的源码不得新增任何视觉变更',()=>{const s=fs.readFileSync(new URL('./worker.mjs',import.meta.url),'utf8');assert(s.includes('lanzhou-services-v91-candidate-r2/index.tsx'));assert(!s.includes('replaceAll('));});
test('音频工具身份不符必须停止',()=>{assert.throws(()=>verifyFfmpeg('/tmp/ffmpeg',()=>FFMPEG_SHA));assert.throws(()=>verifyFfmpeg(FFMPEG,()=> '0'.repeat(64)));assert.equal(verifyFfmpeg(FFMPEG,()=>FFMPEG_SHA),FFMPEG);});
