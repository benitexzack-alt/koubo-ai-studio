const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const asArray = (value) => Array.isArray(value) ? value : [];

const finding = ({
  code,
  scope,
  message,
  beatId = null,
  stageId = null,
  itemId = null,
  category = 'structure',
}) => ({
  code,
  scope,
  category,
  blocking: true,
  beatId,
  stageId,
  itemId,
  message,
});

const compareFindings = (left, right) => {
  const scopeOrder = {style: 0, batch: 1, shot: 2, stage: 3, acceptance: 4};
  return (scopeOrder[left.scope] ?? 99) - (scopeOrder[right.scope] ?? 99)
    || String(left.beatId ?? '').localeCompare(String(right.beatId ?? ''), 'en')
    || String(left.stageId ?? '').localeCompare(String(right.stageId ?? ''), 'en')
    || String(left.itemId ?? '').localeCompare(String(right.itemId ?? ''), 'en')
    || left.code.localeCompare(right.code, 'en');
};

const countDepthPlanes = (groups) => new Set(
  groups
    .map((group) => group?.depth)
    .filter((depth) => depth !== null && depth !== undefined && depth !== ''),
).size;

const isComplexExplainer = (beat, scene) => (
  scene?.archetype === 'mechanical-causality'
  || scene?.complexity === 'complex'
  || scene?.editorialScope === 'complex-explainer'
  || beat?.kind === 'complex-explanation'
);

const acceptedStatus = (status) => [
  'accepted',
  'approved',
  'passed',
  'user-accepted',
  'verified',
].includes(status);

const declaredStatus = (value) => isNonEmptyString(value?.status) ? value.status.trim() : null;

const isReceiptSha256 = (value) => (
  typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim())
);

const countIds = (items) => {
  const counts = new Map();
  for (const item of items) {
    if (!isNonEmptyString(item?.id)) continue;
    const id = item.id.trim();
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

/**
 * 对纸艺导演计划做确定性的结构审计。
 *
 * 该审计只能拦截计划级退化，绝不授予审美通过或生产资格。
 */
export const auditPaperPlan = ({style, plan}) => {
  if (!style || typeof style !== 'object') {
    throw new TypeError('style 必须是对象');
  }
  if (!plan || typeof plan !== 'object') {
    throw new TypeError('plan 必须是对象');
  }

  const allowedFamilies = asArray(style.visualGrammar?.composition?.allowedFamilies);
  const allowedCameras = asArray(style.motionGrammar?.allowedCameraLanguage);
  const complexObjectTarget = style.semanticContract?.complexExplainerTarget?.objectGroupCount ?? {};
  const complexNodeTarget = style.semanticContract?.complexExplainerTarget?.semanticNodeCount ?? {};
  const complexDepthMinimum = Number(
    style.semanticContract?.complexExplainerTarget?.minimumDepthPlanes
      ?? style.visualGrammar?.composition?.minimumDepthPlanes
      ?? 3,
  );
  const complexAssemblyTarget = style.motionGrammar?.complexShotAssemblyBeats ?? {};
  const complexAssemblyMinimum = Math.max(
    Number(complexAssemblyTarget.min ?? 4),
    Number(style.semanticContract?.complexExplainerTarget?.minimumAssemblyBeats ?? 0),
  );
  const ordinaryObjectMinimum = Number(style.visualGrammar?.composition?.objectGroupCount?.min ?? 3);
  const ordinaryDepthMinimum = Number(style.visualGrammar?.composition?.minimumDepthPlanes ?? 3);
  const finalHoldMinimumSeconds = Number(style.motionGrammar?.finalHoldMinimumSeconds ?? 1);

  const paperBeats = asArray(plan.beats)
    .filter((beat) => beat?.paperScene && typeof beat.paperScene === 'object')
    .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0)
      || String(left.id ?? '').localeCompare(String(right.id ?? ''), 'en'));

  const globalFindings = [];
  const styleGuard = {
    id: style.id ?? null,
    status: style.status ?? null,
    productionEligible: style.productionEligible ?? null,
  };

  if (style.status !== 'blocked-candidate' || style.productionEligible !== false) {
    globalFindings.push(finding({
      code: 'STYLE_CANDIDATE_GUARD_DRIFTED',
      scope: 'style',
      category: 'style',
      message: 'R10 试点必须继续使用 blocked-candidate 且 productionEligible=false 的候选风格。',
    }));
  } else {
    globalFindings.push(finding({
      code: 'STYLE_BLOCKED_CANDIDATE',
      scope: 'style',
      category: 'style',
      message: '风格仍是 blocked-candidate，计划审计不能授予生产资格。',
    }));
  }

  const shotReports = paperBeats.map((beat) => {
    const scene = beat.paperScene;
    const groups = asArray(scene.objectGroups);
    const nodes = asArray(scene.nodes);
    const stages = asArray(scene.stages);
    const compositionFamily = isNonEmptyString(scene.compositionFamily)
      ? scene.compositionFamily.trim()
      : null;
    const cameraLanguage = isNonEmptyString(scene.cameraLanguage)
      ? scene.cameraLanguage.trim()
      : null;
    const finalHoldSeconds = Number.isFinite(scene.finalHoldSeconds)
      ? scene.finalHoldSeconds
      : null;
    const dynamicCandidateStatus = declaredStatus(scene.dynamicCandidate);
    const humanAcceptanceStatus = declaredStatus(scene.humanAcceptance);
    const complexExplainer = isComplexExplainer(beat, scene);
    const shotFindings = [];

    if (!compositionFamily) {
      shotFindings.push(finding({
        code: 'SHOT_COMPOSITION_FAMILY_MISSING',
        scope: 'shot',
        beatId: beat.id,
        message: '纸艺镜头没有声明 compositionFamily。',
      }));
    } else if (!allowedFamilies.includes(compositionFamily)) {
      shotFindings.push(finding({
        code: 'SHOT_COMPOSITION_FAMILY_NOT_ALLOWED',
        scope: 'shot',
        beatId: beat.id,
        message: `构图 ${compositionFamily} 不在候选风格允许列表中。`,
      }));
    }

    if (!cameraLanguage) {
      shotFindings.push(finding({
        code: 'SHOT_CAMERA_LANGUAGE_MISSING',
        scope: 'shot',
        beatId: beat.id,
        message: '纸艺镜头没有声明 cameraLanguage。',
      }));
    } else if (!allowedCameras.includes(cameraLanguage)) {
      shotFindings.push(finding({
        code: 'SHOT_CAMERA_LANGUAGE_NOT_ALLOWED',
        scope: 'shot',
        beatId: beat.id,
        message: `机位语言 ${cameraLanguage} 不在候选风格允许列表中。`,
      }));
    }

    const groupIdCounts = countIds(groups);
    const validGroups = [];
    for (const [groupIndex, group] of groups.entries()) {
      const itemId = isNonEmptyString(group?.id) ? group.id.trim() : `group-${groupIndex + 1}`;
      let valid = true;
      if (!isNonEmptyString(group?.id)) {
        valid = false;
        shotFindings.push(finding({
          code: 'GROUP_ID_MISSING',
          scope: 'shot',
          beatId: beat.id,
          itemId,
          message: '物件组没有唯一可引用的非空 id。',
        }));
      } else if (groupIdCounts.get(group.id.trim()) !== 1) {
        valid = false;
        shotFindings.push(finding({
          code: 'GROUP_ID_DUPLICATE',
          scope: 'shot',
          beatId: beat.id,
          itemId,
          message: `物件组 id ${group.id.trim()} 在本镜重复。`,
        }));
      }
      if (!isNonEmptyString(group?.name)) {
        valid = false;
        shotFindings.push(finding({
          code: 'GROUP_NAME_MISSING',
          scope: 'shot',
          beatId: beat.id,
          itemId,
          message: '物件组没有非空 name。',
        }));
      }
      if (!Number.isInteger(group?.depth) || group.depth < 1) {
        valid = false;
        shotFindings.push(finding({
          code: 'GROUP_DEPTH_INVALID',
          scope: 'shot',
          beatId: beat.id,
          itemId,
          message: '物件组 depth 必须是大于等于 1 的整数。',
        }));
      }
      if (valid) validGroups.push(group);
    }

    const validGroupIds = new Set(validGroups.map((group) => group.id.trim()));
    const nodeIdCounts = countIds(nodes);
    const validNodes = [];
    for (const [nodeIndex, node] of nodes.entries()) {
      const itemId = isNonEmptyString(node?.id) ? node.id.trim() : `node-${nodeIndex + 1}`;
      let valid = true;
      if (!isNonEmptyString(node?.id)) {
        valid = false;
        shotFindings.push(finding({
          code: 'NODE_ID_MISSING',
          scope: 'shot',
          beatId: beat.id,
          itemId,
          message: '语义节点没有唯一可引用的非空 id。',
        }));
      } else if (nodeIdCounts.get(node.id.trim()) !== 1) {
        valid = false;
        shotFindings.push(finding({
          code: 'NODE_ID_DUPLICATE',
          scope: 'shot',
          beatId: beat.id,
          itemId,
          message: `语义节点 id ${node.id.trim()} 在本镜重复。`,
        }));
      }
      if (!isNonEmptyString(node?.label)) {
        valid = false;
        shotFindings.push(finding({
          code: 'NODE_LABEL_MISSING',
          scope: 'shot',
          beatId: beat.id,
          itemId,
          message: '语义节点没有非空 label。',
        }));
      }
      if (!isNonEmptyString(node?.groupId)) {
        valid = false;
        shotFindings.push(finding({
          code: 'NODE_GROUP_ID_MISSING',
          scope: 'shot',
          beatId: beat.id,
          itemId,
          message: '语义节点没有声明 groupId。',
        }));
      } else if (!validGroupIds.has(node.groupId.trim())) {
        valid = false;
        shotFindings.push(finding({
          code: 'NODE_GROUP_REFERENCE_INVALID',
          scope: 'shot',
          beatId: beat.id,
          itemId,
          message: `语义节点引用的物件组 ${node.groupId.trim()} 不存在或本身无效。`,
        }));
      }
      if (valid) validNodes.push(node);
    }

    const stageIdCounts = countIds(stages);
    const validStages = [];
    for (const [stageIndex, stage] of stages.entries()) {
      const stageId = isNonEmptyString(stage?.id) ? stage.id.trim() : `stage-${stageIndex + 1}`;
      let valid = true;
      if (!isNonEmptyString(stage?.id)) {
        valid = false;
        shotFindings.push(finding({
          code: 'STAGE_ID_MISSING',
          scope: 'stage',
          beatId: beat.id,
          stageId,
          message: '装配阶段没有唯一可引用的非空 id。',
        }));
      } else if (stageIdCounts.get(stage.id.trim()) !== 1) {
        valid = false;
        shotFindings.push(finding({
          code: 'STAGE_ID_DUPLICATE',
          scope: 'stage',
          beatId: beat.id,
          stageId,
          message: `装配阶段 id ${stage.id.trim()} 在本镜重复。`,
        }));
      }
      if (!Number.isInteger(stage?.order) || stage.order < 1) {
        valid = false;
        shotFindings.push(finding({
          code: 'STAGE_ORDER_INVALID',
          scope: 'stage',
          beatId: beat.id,
          stageId,
          message: '装配阶段 order 必须是大于等于 1 的整数。',
        }));
      }
      if (!isNonEmptyString(stage?.action)) {
        valid = false;
        shotFindings.push(finding({
          code: 'STAGE_ACTION_MISSING',
          scope: 'stage',
          beatId: beat.id,
          stageId,
          message: '装配阶段没有非空 action。',
        }));
      }
      if (!isNonEmptyString(stage?.subject)) {
        valid = false;
        shotFindings.push(finding({
          code: 'STAGE_SUBJECT_MISSING',
          scope: 'stage',
          beatId: beat.id,
          stageId,
          message: '装配阶段没有声明 subject。',
        }));
      } else if (!validGroupIds.has(stage.subject.trim())) {
        valid = false;
        shotFindings.push(finding({
          code: 'STAGE_SUBJECT_REFERENCE_INVALID',
          scope: 'stage',
          beatId: beat.id,
          stageId,
          message: `装配阶段引用的物件组 ${stage.subject.trim()} 不存在或本身无效。`,
        }));
      }
      if (!isNonEmptyString(stage?.sfxRole)) {
        shotFindings.push(finding({
          code: 'STAGE_SFX_ROLE_MISSING',
          scope: 'stage',
          beatId: beat.id,
          stageId,
          message: '装配阶段没有声明逐动作 sfxRole。',
        }));
      }
      if (valid) validStages.push(stage);
    }

    const stageOrders = stages
      .map((stage) => stage?.order)
      .filter((order) => Number.isInteger(order) && order >= 1)
      .sort((left, right) => left - right);
    const stageOrderContinuous = (
      stageOrders.length === stages.length
      && stageOrders.every((order, index) => order === index + 1)
    );
    if (!stageOrderContinuous) {
      shotFindings.push(finding({
        code: 'STAGE_ORDER_NOT_CONTIGUOUS',
        scope: 'shot',
        beatId: beat.id,
        message: '装配阶段 order 必须从 1 开始且无重复、无断档地连续递增。',
      }));
    }

    const objectGroupCount = validGroups.length;
    const semanticNodeCount = validNodes.length;
    const depthPlaneCount = countDepthPlanes(validGroups);
    const assemblyBeatCount = stageOrderContinuous ? validStages.length : 0;
    const stageCountWithSfxRole = stages.filter((stage) => isNonEmptyString(stage?.sfxRole)).length;

    if (complexExplainer) {
      if (
        objectGroupCount < Number(complexObjectTarget.min ?? 5)
        || objectGroupCount > Number(complexObjectTarget.max ?? 6)
      ) {
        shotFindings.push(finding({
          code: 'COMPLEX_OBJECT_GROUP_COUNT_OUT_OF_RANGE',
          scope: 'shot',
          beatId: beat.id,
          message: `复杂解释镜物件组为 ${objectGroupCount}，要求 ${complexObjectTarget.min ?? 5}—${complexObjectTarget.max ?? 6} 组。`,
        }));
      }
      if (
        semanticNodeCount < Number(complexNodeTarget.min ?? 9)
        || semanticNodeCount > Number(complexNodeTarget.max ?? 13)
      ) {
        shotFindings.push(finding({
          code: 'COMPLEX_SEMANTIC_NODE_COUNT_OUT_OF_RANGE',
          scope: 'shot',
          beatId: beat.id,
          message: `复杂解释镜语义节点为 ${semanticNodeCount}，要求 ${complexNodeTarget.min ?? 9}—${complexNodeTarget.max ?? 13} 个。`,
        }));
      }
      if (depthPlaneCount < complexDepthMinimum) {
        shotFindings.push(finding({
          code: 'COMPLEX_DEPTH_PLANE_COUNT_TOO_LOW',
          scope: 'shot',
          beatId: beat.id,
          message: `复杂解释镜只有 ${depthPlaneCount} 层，至少需要 ${complexDepthMinimum} 层。`,
        }));
      }
      if (
        assemblyBeatCount < complexAssemblyMinimum
        || assemblyBeatCount > Number(complexAssemblyTarget.max ?? 7)
      ) {
        shotFindings.push(finding({
          code: 'COMPLEX_ASSEMBLY_BEAT_COUNT_OUT_OF_RANGE',
          scope: 'shot',
          beatId: beat.id,
          message: `复杂解释镜装配节拍为 ${assemblyBeatCount}，要求 ${complexAssemblyMinimum}—${complexAssemblyTarget.max ?? 7} 拍。`,
        }));
      }
    } else {
      if (objectGroupCount < ordinaryObjectMinimum) {
        shotFindings.push(finding({
          code: 'ORDINARY_OBJECT_GROUP_COUNT_TOO_LOW',
          scope: 'shot',
          beatId: beat.id,
          message: `普通纸艺镜只有 ${objectGroupCount} 个物件组，至少需要 ${ordinaryObjectMinimum} 组。`,
        }));
      }
      if (semanticNodeCount < 1) {
        shotFindings.push(finding({
          code: 'ORDINARY_SEMANTIC_NODE_MISSING',
          scope: 'shot',
          beatId: beat.id,
          message: '普通纸艺镜至少需要一个独立语义节点。',
        }));
      }
      if (depthPlaneCount < ordinaryDepthMinimum) {
        shotFindings.push(finding({
          code: 'ORDINARY_DEPTH_PLANE_COUNT_TOO_LOW',
          scope: 'shot',
          beatId: beat.id,
          message: `普通纸艺镜只有 ${depthPlaneCount} 层，至少需要 ${ordinaryDepthMinimum} 层。`,
        }));
      }
    }

    if (finalHoldSeconds === null) {
      shotFindings.push(finding({
        code: 'SHOT_FINAL_HOLD_MISSING',
        scope: 'shot',
        beatId: beat.id,
        message: '纸艺镜头没有声明 finalHoldSeconds。',
      }));
    } else if (finalHoldSeconds < finalHoldMinimumSeconds) {
      shotFindings.push(finding({
        code: 'SHOT_FINAL_HOLD_TOO_SHORT',
        scope: 'shot',
        beatId: beat.id,
        message: `完成态停留为 ${finalHoldSeconds} 秒，至少需要 ${finalHoldMinimumSeconds} 秒。`,
      }));
    }

    if (!dynamicCandidateStatus) {
      shotFindings.push(finding({
        code: 'SHOT_DYNAMIC_CANDIDATE_STATUS_MISSING',
        scope: 'shot',
        beatId: beat.id,
        category: 'acceptance',
        message: '纸艺镜头没有声明动态候选状态。',
      }));
    } else if (acceptedStatus(dynamicCandidateStatus)) {
      if (!isNonEmptyString(scene.dynamicCandidate?.receiptPath)) {
        shotFindings.push(finding({
          code: 'DYNAMIC_CANDIDATE_RECEIPT_PATH_MISSING',
          scope: 'acceptance',
          beatId: beat.id,
          category: 'acceptance',
          message: '已接受的动态候选没有非空 receiptPath。',
        }));
      }
      if (!isReceiptSha256(scene.dynamicCandidate?.receiptSha256)) {
        shotFindings.push(finding({
          code: 'DYNAMIC_CANDIDATE_RECEIPT_SHA256_INVALID',
          scope: 'acceptance',
          beatId: beat.id,
          category: 'acceptance',
          message: '已接受的动态候选没有合法的 64 位 receiptSha256。',
        }));
      }
    }
    if (!humanAcceptanceStatus) {
      shotFindings.push(finding({
        code: 'SHOT_HUMAN_ACCEPTANCE_STATUS_MISSING',
        scope: 'shot',
        beatId: beat.id,
        category: 'acceptance',
        message: '纸艺镜头没有声明人工动态验收状态。',
      }));
    } else if (acceptedStatus(humanAcceptanceStatus)) {
      if (!isNonEmptyString(scene.humanAcceptance?.receiptPath)) {
        shotFindings.push(finding({
          code: 'HUMAN_ACCEPTANCE_RECEIPT_PATH_MISSING',
          scope: 'acceptance',
          beatId: beat.id,
          category: 'acceptance',
          message: '已通过的人工验收没有非空 receiptPath。',
        }));
      }
      if (!isReceiptSha256(scene.humanAcceptance?.receiptSha256)) {
        shotFindings.push(finding({
          code: 'HUMAN_ACCEPTANCE_RECEIPT_SHA256_INVALID',
          scope: 'acceptance',
          beatId: beat.id,
          category: 'acceptance',
          message: '已通过的人工验收没有合法的 64 位 receiptSha256。',
        }));
      }
      if (scene.humanAcceptance?.reviewer !== 'user') {
        shotFindings.push(finding({
          code: 'HUMAN_ACCEPTANCE_REVIEWER_INVALID',
          scope: 'acceptance',
          beatId: beat.id,
          category: 'acceptance',
          message: '人工动态验收 reviewer 必须明确为 user。',
        }));
      }
      if (scene.humanAcceptance?.reviewMode !== 'normal-speed-full-window') {
        shotFindings.push(finding({
          code: 'HUMAN_ACCEPTANCE_REVIEW_MODE_INVALID',
          scope: 'acceptance',
          beatId: beat.id,
          category: 'acceptance',
          message: '人工动态验收必须记录 normal-speed-full-window。',
        }));
      }
      if (!isNonEmptyString(scene.humanAcceptance?.reviewedAt)) {
        shotFindings.push(finding({
          code: 'HUMAN_ACCEPTANCE_REVIEWED_AT_MISSING',
          scope: 'acceptance',
          beatId: beat.id,
          category: 'acceptance',
          message: '人工动态验收没有非空 reviewedAt。',
        }));
      }
    }

    return {
      beatId: beat.id ?? null,
      order: beat.order ?? null,
      title: scene.title ?? null,
      archetype: scene.archetype ?? null,
      complexExplainer,
      declarations: {
        compositionFamily,
        cameraLanguage,
        finalHoldSeconds,
        dynamicCandidateStatus,
        humanAcceptanceStatus,
        dynamicCandidateEvidenceComplete: (
          acceptedStatus(dynamicCandidateStatus)
          && isNonEmptyString(scene.dynamicCandidate?.receiptPath)
          && isReceiptSha256(scene.dynamicCandidate?.receiptSha256)
        ),
        humanAcceptanceEvidenceComplete: (
          acceptedStatus(humanAcceptanceStatus)
          && isNonEmptyString(scene.humanAcceptance?.receiptPath)
          && isReceiptSha256(scene.humanAcceptance?.receiptSha256)
          && scene.humanAcceptance?.reviewer === 'user'
          && scene.humanAcceptance?.reviewMode === 'normal-speed-full-window'
          && isNonEmptyString(scene.humanAcceptance?.reviewedAt)
        ),
      },
      metrics: {
        rawObjectGroupCount: groups.length,
        objectGroupCount,
        rawSemanticNodeCount: nodes.length,
        semanticNodeCount,
        depthPlaneCount,
        rawAssemblyBeatCount: stages.length,
        assemblyBeatCount,
        stageCountWithSfxRole,
        finalHoldSeconds,
      },
      findings: shotFindings.sort(compareFindings),
    };
  });

  const declaredFamilies = shotReports
    .map((shot) => shot.declarations.compositionFamily)
    .filter(Boolean);
  const uniqueFamilies = [...new Set(declaredFamilies)].sort((a, b) => a.localeCompare(b, 'en'));
  const minimumCompositionFamilyCount = 3;
  const compositionCoveragePassed = (
    shotReports.length > 0
    && declaredFamilies.length === shotReports.length
    && uniqueFamilies.length >= minimumCompositionFamilyCount
  );
  if (!compositionCoveragePassed) {
    globalFindings.push(finding({
      code: 'BATCH_COMPOSITION_COVERAGE_MISSING',
      scope: 'batch',
      message: `纸艺批次只有 ${uniqueFamilies.length} 类已声明构图，至少需要 ${minimumCompositionFamilyCount} 类，且每镜都必须声明。`,
    }));
  }

  const repeatedCompositionPairs = [];
  for (let index = 1; index < shotReports.length; index += 1) {
    const previous = shotReports[index - 1];
    const current = shotReports[index];
    if (
      previous.declarations.compositionFamily
      && previous.declarations.compositionFamily === current.declarations.compositionFamily
    ) {
      repeatedCompositionPairs.push({
        previousBeatId: previous.beatId,
        beatId: current.beatId,
        compositionFamily: current.declarations.compositionFamily,
      });
      globalFindings.push(finding({
        code: 'CONSECUTIVE_COMPOSITION_FAMILY_REPEATED',
        scope: 'batch',
        beatId: current.beatId,
        message: `${previous.beatId} 与 ${current.beatId} 连续使用同一构图 ${current.declarations.compositionFamily}。`,
      }));
    }
  }

  const allShotFindings = shotReports.flatMap((shot) => shot.findings);
  const structuralFindings = [...globalFindings, ...allShotFindings]
    .filter((item) => item.category === 'structure');
  const missingAcceptanceDeclarations = allShotFindings
    .filter((item) => item.category === 'acceptance');
  const allDynamicCandidatesAccepted = shotReports.length > 0 && shotReports.every((shot) => (
    acceptedStatus(shot.declarations.dynamicCandidateStatus)
  ));
  const allHumanReviewsAccepted = shotReports.length > 0 && shotReports.every((shot) => (
    acceptedStatus(shot.declarations.humanAcceptanceStatus)
  ));

  if (missingAcceptanceDeclarations.length === 0 && !allDynamicCandidatesAccepted) {
    globalFindings.push(finding({
      code: 'DYNAMIC_CANDIDATE_NOT_ACCEPTED',
      scope: 'acceptance',
      category: 'acceptance',
      message: '动态候选状态已声明，但尚未全部进入已接受状态。',
    }));
  }
  if (missingAcceptanceDeclarations.length === 0 && !allHumanReviewsAccepted) {
    globalFindings.push(finding({
      code: 'HUMAN_DYNAMIC_ACCEPTANCE_PENDING',
      scope: 'acceptance',
      category: 'acceptance',
      message: '人工动态验收状态已声明，但尚未全部明确通过。',
    }));
  }

  const structuralStatus = structuralFindings.length === 0 ? 'pass' : 'blocked';
  const acceptanceStatus = (
    missingAcceptanceDeclarations.length === 0
    && allDynamicCandidatesAccepted
    && allHumanReviewsAccepted
  ) ? 'accepted' : 'blocked';

  const findings = [...globalFindings, ...allShotFindings].sort(compareFindings);
  // R10 当前只是一条旁路候选审计。即便结构和人工状态都齐全，
  // 本模块也不能自行解除风格候选锁或授予生产资格。
  const overallStatus = 'blocked';

  return {
    schemaVersion: 'director-r10-paper-quality-report/v1',
    source: {
      styleId: style.id ?? null,
      planRevisionId: plan.revisionId ?? null,
      taskId: plan.taskId ?? null,
    },
    styleGuard,
    criteria: {
      allowedCompositionFamilies: [...allowedFamilies],
      allowedCameraLanguage: [...allowedCameras],
      complexExplainer: {
        objectGroupCount: {
          min: Number(complexObjectTarget.min ?? 5),
          max: Number(complexObjectTarget.max ?? 6),
        },
        semanticNodeCount: {
          min: Number(complexNodeTarget.min ?? 9),
          max: Number(complexNodeTarget.max ?? 13),
        },
        minimumDepthPlanes: complexDepthMinimum,
        assemblyBeatCount: {
          min: complexAssemblyMinimum,
          max: Number(complexAssemblyTarget.max ?? 7),
        },
      },
      ordinaryShot: {
        minimumObjectGroupCount: ordinaryObjectMinimum,
        minimumSemanticNodeCount: 1,
        minimumDepthPlanes: ordinaryDepthMinimum,
      },
      finalHoldMinimumSeconds,
      everyStageRequiresSfxRole: true,
    },
    structuralStatus,
    acceptanceStatus,
    overallStatus,
    machineBoundary: {
      aestheticApprovalGranted: false,
      humanDynamicReviewRequired: true,
      statement: '机器审计只拦截计划级退化；动态质感、节奏与审美必须由人工按正常速度观看后验收。',
    },
    batch: {
      paperShotCount: shotReports.length,
      declaredCompositionFamilyCount: declaredFamilies.length,
      uniqueCompositionFamilyCount: uniqueFamilies.length,
      uniqueCompositionFamilies: uniqueFamilies,
      minimumCompositionFamilyCount,
      compositionCoveragePassed,
      repeatedCompositionPairs,
      consecutiveCompositionVariationPassed: repeatedCompositionPairs.length === 0
        && declaredFamilies.length === shotReports.length,
    },
    shots: shotReports,
    findings,
  };
};
