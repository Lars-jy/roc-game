import { createAudioPlayer } from './audio-player.js';
import { VOICE_CLIPS, EFFECT_CLIPS } from './audio-clips.js';
import { SPEAKERS, BRANCHES } from './story.js';
import { createFlowState, currentLine, completeTyping, advance, sitDown, openReceipt, finishDocument, chooseBranch, reopenMenu } from './flow.js';
import { createDocumentViewer } from './document-viewer.js';
import { installGameMusic, musicCue } from '../music/install.js';
installGameMusic();

const SCENES = {
  arrival: { src: './assets/reception/scenes/arrival.png', alt: '进入金鼎财富会客室，陆衡和周岚在场' },
  seated: { src: './assets/reception/scenes/seated.png', alt: '坐下交谈，陆衡在左侧沙发，周岚站在右侧' },
  placing: { src: './assets/reception/scenes/placing.png', alt: '周岚来到你的右侧，将薄回单放在你面前' },
  together: { src: './assets/reception/scenes/together.png', alt: '周岚坐在你的右侧，回单在茶几前沿，陆衡坐在左侧' },
};
const stage = document.querySelector('#reception');
const picture = stage.querySelector('.scene-wrap');
const frames = [...stage.querySelectorAll('.scene-image')];
const caption = stage.querySelector('#dialogue-text');
const panel = stage.querySelector('.dialogue');
const speakerCard = stage.querySelector('.speaker-card');
const speakerName = stage.querySelector('#speaker-name');
const portrait = stage.querySelector('#speaker-avatar');
const nextButton = stage.querySelector('#continue');
const nextLabel = nextButton.querySelector('.continue-label');
const help = stage.querySelector('#demo-help');
const actionArea = stage.querySelector('#action-area');
const menuArea = stage.querySelector('#menu-area');
const loading = stage.querySelector('#loading');
const error = stage.querySelector('#error');
const announcement = stage.querySelector('#announcement');
const parameters = new URLSearchParams(location.search);
const waitForEntry = parameters.get('waitForEntry') === '1';
const integratedGame = parameters.get('game') === '1' && parent !== window;

let state = createFlowState();
let ready = false;
let started = false;
let entryReleased = !waitForEntry;
let transitioning = false;
let transitionVersion = 0;
let seatTransition = null;
let pendingCompletion = null;
let muted = false;
let audioBlocked = false;
let handoffSent = false;
const audio = createAudioPlayer({ voiceVolume: .8 });
const soundButton = document.querySelector('#sound-toggle');
function playAudio(channel, clip) {
  return audio.play(channel, clip).then(result => {
    if (result === 'blocked' && channel === 'voice') {
      audioBlocked = true;
      audio.stop('effect');
      render();
    }
    finishPendingLine();
    return result;
  });
}
function begin() {
  if (!ready || !entryReleased || started) return;
  started = true;
  musicCue('reception');
  lineKey = '';
  apply({ ...createFlowState() });
}
function retryVoice() {
  audioBlocked = false;
  pendingCompletion = null;
  shown = 0;
  typingTime = 0;
  lastFrame = null;
  state = { ...state, typingComplete: false };
  playAudio('voice', VOICE_CLIPS[`${state.group}-${state.index}`]);
  render();
  scheduleAnimation();
}
function clearSeatTransition() {
  seatTransition = null;
  picture.classList.remove('is-seat-dissolving');
  for (const [index, frame] of frames.entries()) {
    frame.style.removeProperty('opacity');
    frame.style.removeProperty('z-index');
    frame.classList.toggle('is-active', index === activeFrame);
    frame.setAttribute('aria-hidden', String(index !== activeFrame));
  }
}

function finishSeatTransition() {
  const transition = seatTransition;
  if (!transition || transition.version !== transitionVersion || !transition.audioDone || !transition.visualDone || document.hidden) return;
  frames[activeFrame].classList.remove('is-active');
  frames[activeFrame].setAttribute('aria-hidden', 'true');
  activeFrame = transition.incomingIndex;
  sceneKey = 'seated';
  picture.setAttribute('aria-label', SCENES.seated.alt);
  clearSeatTransition();
  transitioning = false;
  apply(sitDown(state));
}

function walkToSeat() {
  if (transitioning) return;
  const version = ++transitionVersion;
  transitioning = true;
  lastFrame = null;
  audio.stop('voice');
  const incomingIndex = 1 - activeFrame;
  const incoming = frames[incomingIndex];
  incoming.src = SCENES.seated.src;
  incoming.alt = SCENES.seated.alt;
  incoming.setAttribute('aria-hidden', 'false');
  incoming.classList.add('is-active');
  picture.classList.add('is-seat-dissolving');
  frames[activeFrame].style.opacity = '1';
  frames[activeFrame].style.zIndex = '0';
  incoming.style.opacity = '0';
  incoming.style.zIndex = '1';
  seatTransition = { version, incomingIndex, elapsed: 0, audioDone: false, visualDone: false };
  render();
  scheduleAnimation();
  playAudio('effect', EFFECT_CLIPS['walk-sit']).then(() => {
    if (!seatTransition || version !== transitionVersion) return;
    seatTransition.audioDone = true;
    finishSeatTransition();
  });
}
function finishLine() {
  apply(completeTyping(state));
}
let lineKey = '';
let shown = 0;
let typingTime = 0;
let lastFrame = null;
let animationId = null;
let activeFrame = 0;
let sceneKey = '';
let openDocument = null;
let autoAnnouncedKey = '';
let captionText = null;
let captionLetters = [];
let revealedLetters = 0;
const CHARACTER_MS = 55;
const SEAT_DISSOLVE_START_MS = 700;
const SEAT_DISSOLVE_MS = 1200;

const viewer = createDocumentViewer({
  root: document.querySelector('#document-root'),
  onContinue(id) {
    openDocument = null;
    stage.inert = false;
    apply(finishDocument(state, id));
  },
});

function showScene(key) {
  if (key === sceneKey) return;
  const item = SCENES[key];
  if (!item) return;
  const incoming = frames[1 - activeFrame];
  incoming.src = item.src;
  incoming.alt = item.alt;
  incoming.setAttribute('aria-hidden', 'false');
  incoming.classList.add('is-active');
  frames[activeFrame].classList.remove('is-active');
  frames[activeFrame].setAttribute('aria-hidden', 'true');
  activeFrame = 1 - activeFrame;
  sceneKey = key;
  picture.setAttribute('aria-label', item.alt);
}

function characters() {
  return Array.from(currentLine(state)?.text ?? '');
}

function updateCaption() {
  const text = state.mode === 'menu' ? '接下来想了解什么？' : currentLine(state)?.text ?? '';
  // Lay out the complete line once. Unrevealed glyphs keep their space so that
  // centering and line breaks never move while the sentence is being typed.
  if (text !== captionText) {
    captionText = text;
    captionLetters = Array.from(text, character => {
      const letter = document.createElement('span');
      letter.className = 'caption-glyph';
      letter.textContent = character;
      return letter;
    });
    caption.replaceChildren(...captionLetters);
    revealedLetters = 0;
  }
  const count = state.mode === 'menu' ? captionLetters.length : Math.min(shown, captionLetters.length);
  for (let index = Math.min(count, revealedLetters); index < Math.max(count, revealedLetters); index += 1) {
    captionLetters[index].classList.toggle('is-revealed', index < count);
  }
  revealedLetters = count;
}

function setSpeaker() {
  const id = state.mode === 'menu' ? 'none' : currentLine(state)?.speaker ?? 'none';
  const person = SPEAKERS[id];
  panel.dataset.speaker = id;
  speakerCard.hidden = id === 'none';
  speakerName.textContent = person?.name ?? '';
  portrait.parentElement.hidden = id === 'player' || id === 'none';
  portrait.alt = id === 'player' ? '' : person?.name ?? '';
}

function makeAction(label, action, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `paper-choice action-button ${className}`.trim();
  const title = document.createElement('span');
  title.className = 'choice-label';
  title.textContent = label;
  const mark = document.createElement('span');
  mark.className = 'choice-mark';
  mark.setAttribute('aria-hidden', 'true');
  button.append(title, mark);
  button.addEventListener('click', event => {
    event.stopPropagation();
    action();
  });
  actionArea.replaceChildren(button);
}

function beginInvestigation() {
  if (!integratedGame || handoffSent || !ready || !started || transitioning || viewer.isOpen || state.mode !== 'done') return;
  handoffSent = true;
  pendingCompletion = null;
  audio.stopAll();
  actionArea.hidden = true;
  nextButton.hidden = true;
  menuArea.hidden = true;
  parent.postMessage({
    type: 'prologue:reception-complete',
    readDocs: state.readDocuments.filter(id => ['D01', 'D02', 'D03'].includes(id)),
    visitedBranches: state.visited.filter(id => ['materials', 'lu', 'zhou'].includes(id)),
  }, location.origin);
}

function showMenu() {
  const wrapper = document.createElement('div');
  wrapper.className = 'question-menu';
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', '问询选项');
  BRANCHES.forEach(branch => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'paper-choice question-option';
    const visited = state.visited.includes(branch.id);
    button.dataset.visited = String(visited);
    const title = document.createElement('span');
    title.className = 'option-title';
    title.textContent = branch.label;
    const status = document.createElement('span');
    status.className = 'option-status';
    status.textContent = visited ? branch.id === 'materials' ? '已查看' : '已询问' : '';
    const mark = document.createElement('span');
    mark.className = 'choice-mark';
    mark.setAttribute('aria-hidden', 'true');
    button.append(title, status, mark);
    button.addEventListener('click', event => {
      event.stopPropagation();
      apply(chooseBranch(state, branch.id));
    });
    wrapper.append(button);
  });
  menuArea.replaceChildren(wrapper);
}

function render() {
  window.dispatchEvent(new CustomEvent('roc:voice', { detail: { active: started && state.mode === 'dialogue' } }));
  if (!ready) return;
  panel.hidden = !started || transitioning;
  stage.dataset.transitioning = String(transitioning);
  if (!started) {
    showScene('arrival');
    stage.dataset.mode = 'waiting';
    stage.dataset.typing = 'false';
    nextButton.hidden = true;
    menuArea.hidden = true;
    help.textContent = '';
    actionArea.hidden = !entryReleased;
    if (entryReleased && !waitForEntry) makeAction('点击开始', begin);
    else actionArea.replaceChildren();
    return;
  }
  stage.dataset.mode = state.mode;
  stage.dataset.group = state.group;
  stage.dataset.line = String(state.index);
  stage.dataset.typing = String(!state.typingComplete && state.mode === 'dialogue');
  showScene(state.scene);
  setSpeaker();
  updateCaption();
  if (transitioning) {
    nextButton.hidden = true;
    menuArea.hidden = true;
    actionArea.hidden = true;
    help.textContent = '';
    return;
  }
  if (audioBlocked) {
    nextButton.hidden = true;
    menuArea.hidden = true;
    actionArea.hidden = false;
    makeAction('点击继续并开启声音', retryVoice);
    help.textContent = '浏览器暂停了声音，点击后继续当前对白。';
    return;
  }
  const isDialogue = state.mode === 'dialogue';
  nextButton.hidden = !isDialogue;
  nextLabel.textContent = '继续';
  nextButton.setAttribute('aria-label', state.typingComplete ? '继续' : '显示完整台词');
  help.textContent = isDialogue
    ? '点击补全文字 · 再次点击继续'
    : state.mode === 'menu' ? '顺序由你决定，也可以跳过问询' : '';
  actionArea.hidden = !['sit', 'receipt', 'done'].includes(state.mode);
  menuArea.hidden = state.mode !== 'menu';
  if (state.mode === 'sit') makeAction('点击坐下', walkToSeat);
  else if (state.mode === 'receipt') makeAction('点击回单', () => apply(openReceipt(state)), 'receipt-action');
  else if (state.mode === 'done') makeAction(integratedGame ? '开始调查' : '再问几句', integratedGame ? beginInvestigation : () => apply(reopenMenu(state)));
  else actionArea.replaceChildren();
  if (state.mode === 'menu') showMenu();
  else menuArea.replaceChildren();

  if (state.mode === 'document') {
    if (openDocument !== state.documentId) {
      openDocument = state.documentId;
      audio.stop('voice');
      playAudio('effect', EFFECT_CLIPS['paper-flip']);
      viewer.open(openDocument);
      stage.inert = true;
    }
  } else {
    stage.inert = false;
    if (openDocument !== null) {
      openDocument = null;
      viewer.close();
    }
  }
}

function apply(next) {
  if (next === state) return;
  const previousMode = state.mode;
  state = next;
  const newKey = `${state.group}:${state.index}`;
  if (lineKey !== newKey) {
    pendingCompletion = null;
    audio.stop('voice');
    lineKey = newKey;
    if (state.mode === 'dialogue') {
      playAudio('voice', VOICE_CLIPS[`${state.group}-${state.index}`]);
      if (state.group === 'intro' && state.index === 4) playAudio('effect', EFFECT_CLIPS['place-paper']);
    }
    shown = 0;
    typingTime = 0;
  }
  if (state.typingComplete) shown = characters().length;
  if (state.typingComplete && autoAnnouncedKey !== newKey) {
    autoAnnouncedKey = newKey;
    const name = SPEAKERS[currentLine(state)?.speaker]?.name ?? '';
    announcement.textContent = `${name}：${currentLine(state)?.text ?? ''}`;
  }
  if (state.mode !== 'dialogue') audio.stop('voice');
  render();
  scheduleAnimation();
  if (previousMode !== state.mode && ['sit', 'receipt', 'menu', 'done'].includes(state.mode)) {
    queueMicrotask(() => (state.mode === 'menu' ? menuArea : actionArea).querySelector('button')?.focus({ preventScroll: true }));
  } else if (previousMode === 'document' && state.mode === 'dialogue') {
    queueMicrotask(() => nextButton.focus({ preventScroll: true }));
  }
}

function activateDialogue() {
  if (!ready || !started || audioBlocked || transitioning || viewer.isOpen || state.mode !== 'dialogue') return;
  if (!state.typingComplete) { finishLine(); return; }
  if (pendingCompletion) return;
  const target = advance(state);
  if (target.mode !== 'dialogue' && (audio.busy('voice') || audio.busy('effect'))) pendingCompletion = target;
  else apply(target);
}

function finishPendingLine() {
  if (!pendingCompletion || audioBlocked || document.hidden || audio.busy('voice') || audio.busy('effect')) return;
  const target = pendingCompletion;
  pendingCompletion = null;
  apply(target);
}

function scheduleAnimation() {
  if (document.hidden || animationId !== null) return;
  const hasMotion = seatTransition && !seatTransition.visualDone;
  const hasTyping = ready && started && !audioBlocked && state.mode === 'dialogue' && !state.typingComplete;
  if (hasMotion || hasTyping) animationId = requestAnimationFrame(animate);
  else lastFrame = null;
}

function animate(now) {
  animationId = null;
  const delta = lastFrame === null ? 0 : Math.min(100, Math.max(0, now - lastFrame));
  lastFrame = now;
  if (seatTransition && !document.hidden) {
    seatTransition.elapsed += delta;
    const progress = Math.min(1, Math.max(0, (seatTransition.elapsed - SEAT_DISSOLVE_START_MS) / SEAT_DISSOLVE_MS));
    const eased = progress * progress * (3 - 2 * progress);
    // The opaque old frame under the new one gives a true dissolve without a
    // dark dip halfway through. RAF timing freezes with the suspended sound.
    frames[seatTransition.incomingIndex].style.opacity = String(eased);
    seatTransition.visualDone = progress === 1;
    finishSeatTransition();
  }
  if (ready && started && !audioBlocked && !document.hidden && state.mode === 'dialogue') {
    if (!state.typingComplete) {
      typingTime += delta;
      const count = Math.min(captionLetters.length, Math.floor(typingTime / CHARACTER_MS) + 1);
      if (shown !== count) { shown = count; updateCaption(); }
      if (shown === captionLetters.length) finishLine();
    }
  }
  scheduleAnimation();
}

stage.addEventListener('click', event => {
  if (!event.target.closest('button, a, input')) activateDialogue();
});
nextButton.addEventListener('click', event => {
  event.stopPropagation();
  activateDialogue();
});
document.addEventListener('keydown', event => {
  if (viewer.isOpen || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest('button, a, input, [contenteditable="true"]')) return;
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    activateDialogue();
  }
});
document.addEventListener('visibilitychange', () => {
  lastFrame = null;
  audio.suspend(document.hidden);
  if (document.hidden) {
    cancelAnimationFrame(animationId);
    animationId = null;
  } else {
    finishSeatTransition();
    finishPendingLine();
    scheduleAnimation();
  }
});
soundButton.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  if (muted) audioBlocked = false;
  soundButton.textContent = muted ? '声音：关' : '声音：开';
  soundButton.setAttribute('aria-pressed', String(muted));
  if (!muted && started && state.mode === 'dialogue') playAudio('voice', VOICE_CLIPS[`${state.group}-${state.index}`]);
  render();
});
stage.querySelector('#reload').addEventListener('click', () => location.reload());
stage.querySelector('#restart').addEventListener('click', () => {
  if (!ready || !entryReleased) return;
  transitionVersion += 1;
  clearSeatTransition();
  transitioning = false;
  pendingCompletion = null;
  audioBlocked = false;
  audio.stopAll();
  started = true;
  stage.inert = false;
  viewer.close();
  openDocument = null;
  lineKey = '';
  autoAnnouncedKey = '';
  apply(createFlowState());
  stage.focus({ preventScroll: true });
});

addEventListener('message', event => {
  if (!waitForEntry || event.source !== parent || event.origin !== location.origin || event.data?.type !== 'prologue:start-reception') return;
  // Remember an early parent message until the scene images are ready.
  entryReleased = true;
  begin();
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image failed to load: ${src}`));
    image.src = src;
  });
}

Promise.all([...Object.values(SCENES).map(item => loadImage(item.src)), loadImage('./assets/cast-zodiac.png')])
  .then(() => {
    ready = true;
    loading.hidden = true;
    if (waitForEntry && entryReleased || !waitForEntry && parameters.get('autostart') === '1') begin();
    else render();
    if (parent !== window) parent.postMessage({ type: 'prologue:reception-ready' }, location.origin);
    stage.focus({ preventScroll: true });
  })
  .catch(() => {
    loading.hidden = true;
    error.hidden = false;
  });
addEventListener('pagehide', event => {
  if (event.persisted) return;
  cancelAnimationFrame(animationId);
  animationId = null;
  transitionVersion += 1;
  clearSeatTransition();
  transitioning = false;
  started = false;
  pendingCompletion = null;
  audio.stopAll();
});
