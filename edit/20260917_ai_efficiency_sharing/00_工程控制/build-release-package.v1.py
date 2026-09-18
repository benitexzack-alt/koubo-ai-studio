from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,subprocess,shutil,importlib.util,sys

ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'edit/20260917_ai_efficiency_sharing'
PACKAGE=BASE/'09_发布包'
QA=BASE/'07_预览与质检/formal-v1'
CONTROL=BASE/'00_工程控制'
FINAL=BASE/'08_正式成片/员工AI增效分配_V8_1080P_正式候选_v1.mp4'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def ref(p):return {'path':str(p.relative_to(ROOT)),'sha256':sha(p),'bytes':p.stat().st_size}
def read(p):return json.loads(p.read_text())
def write(p,obj):p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')

frame=PACKAGE/'本期成片真人截图.png'
shutil.copy2(QA/'frames/02100.png',frame)
write(PACKAGE/'真人截图来源.v1.json',{'sourceVideo':ref(FINAL),'sourceTimeSeconds':70,'frameIndex':2100,
  'output':ref(frame),'personSource':'本期本人真实口播画面','generatedPerson':False,
  'selectionReason':'正面清晰、双眼自然睁开、口型闭合、手势完整；已实际打开全分辨率图片复核。'})
write(QA/'视觉抽查.v1.json',{'status':'reviewed-sampled-frames','sourceVideo':ref(FINAL),
  'method':'实际打开5张联系表共35帧及70秒全分辨率本人帧；核对六段插片与五处关键词。',
  'checks':{'noObservedFaceOcclusion':True,'noObservedPaperLabelCaptionOverlap':True,
    'generatedContentLabelsVisible':True,'P04ConnectionCompleteAt131_6':True,'internalRouteLabelsNotObserved':True},
  'limitations':'抽帧不能替代全片正常速度观看；短暂运动瑕疵与最终听感仍由用户观看确认。',
  'fullWatchConfirmed':False})
prompt=PACKAGE/'4比3封面提示词.md';copy=PACKAGE/'标题与发布文案.md';facts=PACKAGE/'发布文字事实锁.md'
skills={'humanizer_zh':Path('/Users/pc/.codex/skills/humanizer-zh/SKILL.md'),
  'humanize_koubo_script':ROOT/'skills/humanize-koubo-script/SKILL.md'}
report={'schema_version':1,'task_id':'task-20260918T020544Z-31f85b17','status':'passed',
  'scope':'仅本期发布文字与封面提示词，不代表原片事实核验或内容生产门全量通过',
  'reviewed_at':datetime.now(timezone.utc).isoformat(),'draft':{**ref(prompt),'path':str(prompt)},'additionalDrafts':[ref(copy),ref(facts)],
  'skills':{k:{'path':str(v),'sha256':sha(v),'read':True} for k,v in skills.items()},
  'checks':{'humanizer_pattern_scan_completed':True,'ai_boundary_review_completed':True,
    'fact_safe_rewrite_completed':True,'retention_risk_review_completed':True,'read_aloud_completed':True,'voice_match_completed':True},
  'readingMethod':'逐句按口语停顿作文字朗读检查，详见事实锁；未声称用户真人朗读或音频听审。',
  'ai_boundary_review':{'self_explanation_removed':True,'defensive_boundary_embedded':True,
    'generic_transitions_replaced':True,'abstract_claims_grounded':True,'source_insertions_contextualized':True,
    'mechanical_completeness_reduced':True,
    'notes':'公开文案直接进入继续加项目与团队回报的选择，用工时、分配和流程承接原话；无自我说明、泛化来源标签、夸大结果或机械三段式。事实待核留在交付记录，不混入标题。'},
  'retention_review':{'risk_node_count':0,'nodes':[],
    'no_high_risk_reason':'短包装主问题清楚，建议与本期实录对应，无新增案例与效率数字；没有需要强改的高风险句。此为预测判断，不是平台留存数据。'},
  'fact_changes':{'new_facts':[],'removed_facts':[],
    'wording_strength_changes':['包装只提炼分配问题与建议，不重复原片未经核验的全称和倍数；原片字幕未修改。'],
    'pending_user_confirmations':['完整正式候选待用户观看；原片16项事实要求及Z6指代未核实。']},
  'scores':{'directness':9,'spoken_naturalness':9,'rhythm':8,'personal_voice':8,'fact_fidelity':10}}
review_path=PACKAGE/'发布文字双Skill审稿.v1.json';write(review_path,report)
spec=importlib.util.spec_from_file_location('content_gate',ROOT/'skills/content-brain-gate/scripts/validate_content_gate.py')
module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
validator=module.GateValidator({'task_id':report['task_id']},review_path)
draft={'copy_review':{'required':True,'report_path':str(review_path)}}
validator.validate_copy_review(prompt,draft)
validator.scan_frozen_phrases(copy.read_text(),{})
validator.scan_project_style_gate(copy.read_text(),copy,{})
write(PACKAGE/'发布文字机器校验.v1.json',{'scope':'发布包装双Skill哈希和语言扫描，不运行新选题或原片全量内容门',
  'status':'passed' if not validator.errors else 'blocked','errors':validator.errors,'warnings':validator.warnings,'passed':validator.passed})
assert not validator.errors,validator.errors
job_path=BASE/'06_剪辑工程/production-formal.with-sfx.v1.json';job=read(job_path)
render=next((BASE/'08_正式成片').glob('.*.production-receipt.*.json'))
approval=CONTROL/'正式成片批准.v1.json'
release={'schemaVersion':1,'releaseId':'20260918-ai-efficiency-sharing-v8-r1','videoId':job['videoId'],
  'status':'ready-for-user-review','productionProfile':job['productionProfile'],
  'inputs':{k:job['inputs'][k] for k in ['transcript','bilingualCaptions','spokenSourcePolicy']},
  'production':{'formalOutput':str(FINAL.relative_to(ROOT)),'previewOutput':job['preview']['output'],
    'directorVersion':'9.1.0','productionVersion':'V8','durationInFrames':4669,'fps':30,'visualDesignChanged':False},
  'productionGate':{'schema':'release-production-gate/v2','job':ref(job_path),'formalOutput':ref(FINAL),
    'controlledRenderReceipt':ref(render),'renderPreflight':ref(BASE/'07_预览与质检/正式渲染前置回执.v1.json'),
    'audioMaster':ref(QA/'音频母版回执.v1.json'),'technicalQa':ref(QA/'技术质检.v1.json'),
    'riskFrames':ref(QA/'风险帧回执.v1.json'),'visualReview':ref(QA/'视觉抽查.v1.json'),
    'screenshotReceipt':ref(PACKAGE/'真人截图来源.v1.json'),'copyReview':ref(review_path),'userApproval':ref(approval)},
  'deliveryPackage':{'status':'ready-for-delivery','cover':{'aspectRatio':'4:3','dimensions':'1440×1080',
    'recommendedFrame':str(frame.relative_to(ROOT)),'sourceTimeSeconds':70,'prompt':str(prompt.relative_to(ROOT)),
    'template':'templates/10-超哥AI创业记_3比4系列封面提示词母版.md',
    'aspectRatioAuthority':ref(approval)},
    'titles':{'primary':'AI省下的时间，该怎么分？','alternatives':['用AI干得更快，为什么还要藏着？','企业推AI，先把增效分配说清楚']},
    'douyin':{'publishCopy':'用AI把活干快了，接下来是继续加项目，还是让团队也得到回报？\n\n我建议企业把省下的工时怎么用、增效收益怎么分先说清楚，再把个人的用法沉淀成团队流程。',
      'topics':['企业AI落地','AI办公','团队管理','工作效率','超哥AI创业记'],
      'disclosure':'片中部分情景与纸艺画面由AI生成，用于辅助说明。'},'copyReview':str(review_path.relative_to(ROOT))},
  'userReview':{'previewApproved':True,'fullWatchConfirmed':False,'formalVersionApproved':False},
  'publish':{'status':'not-published','authorized':False,'externalUploadPerformed':False,'advertisingPerformed':False},
  'contentReview':{'status':'pending-fact-review','unresolvedDirectorFactChecks':16,'unresolvedTerm':'Z6',
    'note':'用户授权按确认版本输出；技术和包装校验不等于事实要求已通过，也不授权发布。'},
  'assetManifest':[ref(p) for p in [FINAL,frame,prompt,copy,facts,review_path,PACKAGE/'发布文字机器校验.v1.json',
    PACKAGE/'真人截图来源.v1.json',QA/'技术质检.v1.json',QA/'音频母版回执.v1.json',QA/'视觉抽查.v1.json']]}
write(PACKAGE/'发布记录.v1.json',release)
print(json.dumps({'status':'package-built','release':str(PACKAGE/'发布记录.v1.json'),'copyChecksPassed':True},ensure_ascii=False))
