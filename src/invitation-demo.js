import { createAudioPlayer } from './reception/audio-player.js';
import { installGameMusic, musicCue } from './music/install.js';
installGameMusic();
const joined = new URLSearchParams(location.search).get('joined') === '1' && window.parent !== window;
const sounds = createAudioPlayer({ base:'./assets/' });
const gate = document.querySelector('#invitation-start');
const beginButton = document.querySelector('#begin-invitation');
const audioNote = document.querySelector('#invitation-audio-note');
const depart = document.querySelector('#depart-invitation');
const SENTENCE = '那天，你的好朋友周岚向你提起了一个私人投资项目，邀请你加入。';
const stage = document.querySelector('.invitation-stage');
const narration = document.querySelector('#narration');
const sentence = document.querySelector('#intro-sentence');
const envelopeScene = document.querySelector('#envelope-scene');
const envelope = document.querySelector('#open-envelope');
const instruction = document.querySelector('#envelope-instruction');
const reader = document.querySelector('#invitation-reader');
const close = document.querySelector('#close-invitation');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const letters = Array.from(SENTENCE, char => {
  const span = document.createElement('span');
  span.className = 'glyph';
  span.textContent = char;
  span.setAttribute('aria-hidden', 'true');
  return span;
});
sentence.replaceChildren(...letters);
let elapsed = 0;
let last = null;
let frameId = null;
let shown = 0;
let openingTimer = null;
const typedAt = 400 + letters.length * 90;
const fadeAt = typedAt + 1500;
const envelopeAt = fadeAt + 850;
function restart() {
  cancelAnimationFrame(frameId);
  frameId = null;
  clearTimeout(openingTimer);
  reader.close();
  sounds.stopAll();
  gate.hidden = false;
  stage.dataset.phase = 'start';
  elapsed = 0;
  shown = 0;
  last = null;
  narration.hidden = false;
  narration.classList.remove('is-leaving');
  envelopeScene.hidden = true;
  envelope.classList.remove('is-opening');
  envelope.disabled = false;
  instruction.textContent = '点击拆开';
  depart.disabled = false;
  letters.forEach(letter => letter.classList.remove('is-visible'));
}
function reveal() {
  if (stage.dataset.phase === 'narration') { elapsed = Math.max(elapsed, typedAt); sounds.stop('typing'); }
}
function beginInvitation() {
  if (stage.dataset.phase !== 'start') return;
  musicCue('entry');
  gate.hidden = true;
  stage.dataset.phase = 'narration';
  elapsed = 400;
  last = null;
  scheduleNarration();
  sounds.play('typing', {file:'prologue/typewriter.m4a'}).then(result => {
    if (result === 'blocked' && stage.dataset.phase === 'narration') {
      stage.dataset.phase = 'start';
      gate.hidden = false;
      audioNote.hidden = false;
      audioNote.textContent = '声音未能播放，点击开始重试。';
    }
  });
}
beginButton.addEventListener('click', beginInvitation);
function tick(now) {
  frameId = null;
  if (!document.hidden && stage.dataset.phase === 'narration') {
    if (last !== null) elapsed += Math.min(now - last, 100);
    const count = reduced ? letters.length : Math.min(letters.length, Math.max(0, Math.floor((elapsed - 400) / 90) + 1));
    while (shown < count) letters[shown++].classList.add('is-visible');
    if (elapsed >= typedAt) sounds.stop('typing');
    narration.classList.toggle('is-leaving', elapsed >= fadeAt);
    if (elapsed >= envelopeAt) {
      stage.dataset.phase = 'envelope';
      narration.hidden = true;
      envelopeScene.hidden = false;
      envelope.focus({ preventScroll:true });
    }
  }
  last = document.hidden ? null : now;
  scheduleNarration();
}
function scheduleNarration() {
  if (frameId === null && !document.hidden && stage.dataset.phase === 'narration') frameId = requestAnimationFrame(tick);
}
envelope.addEventListener('click', () => {
  if (stage.dataset.phase !== 'envelope') return;
  stage.dataset.phase = 'opening';
  envelope.disabled = true;
  sounds.play('paper', { file:'reception/audio/paper-flip.m4a' });
  envelope.classList.add('is-opening');
  instruction.textContent = '';
  openingTimer = setTimeout(() => {
    if (stage.dataset.phase !== 'opening') return;
    stage.dataset.phase = 'reading';
    reader.showModal();
    reader.querySelector('.letter').focus({ preventScroll:true });
    reader.scrollTop = 0;
  }, reduced ? 0 : 1130);
});
reader.addEventListener('close', () => {
  if (stage.dataset.phase !== 'reading') return;
  stage.dataset.phase = 'envelope';
  envelope.classList.remove('is-opening');
  envelope.disabled = false;
  instruction.textContent = '点击再次查看';
  envelope.focus({ preventScroll:true });
});
close.hidden = joined;
depart.hidden = !joined;
close.addEventListener('click', () => reader.close());
depart.addEventListener('click', () => {
  if (!joined || stage.dataset.phase !== 'reading') return;
  stage.dataset.phase = 'leaving';
  depart.disabled = true;
  sounds.stopAll();
  reader.close();
  window.parent.postMessage({ type:'prologue:invitation-complete' }, location.origin);
});
narration.addEventListener('click', reveal);
document.addEventListener('keydown', event => {
  if (stage.dataset.phase === 'narration' && ['Enter',' '].includes(event.key)) { event.preventDefault(); reveal(); }
});
document.querySelector('#restart-invitation').addEventListener('click', restart);
document.addEventListener('visibilitychange', () => {
  last = null;
  sounds.suspend(document.hidden);
  if (document.hidden) { cancelAnimationFrame(frameId); frameId = null; }
  else scheduleNarration();
});
addEventListener('pagehide', event => {
  if (event.persisted) return;
  sounds.stopAll();
  clearTimeout(openingTimer);
  cancelAnimationFrame(frameId);
});
restart();
if (joined) {
  window.addEventListener('message', event => {
    if (event.source === window.parent && event.origin === location.origin && event.data?.type === 'prologue:start-invitation') beginInvitation();
  });
  window.parent.postMessage({ type: 'prologue:invitation-ready' }, location.origin);
}
