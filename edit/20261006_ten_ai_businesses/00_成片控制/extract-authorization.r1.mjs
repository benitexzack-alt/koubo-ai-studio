import fs from 'node:fs';
import readline from 'node:readline';
import {createHash} from 'node:crypto';
const control='edit/20261006_ten_ai_businesses/00_成片控制';
const log='/Users/pc/.codex/sessions/2026/09/11/rollout-2026-09-11T19-21-27-01a09033-794b-7dc2-a53d-19afbccec54e.jsonl';
const id='msg_01a114f1-5612-76e3-983f-f0ec86671129';
const lines=readline.createInterface({input:fs.createReadStream(log),crlfDelay:Infinity});
let found=null;
for await(const line of lines){
  if(!line.includes(`"id":"${id}"`)||!line.includes('"type":"response_item"')) continue;
  const event=JSON.parse(line);
  if(event.type==='response_item'&&event.payload?.id===id&&event.payload.role==='user'){found=line;lines.close();break;}
}
if(!found)throw new Error('没有找到本轮真实用户授权消息');
const evidence=`${control}/真实预览授权.r1.user.jsonl`;
fs.writeFileSync(evidence,found+'\n',{flag:'wx'});
const event=JSON.parse(found);
const userQuote=event.payload.content.filter(x=>['input_text','text'].includes(x.type)).map(x=>x.text).join('\n').trim();
const sha256=createHash('sha256').update(fs.readFileSync(evidence)).digest('hex');
fs.writeFileSync(`${control}/真实预览授权.r1.json`,JSON.stringify({schema:'ten-ai-businesses-render-authorization/v1',episodeId:'20261006_ten_ai_businesses',revisionId:'ten-ai-businesses-v8-final-r1',phase:'preview',userQuote,evidence:{path:evidence,sha256},originalEvent:{sessionPath:log,messageId:id,timestamp:event.timestamp},independentSignature:false,previewAuthorized:true,previewAccepted:false,formalEnabled:false,fullWatchConfirmed:false,publishAuthorized:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'actual-user-request-bound',messageId:id,evidence,sha256,previewAccepted:false,formalEnabled:false,publishAuthorized:false}));
