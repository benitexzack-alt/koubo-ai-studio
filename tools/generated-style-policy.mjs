import {createHash} from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TOKEN_FINGERPRINTS = Object.freeze([
  'koubo-paper-construct-v1',
  'paper-construct-video',
  'xibei-suangge-v1',
  'xibei-suangge-v2',
  '西北算格',
]);

const RETIRED_PATH_SEGMENT = '/user-generated-paper/';
const MAX_RETIRED_STYLE_INSPECTED_FILES = 512;
const ACCIDENT_JOB_ID = '20260823-wechat-geo-aao-v80';
const ACCIDENT_RUN_ROOT =
  'work/production-runs/20260823-wechat-geo-aao-v80';
const ACCIDENT_CONTROLLED_RECEIPTS = Object.freeze([
  `${ACCIDENT_RUN_ROOT}/run-manifest.json`,
  `${ACCIDENT_RUN_ROOT}/stage-success/20260823-wechat-geo-aao-v80.formal-audio.json`,
  `${ACCIDENT_RUN_ROOT}/stage-success/20260823-wechat-geo-aao-v80.formal-qa.json`,
  `${ACCIDENT_RUN_ROOT}/stage-success/20260823-wechat-geo-aao-v80.formal-render.json`,
]);

const RETIRED_CONTENT_ENTRIES = Object.freeze([
  {
    sha256: '15988c073c4ba24f72f2595dc437e7c2585f10b1b116c37039c8df9c8f54ba11',
    label: 'paper-construct-v1-style-before-retirement',
    bytes: null,
  },
  {
    sha256: 'dd32cee295502ec6f03098a48523f0601dd9688749b17d2808a7e3096c972c78',
    label: 'paper-construct-v1-retired-style-card',
    bytes: 7868,
  },
  {
    sha256: 'b4b751ea8eb6c73f24087b48d24433c6d881edac46c12899de822d8ac9a6d690',
    label: 'paper-construct-v1-historical-director-contract',
    bytes: null,
  },
  {
    sha256: 'ddb5e242f25038dd8b58910fe58427c2e094e056947d9db7fd51d652c6d9e7cd',
    label: 'paper-construct-v1-failed-generated-plan',
    bytes: 42141,
  },
  {
    sha256: '35ef2826c15fb2a99a91df37dc08c9c44eb105f431add24dcda17519bd44c8a6',
    label: 'paper-construct-v1-failed-visual-plan',
    bytes: 31004,
  },
  {
    sha256: '3bc7c86137a832cb4bc25dc198befb686dd4f0ee3ca8457fc87ad9b743c2ad13',
    label: 'paper-construct-v1-failed-production-job-before-stop',
    bytes: null,
  },
  {
    sha256: 'e0bb0900417c0a5f87d112ded4e3be56af4cd0ad0a9842a2349e15c0ffc70435',
    label: 'paper-construct-v1-failed-G01',
    bytes: 3541928,
  },
  {
    sha256: '301660db178f59db7b9a635ae2beacb056288011d1e6e5a913f0129bfef2d79a',
    label: 'paper-construct-v1-failed-G02',
    bytes: 4072575,
  },
  {
    sha256: '0a391362db21b8a476830bdd5f6225d4c6d1fab1b082ac2c100b893bbc362deb',
    label: 'paper-construct-v1-failed-G03',
    bytes: 3682223,
  },
  {
    sha256: '98e397d8a1464d00f1d1493d454a57a237b070d8d5e0afca59d0812e91b1a92b',
    label: 'paper-construct-v1-failed-G04',
    bytes: 4369200,
  },
  {
    sha256: 'a243aa778d5b010086db34d276822bcc9d53f7a66919db589da59ef021c5d752',
    label: 'xibei-suangge-v1-complete-dynamic-original-not-approved',
    bytes: 3635728,
  },
  {
    sha256: '80d80620f98487ad09aa1a9e7d3f9379f8c153d00c7cea2e76f98ca245cc5ab8',
    label: 'xibei-suangge-v2-complete-dynamic-original-not-approved',
    bytes: 2863703,
  },
  {
    sha256: '6620826dfe5fa424c96f76b2d38274f2662e2fa8a58d2cb74debf66f67dfa993',
    label: 'xibei-suangge-v2-silent-derivative-not-approved',
    bytes: 2832391,
  },
  {
    sha256: '3ba5cef4e0c5ae26e2f70d27c8799cea5d736498d85dcbd00dba2050125e5488',
    label: 'wechat-geo-aao-v80-complete-rejected-output-do-not-publish',
    bytes: 620211553,
  },
  {
    sha256: '9422d8693466f4145c0b8fa2a74afbf7d0bc27cb8a8250bb9590716b126c4230',
    label: 'stale-passed-run-manifest',
    bytes: 15207,
  },
  {
    sha256: 'd21c8432715247ab104919ec56255b1eba060deaa8cf8164a1f34ad7aae46308',
    label: 'stale-passed-formal-audio-stage',
    bytes: 472,
  },
  {
    sha256: 'd92a935211593a1866d2bb0651c034e601ff73ddaf957c4abb1f91d799b62cf9',
    label: 'stale-passed-formal-qa-stage',
    bytes: 469,
  },
  {
    sha256: 'f40024252b2b4f4ca8650fa8affdf7f4f7fa86a6fc60d15c97509d6c29c04257',
    label: 'stale-passed-formal-render-stage',
    bytes: 480,
  },
]);

const RETIRED_CONTENT_BY_SHA = new Map(
  RETIRED_CONTENT_ENTRIES.map((entry) => [entry.sha256, entry]),
);
const RETIRED_CONTENT_SIZES = new Set(
  RETIRED_CONTENT_ENTRIES
    .map((entry) => entry.bytes)
    .filter((bytes) => Number.isInteger(bytes)),
);

export const RETIRED_GENERATED_STYLE_POLICY = Object.freeze({
  id: 'retired-generated-style/v1',
  tokenFingerprints: TOKEN_FINGERPRINTS,
  pathSegmentFingerprint: RETIRED_PATH_SEGMENT,
  contentSha256: Object.freeze(
    RETIRED_CONTENT_ENTRIES.map(({sha256, label, bytes}) => ({
      sha256,
      label,
      bytes,
    })),
  ),
  productionCommands: Object.freeze([
    'preview',
    'formal',
    'qa',
    'regression',
    'all',
    'risk-frames',
    'audio-preflight',
    'formal-audio',
    'prepare',
  ]),
  runningHubBlockedCommands: Object.freeze([
    'compile',
    'preflight',
    'quote',
    'run',
    'resume',
  ]),
});

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const tokenPatterns = new Map(
  TOKEN_FINGERPRINTS.map((fingerprint) => [
    fingerprint,
    new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(fingerprint)}($|[^a-z0-9])`,
      'iu',
    ),
  ]),
);

const normalizedPathText = (value) =>
  `/${value.replaceAll('\\', '/').replace(/\/+/gu, '/').replace(/^\/+|\/+$/gu, '')}/`
    .toLowerCase();

const stringFingerprintHits = (value, location) => {
  const hits = [];
  const normalized = value.toLowerCase();
  for (const [fingerprint, pattern] of tokenPatterns) {
    if (pattern.test(normalized)) {
      hits.push({fingerprint, location, value});
    }
  }
  if (normalizedPathText(value).includes(RETIRED_PATH_SEGMENT)) {
    hits.push({
      fingerprint: RETIRED_PATH_SEGMENT,
      location,
      value,
    });
  }
  return hits;
};

const uniqueHits = (hits) => [
  ...new Map(
    hits.map((hit) => [
      `${hit.fingerprint}\u0000${hit.location}\u0000${hit.sha256 ?? ''}`,
      hit,
    ]),
  ).values(),
];

const walkStrings = (value, location, callback, visited = new WeakSet()) => {
  if (typeof value === 'string') {
    callback(value, location);
    return;
  }
  if (value === null || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkStrings(item, `${location}[${index}]`, callback, visited));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    walkStrings(item, `${location}.${key}`, callback, visited);
  }
};

const isInside = (root, candidate) => {
  const relation = path.relative(root, candidate);
  return (
    relation === '' ||
    (relation !== '..' &&
      !relation.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relation))
  );
};

const approvedExternalPaths = () => new Set([
  path.resolve(os.homedir(), 'Downloads', '视频 (1).mp4'),
  path.resolve(os.homedir(), 'Downloads', '视频 (2).mp4'),
]);

const resolveInspectableFile = (value, projectRoot) => {
  if (typeof value !== 'string' || !value.trim() || /^https?:\/\//iu.test(value)) {
    return null;
  }
  const absolute = path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(projectRoot, value);
  if (!isInside(projectRoot, absolute) && !approvedExternalPaths().has(absolute)) {
    return null;
  }
  if (!existsSync(absolute)) return null;
  let stat;
  try {
    stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      const real = realpathSync(absolute);
      if (!isInside(projectRoot, real) && !approvedExternalPaths().has(real)) {
        return null;
      }
      stat = lstatSync(real);
      return stat.isFile() ? {absolute: real, stat} : null;
    }
  } catch {
    return null;
  }
  return stat.isFile() ? {absolute, stat} : null;
};

const shouldHash = ({absolute, stat, isDocument}) => {
  if (isDocument || RETIRED_CONTENT_SIZES.has(stat.size)) return true;
  return (
    stat.size <= 2 * 1024 * 1024 &&
    ['.json', '.md', '.txt'].includes(path.extname(absolute).toLowerCase())
  );
};

const isJsonDocument = (absolute, stat) =>
  stat.size <= 2 * 1024 * 1024 &&
  path.extname(absolute).toLowerCase() === '.json';

export const findRetiredGeneratedStyleContentHashes = (
  value,
  {
    projectRoot,
    location = '$',
    documentPaths = [],
    additionalStrings = [],
  } = {},
) => {
  if (typeof projectRoot !== 'string' || !projectRoot.trim()) return [];
  const canonicalProjectRoot = path.resolve(projectRoot);
  const candidates = [];
  const addCandidate = (candidate, candidateLocation, isDocument = false) => {
    if (typeof candidate !== 'string' || !candidate.trim()) return;
    candidates.push({candidate, location: candidateLocation, isDocument});
  };
  walkStrings(value, location, (candidate, candidateLocation) =>
    addCandidate(candidate, candidateLocation));
  additionalStrings.forEach((candidate, index) =>
    addCandidate(candidate, `${location}{additional:${index}}`));
  documentPaths.forEach((candidate, index) =>
    addCandidate(candidate, `${location}{document:${index}}`, true));

  const allStrings = [];
  walkStrings(value, location, (candidate) => allStrings.push(candidate));
  const accidentContext =
    value?.jobId === ACCIDENT_JOB_ID ||
    allStrings.some((candidate) =>
      normalizedPathText(candidate).includes(`/${ACCIDENT_RUN_ROOT}/`));
  if (accidentContext) {
    ACCIDENT_CONTROLLED_RECEIPTS.forEach((candidate, index) =>
      addCandidate(
        candidate,
        `${location}{accident-controlled-receipt:${index}}`,
        true,
      ));
  }

  const hits = [];
  const visitedFiles = new Set();
  let cursor = 0;
  while (
    cursor < candidates.length &&
    visitedFiles.size < MAX_RETIRED_STYLE_INSPECTED_FILES
  ) {
    const candidate = candidates[cursor++];
    const resolved = resolveInspectableFile(
      candidate.candidate,
      canonicalProjectRoot,
    );
    if (!resolved || visitedFiles.has(resolved.absolute)) continue;
    visitedFiles.add(resolved.absolute);
    let buffer = null;
    if (shouldHash({...resolved, isDocument: candidate.isDocument})) {
      try {
        buffer = readFileSync(resolved.absolute);
      } catch {
        continue;
      }
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      const retired = RETIRED_CONTENT_BY_SHA.get(sha256);
      if (retired) {
        hits.push({
          fingerprint: `sha256:${sha256}`,
          sha256,
          label: retired.label,
          location: candidate.location,
          evidenceKind: 'content-sha256',
        });
      }
    }
    if (isJsonDocument(resolved.absolute, resolved.stat)) {
      try {
        buffer ??= readFileSync(resolved.absolute);
        const nested = JSON.parse(buffer.toString('utf8'));
        walkStrings(
          nested,
          `${candidate.location}:json`,
          (nestedCandidate, nestedLocation) =>
            addCandidate(nestedCandidate, nestedLocation),
        );
      } catch {
        // JSON 合法性由调用方的专用校验器负责；退役门只做受控证据发现。
      }
    }
  }
  if (cursor < candidates.length) {
    const error = new Error(
      '[RETIRED_GENERATED_STYLE_SCAN_LIMIT] 退役内容扫描达到受控文件上限，' +
      `仍有 ${candidates.length - cursor} 个候选未检查；为避免第 ` +
      `${MAX_RETIRED_STYLE_INSPECTED_FILES + 1} 个文件绕过，当前操作已按失败关闭。`,
    );
    error.code = 'RETIRED_GENERATED_STYLE_SCAN_LIMIT';
    error.inspectedFileCount = visitedFiles.size;
    error.pendingCandidateCount = candidates.length - cursor;
    throw error;
  }
  return uniqueHits(hits);
};

export const findRetiredGeneratedStyleFingerprints = (
  value,
  {
    location = '$',
    additionalStrings = [],
    projectRoot = null,
    documentPaths = [],
  } = {},
) => {
  const hits = [];
  const visited = new WeakSet();
  const visit = (current, currentLocation) => {
    if (typeof current === 'string') {
      hits.push(...stringFingerprintHits(current, currentLocation));
      return;
    }
    if (current === null || typeof current !== 'object') return;
    if (visited.has(current)) return;
    visited.add(current);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentLocation}[${index}]`));
      return;
    }
    for (const [key, item] of Object.entries(current)) {
      hits.push(...stringFingerprintHits(key, `${currentLocation}{key:${key}}`));
      visit(item, `${currentLocation}.${key}`);
    }
  };

  visit(value, location);
  additionalStrings.forEach((item, index) => {
    if (typeof item === 'string') {
      hits.push(
        ...stringFingerprintHits(item, `${location}{additional:${index}}`),
      );
    }
  });

  hits.push(...findRetiredGeneratedStyleContentHashes(value, {
    projectRoot,
    location,
    documentPaths,
    additionalStrings,
  }));
  return uniqueHits(hits);
};

export const retiredGeneratedStylePolicyMessage = (operation, hits) => {
  const orderedHits = [
    ...hits.filter((hit) => hit.evidenceKind === 'content-sha256'),
    ...hits.filter((hit) => hit.evidenceKind !== 'content-sha256'),
  ];
  const evidence = orderedHits
    .slice(0, 4)
    .map((hit) => `${hit.fingerprint}@${hit.location}`)
    .join('、');
  const remainder = hits.length > 4 ? `等${hits.length}处` : '';
  return (
    `[RETIRED_GENERATED_STYLE] 退役生成风格硬门：已阻断 ${operation}；` +
    `命中 ${evidence}${remainder}。` +
    '“纸构推演 v1”及其旧产物不得继续预览、正式生产、QA或回归；' +
    '仅允许只读状态检查；恢复旧 taskId 也不得联网、下载或写入。'
  );
};

export const assertNoRetiredGeneratedStyle = ({
  value,
  operation,
  location = '$',
  additionalStrings = [],
  projectRoot = null,
  documentPaths = [],
}) => {
  const hits = findRetiredGeneratedStyleFingerprints(value, {
    location,
    additionalStrings,
    projectRoot,
    documentPaths,
  });
  if (hits.length === 0) return [];
  const error = new Error(retiredGeneratedStylePolicyMessage(operation, hits));
  error.code = 'RETIRED_GENERATED_STYLE';
  error.hits = hits;
  throw error;
};
