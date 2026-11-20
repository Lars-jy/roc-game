import { createMusicController } from './controller.js';
import { MUSIC_TRACKS, MUSIC_SETTINGS_KEY, INTERVIEW_TRACK, ENTRY_START_SECONDS, normalizeSettings, validMusicCommand } from './catalog.js';
import { createEffectsMixer } from './effects.js';

const SLOT = '__rocMusicRuntimeV1';
let installation;
function readSettings(win) { try { return normalizeSettings(JSON.parse(win.localStorage.getItem(MUSIC_SETTINGS_KEY))); } catch { return normalizeSettings(); } }
/** Playback treatment belongs only to owned BGM, never dialogue or ending audio. */
export function applyMusicPlaybackProfile(audio, profile, originalPreservesPitch = true) {
  if (!audio?.dataset?.rocMusic) return false;
  const rate = Number.isFinite(profile.playbackRate) ? profile.playbackRate : 1;
  if (audio.playbackRate !== rate) audio.playbackRate = rate;
  const preservesPitch = typeof profile.preservesPitch === 'boolean' ? profile.preservesPitch : originalPreservesPitch;
  if (audio.preservesPitch !== preservesPitch) audio.preservesPitch = preservesPitch;
  return true;
}
/** Only actual, same-origin descendants of this owner can control its audio. */
export function isOwnedWindow(source, owner) {
  try {
    if (!source || source.location.origin !== owner.location.origin) return false;
    let cursor = source;
    for (let depth = 0; depth < 12; depth++) {
      if (cursor === owner) return true;
      if (cursor.parent === cursor || !cursor.frameElement || cursor.frameElement.contentWindow !== cursor) return false;
      cursor = cursor.parent;
    }
  } catch { /* Cross-origin or disposed iframe. */ }
  return false;
}
function visibleTree(source, owner) {
  try {
    let cursor = source;
    while (cursor !== owner) {
      const frame = cursor.frameElement;
      if (!frame || frame.closest('[hidden],[aria-hidden="true"]')) return false;
      const style = cursor.parent.getComputedStyle(frame);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      cursor = cursor.parent;
    }
    return true;
  } catch { return false; }
}
function findOwner(win) {
  let cursor = win, owner = win;
  try { while (cursor.parent !== cursor && cursor.parent.location.origin === win.location.origin) { cursor = cursor.parent; if (cursor[SLOT]) owner = cursor; } } catch {}
  return owner;
}
function createRuntime(win) {
  const players = new Map(), clients = new Map();
  let context, contextFailed = false, destroyed = false, reportOwner = null, interviewOwner = null, audioUnlocked = false;
  const rootURL = new URL('../../assets/music/', import.meta.url);
  function routeTone(entry) {
    if (!entry.source || !entry.node || !context) return;
    const profile = entry.tone || { enabled: false };
    if (profile.enabled) {
      if (!entry.filters) {
        const lowpass = context.createBiquadFilter(), shelf = context.createBiquadFilter();
        lowpass.type = 'lowpass'; lowpass.Q.value = .707;
        shelf.type = 'highshelf'; shelf.frequency.value = 3500;
        lowpass.connect(shelf); shelf.connect(entry.node); entry.filters = { lowpass, shelf };
      }
      entry.filters.lowpass.frequency.setTargetAtTime(profile.lowpassHz, context.currentTime, .12);
      entry.filters.shelf.gain.setTargetAtTime(profile.highShelfDb, context.currentTime, .12);
    }
    if (entry.toneEnabled !== Boolean(profile.enabled)) {
      entry.source.disconnect();
      entry.source.connect(profile.enabled ? entry.filters.lowpass : entry.node);
      entry.toneEnabled = Boolean(profile.enabled);
    }
  }
  function graph(entry) {
    if (entry.node || contextFailed) return;
    try {
      const AudioContext = win.AudioContext || win.webkitAudioContext;
      if (!AudioContext) { contextFailed = true; return; }
      context ||= new AudioContext();
      const source = context.createMediaElementSource(entry.audio), node = context.createGain();
      node.gain.value = entry.value; source.connect(node); node.connect(context.destination);
      entry.audio.volume = 1; entry.source = source; entry.node = node; entry.toneEnabled = false;
      routeTone(entry);
    } catch { contextFailed = true; }
  }
  function createPlayer(id) {
    if (players.has(id)) return players.get(id).api;
    const audio = new win.Audio(new URL(MUSIC_TRACKS[id].file, rootURL).href);
    audio.preload = id === INTERVIEW_TRACK ? 'auto' : 'metadata'; audio.loop = true; audio.volume = 0;
    audio.dataset.rocMusic = id;
    audio.dataset.rocGain = '0';
    audio.dataset.rocPlayState = 'idle';
    audio.dataset.rocPlayError = '';
    audio.hidden = true;
    win.document.body?.append(audio);
    const entry = { audio, value: 0, pendingSeek: 0, originalPreservesPitch: audio.preservesPitch,
      wanted: false, pendingPlay: false, hasPlayed: false, request: 0, lastPlayError: null, lastAutoRetryAt: -Infinity };
    const seek = () => { try { if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(entry.pendingSeek, Math.max(0, audio.duration - .1)); } catch {} };
    audio.addEventListener('loadedmetadata', seek);
    function recover(recheckPolicy = false) {
      if (entry.recoveryQueued) return;
      entry.recoveryQueued = true;
      Promise.resolve().then(() => {
        entry.recoveryQueued = false;
        const state = controller.snapshot(), settings = state.settings;
        if (destroyed || !entry.wanted || entry.pendingPlay || !audio.paused || win.document.hidden
          || settings.muted || settings.masterMuted || settings.volume <= 0 || state.track !== id) return;
        // An explicit policy denial waits for a user gesture or focus after a
        // permission change. Never retry a blocked autoplay on a timer loop.
        if (!recheckPolicy && (!entry.hasPlayed || entry.lastPlayError === 'NotAllowedError')) return;
        const time = win.performance.now();
        if (time - entry.lastAutoRetryAt < 1000) return;
        entry.lastAutoRetryAt = time;
        entry.api.play();
      });
    }
    audio.addEventListener('pause', () => {
      audio.dataset.rocPlayState = entry.lastPlayError === 'NotAllowedError' ? 'blocked' : 'paused';
      recover();
    });
    audio.addEventListener('canplay', () => recover());
    win.addEventListener('focus', () => recover(true));
    entry.api = {
      position: () => audio.currentTime || entry.pendingSeek || 0,
      seek(value) { entry.pendingSeek = value; seek(); },
      play() {
        if (destroyed) return;
        entry.wanted = true; entry.pendingPlay = true; entry.lastPlayError = null;
        const request = ++entry.request;
        audio.dataset.rocPlayState = 'pending'; audio.dataset.rocPlayError = '';
        if (audioUnlocked) graph(entry);
        // Attempt audible autoplay honestly. Starting at exactly zero volume
        // can be accepted as muted autoplay, then paused when the fade rises.
        if (!entry.node && !audioUnlocked && entry.value === 0 && controller.snapshot().settings.volume > 0)
          audio.volume = Math.min(.001, controller.snapshot().settings.volume * .45);
        context?.resume().catch(() => {});
        const failed = error => {
          if (request !== entry.request) return;
          entry.pendingPlay = false; entry.lastPlayError = error?.name || 'Error';
          audio.dataset.rocPlayError = entry.lastPlayError;
          audio.dataset.rocPlayState = entry.lastPlayError === 'NotAllowedError' ? 'blocked' : 'error';
        };
        try {
          Promise.resolve(audio.play()).then(() => {
            if (request !== entry.request) return;
            entry.pendingPlay = false; entry.hasPlayed = !audio.paused || entry.hasPlayed;
            audio.dataset.rocPlayState = audio.paused ? 'paused' : 'playing';
          }, failed);
        } catch (error) { failed(error); }
      },
      pause() {
        entry.wanted = entry.pendingPlay = false; entry.request++;
        audio.pause(); audio.dataset.rocPlayState = 'paused';
      },
      tone(value) {
        const signature = `${value.enabled}:${value.lowpassHz}:${value.highShelfDb}:${value.playbackRate}:${value.preservesPitch}`;
        if (entry.toneSignature === signature) return;
        entry.toneSignature = signature; entry.tone = value; routeTone(entry);
        applyMusicPlaybackProfile(audio, value, entry.originalPreservesPitch);
        audio.dataset.rocTone = value.enabled ? 'interview' : 'neutral';
        audio.dataset.rocPlayback = value.playbackRate === .9 ? 'darkest-slow' : 'original';
      },
      gain(value) {
        value = Math.max(0, Math.min(.45, value));
        if (value !== 0 && Math.abs(entry.value - value) < .00002) return;
        entry.value = value;
        audio.dataset.rocGain = String(value);
        if (entry.node && context) {
          const gain = entry.node.gain, time = context.currentTime;
          gain.cancelScheduledValues(time); gain.setTargetAtTime(value, time, .035);
          if (value === 0) { gain.cancelScheduledValues(time); gain.setValueAtTime(0, time); }
        } else audio.volume = value;
      },
    };
    players.set(id, entry); return entry.api;
  }
  const controller = createMusicController({ createPlayer, now: () => win.performance.now(), settings: readSettings(win) });
  function valid(source) { return clients.has(source) && isOwnedWindow(source, win); }
  function active(source) { return valid(source) && clients.get(source).active && visibleTree(source, win); }
  function updateDuck() {
    let documentOpen = false, voice = false;
    for (const [source, item] of clients) if (active(source)) { documentOpen ||= item.document; voice ||= item.voice; }
    controller.duck('document', documentOpen ? 'document' : false); controller.duck('voice', voice ? 'voice' : false);
  }
  const runtime = {
    register(source) { if (!isOwnedWindow(source, win)) return false; if (!clients.has(source)) clients.set(source, { active: true, document: false, voice: false, scene: source.document?.documentElement?.dataset.sceneNavigation }); return true; },
    remove(source) { if (interviewOwner === source) { interviewOwner = null; controller.cue('interview-close'); } clients.delete(source); updateDuck(); },
    activate(source, value) {
      if (!valid(source)) return;
      clients.get(source).active = Boolean(value);
      if (value && clients.get(source).scene === 'people' && visibleTree(source, win)) { interviewOwner = source; reportOwner = null; controller.cue('interview-open'); }
      else if (!value && interviewOwner === source) { interviewOwner = null; controller.cue('interview-close'); }
      updateDuck();
    },
    cue(source, name, detail) {
      if (!validMusicCommand(name, detail)) return false;
      if (name === 'report-close' && valid(source) && reportOwner === source) { reportOwner = null; return controller.cue(name, detail); }
      if (name === 'interview-close' && valid(source) && interviewOwner === source) { interviewOwner = null; return controller.cue(name, detail); }
      if (!active(source)) return false;
      if (name === 'report-open') reportOwner = source;
      if (name === 'interview-open') interviewOwner = source;
      const accepted = controller.cue(name, detail);
      // A menu attempts ordinary media autoplay; denied playback is retried on
      // the first real gesture without adding a separate sound-start control.
      if (accepted && name === 'menu') {
        // Fetch and seek the opening attack while the player is on the cover.
        // This player stays silent until Start's real user gesture calls play.
        const story = createPlayer(INTERVIEW_TRACK);
        if (controller.snapshot().track !== INTERVIEW_TRACK) story.seek(ENTRY_START_SECONDS);
        controller.unlock();
      }
      return accepted;
    },
    duck(source, value) { if (!valid(source)) return; Object.assign(clients.get(source), { document: Boolean(value.document), voice: Boolean(value.voice) }); updateDuck(); },
    unlock(source, { deferCurrent = false } = {}) { if (active(source)) { audioUnlocked = true; controller.unlock({ playCurrent: !deferCurrent }); } },
    interviewMix: value => controller.interviewMix(value),
    settings(value) {
      const next = controller.settings(value);
      try { win.localStorage.setItem(MUSIC_SETTINGS_KEY, JSON.stringify(next)); } catch {}
      for (const source of clients.keys()) try { source.dispatchEvent(new source.CustomEvent('roc:music-settings-change', { detail: { ...next } })); } catch {}
      return next;
    },
    snapshot: () => controller.snapshot(),
    diagnostics: () => [...players].map(([id, item]) => ({ id, time: item.audio.currentTime, paused: item.audio.paused,
      gain: item.value, playbackRate: item.audio.playbackRate, preservesPitch: item.audio.preservesPitch,
      playback: item.audio.dataset.rocPlayback, duration: item.audio.duration, readyState: item.audio.readyState, error: item.audio.error?.code || null,
      playState: item.audio.dataset.rocPlayState, lastPlayError: item.lastPlayError, wanted: item.wanted, contextState: context?.state || null })),
    destroy() { destroyed = true; win.clearInterval(timer); controller.destroy(); for (const item of players.values()) { item.audio.removeAttribute('src'); item.audio.load(); } context?.close().catch(() => {}); },
  };
  const timer = win.setInterval(() => { controller.tick(); }, 50);
  win.addEventListener('visibilitychange', () => controller.hidden(win.document.hidden));
  win.document.addEventListener('visibilitychange', () => controller.hidden(win.document.hidden));
  // Chrome can keep this exact document in its back/forward cache. Its JS and
  // audio graph must survive that trip; destroying them leaves a silent page
  // when the cached document is restored without running its modules again.
  win.addEventListener('pagehide', event => {
    if (event.persisted) controller.hidden(true);
    else runtime.destroy();
  });
  win.addEventListener('pageshow', event => {
    if (event.persisted && !destroyed) controller.hidden(win.document.hidden);
  });
  win.addEventListener('storage', event => { if (event.key === MUSIC_SETTINGS_KEY) controller.settings(readSettings(win)); });
  return runtime;
}

/** Call in the outer shell and each active scene. Descendants reuse the outer player. */
export function installGameMusic() {
  if (installation) return installation;
  const win = window, owner = findOwner(win);
  owner[SLOT] ||= createRuntime(owner);
  const runtime = owner[SLOT]; runtime.register(win);
  installation = { runtime, owner };
  runtime.activate(win, win.document.documentElement.dataset.sceneEmbedded !== 'true');
  const effects = createEffectsMixer({ settings: () => runtime.snapshot().settings });
  // Also catches Audio instances kept only in closures, not attached to the DOM.
  const media = win.HTMLMediaElement?.prototype, nativePlay = media?.play;
  if (nativePlay) media.play = function (...args) { effects.register(this); return nativePlay.apply(this, args); };
  win.addEventListener('roc:music-settings-change', () => effects.update());
  win.addEventListener('storage', event => { if (event.key === MUSIC_SETTINGS_KEY) effects.update(); });
  // A fresh Chrome visit may reject the initial menu autoplay. Retry within
  // both the press and the resulting click (including accessible clicks),
  // without adding a sound-start button or restarting the music playhead.
  for (const name of ['pointerdown', 'click', 'keydown', 'touchstart']) win.document.addEventListener(name, event => {
    // Start will immediately replace the menu track. Do not briefly restart
    // the blocked theme on press-down before the opening note is triggered.
    const deferCurrent = Boolean(event.target?.closest?.('#start-case, #confirm-new-case'));
    runtime.unlock(win, { deferCurrent });
  }, { capture: true, passive: true });
  let voice = false, documentOpen = false, observer, additions;
  const observed = new WeakSet();
  function visible(node) { return node && !node.closest('[hidden]') && win.getComputedStyle(node).display !== 'none' && win.getComputedStyle(node).visibility !== 'hidden'; }
  function inspect() {
    documentOpen = [...win.document.querySelectorAll('dialog[open],#overlay [role="dialog"],#document-root:not([hidden]) .dv-overlay')].some(visible);
    const room = win.document.querySelector('#room');
    const conversation = room?.dataset.mode === 'talk' || voice;
    runtime.duck(win, { document: documentOpen && !win.document.querySelector('#chapter-summary'), voice: conversation });
  }
  function observe() {
    observer = new win.MutationObserver(inspect);
    function bind() {
      for (const node of win.document.querySelectorAll('dialog,#overlay,#document-root,#conversation,#room')) if (!observed.has(node)) {
        observed.add(node); observer.observe(node, { attributes: true, attributeFilter: ['open', 'hidden', 'data-mode'], childList: node.id === 'overlay' });
      }
      inspect();
    }
    additions = new win.MutationObserver(bind);
    additions.observe(win.document.body, { childList: true }); bind();
  }
  if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', observe, { once: true }); else observe();
  win.addEventListener('roc:voice', event => { voice = Boolean(event.detail?.active); inspect(); });
  win.addEventListener('scene:activate', () => { runtime.activate(win, true); inspect(); });
  win.addEventListener('scene:deactivate', () => { runtime.activate(win, false); });
  win.addEventListener('pagehide', event => {
    if (event.persisted) return;
    observer?.disconnect(); additions?.disconnect(); runtime.remove(win);
  });
  return installation;
}
export function musicCue(cue, detail = {}) { const { runtime } = installGameMusic(); return runtime.cue(window, cue, detail); }
export function getMusicSettings() { const { runtime } = installGameMusic(); return runtime.snapshot().settings; }
export function setMusicSettings(value) { const { runtime } = installGameMusic(); return runtime.settings(value); }
/** Dialogue underscore mix. Original speed/pitch, no EQ, 75% gain. BGM only. */
export function setInterviewMusicMix(value) { const { runtime } = installGameMusic(); return runtime.interviewMix(value); }
export function syncChapterMusic(state, events = []) {
  if (!state || !Number.isInteger(state.month)) return;
  musicCue('month', { month: state.month });
  for (const event of events) if (event.type === 'crisis') musicCue('crisis', { id: `${state.seed}:${event.id}` });
}
