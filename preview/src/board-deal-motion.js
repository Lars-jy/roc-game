// Presentation only. The saved board, tile kinds and game RNG are never changed.
// Animate a bounded set of lightweight stand-ins instead of promoting every one
// of the 240 SVG/filter-heavy game buttons to a separate compositor layer.
const activeDeals = new WeakMap();
const durations = { 'new-month': 3000, restart: 900, shuffle: 900 };
const MAX_MOVING_CARDS = 48;
const managedStyles = ['visibility', 'pointer-events'];

function hash(value) {
  let number = 2166136261;
  for (const character of String(value)) {
    number ^= character.charCodeAt(0);
    number = Math.imul(number, 16777619);
  }
  return number >>> 0;
}
function fraction(id, salt) { return hash(`${id}:${salt}`) / 4294967296; }
function transform(x = 0, y = 0, tilt = 0, turn = 0, scale = 1) {
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) perspective(1100px) rotateX(${tilt.toFixed(2)}deg) rotateZ(${turn.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
}
function snapshotStyle(element) {
  return managedStyles.map(property => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
}
function restoreStyle(element, snapshot) {
  for (const [property, value, priority] of snapshot) {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  }
}

// Keep the visible outline and all four regions. Most buried faces and the
// tightly overlapping side-pile backs cannot contribute a useful moving pixel.
function representatives(tiles) {
  const budgets = { center: 34, buffer: 6, left: 4, right: 4 };
  const sample = [.08, .5, .92];
  const ranked = tiles.map(tile => {
    let visible = 0;
    for (const sx of sample) for (const sy of sample) {
      const x = tile.left + tile.width * sx, y = tile.top + tile.height * sy;
      if (!tiles.some(upper => upper.z > tile.z && x > upper.left && x < upper.left + upper.width && y > upper.top && y < upper.top + upper.height)) visible++;
    }
    return { tile, visible };
  }).sort((a, b) => b.visible - a.visible || b.tile.z - a.tile.z);
  const chosen = [];
  for (const [region, limit] of Object.entries(budgets)) {
    const members = ranked.filter(item => item.tile.region === region);
    // A side pile uses a few evenly spaced backs plus its actual top face.
    if ((region === 'left' || region === 'right') && members.length > limit) {
      const byDepth = members.map(item => item.tile).sort((a, b) => a.z - b.z);
      for (let n = 0; n < limit; n++) chosen.push(byDepth[Math.round(n * (byDepth.length - 1) / (limit - 1))]);
    } else chosen.push(...members.slice(0, limit).map(item => item.tile));
  }
  const selected = new Set(chosen);
  for (const { tile, visible } of ranked) {
    if (chosen.length >= MAX_MOVING_CARDS) break;
    if (visible && !selected.has(tile)) { chosen.push(tile); selected.add(tile); }
  }
  return chosen.slice(0, MAX_MOVING_CARDS).sort((a, b) => a.z - b.z);
}
function monthlyFrames(tile, width, height) {
  const id = tile.id, depth = fraction(id, 'desk-depth');
  const x = width * (.08 + fraction(id, 'desk-x') * .84) - tile.centerX;
  const y = height * (.49 + depth * .40) - tile.centerY;
  const angle = (fraction(id, 'desk-angle') - .5) * 92, flat = 58 - depth * 8;
  const packetX = width * (.46 + fraction(id, 'packet-x') * .08) - tile.centerX;
  const packetY = height * (.51 + fraction(id, 'packet-y') * .09) - tile.centerY;
  const packetAngle = (fraction(id, 'packet-angle') - .5) * 14;
  return [
    { offset: 0, transform: transform(x, y, flat, angle, .96) },
    { offset: .13, transform: transform(x, y, flat, angle, .96), easing: 'cubic-bezier(.35,0,.25,1)' },
    { offset: .49, transform: transform(x * .79, y * .66, 0, angle * .38, 1), easing: 'cubic-bezier(.5,0,.2,1)' },
    { offset: .70, transform: transform(packetX, packetY, 0, packetAngle, .99), easing: 'cubic-bezier(.2,.65,.2,1)' },
    { offset: .94, transform: transform(0, -2), easing: 'ease-out' },
    { offset: 1, transform: transform() },
  ];
}
function shuffleFrames(tile, width, height) {
  const id = tile.id;
  const x = width * (.43 + fraction(id, 'shuffle-x') * .14) - tile.centerX;
  const y = height * (.43 + fraction(id, 'shuffle-y') * .14) - tile.centerY;
  const angle = (fraction(id, 'shuffle-turn') - .5) * 20;
  return [
    { offset: 0, transform: transform(), easing: 'cubic-bezier(.45,0,.25,1)' },
    { offset: .40, transform: transform(x, y, 0, angle, .98), easing: 'ease-in-out' },
    { offset: .56, transform: transform(x + (fraction(id, 'shuffle-cut') - .5) * width * .09, y - height * .025, 0, -angle, .98), easing: 'cubic-bezier(.15,.7,.2,1)' },
    { offset: .94, transform: transform(0, -1.5), easing: 'ease-out' },
    { offset: 1, transform: transform() },
  ];
}
function makeProxy(document, tile) {
  const proxy = document.createElement('div');
  proxy.className = tile.element.className;
  proxy.innerHTML = tile.element.innerHTML;
  proxy.setAttribute('aria-hidden', 'true');
  Object.assign(proxy.style, {
    position: 'absolute', left: `${tile.left}px`, top: `${tile.top}px`,
    width: `${tile.width}px`, height: `${tile.height}px`, zIndex: String(tile.z),
    visibility: 'visible', pointerEvents: 'none', transition: 'none',
    translate: '0 0', transformOrigin: '50% 50%', willChange: 'transform',
    // SVG + drop-shadow/brightness filters on 240 animated cards was the largest
    // GPU/raster cost. Paint each of these few faces once, without filter layers.
    filter: 'none', opacity: tile.element.classList.contains('covered') ? '.7' : '1',
  });
  return proxy;
}

/**
 * new-month: 3 seconds, flat scattered desk cards -> upright -> gather/redeal.
 * restart/shuffle: 0.9 seconds. All dimensions are read before any DOM writes.
 * Proxies are non-interactive and never carry data-tile IDs. The real, unchanged
 * final board is revealed in the same paint that removes the completed overlay.
 * Abort, resize, replacement and reduced motion always leave the board usable.
 */
export async function playBoardDeal(field, { mode = 'new-month', signal } = {}) {
  if (!Object.hasOwn(durations, mode)) throw new TypeError(`Unknown board deal mode: ${mode}`);
  const duration = durations[mode];
  const result = (completed, reason) => ({ completed, mode, duration, reason });
  if (!field?.querySelectorAll) return result(false, 'unavailable');
  activeDeals.get(field)?.cancel('superseded');
  if (signal?.aborted) return result(false, 'aborted');
  const elements = [...field.querySelectorAll('button[data-tile]')];
  if (!elements.length) return result(true, 'empty');
  const document = field.ownerDocument, view = document?.defaultView ?? globalThis;
  if (view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return result(true, 'reduced-motion');
  if (!field.isConnected || !document?.createElement || elements.some(element => typeof element.animate !== 'function')) return result(true, 'unavailable');
  const width = field.clientWidth, height = field.clientHeight;
  if (!width || !height) return result(true, 'unavailable');
  const tiles = elements.map(element => {
    const left = element.offsetLeft, top = element.offsetTop;
    const width = element.offsetWidth, height = element.offsetHeight;
    return { element, id: element.dataset.tile, region: element.dataset.region || 'center',
      left, top, width, height, centerX: left + width / 2, centerY: top + height / 2,
      z: Number(element.style.zIndex) || 0, style: snapshotStyle(element) };
  });
  const moving = representatives(tiles), hadInert = field.hasAttribute('inert');
  const animations = [], layer = document.createElement('div');
  layer.className = 'board-deal-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '100', contain: 'layout style', isolation: 'isolate' });
  let done = false, resizeObserver, mutationObserver, resolveCompletion;
  const completion = new Promise(resolve => { resolveCompletion = resolve; });
  const operation = { cancel: reason => finish(false, reason) };
  function finish(completed, reason) {
    if (done) return;
    done = true;
    resizeObserver?.disconnect(); mutationObserver?.disconnect();
    view.removeEventListener?.('resize', onResize); signal?.removeEventListener('abort', onAbort);
    animations.forEach(animation => animation.cancel());
    layer.remove();
    tiles.forEach(tile => restoreStyle(tile.element, tile.style));
    if (!hadInert) field.removeAttribute('inert');
    if (activeDeals.get(field) === operation) activeDeals.delete(field);
    resolveCompletion(result(completed, reason));
  }
  function onResize() { if (field.clientWidth !== width || field.clientHeight !== height) finish(false, 'resized'); }
  function onAbort() { finish(false, 'aborted'); }
  activeDeals.set(field, operation);
  field.setAttribute('inert', '');
  signal?.addEventListener('abort', onAbort, { once: true });
  view.addEventListener?.('resize', onResize, { passive: true });
  if (view.ResizeObserver) { resizeObserver = new view.ResizeObserver(onResize); resizeObserver.observe(field); }
  try {
    for (const tile of moving) {
      const proxy = makeProxy(document, tile);
      layer.append(proxy);
      const stagger = fraction(tile.id, 'delay') * (mode === 'new-month' ? 80 : 40);
      const frames = mode === 'new-month' ? monthlyFrames(tile, width, height) : shuffleFrames(tile, width, height);
      const animation = proxy.animate(frames, { duration: duration - stagger, delay: stagger, fill: 'both', easing: 'linear' });
      animations.push(animation);
    }
    // Append once, after the lightweight overlay is fully assembled. No forced
    // layout/geometry reads occur after this point or on an animation frame.
    field.append(layer);
    tiles.forEach(tile => {
      tile.element.style.setProperty('visibility', 'hidden', 'important');
      tile.element.style.setProperty('pointer-events', 'none', 'important');
    });
    if (view.MutationObserver) {
      mutationObserver = new view.MutationObserver(() => {
        if (!field.contains(layer) || elements.some(element => !field.contains(element))) finish(false, 'replaced');
      });
      mutationObserver.observe(field, { childList: true, subtree: false });
    }
    Promise.all(animations.map(animation => animation.finished.then(() => true, () => false))).then(status => {
      finish(status.every(Boolean), status.every(Boolean) ? 'complete' : 'cancelled');
    });
  } catch {
    animations.forEach(animation => animation.finished.catch(() => {}));
    finish(false, 'unavailable');
  }
  return completion;
}
