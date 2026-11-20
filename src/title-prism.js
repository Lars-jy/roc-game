/** Layered cover lighting. Optical functions reuse three.js MIT shader code;
 * see vendor/glass-optics/NOTICE.md for the exact upstream sources.
 * No cursor replacement, timers, persistent render loop, or game-state writes.
 */
import { createTitleGlass } from './title-glass.js';
import { glassLightProximity } from './title-light-scope.js';
import { titleCharacterShadows } from './title-shadow.js';
const installed = new WeakMap();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function titlePointer(clientX, clientY, rect) {
  if (![clientX, clientY, rect?.left, rect?.top, rect?.width, rect?.height].every(Number.isFinite)
    || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return { x: clamp((clientX - rect.left) / rect.width * 2 - 1, -1, 1),
    y: clamp((clientY - rect.top) / rect.height * 2 - 1, -1, 1) };
}

/** Install once on the real cover. Each pointer change schedules only enough
 * frames to settle; opening an overlay or entering the game cancels immediately.
 */
export function installTitlePrism({ root = document.querySelector('.entry-card'),
  container = document.querySelector('#chapter-entry'), view = window } = {}) {
  if (!root || !container) return { dispose() {} };
  if (installed.has(root)) return installed.get(root);
  const doc = root.ownerDocument || view.document;
  const artwork = root.querySelector?.('.prism-art') || root;
  const preference = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const removers = [];
  const styles = new Map();
  let rect, frame = null, lastTime = null, disposed = false;
  let sampleGlass = false;
  let glass, warmup = null;
  let x = 0, y = 0, light = 0, glassNear = 0, targetX = 0, targetY = 0, targetLight = 0, targetGlass = 0;
  const enabled = () => !disposed && !doc.hidden && !container.hidden && !container.inert && !preference?.matches;
  function prepareGlass() {
    if (glass || warmup !== null || !enabled()) return;
    const prepare = () => {
      warmup = null;
      if (!enabled()) return;
      glass = createTitleGlass(root, view);
      glass.render({ x, y, light, glass: glassNear });
    };
    // Chrome can paint the cover and respond to its controls before paying the
    // one-time GPU compilation cost. The CSS spotlight works during warmup.
    if (view.requestIdleCallback) warmup = view.requestIdleCallback(prepare, { timeout: 450 });
    else prepare();
  }
  function listen(target, name, fn, options) {
    target?.addEventListener?.(name, fn, options);
    removers.push(() => target?.removeEventListener?.(name, fn, options));
  }
  function setStyle(name, value) {
    if (styles.get(name) === value) return;
    styles.set(name, value);
    root.style.setProperty(name, value);
  }
  function paint() {
    setStyle('--prism-x', x.toFixed(4));
    setStyle('--prism-y', y.toFixed(4));
    setStyle('--prism-light', light.toFixed(4));
    setStyle('--shine-x', `${((x + 1) * 50).toFixed(2)}%`);
    setStyle('--shine-y', `${((y + 1) * 50).toFixed(2)}%`);
    setStyle('--spot-core', (.52-.52*light).toFixed(4));
    setStyle('--spot-mid', (.52-.495*light).toFixed(4));
    setStyle('--spot-edge', (.52-.21*light).toFixed(4));
    setStyle('--glass-near', glassNear.toFixed(4));
    for (const [name, shadow] of Object.entries(titleCharacterShadows(x, y, light, glassNear))) {
      setStyle(`--${name}-shadow-x`, `${(shadow.x / 1672 * 100).toFixed(4)}cqw`);
      setStyle(`--${name}-shadow-y`, `${(shadow.y / 1672 * 100).toFixed(4)}cqw`);
      setStyle(`--${name}-shadow-opacity`, shadow.opacity.toFixed(4));
    }
    glass?.render({ x, y, light, glass: glassNear });
  }
  function reset() {
    if (frame !== null) view.cancelAnimationFrame(frame);
    if (warmup !== null) view.cancelIdleCallback(warmup);
    warmup = null;
    frame = lastTime = null;
    sampleGlass = false;
    x = y = light = glassNear = targetX = targetY = targetLight = targetGlass = 0;
    root.removeAttribute('data-prism-active');
    paint();
  }
  function render(time) {
    frame = null;
    if (!enabled()) { reset(); return; }
    if (sampleGlass) {
      targetGlass = glassLightProximity(targetX, targetY);
      sampleGlass = false;
    }
    const dt = lastTime === null ? 16 : clamp(time - lastTime, 1, 32);
    lastTime = time;
    const amount = 1 - Math.exp(-dt / 70);
    x += (targetX - x) * amount;
    y += (targetY - y) * amount;
    light += (targetLight - light) * amount;
    glassNear += (targetGlass - glassNear) * amount;
    const pending = Math.max(Math.abs(x - targetX), Math.abs(y - targetY), Math.abs(light - targetLight), Math.abs(glassNear-targetGlass)) > .001;
    if (!pending) { x = targetX; y = targetY; light = targetLight; glassNear=targetGlass; lastTime = null; }
    paint();
    if (pending) frame = view.requestAnimationFrame(render);
    else if (!targetLight) root.removeAttribute('data-prism-active');
  }
  function schedule() {
    if (enabled() && frame === null) frame = view.requestAnimationFrame(render);
  }
  function move(event) {
    if (!enabled() || event.pointerType === 'touch') return;
    rect ||= artwork.getBoundingClientRect();
    if (event.clientY < rect.top || event.clientY > rect.top + rect.height) { leave(); return; }
    const point = titlePointer(event.clientX, event.clientY, rect);
    if (targetLight && point.x === targetX && point.y === targetY) return;
    if (!light) { x = point.x; y = point.y; }
    if (!targetLight) root.setAttribute('data-prism-active', 'true');
    targetX = point.x; targetY = point.y; targetLight = 1;
    sampleGlass = true;
    schedule();
  }
  // Fade at the last pointer position. Returning x/y to the centre here makes
  // the light visibly shoot inward whenever the pointer crosses a cover edge.
  function leave() {
    if (!targetLight) return;
    sampleGlass = false;
    targetLight = targetGlass = 0;
    schedule();
  }
  function reconcile() {
    rect = null;
    if (!enabled()) { reset(); return; }
    if (glass) glass.resize();
    else prepareGlass();
  }
  listen(root, 'pointerenter', move, { passive: true });
  listen(root, 'pointermove', move, { passive: true });
  listen(root, 'pointerleave', leave, { passive: true });
  listen(root, 'pointercancel', leave, { passive: true });
  listen(view, 'resize', reconcile, { passive: true });
  listen(container, 'scroll', () => { rect = null; leave(); }, { passive: true });
  // A monitor change can alter backing pixels without changing the window's CSS bounds.
  let resolution;
  function watchResolution() {
    resolution?.removeEventListener('change', densityChanged);
    if (!(view.devicePixelRatio > 0)) return;
    resolution = view.matchMedia?.(`(resolution: ${view.devicePixelRatio}dppx)`);
    resolution?.addEventListener('change', densityChanged);
  }
  function densityChanged() { watchResolution(); reconcile(); }
  watchResolution();
  listen(doc, 'visibilitychange', reconcile);
  listen(preference, 'change', reconcile);
  const observer = typeof view.MutationObserver === 'function' ? new view.MutationObserver(reconcile) : null;
  observer?.observe(container, { attributes: true, attributeFilter: ['hidden', 'inert'] });
  const result = { dispose() {
    if (disposed) return;
    reset(); disposed = true; observer?.disconnect();
    removers.splice(0).forEach(remove => remove());
    resolution?.removeEventListener('change', densityChanged);
    glass?.dispose();
    installed.delete(root);
  } };
  listen(view, 'pagehide', event => {
    if (event.persisted) reset();
    else result.dispose();
  });
  listen(view, 'pageshow', event => { if (event.persisted) reconcile(); });
  installed.set(root, result);
  paint();
  prepareGlass();
  return result;
}
