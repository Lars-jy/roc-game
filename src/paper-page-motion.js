// Visual-only page turn. Rendering stays synchronous; no transaction or field
// value is held until an animation finishes.
export function createPaperPageMotion(dialog) {
  let active;
  function cancel() {
    const previous = active;
    active = undefined;
    previous?.cleanup();
  }
  function turn(render, direction = 1) {
    cancel();
    const previous = dialog.querySelector?.('.subscription-paper');
    const view = dialog.ownerDocument?.defaultView;
    const reduced = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const clone = !reduced && typeof previous?.cloneNode === 'function' && typeof previous?.animate === 'function'
      ? previous.cloneNode(true) : null;
    render();
    const paper = dialog.querySelector?.('.subscription-paper');
    const layout = dialog.querySelector?.('.subscription-layout');
    if (!clone || !paper?.animate || !layout?.append || !paper.getBoundingClientRect || !layout.getBoundingClientRect) return;
    const sheetRect = paper.getBoundingClientRect(), layoutRect = layout.getBoundingClientRect();
    if (!sheetRect.width || !sheetRect.height) return;
    clone.removeAttribute('id');
    clone.querySelectorAll?.('[id]').forEach(element => element.removeAttribute('id'));
    clone.querySelectorAll?.('input,textarea,select,button').forEach(element => { element.disabled = true; element.removeAttribute('name'); });
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
    clone.classList?.add('paper-turn-overlay');
    Object.assign(clone.style, {
      position: 'absolute', left: `${sheetRect.left - layoutRect.left}px`, top: `${sheetRect.top - layoutRect.top}px`,
      width: `${sheetRect.width}px`, height: `${sheetRect.height}px`, margin: '0', zIndex: '2',
      pointerEvents: 'none', transition: 'none', backfaceVisibility: 'hidden', willChange: 'transform,opacity',
    });
    layout.append(clone);
    const forward = direction >= 0, origin = forward ? '0% 50%' : '100% 50%';
    const angle = forward ? -1 : 1, duration = 420;
    const animations = [];
    let ended = false;
    const record = {
      cleanup() {
        if (ended) return;
        ended = true;
        for (const animation of animations) {
          animation.finished?.catch?.(() => {});
          animation.cancel();
        }
        clone.remove();
        if (active === record) active = undefined;
      },
    };
    active = record;
    try {
      animations.push(paper.animate([
        { transformOrigin: origin, transform: `rotateY(${-angle * 8}deg)`, opacity: .88 },
        { transformOrigin: origin, transform: 'rotateY(0deg)', opacity: 1 },
      ], { duration, easing: 'cubic-bezier(.2,.65,.2,1)', fill: 'both' }));
      animations.push(clone.animate([
        { offset: 0, transformOrigin: origin, transform: 'rotateY(0deg)', opacity: 1, boxShadow: '4px 7px 16px #0005' },
        { offset: .6, transformOrigin: origin, transform: `rotateY(${angle * 48}deg)`, opacity: .93, boxShadow: '18px 10px 24px #0006' },
        { offset: 1, transformOrigin: origin, transform: `rotateY(${angle * 86}deg)`, opacity: 0, boxShadow: '3px 8px 12px #0002' },
      ], { duration, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'both' }));
      Promise.allSettled(animations.map(animation => animation.finished)).then(record.cleanup);
    } catch {
      // An unsupported animation must never prevent reading or leaving a page.
      record.cleanup();
    }
  }
  return { turn, cancel };
}
