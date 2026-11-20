import { CARDS, CARD_MAP, TASKS, TASK_IDS, QUESTIONS, QUESTION_MAP, getCardDocument } from './data.js';
import { getCardPosition, organizeCards } from './layout.js';
import { getState, dispatch, subscribe, refresh } from '../chapter-session.js';
import { createCardReader, questionAvailable, questionUnavailable, cardCompletion } from '../body/card-flow.js';
import { getDoc } from '../body/content.js';
import { renderDocument } from '../materials.js';
import { OPEN_RESPONSE_FIELDS, OPEN_RESPONSE_LIMIT } from '../open-response.js';
import { isSceneActive, markSceneReady, registerSceneLifecycle } from '../scene-navigation.js';
import { preloadIntegratedEnding, playIntegratedEnding, isIntegratedEndingActive } from '../ending-demo/integrated-ending.js';
import { musicCue } from '../music/install.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const sheet = Number(new URLSearchParams(location.search).get('sheet'));
const isSheet = sheet === 1 || sheet === 2;
const art = (key) => `./assets/investigation-v1/${({ company: 'project', document: 'project' })[key] || key}-v1.png`;
const kindName = (card) => ({ task: '调查', organization: '机构', document: '资料', note: '谈话', conclusion: '结论', account: '账户' })[card.type] || '线索';
let formal = getState();
let state = formal.cardFlow.notebook;
let reader = createCardReader(formal);
let uiKey;
let ui;
let linking = null, drag = null, toastTimer, suppressClick = false, invitationTemplate;
const paperSounds = {
  tap: { file: 'card-tap.m4a', volume: .58, voices: [], next: 0 },
  flip: { file: 'paper-flip.m4a', volume: .3, voices: [], next: 0 },
};
const paperVoiceCount = 4;
let modalFocus, modalVersion = 0, libraryRenderKey = '', taskProgressHTML = '', wiresFrame = null, frontCard = null;
let draftFrame = null, pointer = null, highlighted = null;
const svgNS = 'http://www.w3.org/2000/svg';
const draftWire = document.createElementNS(svgNS, 'line');
draftWire.setAttribute('class', 'wire-draft'); draftWire.setAttribute('hidden', '');
$('#board-wires').append(draftWire);
const wireLines = new Map();
const announcedTopics = new Set();

function loadLayout() {
  uiKey = `jinding-card-chapter-layout-v1:${formal.seed}`;
  ui = { mode: isSheet ? 'review' : 'board', filter: 'all', search: '', placed: [...TASK_IDS], camera: { x: 35, y: 25, scale: .8 } };
  try {
    const saved = JSON.parse(localStorage.getItem(uiKey) || 'null');
    if (Array.isArray(saved?.placed)) ui.placed = [...new Set([...TASK_IDS, ...saved.placed.filter((id) => CARD_MAP[id])])];
    if (saved?.camera && ['x', 'y', 'scale'].every((key) => Number.isFinite(saved.camera[key]))) ui.camera = { ...saved.camera, scale: Math.max(.25, Math.min(1.6, saved.camera.scale)) };
  } catch { /* Layout is optional; formal answers only come from chapter-session. */ }
}
loadLayout();
if (isSheet) document.body.classList.add('sheet-view');

function saveLayout() {
  try { localStorage.setItem(uiKey, JSON.stringify({ placed: ui.placed, camera: ui.camera })); }
  catch { toast('桌面位置暂未保存。'); }
}
function toast(text) {
  clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}
function visible(id) { return Boolean(CARD_MAP[id] && reader.visible(id)); }
function allowed(qId) { return Boolean(QUESTION_MAP[qId] && questionAvailable(formal, qId)); }
function answered(qId) { return reader.answered(qId); }
function taskResult(taskId) {
  const questions = TASKS.find((task) => task.id === taskId)?.questions || [];
  return { total: questions.length, completed: questions.filter((q) => answered(q.id)).length, correct: questions.length > 0 && questions.every((q) => allowed(q.id) && reader.evaluate(q.id).correct) };
}
function act(action) {
  const result = dispatch(action);
  if (result.error) { toast(result.error); return false; }
  if (result.state !== formal) updateState(result.state);
  const newTopics = result.events.filter(event => event.type === 'topic-unlocked' && !announcedTopics.has(event.key));
  if (newTopics.length) {
    for (const topic of newTopics) announcedTopics.add(topic.key);
    toast('您有一条新消息');
  }
  return true;
}
function notebook(operation, extra) { return act({ type: 'notebook', operation, ...extra }); }
function updateState(next) {
  if (next === formal) return;
  const reset = next.seed !== formal.seed;
  formal = next; state = formal.cardFlow.notebook;
  reader = createCardReader(formal);
  if (reset) { announcedTopics.clear(); loadLayout(); endLink(); closeModal(); renderAll(); return; }
  if (linking && (linking.qId && !allowed(linking.qId) || linking.cardId && !visible(linking.cardId))) endLink();
  syncBoardNodes(); updateEvaluations(); updateSummary();
}

function photoHTML(card) {
  if (!visible(card.id)) return '';
  if (card.type === 'document') return `<div class="document-thumb"><span>${esc(card.title)}</span></div>`;
  return card.art ? `<img src="${art(card.art)}" alt="${esc(card.title)}卡面" draggable="false">` : '';
}
function chipsHTML(qId) {
  return (state.links[qId] || []).filter(visible).map((id) => `<span class="linked-chip">${esc(CARD_MAP[id].title)}<button class="unlink-button" data-action="unlink" data-question="${qId}" data-id="${id}" aria-label="断开${esc(CARD_MAP[id].title)}">×</button></span>`).join('');
}
function questionHTML(q) {
  const value = state.values[q.id];
  const controls = q.type === 'number'
    ? `<div class="question-control">${q.fields.map((field) => `<label class="number-field"><span>${esc(field.label)}</span><input class="number-input" type="text" inputmode="decimal" autocomplete="off" maxlength="40" data-question="${q.id}" data-field="${field.id}" aria-label="${esc(`${q.prompt} ${field.label}`)}" value="${esc(value?.[field.id] ?? '')}"><span>${esc(field.unit)}</span></label>`).join('')}</div>`
    : q.type === 'boolean' ? `<div class="question-control"><div class="boolean-toggle" role="group" aria-label="${esc(q.prompt)}"><button data-action="boolean" data-question="${q.id}" data-yes="false" aria-label="否">×</button><button data-action="boolean" data-question="${q.id}" data-yes="true" aria-label="是">✔</button></div></div>` : '';
  return `<li class="question-row" data-row="${q.id}"><span class="question-text"></span>${controls}<span class="question-locked"></span><button class="question-port ${q.type === 'link' ? '' : 'yellow'}" data-action="question-port" data-question="${q.id}" aria-label="连接调查证据"></button><div class="linked-chips">${chipsHTML(q.id)}</div><span class="question-state pending"></span></li>`;
}
function cardHTML(card, { review = false } = {}) {
  if (!visible(card.id)) return '';
  const task = card.type === 'task', result = task ? taskResult(card.id) : null;
  const point = getCardPosition(state, card.id), index = TASK_IDS.indexOf(card.id);
  const pin = task ? 'red' : ['document', 'note', 'conclusion'].includes(card.type) ? 'yellow' : '';
  const mini = ['note', 'conclusion', 'account', 'organization'].includes(card.type);
  return `<article class="investigation-card ${task ? 'task-card' : 'support-card'} ${task || !mini ? 'photo-sheet' : ''} ${mini ? 'note-card' : ''} ${card.type === 'conclusion' ? 'conclusion-card' : ''} kind-${card.kind}" data-node="${card.id}" ${review ? '' : `style="left:${point.x}px;top:${point.y}px"`} aria-label="${esc(card.title)}调查卡"><button class="card-pin node-port ${pin}" data-action="source-port" data-id="${card.id}" aria-label="连接卡片：${esc(card.title)}"></button><header class="card-drag-handle">${!mini ? `<div class="card-photo"><button data-action="art" data-id="${card.id}" aria-label="查看${esc(card.title)}">${photoHTML(card)}</button></div>` : ''}${task ? `<span class="card-serial">0${index + 1}</span>` : ''}<h2 class="card-name">${esc(card.title)}</h2>${task ? `<span class="card-subtitle">${esc(card.subtitle)}</span>` : ''}</header>${task ? `<ol class="question-list">${card.questions.map(questionHTML).join('')}</ol><span class="task-stamp" aria-label="核对完成">✓</span>` : mini && card.type !== 'conclusion' ? `<p class="card-note">${esc(card.type === 'note' ? '谈话摘录' : card.type === 'organization' ? '机构记录' : '账户记录')}</p>` : ''}<footer class="card-footer">${task ? `<span data-task-count="${card.id}">${result.completed} / ${result.total}</span>` : `<span>${esc(kindName(card))}</span>`}<button data-action="read" data-id="${card.id}">${task && card.id !== 'invitation' ? '查看卡面' : '查看记录'}</button>${!review && !task ? `<button data-action="remove-card" data-id="${card.id}" aria-label="收回${esc(card.title)}">收回</button>` : ''}</footer></article>`;
}
function renderReview() {
  const cards = (sheet === 1 ? TASKS.slice(0, 4) : sheet === 2 ? TASKS.slice(4) : TASKS).filter((card) => visible(card.id));
  $('#review-grid').innerHTML = cards.map((card) => cardHTML(CARD_MAP[card.id], { review: true })).join('') || '<p class="locked-sheet">尚未取得这组调查卡。</p>';
}
function renderLibrary() {
  const query = ui.search.trim().normalize('NFKC').toLowerCase();
  const cards = CARDS.filter((card) => visible(card.id))
    .filter((card) => ui.filter === 'all' || card.type === ui.filter || ui.filter === 'evidence' && card.type !== 'task')
    .filter((card) => !query || card.title.normalize('NFKC').toLowerCase().includes(query) || card.document?.toLowerCase() === query);
  $('#library-count').textContent = String(cards.length);
  const key=JSON.stringify([formal.seed,cards.map(card=>card.id),ui.placed,ui.filter,ui.search]);
  if(key===libraryRenderKey)return;libraryRenderKey=key;
  $('#library-list').innerHTML = cards.map((card) => `<div class="library-card${ui.placed.includes(card.id) ? ' is-placed' : ''}" data-library-card="${card.id}"><span class="thumb">${photoHTML(card)}</span><span class="library-card-text"><strong class="library-title">${esc(card.title)}</strong><small class="card-kind">${esc(kindName(card))}</small></span><button class="place-button" data-action="place" data-id="${card.id}" aria-label="${ui.placed.includes(card.id) ? '定位' : '放置'}${esc(card.title)}">${ui.placed.includes(card.id) ? '⌖' : '＋'}</button></div>`).join('') || '<p class="library-empty">暂无匹配的卡片。</p>';
  $$('.library-tabs button').forEach((el) => {
    const active = el.dataset.filter === ui.filter;
    el.classList.toggle('active', active);
    el.setAttribute('aria-pressed', String(active));
  });
}
function renderBoard() {
  $('#board-nodes').innerHTML = ui.placed.filter(visible).map((id) => cardHTML(CARD_MAP[id])).join('');
  bringCardForward(frontCard);
  applyCamera(); scheduleWires();
}
function syncBoardNodes() {
  if (isSheet) renderReview();
  const container = $('#board-nodes');
  for (const element of [...container.children]) if (!visible(element.dataset.node) || !ui.placed.includes(element.dataset.node)) element.remove();
  for (const id of ui.placed.filter(visible)) {
    let node = container.querySelector(`[data-node="${id}"]`);
    if (!node) { container.insertAdjacentHTML('beforeend', cardHTML(CARD_MAP[id])); node = container.lastElementChild; }
    if (drag?.id !== id) { const point = getCardPosition(state, id); node.style.left = `${point.x}px`; node.style.top = `${point.y}px`; }
    node.classList.toggle('is-front',id===frontCard);
  }
}
function renderAll() {
  $('#review-view').hidden = ui.mode !== 'review'; $('#board-view').hidden = ui.mode !== 'board';
  if (isSheet) renderReview();
  renderLibrary(); renderBoard(); updateEvaluations();
}
function renderTaskProgress() {
  const html = TASKS.map((task) => {
    const known = visible(task.id), result = taskResult(task.id), percent = result.total ? result.completed / result.total * 100 : 0;
    return `<div class="task-progress-item${known ? '' : ' is-locked'}${result.completed === result.total ? ' is-complete' : ''}" style="--task-progress:${percent}%"><div class="task-progress-caption"><span>${known ? esc(task.title) : '未解锁'}</span><span class="task-progress-number">${known ? `${result.completed} / ${result.total}` : '🔒'}</span></div><div class="task-progress-track" role="progressbar" aria-label="${known ? esc(task.title) : '未解锁调查'}作答进度" aria-valuemin="0" aria-valuemax="${result.total}" aria-valuenow="${result.completed}"><span></span></div></div>`;
  }).join('');
  if (taskProgressHTML !== html) {
    taskProgressHTML = html;
    $('#task-progress-list').innerHTML = html;
  }
}
function updateEvaluations() {
  for (const task of TASKS.filter((item) => visible(item.id))) {
    const result = taskResult(task.id);
    $$(`[data-node="${task.id}"]`).forEach((el) => {
      el.classList.toggle('is-complete', result.correct);
      const stamp=el.querySelector('.task-stamp');stamp?.classList.toggle('visible',result.correct);stamp?.setAttribute('aria-hidden',String(!result.correct));
      const count = el.querySelector('[data-task-count]'); if (count) count.textContent = `${result.completed} / ${result.total}`;
    });
  }
  for (const q of QUESTIONS) {
    const available = allowed(q.id), result = available ? reader.evaluate(q.id) : { correct: false };
    const reason = available ? '' : questionUnavailable(formal, q.id), future = reason.includes('后续月份');
    $$(`[data-row="${q.id}"]`).forEach((row) => {
      row.classList.toggle('correct', result.correct); row.classList.toggle('is-locked', !available);
      row.querySelector('.question-text').textContent = future ? '后续调查' : q.prompt;
      const lock = row.querySelector('.question-locked'); lock.textContent = reason; lock.hidden = available;
      const mark = row.querySelector('.question-state');mark.textContent=result.correct?'✓':'';mark.className=`question-state ${result.correct?'correct':'pending'}`;
      const port = row.querySelector('.question-port'); port.disabled = !available; port.classList.toggle('correct', result.correct);
      const chips = row.querySelector('.linked-chips');
      const html = available ? chipsHTML(q.id) : '';
      if (chips.innerHTML !== html) chips.innerHTML = html;
      row.querySelectorAll('.question-control').forEach((element) => { element.hidden = !available; });
      row.querySelectorAll('[data-yes]').forEach((button) => { const chosen = state.values[q.id] === (button.dataset.yes === 'true'); button.disabled = !available; button.classList.toggle('selected', chosen); button.setAttribute('aria-pressed', String(chosen)); });
      row.querySelectorAll('[data-field]').forEach((input) => { input.disabled = !available; if (input !== document.activeElement) input.value = state.values[q.id]?.[input.dataset.field] ?? ''; });
    });
  }
  renderTaskProgress(); renderLibrary(); scheduleWires();
}
function applyCamera() {
  const { x, y, scale } = ui.camera;
  $('#board-world').style.transform = `translate(${x}px,${y}px) scale(${scale})`;
  $('#zoom-label').textContent = `${Math.round(scale * 100)}%`;
  if (linking || drag?.type === 'wire') scheduleDraft();
}
function worldPoint(clientX, clientY) {
  const rect = $('#board-world').getBoundingClientRect();
  return { x: (clientX - rect.left) / ui.camera.scale, y: (clientY - rect.top) / ui.camera.scale };
}
function elementPoint(element) { const rect = element.getBoundingClientRect(); return worldPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); }
function scheduleWires() { if(wiresFrame===null)wiresFrame=requestAnimationFrame(()=>{wiresFrame=null;drawWires();}); }
function drawWires() {
  if (ui.mode !== 'board') return;
  const edges = new Map(), points = new Map();
  const rect = $('#board-world').getBoundingClientRect();
  function pointFor(selector) {
    if (!points.has(selector)) {
      const box = $(selector)?.getBoundingClientRect();
      points.set(selector, box && { x: (box.left + box.width / 2 - rect.left) / ui.camera.scale, y: (box.top + box.height / 2 - rect.top) / ui.camera.scale });
    }
    return points.get(selector);
  }
  for (const [qId, ids] of Object.entries(state.links)) {
    if (!allowed(qId)) continue;
    const a = pointFor(`#board-nodes [data-question="${qId}"].question-port`); if (!a) continue;
    for (const id of ids) {
      const b = pointFor(`#board-nodes [data-node="${id}"] .node-port`); if (!b) continue;
      edges.set(`${qId}|${id}`, { qId, id, a, b });
    }
  }
  // Measure all ports before moving any SVG segments on this frame.
  for (const [key, {qId, id, a, b}] of edges) {
    let line = wireLines.get(key);
    if (!line) {
      line = document.createElementNS(svgNS, 'line'); line.setAttribute('class','wire');
      Object.assign(line.dataset, { action: 'unlink', question: qId, id });
      draftWire.before(line); wireLines.set(key, line);
    }
    setEndpoints(line, a, b);
  }
  for (const [key, line] of wireLines) if (!edges.has(key)) { line.remove(); wireLines.delete(key); }
}
function setEndpoints(line, a, b) {
  for (const [name, value] of [['x1',a.x],['y1',a.y],['x2',b.x],['y2',b.y]]) {
    const next = String(value);
    if (line.getAttribute(name) !== next) line.setAttribute(name,next);
  }
}
function clearDraft() {
  draftWire.setAttribute('hidden', '');
  highlighted?.classList.remove('wire-target'); highlighted = null;
}
function targetFor(source, element) {
  if (source.cardId) {
    const row = element?.closest('[data-row]');
    const qId = row?.dataset.row;
    return qId && allowed(qId) && QUESTION_MAP[qId].taskId !== source.cardId ? row : null;
  }
  const card = element?.closest('#board-nodes [data-node], [data-library-card]');
  const id = card?.dataset.node || card?.dataset.libraryCard;
  return id && visible(id) && QUESTION_MAP[source.qId].taskId !== id ? card : null;
}
function scheduleDraft() {
  if (draftFrame !== null) return;
  draftFrame = requestAnimationFrame(() => {
    draftFrame = null;
    const source = drag?.type === 'wire' && drag.moved ? drag : linking;
    if (!source || !pointer) { clearDraft(); return; }
    const port = $(source.qId ? `#board-nodes .question-port[data-question="${source.qId}"]` : `#board-nodes [data-node="${source.cardId}"] .node-port`);
    if (!port) { clearDraft(); return; }
    const target = targetFor(source, document.elementFromPoint(pointer.x, pointer.y));
    if (highlighted !== target) { highlighted?.classList.remove('wire-target'); highlighted = target; highlighted?.classList.add('wire-target'); }
    const end = target?.querySelector(source.cardId ? '.question-port' : '.node-port');
    setEndpoints(draftWire, elementPoint(port), end ? elementPoint(end) : worldPoint(pointer.x, pointer.y));
    draftWire.removeAttribute('hidden');
  });
}
function placeCard(id, { point, focus = true } = {}) {
  if (!visible(id)) return;
  if (!ui.placed.includes(id)) {
    const viewport = $('#board-viewport'), rect = viewport.getBoundingClientRect();
    const center = worldPoint(rect.left + viewport.clientWidth * .58, rect.top + viewport.clientHeight * .35);
    if (!notebook('position', { cardId: id, position: point || center })) return;
    ui.placed.push(id);
  }
  saveLayout(); syncBoardNodes(); updateEvaluations(); if (focus) focusCard(id);
}
function focusCard(id) {
  if (!visible(id)) return;
  bringCardForward(id);
  const point = getCardPosition(state, id); ui.camera.scale = Math.max(.65, ui.camera.scale);
  ui.camera.x = 70 - point.x * ui.camera.scale; ui.camera.y = 35 - point.y * ui.camera.scale;
  applyCamera(); saveLayout();
}
function bringCardForward(id){
  frontCard=id;
  for(const node of $$('#board-nodes [data-node]'))node.classList.toggle('is-front',node.dataset.node===id);
}
function startLink(data) {
  if (data.qId && !allowed(data.qId) || data.cardId && !visible(data.cardId)) return;
  linking = data;
  $('#context-bar').hidden = false; $('#context-bar').textContent = `连线 · ${data.qId ? QUESTION_MAP[data.qId].prompt : CARD_MAP[data.cardId].title}`;
  $('#board-viewport').classList.add('is-linking');
  scheduleDraft();
}
function endLink() { linking = null; clearDraft(); $('#context-bar').hidden = true; $('#board-viewport').classList.remove('is-linking'); }
function finishLink(qId, cardId) {
  if (!allowed(qId) || !visible(cardId)) { toast('尚未取得这项调查所需的线索。'); endLink(); return; }
  if (QUESTION_MAP[qId].taskId === cardId) { toast('请连接另一张卡片。'); return; }
  if (!ui.placed.includes(cardId)) placeCard(cardId, { focus: false });
  notebook('connect', { questionId: qId, cardId }); endLink();
}
function zoomBy(delta, anchor) {
  const viewport = $('#board-viewport'), rect = viewport.getBoundingClientRect();
  const x = anchor?.x ?? rect.left + viewport.clientWidth / 2, y = anchor?.y ?? rect.top + viewport.clientHeight / 2;
  const point = worldPoint(x, y), scale = Math.max(.25, Math.min(1.6, ui.camera.scale + delta));
  ui.camera = { scale, x: x - rect.left - point.x * scale, y: y - rect.top - point.y * scale }; applyCamera(); saveLayout();
}
function fitBoard() {
  const nodes = $$('#board-nodes [data-node]'); if (!nodes.length) return;
  const points = nodes.map((el) => ({ p: getCardPosition(state, el.dataset.node), w: el.offsetWidth, h: el.offsetHeight }));
  const minX = Math.min(...points.map((n) => n.p.x)), minY = Math.min(...points.map((n) => n.p.y)), maxX = Math.max(...points.map((n) => n.p.x + n.w)), maxY = Math.max(...points.map((n) => n.p.y + n.h));
  const viewport = $('#board-viewport'), scale = Math.max(.25, Math.min(1.1, (viewport.clientWidth - 90) / (maxX - minX), (viewport.clientHeight - 100) / (maxY - minY)));
  ui.camera = { scale, x: 40 - minX * scale, y: 35 - minY * scale }; applyCamera(); saveLayout();
}
function modal(title, content, { wide = false } = {}) {
  modalVersion++;
  musicCue(content.includes('id="chapter-summary"') ? 'report-open' : 'report-close');
  if (!$('#overlay').innerHTML) modalFocus = document.activeElement;
  $('#overlay').innerHTML = `<div class="overlay"><section class="document-modal ${wide ? 'wide-modal' : 'node-detail'}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-header"><h2>${esc(title)}</h2><button class="close-button" data-action="close" aria-label="关闭">×</button></header>${content}</section></div>`;
  $('.workbench-header').inert = true; $('#review-view').inert = true; $('#board-view').inert = true;
  $('#overlay .close-button')?.focus({ preventScroll: true });
}
function closeModal() {
  modalVersion++;
  if($('#chapter-summary'))musicCue('report-close');
  const wasOpen = Boolean($('#overlay').innerHTML); $('#overlay').innerHTML = '';
  $('.workbench-header').inert = false; $('#review-view').inert = false; $('#board-view').inert = false;
  if (wasOpen && modalFocus?.isConnected) modalFocus.focus({ preventScroll: true });
}
function playPaper(cue = 'flip') {
  try {
    const clip = paperSounds[cue];
    const index = clip.next;
    let sound = clip.voices[index];
    if (!sound) {
      sound = new Audio(`./assets/reception/audio/${clip.file}`);
      sound.volume = clip.volume;
      clip.voices[index] = sound;
    }
    // Let the next click start on its own voice instead of seeking a playing clip.
    clip.next = (index + 1) % paperVoiceCount;
    sound.pause();
    sound.currentTime = 0;
    sound.play().catch(() => {});
  } catch { /* Audio must not interrupt card interactions. */ }
}
async function readInvitation() {
  if (!visible('invitation')) return;
  const version = ++modalVersion;
  playPaper('tap');
  try {
    invitationTemplate ||= fetch('./invitation-demo.html').then((response) => { if (!response.ok) throw new Error('Invitation unavailable'); return response.text(); }).catch((error) => { invitationTemplate = null; throw error; });
    const html = await invitationTemplate;
    if (version !== modalVersion || !isSceneActive() || !visible('invitation')) return;
    const letter = new DOMParser().parseFromString(html, 'text/html').querySelector('.letter');
    if (!letter) throw new Error('Invitation missing');
    letter.querySelector('footer')?.remove(); letter.removeAttribute('tabindex'); letter.removeAttribute('autofocus');
    modal('邀请函', '<div class="invitation-reading"></div>', { wide: true });
    const shadow = $('.invitation-reading').attachShadow({ mode: 'open' });
    const styles = document.createElement('link'); styles.rel = 'stylesheet'; styles.href = './src/invitation-demo.css';
    const hostStyle = document.createElement('style'); hostStyle.textContent = ':host{display:block;width:min(640px,100%);margin:auto;color:#382f25;font-family:SimSun,"Songti SC",serif}.letter{width:100%;box-sizing:border-box}';
    shadow.append(styles, hostStyle, letter);
    act({ type: 'readInvitation' });
  } catch {
    if (version === modalVersion && isSceneActive()) toast('邀请函暂时未能打开，请再试一次。');
  }
}
function supportDocument(id) {
  const record = getCardDocument(id);
  if (!record) return null;
  if (id === 'company') record.blocks = [{ kind: 'text', title: '机构署名', body: `邀请函发起机构：金鼎财富客户服务组。${formal.read.includes('D06') ? '已查阅的账户关系表登记C户与M户均属于金鼎财富平台。' : ''}` }];
  if (id === 'private-invitation') {
    const snapshot = formal.cardFlow.topicSnapshots.T19;
    const month = (snapshot?.offeredMonth ?? formal.invitation.month) + 4;
    record.blocks = [{ kind: 'text', title: '已记录的邀请', body: `陆衡曾在${month}月发出一次单独认购邀请，登记有效期为该月。首次约定结算在下一月月初，按实际持有天数计算；追加不保证退出获批或优先付款。` }];
  }
  return record;
}
function readCard(id) {
  const card = CARD_MAP[id]; if (!card || !visible(id)) return;
  if (id === 'invitation') { void readInvitation(); return; }
  if (card.type === 'task') { showArt(id); return; }
  const record = card.type === 'document' ? getDoc(formal, card.document || id) : supportDocument(id);
  if (!record) { toast('当前还不能查阅这份资料。'); return; }
  modal(card.title, `<div class="reading-paper">${renderDocument(record)}</div>`, { wide: true }); playPaper();
  if (card.type === 'document') {
    if (id === 'D12B') formal.crises.history.forEach(notice => act({ type:'read',id:'D12B',crisisId:notice.id }));
    else act({ type: 'read', id: card.document || id });
  }
}
function showArt(id) {
  const card = CARD_MAP[id]; if (!card || !visible(id)) return;
  if (id === 'invitation' || card.type === 'document' || !card.art) { readCard(id); return; }
  modal(card.title, `<div class="modal-content"><img class="art-full" src="${art(card.art)}" alt="${esc(card.title)}完整原画"></div>`);
  playPaper('tap');
}

function summaryHTML() {
  const progress = cardCompletion(formal), response = formal.cardFlow.openResponse;
  const value = { ...response.answer, ...response.draft };
  return `<div class="modal-content chapter-summary" id="chapter-summary"><header class="summary-report-heading"><p class="summary-report-kicker">R.O.C · 案卷 07</p><h3>个人调查报告</h3><div class="summary-report-meta"><span>调查人：我</span><span>记录日期：${formal.month + 4}月${formal.finance.day}日</span></div></header><div class="summary-report-scroll" tabindex="0" role="region" aria-label="调查总结正文"><div class="summary-progress-note"><p class="summary-progress"></p><p class="summary-pending"></p></div><div class="summary-fields">${OPEN_RESPONSE_FIELDS.map((field, index) => `<label class="summary-field"><span class="summary-question"><span class="summary-field-number">0${index + 1}</span><span>${esc(field.label)}</span></span><textarea data-summary-field="${field.id}" maxlength="${OPEN_RESPONSE_LIMIT}" rows="4" ${progress.readyForSummary ? '' : 'disabled'}>${esc(value[field.id] || '')}</textarea></label>`).join('')}</div>
    <p class="summary-ending-note">准备好迎接"结局"了么......</p>
    </div><footer class="summary-report-footer"><p class="summary-status" aria-live="polite"></p><div class="summary-actions"><button data-action="submit-summary" class="summary-submit" title="提交调查总结并播放结尾">结局</button><button data-action="export-record">导出调查记录</button></div></footer></div>`;
}
function updateSummary() {
  const box = $('#chapter-summary'); if (!box) return;
  if (isIntegratedEndingActive()) return;
  const progress = cardCompletion(formal), response = formal.cardFlow.openResponse;
  box.querySelector('.summary-progress').textContent = `已作答 ${progress.answered} / ${progress.total}`;
  box.querySelector('.summary-pending').textContent = progress.readyForSummary ? '现在可以整理你的调查结论。' : `还剩 ${progress.total - progress.answered} 个小问未作答。`;
  box.querySelectorAll('[data-summary-field]').forEach((input) => { input.disabled = !progress.readyForSummary; });
  const complete = OPEN_RESPONSE_FIELDS.every((field) => box.querySelector(`[data-summary-field="${field.id}"]`).value.trim());
  box.querySelector('[data-action="submit-summary"]').disabled = !progress.readyForSummary || !complete;
  box.querySelector('.summary-status').textContent = response.answer ? '调查总结已记录。' : '';
}
function openSummary() {
  modal('调查总结', summaryHTML(), { wide: true });
  updateSummary();
  void preloadIntegratedEnding().catch(() => {});
}
function exportRecord() {
  const financeFields = ['cash', 'principal', 'totalInvested', 'totalInterest', 'totalReturned', 'totalLoss', 'unpaidInterest', 'earnedTile'];
  const record = {
    format: 'jinding-player-investigation', version: 1, title: 'R.O.C · 我的调查记录', exportedAt: new Date().toISOString(), date: `${formal.month + 4}月${formal.finance.day}日`,
    funds: { unit: '分', ...Object.fromEntries(financeFields.map((key) => [key, formal.finance[key]])) },
    questions: QUESTIONS.filter((q) => visible(q.taskId) && allowed(q.id)).map((q) => ({ id: q.id, title: CARD_MAP[q.taskId].title, prompt: q.prompt, type: q.type, fields: q.fields?.map(({ id, label, unit }) => ({ id, label, unit })), links: (state.links[q.id] || []).filter(visible).map((id) => ({ id, title: CARD_MAP[id].title })), value: state.values[q.id] ?? null, answered: answered(q.id) })),
    readDocs: formal.read.filter((id) => formal.available.includes(id)),
    summary: Object.fromEntries(OPEN_RESPONSE_FIELDS.map((field) => [field.id, ({...formal.cardFlow.openResponse.answer,...formal.cardFlow.openResponse.draft})[field.id] || ''])),
    submittedSummary: formal.cardFlow.openResponse.answer,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'R.O.C-我的调查记录.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener('click', (event) => {
  if (isIntegratedEndingActive()) { event.preventDefault(); return; }
  if (suppressClick) { suppressClick = false; return; }
  const el = event.target.closest('[data-action]');
  if (el?.disabled) return;
  const card = event.target.closest('.investigation-card, [data-library-card]');
  if (linking && !event.target.closest('input,textarea,a') && (!el || el.dataset.action === 'art')) {
    const target = targetFor(linking, event.target);
    if (target) {
      playPaper('tap');
      finishLink(linking.qId || target.dataset.row, linking.cardId || target.dataset.node || target.dataset.libraryCard);
      return;
    }
  }
  if (card && el?.dataset.action !== 'read' && el?.dataset.action !== 'art') playPaper('tap');
  if (!el) return;
  const { action, id, question: qId } = el.dataset;
  if (action === 'filter') { ui.filter = el.dataset.filter; renderLibrary(); }
  else if (action === 'place') { if (linking?.qId) finishLink(linking.qId, id); else placeCard(id); }
  else if (action === 'read') readCard(id);
  else if (action === 'art') showArt(id);
  else if (action === 'close') closeModal();
  else if (action === 'boolean' && allowed(qId)) notebook('value', { questionId: qId, value: el.dataset.yes === 'true' });
  else if (action === 'unlink' && allowed(qId) && visible(id)) notebook('disconnect', { questionId: qId, cardId: id });
  else if (action === 'remove-card') { ui.placed = ui.placed.filter((cardId) => cardId !== id); saveLayout(); syncBoardNodes(); updateEvaluations(); }
  else if (action === 'question-port' && allowed(qId)) { if (linking?.cardId) finishLink(qId, linking.cardId); else if (linking?.qId === qId) endLink(); else startLink({ qId }); }
  else if (action === 'source-port' && visible(id)) { if (linking?.qId) finishLink(linking.qId, id); else if (linking?.cardId === id) endLink(); else startLink({ cardId: id }); }
  else if (action === 'zoom') zoomBy(Number(el.dataset.delta));
  else if (action === 'fit') fitBoard();
  else if (action === 'organize') {
    const sizes = Object.fromEntries($$('#board-nodes [data-node]').map((node) => [node.dataset.node, { height: node.offsetHeight }]));
    const selected = ui.placed.filter(visible), organized = organizeCards(state, selected, sizes);
    const positions = Object.fromEntries(selected.map(id => [id, organized.positions[id]]));
    if (notebook('arrange', { positions })) { endLink(); fitBoard(); }
  } else if (action === 'reset-view') { endLink(); ui.camera = { x: 35, y: 25, scale: .8 }; applyCamera(); saveLayout(); }
  else if (action === 'summary') openSummary();
  else if (action === 'submit-summary') {
    const value = Object.fromEntries(OPEN_RESPONSE_FIELDS.map((field) => [field.id, $(`[data-summary-field="${field.id}"]`).value]));
    if (act({ type: 'submitConclusion', value })) {
      updateSummary();
      void playIntegratedEnding({ value, report: $('#chapter-summary'), caseSeed: formal.seed }).catch(() => {
        updateSummary();
        const status = $('#chapter-summary .summary-status');
        if (status) status.textContent = '调查总结已保存。结尾暂未播放，请再次提交。';
      });
    }
  } else if (action === 'export-record') exportRecord();
});
document.addEventListener('input', (event) => {
  if (isIntegratedEndingActive()) return;
  if (event.target.id === 'card-search') { ui.search = event.target.value; renderLibrary(); return; }
  const { question, field, summaryField } = event.target.dataset;
  if (question && field && allowed(question)) notebook('value', { questionId: question, value: { [field]: event.target.value } });
  if (summaryField && cardCompletion(formal).readyForSummary) {
    const value = Object.fromEntries(OPEN_RESPONSE_FIELDS.map((item) => [item.id, $(`[data-summary-field="${item.id}"]`).value]));
    act({ type: 'draftConclusion', value }); updateSummary();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !event.isPrimary || drag || ui.mode !== 'board' || $('#overlay').innerHTML) return;
  pointer = { x: event.clientX, y: event.clientY };
  const port = event.target.closest('.question-port,.node-port');
  if (port) {
    if (port.disabled || port.dataset.question && !allowed(port.dataset.question) || port.dataset.id && !visible(port.dataset.id)) return;
    drag = { type: 'wire', qId: port.dataset.question, cardId: port.dataset.id, x: event.clientX, y: event.clientY }; event.preventDefault(); return;
  }
  if (event.target.closest('input,a,button:not([data-action="art"])')) return;
  const library = event.target.closest('[data-library-card]');
  if (library && visible(library.dataset.libraryCard)) { drag = { type: 'library', id: library.dataset.libraryCard, x: event.clientX, y: event.clientY }; event.preventDefault(); return; }
  const card = event.target.closest('#board-nodes .investigation-card');
  if (card && visible(card.dataset.node)) { bringCardForward(card.dataset.node);const p = getCardPosition(state, card.dataset.node); drag = { type: 'card', id: card.dataset.node, el: card, p, x: event.clientX, y: event.clientY }; card.classList.add('is-dragging'); if (!event.target.closest('button')) event.preventDefault(); return; }
  const viewport = event.target.closest('#board-viewport');
  if (viewport) { drag = { type: 'pan', camera: { ...ui.camera }, x: event.clientX, y: event.clientY }; viewport.classList.add('is-dragging'); event.preventDefault(); }
});
document.addEventListener('pointermove', (event) => {
  if (!event.isPrimary) return;
  if (linking || drag?.type === 'wire') { pointer = { x: event.clientX, y: event.clientY }; scheduleDraft(); }
  if (!drag) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (!drag.moved) {
    if (Math.abs(dx) + Math.abs(dy) <= 5) return;
    drag.moved = true;
    if (drag.type !== 'pan') playPaper('tap');
  }
  if (drag.type === 'card') { drag.position = { x: drag.p.x + dx / ui.camera.scale, y: drag.p.y + dy / ui.camera.scale }; drag.el.style.left = `${drag.position.x}px`; drag.el.style.top = `${drag.position.y}px`; scheduleWires(); }
  else if (drag.type === 'pan') { ui.camera.x = drag.camera.x + dx; ui.camera.y = drag.camera.y + dy; applyCamera(); }
  else if (drag.type === 'library') { let ghost = $('.preview-ghost'); if (!ghost) { ghost = document.createElement('div'); ghost.className = 'preview-ghost'; ghost.textContent = CARD_MAP[drag.id].title; document.body.append(ghost); } ghost.style.left = `${event.clientX + 12}px`; ghost.style.top = `${event.clientY + 12}px`; }
});
function stopDrag(event) {
  if (!drag || event.isPrimary === false) return; const ended = drag; drag = null;
  if (ended.moved && event.type !== 'pointercancel') {
    suppressClick = true; setTimeout(() => suppressClick = false, 0);
    if (ended.type === 'wire') {
      const target = targetFor(ended, document.elementFromPoint(event.clientX, event.clientY));
      if (target) finishLink(ended.qId || target.dataset.row, ended.cardId || target.dataset.node || target.dataset.libraryCard);
      else endLink();
    }
    else if (ended.type === 'library') { if (document.elementFromPoint(event.clientX, event.clientY)?.closest('#board-viewport')) placeCard(ended.id, { point: worldPoint(event.clientX, event.clientY), focus: false }); }
    else if (ended.type === 'card') notebook('position', { cardId: ended.id, position: ended.position });
    else saveLayout();
  }
  clearDraft(); ended.el?.classList.remove('is-dragging'); $('#board-viewport').classList.remove('is-dragging'); $('.preview-ghost')?.remove(); syncBoardNodes(); scheduleWires();
}
document.addEventListener('pointerup', stopDrag); document.addEventListener('pointercancel', stopDrag);
window.addEventListener('blur', () => { if (drag) stopDrag({ type: 'pointercancel' }); endLink(); });
$('#board-viewport').addEventListener('wheel', (event) => { event.preventDefault(); zoomBy(event.deltaY < 0 ? .05 : -.05, { x: event.clientX, y: event.clientY }); }, { passive: false });
document.addEventListener('keydown', (event) => {
  if (isIntegratedEndingActive()) { if (event.key === 'Escape') event.preventDefault(); return; }
  if (event.key === 'Escape') { if (drag) stopDrag({ type: 'pointercancel' }); endLink(); closeModal(); }
});
new ResizeObserver(() => { if (ui.mode === 'board') scheduleWires(); }).observe($('#board-viewport'));
subscribe(({ state: next }) => updateState(next));
registerSceneLifecycle({ refresh: () => { refresh(); updateState(getState()); }, activate:ctx=>{
  if(!isIntegratedEndingActive() && new URL(ctx.url||location.href,location.href).searchParams.get('summary')==='1'){
    openSummary();
  }
}, deactivate: () => { endLink(); if (drag) stopDrag({ type: 'pointercancel' }); if(!isIntegratedEndingActive())closeModal(); for (const clip of Object.values(paperSounds)) for (const sound of clip.voices) sound.pause(); saveLayout(); } });
renderAll();
markSceneReady();
