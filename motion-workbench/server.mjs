import http from 'node:http';
import {promises as fs, createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID, createHash} from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const maxStateBytes = 32 * 1024 * 1024;
const emptyState = () => ({schemaVersion: 1, revision: 0, favorites: [], activeEpisodeId: null, episodes: []});
const err = (status, message) => Object.assign(new Error(message), {status});
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp4':'video/mp4','.m4v':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.svg':'image/svg+xml'};
const inside = (root, value) => value.startsWith(root + path.sep);

function text(value, max, name) {
  if (typeof value !== 'string' || value.length > max) throw err(400, `${name}格式不正确或过长`);
  return value;
}
function id(value) {
  if (typeof value !== 'string' || !/^[\w-]{1,100}$/.test(value)) throw err(400, '记录编号格式不正确');
  return value;
}
function seconds(value, name) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 86400) throw err(400, `${name}须为有效的非负秒数`);
  return value;
}
function relativeMedia(value) {
  if (!value) return '';
  text(value, 1500, '候选视频路径');
  if (path.isAbsolute(value) || value.includes('\\') || value.split('/').some(x => ['..','.',''].includes(x)) || !/^(edit|outputs)\//.test(value) || !['.mp4','.m4v','.webm','.mov'].includes(path.extname(value).toLowerCase())) throw err(400, '候选视频须位于本项目 edit 或 outputs 内，填写相对路径');
  return value;
}

export function validateState(input, catalog) {
  if(Buffer.byteLength(JSON.stringify(input) || '')>maxStateBytes)throw err(413,'方案总量超过32MB，请先备份，再精简过长的文稿或恢复到独立归档；原记录不会覆盖');
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.episodes) || input.episodes.length > 300 || !Array.isArray(input.favorites)) throw err(400, '选择记录格式不正确');
  const ids = new Set(catalog.effects.map(x => x.id));
  const effect = value => {if (!ids.has(value)) throw err(400, '存在不属于当前动效库的选择'); return value;};
  const seen = new Set();
  const episodes = input.episodes.map(ep => {
    const key = id(ep.id);
    if (seen.has(key)) throw err(400, '本期编号重复');
    seen.add(key);
    if (!Array.isArray(ep.selections) || ep.selections.length > 500) throw err(400, '本期选择数量超出范围');
    const selectionIds = new Set();
    const selections = ep.selections.map(s => {
      const sid = id(s.id);
      if (selectionIds.has(sid)) throw err(400, '选择编号重复');
      selectionIds.add(sid);
      const startSec = seconds(s.startSec, '入点'), endSec = seconds(s.endSec, '出点');
      if ((startSec === null) !== (endSec === null) || (startSec !== null && endSec <= startSec)) throw err(400, '实录入点与出点须一起填写，且出点晚于入点');
      const candidatePath = relativeMedia(s.candidatePath || '');
      const candidateSec = seconds(s.candidateSec, '候选片定位');
      if (candidateSec !== null && !candidatePath) throw err(400, '请先填写候选视频路径');
      if (s.reviewed === true && (!candidatePath || candidateSec === null || startSec === null || !s.anchor?.trim())) throw err(400, '确认前须绑定实录原句、入出点与候选视频位置');
      const candidateFingerprint=s.candidateFingerprint || '';
      if(candidateFingerprint && !/^[a-f0-9]{64}$/.test(candidateFingerprint))throw err(400,'候选文件校验标识无效');
      return {id:sid,effectId:effect(s.effectId),anchor:text(s.anchor || '',6000,'原句'),text:text(s.text || '',8000,'显示内容'),note:text(s.note || '',4000,'备注'),startSec,endSec,candidatePath,candidateSec,reviewed:s.reviewed === true,candidateFingerprint,reviewWarning:text(s.reviewWarning || '',300,'复核提示')};
    });
    return {id:key,title:text(ep.title,120,'本期标题'),transcriptText:text(ep.transcriptText || '',500000,'文稿或字幕'),createdAt:text(ep.createdAt || new Date().toISOString(),60,'创建时间'),updatedAt:text(ep.updatedAt || new Date().toISOString(),60,'更新时间'),selections};
  });
  if (input.activeEpisodeId != null && !seen.has(input.activeEpisodeId)) throw err(400, '当前期号不存在');
  return {schemaVersion:1,revision:0,favorites:[...new Set(input.favorites.map(effect))],activeEpisodeId:input.activeEpisodeId ?? null,episodes};
}

export function exportEpisode(ep, catalog) {
  const map = new Map(catalog.effects.map(x => [x.id,x]));
  return {schema:'koubo-motion-selection/v1',exportedAt:new Date().toISOString(),catalogVersion:catalog.version,catalogSha256:createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),episode:{id:ep.id,title:ep.title,transcriptSha256:createHash('sha256').update(ep.transcriptText).digest('hex')},status:'用户选择清单',productionBaseline:'V9',authority:'仅本期选择，不改变全局质量标准',instructions:['保留所选动效的识别性动作；素材或适配缺失时报告，不擅自替换为普通字卡。','拍前仅用原句锚点；实录后核对原话与时间，不能把估计时间当已绑定。','官方示例仅供选型；候选视频与人工观看确认单独记录。','按现行口播生产流程执行；本清单不冒充渲染、正式发布或验收回执。'],selections:ep.selections.map(s => {const e=map.get(s.effectId);return {...s,effectName:e.name,signature:e.signature,requirements:e.requirements,reference:e.officialUrl,status:s.reviewed?'用户记录已观看确认':s.candidatePath?'候选待核对':s.startSec !== null?'待适配':'待实录绑定'};})};
}

function markdown(bundle) {
  const lines=[`# ${bundle.episode.title}｜本期动效选择`,'',`导出时间：${bundle.exportedAt}`,`目录版本：${bundle.catalogVersion}`,'','本文件为本期选择与交接，不代表已完成制作或验收。','',...bundle.instructions.map(x=>`- ${x}`),''];
  bundle.selections.forEach((s,i)=>lines.push(`## ${i+1}. ${s.effectName}`,'',`- 效果编号：${s.effectId}`,`- 状态：${s.status}`,`- 原句：${s.anchor || '待填写'}`,`- 实录区间：${s.startSec === null?'待绑定':`${s.startSec}—${s.endSec}秒`}`,`- 保留动作：${s.signature}`,`- 显示内容：${s.text || '待填写'}`,`- 备注：${s.note || '无'}`,`- 素材要求：${(s.requirements || []).join('；')}`,`- 官方示例：${s.reference}`,`- 实际候选：${s.candidatePath || '未提供'}${s.candidateSec === null?'':`，${s.candidateSec}秒`}`,'',''));
  return lines.join('\n');
}

export function createStateReader({statePath,catalog,projectRoot=repo}) {
  const load=async()=>{try {const raw=JSON.parse(await fs.readFile(statePath,'utf8')); const checked=validateState(raw,catalog); if(!Number.isSafeInteger(raw.revision)||raw.revision<0)throw new Error('版本损坏');
    for(const ep of checked.episodes)for(const s of ep.selections)if(s.reviewed){
      try{const hash=await fingerprint(s.candidatePath);if(hash!==s.candidateFingerprint){s.reviewed=false;s.reviewWarning='候选视频内容已变化，请重新观看确认';s.candidateFingerprint=hash;}}
      catch{s.reviewed=false;s.reviewWarning='候选视频缺失或不可读，请重新绑定后观看确认';}
    }
    return {...checked,revision:raw.revision};} catch(e){if(e.code==='ENOENT')return emptyState();throw err(500,'保存记录无法读取，已停止写入。请从备份恢复，原文件未覆盖。');}};
  async function resolveMedia(relative) {
    relativeMedia(relative);
    if(!relative)throw err(400,'缺少视频路径');
    let resolved;
    try {resolved=await fs.realpath(path.resolve(projectRoot,relative));}catch{throw err(404,'未找到本期视频，请检查路径');}
    const root=await fs.realpath(projectRoot);
    if(!inside(path.join(root,'edit'),resolved)&&!inside(path.join(root,'outputs'),resolved))throw err(403,'只允许读取本项目素材范围内的视频');
    const stat=await fs.stat(resolved);
    if(!stat.isFile())throw err(400,'路径不是视频文件');
    return {resolved,stat};
  }
  const hashCache=new Map();
  async function fingerprint(relative){
    const {resolved,stat}=await resolveMedia(relative);
    const key=`${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
    const cached=hashCache.get(resolved);if(cached?.key===key)return cached.hash;
    const digest=createHash('sha256');for await(const chunk of createReadStream(resolved))digest.update(chunk);
    const hash=digest.digest('hex');hashCache.set(resolved,{key,hash});return hash;
  }
  return {load,resolveMedia,fingerprint};
}

export async function createWorkbench({dataDir=path.join(here,'.local'),catalogPath=path.join(dataDir,'catalog.json'),projectRoot=repo,staticDir=path.join(here,'dist')}={}) {
  const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
  if (!Array.isArray(catalog.effects) || catalog.effects.length !== 122 || new Set(catalog.effects.map(x=>x.id)).size !== 122) throw new Error('目录须完整包含122个唯一效果');
  await fs.mkdir(dataDir,{recursive:true});
  const statePath=path.join(dataDir,'state.json');
  const {load,resolveMedia,fingerprint}=createStateReader({statePath,catalog,projectRoot});
  let queue=Promise.resolve();
  function send(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(typeof value==='string'?value:JSON.stringify(value));}
  async function body(req){let length=0,chunks=[];for await(const chunk of req){length+=chunk.length;if(length>maxStateBytes+1024)throw err(413,'方案总量超过32MB，请先备份并精简文稿；原记录不会覆盖');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw err(400,'请求不是有效JSON');}}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https://skillry.dev https://*.skillry.dev; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    try{
      if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))throw err(403,'仅允许本机访问');
      const url=new URL(req.url,`http://${req.headers.host}`);
      if(req.method==='PUT'){
        if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`)throw err(403,'拒绝跨站修改');
        if(!String(req.headers['content-type']||'').startsWith('application/json'))throw err(415,'请使用JSON保存');
      }
      if(req.method==='GET'&&url.pathname==='/api/catalog')return send(res,200,catalog);
      if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{service:'koubo-motion-workbench',version:'1.0.0',effects:catalog.effects.length});
      if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,await load());
      if(req.method==='PUT'&&url.pathname==='/api/state'){
        const data=await body(req);
        const operation=queue.then(async()=>{
          const current=await load();
          if(data.expectedRevision!==current.revision)throw err(409,'另一页面已更新记录。请备份当前草稿，再重新读取，不能覆盖他人的修改。');
          const state=validateState(data.state,catalog);
          for(const ep of state.episodes){
            const previous=current.episodes.find(x=>x.id===ep.id);
            for(const s of ep.selections){
              const old=previous?.selections.find(x=>x.id===s.id);
              if(old?.reviewed && (previous.transcriptText!==ep.transcriptText || ['effectId','anchor','text','startSec','endSec','candidatePath','candidateSec'].some(key=>old[key]!==s[key])))s.reviewed=false;
            }
          }
          for(const ep of state.episodes)for(const s of ep.selections)if(s.reviewed){
            const old=current.episodes.find(x=>x.id===ep.id)?.selections.find(x=>x.id===s.id);
            const hash=await fingerprint(s.candidatePath);
            if((s.candidateFingerprint || old?.candidateFingerprint) && s.candidateFingerprint!==hash){s.reviewed=false;s.reviewWarning='候选视频内容已变化，请重新观看确认';}
            else s.reviewWarning='';
            s.candidateFingerprint=hash;
          }
          state.revision=current.revision+1;
          if(current.revision>0){const backups=path.join(dataDir,'backups');await fs.mkdir(backups,{recursive:true});await fs.copyFile(statePath,path.join(backups,`state-${current.revision}-${randomUUID()}.json`));}
          const tmp=statePath+`.${randomUUID()}.tmp`;
          await fs.writeFile(tmp,JSON.stringify(state,null,2)+'\n',{mode:0o600});
          await fs.rename(tmp,statePath);
          return state;
        });
        queue=operation.catch(()=>{});
        return send(res,200,await operation);
      }
      if(req.method==='GET'&&url.pathname==='/api/export'){
        const state=await load(),ep=state.episodes.find(x=>x.id===url.searchParams.get('episode'));
        if(!ep)throw err(404,'请先创建并保存本期选择');
        const format=url.searchParams.get('format')==='md'?'md':'json';
        const bundle=exportEpisode(ep,catalog);
        return send(res,200,format==='md'?markdown(bundle):JSON.stringify(bundle,null,2),{'Content-Type':format==='md'?'text/markdown; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="motion-selection-${ep.id}.${format}"`});
      }
      if(req.method==='GET'&&url.pathname==='/api/examples'){
        try{return send(res,200,JSON.parse(await fs.readFile(path.join(dataDir,'examples.json'),'utf8')));}catch(e){if(e.code==='ENOENT')return send(res,200,{examples:[]});throw e;}
      }
      if(['GET','HEAD'].includes(req.method)&&url.pathname==='/api/media'){
        const {resolved,stat}=await resolveMedia(url.searchParams.get('path'));
        const range=req.headers.range;
        let start=0,end=stat.size-1,status=200;
        if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))throw err(416,'视频读取范围无效');if(m[1]){start=Number(m[1]);end=m[2]?Number(m[2]):end;}else{start=Math.max(0,stat.size-Number(m[2]));}if(start>=stat.size||start>end){res.setHeader('Content-Range',`bytes */${stat.size}`);throw err(416,'视频读取范围超出文件');}end=Math.min(end,stat.size-1);status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`);}
        res.writeHead(status,{'Content-Type':mime[path.extname(resolved).toLowerCase()],'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'private, max-age=60'});
        if(req.method==='HEAD')return res.end();
        createReadStream(resolved,{start,end}).on('error',()=>res.destroy()).pipe(res);return;
      }
      if(req.method==='GET'&&!url.pathname.startsWith('/api/')){
        const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
        if(!['index.html','app.js','styles.css'].includes(name))throw err(404,'页面不存在');
        const bytes=await fs.readFile(path.join(staticDir,name));
        res.writeHead(200,{'Content-Type':mime[path.extname(name)],'Cache-Control':'no-cache'});return res.end(bytes);
      }
      throw err(404,'接口不存在');
    }catch(e){if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'本机服务发生错误，未覆盖原记录'});else res.destroy();}
  });
  return server;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.KOUBO_MOTION_PORT||5188);
  const server=await createWorkbench();
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口${port}已被占用，未切换端口或终止其他进程`:e.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`口播动效工作台 http://127.0.0.1:${port}`));
}
