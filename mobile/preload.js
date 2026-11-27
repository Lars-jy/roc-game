(() => {
  const html = document.documentElement;
  const version = html.dataset.rocBuild;
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
  let files;
  let store;
  let inProgress = false;

  function urlFor(path, parameter) {
    const url = new URL(path, root);
    url.searchParams.set(parameter, version);
    return url.href;
  }

  function setStatus(state, label, message) {
    html.dataset.rocLoad = state;
    status.textContent = label;
    detail.textContent = message;
  }

  function showProgress() {
    if (!files) return;
    const count = [...completed.values(), ...pending.values()].reduce((a, b) => a + b, 0);
    bar.value = count;
    percent.textContent = Math.min(100, Math.floor(count / bar.max * 100)) + '%';
    if (html.dataset.rocLoad === 'loading') {
      const mb = bytes => (bytes / 1000000).toFixed(1);
      detail.textContent = mb(count) + ' / ' + mb(bar.max) + ' MB';
    }
  }

  function hasController() {
    return navigator.serviceWorker.controller?.scriptURL === urlFor('sw.js', 'v');
  }

  async function connectCache() {
    if (!window.isSecureContext || !window.caches || !navigator.serviceWorker) return undefined;
    const service = navigator.serviceWorker;
    try {
      await service.register(urlFor('sw.js', 'v'), { scope: './', updateViaCache: 'none' });
      if (!hasController()) {
        await new Promise((resolve, reject) => {
          const finish = error => {
            clearTimeout(timer);
            service.removeEventListener('controllerchange', change);
            if (error) reject(error); else resolve();
          };
          const change = () => { if (hasController()) finish(); };
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
    const response = await fetch(urlFor('preload-manifest.json', 'v'));
    if (!response.ok) throw new Error('The manifest did not load.');
    const manifest = await response.json();
    if (manifest.version !== version || !manifest.files.length) throw new Error('The manifest is outdated.');
    bar.max = manifest.files.reduce((bytes, file) => bytes + file.bytes, 0);
    if (store) {
      await store.put(new URL('preload-manifest.json', root), new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }));
    }
    return manifest.files;
  }

  function remember(file, blob) {
    memory.set(file.path, URL.createObjectURL(blob));
  }

  async function readAsset(file) {
    const controller = new AbortController();
    let timer;
    let loaded = 0;
    const restartTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), 24000);
    };
    restartTimeout();
    try {
      const response = await fetch(urlFor(file.path, 'roc-download'), { signal: controller.signal });
      if (!response.ok || response.status === 206) throw new Error('Download failed: ' + file.path);
      let blob;
      if (!response.body) {
        const bytes = await response.arrayBuffer();
        loaded = bytes.byteLength;
        blob = new Blob([bytes], { type: file.type });
      } else {
        const reader = response.body.getReader();
        const chunks = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          restartTimeout();
          loaded += value.byteLength;
          if (loaded > file.bytes) {
            controller.abort();
            throw new Error('Unexpected asset size: ' + file.path);
          }
          chunks.push(value);
          pending.set(file.path, loaded);
          showProgress();
        }
        blob = new Blob(chunks, { type: file.type });
      }
      if (loaded !== file.bytes) throw new Error('Incomplete download: ' + file.path);
      return blob;
    } finally {
      clearTimeout(timer);
      pending.delete(file.path);
    }
  }

  async function saveAsset(file) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const blob = await readAsset(file);
        if (store) {
          await store.put(new URL(file.path, root), new Response(blob, {
            headers: {
              'Content-Type': file.type,
              'Content-Length': String(blob.size),
              'Accept-Ranges': 'bytes',
            },
          }));
        } else {
          remember(file, blob);
        }
        completed.set(file.path, file.bytes);
        showProgress();
        return;
      } catch (error) {
        showProgress();
        if (attempt || error.name === 'QuotaExceededError') throw error;
        await new Promise(resolve => setTimeout(resolve, 650));
      }
    }
  }

  async function checkSaved() {
    if (!store) return;
    const keys = new Set((await store.keys()).map(request => request.url));
    for (const file of files) {
      if (keys.has(new URL(file.path, root).href)) completed.set(file.path, file.bytes);
    }
    showProgress();
  }

  async function runPool(queue) {
    let failure;
    const worker = async () => {
      while (queue.length && !failure) {
        const file = queue.shift();
        try {
          await saveAsset(file);
        } catch (error) {
          failure = error;
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (failure) throw failure;
  }

  async function useMemory() {
    // A browser with full storage can still play from the downloaded bytes.
    const disk = store;
    store = undefined;
    for (const file of files) {
      if (!completed.has(file.path)) continue;
      const response = await disk.match(new URL(file.path, root));
      if (response) remember(file, await response.blob());
      else completed.delete(file.path);
    }
    html.dataset.rocCache = 'memory';
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
      const url = new URL(path + original.search + original.hash, root);
      url.searchParams.set('v', version);
      return url.href;
    };
    start();
  }

  async function begin() {
    if (inProgress) return;
    inProgress = true;
    retry.hidden = true;
    setStatus('preparing', '正在准备游戏', '首次需要下载游戏素材。');
    try {
      if (!files) {
        store = await connectCache();
        html.dataset.rocCache = store ? 'disk' : 'memory';
        files = await readManifest();
        await checkSaved();
      }
      setStatus('loading', '正在预载画面和声音', '');
      showProgress();
      try {
        await runPool(files.filter(file => !completed.has(file.path)));
      } catch (error) {
        if (!store || error.name !== 'QuotaExceededError') throw error;
        await useMemory();
        await runPool(files.filter(file => !completed.has(file.path)));
      }
      setStatus('opening', '载入完成', '正在打开封面');
      await enterGame();
    } catch (error) {
      console.warn('R.O.C. preload:', error);
      setStatus('failed', '载入中断', '请检查网络后重试，已载入的素材会保留。');
      retry.hidden = false;
    } finally {
      inProgress = false;
    }
  }

  retry.addEventListener('click', begin);
  void begin();
})();

