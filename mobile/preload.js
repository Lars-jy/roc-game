(() => {
  const page = document.documentElement;
  const version = page.dataset.rocBuild;
  const root = new URL('./', window.location.href);
  const prefix = 'roc-mobile-preload-';
  const bar = document.querySelector('[data-roc-progress]');
  const status = document.querySelector('[data-roc-status]');
  const percent = document.querySelector('[data-roc-percent]');
  const detail = document.querySelector('[data-roc-detail]');
  const retry = document.querySelector('[data-roc-retry]');
  const memory = new Map();
  const completed = new Map();
  const pending = new Map();
  let manifest;
  let store;
  let running = false;
  let paint = 0;

  function urlFor(path, parameter) {
    const url = new URL(path, root);
    if (parameter) url.searchParams.set(parameter, version);
    return url.href;
  }

  function setStatus(state, label, message) {
    page.dataset.rocLoad = state;
    status.textContent = label;
    detail.textContent = message;
  }

  function showProgress() {
    cancelAnimationFrame(paint);
    paint = requestAnimationFrame(() => {
      const count = [...completed.values(), ...pending.values()].reduce((a, b) => a + b, 0);
      bar.value = count;
      percent.textContent = Math.min(100, Math.floor(count / bar.max * 100)) + '%';
      if (page.dataset.rocLoad === 'loading') {
        const mb = bytes => (bytes / 1000000).toFixed(1);
        detail.textContent = mb(count) + ' / ' + mb(bar.max) + ' MB';
      }
    });
  }

  async function connectCache() {
    if (!window.isSecureContext || !window.caches || !navigator.serviceWorker) return undefined;
    const service = navigator.serviceWorker;
    const workerURL = urlFor('sw.js', 'v');
    const controlled = () => service.controller?.scriptURL === workerURL;
    try {
      if (!controlled()) {
        await service.register(workerURL, { scope: './', updateViaCache: 'none' });
      }
      if (!controlled()) {
        await new Promise((resolve, reject) => {
          const finish = error => {
            clearTimeout(timer);
            service.removeEventListener('controllerchange', change);
            if (error) reject(error); else resolve();
          };
          const change = () => { if (controlled()) finish(); };
          const timer = setTimeout(() => finish(new Error('Service worker not active')), 6500);
          service.addEventListener('controllerchange', change);
          change();
        });
      }
      return await caches.open(prefix + version);
    } catch {
      return undefined;
    }
  }

  async function readManifest() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 24000);
    try {
      const response = await fetch(urlFor('preload-manifest.json', 'v'), { signal: controller.signal });
      if (!response.ok) throw new Error('The manifest did not load.');
      const data = await response.json();
      if (data.version !== version || !data.files.length || !data.packs.length) {
        throw new Error('The manifest is outdated.');
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function remember(file, blob) {
    memory.set(file.path, URL.createObjectURL(blob));
  }

  async function rememberFile(file, blob) {
    if (store) {
      await store.put(urlFor(file.path), new Response(blob, {
        headers: {
          'Content-Type': file.type,
          'Content-Length': String(file.bytes),
          'Accept-Ranges': 'bytes',
        },
      }));
    } else {
      remember(file, blob);
    }
    completed.set(file.path, file.bytes);
  }

  async function readDownload(download, wantedBytes) {
    const controller = new AbortController();
    let timer;
    let loaded = 0;
    const restartTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), 24000);
    };
    restartTimeout();
    try {
      const response = await fetch(urlFor(download.path, 'roc-download'), { signal: controller.signal });
      if (!response.ok || response.status === 206) throw new Error('Download failed: ' + download.path);
      let blob;
      if (!response.body) {
        blob = await response.blob();
        loaded = blob.size;
      } else {
        const reader = response.body.getReader();
        const chunks = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          restartTimeout();
          loaded += value.byteLength;
          if (loaded > download.bytes) {
            controller.abort();
            throw new Error('Unexpected download size: ' + download.path);
          }
          chunks.push(value);
          pending.set(download.path, Math.floor(wantedBytes * loaded / download.bytes));
          showProgress();
        }
        blob = new Blob(chunks);
      }
      if (loaded !== download.bytes) throw new Error('Incomplete download: ' + download.path);
      return blob;
    } finally {
      clearTimeout(timer);
      pending.delete(download.path);
    }
  }

  function storageFull(error) {
    return ['QuotaExceededError', 'InvalidStateError', 'SecurityError'].includes(error?.name);
  }

  async function saveDownload(download) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const wanted = download.files.filter(file => !completed.has(file.path));
        if (!wanted.length) return;
        const bytes = wanted.reduce((sum, file) => sum + file.bytes, 0);
        const blob = await readDownload(download, bytes);
        for (const file of wanted) {
          const begin = file.offset || 0;
          await rememberFile(file, blob.slice(begin, begin + file.bytes, file.type));
          showProgress();
        }
        return;
      } catch (error) {
        showProgress();
        if (attempt || storageFull(error)) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  function makeQueue() {
    const bundles = new Map(manifest.packs.map(pack => [pack.path, { ...pack, files: [] }]));
    const shell = [];
    for (const file of manifest.files) {
      if (file.pack) bundles.get(file.pack).files.push(file);
      else shell.push({ ...file, files: [file] });
    }
    // Keep the largest downloads running while idle workers finish the small shell files.
    return [...[...bundles.values()].sort((a, b) => b.bytes - a.bytes), ...shell];
  }

  async function collectDownloads() {
    const queue = makeQueue().filter(item => item.files.some(file => !completed.has(file.path)));
    let failure;
    const worker = async () => {
      while (queue.length && !failure) {
        const next = queue.shift();
        try {
          await saveDownload(next);
        } catch (error) {
          failure = error;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(queue.length, 6) }, worker));
    if (failure) throw failure;
  }

  async function checkSaved() {
    if (!store) return;
    const keys = new Set((await store.keys()).map(request => request.url));
    for (const file of manifest.files) {
      if (keys.has(urlFor(file.path))) completed.set(file.path, file.bytes);
    }

    const previous = manifest.reuseFrom;
    if (completed.size === manifest.files.length || !previous ||
        !await caches.has(prefix + previous.version)) return;
    const old = await caches.open(prefix + previous.version);
    const reusable = new Set(previous.files);
    for (const file of manifest.files) {
      if (completed.has(file.path) || !reusable.has(file.path)) continue;
      const address = urlFor(file.path);
      const item = await old.match(address);
      if (item && Number(item.headers.get('Content-Length')) === file.bytes) {
        await store.put(address, item);
        completed.set(file.path, file.bytes);
        showProgress();
      }
    }
  }

  async function useMemory() {
    const disk = store;
    store = undefined;
    for (const file of manifest.files) {
      if (!completed.has(file.path)) continue;
      const response = await disk.match(urlFor(file.path)).catch(() => undefined);
      if (response) remember(file, await response.blob());
      else completed.delete(file.path);
    }
    page.dataset.rocCache = 'memory';
  }

  async function prepare() {
    [manifest, store] = await Promise.all([readManifest(), connectCache()]);
    page.dataset.rocCache = store ? 'disk' : 'memory';
    bar.max = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
    if (!store) return;
    try {
      await store.put(urlFor('preload-manifest.json'), new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }));
      await checkSaved();
    } catch (error) {
      if (!storageFull(error)) throw error;
      await useMemory();
    }
  }

  async function enterGame() {
    const script = document.createElement('script');
    script.src = memory.get('game-bundle.js') || urlFor('game-bundle.js', 'v');
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('The game script did not load.')); };
      document.head.append(script);
    });
    const start = window.__rocMobileStart;
    if (typeof start !== 'function') throw new Error('The game script is missing.');
    window.__rocMobileAsset = (path, original) => {
      const cached = memory.get(path);
      if (cached) return cached + original.hash;
      return urlFor(path + original.search + original.hash, 'v');
    };
    start();
  }

  async function begin() {
    if (running) return;
    running = true;
    retry.hidden = true;
    setStatus('preparing', '正在准备游戏', '首次需要下载游戏素材。');
    try {
      if (!manifest) await prepare();
      setStatus('loading', '正在预载画面和声音', '');
      showProgress();
      try {
        await collectDownloads();
      } catch (error) {
        if (!store || !storageFull(error)) throw error;
        await useMemory();
        await collectDownloads();
      }
      setStatus('opening', '载入完成', '正在打开封面');
      await enterGame();
    } catch (error) {
      console.warn('R.O.C. preload:', error);
      setStatus('failed', '载入中断', '请检查网络后重试，已载入的素材会保留。');
      retry.hidden = false;
    } finally {
      running = false;
    }
  }

  retry.addEventListener('click', begin);
  void begin();
})();
