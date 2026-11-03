import {spawn} from 'node:child_process';
import {promises as fs,openSync,closeSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.KOUBO_MOTION_PORT||5188),url=`http://127.0.0.1:${port}`;
async function isRunning(){try{const r=await fetch(url+'/api/health',{signal:AbortSignal.timeout(700)});return r.ok&&(await r.json()).service==='koubo-motion-workbench';}catch{return false;}}
if(!await isRunning()){
  await fs.access(path.join(root,'.local/catalog.json'));
  await fs.mkdir(path.join(root,'.local'),{recursive:true});
  const log=openSync(path.join(root,'.local/server.log'),'a');
  const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,detached:true,stdio:['ignore',log,log],env:{...process.env,KOUBO_MOTION_PORT:String(port)}});
  child.unref();closeSync(log);
  let ready=false;
  for(let i=0;i<30;i++){if(await isRunning()){ready=true;break;}await new Promise(r=>setTimeout(r,200));}
  if(!ready)throw new Error('工作台未启动，请查看 .local/server.log；未终止其他端口进程');
  await fs.writeFile(path.join(root,'.local/server-process.json'),JSON.stringify({pid:child.pid,port,startedAt:new Date().toISOString()},null,2));
}
console.log(`口播动效工作台：${url}`);
if(process.argv.includes('--open'))spawn('open',[url],{stdio:'ignore'}).unref();
