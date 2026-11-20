/** Map a viewport click to a contained PNG, including non-uniform FLIP scaling.
 * The room's portraits use object-fit:contain and object-position:center bottom.
 */
export function portraitUV({ rect, width, height, naturalWidth, naturalHeight }, point) {
  if (![rect?.left, rect?.top, rect?.width, rect?.height, width, height, naturalWidth, naturalHeight, point?.x, point?.y].every(Number.isFinite)
    || rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return null;
  const x = (point.x - rect.left) / rect.width, y = (point.y - rect.top) / rect.height;
  const scale = Math.min(width / naturalWidth, height / naturalHeight);
  const paintedWidth = naturalWidth * scale / width, paintedHeight = naturalHeight * scale / height;
  const left = (1 - paintedWidth) / 2, top = 1 - paintedHeight;
  if (x < left || x > left + paintedWidth || y < top || y > 1) return false;
  return { u: (x - left) / paintedWidth, v: (y - top) / paintedHeight };
}

/** true = visible art, false = known empty space, null = unavailable (fail safe).
 * A small alpha mask is read once per image/source, never once per pointer move.
 */
export function createPortraitHitTest({ document = globalThis.document } = {}) {
  const cache = new WeakMap();
  return function hitPortrait(image, point) {
    if (!image?.getBoundingClientRect) return null;
    const rect = image.getBoundingClientRect();
    const uv = portraitUV({ rect, width: image.clientWidth || rect.width, height: image.clientHeight || rect.height,
      naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }, point);
    if (uv === false || uv === null) return uv;
    if (!image.complete || !document?.createElement) return null;
    const source = image.currentSrc || image.getAttribute?.('src');
    let sample = cache.get(image);
    if (!sample || sample.source !== source) {
      sample = { source, data: null };
      cache.set(image, sample);
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(96 / image.naturalWidth, 144 / image.naturalHeight, 1);
        sample.width = canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        sample.height = canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return null;
        context.drawImage(image, 0, 0, sample.width, sample.height);
        sample.data = context.getImageData(0, 0, sample.width, sample.height).data;
      } catch { return null; }
    }
    if (!sample.data) return null;
    const x = Math.max(0, Math.min(sample.width - 1, Math.floor(uv.u * sample.width)));
    const y = Math.max(0, Math.min(sample.height - 1, Math.floor(uv.v * sample.height)));
    return sample.data[(y * sample.width + x) * 4 + 3] > 24;
  };
}
