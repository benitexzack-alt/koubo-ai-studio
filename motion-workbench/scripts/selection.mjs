import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStateReader,exportEpisode} from '../server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function readSelection({dataDir=path.join(root,'.local'),projectRoot=path.dirname(root),episodeId}={}) {
  const catalog=JSON.parse(await fs.readFile(path.join(dataDir,'catalog.json'),'utf8'));
  const {load}=createStateReader({statePath:path.join(dataDir,'state.json'),catalog,projectRoot});
  const state=await load();
  if(episodeId===undefined)return {episodes:state.episodes.map(e=>({id:e.id,title:e.title,selections:e.selections.length})),instruction:'指定 --episode 本期编号，读取同一份已保存选择；先核对用户确认的期号，不默认采用最新一期。'};
  const ep=state.episodes.find(e=>e.id===episodeId);
  if(!ep)throw new Error('未找到该期，请先在工作台保存选择');
  return exportEpisode(ep,catalog);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const selected=args.indexOf('--episode');
  if(selected>=0&&!args[selected+1])throw new Error('请在 --episode 后填写本期编号');
  console.log(JSON.stringify(await readSelection({episodeId:selected<0?undefined:args[selected+1]}),null,2));
}
