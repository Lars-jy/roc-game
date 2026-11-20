import { documentLoaded, nextPaint, waitScenePixels, withDeadline } from './scene-readiness.js';
import { installGameMusic } from './music/install.js';

/** Three local scenes stay alive; transitions move their actual composited documents. */
const SCENES = new Map([
  ['desk', new URL('../board-receipt-preview.html', import.meta.url).pathname],
  ['questions', new URL('../investigation-cards.html', import.meta.url).pathname],
  ['people', new URL('../characters-room-preview.html', import.meta.url).pathname],
]);
const CHANNEL = 'jinding-scene-host-v2';
const HISTORY_KEY = '__jindingScene';
const FRAME_PARAM = 'scene-frame';
const READY_TIMEOUT = 8_000;
const root = document.documentElement;
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hooks = {};
let installed = false;
let pageScene;
let host;
let embedded = false;
let active = false;
let explicitlyReady = false;
let readyResolved = false;
let resolveInitialization;
let rejectInitialization;
const initialization = new Promise((resolve, reject) => {
  resolveInitialization = resolve;
  rejectInitialization = reject;
});
initialization.catch(() => {});

function sceneFor(value) {
  try {
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin) return undefined;
    return [...SCENES].find(([, path]) => path === url.pathname)?.[0];
  } catch { return undefined; }
}

function canonicalURL(value, from) {
  const url = new URL(value, window.location.href);
  const scene = sceneFor(url.href);
  if (!scene) return undefined;
  url.searchParams.delete(FRAME_PARAM);
  if (scene === 'people') url.searchParams.set('from', from === 'questions' ? 'questions' : 'desk');
  else url.searchParams.delete('from');
  return url;
}

function notify(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function invoke(name, detail) {
  try { return Promise.resolve(hooks[name]?.(detail)); }
  catch (error) { return Promise.reject(error); }
}

function peopleEntry(from) {
  if (pageScene !== 'people') return;
  const entry = from === 'questions' ? 'questions' : 'desk';
  const room = document.querySelector('#room');
  if (room) room.dataset.entry = entry;
  const back = document.querySelector('#scene-return');
  if (back) {
    back.href = entry === 'questions' ? './investigation-cards.html' : './board-receipt-preview.html';
    back.setAttribute('aria-label', entry === 'questions' ? '返回问答页面' : '返回桌面');
  }
}

const client = {
  scene: undefined,
  async prepare(detail) {
    await initialization;
    peopleEntry(detail.from);
    notify('scene:prepare', detail);
    await invoke('refresh', { ...detail, reason: 'activate' });
  },
  activate(detail) {
    active = true;
    peopleEntry(detail.from);
    notify('scene:activate', detail);
    invoke('activate', detail).catch((error) => notify('scene:lifecycle-error', { phase: 'activate', error }));
  },
  async deactivate(detail) {
    active = false;
    notify('scene:deactivate', detail);
    await invoke('deactivate', detail);
    // Modal dialogs in the base document otherwise escape the transformed scene layer.
    document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
  },
  async refresh(detail) {
    notify('scene:state-change', detail);
    await invoke('refresh', detail);
  },
};

/** Call when the page has completed its initial synchronous/async render. */
export function markSceneReady() {
  explicitlyReady = true;
  if (readyResolved) return;
  readyResolved = true;
  if(document.body)document.body.inert=false;
  resolveInitialization();
}

/** Finance/data rules remain inside their pages, outside this navigation system. */
export function registerSceneLifecycle(options = {}) {
  Object.assign(hooks, options);
  if (Object.hasOwn(options, 'ready')) {
    explicitlyReady = true;
    let ready;
    try { ready = typeof options.ready === 'function' ? options.ready() : options.ready; }
    catch (error) { rejectInitialization(error); return; }
    Promise.resolve(ready).then(markSceneReady, rejectInitialization);
  }
}

/** Hidden/preparing iframe scenes must not start gameplay animations or sound. */
export function isSceneActive() { return active; }

/** Tell the other already-open scenes that the formal save/data changed. */
export function broadcastSceneState(detail = {}) {
  if (embedded) {
    try { window.parent.postMessage({ channel: CHANNEL, action: 'state', detail }, window.location.origin); }
    catch { return false; }
  } else host?.publish(detail);
  return true;
}

function setLayerState(entry, visible, interactive = false) {
  entry.layer.style.visibility = visible ? 'visible' : 'hidden';
  entry.layer.inert = !interactive;
  entry.layer.setAttribute('aria-hidden', String(!interactive));
  entry.layer.style.pointerEvents = interactive ? 'auto' : 'none';
  if (entry.frame) entry.frame.tabIndex = interactive ? 0 : -1;
}

function rememberFocus(entry) {
  const element = entry.window.document.activeElement;
  if (element && element !== entry.window.document.body) entry.focus = element;
}

function restoreFocus(entry) {
  try {
    entry.window.focus();
    const document = entry.window.document;
    const savedFocus = entry.focus?.isConnected ? entry.focus : null;
    const target = savedFocus || document.querySelector('main, [role="main"]') || document.body;
    // A first visit focuses the full-screen landmark for keyboard continuity.
    // Chrome's default focus ring on that landmark looked like a white frame
    // around the room. Only this non-control anchor suppresses the outer ring;
    // restored buttons/links keep their own visible keyboard focus treatment.
    if (!savedFocus) target.setAttribute('data-scene-focus-anchor', '');
    if (!target.hasAttribute('tabindex') && !target.matches('a,button,input,textarea,select')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  } catch { /* Focus never controls navigation completion. */ }
}

function prepareBaseLayer() {
  const body = document.body;
  const style = getComputedStyle(body);
  const layer = document.createElement('div');
  layer.className = 'scene-host-layer scene-host-base';
  // Preserve body grid/flex layout and inherited page classes.
  for (const property of ['display', 'gridTemplateColumns', 'gridTemplateRows', 'gridAutoFlow', 'gridAutoRows', 'gridAutoColumns', 'gap', 'alignItems', 'alignContent', 'justifyItems', 'justifyContent', 'flexDirection', 'flexWrap', 'padding', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition']) {
    layer.style[property] = style[property];
  }
  while (body.firstChild) layer.append(body.firstChild);
  body.classList.add('scene-host-root');
  body.append(layer);
  return layer;
}

function transitionKind(from, to) {
  if (to === 'people') return 'people-forward';
  if (from === 'people') return 'people-back';
  return to === 'questions' ? 'blackboard-down' : 'blackboard-up';
}

async function animateLayers(source, target, kind) {
  const forward = kind === 'people-forward';
  const horizontal = kind.startsWith('people-');
  const down = kind === 'blackboard-down';
  const duration = horizontal ? 660 : down ? 740 : 540;
  let oldFrames;
  let newFrames;
  if (horizontal) {
    oldFrames = [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${forward ? '-100%' : '100%'},0,0)` }];
    newFrames = [{ transform: `translate3d(${forward ? '100%' : '-100%'},0,0)` }, { transform: 'translate3d(0,0,0)' }];
  } else if (down) {
    oldFrames = [{ opacity: 1 }, { opacity: .55 }];
    newFrames = [
      { transform: 'translate3d(0,-102%,0)', offset: 0, easing: 'cubic-bezier(.3,.1,.5,1)' },
      { transform: 'translate3d(0,-92%,0)', offset: .42, easing: 'cubic-bezier(.4,0,.3,1)' },
      { transform: 'translate3d(0,-1%,0)', offset: .91, easing: 'ease-out' },
      { transform: 'translate3d(0,0,0)', offset: 1 },
    ];
  } else {
    oldFrames = [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-102%,0)' }];
    newFrames = [{ opacity: .55 }, { opacity: 1 }];
  }
  source.layer.style.zIndex = down ? '2' : kind === 'blackboard-up' ? '3' : '2';
  target.layer.style.zIndex = down ? '3' : kind === 'blackboard-up' ? '2' : '3';
  source.layer.style.transform = oldFrames[0].transform || 'translate3d(0,0,0)';
  target.layer.style.transform = newFrames[0].transform || 'translate3d(0,0,0)';
  source.layer.classList.add('scene-host-moving');
  target.layer.classList.add('scene-host-moving');
  if (!horizontal) (down ? target : source).layer.classList.add('scene-host-blackboard');
  setLayerState(source, true);
  setLayerState(target, true);
  await nextPaint(window);
  const animations = [];
  try {
    if (!motion.matches && typeof source.layer.animate === 'function') {
      const options = { duration, easing: horizontal ? 'cubic-bezier(.35,0,.2,1)' : 'linear', fill: 'both' };
      animations.push(source.layer.animate(oldFrames, options), target.layer.animate(newFrames, options));
      await withDeadline(Promise.all(animations.map((animation) => animation.finished)), duration + 500);
    }
  } finally {
    target.layer.style.transform = 'translate3d(0,0,0)';
    target.layer.style.opacity = '1';
    source.layer.style.transform = 'translate3d(0,0,0)';
    source.layer.style.opacity = '1';
    setLayerState(source, false);
    setLayerState(target, true, true);
    for (const animation of animations) animation.cancel();
    source.layer.classList.remove('scene-host-moving', 'scene-host-blackboard');
    target.layer.classList.remove('scene-host-moving', 'scene-host-blackboard');
  }
}

function createHost(initialScene) {
  const layer = prepareBaseLayer();
  const initialURL = canonicalURL(window.location.href, new URLSearchParams(location.search).get('from'));
  const base = { scene: initialScene, layer, window, client, title: document.title, canonical: initialURL.href };
  const entries = new Map([[initialScene, base]]);
  let activeEntry = base;
  let returnScene = initialURL.searchParams.get('from') === 'questions' ? 'questions' : 'desk';
  let busy = false;
  let moving = false;
  let controller;
  let queuedPop;
  let rollingBack = false;
  let index = Number(history.state?.[HISTORY_KEY]?.index) || 0;
  let visibleURL = initialURL.href;
  let lastContext = { scene: initialScene, from: returnScene, initial: true, url: initialURL.href };
  setLayerState(base, true, true);
  history.replaceState({ ...history.state, [HISTORY_KEY]: { scene: initialScene, from: returnScene, index } }, '', initialURL);

  function entryFor(scene, url) {
    if (entries.has(scene)) return entries.get(scene);
    const frame = document.createElement('iframe');
    frame.className = 'scene-host-layer scene-host-frame';
    frame.title = { people: '人物访谈', questions: '调查推理桌', desk: '牌局桌面' }[scene];
    frame.setAttribute('loading', 'eager');
    const entry = { scene, frame, layer: frame, canonical: url.href };
    setLayerState(entry, false);
    frame.style.transform = 'translate3d(110%,0,0)';
    const frameURL = new URL(url);
    frameURL.searchParams.set(FRAME_PARAM, '1');
    entry.loaded = new Promise((resolve, reject) => {
      frame.addEventListener('load', () => {
        try {
          entry.window = frame.contentWindow;
          if (entry.window.location.origin !== location.origin) throw new Error('Unknown scene origin');
          entry.client = entry.window.__jindingSceneClient;
          if (entry.client?.scene !== scene) throw new Error('Scene did not initialize');
          entry.title = entry.window.document.title;
          resolve(entry);
        } catch (error) { reject(error); }
      }, { once: true });
      frame.addEventListener('error', () => reject(new Error('Scene failed to load')), { once: true });
    });
    entry.loaded.catch(() => {});
    entries.set(scene, entry);
    frame.src = frameURL.href;
    document.body.append(frame);
    return entry;
  }

  function authorizedSource(source) {
    return [...entries.values()].find((entry) => entry.window === source || entry.frame?.contentWindow === source);
  }

  async function navigate(value, options = {}) {
    const targetScene = sceneFor(value);
    if (!targetScene || (busy && options.history !== 'pop')) return false;
    if (busy) {
      queuedPop = { value, options };
      if (!moving) controller?.abort();
      return true;
    }
    const fromScene = activeEntry.scene;
    const from = targetScene === 'people' ? (fromScene === 'questions' ? 'questions' : 'desk') : returnScene;
    const url = canonicalURL(value, options.from || from);
    if (!url) return false;
    if (targetScene === fromScene) {
      if (options.history === 'pop') index = options.index;
      else if (url.href !== visibleURL) {
        ++index;
        history.pushState({ [HISTORY_KEY]: { scene: targetScene, from: options.from || from, index } }, '', url);
      }
      visibleURL = url.href;
      lastContext = { scene: targetScene, from: options.from || from, previous: fromScene, initial: false, url: url.href };
      await activeEntry.client.prepare(lastContext);
      activeEntry.client.activate(lastContext);
      return true;
    }
    busy = true;
    controller = new AbortController();
    const signal = controller.signal;
    const source = activeEntry;
    const context = { scene: targetScene, from: options.from || from, previous: fromScene, initial: false, url: url.href };
    let target;
    let deactivated = false;
    let success = false;
    notify('scene:navigation-start', context);
    try {
      target = entryFor(targetScene, url);
      await withDeadline((async () => {
        if (target.loaded) await target.loaded;
        await target.client.prepare(context);
        await waitScenePixels(target.window.document);
      })(), READY_TIMEOUT, signal);
      if (signal.aborted) throw new DOMException('Scene navigation cancelled', 'AbortError');
      rememberFocus(source);
      deactivated = true;
      await withDeadline(source.client.deactivate({ scene: fromScene, next: targetScene }), 1_000, signal);
      moving = true;
      await animateLayers(source, target, transitionKind(fromScene, targetScene));
      activeEntry = target;
      target.canonical = url.href;
      if (targetScene === 'people') returnScene = context.from;
      lastContext = context;
      if (!queuedPop) visibleURL = url.href;
      if (options.history === 'pop' && !queuedPop) index = options.index;
      else if (!queuedPop) {
        ++index;
        history.pushState({ [HISTORY_KEY]: { scene: targetScene, from: context.from, index } }, '', url);
      }
      document.title = target.title;
      if (!queuedPop) target.client.activate(context);
      restoreFocus(target);
      success = true;
      notify('scene:navigation-complete', context);
      return true;
    } catch (error) {
      // A timeout leaves the source document alive and visible; never force an incomplete scene in.
      if (target && target !== activeEntry) setLayerState(target, false);
      setLayerState(source, true, true);
      source.layer.style.transform = 'translate3d(0,0,0)';
      source.layer.style.opacity = '1';
      if (deactivated) source.client.activate({ ...lastContext, resumed: true });
      if (error.name !== 'AbortError') notify('scene:navigation-error', { ...context, error });
      if (options.history === 'pop' && !queuedPop) {
        const distance = index - options.index;
        if (Number.isInteger(distance) && distance) { rollingBack = true; history.go(distance); }
        else history.replaceState({ [HISTORY_KEY]: { scene: activeEntry.scene, from: returnScene, index } }, '', visibleURL);
      }
      return false;
    } finally {
      busy = false;
      moving = false;
      // A failed initialization/prepare Promise can stay rejected forever even
      // though the iframe already exposed its client. Drop that failed hidden
      // scene so the player's next click can retry a fresh document/resource
      // load. A deliberate cancellation may keep its still-valid cached scene.
      if (!success && target?.frame && (!target.client || !signal.aborted)) {
        target.frame.remove();
        entries.delete(target.scene);
      }
      if (queuedPop) {
        const next = queuedPop;
        queuedPop = undefined;
        void navigate(next.value, next.options);
      }
    }
  }

  window.addEventListener('popstate', (event) => {
    if (rollingBack) { rollingBack = false; return; }
    const state = event.state?.[HISTORY_KEY];
    if (!state || !SCENES.has(state.scene) || sceneFor(location.href) !== state.scene) return;
    void navigate(location.href, { history: 'pop', index: state.index, from: state.from });
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    const entry = authorizedSource(event.source);
    if (!entry) return;
    if(['chapter:ending-started','chapter:ending-complete'].includes(event.data?.type)) {
      if(entry===activeEntry)notify('chapter:scene-ending',{type:event.data.type,caseSeed:event.data.caseSeed});
      return;
    }
    if(event.data?.channel!==CHANNEL)return;
    if (event.data.action === 'navigate' && entry === activeEntry) void navigate(event.data.url);
    if (event.data.action === 'state') publish(event.data.detail, entry);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && busy && !moving) controller?.abort();
  });
  window.addEventListener('pagehide', () => { controller?.abort(); });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    for (const entry of entries.values()) {
      entry.layer.getAnimations().forEach((animation) => animation.cancel());
      entry.layer.style.transform = 'translate3d(0,0,0)';
      setLayerState(entry, entry === activeEntry, entry === activeEntry);
    }
  });

  function publish(detail, sourceEntry = base) {
    // The sender already updated through its store subscription. Hidden scenes
    // read the latest save in prepare(); rendering them per tile/input blocks
    // the same renderer thread and makes composited animation frames stall.
    if (!activeEntry.client || activeEntry === sourceEntry) return;
    activeEntry.client.refresh(detail).catch((error) => notify('scene:lifecycle-error', { phase: 'refresh', error }));
  }
  documentLoaded(document).then(async () => {
    await initialization;
    if (activeEntry === base) client.activate(lastContext);
  }).catch((error) => notify('scene:lifecycle-error', { phase: 'initialize', error }));
  return { navigate, publish, get activeScene() { return activeEntry.scene; } };
}

/** Fixed same-origin routes only. Modified/new-tab clicks retain native behavior. */
export function navigateScene(value) {
  if (!sceneFor(value)) return false;
  if (embedded) {
    window.parent.postMessage({ channel: CHANNEL, action: 'navigate', url: new URL(value, location.href).href }, location.origin);
    return true;
  }
  if (!host) return false;
  void host.navigate(value);
  return true;
}

export function installSceneNavigation(sceneName) {
  if (installed || !SCENES.has(sceneName) || sceneFor(location.href) !== sceneName) return;
  installed = true;
  pageScene = sceneName;
  client.scene = sceneName;
  try { embedded = new URLSearchParams(location.search).get(FRAME_PARAM)==='1' && window.parent !== window && window.parent.location.origin === location.origin; }
  catch { embedded = false; }
  active = !embedded;
  root.dataset.sceneNavigation = sceneName;
  root.dataset.sceneEmbedded = String(embedded);
  installGameMusic();
  window.__jindingSceneClient = client;
  documentLoaded(document).then(() => {
    // Existing synchronous preview modules finish by load. Formal modules can supply
    // an explicit ready Promise so async initialization cannot race a transition.
    if (!explicitlyReady) markSceneReady();
  });
  if (!embedded) {
    const installHost = () => { host = createHost(sceneName); window.__jindingSceneHost = host; };
    if (document.body) installHost();
    else document.addEventListener('DOMContentLoaded', installHost, { once: true });
  }
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target.toLowerCase() !== '_self')) return;
    if (!sceneFor(anchor.href)) return;
    if (navigateScene(anchor.href)) event.preventDefault();
  });
}

const initialScene = sceneFor(location.href);
if (initialScene) installSceneNavigation(initialScene);
