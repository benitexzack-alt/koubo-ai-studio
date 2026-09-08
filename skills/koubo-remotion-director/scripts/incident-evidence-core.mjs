// Outcome flags are evidence, even when an outer wrapper claims success.
export function evidenceOutcomeIssues(value) {
  const issues = new Set();
  const visit = (item) => {
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      if (/exception|waiver/i.test(key) && !/forbidden|excluded|require|policy/i.test(key)) {
        if (child === true || (typeof child === 'string' && child.trim() && child !== 'none') ||
          (Array.isArray(child) && child.length > 0) ||
          (child && typeof child === 'object' && !Array.isArray(child) && Object.keys(child).length > 0)) {
          issues.add('EXCEPTION_NOT_SUCCESS');
        }
      }
      if (key === 'status' && typeof child === 'string') {
        if (/exception|waiver/i.test(child)) issues.add('EXCEPTION_NOT_SUCCESS');
        if (/(^|[-_])(failed|blocked|rejected|mismatch|partial)([-_]|$)/i.test(child)) issues.add('CONTENT_FAILURE');
      }
      const awaitingIndependentValidation = key === 'skillExecuted' &&
        item.schemaVersion === 'koubo-director-compile-receipt/v1' && item.phase === 'pre-shoot' && item.compilerExecuted === true;
      if ((['ok', 'success', 'passed', 'skillExecuted'].includes(key) || /Passed$/.test(key)) &&
        child === false && !awaitingIndependentValidation) {
        issues.add('CONTENT_FAILURE');
      }
      if (key === 'errors' && Array.isArray(child) && child.length > 0) issues.add('CONTENT_FAILURE');
      visit(child);
    }
  };
  visit(value);
  return [...issues];
}
