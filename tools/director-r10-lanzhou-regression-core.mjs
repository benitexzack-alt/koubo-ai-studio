const fail = (message) => {
  throw new Error('R10_LANZHOU_SOURCE_MISMATCH: ' + message);
};

const requireArray = (value, label) => {
  if (!Array.isArray(value)) fail(label + ' 必须是数组');
  return value;
};

const toMs = (seconds, label) => {
  if (!Number.isFinite(seconds)) fail(label + ' 缺少有效秒数');
  return Math.round(seconds * 1000);
};

const findOne = (items, predicate, label) => {
  const matches = items.filter(predicate);
  if (matches.length !== 1) fail(label + ' 应唯一，实际为 ' + matches.length);
  return matches[0];
};

const isFullyCovered = (window, ranges) =>
  ranges.some((range) => range.startMs <= window.startMs && range.endMs >= window.endMs);

const makeDiagnostic = (code, severity, message, evidenceIds) => ({
  code,
  severity,
  message,
  evidenceIds,
});

/**
 * 把 2026-09-10 兰州口播的真实输入投影为稳定、只读的事故回归报告。
 * 本函数不修改源文件，也不从文本内容猜测词级时间；修复锚点只使用实录分段边界。
 */
export const auditLanzhouDirectorRegression = ({
  bilingual,
  spokenTimeline,
  postshoot,
  visualPlan,
  sfxPlan,
  productionJob,
}) => {
  const bilingualCaptions = requireArray(bilingual?.captions, '双语字幕 captions');
  const timelineCaptions = requireArray(spokenTimeline?.captions, '实录时间轴 captions');
  const postshootBeats = requireArray(postshoot?.beats, '实录重绑 beats');
  const paperScenes = requireArray(postshoot?.paperScenes, '实录重绑 paperScenes');
  const layers = requireArray(visualPlan?.layers, '视觉计划 layers');
  const cues = requireArray(sfxPlan?.cues, '音效计划 cues');
  const previewRanges = requireArray(productionJob?.preview?.ranges, '生产任务 preview.ranges');

  const b07Segments = bilingualCaptions
    .filter((caption) => caption.beatId === 'B07')
    .sort((a, b) => a.startMs - b.startMs)
    .map((caption) => ({
      captionId: caption.id,
      startMs: caption.startMs,
      endMs: caption.endMs,
      text: caption.zh,
      timingPrecision: caption.timingPrecision,
    }));

  if (b07Segments.length !== 6) fail('B07 应有 6 个实录小分段，实际为 ' + b07Segments.length);
  for (let index = 0; index < b07Segments.length; index += 1) {
    const segment = b07Segments[index];
    if (!segment.captionId || !Number.isInteger(segment.startMs) || !Number.isInteger(segment.endMs)) {
      fail('B07 第 ' + (index + 1) + ' 个分段缺少稳定 ID 或毫秒边界');
    }
    if (segment.endMs <= segment.startMs) fail(segment.captionId + ' 的时间范围无效');
    if (index > 0 && b07Segments[index - 1].endMs !== segment.startMs) {
      fail(b07Segments[index - 1].captionId + ' 与 ' + segment.captionId + ' 的边界不连续');
    }
  }

  const spokenB07 = findOne(
    timelineCaptions,
    (caption) => caption.beatId === 'B07',
    '实录时间轴 B07',
  );
  if (
    spokenB07.startMs !== b07Segments[0].startMs ||
    spokenB07.endMs !== b07Segments[b07Segments.length - 1].endMs
  ) {
    fail('双语小分段与实录 B07 总窗口不一致');
  }

  const postshootB07 = findOne(postshootBeats, (beat) => beat.id === 'B07', '实录重绑 B07');
  const postshootNodes = requireArray(postshootB07?.paperScene?.textPlan, 'B07 纸艺 textPlan');
  const postshootBindings = postshootNodes.map((node) => ({
    nodeId: node.nodeId,
    startMs: node.postshootBinding?.anchorStartMs,
    endMs: node.postshootBinding?.anchorEndMs,
  }));
  if (
    postshootBindings.some(
      (binding) =>
        !binding.nodeId ||
        !Number.isInteger(binding.startMs) ||
        !Number.isInteger(binding.endMs),
    )
  ) {
    fail('B07 节点缺少可审计的 postshootBinding');
  }
  const bindingWindows = new Set(
    postshootBindings.map((binding) => binding.startMs + ':' + binding.endMs),
  );
  const postshootCollapsedWindow =
    bindingWindows.size === 1
      ? {
          beatId: 'B07',
          startMs: postshootBindings[0].startMs,
          endMs: postshootBindings[0].endMs,
          nodeIds: postshootBindings.map((binding) => binding.nodeId),
        }
      : null;

  const p02Layer = findOne(layers, (layer) => layer.id === 'v91-009-p02-b07', 'P02 视觉层');
  const p02Scene = findOne(paperScenes, (scene) => scene.beatId === 'B07', 'P02 纸艺场景');
  const actions = requireArray(p02Scene?.motionContract?.actions, 'P02 motionContract.actions');
  const stages = requireArray(p02Scene?.stages, 'P02 stages');
  const p02StartMs = toMs(p02Layer.start, 'P02 start');
  const p02EndMs = toMs(p02Layer.end, 'P02 end');
  const p02Actions = actions.map((action) => {
    const stage = findOne(stages, (item) => item.id === action.stageId, action.id + ' 对应阶段');
    return {
      actionId: action.id,
      startMs: p02StartMs + toMs(action.startSeconds, action.id + ' startSeconds'),
      endMs: p02StartMs + toMs(action.endSeconds, action.id + ' endSeconds'),
      sfxRole: stage.sfxRole,
    };
  });
  const p02VisualEventId = p02Layer.visualEvent?.id;
  if (!p02VisualEventId) fail('P02 缺少 visualEvent.id');
  const entrySfxCueIds = cues
    .filter((cue) => cue.visualEventId === p02VisualEventId)
    .map((cue) => cue.id)
    .sort();
  const actionIds = new Set(p02Actions.map((action) => action.actionId));
  const stageIds = new Set(actions.map((action) => action.stageId));
  const internalActionSfxBoundCount = cues.filter(
    (cue) => actionIds.has(cue.actionId) || stageIds.has(cue.stageId),
  ).length;
  const assetAudioMuted = p02Layer.presentation?.muteAssetAudio === true;

  const rangesMs = previewRanges.map((range) => ({
    id: range.id,
    startMs: toMs(range.startSeconds, range.id + ' startSeconds'),
    endMs: toMs(range.endSeconds, range.id + ' endSeconds'),
  }));
  const requiredLayers = layers.filter(
    (layer) =>
      (layer.kind === 'full-screen-asset' && /-p0[2-6]-/i.test(layer.id)) ||
      layer.beatId === 'B21' ||
      layer.sound?.role === 'cta',
  );
  const missedRequiredIds = requiredLayers
    .filter((layer) => {
      const window = {
        startMs: toMs(layer.start, layer.id + ' start'),
        endMs: toMs(layer.end, layer.id + ' end'),
      };
      return !isFullyCovered(window, rangesMs);
    })
    .map((layer) => layer.id);

  const diagnostics = [
    makeDiagnostic(
      'R10_LANZHOU_B07_SEGMENTS_CONFIRMED',
      'evidence',
      'B07 的实录权威源保留了六个连续分段，范围为 66.0–85.9 秒。',
      b07Segments.map((segment) => segment.captionId),
    ),
  ];
  if (
    postshootCollapsedWindow &&
    postshootCollapsedWindow.startMs === 85600 &&
    postshootCollapsedWindow.endMs === 85900 &&
    postshootCollapsedWindow.nodeIds.length === 4
  ) {
    diagnostics.push(
      makeDiagnostic(
        'R10_LANZHOU_POSTSHOOT_B07_TAIL_COLLAPSE',
        'error',
        '四个语义节点被统一压到 B07 末尾 85.6–85.9 秒，丢失了已有分段精度。',
        postshootCollapsedWindow.nodeIds,
      ),
    );
  }
  if (assetAudioMuted && p02Actions.length === 4 && entrySfxCueIds.length === 1 && internalActionSfxBoundCount === 0) {
    diagnostics.push(
      makeDiagnostic(
        'R10_LANZHOU_P02_INTERNAL_ACTION_SFX_MISSING',
        'error',
        'P02 含四个动作，但素材音轨被静音，计划仅绑定一个入口音效，四个动作均无独立音效。',
        p02Actions.map((action) => action.actionId),
      ),
    );
  }
  if (missedRequiredIds.length > 0) {
    diagnostics.push(
      makeDiagnostic(
        'R10_LANZHOU_PREVIEW_COVERAGE_FALSE_POSITIVE',
        'error',
        '生产任务只有 0–45 秒预览，未实际完整覆盖 P02–P06、B21 和 CTA。',
        missedRequiredIds,
      ),
    );
  }

  const semanticNodeIds = ['N1', 'N2', 'N3', 'N4'];
  const semanticNodes = semanticNodeIds.map((nodeId, index) => ({
    nodeId,
    captionId: b07Segments[index].captionId,
    startMs: b07Segments[index].startMs,
    endMs: b07Segments[index].endMs,
  }));

  return {
    schemaVersion: 'koubo-director-r10-lanzhou-regression/v1',
    status:
      diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length === 3
        ? 'regression-confirmed'
        : 'source-changed-review-required',
    evidence: {
      b07Segments,
      postshootCollapsedWindow,
      p02: {
        layerId: p02Layer.id,
        startMs: p02StartMs,
        endMs: p02EndMs,
        assetAudioMuted,
        entrySfxCueIds,
        actions: p02Actions,
        internalActionSfxBoundCount,
      },
      preview: {
        rangesMs,
        missedRequiredIds,
      },
    },
    diagnostics,
    repairAnchors: {
      precisionPolicy: 'segment-boundaries-only',
      semanticNodes,
      p02ActionBoundariesMs: p02Actions.map(({actionId, startMs, endMs}) => ({
        actionId,
        startMs,
        endMs,
      })),
    },
  };
};
