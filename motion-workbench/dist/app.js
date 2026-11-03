const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clone = (value) => structuredClone(value);
const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const DRAFT_KEY = 'koubo-motion-workbench-draft-v1';
let catalog = {effects: []};
let examples = [];
let state = null;
let revision = 0;
let category = 'all';
let query = '';
let material = 'all';
let dirty = false;
let generation = 0;
let saveTimer;
let savePromise = null;
let saveBlocked = false;
let saveError = '';
let conflict = false;
let activePreviewId = null;
let editingSelectionId = null;
let pendingAddEffectId = null;
let anchorTargetId = null;
let reviewTarget = null;
let reviewAt = 0;
let recoveryDraft = null;
let toastTimer;
const effectById = (id) => catalog.effects.find((effect) => effect.id === id);
const activeEpisode = () => state?.episodes.find((episode) => episode.id === state.activeEpisodeId) || null;
const activeSelection = (id) => activeEpisode()?.selections.find((selection) => selection.id === id);
const categorySymbols = {all:'▦',favorites:'☆',split:'◫',pip:'▣',type:'字',chapter:'§',transition:'↔',spotlight:'◎',comparison:'▥',diagram:'⌘',cards:'▤',collage:'◩'};
const requiredVideo = (effect) => !['unused','optional'].includes(effect.videoRequirement);

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : data.message || `请求未成功（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function setSaveStatus() {
  const element = $('#save-status');
  element.classList.toggle('failed', saveBlocked);
  element.classList.toggle('unsaved', dirty && !saveBlocked);
  element.lastElementChild.textContent = !state ? '正在读取…' : saveBlocked ? (conflict ? '其他页面已有修改，当前草稿尚未保存' : `保存未成功：${saveError}`) : savePromise ? '正在保存到本机…' : dirty ? '有修改待保存…' : '已保存到本机';
  $('#save-actions').hidden = !saveBlocked;
  $('#retry-save').hidden = conflict;
  const hasSelection = !!activeEpisode()?.selections.length;
  $('#export-md').disabled = !hasSelection || saveBlocked;
  $('#export-json').disabled = !hasSelection || saveBlocked;
}

function persistDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({baseRevision:revision,updatedAt:new Date().toISOString(),state})); }
  catch { /* Disk save remains authoritative; beforeunload still protects active edits. */ }
}

function changeState(change, {render = true} = {}) {
  if (!state) return;
  change(state);
  generation += 1;
  dirty = true;
  persistDraft();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushSave().catch(() => {}), 450);
  if (render) renderAll(); else setSaveStatus();
}

async function flushSave() {
  clearTimeout(saveTimer);
  if (saveBlocked) throw new Error(saveError || '请先处理保存冲突。');
  if (savePromise) {
    await savePromise;
    if (dirty) return flushSave();
    return;
  }
  if (!dirty) return;
  savePromise = (async () => {
    while (dirty) {
      const savedGeneration = generation;
      const snapshot = clone(state);
      const result = await requestJson('/api/state', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({expectedRevision:revision,state:snapshot})});
      const saved = result.state || result;
      revision = saved.revision;
      state.revision = revision;
      dirty = generation !== savedGeneration;
      if (dirty) {
        // Merge only server-owned media identity; never replace newer user input.
        for (const episode of saved.episodes) {
          const liveEpisode = state.episodes.find((entry) => entry.id === episode.id);
          const sentEpisode = snapshot.episodes.find((entry) => entry.id === episode.id);
          for (const selection of episode.selections) {
            const live = liveEpisode?.selections.find((entry) => entry.id === selection.id);
            const sent = sentEpisode?.selections.find((entry) => entry.id === selection.id);
            if (live && sent && live.candidatePath === sent.candidatePath) {
              if ('candidateFingerprint' in selection) live.candidateFingerprint = selection.candidateFingerprint;
              if ('reviewWarning' in selection) live.reviewWarning = selection.reviewWarning;
              if (selection.reviewWarning && !selection.reviewed) live.reviewed = false;
            }
          }
        }
        persistDraft();
      }
      else {
        state = saved;
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* Storage may be disabled. */ }
      }
    }
  })();
  setSaveStatus();
  try { await savePromise; renderPlan(); }
  catch (error) {
    saveBlocked = true;
    saveError = error.message;
    conflict = error.status === 409;
    persistDraft();
    throw error;
  } finally {
    savePromise = null;
    setSaveStatus();
  }
}

function openDialog(id) {
  const dialog = $(id);
  if (!dialog.open) dialog.showModal();
}

function hasDialogDraft(dialog) {
  if (!dialog.open) return false;
  if (dialog.id === 'transcript-dialog') return $('#transcript-text').value !== (activeEpisode()?.transcriptText || '');
  if (dialog.id === 'selection-dialog') {
    const selection = activeSelection(editingSelectionId);
    if (!selection) return false;
    return [['#selection-anchor','anchor'],['#selection-text','text'],['#selection-note','note'],['#candidate-path','candidatePath']].some(([id,key]) => $(id).value.trim() !== (selection[key] || '')) || [['#selection-start','startSec'],['#selection-end','endSec'],['#candidate-sec','candidateSec']].some(([id,key]) => $(id).value !== String(selection[key] ?? ''));
  }
  if (dialog.id === 'episode-dialog') return !!$('#episode-title').value.trim();
  return false;
}

function closeDialog(dialog, force = false) {
  if (!force && hasDialogDraft(dialog) && !confirm('这次编辑尚未保存。确定放弃编辑并关闭吗？')) return;
  if (dialog.id === 'preview-dialog') {
    const video = $('#preview-video');
    video.pause(); video.removeAttribute('src'); video.load();
  }
  if (dialog.id === 'review-dialog') {
    const video = $('#review-video');
    video.pause(); video.removeAttribute('src'); video.load();
    reviewTarget = null;
  }
  dialog.close();
}

function renderNav() {
  const categoryList = [...new Set(catalog.effects.map((effect) => effect.category))];
  const categories = [{id:'all',name:'全部动效',count:catalog.effects.length},{id:'favorites',name:'我的收藏',count:state?.favorites.length || 0},...categoryList.map((id) => ({id,name:catalog.effects.find((effect) => effect.category === id).categoryLabel,count:catalog.effects.filter((effect) => effect.category === id).length}))];
  $('#category-nav').innerHTML = categories.map((item,index) => `${index === 2 ? '<div class="nav-divider" aria-hidden="true"></div>' : ''}<button class="nav-item ${category === item.id ? 'active' : ''}" data-category="${escapeHtml(item.id)}" ${category === item.id ? 'aria-current="true"' : ''}><span class="nav-symbol" aria-hidden="true">${categorySymbols[item.id] || '▦'}</span><span>${escapeHtml(item.name)}</span><span class="nav-count">${item.count}</span></button>`).join('');
  const current = categories.find((item) => item.id === category) || categories[0];
  $('#library-title').innerHTML = `${escapeHtml(current.name)}<span>${current.count}</span>`;
}

function filteredEffects() {
  return catalog.effects.filter((effect) => {
    if (category === 'favorites' && !state?.favorites.includes(effect.id)) return false;
    if (category !== 'all' && category !== 'favorites' && effect.category !== category) return false;
    if (material === 'unused' && effect.videoRequirement !== 'unused') return false;
    if (material === 'required' && !requiredVideo(effect)) return false;
    const searchText = [effect.name,effect.categoryLabel,effect.description,effect.signature,...(Array.isArray(effect.requirements) ? effect.requirements : [effect.requirements || ''])].join(' ').toLowerCase();
    return !query || searchText.includes(query.toLowerCase());
  });
}

function renderGrid() {
  const filtered = filteredEffects();
  const selectedIds = new Set(activeEpisode()?.selections.map((selection) => selection.effectId) || []);
  $('#result-summary').textContent = `显示 ${filtered.length} 个效果${query ? ` · “${query}”` : ''}`;
  $('#empty-results').hidden = filtered.length > 0;
  $('#effect-grid').innerHTML = filtered.map((effect) => {
    const favorite = state?.favorites.includes(effect.id);
    return `<article class="effect-card"><button class="card-open" data-preview="${escapeHtml(effect.id)}" aria-label="预览${escapeHtml(effect.name)}"><div class="card-image"><img src="${escapeHtml(effect.posterUrl)}" alt="${escapeHtml(effect.name)}效果封面" loading="lazy" decoding="async"><span class="image-fallback" hidden>${escapeHtml(effect.name)}<br><small>封面暂不可用，点开看示例</small></span>${selectedIds.has(effect.id) ? '<span class="selection-indicator">已选入本期</span>' : ''}<span class="card-duration">${Number(effect.duration) || '—'} 秒</span><span class="card-play"><svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0 10 6 0 12Z"></path></svg></span></div><div class="card-copy"><h2>${escapeHtml(effect.name)}</h2><div class="card-bottom"><span>${escapeHtml(effect.categoryLabel)}</span><span class="material-tag">${requiredVideo(effect) ? '需要人物素材' : '讲解型画面'}</span></div></div></button><button class="card-favorite ${favorite ? 'is-favorite' : ''}" data-favorite="${escapeHtml(effect.id)}" aria-label="${favorite ? '取消收藏' : '收藏'}${escapeHtml(effect.name)}" aria-pressed="${!!favorite}">${favorite ? '★' : '☆'}</button></article>`;
  }).join('');
  $$('.card-image img').forEach((image) => image.addEventListener('error', () => {
    image.hidden = true;
    image.parentElement.classList.add('image-failed');
    $('.image-fallback',image.parentElement).hidden = false;
  }, {once:true}));
}

function renderPlan() {
  const episode = activeEpisode();
  $('#episode-select').innerHTML = state?.episodes.length ? state.episodes.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</option>`).join('') : '<option value="">尚未创建本期</option>';
  $('#episode-select').value = episode?.id || '';
  $('#edit-transcript').disabled = !episode;
  $('#transcript-summary').textContent = episode?.transcriptText?.trim() ? `已录入 ${episode.transcriptText.length} 字 · 点击查看` : '粘贴或导入，方便选择原句';
  const selections = episode?.selections || [];
  $('#selection-count').textContent = selections.length;
  $('#mobile-count').textContent = selections.length;
  $('#selection-list').innerHTML = selections.length ? selections.map((selection,index) => {
    const effect = effectById(selection.effectId);
    const status = selection.reviewed ? '已确认' : selection.candidatePath ? '候选待看' : selection.anchor.trim() ? '待制作' : '待绑定';
    return `<article class="selected-card"><div class="selected-top"><span class="selected-number">${String(index + 1).padStart(2,'0')}</span><strong>${escapeHtml(effect?.name || '目录中暂未找到此效果')}</strong><span class="selection-status ${selection.reviewed ? '' : 'pending'}">${status}</span></div><p class="selection-anchor ${selection.anchor ? '' : 'empty'}">${escapeHtml(selection.anchor || '还未绑定原句，点击编辑补充。')}</p>${selection.reviewWarning ? `<p class="selection-warning">${escapeHtml(selection.reviewWarning)}</p>` : ''}<div class="selected-actions"><button class="text-button" data-edit="${escapeHtml(selection.id)}">编辑</button>${selection.candidatePath ? `<button class="text-button" data-review="${escapeHtml(selection.id)}">回看片段 ↗</button>` : ''}<button class="text-button remove-selection" data-remove="${escapeHtml(selection.id)}" aria-label="移除${escapeHtml(effect?.name || '此动效')}">移除</button></div></article>`;
  }).join('') : `<div class="plan-empty"><div class="empty-plan-icon" aria-hidden="true">＋</div><h3>${episode ? '给这期选一个好动作' : '从这一期开始'}</h3><p>${episode ? '点开左侧动效看示例，<br>喜欢的就「加入本期」。' : '创建本期方案，<br>把选中的动效与原句放在一起。'}</p></div>`;
  setSaveStatus();
}

function renderAll() { renderNav(); renderGrid(); renderPlan(); }

function toggleFavorite(id) {
  changeState((current) => { current.favorites = current.favorites.includes(id) ? current.favorites.filter((entry) => entry !== id) : [...current.favorites,id]; });
  if (activePreviewId === id) updatePreviewFavorite();
}

function updatePreviewFavorite() {
  const favorite = state?.favorites.includes(activePreviewId);
  $('#preview-favorite').textContent = favorite ? '★ 已收藏' : '☆ 收藏这个效果';
  $('#preview-favorite').setAttribute('aria-pressed', String(!!favorite));
}

function openPreview(id) {
  const effect = effectById(id);
  if (!effect) return;
  activePreviewId = id;
  $('#preview-title').textContent = effect.name;
  $('#preview-category').textContent = effect.categoryLabel;
  $('#preview-signature').textContent = effect.signature || effect.description || '请播放完整示例，观察动作与停留。';
  let requirements = Array.isArray(effect.requirements) ? effect.requirements : [effect.requirements].filter(Boolean);
  if (!requirements.length) requirements = [requiredVideo(effect) ? '需要本期人物素材，拍后再核对遮挡与字幕区域。' : '准备这段要表达的真实文字、数字或图片。'];
  $('#preview-requirements').innerHTML = requirements.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  $('#preview-duration').textContent = `${Number(effect.duration) || '—'} 秒`;
  $('#preview-official').href = effect.officialUrl;
  $('#preview-error-link').href = effect.officialUrl;
  $('#preview-error').hidden = true;
  const video = $('#preview-video');
  video.poster = effect.posterUrl || '';
  video.src = effect.previewUrl;
  video.preload = 'metadata';
  video.load();
  updatePreviewFavorite();
  openDialog('#preview-dialog');
  video.play().catch(() => {});
}

function newEpisode() {
  $('#episode-title').value = '';
  openDialog('#episode-dialog');
  $('#episode-title').focus();
}

function addEffect(id) {
  if (!activeEpisode()) { pendingAddEffectId = id; newEpisode(); return; }
  const selection = {id:uid('selection'),effectId:id,anchor:'',text:'',note:'',startSec:null,endSec:null,candidatePath:'',candidateSec:null,reviewed:false};
  changeState(() => { activeEpisode().selections.push(selection); activeEpisode().updatedAt = new Date().toISOString(); });
  if ($('#preview-dialog').open) closeDialog($('#preview-dialog'));
  openSelection(selection.id);
  toast('已加入本期，可以补充原句与动作要求。');
}

function openSelection(id) {
  const selection = activeSelection(id);
  if (!selection) return;
  editingSelectionId = id;
  $('#selection-title').textContent = effectById(selection.effectId)?.name || '编辑本期动效';
  $('#selection-anchor').value = selection.anchor || '';
  $('#selection-text').value = selection.text || '';
  $('#selection-note').value = selection.note || '';
  $('#selection-start').value = selection.startSec ?? '';
  $('#selection-end').value = selection.endSec ?? '';
  $('#candidate-path').value = selection.candidatePath || '';
  $('#candidate-sec').value = selection.candidateSec ?? '';
  $('#selection-error').textContent = '';
  openDialog('#selection-dialog');
}

function openTranscript(target = null) {
  if (!activeEpisode()) { newEpisode(); return; }
  anchorTargetId = target;
  $('#transcript-text').value = activeEpisode().transcriptText || '';
  $('#apply-anchor').hidden = !target;
  $('#transcript-hint').textContent = target ? '在上方选中要绑定的原句，然后点击「使用选中的原句」。' : '正文仅用于定位，保留实际说法和字幕内容。';
  updateTranscriptCount();
  openDialog('#transcript-dialog');
}

function updateTranscriptCount() { $('#transcript-count').textContent = `${$('#transcript-text').value.length} 字`; }

function saveTranscript() {
  if (!activeEpisode()) return;
  const value = $('#transcript-text').value;
  changeState(() => { activeEpisode().transcriptText = value; activeEpisode().updatedAt = new Date().toISOString(); });
}

function renderHistory() {
  $('#history-list').innerHTML = examples.length ? examples.map((example,index) => `<article class="history-item"><div><h3>${escapeHtml(example.title || example.name || '历史实片')}</h3><p>${escapeHtml(example.description || example.source || '已完成的历史示例，仅用于观看参考。')}</p></div><button class="button button-small" data-history="${index}">播放实片 ↗</button></article>`).join('') : '<div class="plan-empty"><h3>暂未绑定历史实片</h3><p>可以先通过动效库查看官方示例。</p></div>';
}

function showReview({path,title,timeSec = 0,selectionId = null,description = ''}) {
  reviewTarget = selectionId;
  reviewAt = Math.max(0,Number(timeSec) || 0);
  $('#review-title').textContent = title;
  $('#review-kicker').textContent = selectionId ? '本期候选回看' : '历史实片 · 仅作参考';
  $('#review-message').textContent = description || (selectionId ? '正常速度观看本段，核对动作、文字、真人与字幕，再确认。' : '这是历史实片参考，不代表本期已采用或验收。');
  $('#review-error').textContent = '';
  $('#review-confirm').hidden = !selectionId;
  $('#review-confirm').disabled = true;
  const video = $('#review-video');
  video.src = `/api/media?path=${encodeURIComponent(path)}`;
  video.load();
  openDialog('#review-dialog');
}

function download(data,name,type = 'application/json') {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data,null,2)], {type:`${type};charset=utf-8`});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function backupState() {
  if (!state) return;
  download({kind:'口播动效工作台备份',createdAt:new Date().toISOString(),containsUnsavedChanges:dirty,baseRevision:revision,state},`口播动效方案备份_${new Date().toISOString().slice(0,10)}${dirty ? '_含未保存草稿' : ''}.json`);
  toast(dirty ? '已导出当前草稿备份，其中包含未保存修改。' : '已导出全部本机方案。');
}

async function exportEpisode(format) {
  const episode = activeEpisode();
  if (!episode) return;
  try {
    await flushSave();
    if (dirty || saveBlocked) throw new Error('当前修改尚未保存，请先处理保存问题。');
    const response = await fetch(`/api/export?episode=${encodeURIComponent(episode.id)}&format=${format}`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || '导出失败，请稍后重试。');
    }
    download(await response.text(), `${episode.title.replace(/[\\/:*?"<>|]/g,'_')}_动效选择清单.${format}`, format === 'md' ? 'text/markdown' : 'application/json');
    toast('已导出本期选择清单，制作与验收状态保留。');
  } catch (error) { toast(error.message); }
}

async function importBackup(file) {
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('备份文件超过 5 MB，请检查文件。');
    const parsed = JSON.parse(await file.text());
    const imported = parsed.state || parsed;
    if (imported.schemaVersion !== 1 || !Array.isArray(imported.episodes) || !Array.isArray(imported.favorites)) throw new Error('这不是可识别的工作台备份。');
    const existing = new Map(state.episodes.map((episode) => [episode.id,episode]));
    for (const episode of imported.episodes) {
      if (!episode.id || typeof episode.title !== 'string' || !Array.isArray(episode.selections)) throw new Error('备份中的期次格式不完整。');
      if (existing.has(episode.id) && JSON.stringify(existing.get(episode.id)) !== JSON.stringify(episode)) throw new Error(`“${episode.title}”已有不同版本；未导入、未覆盖。请保留备份后核对版本。`);
      for (const selection of episode.selections) if (!effectById(selection.effectId)) throw new Error('备份引用了当前目录之外的动效，未导入。');
    }
    const additions = imported.episodes.filter((episode) => !existing.has(episode.id));
    if (!confirm(`恢复备份将补入 ${additions.length} 期方案及收藏，保留当前已有方案。继续吗？`)) return;
    changeState((current) => {
      current.episodes.push(...clone(additions));
      current.favorites = [...new Set([...current.favorites,...imported.favorites.filter((id) => effectById(id))])];
      if (!current.activeEpisodeId) current.activeEpisodeId = additions[0]?.id || null;
    });
    await flushSave();
    toast('备份已恢复并保存到本机。');
  } catch (error) { toast(error.message); }
}

function showRecovery() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return; }
  if (!stored?.state || !Array.isArray(stored.state.episodes)) return;
  if (JSON.stringify({...stored.state,revision}) === JSON.stringify(state)) { localStorage.removeItem(DRAFT_KEY); return; }
  recoveryDraft = stored;
  const sameRevision = stored.baseRevision === revision;
  $('#recovery-banner').innerHTML = `<span>${sameRevision ? '发现上次未保存的本机草稿。' : '发现旧草稿，磁盘已有更新；为避免覆盖，请先下载草稿核对。'}</span>${sameRevision ? '<button id="restore-draft" class="text-button">恢复草稿</button>' : ''}<button id="download-recovery" class="text-button">下载草稿</button><button id="dismiss-recovery" class="text-button">使用磁盘版本</button>`;
  $('#recovery-banner').hidden = false;
}

$('#category-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]'); if (!button) return;
  category = button.dataset.category; renderNav(); renderGrid();
});
$('#search').addEventListener('input', (event) => { query = event.target.value.trim(); renderGrid(); });
$('#material-filter').addEventListener('change', (event) => { material = event.target.value; renderGrid(); });
$('#reset-filters').addEventListener('click', () => { category='all'; query=''; material='all'; $('#search').value=''; $('#material-filter').value='all'; renderAll(); });
$('#effect-grid').addEventListener('click', (event) => {
  const favorite = event.target.closest('[data-favorite]'); if (favorite) { toggleFavorite(favorite.dataset.favorite); return; }
  const preview = event.target.closest('[data-preview]'); if (preview) openPreview(preview.dataset.preview);
});
$('#preview-favorite').addEventListener('click', () => toggleFavorite(activePreviewId));
$('#preview-add').addEventListener('click', () => addEffect(activePreviewId));
$('#preview-video').addEventListener('error', () => { if ($('#preview-dialog').open) $('#preview-error').hidden = false; });
$('#new-episode').addEventListener('click', newEpisode);
$('#episode-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const title = $('#episode-title').value.trim(); if (!title) return;
  const id = uid('episode'); const now = new Date().toISOString();
  changeState((current) => { current.episodes.push({id,title,transcriptText:'',createdAt:now,updatedAt:now,selections:[]}); current.activeEpisodeId=id; });
  closeDialog($('#episode-dialog'), true);
  if (pendingAddEffectId) { const effectId = pendingAddEffectId; pendingAddEffectId = null; addEffect(effectId); }
  toast('已创建本期方案。');
});
$('#episode-select').addEventListener('change', (event) => { changeState((current) => { current.activeEpisodeId = event.target.value || null; }); });
$('#selection-list').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit]'); if (edit) { openSelection(edit.dataset.edit); return; }
  const remove = event.target.closest('[data-remove]'); if (remove) {
    const selection = activeSelection(remove.dataset.remove);
    if (!selection || !confirm(`从本期移除“${effectById(selection.effectId)?.name || '此动效'}”？库中的效果和收藏会保留。`)) return;
    changeState(() => { activeEpisode().selections = activeEpisode().selections.filter((item) => item.id !== selection.id); activeEpisode().updatedAt = new Date().toISOString(); }); return;
  }
  const review = event.target.closest('[data-review]'); if (review) {
    const selection = activeSelection(review.dataset.review);
    showReview({path:selection.candidatePath,title:effectById(selection.effectId)?.name || '本期候选片段',timeSec:selection.candidateSec,selectionId:selection.id});
  }
});
$('#selection-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const selection = activeSelection(editingSelectionId); if (!selection) return;
  const numberOrNull = (id) => $(id).value.trim() === '' ? null : Number($(id).value);
  const startSec = numberOrNull('#selection-start'); const endSec = numberOrNull('#selection-end'); const candidateSec = numberOrNull('#candidate-sec');
  if ([startSec,endSec,candidateSec].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) { $('#selection-error').textContent='时间须为零或正数，也可以留空。'; return; }
  if ((startSec === null) !== (endSec === null) || (startSec !== null && endSec <= startSec)) { $('#selection-error').textContent='实录起止时间须一起填写，结束时间须晚于开始时间；也可以都留空。'; return; }
  const candidatePath = $('#candidate-path').value.trim();
  if (candidateSec !== null && !candidatePath) { $('#selection-error').textContent='填写候选片定位时间前，请先填写候选视频路径。'; return; }
  if (candidatePath && (!/^(edit|outputs)\/.+\.(mp4|webm|mov)$/i.test(candidatePath) || candidatePath.split('/').includes('..'))) { $('#selection-error').textContent='请填写 edit/ 或 outputs/ 下的视频相对路径。'; return; }
  const updates = {anchor:$('#selection-anchor').value.trim(),text:$('#selection-text').value.trim(),note:$('#selection-note').value.trim(),startSec,endSec,candidatePath,candidateSec};
  const changed = Object.entries(updates).some(([key,value]) => selection[key] !== value);
  const mediaChanged = selection.candidatePath !== candidatePath;
  changeState(() => { Object.assign(selection,updates); if (changed) selection.reviewed=false; if (mediaChanged) { selection.candidateFingerprint=''; selection.reviewWarning=''; } activeEpisode().updatedAt=new Date().toISOString(); });
  closeDialog($('#selection-dialog'));
  toast('已更新本期动效。');
});
$('#edit-transcript').addEventListener('click', () => openTranscript());
$('#pick-anchor').addEventListener('click', () => openTranscript(editingSelectionId));
$('#transcript-text').addEventListener('input', updateTranscriptCount);
$('#save-transcript').addEventListener('click', () => { saveTranscript(); closeDialog($('#transcript-dialog')); toast('正文已加入本期。'); });
$('#apply-anchor').addEventListener('click', () => {
  const textarea=$('#transcript-text'); const selected=textarea.value.slice(textarea.selectionStart,textarea.selectionEnd).trim();
  if (!selected) { toast('请先在正文中选中一句话。'); return; }
  saveTranscript();
  if (anchorTargetId === editingSelectionId) $('#selection-anchor').value=selected;
  closeDialog($('#transcript-dialog'));
  toast('已填入原句，保存动效后生效。');
});
$('#import-transcript').addEventListener('click', () => $('#transcript-file').click());
$('#transcript-file').addEventListener('change', async (event) => {
  const file=event.target.files?.[0]; event.target.value=''; if (!file) return;
  if (file.size > 2*1024*1024) { toast('正文文件超过 2 MB，请使用较小的文本文件。'); return; }
  if ($('#transcript-text').value.trim() && !confirm('用导入文件替换当前编辑框中的正文？保存之前不会覆盖本期已保存正文。')) return;
  $('#transcript-text').value=await file.text(); updateTranscriptCount(); toast('已读取文件，请检查后保存正文。');
});
$('#history-button').addEventListener('click', () => { renderHistory(); openDialog('#history-dialog'); });
$('#history-list').addEventListener('click', (event) => {
  const button=event.target.closest('[data-history]'); if (!button) return;
  const example=examples[Number(button.dataset.history)];
  showReview({path:example.path || example.candidatePath,title:example.title || example.name || '历史实片',timeSec:example.timeSec ?? example.startSec ?? example.candidateSec ?? 0,description:example.description || (typeof example.source === 'string' ? example.source : '')});
});
$('#review-video').addEventListener('loadedmetadata', () => {
  const video=$('#review-video');
  if (Number.isFinite(video.duration) && reviewAt >= video.duration) { $('#review-error').textContent='指定位置超出视频时长，请修改定位时间。'; return; }
  video.currentTime=reviewAt;
  const selection=reviewTarget && activeSelection(reviewTarget);
  const ready=!!(selection && selection.anchor?.trim() && selection.startSec !== null && selection.endSec !== null && selection.candidatePath && selection.candidateSec !== null);
  $('#review-confirm').disabled=!ready;
  if (selection && !ready) $('#review-message').textContent='可以先观看。确认前请在编辑中补齐原句、实录起止时间和候选片定位时间。';
});
$('#review-video').addEventListener('error', () => { if (!$('#review-dialog').open) return; $('#review-error').textContent='暂时无法读取这段视频，请核对路径、文件和访问范围。'; $('#review-confirm').disabled=true; });
$('#review-seek').addEventListener('click', () => { $('#review-video').currentTime=reviewAt; $('#review-video').play().catch(() => {}); });
$('#review-confirm').addEventListener('click', async () => {
  const selection=activeSelection(reviewTarget); if (!selection) return;
  changeState(() => { selection.reviewed=true; activeEpisode().updatedAt=new Date().toISOString(); });
  try { await flushSave(); closeDialog($('#review-dialog')); toast('已保存你对这段效果的确认。'); }
  catch { toast('确认尚未保存，请先处理保存提示。'); }
});
$('#export-md').addEventListener('click', () => exportEpisode('md'));
$('#export-json').addEventListener('click', () => exportEpisode('json'));
$('#backup-state').addEventListener('click', backupState);
$('#draft-backup').addEventListener('click', backupState);
$('#import-backup').addEventListener('click', () => $('#backup-file').click());
$('#backup-file').addEventListener('change', (event) => { const file=event.target.files?.[0]; event.target.value=''; importBackup(file); });
$('#retry-save').addEventListener('click', async () => { saveBlocked=false; saveError=''; conflict=false; try { await flushSave(); toast('已保存到本机。'); } catch (error) { toast(error.message); } });
$('#reload-state').addEventListener('click', async () => {
  if (dirty && !confirm('将先下载当前草稿备份，再读取磁盘最新版本。未保存修改不会覆盖磁盘。继续吗？')) return;
  if (dirty) backupState();
  try {
    const latest=await requestJson('/api/state'); state=latest.state || latest; revision=state.revision; dirty=false; saveBlocked=false; conflict=false; saveError='';
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* Storage may be disabled. */ }
    renderAll(); toast('已读取磁盘最新版本，原草稿已下载备份。');
  } catch (error) { toast(error.message); }
});
$('#recovery-banner').addEventListener('click', (event) => {
  if (event.target.id === 'download-recovery') download(recoveryDraft,'口播动效_恢复草稿.json');
  if (event.target.id === 'restore-draft' && recoveryDraft.baseRevision === revision) { state=clone(recoveryDraft.state); changeState(() => {}); $('#recovery-banner').hidden=true; toast('已恢复草稿，正在保存。'); }
  if (event.target.id === 'dismiss-recovery') { if (!confirm('使用磁盘版本并移除浏览器中的恢复草稿？需要保留时请先下载草稿。')) return; localStorage.removeItem(DRAFT_KEY); $('#recovery-banner').hidden=true; recoveryDraft=null; }
});
$('#mobile-plan').addEventListener('click', () => { $('#episode-panel').classList.add('open'); $('#close-mobile-plan').focus(); });
$('#close-mobile-plan').addEventListener('click', () => $('#episode-panel').classList.remove('open'));
$$('.dialog-close').forEach((button) => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
$$('dialog').forEach((dialog) => {
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(dialog); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect=dialog.getBoundingClientRect(); if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) closeDialog(dialog); } });
});
window.addEventListener('beforeunload', (event) => { if (dirty || savePromise || $$('dialog[open]').some(hasDialogDraft)) { event.preventDefault(); event.returnValue=''; } });

async function initialize() {
  try {
    const [catalogResult,stateResult,examplesResult]=await Promise.all([requestJson('/api/catalog'),requestJson('/api/state'),requestJson('/api/examples').catch(() => [])]);
    catalog=catalogResult; state=stateResult.state || stateResult; revision=state.revision;
    examples=Array.isArray(examplesResult) ? examplesResult : examplesResult.examples || [];
    if (!Array.isArray(catalog.effects) || !Array.isArray(state.episodes)) throw new Error('本机目录或方案格式不正确。');
    renderAll(); showRecovery();
  } catch (error) {
    $('#library-error').textContent=`无法读取工作台数据：${error.message}。请检查本机服务后刷新页面。`;
    $('#library-error').hidden=false;
    $('#result-summary').textContent='数据暂不可用';
    $('#save-status').lastElementChild.textContent='尚未连接本机保存服务';
    $('#new-episode').disabled=true;
  }
}
initialize();
