import { EndingRenderer } from './ending-player.js';
import { WIDTH, HEIGHT, sourceTimeAt, reportDissolveProgress, applyEndingPlayback } from './player-model.js';
import { isSceneActive } from '../scene-navigation.js';
import { endingViewport, normalizeEndingAnswer } from './integrated-ending-model.js';
import { getMusicSettings, musicCue } from '../music/install.js';
export { endingViewport, normalizeEndingAnswer } from './integrated-ending-model.js';

const ASSETS = new URL('../../assets/ending-demo/', import.meta.url).href;
let environment = null, loading = null, styleReady = null, session = null;

function letters(value) {
  return typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(value)
    : Array.from(value, (segment, index) => ({ segment, index }));
}

/** Measure visible textarea text on the real modal, without rendering a page image. */
export function measureConclusionLetters(report, view = window) {
  if (!report?.isConnected) return [];
  const viewport = endingViewport(view.innerWidth, view.innerHeight);
  const scroll = report.querySelector('.summary-report-scroll') || report;
  const area = scroll.getBoundingClientRect();
  const context = report.ownerDocument.createElement('canvas').getContext('2d');
  const result = [];
  for (const input of report.querySelectorAll('textarea[data-summary-field]')) {
    const box = input.getBoundingClientRect(), style = view.getComputedStyle(input);
    const borderX = parseFloat(style.borderLeftWidth) || 0, borderY = parseFloat(style.borderTopWidth) || 0;
    const paddingX = parseFloat(style.paddingLeft) || 0, paddingY = parseFloat(style.paddingTop) || 0;
    const size = parseFloat(style.fontSize) || 16, lineHeight = parseFloat(style.lineHeight) || size * 1.5;
    const width = Math.max(1, input.clientWidth - paddingX - (parseFloat(style.paddingRight) || 0));
    const clip = {
      left: Math.max(box.left + borderX, area.left, viewport.x),
      right: Math.min(box.right - (parseFloat(style.borderRightWidth) || 0), area.right, view.innerWidth - viewport.x),
      top: Math.max(box.top + borderY, area.top, viewport.y),
      bottom: Math.min(box.bottom - (parseFloat(style.borderBottomWidth) || 0), area.bottom, view.innerHeight - viewport.y),
    };
    if (clip.left >= clip.right || clip.top >= clip.bottom) continue;
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing = parseFloat(style.letterSpacing) || 0;
    const tabWidth = context.measureText(' ').width * (parseFloat(style.tabSize) || 8);
    let offset = 0, row = 0;
    for (const item of letters(input.value)) {
      const char = item.segment;
      if (char.includes('\n') || char === '\r') { offset = 0; row++; continue; }
      let advance = char === '\t' ? tabWidth - offset % tabWidth : context.measureText(char).width + spacing;
      if (offset > 0 && offset + advance > width) {
        offset = 0; row++;
        if (char === '\t') advance = tabWidth;
      }
      const x = box.left + borderX + paddingX + offset - input.scrollLeft;
      const y = box.top + borderY + paddingY + row * lineHeight - input.scrollTop + (lineHeight - size) / 2;
      if (y >= clip.bottom) break;
      if (!/^\s+$/u.test(char) && x + advance > clip.left && x < clip.right && y + size > clip.top && y < clip.bottom) {
        result.push({ char, x: (x + advance / 2 - viewport.x) / viewport.scale,
          y: (y + size / 2 - viewport.y) / viewport.scale,
          width: advance / viewport.scale, height: size / viewport.scale,
          fieldId: input.dataset.summaryField, index: item.index });
      }
      offset += advance;
    }
  }
  return result;
}

function ensureStyles() {
  if (styleReady) return styleReady;
  styleReady = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = new URL('./integrated-ending.css', import.meta.url).href;
    link.onload = resolve; link.onerror = () => { styleReady = null; link.remove(); reject(new Error('Ending styles could not load.')); };
    document.head.append(link);
  });
  return styleReady;
}

function notify(type, activeSession = session) {
  const message = { type, caseSeed: activeSession?.caseSeed || '' };
  window.dispatchEvent(new CustomEvent(type, { detail: message }));
  if (window.parent !== window) window.parent.postMessage(message, location.origin);
}

function ensureEnvironment() {
  if (environment) return environment;
  const layer = document.createElement('section'); layer.id = 'integrated-ending-layer'; layer.hidden = true;
  layer.setAttribute('aria-label', 'R.O.C结尾动画');
  const canvas = document.createElement('canvas'); canvas.id = 'integrated-ending-canvas';
  canvas.width = WIDTH; canvas.height = HEIGHT; canvas.setAttribute('aria-label', '调查报告结尾动画');
  const audio = document.createElement('audio'); audio.preload = 'auto'; audio.src = ASSETS + 'reference-audio.m4a';
  audio.dataset.rocVolumeManaged = 'true';
  layer.append(canvas, audio); document.body.append(layer);
  environment = { layer, canvas, audio, renderer: null };
  audio.addEventListener('ended', () => {
    const active = session;
    if (!active || active.phase !== 'playing') return;
    cancelAnimationFrame(active.animation);
    environment.renderer.renderAt(environment.renderer.map.duration, { force: true });
    active.phase = 'complete'; canvas.dataset.running = 'false'; canvas.dataset.ended = 'true';
    document.body.style.setProperty('--ending-ui-opacity', '0');
    notify('chapter:ending-complete', active); active.resolve({ completed: true });
  });
  audio.addEventListener('error', () => {
    if (session && ['starting', 'playing'].includes(session.phase)) fail(new Error('Ending audio could not play.'));
  });
  document.addEventListener('visibilitychange', reconcilePlayback);
  window.addEventListener('scene:deactivate', () => { if (session) session.sceneVisible = false; reconcilePlayback(); });
  window.addEventListener('scene:activate', () => { if (session) session.sceneVisible = true; reconcilePlayback(); });
  window.addEventListener('pagehide', () => {
    if (session?.phase === 'playing') pausePlayback(session);
    else audio.pause();
  });
  window.addEventListener('pageshow', reconcilePlayback);
  window.addEventListener('roc:music-settings-change', syncEndingPlayback);
  return environment;
}

/** Opening the report is the first point at which the ending's artwork is requested. */
export function preloadIntegratedEnding() {
  if (loading) return loading;
  const env = ensureEnvironment();
  loading = Promise.all([ensureStyles(), EndingRenderer.load(env.canvas, ASSETS)]).then(([, renderer]) => {
    env.renderer = renderer; return env;
  }).catch(error => { loading = null; throw error; });
  return loading;
}

export function isIntegratedEndingActive() {
  return Boolean(session && ['starting', 'playing', 'complete'].includes(session.phase));
}

function restoreUnderlay(active) {
  document.body.classList.remove('integrated-ending-active');
  document.body.style.removeProperty('--ending-ui-opacity');
  for (const item of active.underlay) if (item.node.isConnected) item.node.inert = item.inert;
  for (const item of active.fields) if (item.node.isConnected) item.node.readOnly = item.readOnly;
  environment.layer.hidden = true;
}

function fail(error) {
  const active = session; if (!active || active.phase === 'failed' || active.phase === 'complete') return;
  active.phase = 'failed'; cancelAnimationFrame(active.animation); environment.audio.pause();
  restoreUnderlay(active); active.reject(error);
}

function frame() {
  const active = session;
  if (!active || active.phase !== 'playing') return;
  const env = environment, time = Math.min(env.audio.currentTime, env.renderer.map.duration);
  syncEndingPlayback();
  const progress = reportDissolveProgress(sourceTimeAt(env.renderer.map, time));
  document.body.style.setProperty('--ending-ui-opacity', String(1 - progress));
  env.renderer.renderAt(time);
  env.canvas.dataset.audioTime = env.audio.currentTime.toFixed(3);
  if (!env.audio.ended && !env.audio.paused) active.animation = requestAnimationFrame(frame);
}

function syncEndingPlayback() {
  if (environment?.renderer && ['starting', 'playing'].includes(session?.phase)) {
    applyEndingPlayback(environment.audio, environment.renderer.map, getMusicSettings());
  }
}

function pausePlayback(active) {
  active.resumeVersion++;
  active.resumeWanted = !environment.audio.paused || active.resumeWanted;
  environment.audio.pause();
  cancelAnimationFrame(active.animation);
}

function reconcilePlayback() {
  const active = session;
  if (!active || active.phase !== 'playing') return;
  if (document.hidden || !active.sceneVisible) {
    pausePlayback(active);
  } else if (active.resumeWanted) {
    active.resumeWanted = false;
    syncEndingPlayback();
    const version = ++active.resumeVersion;
    const valid = () => session === active && active.phase === 'playing' && active.resumeVersion === version;
    environment.audio.play().then(() => { if (valid()) frame(); }, error => { if (valid()) fail(error); });
  }
}

/** Begin from the existing live report. Saving and readiness remain game rules. */
export function playIntegratedEnding({ value, report, caseSeed = '' }) {
  const answer = normalizeEndingAnswer(value);
  if (!answer || !report?.isConnected) return Promise.reject(new Error('The submitted conclusion is incomplete.'));
  if (isIntegratedEndingActive()) return session.promise;
  musicCue('ending');
  const env = ensureEnvironment(), origins = measureConclusionLetters(report);
  const active = {
    phase: 'starting', caseSeed: typeof caseSeed === 'string' ? caseSeed : '', animation: 0,
    sceneVisible: isSceneActive(), resumeWanted: false, resumeVersion: 0,
    underlay: [...document.body.children].filter(node => node !== env.layer && !['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName)).map(node => ({ node, inert: node.inert })),
    fields: [...report.querySelectorAll('textarea')].map(node => ({ node, readOnly: node.readOnly })),
  };
  active.promise = new Promise((resolve, reject) => { active.resolve = resolve; active.reject = reject; });
  session = active;
  // Lock once, before asynchronous preparation; keep the actual report in place.
  for (const item of active.fields) item.node.readOnly = true;
  for (const item of active.underlay) item.node.inert = true;
  document.body.classList.add('integrated-ending-active');
  document.body.style.setProperty('--ending-ui-opacity', '1');
  void preloadIntegratedEnding().then(async () => {
    if (session !== active || active.phase !== 'starting') return;
    env.renderer.prepare(answer, origins);
    env.audio.currentTime = 0;
    syncEndingPlayback();
    await env.audio.play();
    if (session !== active || active.phase !== 'starting') { env.audio.pause(); return; }
    env.layer.hidden = false; env.canvas.dataset.running = 'true'; env.canvas.dataset.ended = 'false';
    active.phase = 'playing'; env.renderer.renderAt(0, { force: true });
    notify('chapter:ending-started', active); frame(); reconcilePlayback();
  }).catch(fail);
  return active.promise;
}
