import { installTitlePrism } from './title-prism.js';
import { restoreBody, CARD_STORAGE_KEY } from './body/save.js';
import { createChapterFlow, restoreChapter } from './chapter-flow.js';
import { installGameMusic, getMusicSettings, setMusicSettings, musicCue } from './music/install.js';

installGameMusic();

const MAIN_KEY = CARD_STORAGE_KEY;
const CHAPTER_KEY = 'roc-preview:jinding-full-chapter-v1';
const AUTHOR_UNLOCK_KEY = 'roc-preview:roc-authors-unlocked-v1';
const entry = document.querySelector('#chapter-entry');
const entryMusicHint = document.querySelector('#entry-music-hint');
entryMusicHint?.addEventListener('animationend', event => {
  if (event.animationName === 'entry-music-hint-dismiss') entryMusicHint.remove();
}, { once: true });
installTitlePrism();
const frame = document.querySelector('#chapter-frame');
const curtain = document.querySelector('#chapter-curtain');
const resume = document.querySelector('#continue-case');
const start = document.querySelector('#start-case');
const confirmation = document.querySelector('#new-case-confirmation');
const failure = document.querySelector('#chapter-failure');
const failureMessage = document.querySelector('#failure-message');
const authors = document.querySelector('#authors-panel');
const authorText = authors.querySelector('.author-text');
const authorLock = authors.querySelector('.author-lock');
const settings = document.querySelector('#settings-panel');
const volume = document.querySelector('#music-volume');
const volumeValue = document.querySelector('#music-volume-value');
const muted = document.querySelector('#music-muted');
const effectsVolume = document.querySelector('#effects-volume');
const effectsValue = document.querySelector('#effects-volume-value');
const fullscreen = document.querySelector('#toggle-fullscreen');
const settingsFeedback = document.querySelector('#settings-feedback');
const menu = entry.querySelector('.entry-actions');
let returnFocus = null;
let revealVersion = 0;
let revealTimer = null;
let readyTimer = null;

function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function revealAuthorText() {
  authorText.inert = false;
  authorText.removeAttribute('aria-hidden');
  authorLock.hidden = true;
}
function unlockAuthors() {
  revealAuthorText();
  try { localStorage.setItem(AUTHOR_UNLOCK_KEY, '1'); }
  catch { /* The completed session can still read the author text. */ }
}
function openOverlay(panel, firstFocus) {
  returnFocus = document.activeElement;
  panel.hidden = false;
  entry.inert = true;
  (firstFocus || panel.querySelector('button, input, a[href]'))?.focus();
}
function closeOverlay(panel) {
  panel.hidden = true;
  if (![authors, settings, confirmation, failure].some(item => !item.hidden)) entry.inert = false;
  if (returnFocus?.isConnected && !entry.hidden && !entry.inert) returnFocus.focus();
}
function fail(message, returnToEntry = false) { failureMessage.textContent = message; document.querySelector('#retry-chapter').textContent = returnToEntry ? '返回' : '重试'; openOverlay(failure); }
function renderMusicSettings() {
  const value = getMusicSettings();
  volume.value = Math.round(value.volume * 100);
  volumeValue.value = `${volume.value}%`;
  volumeValue.textContent = `${volume.value}%`;
  effectsVolume.value = Math.round((Number.isFinite(value.effectsVolume) ? value.effectsVolume : 1) * 100);
  effectsValue.value = `${effectsVolume.value}%`;
  effectsValue.textContent = `${effectsVolume.value}%`;
  muted.checked = value.masterMuted || value.muted;
}
function renderDisplaySettings() {
  fullscreen.textContent = document.fullscreenElement ? '窗口' : '全屏';
  fullscreen.disabled = !document.fullscreenEnabled && !document.fullscreenElement;
}
function readMain() { const saved=restoreBody(read(MAIN_KEY));return saved?.state.flow==='cards'?saved.state:null; }
function reveal() {
  const version = ++revealVersion;
  curtain.style.opacity = '0';
  frame.inert=false;
  if (flow.snapshot().mainStarted) {
    const state = readMain();
    if (state && !state.complete) musicCue('month', { month: state.month });
  }
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => { if (version === revealVersion) curtain.hidden = true; }, 500);
}
const initialChapter = restoreChapter(read(CHAPTER_KEY));
if (initialChapter?.stage === 'complete') unlockAuthors();
else if (read(AUTHOR_UNLOCK_KEY) === '1') revealAuthorText();

const flow = createChapterFlow({
  origin: location.origin,
  getFrameSource: () => frame.contentWindow,
  readMain, readMainRaw: () => read(MAIN_KEY),
  initialChapter,
  mainURL:'./board-receipt-preview.html?game=1',
  newRunId: () => crypto.randomUUID(),
  saveChapter(value) {
    try { localStorage.setItem(CHAPTER_KEY, JSON.stringify(value)); }
    catch { /* The main game also handles storage failures without losing live play. */ }
  },
  loadFrame(url) {
    entryMusicHint?.remove();
    revealVersion++; clearTimeout(revealTimer); clearTimeout(readyTimer);
    curtain.hidden = false; curtain.style.opacity = '1';
    confirmation.hidden = failure.hidden = authors.hidden = settings.hidden = true;
    entry.inert = false;
    entry.hidden = true; frame.hidden = false;
    frame.inert=true;
    frame.title = url.includes('prologue') ? 'R.O.C · 赴约' : 'R.O.C · 调查';
    if (url.includes('prologue')) musicCue('entry');
    frame.src = url;
    if (url.includes('board-receipt-preview')) readyTimer = setTimeout(() => {
      if (!flow.snapshot().mainStarted) fail('调查页面暂未就绪，原有资金和阅读记录仍然保留。');
    }, 20000);
  },
  postToFrame: (message, origin) => frame.contentWindow.postMessage(message, origin),
  showEntry({ canContinue, continueLabel }) {
    const returning = entry.hidden;
    musicCue('menu');
    entry.hidden = false; frame.hidden = true; curtain.hidden = true;
    if(frame.getAttribute('src')!=='about:blank')frame.src='about:blank';
    resume.hidden = false; resume.disabled = !canContinue;
    resume.textContent = '继续游戏';
    resume.setAttribute('aria-label', canContinue ? `继续游戏：${continueLabel}` : '继续游戏（暂无存档）');
    resume.title = canContinue ? continueLabel : '';
    start.textContent = '开始游戏';
    if (returning) (canContinue ? resume : start).focus({ preventScroll: true });
  },
  showConfirmation() { openOverlay(confirmation, document.querySelector('#cancel-new-case')); },
  showMissingMain() { fail('调查存档未找到，未重新生成资金记录。你可以返回后选择从邀请函重新开始。', true); },
  revealFrame: reveal,
  endingComplete(){unlockAuthors();flow.menu();},
});

start.addEventListener('click', () => flow.startNew({ confirmed: true }));
resume.addEventListener('click', () => flow.continueCase());
document.querySelector('#confirm-new-case').addEventListener('click', () => flow.startNew({ confirmed: true }));
document.querySelector('#cancel-new-case').addEventListener('click', () => { closeOverlay(confirmation); start.focus(); });
document.querySelector('#retry-chapter').addEventListener('click', () => {
  closeOverlay(failure);
  if (!flow.retry()) flow.menu();
});
frame.addEventListener('load', () => flow.loaded());
frame.addEventListener('error', () => fail('场景暂未载入，原有调查记录仍然保留。'));
window.addEventListener('message', event => { flow.message(event); if (flow.snapshot().mainStarted) clearTimeout(readyTimer); });
document.addEventListener('keydown', event => {
  const activePanel = [failure, confirmation, settings, authors].find(panel => !panel.hidden);
  if (!activePanel) return;
  if (event.key === 'Escape' && activePanel !== failure) { closeOverlay(activePanel); event.preventDefault(); }
  if (event.key === 'Tab') {
    const controls = [...activePanel.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], summary, [tabindex="0"]')]
      .filter(control => !control.inert && control.checkVisibility());
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { last?.focus(); event.preventDefault(); }
    else if (!event.shiftKey && document.activeElement === last) { first?.focus(); event.preventDefault(); }
  }
});
menu.addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
  const items = [...menu.querySelectorAll('button:not(:disabled)')];
  const index = items.indexOf(document.activeElement);
  if (index < 0) return;
  let next = 0;
  if (event.key === 'End') next = items.length - 1;
  if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
  if (event.key === 'ArrowDown') next = (index + 1) % items.length;
  event.preventDefault();
  items[next].focus();
});
document.querySelector('#open-authors').addEventListener('click', () => openOverlay(authors));
document.querySelector('#open-settings').addEventListener('click', () => { renderMusicSettings(); renderDisplaySettings(); openOverlay(settings, volume); });
document.querySelectorAll('[data-close-panel]').forEach(button => button.addEventListener('click', () => closeOverlay(button.closest('.entry-overlay'))));
for (const panel of [authors, settings]) panel.addEventListener('click', event => { if (event.target === panel) closeOverlay(panel); });
volume.addEventListener('input', () => { setMusicSettings({ volume: Number(volume.value) / 100 }); renderMusicSettings(); });
effectsVolume.addEventListener('input', () => { setMusicSettings({ effectsVolume: Number(effectsVolume.value) / 100 }); renderMusicSettings(); });
muted.addEventListener('change', () => { setMusicSettings({ masterMuted: muted.checked, muted: false }); renderMusicSettings(); });
fullscreen.addEventListener('click', async () => {
  settingsFeedback.hidden = true;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    settingsFeedback.textContent = '当前浏览器未能切换全屏。';
    settingsFeedback.hidden = false;
  }
  renderDisplaySettings();
});
document.addEventListener('fullscreenchange', renderDisplaySettings);
window.addEventListener('roc:music-settings-change', renderMusicSettings);
window.addEventListener('pagehide', () => { revealVersion++; clearTimeout(revealTimer); clearTimeout(readyTimer); });
flow.menu();
renderMusicSettings();
