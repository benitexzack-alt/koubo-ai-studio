import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createWorkbench,exportEpisode} from '../server.mjs';
import {readSelection} from '../scripts/selection.mjs';

const catalog={version:'测试',effects:Array.from({length:122},(_,i)=>({id:`effect-${i}`,name:`效果${i}`,signature:'保持对象并逐项呈现',requirements:['本期原句'],officialUrl:'https://skillry.dev'}))};
const makeState=()=>({schemaVersion:1,revision:0,favorites:['effect-1'],activeEpisodeId:'episode-1',episodes:[{id:'episode-1',title:'真实流程测试',transcriptText:'第一句\n第二句',selections:[{id:'selection-1',effectId:'effect-1',anchor:'第一句',text:'标签一',note:'',startSec:null,endSec:null,candidatePath:'',candidateSec:null,reviewed:false}]}]});

test('保存、重启、版本冲突、导出、媒体范围与损坏文件保护',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'koubo-workbench-test-'));
  const dataDir=path.join(root,'data'); await fs.mkdir(dataDir);
  await fs.writeFile(path.join(dataDir,'catalog.json'),JSON.stringify(catalog));
  await fs.mkdir(path.join(root,'edit'));
  await fs.writeFile(path.join(root,'edit','test.mp4'),Buffer.from('0123456789'));
  let server=await createWorkbench({dataDir,projectRoot:root});
  const start=async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;};
  let base=await start();
  const get=p=>fetch(base+p);
  const put=(state,revision=0,extra={})=>fetch(base+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify({expectedRevision:revision,state})});
  try{
    let res=await get('/api/state');assert.equal((await res.json()).revision,0);
    res=await put(makeState());assert.equal(res.status,200);let state=await res.json();assert.equal(state.revision,1);
    const read=await (await get('/api/state')).json();assert.equal(read.episodes[0].transcriptText,'第一句\n第二句');assert.equal(read.episodes[0].updatedAt,state.episodes[0].updatedAt);
    res=await put({...state,favorites:[]},0);assert.equal(res.status,409);assert.deepEqual((await (await get('/api/state')).json()).favorites,['effect-1']);
    res=await put(state,1,{Origin:'https://untrusted.example'});assert.equal(res.status,403);
    res=await get('/api/export?episode=episode-1&format=json');const exported=await res.json();assert.equal(exported.selections[0].anchor,'第一句');assert.equal(exported.selections[0].status,'待实录绑定');
    res=await get('/api/export?episode=episode-1&format=md');assert.match(await res.text(),/保持对象并逐项呈现/);
    res=await fetch(base+'/api/media?path=edit/test.mp4',{headers:{Range:'bytes=2-5'}});assert.equal(res.status,206);assert.equal(await res.text(),'2345');
    res=await get('/api/media?path=../outside.mp4');assert.equal(res.status,400);
    await fs.writeFile(path.join(root,'private.mp4'),'private');await fs.symlink(path.join(root,'private.mp4'),path.join(root,'edit','escape.mp4'));
    res=await get('/api/media?path=edit/escape.mp4');assert.equal(res.status,403);
    const invalid=structuredClone(state);invalid.episodes[0].selections[0].effectId='missing';res=await put(invalid,1);assert.equal(res.status,400);
    invalid.episodes[0].selections[0].effectId='effect-1';invalid.episodes[0].selections[0].reviewed=true;res=await put(invalid,1);assert.equal(res.status,400);
    state.episodes[0].selections[0]={...state.episodes[0].selections[0],startSec:1,endSec:2,candidatePath:'edit/test.mp4',candidateSec:1,reviewed:true};
    res=await put(state,1);assert.equal(res.status,200);state=await res.json();
    assert.equal(state.episodes[0].selections[0].candidateFingerprint.length,64);
    await fs.writeFile(path.join(root,'edit','test.mp4'),'NEW_CONTENT');
    const changed=(await (await get('/api/state')).json()).episodes[0].selections[0];
    assert.equal(changed.reviewed,false);assert.match(changed.reviewWarning,/内容已变化/);
    assert.notEqual(changed.candidateFingerprint,state.episodes[0].selections[0].candidateFingerprint);
    assert.equal((await (await get('/api/export?episode=episode-1')).json()).selections[0].reviewed,false);
    const diskBeforeRead=await fs.readFile(path.join(dataDir,'state.json'),'utf8');
    assert.equal(JSON.parse(diskBeforeRead).episodes[0].selections[0].reviewed,true);
    const cliExport=await readSelection({dataDir,projectRoot:root,episodeId:'episode-1'});
    assert.equal(cliExport.selections[0].reviewed,false);assert.match(cliExport.selections[0].reviewWarning,/内容已变化/);
    assert.equal(await fs.readFile(path.join(dataDir,'state.json'),'utf8'),diskBeforeRead);
    // 旧页面带旧指纹再次保存，不得把新视频恢复成已确认。
    res=await put(state,2);assert.equal(res.status,200);state=await res.json();
    assert.equal(state.episodes[0].selections[0].reviewed,false);
    assert.equal(state.episodes[0].selections[0].candidateFingerprint,changed.candidateFingerprint);
    state.episodes[0].selections[0].reviewed=true;
    res=await put(state,3);assert.equal(res.status,200);state=await res.json();assert.equal(state.episodes[0].selections[0].reviewed,true);
    state.episodes[0].transcriptText='新的实录版本';
    res=await put(state,4);assert.equal(res.status,200);state=await res.json();assert.equal(state.episodes[0].selections[0].reviewed,false);
    state.episodes[0].selections[0].reviewed=true;
    res=await put(state,5);assert.equal(res.status,200);state=await res.json();assert.equal(state.episodes[0].selections[0].reviewed,true);
    state.episodes[0].selections[0].text='已修改';
    res=await put(state,6);assert.equal(res.status,200);state=await res.json();assert.equal(state.episodes[0].selections[0].reviewed,false);
    assert.equal((await fs.readdir(path.join(dataDir,'backups'))).length,6);
    await new Promise(r=>server.close(r));server=await createWorkbench({dataDir,projectRoot:root});base=await start();
    assert.equal((await (await get('/api/state')).json()).revision,7);
    await fs.writeFile(path.join(dataDir,'state.json'),'损坏');
    res=await get('/api/state');assert.equal(res.status,500);
    res=await put(makeState(),7);assert.equal(res.status,500);assert.equal(await fs.readFile(path.join(dataDir,'state.json'),'utf8'),'损坏');
  }finally{await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
});
