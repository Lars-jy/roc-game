import { initialViewport, constrainViewport, zoomViewport, panViewport, wheelViewport } from './document-viewport.js';

const PAPER_WIDTH = 800;
const PAGE_HEIGHT = PAPER_WIDTH * 2105 / 1489;
const PAGE_GAP = 20;
const PAGE_ROOT = new URL('../../assets/reception/documents/', import.meta.url);
const DOCUMENTS = {
  D01: { title: '稳盈计划产品说明及认购邀约', pages: ['D01.png'] },
  D02: { title: '认购与收益分配协议（节选）', pages: ['D02.png'] },
  D03: { title: '客户入账回单（周岚）', pages: ['D03.png'] },
};
let viewerNumber = 0;

export function createDocumentViewer({ root, onContinue = () => {} }) {
  if (!root) throw new TypeError('A document-viewer root is required.');
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const titleId = `dv-title-${++viewerNumber}`;
  root.innerHTML = `
    <section class="dv-overlay" role="dialog" aria-modal="true" aria-label="查看资料" aria-describedby="${titleId}">
      <div class="dv-shell">
        <header class="dv-header">
          <div class="dv-heading"><span class="dv-eyebrow">查看资料</span><h2 id="${titleId}"></h2></div>
          <div class="dv-tools" aria-label="资料缩放控制">
            <button class="dv-button dv-icon" type="button" data-action="out" aria-label="缩小">−</button>
            <output class="dv-percentage" aria-label="当前缩放比例">100%</output>
            <button class="dv-button dv-icon" type="button" data-action="in" aria-label="放大">＋</button>
            <button class="dv-button" type="button" data-action="reset" aria-label="重置">重置</button>
            <button class="dv-button dv-icon dv-close" type="button" data-action="continue" aria-label="关闭资料并继续">×</button>
          </div>
        </header>
        <div class="dv-viewport" tabindex="0" aria-label="资料阅读区域，可滚动或拖动查看">
          <div class="dv-paper"></div>
          <p class="dv-loading" role="status">正在展开资料…</p>
        </div>
        <footer class="dv-footer">
          <p hidden>Ctrl + 滚轮缩放<span aria-hidden="true">　·　</span>滚轮上下查看<span aria-hidden="true">　·　</span>按住鼠标拖动</p>
          <button class="dv-button dv-continue paper-choice" type="button" data-action="continue" aria-label="继续"><span>继续</span><span class="choice-mark" aria-hidden="true"></span></button>
        </footer>
      </div>
    </section>`;
  root.hidden = true;
  const viewportElement = root.querySelector('.dv-viewport');
  const paper = root.querySelector('.dv-paper');
  const title = root.querySelector('h2');
  const percentage = root.querySelector('.dv-percentage');
  const loading = root.querySelector('.dv-loading');
  const continueButton = root.querySelector('.dv-continue');
  const hint = root.querySelector('.dv-footer p');
  const normalHint = hint.textContent;
  let activeId = null;
  let lastFocus = null;
  let oldOverflow = '';
  let state = { scale: 1, x: 0, y: 0 };
  let viewport = { width: 1, height: 1 };
  let documentSize = { width: PAPER_WIDTH, height: PAGE_HEIGHT };
  let drag = null;
  let generation = 0;
  let destroyed = false;
  let controlHeld = false;

  function setControlHeld(value) {
    controlHeld = value;
    hint.textContent = value ? '缩放模式 · 滚轮放大或缩小，松开 Ctrl 返回滚动' : normalHint;
  }

  function measure() {
    viewport = { width: viewportElement.clientWidth || 1, height: viewportElement.clientHeight || 1 };
  }
  function paint() {
    paper.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    percentage.textContent = `${Math.round(state.scale * 100)}%`;
    viewportElement.dataset.zoom = String(state.scale);
    viewportElement.dataset.offsetY = String(Math.round(state.y));
  }
  function reset() {
    measure();
    state = initialViewport(viewport, documentSize);
    paint();
  }
  function zoom(factor, anchor = { x: viewport.width / 2, y: viewport.height / 2 }) {
    state = zoomViewport(state, state.scale * factor, anchor, viewport, documentSize);
    paint();
  }
  function stopDrag() {
    if (drag && viewportElement.hasPointerCapture?.(drag.id)) viewportElement.releasePointerCapture(drag.id);
    drag = null;
    viewportElement.classList.remove('dv-dragging');
  }
  function close() {
    if (!activeId) return;
    activeId = null;
    generation++;
    setControlHeld(false);
    stopDrag();
    root.hidden = true;
    doc.body.style.overflow = oldOverflow;
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }
  function finish() {
    if (!activeId) return;
    const id = activeId;
    close();
    onContinue(id);
  }
  function open(id) {
    if (destroyed) return false;
    const item = DOCUMENTS[id];
    if (!item) throw new RangeError(`Unknown public document: ${id}`);
    if (!activeId) {
      lastFocus = doc.activeElement;
      oldOverflow = doc.body.style.overflow;
      doc.body.style.overflow = 'hidden';
    }
    activeId = id;
    const token = ++generation;
    title.textContent = item.title;
    root.dataset.document = id;
    root.hidden = false;
    paper.replaceChildren();
    paper.style.width = `${PAPER_WIDTH}px`;
    documentSize = { width: PAPER_WIDTH, height: item.pages.length * PAGE_HEIGHT + (item.pages.length - 1) * PAGE_GAP };
    paper.style.height = `${documentSize.height}px`;
    loading.hidden = false;
    loading.textContent = '正在展开资料…';
    viewportElement.setAttribute('aria-busy', 'true');
    let loaded = 0;
    item.pages.forEach((file, index) => {
      const img = doc.createElement('img');
      img.className = 'dv-page';
      img.alt = `${item.title}，第${index + 1}页`;
      img.width = PAPER_WIDTH;
      img.height = Math.round(PAGE_HEIGHT);
      img.draggable = false;
      img.addEventListener('load', () => {
        if (token !== generation) return;
        loaded++;
        if (loaded === item.pages.length) {
          loading.hidden = true;
          viewportElement.setAttribute('aria-busy', 'false');
        }
      }, { once: true });
      img.addEventListener('error', () => {
        if (token !== generation) return;
        loading.hidden = false;
        loading.textContent = '资料暂未加载成功，请关闭后重新打开。';
        viewportElement.setAttribute('aria-busy', 'false');
      }, { once: true });
      img.src = new URL(file, PAGE_ROOT).href;
      paper.append(img);
    });
    reset();
    continueButton.focus({ preventScroll: true });
    return true;
  }
  function onClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    event.stopPropagation();
    if (action === 'continue') finish();
    if (action === 'in') zoom(1.2);
    if (action === 'out') zoom(1 / 1.2);
    if (action === 'reset') reset();
  }
  function onWheel(event) {
    if (!activeId) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = viewportElement.getBoundingClientRect();
    state = wheelViewport(state, {
      deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey || controlHeld,
    }, { x: event.clientX - rect.left, y: event.clientY - rect.top }, viewport, documentSize);
    paint();
  }
  function onPointerDown(event) {
    if (!activeId || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    viewportElement.setPointerCapture(event.pointerId);
    viewportElement.classList.add('dv-dragging');
  }
  function onPointerMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    state = panViewport(state, { x: event.clientX - drag.x, y: event.clientY - drag.y }, viewport, documentSize);
    drag.x = event.clientX;
    drag.y = event.clientY;
    paint();
  }
  function onKeyDown(event) {
    if (!activeId) return;
    event.stopPropagation();
    if (event.key === 'Control') {
      setControlHeld(true);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      finish();
    } else if (event.key === 'Tab') {
      const nodes = [...root.querySelectorAll('button:not([disabled]), [tabindex="0"]')];
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    } else if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const amount = event.key.startsWith('Page') ? viewport.height * .8 : 60;
      const delta = event.key === 'End' ? -documentSize.height * state.scale : event.key === 'Home' ? documentSize.height * state.scale : ['ArrowDown', 'PageDown'].includes(event.key) ? -amount : amount;
      state = panViewport(state, { x: 0, y: delta }, viewport, documentSize);
      paint();
    }
  }
  function onKeyUp(event) {
    if (event.key === 'Control') setControlHeld(false);
  }
  function onBlur() { setControlHeld(false); }
  const resizeObserver = new win.ResizeObserver(() => {
    if (!activeId) return;
    measure();
    state = constrainViewport(state, viewport, documentSize);
    paint();
  });
  resizeObserver.observe(viewportElement);
  root.addEventListener('click', onClick);
  viewportElement.addEventListener('wheel', onWheel, { passive: false });
  viewportElement.addEventListener('pointerdown', onPointerDown);
  viewportElement.addEventListener('pointermove', onPointerMove);
  viewportElement.addEventListener('pointerup', stopDrag);
  viewportElement.addEventListener('pointercancel', stopDrag);
  viewportElement.addEventListener('lostpointercapture', stopDrag);
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('keyup', onKeyUp, true);
  win.addEventListener('blur', onBlur);

  return {
    open,
    close,
    get isOpen() { return Boolean(activeId); },
    destroy() {
      close();
      destroyed = true;
      resizeObserver.disconnect();
      root.removeEventListener('click', onClick);
      viewportElement.removeEventListener('wheel', onWheel);
      viewportElement.removeEventListener('pointerdown', onPointerDown);
      viewportElement.removeEventListener('pointermove', onPointerMove);
      viewportElement.removeEventListener('pointerup', stopDrag);
      viewportElement.removeEventListener('pointercancel', stopDrag);
      viewportElement.removeEventListener('lostpointercapture', stopDrag);
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('keyup', onKeyUp, true);
      win.removeEventListener('blur', onBlur);
      root.replaceChildren();
    },
  };
}
