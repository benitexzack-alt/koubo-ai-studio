import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const context = path.dirname(fileURLToPath(import.meta.url));
const control = path.dirname(context);
const episode = path.resolve(control, '../..');
const project = path.resolve(episode, '../..');
const kb = '/Users/pc/Documents/个人知识库';
const roots = {context, control, episode, project, kb};
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write = (name, data) => fs.writeFileSync(path.join(context, name), JSON.stringify(data, null, 2) + '\n');
const resolve = (item) => path.resolve(roots[item.root], item.path);
const observations = readJson(path.join(context, 'read-observations.v1.json'));
const bootstrap = readJson(path.join(context, 'bootstrap.v1.json'));
const now = new Date().toISOString();
const previousFile = path.join(context, 'read-receipts.v1.json');
const previous = fs.existsSync(previousFile) ? readJson(previousFile).receipts : [];
const previousByPath = new Map(previous.map((item) => [item.path, item]));
const changed = [];
const receipts = observations.observations.flatMap((item) => {
  const p = resolve(item);
  const hash = sha(p);
  const prior = previousByPath.get(p);
  // Changed inputs need a new actual reading, never an automatic new read claim.
  if (prior && prior.sha256 !== hash) {
    changed.push({path:p, oldSha256:prior.sha256, currentSha256:hash, status:'reread-required'});
    return [];
  }
  return [{path:p, sha256:hash, read_status:'read', read_completed_at:prior?.read_completed_at ?? now,
    read_evidence:'本轮工具输出经本worker实际读取；范围见read_scope，哈希绑定完整文件身份而不冒充全文听验。',
    read_scope:item.read_scope ?? '全文读取',
    retrieval_source:'explicit-local-file-read', retrieved:true, read:true, applied:true,
    application_status:'applied', application_note:item.application_note}];
});
const bootstrapExpanded = {
  current_project_index:[path.join(project, 'knowledge/00-项目知识索引.md')],
  current_project_summary:[path.join(project, 'project.md'), path.join(project, 'README.md'), path.join(episode, 'README_先看这里.md')],
  latest_update:[path.join(project, 'knowledge/08-决策与复盘日志.md'), path.join(control, 'permission.v1.json')],
  applicable_rules_or_skills:[],
  historical_failures:[path.join(kb, '07_知识库治理/2026-07-18_口播内容大脑事故根因与修复验收.md'), path.join(episode, '07_预览与质检/paper-intake-r1/入场核验报告.md')],
  task_original_materials:[path.join(control, 'permission.v1.json'), path.join(control, 'request.v1.json')]
};
const mustRead = bootstrap.must_read.map((p) => path.isAbsolute(p) ? p : path.join(kb,p));
const alreadyRequired = new Set(Object.values(bootstrapExpanded).flat());
bootstrapExpanded.applicable_rules_or_skills = [...new Set([...mustRead.filter((p) => !alreadyRequired.has(p)),
  ...receipts.map((r) => r.path).filter((p) => !alreadyRequired.has(p))])];
const required = {
  current_project_index:[path.join(project,'knowledge/00-项目知识索引.md')],
  current_project_summary:[path.join(project,'README.md'),path.join(episode,'README_先看这里.md')],
  latest_update:[path.join(control,'permission.v1.json')],
  applicable_rules_or_skills:observations.observations.filter((r)=>r.group!=='task_original_materials' && r.root!=='control').map(resolve).filter((p)=>!p.endsWith('README.md')&&!p.endsWith('README_先看这里.md')&&!p.endsWith('00-项目知识索引.md')&&!p.endsWith('入场核验报告.md')&&!p.endsWith('2026-07-18_口播内容大脑事故根因与修复验收.md')),
  historical_failures:bootstrapExpanded.historical_failures,
  task_original_materials:[path.join(control,'permission.v1.json'),...observations.observations.filter((r)=>r.group==='task_original_materials').map(resolve)]
};
const byPath = new Map(receipts.map((r) => [r.path,r]));
const allPaths = [...new Set(Object.values(required).flat())];
const coverage = allPaths.map((p) => ({path:p, exists:fs.existsSync(p), sha256:fs.existsSync(p)?sha(p):null,
  retrieved:byPath.has(p), read:byPath.has(p), applied:byPath.has(p),
  status:byPath.has(p)?'read-and-applied':fs.existsSync(p)?'read-pending':'file-pending'}));
const partialReads = observations.partialReads.map((item) => ({...item,path:resolve(item),sha256:sha(resolve(item)),read_status:'partial',application_status:'not-a-full-read-receipt'}));
write('read-receipts.v1.json', {schemaVersion:'candidate-context-read-receipts/v1',taskId:observations.taskId,generatedAt:now,receipts});
write('requirements.v1.json', {schemaVersion:'candidate-context-requirements/v1',taskId:observations.taskId,required_receipt_groups:required});
write('requirements.bootstrap-expanded.v1.json', {schemaVersion:'candidate-bootstrap-reading-backlog/v1',taskId:observations.taskId,required_receipt_groups:bootstrapExpanded,
  status:'not-claimed-complete',note:'保留bootstrap扩展阅读清单，不将未读长历史/投放规则假称已读。本阶段仅建立候选依赖技术上下文，不是全项目/正式生产上下文。'});
write('scope-decision.v1.json',{schemaVersion:'candidate-context-scope/v1',generatedAt:now,
  phase:'existing-candidate-inputs-before-request',important:true,
  scope:'按最新父任务接口建立可供prepare-request消费的候选知识技术绑定，入口及静态导入JSON当前哈希必须实际读取应用；未写出的request不能作为此阶段的存在性前提。',
  formalEnabled:false,productionEligible:false,codeReviewAllowed:false,
  requestBinding:'request及runner完整代码集合到齐后独立复核，由下一阶段回执绑定；本阶段无request通过声明。',
  deferredBootstrapReading:mustRead.filter((p)=>!byPath.has(p)).map((p)=>({path:p,status:'not-claimed-read',use:'本轮不据此文件作结论或正式授权'})),
  dataReadingBoundary:'data JSON完整解析并绑定整文件SHA；人工研判以已明确列出的实际消费字段为限，逐词嵌套ASR证据不冒充已听验。'});
write('reading-coverage.v1.json', {schemaVersion:'candidate-context-reading-coverage/v1',generatedAt:now,status:'incomplete-until-all-required-read-and-bound',coverage,partialReads,changedInputs:changed,
  noClaim:'未把bootstrap摘要或散列计算当作全文已读；未完成项不会进入有效read回执。'});
const preflightPath=path.join(context,'account-feedback/preflights/'+observations.taskId+'.json');
const preflight=readJson(preflightPath);
write('account-history-application.v1.json', {schemaVersion:'candidate-context-account-history-application/v1',generatedAt:now,
  source:{path:preflightPath,sha256:sha(preflightPath),readScope:'所列字段实际读取，非全文历史逐轮复核'},
  status:preflight.status,requiresCurrentAccountData:false,accountContext:preflight.accountContext,
  accountBaseline:preflight.automaticReference.accountBaseline,
  selectedRecentWork:preflight.automaticReference.recentSix[0],
  lessons:['lesson:duration:value-order-before-shortening','lesson:metrics:separate-early-and-mature-windows'],
  application:'全账户及最近一条指标仅作历史参照；本条按用户决定保留完整原声和实录，不据历史完播率擅自删除或缩短。小样关注开头新闻衔接与语义对位，不宣称此设计已提高留存。',
  causalClaim:false,currentAccountClaim:false,publishReviewWindows:['early','24h','72h','7d'],
  note:'这些观察窗口仅记录知识边界；本轮不发布、不采集后台、不启动监控。'});
write('handoff.v1.json', {schemaVersion:'candidate-context-worker-handoff/v1',generatedAt:now,episodeId:observations.episodeId,
  candidateTaskId:observations.taskId,directorTaskId:observations.directorTaskId,important:true,
  contextPath:path.join(kb,'.opc-rag/tasks',observations.taskId,'context.json'),
  contextExists:fs.existsSync(path.join(kb,'.opc-rag/tasks',observations.taskId,'context.json')),
  formalEnabled:false,productionEligible:false,publishAuthorized:false,codeReview:{status:'awaiting-complete-code-closure',allow:false},
  pending:coverage.filter((r)=>!r.read).map((r)=>({path:r.path,status:r.status})),
  bindingInterface:{requiredGroup:'task_original_materials',paths:required.task_original_materials,
    receiptShape:{path:'绝对路径',sha256:'当前完整SHA-256',read_status:'read',read_completed_at:'实际读完时间ISO8601',application_status:'applied',application_note:'真实阅读后记录对本候选的具体应用'},
    afterRequestReady:'先全文读取最终request及所引用代码集合；由下一阶段独立审查回执绑定，不自动给新文件补read；若改变已绑定输入须重新start和validate-context并更新context-binding。',
    separation:'knowledge gate.formal_execution_allowed 即使为true也只表示知识上下文就绪，绝不变更本条formalEnabled=false。'},
  formerMissingBootstrapId:'task-20260907T085728Z-8e2f3b1b',
  formerBootstrapClaim:'此前只打印且未落盘的ID不视为已存在上下文。'});
console.log(JSON.stringify({status:'staging-written',receipts:receipts.length,pending:coverage.filter((r)=>!r.read).length,changed},null,2));
