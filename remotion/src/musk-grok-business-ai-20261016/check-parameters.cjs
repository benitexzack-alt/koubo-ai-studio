// 只检查本期参数；不启动浏览器、不读取媒体、不调用渲染。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const ts = require('typescript');

const runtimeModule = path.join(__dirname, 'runtime.ts');
const runtimePath = path.resolve(__dirname, '../../../edit/20261016_musk_grok_business_ai/04_后期准备/runtime-plan.v1.json');
const code = ts.transpileModule(fs.readFileSync(runtimeModule, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true},
}).outputText;
const loaded = {exports: {}};
new Function('require', 'module', 'exports', code)(createRequire(runtimeModule), loaded, loaded.exports);
const raw = fs.readFileSync(runtimePath);
const plan = JSON.parse(raw);

try {
  const snapshot = fs.readFileSync(path.join(__dirname, 'runtime-plan.snapshot.json'));
  const profile = fs.readFileSync(path.resolve(__dirname, '../../../workflow/active-production-profile.v1.json'));
  const profileSnapshot = fs.readFileSync(path.join(__dirname, 'production-profile.snapshot.json'));
  if (!raw.equals(snapshot) || !profile.equals(profileSnapshot)) throw new Error('本期运行数据或活动V9档案与Remotion内快照不一致');
  loaded.exports.validateRuntimePlan(plan, 'preview');
  let formalParameters = '通过，仅代表参数，不代表生产授权';
  try { loaded.exports.validateRuntimePlan(plan, 'formal'); }
  catch (error) { formalParameters = error.message; }
  console.log(JSON.stringify({
    result: '本期准备参数通过',
    runtimeSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    frames: plan.durationInFrames,
    captions: plan.captions.length,
    emptyEnglish: plan.captions.filter((caption) => !caption.english.trim()).length,
    events: plan.events.length,
    addedSfx: plan.sfx.length,
    pendingMedia: plan.mediaSlots.filter((slot) => slot.state === 'pending').map((slot) => slot.id),
    typePixels: loaded.exports.TYPE,
    formalParameters,
    renderExecuted: false,
    mediaAcceptancePerformed: false,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({result: '本期准备参数未通过', message: error.message, renderExecuted: false}, null, 2));
  process.exitCode = 1;
}
