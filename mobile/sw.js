const release = new URL(self.location.href).searchParams.get('v');
const scope = new URL(self.registration.scope);
const prefix = 'roc-mobile-preload-';
const versionPattern = /^[a-f0-9]{16}$/;
const core = new Set(['index.html', 'preload.js', 'preload-manifest.json', 'game-bundle.js']);

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function canonical(path) {
  return new URL(path, scope).href;
}

async function cached(path, version) {
  if (!versionPattern.test(version || '')) return undefined;
  return (await caches.open(prefix + version)).match(canonical(path));
}

async function loadEntry(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok) return response;
  } catch {
    // A completed local preload also supports starting the game offline.
  } finally {
    clearTimeout(timer);
  }
  return (await cached('index.html', release)) || fetch(request);
}

async function partial(response, range) {
  if (!range) return response;
  const blob = await response.blob();
  const bytes = blob.size;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  let start;
  let end;
  if (match && match[1]) {
    start = Number(match[1]);
    end = match[2] ? Math.min(bytes - 1, Number(match[2])) : bytes - 1;
  } else if (match && Number(match[2]) > 0) {
    start = Math.max(0, bytes - Number(match[2]));
    end = bytes - 1;
  }
  if (!(start >= 0 && start <= end && end < bytes)) {
    return new Response(null, {
      status: 416,
      headers: { 'Accept-Ranges': 'bytes', 'Content-Range': 'bytes */' + bytes },
    });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Length': String(end - start + 1),
      'Content-Range': 'bytes ' + start + '-' + end + '/' + bytes,
    },
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin ||
      !url.pathname.startsWith(scope.pathname) || url.searchParams.has('roc-download')) return;
  const path = url.pathname.slice(scope.pathname.length) || 'index.html';
  if (request.mode === 'navigate' && path === 'index.html') {
    event.respondWith(loadEntry(request));
    return;
  }
  if (!core.has(path) && !path.startsWith('assets/')) return;
  const version = url.searchParams.get('v') || release;
  event.respondWith((async () => {
    const response = await cached(path, version);
    return response ? partial(response, request.headers.get('Range')) : fetch(request);
  })());
});

