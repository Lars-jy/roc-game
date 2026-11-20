export const MIN_SCALE = .35;
export const MAX_SCALE = 3;
export const VIEW_PADDING = 24;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Keep at least one whole viewport of paper reachable, without losing the sheet offscreen. */
export function constrainViewport(state, viewport, documentSize, padding = VIEW_PADDING) {
  const scale = clamp(state.scale, MIN_SCALE, MAX_SCALE);
  const width = documentSize.width * scale;
  const height = documentSize.height * scale;
  const constrainAxis = (position, paperLength, viewLength) => paperLength + padding * 2 <= viewLength
    ? (viewLength - paperLength) / 2
    : clamp(position, viewLength - paperLength - padding, padding);
  return {
    scale,
    x: constrainAxis(state.x, width, viewport.width),
    y: constrainAxis(state.y, height, viewport.height),
  };
}

export function initialViewport(viewport, documentSize, padding = VIEW_PADDING) {
  const scale = Math.min(1, Math.max(MIN_SCALE, (viewport.width - padding * 2) / documentSize.width));
  return constrainViewport({ scale, x: (viewport.width - documentSize.width * scale) / 2, y: padding }, viewport, documentSize, padding);
}

/** Preserve the document point underneath the mouse, except where paper boundaries intervene. */
export function zoomViewport(state, nextScale, anchor, viewport, documentSize) {
  const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  const ratio = scale / state.scale;
  return constrainViewport({
    scale,
    x: anchor.x - (anchor.x - state.x) * ratio,
    y: anchor.y - (anchor.y - state.y) * ratio,
  }, viewport, documentSize);
}

export function panViewport(state, delta, viewport, documentSize) {
  return constrainViewport({ ...state, x: state.x + delta.x, y: state.y + delta.y }, viewport, documentSize);
}

export function wheelPixels(delta, mode, viewportHeight) {
  return delta * (mode === 1 ? 18 : mode === 2 ? viewportHeight : 1);
}

/** A wheel gesture either zooms around the cursor or scrolls, never both. */
export function wheelViewport(state, gesture, anchor, viewport, documentSize) {
  const delta = wheelPixels(gesture.deltaY, gesture.deltaMode, viewport.height);
  if (gesture.ctrlKey) {
    const factor = Math.exp(-Math.max(-500, Math.min(500, delta)) * .002);
    return zoomViewport(state, state.scale * factor, anchor, viewport, documentSize);
  }
  return panViewport(state, {
    x: -wheelPixels(gesture.deltaX || 0, gesture.deltaMode, viewport.width),
    y: -delta,
  }, viewport, documentSize);
}
