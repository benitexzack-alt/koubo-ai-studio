import crypto from 'node:crypto';
import path from 'node:path';

export const EXPERIENCE_LEDGER_SCHEMA = 'koubo-shotcraft-experience-ledger/v1';
export const EXPERIENCE_DECISION_SCHEMA = 'koubo-shotcraft-experience-decision/v1';
export const EXPERIENCE_WRITE_RECEIPT_SCHEMA = 'koubo-shotcraft-experience-write-receipt/v1';

const SHA256_RE = /^[a-f0-9]{64}$/u;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const uniqueSorted = (values) => [...new Set((values ?? []).filter(isText).map((value) => value.trim()))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
const normalizeTerm = (value) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '');

export const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
};

export const stableStringify = (value) => JSON.stringify(stableValue(value));
export const sha256Text = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function normalizeContextSignature(signature) {
  return {
    mainVisual: String(signature?.mainVisual ?? '').trim(),
    materialClass: String(signature?.materialClass ?? 'generic').trim(),
    semanticIntents: uniqueSorted(signature?.semanticIntents),
    keyTerms: uniqueSorted((signature?.keyTerms ?? []).map(normalizeTerm).filter(Boolean)),
  };
}

export function contextFingerprint(signature) {
  return sha256Text(stableStringify(normalizeContextSignature(signature)));
}

export function patternKey(signature, effectId) {
  const context = normalizeContextSignature(signature);
  return [effectId, context.mainVisual, context.materialClass, context.semanticIntents.join('+')].join('|');
}

function jaccard(left, right) {
  const a = new Set(left ?? []);
  const b = new Set(right ?? []);
  if (!a.size && !b.size) return 1;
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / Math.max(1, new Set([...a, ...b]).size);
}

export function contextSimilarity(left, right) {
  const a = normalizeContextSignature(left);
  const b = normalizeContextSignature(right);
  if (!a.mainVisual || a.mainVisual !== b.mainVisual) return 0;
  const material = a.materialClass === b.materialClass ? 1 : (a.materialClass === 'generic' || b.materialClass === 'generic' ? 0.5 : 0);
  return 0.58 * jaccard(a.semanticIntents, b.semanticIntents) + 0.24 * material + 0.18 * jaccard(a.keyTerms, b.keyTerms);
}

function latestResolvedCases(cases) {
  const latest = new Map();
  for (const entry of cases) {
    const key = `${entry.contextFingerprint}|${entry.effectId}`;
    const previous = latest.get(key);
    if (!previous || `${entry.recordedAt}|${entry.caseId}` > `${previous.recordedAt}|${previous.caseId}`) latest.set(key, entry);
  }
  return [...latest.values()];
}

export function rebuildExperiencePatterns(cases, policy) {
  const grouped = new Map();
  for (const entry of latestResolvedCases(cases)) {
    const key = patternKey(entry.context, entry.effectId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  }
  const patterns = [];
  for (const [key, entries] of grouped) {
    const accepted = entries.filter((entry) => entry.outcome === 'accepted');
    const rejected = entries.filter((entry) => entry.outcome === 'rejected');
    const distinctTasks = new Set(accepted.map((entry) => entry.taskId)).size;
    if (
      accepted.length >= policy.patternPromotionMinimumAcceptedCases &&
      distinctTasks >= policy.patternPromotionMinimumDistinctTasks &&
      rejected.length === 0
    ) {
      const exemplar = accepted[0];
      patterns.push({
        patternId: `pattern-${sha256Text(key).slice(0, 16)}`,
        patternKey: key,
        status: 'reusable-pattern',
        effectId: exemplar.effectId,
        cardName: exemplar.cardName,
        context: {
          mainVisual: exemplar.context.mainVisual,
          materialClass: exemplar.context.materialClass,
          semanticIntents: exemplar.context.semanticIntents,
        },
        acceptedCaseIds: accepted.map((entry) => entry.caseId).sort(),
        acceptedTaskCount: distinctTasks,
      });
    }
  }
  return patterns.sort((a, b) => a.patternId.localeCompare(b.patternId, 'en'));
}

const validBinding = (binding) =>
  isRecord(binding) &&
  isText(binding.path) &&
  !path.isAbsolute(binding.path) &&
  SHA256_RE.test(String(binding.sha256 ?? ''));

export function validateExperienceLedger(ledger) {
  const errors = [];
  const fail = (condition, code) => { if (!condition) errors.push(code); };
  fail(isRecord(ledger) && ledger.schemaVersion === EXPERIENCE_LEDGER_SCHEMA, 'SHOTCRAFT_EXPERIENCE_LEDGER_SCHEMA_INVALID');
  if (!isRecord(ledger)) return errors;
  const policy = ledger.policy;
  fail(isRecord(policy), 'SHOTCRAFT_EXPERIENCE_POLICY_REQUIRED');
  fail(policy?.exactReuseMinimumAcceptedCases === 1, 'SHOTCRAFT_EXPERIENCE_EXACT_REUSE_POLICY_INVALID');
  fail(Number.isInteger(policy?.patternPromotionMinimumAcceptedCases) && policy.patternPromotionMinimumAcceptedCases >= 2, 'SHOTCRAFT_EXPERIENCE_PROMOTION_COUNT_INVALID');
  fail(Number.isInteger(policy?.patternPromotionMinimumDistinctTasks) && policy.patternPromotionMinimumDistinctTasks >= 2, 'SHOTCRAFT_EXPERIENCE_PROMOTION_TASKS_INVALID');
  fail(policy?.candidatePreviewStillRequired === true, 'SHOTCRAFT_EXPERIENCE_PREVIEW_GATE_MISSING');
  fail(policy?.automaticFormalApproval === false, 'SHOTCRAFT_EXPERIENCE_FORMAL_AUTO_APPROVAL_FORBIDDEN');
  fail(policy?.latestRejectionBlocksExactReuse === true, 'SHOTCRAFT_EXPERIENCE_REJECTION_GATE_MISSING');
  fail(Array.isArray(ledger.cases), 'SHOTCRAFT_EXPERIENCE_CASES_REQUIRED');
  fail(Array.isArray(ledger.patterns), 'SHOTCRAFT_EXPERIENCE_PATTERNS_REQUIRED');
  if (!Array.isArray(ledger.cases) || !isRecord(policy)) return [...new Set(errors)];

  const ids = new Set();
  for (const entry of ledger.cases) {
    const prefix = `SHOTCRAFT_EXPERIENCE_CASE_INVALID:${entry?.caseId ?? 'missing'}`;
    if (!isRecord(entry) || !isText(entry.caseId) || ids.has(entry.caseId)) {
      errors.push(prefix);
      continue;
    }
    ids.add(entry.caseId);
    const normalized = normalizeContextSignature(entry.context);
    if (
      !['accepted', 'rejected'].includes(entry.outcome) ||
      !isText(entry.taskId) || !isText(entry.revisionId) || !isText(entry.beatId) ||
      !isText(entry.effectId) || !isText(entry.cardName) || !isText(entry.recordedAt) ||
      !normalized.mainVisual || !normalized.semanticIntents.length ||
      entry.contextFingerprint !== contextFingerprint(normalized) ||
      !validBinding(entry.selection) || !validBinding(entry.applicationReceipt) ||
      !validBinding(entry.candidate) || !validBinding(entry.component) ||
      !SHA256_RE.test(String(entry.registrySha256 ?? '')) ||
      !isRecord(entry.userEvidence) || !isText(entry.userEvidence.quote) ||
      entry.userEvidence.quoteSha256 !== sha256Text(entry.userEvidence.quote)
    ) errors.push(prefix);
  }

  if (Array.isArray(ledger.patterns)) {
    const expected = stableStringify(rebuildExperiencePatterns(ledger.cases, policy));
    if (stableStringify(ledger.patterns) !== expected) errors.push('SHOTCRAFT_EXPERIENCE_PATTERNS_STALE');
  }
  return [...new Set(errors)];
}

export function experienceSignalForCandidate({ledger, context, effectId, cardName, registrySha256, componentSha256}) {
  const fingerprint = contextFingerprint(context);
  const relevant = (ledger?.cases ?? []).filter((entry) => entry.effectId === effectId && entry.cardName === cardName);
  const current = relevant.filter((entry) => entry.registrySha256 === registrySha256 && entry.component.sha256 === componentSha256);
  const staleCaseIds = relevant.filter((entry) => !current.includes(entry)).map((entry) => entry.caseId).sort();
  const exact = current.filter((entry) => entry.contextFingerprint === fingerprint).sort((a, b) => `${b.recordedAt}|${b.caseId}`.localeCompare(`${a.recordedAt}|${a.caseId}`, 'en'));
  const latestExact = exact[0] ?? null;
  const similar = current
    .map((entry) => ({entry, similarity: contextSimilarity(context, entry.context)}))
    .filter(({similarity}) => similarity >= 0.62)
    .sort((a, b) => b.similarity - a.similarity || b.entry.recordedAt.localeCompare(a.entry.recordedAt, 'en'));
  const pattern = (ledger?.patterns ?? []).find((item) => item.patternKey === patternKey(context, effectId) && item.cardName === cardName) ?? null;
  return {
    exactAccepted: latestExact?.outcome === 'accepted',
    exactRejected: latestExact?.outcome === 'rejected',
    exactCaseId: latestExact?.caseId ?? null,
    reusablePatternId: pattern?.patternId ?? null,
    bestSimilarAccepted: similar.find(({entry}) => entry.outcome === 'accepted') ?? null,
    bestSimilarRejected: similar.find(({entry}) => entry.outcome === 'rejected') ?? null,
    staleCaseIds,
  };
}
