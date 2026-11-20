/** Readiness of real scene documents, not images cached in a departing page. */
const backgrounds = new WeakMap();

export function documentLoaded(document) {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => document.defaultView.addEventListener('load', resolve, { once: true }));
}

export function nextPaint(window) {
  return new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
}

export function withDeadline(promise, milliseconds, signal) {
  return new Promise((resolve, reject) => {
    let timer, settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => finish(reject, new DOMException('Scene navigation cancelled', 'AbortError'));
    // Even a previously cancelled navigation can already have started its load
    // Promise. Always consume that work's eventual rejection before returning.
    Promise.resolve(promise).then((value) => finish(resolve, value), (error) => finish(reject, error));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(reject, new Error('Scene readiness timed out')), milliseconds);
  });
}

function imageURLs(value) {
  return [...String(value).matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g)]
    .map((match) => match[1] ?? match[2] ?? match[3]).filter(Boolean);
}

function decodeImage(image) {
  if (!image.currentSrc && !image.getAttribute('src')) return Promise.resolve();
  image.loading = 'eager';
  if (typeof image.decode === 'function') return image.decode();
  if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject(new Error('Scene image failed'));
  return new Promise((resolve, reject) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', () => reject(new Error('Scene image failed')), { once: true });
  });
}

function decodeBackground(document, url) {
  if (!backgrounds.has(document)) backgrounds.set(document, new Map());
  const cache = backgrounds.get(document);
  if (cache.has(url)) return cache.get(url).ready;
  const image = new document.defaultView.Image();
  const item = { image, ready: undefined };
  image.src = new URL(url, document.baseURI).href;
  item.ready = decodeImage(image).catch((error) => { cache.delete(url); throw error; });
  cache.set(url, item);
  return item.ready;
}

function addURLs(value, base, urls) {
  for (const url of imageURLs(value)) {
    if (!url.startsWith('data:') && !url.startsWith('#')) urls.add(new URL(url, base).href);
  }
}

function styleURLs(style, base, urls) {
  for (const property of Array.from(style)) {
    // Include custom properties: room/background images can be provided through
    // CSS variables. Font-face resources are handled by document.fonts.ready.
    if (/background|mask/.test(property) || property.startsWith('--')) {
      addURLs(style.getPropertyValue(property), base, urls);
    }
  }
}

function sheetURLs(sheet, document, urls) {
  if (sheet.disabled) return true;
  let rules;
  try { rules = sheet.cssRules; }
  catch { return false; }
  const base = sheet.href || document.baseURI;
  function walk(list) {
    for (const rule of Array.from(list)) {
      if (rule.style) styleURLs(rule.style, base, urls);
      if (rule.styleSheet && !sheetURLs(rule.styleSheet, document, urls)) return false;
      if (rule.cssRules && !walk(rule.cssRules)) return false;
    }
    return true;
  }
  return walk(rules);
}

/** Call after the scene's initialization/refresh hook rendered its real DOM. */
export async function waitScenePixels(document) {
  await documentLoaded(document);
  const window = document.defaultView;
  const imageTasks = [...document.images]
    .filter((image) => !image.closest('[hidden]') && image.getClientRects().length)
    .map(decodeImage);
  const urls = new Set();
  // Reading 3 computed styles for every SVG/card descendant forced a large
  // synchronous style/layout pass before every scene change. Local stylesheets
  // expose the same image URLs directly, including pseudo-elements, in one pass.
  let readableSheets = true;
  for (const sheet of Array.from(document.styleSheets)) {
    if (!sheetURLs(sheet, document, urls)) readableSheets = false;
  }
  for (const element of document.querySelectorAll('[style*="url("]')) {
    styleURLs(element.style, document.baseURI, urls);
  }
  // Retain the previous safe fallback for an unreadable third-party stylesheet.
  // The bundled game uses same-origin stylesheets, so normal transitions never
  // require this whole-document computed-style scan.
  if (!readableSheets) {
    for (const element of document.querySelectorAll('body, body *')) {
      if (!(element instanceof window.HTMLElement) || element.closest('[hidden]') || !element.getClientRects().length) continue;
      for (const pseudo of [null, '::before', '::after']) {
        const style = window.getComputedStyle(element, pseudo);
        if (style.display === 'none' || (pseudo && (style.content === 'none' || style.content === 'normal'))) continue;
        for (const value of [style.backgroundImage, style.maskImage, style.webkitMaskImage]) addURLs(value, document.baseURI, urls);
      }
    }
  }
  await Promise.all([
    ...imageTasks,
    ...[...urls].map((url) => decodeBackground(document, url)),
    document.fonts?.ready,
  ]);
  // Hidden iframe rAF may be suspended; the visible same-origin host drives the paint boundary.
  await nextPaint(window.parent || window);
}
