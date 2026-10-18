import fs from 'node:fs';
import path from 'node:path';

const PLAN_KEYS = ['episode', 'canvas', 'shots'];
const SHOT_KEYS = ['shotId', 'insertAt', 'duration', 'style', 'theme', 'title', 'spokenLine', 'nodes', 'flow', 'ending', 'avoid'];
const NODE_KEYS = ['label', 'object', 'enterSec'];
const TIME_PATTERN = /^(\d{2}):([0-5]\d):([0-5]\d)\.(\d{3})$/u;
const PIXEL_THEMES = new Set(['noir', 'blocks', 'mono']);
const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const STRUCTURE_NOTE = '只验证 JSON 结构、数值和镜头排布；物件动作、中文语义、实录逐词对齐及真人小窗和字幕避让仍须导演对照真实音频或 SRT 核对。';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function safePathComponent(value) {
  return hasText(value)
    && value === value.trim()
    && value !== '.' && value !== '..'
    && !/[\/\\\u0000-\u001f\u007f<>:"|?*]/u.test(value)
    && !/[. ]$/u.test(value)
    && !DEVICE_NAME.test(value);
}

function timeMilliseconds(value) {
  if (typeof value !== 'string') return null;
  const parts = TIME_PATTERN.exec(value);
  if (!parts) return null;
  return ((Number(parts[1]) * 60 + Number(parts[2])) * 60 + Number(parts[3])) * 1000 + Number(parts[4]);
}

export function validateInsertShotsPlan(plan) {
  const errors = [];
  const fail = (at, message) => errors.push({path: at, message});
  const record = (value, at, keys) => {
    if (!isRecord(value)) {
      fail(at, '必须是对象');
      return false;
    }
    for (const key of keys) {
      if (!Object.hasOwn(value, key)) fail(`${at}.${key}`, '缺少必填字段');
    }
    for (const key of Object.keys(value)) {
      if (!keys.includes(key)) fail(`${at}.${key}`, '不允许增加字段');
    }
    return true;
  };
  const text = (value, at) => {
    if (!hasText(value)) fail(at, '必须是非空字符串');
  };
  if (record(plan, '$', PLAN_KEYS)) {
    if (!safePathComponent(plan.episode)) fail('$.episode', '必须是安全的单个目录名，不能包含路径分隔符、控制字符或保留名称');
    if (record(plan.canvas, '$.canvas', ['width', 'height', 'fps'])) {
      for (const [key, expected] of Object.entries({width: 1920, height: 1080, fps: 30})) {
        if (plan.canvas[key] !== expected) fail(`$.canvas.${key}`, `必须等于 ${expected}`);
      }
    }
    if (!Array.isArray(plan.shots)) {
      fail('$.shots', '必须是数组；本期不需要插入镜头时使用空数组');
    } else {
      const seen = new Set();
      let previousStart = null;
      let latestEnd = null;
      plan.shots.forEach((shot, index) => {
        const at = `$.shots[${index}]`;
        if (!record(shot, at, SHOT_KEYS)) return;
        if (!safePathComponent(shot.shotId)) fail(`${at}.shotId`, '必须是安全的单个文件名主体，不能包含路径分隔符、控制字符或保留名称');
        if (typeof shot.shotId === 'string') {
          const portableId = shot.shotId.normalize('NFC').toLowerCase();
          if (seen.has(portableId)) fail(`${at}.shotId`, '镜号重复（含大小写或 Unicode 等价名称），会覆盖同名 MP4');
          seen.add(portableId);
        }
        const start = timeMilliseconds(shot.insertAt);
        if (start === null) fail(`${at}.insertAt`, '必须使用 HH:MM:SS.mmm，分和秒须为 00–59');
        const durationValid = typeof shot.duration === 'number' && Number.isFinite(shot.duration) && shot.duration > 0;
        if (!durationValid) fail(`${at}.duration`, '必须是大于零的有限秒数');
        else {
          const frames = shot.duration * 30;
          if (!Number.isSafeInteger(Math.round(frames)) || Math.round(frames) < 1 || Math.abs(frames - Math.round(frames)) > 1e-6) {
            fail(`${at}.duration`, '时长必须对应 30fps 下的正整数帧');
          }
        }
        if (start !== null) {
          if (previousStart !== null && start < previousStart) fail(`${at}.insertAt`, '镜头必须按插入时间先后排列');
          if (latestEnd !== null && start < latestEnd - 1e-6) fail(`${at}.insertAt`, '本镜头与前面的镜头时段重叠');
          previousStart = start;
          if (durationValid) latestEnd = Math.max(latestEnd ?? 0, start + shot.duration * 1000);
        }
        if (!['paper', 'pixel'].includes(shot.style)) fail(`${at}.style`, '只能填写 paper 或 pixel');
        text(shot.theme, `${at}.theme`);
        if (shot.style === 'pixel' && !PIXEL_THEMES.has(shot.theme)) fail(`${at}.theme`, 'pixel 主题只能填写 noir、blocks 或 mono');
        for (const key of ['title', 'spokenLine', 'flow', 'ending']) text(shot[key], `${at}.${key}`);
        if (!Array.isArray(shot.nodes) || shot.nodes.length < 3 || shot.nodes.length > 5) {
          fail(`${at}.nodes`, '必须包含 3–5 个节点，按画面从左到右排列');
        }
        if (Array.isArray(shot.nodes)) shot.nodes.forEach((node, nodeIndex) => {
          const nodeAt = `${at}.nodes[${nodeIndex}]`;
          if (!record(node, nodeAt, NODE_KEYS)) return;
          if (!hasText(node.label) || [...node.label].length > 6 || !/\p{Script=Han}/u.test(node.label)) {
            fail(`${nodeAt}.label`, '必须是含中文的非空标签，最多 6 个 Unicode 字符');
          }
          text(node.object, `${nodeAt}.object`);
          if (typeof node.enterSec !== 'number' || !Number.isFinite(node.enterSec) || node.enterSec < 0 || (durationValid && node.enterSec >= shot.duration)) {
            fail(`${nodeAt}.enterSec`, '必须是从零开始且小于本镜头时长的有限秒数');
          } else if (durationValid && Math.ceil(node.enterSec * 30 - 1e-6) >= Math.round(shot.duration * 30)) {
            fail(`${nodeAt}.enterSec`, '标签不得早于指定时点出现；向上取整到 30fps 帧后必须至少剩一帧可见');
          }
        });
        if (!Array.isArray(shot.avoid)) fail(`${at}.avoid`, '必须是字符串数组');
        else shot.avoid.forEach((value, avoidIndex) => text(value, `${at}.avoid[${avoidIndex}]`));
      });
    }
  }
  return {ok: errors.length === 0, validationScope: 'structure-only', note: STRUCTURE_NOTE, errors};
}

export function validateInsertShotsPlanFile({inputPath}) {
  const resolvedInput = path.resolve(inputPath);
  if (!fs.statSync(resolvedInput).isFile()) throw new Error('输入必须是 JSON 文件');
  const source = fs.readFileSync(resolvedInput);
  const plan = JSON.parse(new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(source));
  return {...validateInsertShotsPlan(plan), inputPath: resolvedInput, plan, source};
}

function ensureDirectoryWithoutSymlink(directory) {
  try {
    fs.mkdirSync(directory);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`输出目录不能是符号链接或普通文件：${directory}`);
}

export function exportInsertShotsPlan({inputPath, repoRoot}) {
  const validated = validateInsertShotsPlanFile({inputPath});
  if (!validated.ok) {
    const error = new Error('插入镜头方案结构校验未通过');
    error.validation = validated;
    throw error;
  }
  const root = fs.realpathSync(path.resolve(repoRoot));
  if (!fs.statSync(root).isDirectory()) throw new Error('仓库根目录必须是已存在的目录');
  let directory = root;
  for (const component of ['edit', 'generated-video', validated.plan.episode]) {
    directory = path.join(directory, component);
    ensureDirectoryWithoutSymlink(directory);
    if (fs.realpathSync(directory) !== directory) throw new Error(`输出目录解析发生变化：${directory}`);
  }
  const outputPath = path.join(directory, 'insert-shots.plan.json');
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0);
  let descriptor;
  try {
    descriptor = fs.openSync(outputPath, flags, 0o644);
    // 保留原始 JSON 字节、字段和时间码，不进行补写、改写或归一化。
    fs.writeFileSync(descriptor, validated.source);
  } catch (error) {
    if (['EEXIST', 'ELOOP'].includes(error.code)) throw new Error(`目标已存在或为符号链接，拒绝覆盖：${outputPath}`);
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  return {
    ok: true,
    validationScope: validated.validationScope,
    note: STRUCTURE_NOTE,
    outputPath,
    episode: validated.plan.episode,
    shotCount: validated.plan.shots.length,
  };
}

export function parseInsertShotsArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!['--input', '--repo-root'].includes(key)) throw new Error(`不支持的参数：${key}`);
    if (Object.hasOwn(args, key.slice(2))) throw new Error(`参数重复：${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`参数缺少值：${key}`);
    args[key.slice(2)] = value;
  }
  if (!args.input) throw new Error('必须指定 --input <方案JSON路径>');
  return args;
}
